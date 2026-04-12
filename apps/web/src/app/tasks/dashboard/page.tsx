'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppShell } from '../../components/app-shell';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import type {
  HospitalTask,
  TaskCategory,
  TaskHistoryEntry,
} from '../../../lib/hospital-task-types';

// ── Constants ──────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set([
  'completed',
  'verified',
  'cancelled',
  'declined',
  'expired',
]);

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  assistencial: 'Assistencial',
  apoio: 'Apoio',
  administrativo: 'Administrativo',
};

const ACTION_LABEL: Record<string, string> = {
  created: 'Criou',
  sent: 'Enviou',
  received: 'Recebeu',
  accepted: 'Aceitou',
  declined: 'Recusou',
  started: 'Iniciou',
  blocked: 'Bloqueou',
  unblocked: 'Desbloqueou',
  completed: 'Concluiu',
  verified: 'Verificou',
  escalated: 'Escalou',
  reassigned: 'Reatribuiu',
  cancelled: 'Cancelou',
  commented: 'Comentou',
  evidence_attached: 'Anexou evidencia',
  sla_warning: 'Alerta SLA',
  sla_breach: 'Violacao SLA',
};

const DEFAULT_WARD = 'Ala 3B';

const WARDS = [
  'Ala 3B',
  'Ala 2A',
  'Ala 4C',
  'UTI Adulto',
  'UTI Neonatal',
  'Emergencia',
  'Centro Cirurgico',
];

// ── Helpers ────────────────────────────────────────────────────────

function computeSlaPercent(task: HospitalTask): number {
  const now = Date.now();
  const created = new Date(task.createdAt).getTime();
  const deadline = new Date(task.sla.completeBy).getTime();
  const total = deadline - created;
  if (total <= 0) return 100;
  const elapsed = now - created;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

function formatTimeRemaining(task: HospitalTask): string {
  const deadline = new Date(task.sla.completeBy).getTime();
  const now = Date.now();
  const remaining = deadline - now;
  if (remaining <= 0) return 'Expirado';
  const minutes = Math.floor(remaining / 60_000);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}min`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatTaskAge(createdAt: string): string {
  const age = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(age / 60_000);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hours}:${mins}`;
}

// ── API response ───────────────────────────────────────────────────

interface ApiResponse {
  items: HospitalTask[];
  count: number;
}

// ── Professional distribution ──────────────────────────────────────

interface ProfessionalRow {
  name: string;
  role: string;
  taskCount: number;
  oldestTaskAge: string;
}

// ── Loading skeleton ───────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-lg border border-neutral-200 bg-white animate-pulse"
          />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-48 rounded-lg border border-neutral-200 bg-white animate-pulse"
        />
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────

export default function TaskDashboardPage() {
  const [tasks, setTasks] = useState<HospitalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [ward, setWard] = useState(DEFAULT_WARD);

  // ── Fetch ──────────────────────────────────────────────────────

  const fetchTasks = useCallback(async (selectedWard: string) => {
    try {
      const params = new URLSearchParams({ ward: selectedWard });
      const res = await fetch(`/api/hospital-tasks?${params.toString()}`);
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      setTasks(data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTasks(ward);
  }, [ward, fetchTasks]);

  // ── Derived data ───────────────────────────────────────────────

  const activeTasks = useMemo(
    () => tasks.filter((t) => !TERMINAL_STATUSES.has(t.status)),
    [tasks],
  );

  const totalActive = activeTasks.length;

  const slaCumprido = useMemo(() => {
    if (activeTasks.length === 0) return 100;
    const onTrack = activeTasks.filter((t) => !t.sla.breached).length;
    return Math.round((onTrack / activeTasks.length) * 100);
  }, [activeTasks]);

  const blockedCount = useMemo(
    () => tasks.filter((t) => t.status === 'blocked').length,
    [tasks],
  );

  const escalatedCount = useMemo(
    () => tasks.filter((t) => t.status === 'escalated').length,
    [tasks],
  );

  // ── Distribution by professional ──────────────────────────────

  const professionalRows = useMemo<ProfessionalRow[]>(() => {
    const map = new Map<
      string,
      { name: string; role: string; count: number; oldest: number }
    >();
    for (const task of activeTasks) {
      const key = task.assignedTo.id;
      const existing = map.get(key);
      const taskCreated = new Date(task.createdAt).getTime();
      if (existing) {
        existing.count += 1;
        if (taskCreated < existing.oldest) {
          existing.oldest = taskCreated;
        }
      } else {
        map.set(key, {
          name: task.assignedTo.name,
          role: task.assignedTo.role,
          count: 1,
          oldest: taskCreated,
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .map((p) => ({
        name: p.name,
        role: p.role,
        taskCount: p.count,
        oldestTaskAge: formatTaskAge(new Date(p.oldest).toISOString()),
      }));
  }, [activeTasks]);

  // ── Tasks at SLA risk (>75% consumed) ─────────────────────────

  const slaRiskTasks = useMemo(
    () =>
      activeTasks
        .filter((t) => computeSlaPercent(t) > 75)
        .sort((a, b) => computeSlaPercent(b) - computeSlaPercent(a)),
    [activeTasks],
  );

  // ── Category breakdown ────────────────────────────────────────

  const categoryBreakdown = useMemo(() => {
    const counts: Record<TaskCategory, number> = {
      assistencial: 0,
      apoio: 0,
      administrativo: 0,
    };
    for (const task of activeTasks) {
      counts[task.category] += 1;
    }
    const total = activeTasks.length || 1;
    return (Object.keys(counts) as TaskCategory[]).map((cat) => ({
      category: cat,
      label: CATEGORY_LABEL[cat],
      count: counts[cat],
      percent: Math.round((counts[cat] / total) * 100),
    }));
  }, [activeTasks]);

  // ── Recent activity ───────────────────────────────────────────

  const recentActivity = useMemo(() => {
    const entries: (TaskHistoryEntry & { taskShortCode: string })[] = [];
    for (const task of tasks) {
      for (const entry of task.history) {
        entries.push({ ...entry, taskShortCode: task.shortCode });
      }
    }
    return entries
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 20);
  }, [tasks]);

  // ── Action handlers ───────────────────────────────────────────

  const handleReassign = useCallback(
    async (taskId: string) => {
      const newAssignee = prompt('Nome do novo responsavel:');
      if (!newAssignee) return;
      const res = await fetch(`/api/hospital-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'reassigned' }),
      });
      if (res.ok) {
        fetchTasks(ward);
      }
    },
    [fetchTasks, ward],
  );

  const handleEscalate = useCallback(
    async (taskId: string) => {
      const res = await fetch(`/api/hospital-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'escalated' }),
      });
      if (res.ok) {
        fetchTasks(ward);
      }
    },
    [fetchTasks, ward],
  );

  // ── Render ────────────────────────────────────────────────────

  return (
    <AppShell pageTitle="Painel Tatico de Tarefas">
      {/* Ward selector */}
      <div className="flex items-center gap-3 mb-6">
        <label
          htmlFor="ward-select"
          className="text-sm font-medium text-neutral-700"
        >
          Ala:
        </label>
        <select
          id="ward-select"
          className="h-9 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
          value={ward}
          onChange={(e) => setWard(e.target.value)}
        >
          {WARDS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-8">
          {/* ── KPI Cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-neutral-200 rounded-lg p-5">
              <p className="text-xs uppercase text-neutral-500 tracking-wide">
                Total de tarefas
              </p>
              <p className="text-3xl font-bold text-neutral-900 mt-1">
                {totalActive}
              </p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-5">
              <p className="text-xs uppercase text-neutral-500 tracking-wide">
                SLA Cumprido
              </p>
              <p className="text-3xl font-bold text-neutral-900 mt-1">
                {slaCumprido}%
              </p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-5">
              <p className="text-xs uppercase text-neutral-500 tracking-wide">
                Impedidas
              </p>
              <p className="text-3xl font-bold text-neutral-900 mt-1">
                {blockedCount}
              </p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-5">
              <p className="text-xs uppercase text-neutral-500 tracking-wide">
                Escaladas
              </p>
              <p className="text-3xl font-bold text-neutral-900 mt-1">
                {escalatedCount}
              </p>
            </div>
          </div>

          {/* ── Distribution by Professional ─────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-neutral-900">
                Distribuicao por Profissional
              </h2>
            </CardHeader>
            <CardContent>
              {professionalRows.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Nenhuma tarefa ativa atribuida.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-50">
                        <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                          Profissional
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                          Funcao
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                          Tarefas
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                          Tarefa mais antiga
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {professionalRows.map((row) => (
                        <tr
                          key={row.name}
                          className="border-t border-neutral-100"
                        >
                          <td className="px-3 py-2 text-neutral-900 font-medium">
                            {row.name}
                          </td>
                          <td className="px-3 py-2 text-neutral-700">
                            {row.role}
                          </td>
                          <td className="px-3 py-2 text-right text-neutral-900 font-semibold">
                            {row.taskCount}
                          </td>
                          <td className="px-3 py-2 text-right text-neutral-500">
                            {row.oldestTaskAge}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Tasks at SLA Risk ────────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-neutral-900">
                Tarefas em Risco de SLA
              </h2>
              <Badge variant="outline" size="sm">
                {slaRiskTasks.length}
              </Badge>
            </CardHeader>
            <CardContent>
              {slaRiskTasks.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Nenhuma tarefa com SLA acima de 75%.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-50">
                        <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                          Codigo
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                          Titulo
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                          Responsavel
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                          Tempo restante
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                          Ala
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                          Acoes
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {slaRiskTasks.map((task) => (
                        <tr
                          key={task.id}
                          className="border-t border-neutral-100"
                        >
                          <td className="px-3 py-2 font-mono text-neutral-900 font-medium">
                            {task.shortCode}
                          </td>
                          <td className="px-3 py-2 text-neutral-900 max-w-xs truncate">
                            {task.title}
                          </td>
                          <td className="px-3 py-2 text-neutral-700">
                            {task.assignedTo.name}
                          </td>
                          <td className="px-3 py-2 text-right text-neutral-900 font-semibold">
                            {formatTimeRemaining(task)}
                          </td>
                          <td className="px-3 py-2 text-neutral-500">
                            {task.ward}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => handleReassign(task.id)}
                              >
                                Reatribuir
                              </Button>
                              <Button
                                variant="default"
                                size="xs"
                                onClick={() => handleEscalate(task.id)}
                              >
                                Escalar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Category Breakdown ───────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-neutral-900">
                Distribuicao por Categoria
              </h2>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                        Categoria
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                        Quantidade
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-neutral-500 uppercase">
                        % do total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryBreakdown.map((row) => (
                      <tr
                        key={row.category}
                        className="border-t border-neutral-100"
                      >
                        <td className="px-3 py-2 text-neutral-900 font-medium">
                          {row.label}
                        </td>
                        <td className="px-3 py-2 text-right text-neutral-900 font-semibold">
                          {row.count}
                        </td>
                        <td className="px-3 py-2 text-right text-neutral-500">
                          {row.percent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── Recent Activity ──────────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-neutral-900">
                Atividade Recente
              </h2>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Nenhuma atividade registrada.
                </p>
              ) : (
                <div className="space-y-0">
                  {recentActivity.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className={`flex items-start gap-3 py-3 ${
                        idx < recentActivity.length - 1
                          ? 'border-b border-neutral-100'
                          : ''
                      }`}
                    >
                      {/* Timeline dot */}
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-neutral-300 shrink-0" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-neutral-500">
                            {formatTimestamp(entry.timestamp)}
                          </span>
                          <span className="text-sm font-medium text-neutral-900">
                            {entry.actor.name}
                          </span>
                          <span className="text-sm text-neutral-700">
                            {ACTION_LABEL[entry.action] ?? entry.action}
                          </span>
                          <span className="font-mono text-xs text-neutral-500">
                            {entry.taskShortCode}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="text-xs text-neutral-500 mt-0.5 truncate">
                            {entry.note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
