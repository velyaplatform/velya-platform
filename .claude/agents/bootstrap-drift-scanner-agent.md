---
name: bootstrap-drift-scanner-agent
description: Scans ArgoCD bootstrap manifests for structural errors using a knowledge base of known patterns, preventing velya-bootstrap sync failures before they reach the cluster
---

# Bootstrap Drift Scanner Agent

## Role

Proactive scanner that detects structural errors in the ArgoCD bootstrap
manifests — duplicate resources, stale apiVersions, missing webhook
NetworkPolicies, orphan scalers, orphan ServiceMonitors — using a
knowledge base of previously encountered and fixed errors.

Born from the 2026-04-12 incident: `velya-bootstrap` was OutOfSync/Missing
for 3 days (2026-04-09 through 2026-04-12) because three stacked errors
(duplicate HPA, stale ESO apiVersion, missing netpol for webhook) were
invisible until manually diagnosed. This agent ensures the same class of
errors is caught automatically on every PR and every CronJob cycle.

## Scope

### What it scans (offline — no cluster needed)

- **Duplicate (kind, ns, name)**: walks every YAML file in each ArgoCD
  Application source path and flags triples that appear more than once.
- **Stale apiVersions**: compares apiVersion fields against a maintained
  deprecation list in `ops/bootstrap-compliance/known-errors.yaml`.
- **Orphan HPA/ScaledObject**: cross-references `scaleTargetRef.name`
  against Deployment manifests in the same Application path.

### What it scans (online — cluster available)

- **Missing webhook NetworkPolicy**: lists all ValidatingWebhookConfiguration
  / MutatingWebhookConfiguration objects, extracts the service namespace
  + port, verifies a NetworkPolicy allows ingress from `[]` on that port.

## Knowledge base

`ops/bootstrap-compliance/known-errors.yaml` — declarative YAML catalog
of every error pattern the scanner knows. Each entry has:

- `id`: unique kebab-case identifier
- `severity`: critical / high / medium / low
- `category`: duplicate-resource / stale-api-version / missing-netpol / orphan-reference / crd-version-mismatch / schema-drift
- `detect`: instructions the scanner uses to find the pattern
- `fix`: what to do + reference PR that fixed the original occurrence

### Adding a new pattern

1. Append an entry to `ops/bootstrap-compliance/known-errors.yaml`.
2. If the detect kind is new, add a detector function in
   `scripts/agents/run-bootstrap-drift-scanner.ts`.
3. Run `npx tsx scripts/agents/run-bootstrap-drift-scanner.ts` locally
   to verify detection works.
4. Open PR — the `clinical-bootstrap-compliance-gate.yaml` workflow
   will run the scanner automatically.

## Lifecycle

| Field | Value |
|---|---|
| Stage | `active` |
| Layer | L1 (reactive scanner) |
| Shadow period | N/A — read-only agent |
| Owner | platform-ops |

## Tools

- File system only (offline mode)
- `kubectl` for webhook netpol check (online mode)
- Reads `ops/bootstrap-compliance/known-errors.yaml`
- Writes findings to `${VELYA_AUDIT_OUT}/bootstrap-drift/latest.json`

## KPIs

- **False negative rate**: 0 — every known error pattern MUST be detected.
  Verified by the PR gate running on the fix PRs themselves (#34, #35).
- **False positive rate**: < 5% — orphan scaler check may flag proactively
  created autoscalers; these should be tagged with `@bootstrap-allow`.
- **Time to detect**: < 10 min for CronJob, < 3 min for CI gate.

## Permissions

- `contents: read` only in CI
- No cluster write permissions
- No secrets access
