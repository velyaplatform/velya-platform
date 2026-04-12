'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../components/app-shell';
import { Breadcrumbs } from '../components/breadcrumbs';

interface AgentScorecard {
  validationPassRate: number;
  auditPassRate: number;
  evidenceCompleteness: number;
  slaAdherence: number;
  correctionRecurrence: number;
  updatedAt: string;
}

interface AgentState {
  agentId: string;
  stage: string;
  quarantined: boolean;
  quarantineReason?: string;
  lastRunAt?: string;
  runCount: number;
  scorecard: AgentScorecard;
  updatedAt: string;
}

interface AgentDef {
  id: string;
  fullName: string;
  office: string;
  role: string;
  charter: string;
  ownedJobIds: string[];
  allowedActions: { type: string; riskClass: string }[];
  lifecycleStage: string;
  validatorIds: string[];
  auditorId: string;
  watchdogId: string;
  ownerEmail: string;
  worstSeverity: string;
  killSwitchEnv: string;
  state?: AgentState;
}

interface OfficeTopology {
  office: string;
  agents: AgentDef[];
  jobCoverage: number;
}

interface ApiResponse {
  topology: OfficeTopology[];
  agents: AgentDef[];
  labels: {
    office: Record<string, string>;
    stage: Record<string, string>;
  };
}

const OFFICE_ICON: Record<string, string> = {
  quality: 'Q',
  security: 'S',
  data: 'D',
  ux: 'UX',
  learning: 'L',
  observability: 'O',
};

const STAGE_COLOR: Record<string, string> = {
  draft: 'bg-neutral-100/50 text-neutral-700 border-neutral-300',
  sandbox: 'bg-neutral-50 text-neutral-700 border-neutral-300',
  shadow: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  probation: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  active: 'bg-neutral-50 text-neutral-900 border-neutral-300',
  deprecated: 'bg-neutral-50 text-neutral-500 border-neutral-300',
  retired: 'bg-white text-neutral-500 border-neutral-200',
};

const RISK_COLOR: Record<string, string> = {
  safe: 'bg-neutral-50 text-neutral-900 border-neutral-200',
  review: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  critical: 'bg-neutral-200 text-neutral-900 border-neutral-300',
};

function scoreColor(value: number): string {
  if (value >= 0.9) return 'text-neutral-700';
  if (value >= 0.75) return 'text-neutral-700';
  if (value >= 0.6) return 'text-neutral-700';
  return 'text-neutral-700';
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default function AgentsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedOffice, setSelectedOffice] = useState<string>('all');

  async function load() {
    try {
      const res = await fetch('/api/agents', { credentials: 'same-origin' });
      if (!res.ok) {
        setError(`Erro ${res.status}`);
        return;
      }
      setData((await res.json()) as ApiResponse);
      setError(null);
    } catch {
      setError('Erro de rede');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function patchAgent(agentId: string, body: Record<string, unknown>) {
    setBusyId(agentId);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        setError(e.error ?? `Erro ${res.status}`);
        return;
      }
      await load();
    } catch {
      setError('Erro de rede');
    } finally {
      setBusyId(null);
    }
  }

  const offices = data?.topology ?? [];
  const visibleOffices =
    selectedOffice === 'all' ? offices : offices.filter((o) => o.office === selectedOffice);

  // Aggregate KPIs
  const allAgents = data?.agents ?? [];
  const totalAgents = allAgents.length;
  const activeCount = allAgents.filter((a) => a.state?.stage === 'active').length;
  const shadowCount = allAgents.filter((a) => a.state?.stage === 'shadow').length;
  const quarantinedCount = allAgents.filter((a) => a.state?.quarantined).length;

  return (
    <AppShell pageTitle="Agentes">
      <Breadcrumbs
        crumbs={[
          { label: 'Início', href: '/' },
          { label: 'Agentes', current: true },
        ]}
      />

      {/* Hero — minimal, ícone grande, frase curta */}
      <div className="mb-6">
        <h1 className="page-title">
          Frota de agentes Velya
        </h1>
        <p className="page-subtitle">
          Cinco escritórios. Um propósito: manter a plataforma viva sozinha.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-neutral-100 border border-neutral-300 text-neutral-900 rounded-md px-4 py-3 mb-4 text-sm"
        >
          {error}
        </div>
      )}

      {/* KPIs grandes — pouco texto, muito impacto */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Total"
          value={String(totalAgents)}
          tone="neutral"
          hint="agentes registrados"
        />
        <KpiCard label="Ativos" value={String(activeCount)} tone="ok" hint="executando autônomo" />
        <KpiCard label="Shadow" value={String(shadowCount)} tone="watch" hint="só recomendam" />
        <KpiCard
          label="Quarentena"
          value={String(quarantinedCount)}
          tone={quarantinedCount > 0 ? 'alert' : 'ok'}
          hint={quarantinedCount > 0 ? 'requer ação' : 'tudo limpo'}
        />
      </div>

      {/* Filtro de escritórios */}
      <div className="flex flex-wrap gap-2 mb-5">
        <FilterChip
          active={selectedOffice === 'all'}
          onClick={() => setSelectedOffice('all')}
          label="Todos"
        />
        {offices.map((o) => (
          <FilterChip
            key={o.office}
            active={selectedOffice === o.office}
            onClick={() => setSelectedOffice(o.office)}
            label={`${OFFICE_ICON[o.office] ?? ''} ${data?.labels.office[o.office] ?? o.office}`}
            count={o.agents.length}
          />
        ))}
      </div>

      {loading && <p className="text-neutral-500">Carregando...</p>}

      {/* Cards por escritório */}
      <div className="space-y-6">
        {visibleOffices.map((office) => (
          <section
            key={office.office}
            aria-labelledby={`office-${office.office}-h`}
            className="bg-white border border-neutral-200 rounded-xl p-5"
          >
            <header className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 id={`office-${office.office}-h`} className="text-lg font-bold text-neutral-900">
                <span aria-hidden="true">{OFFICE_ICON[office.office]}</span>{' '}
                {data?.labels.office[office.office] ?? office.office}
              </h2>
              <p className="text-xs text-neutral-500">
                {office.agents.length} agente(s) · {office.jobCoverage} job(s)
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {office.agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  busy={busyId === agent.id}
                  onPromote={(stage) => patchAgent(agent.id, { action: 'promote', stage })}
                  onQuarantine={() =>
                    patchAgent(agent.id, {
                      action: 'quarantine',
                      reason: 'Quarentena manual via /agents',
                    })
                  }
                  onRelease={() => patchAgent(agent.id, { action: 'release' })}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Sub-components — kept tiny on purpose. Less ink, more contrast.
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'neutral' | 'ok' | 'watch' | 'alert';
}) {
  const toneClass: Record<typeof tone, string> = {
    neutral: 'bg-white border-neutral-200',
    ok: 'bg-neutral-50 border-neutral-300',
    watch: 'bg-neutral-100 border-neutral-300',
    alert: 'bg-neutral-100 border-neutral-300',
  };
  return (
    <div className={`rounded-xl border ${toneClass[tone]} px-4 py-4`}>
      <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</p>
      <p className="text-3xl font-extrabold text-neutral-900 mt-1 leading-none">{value}</p>
      <p className="text-xs text-neutral-500 mt-2">{hint}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[40px] px-3 py-2 rounded-full text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-neutral-200 transition-colors ${
        active
          ? 'bg-neutral-900 text-white border-neutral-700'
          : 'bg-neutral-50 text-neutral-700 border-neutral-300 hover:bg-neutral-100'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1.5 text-[10px] ${active ? 'text-neutral-500' : 'text-neutral-500'}`}>
          ({count})
        </span>
      )}
    </button>
  );
}

function AgentCard({
  agent,
  busy,
  onPromote,
  onQuarantine,
  onRelease,
}: {
  agent: AgentDef;
  busy: boolean;
  onPromote: (stage: string) => void;
  onQuarantine: () => void;
  onRelease: () => void;
}) {
  const stage = agent.state?.stage ?? agent.lifecycleStage;
  const sc = agent.state?.scorecard;
  const next: Record<string, string | null> = {
    draft: 'sandbox',
    sandbox: 'shadow',
    shadow: 'probation',
    probation: 'active',
    active: null,
    deprecated: null,
    retired: null,
  };
  const nextStage = next[stage] ?? null;

  return (
    <article className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors">
      <header className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-neutral-900 truncate">{agent.fullName}</h3>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 mt-0.5">{agent.role}</p>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-1 rounded-full border ${STAGE_COLOR[stage] ?? STAGE_COLOR.draft}`}
        >
          {stage}
        </span>
      </header>

      <p className="text-xs text-neutral-500 leading-snug mb-3 line-clamp-3">{agent.charter}</p>

      {/* Scorecard mini-bars */}
      {sc && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-3 text-[10px]">
          <ScoreRow label="Validação" value={sc.validationPassRate} />
          <ScoreRow label="Auditoria" value={sc.auditPassRate} />
          <ScoreRow label="Evidência" value={sc.evidenceCompleteness} />
          <ScoreRow label="SLA" value={sc.slaAdherence} />
        </div>
      )}

      {/* Allowed actions */}
      {agent.allowedActions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {agent.allowedActions.map((a) => (
            <span
              key={a.type}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${RISK_COLOR[a.riskClass] ?? RISK_COLOR.review}`}
              title={`Classe de risco: ${a.riskClass}`}
            >
              {a.type}
            </span>
          ))}
        </div>
      )}

      {agent.state?.quarantined && (
        <div className="bg-neutral-100 border border-neutral-300 rounded p-2 mb-3">
          <p className="text-[11px] text-neutral-900 font-semibold">Em quarentena</p>
          {agent.state.quarantineReason && (
            <p className="text-[10px] text-neutral-700 mt-0.5">{agent.state.quarantineReason}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-200">
        {nextStage && (
          <button
            type="button"
            onClick={() => onPromote(nextStage)}
            disabled={busy}
            className="text-[11px] font-bold px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-60"
          >
            ↑ Promover para {nextStage}
          </button>
        )}
        {agent.state?.quarantined ? (
          <button
            type="button"
            onClick={onRelease}
            disabled={busy}
            className="text-[11px] font-bold px-3 py-1.5 rounded bg-neutral-100 hover:bg-neutral-50 text-white focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-60"
          >
            Liberar
          </button>
        ) : (
          <button
            type="button"
            onClick={onQuarantine}
            disabled={busy}
            className="text-[11px] font-bold px-3 py-1.5 rounded bg-neutral-100 hover:bg-neutral-50 text-white focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-60"
          >
            Quarentena
          </button>
        )}
      </div>

      <p className="text-[10px] text-neutral-500 mt-2">
        Kill-switch:{' '}
        <code className="bg-white px-1 rounded text-neutral-500">{agent.killSwitchEnv}</code>
      </p>
    </article>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-neutral-500 w-16">{label}</span>
      <div className="flex-1 h-1 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${
            value >= 0.9
              ? 'bg-neutral-900'
              : value >= 0.75
                ? 'bg-neutral-700'
                : value >= 0.6
                  ? 'bg-neutral-500'
                  : 'bg-neutral-900'
          }`}
          style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
        />
      </div>
      <span className={`font-bold ${scoreColor(value)} w-8 text-right`}>{pct(value)}</span>
    </div>
  );
}
