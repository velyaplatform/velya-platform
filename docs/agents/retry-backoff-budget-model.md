# Modelo de Retry, Backoff, Budget e DLQ — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Namespace:** velya-dev-agents  
**Última revisão:** 2026-04-08

---

## 1. Princípios Inegociáveis

Antes de qualquer configuração técnica, estes princípios devem ser respeitados sem exceção:

**R1 — Nunca retry infinito:** Todo retry tem um limite máximo. Após esse limite, a mensagem vai para a DLQ com owner definido.

**R2 — Nunca backoff ausente:** Entre cada retry, sempre há uma pausa com crescimento exponencial. Retry imediato repetido é proibido (causa retry storms e sobrecarrega serviços).

**R3 — Nunca DLQ sem owner:** Toda DLQ tem um office responsável com SLA de investigação. DLQ sem owner é incidente de Severity 2.

**R4 — Nunca retry sobre erro permanente:** Erros classificados como permanentes (schema inválido, cliente não encontrado, permissão negada) não são retentados. Vão direto para DLQ.

**R5 — Budget de retry por office:** Cada office tem um budget de retries por hora. Se o budget for consumido, novos retries são bloqueados e o incidente é escalado para investigação.

---

## 2. Classificação de Erros

### 2.1 Erros Transientes (Retry Permitido)

Erros causados por condições temporárias que podem se resolver sem intervenção:

| Código/Tipo               | Descrição                                       | Retry? | Backoff                      |
| ------------------------- | ----------------------------------------------- | ------ | ---------------------------- |
| `network_timeout`         | Timeout de rede para tool ou serviço            | Sim    | Exponencial                  |
| `service_unavailable_503` | Serviço downstream temporariamente indisponível | Sim    | Exponencial + jitter         |
| `rate_limit_429`          | Rate limit de API (LLM, externa)                | Sim    | Exponencial com floor de 60s |
| `lock_contention`         | Lease já adquirido por outro worker             | Sim    | Linear curto (5-10s)         |
| `temporary_db_error`      | Erro temporário de banco de dados               | Sim    | Exponencial                  |
| `nats_connection_reset`   | Conexão NATS resetada                           | Sim    | Exponencial                  |
| `llm_api_overload`        | LLM API sobrecarregada (não rate limit)         | Sim    | Exponencial com floor de 30s |

### 2.2 Erros Permanentes (Sem Retry, DLQ Direto)

Erros que indicam problema estrutural que não se resolve com retry:

| Código/Tipo                | Descrição                         | Retry? | Ação                        |
| -------------------------- | --------------------------------- | ------ | --------------------------- |
| `schema_validation_error`  | Schema de input inválido          | Não    | DLQ + Architecture Review   |
| `patient_not_found`        | Entidade não existe no sistema    | Não    | DLQ + Clinical Ops          |
| `permission_denied`        | Sem permissão para operação       | Não    | DLQ + Security              |
| `invalid_state_transition` | Transição de estado inválida      | Não    | DLQ + investigação          |
| `clinical_rule_violation`  | Violação de regra clínica crítica | Não    | DLQ + Human Review imediato |
| `budget_exceeded`          | Budget do office excedido         | Não    | DLQ + FinOps                |
| `tool_schema_violation`    | Tool retornou schema incompatível | Não    | DLQ + Architecture Review   |

### 2.3 Erros de Qualidade (Retry com Condição)

Erros que indicam qualidade insuficiente mas podem ser retentados com contexto diferente:

| Código/Tipo         | Descrição                          | Retry?   | Condição                  |
| ------------------- | ---------------------------------- | -------- | ------------------------- |
| `low_confidence`    | Confidence < threshold configurado | Sim (1x) | Com contexto adicional    |
| `validation_failed` | Output não passou no validator     | Sim (1x) | Com prompt revisado       |
| `incomplete_output` | Output incompleto ou truncado      | Sim (2x) | Com token limit aumentado |

---

## 3. Fórmulas de Backoff

### 3.1 Backoff Exponencial com Jitter Completo (Full Jitter)

Esta é a fórmula padrão para a maioria dos erros transientes na Velya:

```python
import random
import math

def calculate_backoff_full_jitter(
    attempt: int,           # 0-indexed (0 = primeira tentativa)
    base_delay_seconds: float,   # Delay base (ex: 5.0)
    max_delay_seconds: float,    # Delay máximo (ex: 300.0)
    multiplier: float = 2.0      # Fator de crescimento (default: 2x)
) -> float:
    """
    Full Jitter Backoff: randomiza entre 0 e o valor exponencial.
    Melhor para distribuição de carga entre múltiplos workers.

    Fórmula: random(0, min(max, base * multiplier^attempt))

    Exemplos (base=5, max=300, multiplier=2):
    attempt 0: 0-5s
    attempt 1: 0-10s
    attempt 2: 0-20s
    attempt 3: 0-40s
    attempt 4: 0-80s
    attempt 5: 0-160s
    attempt 6: 0-300s (capped)
    """
    exponential = base_delay_seconds * (multiplier ** attempt)
    capped = min(exponential, max_delay_seconds)
    return random.uniform(0, capped)
```

### 3.2 Backoff Exponencial com Jitter Decorrelacionado

Para casos onde múltiplos workers falham simultaneamente (ex: crash de serviço downstream):

```python
def calculate_backoff_decorrelated(
    attempt: int,
    base_delay_seconds: float,
    max_delay_seconds: float,
    prev_delay: float = None
) -> float:
    """
    Decorrelated Jitter: ainda mais agressivo na distribuição.
    prev_delay = delay da tentativa anterior (ou base se primeira)

    Fórmula: random(base, min(max, prev * 3))
    """
    if prev_delay is None:
        prev_delay = base_delay_seconds

    delay = random.uniform(base_delay_seconds, min(max_delay_seconds, prev_delay * 3))
    return delay
```

### 3.3 Backoff para Rate Limit (429)

Para erros de rate limit, o backoff deve respeitar o header `Retry-After` se disponível:

```python
def calculate_backoff_rate_limit(
    retry_after_header: str = None,
    attempt: int = 0,
    base_delay_seconds: float = 60.0,
    max_delay_seconds: float = 600.0
) -> float:
    """
    Se a API retornar Retry-After header, usar esse valor.
    Caso contrário, usar backoff exponencial com floor de 60s.
    """
    if retry_after_header:
        try:
            return float(retry_after_header) + random.uniform(1, 5)  # +jitter pequeno
        except ValueError:
            pass  # Header inválido, usar default

    exponential = base_delay_seconds * (2 ** attempt)
    capped = min(exponential, max_delay_seconds)
    return capped + random.uniform(0, 10)  # +jitter pequeno
```

---

## 4. Max Retries por Classe de Task

### 4.1 Tabela de Configuração

| Subject / Task Type                | Max Retries | Backoff Base | Backoff Max | DLQ Owner           |
| ---------------------------------- | ----------- | ------------ | ----------- | ------------------- |
| `clinical-ops.task-classification` | 5           | 10s          | 5min        | clinical-operations |
| `clinical-ops.discharge-trigger`   | 3           | 30s          | 10min       | clinical-operations |
| `clinical-ops.escalation-required` | 2           | 5s           | 1min        | clinical-operations |
| `clinical-ops.patient-flow-update` | 5           | 15s          | 5min        | clinical-operations |
| `governance.validation-required`   | 5           | 10s          | 5min        | validation-office   |
| `governance.audit-required`        | 10          | 5s           | 2min        | audit-office        |
| `platform.health-check-result`     | 10          | 5s           | 2min        | platform-health     |
| `finops.cost-alert`                | 5           | 30s          | 10min       | finops-office       |
| `finops.budget-breach`             | 3           | 10s          | 3min        | finops-office       |
| `watchdog.anomaly-detected`        | 3           | 10s          | 3min        | watchdog-office     |
| `learning.learning-event`          | 5           | 60s          | 10min       | learning-office     |
| `intelligence.weekly-report`       | 2           | 300s         | 30min       | intelligence-office |

### 4.2 Configuração via NATS Consumer

```yaml
# Configuração de retry no consumer NATS
consumers:
  - name: task-classification-consumer
    stream: VELYA_AGENTS
    filter_subject: 'velya.agents.clinical-ops.task-classification'
    ack_wait: 300s # TTL máximo para processar e dar ack
    max_deliver: 6 # max_retries + 1 (inclui primeira tentativa)
    # Após max_deliver sem ack: NATS entrega na DLQ configurada
```

---

## 5. Budget de Retry por Office

### 5.1 Conceito de Budget

O budget de retry é um limite de quantas tentativas de retry um office pode fazer por hora, independentemente de quantos agents estão em execução. Isso previne que um problema sistêmico consuma recursos indefinidamente.

### 5.2 Configuração de Budget por Office

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: retry-budgets
  namespace: velya-dev-agents
data:
  # Formato: {office_name}: {max_retries_per_hour}
  clinical-operations: '500'
  platform-health: '1000'
  finops-office: '200'
  validation-office: '300'
  audit-office: '500'
  watchdog-office: '200'
  learning-office: '100'
  intelligence-office: '50'

  # Budget de alerta (% do budget total que dispara aviso)
  alert_threshold_percent: '80'

  # Budget de bloqueio (% do budget total que bloqueia novos retries)
  block_threshold_percent: '100'
```

### 5.3 Implementação do Budget de Retry

```python
class RetryBudgetManager:
    """
    Gerencia o budget de retries por office.
    Usa Redis/NATS KV para contagem atômica.
    """

    def __init__(self, kv_bucket: str = "VELYA_RETRY_BUDGETS"):
        self.kv_bucket = kv_bucket
        self.budgets = self._load_budgets()

    async def can_retry(self, office: str) -> tuple[bool, str]:
        """
        Verifica se o office ainda tem budget para retry.
        Retorna (can_retry: bool, reason: str)
        """
        key = f"{office}.retries.{self._current_hour_key()}"
        current_count = await self.kv.get_int(key) or 0
        max_budget = self.budgets.get(office, 100)

        if current_count >= max_budget:
            return False, f"Budget de retry esgotado para {office}: {current_count}/{max_budget}"

        if current_count >= max_budget * 0.80:
            await self.emit_budget_warning(office, current_count, max_budget)

        return True, "ok"

    async def record_retry(self, office: str):
        """Incrementa o contador de retries do office."""
        key = f"{office}.retries.{self._current_hour_key()}"
        await self.kv.increment(key, ttl=3600)  # Expira em 1 hora

    def _current_hour_key(self) -> str:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        return f"{now.year}{now.month:02d}{now.day:02d}{now.hour:02d}"

    async def emit_budget_warning(self, office: str, current: int, max_budget: int):
        await self.nats.publish(
            f"velya.agents.finops.retry-budget-warning",
            json.dumps({
                "office": office,
                "current_count": current,
                "max_budget": max_budget,
                "utilization_percent": (current / max_budget) * 100,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }).encode()
        )
```

---

## 6. DLQ Threshold e Alertas

### 6.1 Thresholds por Tipo de DLQ

| DLQ Type                | Warning Threshold | Critical Threshold | Escalação automática  |
| ----------------------- | ----------------- | ------------------ | --------------------- |
| `validation-failed`     | 10 msgs           | 50 msgs            | Validation Office     |
| `max-retries-exceeded`  | 20 msgs           | 100 msgs           | Office do agent       |
| `tool-schema-violation` | 5 msgs            | 20 msgs            | Architecture Review   |
| `no-owner`              | 1 msg             | 5 msgs             | Platform Health       |
| `timeout`               | 15 msgs           | 75 msgs            | Office do agent       |
| `permanent-error`       | 5 msgs            | 25 msgs            | Architecture Review   |
| `clinical-escalation`   | 1 msg             | 3 msgs             | Clinical Ops IMEDIATO |

### 6.2 Alertas Prometheus para DLQ

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-retry-dlq-alerts
  namespace: velya-dev-observability
spec:
  groups:
    - name: velya.retry.budget
      interval: 1m
      rules:
        - alert: RetryBudgetNearExhaustion
          expr: |
            velya_retry_budget_utilization_percent > 80
          for: 5m
          labels:
            severity: warning
            team: finops
          annotations:
            summary: 'Office {{ $labels.office }} consumiu {{ $value }}% do budget de retries'

        - alert: RetryBudgetExhausted
          expr: |
            velya_retry_budget_utilization_percent >= 100
          for: 0m
          labels:
            severity: critical
          annotations:
            summary: 'Budget de retry esgotado para {{ $labels.office }}'
            description: 'Novos retries bloqueados. Investigar causa raiz imediatamente.'

    - name: velya.dlq.thresholds
      interval: 1m
      rules:
        - alert: DLQClinicalEscalation
          expr: |
            nats_consumer_num_pending{consumer="dlq-clinical-escalation"} > 0
          for: 0m
          labels:
            severity: critical
            page: 'true'
            team: clinical-ops
          annotations:
            summary: 'DLQ de escalação clínica contém mensagens — ação imediata necessária'

        - alert: DLQMaxRetriesHigh
          expr: |
            nats_consumer_num_pending{consumer="dlq-max-retries"} > 100
          for: 10m
          labels:
            severity: critical
          annotations:
            summary: 'DLQ max-retries acumulou {{ $value }} mensagens em 10 minutos'

        - alert: DLQNoOwnerPresent
          expr: |
            nats_consumer_num_pending{consumer="dlq-no-owner"} > 0
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: 'Mensagens na DLQ sem owner — incidente S2 automático'
```

---

## 7. Configuração de Retry no Temporal

Para workflows Temporal, as políticas de retry são configuradas por Activity:

```go
// Política de retry para Activities clínicas críticas
clinicalCriticalRetryPolicy := &temporal.RetryPolicy{
    InitialInterval:        30 * time.Second,
    BackoffCoefficient:     2.0,
    MaximumInterval:        10 * time.Minute,
    MaximumAttempts:        3,
    NonRetryableErrorTypes: []string{
        "SchemaValidationError",
        "PatientNotFoundError",
        "ClinicalRuleViolationError",
        "PermissionDeniedError",
        "InvalidStateTransitionError",
    },
}

// Política de retry para Activities de plataforma
platformRetryPolicy := &temporal.RetryPolicy{
    InitialInterval:        5 * time.Second,
    BackoffCoefficient:     2.0,
    MaximumInterval:        2 * time.Minute,
    MaximumAttempts:        10,
    NonRetryableErrorTypes: []string{
        "PermanentError",
    },
}

// Política para Activities de auditoria (mais leniente)
auditRetryPolicy := &temporal.RetryPolicy{
    InitialInterval:    5 * time.Second,
    BackoffCoefficient: 1.5,
    MaximumInterval:    1 * time.Minute,
    MaximumAttempts:    15,
}
```

---

## 8. Anti-Padrões Documentados e Proibidos

### 8.1 Retry Imediato Repetido

**Proibido:**

```python
# ERRADO: retry imediato sem backoff
for attempt in range(max_retries):
    try:
        result = call_service()
        break
    except Exception:
        continue  # Retry imediato!
```

**Correto:**

```python
for attempt in range(max_retries):
    try:
        result = call_service()
        break
    except TransientError:
        delay = calculate_backoff_full_jitter(attempt, base=5, max_seconds=300)
        await asyncio.sleep(delay)
    except PermanentError:
        await send_to_dlq(message, error)
        break  # Sem retry para erro permanente
```

### 8.2 Retry de Erro Permanente

**Proibido:**

```python
# ERRADO: tentar de novo um erro de schema (permanente)
try:
    result = validate_schema(data)
except SchemaValidationError as e:
    schedule_retry(message)  # Schema não vai mudar com retry!
```

**Correto:**

```python
try:
    result = validate_schema(data)
except SchemaValidationError as e:
    await send_to_dlq(
        message=message,
        dlq_type="tool-schema-violation",
        error=e,
        requires_investigation=True
    )
    # Sem retry
```

### 8.3 DLQ sem Owner

**Proibido:**

```python
# ERRADO: criar DLQ genérica sem owner
async def send_to_dlq(message):
    await nats.publish("velya.agents.dlq.general", message)
    # Quem vai investigar? Ninguém definido!
```

**Correto:**

```python
async def send_to_dlq(
    message: bytes,
    dlq_type: str,
    error: Exception,
    office: str,
    task_id: str
):
    dlq_payload = {
        "dlq_type": dlq_type,
        "owner_office": office,  # Owner definido!
        "sla_deadline": (datetime.now(timezone.utc) +
                         timedelta(hours=DLQ_SLA_HOURS[dlq_type])).isoformat(),
        "original_message": message.decode(),
        "error": str(error),
        "task_id": task_id
    }
    await nats.publish(
        f"velya.agents.dlq.{dlq_type}",
        json.dumps(dlq_payload).encode()
    )
```

### 8.4 Budget Ignorado

**Proibido:**

```python
# ERRADO: retry sem verificar budget
async def handle_error(message, attempt):
    if attempt < max_retries:
        schedule_retry(message)  # Budget não verificado!
```

**Correto:**

```python
async def handle_error(message, attempt, office: str):
    can_retry, reason = await retry_budget_manager.can_retry(office)

    if not can_retry:
        await send_to_dlq(message, error_type="budget-exceeded", office=office)
        await emit_budget_exhausted_alert(office, reason)
        return

    if attempt < max_retries:
        await retry_budget_manager.record_retry(office)
        delay = calculate_backoff_full_jitter(attempt, base=5, max_seconds=300)
        await asyncio.sleep(delay)
        await requeue_message(message)
```
