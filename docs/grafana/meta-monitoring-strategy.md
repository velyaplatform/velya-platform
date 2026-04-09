# Estrategia de Meta-Monitoramento - Monitorar o Monitoramento

## Visao Geral

Meta-monitoramento e a pratica de monitorar a propria infraestrutura de observabilidade. Na plataforma Velya, isso significa garantir que Grafana, Prometheus, Loki, Tempo, Pyroscope e os coletores (Alloy/OTel) estejam saudaveis, performando adequadamente e ingerindo dados corretamente.

Um sistema de monitoramento que falha silenciosamente e pior do que nao ter monitoramento - voce acredita que esta monitorado, mas nao esta.

---

## Componentes Monitorados

```
+--------------------------------------------------------------------+
|                     Meta-Monitoramento Velya                        |
+--------------------------------------------------------------------+
|                                                                      |
|  +----------+  +----------+  +-------+  +---------+  +----------+  |
|  | Grafana  |  |Prometheus|  | Loki  |  |  Tempo  |  | Pyroscope|  |
|  +----------+  +----------+  +-------+  +---------+  +----------+  |
|  | Health   |  | Scrape   |  | Ingest|  | Ingest  |  | Ingest   |  |
|  | Memory   |  | TSDB     |  | Query |  | Query   |  | Query    |  |
|  | CPU      |  | WAL      |  | Store |  | Compact |  | Storage  |  |
|  | Queries  |  | Compact  |  | Rules |  | Flush   |  | Memory   |  |
|  | Sessions |  | Rules    |  | Tail  |  | Search  |  |          |  |
|  +----------+  +----------+  +-------+  +---------+  +----------+  |
|                                                                      |
|  +------------------+  +------------------+                          |
|  | Alloy/OTel       |  | Alerting Engine  |                         |
|  | Collector        |  |                  |                          |
|  +------------------+  +------------------+                          |
|  | Pipeline health  |  | Eval errors      |                         |
|  | Export rate      |  | No-data alerts   |                         |
|  | Drop rate        |  | Pending alerts   |                         |
|  | Buffer usage     |  | Notification     |                         |
|  +------------------+  +------------------+                          |
+--------------------------------------------------------------------+
```

---

## 1. Grafana Health

### Metricas Essenciais

```promql
# Grafana esta UP
up{job="grafana"} == 1

# Uso de memoria do Grafana
process_resident_memory_bytes{job="grafana"} / 1024 / 1024

# Uso de CPU
rate(process_cpu_seconds_total{job="grafana"}[5m])

# Latencia de query ao datasource (P95)
histogram_quantile(0.95,
  rate(grafana_datasource_request_duration_seconds_bucket{job="grafana"}[5m])
)

# Erros de query ao datasource
rate(grafana_datasource_request_total{job="grafana", status="error"}[5m])

# Total de sessoes ativas
grafana_stat_active_users

# Latencia de API HTTP (P95)
histogram_quantile(0.95,
  rate(grafana_http_request_duration_seconds_bucket{job="grafana"}[5m])
)

# Erros HTTP 5xx
rate(grafana_http_request_duration_seconds_count{job="grafana", status_code=~"5.."}[5m])

# Alerting engine: erros de avaliacao
grafana_alerting_rule_evaluation_failures_total

# Dashboards carregados
grafana_stat_total_dashboards
```

### Alertas Grafana

```yaml
- alert: GrafanaDown
  expr: up{job="grafana"} == 0
  for: 1m
  labels:
    severity: critical
    team: platform
  annotations:
    summary: "Grafana esta indisponivel"
    runbook_url: "https://docs.velya.health/runbooks/grafana-down"

- alert: GrafanaHighMemory
  expr: process_resident_memory_bytes{job="grafana"} / 1024 / 1024 > 2048
  for: 10m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Grafana usando {{ $value }}MB de memoria"

- alert: GrafanaDatasourceErrors
  expr: rate(grafana_datasource_request_total{status="error"}[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Erros de query ao datasource {{ $labels.datasource }}"

- alert: GrafanaHighQueryLatency
  expr: |
    histogram_quantile(0.95,
      rate(grafana_datasource_request_duration_seconds_bucket[5m])
    ) > 10
  for: 10m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "P95 de latencia de query do Grafana acima de 10s"
```

---

## 2. Prometheus Health

### Metricas Essenciais

```promql
# Prometheus UP
up{job="prometheus"} == 1

# Taxa de sucesso de scrape
sum(up{job=~"velya-.*"}) / count(up{job=~"velya-.*"}) * 100

# Targets com scrape falhando
count(up{job=~"velya-.*"} == 0)

# Duracao de scrape (P95)
histogram_quantile(0.95,
  rate(prometheus_target_scrape_pool_exceeded_target_limit_total[5m])
)

# TSDB head series (cardinalidade)
prometheus_tsdb_head_series

# TSDB blocks carregados
prometheus_tsdb_blocks_loaded

# WAL corruptions
prometheus_tsdb_wal_corruptions_total

# Compaction duration
prometheus_tsdb_compaction_duration_seconds_sum

# Compaction failures
prometheus_tsdb_compactions_failed_total

# Storage size
prometheus_tsdb_storage_blocks_bytes

# Query duration (P95)
histogram_quantile(0.95,
  rate(prometheus_engine_query_duration_seconds_bucket[5m])
)

# Queries rejeitadas
prometheus_engine_queries_concurrent_max - prometheus_engine_queries

# Samples ingeridos por segundo
rate(prometheus_tsdb_head_samples_appended_total[5m])

# Scrape errors
rate(prometheus_target_scrapes_sample_duplicate_timestamp_total[5m])

# Rule evaluation duration
histogram_quantile(0.95,
  rate(prometheus_rule_evaluation_duration_seconds_bucket[5m])
)

# Rule evaluation failures
increase(prometheus_rule_evaluation_failures_total[5m])

# Remote write (se habilitado)
rate(prometheus_remote_storage_samples_total[5m])
prometheus_remote_storage_samples_failed_total
```

### Alertas Prometheus

```yaml
- alert: PrometheusDown
  expr: up{job="prometheus"} == 0
  for: 1m
  labels:
    severity: critical
    team: platform
  annotations:
    summary: "Prometheus esta indisponivel"

- alert: PrometheusScrapeFailures
  expr: |
    (count(up == 0) / count(up)) * 100 > 10
  for: 5m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "{{ $value }}% dos targets de scrape estao falhando"

- alert: PrometheusHighCardinality
  expr: prometheus_tsdb_head_series > 1000000
  for: 30m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Prometheus com {{ $value }} series ativas (alta cardinalidade)"

- alert: PrometheusWALCorruption
  expr: increase(prometheus_tsdb_wal_corruptions_total[1h]) > 0
  labels:
    severity: critical
    team: platform
  annotations:
    summary: "Corrupcao detectada no WAL do Prometheus"

- alert: PrometheusCompactionFailed
  expr: increase(prometheus_tsdb_compactions_failed_total[1h]) > 0
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Falha de compaction no Prometheus"

- alert: PrometheusStorageNearFull
  expr: |
    predict_linear(prometheus_tsdb_storage_blocks_bytes[6h], 24*3600) >
    (prometheus_tsdb_retention_limit_bytes * 0.9)
  for: 1h
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Storage do Prometheus proximo do limite"

- alert: PrometheusRuleEvaluationSlow
  expr: |
    histogram_quantile(0.95,
      rate(prometheus_rule_evaluation_duration_seconds_bucket[5m])
    ) > 10
  for: 10m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Avaliacao de regras lenta no Prometheus"
```

---

## 3. Loki Health

### Metricas Essenciais

```promql
# Loki UP
up{job="loki"} == 1

# Taxa de ingestao (logs/s)
rate(loki_distributor_lines_received_total[5m])

# Bytes ingeridos por segundo
rate(loki_distributor_bytes_received_total[5m])

# Erros de ingestao
rate(loki_request_duration_seconds_count{method="POST", route="loki_api_v1_push", status_code=~"5.."}[5m])

# Query latency (P95)
histogram_quantile(0.95,
  rate(loki_request_duration_seconds_bucket{method="GET", route=~"loki_api_v1_query.*"}[5m])
)

# Chunks stored
loki_ingester_chunks_stored_total

# Chunk store errors
rate(loki_chunk_store_index_entries_per_chunk_count[5m])

# Streams ativos
loki_ingester_streams_created_total - loki_ingester_streams_removed_total

# Rate limiting
rate(loki_distributor_lines_received_total{status="rate_limited"}[5m])

# Tailer ativos
loki_ingester_tailers_current
```

### Alertas Loki

```yaml
- alert: LokiDown
  expr: up{job="loki"} == 0
  for: 1m
  labels:
    severity: critical
    team: platform
  annotations:
    summary: "Loki esta indisponivel"

- alert: LokiIngestionDrop
  expr: |
    rate(loki_distributor_lines_received_total[5m]) <
    (rate(loki_distributor_lines_received_total[5m] offset 1h) * 0.5)
  for: 15m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Taxa de ingestao do Loki caiu mais de 50%"

- alert: LokiHighQueryLatency
  expr: |
    histogram_quantile(0.95,
      rate(loki_request_duration_seconds_bucket{route=~"loki_api_v1_query.*"}[5m])
    ) > 30
  for: 10m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "P95 de latencia de query do Loki acima de 30s"

- alert: LokiIngestionErrors
  expr: |
    rate(loki_request_duration_seconds_count{route="loki_api_v1_push", status_code=~"5.."}[5m]) > 0
  for: 5m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Erros de ingestao no Loki"

- alert: LokiRateLimited
  expr: rate(loki_distributor_lines_received_total{status="rate_limited"}[5m]) > 0
  for: 5m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Loki esta rate limiting ingestao"
```

---

## 4. Tempo Health

### Metricas Essenciais

```promql
# Tempo UP
up{job="tempo"} == 1

# Spans ingeridos por segundo
rate(tempo_distributor_spans_received_total[5m])

# Bytes ingeridos
rate(tempo_distributor_bytes_received_total[5m])

# Erros de ingestao
rate(tempo_request_duration_seconds_count{method="POST", route="/tempo.Pusher/PushBytesV2", status_code=~"5.."}[5m])

# Query latency
histogram_quantile(0.95,
  rate(tempo_request_duration_seconds_bucket{route=~"/tempo.*query.*|/api/.*"}[5m])
)

# Compaction
rate(tempo_compactor_bytes_written_total[5m])
tempo_compactor_outstanding_blocks

# Flush duration
histogram_quantile(0.95,
  rate(tempo_ingester_flush_duration_seconds_bucket[5m])
)

# Live traces
tempo_ingester_live_traces
```

### Alertas Tempo

```yaml
- alert: TempoDown
  expr: up{job="tempo"} == 0
  for: 1m
  labels:
    severity: critical
    team: platform
  annotations:
    summary: "Tempo esta indisponivel"

- alert: TempoIngestionDrop
  expr: |
    rate(tempo_distributor_spans_received_total[5m]) <
    (rate(tempo_distributor_spans_received_total[5m] offset 1h) * 0.5)
  for: 15m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Taxa de ingestao do Tempo caiu mais de 50%"

- alert: TempoCompactionBacklog
  expr: tempo_compactor_outstanding_blocks > 100
  for: 30m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Backlog de compaction do Tempo com {{ $value }} blocos pendentes"

- alert: TempoHighQueryLatency
  expr: |
    histogram_quantile(0.95,
      rate(tempo_request_duration_seconds_bucket{route=~"/api/.*"}[5m])
    ) > 15
  for: 10m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "P95 de query do Tempo acima de 15s"
```

---

## 5. Alerting Health

### Metricas Essenciais

```promql
# Erros de avaliacao de regras
grafana_alerting_rule_evaluation_failures_total

# Alertas no estado no-data
count(ALERTS{alertstate="pending", alertname=~".*NoData.*"})

# Alertas pendentes (possivel problema de avaliacao)
count(ALERTS{alertstate="pending"})

# Tempo de avaliacao de regras
histogram_quantile(0.95,
  rate(grafana_alerting_rule_evaluation_duration_seconds_bucket[5m])
)

# Notificacoes falhadas
grafana_alerting_notification_failed_total

# Silences ativos
alertmanager_silences_active_total
```

### Alertas do Alerting

```yaml
- alert: AlertEvaluationErrors
  expr: increase(grafana_alerting_rule_evaluation_failures_total[5m]) > 0
  for: 10m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Erros na avaliacao de regras de alerta"

- alert: AlertNotificationFailures
  expr: increase(grafana_alerting_notification_failed_total[5m]) > 0
  for: 5m
  labels:
    severity: critical
    team: platform
  annotations:
    summary: "Falha no envio de notificacoes de alerta"

- alert: TooManyPendingAlerts
  expr: count(ALERTS{alertstate="pending"}) > 20
  for: 30m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "{{ $value }} alertas no estado pending por mais de 30 minutos"
```

---

## 6. Alloy/OTel Collector Health

### Metricas Essenciais

```promql
# Alloy UP
up{job="alloy"} == 1

# Metricas exportadas/s
rate(otelcol_exporter_sent_metric_points_total[5m])

# Logs exportados/s
rate(otelcol_exporter_sent_log_records_total[5m])

# Spans exportados/s
rate(otelcol_exporter_sent_spans_total[5m])

# Metricas dropadas
rate(otelcol_processor_dropped_metric_points_total[5m])

# Logs dropados
rate(otelcol_processor_dropped_log_records_total[5m])

# Spans dropados
rate(otelcol_processor_dropped_spans_total[5m])

# Erros de exportacao
rate(otelcol_exporter_send_failed_metric_points_total[5m])
rate(otelcol_exporter_send_failed_log_records_total[5m])
rate(otelcol_exporter_send_failed_spans_total[5m])

# Buffer/queue usage
otelcol_exporter_queue_size / otelcol_exporter_queue_capacity * 100

# Receiver accepted/refused
rate(otelcol_receiver_accepted_metric_points_total[5m])
rate(otelcol_receiver_refused_metric_points_total[5m])
```

### Alertas Alloy

```yaml
- alert: AlloyCollectorDown
  expr: up{job="alloy"} == 0
  for: 2m
  labels:
    severity: critical
    team: platform
  annotations:
    summary: "Alloy collector esta indisponivel"

- alert: AlloyHighDropRate
  expr: |
    (
      rate(otelcol_processor_dropped_metric_points_total[5m]) +
      rate(otelcol_processor_dropped_log_records_total[5m]) +
      rate(otelcol_processor_dropped_spans_total[5m])
    ) > 100
  for: 5m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Alloy dropando dados - {{ $value }} itens/s"

- alert: AlloyExportErrors
  expr: |
    (
      rate(otelcol_exporter_send_failed_metric_points_total[5m]) +
      rate(otelcol_exporter_send_failed_log_records_total[5m]) +
      rate(otelcol_exporter_send_failed_spans_total[5m])
    ) > 0
  for: 5m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Alloy com erros de exportacao"

- alert: AlloyQueueNearFull
  expr: otelcol_exporter_queue_size / otelcol_exporter_queue_capacity * 100 > 80
  for: 5m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Queue do Alloy em {{ $value }}% de capacidade"
```

---

## Regras Consolidadas

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-meta-monitoring
  namespace: velya-observability
  labels:
    app: velya-meta-monitoring
    prometheus: velya
spec:
  groups:
  - name: meta-monitoring-grafana
    interval: 30s
    rules:
    # Recording rules para simplificar alertas
    - record: velya:grafana:up
      expr: up{job="grafana"}
    - record: velya:grafana:memory_mb
      expr: process_resident_memory_bytes{job="grafana"} / 1024 / 1024
    - record: velya:grafana:query_error_rate
      expr: rate(grafana_datasource_request_total{status="error"}[5m])

  - name: meta-monitoring-prometheus
    interval: 30s
    rules:
    - record: velya:prometheus:scrape_success_rate
      expr: sum(up{job=~"velya-.*"}) / count(up{job=~"velya-.*"}) * 100
    - record: velya:prometheus:head_series
      expr: prometheus_tsdb_head_series
    - record: velya:prometheus:ingestion_rate
      expr: rate(prometheus_tsdb_head_samples_appended_total[5m])

  - name: meta-monitoring-loki
    interval: 30s
    rules:
    - record: velya:loki:ingestion_rate
      expr: rate(loki_distributor_lines_received_total[5m])
    - record: velya:loki:query_latency_p95
      expr: |
        histogram_quantile(0.95,
          rate(loki_request_duration_seconds_bucket{route=~"loki_api_v1_query.*"}[5m]))

  - name: meta-monitoring-tempo
    interval: 30s
    rules:
    - record: velya:tempo:ingestion_rate
      expr: rate(tempo_distributor_spans_received_total[5m])

  - name: meta-monitoring-alloy
    interval: 30s
    rules:
    - record: velya:alloy:total_export_rate
      expr: |
        rate(otelcol_exporter_sent_metric_points_total[5m]) +
        rate(otelcol_exporter_sent_log_records_total[5m]) +
        rate(otelcol_exporter_sent_spans_total[5m])
    - record: velya:alloy:total_drop_rate
      expr: |
        rate(otelcol_processor_dropped_metric_points_total[5m]) +
        rate(otelcol_processor_dropped_log_records_total[5m]) +
        rate(otelcol_processor_dropped_spans_total[5m])
```

---

## Dashboard de Meta-Monitoramento

```json
{
  "dashboard": {
    "uid": "velya-meta-monitoring",
    "title": "Velya - Meta-Monitoramento da Stack de Observabilidade",
    "tags": ["velya", "meta-monitoring", "observability", "critical"],
    "description": "Monitora a saude de toda a stack de observabilidade: Grafana, Prometheus, Loki, Tempo, Pyroscope, Alloy",
    "panels": [
      {
        "title": "Status Geral dos Componentes",
        "type": "stat",
        "gridPos": {"h": 4, "w": 24, "x": 0, "y": 0},
        "targets": [
          {"expr": "up{job=\"grafana\"}", "legendFormat": "Grafana"},
          {"expr": "up{job=\"prometheus\"}", "legendFormat": "Prometheus"},
          {"expr": "up{job=\"loki\"}", "legendFormat": "Loki"},
          {"expr": "up{job=\"tempo\"}", "legendFormat": "Tempo"},
          {"expr": "up{job=\"pyroscope\"}", "legendFormat": "Pyroscope"},
          {"expr": "up{job=\"alloy\"}", "legendFormat": "Alloy"}
        ],
        "fieldConfig": {
          "defaults": {
            "mappings": [
              {"type": "value", "options": {"0": {"text": "DOWN", "color": "red"}}},
              {"type": "value", "options": {"1": {"text": "UP", "color": "green"}}}
            ]
          }
        }
      },
      {
        "title": "Prometheus - Scrape Success Rate",
        "type": "gauge",
        "gridPos": {"h": 6, "w": 6, "x": 0, "y": 4},
        "targets": [
          {"expr": "velya:prometheus:scrape_success_rate", "legendFormat": "Success %"}
        ],
        "fieldConfig": {"defaults": {"unit": "percent", "min": 0, "max": 100}}
      },
      {
        "title": "Prometheus - Head Series (Cardinalidade)",
        "type": "stat",
        "gridPos": {"h": 6, "w": 6, "x": 6, "y": 4},
        "targets": [
          {"expr": "velya:prometheus:head_series", "legendFormat": "Series"}
        ]
      },
      {
        "title": "Loki - Ingestion Rate (logs/s)",
        "type": "timeseries",
        "gridPos": {"h": 6, "w": 6, "x": 12, "y": 4},
        "targets": [
          {"expr": "velya:loki:ingestion_rate", "legendFormat": "logs/s"}
        ]
      },
      {
        "title": "Tempo - Ingestion Rate (spans/s)",
        "type": "timeseries",
        "gridPos": {"h": 6, "w": 6, "x": 18, "y": 4},
        "targets": [
          {"expr": "velya:tempo:ingestion_rate", "legendFormat": "spans/s"}
        ]
      },
      {
        "title": "Alloy - Export vs Drop Rate",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 10},
        "targets": [
          {"expr": "velya:alloy:total_export_rate", "legendFormat": "Exported/s"},
          {"expr": "velya:alloy:total_drop_rate", "legendFormat": "Dropped/s"}
        ]
      },
      {
        "title": "Grafana - Query Latency & Errors",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 10},
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(grafana_datasource_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95 Latency (s)"
          },
          {
            "expr": "rate(grafana_datasource_request_total{status=\"error\"}[5m])",
            "legendFormat": "Errors/s"
          }
        ]
      },
      {
        "title": "Prometheus - TSDB & Storage",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 18},
        "targets": [
          {"expr": "prometheus_tsdb_storage_blocks_bytes / 1024 / 1024 / 1024", "legendFormat": "Storage (GB)"},
          {"expr": "velya:prometheus:ingestion_rate", "legendFormat": "Samples/s"}
        ]
      },
      {
        "title": "Alertas Ativos por Estado",
        "type": "bargauge",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 18},
        "targets": [
          {"expr": "count by (alertstate) (ALERTS)", "legendFormat": "{{ alertstate }}"}
        ]
      }
    ]
  }
}
```

---

## Checklist de Meta-Monitoramento

| Componente   | Metrica Chave                     | Threshold OK        | Frequencia de Verificacao |
|-------------|-----------------------------------|---------------------|---------------------------|
| Grafana     | up                                | == 1                | 30s                       |
| Grafana     | Memoria                           | < 2GB               | 1m                        |
| Grafana     | Query latency P95                 | < 10s               | 1m                        |
| Prometheus  | up                                | == 1                | 30s                       |
| Prometheus  | Scrape success rate               | > 95%               | 1m                        |
| Prometheus  | Head series                       | < 1M                | 5m                        |
| Prometheus  | WAL corruptions                   | == 0                | 1m                        |
| Loki        | up                                | == 1                | 30s                       |
| Loki        | Ingestion rate                    | > 0                 | 1m                        |
| Loki        | Query latency P95                 | < 30s               | 1m                        |
| Tempo       | up                                | == 1                | 30s                       |
| Tempo       | Ingestion rate                    | > 0                 | 1m                        |
| Tempo       | Compaction backlog                | < 100 blocos        | 5m                        |
| Alloy       | up                                | == 1                | 30s                       |
| Alloy       | Drop rate                         | < 1%                | 1m                        |
| Alloy       | Queue usage                       | < 80%               | 1m                        |
| Alerting    | Eval failures                     | == 0                | 1m                        |
| Alerting    | Notification failures             | == 0                | 1m                        |
