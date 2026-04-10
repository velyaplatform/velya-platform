/**
 * Centralized fixtures for hospital insurance claims (contas hospitalares). Mapped to FHIR R4 Claim.
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'under-review'
  | 'approved'
  | 'partially-denied'
  | 'denied'
  | 'paid';

export interface Claim {
  id: string;
  patientMrn: string;
  encounterId: string;
  payerId: string;
  payerName: string;
  submittedAt: string;
  totalValue: number;
  chargeIds: string[];
  status: ClaimStatus;
  approvedValue?: number;
  paidValue?: number;
  notes?: string;
}

export const CLAIMS: Claim[] = [
  {
    id: 'CLM-2026-0001',
    patientMrn: 'MRN-001',
    encounterId: 'ENC-2026-0001',
    payerId: 'ANS-321468',
    payerName: 'Unimed Nacional',
    submittedAt: '2026-04-06T09:00:00-03:00',
    totalValue: 540.0,
    chargeIds: ['CHG-0001'],
    status: 'under-review',
    notes: 'Aguardando análise de auditoria médica do convênio.',
  },
  {
    id: 'CLM-2026-0002',
    patientMrn: 'MRN-002',
    encounterId: 'ENC-2026-0002',
    payerId: 'ANS-326305',
    payerName: 'Amil Assistência Médica',
    submittedAt: '2026-04-06T18:45:00-03:00',
    totalValue: 4850.0,
    chargeIds: ['CHG-0002'],
    status: 'paid',
    approvedValue: 4850.0,
    paidValue: 4850.0,
  },
  {
    id: 'CLM-2026-0003',
    patientMrn: 'MRN-003',
    encounterId: 'ENC-2026-0003',
    payerId: 'ANS-006246',
    payerName: 'SulAmérica Saúde',
    submittedAt: '2026-04-07T11:00:00-03:00',
    totalValue: 5120.0,
    chargeIds: ['CHG-0003'],
    status: 'draft',
    notes: 'Documentação em finalização pelo faturamento.',
  },
  {
    id: 'CLM-2026-0004',
    patientMrn: 'MRN-004',
    encounterId: 'ENC-2026-0004',
    payerId: 'ANS-005711',
    payerName: 'Bradesco Saúde',
    submittedAt: '2026-04-07T15:10:00-03:00',
    totalValue: 255.0,
    chargeIds: ['CHG-0004'],
    status: 'submitted',
  },
  {
    id: 'CLM-2026-0005',
    patientMrn: 'MRN-007',
    encounterId: 'ENC-2026-0007',
    payerId: 'ANS-321468',
    payerName: 'Unimed Nacional',
    submittedAt: '2026-04-08T11:30:00-03:00',
    totalValue: 996.0,
    chargeIds: ['CHG-0006', 'CHG-0014'],
    status: 'partially-denied',
    approvedValue: 76.0,
    paidValue: 76.0,
    notes: 'TC abdome glosada por ausência de justificativa clínica.',
  },
  {
    id: 'CLM-2026-0006',
    patientMrn: 'MRN-009',
    encounterId: 'ENC-2026-0009',
    payerId: 'ANS-326305',
    payerName: 'Amil Assistência Médica',
    submittedAt: '2026-04-08T13:00:00-03:00',
    totalValue: 6900.0,
    chargeIds: ['CHG-0007'],
    status: 'under-review',
  },
  {
    id: 'CLM-2026-0007',
    patientMrn: 'MRN-010',
    encounterId: 'ENC-2026-0010',
    payerId: 'ANS-006246',
    payerName: 'SulAmérica Saúde',
    submittedAt: '2026-04-08T14:00:00-03:00',
    totalValue: 520.0,
    chargeIds: ['CHG-0008'],
    status: 'denied',
    approvedValue: 0,
    paidValue: 0,
    notes: 'Glosa integral - CID-10 não cobre visita diária conforme contrato.',
  },
  {
    id: 'CLM-2026-0008',
    patientMrn: 'MRN-011',
    encounterId: 'ENC-2026-0011',
    payerId: 'ANS-005711',
    payerName: 'Bradesco Saúde',
    submittedAt: '2026-04-08T17:00:00-03:00',
    totalValue: 1486.8,
    chargeIds: ['CHG-0009', 'CHG-0015'],
    status: 'approved',
    approvedValue: 1486.8,
  },
  {
    id: 'CLM-2026-0009',
    patientMrn: 'MRN-014',
    encounterId: 'ENC-2026-0014',
    payerId: 'ANS-321468',
    payerName: 'Unimed Nacional',
    submittedAt: '2026-04-09T09:00:00-03:00',
    totalValue: 18500.0,
    chargeIds: ['CHG-0011'],
    status: 'submitted',
  },
  {
    id: 'CLM-2026-0010',
    patientMrn: 'MRN-019',
    encounterId: 'ENC-2026-0019',
    payerId: 'ANS-006246',
    payerName: 'SulAmérica Saúde',
    submittedAt: '2026-04-09T11:30:00-03:00',
    totalValue: 3360.0,
    chargeIds: ['CHG-0013'],
    status: 'denied',
    approvedValue: 0,
    paidValue: 0,
    notes: 'Tempo de sala cirúrgica acima do previsto para o procedimento.',
  },
];
