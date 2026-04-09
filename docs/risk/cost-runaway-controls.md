# Cost Runaway Controls — Velya Platform

**Version**: 1.0  
**Date**: 2026-04-08  
**Classification**: Internal — Restricted  
**Purpose**: Define controls to prevent unexpected cost explosions across all cost categories: AI inference, autoscaling compute, observability, storage, CI/CD, and cloud infrastructure  
**Owner**: Platform Team + Infrastructure Team  
**Review Cadence**: Monthly; whenever a new AI agent or autoscaling trigger is added; whenever AWS bill shows > 20% variance from forecast  

---

## Cost Risk Philosophy

Cost runaway in a hospital AI platform has two failure modes:

1. **Financial runaway**: AWS bill exceeds budget; hospital contract terms are violated; platform becomes economically unviable
2. **Clinical service disruption via cost control**: If cost limits are set too aggressively and a circuit breaker triggers, clinical AI services may go offline — this is a patient safety risk

Controls must balance these two risks. A clinical service going offline due to a cost circuit breaker is worse than an overrun on the AI API budget for that day.

**Rule**: Cost circuit breakers for clinical AI services must alert and degrade before they shut down. Shutdown is a last resort, not a first response.

---

## Category 1: AI Inference Cost Runaway

### Risk Scenario

An agent implementation bug or prompt injection attack causes runaway LLM API calls:
- A recursive agent loop calls ai-gateway at 10 requests/second
- Each call uses 50,000 tokens (large context)
- At $15/1M input tokens for Claude 3.5 Sonnet: 10 req/s × 50,000 tokens = 500,000 tokens/second = $7.50/second = $27,000/hour

**Or**: A single misconfigured batch job loads full patient histories for all 500 active encounters and sends them all to the LLM in a single batch operation.

### Detection Metrics

| Metric | Description | Alert Threshold |
|---|---|---|
| `velya_llm_input_tokens_total` | Total input tokens per agent type per hour | > 2× baseline for that hour |
| `velya_llm_requests_per_minute` | LLM API requests per minute per agent | > 60 req/min per agent (1/second) |
| `velya_llm_cost_estimate_hourly` | Running cost estimate (token count × price model) | > $500/hour total across all agents |
| `velya_llm_p95_tokens_per_request` | 95th percentile token count per request | > 50,000 tokens (configured max) |

### Alert Thresholds

```yaml
# infra/kubernetes/monitoring/cost-alerts.yaml

- alert: VelyaLLMCostRunaway
  expr: velya_llm_cost_estimate_hourly > 500
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "LLM cost exceeding $500/hour — possible runaway"
    runbook: docs/runbooks/llm-cost-runaway.md

- alert: VelyaAgentCallRateHigh
  expr: rate(velya_llm_requests_total[1m]) > 1  # per agent
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "Agent {{ $labels.agent_id }} calling LLM more than once per second"

- alert: VelyaLLMTokenBudget80Percent
  expr: velya_llm_daily_tokens_used / velya_llm_daily_token_budget > 0.8
  for: 0m
  labels:
    severity: warning
  annotations:
    summary: "LLM daily token budget 80% consumed — monitor closely"
```

### Automated Circuit Breaker

```typescript
// platform/ai-gateway/src/cost/circuit-breaker.ts

interface AgentTokenBudget {
  agentId: string;
  dailyTokenBudget: number;       // Configured per agent type
  hourlyTokenBudget: number;      // Configured per agent type
  currentDailyUsage: number;      // Tracked in Redis
  currentHourlyUsage: number;
}

const AGENT_BUDGETS: Record<string, AgentTokenBudget> = {
  'discharge-coordinator-agent': {
    dailyTokenBudget: 5_000_000,  // ~$75/day at claude-3-5-sonnet pricing
    hourlyTokenBudget: 500_000,
    // ...
  },
  'early-warning-agent': {
    dailyTokenBudget: 2_000_000,  // Smaller context; more frequent calls
    hourlyTokenBudget: 200_000,
    // ...
  },
  // All 18 agents configured explicitly
};

async function enforceTokenBudget(agentId: string, estimatedTokens: number): Promise<void> {
  const budget = AGENT_BUDGETS[agentId];
  
  if (!budget) {
    throw new Error(`Unknown agent ${agentId} — no budget configured; blocking call`);
  }

  const usage = await redisClient.get(`token_usage:${agentId}:${today()}`);
  
  if (usage + estimatedTokens > budget.dailyTokenBudget) {
    // DEGRADED: Alert, then block if > 110% of budget
    await alerting.fire('agent_budget_exceeded', { agentId, budget: budget.dailyTokenBudget, usage });
    
    if (usage + estimatedTokens > budget.dailyTokenBudget * 1.1) {
      throw new BudgetExceededError(`Agent ${agentId} daily budget exceeded; clinical review required to override`);
    }
    
    // Between 100% and 110%: allow but alert
    logger.warn('Agent budget exceeded threshold; allowing with alert', { agentId });
  }
}
```

### Manual Kill Switch

```bash
# Emergency: immediately disable all LLM calls for a specific agent
kubectl annotate deployment agent-orchestrator \
  velya.io/agent-disable-list="discharge-coordinator-agent,bed-allocation-agent" \
  -n velya-dev-agents

# Emergency: disable ALL LLM calls (complete AI shutdown)
kubectl annotate configmap ai-gateway-config \
  velya.io/emergency-llm-shutdown="true" \
  -n velya-dev-agents
```

### Monthly Budget Cap

| Agent Group | Monthly Token Budget | Estimated Monthly Cost |
|---|---|---|
| Clinical agents (4 agents) | 50M tokens/month | ~$750/month |
| Operational agents (6 agents) | 20M tokens/month | ~$300/month |
| Background agents (8 agents) | 10M tokens/month | ~$150/month |
| **Total AI API budget** | **80M tokens/month** | **~$1,200/month** |

AWS Billing alert configured at $1,500/month for Anthropic API (via cost allocation tags if available, or manual tracking against invoice).

---

## Category 2: Autoscaling Cost Runaway

### Risk Scenario

A miscalibrated KEDA ScaledObject responds to a brief NATS message spike by scaling a service to its maximum replica count. The spike resolves but scale-down is slow (default KEDA cooldown is 5 minutes). Cost of 30 pods running for 30 minutes instead of 3 pods.

**Or**: A KEDA scaler source (NATS exporter) reports an inflated lag metric due to a bug, causing KEDA to scale to maximum and stay there until the source is fixed.

### Detection Metrics

| Metric | Description | Alert Threshold |
|---|---|---|
| `kube_deployment_spec_replicas` | Current replica count per deployment | > 80% of maxReplicaCount |
| `keda_scaler_metrics_value` | KEDA scaler metric value | Sudden spike > 10× baseline |
| `velya_autoscale_cost_estimate` | Cost estimate based on current replica × instance cost | > 150% of baseline |
| `kube_horizontalpodautoscaler_spec_max_replicas` | Max replicas configured | Verify max is always set |

### Alert Thresholds

```yaml
- alert: VelyaScalingAtMaxReplicas
  expr: kube_deployment_spec_replicas / kube_deployment_spec_max_replicas > 0.8
  for: 10m
  annotations:
    summary: "Service {{ $labels.deployment }} at 80% max replicas for 10 minutes"

- alert: VelyaKEDAScalerSpike
  expr: delta(keda_scaler_metrics_value[5m]) > 100
  for: 0m
  annotations:
    summary: "KEDA scaler metric spike detected — verify not a bug"

- alert: VelyaScaledownStuck
  expr: kube_deployment_spec_replicas > kube_deployment_status_replicas_available * 1.5
  for: 15m
  annotations:
    summary: "Service may be stuck at high replica count — check KEDA cooldown"
```

### Automated Circuit Breaker

All KEDA ScaledObjects must include:

```yaml
spec:
  minReplicaCount: 1
  maxReplicaCount: 10  # MANDATORY — no unbounded scaling
  cooldownPeriod: 300  # 5 minutes between scale-down decisions
  pollingInterval: 30  # Check metric every 30 seconds
  fallback:
    failureThreshold: 3  # If scaler fails 3 times, use fallback
    replicas: 2          # Fallback replica count (not 0, not max)
  advanced:
    restoreToOriginalReplicaCount: false
    scalingModifiers:
      formula: "q - 1"  # Smooth scaling formula
      target: "5"       # Trigger at 5 messages per replica
```

### Manual Kill Switch

```bash
# Freeze a deployment at current replica count (prevent further scaling)
kubectl annotate hpa velya-patient-flow \
  autoscaling.alpha.kubernetes.io/conditions='[{"type": "ScalingActive", "status": "False"}]' \
  -n velya-dev-clinical

# Or: patch KEDA ScaledObject to fixed replica count for emergency
kubectl patch scaledobject patient-flow-scaler -n velya-dev-clinical \
  --type='json' -p='[{"op": "replace", "path": "/spec/maxReplicaCount", "value": 2}]'
```

### Per-Service Replica Limits

| Service | minReplicaCount | maxReplicaCount | Rationale |
|---|---|---|---|
| patient-flow-service | 2 | 20 | HA minimum; max for 500-bed hospital |
| discharge-orchestrator | 1 | 10 | Temporal handles concurrency |
| task-inbox-service | 2 | 15 | Task routing scales with task volume |
| api-gateway | 2 | 30 | Ingress scaling; most variable load |
| ai-gateway | 1 | 8 | LLM calls are token-limited; replicas help concurrency |
| velya-web | 2 | 20 | Frontend scales with concurrent users |
| early-warning-agent | 1 | 5 | Limited by LLM token budget |
| All other agents | 1 | 5 | Constrained by token budget |

---

## Category 3: Observability Cost Runaway

### Risk Scenario

A NestJS service begins logging at DEBUG level with a high-cardinality label (e.g., including patient handle in every metric label). Prometheus's time-series database grows exponentially. Loki receives 100× normal log volume. Both exceed storage capacity and begin charging for additional S3 storage.

### Detection Metrics

| Metric | Description | Alert Threshold |
|---|---|---|
| `prometheus_tsdb_head_series` | Total Prometheus time series | > 500,000 series (cardinality limit) |
| `prometheus_tsdb_storage_blocks_bytes` | Prometheus storage usage | > 80% of allocated volume |
| `loki_ingester_streams_active` | Active Loki log streams | > 10,000 streams |
| `loki_distributor_lines_received_total` | Log lines received per second | > 10,000 lines/second sustained |

### Log Retention Limits

```yaml
# infra/kubernetes/monitoring/loki-config.yaml
limits_config:
  ingestion_rate_mb: 16          # 16 MB/s per tenant
  ingestion_burst_size_mb: 32    # Burst to 32 MB/s
  max_streams_per_user: 10000    # Max 10k active streams
  retention_period: 720h          # 30 days

compactor:
  retention_enabled: true
  retention_delete_delay: 2h
  working_directory: /data/loki/compactor
```

### Metric Cardinality Controls

```yaml
# Prometheus cardinality limits
# Add to kube-prometheus-stack values
prometheus:
  prometheusSpec:
    enforcedSampleLimit: 500000       # Reject samples beyond 500k total series
    enforcedLabelLimit: 30            # Max 30 labels per metric
    enforcedLabelNameLengthLimit: 50  # Max label name length
    enforcedLabelValueLengthLimit: 100 # Max label value length
```

**Forbidden metric label patterns**:
- Patient IDs, patient handles — NEVER as metric label values
- Request IDs — use only as trace context, not metric labels
- Full URL paths with query parameters — aggregate to path template

### Trace Sampling Rates

| Environment | Trace Sampling Rate | Rationale |
|---|---|---|
| kind dev | 100% | Full visibility for debugging |
| EKS staging | 10% | Representative sample; lower cost |
| EKS production | 1% head-based + 100% for errors | Cost-effective; all errors captured |

```yaml
# OTel Collector sampling configuration
processors:
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: error-policy
        type: status_code
        status_code:
          status_codes: [ERROR]
        # Always sample errors
      - name: slow-policy
        type: latency
        latency:
          threshold_ms: 1000
        # Always sample requests > 1s
      - name: probabilistic-policy
        type: probabilistic
        probabilistic:
          sampling_percentage: 1
        # 1% of remaining traces
```

### Monthly Budget Cap for Observability

| Component | Monthly Cost Estimate | Alert at |
|---|---|---|
| Prometheus storage (EKS EBS) | ~$50/month (100GB) | > $75/month |
| Loki storage (S3) | ~$30/month (1TB @ $0.023/GB) | > $50/month |
| Grafana Cloud (if used) | ~$0 (free tier) | N/A |
| **Total observability** | **~$80/month** | **> $150/month** |

---

## Category 4: Storage Cost Runaway

### Risk Scenario

Backup retention policy is not configured; RDS automated backups accumulate indefinitely. Container image ECR registry fills with old tags; no lifecycle policy. Loki S3 bucket accumulates logs beyond retention period.

### Backup Retention Limits

| Storage Type | Retention Target | Lifecycle Policy |
|---|---|---|
| RDS automated backup | 35 days | RDS console: 35-day retention (auto-deletes older) |
| RDS manual snapshot | 90 days | S3 lifecycle: transition to Glacier at 30 days; delete at 90 days |
| Velero cluster backup | 30 days | Velero backup TTL: `--ttl 720h` |
| Loki logs (S3) | 30 days | S3 lifecycle: delete objects > 30 days in loki-logs bucket |
| Prometheus metrics (long-term, S3) | 1 year | S3 lifecycle: delete objects > 365 days |
| Audit logs (S3, immutable) | 7 years | S3 Object Lock: COMPLIANCE mode, 7-year retention |
| ECR non-release images | 90 days | ECR lifecycle policy: expire untagged images > 7 days; expire non-release tags > 90 days |
| ECR release images | 2 years | ECR lifecycle: retain 20 most recent release tags |

### ECR Lifecycle Policy

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Expire untagged images",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 7
      },
      "action": {"type": "expire"}
    },
    {
      "rulePriority": 2,
      "description": "Keep last 20 release images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["v"],
        "countType": "imageCountMoreThan",
        "countNumber": 20
      },
      "action": {"type": "expire"}
    }
  ]
}
```

### Storage Cost Alerts

```yaml
- alert: VelyaECRStorageHigh
  expr: aws_ecr_repository_storage_bytes > 50e9  # 50 GB
  for: 24h
  annotations:
    summary: "ECR storage exceeding 50GB — run lifecycle policy"

- alert: VelyaS3AuditBucketUnexpectedGrowth
  expr: delta(aws_s3_bucket_size_bytes{bucket="velya-audit-logs"}[7d]) / aws_s3_bucket_size_bytes > 0.5
  for: 0m
  annotations:
    summary: "Audit log bucket growing faster than expected — investigate"
```

---

## Category 5: GitHub Actions Cost Runaway

### Risk Scenario

A workflow configuration error causes an infinite retry loop. 100 workflow runs execute per hour. Each run uses 10 minutes of GitHub Actions time. At GitHub Team tier (free for open source but billed for private), this consumes the monthly allocation in hours.

### Workflow Timeout Limits

All GitHub Actions workflows must include top-level and job-level timeouts:

```yaml
# .github/workflows/ci.yaml
name: CI

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true    # Cancel superseded runs

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 30       # MANDATORY: no unbounded job runtime
    
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    
  security-scan:
    runs-on: ubuntu-latest
    timeout-minutes: 15

  # Total workflow timeout
  # sum of critical path jobs; adjust based on actual timing
```

### Concurrent Job Limits

```yaml
# Prevent runaway concurrent jobs
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false  # For main branch: don't cancel running deploy

# For PRs: cancel previous run for same PR
concurrency:
  group: pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

### Monthly GitHub Actions Budget

| Workflow | Avg Duration | Estimated Runs/Month | Estimated Minutes/Month |
|---|---|---|---|
| CI (pr + push) | 15 min | 200 runs | 3,000 min |
| Security scan | 10 min | 100 runs | 1,000 min |
| Release pipeline | 20 min | 20 runs | 400 min |
| Version bump | 5 min | 20 runs | 100 min |
| **Total** | | | **4,500 min/month** |

GitHub Team: 3,000 min/month included; overage at $0.008/minute = estimated $12/month overage.

---

## Category 6: AWS EKS Cost Controls

### Node Type Selection Policy

| Workload Class | Recommended Instance | Justification |
|---|---|---|
| Clinical services | m6i.xlarge (4 CPU, 16GB) | Predictable load; reserved instances viable |
| AI/agent runtime | m6i.2xlarge (8 CPU, 32GB) | CPU-intensive for LLM processing |
| Observability | r6i.large (2 CPU, 16GB) | Memory-intensive for Prometheus/Loki |
| Web/ingress | t3.medium (2 CPU, 4GB) | Bursty; light CPU |
| Batch agents | m6i.xlarge Spot | Interruptible; cost reduction 70% |

### Spot Instance Strategy

Non-clinical-critical workloads (batch agents, market intelligence, report generation) must use Spot instances:

```yaml
# Karpenter NodePool for batch workloads
spec:
  template:
    spec:
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot"]
        - key: node.kubernetes.io/instance-type
          operator: In
          values: ["m6i.xlarge", "m6i.large", "m5.xlarge", "m5.large"]  # Multiple types for spot availability
```

**Clinical services must NEVER run on Spot instances.** A Spot interruption during patient discharge processing is a patient safety risk.

### Reserved Instance / Savings Plan Policy

For EKS production:
- Compute Savings Plans at 1-year term for baseline clinical node capacity
- On-demand for peak capacity buffers (up to 2× baseline for emergency surge)
- Spot for all batch and background workloads

### AWS Cost Alerting

```yaml
# AWS Budgets (configured via OpenTofu)
resource "aws_budgets_budget" "velya_monthly" {
  name         = "velya-monthly-total"
  budget_type  = "COST"
  limit_amount = "10000"    # $10,000/month total AWS spend
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80          # Alert at 80% of budget
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["cto@velya.io", "platform@velya.io"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = ["cto@velya.io"]
  }
}

resource "aws_budgets_budget" "velya_eks" {
  name         = "velya-eks-compute"
  budget_type  = "COST"
  limit_amount = "5000"     # $5,000/month for compute
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  
  cost_filter {
    name   = "Service"
    values = ["Amazon Elastic Kubernetes Service", "Amazon EC2"]
  }
}
```

---

## Cost Runaway Control Summary Dashboard

| Category | Detection Metric | Alert Threshold | Circuit Breaker | Kill Switch | Monthly Budget |
|---|---|---|---|---|---|
| AI Inference | `velya_llm_cost_estimate_hourly` | > $500/hour | Per-agent token budget exhaustion → alert then degrade | kubectl annotate deployment — disable agent | ~$1,200/month |
| Autoscaling Compute | `kube_deployment_spec_replicas / max` | > 80% for 10 min | KEDA ScaledObject maxReplicaCount hard limit | kubectl patch ScaledObject — freeze at N | EKS-dependent |
| Observability | `prometheus_tsdb_head_series` | > 500,000 series | Prometheus enforcedSampleLimit | kubectl scale prometheus --replicas=0 (emergency) | ~$80/month |
| Storage | S3/ECR size alerts | > defined threshold | S3 lifecycle policies auto-delete | Manual S3 lifecycle trigger | ~$100/month |
| GitHub Actions | Workflow runtime | > 30 min per job | Job-level timeout-minutes | Repository Actions settings — disable | ~$12/month overage |
| EKS Compute | AWS Budgets | > 80% of $5,000 | Spot termination policy; Savings Plans cap | AWS EC2 Auto Scaling — set max capacity | ~$5,000/month |

---

*Cost controls are reviewed monthly by the Platform Team lead. Any circuit breaker that fires must be reviewed within 24 hours to determine root cause. If a circuit breaker fires for a clinical AI service, the Clinical Medical Officer must be notified within 1 hour.*
