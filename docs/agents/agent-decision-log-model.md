# Agent Decision Log Model

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Knowledge & Memory Office / Compliance & Audit Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

Every significant decision made by an agent must be logged. The decision log is not a general activity log — it is the record of choices made at decision points where alternatives existed and where the choice had meaningful consequences. It is the institutional memory of why things are the way they are.

Decision logs serve three distinct functions:

1. **Accountability:** When outcomes are reviewed, the decision that led to them is traceable
2. **Learning:** Patterns across many decisions reveal systemic strengths and weaknesses
3. **Audit:** Regulatory and institutional audits require evidence that decisions were made with appropriate care and rationale

---

## 2. What Constitutes a "Significant Decision"

Not every action requires a decision log entry. The following criteria determine significance:

### 2.1 Always Requires a Decision Log Entry

- Any action classified as High, Critical, or Catastrophic risk
- Any exception to the normal process (requesting a validation waiver, using a fallback)
- Any escalation decision (to escalate vs. to handle locally)
- Any decision to reject a handoff
- Any correction plan design (which approach to take when correcting rejected work)
- Any decision involving PHI access that wasn't pre-authorized in the contract
- Any cross-office authorization request
- Any permission expansion request
- Any decision to override a default behavior specified in the contract

### 2.2 Requires a Decision Log Entry When Risk Class is Medium or Above

- Task decomposition strategy (how to break work into subtasks)
- Tool or approach selection (which of several available approaches to use)
- Evidence collection strategy (which evidence to prioritize when time-constrained)
- Dependency resolution decisions (which dependency path to take)

### 2.3 Does NOT Require a Decision Log Entry

- Routine task execution following a well-defined procedure with no alternatives
- Administrative actions with no meaningful alternatives (filing a required report, sending a required acknowledgment)
- Actions explicitly specified in a task assignment with no agent discretion

When in doubt: if you had to think about it or choose between options, log it.

---

## 3. Decision Log Entry Schema

```yaml
decision_log_entry:
  # ─── IDENTITY ───────────────────────────────────────────
  entry_id: string # UUID — immutable, assigned at creation
  decision_id: string # human-readable: DEC-{agent-slug}-{date}-{seq}
  logged_at: datetime # when decision was made and logged (must be contemporaneous)
  logged_by: string # agent canonical ID
  office: string
  task_id: string # the task context for this decision
  workflow_id: string

  # ─── DECISION CONTEXT ────────────────────────────────────
  decision_type:
    enum:
      [
        approach_selection,
        escalation,
        exception_request,
        correction_design,
        risk_reclassification,
        permission_expansion,
        handoff_rejection,
        scope_interpretation,
        fallback_activation,
        task_decomposition,
      ]
  decision_title: string # one-line description of the decision
  decision_description: string # full context — what was the decision point?
  decision_trigger: string # what event or condition required this decision?

  # ─── ANALYSIS ────────────────────────────────────────────
  context:
    current_state: string # state of the world when decision was made
    constraints: list<string> # constraints the decision must work within
    time_pressure: string # was there urgency? what was the deadline?

  alternatives_considered:
    - alternative_id: string
      description: string
      pros: list<string>
      cons: list<string>
      risk_assessment: string
      why_not_selected: string

  selected_option:
    description: string
    rationale: string # why this option was selected
    primary_evidence: list<string> # evidence supporting this choice
    assumptions_made: list<string> # what was assumed to be true

  # ─── RISK ASSESSMENT ─────────────────────────────────────
  risk_class: string
  expected_impact:
    positive: string
    negative_if_wrong: string
    reversibility: enum [reversible, partially-reversible, irreversible]
    blast_radius: string
    clinical_impact: string

  # ─── GOVERNANCE ──────────────────────────────────────────
  requires_approval: bool
  approval_from: string # agent or role if approval required
  approval_obtained_at: datetime
  approval_evidence_ref: string

  # ─── PHI HANDLING ────────────────────────────────────────
  phi_involved: bool
  phi_de_identified: bool # if phi_involved = true
  phi_handling_justification: string

  # ─── OUTCOME (FILLED RETROSPECTIVELY) ────────────────────
  outcome_recorded: bool
  outcome_recorded_at: datetime
  actual_outcome: string
  outcome_matched_expectation: bool
  variance_explanation: string # if outcome did not match expectation
  learning_generated: bool
  learning_report_id: string # if learning_generated = true
```

---

## 4. Contemporaneous Logging Requirement

Decision log entries must be logged **at the time the decision is made**, not reconstructed afterward. A decision log entry filed more than 30 minutes after the decision was made is flagged as potentially retroactive and is:

- Timestamped with both the claimed decision time and the actual filing time
- Reviewed by the Compliance Office if the gap is more than 2 hours
- Rejected and flagged as an integrity issue if the gap is more than 24 hours

The only exception: in declared emergency scenarios, logging may be deferred until the emergency is stabilized, but must then be filed within 2 hours of stabilization with a note explaining the deferral.

---

## 5. Storage Requirements

### 5.1 Immutability

Decision log entries are write-once. Once filed:

- The entry cannot be modified
- The entry cannot be deleted
- Corrections are made by filing a **Decision Log Correction** entry that references the original entry ID and documents the correction

### 5.2 Auditability

The decision log is stored with:

- Per-entry hash (SHA-256 of entry contents)
- Merkle chain (each entry references the hash of the previous entry from the same agent)
- Independent hash verification by the Compliance Office on any audit
- Access logs for every read operation (who read which decision, when)

### 5.3 Queryability

The decision log must be queryable by:

- Agent ID
- Office
- Task ID
- Workflow ID
- Date range
- Decision type
- Risk class
- Outcome (matched/did not match expectation)
- PHI involvement flag

---

## 6. Decision Log Review Cadence

| Review Type                    | Frequency        | Reviewer                     | Purpose                                            |
| ------------------------------ | ---------------- | ---------------------------- | -------------------------------------------------- |
| Individual entry review        | At time of audit | Auditor                      | Verify specific decision was sound                 |
| Pattern analysis               | Monthly          | Knowledge & Memory Office    | Identify systemic decision quality trends          |
| Outcome reconciliation         | Monthly          | Office Manager               | Match decisions to their outcomes                  |
| PHI decision audit             | Monthly          | Compliance & Data Governance | Verify PHI handling decisions comply with HIPAA    |
| Cross-agent decision alignment | Quarterly        | ARB + Learning Office        | Detect conflicting decision patterns across agents |

---

## 7. Decision Logs in Audits

When an auditor reviews a task or workflow, the decision log is a primary evidence source. Auditors look for:

1. **Decision completeness:** Were all significant decisions logged?
2. **Alternative consideration:** Did the agent genuinely consider alternatives, or was the log filled in post-hoc with a single option?
3. **Evidence quality:** Are the cited evidence references real and accessible?
4. **Assumption validity:** Were the stated assumptions reasonable at the time?
5. **Outcome alignment:** Did actual outcomes match the decision's expected impact?
6. **Learning generation:** When outcomes differed from expectations, did the agent file a Learning Report?

A task with missing decision log entries for High+ risk decisions is an automatic audit finding.

---

## 8. Informing Institutional Learning

The Learning Office reviews decision log patterns quarterly to identify:

- **Recurring decision points:** Decisions that many agents make frequently → may benefit from a standardized playbook
- **Frequent alternative consideration of the same options:** Agents repeatedly weighing the same trade-offs → may benefit from a rule or default
- **High outcome variance:** Decisions where expected and actual outcomes frequently diverge → agents need better information or training
- **Assumption failures:** Decisions where stated assumptions proved incorrect → assumption deserves investigation

Pattern findings from decision log analysis are treated as learning events and processed through the Learning Propagation Model.

---

## 9. Retention Policy

| Decision Type                    | Minimum Retention                      |
| -------------------------------- | -------------------------------------- |
| Standard operational decisions   | 2 years                                |
| High and Critical risk decisions | 7 years                                |
| PHI-related decisions            | 7 years (HIPAA requirement)            |
| Decisions leading to incidents   | 7 years                                |
| Contract amendment decisions     | Permanent (linked to contract history) |
| Governance-level decisions       | Permanent                              |

Archived decision logs are preserved in the Knowledge & Memory Office archive and are queryable by authorized agents and human auditors.

---

## 10. Privacy Requirements for Decision Logs

### 10.1 PHI De-identification

When a decision involves PHI (e.g., a clinical workflow decision involving patient data), the decision log entry must:

- Not include direct patient identifiers (name, DOB, MRN, SSN, address, etc.)
- Reference patient records by an internal correlation ID that is itself stored in a separate, access-controlled system
- Include only the minimum PHI necessary to document the decision rationale
- Be classified as `confidential` in the report header

### 10.2 De-identification Standard

De-identification follows the HIPAA Expert Determination or Safe Harbor method, applied as follows:

| Field Type       | Handling                                         |
| ---------------- | ------------------------------------------------ |
| Patient name     | Replace with "Patient-{internal-correlation-id}" |
| MRN              | Replace with internal correlation ID             |
| Date of birth    | Replace with age bracket (e.g., "adult 40-50")   |
| Diagnosis codes  | Retain (HIPAA-permissible for operations)        |
| Location/unit    | Retain at facility level (not room number)       |
| Clinical pathway | Retain as pathway type (not individual plan)     |

---

## 11. Example Decision Log Entries

### Example 1: Low Risk Decision (Escalation Decision)

```yaml
entry_id: 'dle-2026-04-08-001'
decision_id: 'DEC-infra-spec-2026-04-08-001'
logged_at: '2026-04-08T09:15:00Z'
logged_by: 'platform-office/infrastructure-specialist-agent'
office: 'Platform & Infrastructure'
task_id: 'task-infra-2026-04-08-034'
workflow_id: 'wf-namespace-provisioning-041'

decision_type: escalation
decision_title: 'Escalate namespace ResourceQuota conflict to coordinator'
decision_description: >
  While provisioning the velya-clinical-v2 namespace per RFC-INFRA-041, discovered
  that the requested CPU quota (8 cores) exceeds the node pool's available capacity
  in the us-east-1a availability zone by approximately 2 cores. This was not
  anticipated in the RFC.
decision_trigger: 'kubectl apply returned resource quota conflict warning'
context:
  current_state: 'Namespace created; ResourceQuota apply failed due to insufficient capacity'
  constraints:
    - 'Cannot modify node pool capacity (requires RFC and manager approval)'
    - 'Cannot reduce requested quota without RFC revision'
    - 'Maintenance window expires in 90 minutes'
  time_pressure: 'Maintenance window; clinical team expecting namespace by 11:00'

alternatives_considered:
  - alternative_id: 'alt-1'
    description: 'Apply reduced quota (6 cores) as temporary measure'
    pros: ['Unblocks provisioning', 'Namespace ready for clinical team']
    cons: ['Deviates from RFC specification', 'May cause performance issues']
    risk_assessment: 'Medium — RFC deviation without approval'
    why_not_selected: 'Deviation from approved RFC requires coordinator approval'
  - alternative_id: 'alt-2'
    description: 'Escalate to coordinator for RFC revision decision'
    pros: ['Process compliant', 'Correct authority for RFC changes']
    cons: ['May miss maintenance window']
    risk_assessment: 'Low — correct process'
    why_not_selected: 'SELECTED'

selected_option:
  description: 'Escalate to coordinator with full context; halt provisioning pending direction'
  rationale: >
    Deviating from an approved RFC without authority is a scope violation. The correct
    process requires coordinator or manager authorization for RFC changes. The maintenance
    window constraint creates urgency but does not grant authority to deviate.
  primary_evidence:
    - 'evidence/infra/task-034/quota-conflict-log.yaml'
    - 'RFC-INFRA-041 (quota specification section)'
  assumptions_made:
    - 'Coordinator can be reached within 15 minutes'
    - 'If window is missed, a new window can be scheduled within 24 hours'

risk_class: low
expected_impact:
  positive: 'Process integrity maintained; correct authority makes RFC decision'
  negative_if_wrong: 'Missed maintenance window; 24-hour delay for clinical team'
  reversibility: reversible
  blast_radius: 'Single namespace provisioning task'
  clinical_impact: 'Minor delay — clinical team informed'

requires_approval: false
phi_involved: false
outcome_recorded: true
outcome_recorded_at: '2026-04-08T10:45:00Z'
actual_outcome: >
  Coordinator authorized RFC amendment to split quota across two namespaces.
  Provisioning completed within the maintenance window.
outcome_matched_expectation: true
learning_generated: false
```

---

### Example 2: High Risk Decision (Exception Request)

```yaml
entry_id: 'dle-2026-04-08-047'
decision_id: 'DEC-security-spec-2026-04-08-047'
logged_at: '2026-04-08T14:02:00Z'
logged_by: 'security-office/vuln-assessment-specialist-agent'
office: 'Security'
task_id: 'task-security-2026-04-08-089'
workflow_id: 'wf-vuln-scan-critical-2026-041'

decision_type: exception_request
decision_title: 'Request expedited validation for Critical CVE remediation'
decision_description: >
  CVE-2026-18471 (CVSS 9.8) has been identified in the velya-clinical-intake
  service's base image. Standard validation requires 2 validators with 4-hour SLA.
  The vulnerability is actively exploited in the wild per CISA KEV. Remediation
  must be applied immediately to prevent exploitation.
decision_trigger: >
  CISA KEV alert received at 13:45. CVE affects container base image with
  unauthenticated remote code execution vector.

context:
  current_state: 'Patch available; testing environment validated; awaiting 2nd validator'
  constraints:
    - '2-validator requirement for High risk actions per Validation Standard'
    - 'CISA KEV exploit actively circulating — exploitation risk increasing hourly'
    - 'Validator-2 (security-office/config-validator-agent) is at capacity — 3-hour estimated wait'
  time_pressure: 'CRITICAL — CISA KEV active exploitation. Every hour increases risk.'

alternatives_considered:
  - alternative_id: 'alt-1'
    description: 'Wait for standard 2-validator process'
    pros: ['Full process compliance', 'No exception required']
    cons: ['3+ hour delay with critical active vulnerability']
    risk_assessment: 'Critical — active exploitation risk during delay'
    why_not_selected: 'Risk of waiting exceeds risk of expedited validation'
  - alternative_id: 'alt-2'
    description: 'Request expedited validation with single validator + enhanced monitoring'
    pros: ['Remediation applied within 45 minutes', 'Enhanced monitoring compensates']
    cons: ['Process exception required', 'Mandatory audit within 24 hours']
    risk_assessment: 'High — exception to validation standard, but lower than exploitation risk'
    why_not_selected: 'SELECTED — net risk is lower than alt-1'
  - alternative_id: 'alt-3'
    description: 'Network isolate the service until full validation'
    pros: ['Eliminates exploitation risk without process exception']
    cons: ['Service isolation impacts clinical operations; patient care affected']
    risk_assessment: 'Critical for clinical impact — not viable'
    why_not_selected: 'Clinical impact unacceptable'

selected_option:
  description: >
    Request Security Manager authorization for expedited single-validator process.
    Mandatory audit within 24 hours. Enhanced monitoring immediately post-patch.
  rationale: >
    The exploit risk during a standard 3-hour wait (CVSS 9.8, active exploitation)
    outweighs the risk of a single-validator exception with mandatory post-action audit.
    This is the purpose of the expedited validation exception procedure.
  primary_evidence:
    - 'evidence/security/task-089/cisa-kev-alert-2026-04-08.pdf'
    - 'evidence/security/task-089/cvss-score-breakdown.json'
    - 'evidence/security/task-089/exploit-activity-report.json'
    - 'evidence/security/task-089/patch-test-results.json'
  assumptions_made:
    - 'Patch does not introduce new vulnerabilities (tested in sandbox)'
    - 'Enhanced monitoring will detect any exploitation attempt during reduced-validation window'

risk_class: high
expected_impact:
  positive: 'Critical CVE remediated within 45 minutes; exploitation risk eliminated'
  negative_if_wrong: 'Patch causes regression; mitigated by rollback plan and enhanced monitoring'
  reversibility: partially-reversible
  blast_radius: 'velya-clinical-intake service; all active clinical sessions'
  clinical_impact: 'Brief service restart; <30 second disruption expected'

requires_approval: true
approval_from: 'security-office/security-manager-agent'
approval_obtained_at: '2026-04-08T14:18:00Z'
approval_evidence_ref: 'approvals/security/manager-2026-04-08-expedited-val-089'

phi_involved: false
outcome_recorded: true
outcome_recorded_at: '2026-04-08T16:30:00Z'
actual_outcome: >
  Expedited validation approved and completed. Patch applied at 14:45. Service
  restarted in 22 seconds. No exploitation detected. Mandatory audit completed
  at 08:00 next day — clean finding. Enhanced monitoring deactivated after 72 hours.
outcome_matched_expectation: true
learning_generated: true
learning_report_id: 'lr-2026-04-08-expedited-validation-process'
```

---

### Example 3: Critical Risk Decision (PHI Access Reclassification)

```yaml
entry_id: 'dle-2026-04-08-112'
decision_id: 'DEC-data-gov-2026-04-08-112'
logged_at: '2026-04-08T16:30:00Z'
logged_by: 'data-governance/phi-access-specialist-agent'
office: 'Data Governance'
task_id: 'task-data-gov-2026-04-08-201'
workflow_id: 'wf-discharge-analytics-2026-041'

decision_type: risk_reclassification
decision_title: 'Reclassify discharge analytics job from Medium to Critical due to re-identification risk'
decision_description: >
  The quarterly discharge analytics report was classified as Medium risk because it
  uses de-identified data. However, analysis shows the combination of fields in the
  output (AZ-level location, discharge pathway, age bracket, and LOS) creates a
  re-identification risk for small patient cohorts (n<5 in some cells).
decision_trigger: >
  Data quality review of the analytics output revealed 12 cells with patient
  counts below 5, which violates the HIPAA Safe Harbor de-identification standard
  (§164.514(b)(2)).

context:
  current_state: 'Analytics job completed; output awaiting final validation before distribution'
  constraints:
    - 'Report requested by hospital CMO for board presentation in 48 hours'
    - 'HIPAA Safe Harbor standard requires suppression of small cell counts'
    - 'Cannot distribute the report in current form'
  time_pressure: 'Board presentation deadline is a constraint but not a reason to violate HIPAA'

alternatives_considered:
  - alternative_id: 'alt-1'
    description: 'Distribute report with disclosure of small cell risk'
    pros: ['Meets CMO timeline']
    cons: ['HIPAA violation — re-identification risk is prohibited even with disclosure']
    risk_assessment: 'Catastrophic — direct HIPAA violation'
    why_not_selected: 'Unacceptable — regulatory violation'
  - alternative_id: 'alt-2'
    description: "Suppress small cell counts (replace with '<5') and redistribute"
    pros: ['HIPAA compliant', 'Most data preserved', 'Meets modified deadline']
    cons: ['Some data loss', 'CMO informed of suppression needed']
    risk_assessment: 'Medium — suppression reduces analytical precision but is HIPAA-compliant'
    why_not_selected: 'SELECTED — compliant and preserves majority of data value'
  - alternative_id: 'alt-3'
    description: 'Aggregate to higher geographic level to eliminate small cells'
    pros: ['No data suppression', 'HIPAA compliant']
    cons: ['Loses granularity requested by CMO; significant re-work']
    risk_assessment: 'Low — fully compliant'
    why_not_selected: 'Suppression (alt-2) is simpler and preserves more value'

selected_option:
  description: >
    Reclassify job to Critical risk. Apply small cell suppression per HIPAA Safe Harbor.
    Notify CMO of 4-hour delay. File mandatory Compliance audit notification.
    Revalidate with HIPAA validator before distribution.
  rationale: >
    Re-identification risk in healthcare analytics is a well-established HIPAA violation
    category. The Safe Harbor standard explicitly prohibits small cell counts. The CMO
    timeline does not override regulatory compliance. Suppression is the standard
    remediation and preserves the report's primary analytical value.
  primary_evidence:
    - 'evidence/data-gov/task-201/analytics-cell-count-audit.xlsx'
    - 'evidence/data-gov/task-201/hipaa-safe-harbor-reference.pdf'
    - 'docs/compliance/phi-de-identification-standard.md'
  assumptions_made:
    - 'Suppressing 12 cells still allows meaningful board-level insights'
    - 'CMO will accept the 4-hour delay given the regulatory requirement'
    - 'HIPAA validator can complete review within 3 hours'

risk_class: critical
expected_impact:
  positive: 'HIPAA compliance maintained; re-identification risk eliminated'
  negative_if_wrong: 'If suppression is insufficient, further data review required'
  reversibility: reversible
  blast_radius: 'Single analytics report — no patient systems affected'
  clinical_impact: 'Indirect — board insight on discharge efficiency will be slightly less granular'

requires_approval: true
approval_from: 'data-governance/data-manager-agent + compliance-office/compliance-manager-agent'
approval_obtained_at: '2026-04-08T16:48:00Z'
approval_evidence_ref: 'approvals/data-gov/compliance-2026-04-08-phi-reclassification-201'

phi_involved: true
phi_de_identified: true
phi_handling_justification: >
  Decision involves re-identification risk assessment of de-identified data.
  No direct PHI is referenced in this log entry. Patient correlation IDs
  are stored in the HIPAA-compliant analytics evidence store only.

outcome_recorded: false # pending — report distribution scheduled for tomorrow
learning_generated: false # pending outcome
```
