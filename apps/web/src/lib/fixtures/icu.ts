/**
 * Centralized fixtures for /icu. Source of truth enforced by
 * scripts/check-ui-duplications.ts. Do not duplicate MRN literals in page files.
 */

export type Severity = 'critico' | 'grave' | 'estavel' | 'melhorando' | 'vazio';
export type News2Trend = 'subindo' | 'estavel' | 'caindo';
export type GoalsStatus = 'definidos' | 'pendente' | 'em-conversa';
export type FamilyMeetingStatus = 'agendada' | 'realizada' | 'nao-agendada';

export interface VentilationConfig {
  mode: string;
  fio2: number;
  peep: number;
}

export interface Vitals {
  hr: number;
  bp: string;
  rr: number;
  spo2: number;
  temp: number;
}

export interface IcuBed {
  id: string;
  occupied: boolean;
  patient?: {
    name: string;
    age: number;
    mrn: string;
    icuDay: number;
    diagnosis: string;
    attendingMd: string;
  };
  severity: Severity;
  news2?: number;
  news2Trend?: News2Trend;
  vitals?: Vitals;
  ventilation?: VentilationConfig;
  vasopressors?: { name: string; dose: string }[];
  sedation?: { agent: string; rass: number } | null;
  devices?: string[];
  alerts?: string[];
  goalsOfCare?: GoalsStatus;
  familyMeeting?: FamilyMeetingStatus;
  apache2?: number;
  predictedMortality?: number;
  vitalsHistory?: { t: string; hr: number; spo2: number; map: number }[];
  medications?: { name: string; schedule: string; lastGiven: string }[];
  procedures?: { time: string; description: string }[];
}

export const BEDS: IcuBed[] = [
  {
    id: 'UTI-01',
    occupied: true,
    patient: {
      name: 'Ana Beatriz Silva',
      age: 68,
      mrn: 'MRN-401',
      icuDay: 3,
      diagnosis: 'Choque séptico (foco pulmonar)',
      attendingMd: 'Dra. Priya Shah',
    },
    severity: 'critico',
    news2: 11,
    news2Trend: 'subindo',
    vitals: { hr: 132, bp: '82/48', rr: 28, spo2: 89, temp: 39.1 },
    ventilation: { mode: 'PCV', fio2: 70, peep: 12 },
    vasopressors: [
      { name: 'Noradrenalina', dose: '0.45 mcg/kg/min' },
      { name: 'Vasopressina', dose: '0.03 U/min' },
    ],
    sedation: { agent: 'Propofol + Fentanil', rass: -4 },
    devices: ['VM invasiva', 'CVC', 'SVD', 'PAI', 'SNE'],
    alerts: ['Deterioração (NEWS2 ↑)', 'Sepsis Bundle 1h pendente', 'Lactato 5.2'],
    goalsOfCare: 'em-conversa',
    familyMeeting: 'agendada',
    apache2: 28,
    predictedMortality: 54,
    vitalsHistory: [
      { t: '04h', hr: 118, spo2: 93, map: 68 },
      { t: '06h', hr: 124, spo2: 92, map: 64 },
      { t: '08h', hr: 128, spo2: 90, map: 60 },
      { t: '09h', hr: 132, spo2: 89, map: 58 },
    ],
    medications: [
      { name: 'Meropenem 1g IV', schedule: '8/8h', lastGiven: '08:00' },
      { name: 'Noradrenalina 16mg/250ml', schedule: 'Contínuo', lastGiven: 'agora' },
      { name: 'Hidrocortisona 50mg IV', schedule: '6/6h', lastGiven: '06:00' },
    ],
    procedures: [
      { time: '07:30', description: 'Recrutamento alveolar' },
      { time: '05:10', description: 'Intubação orotraqueal' },
    ],
  },
  {
    id: 'UTI-02',
    occupied: true,
    patient: {
      name: 'Carlos Henrique Diaz',
      age: 54,
      mrn: 'MRN-402',
      icuDay: 1,
      diagnosis: 'IAM c/ supra — pós CATE',
      attendingMd: 'Dr. Bruno Tavares',
    },
    severity: 'grave',
    news2: 7,
    news2Trend: 'estavel',
    vitals: { hr: 92, bp: '108/64', rr: 20, spo2: 96, temp: 36.8 },
    vasopressors: [{ name: 'Noradrenalina', dose: '0.10 mcg/kg/min' }],
    sedation: null,
    devices: ['CVC', 'PAI', 'Marcapasso transitório'],
    alerts: ['Reavaliação cardiológica pendente'],
    goalsOfCare: 'definidos',
    familyMeeting: 'realizada',
    apache2: 18,
    predictedMortality: 22,
  },
  {
    id: 'UTI-03',
    occupied: true,
    patient: {
      name: 'Fatima Al-Rashid',
      age: 38,
      mrn: 'MRN-403',
      icuDay: 5,
      diagnosis: 'Pós-op laparotomia exploradora',
      attendingMd: 'Dra. Priya Shah',
    },
    severity: 'estavel',
    news2: 3,
    news2Trend: 'caindo',
    vitals: { hr: 78, bp: '124/72', rr: 16, spo2: 98, temp: 37.0 },
    devices: ['PICC', 'SVD'],
    alerts: [],
    goalsOfCare: 'definidos',
    familyMeeting: 'realizada',
    apache2: 9,
    predictedMortality: 6,
  },
  {
    id: 'UTI-04',
    occupied: true,
    patient: {
      name: 'Robert Ngozi',
      age: 72,
      mrn: 'MRN-404',
      icuDay: 8,
      diagnosis: 'SDRA secundária a pneumonia',
      attendingMd: 'Dr. Ivan Melo',
    },
    severity: 'grave',
    news2: 8,
    news2Trend: 'estavel',
    vitals: { hr: 104, bp: '118/70', rr: 26, spo2: 92, temp: 37.9 },
    ventilation: { mode: 'PCV-PRVC', fio2: 55, peep: 10 },
    sedation: { agent: 'Midazolam + Fentanil', rass: -3 },
    devices: ['VM invasiva', 'CVC', 'SVD', 'SNE'],
    alerts: ['Posição prona em curso (14h)'],
    goalsOfCare: 'em-conversa',
    familyMeeting: 'agendada',
    apache2: 22,
    predictedMortality: 38,
  },
  {
    id: 'UTI-05',
    occupied: true,
    patient: {
      name: 'Joana Lima',
      age: 44,
      mrn: 'MRN-405',
      icuDay: 2,
      diagnosis: 'Cetoacidose diabética severa',
      attendingMd: 'Dra. Helena Couto',
    },
    severity: 'estavel',
    news2: 4,
    news2Trend: 'caindo',
    vitals: { hr: 86, bp: '122/78', rr: 18, spo2: 98, temp: 36.9 },
    devices: ['CVC', 'SVD', 'Bomba insulina'],
    alerts: [],
    goalsOfCare: 'definidos',
    familyMeeting: 'nao-agendada',
    apache2: 11,
    predictedMortality: 9,
  },
  {
    id: 'UTI-06',
    occupied: true,
    patient: {
      name: 'Eleanor Voss',
      age: 81,
      mrn: 'MRN-406',
      icuDay: 12,
      diagnosis: 'AVCi extenso com edema cerebral',
      attendingMd: 'Dr. Ivan Melo',
    },
    severity: 'critico',
    news2: 10,
    news2Trend: 'subindo',
    vitals: { hr: 118, bp: '168/92', rr: 22, spo2: 94, temp: 38.4 },
    ventilation: { mode: 'VCV', fio2: 40, peep: 8 },
    sedation: { agent: 'Propofol', rass: -5 },
    vasopressors: [{ name: 'Noradrenalina', dose: '0.25 mcg/kg/min' }],
    devices: ['VM invasiva', 'PIC', 'CVC', 'SVD'],
    alerts: ['PIC > 25 mmHg', 'Goals-of-care urgente', 'Pupilas anisocóricas'],
    goalsOfCare: 'em-conversa',
    familyMeeting: 'agendada',
    apache2: 31,
    predictedMortality: 68,
  },
  {
    id: 'UTI-07',
    occupied: true,
    patient: {
      name: 'Thomas Crane',
      age: 52,
      mrn: 'MRN-407',
      icuDay: 4,
      diagnosis: 'Pancreatite aguda grave',
      attendingMd: 'Dra. Priya Shah',
    },
    severity: 'grave',
    news2: 6,
    news2Trend: 'estavel',
    vitals: { hr: 96, bp: '126/80', rr: 19, spo2: 95, temp: 37.6 },
    devices: ['CVC', 'SNE', 'SVD'],
    alerts: ['Reavaliação pendente'],
    goalsOfCare: 'definidos',
    familyMeeting: 'realizada',
    apache2: 16,
    predictedMortality: 18,
  },
  {
    id: 'UTI-08',
    occupied: true,
    patient: {
      name: 'Felipe Andrade',
      age: 27,
      mrn: 'MRN-408',
      icuDay: 1,
      diagnosis: 'Politrauma pós-acidente',
      attendingMd: 'Dr. Bruno Tavares',
    },
    severity: 'melhorando',
    news2: 3,
    news2Trend: 'caindo',
    vitals: { hr: 82, bp: '130/82', rr: 17, spo2: 98, temp: 36.7 },
    devices: ['PICC', 'Dreno torácico'],
    alerts: [],
    goalsOfCare: 'definidos',
    familyMeeting: 'realizada',
    apache2: 10,
    predictedMortality: 7,
  },
  {
    id: 'UTI-09',
    occupied: true,
    patient: {
      name: 'Marcos Oliveira',
      age: 61,
      mrn: 'MRN-409',
      icuDay: 6,
      diagnosis: 'Pós-op CRM',
      attendingMd: 'Dr. Bruno Tavares',
    },
    severity: 'estavel',
    news2: 2,
    news2Trend: 'caindo',
    vitals: { hr: 72, bp: '118/70', rr: 15, spo2: 98, temp: 36.5 },
    devices: ['CVC', 'Dreno mediastinal'],
    alerts: [],
    goalsOfCare: 'definidos',
    familyMeeting: 'realizada',
    apache2: 8,
    predictedMortality: 5,
  },
  {
    id: 'UTI-10',
    occupied: true,
    patient: {
      name: 'Sarah Mitchell',
      age: 54,
      mrn: 'MRN-410',
      icuDay: 2,
      diagnosis: 'Pós-op colecistectomia c/ complicação',
      attendingMd: 'Dra. Helena Couto',
    },
    severity: 'melhorando',
    news2: 4,
    news2Trend: 'caindo',
    vitals: { hr: 88, bp: '120/74', rr: 18, spo2: 97, temp: 37.2 },
    devices: ['PICC', 'Dreno abdominal'],
    alerts: ['Desmame sedação'],
    goalsOfCare: 'definidos',
    familyMeeting: 'realizada',
    apache2: 12,
    predictedMortality: 10,
  },
  { id: 'UTI-11', occupied: false, severity: 'vazio' },
  { id: 'UTI-12', occupied: false, severity: 'vazio' },
];
