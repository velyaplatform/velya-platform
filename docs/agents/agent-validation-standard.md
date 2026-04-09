# Agent Validation Standard

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Quality Assurance Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

Validation is the quality gate that protects the Velya enterprise from defective work being acted upon. Every significant piece of work produced by a Specialist or Coordinator Agent passes through one or more independent Validator Agents before it takes effect.

This standard defines: when validation is required, who may validate, what validators must check, how disagreements are handled, and what evidence validators must produce.

Validation is not review. A validator is not providing feedback or suggestions. A validator is making a binary determination: **this work is certified for action, or it is not.** Conditional certification ("pass if X is fixed later") is prohibited.

---

## 2. When Validation is Required

### 2.1 Validation Thresholds by Risk Class

| Risk Class   | Validators Required | Validator Offices                | Shadow Mode First?     |
| ------------ | ------------------- | -------------------------------- | ---------------------- |
| Low          | 0                   | —                                | No                     |
| Medium       | 1                   | Same or different office         | No                     |
| High         | 2                   | At least 1 from different office | Recommended            |
| Critical     | 2                   | Both from different offices      | Required               |
| Catastrophic | 3                   | All from different offices       | Required (min 4 weeks) |

### 2.2 Action Types Requiring Validation Regardless of Risk Class

The following action types always require at least one validator, even if individually classified as Low:

- Any write to a production database
- Any Kubernetes resource mutation in production
- Any secret creation, rotation, or deletion
- Any change to NATS JetStream stream configuration
- Any modification to agent contracts or permissions
- Any clinical workflow configuration change
- Any ArgoCD application sync that was not part of a validated release train
- Any change that touches PHI access patterns

### 2.3 Validation Exemptions

No permanent exemptions exist. Expedited validation (reduced SLA, single validator for normally two-validator work) may be authorized by the Office Manager Agent in declared incidents, with mandatory audit of the expedited decision within 24 hours.

---

## 3. Validator Assignment Rules

### 3.1 Independence Requirements

A validator MUST NOT be:

- The same agent that produced the work being validated
- An agent in a direct reporting relationship with the producing agent for the same piece of work
- An agent from the same team that has a shared incentive to approve the work

### 3.2 Validator Qualification Requirements

A validator must:

- Hold the `validator` role type in its contract
- Have domain competence in the domain being validated (technical, clinical, security, compliance, etc.)
- Have a current scorecard validation accuracy metric above the warning threshold
- Not be under active quarantine or probation

### 3.3 Validator Assignment Process

1. Producing agent files work and requests validation via Validation Request message
2. Coordinator routes request to the default validator specified in the producing agent's contract
3. If default validator is unavailable (quarantined, overloaded), coordinator escalates to Office Manager for reassignment
4. Office Manager assigns a qualified alternate and logs the reassignment
5. All validator assignments for Critical/Catastrophic work are logged in the audit trail regardless of who assigned

### 3.4 Validator Capacity Limits

A Validator Agent may not hold more than 10 concurrent validation requests. When capacity is exceeded, the validator must immediately notify its Manager, who must either assign additional validators or escalate to Executive for resource authorization.

---

## 4. What a Validator Must Check

### 4.1 Universal Validation Checklist (All Domains)

Every validation, regardless of domain, must complete this checklist:

```
UNIVERSAL VALIDATION CHECKLIST
================================
[ ] V-U-01: Risk class is correctly assigned for this work
[ ] V-U-02: Evidence package is complete (all required items present)
[ ] V-U-03: Evidence items are linked to specific actions (not generic)
[ ] V-U-04: Pre-state snapshot exists and is complete
[ ] V-U-05: Post-state snapshot exists and matches expected outcome
[ ] V-U-06: Deviations from the approved plan are documented
[ ] V-U-07: All required approvals for this risk class were obtained
[ ] V-U-08: Producing agent is operating within its contract scope
[ ] V-U-09: No forbidden actions were taken
[ ] V-U-10: Handoff context is sufficient (if this is a handoff)
```

### 4.2 Technical Validation Checklist

For infrastructure, platform, and DevOps work:

```
TECHNICAL VALIDATION CHECKLIST
================================
[ ] V-T-01: Configuration change matches the approved specification (manifest, RFC, or plan)
[ ] V-T-02: No unintended side effects in adjacent resources (namespace scan)
[ ] V-T-03: Resource limits and quotas are correctly set
[ ] V-T-04: NetworkPolicy does not create unintended exposures
[ ] V-T-05: Secret handling follows Velya secret management policy
[ ] V-T-06: Health checks and readiness probes are correctly configured
[ ] V-T-07: Rollback procedure is documented and tested
[ ] V-T-08: Monitoring and alerting hooks are in place
[ ] V-T-09: Logging is enabled and routing to correct sink
[ ] V-T-10: Resource naming follows Velya naming convention
[ ] V-T-11: Labels and annotations are complete per standard
[ ] V-T-12: Changes do not violate existing NetworkPolicy or RBAC
```

### 4.3 Functional Validation Checklist

For product, workflow, and feature work:

```
FUNCTIONAL VALIDATION CHECKLIST
=================================
[ ] V-F-01: Feature behavior matches the approved product specification
[ ] V-F-02: All acceptance criteria from the RFC are addressed
[ ] V-F-03: Edge cases documented in the spec are handled
[ ] V-F-04: Error states produce appropriate user/agent notification
[ ] V-F-05: Feature does not break existing functionality (regression evidence present)
[ ] V-F-06: Performance is within accepted thresholds (latency, throughput)
[ ] V-F-07: API contracts are not broken for downstream consumers
[ ] V-F-08: Feature flag or canary mechanism in place for high-risk changes
[ ] V-F-09: Data migrations are reversible or have rollback plan
[ ] V-F-10: Integration with NATS JetStream is correct (subjects, schemas)
```

### 4.4 Security Validation Checklist

For any work touching security posture, credentials, network, or access:

```
SECURITY VALIDATION CHECKLIST
================================
[ ] V-S-01: No secrets in code, manifests, logs, or evidence packages
[ ] V-S-02: Principle of least privilege is maintained
[ ] V-S-03: New network paths are explicitly authorized
[ ] V-S-04: Authentication is required on all new endpoints
[ ] V-S-05: Input validation is present on all external inputs
[ ] V-S-06: Dependency versions have no known critical CVEs
[ ] V-S-07: Container images are from approved registries
[ ] V-S-08: RBAC changes are documented and minimal
[ ] V-S-09: Security headers are correctly configured (if web-facing)
[ ] V-S-10: Logging does not capture sensitive data
[ ] V-S-11: TLS is enforced for all inter-service communication
[ ] V-S-12: Secret rotation has been performed if credentials were exposed
```

### 4.5 Compliance Validation Checklist

For HIPAA, SOC2, and regulatory work:

```
COMPLIANCE VALIDATION CHECKLIST
=================================
[ ] V-C-01: PHI access is limited to minimum necessary
[ ] V-C-02: PHI access is logged with complete audit trail
[ ] V-C-03: Data retention policy is correctly implemented
[ ] V-C-04: Business Associate Agreements cover all external data flows
[ ] V-C-05: Encryption at rest is verified for PHI stores
[ ] V-C-06: Encryption in transit is verified for PHI transfers
[ ] V-C-07: De-identification of PHI in non-clinical outputs is complete
[ ] V-C-08: Change is documented in the change management system
[ ] V-C-09: Evidence is sufficient for external audit demonstration
[ ] V-C-10: Data lineage is traceable for affected data sets
[ ] V-C-11: User access review is current for affected systems
```

### 4.6 Clinical Validation Checklist

For any work touching clinical workflows, patient data, or care coordination:

```
CLINICAL VALIDATION CHECKLIST
===============================
[ ] V-CL-01: Change does not introduce clinical decision-making by an unauthorized agent
[ ] V-CL-02: Clinical workflow logic matches the approved clinical specification
[ ] V-CL-03: Patient safety guardrails are present and functioning
[ ] V-CL-04: No patient-facing communication is generated without clinical staff approval chain
[ ] V-CL-05: PHI access matches the minimum necessary standard for the clinical function
[ ] V-CL-06: Error states in clinical workflows escalate to human clinical staff
[ ] V-CL-07: Clinical terminology is accurate (reviewed against approved clinical vocabulary)
[ ] V-CL-08: Downstream clinical system integrations are validated end-to-end
[ ] V-CL-09: Change does not affect regulatory clinical documentation requirements
[ ] V-CL-10: Clinical risk assessment has been reviewed by appropriate clinical authority
```

---

## 5. Handling Validation Disagreements

### 5.1 Between Validator and Producing Agent

When a validator rejects work, the producing agent enters the correction loop (see Correction Loop Model). The validator's rejection is not subject to debate at the specialist level. The producing agent's only options are:

1. Correct the work and resubmit
2. Escalate scope disagreement (not evidence disagreement) to the coordinator

A producing agent cannot argue against a validation finding on the basis of intent ("I meant to do X"). The validator assesses what was done, not what was intended.

### 5.2 Between Two Validators Who Disagree

When two validators are required and they reach opposing conclusions:

1. Both validators must document their positions with specific evidence citations
2. The work is placed on hold
3. The producing agent's Office Manager convenes a validation arbitration within 4 hours
4. The arbitration involves both validators and the producing agent's coordinator
5. If the Manager cannot resolve within 4 hours, it escalates to the Executive Office
6. The Executive assigns a tie-breaking third validator from a neutral office
7. The third validator's determination is final at the agent level
8. If all three are split, it becomes a Governance Council matter (rare)

### 5.3 When a Validator's Independence is Questioned

If there is any credible question about a validator's independence from the work being validated, the validation is suspended. The producing agent's manager must assign a replacement validator. The original validator's assessment is discarded. The replacement validator begins fresh with no access to the original validator's notes.

---

## 6. Escalation Path When Validation Fails

```
Rejection issued by Validator
         │
         ▼
Correction Report filed by Producing Agent (within SLA)
         │
         ▼
Corrected work submitted for revalidation
         │
     Pass? ──────────Yes──────────► Work proceeds
         │
        No
         │
         ▼ (2nd cycle)
Coordinator notified, second Correction Report
         │
         ▼
Corrected work resubmitted
         │
     Pass? ──────────Yes──────────► Work proceeds + Learning Report filed
         │
        No
         │
         ▼ (3rd cycle)
MANDATORY ESCALATION to Office Manager
Office Manager reviews producing agent + validator
Office Manager may:
  - Redesign the task
  - Assign a different specialist
  - Quarantine the producing agent (if pattern)
  - Override validation (extremely rare, requires audit)
         │
         ▼
If Manager override: Auditor required within 24 hours
If redesign: Factory RFC may be required
```

---

## 7. Evidence Requirements for Validation Reports

Every Validation Report must include:

| Evidence Item                                                       | Required | Retention |
| ------------------------------------------------------------------- | -------- | --------- |
| Completed validation checklist (every item dispositioned)           | Yes      | 365 days  |
| References to evidence items reviewed                               | Yes      | 365 days  |
| Specific quotes or references from evidence supporting each finding | Yes      | 365 days  |
| Validator's risk class assessment                                   | Yes      | 365 days  |
| Time log (when validation started, completed)                       | Yes      | 365 days  |
| Independence declaration                                            | Yes      | 365 days  |
| Certification or rejection decision with rationale                  | Yes      | 365 days  |
| Evidence package completeness assessment                            | Yes      | 365 days  |

For Critical and Catastrophic work, additionally:

- Hash verification of all evidence items reviewed
- Formal independence confirmation from Office Manager
- Secondary validator cross-reference

---

## 8. Validator Scorecard Metrics

| Metric                      | Definition                                              | Target | Warning               | Critical |
| --------------------------- | ------------------------------------------------------- | ------ | --------------------- | -------- |
| Validation accuracy         | % of certifications with no post-deployment defect      | >98%   | 92-98%                | <92%     |
| False rejection rate        | % of rejections later overturned                        | <2%    | 2-8%                  | >8%      |
| Checklist completion rate   | % of validations with all checklist items dispositioned | 100%   | 97-100%               | <97%     |
| SLA adherence               | % of reports delivered within SLA                       | >95%   | 85-95%                | <85%     |
| Evidence gap detection rate | % of validations that correctly identify evidence gaps  | >95%   | 85-95%                | <85%     |
| Independence violation rate | % of validations where independence was violated        | 0%     | >0 = immediate action | N/A      |

---

## 9. Prohibited Validator Behaviors

The following behaviors by a Validator Agent are grounds for immediate quarantine and audit:

| Prohibited Behavior           | Definition                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| Self-validation               | Validating work the agent itself produced                                                      |
| Rubber-stamp certification    | Certifying work without completing the validation checklist                                    |
| Conditional certification     | Issuing a pass with conditions that must be resolved later                                     |
| Incomplete checklist          | Marking checklist items N/A without documented justification                                   |
| Evidence fabrication          | Citing evidence items that do not exist or were not reviewed                                   |
| Independence violation        | Validating when in a reporting relationship with the producing agent                           |
| Pressure-driven certification | Changing a rejection to a pass due to manager or deadline pressure (must be escalated instead) |
| Retroactive validation        | Back-dating a validation report to cover work already deployed                                 |
| Scope concession              | Reducing the scope of validation without documented authorization                              |

Any validator agent that exhibits a prohibited behavior has its validation certification retroactively suspended for the affected work. The work must be re-validated by a different validator.
