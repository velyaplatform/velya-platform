'use client';

import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import { ALERTS, type CriticalAlert } from '../../lib/fixtures/alerts';

const SEVERITY_BADGE: Record<CriticalAlert['severity'], string> = {
  critical: 'bg-neutral-100 text-neutral-900 border-neutral-300',
  high: 'bg-neutral-50 text-neutral-900 border-neutral-300',
};

export default function AlertsPage() {
  return (
    <AppShell pageTitle="Alertas Críticos">
      <div className="page-header">
        <h1 className="page-title">Alertas Críticos Ativos</h1>
        <p className="page-subtitle">
          {ALERTS.length} alertas exigindo ação humana — atribuídos por papel
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {ALERTS.map((alert) => (
          <article
            key={alert.id}
            className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col md:flex-row md:items-start gap-4"
          >
            <div className="md:w-32 shrink-0">
              <span
                className={`inline-block text-[10px] px-2 py-1 rounded-full border font-bold uppercase tracking-wider ${SEVERITY_BADGE[alert.severity]}`}
              >
                {alert.severity === 'critical' ? 'Crítico' : 'Alto'}
              </span>
              <div className="text-[11px] text-neutral-500 mt-2 font-mono">{alert.id}</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">{alert.triggeredAt}</div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-neutral-900">{alert.title}</h2>
              <p className="text-sm text-neutral-700 mt-1">{alert.body}</p>
              <div className="text-xs text-neutral-500 mt-2">
                Origem: <span className="font-mono text-neutral-700">{alert.source}</span>
              </div>
              <div className="text-xs text-neutral-500">
                Responsável: <strong className="text-neutral-900">{alert.ownerRole}</strong>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <Link
                href={alert.actionRoute}
                className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
              >
                Tratar →
              </Link>
              <button
                type="button"
                className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
              >
                Reconhecer
              </button>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
