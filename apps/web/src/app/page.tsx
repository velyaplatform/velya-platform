'use client';

import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BedDouble,
  ChevronRight,
  ClipboardList,
  Clock,
  DoorOpen,
  Flame,
  HeartPulse,
  Pill,
  Plus,
  Stethoscope,
  TrendingDown,
  Users,
} from 'lucide-react';
import { AppShell } from './components/app-shell';
import { News2RiskPanel } from './components/news2-risk-panel';
import { Card, CardContent, CardHeader } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { VelyaKPI } from './components/velya/velya-kpi';
import { VelyaAlertBanner } from './components/velya/velya-alert-banner';
import { VelyaStatusDot } from './components/velya/velya-status-dot';
import { VelyaSparkline } from './components/velya/velya-sparkline';
import { VelyaSectionHeader } from './components/velya/velya-section';
import {
  PRIORITY_TASKS,
  DISCHARGE_PATIENTS,
  type TaskRowProps,
  type DischargeRowProps,
} from '../lib/fixtures/home-dashboard';

function TaskRow({ priority, type, description, patient, assignee, due }: TaskRowProps) {
  const badgeVariant =
    priority === 'urgent' ? 'critical' : priority === 'warning' ? 'warning' : 'default';
  const badgeLabel =
    priority === 'urgent' ? 'URGENTE' : priority === 'warning' ? 'ALTO' : 'NORMAL';
  const borderColor =
    priority === 'urgent'
      ? 'border-l-red-500'
      : priority === 'warning'
        ? 'border-l-amber-500'
        : 'border-l-slate-300';

  return (
    <div
      className={`group mb-3 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md border-l-[3px] ${borderColor}`}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant={badgeVariant} size="sm" withDot>
            {badgeLabel}
          </Badge>
          <Badge variant="outline" size="sm">
            {type}
          </Badge>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-500">
            <Clock className="h-3 w-3" /> {due}
          </span>
        </div>
        <div className="mb-1 text-sm font-semibold text-slate-900">{description}</div>
        <div className="text-xs text-slate-500">
          <span className="font-mono text-blue-700">{patient}</span>
          <span className="mx-2 text-slate-600">·</span>
          <span className="text-slate-600">Responsável: {assignee}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <Button size="xs" variant="default">
          ✓ Concluir
        </Button>
        <Button size="xs" variant="ghost">
          <ArrowUpRight className="h-3 w-3" /> Escalar
        </Button>
      </div>
    </div>
  );
}

function DischargeRow({ mrn, name, ward, los, targetDate, blockers, status }: DischargeRowProps) {
  const config = {
    ready: { variant: 'success' as const, label: 'Pronto' },
    blocked: { variant: 'critical' as const, label: 'Bloqueado' },
    pending: { variant: 'warning' as const, label: 'Pendente' },
  }[status];

  return (
    <tr
      className={
        status === 'blocked'
          ? 'bg-red-50/50 hover:bg-red-50'
          : status === 'pending'
            ? 'bg-amber-50/50 hover:bg-amber-50'
            : 'hover:bg-slate-50'
      }
    >
      <td className="py-3 pr-4">
        <div className="font-semibold text-slate-900">{name}</div>
        <div className="font-mono text-[11px] text-slate-500">{mrn}</div>
      </td>
      <td className="py-3 pr-4 text-sm text-slate-700">{ward}</td>
      <td className="py-3 pr-4">
        <span className="font-mono font-semibold tabular-nums text-slate-900">{los}</span>
        <span className="text-xs text-slate-500">d</span>
      </td>
      <td className="py-3 pr-4 text-sm text-slate-700">{targetDate}</td>
      <td className="py-3 pr-4">
        {blockers.length === 0 ? (
          <span className="text-xs text-slate-500">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {blockers.map((b) => (
              <Badge key={b} variant="critical" size="sm">
                {b}
              </Badge>
            ))}
          </div>
        )}
      </td>
      <td className="py-3 pr-4">
        <Badge variant={config.variant} withDot>
          {config.label}
        </Badge>
      </td>
      <td className="py-3 pr-4">
        <Button asChild size="xs" variant="outline">
          <Link href="/discharge">Ver</Link>
        </Button>
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
    healthy: { tone: 'success' as const, label: 'Saudável', border: 'border-l-emerald-500' },
    degraded: { tone: 'warning' as const, label: 'Degradado', border: 'border-l-amber-500' },
    unknown: { tone: 'neutral' as const, label: 'Desconhecido', border: 'border-l-slate-400' },
  }[status];

  return (
    <Link
      href={`/system/services/${serviceId}`}
      className={`flex items-center gap-3 rounded-lg border border-slate-200 border-l-[3px] bg-white px-3 py-2.5 no-underline transition-all hover:border-slate-300 hover:shadow-sm ${cfg.border}`}
    >
      <VelyaStatusDot tone={cfg.tone} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900">{name}</div>
        <div className="text-[11px] text-slate-500">{cfg.label}</div>
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

const EXCEPTIONS = [
  {
    label: 'Tempo de Internação > 10d sem plano de alta',
    count: 3,
    tone: 'critical' as const,
    href: '/patients',
    icon: AlertTriangle,
  },
  {
    label: 'Sem documentação de visita médica hoje',
    count: 7,
    tone: 'warning' as const,
    href: '/tasks',
    icon: Stethoscope,
  },
  {
    label: 'Medicação não reconciliada',
    count: 2,
    tone: 'critical' as const,
    href: '/tasks',
    icon: Pill,
  },
  {
    label: 'Termos de consentimento ausentes',
    count: 4,
    tone: 'warning' as const,
    href: '/tasks',
    icon: ClipboardList,
  },
  {
    label: 'Encaminhamentos pendentes >48h',
    count: 2,
    tone: 'warning' as const,
    href: '/tasks',
    icon: ArrowUpRight,
  },
];

const TMI_TREND = [5.5, 5.8, 5.6, 5.4, 5.5, 5.3, 5.2];
const OCUPACAO_TREND = [82, 84, 85, 86, 85, 86, 87];
const ADMISSIONS_TREND = [4, 3, 5, 4, 6, 5, 3];

export default function CommandCenterPage() {
  return (
    <AppShell pageTitle="Centro de Comando">
      {/* Banner de Alerta Crítico */}
      <VelyaAlertBanner
        severity="critical"
        title="3 pacientes bloqueados para alta há mais de 24h"
        description="Eleanor Voss (transporte) · Marcus Bell (plano de saúde) · Diana Reyes (farmácia)"
        action={
          <Button asChild variant="destructive" size="sm">
            <Link href="/discharge">
              Resolver Agora <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
        className="mb-6"
      />

      {/* Page actions */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Visão geral
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/tools/sepsis">
              <HeartPulse className="h-3.5 w-3.5" /> NEWS2
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/patients/new">
              <Plus className="h-3.5 w-3.5" /> Novo Paciente
            </Link>
          </Button>
        </div>
      </div>

      {/* Bento Grid — KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <VelyaKPI
          label="Total Internados"
          value={47}
          sublabel="3 admitidos hoje"
          icon={Users}
          tone="info"
          footer={<VelyaSparkline data={ADMISSIONS_TREND} width={140} height={28} tone="accent" />}
        />
        <VelyaKPI
          label="Altas Pendentes"
          value={12}
          sublabel="Meta: alta até 14:00"
          icon={DoorOpen}
          tone="warning"
        />
        <VelyaKPI
          label="Altas Bloqueadas"
          value={5}
          sublabel="↑ 2 desde ontem"
          trend="up"
          icon={AlertTriangle}
          tone="critical"
        />
        <VelyaKPI
          label="Tempo de Internação Médio"
          value="5,2"
          sublabel="dias · ↓ 0,3d vs semana anterior"
          trend="down"
          icon={TrendingDown}
          tone="success"
          footer={<VelyaSparkline data={TMI_TREND} width={140} height={28} tone="success" />}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <VelyaKPI
          label="Tarefas Abertas"
          value={34}
          sublabel="12 vencem nas próximas 2h"
          icon={ClipboardList}
          tone="warning"
        />
        <VelyaKPI
          label="Ocupação de Leitos"
          value="87%"
          sublabel="52 / 60 leitos"
          icon={BedDouble}
          tone="accent"
          footer={<VelyaSparkline data={OCUPACAO_TREND} width={160} height={28} tone="accent" />}
        />
        <VelyaKPI
          label="Pacientes em Alerta"
          value={8}
          sublabel="NEWS2 ≥ 5 · Ativar Hour-1"
          icon={HeartPulse}
          tone="critical"
        />
      </div>

      {/* NEWS2 Clinical Decision Support */}
      <div className="mb-6">
        <News2RiskPanel />
      </div>

      {/* Main grid: tasks + exceptions + system health */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Caixa de Tarefas Prioritárias */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <VelyaSectionHeader
              title="Caixa de Ações Prioritárias"
              icon={Flame}
              action={
                <Button asChild variant="ghost" size="xs">
                  <Link href="/tasks">
                    Ver todas as 34 <ChevronRight className="h-3 w-3" />
                  </Link>
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            {PRIORITY_TASKS.map((task, i) => (
              <TaskRow key={i} {...task} />
            ))}
          </CardContent>
        </Card>

        {/* Right column: exceptions + system health */}
        <div className="flex flex-col gap-5">
          {/* Exceções */}
          <Card>
            <CardHeader>
              <VelyaSectionHeader title="Exceções — Em Risco Agora" icon={AlertTriangle} />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {EXCEPTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 no-underline transition-all hover:border-blue-300 hover:bg-blue-50"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        item.tone === 'critical'
                          ? 'bg-red-50 text-red-600 ring-1 ring-red-200'
                          : 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1 text-xs font-medium text-slate-800">
                      {item.label}
                    </span>
                    <Badge variant={item.tone} size="sm">
                      {item.count}
                    </Badge>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          {/* Saúde do Sistema */}
          <Card>
            <CardHeader>
              <VelyaSectionHeader
                title="Saúde do Sistema"
                icon={Activity}
                action={
                  <Button asChild variant="ghost" size="xs">
                    <Link href="/system">
                      Status <ChevronRight className="h-3 w-3" />
                    </Link>
                  </Button>
                }
              />
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              {SERVICES.map((svc) => (
                <ServiceStatus key={svc.name} {...svc} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Torre de Altas — Prévia */}
      <Card>
        <CardHeader>
          <VelyaSectionHeader
            title="Torre de Controle de Altas"
            icon={DoorOpen}
            action={
              <Button asChild variant="ghost" size="xs">
                <Link href="/discharge">
                  Torre completa <ChevronRight className="h-3 w-3" />
                </Link>
              </Button>
            }
          />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <th className="pb-3 pr-4">Paciente</th>
                <th className="pb-3 pr-4">Ala</th>
                <th className="pb-3 pr-4">Tempo de Internação</th>
                <th className="pb-3 pr-4">Alta Prevista</th>
                <th className="pb-3 pr-4">Bloqueios</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DISCHARGE_PATIENTS.map((p) => (
                <DischargeRow key={p.mrn} {...p} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
