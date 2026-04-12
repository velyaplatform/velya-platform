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
  ativo: 'bg-neutral-50 text-neutral-900 border-neutral-300',
  'em-revisao': 'bg-neutral-100 text-neutral-700 border-neutral-300',
  suspenso: 'bg-neutral-200 text-neutral-900 border-neutral-300',
  descredenciado: 'bg-neutral-50 text-neutral-500 border-neutral-300',
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
          className="flex-1 min-w-[260px] min-h-[44px] bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200"
        />
        <label htmlFor="supplier-category-filter" className="sr-only">
          Filtrar por categoria
        </label>
        <select
          id="supplier-category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | SupplierCategory)}
          className="min-h-[44px] bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-sm text-neutral-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-200"
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
          className="min-h-[44px] bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-sm text-neutral-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-200"
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
          className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          + Novo Fornecedor
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((s) => (
          <article
            key={s.id}
            className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-3"
          >
            <header className="flex justify-between items-start gap-3">
              <div>
                <h2 className="text-base font-bold text-neutral-900">{s.name}</h2>
                <div className="text-xs text-neutral-500">{s.cnpj}</div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {CATEGORY_LABELS[s.category]}
                </div>
              </div>
              <span
                className={`text-[10px] px-2 py-1 rounded-full border font-semibold uppercase tracking-wider ${STATUS_BADGE[s.status]}`}
              >
                {STATUS_LABELS[s.status]}
              </span>
            </header>

            <div className="border-t border-neutral-200 pt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-neutral-500 uppercase tracking-wider text-[10px]">Contato</div>
                <div className="text-neutral-900 font-medium">{s.contactName}</div>
                <div className="text-neutral-500">{s.contactEmail}</div>
                <div className="text-neutral-500">{s.contactPhone}</div>
              </div>
              <div>
                <div className="text-neutral-500 uppercase tracking-wider text-[10px]">SLA</div>
                <div className="text-neutral-900 font-medium">{s.slaResponseHours}h resposta</div>
                <div className="text-neutral-500">Avaliação: {s.rating.toFixed(1)}/5</div>
                <div className="text-neutral-500">
                  Contrato: {s.contractStart} → {s.contractEnd}
                </div>
              </div>
            </div>

            {s.notes && (
              <div className="text-xs text-neutral-700 bg-neutral-100 border border-neutral-300 rounded-md px-3 py-2">
                {s.notes}
              </div>
            )}

            <div className="flex gap-2 mt-1">
              <Link
                href={`/suppliers/${s.id}`}
                className="flex-1 min-h-[40px] inline-flex items-center justify-center text-xs px-3 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
              >
                Ver detalhes
              </Link>
              <Link
                href={`/suppliers/${s.id}/edit`}
                className="flex-1 min-h-[40px] inline-flex items-center justify-center text-xs px-3 py-2 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
              >
                Editar
              </Link>
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="md:col-span-2 text-center py-12 text-neutral-500 bg-white rounded-xl border border-neutral-200">
            Nenhum fornecedor encontrado.
          </div>
        )}
      </div>
    </AppShell>
  );
}
