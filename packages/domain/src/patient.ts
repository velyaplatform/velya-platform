/**
 * Core Patient type aligned with FHIR R4 Patient resource.
 *
 * This is the canonical patient representation shared across all Velya services.
 * Fields map to FHIR Patient resource elements where applicable.
 * @see https://www.hl7.org/fhir/patient.html
 */

/**
 * FHIR-aligned patient administrative gender.
 * @see https://www.hl7.org/fhir/valueset-administrative-gender.html
 */
export type AdministrativeGender = 'male' | 'female' | 'other' | 'unknown';

/**
 * FHIR-aligned patient identifier with system namespace.
 * @see https://www.hl7.org/fhir/datatypes.html#Identifier
 */
export interface PatientIdentifier {
  /** The namespace for the identifier value (e.g., "http://hospital.org/mrn"). */
  readonly system: string;

  /** The value that is unique within the system. */
  readonly value: string;

  /** Type of identifier (e.g., "MR" for medical record number). */
  readonly type: IdentifierType;
}

/**
 * Common identifier types in hospital systems.
 */
export type IdentifierType =
  | 'MR'       // Medical Record Number
  | 'PI'       // Patient Internal Identifier
  | 'SS'       // Social Security Number (stored as reference, not value)
  | 'DL'       // Driver's License
  | 'PPN'      // Passport Number
  | 'PRN';     // Provider Number

/**
 * Patient contact information.
 */
export interface PatientContact {
  /** Relationship to the patient (e.g., "spouse", "parent", "emergency"). */
  readonly relationship: string;

  /** Contact person's name. */
  readonly name: string;

  /** Phone number. */
  readonly phone: string | null;

  /** Email address. */
  readonly email: string | null;
}

/**
 * FHIR-aligned human name structure.
 * @see https://www.hl7.org/fhir/datatypes.html#HumanName
 */
export interface HumanName {
  /** Given (first) name(s). */
  readonly given: ReadonlyArray<string>;

  /** Family (last) name. */
  readonly family: string;

  /** Name prefix(es) (e.g., "Dr.", "Mr."). */
  readonly prefix: ReadonlyArray<string>;

  /** Name suffix(es) (e.g., "Jr.", "III"). */
  readonly suffix: ReadonlyArray<string>;
}

/**
 * Patient address.
 */
export interface PatientAddress {
  readonly line: ReadonlyArray<string>;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
}

/**
 * Core Patient entity representing a person receiving healthcare services.
 *
 * This type is intentionally read-only (immutable) to support functional
 * domain modeling where updates produce new instances.
 */
export interface Patient {
  /** FHIR resource ID. */
  readonly id: string;

  /** Medical Record Number -- primary operational identifier. */
  readonly mrn: string;

  /** All identifiers (MRN, insurance IDs, etc.). */
  readonly identifiers: ReadonlyArray<PatientIdentifier>;

  /** Patient's name. */
  readonly name: HumanName;

  /** ISO-8601 date of birth (YYYY-MM-DD). */
  readonly dateOfBirth: string;

  /** Administrative gender. */
  readonly gender: AdministrativeGender;

  /** Primary language (BCP-47 code, e.g., "en", "es"). */
  readonly primaryLanguage: string;

  /** Patient's address. */
  readonly address: PatientAddress | null;

  /** Primary phone number. */
  readonly phone: string | null;

  /** Email address. */
  readonly email: string | null;

  /** Emergency and next-of-kin contacts. */
  readonly contacts: ReadonlyArray<PatientContact>;

  /** Whether the patient record is active. */
  readonly active: boolean;

  /** ISO-8601 date of death, if deceased. */
  readonly deceasedDate: string | null;

  /** ISO-8601 creation timestamp. */
  readonly createdAt: string;

  /** ISO-8601 last update timestamp. */
  readonly updatedAt: string;
}

/**
 * Format a patient's full display name.
 */
export function formatPatientName(name: HumanName): string {
  const parts: string[] = [];

  if (name.prefix.length > 0) {
    parts.push(name.prefix.join(' '));
  }

  parts.push(...name.given);
  parts.push(name.family);

  if (name.suffix.length > 0) {
    parts.push(name.suffix.join(' '));
  }

  return parts.join(' ');
}

/**
 * Calculate patient age in years from date of birth.
 */
export function calculateAge(dateOfBirth: string, asOfDate?: string): number {
  const dob = new Date(dateOfBirth);
  const reference = asOfDate ? new Date(asOfDate) : new Date();

  let age = reference.getFullYear() - dob.getFullYear();
  const monthDiff = reference.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < dob.getDate())) {
    age--;
  }

  return Math.max(0, age);
}
