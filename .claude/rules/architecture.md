# Architecture Rules

## Cluster Topology

- **Two-cluster architecture**:
  - **App cluster**: Core hospital platform services (clinical, billing, scheduling, pharmacy).
  - **AI/Agents cluster**: AI inference, agent execution, ML pipelines, vector databases.
- Clusters communicate via NATS JetStream (cross-cluster replication).
- Shared services (auth, observability, secrets) run on the app cluster.
- AI cluster scales independently based on inference workload.

## AI Abstraction Layer

- **AI abstraction layer is mandatory.** No service calls LLM APIs directly.
- All AI access goes through `packages/ai-gateway/`, which handles:
  - Provider routing (Anthropic, OpenAI, local models)
  - Rate limiting and cost tracking
  - Request/response logging (with PHI redaction)
  - Fallback and retry logic
  - Model version pinning
- Services depend on the abstraction, never on a specific provider SDK.

## Event-Driven Architecture

- **NATS JetStream** is the event backbone.
- All domain events are published to NATS. Services react to events, not direct calls.
- Subject hierarchy: `{domain}.{entity}.{event}` (e.g., `clinical.patient.admitted`).
- Use durable consumers with explicit ack. No auto-ack in production.
- Events are immutable. Never modify a published event.
- Event schemas are defined in `packages/event-schemas/` and versioned.
- Dead letter queues for failed message processing.

## Durable Workflows

- **Temporal** manages long-running and multi-step workflows.
- Use cases: patient discharge, insurance pre-auth, medication reconciliation, agent orchestration.
- Workflows must be deterministic. No side effects in workflow code.
- Activities handle all I/O (API calls, database writes, notifications).
- Set timeouts on every activity. No unbounded waits.
- Temporal namespace per environment: `velya-dev`, `velya-staging`, `velya-prod`.

## FHIR-First Data Model

- **Medplum** is the FHIR server and clinical data store.
- Clinical data is modeled as FHIR R4 resources first. Custom schemas only when FHIR has no coverage.
- Use FHIR Subscriptions for real-time change notifications.
- Medplum Bots handle server-side clinical logic.
- Non-clinical services (billing, scheduling) may use PostgreSQL directly.
- FHIR resources are the source of truth for clinical data. No shadow copies.

## Integration Patterns

- **Anti-corruption layer (ACL) mandatory** for all external system integrations.
- ACLs live in `services/integrations/{system-name}/`.
- External data models are translated to internal domain models at the boundary.
- No external system's data model leaks into core domain services.
- ACLs handle: data mapping, error translation, retry logic, circuit breaking.

## Resilience

- **Idempotency required** on all write operations and event handlers.
  - Use idempotency keys for API endpoints.
  - Use NATS message deduplication for event processing.
  - Database upserts with conflict resolution where appropriate.
- **Circuit breakers** for all external service calls.
  - Open after 5 consecutive failures (configurable).
  - Half-open after 30 seconds. Close after 3 successes.
  - Fallback behavior defined for every circuit.
- **Retry with exponential backoff** for transient failures. Max 3 retries.
- **Timeouts** on every outbound call. No unbounded waits. Default: 5s for internal, 30s for external.

## Observability

- **Structured logging only.** JSON format. No `console.log` in production code.
- Every log line includes: `traceId`, `spanId`, `service`, `environment`, `level`, `message`.
- **OpenTelemetry** for traces, metrics, and logs.
  - Traces: instrument all inbound/outbound HTTP, gRPC, NATS, and database calls.
  - Metrics: RED (Rate, Errors, Duration) for every service.
  - Logs: correlated with trace context.
- Dashboards per service in Grafana. Alerts for SLO violations.
- Distributed tracing across service boundaries, including through NATS and Temporal.

## Architectural Decision Records

- **Every significant architectural decision gets an ADR.**
- ADRs live in `docs/architecture/decisions/`.
- Format: `NNNN-title-of-decision.md` (e.g., `0001-use-nats-for-event-backbone.md`).
- ADR content: Status, Context, Decision, Consequences.
- Status lifecycle: `proposed --> accepted --> deprecated --> superseded`.
- Reference the ADR number in related PRs and code comments.

## Prohibited Practices

- No synchronous chains longer than 3 services. Use events or workflows.
- No shared databases between services. Each service owns its data.
- No direct database access from frontend applications.
- No business logic in API gateway or ingress layer.
- No polling when event-driven alternatives exist.
