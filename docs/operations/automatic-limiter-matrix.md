# Automatic Limiter Matrix
**Velya Hospital AI Platform**
**Document Type:** Operational Safety — Rate Limiters and Circuit Breakers
**Date:** 2026-04-08
**Classification:** Internal — Operations Reference
**Status:** Active — Implementation Required

---

## Purpose

This matrix defines all automatic rate limiters and circuit breakers for the Velya platform. Each limiter prevents a specific class of runaway behavior. The combination of limiters forms the platform's operational safety net — the backstop that prevents a misconfiguration, a buggy agent, or an adversarial input from consuming unbounded resources or causing unbounded harm.

**Current implementation status is noted for each limiter.** Where the status is "Not Implemented," the limiter is a design requirement for the next implementation phase.

---

## Limiter Reference

---

### L-001 — AI Tokens Per Agent Per Hour

| Field | Value |
|---|---|
| **What It Limits** | Total tokens consumed by a single agent identity in a rolling 60-minute window, across all inference calls made through ai-gateway |
| **Limit Value and Window** | Default: 500,000 tokens/hour per agent. Clinical agents: 1,000,000 tokens/hour. Background/analytics agents: 100,000 tokens/hour. Configurable per agent ID in ai-gateway config. |
| **What Happens When Limit Is Hit** | ai-gateway returns `HTTP 429 Too Many Requests` with body `{"error":"AGENT_TOKEN_BUDGET_EXCEEDED","agent_id":"...","reset_at":"..."}`. In-flight requests that started before the limit was hit complete. New inference requests for that agent are rejected until the window rolls. Agent-orchestrator receives the 429 and can either queue the work or escalate to human review depending on task priority. Clinical priority requests from clinical agents may bypass the limit with an explicit override token (audited). |
| **Alert Triggered** | `VelyaAgentTokenBudgetWarning` fires at 80% of limit. `VelyaAgentTokenBudgetExceeded` fires at 100%. Both route to ops Slack channel. |
| **Monitoring Metric** | `velya_ai_tokens_consumed_total{agent_id="..."}` — counter in Prometheus, scraped from ai-gateway. Rate over 1h window monitored by Alertmanager. |
| **Override Procedure** | Clinical governance officer can issue a temporary override for a named agent via the governance API: `POST /governance/agent-limits/override`. Override expires after 4 hours. Override is logged to audit-service. Requires dual sign-off for overrides > 3x the normal limit. |
| **Current Implementation Status** | Not Implemented — ai-gateway is a scaffold. Token tracking requires middleware implementation. |

---

### L-002 — AI Tokens Per Office Per Day

| Field | Value |
|---|---|
| **What It Limits** | Total tokens consumed by all agents within a defined agent office in a calendar day (UTC) |
| **Limit Value and Window** | Default: 5,000,000 tokens/day per office. Operations-intensive offices (clinical, discharge): 10,000,000 tokens/day. Background offices (market intelligence, analytics): 1,000,000 tokens/day. Values reviewed and adjusted monthly based on actual usage. |
| **What Happens When Limit Is Hit** | All agents in the office receive `OFFICE_BUDGET_EXCEEDED` from ai-gateway. Low-priority agent tasks are deferred to the next day. High-priority tasks are queued for manual review or routed to a backup office. A notification is sent to the office manager agent and the clinical governance officer. The limit resets at 00:00 UTC. |
| **Alert Triggered** | `VelyaOfficeTokenBudgetWarning` at 70% of daily budget (fires at ~16:00 if usage is linear). `VelyaOfficeTokenBudgetCritical` at 90%. Routes to Slack ops channel + PagerDuty if clinical office is affected. |
| **Monitoring Metric** | `velya_office_ai_tokens_day_total{office="..."}` — daily counter reset at midnight UTC. Grafana Velya Agent Scorecard dashboard. |
| **Override Procedure** | Budget increase for the current day requires clinical governance officer approval. Override logged to audit-service. No override can exceed 3x the defined daily budget for any office. |
| **Current Implementation Status** | Not Implemented |

---

### L-003 — PRs Created by Agents Per Day

| Field | Value |
|---|---|
| **What It Limits** | Total pull requests opened in any repository by agent-controlled service accounts in a calendar day |
| **Limit Value and Window** | 10 PRs/day across all agents and all repositories. Individual agent limit: 3 PRs/day. |
| **What Happens When Limit Is Hit** | Agent is blocked from calling the GitHub API PR creation endpoint. Pending PR creation work is queued. A notification is sent to the responsible agent office manager. The agent's task is marked `PENDING_PR_QUOTA_RESET` in task-inbox-service. Limit resets at 00:00 UTC. |
| **Alert Triggered** | `VelyaAgentPRRateLimitReached` fires immediately when any agent exceeds 3 PRs/day. Routes to platform engineer Slack channel. |
| **Monitoring Metric** | `velya_agent_prs_created_day_total{agent_id="..."}` — tracked in agent-orchestrator via GitHub API audit logging |
| **Override Procedure** | Platform engineer can manually increase the daily limit for a specific agent via the agent-orchestrator admin API. Override requires documented reason and expires at end of day. |
| **Current Implementation Status** | Not Implemented — requires GitHub API wrapper with count tracking in agent-orchestrator |

---

### L-004 — Tasks Created by Agents Per Hour

| Field | Value |
|---|---|
| **What It Limits** | Total tasks published to `velya.task.create` by any non-human (agent or automated service) in a 60-minute rolling window |
| **Limit Value and Window** | 50 tasks/hour aggregate across all agents. Per-agent limit: 20 tasks/hour. Burst tolerance: 30 tasks in any 5-minute window before the hourly limit is checked. |
| **What Happens When Limit Is Hit** | NATS authorization for the `velya.task.create` subject is rate-limited at the broker level. Excess publishes receive a NATS error. agent-orchestrator catches the error, queues the task creation work internally, and retries at 1-minute intervals. If internal queue exceeds 200 items, a clinical governance alert fires. Human-initiated task creation (from velya-web API calls) bypasses this limit. |
| **Alert Triggered** | `VelyaTaskCreationRateLimitHit` fires when any agent hits 80% of its per-hour limit. `VelyaTaskCreationFlood` fires if aggregate rate > 2x the combined per-agent limit (indicating multiple agents flooding simultaneously). |
| **Monitoring Metric** | `velya_task_creation_rate{source="agent",agent_id="..."}` — rate counter in Prometheus from task-inbox-service |
| **Override Procedure** | No runtime override for task creation rate. If a legitimate high-volume clinical event requires high task creation (e.g., mass casualty incident), the rate limit is adjusted in the ConfigMap and agent-orchestrator is restarted. |
| **Current Implementation Status** | Not Implemented — NATS authorization rate limiting not configured |

---

### L-005 — NATS Events Published Per Service Per Second

| Field | Value |
|---|---|
| **What It Limits** | Event publication rate from any single Velya service to NATS JetStream in a 1-second window |
| **Limit Value and Window** | 100 events/second per service. Burst: 200 events/second for up to 5 seconds. After burst window, throttled to 50 events/second until 10 seconds of normal rate is observed. |
| **What Happens When Limit Is Hit** | NATS server applies per-connection rate limiting. Excess publishes receive `NATS_MAX_RATE_EXCEEDED`. Services handle this with exponential backoff (100ms base, 2x multiplier, 5s max, 3 retries). If publish backpressure accumulates for > 30 seconds, the service enters a degraded mode and logs a warning. After 5 minutes of sustained throttling, a circuit breaker opens and the service publishes a self-health event on a separate unthrottled control subject. |
| **Alert Triggered** | `VelyaNATSPublishRateLimitHit` fires when a service hits the limit for > 10 consecutive seconds. Routes to ops Slack. |
| **Monitoring Metric** | `velya_nats_publish_rate_per_second{service="..."}` — measured at NATS server and scraped by Prometheus |
| **Override Procedure** | Rate limits configured in NATS server config. Changing requires a NATS configuration update and rolling restart. Override is an infrastructure change with full GitOps review. |
| **Current Implementation Status** | Not Implemented — NATS rate limiting requires server-side configuration |

---

### L-006 — Retry Attempts Per Circuit Breaker

| Field | Value |
|---|---|
| **What It Limits** | Number of consecutive retry attempts before a circuit breaker opens for any outbound call from a Velya service (HTTP, database, NATS, Anthropic API) |
| **Limit Value and Window** | Open after 5 consecutive failures within a 30-second window. Half-open after 30 seconds (allow 1 test request). Close after 3 consecutive successes in half-open state. |
| **What Happens When Limit Is Hit** | Circuit breaker opens. All calls to the affected downstream immediately return a `CIRCUIT_OPEN` error without making the network call. The service returns its defined fallback response (see ai-safety.md fallback requirements). After 30 seconds, circuit transitions to half-open. |
| **Alert Triggered** | `VelyaCircuitBreakerOpen{service="...",target="..."}` fires immediately when any circuit opens. Routes to ops Slack and PagerDuty (critical severity if the target is a clinical service). |
| **Monitoring Metric** | `velya_circuit_breaker_state{service="...",target="..."}` — gauge: 0=closed, 1=half-open, 2=open. From NestJS application metrics. |
| **Override Procedure** | Circuit breaker can be manually reset to closed state via the service's admin endpoint: `POST /admin/circuit-breaker/reset?target=<target>`. Requires platform engineer authorization. Override is logged. |
| **Current Implementation Status** | Not Implemented — requires circuit breaker library integration in NestJS services (e.g., opossum). Defined in architecture rules but not installed. |

---

### L-007 — Autoscale Events Per Hour Per Service

| Field | Value |
|---|---|
| **What It Limits** | Number of KEDA-triggered scaling events (scale-up or scale-down) for any single service in a 60-minute rolling window |
| **Limit Value and Window** | 6 scaling events/hour per service. Minimum time between consecutive scaling events: 5 minutes (stabilization window). No more than 2 scale-down events per service per hour. |
| **What Happens When Limit Is Hit** | KEDA's `stabilizationWindowSeconds` configuration prevents additional scaling events within the window. Service maintains its current replica count. A KEDA `ScaledObject status` event is recorded. If the underlying load condition persists beyond the stabilization window, a scaling event is allowed. |
| **Alert Triggered** | `VelyaScalingOscillation` fires if > 4 scaling events are detected for a single service within a 30-minute window (indicates thrashing). Routes to ops Slack for investigation. |
| **Monitoring Metric** | `keda_scaler_active{scaledObject="..."}` and `keda_scaler_errors` — from KEDA's own Prometheus metrics |
| **Override Procedure** | Stabilization window adjusted in the ScaledObject spec via GitOps PR. No runtime override. |
| **Current Implementation Status** | Not Applicable — no ScaledObjects are deployed. Limiter design is ready for when ScaledObjects are created. |

---

### L-008 — GitHub Actions Concurrent Runs

| Field | Value |
|---|---|
| **What It Limits** | Number of GitHub Actions workflow runs executing simultaneously, to prevent resource contention and prevent agent-driven PR floods from consuming all CI capacity |
| **Limit Value and Window** | Maximum 3 concurrent runs per workflow. Maximum 10 concurrent runs across all Velya workflows. Agent-triggered runs share a separate concurrency group that caps at 2 concurrent runs. |
| **What Happens When Limit Is Hit** | GitHub Actions applies the concurrency group configuration. Pending runs wait in queue. If queue depth exceeds 5 runs waiting, an alert fires. Human-initiated runs from `main` branch protection can override agent-triggered run priority. |
| **Alert Triggered** | `VelayaActionsQueueDepthHigh` fires when > 5 runs are queued. Routes to platform engineer Slack. |
| **Monitoring Metric** | GitHub Actions API: `GET /repos/{owner}/{repo}/actions/runs?status=queued` — polled by a monitoring job every 5 minutes |
| **Override Procedure** | Concurrency group settings are in `.github/workflows/*.yml`. Changes require GitOps PR. Emergency override: cancel pending runs via `gh run cancel <run-id>`. |
| **Current Implementation Status** | Not Implemented — concurrency groups not configured in GitHub Actions workflow files |

---

### L-009 — Ingress Requests Per Service Per Second

| Field | Value |
|---|---|
| **What It Limits** | HTTP request rate to any Velya service via nginx-ingress, to prevent DoS and to protect services from traffic spikes during clinical peak periods |
| **Limit Value and Window** | velya-web: 200 requests/second. api-gateway: 100 requests/second. Individual backend services: 50 requests/second (not typically publicly routed, but a backstop). Authenticated clinician sessions: no additional per-user limit (within the aggregate limit). Unauthenticated: 5 requests/second per IP. |
| **What Happens When Limit Is Hit** | nginx-ingress returns `HTTP 429 Too Many Requests` with `Retry-After: 5` header. Authenticated clinical users receive a user-friendly rate limit message in velya-web. The 429 is recorded in nginx access logs. If a specific IP reaches the unauthenticated limit, that IP is temporarily blocked for 60 seconds. |
| **Alert Triggered** | `VelyaIngressRateLimitHit` fires when aggregate rate limit is reached at the service level. Routes to ops Slack. |
| **Monitoring Metric** | `nginx_ingress_controller_requests{status="429",service="..."}` — from nginx-ingress Prometheus exporter |
| **Override Procedure** | Rate limits configured via nginx-ingress annotations on the Ingress resource: `nginx.ingress.kubernetes.io/limit-rps`. Changes require GitOps PR. Emergency temporary override: `kubectl annotate ingress <name> nginx.ingress.kubernetes.io/limit-rps=500` (no restart needed). |
| **Current Implementation Status** | Not Implemented — nginx-ingress annotations not configured |

---

### L-010 — Database Connections Per Service

| Field | Value |
|---|---|
| **What It Limits** | Number of concurrent PostgreSQL connections maintained by each Velya service, to prevent aggregate connection exhaustion (PostgreSQL default max_connections = 100) |
| **Limit Value and Window** | Per-service pool maximum: 10 connections (for low-traffic services), 20 connections (for high-traffic clinical services). Aggregate limit: 80 connections reserved for application services. 20 connections reserved for administrative access and monitoring. |
| **What Happens When Limit Is Hit** | Connection pool (TypeORM or PgBouncer) returns an error to the application: `PoolExhaustedError`. Service returns `HTTP 503 Service Unavailable` with body `{"error":"DB_POOL_EXHAUSTED","retry_after":5}`. Long-running queries that are not using connections are not affected. Connection pool implements a wait queue with a 5-second timeout before returning the error. |
| **Alert Triggered** | `VelyaDBConnectionPoolWarning` fires when any service's pool is > 80% utilized. `VelyaDBConnectionPoolExhausted` fires when a service hits its pool limit. Both route to ops Slack. |
| **Monitoring Metric** | `velya_db_connection_pool_size{service="..."}` and `velya_db_connection_pool_used{service="..."}` — from TypeORM metrics or pgbouncer stats |
| **Override Procedure** | Increase pool size via service ConfigMap: `DB_POOL_MAX=25`. Requires service restart. If aggregate connections approach PostgreSQL max, add PgBouncer as a connection pooler (see UU-008). Emergency: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < NOW() - INTERVAL '10 minutes'` |
| **Current Implementation Status** | Partially Implemented — connection pool exists via ORM but limits are not configured. Default pool sizes (often unlimited) are in use. |

---

### L-011 — Memory Usage Per Agent Context

| Field | Value |
|---|---|
| **What It Limits** | Memory allocated to the in-process context accumulation for a single agent invocation in agent-orchestrator, to prevent a single agent handling a complex multi-step workflow from consuming all available node memory |
| **Limit Value and Window** | 512MB per agent invocation context. Agent context includes: system prompt, conversation history, loaded runbooks, tool call results, patient context snapshot. If context approaches the limit during a workflow, context is summarized and compressed before continuing. |
| **What Happens When Limit Is Hit** | agent-orchestrator invokes a context compression step: the LLM is asked to summarize the conversation history into a dense summary, replacing the raw history. If the compressed context still exceeds the limit, the workflow is paused and a human review task is created in task-inbox-service explaining that the workflow exceeded complexity bounds. The workflow is not terminated — it is paused for human inspection. |
| **Alert Triggered** | `VelyaAgentContextMemoryHigh` fires when any agent context exceeds 400MB (80% threshold). Routes to ops Slack. |
| **Monitoring Metric** | `velya_agent_context_size_bytes{agent_id="..."}` — tracked in agent-orchestrator as a gauge updated at each tool call |
| **Override Procedure** | The per-context limit can be increased for specific agent types via ConfigMap: `AGENT_CONTEXT_MAX_BYTES=1073741824` (1GB). Requires agent-orchestrator restart. Note: agent-orchestrator pod must have a memory limit set higher than the per-context limit plus overhead. |
| **Current Implementation Status** | Not Implemented — agent-orchestrator is a scaffold with no context size tracking. Pod has no memory limit (see UU-013). |

---

### L-012 — Cost Per Day Per Environment

| Field | Value |
|---|---|
| **What It Limits** | Total Anthropic API spend across all agents and all inference calls in a calendar day, per deployment environment |
| **Limit Value and Window** | Development environment: $50/day. Staging: $200/day. Production: $2,000/day. Limits reset at 00:00 UTC. These are hard limits — the final backstop after per-agent (L-001) and per-office (L-002) limits. |
| **What Happens When Limit Is Hit** | ai-gateway disables all inference calls for the remainder of the day. Returns `HTTP 503 AI_DAILY_BUDGET_EXCEEDED` to all callers. An emergency alert fires to the clinical governance officer and platform engineer. Clinical-priority requests from identified critical workflow paths can bypass with an emergency override token — this token costs are still tracked but the request proceeds. All overrides are logged. |
| **Alert Triggered** | `VelyaDailyCostWarning` fires at 70% of daily limit. `VelyaDailyCostCritical` fires at 90%. `VelyaDailyCostExceeded` fires at 100% and triggers PagerDuty. All alerts route to platform engineer and finance contact. |
| **Monitoring Metric** | `velya_ai_cost_usd_day{environment="..."}` — tracked in ai-gateway by accumulating per-request token costs using the Anthropic pricing table. Published to Prometheus every minute. Grafana Velya LocalStack - AWS Services dashboard (or equivalent cost dashboard). |
| **Override Procedure** | Emergency override token issued by the clinical governance officer for the current day only. Overflow amount tracked separately. Next day's budget is not affected. Token expires at end of day. If cost overruns are recurring, the budget must be reviewed at the weekly operations meeting before the next increase. |
| **Current Implementation Status** | Not Implemented — no cost tracking exists in ai-gateway scaffold. Anthropic pricing accumulation requires middleware implementation. |

---

## Limiter Status Summary

| Limiter ID | Name | Status |
|---|---|---|
| L-001 | AI tokens per agent per hour | Not Implemented |
| L-002 | AI tokens per office per day | Not Implemented |
| L-003 | PRs created by agents per day | Not Implemented |
| L-004 | Tasks created by agents per hour | Not Implemented |
| L-005 | NATS events published per service per second | Not Implemented |
| L-006 | Retry attempts per circuit breaker | Not Implemented |
| L-007 | Autoscale events per hour per service | Not Applicable (no ScaledObjects) |
| L-008 | GitHub Actions concurrent runs | Not Implemented |
| L-009 | Ingress requests per service per second | Not Implemented |
| L-010 | Database connections per service | Partially Implemented |
| L-011 | Memory usage per agent context | Not Implemented |
| L-012 | Cost per day per environment | Not Implemented |

**11 of 12 limiters are not implemented.** This reflects the current scaffold stage of the platform. All limiters should be implemented before any production clinical use.

---

## Implementation Priority

| Priority | Limiters | Reason |
|---|---|---|
| Immediate (before any real AI calls) | L-001, L-002, L-012 | Financial safety — unbounded AI spend is the fastest path to operational disruption |
| Immediate (before real patient data) | L-011, L-004 | Clinical safety — memory exhaustion and task flooding affect all clinical services |
| Before production | L-005, L-006, L-009, L-010 | Infrastructure safety — needed for operational stability |
| Before agent automation | L-003, L-008 | Governance safety — prevent agent-driven repository flooding |
| Before autoscaling | L-007 | Only relevant when ScaledObjects are deployed |

---

## Limiter Override Audit Trail

All limiter override events must be written to audit-service with the following fields:

```json
{
  "event_type": "LIMITER_OVERRIDE",
  "limiter_id": "L-XXX",
  "limiter_name": "...",
  "override_requested_by": "user_id",
  "override_approved_by": "user_id",
  "override_reason": "...",
  "override_value": "...",
  "override_expires_at": "ISO8601",
  "clinical_context": "...",
  "incident_ref": "INC-XXX or null"
}
```
