# Observabilidade de Pressão de Runtime — Velya

**Versão:** 1.0  
**Domínio:** Observabilidade e Monitoramento  
**Classificação:** Documento de Referência Técnica  
**Data:** 2026-04-08

---

## Mandato

> **Pressão de runtime é sempre visível antes de virar incidente. Na Velya, nenhuma degradação é silenciosa. Cada camada tem suas métricas, seus alertas e seu painel — do nó ao pod, do namespace ao workload.**

---

## Arquitetura de Observabilidade

```
┌──────────────────────────────────────────────────────────────┐
│  Fontes de Dados                                             │
│  ├── cAdvisor         → CPU, Memory, Network por container  │
│  ├── kube-state-metrics → Estado de recursos K8s            │
│  ├── NATS Monitoring  → Queue depth, consumer lag           │
│  ├── Temporal Metrics → Workflow state, activity results    │
│  ├── NGINX Ingress    → RPS, latência, error rate           │
│  ├── Node Exporter    → CPU, Memory, Disk, Network por nó   │
│  └── Custom (apps)    → Métricas de negócio                 │
│                                                              │
│  Coleta: Prometheus (scrape 15s)                            │
│  Logs: Fluentbit → Loki                                     │
│  Traces: OpenTelemetry SDK → Tempo                          │
│  Alertas: Alertmanager → Slack / PagerDuty                  │
│  Dashboards: Grafana                                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Camada 1: Nó (Node)

### Métricas Principais

| Métrica | Instrumento | Query |
|---|---|---|
| CPU utilization | node-exporter | `1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))` |
| Memory utilization | node-exporter | `1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)` |
| Network receive | node-exporter | `rate(node_network_receive_bytes_total[5m])` |
| Network transmit | node-exporter | `rate(node_network_transmit_bytes_total[5m])` |
| Disk I/O utilization | node-exporter | `rate(node_disk_io_time_seconds_total[5m])` |
| Node evictions | kube-state-metrics | `kube_node_status_condition{condition="MemoryPressure",status="true"}` |
| OOM kills | cAdvisor | `increase(container_oom_events_total[5m])` |

### Alertas Prometheus — Camada Nó

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-node-pressure-alerts
  namespace: velya-dev-observability
  labels:
    prometheus: kube-prometheus
    role: alert-rules
spec:
  groups:
  - name: node-pressure
    rules:
    
    - alert: NodeCPUPressureHigh
      expr: |
        (1 - avg by (node) (
          rate(node_cpu_seconds_total{mode="idle"}[5m])
        )) > 0.85
      for: 10m
      labels:
        severity: warning
        layer: node
      annotations:
        summary: "Nó {{ $labels.node }} com CPU acima de 85%"
        description: "Utilização atual: {{ $value | humanizePercentage }}. Possível necessidade de provisionar novo nó."
        runbook: "docs/scaling/autoscaling-failure-modes.md#fm-04"
    
    - alert: NodeMemoryPressureHigh
      expr: |
        (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.85
      for: 5m
      labels:
        severity: warning
        layer: node
      annotations:
        summary: "Nó {{ $labels.instance }} com memória acima de 85%"
        description: "Memória disponível: {{ $value | humanize }}B"
    
    - alert: NodeMemoryPressureCritical
      expr: |
        (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.95
      for: 2m
      labels:
        severity: critical
        layer: node
      annotations:
        summary: "CRÍTICO: Nó {{ $labels.instance }} com memória acima de 95%"
    
    - alert: NodeDiskPressureHigh
      expr: |
        (node_filesystem_size_bytes{mountpoint="/"} - node_filesystem_free_bytes{mountpoint="/"}) /
        node_filesystem_size_bytes{mountpoint="/"} > 0.80
      for: 5m
      labels:
        severity: warning
        layer: node
      annotations:
        summary: "Disco do nó {{ $labels.instance }} acima de 80%"
    
    - alert: NodeNetworkSaturation
      expr: |
        rate(node_network_receive_bytes_total[5m]) > 900000000   # 900 MB/s (perto de 1 Gbps)
      for: 5m
      labels:
        severity: warning
        layer: node
      annotations:
        summary: "Nó {{ $labels.instance }} com saturaçao de rede"
    
    - alert: NodeEvictionRisk
      expr: |
        kube_node_status_condition{
          condition="MemoryPressure",
          status="true"
        } == 1
      for: 1m
      labels:
        severity: critical
        layer: node
      annotations:
        summary: "Nó {{ $labels.node }} em MemoryPressure — evicção de pods iminente"
```

---

## Camada 2: Pod

### Métricas Principais

| Métrica | Instrumento | Query |
|---|---|---|
| Pod churn rate | kube-state-metrics | `rate(kube_pod_status_phase{phase="Failed"}[5m])` |
| Startup latency | kubelet | `kubelet_pod_worker_start_duration_seconds` |
| Readiness lag | kube-state-metrics | `kube_pod_status_ready{condition="false"}` |
| Container restarts | kube-state-metrics | `kube_pod_container_status_restarts_total` |
| CPU throttling | cAdvisor | `rate(container_cpu_cfs_throttled_seconds_total[5m])` |
| OOM events | cAdvisor | `container_oom_events_total` |

### Alertas Prometheus — Camada Pod

```yaml
- name: pod-pressure
  rules:
  
  - alert: PodCrashLooping
    expr: |
      rate(kube_pod_container_status_restarts_total{
        namespace=~"velya-.*"
      }[15m]) * 60 * 15 > 5
    for: 5m
    labels:
      severity: warning
      layer: pod
    annotations:
      summary: "Pod {{ $labels.namespace }}/{{ $labels.pod }} em CrashLoop"
      description: "Mais de 5 restarts em 15 minutos"
  
  - alert: PodStartupLatencyHigh
    expr: |
      histogram_quantile(0.95,
        rate(kubelet_pod_worker_start_duration_seconds_bucket{
          namespace=~"velya-.*"
        }[10m])
      ) > 60
    for: 5m
    labels:
      severity: warning
      layer: pod
    annotations:
      summary: "P95 de startup de pods > 60s no namespace {{ $labels.namespace }}"
  
  - alert: PodReadinessLagHigh
    expr: |
      count by (namespace, deployment) (
        kube_pod_status_ready{
          condition="false",
          namespace=~"velya-.*"
        } == 1
        AND on (pod, namespace)
        kube_pod_status_phase{phase="Running"} == 1
      ) > 2
    for: 5m
    labels:
      severity: warning
      layer: pod
    annotations:
      summary: "Mais de 2 pods Running mas não Ready em {{ $labels.namespace }}"
  
  - alert: PodCPUThrottlingHigh
    expr: |
      rate(container_cpu_cfs_throttled_seconds_total{
        namespace=~"velya-.*",
        container!=""
      }[5m]) /
      rate(container_cpu_cfs_periods_total{
        namespace=~"velya-.*",
        container!=""
      }[5m]) > 0.25
    for: 10m
    labels:
      severity: warning
      layer: pod
    annotations:
      summary: "Container {{ $labels.container }} em {{ $labels.namespace }} com > 25% CPU throttling"
  
  - alert: PodOOMKilled
    expr: |
      kube_pod_container_status_last_terminated_reason{
        reason="OOMKilled",
        namespace=~"velya-.*"
      } == 1
    for: 0m
    labels:
      severity: warning
      layer: pod
    annotations:
      summary: "Container {{ $labels.container }} em {{ $labels.pod }} foi OOMKilled"
```

---

## Camada 3: Namespace

### Métricas Principais

| Métrica | Instrumento | Query |
|---|---|---|
| CPU quota utilization | kube-state-metrics | `kube_resourcequota{type="used"} / kube_resourcequota{type="hard"}` |
| Memory quota utilization | kube-state-metrics | `kube_resourcequota{resource="requests.memory"}` |
| Scheduling delay | kube-state-metrics | Pods em Pending por namespace |
| Pod count vs max | kube-state-metrics | `kube_resourcequota{resource="pods",type="used"} / kube_resourcequota{resource="pods",type="hard"}` |

### Alertas Prometheus — Camada Namespace

```yaml
- name: namespace-pressure
  rules:
  
  - alert: NamespaceCPUQuotaHigh
    expr: |
      kube_resourcequota{
        resource="requests.cpu",
        type="used",
        namespace=~"velya-.*"
      } /
      kube_resourcequota{
        resource="requests.cpu",
        type="hard",
        namespace=~"velya-.*"
      } > 0.80
    for: 10m
    labels:
      severity: warning
      layer: namespace
    annotations:
      summary: "Namespace {{ $labels.namespace }} com CPU quota > 80%"
      description: "Utilização atual: {{ $value | humanizePercentage }}"
  
  - alert: NamespaceMemoryQuotaHigh
    expr: |
      kube_resourcequota{
        resource="requests.memory",
        type="used",
        namespace=~"velya-.*"
      } /
      kube_resourcequota{
        resource="requests.memory",
        type="hard",
        namespace=~"velya-.*"
      } > 0.80
    for: 10m
    labels:
      severity: warning
      layer: namespace
    annotations:
      summary: "Namespace {{ $labels.namespace }} com Memory quota > 80%"
  
  - alert: NamespacePodsPendingHigh
    expr: |
      count by (namespace) (
        kube_pod_status_phase{
          phase="Pending",
          namespace=~"velya-.*"
        } == 1
      ) > 5
    for: 5m
    labels:
      severity: warning
      layer: namespace
    annotations:
      summary: "Namespace {{ $labels.namespace }} com mais de 5 pods Pending"
  
  - alert: NamespaceSchedulingDelayHigh
    expr: |
      count by (namespace) (
        kube_pod_status_phase{
          phase="Pending",
          namespace=~"velya-.*"
        } == 1
        AND on (pod, namespace)
        (time() - kube_pod_start_time) > 300    # Pending por > 5 min
      ) > 0
    for: 5m
    labels:
      severity: warning
      layer: namespace
    annotations:
      summary: "Pods em {{ $labels.namespace }} Pending por > 5 minutos"
```

---

## Camada 4: Scaling

### Métricas Principais

| Métrica | Instrumento | Query |
|---|---|---|
| Scale events timeline | HPA events | `kube_horizontalpodautoscaler_status_current_replicas` |
| Replica churn | HPA events | `changes(replicas[30m])` |
| KEDA scaler lag | KEDA metrics | `keda_scaler_metrics_value` |
| KEDA scaler errors | KEDA metrics | `keda_scaler_errors_total` |
| HPA at max | kube-state-metrics | `hpa_current == hpa_max` |
| KEDA ScaledObject paused | KEDA metrics | `keda_scaled_object_paused` |

### Alertas Prometheus — Camada Scaling

```yaml
- name: scaling-pressure
  rules:
  
  - alert: HPAAtMaxReplicas
    expr: |
      kube_horizontalpodautoscaler_status_current_replicas ==
      kube_horizontalpodautoscaler_spec_max_replicas
    for: 10m
    labels:
      severity: warning
      layer: scaling
    annotations:
      summary: "HPA {{ $labels.namespace }}/{{ $labels.horizontalpodautoscaler }} no máximo de réplicas"
      description: "Máximo: {{ $value }}. Considerar aumentar maxReplicas ou otimizar o serviço."
  
  - alert: HPAFlapping
    expr: |
      changes(
        kube_horizontalpodautoscaler_status_current_replicas{
          namespace=~"velya-.*"
        }[30m]
      ) > 6
    for: 5m
    labels:
      severity: warning
      layer: scaling
    annotations:
      summary: "HPA {{ $labels.horizontalpodautoscaler }} com flapping"
      description: "Mais de 6 mudanças de réplicas em 30 minutos"
  
  - alert: KEDAScalerError
    expr: |
      increase(keda_scaler_errors_total[5m]) > 0
    for: 5m
    labels:
      severity: warning
      layer: scaling
    annotations:
      summary: "KEDA scaler {{ $labels.scaler }} com erros"
  
  - alert: KEDAScaledObjectPaused
    expr: |
      keda_scaled_object_paused == 1
    for: 30m
    labels:
      severity: info
      layer: scaling
    annotations:
      summary: "KEDA ScaledObject {{ $labels.scaledObject }} está pausado por 30 minutos"
  
  - alert: ScalingNotHappeningDuringLoad
    expr: |
      # Fila crescendo mas replicas não aumentando
      rate(velya_nats_pending_messages{stream=~"velya\\..*"}[5m]) > 50
      AND
      changes(kube_deployment_status_replicas{
        deployment=~".*worker.*",
        namespace=~"velya-.*"
      }[10m]) == 0
    for: 5m
    labels:
      severity: warning
      layer: scaling
    annotations:
      summary: "Fila crescendo mas scaling não está acontecendo"
```

---

## Camada 5: Workload

### Métricas Principais

| Métrica | Instrumento | Query |
|---|---|---|
| Queue depth | NATS monitoring | `velya_nats_pending_messages` |
| Backlog age (oldest message) | NATS monitoring | `velya_nats_oldest_message_age_seconds` |
| DLQ growth | NATS monitoring | `delta(velya_nats_dlq_messages[10m])` |
| Consumer lag | NATS JetStream | `velya_nats_consumer_lag` |
| Workflow pending count | Temporal | `temporal_workflow_pending_count` |
| Activity retry rate | Temporal | `rate(temporal_activity_retry_total[5m])` |

### Custom Metrics Velya — Definição

```yaml
# ConfigMap com regras de recording para métricas custom
apiVersion: v1
kind: ConfigMap
metadata:
  name: velya-recording-rules
  namespace: velya-dev-observability
data:
  recording-rules.yaml: |
    groups:
    - name: velya-workload-pressure
      interval: 30s
      rules:
      
      # Queue depth por stream NATS
      - record: velya_nats_pending_messages
        expr: |
          nats_jetstream_stream_messages{
            account="$G",
            server_name="nats-0"
          }
        labels:
          source: nats
      
      # Backlog age (tempo da mensagem mais antiga)
      - record: velya_nats_oldest_message_age_seconds
        expr: |
          time() - (nats_jetstream_stream_first_seq_time / 1000)
        labels:
          source: nats
      
      # Token budget LLM
      - record: velya_ai_tokens_remaining_today
        expr: |
          velya_ai_tokens_budget_daily - velya_ai_tokens_consumed_today
      
      # Ratio de budget consumido
      - record: velya_ai_budget_consumed_ratio
        expr: |
          velya_ai_tokens_consumed_today / velya_ai_tokens_budget_daily
```

### Alertas Prometheus — Camada Workload

```yaml
- name: workload-pressure
  rules:
  
  - alert: NATSQueueDepthHigh
    expr: |
      velya_nats_pending_messages{stream=~"velya\\..*"} > 500
    for: 5m
    labels:
      severity: warning
      layer: workload
    annotations:
      summary: "Queue {{ $labels.stream }} com > 500 mensagens pendentes"
  
  - alert: NATSQueueDepthCritical
    expr: |
      velya_nats_pending_messages{stream=~"velya\\..*"} > 2000
    for: 2m
    labels:
      severity: critical
      layer: workload
    annotations:
      summary: "CRÍTICO: Queue {{ $labels.stream }} com > 2000 mensagens"
  
  - alert: NATSBacklogAgeHigh
    expr: |
      velya_nats_oldest_message_age_seconds{stream=~"velya\\..*"} > 300
    for: 5m
    labels:
      severity: warning
      layer: workload
    annotations:
      summary: "Mensagem mais antiga na queue {{ $labels.stream }} tem > 5 minutos"
  
  - alert: DLQGrowing
    expr: |
      delta(velya_nats_pending_messages{stream=~"velya\\..*\\.dlq"}[10m]) > 5
    for: 5m
    labels:
      severity: warning
      layer: workload
    annotations:
      summary: "DLQ {{ $labels.stream }} crescendo — possível falha em workers"
  
  - alert: LLMTokenBudgetLow
    expr: |
      velya_ai_budget_consumed_ratio > 0.85
    for: 10m
    labels:
      severity: warning
      layer: workload
    annotations:
      summary: "Budget de tokens LLM do office {{ $labels.office_id }} acima de 85%"
  
  - alert: LLMTokenBudgetCritical
    expr: |
      velya_ai_budget_consumed_ratio > 0.95
    for: 5m
    labels:
      severity: critical
      layer: workload
    annotations:
      summary: "CRÍTICO: Budget de tokens LLM do office {{ $labels.office_id }} acima de 95%"
  
  - alert: TemporalWorkflowBacklogHigh
    expr: |
      temporal_workflow_pending_count{
        namespace="velya-dev"
      } > 50
    for: 10m
    labels:
      severity: warning
      layer: workload
    annotations:
      summary: "{{ $value }} workflows Temporal pendentes no namespace velya-dev"
  
  - alert: TemporalActivityRetryRateHigh
    expr: |
      rate(temporal_activity_retry_total{
        namespace="velya-dev"
      }[10m]) > 5
    for: 5m
    labels:
      severity: warning
      layer: workload
    annotations:
      summary: "Alta taxa de retry em atividades Temporal — possível dependência instável"
```

---

## Grafana Dashboard: Runtime Pressure Board

### Estrutura do Dashboard

```json
{
  "title": "Velya — Runtime Pressure Board",
  "uid": "velya-runtime-pressure",
  "tags": ["velya", "scaling", "pressure"],
  "time": {"from": "now-3h", "to": "now"},
  "refresh": "30s",
  
  "templating": {
    "list": [
      {
        "name": "namespace",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(kube_pod_info, namespace)",
        "regex": "velya-.*",
        "multi": true,
        "includeAll": true
      },
      {
        "name": "deployment",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(kube_deployment_status_replicas{namespace=~\"$namespace\"}, deployment)",
        "multi": true
      }
    ]
  },
  
  "panels": [
    {
      "title": "Node CPU Pressure",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
      "targets": [{
        "expr": "1 - avg by (node) (rate(node_cpu_seconds_total{mode=\"idle\"}[5m]))",
        "legendFormat": "{{node}}"
      }],
      "fieldConfig": {
        "defaults": {
          "unit": "percentunit",
          "thresholds": {
            "steps": [
              {"value": 0, "color": "green"},
              {"value": 0.70, "color": "yellow"},
              {"value": 0.85, "color": "red"}
            ]
          }
        }
      }
    },
    
    {
      "title": "Node Memory Pressure",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
      "targets": [{
        "expr": "1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)",
        "legendFormat": "{{instance}}"
      }],
      "fieldConfig": {
        "defaults": {"unit": "percentunit"}
      }
    },
    
    {
      "title": "Pod Churn Rate (restarts/min)",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
      "targets": [{
        "expr": "rate(kube_pod_container_status_restarts_total{namespace=~\"$namespace\"}[5m]) * 60",
        "legendFormat": "{{namespace}}/{{pod}}"
      }]
    },
    
    {
      "title": "Pods Running vs Ready",
      "type": "stat",
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
      "targets": [
        {
          "expr": "count(kube_pod_status_phase{phase=\"Running\", namespace=~\"$namespace\"} == 1)",
          "legendFormat": "Running"
        },
        {
          "expr": "count(kube_pod_status_ready{condition=\"true\", namespace=~\"$namespace\"} == 1)",
          "legendFormat": "Ready"
        }
      ]
    },
    
    {
      "title": "Namespace CPU Quota Utilization",
      "type": "bargauge",
      "gridPos": {"h": 8, "w": 24, "x": 0, "y": 16},
      "targets": [{
        "expr": "kube_resourcequota{resource=\"requests.cpu\",type=\"used\",namespace=~\"velya-.*\"} / kube_resourcequota{resource=\"requests.cpu\",type=\"hard\",namespace=~\"velya-.*\"}",
        "legendFormat": "{{namespace}}"
      }],
      "fieldConfig": {
        "defaults": {
          "unit": "percentunit",
          "min": 0,
          "max": 1,
          "thresholds": {
            "steps": [
              {"value": 0, "color": "green"},
              {"value": 0.7, "color": "yellow"},
              {"value": 0.85, "color": "orange"},
              {"value": 0.95, "color": "red"}
            ]
          }
        }
      }
    },
    
    {
      "title": "HPA Scale Events",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 24},
      "targets": [{
        "expr": "kube_horizontalpodautoscaler_status_current_replicas{namespace=~\"$namespace\"}",
        "legendFormat": "{{horizontalpodautoscaler}}"
      }]
    },
    
    {
      "title": "KEDA Queue Depth",
      "type": "timeseries",
      "gridPos": {"h": 8, "w": 12, "x": 12, "y": 24},
      "targets": [{
        "expr": "velya_nats_pending_messages",
        "legendFormat": "{{stream}}"
      }]
    },
    
    {
      "title": "LLM Token Budget",
      "type": "gauge",
      "gridPos": {"h": 8, "w": 8, "x": 0, "y": 32},
      "targets": [{
        "expr": "velya_ai_budget_consumed_ratio * 100",
        "legendFormat": "{{office_id}}"
      }],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "min": 0,
          "max": 100,
          "thresholds": {
            "steps": [
              {"value": 0, "color": "green"},
              {"value": 70, "color": "yellow"},
              {"value": 85, "color": "orange"},
              {"value": 95, "color": "red"}
            ]
          }
        }
      }
    },
    
    {
      "title": "DLQ Message Count",
      "type": "stat",
      "gridPos": {"h": 8, "w": 8, "x": 8, "y": 32},
      "targets": [{
        "expr": "sum by (stream) (velya_nats_pending_messages{stream=~\".*dlq.*\"})",
        "legendFormat": "{{stream}}"
      }],
      "fieldConfig": {
        "defaults": {
          "thresholds": {
            "steps": [
              {"value": 0, "color": "green"},
              {"value": 1, "color": "yellow"},
              {"value": 10, "color": "orange"},
              {"value": 100, "color": "red"}
            ]
          }
        }
      }
    },
    
    {
      "title": "Temporal Workflow Pending",
      "type": "stat",
      "gridPos": {"h": 8, "w": 8, "x": 16, "y": 32},
      "targets": [{
        "expr": "temporal_workflow_pending_count{namespace=\"velya-dev\"}",
        "legendFormat": "{{task_queue}}"
      }]
    }
  ]
}
```

---

## Exportação e Integração

### Embedding no velya-web

O Runtime Pressure Board pode ser embeddado no velya-web via iframe autenticado ou via Grafana API:

```typescript
// velya-web: componente de pressure board
export async function getRuntimePressureSnapshot(): Promise<PressureSnapshot> {
  const prometheusUrl = process.env.PROMETHEUS_URL;
  
  const [nodePressure, podChurn, queueDepth, budgetStatus] = await Promise.all([
    queryPrometheus(prometheusUrl, NODE_CPU_PRESSURE_QUERY),
    queryPrometheus(prometheusUrl, POD_CHURN_RATE_QUERY),
    queryPrometheus(prometheusUrl, QUEUE_DEPTH_QUERY),
    queryPrometheus(prometheusUrl, LLM_BUDGET_RATIO_QUERY),
  ]);
  
  return {
    status: computeOverallStatus(nodePressure, podChurn, queueDepth, budgetStatus),
    node: nodePressure,
    pod: podChurn,
    queue: queueDepth,
    budget: budgetStatus,
    timestamp: new Date(),
  };
}
```

### Alertmanager Routing

```yaml
# alertmanager-config.yaml
route:
  group_by: ['alertname', 'namespace', 'layer']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'slack-ops'
  
  routes:
  - match:
      severity: critical
      layer: node
    receiver: 'pagerduty-critical'
    continue: true
  
  - match:
      severity: critical
      layer: workload
    receiver: 'slack-clinical-alerts'
    continue: true
  
  - match:
      severity: warning
    receiver: 'slack-ops'

receivers:
- name: 'slack-ops'
  slack_configs:
  - api_url: '{{ .VelyaSlackWebhookURL }}'
    channel: '#velya-platform-alerts'
    title: '{{ .GroupLabels.alertname }}'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'

- name: 'pagerduty-critical'
  pagerduty_configs:
  - routing_key: '{{ .PagerDutyRoutingKey }}'
    severity: '{{ .CommonLabels.severity }}'

- name: 'slack-clinical-alerts'
  slack_configs:
  - api_url: '{{ .VelyaSlackWebhookURL }}'
    channel: '#velya-clinical-alerts'
    title: 'ALERTA CLÍNICO: {{ .GroupLabels.alertname }}'
```

---

## Runbook de Resposta por Pressão

### Pressão de Nó (CPU > 85%)

```bash
# 1. Identificar nó afetado
kubectl top nodes --sort-by=cpu

# 2. Ver qual workload está consumindo mais
kubectl top pods -A --sort-by=cpu | head -20

# 3. Verificar se Karpenter está provisionando novo nó
kubectl get nodes -w

# 4. Verificar eventos do Karpenter
kubectl logs -n kube-system -l app.kubernetes.io/name=karpenter --since=5m

# 5. Se Karpenter não provisionando, verificar NodePool limits
kubectl describe nodepool velya-realtime-app | grep -A10 limits
```

### Pressão de Queue (Depth > 500)

```bash
# 1. Verificar profundidade e idade das mensagens
nats stream info velya.discharge.queue

# 2. Verificar se workers estão ativos
kubectl get pods -n velya-dev-agents -l app=discharge-orchestrator-worker

# 3. Verificar logs dos workers
kubectl logs -n velya-dev-agents -l app=discharge-orchestrator-worker --since=5m

# 4. Verificar ScaledObject KEDA
kubectl describe scaledobject discharge-worker-so -n velya-dev-agents

# 5. Forçar scale-up manual se KEDA não estiver reagindo
kubectl scale deployment discharge-orchestrator-worker -n velya-dev-agents --replicas=10
```

---

*Este documento é atualizado sempre que novos instrumentos de observabilidade são adicionados à plataforma Velya.*
