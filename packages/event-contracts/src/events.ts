import type { DomainEvent } from '@velya/shared-kernel';

// ---------------------------------------------------------------------------
// Patient Events
// ---------------------------------------------------------------------------

/**
 * Payload for when a patient is admitted to the hospital.
 */
export interface PatientAdmittedPayload {
  readonly patientId: string;
  readonly mrn: string;
  readonly encounterId: string;
  readonly department: string;
  readonly ward: string;
  readonly bed: string | null;
  readonly attendingPhysicianId: string;
  readonly acuityLevel: string;
  readonly admissionDate: string;
  readonly expectedDischargeDate: string | null;
  readonly admissionSource: AdmissionSource;
}

export type AdmissionSource =
  | 'emergency'
  | 'elective'
  | 'transfer'
  | 'observation-conversion'
  | 'direct-admit';

export type PatientAdmittedEvent = DomainEvent<PatientAdmittedPayload>;

/**
 * Payload for when a patient is discharged from the hospital.
 */
export interface PatientDischargedPayload {
  readonly patientId: string;
  readonly mrn: string;
  readonly encounterId: string;
  readonly department: string;
  readonly ward: string;
  readonly dischargedAt: string;
  readonly lengthOfStayDays: number;
  readonly dischargeDisposition: DischargeDisposition;
  readonly dischargedBy: string;
}

export type DischargeDisposition =
  | 'home'
  | 'home-health'
  | 'skilled-nursing'
  | 'rehab'
  | 'long-term-care'
  | 'hospice'
  | 'transfer'
  | 'against-medical-advice'
  | 'expired'
  | 'other';

export type PatientDischargedEvent = DomainEvent<PatientDischargedPayload>;

// ---------------------------------------------------------------------------
// Discharge Blocker Events
// ---------------------------------------------------------------------------

/**
 * Payload for when a new discharge blocker is created.
 */
export interface DischargeBlockerCreatedPayload {
  readonly blockerId: string;
  readonly encounterId: string;
  readonly patientId: string;
  readonly category: string;
  readonly priority: string;
  readonly description: string;
  readonly assignedTo: string;
  readonly assignedTeam: string;
  readonly slaDeadline: string;
}

export type DischargeBlockerCreatedEvent = DomainEvent<DischargeBlockerCreatedPayload>;

/**
 * Payload for when a discharge blocker is resolved.
 */
export interface DischargeBlockerResolvedPayload {
  readonly blockerId: string;
  readonly encounterId: string;
  readonly patientId: string;
  readonly category: string;
  readonly resolvedBy: string;
  readonly resolvedAt: string;
  readonly resolutionMinutes: number;
  readonly wasOverdue: boolean;
}

export type DischargeBlockerResolvedEvent = DomainEvent<DischargeBlockerResolvedPayload>;

// ---------------------------------------------------------------------------
// Task Events
// ---------------------------------------------------------------------------

/**
 * Payload for when a new task is created.
 */
export interface TaskCreatedPayload {
  readonly taskId: string;
  readonly title: string;
  readonly category: string;
  readonly priority: string;
  readonly source: string;
  readonly assignedTo: string;
  readonly assignedTeam: string;
  readonly patientId: string | null;
  readonly encounterId: string | null;
  readonly createdBy: string;
  readonly dueDate: string | null;
  readonly slaMinutes: number | null;
}

export type TaskCreatedEvent = DomainEvent<TaskCreatedPayload>;

/**
 * Payload for when a task is completed.
 */
export interface TaskCompletedPayload {
  readonly taskId: string;
  readonly title: string;
  readonly category: string;
  readonly completedBy: string;
  readonly completedAt: string;
  readonly patientId: string | null;
  readonly encounterId: string | null;
  readonly wasOverdue: boolean;
  readonly durationMinutes: number;
}

export type TaskCompletedEvent = DomainEvent<TaskCompletedPayload>;

/**
 * Payload for when a task is escalated.
 */
export interface TaskEscalatedPayload {
  readonly taskId: string;
  readonly title: string;
  readonly category: string;
  readonly previousAssignee: string;
  readonly previousTeam: string;
  readonly escalatedTo: string;
  readonly escalatedTeam: string;
  readonly escalatedBy: string;
  readonly reason: string;
  readonly patientId: string | null;
  readonly encounterId: string | null;
}

export type TaskEscalatedEvent = DomainEvent<TaskEscalatedPayload>;

// ---------------------------------------------------------------------------
// Bed Management Events
// ---------------------------------------------------------------------------

/**
 * Payload for when a bed is assigned to a patient.
 */
export interface BedAssignedPayload {
  readonly bedId: string;
  readonly wardId: string;
  readonly room: string;
  readonly patientId: string;
  readonly encounterId: string;
  readonly previousBedId: string | null;
  readonly assignedBy: string;
  readonly assignedAt: string;
}

export type BedAssignedEvent = DomainEvent<BedAssignedPayload>;

/**
 * Payload for when a bed is released (patient discharged or transferred).
 */
export interface BedReleasedPayload {
  readonly bedId: string;
  readonly wardId: string;
  readonly room: string;
  readonly previousPatientId: string;
  readonly previousEncounterId: string;
  readonly reason: BedReleaseReason;
  readonly releasedAt: string;
  readonly requiresCleaning: boolean;
}

export type BedReleaseReason = 'discharge' | 'transfer' | 'death' | 'administrative';

export type BedReleasedEvent = DomainEvent<BedReleasedPayload>;

// ---------------------------------------------------------------------------
// Event Type Constants
// ---------------------------------------------------------------------------

/**
 * Canonical event type strings for use in event handlers and subscriptions.
 * These are the fully-qualified event type identifiers used in the
 * DomainEvent.eventType field.
 */
export const EVENT_TYPES = {
  PATIENT_ADMITTED: 'patient.admitted',
  PATIENT_DISCHARGED: 'patient.discharged',
  DISCHARGE_BLOCKER_CREATED: 'discharge-blocker.created',
  DISCHARGE_BLOCKER_RESOLVED: 'discharge-blocker.resolved',
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  TASK_ESCALATED: 'task.escalated',
  BED_ASSIGNED: 'bed.assigned',
  BED_RELEASED: 'bed.released',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// ---------------------------------------------------------------------------
// Event Subject Mapping (for NATS JetStream subjects)
// ---------------------------------------------------------------------------

/**
 * NATS JetStream subject mapping for domain events.
 * Subject format: velya.{domain}.{action}
 */
export const EVENT_SUBJECTS: Readonly<Record<EventType, string>> = {
  [EVENT_TYPES.PATIENT_ADMITTED]: 'velya.patient.admitted',
  [EVENT_TYPES.PATIENT_DISCHARGED]: 'velya.patient.discharged',
  [EVENT_TYPES.DISCHARGE_BLOCKER_CREATED]: 'velya.discharge.blocker-created',
  [EVENT_TYPES.DISCHARGE_BLOCKER_RESOLVED]: 'velya.discharge.blocker-resolved',
  [EVENT_TYPES.TASK_CREATED]: 'velya.task.created',
  [EVENT_TYPES.TASK_COMPLETED]: 'velya.task.completed',
  [EVENT_TYPES.TASK_ESCALATED]: 'velya.task.escalated',
  [EVENT_TYPES.BED_ASSIGNED]: 'velya.bed.assigned',
  [EVENT_TYPES.BED_RELEASED]: 'velya.bed.released',
};
