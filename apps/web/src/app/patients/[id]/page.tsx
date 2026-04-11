'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { pushRecentPatient } from '../../components/recent-patients';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { FavoriteButton } from '../../components/favorite-button';
import { RelatedItems } from '../../components/related-items';
import {
  COCKPITS,
  type EventCategory,
  type TimelineEvent,
} from '../../../lib/fixtures/patient-cockpits';

// ===========================================================================
// Category config
// ===========================================================================

const CATEGORY_CONFIG: Record<
  EventCategory,
  { icon: string; label: string; colorBg: string; colorText: string; colorBorder: string }
> = {
  emergencia: { icon: '\uD83D\uDE91', label: 'Emergencia', colorBg: 'bg-red-950/40', colorText: 'text-red-800', colorBorder: 'border-red-700' },
  admissao: { icon: '\uD83C\uDFE5', label: 'Admissao', colorBg: 'bg-blue-950/40', colorText: 'text-blue-800', colorBorder: 'border-blue-700' },
  avaliacao: { icon: '\uD83D\uDC68\u200D\u2695\uFE0F', label: 'Avaliacao', colorBg: 'bg-green-950/40', colorText: 'text-green-800', colorBorder: 'border-green-700' },
  medicacao: { icon: '\uD83D\uDC8A', label: 'Medicacao', colorBg: 'bg-purple-950/40', colorText: 'text-purple-800', colorBorder: 'border-purple-700' },
  exame: { icon: '\uD83D\uDD2C', label: 'Exame', colorBg: 'bg-orange-950/40', colorText: 'text-orange-800', colorBorder: 'border-orange-700' },
  evolucao: { icon: '\uD83D\uDCCB', label: 'Evolucao', colorBg: 'bg-slate-50', colorText: 'text-slate-700', colorBorder: 'border-slate-300' },
  handoff: { icon: '\uD83E\uDD1D', label: 'Handoff', colorBg: 'bg-yellow-950/40', colorText: 'text-yellow-800', colorBorder: 'border-yellow-700' },
  alerta: { icon: '\u26A0\uFE0F', label: 'Alerta', colorBg: 'bg-red-950/40', colorText: 'text-red-800', colorBorder: 'border-red-700' },
  chamada: { icon: '\uD83D\uDCDE', label: 'Chamada', colorBg: 'bg-cyan-950/40', colorText: 'text-cyan-800', colorBorder: 'border-cyan-700' },
  alta: { icon: '\uD83C\uDFE0', label: 'Alta', colorBg: 'bg-emerald-950/40', colorText: 'text-emerald-800', colorBorder: 'border-emerald-700' },
};

const ALL_CATEGORIES: EventCategory[] = [
  'emergencia', 'admissao', 'avaliacao', 'medicacao', 'exame',
  'evolucao', 'handoff', 'alerta', 'chamada', 'alta',
];

// ===========================================================================
// NEWS2 Score Color
// ===========================================================================

function news2Color(score: number): string {
  if (score >= 7) return 'bg-red-700 text-white';
  if (score >= 5) return 'bg-orange-700 text-white';
  if (score >= 3) return 'bg-amber-400 text-slate-900';
  return 'bg-green-50 text-white';
}

function news2Label(score: number): string {
  if (score >= 7) return 'ALTO RISCO';
  if (score >= 5) return 'MEDIO-ALTO';
  if (score >= 3) return 'MEDIO';
  return 'BAIXO';
}

// ===========================================================================
// Status / Risk helpers
// ===========================================================================

const STATUS_LABELS: Record<string, string> = { 'on-track': 'No Prazo', 'at-risk': 'Em Risco', blocked: 'Bloqueado', discharged: 'Alta' };
const STATUS_COLORS: Record<string, string> = {
  'on-track': 'bg-green-950/50 text-green-800 border border-green-700/60',
  'at-risk': 'bg-amber-950/50 text-amber-800 border border-amber-700/60',
  blocked: 'bg-red-950/50 text-red-800 border border-red-700/60',
  discharged: 'bg-slate-50 text-slate-700 border border-slate-300',
};
const RISK_LABELS: Record<string, string> = { high: 'Alto', medium: 'Medio', low: 'Baixo' };
const RISK_COLORS: Record<string, string> = {
  high: 'bg-red-950/50 text-red-800 border border-red-700/60',
  medium: 'bg-amber-950/50 text-amber-800 border border-amber-700/60',
  low: 'bg-green-950/50 text-green-800 border border-green-700/60',
};

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

  // Push to recent-patients store so the topbar quick switcher remembers it
  useEffect(() => {
    if (patientId) pushRecentPatient(patientId);
  }, [patientId]);

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
          <p className="text-slate-600 mb-6">
            Nao ha cockpit para <strong>{patientId}</strong>. Disponiveis: MRN-001, MRN-004, MRN-013.
          </p>
          <Link href="/patients" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium no-underline hover:bg-blue-700">
            {'\u2190'} Voltar para Pacientes
          </Link>
        </div>
      </AppShell>
    );
  }

  const initials = cockpit.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppShell pageTitle={`${cockpit.name} — Cockpit`}>
      <Breadcrumbs
        crumbs={[
          { label: 'Início', href: '/' },
          { label: 'Assistencial' },
          { label: 'Pacientes', href: '/patients' },
          { label: `${cockpit.mrn} ${cockpit.name}`, current: true },
        ]}
      />
      {/* Back + Actions */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-800 no-underline font-medium">
          {'\u2190'} Voltar para Pacientes
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <FavoriteButton
            scope="patients"
            entry={{
              id: cockpit.mrn,
              label: cockpit.name,
              href: `/patients/${cockpit.mrn}`,
              description: `${cockpit.age} anos · ${cockpit.ward} · ${cockpit.diagnosis}`,
            }}
          />
          <Link href={`/patients/${patientId}/register-event`} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold no-underline hover:bg-blue-700 shadow-sm">
            {'\u2795'} Registrar Evento
          </Link>
        </div>
      </div>

      {/* ============ IDENTITY BAND ============ */}
      <div className="bg-white rounded-xl border-2 border-blue-700/60 p-5 mb-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Avatar */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-md">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 truncate">{cockpit.name}</h1>
              <p className="text-sm text-slate-600">{cockpit.age} anos &middot; {cockpit.mrn} &middot; {cockpit.bloodType && <span className="font-semibold text-red-700">{cockpit.bloodType}</span>} &middot; {cockpit.weight}kg</p>
              <p className="text-sm text-slate-700 font-medium mt-0.5">{cockpit.diagnosis}</p>
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
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-slate-50 text-slate-700 border border-slate-300">
              Tempo de Internação: {cockpit.los}d
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-slate-50 text-slate-700 border border-slate-300">
              {cockpit.ward} &middot; Leito {cockpit.bed}
            </span>
          </div>
        </div>

        {/* Allergies bar */}
        {cockpit.allergies.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-red-800 uppercase">ALERGIAS:</span>
            {cockpit.allergies.map((a) => (
              <span key={a} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-950/50 text-red-800 border border-red-700">
                {'\u26A0\uFE0F'} {a}
              </span>
            ))}
          </div>
        )}
        {cockpit.allergies.length === 0 && (
          <div className="mt-3">
            <span className="text-xs font-medium text-green-700">NKDA (Nenhuma alergia conhecida)</span>
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
                    ? 'border-blue-500 text-blue-800 bg-blue-950/30'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
                <div className="bg-red-950/40 border border-red-700 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-red-800 uppercase tracking-wider mb-3">
                    {'\u26A0\uFE0F'} Pendencias — O que precisa acontecer AGORA ({cockpit.pendingActions.length})
                  </h3>
                  <div className="space-y-2">
                    {cockpit.pendingActions.map((pa, i) => (
                      <div key={i} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${
                        pa.urgency === 'critico' ? 'bg-red-950/60 border-red-700' :
                        pa.urgency === 'urgente' ? 'bg-amber-950/40 border-amber-700' : 'bg-white border-slate-200'
                      }`}>
                        <span className={`shrink-0 mt-0.5 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          pa.urgency === 'critico' ? 'bg-red-700 text-white' :
                          pa.urgency === 'urgente' ? 'bg-amber-100 text-white' : 'bg-slate-100 text-slate-900'
                        }`}>{pa.urgency}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900">{pa.action}</div>
                          <div className="text-xs text-slate-600 mt-0.5">Responsavel: {pa.assignedTo}</div>
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
                      <div className="text-[10px] font-bold text-slate-600 uppercase">FC</div>
                      <div className="text-2xl font-bold text-slate-900">{cockpit.vitals[0].fc}</div>
                      <div className="text-xs text-slate-600">bpm</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-600 uppercase">PA</div>
                      <div className="text-2xl font-bold text-slate-900">{cockpit.vitals[0].pas}x{cockpit.vitals[0].pad}</div>
                      <div className="text-xs text-slate-600">mmHg</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-600 uppercase">SpO2</div>
                      <div className="text-2xl font-bold text-slate-900">{cockpit.vitals[0].spo2}%</div>
                      <div className="text-xs text-slate-600">Saturacao</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-600 uppercase">Temp</div>
                      <div className="text-2xl font-bold text-slate-900">{cockpit.vitals[0].temp}&deg;C</div>
                      <div className="text-xs text-slate-600">{cockpit.vitals[0].timestamp}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Row 2: responsibility + meds + pain + NEWS2 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-blue-950/40 border border-blue-700/60 rounded-lg p-4">
                  <div className="text-[10px] font-bold text-blue-700 uppercase mb-2">Responsavel AGORA</div>
                  <div className="space-y-1 text-slate-900">
                    <div className="text-sm"><span className="font-semibold">Medico:</span> {cockpit.currentResponsible.physician}</div>
                    <div className="text-sm"><span className="font-semibold">Enfermeiro:</span> {cockpit.currentResponsible.nurse}</div>
                    <div className="text-sm"><span className="font-semibold">Equipe:</span> {cockpit.currentResponsible.team}</div>
                  </div>
                </div>
                <div className="bg-purple-950/40 border border-purple-700/60 rounded-lg p-4">
                  <div className="text-[10px] font-bold text-purple-700 uppercase mb-2">Medicacoes Ativas</div>
                  <div className="text-3xl font-bold text-purple-800">{cockpit.medications.filter(m => m.status === 'ativa').length}</div>
                  <div className="text-xs text-purple-700 mt-1">
                    Proxima dose: {cockpit.medications.find(m => m.status === 'ativa' && m.nextDose)?.nextDose || 'N/A'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-lg p-4 ${cockpit.painLevel >= 7 ? 'bg-red-950/40 border border-red-700' : cockpit.painLevel >= 4 ? 'bg-amber-950/40 border border-amber-700' : 'bg-green-950/40 border border-green-700'}`}>
                    <div className="text-[10px] font-bold text-slate-600 uppercase">Dor</div>
                    <div className="text-3xl font-bold text-slate-900">{cockpit.painLevel}/10</div>
                  </div>
                  <div className={`rounded-lg p-4 bg-slate-50 ${news2Color(cockpit.news2Score).includes('red') ? 'border border-red-700' : news2Color(cockpit.news2Score).includes('orange') ? 'border border-orange-700' : 'border border-green-700'}`}>
                    <div className="text-[10px] font-bold text-slate-600 uppercase">NEWS2</div>
                    <div className="text-3xl font-bold text-slate-900">{cockpit.news2Score}</div>
                    <div className="text-xs text-slate-600">{news2Label(cockpit.news2Score)}</div>
                  </div>
                </div>
              </div>

              {/* NEWS2 Trend (text-based sparkline) */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-[10px] font-bold text-slate-600 uppercase mb-2">NEWS2 Trend</div>
                <div className="flex items-end gap-1 h-16">
                  {cockpit.news2Trend.map((p, i) => (
                    <div key={i} className="flex flex-col items-center flex-1">
                      <div
                        className={`w-full rounded-t ${p.score >= 7 ? 'bg-red-500' : p.score >= 5 ? 'bg-orange-400' : p.score >= 3 ? 'bg-amber-400' : 'bg-green-400'}`}
                        style={{ height: `${Math.max(4, (p.score / 12) * 60)}px` }}
                      />
                      <div className="text-[9px] text-slate-600 mt-1">{p.date}</div>
                      <div className="text-[9px] font-bold text-slate-900">{p.score}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last assessment */}
              <div className="text-xs text-slate-600 text-right">
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
                  <span className="text-xs font-bold text-slate-600 uppercase">Filtrar por Categoria</span>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedCategories(new Set(ALL_CATEGORIES))} className="text-xs text-blue-700 hover:text-blue-800 font-medium bg-transparent border-none cursor-pointer">Todas</button>
                    <button onClick={() => setSelectedCategories(new Set())} className="text-xs text-slate-600 hover:text-slate-900 font-medium bg-transparent border-none cursor-pointer">Nenhuma</button>
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
                      }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${sel ? `${cfg.colorBg} ${cfg.colorText} ${cfg.colorBorder}` : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        <span>{cfg.icon}</span><span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Timeline */}
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-100 md:left-6" />
                <div className="space-y-4">
                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 text-sm">Nenhum evento para os filtros selecionados.</div>
                  ) : filteredEvents.map((evt) => {
                    const cfg = CATEGORY_CONFIG[evt.category];
                    return (
                      <div key={evt.id} className="relative flex gap-4 pl-0">
                        <div className={`relative z-10 flex items-center justify-center shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full border-2 ${cfg.colorBg} ${cfg.colorBorder} ${cfg.colorText} text-lg md:text-xl`}>
                          {cfg.icon}
                        </div>
                        <div className={`flex-1 min-w-0 rounded-xl border p-4 shadow-sm ${evt.pending ? 'bg-red-950/40 border-red-700' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cfg.colorBg} ${cfg.colorText}`}>{cfg.label}</span>
                              {evt.pending && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-950/50 text-red-800 border border-red-700/60">Pendente</span>}
                            </div>
                            <span className="text-xs text-slate-600 font-mono shrink-0">{evt.timestamp}</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mb-1">{evt.title}</h4>
                          <p className="text-sm text-slate-700 leading-relaxed mb-2">{evt.description}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span>{evt.author} ({evt.role})</span>
                            <span>{evt.location}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="text-xs text-slate-600 mt-4 text-right">
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
                    <div key={med.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div>
                          <span className="text-base font-bold text-slate-900">{med.name}</span>
                          <span className="text-sm text-slate-600 ml-2">{med.dose} — {med.route} — {med.frequency}</span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-950/50 text-green-800 border border-green-700/60">ATIVA</span>
                      </div>
                      {med.nextDose && <div className="text-xs text-blue-700 font-medium mb-2">Proxima dose: {med.nextDose}</div>}
                      {/* Administration schedule */}
                      {med.administrations.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {med.administrations.map((adm, i) => (
                            <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              adm.status === 'administrado' ? 'bg-green-950/40 text-green-800 border border-green-700/60' :
                              adm.status === 'pendente' ? 'bg-amber-950/40 text-amber-800 border border-amber-700/60' :
                              adm.status === 'atrasado' ? 'bg-red-950/40 text-red-800 border border-red-700/60' :
                              'bg-white text-slate-600 border border-slate-200'
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
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-950/40 text-amber-800 border border-amber-700/60">
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
                <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Suspensas / Concluidas</h3>
                <div className="space-y-2">
                  {cockpit.medications.filter(m => m.status !== 'ativa').map((med) => (
                    <div key={med.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 opacity-75">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-slate-700">{med.name}</span>
                          <span className="text-xs text-slate-600 ml-2">{med.dose} — {med.route} — {med.frequency}</span>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          med.status === 'suspensa' ? 'bg-amber-950/50 text-amber-800 border border-amber-700/60' : 'bg-slate-100 text-slate-900 border border-slate-300'
                        }`}>{med.status.toUpperCase()}</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">{med.startDate} a {med.endDate || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reconciliation status */}
              <div className="bg-blue-950/40 border border-blue-700/60 rounded-lg p-4">
                <div className="text-xs font-bold text-blue-800 uppercase mb-1">{'\uD83D\uDD04'} Reconciliacao Medicamentosa</div>
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
                  <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider mb-3">{'\u23F3'} Pendentes</h3>
                  <div className="space-y-2">
                    {cockpit.labs.filter(l => l.status === 'solicitado' || l.status === 'em_andamento').map((lab) => (
                      <div key={lab.id} className="bg-amber-950/40 border border-amber-700 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-amber-800">{lab.name}</span>
                          <span className="text-xs font-bold text-amber-800 uppercase">{lab.status === 'solicitado' ? 'Solicitado' : 'Em andamento'}</span>
                        </div>
                        <div className="text-xs text-amber-800 mt-1">Solicitado em: {lab.requestDate}</div>
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
                    <div key={lab.id} className={`border rounded-lg p-4 ${lab.isCritical ? 'bg-red-950/40 border-red-700' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900">
                          {lab.category === 'imagem' ? '\uD83D\uDCF7 ' : '\uD83E\uDDEA '}{lab.name}
                          {lab.isCritical && <span className="ml-2 text-xs font-bold text-red-800 bg-red-950/60 border border-red-700/60 px-1.5 py-0.5 rounded">CRITICO</span>}
                        </span>
                        <span className="text-xs text-slate-600">{lab.resultDate}</span>
                      </div>
                      <div className="text-sm text-slate-700">
                        {lab.value}{lab.unit ? ` ${lab.unit}` : ''}
                        {lab.reference && <span className="text-xs text-slate-600 ml-2">(Ref: {lab.reference})</span>}
                      </div>
                      {/* Trend */}
                      {lab.trend && lab.trend.length > 1 && (
                        <div className="mt-3">
                          <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">Tendencia</div>
                          <div className="flex items-end gap-1 h-10">
                            {lab.trend.map((t, i) => {
                              const max = Math.max(...lab.trend!.map(x => x.value));
                              const pct = max > 0 ? (t.value / max) * 100 : 0;
                              return (
                                <div key={i} className="flex flex-col items-center flex-1">
                                  <div className="w-full bg-blue-400 rounded-t" style={{ height: `${Math.max(2, pct * 0.35)}px` }} />
                                  <div className="text-[8px] text-slate-600 mt-0.5">{t.date}</div>
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
                    { label: 'FC', value: `${cockpit.vitals[0].fc}`, unit: 'bpm', color: cockpit.vitals[0].fc > 100 || cockpit.vitals[0].fc < 50 ? 'text-red-700' : 'text-slate-900' },
                    { label: 'PA', value: `${cockpit.vitals[0].pas}/${cockpit.vitals[0].pad}`, unit: 'mmHg', color: cockpit.vitals[0].pas > 160 || cockpit.vitals[0].pas < 90 ? 'text-red-700' : 'text-slate-900' },
                    { label: 'FR', value: `${cockpit.vitals[0].fr}`, unit: '/min', color: cockpit.vitals[0].fr > 25 ? 'text-red-700' : 'text-slate-900' },
                    { label: 'SpO2', value: `${cockpit.vitals[0].spo2}%`, unit: '', color: cockpit.vitals[0].spo2 < 92 ? 'text-red-700' : 'text-slate-900' },
                    { label: 'Temp', value: `${cockpit.vitals[0].temp}`, unit: '\u00B0C', color: cockpit.vitals[0].temp > 38 ? 'text-red-700' : 'text-slate-900' },
                    { label: 'Dor', value: `${cockpit.vitals[0].pain}`, unit: '/10', color: cockpit.vitals[0].pain >= 7 ? 'text-red-700' : cockpit.vitals[0].pain >= 4 ? 'text-amber-700' : 'text-slate-900' },
                    { label: 'NEWS2', value: `${cockpit.news2Score}`, unit: news2Label(cockpit.news2Score), color: cockpit.news2Score >= 5 ? 'text-red-700' : cockpit.news2Score >= 3 ? 'text-amber-700' : 'text-green-700' },
                  ].map((v) => (
                    <div key={v.label} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                      <div className="text-[10px] font-bold text-slate-600 uppercase">{v.label}</div>
                      <div className={`text-xl font-bold ${v.color}`}>{v.value}</div>
                      <div className="text-[10px] text-slate-600">{v.unit}</div>
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
                        <th className="text-left px-3 py-2 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">Data/Hora</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">FC</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">PA</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">FR</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">SpO2</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">Temp</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">Dor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cockpit.vitals.map((v, i) => (
                        <tr key={i} className="border-b border-slate-200 hover:bg-slate-50 text-slate-900">
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
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-[10px] font-bold text-slate-600 uppercase mb-2">NEWS2 Early Warning — Trend</div>
                <div className="flex items-end gap-1 h-20">
                  {cockpit.news2Trend.map((p, i) => (
                    <div key={i} className="flex flex-col items-center flex-1">
                      <div
                        className={`w-full rounded-t ${p.score >= 7 ? 'bg-red-500' : p.score >= 5 ? 'bg-orange-400' : p.score >= 3 ? 'bg-amber-400' : 'bg-green-400'}`}
                        style={{ height: `${Math.max(4, (p.score / 12) * 70)}px` }}
                      />
                      <div className="text-[9px] text-slate-600 mt-1">{p.date}</div>
                      <div className="text-[9px] font-bold text-slate-900">{p.score}</div>
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
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-950/50 text-blue-800 flex items-center justify-center text-sm font-bold shrink-0 border border-blue-700/60">
                        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{member.name}</div>
                        <div className="text-xs text-slate-600">{member.role}{member.specialty ? ` — ${member.specialty}` : ''}</div>
                        <div className="text-xs text-slate-600 mt-1">Desde: {member.since}{member.contact ? ` | ${member.contact}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Previous team */}
              {cockpit.careTeam.filter(m => !m.isActive).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Equipe Anterior</h3>
                  <div className="space-y-2">
                    {cockpit.careTeam.filter(m => !m.isActive).map((member, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 opacity-70">
                        <span className="text-sm font-semibold text-slate-700">{member.name}</span>
                        <span className="text-xs text-slate-600 ml-2">{member.role} ({member.since} a {member.until})</span>
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
                    <div key={i} className="bg-yellow-950/40 border border-yellow-700 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-600">{h.timestamp}</span>
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
                  rascunho: 'bg-amber-950/50 text-amber-800 border border-amber-700/60',
                  finalizado: 'bg-blue-950/50 text-blue-800 border border-blue-700/60',
                  assinado: 'bg-green-950/50 text-green-800 border border-green-700/60',
                };
                return (
                  <div key={doc.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{doc.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{typeLabels[doc.type] || doc.type} &middot; {doc.author} &middot; {doc.date}</div>
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
                  <span className="text-xs font-mono text-slate-600 shrink-0 w-28">{entry.timestamp}</span>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-slate-900">{entry.actor}</span>
                    <span className="text-xs text-slate-600 ml-2">{entry.action}</span>
                    <div className="text-xs text-slate-600 mt-0.5">{entry.details}</div>
                  </div>
                </div>
              ))}
              <div className="text-xs text-slate-600 mt-4 text-right">
                Mostrando ultimos {cockpit.auditTrail.length} registros. Auditoria completa disponivel no modulo de Auditoria.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related entities — pulls from /api/related/patient/[mrn] */}
      <div className="mt-5">
        <RelatedItems entityType="patient" entityId={cockpit.mrn} />
      </div>
    </AppShell>
  );
}
