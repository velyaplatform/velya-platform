# Modelo de Validacao Recorrente e Health Checks

> Documento 08 - Layered Assurance + Self-Healing  
> Plataforma Velya - Sistema Hospitalar Inteligente  
> Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

A Velya opera tres mecanismos distintos de verificacao recorrente, cada um adequado a diferentes niveis de complexidade, durabilidade e observabilidade. Este documento define quando usar cada tipo, os campos obrigatorios, e cataloga todas as verificacoes ativas e planejadas.

---

## 2. Tipos de Verificacao Recorrente

### 2.1 Kubernetes CronJobs

**Quando usar:**
- Verificacoes simples e independentes (single-step)
- Sem necessidade de estado entre execucoes
- Resultado binario: sucesso ou falha
- Timeout curto (< 5 minutos)
- Sem dependencias entre checks

**Campos obrigatorios por padrao Velya:**

| Campo | Descricao | Exemplo |
|---|---|---|
| `metadata.labels.velya.io/owner` | Time responsavel | `platform-sre` |
| `metadata.labels.velya.io/check-type` | Categoria do check | `infra-health` |
| `metadata.labels.velya.io/severity` | Severidade se falhar | `critical` |
| `spec.jobTemplate.spec.activeDeadlineSeconds` | Timeout maximo | `300` |
| `spec.successfulJobsHistoryLimit` | Historico de sucesso | `3` |
| `spec.failedJobsHistoryLimit` | Historico de falha | `5` |
| `spec.concurrencyPolicy` | Politica de sobreposicao | `Forbid` |
| `spec.jobTemplate.spec.backoffLimit` | Retries antes de falha | `2` |

### 2.2 Argo CronWorkflows

**Quando usar:**
- Pipelines multi-step com dependencias entre etapas
- Necessidade de DAG (grafo de dependencias)
- Artefatos intermediarios entre steps
- Notificacao condicional baseada em resultados parciais
- Timeout medio (5-30 minutos)

**Campos obrigatorios por padrao Velya:**

| Campo | Descricao | Exemplo |
|---|---|---|
| `metadata.labels.velya.io/owner` | Time responsavel | `platform-sre` |
| `spec.workflowSpec.activeDeadlineSeconds` | Timeout global | `1800` |
| `spec.successfulJobsHistoryLimit` | Historico de sucesso | `3` |
| `spec.failedJobsHistoryLimit` | Historico de falha | `5` |
| `spec.concurrencyPolicy` | Politica de sobreposicao | `Replace` |
| `spec.workflowSpec.retryStrategy` | Estrategia de retry | ver exemplos |
| `spec.workflowSpec.onExit` | Handler de saida | `notify-result` |

### 2.3 Temporal Schedules

**Quando usar:**
- Verificacoes que precisam de estado duravel entre execucoes
- Necessidade de pause/resume sem perda de contexto
- Compensacao em caso de falha parcial
- Verificacoes de longa duracao (> 30 minutos)
- Overlap policy sofisticada (buffer, cancel, skip, terminate)
- Historico completo de execucoes com replay

**Campos obrigatorios por padrao Velya:**

| Campo | Descricao | Exemplo |
|---|---|---|
| `scheduleId` | ID unico do schedule | `velya-discharge-audit-daily` |
| `action.workflowType` | Tipo do workflow | `DischargeAuditWorkflow` |
| `spec.intervals[].every` | Intervalo | `24h` |
| `policy.overlap` | Politica de sobreposicao | `SCHEDULE_OVERLAP_POLICY_SKIP` |
| `policy.catchupWindow` | Janela de recuperacao | `1h` |
| `state.paused` | Estado inicial | `false` |
| `memo.owner` | Time responsavel | `clinical-ops` |
| `searchAttributes.VelyaSeverity` | Severidade | `critical` |

---

## 3. Catalogo de Verificacoes

### 3.1 Saude de Infraestrutura

| Check | Tipo | Frequencia | Severidade | Owner |
|---|---|---|---|---|
| Node readiness e recursos | CronJob | 5min | critical | platform-sre |
| PVC capacity e IOPS | CronJob | 15min | high | platform-sre |
| Certificate expiry (< 30d) | CronJob | 6h | high | platform-sre |
| DNS resolution latency | CronJob | 5min | critical | platform-sre |
| NATS JetStream cluster health | CronJob | 2min | critical | platform-sre |
| External Secrets sync status | CronJob | 10min | high | platform-sre |
| OpenTofu state drift detection | CronWorkflow | 1h | high | platform-sre |

### 3.2 Saude de Aplicacao

| Check | Tipo | Frequencia | Severidade | Owner |
|---|---|---|---|---|
| Readiness probe aggregado | CronJob | 1min | critical | platform-sre |
| patient-flow API contract | CronJob | 5min | critical | clinical-eng |
| discharge-orchestrator idempotency | CronWorkflow | 30min | critical | clinical-eng |
| task-inbox queue depth | CronJob | 2min | high | clinical-eng |
| audit-service write path | CronJob | 5min | critical | compliance |
| velya-web frontend health | CronJob | 3min | high | frontend |
| ai-gateway model availability | CronJob | 2min | critical | ai-ops |

### 3.3 Saude de Agentes

| Check | Tipo | Frequencia | Severidade | Owner |
|---|---|---|---|---|
| Agent heartbeat (Claude SDK) | CronJob | 1min | critical | ai-ops |
| Agent decision quality sampling | Temporal | 1h | high | ai-ops |
| Agent memory consistency | Temporal | 30min | high | ai-ops |
| Agent policy compliance | CronWorkflow | 15min | critical | compliance |
| Agent resource consumption | CronJob | 5min | high | ai-ops |
| Agent quarantine status | CronJob | 5min | critical | ai-ops |

### 3.4 Saude de Workflows

| Check | Tipo | Frequencia | Severidade | Owner |
|---|---|---|---|---|
| Temporal worker connectivity | CronJob | 1min | critical | platform-sre |
| Workflow stuck detection (> SLA) | Temporal | 5min | critical | clinical-eng |
| Workflow retry storm detection | CronJob | 2min | high | platform-sre |
| ArgoCD sync status | CronJob | 3min | high | platform-sre |
| Argo Rollouts stuck analysis | CronJob | 5min | high | platform-sre |

### 3.5 Crescimento de Filas e Estados Travados

| Check | Tipo | Frequencia | Severidade | Owner |
|---|---|---|---|---|
| NATS JetStream consumer lag | CronJob | 1min | critical | platform-sre |
| Dead letter queue growth | CronJob | 5min | high | platform-sre |
| Stuck discharge processes | Temporal | 5min | critical | clinical-eng |
| Pending task-inbox items > SLA | CronJob | 3min | high | clinical-eng |
| Unprocessed audit events | CronJob | 5min | high | compliance |

### 3.6 Deteccao de Modo Degradado

| Check | Tipo | Frequencia | Severidade | Owner |
|---|---|---|---|---|
| Circuit breaker state monitor | CronJob | 1min | high | platform-sre |
| Fallback activation rate | CronJob | 5min | high | platform-sre |
| Feature flag override detection | CronJob | 10min | medium | platform-sre |
| Graceful degradation compliance | CronWorkflow | 15min | high | clinical-eng |

### 3.7 Conformidade e Drift

| Check | Tipo | Frequencia | Severidade | Owner |
|---|---|---|---|---|
| Policy OPA/Gatekeeper compliance | CronJob | 10min | critical | compliance |
| RBAC drift detection | CronWorkflow | 1h | high | security |
| Network policy validation | CronJob | 15min | high | security |
| Doc-reality drift (runbook accuracy) | Temporal | 24h | medium | platform-sre |
| LGPD data retention compliance | Temporal | 24h | critical | compliance |
| HIPAA audit log completeness | Temporal | 12h | critical | compliance |

### 3.8 Regressao e Padroes de Erro

| Check | Tipo | Frequencia | Severidade | Owner |
|---|---|---|---|---|
| P99 latency regression detection | CronJob | 5min | high | platform-sre |
| Error rate anomaly detection | CronJob | 3min | high | platform-sre |
| Recurring error pattern matching | CronWorkflow | 15min | high | platform-sre |
| Memory leak trend analysis | CronJob | 10min | high | platform-sre |

---

## 4. YAML Completos - CronJobs

### 4.1 NATS JetStream Cluster Health

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: check-nats-jetstream-health
  namespace: velya-system
  labels:
    velya.io/owner: platform-sre
    velya.io/check-type: infra-health
    velya.io/severity: critical
    velya.io/component: nats-jetstream
  annotations:
    velya.io/runbook: "https://wiki.velya.io/runbooks/nats-jetstream-recovery"
    velya.io/escalation-channel: "#velya-infra-critical"
    velya.io/dead-letter-topic: "velya.checks.dlq"
spec:
  schedule: "*/2 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  startingDeadlineSeconds: 120
  jobTemplate:
    spec:
      activeDeadlineSeconds: 90
      backoffLimit: 2
      template:
        metadata:
          labels:
            velya.io/check: nats-jetstream-health
          annotations:
            prometheus.io/scrape: "true"
            prometheus.io/port: "9090"
        spec:
          serviceAccountName: velya-health-checker
          restartPolicy: Never
          containers:
            - name: nats-check
              image: registry.velya.io/health-checks/nats-jetstream:1.4.2
              env:
                - name: NATS_URL
                  valueFrom:
                    secretKeyRef:
                      name: nats-credentials
                      key: url
                - name: CHECK_STREAMS
                  value: "patient-events,task-events,audit-events,discharge-events"
                - name: CHECK_CONSUMERS
                  value: "true"
                - name: MAX_CONSUMER_LAG_SECONDS
                  value: "30"
                - name: CHECK_CLUSTER_QUORUM
                  value: "true"
                - name: OTEL_EXPORTER_OTLP_ENDPOINT
                  value: "http://otel-collector.observability:4317"
                - name: ALERT_WEBHOOK
                  valueFrom:
                    secretKeyRef:
                      name: alerting-webhooks
                      key: slack-infra-critical
              resources:
                requests:
                  cpu: 50m
                  memory: 64Mi
                limits:
                  cpu: 100m
                  memory: 128Mi
              securityContext:
                runAsNonRoot: true
                readOnlyRootFilesystem: true
                allowPrivilegeEscalation: false
```

### 4.2 Patient-Flow API Contract Validation

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: check-patient-flow-contract
  namespace: velya-system
  labels:
    velya.io/owner: clinical-eng
    velya.io/check-type: app-health
    velya.io/severity: critical
    velya.io/component: patient-flow
  annotations:
    velya.io/runbook: "https://wiki.velya.io/runbooks/patient-flow-contract"
    velya.io/escalation-channel: "#velya-clinical-critical"
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  startingDeadlineSeconds: 60
  jobTemplate:
    spec:
      activeDeadlineSeconds: 120
      backoffLimit: 1
      template:
        metadata:
          labels:
            velya.io/check: patient-flow-contract
        spec:
          serviceAccountName: velya-health-checker
          restartPolicy: Never
          containers:
            - name: contract-check
              image: registry.velya.io/health-checks/api-contract:2.1.0
              env:
                - name: TARGET_SERVICE
                  value: "http://patient-flow.velya-clinical:8080"
                - name: CONTRACT_SPEC_URL
                  value: "http://patient-flow.velya-clinical:8080/openapi.json"
                - name: VALIDATION_MODE
                  value: "strict"
                - name: CHECK_ENDPOINTS
                  value: |
                    GET /api/v1/patients/{id}
                    GET /api/v1/patients/{id}/status
                    POST /api/v1/patients/{id}/discharge/initiate
                    GET /api/v1/beds/availability
                    GET /api/v1/flow/metrics
                - name: EXPECTED_RESPONSE_TIME_MS
                  value: "500"
                - name: CHECK_BACKWARD_COMPATIBILITY
                  value: "true"
                - name: PREVIOUS_SPEC_CONFIGMAP
                  value: "patient-flow-api-spec-previous"
                - name: OTEL_EXPORTER_OTLP_ENDPOINT
                  value: "http://otel-collector.observability:4317"
              resources:
                requests:
                  cpu: 50m
                  memory: 64Mi
                limits:
                  cpu: 100m
                  memory: 128Mi
              securityContext:
                runAsNonRoot: true
                readOnlyRootFilesystem: true
                allowPrivilegeEscalation: false
```

### 4.3 Agent Heartbeat Monitor (Claude Agent SDK)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: check-agent-heartbeat
  namespace: velya-system
  labels:
    velya.io/owner: ai-ops
    velya.io/check-type: agent-health
    velya.io/severity: critical
    velya.io/component: agent-orchestrator
  annotations:
    velya.io/runbook: "https://wiki.velya.io/runbooks/agent-heartbeat-failure"
    velya.io/escalation-channel: "#velya-ai-critical"
spec:
  schedule: "* * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 10
  startingDeadlineSeconds: 30
  jobTemplate:
    spec:
      activeDeadlineSeconds: 45
      backoffLimit: 1
      template:
        metadata:
          labels:
            velya.io/check: agent-heartbeat
        spec:
          serviceAccountName: velya-agent-monitor
          restartPolicy: Never
          containers:
            - name: heartbeat-check
              image: registry.velya.io/health-checks/agent-heartbeat:1.2.0
              env:
                - name: AGENT_ORCHESTRATOR_URL
                  value: "http://agent-orchestrator.velya-ai:8080"
                - name: CHECK_AGENTS
                  value: |
                    discharge-agent
                    triage-agent
                    scheduling-agent
                    audit-compliance-agent
                    medication-reconciliation-agent
                - name: MAX_HEARTBEAT_AGE_SECONDS
                  value: "60"
                - name: CHECK_LIFECYCLE_STATE
                  value: "true"
                - name: ALLOWED_STATES
                  value: "active,warming,cooling"
                - name: QUARANTINE_ALERT
                  value: "true"
                - name: CHECK_MEMORY_SERVICE
                  value: "true"
                - name: MEMORY_SERVICE_URL
                  value: "http://memory-service.velya-ai:8080"
                - name: OTEL_EXPORTER_OTLP_ENDPOINT
                  value: "http://otel-collector.observability:4317"
                - name: METRICS_PUSH_GATEWAY
                  value: "http://prometheus-pushgateway.observability:9091"
              resources:
                requests:
                  cpu: 30m
                  memory: 48Mi
                limits:
                  cpu: 80m
                  memory: 96Mi
              securityContext:
                runAsNonRoot: true
                readOnlyRootFilesystem: true
                allowPrivilegeEscalation: false
```

### 4.4 Dead Letter Queue Growth Monitor

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: check-dlq-growth
  namespace: velya-system
  labels:
    velya.io/owner: platform-sre
    velya.io/check-type: queue-health
    velya.io/severity: high
    velya.io/component: nats-jetstream
  annotations:
    velya.io/runbook: "https://wiki.velya.io/runbooks/dlq-triage"
    velya.io/escalation-channel: "#velya-infra-high"
    velya.io/budget-impact: "queue-processing-sli"
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  startingDeadlineSeconds: 60
  jobTemplate:
    spec:
      activeDeadlineSeconds: 120
      backoffLimit: 2
      template:
        metadata:
          labels:
            velya.io/check: dlq-growth
        spec:
          serviceAccountName: velya-health-checker
          restartPolicy: Never
          containers:
            - name: dlq-check
              image: registry.velya.io/health-checks/dlq-monitor:1.3.1
              env:
                - name: NATS_URL
                  valueFrom:
                    secretKeyRef:
                      name: nats-credentials
                      key: url
                - name: DLQ_STREAMS
                  value: |
                    patient-events.dlq
                    task-events.dlq
                    audit-events.dlq
                    discharge-events.dlq
                    agent-decisions.dlq
                - name: THRESHOLD_ABSOLUTE
                  value: "100"
                - name: THRESHOLD_GROWTH_RATE_PER_MINUTE
                  value: "10"
                - name: THRESHOLD_GROWTH_RATE_CRITICAL
                  value: "50"
                - name: SAMPLE_FAILED_MESSAGES
                  value: "5"
                - name: CLASSIFY_FAILURE_REASON
                  value: "true"
                - name: AUTO_REPLAY_TRANSIENT
                  value: "false"
                - name: OTEL_EXPORTER_OTLP_ENDPOINT
                  value: "http://otel-collector.observability:4317"
                - name: ALERT_WEBHOOK
                  valueFrom:
                    secretKeyRef:
                      name: alerting-webhooks
                      key: slack-infra-high
              resources:
                requests:
                  cpu: 50m
                  memory: 64Mi
                limits:
                  cpu: 100m
                  memory: 128Mi
              securityContext:
                runAsNonRoot: true
                readOnlyRootFilesystem: true
                allowPrivilegeEscalation: false
```

### 4.5 P99 Latency Regression Detection

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: check-latency-regression
  namespace: velya-system
  labels:
    velya.io/owner: platform-sre
    velya.io/check-type: performance-health
    velya.io/severity: high
    velya.io/component: all-services
  annotations:
    velya.io/runbook: "https://wiki.velya.io/runbooks/latency-regression"
    velya.io/escalation-channel: "#velya-performance"
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 5
  startingDeadlineSeconds: 60
  jobTemplate:
    spec:
      activeDeadlineSeconds: 180
      backoffLimit: 1
      template:
        metadata:
          labels:
            velya.io/check: latency-regression
        spec:
          serviceAccountName: velya-health-checker
          restartPolicy: Never
          containers:
            - name: latency-check
              image: registry.velya.io/health-checks/latency-regression:2.0.1
              env:
                - name: PROMETHEUS_URL
                  value: "http://prometheus.observability:9090"
                - name: SERVICES
                  value: |
                    patient-flow:500ms:1000ms
                    task-inbox:200ms:500ms
                    discharge-orchestrator:1000ms:3000ms
                    audit-service:100ms:300ms
                    ai-gateway:2000ms:5000ms
                    memory-service:100ms:250ms
                    policy-engine:50ms:150ms
                    decision-log-service:100ms:300ms
                    velya-web:300ms:800ms
                    agent-orchestrator:500ms:1500ms
                - name: COMPARISON_WINDOW
                  value: "1h"
                - name: BASELINE_WINDOW
                  value: "24h"
                - name: REGRESSION_THRESHOLD_PERCENT
                  value: "20"
                - name: CRITICAL_REGRESSION_PERCENT
                  value: "50"
                - name: PERCENTILES
                  value: "p50,p90,p95,p99"
                - name: EXCLUDE_DEPLOY_WINDOWS
                  value: "true"
                - name: DEPLOY_ANNOTATION_QUERY
                  value: 'argocd_app_sync_total{namespace=~"velya-.*"}'
                - name: OTEL_EXPORTER_OTLP_ENDPOINT
                  value: "http://otel-collector.observability:4317"
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 200m
                  memory: 256Mi
              securityContext:
                runAsNonRoot: true
                readOnlyRootFilesystem: true
                allowPrivilegeEscalation: false
```

---

## 5. YAML - Argo CronWorkflow Exemplo

### 5.1 OpenTofu State Drift Detection

```yaml
apiVersion: argoproj.io/v1alpha1
kind: CronWorkflow
metadata:
  name: check-tofu-state-drift
  namespace: velya-system
  labels:
    velya.io/owner: platform-sre
    velya.io/check-type: infra-drift
    velya.io/severity: high
spec:
  schedule: "0 * * * *"
  timezone: "America/Sao_Paulo"
  concurrencyPolicy: Replace
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  startingDeadlineSeconds: 300
  workflowSpec:
    entrypoint: drift-detection
    activeDeadlineSeconds: 1800
    serviceAccountName: velya-infra-checker
    onExit: notify-result
    templates:
      - name: drift-detection
        dag:
          tasks:
            - name: fetch-state
              template: tofu-plan
              arguments:
                parameters:
                  - name: module
                    value: "{{item}}"
              withItems:
                - eks-cluster
                - networking
                - rds-databases
                - s3-buckets
                - iam-roles
                - secrets-manager
            - name: aggregate-results
              template: aggregate
              dependencies:
                - fetch-state
            - name: evaluate-risk
              template: risk-eval
              dependencies:
                - aggregate-results

      - name: tofu-plan
        inputs:
          parameters:
            - name: module
        container:
          image: registry.velya.io/infra-tools/tofu-drift:1.1.0
          command: ["/bin/sh", "-c"]
          args:
            - |
              cd /tofu/modules/{{inputs.parameters.module}}
              tofu init -backend=true
              tofu plan -detailed-exitcode -out=/tmp/plan.out 2>&1 | tee /tmp/plan.log
              EXIT_CODE=$?
              echo "{\"module\": \"{{inputs.parameters.module}}\", \"drift\": $([ $EXIT_CODE -eq 2 ] && echo true || echo false), \"exit_code\": $EXIT_CODE}" > /tmp/result.json
          env:
            - name: AWS_ROLE_ARN
              valueFrom:
                secretKeyRef:
                  name: tofu-credentials
                  key: role-arn
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
        outputs:
          artifacts:
            - name: plan-result
              path: /tmp/result.json
            - name: plan-log
              path: /tmp/plan.log

      - name: aggregate
        script:
          image: registry.velya.io/tools/jq:1.7
          command: ["/bin/sh"]
          source: |
            echo "Aggregating drift results..."
            # Logica de agregacao dos artefatos

      - name: risk-eval
        script:
          image: registry.velya.io/health-checks/risk-evaluator:1.0.0
          command: ["python3"]
          source: |
            import json
            import sys
            # Avalia se drift detectado requer acao imediata
            # Classifica por modulo e impacto
            print("Risk evaluation complete")

      - name: notify-result
        container:
          image: registry.velya.io/tools/notifier:1.2.0
          env:
            - name: SLACK_WEBHOOK
              valueFrom:
                secretKeyRef:
                  name: alerting-webhooks
                  key: slack-infra-high
            - name: WORKFLOW_STATUS
              value: "{{workflow.status}}"
```

---

## 6. Temporal Schedule Exemplo

### 6.1 Discharge Process Stuck Detection

```typescript
// temporal-schedules/discharge-stuck-detection.ts
import { Client, Connection } from '@temporalio/client';

async function createDischargeStuckSchedule() {
  const connection = await Connection.connect({
    address: 'temporal.velya-system:7233',
  });
  const client = new Client({ connection });

  await client.schedule.create({
    scheduleId: 'velya-discharge-stuck-detection',
    spec: {
      intervals: [{ every: '5m' }],
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'DischargeStuckDetectionWorkflow',
      taskQueue: 'velya-health-checks',
      args: [{
        slaThresholds: {
          initiatedToApproved: '2h',
          approvedToMedicationReview: '1h',
          medicationReviewToDischarge: '4h',
          totalProcess: '24h',
        },
        escalationTargets: {
          warning: '#velya-clinical-ops',
          critical: '#velya-clinical-critical',
          breach: ['#velya-clinical-critical', 'pager:clinical-lead'],
        },
        autoRemediationEnabled: true,
      }],
      workflowExecutionTimeout: '10m',
      retryPolicy: {
        initialInterval: '10s',
        maximumInterval: '1m',
        maximumAttempts: 3,
        backoffCoefficient: 2,
      },
      memo: {
        owner: 'clinical-eng',
        severity: 'critical',
        runbook: 'https://wiki.velya.io/runbooks/discharge-stuck',
      },
      searchAttributes: {
        VelyaCheckType: ['workflow-health'],
        VelyaSeverity: ['critical'],
        VelyaComponent: ['discharge-orchestrator'],
      },
    },
    policies: {
      overlap: 'SCHEDULE_OVERLAP_POLICY_SKIP',
      catchupWindow: '15m',
    },
    state: {
      paused: false,
      note: 'Deteccao de processos de alta hospitalar travados',
    },
  });
}
```

---

## 7. Arvore de Decisao: Qual Tipo Usar

```
Verificacao necessaria
|
+-- E single-step (uma acao)?
|   |
|   +-- SIM --> Timeout < 5min?
|   |           |
|   |           +-- SIM --> Kubernetes CronJob
|   |           +-- NAO --> Argo CronWorkflow (single template com timeout longo)
|   |
|   +-- NAO --> Tem dependencias entre steps?
|               |
|               +-- SIM --> Precisa de estado duravel entre execucoes?
|               |           |
|               |           +-- SIM --> Temporal Schedule
|               |           +-- NAO --> Argo CronWorkflow (DAG)
|               |
|               +-- NAO --> Precisa de pause/resume?
|                           |
|                           +-- SIM --> Temporal Schedule
|                           +-- NAO --> Argo CronWorkflow
```

---

## 8. Observabilidade dos Checks

### 8.1 Metricas Emitidas por Todo Check

Todo check, independente do tipo, DEVE emitir:

```
velya_health_check_execution_total{check, type, result}
velya_health_check_duration_seconds{check, type}
velya_health_check_last_success_timestamp{check, type}
velya_health_check_consecutive_failures{check, type}
```

### 8.2 Alertas Derivados

```yaml
# prometheus-rules/health-check-alerts.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: health-check-alerts
  namespace: observability
spec:
  groups:
    - name: velya-health-checks
      interval: 30s
      rules:
        - alert: HealthCheckConsecutiveFailures
          expr: velya_health_check_consecutive_failures > 3
          for: 0m
          labels:
            severity: "{{ $labels.severity }}"
          annotations:
            summary: "Check {{ $labels.check }} falhou {{ $value }} vezes consecutivas"
            runbook: "https://wiki.velya.io/runbooks/health-check-failure"

        - alert: HealthCheckMissing
          expr: |
            time() - velya_health_check_last_success_timestamp > 600
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Check {{ $labels.check }} nao executou com sucesso nos ultimos 10 minutos"

        - alert: HealthCheckSlowExecution
          expr: |
            velya_health_check_duration_seconds > 
            on(check) group_left() 
            velya_health_check_expected_duration_seconds * 2
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Check {{ $labels.check }} esta demorando mais que 2x o esperado"
```

---

## 9. Orcamento de Health Checks

### 9.1 Limites de Recursos

| Recurso | Limite por Check | Limite Agregado |
|---|---|---|
| CPU por CronJob | 100m | 2 cores total |
| Memoria por CronJob | 128Mi | 4Gi total |
| Execucoes simultaneas | 1 por check | 15 max global |
| Armazenamento de historico | 5 failed + 3 success | - |
| Network egress por check | 10MB | 500MB/hora total |

### 9.2 Politica de Custo

- Checks de severidade `medium` ou menor: maximo 1 execucao a cada 10 minutos
- Checks de severidade `high`: maximo 1 execucao a cada 2 minutos
- Checks de severidade `critical`: maximo 1 execucao por minuto
- Todo check novo requer aprovacao de `platform-sre` com justificativa de frequencia

---

## 10. Processo de Adicao de Novo Check

1. Abrir PR com YAML do check e documentacao
2. Incluir campos obrigatorios (secao 2)
3. Definir runbook linkado na annotation
4. Definir owner e canal de escalacao
5. Review por `platform-sre` para validar orcamento
6. Deploy via ArgoCD (pasta `k8s/health-checks/`)
7. Verificar emissao de metricas em Grafana
8. Adicionar ao catalogo neste documento

---

## 11. Manutencao e Revisao

- Revisao mensal de todos os checks: remover obsoletos, ajustar thresholds
- Revisao trimestral de frequencias: otimizar baseado em dados reais de deteccao
- Analise semestral de custo computacional dos checks
- Todo check sem deteccao positiva em 90 dias deve ser avaliado para remocao ou ajuste
