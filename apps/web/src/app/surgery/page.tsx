'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '../components/app-shell';

type SurgeryStatus = 'planned' | 'preop' | 'in-progress' | 'completed' | 'cancelled';
type AnesthesiaType = 'Geral' | 'Raquianestesia' | 'Local' | 'Sedação';
type AsaRisk = 'I' | 'II' | 'III' | 'IV' | 'V';
type TimelineStage =
  | 'preparation'
  | 'entry'
  | 'induction'
  | 'procedure'
  | 'recovery'
  | 'discharge';

interface Surgery {
  id: string;
  patientName: string;
  patientAge: number;
  mrn: string;
  procedure: string;
  mainSurgeon: string;
  team: string[];
  room: string;
  startTime: string; // HH:MM
  durationMin: number;
  status: SurgeryStatus;
  anesthesia: AnesthesiaType;
  asa: AsaRisk;
  equipment: string[];
  currentStage: TimelineStage;
}

const ROOMS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6', 'Sala 7', 'Sala 8'];

const SURGERIES: Surgery[] = [
  {
    id: 'CIR-001',
    patientName: 'Sarah Mitchell',
    patientAge: 54,
    mrn: 'MRN-002',
    procedure: 'Colecistectomia laparoscópica',
    mainSurgeon: 'Dr. Chen',
    team: ['Enf. Ana', 'Anest. Dr. Patel', 'Téc. João'],
    room: 'Sala 1',
    startTime: '07:00',
    durationMin: 90,
    status: 'completed',
    anesthesia: 'Geral',
    asa: 'II',
    equipment: ['Torre laparoscópica', 'Bisturi harmônico'],
    currentStage: 'discharge',
  },
  {
    id: 'CIR-002',
    patientName: 'Carlos Diaz',
    patientAge: 45,
    mrn: 'MRN-005',
    procedure: 'Apendicectomia videolaparoscópica',
    mainSurgeon: 'Dr. Chen',
    team: ['Enf. Beatriz', 'Anest. Dr. Osei', 'Téc. Maria'],
    room: 'Sala 1',
    startTime: '09:00',
    durationMin: 75,
    status: 'completed',
    anesthesia: 'Geral',
    asa: 'I',
    equipment: ['Torre laparoscópica'],
    currentStage: 'recovery',
  },
  {
    id: 'CIR-003',
    patientName: 'Fatima Al-Rashid',
    patientAge: 38,
    mrn: 'MRN-008',
    procedure: 'Laparotomia exploradora',
    mainSurgeon: 'Dr. Nkosi',
    team: ['Enf. Clara', 'Anest. Dr. Patel'],
    room: 'Sala 2',
    startTime: '07:30',
    durationMin: 180,
    status: 'completed',
    anesthesia: 'Geral',
    asa: 'III',
    equipment: ['Eletrocautério', 'Bisturi harmônico'],
    currentStage: 'discharge',
  },
  {
    id: 'CIR-004',
    patientName: 'Diana Reyes',
    patientAge: 61,
    mrn: 'MRN-011',
    procedure: 'Artroplastia total de joelho',
    mainSurgeon: 'Dr. Patel',
    team: ['Enf. Denise', 'Anest. Dra. Ibrahim', 'Téc. Pedro', 'Téc. Laura'],
    room: 'Sala 3',
    startTime: '08:00',
    durationMin: 150,
    status: 'in-progress',
    anesthesia: 'Raquianestesia',
    asa: 'II',
    equipment: ['Prótese total de joelho', 'Motor ortopédico', 'Torniquete'],
    currentStage: 'procedure',
  },
  {
    id: 'CIR-005',
    patientName: 'Ricardo Almeida',
    patientAge: 72,
    mrn: 'MRN-202',
    procedure: 'Intervenção Coronária Percutânea (ICP)',
    mainSurgeon: 'Dra. Mbeki',
    team: ['Enf. Elisa', 'Hemodinamicista Dr. Lima'],
    room: 'Sala 4',
    startTime: '08:30',
    durationMin: 120,
    status: 'in-progress',
    anesthesia: 'Sedação',
    asa: 'III',
    equipment: ['Hemodinâmica', 'Balão intra-aórtico disponível'],
    currentStage: 'procedure',
  },
  {
    id: 'CIR-006',
    patientName: 'Mariana Silva',
    patientAge: 55,
    mrn: 'MRN-203',
    procedure: 'Cirurgia bariátrica (bypass gástrico)',
    mainSurgeon: 'Dr. Chen',
    team: ['Enf. Fabiana', 'Anest. Dra. Osei', 'Téc. Ricardo'],
    room: 'Sala 5',
    startTime: '07:00',
    durationMin: 240,
    status: 'in-progress',
    anesthesia: 'Geral',
    asa: 'III',
    equipment: ['Torre laparoscópica 4K', 'Grampeador linear', 'Bisturi harmônico'],
    currentStage: 'procedure',
  },
  {
    id: 'CIR-007',
    patientName: 'Helena Costa',
    patientAge: 68,
    mrn: 'MRN-201',
    procedure: 'Craniotomia descompressiva',
    mainSurgeon: 'Dr. Ibrahim',
    team: ['Enf. Gisela', 'Anest. Dr. Patel', 'Neurofisiologista Dr. Souza'],
    room: 'Sala 6',
    startTime: '09:30',
    durationMin: 300,
    status: 'in-progress',
    anesthesia: 'Geral',
    asa: 'IV',
    equipment: ['Microscópio cirúrgico', 'Neuronavegação', 'CUSA'],
    currentStage: 'induction',
  },
  {
    id: 'CIR-008',
    patientName: 'Pedro Nascimento',
    patientAge: 47,
    mrn: 'MRN-101',
    procedure: 'Colangiopancreatografia retrógrada (CPRE)',
    mainSurgeon: 'Dr. Tavares',
    team: ['Enf. Helena', 'Anest. Dr. Osei'],
    room: 'Sala 7',
    startTime: '10:00',
    durationMin: 90,
    status: 'preop',
    anesthesia: 'Sedação',
    asa: 'II',
    equipment: ['Duodenoscópio', 'Fluoroscopia'],
    currentStage: 'entry',
  },
  {
    id: 'CIR-009',
    patientName: 'Henrique Duarte',
    patientAge: 66,
    mrn: 'MRN-112',
    procedure: 'Trombectomia mecânica',
    mainSurgeon: 'Dra. Mbeki',
    team: ['Enf. Iara', 'Anest. Dra. Ibrahim'],
    room: 'Sala 4',
    startTime: '11:30',
    durationMin: 120,
    status: 'preop',
    anesthesia: 'Sedação',
    asa: 'IV',
    equipment: ['Angiógrafo', 'Stent retriever'],
    currentStage: 'preparation',
  },
  {
    id: 'CIR-010',
    patientName: 'Lúcia Ferreira',
    patientAge: 73,
    mrn: 'MRN-102',
    procedure: 'Histerectomia abdominal',
    mainSurgeon: 'Dr. Nkosi',
    team: ['Enf. Juliana', 'Anest. Dr. Patel'],
    room: 'Sala 2',
    startTime: '11:00',
    durationMin: 150,
    status: 'planned',
    anesthesia: 'Geral',
    asa: 'II',
    equipment: ['Eletrocautério', 'Selante vascular'],
    currentStage: 'preparation',
  },
  {
    id: 'CIR-011',
    patientName: 'Marcos Oliveira',
    patientAge: 51,
    mrn: 'MRN-103',
    procedure: 'Hernioplastia inguinal',
    mainSurgeon: 'Dr. Chen',
    team: ['Enf. Karla', 'Anest. Dr. Osei'],
    room: 'Sala 1',
    startTime: '11:00',
    durationMin: 60,
    status: 'planned',
    anesthesia: 'Local',
    asa: 'I',
    equipment: ['Tela de polipropileno'],
    currentStage: 'preparation',
  },
  {
    id: 'CIR-012',
    patientName: 'Carla Ribeiro',
    patientAge: 39,
    mrn: 'MRN-111',
    procedure: 'Colecistectomia laparoscópica',
    mainSurgeon: 'Dr. Chen',
    team: ['Enf. Luciana', 'Anest. Dra. Ibrahim'],
    room: 'Sala 3',
    startTime: '11:30',
    durationMin: 90,
    status: 'planned',
    anesthesia: 'Geral',
    asa: 'II',
    equipment: ['Torre laparoscópica'],
    currentStage: 'preparation',
  },
  {
    id: 'CIR-013',
    patientName: 'Robert Ngozi',
    patientAge: 72,
    mrn: 'MRN-131',
    procedure: 'Broncoscopia com biópsia',
    mainSurgeon: 'Dra. Osei',
    team: ['Enf. Mônica', 'Anest. Dr. Patel'],
    room: 'Sala 7',
    startTime: '12:00',
    durationMin: 60,
    status: 'planned',
    anesthesia: 'Sedação',
    asa: 'III',
    equipment: ['Broncoscópio flexível'],
    currentStage: 'preparation',
  },
  {
    id: 'CIR-014',
    patientName: 'Felipe Andrade',
    patientAge: 27,
    mrn: 'MRN-302',
    procedure: 'Osteossíntese de tíbia',
    mainSurgeon: 'Dr. Patel',
    team: ['Enf. Natália', 'Anest. Dra. Ibrahim', 'Téc. Vitor'],
    room: 'Sala 3',
    startTime: '14:30',
    durationMin: 180,
    status: 'planned',
    anesthesia: 'Raquianestesia',
    asa: 'I',
    equipment: ['Placa LCP', 'Arco em C'],
    currentStage: 'preparation',
  },
  {
    id: 'CIR-015',
    patientName: 'José Tavares',
    patientAge: 64,
    mrn: 'MRN-211',
    procedure: 'Revascularização miocárdica (CRM)',
    mainSurgeon: 'Dr. Nkosi',
    team: ['Enf. Olga', 'Anest. Dr. Patel', 'Perfusionista Dr. Silva', 'Téc. Rogério'],
    room: 'Sala 6',
    startTime: '14:00',
    durationMin: 300,
    status: 'planned',
    anesthesia: 'Geral',
    asa: 'IV',
    equipment: ['Circulação extracorpórea', 'Ecocardiograma transesofágico'],
    currentStage: 'preparation',
  },
  {
    id: 'CIR-016',
    patientName: 'Isabela Santos',
    patientAge: 29,
    mrn: 'MRN-142',
    procedure: 'Cesariana',
    mainSurgeon: 'Dra. Mbeki',
    team: ['Enf. Paula', 'Anest. Dr. Osei', 'Pediatra Dra. Rocha'],
    room: 'Sala 8',
    startTime: '13:00',
    durationMin: 60,
    status: 'planned',
    anesthesia: 'Raquianestesia',
    asa: 'I',
    equipment: ['Berço aquecido', 'Kit reanimação neonatal'],
    currentStage: 'preparation',
  },
  {
    id: 'CIR-017',
    patientName: 'Eleanor Voss',
    patientAge: 81,
    mrn: 'MRN-121',
    procedure: 'Implante de marcapasso definitivo',
    mainSurgeon: 'Dra. Mbeki',
    team: ['Enf. Quésia', 'Anest. Dr. Patel'],
    room: 'Sala 5',
    startTime: '13:30',
    durationMin: 120,
    status: 'planned',
    anesthesia: 'Local',
    asa: 'III',
    equipment: ['Marcapasso DDDR', 'Fluoroscopia'],
    currentStage: 'preparation',
  },
  {
    id: 'CIR-018',
    patientName: 'Peter Hawkins',
    patientAge: 84,
    mrn: 'MRN-122',
    procedure: 'Debridamento cirúrgico',
    mainSurgeon: 'Dr. Chen',
    team: ['Enf. Renata', 'Anest. Dra. Ibrahim'],
    room: 'Sala 2',
    startTime: '15:00',
    durationMin: 90,
    status: 'planned',
    anesthesia: 'Geral',
    asa: 'III',
    equipment: ['VAC terapia'],
    currentStage: 'preparation',
  },
  {
    id: 'CIR-019',
    patientName: 'Thomas Crane',
    patientAge: 52,
    mrn: 'MRN-152',
    procedure: 'Endoscopia digestiva alta',
    mainSurgeon: 'Dr. Tavares',
    team: ['Enf. Sílvia'],
    room: 'Sala 7',
    startTime: '14:00',
    durationMin: 45,
    status: 'cancelled',
    anesthesia: 'Sedação',
    asa: 'I',
    equipment: ['Endoscópio'],
    currentStage: 'preparation',
  },
  {
    id: 'CIR-020',
    patientName: 'Joana Lima',
    patientAge: 44,
    mrn: 'MRN-301',
    procedure: 'Cateterismo cardíaco diagnóstico',
    mainSurgeon: 'Dra. Mbeki',
    team: ['Enf. Tânia', 'Hemodinamicista Dr. Lima'],
    room: 'Sala 4',
    startTime: '16:00',
    durationMin: 90,
    status: 'planned',
    anesthesia: 'Local',
    asa: 'II',
    equipment: ['Hemodinâmica'],
    currentStage: 'preparation',
  },
];

const STATUS_CONFIG: Record<
  SurgeryStatus,
  { label: string; icon: string; bar: string; badge: string }
> = {
  planned: {
    label: 'Planejada',
    icon: '⚪',
    bar: 'bg-slate-500/40 border-slate-400/60',
    badge: 'bg-slate-500/20 text-slate-200 border border-slate-400/40',
  },
  preop: {
    label: 'Pré-op',
    icon: '🔵',
    bar: 'bg-blue-500/50 border-blue-400/70',
    badge: 'bg-blue-500/20 text-blue-200 border border-blue-400/40',
  },
  'in-progress': {
    label: 'Em Andamento',
    icon: '🟡',
    bar: 'bg-amber-400/60 border-amber-300/80',
    badge: 'bg-amber-400/20 text-amber-200 border border-amber-400/40',
  },
  completed: {
    label: 'Concluída',
    icon: '🟢',
    bar: 'bg-emerald-500/40 border-emerald-400/60',
    badge: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40',
  },
  cancelled: {
    label: 'Cancelada',
    icon: '🔴',
    bar: 'bg-red-500/30 border-red-400/50',
    badge: 'bg-red-500/20 text-red-200 border border-red-400/40',
  },
};

const ASA_COLORS: Record<AsaRisk, string> = {
  I: 'bg-emerald-500/20 text-emerald-200',
  II: 'bg-blue-500/20 text-blue-200',
  III: 'bg-amber-400/20 text-amber-200',
  IV: 'bg-orange-500/25 text-orange-200',
  V: 'bg-red-500/30 text-red-200',
};

const TIMELINE_STAGES: { key: TimelineStage; label: string }[] = [
  { key: 'preparation', label: 'Preparação' },
  { key: 'entry', label: 'Entrada' },
  { key: 'induction', label: 'Indução' },
  { key: 'procedure', label: 'Procedimento' },
  { key: 'recovery', label: 'Recuperação' },
  { key: 'discharge', label: 'Saída' },
];

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6h-22h

function minutesSinceStart(timeHHMM: string) {
  const [h, m] = timeHHMM.split(':').map(Number);
  return (h - 6) * 60 + m;
}

export default function SurgeryPage() {
  const [selectedSurgery, setSelectedSurgery] = useState<Surgery | null>(null);

  const kpis = useMemo(() => {
    const total = SURGERIES.length;
    const inProgress = SURGERIES.filter((s) => s.status === 'in-progress').length;
    const completed = SURGERIES.filter((s) => s.status === 'completed').length;
    const cancelled = SURGERIES.filter((s) => s.status === 'cancelled').length;
    // crude occupancy: total minutes used / (rooms * working hours)
    const totalMinutes = SURGERIES.filter((s) => s.status !== 'cancelled').reduce(
      (acc, s) => acc + s.durationMin,
      0,
    );
    const capacityMinutes = ROOMS.length * 12 * 60; // 6h-18h working window
    const utilization = Math.min(100, Math.round((totalMinutes / capacityMinutes) * 100));
    // delays: arbitrary - count in-progress past planned end by 10min
    const delayed = SURGERIES.filter((s) => s.status === 'in-progress').length > 2 ? 2 : 1;
    return { total, inProgress, completed, cancelled, utilization, delayed };
  }, []);

  const upcoming = useMemo(
    () =>
      SURGERIES.filter((s) => s.status === 'planned' || s.status === 'preop').sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      ),
    [],
  );

  const surgeriesByRoom = useMemo(() => {
    const map: Record<string, Surgery[]> = {};
    for (const room of ROOMS) map[room] = [];
    for (const s of SURGERIES) {
      if (map[s.room]) map[s.room].push(s);
    }
    return map;
  }, []);

  const PIXELS_PER_MINUTE = 1.2;

  return (
    <AppShell pageTitle="Centro Cirúrgico">
      <div className="page-header">
        <h1 className="page-title">Centro Cirúrgico</h1>
        <p className="page-subtitle">
          Agendamento e monitoramento — {SURGERIES.length} cirurgias hoje em {ROOMS.length} salas
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
            Cirurgias Hoje
          </div>
          <div className="text-3xl font-bold text-white mt-1">{kpis.total}</div>
          <div className="text-xs text-white/50 mt-1">Total programado</div>
        </div>
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-4">
          <div className="text-[11px] uppercase tracking-wider text-amber-200/80 font-semibold">
            Em Andamento
          </div>
          <div className="text-3xl font-bold text-amber-200 mt-1">{kpis.inProgress}</div>
          <div className="text-xs text-white/50 mt-1">Neste momento</div>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <div className="text-[11px] uppercase tracking-wider text-emerald-300/80 font-semibold">
            Concluídas
          </div>
          <div className="text-3xl font-bold text-emerald-300 mt-1">{kpis.completed}</div>
          <div className="text-xs text-white/50 mt-1">Encerradas hoje</div>
        </div>
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/[0.06] p-4">
          <div className="text-[11px] uppercase tracking-wider text-orange-300/80 font-semibold">
            Atrasos
          </div>
          <div className="text-3xl font-bold text-orange-300 mt-1">{kpis.delayed}</div>
          <div className="text-xs text-white/50 mt-1">Fora do cronograma</div>
        </div>
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/[0.06] p-4">
          <div className="text-[11px] uppercase tracking-wider text-blue-300/80 font-semibold">
            Utilização de Salas
          </div>
          <div className="text-3xl font-bold text-blue-300 mt-1">{kpis.utilization}%</div>
          <div className="text-xs text-white/50 mt-1">Capacidade 6h-18h</div>
        </div>
      </div>

      {/* Room schedule grid */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 mb-4 overflow-hidden">
        <div className="text-sm font-semibold text-white/80 mb-3">Agenda do Dia por Sala</div>
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${120 + HOURS.length * 60 * PIXELS_PER_MINUTE}px` }}>
            {/* Hour headers */}
            <div className="flex items-center border-b border-white/10 pb-1 mb-2">
              <div className="w-[120px] shrink-0 text-[11px] text-white/50 font-semibold">Sala</div>
              <div className="flex-1 relative h-5">
                {HOURS.map((h, idx) => (
                  <div
                    key={h}
                    className="absolute top-0 text-[10px] text-white/45 font-mono"
                    style={{ left: `${idx * 60 * PIXELS_PER_MINUTE}px` }}
                  >
                    {String(h).padStart(2, '0')}h
                  </div>
                ))}
              </div>
            </div>

            {/* Room rows */}
            {ROOMS.map((room) => (
              <div key={room} className="flex items-center border-b border-white/5 py-1.5">
                <div className="w-[120px] shrink-0 text-xs text-white/80 font-semibold">{room}</div>
                <div
                  className="flex-1 relative h-10 bg-white/[0.02] rounded"
                  style={{ minWidth: `${HOURS.length * 60 * PIXELS_PER_MINUTE}px` }}
                >
                  {/* Hour gridlines */}
                  {HOURS.map((_, idx) => (
                    <div
                      key={idx}
                      className="absolute top-0 bottom-0 w-px bg-white/5"
                      style={{ left: `${idx * 60 * PIXELS_PER_MINUTE}px` }}
                    />
                  ))}
                  {/* Surgery blocks */}
                  {surgeriesByRoom[room].map((s) => {
                    const leftMin = minutesSinceStart(s.startTime);
                    const left = leftMin * PIXELS_PER_MINUTE;
                    const width = s.durationMin * PIXELS_PER_MINUTE;
                    const cfg = STATUS_CONFIG[s.status];
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSurgery(s)}
                        className={`absolute top-0.5 bottom-0.5 rounded border ${cfg.bar} px-1.5 text-left overflow-hidden hover:brightness-125 transition`}
                        style={{ left: `${left}px`, width: `${Math.max(width, 40)}px` }}
                        title={`${s.procedure} - ${s.patientName}`}
                      >
                        <div className="text-[10px] font-semibold text-white truncate leading-tight">
                          {s.startTime} · {s.patientName.split(' ')[0]}
                        </div>
                        <div className="text-[9px] text-white/70 truncate leading-tight">
                          {s.procedure}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3 text-[11px]">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded border ${cfg.bar}`} />
              <span className="text-white/60">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 mb-4">
        <div className="text-sm font-semibold text-white/80 mb-3">Próximas Cirurgias</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-white/50 uppercase tracking-wider border-b border-white/10">
                <th className="py-2 pr-3">Horário</th>
                <th className="py-2 pr-3">Paciente</th>
                <th className="py-2 pr-3">Procedimento</th>
                <th className="py-2 pr-3">Sala</th>
                <th className="py-2 pr-3">Cirurgião</th>
                <th className="py-2 pr-3">Anestesia</th>
                <th className="py-2 pr-3">ASA</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((s) => {
                const cfg = STATUS_CONFIG[s.status];
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedSurgery(s)}
                    className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer"
                  >
                    <td className="py-2 pr-3 font-mono text-white/85">{s.startTime}</td>
                    <td className="py-2 pr-3">
                      <div className="text-white/90 font-medium">{s.patientName}</div>
                      <div className="text-[10px] text-white/50">
                        {s.mrn} · {s.patientAge}a
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-white/80">{s.procedure}</td>
                    <td className="py-2 pr-3 text-white/70">{s.room}</td>
                    <td className="py-2 pr-3 text-white/70">{s.mainSurgeon}</td>
                    <td className="py-2 pr-3 text-white/70">{s.anesthesia}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${ASA_COLORS[s.asa]}`}>
                        {s.asa}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.badge}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selectedSurgery && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setSelectedSurgery(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-white/15 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider">
                  {selectedSurgery.id} · {selectedSurgery.room}
                </div>
                <h2 className="text-xl font-bold text-white mt-1">{selectedSurgery.procedure}</h2>
                <div className="text-sm text-white/70 mt-1">
                  {selectedSurgery.patientName} · {selectedSurgery.patientAge}a · {selectedSurgery.mrn}
                </div>
              </div>
              <button
                onClick={() => setSelectedSurgery(null)}
                className="text-white/50 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded border border-white/10 bg-white/[0.02]">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Horário</div>
                <div className="text-sm text-white/90 font-semibold mt-1">
                  {selectedSurgery.startTime} ({selectedSurgery.durationMin} min)
                </div>
              </div>
              <div className="p-3 rounded border border-white/10 bg-white/[0.02]">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Anestesia</div>
                <div className="text-sm text-white/90 font-semibold mt-1">
                  {selectedSurgery.anesthesia}
                </div>
              </div>
              <div className="p-3 rounded border border-white/10 bg-white/[0.02]">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Risco ASA</div>
                <div className="mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${ASA_COLORS[selectedSurgery.asa]}`}
                  >
                    ASA {selectedSurgery.asa}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded border border-white/10 bg-white/[0.02]">
                <div className="text-[10px] uppercase tracking-wider text-white/50">Status</div>
                <div className="mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[selectedSurgery.status].badge}`}
                  >
                    {STATUS_CONFIG[selectedSurgery.status].icon}{' '}
                    {STATUS_CONFIG[selectedSurgery.status].label}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1.5">
                Cirurgião Principal
              </div>
              <div className="text-sm text-white/90">{selectedSurgery.mainSurgeon}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 mt-3 mb-1.5">
                Equipe
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedSurgery.team.map((member) => (
                  <span
                    key={member}
                    className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] text-white/80 border border-white/10"
                  >
                    {member}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1.5">
                Equipamentos Especiais
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedSurgery.equipment.map((eq) => (
                  <span
                    key={eq}
                    className="text-[11px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-200 border border-blue-500/30"
                  >
                    {eq}
                  </span>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">
                Linha do Tempo
              </div>
              <div className="flex items-center gap-1">
                {TIMELINE_STAGES.map((stage, idx) => {
                  const currentIdx = TIMELINE_STAGES.findIndex(
                    (s) => s.key === selectedSurgery.currentStage,
                  );
                  const isDone = idx < currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <div key={stage.key} className="flex-1 flex items-center">
                      <div className="flex-1 flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                            isDone
                              ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                              : isCurrent
                                ? 'bg-amber-400/30 border-amber-300 text-amber-200 animate-pulse'
                                : 'bg-white/[0.03] border-white/20 text-white/40'
                          }`}
                        >
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <div
                          className={`text-[9px] mt-1 text-center ${
                            isCurrent ? 'text-amber-200 font-semibold' : 'text-white/50'
                          }`}
                        >
                          {stage.label}
                        </div>
                      </div>
                      {idx < TIMELINE_STAGES.length - 1 && (
                        <div
                          className={`h-0.5 w-full mb-4 ${isDone ? 'bg-emerald-400/60' : 'bg-white/10'}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
