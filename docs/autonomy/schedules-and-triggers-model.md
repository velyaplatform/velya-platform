# Modelo de Schedules e Triggers

> **Principio**: Todo processo critico deve ter um trigger automatico — seja continuo,
> agendado, baseado em evento ou duravel. Nenhum depende de alguem lembrar.

## Classificacao de Mecanismos de Execucao

A plataforma Velya utiliza 4 tipos de mecanismos de execucao automatica,
cada um adequado para diferentes cenarios.

```
+------------------+------------------+------------------+------------------+
| Continuous Loops | Scheduled Checks | Event-Driven     | Durable Workflows|
+------------------+------------------+------------------+------------------+
| Intervalo curto  | Intervalo fixo   | Reacao a evento  | Processo longo   |
| 30s - 5min       | 5min - 30 dias   | Imediato         | Minutos a horas  |
| Deteccao rapida  | Validacao ciclica| Trigger pontual  | Estado persistido|
| Alta frequencia  | Media frequencia | Sob demanda      | Saga pattern     |
| Baixo custo/exec | Medio custo/exec | Variavel         | Alto custo total |
+------------------+------------------+------------------+------------------+
```

---

## 1. Continuous Loops

### Quando Usar

- Deteccao de falhas deve ser rapida (segundos)
- Estado muda frequentemente
- Custo por execucao e baixo
- Comparacao simples: estado desejado vs real

### Exemplos Velya

| Loop               | Intervalo | Uso                                   |
|---------------------|-----------|----------------------------------------|
| Heartbeat           | 30s       | Servico vivo ou morto                 |
| Queue Depth         | 30s       | Filas acumulando                      |
| Stale State         | 1min      | Estado desatualizado                  |
| Endpoint Probe      | 1min      | Endpoint respondendo                  |
| Agent Liveness      | 2min      | Agent ativo                           |
| Drift Watcher       | 5min      | Config divergente                     |
| No-Data Detection   | 5min      | Dados pararam de chegar               |

### Configuracao

```yaml
# ConfigMap para continuous loops
apiVersion: v1
kind: ConfigMap
metadata:
  name: continuous-loops-config
  namespace: velya-autonomy
data:
  loops: |
    - name: heartbeat
      interval: 30s
      timeout: 10s
      retries: 0
      mode: continuous
      priority: critical
      resource_budget:
        cpu: 50m
        memory: 64Mi

    - name: queue-depth
      interval: 30s
      timeout: 10s
      retries: 0
      mode: continuous
      priority: high
      resource_budget:
        cpu: 50m
        memory: 64Mi

    - name: stale-state
      interval: 60s
      timeout: 30s
      retries: 1
      mode: continuous
      priority: high
      resource_budget:
        cpu: 50m
        memory: 64Mi

    - name: endpoint-probe
      interval: 60s
      timeout: 30s
      retries: 1
      mode: continuous
      priority: critical
      resource_budget:
        cpu: 100m
        memory: 128Mi

    - name: agent-liveness
      interval: 120s
      timeout: 60s
      retries: 1
      mode: continuous
      priority: high
      resource_budget:
        cpu: 50m
        memory: 64Mi

    - name: drift-watcher
      interval: 300s
      timeout: 120s
      retries: 2
      mode: continuous
      priority: medium
      resource_budget:
        cpu: 100m
        memory: 128Mi

    - name: no-data-detection
      interval: 300s
      timeout: 120s
      retries: 2
      mode: continuous
      priority: high
      resource_budget:
        cpu: 100m
        memory: 128Mi
```

### Implementacao Base

```typescript
interface ContinuousLoopConfig {
  name: string;
  intervalMs: number;
  timeoutMs: number;
  retries: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  handler: () => Promise<LoopResult>;
}

interface LoopResult {
  status: 'ok' | 'warning' | 'critical' | 'error';
  findings: Finding[];
  durationMs: number;
  nextRunAt: Date;
}

class ContinuousLoopRunner {
  private loops: Map<string, ContinuousLoopConfig> = new Map();
  private running = false;

  register(config: ContinuousLoopConfig): void {
    this.loops.set(config.name, config);
  }

  async start(): Promise<void> {
    this.running = true;
    for (const [name, config] of this.loops) {
      this.runLoop(name, config);
    }
  }

  private async runLoop(name: string, config: ContinuousLoopConfig): Promise<void> {
    while (this.running) {
      const start = Date.now();
      try {
        const result = await Promise.race([
          config.handler(),
          timeout(config.timeoutMs),
        ]);
        emitMetric('loop_execution', { name, status: result.status, durationMs: Date.now() - start });

        if (result.status === 'critical' || result.status === 'warning') {
          await processFindings(name, result.findings);
        }
      } catch (error) {
        emitMetric('loop_error', { name, error: String(error) });
        await handleLoopError(name, error, config.retries);
      }
      await sleep(config.intervalMs);
    }
  }
}
```

---

## 2. Scheduled Checks

### Quando Usar

- Validacao periodica que nao precisa ser em tempo real
- Custo por execucao mais alto (queries complexas, testes e2e)
- Compliance e auditoria
- Processos com janela de tolerancia mais ampla

### Catalogo de Schedules Velya

| Schedule                | Intervalo | O que valida                          | CronJob Schedule     |
|-------------------------|-----------|----------------------------------------|----------------------|
| Smoke Tests             | 5min      | Fluxos criticos end-to-end            | `*/5 * * * *`        |
| Data Freshness          | 5min      | Dados sendo atualizados               | `*/5 * * * *`        |
| Dashboard Validation    | 15min     | Dashboards carregando com dados       | `*/15 * * * *`       |
| Cert Renewal Check      | 1h        | Certificados proximos do vencimento   | `0 * * * *`          |
| Backup Validation       | Diario    | Backups integros e restauraveis       | `0 3 * * *`          |
| Security Scan           | Diario    | Vulnerabilidades em imagens           | `0 4 * * *`          |
| Performance Baseline    | Diario    | Metricas dentro do baseline           | `0 6 * * *`          |
| Compliance Audit        | Semanal   | Conformidade com politicas            | `0 2 * * 1`          |
| Capacity Review         | Semanal   | Uso de recursos e projecoes           | `0 8 * * 1`          |
| Role Review             | Mensal    | Permissoes adequadas e minimas        | `0 9 1 * *`          |
| DR Test                 | Mensal    | Recuperacao de desastre funcional     | `0 2 15 * *`         |
| License Audit           | Trimestral| Licencas de dependencias              | `0 9 1 */3 *`        |

### CronJob YAML - Smoke Tests (5min)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scheduled-smoke-tests
  namespace: velya-autonomy
  labels:
    velya.io/schedule: smoke-tests
    velya.io/tier: autonomy
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 12
  failedJobsHistoryLimit: 10
  jobTemplate:
    spec:
      activeDeadlineSeconds: 240
      backoffLimit: 1
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: smoke-tests
              image: velya/autonomy-agent:latest
              command: ["node", "dist/schedules/smoke-tests.js"]
              env:
                - name: BASE_URL
                  value: "https://api.velya.local"
                - name: TIMEOUT_MS
                  value: "30000"
                - name: ALERT_ON_FAILURE
                  value: "true"
              resources:
                requests:
                  cpu: 200m
                  memory: 256Mi
                limits:
                  cpu: 500m
                  memory: 512Mi
          restartPolicy: Never
```

### CronJob YAML - Cert Renewal Check (1h)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scheduled-cert-renewal
  namespace: velya-autonomy
  labels:
    velya.io/schedule: cert-renewal
    velya.io/tier: autonomy
spec:
  schedule: "0 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 300
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: cert-checker
              image: velya/autonomy-agent:latest
              command: ["node", "dist/schedules/cert-renewal.js"]
              env:
                - name: RENEWAL_THRESHOLD_DAYS
                  value: "30"
                - name: CRITICAL_THRESHOLD_DAYS
                  value: "7"
              resources:
                requests:
                  cpu: 50m
                  memory: 64Mi
                limits:
                  cpu: 100m
                  memory: 128Mi
          restartPolicy: OnFailure
```

### CronJob YAML - Dashboard Validation (15min)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scheduled-dashboard-validation
  namespace: velya-autonomy
  labels:
    velya.io/schedule: dashboard-validation
    velya.io/tier: autonomy
spec:
  schedule: "*/15 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 600
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: dashboard-validator
              image: velya/autonomy-agent:latest
              command: ["node", "dist/schedules/dashboard-validation.js"]
              env:
                - name: GRAFANA_URL
                  value: "https://grafana.velya.local"
                - name: GRAFANA_TOKEN
                  valueFrom:
                    secretKeyRef:
                      name: grafana-api-token
                      key: token
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 200m
                  memory: 256Mi
          restartPolicy: OnFailure
```

### CronJob YAML - Backup Validation (Diario)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scheduled-backup-validation
  namespace: velya-autonomy
  labels:
    velya.io/schedule: backup-validation
    velya.io/tier: autonomy
spec:
  schedule: "0 3 * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 3600
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: backup-validator
              image: velya/autonomy-agent:latest
              command: ["node", "dist/schedules/backup-validation.js"]
              env:
                - name: BACKUP_BUCKET
                  value: "velya-backups"
                - name: RESTORE_TEST
                  value: "true"
              resources:
                requests:
                  cpu: 500m
                  memory: 512Mi
                limits:
                  cpu: "1"
                  memory: "1Gi"
          restartPolicy: OnFailure
```

### CronJob YAML - Role Review (Mensal)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scheduled-role-review
  namespace: velya-autonomy
  labels:
    velya.io/schedule: role-review
    velya.io/tier: autonomy
spec:
  schedule: "0 9 1 * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 1800
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: role-reviewer
              image: velya/autonomy-agent:latest
              command: ["node", "dist/schedules/role-review.js"]
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

## 3. Event-Driven Triggers

### Quando Usar

- Reacao imediata a um acontecimento
- Nao faz sentido polling (evento raro ou imprevisivel)
- Cascata de acoes apos um evento
- Integracao entre componentes

### Catalogo de Events Velya

```yaml
# Event catalog
events:
  # Kubernetes events
  - name: pod-crash-loop-detected
    source: kubernetes
    condition: "restartCount > 3 in 10min"
    actions:
      - alert-critical
      - capture-logs
      - quarantine-pod
    owner: platform-team

  - name: node-pressure
    source: kubernetes
    condition: "node condition MemoryPressure or DiskPressure"
    actions:
      - alert-warning
      - preemptive-eviction
    owner: platform-team

  - name: pvc-near-full
    source: kubernetes
    condition: "pvc usage > 85%"
    actions:
      - alert-warning
      - expand-pvc-if-possible
    owner: platform-team

  # GitOps events
  - name: deploy-started
    source: argocd
    actions:
      - log-deploy-start
      - prepare-validation-suite
    owner: platform-team

  - name: deploy-completed
    source: argocd
    actions:
      - run-smoke-tests
      - run-release-validation
      - update-deploy-dashboard
    owner: platform-team

  - name: deploy-failed
    source: argocd
    actions:
      - alert-critical
      - capture-deploy-context
      - auto-rollback-if-safe
    owner: platform-team

  - name: sync-failed
    source: argocd
    actions:
      - alert-warning
      - retry-sync
      - log-drift
    owner: platform-team

  # Application events
  - name: error-rate-spike
    source: prometheus
    condition: "error_rate > 5% for 2min"
    actions:
      - alert-critical
      - activate-circuit-breaker
      - capture-error-context
    owner: application-team

  - name: latency-degradation
    source: prometheus
    condition: "p99 latency > 2x baseline for 5min"
    actions:
      - alert-warning
      - capture-traces
      - evaluate-scaling
    owner: application-team

  - name: auth-failure-spike
    source: velya-auth
    condition: "auth failures > 10/min"
    actions:
      - alert-critical
      - rate-limit-source
      - capture-auth-context
    owner: security-team

  # Certificate events
  - name: certificate-expiring-soon
    source: cert-manager
    condition: "expiry < 7 days"
    actions:
      - trigger-renewal
      - alert-if-renewal-fails
    owner: platform-team

  - name: certificate-renewed
    source: cert-manager
    actions:
      - validate-new-cert
      - update-cert-inventory
    owner: platform-team

  # Data events
  - name: backup-completed
    source: veloci-backup
    actions:
      - validate-backup-integrity
      - update-backup-inventory
    owner: platform-team

  - name: backup-failed
    source: veloci-backup
    actions:
      - alert-critical
      - retry-backup
      - escalate-if-retry-fails
    owner: platform-team
```

### Event Router

```typescript
interface EventDefinition {
  name: string;
  source: string;
  condition?: string;
  actions: string[];
  owner: string;
  debounceMs?: number;
  maxConcurrent?: number;
}

interface EventInstance {
  id: string;
  definition: string;
  timestamp: Date;
  payload: Record<string, unknown>;
  source: string;
  correlationId?: string;
}

class EventRouter {
  private handlers: Map<string, EventHandler[]> = new Map();
  private deduplication: Map<string, Date> = new Map();

  async route(event: EventInstance): Promise<void> {
    // Deduplicacao
    const dedupeKey = `${event.definition}:${JSON.stringify(event.payload)}`;
    const lastSeen = this.deduplication.get(dedupeKey);
    if (lastSeen && Date.now() - lastSeen.getTime() < 30000) {
      return; // Evento duplicado dentro da janela
    }
    this.deduplication.set(dedupeKey, new Date());

    const handlers = this.handlers.get(event.definition) ?? [];
    for (const handler of handlers) {
      try {
        await handler.handle(event);
        emitMetric('event_handled', { event: event.definition, handler: handler.name });
      } catch (error) {
        emitMetric('event_handler_error', {
          event: event.definition,
          handler: handler.name,
          error: String(error),
        });
        await escalate(event, handler, error);
      }
    }
  }
}
```

### Kubernetes Event Watcher

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: event-router
  namespace: velya-autonomy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: event-router
  template:
    metadata:
      labels:
        app: event-router
    spec:
      serviceAccountName: autonomy-event-watcher
      containers:
        - name: event-router
          image: velya/autonomy-agent:latest
          command: ["node", "dist/events/router.js"]
          env:
            - name: NATS_URL
              value: "nats://nats.velya-system.svc.cluster.local:4222"
            - name: EVENT_CATALOG
              value: "/config/events.yaml"
          volumeMounts:
            - name: event-config
              mountPath: /config
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 200m
              memory: 256Mi
      volumes:
        - name: event-config
          configMap:
            name: event-catalog
```

---

## 4. Durable Workflows

### Quando Usar

- Processo com multiplas etapas que pode levar minutos ou horas
- Estado precisa sobreviver a falhas e reinicializacoes
- Compensacao/rollback necessario em caso de falha parcial
- Coordenacao entre multiplos servicos

### Exemplos Velya

| Workflow                 | Etapas | Duracao Tipica | Compensacao          |
|--------------------------|--------|----------------|----------------------|
| Deploy Completo          | 6      | 5-30min        | Rollback automatico  |
| Onboarding Paciente      | 8      | 1-5min         | Cleanup parcial      |
| Backup + Validacao       | 4      | 30min-2h       | Retry + alerta       |
| DR Failover              | 10     | 5-15min        | Failback manual      |
| Cert Rotation            | 5      | 2-10min        | Rollback cert antiga |
| Data Migration           | 7      | 1-4h           | Rollback + restore   |

### Configuracao

```yaml
# Workflow definitions
workflows:
  - name: full-deploy
    timeout: 30m
    stages:
      - name: pre-validation
        timeout: 5m
        handler: validate-pre-deploy
        on_failure: abort

      - name: deploy
        timeout: 10m
        handler: argocd-sync
        on_failure: rollback

      - name: post-validation
        timeout: 5m
        handler: validate-post-deploy
        on_failure: rollback

      - name: smoke-test
        timeout: 5m
        handler: run-smoke-tests
        on_failure: rollback

      - name: canary-analysis
        timeout: 10m
        handler: analyze-canary
        on_failure: rollback

      - name: promotion
        timeout: 2m
        handler: promote-canary
        on_failure: rollback

  - name: cert-rotation
    timeout: 10m
    stages:
      - name: backup-current-cert
        timeout: 1m
        handler: backup-cert

      - name: issue-new-cert
        timeout: 3m
        handler: cert-manager-issue

      - name: validate-new-cert
        timeout: 2m
        handler: validate-tls
        on_failure: restore-backup

      - name: propagate-cert
        timeout: 2m
        handler: update-ingress

      - name: verify-propagation
        timeout: 2m
        handler: verify-endpoints
        on_failure: restore-backup
```

### Implementacao

```typescript
interface WorkflowDefinition {
  name: string;
  timeout: string;
  stages: WorkflowStage[];
}

interface WorkflowStage {
  name: string;
  timeout: string;
  handler: string;
  onFailure: 'abort' | 'rollback' | 'skip' | 'retry';
  maxRetries?: number;
}

interface WorkflowInstance {
  id: string;
  definition: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolling-back';
  currentStage: number;
  stageResults: Map<string, StageResult>;
  startedAt: Date;
  completedAt?: Date;
  triggeredBy: string;
  correlationId: string;
}

class DurableWorkflowEngine {
  private store: WorkflowStore;

  async start(definition: WorkflowDefinition, trigger: string): Promise<WorkflowInstance> {
    const instance: WorkflowInstance = {
      id: generateId(),
      definition: definition.name,
      status: 'running',
      currentStage: 0,
      stageResults: new Map(),
      startedAt: new Date(),
      triggeredBy: trigger,
      correlationId: generateCorrelationId(),
    };

    await this.store.save(instance);
    await this.executeStages(instance, definition);
    return instance;
  }

  private async executeStages(
    instance: WorkflowInstance,
    definition: WorkflowDefinition,
  ): Promise<void> {
    for (let i = instance.currentStage; i < definition.stages.length; i++) {
      const stage = definition.stages[i];
      instance.currentStage = i;
      await this.store.save(instance);

      try {
        const result = await this.executeStage(stage);
        instance.stageResults.set(stage.name, result);

        if (result.status === 'failed') {
          await this.handleStageFailure(instance, definition, stage);
          return;
        }
      } catch (error) {
        await this.handleStageFailure(instance, definition, stage);
        return;
      }
    }

    instance.status = 'completed';
    instance.completedAt = new Date();
    await this.store.save(instance);
  }
}
```

---

## Diagrama de Decisao: Qual Mecanismo Usar?

```
Novo processo identificado
  |
  v
Precisa de deteccao em tempo real (< 1min)?
  |
  +-- Sim --> Continuous Loop
  |
  +-- Nao --> E reacao a um evento especifico?
                |
                +-- Sim --> Event-Driven Trigger
                |
                +-- Nao --> Tem multiplas etapas com estado?
                              |
                              +-- Sim --> Durable Workflow
                              |
                              +-- Nao --> Scheduled Check
                                           |
                                           v
                                         Qual intervalo?
                                           |
                                           +-- < 15min --> CronJob freq alta
                                           +-- < 24h  --> CronJob freq media
                                           +-- >= 24h --> CronJob freq baixa
```

---

## Monitoramento de Schedules

### Metricas

```yaml
# Metricas expostas por cada schedule
metrics:
  - name: velya_schedule_last_run_timestamp
    type: gauge
    help: "Timestamp da ultima execucao do schedule"

  - name: velya_schedule_duration_seconds
    type: histogram
    help: "Duracao da execucao do schedule"

  - name: velya_schedule_success_total
    type: counter
    help: "Total de execucoes bem-sucedidas"

  - name: velya_schedule_failure_total
    type: counter
    help: "Total de execucoes falhadas"

  - name: velya_schedule_skipped_total
    type: counter
    help: "Total de execucoes ignoradas (concurrency policy)"
```

### Alertas para Schedules Falhando

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: schedule-health
  namespace: velya-autonomy
spec:
  groups:
    - name: schedule-health
      rules:
        - alert: ScheduledCheckNotRunning
          expr: |
            time() - velya_schedule_last_run_timestamp > 
            velya_schedule_expected_interval * 2
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Schedule {{ $labels.schedule }} nao rodou no tempo esperado"

        - alert: ScheduledCheckConsecutiveFailures
          expr: |
            increase(velya_schedule_failure_total[1h]) > 3
          labels:
            severity: critical
          annotations:
            summary: "Schedule {{ $labels.schedule }} falhou 3+ vezes na ultima hora"
```
