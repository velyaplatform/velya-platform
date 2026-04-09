# Modelo de Integridade de Datasources

## Visao Geral

Este documento define o modelo de validacao continua de integridade para todos os datasources do Grafana na plataforma Velya. Cada datasource e testado periodicamente em multiplas dimensoes: disponibilidade, credenciais, timeout, permissoes, compatibilidade de schema e capacidade de resposta a queries reais.

---

## Datasources da Stack Velya

| Datasource   | Tipo       | URL Interna                                        | Criticidade | Cadencia de Teste |
|-------------|------------|----------------------------------------------------|-----------  |-------------------|
| Prometheus  | prometheus | http://prometheus.velya-observability.svc:9090      | Critical    | 1 min             |
| Loki        | loki       | http://loki.velya-observability.svc:3100            | Critical    | 1 min             |
| Tempo       | tempo      | http://tempo.velya-observability.svc:3200           | High        | 2 min             |
| Pyroscope   | grafana-pyroscope | http://pyroscope.velya-observability.svc:4040 | Medium      | 5 min             |
| Alertmanager| alertmanager| http://alertmanager.velya-observability.svc:9093    | Critical    | 2 min             |

---

## Dimensoes de Validacao

### 1. Disponibilidade (Reachability)

Verifica se o endpoint do datasource responde a requests HTTP basicos.

| Datasource   | Endpoint de Health      | Metodo | Response Esperada      |
|-------------|------------------------|--------|------------------------|
| Prometheus  | `/-/ready`             | GET    | 200 OK                 |
| Loki        | `/ready`               | GET    | 200 "ready"            |
| Tempo       | `/ready`               | GET    | 200 "ready"            |
| Pyroscope   | `/ready`               | GET    | 200 OK                 |
| Alertmanager| `/-/ready`             | GET    | 200 OK                 |

```promql
# Metrica de disponibilidade
dae_datasource_reachable{datasource="prometheus"} == 1

# Tempo de resposta do health check
dae_datasource_health_check_duration_seconds{datasource="prometheus"}
```

### 2. Validacao de Credenciais

Verifica se o token/credencial configurado no Grafana e aceito pelo datasource.

```yaml
# Teste de credencial para cada datasource
credential_tests:
  prometheus:
    method: GET
    url: "/api/v1/status/config"
    headers:
      Authorization: "Bearer ${GRAFANA_DATASOURCE_TOKEN}"
    expected_status: 200
    failure_indicates: "Token expirado ou revogado"

  loki:
    method: GET
    url: "/loki/api/v1/labels"
    headers:
      X-Scope-OrgID: "velya"
    expected_status: 200
    failure_indicates: "OrgID invalido ou token expirado"

  tempo:
    method: GET
    url: "/api/search"
    headers:
      Authorization: "Bearer ${GRAFANA_DATASOURCE_TOKEN}"
    expected_status: 200
    failure_indicates: "Token invalido"

  pyroscope:
    method: GET
    url: "/pyroscope/api/v1/labels"
    expected_status: 200
    failure_indicates: "Credencial invalida"
```

### 3. Deteccao de Timeout

Verifica se o datasource responde dentro do tempo aceitavel.

| Datasource   | Timeout Aceitavel | Timeout Critico | Acao se Critico              |
|-------------|-------------------|-----------------|------------------------------|
| Prometheus  | < 2s              | > 5s            | Alerta + investigar carga    |
| Loki        | < 3s              | > 10s           | Alerta + verificar ingestao  |
| Tempo       | < 5s              | > 15s           | Alerta + verificar compactacao|
| Pyroscope   | < 3s              | > 10s           | Alerta + verificar storage   |
| Alertmanager| < 1s              | > 3s            | Alerta critico imediato      |

```promql
# Detectar timeouts
dae_datasource_health_check_duration_seconds{datasource="prometheus"} > 5

# P95 de latencia de health check por datasource
histogram_quantile(0.95,
  rate(dae_datasource_health_check_duration_seconds_bucket[5m])
)
```

### 4. Verificacao de Permissoes

Testa se o service account do Grafana tem permissoes suficientes para as operacoes necessarias.

```yaml
permission_tests:
  prometheus:
    - operation: "query"
      test_query: "up"
      description: "Capacidade de executar queries PromQL"
    - operation: "metadata"
      test_endpoint: "/api/v1/metadata"
      description: "Acesso a metadados de metricas"
    - operation: "targets"
      test_endpoint: "/api/v1/targets"
      description: "Visualizar targets de scrape"
    - operation: "rules"
      test_endpoint: "/api/v1/rules"
      description: "Visualizar regras de alerting"

  loki:
    - operation: "query"
      test_query: '{namespace="velya"} | limit 1'
      description: "Capacidade de executar queries LogQL"
    - operation: "labels"
      test_endpoint: "/loki/api/v1/labels"
      description: "Listar labels disponiveis"
    - operation: "tail"
      test_endpoint: "/loki/api/v1/tail"
      description: "Capacidade de tail de logs"

  tempo:
    - operation: "search"
      test_endpoint: "/api/search"
      description: "Buscar traces"
    - operation: "trace_by_id"
      test_endpoint: "/api/traces/{traceID}"
      description: "Buscar trace por ID"

  pyroscope:
    - operation: "query"
      test_query: "process_cpu:cpu:nanoseconds:cpu:nanoseconds"
      description: "Consultar profiles"
    - operation: "labels"
      test_endpoint: "/pyroscope/api/v1/labels"
      description: "Listar labels de profiling"
```

### 5. Verificacao de Endpoint

Valida que a URL configurada no datasource do Grafana aponta para o servico correto.

```yaml
endpoint_verification:
  prometheus:
    expected_build_info_metric: "prometheus_build_info"
    expected_version_prefix: "2."
    verify_query: 'prometheus_build_info{}'

  loki:
    expected_endpoint: "/loki/api/v1/labels"
    expected_response_contains: "values"
    verify_query: '{namespace="velya"} | limit 1'

  tempo:
    expected_endpoint: "/api/echo"
    expected_response: "echo"

  pyroscope:
    expected_endpoint: "/pyroscope/api/v1/labels"
    expected_response_contains: "names"
```

### 6. Compatibilidade de Schema

Verifica se o datasource suporta as features e versoes esperadas pelo Grafana.

```yaml
schema_compatibility:
  prometheus:
    minimum_version: "2.45.0"
    required_features:
      - "exemplars"
      - "native_histograms"
      - "remote_write_receiver"
    check_api_version: "/api/v1/status/buildinfo"

  loki:
    minimum_version: "2.9.0"
    required_features:
      - "structured_metadata"
      - "pattern_parser"
      - "detected_fields"
    check_api_version: "/loki/api/v1/status/buildinfo"

  tempo:
    minimum_version: "2.3.0"
    required_features:
      - "search"
      - "service_graph"
      - "span_metrics"
    check_api_version: "/api/status/buildinfo"

  pyroscope:
    minimum_version: "1.2.0"
    required_features:
      - "query_api"
      - "label_values"
```

---

## CronJob de Validacao Automatizada

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: dae-datasource-validator
  namespace: velya-observability
  labels:
    app: dashboard-assurance-engine
    component: datasource-validator
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      backoffLimit: 1
      activeDeadlineSeconds: 120
      template:
        metadata:
          labels:
            app: dae-datasource-validator
          annotations:
            prometheus.io/scrape: "true"
            prometheus.io/port: "8080"
            prometheus.io/path: "/metrics"
        spec:
          serviceAccountName: dae-validator
          containers:
          - name: datasource-validator
            image: velya/dae-datasource-validator:1.4.0
            ports:
            - containerPort: 8080
              name: metrics
            env:
            - name: GRAFANA_URL
              value: "http://grafana.velya-observability.svc:3000"
            - name: GRAFANA_TOKEN
              valueFrom:
                secretKeyRef:
                  name: dae-credentials
                  key: grafana-api-token
            - name: VALIDATION_CONFIG
              value: "/config/datasource-validation.yaml"
            - name: PUSHGATEWAY_URL
              value: "http://prometheus-pushgateway.velya-observability.svc:9091"
            command:
            - python3
            - /app/datasource_validator.py
            args:
            - --config=$(VALIDATION_CONFIG)
            - --grafana-url=$(GRAFANA_URL)
            - --grafana-token=$(GRAFANA_TOKEN)
            - --push-metrics
            - --pushgateway-url=$(PUSHGATEWAY_URL)
            volumeMounts:
            - name: config
              mountPath: /config
            resources:
              requests:
                cpu: 50m
                memory: 64Mi
              limits:
                cpu: 200m
                memory: 128Mi
          volumes:
          - name: config
            configMap:
              name: dae-datasource-validation-config
          restartPolicy: OnFailure
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: dae-datasource-validation-config
  namespace: velya-observability
data:
  datasource-validation.yaml: |
    datasources:
      - name: Prometheus
        type: prometheus
        url: http://prometheus.velya-observability.svc:9090
        health_endpoint: /-/ready
        test_query: "up"
        timeout: 5s
        criticality: critical
        checks:
          - reachability
          - credentials
          - timeout
          - permissions
          - endpoint_verification
          - schema_compatibility

      - name: Loki
        type: loki
        url: http://loki.velya-observability.svc:3100
        health_endpoint: /ready
        test_query: '{namespace="velya"} | limit 1'
        timeout: 10s
        criticality: critical
        checks:
          - reachability
          - credentials
          - timeout
          - permissions
          - endpoint_verification
          - schema_compatibility

      - name: Tempo
        type: tempo
        url: http://tempo.velya-observability.svc:3200
        health_endpoint: /ready
        test_query: "{}"
        timeout: 15s
        criticality: high
        checks:
          - reachability
          - credentials
          - timeout
          - permissions
          - endpoint_verification

      - name: Pyroscope
        type: grafana-pyroscope
        url: http://pyroscope.velya-observability.svc:4040
        health_endpoint: /ready
        timeout: 10s
        criticality: medium
        checks:
          - reachability
          - credentials
          - timeout
          - permissions

    thresholds:
      response_time_warning: 2s
      response_time_critical: 10s
      consecutive_failures_warning: 2
      consecutive_failures_critical: 5

    notifications:
      slack_channel: "#velya-observability-alerts"
      pagerduty_service: "velya-platform"
```

---

## Metricas Exportadas

```
# HELP dae_datasource_reachable Se o datasource esta acessivel (1=sim, 0=nao)
# TYPE dae_datasource_reachable gauge
dae_datasource_reachable{datasource="prometheus", type="prometheus"} 1
dae_datasource_reachable{datasource="loki", type="loki"} 1
dae_datasource_reachable{datasource="tempo", type="tempo"} 1
dae_datasource_reachable{datasource="pyroscope", type="grafana-pyroscope"} 1

# HELP dae_datasource_credentials_valid Se as credenciais sao validas (1=sim, 0=nao)
# TYPE dae_datasource_credentials_valid gauge
dae_datasource_credentials_valid{datasource="prometheus"} 1

# HELP dae_datasource_health_check_duration_seconds Tempo de resposta do health check
# TYPE dae_datasource_health_check_duration_seconds histogram
dae_datasource_health_check_duration_seconds_bucket{datasource="prometheus", le="0.1"} 45
dae_datasource_health_check_duration_seconds_bucket{datasource="prometheus", le="0.5"} 98
dae_datasource_health_check_duration_seconds_bucket{datasource="prometheus", le="1"} 100

# HELP dae_datasource_query_success Se a query de teste executou com sucesso
# TYPE dae_datasource_query_success gauge
dae_datasource_query_success{datasource="prometheus", query_type="test"} 1

# HELP dae_datasource_permission_valid Se todas as permissoes estao OK
# TYPE dae_datasource_permission_valid gauge
dae_datasource_permission_valid{datasource="prometheus", operation="query"} 1
dae_datasource_permission_valid{datasource="prometheus", operation="metadata"} 1

# HELP dae_datasource_schema_compatible Se o schema e compativel
# TYPE dae_datasource_schema_compatible gauge
dae_datasource_schema_compatible{datasource="prometheus", feature="exemplars"} 1

# HELP dae_datasource_consecutive_failures Falhas consecutivas do health check
# TYPE dae_datasource_consecutive_failures gauge
dae_datasource_consecutive_failures{datasource="prometheus"} 0

# HELP dae_datasource_last_success_timestamp Timestamp da ultima validacao bem-sucedida
# TYPE dae_datasource_last_success_timestamp gauge
dae_datasource_last_success_timestamp{datasource="prometheus"} 1.712345678e+09
```

---

## Alertas de Integridade de Datasource

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: dae-datasource-integrity-alerts
  namespace: velya-observability
spec:
  groups:
  - name: datasource-integrity
    interval: 30s
    rules:
    - alert: DatasourceUnreachable
      expr: dae_datasource_reachable == 0
      for: 2m
      labels:
        severity: critical
        team: platform
      annotations:
        summary: "Datasource {{ $labels.datasource }} inacessivel"
        description: "O datasource {{ $labels.datasource }} ({{ $labels.type }}) nao responde ao health check ha mais de 2 minutos."
        runbook_url: "https://docs.velya.health/runbooks/datasource-unreachable"

    - alert: DatasourceCredentialsInvalid
      expr: dae_datasource_credentials_valid == 0
      for: 1m
      labels:
        severity: critical
        team: platform
      annotations:
        summary: "Credenciais invalidas para datasource {{ $labels.datasource }}"
        description: "O token ou credencial do datasource {{ $labels.datasource }} foi rejeitado. Verificar rotacao de secrets."

    - alert: DatasourceHighLatency
      expr: |
        histogram_quantile(0.95,
          rate(dae_datasource_health_check_duration_seconds_bucket[5m])
        ) > 5
      for: 5m
      labels:
        severity: warning
        team: platform
      annotations:
        summary: "Datasource {{ $labels.datasource }} com latencia alta"
        description: "P95 de latencia do health check acima de 5 segundos."

    - alert: DatasourceConsecutiveFailures
      expr: dae_datasource_consecutive_failures >= 3
      for: 1m
      labels:
        severity: critical
        team: platform
      annotations:
        summary: "Datasource {{ $labels.datasource }} com {{ $value }} falhas consecutivas"
        description: "O datasource falhou em 3 ou mais health checks consecutivos."

    - alert: DatasourceSchemaIncompatible
      expr: dae_datasource_schema_compatible == 0
      for: 10m
      labels:
        severity: warning
        team: platform
      annotations:
        summary: "Datasource {{ $labels.datasource }} com feature {{ $labels.feature }} incompativel"
        description: "A versao ou configuracao do datasource nao suporta a feature requerida."

    - alert: DatasourcePermissionDenied
      expr: dae_datasource_permission_valid == 0
      for: 5m
      labels:
        severity: warning
        team: platform
      annotations:
        summary: "Permissao {{ $labels.operation }} negada no datasource {{ $labels.datasource }}"
        description: "O service account do Grafana nao tem permissao para a operacao {{ $labels.operation }}."
```

---

## Arvore de Decisao para Falha de Datasource

```
DATASOURCE FALHOU?
|
+-- Health endpoint nao responde?
|   |
|   +-- Pod do datasource esta running?
|   |   |
|   |   +-- NAO: Verificar deployment, PVC, node scheduling
|   |   +-- SIM: Verificar readiness probe, restart count
|   |
|   +-- Service do Kubernetes resolve DNS?
|   |   |
|   |   +-- NAO: Verificar Service, CoreDNS, namespace
|   |   +-- SIM: Verificar NetworkPolicy, port
|   |
|   +-- Conectividade de rede OK?
|       |
|       +-- NAO: Verificar CNI, NetworkPolicy, Security Groups (EKS)
|       +-- SIM: Problema interno do datasource, verificar logs
|
+-- Credencial rejeitada?
|   |
|   +-- Token expirou?
|   |   +-- SIM: Renovar token, verificar rotacao automatica
|   |   +-- NAO: Token foi revogado ou alterado
|   |
|   +-- OrgID correto? (Loki multi-tenant)
|       +-- NAO: Corrigir header X-Scope-OrgID
|       +-- SIM: Verificar RBAC do datasource
|
+-- Timeout excedido?
|   |
|   +-- Datasource sobrecarregado?
|   |   +-- SIM: Verificar recursos (CPU/memoria), queries pesadas
|   |   +-- NAO: Verificar storage backend (S3, EBS)
|   |
|   +-- Query de teste muito complexa?
|       +-- SIM: Simplificar query de teste
|       +-- NAO: Problema de rede ou performance
|
+-- Permissao negada?
    |
    +-- RBAC do datasource mudou?
    |   +-- SIM: Restaurar permissoes
    |   +-- NAO: Service account alterado
    |
    +-- Multi-tenancy afetando?
        +-- SIM: Verificar tenant/org configuration
        +-- NAO: Bug no datasource, verificar changelog
```

---

## Dashboard de Integridade de Datasources

```json
{
  "dashboard": {
    "uid": "velya-datasource-integrity",
    "title": "Velya - Integridade de Datasources",
    "tags": ["velya", "datasource", "assurance", "meta-monitoring"],
    "panels": [
      {
        "title": "Status de Disponibilidade",
        "type": "state-timeline",
        "gridPos": {"h": 6, "w": 24, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "dae_datasource_reachable",
            "legendFormat": "{{ datasource }}"
          }
        ]
      },
      {
        "title": "Latencia de Health Check (P95)",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 6},
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(dae_datasource_health_check_duration_seconds_bucket[5m]))",
            "legendFormat": "{{ datasource }}"
          }
        ]
      },
      {
        "title": "Falhas Consecutivas",
        "type": "stat",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 6},
        "targets": [
          {
            "expr": "dae_datasource_consecutive_failures",
            "legendFormat": "{{ datasource }}"
          }
        ]
      },
      {
        "title": "Score de Integridade por Datasource",
        "type": "bargauge",
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 14},
        "targets": [
          {
            "expr": "(dae_datasource_reachable * 30 + dae_datasource_credentials_valid * 25 + dae_datasource_query_success * 25 + (1 - clamp_max(dae_datasource_consecutive_failures / 5, 1)) * 20)",
            "legendFormat": "{{ datasource }}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "min": 0,
            "max": 100,
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "yellow", "value": 60},
                {"color": "green", "value": 85}
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

## Procedimento de Rotacao de Credenciais

| Passo | Acao                                              | Responsavel     | Automacao       |
|-------|--------------------------------------------------|-----------------|-----------------|
| 1     | Gerar nova credencial no datasource               | Platform Eng    | Terraform/Vault |
| 2     | Atualizar Secret no Kubernetes                    | Platform Eng    | External Secrets|
| 3     | Reiniciar Grafana ou recarregar datasources        | Platform Eng    | Grafana API     |
| 4     | Executar validacao de integridade                  | DAE automatico  | CronJob         |
| 5     | Confirmar que health check passa                   | DAE automatico  | Alerta          |
| 6     | Revogar credencial antiga                          | Platform Eng    | Terraform/Vault |
