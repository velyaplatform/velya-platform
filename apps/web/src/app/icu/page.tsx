'use client';

import { useMemo, useState } from 'react';
import {
  BEDS,
  type FamilyMeetingStatus,
  type GoalsStatus,
  type IcuBed,
  type News2Trend,
  type Severity,
} from '../../lib/fixtures/icu';
import { AppShell } from '../components/app-shell';

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; className: string; dot: string; border: string }
> = {
  critico: {
    label: 'Crítico',
    className: 'bg-red-100 text-red-800 border-red-300',
    dot: 'bg-red-500',
    border: 'border-red-200 bg-red-50',
  },
  grave: {
    label: 'Grave',
    className: 'bg-orange-100 text-orange-800 border-orange-300',
    dot: 'bg-orange-400',
    border: 'border-orange-200 bg-orange-50',
  },
  estavel: {
    label: 'Estável',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
    dot: 'bg-blue-400',
    border: 'border-blue-200 bg-blue-50',
  },
  melhorando: {
    label: 'Melhorando',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dot: 'bg-emerald-400',
    border: 'border-emerald-200 bg-emerald-50',
  },
  vazio: {
    label: 'Livre',
    className: 'bg-slate-100 text-slate-600 border-slate-300',
    dot: 'bg-slate-400',
    border: 'border-slate-200 bg-slate-50',
  },
};

const TREND_ICON: Record<News2Trend, string> = {
  subindo: '▲',
  estavel: '▬',
  caindo: '▼',
};

const TREND_COLOR: Record<News2Trend, string> = {
  subindo: 'text-red-700',
  estavel: 'text-amber-800',
  caindo: 'text-emerald-700',
};

const GOALS_LABEL: Record<GoalsStatus, string> = {
  definidos: 'Definidos',
  pendente: 'Pendente',
  'em-conversa': 'Em conversa',
};

const FAMILY_LABEL: Record<FamilyMeetingStatus, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  'nao-agendada': 'Não agendada',
};

function news2Badge(score: number): string {
  if (score >= 7) return 'bg-red-100 text-red-800 border border-red-300';
  if (score >= 5) return 'bg-orange-100 text-orange-800 border border-orange-300';
  if (score >= 3) return 'bg-amber-100 text-amber-800 border border-amber-300';
  return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
}

export default function IcuPage() {
  const [selected, setSelected] = useState<IcuBed | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'all'>('all');
  const [filterMd, setFilterMd] = useState<string>('all');

  const mds = useMemo(() => {
    const set = new Set<string>();
    BEDS.forEach((b) => b.patient && set.add(b.patient.attendingMd));
    return ['all', ...Array.from(set)];
  }, []);

  const filtered = useMemo(() => {
    return BEDS.filter((b) => {
      if (filterSeverity !== 'all' && b.severity !== filterSeverity) return false;
      if (filterMd !== 'all' && b.patient?.attendingMd !== filterMd) return false;
      return true;
    });
  }, [filterSeverity, filterMd]);

  const kpis = useMemo(() => {
    const occupied = BEDS.filter((b) => b.occupied).length;
    const total = BEDS.length;
    const onVent = BEDS.filter((b) => b.ventilation).length;
    const sedated = BEDS.filter((b) => b.sedation).length;
    const criticalAlerts = BEDS.filter((b) => b.severity === 'critico').length;
    const mortalityAvg = Math.round(
      BEDS.filter((b) => b.predictedMortality !== undefined).reduce(
        (acc, b) => acc + (b.predictedMortality || 0),
        0,
      ) / BEDS.filter((b) => b.predictedMortality !== undefined).length,
    );
    const pending = BEDS.reduce((acc, b) => acc + (b.alerts?.length || 0), 0);
    return {
      occupancy: Math.round((occupied / total) * 100),
      occupied,
      total,
      onVent,
      sedated,
      criticalAlerts,
      mortalityAvg,
      pending,
    };
  }, []);

  return (
    <AppShell pageTitle="UTI - Cuidados Intensivos">
      <div className="page-header">
        <h1 className="page-title">UTI Adulto — SmartICU Board</h1>
        <p className="page-subtitle">
          NEWS2 contínuo · Predictive analytics · Goals-of-care (BRIDGE-ICU)
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">
            Ocupação
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{kpis.occupancy}%</div>
          <div className="text-[10px] text-slate-600 mt-0.5">
            {kpis.occupied}/{kpis.total} leitos
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-blue-800 font-semibold">
            Em ventilação
          </div>
          <div className="text-2xl font-bold text-blue-800 mt-1">{kpis.onVent}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">VM invasiva</div>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-indigo-800 font-semibold">
            Sedados
          </div>
          <div className="text-2xl font-bold text-indigo-800 mt-1">{kpis.sedated}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">RASS ≤ -2</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-red-800 font-semibold">
            Alertas críticos
          </div>
          <div className="text-2xl font-bold text-red-700 mt-1">{kpis.criticalAlerts}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">Severidade alta</div>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-orange-800 font-semibold">
            Mort. prevista
          </div>
          <div className="text-2xl font-bold text-orange-700 mt-1">{kpis.mortalityAvg}%</div>
          <div className="text-[10px] text-slate-600 mt-0.5">APACHE II médio</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-amber-800 font-semibold">
            Pendências
          </div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{kpis.pending}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">Ações abertas</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-600 uppercase tracking-wider">Severidade</span>
          <div className="flex gap-1 flex-wrap">
            {(['all', 'critico', 'grave', 'estavel', 'melhorando'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterSeverity(s)}
                className={`text-[11px] px-2 py-1 rounded border ${
                  filterSeverity === s
                    ? 'bg-blue-100 border-blue-400 text-blue-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s === 'all' ? 'Todos' : SEVERITY_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-600 uppercase tracking-wider">Médico</span>
          <select
            value={filterMd}
            onChange={(e) => setFilterMd(e.target.value)}
            className="text-[11px] bg-white border border-slate-300 rounded px-2 py-1 text-slate-800"
          >
            {mds.map((m) => (
              <option key={m} value={m}>
                {m === 'all' ? 'Todos' : m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bed Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filtered.map((bed) => {
          const cfg = SEVERITY_CONFIG[bed.severity];
          if (!bed.occupied) {
            return (
              <div
                key={bed.id}
                className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center"
              >
                <div className="text-[10px] uppercase tracking-wider text-slate-600">{bed.id}</div>
                <div className="text-xs text-slate-600 mt-2">Livre</div>
              </div>
            );
          }
          return (
            <button
              key={bed.id}
              onClick={() => setSelected(bed)}
              className={`text-left rounded-lg border ${cfg.border} p-3 hover:bg-slate-50 transition`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <div className="text-xs font-mono font-bold text-slate-900">{bed.id}</div>
                </div>
                <div className="text-[9px] text-slate-600">Dia {bed.patient?.icuDay}</div>
              </div>
              <div className="text-sm font-semibold text-slate-900 truncate">
                {bed.patient?.name}
              </div>
              <div className="text-[10px] text-slate-600">
                {bed.patient?.age}a · {bed.patient?.mrn}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                {bed.patient?.diagnosis}
              </div>

              {/* NEWS2 + trend */}
              {bed.news2 !== undefined && (
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${news2Badge(bed.news2)}`}
                  >
                    NEWS2 {bed.news2}
                  </span>
                  {bed.news2Trend && (
                    <span className={`text-[11px] font-bold ${TREND_COLOR[bed.news2Trend]}`}>
                      {TREND_ICON[bed.news2Trend]}
                    </span>
                  )}
                </div>
              )}

              {/* Vitals */}
              {bed.vitals && (
                <div className="grid grid-cols-5 gap-1 mt-2 text-[9px] font-mono">
                  <div className="rounded bg-white border border-slate-200 px-1 py-0.5 text-center">
                    <div className="text-slate-500">FC</div>
                    <div className="text-slate-900">{bed.vitals.hr}</div>
                  </div>
                  <div className="rounded bg-white border border-slate-200 px-1 py-0.5 text-center">
                    <div className="text-slate-500">PA</div>
                    <div className="text-slate-900">{bed.vitals.bp}</div>
                  </div>
                  <div className="rounded bg-white border border-slate-200 px-1 py-0.5 text-center">
                    <div className="text-slate-500">FR</div>
                    <div className="text-slate-900">{bed.vitals.rr}</div>
                  </div>
                  <div className="rounded bg-white border border-slate-200 px-1 py-0.5 text-center">
                    <div className="text-slate-500">SpO₂</div>
                    <div className="text-slate-900">{bed.vitals.spo2}</div>
                  </div>
                  <div className="rounded bg-white border border-slate-200 px-1 py-0.5 text-center">
                    <div className="text-slate-500">T°</div>
                    <div className="text-slate-900">{bed.vitals.temp}</div>
                  </div>
                </div>
              )}

              {/* Devices row */}
              <div className="flex flex-wrap gap-1 mt-2">
                {bed.ventilation && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                    VM {bed.ventilation.mode} · FiO₂ {bed.ventilation.fio2}%
                  </span>
                )}
                {bed.vasopressors && bed.vasopressors.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">
                    DVA ×{bed.vasopressors.length}
                  </span>
                )}
                {bed.sedation && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300">
                    RASS {bed.sedation.rass}
                  </span>
                )}
              </div>

              {/* Alerts */}
              {bed.alerts && bed.alerts.length > 0 && (
                <div className="mt-2 text-[9px] text-amber-800 truncate">
                  ⚠ {bed.alerts[0]}
                  {bed.alerts.length > 1 && ` +${bed.alerts.length - 1}`}
                </div>
              )}

              {/* Goals of care bar */}
              {bed.goalsOfCare && (
                <div className="mt-2 flex items-center justify-between text-[9px]">
                  <span className="text-slate-600">GoC:</span>
                  <span
                    className={`font-semibold ${
                      bed.goalsOfCare === 'definidos'
                        ? 'text-emerald-700'
                        : bed.goalsOfCare === 'em-conversa'
                          ? 'text-amber-800'
                          : 'text-red-700'
                    }`}
                  >
                    {GOALS_LABEL[bed.goalsOfCare]}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail modal */}
      {selected && selected.patient && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-slate-600 uppercase tracking-wider font-mono">
                  {selected.id} · Dia {selected.patient.icuDay} de UTI
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{selected.patient.name}</h2>
                <div className="text-sm text-slate-600 mt-0.5">
                  {selected.patient.age}a · {selected.patient.mrn} · {selected.patient.attendingMd}
                </div>
                <div className="text-sm text-slate-800 mt-1">{selected.patient.diagnosis}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-600 hover:text-slate-900 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {selected.news2 !== undefined && (
                <div className="rounded border border-slate-200 bg-slate-50 p-2">
                  <div className="text-[10px] uppercase text-slate-600">NEWS2</div>
                  <div className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    {selected.news2}
                    {selected.news2Trend && (
                      <span className={`text-sm ${TREND_COLOR[selected.news2Trend]}`}>
                        {TREND_ICON[selected.news2Trend]}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {selected.apache2 !== undefined && (
                <div className="rounded border border-slate-200 bg-slate-50 p-2">
                  <div className="text-[10px] uppercase text-slate-600">APACHE II</div>
                  <div className="text-lg font-bold text-slate-900">{selected.apache2}</div>
                </div>
              )}
              {selected.predictedMortality !== undefined && (
                <div className="rounded border border-slate-200 bg-slate-50 p-2">
                  <div className="text-[10px] uppercase text-slate-600">Mort. prevista</div>
                  <div className="text-lg font-bold text-orange-700">
                    {selected.predictedMortality}%
                  </div>
                </div>
              )}
              {selected.sedation && (
                <div className="rounded border border-slate-200 bg-slate-50 p-2">
                  <div className="text-[10px] uppercase text-slate-600">RASS</div>
                  <div className="text-lg font-bold text-indigo-800">{selected.sedation.rass}</div>
                </div>
              )}
            </div>

            {/* Vitals chart (simple sparkline) */}
            {selected.vitalsHistory && selected.vitalsHistory.length > 0 && (
              <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">
                  Tendência Sinais Vitais (últimas 6h)
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(['hr', 'spo2', 'map'] as const).map((metric) => {
                    const values = selected.vitalsHistory!.map((p) => p[metric]);
                    const max = Math.max(...values);
                    const min = Math.min(...values);
                    const range = Math.max(1, max - min);
                    const label =
                      metric === 'hr' ? 'FC (bpm)' : metric === 'spo2' ? 'SpO₂ (%)' : 'PAM';
                    const color =
                      metric === 'hr'
                        ? 'stroke-red-500'
                        : metric === 'spo2'
                          ? 'stroke-blue-500'
                          : 'stroke-emerald-500';
                    return (
                      <div key={metric}>
                        <div className="text-[10px] text-slate-500 mb-1">{label}</div>
                        <svg viewBox="0 0 100 40" className="w-full h-10">
                          <polyline
                            fill="none"
                            className={color}
                            strokeWidth={2}
                            points={values
                              .map((v, i) => {
                                const x = (i / (values.length - 1)) * 100;
                                const y = 38 - ((v - min) / range) * 34;
                                return `${x},${y}`;
                              })
                              .join(' ')}
                          />
                        </svg>
                        <div className="text-[10px] text-slate-600 font-mono flex justify-between">
                          <span>{min}</span>
                          <span>{values[values.length - 1]}</span>
                          <span>{max}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ventilation / DVA / devices */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {selected.ventilation && (
                <div className="rounded border border-blue-200 bg-blue-50 p-3">
                  <div className="text-[10px] uppercase text-blue-800 mb-1">Ventilação</div>
                  <div className="text-xs text-slate-900">
                    Modo: <span className="font-mono">{selected.ventilation.mode}</span>
                  </div>
                  <div className="text-xs text-slate-800">
                    FiO₂ {selected.ventilation.fio2}% · PEEP {selected.ventilation.peep}
                  </div>
                </div>
              )}
              {selected.vasopressors && selected.vasopressors.length > 0 && (
                <div className="rounded border border-red-200 bg-red-50 p-3">
                  <div className="text-[10px] uppercase text-red-800 mb-1">
                    Drogas Vasoativas
                  </div>
                  {selected.vasopressors.map((v) => (
                    <div key={v.name} className="text-xs text-slate-900">
                      {v.name} — <span className="font-mono">{v.dose}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selected.devices && selected.devices.length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">
                  Dispositivos
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.devices.map((d) => (
                    <span
                      key={d}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Alerts */}
            {selected.alerts && selected.alerts.length > 0 && (
              <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-amber-800 mb-1.5">
                  Alertas Ativos
                </div>
                <ul className="text-xs text-amber-800 space-y-0.5">
                  {selected.alerts.map((a) => (
                    <li key={a}>⚠ {a}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Medications */}
            {selected.medications && selected.medications.length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">
                  Medicações Ativas
                </div>
                <div className="space-y-1">
                  {selected.medications.map((m) => (
                    <div
                      key={m.name}
                      className="flex items-center justify-between text-xs px-3 py-1.5 rounded bg-slate-50 border border-slate-200"
                    >
                      <span className="text-slate-800">{m.name}</span>
                      <span className="text-slate-600 font-mono">
                        {m.schedule} · {m.lastGiven}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Procedures */}
            {selected.procedures && selected.procedures.length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">
                  Procedimentos Recentes
                </div>
                <div className="space-y-1">
                  {selected.procedures.map((p) => (
                    <div
                      key={p.time + p.description}
                      className="text-xs text-slate-700 flex gap-3"
                    >
                      <span className="font-mono text-slate-500 w-12">{p.time}</span>
                      <span>{p.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Goals of care + family */}
            <div className="grid grid-cols-2 gap-3">
              {selected.goalsOfCare && (
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] uppercase text-slate-600 mb-1">
                    Goals of Care (BRIDGE-ICU)
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {GOALS_LABEL[selected.goalsOfCare]}
                  </div>
                </div>
              )}
              {selected.familyMeeting && (
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] uppercase text-slate-600 mb-1">Reunião familiar</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {FAMILY_LABEL[selected.familyMeeting]}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
