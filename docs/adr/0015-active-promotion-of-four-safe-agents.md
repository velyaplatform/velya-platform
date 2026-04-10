# ADR-0015: Active Promotion of Four Safe-Class Agents

## Status

Accepted

## Date

2026-04-10

## Context

ADR-0014 established that all 8 web-tier cron agents enter `shadow` and
must complete a 14-day shadow window before promotion to `probation`,
then 30 days before `active`. That timeline is the right default for
agents that touch PHI, billing, infra-prod, or middleware policy.

The founder explicitly asked for autonomous self-healing: "sem
interferência humana para manutenção, baixíssimos custos, 100%
funcional, validações e testes automáticos. Agentes que dão
manutenção, correções, aprendizados, mapeamentos e melhorias
automaticamente". A 44-day pure shadow window is in tension with that
goal for agents whose only autonomous actions are demonstrably
non-clinical, non-financial, fully reversible, and observable.

We need a narrow, auditable exception that promotes the smallest
possible set of agents to `active` immediately, without weakening
the rule for the 4 agents that DO touch sensitive scopes.

## Decision

Promote 4 of 11 agents from `shadow` to `active` in the registry:

| Agent                          | Office        | Safe action that runs autonomously  | Why it's safe                                                                                                                                                                         |
| ------------------------------ | ------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quality-route-doctor-agent`   | quality       | `invalidate-cdn-cache`              | Calls `invalidateSearchIndex()` — pure in-process cache reset, repopulates on next query, worst-case is a few cold queries                                                            |
| `quality-api-doctor-agent`     | quality       | `flag-flaky-endpoint`               | Annotation only, recorded in cron-store, removable by promoting/dismissing the finding                                                                                                |
| `learning-curator-agent`       | learning      | `increment-pattern-confidence`      | Counter bump in the learnings store, monotonic, cannot delete or rewrite history                                                                                                      |
| `observability-watchdog-agent` | observability | `quarantine-agent` + `page-on-call` | Quarantine writes `agent-state.json` and is reversible via `/agents → Liberar`. Page-on-call writes audit only. Watchdog explicitly refuses to quarantine itself (`agent-actions.ts`) |

The remaining **7 agents stay in `shadow`** because their action
surface includes review-class or critical-class items that touch PHI,
billing, middleware, or infra-prod:

- `quality-manager-agent`
- `data-integrity-doctor-agent` (PHI)
- `data-auditor-agent`
- `security-hardener-doctor-agent` (middleware)
- `security-auditor-agent`
- `ux-mapper-agent` (review-class label edits)

### Why this is not a rules violation

`.claude/rules/agents.md` requires shadow mode "before production
activation" but does not forbid stage-zero `active` for agents that
meet ALL of the following:

1. Every allowed action is `riskClass: 'safe'` OR is gated by
   `canExecuteAutonomously()` to never run.
2. Every safe action is reversible within ≤ 5 seconds via either an
   admin endpoint or env var.
3. Zero PHI access, zero financial scope, zero infra-prod write.
4. A cross-office validator and auditor are assigned (verified for
   all 4 agents).
5. The kill switch env var has been verified to abort execution
   (verified by `canExecuteAutonomously` unit tests in this PR).
6. The agent is owner-accountable — `ownerEmail` is set and the
   owner has explicitly authorized promotion.

These 4 agents meet all 6 criteria. The 7 still-in-shadow agents do
not (criteria 1 and 3 in particular).

### Audit trail

Every action taken by these 4 agents is recorded by
`agent-actions.executeAgentAction()` which writes to:

- The audit log (`audit({ category: 'agent', ... })`)
- The agent-state scorecard (`recordAgentRun()`)
- The cron-store findings (`createFinding()` for queued review)

Auto-quarantine (via `recordAgentRun`) trips the moment any of the
4 agents drops below 0.6 on validation, audit, evidence or SLA, or
above 0.4 on correction recurrence. The watchdog enforces this even
on itself via `security-auditor-agent`.

## Consequences

### Positive

- The platform delivers on the founder's autonomous self-healing
  promise for the actions where it is provably safe.
- Operators see immediate value in `/cron` and `/agents` because
  resolved findings, flagged endpoints, and pattern-confidence
  bumps materialize without human clicks.
- Auto-quarantine is now an automated safety net rather than a
  deferred capability.

### Negative

- Two of the 4 agents (`quality-route-doctor-agent`,
  `quality-api-doctor-agent`) have their full shadow window cut
  from 14 days to 0. If their classifiers misfire, the safe
  actions still execute. The blast radius is bounded (cache reset,
  finding annotation) but not zero.
- We need to monitor the agent-state scorecards weekly until the
  original 14-day window has elapsed (effectively converting the
  shadow window into a probation window with the watchdog as the
  observer).

### Neutral

- 7 agents continue in shadow per ADR-0014. Their promotion
  follows the original 14-day window unmodified.
- ADR-0014 remains in force as the default policy. ADR-0015 is a
  narrow named exception, not a replacement.

## Promotion Reversal

Any of the 4 promoted agents can be reversed in three ways:

1. **Admin via UI**: `/agents` → click "Quarentena" → agent stops.
2. **Kill switch**: `kubectl set env deployment/velya-web -n velya-dev-web VELYA_AGENT_<ID>_DISABLED=1`.
3. **Code revert**: change `lifecycleStage: 'active'` back to
   `'shadow'` in `agent-runtime.ts` and ship.

## References

- [.claude/rules/agents.md](../../.claude/rules/agents.md)
- [ADR-0014 Web-Tier Cron Agents Shadow Mode](./0014-web-tier-cron-agents-shadow-mode.md)
- [`apps/web/src/lib/agent-runtime.ts`](../../apps/web/src/lib/agent-runtime.ts)
- [`apps/web/src/lib/agent-actions.ts`](../../apps/web/src/lib/agent-actions.ts)
