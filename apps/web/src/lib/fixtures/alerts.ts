/**
 * Centralized fixtures for /alerts.
 *
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate MRN literals in page files.
 */

export interface CriticalAlert {
  id: string;
  severity: 'critical' | 'high';
  title: string;
  body: string;
  source: string;
  triggeredAt: string;
  patientMrn?: string;
  ownerRole: string;
  actionRoute: string;
}

export const ALERTS: CriticalAlert[] = [
  {
    id: 'ALERT-001',
    severity: 'critical',
    title: 'Sepse — escalada NEWS2',
    body: 'Sofia Andrade (MRN-013) com NEWS2 7. Necessita avaliação médica imediata.',
    source: 'clinical-triage-agent',
    triggeredAt: '2026-04-09 09:42',
    patientMrn: 'MRN-013',
    ownerRole: 'Médico Plantonista',
    actionRoute: '/patients/MRN-013',
  },
  {
    id: 'ALERT-002',
    severity: 'critical',
    title: 'Alta bloqueada > 24h',
    body: 'Eleanor Voss (MRN-004) com transporte e documentação pendentes desde 08:00.',
    source: 'discharge-coordinator-agent',
    triggeredAt: '2026-04-09 08:00',
    patientMrn: 'MRN-004',
    ownerRole: 'Planejador de Alta',
    actionRoute: '/patients/MRN-004',
  },
  {
    id: 'ALERT-003',
    severity: 'critical',
    title: 'Reconciliação medicamentosa falhou',
    body: 'Falha de validação PHI em MRN-006. Erro precisa ser revisto pela farmácia.',
    source: 'medication-reconciliation-agent',
    triggeredAt: '2026-04-09 08:55',
    patientMrn: 'MRN-006',
    ownerRole: 'Farmacêutico',
    actionRoute: '/pharmacy',
  },
  {
    id: 'ALERT-004',
    severity: 'critical',
    title: 'Pré-autorização atrasada',
    body: 'Marcus Bell (MRN-007) com pré-autorização pendente há 48h. Escalada para humano.',
    source: 'insurance-auth-agent',
    triggeredAt: '2026-04-08 08:30',
    patientMrn: 'MRN-007',
    ownerRole: 'Equipe Administrativa',
    actionRoute: '/patients/MRN-007',
  },
  {
    id: 'ALERT-005',
    severity: 'high',
    title: 'Farmácia bloqueia 3 altas',
    body: 'Ausência de liberação farmacêutica em MRN-011, MRN-018, MRN-022.',
    source: 'discharge-coordinator-agent',
    triggeredAt: '2026-04-09 09:30',
    ownerRole: 'Farmacêutico',
    actionRoute: '/pharmacy',
  },
];
