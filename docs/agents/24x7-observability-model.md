# Modelo de Observabilidade 24/7 — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Namespace:** velya-dev-observability  
**Stack:** Prometheus + Grafana + Loki + Tempo  
**Última revisão:** 2026-04-08

---

## 1. Princípios de Observabilidade

A observabilidade da Velya é organizada em três camadas:

1. **Por Agent:** Métricas específicas de comportamento e qualidade de cada agent
2. **Por Office:** Métricas agregadas de saúde e desempenho de cada office
3. **Por Cluster:** Métricas de infraestrutura, recursos e custo

O objetivo é que qualquer anomalia seja detectável em menos de 2 minutos para incidentes críticos e 10 minutos para anomalias não-críticas.

---

## 2. Métricas por Agent

### 2.1 Heartbeat Freshness

Detecta agents silenciosos ou com heartbeat atrasado.

```promql
# Segundos desde o último heartbeat (por agent)
time() - velya_agent_heartbeat_timestamp{job="velya-agents"}

# Agents com heartbeat > 3 minutos atrás (crítico)
(time() - velya_agent_heartbeat_timestamp) > 180

# Heartbeat freshness ratio (1.0 = fresh, < 1.0 = degradado)
1 - clamp_max((time() - velya_agent_heartbeat_timestamp) / 300, 1)
```

**Alertas:**

```yaml
- alert: AgentHeartbeatMissing
  expr: (time() - velya_agent_heartbeat_timestamp) > 180
  for: 0m
  labels:
    severity: critical
  annotations:
    summary: 'Agent {{ $labels.agent_name }} silencioso há {{ $value | humanizeDuration }}'

- alert: AgentHeartbeatStale
  expr: |
    (time() - velya_agent_heartbeat_timestamp) > 90 AND
    (time() - velya_agent_heartbeat_timestamp) <= 180
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: 'Heartbeat atrasado: {{ $labels.agent_name }}'
```

---

### 2.2 Throughput

Mede a taxa de processamento de tasks por agent.

```promql
# Taxa de tasks processadas por minuto (por agent)
rate(velya_agent_tasks_processed_total[5m]) * 60

# Throughput por status (success/failure)
rate(velya_agent_tasks_processed_total{status="success"}[5m]) * 60
rate(velya_agent_tasks_processed_total{status="failure"}[5m]) * 60

# Taxa de sucesso (%)
rate(velya_agent_tasks_processed_total{status="success"}[5m]) /
rate(velya_agent_tasks_processed_total[5m]) * 100

# Throughput P95 de duração de task
histogram_quantile(0.95, rate(velya_agent_task_duration_seconds_bucket[10m]))
```

**Alertas:**

```yaml
- alert: AgentThroughputDrop
  expr: |
    rate(velya_agent_tasks_processed_total[10m]) < 
    rate(velya_agent_tasks_processed_total[1h] offset 1h) * 0.5
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: 'Throughput de {{ $labels.agent_name }} caiu > 50% vs hora anterior'

- alert: AgentSuccessRateLow
  expr: |
    rate(velya_agent_tasks_processed_total{status="success"}[10m]) /
    rate(velya_agent_tasks_processed_total[10m]) < 0.80
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: 'Taxa de sucesso de {{ $labels.agent_name }} abaixo de 80%'
```

---

### 2.3 Queue Depth

Mede o lag de mensagens na fila de cada agent.

```promql
# Profundidade atual da fila (mensagens pendentes)
velya_agent_queue_lag{agent="task-inbox-worker"}

# Taxa de crescimento da fila (mensagens/minuto)
rate(velya_agent_queue_lag[5m]) * 60

# Tempo estimado para limpar a fila (minutos)
velya_agent_queue_lag /
  clamp_min(rate(velya_agent_tasks_processed_total{status="success"}[10m]) * 60, 0.001)
```

**Alertas:**

```yaml
- alert: AgentQueueDepthHigh
  expr: velya_agent_queue_lag > 50
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: 'Fila de {{ $labels.agent_name }} com {{ $value }} mensagens pendentes'

- alert: AgentQueueDepthCritical
  expr: velya_agent_queue_lag > 200
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: 'Fila crítica: {{ $labels.agent_name }} com {{ $value }} mensagens'

- alert: AgentQueueGrowingWithNoProcessing
  expr: |
    rate(velya_agent_queue_lag[10m]) > 1 AND
    rate(velya_agent_tasks_processed_total[10m]) == 0
  for: 10m
  labels:
    severity: critical
  annotations:
    summary: 'Fila crescendo mas sem processamento para {{ $labels.agent_name }}'
```

---

### 2.4 Validation Pass Rate

Mede a taxa de outputs que passaram na validação.

```promql
# Taxa de validação bem-sucedida (%)
rate(velya_agent_validations_passed_total[1h]) /
rate(velya_agent_validations_total[1h]) * 100

# Outputs com validação falha (por tipo de erro)
rate(velya_agent_validations_failed_total[1h]) by (agent, failure_reason)

# Tendência de validation pass rate (comparação 24h)
rate(velya_agent_validations_passed_total[1h]) /
rate(velya_agent_validations_total[1h])
/
(
  rate(velya_agent_validations_passed_total[1h] offset 24h) /
  rate(velya_agent_validations_total[1h] offset 24h)
) - 1
```

**Alertas:**

```yaml
- alert: AgentValidationPassRateLow
  expr: |
    rate(velya_agent_validations_passed_total[30m]) /
    rate(velya_agent_validations_total[30m]) < 0.85
  for: 15m
  labels:
    severity: warning
    team: validation
  annotations:
    summary: 'Validation pass rate de {{ $labels.agent_name }} abaixo de 85%'

- alert: AgentValidationPassRateCritical
  expr: |
    rate(velya_agent_validations_passed_total[15m]) /
    rate(velya_agent_validations_total[15m]) < 0.70
  for: 5m
  labels:
    severity: critical
    team: governance
  annotations:
    summary: 'CRÍTICO: Validation pass rate de {{ $labels.agent_name }} abaixo de 70%'
```

---

### 2.5 Audit Pass Rate

```promql
# Taxa de auditoria aprovada (%)
rate(velya_agent_audits_passed_total[1h]) /
rate(velya_agent_audits_total[1h]) * 100

# Auditorias falhando por razão
topk(10, rate(velya_agent_audits_failed_total[6h]) by (agent, failure_category))
```

**Alertas:**

```yaml
- alert: AgentAuditPassRateLow
  expr: |
    rate(velya_agent_audits_passed_total[1h]) /
    rate(velya_agent_audits_total[1h]) < 0.90
  for: 30m
  labels:
    severity: warning
    team: audit
  annotations:
    summary: 'Audit pass rate de {{ $labels.agent_name }} abaixo de 90%'
```

---

### 2.6 Correction Recurrence

Detecta quando o mesmo tipo de correção acontece repetidamente — indicando que um learning event deve ser gerado.

```promql
# Contagem de correções por tipo (rolling 7 dias)
increase(velya_agent_corrections_total[7d]) by (agent, correction_type)

# Taxa de recorrência de correção (mesmo tipo nas últimas 2 semanas)
increase(velya_agent_corrections_total{correction_type!=""}[14d]) > 3
```

**Alertas:**

```yaml
- alert: CorrectionRecurrenceDetected
  expr: |
    increase(velya_agent_corrections_total[14d]) by (correction_type) > 3
  for: 0m
  labels:
    severity: info
    team: learning
  annotations:
    summary: "Correção '{{ $labels.correction_type }}' ocorreu {{ $value }}x em 14 dias — learning event necessário"
```

---

### 2.7 Handoff Latency

Mede o tempo entre um agent finalizar uma task e o próximo agent começar a processar.

```promql
# Latência de handoff por par de agents (P95)
histogram_quantile(0.95,
  rate(velya_agent_handoff_latency_seconds_bucket[30m])
) by (source_agent, target_agent)

# Handoffs com latência > 60 segundos
velya_agent_handoff_latency_seconds_sum / velya_agent_handoff_latency_seconds_count > 60
```

---

### 2.8 Retry Count e Score Trend

```promql
# Retries por hora por agent
rate(velya_agent_retry_count_total[1h]) * 3600

# Tendência de retry (crescendo vs semana anterior)
rate(velya_agent_retry_count_total[1h]) /
rate(velya_agent_retry_count_total[1h] offset 7d)

# Score de qualidade por agent (rolling 24h)
velya_agent_output_quality_score_rolling_24h

# Tendência de score (comparação 7 dias)
velya_agent_output_quality_score_rolling_24h -
velya_agent_output_quality_score_rolling_24h offset 7d
```

**Alertas:**

```yaml
- alert: AgentQualityScoreDecline
  expr: |
    velya_agent_output_quality_score_rolling_24h < 
    velya_agent_output_quality_score_rolling_24h offset 7d * 0.90
  for: 1h
  labels:
    severity: warning
    team: governance
  annotations:
    summary: 'Score de qualidade de {{ $labels.agent_name }} caiu >10% vs semana anterior'
```

---

## 3. Métricas por Office

### 3.1 Incoming Workload

```promql
# Volume de trabalho recebido por office (mensagens/hora)
rate(velya_office_messages_received_total[1h]) * 3600 by (office)

# Comparação com baseline (semana anterior)
rate(velya_office_messages_received_total[1h]) /
rate(velya_office_messages_received_total[1h] offset 7d) - 1
```

**Alertas:**

```yaml
- alert: OfficeWorkloadSpike
  expr: |
    rate(velya_office_messages_received_total[30m]) >
    rate(velya_office_messages_received_total[1h] offset 1d) * 3
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: 'Office {{ $labels.office }} com volume 3x acima do normal'
```

---

### 3.2 Backlog Age

```promql
# Idade da mensagem mais antiga na fila do office (segundos)
velya_office_oldest_message_age_seconds by (office)

# Percentual de mensagens aguardando há mais de 30 minutos
velya_office_messages_waiting_over_sla_total /
velya_office_messages_total * 100
```

**Alertas:**

```yaml
- alert: OfficeBacklogAgeExceeded
  expr: velya_office_oldest_message_age_seconds > 1800 # 30 minutos
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: 'Mensagem com {{ $value | humanizeDuration }} aguardando no office {{ $labels.office }}'
```

---

### 3.3 SLA Adherence

```promql
# % de tasks dentro do SLA por office (rolling 24h)
rate(velya_office_tasks_within_sla_total[24h]) /
rate(velya_office_tasks_total[24h]) * 100 by (office)

# SLA aderência por tipo de task e office
rate(velya_office_tasks_within_sla_total[1h]) /
rate(velya_office_tasks_total[1h]) * 100 by (office, task_type)
```

**Alertas:**

```yaml
- alert: OfficeSLAAdherenceLow
  expr: |
    rate(velya_office_tasks_within_sla_total[1h]) /
    rate(velya_office_tasks_total[1h]) < 0.85
  for: 30m
  labels:
    severity: warning
  annotations:
    summary: 'Office {{ $labels.office }} com SLA aderência abaixo de 85%'
```

---

### 3.4 Congestion

```promql
# Índice de congestionamento (queue_lag / throughput)
velya_office_queue_depth /
  clamp_min(rate(velya_office_tasks_processed_total[10m]) * 60, 0.001)

# Congestionamento > 30 minutos estimados para limpar
(velya_office_queue_depth / rate(velya_office_tasks_processed_total[10m])) / 60 > 30
```

---

## 4. Métricas por Cluster

### 4.1 Namespace Pressure

```promql
# Uso de CPU por namespace vs request (%)
sum(rate(container_cpu_usage_seconds_total{namespace=~"velya-.*"}[5m])) by (namespace) /
sum(kube_pod_container_resource_requests{namespace=~"velya-.*", resource="cpu"}) by (namespace) * 100

# Uso de memória por namespace vs limit (%)
sum(container_memory_working_set_bytes{namespace=~"velya-.*"}) by (namespace) /
sum(kube_pod_container_resource_limits{namespace=~"velya-.*", resource="memory"}) by (namespace) * 100

# ResourceQuota utilização por namespace
kube_resourcequota{namespace=~"velya-.*"} by (namespace, resource, type)
```

**Alertas:**

```yaml
- alert: NamespaceCPUPressureHigh
  expr: |
    sum(rate(container_cpu_usage_seconds_total{namespace="velya-dev-agents"}[5m])) /
    sum(kube_pod_container_resource_requests{namespace="velya-dev-agents", resource="cpu"}) > 0.85
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: 'Namespace velya-dev-agents usando >85% de CPU solicitado'

- alert: NamespaceMemoryPressureHigh
  expr: |
    sum(container_memory_working_set_bytes{namespace=~"velya-.*"}) by (namespace) /
    sum(kube_pod_container_resource_limits{namespace=~"velya-.*", resource="memory"}) by (namespace) > 0.90
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: 'Namespace {{ $labels.namespace }} usando >90% do limite de memória'
```

---

### 4.2 Pod Churn

```promql
# Taxa de restart de containers (por hora)
rate(kube_pod_container_status_restarts_total{namespace=~"velya-.*"}[1h]) * 3600 by (namespace, pod)

# Pods em CrashLoopBackOff
kube_pod_container_status_waiting_reason{namespace=~"velya-.*", reason="CrashLoopBackOff"} == 1

# Taxa de criação/deleção de pods (pod churn)
rate(kube_pod_created{namespace=~"velya-.*"}[10m]) * 60
```

**Alertas:**

```yaml
- alert: PodCrashLoopBackOff
  expr: |
    kube_pod_container_status_waiting_reason{
      namespace=~"velya-.*", 
      reason="CrashLoopBackOff"
    } == 1
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: 'Pod {{ $labels.pod }} em CrashLoopBackOff no namespace {{ $labels.namespace }}'

- alert: HighPodRestartRate
  expr: |
    rate(kube_pod_container_status_restarts_total{namespace=~"velya-.*"}[1h]) > 0.1
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: 'Pod {{ $labels.pod }} reiniciando mais de 6 vezes/hora'
```

---

### 4.3 KEDA Behavior

```promql
# Réplicas atuais por ScaledObject
keda_scaler_active by (scaledObject, namespace)

# Escalonamentos por ScaledObject (rate)
rate(keda_scaler_errors_total[10m]) by (scaledObject, namespace)

# Lag de fila por trigger NATS (via KEDA metrics)
keda_nats_jetstream_consumer_num_pending by (stream, consumer)
```

**Alertas:**

```yaml
- alert: KEDAScalerError
  expr: rate(keda_scaler_errors_total[5m]) > 0
  for: 5m
  labels:
    severity: warning
    team: platform-health
  annotations:
    summary: 'KEDA scaler com erros para {{ $labels.scaledObject }}'

- alert: KEDAMaxReplicasReached
  expr: |
    kube_deployment_spec_replicas{namespace="velya-dev-agents"} >=
    kube_horizontalpodautoscaler_spec_max_replicas{namespace="velya-dev-agents"}
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: '{{ $labels.deployment }} atingiu máximo de réplicas — considerar aumentar maxReplicaCount'
```

---

### 4.4 DLQ Growth

```promql
# Mensagens na DLQ por tipo
velya_dlq_messages_total by (dlq_type)

# Taxa de crescimento da DLQ (mensagens/hora)
rate(velya_dlq_messages_total[1h]) * 3600 by (dlq_type)

# DLQs sem processamento há mais de SLA
velya_dlq_oldest_message_age_seconds > velya_dlq_sla_seconds
```

**Alertas:**

```yaml
- alert: DLQGrowthRateHigh
  expr: rate(velya_dlq_messages_total[30m]) > 0.5
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: 'DLQ {{ $labels.dlq_type }} crescendo: {{ $value | humanize }}/min'

- alert: DLQSLABreached
  expr: velya_dlq_oldest_message_age_seconds > velya_dlq_sla_seconds
  for: 0m
  labels:
    severity: warning
  annotations:
    summary: 'SLA de investigação de DLQ {{ $labels.dlq_type }} violado'
```

---

### 4.5 Cost Anomaly

```promql
# Custo de inferência LLM por namespace (rolling 1h)
sum(velya_agent_llm_cost_usd_total[1h]) by (namespace) * 24 * 30  # Projeção mensal

# Comparação de custo vs baseline (semana anterior)
sum(velya_agent_llm_cost_usd_total[1h]) /
sum(velya_agent_llm_cost_usd_total[1h] offset 7d) - 1

# Budget utilization por office
sum(velya_agent_llm_cost_usd_total[1h]) by (office) /
  on(office) velya_office_llm_budget_hourly_usd * 100
```

**Alertas:**

```yaml
- alert: CostAnomalyDetected
  expr: |
    sum(velya_agent_llm_cost_usd_total[1h]) >
    sum(velya_agent_llm_cost_usd_total[1h] offset 7d) * 2
  for: 30m
  labels:
    severity: warning
    team: finops
  annotations:
    summary: 'Custo de LLM 2x acima da semana anterior — possível anomalia'

- alert: OfficeBudgetNearExhaustion
  expr: |
    sum(velya_agent_llm_cost_usd_total[1h]) by (office) /
    on(office) velya_office_llm_budget_hourly_usd > 0.80
  for: 5m
  labels:
    severity: warning
    team: finops
  annotations:
    summary: 'Office {{ $labels.office }} com 80% do budget de inferência utilizado'
```

---

## 5. Dashboard Grafana: Hierarquia

```
velya-24x7-overview (visão geral)
├── velya-agent-health (saúde por agent)
│   ├── heartbeat-map
│   ├── throughput-per-agent
│   ├── queue-depth-per-agent
│   ├── confidence-scores
│   └── retry-rates
├── velya-office-health (saúde por office)
│   ├── sla-adherence
│   ├── backlog-age
│   ├── congestion-index
│   └── workload-volume
├── velya-cluster-health (saúde do cluster)
│   ├── namespace-pressure
│   ├── pod-churn
│   ├── keda-scaling
│   ├── dlq-overview
│   └── cost-overview
├── velya-cost-dashboard (custo detalhado)
│   ├── llm-cost-by-agent
│   ├── compute-cost-by-nodepool
│   ├── budget-utilization
│   └── cost-trend-7d-30d
└── velya-incidents (incidentes ativos)
    ├── active-alerts
    ├── recent-incidents
    └── mttr-tracking
```

---

## 6. Configuração do Stack de Observabilidade

### 6.1 Prometheus no kind-velya-local

```yaml
# Configuração de scraping de métricas de agents
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: velya-agents-monitor
  namespace: velya-dev-observability
spec:
  namespaceSelector:
    matchNames:
      - velya-dev-agents
  selector:
    matchLabels:
      velya.io/metrics: 'true'
  endpoints:
    - port: metrics
      path: /metrics
      interval: 15s
      scrapeTimeout: 10s
```

### 6.2 Loki Log Queries Úteis

```logql
# Logs de erros de agents nas últimas 1 hora
{namespace="velya-dev-agents"} |= "error" | json | level="error"

# Logs de um agent específico
{namespace="velya-dev-agents", app="task-inbox-worker"} | json

# Errors de validação recentes
{namespace="velya-dev-agents"} |= "validation_failed" | json
  | line_format "{{.timestamp}} [{{.agent_name}}] {{.error_message}}"

# Heartbeats faltando (nenhum log de heartbeat nos últimos 5 minutos)
# (detectado por ausência de entries)
count_over_time({namespace="velya-dev-agents"} |= "heartbeat_published" [5m]) == 0
```

### 6.3 Tempo Tracing

```yaml
# Configuração de tracing para agents Velya
# Cada agent envia traces via OTLP para Tempo
OTEL_EXPORTER_OTLP_ENDPOINT: 'http://tempo.velya-dev-observability.svc:4317'
OTEL_SERVICE_NAME: 'task-inbox-worker'
OTEL_RESOURCE_ATTRIBUTES: 'velya.office=clinical-operations,velya.agent-class=Worker'
```

---

## 7. On-Call Runbooks de Observabilidade

### 7.1 Alerta Recebido: AgentHeartbeatMissing

1. Verificar pod no namespace: `kubectl get pods -n velya-dev-agents -l app={agent_name}`
2. Se pod em CrashLoopBackOff: `kubectl logs -n velya-dev-agents {pod_name} --previous`
3. Se pod Running mas sem heartbeat: `kubectl exec -n velya-dev-agents {pod_name} -- curl localhost:8080/health`
4. Verificar conectividade NATS: `kubectl exec {pod_name} -- nats pub test "" --server $NATS_URL`
5. Se tudo OK mas sem heartbeat: restart do pod como último recurso

### 7.2 Alerta Recebido: AgentQueueDepthCritical

1. Verificar KEDA ScaledObject: `kubectl get scaledobject -n velya-dev-agents`
2. Verificar réplicas atuais vs max: `kubectl get deployment -n velya-dev-agents {agent_name}`
3. Verificar ResourceQuota: `kubectl describe resourcequota -n velya-dev-agents`
4. Verificar saúde do downstream (patient-flow-service, etc.)
5. Se downstream degradado: ativar modo degraded para o office
