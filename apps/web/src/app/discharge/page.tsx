'use client';

import { useState, useMemo } from 'react';
import { AppShell } from '../components/app-shell';

type DischargeStatus = 'ready' | 'blocked' | 'pending' | 'in-progress';

interface DischargePatient {
  mrn: string;
  name: string;
  age: number;
  ward: string;
  bed: string;
  admissionDate: string;
  los: number;
  targetDischarge: string;
  status: DischargeStatus;
  blockers: string[];
  owner: string;
  consultant: string;
  diagnosis: string;
  notes: string;
}

const DISCHARGE_PATIENTS: DischargePatient[] = [
  {
    mrn: 'MRN-004',
    name: 'Eleanor Voss',
    age: 81,
    ward: 'Ala 2A',
    bed: '2A-02',
    admissionDate: '2026-03-30',
    los: 9,
    targetDischarge: '2026-04-08 08:00',
    status: 'blocked',
    blockers: ['Transporte', 'Documentação'],
    owner: 'James Okafor',
    consultant: 'Dr. Mbeki',
    diagnosis: 'IAM — pós-ICP',
    notes:
      'Paciente liberada clinicamente. Família contatada. Transporte deve ser providenciado com urgência.',
  },
  {
    mrn: 'MRN-007',
    name: 'Marcus Bell',
    age: 57,
    ward: 'Ala 4C',
    bed: '4C-03',
    admissionDate: '2026-03-27',
    los: 12,
    targetDischarge: '2026-04-08 16:00',
    status: 'blocked',
    blockers: ['Pré-autorização do plano'],
    owner: 'Equipe Admin',
    consultant: 'Dr. Patel',
    diagnosis: 'Estenose vertebral — pós-cirúrgica',
    notes: 'Pré-autorização enviada há 48h. Escalar para operadora — gerente de caso atribuído.',
  },
  {
    mrn: 'MRN-013',
    name: 'Peter Hawkins',
    age: 84,
    ward: 'Ala 2A',
    bed: '2A-10',
    admissionDate: '2026-03-25',
    los: 14,
    targetDischarge: '2026-04-08 12:00',
    status: 'blocked',
    blockers: [
      'Vaga em casa de repouso',
      'Liberação do serviço social',
      'Avaliação DOLS',
      'Consentimento familiar',
    ],
    owner: 'Equipe de Serviço Social',
    consultant: 'Dr. Osei',
    diagnosis: 'Sepse — recuperação',
    notes:
      'Situação social complexa. 3 casas de repouso contatadas, 1 confirmada aguardando documentação.',
  },
  {
    mrn: 'MRN-006',
    name: 'Anna Kowalski',
    age: 63,
    ward: 'Ala 1B',
    bed: '1B-06',
    admissionDate: '2026-03-29',
    los: 10,
    targetDischarge: '2026-04-08 14:00',
    status: 'blocked',
    blockers: [
      'Avaliação de reabilitação',
      'Pacote de cuidado domiciliar',
      'Entrega de equipamentos',
    ],
    owner: 'Equipe de TO',
    consultant: 'Dr. Osei',
    diagnosis: 'AVC isquêmico',
    notes:
      'Avaliação de TO agendada para 13:00 hoje. Solicitação de cuidado domiciliar enviada. Equipamentos com prazo de 2 dias.',
  },
  {
    mrn: 'MRN-019',
    name: 'Claire Beaumont',
    age: 77,
    ward: 'Ala 1B',
    bed: '1B-03',
    admissionDate: '2026-03-30',
    los: 9,
    targetDischarge: '2026-04-09 10:00',
    status: 'blocked',
    blockers: ['Casa de repouso', 'Consentimento familiar'],
    owner: 'Equipe de Serviço Social',
    consultant: 'Dr. Osei',
    diagnosis: 'Fratura de fêmur — conservadora',
    notes:
      'Reunião com família agendada para 15:00 hoje. Vaga em casa de repouso confirmada para amanhã.',
  },
  {
    mrn: 'MRN-011',
    name: 'Diana Reyes',
    age: 61,
    ward: 'Ala 1D',
    bed: '1D-01',
    admissionDate: '2026-04-04',
    los: 4,
    targetDischarge: '2026-04-09 10:00',
    status: 'pending',
    blockers: ['Kit de medicamentos da farmácia'],
    owner: 'Farmacêutico da Ala',
    consultant: 'Dr. Patel',
    diagnosis: 'Artroplastia de joelho',
    notes:
      'Kit da farmácia pronto até 09:00 amanhã. Fisioterapia liberada. Carta para o clínico pendente.',
  },
  {
    mrn: 'MRN-016',
    name: 'David Osei',
    age: 67,
    ward: 'Ala 4C',
    bed: '4C-11',
    admissionDate: '2026-03-28',
    los: 11,
    targetDischarge: '2026-04-09 14:00',
    status: 'pending',
    blockers: ['Liberação da fisioterapia', 'Visita domiciliar de TO'],
    owner: 'Equipe de Fisioterapia',
    consultant: 'Dr. Patel',
    diagnosis: 'Prótese total de quadril',
    notes:
      'Última sessão de fisioterapia amanhã cedo. Relatório da visita domiciliar de TO esperado até 12:00.',
  },
  {
    mrn: 'MRN-003',
    name: 'Robert Ngozi',
    age: 72,
    ward: 'Ala 2B',
    bed: '2B-07',
    admissionDate: '2026-03-31',
    los: 8,
    targetDischarge: '2026-04-09 12:00',
    status: 'pending',
    blockers: ['Encaminhamento para serviço social'],
    owner: 'Equipe de Serviço Social',
    consultant: 'Dr. Ibrahim',
    diagnosis: 'Exacerbação de DPOC',
    notes:
      'Encaminhamento para suporte comunitário enviado. Consulta de retorno agendada com equipe respiratória.',
  },
  {
    mrn: 'MRN-002',
    name: 'Sarah Mitchell',
    age: 54,
    ward: 'Ala 3B',
    bed: '3B-12',
    admissionDate: '2026-04-02',
    los: 6,
    targetDischarge: '2026-04-08 12:00',
    status: 'ready',
    blockers: [],
    owner: 'Dr. Chen',
    consultant: 'Dr. Chen',
    diagnosis: 'Colecistite — laparoscópica',
    notes: 'Tudo liberado. Transporte providenciado. Carta de alta assinada. Paciente informada.',
  },
  {
    mrn: 'MRN-014',
    name: 'Thomas Crane',
    age: 52,
    ward: 'Ala 3B',
    bed: '3B-09',
    admissionDate: '2026-04-05',
    los: 3,
    targetDischarge: '2026-04-09 14:00',
    status: 'ready',
    blockers: [],
    owner: 'Dr. Chen',
    consultant: 'Dr. Chen',
    diagnosis: 'Hernioplastia',
    notes:
      'Alta simples. Carta para o clínico enviada. Paciente orientado sobre cuidados pós-alta.',
  },
  {
    mrn: 'MRN-008',
    name: 'Fatima Al-Rashid',
    age: 38,
    ward: 'Ala 3A',
    bed: '3A-11',
    admissionDate: '2026-04-05',
    los: 3,
    targetDischarge: '2026-04-08 15:00',
    status: 'in-progress',
    blockers: [],
    owner: 'Dr. Nkosi',
    consultant: 'Dr. Nkosi',
    diagnosis: 'Gravidez ectópica — cirúrgica',
    notes: 'Processo de alta iniciado. Aguardando exames finais. Prescrição sendo preparada.',
  },
  {
    mrn: 'MRN-005',
    name: 'Carlos Diaz',
    age: 45,
    ward: 'Ala 4A',
    bed: '4A-09',
    admissionDate: '2026-04-04',
    los: 4,
    targetDischarge: '2026-04-09 10:00',
    status: 'in-progress',
    blockers: [],
    owner: 'Dr. Chen',
    consultant: 'Dr. Chen',
    diagnosis: 'Apendicectomia',
    notes:
      'Sumário de alta em elaboração. Paciente deambulando bem. Aguardando avaliação da ferida.',
  },
];

const STATUS_CONFIG: Record<
  DischargeStatus,
  { badge: string; label: string; dot: string; rowClass: string }
> = {
  ready: { badge: 'badge-success', label: 'Pronto', dot: 'status-dot-green', rowClass: '' },
  blocked: {
    badge: 'badge-critical',
    label: 'Bloqueado',
    dot: 'status-dot-red status-dot-pulse',
    rowClass: 'row-critical',
  },
  pending: {
    badge: 'badge-warning',
    label: 'Pendente',
    dot: 'status-dot-amber',
    rowClass: 'row-warning',
  },
  'in-progress': {
    badge: 'badge-info',
    label: 'Em Andamento',
    dot: 'status-dot-green status-dot-pulse',
    rowClass: '',
  },
};

const STATUS_ORDER: Record<DischargeStatus, number> = {
  blocked: 0,
  pending: 1,
  'in-progress': 2,
  ready: 3,
};

export default function DischargePage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const wards = useMemo(
    () => Array.from(new Set(DISCHARGE_PATIENTS.map((p) => p.ward))).sort(),
    [],
  );

  const sorted = useMemo(() => {
    const filtered = DISCHARGE_PATIENTS.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesWard = wardFilter === 'all' || p.ward === wardFilter;
      return matchesStatus && matchesWard;
    });
    return [...filtered].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [statusFilter, wardFilter]);

  const toggleSelect = (mrn: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(mrn)) next.delete(mrn);
      else next.add(mrn);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((p) => p.mrn)));
    }
  };

  const blockedCount = DISCHARGE_PATIENTS.filter((p) => p.status === 'blocked').length;
  const pendingCount = DISCHARGE_PATIENTS.filter((p) => p.status === 'pending').length;
  const readyCount = DISCHARGE_PATIENTS.filter((p) => p.status === 'ready').length;
  const inProgressCount = DISCHARGE_PATIENTS.filter((p) => p.status === 'in-progress').length;

  return (
    <AppShell pageTitle="Torre de Controle de Altas">
      <div className="page-header">
        <h1 className="page-title">Torre de Controle de Altas</h1>
        <p className="page-subtitle">
          Pipeline de altas em tempo real — {DISCHARGE_PATIENTS.length} pacientes monitorados
        </p>
      </div>

      {blockedCount > 0 && (
        <div className="alert-banner alert-banner-critical">
          <span>🚨</span>
          <strong>{blockedCount} pacientes bloqueados</strong>
          <span style={{ fontWeight: 400 }}>
            — intervenção imediata necessária para evitar excesso de TMI
          </span>
        </div>
      )}

      {/* Resumo de status */}
      <div className="grid-metrics">
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-critical)' }}>
          <div className="metric-label">Bloqueados</div>
          <div className="metric-value" style={{ color: 'var(--color-critical)' }}>
            {blockedCount}
          </div>
          <div className="metric-sub">Ação imediata necessária</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-warning)' }}>
          <div className="metric-label">Pendentes</div>
          <div className="metric-value" style={{ color: 'var(--color-warning)' }}>
            {pendingCount}
          </div>
          <div className="metric-sub">Aguardando resolução</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-info)' }}>
          <div className="metric-label">Em Andamento</div>
          <div className="metric-value" style={{ color: 'var(--color-info)' }}>
            {inProgressCount}
          </div>
          <div className="metric-sub">Alta em curso</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-success)' }}>
          <div className="metric-label">Prontos</div>
          <div className="metric-value" style={{ color: 'var(--color-success)' }}>
            {readyCount}
          </div>
          <div className="metric-sub">Aguardando transporte / alta</div>
        </div>
      </div>

      {/* Filtros e ações em lote */}
      <div className="filter-bar">
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos os Status</option>
          <option value="blocked">Bloqueado</option>
          <option value="pending">Pendente</option>
          <option value="in-progress">Em Andamento</option>
          <option value="ready">Pronto</option>
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
        {selected.size > 0 && (
          <>
            <span className="badge badge-info">{selected.size} selecionados</span>
            <button className="btn btn-primary btn-sm">📋 Atualizar Lote</button>
            <button className="btn btn-warning btn-sm">↑ Escalar Lote</button>
            <button className="btn btn-outline btn-sm" onClick={() => setSelected(new Set())}>
              Limpar
            </button>
          </>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '36px' }}>
                  <input
                    type="checkbox"
                    checked={selected.size === sorted.length && sorted.length > 0}
                    onChange={selectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>Paciente</th>
                <th>Ala</th>
                <th>TMI</th>
                <th>Alta Prevista</th>
                <th>Bloqueios</th>
                <th>Responsável</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🏠</div>
                      <div className="empty-state-title">
                        Nenhum paciente corresponde aos filtros
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((patient) => {
                  const cfg = STATUS_CONFIG[patient.status];
                  const isExpanded = expandedRow === patient.mrn;
                  return (
                    <>
                      <tr
                        key={patient.mrn}
                        className={cfg.rowClass}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedRow(isExpanded ? null : patient.mrn)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(patient.mrn)}
                            onChange={() => toggleSelect(patient.mrn)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <div className="font-semibold">{patient.name}</div>
                          <div className="text-xs text-tertiary">
                            {patient.mrn} · {patient.age} anos
                          </div>
                          <div
                            className="text-xs text-tertiary truncate"
                            style={{ maxWidth: '180px' }}
                          >
                            {patient.diagnosis}
                          </div>
                        </td>
                        <td>
                          <div className="text-sm">{patient.ward}</div>
                          <div className="text-xs text-tertiary">Leito {patient.bed}</div>
                        </td>
                        <td>
                          <strong
                            style={
                              patient.los >= 10
                                ? { color: 'var(--color-critical)' }
                                : patient.los >= 7
                                  ? { color: 'var(--color-warning)' }
                                  : {}
                            }
                          >
                            {patient.los}d
                          </strong>
                        </td>
                        <td className="text-sm">{patient.targetDischarge}</td>
                        <td>
                          {patient.blockers.length === 0 ? (
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
                        <td className="text-sm">{patient.owner}</td>
                        <td>
                          <span className={`badge ${cfg.badge}`}>
                            <span className={`status-dot ${cfg.dot}`}></span>
                            {cfg.label}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2 flex-wrap">
                            {patient.status === 'blocked' && (
                              <button className="btn btn-sm btn-danger">Resolver</button>
                            )}
                            {patient.status === 'ready' && (
                              <button className="btn btn-sm btn-primary">Alta ✓</button>
                            )}
                            {(patient.status === 'pending' || patient.status === 'in-progress') && (
                              <button className="btn btn-sm btn-primary">Atualizar</button>
                            )}
                            <button className="btn btn-sm btn-outline">
                              {isExpanded ? 'Recolher' : 'Detalhes'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr
                          key={`${patient.mrn}-notes`}
                          style={{ background: 'var(--color-surface-subtle)' }}
                        >
                          <td colSpan={9}>
                            <div style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                              <strong>Notas Clínicas:</strong>{' '}
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {patient.notes}
                              </span>
                              <span style={{ marginLeft: '2rem', color: 'var(--text-tertiary)' }}>
                                Médico: {patient.consultant}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-tertiary mt-2" style={{ textAlign: 'right' }}>
        {sorted.length} de {DISCHARGE_PATIENTS.length} pacientes · Clique em uma linha para expandir
        as notas
      </div>
    </AppShell>
  );
}
