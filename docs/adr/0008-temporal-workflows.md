# ADR-0008: Temporal for Durable Workflows

## Status

Accepted

## Date

2026-04-08

## Context

Healthcare workflows are inherently long-running and stateful: prior authorization requests wait days for payer responses, care plan escalations follow multi-step clinical protocols, and patient onboarding spans multiple systems over hours or days. These workflows must survive service restarts, handle retries with backoff, maintain audit trails, and support human-in-the-loop approval steps. Traditional approaches using database-backed state machines or message queue choreography are fragile, hard to test, and produce scattered workflow logic.

## Decision

We will use Temporal 1.25+ as the durable workflow engine for all long-running, stateful business processes. Temporal workflows are written as regular TypeScript functions using the Temporal TypeScript SDK, making them testable, debuggable, and version-safe. Temporal Server will be self-hosted on EKS using the official Helm chart with PostgreSQL as the persistence backend. Workflow definitions live in `services/` alongside their parent service, while shared workflow primitives (retry policies, signal definitions, search attributes) live in `packages/temporal-shared/`.

## Consequences

### Positive

- Workflows are written as deterministic TypeScript functions, making them readable, testable, and debuggable with standard tooling
- Temporal handles retries, timeouts, heartbeats, and crash recovery automatically, eliminating hand-rolled state machine complexity
- Built-in support for signals, queries, and updates enables human-in-the-loop workflows (e.g., clinician approval steps)
- Temporal's visibility API and web UI provide full workflow execution history for compliance auditing

### Negative

- Temporal Server is a complex distributed system (4 services + persistence + Elasticsearch) that requires operational investment
- Temporal's determinism constraints require understanding which APIs are safe to call inside workflows vs. activities

### Risks

- Temporal's TypeScript SDK is newer than its Go/Java SDKs and may have fewer production references at scale
- Mitigation: Pin SDK versions, run integration tests against Temporal's test server, and engage with the Temporal community for TypeScript-specific guidance

## Alternatives Considered

- **AWS Step Functions**: Rejected due to vendor lock-in, JSON-based workflow definitions (ASL) that are hard to test locally, and per-transition pricing that becomes expensive at scale
- **Custom state machines backed by PostgreSQL**: Rejected because hand-rolling workflow recovery, retry logic, and timer management is error-prone and produces significant accidental complexity
- **Apache Airflow**: Rejected because Airflow is designed for data pipeline DAGs, not interactive business workflows with signals, human approvals, and sub-second latency requirements
- **Inngest**: Rejected due to its SaaS-first model and limited self-hosting maturity; Temporal's self-hosted model provides full data sovereignty
