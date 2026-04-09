# Agent Watchdog Model

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Agent Runtime Supervision Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

Watchdogs are the behavioral health system of the Velya agent enterprise. They do not process work. They observe the enterprise continuously, detect anomalies in agent behavior and system health, and trigger the appropriate response when thresholds are crossed.

A watchdog that never fires is not a healthy watchdog — it may be asleep. A watchdog that fires constantly is not a vigilant watchdog — it may be miscalibrated. The measure of a watchdog is the precision and timeliness of its detections.

---

## 2. What Watchdogs Monitor

### 2.1 Silence

An agent that stops reporting is either idle (acceptable if workload is zero) or failing (unacceptable at any time). Watchdogs distinguish between:
- **Legitimate silence:** No tasks in queue, status report confirms idle state
- **Suspicious silence:** No status report despite expected activity
- **Confirmed silence:** No status report for multiple consecutive cycles regardless of expected workload

### 2.2 Loops

A loop is a task or workflow that cycles without progress:
- Repeated identical actions with no state change
- Repeated validation requests with identical (non-corrected) submissions
- Repeated escalations to the same target with no response
- Coordinator cycling between agents without task completion

### 2.3 Thrashing

Thrashing is the pattern of repeated rejection and correction without convergence:
- Same producing agent fails validation on the same task type repeatedly
- Correction cycles incrementing without improving validation outcomes
- Correction reports that address different items than the rejection cited

### 2.4 Conflict

Conflict is when agents in the same workflow contradict each other:
- Two coordinators claiming authority over the same task
- Contradictory instructions sent to a specialist from different coordinators
- A validator's certification contradicting an auditor's finding with no resolution
- Handoff accepted by receiving agent but also claimed by sending agent

### 2.5 Overload

Overload occurs when an agent's queue or processing capacity is exceeded:
- Queue depth above maximum defined in contract
- SLA adherence dropping below warning threshold
- Status reports showing increasing elapsed time per task
- Validation request backlog growing faster than it is being consumed

### 2.6 Drift

Behavioral drift occurs when an agent's actions are diverging from its contract:
- Actions taken outside declared scope
- Permission usage outside declared permissions
- Output formats deviating from contract schema
- Reporting patterns changing without documented reason
- Escalation paths not being followed

---

## 3. Detection Thresholds and Timeouts

### 3.1 Silence Thresholds

| Condition | Threshold | Action |
|---|---|---|
| Status report late | > 5 minutes past scheduled time | Internal watchdog log (no alert) |
| Status report missing | > 15 minutes past scheduled time | Warning alert to Office Manager |
| Status report missing | > 30 minutes past scheduled time | Incident opened; Level 1 quarantine consideration |
| Status report missing | > 60 minutes past scheduled time | Level 1 quarantine; investigation opened |
| Status report missing | > 4 hours (all cycles missed) | Level 2 quarantine; executive notification |
| Complete silence (no NATS activity) | > 2 hours during active workflow | Emergency investigation; Level 2 quarantine |

### 3.2 Loop Detection Thresholds

| Condition | Threshold | Action |
|---|---|---|
| Repeated identical action | 3 times in 30 minutes | Warning to coordinator |
| Identical validation request (no change) | 2 occurrences | Warning to QA Manager + watchdog flag |
| Correction cycle on same item | > defined maximum | Mandatory escalation (see Correction Loop Model) |
| Workflow idle with pending tasks | > 60 minutes | Exception alert to coordinator |
| Escalation with no response | > defined SLA × 2 | Watchdog escalation to manager |

### 3.3 Thrashing Thresholds

| Condition | Threshold | Action |
|---|---|---|
| Validation failures on same task | 3 consecutive | Manager notification + correction loop review |
| Thrashing across different tasks (same pattern) | 5 occurrences in 7 days | Systemic issue flag; Learning Office engaged |
| Correction report quality declining | Score < 60% on 2 consecutive | Manager review triggered |

### 3.4 Conflict Detection

| Condition | Threshold | Action |
|---|---|---|
| Duplicate authority claim | 1 occurrence | Immediate alert to both managers + Executive |
| Contradictory instructions to specialist | 1 occurrence | Specialist halts; both coordinators alerted |
| Unresolved validator/auditor contradiction | > 24 hours | Executive escalation |
| Handoff double-claim | 1 occurrence | Both managers + Executive; audit triggered |

### 3.5 Overload Thresholds

| Condition | Threshold | Action |
|---|---|---|
| Queue depth approaching maximum | > 80% capacity | Warning to manager |
| Queue depth at maximum | 100% capacity | Manager must act; watchdog monitors recovery |
| SLA adherence degrading | < warning threshold for 2 consecutive reports | Manager investigation |
| Task processing time increasing | > 50% above baseline for 3 consecutive tasks | Manager alert + capacity review |

### 3.6 Drift Detection

| Condition | Threshold | Action |
|---|---|---|
| Action outside declared scope | 1 occurrence | Immediate halt + manager + Security alert |
| Permission used outside declared set | 1 occurrence | Immediate halt + Security + Compliance |
| Output schema deviation | 3 occurrences | Manager investigation |
| Reporting pattern change | Sustained for > 48 hours | Watchdog investigation |
| Escalation path bypassed | 1 occurrence (except emergency handoff) | Manager notification |

---

## 4. Watchdog Incident Lifecycle

```
DETECT
  │  Threshold crossed; watchdog records detection event
  │
  ▼
ASSESS
  │  Watchdog determines severity and incident class
  │  Checks: Is this a false positive? Has this pattern been seen before?
  │
  ▼
ALERT
  │  Alert issued per severity:
  │  Warning → Office Manager
  │  Incident → Office Manager + Executive (if High+)
  │  Emergency → Executive + Agent Runtime Supervision Manager
  │
  ▼
INVESTIGATE
  │  Watchdog gathers: recent logs, status reports, NATS messages, scorecard
  │  Documents what it observed vs. what was expected
  │  Does NOT take action on the agent — only observes and documents
  │
  ▼
CONTAIN
  │  If agent is actively causing harm or risk: watchdog requests quarantine
  │  Quarantine requires: manager authorization (L1/L2) or Executive (L3/L4)
  │  Watchdog documents quarantine request with full evidence
  │
  ▼
RESOLVE
  │  Investigation determines root cause
  │  Responsible manager addresses root cause
  │  Agent is cleared for return if quarantined (see Quarantine Model)
  │
  ▼
LEARN
     Post-incident review filed
     Learning Report filed if pattern or systemic cause identified
     Watchdog threshold calibration reviewed
```

---

## 5. Watchdog Authority

### 5.1 What Watchdogs CAN Do

- Monitor all agents within their assigned scope
- Access audit logs, status reports, and NATS message history for monitored agents
- File watchdog alerts and incident reports
- Request Level 1 (reduced permissions) quarantine with Office Manager approval
- Request Level 2 (read-only) quarantine with Office Manager approval
- Request Level 3 (suspended) quarantine with Executive approval
- Open investigations
- File Learning Reports based on observed patterns
- Notify Security Office of permission anomalies
- Escalate unacknowledged alerts up the escalation chain

### 5.2 What Watchdogs CANNOT Do

- Retire an agent (requires Office Manager + Executive)
- Override a manager's decision about an agent
- Modify an agent's contract
- Assign or reassign tasks
- Access PHI beyond what is necessary for investigation
- Take direct action on monitored agents' work (they observe, not intervene)
- Quarantine at Level 4 without Executive authorization
- Suppress another watchdog's alert (disagreements go to the Meta-Watchdog)
- Self-quarantine (must escalate to Meta-Watchdog)

---

## 6. Watchdog Scope Boundaries

Each watchdog has a defined monitoring scope. Monitoring outside that scope is itself a behavioral anomaly.

| Watchdog Type | Monitoring Scope |
|---|---|
| Office Watchdog | All agents within its assigned office |
| Cross-Office Watchdog (Agent Runtime Supervision) | Selected high-risk agents across all offices |
| Security Watchdog | Permission usage and secret access across all agents |
| Clinical Watchdog | All agents touching clinical workflows or PHI |
| Meta-Watchdog | All watchdog agents (singleton, operated by Agent Runtime Supervision) |

A watchdog that observes anomalies outside its scope must refer the observation to the appropriate watchdog rather than acting on it directly. Cross-scope observations are logged and shared via the Agent Runtime Supervision Office.

---

## 7. Anti-Patterns for Watchdog Behavior

| Anti-Pattern | Definition | Consequence |
|---|---|---|
| Over-triggering | Firing alerts for conditions clearly within normal bounds | False positive rate metric degraded; calibration review |
| False positive storms | Multiple false alerts in short period causing management distraction | Watchdog investigation; threshold recalibration |
| Alert suppression | Not filing an alert when threshold is crossed | Trust failure; auditor investigation |
| Scope overreach | Monitoring agents outside declared scope | Watchdog quarantine consideration |
| Investigative overreach | Taking action on monitored agents vs. observing and alerting | Immediate escalation to Meta-Watchdog |
| Watchdog silence | Watchdog itself going silent (not filing its own status reports) | Meta-Watchdog escalation; Level 1 quarantine |
| Stale threshold calibration | Not reviewing thresholds after 90 days regardless of conditions | Watchdog scorecard deduction |
| Coordination bias | Favoring certain agents in alert thresholds (e.g., not alerting on a high-performing agent that is drifting) | Trust failure; policy violation |

---

## 8. Watchdog Scorecard

| Metric | Definition | Target | Warning | Critical |
|---|---|---|---|---|
| Detection precision | % of alerts that represent genuine anomalies | >90% | 75-90% | <75% |
| Detection recall | % of genuine anomalies that generated an alert | >95% | 85-95% | <85% |
| Alert response time | Mean time from threshold crossing to alert issuance | <5 min | 5-15 min | >15 min |
| False positive rate | % of alerts that were false positives | <10% | 10-25% | >25% |
| Scope compliance | % of monitoring within declared scope | 100% | <100% = investigation | N/A |
| Status report compliance | % of own status reports filed on time | 100% | 95-100% | <95% |
| Investigation completeness | % of incidents with complete investigation packages | >95% | 85-95% | <85% |
| Threshold currency | Days since last threshold review | <90 days | 90-180 days | >180 days |

---

## 9. The Meta-Watchdog

### 9.1 Purpose

The Meta-Watchdog is the sole monitor of all watchdog agents. It is a singleton operated by the Agent Runtime Supervision Office. It monitors watchdogs for the same anomalies that watchdogs monitor in other agents: silence, loops, over-triggering, false positive storms, scope overreach, and behavioral drift.

### 9.2 Meta-Watchdog Special Properties

- Cannot be quarantined by any office-level watchdog
- Cannot be quarantined by any other agent except the Executive Office
- Reports directly to the Executive Office (Agent Runtime Supervision Manager is secondary)
- Has read-only access to all watchdog logs, status reports, and alert records
- Cannot itself be silenced without triggering an automatic human escalation
- If the Meta-Watchdog goes silent for > 30 minutes, the Executive Office is automatically notified via a dead-man's switch mechanism

### 9.3 Meta-Watchdog Response to Watchdog Anomaly

When the Meta-Watchdog detects a watchdog anomaly:

| Anomaly | Meta-Watchdog Response |
|---|---|
| Watchdog silence | Alert Agent Runtime Supervision Manager; L1 quarantine after 60 min |
| Over-triggering storm | Alert Manager; flag for threshold recalibration |
| Scope overreach | Immediate Manager alert; flag for contract review |
| False positive pattern | Alert Manager; initiate calibration review |
| Alert suppression | Immediate Executive escalation; audit triggered |
| Investigative overreach | Immediate Manager + Executive; potential L2 quarantine |

### 9.4 Who Watches the Meta-Watchdog

The Meta-Watchdog's dead-man's switch is a NATS JetStream heartbeat that must be renewed every 15 minutes. If it is not renewed, the Executive Office Agent receives an automatic notification. This is an infrastructure-level control, not an agent control — it operates independently of the agent hierarchy.

The Governance Council reviews the Meta-Watchdog's operational record quarterly.
