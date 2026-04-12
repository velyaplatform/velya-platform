# ADR-0016: Clinical Control Plane Adoption

## Status

Accepted

## Date

2026-04-11

## Context

The existing velya automation (ArgoCD healer esteira, memory-guardian,
visual-test, ui-audit-daily, platform-validation) is a solid first layer
but has four structural gaps that the founder called out during the
autopilot review:

1. **No meta-monitor.** When a monitor itself fails — argocd-healer
   workflow disabled, memory-guardian stale, visual-test queue stuck —
   nothing notices until a human happens to look. There is no "watcher
   that watches the watchers".
2. **No safe CI self-heal.** When an agent-authored PR fails on a
   deterministic, reversible error (lockfile drift, ESLint, Prettier),
   a human has to commit the fix manually. This is the #1 source of
   manual toil on autopilot PRs.
3. **No shared coordination state.** `run-argocd-healer.ts`,
   `run-k8s-troubleshooter.ts`, and `run-meta-governance-auditor.ts`
   all operate on overlapping k8s namespaces without a cooperative
   lock, so their remediations can race.
4. **No single entry point by intent.** Calling a workflow today
   requires knowing its exact file name. The founder operates from
   mobile and prefers intents like "curar cluster" over
   `argocd-healer.yaml`.

Autopilot (the separate `autopilot` repository in
`/home/jfreire/.local/share/.repos/autopilot`) has already solved
variations of these problems for the generic control-plane use case:

- `workflow-sentinel.yml` — meta-monitor of critical workflows with
  one-shot re-dispatch and last-line-of-defense issue escalation.
- `ci-self-heal.yml` — attempt-counted safe fixes on agent branches.
- `autopilot-dispatcher.yml` — intent → workflow routing (PT/EN).
- `post-merge-monitor.yml` — post-merge probes with rollback signal
  (signal only; destructive rollback is manual).
- `schemas/lock.schema.json` + `schemas/handoff.schema.json` — the
  coordination primitives the autonomous agents use to avoid stepping
  on each other.

Those patterns can be ported directly. They cannot be copied wholesale
because the autopilot repo is **the control plane** — it treats
workflows themselves as the unit of work. Velya is **an application**
in FHIR-first mode; the patterns have to be reframed around clinical
state (ArgoCD apps, PVCs, FHIR endpoints) and clinical-safety
guardrails (no automated rollback, mandatory human review for
patient-safety findings, PHI-aware gates).

## Decision

Introduce a **clinical control plane** layered on top of the existing
esteira. The new layer is intentionally conservative:

- **No automated destructive actions.** Every rollback, quarantine,
  or freeze is a *signal*, not an action. Human approval closes the
  loop.
- **All state files are versioned schemas.** `schemas/agent-session-lock`,
  `schemas/clinical-handoff`, `schemas/clinical-health-state`, and
  `schemas/clinical-agent-sync-state` define the contracts.
- **Self-heal is attempt-counted and path-guarded.** Clinical, infra,
  schemas, and rules directories are never touched by the healer.
- **The dispatcher speaks PT-BR and EN.** The founder operates from
  mobile and prefers intent-level commands over filename lookups.

### Components

| Component | File | Role |
|---|---|---|
| Shared session lock | [`scripts/agents/shared/session-lock.ts`](../../scripts/agents/shared/session-lock.ts) | Cooperative, file-based exclusive lock between concurrent `run-*-agent` executions |
| Handoff emitter | [`scripts/agents/shared/handoff.ts`](../../scripts/agents/shared/handoff.ts) | Append-only `ClinicalHandoff` records when an agent cannot self-resolve |
| Agent-sync snapshot builder | [`scripts/agents/build-agent-sync-snapshot.ts`](../../scripts/agents/build-agent-sync-snapshot.ts) | Produces `ops/state/agent-sync-status.json` for memory-guardian + sentinel |
| PHI leakage scanner | [`scripts/compliance/scan-phi-leakage.ts`](../../scripts/compliance/scan-phi-leakage.ts) | Static scan for CPF/SSN/MRN in logs, hard-coded PHI, direct FHIR fetches |
| Workflow sentinel | [`.github/workflows/clinical-workflow-sentinel.yaml`](../../.github/workflows/clinical-workflow-sentinel.yaml) | Meta-monitor every 4h with one-shot re-dispatch |
| CI self-heal | [`.github/workflows/clinical-ci-self-heal.yaml`](../../.github/workflows/clinical-ci-self-heal.yaml) | Safe fixes (lockfile, lint, format) on agent branches, capped at 3 attempts |
| Dispatcher | [`.github/workflows/clinical-dispatcher.yaml`](../../.github/workflows/clinical-dispatcher.yaml) | Intent → workflow routing |
| Post-merge monitor | [`.github/workflows/clinical-post-merge-monitor.yaml`](../../.github/workflows/clinical-post-merge-monitor.yaml) | Probes `/metadata`, p95, 5xx; writes rollback signal (never acts) |
| Compliance gate | [`.github/workflows/clinical-compliance-gate.yaml`](../../.github/workflows/clinical-compliance-gate.yaml) | PR-blocking PHI/LGPD scanner |

### Boundaries (non-negotiable)

- **No clinical autonomy.** None of the components above may modify
  clinical records, patient state, orders, or medications (ADR-0001
  through ADR-0015 still apply).
- **No self-rollback.** Post-merge monitor writes a signal; humans
  decide. This is consistent with `.claude/rules/agent-governance.md`
  kill-switch policy.
- **No protected-path mutation by self-heal.** The healer will not
  touch `.claude/**`, `infra/**`, `schemas/**`, `docs/risk/**`, or
  `apps/web/src/app/(clinical)/**`.
- **No PHI in coordination state.** Lock / handoff / sync files carry
  correlation IDs only. Raw PHI stays in Medplum and encrypted logs.

## Consequences

### Positive

- Meta-monitor catches and self-dispatches failing workflows within
  4 hours, closing the longest current observability gap.
- CI self-heal eliminates the dominant source of manual toil on agent
  PRs (lockfile drift and lint) without giving the healer any
  irreversible powers.
- Cooperative lock prevents healer ↔ troubleshooter races, which the
  red-team flagged as a silent-failure risk in March.
- Single dispatcher intent makes mobile operation tractable; one
  `gh workflow run clinical-dispatcher.yaml -f intent='curar cluster'`
  replaces filename lookups.
- Schemas and the agent-sync snapshot give memory-guardian a single
  file to validate instead of walking the entire `scripts/agents`
  tree.

### Negative

- More workflows to maintain (+5). The sentinel itself is a
  single-point-of-failure in the meta-monitor layer; if *it* breaks,
  nothing catches it. Mitigation: the sentinel runs on a 4-hour cron
  and emits a health artifact; if no artifact appears for 24 hours,
  memory-guardian raises a P1 via its existing claim machinery.
- Dispatcher routing is keyword-based and can misfire on ambiguous
  intents. Mitigation: unmatched intents open a triage issue rather
  than silently running nothing.
- Lock file collisions can still happen across clusters if the lock
  directory is not on a shared volume. Mitigation: documented in the
  runbook; agents on separate cluster runners operate on disjoint
  targets by convention.

### Neutral

- This is an additive ADR. It does not change any clinical, FHIR,
  event, or data-model decision. It also does not change the
  existing ArgoCD healer esteira; it only adds meta-observation
  and routing around it.

## References

- Source patterns: `autopilot` repo at
  `/home/jfreire/.local/share/.repos/autopilot`
- Related ADRs: ADR-0011 (Multi-agent organization), ADR-0014 (Web-tier
  cron agents shadow mode), ADR-0015 (Active promotion of four safe-class
  agents)
- Operational runbook: [`docs/operations/clinical-control-plane.md`](../operations/clinical-control-plane.md)
- Rules enforced: `.claude/rules/agent-governance.md`,
  `.claude/rules/ai-safety.md`, `.claude/rules/security.md`

## Follow-ups

1. ~~Migrate `run-argocd-healer.ts` and `run-k8s-troubleshooter.ts` to
   call `withLock()` before mutating ArgoCD / k8s state, guarded by
   feature flag `VELYA_COOPERATIVE_LOCKING`.~~ **Done** — second PR
   `feat/clinical-control-plane-lock-migration`. Flag defaults ON in
   CI and in the in-cluster CronJobs so deployment is a single env
   flip to roll back.
2. ~~Add a Kubernetes `CronJob` that runs `build-agent-sync-snapshot.ts`
   inside the cluster every 15 minutes.~~ **Done** — same follow-up PR,
   `infra/kubernetes/autopilot/agents-cronjobs.yaml` appends a
   `velya-agent-sync-snapshot` CronJob. Needs the next
   `velya-autopilot-agents` image rebuild before first reconcile.
3. ~~Commit the produced `ClinicalAgentSyncState` snapshot from
   the CronJob into an `autopilot-state` orphan branch (so memory-guardian
   CI can read it without mounting the PVC).~~ **Done (CI side).** A new
   `agent-sync-commit.yaml` workflow builds the snapshot every 15 minutes
   in CI and commits it to the `autopilot-state` orphan branch under
   `state/agent-sync/{status.json,last-generated-at.txt}`. The branch is
   auto-initialised on first run. The CI snapshot tracks the *repo view*
   of agent inventory (who's declared, which files exist) — the *runtime
   view* (live locks and live handoffs) still requires the in-cluster
   CronJob to push from inside the pod, which is a separate sub-follow-up
   (git-inside-pod pattern) tracked below.
   - **Sub-follow-up (open):** make the `velya-agent-sync-snapshot`
     CronJob push its in-cluster snapshot to the same branch. Needs an
     SSH deploy key or a short-lived token injected via a k8s Secret.
4. ~~Cross-agent namespace serialization. Today the healer locks
   at `argocd-application` scope and the troubleshooter at `k8s-namespace`
   scope. Two agents mutating the same cluster state still can't race on
   the *same* lock.~~ **Done.** The healer now takes **two** locks in
   strict order `application → destination-namespace` whenever
   `spec.destination.namespace` is present. The ordering is enforced by
   convention — healer and troubleshooter are the only agents that take
   these locks, and both respect the same order. When the destination
   namespace is missing (project-default or multi-namespace render),
   the healer falls back to application-only locking. Contract is
   covered by 2 new cases in `cooperative-locking.integration.test.ts`.
