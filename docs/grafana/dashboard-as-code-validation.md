# Pipeline de Validacao Dashboard-as-Code

## Visao Geral

Este documento define o pipeline completo de validacao para dashboards gerenciados como codigo (Dashboard-as-Code) na plataforma Velya. Todo dashboard Grafana e versionado em Git, validado automaticamente em PRs, e provisionado via ArgoCD.

---

## Estrutura do Repositorio

```
velya-platform/
  dashboards/
    platform/
      overview.json
      kubernetes-cluster.json
      node-resources.json
      namespace-resources.json
      networking.json
      argocd-status.json
      keda-autoscaling.json
    backend/
      patient-api.json
      scheduling-api.json
      auth-service.json
      notification-service.json
      billing-service.json
      integration-hub.json
    frontend/
      frontend-vitals.json
      frontend-errors.json
      frontend-performance.json
      mobile-telemetry.json
      user-experience.json
    agents/
      agent-orchestrator.json
      agent-triage.json
      agent-diagnosis.json
      agent-scheduling.json
      agent-followup.json
      llm-gateway.json
      agent-guardrails.json
    business/
      patient-flow.json
      appointment-analytics.json
      bed-management.json
      revenue-cycle.json
      clinical-quality.json
    observability/
      datasource-integrity.json
      meta-prometheus.json
      meta-loki.json
      meta-tempo.json
      meta-alloy.json
      dae-status.json
    cost/
      cloud-cost.json
      resource-efficiency.json
      observability-cost.json
      rightsizing.json
    library-panels/
      velya-golden-signals.json
      velya-slo-status.json
      velya-pod-resources.json
      velya-log-volume.json
      velya-error-log-stream.json
      velya-trace-duration-hist.json
      velya-cpu-profile.json
      velya-alert-status.json
    schemas/
      dashboard-schema.json
      library-panel-schema.json
    config/
      ownership-registry.yaml
      naming-standards.yaml
      validation-config.yaml
```

---

## Regras de Validacao

### V-01: Estrutura JSON Valida

| Regra       | Descricao                                                |
| ----------- | -------------------------------------------------------- |
| Verificacao | JSON e sintaticamente valido e segue o schema do Grafana |
| Severidade  | **Bloqueante** - PR nao pode ser mergeado                |
| Ferramenta  | jsonschema + schema customizado Velya                    |

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["uid", "title", "tags", "panels", "templating", "annotations"],
  "properties": {
    "uid": {
      "type": "string",
      "pattern": "^velya-[a-z0-9-]+$",
      "description": "UID deve seguir padrao velya-*"
    },
    "title": {
      "type": "string",
      "minLength": 5,
      "maxLength": 100
    },
    "tags": {
      "type": "array",
      "minItems": 2,
      "items": { "type": "string" },
      "contains": { "const": "velya" }
    },
    "description": {
      "type": "string",
      "minLength": 20,
      "description": "Descricao obrigatoria com minimo 20 caracteres"
    }
  }
}
```

### V-02: Referencia de Datasource Valida

| Regra       | Descricao                                           |
| ----------- | --------------------------------------------------- |
| Verificacao | Todo datasource referenciado existe na configuracao |
| Severidade  | **Bloqueante**                                      |
| Ferramenta  | Script de validacao customizado                     |

```yaml
# Datasources validos
valid_datasources:
  - uid: 'prometheus'
    name: 'Prometheus'
    type: 'prometheus'
  - uid: 'loki'
    name: 'Loki'
    type: 'loki'
  - uid: 'tempo'
    name: 'Tempo'
    type: 'tempo'
  - uid: 'pyroscope'
    name: 'Pyroscope'
    type: 'grafana-pyroscope'
  - uid: 'alertmanager'
    name: 'Alertmanager'
    type: 'alertmanager'
  - uid: '-- Grafana --'
    name: 'Grafana'
    type: 'grafana'
```

### V-03: Validacao de Variaveis

| Regra       | Descricao                                                      |
| ----------- | -------------------------------------------------------------- |
| Verificacao | Variaveis referenciadas na query estao definidas no templating |
| Severidade  | **Bloqueante**                                                 |
| Ferramenta  | Regex scan + cross-reference                                   |

```python
# Logica de validacao de variaveis
def validate_variables(dashboard_json):
    """
    Verifica que toda variavel referenciada em queries existe na
    secao templating do dashboard.
    """
    defined_variables = set()
    for var in dashboard_json.get('templating', {}).get('list', []):
        defined_variables.add(var['name'])

    referenced_variables = set()
    for panel in dashboard_json.get('panels', []):
        for target in panel.get('targets', []):
            expr = target.get('expr', '')
            # Match $variable e ${variable}
            refs = re.findall(r'\$\{?(\w+)\}?', expr)
            referenced_variables.update(refs)

    # Variaveis built-in do Grafana (nao precisam ser definidas)
    builtin = {'__from', '__to', '__interval', '__interval_ms',
               '__rate_interval', '__name', '__data', '__value',
               '__series', '__field', '__org', '__user', '__dashboard',
               '__range', '__range_s', '__range_ms', '__timeFilter'}

    undefined = referenced_variables - defined_variables - builtin

    if undefined:
        return False, f"Variaveis referenciadas mas nao definidas: {undefined}"
    return True, "OK"
```

### V-04: Validacao de Transformacoes

| Regra       | Descricao                                       |
| ----------- | ----------------------------------------------- |
| Verificacao | Transformacoes usam campos que existem na query |
| Severidade  | **Warning** - nao bloqueia mas gera aviso       |

### V-05: Validacao de Links

| Regra       | Descricao                                               |
| ----------- | ------------------------------------------------------- |
| Verificacao | Links de dashboard apontam para UIDs existentes no repo |
| Severidade  | **Warning**                                             |

### V-06: Padrao de Nomenclatura

| Regra       | Descricao                                              |
| ----------- | ------------------------------------------------------ |
| Verificacao | UID, titulo e nome de arquivo seguem padroes definidos |
| Severidade  | **Bloqueante**                                         |

```yaml
# naming-standards.yaml
naming:
  uid:
    pattern: '^velya-[a-z0-9-]+$'
    max_length: 50
    examples:
      - 'velya-patient-api'
      - 'velya-kubernetes-cluster'

  title:
    pattern: '^Velya - .+$'
    max_length: 100
    examples:
      - 'Velya - Patient API Service'
      - 'Velya - Kubernetes Cluster Status'

  filename:
    pattern: "^[a-z0-9-]+\\.json$"
    must_match_uid: true
    examples:
      - 'patient-api.json'
      - 'kubernetes-cluster.json'

  panel_title:
    min_length: 3
    max_length: 80
    forbidden_titles:
      - 'Panel Title'
      - 'New Panel'
      - 'Copy of'
      - 'Untitled'

  variable_name:
    pattern: '^[a-z][a-z0-9_]*$'
    max_length: 30

  tag_required:
    - 'velya'
    - criticality_tag: 'criticality:{critical|high|medium|low}'
    - owner_tag: 'owner:{role}'
```

### V-07: Pasta Correta

| Regra       | Descricao                                              |
| ----------- | ------------------------------------------------------ |
| Verificacao | Dashboard esta na pasta correta conforme sua categoria |
| Severidade  | **Bloqueante**                                         |

```yaml
folder_mapping:
  platform/: 'Platform/Infra'
  backend/: 'Backend'
  frontend/: 'Frontend'
  agents/: 'AI Agents'
  business/: 'Business/Hospital'
  observability/: 'Observability Health'
  cost/: 'Cost/Efficiency'
```

### V-08: Ownership Obrigatorio

| Regra       | Descricao                                            |
| ----------- | ---------------------------------------------------- |
| Verificacao | Dashboard esta registrado no ownership-registry.yaml |
| Severidade  | **Bloqueante**                                       |

### V-09: Criticidade Obrigatoria

| Regra       | Descricao                                           |
| ----------- | --------------------------------------------------- |
| Verificacao | Dashboard tem tag de criticidade e esta no registry |
| Severidade  | **Bloqueante**                                      |

### V-10: Adequacao de Visualizacao

| Regra       | Descricao                                     |
| ----------- | --------------------------------------------- |
| Verificacao | Tipo de painel e adequado para o tipo de dado |
| Severidade  | **Warning**                                   |

```yaml
visualization_rules:
  - data_type: 'single_value'
    recommended: ['stat', 'gauge']
    not_recommended: ['timeseries', 'table']

  - data_type: 'time_series'
    recommended: ['timeseries', 'heatmap']
    not_recommended: ['stat', 'gauge']

  - data_type: 'logs'
    recommended: ['logs']
    not_recommended: ['timeseries', 'table']

  - data_type: 'traces'
    recommended: ['traces', 'nodeGraph']
    not_recommended: ['timeseries']

  - data_type: 'distribution'
    recommended: ['histogram', 'heatmap', 'bargauge']
    not_recommended: ['stat']

  - data_type: 'status'
    recommended: ['state-timeline', 'status-history']
    not_recommended: ['timeseries']
```

### V-11: Descricao e Help Presentes

| Regra       | Descricao                                               |
| ----------- | ------------------------------------------------------- |
| Verificacao | Dashboard tem descricao, paineis criticos tem descricao |
| Severidade  | **Warning** para dashboard, **Info** para paineis       |

### V-12: Link de Runbook para Dashboards Criticos

| Regra       | Descricao                                 |
| ----------- | ----------------------------------------- |
| Verificacao | Dashboards critical tem link para runbook |
| Severidade  | **Warning**                               |

### V-13: Tags Obrigatorias

| Regra       | Descricao                                           |
| ----------- | --------------------------------------------------- |
| Verificacao | Tags minimas presentes: "velya", criticidade, owner |
| Severidade  | **Bloqueante**                                      |

---

## GitHub Actions Workflow

```yaml
name: Dashboard Validation
on:
  pull_request:
    paths:
      - 'dashboards/**/*.json'
      - 'dashboards/config/**'
      - 'dashboards/schemas/**'

concurrency:
  group: dashboard-validation-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate-dashboards:
    name: Validate Dashboard Changes
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install Dependencies
        run: |
          pip install jsonschema pyyaml requests jinja2

      - name: Identify Changed Dashboards
        id: changed
        run: |
          CHANGED=$(git diff --name-only origin/${{ github.base_ref }}...HEAD -- 'dashboards/**/*.json' | tr '\n' ',')
          echo "files=${CHANGED}" >> $GITHUB_OUTPUT
          echo "Changed files: ${CHANGED}"

      - name: V-01 JSON Structure Validation
        if: steps.changed.outputs.files != ''
        run: |
          python scripts/validate_dashboard_structure.py \
            --schema dashboards/schemas/dashboard-schema.json \
            --files "${{ steps.changed.outputs.files }}"

      - name: V-02 Datasource Reference Check
        if: steps.changed.outputs.files != ''
        run: |
          python scripts/validate_datasource_refs.py \
            --valid-datasources dashboards/config/validation-config.yaml \
            --files "${{ steps.changed.outputs.files }}"

      - name: V-03 Variable Validation
        if: steps.changed.outputs.files != ''
        run: |
          python scripts/validate_variables.py \
            --files "${{ steps.changed.outputs.files }}"

      - name: V-04 Transformation Validation
        if: steps.changed.outputs.files != ''
        run: |
          python scripts/validate_transformations.py \
            --files "${{ steps.changed.outputs.files }}"

      - name: V-05 Link Validation
        if: steps.changed.outputs.files != ''
        run: |
          python scripts/validate_links.py \
            --dashboard-dir dashboards/ \
            --files "${{ steps.changed.outputs.files }}"

      - name: V-06 Naming Standards
        if: steps.changed.outputs.files != ''
        run: |
          python scripts/validate_naming.py \
            --standards dashboards/config/naming-standards.yaml \
            --files "${{ steps.changed.outputs.files }}"

      - name: V-07 Folder Correctness
        if: steps.changed.outputs.files != ''
        run: |
          python scripts/validate_folder.py \
            --mapping dashboards/config/validation-config.yaml \
            --files "${{ steps.changed.outputs.files }}"

      - name: V-08 Ownership Mandatory
        if: steps.changed.outputs.files != ''
        run: |
          python scripts/validate_ownership.py \
            --registry dashboards/config/ownership-registry.yaml \
            --files "${{ steps.changed.outputs.files }}"

      - name: V-09 Criticality Mandatory
        if: steps.changed.outputs.files != ''
        run: |
          python scripts/validate_criticality.py \
            --files "${{ steps.changed.outputs.files }}"

      - name: V-10 Visualization Adequacy
        if: steps.changed.outputs.files != ''
        continue-on-error: true
        run: |
          python scripts/validate_visualization.py \
            --rules dashboards/config/validation-config.yaml \
            --files "${{ steps.changed.outputs.files }}"

      - name: V-11 Description and Help
        if: steps.changed.outputs.files != ''
        continue-on-error: true
        run: |
          python scripts/validate_descriptions.py \
            --files "${{ steps.changed.outputs.files }}"

      - name: V-12 Runbook Link for Critical
        if: steps.changed.outputs.files != ''
        continue-on-error: true
        run: |
          python scripts/validate_runbook_links.py \
            --files "${{ steps.changed.outputs.files }}"

      - name: V-13 Mandatory Tags
        if: steps.changed.outputs.files != ''
        run: |
          python scripts/validate_tags.py \
            --required-tags "velya" \
            --files "${{ steps.changed.outputs.files }}"

      - name: Generate Validation Report
        if: always()
        run: |
          python scripts/generate_validation_report.py \
            --output validation-report.md

      - name: Post Report to PR
        if: always()
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          path: validation-report.md

  preview-dashboards:
    name: Preview Dashboard Changes
    runs-on: ubuntu-latest
    needs: validate-dashboards
    if: success()

    services:
      grafana:
        image: grafana/grafana-oss:11.4.0
        ports:
          - 3000:3000
        env:
          GF_SECURITY_ADMIN_PASSWORD: preview
          GF_AUTH_ANONYMOUS_ENABLED: 'true'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Provision Changed Dashboards
        run: |
          for f in $(git diff --name-only origin/${{ github.base_ref }}...HEAD -- 'dashboards/**/*.json'); do
            curl -s -X POST \
              -H "Content-Type: application/json" \
              -H "Authorization: Bearer admin:preview" \
              -d @"$f" \
              http://localhost:3000/api/dashboards/db
          done

      - name: Take Screenshots
        run: |
          npx @grafana/image-renderer \
            --url http://localhost:3000 \
            --dashboards "$(git diff --name-only origin/${{ github.base_ref }}...HEAD -- 'dashboards/**/*.json')" \
            --output screenshots/

      - name: Upload Screenshots
        uses: actions/upload-artifact@v4
        with:
          name: dashboard-screenshots
          path: screenshots/
```

---

## Tabela Resumo de Validacoes

| ID   | Validacao                     | Severidade | Bloqueante | Automatizavel |
| ---- | ----------------------------- | ---------- | ---------- | ------------- |
| V-01 | Estrutura JSON                | Error      | Sim        | Sim           |
| V-02 | Referencia de Datasource      | Error      | Sim        | Sim           |
| V-03 | Integridade de Variaveis      | Error      | Sim        | Sim           |
| V-04 | Integridade de Transformacoes | Warning    | Nao        | Parcial       |
| V-05 | Integridade de Links          | Warning    | Nao        | Sim           |
| V-06 | Padrao de Nomenclatura        | Error      | Sim        | Sim           |
| V-07 | Pasta Correta                 | Error      | Sim        | Sim           |
| V-08 | Ownership Obrigatorio         | Error      | Sim        | Sim           |
| V-09 | Criticidade Obrigatoria       | Error      | Sim        | Sim           |
| V-10 | Adequacao de Visualizacao     | Warning    | Nao        | Parcial       |
| V-11 | Descricao/Help                | Warning    | Nao        | Sim           |
| V-12 | Runbook Link                  | Warning    | Nao        | Sim           |
| V-13 | Tags Obrigatorias             | Error      | Sim        | Sim           |

---

## Fluxo de Deploy via ArgoCD

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: velya-grafana-dashboards
  namespace: argocd
spec:
  project: velya-observability
  source:
    repoURL: https://github.com/velya/velya-platform.git
    targetRevision: main
    path: dashboards
    directory:
      recurse: true
      include: '*.json'
  destination:
    server: https://kubernetes.default.svc
    namespace: velya-observability
  syncPolicy:
    automated:
      prune: false
      selfHeal: true
    syncOptions:
      - CreateNamespace=false
      - ApplyOutOfSyncOnly=true
    retry:
      limit: 3
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 1m
```

---

## Provisionamento via ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: velya-dashboard-provisioning
  namespace: velya-observability
  labels:
    grafana_dashboard: '1'
data:
  dashboards.yaml: |
    apiVersion: 1
    providers:
      - name: 'velya-dashboards'
        orgId: 1
        folder: ''
        folderUid: ''
        type: file
        disableDeletion: false
        updateIntervalSeconds: 60
        allowUiUpdates: false
        options:
          path: /var/lib/grafana/dashboards
          foldersFromFilesStructure: true
```
