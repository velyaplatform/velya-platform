/**
 * Centralized staff & shift fixtures for the live "who is working now" page.
 *
 * Real production system would source this from:
 *   - HR (employee master data)
 *   - Scheduling system (shifts)
 *   - Badge / login activity (presence)
 *   - Patient assignment service (which patients are under care)
 *
 * For now this is mock data so the dashboard can be demoed end-to-end.
 */

export type ProfessionalRole =
  | 'medico'
  | 'enfermeiro'
  | 'tecnico-enfermagem'
  | 'fisioterapeuta'
  | 'farmaceutico'
  | 'planejador-alta'
  | 'higienizacao'
  | 'coordenador'
  | 'recepcao';

export type ShiftType = 'manha' | 'tarde' | 'noite' | 'plantao';
export type PresenceStatus = 'on-duty' | 'on-break' | 'off-duty' | 'off-shift';

export interface StaffMember {
  id: string;
  name: string;
  role: ProfessionalRole;
  specialty?: string;
  council?: string;
  ward: string;
  shift: ShiftType;
  shiftStart: string; // ISO HH:MM
  shiftEnd: string;
  presence: PresenceStatus;
  lastBadgeAt?: string;
  assignedPatientMrns: string[];
  contactExtension?: string;
}

export const STAFF: StaffMember[] = [
  {
    id: 'EMP-1001',
    name: 'Dra. Helena Rocha',
    role: 'medico',
    specialty: 'Clínica Médica',
    council: 'CRM-SP 145332',
    ward: 'Ala 2A',
    shift: 'manha',
    shiftStart: '07:00',
    shiftEnd: '13:00',
    presence: 'on-duty',
    lastBadgeAt: '07:02',
    assignedPatientMrns: ['MRN-004', 'MRN-007', 'MRN-013'],
    contactExtension: '4501',
  },
  {
    id: 'EMP-1002',
    name: 'Dr. Carlos Lima',
    role: 'medico',
    specialty: 'Pneumologia',
    council: 'CRM-SP 122887',
    ward: 'Ala 2A',
    shift: 'manha',
    shiftStart: '07:00',
    shiftEnd: '13:00',
    presence: 'on-duty',
    lastBadgeAt: '06:58',
    assignedPatientMrns: ['MRN-001', 'MRN-003', 'MRN-015'],
    contactExtension: '4502',
  },
  {
    id: 'EMP-1003',
    name: 'Dra. Patricia Reis',
    role: 'medico',
    specialty: 'Cirurgia Geral',
    council: 'CRM-SP 188901',
    ward: 'Ala 3B',
    shift: 'manha',
    shiftStart: '07:00',
    shiftEnd: '13:00',
    presence: 'on-duty',
    lastBadgeAt: '07:11',
    assignedPatientMrns: ['MRN-002', 'MRN-014'],
    contactExtension: '4510',
  },
  {
    id: 'EMP-1004',
    name: 'Dr. Marcio Tavares',
    role: 'medico',
    specialty: 'Cirurgia Geral',
    council: 'CRM-SP 165770',
    ward: 'Ala 3B',
    shift: 'manha',
    shiftStart: '07:00',
    shiftEnd: '13:00',
    presence: 'on-break',
    lastBadgeAt: '09:45',
    assignedPatientMrns: ['MRN-006', 'MRN-011', 'MRN-019'],
    contactExtension: '4511',
  },
  {
    id: 'EMP-2001',
    name: 'Enf. Joana Freitas',
    role: 'enfermeiro',
    specialty: 'UTI',
    council: 'COREN-SP 412009',
    ward: 'UTI Adulto',
    shift: 'manha',
    shiftStart: '07:00',
    shiftEnd: '19:00',
    presence: 'on-duty',
    lastBadgeAt: '06:55',
    assignedPatientMrns: ['MRN-019', 'MRN-013'],
    contactExtension: '5001',
  },
  {
    id: 'EMP-2002',
    name: 'Enf. Pedro Aguiar',
    role: 'enfermeiro',
    specialty: 'Clínica Médica',
    council: 'COREN-SP 410220',
    ward: 'Ala 2A',
    shift: 'manha',
    shiftStart: '07:00',
    shiftEnd: '19:00',
    presence: 'on-duty',
    lastBadgeAt: '07:01',
    assignedPatientMrns: ['MRN-001', 'MRN-003', 'MRN-004'],
    contactExtension: '5002',
  },
  {
    id: 'EMP-2003',
    name: 'Enf. Beatriz Cordeiro',
    role: 'enfermeiro',
    specialty: 'Cirurgia',
    council: 'COREN-SP 410877',
    ward: 'Ala 3B',
    shift: 'manha',
    shiftStart: '07:00',
    shiftEnd: '19:00',
    presence: 'on-duty',
    lastBadgeAt: '06:50',
    assignedPatientMrns: ['MRN-002', 'MRN-014', 'MRN-006'],
    contactExtension: '5010',
  },
  {
    id: 'EMP-3001',
    name: 'Téc. Roberto Lemos',
    role: 'tecnico-enfermagem',
    specialty: 'Geral',
    council: 'COREN-SP 290144 TE',
    ward: 'Ala 2A',
    shift: 'manha',
    shiftStart: '07:00',
    shiftEnd: '19:00',
    presence: 'on-duty',
    lastBadgeAt: '06:48',
    assignedPatientMrns: ['MRN-001', 'MRN-013'],
    contactExtension: '5021',
  },
  {
    id: 'EMP-4001',
    name: 'Farm. Lucas Verde',
    role: 'farmaceutico',
    specialty: 'Hospitalar',
    council: 'CRF-SP 67099',
    ward: 'Farmácia Central',
    shift: 'manha',
    shiftStart: '07:00',
    shiftEnd: '15:00',
    presence: 'on-duty',
    lastBadgeAt: '06:40',
    assignedPatientMrns: ['MRN-011', 'MRN-006', 'MRN-007'],
    contactExtension: '6001',
  },
  {
    id: 'EMP-5001',
    name: 'Fisio. Renata Bittencourt',
    role: 'fisioterapeuta',
    specialty: 'Respiratória',
    council: 'CREFITO-3 99211',
    ward: 'UTI Adulto',
    shift: 'manha',
    shiftStart: '08:00',
    shiftEnd: '14:00',
    presence: 'on-duty',
    lastBadgeAt: '08:02',
    assignedPatientMrns: ['MRN-019'],
    contactExtension: '7001',
  },
  {
    id: 'EMP-6001',
    name: 'Coord. Vivian Pacheco',
    role: 'planejador-alta',
    specialty: 'Coordenação de Altas',
    ward: 'Coordenação Geral',
    shift: 'manha',
    shiftStart: '07:00',
    shiftEnd: '16:00',
    presence: 'on-duty',
    lastBadgeAt: '06:55',
    assignedPatientMrns: ['MRN-002', 'MRN-004', 'MRN-007', 'MRN-011', 'MRN-014'],
    contactExtension: '8001',
  },
  {
    id: 'EMP-9001',
    name: 'Dr. Felipe Maia',
    role: 'medico',
    specialty: 'Cardiologia',
    council: 'CRM-SP 198440',
    ward: 'UTI Coronariana',
    shift: 'noite',
    shiftStart: '19:00',
    shiftEnd: '07:00',
    presence: 'off-shift',
    assignedPatientMrns: [],
    contactExtension: '4520',
  },
];

export const ROLE_LABELS: Record<ProfessionalRole, string> = {
  medico: 'Médico(a)',
  enfermeiro: 'Enfermeiro(a)',
  'tecnico-enfermagem': 'Técnico(a) de Enfermagem',
  fisioterapeuta: 'Fisioterapeuta',
  farmaceutico: 'Farmacêutico(a)',
  'planejador-alta': 'Planejador(a) de Alta',
  higienizacao: 'Higienização',
  coordenador: 'Coordenador(a)',
  recepcao: 'Recepção',
};

export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  'on-duty': 'Em serviço',
  'on-break': 'Em pausa',
  'off-duty': 'Folga',
  'off-shift': 'Fora do turno',
};

export function getStaffOnDuty(): StaffMember[] {
  return STAFF.filter((s) => s.presence === 'on-duty' || s.presence === 'on-break');
}

export function getStaffByWard(ward: string): StaffMember[] {
  return STAFF.filter((s) => s.ward === ward);
}

export function getStaffByRole(role: ProfessionalRole): StaffMember[] {
  return STAFF.filter((s) => s.role === role);
}
