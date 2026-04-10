/**
 * Centralized patient fixtures.
 *
 * Single source of truth for the demo data shown across the dashboard,
 * /patients, /tasks, /discharge, /beds, /surgery, /icu, /pharmacy, /ems pages.
 *
 * Pages MUST import from here. The CI duplication-gate enforces that no MRN
 * literal is duplicated across page files outside of this directory.
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface PatientRecord {
  mrn: string;
  name: string;
  age: number;
  sex: 'M' | 'F';
  bloodType?: string;
  ward: string;
  bed?: string;
  admissionDate: string;
  daysAdmitted: number;
  diagnosis: string;
  attendingPhysician: string;
  risk: RiskLevel;
  /** discharge planning state */
  dischargeStatus: 'pending' | 'planned' | 'blocked' | 'ready' | 'discharged';
  blockers?: string[];
  allergies?: string[];
}

export const PATIENTS: PatientRecord[] = [
  {
    mrn: 'MRN-001',
    name: 'Ana Beatriz Santos',
    age: 42,
    sex: 'F',
    bloodType: 'O+',
    ward: 'Ala 2A',
    bed: '2A-04',
    admissionDate: '2026-04-04',
    daysAdmitted: 6,
    diagnosis: 'Pneumonia comunitária',
    attendingPhysician: 'Dr. Carlos Lima',
    risk: 'medium',
    dischargeStatus: 'planned',
    allergies: [],
  },
  {
    mrn: 'MRN-002',
    name: 'Sarah Mitchell',
    age: 58,
    sex: 'F',
    bloodType: 'A+',
    ward: 'Ala 3B',
    bed: '3B-01',
    admissionDate: '2026-04-04',
    daysAdmitted: 6,
    diagnosis: 'Colecistectomia eletiva',
    attendingPhysician: 'Dra. Patricia Reis',
    risk: 'low',
    dischargeStatus: 'ready',
  },
  {
    mrn: 'MRN-003',
    name: 'Roberto Vargas',
    age: 67,
    sex: 'M',
    bloodType: 'B+',
    ward: 'Ala 1D',
    bed: '1D-08',
    admissionDate: '2026-04-06',
    daysAdmitted: 4,
    diagnosis: 'DPOC exacerbada',
    attendingPhysician: 'Dr. Carlos Lima',
    risk: 'high',
    dischargeStatus: 'pending',
  },
  {
    mrn: 'MRN-004',
    name: 'Eleanor Voss',
    age: 71,
    sex: 'F',
    bloodType: 'O-',
    ward: 'Ala 2A',
    bed: '2A-12',
    admissionDate: '2026-04-01',
    daysAdmitted: 9,
    diagnosis: 'AVC isquêmico — pós-trombólise',
    attendingPhysician: 'Dra. Helena Rocha',
    risk: 'critical',
    dischargeStatus: 'blocked',
    blockers: ['Transporte', 'Documentação'],
  },
  {
    mrn: 'MRN-006',
    name: 'Lucas Fernandes',
    age: 34,
    sex: 'M',
    bloodType: 'AB+',
    ward: 'Ala 3B',
    bed: '3B-09',
    admissionDate: '2026-04-08',
    daysAdmitted: 2,
    diagnosis: 'Pancreatite aguda',
    attendingPhysician: 'Dr. Marcio Tavares',
    risk: 'high',
    dischargeStatus: 'pending',
  },
  {
    mrn: 'MRN-007',
    name: 'Marcus Bell',
    age: 62,
    sex: 'M',
    bloodType: 'A-',
    ward: 'Ala 4C',
    bed: '4C-03',
    admissionDate: '2026-03-29',
    daysAdmitted: 12,
    diagnosis: 'Insuficiência cardíaca descompensada',
    attendingPhysician: 'Dra. Helena Rocha',
    risk: 'high',
    dischargeStatus: 'blocked',
    blockers: ['Plano de Saúde'],
  },
  {
    mrn: 'MRN-009',
    name: 'Yara Nogueira',
    age: 28,
    sex: 'F',
    bloodType: 'O+',
    ward: 'Maternidade',
    bed: 'MAT-03',
    admissionDate: '2026-04-09',
    daysAdmitted: 1,
    diagnosis: 'Pós-parto normal',
    attendingPhysician: 'Dra. Tania Pires',
    risk: 'low',
    dischargeStatus: 'ready',
  },
  {
    mrn: 'MRN-010',
    name: 'Thiago Resende',
    age: 51,
    sex: 'M',
    bloodType: 'B-',
    ward: 'Ala 2A',
    bed: '2A-06',
    admissionDate: '2026-04-05',
    daysAdmitted: 5,
    diagnosis: 'IAM — pós-ICP',
    attendingPhysician: 'Dr. Henrique Monte',
    risk: 'high',
    dischargeStatus: 'planned',
  },
  {
    mrn: 'MRN-011',
    name: 'Diana Reyes',
    age: 45,
    sex: 'F',
    bloodType: 'AB-',
    ward: 'Ala 1D',
    bed: '1D-02',
    admissionDate: '2026-04-06',
    daysAdmitted: 4,
    diagnosis: 'Apendicite — pós-op',
    attendingPhysician: 'Dr. Marcio Tavares',
    risk: 'medium',
    dischargeStatus: 'blocked',
    blockers: ['Farmácia'],
  },
  {
    mrn: 'MRN-013',
    name: 'Sofia Andrade',
    age: 79,
    sex: 'F',
    bloodType: 'O+',
    ward: 'Ala 2A',
    bed: '2A-10',
    admissionDate: '2026-04-03',
    daysAdmitted: 7,
    diagnosis: 'Sepse urinária',
    attendingPhysician: 'Dra. Helena Rocha',
    risk: 'critical',
    dischargeStatus: 'pending',
  },
  {
    mrn: 'MRN-014',
    name: 'Thomas Crane',
    age: 36,
    sex: 'M',
    bloodType: 'A+',
    ward: 'Ala 3B',
    bed: '3B-04',
    admissionDate: '2026-04-07',
    daysAdmitted: 3,
    diagnosis: 'Hérnia inguinal — pós-op',
    attendingPhysician: 'Dra. Patricia Reis',
    risk: 'low',
    dischargeStatus: 'ready',
  },
  {
    mrn: 'MRN-015',
    name: 'Priya Nair',
    age: 49,
    sex: 'F',
    bloodType: 'B+',
    ward: 'Ala 1D',
    bed: '1D-05',
    admissionDate: '2026-04-08',
    daysAdmitted: 2,
    diagnosis: 'ITU complicada',
    attendingPhysician: 'Dr. Carlos Lima',
    risk: 'medium',
    dischargeStatus: 'pending',
  },
  {
    mrn: 'MRN-019',
    name: 'Caio Mendes',
    age: 55,
    sex: 'M',
    bloodType: 'O-',
    ward: 'UTI Adulto',
    bed: 'UTI-03',
    admissionDate: '2026-04-08',
    daysAdmitted: 2,
    diagnosis: 'Pós-op abdome agudo',
    attendingPhysician: 'Dr. Marcio Tavares',
    risk: 'high',
    dischargeStatus: 'pending',
  },
];

export function getPatientByMrn(mrn: string): PatientRecord | undefined {
  return PATIENTS.find((p) => p.mrn === mrn);
}

export function getPatientsByWard(ward: string): PatientRecord[] {
  return PATIENTS.filter((p) => p.ward === ward);
}

export function getPatientsByDischargeStatus(
  status: PatientRecord['dischargeStatus'],
): PatientRecord[] {
  return PATIENTS.filter((p) => p.dischargeStatus === status);
}
