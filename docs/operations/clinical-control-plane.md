# Clinical Control Plane — Runbook

**Audience:** velya operators, on-call, and autonomous agents.
**Authority:** [ADR-0016](../adr/0016-clinical-control-plane-adoption.md).

This runbook covers day-two operation of the clinical control plane
components introduced in ADR-0016. Treat it as the single source of
truth for how to *invoke*, *debug*, and *escalate* each workflow.

## Map

```
┌──────────────────────────────────────────────────────────────────┐
│                  CLINICAL CONTROL PLANE                          │
│                                                                  │
│ human/agent intent ──► clinical-dispatcher.yaml                  │
│                          │                                       │
│                          ├──► argocd-healer.yaml                 │
│                          ├──► memory-guardian.yaml               │
│                          ├──► visual-test.yaml                   │
│                          ├──► ui-audit-daily.yaml                │
│                          ├──► platform-validation.yaml           │
│                          ├──► security-supply-chain.yaml         │
│                          ├──► release.yaml                       │
│                          └──► clinical-compliance-gate.yaml      │
│                                                                  │
│ every 4h ────────────► clinical-workflow-sentinel.yaml           │
│                          │   (re-dispatches failing monitors)    │
│                          └── writes ops/state/clinical-health    │
│                                                                  │
│ agent PR fails CI ──► clinical-ci-self-heal.yaml                 │
│                          (lockfile/lint/format only, 3 attempts) │
│                                                                  │
│ PR merged to main ──► clinical-post-merge-monitor.yaml           │
│                          │   (FHIR /metadata, p95, 5xx)          │
│                          └── writes ops/state/rollback-signals   │
│                                                                  │
│ PR opened ─────────► clinical-compliance-gate.yaml               │
│                          (PHI/LGPD static scan, merge-blocking)  │
└──────────────────────────────────────────────────────────────────┘
```

## Invocations

### By intent (recommended)

```bash
gh workflow run clinical-dispatcher.yaml \
  -f intent='curar cluster'
```

Supported intents (case-insensitive, PT-BR or EN):

| Intent | Routes to |
|---|---|
| `curar cluster`, `healer`, `argocd`, `reconciliar` | `argocd-healer.yaml` |
| `corrigir ci`, `fix ci`, `self-heal`, `ci falhou` | `clinical-ci-self-heal.yaml` |
| `auditar memoria`, `memory` | `memory-guardian.yaml` |
| `sentinel`, `health check`, `verificar saude` | `clinical-workflow-sentinel.yaml` |
| `visual test`, `pixel`, `snapshot visual` | `visual-test.yaml` |
| `ui audit`, `deep audit`, `auditar ui` | `ui-audit-daily.yaml` |
| `ui quality`, `lint front`, `tsc front` | `ui-quality.yaml` |
| `validar plataforma`, `platform valid` | `platform-validation.yaml` |
| `supply chain`, `sbom`, `cosign` | `security-supply-chain.yaml` |
| `scan security`, `vulnerabilidade`, `cve` | `security.yaml` |
| `compliance`, `lgpd`, `phi`, `privacidade` | `clinical-compliance-gate.yaml` |
| `promover release`, `deploy prod`, `release`, `publicar` | `release.yaml` |
| `version bump`, `bump ver`, `subir versao` | `version-bump.yaml` |

Unmatched intents open a `needs-triage` issue with the label
`dispatcher`. **Never** silent-fail.

### By workflow file (fallback)

```bash
gh workflow run clinical-workflow-sentinel.yaml
gh workflow run clinical-ci-self-heal.yaml -f pr_number=123 -f branch=clinical/fix-something
gh workflow run clinical-post-merge-monitor.yaml -f pr_number=123
gh workflow run clinical-compliance-gate.yaml
```

## Sentinel — decoding the health state

Artifact path: `ops/state/clinical-health-state.json` (uploaded every
run as `clinical-health-state-<run_id>`).

```json
{
  "generatedAt": "2026-04-11T17:00:00Z",
  "overall": "degraded",
  "monitors": [
    { "name": "ArgoCD + K8s healer (scheduled esteira)", "status": "ok",      "lastRunAt": "...", "ageMinutes": 8,  "action": "none" },
    { "name": "memory-guardian",                         "status": "failing", "lastRunAt": "...", "ageMinutes": 15, "action": "re-dispatched" }
  ],
  "workflows": { "failing": ["memory-guardian"], "recentFailureRate": 0.1, "sampleSize": 20 }
}
```

### When the sentinel opens a P1

If any monitor has `action: re-dispatch-failed` or `status: disabled`,
the sentinel opens an issue tagged `sentinel` + `p1` + `needs-triage`.
Triage path:

1. Open the issue. The body lists the exact monitor name(s).
2. Run `gh workflow view '<monitor name>' --web` to see the last run.
3. Fix the root cause; do **not** re-dispatch blindly a fourth time —
   the sentinel already tried once.
4. Close the issue only after the monitor produces a green run.

## CI self-heal — reading attempt state

Counter file: `ops/state/self-heal/pr-<N>.count` (committed on the
agent branch, not main). `MAX_HEAL_ATTEMPTS=3`.

### Protected paths (never auto-fixed)

- `.claude/**`
- `infra/**`
- `schemas/**`
- `docs/risk/**`
- `apps/web/src/app/(clinical)/**`

If a PR touches any of these, the gate step exits with
`touched=true` and no fix is attempted. The PR requires human review.

### When self-heal can't recover

After 3 failed attempts, the gate refuses further runs. The PR stays
red. Escalate to the owning agent (meta-governance auditor) via
handoff, or fix by hand.

## Post-merge monitor — rollback signals

Signals live under `ops/state/rollback-signals/pr-<N>-<timestamp>.json`
and are uploaded as a workflow artifact. Example signal:

```json
{
  "generatedAt": "2026-04-11T18:05:00Z",
  "overall": "degraded",
  "pr": "1234",
  "mergeSha": "abcdef...",
  "reasons": ["p95-over-budget:2100ms"],
  "action": "pending-review"
}
```

**Rollback is never automatic.** The signal opens a P1 issue. The
human decides: `release.yaml` with a rollback tag, or a forward-fix.

### Probe budgets

| Probe | Budget | Source of truth |
|---|---|---|
| FHIR `/metadata` HTTP 200 | required | `VELYA_FHIR_BASE_URL` |
| p95 `/Patient?_count=1` | ≤ `VELYA_P95_BUDGET_MS` (default 1500 ms) | repo variable |
| recent 5xx rate | ≤ `VELYA_ERR_RATE_BUDGET` (default 0.02) | repo variable |

Missing secrets/vars → probes report `unknown` and the overall
status is `degraded`, never `critical`. Missing secrets must never
wake up a human.

## Shared session lock

Agents call `acquireLock({ agent, target, ttlMs, reason })` before
mutating a shared k8s or ArgoCD resource. Schema:
[`schemas/agent-session-lock.schema.json`](../../schemas/agent-session-lock.schema.json).

Lock storage: `${VELYA_AUDIT_OUT}/locks/*.lock.json`.

### Breaking a stuck lock by hand

```bash
# Inside a debug pod on the agents cluster
ls /data/velya-autopilot/locks/
cat /data/velya-autopilot/locks/argocd-application__velya-api.lock.json
rm  /data/velya-autopilot/locks/argocd-application__velya-api.lock.json
```

Prefer letting the TTL expire. Breaking a live lock can race with the
holder. Every break is recorded under `locks/broken/` for audit.

## Handoff → GitHub issue

When an agent emits a handoff via `scripts/agents/shared/handoff.ts`,
the record lands under `${VELYA_AUDIT_OUT}/handoffs/`. The sentinel
reads the directory on its next run and opens an issue with:

- Title: `[handoff] <fromAgent> → <toAgent>`
- Labels: `autopilot`, `handoff`, `needs-triage`, severity label
- Body: reason, context, suggested next steps, link to the run

**Patient-safety handoffs** (`clinicalImpact: patient-safety`) get
`p0` + `clinical-safety` labels and page the on-call human
immediately. They bypass the standard 4-hour sentinel cadence.

## Compliance gate — handling findings

The scanner runs on every PR touching `apps/`, `services/`,
`packages/`, `platform/`, `scripts/agents/`. A CRITICAL finding
blocks the merge.

### Allow list

Add `@allow-phi` on the offending line **with a justification** and
the scanner will skip the file:

```ts
// @allow-phi: fixture data, not a real CPF, lives under tests/
const CPF_FIXTURE = '123.456.789-09';
```

Do not paper over real findings. Prefer:

1. Extract the PHI-adjacent field into a structured log payload
   that routes through `packages/observability/redactor`.
2. Replace direct `fetch('/Patient/...')` calls with the FHIR
   client (`packages/fhir-client`).
3. Move fixtures into `tests/` (already skipped).

## Quick reference — where things live

| Thing | Path |
|---|---|
| Schemas | [`schemas/`](../../schemas/) |
| Agent shared helpers | [`scripts/agents/shared/`](../../scripts/agents/shared/) |
| Agent sync builder | [`scripts/agents/build-agent-sync-snapshot.ts`](../../scripts/agents/build-agent-sync-snapshot.ts) |
| PHI scanner | [`scripts/compliance/scan-phi-leakage.ts`](../../scripts/compliance/scan-phi-leakage.ts) |
| Sentinel workflow | [`.github/workflows/clinical-workflow-sentinel.yaml`](../../.github/workflows/clinical-workflow-sentinel.yaml) |
| Self-heal workflow | [`.github/workflows/clinical-ci-self-heal.yaml`](../../.github/workflows/clinical-ci-self-heal.yaml) |
| Dispatcher workflow | [`.github/workflows/clinical-dispatcher.yaml`](../../.github/workflows/clinical-dispatcher.yaml) |
| Post-merge workflow | [`.github/workflows/clinical-post-merge-monitor.yaml`](../../.github/workflows/clinical-post-merge-monitor.yaml) |
| Compliance gate | [`.github/workflows/clinical-compliance-gate.yaml`](../../.github/workflows/clinical-compliance-gate.yaml) |
| Health state artifact | `ops/state/clinical-health-state.json` |
| Rollback signals | `ops/state/rollback-signals/*.json` |
| Agent sync snapshot | `ops/state/agent-sync-status.json` |
| Self-heal counters | `ops/state/self-heal/pr-<N>.count` |
