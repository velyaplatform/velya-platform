'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import {
  SUPPLIERS,
  CATEGORY_LABELS,
  STATUS_LABELS,
  type SupplierCategory,
  type SupplierStatus,
} from '../../lib/fixtures/suppliers';

const STATUS_BADGE: Record<SupplierStatus, string> = {
  ativo: 'bg-green-900/40 text-green-200 border-green-700/60',
  'em-revisao': 'bg-amber-900/40 text-amber-200 border-amber-700/60',
  suspenso: 'bg-red-900/40 text-red-200 border-red-700/60',
  descredenciado: 'bg-slate-800 text-slate-300 border-slate-600',
};

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | SupplierCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SupplierStatus>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SUPPLIERS.filter((s) => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.cnpj.includes(q) ||
        s.contactName.toLowerCase().includes(q)
      );
    });
  }, [search, categoryFilter, statusFilter]);

  return (
    <AppShell pageTitle="Fornecedores e Terceiros">
      <div className="page-header">
        <h1 className="page-title">Fornecedores e Terceiros</h1>
        <p className="page-subtitle">
          {SUPPLIERS.length} parceiros cadastrados — gerencie contratos, SLAs e desempenho
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center mb-5">
        <label htmlFor="supplier-search" className="sr-only">
          Buscar fornecedor
        </label>
        <input
          id="supplier-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CNPJ ou contato..."
          className="flex-1 min-w-[260px] min-h-[44px] bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <label htmlFor="supplier-category-filter" className="sr-only">
          Filtrar por categoria
        </label>
        <select
          id="supplier-category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | SupplierCategory)}
          className="min-h-[44px] bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">Todas as categorias</option>
          {(Object.entries(CATEGORY_LABELS) as [SupplierCategory, string][]).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label htmlFor="supplier-status-filter" className="sr-only">
          Filtrar por status
        </label>
        <select
          id="supplier-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | SupplierStatus)}
          className="min-h-[44px] bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">Todos os status</option>
          {(Object.entries(STATUS_LABELS) as [SupplierStatus, string][]).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Link
          href="/suppliers/new"
          className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          + Novo Fornecedor
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((s) => (
          <article
            key={s.id}
            className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col gap-3"
          >
            <header className="flex justify-between items-start gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-100">{s.name}</h2>
                <div className="text-xs text-slate-300">{s.cnpj}</div>
                <div className="text-xs text-slate-300 mt-0.5">
                  {CATEGORY_LABELS[s.category]}
                </div>
              </div>
              <span
                className={`text-[10px] px-2 py-1 rounded-full border font-semibold uppercase tracking-wider ${STATUS_BADGE[s.status]}`}
              >
                {STATUS_LABELS[s.status]}
              </span>
            </header>

            <div className="border-t border-slate-700 pt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-slate-400 uppercase tracking-wider text-[10px]">Contato</div>
                <div className="text-slate-100 font-medium">{s.contactName}</div>
                <div className="text-slate-300">{s.contactEmail}</div>
                <div className="text-slate-300">{s.contactPhone}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase tracking-wider text-[10px]">SLA</div>
                <div className="text-slate-100 font-medium">{s.slaResponseHours}h resposta</div>
                <div className="text-slate-300">Avaliação: {s.rating.toFixed(1)}/5</div>
                <div className="text-slate-300">
                  Contrato: {s.contractStart} → {s.contractEnd}
                </div>
              </div>
            </div>

            {s.notes && (
              <div className="text-xs text-amber-200 bg-amber-950/30 border border-amber-700/60 rounded-md px-3 py-2">
                ⚠ {s.notes}
              </div>
            )}

            <div className="flex gap-2 mt-1">
              <Link
                href={`/suppliers/${s.id}`}
                className="flex-1 min-h-[40px] inline-flex items-center justify-center text-xs px-3 py-2 rounded-md bg-slate-800 border border-slate-600 text-slate-100 hover:bg-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                Ver detalhes
              </Link>
              <Link
                href={`/suppliers/${s.id}/edit`}
                className="flex-1 min-h-[40px] inline-flex items-center justify-center text-xs px-3 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                Editar
              </Link>
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="md:col-span-2 text-center py-12 text-slate-300 bg-slate-900 rounded-xl border border-slate-700">
            Nenhum fornecedor encontrado.
          </div>
        )}
      </div>
    </AppShell>
  );
}
