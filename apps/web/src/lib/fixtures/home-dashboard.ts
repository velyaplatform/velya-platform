/**
 * Centralized fixtures for /. Source of truth enforced by scripts/check-ui-duplications.ts. Do not duplicate MRN literals in page files.
 */

export interface TaskRowProps {
  priority: 'urgent' | 'warning' | 'normal';
  type: string;
  description: string;
  patient: string;
  assignee: string;
  due: string;
}

export interface DischargeRowProps {
  mrn: string;
  name: string;
  ward: string;
  los: number;
  targetDate: string;
  blockers: string[];
  status: 'ready' | 'blocked' | 'pending';
}

export const PRIORITY_TASKS: TaskRowProps[] = [
  {
    priority: 'urgent',
    type: 'Alta',
    description: 'Transporte não providenciado — paciente liberada desde 08:00',
    patient: 'Eleanor Voss (MRN-004)',
    assignee: 'Planejador de Alta',
    due: 'Atrasado 4h',
  },
  {
    priority: 'urgent',
    type: 'Clínico',
    description: 'Ausência de liberação da farmácia bloqueia alta de 3 pacientes',
    patient: 'Múltiplos (MRN-011, 018, 022)',
    assignee: 'Dr. Chen',
    due: 'Agora',
  },
  {
    priority: 'warning',
    type: 'Administrativo',
    description: 'Pré-autorização do plano pendente há mais de 48h — escalar para operadora',
    patient: 'Marcus Bell (MRN-007)',
    assignee: 'Equipe Admin',
    due: 'Em 2h',
  },
  {
    priority: 'warning',
    type: 'Clínico',
    description: 'Avaliação do paciente não concluída — internação +1d se não feita',
    patient: 'Priya Nair (MRN-015)',
    assignee: 'Equipe da Ala',
    due: 'Em 3h',
  },
  {
    priority: 'normal',
    type: 'Coordenação',
    description: 'Encaminhamento para serviço social necessário antes da alta',
    patient: 'Frank Osei (MRN-031)',
    assignee: 'Serviço Social',
    due: 'Hoje',
  },
];

export const DISCHARGE_PATIENTS: DischargeRowProps[] = [
  {
    mrn: 'MRN-002',
    name: 'Sarah Mitchell',
    ward: 'Ala 3B',
    los: 6,
    targetDate: 'Hoje 12:00',
    blockers: [],
    status: 'ready',
  },
  {
    mrn: 'MRN-004',
    name: 'Eleanor Voss',
    ward: 'Ala 2A',
    los: 9,
    targetDate: 'Hoje 08:00',
    blockers: ['Transporte', 'Documentação'],
    status: 'blocked',
  },
  {
    mrn: 'MRN-007',
    name: 'Marcus Bell',
    ward: 'Ala 4C',
    los: 12,
    targetDate: 'Hoje 16:00',
    blockers: ['Plano de Saúde'],
    status: 'blocked',
  },
  {
    mrn: 'MRN-011',
    name: 'Diana Reyes',
    ward: 'Ala 1D',
    los: 4,
    targetDate: 'Amanhã 10:00',
    blockers: ['Farmácia'],
    status: 'pending',
  },
  {
    mrn: 'MRN-014',
    name: 'Thomas Crane',
    ward: 'Ala 3B',
    los: 3,
    targetDate: 'Amanhã 14:00',
    blockers: [],
    status: 'ready',
  },
];
