/**
 * Centralized fixtures for imaging results. Mapped to FHIR R4 DiagnosticReport (imaging).
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export interface ImagingResult {
  id: string;
  orderId: string;
  patientMrn: string;
  modality: 'RX' | 'CT' | 'MR' | 'US' | 'NM' | 'ECG' | 'ECHO';
  findings: string;
  impression: string;
  reportedAt: string;
  reportedBy: string;
  status: 'draft' | 'final' | 'amended';
  criticalFinding: boolean;
}

export const IMAGING_RESULTS: ImagingResult[] = [
  {
    id: 'IMR-0001',
    orderId: 'IMG-0001',
    patientMrn: 'MRN-001',
    modality: 'RX',
    findings:
      'Opacidade alveolar em lobo inferior direito, com broncograma aéreo. Seios costofrênicos livres. Área cardíaca dentro dos limites.',
    impression: 'Consolidação em lobo inferior direito, compatível com pneumonia.',
    reportedAt: '2026-04-04T11:30:00',
    reportedBy: 'Dra. Fernanda Arcanjo — CRM-SP 98765',
    status: 'final',
    criticalFinding: false,
  },
  {
    id: 'IMR-0002',
    orderId: 'IMG-0002',
    patientMrn: 'MRN-004',
    modality: 'CT',
    findings:
      'Área hipodensa em território da ACM esquerda, sem sinais de transformação hemorrágica. Ausência de desvio de linha média.',
    impression: 'Infarto estabelecido em território da ACM esquerda. Sem hemorragia pós-trombólise.',
    reportedAt: '2026-04-01T17:45:00',
    reportedBy: 'Dr. Rogério Bastos — CRM-SP 76543',
    status: 'final',
    criticalFinding: false,
  },
  {
    id: 'IMR-0003',
    orderId: 'IMG-0003',
    patientMrn: 'MRN-006',
    modality: 'CT',
    findings:
      'Pâncreas aumentado com borramento da gordura peripancreática e pequena coleção peripancreática. Vias biliares sem dilatação.',
    impression: 'Pancreatite aguda — Balthazar C. Sem necrose evidente.',
    reportedAt: '2026-04-08T15:00:00',
    reportedBy: 'Dra. Fernanda Arcanjo — CRM-SP 98765',
    status: 'final',
    criticalFinding: false,
  },
  {
    id: 'IMR-0004',
    orderId: 'IMG-0004',
    patientMrn: 'MRN-010',
    modality: 'ECHO',
    findings:
      'VE com hipocinesia de parede anterior e apical. FEVE estimada em 38%. Ausência de trombo intracavitário. Válvulas sem alterações significativas.',
    impression: 'Disfunção sistólica moderada do VE com acinesia segmentar anterior.',
    reportedAt: '2026-04-05T11:40:00',
    reportedBy: 'Dr. Paulo Sant\u0027Anna — CRM-SP 54321',
    status: 'final',
    criticalFinding: true,
  },
  {
    id: 'IMR-0005',
    orderId: 'IMG-0007',
    patientMrn: 'MRN-003',
    modality: 'CT',
    findings:
      'Enfisema centrolobular difuso predominante em lobos superiores. Espessamento de paredes brônquicas. Sem consolidações.',
    impression: 'Alterações compatíveis com DPOC, sem complicações agudas.',
    reportedAt: '2026-04-06T13:05:00',
    reportedBy: 'Dr. Rogério Bastos — CRM-SP 76543',
    status: 'final',
    criticalFinding: false,
  },
  {
    id: 'IMR-0006',
    orderId: 'IMG-0008',
    patientMrn: 'MRN-010',
    modality: 'ECG',
    findings:
      'Ritmo sinusal, FC 78 bpm. Onda Q patológica em DII, DIII e aVF. Sem supra de ST.',
    impression: 'Sinais de infarto inferior prévio. Sem isquemia aguda.',
    reportedAt: '2026-04-05T07:55:00',
    reportedBy: 'Dr. Henrique Monte — CRM-SP 334455',
    status: 'final',
    criticalFinding: false,
  },
  {
    id: 'IMR-0007',
    orderId: 'IMG-0009',
    patientMrn: 'MRN-019',
    modality: 'US',
    findings:
      'Coleção líquida heterogênea em FID medindo 6,2 x 4,8 cm, com septações finas.',
    impression: 'Coleção pós-operatória em FID — sugere abordagem dirigida.',
    reportedAt: '2026-04-09T04:30:00',
    reportedBy: 'Dr. Marcio Tavares — CRM-SP 778899',
    status: 'final',
    criticalFinding: true,
  },
  {
    id: 'IMR-0008',
    orderId: 'IMG-0006',
    patientMrn: 'MRN-015',
    modality: 'US',
    findings:
      'Rins de dimensões e ecogenicidade preservadas. Ausência de dilatação pielocalicinal bilateral. Bexiga distendida, paredes regulares.',
    impression: 'Trato urinário sem sinais de obstrução.',
    reportedAt: '2026-04-08T16:10:00',
    reportedBy: 'Dra. Fernanda Arcanjo — CRM-SP 98765',
    status: 'draft',
    criticalFinding: false,
  },
];
