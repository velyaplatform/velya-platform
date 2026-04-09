# Modelo de Classificação de Workloads Velya

**Versão:** 1.0  
**Domínio:** Arquitetura de Workloads  
**Classificação:** Documento de Referência Técnica  
**Data:** 2026-04-08

---

## Visão Geral

A Velya classifica todos os seus workloads em 6 classes distintas. Cada classe tem políticas específicas de:

- Node placement (onde roda)
- Scaling policy (como cresce)
- Retry policy (como falha e recupera)
- Resource budget (quanto consome)
- SLA/SLO (o que promete)
- Risk class (o que acontece se falhar)
- Observability profile (o que monitora)

**Nenhum workload é deployado sem estar classificado.** A classificação determina toda a configuração de infraestrutura.

---

## As 6 Classes de Workload

```
┌─────────────────────────────────────────────────────────────────┐
│  Classe 1: realtime-request-serving                             │
│  Classe 2: async-worker                                         │
│  Classe 3: scheduled                                            │
│  Classe 4: long-running-durable                                 │
│  Classe 5: continuous-sentinel                                   │
│  Classe 6: heavy-analytics-ai                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Classe 1: realtime-request-serving

### Definição

Serviços que respondem a requisições HTTP/gRPC em tempo real, onde latência é crítica e disponibilidade é alta.

### Exemplos Velya

| Serviço              | Rota Exemplo             | SLO Latência |
| -------------------- | ------------------------ | ------------ |
| api-gateway          | POST /api/v1/patients    | P99 < 300ms  |
| patient-flow-service | GET /api/v1/flow/status  | P99 < 200ms  |
| task-inbox-service   | GET /api/v1/tasks        | P99 < 150ms  |
| velya-web (Next.js)  | GET / (SSR)              | P99 < 500ms  |
| ai-gateway (sync)    | POST /api/v1/ai/complete | P99 < 8s     |

### Node Placement

```yaml
# Nós On-Demand, família compute-optimized ou general purpose
nodeSelector:
  velya.io/workload-class: realtime-request-serving
  karpenter.sh/capacity-type: on-demand

affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector:
        matchLabels:
          velya.io/workload-class: realtime-request-serving
          app: api-gateway
      topologyKey: kubernetes.io/hostname  # Um pod por nó
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchLabels:
            app: api-gateway
        topologyKey: topology.kubernetes.io/zone  # Spreading por AZ

tolerations:
- key: velya.io/realtime
  operator: Exists
  effect: NoSchedule
```

### Scaling Policy

```yaml
# HPA baseado em RPS + CPU
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: velya-dev-core
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 30
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
        - type: Pods
          value: 4
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300 # 5 min para scale-down
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: '100'
```

### Retry Policy

| Tipo de Erro       | Retry         | Backoff               | Max Tentativas |
| ------------------ | ------------- | --------------------- | -------------- |
| 5xx (server error) | Sim (cliente) | Exponencial 100ms-10s | 3              |
| 429 (rate limit)   | Sim (cliente) | Exponencial 1s-60s    | 5              |
| 4xx (client error) | Não           | N/A                   | 0              |
| Timeout de rede    | Sim           | Linear 500ms          | 3              |
| Connection refused | Sim           | Exponencial 200ms-5s  | 5              |

### Resource Budget

```yaml
resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 512Mi
```

### SLA/SLO

| Métrica                  | SLO                                       |
| ------------------------ | ----------------------------------------- |
| Disponibilidade          | 99.9% (máx 8.7h/ano de indisponibilidade) |
| Latência P50             | < 80ms                                    |
| Latência P99             | < 300ms                                   |
| Error rate               | < 0.1%                                    |
| Startup time (pod ready) | < 30s                                     |

### Risk Class: ALTO

**Impacto de falha**: usuários não conseguem acessar a plataforma. Potencial impacto clínico se equipe hospitalar não consegue visualizar tarefas ou fluxo de pacientes.

**PDB obrigatório:**

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-gateway-pdb
  namespace: velya-dev-core
spec:
  maxUnavailable: 1
  selector:
    matchLabels:
      app: api-gateway
```

### Observability Profile

| Métrica            | Instrumento                | Alert Threshold    |
| ------------------ | -------------------------- | ------------------ |
| Request rate       | Prometheus (NGINX ingress) | Drop > 20% em 5min |
| Latência P99       | Prometheus histogram       | > 500ms por 2min   |
| Error rate         | Prometheus counter         | > 1% por 1min      |
| Pod restarts       | Kubernetes events          | > 3 em 10min       |
| CPU utilization    | cAdvisor                   | > 80% por 5min     |
| Memory utilization | cAdvisor                   | > 85% por 5min     |

---

## Classe 2: async-worker

### Definição

Workers que processam mensagens/eventos de filas assíncronas (NATS JetStream). Não servem HTTP diretamente. São event-driven.

### Exemplos Velya

| Worker              | Fila/Stream               | Throughput Esperado  |
| ------------------- | ------------------------- | -------------------- |
| patient-flow-worker | velya.clinical.events     | 100-1000 eventos/min |
| discharge-worker    | velya.discharge.queue     | 10-100 tasks/min     |
| notification-worker | velya.tasks.notifications | 50-500 notif/min     |
| audit-writer        | velya.audit.log           | 200-2000 eventos/min |

### Node Placement

```yaml
# Spot é aceitável — workers são stateless e tolerantes a interrupção
nodeSelector:
  velya.io/workload-class: async-worker

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 50
        podAffinityTerm:
          labelSelector:
            matchLabels:
              velya.io/workload-class: async-worker
          topologyKey: kubernetes.io/hostname

tolerations:
  - key: velya.io/async-worker
    operator: Exists
    effect: NoSchedule
  - key: 'spot'
    operator: 'Equal'
    value: 'true'
    effect: 'NoSchedule'
```

### Scaling Policy (KEDA)

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: patient-flow-worker-scaler
  namespace: velya-dev-core
spec:
  scaleTargetRef:
    name: patient-flow-worker
  minReplicaCount: 1
  maxReplicaCount: 30
  pollingInterval: 15
  cooldownPeriod: 120
  triggers:
    - type: nats-jetstream
      metadata:
        natsServerMonitoringEndpoint: 'nats-monitoring.velya-dev-platform.svc:8222'
        account: '$G'
        stream: velya.clinical.events
        consumer: patient-flow-consumer
        lagThreshold: '50' # Escalar quando lag > 50 msgs por worker
        activationLagThreshold: '5'
```

### Retry Policy

| Tipo de Erro                 | Retry                        | Comportamento                      |
| ---------------------------- | ---------------------------- | ---------------------------------- |
| Erro de processamento        | NATS reentrega               | max_deliver=5, backoff exponencial |
| Erro de dependência externa  | Worker ack + retry com delay | 30s, 60s, 120s, 300s               |
| Erro fatal (dados inválidos) | Mover para DLQ               | Após 5 tentativas                  |
| Panic/crash do worker        | NATS reentrega automática    | Após ack_wait timeout              |

### Resource Budget

```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi
```

### SLA/SLO

| Métrica                 | SLO                                        |
| ----------------------- | ------------------------------------------ |
| Message processing rate | > 95% em < 30s                             |
| DLQ growth rate         | < 1 msg/min em estado normal               |
| Backlog clearance       | < 5min após spike                          |
| Worker availability     | 99% (pode ter gap de 60s em Spot eviction) |

### Risk Class: MÉDIO

**Impacto de falha**: processamento de eventos atrasado. Tarefas podem aparecer com delay na interface. Sem impacto clínico direto (sistema assíncrono tem buffer).

### Observability Profile

```yaml
# Métricas KEDA + NATS
velya_nats_pending_messages{stream="clinical.events"}  # Profundidade de fila
velya_nats_consumer_lag{consumer="patient-flow"}       # Lag do consumer
velya_worker_processing_duration_seconds               # Tempo de processamento
velya_worker_dlq_messages_total                        # Total de DLQ
```

---

## Classe 3: scheduled

### Definição

Jobs que executam em horários ou intervalos fixos. Stateless ou com estado em storage externo. Tolerantes a falha única (re-executa na próxima rodada).

### Exemplos Velya

| Job                | Schedule       | Duração Esperada | Crítico?     |
| ------------------ | -------------- | ---------------- | ------------ |
| cost-sweep         | `0 2 * * *`    | 5-15 min         | Não          |
| daily-report       | `0 6 * * *`    | 10-30 min        | Não          |
| health-summary     | `0 * * * *`    | 1-3 min          | Não          |
| data-backup        | `0 3 * * *`    | 20-60 min        | Sim (backup) |
| quota-check        | `*/30 * * * *` | 30s              | Não          |
| bed-occupancy-sync | `*/5 * * * *`  | 10s              | Não          |

### Node Placement

```yaml
# Batch nodes — Spot aceitável, baixa prioridade
spec:
  template:
    spec:
      priorityClassName: velya-batch
      tolerations:
        - key: velya.io/batch
          operator: Exists
          effect: NoSchedule
        - key: 'spot'
          operator: 'Equal'
          value: 'true'
          effect: 'NoSchedule'
      nodeSelector:
        velya.io/workload-class: scheduled-batch
```

### Configuração Completa CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cost-sweep
  namespace: velya-dev-platform
  labels:
    velya.io/workload-class: scheduled
    velya.io/criticality: low
spec:
  schedule: '0 2 * * *'
  timeZone: 'America/Sao_Paulo'
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 3600 # Se atrasou > 1h, não executar
  successfulJobsHistoryLimit: 7
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 2 # Máximo 2 retentativas
      activeDeadlineSeconds: 1800 # Timeout de 30 minutos
      template:
        spec:
          restartPolicy: OnFailure
          priorityClassName: velya-batch
          serviceAccountName: cost-sweep-sa
          containers:
            - name: cost-sweep
              image: velya/cost-sweep:1.2.0
              imagePullPolicy: IfNotPresent
              env:
                - name: DRY_RUN
                  value: 'false'
                - name: SLACK_CHANNEL
                  value: '#velya-ops-alerts'
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 500m
                  memory: 256Mi
              securityContext:
                runAsNonRoot: true
                runAsUser: 1000
                readOnlyRootFilesystem: true
                allowPrivilegeEscalation: false
```

### Retry Policy

| Cenário                                    | Comportamento                      |
| ------------------------------------------ | ---------------------------------- |
| Job falha                                  | Retry até `backoffLimit` vezes     |
| Job ultrapassa `activeDeadlineSeconds`     | Terminado, marcado como Failed     |
| Job falha todas as tentativas              | Alerta via Prometheus AlertManager |
| Job atrasa por > `startingDeadlineSeconds` | Skip, alerta                       |

### SLA/SLO

| Métrica                   | SLO                           |
| ------------------------- | ----------------------------- |
| Success rate              | > 95% das execuções           |
| Execução dentro da janela | < 2h após schedule            |
| Falha consecutiva         | Alerta após 2 falhas seguidas |

### Risk Class: BAIXO

Falha de um job scheduled não impacta usuários diretamente. Pode gerar dados faltantes em relatórios.

---

## Classe 4: long-running-durable

### Definição

Processos de longa duração (segundos a horas) que requerem persistência de estado entre steps, compensation em caso de falha parcial, e auditabilidade completa.

### Exemplos Velya

| Processo                  | Engine   | Duração Típica | Steps           |
| ------------------------- | -------- | -------------- | --------------- |
| discharge-orchestration   | Temporal | 5-60 min       | 7 steps         |
| patient-onboarding        | Temporal | 10-30 min      | 5 steps         |
| compliance-audit-workflow | Temporal | 30-120 min     | 10+ steps       |
| market-intelligence-crawl | Temporal | 30-240 min     | 4 steps + agent |

### Node Placement

```yaml
# On-Demand para Temporal workers — não pode ser interrompido
nodeSelector:
  velya.io/workload-class: long-running-durable
  karpenter.sh/capacity-type: on-demand

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 70
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: temporal-worker
          topologyKey: kubernetes.io/hostname
```

### Scaling Policy (KEDA para Temporal Workers)

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: discharge-worker-scaler
  namespace: velya-dev-agents
spec:
  scaleTargetRef:
    name: discharge-orchestrator-worker
  minReplicaCount: 2
  maxReplicaCount: 20
  pollingInterval: 30
  cooldownPeriod: 300 # 5 min cooldown — Temporal workflows são longos
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus.velya-dev-observability.svc:9090
        metricName: temporal_workflow_pending_count
        threshold: '10' # Escalar quando > 10 workflows pendentes por worker
        query: >
          temporal_workflow_pending_count{
            namespace="velya-dev",
            task_queue="discharge-orchestration"
          }
```

### Retry Policy (Temporal)

```python
# Retry policy para atividades Temporal
STANDARD_RETRY_POLICY = RetryPolicy(
    initial_interval=timedelta(seconds=5),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(minutes=5),
    maximum_attempts=5,
    non_retryable_error_types=["InvalidPatientData", "ConsentNotGiven"]
)

EXTERNAL_DEPENDENCY_RETRY_POLICY = RetryPolicy(
    initial_interval=timedelta(seconds=30),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(minutes=30),
    maximum_attempts=10  # Dependências externas podem demorar para recuperar
)
```

### SLA/SLO

| Métrica                                         | SLO                   |
| ----------------------------------------------- | --------------------- |
| Workflow completion rate                        | > 99% (com retries)   |
| Workflow completion time P95                    | < 2x o tempo esperado |
| Compensation success rate                       | > 99.9%               |
| Workflow visibility (observável em Temporal UI) | 100%                  |

### Risk Class: ALTO (depende do processo)

**Discharge orchestration**: alto — falha impacta processo de alta hospitalar.

**PDB obrigatório para Temporal workers:**

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: temporal-worker-pdb
  namespace: velya-dev-agents
spec:
  minAvailable: 1 # Sempre pelo menos 1 worker disponível
  selector:
    matchLabels:
      app: temporal-worker
      task-queue: discharge-orchestration
```

---

## Classe 5: continuous-sentinel

### Definição

Processos que rodam continuamente para monitorar condições e reagir. Heartbeat constante, baixo consumo de recursos, alta disponibilidade.

### Exemplos Velya

| Sentinel                    | Monitora              | Ação                               | Frequência |
| --------------------------- | --------------------- | ---------------------------------- | ---------- |
| bed-availability-sentinel   | Ocupação de leitos    | Notifica quando < 10% disponível   | 30s        |
| queue-depth-sentinel        | Filas NATS            | Alerta quando crescem              | 15s        |
| sla-breach-sentinel         | SLAs de tarefas       | Escala tarefa se próximo do breach | 60s        |
| budget-sentinel             | Tokens LLM consumidos | Throttle se > 80% do budget        | 300s       |
| integration-health-sentinel | HIS/sistemas externos | Alerta se integração lenta         | 60s        |

### Node Placement

```yaml
# On-Demand — sentinel não pode parar
spec:
  replicas: 2 # Sempre 2 replicas — ativo/passivo ou ativo/ativo
  template:
    spec:
      priorityClassName: velya-realtime
      nodeSelector:
        velya.io/workload-class: continuous-sentinel
        karpenter.sh/capacity-type: on-demand
```

### Configuração de Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sla-breach-sentinel
  namespace: velya-dev-core
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0 # Zero downtime
      maxSurge: 1
  template:
    spec:
      priorityClassName: velya-realtime
      terminationGracePeriodSeconds: 60
      containers:
        - name: sentinel
          image: velya/sla-breach-sentinel:latest
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 15
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            periodSeconds: 5
          lifecycle:
            preStop:
              exec:
                command: ['/bin/sh', '-c', 'sleep 30'] # Drain antes de parar
```

### Scaling Policy

Sentinels **não usam HPA ou KEDA**. Têm replica count fixo (geralmente 2 para HA). O scaling é feito manualmente quando a carga de monitoramento cresce.

### SLA/SLO

| Métrica             | SLO                            |
| ------------------- | ------------------------------ |
| Heartbeat continuo  | 99.99% (máx 52 min de gap/ano) |
| Detection latency   | < 2x polling interval          |
| False positive rate | < 1%                           |
| Alert delivery      | < 30s após detection           |

### Risk Class: MÉDIO-ALTO

Falha de sentinel não causa impacto clínico direto, mas cega operação — problemas não serão detectados automaticamente.

---

## Classe 6: heavy-analytics-ai

### Definição

Jobs de processamento intensivo de dados ou inferência de modelos de IA. Alta demanda de CPU/GPU, longa duração, tolerante a delay de scheduling. Geralmente assíncronos.

### Exemplos Velya

| Workload                   | Recurso       | Duração    | Schedule    |
| -------------------------- | ------------- | ---------- | ----------- |
| risk-stratification-model  | CPU intensivo | 30-120 min | Noturno     |
| discharge-summary-batch    | LLM API       | 10-60 min  | Sob demanda |
| market-intelligence-agent  | LLM API + web | 1-4 horas  | Semanal     |
| readmission-model-training | GPU (futuro)  | 2-8 horas  | Mensal      |
| analytics-dbt-run          | CPU + I/O     | 15-45 min  | Diário      |

### Node Placement

```yaml
# Spot nodes de instâncias compute-optimized ou GPU
spec:
  template:
    spec:
      priorityClassName: velya-batch
      tolerations:
        - key: velya.io/heavy-analytics
          operator: Exists
          effect: NoSchedule
        - key: 'spot'
          operator: 'Equal'
          value: 'true'
          effect: 'NoSchedule'
      nodeSelector:
        velya.io/workload-class: heavy-analytics
        # Em EKS com GPU:
        # nvidia.com/gpu: "true"

      # Para jobs de LLM batch sem GPU — packing agressivo
      affinity:
        nodeAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              preference:
                matchExpressions:
                  - key: node.kubernetes.io/instance-type
                    operator: In
                    values:
                      - c6i.2xlarge
                      - c6i.4xlarge
                      - c7g.2xlarge # ARM, mais barato
```

### Scaling Policy

```yaml
# Para batch de discharge summaries
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: discharge-summary-batch-scaler
  namespace: velya-dev-agents
spec:
  scaleTargetRef:
    name: discharge-summary-batch-worker
  minReplicaCount: 0 # Pode escalar para zero!
  maxReplicaCount: 10
  pollingInterval: 60
  cooldownPeriod: 600 # 10 min cooldown após terminar
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus.velya-dev-observability.svc:9090
        metricName: velya_discharge_summary_pending
        threshold: '1'
        query: velya_discharge_summary_queue_depth
```

### Retry Policy

| Cenário              | Comportamento                                   |
| -------------------- | ----------------------------------------------- |
| LLM API timeout      | Retry com backoff exponencial (30s, 60s, 120s)  |
| LLM rate limit (429) | Retry com backoff longo (60s, 300s, 900s)       |
| Job OOM killed       | Restart com mais memória (VPA recommendation)   |
| Spot eviction        | Re-queue automático via Temporal ou re-schedule |

### Resource Budget

```yaml
# Workloads de análise pesada têm budget generoso
resources:
  requests:
    cpu: 2000m
    memory: 4Gi
  limits:
    cpu: 8000m
    memory: 16Gi
```

### SLA/SLO

| Métrica                      | SLO                            |
| ---------------------------- | ------------------------------ |
| Job completion (best effort) | > 90% em < 2x duração estimada |
| Token budget aderência       | < 80% do budget por job        |
| Job failure rate             | < 10% (tolerante — é batch)    |

### Risk Class: BAIXO

Falha de analytics job atrasa relatórios e insights, mas não impacta operação clínica em tempo real.

---

## Tabela Resumo Comparativa

| Dimensão            | realtime-request-serving | async-worker         | scheduled        | long-running-durable | continuous-sentinel   | heavy-analytics-ai      |
| ------------------- | ------------------------ | -------------------- | ---------------- | -------------------- | --------------------- | ----------------------- |
| **PriorityClass**   | velya-realtime           | velya-default        | velya-batch      | velya-default        | velya-realtime        | velya-batch/background  |
| **Capacity Type**   | On-Demand                | Spot OK              | Spot OK          | On-Demand            | On-Demand             | Spot preferido          |
| **Min Replicas**    | 3                        | 1                    | 0 (CronJob)      | 2 (workers)          | 2                     | 0                       |
| **Max Replicas**    | 30                       | 30                   | N/A (job)        | 20                   | 2                     | 10                      |
| **Scaling Trigger** | CPU + RPS                | Queue depth          | Schedule         | Temporal queue       | Fixo                  | Queue + Schedule        |
| **Scale-to-zero**   | Não                      | Não (min 1)          | N/A              | Não                  | Não                   | Sim                     |
| **Startup SLO**     | < 30s                    | < 60s                | < 120s           | < 120s               | < 60s                 | < 300s                  |
| **Tolerância Spot** | Não                      | Sim                  | Sim              | Não                  | Não                   | Sim (forte)             |
| **PDB**             | maxUnavailable 1         | preferredUnavailable | N/A              | minAvailable 1       | maxUnavailable 0      | N/A                     |
| **Risk Class**      | Alto                     | Médio                | Baixo            | Alto                 | Médio-Alto            | Baixo                   |
| **Observability**   | RED metrics              | Queue + DLQ          | Job success rate | Workflow state       | Heartbeat + detection | Job completion + tokens |

---

## Labels Obrigatórios por Classe

Todo pod/job Velya deve ter:

```yaml
labels:
  velya.io/workload-class: <classe> # Obrigatório
  velya.io/criticality: <high|medium|low> # Obrigatório
  velya.io/team: <core|platform|agents|web> # Obrigatório
  app: <nome-do-serviço> # Obrigatório
  version: <semver> # Obrigatório

annotations:
  velya.io/scaling-policy: <hpa|keda|fixed|cronjob> # Obrigatório
  velya.io/on-call: 'true|false' # Quem acorda às 3h se falhar
  velya.io/slo-latency-p99-ms: '300' # Para realtime-request-serving
  velya.io/token-budget-daily: '500000' # Para heavy-analytics-ai com LLM
```

---

## Admission Policy (Kyverno)

Kyverno garante que toda workload tem classificação:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-workload-class
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-workload-class-label
      match:
        any:
          - resources:
              kinds:
                - Pod
              namespaces:
                - velya-dev-core
                - velya-dev-agents
                - velya-dev-platform
      validate:
        message: 'Pods devem ter o label velya.io/workload-class'
        pattern:
          metadata:
            labels:
              velya.io/workload-class: '?*'
              velya.io/criticality: '?*'
```

---

## Exemplos de Classificação por Serviço

### api-gateway

```yaml
metadata:
  labels:
    velya.io/workload-class: realtime-request-serving
    velya.io/criticality: high
    velya.io/team: core
    app: api-gateway
  annotations:
    velya.io/scaling-policy: hpa
    velya.io/on-call: 'true'
    velya.io/slo-latency-p99-ms: '300'
    velya.io/slo-availability: '99.9'
```

### discharge-orchestrator-worker

```yaml
metadata:
  labels:
    velya.io/workload-class: long-running-durable
    velya.io/criticality: high
    velya.io/team: agents
    app: discharge-orchestrator-worker
  annotations:
    velya.io/scaling-policy: keda
    velya.io/on-call: 'true'
    velya.io/temporal-task-queue: discharge-orchestration
    velya.io/temporal-namespace: velya-dev
```

### cost-sweep

```yaml
metadata:
  labels:
    velya.io/workload-class: scheduled
    velya.io/criticality: low
    velya.io/team: platform
    app: cost-sweep
  annotations:
    velya.io/scaling-policy: cronjob
    velya.io/on-call: 'false'
    velya.io/schedule: '0 2 * * *'
```

---

_Classificação de workloads é revisada a cada novo serviço ou mudança significativa de comportamento de um serviço existente._
