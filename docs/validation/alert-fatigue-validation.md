# Alert Fatigue Validation
**Velya Hospital AI Platform**
**Document Type:** Alerting System Validation
**Date:** 2026-04-08
**Classification:** Internal — Restricted
**Status:** Active — Critical Gaps Identified

---

## 1. Current Alert Inventory

The following PrometheusRules are currently defined in the Velya platform:

| Alert Name | Expression | Severity | For Duration | Purpose |
|---|---|---|---|---|
| VelyaServiceDown | `up{job=~"velya-.*"} == 0` | critical | 1m | Detect when any Velya service becomes unreachable to Prometheus |
| VelyaHighCPU | `rate(process_cpu_seconds_total{job=~"velya-.*"}[5m]) > 0.8` | warning | 5m | Detect sustained high CPU on any Velya service |
| VelyaHighMemory | `process_resident_memory_bytes{job=~"velya-.*"} > 500e6` | warning | 5m | Detect memory over 500MB on any Velya service |
| VelyaPatientFlowDown | `up{job="patient-flow-service"} == 0` | critical | 30s | Service-specific alert for patient-flow-service |
| VelyaDischargeDown | `up{job="discharge-orchestrator"} == 0` | critical | 30s | Service-specific alert for discharge-orchestrator |

**Total alerts defined:** 5
**Alerts with confirmed Alertmanager routing:** 0 (routing configuration unverified)
**Alerts with runbooks:** 0
**Alerts with SLA targets:** 0

---

## 2. Alert Fatigue Risk Assessment

### 2.1 Volume Assessment

Current alert volume is low (5 alerts), which sounds safe but represents a different kind of alert fatigue problem: **the illusion of coverage**. When on-call engineers see a small set of simple infrastructure alerts, they assume the alerting system is comprehensive. Clinical staff see no alerts at all (correct — they shouldn't receive infrastructure alerts, but they also receive no clinical alerts). The volume problem is not noise but silence: critical clinical conditions will produce no alert.

### 2.2 Severity Distribution

| Severity | Count | % |
|---|---|---|
| Critical | 3 | 60% |
| Warning | 2 | 40% |
| Info | 0 | 0% |

The high proportion of critical-severity alerts in a small alert set is a fatigue risk. When every alert is critical, and alerts fire frequently on infrastructure issues (VelyaHighCPU fires on any service under load), the critical severity becomes desensitized. Operators begin acknowledging critical alerts reflexively.

### 2.3 Actionability Assessment

| Alert | Actionable? | Action Defined? | Notes |
|---|---|---|---|
| VelyaServiceDown | Partially | No | "A service is down" — what action? Which team? What's the recovery procedure? |
| VelyaHighCPU | No | No | High CPU during normal operation is expected. Threshold not calibrated to actual baselines. |
| VelyaHighMemory | No | No | 500MB threshold is arbitrary. NestJS services in scaffold mode will not approach this; real services may exceed it normally. |
| VelyaPatientFlowDown | Yes | No | Actionable intent but no defined response owner or recovery procedure |
| VelyaDischargeDown | Yes | No | Same — actionable intent, no defined response |

**Result:** 2 of 5 alerts have actionable intent. None have defined action procedures.

### 2.4 Routing Assessment

Alertmanager is deployed as part of kube-prometheus-stack-54.0.0. No custom Alertmanager configuration has been applied. Default routing sends all alerts to the default receiver, which in a default installation has no configured endpoints (no Slack, no PagerDuty, no email). All 5 alerts are currently firing into a black hole.

**Alert routing fidelity: 0%**

---

## 3. Current Gaps

### 3.1 No Clinical Alerts

The most critical gap. The alerting system has zero clinical-domain alerts. No alert fires for:
- Patient in critical status with no assigned clinician
- Discharge blocker added but discharge workflow already in progress
- Lab result with critical value unacknowledged after 15 minutes
- Patient length of stay exceeding expected by > 24 hours
- Deteriorating vital sign trend crossing a threshold

Clinical alerts are the primary purpose of a hospital AI platform. Their absence means the alerting system provides no clinical safety net.

### 3.2 No AI Behavior Alerts

No alert fires for:
- AI recommendation made with confidence below threshold
- Agent taking an action that required policy override
- AI inference latency exceeding clinical response time SLA
- Agent invocation rate exceeding expected baseline (potential attack or runaway)
- Memory-service write rate anomaly (potential poisoning)
- Anthropic API error rate increase

### 3.3 No Agent-Level Alerts

No alert fires for:
- Agent stuck in retry loop
- Agent self-validation detected
- Agent quarantine triggered
- Agent producing outputs flagged by policy-engine
- Decision log write failure (audit gap)
- Agent consuming from wrong NATS subject

### 3.4 No Cost Alerts

No alert fires for:
- Daily Anthropic API spend exceeding threshold
- Per-agent token consumption rate anomaly
- Unexpected increase in AI inference call volume

---

## 4. Alert Quality Criteria

Every alert in the Velya platform must meet the following criteria before it is considered production-grade:

| Criterion | Description | How to Verify |
|---|---|---|
| **Actionable** | The alert tells the receiver what to do, not just what happened | Review: "If I received this alert at 3am, would I know what to do?" |
| **Routed correctly** | Alert reaches the right audience (clinical staff, ops engineer, on-call) | Test: Trigger the alert and verify the notification reaches the correct receiver |
| **Has a runbook** | A linked runbook exists with step-by-step response procedure | Check: `annotations.runbook_url` field in PrometheusRule is non-empty and resolves |
| **Has SLA** | The alert has a defined response time SLA (e.g., acknowledge within 5 minutes) | Check: `annotations.sla` field defined in PrometheusRule |
| **Calibrated threshold** | The threshold is based on measured baselines, not guesses | Evidence: Baseline metric values recorded before threshold set |
| **Not duplicate** | Alert does not fire simultaneously with another alert that covers the same condition | Test: Fire condition and verify only the most specific alert fires |
| **Recovers cleanly** | Alert resolves automatically when the condition clears | Test: Resolve the condition and verify alert state returns to green |
| **Low false positive rate** | Alert fires < 5% of the time on non-actionable conditions | Measure: Track alert-to-action ratio over 30 days |

**Current compliance:** 0 of 5 alerts meet all 8 criteria.

---

## 5. Alert Routing Design for Hospital Context

Hospital alerting requires routing to three distinct audiences with different needs, escalation paths, and technical access:

### 5.1 Clinical Staff Alerts

**Audience:** Nurses, physicians, ward coordinators
**Channel:** In-app notification in velya-web (not email, not Slack — clinical staff are at bedsides)
**Characteristics needed:**
- Visible in the task inbox with CRITICAL visual treatment
- Human-language description (not "VelyaPatientFlowDown" but "Patient Flow system is unavailable — new admissions cannot be processed")
- Clear owner (which ward, which patient, which clinician)
- One-click action to acknowledge or escalate
- Auto-escalation if not acknowledged within SLA

**Current state:** No clinical alerts exist. Clinical staff receive zero notifications from the platform.

### 5.2 Operations Team Alerts

**Audience:** Platform engineers, DevOps, SREs
**Channel:** Slack `#velya-alerts` + PagerDuty for critical
**Characteristics needed:**
- Alert includes service name, namespace, pod count, and a direct link to the Grafana dashboard
- Runbook link in the alert body
- Distinguish between "service degraded" and "service down"
- Auto-group related alerts (if NATS is down, don't page separately for every downstream service)

**Current state:** Alertmanager has no Slack or PagerDuty receiver configured. Alerts are not delivered.

### 5.3 On-Call Engineer Alerts (Night/Weekend)

**Audience:** On-call engineer (potentially a single person covering the full platform)
**Channel:** PagerDuty with phone call escalation after 5 minutes of silence
**Characteristics needed:**
- Only true emergencies (service down, data loss risk, clinical safety impact)
- No warning-level alerts should page on-call
- Alert must include enough context to act without needing a second lookup
- Recovery procedure must be accessible without VPN (runbook in public ops documentation)

**Current state:** No on-call rotation configured. No PagerDuty integration. All critical alerts fire into default Alertmanager receiver.

---

## 6. Runbook Coverage

| Alert | Runbook Link | Runbook Exists | Runbook Quality |
|---|---|---|---|
| VelyaServiceDown | Not defined | No | N/A |
| VelyaHighCPU | Not defined | No | N/A |
| VelyaHighMemory | Not defined | No | N/A |
| VelyaPatientFlowDown | Not defined | No | N/A |
| VelyaDischargeDown | Not defined | No | N/A |

**Runbook coverage: 0% (0 of 5 alerts)**

Every production alert must have a runbook accessible from the alert notification. Minimum runbook content:
1. What this alert means in plain language
2. Immediate triage steps (what to check first)
3. Common causes and their remediation
4. Escalation path if the runbook doesn't resolve it
5. How to verify the alert has resolved

---

## 7. Alert Noise Score

The alert noise score estimates the false positive rate — how often an alert fires when no action is required.

| Alert | Estimated False Positive Rate | Reason |
|---|---|---|
| VelyaHighCPU | ~60% | 80% CPU threshold is too low for NestJS during normal startup and scheduled tasks |
| VelyaHighMemory | ~20% | 500MB threshold may be exceeded normally by NestJS with full clinical data sets |
| VelyaServiceDown | ~5% | Could fire during rolling restarts if pod disappears before new one is ready |
| VelyaPatientFlowDown | ~5% | Same — rolling restart window |
| VelyaDischargeDown | ~5% | Same |

**Estimated overall false positive rate: ~30%**

At a 30% false positive rate, on-call engineers will silence alerts within weeks of go-live. This is the primary vector for alert fatigue in technically well-instrumented systems: threshold miscalibration that trains humans to dismiss alerts.

---

## 8. Alert Fatigue Prevention Controls

The following controls must be implemented before the Velya alerting system goes to production:

| Control | Description | Implementation Requirement |
|---|---|---|
| **Alert grouping** | Related alerts grouped into one notification | Alertmanager `group_by` configuration per service and severity |
| **Inhibition rules** | Service-down alert suppresses all derived alerts from that service | Alertmanager `inhibit_rules` configuration |
| **Alert deduplication** | Same alert firing multiple times sends one notification | Alertmanager `repeat_interval` configuration |
| **Calibrated thresholds** | Thresholds set based on measured baselines, not defaults | Baseline measurement period before setting production thresholds |
| **Severity discipline** | Warning ≠ page on-call; only Critical pages on-call | Alertmanager routing by severity |
| **Noise review** | Monthly review of alert-to-action ratio | Grafana dashboard tracking acknowledged vs. acted-upon alerts |
| **Sunset clause** | Alerts not fired in 90 days are reviewed for removal | Governance process for alert lifecycle |
| **Clinical alert SLA** | All clinical alerts have defined acknowledgment SLA | PrometheusRule annotation + escalation policy |

---

## 9. Recommended Alert Hierarchy for Hospital Operations

### Tier 1: Patient Safety — Immediate (page on-call, notify clinical staff, SLA: acknowledge in 2 minutes)

| Alert | Trigger | Receiver |
|---|---|---|
| CriticalPatientUnattended | Critical patient status + no assigned clinician for > 10 minutes | Ward coordinator + on-call |
| DischargeBlockerViolated | Patient discharged while active discharge blocker exists | Clinical supervisor + on-call engineer |
| CriticalLabUnacknowledged | Critical lab result not acknowledged in 15 minutes | Assigned clinician + ward coordinator |
| AIDecisionWithoutValidation | Agent makes clinical decision without validator confirmation | Clinical governance + on-call engineer |

### Tier 2: Clinical Operations — Urgent (Slack + in-app, SLA: acknowledge in 15 minutes)

| Alert | Trigger | Receiver |
|---|---|---|
| PatientFlowServiceDown | patient-flow-service unreachable | Ops team + clinical ops lead |
| DischargeOrchestratorDown | discharge-orchestrator unreachable | Ops team |
| TaskInboxQueueDepthHigh | Task inbox queue depth > 50 unacknowledged | Ward coordinator |
| AgentOfficeStalled | Agent office throughput = 0 for > 5 minutes | Ops team |

### Tier 3: Platform Health — Standard (Slack, SLA: acknowledge in 60 minutes)

| Alert | Trigger | Receiver |
|---|---|---|
| VelyaServiceHighLatency | p99 latency > 2s for any clinical service | Ops team |
| NATSStreamGrowthAnomaly | NATS stream message count growth rate > 2x baseline | Ops team |
| AITokenBudgetWarning | Daily AI token spend > 80% of threshold | Ops + finance |
| LokiRetentionRisk | Loki storage > 80% capacity | Ops team |

### Tier 4: Informational — No Page (Grafana dashboard only)

- CPU/memory trends within normal bounds
- Deployment events (ArgoCD sync completed successfully)
- Scale events (KEDA scaled service up/down)
- AI inference call rate (within normal bounds)

---

## 10. Validation Score: Current Alerting State

| Dimension | Score | Max | Notes |
|---|---|---|---|
| Alert coverage — clinical | 0 | 25 | Zero clinical alerts defined |
| Alert coverage — AI/agent | 0 | 25 | Zero AI behavior alerts defined |
| Alert coverage — infrastructure | 12 | 25 | 5 alerts but all with gaps in quality |
| Alert routing | 0 | 25 | Alertmanager receiver not configured |
| Alert actionability | 5 | 25 | 2 alerts have actionable intent, no procedures |
| Runbook coverage | 0 | 25 | Zero runbooks linked |
| False positive control | 8 | 25 | 3 alerts have acceptable FP rates; 2 are noisy |
| On-call integration | 0 | 25 | No PagerDuty, no rotation, no escalation |
| **Total** | **25** | **200** | **12.5% — Pre-Production State** |

> **Conclusion:** The current alerting system provides no clinical safety coverage, no AI monitoring, no routing, and no runbooks. For a hospital AI platform, this represents a critical gap. The 5 existing PrometheusRules provide a foundation for infrastructure alerting but are not sufficient for a production clinical environment. Alert system implementation must be treated as a patient safety requirement, not a monitoring nicety.
