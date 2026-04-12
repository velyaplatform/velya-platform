'use client';

import { useState, useEffect, useMemo, useCallback, useRef, type DragEvent } from 'react';
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

// ── Drag-and-drop transition rules ────────────────────────────────

/** Maps column key -> allowed target column keys and the resulting status */
interface DropTransition {
  toStatus: TaskStatus;
  needsReason?: 'block';
}

const VALID_DROPS: Record<string, Record<string, DropTransition>> = {
  aguardando: {
    recebidas: { toStatus: 'received' },
  },
  recebidas: {
    'em-andamento': { toStatus: 'accepted' },
  },
  'em-andamento': {
    impedidas: { toStatus: 'blocked', needsReason: 'block' },
    concluidas: { toStatus: 'completed' },
  },
  impedidas: {
    'em-andamento': { toStatus: 'in_progress' },
  },
};

function canDropOnColumn(sourceColumnKey: string, targetColumnKey: string): boolean {
  if (sourceColumnKey === targetColumnKey) return false;
  return Boolean(VALID_DROPS[sourceColumnKey]?.[targetColumnKey]);
}

function getDropTransition(sourceColumnKey: string, targetColumnKey: string): DropTransition | null {
  return VALID_DROPS[sourceColumnKey]?.[targetColumnKey] ?? null;
}

function getColumnKeyForTask(task: HospitalTask): string {
  for (const col of COLUMNS) {
    if (col.statuses.includes(task.status)) return col.key;
  }
  return 'aguardando';
}

// ── SLA helpers ───────────────────────────────────────────────────

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
  const now = Date.now();
  const deadline = new Date(task.sla.completeBy).getTime();
  const diff = deadline - now;
  if (diff <= 0) {
    const overMs = Math.abs(diff);
    const overMin = Math.floor(overMs / 60000);
    if (overMin < 60) return `Atrasado ${overMin}min`;
    const overH = Math.floor(overMin / 60);
    return `Atrasado ${overH}h ${overMin % 60}min`;
  }
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}min restantes`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}min restantes`;
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

// ── Drag handle icon (6 dots) ─────────────────────────────────────

function DragHandleIcon() {
  return (
    <svg
      width="10"
      height="18"
      viewBox="0 0 10 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-neutral-400"
    >
      <circle cx="2.5" cy="2.5" r="1.5" fill="currentColor" />
      <circle cx="7.5" cy="2.5" r="1.5" fill="currentColor" />
      <circle cx="2.5" cy="9" r="1.5" fill="currentColor" />
      <circle cx="7.5" cy="9" r="1.5" fill="currentColor" />
      <circle cx="2.5" cy="15.5" r="1.5" fill="currentColor" />
      <circle cx="7.5" cy="15.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

// ── Delegation form ───────────────────────────────────────────────

interface DelegationFormProps {
  onDelegate: (name: string, role: string) => void;
  onCancel: () => void;
}

function DelegationForm({ onDelegate, onCancel }: DelegationFormProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    if (!trimmedName || !trimmedRole) return;
    onDelegate(trimmedName, trimmedRole);
  };

  return (
    <div className="mt-2 space-y-2 border-t border-neutral-200 pt-2">
      <p className="text-xs font-semibold text-neutral-700">Delegar tarefa</p>
      <Input
        ref={nameRef}
        type="text"
        placeholder="Nome do responsavel"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 text-xs"
      />
      <Input
        type="text"
        placeholder="Cargo / funcao"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="h-8 text-xs"
      />
      <div className="flex gap-2">
        <Button
          variant="default"
          size="xs"
          className="flex-1"
          onClick={handleSubmit}
          disabled={!name.trim() || !role.trim()}
        >
          Confirmar
        </Button>
        <Button variant="ghost" size="xs" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ── Task card ──────────────────────────────────────────────────────

interface TaskCardProps {
  task: HospitalTask;
  onAction: (taskId: string, toStatus: TaskStatus, extra?: Record<string, string>) => void;
  onDelegate: (taskId: string, name: string, role: string) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, task: HospitalTask) => void;
}

function TaskCard({ task, onAction, onDelegate, onDragStart }: TaskCardProps) {
  const slaPercent = computeSlaPercent(task);
  const slaBreached = task.sla.breached || slaPercent >= 100;
  const slaAtRisk = slaPercent > 90;
  const timeRemaining = formatTimeRemaining(task);
  const actions = STATUS_ACTIONS[task.status] ?? [];
  const [showDelegation, setShowDelegation] = useState(false);

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

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    onDragStart(e, task);
  };

  const handleDelegateSubmit = (name: string, role: string) => {
    onDelegate(task.id, name, role);
    setShowDelegation(false);
  };

  // SLA bar intensity: darker as it approaches deadline
  const slaBarOpacity = slaBreached ? 'bg-neutral-900' : slaAtRisk ? 'bg-neutral-800' : 'bg-neutral-500';

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      className={[
        'p-0 cursor-grab active:cursor-grabbing transition-opacity',
        slaAtRisk ? 'border-2 border-neutral-400' : '',
        slaBreached ? 'border-2 border-neutral-900' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex">
        {/* Drag handle */}
        <div className="flex items-center justify-center px-2 shrink-0 bg-neutral-50 rounded-l-2xl border-r border-neutral-200">
          <DragHandleIcon />
        </div>

        {/* Card content */}
        <div className="flex-1 p-3 space-y-2 min-w-0">
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
              <span className="text-[10px] font-medium text-neutral-700">{timeRemaining}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-neutral-200">
              <div
                className={`h-2 rounded-full transition-all ${slaBarOpacity}`}
                style={{ width: `${Math.min(slaPercent, 100)}%` }}
              />
            </div>
            {slaBreached && (
              <Badge variant="default" size="sm" className="mt-1 bg-neutral-900 text-white border-neutral-900">
                SLA ESTOURADO
              </Badge>
            )}
          </div>

          {/* Assignee + Delegar */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-neutral-900 truncate">
                {task.assignedTo.name}
              </p>
              <p className="text-[10px] text-neutral-500 truncate">
                {task.assignedTo.role}
              </p>
            </div>
            {task.status !== 'completed' && task.status !== 'verified' && task.status !== 'cancelled' && (
              <Button
                variant="ghost"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDelegation(!showDelegation);
                }}
              >
                Delegar
              </Button>
            )}
          </div>

          {/* Delegation form */}
          {showDelegation && (
            <DelegationForm
              onDelegate={handleDelegateSubmit}
              onCancel={() => setShowDelegation(false)}
            />
          )}

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
        </div>
      </div>
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

  // Drag-and-drop state
  const [draggedTask, setDraggedTask] = useState<HospitalTask | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

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

  // ── Delegation handler ──────────────────────────────────────────

  const handleDelegate = useCallback(
    async (taskId: string, name: string, role: string) => {
      const body = {
        status: 'reassigned' as const,
        newAssignedTo: { name, role },
      };
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

  // ── Drag-and-drop handlers ─────────────────────────────────────

  const handleDragStart = useCallback((_e: DragEvent<HTMLDivElement>, task: HospitalTask) => {
    setDraggedTask(task);
  }, []);

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>, targetColumnKey: string) => {
      if (!draggedTask) return;
      const sourceColumnKey = getColumnKeyForTask(draggedTask);
      if (canDropOnColumn(sourceColumnKey, targetColumnKey)) {
        e.preventDefault();
        setDragOverColumn(targetColumnKey);
      }
    },
    [draggedTask],
  );

  const handleDragLeave = useCallback((_e: DragEvent<HTMLDivElement>) => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>, targetColumnKey: string) => {
      e.preventDefault();
      setDragOverColumn(null);

      if (!draggedTask) return;

      const sourceColumnKey = getColumnKeyForTask(draggedTask);
      const transition = getDropTransition(sourceColumnKey, targetColumnKey);

      if (!transition) return;

      if (transition.needsReason === 'block') {
        const reason = prompt('Motivo do bloqueio:');
        if (!reason) {
          setDraggedTask(null);
          return;
        }
        await handleAction(draggedTask.id, transition.toStatus, {
          blockReason: 'other',
          blockReasonText: reason,
        });
      } else {
        await handleAction(draggedTask.id, transition.toStatus);
      }

      setDraggedTask(null);
    },
    [draggedTask, handleAction],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
    setDragOverColumn(null);
  }, []);

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
        <div
          className="grid grid-cols-5 gap-4"
          onDragEnd={handleDragEnd}
        >
          {COLUMNS.map((col) => {
            const items = columnTasks[col.key] ?? [];
            const isCollapsed = collapsedColumns[col.key] ?? false;
            const isDropTarget = dragOverColumn === col.key;
            const isValidTarget = draggedTask
              ? canDropOnColumn(getColumnKeyForTask(draggedTask), col.key)
              : false;

            return (
              <div
                key={col.key}
                className="flex flex-col min-h-0"
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.key)}
              >
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

                {/* Cards area */}
                {!isCollapsed && (
                  <div
                    className={[
                      'space-y-3 overflow-y-auto max-h-[calc(100vh-320px)] rounded-lg p-1 transition-all',
                      isDropTarget
                        ? 'border-2 border-dashed border-neutral-400 bg-neutral-100'
                        : isValidTarget && draggedTask
                          ? 'border-2 border-dashed border-neutral-300 bg-neutral-50'
                          : 'border-2 border-transparent',
                    ].join(' ')}
                  >
                    {items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-center">
                        <p className="text-xs text-neutral-500">Nenhuma tarefa</p>
                      </div>
                    ) : (
                      items.map((task) => (
                        <div
                          key={task.id}
                          className={
                            draggedTask?.id === task.id ? 'opacity-40' : ''
                          }
                        >
                          <TaskCard
                            task={task}
                            onAction={handleAction}
                            onDelegate={handleDelegate}
                            onDragStart={handleDragStart}
                          />
                        </div>
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
