'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import type { Delegation, DelegationStatus } from '@/lib/delegation-store';

const STATUS_BADGE: Record<DelegationStatus, string> = {
  open: 'bg-neutral-100 text-neutral-900 border-neutral-300',
  acknowledged: 'bg-neutral-50 text-neutral-700 border-neutral-300',
  'in-progress': 'bg-neutral-50 text-neutral-700 border-neutral-300',
  blocked: 'bg-neutral-100 text-neutral-900 border-neutral-300',
  completed: 'bg-neutral-50 text-neutral-900 border-neutral-300',
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

const NEXT_STATUSES: Record<DelegationStatus, DelegationStatus[]> = {
  open: ['acknowledged', 'in-progress', 'declined', 'cancelled'],
  acknowledged: ['in-progress', 'declined', 'cancelled'],
  'in-progress': ['blocked', 'completed', 'cancelled'],
  blocked: ['in-progress', 'cancelled'],
  completed: [],
  declined: [],
  cancelled: [],
};

export default function DelegationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState('');

  function load() {
    fetch(`/api/delegations/${params.id}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (res.status === 404) {
          setError('Delegação não encontrada ou sem permissão.');
          return;
        }
        if (!res.ok) {
          setError(`Erro ${res.status} ao carregar delegação.`);
          return;
        }
        const data = (await res.json()) as { delegation: Delegation };
        setDelegation(data.delegation);
        setError(null);
      })
      .catch(() => setError('Erro de rede.'));
  }

  useEffect(() => {
    load();
  }, [params.id]);

  async function transition(toStatus: DelegationStatus) {
    if (!delegation) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/delegations/${delegation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status: toStatus, note: note || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Erro ${res.status}`);
        return;
      }
      setNote('');
      load();
    } catch {
      setError('Erro de rede ao atualizar status.');
    } finally {
      setUpdating(false);
    }
  }

  if (error) {
    return (
      <AppShell pageTitle="Delegação">
        <div role="alert" className="bg-neutral-50 border border-neutral-300 text-neutral-700 rounded-md px-4 py-3 mb-4">
          {error}
        </div>
        <Link
          href="/delegations"
          className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-900 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          ← Voltar às delegações
        </Link>
      </AppShell>
    );
  }

  if (!delegation) {
    return (
      <AppShell pageTitle="Delegação">
        <p className="text-neutral-500">Carregando...</p>
      </AppShell>
    );
  }

  const transitions = NEXT_STATUSES[delegation.status] ?? [];

  return (
    <AppShell pageTitle={delegation.title}>
      <div className="page-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-xs text-neutral-500">{delegation.id}</span>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${STATUS_BADGE[delegation.status]}`}
              >
                {STATUS_LABEL[delegation.status]}
              </span>
              <span className="text-xs text-neutral-500 uppercase tracking-wider">
                {delegation.priority}
              </span>
            </div>
            <h1 className="page-title">{delegation.title}</h1>
            <p className="page-subtitle">
              De <strong className="text-neutral-700">{delegation.createdByName}</strong> para{' '}
              <strong className="text-neutral-700">{delegation.assignedToName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/delegations')}
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
          >
            ← Voltar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <section
          aria-labelledby="desc-heading"
          className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl p-5"
        >
          <h2 id="desc-heading" className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-3">
            Descrição
          </h2>
          <p className="text-sm text-neutral-900 whitespace-pre-wrap mb-4">{delegation.description}</p>
          {delegation.acceptanceCriteria && (
            <>
              <h3 className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mt-4 mb-2">
                Critérios de aceitação
              </h3>
              <p className="text-sm text-neutral-900 whitespace-pre-wrap">
                {delegation.acceptanceCriteria}
              </p>
            </>
          )}
          {delegation.deliverables.length > 0 && (
            <>
              <h3 className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mt-4 mb-2">
                Entregáveis
              </h3>
              <ul className="text-sm text-neutral-900 list-disc list-inside space-y-1">
                {delegation.deliverables.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section
          aria-labelledby="meta-heading"
          className="bg-white border border-neutral-200 rounded-xl p-5"
        >
          <h2 id="meta-heading" className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-3">
            Metadados
          </h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Categoria</dt>
              <dd className="text-neutral-900">{delegation.category}</dd>
            </div>
            {delegation.dueAt && (
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">Prazo</dt>
                <dd className="text-neutral-700">
                  {new Date(delegation.dueAt).toLocaleString('pt-BR')}
                </dd>
              </div>
            )}
            {delegation.location && (
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">Local</dt>
                <dd className="text-neutral-900 text-right">{delegation.location}</dd>
              </div>
            )}
            {delegation.patientMrn && (
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">Paciente</dt>
                <dd>
                  <Link
                    href={`/patients/${delegation.patientMrn}`}
                    className="font-mono text-neutral-700 hover:text-neutral-900 underline"
                  >
                    {delegation.patientMrn}
                  </Link>
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Criada em</dt>
              <dd className="text-neutral-900">
                {new Date(delegation.createdAt).toLocaleString('pt-BR')}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Atualizada</dt>
              <dd className="text-neutral-900">
                {new Date(delegation.updatedAt).toLocaleString('pt-BR')}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Status transitions */}
      {transitions.length > 0 && (
        <section
          aria-labelledby="actions-heading"
          className="bg-white border border-neutral-200 rounded-xl p-5 mb-4"
        >
          <h2 id="actions-heading" className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-3">
            Ações
          </h2>
          <div className="flex flex-col gap-3">
            <label htmlFor="status-note" className="text-sm font-medium text-neutral-700">
              Comentário (opcional)
            </label>
            <textarea
              id="status-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200"
              placeholder="Ex: Iniciando avaliação às 14h"
            />
            <div className="flex flex-wrap gap-2">
              {transitions.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => transition(status)}
                  disabled={updating}
                  className="min-h-[44px] px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-900 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-60"
                >
                  {STATUS_LABEL[status]}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* History timeline */}
      <section
        aria-labelledby="history-heading"
        className="bg-white border border-neutral-200 rounded-xl p-5"
      >
        <h2 id="history-heading" className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-4">
          Histórico auditado
        </h2>
        <ol className="border-l border-neutral-200 ml-2 space-y-4">
          {delegation.history.map((entry, idx) => (
            <li key={idx} className="pl-4 relative">
              <span
                aria-hidden="true"
                className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-neutral-900 border-2 border-neutral-200"
              />
              <div className="text-xs text-neutral-500 font-mono">
                {new Date(entry.at).toLocaleString('pt-BR')}
              </div>
              <div className="text-sm text-neutral-900 mt-0.5">
                <strong>{entry.actor}</strong> · {entry.action}
                {entry.fromStatus && entry.toStatus && (
                  <>
                    {' '}
                    <span className="text-neutral-500">
                      ({STATUS_LABEL[entry.fromStatus]} → {STATUS_LABEL[entry.toStatus]})
                    </span>
                  </>
                )}
              </div>
              {entry.note && (
                <div className="text-sm text-neutral-500 mt-1 italic">"{entry.note}"</div>
              )}
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
