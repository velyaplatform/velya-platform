/**
 * File-backed hospital task store. Follows the delegation-store.ts pattern.
 *
 * Every state transition is validated by the state machine and audit-logged.
 * Production should migrate to PostgreSQL + Temporal workflows.
 *
 * Storage: VELYA_TASK_PATH or /data/velya-tasks/tasks.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { randomBytes } from 'crypto';
import { audit } from './audit-logger';
import { validateTransition } from './hospital-task-state-machine';
import type {
  HospitalTask,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TaskSubcategory,
  TaskSource,
  ActorRef,
  Evidence,
  TaskHistoryEntry,
  TaskComment,
  SLAState,
  BlockReason,
  DeclineReason,
  EvidenceType,
  TaskAction,
} from './hospital-task-types';
import {
  SLA_RECEIVE_MS as RECEIVE_SLA,
  SLA_ACCEPT_MS as ACCEPT_SLA,
  SLA_START_MS as START_SLA,
} from './hospital-task-types';

const STORAGE_PATH =
  process.env.VELYA_TASK_PATH || '/data/velya-tasks/tasks.json';

interface StoreShape {
  tasks: HospitalTask[];
  sequence: number;
}

function ensureStorage(): void {
  const dir = dirname(STORAGE_PATH);
  if (!existsSync(dir)) {
    try { mkdirSync(dir, { recursive: true }); } catch { /* retry next call */ }
  }
  if (!existsSync(STORAGE_PATH)) {
    try { writeFileSync(STORAGE_PATH, JSON.stringify({ tasks: [], sequence: 0 }, null, 2)); } catch { /* best effort */ }
  }
}

function readStore(): StoreShape {
  ensureStorage();
  try {
    const raw = readFileSync(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as StoreShape;
    if (!Array.isArray(parsed.tasks)) return { tasks: [], sequence: 0 };
    return { tasks: parsed.tasks, sequence: parsed.sequence ?? 0 };
  } catch {
    return { tasks: [], sequence: 0 };
  }
}

function writeStore(store: StoreShape): void {
  ensureStorage();
  try { writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2)); } catch { /* best effort */ }
}

function generateId(): string {
  return `TASK-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase();
}

function historyEntry(action: TaskAction, actor: ActorRef, from?: TaskStatus, to?: TaskStatus, note?: string, metadata?: Record<string, unknown>): TaskHistoryEntry {
  return {
    id: `H-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`.toUpperCase(),
    action,
    fromStatus: from,
    toStatus: to,
    actor,
    timestamp: new Date().toISOString(),
    note,
    metadata,
  };
}

function buildSLA(priority: TaskPriority, now: string): SLAState {
  const base = new Date(now).getTime();
  return {
    receiveBy: new Date(base + RECEIVE_SLA[priority]).toISOString(),
    acceptBy: new Date(base + RECEIVE_SLA[priority] + ACCEPT_SLA[priority]).toISOString(),
    startBy: new Date(base + RECEIVE_SLA[priority] + ACCEPT_SLA[priority] + START_SLA[priority]).toISOString(),
    completeBy: new Date(base + 24 * 3600_000).toISOString(), // default 24h, overridden per type
    currentPhase: 'receive',
    elapsedMs: 0,
    pausedMs: 0,
    breached: false,
    breachCount: 0,
    breachedPhases: [],
  };
}

// ── Create ──────────────────────────────────────────────────────────

export interface CreateTaskInput {
  type: string;
  category: TaskCategory;
  subcategory: TaskSubcategory;
  priority: TaskPriority;
  title: string;
  description?: string;
  instructions?: string;
  patientId?: string;
  patientMrn?: string;
  patientName?: string;
  ward: string;
  bed?: string;
  location?: string;
  createdBy: ActorRef;
  assignedTo: ActorRef;
  parentTaskId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  source?: TaskSource;
  tags?: string[];
  shift?: string;
  checklistItems?: { label: string }[];
  completeByOverrideMs?: number;
}

export function createTask(input: CreateTaskInput): HospitalTask {
  const now = new Date().toISOString();
  const store = readStore();
  store.sequence += 1;
  const shortCode = `T-${String(store.sequence).padStart(3, '0')}`;

  const sla = buildSLA(input.priority, now);
  if (input.completeByOverrideMs) {
    sla.completeBy = new Date(new Date(now).getTime() + input.completeByOverrideMs).toISOString();
  }

  const task: HospitalTask = {
    id: generateId(),
    shortCode,
    version: 1,
    type: input.type,
    category: input.category,
    subcategory: input.subcategory,
    priority: input.priority,
    status: 'open',
    statusChangedAt: now,
    title: input.title.trim(),
    description: input.description?.trim(),
    instructions: input.instructions?.trim(),
    patientId: input.patientId,
    patientMrn: input.patientMrn,
    patientName: input.patientName,
    ward: input.ward,
    bed: input.bed,
    location: input.location,
    createdBy: input.createdBy,
    assignedTo: input.assignedTo,
    currentEscalationLevel: 0,
    sla,
    evidence: [],
    checklistItems: input.checklistItems?.map((c, i) => ({
      id: `CK-${i + 1}`,
      label: c.label,
      checked: false,
    })),
    parentTaskId: input.parentTaskId,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    history: [
      historyEntry('created', input.createdBy, undefined, 'open', `Tarefa criada e atribuida a ${input.assignedTo.name}`),
    ],
    comments: [],
    createdAt: now,
    updatedAt: now,
    source: input.source ?? 'manual',
    tags: input.tags,
    shift: input.shift,
  };

  store.tasks.unshift(task);
  writeStore(store);

  audit({
    category: 'api',
    action: 'task.created',
    description: `Tarefa ${task.shortCode} criada: ${task.title}`,
    actor: input.createdBy.name,
    resource: `task:${task.id}`,
    result: 'success',
    details: {
      shortCode: task.shortCode,
      type: task.type,
      category: task.category,
      priority: task.priority,
      assignedTo: task.assignedTo.name,
      ward: task.ward,
      patientMrn: task.patientMrn,
    },
  });

  return task;
}

// ── Update Status ───────────────────────────────────────────────────

export interface UpdateTaskStatusInput {
  taskId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  toStatus: TaskStatus;
  note?: string;
  declineReason?: DeclineReason;
  declineReasonText?: string;
  blockReason?: BlockReason;
  blockReasonText?: string;
  estimatedUnblockAt?: string;
  newAssignedTo?: ActorRef;
}

export function updateTaskStatus(input: UpdateTaskStatusInput): HospitalTask | null {
  const store = readStore();
  const idx = store.tasks.findIndex((t) => t.id === input.taskId);
  if (idx === -1) return null;

  const task = store.tasks[idx];
  const fromStatus = task.status;
  const actor: ActorRef = { id: input.actorId, name: input.actorName, role: input.actorRole };

  const validation = validateTransition(fromStatus, input.toStatus, {
    declineReason: input.declineReason,
    declineReasonText: input.declineReasonText,
    blockReason: input.blockReason,
    blockReasonText: input.blockReasonText,
  });

  if (!validation.valid) {
    audit({
      category: 'api',
      action: 'task.invalid-transition',
      description: `Transicao invalida ${task.shortCode}: ${fromStatus} → ${input.toStatus} — ${validation.reason}`,
      actor: input.actorName,
      resource: `task:${task.id}`,
      result: 'failure',
      details: { fromStatus, toStatus: input.toStatus, reason: validation.reason },
    });
    return null;
  }

  const now = new Date().toISOString();
  task.previousStatus = fromStatus;
  task.status = input.toStatus;
  task.statusChangedAt = now;
  task.updatedAt = now;
  task.version += 1;

  // Status-specific fields
  switch (input.toStatus) {
    case 'received':
      task.receivedAt = now;
      task.sla.currentPhase = 'accept';
      break;
    case 'accepted':
      task.acceptedAt = now;
      task.acceptedBy = actor;
      task.sla.currentPhase = 'start';
      break;
    case 'in_progress':
      if (!task.startedAt) task.startedAt = now;
      task.sla.currentPhase = 'complete';
      if (fromStatus === 'blocked') {
        task.blockReason = undefined;
        task.blockReasonText = undefined;
        task.estimatedUnblockAt = undefined;
      }
      break;
    case 'blocked':
      task.blockedAt = now;
      task.blockReason = input.blockReason;
      task.blockReasonText = input.blockReasonText;
      task.estimatedUnblockAt = input.estimatedUnblockAt;
      break;
    case 'completed':
      task.completedAt = now;
      task.completedBy = actor;
      break;
    case 'verified':
      task.verifiedAt = now;
      task.verifiedBy = actor;
      break;
    case 'declined':
      task.declineReason = input.declineReason;
      task.declineReasonText = input.declineReasonText;
      break;
    case 'reassigned':
      if (input.newAssignedTo) {
        const oldAssignee = task.assignedTo.name;
        task.assignedTo = input.newAssignedTo;
        // Reset to open for new assignee
        task.status = 'open';
        task.statusChangedAt = now;
        task.receivedAt = undefined;
        task.acceptedAt = undefined;
        task.startedAt = undefined;
        task.acceptedBy = undefined;
        task.sla = buildSLA(task.priority, now);
        task.history.push(
          historyEntry('reassigned', actor, fromStatus, 'open',
            input.note ?? `Reatribuida de ${oldAssignee} para ${input.newAssignedTo.name}`));
      }
      break;
    case 'cancelled':
      task.cancelledAt = now;
      break;
    case 'escalated':
      task.currentEscalationLevel += 1;
      break;
  }

  const actionMap: Record<string, TaskAction> = {
    received: 'received',
    accepted: 'accepted',
    in_progress: fromStatus === 'blocked' ? 'unblocked' : 'started',
    blocked: 'blocked',
    completed: 'completed',
    verified: 'verified',
    declined: 'declined',
    reassigned: 'reassigned',
    cancelled: 'cancelled',
    escalated: 'escalated',
    expired: 'sla_breach',
  };

  task.history.push(
    historyEntry(
      actionMap[input.toStatus] ?? 'started',
      actor,
      fromStatus,
      input.toStatus,
      input.note,
    ),
  );

  store.tasks[idx] = task;
  writeStore(store);

  audit({
    category: 'api',
    action: `task.${actionMap[input.toStatus] ?? input.toStatus}`,
    description: `Tarefa ${task.shortCode}: ${fromStatus} → ${input.toStatus}`,
    actor: input.actorName,
    resource: `task:${task.id}`,
    result: 'success',
    details: {
      shortCode: task.shortCode,
      fromStatus,
      toStatus: input.toStatus,
      note: input.note,
      blockReason: input.blockReason,
      declineReason: input.declineReason,
    },
  });

  return task;
}

// ── Attach Evidence ─────────────────────────────────────────────────

export interface AttachEvidenceInput {
  taskId: string;
  actor: ActorRef;
  type: EvidenceType;
  value: string;
  metadata?: Record<string, unknown>;
}

export function attachEvidence(input: AttachEvidenceInput): HospitalTask | null {
  const store = readStore();
  const idx = store.tasks.findIndex((t) => t.id === input.taskId);
  if (idx === -1) return null;

  const task = store.tasks[idx];
  const now = new Date().toISOString();

  const evidence: Evidence = {
    id: `EV-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`.toUpperCase(),
    type: input.type,
    value: input.value,
    attachedBy: input.actor,
    attachedAt: now,
    metadata: input.metadata,
  };

  task.evidence.push(evidence);
  task.updatedAt = now;
  task.version += 1;
  task.history.push(historyEntry('evidence_attached', input.actor, undefined, undefined, `Evidencia ${input.type} anexada`));

  store.tasks[idx] = task;
  writeStore(store);

  audit({
    category: 'api',
    action: 'task.evidence-attached',
    description: `Evidencia anexada a ${task.shortCode}: ${input.type}`,
    actor: input.actor.name,
    resource: `task:${task.id}`,
    result: 'success',
    details: { evidenceId: evidence.id, type: input.type },
  });

  return task;
}

// ── Add Comment ─────────────────────────────────────────────────────

export interface AddCommentInput {
  taskId: string;
  author: ActorRef;
  text: string;
}

export function addComment(input: AddCommentInput): HospitalTask | null {
  const store = readStore();
  const idx = store.tasks.findIndex((t) => t.id === input.taskId);
  if (idx === -1) return null;

  const task = store.tasks[idx];
  const now = new Date().toISOString();

  const comment: TaskComment = {
    id: `CM-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`.toUpperCase(),
    author: input.author,
    text: input.text.trim(),
    createdAt: now,
  };

  task.comments.push(comment);
  task.updatedAt = now;
  task.version += 1;
  task.history.push(historyEntry('commented', input.author, undefined, undefined, input.text.trim()));

  store.tasks[idx] = task;
  writeStore(store);

  return task;
}

// ── Queries ─────────────────────────────────────────────────────────

export interface ListTasksQuery {
  assignedToId?: string;
  createdById?: string;
  ward?: string;
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority;
  category?: TaskCategory;
  patientMrn?: string;
  search?: string;
  limit?: number;
}

export function listTasks(query: ListTasksQuery = {}): HospitalTask[] {
  const store = readStore();
  let result = store.tasks;

  if (query.assignedToId) {
    result = result.filter((t) => t.assignedTo.id === query.assignedToId);
  }
  if (query.createdById) {
    result = result.filter((t) => t.createdBy.id === query.createdById);
  }
  if (query.ward) {
    result = result.filter((t) => t.ward === query.ward);
  }
  if (query.status) {
    const statuses = Array.isArray(query.status) ? query.status : [query.status];
    result = result.filter((t) => statuses.includes(t.status));
  }
  if (query.priority) {
    result = result.filter((t) => t.priority === query.priority);
  }
  if (query.category) {
    result = result.filter((t) => t.category === query.category);
  }
  if (query.patientMrn) {
    result = result.filter((t) => t.patientMrn === query.patientMrn);
  }
  if (query.search) {
    const q = query.search.toLowerCase();
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.shortCode.toLowerCase().includes(q) ||
        t.patientName?.toLowerCase().includes(q) ||
        t.assignedTo.name.toLowerCase().includes(q),
    );
  }

  const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
  return result.slice(0, limit);
}

export function getTaskById(id: string): HospitalTask | null {
  const store = readStore();
  return store.tasks.find((t) => t.id === id || t.shortCode === id) ?? null;
}

export function countTasksByStatus(ward?: string): Record<TaskStatus, number> {
  const store = readStore();
  let tasks = store.tasks;
  if (ward) tasks = tasks.filter((t) => t.ward === ward);

  const counts = {} as Record<TaskStatus, number>;
  for (const t of tasks) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }
  return counts;
}
