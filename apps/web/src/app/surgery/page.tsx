'use client';

import { useMemo, useState } from 'react';
import {
  SURGERIES,
  type AsaRisk,
  type Surgery,
  type SurgeryStatus,
  type TimelineStage,
} from '../../lib/fixtures/surgeries';
import { AppShell } from '../components/app-shell';

const ROOMS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6', 'Sala 7', 'Sala 8'];

const STATUS_CONFIG: Record<
  SurgeryStatus,
  { label: string; icon: string; bar: string; badge: string }
> = {
  planned: {
    label: 'Planejada',
    icon: '⚪',
    bar: 'bg-slate-100 border-slate-300',
    badge: 'bg-slate-100 text-slate-700 border border-slate-300',
  },
  preop: {
    label: 'Pré-op',
    icon: '🔵',
    bar: 'bg-blue-100 border-blue-300',
    badge: 'bg-blue-100 text-blue-800 border border-blue-300',
  },
  'in-progress': {
    label: 'Em Andamento',
    icon: '🟡',
    bar: 'bg-amber-100 border-amber-400',
    badge: 'bg-amber-100 text-amber-800 border border-amber-300',
  },
  completed: {
    label: 'Concluída',
    icon: '🟢',
    bar: 'bg-emerald-100 border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  },
  cancelled: {
    label: 'Cancelada',
    icon: '🔴',
    bar: 'bg-red-100 border-red-300',
    badge: 'bg-red-100 text-red-800 border border-red-300',
  },
};

const ASA_COLORS: Record<AsaRisk, string> = {
  I: 'bg-emerald-100 text-emerald-800',
  II: 'bg-blue-100 text-blue-800',
  III: 'bg-amber-100 text-amber-800',
  IV: 'bg-orange-100 text-orange-800',
  V: 'bg-red-100 text-red-800',
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

  const PIXELS_PER_MINUTE = 1.8;

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
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold">
            Cirurgias Hoje
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{kpis.total}</div>
          <div className="text-xs text-slate-600 mt-1">Total programado</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-amber-800 font-semibold">
            Em Andamento
          </div>
          <div className="text-3xl font-bold text-amber-800 mt-1">{kpis.inProgress}</div>
          <div className="text-xs text-slate-600 mt-1">Neste momento</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-emerald-800 font-semibold">
            Concluídas
          </div>
          <div className="text-3xl font-bold text-emerald-700 mt-1">{kpis.completed}</div>
          <div className="text-xs text-slate-600 mt-1">Encerradas hoje</div>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-orange-800 font-semibold">
            Atrasos
          </div>
          <div className="text-3xl font-bold text-orange-700 mt-1">{kpis.delayed}</div>
          <div className="text-xs text-slate-600 mt-1">Fora do cronograma</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-blue-800 font-semibold">
            Utilização de Salas
          </div>
          <div className="text-3xl font-bold text-blue-700 mt-1">{kpis.utilization}%</div>
          <div className="text-xs text-slate-600 mt-1">Capacidade 6h-18h</div>
        </div>
      </div>

      {/* Room schedule grid */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 mb-4 overflow-hidden">
        <div className="text-sm font-semibold text-slate-800 mb-3">Agenda do Dia por Sala</div>
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${120 + HOURS.length * 60 * PIXELS_PER_MINUTE}px` }}>
            {/* Hour headers */}
            <div className="flex items-center border-b border-slate-200 pb-1 mb-2">
              <div className="w-[120px] shrink-0 text-[11px] text-slate-600 font-semibold">Sala</div>
              <div className="flex-1 relative h-5">
                {HOURS.map((h, idx) => (
                  <div
                    key={h}
                    className="absolute top-0 text-[10px] text-slate-600 font-mono"
                    style={{ left: `${idx * 60 * PIXELS_PER_MINUTE}px` }}
                  >
                    {String(h).padStart(2, '0')}h
                  </div>
                ))}
              </div>
            </div>

            {/* Room rows */}
            {ROOMS.map((room) => (
              <div key={room} className="flex items-center border-b border-slate-100 py-1.5">
                <div className="w-[120px] shrink-0 text-xs text-slate-800 font-semibold">{room}</div>
                <div
                  className="flex-1 relative h-10 bg-slate-50 rounded"
                  style={{ minWidth: `${HOURS.length * 60 * PIXELS_PER_MINUTE}px` }}
                >
                  {/* Hour gridlines */}
                  {HOURS.map((_, idx) => (
                    <div
                      key={idx}
                      className="absolute top-0 bottom-0 w-px bg-slate-200"
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
                        className={`absolute top-0.5 bottom-0.5 rounded border ${cfg.bar} px-1.5 text-left overflow-hidden hover:bg-slate-50 transition`}
                        style={{ left: `${left}px`, width: `${Math.max(width, 40)}px` }}
                        title={`${s.startTime} · ${s.patientName} — ${s.procedure}`}
                      >
                        <div className="text-[11px] font-bold text-slate-900 truncate leading-tight">
                          {s.startTime} · {s.patientName.split(' ')[0]}
                        </div>
                        <div className="text-[10px] text-slate-800 truncate leading-tight font-semibold">
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
              <span className="text-slate-600">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 mb-4">
        <div className="text-sm font-semibold text-slate-800 mb-3">Próximas Cirurgias</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-slate-600 uppercase tracking-wider border-b border-slate-200">
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
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2 pr-3 font-mono text-slate-800">{s.startTime}</td>
                    <td className="py-2 pr-3">
                      <div className="text-slate-900 font-medium">{s.patientName}</div>
                      <div className="text-[10px] text-slate-600">
                        {s.mrn} · {s.patientAge}a
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-slate-800">{s.procedure}</td>
                    <td className="py-2 pr-3 text-slate-600">{s.room}</td>
                    <td className="py-2 pr-3 text-slate-600">{s.mainSurgeon}</td>
                    <td className="py-2 pr-3 text-slate-600">{s.anesthesia}</td>
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
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setSelectedSurgery(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-slate-600 uppercase tracking-wider">
                  {selectedSurgery.id} · {selectedSurgery.room}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedSurgery.procedure}</h2>
                <div className="text-sm text-slate-600 mt-1">
                  {selectedSurgery.patientName} · {selectedSurgery.patientAge}a · {selectedSurgery.mrn}
                </div>
              </div>
              <button
                onClick={() => setSelectedSurgery(null)}
                className="text-slate-600 hover:text-slate-900 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[10px] uppercase tracking-wider text-slate-600">Horário</div>
                <div className="text-sm text-slate-900 font-semibold mt-1">
                  {selectedSurgery.startTime} ({selectedSurgery.durationMin} min)
                </div>
              </div>
              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[10px] uppercase tracking-wider text-slate-600">Anestesia</div>
                <div className="text-sm text-slate-900 font-semibold mt-1">
                  {selectedSurgery.anesthesia}
                </div>
              </div>
              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[10px] uppercase tracking-wider text-slate-600">Risco ASA</div>
                <div className="mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${ASA_COLORS[selectedSurgery.asa]}`}
                  >
                    ASA {selectedSurgery.asa}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[10px] uppercase tracking-wider text-slate-600">Status</div>
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
              <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">
                Cirurgião Principal
              </div>
              <div className="text-sm text-slate-900">{selectedSurgery.mainSurgeon}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600 mt-3 mb-1.5">
                Equipe
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedSurgery.team.map((member) => (
                  <span
                    key={member}
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200"
                  >
                    {member}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">
                Equipamentos Especiais
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedSurgery.equipment.map((eq) => (
                  <span
                    key={eq}
                    className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200"
                  >
                    {eq}
                  </span>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">
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
                              ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                              : isCurrent
                                ? 'bg-amber-100 border-amber-400 text-amber-800 animate-pulse'
                                : 'bg-slate-50 border-slate-300 text-slate-600'
                          }`}
                        >
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <div
                          className={`text-[9px] mt-1 text-center ${
                            isCurrent ? 'text-amber-800 font-semibold' : 'text-slate-600'
                          }`}
                        >
                          {stage.label}
                        </div>
                      </div>
                      {idx < TIMELINE_STAGES.length - 1 && (
                        <div
                          className={`h-0.5 w-full mb-4 ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`}
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
