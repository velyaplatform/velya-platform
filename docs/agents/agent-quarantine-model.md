# Agent Quarantine Model

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Agent Runtime Supervision Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

Quarantine is the mechanism for containing an agent that is behaving anomalously, failing, or posing a risk to the enterprise — while preserving the ability to investigate and recover. Quarantine is not punishment and is not retirement. It is a safety measure: the equivalent of taking a malfunctioning component offline while you diagnose it.

Quarantine ranges from mild restriction (Level 1) to full isolation (Level 4), and the level is calibrated to the severity of the risk presented.

---

## 2. Quarantine Triggers

### 2.1 Automatic Quarantine Triggers

The following conditions trigger automatic quarantine without requiring manager approval. The responsible Office Manager is notified immediately and must review within 4 hours.

| Trigger | Quarantine Level | Triggered By |
|---|---|---|
| Agent silent > 60 minutes during active workflow | L1 | Watchdog |
| Agent silent > 4 hours (all cycles) | L2 | Watchdog |
| Action taken outside declared contract scope | L2 | Watchdog / Security |
| Permission accessed outside declared set | L2 | Security Watchdog |
| PHI access anomaly detected | L2 | Security / Data Governance Watchdog |
| Evidence integrity failure (hash mismatch in own evidence) | L2 | Auditor / Watchdog |
| Security policy violation | L2 | Security Office |
| Validation override by manager without auditor | L1 | Compliance Auditor |
| Third correction cycle on same issue | L1 | QA Manager |
| Agent contract score critical threshold for 4 consecutive weeks | L1 | Scorecard Engine |

### 2.2 Manual Quarantine Triggers

The following require a human decision (manager or executive):

| Trigger | Quarantine Level | Authorized By |
|---|---|---|
| Persistent behavioral drift | L1–L2 | Office Manager |
| Suspected knowledge corruption | L2 | Office Manager + Executive |
| Active security investigation implicating agent | L2–L3 | Executive + Security Manager |
| Agent is subject of external regulatory inquiry | L3 | Executive |
| Agent produced output with potential patient harm | L3–L4 | Executive + Governance Council notification |
| Active exploitation of agent confirmed | L4 | Executive (immediate) |
| Agent retirement pending (orderly wind-down) | L1 → transition to Deprecated lifecycle stage | Office Manager |

---

## 3. Quarantine Levels

### Level 1: Reduced Permissions

**State:** Agent continues to operate but with restricted capability.

Restrictions applied:
- Read-only access to external systems (no writes unless specifically authorized for current task)
- No new task assignment (current tasks may continue with coordinator approval)
- All outputs require validator review regardless of risk class
- Status reports increased to every 15 minutes
- Watchdog monitoring interval reduced to every 5 minutes
- No cross-office handoffs (all handoffs held pending investigation)

**Purpose:** Contains risk while allowing investigation without full service disruption. Used for behavioral anomalies that are concerning but not yet confirmed harmful.

**Manager action required within:** 4 hours of quarantine initiation.

---

### Level 2: Read-Only

**State:** Agent may read and report but may not execute or produce primary work.

Restrictions applied:
- All write permissions revoked
- No task execution (tasks redistributed to alternate agents by coordinator)
- Agent may continue to file reports and respond to queries
- Agent may continue to participate in investigations (providing testimony)
- All outbound NATS publish rights suspended except for: status reports, investigation responses
- Monitoring: continuous

**Purpose:** Preserves the agent's ability to cooperate with investigation while eliminating risk of further harmful action. Used for confirmed policy violations, security issues, or evidence integrity failures.

**Manager action required within:** 2 hours of quarantine initiation.  
**Executive notification:** Mandatory within 2 hours.

---

### Level 3: Suspended

**State:** Agent is fully suspended. No actions, no publications, no task participation.

Restrictions applied:
- All permissions revoked
- All pending tasks immediately redistributed by coordinator
- Agent may respond to direct investigation queries only through a supervised channel
- No NATS activity except heartbeat (to confirm agent is alive and not in failure loop)
- Monitoring: continuous from Agent Runtime Supervision Office

**Purpose:** Serious investigations where further agent activity — even reporting — could contaminate the evidence base or pose ongoing risk. Used for active security investigations, potential patient harm, or regulatory inquiries.

**Executive authorization required:** Before or immediately after (within 1 hour) L3 quarantine.  
**Governance Council notification:** Mandatory within 4 hours.

---

### Level 4: Full Isolation

**State:** Agent is completely isolated. No network access, no NATS, no API, no file system. The agent process itself is terminated or suspended.

Restrictions applied:
- All connections severed
- Agent namespace isolated at Kubernetes network policy level
- All credentials associated with the agent are rotated immediately
- Agent's NATS subjects are reassigned or tombstoned
- A forensic snapshot of the agent's state is taken before isolation

**Purpose:** Active security breach, confirmed exploitation, or confirmed patient harm. The agent is treated as a potential threat vector until forensic investigation is complete.

**Executive authorization required:** Immediate; retrospective rationale within 2 hours.  
**Governance Council notification:** Immediate.  
**Human escalation:** Automatic if clinical systems are involved.

---

## 4. What Happens During Quarantine

### 4.1 Task Redirection

When an agent enters L2 or higher quarantine, all its pending tasks are redistributed:

1. **Within 15 minutes:** Coordinator assembles the list of in-flight tasks and their current states
2. **Within 30 minutes:** Each task is assessed for criticality and SLA status
3. **Within 1 hour:** Tasks redistributed to the most appropriate available agent, with full context packages
4. **Handoff records:** All redirections are recorded as emergency handoffs with the quarantine event ID
5. **SLA impact assessment:** Coordinator reports SLA impact to the Office Manager

### 4.2 Permission Revocation

Permissions are revoked at the infrastructure level — not just at the agent level — to prevent circumvention:
- NATS credentials invalidated
- Kubernetes RBAC permissions removed
- External API credentials rotated
- Secret store access revoked
- File system write permissions removed (L2+)

### 4.3 Investigation Opening

Within 2 hours of quarantine initiation (L2+), a formal investigation must be opened:

```yaml
quarantine_investigation:
  investigation_id: string
  opened_at: datetime
  opened_by: string           # Office Manager or Executive
  quarantine_event_id: string
  quarantined_agent: string
  quarantine_level: int
  trigger_description: string
  evidence_collected:
    - evidence_type: string
      collected_at: datetime
      ref: string
  hypothesis:
    - hypothesis: string
      confidence: enum [low, medium, high]
      evidence_for: list<string>
      evidence_against: list<string>
  investigation_lead: string
  target_completion: datetime
  current_status: string
```

---

## 5. Quarantine Investigation Process

### 5.1 Investigation Phases

**Phase 1: Evidence Preservation (0–2 hours)**
- Forensic snapshot of agent state
- Collection of recent logs, status reports, and NATS messages
- Hash verification of evidence to establish integrity baseline
- No agent actions during this phase (even L1 agents have execution paused during snapshot)

**Phase 2: Timeline Reconstruction (2–8 hours)**
- Reconstruct the sequence of events leading to quarantine
- Identify when behavior first deviated from expected
- Map all tasks, handoffs, and outputs produced by the agent in the prior 7 days
- Cross-reference with validation and audit records

**Phase 3: Root Cause Analysis (8–48 hours, depending on level)**
- Identify whether the cause is: knowledge gap, tool failure, contract deficiency, environmental, malicious, or unknown
- Assess whether the cause is agent-specific or systemic
- Determine whether other agents may be affected by the same cause

**Phase 4: Recommendation (within 48 hours of quarantine for L1/L2; within 72 hours for L3/L4)**

The investigation produces one of:
- **Cleared:** Agent is returned to pre-quarantine state with documented findings
- **Cleared with conditions:** Agent returned with contract amendments or capability requirements
- **Quarantine maintained:** Investigation ongoing; quarantine level may be adjusted
- **Retirement recommended:** Agent should be retired; see Retirement Model
- **Emergency retirement:** Immediate retirement for security/patient safety cause

---

## 6. Requalification Path

An agent exits quarantine through a formal requalification process:

### 6.1 L1 → Active

1. Investigation completed; root cause identified and documented
2. Root cause is addressed (contract amendment, capability update, or environmental fix)
3. Office Manager reviews and approves return
4. Agent monitored at elevated watchdog intensity for 2 weeks post-return
5. Post-quarantine Learning Report filed

### 6.2 L2 → Active (requires L1 intermediate period)

1. L2 investigation completed with clean finding (no policy violations confirmed)
2. Office Manager + Executive review and approve
3. Agent returned to L1 status for minimum 1 week
4. If L1 period passes without incident, agent returned to Active
5. Scorecard impact: quarantine period marked; thresholds apply from return date

### 6.3 L3 → Active (requires L2 then L1 intermediate periods)

1. Full investigation completed and closed
2. Executive + Governance Council review
3. Agent returned to L2 minimum 1 week, then L1 minimum 1 week
4. Validator assigned for all outputs for first 30 days post-return regardless of risk class
5. Human review of post-quarantine report mandatory

### 6.4 L4 → Retirement (default)

L4 quarantine typically results in agent retirement unless investigation confirms the agent was a victim of an external attack with no intrinsic defect. Reactivation from L4 requires Governance Council approval.

---

## 7. Evidence Required to Exit Quarantine

| Evidence Item | L1 | L2 | L3 | L4 |
|---|---|---|---|---|
| Investigation report with root cause | Required | Required | Required | Required |
| Root cause remediation evidence | Required | Required | Required | Required |
| Manager approval | Required | Required | Required | Governance Council |
| Executive approval | Not required | Required | Required | Required |
| Contract amendment (if scope contributed) | If applicable | If applicable | Required review | Required review |
| Requalification test results (if capability gap) | Optional | Required | Required | Required |
| Watchdog clearance | Not required | Required | Required | Required |
| Clean audit of quarantine period | Optional | Required | Required | Required |

---

## 8. Quarantine Duration Limits

Quarantine without resolution is not acceptable. The following limits apply:

| Level | Maximum Duration Without Resolution Decision |
|---|---|
| L1 | 7 days before escalation to Executive |
| L2 | 14 days before escalation to Governance Council |
| L3 | 30 days before mandatory retirement recommendation |
| L4 | 7 days before mandatory retirement (or Governance Council override) |

"Resolution" means an investigation finding is reached — not that the agent is restored. An agent can remain quarantined beyond these limits if the investigation finding is "quarantine maintained with reason."

---

## 9. Authorization Summary

| Action | Authorization Required |
|---|---|
| Initiate L1 quarantine | Watchdog (automatic) or Office Manager |
| Initiate L2 quarantine | Office Manager (automatic triggers) or Executive |
| Initiate L3 quarantine | Executive |
| Initiate L4 quarantine | Executive (Governance Council notification) |
| Exit L1 | Office Manager |
| Exit L2 | Office Manager + Executive |
| Exit L3 | Executive + Governance Council review |
| Exit L4 | Governance Council approval |
| Override quarantine recommendation | Executive (with documented rationale + mandatory audit) |

---

## 10. Quarantine Audit Trail

Every quarantine event generates an immutable quarantine record:

```yaml
quarantine_record:
  quarantine_id: string
  agent_id: string
  initiated_at: datetime
  initiated_by: string
  trigger_event_ref: string
  level_history:
    - level: int
      entered_at: datetime
      exited_at: datetime
      authorization_ref: string
  investigation_id: string
  resolution:
    outcome: enum [cleared, cleared_with_conditions, retired, emergency_retired, ongoing]
    resolved_at: datetime
    resolved_by: string
    evidence_refs: list<string>
  task_redirections: list<string>      # list of task IDs redirected
  permission_revocations: list<string> # credentials and permissions revoked
  post_quarantine_conditions: list<string>  # if cleared_with_conditions
  learning_report_id: string
```

Quarantine records are retained for 7 years regardless of resolution outcome.
