/**
 * Bed occupancy status within a hospital ward.
 */
export type BedStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'cleaning'
  | 'maintenance'
  | 'blocked';

/**
 * Isolation requirements for a bed or patient.
 */
export type IsolationType =
  | 'none'
  | 'contact'
  | 'droplet'
  | 'airborne'
  | 'protective';

/**
 * A single bed within a hospital ward.
 */
export interface Bed {
  /** Unique bed identifier (e.g., "4N-201A"). */
  readonly id: string;

  /** Ward this bed belongs to. */
  readonly wardId: string;

  /** Room number or identifier. */
  readonly room: string;

  /** Current occupancy status. */
  readonly status: BedStatus;

  /** Patient ID of the current occupant, null if empty. */
  readonly patientId: string | null;

  /** Encounter ID for the current occupant, null if empty. */
  readonly encounterId: string | null;

  /** Type of bed (e.g., ICU, telemetry, med-surg, observation). */
  readonly bedType: BedType;

  /** Isolation requirement currently in effect. */
  readonly isolation: IsolationType;

  /** Whether the bed has a monitoring station. */
  readonly hasMonitoring: boolean;

  /** ISO-8601 timestamp of last status change. */
  readonly lastStatusChange: string;

  /** Free-form notes (e.g., "near nursing station"). */
  readonly notes: string | null;
}

/**
 * Classification of bed by capability level.
 */
export type BedType =
  | 'icu'
  | 'step-down'
  | 'telemetry'
  | 'med-surg'
  | 'observation'
  | 'pediatric'
  | 'labor-delivery'
  | 'nicu'
  | 'psych';

/**
 * A hospital ward (unit/floor) containing beds.
 */
export interface Ward {
  /** Unique ward identifier (e.g., "4N", "ICU-A"). */
  readonly id: string;

  /** Human-readable ward name. */
  readonly name: string;

  /** Department this ward belongs to. */
  readonly department: string;

  /** Floor or building location. */
  readonly floor: string;

  /** Total bed capacity. */
  readonly totalBeds: number;

  /** Primary bed type for this ward. */
  readonly primaryBedType: BedType;

  /** Nurse-to-patient ratio target for this ward. */
  readonly targetNursePatientRatio: number;

  /** Whether the ward is currently accepting new patients. */
  readonly acceptingAdmissions: boolean;

  /** Contact information for the charge nurse. */
  readonly chargeNurseId: string | null;
}

/**
 * Real-time census snapshot for a ward.
 */
export interface WardCensus {
  /** Ward identifier. */
  readonly wardId: string;

  /** Ward display name. */
  readonly wardName: string;

  /** Department. */
  readonly department: string;

  /** Total bed capacity. */
  readonly totalBeds: number;

  /** Currently occupied beds. */
  readonly occupiedBeds: number;

  /** Available (ready for admission) beds. */
  readonly availableBeds: number;

  /** Beds being cleaned or prepared. */
  readonly pendingBeds: number;

  /** Beds blocked or under maintenance. */
  readonly blockedBeds: number;

  /** Occupancy rate as a decimal (0-1). */
  readonly occupancyRate: number;

  /** Number of patients expected to discharge today. */
  readonly expectedDischargesToday: number;

  /** Number of pending admissions. */
  readonly pendingAdmissions: number;

  /** ISO-8601 timestamp when this snapshot was computed. */
  readonly computedAt: string;
}

/**
 * Hospital-wide census summary aggregated across all wards.
 */
export interface HospitalCensus {
  /** Total bed capacity hospital-wide. */
  readonly totalBeds: number;

  /** Total occupied beds. */
  readonly occupiedBeds: number;

  /** Total available beds. */
  readonly availableBeds: number;

  /** Overall occupancy rate as a decimal (0-1). */
  readonly occupancyRate: number;

  /** Per-ward census breakdowns. */
  readonly wardCensuses: ReadonlyArray<WardCensus>;

  /** Total expected discharges today. */
  readonly expectedDischargesToday: number;

  /** Total pending admissions. */
  readonly pendingAdmissions: number;

  /** ISO-8601 timestamp when this snapshot was computed. */
  readonly computedAt: string;
}

/**
 * Compute occupancy rate, clamped between 0 and 1.
 */
export function computeOccupancyRate(occupied: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, occupied / total));
}
