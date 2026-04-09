'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../components/app-shell';

interface AuditEntry {
  id: string;
  timestamp: string;
  timestampMs: number;
  category: 'frontend' | 'api' | 'backend' | 'infra' | 'agent' | 'system';
  action: string;
  description: string;
  actor: string;
  resource: string;
  result: 'success' | 'failure' | 'error' | 'warning' | 'info';
  details: Record<string, unknown>;
  origin: string;
  clientId: string;
  hash: string;
  previousHash: string;
  durationMs?: number;
  statusCode?: number;
  requestPath?: string;
  requestMethod?: string;
}

interface AuditQueryResult {
  entries: AuditEntry[];
  total: number;
  integrity: boolean;
}

interface IntegrityResult {
  valid: boolean;
  totalEntries: number;
  brokenAt?: number;
  message: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  frontend: 'FE',
  api: 'API',
  backend: 'BE',
  infra: 'INF',
  agent: 'AGT',
  system: 'SYS',
};

const CATEGORY_COLORS: Record<string, string> = {
  frontend: '#6366f1',
  api: '#0ea5e9',
  backend: '#8b5cf6',
  infra: '#f59e0b',
  agent: '#10b981',
  system: '#64748b',
};

const RESULT_BADGE: Record<string, string> = {
  success: 'badge-success',
  failure: 'badge-warning',
  error: 'badge-critical',
  warning: 'badge-warning',
  info: 'badge-info',
};

const RESULT_LABELS: Record<string, string> = {
  success: 'Sucesso',
  failure: 'Falha',
  error: 'Erro',
  warning: 'Alerta',
  info: 'Info',
};

const PAGE_SIZE = 50;

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [integrity, setIntegrity] = useState(true);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterActor, setFilterActor] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [filterResult, setFilterResult] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<IntegrityResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const fetchDates = useCallback(async () => {
    try {
      const res = await fetch('/api/audit?action=dates');
      const data = await res.json();
      setDates(data.dates || []);
    } catch {
      // silently fail
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('date', selectedDate);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      if (filterCategory) params.set('category', filterCategory);
      if (filterAction) params.set('filter_action', filterAction);
      if (filterActor) params.set('actor', filterActor);
      if (filterResource) params.set('resource', filterResource);
      if (filterResult) params.set('result', filterResult);

      const res = await fetch(`/api/audit?${params.toString()}`);
      const data: AuditQueryResult = await res.json();
      setEntries(data.entries || []);
      setTotal(data.total || 0);
      setIntegrity(data.integrity);
    } catch {
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, page, filterCategory, filterAction, filterActor, filterResource, filterResult]);

  useEffect(() => {
    fetchDates();
  }, [fetchDates]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchEntries, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchEntries]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/audit?action=verify&date=${selectedDate}`);
      const data: IntegrityResult = await res.json();
      setIntegrityResult(data);
    } catch {
      setIntegrityResult({
        valid: false,
        totalEntries: 0,
        message: 'Erro ao verificar integridade',
      });
    } finally {
      setVerifying(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return ts;
    }
  };

  const truncateHash = (hash: string) => {
    if (!hash || hash.length < 12) return hash;
    return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
  };

  return (
    <AppShell pageTitle="Trilha de Auditoria">
      <div className="page-header">
        <h1 className="page-title">Trilha de Auditoria</h1>
        <p className="page-subtitle">
          Registro completo e a prova de adulteracao de todas as acoes na plataforma Velya
        </p>
      </div>

      {/* Integrity banner */}
      {integrityResult && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            background: integrityResult.valid
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${integrityResult.valid ? 'var(--color-success)' : 'var(--color-critical)'}`,
            color: integrityResult.valid ? 'var(--color-success)' : 'var(--color-critical)',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          {integrityResult.valid
            ? `Integridade confirmada - ${integrityResult.message}`
            : `INTEGRIDADE VIOLADA - ${integrityResult.message}`}
        </div>
      )}

      {/* Controls */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <span className="card-title">Filtros</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              {total} registros
            </span>
            <button
              className={`btn btn-sm ${autoRefresh ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{ fontSize: '0.75rem' }}
            >
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Data
            </label>
            <select
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(0);
                setIntegrityResult(null);
              }}
              style={{
                background: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '0.375rem 0.5rem',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <option value={new Date().toISOString().split('T')[0]}>Hoje</option>
              {dates
                .filter((d) => d !== new Date().toISOString().split('T')[0])
                .map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
            </select>
          </div>

          {/* Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Categoria
            </label>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(0);
              }}
              style={{
                background: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '0.375rem 0.5rem',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            >
              <option value="">Todas</option>
              <option value="frontend">Frontend</option>
              <option value="api">API</option>
              <option value="backend">Backend</option>
              <option value="infra">Infra</option>
              <option value="agent">Agente</option>
              <option value="system">Sistema</option>
            </select>
          </div>

          {/* Result */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Resultado
            </label>
            <select
              value={filterResult}
              onChange={(e) => {
                setFilterResult(e.target.value);
                setPage(0);
              }}
              style={{
                background: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '0.375rem 0.5rem',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            >
              <option value="">Todos</option>
              <option value="success">Sucesso</option>
              <option value="failure">Falha</option>
              <option value="error">Erro</option>
              <option value="warning">Alerta</option>
              <option value="info">Info</option>
            </select>
          </div>

          {/* Actor filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Ator
            </label>
            <input
              type="text"
              placeholder="Buscar ator..."
              value={filterActor}
              onChange={(e) => {
                setFilterActor(e.target.value);
                setPage(0);
              }}
              style={{
                background: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '0.375rem 0.5rem',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                width: '140px',
              }}
            />
          </div>

          {/* Resource filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Recurso
            </label>
            <input
              type="text"
              placeholder="Buscar recurso..."
              value={filterResource}
              onChange={(e) => {
                setFilterResource(e.target.value);
                setPage(0);
              }}
              style={{
                background: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '0.375rem 0.5rem',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                width: '140px',
              }}
            />
          </div>

          {/* Action filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Acao
            </label>
            <input
              type="text"
              placeholder="Buscar acao..."
              value={filterAction}
              onChange={(e) => {
                setFilterAction(e.target.value);
                setPage(0);
              }}
              style={{
                background: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '0.375rem 0.5rem',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                width: '140px',
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleVerify}
              disabled={verifying}
              style={{ fontSize: '0.75rem' }}
            >
              {verifying ? 'Verificando...' : 'Verificar Integridade'}
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={fetchEntries}
              style={{ fontSize: '0.75rem' }}
            >
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Summary metrics */}
      {!integrity && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--color-critical)',
            color: 'var(--color-critical)',
            fontWeight: 600,
            fontSize: '0.8rem',
          }}
        >
          ATENCAO: Integridade da cadeia de hash comprometida nesta data. Possivel adulteracao
          detectada.
        </div>
      )}

      {/* Audit table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Registros de Auditoria</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            Mostrando {entries.length} de {total} | Pagina {page + 1} de {Math.max(totalPages, 1)}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            Carregando registros...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            Nenhum registro encontrado para os filtros selecionados.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>Timestamp</th>
                  <th style={{ width: '50px' }}>Cat.</th>
                  <th style={{ width: '140px' }}>Acao</th>
                  <th>Descricao</th>
                  <th style={{ width: '100px' }}>Ator</th>
                  <th style={{ width: '140px' }}>Recurso</th>
                  <th style={{ width: '70px' }}>Resultado</th>
                  <th style={{ width: '90px' }}>Hash</th>
                  <th style={{ width: '60px' }}>Dur.</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: '#fff',
                          background: CATEGORY_COLORS[entry.category] || '#64748b',
                        }}
                      >
                        {CATEGORY_ICONS[entry.category] || entry.category}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      {entry.action}
                    </td>
                    <td
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.description}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                      {entry.actor}
                    </td>
                    <td
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        maxWidth: '140px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.resource}
                    </td>
                    <td>
                      <span
                        className={`badge ${RESULT_BADGE[entry.result] || 'badge-neutral'}`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {RESULT_LABELS[entry.result] || entry.result}
                      </span>
                    </td>
                    <td
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6rem',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {truncateHash(entry.hash)}
                    </td>
                    <td
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {entry.durationMs !== undefined && entry.durationMs !== null
                        ? `${entry.durationMs}ms`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '1rem',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <button
              className="btn btn-ghost btn-sm"
              disabled={page === 0}
              onClick={() => setPage(0)}
              style={{ fontSize: '0.75rem' }}
            >
              Primeira
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              style={{ fontSize: '0.75rem' }}
            >
              Anterior
            </button>
            <span
              style={{ alignSelf: 'center', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}
            >
              {page + 1} / {totalPages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              style={{ fontSize: '0.75rem' }}
            >
              Proxima
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(totalPages - 1)}
              style={{ fontSize: '0.75rem' }}
            >
              Ultima
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
