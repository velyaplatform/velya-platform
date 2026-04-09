# Modelo de Observabilidade como Código — Velya Platform

> Toda observabilidade versionada em Git. Nada de dashboard manual sem rastreabilidade.
> Se não está no Git, não existe oficialmente.
> Última atualização: 2026-04-08

---

## 1. Princípio Fundamental

**Observabilidade como Código** (OaC) significa que:

| Artefato                           | Estado atual                            | Estado alvo                                     |
| ---------------------------------- | --------------------------------------- | ----------------------------------------------- |
| Dashboards Grafana                 | Criados manualmente (inexistentes hoje) | JSON versionado em Git, aplicados via ConfigMap |
| Regras Prometheus (PrometheusRule) | 1 CRD com 5 alertas básicos             | Todos os 57 alertas como CRDs versionados       |
| ServiceMonitors                    | Nenhum                                  | CRDs para todos os serviços, versionados        |
| Datasources Grafana                | Configurados manualmente                | YAML de provisioning no Git                     |
| Contact Points Grafana             | Não configurados                        | YAML de provisioning no Git                     |
| Notification Policies              | Não configuradas                        | YAML de provisioning no Git                     |
| Configuração Loki                  | Parcial (via Helm values)               | Pipeline completo versionado                    |
| Configuração OTel Collector        | Parcial                                 | ConfigMap completo versionado                   |

---

## 2. Estrutura de Diretórios

```
infra/observability/
├── README.md                           # Instruções de aplicação
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── velya-datasources.yaml  # Prometheus, Loki, Tempo, Pyroscope
│   │   ├── dashboards/
│   │   │   └── velya-dashboard-provider.yaml  # Configuração de where/how carregar dashboards
│   │   ├── alerting/
│   │   │   ├── contact-points.yaml     # Slack, PagerDuty, Email
│   │   │   ├── notification-policies.yaml
│   │   │   ├── mute-timings.yaml
│   │   │   └── templates/
│   │   │       └── velya-slack-template.yaml
│   │   └── plugins/
│   │       └── plugins.yaml            # Plugins OSS pré-instalados
│   ├── dashboards/
│   │   ├── infrastructure/
│   │   │   ├── velya-infra-cluster-overview.json
│   │   │   ├── velya-infra-node-nodepool.json
│   │   │   ├── velya-infra-namespace-health.json
│   │   │   ├── velya-infra-scheduling-quotas.json
│   │   │   ├── velya-infra-storage-network.json
│   │   │   ├── velya-keda-scaling-monitor.json
│   │   │   └── velya-infra-argocd-delivery-monitor.json
│   │   ├── backend/
│   │   │   ├── velya-backend-api-red.json
│   │   │   ├── velya-backend-dependency-map.json
│   │   │   ├── velya-backend-queue-worker-health.json
│   │   │   ├── velya-backend-postgresql-performance.json
│   │   │   ├── velya-backend-integration-health.json
│   │   │   └── velya-backend-ai-gateway-performance.json
│   │   ├── frontend/
│   │   │   ├── velya-frontend-experience-overview.json
│   │   │   ├── velya-frontend-route-performance.json
│   │   │   ├── velya-frontend-ux-friction-board.json
│   │   │   ├── velya-frontend-action-failure-board.json
│   │   │   └── velya-frontend-degraded-mode-board.json
│   │   ├── agents/
│   │   │   ├── velya-agents-oversight-console.json
│   │   │   ├── velya-agents-office-health-board.json
│   │   │   ├── velya-agents-validation-board.json
│   │   │   ├── velya-agents-audit-board.json
│   │   │   ├── velya-agents-handoff-monitor.json
│   │   │   ├── velya-agents-learning-monitor.json
│   │   │   ├── velya-agents-quarantine-center.json
│   │   │   └── velya-agents-promotion-retirement-board.json
│   │   ├── clinical/
│   │   │   ├── velya-clinical-patient-flow-command-board.json
│   │   │   ├── velya-clinical-discharge-control-board.json
│   │   │   ├── velya-clinical-capacity-bottleneck-board.json
│   │   │   ├── velya-clinical-inbox-intelligence-board.json
│   │   │   └── velya-clinical-operational-risk-board.json
│   │   ├── security/
│   │   │   ├── velya-security-secrets-identity-board.json
│   │   │   └── velya-security-policy-drift-board.json
│   │   └── cost/
│   │       ├── velya-cost-observability-board.json
│   │       └── velya-cost-namespace-nodepool.json
│   └── configmaps/
│       ├── grafana-datasources-configmap.yaml
│       ├── grafana-dashboards-infra-configmap.yaml
│       ├── grafana-dashboards-backend-configmap.yaml
│       ├── grafana-dashboards-frontend-configmap.yaml
│       ├── grafana-dashboards-agents-configmap.yaml
│       ├── grafana-dashboards-clinical-configmap.yaml
│       ├── grafana-dashboards-security-configmap.yaml
│       └── grafana-dashboards-cost-configmap.yaml
├── prometheus/
│   ├── rules/
│   │   ├── velya-infra-alerts.yaml     # PrometheusRule: 15 alertas de infraestrutura
│   │   ├── velya-platform-alerts.yaml  # PrometheusRule: 8 alertas de plataforma
│   │   ├── velya-backend-alerts.yaml   # PrometheusRule: 10 alertas de backend
│   │   ├── velya-frontend-alerts.yaml  # PrometheusRule: 5 alertas de frontend
│   │   ├── velya-agent-alerts.yaml     # PrometheusRule: 8 alertas de agents
│   │   ├── velya-clinical-alerts.yaml  # PrometheusRule: 6 alertas clínicos
│   │   └── velya-cost-alerts.yaml      # PrometheusRule: 5 alertas de custo
│   └── servicemonitors/
│       ├── velya-patient-flow-servicemonitor.yaml
│       ├── velya-task-inbox-servicemonitor.yaml
│       ├── velya-discharge-orchestrator-servicemonitor.yaml
│       ├── velya-api-gateway-servicemonitor.yaml
│       ├── velya-ai-gateway-servicemonitor.yaml
│       ├── velya-decision-log-servicemonitor.yaml
│       ├── velya-memory-service-servicemonitor.yaml
│       ├── velya-policy-engine-servicemonitor.yaml
│       └── velya-agent-workers-servicemonitor.yaml
├── loki/
│   ├── pipeline/
│   │   └── promtail-velya-pipeline.yaml  # Pipeline de parsing de JSON para labels
│   └── retention/
│       └── loki-retention-config.yaml
├── tempo/                              # A implementar
│   ├── tempo-values.yaml               # Helm values para instalação
│   └── tempo-configmap.yaml
├── otel-collector/
│   └── otel-collector-config.yaml      # ConfigMap completo do OTel Collector
├── alloy/                             # Substituto futuro de OTel+Promtail
│   └── alloy-config.alloy
└── pyroscope/                         # Futuro
    └── pyroscope-values.yaml
```

---

## 3. Configuração de Datasources

```yaml
# infra/observability/grafana/provisioning/datasources/velya-datasources.yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    uid: prometheus-velya
    url: http://kube-prometheus-stack-prometheus.velya-dev-observability.svc.cluster.local:9090
    access: proxy
    isDefault: true
    jsonData:
      timeInterval: '15s'
      httpMethod: POST
      prometheusType: Prometheus
      prometheusVersion: '2.50.0'
    version: 1
    editable: false # Impede edição manual — OaC enforced

  - name: Loki
    type: loki
    uid: loki-velya
    url: http://loki.velya-dev-observability.svc.cluster.local:3100
    access: proxy
    jsonData:
      maxLines: 1000
      derivedFields:
        - name: TraceID
          matcherRegex: '"trace_id":"([^"]+)"'
          url: '$${__value.raw}'
          datasourceUid: tempo-velya # Link de log para trace
    version: 1
    editable: false

  - name: Tempo
    type: tempo
    uid: tempo-velya
    url: http://tempo.velya-dev-observability.svc.cluster.local:3100
    access: proxy
    jsonData:
      tracesToLogs:
        datasourceUid: loki-velya
        filterByTraceID: true
        filterBySpanID: true
        mapTagNamesEnabled: true
        mappedTags:
          - key: service.name
            value: service
          - key: velya.agent_name
            value: agent_name
      tracesToMetrics:
        datasourceUid: prometheus-velya
        queries:
          - name: 'Error Rate'
            query: 'rate(http_requests_total{service="$${__tags.service.name}",status=~"5.."}[5m])'
          - name: 'Latência P99'
            query: 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="$${__tags.service.name}"}[5m]))'
      serviceMap:
        datasourceUid: prometheus-velya
      nodeGraph:
        enabled: true
      search:
        hide: false
    version: 1
    editable: false
```

---

## 4. Configuração de Dashboard Provider

```yaml
# infra/observability/grafana/provisioning/dashboards/velya-dashboard-provider.yaml
apiVersion: 1

providers:
  - name: velya-infrastructure
    orgId: 1
    folder: 'Infraestrutura'
    folderUid: velya-infra
    type: file
    disableDeletion: true # Não permitir exclusão via UI
    updateIntervalSeconds: 30 # Re-carregar se o arquivo mudar
    allowUiUpdates: false # Não permitir edição via UI — deve ir para Git
    options:
      path: /var/lib/grafana/dashboards/infrastructure

  - name: velya-backend
    orgId: 1
    folder: 'Backend'
    folderUid: velya-backend
    type: file
    disableDeletion: true
    updateIntervalSeconds: 30
    allowUiUpdates: false
    options:
      path: /var/lib/grafana/dashboards/backend

  - name: velya-frontend
    orgId: 1
    folder: 'Frontend'
    folderUid: velya-frontend
    type: file
    disableDeletion: true
    updateIntervalSeconds: 30
    allowUiUpdates: false
    options:
      path: /var/lib/grafana/dashboards/frontend

  - name: velya-agents
    orgId: 1
    folder: 'Agents e Empresa Digital'
    folderUid: velya-agents
    type: file
    disableDeletion: true
    updateIntervalSeconds: 30
    allowUiUpdates: false
    options:
      path: /var/lib/grafana/dashboards/agents

  - name: velya-clinical
    orgId: 1
    folder: 'Negócio Hospitalar'
    folderUid: velya-clinical
    type: file
    disableDeletion: true
    updateIntervalSeconds: 30
    allowUiUpdates: false
    options:
      path: /var/lib/grafana/dashboards/clinical

  - name: velya-security
    orgId: 1
    folder: 'Segurança e Compliance'
    folderUid: velya-security
    type: file
    disableDeletion: true
    updateIntervalSeconds: 30
    allowUiUpdates: false
    options:
      path: /var/lib/grafana/dashboards/security

  - name: velya-cost
    orgId: 1
    folder: 'Custo'
    folderUid: velya-cost
    type: file
    disableDeletion: true
    updateIntervalSeconds: 30
    allowUiUpdates: false
    options:
      path: /var/lib/grafana/dashboards/cost
```

---

## 5. ConfigMap para Dashboards

```yaml
# infra/observability/grafana/configmaps/grafana-dashboards-backend-configmap.yaml
# Padrão de ConfigMap para dashboards — um por categoria
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboards-backend
  namespace: velya-dev-observability
  labels:
    grafana_dashboard: '1' # Label para Grafana detectar automaticamente (se usando sidecar)
    app.kubernetes.io/part-of: velya-observability
data:
  velya-backend-api-red.json: |
    # Conteúdo JSON do dashboard (exportado do Grafana e commitado aqui)
    {
      "__inputs": [],
      "__requires": [],
      "annotations": {},
      "description": "API RED Dashboard — Rate, Errors, Duration por serviço",
      "editable": false,
      "id": null,
      "tags": ["velya", "backend", "red", "operational"],
      "title": "API RED Dashboard",
      "uid": "velya-backend-api-red",
      "version": 1,
      ...
    }
```

---

## 6. GitOps para Observabilidade com ArgoCD

```yaml
# infra/argocd/applications/velya-observability-as-code.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: velya-observability-as-code
  namespace: argocd
spec:
  project: velya-platform
  source:
    repoURL: https://github.com/velya/velya-platform
    targetRevision: main
    path: infra/observability
  destination:
    server: https://kubernetes.default.svc
    namespace: velya-dev-observability
  syncPolicy:
    automated:
      prune: true # Remove recursos deletados do Git
      selfHeal: true # Reverte mudanças manuais no cluster
    syncOptions:
      - CreateNamespace=false
      - RespectIgnoreDifferences=true
  ignoreDifferences:
    # Não sobrescrever anotações adicionadas pelo Grafana no runtime
    - group: ''
      kind: ConfigMap
      name: 'grafana-*'
      jsonPointers:
        - /metadata/annotations/kubectl.kubernetes.io~1last-applied-configuration
```

---

## 7. Como Adicionar um Novo Dashboard

### Passo 1: Criar o dashboard no Grafana UI

1. Acessar Grafana via `kubectl port-forward svc/grafana -n velya-dev-observability 3000:80`
2. Criar dashboard na pasta correta (ex.: "Backend")
3. Usar o padrão de ID: `velya-{domínio}-{propósito}`
4. Adicionar tags: `["velya", "{domínio}", "{tipo}"]`
5. Definir variáveis padrão (ver grafana-oss-capabilities-matrix.md seção 2.5)

### Passo 2: Exportar como JSON

```bash
# Via API do Grafana (preferível — captura o JSON limpo)
GRAFANA_URL="http://localhost:3000"
DASHBOARD_UID="velya-backend-api-red"

curl -s "${GRAFANA_URL}/api/dashboards/uid/${DASHBOARD_UID}" \
  -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
  | jq '.dashboard' \
  > infra/observability/grafana/dashboards/backend/velya-backend-api-red.json

# Verificar que o JSON é válido
jq . infra/observability/grafana/dashboards/backend/velya-backend-api-red.json > /dev/null
```

### Passo 3: Adicionar ao ConfigMap

```bash
# Script para regenerar o ConfigMap a partir dos arquivos JSON
# scripts/regenerate-dashboard-configmaps.sh

CATEGORY="backend"
NAMESPACE="velya-dev-observability"

kubectl create configmap grafana-dashboards-${CATEGORY} \
  --from-file=infra/observability/grafana/dashboards/${CATEGORY}/ \
  --namespace=${NAMESPACE} \
  -o yaml \
  --dry-run=client \
  > infra/observability/grafana/configmaps/grafana-dashboards-${CATEGORY}-configmap.yaml
```

### Passo 4: Registrar no Catálogo

Adicionar entrada em `docs/observability/dashboard-catalog.md` com todos os campos requeridos.

### Passo 5: Atribuir Owner

Adicionar entrada em `docs/observability/dashboard-owners.md`.

### Passo 6: PR e Review

```bash
git checkout -b feat/dashboard-velya-backend-api-red
git add infra/observability/grafana/dashboards/backend/velya-backend-api-red.json
git add infra/observability/grafana/configmaps/grafana-dashboards-backend-configmap.yaml
git add docs/observability/dashboard-catalog.md
git add docs/observability/dashboard-owners.md
git commit -m "feat(observability): adiciona dashboard API RED para serviços backend"
git push origin feat/dashboard-velya-backend-api-red
# Abrir PR → review → merge → ArgoCD aplica automaticamente
```

### Passo 7: Verificar que ArgoCD aplicou

```bash
# Verificar sincronização
argocd app get velya-observability-as-code

# Verificar que o dashboard está disponível no Grafana
curl -s http://localhost:3000/api/dashboards/uid/velya-backend-api-red \
  -H "Authorization: Bearer ${GRAFANA_API_KEY}" | jq '.meta.title'
```

---

## 8. Como Adicionar uma Nova PrometheusRule

```yaml
# infra/observability/prometheus/rules/velya-backend-alerts.yaml
# Padrão para PrometheusRule
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-backend-alerts
  namespace: velya-dev-observability
  labels:
    prometheus: kube-prometheus-stack # Label para o Prometheus encontrar esta rule
    role: alert-rules
    app.kubernetes.io/part-of: velya-observability
spec:
  groups:
    - name: velya-backend
      interval: 30s # Frequência de avaliação
      rules:
        # --- Adicionar novos alertas aqui ---
        - alert: NomeDoAlerta
          expr: |
            # PromQL — manter legível com pipe e indentação
            rate(http_requests_total{status=~"5.."}[5m]) > 0.05
          for: 5m
          labels:
            severity: high # critical | high | medium | low
            domain: backend # infrastructure | platform | backend | frontend | agents | clinical | cost
            owner: backend-office
          annotations:
            summary: 'Descrição concisa do alerta'
            impact: 'O que vai falhar para o usuário final'
            dashboard_url: 'http://grafana/d/velya-backend-api-red'
            runbook_url: 'https://docs.velya/runbooks/nome-do-runbook'
            initial_action: 'Primeira ação a tomar ao receber este alerta'
```

**Validar a rule antes de commitar**:

```bash
# Instalar promtool
go install github.com/prometheus/prometheus/cmd/promtool@latest

# Validar sintaxe
promtool check rules infra/observability/prometheus/rules/velya-backend-alerts.yaml

# Verificar no cluster se foi aplicada
kubectl get prometheusrule -n velya-dev-observability
```

---

## 9. Testes de Observabilidade como Código

### 9.1 Verificar que ServiceMonitors têm endpoints respondendo

```bash
#!/bin/bash
# tests/observability/verify-servicemonitors.sh

echo "=== Verificando ServiceMonitors ==="

SERVICEMONITORS=$(kubectl get servicemonitor -n velya-dev-observability -o name)

for sm in $SERVICEMONITORS; do
  NAME=$(echo $sm | cut -d/ -f2)

  # Verificar que o target está sendo scrapeado pelo Prometheus
  TARGET_HEALTH=$(curl -s http://localhost:9090/api/v1/targets \
    | jq -r ".data.activeTargets[] | select(.labels.job == \"$NAME\") | .health")

  if [ "$TARGET_HEALTH" = "up" ]; then
    echo "OK: $NAME está sendo scrapeado (status: up)"
  elif [ -z "$TARGET_HEALTH" ]; then
    echo "FALHA: $NAME não encontrado nos targets do Prometheus"
  else
    echo "AVISO: $NAME status = $TARGET_HEALTH"
  fi
done
```

### 9.2 Verificar que PrometheusRules são válidas

```bash
#!/bin/bash
# tests/observability/verify-prometheus-rules.sh

echo "=== Validando PrometheusRules ==="

RULES_DIR="infra/observability/prometheus/rules"
FAILED=0

for rule_file in $RULES_DIR/*.yaml; do
  echo -n "Validando $rule_file: "
  if promtool check rules "$rule_file" 2>&1 | grep -q "SUCCESS"; then
    echo "OK"
  else
    echo "FALHA"
    promtool check rules "$rule_file"
    FAILED=$((FAILED + 1))
  fi
done

if [ $FAILED -gt 0 ]; then
  echo "=== $FAILED arquivo(s) com falha de validação ==="
  exit 1
fi

echo "=== Todas as PrometheusRules são válidas ==="
```

### 9.3 Verificar que dashboards carregam sem erros

```bash
#!/bin/bash
# tests/observability/verify-dashboards.sh

GRAFANA_URL="http://localhost:3000"
API_KEY="${GRAFANA_API_KEY}"
FAILED=0

DASHBOARD_UIDS=(
  "velya-infra-cluster-overview"
  "velya-backend-api-red"
  "velya-agents-oversight-console"
  "velya-clinical-patient-flow-command-board"
)

echo "=== Verificando dashboards no Grafana ==="

for uid in "${DASHBOARD_UIDS[@]}"; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    "${GRAFANA_URL}/api/dashboards/uid/${uid}" \
    -H "Authorization: Bearer ${API_KEY}")

  if [ "$HTTP_STATUS" = "200" ]; then
    echo "OK: $uid"
  else
    echo "FALHA ($HTTP_STATUS): $uid"
    FAILED=$((FAILED + 1))
  fi
done

if [ $FAILED -gt 0 ]; then
  echo "=== $FAILED dashboard(s) com falha ==="
  exit 1
fi

echo "=== Todos os dashboards verificados ==="
```

### 9.4 Integrar em CI (GitHub Actions)

```yaml
# .github/workflows/verify-observability.yaml
name: Verify Observability as Code

on:
  pull_request:
    paths:
      - 'infra/observability/**'
      - 'docs/observability/**'

jobs:
  verify-prometheus-rules:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Install promtool
        run: |
          wget -q https://github.com/prometheus/prometheus/releases/download/v2.50.0/prometheus-2.50.0.linux-amd64.tar.gz
          tar xf prometheus-*.tar.gz
          sudo mv prometheus-*/promtool /usr/local/bin/

      - name: Validate PrometheusRules
        run: bash tests/observability/verify-prometheus-rules.sh

      - name: Validate dashboard JSON syntax
        run: |
          for json_file in $(find infra/observability/grafana/dashboards -name "*.json"); do
            jq . "$json_file" > /dev/null || (echo "JSON inválido: $json_file" && exit 1)
          done
          echo "Todos os dashboards JSON são válidos"
```

---

## 10. Gestão de Segredos para Contact Points

Contact points (Slack webhook, PagerDuty key) nunca devem estar em texto plano no Git.

```yaml
# Grafana provisioning com referência a secret do Kubernetes
# infra/observability/grafana/provisioning/alerting/contact-points.yaml
apiVersion: 1

contactPoints:
  - orgId: 1
    name: velya-slack-critical
    receivers:
      - uid: velya-slack-critical
        type: slack
        settings:
          url: '$SLACK_WEBHOOK_CRITICAL' # Variável de ambiente — vem do Secret K8s
          channel: '#velya-ops-critical'
          title: '{{ template "velya.slack.title" . }}'
          text: '{{ template "velya.slack.message" . }}'
```

```yaml
# ExternalSecret para injetar webhooks como env vars no Grafana
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: grafana-contact-points-secrets
  namespace: velya-dev-observability
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: velya-aws-secrets-manager
    kind: SecretStore
  target:
    name: grafana-contact-points-secrets
    creationPolicy: Owner
  data:
    - secretKey: SLACK_WEBHOOK_CRITICAL
      remoteRef:
        key: velya/observability/slack-webhook-critical
    - secretKey: PAGERDUTY_INTEGRATION_KEY
      remoteRef:
        key: velya/observability/pagerduty-integration-key
```
