'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../components/app-shell';

type TabKey = 'todos' | 'sentinels' | 'alerts' | 'events' | 'errors' | 'actions';
type SeverityFilter = 'all' | 'critical' | 'high' | 'warning' | 'info';

interface PlatformEvent {
  id: string;
  timestamp: string;
  receivedAt: string;
  source: string;
  type: string;
  severity: string;
  data: Record<string, unknown>;
  acked: boolean;
}

interface TypeStats {
  total: number;
  unacked: number;
  lastUpdate: string | null;
}

interface StatsResponse {
  stats: {
    sentinel: TypeStats;
    alert: TypeStats;
    event: TypeStats;
    error: TypeStats;
    action: TypeStats;
  };
  timestamp: string;
}

const TABS: { key: TabKey; label: string; endpoint: string; dataKey: string }[] = [
  { key: 'todos', label: 'Todos', endpoint: '', dataKey: '' },
  { key: 'sentinels', label: 'Sentinelas', endpoint: '/api/sentinel', dataKey: 'reports' },
  { key: 'alerts', label: 'Alertas', endpoint: '/api/alerts', dataKey: 'alerts' },
  { key: 'events', label: 'Eventos', endpoint: '/api/events', dataKey: 'events' },
  { key: 'errors', label: 'Erros', endpoint: '/api/errors', dataKey: 'errors' },
  { key: 'actions', label: 'Ações', endpoint: '/api/actions', dataKey: 'actions' },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  warning: '#eab308',
  info: '#3b82f6',
  error: '#ef4444',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  warning: 'Aviso',
  info: 'Info',
  error: 'Erro',
};

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

function getEventSummary(event: PlatformEvent): string {
  const data = event.data || {};
  if (data.message) return String(data.message);
  if (data.summary) return String(data.summary);
  if (data.action) return `${data.action} → ${data.target || ''}`;
  if (data.sentinel) return `Sentinela: ${data.sentinel} — ${data.status || ''}`;
  if (data.alerts && Array.isArray(data.alerts)) {
    const count = (data.alerts as unknown[]).length;
    return `${count} alerta(s) recebido(s) via ${data.receiver || 'alertmanager'}`;
  }
  return event.source || 'Evento registrado';
}

export default function ActivityPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('todos');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [items, setItems] = useState<PlatformEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        setStats(await res.json());
      }
    } catch { /* fetch error */ }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'todos') {
        // Fetch all types and merge
        const endpoints = TABS.filter(t => t.key !== 'todos');
        const results = await Promise.all(
          endpoints.map(async (tab) => {
            try {
              const params = new URLSearchParams({ limit: '50' });
              if (severityFilter !== 'all') params.set('severity', severityFilter);
              const res = await fetch(`${tab.endpoint}?${params}`);
              if (!res.ok) return [];
              const json = await res.json();
              return (json[tab.dataKey] || []) as PlatformEvent[];
            } catch { /* fetch error */
              return [];
            }
          })
        );
        const merged = results.flat().sort((a, b) =>
          new Date(b.receivedAt || b.timestamp).getTime() -
          new Date(a.receivedAt || a.timestamp).getTime()
        );
        setItems(merged.slice(0, 200));
      } else {
        const tab = TABS.find(t => t.key === activeTab);
        if (!tab) return;
        const params = new URLSearchParams({ limit: '100' });
        if (severityFilter !== 'all') params.set('severity', severityFilter);
        const res = await fetch(`${tab.endpoint}?${params}`);
        if (res.ok) {
          const json = await res.json();
          setItems((json[tab.dataKey] || []) as PlatformEvent[]);
        }
      }
    } catch { /* fetch error */ }
    setLoading(false);
    setLastRefresh(new Date().toLocaleTimeString('pt-BR'));
  }, [activeTab, severityFilter]);

  const handleAck = useCallback(async (event: PlatformEvent) => {
    try {
      await fetch('/api/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: event.type, id: event.id }),
      });
      setItems(prev => prev.map(e => e.id === event.id ? { ...e, acked: true } : e));
      fetchStats();
    } catch { /* fetch error */ }
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();
    fetchItems();
    const interval = setInterval(() => {
      fetchStats();
      fetchItems();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchItems]);

  return (
    <AppShell pageTitle="Log de Atividade">
      <div style={{ padding: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Log de Atividade</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
              Visibilidade total de todos os eventos da plataforma
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {stats && (() => {
              const totalUnacked = Object.values(stats.stats).reduce((sum, s) => sum + s.unacked, 0);
              return totalUnacked > 0 ? (
                <span style={{
                  background: '#ef4444', color: 'white', borderRadius: '9999px',
                  padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700,
                }}>
                  {totalUnacked} pendente{totalUnacked !== 1 ? 's' : ''}
                </span>
              ) : null;
            })()}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Atualizado: {lastRefresh || '—'}
            </span>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.5rem',
          }}>
            {([
              { label: 'Sentinelas', total: stats.stats.sentinel.total, unacked: stats.stats.sentinel.unacked, color: '#8b5cf6' },
              { label: 'Alertas', total: stats.stats.alert.total, unacked: stats.stats.alert.unacked, color: '#f97316' },
              { label: 'Eventos', total: stats.stats.event.total, unacked: stats.stats.event.unacked, color: '#3b82f6' },
              { label: 'Erros', total: stats.stats.error.total, unacked: stats.stats.error.unacked, color: '#ef4444' },
              { label: 'Ações', total: stats.stats.action.total, unacked: stats.stats.action.unacked, color: '#10b981' },
            ]).map(s => (
              <div key={s.label} className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.total}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.label}</div>
                {s.unacked > 0 && (
                  <div style={{ fontSize: '0.625rem', color: '#ef4444', marginTop: '0.25rem' }}>
                    {s.unacked} sem ack
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tabs + filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: activeTab === tab.key ? 700 : 400,
                  background: activeTab === tab.key ? 'var(--accent-primary, #3b82f6)' : 'transparent',
                  color: activeTab === tab.key ? 'white' : 'var(--text-secondary)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginRight: '0.25rem' }}>Severidade:</span>
            {(['all', 'critical', 'high', 'warning', 'info'] as SeverityFilter[]).map(sev => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.25rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.6875rem',
                  fontWeight: severityFilter === sev ? 700 : 400,
                  background: severityFilter === sev
                    ? (sev === 'all' ? 'var(--accent-primary, #3b82f6)' : SEVERITY_COLORS[sev] || '#666')
                    : 'transparent',
                  color: severityFilter === sev ? 'white' : 'var(--text-secondary)',
                }}
              >
                {sev === 'all' ? 'Todos' : SEVERITY_LABELS[sev] || sev}
              </button>
            ))}
          </div>
        </div>

        {/* Event list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading && items.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Carregando eventos...
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Nenhum evento encontrado com os filtros selecionados.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Hora</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Tipo</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Origem</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Severidade</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Resumo</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Ack</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--border-color, #f3f4f6)',
                      background: item.acked ? 'transparent' : 'rgba(239, 68, 68, 0.03)',
                    }}
                  >
                    <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {formatTimestamp(item.receivedAt || item.timestamp)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{
                        fontSize: '0.6875rem',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '0.25rem',
                        background: 'var(--surface-secondary, #f3f4f6)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}>
                        {item.type}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {item.source}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: 'white',
                        background: SEVERITY_COLORS[item.severity] || '#9ca3af',
                      }}>
                        {SEVERITY_LABELS[item.severity] || item.severity}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getEventSummary(item)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                      {item.acked ? (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>✓</span>
                      ) : (
                        <button
                          onClick={() => handleAck(item)}
                          style={{
                            border: '1px solid var(--border-color, #d1d5db)',
                            background: 'transparent',
                            borderRadius: '0.25rem',
                            padding: '0.125rem 0.5rem',
                            fontSize: '0.6875rem',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          Ack
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info */}
        <div style={{ marginTop: '0.75rem', fontSize: '0.6875rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>
          {items.length} evento{items.length !== 1 ? 's' : ''} exibido{items.length !== 1 ? 's' : ''} — atualização automática a cada 10s
        </div>
      </div>
    </AppShell>
  );
}
