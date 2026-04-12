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
  emergencia: { icon: '', label: 'Emergencia', colorBg: 'bg-neutral-100', colorText: 'text-neutral-900', colorBorder: 'border-neutral-300' },
  admissao: { icon: '', label: 'Admissao', colorBg: 'bg-neutral-100', colorText: 'text-neutral-900', colorBorder: 'border-neutral-300' },
  avaliacao: { icon: '', label: 'Avaliacao', colorBg: 'bg-neutral-100', colorText: 'text-neutral-900', colorBorder: 'border-neutral-300' },
  medicacao: { icon: '', label: 'Medicacao', colorBg: 'bg-neutral-100', colorText: 'text-neutral-900', colorBorder: 'border-neutral-300' },
  exame: { icon: '', label: 'Exame', colorBg: 'bg-neutral-100', colorText: 'text-neutral-900', colorBorder: 'border-neutral-300' },
  evolucao: { icon: '', label: 'Evolucao', colorBg: 'bg-neutral-50', colorText: 'text-neutral-700', colorBorder: 'border-neutral-300' },
  handoff: { icon: '', label: 'Handoff', colorBg: 'bg-neutral-100', colorText: 'text-neutral-900', colorBorder: 'border-neutral-300' },
  alerta: { icon: '', label: 'Alerta', colorBg: 'bg-neutral-100', colorText: 'text-neutral-900', colorBorder: 'border-neutral-300' },
  chamada: { icon: '', label: 'Chamada', colorBg: 'bg-neutral-100', colorText: 'text-neutral-900', colorBorder: 'border-neutral-300' },
  alta: { icon: '', label: 'Alta', colorBg: 'bg-neutral-100', colorText: 'text-neutral-900', colorBorder: 'border-neutral-300' },
};

const ALL_CATEGORIES: EventCategory[] = [
  'emergencia', 'admissao', 'avaliacao', 'medicacao', 'exame',
  'evolucao', 'handoff', 'alerta', 'chamada', 'alta',
];

// ===========================================================================
// NEWS2 Score Color
// ===========================================================================

function news2Color(score: number): string {
  if (score >= 7) return 'bg-neutral-900 text-white';
  if (score >= 5) return 'bg-neutral-700 text-white';
  if (score >= 3) return 'bg-neutral-400 text-neutral-900';
  return 'bg-neutral-50 text-white';
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
  'on-track': 'bg-neutral-100 text-neutral-900 border border-neutral-300',
  'at-risk': 'bg-neutral-100 text-neutral-900 border border-neutral-300',
  blocked: 'bg-neutral-100 text-neutral-900 border border-neutral-300',
  discharged: 'bg-neutral-50 text-neutral-700 border border-neutral-300',
};
const RISK_LABELS: Record<string, string> = { high: 'Alto', medium: 'Medio', low: 'Baixo' };
const RISK_COLORS: Record<string, string> = {
  high: 'bg-neutral-100 text-neutral-900 border border-neutral-300',
  medium: 'bg-neutral-100 text-neutral-900 border border-neutral-300',
  low: 'bg-neutral-100 text-neutral-900 border border-neutral-300',
};

// ===========================================================================
// Tab definitions
// ===========================================================================

const TABS = [
  { id: 'resumo', label: 'Resumo Atual', icon: '' },
  { id: 'timeline', label: 'Timeline', icon: '' },
  { id: 'medicacao', label: 'Medicacao', icon: '' },
  { id: 'exames', label: 'Exames', icon: '' },
  { id: 'sinais', label: 'Sinais Vitais', icon: '' },
  { id: 'equipe', label: 'Equipe', icon: '' },
  { id: 'documentos', label: 'Documentos', icon: '' },
  { id: 'auditoria', label: 'Auditoria', icon: '' },
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
          <div className="text-5xl mb-4"></div>
          <h2 className="text-xl font-semibold text-neutral-700 mb-2">Paciente nao encontrado</h2>
          <p className="text-neutral-500 mb-6">
            Nao ha cockpit para <strong>{patientId}</strong>. Disponiveis: MRN-001, MRN-004, MRN-013.
          </p>
          <Link href="/patients" className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium no-underline hover:bg-neutral-800">
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
        <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-neutral-700 hover:text-neutral-900 no-underline font-medium">
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
          <Link href={`/patients/${patientId}/register-event`} className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-semibold no-underline hover:bg-neutral-800 shadow-sm">
            Registrar Evento
          </Link>
        </div>
      </div>

      {/* ============ IDENTITY BAND ============ */}
      <div className="bg-white rounded-xl border-2 border-neutral-300 p-5 mb-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Avatar */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-16 h-16 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-md">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-neutral-900 truncate">{cockpit.name}</h1>
              <p className="text-sm text-neutral-500">{cockpit.age} anos &middot; {cockpit.mrn} &middot; {cockpit.bloodType && <span className="font-semibold text-neutral-900">{cockpit.bloodType}</span>} &middot; {cockpit.weight}kg</p>
              <p className="text-sm text-neutral-700 font-medium mt-0.5">{cockpit.diagnosis}</p>
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
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-neutral-50 text-neutral-700 border border-neutral-300">
              Tempo de Internação: {cockpit.los}d
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-neutral-50 text-neutral-700 border border-neutral-300">
              {cockpit.ward} &middot; Leito {cockpit.bed}
            </span>
          </div>
        </div>

        {/* Allergies bar */}
        {cockpit.allergies.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-neutral-900 uppercase">ALERGIAS:</span>
            {cockpit.allergies.map((a) => (
              <span key={a} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-neutral-100 text-neutral-900 border border-neutral-300">
                {a}
              </span>
            ))}
          </div>
        )}
        {cockpit.allergies.length === 0 && (
          <div className="mt-3">
            <span className="text-xs font-medium text-neutral-700">NKDA (Nenhuma alergia conhecida)</span>
          </div>
        )}
      </div>

      {/* ============ TABS ============ */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-neutral-200 overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer
                  whitespace-nowrap shrink-0
                  ${activeTab === tab.id
                    ? 'border-neutral-900 text-neutral-900 bg-neutral-100'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
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
                <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-3">
                    Pendencias — O que precisa acontecer AGORA ({cockpit.pendingActions.length})
                  </h3>
                  <div className="space-y-2">
                    {cockpit.pendingActions.map((pa, i) => (
                      <div key={i} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${
                        pa.urgency === 'critico' ? 'bg-neutral-100 border-neutral-300' :
                        pa.urgency === 'urgente' ? 'bg-neutral-100 border-neutral-300' : 'bg-white border-neutral-200'
                      }`}>
                        <span className={`shrink-0 mt-0.5 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          pa.urgency === 'critico' ? 'bg-neutral-900 text-white' :
                          pa.urgency === 'urgente' ? 'bg-neutral-200 text-white' : 'bg-neutral-100 text-neutral-900'
                        }`}>{pa.urgency}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-neutral-900">{pa.action}</div>
                          <div className="text-xs text-neutral-500 mt-0.5">Responsavel: {pa.assignedTo}</div>
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
                    <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                      <div className="text-[10px] font-bold text-neutral-500 uppercase">FC</div>
                      <div className="text-2xl font-bold text-neutral-900">{cockpit.vitals[0].fc}</div>
                      <div className="text-xs text-neutral-500">bpm</div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                      <div className="text-[10px] font-bold text-neutral-500 uppercase">PA</div>
                      <div className="text-2xl font-bold text-neutral-900">{cockpit.vitals[0].pas}x{cockpit.vitals[0].pad}</div>
                      <div className="text-xs text-neutral-500">mmHg</div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                      <div className="text-[10px] font-bold text-neutral-500 uppercase">SpO2</div>
                      <div className="text-2xl font-bold text-neutral-900">{cockpit.vitals[0].spo2}%</div>
                      <div className="text-xs text-neutral-500">Saturacao</div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                      <div className="text-[10px] font-bold text-neutral-500 uppercase">Temp</div>
                      <div className="text-2xl font-bold text-neutral-900">{cockpit.vitals[0].temp}&deg;C</div>
                      <div className="text-xs text-neutral-500">{cockpit.vitals[0].timestamp}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Row 2: responsibility + meds + pain + NEWS2 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-4">
                  <div className="text-[10px] font-bold text-neutral-700 uppercase mb-2">Responsavel AGORA</div>
                  <div className="space-y-1 text-neutral-900">
                    <div className="text-sm"><span className="font-semibold">Medico:</span> {cockpit.currentResponsible.physician}</div>
                    <div className="text-sm"><span className="font-semibold">Enfermeiro:</span> {cockpit.currentResponsible.nurse}</div>
                    <div className="text-sm"><span className="font-semibold">Equipe:</span> {cockpit.currentResponsible.team}</div>
                  </div>
                </div>
                <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-4">
                  <div className="text-[10px] font-bold text-neutral-700 uppercase mb-2">Medicacoes Ativas</div>
                  <div className="text-3xl font-bold text-neutral-900">{cockpit.medications.filter(m => m.status === 'ativa').length}</div>
                  <div className="text-xs text-neutral-700 mt-1">
                    Proxima dose: {cockpit.medications.find(m => m.status === 'ativa' && m.nextDose)?.nextDose || 'N/A'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-lg p-4 ${cockpit.painLevel >= 7 ? 'bg-neutral-100 border border-neutral-300' : cockpit.painLevel >= 4 ? 'bg-neutral-100 border border-neutral-300' : 'bg-neutral-100 border border-neutral-300'}`}>
                    <div className="text-[10px] font-bold text-neutral-500 uppercase">Dor</div>
                    <div className="text-3xl font-bold text-neutral-900">{cockpit.painLevel}/10</div>
                  </div>
                  <div className={`rounded-lg p-4 bg-neutral-50 ${news2Color(cockpit.news2Score).includes('red') ? 'border border-neutral-300' : news2Color(cockpit.news2Score).includes('orange') ? 'border border-neutral-300' : 'border border-neutral-300'}`}>
                    <div className="text-[10px] font-bold text-neutral-500 uppercase">NEWS2</div>
                    <div className="text-3xl font-bold text-neutral-900">{cockpit.news2Score}</div>
                    <div className="text-xs text-neutral-500">{news2Label(cockpit.news2Score)}</div>
                  </div>
                </div>
              </div>

              {/* NEWS2 Trend (text-based sparkline) */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <div className="text-[10px] font-bold text-neutral-500 uppercase mb-2">NEWS2 Trend</div>
                <div className="flex items-end gap-1 h-16">
                  {cockpit.news2Trend.map((p, i) => (
                    <div key={i} className="flex flex-col items-center flex-1">
                      <div
                        className={`w-full rounded-t ${p.score >= 7 ? 'bg-neutral-800' : p.score >= 5 ? 'bg-neutral-600' : p.score >= 3 ? 'bg-neutral-400' : 'bg-neutral-300'}`}
                        style={{ height: `${Math.max(4, (p.score / 12) * 60)}px` }}
                      />
                      <div className="text-[9px] text-neutral-500 mt-1">{p.date}</div>
                      <div className="text-[9px] font-bold text-neutral-900">{p.score}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last assessment */}
              <div className="text-xs text-neutral-500 text-right">
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
                  <span className="text-xs font-bold text-neutral-500 uppercase">Filtrar por Categoria</span>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedCategories(new Set(ALL_CATEGORIES))} className="text-xs text-neutral-700 hover:text-neutral-900 font-medium bg-transparent border-none cursor-pointer">Todas</button>
                    <button onClick={() => setSelectedCategories(new Set())} className="text-xs text-neutral-500 hover:text-neutral-900 font-medium bg-transparent border-none cursor-pointer">Nenhuma</button>
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
                      }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${sel ? `${cfg.colorBg} ${cfg.colorText} ${cfg.colorBorder}` : 'bg-neutral-50 text-neutral-500 border-neutral-200'}`}>
                        <span>{cfg.icon}</span><span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Timeline */}
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-neutral-100 md:left-6" />
                <div className="space-y-4">
                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-8 text-neutral-500 text-sm">Nenhum evento para os filtros selecionados.</div>
                  ) : filteredEvents.map((evt) => {
                    const cfg = CATEGORY_CONFIG[evt.category];
                    return (
                      <div key={evt.id} className="relative flex gap-4 pl-0">
                        <div className={`relative z-10 flex items-center justify-center shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full border-2 ${cfg.colorBg} ${cfg.colorBorder} ${cfg.colorText} text-lg md:text-xl`}>
                          {cfg.icon}
                        </div>
                        <div className={`flex-1 min-w-0 rounded-xl border p-4 shadow-sm ${evt.pending ? 'bg-neutral-100 border-neutral-300' : 'bg-neutral-50 border-neutral-200'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cfg.colorBg} ${cfg.colorText}`}>{cfg.label}</span>
                              {evt.pending && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-900 border border-neutral-300">Pendente</span>}
                            </div>
                            <span className="text-xs text-neutral-500 font-mono shrink-0">{evt.timestamp}</span>
                          </div>
                          <h4 className="text-sm font-bold text-neutral-900 mb-1">{evt.title}</h4>
                          <p className="text-sm text-neutral-700 leading-relaxed mb-2">{evt.description}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                            <span>{evt.author} ({evt.role})</span>
                            <span>{evt.location}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="text-xs text-neutral-500 mt-4 text-right">
                Exibindo {filteredEvents.length} de {allEvents.length} eventos
              </div>
            </div>
          )}

          {/* ============ TAB: MEDICACAO ============ */}
          {activeTab === 'medicacao' && (
            <div className="space-y-5">
              {/* Active medications */}
              <div>
                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider mb-3">Medicacoes Ativas</h3>
                <div className="space-y-2">
                  {cockpit.medications.filter(m => m.status === 'ativa').map((med) => (
                    <div key={med.id} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div>
                          <span className="text-base font-bold text-neutral-900">{med.name}</span>
                          <span className="text-sm text-neutral-500 ml-2">{med.dose} — {med.route} — {med.frequency}</span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-neutral-100 text-neutral-900 border border-neutral-300">ATIVA</span>
                      </div>
                      {med.nextDose && <div className="text-xs text-neutral-700 font-medium mb-2">Proxima dose: {med.nextDose}</div>}
                      {/* Administration schedule */}
                      {med.administrations.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {med.administrations.map((adm, i) => (
                            <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              adm.status === 'administrado' ? 'bg-neutral-100 text-neutral-900 border border-neutral-300' :
                              adm.status === 'pendente' ? 'bg-neutral-100 text-neutral-900 border border-neutral-300' :
                              adm.status === 'atrasado' ? 'bg-neutral-100 text-neutral-900 border border-neutral-300' :
                              'bg-white text-neutral-500 border border-neutral-200'
                            }`}>
                              {adm.status === 'administrado' ? 'OK' : adm.status === 'pendente' ? '--' : adm.status === 'atrasado' ? '!' : 'x'}
                              {adm.time} — {adm.status}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Interactions */}
                      {med.interactions && med.interactions.length > 0 && (
                        <div className="mt-2">
                          {med.interactions.map((int, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-900 border border-neutral-300">
                              Interacao: {int}
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
                <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-3">Suspensas / Concluidas</h3>
                <div className="space-y-2">
                  {cockpit.medications.filter(m => m.status !== 'ativa').map((med) => (
                    <div key={med.id} className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 opacity-75">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-neutral-700">{med.name}</span>
                          <span className="text-xs text-neutral-500 ml-2">{med.dose} — {med.route} — {med.frequency}</span>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          med.status === 'suspensa' ? 'bg-neutral-100 text-neutral-900 border border-neutral-300' : 'bg-neutral-100 text-neutral-900 border border-neutral-300'
                        }`}>{med.status.toUpperCase()}</span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">{med.startDate} a {med.endDate || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reconciliation status */}
              <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-4">
                <div className="text-xs font-bold text-neutral-900 uppercase mb-1">Reconciliacao Medicamentosa</div>
                <div className="text-sm text-neutral-900">
                  {cockpit.medications.filter(m => m.status === 'ativa').length} medicacoes ativas prescritas.
                  Todas com administracao verificada nas ultimas 24h.
                  Status: <span className="font-bold text-neutral-700">Reconciliado</span>
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
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-3">Pendentes</h3>
                  <div className="space-y-2">
                    {cockpit.labs.filter(l => l.status === 'solicitado' || l.status === 'em_andamento').map((lab) => (
                      <div key={lab.id} className="bg-neutral-100 border border-neutral-300 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-neutral-900">{lab.name}</span>
                          <span className="text-xs font-bold text-neutral-900 uppercase">{lab.status === 'solicitado' ? 'Solicitado' : 'Em andamento'}</span>
                        </div>
                        <div className="text-xs text-neutral-900 mt-1">Solicitado em: {lab.requestDate}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed results */}
              <div>
                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider mb-3">Resultados</h3>
                <div className="space-y-2">
                  {cockpit.labs.filter(l => l.status === 'concluido' || l.status === 'critico').map((lab) => (
                    <div key={lab.id} className={`border rounded-lg p-4 ${lab.isCritical ? 'bg-neutral-100 border-neutral-300' : 'bg-neutral-50 border-neutral-200'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                        <span className="text-sm font-bold text-neutral-900">
                          {lab.name}
                          {lab.isCritical && <span className="ml-2 text-xs font-bold text-neutral-900 bg-neutral-100 border border-neutral-300 px-1.5 py-0.5 rounded">CRITICO</span>}
                        </span>
                        <span className="text-xs text-neutral-500">{lab.resultDate}</span>
                      </div>
                      <div className="text-sm text-neutral-700">
                        {lab.value}{lab.unit ? ` ${lab.unit}` : ''}
                        {lab.reference && <span className="text-xs text-neutral-500 ml-2">(Ref: {lab.reference})</span>}
                      </div>
                      {/* Trend */}
                      {lab.trend && lab.trend.length > 1 && (
                        <div className="mt-3">
                          <div className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Tendencia</div>
                          <div className="flex items-end gap-1 h-10">
                            {lab.trend.map((t, i) => {
                              const max = Math.max(...lab.trend!.map(x => x.value));
                              const pct = max > 0 ? (t.value / max) * 100 : 0;
                              return (
                                <div key={i} className="flex flex-col items-center flex-1">
                                  <div className="w-full bg-neutral-400 rounded-t" style={{ height: `${Math.max(2, pct * 0.35)}px` }} />
                                  <div className="text-[8px] text-neutral-500 mt-0.5">{t.date}</div>
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
                    { label: 'FC', value: `${cockpit.vitals[0].fc}`, unit: 'bpm', color: cockpit.vitals[0].fc > 100 || cockpit.vitals[0].fc < 50 ? 'text-neutral-900' : 'text-neutral-900' },
                    { label: 'PA', value: `${cockpit.vitals[0].pas}/${cockpit.vitals[0].pad}`, unit: 'mmHg', color: cockpit.vitals[0].pas > 160 || cockpit.vitals[0].pas < 90 ? 'text-neutral-900' : 'text-neutral-900' },
                    { label: 'FR', value: `${cockpit.vitals[0].fr}`, unit: '/min', color: cockpit.vitals[0].fr > 25 ? 'text-neutral-900' : 'text-neutral-900' },
                    { label: 'SpO2', value: `${cockpit.vitals[0].spo2}%`, unit: '', color: cockpit.vitals[0].spo2 < 92 ? 'text-neutral-900' : 'text-neutral-900' },
                    { label: 'Temp', value: `${cockpit.vitals[0].temp}`, unit: '\u00B0C', color: cockpit.vitals[0].temp > 38 ? 'text-neutral-900' : 'text-neutral-900' },
                    { label: 'Dor', value: `${cockpit.vitals[0].pain}`, unit: '/10', color: cockpit.vitals[0].pain >= 7 ? 'text-neutral-900' : cockpit.vitals[0].pain >= 4 ? 'text-neutral-700' : 'text-neutral-900' },
                    { label: 'NEWS2', value: `${cockpit.news2Score}`, unit: news2Label(cockpit.news2Score), color: cockpit.news2Score >= 5 ? 'text-neutral-900' : cockpit.news2Score >= 3 ? 'text-neutral-700' : 'text-neutral-700' },
                  ].map((v) => (
                    <div key={v.label} className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-center">
                      <div className="text-[10px] font-bold text-neutral-500 uppercase">{v.label}</div>
                      <div className={`text-xl font-bold ${v.color}`}>{v.value}</div>
                      <div className="text-[10px] text-neutral-500">{v.unit}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Vitals history table */}
              <div>
                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider mb-3">Historico</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-neutral-50">
                        <th className="text-left px-3 py-2 text-xs font-bold text-neutral-500 uppercase border-b border-neutral-200">Data/Hora</th>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase border-b border-neutral-200">FC</th>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase border-b border-neutral-200">PA</th>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase border-b border-neutral-200">FR</th>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase border-b border-neutral-200">SpO2</th>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase border-b border-neutral-200">Temp</th>
                        <th className="px-3 py-2 text-xs font-bold text-neutral-500 uppercase border-b border-neutral-200">Dor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cockpit.vitals.map((v, i) => (
                        <tr key={i} className="border-b border-neutral-200 hover:bg-neutral-50 text-neutral-900">
                          <td className="px-3 py-2 font-mono text-xs text-neutral-500">{v.timestamp}</td>
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
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <div className="text-[10px] font-bold text-neutral-500 uppercase mb-2">NEWS2 Early Warning — Trend</div>
                <div className="flex items-end gap-1 h-20">
                  {cockpit.news2Trend.map((p, i) => (
                    <div key={i} className="flex flex-col items-center flex-1">
                      <div
                        className={`w-full rounded-t ${p.score >= 7 ? 'bg-neutral-800' : p.score >= 5 ? 'bg-neutral-600' : p.score >= 3 ? 'bg-neutral-400' : 'bg-neutral-300'}`}
                        style={{ height: `${Math.max(4, (p.score / 12) * 70)}px` }}
                      />
                      <div className="text-[9px] text-neutral-500 mt-1">{p.date}</div>
                      <div className="text-[9px] font-bold text-neutral-900">{p.score}</div>
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
                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider mb-3">Equipe Atual</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cockpit.careTeam.filter(m => m.isActive).map((member, i) => (
                    <div key={i} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-900 flex items-center justify-center text-sm font-bold shrink-0 border border-neutral-300">
                        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-neutral-900">{member.name}</div>
                        <div className="text-xs text-neutral-500">{member.role}{member.specialty ? ` — ${member.specialty}` : ''}</div>
                        <div className="text-xs text-neutral-500 mt-1">Desde: {member.since}{member.contact ? ` | ${member.contact}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Previous team */}
              {cockpit.careTeam.filter(m => !m.isActive).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-3">Equipe Anterior</h3>
                  <div className="space-y-2">
                    {cockpit.careTeam.filter(m => !m.isActive).map((member, i) => (
                      <div key={i} className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 opacity-70">
                        <span className="text-sm font-semibold text-neutral-700">{member.name}</span>
                        <span className="text-xs text-neutral-500 ml-2">{member.role} ({member.since} a {member.until})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Handoff history */}
              <div>
                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider mb-3">Historico de Handoffs — Chain of Custody</h3>
                <div className="space-y-2">
                  {cockpit.handoffs.map((h, i) => (
                    <div key={i} className="bg-neutral-100 border border-neutral-300 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-neutral-500">{h.timestamp}</span>
                        <span className="text-xs font-bold text-neutral-900">{h.from} {'\u2192'} {h.to}</span>
                      </div>
                      <div className="text-sm text-neutral-700">{h.summary}</div>
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
                  evolucao: 'Evolucao', resumo_alta: 'Resumo de Alta',
                  consentimento: 'Consentimento', prescricao: 'Prescricao', laudo: 'Laudo',
                };
                const statusColors: Record<string, string> = {
                  rascunho: 'bg-neutral-100 text-neutral-900 border border-neutral-300',
                  finalizado: 'bg-neutral-100 text-neutral-900 border border-neutral-300',
                  assinado: 'bg-neutral-100 text-neutral-900 border border-neutral-300',
                };
                return (
                  <div key={doc.id} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-neutral-900">{doc.title}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">{typeLabels[doc.type] || doc.type} &middot; {doc.author} &middot; {doc.date}</div>
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
              <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider mb-3">Trilha de Auditoria — Quem acessou, quando, o que fez</h3>
              {cockpit.auditTrail.map((entry, i) => (
                <div key={i} className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 flex items-start gap-3">
                  <span className="text-xs font-mono text-neutral-500 shrink-0 w-28">{entry.timestamp}</span>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-neutral-900">{entry.actor}</span>
                    <span className="text-xs text-neutral-500 ml-2">{entry.action}</span>
                    <div className="text-xs text-neutral-500 mt-0.5">{entry.details}</div>
                  </div>
                </div>
              ))}
              <div className="text-xs text-neutral-500 mt-4 text-right">
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
