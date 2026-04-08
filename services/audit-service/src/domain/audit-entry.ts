/**
 * Resource types that can be audited across the Velya platform.
 */
export type AuditResourceType =
  | 'Patient'
  | 'Encounter'
  | 'DischargeBlocker'
  | 'Task'
  | 'Bed'
  | 'Ward'
  | 'User'
  | 'Policy'
  | 'Agent'
  | 'Configuration';

/**
 * Categories of auditable actions.
 */
export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'assign'
  | 'escalate'
  | 'approve'
  | 'reject'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'override'
  | 'ai-decision'
  | 'ai-suggestion-accepted'
  | 'ai-suggestion-rejected';

/**
 * Outcome of the audited action.
 */
export type AuditOutcome = 'success' | 'failure' | 'denied' | 'error';

/**
 * The actor who performed the audited action.
 * Supports human users, system processes, and AI agents.
 */
export interface AuditActor {
  /** Unique actor identifier (user ID, service name, or agent ID). */
  readonly id: string;

  /** Type of actor. */
  readonly type: AuditActorType;

  /** Human-readable display name. */
  readonly displayName: string;

  /** IP address or service endpoint, if available. */
  readonly ipAddress: string | null;

  /** User-agent or service identifier. */
  readonly userAgent: string | null;
}

export type AuditActorType = 'user' | 'service' | 'ai-agent' | 'system';

/**
 * Immutable audit entry recording a single auditable action.
 *
 * Audit entries are append-only and must never be modified or deleted.
 * They form the compliance backbone of the Velya platform, supporting
 * HIPAA audit trail requirements and operational transparency.
 */
export interface AuditEntry {
  /** Unique audit entry identifier. */
  readonly id: string;

  /** ISO-8601 timestamp of when the action occurred. */
  readonly timestamp: string;

  /** Who performed the action. */
  readonly actor: AuditActor;

  /** What action was performed. */
  readonly action: AuditAction;

  /** Type of resource affected. */
  readonly resourceType: AuditResourceType;

  /** Identifier of the specific resource affected. */
  readonly resourceId: string;

  /** Outcome of the action. */
  readonly outcome: AuditOutcome;

  /** State of the resource before the action, null for creates and reads. */
  readonly before: Readonly<Record<string, unknown>> | null;

  /** State of the resource after the action, null for reads and deletes. */
  readonly after: Readonly<Record<string, unknown>> | null;

  /** Human-readable summary of what changed. */
  readonly summary: string;

  /** Correlation ID linking this entry to a broader transaction or workflow. */
  readonly correlationId: string;

  /** Causation ID linking to the direct trigger of this action. */
  readonly causationId: string | null;

  /** Service that generated this audit entry. */
  readonly sourceService: string;

  /** Optional patient ID for HIPAA-relevant access logging. */
  readonly patientId: string | null;

  /** Session or request ID for tracing. */
  readonly sessionId: string | null;

  /** Additional context that doesn't fit structured fields. */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Filter criteria for querying audit entries.
 */
export interface AuditFilter {
  readonly actorId?: string;
  readonly actorType?: AuditActorType;
  readonly action?: AuditAction;
  readonly resourceType?: AuditResourceType;
  readonly resourceId?: string;
  readonly outcome?: AuditOutcome;
  readonly patientId?: string;
  readonly correlationId?: string;
  readonly sourceService?: string;
  readonly timestampAfter?: string;
  readonly timestampBefore?: string;
}

/**
 * Create an immutable audit entry with required fields.
 */
export function createAuditEntry(
  params: Omit<AuditEntry, 'id' | 'timestamp'> & {
    id?: string;
    timestamp?: string;
  },
): AuditEntry {
  return {
    id: params.id ?? crypto.randomUUID(),
    timestamp: params.timestamp ?? new Date().toISOString(),
    actor: params.actor,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    outcome: params.outcome,
    before: params.before,
    after: params.after,
    summary: params.summary,
    correlationId: params.correlationId,
    causationId: params.causationId,
    sourceService: params.sourceService,
    patientId: params.patientId,
    sessionId: params.sessionId,
    metadata: params.metadata,
  };
}
