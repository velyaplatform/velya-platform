/**
 * Centralized fixtures for /system agent activity log.
 *
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate MRN literals in page files.
 */

export interface AgentActivity {
  id: string;
  agent: string;
  office: string;
  action: string;
  patient?: string;
  timestamp: string;
  status: 'completed' | 'in-progress' | 'failed' | 'escalated';
}

export const AGENT_ACTIVITY: AgentActivity[] = [
  {
    id: 'A-001',
    agent: 'discharge-coordinator-agent',
    office: 'Ops Clínicas',
    action: 'Identificados 5 pacientes com TMI acima do limite — planos de alta gerados',
    patient: 'MRN-004, MRN-007, MRN-013',
    timestamp: '09:45',
    status: 'completed',
  },
  {
    id: 'A-002',
    agent: 'clinical-triage-agent',
    office: 'Clínico',
    action: '34 tarefas priorizadas e roteadas para as equipes responsáveis',
    timestamp: '09:30',
    status: 'completed',
  },
  {
    id: 'A-003',
    agent: 'quality-audit-agent',
    office: 'Qualidade',
    action: 'Sinalizando 7 pacientes sem documentação de visita médica',
    timestamp: '09:15',
    status: 'in-progress',
  },
  {
    id: 'A-004',
    agent: 'medication-reconciliation-agent',
    office: 'Farmácia',
    action: 'Reconciliação medicamentosa falhou — erro de validação de PHI',
    patient: 'MRN-006',
    timestamp: '08:55',
    status: 'failed',
  },
  {
    id: 'A-005',
    agent: 'insurance-auth-agent',
    office: 'Receita',
    action: 'Pré-autorização pendente há mais de 48h — escalada para revisor humano',
    patient: 'MRN-007',
    timestamp: '08:30',
    status: 'escalated',
  },
  {
    id: 'A-006',
    agent: 'discharge-coordinator-agent',
    office: 'Ops Clínicas',
    action: 'Solicitações de coordenação de transporte enviadas para 3 pacientes',
    timestamp: '08:00',
    status: 'completed',
  },
  {
    id: 'A-007',
    agent: 'clinical-triage-agent',
    office: 'Clínico',
    action: 'Escalada NEWS2 acionada para Ala 2A leito 2A-10',
    patient: 'MRN-013',
    timestamp: '07:45',
    status: 'escalated',
  },
];
