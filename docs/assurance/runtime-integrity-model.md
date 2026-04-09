# Modelo de Integridade em Runtime - Velya Platform

## Visao Geral

Este documento define o que deve ser monitorado durante a operacao da Velya Platform, incluindo metricas especificas, queries PromQL, thresholds de alerta e acoes de resposta. O modelo cobre: health checks, heartbeats, drift detection, SLOs, filas, latencia, erros, saturacao, DLQ, fallbacks e schedules.

---

## 1. Health Checks com Verificacao de Dependencias

### Problema com health checks simples
Um HTTP 200 no `/healthz` nao garante que o servico esta funcional. O servico pode retornar 200 mas estar desconectado do banco de dados, do NATS ou do Temporal.

### Implementacao de health check com dependencias

```go
// Exemplo: patient-flow health check (Go)
package health

import (
    "context"
    "encoding/json"
    "net/http"
    "time"
)

type DependencyStatus struct {
    Name    string `json:"name"`
    Status  string `json:"status"` // "ok", "degraded", "down"
    Latency string `json:"latency"`
    Error   string `json:"error,omitempty"`
}

type HealthResponse struct {
    Status       string             `json:"status"`
    Service      string             `json:"service"`
    Version      string             `json:"version"`
    Uptime       string             `json:"uptime"`
    Dependencies []DependencyStatus `json:"dependencies"`
}

func (h *HealthHandler) ReadinessCheck(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    deps := []DependencyStatus{}
    allOk := true

    // Verificar PostgreSQL
    dbStart := time.Now()
    if err := h.db.PingContext(ctx); err != nil {
        deps = append(deps, DependencyStatus{
            Name: "postgresql", Status: "down", Error: err.Error(),
        })
        allOk = false
    } else {
        deps = append(deps, DependencyStatus{
            Name: "postgresql", Status: "ok",
            Latency: time.Since(dbStart).String(),
        })
    }

    // Verificar NATS JetStream
    natsStart := time.Now()
    if _, err := h.nats.JetStream(); err != nil {
        deps = append(deps, DependencyStatus{
            Name: "nats-jetstream", Status: "down", Error: err.Error(),
        })
        allOk = false
    } else {
        deps = append(deps, DependencyStatus{
            Name: "nats-jetstream", Status: "ok",
            Latency: time.Since(natsStart).String(),
        })
    }

    // Verificar Temporal
    temporalStart := time.Now()
    if _, err := h.temporal.CheckHealth(ctx, nil); err != nil {
        deps = append(deps, DependencyStatus{
            Name: "temporal", Status: "degraded", Error: err.Error(),
        })
        // Temporal degradado nao torna o servico unready
        // pois pode operar em modo de fallback
    } else {
        deps = append(deps, DependencyStatus{
            Name: "temporal", Status: "ok",
            Latency: time.Since(temporalStart).String(),
        })
    }

    resp := HealthResponse{
        Service:      "patient-flow",
        Version:      h.version,
        Uptime:       time.Since(h.startTime).String(),
        Dependencies: deps,
    }

    if allOk {
        resp.Status = "ok"
        w.WriteHeader(http.StatusOK)
    } else {
        resp.Status = "unhealthy"
        w.WriteHeader(http.StatusServiceUnavailable)
    }

    json.NewEncoder(w).Encode(resp)
}
```

### Metricas e alertas

| Metrica | Query PromQL | Threshold de alerta | Acao |
|---|---|---|---|
| Dependencia down | `health_dependency_status{status="down"}` | == 1 por > 30s | Alerta P2, verificar dependencia |
| Health check latencia | `health_check_duration_seconds{quantile="0.99"}` | > 3s | Investigar dependencia lenta |
| Readiness falha consecutiva | `kube_pod_status_ready{condition="false", namespace=~"velya.*"}` | > 0 por > 60s | Verificar logs do pod |

---

## 2. Heartbeat Freshness

### Conceito
Agentes e workers devem emitir heartbeats periodicos. Se um heartbeat nao e recebido dentro do intervalo esperado, o componente e considerado stale.

### Metricas

```yaml
# prometheus-rules.yml
groups:
  - name: velya-heartbeat-freshness
    rules:
      # Recording rule: tempo desde o ultimo heartbeat
      - record: velya:heartbeat_age_seconds
        expr: |
          time() - max by (service, instance) (
            velya_heartbeat_timestamp_seconds
          )

      # Alerta: heartbeat atrasado para agentes
      - alert: AgentHeartbeatStale
        expr: |
          velya:heartbeat_age_seconds{service=~"agent-.*|claude-agent-.*"} > 60
        for: 2m
        labels:
          severity: warning
          team: agents
        annotations:
          summary: "Heartbeat stale para {{ $labels.service }} em {{ $labels.instance }}"
          description: "Ultimo heartbeat recebido ha {{ $value }}s (limite: 60s)"
          runbook: "docs/runbooks/agent-heartbeat-stale.md"

      # Alerta: heartbeat atrasado para workers Temporal
      - alert: TemporalWorkerHeartbeatStale
        expr: |
          velya:heartbeat_age_seconds{service=~".*-worker"} > 120
        for: 3m
        labels:
          severity: critical
          team: core
        annotations:
          summary: "Worker Temporal {{ $labels.service }} sem heartbeat"
          description: "Ultimo heartbeat ha {{ $value }}s. Workflows podem estar travados."
          runbook: "docs/runbooks/temporal-worker-stale.md"
```

---

## 3. Drift Detection (GitOps vs Actual)

### Conceito
O estado real do cluster deve corresponder ao estado declarado no Git (ArgoCD). Qualquer divergencia (drift) indica uma mudanca nao autorizada ou um problema de sincronizacao.

### Metricas ArgoCD

| Metrica | Query PromQL | Threshold | Acao |
|---|---|---|---|
| App out of sync | `argocd_app_info{sync_status="OutOfSync", dest_namespace=~"velya.*"}` | == 1 por > 5m | Investigar drift, auto-sync deve resolver |
| App degraded | `argocd_app_info{health_status="Degraded", dest_namespace=~"velya.*"}` | == 1 por > 2m | Alerta P2, verificar pods |
| App missing | `argocd_app_info{health_status="Missing", dest_namespace=~"velya.*"}` | == 1 | Alerta P1, recurso deletado |
| Sync failures | `argocd_app_sync_total{phase="Error", dest_namespace=~"velya.*"}` | > 0 por > 10m | Verificar logs ArgoCD |

### Alertas de drift

```yaml
groups:
  - name: velya-gitops-drift
    rules:
      - alert: ArgoAppOutOfSync
        expr: |
          argocd_app_info{
            sync_status="OutOfSync",
            dest_namespace=~"velya-dev-.*"
          } == 1
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "ArgoCD app {{ $labels.name }} out of sync"
          description: "A aplicacao {{ $labels.name }} no namespace {{ $labels.dest_namespace }} esta fora de sincronia com o Git ha mais de 5 minutos."
          action: "Verificar se auto-sync esta habilitado. Se drift manual, reverter."

      - alert: ArgoAppDegraded
        expr: |
          argocd_app_info{
            health_status="Degraded",
            dest_namespace=~"velya-dev-.*"
          } == 1
        for: 2m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "ArgoCD app {{ $labels.name }} degraded"
          description: "A aplicacao {{ $labels.name }} esta em estado degradado. Pods podem nao estar saudaveis."

      # Drift detection customizado: comparar configmaps
      - alert: ConfigMapDrift
        expr: |
          velya_configmap_hash{namespace=~"velya-dev-.*"}
          !=
          velya_configmap_expected_hash{namespace=~"velya-dev-.*"}
        for: 1m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "ConfigMap {{ $labels.configmap }} driftou do valor esperado"
          description: "ConfigMap foi modificado fora do GitOps. ArgoCD deve corrigir automaticamente."
```

---

## 4. SLO Monitoring

### SLOs definidos por servico

| Servico | SLI | SLO | Error Budget (30 dias) |
|---|---|---|---|
| patient-flow | Disponibilidade (requests com sucesso / total) | 99.9% | 43.2 min |
| patient-flow | Latencia P99 < 2s | 99.5% | 3.6 horas |
| discharge-orchestrator | Workflows completados com sucesso | 99.5% | 3.6 horas |
| task-inbox | Mensagens processadas < 5s | 99.0% | 7.2 horas |
| ai-gateway | Inferencia disponivel | 99.0% | 7.2 horas |
| velya-web | LCP < 2.5s | 95.0% | 36 horas |

### Recording rules para SLOs

```yaml
groups:
  - name: velya-slo-recording
    rules:
      # patient-flow: disponibilidade
      - record: velya:sli:patient_flow_availability
        expr: |
          sum(rate(http_requests_total{
            service="patient-flow",
            status!~"5.."
          }[5m]))
          /
          sum(rate(http_requests_total{
            service="patient-flow"
          }[5m]))

      # patient-flow: latencia
      - record: velya:sli:patient_flow_latency_good
        expr: |
          sum(rate(http_request_duration_seconds_bucket{
            service="patient-flow",
            le="2.0"
          }[5m]))
          /
          sum(rate(http_request_duration_seconds_count{
            service="patient-flow"
          }[5m]))

      # discharge-orchestrator: workflow success
      - record: velya:sli:discharge_workflow_success
        expr: |
          sum(rate(temporal_workflow_completed_total{
            namespace="velya",
            workflow_type=~"discharge.*"
          }[5m]))
          /
          (
            sum(rate(temporal_workflow_completed_total{
              namespace="velya",
              workflow_type=~"discharge.*"
            }[5m]))
            +
            sum(rate(temporal_workflow_failed_total{
              namespace="velya",
              workflow_type=~"discharge.*"
            }[5m]))
          )

      # task-inbox: processamento rapido
      - record: velya:sli:task_inbox_fast_processing
        expr: |
          sum(rate(task_processing_duration_seconds_bucket{
            service="task-inbox",
            le="5.0"
          }[5m]))
          /
          sum(rate(task_processing_duration_seconds_count{
            service="task-inbox"
          }[5m]))

      # Error budget remaining (30 dias)
      - record: velya:error_budget:patient_flow_remaining
        expr: |
          1 - (
            (1 - velya:sli:patient_flow_availability)
            /
            (1 - 0.999)
          )

      - record: velya:error_budget:discharge_remaining
        expr: |
          1 - (
            (1 - velya:sli:discharge_workflow_success)
            /
            (1 - 0.995)
          )
```

### Alertas de error budget

```yaml
groups:
  - name: velya-slo-alerts
    rules:
      # Error budget queimando rapido (burn rate alto)
      - alert: PatientFlowErrorBudgetBurnHigh
        expr: |
          (
            1 - velya:sli:patient_flow_availability
          ) / (1 - 0.999) > 14.4
        for: 5m
        labels:
          severity: critical
          team: core
          slo: patient-flow-availability
        annotations:
          summary: "patient-flow esta queimando error budget 14.4x mais rapido que o permitido"
          description: "Na taxa atual, o error budget de 30 dias sera esgotado em menos de 2 dias."
          action: "Investigar imediatamente. Considerar rollback do ultimo deploy."

      # Error budget queimando moderadamente
      - alert: PatientFlowErrorBudgetBurnModerate
        expr: |
          (
            1 - velya:sli:patient_flow_availability
          ) / (1 - 0.999) > 6
        for: 30m
        labels:
          severity: warning
          team: core
          slo: patient-flow-availability
        annotations:
          summary: "patient-flow esta queimando error budget 6x mais rapido que o permitido"
          description: "Na taxa atual, o error budget sera esgotado em menos de 5 dias."

      # Error budget esgotado
      - alert: PatientFlowErrorBudgetExhausted
        expr: |
          velya:error_budget:patient_flow_remaining < 0
        for: 1m
        labels:
          severity: critical
          team: core
          slo: patient-flow-availability
        annotations:
          summary: "Error budget de patient-flow ESGOTADO"
          description: "SLO de 99.9% de disponibilidade foi violado no periodo de 30 dias. Suspender deploys nao-urgentes."
          action: "Ativar deploy freeze para patient-flow ate estabilizar."
```

---

## 5. Queue Aging (NATS JetStream)

### Metricas de filas

| Metrica | Query PromQL | Threshold | Severidade | Acao |
|---|---|---|---|---|
| Consumer lag | `nats_consumer_num_pending{stream=~"velya.*"}` | > 1000 msgs | Warning | Verificar consumer, considerar scale |
| Consumer lag critico | `nats_consumer_num_pending{stream=~"velya.*"}` | > 10000 msgs | Critical | Scale imediato, investigar backpressure |
| Mensagem mais antiga | `nats_consumer_num_ack_pending{stream=~"velya.*"}` | > 100 | Warning | Verificar processing time |
| Stream utilization | `nats_server_jetstream_stream_bytes{stream=~"velya.*"}` | > 80% do limite | Warning | Verificar retention policy |
| Delivery failures | `rate(nats_consumer_num_redelivered{stream=~"velya.*"}[5m])` | > 10/min | Warning | Verificar DLQ, logs do consumer |

### Alertas NATS

```yaml
groups:
  - name: velya-nats-health
    rules:
      - alert: NATSConsumerLagHigh
        expr: |
          nats_consumer_num_pending{
            stream=~"velya-.*"
          } > 1000
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "NATS consumer lag alto: {{ $labels.stream }}/{{ $labels.consumer }}"
          description: "{{ $value }} mensagens pendentes. Consumer pode estar lento ou parado."
          action: |
            1. Verificar se consumer pods estao rodando: kubectl get pods -n velya-dev-core -l app={{ $labels.consumer }}
            2. Verificar logs do consumer
            3. Se necessario, escalar consumer via KEDA

      - alert: NATSConsumerLagCritical
        expr: |
          nats_consumer_num_pending{
            stream=~"velya-.*"
          } > 10000
        for: 2m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "NATS consumer lag CRITICO: {{ $labels.stream }}/{{ $labels.consumer }}"
          description: "{{ $value }} mensagens pendentes. Risco de perda de mensagens se stream atingir limite."
          action: "Escalar consumer imediatamente. Verificar se ha deadlock ou erro sistematico."

      - alert: NATSHighRedeliveryRate
        expr: |
          rate(nats_consumer_num_redelivered{
            stream=~"velya-.*"
          }[5m]) > 10
        for: 3m
        labels:
          severity: warning
          team: core
        annotations:
          summary: "Alta taxa de redelivery em {{ $labels.stream }}/{{ $labels.consumer }}"
          description: "{{ $value }} redeliveries/seg. Mensagens estao falhando repetidamente."
          action: "Verificar DLQ. Mensagens podem estar com formato invalido ou dependencia down."
```

### KEDA ScaledObject para autoscaling baseado em fila

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: task-inbox-scaler
  namespace: velya-dev-core
  labels:
    app: task-inbox
spec:
  scaleTargetRef:
    name: task-inbox
  pollingInterval: 15
  cooldownPeriod: 60
  minReplicaCount: 1
  maxReplicaCount: 10
  triggers:
    - type: nats-jetstream
      metadata:
        natsServerMonitoringEndpoint: "nats.velya-dev-platform:8222"
        account: "$G"
        stream: "velya-tasks"
        consumer: "task-inbox-consumer"
        lagThreshold: "500"
        activationLagThreshold: "10"
```

---

## 6. Latencia, Erros e Saturacao (RED/USE)

### Metricas RED (Rate, Errors, Duration)

```yaml
groups:
  - name: velya-red-metrics
    rules:
      # Rate: requisicoes por segundo por servico
      - record: velya:http_request_rate:5m
        expr: |
          sum by (service) (
            rate(http_requests_total{namespace=~"velya-dev-.*"}[5m])
          )

      # Errors: taxa de erro por servico
      - record: velya:http_error_rate:5m
        expr: |
          sum by (service) (
            rate(http_requests_total{namespace=~"velya-dev-.*", status=~"5.."}[5m])
          )
          /
          sum by (service) (
            rate(http_requests_total{namespace=~"velya-dev-.*"}[5m])
          )

      # Duration: latencia P50, P95, P99 por servico
      - record: velya:http_latency_p50:5m
        expr: |
          histogram_quantile(0.50,
            sum by (service, le) (
              rate(http_request_duration_seconds_bucket{namespace=~"velya-dev-.*"}[5m])
            )
          )

      - record: velya:http_latency_p95:5m
        expr: |
          histogram_quantile(0.95,
            sum by (service, le) (
              rate(http_request_duration_seconds_bucket{namespace=~"velya-dev-.*"}[5m])
            )
          )

      - record: velya:http_latency_p99:5m
        expr: |
          histogram_quantile(0.99,
            sum by (service, le) (
              rate(http_request_duration_seconds_bucket{namespace=~"velya-dev-.*"}[5m])
            )
          )
```

### Metricas USE (Utilization, Saturation, Errors) para recursos

```yaml
groups:
  - name: velya-use-metrics
    rules:
      # CPU Utilization
      - record: velya:cpu_utilization
        expr: |
          sum by (namespace, pod) (
            rate(container_cpu_usage_seconds_total{
              namespace=~"velya-dev-.*"
            }[5m])
          )
          /
          sum by (namespace, pod) (
            kube_pod_container_resource_limits{
              namespace=~"velya-dev-.*",
              resource="cpu"
            }
          )

      # Memory Utilization
      - record: velya:memory_utilization
        expr: |
          sum by (namespace, pod) (
            container_memory_working_set_bytes{
              namespace=~"velya-dev-.*"
            }
          )
          /
          sum by (namespace, pod) (
            kube_pod_container_resource_limits{
              namespace=~"velya-dev-.*",
              resource="memory"
            }
          )

      # CPU Saturation (throttling)
      - record: velya:cpu_throttle_rate
        expr: |
          sum by (namespace, pod) (
            rate(container_cpu_cfs_throttled_periods_total{
              namespace=~"velya-dev-.*"
            }[5m])
          )
          /
          sum by (namespace, pod) (
            rate(container_cpu_cfs_periods_total{
              namespace=~"velya-dev-.*"
            }[5m])
          )
```

### Alertas RED/USE

```yaml
groups:
  - name: velya-red-use-alerts
    rules:
      - alert: HighErrorRate
        expr: velya:http_error_rate:5m > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Taxa de erro alta para {{ $labels.service }}: {{ $value | humanizePercentage }}"

      - alert: HighLatencyP99
        expr: velya:http_latency_p99:5m > 5.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Latencia P99 alta para {{ $labels.service }}: {{ $value }}s"

      - alert: CPUThrottling
        expr: velya:cpu_throttle_rate > 0.25
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "CPU throttling alto para {{ $labels.pod }}: {{ $value | humanizePercentage }}"
          action: "Considerar aumentar CPU limit ou otimizar codigo."

      - alert: MemoryNearLimit
        expr: velya:memory_utilization > 0.90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Memoria proxima do limite para {{ $labels.pod }}: {{ $value | humanizePercentage }}"
          action: "Monitorar. Se persistir, aumentar memory limit ou investigar leak."

      - alert: MemoryOOMRisk
        expr: velya:memory_utilization > 0.95
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Risco de OOM para {{ $labels.pod }}: {{ $value | humanizePercentage }}"
          action: "Acao imediata. Pod sera killed pelo OOM Killer. Investigar memory leak."
```

---

## 7. DLQ (Dead Letter Queue) Visibility

### Metricas DLQ

```yaml
groups:
  - name: velya-dlq
    rules:
      # Contagem de mensagens na DLQ
      - record: velya:dlq_messages_total
        expr: |
          nats_consumer_num_pending{
            stream=~"velya-.*-dlq"
          }

      # Taxa de entrada na DLQ
      - record: velya:dlq_ingress_rate:5m
        expr: |
          rate(nats_consumer_delivered_total{
            stream=~"velya-.*-dlq"
          }[5m])

      - alert: DLQMessagesAccumulating
        expr: |
          velya:dlq_messages_total > 10
        for: 5m
        labels:
          severity: warning
          team: core
        annotations:
          summary: "DLQ acumulando mensagens: {{ $labels.stream }}"
          description: "{{ $value }} mensagens na DLQ. Indica falhas sistematicas no processamento."
          action: |
            1. Verificar formato das mensagens na DLQ
            2. Verificar logs de erro do consumer original
            3. Corrigir e reprocessar manualmente se necessario

      - alert: DLQMessagesHigh
        expr: |
          velya:dlq_messages_total > 100
        for: 2m
        labels:
          severity: critical
          team: core
        annotations:
          summary: "DLQ com volume CRITICO: {{ $labels.stream }}"
          description: "{{ $value }} mensagens na DLQ. Possivel falha sistemica."
```

---

## 8. Fallback Activation Monitoring

### Metricas de fallback e circuit breaker

```yaml
groups:
  - name: velya-fallback
    rules:
      # Circuit breaker estado
      - record: velya:circuit_breaker_state
        expr: |
          velya_circuit_breaker_state{namespace=~"velya-dev-.*"}

      # Taxa de ativacao de fallback
      - record: velya:fallback_activation_rate:5m
        expr: |
          rate(velya_fallback_activations_total{
            namespace=~"velya-dev-.*"
          }[5m])

      - alert: CircuitBreakerOpen
        expr: |
          velya_circuit_breaker_state{
            namespace=~"velya-dev-.*"
          } == 2  # 0=closed, 1=half-open, 2=open
        for: 1m
        labels:
          severity: warning
          team: core
        annotations:
          summary: "Circuit breaker ABERTO: {{ $labels.service }} -> {{ $labels.dependency }}"
          description: "Dependencia {{ $labels.dependency }} esta indisponivel. Servico {{ $labels.service }} esta usando fallback."
          action: "Verificar saude da dependencia {{ $labels.dependency }}."

      - alert: FallbackActivationHigh
        expr: |
          velya:fallback_activation_rate:5m > 0.1  # mais de 1 fallback a cada 10 segundos
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Alta taxa de fallback para {{ $labels.service }}"
          description: "{{ $value }} fallbacks/seg. Dependencia pode estar instavel."

      - alert: FallbackActivationSustained
        expr: |
          velya:fallback_activation_rate:5m > 0.01
        for: 30m
        labels:
          severity: critical
        annotations:
          summary: "Fallback sustentado por 30+ minutos para {{ $labels.service }}"
          description: "Servico operando em modo degradado por tempo prolongado. Investigar dependencia."
```

---

## 9. Schedule Health (CronJobs e Temporal Schedules)

### Metricas de schedules

```yaml
groups:
  - name: velya-schedule-health
    rules:
      # CronJob nao executou no horario
      - alert: CronJobMissedSchedule
        expr: |
          time() - kube_cronjob_status_last_schedule_time{
            namespace=~"velya-dev-.*"
          } > kube_cronjob_spec_schedule_interval_seconds{
            namespace=~"velya-dev-.*"
          } * 1.5
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "CronJob {{ $labels.cronjob }} perdeu execucao programada"
          description: "Ultima execucao ha {{ $value }}s. Verificar se ha pods pendentes ou resource starvation."

      # CronJob falhando
      - alert: CronJobFailing
        expr: |
          kube_job_failed{
            namespace=~"velya-dev-.*"
          } > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Job {{ $labels.job_name }} falhou"
          description: "Verificar logs: kubectl logs -n {{ $labels.namespace }} job/{{ $labels.job_name }}"

      # Temporal schedule nao executando
      - alert: TemporalScheduleMissed
        expr: |
          time() - temporal_schedule_last_run_timestamp{
            namespace="velya"
          } > temporal_schedule_interval_seconds{
            namespace="velya"
          } * 2
        for: 5m
        labels:
          severity: warning
          team: core
        annotations:
          summary: "Temporal schedule {{ $labels.schedule_id }} nao executou no horario"
```

---

## 10. Anomaly Detection

### Deteccao de anomalias baseada em desvio historico

```yaml
groups:
  - name: velya-anomaly-detection
    rules:
      # Desvio de latencia em relacao ao baseline (media 7 dias)
      - alert: LatencyAnomaly
        expr: |
          (
            velya:http_latency_p99:5m
            -
            avg_over_time(velya:http_latency_p99:5m[7d])
          )
          /
          stddev_over_time(velya:http_latency_p99:5m[7d])
          > 3
        for: 10m
        labels:
          severity: warning
          type: anomaly
        annotations:
          summary: "Anomalia de latencia detectada para {{ $labels.service }}"
          description: "Latencia esta {{ $value }} desvios-padrao acima do baseline de 7 dias."

      # Desvio de taxa de requisicoes (possivel ataque ou mudanca de trafego)
      - alert: TrafficAnomaly
        expr: |
          (
            velya:http_request_rate:5m
            -
            avg_over_time(velya:http_request_rate:5m[7d])
          )
          /
          stddev_over_time(velya:http_request_rate:5m[7d])
          > 4
        for: 5m
        labels:
          severity: warning
          type: anomaly
        annotations:
          summary: "Anomalia de trafego para {{ $labels.service }}"
          description: "Taxa de requisicoes {{ $value }} desvios-padrao acima do normal."

      # Queda subita de trafego (possivel problema no upstream)
      - alert: TrafficDropAnomaly
        expr: |
          (
            avg_over_time(velya:http_request_rate:5m[7d])
            -
            velya:http_request_rate:5m
          )
          /
          avg_over_time(velya:http_request_rate:5m[7d])
          > 0.5
        for: 10m
        labels:
          severity: warning
          type: anomaly
        annotations:
          summary: "Queda de trafego > 50% para {{ $labels.service }}"
          description: "Trafego atual esta {{ $value | humanizePercentage }} abaixo do baseline."
```

---

## Dashboard Consolidado

### Grafana Dashboard: Velya Runtime Integrity

```json
{
  "dashboard": {
    "title": "Velya - Runtime Integrity Overview",
    "tags": ["velya", "runtime", "integrity"],
    "refresh": "15s",
    "panels": [
      {
        "title": "Service Health Matrix",
        "type": "table",
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "velya:http_error_rate:5m",
            "legendFormat": "Error Rate: {{service}}"
          },
          {
            "expr": "velya:http_latency_p99:5m",
            "legendFormat": "P99: {{service}}"
          },
          {
            "expr": "velya:http_request_rate:5m",
            "legendFormat": "RPS: {{service}}"
          }
        ]
      },
      {
        "title": "Error Budget Remaining (30d)",
        "type": "gauge",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
        "targets": [
          {
            "expr": "velya:error_budget:patient_flow_remaining * 100",
            "legendFormat": "patient-flow"
          },
          {
            "expr": "velya:error_budget:discharge_remaining * 100",
            "legendFormat": "discharge-orchestrator"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "yellow", "value": 25},
                {"color": "green", "value": 50}
              ]
            },
            "unit": "percent"
          }
        }
      },
      {
        "title": "NATS Consumer Lag",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
        "targets": [
          {
            "expr": "nats_consumer_num_pending{stream=~\"velya-.*\"}",
            "legendFormat": "{{stream}}/{{consumer}}"
          }
        ]
      },
      {
        "title": "Active Alerts",
        "type": "alertlist",
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 16},
        "options": {
          "alertName": "velya",
          "showOptions": "current",
          "sortOrder": 1,
          "stateFilter": ["alerting", "pending"]
        }
      }
    ]
  }
}
```

---

## Checklist de Integridade Runtime

Para cada servico Velya, verificar:

- [ ] Health check verifica dependencias (nao apenas HTTP 200)
- [ ] Heartbeat implementado com intervalo < 60s
- [ ] ArgoCD app com auto-sync habilitado e drift monitoring
- [ ] SLO definido com error budget e burn rate alerts
- [ ] Filas NATS com consumer lag monitoring e KEDA scaler
- [ ] Metricas RED (Rate, Errors, Duration) expostas via OpenTelemetry
- [ ] Metricas USE (Utilization, Saturation, Errors) via cAdvisor/kube-state-metrics
- [ ] DLQ configurada com alertas de acumulo
- [ ] Circuit breakers com metricas de estado
- [ ] Fallback monitoring com alerta de ativacao sustentada
- [ ] Schedules (CronJob/Temporal) com missed execution alerts
- [ ] Dashboard Grafana dedicado com todas as metricas acima
