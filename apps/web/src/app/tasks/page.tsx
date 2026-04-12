'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import type {
  HospitalTask,
  TaskPriority,
  TaskStatus,
  TaskCategory,
} from '../../lib/hospital-task-types';
import { PRIORITY_ORDER } from '../../lib/hospital-task-types';

// ── Constants ──────────────────────────────────────────────────────

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: 'URGENTE',
  high: 'ALTO',
  normal: 'NORMAL',
  low: 'BAIXO',
};

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  assistencial: 'Assistencial',
  apoio: 'Apoio',
  administrativo: 'Administrativo',
};

interface KanbanColumn {
  key: string;
  label: string;
  statuses: TaskStatus[];
  collapsedByDefault?: boolean;
}

const COLUMNS: KanbanColumn[] = [
  { key: 'aguardando', label: 'Aguardando', statuses: ['open'] },
  { key: 'recebidas', label: 'Recebidas', statuses: ['received'] },
  { key: 'em-andamento', label: 'Em andamento', statuses: ['accepted', 'in_progress'] },
  { key: 'impedidas', label: 'Impedidas', statuses: ['blocked'] },
  { key: 'concluidas', label: 'Concluidas', statuses: ['completed', 'verified'], collapsedByDefault: true },
];

interface StatusAction {
  label: string;
  toStatus: TaskStatus;
  variant: 'default' | 'ghost' | 'outline';
  needsReason?: 'decline' | 'block';
}

const STATUS_ACTIONS: Partial<Record<TaskStatus, StatusAction[]>> = {
  open: [
    { label: 'Recebi', toStatus: 'received', variant: 'default' },
    { label: 'Recusar', toStatus: 'declined', variant: 'ghost', needsReason: 'decline' },
  ],
  received: [
    { label: 'Aceitar', toStatus: 'accepted', variant: 'default' },
    { label: 'Recusar', toStatus: 'declined', variant: 'ghost', needsReason: 'decline' },
  ],
  accepted: [
    { label: 'Iniciar', toStatus: 'in_progress', variant: 'default' },
  ],
  in_progress: [
    { label: 'Concluir', toStatus: 'completed', variant: 'default' },
    { label: 'Bloquear', toStatus: 'blocked', variant: 'outline', needsReason: 'block' },
  ],
  blocked: [
    { label: 'Desbloquear', toStatus: 'in_progress', variant: 'default' },
  ],
};

// ── SLA helper ─────────────────────────────────────────────────────

function computeSlaPercent(task: HospitalTask): number {
  const now = Date.now();
  const created = new Date(task.createdAt).getTime();
  const deadline = new Date(task.sla.completeBy).getTime();
  const total = deadline - created;
  if (total <= 0) return 100;
  const elapsed = now - created;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

// ── Loading skeleton ───────────────────────────────────────────────

function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-5 gap-4 mt-6">
      {Array.from({ length: 5 }).map((_, colIdx) => (
        <div key={colIdx} className="space-y-3">
          <div className="h-8 rounded bg-neutral-100 animate-pulse" />
          {Array.from({ length: colIdx === 4 ? 1 : 3 }).map((_, cardIdx) => (
            <div
              key={cardIdx}
              className="h-48 rounded-2xl border border-neutral-200 bg-white animate-pulse"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Task card ──────────────────────────────────────────────────────

interface TaskCardProps {
  task: HospitalTask;
  onAction: (taskId: string, toStatus: TaskStatus, extra?: Record<string, string>) => void;
}

function TaskCard({ task, onAction }: TaskCardProps) {
  const slaPercent = computeSlaPercent(task);
  const actions = STATUS_ACTIONS[task.status] ?? [];

  const handleAction = (action: StatusAction) => {
    if (action.needsReason === 'decline') {
      const reason = prompt('Motivo da recusa:');
      if (!reason) return;
      onAction(task.id, action.toStatus, {
        declineReason: 'other',
        declineReasonText: reason,
      });
    } else if (action.needsReason === 'block') {
      const reason = prompt('Motivo do bloqueio:');
      if (!reason) return;
      onAction(task.id, action.toStatus, {
        blockReason: 'other',
        blockReasonText: reason,
      });
    } else {
      onAction(task.id, action.toStatus);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      {/* Short code + priority */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-bold text-sm text-neutral-900">
          {task.shortCode}
        </span>
        <Badge variant="outline" size="sm">
          {PRIORITY_LABEL[task.priority]}
        </Badge>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-neutral-900 line-clamp-2 leading-snug">
        {task.title}
      </p>

      {/* Patient */}
      {task.patientName && (
        <p className="text-xs text-neutral-500 truncate">
          {task.patientName}
          {task.patientMrn ? ` (${task.patientMrn})` : ''}
        </p>
      )}

      {/* Ward + Bed */}
      <p className="text-xs text-neutral-500">
        {task.ward}
        {task.bed ? ` / Leito ${task.bed}` : ''}
      </p>

      {/* SLA bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-neutral-500 uppercase tracking-wide">SLA</span>
          <span className="text-[10px] font-medium text-neutral-700">{slaPercent}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-neutral-200">
          <div
            className="h-1.5 rounded-full bg-neutral-900 transition-all"
            style={{ width: `${slaPercent}%` }}
          />
        </div>
      </div>

      {/* Assigned to */}
      <p className="text-xs text-neutral-500 truncate">
        Resp: {task.assignedTo.name}
      </p>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex gap-2 pt-1">
          {actions.map((action) => (
            <Button
              key={action.toStatus}
              variant={action.variant}
              size="xs"
              className="flex-1"
              onClick={() => handleAction(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────────────────

interface ApiResponse {
  items: HospitalTask[];
  count: number;
  counts: Partial<Record<TaskStatus, number>>;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<HospitalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const col of COLUMNS) {
      if (col.collapsedByDefault) initial[col.key] = true;
    }
    return initial;
  });

  // ── Fetch ────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/hospital-tasks?inbox=true');
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      setTasks(data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ── Action handler ───────────────────────────────────────────────

  const handleAction = useCallback(
    async (taskId: string, toStatus: TaskStatus, extra?: Record<string, string>) => {
      const body: Record<string, string> = { status: toStatus, ...extra };
      const res = await fetch(`/api/hospital-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchTasks();
      }
    },
    [fetchTasks],
  );

  // ── Filtering ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = tasks;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.shortCode.toLowerCase().includes(q) ||
          t.patientName?.toLowerCase().includes(q) ||
          t.patientMrn?.toLowerCase().includes(q) ||
          t.assignedTo.name.toLowerCase().includes(q),
      );
    }
    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter);
    }
    if (categoryFilter !== 'all') {
      result = result.filter((t) => t.category === categoryFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    return [...result].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
  }, [tasks, searchQuery, priorityFilter, categoryFilter, statusFilter]);

  // ── KPIs ─────────────────────────────────────────────────────────

  const urgentCount = useMemo(
    () => tasks.filter((t) => t.priority === 'urgent' && t.status !== 'completed' && t.status !== 'verified' && t.status !== 'cancelled').length,
    [tasks],
  );
  const slaAtRiskCount = useMemo(
    () => tasks.filter((t) => {
      if (t.status === 'completed' || t.status === 'verified' || t.status === 'cancelled') return false;
      return computeSlaPercent(t) >= 80;
    }).length,
    [tasks],
  );
  const blockedCount = useMemo(
    () => tasks.filter((t) => t.status === 'blocked').length,
    [tasks],
  );

  // ── Column toggle ────────────────────────────────────────────────

  const toggleColumn = (key: string) => {
    setCollapsedColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Column data ──────────────────────────────────────────────────

  const columnTasks = useMemo(() => {
    const map: Record<string, HospitalTask[]> = {};
    for (const col of COLUMNS) {
      map[col.key] = filtered.filter((t) => col.statuses.includes(t.status));
    }
    return map;
  }, [filtered]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <AppShell pageTitle="Caixa de Tarefas">
      {/* Alert banner */}
      {urgentCount > 0 && (
        <div className="mb-5 rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">
            {urgentCount} tarefas urgentes requerem acao imediata
          </p>
        </div>
      )}

      {/* KPI badges */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <Badge variant="default" size="lg">{tasks.length} Total</Badge>
        <Badge variant="default" size="lg">{urgentCount} Urgentes</Badge>
        <Badge variant="default" size="lg">{slaAtRiskCount} SLA em risco</Badge>
        <Badge variant="default" size="lg">{blockedCount} Impedidas</Badge>
      </div>

      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <Input
          type="text"
          placeholder="Buscar tarefas, pacientes, MRN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
        />

        <select
          className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="all">Todas as Prioridades</option>
          <option value="urgent">Urgente</option>
          <option value="high">Alto</option>
          <option value="normal">Normal</option>
          <option value="low">Baixo</option>
        </select>

        <select
          className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">Todas as Categorias</option>
          {(Object.entries(CATEGORY_LABEL) as [TaskCategory, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos os Status</option>
          <option value="open">Aberta</option>
          <option value="received">Recebida</option>
          <option value="accepted">Aceita</option>
          <option value="in_progress">Em progresso</option>
          <option value="blocked">Impedida</option>
          <option value="completed">Concluida</option>
          <option value="verified">Verificada</option>
        </select>

        <div className="ml-auto">
          <Link href="/tasks/new">
            <Button variant="default" size="default">
              Nova Tarefa
            </Button>
          </Link>
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <KanbanSkeleton />
      ) : (
        <div className="grid grid-cols-5 gap-4">
          {COLUMNS.map((col) => {
            const items = columnTasks[col.key] ?? [];
            const isCollapsed = collapsedColumns[col.key] ?? false;

            return (
              <div key={col.key} className="flex flex-col min-h-0">
                {/* Column header */}
                <button
                  type="button"
                  onClick={() => toggleColumn(col.key)}
                  className="flex items-center gap-2 mb-3 text-left w-full"
                >
                  <h2 className="text-sm font-semibold text-neutral-900">{col.label}</h2>
                  <Badge variant="outline" size="sm">{items.length}</Badge>
                  {col.collapsedByDefault && (
                    <span className="text-xs text-neutral-500 ml-auto">
                      {isCollapsed ? 'Expandir' : 'Recolher'}
                    </span>
                  )}
                </button>

                {/* Cards */}
                {!isCollapsed && (
                  <div className="space-y-3 overflow-y-auto">
                    {items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-center">
                        <p className="text-xs text-neutral-500">Nenhuma tarefa</p>
                      </div>
                    ) : (
                      items.map((task) => (
                        <TaskCard key={task.id} task={task} onAction={handleAction} />
                      ))
                    )}
                  </div>
                )}

                {isCollapsed && items.length > 0 && (
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-center">
                    <p className="text-xs text-neutral-500">{items.length} tarefas concluidas</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-neutral-500 mt-4 text-right">
        Exibindo {filtered.length} de {tasks.length} tarefas
      </div>
    </AppShell>
  );
}
