'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import type { Delegation, DelegationStatus } from '@/lib/delegation-store';

const STATUS_BADGE: Record<DelegationStatus, string> = {
  open: 'bg-neutral-100 text-neutral-900 border-neutral-300',
  acknowledged: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  'in-progress': 'bg-neutral-100 text-neutral-700 border-neutral-300',
  blocked: 'bg-neutral-100 text-neutral-900 border-neutral-300',
  completed: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  declined: 'bg-neutral-50 text-neutral-500 border-neutral-300',
  cancelled: 'bg-neutral-50 text-neutral-500 border-neutral-200',
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
  urgent: 'bg-neutral-100 text-neutral-900 border-neutral-300',
  high: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  normal: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  low: 'bg-neutral-50 text-neutral-500 border-neutral-300',
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
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-700 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-neutral-200"
          >
            + Delegar nova tarefa
          </Link>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Filtro de delegações"
        className="flex gap-2 mb-5 border-b border-neutral-200"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'inbox'}
          onClick={() => setTab('inbox')}
          className={`min-h-[44px] px-4 py-2 text-sm font-semibold border-b-2 -mb-px focus:outline-none focus:ring-2 focus:ring-neutral-200 ${
            tab === 'inbox'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Recebidas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sent'}
          onClick={() => setTab('sent')}
          className={`min-h-[44px] px-4 py-2 text-sm font-semibold border-b-2 -mb-px focus:outline-none focus:ring-2 focus:ring-neutral-200 ${
            tab === 'sent'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Enviadas
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-neutral-50 border border-neutral-300 text-neutral-900 rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-neutral-500">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <p className="text-neutral-500 text-sm">
            {tab === 'inbox'
              ? 'Você não tem delegações recebidas no momento.'
              : 'Você ainda não delegou nenhuma tarefa.'}
          </p>
          {tab === 'sent' && (
            <Link
              href="/delegations/new"
              className="inline-block mt-4 min-h-[44px] px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-700 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-neutral-200"
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
                className="block bg-white border border-neutral-200 rounded-xl p-4 hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
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
                      <span className="text-xs text-neutral-500 font-mono">{d.id}</span>
                    </div>
                    <h2 className="text-base font-bold text-neutral-900">{d.title}</h2>
                    <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{d.description}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 mt-2">
                      <span>
                        De: <strong className="text-neutral-700">{d.createdByName}</strong>
                      </span>
                      <span>
                        Para: <strong className="text-neutral-700">{d.assignedToName}</strong>
                      </span>
                      {d.patientMrn && (
                        <span>
                          Paciente:{' '}
                          <span className="font-mono text-neutral-700">{d.patientMrn}</span>
                        </span>
                      )}
                      {d.dueAt && (
                        <span className="text-neutral-700">
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
