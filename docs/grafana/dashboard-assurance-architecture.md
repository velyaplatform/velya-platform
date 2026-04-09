# Dashboard Assurance Engine - Arquitetura

## Visao Geral

O Dashboard Assurance Engine (DAE) e o sistema central de garantia de qualidade para todos os dashboards Grafana da plataforma hospitalar Velya. Ele inventaria, valida, diagnostica, remedia e audita continuamente cada dashboard, painel, datasource e variavel do ecossistema de observabilidade.

O objetivo e garantir que nenhum dashboard esteja quebrado, desatualizado, sem dono ou sem utilidade para a operacao hospitalar.

---

## Arquitetura de Alto Nivel

```
+------------------------------------------------------------------+
|                    Dashboard Assurance Engine                      |
+------------------------------------------------------------------+
|                                                                    |
|  +--------------+   +----------------+   +-------------------+    |
|  |  Inventario  |-->|  Health Score  |-->|  Diagnostico      |    |
|  |  Continuo    |   |  Calculator    |   |  Automatico       |    |
|  +--------------+   +----------------+   +-------------------+    |
|         |                   |                      |               |
|         v                   v                      v               |
|  +--------------+   +----------------+   +-------------------+    |
|  |  Ownership   |   |  Trend         |   |  Remediacao       |    |
|  |  Registry    |   |  Tracker       |   |  Segura           |    |
|  +--------------+   +----------------+   +-------------------+    |
|         |                   |                      |               |
|         v                   v                      v               |
|  +--------------+   +----------------+   +-------------------+    |
|  |  Audit       |   |  Alerting      |   |  Revalidacao      |    |
|  |  Trail       |   |  Integration   |   |  Pos-Acao         |    |
|  +--------------+   +----------------+   +-------------------+    |
|                                                                    |
+------------------------------------------------------------------+
          |                    |                      |
          v                    v                      v
   Grafana API          Prometheus             Git (Dashboard-as-Code)
```

---

## Componentes Principais

### 1. Inventario Continuo

O inventario varre a API do Grafana periodicamente e cataloga:

| Elemento         | Campos Coletados                                                                 |
|------------------|----------------------------------------------------------------------------------|
| Dashboard        | UID, titulo, pasta, versao, data_modificacao, tags, anotacoes                    |
| Painel           | ID, titulo, tipo, datasource, query, transformacoes, links, thresholds           |
| Datasource       | UID, tipo, URL, status_health, ultimo_teste, credencial_valida                   |
| Variavel         | Nome, tipo, datasource, query, valor_default, dependencias                       |
| Link             | Tipo (dashboard/externo), destino, validade                                      |
| Library Panel    | UID, versao, dashboards_consumidores, ultimo_update                              |
| Anotacao         | Tipo, datasource, query, visibilidade                                            |

#### CronJob de Inventario

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: dae-inventory-scanner
  namespace: velya-observability
  labels:
    app: dashboard-assurance-engine
    component: inventory
spec:
  schedule: "*/10 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 300
      template:
        spec:
          serviceAccountName: dae-scanner
          containers:
          - name: inventory-scanner
            image: velya/dae-scanner:1.4.0
            env:
            - name: GRAFANA_URL
              value: "http://grafana.velya-observability.svc:3000"
            - name: GRAFANA_TOKEN
              valueFrom:
                secretKeyRef:
                  name: dae-credentials
                  key: grafana-api-token
            - name: PROMETHEUS_URL
              value: "http://prometheus.velya-observability.svc:9090"
            - name: INVENTORY_OUTPUT
              value: "/data/inventory.json"
            command:
            - /bin/sh
            - -c
            - |
              python3 /app/inventory_scanner.py \
                --grafana-url=$GRAFANA_URL \
                --grafana-token=$GRAFANA_TOKEN \
                --prometheus-url=$PROMETHEUS_URL \
                --output=$INVENTORY_OUTPUT \
                --push-metrics
            volumeMounts:
            - name: data
              mountPath: /data
            resources:
              requests:
                cpu: 100m
                memory: 128Mi
              limits:
                cpu: 500m
                memory: 256Mi
          volumes:
          - name: data
            persistentVolumeClaim:
              claimName: dae-data
          restartPolicy: OnFailure
```

---

### 2. Ownership Registry

Cada dashboard deve ter um dono registrado. O ownership e obrigatorio e validado no pipeline de CI.

```yaml
# ownership-registry.yaml
dashboards:
  - uid: "velya-platform-overview"
    owner_role: "platform-engineering"
    owner_contact: "platform@velya.health"
    criticality: "critical"
    review_cadence: "weekly"
    escalation_chain:
      - "platform-lead"
      - "sre-oncall"
      - "cto"

  - uid: "velya-patient-flow"
    owner_role: "backend-engineering"
    owner_contact: "backend@velya.health"
    criticality: "high"
    review_cadence: "biweekly"
    escalation_chain:
      - "backend-lead"
      - "product-oncall"

  - uid: "velya-agent-orchestrator"
    owner_role: "ai-engineering"
    owner_contact: "ai@velya.health"
    criticality: "critical"
    review_cadence: "weekly"
    escalation_chain:
      - "ai-lead"
      - "sre-oncall"
```

---

### 3. Health Score - 11 Dimensoes

O Health Score e calculado para cada painel e agregado para o dashboard. Cada dimensao tem peso configuravel.

| # | Dimensao                    | Peso | Descricao                                                                 |
|---|----------------------------|------|---------------------------------------------------------------------------|
| 1 | Disponibilidade Datasource | 15   | O datasource responde e esta saudavel?                                    |
| 2 | Sucesso da Query           | 15   | A query executa sem erro?                                                 |
| 3 | Frescor dos Dados          | 12   | Os dados retornados estao dentro da janela esperada de frescor?           |
| 4 | Nao-Vazio                  | 12   | A query retorna dados (nao esta vazia quando deveria ter dados)?          |
| 5 | Integridade de Variaveis   | 8    | Todas as variaveis referenciadas existem e resolvem?                      |
| 6 | Integridade de Transformacoes | 8  | Todas as transformacoes aplicadas funcionam e produzem resultado?         |
| 7 | Integridade de Links       | 5    | Todos os links (data links, dashboard links) apontam para destinos validos? |
| 8 | Renderizacao               | 8    | O painel renderiza sem erro visual?                                       |
| 9 | Utilidade Semantica        | 7    | O painel tem titulo, descricao, unidade, e faz sentido no contexto?       |
| 10| Vinculacao de Alertas      | 5    | Paineis criticos tem alerta vinculado?                                    |
| 11| Ownership                  | 5    | O dashboard tem dono atribuido e ativo?                                   |

#### Formula de Calculo

```
health_score_panel = SUM(dimension_score[i] * weight[i]) / SUM(weight[i])

health_score_dashboard = AVG(health_score_panel[j]) para j em panels

# Thresholds
GREEN:  score >= 85
YELLOW: score >= 60 AND score < 85
RED:    score < 60
```

#### PromQL para Metricas de Health Score

```promql
# Health score medio por dashboard
avg by (dashboard_uid) (
  dae_panel_health_score{namespace="velya-observability"}
)

# Dashboards com score critico
dae_dashboard_health_score{namespace="velya-observability"} < 60

# Tendencia de degradacao (queda > 10 pontos em 1h)
dae_dashboard_health_score - dae_dashboard_health_score offset 1h < -10

# Dimensao com pior score global
bottomk(5,
  avg by (dimension) (
    dae_panel_dimension_score{namespace="velya-observability"}
  )
)

# Paineis sem dados que deveriam ter
dae_panel_dimension_score{dimension="not_empty", namespace="velya-observability"} == 0

# Datasources com falha de health check
dae_datasource_health{namespace="velya-observability"} == 0
```

---

### 4. Diagnostico Automatico

Quando um painel apresenta health score abaixo do threshold, o DAE executa a arvore de diagnostico automaticamente.

```yaml
# diagnostic-config.yaml
diagnostic:
  triggers:
    - condition: "health_score < 60"
      action: "full_diagnosis"
    - condition: "dimension_datasource_availability == 0"
      action: "datasource_diagnosis"
    - condition: "dimension_not_empty == 0"
      action: "no_data_diagnosis"
    - condition: "dimension_query_success == 0"
      action: "query_diagnosis"

  no_data_tree:
    max_depth: 14
    timeout_per_step: 10s
    steps:
      - check: "datasource_reachable"
      - check: "credentials_valid"
      - check: "query_syntax_valid"
      - check: "query_returns_data"
      - check: "time_range_appropriate"
      - check: "variables_resolve"
      - check: "labels_exist"
      - check: "transformations_valid"
      - check: "dependent_elements_ok"
      - check: "data_expected_in_context"
      - check: "data_freshness"
      - check: "missing_series_legitimate"
      - check: "render_vs_data"
      - check: "library_panel_regression"
```

---

### 5. Remediacao Segura

A remediacao segura opera em dois niveis: acoes automaticas (safe) e acoes que requerem aprovacao (gated).

#### Acoes Automaticas (Safe)

| Acao                              | Condicao                                      | Risco   |
|-----------------------------------|-----------------------------------------------|---------|
| Atualizar metadata de ownership   | Owner ausente, owner conhecido no registry     | Baixo   |
| Corrigir link quebrado            | Destino conhecido, URL atualizada              | Baixo   |
| Ajustar default de variavel       | Variavel com default invalido, valor correto conhecido | Baixo |
| Restaurar versao anterior         | Regressao clara detectada, versao anterior saudavel    | Medio  |
| Reverter library panel            | Regressao apos update de library panel         | Medio   |
| Corrigir time range inadequado    | Time range fora do padrao para o tipo de dado  | Baixo   |
| Remover painel orfao              | Painel sem query, sem titulo, sem uso          | Baixo   |
| Sincronizar do Git                | Dashboard divergiu do Git source of truth      | Medio   |

#### Acoes com Aprovacao (Gated)

| Acao                              | Razao                                          |
|-----------------------------------|-------------------------------------------------|
| Reescrever query critica          | Pode alterar semantica do monitoramento         |
| Alterar semantica de dashboard    | Impacto em decisoes operacionais                |
| Modificar thresholds criticos     | Pode gerar falsos positivos/negativos           |
| Remover painel critico            | Pode eliminar visibilidade importante           |
| Ajustar alertas de alta severidade| Impacto direto na resposta a incidentes         |

---

### 6. Audit Trail

Toda acao do DAE gera um registro de auditoria imutavel.

```json
{
  "audit_entry": {
    "id": "dae-audit-2026-04-08-001",
    "timestamp": "2026-04-08T14:30:00Z",
    "action_type": "auto_remediation",
    "action": "restore_previous_version",
    "target": {
      "dashboard_uid": "velya-patient-flow",
      "panel_id": 12,
      "panel_title": "Taxa de Admissao por Hora"
    },
    "trigger": {
      "health_score_before": 42,
      "failing_dimensions": ["query_success", "not_empty"],
      "diagnosis_result": "library_panel_regression"
    },
    "remediation": {
      "from_version": 47,
      "to_version": 46,
      "diff_summary": "Revertido library panel 'admission-rate' de v3.1 para v3.0",
      "diff_url": "https://grafana.velya.health/d/velya-patient-flow/versions/diff/46/47"
    },
    "validation": {
      "health_score_after": 91,
      "all_dimensions_passing": true,
      "revalidation_time": "2026-04-08T14:31:15Z"
    },
    "actor": "dae-engine",
    "reversible": true,
    "revert_instruction": "Restaurar dashboard velya-patient-flow para versao 47"
  }
}
```

#### Metricas de Auditoria

```promql
# Total de remediacoes automaticas por tipo
sum by (action_type) (
  increase(dae_remediation_total{namespace="velya-observability"}[24h])
)

# Taxa de sucesso de remediacoes
sum(dae_remediation_success_total) / sum(dae_remediation_total) * 100

# Remediacoes revertidas (indica problemas no diagnostico)
increase(dae_remediation_reverted_total{namespace="velya-observability"}[7d])

# Tempo medio de diagnostico + remediacao
histogram_quantile(0.95,
  rate(dae_remediation_duration_seconds_bucket{namespace="velya-observability"}[1h])
)
```

---

### 7. Pipeline de Validacao Continua

O DAE executa em ciclos continuos com cadencias diferentes:

| Ciclo              | Frequencia | Escopo                                                |
|--------------------|------------|-------------------------------------------------------|
| Inventario         | 10 min     | Scan completo de dashboards, paineis, datasources     |
| Health Score       | 5 min      | Calculo de score para todos os paineis                |
| Diagnostico        | On-demand  | Acionado quando score cai abaixo do threshold         |
| Remediacao         | On-demand  | Acionado pelo diagnostico quando acao segura existe   |
| Revalidacao        | Pos-acao   | Imediatamente apos qualquer remediacao                |
| Auditoria          | Continuo   | Registro de toda acao e mudanca                       |
| Report Semanal     | Semanal    | Resumo de saude, tendencias, acoes, recomendacoes     |

---

### 8. Integracao com Stack Velya

```yaml
# dae-integration-config.yaml
integrations:
  grafana:
    url: "http://grafana.velya-observability.svc:3000"
    api_version: "v1"
    features:
      - dashboard_api
      - datasource_api
      - search_api
      - annotations_api
      - library_panels_api

  prometheus:
    url: "http://prometheus.velya-observability.svc:9090"
    features:
      - query_api
      - metadata_api
      - targets_api

  loki:
    url: "http://loki.velya-observability.svc:3100"
    features:
      - query_api
      - labels_api
      - ready_api

  tempo:
    url: "http://tempo.velya-observability.svc:3200"
    features:
      - search_api
      - echo_api

  pyroscope:
    url: "http://pyroscope.velya-observability.svc:4040"
    features:
      - readiness_api
      - query_api

  argocd:
    url: "http://argocd-server.argocd.svc:443"
    features:
      - application_status
      - sync_status

  alertmanager:
    url: "http://alertmanager.velya-observability.svc:9093"
    features:
      - alerts_api
      - silences_api
```

---

### 9. Deployment no EKS

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dashboard-assurance-engine
  namespace: velya-observability
  labels:
    app: dae
    version: "1.4.0"
spec:
  replicas: 1
  selector:
    matchLabels:
      app: dae
  template:
    metadata:
      labels:
        app: dae
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: dae-engine
      containers:
      - name: dae
        image: velya/dashboard-assurance-engine:1.4.0
        ports:
        - containerPort: 8080
          name: metrics
        env:
        - name: DAE_CONFIG
          value: "/config/dae-config.yaml"
        - name: DAE_LOG_LEVEL
          value: "info"
        volumeMounts:
        - name: config
          mountPath: /config
        - name: data
          mountPath: /data
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 1000m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /readyz
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: config
        configMap:
          name: dae-config
      - name: data
        persistentVolumeClaim:
          claimName: dae-data
```

---

### 10. Metricas Exportadas pelo DAE

O DAE expoe metricas Prometheus no endpoint `/metrics`:

```
# HELP dae_dashboard_health_score Health score do dashboard (0-100)
# TYPE dae_dashboard_health_score gauge
dae_dashboard_health_score{dashboard_uid="velya-platform-overview", folder="Platform"} 94

# HELP dae_panel_health_score Health score do painel (0-100)
# TYPE dae_panel_health_score gauge
dae_panel_health_score{dashboard_uid="velya-platform-overview", panel_id="1", panel_title="CPU Usage"} 100

# HELP dae_panel_dimension_score Score por dimensao do painel (0-100)
# TYPE dae_panel_dimension_score gauge
dae_panel_dimension_score{dashboard_uid="velya-platform-overview", panel_id="1", dimension="datasource_availability"} 100

# HELP dae_inventory_dashboards_total Total de dashboards inventariados
# TYPE dae_inventory_dashboards_total gauge
dae_inventory_dashboards_total 40

# HELP dae_inventory_panels_total Total de paineis inventariados
# TYPE dae_inventory_panels_total gauge
dae_inventory_panels_total 347

# HELP dae_remediation_total Total de remediacoes executadas
# TYPE dae_remediation_total counter
dae_remediation_total{action_type="auto", action="restore_version"} 3

# HELP dae_remediation_success_total Total de remediacoes bem-sucedidas
# TYPE dae_remediation_success_total counter
dae_remediation_success_total{action_type="auto", action="restore_version"} 3

# HELP dae_diagnosis_duration_seconds Duracao do diagnostico
# TYPE dae_diagnosis_duration_seconds histogram
dae_diagnosis_duration_seconds_bucket{le="1"} 45
dae_diagnosis_duration_seconds_bucket{le="5"} 52
dae_diagnosis_duration_seconds_bucket{le="10"} 55
```

---

### 11. Alertas do DAE

```yaml
# dae-alerts.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: dae-alerts
  namespace: velya-observability
spec:
  groups:
  - name: dashboard-assurance
    interval: 60s
    rules:
    - alert: DashboardHealthCritical
      expr: dae_dashboard_health_score < 60
      for: 10m
      labels:
        severity: warning
        team: platform
      annotations:
        summary: "Dashboard {{ $labels.dashboard_uid }} com health score critico: {{ $value }}"
        description: "O dashboard esta abaixo do threshold de saude por mais de 10 minutos."
        runbook_url: "https://docs.velya.health/runbooks/dashboard-health-critical"

    - alert: DatasourceUnhealthy
      expr: dae_datasource_health == 0
      for: 5m
      labels:
        severity: critical
        team: platform
      annotations:
        summary: "Datasource {{ $labels.datasource_name }} indisponivel"
        description: "O datasource nao responde ao health check por mais de 5 minutos."

    - alert: DAERemediationFailed
      expr: increase(dae_remediation_total[1h]) > increase(dae_remediation_success_total[1h])
      for: 5m
      labels:
        severity: warning
        team: platform
      annotations:
        summary: "Falha em remediacao automatica do DAE"
        description: "Uma ou mais remediacoes falharam na ultima hora."

    - alert: HighNoDataPanelRate
      expr: |
        (
          count(dae_panel_dimension_score{dimension="not_empty"} == 0)
          / count(dae_panel_dimension_score{dimension="not_empty"})
        ) > 0.1
      for: 15m
      labels:
        severity: warning
        team: platform
      annotations:
        summary: "Mais de 10% dos paineis sem dados"
        description: "Taxa elevada de paineis no-data detectada."
```

---

## Fluxo Operacional Completo

```
1. INVENTARIO (a cada 10 min)
   |
   +--> Escaneia Grafana API
   +--> Atualiza catalogo de dashboards/paineis/datasources/variaveis
   +--> Detecta mudancas desde ultimo scan
   |
2. HEALTH SCORE (a cada 5 min)
   |
   +--> Calcula 11 dimensoes por painel
   +--> Agrega score por dashboard
   +--> Publica metricas Prometheus
   +--> Detecta degradacao
   |
3. DIAGNOSTICO (on-demand)
   |
   +--> Acionado por score < threshold
   +--> Executa arvore de 14 passos
   +--> Gera evidencia e causa raiz
   |
4. REMEDIACAO (on-demand)
   |
   +--> Verifica se acao e safe ou gated
   +--> Safe: executa automaticamente
   +--> Gated: notifica owner para aprovacao
   |
5. REVALIDACAO (pos-acao)
   |
   +--> Recalcula health score
   +--> Confirma melhoria
   +--> Se piorou: reverte automaticamente
   |
6. AUDITORIA (continuo)
   |
   +--> Registra toda acao com diff, evidencia, resultado
   +--> Imutavel e consultavel
   +--> Alimenta report semanal
```

---

## Proximos Passos

1. Implementar scanner de inventario v1.0
2. Definir health score calculator com as 11 dimensoes
3. Implementar arvore de diagnostico no-data
4. Construir pipeline de remediacao segura
5. Configurar alertas e dashboards de meta-monitoramento do DAE
6. Integrar com pipeline de dashboard-as-code
7. Implementar report semanal automatizado
