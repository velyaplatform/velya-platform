# Modelo de Monitoramento de Sites e Fluxos

> **Principio**: Todo site e fluxo critico deve ser monitorado continuamente
> com checagens sinteticas que simulam usuarios reais, detectando problemas
> antes que os usuarios os encontrem.

## Visao Geral

O monitoramento de sites e fluxos combina duas abordagens complementares:

1. **Site Monitoring**: Verifica disponibilidade, status, latencia, TLS, DNS e headers
2. **Flow Monitoring**: Executa fluxos sinteticos end-to-end simulando usuarios reais

```
+---------------------------+     +---------------------------+
| SITE MONITORING           |     | FLOW MONITORING           |
| (Infraestrutura)          |     | (Funcional)               |
+---------------------------+     +---------------------------+
| - HTTP Status             |     | - Login flow              |
| - Latencia                |     | - Patient journey         |
| - TLS/Certificate        |     | - Medication flow         |
| - DNS Resolution         |     | - Handoff flow            |
| - Security Headers       |     | - Audit flow              |
| - Response Body          |     | - Mobile flow             |
+---------------------------+     +---------------------------+
        |                                   |
        v                                   v
+---------------------------------------------------+
| ALERTAS + METRICAS (Prometheus/Grafana)            |
+---------------------------------------------------+
```

---

## Site Monitoring

### Sites e Endpoints Monitorados

```yaml
sites:
  # Aplicacoes Web
  - name: velya-web-app
    url: https://app.velya.local
    description: "Aplicacao web principal"
    critical: true
    checks:
      http_status:
        expected: 200
        timeout_ms: 10000
      latency:
        warning_ms: 2000
        critical_ms: 5000
      tls:
        check_expiry: true
        min_days_valid: 14
        check_chain: true
        check_hostname: true
      dns:
        check_resolution: true
        expected_type: A
      headers:
        required:
          - name: Strict-Transport-Security
            min_max_age: 31536000
          - name: X-Content-Type-Options
            expected: nosniff
          - name: X-Frame-Options
            expected: DENY
          - name: Content-Security-Policy
          - name: X-XSS-Protection
      response_body:
        not_contains: ["error", "exception", "500"]
        contains: ["velya"]

  # APIs
  - name: velya-api-gateway
    url: https://api.velya.local/health
    description: "API Gateway health endpoint"
    critical: true
    checks:
      http_status:
        expected: 200
        timeout_ms: 5000
      latency:
        warning_ms: 500
        critical_ms: 1500
      tls:
        check_expiry: true
        min_days_valid: 14
      response_body:
        json_path: "$.status"
        expected: "ok"

  - name: velya-api-docs
    url: https://api.velya.local/docs
    description: "Documentacao OpenAPI"
    critical: false
    checks:
      http_status:
        expected: 200
      latency:
        warning_ms: 3000

  - name: velya-auth-oidc
    url: https://auth.velya.local/.well-known/openid-configuration
    description: "OpenID Configuration endpoint"
    critical: true
    checks:
      http_status:
        expected: 200
        timeout_ms: 5000
      response_body:
        json_path: "$.issuer"
        expected: "https://auth.velya.local"

  - name: velya-auth-jwks
    url: https://auth.velya.local/.well-known/jwks.json
    description: "JWKS endpoint"
    critical: true
    checks:
      http_status:
        expected: 200
      response_body:
        json_path: "$.keys"
        min_length: 1

  # Servicos Internos
  - name: velya-patient-service
    url: http://velya-patient-service.velya-system.svc.cluster.local:8080/health
    description: "Patient service health"
    critical: true
    checks:
      http_status:
        expected: 200
      latency:
        warning_ms: 200
        critical_ms: 1000

  - name: velya-medication-service
    url: http://velya-medication-service.velya-system.svc.cluster.local:8080/health
    description: "Medication service health"
    critical: true
    checks:
      http_status:
        expected: 200

  - name: velya-notification-service
    url: http://velya-notification-service.velya-system.svc.cluster.local:8080/health
    description: "Notification service health"
    critical: false
    checks:
      http_status:
        expected: 200

  - name: velya-audit-service
    url: http://velya-audit-service.velya-system.svc.cluster.local:8080/health
    description: "Audit service health"
    critical: true
    checks:
      http_status:
        expected: 200

  # Ferramentas de Infraestrutura
  - name: grafana
    url: https://grafana.velya.local/api/health
    description: "Grafana health"
    critical: false
    checks:
      http_status:
        expected: 200
      response_body:
        json_path: "$.database"
        expected: "ok"

  - name: argocd
    url: https://argocd.velya.local/healthz
    description: "ArgoCD health"
    critical: false
    checks:
      http_status:
        expected: 200

  - name: prometheus
    url: http://prometheus.velya-monitoring.svc.cluster.local:9090/-/healthy
    description: "Prometheus health"
    critical: true
    checks:
      http_status:
        expected: 200
```

### Implementacao do Site Monitor

```typescript
interface SiteCheckResult {
  name: string;
  url: string;
  timestamp: Date;
  checks: {
    httpStatus: {
      status: number;
      expected: number;
      passed: boolean;
    };
    latency: {
      durationMs: number;
      warningMs: number;
      criticalMs: number;
      level: 'ok' | 'warning' | 'critical';
    };
    tls?: {
      valid: boolean;
      daysUntilExpiry: number;
      issuer: string;
      subject: string;
      chainValid: boolean;
      hostnameValid: boolean;
    };
    dns?: {
      resolved: boolean;
      responseTimeMs: number;
      addresses: string[];
    };
    headers?: {
      present: Record<string, boolean>;
      values: Record<string, string>;
      missing: string[];
    };
    responseBody?: {
      matched: boolean;
      details: string;
    };
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

async function checkSite(site: SiteConfig): Promise<SiteCheckResult> {
  const result: SiteCheckResult = {
    name: site.name,
    url: site.url,
    timestamp: new Date(),
    checks: {} as any,
    overall: 'healthy',
  };

  // DNS Check
  if (site.checks.dns) {
    const dnsStart = Date.now();
    try {
      const hostname = new URL(site.url).hostname;
      const addresses = await dns.resolve4(hostname);
      result.checks.dns = {
        resolved: true,
        responseTimeMs: Date.now() - dnsStart,
        addresses,
      };
    } catch (error) {
      result.checks.dns = { resolved: false, responseTimeMs: Date.now() - dnsStart, addresses: [] };
      result.overall = 'unhealthy';
    }
  }

  // HTTP + TLS + Latency + Headers + Body
  const httpStart = Date.now();
  try {
    const response = await fetch(site.url, {
      signal: AbortSignal.timeout(site.checks.http_status.timeout_ms),
      redirect: 'follow',
    });
    const latencyMs = Date.now() - httpStart;

    result.checks.httpStatus = {
      status: response.status,
      expected: site.checks.http_status.expected,
      passed: response.status === site.checks.http_status.expected,
    };

    result.checks.latency = {
      durationMs: latencyMs,
      warningMs: site.checks.latency?.warning_ms ?? 2000,
      criticalMs: site.checks.latency?.critical_ms ?? 5000,
      level: latencyMs > (site.checks.latency?.critical_ms ?? 5000) ? 'critical' :
             latencyMs > (site.checks.latency?.warning_ms ?? 2000) ? 'warning' : 'ok',
    };

    // Headers check
    if (site.checks.headers) {
      const missing: string[] = [];
      const present: Record<string, boolean> = {};
      const values: Record<string, string> = {};

      for (const header of site.checks.headers.required) {
        const value = response.headers.get(header.name);
        present[header.name] = !!value;
        if (value) {
          values[header.name] = value;
        } else {
          missing.push(header.name);
        }
      }

      result.checks.headers = { present, values, missing };
      if (missing.length > 0) {
        result.overall = result.overall === 'unhealthy' ? 'unhealthy' : 'degraded';
      }
    }

    // Response body check
    if (site.checks.response_body) {
      const body = await response.text();
      let matched = true;
      let details = '';

      if (site.checks.response_body.contains) {
        for (const term of site.checks.response_body.contains) {
          if (!body.includes(term)) {
            matched = false;
            details += `Missing: "${term}". `;
          }
        }
      }

      if (site.checks.response_body.not_contains) {
        for (const term of site.checks.response_body.not_contains) {
          if (body.includes(term)) {
            matched = false;
            details += `Unexpected: "${term}". `;
          }
        }
      }

      result.checks.responseBody = { matched, details };
    }

    if (!result.checks.httpStatus.passed) {
      result.overall = 'unhealthy';
    }

  } catch (error) {
    result.checks.httpStatus = {
      status: 0,
      expected: site.checks.http_status.expected,
      passed: false,
    };
    result.checks.latency = {
      durationMs: Date.now() - httpStart,
      warningMs: site.checks.latency?.warning_ms ?? 2000,
      criticalMs: site.checks.latency?.critical_ms ?? 5000,
      level: 'critical',
    };
    result.overall = 'unhealthy';
  }

  // Emitir metricas
  emitSiteMetrics(result);
  return result;
}
```

### CronJob YAML - Site Monitoring

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: site-monitor
  namespace: velya-autonomy
  labels:
    velya.io/monitor: site
    velya.io/tier: autonomy
spec:
  schedule: "* * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      activeDeadlineSeconds: 55
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: site-monitor
              image: velya/autonomy-agent:latest
              command: ["node", "dist/monitors/site-monitor.js"]
              env:
                - name: CONFIG_PATH
                  value: "/config/sites.yaml"
                - name: ALERT_CHANNEL
                  valueFrom:
                    configMapKeyRef:
                      name: autonomy-config
                      key: ALERT_CHANNEL
              volumeMounts:
                - name: site-config
                  mountPath: /config
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 200m
                  memory: 256Mi
          volumes:
            - name: site-config
              configMap:
                name: site-monitor-config
          restartPolicy: OnFailure
```

---

## Flow Monitoring

### Fluxos Monitorados

```yaml
flows:
  # Fluxo 1: Login Completo
  - name: login-flow
    description: "Login com credenciais validas e obtencao de sessao"
    critical: true
    frequency: 5m
    timeout: 30s
    steps:
      - name: login
        method: POST
        url: "${BASE_URL}/auth/login"
        body:
          username: "${SYNTHETIC_USER}"
          password: "${SYNTHETIC_PASSWORD}"
        expect:
          status: 200
          body:
            has_field: access_token
            has_field: refresh_token
        extract:
          access_token: "$.access_token"
          refresh_token: "$.refresh_token"

      - name: validate-session
        method: GET
        url: "${BASE_URL}/auth/me"
        headers:
          Authorization: "Bearer ${access_token}"
        expect:
          status: 200
          body:
            has_field: id
            has_field: roles

      - name: refresh-token
        method: POST
        url: "${BASE_URL}/auth/refresh"
        body:
          refresh_token: "${refresh_token}"
        expect:
          status: 200
          body:
            has_field: access_token

  # Fluxo 2: Jornada do Paciente
  - name: patient-journey-flow
    description: "Cadastro, consulta e atualizacao de paciente"
    critical: true
    frequency: 5m
    timeout: 60s
    steps:
      - name: authenticate
        method: POST
        url: "${BASE_URL}/auth/login"
        body:
          username: "${SYNTHETIC_USER}"
          password: "${SYNTHETIC_PASSWORD}"
        extract:
          token: "$.access_token"

      - name: create-patient
        method: POST
        url: "${BASE_URL}/patients"
        headers:
          Authorization: "Bearer ${token}"
        body:
          name: "Paciente Sintetico"
          cpf: "00000000000"
          birthDate: "1990-01-01"
          gender: "M"
        expect:
          status: 201
          body:
            has_field: id
        extract:
          patient_id: "$.id"

      - name: get-patient
        method: GET
        url: "${BASE_URL}/patients/${patient_id}"
        headers:
          Authorization: "Bearer ${token}"
        expect:
          status: 200
          body:
            field_equals:
              name: "Paciente Sintetico"

      - name: update-patient
        method: PATCH
        url: "${BASE_URL}/patients/${patient_id}"
        headers:
          Authorization: "Bearer ${token}"
        body:
          phone: "+5511999999999"
        expect:
          status: 200

      - name: delete-patient
        method: DELETE
        url: "${BASE_URL}/patients/${patient_id}"
        headers:
          Authorization: "Bearer ${token}"
        expect:
          status: 204

  # Fluxo 3: Medicacao
  - name: medication-flow
    description: "Prescricao, consulta e administracao de medicacao"
    critical: true
    frequency: 5m
    timeout: 60s
    steps:
      - name: authenticate
        method: POST
        url: "${BASE_URL}/auth/login"
        body:
          username: "${SYNTHETIC_PROVIDER_USER}"
          password: "${SYNTHETIC_PROVIDER_PASSWORD}"
        extract:
          token: "$.access_token"

      - name: create-prescription
        method: POST
        url: "${BASE_URL}/medications/prescriptions"
        headers:
          Authorization: "Bearer ${token}"
        body:
          patientId: "${SYNTHETIC_PATIENT_ID}"
          medication: "Paracetamol 500mg"
          dosage: "1 comprimido a cada 8h"
          duration: "5 dias"
        expect:
          status: 201
        extract:
          prescription_id: "$.id"

      - name: get-prescription
        method: GET
        url: "${BASE_URL}/medications/prescriptions/${prescription_id}"
        headers:
          Authorization: "Bearer ${token}"
        expect:
          status: 200

      - name: record-administration
        method: POST
        url: "${BASE_URL}/medications/administrations"
        headers:
          Authorization: "Bearer ${token}"
        body:
          prescriptionId: "${prescription_id}"
          administeredAt: "${NOW}"
          administeredBy: "${SYNTHETIC_PROVIDER_USER}"
        expect:
          status: 201

      - name: cleanup-prescription
        method: DELETE
        url: "${BASE_URL}/medications/prescriptions/${prescription_id}"
        headers:
          Authorization: "Bearer ${token}"
        expect:
          status: 204

  # Fluxo 4: Handoff
  - name: handoff-flow
    description: "Transferencia de responsabilidade entre profissionais"
    critical: true
    frequency: 10m
    timeout: 60s
    steps:
      - name: authenticate-provider-a
        method: POST
        url: "${BASE_URL}/auth/login"
        body:
          username: "${SYNTHETIC_PROVIDER_A}"
          password: "${SYNTHETIC_PASSWORD}"
        extract:
          token_a: "$.access_token"

      - name: create-handoff
        method: POST
        url: "${BASE_URL}/handoffs"
        headers:
          Authorization: "Bearer ${token_a}"
        body:
          patientId: "${SYNTHETIC_PATIENT_ID}"
          toProvider: "${SYNTHETIC_PROVIDER_B}"
          notes: "Handoff sintetico para validacao"
          urgency: "routine"
        expect:
          status: 201
        extract:
          handoff_id: "$.id"

      - name: verify-handoff-pending
        method: GET
        url: "${BASE_URL}/handoffs/${handoff_id}"
        headers:
          Authorization: "Bearer ${token_a}"
        expect:
          status: 200
          body:
            field_equals:
              status: "pending"

      - name: authenticate-provider-b
        method: POST
        url: "${BASE_URL}/auth/login"
        body:
          username: "${SYNTHETIC_PROVIDER_B}"
          password: "${SYNTHETIC_PASSWORD}"
        extract:
          token_b: "$.access_token"

      - name: accept-handoff
        method: POST
        url: "${BASE_URL}/handoffs/${handoff_id}/accept"
        headers:
          Authorization: "Bearer ${token_b}"
        expect:
          status: 200
          body:
            field_equals:
              status: "accepted"

  # Fluxo 5: Auditoria
  - name: audit-flow
    description: "Verificar que acoes geram registros de auditoria"
    critical: true
    frequency: 10m
    timeout: 30s
    steps:
      - name: authenticate
        method: POST
        url: "${BASE_URL}/auth/login"
        body:
          username: "${SYNTHETIC_USER}"
          password: "${SYNTHETIC_PASSWORD}"
        extract:
          token: "$.access_token"

      - name: trigger-auditable-action
        method: POST
        url: "${BASE_URL}/patients"
        headers:
          Authorization: "Bearer ${token}"
        body:
          name: "Audit Test Patient"
          cpf: "00000000001"
          birthDate: "1985-06-15"
        expect:
          status: 201
        extract:
          patient_id: "$.id"

      - name: verify-audit-event
        method: GET
        url: "${BASE_URL}/audit/events?resource=patient&resourceId=${patient_id}&action=CREATE"
        headers:
          Authorization: "Bearer ${token}"
        expect:
          status: 200
          body:
            min_length: 1

      - name: cleanup
        method: DELETE
        url: "${BASE_URL}/patients/${patient_id}"
        headers:
          Authorization: "Bearer ${token}"

  # Fluxo 6: Mobile
  - name: mobile-flow
    description: "Fluxo mobile: login, dashboard, busca paciente"
    critical: false
    frequency: 10m
    timeout: 45s
    steps:
      - name: mobile-login
        method: POST
        url: "${BASE_URL}/auth/mobile/login"
        body:
          username: "${SYNTHETIC_MOBILE_USER}"
          password: "${SYNTHETIC_PASSWORD}"
          deviceId: "synthetic-device-001"
        expect:
          status: 200
        extract:
          token: "$.access_token"

      - name: mobile-dashboard
        method: GET
        url: "${BASE_URL}/mobile/dashboard"
        headers:
          Authorization: "Bearer ${token}"
        expect:
          status: 200
          body:
            has_field: summary
            has_field: alerts
            has_field: schedule

      - name: mobile-patient-search
        method: GET
        url: "${BASE_URL}/mobile/patients/search?q=sintetico"
        headers:
          Authorization: "Bearer ${token}"
        expect:
          status: 200
```

### Synthetic Monitoring com k6

```javascript
// k6-flow-monitor.js
// Script k6 para monitoramento sintetico completo

import http from 'k6/http';
import { check, group, sleep, fail } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Custom metrics
const flowSuccess = new Counter('velya_flow_success_total');
const flowFailure = new Counter('velya_flow_failure_total');
const flowDuration = new Trend('velya_flow_duration_ms');
const flowSuccessRate = new Rate('velya_flow_success_rate');

export const options = {
  scenarios: {
    continuous_monitoring: {
      executor: 'constant-vus',
      vus: 1,
      duration: '4m30s',
    },
  },
  thresholds: {
    'velya_flow_success_rate': ['rate>0.95'],
    'velya_flow_duration_ms': ['p(95)<10000'],
    'http_req_failed': ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api.velya.local';

export default function () {
  // Login Flow
  group('login-flow', () => {
    const start = Date.now();
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      username: __ENV.SYNTHETIC_USER,
      password: __ENV.SYNTHETIC_PASSWORD,
    }), { headers: { 'Content-Type': 'application/json' } });

    const loginOk = check(loginRes, {
      'login: status 200': (r) => r.status === 200,
      'login: has token': (r) => {
        try { return !!JSON.parse(r.body).access_token; }
        catch { return false; }
      },
    });

    if (loginOk) {
      flowSuccess.add(1, { flow: 'login' });
      flowSuccessRate.add(1);
    } else {
      flowFailure.add(1, { flow: 'login' });
      flowSuccessRate.add(0);
    }
    flowDuration.add(Date.now() - start, { flow: 'login' });
  });

  sleep(2);

  // Patient Journey Flow
  group('patient-journey-flow', () => {
    const start = Date.now();
    // ... (implementacao similar ao login flow)
    flowDuration.add(Date.now() - start, { flow: 'patient-journey' });
  });

  sleep(2);
}
```

---

## Metricas

```yaml
# Prometheus metrics expostas pelo site/flow monitor
metrics:
  # Site monitoring
  - name: velya_site_check_status
    type: gauge
    labels: [site, check_type]
    help: "1=pass, 0=fail"

  - name: velya_site_latency_seconds
    type: histogram
    labels: [site]
    buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10]

  - name: velya_site_tls_days_remaining
    type: gauge
    labels: [site]

  - name: velya_site_dns_resolution_seconds
    type: histogram
    labels: [site]

  # Flow monitoring
  - name: velya_flow_status
    type: gauge
    labels: [flow]
    help: "1=pass, 0=fail"

  - name: velya_flow_duration_seconds
    type: histogram
    labels: [flow]

  - name: velya_flow_step_duration_seconds
    type: histogram
    labels: [flow, step]

  - name: velya_flow_step_status
    type: gauge
    labels: [flow, step]
```

### Alertas

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: site-flow-monitoring-alerts
  namespace: velya-autonomy
spec:
  groups:
    - name: site-monitoring
      rules:
        - alert: SiteDown
          expr: velya_site_check_status{check_type="http_status"} == 0
          for: 2m
          labels:
            severity: critical
          annotations:
            summary: "Site {{ $labels.site }} esta fora do ar"

        - alert: SiteHighLatency
          expr: velya_site_latency_seconds > 5
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Site {{ $labels.site }} com latencia alta: {{ $value }}s"

        - alert: TLSExpiringSoon
          expr: velya_site_tls_days_remaining < 14
          labels:
            severity: warning
          annotations:
            summary: "TLS de {{ $labels.site }} expira em {{ $value }} dias"

        - alert: TLSExpiringCritical
          expr: velya_site_tls_days_remaining < 7
          labels:
            severity: critical
          annotations:
            summary: "URGENTE: TLS de {{ $labels.site }} expira em {{ $value }} dias"

    - name: flow-monitoring
      rules:
        - alert: CriticalFlowFailing
          expr: velya_flow_status == 0
          for: 2m
          labels:
            severity: critical
          annotations:
            summary: "Fluxo critico {{ $labels.flow }} falhando"

        - alert: FlowHighLatency
          expr: velya_flow_duration_seconds > 30
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Fluxo {{ $labels.flow }} com latencia alta: {{ $value }}s"

        - alert: FlowStepFailing
          expr: velya_flow_step_status == 0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Step {{ $labels.step }} do fluxo {{ $labels.flow }} falhando"
```

---

## Resumo

| Tipo       | Alvo                   | Frequencia | Criticidade | Checagens                      |
|------------|------------------------|------------|-------------|--------------------------------|
| Site       | velya-web-app          | 1min       | Critica     | HTTP, latencia, TLS, DNS, hdrs |
| Site       | velya-api-gateway      | 1min       | Critica     | HTTP, latencia, TLS, body      |
| Site       | velya-auth-oidc        | 1min       | Critica     | HTTP, body                     |
| Site       | velya-patient-service  | 1min       | Critica     | HTTP, latencia                 |
| Site       | grafana                | 1min       | Baixa       | HTTP, body                     |
| Flow       | login-flow             | 5min       | Critica     | Auth, session, refresh         |
| Flow       | patient-journey-flow   | 5min       | Critica     | CRUD completo                  |
| Flow       | medication-flow        | 5min       | Critica     | Prescricao + administracao     |
| Flow       | handoff-flow           | 10min      | Critica     | Handoff entre profissionais    |
| Flow       | audit-flow             | 10min      | Critica     | Acao -> registro auditoria     |
| Flow       | mobile-flow            | 10min      | Baixa       | Login, dashboard, busca        |
