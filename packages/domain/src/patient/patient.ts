import { Result, ok, err, DomainEvent, createDomainEvent } from '@velya/shared-kernel';
import { DischargeBlocker, DischargeBlockerCategory } from './discharge-blocker.js';

/**
 * FHIR-aligned patient administrative gender.
 */
export type AdministrativeGender = 'male' | 'female' | 'other' | 'unknown';

/**
 * Patient encounter status aligned with FHIR Encounter.status.
 */
export type EncounterStatus =
  | 'planned'
  | 'arrived'
  | 'in-progress'
  | 'on-leave'
  | 'finished'
  | 'cancelled';

/**
 * Patient acuity level for prioritization.
 */
export type AcuityLevel = 1 | 2 | 3 | 4 | 5;

/**
 * FHIR-aligned patient identifier.
 */
export interface PatientIdentifier {
  readonly system: string;
  readonly value: string;
}

/**
 * Patient entity representing a hospital inpatient.
 * Fields aligned with FHIR R4 Patient and Encounter resources.
 */
export interface Patient {
  readonly id: string;
  readonly mrn: string;
  readonly identifiers: ReadonlyArray<PatientIdentifier>;
  readonly givenName: string;
  readonly familyName: string;
  readonly dateOfBirth: string;
  readonly gender: AdministrativeGender;
  readonly encounterStatus: EncounterStatus;
  readonly admissionDate: string;
  readonly expectedDischargeDate: string | null;
  readonly actualDischargeDate: string | null;
  readonly ward: string;
  readonly bed: string;
  readonly attendingPhysicianId: string;
  readonly acuity: AcuityLevel;
  readonly dischargeBlockers: ReadonlyArray<DischargeBlocker>;
  readonly lengthOfStayDays: number;
}

/**
 * Create a new Patient record.
 */
export function createPatient(
  params: Omit<Patient, 'lengthOfStayDays' | 'actualDischargeDate' | 'dischargeBlockers' | 'encounterStatus'> & {
    encounterStatus?: EncounterStatus;
  },
): Result<Patient, string> {
  if (!params.mrn.trim()) {
    return err('Patient MRN is required');
  }
  if (!params.givenName.trim() || !params.familyName.trim()) {
    return err('Patient name is required');
  }

  const admissionDate = new Date(params.admissionDate);
  if (isNaN(admissionDate.getTime())) {
    return err('Invalid admission date');
  }

  const now = new Date();
  const losMs = now.getTime() - admissionDate.getTime();
  const lengthOfStayDays = Math.max(0, Math.floor(losMs / (1000 * 60 * 60 * 24)));

  return ok({
    ...params,
    encounterStatus: params.encounterStatus ?? 'in-progress',
    actualDischargeDate: null,
    dischargeBlockers: [],
    lengthOfStayDays,
  });
}

/**
 * Add a discharge blocker to a patient.
 */
export function addDischargeBlocker(
  patient: Patient,
  blocker: DischargeBlocker,
): Result<{ patient: Patient; event: DomainEvent }, string> {
  if (patient.encounterStatus === 'finished') {
    return err('Cannot add discharge blocker to a discharged patient');
  }

  const alreadyExists = patient.dischargeBlockers.some((b) => b.code === blocker.code);
  if (alreadyExists) {
    return err(`Discharge blocker "${blocker.code}" already exists`);
  }

  const updatedPatient: Patient = {
    ...patient,
    dischargeBlockers: [...patient.dischargeBlockers, blocker],
  };

  const event = createDomainEvent({
    eventType: 'patient.discharge-blocker.added',
    aggregateId: patient.id,
    aggregateType: 'Patient',
    payload: { blockerId: blocker.code, category: blocker.category },
  });

  return ok({ patient: updatedPatient, event });
}

/**
 * Resolve a discharge blocker on a patient.
 */
export function resolveDischargeBlocker(
  patient: Patient,
  blockerCode: string,
  resolvedBy: string,
): Result<{ patient: Patient; event: DomainEvent }, string> {
  const blockerIndex = patient.dischargeBlockers.findIndex((b) => b.code === blockerCode);
  if (blockerIndex === -1) {
    return err(`Discharge blocker "${blockerCode}" not found`);
  }

  const blocker = patient.dischargeBlockers[blockerIndex];
  const resolved: DischargeBlocker = {
    ...blocker,
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolvedBy,
  };

  const updatedBlockers = patient.dischargeBlockers.map((b, i) =>
    i === blockerIndex ? resolved : b,
  );

  const updatedPatient: Patient = {
    ...patient,
    dischargeBlockers: updatedBlockers,
  };

  const event = createDomainEvent({
    eventType: 'patient.discharge-blocker.resolved',
    aggregateId: patient.id,
    aggregateType: 'Patient',
    payload: { blockerCode, resolvedBy, category: blocker.category },
  });

  return ok({ patient: updatedPatient, event });
}

/**
 * Discharge a patient.
 */
export function dischargePatient(
  patient: Patient,
): Result<{ patient: Patient; event: DomainEvent }, string> {
  if (patient.encounterStatus === 'finished') {
    return err('Patient is already discharged');
  }

  const activeBlockers = patient.dischargeBlockers.filter((b) => b.status === 'active');
  if (activeBlockers.length > 0) {
    const blockerCodes = activeBlockers.map((b) => b.code).join(', ');
    return err(`Cannot discharge: active blockers remain [${blockerCodes}]`);
  }

  const now = new Date().toISOString();
  const updatedPatient: Patient = {
    ...patient,
    encounterStatus: 'finished',
    actualDischargeDate: now,
  };

  const event = createDomainEvent({
    eventType: 'patient.discharged',
    aggregateId: patient.id,
    aggregateType: 'Patient',
    payload: {
      dischargedAt: now,
      lengthOfStayDays: patient.lengthOfStayDays,
      ward: patient.ward,
    },
  });

  return ok({ patient: updatedPatient, event });
}
