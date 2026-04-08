/**
 * Base interface for all domain events in the Velya platform.
 * Domain events represent something meaningful that happened in the domain.
 */
export interface DomainEvent<TPayload = unknown> {
  /** Unique identifier for this event instance. */
  readonly eventId: string;

  /** Fully-qualified event type, e.g. "patient.discharged" */
  readonly eventType: string;

  /** ISO-8601 timestamp of when the event occurred. */
  readonly occurredAt: string;

  /** Aggregate ID that produced this event. */
  readonly aggregateId: string;

  /** Aggregate type (e.g. "Patient", "Task"). */
  readonly aggregateType: string;

  /** Event-specific payload. */
  readonly payload: TPayload;

  /** Optional correlation ID for tracing across services. */
  readonly correlationId?: string;

  /** Optional causation ID linking to the command/event that caused this. */
  readonly causationId?: string;
}

/**
 * Helper to create a DomainEvent with sensible defaults.
 */
export function createDomainEvent<TPayload>(
  params: Omit<DomainEvent<TPayload>, 'eventId' | 'occurredAt'> & {
    eventId?: string;
    occurredAt?: string;
  },
): DomainEvent<TPayload> {
  return {
    eventId: params.eventId ?? crypto.randomUUID(),
    occurredAt: params.occurredAt ?? new Date().toISOString(),
    eventType: params.eventType,
    aggregateId: params.aggregateId,
    aggregateType: params.aggregateType,
    payload: params.payload,
    correlationId: params.correlationId,
    causationId: params.causationId,
  };
}

/**
 * Interface for entities that collect domain events.
 */
export interface EventSourcedEntity {
  readonly domainEvents: ReadonlyArray<DomainEvent>;
  clearEvents(): void;
}
