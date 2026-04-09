# Run Red Team Review

Use this skill to conduct a red team adversarial review of a Velya component, design, or implementation.

## When to use

- Before any component enters staging or production
- After any significant architectural change
- When adding a new agent or office
- When a new AI capability is introduced
- When a clinical workflow is modified
- Quarterly for the full platform

## How to invoke

```
/run-red-team [target: component|design|agent|workflow|platform] [scope: brief|standard|deep]
```

## Steps

### 1. Scope the target

Identify what is being red-teamed:

- What is it? (component, agent, workflow, system)
- What does it do?
- What can go wrong?
- What assumptions is it making?

### 2. Threat enumeration

For each trust boundary and data flow, enumerate threats using STRIDE:

- **S**poofing: Who could impersonate a legitimate actor?
- **T**ampering: What data could be corrupted?
- **R**epudiation: What actions could be denied?
- **I**nformation Disclosure: What data could leak?
- **D**enial of Service: What could be starved or overloaded?
- **E**levation of Privilege: What could gain unauthorized capabilities?

For AI components, also apply OWASP LLM Top 10.
For agent components, also apply: collusion, validator capture, scorecard gaming, excessive agency.

### 3. Assumption challenge

List every assumption the component makes. For each:

- Is this assumption validated or just assumed?
- What is the risk if it's wrong?
- What is the fallback?

Check against `docs/risk/assumption-log.md` for known assumptions.

### 4. Silent failure scan

Identify every way this component could fail without generating an alert.
For each silent failure mode: how would we know? What detective control is needed?

### 5. Anti-goal drift check

Check against `docs/architecture/anti-goals.md`.
Does this component show warning signs of any anti-goal?

### 6. Adversarial test cases

Define at least 3 adversarial test cases per risk surface.
High-value tests:

- Provide malicious input and observe output
- Attempt action beyond agent scope
- Inject adversarial content via indirect path
- Attempt to bypass validator/auditor
- Simulate partial failure of dependency

### 7. Document findings

All findings go in:

- `docs/validation/adversarial-test-plan.md` (test cases)
- `docs/risk/silent-failure-matrix.md` (silent failures)
- `docs/risk/master-gap-register.md` (gaps found)
- `docs/risk/assumption-log.md` (new assumptions discovered)

### 8. Severity classification

For each finding, classify using:

- Severity: Low / Medium / High / Critical / Catastrophic
- Exploitability: Theoretical / Difficult / Moderate / Easy / Trivial
- Blast Radius: Contained / Service / Namespace / Platform / Clinical / Systemic
- Detectability: Automatic / Manual / Unlikely / Invisible

### 9. Block or pass

- Any CRITICAL or Catastrophic finding with no mitigation → **BLOCK** (do not allow production)
- Any finding that is a patient safety risk → **BLOCK** regardless of severity rating
- High findings with mitigations → **CONDITIONAL PASS** with tracked remediation
- Medium/Low findings → **PASS** with backlog entry

## Output format

```markdown
## Red Team Report: [Target Name]

**Date**: YYYY-MM-DD
**Scope**: [brief|standard|deep]
**Reviewer**: [agent name]
**Overall verdict**: PASS | CONDITIONAL PASS | BLOCK

### Executive Summary

[2-3 sentences]

### Critical Findings

| ID  | Finding | Severity | Evidence | Mitigation |
| --- | ------- | -------- | -------- | ---------- |

### High Findings

| ID  | Finding | Severity | Evidence | Mitigation |
| --- | ------- | -------- | -------- | ---------- |

### Silent Failure Modes

[List with detection mechanisms]

### Invalidated Assumptions

[List with impact]

### Anti-Goal Warning Signs

[List if any]

### Adversarial Test Results

[Results for each test case]

### Verdict Rationale

[Why PASS / CONDITIONAL PASS / BLOCK]

### Required Actions Before Production

[If BLOCK or CONDITIONAL PASS]
```
