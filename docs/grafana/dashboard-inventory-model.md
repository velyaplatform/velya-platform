# Modelo de Inventario Completo de Dashboards

## Visao Geral

O inventario de dashboards e a base de dados centralizada que cataloga todos os dashboards, paineis, datasources, variaveis e dependencias do Grafana na plataforma Velya. Ele e atualizado automaticamente a cada 10 minutos via CronJob que consulta a API do Grafana.

---

## Schema do Inventario

### Dashboard

```json
{
  "dashboard_inventory_schema": {
    "dashboard_uid": "string - UID unico do Grafana",
    "title": "string - Titulo do dashboard",
    "description": "string - Descricao do dashboard",
    "folder": "string - Pasta no Grafana",
    "folder_uid": "string - UID da pasta",
    "tags": ["string - Tags do dashboard"],
    "version": "integer - Versao atual",
    "schema_version": "integer - Schema version do Grafana",
    "owner": {
      "role": "string - Papel responsavel",
      "contact": "string - Email/canal do dono",
      "escalation_chain": ["string - Cadeia de escalacao"]
    },
    "criticality": "string - critical|high|medium|low",
    "panels": [
      {
        "panel_id": "integer",
        "title": "string",
        "type": "string - timeseries|stat|gauge|table|logs|nodeGraph|etc",
        "datasource": "string - Nome do datasource",
        "datasource_uid": "string - UID do datasource",
        "queries": [
          {
            "ref_id": "string",
            "expr": "string - Query PromQL/LogQL/TraceQL",
            "legend_format": "string"
          }
        ],
        "transformations": [
          {
            "id": "string - Tipo da transformacao",
            "options": "object"
          }
        ],
        "links": [
          {
            "title": "string",
            "url": "string",
            "type": "string - dashboard|url",
            "target_blank": "boolean"
          }
        ],
        "thresholds": "object",
        "field_config": "object",
        "is_library_panel": "boolean",
        "library_panel_uid": "string|null"
      }
    ],
    "variables": [
      {
        "name": "string",
        "type": "string - query|custom|constant|datasource|adhoc|textbox",
        "datasource": "string|null",
        "query": "string|null",
        "default_value": "string|null",
        "multi": "boolean",
        "include_all": "boolean",
        "depends_on": ["string - Variaveis das quais depende"]
      }
    ],
    "annotations": [
      {
        "name": "string",
        "datasource": "string",
        "query": "string",
        "enabled": "boolean"
      }
    ],
    "links": [
      {
        "title": "string",
        "type": "string - dashboards|link",
        "url": "string",
        "tags": ["string"]
      }
    ],
    "panels_count": "integer",
    "datasources_used": ["string - Lista de datasources unicos"],
    "last_modified": "datetime",
    "last_modified_by": "string",
    "created": "datetime",
    "usage_frequency": {
      "views_last_7d": "integer",
      "views_last_30d": "integer",
      "unique_viewers_last_30d": "integer",
      "avg_session_duration_seconds": "float"
    },
    "health_score": {
      "overall": "float 0-100",
      "dimensions": {
        "datasource_availability": "float 0-100",
        "query_success": "float 0-100",
        "data_freshness": "float 0-100",
        "not_empty": "float 0-100",
        "variable_integrity": "float 0-100",
        "transformation_integrity": "float 0-100",
        "link_integrity": "float 0-100",
        "rendering": "float 0-100",
        "semantic_usefulness": "float 0-100",
        "alert_linkage": "float 0-100",
        "ownership": "float 0-100"
      },
      "last_calculated": "datetime",
      "trend": "string - improving|stable|degrading"
    },
    "git_source": {
      "repo": "string - Repositorio Git",
      "path": "string - Caminho no repo",
      "last_sync": "datetime",
      "in_sync": "boolean"
    }
  }
}
```

---

## Inventario Atual da Plataforma Velya

### Pasta: Platform/Infra

| UID                       | Titulo                    | Paineis | Datasources | Criticidade | Owner        | Health |
| ------------------------- | ------------------------- | ------- | ----------- | ----------- | ------------ | ------ |
| velya-platform-overview   | Platform Overview         | 18      | Prometheus  | Critical    | Platform Eng | 94     |
| velya-kubernetes-cluster  | Kubernetes Cluster Status | 24      | Prometheus  | Critical    | Platform Eng | 91     |
| velya-node-resources      | Node Resources            | 16      | Prometheus  | High        | Platform Eng | 88     |
| velya-namespace-resources | Namespace Resources       | 14      | Prometheus  | High        | Platform Eng | 90     |
| velya-networking          | Networking & Ingress      | 12      | Prometheus  | High        | Platform Eng | 87     |
| velya-argocd-status       | ArgoCD Sync Status        | 10      | Prometheus  | Critical    | Platform Eng | 93     |
| velya-keda-autoscaling    | KEDA Autoscaling          | 8       | Prometheus  | High        | Platform Eng | 85     |

### Pasta: Backend

| UID                        | Titulo                     | Paineis | Datasources       | Criticidade | Owner       | Health |
| -------------------------- | -------------------------- | ------- | ----------------- | ----------- | ----------- | ------ |
| velya-patient-api          | Patient API Service        | 22      | Prom, Loki, Tempo | Critical    | Backend Eng | 92     |
| velya-scheduling-api       | Scheduling API             | 20      | Prom, Loki, Tempo | Critical    | Backend Eng | 89     |
| velya-auth-service         | Auth Service               | 15      | Prom, Loki, Tempo | Critical    | Backend Eng | 91     |
| velya-notification-service | Notification Service       | 12      | Prom, Loki        | High        | Backend Eng | 86     |
| velya-billing-service      | Billing Service            | 18      | Prom, Loki, Tempo | Critical    | Backend Eng | 88     |
| velya-integration-hub      | Integration Hub (HL7/FHIR) | 16      | Prom, Loki, Tempo | Critical    | Backend Eng | 84     |

### Pasta: Frontend

| UID                        | Titulo                  | Paineis | Datasources | Criticidade | Owner        | Health |
| -------------------------- | ----------------------- | ------- | ----------- | ----------- | ------------ | ------ |
| velya-frontend-vitals      | Frontend Web Vitals     | 14      | Prometheus  | High        | Frontend Eng | 82     |
| velya-frontend-errors      | Frontend Error Tracking | 10      | Loki        | High        | Frontend Eng | 79     |
| velya-frontend-performance | Frontend Performance    | 12      | Prometheus  | Medium      | Frontend Eng | 85     |
| velya-mobile-telemetry     | Mobile App Telemetry    | 8       | Prom, Loki  | Medium      | Frontend Eng | 77     |
| velya-user-experience      | User Experience Metrics | 10      | Prometheus  | Medium      | Frontend Eng | 80     |

### Pasta: AI Agents

| UID                      | Titulo                    | Paineis | Datasources             | Criticidade | Owner  | Health |
| ------------------------ | ------------------------- | ------- | ----------------------- | ----------- | ------ | ------ |
| velya-agent-orchestrator | Agent Orchestrator        | 20      | Prom, Loki, Tempo, Pyro | Critical    | AI Eng | 90     |
| velya-agent-triage       | Triage Agent              | 16      | Prom, Loki, Tempo       | Critical    | AI Eng | 88     |
| velya-agent-diagnosis    | Diagnosis Agent           | 18      | Prom, Loki, Tempo, Pyro | Critical    | AI Eng | 86     |
| velya-agent-scheduling   | Scheduling Agent          | 14      | Prom, Loki, Tempo       | High        | AI Eng | 84     |
| velya-agent-followup     | Follow-up Agent           | 12      | Prom, Loki              | High        | AI Eng | 82     |
| velya-llm-gateway        | LLM Gateway               | 16      | Prom, Loki, Tempo, Pyro | Critical    | AI Eng | 91     |
| velya-agent-guardrails   | Agent Guardrails & Safety | 10      | Prom, Loki              | Critical    | AI Eng | 89     |

### Pasta: Business/Hospital

| UID                         | Titulo                      | Paineis | Datasources | Criticidade | Owner       | Health |
| --------------------------- | --------------------------- | ------- | ----------- | ----------- | ----------- | ------ |
| velya-patient-flow          | Patient Flow & Admission    | 14      | Prometheus  | Critical    | Product Eng | 87     |
| velya-appointment-analytics | Appointment Analytics       | 12      | Prometheus  | High        | Product Eng | 85     |
| velya-bed-management        | Bed Management              | 10      | Prometheus  | High        | Product Eng | 83     |
| velya-revenue-cycle         | Revenue Cycle               | 16      | Prometheus  | Critical    | Product Eng | 81     |
| velya-clinical-quality      | Clinical Quality Indicators | 14      | Prometheus  | Critical    | Product Eng | 79     |

### Pasta: Observability Health

| UID                        | Titulo                            | Paineis | Datasources | Criticidade | Owner        | Health |
| -------------------------- | --------------------------------- | ------- | ----------- | ----------- | ------------ | ------ |
| velya-datasource-integrity | Datasource Integrity              | 8       | Prometheus  | Critical    | Platform Eng | 95     |
| velya-meta-prometheus      | Prometheus Health                 | 12      | Prometheus  | Critical    | Platform Eng | 93     |
| velya-meta-loki            | Loki Health                       | 10      | Prometheus  | Critical    | Platform Eng | 91     |
| velya-meta-tempo           | Tempo Health                      | 8       | Prometheus  | High        | Platform Eng | 90     |
| velya-meta-alloy           | Alloy/OTel Collector Health       | 10      | Prometheus  | High        | Platform Eng | 88     |
| velya-dae-status           | Dashboard Assurance Engine Status | 8       | Prometheus  | High        | Platform Eng | 92     |

### Pasta: Cost/Efficiency

| UID                       | Titulo                      | Paineis | Datasources | Criticidade | Owner        | Health |
| ------------------------- | --------------------------- | ------- | ----------- | ----------- | ------------ | ------ |
| velya-cloud-cost          | Cloud Cost Overview (AWS)   | 14      | Prometheus  | High        | Platform Eng | 82     |
| velya-resource-efficiency | Resource Efficiency         | 12      | Prometheus  | Medium      | Platform Eng | 80     |
| velya-observability-cost  | Observability Stack Cost    | 10      | Prometheus  | Medium      | Platform Eng | 78     |
| velya-rightsizing         | Rightsizing Recommendations | 8       | Prometheus  | Medium      | Platform Eng | 75     |

---

## CronJob de Scan do Inventario

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: dae-inventory-scanner
  namespace: velya-observability
  labels:
    app: dashboard-assurance-engine
    component: inventory-scanner
spec:
  schedule: '*/10 * * * *'
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 300
      template:
        metadata:
          labels:
            app: dae-inventory-scanner
          annotations:
            prometheus.io/scrape: 'true'
            prometheus.io/port: '8080'
        spec:
          serviceAccountName: dae-scanner
          containers:
            - name: scanner
              image: velya/dae-inventory-scanner:1.4.0
              env:
                - name: GRAFANA_URL
                  value: 'http://grafana.velya-observability.svc:3000'
                - name: GRAFANA_TOKEN
                  valueFrom:
                    secretKeyRef:
                      name: dae-credentials
                      key: grafana-api-token
                - name: INVENTORY_STORE
                  value: '/data/inventory'
                - name: PROMETHEUS_PUSHGW
                  value: 'http://prometheus-pushgateway.velya-observability.svc:9091'
              command:
                - python3
                - /app/inventory_scanner.py
              args:
                - --grafana-url=$(GRAFANA_URL)
                - --output-dir=$(INVENTORY_STORE)
                - --push-metrics
                - --detect-changes
                - --validate-ownership
              volumeMounts:
                - name: data
                  mountPath: /data
                - name: ownership-registry
                  mountPath: /config/ownership
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
                claimName: dae-inventory-data
            - name: ownership-registry
              configMap:
                name: dae-ownership-registry
          restartPolicy: OnFailure
```

---

## Logica do Scanner

### Endpoints da API do Grafana Utilizados

| Endpoint                             | Metodo | Finalidade                       |
| ------------------------------------ | ------ | -------------------------------- |
| `/api/search?type=dash-db`           | GET    | Listar todos os dashboards       |
| `/api/dashboards/uid/{uid}`          | GET    | Obter JSON completo do dashboard |
| `/api/datasources`                   | GET    | Listar todos os datasources      |
| `/api/library-elements?kind=1`       | GET    | Listar library panels            |
| `/api/folders`                       | GET    | Listar todas as pastas           |
| `/api/datasources/{id}/health`       | GET    | Health check do datasource       |
| `/api/dashboards/uid/{uid}/versions` | GET    | Historico de versoes             |
| `/api/usage-stats`                   | GET    | Estatisticas de uso              |

### Fluxo do Scanner

```
1. LISTAR DASHBOARDS
   |
   +--> GET /api/search?type=dash-db
   +--> Para cada dashboard:
   |    |
   |    +--> GET /api/dashboards/uid/{uid}
   |    +--> Extrair: paineis, variaveis, datasources, links, anotacoes
   |    +--> Identificar library panels
   |    +--> Calcular panels_count, datasources_used
   |    +--> Buscar owner no registry
   |    +--> Verificar criticidade atribuida
   |
2. LISTAR DATASOURCES
   |
   +--> GET /api/datasources
   +--> Para cada datasource:
   |    +--> GET /api/datasources/{id}/health
   |    +--> Registrar status
   |
3. LISTAR LIBRARY PANELS
   |
   +--> GET /api/library-elements?kind=1
   +--> Para cada library panel:
   |    +--> Identificar dashboards consumidores
   |    +--> Registrar versao, ultima atualizacao
   |
4. DETECTAR MUDANCAS
   |
   +--> Comparar inventario atual com anterior
   +--> Registrar: novos dashboards, removidos, modificados
   +--> Gerar evento de mudanca
   |
5. EXPORTAR METRICAS
   |
   +--> Push metricas para Prometheus Pushgateway
   +--> Salvar inventario JSON em PVC
   +--> Gerar log estruturado
```

---

## Metricas do Inventario

```promql
# Total de dashboards inventariados
dae_inventory_dashboards_total

# Total de paineis inventariados
dae_inventory_panels_total

# Dashboards por pasta
dae_inventory_dashboards_by_folder{folder="Platform/Infra"}

# Dashboards sem dono
dae_inventory_dashboards_without_owner

# Dashboards sem criticidade definida
dae_inventory_dashboards_without_criticality

# Dashboards modificados nas ultimas 24h
dae_inventory_dashboards_modified_last_24h

# Dashboards sem uso nos ultimos 30 dias
dae_inventory_dashboards_unused_30d

# Library panels com versao desatualizada
dae_inventory_library_panels_outdated

# Datasources referenciados mas nao existentes
dae_inventory_orphan_datasource_references
```

---

## Validacoes Executadas no Scan

| Validacao                              | Severidade | Acao se Falhar                         |
| -------------------------------------- | ---------- | -------------------------------------- |
| Dashboard tem owner                    | Warning    | Marcar no inventario, notificar        |
| Dashboard tem criticidade              | Warning    | Marcar no inventario, notificar        |
| Dashboard tem descricao                | Info       | Marcar no inventario                   |
| Todos os datasources existem           | Error      | Alerta, marcar painel como broken      |
| Todas as variaveis resolvem            | Warning    | Marcar painel como degraded            |
| Links apontam para destinos validos    | Info       | Marcar link como broken                |
| Dashboard esta sincronizado com Git    | Warning    | Marcar divergencia, notificar owner    |
| Library panels estao na versao correta | Warning    | Marcar divergencia, notificar owner    |
| Dashboard foi modificado por UI        | Info       | Registrar, verificar se deve ir ao Git |
| Tags obrigatorias presentes            | Info       | Marcar no inventario                   |

---

## Exemplo de Saida do Inventario

```json
{
  "inventory_timestamp": "2026-04-08T14:00:00Z",
  "scanner_version": "1.4.0",
  "grafana_version": "11.4.0",
  "summary": {
    "total_dashboards": 40,
    "total_panels": 347,
    "total_datasources": 5,
    "total_library_panels": 8,
    "total_folders": 7,
    "dashboards_healthy": 32,
    "dashboards_degraded": 6,
    "dashboards_broken": 2,
    "dashboards_without_owner": 1,
    "dashboards_without_criticality": 3,
    "changes_since_last_scan": {
      "new_dashboards": 0,
      "modified_dashboards": 2,
      "deleted_dashboards": 0,
      "new_panels": 3,
      "modified_panels": 5
    }
  },
  "dashboards": [
    {
      "dashboard_uid": "velya-platform-overview",
      "title": "Platform Overview",
      "folder": "Platform/Infra",
      "version": 12,
      "owner": {
        "role": "platform-engineering",
        "contact": "platform@velya.health"
      },
      "criticality": "critical",
      "panels_count": 18,
      "datasources_used": ["Prometheus"],
      "variables": ["namespace", "environment"],
      "last_modified": "2026-04-07T10:30:00Z",
      "health_score": {
        "overall": 94,
        "trend": "stable"
      },
      "git_source": {
        "repo": "velya/velya-platform",
        "path": "dashboards/platform/overview.json",
        "in_sync": true
      }
    }
  ]
}
```

---

## Retencao e Historico

| Dado                    | Retencao | Armazenamento          |
| ----------------------- | -------- | ---------------------- |
| Inventario completo     | 90 dias  | PVC + S3 backup        |
| Diferencas entre scans  | 1 ano    | Prometheus + S3        |
| Metricas de inventario  | 1 ano    | Prometheus TSDB        |
| Changelog de dashboards | 1 ano    | Git + Grafana versions |
