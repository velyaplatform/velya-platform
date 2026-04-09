'use client';

import { useState } from 'react';
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
    type: 'Discharge Block',
    description: 'Transport not arranged — patient medically cleared since 08:00',
    patient: 'Eleanor Voss',
    mrn: 'MRN-004',
    assignedTo: 'Discharge Planner',
    dueIn: 'Overdue 4h',
    createdAt: '08:15',
    context: 'Ward 2A · Day 9 · Acute MI post-PCI',
  },
  {
    id: 'T-002',
    priority: 'urgent',
    status: 'open',
    group: 'Urgent',
    type: 'Pharmacy',
    description: 'Pharmacy sign-off missing — blocks discharge for 3 patients',
    patient: 'Multiple patients',
    mrn: 'MRN-011, MRN-018, MRN-022',
    assignedTo: 'Dr. Chen',
    dueIn: 'Overdue 2h',
    createdAt: '08:45',
    context: 'Pharmacy · 3 patients affected',
  },
  {
    id: 'T-003',
    priority: 'urgent',
    status: 'in-progress',
    group: 'Urgent',
    type: 'Clinical Decision',
    description: 'Deteriorating patient — NEWS2 score 7, awaiting escalation decision',
    patient: 'Peter Hawkins',
    mrn: 'MRN-013',
    assignedTo: 'Dr. Osei',
    dueIn: 'Due now',
    createdAt: '09:30',
    context: 'Ward 2A · Bed 2A-10 · Sepsis recovery',
  },
  {
    id: 'T-004',
    priority: 'high',
    status: 'open',
    group: 'Clinical',
    type: 'Medication',
    description: 'Medication reconciliation not completed — patient due for discharge tomorrow',
    patient: 'Anna Kowalski',
    mrn: 'MRN-006',
    assignedTo: 'Ward Pharmacist',
    dueIn: 'Due in 2h',
    createdAt: '07:00',
    context: 'Ward 1B · Day 10 · Stroke',
  },
  {
    id: 'T-005',
    priority: 'high',
    status: 'open',
    group: 'Administrative',
    type: 'Insurance',
    description: 'Insurance pre-auth pending > 48h — escalate to payer immediately',
    patient: 'Marcus Bell',
    mrn: 'MRN-007',
    assignedTo: 'Admin Team',
    dueIn: 'Due in 2h',
    createdAt: '06:30',
    context: 'Ward 4C · Day 12 · Spinal stenosis',
  },
  {
    id: 'T-006',
    priority: 'high',
    status: 'open',
    group: 'Clinical',
    type: 'Assessment',
    description: 'Ward round assessment not documented — LOS extension likely if missed',
    patient: 'Priya Nair',
    mrn: 'MRN-015',
    assignedTo: 'Dr. Ibrahim',
    dueIn: 'Due in 3h',
    createdAt: '08:00',
    context: "Ward 1A \u00b7 Day 5 \u00b7 Crohn's disease",
  },
  {
    id: 'T-007',
    priority: 'high',
    status: 'open',
    group: 'Coordination',
    type: 'Social Work',
    description: 'Social work referral required before discharge — case complexity high',
    patient: 'Frank Osei',
    mrn: 'MRN-020',
    assignedTo: 'Social Work',
    dueIn: 'Due today',
    createdAt: '09:00',
    context: 'Ward 4A · Day 4 · Cellulitis',
  },
  {
    id: 'T-008',
    priority: 'high',
    status: 'open',
    group: 'Coordination',
    type: 'Discharge Plan',
    description: 'Nursing home placement not confirmed — patient day 14 LOS',
    patient: 'Peter Hawkins',
    mrn: 'MRN-013',
    assignedTo: 'Discharge Planner',
    dueIn: 'Due today',
    createdAt: '07:30',
    context: 'Ward 2A · Day 14 · Sepsis',
  },
  {
    id: 'T-009',
    priority: 'normal',
    status: 'open',
    group: 'Clinical',
    type: 'Consent',
    description: 'Consent form for procedure not signed — scheduled tomorrow',
    patient: 'George Papadopoulos',
    mrn: 'MRN-009',
    assignedTo: 'Dr. Ibrahim',
    dueIn: 'Due today',
    createdAt: '09:15',
    context: 'Ward 2C · Day 7 · Pneumonia',
  },
  {
    id: 'T-010',
    priority: 'normal',
    status: 'open',
    group: 'Administrative',
    type: 'Documentation',
    description: 'Discharge summary not started — patient target discharge tomorrow',
    patient: 'Carlos Diaz',
    mrn: 'MRN-005',
    assignedTo: 'Dr. Chen',
    dueIn: 'Due by 17:00',
    createdAt: '10:00',
    context: 'Ward 4A · Day 4 · Appendectomy',
  },
  {
    id: 'T-011',
    priority: 'normal',
    status: 'deferred',
    group: 'Coordination',
    type: 'Referral',
    description: 'Physiotherapy referral for post-op rehab assessment',
    patient: 'James Whitfield',
    mrn: 'MRN-001',
    assignedTo: 'Physio Team',
    dueIn: 'Deferred to tomorrow',
    createdAt: '08:30',
    context: 'Ward 1A · Day 7 · Hip fracture',
  },
  {
    id: 'T-012',
    priority: 'low',
    status: 'open',
    group: 'Administrative',
    type: 'Documentation',
    description: 'Update next-of-kin contact details in patient record',
    patient: 'Robert Ngozi',
    mrn: 'MRN-003',
    assignedTo: 'Ward Clerk',
    dueIn: 'No due date',
    createdAt: '10:30',
    context: 'Ward 2B · Admin task',
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
  urgent: 'URGENT',
  high: 'HIGH',
  normal: 'NORMAL',
  low: 'LOW',
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
  open: 'Open',
  'in-progress': 'In Progress',
  deferred: 'Deferred',
};

const GROUPS: TaskGroup[] = ['Urgent', 'Clinical', 'Administrative', 'Coordination'];

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
          Patient:{' '}
          <strong>
            {task.patient} ({task.mrn})
          </strong>
          &nbsp;&middot;&nbsp;{task.context}
        </div>
        <div className="text-xs text-tertiary">
          Assigned to: {task.assignedTo} &middot; Created: {task.createdAt} &middot; ID: {task.id}
        </div>
      </div>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '130px', paddingLeft: '1rem' }}
      >
        <button className="btn btn-primary btn-sm" onClick={() => onComplete(task.id)}>
          ✓ Complete
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onEscalate(task.id)}>
          ↑ Escalate
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => onDefer(task.id)}>
          ↷ Defer
        </button>
        <button className="btn btn-ghost btn-sm">→ Reassign</button>
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

  const sorted = [...filtered].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );

  const urgentCount = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'deferred').length;
  const openCount = tasks.filter((t) => t.status === 'open').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in-progress').length;

  return (
    <AppShell pageTitle="Task Inbox">
      <div className="page-header">
        <h1 className="page-title">Unified Action Inbox</h1>
        <p className="page-subtitle">
          {tasks.length} tasks &mdash; sorted by priority. Every task drives an action.
        </p>
      </div>

      {urgentCount > 0 && (
        <div className="alert-banner alert-banner-critical mb-5">
          <span>🚨</span>
          <strong>{urgentCount} urgent tasks require immediate action</strong>
        </div>
      )}

      {/* Summary */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <span className="badge badge-urgent">{urgentCount} Urgent</span>
        <span className="badge badge-info">{openCount} Open</span>
        <span className="badge badge-warning">{inProgressCount} In Progress</span>
        <span className="badge badge-neutral">
          {tasks.filter((t) => t.status === 'deferred').length} Deferred
        </span>
      </div>

      {/* Controls */}
      <div className="filter-bar">
        <input
          className="search-input"
          type="text"
          placeholder="🔍  Search tasks, patients, MRN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="filter-select"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <select
          className="filter-select"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="all">All Groups</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="deferred">Deferred</option>
        </select>
        <div className="flex gap-2">
          <button
            className={`btn btn-sm ${viewMode === 'flat' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('flat')}
          >
            Flat
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'grouped' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('grouped')}
          >
            Grouped
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">All clear — no tasks match your filters</div>
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
                  {group}
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
        Showing {sorted.length} of {tasks.length} tasks
      </div>
    </AppShell>
  );
}
