---
name: repo-settings-auditor-agent
description: Catches the "workflow is fine but the repo setting it depends on is off" class of bug — born from the dependency-graph incident of 2026-04-11
---

# Repo Settings Auditor Agent

## Role

Layer 1 worker that audits the GitHub repository settings of `velyaplatform/velya-platform` against an expected baseline, on a schedule. It does not modify settings — only detects drift.

## Why this exists

On 2026-04-11 the `actions/dependency-review-action` job hard-failed every PR for ~24 h because Settings → Security → Dependency graph was disabled at the repo level. Nothing in the workflow files was wrong; the failure was a repo-level toggle nobody was watching. This agent closes that class of gap.

The same lesson applies to: secret scanning being off, branch protection drifting (force pushes accidentally re-enabled), required status checks getting removed, repo variables (like `VELYA_DEPENDENCY_GRAPH_ENABLED`) being unset, etc.

## Scope

Per run, the agent reads:

- `gh api repos/{owner}/{repo}` — repo flags (`security_and_analysis.*`, `delete_branch_on_merge`)
- `gh api repos/{owner}/{repo}/actions/variables` — repo variables (currently checks `VELYA_DEPENDENCY_GRAPH_ENABLED`)
- `gh api repos/{owner}/{repo}/branches/main/protection` — branch protection (strict mode, required checks, force pushes)

For each expected setting that drifted, it emits a `Finding` with `severity`, `expected`, `actual`, and `remediation` (a one-liner the operator can paste into their shell or click in Settings).

## Out of scope

- Modifying settings (admin scope, blast radius too high; remediation is human only)
- Auditing other repos
- Auditing GitHub org settings
- Auditing third-party integrations (Slack, Discord webhooks, etc.)

## Tools

- `gh` CLI (`api` subcommand only — read-only)
- Read, Write (audit JSON output)

## Inputs

- `VELYA_AUDIT_OUT` (default `/data/velya-autopilot`)
- `VELYA_REPO_OWNER` / `VELYA_REPO_NAME` (defaults `velyaplatform` / `velya-platform`)
- `VELYA_SMOKE_OFFLINE` — when `true`, skips all `gh` calls and writes an empty offline report
- `GH_TOKEN` — required online; must have `repo` scope (admin scope NOT required because this agent is read-only)

## Outputs

- `${VELYA_AUDIT_OUT}/repo-settings-audit/<ts>.json` — full structured report
- `${VELYA_AUDIT_OUT}/repo-settings-audit/latest.json` — copy of the most recent report

## Expected baseline (current registry — extend as needed)

| rule | expectation | severity |
|---|---|---|
| `secret-scanning-disabled` | `security_and_analysis.secret_scanning.status === 'enabled'` | high |
| `secret-scanning-push-protection-disabled` | `security_and_analysis.secret_scanning_push_protection.status === 'enabled'` | medium |
| `delete-branch-on-merge-off` | `delete_branch_on_merge === true` | low |
| `dependency-graph-var-not-set` | repo var `VELYA_DEPENDENCY_GRAPH_ENABLED === 'true'` | medium |
| `branch-protection-strict-off` | main branch protection has `required_status_checks.strict === true` | medium |
| `required-checks-missing` | main branch protection includes `Lint & Format`, `TypeScript Check`, `Test`, `Build` | high |
| `force-push-allowed-on-main` | main branch protection has `allow_force_pushes.enabled === false` | critical |
| `branch-protection-missing` | main has any protection rule at all | high |

Adding a new check: edit `scripts/agents/run-repo-settings-auditor.ts` and add a new `findings.push({ severity, rule, ... })` block + update this table.

## Exit codes

- `0` — clean (no findings) **or** offline mode
- `1` — at least one `critical` or `high` finding (medium / low don't fail the runner — they're recorded but informational)
- `2` — fatal error (gh CLI not installed, network down, JSON parse failed)

## Cadence

- CronJob `velya-repo-settings-auditor-agent`: every 6 hours (`0 */6 * * *`). Repo settings change rarely and a 6-hour drift window is acceptable.
- Smoke in CI: `VELYA_SMOKE_OFFLINE=true` (no gh calls)

## Validation chain

- Self-check: each setting is checked independently; one missing endpoint doesn't poison the rest (catch + warn pattern)
- Validator: none (this agent reports, never acts)
- Auditor: `autopilot-agents-ci.yaml` runs typecheck + smoke of the runner

## KPIs

- **Drift detection time**: time between a setting being changed and the next audit catching it (target ≤ 6 hours)
- **False positive rate**: settings flagged that an operator subsequently confirms are intentional (target < 5%)
- **Coverage**: number of expected baseline rules vs total settings the API exposes (track quarterly)

## Lifecycle

`draft` (created 2026-04-12). Promotes to `shadow` after 7 clean runs. Promotes to `active` after 14 clean runs and a stakeholder confirms the baseline matches their actual policy.
