# Risk Classification Model

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Compliance & Audit Office / Executive Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

Every agent action in the Velya enterprise carries a risk class. The risk class determines the governance requirements that apply: how many validators, whether an auditor is needed, whether shadow mode is required, how monitoring is calibrated, and whether human oversight is needed.

Risk classification is not optional and not negotiable. An agent that underclassifies risk to reduce governance burden is committing a governance defect. An agent that chronically overclassifies risk is creating unnecessary overhead — also a defect. Both patterns are tracked on the agent scorecard.

---

## 2. Risk Classes

### Low

**Definition:** The action has minimal blast radius, is easily reversible, and has no clinical or regulatory implications. If it goes wrong, it can be fixed quickly with no institutional consequence.

**Examples:** Reading configuration, filing a status report, querying metrics, updating a non-critical config annotation.

### Medium

**Definition:** The action affects a bounded scope, is reversible with reasonable effort, and has indirect clinical or regulatory implications at most.

**Examples:** Provisioning a development namespace, running a non-critical regression test suite, updating a non-PHI data field, publishing a non-critical NATS event.

### High

**Definition:** The action has a meaningful blast radius, partial reversibility, and could indirectly affect clinical operations or have regulatory implications if it fails.

**Examples:** Production namespace configuration changes, Kubernetes deployment scaling, ArgoCD sync of a major feature release, secret rotation, network policy changes.

### Critical

**Definition:** The action has significant blast radius, limited reversibility, and has direct implications for clinical operations, PHI, patient safety, or regulatory compliance.

**Examples:** Production database schema migrations, PHI access pattern changes, clinical workflow logic changes, discharge coordination decisions, production secret creation.

### Catastrophic

**Definition:** The action has enterprise-wide or irreversible blast radius, or has direct patient safety implications. Failure could result in patient harm, major regulatory violation, or complete service loss.

**Examples:** Production cluster destruction, PHI breach actions, core EKS control plane changes, clinical decision engine modifications, actions with direct patient medication or care implications.

---

## 3. Risk Dimensions

Risk class is determined by scoring across 7 dimensions. No single dimension is determinative — the combination produces the classification.

### 3.1 Probability

How likely is the action to have an adverse outcome?

| Score | Description |
|---|---|
| 1 — Rare | Well-understood action, extensive track record, minimal failure modes |
| 2 — Unlikely | Understood action, some complexity, limited failure history |
| 3 — Possible | Moderate complexity, some uncertainty, occasional failures expected |
| 4 — Likely | High complexity, significant uncertainty, failure modes known but not rare |
| 5 — Certain | Novel action, high complexity, failure is expected in some form |

### 3.2 Impact

What is the magnitude of harm if the action fails?

| Score | Description |
|---|---|
| 1 — Negligible | No service impact; trivially fixable |
| 2 — Minor | Single component affected; fixable within hours |
| 3 — Moderate | Multiple components or one critical service affected; fixable within a day |
| 4 — Major | Critical services unavailable; clinical operations impacted |
| 5 — Severe | Enterprise-wide impact or patient safety consequence |

### 3.3 Detectability

How quickly would an adverse outcome be detected?

| Score | Description |
|---|---|
| 1 — Immediate | Failure is immediately visible (error returned synchronously) |
| 2 — Fast | Detected within minutes via monitoring |
| 3 — Moderate | Detected within hours via alerting |
| 4 — Slow | May take days to detect |
| 5 — Silent | Could be undetected indefinitely |

### 3.4 Blast Radius

How many systems, agents, or patients are affected if the action fails?

| Score | Description |
|---|---|
| 1 — Isolated | Single agent or component |
| 2 — Bounded | Single office or service |
| 3 — Significant | Multiple services or one clinical domain |
| 4 — Wide | Multiple clinical domains or significant patient population |
| 5 — Enterprise | All services or all patients |

### 3.5 Reversibility

Can the action be undone?

| Score | Description |
|---|---|
| 1 — Fully reversible | Trivially undone with no data loss |
| 2 — Largely reversible | Can be undone with some effort and minimal data loss |
| 3 — Partially reversible | Partial recovery possible; some permanent effect |
| 4 — Mostly irreversible | Limited recovery options; significant permanent effect |
| 5 — Irreversible | Cannot be undone; effects are permanent |

### 3.6 Clinical Impact

Does the action have direct or indirect implications for patient care?

| Score | Description |
|---|---|
| 0 — None | No clinical relevance |
| 2 — Indirect | Could affect clinical workflow tools indirectly |
| 4 — Direct | Directly affects clinical data or workflows |
| 6 — Patient safety | Could directly affect patient safety |

### 3.7 Regulatory Impact

Does the action have HIPAA, SOC2, or other regulatory implications?

| Score | Description |
|---|---|
| 0 — None | No regulatory relevance |
| 2 — Low | Documentation or audit trail implications |
| 4 — Significant | HIPAA or SOC2 control implications |
| 6 — Critical | Potential regulatory violation |

---

## 4. Risk Scoring Matrix

**Base Risk Score:** `(Probability + Impact + Detectability + Blast Radius + Reversibility) / 5`

**Amplified Risk Score:** `Base Score × (1 + (Clinical Impact + Regulatory Impact) / 10)`

| Amplified Score | Risk Class |
|---|---|
| 1.0 – 1.8 | Low |
| 1.9 – 2.8 | Medium |
| 2.9 – 3.8 | High |
| 3.9 – 4.5 | Critical |
| 4.6 – 6.0+ | Catastrophic |

**Note:** Automated scoring is a starting point, not a determination. Any dimension score of 5, any Clinical Impact score ≥ 4, or any Regulatory Impact score of 6 **automatically requires escalation to a human risk reviewer** before the action proceeds, regardless of the composite score.

---

## 5. How Risk Class Affects Governance

| Requirement | Low | Medium | High | Critical | Catastrophic |
|---|---|---|---|---|---|
| Validators required | 0 | 1 | 2 | 2 (both independent) | 3 (all from different offices) |
| Auditors required | 0 | Spot check | 1 (different office) | 1 (different office) | 2 (different offices each) |
| Shadow mode first | No | No | Recommended | Required | Required (min 4 weeks) |
| Rollout strategy | Direct | Direct | Canary or blue-green | Phased with validation gates | Phased with human approval gates |
| Monitoring intensity | Standard | Standard | Elevated (30% more frequent watchdog scans) | High (watchdog + dedicated monitoring) | Continuous (all monitoring planes active) |
| Human oversight | Not required | Not required | Not required | Required for first 30 days after agent activation | Required for every action |
| Pre-action approval | Not required | Not required | Office Manager approval | Office Manager + Executive | Executive + Governance Council |
| Evidence requirements | Minimal | Standard | Full | Full + hash verification | Full + hash + dual verification |
| Decision log | Optional | When applicable | All significant decisions | All decisions | All decisions + contemporaneous attestation |
| Post-action audit | Not required | Not required | Required | Required within 24h | Required immediately post-action |

---

## 6. Risk Classification for Action Types

The following table provides guidance for common action types. These are defaults — specific context may override.

| Action Type | Default Risk Class | Notes |
|---|---|---|
| Read (no PHI) | Low | — |
| Read (PHI) | Medium | Access log required |
| Read (PHI, clinical context) | High | PHI access audit; minimum necessary |
| Write (non-critical config) | Medium | — |
| Write (production config) | High | Validation required |
| Write (PHI) | Critical | Full compliance chain |
| Publish (internal event) | Low | — |
| Publish (patient-facing) | High | Clinical review required |
| Deploy (dev environment) | Low | — |
| Deploy (staging) | Medium | Validation required |
| Deploy (production, non-critical) | High | Full validation + audit |
| Deploy (production, clinical) | Critical | Full chain + compliance |
| Delete (reversible) | Medium | Backup confirmation required |
| Delete (irreversible) | Critical | Multiple approvals + audit |
| Recommend (non-clinical) | Low | — |
| Recommend (clinical, advisory) | High | Clinical safety check |
| Recommend (clinical, decision-driving) | Critical | Clinical authority review |
| Automate (read-only workflow) | Medium | — |
| Automate (write workflow, non-clinical) | High | — |
| Automate (clinical workflow) | Critical | Clinical safety + compliance |
| Secret create | High | Security + Compliance review |
| Secret rotate | High | Validation required |
| Secret delete | Critical | Audit + approval |

---

## 7. Hospital-Specific Risk Amplifiers

In a hospital operations context, the following conditions amplify risk classification by one level. An action that would be High becomes Critical. An action that would be Critical becomes Catastrophic.

| Amplifier | Condition | Effect |
|---|---|---|
| Active patient | Action affects a system serving an actively admitted patient | +1 risk class |
| ICU/emergency context | Action affects ICU or emergency systems | +1 risk class |
| Medication safety | Action could affect medication ordering, dispensing, or administration | +1 risk class (minimum Critical) |
| PHI breach potential | Action creates or increases PHI breach potential | +1 risk class (minimum Critical) |
| Billing fraud potential | Action could enable billing fraud or false claim | +1 risk class (minimum Critical) |
| Regulatory reporting | Action affects data used for regulatory reporting (quality measures, etc.) | +1 risk class |
| Active incident | Action occurs during an active production incident | +1 risk class (all actions) |
| Novel context | Action is being performed in a context not previously encountered | +1 risk class |

Amplifiers stack. An action that has two amplifiers goes up two levels.

---

## 8. Risk Escalation Triggers

The following conditions require immediate escalation regardless of the baseline risk class:

| Trigger | Escalation Target | Timing |
|---|---|---|
| Any dimension score of 5 | Office Manager | Before action |
| Clinical Impact score ≥ 4 | Office Manager + Clinical Office | Before action |
| Regulatory Impact score = 6 | Compliance Office + Executive | Before action |
| Action would create PHI breach potential | Security + Data Governance + Executive | Immediately |
| Action in active patient safety incident | Executive + Human escalation | Immediately |
| Novel action with no precedent | Office Manager + ARB | Before action |
| Catastrophic risk, any trigger | Executive + Governance Council | Immediately |

---

## 9. Risk Register Integration

All High, Critical, and Catastrophic actions are registered in the Velya Risk Register:

```yaml
risk_register_entry:
  entry_id: string
  registered_at: datetime
  registered_by: string
  risk_class: string
  action_description: string
  task_id: string
  agent_id: string
  risk_scores:
    probability: int
    impact: int
    detectability: int
    blast_radius: int
    reversibility: int
    clinical_impact: int
    regulatory_impact: int
    amplifiers: list<string>
  amplified_risk_score: float
  governance_applied:
    validators_assigned: list<string>
    auditors_assigned: list<string>
    human_approval_obtained: bool
    human_approver: string
  current_status: enum [open, mitigated, accepted, closed]
  resolution:
    resolved_at: datetime
    resolution_description: string
    residual_risk: string
```

The Risk Register is reviewed weekly by the Compliance & Audit Office and monthly by the Executive Office. Persistent open risks without mitigation progress escalate to the Governance Council.
