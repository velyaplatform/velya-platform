# Guardrails de Custo e Budget — Velya

**Versão:** 1.0  
**Domínio:** Governança Financeira de Infraestrutura  
**Classificação:** Documento de Referência Técnica  
**Data:** 2026-04-08

---

## Mandato

> **Custo não é uma preocupação de infraestrutura. É um constraint de negócio. Na Velya, cada componente tem um budget declarado, monitorado em tempo real, e com ação automática em caso de breach.**

---

## Hierarquia de Budgets

```
┌─────────────────────────────────────────────────────────────────┐
│  Budget Total da Plataforma (mensal)                            │
│  ├── Cluster EKS (node cost)                                    │
│  │   ├── NodePool: system-critical                              │
│  │   ├── NodePool: realtime-app                                 │
│  │   ├── NodePool: async-workers                                │
│  │   └── ... (outros NodePools)                                 │
│  ├── Namespace Budget (ResourceQuota como proxy)                │
│  │   ├── velya-dev-core                                         │
│  │   ├── velya-dev-agents                                       │
│  │   └── ... (outros namespaces)                                │
│  ├── LLM Inference Budget                                       │
│  │   ├── Por office (ex: clinical-office)                       │
│  │   └── Por agent family                                       │
│  ├── Queue Budget (retry cost)                                  │
│  ├── Observabilidade (cardinality + retention)                  │
│  └── Storage (S3, EBS)                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Budget por Cluster EKS

### Definição de Budget

| Ambiente         | Budget Mensal | Teto Absoluto | Alerta em    |
| ---------------- | ------------- | ------------- | ------------ |
| kind-velya-local | $0 (local)    | N/A           | N/A          |
| EKS Staging      | $700          | $900          | $600 (85%)   |
| EKS Produção     | $3.000        | $4.000        | $2.500 (83%) |

### AWS Budget Alert (produção)

```hcl
# OpenTofu — AWS Budget para EKS produção
resource "aws_budgets_budget" "eks_prod" {
  name         = "velya-eks-prod-monthly"
  budget_type  = "COST"
  time_unit    = "MONTHLY"

  limit_amount = "3000"
  limit_unit   = "USD"

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Project$velya", "user:Environment$prod"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 83
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["platform@velya.com.br"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = ["cto@velya.com.br", "platform@velya.com.br"]
  }
}
```

### Fórmula de Estimativa de Custo: kind → EKS

```
Custo EKS = Custo_Controle_Plano + Custo_Nós + Custo_Storage + Custo_Transferência

Custo_Controle_Plano = $72/mês (fixo por cluster EKS)

Custo_Nós = Σ (instâncias × preço × horas_uso)
  - On-Demand: usar preço AWS EC2 atual por região
  - Spot: On-Demand × 0.3 (estimativa 70% desconto médio Spot)

Custo_Storage = (EBS_GB × $0.10/GB/mês) + (S3_GB × $0.023/GB/mês)

Custo_Transferência = Dados_saída_AWS × $0.09/GB
  (interno a mesma AZ = $0, cross-AZ = $0.01/GB)

Exemplos de instâncias (us-east-1, 2026):
  m6i.large:   $0.096/h  → $70/mês (On-Demand) / $21/mês (Spot ~70% off)
  m6i.xlarge:  $0.192/h  → $139/mês (On-Demand) / $42/mês (Spot)
  c6i.xlarge:  $0.170/h  → $124/mês (On-Demand) / $37/mês (Spot)
  m7g.xlarge:  $0.163/h  → $118/mês (On-Demand) / $35/mês (Spot)
```

---

## Budget por Namespace (ResourceQuota como Proxy)

### Princípio

ResourceQuota não é uma garantia de custo — é um teto de recursos que serve como proxy. O custo real depende da utilização dentro da quota.

| Namespace               | CPU Request Limit | Memory Request Limit | Pods Max | Budget Implícito/mês |
| ----------------------- | ----------------- | -------------------- | -------- | -------------------- |
| velya-dev-core          | 20 cores          | 40 Gi                | 100      | ~$400                |
| velya-dev-agents        | 16 cores          | 32 Gi                | 80       | ~$300                |
| velya-dev-platform      | 12 cores          | 24 Gi                | 60       | ~$250                |
| velya-dev-web           | 4 cores           | 8 Gi                 | 20       | ~$80                 |
| velya-dev-observability | 8 cores           | 32 Gi                | 40       | ~$200                |

### ResourceQuota YAML por Namespace

```yaml
# velya-dev-core
apiVersion: v1
kind: ResourceQuota
metadata:
  name: velya-core-quota
  namespace: velya-dev-core
spec:
  hard:
    requests.cpu: '20'
    requests.memory: 40Gi
    limits.cpu: '40'
    limits.memory: 80Gi
    pods: '100'
    count/deployments.apps: '30'
    count/services: '30'
    persistentvolumeclaims: '20'
    requests.storage: 100Gi

---
# velya-dev-agents
apiVersion: v1
kind: ResourceQuota
metadata:
  name: velya-agents-quota
  namespace: velya-dev-agents
spec:
  hard:
    requests.cpu: '16'
    requests.memory: 32Gi
    limits.cpu: '32'
    limits.memory: 64Gi
    pods: '80'
    count/deployments.apps: '25'
    persistentvolumeclaims: '10'
    requests.storage: 50Gi

---
# velya-dev-platform
apiVersion: v1
kind: ResourceQuota
metadata:
  name: velya-platform-quota
  namespace: velya-dev-platform
spec:
  hard:
    requests.cpu: '12'
    requests.memory: 24Gi
    limits.cpu: '24'
    limits.memory: 48Gi
    pods: '60'
    count/deployments.apps: '20'
    count/statefulsets.apps: '10'
    persistentvolumeclaims: '20'
    requests.storage: 200Gi

---
# LimitRange — garante que pods sem recursos explícitos têm defaults
apiVersion: v1
kind: LimitRange
metadata:
  name: velya-default-limits
  namespace: velya-dev-core
spec:
  limits:
    - type: Container
      default: # limits padrão se não especificado
        cpu: 500m
        memory: 512Mi
      defaultRequest: # requests padrão se não especificado
        cpu: 100m
        memory: 128Mi
      max: # Máximo permitido por container
        cpu: 8
        memory: 16Gi
      min: # Mínimo obrigatório
        cpu: 10m
        memory: 32Mi
    - type: Pod
      max:
        cpu: 16
        memory: 32Gi
```

---

## Budget por NodePool (Instance Cost Ceiling)

### Mecanismo: Karpenter + maxReplicaCount como Guardrail

```yaml
# NodePool com budget implícito via limits
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: velya-async-workers
spec:
  limits:
    cpu: 256 # Máx ~64 nós m6i.large (4 vCPU cada)
    memory: 512Gi
  # Budget implícito: 64 nós × $0.03/h (Spot) × 730h = ~$1.400/mês MAX
  # Budget esperado (com consolidação): ~$100-300/mês
```

### Alertas de NodePool Cost

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-nodepool-cost-alerts
  namespace: velya-dev-observability
spec:
  groups:
    - name: nodepool-cost
      rules:
        - alert: NodePoolApproachingLimit
          expr: |
            karpenter_nodepool_usage_requests{resource="cpu"} /
            karpenter_nodepool_limit{resource="cpu"} > 0.80
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: 'NodePool {{ $labels.nodepool }} em 80% do limite de CPU'
            description: 'Uso atual: {{ $value | humanizePercentage }}. Revisar se budget deve ser aumentado ou workload otimizado.'

        - alert: SpotNodeCountHigh
          expr: |
            count(kube_node_labels{label_karpenter_sh_capacity_type="spot"}) > 30
          for: 15m
          labels:
            severity: warning
          annotations:
            summary: 'Mais de 30 nós Spot ativos — verificar custo'
```

---

## Budget por Office (LLM Inference)

### Estrutura de Budget LLM

| Office                     | Budget Diário (tokens) | Budget Mensal (estimado $) | Modelo Padrão   |
| -------------------------- | ---------------------- | -------------------------- | --------------- |
| Clinical Office            | 500.000                | ~$150                      | claude-sonnet-4 |
| Operations Office          | 200.000                | ~$60                       | claude-haiku-3  |
| Market Intelligence Office | 2.000.000              | ~$600                      | claude-opus-4   |
| Platform Ops Office        | 100.000                | ~$30                       | claude-haiku-3  |
| Agent Factory              | 50.000                 | ~$15                       | claude-haiku-3  |

**Total LLM estimado: ~$855/mês em produção (volume inicial)**

### Implementação de Budget LLM no ai-gateway

```typescript
// packages/ai-gateway/src/budget-enforcer.ts

interface TokenBudget {
  officeId: string;
  dailyLimit: number;
  consumed: number;
  resetAt: Date;
}

export class BudgetEnforcer {
  async checkAndDeduct(
    officeId: string,
    estimatedTokens: number,
    priority: 'critical' | 'high' | 'normal' | 'low',
  ): Promise<BudgetCheckResult> {
    const budget = await this.redis.get<TokenBudget>(`budget:${officeId}:${today()}`);

    if (!budget) {
      // Inicializar budget do dia
      await this.initializeDailyBudget(officeId);
      return { allowed: true, remaining: this.getBudgetConfig(officeId).dailyLimit };
    }

    const remaining = budget.dailyLimit - budget.consumed;
    const usedPercent = (budget.consumed / budget.dailyLimit) * 100;

    // Regras por nível de prioridade
    if (priority === 'critical') {
      // Critical sempre passa — budget pode ficar negativo até 10%
      if (usedPercent > 110) {
        throw new BudgetExceededError(`Budget crítico esgotado para office ${officeId}`);
      }
    } else if (priority === 'high') {
      if (usedPercent >= 95) {
        return { allowed: false, reason: 'budget_high_at_95_percent' };
      }
    } else if (priority === 'normal') {
      if (usedPercent >= 85) {
        return { allowed: false, reason: 'budget_normal_at_85_percent' };
      }
    } else if (priority === 'low') {
      if (usedPercent >= 70) {
        return { allowed: false, reason: 'budget_low_at_70_percent' };
      }
    }

    // Registrar consumo
    await this.redis.incrby(`budget:${officeId}:${today()}:consumed`, estimatedTokens);

    // Emitir métrica Prometheus
    this.metrics.tokenBudgetConsumed.inc(
      {
        office_id: officeId,
        priority,
      },
      estimatedTokens,
    );

    return { allowed: true, remaining: remaining - estimatedTokens };
  }
}
```

### ConfigMap de Budget por Office

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ai-budget-config
  namespace: velya-dev-agents
data:
  budgets.yaml: |
    offices:
      clinical-office:
        daily_token_limit: 500000
        model_default: claude-sonnet-4
        priority_tiers:
          critical_threshold_pct: 110   # Pode ultrapassar até 110%
          high_threshold_pct: 95
          normal_threshold_pct: 85
          low_threshold_pct: 70
      
      operations-office:
        daily_token_limit: 200000
        model_default: claude-haiku-3
        priority_tiers:
          critical_threshold_pct: 105
          high_threshold_pct: 90
          normal_threshold_pct: 80
          low_threshold_pct: 60
      
      market-intelligence-office:
        daily_token_limit: 2000000
        model_default: claude-opus-4
        priority_tiers:
          critical_threshold_pct: 100
          high_threshold_pct: 90
          normal_threshold_pct: 75
          low_threshold_pct: 50

    agents:
      discharge-summary-agent:
        daily_token_limit: 100000
        model: claude-sonnet-4
        max_tokens_per_call: 4000
      
      market-intelligence-agent:
        daily_token_limit: 500000
        model: claude-opus-4
        max_tokens_per_call: 16000
      
      executive-digest-agent:
        daily_token_limit: 20000
        model: claude-haiku-3
        max_tokens_per_call: 2000
```

---

## Budget de Queue (Retry Cost)

### Problema

Retry storms podem explodir o número de mensagens processadas, aumentando consumo de CPU dos workers e, indiretamente, custo de compute.

### Mecanismo de Retry Budget

```yaml
# NATS JetStream — configuração de retry budget por stream
# Configurado via NATS CLI ou SDK

# Stream velya.discharge.queue
nats stream edit velya.discharge.queue \
  --max-msgs-per-subject=10000 \    # Max 10k msgs na fila
  --max-deliver=5 \                  # Max 5 tentativas por mensagem
  --ack-wait=300s \                  # 5 min para ack (workflows longos)
  --backoff="1s,5s,30s,120s,300s"  # Backoff progressivo

# DLQ separado
nats stream add velya.discharge.dlq \
  --subjects="velya.discharge.dlq.>" \
  --retention=limits \
  --max-msgs=1000 \    # Max 1000 msgs no DLQ antes de alerta crítico
  --max-age=7d         # Reter por 7 dias para análise
```

### Alerta de Retry Budget

```yaml
- alert: RetryBudgetExhausted
  expr: |
    rate(velya_nats_message_deliver_count{
      stream=~"velya\\..*",
      deliver_count="5"    # 5a tentativa = última antes do DLQ
    }[5m]) > 10
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: 'Alta taxa de mensagens no limite de retry: stream {{ $labels.stream }}'
    description: 'Mais de 10 msg/min atingindo o limite de 5 retries. Verificar downstream.'

- alert: DLQGrowing
  expr: |
    delta(velya_nats_stream_messages{stream=~"velya\\..*\\.dlq"}[10m]) > 10
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: 'DLQ crescendo: {{ $labels.stream }}'
    description: 'Mais de 10 mensagens adicionadas ao DLQ nos últimos 10 minutos'
```

---

## Budget de Observabilidade (Cardinality + Retention)

### Problema

Prometheus com alta cardinalidade de labels cria séries temporais explosivas. Loki com retenção longa aumenta custo de S3.

### Limites de Cardinality

```yaml
# prometheus-config.yaml
global:
  external_labels:
    cluster: kind-velya-local
    environment: dev

# Limitar cardinality por job
scrape_configs:
  - job_name: velya-services
    metric_relabel_configs:
      # Remover labels de alta cardinalidade desnecessários
      - action: labeldrop
        regex: 'pod_uid|node_uid|container_id'
      # Limitar valores de status code (manter apenas classe: 2xx, 4xx, 5xx)
      - source_labels: [status_code]
        regex: '2..'
        target_label: status_class
        replacement: '2xx'
      - source_labels: [status_code]
        regex: '4..'
        target_label: status_class
        replacement: '4xx'
      - source_labels: [status_code]
        regex: '5..'
        target_label: status_class
        replacement: '5xx'
      - action: labeldrop
        regex: 'status_code' # Remover status_code granular após classificar
```

### Retenção de Métricas

```yaml
# Prometheus values (Helm)
prometheus:
  prometheusSpec:
    retention: 15d # 15 dias de retenção local
    retentionSize: 20GB # Máximo 20GB de TSDB


    # Remote write para S3 via Thanos (futuro)
    # remoteWrite:
    # - url: http://thanos-receive:10908/api/v1/receive
```

### Retenção de Logs (Loki)

```yaml
# Loki values (Helm)
loki:
  storage:
    type: s3
    s3:
      bucketName: velya-loki-logs
      region: us-east-1

  limits_config:
    retention_period: 30d # 30 dias de retenção
    max_streams_per_user: 10000 # Limite de streams por tenant
    max_line_size: 256000 # Máximo 256KB por linha de log
    ingestion_rate_mb: 10 # 10 MB/s de ingestão por tenant
    per_stream_rate_limit: 5MB # 5 MB/s por stream

    # Labels retention diferenciado
    per_tenant_override_config: |
      velya-dev:
        retention_period: 15d    # Dev: 15 dias
      velya-prod:
        retention_period: 90d    # Prod: 90 dias (compliance)
```

### Custo Estimado de Observabilidade

| Componente                     | Storage | Custo/mês      |
| ------------------------------ | ------- | -------------- |
| Prometheus TSDB (20 GB EBS)    | 20 GB   | $2             |
| Loki logs em S3 (100 GB/mês)   | 100 GB  | $2.30          |
| Tempo traces em S3 (50 GB/mês) | 50 GB   | $1.15          |
| **Total Observabilidade**      |         | **~$5.45/mês** |

---

## Ações Automáticas por Breach de Budget

### Tabela de Ações

| Budget             | Nível    | Threshold      | Ação Automática                 | Escalada Humana |
| ------------------ | -------- | -------------- | ------------------------------- | --------------- |
| Cluster EKS        | Warning  | 83% do mensal  | Slack #velya-ops-alerts         | Não             |
| Cluster EKS        | Critical | 95% do mensal  | Slack + PagerDuty               | Sim             |
| Cluster EKS        | Exceeded | 100% do mensal | PagerDuty + freeze novos nós    | Sim (CTO)       |
| Namespace CPU      | Warning  | 80% da quota   | Slack                           | Não             |
| Namespace CPU      | Critical | 95% da quota   | Slack + bloquear novos deploys  | Sim             |
| LLM tokens/dia     | Warning  | 85%            | Throttle agents low-priority    | Não             |
| LLM tokens/dia     | Critical | 95%            | Throttle agents normal-priority | Sim             |
| LLM tokens/dia     | Exceeded | 105%           | Bloquear todos exceto critical  | Sim             |
| DLQ messages       | Warning  | > 100 msgs     | Slack                           | Não             |
| DLQ messages       | Critical | > 1000 msgs    | Slack + PagerDuty               | Sim             |
| Spot eviction rate | Warning  | > 5/hora       | Slack                           | Não             |
| Spot eviction rate | Critical | > 20/hora      | Fallback para On-Demand         | Sim             |

### Implementação: KEDA maxReplicaCount como Guardrail de Custo

```yaml
# ScaledObject com maxReplicaCount como guardrail financeiro
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: discharge-worker-so
  namespace: velya-dev-agents
  annotations:
    velya.io/cost-guardrail: 'true'
    velya.io/max-cost-per-month-usd: '300'
spec:
  scaleTargetRef:
    name: discharge-orchestrator-worker
  minReplicaCount: 2
  maxReplicaCount: 20 # Guardrail: 20 pods × m6i.xlarge Spot = ~$600/mês max
  # Cálculo:
  # 20 workers × 4 vCPU × 0.25 vCPU alocado = 5 nós m6i.xlarge
  # 5 nós × $0.192/h × 730h × 0.3 (Spot) = ~$210/mês
```

---

## Dashboard de Custo e Capacidade

### Métricas Prometheus para Budget

```yaml
# Custom metrics para budget LLM
velya_ai_tokens_consumed_total{office_id, agent_id, model, priority}
velya_ai_tokens_budget_daily{office_id}
velya_ai_tokens_remaining_today{office_id}
velya_ai_budget_breach_events_total{office_id, severity}
velya_ai_request_blocked_by_budget_total{office_id, reason}

# Métricas de custo de compute
velya_nodepool_estimated_cost_hourly{nodepool, capacity_type}
velya_namespace_quota_utilization{namespace, resource}
velya_spot_eviction_total{nodepool, instance_type}
velya_spot_savings_total_usd_estimate{nodepool}
```

### Queries de Custo Úteis

```promql
# Utilização de quota por namespace
kube_resourcequota{resource="requests.cpu"} /
  kube_resourcequota{resource="requests.cpu", type="hard"}

# Tokens LLM consumidos hoje por office
sum by (office_id) (
  increase(velya_ai_tokens_consumed_total[24h])
)

# Estimativa de nós ativos por NodePool
count by (nodepool) (
  kube_node_labels{label_karpenter_sh_nodepool!=""}
)

# Taxa de request bloqueados por budget
rate(velya_ai_request_blocked_by_budget_total[1h])
```

---

## Relatório de Custo: Formato

```markdown
# Velya Cost Report — 2026-04-08

## Resumo Executivo

| Componente          | Custo Mês Atual | Budget | Utilização |
| ------------------- | --------------- | ------ | ---------- |
| EKS Compute (Nodes) | $0 (kind local) | N/A    | N/A        |
| LLM API (Anthropic) | $145            | $855   | 17%        |
| S3 Storage          | $3.50           | $50    | 7%         |
| Total               | $148.50         | $905   | 16.4%      |

## LLM por Office

| Office          | Tokens/dia (média) | Custo/dia | Vs Budget     |
| --------------- | ------------------ | --------- | ------------- |
| Clinical Office | 125.000            | $37       | 25% do budget |
| Operations      | 45.000             | $7        | 23% do budget |
| Market Intel    | 380.000            | $95       | 19% do budget |

## Anomalias

- Nenhuma

## Recomendações

- Clinical Office: migrar digest diário de claude-sonnet para claude-haiku (economia ~40%)
- Operations: sem ação necessária
```

---

_Budget guardrails são revisados mensalmente ou após qualquer evento de breach._
