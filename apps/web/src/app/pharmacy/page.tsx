'use client';

import { useMemo, useState } from 'react';
import {
  PRESCRIPTIONS,
  type MedStatus,
  type Prescription,
  type Priority,
} from '../../lib/fixtures/pharmacy';
import { AppShell } from '../components/app-shell';

const STATUS_CONFIG: Record<
  MedStatus,
  { label: string; icon: string; badge: string; row: string }
> = {
  prescrita: {
    label: 'Prescrita',
    icon: '📝',
    badge: 'bg-slate-100 text-slate-700 border border-slate-300',
    row: 'border-l-4 border-l-slate-400',
  },
  'em-validacao': {
    label: 'Em validação',
    icon: '👁️',
    badge: 'bg-purple-100 text-purple-800 border border-purple-300',
    row: 'border-l-4 border-l-purple-400',
  },
  validada: {
    label: 'Validada',
    icon: '✅',
    badge: 'bg-teal-100 text-teal-800 border border-teal-300',
    row: 'border-l-4 border-l-teal-400',
  },
  'em-dispensacao': {
    label: 'Em dispensação',
    icon: '📦',
    badge: 'bg-cyan-100 text-cyan-800 border border-cyan-300',
    row: 'border-l-4 border-l-cyan-400',
  },
  'em-preparo': {
    label: 'Em preparo',
    icon: '🔄',
    badge: 'bg-blue-100 text-blue-800 border border-blue-300',
    row: 'border-l-4 border-l-blue-400',
  },
  'em-transporte': {
    label: 'Em transporte',
    icon: '🚚',
    badge: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
    row: 'border-l-4 border-l-indigo-400',
  },
  'aguardando-admin': {
    label: 'Aguardando admin.',
    icon: '💉',
    badge: 'bg-amber-100 text-amber-800 border border-amber-300',
    row: 'border-l-4 border-l-amber-500',
  },
  administrada: {
    label: 'Administrada',
    icon: '✔️',
    badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    row: 'border-l-4 border-l-emerald-400',
  },
  atrasada: {
    label: 'Atrasada',
    icon: '⚠️',
    badge: 'bg-red-100 text-red-800 border border-red-300',
    row: 'border-l-4 border-l-red-500',
  },
  'nao-administrada': {
    label: 'Não administrada',
    icon: '❌',
    badge: 'bg-red-50 text-red-700 border border-red-300',
    row: 'border-l-4 border-l-red-400',
  },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  critica: { label: 'CRÍTICA', className: 'bg-red-700 text-white' },
  alta: { label: 'ALTA', className: 'bg-amber-500 text-black' },
  normal: { label: 'NORMAL', className: 'bg-slate-500 text-white' },
};

const NEXT_ACTION: Record<MedStatus, string | null> = {
  prescrita: 'Encaminhar p/ validação',
  'em-validacao': 'Concluir validação',
  validada: 'Iniciar preparo',
  'em-dispensacao': 'Confirmar dispensação',
  'em-preparo': 'Enviar ao setor',
  'em-transporte': 'Receber no setor',
  'aguardando-admin': 'Administrar + checagem dupla',
  administrada: null,
  atrasada: 'Escalar / administrar agora',
  'nao-administrada': 'Documentar motivo',
};

const WARDS = ['all', 'UTI', 'Clinica', 'Cirurgica', 'Pediatria', 'Emergencia'] as const;
const STATUS_FILTERS: (MedStatus | 'all')[] = [
  'all',
  'prescrita',
  'em-validacao',
  'validada',
  'em-preparo',
  'em-transporte',
  'aguardando-admin',
  'administrada',
  'atrasada',
  'nao-administrada',
];

export default function PharmacyPage() {
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [statusFilter, setStatusFilter] = useState<MedStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [wardFilter, setWardFilter] = useState<(typeof WARDS)[number]>('all');

  const kpis = useMemo(() => {
    const total = PRESCRIPTIONS.length;
    const inValidation = PRESCRIPTIONS.filter((p) => p.status === 'em-validacao').length;
    const delayed = PRESCRIPTIONS.filter((p) => p.status === 'atrasada').length;
    const criticalPending = PRESCRIPTIONS.filter(
      (p) =>
        p.priority === 'critica' &&
        p.status !== 'administrada' &&
        p.status !== 'nao-administrada',
    ).length;
    const administered = PRESCRIPTIONS.filter((p) => p.status === 'administrada').length;
    const doubleCheckRate = Math.round((administered / Math.max(1, total - inValidation)) * 100);
    return { total, inValidation, delayed, criticalPending, doubleCheckRate };
  }, []);

  const filtered = useMemo(() => {
    return PRESCRIPTIONS.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
      if (wardFilter !== 'all' && p.ward !== wardFilter) return false;
      return true;
    });
  }, [statusFilter, priorityFilter, wardFilter]);

  return (
    <AppShell pageTitle="Farmácia - Closed Loop">
      <div className="page-header">
        <h1 className="page-title">Farmácia — Closed-Loop</h1>
        <p className="page-subtitle">
          Gestão de medicação do ciclo fechado · Prescrição → validação → preparo → administração
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold">
            Total ativas
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{kpis.total}</div>
          <div className="text-xs text-slate-600 mt-1">prescrições</div>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-purple-800 font-semibold">
            Em validação
          </div>
          <div className="text-3xl font-bold text-purple-800 mt-1">{kpis.inValidation}</div>
          <div className="text-xs text-slate-600 mt-1">Farmacêutico</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-red-800 font-semibold">
            Atrasadas
          </div>
          <div className="text-3xl font-bold text-red-700 mt-1">{kpis.delayed}</div>
          <div className="text-xs text-slate-600 mt-1">Escalar agora</div>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-orange-800 font-semibold">
            Críticas pend.
          </div>
          <div className="text-3xl font-bold text-orange-700 mt-1">{kpis.criticalPending}</div>
          <div className="text-xs text-slate-600 mt-1">Prioridade alta</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-emerald-800 font-semibold">
            Checagem dupla
          </div>
          <div className="text-3xl font-bold text-emerald-700 mt-1">{kpis.doubleCheckRate}%</div>
          <div className="text-xs text-slate-600 mt-1">Taxa hoje</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 mb-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-600 uppercase tracking-wider shrink-0">
              Status
            </span>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-[10px] px-2 py-1 rounded border ${
                  statusFilter === s
                    ? 'bg-blue-100 border-blue-400 text-blue-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s === 'all' ? 'Todos' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-600 uppercase tracking-wider shrink-0">
              Prioridade
            </span>
            {(['all', 'critica', 'alta', 'normal'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`text-[10px] px-2 py-1 rounded border ${
                  priorityFilter === p
                    ? 'bg-blue-100 border-blue-400 text-blue-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p === 'all' ? 'Todas' : PRIORITY_CONFIG[p].label}
              </button>
            ))}
            <span className="text-[11px] text-slate-600 uppercase tracking-wider shrink-0 ml-4">
              Ala
            </span>
            {WARDS.map((w) => (
              <button
                key={w}
                onClick={() => setWardFilter(w)}
                className={`text-[10px] px-2 py-1 rounded border ${
                  wardFilter === w
                    ? 'bg-blue-100 border-blue-400 text-blue-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {w === 'all' ? 'Todas' : w}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prescription list */}
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="text-sm font-semibold text-slate-800 mb-3">
          Prescrições ({filtered.length})
        </div>
        <div className="flex flex-col gap-2">
          {filtered.map((p) => {
            const cfg = STATUS_CONFIG[p.status];
            const pcfg = PRIORITY_CONFIG[p.priority];
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`text-left rounded-md bg-white hover:bg-slate-50 border border-slate-200 transition p-3 ${cfg.row}`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-xl shrink-0">{cfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{p.drug}</span>
                      <span className="text-xs text-slate-600">
                        {p.dose} · {p.route} · {p.frequency}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${pcfg.className}`}>
                        {pcfg.label}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {p.patient} · {p.bed} · {p.mrn} · {p.ward}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      Dr(a) {p.prescriber}
                      {p.pharmacist && ` · Farm. ${p.pharmacist}`}
                      {p.nurse && ` · Enf. ${p.nurse}`}
                    </div>
                    {p.alerts.length > 0 && (
                      <div className="text-[10px] text-amber-800 mt-1">
                        ⚠ {p.alerts.join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-slate-600 uppercase">Próximo</div>
                    <div className="text-xs font-mono text-slate-900">{p.nextDose}</div>
                    {NEXT_ACTION[p.status] && (
                      <div className="text-[10px] text-blue-700 mt-1.5 font-semibold">
                        → {NEXT_ACTION[p.status]}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-slate-600 uppercase tracking-wider font-mono">
                  {selected.id} · {selected.ward} · {selected.bed}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{selected.drug}</h2>
                <div className="text-sm text-slate-600 mt-0.5">
                  {selected.dose} · {selected.route} · {selected.frequency}
                </div>
                <div className="text-sm text-slate-800 mt-1">
                  {selected.patient} · {selected.mrn}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-600 hover:text-slate-900 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Actors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="text-[10px] uppercase text-slate-600">Prescritor</div>
                <div className="text-xs text-slate-900 font-semibold">{selected.prescriber}</div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="text-[10px] uppercase text-slate-600">Farmacêutico</div>
                <div className="text-xs text-slate-900 font-semibold">
                  {selected.pharmacist || '—'}
                </div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="text-[10px] uppercase text-slate-600">Enfermeiro(a)</div>
                <div className="text-xs text-slate-900 font-semibold">{selected.nurse || '—'}</div>
              </div>
            </div>

            {/* Alerts */}
            {selected.alerts.length > 0 && (
              <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-amber-800 mb-1">
                  Alertas clínicos
                </div>
                <ul className="text-xs text-amber-800 space-y-0.5">
                  {selected.alerts.map((a) => (
                    <li key={a}>⚠ {a}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reason if not administered */}
            {selected.reason && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-red-800 mb-1">
                  Motivo — não administrada
                </div>
                <div className="text-xs text-red-800">{selected.reason}</div>
              </div>
            )}

            {/* Timeline */}
            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">
                Linha do Tempo do Closed Loop
              </div>
              <div className="flex flex-col gap-2">
                {selected.timeline.map((step) => (
                  <div
                    key={step.key}
                    className="flex items-center gap-3 rounded px-2 py-1.5 bg-slate-50 border border-slate-200"
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${
                        step.time ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                    <div className="text-xs text-slate-800 flex-1">{step.label}</div>
                    <div className="text-[10px] font-mono text-slate-500">{step.time || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next action */}
            {NEXT_ACTION[selected.status] && (
              <button
                className="w-full rounded-md bg-blue-100 border border-blue-400 text-blue-900 text-sm font-semibold py-2.5 hover:bg-blue-200 transition"
                onClick={() => setSelected(null)}
              >
                → {NEXT_ACTION[selected.status]}
              </button>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
