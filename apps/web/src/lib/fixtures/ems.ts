/**
 * Centralized fixtures for /ems. Source of truth enforced by
 * scripts/check-ui-duplications.ts. Do not duplicate MRN literals in page files.
 */

export type AmbulanceStatus =
  | 'despachada'
  | 'em-rota-coleta'
  | 'chegando-hospital'
  | 'no-hospital'
  | 'retornando'
  | 'disponivel';

export type AmbulanceType = 'USA' | 'USB' | 'UTI-Movel';
export type RiskLevel = 'vermelho' | 'amarelo' | 'verde' | 'azul';

export interface TimelineEvent {
  key: 'chamado' | 'despacho' | 'coleta' | 'em-rota' | 'chegada';
  label: string;
  time: string | null;
}

export interface Ambulance {
  unit: string;
  type: AmbulanceType;
  crew: {
    medico?: string;
    enfermeiro: string;
    condutor: string;
  };
  status: AmbulanceStatus;
  origin: string;
  destination: string;
  etaMin: number | null;
  patient: {
    age: number;
    sex: 'M' | 'F';
    chiefComplaint: string;
    vitals?: { bp: string; hr: number; spo2: number; gcs?: number };
  } | null;
  risk: RiskLevel | null;
  preNotificationSent: boolean;
  dispatchedAt: string; // HH:MM
  minutesSinceDispatch: number;
  timeline: TimelineEvent[];
  mapCoords: { x: number; y: number };
  ePcrNotes?: string;
}

export const AMBULANCES: Ambulance[] = [
  {
    unit: 'USA-01',
    type: 'USA',
    crew: { medico: 'Dr. Helena Couto', enfermeiro: 'Enf. Ricardo Lins', condutor: 'Paulo M.' },
    status: 'chegando-hospital',
    origin: 'Av. Brasil, 2140 - Centro',
    destination: 'Velya HQ — Emergência',
    etaMin: 4,
    patient: {
      age: 58,
      sex: 'M',
      chiefComplaint: 'Dor torácica aguda, suspeita IAM c/ supra',
      vitals: { bp: '88/52', hr: 132, spo2: 91, gcs: 14 },
    },
    risk: 'vermelho',
    preNotificationSent: true,
    dispatchedAt: '08:42',
    minutesSinceDispatch: 18,
    timeline: [
      { key: 'chamado', label: 'Chamado recebido', time: '08:40' },
      { key: 'despacho', label: 'Despachada', time: '08:42' },
      { key: 'coleta', label: 'Cena / coleta', time: '08:51' },
      { key: 'em-rota', label: 'Em rota hospital', time: '08:55' },
      { key: 'chegada', label: 'Chegada prevista', time: '09:04' },
    ],
    mapCoords: { x: 72, y: 38 },
    ePcrNotes:
      'ECG 12D confirma supra em parede anterior. Iniciado AAS 300mg VO, nitrato SL, morfina 4mg IV. Solicitada sala de hemodinâmica.',
  },
  {
    unit: 'USA-02',
    type: 'USA',
    crew: { medico: 'Dr. Bruno Tavares', enfermeiro: 'Enf. Camila Souza', condutor: 'Jorge K.' },
    status: 'em-rota-coleta',
    origin: 'Residencial Ipê Amarelo',
    destination: 'A definir (cena)',
    etaMin: 6,
    patient: {
      age: 72,
      sex: 'F',
      chiefComplaint: 'Queda com TCE, desorientada',
      vitals: { bp: '145/92', hr: 98, spo2: 96, gcs: 13 },
    },
    risk: 'amarelo',
    preNotificationSent: false,
    dispatchedAt: '08:53',
    minutesSinceDispatch: 7,
    timeline: [
      { key: 'chamado', label: 'Chamado recebido', time: '08:51' },
      { key: 'despacho', label: 'Despachada', time: '08:53' },
      { key: 'coleta', label: 'Chegada cena', time: null },
      { key: 'em-rota', label: 'Em rota hospital', time: null },
      { key: 'chegada', label: 'Chegada hospital', time: null },
    ],
    mapCoords: { x: 28, y: 62 },
  },
  {
    unit: 'USB-03',
    type: 'USB',
    crew: { enfermeiro: 'Enf. Fátima Reis', condutor: 'Lucas F.' },
    status: 'despachada',
    origin: 'Terminal Rodoviário',
    destination: 'Cena',
    etaMin: 9,
    patient: {
      age: 34,
      sex: 'M',
      chiefComplaint: 'Crise convulsiva testemunhada',
    },
    risk: 'amarelo',
    preNotificationSent: false,
    dispatchedAt: '09:00',
    minutesSinceDispatch: 2,
    timeline: [
      { key: 'chamado', label: 'Chamado recebido', time: '08:58' },
      { key: 'despacho', label: 'Despachada', time: '09:00' },
      { key: 'coleta', label: 'Chegada cena', time: null },
      { key: 'em-rota', label: 'Em rota hospital', time: null },
      { key: 'chegada', label: 'Chegada hospital', time: null },
    ],
    mapCoords: { x: 45, y: 20 },
  },
  {
    unit: 'SAMU-04',
    type: 'UTI-Movel',
    crew: { medico: 'Dra. Priya Shah', enfermeiro: 'Enf. Miguel Dantas', condutor: 'Rafael T.' },
    status: 'no-hospital',
    origin: 'Hospital Santa Luzia (transferência)',
    destination: 'Velya HQ — UTI Adulto',
    etaMin: 0,
    patient: {
      age: 65,
      sex: 'F',
      chiefComplaint: 'Choque séptico — transferência para UTI',
      vitals: { bp: '92/58', hr: 118, spo2: 93 },
    },
    risk: 'vermelho',
    preNotificationSent: true,
    dispatchedAt: '08:05',
    minutesSinceDispatch: 55,
    timeline: [
      { key: 'chamado', label: 'Solicitação', time: '07:58' },
      { key: 'despacho', label: 'Despachada', time: '08:05' },
      { key: 'coleta', label: 'Coleta (origem)', time: '08:22' },
      { key: 'em-rota', label: 'Em rota', time: '08:41' },
      { key: 'chegada', label: 'Chegada hospital', time: '08:58' },
    ],
    mapCoords: { x: 52, y: 50 },
    ePcrNotes:
      'Paciente com noradrenalina 0.35 mcg/kg/min em VM, FiO2 60%. Lactato 4.2. Cultura coletada. Equipe TBR aguarda na sala.',
  },
  {
    unit: 'USB-05',
    type: 'USB',
    crew: { enfermeiro: 'Enf. Olga Nakamura', condutor: 'César V.' },
    status: 'retornando',
    origin: 'Velya HQ',
    destination: 'Base Central',
    etaMin: 12,
    patient: null,
    risk: null,
    preNotificationSent: false,
    dispatchedAt: '07:30',
    minutesSinceDispatch: 90,
    timeline: [
      { key: 'chamado', label: 'Chamado recebido', time: '07:25' },
      { key: 'despacho', label: 'Despachada', time: '07:30' },
      { key: 'coleta', label: 'Coleta', time: '07:44' },
      { key: 'em-rota', label: 'Em rota hospital', time: '07:52' },
      { key: 'chegada', label: 'Chegada hospital', time: '08:08' },
    ],
    mapCoords: { x: 65, y: 75 },
  },
  {
    unit: 'USA-06',
    type: 'USA',
    crew: { medico: 'Dr. Ivan Melo', enfermeiro: 'Enf. Joana Prado', condutor: 'Henrique S.' },
    status: 'disponivel',
    origin: 'Base Norte',
    destination: 'Base Norte',
    etaMin: null,
    patient: null,
    risk: null,
    preNotificationSent: false,
    dispatchedAt: '06:00',
    minutesSinceDispatch: 0,
    timeline: [
      { key: 'chamado', label: 'Aguardando', time: null },
      { key: 'despacho', label: '—', time: null },
      { key: 'coleta', label: '—', time: null },
      { key: 'em-rota', label: '—', time: null },
      { key: 'chegada', label: '—', time: null },
    ],
    mapCoords: { x: 15, y: 30 },
  },
];
