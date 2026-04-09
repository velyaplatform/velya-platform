# Modelo de Filas, Leases e DLQ — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Namespace de mensageria:** velya-dev-platform (NATS JetStream)  
**Namespace de agents:** velya-dev-agents  
**Última revisão:** 2026-04-08

---

## 1. Princípios Fundamentais

O modelo de filas, leases e DLQ da Velya é construído sobre quatro princípios inegociáveis:

**P1 — Toda mensagem tem um owner:** Cada mensagem em qualquer fila deve ter um consumer group definido. Mensagens sem owner conhecido vão automaticamente para a DLQ de `no-owner`.

**P2 — Toda DLQ tem um owner humano/office:** A Dead Letter Queue não é o fim. É uma fila especial com owner obrigatório e SLA de investigação. DLQ sem owner é incidente de Severity 2.

**P3 — Nenhuma mensagem é perdida silenciosamente:** Toda mensagem que falha é rastreável: onde começou, quantas tentativas, qual erro, quando entrou na DLQ, quem é o owner responsável.

**P4 — Leases previnem processamento duplicado:** Antes de processar qualquer tarefa, o worker adquire um lease com TTL. Sem lease, não processa. Com lease expirado, outro worker pode assumir.

---

## 2. NATS JetStream como Backbone

### 2.1 Por que NATS JetStream

A Velya escolheu NATS JetStream como backbone de mensageria por:

| Critério               | NATS JetStream                       | Alternativas rejeitadas                         |
| ---------------------- | ------------------------------------ | ----------------------------------------------- |
| Custo                  | OSS gratuito                         | AWS SQS ($0.40/million), Kafka (infra complexa) |
| Operação em K8s        | StatefulSet simples, baixo footprint | Kafka: ZooKeeper + Brokers complexos            |
| At-least-once delivery | Nativo com ack explícito             | SQS: suportado mas vendor lock-in               |
| Pull consumers         | Nativo — ideal para KEDA             | RabbitMQ: push por default                      |
| Replay de mensagens    | Nativo (seek by time/sequence)       | SQS: não suportado                              |
| Multi-tenancy          | Accounts + JetStream por account     | Kafka: topics complexos                         |
| Latência               | Sub-milissegundo                     | Kafka: ~5ms+ para casos simples                 |

### 2.2 Deployment no Cluster

```yaml
# NATS JetStream — StatefulSet no namespace velya-dev-platform
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: nats
  namespace: velya-dev-platform
spec:
  serviceName: nats
  replicas: 1 # kind local: 1 réplica. EKS: 3 réplicas
  selector:
    matchLabels:
      app: nats
  template:
    metadata:
      labels:
        app: nats
        velya.io/component: messaging
    spec:
      containers:
        - name: nats
          image: nats:2.10-alpine
          ports:
            - containerPort: 4222 # Client
            - containerPort: 8222 # Monitoring HTTP
            - containerPort: 6222 # Cluster (para futuro clustering)
          args:
            - '--config'
            - '/etc/nats/nats.conf'
          volumeMounts:
            - name: config
              mountPath: /etc/nats
            - name: data
              mountPath: /data/nats
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 1Gi
      volumes:
        - name: config
          configMap:
            name: nats-config
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ['ReadWriteOnce']
        resources:
          requests:
            storage: 20Gi
---
# ConfigMap com configuração NATS
apiVersion: v1
kind: ConfigMap
metadata:
  name: nats-config
  namespace: velya-dev-platform
data:
  nats.conf: |
    port: 4222
    http_port: 8222

    jetstream {
      store_dir: /data/nats
      max_memory_store: 512MB
      max_file_store: 18GB
    }

    accounts {
      velya {
        users: [
          {
            user: velya-agent
            password: $NATS_AGENT_PASSWORD
          }
          {
            user: velya-monitor
            password: $NATS_MONITOR_PASSWORD
          }
        ]
        jetstream: enabled
        limits {
          max_streams: 50
          max_consumers: 200
          max_mem: 512MB
          max_file: 16GB
          max_msg_size: 1MB
        }
      }
    }
```

---

## 3. Estrutura de Subjects

### 3.1 Hierarquia Canônica

```
velya.{domínio}.{office}.{task-type}[.{subtipo}]

Domínios:
  agents     → trabalho de agents
  events     → eventos de domínio do hospital
  reports    → relatórios gerados
  audit      → trilha de auditoria
  dlq        → dead letter queue

Offices (mapeamento):
  clinical-ops     → Clinical Operations Office
  platform         → Platform Health Office
  finops           → Cost Governance Office
  governance       → Validation + Audit Office
  factory          → Agent Factory Office
  watchdog         → Watchdog Office
  learning         → Learning Office
  intelligence     → Market Intelligence Office
```

### 3.2 Subjects por Office

```
velya.agents.clinical-ops.task-classification
velya.agents.clinical-ops.task-classification.result
velya.agents.clinical-ops.discharge-trigger
velya.agents.clinical-ops.discharge-trigger.step-completed
velya.agents.clinical-ops.patient-flow-update
velya.agents.clinical-ops.escalation-required

velya.agents.platform.health-check-result
velya.agents.platform.resource-alert
velya.agents.platform.pod-anomaly

velya.agents.finops.cost-alert
velya.agents.finops.budget-breach
velya.agents.finops.sweep-result

velya.agents.governance.validation-required
velya.agents.governance.validation-result
velya.agents.governance.audit-required
velya.agents.governance.audit-result

velya.agents.watchdog.anomaly-detected
velya.agents.watchdog.agent-paused
velya.agents.watchdog.quarantine-triggered

velya.agents.handoff.{source}.{target}    # Handoffs entre agents

velya.agents.dlq.validation-failed
velya.agents.dlq.max-retries-exceeded
velya.agents.dlq.tool-schema-violation
velya.agents.dlq.no-owner
velya.agents.dlq.timeout
velya.agents.dlq.permanent-error
```

### 3.3 Streams por Domínio

```yaml
# Stream VELYA_AGENTS: workload de agents
stream: VELYA_AGENTS
subjects: ["velya.agents.>"]
retention: limits
max_age: 72h
max_msgs: 1_000_000
max_bytes: 10GB
storage: file
replicas: 1

# Stream VELYA_DLQ: mensagens com falha
stream: VELYA_DLQ
subjects: ["velya.agents.dlq.>"]
retention: limits
max_age: 720h          # 30 dias
max_msgs: 100_000
max_bytes: 1GB
storage: file
replicas: 1

# Stream VELYA_EVENTS: eventos de domínio
stream: VELYA_EVENTS
subjects: ["velya.events.>"]
retention: limits
max_age: 24h
max_msgs: 500_000
max_bytes: 5GB
storage: file

# Stream VELYA_AUDIT: trilha imutável de auditoria
stream: VELYA_AUDIT
subjects: ["velya.audit.>"]
retention: limits
max_age: 8760h         # 1 ano
max_msgs: 10_000_000
max_bytes: 100GB
storage: file
# IMPORTANTE: deny_delete e deny_purge protegem a trilha
deny_delete: true
deny_purge: true
```

---

## 4. Modelo de Lease

### 4.1 Conceito de Lease

Um lease é uma reserva de processamento com tempo de vida (TTL). Antes de começar a processar qualquer tarefa de fila, o worker deve adquirir um lease. O lease garante que:

- Apenas um worker processa a tarefa por vez
- Se o worker falhar, o lease expira e outro worker pode assumir
- A mensagem NATS não recebe ack até o processamento ser concluído

### 4.2 Schema do Lease

```json
{
  "lease_id": "lease-uuid-v4",
  "task_id": "task-uuid",
  "subject": "velya.agents.clinical-ops.task-classification",
  "owner": "task-inbox-worker-7f8d9c-abc12",
  "owner_pod": "task-inbox-worker-7f8d9c-abc12",
  "owner_node": "velya-local-worker",
  "acquired_at": "2026-04-08T14:23:01.123Z",
  "expires_at": "2026-04-08T14:28:01.123Z",
  "ttl_seconds": 300,
  "retry_count": 0,
  "max_retries": 5,
  "last_heartbeat": "2026-04-08T14:23:31.123Z",
  "heartbeat_interval_seconds": 30,
  "task_type": "task-classification",
  "priority": "high",
  "created_by_workflow": null,
  "parent_task_id": null
}
```

### 4.3 Armazenamento de Leases

Os leases são armazenados no NATS Key-Value Store (KV bucket):

```yaml
# KV Bucket para leases
bucket: VELYA_LEASES
ttl: 600s # TTL máximo de qualquer lease
storage: memory # Leases em memória para baixa latência
history: 1 # Apenas versão atual
replicas: 1
```

### 4.4 Ciclo de Vida do Lease

```
Worker recebe mensagem da fila NATS (pull consumer)
              │
              ▼
  Tenta adquirir lease no KV VELYA_LEASES
  (chave: task_id, valor: lease JSON, TTL: task TTL)
              │
       ┌──────┴──────┐
    SUCESSO        FALHA (lease já existe)
       │                    │
       ▼                    ▼
  Processa task       Nack sem delay
  (com heartbeat)     (outro worker assumiu)
       │
       ├── Sucesso: ack mensagem NATS, delete lease
       │
       └── Falha:
              │
              ├── Erro transiente (retry_count < max_retries):
              │   Incrementa retry_count no lease
              │   Nack com delay = backoff(retry_count)
              │   Libera lease (permite reprocessamento)
              │
              └── Erro permanente ou max_retries atingido:
                  Envia para DLQ com metadados de falha
                  Ack mensagem original (para não reprocessar)
                  Delete lease
```

### 4.5 Renovação de Lease (Heartbeat)

Para tarefas longas, o worker renova o lease a cada `heartbeat_interval_seconds`:

```python
async def process_with_lease_renewal(task: Task, lease: Lease):
    while not task.is_complete():
        # Processar próximo chunk
        result = await process_chunk(task)

        # Renovar lease antes de expirar
        if lease.seconds_until_expiry() < 60:
            await renew_lease(lease, extend_ttl_seconds=300)

        await asyncio.sleep(lease.heartbeat_interval_seconds)

    # Tarefa concluída: ack e delete lease
    await nats_msg.ack()
    await delete_lease(lease.lease_id)
```

---

## 5. Modelo de DLQ

### 5.1 Tipos de DLQ e Owners

| DLQ Subject                              | Tipo de Falha                     | Owner (Office)             | SLA de Investigação |
| ---------------------------------------- | --------------------------------- | -------------------------- | ------------------- |
| `velya.agents.dlq.validation-failed`     | Output não passou no validator    | Validation Office          | 4 horas             |
| `velya.agents.dlq.max-retries-exceeded`  | Máximo de retries atingido        | Office do agent que falhou | 2 horas             |
| `velya.agents.dlq.tool-schema-violation` | Tool retornou schema inválido     | Architecture Review Office | 8 horas             |
| `velya.agents.dlq.no-owner`              | Mensagem sem consumer group       | Platform Health Office     | 1 hora              |
| `velya.agents.dlq.timeout`               | TTL de processamento expirado     | Office do agent que falhou | 4 horas             |
| `velya.agents.dlq.permanent-error`       | Erro classificado como permanente | Architecture Review Office | 24 horas            |
| `velya.agents.dlq.clinical-escalation`   | Requer revisão clínica humana     | Clinical Operations Office | 30 minutos          |

### 5.2 Schema de Mensagem na DLQ

```json
{
  "dlq_metadata": {
    "dlq_id": "dlq-uuid-v4",
    "dlq_type": "max-retries-exceeded",
    "dlq_subject": "velya.agents.dlq.max-retries-exceeded",
    "enqueued_at": "2026-04-08T15:00:00.123Z",
    "owner_office": "clinical-operations",
    "sla_deadline": "2026-04-08T17:00:00.123Z",
    "investigation_status": "pending",
    "assigned_to": null
  },
  "original_message": {
    "subject": "velya.agents.clinical-ops.task-classification",
    "stream_sequence": 12345,
    "published_at": "2026-04-08T14:00:00.123Z",
    "payload": { ... }
  },
  "failure_history": [
    {
      "attempt": 1,
      "attempted_at": "2026-04-08T14:00:05.000Z",
      "worker": "task-inbox-worker-abc123",
      "error_type": "ToolTimeoutError",
      "error_message": "get_patient_context timeout after 10s",
      "stack_trace_hash": "sha256:abc..."
    },
    {
      "attempt": 2,
      "attempted_at": "2026-04-08T14:01:35.000Z",
      "worker": "task-inbox-worker-def456",
      "error_type": "ToolTimeoutError",
      "error_message": "get_patient_context timeout after 10s",
      "stack_trace_hash": "sha256:abc..."
    }
  ],
  "classification": {
    "error_category": "transient-infrastructure",
    "likely_cause": "patient-flow-service degradado",
    "recommended_action": "verificar health de patient-flow-service antes de retry",
    "auto_retry_eligible": true,
    "auto_retry_after": "2026-04-08T16:00:00.000Z"
  }
}
```

### 5.3 Alerta de DLQ sem Owner

```yaml
# AlertManager rule para DLQ sem owner
- alert: DLQNoOwner
  expr: |
    velya_dlq_messages_total{type="no-owner"} > 0
  for: 5m
  labels:
    severity: critical
    team: platform-health
  annotations:
    summary: 'DLQ no-owner contém mensagens há mais de 5 minutos'
    description: 'Mensagens em velya.agents.dlq.no-owner: {{ $value }}. Investigar imediatamente.'
    runbook: 'https://velya-docs/runbooks/dlq-no-owner'

- alert: DLQSLABreach
  expr: |
    (time() - velya_dlq_oldest_message_timestamp) > velya_dlq_sla_seconds
  for: 0m
  labels:
    severity: warning
  annotations:
    summary: 'SLA de investigação de DLQ violado'
```

### 5.4 Workflow de Resolução de DLQ

```
Mensagem entra na DLQ
         │
         ▼ (automático, imediato)
DLQ Watchdog classifica o tipo de falha
         │
         ├── Falha transiente de infra (ex: timeout de dependência)
         │        │
         │        ▼ (após condição de infra recuperar)
         │   Auto-retry elegível: republica na fila original
         │
         ├── Falha de schema de tool
         │        │
         │        ▼
         │   Abre issue automático para Architecture Review Office
         │   Aguarda fix de tool antes de retry
         │
         ├── Falha de validação clínica
         │        │
         │        ▼ (SLA: 30 minutos)
         │   Notifica Clinical Operations Office
         │   Human review obrigatório antes de reprocessar
         │
         └── Falha de erro permanente
                  │
                  ▼
             Notifica Architecture Review Office
             Investigação manual obrigatória
             Sem auto-retry
```

---

## 6. Políticas de Retry por Tipo de Fila

### 6.1 Tabela de Retry Policy por Subject

| Subject Pattern                      | Max Retries | Backoff Inicial | Backoff Máx | DLQ após |
| ------------------------------------ | ----------- | --------------- | ----------- | -------- |
| `*.clinical-ops.task-classification` | 5           | 10s             | 5min        | retry 5  |
| `*.clinical-ops.discharge-trigger`   | 3           | 30s             | 10min       | retry 3  |
| `*.clinical-ops.escalation-required` | 2           | 5s              | 1min        | retry 2  |
| `*.platform.health-check-result`     | 10          | 5s              | 2min        | retry 10 |
| `*.governance.validation-required`   | 5           | 10s             | 5min        | retry 5  |
| `*.watchdog.anomaly-detected`        | 3           | 10s             | 3min        | retry 3  |
| `*.finops.cost-alert`                | 5           | 30s             | 10min       | retry 5  |

### 6.2 Fórmula de Backoff

```python
def calculate_backoff(attempt: int, base_seconds: int, max_seconds: int) -> float:
    """
    Backoff exponencial com jitter completo.

    attempt: número da tentativa atual (0-indexed)
    base_seconds: intervalo base (ex: 10)
    max_seconds: intervalo máximo (ex: 300)

    Fórmula: min(base * 2^attempt, max) + random(0, base)
    """
    import random
    exponential = base_seconds * (2 ** attempt)
    capped = min(exponential, max_seconds)
    jitter = random.uniform(0, base_seconds)
    return capped + jitter

# Exemplos para task-classification (base=10, max=300):
# attempt 0: ~10-20s
# attempt 1: ~20-30s
# attempt 2: ~40-50s
# attempt 3: ~80-90s
# attempt 4: ~160-170s
# attempt 5: → DLQ (não retenta mais)
```

---

## 7. Monitoramento de Filas

### 7.1 Métricas NATS expostas para Prometheus

O NATS JetStream expõe métricas via endpoint de monitoramento em `:8222`. O Prometheus scrape via ServiceMonitor:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: nats-monitor
  namespace: velya-dev-observability
spec:
  selector:
    matchLabels:
      app: nats
  namespaceSelector:
    matchNames:
      - velya-dev-platform
  endpoints:
    - port: monitoring
      path: /metrics
      interval: 15s
```

### 7.2 Alertas de Fila

```yaml
groups:
  - name: velya.queue.alerts
    interval: 30s
    rules:
      - alert: QueueDepthHigh
        expr: |
          nats_consumer_num_pending{stream="VELYA_AGENTS"} > 50
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Fila NATS com >50 mensagens pendentes por 5 minutos'
          description: 'Consumer {{ $labels.consumer_name }} com lag {{ $value }}'

      - alert: QueueDepthCritical
        expr: |
          nats_consumer_num_pending{stream="VELYA_AGENTS"} > 200
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'Fila NATS crítica: >200 mensagens pendentes'

      - alert: DLQGrowthRate
        expr: |
          rate(nats_stream_total_messages{stream="VELYA_DLQ"}[10m]) > 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'DLQ crescendo mais de 3 mensagens por minuto'

      - alert: DLQAccumulationCritical
        expr: |
          nats_stream_total_messages{stream="VELYA_DLQ"} > 1000
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: 'DLQ acumulou mais de 1000 mensagens — investigação urgente'

      - alert: NoConsumerActivity
        expr: |
          increase(nats_consumer_num_ack_pending[15m]) == 0 AND
          nats_consumer_num_pending > 10
        for: 15m
        labels:
          severity: critical
        annotations:
          summary: 'Fila com mensagens mas sem consumer ativo por 15 minutos'
```

---

## 8. Operações de DLQ

### 8.1 Inspecionar DLQ via NATS CLI

```bash
# Listar mensagens na DLQ de max-retries (sem consumi-las)
nats consumer info VELYA_DLQ dlq-max-retries-consumer --server nats://nats.velya-dev-platform.svc:4222

# Ver conteúdo da primeira mensagem na DLQ
nats consumer next VELYA_DLQ dlq-max-retries-consumer --count 1

# Contar mensagens por tipo de DLQ
nats stream info VELYA_DLQ --json | jq '.state.messages'

# Ver mensagens mais antigas na DLQ (para SLA check)
nats stream get VELYA_DLQ --first --json
```

### 8.2 Reprocessar Mensagens da DLQ

```bash
# Script de reprocessamento controlado de DLQ
#!/bin/bash
# reprocess-dlq.sh - REQUER aprovação do office owner antes de executar

DLQ_SUBJECT=$1   # ex: velya.agents.dlq.max-retries-exceeded
TARGET_SUBJECT=$2 # ex: velya.agents.clinical-ops.task-classification
MAX_MESSAGES=${3:-10}  # Máximo 10 mensagens por execução

echo "Reprocessando até $MAX_MESSAGES mensagens de $DLQ_SUBJECT para $TARGET_SUBJECT"

# Validar que o serviço downstream está saudável antes de reprocessar
HEALTH=$(curl -s http://patient-flow-service.velya-dev-core.svc/health | jq -r '.status')
if [ "$HEALTH" != "healthy" ]; then
  echo "ERRO: downstream não está saudável. Abortando reprocessamento."
  exit 1
fi

# Consumir e redirecionar
nats consumer next VELYA_DLQ dlq-consumer --count $MAX_MESSAGES --json | \
  while read msg; do
    payload=$(echo $msg | jq '.data | @base64d')
    nats pub $TARGET_SUBJECT "$payload"
    echo "Reprocessado: $(echo $msg | jq -r '.headers["Nats-Sequence"]')"
  done
```

### 8.3 Checklist de Investigação de DLQ

Para cada item em DLQ, o owner do office deve verificar:

- [ ] Qual é o erro específico? (campo `failure_history[-1].error_message`)
- [ ] O erro é transiente ou permanente?
- [ ] A condição que causou o erro foi resolvida?
- [ ] Outros agents do mesmo office também estão falhando?
- [ ] O serviço downstream está saudável?
- [ ] O retry manual é seguro (idempotência garantida)?
- [ ] Há risco clínico em reprocessar (dados de paciente envolvidos)?
- [ ] O post-mortem foi registrado no Knowledge Office?
