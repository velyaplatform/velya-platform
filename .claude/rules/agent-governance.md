# Agent Governance Rules

## Core Principle: No Agent Without Accountability

Every agent in the Velya enterprise must have:

- A defined role contract (see `docs/agents/agent-runtime-contracts.md`)
- An assigned validator (cannot validate own work as final authority)
- An assigned auditor (independent of the validator)
- A watchdog that can observe it
- A scorecard with defined thresholds
- A lifecycle stage (draft → shadow → active → deprecated → retired)

**No agent may enter active stage without completing shadow mode.**

## Lifecycle Requirements

| Stage      | Minimum Duration                                     | Required Before Advancing                  |
| ---------- | ---------------------------------------------------- | ------------------------------------------ |
| draft      | None                                                 | RFC reviewed, contract defined             |
| sandbox    | 1 week                                               | All unit tests pass                        |
| shadow     | 2 weeks (non-clinical), 4 weeks (clinical/financial) | Shadow comparison meets accuracy threshold |
| probation  | 30 days                                              | Mandatory human review of all outputs      |
| active     | Indefinite                                           | Scorecard maintained above threshold       |
| deprecated | 30 days minimum                                      | Replacement active, knowledge transferred  |

## Validation Chain

Validation must follow this chain — no shortcuts:

```
execution → self-check → validator (independent) → auditor → acceptance
```

For **critical risk** tasks (clinical data, production infrastructure, billing):

```
execution → self-check → validator-1 → validator-2 → auditor → manager acceptance
```

Forbidden:

- Agent validates its own output as the sole authority
- Validator approves without reading evidence
- Auditor skips evidence review
- Manager accepts without validator confirmation

## Watchdog Requirements

Every office must have at least one watchdog monitoring it.
Watchdogs must detect and alert within these SLAs:

| Anomaly                              | Detection SLA                       |
| ------------------------------------ | ----------------------------------- |
| Agent silent (no output)             | 30 min → warning; 60 min → incident |
| Agent in correction loop > 3 cycles  | Immediate incident                  |
| Office backlog growing > 2x baseline | 1 hour → warning                    |
| Scorecard below red threshold        | 24 hours → probation trigger        |
| Validator not responding             | 15 min → escalation                 |
| Evidence missing for critical task   | Immediate block                     |

## Quarantine Policy

Quarantine is triggered automatically when:

- Score below 50% for 2 consecutive review cycles
- 3+ validation rejections in a 7-day window
- Evidence missing on a critical task
- Behavior outside defined scope detected
- Security policy violation

During quarantine:

- All write permissions suspended
- Active tasks redirected
- Investigation required before exit
- Human approval required to re-activate

## Kill Switch Requirements

Every automated process that can affect:

- Clinical data
- Production infrastructure
- Patient-facing systems
- Billing or financial data
- Public communications

...must have an explicit, documented, testable kill switch.

Kill switch documentation lives in `docs/operations/kill-switch-matrix.md`.

## Scorecard Thresholds

| Metric                | Green | Yellow | Red    | Critical |
| --------------------- | ----- | ------ | ------ | -------- |
| Validation pass rate  | >90%  | 75-90% | 60-75% | <60%     |
| Audit pass rate       | >90%  | 80-90% | 65-80% | <65%     |
| Evidence completeness | >95%  | 85-95% | 70-85% | <70%     |
| SLA adherence         | >90%  | 75-90% | 60-75% | <60%     |
| Correction recurrence | <10%  | 10-25% | 25-40% | >40%     |

Red in any metric → probation review.
Critical in any metric → immediate quarantine.

## Naming Enforcement

Agent names must follow the `{office}-{role}-agent` pattern.
All 18 current agents that do not have `-agent` suffix must be renamed before they enter active stage.

## Office Requirements

Every office must have:

- A written charter (in `docs/agents/`)
- A Manager Agent
- At least one Validator Agent
- At least one Auditor Agent
- A Watchdog assigned (may be shared across offices)
- Weekly scorecard
- Defined SLAs for all outputs

An office without throughput for >1 week triggers a watchdog incident.

## Prohibited Behaviors

- Agent creating other agents without Agent Factory approval
- Agent modifying its own permissions or scope
- Agent acting on clinical data without human review (during shadow/probation)
- Agent approving its own PRs or outputs
- Agent accessing PHI beyond its defined data scope
- Agent communicating results without generating an evidence log entry
- Agent silently failing (all failures must be logged and escalated)
- Coordinator delegating to quarantined agent
- Validator approving without documented evidence review
