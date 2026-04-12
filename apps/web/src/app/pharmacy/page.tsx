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
    icon: '',
    badge: 'bg-neutral-100 text-neutral-700 border border-neutral-300',
    row: 'border-l-4 border-l-neutral-300',
  },
  'em-validacao': {
    label: 'Em validacao',
    icon: '',
    badge: 'bg-neutral-100 text-neutral-700 border border-neutral-300',
    row: 'border-l-4 border-l-neutral-300',
  },
  validada: {
    label: 'Validada',
    icon: '',
    badge: 'bg-neutral-100 text-neutral-700 border border-neutral-300',
    row: 'border-l-4 border-l-neutral-300',
  },
  'em-dispensacao': {
    label: 'Em dispensacao',
    icon: '',
    badge: 'bg-neutral-100 text-neutral-700 border border-neutral-300',
    row: 'border-l-4 border-l-neutral-300',
  },
  'em-preparo': {
    label: 'Em preparo',
    icon: '',
    badge: 'bg-neutral-100 text-neutral-700 border border-neutral-300',
    row: 'border-l-4 border-l-neutral-300',
  },
  'em-transporte': {
    label: 'Em transporte',
    icon: '',
    badge: 'bg-neutral-100 text-neutral-700 border border-neutral-300',
    row: 'border-l-4 border-l-neutral-300',
  },
  'aguardando-admin': {
    label: 'Aguardando admin.',
    icon: '',
    badge: 'bg-neutral-100 text-neutral-700 border border-neutral-300',
    row: 'border-l-4 border-l-neutral-300',
  },
  administrada: {
    label: 'Administrada',
    icon: '',
    badge: 'bg-neutral-100 text-neutral-700 border border-neutral-300',
    row: 'border-l-4 border-l-neutral-300',
  },
  atrasada: {
    label: 'Atrasada',
    icon: '',
    badge: 'bg-neutral-100 text-neutral-900 border border-neutral-300',
    row: 'border-l-4 border-l-neutral-300',
  },
  'nao-administrada': {
    label: 'Nao administrada',
    icon: '',
    badge: 'bg-neutral-50 text-neutral-700 border border-neutral-300',
    row: 'border-l-4 border-l-neutral-300',
  },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  critica: { label: 'CRITICA', className: 'bg-neutral-900 text-white' },
  alta: { label: 'ALTA', className: 'bg-neutral-700 text-white' },
  normal: { label: 'NORMAL', className: 'bg-neutral-500 text-white' },
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
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">
            Total ativas
          </div>
          <div className="text-3xl font-bold text-neutral-900 mt-1">{kpis.total}</div>
          <div className="text-xs text-neutral-500 mt-1">prescricoes</div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-neutral-700 font-semibold">
            Em validacao
          </div>
          <div className="text-3xl font-bold text-neutral-900 mt-1">{kpis.inValidation}</div>
          <div className="text-xs text-neutral-500 mt-1">Farmaceutico</div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-neutral-700 font-semibold">
            Atrasadas
          </div>
          <div className="text-3xl font-bold text-neutral-900 mt-1">{kpis.delayed}</div>
          <div className="text-xs text-neutral-500 mt-1">Escalar agora</div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-neutral-700 font-semibold">
            Criticas pend.
          </div>
          <div className="text-3xl font-bold text-neutral-900 mt-1">{kpis.criticalPending}</div>
          <div className="text-xs text-neutral-500 mt-1">Prioridade alta</div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-neutral-700 font-semibold">
            Checagem dupla
          </div>
          <div className="text-3xl font-bold text-neutral-900 mt-1">{kpis.doubleCheckRate}%</div>
          <div className="text-xs text-neutral-500 mt-1">Taxa hoje</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-neutral-200 bg-white p-3 mb-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-neutral-500 uppercase tracking-wider shrink-0">
              Status
            </span>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-[10px] px-2 py-1 rounded border ${
                  statusFilter === s
                    ? 'bg-neutral-100 border-neutral-400 text-neutral-900'
                    : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {s === 'all' ? 'Todos' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-neutral-500 uppercase tracking-wider shrink-0">
              Prioridade
            </span>
            {(['all', 'critica', 'alta', 'normal'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`text-[10px] px-2 py-1 rounded border ${
                  priorityFilter === p
                    ? 'bg-neutral-100 border-neutral-400 text-neutral-900'
                    : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {p === 'all' ? 'Todas' : PRIORITY_CONFIG[p].label}
              </button>
            ))}
            <span className="text-[11px] text-neutral-500 uppercase tracking-wider shrink-0 ml-4">
              Ala
            </span>
            {WARDS.map((w) => (
              <button
                key={w}
                onClick={() => setWardFilter(w)}
                className={`text-[10px] px-2 py-1 rounded border ${
                  wardFilter === w
                    ? 'bg-neutral-100 border-neutral-400 text-neutral-900'
                    : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {w === 'all' ? 'Todas' : w}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prescription list */}
      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <div className="text-sm font-semibold text-neutral-900 mb-3">
          Prescricoes ({filtered.length})
        </div>
        <div className="flex flex-col gap-2">
          {filtered.map((p) => {
            const cfg = STATUS_CONFIG[p.status];
            const pcfg = PRIORITY_CONFIG[p.priority];
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`text-left rounded-md bg-white hover:bg-neutral-50 border border-neutral-200 transition p-3 ${cfg.row}`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-xl shrink-0">{cfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-neutral-900">{p.drug}</span>
                      <span className="text-xs text-neutral-500">
                        {p.dose} · {p.route} · {p.frequency}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${pcfg.className}`}>
                        {pcfg.label}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {p.patient} · {p.bed} · {p.mrn} · {p.ward}
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      Dr(a) {p.prescriber}
                      {p.pharmacist && ` · Farm. ${p.pharmacist}`}
                      {p.nurse && ` · Enf. ${p.nurse}`}
                    </div>
                    {p.alerts.length > 0 && (
                      <div className="text-[10px] text-neutral-700 mt-1">
                        {p.alerts.join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-neutral-500 uppercase">Proximo</div>
                    <div className="text-xs font-mono text-neutral-900">{p.nextDose}</div>
                    {NEXT_ACTION[p.status] && (
                      <div className="text-[10px] text-neutral-700 mt-1.5 font-semibold">
                        {NEXT_ACTION[p.status]}
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
            className="bg-white border border-neutral-200 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-neutral-500 uppercase tracking-wider font-mono">
                  {selected.id} · {selected.ward} · {selected.bed}
                </div>
                <h2 className="text-xl font-bold text-neutral-900 mt-1">{selected.drug}</h2>
                <div className="text-sm text-neutral-500 mt-0.5">
                  {selected.dose} · {selected.route} · {selected.frequency}
                </div>
                <div className="text-sm text-neutral-900 mt-1">
                  {selected.patient} · {selected.mrn}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-neutral-500 hover:text-neutral-900 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Actors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
              <div className="rounded border border-neutral-200 bg-neutral-50 p-2">
                <div className="text-[10px] uppercase text-neutral-500">Prescritor</div>
                <div className="text-xs text-neutral-900 font-semibold">{selected.prescriber}</div>
              </div>
              <div className="rounded border border-neutral-200 bg-neutral-50 p-2">
                <div className="text-[10px] uppercase text-neutral-500">Farmaceutico</div>
                <div className="text-xs text-neutral-900 font-semibold">
                  {selected.pharmacist || '--'}
                </div>
              </div>
              <div className="rounded border border-neutral-200 bg-neutral-50 p-2">
                <div className="text-[10px] uppercase text-neutral-500">Enfermeiro(a)</div>
                <div className="text-xs text-neutral-900 font-semibold">{selected.nurse || '--'}</div>
              </div>
            </div>

            {/* Alerts */}
            {selected.alerts.length > 0 && (
              <div className="mb-4 rounded border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-700 mb-1">
                  Alertas clinicos
                </div>
                <ul className="text-xs text-neutral-700 space-y-0.5">
                  {selected.alerts.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reason if not administered */}
            {selected.reason && (
              <div className="mb-4 rounded border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-700 mb-1">
                  Motivo -- nao administrada
                </div>
                <div className="text-xs text-neutral-700">{selected.reason}</div>
              </div>
            )}

            {/* Timeline */}
            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
                Linha do Tempo do Closed Loop
              </div>
              <div className="flex flex-col gap-2">
                {selected.timeline.map((step) => (
                  <div
                    key={step.key}
                    className="flex items-center gap-3 rounded px-2 py-1.5 bg-neutral-50 border border-neutral-200"
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${
                        step.time ? 'bg-neutral-900' : 'bg-neutral-300'
                      }`}
                    />
                    <div className="text-xs text-neutral-900 flex-1">{step.label}</div>
                    <div className="text-[10px] font-mono text-neutral-500">{step.time || '--'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next action */}
            {NEXT_ACTION[selected.status] && (
              <button
                className="w-full rounded-md bg-neutral-900 border border-neutral-900 text-white text-sm font-semibold py-2.5 hover:bg-neutral-700 transition"
                onClick={() => setSelected(null)}
              >
                {NEXT_ACTION[selected.status]}
              </button>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
