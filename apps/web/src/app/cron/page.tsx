'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../components/app-shell';
import { Breadcrumbs } from '../components/breadcrumbs';

interface CronRun {
  id: string;
  jobId: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'success' | 'partial' | 'failed';
  durationMs?: number;
  summary?: string;
  findingsCount: number;
}

interface CronJobInfo {
  id: string;
  label: string;
  description: string;
  surface: string;
  cron: string;
  intervalMs: number | null;
  worstSeverity: string;
  autoCorrectAllowed: boolean;
  lastRun: CronRun | null;
}

interface SchedulerStatus {
  started: boolean;
  startedAt?: string;
  jobsScheduled: number;
  inFlight: string[];
}

interface CronFinding {
  id: string;
  jobId: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  surface: string;
  target: string;
  message: string;
  suggestion?: string;
  status:
    | 'new'
    | 'shadow-recommendation-ready'
    | 'in-review'
    | 'resolved-auto'
    | 'resolved-manual'
    | 'dismissed';
  createdAt: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-neutral-50 text-neutral-700 border-neutral-300',
  low: 'bg-neutral-100 text-neutral-900 border-neutral-300/60',
  medium: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  high: 'bg-neutral-200 text-neutral-900 border-neutral-300',
  critical: 'bg-neutral-200 text-neutral-900 border-neutral-300',
};

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-neutral-100 text-neutral-900 border-neutral-300/60',
  'shadow-recommendation-ready': 'bg-neutral-100 text-neutral-700 border-neutral-300',
  'in-review': 'bg-neutral-100 text-neutral-700 border-neutral-300',
  'resolved-auto': 'bg-neutral-50 text-neutral-900 border-neutral-300',
  'resolved-manual': 'bg-neutral-50 text-neutral-900 border-neutral-300',
  dismissed: 'bg-neutral-50 text-neutral-500 border-neutral-200',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'Novo',
  'shadow-recommendation-ready': 'Recomendação pronta',
  'in-review': 'Em revisão',
  'resolved-auto': 'Resolvido (auto)',
  'resolved-manual': 'Resolvido manual',
  dismissed: 'Descartado',
};

const RUN_STATUS_COLOR: Record<string, string> = {
  running: 'text-neutral-700',
  success: 'text-neutral-700',
  partial: 'text-neutral-500',
  failed: 'text-neutral-700',
};

export default function CronDashboardPage() {
  const [tab, setTab] = useState<'jobs' | 'findings'>('findings');
  const [jobs, setJobs] = useState<CronJobInfo[]>([]);
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [findings, setFindings] = useState<CronFinding[]>([]);
  const [findingsFilter, setFindingsFilter] = useState<'open' | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  async function loadJobs() {
    try {
      const res = await fetch('/api/cron/jobs', { credentials: 'same-origin' });
      if (!res.ok) {
        setError(`Erro ${res.status}`);
        return;
      }
      const data = (await res.json()) as { jobs: CronJobInfo[]; scheduler: SchedulerStatus };
      setJobs(data.jobs);
      setScheduler(data.scheduler);
      setError(null);
    } catch {
      setError('Erro de rede');
    }
  }

  async function loadFindings() {
    try {
      const params = new URLSearchParams();
      if (findingsFilter === 'open') params.set('status', 'new');
      const res = await fetch(`/api/cron/findings?${params.toString()}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items: CronFinding[] };
      setFindings(data.items);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([loadJobs(), loadFindings()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void loadFindings();
  }, [findingsFilter]);

  async function runJob(jobId: string) {
    setBusyJobId(jobId);
    try {
      const res = await fetch(`/api/cron/run/${encodeURIComponent(jobId)}`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        setError(`Erro ao executar ${jobId}: ${res.status}`);
        return;
      }
      await Promise.all([loadJobs(), loadFindings()]);
    } finally {
      setBusyJobId(null);
    }
  }

  async function patchFinding(id: string, action: 'dismiss' | 'resolve-manual' | 'promote') {
    try {
      await fetch('/api/cron/findings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ findingId: id, action }),
      });
      await loadFindings();
    } catch {
      // ignore
    }
  }

  async function toggleScheduler() {
    if (!scheduler) return;
    const method = scheduler.started ? 'DELETE' : 'POST';
    await fetch('/api/cron/start', { method, credentials: 'same-origin' });
    await loadJobs();
  }

  // KPIs
  const totalFindings = findings.length;
  const criticalCount = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high',
  ).length;
  const inReviewCount = findings.filter(
    (f) => f.status === 'in-review' || f.status === 'shadow-recommendation-ready',
  ).length;
  const activeJobs = scheduler?.started ? scheduler.jobsScheduled : 0;

  return (
    <AppShell pageTitle="Cron + Agente Autônomo">
      <Breadcrumbs
        crumbs={[
          { label: 'Início', href: '/' },
          { label: 'Administração' },
          { label: 'Cron + Agente', current: true },
        ]}
      />

      <div className="mb-6">
        <h1 className="page-title">
          Cron + Agente Autônomo
        </h1>
        <p className="page-subtitle">Shadow mode. Recomenda, nunca aplica sem humano.</p>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-neutral-100 border border-neutral-300 text-neutral-900 rounded-md px-4 py-3 mb-4 text-sm"
        >
          {error}
        </div>
      )}

      {/* KPIs grandes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Total findings"
          value={String(totalFindings)}
          tone="neutral"
          hint="na visão atual"
        />
        <KpiCard
          label="Críticos"
          value={String(criticalCount)}
          tone={criticalCount > 0 ? 'alert' : 'ok'}
          hint={criticalCount > 0 ? 'requer atenção' : 'tudo limpo'}
        />
        <KpiCard
          label="Em revisão"
          value={String(inReviewCount)}
          tone={inReviewCount > 0 ? 'watch' : 'neutral'}
          hint="aguardando humano"
        />
        <KpiCard
          label="Jobs ativos"
          value={String(activeJobs)}
          tone={scheduler?.started ? 'ok' : 'neutral'}
          hint={scheduler?.started ? 'scheduler on' : 'scheduler off'}
        />
      </div>

      {/* Scheduler toggle */}
      {scheduler && (
        <div className="flex justify-end mb-5">
          <button
            type="button"
            onClick={toggleScheduler}
            className={`min-h-[40px] inline-flex items-center px-4 py-2 rounded-full text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-neutral-200 transition-colors ${
              scheduler.started
                ? 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                : 'bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800'
            }`}
          >
            {scheduler.started
              ? `Parar scheduler (${scheduler.jobsScheduled})`
              : 'Iniciar scheduler'}
          </button>
        </div>
      )}

      {/* Tabs como filter chips */}
      <div role="tablist" className="flex flex-wrap gap-2 mb-5">
        <FilterChip
          active={tab === 'findings'}
          onClick={() => setTab('findings')}
          label="Findings"
          count={findings.length}
          role="tab"
        />
        <FilterChip
          active={tab === 'jobs'}
          onClick={() => setTab('jobs')}
          label="Jobs"
          count={jobs.length}
          role="tab"
        />
      </div>

      {loading && <p className="text-neutral-500">Carregando...</p>}

      {!loading && tab === 'jobs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {jobs.map((job) => (
            <article
              key={job.id}
              className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors"
            >
              <header className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-neutral-900 truncate">{job.label}</h3>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 mt-0.5 font-mono">
                    {job.id}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded-full border ${SEVERITY_BADGE[job.worstSeverity] ?? SEVERITY_BADGE.info}`}
                >
                  {job.worstSeverity}
                </span>
              </header>

              <p className="text-xs text-neutral-500 leading-snug mb-3 line-clamp-3">
                {job.description}
              </p>

              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-[10px] text-neutral-500">
                <span>
                  cron <code className="text-neutral-700">{job.cron}</code>
                </span>
                <span>
                  surface <code className="text-neutral-700">{job.surface}</code>
                </span>
              </div>

              {job.lastRun && (
                <div className="text-[10px] text-neutral-500 mb-3 pb-3 border-b border-neutral-200/60">
                  <span
                    className={`font-bold ${RUN_STATUS_COLOR[job.lastRun.status] ?? 'text-neutral-700'}`}
                  >
                    {job.lastRun.status}
                  </span>
                  {' · '}
                  {job.lastRun.findingsCount} achado(s)
                  {' · '}
                  {new Date(job.lastRun.startedAt).toLocaleString('pt-BR')}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => runJob(job.id)}
                  disabled={busyJobId === job.id}
                  className="text-[11px] font-bold px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-60"
                >
                  {busyJobId === job.id ? 'Executando...' : 'Executar agora'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && tab === 'findings' && (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            <FilterChip
              active={findingsFilter === 'open'}
              onClick={() => setFindingsFilter('open')}
              label="Apenas abertos"
            />
            <FilterChip
              active={findingsFilter === 'all'}
              onClick={() => setFindingsFilter('all')}
              label="Todos"
            />
          </div>

          {findings.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-sm text-neutral-500">
              Nenhum finding {findingsFilter === 'open' ? 'aberto ' : ''}no momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {findings.map((f) => (
                <article
                  key={f.id}
                  className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors"
                >
                  <header className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${SEVERITY_BADGE[f.severity]}`}
                    >
                      {f.severity}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_BADGE[f.status]}`}
                    >
                      {STATUS_LABEL[f.status]}
                    </span>
                    <span className="text-[10px] text-neutral-500 ml-auto">
                      {new Date(f.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </header>

                  <p className="text-sm text-neutral-900 leading-snug line-clamp-3 mb-2">
                    {f.message}
                  </p>

                  <p
                    className="text-[10px] text-neutral-500 font-mono truncate mb-3"
                    title={f.target}
                  >
                    {f.surface} · {f.target}
                  </p>

                  {f.suggestion && (
                    <details className="mb-3">
                      <summary className="text-[11px] text-neutral-700 cursor-pointer hover:text-neutral-900 font-semibold">
                        Recomendação (shadow)
                      </summary>
                      <p className="text-[11px] text-neutral-700 mt-2 bg-neutral-100 border border-neutral-300/40 rounded-md p-2 whitespace-pre-wrap">
                        {f.suggestion}
                      </p>
                    </details>
                  )}

                  {(f.status === 'new' || f.status === 'shadow-recommendation-ready') && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-200">
                      <button
                        type="button"
                        onClick={() => patchFinding(f.id, 'resolve-manual')}
                        className="text-[11px] font-bold px-3 py-1.5 rounded bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                      >
                        Resolver
                      </button>
                      <button
                        type="button"
                        onClick={() => patchFinding(f.id, 'promote')}
                        className="text-[11px] font-bold px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-neutral-200"
                      >
                        Promover
                      </button>
                      <button
                        type="button"
                        onClick={() => patchFinding(f.id, 'dismiss')}
                        className="text-[11px] font-bold px-3 py-1.5 rounded bg-neutral-50 border border-neutral-300 text-neutral-700 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
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
  role,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  role?: 'tab';
}) {
  return (
    <button
      type="button"
      role={role}
      onClick={onClick}
      aria-pressed={role ? undefined : active}
      aria-selected={role === 'tab' ? active : undefined}
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
