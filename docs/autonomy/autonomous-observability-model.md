# Modelo de Observabilidade Autonoma (Meta-Observabilidade)

> **Principio**: Quem monitora o monitoramento? O mecanismo autonomo deve ser
> observado por si mesmo, detectando falhas no proprio sistema de deteccao.
> Se o monitoramento falhar silenciosamente, nada mais funciona.

## Visao Geral

A meta-observabilidade e a camada que monitora o proprio mecanismo autonomo da
plataforma Velya. Sem ela, uma falha no sistema de monitoramento passaria
despercebida, criando um ponto cego critico.

```
+------------------------------------------------------------------+
|                    VELYA PLATFORM                                  |
+------------------------------------------------------------------+
|                                                                    |
|  +------------------------------------------------------------+   |
|  |  Servicos de Aplicacao (patient, auth, medication, etc.)    |   |
|  +------------------------------------------------------------+   |
|                           |                                        |
|                           v                                        |
|  +------------------------------------------------------------+   |
|  |  Camada de Observabilidade (Prometheus, Grafana, Loki)      |   |
|  +------------------------------------------------------------+   |
|                           |                                        |
|                           v                                        |
|  +------------------------------------------------------------+   |
|  |  Mecanismo Autonomo (Watchdogs, Validators, Loops)         |   |
|  +------------------------------------------------------------+   |
|                           |                                        |
|                           v                                        |
|  +------------------------------------------------------------+   |
|  |  META-OBSERVABILIDADE (Monitorar o monitoramento)          |   |
|  |  - Checagens que pararam                                    |   |
|  |  - CronJobs falhando                                        |   |
|  |  - Schedules atrasados                                      |   |
|  |  - Watchdogs silenciosos                                    |   |
|  |  - Agents travados                                          |   |
|  |  - Remediacoes pendentes                                    |   |
|  |  - Aprendizado nao propagado                                |   |
|  |  - Backlog congestionado                                    |   |
|  |  - Custo do mecanismo                                       |   |
|  |  - Falsos positivos/negativos                               |   |
|  +------------------------------------------------------------+   |
|                                                                    |
+------------------------------------------------------------------+
```

---

## O que Monitorar

### 1. Checagens que Pararam

Detecta quando um control loop, watchdog ou validation agent para de executar.

```yaml
monitor: checks-stopped
description: "Control loops, watchdogs e validators que pararam de rodar"
detection:
  method: timestamp-comparison
  logic: |
    Para cada componente autonomo:
    - Obter timestamp da ultima execucao
    - Comparar com intervalo esperado
    - Se ultima execucao > 2x intervalo: ALERTA

targets:
  - component: heartbeat-loop
    expected_interval: 30s
    stale_threshold: 90s

  - component: stale-state-detection
    expected_interval: 60s
    stale_threshold: 180s

  - component: queue-depth-loop
    expected_interval: 30s
    stale_threshold: 90s

  - component: endpoint-probe-loop
    expected_interval: 60s
    stale_threshold: 180s

  - component: agent-liveness-loop
    expected_interval: 120s
    stale_threshold: 360s

  - component: drift-watcher-loop
    expected_interval: 300s
    stale_threshold: 900s

  - component: no-data-detection-loop
    expected_interval: 300s
    stale_threshold: 900s

  - component: site-watchdog
    expected_interval: 60s
    stale_threshold: 180s

  - component: flow-watchdog
    expected_interval: 300s
    stale_threshold: 900s

  - component: dashboard-watchdog
    expected_interval: 900s
    stale_threshold: 2700s

  - component: cert-watchdog
    expected_interval: 3600s
    stale_threshold: 7200s

  - component: queue-watchdog
    expected_interval: 30s
    stale_threshold: 90s

  - component: agent-silence-watchdog
    expected_interval: 120s
    stale_threshold: 360s

  - component: drift-watchdog
    expected_interval: 300s
    stale_threshold: 900s

  - component: release-validation
    expected_interval: 300s
    stale_threshold: 900s

  - component: synthetic-validation
    expected_interval: 300s
    stale_threshold: 900s

  - component: auth-validation
    expected_interval: 300s
    stale_threshold: 900s

  - component: observability-validation
    expected_interval: 300s
    stale_threshold: 900s

  - component: dashboard-validation
    expected_interval: 900s
    stale_threshold: 2700s

  - component: learning-pipeline
    expected_interval: 300s
    stale_threshold: 900s

  - component: backlog-generator
    expected_interval: 900s
    stale_threshold: 2700s
```

### PrometheusRule para Checagens Paradas

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: meta-checks-stopped
  namespace: velya-autonomy
spec:
  groups:
    - name: meta-checks-stopped
      interval: 30s
      rules:
        - alert: AutonomyComponentStopped
          expr: |
            (time() - velya_autonomy_last_execution_timestamp) >
            (velya_autonomy_expected_interval * 3)
          for: 2m
          labels:
            severity: critical
            meta: "true"
          annotations:
            summary: "Componente autonomo {{ $labels.component }} parou de rodar"
            description: |
              Ultima execucao ha {{ $value | humanizeDuration }}.
              Esperado a cada {{ $labels.expected_interval }}.
              ACAO: Verificar pod, logs, recursos.

        - alert: AutonomyComponentSlow
          expr: |
            velya_autonomy_execution_duration_seconds >
            (velya_autonomy_expected_interval * 0.8)
          for: 5m
          labels:
            severity: warning
            meta: "true"
          annotations:
            summary: "Componente {{ $labels.component }} demorando {{ $value }}s (> 80% do intervalo)"
```

### 2. CronJobs Falhando

```yaml
monitor: cronjobs-failing
description: "CronJobs do mecanismo autonomo que estao falhando"
detection:
  method: kubernetes-job-status
  logic: |
    Para cada CronJob em namespace velya-autonomy:
    - Verificar status dos ultimos N jobs
    - Se 3+ consecutivos falharam: ALERTA CRITICAL
    - Se ultimo falhou: ALERTA WARNING

queries:
  consecutive_failures: |
    kube_job_status_failed{namespace="velya-autonomy"} > 0

  last_successful: |
    max(kube_job_status_completion_time{namespace="velya-autonomy"})
    by (job_name)
```

### PrometheusRule para CronJobs

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: meta-cronjob-health
  namespace: velya-autonomy
spec:
  groups:
    - name: meta-cronjob-health
      rules:
        - alert: CronJobConsecutiveFailures
          expr: |
            increase(kube_job_status_failed{namespace="velya-autonomy"}[1h]) >= 3
          labels:
            severity: critical
            meta: "true"
          annotations:
            summary: "CronJob {{ $labels.job_name }} falhou 3+ vezes na ultima hora"

        - alert: CronJobLastRunFailed
          expr: |
            kube_job_status_failed{namespace="velya-autonomy"} == 1
            unless kube_job_status_succeeded{namespace="velya-autonomy"} == 1
          for: 5m
          labels:
            severity: warning
            meta: "true"
          annotations:
            summary: "Ultima execucao de {{ $labels.job_name }} falhou"

        - alert: CronJobNotScheduled
          expr: |
            time() - kube_cronjob_next_schedule_time{namespace="velya-autonomy"} > 600
          labels:
            severity: critical
            meta: "true"
          annotations:
            summary: "CronJob {{ $labels.cronjob }} nao esta sendo schedulado"
```

### 3. Schedules Atrasados

```yaml
monitor: schedules-delayed
description: "Schedules que nao rodaram no tempo esperado"
detection:
  method: schedule-tracking
  logic: |
    Para cada schedule registrado:
    - Verificar ultima execucao
    - Se atrasado > 50% do intervalo: WARNING
    - Se atrasado > 100% do intervalo: CRITICAL
```

### Implementacao

```typescript
interface ScheduleHealth {
  name: string;
  expectedInterval: number;  // ms
  lastExecution: Date;
  lastStatus: 'success' | 'failure' | 'timeout';
  consecutiveFailures: number;
  averageDuration: number;
  p99Duration: number;
}

async function checkScheduleHealth(): Promise<ScheduleHealthReport> {
  const schedules = await getRegisteredSchedules();
  const report: ScheduleHealthReport = {
    timestamp: new Date(),
    schedules: [],
    overall: 'healthy',
    issues: [],
  };

  for (const schedule of schedules) {
    const lastRun = await getLastExecution(schedule.name);
    const age = Date.now() - lastRun.timestamp.getTime();

    const health: ScheduleHealth = {
      name: schedule.name,
      expectedInterval: schedule.intervalMs,
      lastExecution: lastRun.timestamp,
      lastStatus: lastRun.status,
      consecutiveFailures: await getConsecutiveFailures(schedule.name),
      averageDuration: await getAverageDuration(schedule.name),
      p99Duration: await getP99Duration(schedule.name),
    };

    report.schedules.push(health);

    // Detectar atrasos
    if (age > schedule.intervalMs * 2) {
      report.issues.push({
        schedule: schedule.name,
        issue: 'overdue',
        severity: 'critical',
        detail: `Atrasado ${Math.round(age / 1000)}s (esperado: ${schedule.intervalMs / 1000}s)`,
      });
      report.overall = 'unhealthy';
    } else if (age > schedule.intervalMs * 1.5) {
      report.issues.push({
        schedule: schedule.name,
        issue: 'delayed',
        severity: 'warning',
        detail: `Atrasado ${Math.round(age / 1000)}s`,
      });
      if (report.overall === 'healthy') report.overall = 'degraded';
    }

    // Detectar falhas consecutivas
    if (health.consecutiveFailures >= 3) {
      report.issues.push({
        schedule: schedule.name,
        issue: 'consecutive-failures',
        severity: 'critical',
        detail: `${health.consecutiveFailures} falhas consecutivas`,
      });
      report.overall = 'unhealthy';
    }

    // Detectar duracao excessiva
    if (health.p99Duration > schedule.intervalMs * 0.8) {
      report.issues.push({
        schedule: schedule.name,
        issue: 'slow-execution',
        severity: 'warning',
        detail: `p99 duracao (${health.p99Duration}ms) > 80% do intervalo`,
      });
    }
  }

  return report;
}
```

### 4. Watchdogs Silenciosos

```yaml
monitor: silent-watchdogs
description: "Watchdogs que pararam de emitir heartbeats ou resultados"
detection:
  method: heartbeat-check
  logic: |
    O agent-silence-watchdog monitora os outros watchdogs.
    A meta-observabilidade monitora o agent-silence-watchdog.

    Para o agent-silence-watchdog:
    - Se nao emitiu heartbeat em 6min: ALERTA CRITICO (meta-level)
    - Este alerta usa um mecanismo DIFERENTE (Prometheus diretamente)
      para evitar dependencia circular.

prometheus_rule: |
  # Monitorar o proprio agent-silence-watchdog via Prometheus
  # (nao depende do proprio watchdog para funcionar)
  alert: MetaAgentSilenceWatchdogDown
  expr: |
    time() - velya_watchdog_last_check_timestamp{watchdog="agent-silence-watchdog"} > 360
  for: 1m
  labels:
    severity: critical
    meta: "true"
  annotations:
    summary: "META: agent-silence-watchdog esta silencioso"
    description: "O watchdog que monitora outros watchdogs parou. Verificar imediatamente."
```

### 5. Agents Travados

```yaml
monitor: stuck-agents
description: "Agents que estao rodando mas nao produzindo resultados"
detection:
  method: output-tracking
  logic: |
    Agent esta 'rodando' (pod Running, heartbeat ativo)
    mas nao produz resultados (nenhuma metrica, nenhum alerta,
    nenhuma validacao) por > 3x intervalo esperado.

    Diferente de 'silencioso': o agent responde a health checks
    mas nao faz trabalho util.

indicators:
  - pod_status: Running
  - heartbeat: present
  - results_produced: 0
  - duration: > 3x expected_interval
```

### Implementacao

```typescript
async function detectStuckAgents(): Promise<StuckAgentReport> {
  const agents = await getRegisteredAgents();
  const stuck: StuckAgent[] = [];

  for (const agent of agents) {
    const podStatus = await getPodStatus(agent.name, 'velya-autonomy');
    const lastHeartbeat = await getLastHeartbeat(agent.name);
    const lastResult = await getLastResult(agent.name);

    const isRunning = podStatus === 'Running';
    const isResponding = Date.now() - lastHeartbeat.getTime() < agent.expectedInterval * 2;
    const isProducing = Date.now() - lastResult.getTime() < agent.expectedInterval * 3;

    if (isRunning && isResponding && !isProducing) {
      stuck.push({
        agent: agent.name,
        status: 'stuck',
        podStatus: 'Running',
        lastHeartbeat,
        lastResult,
        stuckDuration: Date.now() - lastResult.getTime(),
      });
    }
  }

  return { timestamp: new Date(), stuckAgents: stuck };
}
```

### 6. Remediacoes Pendentes

```yaml
monitor: pending-remediations
description: "Remediacoes que foram disparadas mas nao completaram"
detection:
  method: remediation-tracking
  logic: |
    Remediacoes com status 'in-progress' por > timeout
    OU remediacoes com revalidacao pendente por > 10min

thresholds:
  max_pending_duration: 15m
  max_revalidation_wait: 10m
  max_concurrent_remediations: 5

alerts:
  - condition: pending > 15min
    severity: warning
    message: "Remediacao {id} pendente ha {duration}"

  - condition: concurrent > 5
    severity: critical
    message: "Muitas remediacoes simultaneas ({count})"

  - condition: revalidation_failed > 3
    severity: critical
    message: "Remediacoes falhando revalidacao repetidamente"
```

### 7. Aprendizado Nao Propagado

```yaml
monitor: learning-not-propagated
description: "Erros processados pelo learning pipeline mas sem follow-up"
detection:
  method: gap-tracking
  logic: |
    Erros que passaram pelo learning pipeline e geraram sugestoes
    (guardrails, testes, alertas) mas as sugestoes nao foram implementadas
    em > 7 dias.

thresholds:
  max_suggestion_age: 7d
  max_open_gaps: 20

alerts:
  - condition: suggestion_age > 7d and severity >= high
    severity: warning
    message: "Sugestao do learning pipeline nao implementada: {suggestion}"

  - condition: open_gaps > 20
    severity: warning
    message: "Muitos gaps abertos no learning pipeline ({count})"
```

### 8. Backlog Congestionado

```yaml
monitor: backlog-congestion
description: "Backlog automatico crescendo mais rapido que resolucao"
detection:
  method: rate-comparison
  logic: |
    Taxa de criacao de itens vs taxa de resolucao.
    Se criacao > 1.5x resolucao por > 2 semanas: ALERTA

metrics:
  creation_rate: increase(velya_backlog_items_created_total[7d])
  resolution_rate: increase(velya_backlog_items_resolved_total[7d])
  ratio: creation_rate / resolution_rate

thresholds:
  warning_ratio: 1.5
  critical_ratio: 3.0
  critical_open_items: 50

alerts:
  - condition: ratio > 1.5 for 14d
    severity: warning
    message: "Backlog crescendo: criacao {ratio}x maior que resolucao"

  - condition: open_items > 50
    severity: warning
    message: "Backlog congestionado: {count} itens abertos"

  - condition: critical_items_open > 5
    severity: critical
    message: "{count} itens criticos abertos no backlog"
```

### 9. Custo do Mecanismo

```yaml
monitor: mechanism-cost
description: "Recursos consumidos pelo mecanismo autonomo"
detection:
  method: resource-accounting
  logic: |
    Somar CPU, memoria e storage consumidos por todos os componentes
    do namespace velya-autonomy. Alertar se exceder budget.

budget:
  cpu_total: "2"        # 2 cores
  memory_total: "4Gi"   # 4GB
  storage_total: "10Gi" # 10GB
  cost_percentage: 5%   # Max 5% do custo total da plataforma

metrics:
  - name: velya_autonomy_cpu_usage
    query: sum(rate(container_cpu_usage_seconds_total{namespace="velya-autonomy"}[5m]))

  - name: velya_autonomy_memory_usage
    query: sum(container_memory_working_set_bytes{namespace="velya-autonomy"})

  - name: velya_autonomy_cost_ratio
    query: |
      sum(container_cpu_usage_seconds_total{namespace="velya-autonomy"})
      / sum(container_cpu_usage_seconds_total)

alerts:
  - condition: cpu > 80% budget
    severity: warning
    message: "Mecanismo autonomo usando {usage} de CPU (budget: {budget})"

  - condition: memory > 80% budget
    severity: warning
    message: "Mecanismo autonomo usando {usage} de memoria (budget: {budget})"

  - condition: cost_ratio > 5%
    severity: warning
    message: "Mecanismo autonomo consome {ratio}% do custo total"
```

### 10. Falsos Positivos e Negativos

```yaml
monitor: false-positive-negative
description: "Taxa de alertas falsos positivos e falsos negativos"
detection:
  method: alert-feedback-loop
  logic: |
    Rastrear alertas que foram:
    - Resolvidos automaticamente em < 1min (possivel falso positivo)
    - Silenciados/ignorados repetidamente (possivel falso positivo)
    - Precedidos por incidentes sem alerta (falso negativo)

metrics:
  - name: velya_alert_false_positive_rate
    query: |
      sum(velya_alert_auto_resolved_within_60s_total)
      / sum(velya_alert_total)

  - name: velya_alert_false_negative_count
    source: manual_feedback + incident_correlation

  - name: velya_alert_noise_score
    description: "Score de ruido por alerta (0-10)"
    calculation: |
      frequency * (1 - action_rate) * (auto_resolve_rate)

thresholds:
  false_positive_rate_warning: 5%
  false_positive_rate_critical: 10%
  noise_score_warning: 5
  noise_score_critical: 8

actions:
  high_false_positive:
    - Ajustar threshold do alerta
    - Adicionar debounce
    - Revisar condicao

  false_negative_detected:
    - Criar novo alerta
    - Revisar gaps de observabilidade
    - Atualizar learning pipeline
```

### Implementacao

```typescript
interface FalsePositiveTracker {
  alertName: string;
  totalFired: number;
  autoResolvedQuickly: number;  // Resolvido em < 1min
  silencedByUser: number;
  actionTaken: number;
  falsePositiveRate: number;
  noiseScore: number;
}

async function trackFalsePositives(): Promise<FalsePositiveReport> {
  const alerts = await getAlertHistory('7d');
  const trackers: Map<string, FalsePositiveTracker> = new Map();

  for (const alert of alerts) {
    const tracker = trackers.get(alert.name) ?? {
      alertName: alert.name,
      totalFired: 0,
      autoResolvedQuickly: 0,
      silencedByUser: 0,
      actionTaken: 0,
      falsePositiveRate: 0,
      noiseScore: 0,
    };

    tracker.totalFired++;

    if (alert.resolvedAt && (alert.resolvedAt.getTime() - alert.firedAt.getTime()) < 60000) {
      tracker.autoResolvedQuickly++;
    }
    if (alert.silenced) tracker.silencedByUser++;
    if (alert.actionTaken) tracker.actionTaken++;

    trackers.set(alert.name, tracker);
  }

  // Calcular metricas
  for (const [, tracker] of trackers) {
    tracker.falsePositiveRate = tracker.totalFired > 0
      ? tracker.autoResolvedQuickly / tracker.totalFired
      : 0;

    const actionRate = tracker.totalFired > 0
      ? tracker.actionTaken / tracker.totalFired
      : 0;

    tracker.noiseScore = Math.min(10,
      (tracker.totalFired / 7) * (1 - actionRate) * (1 + tracker.falsePositiveRate) * 2
    );
  }

  return {
    timestamp: new Date(),
    period: '7d',
    trackers: Array.from(trackers.values()),
    topNoisy: Array.from(trackers.values())
      .sort((a, b) => b.noiseScore - a.noiseScore)
      .slice(0, 10),
  };
}
```

---

## CronJob: Meta-Observability

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: meta-observability
  namespace: velya-autonomy
  labels:
    velya.io/meta: observability
    velya.io/tier: autonomy
spec:
  schedule: "*/2 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 10
  jobTemplate:
    spec:
      activeDeadlineSeconds: 110
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: meta-observer
              image: velya/autonomy-agent:latest
              command: ["node", "dist/meta/observability.js"]
              env:
                - name: PROMETHEUS_URL
                  value: "http://prometheus.velya-monitoring.svc.cluster.local:9090"
                - name: ALERT_CHANNEL
                  valueFrom:
                    configMapKeyRef:
                      name: autonomy-config
                      key: ALERT_CHANNEL
                - name: ESCALATION_CHANNEL
                  valueFrom:
                    configMapKeyRef:
                      name: autonomy-config
                      key: ESCALATION_CHANNEL
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

## Dead Man's Switch

O mecanismo mais critico da meta-observabilidade: um sinal que deve ser
recebido continuamente. Se parar, algo fundamental falhou.

```yaml
# Dead Man's Switch via Prometheus/Alertmanager
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: dead-mans-switch
  namespace: velya-autonomy
spec:
  groups:
    - name: dead-mans-switch
      rules:
        # Este alerta SEMPRE deve estar firing.
        # Se parar de firar, Prometheus ou Alertmanager esta com problema.
        - alert: DeadMansSwitch
          expr: vector(1)
          labels:
            severity: none
            meta: deadman
          annotations:
            summary: "Dead man's switch - se este alerta parar, Prometheus/Alertmanager falhou"

        # Alertmanager Watchdog (builtin)
        - alert: Watchdog
          expr: vector(1)
          labels:
            severity: none
          annotations:
            summary: "Watchdog alert - deve estar sempre ativo"
```

### External Dead Man's Switch

```yaml
# Enviar heartbeat para servico externo
# Se o servico externo nao receber heartbeat, envia alerta via canal alternativo
external_deadman:
  url: "https://deadman.external-monitoring.com/velya"
  method: POST
  interval: 60s
  body:
    cluster: kind-velya-local
    timestamp: "${NOW}"
    components:
      prometheus: "${prometheus_healthy}"
      alertmanager: "${alertmanager_healthy}"
      autonomy_namespace: "${autonomy_pods_running}"
  alert_if_no_heartbeat: 5m
  alert_via: SMS + email (canal alternativo ao Slack)
```

---

## Metricas da Meta-Observabilidade

```yaml
metrics:
  - name: velya_meta_components_monitored
    type: gauge
    help: "Total de componentes monitorados pela meta-observabilidade"

  - name: velya_meta_components_healthy
    type: gauge
    help: "Componentes saudaveis"

  - name: velya_meta_components_unhealthy
    type: gauge
    help: "Componentes nao saudaveis"

  - name: velya_meta_checks_executed_total
    type: counter
    help: "Total de meta-checks executados"

  - name: velya_meta_issues_detected_total
    type: counter
    labels: [issue_type, severity]
    help: "Problemas detectados pela meta-observabilidade"

  - name: velya_meta_false_positive_rate
    type: gauge
    labels: [alert]
    help: "Taxa de falsos positivos por alerta"

  - name: velya_meta_autonomy_cpu_usage
    type: gauge
    help: "CPU usada pelo namespace velya-autonomy"

  - name: velya_meta_autonomy_memory_usage
    type: gauge
    help: "Memoria usada pelo namespace velya-autonomy"

  - name: velya_meta_autonomy_cost_ratio
    type: gauge
    help: "Percentual do custo total da plataforma"
```

---

## Resumo dos 10 Monitores Meta

| #  | Monitor                    | Detecta                           | Frequencia | Severidade Default |
|----|----------------------------|-----------------------------------|------------|-------------------|
| 1  | Checagens paradas          | Loops/watchdogs que pararam       | 30s        | Critical          |
| 2  | CronJobs falhando          | Jobs com falhas consecutivas      | 1min       | Critical          |
| 3  | Schedules atrasados        | Schedules nao rodaram no tempo    | 2min       | Warning           |
| 4  | Watchdogs silenciosos      | Watchdogs sem heartbeat           | 2min       | Critical          |
| 5  | Agents travados            | Agents rodando sem produzir       | 5min       | Warning           |
| 6  | Remediacoes pendentes      | Remediacoes nao completaram       | 2min       | Warning           |
| 7  | Aprendizado nao propagado  | Sugestoes sem implementacao       | 1h         | Info              |
| 8  | Backlog congestionado      | Backlog crescendo > resolucao     | 24h        | Warning           |
| 9  | Custo do mecanismo         | Recursos acima do budget          | 5min       | Warning           |
| 10 | Falsos positivos/negativos | Alertas de baixa qualidade        | 24h        | Info              |

---

## Principio Anti-Recursao

A meta-observabilidade NAO se monitora a si mesma de forma recursiva infinita.
Em vez disso, usa o **Dead Man's Switch** como ancora:

```
Nivel 0: Servicos de Aplicacao
  monitorado por ->
Nivel 1: Observabilidade (Prometheus/Grafana/Loki)
  monitorado por ->
Nivel 2: Mecanismo Autonomo (Watchdogs/Validators)
  monitorado por ->
Nivel 3: Meta-Observabilidade
  monitorado por ->
Nivel 4: Dead Man's Switch (Prometheus builtin + externo)
  monitorado por ->
Nivel 5: Servico Externo (canal alternativo: SMS/email)
  [FIM DA CADEIA]
```

Cada nivel e independente do anterior. Se o nivel N falhar, o nivel N+1 detecta.
O Dead Man's Switch e o ultimo nivel e usa canais completamente independentes.
