'use client';

import { useState, useMemo } from 'react';
import { AppShell } from '../components/app-shell';

type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';
type TaskStatus = 'open' | 'in-progress' | 'deferred';
type TaskGroup = 'Urgent' | 'Clinical' | 'Administrative' | 'Coordination';

interface Task {
  id: string;
  priority: TaskPriority;
  status: TaskStatus;
  group: TaskGroup;
  type: string;
  description: string;
  patient: string;
  mrn: string;
  assignedTo: string;
  dueIn: string;
  createdAt: string;
  context: string;
}

const MOCK_TASKS: Task[] = [
  {
    id: 'T-001',
    priority: 'urgent',
    status: 'open',
    group: 'Urgent',
    type: 'Alta Bloqueada',
    description: 'Transporte não providenciado — paciente liberada clinicamente desde 08:00',
    patient: 'Eleanor Voss',
    mrn: 'MRN-004',
    assignedTo: 'Planejador de Alta',
    dueIn: 'Atrasado 4h',
    createdAt: '08:15',
    context: 'Ala 2A · Dia 9 · IAM pós-ICP',
  },
  {
    id: 'T-002',
    priority: 'urgent',
    status: 'open',
    group: 'Urgent',
    type: 'Farmácia',
    description: 'Liberação da farmácia pendente — bloqueia alta de 3 pacientes',
    patient: 'Múltiplos pacientes',
    mrn: 'MRN-011, MRN-018, MRN-022',
    assignedTo: 'Dr. Chen',
    dueIn: 'Atrasado 2h',
    createdAt: '08:45',
    context: 'Farmácia · 3 pacientes afetados',
  },
  {
    id: 'T-003',
    priority: 'urgent',
    status: 'in-progress',
    group: 'Urgent',
    type: 'Decisão Clínica',
    description: 'Paciente em deterioração — escore NEWS2 = 7, aguardando decisão de escalada',
    patient: 'Peter Hawkins',
    mrn: 'MRN-013',
    assignedTo: 'Dr. Osei',
    dueIn: 'Agora',
    createdAt: '09:30',
    context: 'Ala 2A · Leito 2A-10 · Recuperação de sepse',
  },
  {
    id: 'T-004',
    priority: 'high',
    status: 'open',
    group: 'Clinical',
    type: 'Medicação',
    description: 'Reconciliação medicamentosa não concluída — paciente previsto para alta amanhã',
    patient: 'Anna Kowalski',
    mrn: 'MRN-006',
    assignedTo: 'Farmacêutico da Ala',
    dueIn: 'Em 2h',
    createdAt: '07:00',
    context: 'Ala 1B · Dia 10 · AVC',
  },
  {
    id: 'T-005',
    priority: 'high',
    status: 'open',
    group: 'Administrative',
    type: 'Plano de Saúde',
    description: 'Pré-autorização do plano pendente há mais de 48h — escalar para operadora',
    patient: 'Marcus Bell',
    mrn: 'MRN-007',
    assignedTo: 'Equipe Admin',
    dueIn: 'Em 2h',
    createdAt: '06:30',
    context: 'Ala 4C · Dia 12 · Estenose vertebral',
  },
  {
    id: 'T-006',
    priority: 'high',
    status: 'open',
    group: 'Clinical',
    type: 'Avaliação',
    description: 'Avaliação da visita médica não documentada — extensão do TMI provável se não feita',
    patient: 'Priya Nair',
    mrn: 'MRN-015',
    assignedTo: 'Dr. Ibrahim',
    dueIn: 'Em 3h',
    createdAt: '08:00',
    context: 'Ala 1A · Dia 5 · Surto de Crohn',
  },
  {
    id: 'T-007',
    priority: 'high',
    status: 'open',
    group: 'Coordination',
    type: 'Serviço Social',
    description: 'Encaminhamento para serviço social necessário antes da alta — caso de alta complexidade',
    patient: 'Frank Osei',
    mrn: 'MRN-020',
    assignedTo: 'Serviço Social',
    dueIn: 'Hoje',
    createdAt: '09:00',
    context: 'Ala 4A · Dia 4 · Celulite',
  },
  {
    id: 'T-008',
    priority: 'high',
    status: 'open',
    group: 'Coordination',
    type: 'Plano de Alta',
    description: 'Vaga em casa de repouso não confirmada — paciente no dia 14 de TMI',
    patient: 'Peter Hawkins',
    mrn: 'MRN-013',
    assignedTo: 'Planejador de Alta',
    dueIn: 'Hoje',
    createdAt: '07:30',
    context: 'Ala 2A · Dia 14 · Sepse',
  },
  {
    id: 'T-009',
    priority: 'normal',
    status: 'open',
    group: 'Clinical',
    type: 'Consentimento',
    description: 'Termo de consentimento para procedimento não assinado — agendado para amanhã',
    patient: 'George Papadopoulos',
    mrn: 'MRN-009',
    assignedTo: 'Dr. Ibrahim',
    dueIn: 'Hoje',
    createdAt: '09:15',
    context: 'Ala 2C · Dia 7 · Pneumonia',
  },
  {
    id: 'T-010',
    priority: 'normal',
    status: 'open',
    group: 'Administrative',
    type: 'Documentação',
    description: 'Sumário de alta não iniciado — alta prevista do paciente para amanhã',
    patient: 'Carlos Diaz',
    mrn: 'MRN-005',
    assignedTo: 'Dr. Chen',
    dueIn: 'Até 17:00',
    createdAt: '10:00',
    context: 'Ala 4A · Dia 4 · Apendicectomia',
  },
  {
    id: 'T-011',
    priority: 'normal',
    status: 'deferred',
    group: 'Coordination',
    type: 'Encaminhamento',
    description: 'Encaminhamento para fisioterapia pós-op — avaliação de reabilitação',
    patient: 'James Whitfield',
    mrn: 'MRN-001',
    assignedTo: 'Equipe de Fisioterapia',
    dueIn: 'Adiado para amanhã',
    createdAt: '08:30',
    context: 'Ala 1A · Dia 7 · Fratura de quadril',
  },
  {
    id: 'T-012',
    priority: 'low',
    status: 'open',
    group: 'Administrative',
    type: 'Documentação',
    description: 'Atualizar dados de contato do responsável legal no prontuário',
    patient: 'Robert Ngozi',
    mrn: 'MRN-003',
    assignedTo: 'Secretaria da Ala',
    dueIn: 'Sem prazo',
    createdAt: '10:30',
    context: 'Ala 2B · Tarefa administrativa',
  },
];

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
        style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '130px', paddingLeft: '1rem' }}
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
      prev.map((t) => (t.id === id ? { ...t, status: 'deferred' as TaskStatus } : t))
    );
  };

  const handleEscalate = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, priority: 'urgent' as TaskPriority } : t))
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
    [tasks]
  );
  const openCount = useMemo(() => tasks.filter((t) => t.status === 'open').length, [tasks]);
  const inProgressCount = useMemo(
    () => tasks.filter((t) => t.status === 'in-progress').length,
    [tasks]
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
            <div className="empty-state-title">Tudo limpo — nenhuma tarefa corresponde aos filtros</div>
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
                  {group === 'Urgent' ? '🚨' : group === 'Clinical' ? '🩺' : group === 'Administrative' ? '📋' : '🔗'}{' '}
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
