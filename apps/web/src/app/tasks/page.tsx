'use client';

import { useState, useMemo } from 'react';
import { AppShell } from '../components/app-shell';
import {
  MOCK_TASKS,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskGroup,
} from '../../lib/fixtures/tasks';

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  urgent: 'badge-urgent',
  high: 'badge-critical',
  normal: 'badge-warning',
  low: 'badge-neutral',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: 'URGENTE',
  high: 'ALTO',
  normal: 'NORMAL',
  low: 'BAIXO',
};

const BORDER_CLASS: Record<TaskPriority, string> = {
  urgent: 'task-item-urgent',
  high: 'task-item-urgent',
  normal: 'task-item-warning',
  low: 'task-item-normal',
};

const STATUS_BADGE: Record<TaskStatus, string> = {
  open: 'badge-info',
  'in-progress': 'badge-warning',
  deferred: 'badge-neutral',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Aberta',
  'in-progress': 'Em Progresso',
  deferred: 'Adiada',
};

const GROUPS: TaskGroup[] = ['Urgent', 'Clinical', 'Administrative', 'Coordination'];

const GROUP_DISPLAY: Record<TaskGroup, string> = {
  Urgent: 'Urgente',
  Clinical: 'Clínico',
  Administrative: 'Administrativo',
  Coordination: 'Coordenação',
};

interface TaskCardProps {
  task: Task;
  onComplete: (id: string) => void;
  onDefer: (id: string) => void;
  onEscalate: (id: string) => void;
}

function TaskCard({ task, onComplete, onDefer, onEscalate }: TaskCardProps) {
  return (
    <div className={`task-item ${BORDER_CLASS[task.priority]}`}>
      <div style={{ flex: 1 }}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`badge ${PRIORITY_BADGE[task.priority]}`}>
            {PRIORITY_LABEL[task.priority]}
          </span>
          <span className="badge badge-neutral">{task.type}</span>
          <span className={`badge ${STATUS_BADGE[task.status]}`}>{STATUS_LABEL[task.status]}</span>
          <span className="text-xs text-tertiary ml-auto">{task.dueIn}</span>
        </div>
        <div
          className="font-semibold"
          style={{ fontSize: '0.9375rem', marginBottom: '6px', color: 'var(--text-primary)' }}
        >
          {task.description}
        </div>
        <div className="text-xs text-secondary" style={{ marginBottom: '4px' }}>
          Paciente:{' '}
          <strong>
            {task.patient} ({task.mrn})
          </strong>
          &nbsp;&middot;&nbsp;{task.context}
        </div>
        <div className="text-xs text-tertiary">
          Responsável: {task.assignedTo} &middot; Criada: {task.createdAt} &middot; ID: {task.id}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          minWidth: '130px',
          paddingLeft: '1rem',
        }}
      >
        <button className="btn btn-primary btn-sm" onClick={() => onComplete(task.id)}>
          ✓ Concluir
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onEscalate(task.id)}>
          ↑ Escalar
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => onDefer(task.id)}>
          ↷ Adiar
        </button>
        <button className="btn btn-ghost btn-sm">→ Reatribuir</button>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('grouped');

  const handleComplete = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDefer = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'deferred' as TaskStatus } : t)),
    );
  };

  const handleEscalate = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, priority: 'urgent' as TaskPriority } : t)),
    );
  };

  const sorted = useMemo(() => {
    const filtered = tasks.filter((t) => {
      const matchesGroup = groupFilter === 'all' || t.group === groupFilter;
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      const matchesSearch =
        searchQuery === '' ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.patient.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.mrn.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesGroup && matchesStatus && matchesPriority && matchesSearch;
    });
    return [...filtered].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  }, [tasks, groupFilter, statusFilter, priorityFilter, searchQuery]);

  const urgentCount = useMemo(
    () => tasks.filter((t) => t.priority === 'urgent' && t.status !== 'deferred').length,
    [tasks],
  );
  const openCount = useMemo(() => tasks.filter((t) => t.status === 'open').length, [tasks]);
  const inProgressCount = useMemo(
    () => tasks.filter((t) => t.status === 'in-progress').length,
    [tasks],
  );

  return (
    <AppShell pageTitle="Caixa de Tarefas">
      <div className="page-header">
        <h1 className="page-title">Caixa de Ações Unificada</h1>
        <p className="page-subtitle">
          {tasks.length} tarefas &mdash; ordenadas por prioridade. Cada tarefa exige uma ação.
        </p>
      </div>

      {urgentCount > 0 && (
        <div className="alert-banner alert-banner-critical mb-5">
          <span>🚨</span>
          <strong>{urgentCount} tarefas urgentes requerem ação imediata</strong>
        </div>
      )}

      {/* Resumo */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <span className="badge badge-urgent">{urgentCount} Urgentes</span>
        <span className="badge badge-info">{openCount} Abertas</span>
        <span className="badge badge-warning">{inProgressCount} Em Progresso</span>
        <span className="badge badge-neutral">
          {tasks.filter((t) => t.status === 'deferred').length} Adiadas
        </span>
      </div>

      {/* Controles */}
      <div className="filter-bar">
        <input
          className="search-input"
          type="text"
          placeholder="🔍  Buscar tarefas, pacientes, MRN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="filter-select"
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
          className="filter-select"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="all">Todos os Grupos</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {GROUP_DISPLAY[g]}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos os Status</option>
          <option value="open">Aberta</option>
          <option value="in-progress">Em Progresso</option>
          <option value="deferred">Adiada</option>
        </select>
        <div className="flex gap-2">
          <button
            className={`btn btn-sm ${viewMode === 'flat' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('flat')}
          >
            Lista
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'grouped' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('grouped')}
          >
            Agrupado
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">
              Tudo limpo — nenhuma tarefa corresponde aos filtros
            </div>
          </div>
        </div>
      ) : viewMode === 'flat' ? (
        <div>
          {sorted.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={handleComplete}
              onDefer={handleDefer}
              onEscalate={handleEscalate}
            />
          ))}
        </div>
      ) : (
        GROUPS.filter((g) => groupFilter === 'all' || g === groupFilter).map((group) => {
          const groupTasks = sorted.filter((t) => t.group === group);
          if (groupTasks.length === 0) return null;
          return (
            <div key={group} style={{ marginBottom: '2rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                }}
              >
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {group === 'Urgent'
                    ? '🚨'
                    : group === 'Clinical'
                      ? '🩺'
                      : group === 'Administrative'
                        ? '📋'
                        : '🔗'}{' '}
                  {GROUP_DISPLAY[group]}
                </h2>
                <span className="badge badge-neutral">{groupTasks.length}</span>
              </div>
              {groupTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={handleComplete}
                  onDefer={handleDefer}
                  onEscalate={handleEscalate}
                />
              ))}
            </div>
          );
        })
      )}

      <div className="text-xs text-tertiary mt-2" style={{ textAlign: 'right' }}>
        Exibindo {sorted.length} de {tasks.length} tarefas
      </div>
    </AppShell>
  );
}
