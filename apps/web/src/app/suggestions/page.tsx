'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../components/app-shell';

interface Suggestion {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  status: 'pending' | 'reviewing' | 'implementing' | 'done' | 'rejected';
  priority: 'low' | 'medium' | 'high';
}

const STATUS_LABELS: Record<Suggestion['status'], string> = {
  pending: 'Pendente',
  reviewing: 'Em Análise',
  implementing: 'Implementando',
  done: 'Concluído',
  rejected: 'Rejeitado',
};

const STATUS_COLORS: Record<Suggestion['status'], string> = {
  pending: '#fcd34d',     /* light foreground for dark surface */
  reviewing: '#93c5fd',
  implementing: '#c4b5fd',
  done: '#86efac',
  rejected: '#fca5a5',
};

const PRIORITY_LABELS: Record<Suggestion['priority'], string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

const PRIORITY_COLORS: Record<Suggestion['priority'], string> = {
  low: '#cbd5e1',
  medium: '#fcd34d',
  high: '#fca5a5',
};

const NEXT_STATUS: Record<Suggestion['status'], Suggestion['status'][]> = {
  pending: ['reviewing', 'rejected'],
  reviewing: ['implementing', 'rejected'],
  implementing: ['done', 'rejected'],
  done: [],
  rejected: ['pending'],
};

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchSuggestions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const response = await fetch(`/api/suggestions?${params.toString()}`);
      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setPendingCount(data.pendingCount || 0);
    } catch (error) {
      void error; // logged by error boundary
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchSuggestions();
    const interval = setInterval(fetchSuggestions, 30000);
    return () => clearInterval(interval);
  }, [fetchSuggestions]);

  async function handleStatusChange(id: string, newStatus: Suggestion['status']) {
    try {
      await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, actor: 'Administrador' }),
      });
      await fetchSuggestions();
    } catch (error) {
      void error; // logged by error boundary
    }
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <AppShell pageTitle="Sugestões de Melhoria">
      <div className="page-header">
        <h1 className="page-title">Gestão de Sugestões</h1>
        <p className="page-subtitle">
          {pendingCount} sugestão(ões) pendente(s) — revise, priorize e atualize o status
        </p>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <label htmlFor="status-filter" className="sr-only">
          Filtrar por status
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setLoading(true);
          }}
          className="min-h-[44px] bg-neutral-50 border border-neutral-300 rounded-lg px-4 py-2 text-sm text-neutral-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          <option value="all">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="reviewing">Em Análise</option>
          <option value="implementing">Implementando</option>
          <option value="done">Concluído</option>
          <option value="rejected">Rejeitado</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-neutral-500">Carregando sugestões...</div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-12 text-neutral-500 bg-white rounded-xl border border-neutral-200">
          Nenhuma sugestão encontrada.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {suggestions.map((suggestion) => (
            <article
              key={suggestion.id}
              className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                <div className="flex gap-2 items-center flex-wrap">
                  <span
                    className="px-2.5 py-1 rounded-md text-xs font-semibold border"
                    style={{
                      background: 'rgba(15, 23, 42, 0.5)',
                      color: STATUS_COLORS[suggestion.status],
                      borderColor: STATUS_COLORS[suggestion.status] + '60',
                    }}
                  >
                    {STATUS_LABELS[suggestion.status]}
                  </span>
                  <span
                    className="px-2.5 py-1 rounded-md text-xs font-semibold border"
                    style={{
                      background: 'rgba(15, 23, 42, 0.5)',
                      color: PRIORITY_COLORS[suggestion.priority],
                      borderColor: PRIORITY_COLORS[suggestion.priority] + '60',
                    }}
                  >
                    {PRIORITY_LABELS[suggestion.priority]}
                  </span>
                </div>
                <span className="text-neutral-500 text-xs">
                  {formatTimestamp(suggestion.timestamp)}
                </span>
              </div>

              <p className="text-neutral-900 text-base leading-relaxed mb-3">{suggestion.text}</p>

              <div className="flex justify-between items-center flex-wrap gap-3">
                <span className="text-sm text-neutral-500">
                  Autor: <strong className="text-neutral-900">{suggestion.author}</strong>
                </span>

                {NEXT_STATUS[suggestion.status].length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {NEXT_STATUS[suggestion.status].map((nextStatus) => (
                      <button
                        key={nextStatus}
                        type="button"
                        onClick={() => handleStatusChange(suggestion.id, nextStatus)}
                        className="min-h-[40px] px-3 py-1.5 rounded-md border text-xs font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-200"
                        style={{
                          background: 'rgba(15, 23, 42, 0.6)',
                          borderColor: STATUS_COLORS[nextStatus] + '80',
                          color: STATUS_COLORS[nextStatus],
                        }}
                      >
                        {STATUS_LABELS[nextStatus]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
