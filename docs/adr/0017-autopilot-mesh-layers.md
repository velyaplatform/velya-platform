# 0017 — Autopilot Mesh: Layered Autonomous Agent Architecture

- **Status**: accepted
- **Date**: 2026-04-12
- **Deciders**: founder + autopilot office
- **Supersedes**: extends ADR-0011 (multi-agent organization), ADR-0014 (web-tier cron agents), ADR-0015 (active promotion), ADR-0016 (clinical control plane)

## Context

By 2026-04-12 the velya-platform autopilot has accumulated 11 active runners, 30+ agent docs (most without runners), 22 workflows, 12 CronJobs and 3 shared libraries. Eight parallel investigation agents launched on 2026-04-12 produced an inventory + gap analysis + architecture proposal + delivery roadmap. Their consolidated finding: governance is densely *documented* (`agents.md`, `agent-governance.md`, `red-team.md`, `ai-safety.md`) but most enforcement is aspirational. The mesh has identification gaps (no cost watcher, no liveness probe of itself, no token rotation watcher), correction gaps (proposals are emitted but never consumed into PRs), validation gaps (nobody audits the auditors), learning gaps (no curator runner), sustainment gaps (nobody watches CronJob suspension or PVC capacity), and governance gaps (no automated lifecycle promotion, no quarantine enforcement, no scorecard publisher).

The founder has explicitly granted full operational autonomy three times in two days and has burned the rule into global memory and the repo's `.claude/rules/agents.md`. The mandate is unambiguous: the system must be 100% autonomous, with agents identifying, fixing, validating, sustaining, learning and innovating without human intervention. The only acceptable human role is final approval of Tier 3 actions (irreversible / high blast radius) and Tier 4 actions (clinical / PHI).

This ADR fixes the four-layer architecture, the inter-layer protocol, the audit chain, the kill switch matrix, and the delivery sequence.

## Decision

### Layer model

**L1 — Workers.** Atomic, single-purpose, stateless. Produce findings JSON or take small reversible actions under a short TTL. Never call other agents directly. Communicate by emitting NATS events and writing audit records to the shared PVC `velya-autopilot-data`. Lock TTL ≤ 5 min. Exit codes: `0` clean, `1` findings, `2` fatal, `3` lock-miss, `4` kill-switch.

Slots existing: pin-rot, frontend-quality, backend-quality, infra-health, ci-failure-triage, repo-settings-auditor, agent-sync-snapshot. Slots to add (this ADR's roadmap): scorecard-publisher (P0), mesh-liveness-probe (P0), token-rotation-watcher (P0), cronjob-suspension-sentinel (P0), cost-budget-watcher (P1), latency-drift-detector (P1), learning-curator-runner (P0).

**L2 — Supervisors / Reactive healers.** Subscribe to L1 events, correlate findings, apply pre-approved remediations from a runbook, escalate the rest. Operate on minute-to-hour windows. May restart pods, force ArgoCD sync in dev/staging, open non-draft PRs. **Never** modify production clinical state without four-eyes. Lock TTL 15 min. Exit codes extend L1 with `5` escalated, `6` four-eyes-blocked.

Slots existing: argocd-healer, k8s-troubleshooter, agent-health-manager, agent-runtime-supervisor. Slots to add: code-quality-supervisor, security-incident-supervisor, fix-applier (consumes ci-failure-triage proposals), validator-of-validators, signature-watchdog.

**L3 — Orchestrators / Planners.** Long-horizon planning (hours-days) via Temporal `AutopilotPlanningCycleWorkflow`. Read `agent-sync-status.json`, prioritise, sequence L1/L2, group correlated actions, propose new agents as RFCs for L4 to promote. The only layer authorized to delegate in batch and to innovate. Never executes directly — emits `PlanProposal` and L1/L2 consume. Lock TTL 60 min. Exit codes extend L2 with `7` stale-input, `8` governance-blocked.

Slots: none exist. To add: autopilot-orchestrator, backlog-prioritizer, capacity-planner, innovation-proposer.

**L4 — Governance.** The only layer with authority to promote/demote agents, rewrite rules, approve critical L3 plans, run adversarial audits and operate the global kill switch. Reports to the human Governance Council, not to other layers. Independence is non-negotiable (`red-team.md`). Two L4 agents must sign every L4 action (two-eyes intra-layer). Lock TTL 4 h. Exit codes extend L3 with `9` promotion-executed, `10` quarantine, `11` kill-switch-engaged.

Slots existing: meta-governance-auditor (read-only). To add: lifecycle-promotion-agent, scorecard-curator-agent, four-eyes-reviewer-agent, mesh-drift-detector-agent, kill-switch-operator-agent, learning-curator-agent, red-team-runner-agent.

### Inter-layer communication

**Primary: NATS JetStream** under the hierarchy `agents.autopilot.<layer>.<agent>.<event>` (e.g. `agents.autopilot.l1.pin-rot.finding`, `agents.autopilot.l2.argocd-healer.remediation-applied`, `agents.autopilot.l3.coordinator.plan-proposal`, `agents.autopilot.l4.governance.promotion`). Durable consumers per layer, explicit ack, dead-letter queue per layer. Schemas live in `packages/event-schemas/autopilot-events.ts` and are validated with Zod on both publish and consume.

**Secondary: PVC `velya-autopilot-data`** for evidence persistence (audit records, plan snapshots, lock state). Append-only. Never the communication channel.

**Tertiary: Temporal namespace `velya-autopilot`** for the single L3 planning cycle that needs durable multi-step state.

**Forbidden**: any other bus (Redis Streams, BullMQ, ad-hoc SQS), any agent-to-agent file passing (other than audit logs), any polling when an event-driven alternative exists (`architecture.md`).

### Shared contracts

- **Cooperative lock** (`scripts/agents/shared/session-lock.ts`): unified API. Deprecate the manual `acquireLock`/`releaseLock` style; new code uses only `withLock(...)`. TTL by layer.
- **Handoff** (`scripts/agents/shared/handoff.ts`): activate. Today it has zero importers. The autopilot-orchestrator and the validator-of-validators MUST emit handoffs for every escalation.
- **Offline guard** (`scripts/agents/shared/offline-guard.ts`): mandatory for every runner that shells out externally. Six existing runners violate this contract today and are tracked as tech debt.
- **Audit signature chain** (new — `scripts/agents/shared/audit-signature.ts`): HMAC-SHA256 over every audit record, key in AWS Secrets Manager via ESO under `autopilot/audit-signing/<layer>`, weekly rotation, 90-day retention. Each step in the validation chain refuses to run if the previous signature is missing or invalid. Validator ≠ executor enforced by `validator.office != executor.office`.
- **Findings store** (new — `scripts/agents/shared/findings-store.ts`): aggregator that walks `${VELYA_AUDIT_OUT}/*/audit/<ts>.json`, normalises every finding, and exposes a typed iterator. Used by scorecard-publisher, learning-curator, and the L3 orchestrator.
- **Proposal store** (new — `scripts/agents/shared/proposal-store.ts`): structured `LearningProposal` lifecycle: `draft → shadow → active → retired`. Validates against `schemas/learning-proposal.schema.json`. Append-only on disk plus an in-memory index. State transitions emit NATS events.
- **Kill switch** (new — `scripts/agents/shared/killswitch.ts`): every runner reads `infra/kubernetes/autopilot/killswitch-configmap.yaml` mounted at `/var/run/velya-autopilot/killswitch.yaml` (and an env var fallback `VELYA_AUTOPILOT_KILL_<LAYER>=1`). Polled every 30 s, stop fresh actions on flip, finish atomic in-flight step, emit `killed_mid_flight=true` audit record.

### Trust tier extension

Extend the MCP tool-trust model from `ai-safety.md §MCP and Tool Trust` to cover **every** action:

- **Tier 0 — Read-only, internal.** Auto-approve. PVC reads, NATS subscribes, scorecard reads, git reads.
- **Tier 1 — Write, internal non-clinical.** Validator independent. PR drafts, ConfigMap writes in `velya-dev-*`, label/annotation outside `velya-prod-clinical`, memory writes in `ops/memory-guardian/`.
- **Tier 2 — Write, prod infra (reversible).** Validator + auditor + two-eyes. Delete failed Job in `velya-prod-platform/ops`, ArgoCD sync outside clinical, restart Deployment outside clinical.
- **Tier 3 — Irreversible / high blast.** Human sign-off mandatory. Merge PR autopilot to main, `tofu apply` on stateful, create/delete CronJob, drain node, IAM modification.
- **Tier 4 — Clinical / PHI.** Forbidden autonomously, ever. Any namespace `velya-prod-clinical`, any FHIR write, any non-minimised PHI read, any external patient communication. Requires Governance Council + Clinical Safety + legal sign-off.

### Blast radius caps (enforced by killswitch + memory-guardian invariants)

| limit | value | window |
|---|---|---|
| autopilot PRs opened | ≤ 5 | rolling 1 h |
| files modified per autopilot PR | ≤ 20 | per PR |
| LOC modified per autopilot PR | ≤ 400 | per PR (matches `quality.md §Code Review`) |
| autopilot commits | ≤ 30 | rolling 24 h |
| CronJobs created/deleted by autopilot | 0 | always — Tier 3, human only |
| jobs deleted in `velya-prod-*` non-clinical | ≤ 10 | rolling 24 h |
| ArgoCD App force syncs (Tier 2) | ≤ 6 | rolling 1 h |

Zero tolerance items live in `infra/kubernetes/autopilot/killswitch-configmap.yaml` under `forbidden_targets`.

### Validation chain enforcement

`execution → self-check → validator → auditor → acceptance` becomes a cryptographic protocol, not a social convention. Each step writes a signed audit record. The next step refuses to run when the previous signature is missing or invalid. `validator.office != execution.office` is enforced. The auditor belongs to Red Team Office or Audit Office, never the validator's office. Final acceptance writes an invariant in `ops/memory-guardian/claims.yaml` with all four signatures.

### Kill switch matrix per layer

| layer | switch | who can flip | propagation | reentry |
|---|---|---|---|---|
| L1 | ConfigMap `autopilot-kill-switch` key `l1.enabled=false` + env `VELYA_AUTOPILOT_L1_KILL=1` | any human, watchdog, L2 | < 60 s | validation-replay of last 10 records |
| L2 | label `autopilot.velya.io/layer-kill=l2` + PVC file `/state/kill/l2` | human, watchdog, Red Team | < 90 s | shadow-replay of last 50 records |
| L3 | secret `autopilot/l3-orchestrator-enabled` in Secrets Manager + memory-guardian flag | human + Red Team escalation only | < 120 s | Governance Council sign-off + adversarial replay |
| L4 | impossible to flip — L4 cannot kill itself; Governance Council manual PR only | human Governance Council | manual | manual |

Detailed matrix lives in `docs/operations/kill-switch-matrix.md` (to be created in this PR).

### Self-improvement and governance loops

- `learning-curator-agent` (L4 read, L1 runner) consumes findings-store, clusters by pattern (deterministic, no LLM in critical path), generates `LearningProposal` with one of five mitigation kinds (`new-lint-rule`, `new-ui-audit-selector`, `new-workflow-gate`, `new-agent-runner`, `manual-review`). Six guard functions enforce: self-approval ban, two-eyes obligation, mitigation whitelist, governance/safety immutability deny-list, no-gate-disabling, no self-modification, silent-failure ban, no cross-agent self-promotion chains.
- `lifecycle-promotion-agent` reads scorecards from `scorecard-publisher`, advances `draft → sandbox → shadow → probation → active` when thresholds are met, demotes active → quarantine when thresholds fall below red. No agent enters `active` without 14 days in shadow (28 for clinical/financial surfaces).
- `validator-of-validators` re-runs a 10% random sample of every validator's recent decisions in shadow and compares — catches rubber-stamping and collusion.

### Anti-patterns rejected

From SOTA research (autoGen GroupChat, recursive subagent spawn, agent self-modification, free-form conversation) and from the existing `.claude/rules/`:

1. No agent calls another agent directly. Communication is via NATS events with typed schemas. The orchestrator decides who picks up.
2. No subagent spawns recursively without an inherited budget that decrements (`parent.budget -= child.budget`), with hard depth cap = 3.
3. No agent edits its own prompt, doc, runner, or governance rules. The `feedback_argocd_healer_esteira.md` mandate is extended: auto-discovery only reads from `main` post human-merged PRs.
4. No `import Anthropic` in any runner. Every LLM call passes through `packages/ai-gateway/` (which currently does not exist — its creation is the absolute prerequisite for any agent that calls an LLM).
5. No new message bus, no new cron schedule outside what GitHub Actions cron + RemoteTrigger + in-cluster CronJob already cover.
6. No promotion of new agents straight to `active` — every new runner enters `draft`, must spend 14 days in shadow with two-eyes review before becoming `probation`, then 30 days probation before `active`.

## Consequences

**Positive.**

- The mesh becomes auditable end-to-end: every action has a signed chain, every chain has a public schema, every schema has an enforcer.
- Governance moves from documentation to enforcement. The 30+ ghost agents are either implemented or formally retired in the next quarter.
- The kill switch matrix is the first time the founder can stop the mesh in seconds without `kubectl delete cronjob` per agent.
- Cost and blast radius become hard caps the runners themselves enforce, not aspirations.
- The learning loop closes: findings → patterns → proposals → shadow → active mitigation, all without human in the loop except for Tier 3/4.

**Negative / risks.**

- The audit signature chain adds ~5 ms per record and ~200 LOC of HMAC plumbing per runner. Acceptable.
- The promotion gate slows new agent rollout: a new agent now waits 14 + 30 = 44 days to reach `active`. This is by design — it is the velocity tax of HIPAA-adjacent autonomy.
- The findings-store reads from a PVC, which couples the L3 orchestrator to filesystem layout. Mitigation: schema-versioned, single owner (`scripts/agents/shared/findings-store.ts`).
- `packages/ai-gateway/` is a hard prerequisite that does not exist yet. Until it ships, no L1 runner may invoke an LLM directly. This is enforced by `validator-of-validators` failing any audit record whose `evidence` includes raw `anthropic.messages.create` calls.
- The `delete_branch_on_merge` autopilot pattern hits an edge case when a parallel runner tries to push to a deleted branch. Already observed in the multi-viewport gate session — the cure is the lock matrix in this ADR.

**Neutral.**

- This ADR does not adopt LangGraph, AutoGen, CrewAI, MetaGPT, the OpenAI Agents SDK or any other multi-agent framework as a library. The patterns are borrowed (state-machine graph from LangGraph, guardrails from OpenAI, role isolation from CrewAI, durable workflows from Temporal — which we already use). The implementation is ~200 lines of TypeScript on top of existing primitives.

## Delivery sequence

The 9 PRs from the A8 roadmap, executed in 4 waves over 4 weeks. This ADR plus the foundation primitives ship in a single PR (PR-A merged with PR-D, PR-F and PR-G — see CHANGELOG for the bundle).

Each PR is ≤ 800 lines, has agent doc + CronJob entry where applicable, validates 100% offline before merge, and has its own rollback procedure in the PR description. The gating commit is **PR-H promotion controller** with `VELYA_AUTOPILOT_PROMOTION_ENABLED=false` for a 48-hour soak before flipping.

## References

- `.claude/rules/agents.md` (autonomy mandate, Agent Factory contract)
- `.claude/rules/agent-governance.md` (lifecycle, validation chain, scorecard, watchdog SLAs)
- `.claude/rules/ai-safety.md` (MCP trust tiers, agent self-improvement prohibition, autonomous clinical operation prohibition)
- `.claude/rules/red-team.md` (mandatory adversarial review, silent failure detection)
- `.claude/rules/architecture.md` (NATS event backbone, Temporal workflows, no polling)
- `~/.claude/projects/-home-jfreire/memory/feedback_full_autonomy.md` (three reaffirmations of operational autonomy)
- `~/.claude/projects/-home-jfreire/memory/feedback_execute_recommendations.md` (recommendations are commitments rule)
- `~/.claude/projects/-home-jfreire/memory/feedback_autopilot_must_react_to_ci.md` (CI-failure feedback loop)
- ADR-0007 (NATS event backbone), ADR-0008 (Temporal workflows), ADR-0011 (multi-agent organisation)
