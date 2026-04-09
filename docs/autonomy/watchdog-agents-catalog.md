# Catalogo de Watchdog Agents

> **Definicao**: Watchdog agents sao processos autonomos que observam continuamente
> um aspecto especifico da plataforma, alertam quando detectam anomalias e,
> quando seguro, executam remediacao automatica.

## Visao Geral

A plataforma Velya opera 8 watchdog agents independentes. Cada watchdog e
responsavel por um dominio especifico e opera de forma autonoma.

```
+-------------------------------------------------------------------+
|                      WATCHDOG AGENTS (8)                           |
+-------------------------------------------------------------------+
|                                                                     |
|  +------------------+  +------------------+  +------------------+   |
|  | site-watchdog    |  | flow-watchdog    |  | dashboard-       |   |
|  | (disp/TLS/DNS)   |  | (fluxos criticos)|  | watchdog         |   |
|  +------------------+  +------------------+  +------------------+   |
|                                                                     |
|  +------------------+  +------------------+  +------------------+   |
|  | no-data-watchdog |  | cert-watchdog    |  | agent-silence-   |   |
|  | (metricas/logs)  |  | (certificados)   |  | watchdog         |   |
|  +------------------+  +------------------+  +------------------+   |
|                                                                     |
|  +------------------+  +------------------+                         |
|  | queue-watchdog   |  | drift-watchdog   |                         |
|  | (filas/consumers)|  | (config drift)   |                         |
|  +------------------+  +------------------+                         |
+-------------------------------------------------------------------+
```

---

## 1. Site Watchdog

### O que Observa
Disponibilidade, status HTTP, latencia, certificados TLS, resolucao DNS
e headers de seguranca de todos os sites e APIs da plataforma.

### Especificacao

| Atributo              | Valor                                        |
|------------------------|----------------------------------------------|
| Frequencia             | 60 segundos                                  |
| Tipo                   | Continuous Loop                              |
| Prioridade             | Critica                                      |
| Remediacao permitida   | Nenhuma (apenas alerta)                      |
| Escalacao              | Apos 3 falhas consecutivas                   |

### Alvos

```yaml
site_watchdog_targets:
  - name: velya-web-app
    url: https://app.velya.local
    checks:
      - type: http_status
        expected: 200
      - type: latency
        warning_ms: 1000
        critical_ms: 3000
      - type: tls
        min_days_valid: 14
      - type: dns
        expected_records: ["app.velya.local"]
      - type: headers
        required:
          - Strict-Transport-Security
          - X-Content-Type-Options
          - X-Frame-Options

  - name: velya-api-gateway
    url: https://api.velya.local/health
    checks:
      - type: http_status
        expected: 200
      - type: latency
        warning_ms: 500
        critical_ms: 1500
      - type: tls
        min_days_valid: 14
      - type: response_body
        contains: '"status":"ok"'

  - name: velya-auth
    url: https://auth.velya.local/.well-known/openid-configuration
    checks:
      - type: http_status
        expected: 200
      - type: latency
        warning_ms: 500
        critical_ms: 1500
      - type: tls
        min_days_valid: 14

  - name: grafana
    url: https://grafana.velya.local/api/health
    checks:
      - type: http_status
        expected: 200
      - type: latency
        warning_ms: 2000
        critical_ms: 5000

  - name: argocd
    url: https://argocd.velya.local/healthz
    checks:
      - type: http_status
        expected: 200
```

### Alertas

| Condicao                          | Severidade | Canal                    |
|------------------------------------|------------|--------------------------|
| Site down (status != esperado)    | Critical   | #velya-autonomy-alerts   |
| Latencia alta (> warning)         | Warning    | #velya-autonomy-alerts   |
| Latencia critica (> critical)     | Critical   | #velya-autonomy-alerts   |
| TLS expirando < 14 dias          | Warning    | #velya-ops-escalation    |
| TLS expirando < 7 dias           | Critical   | #velya-ops-escalation    |
| DNS nao resolve                   | Critical   | #velya-autonomy-alerts   |
| Header de seguranca ausente       | Warning    | #velya-security-alerts   |

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: site-watchdog
  namespace: velya-autonomy
  labels:
    velya.io/watchdog: site
    velya.io/tier: autonomy
spec:
  replicas: 1
  selector:
    matchLabels:
      app: site-watchdog
  template:
    metadata:
      labels:
        app: site-watchdog
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      serviceAccountName: autonomy-runner
      containers:
        - name: site-watchdog
          image: velya/autonomy-agent:latest
          command: ["node", "dist/watchdogs/site-watchdog.js"]
          env:
            - name: CHECK_INTERVAL_MS
              value: "60000"
            - name: ALERT_CHANNEL
              valueFrom:
                configMapKeyRef:
                  name: autonomy-config
                  key: ALERT_CHANNEL
          ports:
            - containerPort: 9090
              name: metrics
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 200m
              memory: 256Mi
          livenessProbe:
            httpGet:
              path: /healthz
              port: 9090
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 9090
            initialDelaySeconds: 5
            periodSeconds: 10
```

---

## 2. Flow Watchdog

### O que Observa
Fluxos criticos do sistema — login, sessao, jornada do paciente, medicacao,
handoff entre profissionais, auditoria e fluxos mobile.

### Especificacao

| Atributo              | Valor                                        |
|------------------------|----------------------------------------------|
| Frequencia             | 5 minutos                                    |
| Tipo                   | Scheduled Check (synthetic monitoring)       |
| Prioridade             | Critica                                      |
| Remediacao permitida   | Nenhuma (apenas alerta)                      |
| Escalacao              | Imediata para fluxos criticos                |

### Fluxos Monitorados

```yaml
flow_watchdog_targets:
  - name: login-flow
    description: "Login completo com credenciais validas"
    critical: true
    steps:
      - action: POST /auth/login
        body: { username: synthetic-user, password: "${SYNTHETIC_PASSWORD}" }
        expect: { status: 200, body_contains: "access_token" }
      - action: GET /auth/me
        headers: { Authorization: "Bearer ${token}" }
        expect: { status: 200 }

  - name: patient-journey-flow
    description: "Cadastro e consulta de paciente"
    critical: true
    steps:
      - action: POST /patients
        expect: { status: 201 }
      - action: GET /patients/${id}
        expect: { status: 200, body_matches: "patient_schema" }
      - action: DELETE /patients/${id}
        expect: { status: 204 }

  - name: medication-flow
    description: "Prescricao e consulta de medicacao"
    critical: true
    steps:
      - action: POST /medications
        expect: { status: 201 }
      - action: GET /medications/${id}
        expect: { status: 200 }

  - name: handoff-flow
    description: "Transferencia de responsabilidade entre profissionais"
    critical: true
    steps:
      - action: POST /handoffs
        expect: { status: 201 }
      - action: GET /handoffs/${id}/status
        expect: { status: 200, body_contains: "pending" }

  - name: audit-flow
    description: "Eventos de auditoria sendo registrados"
    critical: true
    steps:
      - action: POST /patients
        expect: { status: 201 }
      - action: GET /audit/events?resource=patients&resourceId=${id}
        expect: { status: 200, body_contains: "CREATE" }

  - name: mobile-session-flow
    description: "Sessao mobile completa"
    critical: false
    steps:
      - action: POST /auth/mobile/login
        expect: { status: 200 }
      - action: GET /mobile/dashboard
        expect: { status: 200 }
```

### Implementacao

```typescript
interface FlowStep {
  action: string;
  method: string;
  path: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  expect: {
    status: number;
    bodyContains?: string;
    bodyMatches?: string;
    maxLatencyMs?: number;
  };
  extractVars?: Record<string, string>; // jsonpath -> var name
}

interface FlowResult {
  name: string;
  status: 'pass' | 'fail' | 'error';
  steps: StepResult[];
  totalDurationMs: number;
  failedStep?: string;
  error?: string;
}

async function executeFlow(flow: FlowDefinition): Promise<FlowResult> {
  const vars: Record<string, string> = {};
  const stepResults: StepResult[] = [];
  const start = Date.now();

  for (const step of flow.steps) {
    const resolvedPath = resolveVars(step.path, vars);
    const resolvedBody = resolveVars(JSON.stringify(step.body ?? {}), vars);

    try {
      const response = await fetch(resolvedPath, {
        method: step.method,
        body: step.method !== 'GET' ? resolvedBody : undefined,
        headers: { ...step.headers, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(step.expect.maxLatencyMs ?? 10000),
      });

      if (response.status !== step.expect.status) {
        return {
          name: flow.name,
          status: 'fail',
          steps: stepResults,
          totalDurationMs: Date.now() - start,
          failedStep: step.action,
          error: `Expected ${step.expect.status}, got ${response.status}`,
        };
      }

      // Extrair variaveis para proximos steps
      if (step.extractVars) {
        const body = await response.json();
        for (const [path, varName] of Object.entries(step.extractVars)) {
          vars[varName] = jsonPath(body, path);
        }
      }

      stepResults.push({ step: step.action, status: 'pass', durationMs: 0 });
    } catch (error) {
      return {
        name: flow.name,
        status: 'error',
        steps: stepResults,
        totalDurationMs: Date.now() - start,
        failedStep: step.action,
        error: String(error),
      };
    }
  }

  return {
    name: flow.name,
    status: 'pass',
    steps: stepResults,
    totalDurationMs: Date.now() - start,
  };
}
```

---

## 3. Dashboard Watchdog

### O que Observa
Dashboards Grafana carregando corretamente, queries retornando dados,
variaveis funcionando e links validos.

### Especificacao

| Atributo              | Valor                                        |
|------------------------|----------------------------------------------|
| Frequencia             | 15 minutos                                   |
| Tipo                   | Scheduled Check                              |
| Prioridade             | Alta                                         |
| Remediacao permitida   | Nenhuma (apenas alerta)                      |
| Escalacao              | Apos 3 verificacoes consecutivas com falha   |

### Dashboards Monitorados

```yaml
dashboard_watchdog_targets:
  - uid: velya-overview
    name: "Velya Platform Overview"
    critical: true
    checks:
      - panels_with_data: true
      - no_error_panels: true
      - variables_populated: true

  - uid: velya-patient-metrics
    name: "Patient Service Metrics"
    critical: true
    checks:
      - panels_with_data: true
      - no_error_panels: true

  - uid: velya-auth-metrics
    name: "Auth Service Metrics"
    critical: true
    checks:
      - panels_with_data: true

  - uid: velya-medication-metrics
    name: "Medication Service Metrics"
    critical: false
    checks:
      - panels_with_data: true

  - uid: velya-infrastructure
    name: "Infrastructure Overview"
    critical: true
    checks:
      - panels_with_data: true
      - no_error_panels: true

  - uid: velya-autonomy
    name: "Autonomy Mechanism Health"
    critical: true
    checks:
      - panels_with_data: true
      - no_error_panels: true
```

---

## 4. No-Data Watchdog

### O que Observa
Fluxo de metricas, logs e eventos — detecta quando fontes de dados
param de enviar informacoes (falha silenciosa).

### Especificacao

| Atributo              | Valor                                        |
|------------------------|----------------------------------------------|
| Frequencia             | 5 minutos                                    |
| Tipo                   | Continuous Loop                              |
| Prioridade             | Critica                                      |
| Remediacao permitida   | Restart de exporters/collectors              |
| Escalacao              | Apos 15min sem dados em fonte critica        |

### Fontes Monitoradas

```yaml
no_data_watchdog_targets:
  - source: prometheus-scrape
    description: "Metricas Prometheus coletadas de servicos Velya"
    query: 'count(up{job=~"velya-.*"} == 1)'
    expected_min: 5
    no_data_threshold: 300s
    critical: true
    remediation: restart-prometheus-targets

  - source: loki-ingestion
    description: "Logs ingeridos pelo Loki"
    query: 'sum(rate({namespace="velya-system"} | __error__="" [5m]))'
    expected_min: 0.1
    no_data_threshold: 300s
    critical: true
    remediation: restart-log-collectors

  - source: nats-messages
    description: "Mensagens fluindo pelo NATS"
    query: 'rate(nats_server_msg_total[5m])'
    expected_min: 0
    no_data_threshold: 600s
    critical: false
    remediation: none

  - source: audit-events
    description: "Eventos de auditoria sendo registrados"
    query: 'rate(velya_audit_events_total[5m])'
    expected_min: 0
    no_data_threshold: 900s
    critical: true
    remediation: restart-audit-service

  - source: node-metrics
    description: "Metricas de nodes do cluster"
    query: 'count(node_cpu_seconds_total)'
    expected_min: 1
    no_data_threshold: 120s
    critical: true
    remediation: restart-node-exporter
```

### Alertas

| Condicao                           | Severidade | Acao                        |
|-------------------------------------|------------|-----------------------------|
| Prometheus sem metricas Velya      | Critical   | Restart targets + alerta   |
| Loki sem logs por 5min            | Critical   | Restart collectors + alerta|
| Audit events parados              | Critical   | Restart audit + alerta     |
| Node metrics ausentes             | Critical   | Restart node-exporter      |
| NATS sem mensagens por 10min      | Warning    | Alerta apenas              |

---

## 5. Cert Watchdog

### O que Observa
Validade de todos os certificados TLS da plataforma, alertando com antecedencia
e disparando renovacao automatica quando possivel.

### Especificacao

| Atributo              | Valor                                        |
|------------------------|----------------------------------------------|
| Frequencia             | 1 hora                                       |
| Tipo                   | Scheduled Check                              |
| Prioridade             | Alta                                         |
| Remediacao permitida   | Trigger de renovacao via cert-manager        |
| Escalacao              | Se renovacao falhar ou < 3 dias para expirar |

### Certificados Monitorados

```yaml
cert_watchdog_targets:
  - name: velya-web-tls
    namespace: velya-system
    secret: velya-web-tls
    renewal_threshold_days: 30
    warning_threshold_days: 14
    critical_threshold_days: 7
    auto_renew: true
    issuer: letsencrypt-prod

  - name: velya-api-tls
    namespace: velya-system
    secret: velya-api-tls
    renewal_threshold_days: 30
    warning_threshold_days: 14
    critical_threshold_days: 7
    auto_renew: true
    issuer: letsencrypt-prod

  - name: velya-auth-tls
    namespace: velya-system
    secret: velya-auth-tls
    renewal_threshold_days: 30
    warning_threshold_days: 14
    critical_threshold_days: 7
    auto_renew: true
    issuer: letsencrypt-prod

  - name: grafana-tls
    namespace: velya-monitoring
    secret: grafana-tls
    renewal_threshold_days: 30
    warning_threshold_days: 14
    critical_threshold_days: 7
    auto_renew: true
    issuer: letsencrypt-prod

  - name: internal-ca
    namespace: velya-pki
    secret: internal-ca-cert
    renewal_threshold_days: 90
    warning_threshold_days: 60
    critical_threshold_days: 30
    auto_renew: false
    issuer: self-signed
```

### Implementacao

```typescript
interface CertCheck {
  name: string;
  namespace: string;
  secret: string;
  renewalThresholdDays: number;
  warningThresholdDays: number;
  criticalThresholdDays: number;
  autoRenew: boolean;
  issuer: string;
}

async function checkCertificate(cert: CertCheck): Promise<CertResult> {
  const secret = await k8sClient.readNamespacedSecret(cert.secret, cert.namespace);
  const certPem = Buffer.from(secret.data['tls.crt'], 'base64').toString();
  const parsed = parseCertificate(certPem);

  const daysUntilExpiry = Math.floor(
    (parsed.notAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry <= cert.criticalThresholdDays) {
    if (cert.autoRenew) {
      await triggerCertRenewal(cert);
    }
    return { name: cert.name, status: 'critical', daysUntilExpiry, action: 'renew-triggered' };
  }

  if (daysUntilExpiry <= cert.warningThresholdDays) {
    return { name: cert.name, status: 'warning', daysUntilExpiry, action: 'alert' };
  }

  if (daysUntilExpiry <= cert.renewalThresholdDays && cert.autoRenew) {
    await triggerCertRenewal(cert);
    return { name: cert.name, status: 'renewing', daysUntilExpiry, action: 'renew-triggered' };
  }

  return { name: cert.name, status: 'ok', daysUntilExpiry, action: 'none' };
}
```

---

## 6. Agent Silence Watchdog

### O que Observa
Atividade de todos os agents autonomos da plataforma. Detecta quando
um agent para de emitir heartbeats ou produzir resultados.

### Especificacao

| Atributo              | Valor                                        |
|------------------------|----------------------------------------------|
| Frequencia             | 2 minutos                                    |
| Tipo                   | Continuous Loop                              |
| Prioridade             | Critica                                      |
| Remediacao permitida   | Restart do agent silencioso                  |
| Escalacao              | Se restart nao resolver em 10min             |

### Agents Monitorados

```yaml
agent_silence_targets:
  - agent: site-watchdog
    expected_interval: 60s
    silence_threshold: 180s
    auto_restart: true
    critical: true

  - agent: flow-watchdog
    expected_interval: 300s
    silence_threshold: 900s
    auto_restart: true
    critical: true

  - agent: dashboard-watchdog
    expected_interval: 900s
    silence_threshold: 2700s
    auto_restart: true
    critical: false

  - agent: no-data-watchdog
    expected_interval: 300s
    silence_threshold: 900s
    auto_restart: true
    critical: true

  - agent: cert-watchdog
    expected_interval: 3600s
    silence_threshold: 7200s
    auto_restart: true
    critical: false

  - agent: queue-watchdog
    expected_interval: 30s
    silence_threshold: 120s
    auto_restart: true
    critical: true

  - agent: drift-watchdog
    expected_interval: 300s
    silence_threshold: 900s
    auto_restart: true
    critical: true

  # Meta: monitora a si mesmo via metricas Prometheus
  - agent: agent-silence-watchdog
    expected_interval: 120s
    silence_threshold: 360s
    auto_restart: false  # Nao pode reiniciar a si mesmo
    critical: true
    escalation: immediate
```

### Alertas

| Condicao                             | Severidade | Acao                         |
|---------------------------------------|------------|------------------------------|
| Agent critico silencioso > threshold | Critical   | Auto-restart + alerta       |
| Agent nao-critico silencioso         | Warning    | Auto-restart + log          |
| Restart falhou                       | Critical   | Escalacao imediata          |
| agent-silence-watchdog silencioso    | Critical   | Escalacao imediata (meta)   |

---

## 7. Queue Watchdog

### O que Observa
Profundidade das filas de mensagens, numero de consumers ativos,
taxa de processamento e mensagens nao-processadas (dead letter).

### Especificacao

| Atributo              | Valor                                        |
|------------------------|----------------------------------------------|
| Frequencia             | 30 segundos                                  |
| Tipo                   | Continuous Loop                              |
| Prioridade             | Alta                                         |
| Remediacao permitida   | Scale out de consumers (bounded)             |
| Escalacao              | Se filas > critical por mais de 5min         |

### Filas Monitoradas

```yaml
queue_watchdog_targets:
  - queue: velya.patient.events
    warning_depth: 100
    critical_depth: 1000
    max_age_seconds: 300
    expected_consumers: 2
    auto_scale:
      enabled: true
      max_replicas: 5
      cooldown: 120s

  - queue: velya.medication.reminders
    warning_depth: 50
    critical_depth: 500
    max_age_seconds: 60
    expected_consumers: 2
    auto_scale:
      enabled: true
      max_replicas: 4
      cooldown: 60s

  - queue: velya.notifications.outbound
    warning_depth: 100
    critical_depth: 1000
    max_age_seconds: 120
    expected_consumers: 3
    auto_scale:
      enabled: true
      max_replicas: 6
      cooldown: 60s

  - queue: velya.audit.events
    warning_depth: 200
    critical_depth: 2000
    max_age_seconds: 600
    expected_consumers: 1
    auto_scale:
      enabled: false

  - queue: velya.sync.commands
    warning_depth: 50
    critical_depth: 500
    max_age_seconds: 300
    expected_consumers: 1
    auto_scale:
      enabled: false

  # Dead letter queues
  - queue: velya.dlq.patient
    warning_depth: 1
    critical_depth: 10
    expected_consumers: 0
    auto_scale:
      enabled: false
    alert_always: true

  - queue: velya.dlq.medication
    warning_depth: 1
    critical_depth: 5
    expected_consumers: 0
    auto_scale:
      enabled: false
    alert_always: true
```

---

## 8. Drift Watchdog

### O que Observa
Divergencia entre o estado declarado no Git (source of truth) e o estado
real no cluster Kubernetes. Detecta mudancas manuais nao autorizadas.

### Especificacao

| Atributo              | Valor                                        |
|------------------------|----------------------------------------------|
| Frequencia             | 5 minutos                                    |
| Tipo                   | Continuous Loop                              |
| Prioridade             | Alta                                         |
| Remediacao permitida   | GitOps reconcile (forcar sync)               |
| Escalacao              | Se drift persiste apos reconcile             |

### Recursos Monitorados

```yaml
drift_watchdog_targets:
  - resource_type: Deployment
    namespaces: [velya-system, velya-monitoring, velya-autonomy]
    check_fields:
      - spec.template.spec.containers[*].image
      - spec.replicas
      - spec.template.spec.containers[*].resources
    auto_reconcile: true

  - resource_type: ConfigMap
    namespaces: [velya-system, velya-autonomy]
    check_fields:
      - data
    auto_reconcile: true

  - resource_type: Service
    namespaces: [velya-system]
    check_fields:
      - spec.ports
      - spec.selector
    auto_reconcile: true

  - resource_type: NetworkPolicy
    namespaces: [velya-system, velya-monitoring]
    check_fields:
      - spec
    auto_reconcile: false  # Requer revisao manual

  - resource_type: ClusterRole
    check_fields:
      - rules
    auto_reconcile: false  # RBAC requer revisao

  - resource_type: ClusterRoleBinding
    check_fields:
      - subjects
      - roleRef
    auto_reconcile: false  # RBAC requer revisao
```

### Alertas

| Tipo de Drift                        | Severidade | Auto-Reconcile | Acao               |
|---------------------------------------|------------|----------------|---------------------|
| Image tag diferente                   | High       | Sim            | Force sync          |
| Replicas alteradas manualmente        | Medium     | Sim            | Force sync          |
| ConfigMap divergente                  | High       | Sim            | Force sync          |
| NetworkPolicy alterada               | Critical   | Nao            | Alerta + revisao    |
| RBAC divergente                       | Critical   | Nao            | Alerta + revisao    |
| Recurso nao-declarado no Git          | Warning    | Nao            | Alerta              |

### Implementacao

```typescript
interface DriftResult {
  resource: string;
  namespace: string;
  kind: string;
  driftType: 'modified' | 'missing' | 'extra';
  fields: DriftField[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoReconcile: boolean;
  detectedAt: Date;
}

interface DriftField {
  path: string;
  gitValue: unknown;
  clusterValue: unknown;
}

async function detectDrift(target: DriftTarget): Promise<DriftResult[]> {
  const gitResources = await getGitResources(target);
  const clusterResources = await getClusterResources(target);
  const results: DriftResult[] = [];

  for (const [key, gitResource] of gitResources) {
    const clusterResource = clusterResources.get(key);

    if (!clusterResource) {
      results.push({
        resource: key,
        namespace: target.namespace,
        kind: target.resourceType,
        driftType: 'missing',
        fields: [],
        severity: 'high',
        autoReconcile: target.autoReconcile,
        detectedAt: new Date(),
      });
      continue;
    }

    const driftFields = compareFields(gitResource, clusterResource, target.checkFields);
    if (driftFields.length > 0) {
      results.push({
        resource: key,
        namespace: target.namespace,
        kind: target.resourceType,
        driftType: 'modified',
        fields: driftFields,
        severity: determineSeverity(target, driftFields),
        autoReconcile: target.autoReconcile,
        detectedAt: new Date(),
      });
    }
  }

  // Detectar recursos extras (nao declarados no Git)
  for (const [key] of clusterResources) {
    if (!gitResources.has(key)) {
      results.push({
        resource: key,
        namespace: target.namespace,
        kind: target.resourceType,
        driftType: 'extra',
        fields: [],
        severity: 'medium',
        autoReconcile: false,
        detectedAt: new Date(),
      });
    }
  }

  return results;
}
```

---

## Resumo de Todos os Watchdogs

| #  | Watchdog               | Dominio          | Frequencia | Remediacao      | Prioridade |
|----|------------------------|------------------|------------|-----------------|------------|
| 1  | site-watchdog          | Disponibilidade  | 60s        | Nenhuma         | Critica    |
| 2  | flow-watchdog          | Fluxos criticos  | 5min       | Nenhuma         | Critica    |
| 3  | dashboard-watchdog     | Dashboards       | 15min      | Nenhuma         | Alta       |
| 4  | no-data-watchdog       | Dados/metricas   | 5min       | Restart exporter| Critica    |
| 5  | cert-watchdog          | Certificados     | 1h         | Trigger renewal | Alta       |
| 6  | agent-silence-watchdog | Agents           | 2min       | Restart agent   | Critica    |
| 7  | queue-watchdog         | Filas            | 30s        | Scale consumer  | Alta       |
| 8  | drift-watchdog         | Config drift     | 5min       | GitOps reconcile| Alta       |

---

## Metricas dos Watchdogs

```yaml
# Metricas expostas por cada watchdog
metrics:
  - name: velya_watchdog_last_check_timestamp
    type: gauge
    labels: [watchdog]

  - name: velya_watchdog_check_duration_seconds
    type: histogram
    labels: [watchdog]

  - name: velya_watchdog_findings_total
    type: counter
    labels: [watchdog, severity]

  - name: velya_watchdog_remediations_total
    type: counter
    labels: [watchdog, action, result]

  - name: velya_watchdog_alerts_total
    type: counter
    labels: [watchdog, severity]

  - name: velya_watchdog_up
    type: gauge
    labels: [watchdog]
    help: "1 se o watchdog esta rodando, 0 caso contrario"
```
