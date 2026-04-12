---
name: scorecard-publisher-agent
description: Compiles per-agent scorecards from audit findings on the PVC; the P0 blocker that every governance loop in ADR-0017 depends on
---

# Scorecard Publisher Agent

## Role

Layer 1 worker that turns raw audit JSONs from every other agent into structured scorecards keyed by agent. Without this scorecard, the lifecycle-promotion-agent and the validator-of-validators are blind — every other governance loop in ADR-0017 depends on this one running first.

## Why this exists

Identified as the **P0 blocker** by the gap-analysis subagent (`G-GOV-3`) on 2026-04-12: `.claude/rules/agent-governance.md` defines Green/Yellow/Red/Critical thresholds for validation pass rate, audit pass rate, evidence completeness, SLA adherence and correction recurrence — but until this commit, *nothing emitted the numbers*. Promotion thresholds were aspirational and lifecycle was 100% manual. This agent makes them real.

## Scope

Per run, the agent:

1. Walks `${VELYA_AUDIT_OUT}/<agent>-audit/<ts>.json` on the shared PVC `velya-autopilot-data` via the new `scripts/agents/shared/findings-store.ts` helper.
2. Groups findings by source agent.
3. Computes the five canonical metrics from `.claude/rules/agent-governance.md §Scorecard Thresholds`:
   - **validationPassRate** — clean reports / total reports
   - **auditPassRate** — approved by auditor / total (today: same as validation, until validator-of-validators lands)
   - **evidenceCompleteness** — records with all required fields / total
   - **slaAdherence** — on-time runs / expected runs (today: presence in window)
   - **correctionRecurrence** — same finding-id repeated / total
   plus three placeholder metrics that future agents will populate:
   - **costPerDecisionUsd** (cost-budget-watcher in PR-E)
   - **latencyP95Ms** (derived from runDurationMs once agents emit it)
   - **driftFromShadow** (shadow-runner harness in PR-future)
4. Buckets each metric into Green / Yellow / Red / Critical per the thresholds table.
5. Writes per-agent JSON files at `${VELYA_AUDIT_OUT}/scorecards/<agent>.json` and a roll-up at `${VELYA_AUDIT_OUT}/scorecards/latest.json`.
6. Exits 1 if any agent is in Red or Critical on any metric (signals lifecycle-promotion-agent + quarantine-enforcer to look).

## Out of scope

- Promoting or demoting agents — that's `lifecycle-promotion-agent` (PR-H).
- Quarantining agents — that's `quarantine-enforcer-agent` (future).
- Touching the cluster, the repo, or any external API.
- Computing cost or latency from external sources (those land via cost-budget-watcher in PR-E).

## Tools

- Read access to the `velya-autopilot-data` PVC (mount path `${VELYA_AUDIT_OUT}`)
- Write access ONLY to the agent's own audit subdir + the `scorecards/` subdir on the same PVC
- The shared libs: `offline-guard.ts`, `findings-store.ts`, `killswitch.ts`

No `kubectl`, no `gh`, no `curl`. Pure file I/O.

## Inputs

- `VELYA_AUDIT_OUT` (default `/data/velya-autopilot`)
- `VELYA_SCORECARD_WINDOW_HOURS` (default `168` — 7 days; matches the weekly review cadence in `agent-governance.md`)
- `VELYA_SMOKE_OFFLINE` — when true, writes an empty offline report and exits 0
- `VELYA_KILLSWITCH_PATH` — overrides `/var/run/velya-autopilot/killswitch.yaml` (test only)

## Outputs

- `${VELYA_AUDIT_OUT}/scorecard-publisher-audit/<ts>.json` — full report of one run
- `${VELYA_AUDIT_OUT}/scorecards/latest.json` — roll-up across all agents (consumed by lifecycle-promotion-agent in PR-H)
- `${VELYA_AUDIT_OUT}/scorecards/<agent>.json` — per-agent latest scorecard (consumed by validator-of-validators)

## Threshold table

Mirror of `.claude/rules/agent-governance.md §Scorecard Thresholds`, encoded in `run-scorecard-publisher.ts`:

| metric | green | yellow | red | critical |
|---|---|---|---|---|
| validationPassRate | ≥0.90 | 0.75–0.90 | 0.60–0.75 | <0.60 |
| auditPassRate | ≥0.90 | 0.80–0.90 | 0.65–0.80 | <0.65 |
| evidenceCompleteness | ≥0.95 | 0.85–0.95 | 0.70–0.85 | <0.70 |
| slaAdherence | ≥0.90 | 0.75–0.90 | 0.60–0.75 | <0.60 |
| correctionRecurrence | ≤0.10 | 0.10–0.25 | 0.25–0.40 | >0.40 |

When the source rule changes the thresholds, this agent and the rule must be updated together.

## Exit codes

- `0` — every agent meets at least Yellow on every metric
- `1` — at least one agent is in Red or Critical on at least one metric (signals lifecycle to investigate)
- `2` — fatal
- `4` — kill switch engaged (handled by `killswitch.ts`)

## Cadence

- CronJob `velya-scorecard-publisher-agent`: every 4 hours (`0 */4 * * *`). Fast enough to catch a rapidly-degrading agent before the 24-hour quarantine watchdog kicks in (`agent-governance.md §Watchdog Requirements`).
- Smoke in CI: `VELYA_SMOKE_OFFLINE=true` (no PVC, empty offline report)

## Validation chain

- Self-check: each metric is computed independently; one bad agent's findings can't poison another's score.
- Validator: the **validator-of-validators-agent** (PR-future) will re-run a 10% random sample of every scorecard's input findings and compare. Today: none.
- Auditor: the autopilot CI (`autopilot-agents-ci.yaml`) does typecheck + offline smoke of the runner.

## KPIs (self-applied)

- **Coverage**: % of agents in `.claude/agents/` that show up in the latest scorecard (target: 100% of agents with at least one CronJob)
- **Latency**: median time from a new agent emitting its first audit JSON to the next scorecard run picking it up (target: < 4 h = one cron tick)
- **Stability**: % of scorecards where the worst bucket changed by ≥2 levels between consecutive runs (target: < 5% — high churn means thresholds need calibration)

## Lifecycle

`draft` (created 2026-04-12). Promotes to `shadow` after 7 clean runs against real audit data. Promotes to `active` after 14 days in shadow + first lifecycle-promotion-agent reads its output successfully (PR-H dependency).

## Why it must run first

ADR-0017 §Self-improvement and governance loops makes this explicit: lifecycle-promotion-agent reads scorecards from `${VELYA_AUDIT_OUT}/scorecards/`. Without scorecards, no automated promotion. Without automated promotion, no lifecycle. Without lifecycle, governance is documentation theatre. The whole 9-PR roadmap from the A8 delivery roadmap depends on this one runner shipping first.
