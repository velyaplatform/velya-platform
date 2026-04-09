# Red Team & Blind Spot Discovery Rules

## Mandatory Adversarial Review

Every significant architectural decision, agent design, or clinical workflow implementation
must undergo adversarial review before entering active stage.

Adversarial review is NOT optional. It is a gate in the delivery pipeline.

## Red Team Office Authority

The Red Team & Blind Spot Discovery Office has authority to:
- Block any component from entering production if critical blind spots are unresolved
- Open formal blockers that require executive agent sign-off to close
- Require additional shadow mode time for any agent
- Mandate additional testing for any risk surface
- Escalate directly to human review without going through normal hierarchy

The Red Team Office reports to the Governance Council, not to any operational office.
This independence is non-negotiable.

## Assumption Challenge Requirement

Every design document, agent contract, and architecture decision must include
an explicit assumption log section. See `docs/risk/assumption-log.md` for format.

Assumptions that are not validated are treated as **active risks**.

If an assumption cannot be validated within the sprint, it must be:
1. Documented in `docs/risk/assumption-log.md` with status "Assumed"
2. Have a defined validation method and deadline
3. Have a documented fallback if the assumption is wrong

## Blind Spot Discovery Cadence

| Activity | Frequency | Owner |
|---|---|---|
| Micro red team review (per component) | Per PR for critical components | Red Team Manager Agent |
| Office-level blind spot scan | Weekly | Blind Spot Discovery Coordinator |
| Platform-wide adversarial exercise | Monthly | Red Team Manager Agent |
| Clinical safety gap review | Monthly | Clinical Safety Gap Hunter |
| AI behavior adversarial test | Bi-weekly | Adversarial Behavior Analyst |
| Unknown-unknown discovery session | Quarterly | Full Red Team Office |

## Silent Failure Detection

Every system component must be audited for silent failure modes.
A silent failure is a failure that:
- Does not generate an alert
- Does not appear in dashboards
- Does not interrupt the workflow
- But causes incorrect or harmful outcomes

Silent failure modes must be documented in `docs/risk/silent-failure-matrix.md`.
Every silent failure mode must have a detection mechanism added.

## Adversarial Test Requirements

Before any component enters production:
- Prompt injection tests must be executed (if AI is involved)
- Tool abuse tests must be executed (if tools/MCP are involved)
- Excessive agency tests must be executed (if agent has write permissions)
- Governance bypass tests must be executed (for validators and auditors)
- Silent failure injection tests must be executed

Test results go in `docs/validation/adversarial-test-plan.md`.
No component enters production with unresolved CRITICAL adversarial test failures.

## Anti-Goal Enforcement

The Red Team Office enforces the anti-goals defined in `docs/architecture/anti-goals.md`.
If a component, feature, or process shows warning signs of drifting toward an anti-goal,
the Red Team Office opens a formal blocker.

Warning signs are checked during every red team review.

## Prohibited Assumptions

The following can NEVER be assumed without explicit proof:
- A component is secure because it has a security policy
- An agent is safe because it passed shadow mode once
- A clinical workflow is safe because it worked in testing
- A system is resilient because it has replicas
- A process has governance because there is an office for it
- An agent has accountability because there is a validator assigned
- Costs are controlled because there are budget limits

Any of these assumptions found unchallenged is itself a red team finding.
