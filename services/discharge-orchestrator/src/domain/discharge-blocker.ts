/**
 * Fine-grained blocker categories for discharge orchestration.
 * Each category maps to a specific clinical or operational workflow.
 */
export type BlockerCategory =
  | 'clinical-clearance'
  | 'pending-labs'
  | 'pending-imaging'
  | 'authorization'
  | 'social-work'
  | 'pharmacy'
  | 'equipment'
  | 'transport'
  | 'family-education'
  | 'follow-up-appointment'
  | 'insurance'
  | 'other';

/**
 * Priority determines escalation cadence and notification urgency.
 */
export type BlockerPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Blocker lifecycle status.
 */
export type BlockerStatus = 'identified' | 'in-progress' | 'resolved' | 'escalated' | 'cancelled';

/**
 * Audit trail entry recording a state change on a discharge blocker.
 */
export interface BlockerAuditEntry {
  /** Unique ID for this audit entry. */
  readonly id: string;

  /** ISO-8601 timestamp of the action. */
  readonly timestamp: string;

  /** User or system that performed the action. */
  readonly actor: string;

  /** Action taken (e.g., "status_changed", "reassigned", "note_added"). */
  readonly action: BlockerAuditAction;

  /** Previous value, if applicable. */
  readonly previousValue: string | null;

  /** New value, if applicable. */
  readonly newValue: string | null;

  /** Optional note or rationale. */
  readonly note: string | null;
}

/**
 * Enumerated audit actions for discharge blockers.
 */
export type BlockerAuditAction =
  | 'created'
  | 'status_changed'
  | 'priority_changed'
  | 'reassigned'
  | 'escalated'
  | 'note_added'
  | 'sla_extended'
  | 'resolved'
  | 'cancelled';

/**
 * Discharge blocker entity representing a specific impediment to
 * a patient's discharge. Managed by the discharge orchestrator to
 * coordinate multi-team resolution workflows.
 */
export interface DischargeBlocker {
  /** Unique blocker identifier. */
  readonly id: string;

  /** Encounter this blocker is associated with. */
  readonly encounterId: string;

  /** Patient this blocker relates to. */
  readonly patientId: string;

  /** Operational category for routing and reporting. */
  readonly category: BlockerCategory;

  /** Human-readable description of the impediment. */
  readonly description: string;

  /** Priority determines escalation urgency. */
  readonly priority: BlockerPriority;

  /** Current lifecycle status. */
  readonly status: BlockerStatus;

  /** User ID of the person assigned to resolve this blocker. */
  readonly assignedTo: string;

  /** Team responsible for resolution. */
  readonly assignedTeam: string;

  /** ISO-8601 creation timestamp. */
  readonly createdAt: string;

  /** ISO-8601 last update timestamp. */
  readonly updatedAt: string;

  /** ISO-8601 resolution timestamp, null if unresolved. */
  readonly resolvedAt: string | null;

  /** ISO-8601 SLA deadline for resolution. */
  readonly slaDeadline: string;

  /** Whether the blocker has exceeded its SLA deadline. */
  readonly isOverdue: boolean;

  /** AI-suggested next action for resolution. */
  readonly suggestedAction: string | null;

  /** Confidence score (0-1) for the AI suggestion. */
  readonly aiConfidence: number | null;

  /** Full audit trail of actions taken on this blocker. */
  readonly auditTrail: ReadonlyArray<BlockerAuditEntry>;
}

/**
 * Summary statistics for discharge blockers across a department or hospital.
 */
export interface BlockerSummary {
  /** Total number of active (non-resolved, non-cancelled) blockers. */
  readonly totalActive: number;

  /** Number of blockers that are overdue. */
  readonly totalOverdue: number;

  /** Number of blockers in escalated status. */
  readonly totalEscalated: number;

  /** Breakdown of active blockers by category. */
  readonly byCategory: Readonly<Record<BlockerCategory, number>>;

  /** Breakdown of active blockers by priority. */
  readonly byPriority: Readonly<Record<BlockerPriority, number>>;

  /** Average time to resolution in minutes (for resolved blockers). */
  readonly averageResolutionMinutes: number | null;

  /** ISO-8601 timestamp when this summary was computed. */
  readonly computedAt: string;
}

/**
 * Compute whether a blocker is overdue based on its SLA deadline.
 */
export function isBlockerOverdue(blocker: DischargeBlocker): boolean {
  if (blocker.status === 'resolved' || blocker.status === 'cancelled') {
    return false;
  }
  return new Date(blocker.slaDeadline).getTime() < Date.now();
}

/**
 * Compute resolution duration in minutes for a resolved blocker.
 * Returns null if the blocker is not yet resolved.
 */
export function computeResolutionMinutes(blocker: DischargeBlocker): number | null {
  if (!blocker.resolvedAt) return null;

  const created = new Date(blocker.createdAt).getTime();
  const resolved = new Date(blocker.resolvedAt).getTime();

  return Math.max(0, Math.round((resolved - created) / (1000 * 60)));
}

/**
 * Default SLA deadlines (in minutes) by blocker category.
 * Used when no explicit SLA is provided.
 */
export const DEFAULT_SLA_MINUTES: Readonly<Record<BlockerCategory, number>> = {
  'clinical-clearance': 120,
  'pending-labs': 180,
  'pending-imaging': 240,
  authorization: 480,
  'social-work': 360,
  pharmacy: 120,
  equipment: 240,
  transport: 120,
  'family-education': 180,
  'follow-up-appointment': 240,
  insurance: 480,
  other: 360,
};
