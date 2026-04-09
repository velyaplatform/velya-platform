'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';

// ===========================================================================
// Types
// ===========================================================================

type EventCategory =
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

interface TimelineEvent {
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

interface VitalSign {
  timestamp: string;
  fc: number;
  pas: number;
  pad: number;
  fr: number;
  spo2: number;
  temp: number;
  pain: number;
}

interface Medication {
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

interface LabResult {
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

interface CareTeamMember {
  name: string;
  role: string;
  specialty?: string;
  since: string;
  until?: string;
  contact?: string;
  isActive: boolean;
}

interface HandoffRecord {
  timestamp: string;
  from: string;
  to: string;
  summary: string;
}

interface DocumentRecord {
  id: string;
  type: 'evolucao' | 'resumo_alta' | 'consentimento' | 'prescricao' | 'laudo';
  title: string;
  author: string;
  date: string;
  status: 'rascunho' | 'finalizado' | 'assinado';
}

interface AuditRecord {
  timestamp: string;
  actor: string;
  action: string;
  details: string;
  ip?: string;
}

interface PatientCockpit {
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

// ===========================================================================
// Category config
// ===========================================================================

const CATEGORY_CONFIG: Record<
  EventCategory,
  { icon: string; label: string; colorBg: string; colorText: string; colorBorder: string }
> = {
  emergencia: { icon: '\uD83D\uDE91', label: 'Emergencia', colorBg: 'bg-red-50', colorText: 'text-red-700', colorBorder: 'border-red-400' },
  admissao: { icon: '\uD83C\uDFE5', label: 'Admissao', colorBg: 'bg-blue-50', colorText: 'text-blue-700', colorBorder: 'border-blue-400' },
  avaliacao: { icon: '\uD83D\uDC68\u200D\u2695\uFE0F', label: 'Avaliacao', colorBg: 'bg-green-50', colorText: 'text-green-700', colorBorder: 'border-green-400' },
  medicacao: { icon: '\uD83D\uDC8A', label: 'Medicacao', colorBg: 'bg-purple-50', colorText: 'text-purple-700', colorBorder: 'border-purple-400' },
  exame: { icon: '\uD83D\uDD2C', label: 'Exame', colorBg: 'bg-orange-50', colorText: 'text-orange-700', colorBorder: 'border-orange-400' },
  evolucao: { icon: '\uD83D\uDCCB', label: 'Evolucao', colorBg: 'bg-gray-50', colorText: 'text-gray-700', colorBorder: 'border-gray-400' },
  handoff: { icon: '\uD83E\uDD1D', label: 'Handoff', colorBg: 'bg-yellow-50', colorText: 'text-yellow-700', colorBorder: 'border-yellow-400' },
  alerta: { icon: '\u26A0\uFE0F', label: 'Alerta', colorBg: 'bg-red-50', colorText: 'text-red-700', colorBorder: 'border-red-400' },
  chamada: { icon: '\uD83D\uDCDE', label: 'Chamada', colorBg: 'bg-cyan-50', colorText: 'text-cyan-700', colorBorder: 'border-cyan-400' },
  alta: { icon: '\uD83C\uDFE0', label: 'Alta', colorBg: 'bg-emerald-50', colorText: 'text-emerald-700', colorBorder: 'border-emerald-400' },
};

const ALL_CATEGORIES: EventCategory[] = [
  'emergencia', 'admissao', 'avaliacao', 'medicacao', 'exame',
  'evolucao', 'handoff', 'alerta', 'chamada', 'alta',
];

// ===========================================================================
// NEWS2 Score Color
// ===========================================================================

function news2Color(score: number): string {
  if (score >= 7) return 'bg-red-600 text-white';
  if (score >= 5) return 'bg-orange-500 text-white';
  if (score >= 3) return 'bg-amber-400 text-slate-900';
  return 'bg-green-500 text-white';
}

function news2Label(score: number): string {
  if (score >= 7) return 'ALTO RISCO';
  if (score >= 5) return 'MEDIO-ALTO';
  if (score >= 3) return 'MEDIO';
  return 'BAIXO';
}

// ===========================================================================
// Mock Data: Coherent patient stories
// ===========================================================================

const COCKPITS: Record<string, PatientCockpit> = {
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

// ===========================================================================
// Status / Risk helpers
// ===========================================================================

const STATUS_LABELS: Record<string, string> = { 'on-track': 'No Prazo', 'at-risk': 'Em Risco', blocked: 'Bloqueado', discharged: 'Alta' };
const STATUS_COLORS: Record<string, string> = { 'on-track': 'bg-green-100 text-green-800', 'at-risk': 'bg-amber-100 text-amber-800', blocked: 'bg-red-100 text-red-800', discharged: 'bg-gray-100 text-gray-800' };
const RISK_LABELS: Record<string, string> = { high: 'Alto', medium: 'Medio', low: 'Baixo' };
const RISK_COLORS: Record<string, string> = { high: 'bg-red-100 text-red-800', medium: 'bg-amber-100 text-amber-800', low: 'bg-green-100 text-green-800' };

// ===========================================================================
// Tab definitions
// ===========================================================================

const TABS = [
  { id: 'resumo', label: 'Resumo Atual', icon: '\u26A1' },
  { id: 'timeline', label: 'Timeline', icon: '\uD83D\uDCC5' },
  { id: 'medicacao', label: 'Medicacao', icon: '\uD83D\uDC8A' },
  { id: 'exames', label: 'Exames', icon: '\uD83D\uDD2C' },
  { id: 'sinais', label: 'Sinais Vitais', icon: '\uD83D\uDCC8' },
  { id: 'equipe', label: 'Equipe', icon: '\uD83D\uDC65' },
  { id: 'documentos', label: 'Documentos', icon: '\uD83D\uDCC4' },
  { id: 'auditoria', label: 'Auditoria', icon: '\uD83D\uDD12' },
] as const;

type TabId = typeof TABS[number]['id'];

// ===========================================================================
// Component
// ===========================================================================

export default function PatientCockpitPage() {
  const params = useParams();
  const patientId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabId>('resumo');
  const [selectedCategories, setSelectedCategories] = useState<Set<EventCategory>>(new Set(ALL_CATEGORIES));
  const [realEvents, setRealEvents] = useState<TimelineEvent[]>([]);

  const cockpit = COCKPITS[patientId];

  // Fetch real events
  useEffect(() => {
    if (!patientId) return;
    fetch(`/api/patients/events?patientId=${encodeURIComponent(patientId)}`)
      .then((res) => res.ok ? res.json() : { events: [] })
      .then((data) => {
        if (data.events && Array.isArray(data.events)) {
          setRealEvents(data.events.map((e: Record<string, string>) => ({
            id: e.id,
            timestamp: new Date(e.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
            category: e.category as EventCategory,
            title: e.title,
            description: e.description || '',
            author: e.author || 'unknown',
            role: e.role || '',
            location: e.location || '',
            pending: e.priority === 'critico',
          })));
        }
      })
      .catch(() => {});
  }, [patientId]);

  const allEvents = useMemo(() => {
    const mock = cockpit ? cockpit.events : [];
    return [...mock, ...realEvents];
  }, [cockpit, realEvents]);

  const filteredEvents = useMemo(
    () => allEvents.filter((e) => selectedCategories.has(e.category)),
    [allEvents, selectedCategories],
  );

  // Not found
  if (!cockpit) {
    return (
      <AppShell pageTitle="Cockpit do Paciente">
        <div className="max-w-3xl mx-auto py-12 text-center">
          <div className="text-5xl mb-4">{'\uD83D\uDD0D'}</div>
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Paciente nao encontrado</h2>
          <p className="text-slate-500 mb-6">
            Nao ha cockpit para <strong>{patientId}</strong>. Disponiveis: MRN-001, MRN-004, MRN-013.
          </p>
          <Link href="/patients" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium no-underline hover:bg-blue-700">
            {'\u2190'} Voltar para Pacientes
          </Link>
        </div>
      </AppShell>
    );
  }

  const pendingEvents = allEvents.filter((e) => e.pending);
  const initials = cockpit.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppShell pageTitle={`${cockpit.name} — Cockpit`}>
      {/* Back + Actions */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 no-underline font-medium">
          {'\u2190'} Voltar para Pacientes
        </Link>
        <Link href={`/patients/${patientId}/register-event`} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold no-underline hover:bg-blue-700 shadow-sm">
          {'\u2795'} Registrar Evento
        </Link>
      </div>

      {/* ============ IDENTITY BAND ============ */}
      <div className="bg-white rounded-xl border-2 border-blue-200 p-5 mb-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Avatar */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-md">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 truncate">{cockpit.name}</h1>
              <p className="text-sm text-slate-500">{cockpit.age} anos &middot; {cockpit.mrn} &middot; {cockpit.bloodType && <span className="font-semibold text-red-600">{cockpit.bloodType}</span>} &middot; {cockpit.weight}kg</p>
              <p className="text-sm text-slate-600 font-medium mt-0.5">{cockpit.diagnosis}</p>
            </div>
          </div>

          {/* Right side badges */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${STATUS_COLORS[cockpit.status]}`}>
              {STATUS_LABELS[cockpit.status]}
            </span>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${RISK_COLORS[cockpit.riskLevel]}`}>
              Risco {RISK_LABELS[cockpit.riskLevel]}
            </span>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${news2Color(cockpit.news2Score)}`}>
              NEWS2: {cockpit.news2Score} ({news2Label(cockpit.news2Score)})
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              TMI: {cockpit.los}d
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              {cockpit.ward} &middot; Leito {cockpit.bed}
            </span>
          </div>
        </div>

        {/* Allergies bar */}
        {cockpit.allergies.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-red-700 uppercase">ALERGIAS:</span>
            {cockpit.allergies.map((a) => (
              <span key={a} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-300">
                {'\u26A0\uFE0F'} {a}
              </span>
            ))}
          </div>
        )}
        {cockpit.allergies.length === 0 && (
          <div className="mt-3">
            <span className="text-xs font-medium text-green-600">NKDA (Nenhuma alergia conhecida)</span>
          </div>
        )}
      </div>

      {/* ============ TABS ============ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-slate-200 overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer
                  whitespace-nowrap shrink-0
                  ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }
                `}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-5">
          {/* ============ TAB: RESUMO ATUAL ============ */}
          {activeTab === 'resumo' && (
            <div className="space-y-5">
              {/* Pending actions — ACTION FIRST */}
              {cockpit.pendingActions.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-red-800 uppercase tracking-wider mb-3">
                    {'\u26A0\uFE0F'} Pendencias — O que precisa acontecer AGORA ({cockpit.pendingActions.length})
                  </h3>
                  <div className="space-y-2">
                    {cockpit.pendingActions.map((pa, i) => (
                      <div key={i} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${
                        pa.urgency === 'critico' ? 'bg-red-100 border-red-300' :
                        pa.urgency === 'urgente' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
                      }`}>
                        <span className={`shrink-0 mt-0.5 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          pa.urgency === 'critico' ? 'bg-red-600 text-white' :
                          pa.urgency === 'urgente' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>{pa.urgency}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900">{pa.action}</div>
                          <div className="text-xs text-slate-500 mt-0.5">Responsavel: {pa.assignedTo}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Digital Twin Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Last vitals */}
                {cockpit.vitals[0] && (
                  <>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">FC</div>
                      <div className="text-2xl font-bold text-slate-900">{cockpit.vitals[0].fc}</div>
                      <div className="text-xs text-slate-500">bpm</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">PA</div>
                      <div className="text-2xl font-bold text-slate-900">{cockpit.vitals[0].pas}x{cockpit.vitals[0].pad}</div>
                      <div className="text-xs text-slate-500">mmHg</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">SpO2</div>
                      <div className="text-2xl font-bold text-slate-900">{cockpit.vitals[0].spo2}%</div>
                      <div className="text-xs text-slate-500">Saturacao</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Temp</div>
                      <div className="text-2xl font-bold text-slate-900">{cockpit.vitals[0].temp}&deg;C</div>
                      <div className="text-xs text-slate-500">{cockpit.vitals[0].timestamp}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Row 2: responsibility + meds + pain + NEWS2 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-[10px] font-bold text-blue-500 uppercase mb-2">Responsavel AGORA</div>
                  <div className="space-y-1">
                    <div className="text-sm"><span className="font-semibold">Medico:</span> {cockpit.currentResponsible.physician}</div>
                    <div className="text-sm"><span className="font-semibold">Enfermeiro:</span> {cockpit.currentResponsible.nurse}</div>
                    <div className="text-sm"><span className="font-semibold">Equipe:</span> {cockpit.currentResponsible.team}</div>
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="text-[10px] font-bold text-purple-500 uppercase mb-2">Medicacoes Ativas</div>
                  <div className="text-3xl font-bold text-purple-800">{cockpit.medications.filter(m => m.status === 'ativa').length}</div>
                  <div className="text-xs text-purple-600 mt-1">
                    Proxima dose: {cockpit.medications.find(m => m.status === 'ativa' && m.nextDose)?.nextDose || 'N/A'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-lg p-4 ${cockpit.painLevel >= 7 ? 'bg-red-50 border border-red-200' : cockpit.painLevel >= 4 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Dor</div>
                    <div className="text-3xl font-bold">{cockpit.painLevel}/10</div>
                  </div>
                  <div className={`rounded-lg p-4 ${news2Color(cockpit.news2Score).includes('red') ? 'border border-red-300' : news2Color(cockpit.news2Score).includes('orange') ? 'border border-orange-300' : 'border border-green-300'}`} style={{ background: 'white' }}>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">NEWS2</div>
                    <div className="text-3xl font-bold">{cockpit.news2Score}</div>
                    <div className="text-xs text-slate-500">{news2Label(cockpit.news2Score)}</div>
                  </div>
                </div>
              </div>

              {/* NEWS2 Trend (text-based sparkline) */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">NEWS2 Trend</div>
                <div className="flex items-end gap-1 h-16">
                  {cockpit.news2Trend.map((p, i) => (
                    <div key={i} className="flex flex-col items-center flex-1">
                      <div
                        className={`w-full rounded-t ${p.score >= 7 ? 'bg-red-500' : p.score >= 5 ? 'bg-orange-400' : p.score >= 3 ? 'bg-amber-400' : 'bg-green-400'}`}
                        style={{ height: `${Math.max(4, (p.score / 12) * 60)}px` }}
                      />
                      <div className="text-[9px] text-slate-400 mt-1">{p.date}</div>
                      <div className="text-[9px] font-bold">{p.score}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last assessment */}
              <div className="text-xs text-slate-400 text-right">
                Ultima avaliacao: {cockpit.lastAssessment} &middot; Medico: {cockpit.consultant} &middot; Admissao: {cockpit.admissionDate}
              </div>
            </div>
          )}

          {/* ============ TAB: TIMELINE ============ */}
          {activeTab === 'timeline' && (
            <div>
              {/* Category filter */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase">Filtrar por Categoria</span>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedCategories(new Set(ALL_CATEGORIES))} className="text-xs text-blue-600 hover:text-blue-800 font-medium bg-transparent border-none cursor-pointer">Todas</button>
                    <button onClick={() => setSelectedCategories(new Set())} className="text-xs text-slate-500 hover:text-slate-700 font-medium bg-transparent border-none cursor-pointer">Nenhuma</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ALL_CATEGORIES.map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat];
                    const sel = selectedCategories.has(cat);
                    return (
                      <button key={cat} onClick={() => {
                        const next = new Set(selectedCategories);
                        sel ? next.delete(cat) : next.add(cat);
                        setSelectedCategories(next);
                      }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${sel ? `${cfg.colorBg} ${cfg.colorText} ${cfg.colorBorder}` : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                        <span>{cfg.icon}</span><span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Timeline */}
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200 md:left-6" />
                <div className="space-y-4">
                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">Nenhum evento para os filtros selecionados.</div>
                  ) : filteredEvents.map((evt) => {
                    const cfg = CATEGORY_CONFIG[evt.category];
                    return (
                      <div key={evt.id} className="relative flex gap-4 pl-0">
                        <div className={`relative z-10 flex items-center justify-center shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full border-2 ${cfg.colorBg} ${cfg.colorBorder} ${cfg.colorText} text-lg md:text-xl`}>
                          {cfg.icon}
                        </div>
                        <div className={`flex-1 min-w-0 rounded-xl border p-4 shadow-sm ${evt.pending ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cfg.colorBg} ${cfg.colorText}`}>{cfg.label}</span>
                              {evt.pending && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">Pendente</span>}
                            </div>
                            <span className="text-xs text-slate-400 font-mono shrink-0">{evt.timestamp}</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mb-1">{evt.title}</h4>
                          <p className="text-sm text-slate-600 leading-relaxed mb-2">{evt.description}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span>{evt.author} ({evt.role})</span>
                            <span>{evt.location}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="text-xs text-slate-400 mt-4 text-right">
                Exibindo {filteredEvents.length} de {allEvents.length} eventos
              </div>
            </div>
          )}

          {/* ============ TAB: MEDICACAO ============ */}
          {activeTab === 'medicacao' && (
            <div className="space-y-5">
              {/* Active medications */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Medicacoes Ativas</h3>
                <div className="space-y-2">
                  {cockpit.medications.filter(m => m.status === 'ativa').map((med) => (
                    <div key={med.id} className="bg-white border border-slate-200 rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div>
                          <span className="text-base font-bold text-slate-900">{med.name}</span>
                          <span className="text-sm text-slate-500 ml-2">{med.dose} — {med.route} — {med.frequency}</span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">ATIVA</span>
                      </div>
                      {med.nextDose && <div className="text-xs text-blue-600 font-medium mb-2">Proxima dose: {med.nextDose}</div>}
                      {/* Administration schedule */}
                      {med.administrations.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {med.administrations.map((adm, i) => (
                            <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              adm.status === 'administrado' ? 'bg-green-50 text-green-700 border border-green-200' :
                              adm.status === 'pendente' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              adm.status === 'atrasado' ? 'bg-red-50 text-red-700 border border-red-200' :
                              'bg-slate-50 text-slate-500 border border-slate-200'
                            }`}>
                              {adm.status === 'administrado' ? '\u2713' : adm.status === 'pendente' ? '\u23F3' : adm.status === 'atrasado' ? '\u2757' : '\u2716'}
                              {adm.time} — {adm.status}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Interactions */}
                      {med.interactions && med.interactions.length > 0 && (
                        <div className="mt-2">
                          {med.interactions.map((int, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              {'\u26A0\uFE0F'} Interacao: {int}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Suspended / completed */}
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Suspensas / Concluidas</h3>
                <div className="space-y-2">
                  {cockpit.medications.filter(m => m.status !== 'ativa').map((med) => (
                    <div key={med.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 opacity-75">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-slate-600">{med.name}</span>
                          <span className="text-xs text-slate-400 ml-2">{med.dose} — {med.route} — {med.frequency}</span>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          med.status === 'suspensa' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
                        }`}>{med.status.toUpperCase()}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{med.startDate} a {med.endDate || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reconciliation status */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs font-bold text-blue-700 uppercase mb-1">{'\uD83D\uDD04'} Reconciliacao Medicamentosa</div>
                <div className="text-sm text-blue-800">
                  {cockpit.medications.filter(m => m.status === 'ativa').length} medicacoes ativas prescritas.
                  Todas com administracao verificada nas ultimas 24h.
                  Status: <span className="font-bold text-green-700">Reconciliado</span>
                </div>
              </div>
            </div>
          )}

          {/* ============ TAB: EXAMES ============ */}
          {activeTab === 'exames' && (
            <div className="space-y-5">
              {/* Pending exams */}
              {cockpit.labs.filter(l => l.status === 'solicitado' || l.status === 'em_andamento').length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-3">{'\u23F3'} Pendentes</h3>
                  <div className="space-y-2">
                    {cockpit.labs.filter(l => l.status === 'solicitado' || l.status === 'em_andamento').map((lab) => (
                      <div key={lab.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-amber-900">{lab.name}</span>
                          <span className="text-xs font-bold text-amber-600 uppercase">{lab.status === 'solicitado' ? 'Solicitado' : 'Em andamento'}</span>
                        </div>
                        <div className="text-xs text-amber-700 mt-1">Solicitado em: {lab.requestDate}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed results */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Resultados</h3>
                <div className="space-y-2">
                  {cockpit.labs.filter(l => l.status === 'concluido' || l.status === 'critico').map((lab) => (
                    <div key={lab.id} className={`border rounded-lg p-4 ${lab.isCritical ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900">
                          {lab.category === 'imagem' ? '\uD83D\uDCF7 ' : '\uD83E\uDDEA '}{lab.name}
                          {lab.isCritical && <span className="ml-2 text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">CRITICO</span>}
                        </span>
                        <span className="text-xs text-slate-400">{lab.resultDate}</span>
                      </div>
                      <div className="text-sm text-slate-700">
                        {lab.value}{lab.unit ? ` ${lab.unit}` : ''}
                        {lab.reference && <span className="text-xs text-slate-400 ml-2">(Ref: {lab.reference})</span>}
                      </div>
                      {/* Trend */}
                      {lab.trend && lab.trend.length > 1 && (
                        <div className="mt-3">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tendencia</div>
                          <div className="flex items-end gap-1 h-10">
                            {lab.trend.map((t, i) => {
                              const max = Math.max(...lab.trend!.map(x => x.value));
                              const pct = max > 0 ? (t.value / max) * 100 : 0;
                              return (
                                <div key={i} className="flex flex-col items-center flex-1">
                                  <div className="w-full bg-blue-300 rounded-t" style={{ height: `${Math.max(2, pct * 0.35)}px` }} />
                                  <div className="text-[8px] text-slate-400 mt-0.5">{t.date}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============ TAB: SINAIS VITAIS ============ */}
          {activeTab === 'sinais' && (
            <div className="space-y-5">
              {/* Latest vitals big display */}
              {cockpit.vitals[0] && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    { label: 'FC', value: `${cockpit.vitals[0].fc}`, unit: 'bpm', color: cockpit.vitals[0].fc > 100 || cockpit.vitals[0].fc < 50 ? 'text-red-600' : 'text-slate-900' },
                    { label: 'PA', value: `${cockpit.vitals[0].pas}/${cockpit.vitals[0].pad}`, unit: 'mmHg', color: cockpit.vitals[0].pas > 160 || cockpit.vitals[0].pas < 90 ? 'text-red-600' : 'text-slate-900' },
                    { label: 'FR', value: `${cockpit.vitals[0].fr}`, unit: '/min', color: cockpit.vitals[0].fr > 25 ? 'text-red-600' : 'text-slate-900' },
                    { label: 'SpO2', value: `${cockpit.vitals[0].spo2}%`, unit: '', color: cockpit.vitals[0].spo2 < 92 ? 'text-red-600' : 'text-slate-900' },
                    { label: 'Temp', value: `${cockpit.vitals[0].temp}`, unit: '\u00B0C', color: cockpit.vitals[0].temp > 38 ? 'text-red-600' : 'text-slate-900' },
                    { label: 'Dor', value: `${cockpit.vitals[0].pain}`, unit: '/10', color: cockpit.vitals[0].pain >= 7 ? 'text-red-600' : cockpit.vitals[0].pain >= 4 ? 'text-amber-600' : 'text-slate-900' },
                    { label: 'NEWS2', value: `${cockpit.news2Score}`, unit: news2Label(cockpit.news2Score), color: cockpit.news2Score >= 5 ? 'text-red-600' : cockpit.news2Score >= 3 ? 'text-amber-600' : 'text-green-600' },
                  ].map((v) => (
                    <div key={v.label} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">{v.label}</div>
                      <div className={`text-xl font-bold ${v.color}`}>{v.value}</div>
                      <div className="text-[10px] text-slate-400">{v.unit}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Vitals history table */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Historico</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">Data/Hora</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">FC</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">PA</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">FR</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">SpO2</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">Temp</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">Dor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cockpit.vitals.map((v, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-xs text-slate-600">{v.timestamp}</td>
                          <td className="px-3 py-2 text-center font-semibold">{v.fc}</td>
                          <td className="px-3 py-2 text-center font-semibold">{v.pas}/{v.pad}</td>
                          <td className="px-3 py-2 text-center">{v.fr}</td>
                          <td className="px-3 py-2 text-center">{v.spo2}%</td>
                          <td className="px-3 py-2 text-center">{v.temp}&deg;C</td>
                          <td className="px-3 py-2 text-center">{v.pain}/10</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* NEWS2 trend bar */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">NEWS2 Early Warning — Trend</div>
                <div className="flex items-end gap-1 h-20">
                  {cockpit.news2Trend.map((p, i) => (
                    <div key={i} className="flex flex-col items-center flex-1">
                      <div
                        className={`w-full rounded-t ${p.score >= 7 ? 'bg-red-500' : p.score >= 5 ? 'bg-orange-400' : p.score >= 3 ? 'bg-amber-400' : 'bg-green-400'}`}
                        style={{ height: `${Math.max(4, (p.score / 12) * 70)}px` }}
                      />
                      <div className="text-[9px] text-slate-400 mt-1">{p.date}</div>
                      <div className="text-[9px] font-bold">{p.score}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============ TAB: EQUIPE ============ */}
          {activeTab === 'equipe' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Equipe Atual</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cockpit.careTeam.filter(m => m.isActive).map((member, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{member.name}</div>
                        <div className="text-xs text-slate-500">{member.role}{member.specialty ? ` — ${member.specialty}` : ''}</div>
                        <div className="text-xs text-slate-400 mt-1">Desde: {member.since}{member.contact ? ` | ${member.contact}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Previous team */}
              {cockpit.careTeam.filter(m => !m.isActive).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Equipe Anterior</h3>
                  <div className="space-y-2">
                    {cockpit.careTeam.filter(m => !m.isActive).map((member, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 opacity-70">
                        <span className="text-sm font-semibold text-slate-600">{member.name}</span>
                        <span className="text-xs text-slate-400 ml-2">{member.role} ({member.since} a {member.until})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Handoff history */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">{'\uD83E\uDD1D'} Historico de Handoffs — Chain of Custody</h3>
                <div className="space-y-2">
                  {cockpit.handoffs.map((h, i) => (
                    <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-400">{h.timestamp}</span>
                        <span className="text-xs font-bold text-yellow-800">{h.from} {'\u2192'} {h.to}</span>
                      </div>
                      <div className="text-sm text-slate-700">{h.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============ TAB: DOCUMENTOS ============ */}
          {activeTab === 'documentos' && (
            <div className="space-y-3">
              {cockpit.documents.map((doc) => {
                const typeLabels: Record<string, string> = {
                  evolucao: '\uD83D\uDCCB Evolucao', resumo_alta: '\uD83D\uDCC4 Resumo de Alta',
                  consentimento: '\u270D\uFE0F Consentimento', prescricao: '\uD83D\uDC8A Prescricao', laudo: '\uD83D\uDD2C Laudo',
                };
                const statusColors: Record<string, string> = {
                  rascunho: 'bg-amber-100 text-amber-700', finalizado: 'bg-blue-100 text-blue-700', assinado: 'bg-green-100 text-green-700',
                };
                return (
                  <div key={doc.id} className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{doc.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{typeLabels[doc.type] || doc.type} &middot; {doc.author} &middot; {doc.date}</div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${statusColors[doc.status]}`}>
                      {doc.status === 'rascunho' ? 'Rascunho' : doc.status === 'finalizado' ? 'Finalizado' : 'Assinado'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ============ TAB: AUDITORIA ============ */}
          {activeTab === 'auditoria' && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">{'\uD83D\uDD12'} Trilha de Auditoria — Quem acessou, quando, o que fez</h3>
              {cockpit.auditTrail.map((entry, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-3">
                  <span className="text-xs font-mono text-slate-400 shrink-0 w-28">{entry.timestamp}</span>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-slate-800">{entry.actor}</span>
                    <span className="text-xs text-slate-500 ml-2">{entry.action}</span>
                    <div className="text-xs text-slate-400 mt-0.5">{entry.details}</div>
                  </div>
                </div>
              ))}
              <div className="text-xs text-slate-400 mt-4 text-right">
                Mostrando ultimos {cockpit.auditTrail.length} registros. Auditoria completa disponivel no modulo de Auditoria.
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
