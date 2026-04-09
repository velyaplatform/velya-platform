# Governança de Custo 24/7 — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Office:** FinOps Office (Cost Governance Office)  
**Última revisão:** 2026-04-08

---

## 1. Estrutura de Budgets

A governança de custo da Velya opera em múltiplas camadas de granularidade, do nível de cluster até o nível de workflow individual.

### 1.1 Budget de Cluster

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cost-budgets-cluster
  namespace: velya-dev-platform
data:
  # Budget mensal total do cluster (USD)
  cluster_monthly_budget_usd: '2000'
  cluster_warning_threshold_percent: '75'
  cluster_alert_threshold_percent: '90'
  cluster_hard_limit_percent: '110' # 10% de overage máximo antes de ação automática

  # Budget por ambiente
  dev_cluster_monthly_budget_usd: '500'
  staging_cluster_monthly_budget_usd: '800'
  prod_cluster_monthly_budget_usd: '2000'
```

### 1.2 Budget por Namespace

```yaml
data:
  # Budget mensal por namespace (USD)
  velya-dev-core_monthly_usd: '200'
  velya-dev-platform_monthly_usd: '150'
  velya-dev-agents_monthly_usd: '300'
  velya-dev-web_monthly_usd: '100'
  velya-dev-observability_monthly_usd: '150'

  # Alertas por namespace
  namespace_warning_percent: '80'
  namespace_critical_percent: '95'
```

### 1.3 Budget por NodePool

```yaml
data:
  # Budget mensal por NodePool (USD)
  system-critical_monthly_usd: '200'
  realtime-app_monthly_usd: '600'
  async-workers_monthly_usd: '400'
  scheduled-batch_monthly_usd: '150'
  agent-runtime_monthly_usd: '200'
  heavy-ai-analytics_monthly_usd: '300'
  observability_monthly_usd: '350'
  platform-ops_monthly_usd: '150'
```

### 1.4 Budget por Office

```yaml
data:
  # Budget de inferência LLM mensal por office (USD)
  clinical-operations_llm_monthly_usd: '30'
  validation-office_llm_monthly_usd: '20'
  audit-office_llm_monthly_usd: '15'
  governance-office_llm_monthly_usd: '25'
  learning-office_llm_monthly_usd: '10'
  intelligence-office_llm_monthly_usd: '8'
  finops-office_llm_monthly_usd: '5'
  agent-factory_llm_monthly_usd: '10'

  # Budget de compute (pods) por office mensal (USD)
  clinical-operations_compute_monthly_usd: '100'
  platform-health_compute_monthly_usd: '80'
  observability_compute_monthly_usd: '150'
  watchdog_compute_monthly_usd: '40'
```

### 1.5 Budget por Agent Family

```yaml
data:
  # Budget mensal por família de agent (USD)
  # Família = classe de agent + office
  clinical-ops-worker_monthly_usd: '50'
  clinical-ops-sentinel_monthly_usd: '20'
  clinical-ops-governance_monthly_usd: '30'
  platform-sentinel_monthly_usd: '25'
  finops-batch_monthly_usd: '15'
  watchdog-all_monthly_usd: '40'
  learning-all_monthly_usd: '20'
  intelligence-all_monthly_usd: '15'
```

### 1.6 Budget por Fila (Queue)

```yaml
data:
  # Budget de processamento por fila/hora (USD)
  # Inclui custo de inferência LLM por mensagem processada
  clinical-ops-task-classification_hourly_usd: '0.10'
  clinical-ops-discharge-trigger_hourly_usd: '0.05'
  governance-validation_hourly_usd: '0.08'
  governance-audit_hourly_usd: '0.06'

  # Custo médio por mensagem por fila
  clinical-ops-task-classification_cost_per_msg_usd: '0.002'
  governance-validation_cost_per_msg_usd: '0.003'
  governance-audit_cost_per_msg_usd: '0.002'
```

### 1.7 Budget de Workflow (Temporal)

```yaml
data:
  # Budget de compute por workflow (USD por execução)
  discharge-workflow_cost_per_execution_usd: '0.01'
  patient-flow-workflow_cost_per_execution_usd: '0.005'
  audit-workflow_cost_per_execution_usd: '0.002'

  # Budget mensal de Temporal (compute dos workers + storage PostgreSQL)
  temporal_monthly_usd: '100'
```

### 1.8 Budget de Observabilidade

```yaml
data:
  # Storage de métricas (Prometheus)
  prometheus_storage_monthly_usd: '30'

  # Storage de logs (Loki)
  loki_storage_monthly_usd: '80' # Logs são o maior custo de obs
  loki_ingestion_rate_gb_day: '5' # Máximo 5GB/dia de logs
  loki_retention_days: '30'

  # Storage de traces (Tempo)
  tempo_storage_monthly_usd: '40'
  tempo_retention_days: '7'

  # Grafana
  grafana_monthly_usd: '0' # OSS auto-hospedado = gratuito

  # Total observabilidade
  observability_total_monthly_usd: '150'
  observability_warning_percent: '80'
```

---

## 2. Ações Automáticas por Budget Breach

### 2.1 Ação 1: Reduzir Concorrência

**Gatilho:** Budget de um office ou fila > 80% utilizado.

**Ação automática:**

- Reduzir `maxReplicaCount` do KEDA ScaledObject do office em 25%
- Notificar FinOps Office com justificativa e impacto esperado

```python
async def reduce_concurrency(office: str, breach_percent: float):
    scaler = await keda_client.get_scaled_object(
        namespace="velya-dev-agents",
        name=f"{office}-worker-scaler"
    )

    current_max = scaler.spec.max_replica_count
    new_max = max(int(current_max * 0.75), scaler.spec.min_replica_count)

    await keda_client.patch_scaled_object(
        name=f"{office}-worker-scaler",
        patch={"spec": {"maxReplicaCount": new_max}}
    )

    await emit_cost_action_event(
        action="reduce_concurrency",
        office=office,
        breach_percent=breach_percent,
        old_max=current_max,
        new_max=new_max,
        expected_savings_percent=25
    )
```

### 2.2 Ação 2: Pausar Scans de Background

**Gatilho:** Budget de cluster > 85%.

**Ação automática:**

- Suspender CronJobs de baixa prioridade: `market-intelligence-sweep`, `daily-report`
- Manter apenas CronJobs críticos: `heartbeat-sweep`, `cost-sweep`

```bash
# Suspender CronJob (define .spec.suspend = true)
kubectl patch cronjob market-intelligence-sweep -n velya-dev-agents \
  --patch '{"spec": {"suspend": true}}'

kubectl patch cronjob daily-report -n velya-dev-agents \
  --patch '{"spec": {"suspend": true}}'
```

### 2.3 Ação 3: Cortar Overlap

**Gatilho:** Budget de Temporal (compute) > 90%.

**Ação automática:**

- Alterar schedules com política `AllowAll` ou `BufferAll` para `Skip`
- Limitar paralelismo de Temporal workers

### 2.4 Ação 4: Mover para Fila de Baixa Prioridade

**Gatilho:** Budget de LLM de um office > 90%.

**Ação automática:**

- Tasks de prioridade `low` do office são movidas para fila de processamento diferido (`velya.agents.{office}.deferred`)
- Fila de baixa prioridade processada apenas quando budget disponível
- Tasks de prioridade `high` e `emergency` continuam no fluxo normal

```python
async def defer_low_priority_tasks(office: str):
    """
    Intercepta novas mensagens de baixa prioridade e as move para fila diferida.
    Implementado como middleware NATS com filter por header.
    """

    # Configurar redirect de mensagens low-priority
    await nats.create_subject_transform(
        source=f"velya.agents.{office}.*.low-priority",
        destination=f"velya.agents.{office}.deferred"
    )

    await emit_cost_action_event(
        action="defer_low_priority",
        office=office,
        affected_priority_level="low"
    )
```

---

## 3. Budget de Inferência LLM

### 3.1 Estrutura de Budget LLM

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: llm-budget
  namespace: velya-dev-agents
data:
  # Budget global de inferência (USD/hora)
  global_llm_hourly_budget_usd: '5.00'

  # Budget por modelo
  gpt-4o_hourly_budget_usd: '2.00'
  gpt-4o-mini_hourly_budget_usd: '1.50'
  claude-3-5-sonnet_hourly_budget_usd: '1.50'

  # Custo por 1000 tokens (input/output)
  gpt-4o_input_cost_per_1k: '0.0025'
  gpt-4o_output_cost_per_1k: '0.01'
  gpt-4o-mini_input_cost_per_1k: '0.00015'
  gpt-4o-mini_output_cost_per_1k: '0.0006'
  claude-3-5-sonnet_input_cost_per_1k: '0.003'
  claude-3-5-sonnet_output_cost_per_1k: '0.015'

  # Limites por agent
  max_tokens_per_task: '2000'
  max_llm_calls_per_task: '5'

  # Circuit breaker
  circuit_breaker_threshold_usd_per_minute: '0.50'
  circuit_breaker_cooldown_minutes: '15'
```

### 3.2 Circuit Breaker de Inferência

```python
class LLMBudgetCircuitBreaker:
    """
    Circuit breaker que bloqueia novas chamadas de LLM quando o budget
    de inferência está sendo consumido a uma taxa insustentável.
    """

    def __init__(self, config: LLMBudgetConfig):
        self.config = config
        self.state = "closed"  # closed = normal, open = bloqueado
        self.cost_window = SlidingWindow(window_minutes=5)

    async def check_before_inference(self, agent_name: str, office: str) -> tuple[bool, str]:
        """
        Retorna (can_proceed: bool, reason: str)
        """
        # Verificar budget do office
        office_budget = await self.get_office_budget(office)
        office_used = await self.get_office_cost_1h(office)

        if office_used >= office_budget * 0.95:
            return False, f"Budget de LLM do office {office} esgotado ({office_used:.2f}/{office_budget:.2f} USD/h)"

        # Verificar circuit breaker global
        global_rate = self.cost_window.rate_per_minute()
        threshold = self.config.circuit_breaker_threshold_usd_per_minute

        if global_rate > threshold:
            await self.open_circuit_breaker(global_rate, threshold)
            return False, f"Circuit breaker ativo: {global_rate:.3f} USD/min > {threshold} USD/min"

        # Verificar budget global
        global_used = await self.get_global_cost_1h()
        global_budget = self.config.global_llm_hourly_budget_usd

        if global_used >= global_budget * 0.90:
            return False, f"Budget global de LLM próximo ao limite: {global_used:.2f}/{global_budget:.2f} USD/h"

        return True, "ok"

    async def open_circuit_breaker(self, rate: float, threshold: float):
        self.state = "open"

        await nats.publish("velya.agents.finops.circuit-breaker-opened", json.dumps({
            "type": "llm_inference",
            "trigger_rate_per_minute": rate,
            "threshold": threshold,
            "opened_at": datetime.now(timezone.utc).isoformat(),
            "cooldown_minutes": self.config.circuit_breaker_cooldown_minutes,
            "action": "block_all_non_critical_llm_calls"
        }).encode())
```

---

## 4. Budget de Logs e Traces

### 4.1 Controle de Ingestão de Logs (Loki)

```yaml
# Configuração de rate limit de ingestão no Loki
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-limits
  namespace: velya-dev-observability
data:
  loki_config.yaml: |
    limits_config:
      # Rate limit global de ingestão
      ingestion_rate_mb: 50         # 50 MB/s máximo
      ingestion_burst_size_mb: 100  # Burst de 100 MB
      
      # Por namespace (tenant no multi-tenant setup)
      per_tenant_rate_limit_mb: 10
      per_tenant_burst_limit_mb: 20
      
      # Retenção diferenciada por label
      retention_period: 720h    # 30 dias padrão
      
      # Streams com retenção maior (dados de auditoria)
      retention_stream:
        - selector: '{namespace="velya-dev-agents", event_type="audit"}'
          priority: 1
          period: 8760h  # 1 ano para audit logs
```

### 4.2 Controle de Ingestão de Traces (Tempo)

```yaml
# Sampling de traces para controle de custo
# Não precisamos 100% dos traces — sampling inteligente
tracing:
  sampling:
    # 100% para traces de incidentes (quando há erro)
    error_sampling_rate: 1.0

    # 10% para traces de operações normais
    default_sampling_rate: 0.10

    # 50% para traces de operações clínicas (maior importância)
    clinical_operations_sampling_rate: 0.50

    # 1% para traces de health checks e heartbeats (muitos, pouca info)
    health_check_sampling_rate: 0.01
```

---

## 5. FinOps Office SLAs

| Atividade                                | SLA                        | Métrica                                |
| ---------------------------------------- | -------------------------- | -------------------------------------- |
| Alerta de budget > 80%                   | < 6 horas após breach      | `velya_finops_alert_latency_seconds`   |
| Relatório diário de custo                | Disponível até 06h UTC     | `velya_finops_report_generated`        |
| Ação automática por breach               | < 30 minutos após detecção | `velya_finops_action_latency_seconds`  |
| Relatório semanal de otimização          | Segunda-feira 09h UTC      | `velya_finops_weekly_report_generated` |
| Revisão de budget mensal                 | Último dia útil do mês     | `velya_finops_budget_review_completed` |
| Resposta a spike de custo (>2x baseline) | < 2 horas                  | `velya_finops_spike_response_seconds`  |

---

## 6. Alertas de Custo Prometheus

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-cost-alerts
  namespace: velya-dev-observability
spec:
  groups:
    - name: velya.cost.cluster
      interval: 5m
      rules:
        - alert: ClusterBudgetWarning
          expr: |
            velya_cluster_cost_usd_month_projected >
            velya_cluster_budget_usd_month * 0.75
          for: 30m
          labels:
            severity: warning
            team: finops
          annotations:
            summary: 'Cluster projetado para usar {{ $value | humanize }}% do budget mensal'

        - alert: ClusterBudgetCritical
          expr: |
            velya_cluster_cost_usd_month_projected >
            velya_cluster_budget_usd_month * 0.90
          for: 15m
          labels:
            severity: critical
            team: finops
          annotations:
            summary: 'CRÍTICO: Cluster com risco de ultrapassar budget mensal'

    - name: velya.cost.llm
      interval: 1m
      rules:
        - alert: LLMCostSpikeDetected
          expr: |
            rate(velya_agent_llm_cost_usd_total[30m]) >
            rate(velya_agent_llm_cost_usd_total[30m] offset 1d) * 3
          for: 15m
          labels:
            severity: warning
            team: finops
          annotations:
            summary: 'Custo de LLM 3x acima do mesmo período ontem'

        - alert: LLMCircuitBreakerOpen
          expr: velya_llm_circuit_breaker_state == 1
          for: 0m
          labels:
            severity: critical
            team: finops
          annotations:
            summary: 'Circuit breaker de LLM está ABERTO — novas inferências bloqueadas'

        - alert: AgentLLMBudgetExhausted
          expr: |
            velya_agent_llm_budget_remaining_usd < 0.10
          for: 0m
          labels:
            severity: warning
            team: finops
          annotations:
            summary: 'Agent {{ $labels.agent_name }} com ${{ $value }} restante no budget LLM'

    - name: velya.cost.namespace
      interval: 5m
      rules:
        - alert: NamespaceCostWarning
          expr: |
            velya_namespace_cost_usd_hour * 720 >  # projeção mensal
            velya_namespace_budget_usd_month * 0.80
          for: 30m
          labels:
            severity: warning
          annotations:
            summary: 'Namespace {{ $labels.namespace }} projetado para ultrapassar 80% do budget mensal'

        - alert: NamespaceCostSpike
          expr: |
            velya_namespace_cost_usd_hour >
            velya_namespace_cost_usd_hour offset 1d * 2
          for: 30m
          labels:
            severity: warning
            team: finops
          annotations:
            summary: 'Custo do namespace {{ $labels.namespace }} dobrou vs mesmo horário ontem'

    - name: velya.cost.observability
      interval: 15m
      rules:
        - alert: LokiIngestionRateHigh
          expr: |
            rate(loki_ingester_bytes_received_total[5m]) > 50000000  # 50MB/s
          for: 10m
          labels:
            severity: warning
            team: observability
          annotations:
            summary: 'Taxa de ingestão do Loki alta: {{ $value | humanizeBytes }}/s'

        - alert: PrometheusStorageHigh
          expr: |
            prometheus_tsdb_storage_blocks_bytes > 10737418240  # 10GB
          for: 30m
          labels:
            severity: warning
            team: observability
          annotations:
            summary: 'Prometheus usando {{ $value | humanizeBytes }} de storage — revisar retenção'
```

---

## 7. Relatório Diário de Custo

O FinOps agent gera diariamente (02h UTC) um relatório estruturado:

```json
{
  "report_date": "2026-04-08",
  "generated_at": "2026-04-08T02:15:00Z",
  "period": "last_24h",

  "summary": {
    "total_cost_usd": 45.23,
    "vs_yesterday": "+2.3%",
    "vs_7day_avg": "-1.2%",
    "budget_monthly_usd": 2000,
    "projected_monthly_usd": 1357,
    "budget_utilization_percent": 67.9
  },

  "by_category": {
    "compute": { "cost_usd": 28.5, "percent": 63.0 },
    "storage": { "cost_usd": 8.2, "percent": 18.1 },
    "llm_inference": { "cost_usd": 6.8, "percent": 15.0 },
    "networking": { "cost_usd": 1.73, "percent": 3.8 }
  },

  "by_namespace": {
    "velya-dev-core": { "cost_usd": 15.2, "budget_usd": 200, "utilization": "7.6%" },
    "velya-dev-agents": { "cost_usd": 12.8, "budget_usd": 300, "utilization": "4.3%" },
    "velya-dev-observability": { "cost_usd": 10.5, "budget_usd": 150, "utilization": "7.0%" },
    "velya-dev-platform": { "cost_usd": 5.23, "budget_usd": 150, "utilization": "3.5%" },
    "velya-dev-web": { "cost_usd": 1.5, "budget_usd": 100, "utilization": "1.5%" }
  },

  "llm_inference_detail": {
    "total_cost_usd": 6.8,
    "total_tokens": 2800000,
    "by_model": {
      "gpt-4o-mini": { "cost_usd": 4.2, "tokens": 2200000 },
      "claude-3-5-sonnet": { "cost_usd": 2.6, "tokens": 600000 }
    },
    "by_office": {
      "clinical-operations": { "cost_usd": 2.1, "budget_daily_usd": 1.0, "status": "over_budget" },
      "validation-office": { "cost_usd": 1.8, "budget_daily_usd": 0.67, "status": "over_budget" },
      "governance-office": { "cost_usd": 1.5, "budget_daily_usd": 0.83, "status": "over_budget" },
      "learning-office": { "cost_usd": 0.8, "budget_daily_usd": 0.33, "status": "over_budget" },
      "intelligence-office": { "cost_usd": 0.6, "budget_daily_usd": 0.27, "status": "over_budget" }
    }
  },

  "anomalies_detected": [
    {
      "type": "llm_cost_overrun",
      "severity": "warning",
      "description": "clinical-operations gastou 2.1x do budget diário de LLM",
      "recommendation": "Verificar se volume de tasks aumentou ou se há retry storm"
    }
  ],

  "optimization_opportunities": [
    {
      "title": "Migrar audit-batch para gpt-4o-mini",
      "description": "audit-batch usa claude-3-5-sonnet desnecessariamente. gpt-4o-mini suficiente.",
      "estimated_saving_usd_month": 15,
      "effort": "2h"
    }
  ]
}
```

---

## 8. Governança de Spot Instances

```yaml
# Configuração de spot savings por NodePool
spot_configuration:
  async-workers:
    target_spot_percent: 80
    fallback_on_demand_percent: 20
    spot_interruption_tolerance: 'high' # NATS garante re-entrega

  scheduled-batch:
    target_spot_percent: 100
    fallback_on_demand_percent: 0
    spot_interruption_tolerance: 'high' # Jobs são idempotentes

  heavy-ai-analytics:
    target_spot_percent: 100
    spot_interruption_tolerance: 'high'

  realtime-app:
    target_spot_percent: 0
    fallback_on_demand_percent: 100
    spot_interruption_tolerance: 'none' # SLA de latência não tolera interruption

# Estimativa de saving com spot
estimated_spot_savings:
  async-workers: '60-70%' # vs on-demand
  scheduled-batch: '70-80%'
  heavy-ai-analytics: '70-80%'
  total_monthly_saving_usd: '400-600'
```
