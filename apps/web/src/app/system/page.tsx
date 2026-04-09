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
    name: 'Fluxo de Pacientes',
    url: 'http://patient-flow.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Rastreamento em tempo real e orquestração do fluxo de pacientes',
    category: 'core',
  },
  {
    name: 'Serviço de Alta',
    url: 'http://discharge.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Planejamento de altas, bloqueios e coordenação',
    category: 'core',
  },
  {
    name: 'Caixa de Tarefas',
    url: 'http://task-inbox.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Roteamento de tarefas clínicas e administrativas por prioridade',
    category: 'core',
  },
  {
    name: 'Auditoria',
    url: 'http://audit.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Trilha de auditoria clínica e operacional com conformidade HIPAA',
    category: 'platform',
  },
  {
    name: 'Motor de Políticas',
    url: 'http://policy-engine.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Controle de acesso por papel e aplicação de políticas clínicas',
    category: 'platform',
  },
  {
    name: 'Gateway de IA',
    url: 'http://ai-gateway.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Gateway unificado de IA com redação de PHI e controle de taxa',
    category: 'ai',
  },
  {
    name: 'Agentes',
    url: 'http://agents.172.19.0.6.nip.io',
    healthPath: '/api/v1/health',
    description: 'Motor de execução de agentes de IA clínicos e operacionais',
    category: 'ai',
  },
  {
    name: 'Grafana',
    url: 'http://grafana.172.19.0.6.nip.io',
    healthPath: '/api/health',
    description: 'Dashboards de observabilidade e alertas da plataforma',
    category: 'observability',
  },
  {
    name: 'ArgoCD',
    url: 'http://argocd.172.19.0.6.nip.io',
    healthPath: '/healthz',
    description: 'Entrega contínua GitOps e status de sincronização',
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
    office: 'Ops Clínicas',
    action: 'Identificados 5 pacientes com TMI acima do limite — planos de alta gerados',
    patient: 'MRN-004, MRN-007, MRN-013',
    timestamp: '09:45',
    status: 'completed',
  },
  {
    id: 'A-002',
    agent: 'clinical-triage-agent',
    office: 'Clínico',
    action: '34 tarefas priorizadas e roteadas para as equipes responsáveis',
    timestamp: '09:30',
    status: 'completed',
  },
  {
    id: 'A-003',
    agent: 'quality-audit-agent',
    office: 'Qualidade',
    action: 'Sinalizando 7 pacientes sem documentação de visita médica',
    timestamp: '09:15',
    status: 'in-progress',
  },
  {
    id: 'A-004',
    agent: 'medication-reconciliation-agent',
    office: 'Farmácia',
    action: 'Reconciliação medicamentosa falhou — erro de validação de PHI',
    patient: 'MRN-006',
    timestamp: '08:55',
    status: 'failed',
  },
  {
    id: 'A-005',
    agent: 'insurance-auth-agent',
    office: 'Receita',
    action: 'Pré-autorização pendente há mais de 48h — escalada para revisor humano',
    patient: 'MRN-007',
    timestamp: '08:30',
    status: 'escalated',
  },
  {
    id: 'A-006',
    agent: 'discharge-coordinator-agent',
    office: 'Ops Clínicas',
    action: 'Solicitações de coordenação de transporte enviadas para 3 pacientes',
    timestamp: '08:00',
    status: 'completed',
  },
  {
    id: 'A-007',
    agent: 'clinical-triage-agent',
    office: 'Clínico',
    action: 'Escalada NEWS2 acionada para Ala 2A leito 2A-10',
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
  completed: 'Concluído',
  'in-progress': 'Em Progresso',
  failed: 'Falhou',
  escalated: 'Escalado',
};

const CATEGORY_LABELS: Record<ServiceDef['category'], string> = {
  core: '🏥 Serviços Core',
  ai: '🤖 IA & Agentes',
  platform: '🔐 Plataforma',
  observability: '📊 Observabilidade',
};

interface ServiceCardProps {
  service: ServiceDef;
  health: ServiceHealth;
  latency?: number;
  onCheck: (url: string) => void;
}

function ServiceCard({ service, health, latency, onCheck }: ServiceCardProps) {
  const statusConfig = {
    healthy: { dot: 'status-dot-green', card: 'service-card-healthy', label: 'Saudável' },
    degraded: { dot: 'status-dot-amber status-dot-pulse', card: 'service-card-degraded', label: 'Degradado' },
    down: { dot: 'status-dot-red status-dot-pulse', card: 'service-card-down', label: 'Indisponível' },
    unknown: { dot: 'status-dot-grey', card: 'service-card-unknown', label: 'Desconhecido' },
    checking: { dot: 'status-dot-grey status-dot-pulse', card: 'service-card-unknown', label: 'Verificando...' },
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
          Re-verificar
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
    <AppShell pageTitle="Status do Sistema">
      <div className="page-header">
        <h1 className="page-title">Status do Sistema &amp; Console de Agentes</h1>
        <p className="page-subtitle">
          Verificações de saúde em tempo real de todos os serviços da plataforma Velya
        </p>
      </div>

      {/* Status geral */}
      <div className="grid-metrics" style={{ marginBottom: '1.5rem' }}>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-success)' }}>
          <div className="metric-label">Saudável</div>
          <div className="metric-value" style={{ color: 'var(--color-success)' }}>{healthyCount}</div>
          <div className="metric-sub">Serviços operacionais</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-warning)' }}>
          <div className="metric-label">Degradado</div>
          <div className="metric-value" style={{ color: 'var(--color-warning)' }}>{degradedCount}</div>
          <div className="metric-sub">Desempenho reduzido</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-critical)' }}>
          <div className="metric-label">Indisponível</div>
          <div className="metric-value" style={{ color: 'var(--color-critical)' }}>{downCount}</div>
          <div className="metric-sub">Serviço fora do ar</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-neutral)' }}>
          <div className="metric-label">Desconhecido</div>
          <div className="metric-value">{unknownCount}</div>
          <div className="metric-sub">Verificando / inacessível</div>
        </div>
      </div>

      {/* Grade de serviços por categoria */}
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

      {/* Dashboards externos */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">🔗 Dashboards Externos</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          <a
            href="http://grafana.172.19.0.6.nip.io"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            📊 Abrir Grafana
          </a>
          <a
            href="http://argocd.172.19.0.6.nip.io"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
          >
            🔄 Abrir ArgoCD
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

      {/* Status GitOps (simulado) */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔄 Status de Sync ArgoCD</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Aplicação</th>
                <th>Status</th>
                <th>Último Sync</th>
              </tr>
            </thead>
            <tbody>
              {[
                { app: 'velya-web', status: 'Synced', time: 'há 2min' },
                { app: 'velya-patient-flow', status: 'Synced', time: 'há 5min' },
                { app: 'velya-discharge', status: 'Synced', time: 'há 5min' },
                { app: 'velya-task-inbox', status: 'Synced', time: 'há 7min' },
                { app: 'velya-ai-gateway', status: 'OutOfSync', time: 'há 15min' },
                { app: 'velya-agents', status: 'Synced', time: 'há 3min' },
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
            <span className="card-title">⚡ Escalonamento KEDA</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Workload</th>
                <th>Réplicas</th>
                <th>Alvo</th>
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

      {/* Log de Atividade dos Agentes */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🤖 Log de Atividade dos Agentes</span>
          <span className="badge badge-info">Ao Vivo</span>
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
                    Paciente: {activity.patient}
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
