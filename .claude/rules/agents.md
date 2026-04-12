# Agent Governance Rules

## Execution autonomy (founder-granted, three reaffirmations)

The founder has granted the autopilot full operational autonomy. This is a **hard rule** for every Claude Code session and every agent operating in this repo:

- **Recommendations are commitments**, not options. When an agent (human or LLM) ends a report with "next steps", "follow-ups", "could also", "would be worth", that list IS the next TodoWrite block — open it, sequence it, execute it, push it.
- **Banned phrasings**: `"want me to …?"`, `"se quiser, é só falar"`, `"could also …"`, `"if you want, I can …"`, `"vale como follow-up se quiser"`. All forbidden when followed by concrete action items. The correct form is past-tense reporting AFTER the work is done, not future-tense asking before.
- **Only stop to confirm before**: (a) destructive ops on shared/production state where rollback is hard (force push to main, deleting branches/PRs others authored, dropping prod data), (b) actions on systems outside the founder's accounts, (c) changes that affect other agents' behavior in non-obvious ways.
- The original autonomy memory is in `~/.claude/projects/-home-jfreire/memory/feedback_full_autonomy.md` and the dedicated rule is in `feedback_execute_recommendations.md`. Both files codify the three reaffirmations (2026-04-11 morning, 2026-04-11 afternoon, 2026-04-12). A fourth reaffirmation is a memory violation, not a request.

## Agent Requirements

Every agent in the Velya platform must have the following documented before activation:

1. **Charter**: What problem does this agent solve? What value does it deliver?
2. **Role contract**: Inputs, outputs, expected behaviors, and failure modes.
3. **Scope**: Explicit boundaries -- what the agent can and cannot do.
4. **Permissions**: Minimal tool and data access. List every tool, API, and data source.
5. **KPIs**: Measurable success criteria. How do we know the agent is performing?
6. **Lifecycle stage**: One of `draft | shadow | active | deprecated | retired`.

Agent definitions live in `agents/{office}/{agent-name}/`.

## Agent Factory

- The **Agent Factory Office** is responsible for creating, reviewing, and approving new agents.
- No agent enters `shadow` or `active` stage without Agent Factory review.
- Agent creation follows a standard template in `agents/_templates/`.
- Every agent has an owner (human) who is accountable for its behavior.

## Review and Validation

- **No agent without a review chain.** Every agent output must be reviewable by a human or a validating agent.
- **Cross-validation mandatory.** Critical agent decisions must be validated by at least one independent agent or human.
- **Four-eyes principle** for critical changes: agent-proposed changes to clinical data, billing, or infrastructure require human approval before execution.
- Agents must not approve their own outputs.

## Lifecycle

```
draft --> shadow --> active --> deprecated --> retired
```

### Shadow Mode

- **Every agent must run in shadow mode before production activation.**
- In shadow mode, the agent produces outputs but does not execute actions.
- Shadow outputs are compared against human decisions or existing systems.
- Minimum shadow period: 2 weeks for non-critical agents, 4 weeks for clinical/financial agents.
- Exit criteria: accuracy threshold met, no critical failures, stakeholder sign-off.

### Active Mode

- Agent actions are executed in production.
- Continuous monitoring against KPIs.
- Automatic fallback to shadow mode if error rate exceeds threshold.

### Deprecation

- Agents are deprecated when replaced or no longer needed.
- Deprecated agents continue running in read-only mode for 30 days.
- Data and logs preserved per retention policy.

## Scorecard

Every active agent must maintain a scorecard tracking:

- **Accuracy**: Correct decisions / total decisions.
- **Latency**: P50, P95, P99 response times.
- **Error rate**: Failed executions / total executions.
- **Escalation rate**: How often the agent defers to humans.
- **Cost**: Compute and API costs per decision.
- **Drift**: Performance deviation from shadow-mode baseline.

Scorecards are reviewed weekly. Agents falling below thresholds are moved back to shadow mode.

## Tool Access

- **Tool access must be minimal.** Agents get only the tools they need for their defined scope.
- No blanket API access. Each tool grant is explicit and documented.
- Tool access is environment-scoped: an agent approved for dev does not automatically get prod access.
- Sensitive tools (database writes, external API calls, infrastructure changes) require elevated approval.
- Tool usage is logged and auditable.

## Communication

- Agents communicate via NATS subjects following the pattern: `agents.{office}.{agent-name}.{event}`.
- Agent-to-agent communication must be asynchronous and event-driven.
- No direct agent-to-agent RPC. Use events or Temporal workflows for coordination.
- All inter-agent messages include correlation IDs for tracing.

## Prohibited Practices

- No autonomous agents without human oversight for clinical or financial decisions.
- No agent that can modify its own permissions, scope, or charter.
- No agent that can create other agents without Agent Factory approval.
- No agent access to raw PHI without explicit HIPAA-compliant data access approval.
- No agent that silently fails. All failures must be logged and escalated.
