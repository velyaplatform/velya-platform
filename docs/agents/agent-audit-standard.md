# Agent Audit Standard

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Compliance & Audit Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

Audit is the institutional mechanism for verifying that the governance process itself is being followed. Where validation checks that work is correct, audit checks that **the entire process — from task assignment through evidence collection through validation — was executed in accordance with policy**.

Audit is not a second validation. An auditor does not re-check whether the infrastructure manifest is technically correct. An auditor verifies that: the risk was correctly classified, the correct number of validators was engaged, the validators were independent, the evidence is complete and unmodified, and the entire process trail is traceable.

Audit is the instrument of institutional integrity. Without it, governance is aspirational rather than enforced.

---

## 2. Audit vs. Validation: Distinction

| Dimension | Validation | Audit |
|---|---|---|
| Question asked | "Is this work correct?" | "Was the process correctly followed?" |
| Who is examined | The work product | The validation chain and evidence |
| When it runs | Before work takes effect | After validation, before or after deployment |
| Who performs it | Validator Agent | Auditor Agent |
| Independence required from | Producing agent | Both producing agent and validator |
| Output | Certification or rejection | Audit Report with findings |
| Action on failure | Correction loop | Finding registry + escalation |

---

## 3. When Audit is Required

### 3.1 Risk-Class Triggers

| Risk Class | Audit Required | Auditor Independence | Scheduling |
|---|---|---|---|
| Low | No | — | — |
| Medium | Spot check (20% of tasks) | Different team within office | Post-completion |
| High | Yes — every task | Different office | Post-validation, pre-deployment |
| Critical | Yes — every task | Completely different office | Post-validation, pre-deployment |
| Catastrophic | Yes — dual audit | Two separate offices | Pre-deployment + post-deployment |

### 3.2 Event-Based Audit Triggers (Regardless of Risk Class)

- Any human intervention event
- Any quarantine event
- Any security incident
- Any PHI access anomaly
- Any agent operating outside its declared contract scope
- Any validation override by an Office Manager
- Any exception report classified High or Critical
- Any post-action review with systemic findings
- External regulatory audit preparation
- Any agent promotion from Probation to Active

### 3.3 Scheduled Audits

| Schedule | Scope | Owner |
|---|---|---|
| Weekly | Active High-risk agents (sample 25%) | Compliance & Audit Office |
| Monthly | All offices — process adherence | Compliance & Audit Office |
| Quarterly | Full enterprise — HIPAA and SOC2 readiness | Compliance & Audit Office + External |
| Annual | Comprehensive institutional audit | External Auditor (human) |

---

## 4. Auditor Independence Requirements

An auditor must satisfy ALL of the following:

1. **Not in the producing agent's reporting chain** for the work being audited
2. **Not in the validating agent's reporting chain** for the work being audited
3. **Not from the same office** as either the producing agent or validating agent (for High and above)
4. **No shared scorecard incentive** with the agent being audited
5. **Not under active quarantine or probation**
6. **Has audit competence** in the domain being audited
7. **Scorecard audit finding accuracy** above warning threshold

For Critical and Catastrophic audits, the Compliance & Audit Office Manager must confirm auditor independence in writing before the audit begins.

---

## 5. What an Auditor Checks

### 5.1 Process Completeness Checklist

```
PROCESS COMPLETENESS AUDIT CHECKLIST
======================================
[ ] A-P-01: Task was assigned through formal channels (not ad-hoc)
[ ] A-P-02: Task is within the producing agent's declared contract scope
[ ] A-P-03: Risk class was correctly assessed per the Risk Classification Model
[ ] A-P-04: Correct number of validators was engaged per risk class
[ ] A-P-05: All validators were independent per the Validation Standard
[ ] A-P-06: Validation completed before work took effect (no retroactive validation)
[ ] A-P-07: All required approvals for the risk class were obtained
[ ] A-P-08: Correction loop was followed for any rejections
[ ] A-P-09: Evidence was collected during execution (not reconstructed afterward)
[ ] A-P-10: Escalation procedures were followed when blockers occurred
```

### 5.2 Evidence Quality Checklist

```
EVIDENCE QUALITY AUDIT CHECKLIST
===================================
[ ] A-E-01: All required evidence items per the agent's contract are present
[ ] A-E-02: Evidence items are timestamped and the timestamps are plausible
[ ] A-E-03: Evidence items are linked to specific actions (not generic artifacts)
[ ] A-E-04: Hash verification confirms evidence has not been modified post-collection
[ ] A-E-05: Pre-state and post-state snapshots exist and are complete
[ ] A-E-06: Evidence storage location follows the institutional evidence model
[ ] A-E-07: Evidence retention period is correctly set
[ ] A-E-08: PHI in evidence is correctly classified and restricted
[ ] A-E-09: Evidence chain has no gaps — all actions have corresponding evidence
[ ] A-E-10: Evidence is sufficient to reproduce the audit trail without the producing agent's participation
```

### 5.3 Traceability Checklist

```
TRACEABILITY AUDIT CHECKLIST
==============================
[ ] A-T-01: Task is traceable to an approved RFC or authorized work request
[ ] A-T-02: All decisions during execution are logged in the decision log
[ ] A-T-03: All handoffs are documented with confirmed receipt
[ ] A-T-04: All escalations have response records
[ ] A-T-05: Validation reports reference the correct task and evidence package
[ ] A-T-06: Correction cycles are fully documented with rationale
[ ] A-T-07: Learning identified during the task is filed as Learning Report
[ ] A-T-08: The entire workflow is reconstructable from logs alone
```

### 5.4 Policy Adherence Checklist

```
POLICY ADHERENCE AUDIT CHECKLIST
===================================
[ ] A-PC-01: Agent operated within its declared contract permissions
[ ] A-PC-02: No forbidden actions were taken (per contract's forbidden_actions list)
[ ] A-PC-03: PHI handling complies with HIPAA minimum necessary standard
[ ] A-PC-04: Secret handling complies with Velya secret management policy
[ ] A-PC-05: Naming conventions were followed
[ ] A-PC-06: Reporting SLAs were met (or documented exceptions exist)
[ ] A-PC-07: Cross-office handoffs had required authorizations
[ ] A-PC-08: Agent lifecycle stage is current and correctly staged
[ ] A-PC-09: Contract version was current at time of task execution
[ ] A-PC-10: Agent scorecard is within acceptable thresholds (no deferred action items)
```

---

## 6. Audit Trail Requirements

The following must be logged for every significant action in the Velya enterprise. "Significant" is defined as any action that changes state, accesses PHI, or is required by policy.

### 6.1 Mandatory Audit Log Fields

```yaml
audit_log_entry:
  entry_id: string              # UUID
  timestamp: datetime           # nanosecond precision, UTC
  agent_id: string              # canonical agent name
  office: string
  action_type: string           # create, read, update, delete, execute, validate, audit, escalate, handoff
  action_description: string
  target_resource: string       # what was acted upon
  target_resource_id: string
  task_id: string
  workflow_id: string
  correlation_id: string
  outcome: string               # success, failure, partial
  risk_class: string
  authorization_ref: string     # what authorized this action
  evidence_refs: list<string>
  contains_phi: bool
  phi_access_justification: string  # if contains_phi = true
  immutable: bool               # true = cannot be modified or deleted
  hash_sha256: string           # hash of entry contents for integrity verification
```

### 6.2 Immutability Requirements

All audit log entries are write-once. No agent has permission to modify or delete an audit log entry. Attempts to modify audit logs are themselves security incidents and trigger immediate escalation to the Security and Compliance Offices.

Audit logs are stored in a separate, append-only store with independent access controls. The only permitted operations are: append and read. The Compliance & Audit Office Manager is the sole authorized reader for external audit purposes.

### 6.3 Audit Log Retention

| Content Type | Minimum Retention |
|---|---|
| Standard operational logs | 365 days |
| High-risk action logs | 7 years |
| PHI access logs | 7 years (HIPAA requirement) |
| Security incident logs | 7 years |
| Regulatory compliance logs | 7 years |
| Clinical workflow logs | 7 years |

---

## 7. Audit Evidence Templates

### 7.1 Audit Evidence Package (Standard)

```yaml
audit_evidence_package:
  package_id: string
  audit_id: string
  subject_task_id: string
  subject_agent: string
  prepared_by: string           # auditor agent
  prepared_at: datetime
  contents:
    - item_id: string
      item_type: string
      item_description: string
      storage_ref: string
      hash_sha256: string
      verified_at: datetime
      verification_outcome: string
  completeness_assessment: string
  integrity_assessment: string
  gap_list: list<string>
```

### 7.2 HIPAA Audit Evidence Package

For any audit involving PHI, the following additional items are required:

```yaml
hipaa_evidence_package:
  extends: audit_evidence_package
  phi_access_log_ref: string
  minimum_necessary_justification: string
  phi_de_identification_evidence: string  # if PHI was de-identified in outputs
  baa_coverage_confirmed: bool
  encryption_at_rest_verified: bool
  encryption_in_transit_verified: bool
  breach_risk_assessment: string
  hipaa_officer_notification_required: bool
```

---

## 8. Audit Failure Consequences

### 8.1 Finding Severity Classification

| Severity | Definition | Consequence |
|---|---|---|
| Informational | Process improvement opportunity, no policy violation | Logged, reviewed in monthly PAR |
| Low | Minor deviation, compensating controls present | Action item, 30-day remediation |
| Medium | Policy deviation, no immediate risk | Action item, 14-day remediation, PAR filed |
| High | Significant policy violation or evidence gap | Immediate escalation, 7-day remediation, manager review |
| Critical | Serious compliance failure, regulatory exposure, or evidence integrity issue | Immediate executive notification, 48-hour remediation, potential quarantine |

### 8.2 Consequence Matrix

| Finding Severity | Agent Consequence | Manager Consequence | Office Consequence |
|---|---|---|---|
| Informational | Scorecard note | None | None |
| Low | Scorecard deduction | Awareness notification | Aggregate tracking |
| Medium | Scorecard deduction + correction plan required | Correction plan review | Office scorecard impact |
| High | Probation consideration + mandatory PAR | Manager performance note | Executive notification |
| Critical | Quarantine investigation triggered | Manager review required | Office intervention possible |

---

## 9. Regulatory Audit Readiness

### 9.1 HIPAA Audit Readiness Requirements

The Compliance & Audit Office maintains continuous HIPAA audit readiness. The following must be available within 48 hours of an external audit request:

- Complete PHI access log for any requested period (minimum 7 years)
- Business Associate Agreement registry for all third-party data processors
- Encryption verification evidence for all PHI stores and transfers
- Minimum Necessary Standard documentation for each PHI access pattern
- Breach risk assessment records
- Security incident log
- Workforce training records (agent capability certifications)
- Data retention and disposal documentation

### 9.2 SOC2 Audit Readiness Requirements

The following SOC2 Trust Service Criteria evidence is maintained continuously:

| Criterion | Evidence Required | Responsible Office |
|---|---|---|
| CC6.1 Logical access controls | RBAC audit, permission review | Security Office |
| CC6.2 Least privilege | Permission scope review for all agents | Security + Agent Factory |
| CC6.3 External access | Network policy review, API gateway audit | Platform + Security |
| CC7.2 Monitoring | Watchdog coverage report, alert log | Agent Runtime Supervision |
| CC8.1 Change management | Change log, validation records | Service Management |
| A1.1 Availability | SLO performance history | Reliability Office |

---

## 10. Audit Finding Prioritization and Tracking

### 10.1 Finding Registration

Every audit finding is registered in the Compliance Finding Registry within 4 hours of the audit report being filed. The registry entry includes:

- Finding ID and severity
- Responsible office and agent
- Policy violated
- Remediation owner
- Remediation deadline
- Escalation path if deadline is missed

### 10.2 Finding Tracking Cadence

| Severity | Review Cadence | Escalation on Miss |
|---|---|---|
| Informational | Monthly | None — aggregate report |
| Low | Monthly | 30-day overdue → manager alert |
| Medium | Weekly | 14-day overdue → manager escalation |
| High | Daily | 7-day overdue → executive escalation |
| Critical | Continuous | 48-hour overdue → immediate human escalation |

### 10.3 Finding Closure Requirements

A finding is closed only when:
1. Remediation is complete
2. Evidence of remediation is filed in the Evidence Store
3. An auditor from a different office than the one that found the issue has independently verified the remediation
4. The Compliance Office Manager has approved the closure

---

## 11. Auditor Scorecard Metrics

| Metric | Definition | Target | Warning | Critical |
|---|---|---|---|---|
| Finding accuracy | % of findings confirmed valid on management review | >97% | 90-97% | <90% |
| False positive rate | % of findings later overturned | <3% | 3-10% | >10% |
| Evidence completeness | % of audits with fully complete evidence packages | 100% | 97-100% | <97% |
| SLA adherence | % of audit reports delivered within SLA | >98% | 90-98% | <90% |
| Independence compliance | % of audits where independence was properly confirmed | 100% | 100% = floor | N/A |
| Finding registration timeliness | % of findings registered in finding registry within 4 hours | >99% | 95-99% | <95% |
| Closure verification quality | % of closure verifications that detected inadequate remediation | Tracked, no threshold (used to assess auditor rigor) | — | — |
