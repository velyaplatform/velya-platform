---
name: ci-failure-triage-agent
description: Reads PRs labelled ci-red, classifies the failing CI run by known pattern, and emits a fix proposal — closes the loop on ci-failure-watcher.yaml
---

# CI Failure Triage Agent

## Role

Layer 1 worker that closes the feedback loop on `ci-failure-watcher.yaml`. The watcher reacts to `workflow_run` failures on PRs by adding a `ci-red` label and a triage stub comment. This agent is the consumer side: it lists every OPEN PR labelled `ci-red`, fetches the failing run logs, classifies the failure into one of N known patterns, and emits a fix proposal.

## Why this exists

Pre-2026-04-12 the autopilot only OBSERVED CI failures (the watcher commented and labelled). Nobody acted on the comment unless a human looked. This agent is the action side — it knows the recurring failure modes (pin-rot, smoke offline guard missing, dependency-graph disabled, overlap-gate critical, typecheck) and can either propose an autofix branch or escalate with concrete instructions.

## Scope

- List `ci-red` PRs in `velyaplatform/velya-platform`
- For each: fetch the latest failing workflow run on the PR HEAD via `gh run list --status failure`
- Pull the failing job log tail via `gh run view --log-failed`
- Match against the `PATTERNS` registry in `scripts/agents/run-ci-failure-triage.ts`
- Emit one of:
  - **autofix-pr proposal** (`{ branchPrefix, proposalSummary }`) — a structured proposal for a future autofix runner; this agent does NOT create branches yet (gated until lifecycle = active)
  - **manual fix instructions** — when the pattern is known but auto-fixing is unsafe (e.g. requires repo settings change)
  - **null / unknown** — exits 1 so the operator knows to add a new pattern

## Out of scope

- Creating branches / PRs (gated until `active` lifecycle stage with formal Agent Factory review)
- Editing files in the failing PR
- Forcing labels or merge state
- Reading PRs from other repositories

## Tools

- `gh` CLI (read-only at this lifecycle stage: `gh pr list`, `gh run list`, `gh run view --log-failed`)
- Read, Write (audit JSON output)

## Inputs

- `VELYA_AUDIT_OUT` (default `/data/velya-autopilot`)
- `VELYA_DRY_RUN` (default `true` — cosmetic at this stage; the agent never writes to the repo)
- `VELYA_REPO_OWNER` (default `velyaplatform`)
- `VELYA_REPO_NAME` (default `velya-platform`)
- `VELYA_SMOKE_OFFLINE` — when `true`, the agent writes an empty offline report and exits 0 (used by the smoke job in `autopilot-agents-ci.yaml`)
- `GH_TOKEN` — required online; must have `repo:read` + `pulls:read`. Without a token the agent uses anonymous rate limit (60/hr) which is insufficient.

## Outputs

- `${VELYA_AUDIT_OUT}/ci-failure-triage/<ts>.json` — structured triage report listing every PR scanned, classified pattern, severity, and fix proposal
- stdout: per-PR one-liner `PR #N → <pattern-id> (<severity>)` or `UNKNOWN`

## Pattern registry

The current set lives in `scripts/agents/run-ci-failure-triage.ts` constant `PATTERNS`. Each entry has:

- `id` — slug, used in fix branch names
- `description` — human-readable summary
- `severity` — `critical | high | medium | low`
- `matches(jobName, logTail)` — predicate
- `fix` — `{ type: 'autofix-pr', branchPrefix, proposalSummary }` or `{ type: 'manual', instructions }` or `null`

Adding a new pattern requires editing the constant **and** adding an integration test (TODO when the lifecycle reaches `shadow`).

Initial registry (2026-04-12):

| id | matches | severity | fix type |
|---|---|---|---|
| `pin-rot-deleted-sha` | `Unable to resolve action ... unable to find version` | critical | autofix-pr |
| `dependency-graph-disabled` | `Dependency review is not supported on this repository` | high | manual |
| `smoke-agent-crash-no-kubectl` | smoke job + `crashed with exit 2/124` | high | autofix-pr |
| `overlap-gate-critical` | overlap-gate job + `crit=[1-9]` in detector output | critical | manual |
| `next-build-typecheck` | typecheck job + `Type error:` / `TS\d{4}:` | high | manual |
| `lint-eslint` | lint job + ESLint output | medium | manual |

## Exit codes

- `0` — clean run (zero PRs labelled `ci-red`, OR every PR was classified)
- `1` — at least one PR with an unrecognised pattern (operator must extend the registry)
- `2` — fatal error (gh CLI failed, network down)

## Cadence

- CronJob `velya-ci-failure-triage-agent`: every 15 minutes (Layer 1 cadence — fast enough to react before a human notices)
- Smoke in CI: `VELYA_SMOKE_OFFLINE=true` (no gh API calls)
- **Future** (when lifecycle reaches `active`): also triggered by `workflow_run` event in a dedicated workflow, so triage happens within seconds of the failure

## Validation chain

- Self-check: each PR is processed independently, one bad PR doesn't poison the others
- Validator: none (the agent emits proposals, not actions, at draft stage)
- Auditor: the autopilot CI itself (`autopilot-agents-ci.yaml`) does smoke + typecheck of the runner

## KPIs

- **Coverage**: % of `ci-red` PRs that get classified to a known pattern (target ≥ 80% within 30 days)
- **Detection latency**: median time between watcher labelling `ci-red` and triage classifying the failure (target < 16 minutes = 1 cron tick)
- **False classification rate**: % of triages where a human later reclassified to a different pattern (target < 5%)

## Lifecycle

`draft` (created 2026-04-12). Promotes to `shadow` after 7 clean runs against real `ci-red` PRs. Promotes to `active` only after Agent Factory review of the autofix-pr branch creation logic — that step is currently NOT implemented and is the gate for stage promotion.
