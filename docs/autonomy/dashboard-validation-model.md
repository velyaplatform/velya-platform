# Modelo de Validacao Automatica de Dashboards

> **Principio**: Um dashboard quebrado ou sem dados e pior que nenhum dashboard —
> cria falsa sensacao de seguranca. Toda dashboard deve ser validada automaticamente
> para garantir que esta mostrando dados reais e corretos.

## Visao Geral

A validacao automatica de dashboards verifica continuamente que cada dashboard
Grafana esta funcional, com dados reais, e sem erros ocultos.

```
+------------------+     +------------------+     +------------------+
| Grafana API      |     | Dashboard        |     | Alertas          |
| (Listar/Query)   | --> | Validator        | --> | Dashboard quebrado|
|                  |     |                  |     | Panel sem dados  |
+------------------+     +------------------+     | Query falhando   |
                                                   | Variavel vazia   |
                                                   +------------------+
```

---

## Checagens Realizadas

### 1. Carregamento do Dashboard

```yaml
check: dashboard-loads
description: "Dashboard carrega sem erro via API"
method: GET /api/dashboards/uid/{uid}
expect:
  status: 200
  response_time: < 5000ms
  body:
    has_field: dashboard
    has_field: meta
severity_on_failure: critical
```

### 2. Queries Retornam Dados

```yaml
check: queries-return-data
description: "Cada panel query retorna pelo menos 1 serie de dados"
method: POST /api/ds/query
for_each: panel in dashboard.panels
expect:
  status: 200
  results:
    min_series: 1
    no_errors: true
exceptions:
  - panel_type: text
  - panel_type: row
  - panel_type: news
  - annotation: velya.io/allow-no-data
severity_on_failure: warning
```

### 3. Variaveis Funcionam

```yaml
check: variables-populated
description: "Todas as template variables retornam opcoes"
method: GET /api/datasources/proxy/{datasource_id}/...
for_each: variable in dashboard.templating.list
expect:
  options_count: >= 1
  current_value: not empty
severity_on_failure: warning
```

### 4. No-Data Inesperado

```yaml
check: no-unexpected-no-data
description: "Paineis que devem ter dados nao mostram 'No data'"
method: POST /api/ds/query
for_each: panel in dashboard.panels where panel.type in [graph, stat, gauge, table]
expect:
  data_points: > 0
  no_null_only: true
exclude:
  - panels com annotation velya.io/optional-data
severity_on_failure: warning
```

### 5. Fonte de Dados Saudavel

```yaml
check: datasource-healthy
description: "Cada datasource usado no dashboard esta acessivel e saudavel"
method: GET /api/datasources/{id}/health
for_each: datasource in dashboard.datasources
expect:
  status: "OK"
  message: not contains "error"
severity_on_failure: critical
```

### 6. Links Funcionam

```yaml
check: links-valid
description: "Links dentro do dashboard apontam para destinos validos"
method: HEAD {link_url}
for_each: link in dashboard.links + panel.links
expect:
  status: < 400
severity_on_failure: low
```

---

## Dashboards Monitorados

```yaml
dashboards:
  - uid: velya-platform-overview
    name: "Velya Platform Overview"
    critical: true
    checks: [loads, queries, variables, no-data, datasource, links]
    expected_panels_with_data: 12
    variables: [namespace, service, interval]

  - uid: velya-patient-service
    name: "Patient Service"
    critical: true
    checks: [loads, queries, no-data, datasource]
    expected_panels_with_data: 8

  - uid: velya-auth-service
    name: "Auth Service"
    critical: true
    checks: [loads, queries, no-data, datasource]
    expected_panels_with_data: 10

  - uid: velya-medication-service
    name: "Medication Service"
    critical: true
    checks: [loads, queries, no-data, datasource]
    expected_panels_with_data: 8

  - uid: velya-api-gateway
    name: "API Gateway"
    critical: true
    checks: [loads, queries, variables, no-data, datasource]
    expected_panels_with_data: 15

  - uid: velya-infrastructure
    name: "Infrastructure Overview"
    critical: true
    checks: [loads, queries, no-data, datasource]
    expected_panels_with_data: 20

  - uid: velya-nats
    name: "NATS Messaging"
    critical: false
    checks: [loads, queries, no-data, datasource]
    expected_panels_with_data: 6

  - uid: velya-postgres
    name: "PostgreSQL"
    critical: true
    checks: [loads, queries, no-data, datasource]
    expected_panels_with_data: 10

  - uid: velya-redis
    name: "Redis"
    critical: false
    checks: [loads, queries, no-data, datasource]
    expected_panels_with_data: 8

  - uid: velya-autonomy-health
    name: "Autonomy Mechanism Health"
    critical: true
    checks: [loads, queries, variables, no-data, datasource, links]
    expected_panels_with_data: 16

  - uid: velya-sla-slo
    name: "SLA/SLO Dashboard"
    critical: true
    checks: [loads, queries, no-data, datasource]
    expected_panels_with_data: 10

  - uid: velya-audit
    name: "Audit Events"
    critical: true
    checks: [loads, queries, no-data, datasource]
    expected_panels_with_data: 6
```

---

## Implementacao

### Grafana API Client

```typescript
interface GrafanaApiClient {
  baseUrl: string;
  token: string;
}

interface DashboardMeta {
  uid: string;
  title: string;
  panels: PanelDefinition[];
  templating: {
    list: TemplateVariable[];
  };
  links: DashboardLink[];
}

interface PanelDefinition {
  id: number;
  title: string;
  type: string;
  targets: QueryTarget[];
  datasource: { uid: string; type: string };
  links?: PanelLink[];
  fieldConfig?: {
    defaults: {
      noValue?: string;
    };
  };
}

interface TemplateVariable {
  name: string;
  type: string;
  datasource?: { uid: string };
  query?: string;
  current?: { value: string };
  options?: { value: string; text: string }[];
}

class GrafanaValidator {
  private client: GrafanaApiClient;

  constructor(baseUrl: string, token: string) {
    this.client = { baseUrl, token };
  }

  async validateDashboard(config: DashboardConfig): Promise<DashboardValidationResult> {
    const result: DashboardValidationResult = {
      uid: config.uid,
      name: config.name,
      timestamp: new Date(),
      checks: [],
      overall: 'passed',
    };

    // 1. Verificar carregamento
    const dashboard = await this.loadDashboard(config.uid);
    if (!dashboard) {
      result.checks.push({
        type: 'loads',
        status: 'failed',
        message: `Dashboard ${config.uid} nao encontrado`,
      });
      result.overall = 'failed';
      return result;
    }

    result.checks.push({ type: 'loads', status: 'passed', message: 'Dashboard carregou OK' });

    // 2. Verificar datasources
    if (config.checks.includes('datasource')) {
      const dsResult = await this.checkDatasources(dashboard);
      result.checks.push(...dsResult);
    }

    // 3. Verificar queries de cada panel
    if (config.checks.includes('queries') || config.checks.includes('no-data')) {
      const panelResults = await this.checkPanels(dashboard, config);
      result.checks.push(...panelResults);
    }

    // 4. Verificar variaveis
    if (config.checks.includes('variables')) {
      const varResults = await this.checkVariables(dashboard);
      result.checks.push(...varResults);
    }

    // 5. Verificar links
    if (config.checks.includes('links')) {
      const linkResults = await this.checkLinks(dashboard);
      result.checks.push(...linkResults);
    }

    // Determinar status geral
    const failures = result.checks.filter(c => c.status === 'failed');
    if (failures.length > 0) {
      result.overall = failures.some(f => f.severity === 'critical') ? 'failed' : 'degraded';
    }

    return result;
  }

  private async loadDashboard(uid: string): Promise<DashboardMeta | null> {
    try {
      const response = await fetch(`${this.client.baseUrl}/api/dashboards/uid/${uid}`, {
        headers: { Authorization: `Bearer ${this.client.token}` },
        signal: AbortSignal.timeout(10000),
      });

      if (response.status !== 200) return null;
      const data = await response.json();
      return data.dashboard;
    } catch {
      return null;
    }
  }

  private async checkDatasources(dashboard: DashboardMeta): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const datasourceUids = new Set<string>();

    for (const panel of dashboard.panels) {
      if (panel.datasource?.uid) {
        datasourceUids.add(panel.datasource.uid);
      }
    }

    for (const dsUid of datasourceUids) {
      try {
        const response = await fetch(
          `${this.client.baseUrl}/api/datasources/uid/${dsUid}/health`,
          { headers: { Authorization: `Bearer ${this.client.token}` } }
        );

        if (response.status === 200) {
          const health = await response.json();
          if (health.status === 'OK') {
            results.push({
              type: 'datasource',
              status: 'passed',
              message: `Datasource ${dsUid} saudavel`,
            });
          } else {
            results.push({
              type: 'datasource',
              status: 'failed',
              severity: 'critical',
              message: `Datasource ${dsUid}: ${health.message}`,
            });
          }
        } else {
          results.push({
            type: 'datasource',
            status: 'failed',
            severity: 'critical',
            message: `Datasource ${dsUid} inacessivel (status ${response.status})`,
          });
        }
      } catch (error) {
        results.push({
          type: 'datasource',
          status: 'failed',
          severity: 'critical',
          message: `Datasource ${dsUid}: ${error}`,
        });
      }
    }

    return results;
  }

  private async checkPanels(
    dashboard: DashboardMeta,
    config: DashboardConfig,
  ): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const queryablePanels = dashboard.panels.filter(
      p => !['text', 'row', 'news'].includes(p.type)
    );

    let panelsWithData = 0;

    for (const panel of queryablePanels) {
      try {
        const queryResult = await this.executeQuery(panel);

        if (queryResult.error) {
          results.push({
            type: 'query',
            status: 'failed',
            severity: 'warning',
            message: `Panel "${panel.title}" (id:${panel.id}): query error - ${queryResult.error}`,
            panel: panel.title,
          });
        } else if (queryResult.dataPoints === 0) {
          // Verificar se no-data e esperado
          const allowNoData = panel.fieldConfig?.defaults?.noValue !== undefined;
          if (!allowNoData) {
            results.push({
              type: 'no-data',
              status: 'failed',
              severity: 'warning',
              message: `Panel "${panel.title}" (id:${panel.id}): sem dados`,
              panel: panel.title,
            });
          }
        } else {
          panelsWithData++;
        }
      } catch (error) {
        results.push({
          type: 'query',
          status: 'failed',
          severity: 'warning',
          message: `Panel "${panel.title}" (id:${panel.id}): ${error}`,
          panel: panel.title,
        });
      }
    }

    // Verificar minimo de paineis com dados
    if (config.expected_panels_with_data && panelsWithData < config.expected_panels_with_data) {
      results.push({
        type: 'panels-with-data',
        status: 'failed',
        severity: 'warning',
        message: `Apenas ${panelsWithData}/${config.expected_panels_with_data} paineis com dados`,
      });
    }

    return results;
  }

  private async checkVariables(dashboard: DashboardMeta): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    for (const variable of dashboard.templating?.list ?? []) {
      if (variable.type === 'custom' || variable.type === 'constant') {
        continue; // Variaveis estaticas nao precisam de checagem
      }

      const hasOptions = variable.options && variable.options.length > 0;
      const hasCurrentValue = variable.current?.value &&
        variable.current.value !== '' &&
        variable.current.value !== '$__all';

      if (!hasOptions && !hasCurrentValue) {
        results.push({
          type: 'variable',
          status: 'failed',
          severity: 'warning',
          message: `Variavel "${variable.name}": sem opcoes/valor`,
          variable: variable.name,
        });
      } else {
        results.push({
          type: 'variable',
          status: 'passed',
          message: `Variavel "${variable.name}": OK`,
          variable: variable.name,
        });
      }
    }

    return results;
  }

  private async checkLinks(dashboard: DashboardMeta): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const links: string[] = [];

    // Coletar links do dashboard
    for (const link of dashboard.links ?? []) {
      if (link.url) links.push(link.url);
    }

    // Coletar links dos paineis
    for (const panel of dashboard.panels) {
      for (const link of panel.links ?? []) {
        if (link.url) links.push(link.url);
      }
    }

    for (const linkUrl of [...new Set(links)]) {
      try {
        // Resolver variaveis de template no link
        const resolvedUrl = linkUrl.startsWith('http')
          ? linkUrl
          : `${this.client.baseUrl}${linkUrl}`;

        const response = await fetch(resolvedUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
          redirect: 'follow',
        });

        if (response.status >= 400) {
          results.push({
            type: 'link',
            status: 'failed',
            severity: 'low',
            message: `Link quebrado: ${linkUrl} (status ${response.status})`,
          });
        }
      } catch {
        results.push({
          type: 'link',
          status: 'failed',
          severity: 'low',
          message: `Link inacessivel: ${linkUrl}`,
        });
      }
    }

    return results;
  }

  private async executeQuery(panel: PanelDefinition): Promise<QueryResult> {
    // Implementacao que usa a Grafana Query API
    const body = {
      queries: panel.targets.map(t => ({
        ...t,
        datasource: panel.datasource,
        refId: t.refId || 'A',
      })),
      from: 'now-1h',
      to: 'now',
    };

    const response = await fetch(`${this.client.baseUrl}/api/ds/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.client.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (response.status !== 200) {
      return { error: `Status ${response.status}`, dataPoints: 0 };
    }

    const data = await response.json();
    let totalDataPoints = 0;

    for (const [, result] of Object.entries(data.results ?? {})) {
      const frames = (result as any).frames ?? [];
      for (const frame of frames) {
        const values = frame.data?.values ?? [];
        for (const v of values) {
          totalDataPoints += v?.length ?? 0;
        }
      }
    }

    return { error: null, dataPoints: totalDataPoints };
  }
}
```

---

## CronJob YAML

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: dashboard-validator
  namespace: velya-autonomy
  labels:
    velya.io/validator: dashboard
    velya.io/tier: autonomy
spec:
  schedule: "*/15 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 10
  jobTemplate:
    spec:
      activeDeadlineSeconds: 600
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: dashboard-validator
              image: velya/autonomy-agent:latest
              command: ["node", "dist/validators/dashboard-validator.js"]
              env:
                - name: GRAFANA_URL
                  value: "http://grafana.velya-monitoring.svc.cluster.local:3000"
                - name: GRAFANA_TOKEN
                  valueFrom:
                    secretKeyRef:
                      name: grafana-api-token
                      key: token
                - name: CONFIG_PATH
                  value: "/config/dashboards.yaml"
                - name: ALERT_CHANNEL
                  valueFrom:
                    configMapKeyRef:
                      name: autonomy-config
                      key: ALERT_CHANNEL
              volumeMounts:
                - name: dashboard-config
                  mountPath: /config
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 200m
                  memory: 256Mi
          volumes:
            - name: dashboard-config
              configMap:
                name: dashboard-validator-config
          restartPolicy: OnFailure
```

---

## Alertas

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: dashboard-validation-alerts
  namespace: velya-autonomy
spec:
  groups:
    - name: dashboard-validation
      rules:
        - alert: DashboardNotLoading
          expr: velya_dashboard_check_status{check="loads"} == 0
          for: 15m
          labels:
            severity: critical
          annotations:
            summary: "Dashboard {{ $labels.dashboard }} nao esta carregando"
            description: "Dashboard falhou check de carregamento em 2+ validacoes"

        - alert: DashboardDatasourceUnhealthy
          expr: velya_dashboard_check_status{check="datasource"} == 0
          for: 15m
          labels:
            severity: critical
          annotations:
            summary: "Datasource de {{ $labels.dashboard }} com problema"

        - alert: DashboardPanelsNoData
          expr: |
            velya_dashboard_panels_with_data / velya_dashboard_panels_total < 0.8
          for: 30m
          labels:
            severity: warning
          annotations:
            summary: "Dashboard {{ $labels.dashboard }}: {{ $value | humanizePercentage }} paineis com dados"

        - alert: DashboardQueryErrors
          expr: velya_dashboard_query_errors_total > 0
          for: 15m
          labels:
            severity: warning
          annotations:
            summary: "Dashboard {{ $labels.dashboard }} tem queries com erro"

        - alert: DashboardVariableEmpty
          expr: velya_dashboard_check_status{check="variable"} == 0
          for: 30m
          labels:
            severity: warning
          annotations:
            summary: "Dashboard {{ $labels.dashboard }}: variavel {{ $labels.variable }} vazia"

        - alert: DashboardValidationNotRunning
          expr: |
            time() - velya_dashboard_validation_last_run_timestamp > 2400
          labels:
            severity: warning
          annotations:
            summary: "Validacao de dashboards nao rodou nos ultimos 40min"
```

---

## Metricas

```yaml
metrics:
  - name: velya_dashboard_check_status
    type: gauge
    labels: [dashboard, check]
    help: "1=pass, 0=fail"

  - name: velya_dashboard_panels_total
    type: gauge
    labels: [dashboard]
    help: "Total de paineis no dashboard"

  - name: velya_dashboard_panels_with_data
    type: gauge
    labels: [dashboard]
    help: "Paineis com dados"

  - name: velya_dashboard_panels_no_data
    type: gauge
    labels: [dashboard]
    help: "Paineis sem dados"

  - name: velya_dashboard_query_errors_total
    type: counter
    labels: [dashboard, panel]
    help: "Queries com erro"

  - name: velya_dashboard_validation_duration_seconds
    type: histogram
    labels: [dashboard]
    help: "Duracao da validacao por dashboard"

  - name: velya_dashboard_validation_last_run_timestamp
    type: gauge
    help: "Timestamp da ultima validacao"

  - name: velya_dashboard_overall_status
    type: gauge
    labels: [dashboard]
    help: "1=passed, 0.5=degraded, 0=failed"
```

---

## Resultado da Validacao

```typescript
interface DashboardValidationResult {
  uid: string;
  name: string;
  timestamp: Date;
  overall: 'passed' | 'degraded' | 'failed';
  checks: CheckResult[];
  summary: {
    totalPanels: number;
    panelsWithData: number;
    panelsNoData: number;
    panelsWithError: number;
    variablesTotal: number;
    variablesPopulated: number;
    datasourcesTotal: number;
    datasourcesHealthy: number;
    linksTotal: number;
    linksBroken: number;
  };
}

interface CheckResult {
  type: 'loads' | 'query' | 'no-data' | 'variable' | 'datasource' | 'link' | 'panels-with-data';
  status: 'passed' | 'failed';
  severity?: 'critical' | 'warning' | 'low';
  message: string;
  panel?: string;
  variable?: string;
}
```

---

## Resumo de Checagens por Dashboard

| Dashboard                    | Load | Queries | Variaveis | No-Data | Datasource | Links | Frequencia |
|------------------------------|------|---------|-----------|---------|------------|-------|------------|
| Platform Overview            | X    | X       | X         | X       | X          | X     | 15min      |
| Patient Service              | X    | X       |           | X       | X          |       | 15min      |
| Auth Service                 | X    | X       |           | X       | X          |       | 15min      |
| Medication Service           | X    | X       |           | X       | X          |       | 15min      |
| API Gateway                  | X    | X       | X         | X       | X          |       | 15min      |
| Infrastructure               | X    | X       |           | X       | X          |       | 15min      |
| NATS Messaging               | X    | X       |           | X       | X          |       | 15min      |
| PostgreSQL                   | X    | X       |           | X       | X          |       | 15min      |
| Redis                        | X    | X       |           | X       | X          |       | 15min      |
| Autonomy Health              | X    | X       | X         | X       | X          | X     | 15min      |
| SLA/SLO                      | X    | X       |           | X       | X          |       | 15min      |
| Audit Events                 | X    | X       |           | X       | X          |       | 15min      |
