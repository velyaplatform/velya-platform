# Modelo de Operações Contínuas — Velya

**Versão:** 1.0  
**Domínio:** Operações de Plataforma  
**Classificação:** Documento de Referência Técnica  
**Data:** 2026-04-08

---

## Mandato

> **A Velya opera sem intervenção humana para o estado normal. Humanos intervêm para decisões estratégicas, anomalias não cobertas por automação, e mudanças arquiteturais. O sistema se auto-regula em múltiplos ritmos — do heartbeat de 30s ao review semanal de arquitetura.**

---

## Hierarquia de Ritmos Operacionais

```
┌─────────────────────────────────────────────────────────────────────┐
│  Loop Contínuo (30s)      ─── Heartbeat, health check, alert check │
├─────────────────────────────────────────────────────────────────────┤
│  Loop Curto (5 min)       ─── Repriorização de filas, sentinels    │
├─────────────────────────────────────────────────────────────────────┤
│  Loop Horário (60 min)    ─── Health summary, quota check          │
├─────────────────────────────────────────────────────────────────────┤
│  Loop Diário (24h)        ─── Executive digest, cost sweep, backup │
├─────────────────────────────────────────────────────────────────────┤
│  Loop Semanal (7d)        ─── Architecture review, agent scorecard │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Loop Contínuo (30 segundos)

### Propósito

Detectar falhas, anomalias de latência e saturação de recursos em tempo real. Nunca deixar um problema crescer sem visibilidade por mais de 30 segundos.

### Implementação: Deployments com Polling Loop

```
Instrumento: Deployment K8s (continuous-sentinel class)
Engine: Prometheus Alertmanager + alertas de scrape interval 15s
Execução: Pods sempre ativos com loops internos
```

### O que é verificado a cada 30s

| Check | Instrumento | Ação se falhar |
|---|---|---|
| API Gateway health | Blackbox Exporter probe | Alerta + escalada |
| NATS JetStream health | NATS monitoring endpoint | Alerta + escalada |
| Temporal server health | Temporal health gRPC | Alerta + escalada |
| Prometheus scrape health | Prometheus targets | Alerta |
| Node memory pressure | cAdvisor | Alerta se > 85% |
| Pod OOMKilled rate | Kubernetes events | Alerta se > 0 |
| DLQ message count | NATS monitoring | Alerta se crescendo |

### Deployment: health-sentinel

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: health-sentinel
  namespace: velya-dev-observability
  labels:
    velya.io/workload-class: continuous-sentinel
    velya.io/loop: continuous
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  template:
    metadata:
      labels:
        app: health-sentinel
        velya.io/workload-class: continuous-sentinel
    spec:
      priorityClassName: velya-realtime
      terminationGracePeriodSeconds: 60
      serviceAccountName: health-sentinel-sa
      containers:
      - name: sentinel
        image: velya/health-sentinel:1.0.0
        env:
        - name: CHECK_INTERVAL_SECONDS
          value: "30"
        - name: PROMETHEUS_URL
          value: http://prometheus-operated.velya-dev-observability.svc:9090
        - name: ALERTMANAGER_URL
          value: http://alertmanager-operated.velya-dev-observability.svc:9093
        - name: NATS_MONITORING_URL
          value: http://nats-monitoring.velya-dev-platform.svc:8222
        - name: TEMPORAL_HOST
          value: temporal-frontend.velya-dev-platform.svc:7233
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 128Mi
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          periodSeconds: 15
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          periodSeconds: 5
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 30"]
```

---

## Loop Curto (5 minutos)

### Propósito

Repriorizar filas de processamento, detectar acúmulo de backlog, ajustar pesos de roteamento de tráfego baseado em capacidade atual.

### Implementação

```
Instrumento: Temporal Schedule (BUFFER_ONE) + KEDA ScaledObject
Engine: discharge-queue-poller, patient-flow-sentinel
Execução: Temporal Schedule a cada 5min + KEDA polling 15s
```

### CronJob: Queue Repriorization

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: queue-repriorization
  namespace: velya-dev-platform
  labels:
    velya.io/loop: short
    velya.io/interval: 5min
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Replace    # Substituir se ainda rodando
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 2
  jobTemplate:
    spec:
      backoffLimit: 0           # Não retry — próxima execução em 5min
      activeDeadlineSeconds: 240
      template:
        spec:
          priorityClassName: velya-default
          restartPolicy: Never
          serviceAccountName: queue-ops-sa
          containers:
          - name: repriorizer
            image: velya/queue-repriorizer:1.0.0
            env:
            - name: NATS_URL
              value: nats://nats.velya-dev-platform.svc:4222
            - name: PROMETHEUS_URL
              value: http://prometheus-operated.velya-dev-observability.svc:9090
            - name: REWEIGHT_THRESHOLD
              value: "500"     # Repriorizar se fila > 500 mensagens
            resources:
              requests:
                cpu: 50m
                memory: 64Mi
              limits:
                cpu: 200m
                memory: 128Mi
```

### Temporal Schedule: Discharge Queue Poller

```bash
# Criar schedule de polling de discharge queue
temporal schedule create \
  --schedule-id "discharge-queue-poller" \
  --workflow-type "DischargeQueuePollerWorkflow" \
  --task-queue "discharge-orchestration" \
  --interval "5m" \
  --overlap-policy "BufferOne" \
  --catchup-window "30m" \
  --namespace velya-dev
```

### O que é verificado/executado a cada 5min

| Ação | Responsável | Trigger |
|---|---|---|
| Verificar backlog de discharge queue | discharge-queue-poller | Schedule |
| Repriorizar tarefas por urgência | queue-repriorizer | CronJob |
| Detectar SLA breach iminente | sla-breach-sentinel | Continuous loop |
| Verificar capacidade de workers | Prometheus query | KEDA |
| Checar budget LLM (5min rolling) | budget-sentinel | Continuous loop |

---

## Loop Horário (60 minutos)

### Propósito

Gerar resumo de saúde do sistema, verificar quotas de namespace, consolidar métricas de operação para o dashboard de plataforma.

### CronJob: Health Summary

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: health-summary-hourly
  namespace: velya-dev-platform
  labels:
    velya.io/loop: hourly
    velya.io/interval: 60min
spec:
  schedule: "5 * * * *"          # 5 min após cada hora
  timeZone: "America/Sao_Paulo"
  concurrencyPolicy: Replace
  successfulJobsHistoryLimit: 24  # Manter 24h de histórico
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      backoffLimit: 1
      activeDeadlineSeconds: 180
      template:
        spec:
          priorityClassName: velya-batch
          restartPolicy: OnFailure
          serviceAccountName: health-summary-sa
          containers:
          - name: health-summary
            image: velya/health-summary:1.0.0
            env:
            - name: PROMETHEUS_URL
              value: http://prometheus-operated.velya-dev-observability.svc:9090
            - name: OUTPUT_BUCKET
              value: velya-ops-summaries
            - name: OUTPUT_PATH
              value: hourly/$(date +%Y/%m/%d/%H)/summary.json
            - name: SLACK_CHANNEL
              value: "#velya-platform-health"
            - name: SLACK_ON_ANOMALY_ONLY
              value: "true"    # Só notificar se houver anomalia
            resources:
              requests:
                cpu: 100m
                memory: 128Mi
              limits:
                cpu: 500m
                memory: 256Mi
```

### CronJob: Quota Check

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: quota-check-hourly
  namespace: velya-dev-platform
  labels:
    velya.io/loop: hourly
spec:
  schedule: "10 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      backoffLimit: 1
      activeDeadlineSeconds: 60
      template:
        spec:
          priorityClassName: velya-batch
          restartPolicy: OnFailure
          serviceAccountName: quota-check-sa
          containers:
          - name: quota-check
            image: velya/quota-check:1.0.0
            env:
            - name: ALERT_THRESHOLD_PERCENT
              value: "80"     # Alertar se namespace > 80% da quota
            - name: NAMESPACES
              value: "velya-dev-core,velya-dev-agents,velya-dev-platform,velya-dev-web"
            resources:
              requests:
                cpu: 50m
                memory: 64Mi
              limits:
                cpu: 100m
                memory: 128Mi
```

### Conteúdo do Health Summary Horário

```json
{
  "timestamp": "2026-04-08T15:05:00-03:00",
  "period": "hourly",
  "environment": "dev",
  "cluster": "kind-velya-local",
  "status": "healthy | degraded | critical",
  
  "services": {
    "api_gateway": {
      "status": "healthy",
      "availability_1h": 0.999,
      "p99_latency_ms": 145,
      "error_rate": 0.001,
      "replicas": {"current": 3, "desired": 3}
    },
    "patient_flow_service": {...},
    "discharge_orchestrator": {...}
  },
  
  "queues": {
    "clinical_events": {"depth": 0, "dlq_count": 0},
    "discharge_queue": {"depth": 3, "dlq_count": 0},
    "notifications": {"depth": 0, "dlq_count": 0}
  },
  
  "resources": {
    "namespaces": {
      "velya-dev-core": {"cpu_used_pct": 42, "memory_used_pct": 61},
      "velya-dev-agents": {"cpu_used_pct": 23, "memory_used_pct": 38}
    }
  },
  
  "workflows": {
    "temporal_pending": 5,
    "temporal_running": 2,
    "temporal_failed_1h": 0
  },
  
  "ai_budget": {
    "tokens_used_today": 125000,
    "tokens_budget_daily": 1000000,
    "remaining_pct": 87.5
  },
  
  "anomalies": [],
  "recommendations": []
}
```

---

## Loop Diário (24 horas)

### Propósito

Cost sweep, executive digest, backup de dados, relatório de SLO, análise de custo por serviço.

### Horários do Loop Diário

| Job | Horário | Prioridade |
|---|---|---|
| Database backup | 02:00 | Alta |
| Cost sweep | 02:30 | Média |
| SLO daily report | 06:00 | Alta |
| Executive digest | 06:30 | Média |
| Analytics pipeline | 04:00 | Baixa |
| Agent scorecard | 07:00 | Média |

### CronJob: Executive Digest

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: executive-digest-daily
  namespace: velya-dev-platform
  labels:
    velya.io/loop: daily
    velya.io/has-llm: "true"
spec:
  schedule: "30 6 * * *"
  timeZone: "America/Sao_Paulo"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 7200   # Executar até 2h depois do schedule
  successfulJobsHistoryLimit: 7
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 1
      activeDeadlineSeconds: 3600
      template:
        spec:
          priorityClassName: velya-batch
          restartPolicy: OnFailure
          serviceAccountName: digest-sa
          containers:
          - name: digest-generator
            image: velya/executive-digest:1.0.0
            env:
            - name: PROMETHEUS_URL
              value: http://prometheus-operated.velya-dev-observability.svc:9090
            - name: AI_GATEWAY_URL
              value: http://ai-gateway.velya-dev-agents.svc:8080
            - name: LLM_MODEL
              value: claude-haiku-3    # Modelo mais barato para digest
            - name: TOKEN_BUDGET
              value: "10000"           # Budget baixo — digest é conciso
            - name: OUTPUT_CHANNEL
              value: "#velya-executive"
            - name: LOOKBACK_HOURS
              value: "24"
            resources:
              requests:
                cpu: 200m
                memory: 256Mi
              limits:
                cpu: 500m
                memory: 512Mi
```

### CronJob: SLO Daily Report

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: slo-daily-report
  namespace: velya-dev-platform
  labels:
    velya.io/loop: daily
spec:
  schedule: "0 6 * * *"
  timeZone: "America/Sao_Paulo"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 1800
      template:
        spec:
          priorityClassName: velya-batch
          restartPolicy: OnFailure
          containers:
          - name: slo-report
            image: velya/slo-reporter:1.0.0
            env:
            - name: PROMETHEUS_URL
              value: http://prometheus-operated.velya-dev-observability.svc:9090
            - name: REPORT_BUCKET
              value: velya-ops-reports
            - name: SERVICES
              value: "api-gateway,patient-flow-service,task-inbox-service,velya-web"
            - name: SLO_CONFIG_PATH
              value: /etc/slo/slo-config.yaml
            volumeMounts:
            - name: slo-config
              mountPath: /etc/slo
            resources:
              requests:
                cpu: 100m
                memory: 128Mi
          volumes:
          - name: slo-config
            configMap:
              name: slo-config
```

### ConfigMap: SLO Config

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: slo-config
  namespace: velya-dev-platform
data:
  slo-config.yaml: |
    slos:
    - service: api-gateway
      slos:
      - name: availability
        target: 0.999
        query: |
          1 - (
            rate(nginx_ingress_controller_requests{
              service="api-gateway",
              status=~"5.."
            }[24h]) /
            rate(nginx_ingress_controller_requests{
              service="api-gateway"
            }[24h])
          )
      - name: latency_p99
        target: 0.300   # 300ms
        query: |
          histogram_quantile(0.99, 
            rate(http_request_duration_seconds_bucket{
              service="api-gateway"
            }[24h])
          )
    
    - service: patient-flow-service
      slos:
      - name: availability
        target: 0.999
        query: |
          1 - (
            rate(http_requests_total{
              service="patient-flow-service",
              status_code=~"5.."
            }[24h]) /
            rate(http_requests_total{service="patient-flow-service"}[24h])
          )
```

---

## Loop Semanal (7 dias)

### Propósito

Architecture review, análise de drift de performance, scorecard de agents, planejamento de capacidade.

### Temporal Schedule: Architecture Review

```python
# Weekly architecture review via Temporal Schedule
architecture_review_schedule = Schedule(
    action=ScheduleActionStartWorkflow(
        ArchitectureReviewWorkflow.run,
        id="architecture-review-{scheduled_time}",
        task_queue="platform-ops",
        execution_timeout=timedelta(hours=3),
    ),
    spec=ScheduleSpec(
        cron_expressions=["0 9 * * 1"],   # Segunda-feira 9h
        timezone="America/Sao_Paulo",
    ),
    policy=SchedulePolicy(
        overlap=ScheduleOverlapPolicy.SKIP,
        catchup_window=timedelta(days=2),
    ),
)
```

### O que o Architecture Review Workflow faz

```python
@workflow.defn
class ArchitectureReviewWorkflow:
    @workflow.run
    async def run(self) -> ArchitectureReviewReport:
        # 1. Coletar métricas da semana
        metrics = await workflow.execute_activity(
            collect_weekly_metrics,
            schedule_to_close_timeout=timedelta(minutes=30)
        )
        
        # 2. Análise de performance drift
        drift_analysis = await workflow.execute_activity(
            analyze_performance_drift,
            args=[metrics],
            schedule_to_close_timeout=timedelta(minutes=15)
        )
        
        # 3. Análise de custo
        cost_analysis = await workflow.execute_activity(
            analyze_weekly_cost,
            args=[metrics],
            schedule_to_close_timeout=timedelta(minutes=15)
        )
        
        # 4. Agent scorecard (paralelo com custo)
        agent_scorecard = await workflow.execute_activity(
            compute_agent_scorecards,
            schedule_to_close_timeout=timedelta(minutes=30)
        )
        
        # 5. Síntese com LLM (apenas para insights — texto final)
        synthesis = await workflow.execute_activity(
            synthesize_architecture_review,
            args=[metrics, drift_analysis, cost_analysis, agent_scorecard],
            schedule_to_close_timeout=timedelta(minutes=30)
        )
        
        # 6. Publicar relatório
        await workflow.execute_activity(
            publish_architecture_review,
            args=[synthesis],
            schedule_to_close_timeout=timedelta(minutes=10)
        )
        
        return synthesis
```

---

## Modos de Operação

### Active (Normal)

Todos os loops operando normalmente. Autoscaling ativo. Alertas normais.

```yaml
# ConfigMap de modo de operação
apiVersion: v1
kind: ConfigMap
metadata:
  name: velya-operation-mode
  namespace: velya-dev-platform
data:
  mode: "active"
  since: "2026-04-08T00:00:00Z"
  reason: ""
  scheduled_maintenance: ""
  
  # Configurações por modo
  autoscaling_enabled: "true"
  alert_routing: "normal"       # normal | critical-only | silent
  llm_budget_multiplier: "1.0" # 1.0 normal, 0.5 degraded
  queue_throughput_cap: "none"  # none | throttled | paused
```

### Paused

Execução agendada suspensa. Útil para manutenções planejadas.

```bash
# Pausar todos os schedules Temporal
temporal schedule list --namespace velya-dev | \
  awk '{print $1}' | \
  xargs -I{} temporal schedule toggle \
    --schedule-id {} \
    --pause \
    --reason "Manutenção planejada 2026-04-08" \
    --namespace velya-dev

# Suspender CronJobs
kubectl get cronjob -n velya-dev-platform -o name | \
  xargs -I{} kubectl patch {} \
    -n velya-dev-platform \
    -p '{"spec":{"suspend":true}}'
```

### Degraded

Sistema operando com capacidade reduzida. Budget de LLM reduzido. Só alerts críticos.

```bash
# Ativar modo degradado
kubectl patch configmap velya-operation-mode \
  -n velya-dev-platform \
  --patch '{"data":{"mode":"degraded","reason":"HIS integration instável","llm_budget_multiplier":"0.5","alert_routing":"critical-only"}}'

# Pausar KEDA scalers não-críticos
kubectl annotate scaledobject ai-gateway-async-so \
  -n velya-dev-agents \
  autoscaling.keda.sh/paused=true

kubectl annotate scaledobject discharge-summary-batch-scaler \
  -n velya-dev-agents \
  autoscaling.keda.sh/paused=true
```

### Maintenance

Manutenção ativa. Tráfego de usuário desviado para página de manutenção.

```bash
# Ativar maintenance mode no ingress
kubectl patch ingress api-gateway-ingress \
  -n velya-dev-core \
  --patch '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/configuration-snippet":"return 503;"}}}'

# Ativar custom error page
kubectl patch configmap nginx-config \
  -n ingress-nginx \
  --patch '{"data":{"custom-http-errors":"503"}}'
```

---

## Alertas de Saúde Operacional

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-ops-loops-alerts
  namespace: velya-dev-observability
spec:
  groups:
  - name: operational-loops
    rules:
    
    - alert: CronJobFailed
      expr: kube_job_status_failed > 0
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "CronJob falhou: {{ $labels.job_name }}"
    
    - alert: CronJobMissedSchedule
      expr: |
        time() - kube_cronjob_status_last_schedule_time{
          namespace=~"velya-.*"
        } > 7200   # Mais de 2h desde última execução (threshold = 2x intervalo máximo)
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "CronJob {{ $labels.cronjob }} não executou em 2h"
    
    - alert: SentinelDown
      expr: up{job=~"health-sentinel|sla-breach-sentinel"} == 0
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "Sentinel {{ $labels.job }} está down"
    
    - alert: OperationModeNotActive
      expr: |
        velya_operation_mode{mode="active"} == 0
      for: 30m
      labels:
        severity: warning
      annotations:
        summary: "Sistema não está em modo active há 30 minutos"
        description: "Modo atual: {{ $labels.current_mode }}. Verificar se manutenção foi concluída."
```

---

## Runbook: Resposta a Anomalia por Loop

### Anomalia no Loop Contínuo (0-30s)

1. Verificar alerta no Alertmanager ou PagerDuty
2. Abrir Grafana dashboard "Velya - Runtime Pressure"
3. Identificar serviço/componente afetado
4. Verificar eventos Kubernetes: `kubectl get events -n <namespace> --sort-by='.lastTimestamp'`
5. Se pod CrashLoop: `kubectl describe pod <pod> -n <namespace>` + `kubectl logs <pod> -n <namespace> --previous`

### Anomalia no Loop Curto (2-5min)

1. Verificar queue depth no NATS monitoring
2. Verificar KEDA scaler logs: `kubectl logs -n keda deployment/keda-operator -f`
3. Verificar se KEDA está escalando corretamente
4. Verificar se workers estão consumindo a fila

### Anomalia no Loop Diário

1. Verificar no Loki: `{app="cost-sweep"} |= "ERROR"` para últimas 24h
2. Verificar CronJob status: `kubectl get jobs -n velya-dev-platform --sort-by='.status.startTime'`
3. Re-executar manualmente se necessário: `kubectl create job --from=cronjob/cost-sweep manual-cost-sweep-$(date +%s) -n velya-dev-platform`

---

*Este documento é atualizado quando novos loops operacionais são adicionados à plataforma.*
