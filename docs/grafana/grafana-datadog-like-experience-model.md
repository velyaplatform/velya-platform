# Experiencia Tipo Datadog no Grafana OSS - Modelo de Implementacao

## Visao Geral

Este documento descreve como construir uma experiencia de usuario no Grafana OSS que se aproxima da fluidez e integracaoo do Datadog, usando exclusivamente ferramentas open-source da stack Velya: Grafana, Prometheus, Loki, Tempo, Pyroscope e OpenTelemetry/Alloy.

O principio central e: **correlacao instantanea entre metricas, logs, traces e profiles sem sair do contexto**.

---

## Principios da Experiencia Datadog-like

| Principio             | Datadog                         | Grafana OSS Equivalente                       |
| --------------------- | ------------------------------- | --------------------------------------------- |
| Visao unificada       | Single pane of glass            | Dashboard com mixed datasources + Explore     |
| Correlacao de sinais  | Metricas <-> Logs <-> Traces    | Data links + Correlations + Exemplars         |
| Navegacao contextual  | Click-through em qualquer sinal | Data links com variaveis de contexto          |
| Service-centric       | Service Map + APM               | Service Graph (Tempo) + dashboard por servico |
| Drilldown rapido      | Faceted search                  | Variable filters + ad-hoc filters + Explore   |
| Actionable dashboards | Runbooks inline                 | Annotations + links para runbooks             |
| Profiles integrados   | Continuous profiling            | Pyroscope datasource + flame graph panel      |

---

## Arquitetura de Correlacao de Sinais

```
                    +--------------------+
                    |   Dashboard        |
                    |   Service-Centric  |
                    +--------------------+
                           |
              +------------+------------+
              |            |            |
         Metricas       Logs        Traces
        (Prometheus)   (Loki)      (Tempo)
              |            |            |
              +-----+------+-----+-----+
                    |            |
               Exemplars    TraceID
                    |            |
              +-----+------+----+------+
              |            |           |
         Trace Detail   Log Detail  Profile
          (Tempo)       (Loki)     (Pyroscope)
```

---

## 1. Configuracao de Datasource Correlations

As correlations do Grafana permitem navegar entre datasources automaticamente.

### Prometheus -> Loki (Metricas para Logs)

```yaml
# Correlation: Quando clicar em uma metrica, abrir logs do mesmo servico
correlation:
  source_datasource: prometheus
  target_datasource: loki
  label: 'Ver Logs'
  description: 'Abrir logs do servico no periodo selecionado'
  config:
    type: 'query'
    target:
      query: '{namespace="${__data.fields.namespace}", pod=~"${__data.fields.pod}.*"}'
    transformations:
      - type: 'logfmt'
```

### Loki -> Tempo (Logs para Traces)

```yaml
# Configuracao do Loki datasource para derived fields
datasources:
  - name: Loki
    type: loki
    url: http://loki.velya-observability.svc:3100
    jsonData:
      derivedFields:
        - name: TraceID
          matcherRegex: '"traceID":"([a-f0-9]+)"'
          url: '${__value.raw}'
          datasourceUid: tempo
          matcherType: 'regex'
```

### Tempo -> Pyroscope (Traces para Profiles)

```yaml
# Configuracao do Tempo datasource para link com Pyroscope
datasources:
  - name: Tempo
    type: tempo
    url: http://tempo.velya-observability.svc:3200
    jsonData:
      tracesToProfiles:
        datasourceUid: pyroscope
        profileTypeId: 'process_cpu:cpu:nanoseconds:cpu:nanoseconds'
        tags:
          - key: 'service.name'
            value: 'service_name'
```

### Prometheus -> Tempo (Metricas para Traces via Exemplars)

```yaml
# Configuracao do Prometheus para exemplars
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus.velya-observability.svc:9090
    jsonData:
      exemplarTraceIdDestinations:
        - name: traceID
          datasourceUid: tempo
```

---

## 2. Data Links para Navegacao Contextual

Data Links transformam qualquer valor em um painel em um link navegavel.

### Exemplo: Painel de Latencia -> Traces Lentos

```json
{
  "fieldConfig": {
    "defaults": {
      "links": [
        {
          "title": "Ver traces lentos no Tempo",
          "url": "/explore?left={\"datasource\":\"tempo\",\"queries\":[{\"refId\":\"A\",\"queryType\":\"traceqlSearch\",\"filters\":[{\"id\":\"service-name\",\"tag\":\"service.name\",\"operator\":\"=\",\"value\":[\"${__data.fields.service}\"],\"valueType\":\"string\",\"scope\":\"resource\"},{\"id\":\"duration\",\"tag\":\"duration\",\"operator\":\">\",\"value\":[\"${__value.raw}ms\"],\"valueType\":\"duration\",\"scope\":\"intrinsic\"}]}],\"range\":{\"from\":\"${__from}\",\"to\":\"${__to}\"}}",
          "targetBlank": false
        },
        {
          "title": "Ver logs de erro do servico",
          "url": "/explore?left={\"datasource\":\"loki\",\"queries\":[{\"refId\":\"A\",\"expr\":\"{namespace=\\\"velya\\\", service_name=\\\"${__data.fields.service}\\\"} |= \\\"error\\\"\"}],\"range\":{\"from\":\"${__from}\",\"to\":\"${__to}\"}}",
          "targetBlank": false
        },
        {
          "title": "Ver profile de CPU",
          "url": "/explore?left={\"datasource\":\"pyroscope\",\"queries\":[{\"refId\":\"A\",\"labelSelector\":\"{service_name=\\\"${__data.fields.service}\\\"}\",\"profileTypeId\":\"process_cpu:cpu:nanoseconds:cpu:nanoseconds\"}],\"range\":{\"from\":\"${__from}\",\"to\":\"${__to}\"}}",
          "targetBlank": false
        }
      ]
    }
  }
}
```

### Exemplo: Painel de Erro Rate -> Runbook

```json
{
  "links": [
    {
      "title": "Runbook: Alta Taxa de Erro",
      "url": "https://docs.velya.health/runbooks/high-error-rate?service=${__data.fields.service}",
      "targetBlank": true,
      "icon": "book"
    }
  ]
}
```

---

## 3. Dashboard Service-Centric

Cada servico Velya tem um dashboard dedicado com visao 360 graus.

### Estrutura do Dashboard por Servico

```
+------------------------------------------------------------------+
| SERVICE: velya-patient-api                                        |
| Owner: backend | Criticality: Critical | SLO: 99.9%             |
+------------------------------------------------------------------+
|                                                                    |
| ROW 1: Golden Signals (metricas)                                  |
| [Request Rate] [Error Rate] [Latency P50/P95/P99] [Saturation]   |
|                                                                    |
| ROW 2: SLO Status                                                 |
| [Error Budget] [SLO Compliance 30d] [Burn Rate]                   |
|                                                                    |
| ROW 3: Infraestrutura                                             |
| [CPU] [Memory] [Network I/O] [Disk I/O] [Pod Count]              |
|                                                                    |
| ROW 4: Logs (Loki)                                                |
| [Log Volume by Level] [Recent Errors] [Log Stream]                |
|                                                                    |
| ROW 5: Traces (Tempo)                                             |
| [Trace Duration Distribution] [Slow Traces] [Error Traces]       |
|                                                                    |
| ROW 6: Profiles (Pyroscope)                                       |
| [CPU Profile] [Memory Allocation] [Goroutine/Thread Count]       |
|                                                                    |
| ROW 7: Dependencias                                               |
| [Upstream Health] [Downstream Health] [Database Latency]          |
+------------------------------------------------------------------+
```

### Variaveis do Dashboard

```json
{
  "templating": {
    "list": [
      {
        "name": "namespace",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(up{job=~\"velya-.*\"}, namespace)",
        "current": { "text": "velya", "value": "velya" },
        "refresh": 2
      },
      {
        "name": "service",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(up{namespace=\"$namespace\"}, job)",
        "refresh": 2
      },
      {
        "name": "pod",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(kube_pod_info{namespace=\"$namespace\", pod=~\"$service.*\"}, pod)",
        "includeAll": true,
        "multi": true,
        "refresh": 2
      },
      {
        "name": "environment",
        "type": "custom",
        "options": [
          { "text": "production", "value": "production" },
          { "text": "staging", "value": "staging" }
        ],
        "current": { "text": "production", "value": "production" }
      }
    ]
  }
}
```

---

## 4. Explore como Centro de Investigacao

O Explore do Grafana e o equivalente ao investigation mode do Datadog.

### Workflow de Investigacao

```
1. ALERTA DISPARA
   |
   +--> Link no alerta leva para Explore com query pre-preenchida
   |
2. EXPLORE: METRICAS (Prometheus)
   |
   +--> Visualizar metrica que disparou o alerta
   +--> Identificar periodo exato de anomalia
   +--> Clicar em exemplar para ir ao trace
   |
3. EXPLORE: TRACES (Tempo)
   |
   +--> Ver trace completo com spans
   +--> Identificar span lento ou com erro
   +--> Clicar em "Ver Logs" para logs do span
   +--> Clicar em "Ver Profile" para profile do span
   |
4. EXPLORE: LOGS (Loki)
   |
   +--> Filtrar logs pelo traceID
   +--> Ver stack trace completo
   +--> Identificar erro raiz
   |
5. EXPLORE: PROFILES (Pyroscope)
   |
   +--> Ver flame graph do periodo
   +--> Identificar funcao com alto consumo
   +--> Comparar com baseline
```

### Query Inspector como Ferramenta de Debug

```
Para cada painel ou query no Explore:

1. Abrir Query Inspector (icone de inspetor)
2. Aba "Query": ver a query exata enviada ao datasource
3. Aba "Data": ver os dados retornados
4. Aba "Stats": ver tempo de execucao, bytes retornados
5. Aba "JSON": ver o modelo completo do request/response
```

---

## 5. Service Map (Mapa de Servicos)

O Service Graph do Tempo fornece uma visao topologica dos servicos.

### Configuracao do Tempo para Service Graph

```yaml
# Configuracao do Tempo para gerar metricas de service graph
overrides:
  metrics_generator:
    processor:
      service_graphs:
        enabled: true
        dimensions:
          - 'service.namespace'
          - 'http.method'
          - 'http.status_code'
        enable_client_server_prefix: true
        peer_attributes:
          - 'db.system'
          - 'messaging.system'
      span_metrics:
        enabled: true
        dimensions:
          - 'http.method'
          - 'http.status_code'
          - 'http.route'
```

### Painel de Node Graph

```json
{
  "type": "nodeGraph",
  "title": "Mapa de Servicos Velya",
  "datasource": "Tempo",
  "targets": [
    {
      "queryType": "serviceMap",
      "serviceMapQuery": "{resource.service.namespace=\"velya\"}"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "links": [
        {
          "title": "Dashboard do Servico",
          "url": "/d/velya-service-detail?var-service=${__data.fields.id}",
          "targetBlank": false
        }
      ]
    }
  }
}
```

---

## 6. Library Panels para Consistencia

Library Panels garantem que componentes visuais reutilizaveis sejam consistentes em todos os dashboards.

### Library Panels Padrao Velya

| Library Panel               | Tipo           | Uso                                                |
| --------------------------- | -------------- | -------------------------------------------------- |
| `velya-golden-signals`      | Row            | Golden signals (rate, errors, latency, saturation) |
| `velya-slo-status`          | Stat + Gauge   | Status atual do SLO com error budget               |
| `velya-pod-resources`       | Time series    | CPU, memoria, network por pod                      |
| `velya-log-volume`          | Bar chart      | Volume de logs por nivel                           |
| `velya-error-log-stream`    | Logs           | Stream de logs de erro                             |
| `velya-trace-duration-hist` | Histogram      | Distribuicao de duracao de traces                  |
| `velya-cpu-profile`         | Flame graph    | Profile de CPU do Pyroscope                        |
| `velya-alert-status`        | State timeline | Status dos alertas do servico                      |

### Exemplo de Library Panel: Golden Signals

```json
{
  "uid": "velya-golden-signals",
  "name": "Velya Golden Signals",
  "type": "row",
  "model": {
    "panels": [
      {
        "title": "Request Rate",
        "type": "stat",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{namespace=\"$namespace\", job=\"$service\"}[5m]))",
            "legendFormat": "req/s"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "reqps",
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 1000 },
                { "color": "red", "value": 5000 }
              ]
            }
          }
        }
      },
      {
        "title": "Error Rate",
        "type": "stat",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{namespace=\"$namespace\", job=\"$service\", code=~\"5..\"}[5m])) / sum(rate(http_requests_total{namespace=\"$namespace\", job=\"$service\"}[5m])) * 100",
            "legendFormat": "error %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 1 },
                { "color": "red", "value": 5 }
              ]
            }
          }
        }
      },
      {
        "title": "Latency P95",
        "type": "stat",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace=\"$namespace\", job=\"$service\"}[5m])) by (le))",
            "legendFormat": "p95"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 0.5 },
                { "color": "red", "value": 2 }
              ]
            }
          }
        }
      },
      {
        "title": "Saturation (CPU)",
        "type": "gauge",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "avg(rate(container_cpu_usage_seconds_total{namespace=\"$namespace\", pod=~\"$service.*\"}[5m]) / on(pod) kube_pod_container_resource_limits{resource=\"cpu\", namespace=\"$namespace\", pod=~\"$service.*\"}) * 100",
            "legendFormat": "cpu %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "min": 0,
            "max": 100,
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 70 },
                { "color": "red", "value": 90 }
              ]
            }
          }
        }
      }
    ]
  }
}
```

---

## 7. Annotations para Contexto Operacional

Annotations fornecem contexto temporal nos dashboards.

```json
{
  "annotations": {
    "list": [
      {
        "name": "Deployments",
        "datasource": "Prometheus",
        "expr": "changes(kube_deployment_status_observed_generation{namespace=\"$namespace\", deployment=\"$service\"}[1m]) > 0",
        "tagKeys": "deployment",
        "titleFormat": "Deploy: {{deployment}}",
        "textFormat": "Nova versao deployada",
        "iconColor": "blue",
        "enable": true
      },
      {
        "name": "Alertas Disparados",
        "datasource": "-- Grafana --",
        "type": "alert",
        "iconColor": "red",
        "enable": true
      },
      {
        "name": "Incidentes",
        "datasource": "Loki",
        "expr": "{namespace=\"velya\", source=\"incident-manager\"} |= \"incident_created\"",
        "tagKeys": "severity",
        "titleFormat": "Incidente: {{severity}}",
        "iconColor": "orange",
        "enable": true
      }
    ]
  }
}
```

---

## 8. Filtros Ad-Hoc para Exploracao Livre

```json
{
  "templating": {
    "list": [
      {
        "name": "Filters",
        "type": "adhoc",
        "datasource": "Prometheus",
        "description": "Filtros dinamicos - selecione qualquer label para filtrar"
      }
    ]
  }
}
```

---

## 9. Checklist de Implementacao

| Item                                          | Status | Prioridade |
| --------------------------------------------- | ------ | ---------- |
| Correlations Prometheus -> Loki configuradas  | [ ]    | P0         |
| Derived fields Loki -> Tempo configurados     | [ ]    | P0         |
| Exemplars Prometheus -> Tempo configurados    | [ ]    | P0         |
| Traces -> Profiles (Pyroscope) configurados   | [ ]    | P1         |
| Data links em todos os paineis de latencia    | [ ]    | P1         |
| Data links em todos os paineis de erro        | [ ]    | P1         |
| Dashboard service-centric para cada servico   | [ ]    | P1         |
| Library panels padrao criados                 | [ ]    | P1         |
| Service Graph do Tempo configurado            | [ ]    | P2         |
| Annotations de deploy configuradas            | [ ]    | P2         |
| Ad-hoc filters em dashboards de investigacao  | [ ]    | P2         |
| Links para runbooks em paineis criticos       | [ ]    | P2         |
| Logs/Traces/Metrics Drilldown apps instalados | [ ]    | P1         |
| Treinamento da equipe no workflow Explore     | [ ]    | P1         |

---

## 10. Comparativo Final

| Capacidade             | Datadog            | Grafana OSS Velya         | Gap            |
| ---------------------- | ------------------ | ------------------------- | -------------- |
| Correlacao automatica  | Nativo             | Correlations + Data Links | Minimo         |
| Service Map            | APM nativo         | Tempo Service Graph       | Funcional      |
| Log to Trace           | Nativo             | Derived Fields            | Equivalente    |
| Trace to Profile       | Nativo             | Tempo -> Pyroscope        | Equivalente    |
| Metric to Trace        | Nativo             | Exemplars                 | Equivalente    |
| Investigacao unificada | Investigation Mode | Explore com split view    | Funcional      |
| Dashboard templates    | Out-of-the-box     | Library Panels + mixins   | Requer esforco |
| Continuous profiling   | Nativo             | Pyroscope                 | Equivalente    |
| Custo                  | Alto (por host)    | Zero (licenca)            | Vantagem OSS   |
