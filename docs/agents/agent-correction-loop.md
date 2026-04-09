# Agent Correction Loop

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Quality Assurance Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

The correction loop is the formal process by which a producing agent responds to a validation rejection. It ensures that rejected work is corrected through structured analysis rather than repeated blind resubmission, and that lessons from corrections are captured for institutional learning.

The correction loop is not a penalty mechanism. It is the quality improvement path. An agent that navigates the correction loop well — identifying root cause, making targeted corrections, preventing recurrence — demonstrates institutional maturity. An agent that treats the correction loop as an obstacle to bypass demonstrates a governance defect.

---

## 2. How Rejection is Communicated

A rejection is the `rejected` outcome in a Validation Report. Rejections must include:

```yaml
rejection_communication:
  validation_report_id: string      # links to full validation report
  target_task_id: string
  target_agent: string
  validator_agent: string
  rejection_issued_at: datetime
  rejection_items:                  # minimum 1, maximum unlimited
    - item_id: string
      checklist_ref: string         # which checklist item was violated
      description: string           # specific, unambiguous description of the defect
      evidence_cited: string        # what evidence the validator saw
      required_correction: string   # what must be true for this item to pass
      is_blocking: bool             # true = must be corrected before resubmission
      is_clarification_possible: bool  # can the producing agent clarify vs. re-do
  correction_deadline: datetime     # when the Correction Report is due
  revalidation_scope:
    enum: [full, targeted]          # full = start over; targeted = only failed items
  revalidation_scope_rationale: string
  validator_availability:
    will_be_available_for_revalidation: bool
    alternate_validator_if_unavailable: string
```

Rejections that omit required fields, or that list "failed validation" without specifying which items and why, are themselves defective. A producing agent that receives a defective rejection must:
1. NOT treat the rejection as a valid rejection
2. File an Exception Report to the QA Manager
3. Request a corrected rejection from the validator

---

## 3. Agent Response to Rejection

### 3.1 Mandatory Acknowledgment (within 15 minutes)

Within 15 minutes of receiving a valid rejection, the producing agent must send an acknowledgment to the validator and supervising coordinator:

```yaml
rejection_acknowledgment:
  rejection_received_at: datetime
  acknowledged_at: datetime
  acknowledged_by: string           # producing agent
  rejection_items_understood: list<string>   # list item IDs
  correction_report_eta: datetime
  questions_for_validator: list<string>     # optional, only if genuinely unclear
  current_agent_state: enum [analyzing, on_hold, blocked]
```

An agent that does not acknowledge within 15 minutes triggers a watchdog alert. An agent that does not acknowledge within 30 minutes is quarantined at Level 1 pending investigation.

### 3.2 Root Cause Analysis (within 60 minutes of acknowledgment)

The producing agent must perform structured root cause analysis before filing the Correction Report:

```yaml
root_cause_analysis:
  analysis_completed_at: datetime
  rejection_items:
    - item_id: string
      identified_cause: string
      cause_category:
        enum: [knowledge_gap, process_violation, tool_failure, data_error,
               scope_misunderstanding, environmental, dependency_failure, other]
      cause_evidence: string
      was_this_predictable: bool
      how_could_it_have_been_prevented: string
  systemic_question: string        # is this a one-time error or a pattern?
  pattern_detected: bool
  pattern_description: string      # if pattern_detected = true
  self_assessment: string          # agent's honest assessment of its performance
```

### 3.3 Correction Report (within correction SLA)

| Risk Class | Correction Report SLA |
|---|---|
| Low | 8 hours |
| Medium | 4 hours |
| High | 2 hours |
| Critical | 1 hour |
| Catastrophic | 30 minutes |

The Correction Report schema is defined in the Reporting Standard. Key requirements:
- Every rejection item must be addressed individually
- Corrections that are not being made must be documented with manager-approved rationale
- The correction plan must specify what evidence will be produced for each item
- The agent must declare whether it believes this is a one-time error or a systemic issue

---

## 4. When Correction is Local vs. Requires Redesign

### 4.1 Local Correction

A correction is local when:
- The defect is in execution (wrong value, missing step, incomplete evidence) not in design
- The correction is within the producing agent's existing scope and permissions
- The correction can be completed within the rejection item's SLA
- Fixing the defect does not require structural changes to the workflow

For local corrections: producing agent corrects the work, files Correction Report, resubmits for validation.

### 4.2 Redesign Required

Redesign is required when:
- The task cannot be completed correctly within the agent's current scope or permissions
- The rejection reveals a fundamental misunderstanding of the requirements
- Multiple rejection cycles have not resolved the same root cause
- The failure mode exposes a gap in the agent's contract, capabilities, or training

When redesign is required:
1. Producing agent files Exception Report to coordinator and manager
2. Task is suspended (not abandoned — coordinator retains accountability)
3. Coordinator and manager assess whether redesign requires:
   - Contract amendment (Agent Factory)
   - Capability development (Learning Office + Trainer)
   - Task reassignment to different agent
   - RFC revision (if requirements were the problem)
4. Timeline for redesign is tracked in the PMO portfolio as a blocked work item
5. Escalation to Executive if redesign is expected to take more than 5 business days

---

## 5. Maximum Correction Cycles Before Escalation

| Risk Class | Max Correction Cycles | Escalation Target |
|---|---|---|
| Low | 5 | Office Manager |
| Medium | 3 | Office Manager + Executive notification |
| High | 2 | Office Manager + Executive + PAR triggered |
| Critical | 1 | Immediate Manager escalation + Executive + Redesign assessment |
| Catastrophic | 0 (any rejection) | Immediate Executive escalation + Human notification |

"Correction cycle" means a complete cycle of: Correction Report → corrected work → revalidation. A resubmission with no correction report filed is not a cycle — it is a protocol violation and is treated as an immediate escalation.

When the maximum correction cycle count is reached:
1. The producing agent is placed on informal probation for this task type
2. An Office Manager must review the agent's scorecard
3. A Redesign Assessment is mandatory
4. The producing agent may not self-assign new tasks of this type until the Manager clears it
5. A Learning Report is mandatory, filed by the manager

---

## 6. Evidence Required for Corrected Work

Corrected work must include ALL of the following in addition to the original evidence set:

| Evidence Item | Purpose |
|---|---|
| Correction Report (filed before resubmission) | Proves structured analysis preceded correction |
| Root cause analysis document | Documents what went wrong and why |
| Change delta from original work | Explicitly shows what was changed |
| Re-execution log (for corrected steps) | Evidence the correction was actually made |
| Updated pre/post-state snapshots | Shows current state after correction |
| Acknowledgment of all rejection items | Proves all items were addressed |
| Items not corrected with manager approval | Proves exceptions are authorized |

For High and Critical corrections, additionally:
- Manager sign-off on the Correction Report
- Risk re-assessment (has the correction changed the risk profile?)
- Second-opinion check on the root cause analysis from the coordinator

---

## 7. Revalidation Requirements

### 7.1 Targeted Revalidation

When the validator specifies `revalidation_scope: targeted`, the validator only re-checks the items that were rejected. Items that previously passed are not re-examined unless the correction to rejected items has changed the state of passing items.

The validator must explicitly document why previously passing items are or are not affected by the correction.

### 7.2 Full Revalidation

When the validator specifies `revalidation_scope: full`, the validator runs the complete validation checklist again. This is required when:
- The corrections are so extensive that overall integrity must be reassessed
- The producing agent made changes beyond the correction scope
- The validator's confidence in the original passing items was contingent on the failing items

### 7.3 Same Validator vs. New Validator for Revalidation

- The same validator performs revalidation by default
- If the same validator is unavailable, the coordinator assigns an alternate (logged)
- If the producing agent believes the original validator has a bias pattern (3+ consecutive rejections on the same producing agent with contested rationale), it may request a neutral validator review through the QA Manager

---

## 8. Correction Loop Timeout

If a producing agent does not file a Correction Report within the SLA:

| Time Elapsed | Automatic Action |
|---|---|
| SLA + 15 min | Watchdog alert to office manager |
| SLA + 30 min | Office Manager must investigate and respond |
| SLA + 60 min | Agent quarantined at Level 1 (reduced permissions) |
| SLA + 4 hours | Work redirected to alternate agent; producing agent investigation opened |
| SLA + 24 hours | Quarantine escalated to Level 2 (read-only); formal investigation |

The task is never abandoned due to correction loop timeout. The coordinator retains accountability for the task and redirects it according to the escalation path.

---

## 9. Correction Quality Metrics

Correction quality is tracked on the producing agent's scorecard:

| Metric | Definition | Target | Warning | Critical |
|---|---|---|---|---|
| First-pass validation rate | % of tasks passing on first submission | >90% | 75-90% | <75% |
| Correction cycle rate | Average correction cycles per rejected task | <1.5 | 1.5-2.5 | >2.5 |
| Correction report timeliness | % of correction reports filed within SLA | >95% | 85-95% | <85% |
| Root cause accuracy | % of root causes that prevented recurrence | >85% | 70-85% | <70% |
| Correction recurrence | % of corrections addressing same root cause as prior correction | <5% | 5-15% | >15% |
| Correction scope compliance | % of corrections that addressed all rejection items | >98% | 90-98% | <90% |

---

## 10. Anti-Patterns

The following correction loop behaviors are defects recorded on the agent scorecard and may trigger manager review:

| Anti-Pattern | Definition | Consequence |
|---|---|---|
| Blind resubmission | Resubmitting work without filing a Correction Report | Protocol violation; automatic escalation |
| Partial correction | Filing a Correction Report that acknowledges only some rejection items | Report rejected; treated as no response |
| Ignored feedback | Correction Report that does not address the substance of a rejection item | Report rejected; correction cycle count incremented |
| Root cause avoidance | Identifying symptoms as root causes to avoid deeper analysis | Pattern detection; Learning Office engaged |
| Manager pressure on validator | Producing agent or its manager pressuring the validator to reduce rejection items | Security flag; auditor investigation |
| Evidence retrofitting | Adding evidence to an evidence package after the fact to make prior work appear compliant | Integrity violation; audit triggered |
| Scope gaming | Correcting the appearance of compliance without correcting the underlying defect | Pattern detection; agent re-evaluation |
| Correction fatigue | Filing increasingly superficial correction reports on repeated cycles | Maximum cycle count consequence applies |
