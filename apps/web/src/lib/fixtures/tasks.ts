/**
 * Centralized fixtures for /tasks. Source of truth enforced by scripts/check-ui-duplications.ts. Do not duplicate MRN literals in page files.
 */

export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';
export type TaskStatus = 'open' | 'in-progress' | 'deferred';
export type TaskGroup = 'Urgent' | 'Clinical' | 'Administrative' | 'Coordination';

export interface Task {
  id: string;
  priority: TaskPriority;
  status: TaskStatus;
  group: TaskGroup;
  type: string;
  description: string;
  patient: string;
  mrn: string;
  assignedTo: string;
  dueIn: string;
  createdAt: string;
  context: string;
}

export const MOCK_TASKS: Task[] = [
  {
    id: 'T-001',
    priority: 'urgent',
    status: 'open',
    group: 'Urgent',
    type: 'Alta Bloqueada',
    description: 'Transporte não providenciado — paciente liberada clinicamente desde 08:00',
    patient: 'Eleanor Voss',
    mrn: 'MRN-004',
    assignedTo: 'Planejador de Alta',
    dueIn: 'Atrasado 4h',
    createdAt: '08:15',
    context: 'Ala 2A · Dia 9 · IAM pós-ICP',
  },
  {
    id: 'T-002',
    priority: 'urgent',
    status: 'open',
    group: 'Urgent',
    type: 'Farmácia',
    description: 'Liberação da farmácia pendente — bloqueia alta de 3 pacientes',
    patient: 'Múltiplos pacientes',
    mrn: 'MRN-011, MRN-018, MRN-022',
    assignedTo: 'Dr. Chen',
    dueIn: 'Atrasado 2h',
    createdAt: '08:45',
    context: 'Farmácia · 3 pacientes afetados',
  },
  {
    id: 'T-003',
    priority: 'urgent',
    status: 'in-progress',
    group: 'Urgent',
    type: 'Decisão Clínica',
    description: 'Paciente em deterioração — escore NEWS2 = 7, aguardando decisão de escalada',
    patient: 'Peter Hawkins',
    mrn: 'MRN-013',
    assignedTo: 'Dr. Osei',
    dueIn: 'Agora',
    createdAt: '09:30',
    context: 'Ala 2A · Leito 2A-10 · Recuperação de sepse',
  },
  {
    id: 'T-004',
    priority: 'high',
    status: 'open',
    group: 'Clinical',
    type: 'Medicação',
    description: 'Reconciliação medicamentosa não concluída — paciente previsto para alta amanhã',
    patient: 'Anna Kowalski',
    mrn: 'MRN-006',
    assignedTo: 'Farmacêutico da Ala',
    dueIn: 'Em 2h',
    createdAt: '07:00',
    context: 'Ala 1B · Dia 10 · AVC',
  },
  {
    id: 'T-005',
    priority: 'high',
    status: 'open',
    group: 'Administrative',
    type: 'Plano de Saúde',
    description: 'Pré-autorização do plano pendente há mais de 48h — escalar para operadora',
    patient: 'Marcus Bell',
    mrn: 'MRN-007',
    assignedTo: 'Equipe Admin',
    dueIn: 'Em 2h',
    createdAt: '06:30',
    context: 'Ala 4C · Dia 12 · Estenose vertebral',
  },
  {
    id: 'T-006',
    priority: 'high',
    status: 'open',
    group: 'Clinical',
    type: 'Avaliação',
    description:
      'Avaliação da visita médica não documentada — extensão do TMI provável se não feita',
    patient: 'Priya Nair',
    mrn: 'MRN-015',
    assignedTo: 'Dr. Ibrahim',
    dueIn: 'Em 3h',
    createdAt: '08:00',
    context: 'Ala 1A · Dia 5 · Surto de Crohn',
  },
  {
    id: 'T-007',
    priority: 'high',
    status: 'open',
    group: 'Coordination',
    type: 'Serviço Social',
    description:
      'Encaminhamento para serviço social necessário antes da alta — caso de alta complexidade',
    patient: 'Frank Osei',
    mrn: 'MRN-020',
    assignedTo: 'Serviço Social',
    dueIn: 'Hoje',
    createdAt: '09:00',
    context: 'Ala 4A · Dia 4 · Celulite',
  },
  {
    id: 'T-008',
    priority: 'high',
    status: 'open',
    group: 'Coordination',
    type: 'Plano de Alta',
    description: 'Vaga em casa de repouso não confirmada — paciente no dia 14 de TMI',
    patient: 'Peter Hawkins',
    mrn: 'MRN-013',
    assignedTo: 'Planejador de Alta',
    dueIn: 'Hoje',
    createdAt: '07:30',
    context: 'Ala 2A · Dia 14 · Sepse',
  },
  {
    id: 'T-009',
    priority: 'normal',
    status: 'open',
    group: 'Clinical',
    type: 'Consentimento',
    description: 'Termo de consentimento para procedimento não assinado — agendado para amanhã',
    patient: 'George Papadopoulos',
    mrn: 'MRN-009',
    assignedTo: 'Dr. Ibrahim',
    dueIn: 'Hoje',
    createdAt: '09:15',
    context: 'Ala 2C · Dia 7 · Pneumonia',
  },
  {
    id: 'T-010',
    priority: 'normal',
    status: 'open',
    group: 'Administrative',
    type: 'Documentação',
    description: 'Sumário de alta não iniciado — alta prevista do paciente para amanhã',
    patient: 'Carlos Diaz',
    mrn: 'MRN-005',
    assignedTo: 'Dr. Chen',
    dueIn: 'Até 17:00',
    createdAt: '10:00',
    context: 'Ala 4A · Dia 4 · Apendicectomia',
  },
  {
    id: 'T-011',
    priority: 'normal',
    status: 'deferred',
    group: 'Coordination',
    type: 'Encaminhamento',
    description: 'Encaminhamento para fisioterapia pós-op — avaliação de reabilitação',
    patient: 'James Whitfield',
    mrn: 'MRN-001',
    assignedTo: 'Equipe de Fisioterapia',
    dueIn: 'Adiado para amanhã',
    createdAt: '08:30',
    context: 'Ala 1A · Dia 7 · Fratura de quadril',
  },
  {
    id: 'T-012',
    priority: 'low',
    status: 'open',
    group: 'Administrative',
    type: 'Documentação',
    description: 'Atualizar dados de contato do responsável legal no prontuário',
    patient: 'Robert Ngozi',
    mrn: 'MRN-003',
    assignedTo: 'Secretaria da Ala',
    dueIn: 'Sem prazo',
    createdAt: '10:30',
    context: 'Ala 2B · Tarefa administrativa',
  },
];
