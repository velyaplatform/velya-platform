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
          className="flex-1 min-w-[260px] min-h-[44px] bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <label htmlFor="employee-role-filter" className="sr-only">
          Filtrar por função
        </label>
        <select
          id="employee-role-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | ProfessionalRole)}
          className="min-h-[44px] bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
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
          className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          + Novo Funcionário
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-200">
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
          <tbody className="divide-y divide-slate-800">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-slate-800/60">
                <td className="px-4 py-3 font-mono text-slate-100">{s.id}</td>
                <td className="px-4 py-3 text-slate-100">
                  <div className="font-semibold">{s.name}</div>
                  {s.council && <div className="text-xs text-slate-300">{s.council}</div>}
                </td>
                <td className="px-4 py-3 text-slate-200">
                  {ROLE_LABELS[s.role]}
                  {s.specialty && <div className="text-xs text-slate-300">{s.specialty}</div>}
                </td>
                <td className="px-4 py-3 text-slate-200">{s.ward}</td>
                <td className="px-4 py-3 text-slate-200">
                  {s.shiftStart}–{s.shiftEnd}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded-md bg-slate-800 border border-slate-600 text-slate-100">
                    {PRESENCE_LABELS[s.presence]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/employees/${s.id}`}
                      className="text-xs px-3 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-slate-100 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      Ver
                    </Link>
                    <Link
                      href={`/employees/${s.id}/edit`}
                      className="text-xs px-3 py-1.5 rounded-md bg-blue-700 hover:bg-blue-800 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      Editar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-300">
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
