# Catalogo de Control Loops

> **Definicao**: Control loops sao processos que rodam continuamente em intervalos curtos,
> comparando o estado desejado com o estado real e tomando acao quando detectam divergencia.

## Visao Geral

A plataforma Velya opera 7 control loops fundamentais que garantem deteccao rapida
de anomalias sem depender de observacao humana.

```
Estado Desejado (spec)
       |
       v
  +---------+
  | Compare |<----+
  +---------+     |
       |          |
       v          |
  Divergencia?    |
       |          |
  +----+----+     |
  |         |     |
  Sim      Nao    |
  |         |     |
  v         v     |
 Acao     Sleep   |
  |         |     |
  +----+----+     |
       |          |
       v          |
  Wait interval   |
       |          |
       +----------+
```

---

## 1. Heartbeat Loop

### Proposito
Detecta servicos que pararam de responder. Cada servico critico deve emitir
um heartbeat; a ausencia dentro da janela indica falha.

### Especificacao

| Atributo          | Valor                                    |
|--------------------|------------------------------------------|
| Intervalo          | 30 segundos                              |
| O que monitora     | Liveness de todos os servicos criticos   |
| Threshold          | 2 heartbeats consecutivos ausentes       |
| Acao               | Alerta + tentativa de restart            |
| Escalacao          | Apos 3 restarts falhados                 |
| Owner              | platform-team                            |

### Servicos Monitorados

```yaml
heartbeat_targets:
  - name: velya-api
    endpoint: /healthz
    expected_status: 200
    critical: true

  - name: velya-auth
    endpoint: /healthz
    expected_status: 200
    critical: true

  - name: velya-patient-service
    endpoint: /healthz
    expected_status: 200
    critical: true

  - name: velya-medication-service
    endpoint: /healthz
    expected_status: 200
    critical: true

  - name: velya-notification-service
    endpoint: /healthz
    expected_status: 200
    critical: false

  - name: velya-audit-service
    endpoint: /healthz
    expected_status: 200
    critical: true

  - name: velya-mobile-bff
    endpoint: /healthz
    expected_status: 200
    critical: true

  - name: velya-dashboard-bff
    endpoint: /healthz
    expected_status: 200
    critical: false
```

### CronJob YAML

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: heartbeat-loop
  namespace: velya-autonomy
  labels:
    velya.io/control-loop: heartbeat
    velya.io/tier: autonomy
spec:
  schedule: "*/1 * * * *"  # A cada minuto (2 ciclos de 30s internos)
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      activeDeadlineSeconds: 55
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: heartbeat-checker
              image: velya/autonomy-agent:latest
              command: ["node", "dist/loops/heartbeat.js"]
              env:
                - name: INTERVAL_MS
                  value: "30000"
                - name: CYCLES_PER_RUN
                  value: "2"
                - name: ALERT_CHANNEL
                  valueFrom:
                    configMapKeyRef:
                      name: autonomy-config
                      key: ALERT_CHANNEL
              resources:
                requests:
                  cpu: 50m
                  memory: 64Mi
                limits:
                  cpu: 100m
                  memory: 128Mi
          restartPolicy: OnFailure
```

### Implementacao

```typescript
interface HeartbeatConfig {
  targets: HeartbeatTarget[];
  intervalMs: number;
  consecutiveFailuresThreshold: number;
}

interface HeartbeatTarget {
  name: string;
  endpoint: string;
  expectedStatus: number;
  critical: boolean;
}

interface HeartbeatResult {
  target: string;
  status: 'healthy' | 'unhealthy' | 'unreachable';
  responseTimeMs: number;
  consecutiveFailures: number;
  lastSuccess: Date;
  timestamp: Date;
}

async function heartbeatLoop(config: HeartbeatConfig): Promise<void> {
  const state = new Map<string, number>(); // target -> consecutive failures

  for (const target of config.targets) {
    const failures = state.get(target.name) ?? 0;

    try {
      const start = Date.now();
      const response = await fetch(
        `http://${target.name}.velya-system.svc.cluster.local${target.endpoint}`,
        { signal: AbortSignal.timeout(5000) }
      );
      const responseTimeMs = Date.now() - start;

      if (response.status === target.expectedStatus) {
        state.set(target.name, 0);
        emitMetric('heartbeat_success', { target: target.name, responseTimeMs });
      } else {
        state.set(target.name, failures + 1);
        emitMetric('heartbeat_unexpected_status', {
          target: target.name,
          expected: target.expectedStatus,
          actual: response.status,
        });
      }
    } catch (error) {
      state.set(target.name, failures + 1);
      emitMetric('heartbeat_failure', { target: target.name, error: String(error) });
    }

    const currentFailures = state.get(target.name) ?? 0;
    if (currentFailures >= config.consecutiveFailuresThreshold) {
      await triggerAlert({
        severity: target.critical ? 'critical' : 'warning',
        source: 'heartbeat-loop',
        target: target.name,
        message: `${target.name} falhou ${currentFailures} heartbeats consecutivos`,
        action: target.critical ? 'restart-pod' : 'alert-only',
      });
    }
  }
}
```

---

## 2. Stale State Detection Loop

### Proposito
Detecta quando o estado de um recurso nao e atualizado dentro da janela esperada,
indicando possivel falha silenciosa em processos de sincronizacao.

### Especificacao

| Atributo          | Valor                                         |
|--------------------|-----------------------------------------------|
| Intervalo          | 1 minuto                                      |
| O que monitora     | Timestamps de ultima atualizacao de estado     |
| Threshold          | Estado sem atualizacao por mais de 2x o ciclo  |
| Acao               | Alerta + forcar re-sync                        |
| Escalacao          | Se re-sync nao resolver em 5min                |
| Owner              | platform-team                                  |

### Recursos Monitorados

```yaml
stale_state_targets:
  - resource: agent-sync-status
    expected_update_interval: 60s
    stale_threshold: 120s
    location: state/workspaces/*/agent-sync-status.json

  - resource: gitops-sync-status
    expected_update_interval: 300s
    stale_threshold: 600s
    source: argocd

  - resource: patient-cache
    expected_update_interval: 30s
    stale_threshold: 90s
    source: redis

  - resource: medication-schedule
    expected_update_interval: 60s
    stale_threshold: 180s
    source: postgres

  - resource: audit-log-stream
    expected_update_interval: 10s
    stale_threshold: 60s
    source: nats

  - resource: notification-queue
    expected_update_interval: 30s
    stale_threshold: 120s
    source: nats
```

### CronJob YAML

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: stale-state-detection
  namespace: velya-autonomy
  labels:
    velya.io/control-loop: stale-state
    velya.io/tier: autonomy
spec:
  schedule: "* * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      activeDeadlineSeconds: 55
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: stale-state-checker
              image: velya/autonomy-agent:latest
              command: ["node", "dist/loops/stale-state.js"]
              env:
                - name: CHECK_INTERVAL_MS
                  value: "60000"
              resources:
                requests:
                  cpu: 50m
                  memory: 64Mi
                limits:
                  cpu: 100m
                  memory: 128Mi
          restartPolicy: OnFailure
```

### Implementacao

```typescript
interface StaleStateTarget {
  resource: string;
  expectedUpdateInterval: number;  // ms
  staleThreshold: number;          // ms
  source: string;
  getLastUpdated: () => Promise<Date>;
}

async function staleStateLoop(targets: StaleStateTarget[]): Promise<void> {
  for (const target of targets) {
    const lastUpdated = await target.getLastUpdated();
    const age = Date.now() - lastUpdated.getTime();

    emitMetric('state_age_seconds', {
      resource: target.resource,
      ageSeconds: age / 1000,
    });

    if (age > target.staleThreshold) {
      await triggerAlert({
        severity: 'warning',
        source: 'stale-state-detection',
        target: target.resource,
        message: `${target.resource} esta stale (${Math.round(age / 1000)}s sem atualizacao, threshold: ${target.staleThreshold / 1000}s)`,
        action: 'force-resync',
        metadata: { source: target.source, lastUpdated: lastUpdated.toISOString() },
      });

      await forceResync(target);
    }
  }
}
```

---

## 3. Queue Depth Loop

### Proposito
Monitora profundidade das filas de mensagens. Filas acumulando indicam consumidores
lentos, travados ou insuficientes.

### Especificacao

| Atributo          | Valor                                        |
|--------------------|----------------------------------------------|
| Intervalo          | 30 segundos                                  |
| O que monitora     | Profundidade de filas NATS/Redis              |
| Threshold          | > 100 mensagens ou crescendo por 2min        |
| Acao               | Alerta + scale consumer se possivel          |
| Escalacao          | Se profundidade > 1000 ou crescendo por 5min |
| Owner              | platform-team                                |

### Filas Monitoradas

```yaml
queue_targets:
  - queue: velya.patient.events
    warning_depth: 100
    critical_depth: 1000
    expected_consumer_count: 2
    auto_scale: true
    max_consumers: 5

  - queue: velya.medication.reminders
    warning_depth: 50
    critical_depth: 500
    expected_consumer_count: 2
    auto_scale: true
    max_consumers: 4

  - queue: velya.audit.events
    warning_depth: 200
    critical_depth: 2000
    expected_consumer_count: 1
    auto_scale: false

  - queue: velya.notifications.outbound
    warning_depth: 100
    critical_depth: 1000
    expected_consumer_count: 3
    auto_scale: true
    max_consumers: 6

  - queue: velya.sync.commands
    warning_depth: 50
    critical_depth: 500
    expected_consumer_count: 1
    auto_scale: false
```

### CronJob YAML

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: queue-depth-loop
  namespace: velya-autonomy
  labels:
    velya.io/control-loop: queue-depth
    velya.io/tier: autonomy
spec:
  schedule: "*/1 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 55
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: queue-depth-checker
              image: velya/autonomy-agent:latest
              command: ["node", "dist/loops/queue-depth.js"]
              env:
                - name: INTERVAL_MS
                  value: "30000"
                - name: CYCLES_PER_RUN
                  value: "2"
                - name: NATS_URL
                  value: "nats://nats.velya-system.svc.cluster.local:4222"
              resources:
                requests:
                  cpu: 50m
                  memory: 64Mi
                limits:
                  cpu: 100m
                  memory: 128Mi
          restartPolicy: OnFailure
```

---

## 4. Endpoint Probe Loop

### Proposito
Verifica disponibilidade e performance de endpoints externos e internos,
incluindo latencia, status code, e TLS.

### Especificacao

| Atributo          | Valor                                        |
|--------------------|----------------------------------------------|
| Intervalo          | 1 minuto                                     |
| O que monitora     | Disponibilidade, status, latencia de endpoints|
| Threshold          | Status != esperado ou latencia > 2s          |
| Acao               | Alerta + registrar degradacao                |
| Escalacao          | Se endpoint critico down por > 3min          |
| Owner              | platform-team                                |

### Endpoints Monitorados

```yaml
endpoint_probe_targets:
  # APIs internas
  - name: velya-api-gateway
    url: https://api.velya.local/health
    expected_status: 200
    timeout_ms: 5000
    latency_warning_ms: 1000
    latency_critical_ms: 2000
    tls_check: true
    critical: true

  - name: velya-auth-api
    url: https://auth.velya.local/health
    expected_status: 200
    timeout_ms: 5000
    latency_warning_ms: 500
    latency_critical_ms: 1500
    tls_check: true
    critical: true

  # Frontends
  - name: velya-web-app
    url: https://app.velya.local
    expected_status: 200
    timeout_ms: 10000
    latency_warning_ms: 2000
    latency_critical_ms: 5000
    tls_check: true
    critical: true

  # Dependencias externas
  - name: grafana
    url: https://grafana.velya.local/api/health
    expected_status: 200
    timeout_ms: 5000
    critical: false

  - name: argocd
    url: https://argocd.velya.local/healthz
    expected_status: 200
    timeout_ms: 5000
    critical: false
```

### CronJob YAML

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: endpoint-probe-loop
  namespace: velya-autonomy
  labels:
    velya.io/control-loop: endpoint-probe
    velya.io/tier: autonomy
spec:
  schedule: "* * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 55
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: endpoint-prober
              image: velya/autonomy-agent:latest
              command: ["node", "dist/loops/endpoint-probe.js"]
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 200m
                  memory: 256Mi
          restartPolicy: OnFailure
```

---

## 5. Agent Liveness Loop

### Proposito
Detecta agents (humanos ou automaticos) que pararam de produzir atividade,
indicando possivel travamento, crash silencioso ou desconexao.

### Especificacao

| Atributo          | Valor                                         |
|--------------------|-----------------------------------------------|
| Intervalo          | 2 minutos                                     |
| O que monitora     | Ultima atividade de cada agent registrado      |
| Threshold          | Sem atividade por > 2x intervalo esperado      |
| Acao               | Alerta + tentativa de ping/restart             |
| Escalacao          | Se agent critico silencioso por > 10min        |
| Owner              | platform-team                                  |

### CronJob YAML

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: agent-liveness-loop
  namespace: velya-autonomy
  labels:
    velya.io/control-loop: agent-liveness
    velya.io/tier: autonomy
spec:
  schedule: "*/2 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 115
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: agent-liveness-checker
              image: velya/autonomy-agent:latest
              command: ["node", "dist/loops/agent-liveness.js"]
              resources:
                requests:
                  cpu: 50m
                  memory: 64Mi
                limits:
                  cpu: 100m
                  memory: 128Mi
          restartPolicy: OnFailure
```

### Agents Monitorados

```yaml
agent_liveness_targets:
  - agent: site-watchdog
    expected_heartbeat_interval: 60s
    critical: true

  - agent: flow-watchdog
    expected_heartbeat_interval: 300s
    critical: true

  - agent: dashboard-watchdog
    expected_heartbeat_interval: 900s
    critical: false

  - agent: queue-watchdog
    expected_heartbeat_interval: 30s
    critical: true

  - agent: cert-watchdog
    expected_heartbeat_interval: 3600s
    critical: false

  - agent: drift-watchdog
    expected_heartbeat_interval: 300s
    critical: true

  - agent: no-data-watchdog
    expected_heartbeat_interval: 300s
    critical: true

  - agent: agent-silence-watchdog
    expected_heartbeat_interval: 120s
    critical: true
```

---

## 6. Drift Watcher Loop

### Proposito
Detecta divergencia entre a configuracao declarada (Git) e o estado real
no cluster, indicando drift manual ou falha de reconciliacao.

### Especificacao

| Atributo          | Valor                                         |
|--------------------|-----------------------------------------------|
| Intervalo          | 5 minutos                                     |
| O que monitora     | Diferenca entre Git source e cluster state     |
| Threshold          | Qualquer divergencia nao-aceita                |
| Acao               | Alerta + forcar GitOps reconcile               |
| Escalacao          | Se drift persiste apos reconcile               |
| Owner              | platform-team                                  |

### CronJob YAML

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: drift-watcher-loop
  namespace: velya-autonomy
  labels:
    velya.io/control-loop: drift-watcher
    velya.io/tier: autonomy
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 280
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: drift-watcher
              image: velya/autonomy-agent:latest
              command: ["node", "dist/loops/drift-watcher.js"]
              env:
                - name: ARGOCD_URL
                  value: "https://argocd.velya.local"
                - name: GIT_REPO
                  value: "https://github.com/velya/velya-platform.git"
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 200m
                  memory: 256Mi
          restartPolicy: OnFailure
```

### Categorias de Drift

```typescript
type DriftCategory =
  | 'config-mismatch'       // ConfigMap/Secret divergiu do Git
  | 'image-tag-mismatch'    // Tag de imagem diferente do declarado
  | 'replica-count-manual'  // Replicas ajustadas manualmente
  | 'resource-limits-changed' // Limits/requests alterados
  | 'label-annotation-drift' // Labels/annotations divergentes
  | 'rbac-drift'            // Roles/bindings diferentes
  | 'network-policy-drift'  // NetworkPolicies modificadas
  | 'unknown-resource';     // Recurso nao declarado no Git

interface DriftDetection {
  resource: string;
  namespace: string;
  category: DriftCategory;
  gitState: object;
  clusterState: object;
  diff: string;
  detectedAt: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoReconcile: boolean;
}
```

---

## 7. No-Data Detection Loop

### Proposito
Detecta quando metricas, logs ou eventos param de chegar, indicando
falha silenciosa em pipelines de dados ou instrumentacao.

### Especificacao

| Atributo          | Valor                                         |
|--------------------|-----------------------------------------------|
| Intervalo          | 5 minutos                                     |
| O que monitora     | Fluxo de dados em metricas, logs, eventos      |
| Threshold          | Sem dados novos por > threshold configurado    |
| Acao               | Alerta + investigar pipeline                   |
| Escalacao          | Se no-data em fonte critica por > 15min        |
| Owner              | observability-team                             |

### Fontes Monitoradas

```yaml
no_data_targets:
  - source: prometheus-metrics
    query: "up{job=~'velya-.*'}"
    expected_min_series: 10
    no_data_threshold: 300s
    critical: true

  - source: application-logs
    query: "count_over_time({namespace='velya-system'}[5m])"
    expected_min_value: 1
    no_data_threshold: 300s
    critical: true

  - source: audit-events
    query: "velya_audit_events_total"
    expected_rate: "> 0"
    no_data_threshold: 600s
    critical: true

  - source: nats-messages
    query: "nats_server_msg_total"
    expected_rate: "> 0"
    no_data_threshold: 300s
    critical: true

  - source: patient-activity
    query: "velya_patient_activity_total"
    expected_rate: "> 0"
    no_data_threshold: 900s
    critical: false
```

### CronJob YAML

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: no-data-detection-loop
  namespace: velya-autonomy
  labels:
    velya.io/control-loop: no-data-detection
    velya.io/tier: autonomy
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 280
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: no-data-detector
              image: velya/autonomy-agent:latest
              command: ["node", "dist/loops/no-data-detection.js"]
              env:
                - name: PROMETHEUS_URL
                  value: "http://prometheus.velya-monitoring.svc.cluster.local:9090"
                - name: LOKI_URL
                  value: "http://loki.velya-monitoring.svc.cluster.local:3100"
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 200m
                  memory: 256Mi
          restartPolicy: OnFailure
```

---

## Resumo de Todos os Loops

| #  | Loop              | Intervalo | Threshold                  | Acao Primaria        | Auto-Remediation |
|----|--------------------|-----------|-----------------------------|----------------------|------------------|
| 1  | Heartbeat          | 30s       | 2 falhas consecutivas      | Restart pod          | Sim              |
| 2  | Stale State        | 1min      | 2x intervalo sem update    | Force resync         | Sim              |
| 3  | Queue Depth        | 30s       | > 100 msgs ou crescendo    | Scale consumer       | Sim (bounded)    |
| 4  | Endpoint Probe     | 1min      | Status != esperado          | Alerta + degrade     | Nao              |
| 5  | Agent Liveness     | 2min      | 2x intervalo silencioso    | Ping + restart       | Sim              |
| 6  | Drift Watcher      | 5min      | Qualquer divergencia        | GitOps reconcile     | Sim              |
| 7  | No-Data Detection  | 5min      | Sem dados > threshold       | Investigar pipeline  | Nao              |

---

## Metricas dos Control Loops

```yaml
# PrometheusRule para monitorar os proprios loops
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: control-loop-health
  namespace: velya-autonomy
spec:
  groups:
    - name: control-loop-health
      interval: 30s
      rules:
        - alert: ControlLoopNotRunning
          expr: |
            time() - velya_control_loop_last_run_timestamp > 
            velya_control_loop_expected_interval * 2
          for: 2m
          labels:
            severity: critical
          annotations:
            summary: "Control loop {{ $labels.loop }} nao esta rodando"
            description: "Ultima execucao ha {{ $value }}s"

        - alert: ControlLoopHighErrorRate
          expr: |
            rate(velya_control_loop_errors_total[5m]) > 0.1
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Control loop {{ $labels.loop }} com taxa de erro alta"

        - alert: ControlLoopSlowExecution
          expr: |
            velya_control_loop_execution_duration_seconds > 
            velya_control_loop_expected_interval * 0.8
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Control loop {{ $labels.loop }} demorando mais que 80% do intervalo"
```
