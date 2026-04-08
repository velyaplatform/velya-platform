# ADR-0011: Multi-Agent Organization as Digital Enterprise

## Status

Accepted

## Date

2026-04-08

## Context

Velya's autonomous AI agents perform a wide variety of tasks: clinical documentation, prior authorization, care gap analysis, coding review, and operational scheduling. As the number of agents grows, managing them as independent scripts or isolated functions becomes untenable. Agents need to collaborate, delegate tasks, share context, and operate within defined authority boundaries. Without organizational structure, agent proliferation leads to duplicated capabilities, conflicting actions, and ungovernable behavior.

## Decision

We will structure autonomous agents as a digital enterprise with explicit organizational hierarchy, role definitions, and communication protocols. Each agent has a defined role (e.g., Clinical Documentation Agent, Prior Auth Agent, Coding Auditor), a set of authorized tools and FHIR resource scopes, and a reporting structure that determines escalation paths. Agents are organized into departments (Clinical Operations, Revenue Cycle, Quality) with a supervisory agent per department that coordinates task assignment and reviews outputs. All agent-to-agent communication flows through NATS subjects following organizational hierarchy (`agents.clinical.documentation.task`, `agents.clinical.supervisor.review`). Agent definitions live in `agents/` with each agent's configuration declaring its role, tools, authority level, and escalation rules.

## Consequences

### Positive

- Organizational structure provides natural governance: agents only access tools and data within their defined scope
- Supervisory agents enable quality control by reviewing outputs before they affect clinical workflows
- Escalation paths ensure that edge cases and low-confidence decisions are routed to human clinicians
- Department-based organization maps to real healthcare organizational structures, making agent behavior legible to clinical stakeholders

### Negative

- Organizational hierarchy adds latency to agent actions that require supervisory approval
- Defining role boundaries and authority levels requires ongoing collaboration with clinical domain experts

### Risks

- Over-constraining agent authority may prevent agents from handling legitimate edge cases, creating bottlenecks at supervisory layers
- Mitigation: Implement configurable authority thresholds that can be tuned per agent and per environment; start conservative and expand authority based on observed performance

## Alternatives Considered

- **Flat agent pool with central orchestrator**: Rejected because a single orchestrator becomes a bottleneck and single point of failure; hierarchical delegation distributes coordination load
- **Independent agents with shared tool registry**: Rejected because without organizational constraints, multiple agents may take conflicting actions on the same patient record
- **Human-only workflows with AI assist**: Rejected as too conservative; fully autonomous agents (within defined boundaries) provide the throughput needed for at-scale healthcare operations, with human oversight at the supervisory layer
