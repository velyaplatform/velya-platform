# ADR-0014: Web-Tier Cron Agents Operate in Shadow Mode by Default

## Status

Accepted

## Date

2026-04-10

## Context

The web tier (`apps/web`) gained an autonomous self-healing scan loop in
April 2026 — see `apps/web/src/lib/cron-jobs.ts`, `cron-runners.ts`,
`agent-runtime.ts` and the K8s manifest at
`infra/kubernetes/bootstrap/velya-agent-cronjobs.yaml`. The intent is
that 8 agents organized into 5 offices continuously scan the platform
(routes, APIs, fixtures, headers, audit chain, manifest consistency,
field linkability, disk pressure, etc.), generate findings, and propose
remediation.

The founder requested that the system operate "without human interference
for maintenance, low cost, 100% functional, with automatic validations
and tests". That objective is in tension with three governance rules:

1. **`.claude/rules/agents.md`**: every agent must complete shadow mode
   before activation; no autonomous clinical or financial action.
2. **`.claude/rules/ai-safety.md`**: every action that drives an effect
   must pass validation; clinical risk class requires human approval.
3. **`.claude/rules/agent-governance.md`**: validators and auditors
   cannot be the agent itself; cross-office independence is mandatory.

We need a clear, auditable answer to: what runs autonomously today, what
requires human review, and how can we move things from one to the other.

## Decision

All web-tier cron agents launched in this iteration enter the
`shadow` lifecycle stage and stay there until explicitly promoted via
`/api/agents/[agentId]` (admin-only). The promotion path is:

```
draft → sandbox → shadow → probation → active → deprecated → retired
```

Concretely:

- **Shadow stage** is the default in `agent-runtime.ts`. The runtime
  helper `canExecuteAutonomously()` returns `false` for any agent that
  is not in `active`, regardless of action class.
- **Action risk classes** (`agent-runtime.ts:ActionRiskClass`) are
  `safe | review | critical`. Only `safe` ever executes autonomously,
  and only when the agent is `active`.
- **Critical class** wraps every action that touches PHI, billing,
  audit chain, infra-prod, middleware, or clinical records. These are
  always queued for human review via `cron-store.createFinding()` with
  a `shadowAction` payload, never executed.
- **Validators must be cross-office** (enforced by code review for now;
  the topology in `buildTopology()` will surface violations once a
  `function.role-mapping` cron lints the registry).
- **Kill switches** are env vars (`VELYA_AGENT_<UPPER_ID>_DISABLED=1`)
  read inside the `velya-web` Deployment pod, NOT inside the K8s
  CronJob trigger pods. This is intentional: the trigger pod only
  fires the HTTP call; the policy decision happens server-side.
  Operators flip the switch by patching the velya-web Deployment env.
- **AI gateway exception**: the orchestrator at `lib/ai-tools.ts`
  executes typed read-only tools directly against the in-process
  data layer without going through `packages/ai-gateway/`. This is
  permitted because (a) all 10 tools are read-only or write
  rasvonably reversible drafts, (b) no tool sends data to an
  external LLM provider, (c) the `requires-approval` mechanism gates
  every mutation. ADR-0010 is amended only to allow read-only tool
  calls that do not consult an LLM.

## Consequences

### Positive

- The system can be deployed today without violating any
  `.claude/rules/*` policy.
- Findings still accumulate in `cron-store`, learnings still surface
  in `learning-curator.ts`, dashboards in `/cron` and `/agents`
  still render the full topology — the platform learns and maps
  even while every action waits for a human.
- Promotion is a 1-click admin operation, fully auditable.

### Negative

- Until promotion happens, no auto-correction takes effect — the
  founder's "no human interference for maintenance" goal is not
  literally met for the first review window.
- The K8s CronJob fleet generates load even when nothing acts on
  the findings. This is acceptable: the cost is dominated by the
  velya-web pod itself, and the cron pods are < 64Mi each.

### Neutral

- The watchdog (`observability-watchdog-agent`) is itself in shadow
  mode and validated by `security-auditor-agent` (cross-office),
  not by itself. The historical bug where it self-watched was
  fixed in this iteration.

## Promotion Criteria

An agent may be promoted from `shadow` to `probation` when:

1. It has at least 14 days of run history in `agent-state.json`.
2. Its scorecard is green on all 5 metrics (validationPassRate,
   auditPassRate, evidenceCompleteness, slaAdherence,
   correctionRecurrence).
3. There are zero open findings of severity `critical` produced
   by it that have not been triaged.
4. Its validator agents (cross-office) have left at least one
   audit log entry per week confirming output review.
5. Its assumption-log entry in `docs/risk/assumption-log.md`
   has its validation deadline marked as MET.

`probation → active` requires the same plus 30 days of probation
with manual review of every output. This is not optional — see
`.claude/rules/agent-governance.md`.

## References

- [.claude/rules/agents.md](../../.claude/rules/agents.md)
- [.claude/rules/agent-governance.md](../../.claude/rules/agent-governance.md)
- [.claude/rules/ai-safety.md](../../.claude/rules/ai-safety.md)
- [ADR-0010 AI Abstraction Layer](./0010-ai-abstraction-layer.md)
- [ADR-0011 Multi-Agent Organization](./0011-multi-agent-organization.md)
