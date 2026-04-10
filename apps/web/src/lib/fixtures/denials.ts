/**
 * Centralized fixtures for claim denials (glosas hospitalares). Mapped to FHIR R4 ClaimResponse.
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type DenialCategory =
  | 'documental'
  | 'clinica'
  | 'contratual'
  | 'tecnica'
  | 'administrativa';

export type DenialStatus =
  | 'open'
  | 'appealed'
  | 'resolved-paid'
  | 'resolved-lost'
  | 'in-analysis';

export interface Denial {
  id: string;
  claimId: string;
  code: string;
  reason: string;
  category: DenialCategory;
  deniedAt: string;
  deniedValue: number;
  status: DenialStatus;
  assignedTo?: string;
}

export const DENIALS: Denial[] = [
  {
    id: 'DEN-2026-0001',
    claimId: 'CLM-2026-0005',
    code: 'GL-1501',
    reason: 'Ausência de justificativa clínica para exame de imagem',
    category: 'clinica',
    deniedAt: '2026-04-08T16:20:00-03:00',
    deniedValue: 920.0,
    status: 'appealed',
    assignedTo: 'EMP-6001',
  },
  {
    id: 'DEN-2026-0002',
    claimId: 'CLM-2026-0007',
    code: 'GL-3020',
    reason: 'Procedimento não coberto pelo contrato vigente',
    category: 'contratual',
    deniedAt: '2026-04-08T17:50:00-03:00',
    deniedValue: 520.0,
    status: 'in-analysis',
    assignedTo: 'EMP-6001',
  },
  {
    id: 'DEN-2026-0003',
    claimId: 'CLM-2026-0010',
    code: 'GL-2210',
    reason: 'Tempo de sala cirúrgica excede o tabelado para o CBHPM',
    category: 'tecnica',
    deniedAt: '2026-04-09T12:10:00-03:00',
    deniedValue: 3360.0,
    status: 'open',
  },
  {
    id: 'DEN-2026-0004',
    claimId: 'CLM-2026-0001',
    code: 'GL-1010',
    reason: 'Prontuário incompleto - falta evolução médica diária',
    category: 'documental',
    deniedAt: '2026-04-07T10:00:00-03:00',
    deniedValue: 180.0,
    status: 'resolved-paid',
    assignedTo: 'EMP-6001',
  },
  {
    id: 'DEN-2026-0005',
    claimId: 'CLM-2026-0005',
    code: 'GL-4005',
    reason: 'Guia de autorização vencida no momento da execução',
    category: 'administrativa',
    deniedAt: '2026-04-08T16:25:00-03:00',
    deniedValue: 0,
    status: 'resolved-lost',
  },
  {
    id: 'DEN-2026-0006',
    claimId: 'CLM-2026-0002',
    code: 'GL-1020',
    reason: 'Relatório cirúrgico sem assinatura do cirurgião',
    category: 'documental',
    deniedAt: '2026-04-07T09:30:00-03:00',
    deniedValue: 485.0,
    status: 'resolved-paid',
    assignedTo: 'EMP-1003',
  },
  {
    id: 'DEN-2026-0007',
    claimId: 'CLM-2026-0006',
    code: 'GL-2140',
    reason: 'Diária de UTI sem score clínico compatível (SAPS 3)',
    category: 'tecnica',
    deniedAt: '2026-04-09T08:15:00-03:00',
    deniedValue: 3450.0,
    status: 'appealed',
    assignedTo: 'EMP-9001',
  },
  {
    id: 'DEN-2026-0008',
    claimId: 'CLM-2026-0009',
    code: 'GL-3105',
    reason: 'Material OPME sem pré-autorização do convênio',
    category: 'contratual',
    deniedAt: '2026-04-09T10:40:00-03:00',
    deniedValue: 5200.0,
    status: 'in-analysis',
    assignedTo: 'EMP-6001',
  },
];
