import { AppShell } from './components/app-shell';
import Link from 'next/link';

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trendClass?: string;
  accent?: string;
}

function MetricCard({ label, value, sub, trendClass, accent }: MetricCardProps) {
  return (
    <div className="metric-card" style={accent ? { borderTop: `3px solid ${accent}` } : {}}>
      <div className="metric-label">{label}</div>
      <div className={`metric-value${trendClass ? ` ${trendClass}` : ''}`}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

interface TaskRowProps {
  priority: 'urgent' | 'warning' | 'normal';
  type: string;
  description: string;
  patient: string;
  assignee: string;
  due: string;
}

function TaskRow({ priority, type, description, patient, assignee, due }: TaskRowProps) {
  const borderClass =
    priority === 'urgent'
      ? 'task-item-urgent'
      : priority === 'warning'
        ? 'task-item-warning'
        : 'task-item-normal';

  const badgeClass =
    priority === 'urgent' ? 'badge-urgent' : priority === 'warning' ? 'badge-warning' : 'badge-neutral';

  const badgeLabel = priority === 'urgent' ? 'URGENT' : priority === 'warning' ? 'HIGH' : 'NORMAL';

  return (
    <div className={`task-item ${borderClass}`}>
      <div style={{ flex: 1 }}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
          <span className="badge badge-neutral">{type}</span>
          <span className="text-xs text-tertiary ml-auto">{due}</span>
        </div>
        <div className="font-semibold text-sm" style={{ marginBottom: '4px' }}>
          {description}
        </div>
        <div className="text-xs text-secondary">
          Patient: <strong>{patient}</strong> · Assigned: {assignee}
        </div>
      </div>
      <div className="flex flex-col gap-2" style={{ minWidth: '120px' }}>
        <button className="btn btn-primary btn-sm">✓ Done</button>
        <button className="btn btn-outline btn-sm">↑ Escalate</button>
      </div>
    </div>
  );
}

interface DischargeRowProps {
  mrn: string;
  name: string;
  ward: string;
  los: number;
  targetDate: string;
  blockers: string[];
  status: 'ready' | 'blocked' | 'pending';
}

function DischargeRow({ mrn, name, ward, los, targetDate, blockers, status }: DischargeRowProps) {
  const statusConfig = {
    ready: { badge: 'badge-success', label: 'Ready', dot: 'status-dot-green' },
    blocked: { badge: 'badge-critical', label: 'Blocked', dot: 'status-dot-red' },
    pending: { badge: 'badge-warning', label: 'Pending', dot: 'status-dot-amber' },
  };

  const cfg = statusConfig[status];

  return (
    <tr className={status === 'blocked' ? 'row-critical' : status === 'pending' ? 'row-warning' : ''}>
      <td>
        <div className="font-semibold">{name}</div>
        <div className="text-xs text-tertiary">{mrn}</div>
      </td>
      <td>{ward}</td>
      <td>
        <strong>{los}</strong>d
      </td>
      <td>{targetDate}</td>
      <td>
        {blockers.length === 0 ? (
          <span className="text-xs text-tertiary">None</span>
        ) : (
          blockers.map((b) => (
            <span key={b} className="blocker-tag">
              {b}
            </span>
          ))
        )}
      </td>
      <td>
        <span className={`badge ${cfg.badge}`}>
          <span className={`status-dot ${cfg.dot}`}></span>
          {cfg.label}
        </span>
      </td>
      <td>
        <div className="flex gap-2">
          <Link href="/discharge" className="btn btn-sm btn-outline">
            View
          </Link>
        </div>
      </td>
    </tr>
  );
}

interface ServiceStatusProps {
  name: string;
  status: 'healthy' | 'degraded' | 'unknown';
  url: string;
}

function ServiceStatus({ name, status, url }: ServiceStatusProps) {
  const cfg = {
    healthy: { dot: 'status-dot-green', label: 'Healthy', card: 'service-card-healthy' },
    degraded: { dot: 'status-dot-amber status-dot-pulse', label: 'Degraded', card: 'service-card-degraded' },
    unknown: { dot: 'status-dot-grey', label: 'Unknown', card: 'service-card-unknown' },
  };
  const c = cfg[status];

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      <div className={`service-card ${c.card}`}>
        <span className={`status-dot ${c.dot}`}></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {name}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {c.label}
          </div>
        </div>
      </div>
    </a>
  );
}

const PRIORITY_TASKS: TaskRowProps[] = [
  {
    priority: 'urgent',
    type: 'Discharge',
    description: 'Transport not arranged — patient medically cleared since 08:00',
    patient: 'Eleanor Voss (MRN-004)',
    assignee: 'Discharge Planner',
    due: 'Overdue 4h',
  },
  {
    priority: 'urgent',
    type: 'Clinical',
    description: 'Missing pharmacy sign-off blocks discharge for 3 patients',
    patient: 'Multiple (MRN-011, 018, 022)',
    assignee: 'Dr. Chen',
    due: 'Due now',
  },
  {
    priority: 'warning',
    type: 'Admin',
    description: 'Insurance pre-auth pending > 48h — escalate to payer',
    patient: 'Marcus Bell (MRN-007)',
    assignee: 'Admin Team',
    due: 'Due in 2h',
  },
  {
    priority: 'warning',
    type: 'Clinical',
    description: 'Patient assessment not completed — LOS +1d if missed',
    patient: 'Priya Nair (MRN-015)',
    assignee: 'Ward Team',
    due: 'Due in 3h',
  },
  {
    priority: 'normal',
    type: 'Coordination',
    description: 'Social work referral required before discharge',
    patient: 'Frank Osei (MRN-031)',
    assignee: 'Social Work',
    due: 'Due today',
  },
];

const DISCHARGE_PATIENTS: DischargeRowProps[] = [
  {
    mrn: 'MRN-002',
    name: 'Sarah Mitchell',
    ward: 'Ward 3B',
    los: 6,
    targetDate: 'Today 12:00',
    blockers: [],
    status: 'ready',
  },
  {
    mrn: 'MRN-004',
    name: 'Eleanor Voss',
    ward: 'Ward 2A',
    los: 9,
    targetDate: 'Today 08:00',
    blockers: ['Transport', 'Documentation'],
    status: 'blocked',
  },
  {
    mrn: 'MRN-007',
    name: 'Marcus Bell',
    ward: 'Ward 4C',
    los: 12,
    targetDate: 'Today 16:00',
    blockers: ['Insurance'],
    status: 'blocked',
  },
  {
    mrn: 'MRN-011',
    name: 'Diana Reyes',
    ward: 'Ward 1D',
    los: 4,
    targetDate: 'Tomorrow 10:00',
    blockers: ['Pharmacy'],
    status: 'pending',
  },
  {
    mrn: 'MRN-014',
    name: 'Thomas Crane',
    ward: 'Ward 3B',
    los: 3,
    targetDate: 'Tomorrow 14:00',
    blockers: [],
    status: 'ready',
  },
];

const SERVICES: ServiceStatusProps[] = [
  { name: 'Patient Flow', status: 'healthy', url: 'http://patient-flow.172.19.0.6.nip.io' },
  { name: 'Discharge', status: 'healthy', url: 'http://discharge.172.19.0.6.nip.io' },
  { name: 'Task Inbox', status: 'healthy', url: 'http://task-inbox.172.19.0.6.nip.io' },
  { name: 'Audit', status: 'healthy', url: 'http://audit.172.19.0.6.nip.io' },
  { name: 'AI Gateway', status: 'degraded', url: 'http://ai-gateway.172.19.0.6.nip.io' },
  { name: 'Policy Engine', status: 'healthy', url: 'http://policy-engine.172.19.0.6.nip.io' },
  { name: 'Agents', status: 'healthy', url: 'http://agents.172.19.0.6.nip.io' },
];

export default function CommandCenterPage() {
  return (
    <AppShell pageTitle="Command Center">
      {/* Critical Alert Banner */}
      <div className="alert-banner alert-banner-critical">
        <span style={{ fontSize: '1.1rem' }}>🚨</span>
        <strong>3 patients blocked for discharge &gt; 24h</strong>
        <span style={{ fontWeight: 400 }}>
          &mdash; Eleanor Voss (transport), Marcus Bell (insurance), Diana Reyes (pharmacy)
        </span>
        <Link href="/discharge" className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }}>
          Resolve Now →
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid-metrics">
        <MetricCard
          label="Total Admitted"
          value={47}
          sub="3 admitted today"
          accent="var(--color-brand-highlight)"
        />
        <MetricCard
          label="Pending Discharge"
          value={12}
          sub="Target: discharge by 14:00"
          accent="var(--color-warning)"
        />
        <MetricCard
          label="Discharge Blocked"
          value={5}
          sub="↑ 2 since yesterday"
          trendClass="metric-trend-up"
          accent="var(--color-critical)"
        />
        <MetricCard
          label="Avg LOS (days)"
          value="5.2"
          sub="↓ 0.3d vs last week"
          trendClass="metric-trend-down"
          accent="var(--color-success)"
        />
        <MetricCard
          label="Open Tasks"
          value={34}
          sub="12 due in next 2h"
          accent="var(--color-warning)"
        />
        <MetricCard
          label="Bed Occupancy"
          value="87%"
          sub="52 / 60 beds"
          accent="var(--color-brand-deep)"
        />
      </div>

      {/* Main content grid */}
      <div className="grid-2">
        {/* Priority Task Inbox */}
        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">⚡ Priority Action Inbox</span>
              <Link href="/tasks" className="card-action">
                View All 34 →
              </Link>
            </div>
            {PRIORITY_TASKS.map((task, i) => (
              <TaskRow key={i} {...task} />
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Exception Workboard */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">🔥 Exceptions — At Risk Now</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                {
                  label: 'LOS > 10d without discharge plan',
                  count: 3,
                  color: 'var(--color-critical)',
                  href: '/patients',
                },
                {
                  label: 'No ward round documentation today',
                  count: 7,
                  color: 'var(--color-warning)',
                  href: '/tasks',
                },
                {
                  label: 'Medication not reconciled',
                  count: 2,
                  color: 'var(--color-critical)',
                  href: '/tasks',
                },
                {
                  label: 'Missing consent forms',
                  count: 4,
                  color: 'var(--color-warning)',
                  href: '/tasks',
                },
                {
                  label: 'Referrals pending > 48h',
                  count: 2,
                  color: 'var(--color-warning)',
                  href: '/tasks',
                },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '8px',
                    background: 'var(--color-surface-subtle)',
                    textDecoration: 'none',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span
                    style={{
                      minWidth: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: item.color,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                    }}
                  >
                    {item.count}
                  </span>
                  <span
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      color: 'var(--color-brand-highlight)',
                      fontSize: '0.75rem',
                    }}
                  >
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* System Health */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">⚙️ System Health</span>
              <Link href="/system" className="card-action">
                Full Status →
              </Link>
            </div>
            <div className="service-grid">
              {SERVICES.map((svc) => (
                <ServiceStatus key={svc.name} {...svc} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Discharge Control Tower Preview */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header">
          <span className="card-title">🏠 Discharge Control Tower</span>
          <Link href="/discharge" className="card-action">
            Full Tower →
          </Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Ward</th>
                <th>LOS</th>
                <th>Target Discharge</th>
                <th>Blockers</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {DISCHARGE_PATIENTS.map((p) => (
                <DischargeRow key={p.mrn} {...p} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
