# Autonomous Maintenance — Promotion Policy

**ADR:** 0017  
**Owner:** Platform Engineering  
**Last Updated:** 2026-04-17

## Risk Classification

| Risk Level | Criteria | Auto-Merge | Soak Time | Manual Review |
|------------|----------|------------|-----------|---------------|
| **Low** | Patch/pin/digest update, no breaking changes, CI green | Yes | None | No |
| **Medium** | Minor update, moderate impact, CI green | Yes | 3 days | No |
| **High** | Major version, platform controller, schema/state change | No | N/A | Required |

## Decision Tree

```
Update detected
  │
  ├── Is it a patch/pin/digest? → LOW → Auto-merge after CI green
  │
  ├── Is it a minor version?
  │     ├── Platform controller? → HIGH → Block, require review
  │     └── Otherwise → MEDIUM → Auto-merge after 3-day soak
  │
  └── Is it a major version? → HIGH → Block, require review
```

## Promotion Flow

### Low Risk
```
Detection → PR opened → CI runs → All green → Auto-merge → ArgoCD auto-sync (dev)
```

### Medium Risk
```
Detection → PR opened → CI runs → All green → 3-day soak → Re-validate → Auto-merge → ArgoCD auto-sync (dev)
```

### High Risk
```
Detection → PR opened → CI runs → All green → Comment: "Manual review required" → Human reviews → Approve → Merge → ArgoCD auto-sync (dev)
```

### Production Promotion (all risk levels)
```
Dev green → Tag release → Staging manual sync → Validate → Prod manual sync (2 approvals)
```

## Rollback Policy

| Trigger | Action |
|---------|--------|
| Post-merge CI failure on automated commit | Open rollback issue with `git revert` command |
| ArgoCD sync failure after auto-merge | ArgoCD auto-heal attempts; if fails, open issue |
| Health check degradation after deploy | Alert via Grafana; manual revert if SLO breached |

## Kill Switch

To disable all autonomous updates:

```bash
# Disable Renovate
gh repo edit --default-branch main  # Remove renovate.json5

# Disable Updatecli
gh workflow disable "Detect: Platform Controller Updates"

# Disable agent dispatcher
gh workflow disable "Agent: Update Dispatcher"

# Disable autonomous promotion
gh workflow disable "Promote: Autonomous"
```

## Metrics (tracked weekly)

- Total automated PRs opened
- Merge rate (%)
- Average time from detection to merge
- Rollback count
- Drift detection count
- PRs blocked by risk policy
