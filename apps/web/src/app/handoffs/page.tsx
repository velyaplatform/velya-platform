'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import type { ShiftHandoff, HandoffStatus } from '@/lib/handoff-store';

const STATUS_BADGE: Record<HandoffStatus, string> = {
  draft: 'bg-slate-50 text-slate-600 border-slate-300',
  sent: 'bg-blue-900/40 text-blue-800 border-blue-700/60',
  'awaiting-readback': 'bg-amber-50/40 text-amber-800 border-amber-700/60',
  completed: 'bg-green-50/40 text-green-800 border-green-700/60',
  cancelled: 'bg-slate-50 text-slate-500 border-slate-200',
};

const STATUS_LABEL: Record<HandoffStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  'awaiting-readback': 'Aguardando read-back',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export default function HandoffsPage() {
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [items, setItems] = useState<ShiftHandoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (tab === 'inbox') params.set('inbox', 'true');
    if (tab === 'sent') params.set('sent', 'true');
    fetch(`/api/handoffs?${params.toString()}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          setError('Não foi possível carregar as passagens de plantão.');
          return;
        }
        const data = (await res.json()) as { items: ShiftHandoff[] };
        setItems(data.items);
      })
      .catch(() => setError('Erro de rede.'))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <AppShell pageTitle="Passagem de Plantão">
      <div className="page-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="page-title">
              <span aria-hidden="true">{'\uD83D\uDD04'}</span> Passagem de Plantão
            </h1>
            <p className="page-subtitle">
              Estrutura I-PASS (Illness severity · Patient summary · Action list · Situation
              awareness · Synthesis by receiver) — padrão AHRQ para handoff seguro
            </p>
          </div>
          <Link
            href="/handoffs/new"
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            + Nova passagem
          </Link>
        </div>
      </div>

      <div role="tablist" aria-label="Filtro de passagens" className="flex gap-2 mb-5 border-b border-slate-200">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'inbox'}
          onClick={() => setTab('inbox')}
          className={`min-h-[44px] px-4 py-2 text-sm font-semibold border-b-2 -mb-px focus:outline-none focus:ring-2 focus:ring-blue-300 ${
            tab === 'inbox'
              ? 'border-blue-400 text-blue-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
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
              ? 'border-blue-400 text-blue-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Enviadas
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-red-950/40 border border-red-700 text-red-800 rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-600">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-600 text-sm">
            {tab === 'inbox'
              ? 'Você não tem passagens recebidas no momento.'
              : 'Você ainda não criou nenhuma passagem.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((h) => (
            <li key={h.id}>
              <Link
                href={`/handoffs/${h.id}`}
                className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${STATUS_BADGE[h.status]}`}
                      >
                        {STATUS_LABEL[h.status]}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">{h.id}</span>
                      <span className="text-xs text-blue-700">{h.shiftLabel}</span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900">
                      {h.ward} — {h.patients.length} paciente(s)
                    </h2>
                    <div className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-3">
                      <span>
                        De <strong className="text-slate-900">{h.fromUserName}</strong>
                      </span>
                      <span>
                        Para <strong className="text-slate-900">{h.toUserName}</strong>
                      </span>
                      <span className="text-amber-800">
                        {new Date(h.shiftBoundaryAt).toLocaleString('pt-BR')}
                      </span>
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
