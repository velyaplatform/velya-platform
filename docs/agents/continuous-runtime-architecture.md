# Arquitetura de Runtime Contínuo — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Namespaces relevantes:** velya-dev-agents, velya-dev-platform, velya-dev-observability  
**Última revisão:** 2026-04-08  

---

## 1. Visão Geral da Arquitetura

A Velya executa workloads contínuos, periódicos e event-driven em uma arquitetura composta de cinco camadas tecnológicas complementares. Cada camada tem responsabilidade clara e não-sobreponível com as demais:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VELYA RUNTIME CONTÍNUO                           │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────┤
│   TEMPORAL   │  K8S CRON    │    ARGO      │    KEDA      │  NATS   │
│              │   JOBS       │  CRON WF     │              │JETSTREAM│
├──────────────┼──────────────┼──────────────┼──────────────┼─────────┤
│ Workflows    │ Rotinas      │ Pipelines    │ Event-driven │ Message │
│ duráveis     │ simples      │ complexos    │ scaling      │ backbone│
│ com state    │ sem state    │ com DAG      │ por lag      │ + DLQ   │
├──────────────┴──────────────┴──────────────┴──────────────┴─────────┤
│                    KUBERNETES (kind-velya-local)                     │
│          Namespaces: agents | platform | observability | web         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Temporal: Workflows Duráveis

### 2.1 Responsabilidade no Ecossistema Velya

O Temporal gerencia workflows que precisam de:
- **Durabilidade:** Sobrevivem a crashes de pods, reinicializações de cluster
- **Estado longo:** Processos que duram minutos a horas (ex: processo de alta)
- **Coordenação:** Múltiplas Activities com dependências e compensações
- **Retry granular:** Retry configurável por Activity, não por workflow inteiro

### 2.2 Topologia no Cluster

```
Namespace: velya-dev-platform
├── temporal-server (StatefulSet, 1 réplica no kind local)
│   └── Porta 7233 (gRPC), 8233 (Web UI)
├── temporal-worker-clinical (Deployment, 2 réplicas)
│   └── Task queue: clinical-operations
├── temporal-worker-platform (Deployment, 2 réplicas)
│   └── Task queue: platform-ops
└── temporal-postgres (StatefulSet, PVC 10Gi)
    └── Banco de persistência de workflow state
```

### 2.3 Workflows Ativos na Velya

#### Discharge Workflow
```go
package clinical

import (
    "go.temporal.io/sdk/workflow"
    "time"
)

// DischargeWorkflow orquestra o processo completo de alta hospitalar.
// Durabilidade garante que nenhuma etapa seja perdida mesmo em falha de infraestrutura.
func DischargeWorkflow(ctx workflow.Context, req DischargeRequest) (*DischargeResult, error) {
    logger := workflow.GetLogger(ctx)
    logger.Info("Iniciando discharge workflow", "patientID", req.PatientID)

    activityOpts := workflow.ActivityOptions{
        StartToCloseTimeout: 10 * time.Minute,
        RetryPolicy: &temporal.RetryPolicy{
            MaximumAttempts:        3,
            InitialInterval:        30 * time.Second,
            BackoffCoefficient:     2.0,
            MaximumInterval:        5 * time.Minute,
            NonRetryableErrorTypes: []string{"ValidationError", "PatientNotFound"},
        },
    }
    ctx = workflow.WithActivityOptions(ctx, activityOpts)

    // Etapa 1: Validar prescrição de alta
    var prescriptionOK bool
    if err := workflow.ExecuteActivity(ctx, ValidateDischarePrescription, req.PatientID).Get(ctx, &prescriptionOK); err != nil {
        return nil, fmt.Errorf("falha na validação da prescrição: %w", err)
    }
    if !prescriptionOK {
        // Escalar para revisão médica — não falhar o workflow
        if err := workflow.ExecuteActivity(ctx, EscalatePrescriptionReview, req.PatientID).Get(ctx, nil); err != nil {
            return nil, err
        }
        // Aguardar sinal de aprovação médica (até 2 horas)
        medicalApproval := workflow.NewChannel(ctx)
        workflow.Go(ctx, func(ctx workflow.Context) {
            workflow.GetSignalChannel(ctx, "medical-approval").Receive(ctx, &medicalApproval)
        })
        // ... aguardar sinal
    }

    // Etapa 2: Notificar enfermagem
    if err := workflow.ExecuteActivity(ctx, NotifyNursingTeam, req.PatientID).Get(ctx, nil); err != nil {
        return nil, err
    }

    // Etapa 3: Confirmar transporte (paralelo com orientações)
    transportFuture := workflow.ExecuteActivity(ctx, ConfirmTransport, req)
    orientationFuture := workflow.ExecuteActivity(ctx, PrepareDischargeInstructions, req.PatientID)

    var transport TransportResult
    if err := transportFuture.Get(ctx, &transport); err != nil {
        return nil, err
    }
    if err := orientationFuture.Get(ctx, nil); err != nil {
        return nil, err
    }

    // Etapa 4: Registrar alta no HIS
    if err := workflow.ExecuteActivity(ctx, RegisterDischargeInHIS, req.PatientID, transport).Get(ctx, nil); err != nil {
        return nil, err
    }

    // Etapa 5: Liberar leito
    if err := workflow.ExecuteActivity(ctx, ReleaseBed, req.PatientID).Get(ctx, nil); err != nil {
        return nil, err
    }

    return &DischargeResult{
        PatientID:       req.PatientID,
        DischargeTime:   workflow.Now(ctx),
        TransportMode:   transport.Mode,
        DocumentsOK:     true,
    }, nil
}
```

#### Patient Flow Routing Workflow
```go
func PatientFlowWorkflow(ctx workflow.Context, req TransferRequest) error {
    // Verificação rápida de regras determinísticas
    available, err := workflow.ExecuteActivity(ctx, CheckBedAvailability, req).Get(ctx, nil)
    if err != nil { return err }
    
    if available {
        // Path feliz: 80% dos casos
        return workflow.ExecuteActivity(ctx, ExecuteTransfer, req).Get(ctx, nil)
    }
    
    // Path complexo: chamar agent para encontrar alternativa
    var agentProposal TransferProposal
    if err := workflow.ExecuteActivity(ctx, InvokePatientFlowAgent, req).Get(ctx, &agentProposal); err != nil {
        return err
    }
    
    if agentProposal.RequiresHumanApproval {
        // Aguardar aprovação via sinal (timeout: 30 min)
        // ...
    }
    
    return workflow.ExecuteActivity(ctx, ExecuteTransfer, agentProposal.TransferRequest).Get(ctx, nil)
}
```

### 2.4 Temporal Schedules (Cron com Estado)

Para rotinas que precisam de estado persistente ou lógica complexa, usar Temporal Schedules ao invés de CronJob K8s:

```bash
# Criar schedule para audit diário com backfill
temporal schedule create \
  --schedule-id daily-audit-schedule \
  --cron "0 2 * * *" \
  --workflow-id daily-audit-run \
  --workflow-type DailyAuditWorkflow \
  --task-queue platform-ops \
  --overlap-policy Skip \
  --namespace velya
```

---

## 3. Kubernetes CronJobs: Rotinas Simples

### 3.1 Responsabilidade

CronJobs Kubernetes são usados para rotinas que:
- **Não precisam de estado persistente** entre execuções
- **São idempotentes** e seguras para re-execução
- **Têm lógica simples** que não justifica overhead do Temporal
- **Toleram falha** sem necessidade de replay automático complexo

### 3.2 Jobs Configurados no Cluster

```yaml
# Heartbeat sweep — a cada 5 minutos
apiVersion: batch/v1
kind: CronJob
metadata:
  name: heartbeat-sweep
  namespace: velya-dev-agents
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      activeDeadlineSeconds: 240
      backoffLimit: 1
      template:
        spec:
          restartPolicy: Never
          serviceAccountName: heartbeat-sweep-sa
          containers:
            - name: heartbeat-checker
              image: velya/heartbeat-checker:1.2.0
              env:
                - name: NATS_URL
                  valueFrom:
                    secretKeyRef:
                      name: nats-credentials
                      key: url
                - name: PROMETHEUS_URL
                  value: "http://prometheus.velya-dev-observability.svc.cluster.local:9090"
                - name: STALE_THRESHOLD_SECONDS
                  value: "180"
              resources:
                requests:
                  cpu: 50m
                  memory: 64Mi
                limits:
                  cpu: 200m
                  memory: 128Mi
---
# Cost sweep — a cada 6 horas
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cost-sweep
  namespace: velya-dev-agents
spec:
  schedule: "0 */6 * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      activeDeadlineSeconds: 3600
      backoffLimit: 2
      template:
        spec:
          restartPolicy: Never
          serviceAccountName: cost-sweep-sa
          containers:
            - name: cost-analyzer
              image: velya/cost-analyzer:1.0.5
              env:
                - name: PROMETHEUS_URL
                  value: "http://prometheus.velya-dev-observability.svc.cluster.local:9090"
                - name: BUDGET_CONFIG_MAP
                  value: "cost-budgets"
                - name: ALERT_THRESHOLD_PERCENT
                  value: "80"
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 500m
                  memory: 256Mi
---
# Daily report — 2h UTC
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-report
  namespace: velya-dev-agents
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      activeDeadlineSeconds: 7200
      backoffLimit: 2
      template:
        spec:
          restartPolicy: Never
          serviceAccountName: reporting-sa
          containers:
            - name: report-generator
              image: velya/report-generator:2.1.0
              env:
                - name: LOKI_URL
                  value: "http://loki.velya-dev-observability.svc.cluster.local:3100"
                - name: REPORT_OUTPUT_QUEUE
                  value: "velya.reports.daily"
              resources:
                requests:
                  cpu: 200m
                  memory: 256Mi
                limits:
                  cpu: 1000m
                  memory: 512Mi
---
# Market intelligence sweep — segunda-feira 3h UTC
apiVersion: batch/v1
kind: CronJob
metadata:
  name: market-intelligence-sweep
  namespace: velya-dev-agents
spec:
  schedule: "0 3 * * 1"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 4
  failedJobsHistoryLimit: 4
  jobTemplate:
    spec:
      activeDeadlineSeconds: 14400
      backoffLimit: 1
      template:
        spec:
          restartPolicy: Never
          serviceAccountName: market-intel-sa
          containers:
            - name: market-intel
              image: velya/market-intel:1.0.0
              envFrom:
                - configMapRef:
                    name: market-intel-config
                - secretRef:
                    name: market-intel-credentials
              resources:
                requests:
                  cpu: 200m
                  memory: 512Mi
                limits:
                  cpu: 1000m
                  memory: 1Gi
```

### 3.3 Monitoramento de CronJobs

```yaml
# PrometheusRule para CronJobs falhando
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cronjob-health
  namespace: velya-dev-observability
spec:
  groups:
    - name: cronjob.alerts
      interval: 1m
      rules:
        - alert: CronJobFailed
          expr: |
            kube_job_status_failed{namespace="velya-dev-agents"} > 0
          for: 5m
          labels:
            severity: warning
            team: platform-health
          annotations:
            summary: "CronJob falhou no namespace velya-dev-agents"
            description: "Job {{ $labels.job_name }} falhou {{ $value }} vezes."
        
        - alert: CronJobNotScheduled
          expr: |
            time() - kube_cronjob_next_schedule_time{namespace="velya-dev-agents"} > 3600
          for: 10m
          labels:
            severity: critical
          annotations:
            summary: "CronJob não executou no tempo esperado"
```

---

## 4. KEDA: Event-Driven Scaling

### 4.1 Responsabilidade

O KEDA escala automaticamente os deployments de workers com base no lag de mensagens nas filas NATS JetStream. Sem KEDA, os workers teriam recursos provisionados para o pico de demanda mesmo durante períodos de baixa carga.

**Status atual no cluster:** KEDA instalado no namespace `keda`. ScaledObjects ainda não configurados (a implementar quando NATS JetStream estiver em produção).

### 4.2 Configuração Alvo (quando NATS estiver operacional)

```yaml
# ScaledObject para task-inbox-worker
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: task-inbox-worker-scaler
  namespace: velya-dev-agents
  labels:
    velya.io/office: clinical-operations
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: task-inbox-worker
  pollingInterval: 15       # Verificar lag a cada 15 segundos
  cooldownPeriod: 120       # Aguardar 120s antes de scale down
  minReplicaCount: 1        # Sempre manter pelo menos 1 réplica
  maxReplicaCount: 8        # Máximo 8 réplicas (limite de quota)
  fallback:
    failureThreshold: 3
    replicas: 2             # Em caso de falha do KEDA, manter 2 réplicas
  triggers:
    - type: nats-jetstream
      metadata:
        natsServerMonitoringEndpoint: "nats-monitor.velya-dev-platform.svc.cluster.local:8222"
        account: "$G"
        stream: VELYA_AGENTS
        consumer: task-inbox-worker-consumer
        lagThreshold: "5"   # 1 réplica extra por cada 5 mensagens de lag
      authenticationRef:
        name: nats-trigger-auth
---
# ScaledObject para discharge-worker
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: discharge-worker-scaler
  namespace: velya-dev-agents
spec:
  scaleTargetRef:
    name: discharge-worker
  minReplicaCount: 2        # Alta hospitalar: mínimo 2 réplicas sempre
  maxReplicaCount: 6
  cooldownPeriod: 300       # Processo de alta: cooldown maior
  triggers:
    - type: nats-jetstream
      metadata:
        stream: VELYA_AGENTS
        consumer: discharge-worker-consumer
        lagThreshold: "3"   # Mais agressivo — alta é crítica
---
# ScaledObject para validation-worker (CPU-based, não NATS)
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: validation-worker-scaler
  namespace: velya-dev-agents
spec:
  scaleTargetRef:
    name: validation-worker
  minReplicaCount: 1
  maxReplicaCount: 4
  triggers:
    - type: prometheus
      metadata:
        serverAddress: "http://prometheus.velya-dev-observability.svc.cluster.local:9090"
        metricName: velya_validation_queue_depth
        query: |
          sum(velya_agent_queue_lag{agent="validation-worker"})
        threshold: "10"
```

### 4.3 TriggerAuthentication para NATS

```yaml
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: nats-trigger-auth
  namespace: velya-dev-agents
spec:
  secretTargetRef:
    - parameter: natsServerMonitoringEndpoint
      name: nats-credentials
      key: monitoring-endpoint
```

### 4.4 Comportamento de Scaling

```
Lag de mensagens na fila NATS
           │
           ▼
    0-4 mensagens → 1 réplica (mínimo)
    5-9 mensagens → 2 réplicas
    10-14 mensagens → 3 réplicas
    15-19 mensagens → 4 réplicas
    ...
    35+ mensagens → 8 réplicas (máximo)
           │
           ▼
    Após processar e lag = 0:
    Aguardar cooldownPeriod (120s)
           │
           ▼
    Scale down para minReplicaCount
```

---

## 5. NATS JetStream: Message Backbone

### 5.1 Responsabilidade

NATS JetStream é o sistema de mensageria que conecta todos os componentes da Velya:
- Agents publicam e consomem mensagens
- Workflows disparam eventos para filas
- CronJobs publicam resultados
- DLQs armazenam mensagens com falha

**Status atual:** A implementar. NATS JetStream será instalado no namespace `velya-dev-platform`.

### 5.2 Topologia de Subjects

```
velya.
├── agents.
│   ├── clinical-ops.
│   │   ├── task-classification    # Novos itens para classificar
│   │   ├── discharge-trigger      # Início de processo de alta
│   │   └── patient-flow-update    # Atualizações de fluxo
│   ├── platform.
│   │   ├── health-check           # Eventos de saúde de serviços
│   │   └── resource-alert         # Alertas de recursos K8s
│   ├── governance.
│   │   ├── audit-required         # Outputs aguardando auditoria
│   │   └── validation-required    # Outputs aguardando validação
│   ├── handoff.
│   │   └── {source-agent}.{target-agent}  # Handoffs entre agents
│   └── dlq.
│       ├── tool-schema-violation  # Outputs de tool com schema inválido
│       ├── validation-failed      # Falhas de validação
│       ├── max-retries-exceeded   # Retries esgotados
│       └── no-owner               # Mensagens sem owner definido
├── events.
│   ├── patient.admitted           # Admissão de paciente
│   ├── patient.discharged         # Alta de paciente
│   └── patient.transferred        # Transferência de setor
├── reports.
│   ├── daily                      # Relatórios diários
│   ├── hourly                     # Relatórios horários
│   └── weekly                     # Relatórios semanais
├── intelligence.
│   └── weekly-report              # Relatório de market intelligence
└── audit.
    └── {agent-name}.{task-id}     # Eventos de auditoria por agent
```

### 5.3 Configuração JetStream

```yaml
# Stream principal de agents
nats:
  jetstream:
    streams:
      - name: VELYA_AGENTS
        subjects:
          - "velya.agents.>"
        storage: file
        retention: limits
        max_age: 72h          # 3 dias de retenção
        max_msgs: 1000000
        max_bytes: 10737418240  # 10 GiB
        replicas: 1            # kind local: 1 réplica
        discard: old
        
      - name: VELYA_DLQ
        subjects:
          - "velya.agents.dlq.>"
        storage: file
        retention: limits
        max_age: 720h          # 30 dias de retenção na DLQ
        max_msgs: 100000
        max_bytes: 1073741824  # 1 GiB
        replicas: 1
        
      - name: VELYA_EVENTS
        subjects:
          - "velya.events.>"
        storage: file
        retention: limits
        max_age: 24h
        max_msgs: 500000
        max_bytes: 5368709120  # 5 GiB
        replicas: 1
        
      - name: VELYA_AUDIT
        subjects:
          - "velya.audit.>"
        storage: file
        retention: limits
        max_age: 8760h         # 1 ano de retenção de audit
        max_msgs: 10000000
        max_bytes: 107374182400  # 100 GiB
        replicas: 1
```

### 5.4 Configuração de Consumers

```yaml
# Consumer para task-inbox-worker
consumers:
  - stream: VELYA_AGENTS
    name: task-inbox-worker-consumer
    durable: task-inbox-worker-consumer
    filter_subject: "velya.agents.clinical-ops.task-classification"
    ack_policy: explicit
    ack_wait: 300s          # 5 minutos para processar e dar ack
    max_deliver: 5          # Máximo 5 tentativas antes de DLQ
    deliver_policy: all
    replay_policy: instant
    max_ack_pending: 10     # Máximo 10 mensagens em processamento simultâneo

  - stream: VELYA_AGENTS
    name: discharge-worker-consumer
    durable: discharge-worker-consumer
    filter_subject: "velya.agents.clinical-ops.discharge-trigger"
    ack_policy: explicit
    ack_wait: 600s          # 10 minutos (alta pode ser demorada)
    max_deliver: 3
    deliver_policy: all
    max_ack_pending: 5      # Máximo 5 altas simultâneas
```

---

## 6. Diagrama de Fluxo Completo

```
EVENTO EXTERNO (paciente admitido, tarefa criada, etc.)
         │
         ▼
   NATS JetStream
   velya.events.patient.admitted
         │
         ├─────────────────────────────────┐
         ▼                                 ▼
  Patient Flow Workflow              Task Inbox Worker
  (Temporal)                         (KEDA-scaled)
         │                                 │
         ├── CheckBedAvailability          ├── Classify urgency (LLM)
         ├── AllocateBed                   ├── Validate output
         ├── NotifyNursingTeam             ├── Publish classification
         └── StartDischargeMonitor         └── Ack message
                   │                                │
                   ▼                                ▼
           velya.events.patient.           velya.agents.clinical-ops.
           transferred                     task-classification.result
                   │                                │
                   ▼                                ▼
         Discharge Orchestrator            Governance Agent
         (Temporal Workflow)               (audit required?)
                   │                                │
         ┌─────────┴──────────┐                    ▼
         ▼                    ▼              velya.audit.
   ValidatePrescription  NotifyTransport     task-inbox.{id}
         │                    │
         └─────────┬──────────┘
                   ▼
           RegisterInHIS
                   │
                   ▼
           ReleaseBed
                   │
                   ▼
         velya.events.patient.
         discharged
                   │
                   ├── Daily Report Batch (agrega)
                   ├── Cost Governance (registra)
                   └── Learning Loop (aprende com padrões)
```

---

## 7. Resiliência e Recuperação

### 7.1 Falha do Pod de Worker

```
Worker pod falha durante processamento
         │
         ▼
Mensagem NATS não recebe ack
         │
         ▼ (após ack_wait expira)
NATS reentrega mensagem (max_deliver - 1 tentativas restantes)
         │
         ▼
KEDA detecta lag na fila → sobe nova réplica
         │
         ▼
Nova réplica consome e processa a mensagem
```

### 7.2 Falha do Temporal Worker

```
Temporal worker pod falha durante workflow
         │
         ▼
Temporal persiste estado em PostgreSQL
         │
         ▼
Activity em andamento: retorna para fila de tasks do Temporal
         │
         ▼
Novo Temporal worker assume a partir do último checkpoint
```

### 7.3 Falha do NATS JetStream

```
NATS JetStream fica indisponível
         │
         ▼
Workers param de consumir (health check falha)
Workers tentam reconectar com backoff exponencial
         │
         ▼
Workflows Temporal que dependem de NATS: ativam circuit breaker
Novas mensagens: acumulam em fila de retry do publisher
         │
         ▼ (quando NATS recupera)
Mensagens acumuladas são publicadas
Workers retomam consumo normalmente
```

### 7.4 Comportamento do KEDA em Falha de NATS

```yaml
# Fallback configurado: se NATS monitor fica inacessível,
# KEDA mantém o número de réplicas do último estado conhecido
fallback:
  failureThreshold: 3      # 3 falhas consecutivas de polling
  replicas: 2              # Manter 2 réplicas em modo fallback
```

---

## 8. Configuração de Namespace e Resources

### 8.1 LimitRange para namespace velya-dev-agents

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: agents-limits
  namespace: velya-dev-agents
spec:
  limits:
    - type: Container
      default:
        cpu: 200m
        memory: 256Mi
      defaultRequest:
        cpu: 50m
        memory: 64Mi
      max:
        cpu: "2"
        memory: 2Gi
      min:
        cpu: 25m
        memory: 32Mi
    - type: Pod
      max:
        cpu: "4"
        memory: 4Gi
```

### 8.2 ResourceQuota por Namespace

```yaml
# velya-dev-agents
apiVersion: v1
kind: ResourceQuota
metadata:
  name: agents-quota
  namespace: velya-dev-agents
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "16"
    limits.memory: 16Gi
    count/pods: "50"
    count/cronjobs.batch: "20"
    count/jobs.batch: "30"
    count/deployments.apps: "20"
```

---

## 9. Observabilidade do Runtime

### 9.1 Métricas de Runtime Expostas

| Métrica | Tipo | Descrição |
|---|---|---|
| `velya_runtime_active_workflows` | Gauge | Workflows Temporal ativos |
| `velya_runtime_active_workers` | Gauge | Workers KEDA em execução |
| `velya_runtime_queue_depth` | Gauge | Mensagens pendentes por fila NATS |
| `velya_runtime_dlq_size` | Gauge | Mensagens em DLQ por tipo |
| `velya_runtime_cronjob_last_success` | Gauge | Timestamp do último sucesso por CronJob |
| `velya_runtime_keda_replicas` | Gauge | Réplicas atuais por ScaledObject |
| `velya_runtime_temporal_task_queue_lag` | Gauge | Lag de task queue Temporal |

### 9.2 Alertas Críticos de Runtime

```yaml
- alert: TemporalWorkerDown
  expr: velya_runtime_active_workers{queue="clinical-operations"} == 0
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Nenhum Temporal worker ativo para clinical-operations"

- alert: NATSQueueBuildup
  expr: velya_runtime_queue_depth > 100
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Fila NATS com >100 mensagens por 5 minutos"

- alert: DLQGrowing
  expr: rate(velya_runtime_dlq_size[10m]) > 1
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "DLQ crescendo: mais de 1 mensagem/min entrando na fila morta"
```
