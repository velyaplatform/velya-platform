/** Centralized fixtures for /patients/[id]. Source of truth enforced by scripts/check-ui-duplications.ts. Do not duplicate MRN literals in page files. */

export type EventCategory =
  | 'emergencia'
  | 'admissao'
  | 'avaliacao'
  | 'medicacao'
  | 'exame'
  | 'evolucao'
  | 'handoff'
  | 'alerta'
  | 'chamada'
  | 'alta';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  category: EventCategory;
  title: string;
  description: string;
  author: string;
  role: string;
  location: string;
  pending?: boolean;
}

export interface VitalSign {
  timestamp: string;
  fc: number;
  pas: number;
  pad: number;
  fr: number;
  spo2: number;
  temp: number;
  pain: number;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  route: string;
  frequency: string;
  status: 'ativa' | 'suspensa' | 'concluida';
  startDate: string;
  endDate?: string;
  nextDose?: string;
  administrations: { time: string; status: 'administrado' | 'pendente' | 'atrasado' | 'omitido' }[];
  interactions?: string[];
}

export interface LabResult {
  id: string;
  name: string;
  category: 'laboratorio' | 'imagem';
  status: 'solicitado' | 'em_andamento' | 'concluido' | 'critico';
  requestDate: string;
  resultDate?: string;
  value?: string;
  unit?: string;
  reference?: string;
  isCritical?: boolean;
  trend?: { date: string; value: number }[];
}

export interface CareTeamMember {
  name: string;
  role: string;
  specialty?: string;
  since: string;
  until?: string;
  contact?: string;
  isActive: boolean;
}

export interface HandoffRecord {
  timestamp: string;
  from: string;
  to: string;
  summary: string;
}

export interface DocumentRecord {
  id: string;
  type: 'evolucao' | 'resumo_alta' | 'consentimento' | 'prescricao' | 'laudo';
  title: string;
  author: string;
  date: string;
  status: 'rascunho' | 'finalizado' | 'assinado';
}

export interface AuditRecord {
  timestamp: string;
  actor: string;
  action: string;
  details: string;
  ip?: string;
}

export interface PatientCockpit {
  mrn: string;
  name: string;
  age: number;
  ward: string;
  bed: string;
  diagnosis: string;
  admissionDate: string;
  los: number;
  status: 'on-track' | 'at-risk' | 'blocked' | 'discharged';
  riskLevel: 'low' | 'medium' | 'high';
  consultant: string;
  bloodType: string;
  allergies: string[];
  weight: number;
  pendingItems: string[];
  events: TimelineEvent[];
  // Digital Twin data
  vitals: VitalSign[];
  medications: Medication[];
  labs: LabResult[];
  careTeam: CareTeamMember[];
  handoffs: HandoffRecord[];
  documents: DocumentRecord[];
  auditTrail: AuditRecord[];
  news2Score: number;
  news2Trend: { date: string; score: number }[];
  painLevel: number;
  lastAssessment: string;
  activeMedCount: number;
  pendingActions: { action: string; urgency: 'critico' | 'urgente' | 'normal'; assignedTo: string }[];
  currentResponsible: { physician: string; nurse: string; team: string };
}

export const COCKPITS: Record<string, PatientCockpit> = {
  'MRN-004': {
    mrn: 'MRN-004',
    name: 'Eleanor Voss',
    age: 81,
    ward: 'Ala 2A',
    bed: '2A-02',
    diagnosis: 'IAM \u2014 pos-ICP',
    admissionDate: '2026-03-30',
    los: 9,
    status: 'blocked',
    riskLevel: 'high',
    consultant: 'Dr. Mbeki',
    bloodType: 'A+',
    allergies: ['Penicilina', 'Contraste iodado'],
    weight: 62,
    painLevel: 2,
    news2Score: 3,
    lastAssessment: '09/04 08:00',
    activeMedCount: 5,
    currentResponsible: { physician: 'Dr. Mbeki', nurse: 'Enf. Costa', team: 'Cardiologia' },
    news2Trend: [
      { date: '03/04', score: 6 }, { date: '04/04', score: 5 }, { date: '05/04', score: 4 },
      { date: '06/04', score: 3 }, { date: '07/04', score: 3 }, { date: '08/04', score: 3 }, { date: '09/04', score: 3 },
    ],
    pendingItems: ['Transporte para transferencia pendente', 'Documentacao de alta incompleta'],
    pendingActions: [
      { action: 'Resolver transporte domiciliar (zona rural 85km)', urgency: 'critico', assignedTo: 'AS. Pereira' },
      { action: 'Finalizar relatorio de alta e encaminhamento', urgency: 'urgente', assignedTo: 'Dr. Mbeki' },
      { action: 'Agendar retorno cardiologia ambulatorial', urgency: 'normal', assignedTo: 'Enf. Costa' },
    ],
    vitals: [
      { timestamp: '09/04 08:00', fc: 72, pas: 124, pad: 76, fr: 16, spo2: 97, temp: 36.4, pain: 2 },
      { timestamp: '09/04 02:00', fc: 68, pas: 118, pad: 72, fr: 14, spo2: 96, temp: 36.2, pain: 1 },
      { timestamp: '08/04 20:00', fc: 76, pas: 130, pad: 80, fr: 18, spo2: 96, temp: 36.6, pain: 2 },
      { timestamp: '08/04 14:00', fc: 80, pas: 132, pad: 82, fr: 16, spo2: 97, temp: 36.5, pain: 2 },
      { timestamp: '08/04 08:00', fc: 74, pas: 126, pad: 78, fr: 16, spo2: 97, temp: 36.3, pain: 1 },
      { timestamp: '07/04 20:00', fc: 78, pas: 128, pad: 78, fr: 17, spo2: 96, temp: 36.5, pain: 2 },
    ],
    medications: [
      { id: 'm1', name: 'AAS', dose: '100mg', route: 'VO', frequency: '1x/dia', status: 'ativa', startDate: '30/03', nextDose: '09/04 08:00',
        administrations: [
          { time: '08/04 08:00', status: 'administrado' }, { time: '09/04 08:00', status: 'pendente' },
        ], interactions: [] },
      { id: 'm2', name: 'Clopidogrel', dose: '75mg', route: 'VO', frequency: '1x/dia', status: 'ativa', startDate: '30/03', nextDose: '09/04 08:00',
        administrations: [
          { time: '08/04 08:00', status: 'administrado' }, { time: '09/04 08:00', status: 'pendente' },
        ], interactions: ['AAS (risco sangramento — monitorar)'] },
      { id: 'm3', name: 'Atorvastatina', dose: '80mg', route: 'VO', frequency: '1x/dia (noite)', status: 'ativa', startDate: '30/03', nextDose: '09/04 22:00',
        administrations: [
          { time: '08/04 22:00', status: 'administrado' },
        ], interactions: [] },
      { id: 'm4', name: 'Metoprolol', dose: '50mg', route: 'VO', frequency: '12/12h', status: 'ativa', startDate: '30/03', nextDose: '09/04 08:00',
        administrations: [
          { time: '08/04 20:00', status: 'administrado' }, { time: '09/04 08:00', status: 'pendente' },
        ], interactions: [] },
      { id: 'm5', name: 'Ramipril', dose: '5mg', route: 'VO', frequency: '1x/dia', status: 'ativa', startDate: '04/04', nextDose: '09/04 08:00',
        administrations: [
          { time: '08/04 08:00', status: 'administrado' }, { time: '09/04 08:00', status: 'pendente' },
        ], interactions: [] },
      { id: 'm6', name: 'Enoxaparina', dose: '60mg', route: 'SC', frequency: '12/12h', status: 'suspensa', startDate: '30/03', endDate: '04/04',
        administrations: [], interactions: [] },
    ],
    labs: [
      { id: 'l1', name: 'Troponina I', category: 'laboratorio', status: 'concluido', requestDate: '30/03', resultDate: '08/04', value: '0.03', unit: 'ng/mL', reference: '<0.04', isCritical: false,
        trend: [{ date: '30/03', value: 2.8 }, { date: '31/03', value: 1.4 }, { date: '01/04', value: 0.6 }, { date: '04/04', value: 0.08 }, { date: '08/04', value: 0.03 }] },
      { id: 'l2', name: 'Creatinina', category: 'laboratorio', status: 'concluido', requestDate: '08/04', resultDate: '08/04', value: '1.1', unit: 'mg/dL', reference: '0.7-1.3',
        trend: [{ date: '30/03', value: 1.2 }, { date: '02/04', value: 1.3 }, { date: '05/04', value: 1.2 }, { date: '08/04', value: 1.1 }] },
      { id: 'l3', name: 'Glicemia jejum', category: 'laboratorio', status: 'concluido', requestDate: '09/04', resultDate: '09/04', value: '142', unit: 'mg/dL', reference: '70-100', isCritical: false,
        trend: [{ date: '30/03', value: 220 }, { date: '02/04', value: 180 }, { date: '05/04', value: 156 }, { date: '09/04', value: 142 }] },
      { id: 'l4', name: 'Ecocardiograma', category: 'imagem', status: 'concluido', requestDate: '31/03', resultDate: '31/03', value: 'FEVE 45% (reduzida). Hipocinesia inferior.' },
      { id: 'l5', name: 'Hemograma', category: 'laboratorio', status: 'solicitado', requestDate: '09/04' },
    ],
    careTeam: [
      { name: 'Dr. Mbeki', role: 'Medico Responsavel', specialty: 'Cardiologia', since: '30/03', isActive: true, contact: 'Ramal 2401' },
      { name: 'Enf. Costa', role: 'Enfermeiro(a) de Referencia', since: '05/04', isActive: true, contact: 'Ramal 2A-01' },
      { name: 'Ft. Oliveira', role: 'Fisioterapeuta', since: '02/04', isActive: true, contact: 'Ramal 3100' },
      { name: 'AS. Pereira', role: 'Assistente Social', since: '05/04', isActive: true, contact: 'Ramal 4200' },
      { name: 'Enf. Lima', role: 'Enfermeiro(a) UTI', since: '30/03', until: '01/04', isActive: false },
      { name: 'Dr. Almeida', role: 'Emergencista', since: '30/03', until: '30/03', isActive: false },
    ],
    handoffs: [
      { timestamp: '08/04 19:00', from: 'Enf. Costa', to: 'Enf. Martins', summary: 'Paciente estavel, aguardando resolucao de transporte. Medicacoes em dia. Proximo ECG amanha.' },
      { timestamp: '07/04 19:00', from: 'Enf. Silva', to: 'Enf. Costa', summary: 'Paciente deambulando. Bloqueio de alta ativo: transporte e documentacao.' },
      { timestamp: '05/04 08:00', from: 'Enf. Lima (UTI)', to: 'Enf. Costa (Ala 2A)', summary: 'Transferencia UTI para enfermaria. Plano de alta em discussao.' },
    ],
    documents: [
      { id: 'd1', type: 'evolucao', title: 'Evolucao medica D9', author: 'Dr. Mbeki', date: '09/04', status: 'assinado' },
      { id: 'd2', type: 'evolucao', title: 'Evolucao enfermagem D9', author: 'Enf. Costa', date: '09/04', status: 'finalizado' },
      { id: 'd3', type: 'resumo_alta', title: 'Resumo de alta', author: 'Dr. Mbeki', date: '07/04', status: 'rascunho' },
      { id: 'd4', type: 'prescricao', title: 'Prescricao de alta', author: 'Dr. Mbeki', date: '04/04', status: 'assinado' },
      { id: 'd5', type: 'consentimento', title: 'Termo de consentimento ICP', author: 'Dr. Mbeki', date: '30/03', status: 'assinado' },
      { id: 'd6', type: 'laudo', title: 'Laudo ecocardiograma', author: 'Dr. Santos', date: '31/03', status: 'assinado' },
    ],
    auditTrail: [
      { timestamp: '09/04 08:15', actor: 'Enf. Costa', action: 'Aferiu sinais vitais', details: 'PA 124x76, FC 72, SAT 97%' },
      { timestamp: '09/04 08:00', actor: 'Dr. Mbeki', action: 'Registrou evolucao medica', details: 'Evolucao D9 — paciente estavel' },
      { timestamp: '08/04 22:10', actor: 'Tec. Enf. Santos', action: 'Administrou medicacao', details: 'Atorvastatina 80mg VO' },
      { timestamp: '08/04 20:05', actor: 'Tec. Enf. Santos', action: 'Administrou medicacao', details: 'Metoprolol 50mg VO' },
      { timestamp: '08/04 14:30', actor: 'AS. Pereira', action: 'Atualizou status social', details: 'Contato com prefeitura para transporte — aguardando resposta' },
      { timestamp: '08/04 08:20', actor: 'Sistema', action: 'Alerta NEWS2', details: 'Score 3 — sem deterioracao' },
    ],
    events: [
      { id: 'e4-01', timestamp: '30/03 06:30', category: 'chamada', title: 'Chamada SAMU 192', description: 'Paciente relata dor toracica intensa, irradiacao para braco esquerdo, sudorese. Historico de HAS e DM2. SAMU acionado.', author: 'Central SAMU', role: 'Regulador', location: 'Central 192' },
      { id: 'e4-02', timestamp: '30/03 06:45', category: 'emergencia', title: 'Ambulancia acionada', description: 'USA despachada. PA 180x100, FC 110, SAT 92%. Morfina 4mg IV.', author: 'Dr. Ferreira', role: 'Medico SAMU', location: 'Residencia paciente' },
      { id: 'e4-03', timestamp: '30/03 07:10', category: 'admissao', title: 'Chegada ao PA — Triagem Manchester', description: 'Classificada VERMELHO (emergencia). Dor toracica com alteracao hemodinamica.', author: 'Enf. Souza', role: 'Enfermeiro Triagem', location: 'Pronto Atendimento' },
      { id: 'e4-04', timestamp: '30/03 07:15', category: 'avaliacao', title: 'Avaliacao medica emergencial', description: 'ECG: supra ST em DII, DIII, aVF. Troponina 2.8 ng/mL. IAMCST inferior. Protocolo SCA ativado.', author: 'Dr. Almeida', role: 'Emergencista', location: 'Sala de Emergencia' },
      { id: 'e4-05', timestamp: '30/03 07:20', category: 'exame', title: 'ECG e laboratoriais', description: 'ECG 12 derivacoes confirmando IAMCST. Hemograma, coagulograma, funcao renal. Cr 1.2, K 4.1.', author: 'Equipe Laboratorio', role: 'Biomedicina', location: 'Laboratorio Central' },
      { id: 'e4-06', timestamp: '30/03 07:30', category: 'medicacao', title: 'Medicamentos pre-hemodinamica', description: 'AAS 300mg, Clopidogrel 600mg, Heparina 5000UI IV. Meta porta-balao <90min.', author: 'Dr. Almeida', role: 'Emergencista', location: 'Sala de Emergencia' },
      { id: 'e4-07', timestamp: '30/03 08:00', category: 'avaliacao', title: 'ICP realizada com sucesso', description: 'Angioplastia primaria via radial. Lesao critica CD proximal 99%. Stent 3.0x28mm. Fluxo TIMI 3.', author: 'Dr. Mbeki', role: 'Hemodinamicista', location: 'Hemodinamica' },
      { id: 'e4-08', timestamp: '30/03 08:45', category: 'admissao', title: 'Transferencia para UTI Coronariana', description: 'Leito 2A-02. Monitorizacao continua, acesso central, cateter arterial. NEWS: 6.', author: 'Enf. Lima', role: 'Enfermeiro UTI', location: 'UTI Coronariana' },
      { id: 'e4-09', timestamp: '30/03 09:00', category: 'medicacao', title: 'Prescricao pos-ICP', description: 'AAS, Clopidogrel, Enoxaparina, Atorvastatina, Metoprolol, Captopril, Omeprazol. Controle glicemia.', author: 'Dr. Mbeki', role: 'Cardiologista', location: 'UTI Coronariana' },
      { id: 'e4-10', timestamp: '30/03 10:00', category: 'avaliacao', title: 'Sinais vitais estaveis', description: 'PA 128x76, FC 78, SAT 97% AA. Curativo puncao integro. Dor 2/10.', author: 'Enf. Lima', role: 'Enfermeiro UTI', location: 'UTI Coronariana' },
      { id: 'e4-11', timestamp: '30/03 14:00', category: 'evolucao', title: 'Evolucao favoravel', description: 'Estavel, sem dor. Troponina descendente. ECG sem novas alteracoes. Eco amanha.', author: 'Dr. Mbeki', role: 'Cardiologista', location: 'UTI Coronariana' },
      { id: 'e4-12', timestamp: '31/03 08:00', category: 'exame', title: 'Ecocardiograma', description: 'FEVE 45% (reduzida). Hipocinesia inferior. Valvas normais. Otimizar IECA.', author: 'Dr. Santos', role: 'Ecocardiografista', location: 'Cardiologia' },
      { id: 'e4-13', timestamp: '31/03 14:00', category: 'handoff', title: 'Handoff plantao noturno', description: 'D2 pos-ICP. FEVE 45%. Manter dupla antiagregacao. Atencao: DM2.', author: 'Enf. Lima', role: 'Enfermeiro UTI', location: 'UTI Coronariana' },
      { id: 'e4-14', timestamp: '01/04 10:00', category: 'admissao', title: 'Transferencia para enfermaria', description: 'Transferida para Ala 2A, leito 02. Estavel, deambulando. Dieta hipossodica.', author: 'Dr. Mbeki', role: 'Cardiologista', location: 'Ala 2A' },
      { id: 'e4-15', timestamp: '02/04 09:00', category: 'avaliacao', title: 'Avaliacao fisioterapia', description: 'Deambula 50m com supervisao. Tolerancia moderada. Progressao gradual.', author: 'Ft. Oliveira', role: 'Fisioterapeuta', location: 'Ala 2A' },
      { id: 'e4-16', timestamp: '03/04 14:00', category: 'evolucao', title: 'Evolucao D4', description: 'Sem dor, afebril. ECG estavel. Marcadores normalizados. Alta em discussao.', author: 'Dr. Mbeki', role: 'Cardiologista', location: 'Ala 2A' },
      { id: 'e4-17', timestamp: '04/04 10:00', category: 'medicacao', title: 'Ajuste para alta', description: 'Suspensa enoxaparina. Mantido: AAS, Clopidogrel, Atorvastatina, Metoprolol, Ramipril.', author: 'Dr. Mbeki', role: 'Cardiologista', location: 'Ala 2A' },
      { id: 'e4-18', timestamp: '05/04 08:00', category: 'handoff', title: 'Handoff plano de alta', description: 'Apta para alta. BLOQUEIO: transporte indisponivel. Servico social acionado.', author: 'Enf. Costa', role: 'Enfermeiro', location: 'Ala 2A' },
      { id: 'e4-19', timestamp: '06/04 11:00', category: 'alerta', title: 'Bloqueio — transporte', description: 'Transporte indisponivel para domicilio (zona rural, 85km). Articulando com prefeitura.', author: 'AS. Pereira', role: 'Assistente Social', location: 'Servico Social', pending: true },
      { id: 'e4-20', timestamp: '07/04 09:00', category: 'alerta', title: 'Bloqueio — documentacao', description: 'Relatorio de alta e encaminhamento pendentes.', author: 'Enf. Costa', role: 'Enfermeiro', location: 'Ala 2A', pending: true },
    ],
  },
  'MRN-013': {
    mrn: 'MRN-013',
    name: 'Peter Hawkins',
    age: 84,
    ward: 'Ala 2A',
    bed: '2A-10',
    diagnosis: 'Sepse — recuperacao',
    admissionDate: '2026-03-25',
    los: 14,
    status: 'blocked',
    riskLevel: 'high',
    consultant: 'Dr. Osei',
    bloodType: 'O+',
    allergies: ['Sulfas'],
    weight: 58,
    painLevel: 1,
    news2Score: 2,
    lastAssessment: '09/04 07:30',
    activeMedCount: 3,
    currentResponsible: { physician: 'Dr. Osei', nurse: 'Enf. Santos', team: 'Clinica Medica' },
    news2Trend: [
      { date: '25/03', score: 10 }, { date: '27/03', score: 8 }, { date: '29/03', score: 5 },
      { date: '31/03', score: 4 }, { date: '02/04', score: 3 }, { date: '05/04', score: 2 }, { date: '09/04', score: 2 },
    ],
    pendingItems: ['Vaga em casa de repouso', 'Avaliacao servico social', 'DOLS em andamento', 'Familia nao localizada'],
    pendingActions: [
      { action: 'Encontrar vaga em casa de repouso (lista de espera 2-3 semanas)', urgency: 'critico', assignedTo: 'AS. Mendes' },
      { action: 'Localizar sobrinho para discussao de plano', urgency: 'urgente', assignedTo: 'AS. Mendes' },
      { action: 'Concluir avaliacao DOLS / capacidade de decisao', urgency: 'urgente', assignedTo: 'Dra. Tanaka' },
      { action: 'Completar antibioticoterapia (D14)', urgency: 'normal', assignedTo: 'Dr. Osei' },
    ],
    vitals: [
      { timestamp: '09/04 07:30', fc: 76, pas: 118, pad: 68, fr: 16, spo2: 95, temp: 36.6, pain: 1 },
      { timestamp: '09/04 01:00', fc: 72, pas: 112, pad: 66, fr: 14, spo2: 94, temp: 36.4, pain: 0 },
      { timestamp: '08/04 19:00', fc: 78, pas: 120, pad: 70, fr: 16, spo2: 95, temp: 36.5, pain: 1 },
      { timestamp: '08/04 13:00', fc: 80, pas: 122, pad: 72, fr: 18, spo2: 95, temp: 36.7, pain: 1 },
      { timestamp: '08/04 07:00', fc: 74, pas: 116, pad: 68, fr: 16, spo2: 94, temp: 36.5, pain: 1 },
    ],
    medications: [
      { id: 'm1', name: 'Ciprofloxacino', dose: '500mg', route: 'VO', frequency: '12/12h', status: 'ativa', startDate: '01/04', endDate: '08/04', nextDose: '09/04 08:00',
        administrations: [
          { time: '08/04 20:00', status: 'administrado' }, { time: '09/04 08:00', status: 'pendente' },
        ], interactions: [] },
      { id: 'm2', name: 'Omeprazol', dose: '20mg', route: 'VO', frequency: '1x/dia', status: 'ativa', startDate: '25/03', nextDose: '09/04 08:00',
        administrations: [
          { time: '08/04 08:00', status: 'administrado' }, { time: '09/04 08:00', status: 'pendente' },
        ], interactions: [] },
      { id: 'm3', name: 'Enoxaparina', dose: '40mg', route: 'SC', frequency: '1x/dia', status: 'ativa', startDate: '25/03', nextDose: '09/04 22:00',
        administrations: [
          { time: '08/04 22:00', status: 'administrado' },
        ], interactions: [] },
      { id: 'm4', name: 'Meropenem', dose: '1g', route: 'IV', frequency: '8/8h', status: 'concluida', startDate: '25/03', endDate: '01/04',
        administrations: [], interactions: [] },
      { id: 'm5', name: 'Vancomicina', dose: '1g', route: 'IV', frequency: '12/12h', status: 'concluida', startDate: '25/03', endDate: '30/03',
        administrations: [], interactions: [] },
      { id: 'm6', name: 'Noradrenalina', dose: 'BIC', route: 'IV', frequency: 'continuo', status: 'concluida', startDate: '25/03', endDate: '28/03',
        administrations: [], interactions: [] },
    ],
    labs: [
      { id: 'l1', name: 'PCR', category: 'laboratorio', status: 'concluido', requestDate: '08/04', resultDate: '08/04', value: '12', unit: 'mg/L', reference: '<5',
        trend: [{ date: '25/03', value: 280 }, { date: '27/03', value: 180 }, { date: '30/03', value: 80 }, { date: '02/04', value: 28 }, { date: '05/04', value: 18 }, { date: '08/04', value: 12 }] },
      { id: 'l2', name: 'Leucocitos', category: 'laboratorio', status: 'concluido', requestDate: '08/04', resultDate: '08/04', value: '8.200', unit: '/mm3', reference: '4.000-10.000',
        trend: [{ date: '25/03', value: 22000 }, { date: '27/03', value: 16000 }, { date: '30/03', value: 11000 }, { date: '02/04', value: 9000 }, { date: '08/04', value: 8200 }] },
      { id: 'l3', name: 'Creatinina', category: 'laboratorio', status: 'concluido', requestDate: '08/04', resultDate: '08/04', value: '0.9', unit: 'mg/dL', reference: '0.7-1.3',
        trend: [{ date: '25/03', value: 2.1 }, { date: '27/03', value: 1.8 }, { date: '30/03', value: 1.3 }, { date: '02/04', value: 1.0 }, { date: '08/04', value: 0.9 }] },
      { id: 'l4', name: 'Hemocultura', category: 'laboratorio', status: 'concluido', requestDate: '25/03', resultDate: '27/03', value: 'E. coli ESBL+' },
      { id: 'l5', name: 'Procalcitonina', category: 'laboratorio', status: 'solicitado', requestDate: '09/04' },
    ],
    careTeam: [
      { name: 'Dr. Osei', role: 'Medico Responsavel', specialty: 'Clinica Medica', since: '25/03', isActive: true, contact: 'Ramal 2200' },
      { name: 'Enf. Santos', role: 'Enfermeiro(a) de Referencia', since: '30/03', isActive: true, contact: 'Ramal 2A-01' },
      { name: 'Dra. Tanaka', role: 'Geriatra', since: '31/03', isActive: true, contact: 'Ramal 3300' },
      { name: 'AS. Mendes', role: 'Assistente Social', since: '29/03', isActive: true, contact: 'Ramal 4200' },
      { name: 'Ft. Ribeiro', role: 'Fisioterapeuta', since: '30/03', isActive: true, contact: 'Ramal 3100' },
    ],
    handoffs: [
      { timestamp: '08/04 19:00', from: 'Enf. Santos', to: 'Enf. Rocha', summary: 'Paciente estavel. Antibiotico oral ate D14. Aguardando vaga casa de repouso e contato familiar.' },
      { timestamp: '07/04 19:00', from: 'Enf. Rocha', to: 'Enf. Santos', summary: 'Sem intercorrencias. DOLS em andamento. Sobrinho nao atende.' },
    ],
    documents: [
      { id: 'd1', type: 'evolucao', title: 'Evolucao D14', author: 'Dr. Osei', date: '09/04', status: 'assinado' },
      { id: 'd2', type: 'laudo', title: 'Avaliacao geriatrica', author: 'Dra. Tanaka', date: '31/03', status: 'assinado' },
      { id: 'd3', type: 'resumo_alta', title: 'Resumo de alta (rascunho)', author: 'Dr. Osei', date: '06/04', status: 'rascunho' },
      { id: 'd4', type: 'consentimento', title: 'Termo DOLS', author: 'Dra. Tanaka', date: '08/04', status: 'rascunho' },
    ],
    auditTrail: [
      { timestamp: '09/04 07:35', actor: 'Enf. Santos', action: 'Aferiu sinais vitais', details: 'PA 118x68, FC 76, SAT 95%' },
      { timestamp: '09/04 07:00', actor: 'Dr. Osei', action: 'Registrou evolucao', details: 'D14 — antibiotico concluido hoje' },
      { timestamp: '08/04 20:10', actor: 'Tec. Enf. Lima', action: 'Administrou medicacao', details: 'Ciprofloxacino 500mg VO' },
      { timestamp: '08/04 14:00', actor: 'AS. Mendes', action: 'Tentativa contato familiar', details: 'Sobrinho — caixa postal' },
    ],
    events: [
      { id: 'e13-01', timestamp: '25/03 14:00', category: 'chamada', title: 'Transferencia de outro hospital', description: 'Transferido do Hospital Municipal com sepse urinaria. Antibiotico empirico ha 24h sem melhora.', author: 'Dra. Rodrigues', role: 'Medica Reguladora', location: 'Central de Regulacao' },
      { id: 'e13-02', timestamp: '25/03 15:30', category: 'admissao', title: 'Admissao UTI', description: 'Glasgow 13, PA 85x50, FC 120, SAT 89%. Lactato 4.8. Protocolo sepse ativado.', author: 'Dr. Osei', role: 'Intensivista', location: 'UTI' },
      { id: 'e13-03', timestamp: '25/03 16:00', category: 'exame', title: 'Painel laboratorial', description: 'Hemoculturas, urocultura, PCR 280, procalcitonina 18.5, Cr 2.1, leucocitos 22.000.', author: 'Equipe Laboratorio', role: 'Biomedicina', location: 'Laboratorio Central' },
      { id: 'e13-04', timestamp: '25/03 16:30', category: 'medicacao', title: 'Escalonamento antibiotico', description: 'Meropenem 1g 8/8h + Vancomicina 1g 12/12h. Noradrenalina BIC. SF 30mL/kg.', author: 'Dr. Osei', role: 'Intensivista', location: 'UTI' },
      { id: 'e13-05', timestamp: '26/03 08:00', category: 'avaliacao', title: 'Round UTI D1', description: 'Sedado, IOT, VM PCV. Nora 0.3mcg/kg/min. Diurese 30mL/h. Lactato 3.2.', author: 'Dr. Osei', role: 'Intensivista', location: 'UTI' },
      { id: 'e13-06', timestamp: '27/03 08:00', category: 'evolucao', title: 'Melhora parcial D2', description: 'Nora reduzida 0.15. Lactato 2.0. Hemocultura: E. coli ESBL+. Tentativa desmame VM.', author: 'Dr. Osei', role: 'Intensivista', location: 'UTI' },
      { id: 'e13-07', timestamp: '28/03 10:00', category: 'avaliacao', title: 'Extubacao bem-sucedida', description: 'TRE 30min. O2 3L cateter. SAT 94%. Consciente, colaborativo, desorientado.', author: 'Dr. Osei', role: 'Intensivista', location: 'UTI' },
      { id: 'e13-08', timestamp: '29/03 14:00', category: 'handoff', title: 'Complexidade social', description: 'Sem familia (viuvo, sem filhos). Morava em pensao. Servico social acionado.', author: 'Enf. Santos', role: 'Enfermeiro UTI', location: 'UTI' },
      { id: 'e13-09', timestamp: '30/03 10:00', category: 'admissao', title: 'Transferencia para enfermaria', description: 'Estavel, Ala 2A leito 10. Meropenem D5 (14 dias total). Fisioterapia iniciada.', author: 'Dr. Osei', role: 'Clinico', location: 'Ala 2A' },
      { id: 'e13-10', timestamp: '31/03 09:00', category: 'avaliacao', title: 'Avaliacao geriatrica', description: 'Katz 3/6, Lawton 2/8. Delirium em resolucao. Risco quedas alto. Cuidados longa permanencia.', author: 'Dra. Tanaka', role: 'Geriatra', location: 'Ala 2A' },
      { id: 'e13-11', timestamp: '01/04 14:00', category: 'medicacao', title: 'Troca para oral', description: 'Meropenem D7. Afebril 72h. PCR 28. Ciprofloxacino 500mg 12/12h VO.', author: 'Dr. Osei', role: 'Clinico', location: 'Ala 2A' },
      { id: 'e13-12', timestamp: '02/04 10:00', category: 'handoff', title: 'Reuniao multiprofissional', description: 'Precisa casa de repouso. Lista espera 2-3 semanas. DOLS pode ser necessario.', author: 'Equipe Multi', role: 'Multi', location: 'Sala de Reuniao' },
      { id: 'e13-13', timestamp: '04/04 09:00', category: 'avaliacao', title: 'Fisioterapia — progressao', description: 'Deambula 20m com andador. Forca melhorando. Insuficiente para vida independente.', author: 'Ft. Ribeiro', role: 'Fisioterapeuta', location: 'Ala 2A' },
      { id: 'e13-14', timestamp: '06/04 11:00', category: 'alerta', title: 'Bloqueio — casa de repouso', description: 'Nenhuma vaga disponivel. Estimativa 2 semanas. Clinicamente apto, sem destino.', author: 'AS. Mendes', role: 'Assistente Social', location: 'Servico Social', pending: true },
      { id: 'e13-15', timestamp: '07/04 14:00', category: 'alerta', title: 'Bloqueio — familia', description: 'Sobrinho nao atende. Necessario para plano terapeutico e consentimento.', author: 'AS. Mendes', role: 'Assistente Social', location: 'Servico Social', pending: true },
      { id: 'e13-16', timestamp: '08/04 09:00', category: 'alerta', title: 'DOLS iniciada', description: 'Episodios de confusao. Avaliacao capacidade decisao em andamento. Possivel curatela.', author: 'Dra. Tanaka', role: 'Geriatra', location: 'Ala 2A', pending: true },
    ],
  },
  'MRN-001': {
    mrn: 'MRN-001',
    name: 'James Whitfield',
    age: 68,
    ward: 'Ala 1A',
    bed: '1A-04',
    diagnosis: 'Fratura de quadril pos-op',
    admissionDate: '2026-04-01',
    los: 7,
    status: 'on-track',
    riskLevel: 'low',
    consultant: 'Dr. Patel',
    bloodType: 'B+',
    allergies: [],
    weight: 78,
    painLevel: 3,
    news2Score: 1,
    lastAssessment: '09/04 08:00',
    activeMedCount: 3,
    currentResponsible: { physician: 'Dr. Patel', nurse: 'Enf. Silva', team: 'Ortopedia' },
    news2Trend: [
      { date: '01/04', score: 4 }, { date: '02/04', score: 3 }, { date: '03/04', score: 2 },
      { date: '05/04', score: 2 }, { date: '07/04', score: 1 }, { date: '09/04', score: 1 },
    ],
    pendingItems: [],
    pendingActions: [
      { action: 'Alta prevista hoje — confirmar prescricao domiciliar', urgency: 'normal', assignedTo: 'Dr. Patel' },
      { action: 'Remocao de pontos em 10 dias (retorno agendado)', urgency: 'normal', assignedTo: 'Ambulatorio' },
    ],
    vitals: [
      { timestamp: '09/04 08:00', fc: 70, pas: 132, pad: 80, fr: 14, spo2: 98, temp: 36.4, pain: 3 },
      { timestamp: '08/04 20:00', fc: 72, pas: 128, pad: 78, fr: 15, spo2: 97, temp: 36.5, pain: 3 },
      { timestamp: '08/04 08:00', fc: 68, pas: 130, pad: 78, fr: 14, spo2: 98, temp: 36.3, pain: 2 },
    ],
    medications: [
      { id: 'm1', name: 'Enoxaparina', dose: '40mg', route: 'SC', frequency: '1x/dia', status: 'ativa', startDate: '01/04', nextDose: '09/04 22:00',
        administrations: [
          { time: '08/04 22:00', status: 'administrado' },
        ], interactions: [] },
      { id: 'm2', name: 'Paracetamol', dose: '750mg', route: 'VO', frequency: '6/6h SN', status: 'ativa', startDate: '02/04',
        administrations: [
          { time: '08/04 22:00', status: 'administrado' }, { time: '09/04 06:00', status: 'administrado' },
        ], interactions: [] },
      { id: 'm3', name: 'Tramadol', dose: '50mg', route: 'VO', frequency: '6/6h SN', status: 'ativa', startDate: '01/04',
        administrations: [
          { time: '08/04 14:00', status: 'omitido' },
        ], interactions: [] },
      { id: 'm4', name: 'Cefazolina', dose: '1g', route: 'IV', frequency: '8/8h', status: 'concluida', startDate: '02/04', endDate: '04/04',
        administrations: [], interactions: [] },
    ],
    labs: [
      { id: 'l1', name: 'Hemoglobina', category: 'laboratorio', status: 'concluido', requestDate: '08/04', resultDate: '08/04', value: '11.8', unit: 'g/dL', reference: '12-16',
        trend: [{ date: '01/04', value: 10.2 }, { date: '03/04', value: 10.8 }, { date: '08/04', value: 11.8 }] },
      { id: 'l2', name: 'Rx quadril controle', category: 'imagem', status: 'concluido', requestDate: '04/04', resultDate: '04/04', value: 'Material de sintese em boa posicao. Sem complicacoes.' },
    ],
    careTeam: [
      { name: 'Dr. Patel', role: 'Medico Responsavel', specialty: 'Ortopedia', since: '01/04', isActive: true, contact: 'Ramal 1100' },
      { name: 'Enf. Silva', role: 'Enfermeiro(a) de Referencia', since: '01/04', isActive: true, contact: 'Ramal 1A-01' },
      { name: 'Ft. Oliveira', role: 'Fisioterapeuta', since: '03/04', isActive: true, contact: 'Ramal 3100' },
    ],
    handoffs: [
      { timestamp: '08/04 19:00', from: 'Enf. Silva', to: 'Enf. Pereira', summary: 'Paciente estavel, deambulando independente. Alta prevista amanha. Esposa orientada.' },
    ],
    documents: [
      { id: 'd1', type: 'evolucao', title: 'Evolucao D7 — alta', author: 'Dr. Patel', date: '08/04', status: 'assinado' },
      { id: 'd2', type: 'resumo_alta', title: 'Resumo de alta', author: 'Dr. Patel', date: '08/04', status: 'assinado' },
      { id: 'd3', type: 'prescricao', title: 'Prescricao domiciliar', author: 'Dr. Patel', date: '08/04', status: 'assinado' },
      { id: 'd4', type: 'consentimento', title: 'Termo cirurgico DHS', author: 'Dr. Patel', date: '01/04', status: 'assinado' },
    ],
    auditTrail: [
      { timestamp: '09/04 08:10', actor: 'Enf. Silva', action: 'Aferiu sinais vitais', details: 'PA 132x80, FC 70, SAT 98%' },
      { timestamp: '08/04 16:00', actor: 'Dr. Patel', action: 'Assinou alta hospitalar', details: 'Alta medica concedida' },
      { timestamp: '08/04 10:00', actor: 'Enf. Silva', action: 'Orientacao de alta', details: 'Esposa orientada sobre curativos' },
    ],
    events: [
      { id: 'e1-01', timestamp: '01/04 09:15', category: 'chamada', title: 'Chamada SAMU 192', description: 'Queda em casa, dor quadril direito, impotencia funcional.', author: 'Central SAMU', role: 'Regulador', location: 'Central 192' },
      { id: 'e1-02', timestamp: '01/04 09:40', category: 'emergencia', title: 'Chegada ambulancia', description: 'Imobilizado, Dipirona 1g IV. PA 150x90, FC 92, Dor 8/10.', author: 'Soc. Martins', role: 'Socorrista', location: 'Residencia' },
      { id: 'e1-03', timestamp: '01/04 10:15', category: 'admissao', title: 'Triagem laranja', description: 'Dor intensa com deformidade quadril D.', author: 'Enf. Ferreira', role: 'Enfermeiro Triagem', location: 'PA' },
      { id: 'e1-04', timestamp: '01/04 10:30', category: 'exame', title: 'Rx quadril e bacia', description: 'Fratura transtrocanterica femur D (Tronzo III). TC para planejamento.', author: 'Dr. Patel', role: 'Ortopedista', location: 'Radiologia' },
      { id: 'e1-05', timestamp: '01/04 11:00', category: 'avaliacao', title: 'Pre-operatoria', description: 'ASA II (HAS controlada). Cirurgia agendada 02/04 7h (DHS).', author: 'Dr. Patel', role: 'Ortopedista', location: 'Consultorio' },
      { id: 'e1-06', timestamp: '01/04 14:00', category: 'admissao', title: 'Internacao Ala 1A', description: 'Leito 04. Tracao cutanea, Tramadol, Dipirona, Enoxaparina.', author: 'Enf. Silva', role: 'Enfermeiro', location: 'Ala 1A' },
      { id: 'e1-07', timestamp: '02/04 07:00', category: 'avaliacao', title: 'Cirurgia — osteossintese DHS', description: '1h20min, sangramento 300mL. Anestesia raqui + sedacao.', author: 'Dr. Patel', role: 'Ortopedista', location: 'CC' },
      { id: 'e1-08', timestamp: '02/04 09:30', category: 'medicacao', title: 'Prescricao pos-op', description: 'Cefazolina 1g 8/8h, Enoxaparina 40mg, Tramadol, Dipirona, Omeprazol.', author: 'Dr. Patel', role: 'Ortopedista', location: 'Ala 1A' },
      { id: 'e1-09', timestamp: '03/04 08:00', category: 'avaliacao', title: 'Fisioterapia D1', description: 'Sentou beira leito. Isometricos quadriceps. Meta D2: transferencia.', author: 'Ft. Oliveira', role: 'Fisioterapeuta', location: 'Ala 1A' },
      { id: 'e1-10', timestamp: '04/04 08:00', category: 'evolucao', title: 'Evolucao D2', description: 'Transferiu leito-cadeira. Ferida limpa. Rx: material bom. Dor 3/10.', author: 'Dr. Patel', role: 'Ortopedista', location: 'Ala 1A' },
      { id: 'e1-11', timestamp: '05/04 09:00', category: 'avaliacao', title: 'Deambulacao', description: '30m com andador, boa tolerancia.', author: 'Ft. Oliveira', role: 'Fisioterapeuta', location: 'Ala 1A' },
      { id: 'e1-12', timestamp: '06/04 14:00', category: 'evolucao', title: 'Evolucao D4', description: 'Deambulando independente com andador. Alta prevista D7.', author: 'Dr. Patel', role: 'Ortopedista', location: 'Ala 1A' },
      { id: 'e1-13', timestamp: '07/04 10:00', category: 'handoff', title: 'Orientacao alta familiar', description: 'Esposa orientada. Retorno 10 dias. Fisio ambulatorial agendada.', author: 'Enf. Silva', role: 'Enfermeiro', location: 'Ala 1A' },
      { id: 'e1-14', timestamp: '08/04 10:00', category: 'alta', title: 'Alta hospitalar', description: 'Enoxaparina 40mg 14 dias, Paracetamol SN. Retorno ortopedia 10 dias.', author: 'Dr. Patel', role: 'Ortopedista', location: 'Ala 1A' },
    ],
  },
};

export interface PatientInfo {
  name: string;
  mrn: string;
  ward: string;
  bed: string;
}

export const PATIENT_INFO: Record<string, PatientInfo> = {
  'MRN-004': { name: 'Eleanor Voss', mrn: 'MRN-004', ward: 'Ala 2A', bed: '2A-02' },
  'MRN-013': { name: 'Peter Hawkins', mrn: 'MRN-013', ward: 'Ala 2A', bed: '2A-10' },
  'MRN-001': { name: 'James Whitfield', mrn: 'MRN-001', ward: 'Ala 1A', bed: '1A-04' },
};
