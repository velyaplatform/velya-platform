'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../components/app-shell';

type ServiceHealth = 'healthy' | 'degraded' | 'down' | 'unknown' | 'checking';

interface ServiceDef {
  name: string;
  url: string;
  healthPath: string;
  description: string;
  category: 'core' | 'ai' | 'platform' | 'observability';
}

const SERVICES: ServiceDef[] = [
  {
    name: 'Patient Flow',
    url: 'http://patient-flow.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Real-time patient tracking and flow orchestration',
    category: 'core',
  },
  {
    name: 'Discharge Service',
    url: 'http://discharge.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Discharge planning, blockers, and coordination',
    category: 'core',
  },
  {
    name: 'Task Inbox',
    url: 'http://task-inbox.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Priority-ordered clinical and administrative task routing',
    category: 'core',
  },
  {
    name: 'Audit Service',
    url: 'http://audit.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Clinical and operational audit trail with HIPAA compliance',
    category: 'platform',
  },
  {
    name: 'Policy Engine',
    url: 'http://policy-engine.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Role-based access control and clinical policy enforcement',
    category: 'platform',
  },
  {
    name: 'AI Gateway',
    url: 'http://ai-gateway.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Unified AI provider gateway with PHI redaction and rate limiting',
    category: 'ai',
  },
  {
    name: 'Agents',
    url: 'http://agents.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Clinical and operational AI agent execution engine',
    category: 'ai',
  },
  {
    name: 'Grafana',
    url: 'http://grafana.172.19.0.6.nip.io',
    healthPath: '/api/health',
    description: 'Platform observability dashboards and alerting',
    category: 'observability',
  },
  {
    name: 'ArgoCD',
    url: 'http://argocd.172.19.0.6.nip.io',
    healthPath: '/healthz',
    description: 'GitOps continuous delivery and sync status',
    category: 'observability',
  },
];

interface AgentActivity {
  id: string;
  agent: string;
  office: string;
  action: string;
  patient?: string;
  timestamp: string;
  status: 'completed' | 'in-progress' | 'failed' | 'escalated';
}

const AGENT_ACTIVITY: AgentActivity[] = [
  {
    id: 'A-001',
    agent: 'discharge-coordinator-agent',
    office: 'Clinical Ops',
    action: 'Identified 5 patients with LOS > threshold — generated discharge plans',
    patient: 'MRN-004, MRN-007, MRN-013',
    timestamp: '09:45',
    status: 'completed',
  },
  {
    id: 'A-002',
    agent: 'clinical-triage-agent',
    office: 'Clinical',
    action: 'Prioritised 34 tasks and routed to appropriate teams',
    timestamp: '09:30',
    status: 'completed',
  },
  {
    id: 'A-003',
    agent: 'quality-audit-agent',
    office: 'Quality',
    action: 'Flagging 7 patients missing ward round documentation',
    timestamp: '09:15',
    status: 'in-progress',
  },
  {
    id: 'A-004',
    agent: 'medication-reconciliation-agent',
    office: 'Pharmacy',
    action: 'Medication reconciliation check failed — PHI validation error',
    patient: 'MRN-006',
    timestamp: '08:55',
    status: 'failed',
  },
  {
    id: 'A-005',
    agent: 'insurance-auth-agent',
    office: 'Revenue',
    action: 'Pre-auth pending > 48h — escalated to human reviewer',
    patient: 'MRN-007',
    timestamp: '08:30',
    status: 'escalated',
  },
  {
    id: 'A-006',
    agent: 'discharge-coordinator-agent',
    office: 'Clinical Ops',
    action: 'Transport coordination requests sent for 3 patients',
    timestamp: '08:00',
    status: 'completed',
  },
  {
    id: 'A-007',
    agent: 'clinical-triage-agent',
    office: 'Clinical',
    action: 'NEWS2 escalation triggered for Ward 2A bed 2A-10',
    patient: 'MRN-013',
    timestamp: '07:45',
    status: 'escalated',
  },
];

const AGENT_STATUS_BADGE: Record<AgentActivity['status'], string> = {
  completed: 'badge-success',
  'in-progress': 'badge-info',
  failed: 'badge-critical',
  escalated: 'badge-warning',
};

const AGENT_STATUS_LABEL: Record<AgentActivity['status'], string> = {
  completed: 'Completed',
  'in-progress': 'In Progress',
  failed: 'Failed',
  escalated: 'Escalated',
};

const CATEGORY_LABELS: Record<ServiceDef['category'], string> = {
  core: '🏥 Core Services',
  ai: '🤖 AI & Agents',
  platform: '🔐 Platform',
  observability: '📊 Observability',
};

interface ServiceCardProps {
  service: ServiceDef;
  health: ServiceHealth;
  latency?: number;
  onCheck: (url: string) => void;
}

function ServiceCard({ service, health, latency, onCheck }: ServiceCardProps) {
  const statusConfig = {
    healthy: { dot: 'status-dot-green', card: 'service-card-healthy', label: 'Healthy' },
    degraded: { dot: 'status-dot-amber status-dot-pulse', card: 'service-card-degraded', label: 'Degraded' },
    down: { dot: 'status-dot-red status-dot-pulse', card: 'service-card-down', label: 'Down' },
    unknown: { dot: 'status-dot-grey', card: 'service-card-unknown', label: 'Unknown' },
    checking: { dot: 'status-dot-grey status-dot-pulse', card: 'service-card-unknown', label: 'Checking...' },
  };

  const cfg = statusConfig[health];

  return (
    <div className={`service-card ${cfg.card}`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', padding: '0.875rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', width: '100%' }}>
        <span className={`status-dot ${cfg.dot}`}></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            {service.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{cfg.label}</div>
        </div>
        {latency !== undefined && health === 'healthy' && (
          <span className="badge badge-success" style={{ fontSize: '10px' }}>
            {latency}ms
          </span>
        )}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        {service.description}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%' }}>
        <a
          href={service.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.7rem', color: 'var(--color-brand-highlight)', textDecoration: 'none' }}
        >
          {service.url.replace('http://', '')}
        </a>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '2px 8px' }}
          onClick={() => onCheck(service.url)}
        >
          Re-check
        </button>
      </div>
    </div>
  );
}

const CATEGORIES: ServiceDef['category'][] = ['core', 'ai', 'platform', 'observability'];

export default function SystemPage() {
  const [healthMap, setHealthMap] = useState<Record<string, ServiceHealth>>(() => {
    const initial: Record<string, ServiceHealth> = {};
    SERVICES.forEach((s) => {
      initial[s.url] = 'checking';
    });
    return initial;
  });

  const [latencyMap, setLatencyMap] = useState<Record<string, number>>({});

  const checkService = useCallback(async (serviceUrl: string, healthPath: string) => {
    setHealthMap((prev) => ({ ...prev, [serviceUrl]: 'checking' }));
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${serviceUrl}${healthPath}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      const elapsed = Date.now() - start;
      setLatencyMap((prev) => ({ ...prev, [serviceUrl]: elapsed }));
      if (res.ok) {
        setHealthMap((prev) => ({ ...prev, [serviceUrl]: 'healthy' }));
      } else if (res.status >= 500) {
        setHealthMap((prev) => ({ ...prev, [serviceUrl]: 'down' }));
      } else {
        setHealthMap((prev) => ({ ...prev, [serviceUrl]: 'degraded' }));
      }
    } catch {
      setHealthMap((prev) => ({ ...prev, [serviceUrl]: 'unknown' }));
    }
  }, []);

  useEffect(() => {
    SERVICES.forEach((s) => checkService(s.url, s.healthPath));
  }, [checkService]);

  const handleManualCheck = (url: string) => {
    const svc = SERVICES.find((s) => s.url === url);
    if (svc) checkService(svc.url, svc.healthPath);
  };

  const healthyCount = Object.values(healthMap).filter((h) => h === 'healthy').length;
  const downCount = Object.values(healthMap).filter((h) => h === 'down').length;
  const degradedCount = Object.values(healthMap).filter((h) => h === 'degraded').length;
  const unknownCount = Object.values(healthMap).filter(
    (h) => h === 'unknown' || h === 'checking'
  ).length;

  return (
    <AppShell pageTitle="System Status">
      <div className="page-header">
        <h1 className="page-title">System Status &amp; Agent Console</h1>
        <p className="page-subtitle">
          Live health checks against all Velya platform services
        </p>
      </div>

      {/* Overall status */}
      <div className="grid-metrics" style={{ marginBottom: '1.5rem' }}>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-success)' }}>
          <div className="metric-label">Healthy</div>
          <div className="metric-value" style={{ color: 'var(--color-success)' }}>{healthyCount}</div>
          <div className="metric-sub">Services operational</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-warning)' }}>
          <div className="metric-label">Degraded</div>
          <div className="metric-value" style={{ color: 'var(--color-warning)' }}>{degradedCount}</div>
          <div className="metric-sub">Reduced performance</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-critical)' }}>
          <div className="metric-label">Down</div>
          <div className="metric-value" style={{ color: 'var(--color-critical)' }}>{downCount}</div>
          <div className="metric-sub">Service unavailable</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-neutral)' }}>
          <div className="metric-label">Unknown</div>
          <div className="metric-value">{unknownCount}</div>
          <div className="metric-sub">Checking / unreachable</div>
        </div>
      </div>

      {/* Service grid by category */}
      {CATEGORIES.map((category) => {
        const categoryServices = SERVICES.filter((s) => s.category === category);
        return (
          <div key={category} style={{ marginBottom: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              <h2
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {CATEGORY_LABELS[category]}
              </h2>
              <div
                style={{ flex: 1, height: '1px', background: 'var(--color-border)' }}
              />
            </div>
            <div className="service-grid">
              {categoryServices.map((svc) => (
                <ServiceCard
                  key={svc.url}
                  service={svc}
                  health={healthMap[svc.url] ?? 'unknown'}
                  latency={latencyMap[svc.url]}
                  onCheck={handleManualCheck}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* External dashboards */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">🔗 External Dashboards</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          <a
            href="http://grafana.172.19.0.6.nip.io"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            📊 Open Grafana
          </a>
          <a
            href="http://argocd.172.19.0.6.nip.io"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
          >
            🔄 Open ArgoCD
          </a>
          <div
            style={{
              marginLeft: 'auto',
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
              alignSelf: 'center',
            }}
          >
            Grafana: admin / prom-operator
          </div>
        </div>
      </div>

      {/* GitOps Status (mock) */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔄 ArgoCD Sync Status</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Application</th>
                <th>Status</th>
                <th>Last Sync</th>
              </tr>
            </thead>
            <tbody>
              {[
                { app: 'velya-web', status: 'Synced', time: '2min ago' },
                { app: 'velya-patient-flow', status: 'Synced', time: '5min ago' },
                { app: 'velya-discharge', status: 'Synced', time: '5min ago' },
                { app: 'velya-task-inbox', status: 'Synced', time: '7min ago' },
                { app: 'velya-ai-gateway', status: 'OutOfSync', time: '15min ago' },
                { app: 'velya-agents', status: 'Synced', time: '3min ago' },
              ].map((row) => (
                <tr key={row.app}>
                  <td className="text-sm font-semibold">{row.app}</td>
                  <td>
                    <span
                      className={`badge ${row.status === 'Synced' ? 'badge-success' : 'badge-warning'}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="text-xs text-tertiary">{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">⚡ KEDA Scaling</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Workload</th>
                <th>Replicas</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'patient-flow', replicas: 2, target: 2 },
                { name: 'discharge', replicas: 2, target: 2 },
                { name: 'task-inbox', replicas: 3, target: 3 },
                { name: 'ai-gateway', replicas: 1, target: 2 },
                { name: 'agents', replicas: 2, target: 2 },
                { name: 'policy-engine', replicas: 2, target: 2 },
              ].map((row) => (
                <tr key={row.name}>
                  <td className="text-sm font-semibold">{row.name}</td>
                  <td>
                    <strong
                      style={
                        row.replicas < row.target ? { color: 'var(--color-warning)' } : {}
                      }
                    >
                      {row.replicas}
                    </strong>
                  </td>
                  <td className="text-xs text-tertiary">{row.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Activity Log */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🤖 Agent Activity Log</span>
          <span className="badge badge-info">Live</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {AGENT_ACTIVITY.map((activity) => (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                  minWidth: '40px',
                  paddingTop: '2px',
                }}
              >
                {activity.timestamp}
              </div>
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--color-brand-highlight)',
                    }}
                  >
                    {activity.agent}
                  </span>
                  <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                    {activity.office}
                  </span>
                  <span className={`badge ${AGENT_STATUS_BADGE[activity.status]}`} style={{ fontSize: '10px' }}>
                    {AGENT_STATUS_LABEL[activity.status]}
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {activity.action}
                </div>
                {activity.patient && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Patient: {activity.patient}
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', minWidth: '60px' }}>
                {activity.id}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
