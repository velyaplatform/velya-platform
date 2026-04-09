# Estratégia HPA + KEDA + VPA para Velya

**Versão:** 1.0  
**Domínio:** Autoscaling de Pods  
**Classificação:** Documento de Referência Técnica  
**Data:** 2026-04-08

---

## Visão Geral

A Velya usa três mecanismos complementares de autoscaling de pods:

```
HPA  ─── Horizontal Pod Autoscaler ─── Para serviços HTTP com carga previsível
KEDA ─── Kubernetes Event-driven Autoscaling ─── Para workers event-driven
VPA  ─── Vertical Pod Autoscaler ─── Para right-sizing de requests/limits
```

**Regra fundamental de não-conflito:**

- HPA e KEDA **nunca** controlam o mesmo Deployment simultaneamente
- VPA em modo `Auto` **nunca** coexiste com HPA (dimensão CPU)
- VPA em modo `Initial` pode coexistir com HPA (apenas define requests na criação)
- Goldilocks gera recomendações VPA sem aplicá-las automaticamente

---

## HPA — Horizontal Pod Autoscaler

### Quando usar HPA na Velya

| Condição                                     | HPA                           |
| -------------------------------------------- | ----------------------------- |
| Serviço serve HTTP/gRPC diretamente          | Sim                           |
| Carga é baseada em RPS ou CPU                | Sim                           |
| Scaling deve ser smooth (sem saltos bruscos) | Sim                           |
| Workload é event-driven (fila, mensagem)     | Não — usar KEDA               |
| Workload escala para zero                    | Não — HPA tem minReplicas ≥ 1 |

### Serviços Velya com HPA

| Serviço              | Namespace        | Métrica Primária       | Min | Max |
| -------------------- | ---------------- | ---------------------- | --- | --- |
| api-gateway          | velya-dev-core   | CPU 60% + RPS          | 3   | 30  |
| patient-flow-service | velya-dev-core   | CPU 60%                | 2   | 20  |
| task-inbox-service   | velya-dev-core   | CPU 60% + Latência P99 | 2   | 15  |
| velya-web            | velya-dev-web    | CPU 50%                | 2   | 10  |
| ai-gateway (sync)    | velya-dev-agents | Latência P99           | 2   | 10  |

### HPA: api-gateway (Configuração Completa)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: velya-dev-core
  labels:
    velya.io/workload-class: realtime-request-serving
    velya.io/scaler: hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway

  minReplicas: 3 # Nunca menos de 3 para HA e spreading por AZ
  maxReplicas: 30

  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30 # Subir rápido em picos
      policies:
        - type: Pods
          value: 4 # Até 4 pods por vez
          periodSeconds: 60
        - type: Percent
          value: 100 # Ou dobrar
          periodSeconds: 60
      selectPolicy: Max # Pegar o maior dos dois

    scaleDown:
      stabilizationWindowSeconds: 300 # 5 min para scale-down (evitar flapping)
      policies:
        - type: Percent
          value: 10 # Máx 10% por vez no scale-down
          periodSeconds: 60
        - type: Pods
          value: 2 # Ou máx 2 pods
          periodSeconds: 60
      selectPolicy: Min # Pegar o mais conservador

  metrics:
    # Métrica 1: CPU — trigger primário
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60 # Target 60% CPU média nos pods

    # Métrica 2: RPS via NGINX ingress (requer adapter de métricas custom)
    - type: Pods
      pods:
        metric:
          name: nginx_ingress_controller_requests_per_second
        target:
          type: AverageValue
          averageValue: '100' # 100 RPS por pod

    # Métrica 3: Memória (preventivo — não é trigger primário)
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80 # Scale apenas se memória > 80%
```

### HPA: patient-flow-service

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: patient-flow-hpa
  namespace: velya-dev-core
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: patient-flow-service

  minReplicas: 2
  maxReplicas: 20

  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 3
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120

  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
```

### HPA: task-inbox-service com Latência P99

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: task-inbox-hpa
  namespace: velya-dev-core
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: task-inbox-service

  minReplicas: 2
  maxReplicas: 15

  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
        - type: Pods
          value: 3
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60

  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60

    # Latência P99 via Prometheus Adapter (custom metric)
    - type: Object
      object:
        metric:
          name: task_inbox_latency_p99_ms
        describedObject:
          apiVersion: apps/v1
          kind: Deployment
          name: task-inbox-service
        target:
          type: Value
          value: '200' # Escalar se P99 > 200ms
```

---

## KEDA — Kubernetes Event-Driven Autoscaling

### Quando usar KEDA na Velya

| Condição                      | KEDA           |
| ----------------------------- | -------------- |
| Workload processa fila/stream | Sim            |
| Trigger é evento externo      | Sim            |
| Precisa escalar para zero     | Sim            |
| Trigger é métrica Prometheus  | Sim            |
| Workload é worker assíncrono  | Sim            |
| Serve HTTP diretamente        | Não — usar HPA |

### ScaledObject: patient-flow-worker (NATS JetStream)

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: patient-flow-worker-so
  namespace: velya-dev-core
  labels:
    velya.io/scaler: keda
    velya.io/trigger: nats-jetstream
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: patient-flow-worker

  minReplicaCount: 1 # Manter 1 ativo para latência baixa
  maxReplicaCount: 30 # Guardrail de custo
  pollingInterval: 15 # Verificar a cada 15s
  cooldownPeriod: 120 # Aguardar 2min antes de scale-down

  advanced:
    restoreToOriginalReplicaCount: false # Não voltar para 0 após scale-down
    horizontalPodAutoscalerConfig:
      behavior:
        scaleDown:
          stabilizationWindowSeconds: 180 # 3 min para scale-down
          policies:
            - type: Pods
              value: 2
              periodSeconds: 60
        scaleUp:
          stabilizationWindowSeconds: 0 # Scale-up imediato
          policies:
            - type: Pods
              value: 5
              periodSeconds: 30

  triggers:
    - type: nats-jetstream
      metadata:
        natsServerMonitoringEndpoint: 'nats-monitoring.velya-dev-platform.svc.cluster.local:8222'
        account: '$G'
        stream: velya.clinical.events
        consumer: patient-flow-routing-consumer
        lagThreshold: '50' # 1 pod por 50 msgs de lag
        activationLagThreshold: '5' # Ativar com pelo menos 5 msgs
```

### ScaledObject: discharge-orchestrator-worker (NATS + Prometheus)

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: discharge-worker-so
  namespace: velya-dev-agents
  labels:
    velya.io/scaler: keda
    velya.io/trigger: nats-queue
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: discharge-orchestrator-worker

  minReplicaCount: 2 # Alta disponibilidade para processo crítico
  maxReplicaCount: 20
  pollingInterval: 30 # Polling mais lento — workflows são longos
  cooldownPeriod: 300 # 5 min cooldown — não fazer churn em workflows longos

  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleDown:
          stabilizationWindowSeconds: 600 # 10 min para scale-down (workflows em execução)
        scaleUp:
          stabilizationWindowSeconds: 30

  triggers:
    # Trigger 1: Fila de discharge no NATS
    - type: nats-jetstream
      metadata:
        natsServerMonitoringEndpoint: 'nats-monitoring.velya-dev-platform.svc.cluster.local:8222'
        account: '$G'
        stream: velya.discharge.queue
        consumer: discharge-orchestrator-consumer
        lagThreshold: '5' # 1 worker por 5 workflows pendentes
        activationLagThreshold: '1'

    # Trigger 2: Workflows Temporal pendentes (Prometheus)
    - type: prometheus
      metadata:
        serverAddress: http://prometheus-operated.velya-dev-observability.svc:9090
        metricName: temporal_workflow_pending_discharge
        threshold: '5'
        activationThreshold: '1'
        query: >
          sum(temporal_workflow_pending_count{
            task_queue="discharge-orchestration",
            namespace="velya-dev"
          })
```

### ScaledObject: ai-gateway-async-worker (Prometheus)

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: ai-gateway-async-so
  namespace: velya-dev-agents
  labels:
    velya.io/scaler: keda
    velya.io/trigger: prometheus
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-gateway-async-worker

  minReplicaCount: 0 # Escalar para zero quando sem trabalho
  maxReplicaCount: 10 # Guardrail de custo LLM (cada worker = tokens)
  pollingInterval: 30
  cooldownPeriod: 300

  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus-operated.velya-dev-observability.svc:9090
        metricName: velya_ai_queue_depth
        threshold: '3' # 1 worker por 3 requests na fila
        activationThreshold: '1'
        query: velya_ai_requests_pending_total

    # Guardrail: Desativar scaling quando budget de tokens quase esgotado
    - type: prometheus
      metadata:
        serverAddress: http://prometheus-operated.velya-dev-observability.svc:9090
        metricName: velya_ai_token_budget_remaining_ratio
        threshold: '0.1' # Parar de escalar se < 10% do budget restante
        query: >
          velya_ai_tokens_remaining_today / velya_ai_tokens_budget_daily
```

### ScaledObject: Notification Worker com HTTP Trigger

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: notification-worker-so
  namespace: velya-dev-core
spec:
  scaleTargetRef:
    name: notification-worker

  minReplicaCount: 1
  maxReplicaCount: 20
  pollingInterval: 15
  cooldownPeriod: 60

  triggers:
    - type: nats-jetstream
      metadata:
        natsServerMonitoringEndpoint: 'nats-monitoring.velya-dev-platform.svc.cluster.local:8222'
        account: '$G'
        stream: velya.tasks.notifications
        consumer: notification-consumer
        lagThreshold: '100'
        activationLagThreshold: '10'
```

### ScaledJob: Para Jobs de Processamento Único

```yaml
# ScaledJob — para jobs que escalam para zero e criam um Job por request
apiVersion: keda.sh/v1alpha1
kind: ScaledJob
metadata:
  name: report-generator-scaledjob
  namespace: velya-dev-platform
spec:
  jobTargetRef:
    parallelism: 1
    completions: 1
    activeDeadlineSeconds: 3600
    backoffLimit: 2
    template:
      spec:
        priorityClassName: velya-batch
        restartPolicy: OnFailure
        containers:
          - name: report-generator
            image: velya/report-generator:latest
            resources:
              requests:
                cpu: 500m
                memory: 512Mi
              limits:
                cpu: 2000m
                memory: 2Gi

  pollingInterval: 30
  maxReplicaCount: 5

  triggers:
    - type: nats-jetstream
      metadata:
        natsServerMonitoringEndpoint: 'nats-monitoring.velya-dev-platform.svc.cluster.local:8222'
        account: '$G'
        stream: velya.reports.queue
        consumer: report-generator-consumer
        lagThreshold: '1' # 1 Job por 1 report na fila
```

---

## VPA — Vertical Pod Autoscaler

### Quando usar VPA na Velya

| Uso                     | Modo               | Workloads                      |
| ----------------------- | ------------------ | ------------------------------ |
| Right-sizing inicial    | `Initial`          | Todos os serviços novos        |
| Recomendações contínuas | `Off` (Goldilocks) | Todos os serviços em prod      |
| Ajuste automático       | `Auto`             | CronJobs, jobs batch (não HPA) |
| Coexistência com HPA    | `Initial`          | Permite HPA controlar replicas |

### Modos VPA

```
VPA Off       ──── Apenas registra recomendações, não aplica nada
VPA Initial   ──── Aplica recomendações apenas em pods novos (durante scale-up ou restart)
VPA Auto      ──── Aplica recomendações e pode restartar pods para aplicar
```

**Regra crítica:** VPA `Auto` **nunca** é usado em serviços com HPA controlando CPU — causaria loop infinito de decisions conflitantes.

### VPA: api-gateway (modo Initial — coexiste com HPA)

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-gateway-vpa
  namespace: velya-dev-core
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway

  updatePolicy:
    updateMode: 'Initial' # Aplica apenas em pods novos

  resourcePolicy:
    containerPolicies:
      - containerName: api-gateway
        minAllowed:
          cpu: 100m
          memory: 128Mi
        maxAllowed:
          cpu: 2000m
          memory: 1Gi
        controlledResources: ['memory'] # VPA controla apenas memória (CPU é do HPA)
        controlledValues: RequestsAndLimits
```

### VPA: discharge-orchestrator-worker (modo Auto — sem HPA)

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: discharge-worker-vpa
  namespace: velya-dev-agents
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: discharge-orchestrator-worker

  updatePolicy:
    updateMode: 'Auto' # Aplica recomendações e pode restartar
    minReplicas: 2 # VPA nunca reduz abaixo de 2 replicas para aplicar

  resourcePolicy:
    containerPolicies:
      - containerName: discharge-worker
        minAllowed:
          cpu: 100m
          memory: 256Mi
        maxAllowed:
          cpu: 4000m
          memory: 8Gi
        controlledResources: ['cpu', 'memory']
        controlledValues: RequestsAndLimits
```

### VPA: CronJob cost-sweep (modo Auto)

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: cost-sweep-vpa
  namespace: velya-dev-platform
spec:
  targetRef:
    apiVersion: batch/v1
    kind: CronJob
    name: cost-sweep

  updatePolicy:
    updateMode: 'Auto'

  resourcePolicy:
    containerPolicies:
      - containerName: cost-sweep
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: 1000m
          memory: 512Mi
```

---

## Goldilocks — Recomendações VPA sem Impacto

Goldilocks instala VPA em modo `Off` em todos os namespaces e expõe recomendações em dashboard.

### Instalação

```bash
# Adicionar repo Fairwinds
helm repo add fairwinds-stable https://charts.fairwinds.com/stable
helm repo update

# Instalar Goldilocks
helm install goldilocks fairwinds-stable/goldilocks \
  --namespace velya-dev-observability \
  --set dashboard.enabled=true \
  --set dashboard.service.type=ClusterIP \
  --set vpa.enabled=true

# Ativar para namespaces Velya
kubectl label namespace velya-dev-core goldilocks.fairwinds.com/enabled=true
kubectl label namespace velya-dev-agents goldilocks.fairwinds.com/enabled=true
kubectl label namespace velya-dev-platform goldilocks.fairwinds.com/enabled=true
```

### Leitura de Recomendações

```bash
# Via port-forward
kubectl port-forward -n velya-dev-observability service/goldilocks-dashboard 8080:80

# Via kubectl (direto nos objetos VPA)
kubectl get vpa -n velya-dev-core -o json | jq '.items[].status.recommendation.containerRecommendations'
```

---

## Regras de Não-Conflito

### Matriz de Compatibilidade

| Combinação                               | Compatível | Notas                                              |
| ---------------------------------------- | ---------- | -------------------------------------------------- |
| HPA (CPU) + VPA (Auto CPU)               | NÃO        | Loop de decisões conflitantes                      |
| HPA (CPU) + VPA (Initial, apenas memory) | SIM        | VPA controla memory, HPA controla CPU/replicas     |
| HPA (CPU) + VPA (Off)                    | SIM        | VPA apenas recomenda                               |
| KEDA + VPA (Auto)                        | SIM        | KEDA controla replicas, VPA controla resources     |
| KEDA + HPA                               | NÃO        | Dois controladores de replicas no mesmo Deployment |
| HPA + KEDA (em Deployments diferentes)   | SIM        | Diferentes targets                                 |

### Verificação de Conflitos

```bash
# Script de verificação de conflitos em velya-dev-*
for ns in velya-dev-core velya-dev-agents velya-dev-platform; do
  echo "=== Namespace: $ns ==="

  # HPAs ativos
  echo "HPAs:"
  kubectl get hpa -n $ns -o jsonpath='{.items[*].spec.scaleTargetRef.name}' | tr ' ' '\n'

  # KEDA ScaledObjects ativos
  echo "KEDA ScaledObjects:"
  kubectl get scaledobject -n $ns -o jsonpath='{.items[*].spec.scaleTargetRef.name}' | tr ' ' '\n'

  # VPA com modo Auto
  echo "VPA Auto:"
  kubectl get vpa -n $ns -o json | jq -r '.items[] | select(.spec.updatePolicy.updateMode == "Auto") | .metadata.name'
done
```

---

## Procedimento de Configuração de Novo Scaler

### Passo 1: Classificar o workload

```bash
# Verificar a classe do workload
kubectl get deployment <nome> -n <namespace> -o jsonpath='{.metadata.labels.velya\.io/workload-class}'
```

### Passo 2: Escolher o scaler correto

```
realtime-request-serving → HPA
async-worker             → KEDA (NATS ou Prometheus)
scheduled                → Nenhum (CronJob schedule é o trigger)
long-running-durable     → KEDA (Temporal queue via Prometheus)
continuous-sentinel      → Fixo (replicas=2)
heavy-analytics-ai       → KEDA (Prometheus ou ScaledJob)
```

### Passo 3: Verificar métricas disponíveis

```bash
# Verificar métricas custom disponíveis para HPA
kubectl get apiservice v1beta1.custom.metrics.k8s.io

# Verificar métricas Prometheus disponíveis para KEDA
kubectl port-forward -n velya-dev-observability prometheus-operated-0 9090:9090
# Depois testar a query em localhost:9090
```

### Passo 4: Aplicar e validar

```bash
# Aplicar o scaler
kubectl apply -f scaler-config.yaml

# Monitorar eventos de scaling
kubectl describe hpa <nome> -n <namespace>
# ou
kubectl describe scaledobject <nome> -n <namespace>

# Verificar logs do KEDA operator
kubectl logs -n keda deployment/keda-operator -f | grep <deployment-name>
```

---

## Alertas de Autoscaling

```yaml
# PrometheusRule para alertas de autoscaling
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-autoscaling-alerts
  namespace: velya-dev-observability
spec:
  groups:
    - name: autoscaling
      rules:
        - alert: HPAAtMaxReplicas
          expr: |
            kube_horizontalpodautoscaler_status_current_replicas ==
            kube_horizontalpodautoscaler_spec_max_replicas
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: 'HPA {{ $labels.namespace }}/{{ $labels.horizontalpodautoscaler }} no máximo'
            description: 'HPA atingiu maxReplicas por 10min — considerar aumentar o limite'

        - alert: HPAFlapping
          expr: |
            changes(kube_horizontalpodautoscaler_status_current_replicas[30m]) > 8
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: 'HPA {{ $labels.namespace }}/{{ $labels.horizontalpodautoscaler }} com scale churn'
            description: 'Mais de 8 mudanças de replica em 30 minutos — possível flapping'

        - alert: KEDAScalerError
          expr: keda_scaler_errors_total > 0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: 'KEDA scaler com erros: {{ $labels.scaler }}'

        - alert: KEDAScaledObjectAtMax
          expr: |
            keda_scaler_metrics_value / on(scaledObject)
            keda_scaled_object_spec_max_replica_count >= 0.9
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: 'KEDA ScaledObject {{ $labels.scaledObject }} próximo do máximo'

        - alert: VPARecommendationNotApplied
          expr: |
            (vpa_status_recommendation_containerrecommendations_target{resource="cpu"} /
            on(namespace, pod, container) kube_pod_container_resource_requests{resource="cpu"}) > 2
          for: 1h
          labels:
            severity: info
          annotations:
            summary: 'VPA recomenda 2x mais CPU para {{ $labels.container }}'
            description: 'Considerar atualizar requests no Deployment'
```

---

## Métricas de Saúde do Sistema de Autoscaling

### Dashboard Grafana — Autoscaling Health

| Panel                | Query                                                            | Threshold            |
| -------------------- | ---------------------------------------------------------------- | -------------------- |
| HPA current replicas | `kube_horizontalpodautoscaler_status_current_replicas`           | —                    |
| HPA at max %         | `hpa_current/hpa_max * 100`                                      | Alerta > 90%         |
| KEDA scaler lag      | `keda_scaler_metrics_value`                                      | Dependente do scaler |
| Scale events rate    | `rate(kube_horizontalpodautoscaler_status_current_replicas[5m])` | —                    |
| VPA recommendations  | `vpa_status_recommendation_containerrecommendations_target`      | —                    |
| Scale-to-zero count  | `keda_scaled_object_paused == 0`                                 | —                    |

---

## Configuração em kind-velya-local (Atual)

No ambiente local, os scalers estão configurados mas com recursos limitados:

```bash
# Verificar KEDA instalado
kubectl get pods -n keda

# Verificar que não há ScaledObjects ainda (estado atual)
kubectl get scaledobject -A

# Verificar que não há HPAs ativos ainda (estado atual)
kubectl get hpa -A

# Próximos passos para ativar:
# 1. Criar HPA para api-gateway
# 2. Criar KEDA ScaledObject para patient-flow-worker
# 3. Instalar VPA + Goldilocks
# 4. Instalar prometheus-adapter para métricas custom no HPA
```

---

_Este documento é atualizado sempre que um novo serviço recebe configuração de autoscaling._
