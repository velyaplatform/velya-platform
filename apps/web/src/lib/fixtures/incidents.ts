/**
 * Centralized fixtures for patient safety incidents. Mapped to FHIR R4 AdverseEvent.
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type IncidentType =
  | 'queda'
  | 'erro-medicacao'
  | 'identificacao-errada'
  | 'infeccao-associada'
  | 'lesao-pressao'
  | 'alergia-nao-registrada'
  | 'falha-comunicacao'
  | 'near-miss';

export type IncidentSeverity = 'minor' | 'moderate' | 'major' | 'sentinel';

export type IncidentStatus =
  | 'reported'
  | 'investigating'
  | 'root-cause-analysis'
  | 'action-plan'
  | 'closed';

export interface Incident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  patientMrn?: string;
  reportedAt: string;
  reportedBy: string;
  location: string;
  description: string;
  status: IncidentStatus;
  causeCategory?: string;
  correctiveAction?: string;
  closedAt?: string;
}

export const INCIDENTS: Incident[] = [
  {
    id: 'INC-2026-0001',
    type: 'queda',
    severity: 'moderate',
    patientMrn: 'MRN-004',
    reportedAt: '2026-04-05T03:20:00-03:00',
    reportedBy: 'EMP-2002',
    location: 'Ala 2A - Leito 204',
    description: 'Paciente idoso tentou se levantar sem acionar campainha e caiu do leito. Apresentou escoriação em antebraço direito.',
    status: 'action-plan',
    causeCategory: 'Fator humano / Falha de orientação',
    correctiveAction: 'Reforço de treinamento sobre protocolo de prevenção de quedas e reavaliação de risco (Morse).',
  },
  {
    id: 'INC-2026-0002',
    type: 'erro-medicacao',
    severity: 'major',
    patientMrn: 'MRN-007',
    reportedAt: '2026-04-06T11:45:00-03:00',
    reportedBy: 'EMP-4001',
    location: 'Ala 2A - Posto de enfermagem',
    description: 'Insulina regular administrada em dose 2x superior à prescrita por erro de leitura da prescrição manuscrita.',
    status: 'root-cause-analysis',
    causeCategory: 'Prescrição ilegível',
  },
  {
    id: 'INC-2026-0003',
    type: 'near-miss',
    severity: 'minor',
    patientMrn: 'MRN-003',
    reportedAt: '2026-04-06T14:10:00-03:00',
    reportedBy: 'EMP-2001',
    location: 'Farmácia Central',
    description: 'Medicamento com nome semelhante (LASA) separado por engano. Identificado antes da dispensação.',
    status: 'closed',
    causeCategory: 'Medicamento LASA (look-alike sound-alike)',
    correctiveAction: 'Sinalização visual nas prateleiras e dupla conferência implementada.',
    closedAt: '2026-04-07T10:00:00-03:00',
  },
  {
    id: 'INC-2026-0004',
    type: 'identificacao-errada',
    severity: 'moderate',
    patientMrn: 'MRN-014',
    reportedAt: '2026-04-06T16:30:00-03:00',
    reportedBy: 'EMP-2003',
    location: 'Centro Cirúrgico - Sala 03',
    description: 'Pulseira de identificação do paciente estava ilegível. Cirurgia pausada para reconferência com prontuário.',
    status: 'investigating',
    causeCategory: 'Material de impressão inadequado',
  },
  {
    id: 'INC-2026-0005',
    type: 'lesao-pressao',
    severity: 'moderate',
    patientMrn: 'MRN-019',
    reportedAt: '2026-04-07T08:00:00-03:00',
    reportedBy: 'EMP-2001',
    location: 'UTI Adulto - Leito 12',
    description: 'Paciente em VM há 9 dias apresentou lesão por pressão estágio 2 em região sacral.',
    status: 'action-plan',
    causeCategory: 'Mobilização insuficiente',
    correctiveAction: 'Revisão do protocolo de mudança de decúbito a cada 2h e uso de colchão pneumático.',
  },
  {
    id: 'INC-2026-0006',
    type: 'infeccao-associada',
    severity: 'major',
    patientMrn: 'MRN-011',
    reportedAt: '2026-04-07T15:00:00-03:00',
    reportedBy: 'EMP-1001',
    location: 'UTI Adulto - Leito 08',
    description: 'Infecção de corrente sanguínea associada a cateter venoso central. Hemocultura positiva para S. aureus.',
    status: 'investigating',
    causeCategory: 'Possível falha de técnica asséptica',
  },
  {
    id: 'INC-2026-0007',
    type: 'alergia-nao-registrada',
    severity: 'sentinel',
    patientMrn: 'MRN-006',
    reportedAt: '2026-04-07T20:15:00-03:00',
    reportedBy: 'EMP-1004',
    location: 'Pronto Socorro',
    description: 'Paciente com alergia conhecida a dipirona recebeu o medicamento. Apresentou choque anafilático, necessitou de intubação orotraqueal.',
    status: 'root-cause-analysis',
    causeCategory: 'Falha de registro de alergia no sistema / Anamnese incompleta',
  },
  {
    id: 'INC-2026-0008',
    type: 'falha-comunicacao',
    severity: 'moderate',
    patientMrn: 'MRN-002',
    reportedAt: '2026-04-08T07:40:00-03:00',
    reportedBy: 'EMP-2003',
    location: 'Ala 3B - Passagem de plantão',
    description: 'Informação sobre restrição hídrica não foi transmitida na passagem de plantão. Paciente recebeu dieta líquida livre por 6h.',
    status: 'action-plan',
    causeCategory: 'Ausência de checklist padronizado (SBAR)',
    correctiveAction: 'Implantação obrigatória de SBAR em todas as passagens de plantão.',
  },
  {
    id: 'INC-2026-0009',
    type: 'queda',
    severity: 'minor',
    patientMrn: 'MRN-013',
    reportedAt: '2026-04-08T10:25:00-03:00',
    reportedBy: 'EMP-3001',
    location: 'Ala 2A - Banheiro do quarto',
    description: 'Paciente escorregou no piso molhado do banheiro ao tentar se secar. Sem lesões aparentes.',
    status: 'closed',
    causeCategory: 'Ambiente / Piso molhado',
    correctiveAction: 'Tapete antiderrapante instalado e sinalização reforçada.',
    closedAt: '2026-04-09T09:00:00-03:00',
  },
  {
    id: 'INC-2026-0010',
    type: 'erro-medicacao',
    severity: 'minor',
    reportedAt: '2026-04-08T13:50:00-03:00',
    reportedBy: 'EMP-4001',
    location: 'Farmácia Central',
    description: 'Dispensação de medicamento com via de administração incorreta (EV em vez de IM). Corrigido antes da administração.',
    status: 'closed',
    causeCategory: 'Erro de transcrição',
    correctiveAction: 'Migração de prescrição para sistema eletrônico com validação de via.',
    closedAt: '2026-04-09T08:00:00-03:00',
  },
  {
    id: 'INC-2026-0011',
    type: 'near-miss',
    severity: 'minor',
    patientMrn: 'MRN-015',
    reportedAt: '2026-04-08T17:00:00-03:00',
    reportedBy: 'EMP-2002',
    location: 'Ala 2A - Leito 208',
    description: 'Bomba de infusão com alarme de bateria baixa ignorado por 20 min. Identificado na ronda antes de parar a infusão.',
    status: 'reported',
  },
  {
    id: 'INC-2026-0012',
    type: 'identificacao-errada',
    severity: 'major',
    patientMrn: 'MRN-010',
    reportedAt: '2026-04-09T09:15:00-03:00',
    reportedBy: 'EMP-1001',
    location: 'Laboratório Central',
    description: 'Amostra de sangue coletada com etiqueta de outro paciente. Resultado incorreto divulgado no prontuário antes da detecção.',
    status: 'investigating',
    causeCategory: 'Etiquetagem fora do leito',
  },
];
