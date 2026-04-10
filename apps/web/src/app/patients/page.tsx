'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import { MOCK_PATIENTS, type Patient } from '../../lib/fixtures/patients-list';

const STATUS_LABELS: Record<Patient['dischargeStatus'], string> = {
  'on-track': 'No Prazo',
  'at-risk': 'Em Risco',
  blocked: 'Bloqueado',
  discharged: 'Alta',
};

const RISK_LABELS: Record<Patient['riskLevel'], string> = {
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
};

const STATUS_BADGE_CLASS: Record<Patient['dischargeStatus'], string> = {
  'on-track': 'badge-success',
  'at-risk': 'badge-warning',
  blocked: 'badge-critical',
  discharged: 'badge-neutral',
};

const ROW_CLASS: Record<Patient['dischargeStatus'], string> = {
  blocked: 'row-critical',
  'at-risk': 'row-warning',
  'on-track': '',
  discharged: '',
};

export default function PatientsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  const wards = useMemo(() => Array.from(new Set(MOCK_PATIENTS.map((p) => p.ward))).sort(), []);

  const sorted = useMemo(() => {
    const filtered = MOCK_PATIENTS.filter((p) => {
      const matchesSearch =
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mrn.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.dischargeStatus === statusFilter;
      const matchesWard = wardFilter === 'all' || p.ward === wardFilter;
      const matchesRisk = riskFilter === 'all' || p.riskLevel === riskFilter;
      return matchesSearch && matchesStatus && matchesWard && matchesRisk;
    });
    const order = { blocked: 0, 'at-risk': 1, 'on-track': 2, discharged: 3 };
    return [...filtered].sort((a, b) => order[a.dischargeStatus] - order[b.dischargeStatus]);
  }, [searchQuery, statusFilter, wardFilter, riskFilter]);

  const blockedCount = useMemo(
    () => MOCK_PATIENTS.filter((p) => p.dischargeStatus === 'blocked').length,
    [],
  );
  const atRiskCount = useMemo(
    () => MOCK_PATIENTS.filter((p) => p.dischargeStatus === 'at-risk').length,
    [],
  );
  const onTrackCount = useMemo(
    () => MOCK_PATIENTS.filter((p) => p.dischargeStatus === 'on-track').length,
    [],
  );

  return (
    <AppShell pageTitle="Lista de Pacientes">
      <div className="page-header">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title">Pacientes</h1>
            <p className="page-subtitle">
              {MOCK_PATIENTS.length} internados &mdash; {blockedCount} bloqueados, {atRiskCount} em
              risco, {onTrackCount} no prazo
            </p>
          </div>
          <Link
            href="/patients/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold no-underline hover:bg-blue-700 transition-colors shadow-sm"
          >
            {'\u2795'} Novo Paciente
          </Link>
        </div>
      </div>

      {/* Resumo por status */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <span className="badge badge-critical">
          <span className="status-dot status-dot-red"></span>
          {blockedCount} Bloqueados
        </span>
        <span className="badge badge-warning">
          <span className="status-dot status-dot-amber"></span>
          {atRiskCount} Em Risco
        </span>
        <span className="badge badge-success">
          <span className="status-dot status-dot-green"></span>
          {onTrackCount} No Prazo
        </span>
      </div>

      {/* Barra de filtros */}
      <div className="filter-bar">
        <input
          className="search-input"
          type="text"
          placeholder="🔍  Buscar por nome ou MRN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos os Status</option>
          <option value="blocked">Bloqueado</option>
          <option value="at-risk">Em Risco</option>
          <option value="on-track">No Prazo</option>
          <option value="discharged">Alta</option>
        </select>
        <select
          className="filter-select"
          value={wardFilter}
          onChange={(e) => setWardFilter(e.target.value)}
        >
          <option value="all">Todas as Alas</option>
          {wards.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
        >
          <option value="all">Todos os Riscos</option>
          <option value="high">Alto Risco</option>
          <option value="medium">Médio Risco</option>
          <option value="low">Baixo Risco</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Ala / Leito</th>
                <th>Diagnóstico</th>
                <th>Internado em</th>
                <th>TMI</th>
                <th>Status de Alta</th>
                <th>Bloqueios</th>
                <th>Médico</th>
                <th>Risco</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🔍</div>
                      <div className="empty-state-title">
                        Nenhum paciente corresponde aos filtros
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((patient) => (
                  <tr key={patient.mrn} className={ROW_CLASS[patient.dischargeStatus]}>
                    <td>
                      <div className="font-semibold">{patient.name}</div>
                      <div className="text-xs text-tertiary">
                        {patient.mrn} · {patient.age} anos
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">{patient.ward}</div>
                      <div className="text-xs text-tertiary">Leito {patient.bed}</div>
                    </td>
                    <td>
                      <div
                        className="text-sm truncate"
                        style={{ maxWidth: '180px' }}
                        title={patient.diagnosis}
                      >
                        {patient.diagnosis}
                      </div>
                    </td>
                    <td className="text-sm">{patient.admissionDate}</td>
                    <td>
                      <strong
                        style={
                          patient.los > 10
                            ? { color: 'var(--color-critical-fg)' }
                            : patient.los > 6
                              ? { color: 'var(--color-warning-fg)' }
                              : {}
                        }
                      >
                        {patient.los}d
                      </strong>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE_CLASS[patient.dischargeStatus]}`}>
                        {STATUS_LABELS[patient.dischargeStatus]}
                      </span>
                    </td>
                    <td>
                      {patient.blockersCount === 0 ? (
                        <span className="text-xs text-tertiary">—</span>
                      ) : (
                        <div>
                          {patient.blockers.map((b) => (
                            <span key={b} className="blocker-tag">
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="text-sm">{patient.consultant}</td>
                    <td>
                      <span
                        className={`badge ${
                          patient.riskLevel === 'high'
                            ? 'badge-critical'
                            : patient.riskLevel === 'medium'
                              ? 'badge-warning'
                              : 'badge-success'
                        }`}
                      >
                        {RISK_LABELS[patient.riskLevel]}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Link
                          href={`/patients/${patient.mrn}`}
                          className="btn btn-sm btn-primary no-underline"
                        >
                          Ver
                        </Link>
                        <button className="btn btn-sm btn-outline">Tarefas</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-tertiary mt-2" style={{ textAlign: 'right' }}>
        Exibindo {sorted.length} de {MOCK_PATIENTS.length} pacientes
      </div>
    </AppShell>
  );
}
