# Estratégia de Workflows Duráveis — Velya

**Versão:** 1.0  
**Domínio:** Orquestração de Processos  
**Classificação:** Documento de Referência Técnica  
**Data:** 2026-04-08

---

## Mandato

> **Na Velya, durabilidade é um requisito de negócio, não uma feature de infraestrutura. Quando um processo tem estado que precisa sobreviver a falhas, a resposta é Temporal — não CronJob com retry, não script com sleep, não fila com requeue manual.**

---

## Hierarquia de Executores de Processo

```
┌─────────────────────────────────────────────────────────────────┐
│  Complexidade do Processo                                       │
│                                                                 │
│  ALTA │  Temporal Schedule          ← Durável + agendado       │
│       │  Temporal Workflow          ← Durável + event-driven   │
│       │  Argo CronWorkflow          ← DAG agendado             │
│       │  Argo Workflow              ← DAG único                │
│  BAIXA│  CronJob K8s               ← Simples + agendado       │
│       └──────────────────────────────────────────────────────  │
│           STATELESS          STATEFUL (precisa durabilidade)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Regra Central

> **Use CronJob quando o processo pode falhar e ser re-executado na próxima rodada sem consequências. Use Temporal quando a falha no meio exige compensation, quando o histórico de execução é auditável por compliance, ou quando o processo tem mais de 3 steps com estado entre eles.**

---

## Temporal como Engine Principal

### Quando usar Temporal

| Critério | Usar Temporal |
|---|---|
| Processo tem > 3 steps | Sim |
| Falha parcial exige compensation (rollback) | Sim |
| Estado deve sobreviver ao crash do worker | Sim |
| Processo dura > 30 segundos | Sim |
| Histórico de execução é auditável | Sim |
| Visibilidade de estado intermediário necessária | Sim |
| Retry com backoff exponencial por step | Sim |
| Múltiplos serviços participam do processo | Sim |

### Quando NÃO usar Temporal

| Condição | Motivo |
|---|---|
| Processo simples idempotente (1 step) | CronJob é suficiente |
| Processo tolerante a falha na totalidade | CronJob é suficiente |
| Latência < 500ms necessária | Temporal adiciona overhead (~50-200ms) |
| Processo > 10.000 execuções/hora | Escalar Temporal workers separadamente |

---

## Configuração de Namespaces Temporal por Ambiente

### Namespaces

```bash
# Criar namespaces Temporal por ambiente
# (Executar após Temporal estar deployado)

# Namespace de desenvolvimento
temporal namespace create velya-dev \
  --retention 72h \           # 3 dias de retenção
  --description "Velya development environment" \
  --active-cluster local

# Namespace de staging
temporal namespace create velya-staging \
  --retention 168h \          # 7 dias de retenção
  --description "Velya staging environment" \
  --active-cluster eks-staging

# Namespace de produção
temporal namespace create velya-prod \
  --retention 720h \          # 30 dias de retenção
  --description "Velya production environment" \
  --active-cluster eks-prod
```

### Configurações por Namespace

| Config | velya-dev | velya-staging | velya-prod |
|---|---|---|---|
| Retention | 3 dias | 7 dias | 30 dias |
| History shards | 4 | 16 | 64 |
| Worker replicas | 1 | 2 | 3+ (KEDA) |
| Archival | Desabilitado | S3 (disabled) | S3 habilitado |
| Search attributes | Dev set | Staging set | Full set |

### Archival Configuration (Produção)

```yaml
# temporal-server-config.yaml (produção)
archival:
  history:
    state: "enabled"
    enableRead: true
    provider:
      s3store:
        region: us-east-1
        bucket: velya-temporal-archival-prod
        serverSideEncryptionConfiguration:
          type: SSE_S3
  visibility:
    state: "enabled"
    enableRead: true
    provider:
      s3store:
        region: us-east-1
        bucket: velya-temporal-archival-prod
        path: "/visibility"
```

---

## Overlap Policies para Temporal Schedules

Temporal Schedules têm políticas de sobreposição que definem o que fazer quando um schedule dispara mas a execução anterior ainda está rodando.

### Políticas disponíveis

| Política | Comportamento | Uso Velya |
|---|---|---|
| `SKIP` | Pula a nova execução | Reports diários, digests |
| `BUFFER_ONE` | Enfileira UMA execução extra | Discharge orchestration |
| `BUFFER_ALL` | Enfileira todas | Nunca usar em prod |
| `CANCEL_OTHER` | Cancela a anterior, inicia nova | Cost sweeps |
| `TERMINATE_OTHER` | Termina a anterior, inicia nova | Emergência apenas |
| `ALLOW_ALL` | Permite execuções paralelas ilimitadas | NUNCA usar |

### Exemplos por Use Case

```python
# Report diário — SKIP (não acumular reports)
from temporalio.client import ScheduleOverlapPolicy

daily_report_schedule = Schedule(
    action=ScheduleActionStartWorkflow(
        DailyReportWorkflow.run,
        id="daily-report-{scheduled_time}",
        task_queue="reports",
    ),
    spec=ScheduleSpec(
        cron_expressions=["0 6 * * *"],  # 6h da manhã
        timezone="America/Sao_Paulo",
    ),
    policy=SchedulePolicy(
        overlap=ScheduleOverlapPolicy.SKIP,  # Pular se anterior ainda rodando
        catchup_window=timedelta(hours=1),   # Executar atrasado por até 1h
    ),
)

# Cost sweep — CANCEL_OTHER (execução mais recente é mais relevante)
cost_sweep_schedule = Schedule(
    action=ScheduleActionStartWorkflow(
        CostSweepWorkflow.run,
        id="cost-sweep-{scheduled_time}",
        task_queue="platform-ops",
    ),
    spec=ScheduleSpec(
        cron_expressions=["0 2 * * *"],
        timezone="America/Sao_Paulo",
    ),
    policy=SchedulePolicy(
        overlap=ScheduleOverlapPolicy.CANCEL_OTHER,
    ),
)

# Discharge orchestration — BUFFER_ONE (processar mas não acumular)
discharge_polling_schedule = Schedule(
    action=ScheduleActionStartWorkflow(
        DischargeQueuePollerWorkflow.run,
        id="discharge-poller-{scheduled_time}",
        task_queue="discharge-orchestration",
    ),
    spec=ScheduleSpec(
        intervals=[ScheduleIntervalSpec(every=timedelta(minutes=5))],
    ),
    policy=SchedulePolicy(
        overlap=ScheduleOverlapPolicy.BUFFER_ONE,
        catchup_window=timedelta(minutes=30),
    ),
)
```

---

## Retry com Compensation

### Padrão Saga no Temporal

O Temporal usa o padrão Saga para compensation — ao invés de transações distribuídas, cada step tem uma compensation action.

```python
# Implementação de Saga para discharge orchestration
@workflow.defn
class DischargeOrchestrationWorkflow:
    
    def __init__(self):
        self._compensation_actions: list[Callable] = []
    
    @workflow.run
    async def run(self, patient_id: str) -> DischargeResult:
        try:
            # Step 1: Reservar slot de documentação
            doc_reservation = await workflow.execute_activity(
                reserve_documentation_slot,
                args=[patient_id],
                retry_policy=STANDARD_RETRY_POLICY,
                schedule_to_close_timeout=timedelta(minutes=5)
            )
            self._compensation_actions.append(
                lambda: release_documentation_slot(doc_reservation.slot_id)
            )
            
            # Step 2: Gerar resumo de alta (LLM)
            summary = await workflow.execute_activity(
                generate_discharge_summary,
                args=[patient_id],
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=30),
                    maximum_attempts=3,
                    non_retryable_error_types=["PatientDataMissing"]
                ),
                schedule_to_close_timeout=timedelta(minutes=15)
            )
            
            # Step 3: Validar resumo com equipe médica (humano no loop)
            approval = await workflow.execute_activity(
                request_physician_approval,
                args=[patient_id, summary.id],
                schedule_to_close_timeout=timedelta(hours=2),  # Médico tem 2h
                retry_policy=RetryPolicy(maximum_attempts=1)   # Não retry — é humano
            )
            
            if not approval.approved:
                raise ApplicationError(
                    "Resumo rejeitado pelo médico",
                    approval.rejection_reason,
                    non_retryable=True
                )
            
            # Step 4: Notificar família (pode falhar — é best-effort)
            try:
                await workflow.execute_activity(
                    notify_patient_family,
                    args=[patient_id],
                    schedule_to_close_timeout=timedelta(minutes=10),
                    retry_policy=RetryPolicy(maximum_attempts=3)
                )
            except ActivityError:
                # Notificação de família é best-effort — continua mesmo com falha
                workflow.logger.warning(f"Falha ao notificar família do paciente {patient_id}")
            
            # Step 5: Registrar no prontuário (crítico — não pode falhar)
            await workflow.execute_activity(
                record_in_medical_records,
                args=[patient_id, summary.id, approval.physician_id],
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=5),
                    maximum_attempts=20,       # Retry agressivo — é crítico
                    maximum_interval=timedelta(minutes=5)
                ),
                schedule_to_close_timeout=timedelta(hours=1)
            )
            
            # Step 6: Liberar leito
            bed_id = await workflow.execute_activity(
                release_patient_bed,
                args=[patient_id],
                retry_policy=STANDARD_RETRY_POLICY,
                schedule_to_close_timeout=timedelta(minutes=5)
            )
            
            return DischargeResult(
                status="completed",
                patient_id=patient_id,
                summary_id=summary.id,
                bed_id=bed_id
            )
        
        except Exception as e:
            # Executar compensation em ordem reversa
            workflow.logger.error(f"Falha na orquestração de alta: {e}")
            for compensation in reversed(self._compensation_actions):
                try:
                    await workflow.execute_activity(
                        compensation,
                        schedule_to_close_timeout=timedelta(minutes=5)
                    )
                except Exception as comp_error:
                    workflow.logger.error(f"Compensation falhou: {comp_error}")
            raise
```

---

## CronJobs K8s — Quando e Como Usar

### Critérios de Uso

Use CronJob K8s quando:
1. O processo é **stateless** ou estado está em storage externo
2. **Falha na totalidade** é aceitável (re-executa na próxima rodada)
3. O processo tem **1 a 3 steps** sem dependência de estado intermediário
4. A duração é **previsível** (< 30min para a maioria)
5. Não requer **compensation** em caso de falha

### Catálogo de CronJobs Velya

```yaml
# 1. Cost Sweep — Diário 2h
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cost-sweep
  namespace: velya-dev-platform
spec:
  schedule: "0 2 * * *"
  timeZone: "America/Sao_Paulo"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 7200    # Executar até 2h depois do schedule
  successfulJobsHistoryLimit: 7
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 1800
      template:
        spec:
          priorityClassName: velya-batch
          restartPolicy: OnFailure
          serviceAccountName: cost-sweep-sa
          containers:
          - name: cost-sweep
            image: velya/cost-sweep:latest
            resources:
              requests: {cpu: 100m, memory: 128Mi}
              limits: {cpu: 500m, memory: 256Mi}

---
# 2. Health Summary Horário
apiVersion: batch/v1
kind: CronJob
metadata:
  name: health-summary
  namespace: velya-dev-platform
spec:
  schedule: "5 * * * *"          # 5 min após cada hora
  timeZone: "America/Sao_Paulo"
  concurrencyPolicy: Replace      # Se anterior ainda rodar, substituir
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 2
  jobTemplate:
    spec:
      backoffLimit: 1
      activeDeadlineSeconds: 180   # 3 minutos max
      template:
        spec:
          priorityClassName: velya-batch
          restartPolicy: OnFailure
          containers:
          - name: health-summary
            image: velya/health-summary:latest
            env:
            - name: PROMETHEUS_URL
              value: http://prometheus-operated.velya-dev-observability.svc:9090
            - name: OUTPUT_BUCKET
              value: velya-ops-summaries
            resources:
              requests: {cpu: 50m, memory: 64Mi}
              limits: {cpu: 200m, memory: 128Mi}

---
# 3. Quota Check — A cada 30 minutos
apiVersion: batch/v1
kind: CronJob
metadata:
  name: quota-check
  namespace: velya-dev-platform
spec:
  schedule: "*/30 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 2
  failedJobsHistoryLimit: 2
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
            image: velya/quota-check:latest
            resources:
              requests: {cpu: 50m, memory: 64Mi}
              limits: {cpu: 200m, memory: 128Mi}

---
# 4. Database Backup — Diário 3h
apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup
  namespace: velya-dev-platform
spec:
  schedule: "0 3 * * *"
  timeZone: "America/Sao_Paulo"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 3600
  successfulJobsHistoryLimit: 7
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 1             # Backup: não retry agressivo
      activeDeadlineSeconds: 7200 # 2 horas max
      template:
        spec:
          priorityClassName: velya-batch
          restartPolicy: Never    # Backup: se falhou, não retry no mesmo job
          serviceAccountName: backup-sa
          containers:
          - name: backup
            image: velya/db-backup:latest
            env:
            - name: BACKUP_BUCKET
              value: velya-database-backups
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgresql-credentials
                  key: password
            resources:
              requests: {cpu: 200m, memory: 256Mi}
              limits: {cpu: 1000m, memory: 1Gi}
```

---

## Argo Workflows — Quando Usar

### Argo vs CronJob vs Temporal

| Critério | CronJob | Argo Workflow | Temporal |
|---|---|---|---|
| Steps | 1-3 | 3-20 (DAG) | N (ilimitado) |
| Estado entre steps | Não | Artefatos | Sim (full state) |
| Compensation | Não | Sim (onExit) | Sim (nativo) |
| Agendamento | Cron expression | Argo CronWorkflow | Temporal Schedule |
| Visualização | Kubectl/Logs | Argo UI | Temporal UI |
| Escalabilidade | K8s Jobs | Argo executors | Temporal workers |
| Retenção de histórico | 7 jobs | Configurável | Configurável |

### Quando usar Argo Workflows na Velya

- **Analytics pipeline** com múltiplos steps e artefatos intermediários
- **Data transformation** onde cada step tem input/output como arquivos
- **ML training pipeline** (futuro) com steps paralelos
- **Integration test suite** com parallelism e artefatos de resultado

### Argo CronWorkflow: Analytics Pipeline

```yaml
apiVersion: argoproj.io/v1alpha1
kind: CronWorkflow
metadata:
  name: analytics-pipeline
  namespace: velya-dev-platform
spec:
  schedule: "0 4 * * *"           # 4h da manhã
  timezone: "America/Sao_Paulo"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 3600
  successfulJobsHistoryLimit: 7
  failedJobsHistoryLimit: 3
  
  workflowSpec:
    entrypoint: analytics-dag
    
    volumeClaimTemplates:
    - metadata:
        name: workspace
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: gp3
        resources:
          requests:
            storage: 10Gi
    
    templates:
    - name: analytics-dag
      dag:
        tasks:
        # Step 1: Extrair dados (paralelo)
        - name: extract-clinical-data
          template: extract-task
          arguments:
            parameters:
            - name: source
              value: postgresql
            - name: table
              value: clinical_events
        
        - name: extract-operational-data
          template: extract-task
          arguments:
            parameters:
            - name: source
              value: postgresql
            - name: table
              value: operational_metrics
        
        # Step 2: Transformar (após extração)
        - name: transform-data
          template: transform-task
          dependencies: [extract-clinical-data, extract-operational-data]
        
        # Step 3: Carregar (após transformação)
        - name: load-to-s3
          template: load-task
          dependencies: [transform-data]
        
        # Step 4: Gerar relatório (após carga)
        - name: generate-report
          template: report-task
          dependencies: [load-to-s3]
    
    - name: extract-task
      inputs:
        parameters:
        - name: source
        - name: table
      container:
        image: velya/data-extractor:latest
        command: [python, extract.py]
        args:
        - --source={{inputs.parameters.source}}
        - --table={{inputs.parameters.table}}
        - --output=/workspace/{{inputs.parameters.table}}.parquet
        volumeMounts:
        - name: workspace
          mountPath: /workspace
        resources:
          requests: {cpu: 500m, memory: 1Gi}
          limits: {cpu: 2000m, memory: 4Gi}
    
    - name: transform-task
      container:
        image: velya/data-transformer:latest
        command: [python, transform.py]
        args:
        - --input-dir=/workspace
        - --output-dir=/workspace/transformed
        volumeMounts:
        - name: workspace
          mountPath: /workspace
        resources:
          requests: {cpu: 1000m, memory: 2Gi}
          limits: {cpu: 4000m, memory: 8Gi}
    
    - name: load-task
      container:
        image: velya/data-loader:latest
        command: [python, load.py]
        args:
        - --source=/workspace/transformed
        - --bucket=velya-analytics-data
        volumeMounts:
        - name: workspace
          mountPath: /workspace
        resources:
          requests: {cpu: 200m, memory: 512Mi}
```

---

## Temporal Schedules — Configuração Completa

### Schedule via SDK Python

```python
import asyncio
from datetime import timedelta
from temporalio.client import (
    Client,
    Schedule,
    ScheduleActionStartWorkflow,
    ScheduleIntervalSpec,
    ScheduleOverlapPolicy,
    SchedulePolicy,
    ScheduleSpec,
    ScheduleState,
)

async def create_velya_schedules():
    client = await Client.connect(
        "temporal.velya-dev-platform.svc.cluster.local:7233",
        namespace="velya-dev"
    )
    
    # Schedule 1: Daily Report
    await client.create_schedule(
        "daily-report-schedule",
        Schedule(
            action=ScheduleActionStartWorkflow(
                DailyReportWorkflow.run,
                id="daily-report-{scheduled_time}",
                task_queue="reports-task-queue",
                execution_timeout=timedelta(hours=2),
            ),
            spec=ScheduleSpec(
                cron_expressions=["0 6 * * *"],
                timezone="America/Sao_Paulo",
            ),
            policy=SchedulePolicy(
                overlap=ScheduleOverlapPolicy.SKIP,
                catchup_window=timedelta(hours=2),
            ),
            state=ScheduleState(
                note="Relatório diário executivo",
                paused=False,
            ),
        ),
    )
    
    # Schedule 2: Discharge Queue Poller
    await client.create_schedule(
        "discharge-queue-poller",
        Schedule(
            action=ScheduleActionStartWorkflow(
                DischargeQueuePollerWorkflow.run,
                id="discharge-poller-{timestamp}",
                task_queue="discharge-orchestration",
                execution_timeout=timedelta(minutes=15),
            ),
            spec=ScheduleSpec(
                intervals=[ScheduleIntervalSpec(every=timedelta(minutes=5))],
            ),
            policy=SchedulePolicy(
                overlap=ScheduleOverlapPolicy.BUFFER_ONE,
            ),
        ),
    )
    
    # Schedule 3: Market Intelligence (semanal)
    await client.create_schedule(
        "market-intelligence-weekly",
        Schedule(
            action=ScheduleActionStartWorkflow(
                MarketIntelligenceWorkflow.run,
                id="market-intel-{scheduled_time}",
                task_queue="agent-task-queue",
                execution_timeout=timedelta(hours=6),
                args=[MarketIntelligenceScope(
                    regions=["BR"],
                    competitors=True,
                    regulation=True,
                )],
            ),
            spec=ScheduleSpec(
                cron_expressions=["0 8 * * 1"],  # Segunda-feira 8h
                timezone="America/Sao_Paulo",
            ),
            policy=SchedulePolicy(
                overlap=ScheduleOverlapPolicy.SKIP,
                catchup_window=timedelta(days=1),
            ),
        ),
    )

asyncio.run(create_velya_schedules())
```

### Schedule via Temporal CLI

```bash
# Criar schedule de cost sweep
temporal schedule create \
  --schedule-id "cost-sweep-daily" \
  --workflow-type "CostSweepWorkflow" \
  --task-queue "platform-ops" \
  --cron-schedule "0 2 * * *" \
  --timezone "America/Sao_Paulo" \
  --overlap-policy "CancelOther" \
  --catchup-window "2h" \
  --namespace velya-dev

# Listar schedules
temporal schedule list --namespace velya-dev

# Pausar um schedule
temporal schedule toggle \
  --schedule-id "cost-sweep-daily" \
  --pause \
  --reason "Manutenção AWS Cost Explorer" \
  --namespace velya-dev

# Forçar execução imediata
temporal schedule trigger \
  --schedule-id "cost-sweep-daily" \
  --namespace velya-dev

# Atualizar política de overlap
temporal schedule update \
  --schedule-id "daily-report-schedule" \
  --overlap-policy "Skip" \
  --namespace velya-dev
```

---

## Observabilidade de Workflows

### Métricas Temporal no Prometheus

```yaml
# ServiceMonitor para Temporal
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: temporal-metrics
  namespace: velya-dev-observability
spec:
  namespaceSelector:
    matchNames: [velya-dev-platform]
  selector:
    matchLabels:
      app.kubernetes.io/name: temporal
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

### Alertas de Workflow

```yaml
groups:
- name: temporal-workflow-alerts
  rules:
  
  - alert: WorkflowCompletionRateLow
    expr: |
      rate(temporal_workflow_completed_total{
        namespace="velya-dev",
        status="completed"
      }[10m]) /
      rate(temporal_workflow_completed_total{namespace="velya-dev"}[10m]) < 0.95
    for: 15m
    labels:
      severity: warning
    annotations:
      summary: "Taxa de conclusão de workflows abaixo de 95%"
  
  - alert: WorkflowBacklogGrowing
    expr: |
      temporal_workflow_pending_count{namespace="velya-dev"} > 100
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Backlog de workflows crescendo: {{ $value }} pendentes"
  
  - alert: ScheduleNotRunning
    expr: |
      time() - temporal_schedule_last_completion_time{
        namespace="velya-dev"
      } > 86400  # Mais de 24h sem executar
    labels:
      severity: critical
    annotations:
      summary: "Schedule {{ $labels.schedule_id }} não executou em 24h"
```

---

## Guia de Decisão Rápida

```
Preciso automatizar um processo?
│
├─ Tem estado intermediário que precisa sobreviver a crash?
│  └─ SIM → TEMPORAL WORKFLOW
│
├─ É agendado E tem estado intermediário?
│  └─ SIM → TEMPORAL SCHEDULE
│
├─ É agendado E tem DAG complexo com artefatos?
│  └─ SIM → ARGO CRONWORKFLOW
│
├─ É agendado E é simples (1-3 steps, stateless)?
│  └─ SIM → CRONJOB K8s
│
└─ É event-driven (fila, mensagem)?
   ├─ Sem estado entre steps → KEDA + Worker stateless
   └─ Com estado entre steps → TEMPORAL WORKFLOW (com signal ou query)
```

---

*Revisado sempre que um novo processo durável é adicionado à plataforma Velya.*
