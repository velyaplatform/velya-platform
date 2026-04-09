'use client';

import { useState } from 'react';
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
    ward: 'Ward 2A',
    bed: '2A-02',
    admissionDate: '2026-03-30',
    los: 9,
    targetDischarge: '2026-04-08 08:00',
    status: 'blocked',
    blockers: ['Transport', 'Documentation'],
    owner: 'James Okafor',
    consultant: 'Dr. Mbeki',
    diagnosis: 'Acute MI — post-PCI',
    notes: 'Patient ready medically. Family contacted. Transport must be arranged urgently.',
  },
  {
    mrn: 'MRN-007',
    name: 'Marcus Bell',
    age: 57,
    ward: 'Ward 4C',
    bed: '4C-03',
    admissionDate: '2026-03-27',
    los: 12,
    targetDischarge: '2026-04-08 16:00',
    status: 'blocked',
    blockers: ['Insurance pre-auth'],
    owner: 'Admin Team',
    consultant: 'Dr. Patel',
    diagnosis: 'Spinal stenosis — post-surgical',
    notes: 'Pre-auth submitted 48h ago. Escalate to payer — case manager assigned.',
  },
  {
    mrn: 'MRN-013',
    name: 'Peter Hawkins',
    age: 84,
    ward: 'Ward 2A',
    bed: '2A-10',
    admissionDate: '2026-03-25',
    los: 14,
    targetDischarge: '2026-04-08 12:00',
    status: 'blocked',
    blockers: ['Nursing home placement', 'Social work sign-off', 'DOLS assessment', 'Family consent'],
    owner: 'Social Work Team',
    consultant: 'Dr. Osei',
    diagnosis: 'Sepsis — recovery',
    notes: 'Complex social situation. 3 nursing homes contacted, 1 confirmed pending paperwork.',
  },
  {
    mrn: 'MRN-006',
    name: 'Anna Kowalski',
    age: 63,
    ward: 'Ward 1B',
    bed: '1B-06',
    admissionDate: '2026-03-29',
    los: 10,
    targetDischarge: '2026-04-08 14:00',
    status: 'blocked',
    blockers: ['Rehab assessment', 'Home care package', 'Equipment delivery'],
    owner: 'OT Team',
    consultant: 'Dr. Osei',
    diagnosis: 'Stroke — ischaemic',
    notes: 'OT assessment scheduled 13:00 today. Home care application submitted. Equipment 2-day lead.',
  },
  {
    mrn: 'MRN-019',
    name: 'Claire Beaumont',
    age: 77,
    ward: 'Ward 1B',
    bed: '1B-03',
    admissionDate: '2026-03-30',
    los: 9,
    targetDischarge: '2026-04-09 10:00',
    status: 'blocked',
    blockers: ['Nursing home', 'Family consent'],
    owner: 'Social Work Team',
    consultant: 'Dr. Osei',
    diagnosis: 'Femur fracture — non-operative',
    notes: 'Family meeting scheduled 15:00 today. Nursing home capacity confirmed for tomorrow.',
  },
  {
    mrn: 'MRN-011',
    name: 'Diana Reyes',
    age: 61,
    ward: 'Ward 1D',
    bed: '1D-01',
    admissionDate: '2026-04-04',
    los: 4,
    targetDischarge: '2026-04-09 10:00',
    status: 'pending',
    blockers: ['Pharmacy discharge pack'],
    owner: 'Ward Pharmacist',
    consultant: 'Dr. Patel',
    diagnosis: 'Knee arthroplasty',
    notes: 'Pharmacy pack to be ready by 09:00 tomorrow. Physio cleared. GP letter pending.',
  },
  {
    mrn: 'MRN-016',
    name: 'David Osei',
    age: 67,
    ward: 'Ward 4C',
    bed: '4C-11',
    admissionDate: '2026-03-28',
    los: 11,
    targetDischarge: '2026-04-09 14:00',
    status: 'pending',
    blockers: ['Physio clearance', 'OT home visit'],
    owner: 'Physio Team',
    consultant: 'Dr. Patel',
    diagnosis: 'Total hip replacement',
    notes: 'Final physio session tomorrow morning. OT home visit report expected by 12:00.',
  },
  {
    mrn: 'MRN-003',
    name: 'Robert Ngozi',
    age: 72,
    ward: 'Ward 2B',
    bed: '2B-07',
    admissionDate: '2026-03-31',
    los: 8,
    targetDischarge: '2026-04-09 12:00',
    status: 'pending',
    blockers: ['Social work referral'],
    owner: 'Social Work Team',
    consultant: 'Dr. Ibrahim',
    diagnosis: 'COPD exacerbation',
    notes: 'Community support referral submitted. Follow-up appointment booked with respiratory team.',
  },
  {
    mrn: 'MRN-002',
    name: 'Sarah Mitchell',
    age: 54,
    ward: 'Ward 3B',
    bed: '3B-12',
    admissionDate: '2026-04-02',
    los: 6,
    targetDischarge: '2026-04-08 12:00',
    status: 'ready',
    blockers: [],
    owner: 'Dr. Chen',
    consultant: 'Dr. Chen',
    diagnosis: 'Cholecystitis — laparoscopic',
    notes: 'All clear. Transport arranged. Discharge letter signed. Patient aware.',
  },
  {
    mrn: 'MRN-014',
    name: 'Thomas Crane',
    age: 52,
    ward: 'Ward 3B',
    bed: '3B-09',
    admissionDate: '2026-04-05',
    los: 3,
    targetDischarge: '2026-04-09 14:00',
    status: 'ready',
    blockers: [],
    owner: 'Dr. Chen',
    consultant: 'Dr. Chen',
    diagnosis: 'Hernia repair',
    notes: 'Straightforward discharge. GP letter sent. Patient given aftercare instructions.',
  },
  {
    mrn: 'MRN-008',
    name: 'Fatima Al-Rashid',
    age: 38,
    ward: 'Ward 3A',
    bed: '3A-11',
    admissionDate: '2026-04-05',
    los: 3,
    targetDischarge: '2026-04-08 15:00',
    status: 'in-progress',
    blockers: [],
    owner: 'Dr. Nkosi',
    consultant: 'Dr. Nkosi',
    diagnosis: 'Ectopic pregnancy — surgical',
    notes: 'Discharge process started. Await final bloods. Prescription being prepared.',
  },
  {
    mrn: 'MRN-005',
    name: 'Carlos Diaz',
    age: 45,
    ward: 'Ward 4A',
    bed: '4A-09',
    admissionDate: '2026-04-04',
    los: 4,
    targetDischarge: '2026-04-09 10:00',
    status: 'in-progress',
    blockers: [],
    owner: 'Dr. Chen',
    consultant: 'Dr. Chen',
    diagnosis: 'Appendectomy',
    notes: 'Discharge summary in progress. Patient mobilising well. Awaiting wound check.',
  },
];

const STATUS_CONFIG: Record<DischargeStatus, { badge: string; label: string; dot: string; rowClass: string }> = {
  ready: { badge: 'badge-success', label: 'Ready', dot: 'status-dot-green', rowClass: '' },
  blocked: { badge: 'badge-critical', label: 'Blocked', dot: 'status-dot-red status-dot-pulse', rowClass: 'row-critical' },
  pending: { badge: 'badge-warning', label: 'Pending', dot: 'status-dot-amber', rowClass: 'row-warning' },
  'in-progress': { badge: 'badge-info', label: 'In Progress', dot: 'status-dot-green status-dot-pulse', rowClass: '' },
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

  const wards = Array.from(new Set(DISCHARGE_PATIENTS.map((p) => p.ward))).sort();

  const filtered = DISCHARGE_PATIENTS.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesWard = wardFilter === 'all' || p.ward === wardFilter;
    return matchesStatus && matchesWard;
  });

  const sorted = [...filtered].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

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
    <AppShell pageTitle="Discharge Control Tower">
      <div className="page-header">
        <h1 className="page-title">Discharge Control Tower</h1>
        <p className="page-subtitle">
          Real-time discharge pipeline — {DISCHARGE_PATIENTS.length} patients tracked
        </p>
      </div>

      {blockedCount > 0 && (
        <div className="alert-banner alert-banner-critical">
          <span>🚨</span>
          <strong>{blockedCount} patients blocked</strong>
          <span style={{ fontWeight: 400 }}>— immediate intervention required to prevent LOS overrun</span>
        </div>
      )}

      {/* Status summary */}
      <div className="grid-metrics">
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-critical)' }}>
          <div className="metric-label">Blocked</div>
          <div className="metric-value" style={{ color: 'var(--color-critical)' }}>{blockedCount}</div>
          <div className="metric-sub">Immediate action needed</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-warning)' }}>
          <div className="metric-label">Pending</div>
          <div className="metric-value" style={{ color: 'var(--color-warning)' }}>{pendingCount}</div>
          <div className="metric-sub">Awaiting resolution</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-info)' }}>
          <div className="metric-label">In Progress</div>
          <div className="metric-value" style={{ color: 'var(--color-info)' }}>{inProgressCount}</div>
          <div className="metric-sub">Discharge underway</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-success)' }}>
          <div className="metric-label">Ready</div>
          <div className="metric-value" style={{ color: 'var(--color-success)' }}>{readyCount}</div>
          <div className="metric-sub">Awaiting transport / home</div>
        </div>
      </div>

      {/* Filters and bulk actions */}
      <div className="filter-bar">
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="blocked">Blocked</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="ready">Ready</option>
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
        {selected.size > 0 && (
          <>
            <span className="badge badge-info">{selected.size} selected</span>
            <button className="btn btn-primary btn-sm">📋 Bulk Update</button>
            <button className="btn btn-warning btn-sm">↑ Bulk Escalate</button>
            <button className="btn btn-outline btn-sm" onClick={() => setSelected(new Set())}>
              Clear
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
                <th>Patient</th>
                <th>Ward</th>
                <th>LOS</th>
                <th>Target Discharge</th>
                <th>Blockers</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🏠</div>
                      <div className="empty-state-title">No patients match current filters</div>
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
                            {patient.mrn} · Age {patient.age}
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
                          <div className="text-xs text-tertiary">Bed {patient.bed}</div>
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
                              <button className="btn btn-sm btn-danger">Resolve</button>
                            )}
                            {patient.status === 'ready' && (
                              <button className="btn btn-sm btn-primary">Discharge ✓</button>
                            )}
                            {(patient.status === 'pending' || patient.status === 'in-progress') && (
                              <button className="btn btn-sm btn-primary">Update</button>
                            )}
                            <button className="btn btn-sm btn-outline">
                              {isExpanded ? 'Collapse' : 'Details'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${patient.mrn}-notes`} style={{ background: 'var(--color-surface-subtle)' }}>
                          <td colSpan={9}>
                            <div style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                              <strong>Clinical Notes:</strong>{' '}
                              <span style={{ color: 'var(--text-secondary)' }}>{patient.notes}</span>
                              <span style={{ marginLeft: '2rem', color: 'var(--text-tertiary)' }}>
                                Consultant: {patient.consultant}
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
        {sorted.length} of {DISCHARGE_PATIENTS.length} patients · Click a row to expand notes
      </div>
    </AppShell>
  );
}
