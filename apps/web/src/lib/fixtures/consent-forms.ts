/**
 * Centralized fixtures for LGPD and clinical consent forms. Mapped to FHIR R4 Consent.
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type ConsentType =
  | 'lgpd-general'
  | 'surgical'
  | 'anesthesia'
  | 'blood-transfusion'
  | 'image-use'
  | 'research'
  | 'data-sharing';

export type ConsentStatus = 'active' | 'revoked' | 'expired';

export interface ConsentForm {
  id: string;
  patientMrn: string;
  type: ConsentType;
  scope: string;
  signedAt: string;
  signedBy: string;
  witnessedBy?: string;
  status: ConsentStatus;
  documentUrl?: string;
  version: string;
}

export const CONSENT_FORMS: ConsentForm[] = [
  {
    id: 'CNS-2026-0001',
    patientMrn: 'MRN-001',
    type: 'lgpd-general',
    scope: 'Tratamento de dados pessoais e sensíveis para finalidades assistenciais conforme LGPD (Lei 13.709/2018).',
    signedAt: '2026-04-05T08:30:00-03:00',
    signedBy: 'João Almeida (titular)',
    witnessedBy: 'EMP-2002',
    status: 'active',
    documentUrl: '/consents/CNS-2026-0001.pdf',
    version: 'v3.2',
  },
  {
    id: 'CNS-2026-0002',
    patientMrn: 'MRN-002',
    type: 'surgical',
    scope: 'Colecistectomia videolaparoscópica - riscos, benefícios, alternativas e consequências.',
    signedAt: '2026-04-05T19:00:00-03:00',
    signedBy: 'Maria Santos (titular)',
    witnessedBy: 'EMP-1003',
    status: 'active',
    documentUrl: '/consents/CNS-2026-0002.pdf',
    version: 'v2.1',
  },
  {
    id: 'CNS-2026-0003',
    patientMrn: 'MRN-002',
    type: 'anesthesia',
    scope: 'Anestesia geral balanceada com riscos específicos informados pelo anestesiologista.',
    signedAt: '2026-04-05T19:15:00-03:00',
    signedBy: 'Maria Santos (titular)',
    witnessedBy: 'EMP-1003',
    status: 'active',
    documentUrl: '/consents/CNS-2026-0003.pdf',
    version: 'v1.8',
  },
  {
    id: 'CNS-2026-0004',
    patientMrn: 'MRN-006',
    type: 'blood-transfusion',
    scope: 'Transfusão de hemocomponentes em emergência - risco de reação transfusional e infecções.',
    signedAt: '2026-04-07T21:00:00-03:00',
    signedBy: 'Sandra Oliveira (responsável legal)',
    witnessedBy: 'EMP-1004',
    status: 'active',
    documentUrl: '/consents/CNS-2026-0004.pdf',
    version: 'v2.0',
  },
  {
    id: 'CNS-2026-0005',
    patientMrn: 'MRN-007',
    type: 'image-use',
    scope: 'Uso de imagens clínicas (fotos, vídeos) para fins de ensino e publicações científicas, sem identificação.',
    signedAt: '2026-04-06T10:20:00-03:00',
    signedBy: 'Ricardo Pereira (titular)',
    status: 'revoked',
    documentUrl: '/consents/CNS-2026-0005.pdf',
    version: 'v1.5',
  },
  {
    id: 'CNS-2026-0006',
    patientMrn: 'MRN-011',
    type: 'research',
    scope: 'Participação em estudo clínico observacional sobre sepse em UTI - CEP nº 5.210.887.',
    signedAt: '2026-04-07T14:00:00-03:00',
    signedBy: 'Antonio Dias (responsável legal)',
    witnessedBy: 'EMP-9001',
    status: 'active',
    documentUrl: '/consents/CNS-2026-0006.pdf',
    version: 'v4.0',
  },
  {
    id: 'CNS-2026-0007',
    patientMrn: 'MRN-013',
    type: 'lgpd-general',
    scope: 'Autorização para compartilhamento com operadora de saúde e laboratórios parceiros.',
    signedAt: '2026-04-06T11:00:00-03:00',
    signedBy: 'Helena Costa (titular)',
    witnessedBy: 'EMP-2002',
    status: 'active',
    documentUrl: '/consents/CNS-2026-0007.pdf',
    version: 'v3.2',
  },
  {
    id: 'CNS-2026-0008',
    patientMrn: 'MRN-014',
    type: 'surgical',
    scope: 'Artroplastia total de quadril direito com prótese não cimentada.',
    signedAt: '2026-04-08T18:30:00-03:00',
    signedBy: 'Paulo Ferreira (titular)',
    witnessedBy: 'EMP-1003',
    status: 'active',
    documentUrl: '/consents/CNS-2026-0008.pdf',
    version: 'v2.1',
  },
  {
    id: 'CNS-2026-0009',
    patientMrn: 'MRN-019',
    type: 'data-sharing',
    scope: 'Compartilhamento de dados anonimizados com rede de pesquisa em terapia intensiva.',
    signedAt: '2026-04-07T09:00:00-03:00',
    signedBy: 'Laura Monteiro (responsável legal)',
    witnessedBy: 'EMP-9001',
    status: 'active',
    documentUrl: '/consents/CNS-2026-0009.pdf',
    version: 'v1.3',
  },
  {
    id: 'CNS-2026-0010',
    patientMrn: 'MRN-004',
    type: 'lgpd-general',
    scope: 'Tratamento de dados pessoais para finalidades assistenciais - versão anterior ao novo termo.',
    signedAt: '2024-11-12T10:00:00-03:00',
    signedBy: 'Eduardo Brito (titular)',
    witnessedBy: 'EMP-2002',
    status: 'expired',
    documentUrl: '/consents/CNS-2024-EDB.pdf',
    version: 'v2.8',
  },
];
