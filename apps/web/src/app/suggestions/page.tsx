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
  pending: '#f59e0b',
  reviewing: '#3b82f6',
  implementing: '#8b5cf6',
  done: '#22c55e',
  rejected: '#ef4444',
};

const PRIORITY_LABELS: Record<Suggestion['priority'], string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

const PRIORITY_COLORS: Record<Suggestion['priority'], string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#ef4444',
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
      console.error('Erro ao carregar sugestões:', error);
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
      console.error('Erro ao atualizar status:', error);
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
      <div style={{ padding: '1.5rem' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
              Gestão de Sugestões
            </h2>
            <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
              {pendingCount} sugestão(ões) pendente(s)
            </p>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setLoading(true);
            }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            <option value="all">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="reviewing">Em Análise</option>
            <option value="implementing">Implementando</option>
            <option value="done">Concluído</option>
            <option value="rejected">Rejeitado</option>
          </select>
        </div>

        {/* Suggestions list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            Carregando sugestões...
          </div>
        ) : suggestions.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#6b7280',
              background: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
            }}
          >
            Nenhuma sugestão encontrada.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {/* Status badge */}
                    <span
                      style={{
                        background: STATUS_COLORS[suggestion.status] + '18',
                        color: STATUS_COLORS[suggestion.status],
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {STATUS_LABELS[suggestion.status]}
                    </span>
                    {/* Priority badge */}
                    <span
                      style={{
                        background: PRIORITY_COLORS[suggestion.priority] + '18',
                        color: PRIORITY_COLORS[suggestion.priority],
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {PRIORITY_LABELS[suggestion.priority]}
                    </span>
                  </div>
                  <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>
                    {formatTimestamp(suggestion.timestamp)}
                  </span>
                </div>

                <p style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
                  {suggestion.text}
                </p>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    Autor: <strong>{suggestion.author}</strong>
                  </span>

                  {/* Status change buttons */}
                  {NEXT_STATUS[suggestion.status].length > 0 && (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {NEXT_STATUS[suggestion.status].map((nextStatus) => (
                        <button
                          key={nextStatus}
                          onClick={() => handleStatusChange(suggestion.id, nextStatus)}
                          style={{
                            padding: '0.3rem 0.7rem',
                            borderRadius: '6px',
                            border: `1px solid ${STATUS_COLORS[nextStatus]}40`,
                            background: STATUS_COLORS[nextStatus] + '10',
                            color: STATUS_COLORS[nextStatus],
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {STATUS_LABELS[nextStatus]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
