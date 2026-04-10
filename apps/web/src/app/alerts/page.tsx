'use client';

import Link from 'next/link';
import { AppShell } from '../components/app-shell';

interface CriticalAlert {
  id: string;
  severity: 'critical' | 'high';
  title: string;
  body: string;
  source: string;
  triggeredAt: string;
  patientMrn?: string;
  ownerRole: string;
  actionRoute: string;
}

const ALERTS: CriticalAlert[] = [
  {
    id: 'ALERT-001',
    severity: 'critical',
    title: 'Sepse — escalada NEWS2',
    body: 'Sofia Andrade (MRN-013) com NEWS2 7. Necessita avaliação médica imediata.',
    source: 'clinical-triage-agent',
    triggeredAt: '2026-04-09 09:42',
    patientMrn: 'MRN-013',
    ownerRole: 'Médico Plantonista',
    actionRoute: '/patients/MRN-013',
  },
  {
    id: 'ALERT-002',
    severity: 'critical',
    title: 'Alta bloqueada > 24h',
    body: 'Eleanor Voss (MRN-004) com transporte e documentação pendentes desde 08:00.',
    source: 'discharge-coordinator-agent',
    triggeredAt: '2026-04-09 08:00',
    patientMrn: 'MRN-004',
    ownerRole: 'Planejador de Alta',
    actionRoute: '/patients/MRN-004',
  },
  {
    id: 'ALERT-003',
    severity: 'critical',
    title: 'Reconciliação medicamentosa falhou',
    body: 'Falha de validação PHI em MRN-006. Erro precisa ser revisto pela farmácia.',
    source: 'medication-reconciliation-agent',
    triggeredAt: '2026-04-09 08:55',
    patientMrn: 'MRN-006',
    ownerRole: 'Farmacêutico',
    actionRoute: '/pharmacy',
  },
  {
    id: 'ALERT-004',
    severity: 'critical',
    title: 'Pré-autorização atrasada',
    body: 'Marcus Bell (MRN-007) com pré-autorização pendente há 48h. Escalada para humano.',
    source: 'insurance-auth-agent',
    triggeredAt: '2026-04-08 08:30',
    patientMrn: 'MRN-007',
    ownerRole: 'Equipe Administrativa',
    actionRoute: '/patients/MRN-007',
  },
  {
    id: 'ALERT-005',
    severity: 'high',
    title: 'Farmácia bloqueia 3 altas',
    body: 'Ausência de liberação farmacêutica em MRN-011, MRN-018, MRN-022.',
    source: 'discharge-coordinator-agent',
    triggeredAt: '2026-04-09 09:30',
    ownerRole: 'Farmacêutico',
    actionRoute: '/pharmacy',
  },
];

const SEVERITY_BADGE: Record<CriticalAlert['severity'], string> = {
  critical: 'bg-red-900/40 text-red-200 border-red-700/60',
  high: 'bg-amber-900/40 text-amber-200 border-amber-700/60',
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
            className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col md:flex-row md:items-start gap-4"
          >
            <div className="md:w-32 shrink-0">
              <span
                className={`inline-block text-[10px] px-2 py-1 rounded-full border font-bold uppercase tracking-wider ${SEVERITY_BADGE[alert.severity]}`}
              >
                {alert.severity === 'critical' ? 'Crítico' : 'Alto'}
              </span>
              <div className="text-[11px] text-slate-300 mt-2 font-mono">{alert.id}</div>
              <div className="text-[11px] text-slate-300 mt-0.5">{alert.triggeredAt}</div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-slate-100">{alert.title}</h2>
              <p className="text-sm text-slate-200 mt-1">{alert.body}</p>
              <div className="text-xs text-slate-300 mt-2">
                Origem: <span className="font-mono text-blue-300">{alert.source}</span>
              </div>
              <div className="text-xs text-slate-300">
                Responsável: <strong className="text-slate-100">{alert.ownerRole}</strong>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <Link
                href={alert.actionRoute}
                className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                Tratar →
              </Link>
              <button
                type="button"
                className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-md bg-slate-800 border border-slate-600 text-slate-100 hover:bg-slate-700 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
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
