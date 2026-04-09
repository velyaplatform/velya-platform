# Governanca de Library Panels

## Visao Geral

Library Panels no Grafana sao componentes visuais reutilizaveis compartilhados entre multiplos dashboards. Na plataforma Velya, eles sao tratados como artefatos criticos de infraestrutura de observabilidade, com ciclo de vida governado: criacao, aprovacao, versionamento, testes de regressao, propagacao, consistencia, deprecacao.

---

## Catalogo de Library Panels Velya

| UID                          | Nome                     | Tipo           | Versao | Dashboards Consumidores | Owner          | Criticidade |
|------------------------------|--------------------------|----------------|--------|------------------------|----------------|-------------|
| velya-golden-signals         | Golden Signals           | Row (4 panels) | 3.2    | 18                     | Platform Eng   | Critical    |
| velya-slo-status             | SLO Status               | Stat + Gauge   | 2.1    | 12                     | Platform Eng   | Critical    |
| velya-pod-resources          | Pod Resources            | Time Series    | 2.4    | 22                     | Platform Eng   | High        |
| velya-log-volume             | Log Volume by Level      | Bar Chart      | 1.8    | 15                     | Platform Eng   | High        |
| velya-error-log-stream       | Error Log Stream         | Logs           | 1.5    | 14                     | Platform Eng   | High        |
| velya-trace-duration-hist    | Trace Duration Histogram | Histogram      | 1.3    | 10                     | Platform Eng   | Medium      |
| velya-cpu-profile            | CPU Profile              | Flame Graph    | 1.1    | 5                      | Platform Eng   | Medium      |
| velya-alert-status           | Alert Status Timeline    | State Timeline | 1.6    | 8                      | Platform Eng   | High        |

---

## Ciclo de Vida

### 1. Proposta de Criacao

Toda nova library panel comeca com uma proposta formal.

```yaml
# library-panel-proposal.yaml
proposal:
  id: LP-2026-003
  name: "velya-request-rate-compare"
  description: "Painel comparativo de request rate atual vs periodo anterior"
  justification: |
    Multiplos dashboards de servico precisam comparar request rate
    com periodo anterior (dia, semana). Atualmente cada dashboard
    implementa diferente, gerando inconsistencia.
  type: "timeseries"
  datasource: "prometheus"
  queries:
    - name: "current"
      expr: 'sum(rate(http_requests_total{namespace="$namespace", job="$service"}[5m]))'
    - name: "previous_day"
      expr: 'sum(rate(http_requests_total{namespace="$namespace", job="$service"}[5m] offset 1d))'
  target_dashboards:
    - "velya-patient-api"
    - "velya-scheduling-api"
    - "velya-auth-service"
    - "velya-billing-service"
  owner: "platform-engineering"
  criticality: "high"
  reviewer: "sre-lead"
  submitted_by: "joao.silva"
  submitted_at: "2026-04-05"
```

### 2. Revisao e Aprovacao

| Criterio de Revisao                | Aprovador        | Obrigatorio |
|------------------------------------|------------------|-------------|
| Query e correta e performatica     | SRE Lead         | Sim         |
| Visualizacao e adequada            | Platform Lead    | Sim         |
| Unidades e thresholds corretos     | Dashboard Owner  | Sim         |
| Descricao e titulo claros          | Qualquer revisor | Sim         |
| Nao duplica library panel existente| Platform Eng     | Sim         |
| Testada em pelo menos 2 dashboards | Autor            | Sim         |

### 3. Versionamento

Library panels seguem versionamento semantico:

```
MAJOR.MINOR.PATCH

MAJOR: Mudanca que quebra compatibilidade (ex: nova query que requer nova variavel)
MINOR: Nova funcionalidade sem quebra (ex: adicionar threshold, nova cor)
PATCH: Correcao de bug sem mudanca funcional (ex: fix label, fix unidade)
```

#### Registro de Versoes

```json
{
  "uid": "velya-golden-signals",
  "versions": [
    {
      "version": "3.2",
      "date": "2026-04-01",
      "author": "maria.santos",
      "change_type": "minor",
      "description": "Adicionado threshold amarelo em 70% para saturacao",
      "breaking_change": false,
      "tested_dashboards": ["velya-patient-api", "velya-scheduling-api"],
      "regression_test_passed": true
    },
    {
      "version": "3.1",
      "date": "2026-03-15",
      "author": "joao.silva",
      "change_type": "minor",
      "description": "Atualizado legend format para incluir namespace",
      "breaking_change": false,
      "tested_dashboards": ["velya-patient-api"],
      "regression_test_passed": true
    },
    {
      "version": "3.0",
      "date": "2026-02-01",
      "author": "pedro.lima",
      "change_type": "major",
      "description": "Migrado de http_requests_total para http_server_requests_total (OTel)",
      "breaking_change": true,
      "migration_guide": "Atualizar variavel $service para usar job label do OTel",
      "tested_dashboards": ["velya-patient-api", "velya-auth-service", "velya-billing-service"],
      "regression_test_passed": true
    }
  ]
}
```

### 4. Testes de Regressao

Antes de publicar qualquer atualizacao, a library panel deve passar por testes de regressao.

```yaml
# regression-test-config.yaml
regression_tests:
  velya-golden-signals:
    test_scenarios:
      - name: "query_returns_data"
        description: "Todas as 4 queries retornam dados com variaveis padrao"
        method: "execute_queries_with_defaults"
        expected: "all_queries_return_data"

      - name: "query_performance"
        description: "Queries executam em tempo aceitavel"
        method: "measure_query_duration"
        expected: "all_queries < 3s"

      - name: "rendering"
        description: "Painel renderiza sem erros visuais"
        method: "screenshot_comparison"
        expected: "no_render_errors"

      - name: "variable_resolution"
        description: "Todas as variaveis referenciadas resolvem"
        method: "check_variable_resolution"
        expected: "all_variables_resolve"

      - name: "cross_dashboard_consistency"
        description: "Painel funciona em todos os dashboards consumidores"
        method: "test_in_all_consumers"
        expected: "works_in_all_dashboards"

      - name: "threshold_validation"
        description: "Thresholds sao atingidos com dados reais"
        method: "check_threshold_visibility"
        expected: "thresholds_visible_with_real_data"

    test_environments:
      - name: "staging"
        grafana_url: "http://grafana-staging.velya.health"
      - name: "preview"
        grafana_url: "http://grafana-preview.velya.health"
```

### 5. Propagacao de Atualizacao

Quando uma library panel e atualizada, a mudanca se propaga automaticamente para todos os dashboards consumidores via Grafana.

```
ATUALIZACAO DA LIBRARY PANEL
|
+--> Grafana propaga automaticamente para dashboards consumidores
|
+--> DAE detecta mudanca no scan de inventario
|
+--> DAE recalcula health score de todos os dashboards consumidores
|
+--> Se algum dashboard degradou:
|    |
|    +--> DAE executa diagnostico (Passo 14: Library Panel Regression)
|    |
|    +--> Se regressao confirmada:
|         |
|         +--> DAE reverte library panel (SA-05)
|         +--> Notifica autor e owner
|
+--> Se todos os dashboards mantiveram score:
     |
     +--> Registra propagacao bem-sucedida no audit trail
```

#### Metricas de Propagacao

```promql
# Tempo desde ultima atualizacao de library panel
time() - dae_library_panel_last_update_timestamp{uid="velya-golden-signals"}

# Dashboards afetados por atualizacao
dae_library_panel_consumers_count{uid="velya-golden-signals"}

# Dashboards que degradaram apos atualizacao
dae_library_panel_regression_count{uid="velya-golden-signals"}

# Taxa de sucesso de propagacao
sum(dae_library_panel_propagation_success_total) /
sum(dae_library_panel_propagation_total) * 100
```

### 6. Deteccao de Divergencia

Verifica se algum dashboard alterou a library panel localmente, quebrando a consistencia.

```yaml
divergence_detection:
  check_frequency: "*/30 * * * *"  # a cada 30 min
  method: |
    Para cada library panel:
      1. Obter JSON da library panel central
      2. Para cada dashboard consumidor:
         a. Obter JSON do painel no dashboard
         b. Comparar com JSON da library panel
         c. Se diferente: marcar como divergente
  actions_on_divergence:
    - severity: warning
    - notify: dashboard_owner
    - log: divergence_details
    - metric: dae_library_panel_divergence{uid, dashboard_uid}
  auto_correction:
    enabled: true
    condition: "divergence_is_local_edit AND library_panel_is_source_of_truth"
    action: "force_sync_from_library_panel"
```

### 7. Processo de Deprecacao

```yaml
deprecation_process:
  stages:
    - stage: "announce"
      duration: "30d"
      actions:
        - add_tag: "deprecated"
        - add_description_prefix: "[DEPRECATED] "
        - notify_all_consumers: true
        - create_migration_guide: true
        - metric: dae_library_panel_deprecated{uid, replacement_uid}

    - stage: "warn"
      duration: "30d"
      actions:
        - add_warning_annotation: "Este library panel sera removido em {removal_date}"
        - block_new_usage: true
        - weekly_reminder_to_consumers: true

    - stage: "migrate"
      duration: "14d"
      actions:
        - auto_replace_in_consumers: true
        - condition: "replacement_panel_exists AND replacement_tested"
        - fallback: "manual_migration_required"

    - stage: "remove"
      actions:
        - verify_zero_consumers: true
        - if_consumers_remain: "abort_and_escalate"
        - if_zero_consumers: "delete_library_panel"
        - archive: "s3://velya-observability-archive/library-panels/"
```

---

## CronJob de Health Check de Library Panels

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: dae-library-panel-health
  namespace: velya-observability
  labels:
    app: dashboard-assurance-engine
    component: library-panel-health
spec:
  schedule: "*/15 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 180
      template:
        metadata:
          labels:
            app: dae-library-panel-health
          annotations:
            prometheus.io/scrape: "true"
            prometheus.io/port: "8080"
        spec:
          serviceAccountName: dae-scanner
          containers:
          - name: library-panel-checker
            image: velya/dae-library-panel-checker:1.4.0
            env:
            - name: GRAFANA_URL
              value: "http://grafana.velya-observability.svc:3000"
            - name: GRAFANA_TOKEN
              valueFrom:
                secretKeyRef:
                  name: dae-credentials
                  key: grafana-api-token
            - name: PUSHGATEWAY_URL
              value: "http://prometheus-pushgateway.velya-observability.svc:9091"
            command:
            - python3
            - /app/library_panel_health.py
            args:
            - --grafana-url=$(GRAFANA_URL)
            - --check-versions
            - --check-divergence
            - --check-consumers
            - --check-deprecated
            - --push-metrics
            resources:
              requests:
                cpu: 50m
                memory: 64Mi
              limits:
                cpu: 200m
                memory: 128Mi
          restartPolicy: OnFailure
```

---

## Alertas de Library Panel

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: dae-library-panel-alerts
  namespace: velya-observability
spec:
  groups:
  - name: library-panel-governance
    interval: 60s
    rules:
    - alert: LibraryPanelRegressionDetected
      expr: dae_library_panel_regression_count > 0
      for: 5m
      labels:
        severity: warning
        team: platform
      annotations:
        summary: "Library panel {{ $labels.uid }} causou regressao em {{ $value }} dashboards"
        description: "Uma atualizacao recente do library panel causou degradacao em dashboards consumidores."

    - alert: LibraryPanelDivergenceDetected
      expr: dae_library_panel_divergence > 0
      for: 30m
      labels:
        severity: info
        team: platform
      annotations:
        summary: "Library panel {{ $labels.uid }} divergiu no dashboard {{ $labels.dashboard_uid }}"
        description: "Um dashboard alterou localmente a library panel, quebrando consistencia."

    - alert: DeprecatedLibraryPanelStillInUse
      expr: dae_library_panel_deprecated{stage="remove"} > 0 and dae_library_panel_consumers_count > 0
      for: 1h
      labels:
        severity: warning
        team: platform
      annotations:
        summary: "Library panel deprecated {{ $labels.uid }} ainda tem {{ $value }} consumidores"

    - alert: LibraryPanelWithoutOwner
      expr: dae_library_panel_has_owner == 0
      for: 24h
      labels:
        severity: info
        team: platform
      annotations:
        summary: "Library panel {{ $labels.uid }} sem owner atribuido"
```

---

## Matriz de Responsabilidade

| Atividade                      | Autor | Revisor | Platform Eng | SRE  | Dashboard Owner |
|-------------------------------|-------|---------|--------------|------|-----------------|
| Propor nova library panel     | R     | C       | A            | C    | I               |
| Revisar proposta              | I     | R       | A            | C    | I               |
| Implementar library panel     | R     | C       | A            | I    | I               |
| Testar regressao              | R     | C       | C            | I    | I               |
| Aprovar publicacao            | I     | I       | R/A          | C    | I               |
| Monitorar propagacao          | I     | I       | R            | C    | I               |
| Detectar divergencia          | -     | -       | R (DAE)      | I    | I               |
| Iniciar deprecacao            | I     | I       | R/A          | C    | C               |
| Migrar consumidores           | I     | I       | R            | C    | R               |

**R** = Responsavel | **A** = Aprovador | **C** = Consultado | **I** = Informado

---

## Metricas Operacionais

```promql
# Total de library panels
dae_library_panels_total

# Library panels por criticidade
dae_library_panels_total_by_criticality{criticality="critical"}

# Media de consumidores por library panel
avg(dae_library_panel_consumers_count)

# Library panels com divergencia
count(dae_library_panel_divergence > 0)

# Library panels deprecated
count(dae_library_panel_deprecated == 1)

# Atualizacoes de library panel nos ultimos 7 dias
increase(dae_library_panel_updates_total[7d])

# Reversoes de library panel
increase(dae_library_panel_reverts_total[30d])
```
