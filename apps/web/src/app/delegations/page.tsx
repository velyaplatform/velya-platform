'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import type { Delegation, DelegationStatus } from '@/lib/delegation-store';

const STATUS_BADGE: Record<DelegationStatus, string> = {
  open: 'bg-blue-900/40 text-blue-200 border-blue-700/60',
  acknowledged: 'bg-cyan-900/40 text-cyan-200 border-cyan-700/60',
  'in-progress': 'bg-amber-900/40 text-amber-200 border-amber-700/60',
  blocked: 'bg-red-900/40 text-red-200 border-red-700/60',
  completed: 'bg-green-900/40 text-green-200 border-green-700/60',
  declined: 'bg-slate-800 text-slate-300 border-slate-600',
  cancelled: 'bg-slate-800 text-slate-400 border-slate-700',
};

const STATUS_LABEL: Record<DelegationStatus, string> = {
  open: 'Aberta',
  acknowledged: 'Ciente',
  'in-progress': 'Em andamento',
  blocked: 'Bloqueada',
  completed: 'Concluída',
  declined: 'Recusada',
  cancelled: 'Cancelada',
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-900/40 text-red-200 border-red-700/60',
  high: 'bg-amber-900/40 text-amber-200 border-amber-700/60',
  normal: 'bg-blue-900/40 text-blue-200 border-blue-700/60',
  low: 'bg-slate-800 text-slate-300 border-slate-600',
};

export default function DelegationsPage() {
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [items, setItems] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (tab === 'inbox') params.set('inbox', 'true');
    if (tab === 'sent') params.set('sent', 'true');
    fetch(`/api/delegations?${params.toString()}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          setError('Não foi possível carregar as delegações.');
          return;
        }
        const data = (await res.json()) as { items: Delegation[] };
        setItems(data.items);
      })
      .catch(() => setError('Erro de rede.'))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <AppShell pageTitle="Delegações">
      <div className="page-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="page-title">Delegações de Tarefas</h1>
            <p className="page-subtitle">
              Tarefas atribuídas entre profissionais — toda criação e mudança de status é
              auditada
            </p>
          </div>
          <Link
            href="/delegations/new"
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            + Delegar nova tarefa
          </Link>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Filtro de delegações"
        className="flex gap-2 mb-5 border-b border-slate-700"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'inbox'}
          onClick={() => setTab('inbox')}
          className={`min-h-[44px] px-4 py-2 text-sm font-semibold border-b-2 -mb-px focus:outline-none focus:ring-2 focus:ring-blue-300 ${
            tab === 'inbox'
              ? 'border-blue-400 text-blue-200'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Recebidas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sent'}
          onClick={() => setTab('sent')}
          className={`min-h-[44px] px-4 py-2 text-sm font-semibold border-b-2 -mb-px focus:outline-none focus:ring-2 focus:ring-blue-300 ${
            tab === 'sent'
              ? 'border-blue-400 text-blue-200'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Enviadas
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-red-950/40 border border-red-700 text-red-200 rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-300">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-slate-300 text-sm">
            {tab === 'inbox'
              ? 'Você não tem delegações recebidas no momento.'
              : 'Você ainda não delegou nenhuma tarefa.'}
          </p>
          {tab === 'sent' && (
            <Link
              href="/delegations/new"
              className="inline-block mt-4 min-h-[44px] px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Criar primeira delegação
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((d) => (
            <li key={d.id}>
              <Link
                href={`/delegations/${d.id}`}
                className="block bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${STATUS_BADGE[d.status]}`}
                      >
                        {STATUS_LABEL[d.status]}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${PRIORITY_BADGE[d.priority]}`}
                      >
                        {PRIORITY_LABEL[d.priority]}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">{d.id}</span>
                    </div>
                    <h2 className="text-base font-bold text-slate-100">{d.title}</h2>
                    <p className="text-sm text-slate-300 mt-1 line-clamp-2">{d.description}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
                      <span>
                        De: <strong className="text-slate-200">{d.createdByName}</strong>
                      </span>
                      <span>
                        Para: <strong className="text-slate-200">{d.assignedToName}</strong>
                      </span>
                      {d.patientMrn && (
                        <span>
                          Paciente:{' '}
                          <span className="font-mono text-blue-300">{d.patientMrn}</span>
                        </span>
                      )}
                      {d.dueAt && (
                        <span className="text-amber-200">
                          Prazo: {new Date(d.dueAt).toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
