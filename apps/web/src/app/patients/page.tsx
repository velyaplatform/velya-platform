'use client';

import { useState } from 'react';
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
    ward: 'Ward 1A',
    bed: '1A-04',
    admissionDate: '2026-04-01',
    los: 7,
    diagnosis: 'Hip fracture post-op',
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
    ward: 'Ward 3B',
    bed: '3B-12',
    admissionDate: '2026-04-02',
    los: 6,
    diagnosis: 'Cholecystitis — laparoscopic',
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
    ward: 'Ward 2B',
    bed: '2B-07',
    admissionDate: '2026-03-31',
    los: 8,
    diagnosis: 'COPD exacerbation',
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Social work referral'],
    consultant: 'Dr. Ibrahim',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-004',
    name: 'Eleanor Voss',
    age: 81,
    ward: 'Ward 2A',
    bed: '2A-02',
    admissionDate: '2026-03-30',
    los: 9,
    diagnosis: 'Acute MI — post-PCI',
    dischargeStatus: 'blocked',
    blockersCount: 2,
    blockers: ['Transport', 'Documentation'],
    consultant: 'Dr. Mbeki',
    riskLevel: 'high',
  },
  {
    mrn: 'MRN-005',
    name: 'Carlos Diaz',
    age: 45,
    ward: 'Ward 4A',
    bed: '4A-09',
    admissionDate: '2026-04-04',
    los: 4,
    diagnosis: 'Appendectomy',
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
    ward: 'Ward 1B',
    bed: '1B-06',
    admissionDate: '2026-03-29',
    los: 10,
    diagnosis: 'Stroke — ischaemic',
    dischargeStatus: 'blocked',
    blockersCount: 3,
    blockers: ['Rehab assessment', 'Home care', 'Equipment'],
    consultant: 'Dr. Osei',
    riskLevel: 'high',
  },
  {
    mrn: 'MRN-007',
    name: 'Marcus Bell',
    age: 57,
    ward: 'Ward 4C',
    bed: '4C-03',
    admissionDate: '2026-03-27',
    los: 12,
    diagnosis: 'Spinal stenosis — surgery',
    dischargeStatus: 'blocked',
    blockersCount: 1,
    blockers: ['Insurance pre-auth'],
    consultant: 'Dr. Patel',
    riskLevel: 'high',
  },
  {
    mrn: 'MRN-008',
    name: 'Fatima Al-Rashid',
    age: 38,
    ward: 'Ward 3A',
    bed: '3A-11',
    admissionDate: '2026-04-05',
    los: 3,
    diagnosis: 'Ectopic pregnancy — surgical',
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
    ward: 'Ward 2C',
    bed: '2C-05',
    admissionDate: '2026-04-01',
    los: 7,
    diagnosis: 'Pneumonia',
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Physiotherapy clearance'],
    consultant: 'Dr. Ibrahim',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-010',
    name: 'Linda Okafor',
    age: 49,
    ward: 'Ward 1C',
    bed: '1C-08',
    admissionDate: '2026-04-03',
    los: 5,
    diagnosis: 'Bowel obstruction — conservative',
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Dietitian review'],
    consultant: 'Dr. Chen',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-011',
    name: 'Diana Reyes',
    ward: 'Ward 1D',
    age: 61,
    bed: '1D-01',
    admissionDate: '2026-04-04',
    los: 4,
    diagnosis: 'Knee arthroplasty',
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Pharmacy'],
    consultant: 'Dr. Patel',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-012',
    name: 'Yuki Tanaka',
    age: 29,
    ward: 'Ward 4B',
    bed: '4B-14',
    admissionDate: '2026-04-06',
    los: 2,
    diagnosis: 'Diabetic ketoacidosis',
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
    ward: 'Ward 2A',
    bed: '2A-10',
    admissionDate: '2026-03-25',
    los: 14,
    diagnosis: 'Sepsis — recovery',
    dischargeStatus: 'blocked',
    blockersCount: 4,
    blockers: ['Nursing home', 'Social work', 'DOLS', 'Family'],
    consultant: 'Dr. Osei',
    riskLevel: 'high',
  },
  {
    mrn: 'MRN-014',
    name: 'Thomas Crane',
    age: 52,
    ward: 'Ward 3B',
    bed: '3B-09',
    admissionDate: '2026-04-05',
    los: 3,
    diagnosis: 'Hernia repair',
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
    ward: 'Ward 1A',
    bed: '1A-07',
    admissionDate: '2026-04-03',
    los: 5,
    diagnosis: "Crohn's flare",
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Assessment pending'],
    consultant: 'Dr. Ibrahim',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-016',
    name: 'David Osei',
    age: 67,
    ward: 'Ward 4C',
    bed: '4C-11',
    admissionDate: '2026-03-28',
    los: 11,
    diagnosis: 'Total hip replacement',
    dischargeStatus: 'at-risk',
    blockersCount: 2,
    blockers: ['Physio', 'OT assessment'],
    consultant: 'Dr. Patel',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-017',
    name: 'Maria Santos',
    age: 33,
    ward: 'Ward 3A',
    bed: '3A-04',
    admissionDate: '2026-04-06',
    los: 2,
    diagnosis: 'Caesarean section',
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
    ward: 'Ward 2B',
    bed: '2B-13',
    admissionDate: '2026-04-02',
    los: 6,
    diagnosis: 'Acute pancreatitis',
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Nutrition support'],
    consultant: 'Dr. Chen',
    riskLevel: 'medium',
  },
  {
    mrn: 'MRN-019',
    name: 'Claire Beaumont',
    age: 77,
    ward: 'Ward 1B',
    bed: '1B-03',
    admissionDate: '2026-03-30',
    los: 9,
    diagnosis: 'Femur fracture — non-operative',
    dischargeStatus: 'blocked',
    blockersCount: 3,
    blockers: ['Nursing home', 'Social work', 'Family consent'],
    consultant: 'Dr. Osei',
    riskLevel: 'high',
  },
  {
    mrn: 'MRN-020',
    name: 'Frank Osei',
    age: 46,
    ward: 'Ward 4A',
    bed: '4A-16',
    admissionDate: '2026-04-04',
    los: 4,
    diagnosis: 'Cellulitis — IV antibiotics',
    dischargeStatus: 'at-risk',
    blockersCount: 1,
    blockers: ['Social work referral'],
    consultant: 'Dr. Ibrahim',
    riskLevel: 'medium',
  },
];

const STATUS_LABELS: Record<Patient['dischargeStatus'], string> = {
  'on-track': 'On Track',
  'at-risk': 'At Risk',
  blocked: 'Blocked',
  discharged: 'Discharged',
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

  const wards = Array.from(new Set(MOCK_PATIENTS.map((p) => p.ward))).sort();

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

  // Sort: blocked first, then at-risk, then on-track
  const sorted = [...filtered].sort((a, b) => {
    const order = { blocked: 0, 'at-risk': 1, 'on-track': 2, discharged: 3 };
    return order[a.dischargeStatus] - order[b.dischargeStatus];
  });

  const blockedCount = MOCK_PATIENTS.filter((p) => p.dischargeStatus === 'blocked').length;
  const atRiskCount = MOCK_PATIENTS.filter((p) => p.dischargeStatus === 'at-risk').length;
  const onTrackCount = MOCK_PATIENTS.filter((p) => p.dischargeStatus === 'on-track').length;

  return (
    <AppShell pageTitle="Patient List">
      <div className="page-header">
        <h1 className="page-title">Patients</h1>
        <p className="page-subtitle">
          {MOCK_PATIENTS.length} admitted &mdash; {blockedCount} blocked, {atRiskCount} at risk,{' '}
          {onTrackCount} on track
        </p>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <span className="badge badge-critical">
          <span className="status-dot status-dot-red"></span>
          {blockedCount} Blocked
        </span>
        <span className="badge badge-warning">
          <span className="status-dot status-dot-amber"></span>
          {atRiskCount} At Risk
        </span>
        <span className="badge badge-success">
          <span className="status-dot status-dot-green"></span>
          {onTrackCount} On Track
        </span>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <input
          className="search-input"
          type="text"
          placeholder="🔍  Search by name or MRN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="blocked">Blocked</option>
          <option value="at-risk">At Risk</option>
          <option value="on-track">On Track</option>
          <option value="discharged">Discharged</option>
        </select>
        <select
          className="filter-select"
          value={wardFilter}
          onChange={(e) => setWardFilter(e.target.value)}
        >
          <option value="all">All Wards</option>
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
          <option value="all">All Risk Levels</option>
          <option value="high">High Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="low">Low Risk</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Ward / Bed</th>
                <th>Diagnosis</th>
                <th>Admitted</th>
                <th>LOS</th>
                <th>Discharge Status</th>
                <th>Blockers</th>
                <th>Consultant</th>
                <th>Risk</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🔍</div>
                      <div className="empty-state-title">No patients match your filters</div>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((patient) => (
                  <tr key={patient.mrn} className={ROW_CLASS[patient.dischargeStatus]}>
                    <td>
                      <div className="font-semibold">{patient.name}</div>
                      <div className="text-xs text-tertiary">
                        {patient.mrn} · Age {patient.age}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">{patient.ward}</div>
                      <div className="text-xs text-tertiary">Bed {patient.bed}</div>
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
                        {patient.riskLevel.charAt(0).toUpperCase() + patient.riskLevel.slice(1)}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-primary">View</button>
                        <button className="btn btn-sm btn-outline">Tasks</button>
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
        Showing {sorted.length} of {MOCK_PATIENTS.length} patients
      </div>
    </AppShell>
  );
}
