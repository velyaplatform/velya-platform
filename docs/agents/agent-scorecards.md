# Agent Scorecards

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Knowledge & Memory Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

Agent scorecards are the primary instrument for assessing individual agent health and performance. They provide objective, consistent measurement across all agents, enable trend analysis, drive accountability, and serve as the early warning system for agent capability degradation.

Scorecards are not a ranking system. They are a health signal. A green scorecard means the agent is performing within institutional expectations. A red scorecard means the agent requires intervention — not punishment, but investigation and improvement.

---

## 2. Core Metric Definitions

### 2.1 Throughput

**Definition:** Number of tasks completed per unit time (weekly by default).  
**Measurement:** `total_tasks_completed / measurement_period_days`  
**Why it matters:** Low throughput may indicate overload, capability gaps, or excessive correction cycles consuming capacity. Very high throughput may indicate insufficient evidence collection or validation bypass.

### 2.2 Completion Quality

**Definition:** Percentage of tasks that pass first-pass validation (no correction cycle required).  
**Measurement:** `tasks_passing_first_validation / total_tasks_validated × 100`  
**Why it matters:** The primary measure of output quality. First-pass validation rate is the clearest signal of how well the agent understands and executes its role.

### 2.3 Validation Pass Rate

**Definition:** Percentage of all validation attempts (including corrections) that ultimately pass.  
**Measurement:** `total_validations_passed / total_validations_attempted × 100`  
**Why it matters:** Distinguishes between agents that never pass (fundamentally wrong) vs. agents that pass eventually but require too many correction cycles (inefficient).

### 2.4 Audit Pass Rate

**Definition:** Percentage of audited tasks that receive a clean audit finding.  
**Measurement:** `clean_audit_findings / total_audited_tasks × 100`  
**Why it matters:** The audit pass rate reflects process adherence — evidence quality, policy compliance, and governance discipline — independent of whether the technical work was correct.

### 2.5 Correction Recurrence

**Definition:** Percentage of correction cycles that address the same root cause as a prior correction in the last 90 days.  
**Measurement:** `recurring_corrections / total_corrections × 100`  
**Why it matters:** The most sensitive indicator of institutional learning failure. An agent that makes the same mistake twice has not learned; three times is a systemic defect.

### 2.6 Evidence Completeness

**Definition:** Percentage of tasks where all required evidence items (per contract) are present, correctly linked, and hash-verified.  
**Measurement:** `tasks_with_complete_evidence / total_tasks × 100`  
**Why it matters:** Evidence completeness directly determines audit readiness, regulatory compliance, and the enterprise's ability to reconstruct events. Any task without complete evidence is a governance defect.

### 2.7 Handoff Quality

**Definition:** Percentage of outbound handoffs that are accepted on first attempt (not rejected for insufficient context).  
**Measurement:** `handoffs_accepted_first_attempt / total_outbound_handoffs × 100`  
**Why it matters:** Poor handoff quality cascades through the enterprise, causing delays, lost context, and SLA breaches downstream.

### 2.8 SLA Adherence

**Definition:** Percentage of tasks and reports delivered within their defined SLA.  
**Measurement:** `deliverables_on_time / total_deliverables × 100`  
**Why it matters:** SLA adherence is the service contract of the agent enterprise. Chronic SLA breach indicates overload, inefficiency, or process dysfunction.

### 2.9 Escalation Frequency

**Definition:** Average number of escalations per task.  
**Measurement:** `total_escalations / total_tasks`  
**Why it matters:** Excessive escalation frequency indicates the agent is unable to resolve issues within its designed scope. Very low frequency (in high-complexity domains) may indicate under-escalation, which is also a defect.

### 2.10 Incident Generation Rate

**Definition:** Number of incidents caused or significantly contributed to by this agent per 30 days.  
**Measurement:** `incidents_attributed / 30_day_period`  
**Why it matters:** Incidents have broad impact. An agent that generates incidents at a higher rate than its cohort is a disproportionate risk source.

### 2.11 False Positive Rate (for Validators and Watchdogs)

**Definition:** Percentage of rejections (validator) or alerts (watchdog) that are subsequently determined to be incorrect.  
**Measurement:** `overturned_findings / total_findings × 100`  
**Why it matters:** For validators, false positives create correction cycles on correct work. For watchdogs, false positives create management noise that degrades response to real anomalies. Both represent waste and undermine trust.

### 2.12 Silent Failure Rate

**Definition:** Percentage of tasks that failed without the agent reporting the failure through formal channels.  
**Measurement:** `silent_failures_detected_externally / total_failures × 100`  
**Why it matters:** Silent failures are the most dangerous failure mode. An agent that fails silently destroys the trust foundation of the entire governance model. Any non-zero silent failure rate is an immediate investigation trigger.

### 2.13 Learning Adoption Rate

**Definition:** Percentage of propagated learning items (received in the measurement period) that the agent has acknowledged and demonstrated incorporation.  
**Measurement:** `learning_items_demonstrated / learning_items_received × 100`  
**Why it matters:** The enterprise's learning loop is only effective if agents actually incorporate lessons. Unincorporated learning represents wasted institutional investment and continued exposure to known failure modes.

---

## 3. Scoring Formula

Each metric is scored 0–100 based on its distance from the target threshold:

```
metric_score = 100 × (actual / target) if actual ≤ target (for metrics where lower = better, invert)
```

For metrics where the target is a direction (higher is better):

```
score = min(100, 100 × actual / target)
```

For metrics where lower is better (e.g., correction recurrence, incident generation):

```
score = max(0, 100 × (1 - actual / critical_threshold))
```

**Weighted composite score:**

| Metric                 | Weight                                          |
| ---------------------- | ----------------------------------------------- |
| Completion quality     | 20%                                             |
| Evidence completeness  | 15%                                             |
| Audit pass rate        | 15%                                             |
| SLA adherence          | 10%                                             |
| Silent failure rate    | 15% (inverted — any non-zero heavily penalized) |
| Learning adoption rate | 10%                                             |
| Correction recurrence  | 10%                                             |
| Handoff quality        | 5%                                              |

Additional metrics (throughput, escalation frequency, incident generation, false positive rate) are tracked and reported but do not contribute to the composite score — they are used for contextual analysis and trend identification.

---

## 4. Scoring Thresholds and Colors

| Band     | Score Range | Color     | Meaning                                                   |
| -------- | ----------- | --------- | --------------------------------------------------------- |
| Green    | 90–100      | Green     | Operating within institutional expectations               |
| Yellow   | 75–89       | Yellow    | Degraded performance; investigation required              |
| Red      | 50–74       | Red       | Significant performance deficiency; intervention required |
| Critical | 0–49        | Red/Black | Severe deficiency; immediate action required              |

---

## 5. Scorecard Review Cadence

| Review Type                     | Frequency                     | Reviewer                   | Action Authority                   |
| ------------------------------- | ----------------------------- | -------------------------- | ---------------------------------- |
| Automated score generation      | Weekly (Monday)               | Scorecard Engine           | None — informational               |
| Office Manager scorecard review | Weekly                        | Office Manager             | Initiate informal improvement plan |
| Pattern analysis (trend)        | Weekly                        | Knowledge & Memory Office  | Flag to manager                    |
| Probation determination         | Monthly                       | Office Manager + Executive | Formal probation                   |
| Quarantine consideration        | Triggered by 4 weeks critical | Office Manager             | Quarantine request                 |
| Retirement consideration        | Triggered by 8 weeks critical | Office Manager + Executive | Retirement proposal                |

---

## 6. Scorecard-Triggered Actions

| Trigger Condition                         | Action                                           | Timeline             |
| ----------------------------------------- | ------------------------------------------------ | -------------------- |
| Yellow for 2 consecutive weeks            | Office Manager informal review                   | Within 1 week        |
| Yellow for 4 consecutive weeks            | Formal improvement plan with Learning Office     | Within 2 weeks       |
| Red for 2 consecutive weeks               | Formal improvement plan + Executive notification | Within 1 week        |
| Red for 4 consecutive weeks               | Probation consideration                          | Immediate assessment |
| Critical for 1 week                       | Investigation opened                             | Within 48 hours      |
| Critical for 4 consecutive weeks          | Quarantine consideration                         | Immediate assessment |
| Critical for 8 consecutive weeks          | Retirement assessment                            | Within 1 week        |
| Silent failure rate > 0 for any week      | Immediate investigation                          | Within 24 hours      |
| Evidence completeness < 90% for any week  | Audit triggered                                  | Within 48 hours      |
| Learning adoption rate < 50% for any week | Learning Office engagement                       | Within 1 week        |

---

## 7. Scorecard Anti-Gaming Rules

The following behaviors are detected by the scoring engine and flagged as integrity violations:

| Behavior                                                                     | Detection Method                                      | Consequence                                          |
| ---------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Filing evidence after task completion (retroactive)                          | Timestamp analysis on evidence submissions            | Evidence completeness metric nulled; audit triggered |
| Splitting tasks to inflate throughput without proportional validation        | Task complexity normalization; validation ratio check | Throughput metric normalized; manager review         |
| Re-routing validations to more lenient validators                            | Validator diversity analysis                          | Routing pattern audit; manager notification          |
| Not reporting failures to keep silent failure rate at zero                   | External detection cross-reference                    | Trust flag; audit investigation                      |
| Requesting validation on low-risk work to inflate validation pass rate       | Risk class vs. validation rate analysis               | Rate normalized to risk class cohort                 |
| Filing correction reports for un-rejected work to inflate correction quality | Correction report/rejection cross-reference           | Report rejected; integrity flag                      |

---

## 8. Sample Scorecards

### 8.1 Sample Scorecard: `platform-office/infrastructure-specialist-agent`

**Week of:** 2026-04-07  
**Role Type:** Specialist

| Metric                 | Target | Actual | Score    | Band                |
| ---------------------- | ------ | ------ | -------- | ------------------- |
| Completion quality     | 95%    | 97.3%  | 100      | Green               |
| Evidence completeness  | 100%   | 100%   | 100      | Green               |
| Audit pass rate        | 98%    | 96.0%  | 98       | Green               |
| SLA adherence          | 95%    | 93.1%  | 98       | Green               |
| Silent failure rate    | 0%     | 0%     | 100      | Green               |
| Learning adoption rate | 95%    | 91.0%  | 96       | Green               |
| Correction recurrence  | <5%    | 0%     | 100      | Green               |
| Handoff quality        | 90%    | 88.0%  | 98       | Yellow (borderline) |
| **COMPOSITE SCORE**    |        |        | **99.1** | **Green**           |

**Trend:** Stable. Handoff quality slightly below target — coordinator to review context package depth.  
**Manager note:** Schedule review of handoff template completeness.

---

### 8.2 Sample Scorecard: `quality-assurance/regression-validator-agent`

**Week of:** 2026-04-07  
**Role Type:** Validator

| Metric                                   | Target | Actual | Score    | Band       |
| ---------------------------------------- | ------ | ------ | -------- | ---------- |
| Completion quality (validation accuracy) | 98%    | 94.0%  | 96       | Yellow     |
| Evidence completeness                    | 100%   | 98.5%  | 99       | Green      |
| Audit pass rate                          | 99%    | 99.0%  | 100      | Green      |
| SLA adherence                            | 95%    | 88.0%  | 93       | Yellow     |
| Silent failure rate                      | 0%     | 0%     | 100      | Green      |
| Learning adoption rate                   | 95%    | 95.0%  | 100      | Green      |
| False positive rate                      | <2%    | 6.0%   | 70       | Red        |
| Handoff quality                          | N/A    | N/A    | N/A      | —          |
| **COMPOSITE SCORE**                      |        |        | **84.7** | **Yellow** |

**Trend:** False positive rate elevated for 2 weeks — two rejections were overturned by QA Manager review. SLA adherence degraded due to high volume week.  
**Manager note:** Formal review of rejection criteria calibration required. Assess validator workload — may be at capacity.

---

### 8.3 Sample Scorecard: `agent-runtime-supervision/platform-watchdog-agent`

**Week of:** 2026-04-07  
**Role Type:** Watchdog

| Metric                                       | Target   | Actual  | Score    | Band      |
| -------------------------------------------- | -------- | ------- | -------- | --------- |
| Detection precision (alerts that were valid) | >90%     | 92.0%   | 100      | Green     |
| Detection recall (genuine anomalies caught)  | >95%     | 98.0%   | 100      | Green     |
| Alert response time (mean, minutes)          | <5 min   | 3.2 min | 100      | Green     |
| False positive rate                          | <10%     | 8.0%    | 100      | Green     |
| Scope compliance                             | 100%     | 100%    | 100      | Green     |
| Status report compliance                     | 100%     | 100%    | 100      | Green     |
| Investigation completeness                   | >95%     | 97.0%   | 100      | Green     |
| Threshold currency                           | <90 days | 45 days | 100      | Green     |
| **COMPOSITE SCORE**                          |          |         | **99.8** | **Green** |

**Trend:** Performing well. One near-miss on scope — observed anomaly in adjacent office but correctly referred to the appropriate cross-office watchdog rather than acting on it.  
**Manager note:** Commend scope discipline. No action required.
