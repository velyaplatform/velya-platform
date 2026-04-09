# Modelo de Correlacao de Observabilidade

> Documento 11 - Layered Assurance + Self-Healing  
> Plataforma Velya - Sistema Hospitalar Inteligente  
> Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

A observabilidade da Velya integra multiplos sinais (logs, metricas, traces, profiles, eventos de deploy, decisoes de agentes, estados de workflow) em uma visao correlacionada que permite investigacao rapida de incidentes. Este documento define as chaves de correlacao, os padroes de query, e os dashboards de referencia.

---

## 2. Sinais de Observabilidade

| Sinal               | Fonte                      | Armazenamento          | Retencao | Formato              |
| ------------------- | -------------------------- | ---------------------- | -------- | -------------------- |
| Logs estruturados   | Aplicacoes, infra          | Loki                   | 30 dias  | JSON (LogQL)         |
| Metricas            | Prometheus exporters, OTEL | Prometheus/Thanos      | 90 dias  | Time-series (PromQL) |
| Traces distribuidos | OpenTelemetry SDK          | Tempo                  | 14 dias  | OTLP (TraceQL)       |
| Profiles            | Pyroscope agent            | Pyroscope              | 7 dias   | pprof                |
| Deploy events       | ArgoCD, Argo Rollouts      | Prometheus annotations | 90 dias  | Annotations          |
| Policy denials      | policy-engine, OPA         | Loki + Prometheus      | 30 dias  | JSON + counters      |
| Rollout analysis    | Argo Rollouts              | Prometheus             | 90 dias  | Metrics              |
| Agent decisions     | decision-log-service       | PostgreSQL + Loki      | 365 dias | JSON                 |
| Workflow states     | Temporal                   | Temporal persistence   | 90 dias  | Protobuf             |
| Frontend errors     | velya-web (Sentry/OTEL)    | Loki + Tempo           | 14 dias  | JSON + spans         |
| Backend errors      | Servicos (OTEL)            | Loki + Tempo           | 30 dias  | JSON + spans         |
| Infra symptoms      | Node exporters, kube-state | Prometheus             | 90 dias  | Time-series          |
| Remediation events  | Self-healing controllers   | Loki + Prometheus      | 30 dias  | JSON + counters      |
| Learning events     | memory-service             | PostgreSQL + Loki      | 365 dias | JSON                 |

---

## 3. Chaves de Correlacao

### 3.1 Chaves Primarias

| Chave           | Formato            | Propagacao                                                         | Uso                                                              |
| --------------- | ------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `traceId`       | 32 hex chars (W3C) | HTTP header `traceparent`, NATS header `trace-id`, Temporal header | Correlacionar todos os sinais de uma requisicao end-to-end       |
| `spanId`        | 16 hex chars (W3C) | Dentro do trace context                                            | Identificar operacao especifica dentro de um trace               |
| `correlationId` | UUID v4            | HTTP header `X-Velya-Correlation-Id`, NATS header, Temporal memo   | Correlacionar operacoes de negocio que abrangem multiplos traces |

### 3.2 Chaves Secundarias

| Chave           | Formato                          | Contexto                            | Uso                                            |
| --------------- | -------------------------------- | ----------------------------------- | ---------------------------------------------- |
| `deploymentId`  | `{service}-{gitSha}-{timestamp}` | ArgoCD sync, Argo Rollouts revision | Correlacionar incidentes com deploys           |
| `rolloutId`     | `{service}-{revision}`           | Argo Rollouts                       | Correlacionar metricas canary com traces       |
| `workflowRunId` | UUID                             | Temporal workflow execution         | Correlacionar logs/traces de um workflow       |
| `patientId`     | UUID                             | Dominio clinico                     | Correlacionar todos os eventos de um paciente  |
| `agentId`       | `{type}-{version}-{instance}`    | Agent orchestrator                  | Correlacionar decisoes e metricas de um agente |
| `incidentId`    | `INC-{timestamp}-{hash}`         | Alert manager                       | Agrupar todos os sinais de um incidente        |
| `sessionId`     | UUID                             | velya-web frontend                  | Correlacionar acoes do usuario com backend     |

### 3.3 Propagacao de Contexto

```
Browser (velya-web)
  |
  | traceparent: 00-{traceId}-{spanId}-01
  | X-Velya-Correlation-Id: {correlationId}
  | X-Velya-Session-Id: {sessionId}
  |
  v
API Gateway (Ingress)
  |
  | Adiciona: X-Velya-Request-Id, X-Velya-Deployment-Id
  |
  v
Servico Backend (ex: patient-flow)
  |
  +-- Chamada sincrona para outro servico
  |   | Propaga: traceparent, X-Velya-Correlation-Id
  |   v
  |   audit-service
  |
  +-- Publicacao assincrona NATS
  |   | Headers NATS: trace-id, correlation-id, source-service
  |   v
  |   NATS JetStream --> Consumer (task-inbox)
  |                      | Extrai headers, continua trace
  |
  +-- Inicio de Temporal Workflow
      | Memo: traceId, correlationId, patientId
      | Search Attributes: VelyaService, VelyaCorrelationId
      v
      Temporal Worker (discharge-orchestrator)
        | Cada activity cria child span
        | Logs incluem workflowRunId + traceId
```

### 3.4 Instrumentacao OpenTelemetry

```typescript
// shared/telemetry/context-propagation.ts
import { context, propagation, trace, SpanKind } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

export function extractVelyaContext(headers: Record<string, string>) {
  return {
    traceId: headers['traceparent']?.split('-')[1],
    correlationId: headers['x-velya-correlation-id'],
    sessionId: headers['x-velya-session-id'],
    deploymentId: headers['x-velya-deployment-id'],
    patientId: headers['x-velya-patient-id'],
  };
}

export function injectVelyaContext(
  headers: Record<string, string>,
  velyaContext: VelyaContext,
): void {
  // W3C trace context e propagado automaticamente pelo SDK
  propagation.inject(context.active(), headers);

  // Contexto Velya adicional
  if (velyaContext.correlationId) {
    headers['x-velya-correlation-id'] = velyaContext.correlationId;
  }
  if (velyaContext.patientId) {
    headers['x-velya-patient-id'] = velyaContext.patientId;
  }
  if (velyaContext.sessionId) {
    headers['x-velya-session-id'] = velyaContext.sessionId;
  }
}

// Para NATS JetStream
export function injectNatsHeaders(natsHeaders: MsgHdrs, velyaContext: VelyaContext): void {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);

  natsHeaders.set('trace-id', carrier['traceparent'] || '');
  natsHeaders.set('correlation-id', velyaContext.correlationId || '');
  natsHeaders.set('source-service', velyaContext.sourceService);
  natsHeaders.set('patient-id', velyaContext.patientId || '');
}

// Para Temporal Workflows
export function temporalMemo(velyaContext: VelyaContext): Record<string, unknown> {
  return {
    traceId: velyaContext.traceId,
    correlationId: velyaContext.correlationId,
    patientId: velyaContext.patientId,
    deploymentId: velyaContext.deploymentId,
    initiatedBy: velyaContext.userId,
  };
}
```

---

## 4. Padroes de Query para Investigacao

### 4.1 LogQL (Loki)

#### Erro 5xx em servico especifico com trace correlation

```logql
{namespace="velya-clinical", service="patient-flow"}
  | json
  | level="error"
  | status_code >= 500
  | line_format "traceId={{.traceId}} status={{.status_code}} path={{.path}} error={{.error}}"
```

#### Todos os logs de um correlationId (cross-service)

```logql
{namespace=~"velya-.*"}
  | json
  | correlationId="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  | line_format "{{.timestamp}} [{{.service}}] {{.level}}: {{.message}}"
```

#### Logs de um discharge workflow

```logql
{namespace="velya-clinical", service="discharge-orchestrator"}
  | json
  | workflowRunId="discharge-patient123-20260408"
  | line_format "{{.timestamp}} step={{.step}} status={{.status}} duration={{.duration_ms}}ms"
```

#### Decisoes de agente com baixa confianca

```logql
{namespace="velya-ai", service="agent-orchestrator"}
  | json
  | eventType="agent_decision"
  | confidence < 0.7
  | line_format "agent={{.agentId}} decision={{.decision}} confidence={{.confidence}} patient={{.patientId}}"
```

#### Deteccao de retry storm

```logql
sum by (service) (
  count_over_time(
    {namespace=~"velya-.*"} | json | level="warn" | message=~".*retry.*" [5m]
  )
) > 50
```

#### Policy denials

```logql
{namespace="velya-system", service="policy-engine"}
  | json
  | eventType="policy_denial"
  | line_format "policy={{.policyName}} action={{.action}} subject={{.subject}} resource={{.resource}} reason={{.reason}}"
```

### 4.2 PromQL (Prometheus)

#### Error rate por servico com deployment correlation

```promql
# Error rate atual vs baseline pre-deploy
(
  sum(rate(http_requests_total{namespace=~"velya-.*", status=~"5.."}[5m])) by (service)
  /
  sum(rate(http_requests_total{namespace=~"velya-.*"}[5m])) by (service)
)
# Sobrepor com deploy events
# Annotation query: argocd_app_sync_total{namespace=~"velya-.*"}
```

#### P99 latency com correlacao de rollout

```promql
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket{
    namespace=~"velya-.*"
  }[5m])) by (le, service)
)
# Comparar canary vs stable
# Canary:
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket{
    namespace=~"velya-.*",
    rollouts_pod_template_hash=~"canary-.*"
  }[5m])) by (le, service)
)
```

#### Saturacao de recursos correlacionada com latency

```promql
# CPU throttling
sum(rate(container_cpu_cfs_throttled_periods_total{
  namespace=~"velya-.*"
}[5m])) by (pod)
/
sum(rate(container_cpu_cfs_periods_total{
  namespace=~"velya-.*"
}[5m])) by (pod)
> 0.2

# Correlacionar com memoria
container_memory_working_set_bytes{namespace=~"velya-.*"}
/
container_spec_memory_limit_bytes{namespace=~"velya-.*"}
> 0.85
```

#### NATS JetStream consumer lag

```promql
nats_jetstream_consumer_num_pending{
  stream=~"patient-events|task-events|discharge-events|audit-events"
}
```

#### Temporal workflow duration anomaly

```promql
histogram_quantile(0.95,
  sum(rate(temporal_workflow_endtoend_latency_bucket{
    namespace="velya-clinical",
    workflow_type="DischargeOrchestrationWorkflow"
  }[1h])) by (le)
) > 86400
```

#### KEDA scaler metric

```promql
keda_scaler_metrics_value{
  namespace=~"velya-.*"
}
# Correlacionar com replica count
kube_deployment_spec_replicas{namespace=~"velya-.*"}
```

### 4.3 TraceQL (Tempo)

#### Traces lentos de discharge

```traceql
{ resource.service.name = "discharge-orchestrator" && duration > 10s }
```

#### Traces com erro em activity especifica

```traceql
{ resource.service.name = "discharge-orchestrator" && span.temporal.activity = "performMedicationReview" && status = error }
```

#### Traces cross-service com latency alta

```traceql
{ resource.service.name = "patient-flow" && span.http.route = "/api/v1/patients/*/discharge/initiate" && duration > 5s } >> { resource.service.name = "discharge-orchestrator" }
```

#### Traces de decisao de agente

```traceql
{ resource.service.name = "agent-orchestrator" && span.velya.agent.decision = "discharge_recommendation" && span.velya.agent.confidence < 0.7 }
```

#### Traces com correlationId

```traceql
{ span.velya.correlation_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
```

---

## 5. Grafana Dashboard - Cross-Signal Correlation

### 5.1 Dashboard JSON

```json
{
  "dashboard": {
    "id": null,
    "uid": "velya-cross-signal-correlation",
    "title": "Velya - Correlacao Cross-Signal",
    "tags": ["velya", "observability", "correlation"],
    "timezone": "America/Sao_Paulo",
    "refresh": "30s",
    "templating": {
      "list": [
        {
          "name": "service",
          "type": "query",
          "query": "label_values(http_requests_total{namespace=~\"velya-.*\"}, service)",
          "datasource": "Prometheus",
          "multi": true,
          "includeAll": true
        },
        {
          "name": "namespace",
          "type": "query",
          "query": "label_values(http_requests_total{namespace=~\"velya-.*\"}, namespace)",
          "datasource": "Prometheus",
          "multi": true,
          "includeAll": true
        },
        {
          "name": "correlationId",
          "type": "textbox",
          "label": "Correlation ID"
        },
        {
          "name": "traceId",
          "type": "textbox",
          "label": "Trace ID"
        }
      ]
    },
    "panels": [
      {
        "id": 1,
        "title": "Request Rate & Error Rate",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{namespace=~\"velya-.*\", service=~\"$service\"}[5m])) by (service)",
            "legendFormat": "{{service}} - total"
          },
          {
            "expr": "sum(rate(http_requests_total{namespace=~\"velya-.*\", service=~\"$service\", status=~\"5..\"}[5m])) by (service)",
            "legendFormat": "{{service}} - errors"
          }
        ],
        "fieldConfig": {
          "overrides": [
            {
              "matcher": { "id": "byRegexp", "options": ".*errors.*" },
              "properties": [
                { "id": "color", "value": { "fixedColor": "red", "mode": "fixed" } },
                { "id": "custom.fillOpacity", "value": 20 }
              ]
            }
          ]
        }
      },
      {
        "id": 2,
        "title": "P50 / P90 / P99 Latency",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket{namespace=~\"velya-.*\", service=~\"$service\"}[5m])) by (le, service))",
            "legendFormat": "{{service}} - p50"
          },
          {
            "expr": "histogram_quantile(0.90, sum(rate(http_request_duration_seconds_bucket{namespace=~\"velya-.*\", service=~\"$service\"}[5m])) by (le, service))",
            "legendFormat": "{{service}} - p90"
          },
          {
            "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{namespace=~\"velya-.*\", service=~\"$service\"}[5m])) by (le, service))",
            "legendFormat": "{{service}} - p99"
          }
        ]
      },
      {
        "id": 3,
        "title": "Deploy Events (ArgoCD)",
        "type": "timeseries",
        "gridPos": { "h": 4, "w": 24, "x": 0, "y": 8 },
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "increase(argocd_app_sync_total{namespace=~\"velya-.*\", phase=\"Succeeded\"}[5m])",
            "legendFormat": "{{name}} - sync"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "custom": {
              "drawStyle": "bars",
              "fillOpacity": 80
            }
          }
        }
      },
      {
        "id": 4,
        "title": "Logs - Erros por Servico",
        "type": "logs",
        "gridPos": { "h": 10, "w": 12, "x": 0, "y": 12 },
        "datasource": "Loki",
        "targets": [
          {
            "expr": "{namespace=~\"velya-.*\", service=~\"$service\"} | json | level=\"error\"",
            "maxLines": 100
          }
        ]
      },
      {
        "id": 5,
        "title": "Traces - Servico Selecionado",
        "type": "traces",
        "gridPos": { "h": 10, "w": 12, "x": 12, "y": 12 },
        "datasource": "Tempo",
        "targets": [
          {
            "queryType": "traceql",
            "query": "{ resource.service.name =~ \"$service\" && status = error }"
          }
        ]
      },
      {
        "id": 6,
        "title": "NATS JetStream Consumer Lag",
        "type": "timeseries",
        "gridPos": { "h": 6, "w": 12, "x": 0, "y": 22 },
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "nats_jetstream_consumer_num_pending{stream=~\"patient-events|task-events|discharge-events|audit-events\"}",
            "legendFormat": "{{stream}} / {{consumer}}"
          }
        ]
      },
      {
        "id": 7,
        "title": "Temporal Workflows Ativos",
        "type": "stat",
        "gridPos": { "h": 6, "w": 6, "x": 12, "y": 22 },
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "sum(temporal_workflow_execution_total{namespace=\"velya-clinical\", status=\"running\"}) by (workflow_type)",
            "legendFormat": "{{workflow_type}}"
          }
        ]
      },
      {
        "id": 8,
        "title": "Agent Decision Confidence",
        "type": "timeseries",
        "gridPos": { "h": 6, "w": 6, "x": 18, "y": 22 },
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, sum(rate(velya_agent_decision_confidence_bucket[5m])) by (le, agent_id))",
            "legendFormat": "{{agent_id}} - p50 confidence"
          }
        ]
      },
      {
        "id": 9,
        "title": "Policy Denials",
        "type": "timeseries",
        "gridPos": { "h": 6, "w": 12, "x": 0, "y": 28 },
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "sum(rate(velya_policy_denial_total[5m])) by (policy_name, action)",
            "legendFormat": "{{policy_name}} - {{action}}"
          }
        ]
      },
      {
        "id": 10,
        "title": "Remediation Events",
        "type": "timeseries",
        "gridPos": { "h": 6, "w": 12, "x": 12, "y": 28 },
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "sum(rate(velya_remediation_executed_total[5m])) by (type, service, result)",
            "legendFormat": "{{type}} - {{service}} - {{result}}"
          }
        ]
      },
      {
        "id": 11,
        "title": "Correlacao por Trace ID",
        "type": "traces",
        "gridPos": { "h": 8, "w": 24, "x": 0, "y": 34 },
        "datasource": "Tempo",
        "targets": [
          {
            "queryType": "traceql",
            "query": "{ span.velya.correlation_id = \"$correlationId\" || traceID = \"$traceId\" }"
          }
        ]
      },
      {
        "id": 12,
        "title": "Resource Saturation (CPU/Memory)",
        "type": "timeseries",
        "gridPos": { "h": 6, "w": 12, "x": 0, "y": 42 },
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "sum(rate(container_cpu_usage_seconds_total{namespace=~\"velya-.*\", container=~\"$service\"}[5m])) by (pod) / sum(kube_pod_container_resource_limits{namespace=~\"velya-.*\", container=~\"$service\", resource=\"cpu\"}) by (pod)",
            "legendFormat": "{{pod}} CPU%"
          },
          {
            "expr": "sum(container_memory_working_set_bytes{namespace=~\"velya-.*\", container=~\"$service\"}) by (pod) / sum(kube_pod_container_resource_limits{namespace=~\"velya-.*\", container=~\"$service\", resource=\"memory\"}) by (pod)",
            "legendFormat": "{{pod}} MEM%"
          }
        ]
      },
      {
        "id": 13,
        "title": "Rollout Analysis Results",
        "type": "table",
        "gridPos": { "h": 6, "w": 12, "x": 12, "y": 42 },
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "velya_rollout_analysis_result{namespace=~\"velya-.*\"}",
            "legendFormat": "{{service}} - {{metric}} = {{result}}",
            "format": "table"
          }
        ]
      }
    ],
    "annotations": {
      "list": [
        {
          "name": "Deploys",
          "datasource": "Prometheus",
          "expr": "increase(argocd_app_sync_total{phase=\"Succeeded\"}[1m]) > 0",
          "tagKeys": "name",
          "titleFormat": "Deploy: {{name}}",
          "iconColor": "blue"
        },
        {
          "name": "Rollbacks",
          "datasource": "Prometheus",
          "expr": "increase(velya_rollback_total[1m]) > 0",
          "tagKeys": "service,type",
          "titleFormat": "Rollback: {{service}}",
          "iconColor": "red"
        },
        {
          "name": "Incidents",
          "datasource": "Prometheus",
          "expr": "ALERTS{alertstate=\"firing\", severity=~\"critical|high\"}",
          "tagKeys": "alertname,service",
          "titleFormat": "Alert: {{alertname}}",
          "iconColor": "orange"
        }
      ]
    }
  }
}
```

---

## 6. Padroes de Investigacao

### 6.1 Paciente com alta bloqueada

```
1. Buscar correlationId do discharge workflow
   LogQL: {service="discharge-orchestrator"} | json | patientId="<ID>" | eventType="workflow_started"

2. Ver estado do workflow no Temporal
   tctl workflow describe -w discharge-<patientId>-*

3. Identificar step bloqueado
   LogQL: {service="discharge-orchestrator"} | json | workflowRunId="<ID>" | level=~"error|warn"

4. Correlacionar com traces
   TraceQL: { span.velya.workflow_run_id = "<workflowRunId>" && status = error }

5. Verificar se houve policy denial
   LogQL: {service="policy-engine"} | json | patientId="<ID>" | eventType="policy_denial"

6. Verificar se agente esta em quarentena
   PromQL: velya_agent_lifecycle_state{agent_id=~"discharge-.*"} == 0
```

### 6.2 Latencia alta apos deploy

```
1. Identificar deploy recente
   PromQL: increase(argocd_app_sync_total{phase="Succeeded"}[30m]) > 0

2. Comparar latency antes e depois
   PromQL: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{service="<SERVICE>"}[5m])) by (le))
   # Comparar com offset 1h: ... offset 1h

3. Verificar se canary esta com latency diferente
   PromQL: ... por pod_template_hash

4. Buscar traces lentos pos-deploy
   TraceQL: { resource.service.name = "<SERVICE>" && duration > 5s }

5. Verificar resource saturation
   PromQL: rate(container_cpu_cfs_throttled_periods_total{container="<SERVICE>"}[5m])

6. Profiling: verificar Pyroscope para flamegraph comparativo
   Pyroscope: diff entre baseline e pos-deploy
```

### 6.3 Retry storm detectado

```
1. Identificar servico com retries excessivos
   LogQL: sum by (service)(count_over_time({namespace=~"velya-.*"} | json | message=~".*retry.*"[5m]))

2. Identificar causa dos retries
   LogQL: {service="<SERVICE>"} | json | message=~".*retry.*" | line_format "{{.error}} -> {{.target}}"

3. Verificar se servico downstream esta saudavel
   PromQL: up{service="<DOWNSTREAM>"}

4. Verificar NATS consumer lag (se assincrono)
   PromQL: nats_jetstream_consumer_num_pending{stream="<STREAM>"}

5. Verificar circuit breaker state
   PromQL: velya_circuit_breaker_state{service="<SERVICE>", target="<DOWNSTREAM>"}

6. Correlacionar com DLQ growth
   PromQL: nats_jetstream_stream_messages{stream=~".*dlq.*"}
```

### 6.4 Decisao de agente suspeita

```
1. Buscar decisao especifica
   LogQL: {service="decision-log-service"} | json | decisionId="<ID>"

2. Ver contexto completo da decisao
   TraceQL: { span.velya.decision_id = "<ID>" }

3. Verificar confianca e evidencias
   LogQL: {service="agent-orchestrator"} | json | decisionId="<ID>" | line_format "confidence={{.confidence}} evidence={{.evidence}} alternatives={{.alternatives}}"

4. Verificar se policy-engine validou
   LogQL: {service="policy-engine"} | json | decisionId="<ID>"

5. Comparar com decisoes similares historicas
   LogQL: {service="decision-log-service"} | json | decisionType="<TYPE>" | patientContext=~"similar" [24h]

6. Verificar estado do memory-service
   LogQL: {service="memory-service"} | json | agentId="<AGENT_ID>" | eventType="memory_retrieval"
```

---

## 7. Correlacao Automatica

### 7.1 Exemplar Linking (Prometheus -> Tempo)

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 5s
    send_batch_size: 1000

exporters:
  prometheusremotewrite:
    endpoint: http://prometheus.observability:9090/api/v1/write
    resource_to_telemetry_conversion:
      enabled: true

  loki:
    endpoint: http://loki.observability:3100/loki/api/v1/push
    labels:
      resource:
        service.name: 'service'
        service.namespace: 'namespace'
      attributes:
        level: ''
        velya.correlation_id: 'correlationId'
        velya.patient_id: 'patientId'

  otlp/tempo:
    endpoint: tempo.observability:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheusremotewrite]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [loki]
```

### 7.2 Grafana Data Source Linking

```yaml
# grafana/datasources/correlation.yaml
apiVersion: 1
datasources:
  - name: Tempo
    type: tempo
    url: http://tempo.observability:3200
    jsonData:
      tracesToLogs:
        datasourceUid: loki
        filterByTraceID: true
        filterBySpanID: true
        mapTagNamesEnabled: true
        mappedTags:
          - key: service.name
            value: service
          - key: velya.correlation_id
            value: correlationId
      tracesToMetrics:
        datasourceUid: prometheus
        queries:
          - name: Request rate
            query: sum(rate(http_requests_total{service="$${__tags.service.name}"}[5m]))
          - name: Error rate
            query: sum(rate(http_requests_total{service="$${__tags.service.name}", status=~"5.."}[5m]))
      serviceMap:
        datasourceUid: prometheus
      nodeGraph:
        enabled: true

  - name: Loki
    type: loki
    url: http://loki.observability:3100
    jsonData:
      derivedFields:
        - name: TraceID
          matcherRegex: '"traceId":"([a-f0-9]+)"'
          url: '$${__value.raw}'
          datasourceUid: tempo
          matcherType: regex
        - name: WorkflowRunID
          matcherRegex: '"workflowRunId":"([a-zA-Z0-9-]+)"'
          url: 'http://temporal-ui.velya-system/workflows/$${__value.raw}'
          matcherType: regex
```

---

## 8. Retencao e Custos

| Sinal                 | Volume Estimado/Dia | Retencao | Custo Estimado/Mes |
| --------------------- | ------------------- | -------- | ------------------ |
| Logs (Loki)           | 50 GB               | 30 dias  | S3 storage: ~$35   |
| Metricas (Prometheus) | 2M series           | 90 dias  | EBS: ~$150         |
| Traces (Tempo)        | 20 GB               | 14 dias  | S3: ~$10           |
| Profiles (Pyroscope)  | 5 GB                | 7 dias   | EBS: ~$15          |

**Otimizacoes aplicadas:**

- Sampling de traces: 10% para requests normais, 100% para erros
- Log level `debug` desabilitado em producao
- Metricas com cardinalidade alta agregadas no recording rules
- Profiles ativados apenas em horario de baixo trafego ou sob demanda
