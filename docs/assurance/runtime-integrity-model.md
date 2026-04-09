# Modelo de Integridade em Runtime - Velya Platform

> Definicao completa do que deve ser monitorado em runtime, como monitorar,
> quando alertar e como responder.
> Classificacao: Interno | Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

O modelo de integridade em runtime define **12 categorias de monitoramento** que operam
continuamente sobre todos os servicos Velya. Cada categoria tem metricas especificas,
queries PromQL, thresholds de alerta e acoes de resposta definidas.

### Categorias

| # | Categoria | Descricao |
|---|---|---|
| 1 | Health Checks com Verificacao de Dependencias | Probes que verificam dependencias reais |
| 2 | Frescor de Heartbeat | Sinais periodicos de que o servico esta ativo e processando |
| 3 | Padroes de Watchdog | Detectar quando um processo para de funcionar silenciosamente |
| 4 | Deteccao de Drift GitOps | Diferenca entre estado declarado e estado real no cluster |
| 5 | Deteccao de Anomalias | Desvios estatisticos do comportamento normal |
| 6 | Monitoramento de SLOs | Error budget, burn rate, compliance |
| 7 | Aging de Filas | Mensagens envelhecendo em filas NATS JetStream |
| 8 | Rastreamento de Latencia | Distribuicao de latencia por servico e endpoint |
| 9 | Rastreamento de Erros | Taxa e categorias de erros |
| 10 | Rastreamento de Saturacao | CPU, memoria, disco, conexoes |
| 11 | Visibilidade de DLQ | Mensagens em dead-letter queues |
| 12 | Saude de Schedules e Fallbacks | Cron jobs, fallbacks ativados, circuit breakers |

---

## 2. Categoria 1: Health Checks com Verificacao de Dependencias

### Principio

Health checks **nao podem** retornar HTTP 200 sem verificar dependencias reais.
Um servico que retorna "healthy" enquanto seu banco de dados esta inacessivel
e uma violacao de integridade.

### Implementacao por Servico

```yaml
health_check_spec:
  patient-flow:
    liveness: /health/live
    liveness_checks:
      - "Event loop responsivo (responde em < 100ms)"
      - "Processo nao esta em deadlock"
    readiness: /health/ready
    readiness_checks:
      - "PostgreSQL acessivel (SELECT 1)"
      - "NATS JetStream conectado"
      - "Redis cache acessivel"
      - "Tempo de resposta do DB < 100ms"
    startup: /health/startup
    startup_checks:
      - "Migrations executadas"
      - "Configuracao carregada"
      - "Conexoes de pool inicializadas"

  discharge-orchestrator:
    readiness_checks:
      - "PostgreSQL acessivel"
      - "Temporal Server conectado e worker registrado"
      - "NATS JetStream conectado"
      - "patient-flow API acessivel"

  ai-gateway:
    readiness_checks:
      - "PostgreSQL acessivel"
      - "Pelo menos 1 provider LLM acessivel (Anthropic ou fallback)"
      - "Guardrails configuracao carregada"
      - "prompt-registry acessivel"
      - "Token budget disponivel"

  task-inbox:
    readiness_checks:
      - "PostgreSQL acessivel"
      - "NATS JetStream conectado"
      - "WebSocket server ativo"

  velya-web:
    readiness_checks:
      - "Servidor HTTP ativo"
      - "Assets estaticos servidos corretamente"
      - "api-gateway acessivel (opcional, degrada gracefully)"
```

### Metricas e Alertas

```yaml
# Metrica: health check com detalhes de dependencias
- name: velya_health_dependency_status
  description: "Status de cada dependencia verificada pelo health check"
  type: gauge
  labels: [service, dependency, status]
  values: "1 = healthy, 0 = unhealthy"

# PromQL: Dependencia indisponivel
- alert: VelyaDependencyUnhealthy
  expr: |
    velya_health_dependency_status{status="unhealthy"} == 0
  for: 1m
  labels:
    severity: warning
  annotations:
    summary: "Dependencia {{ $labels.dependency }} do servico {{ $labels.service }} indisponivel"
    runbook: "https://runbooks.velya.internal/{{ $labels.service }}/dependency-{{ $labels.dependency }}"

# PromQL: Servico com readiness falhando
- alert: VelyaReadinessFailing
  expr: |
    kube_pod_status_ready{
      namespace=~"velya-dev-.*",
      condition="true"
    } == 0
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Pod {{ $labels.pod }} com readiness falhando por mais de 2 minutos"
    action: "Verificar logs do pod e status das dependencias"
```

---

## 3. Categoria 2: Frescor de Heartbeat

Cada servico emite um heartbeat periodico que inclui timestamp e metadados.
Se o heartbeat nao chega no tempo esperado, o servico e considerado "stale".

```yaml
heartbeat_config:
  interval: 30s
  staleness_threshold: 90s  # 3x o intervalo
  
  metric:
    name: velya_heartbeat_last_timestamp_seconds
    type: gauge
    labels: [service, instance]

  # PromQL: Heartbeat stale
  alert:
    name: VelyaHeartbeatStale
    expr: |
      time() - velya_heartbeat_last_timestamp_seconds > 90
    for: 0m  # alerta imediato
    labels:
      severity: critical
    annotations:
      summary: "Heartbeat de {{ $labels.service }} ({{ $labels.instance }}) esta stale"
      description: "Ultimo heartbeat ha {{ $value | humanizeDuration }}"
      action: "Verificar se o processo esta rodando. Possivel deadlock ou crash silencioso."

  # Implementacao no servico (TypeScript)
  code_example: |
    // Emitir heartbeat a cada 30 segundos
    import { Counter, Gauge } from 'prom-client';
    
    const heartbeatGauge = new Gauge({
      name: 'velya_heartbeat_last_timestamp_seconds',
      help: 'Timestamp do ultimo heartbeat',
      labelNames: ['service', 'instance'],
    });
    
    setInterval(() => {
      heartbeatGauge.set(
        { service: process.env.OTEL_SERVICE_NAME, instance: process.env.HOSTNAME },
        Date.now() / 1000
      );
    }, 30_000);
```

---

## 4. Categoria 3: Padroes de Watchdog

Watchdog detecta processos que param de funcionar silenciosamente (nao crasham, mas nao processam).

```yaml
watchdog_patterns:
  # Watchdog 1: Worker de fila parou de processar
  nats_consumer_watchdog:
    metric: velya_nats_messages_processed_total
    check: |
      # Se o consumer tem mensagens pendentes mas nao processa nenhuma por 5 minutos
      increase(velya_nats_messages_processed_total{service="$SERVICE"}[5m]) == 0
      AND
      nats_consumer_num_pending{stream="$STREAM", consumer="$CONSUMER"} > 0
    alert:
      name: VelyaWorkerStalled
      for: 5m
      severity: critical
      action: "Worker parou de processar mensagens. Verificar deadlock, memory leak, ou blocked I/O."

  # Watchdog 2: Temporal worker parou de executar atividades
  temporal_worker_watchdog:
    metric: temporal_activity_execution_total
    check: |
      increase(temporal_activity_execution_total{
        namespace="velya",
        task_queue=~"discharge-.*"
      }[10m]) == 0
      AND
      temporal_workflow_task_schedule_to_start_latency_count{
        namespace="velya",
        task_queue=~"discharge-.*"
      } > 0
    alert:
      name: VelyaTemporalWorkerStalled
      for: 5m
      severity: critical
      action: "Temporal worker nao esta executando atividades. Verificar conexao com Temporal Server."

  # Watchdog 3: Agente de IA parou de responder
  ai_agent_watchdog:
    metric: velya_ai_inference_total
    check: |
      increase(velya_ai_inference_total{service="ai-gateway"}[10m]) == 0
      AND
      increase(http_requests_total{service="ai-gateway"}[10m]) > 0
    alert:
      name: VelyaAIAgentStalled
      for: 5m
      severity: high
      action: "ai-gateway recebe requests mas nao faz inferencias. Verificar provider de LLM."
```

---

## 5. Categoria 4: Deteccao de Drift GitOps

```yaml
drift_detection:
  tool: "ArgoCD"
  
  # ArgoCD detecta drift automaticamente
  metric: argocd_app_info
  
  alerts:
    - name: VelyaGitOpsDriftDetected
      expr: |
        argocd_app_info{
          namespace=~"velya-dev-.*",
          sync_status="OutOfSync"
        } == 1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Drift detectado: app {{ $labels.name }} esta OutOfSync"
        action: "Verificar se houve mudanca manual. ArgoCD deve ser a unica fonte de deploy."

    - name: VelyaGitOpsDriftPersistent
      expr: |
        argocd_app_info{
          namespace=~"velya-dev-.*",
          sync_status="OutOfSync"
        } == 1
      for: 30m
      labels:
        severity: critical
      annotations:
        summary: "Drift persistente: app {{ $labels.name }} OutOfSync por mais de 30 minutos"
        action: "Drift nao foi corrigido. Possivel mudanca manual nao revertida. Investigar."

    - name: VelyaGitOpsHealthDegraded
      expr: |
        argocd_app_info{
          namespace=~"velya-dev-.*",
          health_status=~"Degraded|Missing"
        } == 1
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "App {{ $labels.name }} com health {{ $labels.health_status }}"

  # CronJob para verificacao ativa de drift
  verification_job:
    schedule: "*/10 * * * *"  # a cada 10 minutos
    checks:
      - "Comparar replicas declaradas vs replicas reais"
      - "Comparar image tags declarados vs tags rodando"
      - "Comparar ConfigMaps/Secrets declarados vs aplicados"
      - "Verificar resources nao gerenciados no namespace"
```

---

## 6. Categoria 5: Deteccao de Anomalias

```yaml
anomaly_detection:
  # Anomalia 1: Spike de requests
  request_spike:
    metric: http_requests_total
    query: |
      (
        rate(http_requests_total{service="$SERVICE"}[5m])
        /
        avg_over_time(rate(http_requests_total{service="$SERVICE"}[5m])[1h:5m])
      ) > 3
    threshold: "3x a media da ultima hora"
    alert:
      name: VelyaRequestSpike
      severity: warning
      action: "Verificar se e trafego legitimo ou ataque. Verificar logs de acesso."

  # Anomalia 2: Aumento subito de latencia
  latency_spike:
    metric: http_request_duration_seconds
    query: |
      (
        histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="$SERVICE"}[5m]))
        /
        avg_over_time(
          histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="$SERVICE"}[5m]))[1h:5m]
        )
      ) > 2
    threshold: "2x a media da ultima hora"
    alert:
      name: VelyaLatencySpike
      severity: warning

  # Anomalia 3: Mudanca no padrao de erros
  error_pattern_change:
    metric: http_requests_total
    query: |
      (
        sum(rate(http_requests_total{service="$SERVICE", status=~"5.."}[5m]))
        -
        avg_over_time(
          sum(rate(http_requests_total{service="$SERVICE", status=~"5.."}[5m]))[24h:5m]
        )
      )
      /
      stddev_over_time(
        sum(rate(http_requests_total{service="$SERVICE", status=~"5.."}[5m]))[24h:5m]
      ) > 3
    threshold: "3 desvios padrao acima da media de 24h"
    alert:
      name: VelyaErrorPatternAnomaly
      severity: warning

  # Anomalia 4: Uso de tokens de IA anomalo
  ai_token_anomaly:
    metric: velya_ai_tokens_used_total
    query: |
      sum(rate(velya_ai_tokens_used_total[5m])) * 300
      >
      3 * avg_over_time(sum(rate(velya_ai_tokens_used_total[5m]))[24h:5m]) * 300
    threshold: "3x a media de 24h"
    alert:
      name: VelyaAITokenAnomaly
      severity: high
      action: "Possivel loop de agente ou prompt injection. Verificar logs do ai-gateway."
```

---

## 7. Categoria 6: Monitoramento de SLOs

```yaml
slo_monitoring:
  patient-flow:
    availability:
      target: 99.95%
      window: 30d
      budget_total: "21.6 minutos/mes"
      
      # Error budget restante
      query_budget_remaining: |
        1 - (
          sum(rate(http_requests_total{service="patient-flow", status=~"5.."}[30d]))
          /
          sum(rate(http_requests_total{service="patient-flow"}[30d]))
        ) / (1 - 0.9995)
      
      # Burn rate (quao rapido esta queimando o budget)
      query_burn_rate_1h: |
        (
          sum(rate(http_requests_total{service="patient-flow", status=~"5.."}[1h]))
          /
          sum(rate(http_requests_total{service="patient-flow"}[1h]))
        ) / (1 - 0.9995)
      
      alerts:
        - name: VelyaSLOBudgetBurnRateCritical
          expr: |
            velya_slo_burn_rate_1h{service="patient-flow"} > 14.4
            AND
            velya_slo_burn_rate_6h{service="patient-flow"} > 6
          for: 2m
          severity: critical
          description: "Budget sera esgotado em menos de 1 hora"
          action: "Acionar on-call imediatamente. Possivel rollback necessario."

        - name: VelyaSLOBudgetBurnRateHigh
          expr: |
            velya_slo_burn_rate_1h{service="patient-flow"} > 6
            AND
            velya_slo_burn_rate_6h{service="patient-flow"} > 3
          for: 5m
          severity: warning
          description: "Budget sera esgotado em menos de 6 horas"

        - name: VelyaSLOBudgetLow
          expr: |
            velya_slo_budget_remaining_ratio{service="patient-flow"} < 0.2
          for: 0m
          severity: warning
          description: "Menos de 20% do error budget restante. Deploys bloqueados."

    latency:
      target_p99: 500ms
      window: 30d
      query: |
        histogram_quantile(0.99,
          sum(rate(http_request_duration_seconds_bucket{service="patient-flow"}[30d])) by (le)
        )
      alert:
        name: VelyaLatencySLOBreach
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket{service="patient-flow"}[1h])) by (le)
          ) > 0.5
        for: 5m
        severity: warning

  discharge-orchestrator:
    availability:
      target: 99.9%
      window: 30d
    workflow_success:
      target: 99.5%
      query: |
        sum(rate(temporal_workflow_completed_total{
          workflow_type="DischargeWorkflow", status="Completed"
        }[30d]))
        /
        sum(rate(temporal_workflow_completed_total{
          workflow_type="DischargeWorkflow"
        }[30d]))

  ai-gateway:
    availability:
      target: 99.9%
      window: 30d
    fallback_rate:
      target: "< 5%"
      query: |
        sum(rate(velya_ai_fallback_activated_total[30d]))
        /
        sum(rate(velya_ai_inference_total[30d]))
```

---

## 8. Categoria 7: Aging de Filas

```yaml
queue_aging:
  nats_jetstream:
    # Idade da mensagem mais antiga nao processada
    metric: nats_consumer_num_pending
    
    streams:
      patient-events:
        consumers:
          - patient-flow-consumer
          - discharge-orchestrator-consumer
          - notification-hub-consumer
        max_pending_age: 5m
        max_pending_count: 1000

      discharge-events:
        consumers:
          - discharge-orchestrator-consumer
        max_pending_age: 2m
        max_pending_count: 500

      task-events:
        consumers:
          - task-inbox-consumer
        max_pending_age: 5m
        max_pending_count: 2000

      ai-requests:
        consumers:
          - ai-gateway-consumer
        max_pending_age: 30s
        max_pending_count: 100

    alerts:
      - name: VelyaQueueAging
        expr: |
          nats_consumer_num_pending{
            stream=~"patient-events|discharge-events|task-events|ai-requests"
          } > 1000
        for: 5m
        severity: warning
        action: "Verificar consumer. Possivel slowdown ou consumer parado."

      - name: VelyaQueueAgingCritical
        expr: |
          time() - nats_consumer_last_delivery_timestamp{
            stream=~"patient-events|discharge-events"
          } > 300
        for: 0m
        severity: critical
        action: "Consumer nao entrega mensagens ha 5+ minutos. Verificar imediatamente."

      - name: VelyaQueueBackpressure
        expr: |
          rate(nats_consumer_num_pending{
            stream=~"patient-events|discharge-events"
          }[5m]) > 100
        for: 5m
        severity: warning
        action: "Fila crescendo rapidamente. Consumer nao acompanha producao."
```

---

## 9. Categoria 8: Rastreamento de Latencia

```yaml
latency_tracking:
  per_service:
    patient-flow:
      endpoints:
        - path: "/api/patients"
          method: "GET"
          p50_target: 50ms
          p95_target: 200ms
          p99_target: 500ms
        - path: "/api/patients"
          method: "POST"
          p50_target: 100ms
          p95_target: 300ms
          p99_target: 500ms
        - path: "/api/patients/:id/admit"
          method: "POST"
          p50_target: 200ms
          p95_target: 500ms
          p99_target: 1000ms

    ai-gateway:
      endpoints:
        - path: "/api/inference"
          method: "POST"
          p50_target: 1000ms
          p95_target: 3000ms
          p99_target: 5000ms
        - path: "/api/inference/stream"
          method: "POST"
          p50_target: 500ms  # time to first token
          p95_target: 1500ms
          p99_target: 3000ms

  # PromQL generico por servico
  queries:
    p50: |
      histogram_quantile(0.50,
        sum(rate(http_request_duration_seconds_bucket{
          service="{{ .service }}",
          path="{{ .path }}"
        }[5m])) by (le)
      )
    p95: |
      histogram_quantile(0.95,
        sum(rate(http_request_duration_seconds_bucket{
          service="{{ .service }}",
          path="{{ .path }}"
        }[5m])) by (le)
      )
    p99: |
      histogram_quantile(0.99,
        sum(rate(http_request_duration_seconds_bucket{
          service="{{ .service }}",
          path="{{ .path }}"
        }[5m])) by (le)
      )

  alerts:
    - name: VelyaLatencyP99Breach
      expr: |
        histogram_quantile(0.99,
          sum(rate(http_request_duration_seconds_bucket{
            namespace=~"velya-dev-.*"
          }[5m])) by (le, service)
        ) > on(service) group_left()
        velya_latency_target_p99_seconds
      for: 5m
      severity: warning
```

---

## 10. Categoria 9: Rastreamento de Erros

```yaml
error_tracking:
  classification:
    client_errors: "4xx (exceto 401, 403, 404, 429)"
    server_errors: "5xx"
    timeout_errors: "504, context deadline exceeded"
    dependency_errors: "erros de conexao com DB, NATS, Temporal"

  queries:
    error_rate_by_service: |
      sum(rate(http_requests_total{
        service="{{ .service }}",
        status=~"5.."
      }[5m]))
      /
      sum(rate(http_requests_total{
        service="{{ .service }}"
      }[5m]))

    error_rate_by_status_code: |
      sum(rate(http_requests_total{
        service="{{ .service }}",
        status=~"5.."
      }[5m])) by (status)

    error_breakdown_by_endpoint: |
      sum(rate(http_requests_total{
        service="{{ .service }}",
        status=~"5.."
      }[5m])) by (path, method, status)

  alerts:
    - name: VelyaErrorRateHigh
      expr: |
        (
          sum(rate(http_requests_total{
            namespace=~"velya-dev-.*",
            status=~"5.."
          }[5m])) by (service)
          /
          sum(rate(http_requests_total{
            namespace=~"velya-dev-.*"
          }[5m])) by (service)
        ) > 0.01
      for: 2m
      severity: warning
      action: "Error rate acima de 1%. Verificar logs e traces."

    - name: VelyaErrorRateCritical
      expr: |
        (
          sum(rate(http_requests_total{
            namespace=~"velya-dev-.*",
            status=~"5.."
          }[5m])) by (service)
          /
          sum(rate(http_requests_total{
            namespace=~"velya-dev-.*"
          }[5m])) by (service)
        ) > 0.05
      for: 1m
      severity: critical
      action: "Error rate acima de 5%. Possivel incidente. Verificar rollback."

    - name: VelyaNoTraffic
      expr: |
        sum(rate(http_requests_total{
          service=~"patient-flow|discharge-orchestrator|task-inbox",
          namespace=~"velya-dev-.*"
        }[5m])) by (service) == 0
      for: 5m
      severity: critical
      action: "Servico nao recebe trafego. Verificar Ingress, Service e pods."
```

---

## 11. Categoria 10: Rastreamento de Saturacao

```yaml
saturation_tracking:
  cpu:
    query: |
      sum(rate(container_cpu_usage_seconds_total{
        namespace=~"velya-dev-.*",
        container!=""
      }[5m])) by (pod, namespace)
      /
      sum(kube_pod_container_resource_limits{
        namespace=~"velya-dev-.*",
        resource="cpu"
      }) by (pod, namespace)
    alert_threshold: 0.80
    critical_threshold: 0.95
    alert:
      name: VelyaCPUSaturation
      severity: warning

  memory:
    query: |
      sum(container_memory_working_set_bytes{
        namespace=~"velya-dev-.*",
        container!=""
      }) by (pod, namespace)
      /
      sum(kube_pod_container_resource_limits{
        namespace=~"velya-dev-.*",
        resource="memory"
      }) by (pod, namespace)
    alert_threshold: 0.80
    critical_threshold: 0.95
    alert:
      name: VelyaMemorySaturation
      severity: warning

  connections:
    # Conexoes de banco de dados
    db_connections:
      query: |
        velya_db_pool_active_connections{service="{{ .service }}"}
        /
        velya_db_pool_max_connections{service="{{ .service }}"}
      alert_threshold: 0.75
      alert:
        name: VelyaDBConnectionPoolSaturation
        severity: warning
        action: "Pool de conexoes quase esgotado. Verificar leaks ou queries lentas."

    # Conexoes NATS
    nats_connections:
      query: |
        nats_server_connections{namespace="velya-dev-platform"}
        /
        nats_server_max_connections{namespace="velya-dev-platform"}
      alert_threshold: 0.70

  disk:
    query: |
      (
        kubelet_volume_stats_capacity_bytes{namespace=~"velya-dev-.*"}
        -
        kubelet_volume_stats_available_bytes{namespace=~"velya-dev-.*"}
      )
      /
      kubelet_volume_stats_capacity_bytes{namespace=~"velya-dev-.*"}
    alert_threshold: 0.80
    critical_threshold: 0.90
```

---

## 12. Categoria 11: Visibilidade de DLQ

```yaml
dlq_monitoring:
  nats_jetstream:
    # Mensagens que falharam apos max retries vao para DLQ
    streams:
      - name: "patient-events-dlq"
        source_stream: "patient-events"
        max_retries_before_dlq: 5
      - name: "discharge-events-dlq"
        source_stream: "discharge-events"
        max_retries_before_dlq: 3
      - name: "task-events-dlq"
        source_stream: "task-events"
        max_retries_before_dlq: 5

    metric:
      name: velya_dlq_messages_total
      type: counter
      labels: [stream, source_stream, error_type]

    query_dlq_count: |
      sum(nats_stream_messages_total{stream=~".*-dlq"}) by (stream)

    alerts:
      - name: VelyaDLQNotEmpty
        expr: |
          nats_stream_messages_total{stream=~".*-dlq"} > 0
        for: 0m
        severity: warning
        action: |
          DLQ tem mensagens. Investigar:
          1. Verificar tipo de erro nos headers da mensagem
          2. Verificar se e transitorio (retry manual) ou permanente (bug)
          3. Se permanente, criar ticket e corrigir handler
          4. Reprocessar mensagens apos correcao

      - name: VelyaDLQGrowing
        expr: |
          rate(nats_stream_messages_total{stream=~".*-dlq"}[5m]) > 0
        for: 10m
        severity: critical
        action: "DLQ crescendo ativamente. Problema sistematico. Investigar handler imediatamente."

    # CronJob para alertar sobre mensagens antigas na DLQ
    stale_dlq_check:
      schedule: "0 */6 * * *"  # a cada 6 horas
      max_message_age: 24h
      action: "Se mensagem na DLQ por mais de 24h sem ticket, criar ticket automaticamente"
```

---

## 13. Categoria 12: Saude de Schedules e Fallbacks

```yaml
schedule_health:
  # Verificar que CronJobs executaram no tempo esperado
  cronjobs:
    - name: "velya-cleanup-expired-sessions"
      namespace: "velya-dev-platform"
      expected_schedule: "0 */4 * * *"  # a cada 4h
      max_duration: 300s
      alert_if_missed: true

    - name: "velya-slo-report"
      namespace: "velya-dev-observability"
      expected_schedule: "0 8 * * *"  # diariamente as 8h
      max_duration: 60s
      alert_if_missed: true

    - name: "velya-healing-budget-reset"
      namespace: "velya-dev-platform"
      expected_schedule: "0 * * * *"  # a cada hora
      max_duration: 30s
      alert_if_missed: true

  alerts:
    - name: VelyaCronJobMissed
      expr: |
        time() - kube_cronjob_status_last_schedule_time{
          namespace=~"velya-dev-.*"
        } > 2 * kube_cronjob_spec_schedule_interval_seconds
      for: 0m
      severity: warning
      action: "CronJob nao executou no horario esperado."

    - name: VelyaCronJobFailed
      expr: |
        kube_job_status_failed{namespace=~"velya-dev-.*"} > 0
      for: 0m
      severity: warning

fallback_monitoring:
  # Monitorar quando fallbacks sao ativados
  circuit_breakers:
    metric: velya_circuit_breaker_state
    labels: [service, dependency, state]
    states: [closed, half_open, open]
    
    alert:
      name: VelyaCircuitBreakerOpen
      expr: |
        velya_circuit_breaker_state{state="open"} == 1
      for: 0m
      severity: high
      action: |
        Circuit breaker aberto para {{ $labels.dependency }}.
        Servico {{ $labels.service }} esta em modo de fallback.
        Verificar saude da dependencia.

  fallback_activation:
    metric: velya_fallback_activated_total
    labels: [service, fallback_type, reason]
    
    alert:
      name: VelyaFallbackActivated
      expr: |
        increase(velya_fallback_activated_total[5m]) > 0
      for: 0m
      severity: warning
      action: "Fallback ativado. Verificar servico primario."

    alert_sustained:
      name: VelyaFallbackSustained
      expr: |
        velya_fallback_active{service=~".*"} == 1
      for: 15m
      severity: high
      action: "Fallback ativo por mais de 15 minutos. Dependencia pode estar com problema persistente."
```

---

## 14. Dashboard Grafana - Visao Consolidada

```json
{
  "dashboard": {
    "title": "Velya Runtime Integrity",
    "uid": "velya-runtime-integrity",
    "rows": [
      {
        "title": "Saude Geral",
        "panels": [
          { "title": "Servicos Saudaveis", "type": "stat", "query": "count(up{namespace=~'velya-dev-.*'} == 1)" },
          { "title": "Servicos com Problema", "type": "stat", "query": "count(up{namespace=~'velya-dev-.*'} == 0)" },
          { "title": "Alertas Ativos", "type": "stat", "query": "count(ALERTS{namespace=~'velya-dev-.*', alertstate='firing'})" },
          { "title": "SLO Budget Restante", "type": "gauge", "query": "min(velya_slo_budget_remaining_ratio)" }
        ]
      },
      {
        "title": "Error Rate por Servico",
        "panels": [
          { "title": "Error Rate", "type": "timeseries", "query": "sum(rate(http_requests_total{namespace=~'velya-dev-.*', status=~'5..'}[5m])) by (service) / sum(rate(http_requests_total{namespace=~'velya-dev-.*'}[5m])) by (service)" }
        ]
      },
      {
        "title": "Latencia P99 por Servico",
        "panels": [
          { "title": "P99 Latency", "type": "timeseries", "query": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{namespace=~'velya-dev-.*'}[5m])) by (le, service))" }
        ]
      },
      {
        "title": "Filas e DLQ",
        "panels": [
          { "title": "Mensagens Pendentes", "type": "timeseries", "query": "nats_consumer_num_pending{stream=~'patient-events|discharge-events|task-events|ai-requests'}" },
          { "title": "Mensagens em DLQ", "type": "stat", "query": "sum(nats_stream_messages_total{stream=~'.*-dlq'}) by (stream)" }
        ]
      },
      {
        "title": "Saturacao",
        "panels": [
          { "title": "CPU Usage", "type": "timeseries", "query": "sum(rate(container_cpu_usage_seconds_total{namespace=~'velya-dev-.*'}[5m])) by (pod) / sum(kube_pod_container_resource_limits{namespace=~'velya-dev-.*', resource='cpu'}) by (pod)" },
          { "title": "Memory Usage", "type": "timeseries", "query": "sum(container_memory_working_set_bytes{namespace=~'velya-dev-.*'}) by (pod) / sum(kube_pod_container_resource_limits{namespace=~'velya-dev-.*', resource='memory'}) by (pod)" }
        ]
      }
    ]
  }
}
```

---

## 15. Documentos Relacionados

| Documento | Descricao |
|---|---|
| `layered-assurance-model.md` | Modelo completo (L6 = Runtime) |
| `auto-remediation-safety-model.md` | Acoes de resposta a alertas |
| `self-healing-model.md` | Self-healing automatico |
| `progressive-delivery-strategy.md` | Analysis templates durante rollout |
