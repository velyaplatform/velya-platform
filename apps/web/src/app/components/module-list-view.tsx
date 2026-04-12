'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from './app-shell';
import { Breadcrumbs } from './breadcrumbs';
import {
  getModuleById,
  type ColumnDef,
  type ModuleDef,
} from '../../lib/module-manifest';
import { translate, formatDateTimeBR, formatDateBR } from '../../lib/module-i18n';

interface ModuleListViewProps {
  moduleId: string;
  // Loose typing — each fixture has its own strict interface, but the view
  // reads fields dynamically via column keys.
  data: readonly object[];
}

type SortDir = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Generic, dark-theme, WCAG-AA list view for any module registered in the
 * module-manifest. Takes the moduleId and the already-imported data array
 * (pages import the fixture and pass it in to avoid dynamic imports).
 */
export function ModuleListView({ moduleId, data }: ModuleListViewProps) {
  const module = getModuleById(moduleId);
  if (!module) {
    return (
      <AppShell pageTitle="Módulo desconhecido">
        <div className="page-header">
          <h1 className="page-title">Módulo desconhecido</h1>
          <p className="page-subtitle">
            Não há registro para <strong>{moduleId}</strong> em{' '}
            <code className="text-blue-700">lib/module-manifest.ts</code>.
          </p>
        </div>
      </AppShell>
    );
  }

  return <ModuleListInner module={module} data={data} />;
}

function ModuleListInner({
  module,
  data: rawData,
}: {
  module: ModuleDef;
  data: readonly object[];
}) {
  return (
    <Suspense fallback={null}>
      <ModuleListInnerWithUrl module={module} data={rawData} />
    </Suspense>
  );
}

function ModuleListInnerWithUrl({
  module,
  data: rawData,
}: {
  module: ModuleDef;
  data: readonly object[];
}) {
  // Cast once at the boundary — fixtures are strictly typed at their own site.
  const seedData = rawData as Record<string, unknown>[];

  // ----- URL state (filter persistence + deep linking) -----
  // We use useSearchParams as the source of truth for search + filters,
  // mirroring the user input back into the URL with router.replace so
  // deep links preserve filters and back/forward buttons work.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [filterState, setFilterState] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const filter of module.filters ?? []) {
      const v = searchParams.get(filter.key);
      if (v) out[filter.key] = v;
    }
    return out;
  });
  const [sortKey, setSortKey] = useState<string | null>(() => searchParams.get('sort') ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(
    () => (searchParams.get('dir') === 'desc' ? 'desc' : 'asc'),
  );
  const [pageSize, setPageSize] = useState<number>(() => {
    const v = parseInt(searchParams.get('size') ?? '', 10);
    return [10, 25, 50, 100].includes(v) ? v : DEFAULT_PAGE_SIZE;
  });
  const [page, setPage] = useState(() => {
    const v = parseInt(searchParams.get('page') ?? '', 10);
    return Number.isFinite(v) && v >= 1 ? v : 1;
  });

  // Push state into URL (debounced 120ms so typing isn't laggy)
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      for (const [k, v] of Object.entries(filterState)) {
        if (v && v !== 'all') params.set(k, v);
      }
      if (sortKey) {
        params.set('sort', sortKey);
        params.set('dir', sortDir);
      }
      if (pageSize !== DEFAULT_PAGE_SIZE) params.set('size', String(pageSize));
      if (page !== 1) params.set('page', String(page));
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 120);
    return () => clearTimeout(t);
  }, [search, filterState, sortKey, sortDir, pageSize, page, pathname, router]);

  // Live data merged with overrides from the entity store. We start with
  // the seed data so the page renders immediately, then refetch from
  // /api/entities/[moduleId] to apply any user edits / new records.
  const [liveData, setLiveData] = useState<Record<string, unknown>[]>(seedData);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entities/${module.id}`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled || !payload || !Array.isArray(payload.records)) return;
        const merged = (
          payload.records as { id: string; data: Record<string, unknown> }[]
        ).map((r) => ({ ...r.data }));
        setLiveData(merged);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [module.id]);
  const data = liveData;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((row) => {
      // Search across all stringifiable fields
      if (q) {
        const hay = Object.values(row)
          .filter((v) => typeof v === 'string' || typeof v === 'number')
          .map((v) => String(v).toLowerCase())
          .join(' ');
        if (!hay.includes(q)) return false;
      }
      // Apply select filters
      for (const [key, value] of Object.entries(filterState)) {
        if (value && value !== 'all') {
          if (String(row[key] ?? '') !== value) return false;
        }
      }
      return true;
    });
  }, [data, search, filterState]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dirMult = sortDir === 'asc' ? 1 : -1;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Null/undefined go last regardless of direction
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      // Numeric comparison
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dirMult;
      }

      // ISO date comparison
      if (
        typeof av === 'string' &&
        typeof bv === 'string' &&
        ISO_DATE_RE.test(av) &&
        ISO_DATE_RE.test(bv)
      ) {
        const at = Date.parse(av);
        const bt = Date.parse(bv);
        if (!Number.isNaN(at) && !Number.isNaN(bt)) {
          return (at - bt) * dirMult;
        }
      }

      // Locale-aware string compare (pt-BR)
      return String(av).localeCompare(String(bv), 'pt-BR') * dirMult;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  // Reset page when any upstream input changes.
  useEffect(() => {
    setPage(1);
  }, [search, filterState, sortKey, sortDir, pageSize]);

  const totalRows = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = totalRows === 0 ? 0 : (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalRows);
  const paginated = useMemo(
    () => sorted.slice(startIdx, endIdx),
    [sorted, startIdx, endIdx],
  );

  const filterOptions = useMemo(() => {
    const out: Record<string, { value: string; label: string }[]> = {};
    for (const filter of module.filters ?? []) {
      if (filter.type === 'select') {
        if (filter.options) {
          out[filter.key] = filter.options;
        } else {
          const values = Array.from(
            new Set(
              data
                .map((row) => row[filter.key])
                .filter((v): v is string | number | boolean => v != null)
                .map((v) => String(v)),
            ),
          );
          out[filter.key] = values.map((v) => ({ value: v, label: v }));
        }
      }
    }
    return out;
  }, [data, module.filters]);

  const handleHeaderClick = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
      return;
    }
    // was desc → clear sort
    setSortKey(null);
    setSortDir('asc');
  };

  const ariaSortFor = (key: string): 'ascending' | 'descending' | 'none' => {
    if (sortKey !== key) return 'none';
    return sortDir === 'asc' ? 'ascending' : 'descending';
  };

  const sortArrow = (key: string) => {
    if (sortKey !== key) return '\u2195'; // ↕
    return sortDir === 'asc' ? '\u2191' : '\u2193'; // ↑ / ↓
  };

  const clearAllFilters = () => {
    setSearch('');
    setFilterState({});
    setSortKey(null);
    setSortDir('asc');
    setPage(1);
  };

  const handleExportCsv = () => {
    const headers = module.columns.map((col) => col.label);
    const escape = (value: string): string => {
      if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const headerLine = headers.map(escape).join(',');
    const bodyLines = sorted.map((row) =>
      module.columns
        .map((col) => {
          const raw = row[col.key];
          const text = col.format ? col.format(raw, row) : raw == null ? '' : String(raw);
          return escape(text);
        })
        .join(','),
    );
    const csv = [headerLine, ...bodyLines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velya-${module.id}-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // categoryLabel removed — Breadcrumbs component derives it from the module
  const hasActiveFilters =
    search.trim().length > 0 ||
    Object.values(filterState).some((v) => v && v !== 'all');

  return (
    <AppShell pageTitle={module.title}>
      <Breadcrumbs module={module} />

      <div className="page-header">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title">
              <span aria-hidden="true">{module.icon}</span> {module.title}
            </h1>
            <p className="page-subtitle">{module.subtitle}</p>
            <p className="text-xs text-slate-500 mt-1">
              FHIR: <code className="text-blue-700">{module.fhirResource}</code> · Classe{' '}
              <strong className="text-slate-900">{module.dataClass}</strong>
              {module.regulatoryBasis && module.regulatoryBasis.length > 0 && (
                <> · {module.regulatoryBasis.join(' · ')}</>
              )}
            </p>
          </div>
          {module.newRoute && (
            <Link
              href={module.newRoute}
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              + Novo
            </Link>
          )}
        </div>
      </div>

      {/* Screen-reader announcements for filter/sort/search changes */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {sorted.length} registros encontrados após filtros.
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center mb-5 p-3 rounded-lg border border-slate-200 bg-white">
        <label htmlFor={`search-${module.id}`} className="sr-only">
          Buscar em {module.title}
        </label>
        <input
          id={`search-${module.id}`}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="flex-1 min-w-[220px] min-h-[44px] bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {(module.filters ?? []).map((filter) =>
          filter.type === 'select' ? (
            <div key={filter.key} className="flex flex-col gap-1">
              <label
                htmlFor={`filter-${module.id}-${filter.key}`}
                className="sr-only"
              >
                {filter.label}
              </label>
              <select
                id={`filter-${module.id}-${filter.key}`}
                value={filterState[filter.key] ?? 'all'}
                onChange={(e) =>
                  setFilterState({ ...filterState, [filter.key]: e.target.value })
                }
                className="min-h-[44px] bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="all">{filter.label}: todos</option>
                {(filterOptions[filter.key] ?? []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null,
        )}
        <button
          type="button"
          onClick={handleExportCsv}
          aria-label="Exportar resultados como CSV"
          className="min-h-[44px] px-4 py-2 rounded-md bg-slate-50 border border-slate-300 text-slate-900 hover:bg-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          Exportar CSV
        </button>
        <div className="ml-auto text-xs text-slate-600">
          {sorted.length} de {data.length} registros
        </div>
      </div>

      {/* Data table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                {module.columns.map((col) => (
                  <th
                    key={col.key}
                    aria-sort={ariaSortFor(col.key)}
                    className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap"
                  >
                    <button
                      type="button"
                      onClick={() => handleHeaderClick(col.key)}
                      className="bg-transparent border-none text-inherit font-inherit cursor-pointer flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded uppercase tracking-wider"
                    >
                      <span>{col.label}</span>
                      <span aria-hidden="true" className="text-slate-500">
                        {sortArrow(col.key)}
                      </span>
                    </button>
                  </th>
                ))}
                <th
                  scope="col"
                  className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap"
                >
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={module.columns.length + 1}
                    className="text-center py-12 text-slate-600"
                  >
                    {hasActiveFilters ? (
                      <div className="flex flex-col items-center gap-3">
                        <span>
                          Nenhum registro encontrado para os filtros atuais.
                        </span>
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="min-h-[44px] px-4 py-2 rounded-md bg-slate-50 border border-slate-300 text-slate-900 hover:bg-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                          Limpar filtros
                        </button>
                      </div>
                    ) : (
                      <span>Nenhum registro encontrado.</span>
                    )}
                  </td>
                </tr>
              )}
              {paginated.map((row, rowIdx) => {
                const recordId = String(row.id ?? '');
                return (
                  <tr
                    key={recordId || `${startIdx + rowIdx}`}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {module.columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-slate-900 align-top ${col.className ?? ''}`}
                      >
                        {renderCell(col, row)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right align-top whitespace-nowrap">
                      {recordId && (
                        <Link
                          href={`/edit/${module.id}/${encodeURIComponent(recordId)}`}
                          aria-label={`Editar ${recordId}`}
                          className="inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-md bg-slate-50 border border-slate-300 text-slate-900 hover:bg-blue-700 hover:border-blue-500 hover:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                          Editar
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination controls */}
      <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-slate-600">
        <div>
          Mostrando {totalRows === 0 ? 0 : startIdx + 1} a {endIdx} de {totalRows}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label htmlFor={`page-size-${module.id}`} className="sr-only">
            Registros por página
          </label>
          <select
            id={`page-size-${module.id}`}
            aria-label="Registros por página"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="min-h-[44px] bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} por página
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            aria-disabled={safePage <= 1}
            className="min-h-[44px] px-4 py-2 rounded-md bg-slate-50 border border-slate-300 text-slate-900 hover:bg-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
          >
            Anterior
          </button>
          <span className="text-xs text-slate-500" aria-live="polite">
            Página {safePage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            aria-disabled={safePage >= totalPages}
            className="min-h-[44px] px-4 py-2 rounded-md bg-slate-50 border border-slate-300 text-slate-900 hover:bg-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
          >
            Próxima
          </button>
        </div>
      </div>
    </AppShell>
  );
}

// Matches `2026-04-10T07:00:00-03:00`, `2026-04-10T07:00`, `2026-04-10 07:00:00` etc.
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/;
// Matches `2026-04-10` exactly (pure date, no time component).
const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function renderCell(col: ColumnDef, row: Record<string, unknown>) {
  const raw = row[col.key];

  // Resolution order:
  //   1. Column-defined formatter (wins — fixtures can do domain-specific work)
  //   2. Badge columns → pt-BR translation of the enum value
  //   3. Raw ISO date/datetime → pt-BR formatted string
  //   4. Fallback: String(raw) with "—" for null/undefined
  //
  // Previously this collapsed to String(raw), which leaked FHIR enum
  // values (`in-progress`, `stat`, `on-hold`) and raw ISO timestamps
  // (`2026-04-10T07:00:00-03:00`) into clinical views. Centralising the
  // format logic here means every module in the manifest benefits
  // without having to spell out format fns per column.
  let text: string;
  if (col.format) {
    text = col.format(raw, row);
  } else if (col.badge) {
    text = translate(raw);
  } else if (typeof raw === 'string') {
    if (ISO_DATETIME_RE.test(raw)) {
      text = formatDateTimeBR(raw);
    } else if (ISO_DATE_ONLY_RE.test(raw)) {
      text = formatDateBR(raw);
    } else {
      text = raw;
    }
  } else {
    text = raw == null ? '—' : String(raw);
  }

  if (col.badge) {
    // badgeClass still matches against the raw (untranslated) value so
    // the colour mapping stays in sync with the upstream FHIR enum.
    return (
      <span className={`${badgeClass(String(raw ?? text))}`}>{text}</span>
    );
  }

  if (col.linkTo) {
    const href = col.linkTo.replace(/\$\{row\.(\w+)\}/g, (_, key) => String(row[key] ?? ''));
    return (
      <Link
        href={href}
        className="text-blue-700 hover:text-blue-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded"
      >
        {text}
      </Link>
    );
  }

  return <span>{text}</span>;
}

function badgeClass(value: string): string {
  const v = value.toLowerCase();
  // Positive / completed / active / approved / success / normal
  if (
    /active|completed|approved|paid|final|healthy|on-duty|ativo|saudável|concluíd|aprovad|pago|normal|delivered/.test(
      v,
    )
  ) {
    return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border bg-green-50/40 text-green-800 border-green-700/60 whitespace-nowrap';
  }
  // Warning / in-progress / pending / routine
  if (
    /in-progress|progress|pending|routine|scheduled|preparing|rotina|pendente|progresso|preparo/.test(
      v,
    )
  ) {
    return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border bg-blue-900/40 text-blue-800 border-blue-700/60 whitespace-nowrap';
  }
  // Critical / urgent / stat / emergency / critical / failed / denied
  if (
    /critical|urgent|stat|emergency|failed|denied|crítico|urgente|emerg|negad|falha/.test(v)
  ) {
    return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border bg-red-50/40 text-red-800 border-red-700/60 whitespace-nowrap';
  }
  // Warning yellow
  if (/warning|warn|on-hold|draft|atras|alerta|rascunho|em-revisao|suspen/.test(v)) {
    return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border bg-amber-50/40 text-amber-800 border-amber-700/60 whitespace-nowrap';
  }
  // Default slate
  return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border bg-slate-50 text-slate-700 border-slate-300 whitespace-nowrap';
}
