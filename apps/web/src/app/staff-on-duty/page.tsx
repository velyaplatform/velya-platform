'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import {
  STAFF,
  ROLE_LABELS,
  PRESENCE_LABELS,
  getStaffOnDuty,
  type ProfessionalRole,
  type PresenceStatus,
  type StaffMember,
} from '../../lib/fixtures/staff';
import { getPatientByMrn } from '../../lib/fixtures/patients';

const PRESENCE_BADGE: Record<PresenceStatus, string> = {
  'on-duty': 'bg-neutral-50 text-neutral-900 border-neutral-300',
  'on-break': 'bg-neutral-100 text-neutral-700 border-neutral-300',
  'off-duty': 'bg-neutral-50 text-neutral-700 border-neutral-300',
  'off-shift': 'bg-neutral-50 text-neutral-500 border-neutral-200',
};

export default function StaffOnDutyPage() {
  const [roleFilter, setRoleFilter] = useState<'all' | ProfessionalRole>('all');
  const [wardFilter, setWardFilter] = useState<string>('all');

  const wards = useMemo(() => {
    return Array.from(new Set(STAFF.map((s) => s.ward))).sort();
  }, []);

  const staffOnDuty = useMemo(() => getStaffOnDuty(), []);

  const filteredStaff = useMemo(() => {
    return staffOnDuty.filter((s) => {
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;
      if (wardFilter !== 'all' && s.ward !== wardFilter) return false;
      return true;
    });
  }, [staffOnDuty, roleFilter, wardFilter]);

  const staffByWard = useMemo(() => {
    const grouped: Record<string, StaffMember[]> = {};
    for (const s of filteredStaff) {
      if (!grouped[s.ward]) grouped[s.ward] = [];
      grouped[s.ward].push(s);
    }
    return grouped;
  }, [filteredStaff]);

  const stats = useMemo(() => {
    const total = staffOnDuty.length;
    const onDuty = staffOnDuty.filter((s) => s.presence === 'on-duty').length;
    const onBreak = staffOnDuty.filter((s) => s.presence === 'on-break').length;
    const totalPatients = new Set(staffOnDuty.flatMap((s) => s.assignedPatientMrns)).size;
    return { total, onDuty, onBreak, totalPatients };
  }, [staffOnDuty]);

  return (
    <AppShell pageTitle="Equipe em Plantão">
      <div className="page-header">
        <h1 className="page-title">Equipe em Plantão Agora</h1>
        <p className="page-subtitle">
          Visão em tempo real de quem está trabalhando, em qual ala, com quais pacientes
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid-metrics">
        <div className="metric-card">
          <div className="metric-label">Em Serviço</div>
          <div className="metric-value text-[var(--color-success-fg)]">{stats.onDuty}</div>
          <div className="metric-sub">profissionais ativos</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Em Pausa</div>
          <div className="metric-value text-[var(--color-warning-fg)]">{stats.onBreak}</div>
          <div className="metric-sub">retornarão em breve</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pacientes Atribuídos</div>
          <div className="metric-value">{stats.totalPatients}</div>
          <div className="metric-sub">sob cuidado da equipe presente</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Setores Ativos</div>
          <div className="metric-value">{Object.keys(staffByWard).length}</div>
          <div className="metric-sub">com pelo menos 1 profissional</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center mb-5 p-3 rounded-lg border border-neutral-200 bg-white">
        <label htmlFor="role-filter" className="sr-only">
          Filtrar por funcao
        </label>
        <select
          id="role-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | ProfessionalRole)}
          className="min-h-[44px] bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-sm text-neutral-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          <option value="all">Todas as funcoes</option>
          {(Object.entries(ROLE_LABELS) as [ProfessionalRole, string][]).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="ward-filter" className="sr-only">
          Filtrar por setor
        </label>
        <select
          id="ward-filter"
          value={wardFilter}
          onChange={(e) => setWardFilter(e.target.value)}
          className="min-h-[44px] bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-sm text-neutral-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          <option value="all">Todos os setores</option>
          {wards.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>

        <Link
          href="/employees"
          className="ml-auto min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-700 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          Gerenciar funcionarios
        </Link>
      </div>

      {/* Grouped by ward */}
      <div className="flex flex-col gap-6">
        {Object.entries(staffByWard).length === 0 && (
          <div className="text-center py-12 text-neutral-500 bg-white rounded-xl border border-neutral-200">
            Nenhum profissional encontrado com os filtros selecionados.
          </div>
        )}
        {Object.entries(staffByWard).map(([ward, members]) => (
          <section key={ward}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-base font-semibold text-neutral-900 uppercase tracking-wider">
                {ward}
              </h2>
              <span className="text-xs text-neutral-500">
                {members.length} profissional(is)
              </span>
              <div className="flex-1 h-px bg-neutral-100" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map((member) => (
                <article
                  key={member.id}
                  className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-3"
                >
                  <header className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900">{member.name}</h3>
                      <div className="text-xs text-neutral-500">
                        {ROLE_LABELS[member.role]}
                        {member.specialty && <> · {member.specialty}</>}
                      </div>
                      {member.council && (
                        <div className="text-[11px] text-neutral-500 mt-0.5">{member.council}</div>
                      )}
                    </div>
                    <span
                      className={`text-[10px] px-2 py-1 rounded-full border font-semibold uppercase tracking-wider ${PRESENCE_BADGE[member.presence]}`}
                    >
                      {PRESENCE_LABELS[member.presence]}
                    </span>
                  </header>

                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>
                      Turno: <strong className="text-neutral-900">{member.shiftStart}--{member.shiftEnd}</strong>
                    </span>
                    {member.contactExtension && (
                      <span>
                        Ramal: <strong className="text-neutral-900">{member.contactExtension}</strong>
                      </span>
                    )}
                  </div>

                  {member.assignedPatientMrns.length > 0 && (
                    <div className="border-t border-neutral-200 pt-3">
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">
                        Pacientes atribuidos ({member.assignedPatientMrns.length})
                      </div>
                      <ul className="flex flex-wrap gap-1.5">
                        {member.assignedPatientMrns.map((mrn) => {
                          const p = getPatientByMrn(mrn);
                          return (
                            <li key={mrn}>
                              <Link
                                href={`/patients/${mrn}`}
                                className="inline-flex items-center px-2 py-1 rounded-md bg-neutral-100 text-neutral-900 border border-neutral-300 text-[11px] font-medium hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                              >
                                {mrn}
                                {p && <span className="ml-1 text-neutral-900">· {p.name.split(' ')[0]}</span>}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
