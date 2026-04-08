/**
 * Categories of discharge blockers in hospital operations.
 */
export type DischargeBlockerCategory =
  | 'clinical'
  | 'social'
  | 'administrative'
  | 'therapy'
  | 'pharmacy'
  | 'transport'
  | 'placement';

/**
 * Severity of a discharge blocker.
 */
export type DischargeBlockerSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Status of a discharge blocker.
 */
export type DischargeBlockerStatus = 'active' | 'resolved' | 'escalated';

/**
 * DischargeBlocker value object representing an impediment to patient discharge.
 * Examples: pending lab results, awaiting social work consult, medication reconciliation.
 */
export interface DischargeBlocker {
  /** Machine-readable code, e.g. "PEND_LAB", "AWAIT_SNF_BED" */
  readonly code: string;

  /** Human-readable description of the blocker. */
  readonly description: string;

  /** Category for grouping and routing. */
  readonly category: DischargeBlockerCategory;

  /** Severity drives prioritization and escalation. */
  readonly severity: DischargeBlockerSeverity;

  /** Current status. */
  readonly status: DischargeBlockerStatus;

  /** Who or what identified this blocker (user ID, AI system, etc.). */
  readonly identifiedBy: string;

  /** ISO-8601 timestamp when the blocker was identified. */
  readonly identifiedAt: string;

  /** ISO-8601 timestamp when the blocker was resolved, if applicable. */
  readonly resolvedAt: string | null;

  /** Who resolved the blocker, if applicable. */
  readonly resolvedBy: string | null;

  /** Optional: ID of the assigned owner responsible for clearing this blocker. */
  readonly ownerId: string | null;

  /** Optional: estimated time to resolution in minutes. */
  readonly estimatedMinutesToResolve: number | null;
}

/**
 * Create a new active DischargeBlocker.
 */
export function createDischargeBlocker(
  params: Pick<
    DischargeBlocker,
    'code' | 'description' | 'category' | 'severity' | 'identifiedBy'
  > & {
    ownerId?: string;
    estimatedMinutesToResolve?: number;
  },
): DischargeBlocker {
  return {
    code: params.code,
    description: params.description,
    category: params.category,
    severity: params.severity,
    status: 'active',
    identifiedBy: params.identifiedBy,
    identifiedAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
    ownerId: params.ownerId ?? null,
    estimatedMinutesToResolve: params.estimatedMinutesToResolve ?? null,
  };
}

/**
 * Check if all blockers in a list are resolved.
 */
export function allBlockersResolved(blockers: ReadonlyArray<DischargeBlocker>): boolean {
  return blockers.every((b) => b.status === 'resolved');
}

/**
 * Get active blockers sorted by severity (critical first).
 */
export function getActiveBlockersBySeverity(
  blockers: ReadonlyArray<DischargeBlocker>,
): ReadonlyArray<DischargeBlocker> {
  const severityOrder: Record<DischargeBlockerSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return blockers
    .filter((b) => b.status === 'active')
    .slice()
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
