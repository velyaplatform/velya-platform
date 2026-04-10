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
  info: 'bg-slate-800 text-slate-200 border-slate-600',
  low: 'bg-blue-900/40 text-blue-200 border-blue-700/60',
  medium: 'bg-amber-900/40 text-amber-200 border-amber-700/60',
  high: 'bg-orange-900/40 text-orange-200 border-orange-700/60',
  critical: 'bg-red-900/40 text-red-200 border-red-700/60',
};

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-900/40 text-blue-200 border-blue-700/60',
  'shadow-recommendation-ready': 'bg-purple-900/40 text-purple-200 border-purple-700/60',
  'in-review': 'bg-amber-900/40 text-amber-200 border-amber-700/60',
  'resolved-auto': 'bg-green-900/40 text-green-200 border-green-700/60',
  'resolved-manual': 'bg-green-900/40 text-green-200 border-green-700/60',
  dismissed: 'bg-slate-800 text-slate-400 border-slate-700',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'Novo',
  'shadow-recommendation-ready': 'Recomendação pronta',
  'in-review': 'Em revisão',
  'resolved-auto': 'Resolvido (auto)',
  'resolved-manual': 'Resolvido manual',
  dismissed: 'Descartado',
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

  return (
    <AppShell pageTitle="Cron + Agente Autônomo">
      <Breadcrumbs
        crumbs={[
          { label: 'Início', href: '/' },
          { label: 'Administração' },
          { label: 'Cron + Agente', current: true },
        ]}
      />
      <div className="page-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="page-title">
              <span aria-hidden="true">{'\u23F0'}</span> Cron + Agente Autônomo
            </h1>
            <p className="page-subtitle">
              Monitora frontend, backend, infra, dados, segurança e funções. O agente roda em{' '}
              <strong className="text-amber-300">SHADOW MODE</strong> — gera recomendações mas
              nunca aplica nada sem aprovação humana.
            </p>
          </div>
          {scheduler && (
            <button
              type="button"
              onClick={toggleScheduler}
              className={`min-h-[44px] inline-flex items-center px-4 py-2 rounded-md text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                scheduler.started
                  ? 'bg-amber-900/40 border border-amber-700 text-amber-100 hover:bg-amber-900/60'
                  : 'bg-blue-700 text-white hover:bg-blue-800'
              }`}
            >
              {scheduler.started
                ? `Parar scheduler (${scheduler.jobsScheduled} jobs)`
                : 'Iniciar scheduler in-process'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-red-950/40 border border-red-700 text-red-200 rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi label="Jobs registrados" value={jobs.length} />
        <Kpi label="Findings abertos" value={findings.filter((f) => f.status === 'new').length} accent="amber" />
        <Kpi
          label="Recomendações prontas"
          value={findings.filter((f) => f.status === 'shadow-recommendation-ready').length}
          accent="blue"
        />
        <Kpi label="Scheduler" value={scheduler?.started ? 1 : 0} accent={scheduler?.started ? 'green' : 'red'} />
      </div>

      <div role="tablist" className="flex gap-2 mb-5 border-b border-slate-700">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'findings'}
          onClick={() => setTab('findings')}
          className={`min-h-[44px] px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
            tab === 'findings'
              ? 'border-blue-400 text-blue-200'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Findings ({findings.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'jobs'}
          onClick={() => setTab('jobs')}
          className={`min-h-[44px] px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
            tab === 'jobs'
              ? 'border-blue-400 text-blue-200'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Jobs ({jobs.length})
        </button>
      </div>

      {loading && <p className="text-slate-300">Carregando...</p>}

      {!loading && tab === 'jobs' && (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-start justify-between gap-3 flex-wrap"
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-100">{job.label}</h3>
                <p className="text-xs text-slate-300 mt-1">{job.description}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] text-slate-400">
                  <span className="font-mono text-blue-300">{job.id}</span>
                  <span>·</span>
                  <span>cron: <code className="text-slate-200">{job.cron}</code></span>
                  <span>·</span>
                  <span>surface: <code className="text-slate-200">{job.surface}</code></span>
                  <span>·</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] ${SEVERITY_BADGE[job.worstSeverity]}`}
                  >
                    {job.worstSeverity}
                  </span>
                </div>
                {job.lastRun && (
                  <div className="text-xs text-slate-400 mt-2">
                    Última execução: {new Date(job.lastRun.startedAt).toLocaleString('pt-BR')} · status{' '}
                    <strong className="text-slate-200">{job.lastRun.status}</strong> ·{' '}
                    {job.lastRun.findingsCount} achado(s)
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => runJob(job.id)}
                disabled={busyJobId === job.id}
                className="min-h-[40px] inline-flex items-center px-3 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60 whitespace-nowrap"
              >
                {busyJobId === job.id ? 'Executando...' : 'Executar agora'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && tab === 'findings' && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setFindingsFilter('open')}
              aria-pressed={findingsFilter === 'open'}
              className={`min-h-[40px] px-4 py-2 rounded-md text-xs font-semibold border ${
                findingsFilter === 'open'
                  ? 'bg-blue-700 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'
              }`}
            >
              Apenas abertos
            </button>
            <button
              type="button"
              onClick={() => setFindingsFilter('all')}
              aria-pressed={findingsFilter === 'all'}
              className={`min-h-[40px] px-4 py-2 rounded-md text-xs font-semibold border ${
                findingsFilter === 'all'
                  ? 'bg-blue-700 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'
              }`}
            >
              Todos
            </button>
          </div>
          {findings.length === 0 ? (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center text-slate-300">
              Nenhum finding {findingsFilter === 'open' ? 'aberto ' : ''}no momento. Execute um
              job manualmente para gerar findings.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {findings.map((f) => (
                <li
                  key={f.id}
                  className="bg-slate-900 border border-slate-700 rounded-xl p-4"
                >
                  <div className="flex items-start gap-2 mb-2 flex-wrap">
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
                    <span className="text-[10px] text-slate-400 font-mono">{f.surface}</span>
                    <span className="text-[10px] text-slate-500 ml-auto">
                      {new Date(f.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-100">{f.message}</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">{f.target}</p>
                  {f.suggestion && (
                    <details className="mt-3">
                      <summary className="text-xs text-blue-300 cursor-pointer hover:text-blue-200">
                        Recomendação do agente (shadow mode)
                      </summary>
                      <p className="text-xs text-slate-200 mt-2 bg-blue-950/30 border border-blue-700/40 rounded-md p-3 whitespace-pre-wrap">
                        {f.suggestion}
                      </p>
                    </details>
                  )}
                  {(f.status === 'new' || f.status === 'shadow-recommendation-ready') && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => patchFinding(f.id, 'resolve-manual')}
                        className="min-h-[36px] px-3 py-1.5 rounded-md bg-green-900/40 border border-green-700 text-green-100 hover:bg-green-900/60 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-green-300"
                      >
                        Marcar como resolvido
                      </button>
                      <button
                        type="button"
                        onClick={() => patchFinding(f.id, 'promote')}
                        className="min-h-[36px] px-3 py-1.5 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        Promover (aplicar)
                      </button>
                      <button
                        type="button"
                        onClick={() => patchFinding(f.id, 'dismiss')}
                        className="min-h-[36px] px-3 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const accentClass =
    accent === 'blue'
      ? 'text-blue-300'
      : accent === 'green'
        ? 'text-green-300'
        : accent === 'amber'
          ? 'text-amber-300'
          : accent === 'red'
            ? 'text-red-300'
            : 'text-slate-100';
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
        {label}
      </div>
      <div className={`text-3xl font-bold mt-1 ${accentClass}`}>{value}</div>
    </div>
  );
}
