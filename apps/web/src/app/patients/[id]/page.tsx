'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  timestamp: string; // ISO or display string
  category: EventCategory;
  title: string;
  description: string;
  author: string;
  role: string;
  location: string;
  pending?: boolean;
}

interface PatientJourney {
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
  pendingItems: string[];
  events: TimelineEvent[];
}

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<
  EventCategory,
  { icon: string; label: string; colorBg: string; colorText: string; colorBorder: string }
> = {
  emergencia: {
    icon: '\uD83D\uDE91',
    label: 'Emerg\u00eancia',
    colorBg: 'bg-red-50',
    colorText: 'text-red-700',
    colorBorder: 'border-red-400',
  },
  admissao: {
    icon: '\uD83C\uDFE5',
    label: 'Admiss\u00e3o',
    colorBg: 'bg-blue-50',
    colorText: 'text-blue-700',
    colorBorder: 'border-blue-400',
  },
  avaliacao: {
    icon: '\uD83D\uDC68\u200D\u2695\uFE0F',
    label: 'Avalia\u00e7\u00e3o',
    colorBg: 'bg-green-50',
    colorText: 'text-green-700',
    colorBorder: 'border-green-400',
  },
  medicacao: {
    icon: '\uD83D\uDC8A',
    label: 'Medica\u00e7\u00e3o',
    colorBg: 'bg-purple-50',
    colorText: 'text-purple-700',
    colorBorder: 'border-purple-400',
  },
  exame: {
    icon: '\uD83D\uDD2C',
    label: 'Exame',
    colorBg: 'bg-orange-50',
    colorText: 'text-orange-700',
    colorBorder: 'border-orange-400',
  },
  evolucao: {
    icon: '\uD83D\uDCCB',
    label: 'Evolu\u00e7\u00e3o',
    colorBg: 'bg-gray-50',
    colorText: 'text-gray-700',
    colorBorder: 'border-gray-400',
  },
  handoff: {
    icon: '\uD83E\uDD1D',
    label: 'Handoff',
    colorBg: 'bg-yellow-50',
    colorText: 'text-yellow-700',
    colorBorder: 'border-yellow-400',
  },
  alerta: {
    icon: '\u26A0\uFE0F',
    label: 'Alerta',
    colorBg: 'bg-red-50',
    colorText: 'text-red-700',
    colorBorder: 'border-red-400',
  },
  chamada: {
    icon: '\uD83D\uDCDE',
    label: 'Chamada',
    colorBg: 'bg-cyan-50',
    colorText: 'text-cyan-700',
    colorBorder: 'border-cyan-400',
  },
  alta: {
    icon: '\uD83C\uDFE0',
    label: 'Alta',
    colorBg: 'bg-emerald-50',
    colorText: 'text-emerald-700',
    colorBorder: 'border-emerald-400',
  },
};

// ---------------------------------------------------------------------------
// Mock journey data
// ---------------------------------------------------------------------------

const JOURNEYS: Record<string, PatientJourney> = {
  'MRN-004': {
    mrn: 'MRN-004',
    name: 'Eleanor Voss',
    age: 81,
    ward: 'Ala 2A',
    bed: '2A-02',
    diagnosis: 'IAM \u2014 p\u00f3s-ICP',
    admissionDate: '2026-03-30',
    los: 9,
    status: 'blocked',
    riskLevel: 'high',
    consultant: 'Dr. Mbeki',
    pendingItems: [
      'Transporte para transfer\u00eancia pendente',
      'Documenta\u00e7\u00e3o de alta incompleta',
    ],
    events: [
      {
        id: 'e4-01',
        timestamp: '30/03 06:30',
        category: 'chamada',
        title: 'Chamada SAMU 192',
        description:
          'Paciente relata dor tor\u00e1cica intensa, irradia\u00e7\u00e3o para bra\u00e7o esquerdo, sudorese. Hist\u00f3rico de HAS e DM2. SAMU acionado com equipe de suporte avan\u00e7ado.',
        author: 'Central SAMU',
        role: 'Regulador',
        location: 'Central 192',
      },
      {
        id: 'e4-02',
        timestamp: '30/03 06:45',
        category: 'emergencia',
        title: 'Ambul\u00e2ncia acionada',
        description:
          'USA (Unidade de Suporte Avan\u00e7ado) despachada com m\u00e9dico. Paciente consciente, PA 180x100, FC 110, SAT 92%. Morfina 4mg IV administrada em campo.',
        author: 'Dr. Ferreira',
        role: 'M\u00e9dico SAMU',
        location: 'Resid\u00eancia paciente',
      },
      {
        id: 'e4-03',
        timestamp: '30/03 07:10',
        category: 'admissao',
        title: 'Chegada ao PA \u2014 Triagem Manchester',
        description:
          'Classificada como VERMELHO (emerg\u00eancia). Dor tor\u00e1cica com altera\u00e7\u00e3o hemodin\u00e2mica. Encaminhada diretamente para sala de emerg\u00eancia.',
        author: 'Enf. Souza',
        role: 'Enfermeiro Triagem',
        location: 'Pronto Atendimento',
      },
      {
        id: 'e4-04',
        timestamp: '30/03 07:15',
        category: 'avaliacao',
        title: 'Avalia\u00e7\u00e3o m\u00e9dica emergencial',
        description:
          'ECG realizado: supra de ST em DII, DIII e aVF. Troponina I: 2.8 ng/mL (VR <0.04). Diagn\u00f3stico: IAM com supra de ST (IAMCST) inferior. Protocolo de s\u00edndrome coron\u00e1ria aguda ativado.',
        author: 'Dr. Almeida',
        role: 'M\u00e9dico Emergencista',
        location: 'Sala de Emerg\u00eancia',
      },
      {
        id: 'e4-05',
        timestamp: '30/03 07:20',
        category: 'exame',
        title: 'Exames laboratoriais e ECG',
        description:
          'ECG 12 derivac\u00f5es confirmando IAMCST inferior. Hemograma, coagulograma, fun\u00e7\u00e3o renal, eletr\u00f3litos. Cr 1.2, K 4.1, Na 138. Rx de t\u00f3rax sem congest\u00e3o.',
        author: 'Equipe Laborat\u00f3rio',
        role: 'Biomedicina',
        location: 'Laborat\u00f3rio Central',
      },
      {
        id: 'e4-06',
        timestamp: '30/03 07:30',
        category: 'medicacao',
        title: 'Medicamentos pr\u00e9-hemodoin\u00e2mica',
        description:
          'AAS 300mg VO, Clopidogrel 600mg VO, Heparina 5000UI IV em bolus. Nitroglicerina SL. Anticoagula\u00e7\u00e3o plena iniciada. Tempo porta-bal\u00e3o <90min como meta.',
        author: 'Dr. Almeida',
        role: 'M\u00e9dico Emergencista',
        location: 'Sala de Emerg\u00eancia',
      },
      {
        id: 'e4-07',
        timestamp: '30/03 08:00',
        category: 'avaliacao',
        title: 'ICP realizada com sucesso',
        description:
          'Angioplastia coronariana prim\u00e1ria via radial direita. Les\u00e3o cr\u00edtica em CD proximal (99%). Stent farmacol\u00f3gico 3.0x28mm implantado com sucesso. Fluxo TIMI 3 p\u00f3s-procedimento. Sem complica\u00e7\u00f5es.',
        author: 'Dr. Mbeki',
        role: 'Hemodinamicista',
        location: 'Hemodin\u00e2mica',
      },
      {
        id: 'e4-08',
        timestamp: '30/03 08:45',
        category: 'admissao',
        title: 'Transfer\u00eancia para UTI Coronariana',
        description:
          'Paciente transferida para UTI Coron\u00e1ria, leito 2A-02. Monitoriza\u00e7\u00e3o cont\u00ednua, acesso venoso central, cateter arterial radial. Escala de gravidade NEWS: 6.',
        author: 'Enf. Lima',
        role: 'Enfermeiro UTI',
        location: 'UTI Coronariana',
      },
      {
        id: 'e4-09',
        timestamp: '30/03 09:00',
        category: 'medicacao',
        title: 'Prescri\u00e7\u00e3o p\u00f3s-ICP',
        description:
          'AAS 100mg/dia, Clopidogrel 75mg/dia, Enoxaparina 60mg 12/12h, Atorvastatina 80mg, Metoprolol 25mg 12/12h, Captopril 12.5mg 8/8h, Omeprazol 40mg. Controle glicemia intensive.',
        author: 'Dr. Mbeki',
        role: 'Cardiologista',
        location: 'UTI Coronariana',
      },
      {
        id: 'e4-10',
        timestamp: '30/03 10:00',
        category: 'avaliacao',
        title: 'Avalia\u00e7\u00e3o enfermagem \u2014 sinais vitais est\u00e1veis',
        description:
          'PA 128x76, FC 78, FR 16, SAT 97% AA, Temp 36.4\u00b0C. Curativo de pun\u00e7\u00e3o radial \u00edntegro, sem hematoma. Pulsos perif\u00e9ricos presentes. Dor 2/10.',
        author: 'Enf. Lima',
        role: 'Enfermeiro UTI',
        location: 'UTI Coronariana',
      },
      {
        id: 'e4-11',
        timestamp: '30/03 14:00',
        category: 'evolucao',
        title: 'Visita m\u00e9dica \u2014 evolu\u00e7\u00e3o favor\u00e1vel',
        description:
          'Paciente est\u00e1vel, sem dor tor\u00e1cica. Troponina em curva descendente (1.4 ng/mL). ECG sem novas altera\u00e7\u00f5es. Plano: manter medicamentos, ecocardiograma amanh\u00e3. Previs\u00e3o de transfer\u00eancia para enfermaria em D2.',
        author: 'Dr. Mbeki',
        role: 'Cardiologista',
        location: 'UTI Coronariana',
      },
      {
        id: 'e4-12',
        timestamp: '31/03 08:00',
        category: 'exame',
        title: 'Ecocardiograma transtori\u00e1cico',
        description:
          'FE\u0056E 45% (reduzida). Hipocinesia inferior basal e m\u00e9dia. Valvas sem altera\u00e7\u00f5es significativas. Peric\u00e1rdio normal. Recomenda\u00e7\u00e3o: otimizar IECA/BRA.',
        author: 'Dr. Santos',
        role: 'Ecocardiografista',
        location: 'Cardiologia',
      },
      {
        id: 'e4-13',
        timestamp: '31/03 14:00',
        category: 'handoff',
        title: 'Handoff para plant\u00e3o noturno',
        description:
          'Paciente est\u00e1vel em D2 p\u00f3s-ICP. FEVE 45%. Manter dupla antiagrega\u00e7\u00e3o e enoxaparina. Aten\u00e7\u00e3o: controle glicemia (DM2). Previs\u00e3o transfer\u00eancia enfermaria amanh\u00e3.',
        author: 'Enf. Lima',
        role: 'Enfermeiro UTI',
        location: 'UTI Coronariana',
      },
      {
        id: 'e4-14',
        timestamp: '01/04 10:00',
        category: 'admissao',
        title: 'Transfer\u00eancia para enfermaria cardiologia',
        description:
          'Paciente transferida para enfermaria Ala 2A, leito 02. Est\u00e1vel, deambulando com assist\u00eancia. Dieta leve hiposs\u00f3dica. Fisioterapia motora iniciada.',
        author: 'Dr. Mbeki',
        role: 'Cardiologista',
        location: 'Ala 2A',
      },
      {
        id: 'e4-15',
        timestamp: '02/04 09:00',
        category: 'avaliacao',
        title: 'Avalia\u00e7\u00e3o fisioterapia',
        description:
          'Paciente deambula 50m com supervis\u00e3o. Toler\u00e2ncia ao esfor\u00e7o moderada. Sem dispneia ao esfor\u00e7o leve. Plano: progress\u00e3o gradual de atividades. Meta: deambula\u00e7\u00e3o independente.',
        author: 'Ft. Oliveira',
        role: 'Fisioterapeuta',
        location: 'Ala 2A',
      },
      {
        id: 'e4-16',
        timestamp: '03/04 14:00',
        category: 'evolucao',
        title: 'Evolu\u00e7\u00e3o m\u00e9dica D4',
        description:
          'Paciente evoluindo bem. Sem dor, afebril. ECG est\u00e1vel. Marcadores card\u00edacos normalizados. Deambulando no corredor. Plano de alta em discuss\u00e3o. Pendente: transporte e documenta\u00e7\u00e3o.',
        author: 'Dr. Mbeki',
        role: 'Cardiologista',
        location: 'Ala 2A',
      },
      {
        id: 'e4-17',
        timestamp: '04/04 10:00',
        category: 'medicacao',
        title: 'Ajuste medicamentoso para alta',
        description:
          'Suspensa enoxaparina. Mantido: AAS 100mg, Clopidogrel 75mg, Atorvastatina 80mg, Metoprolol 50mg 12/12h, Ramipril 5mg/dia. Prescri\u00e7\u00e3o de alta preparada.',
        author: 'Dr. Mbeki',
        role: 'Cardiologista',
        location: 'Ala 2A',
      },
      {
        id: 'e4-18',
        timestamp: '05/04 08:00',
        category: 'handoff',
        title: 'Handoff plano de alta',
        description:
          'Paciente clinicamente apta para alta. Fam\u00edlia orientada sobre medica\u00e7\u00f5es e retorno. BLOQUEIO: transporte n\u00e3o dispon\u00edvel (paciente mora sozinha, sem fam\u00edlia pr\u00f3xima). Servi\u00e7o social acionado.',
        author: 'Enf. Costa',
        role: 'Enfermeiro',
        location: 'Ala 2A',
      },
      {
        id: 'e4-19',
        timestamp: '06/04 11:00',
        category: 'alerta',
        title: 'Bloqueio de alta \u2014 transporte',
        description:
          'Transporte hospitalar indispon\u00edvel para domic\u00edlio (zona rural, 85km). Servi\u00e7o social tentando articular transporte com prefeitura. Paciente aguardando.',
        author: 'AS. Pereira',
        role: 'Assistente Social',
        location: 'Servi\u00e7o Social',
        pending: true,
      },
      {
        id: 'e4-20',
        timestamp: '07/04 09:00',
        category: 'alerta',
        title: 'Bloqueio de alta \u2014 documenta\u00e7\u00e3o',
        description:
          'Relat\u00f3rio de alta e encaminhamento para cardiologia ambulatorial pendentes. M\u00e9dico assistente solicitado para finalizar documenta\u00e7\u00e3o.',
        author: 'Enf. Costa',
        role: 'Enfermeiro',
        location: 'Ala 2A',
        pending: true,
      },
    ],
  },
  'MRN-013': {
    mrn: 'MRN-013',
    name: 'Peter Hawkins',
    age: 84,
    ward: 'Ala 2A',
    bed: '2A-10',
    diagnosis: 'Sepse \u2014 recupera\u00e7\u00e3o',
    admissionDate: '2026-03-25',
    los: 14,
    status: 'blocked',
    riskLevel: 'high',
    consultant: 'Dr. Osei',
    pendingItems: [
      'Vaga em casa de repouso n\u00e3o encontrada',
      'Avalia\u00e7\u00e3o do servi\u00e7o social pendente',
      'Avalia\u00e7\u00e3o DOLS em andamento',
      'Fam\u00edlia n\u00e3o localizada para discuss\u00e3o de plano',
    ],
    events: [
      {
        id: 'e13-01',
        timestamp: '25/03 14:00',
        category: 'chamada',
        title: 'Transfer\u00eancia de outro hospital',
        description:
          'Paciente transferido do Hospital Municipal de Guarulhos com quadro de sepse de foco urin\u00e1rio, iniciado antibi\u00f3tico emp\u00edrico h\u00e1 24h sem melhora. Solicitada vaga em UTI.',
        author: 'Dra. Rodrigues',
        role: 'M\u00e9dica Reguladora',
        location: 'Central de Regula\u00e7\u00e3o',
      },
      {
        id: 'e13-02',
        timestamp: '25/03 15:30',
        category: 'admissao',
        title: 'Admiss\u00e3o UTI',
        description:
          'Paciente admitido em UTI, leito 5. Glasgow 13, PA 85x50, FC 120, FR 24, SAT 89% em 5L O2, Temp 39.2\u00b0C. Lactato 4.8. Protocolo de sepse ativado. Ressuscita\u00e7\u00e3o vol\u00e9mica iniciada.',
        author: 'Dr. Osei',
        role: 'Intensivista',
        location: 'UTI',
      },
      {
        id: 'e13-03',
        timestamp: '25/03 16:00',
        category: 'exame',
        title: 'Painel laboratorial completo',
        description:
          'Hemoculturas (2 pares), urocultura, PCR 280, procalcitonina 18.5, Cr 2.1, leucocitos 22.000. Gasometria: pH 7.28, lactato 4.8. TC abdome: sem cole\u00e7\u00f5es.',
        author: 'Equipe Laborat\u00f3rio',
        role: 'Biomedicina',
        location: 'Laborat\u00f3rio Central',
      },
      {
        id: 'e13-04',
        timestamp: '25/03 16:30',
        category: 'medicacao',
        title: 'Escalonamento antibi\u00f3tico',
        description:
          'Meropenem 1g 8/8h IV + Vancomicina 1g 12/12h IV iniciados. Noradrenalina em BIC para PAM >65. SF 0.9% 30mL/kg em 3h.',
        author: 'Dr. Osei',
        role: 'Intensivista',
        location: 'UTI',
      },
      {
        id: 'e13-05',
        timestamp: '26/03 08:00',
        category: 'avaliacao',
        title: 'Round UTI D1',
        description:
          'Paciente sedado, IOT, VM modo PCV. Noradrenalina 0.3mcg/kg/min. Diu\u00e9rese 30mL/h. Lactato 3.2 (queda). Hemocultura preliminar: Gram-negativo.',
        author: 'Dr. Osei',
        role: 'Intensivista',
        location: 'UTI',
      },
      {
        id: 'e13-06',
        timestamp: '27/03 08:00',
        category: 'evolucao',
        title: 'Evolu\u00e7\u00e3o D2 \u2014 melhora parcial',
        description:
          'Redu\u00e7\u00e3o de noradrenalina para 0.15mcg/kg/min. Lactato 2.0. Cr 1.8 (melhora). Hemocultura: E. coli ESBL+. Meropenem mantido. Tentativa de desmame de VM.',
        author: 'Dr. Osei',
        role: 'Intensivista',
        location: 'UTI',
      },
      {
        id: 'e13-07',
        timestamp: '28/03 10:00',
        category: 'avaliacao',
        title: 'Extuba\u00e7\u00e3o bem-sucedida',
        description:
          'Paciente extubado ap\u00f3s TRE de 30min. O2 3L cateter nasal. SAT 94%. Consciente, colaborativo, desorientado no tempo. Noradrenalina suspensa.',
        author: 'Dr. Osei',
        role: 'Intensivista',
        location: 'UTI',
      },
      {
        id: 'e13-08',
        timestamp: '29/03 14:00',
        category: 'handoff',
        title: 'Handoff plant\u00e3o \u2014 complexidade social',
        description:
          'Paciente sem fam\u00edlia identificada (viuvo, sem filhos). Morava sozinho em pens\u00e3o. Servi\u00e7o social acionado para avalia\u00e7\u00e3o de destino p\u00f3s-alta. Necessita casa de repouso.',
        author: 'Enf. Santos',
        role: 'Enfermeiro UTI',
        location: 'UTI',
      },
      {
        id: 'e13-09',
        timestamp: '30/03 10:00',
        category: 'admissao',
        title: 'Transfer\u00eancia para enfermaria',
        description:
          'Paciente est\u00e1vel, transferido para Ala 2A leito 10. Antibi\u00f3tico: Meropenem D5 (completar 14 dias). Fisioterapia motora e respirat\u00f3ria iniciada.',
        author: 'Dr. Osei',
        role: 'Cl\u00ednico',
        location: 'Ala 2A',
      },
      {
        id: 'e13-10',
        timestamp: '31/03 09:00',
        category: 'avaliacao',
        title: 'Avalia\u00e7\u00e3o geri\u00e1trica',
        description:
          'Katz 3/6 (depend\u00eancia parcial), Lawton 2/8. Delirium em resolu\u00e7\u00e3o (CAM negativo hoje). Risco de quedas alto. Necessidade de cuidados de longa perman\u00eancia confirmada.',
        author: 'Dra. Tanaka',
        role: 'Geriatra',
        location: 'Ala 2A',
      },
      {
        id: 'e13-11',
        timestamp: '01/04 14:00',
        category: 'medicacao',
        title: 'Troca para antibi\u00f3tico oral',
        description:
          'Meropenem D7. Paciente afebril h\u00e1 72h, PCR 28 (queda). Transicionado para Ciprofloxacino 500mg 12/12h VO para completar 14 dias total.',
        author: 'Dr. Osei',
        role: 'Cl\u00ednico',
        location: 'Ala 2A',
      },
      {
        id: 'e13-12',
        timestamp: '02/04 10:00',
        category: 'handoff',
        title: 'Reuni\u00e3o multiprofissional',
        description:
          'Plano de alta discutido. Paciente precisa de casa de repouso (sem condi\u00e7\u00f5es de morar sozinho). Lista de espera: 2-3 semanas. Servi\u00e7o social buscando vagas. DOLS pode ser necess\u00e1rio.',
        author: 'Equipe Multidisciplinar',
        role: 'Multi',
        location: 'Sala de Reuni\u00e3o',
      },
      {
        id: 'e13-13',
        timestamp: '04/04 09:00',
        category: 'avaliacao',
        title: 'Fisioterapia \u2014 progress\u00e3o',
        description:
          'Paciente deambula 20m com andador e supervis\u00e3o. For\u00e7a muscular melhorando. Capacidade funcional ainda insuficiente para vida independente.',
        author: 'Ft. Ribeiro',
        role: 'Fisioterapeuta',
        location: 'Ala 2A',
      },
      {
        id: 'e13-14',
        timestamp: '06/04 11:00',
        category: 'alerta',
        title: 'Bloqueio \u2014 casa de repouso',
        description:
          'Nenhuma vaga dispon\u00edvel nas institui\u00e7\u00f5es conveniadas. Lista de espera com tempo estimado de 2 semanas. Paciente clinicamente apto para alta, por\u00e9m sem destino.',
        author: 'AS. Mendes',
        role: 'Assistente Social',
        location: 'Servi\u00e7o Social',
        pending: true,
      },
      {
        id: 'e13-15',
        timestamp: '07/04 14:00',
        category: 'alerta',
        title: 'Bloqueio \u2014 fam\u00edlia',
        description:
          'Tentativas de contato com sobrinho (unico parente identificado) sem sucesso. Necess\u00e1rio para discuss\u00e3o de plano terap\u00eautico e consentimento.',
        author: 'AS. Mendes',
        role: 'Assistente Social',
        location: 'Servi\u00e7o Social',
        pending: true,
      },
      {
        id: 'e13-16',
        timestamp: '08/04 09:00',
        category: 'alerta',
        title: 'Avalia\u00e7\u00e3o DOLS iniciada',
        description:
          'Paciente apresenta epis\u00f3dios de confus\u00e3o. Avalia\u00e7\u00e3o de capacidade de decis\u00e3o em andamento pela equipe de sa\u00fade mental. Pode necessitar Termo de Curatela.',
        author: 'Dra. Tanaka',
        role: 'Geriatra',
        location: 'Ala 2A',
        pending: true,
      },
    ],
  },
  'MRN-001': {
    mrn: 'MRN-001',
    name: 'James Whitfield',
    age: 68,
    ward: 'Ala 1A',
    bed: '1A-04',
    diagnosis: 'Fratura de quadril p\u00f3s-op',
    admissionDate: '2026-04-01',
    los: 7,
    status: 'on-track',
    riskLevel: 'low',
    consultant: 'Dr. Patel',
    pendingItems: [],
    events: [
      {
        id: 'e1-01',
        timestamp: '01/04 09:15',
        category: 'chamada',
        title: 'Chamada SAMU 192',
        description:
          'Paciente sofreu queda em casa (escorregou no banheiro). Dor intensa em quadril direito, impotencia funcional. Esposa acionou 192.',
        author: 'Central SAMU',
        role: 'Regulador',
        location: 'Central 192',
      },
      {
        id: 'e1-02',
        timestamp: '01/04 09:40',
        category: 'emergencia',
        title: 'Chegada da ambul\u00e2ncia',
        description:
          'USB (Unidade de Suporte B\u00e1sico) no local. Paciente imobilizado com tala, analgesia com Dipirona 1g IV. PA 150x90, FC 92, Dor 8/10.',
        author: 'Soc. Martins',
        role: 'Socorrista',
        location: 'Resid\u00eancia paciente',
      },
      {
        id: 'e1-03',
        timestamp: '01/04 10:15',
        category: 'admissao',
        title: 'Admiss\u00e3o PA \u2014 Triagem laranja',
        description:
          'Classificada como LARANJA (muito urgente). Dor intensa com deformidade em quadril D. Encaminhado para sala de ortopedia.',
        author: 'Enf. Ferreira',
        role: 'Enfermeiro Triagem',
        location: 'Pronto Atendimento',
      },
      {
        id: 'e1-04',
        timestamp: '01/04 10:30',
        category: 'exame',
        title: 'Radiografia de quadril e bacia',
        description:
          'Rx confirma fratura transtrocant\u00e9rica de f\u00eamur direito (Tronzo tipo III). Sem outras les\u00f5es. Solicita\u00e7\u00e3o de TC para planejamento cir\u00fargico.',
        author: 'Dr. Patel',
        role: 'Ortopedista',
        location: 'Radiologia',
      },
      {
        id: 'e1-05',
        timestamp: '01/04 11:00',
        category: 'avaliacao',
        title: 'Avalia\u00e7\u00e3o pr\u00e9-operat\u00f3ria',
        description:
          'Risco cir\u00fargico ASA II (HAS controlada). Exames pr\u00e9-operat\u00f3rios normais. Avaliado por anestesista. Cir\u00fargia agendada para amanh\u00e3 7h (osteoss\u00edntese com DHS).',
        author: 'Dr. Patel',
        role: 'Ortopedista',
        location: 'Consult\u00f3rio',
      },
      {
        id: 'e1-06',
        timestamp: '01/04 14:00',
        category: 'admissao',
        title: 'Interna\u00e7\u00e3o Ala 1A',
        description:
          'Paciente internado em Ala 1A, leito 04. Tra\u00e7\u00e3o cut\u00e2nea em MID. Analgesia: Tramadol 50mg 6/6h, Dipirona 1g 6/6h. Enoxaparina 40mg SC profilaxia TVP.',
        author: 'Enf. Silva',
        role: 'Enfermeiro',
        location: 'Ala 1A',
      },
      {
        id: 'e1-07',
        timestamp: '02/04 07:00',
        category: 'avaliacao',
        title: 'Cirurgia \u2014 osteoss\u00edntese DHS',
        description:
          'Osteoss\u00edntese com DHS (Dynamic Hip Screw) realizada sem intercorr\u00eancias. Tempo cir\u00fargico: 1h20min. Sangramento estimado: 300mL. Anestesia raqui + seda\u00e7\u00e3o.',
        author: 'Dr. Patel',
        role: 'Ortopedista',
        location: 'Centro Cir\u00fargico',
      },
      {
        id: 'e1-08',
        timestamp: '02/04 09:30',
        category: 'medicacao',
        title: 'Prescri\u00e7\u00e3o p\u00f3s-operat\u00f3ria',
        description:
          'Cefazolina 1g 8/8h (48h), Enoxaparina 40mg/dia, Tramadol 50mg 6/6h SN, Dipirona 1g 6/6h, Omeprazol 20mg. Dieta livre ap\u00f3s 6h.',
        author: 'Dr. Patel',
        role: 'Ortopedista',
        location: 'Ala 1A',
      },
      {
        id: 'e1-09',
        timestamp: '03/04 08:00',
        category: 'avaliacao',
        title: 'Fisioterapia D1 p\u00f3s-op',
        description:
          'Paciente sentou na beira do leito com assist\u00eancia. Exerc\u00edcios isometricos de quadr\u00edceps. Orienta\u00e7\u00f5es de preven\u00e7\u00e3o de TVP. Meta D2: transferencia leito-cadeira.',
        author: 'Ft. Oliveira',
        role: 'Fisioterapeuta',
        location: 'Ala 1A',
      },
      {
        id: 'e1-10',
        timestamp: '04/04 08:00',
        category: 'evolucao',
        title: 'Evolu\u00e7\u00e3o D2 p\u00f3s-op',
        description:
          'Paciente transferiu leito-cadeira com assist\u00eancia. Ferida cir\u00fargica sem sinais de infec\u00e7\u00e3o. Rx controle: material de s\u00edntese em boa posi\u00e7\u00e3o. Dor controlada (3/10).',
        author: 'Dr. Patel',
        role: 'Ortopedista',
        location: 'Ala 1A',
      },
      {
        id: 'e1-11',
        timestamp: '05/04 09:00',
        category: 'avaliacao',
        title: 'Fisioterapia \u2014 deambula\u00e7\u00e3o',
        description:
          'Primeira deambula\u00e7\u00e3o com andador e carga parcial. Paciente deambulou 30m no corredor. Boa toler\u00e2ncia. Progredindo conforme protocolo.',
        author: 'Ft. Oliveira',
        role: 'Fisioterapeuta',
        location: 'Ala 1A',
      },
      {
        id: 'e1-12',
        timestamp: '06/04 14:00',
        category: 'evolucao',
        title: 'Evolu\u00e7\u00e3o D4 \u2014 alta em planejamento',
        description:
          'Paciente deambulando com andador independente. Ferida cir\u00fargica limpa. Antibi\u00f3tico suspenso (D2). Alta prevista para D7 (08/04). Esposa ser\u00e1 treinada para curativos.',
        author: 'Dr. Patel',
        role: 'Ortopedista',
        location: 'Ala 1A',
      },
      {
        id: 'e1-13',
        timestamp: '07/04 10:00',
        category: 'handoff',
        title: 'Orienta\u00e7\u00e3o de alta familiar',
        description:
          'Esposa orientada sobre cuidados domiciliares, curativos, medica\u00e7\u00f5es, sinais de alerta. Retorno em 10 dias para remo\u00e7\u00e3o de pontos. Fisioterapia ambulatorial agendada.',
        author: 'Enf. Silva',
        role: 'Enfermeiro',
        location: 'Ala 1A',
      },
      {
        id: 'e1-14',
        timestamp: '08/04 10:00',
        category: 'alta',
        title: 'Alta hospitalar programada',
        description:
          'Alta m\u00e9dica concedida. Receitu\u00e1rio: Enoxaparina 40mg/dia por 14 dias, Paracetamol 750mg 6/6h SN. Retorno ortopedia em 10 dias. Fisioterapia 3x/semana.',
        author: 'Dr. Patel',
        role: 'Ortopedista',
        location: 'Ala 1A',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Status and risk labels
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  'on-track': 'No Prazo',
  'at-risk': 'Em Risco',
  blocked: 'Bloqueado',
  discharged: 'Alta',
};

const STATUS_COLORS: Record<string, string> = {
  'on-track': 'bg-green-100 text-green-800',
  'at-risk': 'bg-amber-100 text-amber-800',
  blocked: 'bg-red-100 text-red-800',
  discharged: 'bg-gray-100 text-gray-800',
};

const RISK_LABELS: Record<string, string> = {
  high: 'Alto',
  medium: 'M\u00e9dio',
  low: 'Baixo',
};

const RISK_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-green-100 text-green-800',
};

const ALL_CATEGORIES: EventCategory[] = [
  'emergencia',
  'admissao',
  'avaliacao',
  'medicacao',
  'exame',
  'evolucao',
  'handoff',
  'alerta',
  'chamada',
  'alta',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PatientJourneyPage() {
  const params = useParams();
  const patientId = params.id as string;
  const [selectedCategories, setSelectedCategories] = useState<Set<EventCategory>>(
    new Set(ALL_CATEGORIES)
  );

  const journey = JOURNEYS[patientId];

  function toggleCategory(cat: EventCategory) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedCategories(new Set(ALL_CATEGORIES));
  }

  function clearAll() {
    setSelectedCategories(new Set());
  }

  const filteredEvents = useMemo(() => {
    if (!journey) return [];
    return journey.events.filter((e) => selectedCategories.has(e.category));
  }, [journey, selectedCategories]);

  if (!journey) {
    return (
      <AppShell pageTitle="Jornada do Paciente">
        <div className="max-w-3xl mx-auto py-12 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Paciente n\u00e3o encontrado</h2>
          <p className="text-slate-500 mb-6">
            N\u00e3o h\u00e1 jornada detalhada dispon\u00edvel para o paciente <strong>{patientId}</strong>.
            <br />
            Jornadas dispon\u00edveis: MRN-001, MRN-004, MRN-013.
          </p>
          <Link
            href="/patients"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium no-underline hover:bg-blue-700 transition-colors"
          >
            \u2190 Voltar para Pacientes
          </Link>
        </div>
      </AppShell>
    );
  }

  const pendingEvents = journey.events.filter((e) => e.pending);

  return (
    <AppShell pageTitle="Jornada do Paciente">
      {/* Back button */}
      <div className="mb-4">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 no-underline font-medium"
        >
          \u2190 Voltar para Pacientes
        </Link>
      </div>

      {/* Patient header card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">{journey.name}</h1>
            <p className="text-sm text-slate-500 mb-3">
              {journey.mrn} &middot; {journey.age} anos &middot; {journey.ward} &middot; Leito{' '}
              {journey.bed}
            </p>
            <p className="text-base text-slate-700 font-medium">{journey.diagnosis}</p>
            <p className="text-sm text-slate-500 mt-1">
              M\u00e9dico respons\u00e1vel: {journey.consultant} &middot; Admiss\u00e3o: {journey.admissionDate}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[journey.status]}`}
            >
              {STATUS_LABELS[journey.status]}
            </span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${RISK_COLORS[journey.riskLevel]}`}
            >
              Risco {RISK_LABELS[journey.riskLevel]}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              TMI: {journey.los} dias
            </span>
          </div>
        </div>
      </div>

      {/* Pending items */}
      {pendingEvents.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-bold text-red-800 uppercase tracking-wider mb-3">
            Pend\u00eancias Atuais ({pendingEvents.length})
          </h2>
          <div className="space-y-2">
            {pendingEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex items-start gap-3 bg-white/80 rounded-lg px-3 py-2.5 border border-red-100"
              >
                <span className="text-lg shrink-0">{CATEGORY_CONFIG[evt.category].icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-red-900">{evt.title}</div>
                  <div className="text-xs text-red-700 mt-0.5">{evt.description}</div>
                  <div className="text-xs text-red-500 mt-1">
                    {evt.timestamp} &middot; {evt.author} ({evt.role}) &middot; {evt.location}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Filtrar por Categoria
          </h3>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium bg-transparent border-none cursor-pointer"
            >
              Todas
            </button>
            <button
              onClick={clearAll}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium bg-transparent border-none cursor-pointer"
            >
              Nenhuma
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const isSelected = selectedCategories.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                  border transition-all duration-150 cursor-pointer
                  ${
                    isSelected
                      ? `${cfg.colorBg} ${cfg.colorText} ${cfg.colorBorder}`
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }
                `}
              >
                <span>{cfg.icon}</span>
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200 md:left-6" />

        <div className="space-y-4">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Nenhum evento para os filtros selecionados.
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const cfg = CATEGORY_CONFIG[evt.category];
              return (
                <div key={evt.id} className="relative flex gap-4 pl-0">
                  {/* Timeline node */}
                  <div
                    className={`
                      relative z-10 flex items-center justify-center shrink-0
                      w-10 h-10 md:w-12 md:h-12 rounded-full border-2
                      ${cfg.colorBg} ${cfg.colorBorder} ${cfg.colorText}
                      text-lg md:text-xl
                    `}
                  >
                    {cfg.icon}
                  </div>

                  {/* Event card */}
                  <div
                    className={`
                      flex-1 min-w-0 rounded-xl border p-4 shadow-sm
                      ${evt.pending ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}
                    `}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cfg.colorBg} ${cfg.colorText}`}
                        >
                          {cfg.label}
                        </span>
                        {evt.pending && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">
                            Pendente
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-mono shrink-0">
                        {evt.timestamp}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 mb-1">{evt.title}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed mb-2">{evt.description}</p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>
                        {evt.author} ({evt.role})
                      </span>
                      <span>{evt.location}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer count */}
      <div className="text-xs text-slate-400 mt-6 text-right">
        Exibindo {filteredEvents.length} de {journey.events.length} eventos
      </div>
    </AppShell>
  );
}
