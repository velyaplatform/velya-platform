# Lincesoc AWS Migration Status (Current)

Generated: 2026-04-15T12:54:16.749Z

## Summary

- Management account: `582381607124` (`arn:aws:iam::582381607124:user/claude-codex-automation`)
- AWS profile: `lince-migration`
- Organizations blocker: `lince-prd` is `ACTIVE`
- `lince-hml` present: `no`
- `auto-upgrade` converged: `yes`
- `cost-automation` converged: `yes`
- Main GitHub PAT valid-looking: `no`
- Upgrade reviewer PAT valid-looking: `no`

## Blockers

- `organizations` must remain blocked while `lince-prd` stays suspended
- `lince-hml` is still absent
- GitHub-driven runtime remains degraded until PAT secrets are populated with real values

## Automatic Mechanisms

- Persistent dashboard launcher:
  `velya-platform/scripts/start-orchestration-dashboard.sh`
- Persistent agent coordination sync launcher:
  `velya-platform/scripts/start-agent-coordination-sync.sh`
- Persistent migration sync launcher:
  `velya-platform/scripts/start-lincesoc-aws-migration-sync.sh`
- Local coordination snapshot:
  `velya-platform/ops/state/agent-sync-status.json`
- Sync engine:
  `velya-platform/scripts/sync-lincesoc-aws-migration.mjs`
- Agent coordination engine:
  `velya-platform/scripts/sync-agent-coordination.mjs`
- Live ledger helper:
  `velya-platform/scripts/sync-agent-ledger.mjs`
- Live squad state:
  `velya-platform/squads/lincesoc-aws-migration/state.json`
- Dashboard ingests the shared hub coordination snapshot when it exists and falls back to the local snapshot above
- Supporting services auto-heal on stale health files before being reported as healthy again

## Dashboard Snapshot

- Dashboard URL: `http://localhost:5173/`
- Snapshot API: `http://localhost:5173/api/snapshot`
- Coordination agents visible through synthetic `coordination-snapshot` delegations
- Current step: 3/5 - Waiting for AWS Support case 177618647600516
- Current squad status: `checkpoint`

## AWS Facts

- Management account active: `yes`
- `lince-prd` status: `ACTIVE`
- `lince-hml` present: `no`
- Support API available for this account: `no`
- Artifact builder present: `yes`

## Resources Present

- `auto-upgrade` resources present: `lince-upgrade-reviewer`, `lince-upgrade-audit`, `lince-upgrade-actions`, `lince-upgrade-actions-dlq`, `lince-upgrade-reviewer-webhook`
- `cost-automation` resources present: `lince-rightsizer`, `lince-savings-coverage`, `lince-cost-killer`, `lince-business-hours-scheduler`, `lince-cost-actions-audit`, DLQs, EventBridge schedules, alarms

## Support

- Support case: `177618647600516`
- Support case created: `2026-04-14T17:07:56.188Z`
- Support case opened by: `lincesoc@gmail.com`
- Support category: `Account, Account Reinstatement`
- Support severity: `General question`
- Support status at opening: `Unassigned`
- Support API automation status: `blocked by Basic Support`

## Runtime Gates

- `lince/github-pat` valid-looking: `no`
- `lince-upgrade-reviewer/github-pat` valid-looking: `no`
- Monthly stale alarm in `cost-automation`: disabled by default because the previous CloudWatch design exceeded the one-week alarm evaluation limit

## Next Safe Step

1. Wait for AWS Support response on case `177618647600516`
2. Keep `organizations` blocked until `lince-prd` is reactivated and account creation is unblocked
3. Populate valid GitHub PAT secrets
4. After unblock, re-run `live/mgmt/us-east-1/organizations` and create `lince-hml`
