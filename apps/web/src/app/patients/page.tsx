'use client';

import { useState, useMemo } from 'react';
import { AppShell } from '../components/app-shell';

interface Patient {
  mrn: string;
  name: string;
  age: number;
  ward: string;
  bed: string;
  admissionDate: string;
  los: number;
  diagnosis: string;
  dischargeStatus: 'on-track' | 'at-risk' | 'blocked' | 'discharged';
  blockersCount: number;
  blockers: string[];
  consultant: string;
  riskLevel: 'low' | 'medium' | 'high';
}

const MOCK_PATIENTS: Patient[] = [
  {
    mrn: 'MRN-001',
    name: 'James Whitfield',
    age: 68,
    ward: 'Ala 1A',
    bed: '1A-04',
    admissionDate: '2026-04-01',
    los: 7,
    diagnosis: 'Fratura de quadril pós-op',
    dischargeStatus: 'on-track',
    blockersCount: 0,
    blockers: [],
    consultant: 'Dr. Patel',
    riskLevel: 'low',
  },
  {
    mrn: 'MRN-002',
    name: 'Sarah Mitchell',
    age: 54,
    ward: 'Ala 3B',
    bed: '3B-12',
    admissionDate: '2026-04-02',
    los: 6,
    diagnosis: 'Colecistite — laparoscópica',
    dischargeStatus: 'on-track',
    blockersCount: 0,
    blockers: [],
    consultant: 'Dr. Chen',
    riskLevel: 'low',
  },
  {
    mrn: 'MRN-003',
    name: 'Robert Ngozi',
    age: 72,
    ward: 'Ala 2B',
    bed: '2B-07',
    admissionDate: '2026-03-31',
    los: 8,
    diagnosis: 'Exacerbação de DPOC',
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Encaminhamento para serviço social'],
    consultant: 'Dr. Ibrahim',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-004',
    name: 'Eleanor Voss',
    age: 81,
    ward: 'Ala 2A',
    bed: '2A-02',
    admissionDate: '2026-03-30',
    los: 9,
    diagnosis: 'IAM — pós-ICP',
    dischargeStatus: 'blocked',
    blockersCount: 2,
    blockers: ['Transporte', 'Documentação'],
    consultant: 'Dr. Mbeki',
    riskLevel: 'high',
  },
  {
    mrn: 'MRN-005',
    name: 'Carlos Diaz',
    age: 45,
    ward: 'Ala 4A',
    bed: '4A-09',
    admissionDate: '2026-04-04',
    los: 4,
    diagnosis: 'Apendicectomia',
    dischargeStatus: 'on-track',
    blockersCount: 0,
    blockers: [],
    consultant: 'Dr. Chen',
    riskLevel: 'low',
  },
  {
    mrn: 'MRN-006',
    name: 'Anna Kowalski',
    age: 63,
    ward: 'Ala 1B',
    bed: '1B-06',
    admissionDate: '2026-03-29',
    los: 10,
    diagnosis: 'AVC isquêmico',
    dischargeStatus: 'blocked',
    blockersCount: 3,
    blockers: ['Avaliação de reabilitação', 'Cuidado domiciliar', 'Equipamentos'],
    consultant: 'Dr. Osei',
    riskLevel: 'high',
  },
  {
    mrn: 'MRN-007',
    name: 'Marcus Bell',
    age: 57,
    ward: 'Ala 4C',
    bed: '4C-03',
    admissionDate: '2026-03-27',
    los: 12,
    diagnosis: 'Estenose vertebral — cirurgia',
    dischargeStatus: 'blocked',
    blockersCount: 1,
    blockers: ['Pré-autorização do plano'],
    consultant: 'Dr. Patel',
    riskLevel: 'high',
  },
  {
    mrn: 'MRN-008',
    name: 'Fatima Al-Rashid',
    age: 38,
    ward: 'Ala 3A',
    bed: '3A-11',
    admissionDate: '2026-04-05',
    los: 3,
    diagnosis: 'Gravidez ectópica — cirúrgica',
    dischargeStatus: 'on-track',
    blockersCount: 0,
    blockers: [],
    consultant: 'Dr. Nkosi',
    riskLevel: 'low',
  },
  {
    mrn: 'MRN-009',
    name: 'George Papadopoulos',
    age: 76,
    ward: 'Ala 2C',
    bed: '2C-05',
    admissionDate: '2026-04-01',
    los: 7,
    diagnosis: 'Pneumonia',
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Liberação da fisioterapia'],
    consultant: 'Dr. Ibrahim',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-010',
    name: 'Linda Okafor',
    age: 49,
    ward: 'Ala 1C',
    bed: '1C-08',
    admissionDate: '2026-04-03',
    los: 5,
    diagnosis: 'Obstrução intestinal — conservadora',
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Avaliação nutricional'],
    consultant: 'Dr. Chen',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-011',
    name: 'Diana Reyes',
    ward: 'Ala 1D',
    age: 61,
    bed: '1D-01',
    admissionDate: '2026-04-04',
    los: 4,
    diagnosis: 'Artroplastia de joelho',
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Farmácia'],
    consultant: 'Dr. Patel',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-012',
    name: 'Yuki Tanaka',
    age: 29,
    ward: 'Ala 4B',
    bed: '4B-14',
    admissionDate: '2026-04-06',
    los: 2,
    diagnosis: 'Cetoacidose diabética',
    dischargeStatus: 'on-track',
    blockersCount: 0,
    blockers: [],
    consultant: 'Dr. Mbeki',
    riskLevel: 'low',
  },
  {
    mrn: 'MRN-013',
    name: 'Peter Hawkins',
    age: 84,
    ward: 'Ala 2A',
    bed: '2A-10',
    admissionDate: '2026-03-25',
    los: 14,
    diagnosis: 'Sepse — recuperação',
    dischargeStatus: 'blocked',
    blockersCount: 4,
    blockers: ['Casa de repouso', 'Serviço social', 'DOLS', 'Família'],
    consultant: 'Dr. Osei',
    riskLevel: 'high',
  },
  {
    mrn: 'MRN-014',
    name: 'Thomas Crane',
    age: 52,
    ward: 'Ala 3B',
    bed: '3B-09',
    admissionDate: '2026-04-05',
    los: 3,
    diagnosis: 'Hernioplastia',
    dischargeStatus: 'on-track',
    blockersCount: 0,
    blockers: [],
    consultant: 'Dr. Chen',
    riskLevel: 'low',
  },
  {
    mrn: 'MRN-015',
    name: 'Priya Nair',
    age: 41,
    ward: 'Ala 1A',
    bed: '1A-07',
    admissionDate: '2026-04-03',
    los: 5,
    diagnosis: 'Surto de Crohn',
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Avaliação pendente'],
    consultant: 'Dr. Ibrahim',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-016',
    name: 'David Osei',
    age: 67,
    ward: 'Ala 4C',
    bed: '4C-11',
    admissionDate: '2026-03-28',
    los: 11,
    diagnosis: 'Prótese total de quadril',
    dischargeStatus: 'at-risk',
    blockersCount: 2,
    blockers: ['Fisioterapia', 'Avaliação de TO'],
    consultant: 'Dr. Patel',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-017',
    name: 'Maria Santos',
    age: 33,
    ward: 'Ala 3A',
    bed: '3A-04',
    admissionDate: '2026-04-06',
    los: 2,
    diagnosis: 'Cesariana',
    dischargeStatus: 'on-track',
    blockersCount: 0,
    blockers: [],
    consultant: 'Dr. Nkosi',
    riskLevel: 'low',
  },
  {
    mrn: 'MRN-018',
    name: 'Ahmed Hassan',
    age: 59,
    ward: 'Ala 2B',
    bed: '2B-13',
    admissionDate: '2026-04-02',
    los: 6,
    diagnosis: 'Pancreatite aguda',
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Suporte nutricional'],
    consultant: 'Dr. Chen',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-019',
    name: 'Claire Beaumont',
    age: 77,
    ward: 'Ala 1B',
    bed: '1B-03',
    admissionDate: '2026-03-30',
    los: 9,
    diagnosis: 'Fratura de fêmur — conservadora',
    dischargeStatus: 'blocked',
    blockersCount: 3,
    blockers: ['Casa de repouso', 'Serviço social', 'Consentimento familiar'],
    consultant: 'Dr. Osei',
    riskLevel: 'high',
  },
  {
    mrn: 'MRN-020',
    name: 'Frank Osei',
    age: 46,
    ward: 'Ala 4A',
    bed: '4A-16',
    admissionDate: '2026-04-04',
    los: 4,
    diagnosis: 'Celulite — antibióticos IV',
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Encaminhamento para serviço social'],
    consultant: 'Dr. Ibrahim',
    riskLevel: 'medium',
  },
];

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

  const wards = useMemo(
    () => Array.from(new Set(MOCK_PATIENTS.map((p) => p.ward))).sort(),
    []
  );

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
    []
  );
  const atRiskCount = useMemo(
    () => MOCK_PATIENTS.filter((p) => p.dischargeStatus === 'at-risk').length,
    []
  );
  const onTrackCount = useMemo(
    () => MOCK_PATIENTS.filter((p) => p.dischargeStatus === 'on-track').length,
    []
  );

  return (
    <AppShell pageTitle="Lista de Pacientes">
      <div className="page-header">
        <h1 className="page-title">Pacientes</h1>
        <p className="page-subtitle">
          {MOCK_PATIENTS.length} internados &mdash; {blockedCount} bloqueados, {atRiskCount} em risco,{' '}
          {onTrackCount} no prazo
        </p>
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
                      <div className="empty-state-title">Nenhum paciente corresponde aos filtros</div>
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
                            ? { color: 'var(--color-critical)' }
                            : patient.los > 6
                              ? { color: 'var(--color-warning)' }
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
                        <button className="btn btn-sm btn-primary">Ver</button>
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
