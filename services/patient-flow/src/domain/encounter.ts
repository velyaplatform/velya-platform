/**
 * Encounter status aligned with FHIR Encounter.status, tailored for
 * hospital operational workflows (admission through discharge).
 */
export type EncounterStatus = 'planned' | 'in-progress' | 'on-hold' | 'discharged' | 'cancelled';

/**
 * Patient acuity level used for operational prioritization and
 * resource allocation decisions.
 */
export type AcuityLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Operational risk level computed from discharge readiness signals,
 * length of stay, and pending items.
 */
export type OperationalRiskLevel = 'low' | 'moderate' | 'high' | 'very-high';

/**
 * A pending item that must be completed before discharge can proceed.
 * Tracks actionable work tied to an encounter.
 */
export interface PendingItem {
  /** Unique identifier for this pending item. */
  readonly id: string;

  /** Human-readable description of what is pending. */
  readonly description: string;

  /** Category for routing and reporting. */
  readonly category: PendingItemCategory;

  /** Who or which team is responsible for clearing this item. */
  readonly assignedTo: string;

  /** Whether the item has been completed. */
  readonly isCompleted: boolean;

  /** ISO-8601 timestamp when the item was identified. */
  readonly createdAt: string;

  /** ISO-8601 timestamp when the item was completed, if applicable. */
  readonly completedAt: string | null;

  /** Optional SLA deadline for completion. */
  readonly slaDeadline: string | null;
}

/**
 * Categories of pending items in the discharge pipeline.
 */
export type PendingItemCategory =
  | 'lab-results'
  | 'imaging'
  | 'medication-reconciliation'
  | 'clinical-documentation'
  | 'consult'
  | 'procedure'
  | 'patient-education'
  | 'other';

/**
 * A discharge blocker represents a significant impediment to patient discharge.
 * More critical than a pending item -- blockers require escalation workflows.
 */
export interface DischargeBlocker {
  /** Unique identifier for this blocker. */
  readonly id: string;

  /** Machine-readable blocker code (e.g., "AWAIT_SNF_BED"). */
  readonly code: string;

  /** Human-readable description. */
  readonly description: string;

  /** Severity determines escalation priority. */
  readonly severity: DischargeBlockerSeverity;

  /** Current resolution status. */
  readonly status: DischargeBlockerStatus;

  /** Who or which team is responsible for clearing this blocker. */
  readonly ownerId: string | null;

  /** ISO-8601 timestamp when the blocker was identified. */
  readonly identifiedAt: string;

  /** ISO-8601 timestamp when the blocker was resolved, if applicable. */
  readonly resolvedAt: string | null;

  /** Estimated minutes to resolution, updated as work progresses. */
  readonly estimatedMinutesToResolve: number | null;
}

export type DischargeBlockerSeverity = 'critical' | 'high' | 'medium' | 'low';
export type DischargeBlockerStatus = 'active' | 'in-progress' | 'resolved' | 'escalated';

/**
 * Encounter entity representing a patient's hospital stay.
 *
 * This is the central aggregate for the patient-flow service. It tracks
 * admission, bed assignment, pending work, discharge blockers, and
 * operational risk -- providing the data needed for the command center
 * and discharge readiness views.
 */
export interface Encounter {
  /** Unique encounter identifier. */
  readonly id: string;

  /** Reference to the patient (MRN or FHIR Patient resource ID). */
  readonly patientId: string;

  /** Current encounter status. */
  readonly status: EncounterStatus;

  /** ISO-8601 admission timestamp. */
  readonly admissionDate: string;

  /** ISO-8601 expected discharge date, set by care team. */
  readonly expectedDischargeDate: string | null;

  /** ISO-8601 actual discharge timestamp. */
  readonly actualDischargeDate: string | null;

  /** Department or unit where the patient is located. */
  readonly department: string;

  /** Assigned bed identifier, null if not yet assigned. */
  readonly bed: string | null;

  /** Attending physician's user ID. */
  readonly attendingPhysicianId: string;

  /** Patient acuity level for triage and prioritization. */
  readonly acuityLevel: AcuityLevel;

  /** Computed length of stay in days. */
  readonly lengthOfStayDays: number;

  /** Items that must be completed before discharge. */
  readonly pendingItems: ReadonlyArray<PendingItem>;

  /** Critical blockers preventing discharge. */
  readonly dischargeBlockers: ReadonlyArray<DischargeBlocker>;

  /** Computed operational risk based on LOS, blockers, and pending items. */
  readonly operationalRisk: OperationalRiskLevel;

  /** ISO-8601 timestamp of last update. */
  readonly lastUpdated: string;

  /** ISO-8601 timestamp of encounter creation. */
  readonly createdAt: string;
}

/**
 * Compute operational risk level based on encounter state.
 *
 * Risk factors:
 *  - Length of stay exceeding expected discharge date
 *  - Number and severity of active discharge blockers
 *  - Overdue pending items
 */
export function computeOperationalRisk(encounter: Encounter): OperationalRiskLevel {
  let riskScore = 0;

  // LOS beyond expected discharge date
  if (encounter.expectedDischargeDate) {
    const expected = new Date(encounter.expectedDischargeDate).getTime();
    const now = Date.now();
    if (now > expected) {
      const overdueDays = Math.floor((now - expected) / (1000 * 60 * 60 * 24));
      riskScore += Math.min(overdueDays * 2, 10);
    }
  }

  // Active discharge blockers
  const activeBlockers = encounter.dischargeBlockers.filter(
    (b) => b.status === 'active' || b.status === 'escalated',
  );
  for (const blocker of activeBlockers) {
    switch (blocker.severity) {
      case 'critical':
        riskScore += 4;
        break;
      case 'high':
        riskScore += 3;
        break;
      case 'medium':
        riskScore += 2;
        break;
      case 'low':
        riskScore += 1;
        break;
    }
  }

  // Overdue pending items
  const now = Date.now();
  const overdueItems = encounter.pendingItems.filter(
    (item) => !item.isCompleted && item.slaDeadline && new Date(item.slaDeadline).getTime() < now,
  );
  riskScore += overdueItems.length;

  // Acuity multiplier
  if (encounter.acuityLevel === 'critical') {
    riskScore += 3;
  } else if (encounter.acuityLevel === 'high') {
    riskScore += 1;
  }

  if (riskScore >= 10) return 'very-high';
  if (riskScore >= 6) return 'high';
  if (riskScore >= 3) return 'moderate';
  return 'low';
}
