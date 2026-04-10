import { AppShell } from './components/app-shell';
import Link from 'next/link';
import {
  PRIORITY_TASKS,
  DISCHARGE_PATIENTS,
  type TaskRowProps,
  type DischargeRowProps,
} from '../lib/fixtures/home-dashboard';

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

function TaskRow({ priority, type, description, patient, assignee, due }: TaskRowProps) {
  const borderClass =
    priority === 'urgent'
      ? 'task-item-urgent'
      : priority === 'warning'
        ? 'task-item-warning'
        : 'task-item-normal';

  const badgeClass =
    priority === 'urgent'
      ? 'badge-urgent'
      : priority === 'warning'
        ? 'badge-warning'
        : 'badge-neutral';

  const badgeLabel = priority === 'urgent' ? 'URGENTE' : priority === 'warning' ? 'ALTO' : 'NORMAL';

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
          Paciente: <strong>{patient}</strong> · Responsável: {assignee}
        </div>
      </div>
      <div className="flex flex-col gap-2" style={{ minWidth: '120px' }}>
        <button className="btn btn-primary btn-sm">✓ Concluir</button>
        <button className="btn btn-outline btn-sm">↑ Escalar</button>
      </div>
    </div>
  );
}

function DischargeRow({ mrn, name, ward, los, targetDate, blockers, status }: DischargeRowProps) {
  const statusConfig = {
    ready: { badge: 'badge-success', label: 'Pronto', dot: 'status-dot-green' },
    blocked: { badge: 'badge-critical', label: 'Bloqueado', dot: 'status-dot-red' },
    pending: { badge: 'badge-warning', label: 'Pendente', dot: 'status-dot-amber' },
  };

  const cfg = statusConfig[status];

  return (
    <tr
      className={status === 'blocked' ? 'row-critical' : status === 'pending' ? 'row-warning' : ''}
    >
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
          <span className="text-xs text-tertiary">Nenhum</span>
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
            Ver
          </Link>
        </div>
      </td>
    </tr>
  );
}

interface ServiceStatusProps {
  name: string;
  status: 'healthy' | 'degraded' | 'unknown';
  serviceId: string;
}

function ServiceStatus({ name, status, serviceId }: ServiceStatusProps) {
  const cfg = {
    healthy: { dot: 'status-dot-green', label: 'Saudável', card: 'service-card-healthy' },
    degraded: {
      dot: 'status-dot-amber status-dot-pulse',
      label: 'Degradado',
      card: 'service-card-degraded',
    },
    unknown: { dot: 'status-dot-grey', label: 'Desconhecido', card: 'service-card-unknown' },
  };
  const c = cfg[status];

  return (
    <Link href={`/system/services/${serviceId}`} style={{ textDecoration: 'none' }}>
      <div className={`service-card ${c.card}`}>
        <span className={`status-dot ${c.dot}`}></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {name}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {c.label}
          </div>
        </div>
      </div>
    </Link>
  );
}

const SERVICES: ServiceStatusProps[] = [
  { name: 'Fluxo de Pacientes', status: 'healthy', serviceId: 'patient-flow' },
  { name: 'Alta Hospitalar', status: 'healthy', serviceId: 'discharge' },
  { name: 'Caixa de Tarefas', status: 'healthy', serviceId: 'task-inbox' },
  { name: 'Auditoria', status: 'healthy', serviceId: 'audit' },
  { name: 'Gateway de IA', status: 'degraded', serviceId: 'ai-gateway' },
  { name: 'Motor de Políticas', status: 'healthy', serviceId: 'policy-engine' },
  { name: 'Agentes', status: 'healthy', serviceId: 'agents' },
];

export default function CommandCenterPage() {
  return (
    <AppShell pageTitle="Centro de Comando">
      {/* Banner de Alerta Crítico */}
      <div className="alert-banner alert-banner-critical">
        <span style={{ fontSize: '1.1rem' }}>🚨</span>
        <strong>3 pacientes bloqueados para alta há mais de 24h</strong>
        <span style={{ fontWeight: 400 }}>
          &mdash; Eleanor Voss (transporte), Marcus Bell (plano de saúde), Diana Reyes (farmácia)
        </span>
        <Link href="/discharge" className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }}>
          Resolver Agora →
        </Link>
      </div>

      {/* Métricas */}
      <div className="grid-metrics">
        <MetricCard
          label="Total Internados"
          value={47}
          sub="3 admitidos hoje"
          accent="var(--color-brand-highlight)"
        />
        <MetricCard
          label="Altas Pendentes"
          value={12}
          sub="Meta: alta até 14:00"
          accent="var(--color-warning)"
        />
        <MetricCard
          label="Altas Bloqueadas"
          value={5}
          sub="↑ 2 desde ontem"
          trendClass="metric-trend-up"
          accent="var(--color-critical)"
        />
        <MetricCard
          label="TMI Médio (dias)"
          value="5,2"
          sub="↓ 0,3d vs semana anterior"
          trendClass="metric-trend-down"
          accent="var(--color-success)"
        />
        <MetricCard
          label="Tarefas Abertas"
          value={34}
          sub="12 vencem nas próximas 2h"
          accent="var(--color-warning)"
        />
        <MetricCard
          label="Ocupação de Leitos"
          value="87%"
          sub="52 / 60 leitos"
          accent="var(--color-brand-deep)"
        />
      </div>

      {/* Grade principal */}
      <div className="grid-2">
        {/* Caixa de Tarefas Prioritárias */}
        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">⚡ Caixa de Ações Prioritárias</span>
              <Link href="/tasks" className="card-action">
                Ver Todas as 34 →
              </Link>
            </div>
            {PRIORITY_TASKS.map((task, i) => (
              <TaskRow key={i} {...task} />
            ))}
          </div>
        </div>

        {/* Coluna direita */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Quadro de Exceções */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">🔥 Exceções — Em Risco Agora</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                {
                  label: 'TMI > 10d sem plano de alta',
                  count: 3,
                  color: 'var(--color-critical)',
                  href: '/patients',
                },
                {
                  label: 'Sem documentação de visita médica hoje',
                  count: 7,
                  color: 'var(--color-warning)',
                  href: '/tasks',
                },
                {
                  label: 'Medicação não reconciliada',
                  count: 2,
                  color: 'var(--color-critical)',
                  href: '/tasks',
                },
                {
                  label: 'Termos de consentimento ausentes',
                  count: 4,
                  color: 'var(--color-warning)',
                  href: '/tasks',
                },
                {
                  label: 'Encaminhamentos pendentes há mais de 48h',
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

          {/* Saúde do Sistema */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">⚙️ Saúde do Sistema</span>
              <Link href="/system" className="card-action">
                Status Completo →
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

      {/* Torre de Altas — Prévia */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header">
          <span className="card-title">🏠 Torre de Controle de Altas</span>
          <Link href="/discharge" className="card-action">
            Torre Completa →
          </Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Ala</th>
                <th>TMI</th>
                <th>Alta Prevista</th>
                <th>Bloqueios</th>
                <th>Status</th>
                <th>Ações</th>
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
