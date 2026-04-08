# Decision Rights Matrix

> This document defines who can make what decisions within the Velya multi-agent enterprise. Decisions are categorized by risk level, and each category specifies the approval authority, escalation path, and documentation requirements.

---

## Principles

1. **Decisions should be made at the lowest level that has sufficient context and authority.** Over-escalation is as harmful as under-escalation.
2. **Risk determines the approval level.** Higher risk requires higher authority.
3. **All decisions are logged.** Even autonomous decisions are recorded for audit.
4. **Reversibility matters.** Easily reversible decisions can be made at lower levels than irreversible ones.

---

## Risk Levels

| Level | Label           | Description                                                                | Examples                                                                                                     |
| ----- | --------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| R0    | **Negligible**  | No meaningful impact if wrong. Easily and instantly reversible.            | Code formatting, documentation typo fixes, adding a log line                                                 |
| R1    | **Low**         | Minor impact if wrong. Reversible within minutes.                          | Adding a non-breaking field to an API, adding a new test, updating a dependency patch version                |
| R2    | **Moderate**    | Noticeable impact if wrong. Reversible within hours.                       | New API endpoint, new database table, new feature flag, CI pipeline change                                   |
| R3    | **High**        | Significant impact if wrong. Reversible within a day with effort.          | Database migration (schema change), new service deployment, IAM policy change, breaking API change           |
| R4    | **Critical**    | Major impact if wrong. Difficult to reverse or irreversible.               | Production data deletion, infrastructure provider change, security model change, compliance-affecting change |
| R5    | **Existential** | Threatens platform viability. Irreversible or extremely costly to reverse. | Architecture paradigm shift, major vendor change, PHI exposure, regulatory violation                         |

---

## Autonomy Matrix

This matrix maps decision types to the minimum approval authority required based on risk level.

### Code Changes

| Decision                                  | Risk | Approver                                 | Gate                   |
| ----------------------------------------- | ---- | ---------------------------------------- | ---------------------- |
| Fix a typo in code or docs                | R0   | Specialist agent                         | Automated CI           |
| Add or update unit tests                  | R0   | Specialist agent                         | Automated CI           |
| Refactor without behavior change          | R1   | Specialist agent + 1 peer review         | PR review              |
| Add a new internal function               | R1   | Specialist agent + 1 peer review         | PR review              |
| Add a new API endpoint                    | R2   | Coordinator + architecture review        | PR review + design doc |
| Change a public API contract              | R3   | Executive Director + architecture review | ADR + migration plan   |
| Change authentication/authorization logic | R4   | Executive Director + Security Office     | ADR + security review  |

### Infrastructure Changes

| Decision                                        | Risk | Approver                                   | Gate                        |
| ----------------------------------------------- | ---- | ------------------------------------------ | --------------------------- |
| Update non-prod Helm values                     | R1   | DevOps Coordinator                         | PR review                   |
| Add a new non-prod environment variable         | R1   | DevOps Coordinator                         | PR review                   |
| Update production Helm values                   | R2   | DevOps Coordinator + SRE review            | PR review + change ticket   |
| Create a new Kubernetes namespace               | R2   | DevOps Coordinator                         | PR review                   |
| Modify IAM policies                             | R3   | Identity & Access Office + Security Office | PR review + access review   |
| Create or modify OpenTofu modules               | R3   | DevOps Coordinator + architecture review   | PR review + plan review     |
| Change cloud provider services                  | R4   | Chief Technology Director                  | ADR + migration plan        |
| Modify network security groups / firewall rules | R4   | Security Office + DevOps                   | PR review + security review |

### Database Changes

| Decision                                    | Risk | Approver                                  | Gate                         |
| ------------------------------------------- | ---- | ----------------------------------------- | ---------------------------- |
| Add a new index                             | R1   | Backend Coordinator                       | PR review + performance test |
| Add a nullable column                       | R2   | Backend Coordinator                       | PR review + migration review |
| Add a non-nullable column                   | R3   | Backend Coordinator + architecture review | PR review + migration plan   |
| Drop a column or table                      | R4   | Executive Director + data review          | ADR + backup verification    |
| Change primary key or partitioning strategy | R4   | Chief Technology Director                 | ADR + migration plan         |

### Agent Decisions

| Decision                              | Risk | Approver                              | Gate                           |
| ------------------------------------- | ---- | ------------------------------------- | ------------------------------ |
| Create a new Specialist agent         | R2   | Office Coordinator + Agent Governance | RFC                            |
| Promote agent autonomy (L1 to L2)     | R2   | Office Coordinator + Agent Governance | Review report                  |
| Promote agent autonomy (L2 to L3)     | R3   | Executive Director + Agent Governance | Review report + 30-day metrics |
| Promote agent autonomy (L3 to L4)     | R4   | Governance Council                    | Review report + 90-day metrics |
| Promote agent autonomy (L4 to L5)     | R5   | Governance Council (unanimous)        | Review report + external audit |
| Retire an agent                       | R2   | Office Coordinator + Agent Governance | Migration plan                 |
| Create a new Coordinator agent        | R3   | Executive Director + Agent Governance | RFC + design review            |
| Create a new Executive Director agent | R5   | Governance Council                    | RFC + org review               |

### Security Decisions

| Decision                        | Risk | Approver                                   | Gate                            |
| ------------------------------- | ---- | ------------------------------------------ | ------------------------------- |
| Add a new dependency            | R1   | Specialist + automated scan                | CI security scan                |
| Update dependency major version | R2   | Coordinator + security scan                | PR review + vulnerability check |
| Add a new secret                | R2   | Coordinator + Identity & Access Office     | PR review                       |
| Change encryption configuration | R4   | Chief Security Director                    | ADR + security review           |
| Grant production data access    | R4   | Chief Security Director + Compliance       | Access request + justification  |
| Respond to a security incident  | R4   | Chief Security Director (immediate action) | Incident report + post-mortem   |

### Product Decisions

| Decision                                | Risk | Approver                                    | Gate                 |
| --------------------------------------- | ---- | ------------------------------------------- | -------------------- |
| Modify UI text or microcopy             | R0   | Design Office Specialist                    | PR review            |
| Add a new feature behind a flag         | R1   | Product Coordinator                         | PR review            |
| Enable a feature flag for 10% of users  | R2   | Product Coordinator + QA sign-off           | Rollout plan         |
| Enable a feature flag for 100% of users | R3   | Product Director + QA sign-off              | Full test pass       |
| Remove a feature                        | R3   | Product Director + stakeholder notification | ADR + migration plan |
| Change a core workflow                  | R4   | Chief Product Director + Governance Council | ADR + user research  |

---

## Escalation Paths

When a decision exceeds an agent's authority, it must escalate:

```
Specialist --> Coordinator --> Executive Director --> Governance Council
```

**Escalation rules**:

1. Escalate immediately for anything above your risk level authorization.
2. Escalate if you are uncertain about the risk level of a decision.
3. Escalate if the decision affects another office's domain.
4. Escalate if two agents disagree on a course of action.

**Escalation SLAs**:
| Escalation Level | Response Time |
|---|---|
| Coordinator | 1 hour |
| Executive Director | 4 hours |
| Governance Council | 24 hours |
| Emergency (security incident) | 15 minutes |

---

## Cross-Office Decisions

When a decision affects multiple offices, the following rules apply:

1. **Initiating office** drafts the proposal.
2. **Affected offices** are notified and given a review period (24 hours for R2, 48 hours for R3, 1 week for R4+).
3. **Disagreements** are escalated to the Executive Directors of the involved offices.
4. **Persistent disagreements** are escalated to the Chief Coordinator or Governance Council.
5. **All cross-office decisions** are documented as ADRs.

---

## Audit Trail

Every decision, regardless of risk level, produces an audit record containing:

- **Decision ID**: Unique identifier
- **Timestamp**: When the decision was made
- **Decision maker**: Agent or human who made the decision
- **Risk level**: Assessed risk level
- **Decision type**: Category from the matrix above
- **Description**: What was decided
- **Rationale**: Why this decision was made
- **Approvers**: Who approved (if escalated)
- **Reversibility**: How to reverse the decision if needed
- **Outcome**: Result of the decision (populated after the fact)

Audit records are stored in the event bus as `velya.governance.decision.made` events and retained for 7 years per compliance requirements.
