'use client';

import { useMemo, useState } from 'react';
import {
  AMBULANCES,
  type AmbulanceStatus,
  type RiskLevel,
} from '../../lib/fixtures/ems';
import { AppShell } from '../components/app-shell';

const STATUS_CONFIG: Record<
  AmbulanceStatus,
  { label: string; badge: string; dot: string; ring: string }
> = {
  despachada: {
    label: 'Despachada',
    badge: 'bg-blue-100 text-blue-800 border border-blue-300',
    dot: 'bg-blue-500',
    ring: 'ring-blue-300',
  },
  'em-rota-coleta': {
    label: 'Em rota à cena',
    badge: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-300',
  },
  'chegando-hospital': {
    label: 'Chegando',
    badge: 'bg-amber-100 text-amber-800 border border-amber-300',
    dot: 'bg-amber-500 animate-pulse',
    ring: 'ring-amber-300',
  },
  'no-hospital': {
    label: 'No hospital',
    badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-300',
  },
  retornando: {
    label: 'Retornando',
    badge: 'bg-slate-100 text-slate-700 border border-slate-300',
    dot: 'bg-slate-400',
    ring: 'ring-slate-300',
  },
  disponivel: {
    label: 'Disponível',
    badge: 'bg-green-100 text-green-800 border border-green-300',
    dot: 'bg-green-500',
    ring: 'ring-green-300',
  },
};

const RISK_CONFIG: Record<RiskLevel, { label: string; className: string }> = {
  vermelho: { label: 'VERMELHO', className: 'bg-red-700 text-white' },
  amarelo: { label: 'AMARELO', className: 'bg-amber-500 text-black' },
  verde: { label: 'VERDE', className: 'bg-emerald-600 text-white' },
  azul: { label: 'AZUL', className: 'bg-blue-600 text-white' },
};

export default function EmsPage() {
  const [expandedUnit, setExpandedUnit] = useState<string | null>('USA-01');
  const [reanimacaoActive, setReanimacaoActive] = useState<string[]>([]);
  const [tbrActive, setTbrActive] = useState<string[]>([]);

  const kpis = useMemo(() => {
    const active = AMBULANCES.filter((a) => a.status !== 'disponivel').length;
    const inboundUs = AMBULANCES.filter(
      (a) =>
        (a.status === 'chegando-hospital' || a.status === 'no-hospital') &&
        a.destination.toLowerCase().includes('velya'),
    ).length;
    const arrivingSoon = AMBULANCES.filter(
      (a) => a.status === 'chegando-hospital' && a.etaMin !== null && a.etaMin <= 10,
    ).length;
    const criticalEnRoute = AMBULANCES.filter(
      (a) =>
        (a.status === 'chegando-hospital' || a.status === 'em-rota-coleta') &&
        a.risk === 'vermelho',
    ).length;
    return { active, inboundUs, arrivingSoon, criticalEnRoute };
  }, []);

  function togglePreparo(unit: string) {
    setReanimacaoActive((prev) =>
      prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit],
    );
  }
  function toggleTbr(unit: string) {
    setTbrActive((prev) => (prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit]));
  }

  const preNotifications = AMBULANCES.filter(
    (a) => a.preNotificationSent && a.status === 'chegando-hospital',
  );

  return (
    <AppShell pageTitle="Central de Ambulâncias">
      <div className="page-header">
        <h1 className="page-title">Central de Ambulâncias / EMS</h1>
        <p className="page-subtitle">
          Tracking em tempo real · Team-Based Reporting (TBR) · Pré-notificação ePCR
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold">
            Ativas
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{kpis.active}</div>
          <div className="text-xs text-slate-600 mt-1">de {AMBULANCES.length} unidades</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-amber-800 font-semibold">
            Para nós
          </div>
          <div className="text-3xl font-bold text-amber-800 mt-1">{kpis.inboundUs}</div>
          <div className="text-xs text-slate-600 mt-1">Em rota Velya HQ</div>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-orange-800 font-semibold">
            Próx. 10 min
          </div>
          <div className="text-3xl font-bold text-orange-700 mt-1">{kpis.arrivingSoon}</div>
          <div className="text-xs text-slate-600 mt-1">Chegando</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-red-800 font-semibold">
            Críticos a caminho
          </div>
          <div className="text-3xl font-bold text-red-700 mt-1">{kpis.criticalEnRoute}</div>
          <div className="text-xs text-slate-600 mt-1">Prioridade vermelha</div>
        </div>
      </div>

      {/* Map + Pre-notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-semibold text-slate-800 mb-3">Mapa Operacional</div>
          <div
            className="relative rounded-md border border-slate-200 overflow-hidden"
            style={{
              height: '320px',
              background:
                'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.08), transparent 60%), linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)',
            }}
          >
            {/* Grid lines */}
            {[...Array(10)].map((_, i) => (
              <div
                key={`h-${i}`}
                className="absolute left-0 right-0 border-t border-slate-200"
                style={{ top: `${i * 10}%` }}
              />
            ))}
            {[...Array(10)].map((_, i) => (
              <div
                key={`v-${i}`}
                className="absolute top-0 bottom-0 border-l border-slate-200"
                style={{ left: `${i * 10}%` }}
              />
            ))}
            {/* Hospital marker */}
            <div
              className="absolute"
              style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}
            >
              <div className="relative">
                <div className="absolute -inset-4 rounded-full bg-emerald-400/30 animate-pulse" />
                <div className="relative w-10 h-10 rounded-md bg-emerald-600 border-2 border-emerald-300 flex items-center justify-center text-lg">
                  {'\uD83C\uDFE5'}
                </div>
                <div className="absolute top-11 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-emerald-800 whitespace-nowrap">
                  Velya HQ
                </div>
              </div>
            </div>
            {/* Ambulance markers */}
            {AMBULANCES.map((a) => {
              const cfg = STATUS_CONFIG[a.status];
              return (
                <button
                  key={a.unit}
                  onClick={() => setExpandedUnit(a.unit)}
                  className="absolute group"
                  style={{
                    left: `${a.mapCoords.x}%`,
                    top: `${a.mapCoords.y}%`,
                    transform: 'translate(-50%,-50%)',
                  }}
                >
                  <div
                    className={`w-4 h-4 rounded-full ${cfg.dot} ring-4 ${cfg.ring} shadow`}
                  />
                  <div className="absolute top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-slate-900 whitespace-nowrap bg-white/90 border border-slate-200 px-1 py-px rounded">
                    {a.unit}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-[10px]">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className="text-slate-600">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pre-notification panel */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <div className="text-sm font-semibold text-amber-800">Pré-notificações ePCR</div>
          </div>
          {preNotifications.length === 0 && (
            <div className="text-xs text-slate-600">Nenhuma pré-notificação ativa.</div>
          )}
          <div className="flex flex-col gap-3">
            {preNotifications.map((a) => (
              <div
                key={a.unit}
                className="rounded-md border border-amber-200 bg-white p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-amber-800">{a.unit}</div>
                  <div className="text-[10px] text-amber-800">ETA {a.etaMin} min</div>
                </div>
                {a.patient && (
                  <>
                    <div className="text-[11px] text-slate-800 mt-1">
                      {a.patient.age}a {a.patient.sex} · {a.patient.chiefComplaint}
                    </div>
                    {a.patient.vitals && (
                      <div className="text-[10px] text-slate-600 mt-1 font-mono">
                        PA {a.patient.vitals.bp} · FC {a.patient.vitals.hr} · SpO₂{' '}
                        {a.patient.vitals.spo2}%
                      </div>
                    )}
                  </>
                )}
                {a.ePcrNotes && (
                  <div className="text-[10px] text-slate-600 mt-2 italic">"{a.ePcrNotes}"</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ambulance list */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-800 mb-3">Unidades</div>
        <div className="flex flex-col gap-2">
          {AMBULANCES.map((a) => {
            const cfg = STATUS_CONFIG[a.status];
            const expanded = expandedUnit === a.unit;
            const reanimado = reanimacaoActive.includes(a.unit);
            const tbr = tbrActive.includes(a.unit);
            return (
              <div
                key={a.unit}
                className="rounded-lg border border-slate-200 bg-white overflow-hidden"
              >
                <button
                  onClick={() => setExpandedUnit(expanded ? null : a.unit)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left"
                >
                  <div className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-slate-900">{a.unit}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                        {a.type}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      {a.risk && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${RISK_CONFIG[a.risk].className}`}
                        >
                          {RISK_CONFIG[a.risk].label}
                        </span>
                      )}
                      {a.preNotificationSent && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                          pré-notif ✓
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {a.origin} → {a.destination}
                      {a.patient && ` · ${a.patient.age}${a.patient.sex} · ${a.patient.chiefComplaint}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {a.etaMin !== null && a.status !== 'disponivel' && (
                      <div className="text-lg font-bold text-slate-900 leading-none">
                        {a.etaMin}
                        <span className="text-[10px] text-slate-600 ml-0.5">min</span>
                      </div>
                    )}
                    <div className="text-[9px] text-slate-600">
                      desde {a.dispatchedAt} ({a.minutesSinceDispatch}min)
                    </div>
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-slate-200 p-4 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1">
                          Equipe
                        </div>
                        <div className="text-xs text-slate-800 space-y-0.5">
                          {a.crew.medico && <div>👨‍⚕️ {a.crew.medico}</div>}
                          <div>💉 {a.crew.enfermeiro}</div>
                          <div>🚐 {a.crew.condutor}</div>
                        </div>
                        {a.patient && (
                          <>
                            <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1 mt-3">
                              Paciente
                            </div>
                            <div className="text-xs text-slate-800">
                              {a.patient.age}a {a.patient.sex === 'M' ? 'masc' : 'fem'}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {a.patient.chiefComplaint}
                            </div>
                            {a.patient.vitals && (
                              <div className="mt-2 grid grid-cols-4 gap-1 text-[10px]">
                                <div className="rounded bg-white border border-slate-200 px-1.5 py-1">
                                  <div className="text-slate-500">PA</div>
                                  <div className="text-slate-900 font-mono">
                                    {a.patient.vitals.bp}
                                  </div>
                                </div>
                                <div className="rounded bg-white border border-slate-200 px-1.5 py-1">
                                  <div className="text-slate-500">FC</div>
                                  <div className="text-slate-900 font-mono">
                                    {a.patient.vitals.hr}
                                  </div>
                                </div>
                                <div className="rounded bg-white border border-slate-200 px-1.5 py-1">
                                  <div className="text-slate-500">SpO₂</div>
                                  <div className="text-slate-900 font-mono">
                                    {a.patient.vitals.spo2}
                                  </div>
                                </div>
                                {a.patient.vitals.gcs !== undefined && (
                                  <div className="rounded bg-white border border-slate-200 px-1.5 py-1">
                                    <div className="text-slate-500">GCS</div>
                                    <div className="text-slate-900 font-mono">
                                      {a.patient.vitals.gcs}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                        {a.ePcrNotes && (
                          <div className="mt-3 p-2 rounded bg-blue-50 border border-blue-200 text-[10px] text-blue-900 italic">
                            ePCR: {a.ePcrNotes}
                          </div>
                        )}
                      </div>

                      {/* Timeline + actions */}
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">
                          Linha do Tempo
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {a.timeline.map((ev) => (
                            <div key={ev.key} className="flex items-center gap-2">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  ev.time ? 'bg-emerald-500' : 'bg-slate-300'
                                }`}
                              />
                              <div className="text-[11px] text-slate-700 flex-1">{ev.label}</div>
                              <div className="text-[10px] font-mono text-slate-500">
                                {ev.time || '—'}
                              </div>
                            </div>
                          ))}
                        </div>

                        {a.status === 'chegando-hospital' && (
                          <div className="flex flex-col gap-2 mt-4">
                            <button
                              onClick={() => togglePreparo(a.unit)}
                              className={`text-xs font-semibold rounded-md px-3 py-2 border transition ${
                                reanimado
                                  ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                                  : 'bg-red-50 border-red-300 text-red-800 hover:bg-red-100'
                              }`}
                            >
                              {reanimado
                                ? '✓ Sala de Reanimação Preparada'
                                : '🚨 Preparar Sala de Reanimação'}
                            </button>
                            <button
                              onClick={() => toggleTbr(a.unit)}
                              className={`text-xs font-semibold rounded-md px-3 py-2 border transition ${
                                tbr
                                  ? 'bg-blue-100 border-blue-400 text-blue-800'
                                  : 'bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100'
                              }`}
                            >
                              {tbr ? '✓ Equipe TBR Acionada' : '👥 Acionar Equipe TBR'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
