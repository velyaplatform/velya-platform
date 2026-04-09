# Agent Handoff Model

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Agent Runtime Supervision Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

A handoff is the formal transfer of accountability for work from one agent to another. Until a handoff is confirmed by the receiving agent, accountability remains with the sending agent. There is no such thing as a "soft handoff" — work either has a confirmed accountable holder or it is lost work, and lost work is an institutional failure.

This model defines the complete handoff contract: the schema, the confirmation protocol, failure modes, recovery procedures, and quality standards.

---

## 2. Handoff Schema

```yaml
handoff_package:
  # ─── IDENTITY ───────────────────────────────────────────
  handoff_id: string                # UUID — immutable
  handoff_version: string           # incremented if package is amended
  created_at: datetime
  handoff_type:
    enum: [within_office, cross_office, emergency, scheduled, cascade, retirement]
  
  # ─── PARTIES ────────────────────────────────────────────
  origin:
    agent_id: string
    office: string
    coordinator: string             # coordinator responsible for this work chain
    manager: string
  destination:
    agent_id: string
    office: string
    coordinator: string
    manager: string
  
  # ─── AUTHORIZATION ──────────────────────────────────────
  cross_office_authorization:
    required: bool                  # true for all cross_office handoffs
    authorized_by: string           # origin office manager
    authorization_ref: string       # links to manager approval record
    destination_accepted: bool      # true when destination manager accepts
  
  # ─── WORK PACKAGE ───────────────────────────────────────
  work_package:
    task_id: string
    workflow_id: string
    task_type: string
    task_description: string
    priority: enum [low, medium, high, urgent, emergency]
    original_assignor: string
    original_assignment_date: datetime
    deadline: datetime
    time_remaining_at_handoff_minutes: int
  
  # ─── CONTEXT PACKAGE ─────────────────────────────────────
  context_package:
    background: string              # why this task exists
    current_state: string           # exactly where work is now
    decisions_made:
      - decision: string
        made_by: string
        made_at: datetime
        rationale: string
        evidence_ref: string
    decisions_pending:
      - decision: string
        context: string
        options_considered: list<string>
        recommended_option: string
        decision_deadline: datetime
    open_questions: list<string>
    known_risks:
      - risk: string
        severity: enum [low, medium, high, critical]
        mitigation: string
    known_dependencies:
      - dependency: string
        status: enum [resolved, pending, blocked]
        owner: string
    constraints: list<string>       # things the destination agent must not do
    clinical_context: string        # required if any clinical relevance
  
  # ─── ARTIFACTS ──────────────────────────────────────────
  artifacts_transferred:
    - artifact_id: string
      artifact_name: string
      artifact_type: string
      description: string
      storage_ref: string
      hash_sha256: string
      is_critical: bool             # if true, destination must confirm receipt
  
  # ─── VALIDATION STATUS ──────────────────────────────────
  validation_status:
    work_validated: bool
    validation_report_id: string
    validation_outstanding: bool    # if true, receiving agent inherits pending validation
    outstanding_validation_items: list<string>
    audit_status: enum [not_required, pending, complete, outstanding]
    audit_report_id: string
  
  # ─── SLA INHERITANCE ────────────────────────────────────
  sla:
    original_sla_deadline: datetime
    sla_elapsed_at_handoff_minutes: int
    sla_remaining_at_handoff_minutes: int
    sla_breach_consequence: string
  
  # ─── CONFIRMATION PROTOCOL ──────────────────────────────
  confirmation:
    required_by: datetime           # origin SLA: 15 minutes from delivery
    confirmed_at: datetime          # filled by destination agent
    confirmed_by: string
    context_sufficiency_assessment:
      enum: [sufficient, insufficient, conditionally_sufficient]
    insufficiency_items: list<string>  # if insufficient
    additional_information_requested: list<string>
    destination_accepts: bool
    rejection_rationale: string     # if destination rejects handoff
```

---

## 3. Handoff Validation Protocol

The receiving agent has 15 minutes to assess context sufficiency and confirm or reject the handoff.

### 3.1 Context Sufficiency Assessment

The receiving agent must assess:

```
HANDOFF CONTEXT SUFFICIENCY CHECKLIST
=======================================
[ ] H-01: I understand the purpose of this task
[ ] H-02: I understand the current state of the work
[ ] H-03: All critical artifacts are present and hash-verified
[ ] H-04: I know all decisions that have been made
[ ] H-05: I know all decisions that are pending and their deadlines
[ ] H-06: I understand all known risks
[ ] H-07: I understand all known dependencies
[ ] H-08: The constraints on my actions are clear
[ ] H-09: I have sufficient time to complete within SLA
[ ] H-10: I have the permissions required to complete this work
[ ] H-11: I understand the validation status and what remains
[ ] H-12: I can reconstruct what has been done without the sending agent
```

If any item is `No`, the receiving agent must:
1. Mark the handoff as `insufficient`
2. List the specific items that are missing or unclear
3. The sending agent has 30 minutes to provide the missing information
4. If sending agent cannot provide in 30 minutes, it escalates to its coordinator

### 3.2 Conditional Acceptance

A receiving agent may accept a handoff conditionally if:
- Most context is sufficient
- Missing items are not immediately needed (will be needed later in the workflow)
- The receiving agent explicitly names when the missing information will be needed

Conditional acceptance transfers accountability immediately. If the missing information is not provided when needed, the receiving agent escalates — it does not fail the task silently.

### 3.3 Handoff Rejection

A receiving agent may reject a handoff when:
- Context is fundamentally insufficient to proceed
- The receiving agent is at capacity (must notify coordinator before capacity is exceeded)
- The receiving agent does not have the required permissions for the task
- The risk class exceeds the receiving agent's contract authorization

A rejection is not a refusal to work — it is a signal that the handoff package is inadequate or the assignment is incorrect. The sending agent's coordinator is responsible for resolving the rejection.

---

## 4. Handoff Failure Modes and Handling

### 4.1 Failure Mode: Receiving Agent Silent

| Time | Action |
|---|---|
| +15 min no confirmation | Sending agent alerts its coordinator |
| +30 min no confirmation | Coordinator alerts both managers |
| +45 min no confirmation | Watchdog opened for receiving agent; work retained by sending agent |
| +60 min no confirmation | Receiving agent quarantined L1; work redirected by coordinator |

Work is never considered transferred until confirmed. A silent receiving agent does not acquire accountability.

### 4.2 Failure Mode: Sending Agent Silent After Rejection

If the sending agent does not provide missing context within 30 minutes of a rejection:
1. Receiving agent escalates to sending agent's coordinator
2. Coordinator has 30 minutes to provide context or reassign
3. If coordinator does not respond, sending agent's manager is escalated
4. Work is held by the coordinator pending resolution

### 4.3 Failure Mode: Artifact Integrity Failure

If a received artifact fails hash verification:
1. Receiving agent immediately flags the artifact as corrupted
2. Sends rejection with specific artifact IDs and expected vs. actual hashes
3. Security Office is notified (potential data integrity issue)
4. Sending agent must re-transmit from the verified source
5. If the artifact cannot be recovered from source, it is a data loss incident

### 4.4 Failure Mode: Cross-Office Authorization Not Obtained

If a cross-office handoff arrives without proper authorization:
1. Receiving agent rejects the handoff on authorization grounds
2. Receiving office manager is notified
3. Sending agent must obtain authorization before re-submitting
4. A watchdog flag is raised for the sending agent (process violation)

---

## 5. Incomplete Handoff Recovery

When a handoff is incomplete (sending agent fails mid-handoff, or the handoff package is partially delivered):

1. **Coordinator detection:** Coordinator notices no confirmation within 15 minutes
2. **State assessment:** Coordinator queries both agents for current work state
3. **Accountability determination:** Coordinator determines where accountability currently rests based on last confirmed state
4. **Package reconstruction:** If the handoff package is incomplete, the coordinator reconstructs it from: task logs, evidence store, NATS message history, and any available agent reports
5. **Re-handoff:** Coordinator initiates a fresh handoff from the correct point
6. **Gap analysis:** Any gap in the work record (period with no accountable agent) is an incident; PAR required within 48 hours

---

## 6. Cross-Office Handoff Rules

Cross-office handoffs are subject to stricter requirements than within-office handoffs:

| Requirement | Within-Office | Cross-Office |
|---|---|---|
| Manager authorization | Not required | Required from both managers |
| Context package depth | Standard | Extended (all context items mandatory) |
| Artifact hash verification | Required for critical artifacts | Required for ALL artifacts |
| Confirmation window | 15 minutes | 30 minutes |
| Audit trigger | Risk-class-based | Always triggers audit record |
| Handoff log retention | 365 days | 365 days + office archive |
| Escalation path | Shared coordinator | Separate coordinators + Executive arbitration |

### 6.1 Cross-Office Authorization Flow

```
Sending agent identifies need for cross-office handoff
         │
         ▼
Sending agent requests authorization from own office manager
         │
         ▼
Own office manager reviews and authorizes (or denies)
         │ (if authorized)
         ▼
Own office manager notifies destination office manager
         │
         ▼
Destination office manager reviews and accepts assignment
         │ (both authorizations obtained)
         ▼
Handoff package prepared and transmitted
```

If the destination office manager declines the assignment, the matter escalates to the Executive Office for arbitration. The Executive Office has authority to compel cross-office assignments in the interest of enterprise function.

---

## 7. Emergency Handoff Procedure

When normal handoff is too slow for the situation (active incident, patient safety event, security breach):

### 7.1 Emergency Handoff Criteria

Emergency handoff is declared when:
- Patient safety is at immediate risk
- A Critical or Catastrophic incident is in progress
- The receiving agent's normal confirmation window would cause SLA breach with irreversible consequences
- The sending agent is incapacitated (quarantined, failed) mid-task

### 7.2 Emergency Handoff Protocol

1. **Emergency declaration:** Sending agent (or its coordinator) declares emergency handoff in the handoff package header
2. **Reduced confirmation window:** 5 minutes (vs. 15 normal)
3. **Simultaneous notification:** Origin manager, destination manager, and Executive Office are all notified simultaneously
4. **Context minimum:** Emergency handoffs require minimum context: current state, immediate next action, known patient/system impact, and contact for questions
5. **Full context follow-up:** Sending agent or coordinator must file a complete context package within 2 hours of emergency handoff
6. **Mandatory PAR:** All emergency handoffs trigger a Post-Action Review within 48 hours

### 7.3 Emergency Handoff Authority

Any Coordinator Agent or Manager Agent can declare an emergency handoff. The declaration is reviewed in the mandatory PAR. Excessive emergency handoff declarations (more than 2 per month for any agent pair) trigger a process improvement investigation.

---

## 8. Handoff Quality Metrics

| Metric | Definition | Target | Warning | Critical |
|---|---|---|---|---|
| Confirmation rate | % of handoffs confirmed within SLA | >98% | 90-98% | <90% |
| Context sufficiency rate | % of handoffs assessed as sufficient on first receipt | >90% | 75-90% | <75% |
| Handoff rejection rate | % of handoffs rejected (context insufficient) | <5% | 5-15% | >15% |
| Cross-office authorization compliance | % of cross-office handoffs with proper authorization | 100% | <100% = immediate action | N/A |
| Artifact integrity rate | % of artifact transfers with verified hash | 100% | <100% = immediate action | N/A |
| Emergency handoff rate | Emergency handoffs as % of total handoffs | <2% | 2-5% | >5% |
| Handoff-induced SLA breach rate | % of tasks where handoff caused SLA breach | <1% | 1-5% | >5% |

---

## 9. Handoff Audit Trail Requirements

Every handoff generates the following immutable records:

| Record | Content | Retention |
|---|---|---|
| Handoff package | Complete handoff_package schema | 365 days |
| Authorization record | Manager approval(s) for cross-office | 365 days |
| Confirmation record | Receiving agent's context assessment | 365 days |
| Artifact transfer log | All artifacts with hashes and transfer timestamps | 365 days |
| NATS delivery receipt | Proof of message delivery | 365 days |
| Any rejection records | If handoff was rejected, the rejection and resubmission | 365 days |

For Clinical and Compliance work, all handoff records are retained for 7 years.

The audit trail must be sufficient to answer: "At every point in this workflow, which agent was accountable, what context did they have, and what actions were available to them?"
