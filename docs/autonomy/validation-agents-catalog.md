# Catalogo de Validation Agents

> **Definicao**: Validation agents sao processos que validam proativamente a corretude
> do sistema, executando testes sinteticos e verificacoes de integridade em intervalos
> regulares — sem esperar que um usuario reporte o problema.

## Visao Geral

A plataforma Velya opera 7 validation agents independentes. Diferente dos watchdogs
(que observam e reagem), os validation agents executam acoes ativas para validar
que o sistema esta funcionando corretamente.

```
Watchdogs: OBSERVAM passivamente e REAGEM a anomalias
Validators: TESTAM ativamente e CONFIRMAM corretude
```

---

## 1. Release Validation Agent

### O que Valida
Cada novo deploy (release) e automaticamente validado antes de ser promovido.
Verifica que a nova versao esta funcional, performando adequadamente e sem regressoes.

### Como Valida

```typescript
interface ReleaseValidation {
  release: string;
  version: string;
  stages: [
    'deployment-health',    // Pods rodando sem crash
    'readiness-check',      // Readiness probes passando
    'smoke-tests',          // Fluxos criticos funcionando
    'performance-baseline', // Latencia e throughput aceitaveis
    'error-rate-check',     // Taxa de erro nao subiu
    'regression-check',     // Sem regressoes conhecidas
    'canary-analysis',      // Metricas do canary vs stable
  ];
  timeout: '10m';
  rollbackOnFailure: true;
}
```

### Frequencia
- **Trigger**: Automatico apos cada deploy (event-driven)
- **Revalidacao**: A cada 5 minutos por 30 minutos apos deploy

### Criterios Pass/Fail

| Criterio                        | Pass                    | Fail                          |
|----------------------------------|-------------------------|-------------------------------|
| Pods rodando                    | Todos Ready             | Qualquer CrashLoopBackOff    |
| Readiness probes                | 100% passando           | Qualquer falhando            |
| Smoke tests                     | 100% passando           | Qualquer falhando            |
| Latencia p99                    | <= 1.2x baseline        | > 1.5x baseline              |
| Taxa de erro                    | <= baseline + 0.1%      | > baseline + 1%              |
| Regressoes                      | 0 detectadas            | >= 1 detectada               |
| Canary error rate               | <= stable               | > stable + 1%                |

### Implementacao

```typescript
interface ReleaseValidationResult {
  release: string;
  version: string;
  status: 'passed' | 'failed' | 'in-progress';
  stages: StageResult[];
  startedAt: Date;
  completedAt?: Date;
  decision: 'promote' | 'rollback' | 'pending';
  evidence: ValidationEvidence[];
}

async function validateRelease(release: ReleaseInfo): Promise<ReleaseValidationResult> {
  const result: ReleaseValidationResult = {
    release: release.name,
    version: release.version,
    status: 'in-progress',
    stages: [],
    startedAt: new Date(),
    decision: 'pending',
    evidence: [],
  };

  // Stage 1: Deployment Health
  const deployHealth = await checkDeploymentHealth(release);
  result.stages.push(deployHealth);
  if (deployHealth.status === 'failed') {
    result.status = 'failed';
    result.decision = 'rollback';
    await executeRollback(release);
    return result;
  }

  // Stage 2: Readiness Check
  const readiness = await checkReadiness(release);
  result.stages.push(readiness);
  if (readiness.status === 'failed') {
    result.status = 'failed';
    result.decision = 'rollback';
    await executeRollback(release);
    return result;
  }

  // Stage 3: Smoke Tests
  const smokeTests = await runSmokeTests(release);
  result.stages.push(smokeTests);
  if (smokeTests.status === 'failed') {
    result.status = 'failed';
    result.decision = 'rollback';
    await executeRollback(release);
    return result;
  }

  // Stage 4: Performance Baseline
  const perfBaseline = await checkPerformanceBaseline(release);
  result.stages.push(perfBaseline);

  // Stage 5: Error Rate Check
  const errorRate = await checkErrorRate(release);
  result.stages.push(errorRate);

  // Stage 6: Regression Check
  const regressions = await checkRegressions(release);
  result.stages.push(regressions);

  // Stage 7: Canary Analysis (se aplicavel)
  if (release.canaryEnabled) {
    const canary = await analyzeCanary(release);
    result.stages.push(canary);
  }

  // Decisao final
  const failures = result.stages.filter(s => s.status === 'failed');
  if (failures.length > 0) {
    result.status = 'failed';
    result.decision = 'rollback';
    await executeRollback(release);
  } else {
    result.status = 'passed';
    result.decision = 'promote';
    await promoteRelease(release);
  }

  result.completedAt = new Date();
  return result;
}
```

### CronJob YAML (revalidacao pos-deploy)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: release-revalidation
  namespace: velya-autonomy
  labels:
    velya.io/validation: release
    velya.io/tier: autonomy
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 240
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: release-validator
              image: velya/autonomy-agent:latest
              command: ["node", "dist/validators/release-validation.js"]
              env:
                - name: REVALIDATION_WINDOW_MINUTES
                  value: "30"
              resources:
                requests:
                  cpu: 200m
                  memory: 256Mi
                limits:
                  cpu: 500m
                  memory: 512Mi
          restartPolicy: Never
```

---

## 2. Runtime Validation Agent

### O que Valida
Saude do runtime em producao: uso de recursos, garbage collection,
connection pools, thread utilization, memory leaks.

### Como Valida

```yaml
runtime_validation_checks:
  - check: memory-usage
    query: 'container_memory_working_set_bytes{namespace="velya-system"}'
    warning: "> 80% do limit"
    critical: "> 90% do limit"

  - check: cpu-usage
    query: 'rate(container_cpu_usage_seconds_total{namespace="velya-system"}[5m])'
    warning: "> 70% do limit"
    critical: "> 85% do limit"

  - check: restart-count
    query: 'increase(kube_pod_container_status_restarts_total{namespace="velya-system"}[1h])'
    warning: "> 1"
    critical: "> 3"

  - check: connection-pool
    query: 'velya_db_pool_active_connections / velya_db_pool_max_connections'
    warning: "> 0.8"
    critical: "> 0.95"

  - check: gc-pause
    query: 'rate(nodejs_gc_duration_seconds_sum[5m])'
    warning: "> 0.05"
    critical: "> 0.1"

  - check: event-loop-lag
    query: 'nodejs_eventloop_lag_p99_seconds'
    warning: "> 0.1"
    critical: "> 0.5"

  - check: open-handles
    query: 'process_open_fds / process_max_fds'
    warning: "> 0.7"
    critical: "> 0.9"
```

### Frequencia
- A cada 5 minutos

### Criterios Pass/Fail

| Criterio                  | Pass          | Fail               |
|---------------------------|---------------|---------------------|
| Memory usage              | < 80% limit   | > 90% limit        |
| CPU usage                 | < 70% limit   | > 85% limit        |
| Restarts/hora             | <= 1          | > 3                 |
| Connection pool usage     | < 80%         | > 95%              |
| GC pause rate             | < 50ms/s      | > 100ms/s          |
| Event loop lag p99        | < 100ms       | > 500ms            |
| File descriptors          | < 70%         | > 90%              |

---

## 3. Synthetic Validation Agent

### O que Valida
Fluxos end-to-end simulando usuarios reais. Usa k6 para gerar carga
sintetica e validar que os fluxos criticos funcionam corretamente.

### Como Valida

```typescript
// k6 test script para synthetic validation
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    patient_flow: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  // Step 1: Login
  const loginRes = http.post(`${__ENV.BASE_URL}/auth/login`, JSON.stringify({
    username: __ENV.SYNTHETIC_USER,
    password: __ENV.SYNTHETIC_PASSWORD,
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'login has token': (r) => JSON.parse(r.body).access_token !== undefined,
  });

  const token = JSON.parse(loginRes.body).access_token;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Step 2: List patients
  const listRes = http.get(`${__ENV.BASE_URL}/patients`, { headers: authHeaders });
  check(listRes, {
    'list patients status 200': (r) => r.status === 200,
    'list patients has data': (r) => JSON.parse(r.body).length >= 0,
  });

  // Step 3: Create patient
  const createRes = http.post(`${__ENV.BASE_URL}/patients`, JSON.stringify({
    name: 'Synthetic Patient',
    cpf: '00000000000',
    birthDate: '1990-01-01',
  }), { headers: authHeaders });

  check(createRes, {
    'create patient status 201': (r) => r.status === 201,
  });

  const patientId = JSON.parse(createRes.body).id;

  // Step 4: Get patient
  const getRes = http.get(`${__ENV.BASE_URL}/patients/${patientId}`, { headers: authHeaders });
  check(getRes, {
    'get patient status 200': (r) => r.status === 200,
    'get patient correct name': (r) => JSON.parse(r.body).name === 'Synthetic Patient',
  });

  // Step 5: Cleanup
  http.del(`${__ENV.BASE_URL}/patients/${patientId}`, null, { headers: authHeaders });

  sleep(1);
}
```

### Frequencia
- A cada 5 minutos (lightweight)
- A cada 30 minutos (full flow)

### Criterios Pass/Fail

| Criterio                  | Pass          | Fail               |
|---------------------------|---------------|---------------------|
| HTTP success rate         | > 99%         | < 95%              |
| p95 latency               | < 2000ms      | > 5000ms           |
| Flow completion           | 100%          | < 100%             |
| Data integrity            | Correto       | Incorreto          |

### CronJob YAML

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: synthetic-validation
  namespace: velya-autonomy
  labels:
    velya.io/validation: synthetic
    velya.io/tier: autonomy
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 180
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: k6-runner
              image: grafana/k6:latest
              command: ["k6", "run", "/scripts/synthetic-validation.js"]
              env:
                - name: BASE_URL
                  value: "https://api.velya.local"
                - name: SYNTHETIC_USER
                  value: "synthetic-validator"
                - name: SYNTHETIC_PASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: synthetic-credentials
                      key: password
                - name: K6_OUT
                  value: "experimental-prometheus-rw"
                - name: K6_PROMETHEUS_RW_SERVER_URL
                  value: "http://prometheus.velya-monitoring.svc.cluster.local:9090/api/v1/write"
              volumeMounts:
                - name: k6-scripts
                  mountPath: /scripts
              resources:
                requests:
                  cpu: 200m
                  memory: 256Mi
                limits:
                  cpu: 500m
                  memory: 512Mi
          volumes:
            - name: k6-scripts
              configMap:
                name: k6-synthetic-scripts
          restartPolicy: Never
```

---

## 4. Dashboard Validation Agent

### O que Valida
Integridade dos dashboards Grafana: carregamento, queries retornando dados,
variaveis populadas, ausencia de erros, links funcionando.

### Como Valida

```typescript
interface DashboardValidation {
  dashboardUid: string;
  checks: DashboardCheck[];
}

type DashboardCheck =
  | { type: 'loads'; timeout: number }
  | { type: 'panels_have_data'; excludePanels?: string[] }
  | { type: 'no_error_panels' }
  | { type: 'variables_populated' }
  | { type: 'datasources_healthy' }
  | { type: 'links_valid' };

async function validateDashboard(config: DashboardValidation): Promise<DashboardResult> {
  const grafana = new GrafanaClient(process.env.GRAFANA_URL, process.env.GRAFANA_TOKEN);
  const results: CheckResult[] = [];

  // Verificar carregamento
  const dashboard = await grafana.getDashboard(config.dashboardUid);
  if (!dashboard) {
    return { uid: config.dashboardUid, status: 'failed', reason: 'Dashboard nao encontrado' };
  }

  // Verificar cada panel
  for (const panel of dashboard.panels) {
    if (panel.type === 'row') continue;

    // Verificar se panel tem dados
    const queryResult = await grafana.queryPanel(config.dashboardUid, panel.id);
    if (!queryResult || queryResult.data.length === 0) {
      results.push({
        check: 'panel_data',
        panel: panel.title,
        status: 'failed',
        reason: 'Panel sem dados',
      });
    }

    // Verificar erros
    if (queryResult?.error) {
      results.push({
        check: 'panel_error',
        panel: panel.title,
        status: 'failed',
        reason: queryResult.error,
      });
    }
  }

  // Verificar variaveis
  for (const variable of dashboard.templating?.list ?? []) {
    const values = await grafana.getVariableValues(config.dashboardUid, variable.name);
    if (!values || values.length === 0) {
      results.push({
        check: 'variable',
        variable: variable.name,
        status: 'failed',
        reason: 'Variavel sem valores',
      });
    }
  }

  // Verificar datasources
  const datasources = extractDatasources(dashboard);
  for (const ds of datasources) {
    const health = await grafana.checkDatasourceHealth(ds);
    if (!health.ok) {
      results.push({
        check: 'datasource',
        datasource: ds,
        status: 'failed',
        reason: health.error,
      });
    }
  }

  const failures = results.filter(r => r.status === 'failed');
  return {
    uid: config.dashboardUid,
    status: failures.length === 0 ? 'passed' : 'failed',
    checks: results,
    failureCount: failures.length,
    timestamp: new Date(),
  };
}
```

### Frequencia
- A cada 15 minutos

### Criterios Pass/Fail

| Criterio                   | Pass                 | Fail                       |
|----------------------------|----------------------|----------------------------|
| Dashboard carrega          | Status 200           | Erro ou timeout            |
| Panels com dados           | 100% com dados       | Qualquer sem dados         |
| Panels sem erro            | 0 erros              | Qualquer com erro          |
| Variaveis populadas        | Todas com valores    | Qualquer vazia             |
| Datasources saudaveis      | Todas ok             | Qualquer com erro          |
| Links validos              | Todos resolvem       | Qualquer quebrado          |

---

## 5. Mobile Flow Validation Agent

### O que Valida
Fluxos especificos do aplicativo mobile: login mobile, dashboard mobile,
sincronizacao offline, push notifications, camera/scan.

### Como Valida

```yaml
mobile_flow_validation:
  flows:
    - name: mobile-login
      steps:
        - POST /auth/mobile/login (device token + credentials)
        - expect: 200 + session token + refresh token
        - GET /auth/mobile/session
        - expect: 200 + session valid

    - name: mobile-dashboard
      steps:
        - authenticate
        - GET /mobile/dashboard
        - expect: 200 + patient summary + alerts + schedule

    - name: mobile-patient-lookup
      steps:
        - authenticate
        - GET /mobile/patients/search?q=test
        - expect: 200 + results array

    - name: mobile-medication-scan
      steps:
        - authenticate
        - POST /mobile/medications/verify
        - body: { barcode: "TEST123" }
        - expect: 200 + medication info + warnings

    - name: mobile-offline-sync
      steps:
        - authenticate
        - POST /mobile/sync/push (batch of offline events)
        - expect: 200 + sync receipt
        - GET /mobile/sync/status
        - expect: 200 + all events synced

    - name: mobile-notification-test
      steps:
        - authenticate
        - POST /mobile/notifications/test
        - expect: 200 + notification queued
```

### Frequencia
- A cada 10 minutos

### Criterios Pass/Fail

| Criterio                  | Pass          | Fail               |
|---------------------------|---------------|---------------------|
| Login mobile              | Token emitido | Falha auth          |
| Dashboard load            | < 3s          | > 5s ou erro        |
| Patient lookup            | Resultados    | Erro ou vazio       |
| Medication verify         | Info correta  | Erro ou incorreto   |
| Offline sync              | Tudo sincado  | Eventos perdidos    |
| Notification delivery     | Enfileirada   | Nao enfileirada     |

---

## 6. Auth Validation Agent

### O que Valida
Fluxos de autenticacao e autorizacao: login, token refresh, RBAC,
session management, logout, password reset.

### Como Valida

```typescript
interface AuthValidationSuite {
  tests: AuthTest[];
}

const authValidationSuite: AuthValidationSuite = {
  tests: [
    {
      name: 'valid-login',
      action: () => login(validCredentials),
      expect: { status: 200, hasToken: true },
    },
    {
      name: 'invalid-login',
      action: () => login(invalidCredentials),
      expect: { status: 401, noToken: true },
    },
    {
      name: 'token-refresh',
      action: async () => {
        const { refreshToken } = await login(validCredentials);
        return refresh(refreshToken);
      },
      expect: { status: 200, hasNewToken: true },
    },
    {
      name: 'expired-token-rejected',
      action: () => accessProtectedResource(expiredToken),
      expect: { status: 401 },
    },
    {
      name: 'rbac-admin-access',
      action: () => accessAdminEndpoint(adminToken),
      expect: { status: 200 },
    },
    {
      name: 'rbac-user-denied-admin',
      action: () => accessAdminEndpoint(userToken),
      expect: { status: 403 },
    },
    {
      name: 'rbac-patient-access-own-data',
      action: () => accessPatientData(patientToken, ownPatientId),
      expect: { status: 200 },
    },
    {
      name: 'rbac-patient-denied-other-data',
      action: () => accessPatientData(patientToken, otherPatientId),
      expect: { status: 403 },
    },
    {
      name: 'session-invalidation',
      action: async () => {
        const { token } = await login(validCredentials);
        await logout(token);
        return accessProtectedResource(token);
      },
      expect: { status: 401 },
    },
    {
      name: 'rate-limiting',
      action: async () => {
        const results = [];
        for (let i = 0; i < 20; i++) {
          results.push(await login(invalidCredentials));
        }
        return results[results.length - 1];
      },
      expect: { status: 429 },
    },
    {
      name: 'concurrent-sessions',
      action: async () => {
        const session1 = await login(validCredentials);
        const session2 = await login(validCredentials);
        return {
          session1Valid: await validateSession(session1.token),
          session2Valid: await validateSession(session2.token),
        };
      },
      expect: { bothValid: true },
    },
  ],
};
```

### Frequencia
- A cada 5 minutos

### Criterios Pass/Fail

| Criterio                       | Pass            | Fail                    |
|---------------------------------|-----------------|-------------------------|
| Login valido                   | Token emitido   | Erro ou sem token       |
| Login invalido                 | 401 retornado   | Token emitido (!)       |
| Token refresh                  | Novo token      | Erro ou token invalido  |
| Token expirado                 | 401 retornado   | Acesso permitido (!)    |
| RBAC correto                   | Acesso adequado | Acesso indevido (!)     |
| Session invalidation           | 401 apos logout | Acesso apos logout (!)  |
| Rate limiting                  | 429 ativado     | Sem limitacao (!)       |

### CronJob YAML

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: auth-validation
  namespace: velya-autonomy
  labels:
    velya.io/validation: auth
    velya.io/tier: autonomy
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 120
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: auth-validator
              image: velya/autonomy-agent:latest
              command: ["node", "dist/validators/auth-validation.js"]
              env:
                - name: AUTH_URL
                  value: "https://auth.velya.local"
                - name: SYNTHETIC_USER
                  value: "synthetic-validator"
                - name: SYNTHETIC_PASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: synthetic-credentials
                      key: password
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 200m
                  memory: 256Mi
          restartPolicy: Never
```

---

## 7. Observability Validation Agent

### O que Valida
A propria stack de observabilidade: Prometheus coletando, Grafana acessivel,
Loki ingerindo, alertas configurados, dashboards existentes, metricas custom
sendo expostas.

### Como Valida

```yaml
observability_validation_checks:
  - check: prometheus-up
    description: "Prometheus esta rodando e acessivel"
    action: GET http://prometheus:9090/-/healthy
    expect: status 200

  - check: prometheus-targets
    description: "Todos os targets estao sendo scraped"
    action: GET http://prometheus:9090/api/v1/targets
    expect: all targets state == "up"

  - check: prometheus-scrape-errors
    description: "Sem erros de scrape"
    action: query prometheus_target_scrape_errors_total
    expect: rate == 0

  - check: grafana-up
    description: "Grafana esta rodando e acessivel"
    action: GET http://grafana:3000/api/health
    expect: status 200

  - check: grafana-datasources
    description: "Datasources do Grafana estao saudaveis"
    action: GET http://grafana:3000/api/datasources
    expect: all datasources healthy

  - check: loki-up
    description: "Loki esta rodando e ingerindo"
    action: GET http://loki:3100/ready
    expect: status 200

  - check: loki-ingestion
    description: "Loki esta recebendo logs"
    action: query sum(rate({namespace="velya-system"}[5m]))
    expect: value > 0

  - check: alertmanager-up
    description: "Alertmanager esta rodando"
    action: GET http://alertmanager:9093/-/healthy
    expect: status 200

  - check: alert-rules-loaded
    description: "Regras de alerta estao carregadas"
    action: GET http://prometheus:9090/api/v1/rules
    expect: groups count > 0

  - check: custom-metrics-exposed
    description: "Metricas custom do Velya sendo expostas"
    action: query velya_requests_total
    expect: series count > 0

  - check: recording-rules
    description: "Recording rules funcionando"
    action: query velya:request_duration:p99
    expect: has data
```

### Frequencia
- A cada 5 minutos

### Criterios Pass/Fail

| Criterio                      | Pass              | Fail                      |
|--------------------------------|-------------------|---------------------------|
| Prometheus up                 | Healthy           | Inacessivel               |
| Targets scraped               | Todos up          | Qualquer down             |
| Grafana up                    | Healthy           | Inacessivel               |
| Datasources                   | Todas ok          | Qualquer com erro         |
| Loki ingestion                | Recebendo logs    | Sem ingestao              |
| Alertmanager                  | Healthy           | Inacessivel               |
| Alert rules                   | Carregadas        | Sem regras                |
| Custom metrics                | Expostas          | Ausentes                  |

### CronJob YAML

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: observability-validation
  namespace: velya-autonomy
  labels:
    velya.io/validation: observability
    velya.io/tier: autonomy
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 180
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: obs-validator
              image: velya/autonomy-agent:latest
              command: ["node", "dist/validators/observability-validation.js"]
              env:
                - name: PROMETHEUS_URL
                  value: "http://prometheus.velya-monitoring.svc.cluster.local:9090"
                - name: GRAFANA_URL
                  value: "http://grafana.velya-monitoring.svc.cluster.local:3000"
                - name: LOKI_URL
                  value: "http://loki.velya-monitoring.svc.cluster.local:3100"
                - name: ALERTMANAGER_URL
                  value: "http://alertmanager.velya-monitoring.svc.cluster.local:9093"
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 200m
                  memory: 256Mi
          restartPolicy: Never
```

---

## Resumo de Todos os Validation Agents

| #  | Agent                    | Dominio            | Frequencia | Trigger         | Criticidade |
|----|--------------------------|--------------------|------------|-----------------|-------------|
| 1  | release-validation       | Deploys            | Event + 5m | Deploy          | Critica     |
| 2  | runtime-validation       | Runtime            | 5min       | Schedule        | Alta        |
| 3  | synthetic-validation     | Fluxos e2e         | 5min       | Schedule        | Critica     |
| 4  | dashboard-validation     | Dashboards         | 15min      | Schedule        | Alta        |
| 5  | mobile-flow-validation   | Mobile             | 10min      | Schedule        | Alta        |
| 6  | auth-validation          | Auth/RBAC          | 5min       | Schedule        | Critica     |
| 7  | observability-validation | Observabilidade    | 5min       | Schedule        | Critica     |

---

## Metricas dos Validation Agents

```yaml
metrics:
  - name: velya_validation_last_run_timestamp
    type: gauge
    labels: [validator]

  - name: velya_validation_duration_seconds
    type: histogram
    labels: [validator]

  - name: velya_validation_pass_total
    type: counter
    labels: [validator]

  - name: velya_validation_fail_total
    type: counter
    labels: [validator, check]

  - name: velya_validation_checks_total
    type: counter
    labels: [validator, check, result]

  - name: velya_validation_up
    type: gauge
    labels: [validator]
```
