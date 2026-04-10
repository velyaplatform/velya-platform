'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import {
  getEditableColumns,
  getModuleById,
  type ColumnDef,
  type ModuleDef,
} from '../../../lib/module-manifest';

/**
 * Generic side-by-side comparison view. Navigate to
 * `/compare/<moduleId>?ids=A,B` (or `?ids=A,B,C` for n-way) to see records
 * rendered in parallel columns with diffs highlighted.
 *
 * Works for every module in the manifest without per-module code — the
 * editable columns drive the rows and the per-record fetch uses the same
 * `/api/entities/[moduleId]/[recordId]` endpoint used by the edit page.
 */

interface ResolvedRecord {
  id: string;
  data: Record<string, unknown>;
  isNew: boolean;
  hasOverride: boolean;
  deleted: boolean;
  updatedAt?: string;
}

interface RecordResponse {
  moduleId: string;
  recordId: string;
  record: ResolvedRecord;
}

type FetchedRecord = ResolvedRecord | 'not-found';

export default function CompareModulePage() {
  return (
    <Suspense fallback={null}>
      <CompareModuleInner />
    </Suspense>
  );
}

function CompareModuleInner() {
  const params = useParams<{ moduleId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const moduleId = params.moduleId;
  const module = useMemo<ModuleDef | undefined>(
    () => getModuleById(moduleId),
    [moduleId],
  );

  const ids = useMemo<string[]>(() => {
    const raw = searchParams.get('ids') ?? '';
    return raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }, [searchParams]);

  const [records, setRecords] = useState<Record<string, FetchedRecord>>({});
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [newId, setNewId] = useState('');

  useEffect(() => {
    if (!moduleId || ids.length < 2) {
      setRecords({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    Promise.all(
      ids.map(async (id): Promise<[string, FetchedRecord]> => {
        try {
          const res = await fetch(`/api/entities/${moduleId}/${id}`, {
            credentials: 'same-origin',
          });
          if (res.status === 404) return [id, 'not-found'];
          if (!res.ok) return [id, 'not-found'];
          const data = (await res.json()) as RecordResponse;
          return [id, data.record];
        } catch {
          return [id, 'not-found'];
        }
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        const next: Record<string, FetchedRecord> = {};
        for (const [id, record] of entries) {
          next[id] = record;
        }
        setRecords(next);
      })
      .catch(() => {
        if (!cancelled) setFetchError('Erro de rede ao carregar registros.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moduleId, ids]);

  const handleAddId = useCallback(
    (id: string) => {
      const trimmed = id.trim();
      if (!trimmed) return;
      if (ids.includes(trimmed)) return;
      const nextIds = [...ids, trimmed];
      router.push(`/compare/${moduleId}?ids=${nextIds.join(',')}`);
      setNewId('');
    },
    [ids, moduleId, router],
  );

  if (!module) {
    return (
      <AppShell pageTitle="Módulo desconhecido">
        <div
          role="alert"
          className="bg-red-950/40 border border-red-700 text-red-200 rounded-md px-4 py-3"
        >
          Módulo <strong>{moduleId}</strong> não está registrado em{' '}
          <code>module-manifest.ts</code>.
        </div>
      </AppShell>
    );
  }

  const mod: ModuleDef = module;

  // Empty state: fewer than 2 ids provided
  if (ids.length < 2) {
    return (
      <AppShell pageTitle={`Comparar ${mod.title}`}>
        <Breadcrumbs
          crumbs={[
            { label: 'Início', href: '/' },
            { label: 'Comparações' },
            { label: `${mod.title} (${ids.length})`, current: true },
          ]}
        />
        <div className="page-header">
          <h1 className="page-title">
            <span aria-hidden="true">{mod.icon}</span> Comparar {mod.title}
          </h1>
          <p className="page-subtitle">
            Visualize registros lado a lado e destaque automaticamente os
            campos diferentes.
          </p>
        </div>
        <div
          role="status"
          className="bg-slate-900 border border-slate-700 rounded-xl p-6 text-slate-200"
        >
          <p className="mb-4">
            Selecione pelo menos 2 registros para comparar. Use o parâmetro{' '}
            <code className="font-mono text-blue-300">?ids=A,B</code> na URL
            ou abra a lista do módulo e escolha quais registros analisar.
          </p>
          <Link
            href={mod.route}
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            ← Ir para {mod.title}
          </Link>
        </div>
      </AppShell>
    );
  }

  const editableColumns = getEditableColumns(mod);

  // Loading state
  if (loading) {
    return (
      <AppShell pageTitle={`Comparar ${mod.title}`}>
        <Breadcrumbs
          crumbs={[
            { label: 'Início', href: '/' },
            { label: 'Comparações' },
            { label: `${mod.title} (${ids.length})`, current: true },
          ]}
        />
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 text-slate-200 bg-slate-900 border border-slate-700 rounded-xl px-4 py-6"
        >
          <span
            aria-hidden="true"
            className="inline-block w-5 h-5 border-2 border-slate-500 border-t-blue-400 rounded-full animate-spin"
          />
          Carregando {ids.length} registros...
        </div>
      </AppShell>
    );
  }

  const loadedEntries = ids.map(
    (id) => [id, records[id]] as const,
  );
  const allMissing =
    loadedEntries.length > 0 &&
    loadedEntries.every(([, rec]) => rec === 'not-found' || rec === undefined);

  if (allMissing) {
    return (
      <AppShell pageTitle={`Comparar ${mod.title}`}>
        <Breadcrumbs
          crumbs={[
            { label: 'Início', href: '/' },
            { label: 'Comparações' },
            { label: `${mod.title} (${ids.length})`, current: true },
          ]}
        />
        <div
          role="alert"
          className="bg-red-950/40 border border-red-700 text-red-200 rounded-md px-4 py-4"
        >
          <p className="font-semibold mb-2">Nenhum registro encontrado</p>
          <p className="text-sm mb-3">Os seguintes ids não foram localizados:</p>
          <ul className="list-disc list-inside text-sm font-mono">
            {ids.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
          <Link
            href={mod.route}
            className="mt-4 min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-slate-800 border border-slate-600 text-slate-100 hover:bg-slate-700 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            ← Voltar a {mod.title}
          </Link>
        </div>
      </AppShell>
    );
  }

  // Compute diffs per column
  const diffByColumn: Record<string, boolean> = {};
  for (const col of editableColumns) {
    const serialized = ids.map((id) => {
      const rec = records[id];
      if (rec === 'not-found' || rec === undefined) return '__MISSING__';
      return JSON.stringify(rec.data[col.key] ?? null);
    });
    const first = serialized[0];
    diffByColumn[col.key] = serialized.some((v) => v !== first);
  }

  const totalFields = editableColumns.length;
  const diffCount = editableColumns.filter((c) => diffByColumn[c.key]).length;
  const matchCount = totalFields - diffCount;
  const matchPct =
    totalFields === 0 ? 100 : Math.round((matchCount / totalFields) * 100);

  return (
    <AppShell pageTitle={`Comparar ${mod.title}`}>
      <Breadcrumbs
        crumbs={[
          { label: 'Início', href: '/' },
          { label: 'Comparações' },
          { label: `${mod.title} (${ids.length})`, current: true },
        ]}
      />

      <div className="page-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="page-title">
              <span aria-hidden="true">{mod.icon}</span> Comparar {mod.title}
            </h1>
            <p className="page-subtitle">
              {ids.length} registros lado a lado. Linhas com diferenças ficam
              destacadas em âmbar.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={mod.route}
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-slate-800 border border-slate-600 text-slate-100 hover:bg-slate-700 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              ← Voltar
            </Link>
          </div>
        </div>
      </div>

      {fetchError && (
        <div
          role="alert"
          className="mb-4 bg-red-950/40 border border-red-700 text-red-200 text-sm rounded-md px-4 py-3"
        >
          {fetchError}
        </div>
      )}

      {/* Add id form */}
      <form
        className="mb-4 flex items-center gap-2 flex-wrap bg-slate-900 border border-slate-700 rounded-xl px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          handleAddId(newId);
        }}
      >
        <label htmlFor="compare-add-id" className="text-sm text-slate-200">
          Adicionar registro:
        </label>
        <input
          id="compare-add-id"
          type="text"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          placeholder="Cole um id aqui"
          aria-label="Id do registro a adicionar"
          className="flex-1 min-w-[180px] min-h-[44px] bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          disabled={!newId.trim()}
          className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          + Adicionar registro
        </button>
      </form>

      {/* Comparison table */}
      <div className="overflow-x-auto bg-slate-900 border border-slate-700 rounded-xl">
        <table className="w-full text-sm text-left">
          <caption className="sr-only">
            Comparação de {ids.length} registros de {mod.title}. Linhas com
            diferença são destacadas.
          </caption>
          <thead className="bg-slate-950/60 border-b border-slate-700">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-300 w-56"
              >
                Campo
              </th>
              {ids.map((id) => {
                const rec = records[id];
                const missing = rec === 'not-found' || rec === undefined;
                return (
                  <th
                    key={id}
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold text-slate-200 align-top"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-blue-300 break-all">
                        {id}
                      </span>
                      {missing ? (
                        <span className="text-red-300 text-xs font-normal">
                          não encontrado
                        </span>
                      ) : (
                        <Link
                          href={`/edit/${mod.id}/${id}`}
                          className="text-blue-300 hover:text-blue-200 underline underline-offset-2 text-xs font-normal focus:outline-none focus:ring-2 focus:ring-blue-300 rounded w-fit"
                          aria-label={`Abrir registro ${id}`}
                        >
                          Abrir
                        </Link>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {editableColumns.map((col) => {
              const isDiff = diffByColumn[col.key];
              const rowBase = isDiff
                ? 'bg-amber-900/20 border-l-4 border-amber-500'
                : 'bg-slate-900';
              return (
                <tr
                  key={col.key}
                  className={`${rowBase} border-b border-slate-800 last:border-b-0`}
                  {...(isDiff ? { 'aria-label': 'diferença' } : {})}
                >
                  <th
                    scope="row"
                    className="px-4 py-3 align-top text-slate-200 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <span>{col.label}</span>
                      {isDiff && (
                        <span
                          className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-700/50 text-amber-100 border border-amber-500/60"
                          aria-hidden="true"
                        >
                          diff
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {col.key}
                    </div>
                  </th>
                  {ids.map((id) => {
                    const rec = records[id];
                    if (rec === 'not-found' || rec === undefined) {
                      return (
                        <td
                          key={id}
                          className="px-4 py-3 align-top text-red-300 italic"
                        >
                          —
                        </td>
                      );
                    }
                    const value = rec.data[col.key];
                    const display = formatCell(col, value, rec.data);
                    return (
                      <td
                        key={id}
                        className="px-4 py-3 align-top text-slate-100 break-words"
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div
        role="status"
        aria-live="polite"
        className="mt-4 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 flex flex-wrap items-center gap-x-6 gap-y-1"
      >
        <span>
          Total de campos:{' '}
          <strong className="text-slate-100">{totalFields}</strong>
        </span>
        <span>
          Campos com diferença:{' '}
          <strong className="text-amber-200">{diffCount}</strong>
        </span>
        <span>
          Correspondência:{' '}
          <strong className="text-green-300">{matchPct}%</strong>
        </span>
      </div>
    </AppShell>
  );
}

function formatCell(
  col: ColumnDef,
  value: unknown,
  row: Record<string, unknown>,
): string {
  if (col.format) {
    try {
      return col.format(value, row);
    } catch {
      return stringifyValue(value);
    }
  }
  return stringifyValue(value);
}

function stringifyValue(v: unknown): string {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.map((x) => stringifyValue(x)).join(', ');
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return '[object]';
    }
  }
  return String(v);
}
