'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from './app-shell';
import { getModuleById, type ColumnDef, type ModuleDef } from '../../lib/module-manifest';

interface ModuleListViewProps {
  moduleId: string;
  // Loose typing — each fixture has its own strict interface, but the view
  // reads fields dynamically via column keys.
  data: readonly object[];
}

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
            <code className="text-blue-300">lib/module-manifest.ts</code>.
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
  // Cast once at the boundary — fixtures are strictly typed at their own site.
  const data = rawData as Record<string, unknown>[];
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<Record<string, string>>({});

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

  return (
    <AppShell pageTitle={module.title}>
      <div className="page-header">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title">
              <span aria-hidden="true">{module.icon}</span> {module.title}
            </h1>
            <p className="page-subtitle">{module.subtitle}</p>
            <p className="text-xs text-slate-400 mt-1">
              FHIR: <code className="text-blue-300">{module.fhirResource}</code> · Classe{' '}
              <strong className="text-slate-100">{module.dataClass}</strong>
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

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center mb-5 p-3 rounded-lg border border-slate-700 bg-slate-900">
        <label htmlFor={`search-${module.id}`} className="sr-only">
          Buscar em {module.title}
        </label>
        <input
          id={`search-${module.id}`}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="flex-1 min-w-[220px] min-h-[44px] bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                className="min-h-[44px] bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
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
        <div className="ml-auto text-xs text-slate-300">
          {filtered.length} de {data.length} registros
        </div>
      </div>

      {/* Data table */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-200">
              <tr>
                {module.columns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={module.columns.length} className="text-center py-12 text-slate-300">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
              {filtered.map((row, rowIdx) => (
                <tr
                  key={(row.id as string) ?? rowIdx}
                  className="hover:bg-slate-800/60 transition-colors"
                >
                  {module.columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-slate-100 align-top ${col.className ?? ''}`}
                    >
                      {renderCell(col, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function renderCell(col: ColumnDef, row: Record<string, unknown>) {
  const raw = row[col.key];
  const text = col.format ? col.format(raw, row) : raw == null ? '—' : String(raw);

  if (col.badge) {
    return <span className={`${badgeClass(text)}`}>{text}</span>;
  }

  if (col.linkTo) {
    const href = col.linkTo.replace(/\$\{row\.(\w+)\}/g, (_, key) => String(row[key] ?? ''));
    return (
      <Link
        href={href}
        className="text-blue-300 hover:text-blue-200 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded"
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
    return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border bg-green-900/40 text-green-200 border-green-700/60 whitespace-nowrap';
  }
  // Warning / in-progress / pending / routine
  if (
    /in-progress|progress|pending|routine|scheduled|preparing|rotina|pendente|progresso|preparo/.test(
      v,
    )
  ) {
    return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border bg-blue-900/40 text-blue-200 border-blue-700/60 whitespace-nowrap';
  }
  // Critical / urgent / stat / emergency / critical / failed / denied
  if (
    /critical|urgent|stat|emergency|failed|denied|crítico|urgente|emerg|negad|falha/.test(v)
  ) {
    return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border bg-red-900/40 text-red-200 border-red-700/60 whitespace-nowrap';
  }
  // Warning yellow
  if (/warning|warn|on-hold|draft|atras|alerta|rascunho|em-revisao|suspen/.test(v)) {
    return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border bg-amber-900/40 text-amber-200 border-amber-700/60 whitespace-nowrap';
  }
  // Default slate
  return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border bg-slate-800 text-slate-200 border-slate-600 whitespace-nowrap';
}
