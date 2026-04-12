'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import {
  STAFF,
  ROLE_LABELS,
  PRESENCE_LABELS,
  type ProfessionalRole,
} from '../../lib/fixtures/staff';

export default function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | ProfessionalRole>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return STAFF.filter((s) => {
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.council && s.council.toLowerCase().includes(q))
      );
    });
  }, [search, roleFilter]);

  return (
    <AppShell pageTitle="Funcionários">
      <div className="page-header">
        <h1 className="page-title">Cadastro de Funcionários</h1>
        <p className="page-subtitle">
          {STAFF.length} profissionais cadastrados — gerencie cadastro, escala e permissões
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center mb-5">
        <label htmlFor="employee-search" className="sr-only">
          Buscar funcionário
        </label>
        <input
          id="employee-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, matrícula ou registro profissional..."
          className="flex-1 min-w-[260px] min-h-[44px] bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200"
        />

        <label htmlFor="employee-role-filter" className="sr-only">
          Filtrar por função
        </label>
        <select
          id="employee-role-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | ProfessionalRole)}
          className="min-h-[44px] bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-sm text-neutral-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          <option value="all">Todas as funções</option>
          {(Object.entries(ROLE_LABELS) as [ProfessionalRole, string][]).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <Link
          href="/employees/new"
          className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          + Novo Funcionário
        </Link>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Matrícula</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Nome</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Função</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Setor</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Turno</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-neutral-50/60">
                <td className="px-4 py-3 font-mono text-neutral-900">{s.id}</td>
                <td className="px-4 py-3 text-neutral-900">
                  <div className="font-semibold">{s.name}</div>
                  {s.council && <div className="text-xs text-neutral-500">{s.council}</div>}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {ROLE_LABELS[s.role]}
                  {s.specialty && <div className="text-xs text-neutral-500">{s.specialty}</div>}
                </td>
                <td className="px-4 py-3 text-neutral-700">{s.ward}</td>
                <td className="px-4 py-3 text-neutral-700">
                  {s.shiftStart}–{s.shiftEnd}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900">
                    {PRESENCE_LABELS[s.presence]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/employees/${s.id}`}
                      className="text-xs px-3 py-1.5 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                    >
                      Ver
                    </Link>
                    <Link
                      href={`/employees/${s.id}/edit`}
                      className="text-xs px-3 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
                    >
                      Editar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-neutral-500">
                  Nenhum funcionário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
