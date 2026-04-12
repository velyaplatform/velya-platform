# autopilot-state

This orphan branch carries operational state emitted by the
Velya autopilot esteira. It is **never merged into main**. It
is a one-way publish target.

Contents:
- `state/agent-sync/status.json` — latest ClinicalAgentSyncState
  produced by `scripts/agents/build-agent-sync-snapshot.ts`
- `state/agent-sync/last-generated-at.txt` — ISO-8601 of the
  last refresh

Writers:
- `.github/workflows/agent-sync-commit.yaml` (CI, every 15 min)
- `infra/kubernetes/autopilot/agents-cronjobs.yaml`
  `velya-agent-sync-snapshot` CronJob (in-cluster, every 15 min,
  ADR-0016 follow-up — pending a git-inside-pod pattern)

Readers:
- `ops/memory-guardian/claims.yaml` (future freshness claim)
- any operator with a curl command
