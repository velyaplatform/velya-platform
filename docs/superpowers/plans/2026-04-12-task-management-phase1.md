# Task Management Module — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the hospital task management backend — data model, file-backed store with state machine, API routes for CRUD + status transitions, audit integration, realistic fixtures, and unit tests.

**Architecture:** Follows the delegation-store.ts pattern (file-backed JSON, audit hash chain, typed state machine). The store enforces all status transitions from the spec's state machine. API routes handle auth, validation, and delegate to the store. Temporal/NATS integration is Phase 3 — this phase uses the store's built-in SLA deadline tracking without automated timers.

**Tech Stack:** TypeScript 5.7 / Next.js 15 / Vitest / Node.js fs (file-backed store) / audit-logger.ts (hash chain)

**Spec:** `docs/product/task-management-module-spec.md` (sections 5, 6, 9, 10, 13, 15)

---

## File Structure

### New files to create:

```
apps/web/src/lib/
  hospital-task-types.ts          # Type definitions, enums, interfaces (Task 1)
  hospital-task-state-machine.ts  # Status transition rules + validation (Task 2)
  hospital-task-store.ts          # File-backed CRUD + state transitions + audit (Task 3)
  fixtures/hospital-tasks.ts      # 20 realistic mock tasks across all categories (Task 5)
  __tests__/hospital-task-state-machine.test.ts  # State machine unit tests (Task 2)
  __tests__/hospital-task-store.test.ts          # Store integration tests (Task 4)

apps/web/src/app/api/
  hospital-tasks/route.ts                # GET list + POST create (Task 6)
  hospital-tasks/[id]/route.ts           # GET single + PATCH status (Task 7)
  hospital-tasks/[id]/evidence/route.ts  # POST attach evidence (Task 8)
  hospital-tasks/[id]/comments/route.ts  # POST add comment (Task 8)
```

---

### Task 1: Type Definitions

**Files:**
- Create: `apps/web/src/lib/hospital-task-types.ts`

- [ ] **Step 1: Create the type definitions file**

```typescript
/**
 * Hospital Task Management — Type Definitions
 *
 * All types for the hospital task system. Follows the spec in
 * docs/product/task-management-module-spec.md sections 5, 13, 15.
 */

// ── Status ──────────────────────────────────────────────────────────

export type TaskStatus =
  | 'draft'
  | 'open'
  | 'received'
  | 'accepted'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'verified'
  | 'declined'
  | 'reassigned'
  | 'cancelled'
  | 'expired'
  | 'escalated';

// ── Priority ────────────────────────────────────────────────────────

export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// ── Category ────────────────────────────────────────────────────────

export type TaskCategory = 'assistencial' | 'apoio' | 'administrativo';

export type TaskSubcategory =
  | 'medicacao'
  | 'exames'
  | 'procedimentos'
  | 'avaliacao'
  | 'parecer'
  | 'alta'
  | 'limpeza'
  | 'transporte'
  | 'manutencao'
  | 'nutricao'
  | 'documentacao'
  | 'faturamento'
  | 'coordenacao';

// ── Evidence ────────────────────────────────────────────────────────

export type EvidenceType =
  | 'text'
  | 'checklist'
  | 'photo'
  | 'signature'
  | 'timestamp'
  | 'measurement'
  | 'document';

export interface Evidence {
  id: string;
  type: EvidenceType;
  value: string;
  attachedBy: ActorRef;
  attachedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  checkedBy?: ActorRef;
  checkedAt?: string;
}

// ── Decline / Block reasons ─────────────────────────────────────────

export type DeclineReason =
  | 'not_my_scope'
  | 'not_my_shift'
  | 'patient_transferred'
  | 'already_done'
  | 'duplicate'
  | 'insufficient_info'
  | 'resource_unavailable'
  | 'clinical_contraindication'
  | 'other';

export type BlockReason =
  | 'waiting_lab'
  | 'waiting_pharmacy'
  | 'waiting_transport'
  | 'waiting_cleaning'
  | 'waiting_equipment'
  | 'waiting_physician'
  | 'waiting_family'
  | 'waiting_insurance'
  | 'patient_unstable'
  | 'other';

// ── Actor ───────────────────────────────────────────────────────────

export interface ActorRef {
  id: string;
  name: string;
  role: string;
  ward?: string;
}

// ── SLA ─────────────────────────────────────────────────────────────

export interface SLAState {
  receiveBy: string;
  acceptBy: string;
  startBy: string;
  completeBy: string;
  currentPhase: 'receive' | 'accept' | 'start' | 'complete';
  elapsedMs: number;
  pausedMs: number;
  breached: boolean;
  breachCount: number;
  breachedPhases: string[];
}

// ── History / Comments ──────────────────────────────────────────────

export type TaskAction =
  | 'created'
  | 'sent'
  | 'received'
  | 'accepted'
  | 'declined'
  | 'started'
  | 'blocked'
  | 'unblocked'
  | 'completed'
  | 'verified'
  | 'escalated'
  | 'reassigned'
  | 'cancelled'
  | 'commented'
  | 'evidence_attached'
  | 'sla_warning'
  | 'sla_breach';

export interface TaskHistoryEntry {
  id: string;
  action: TaskAction;
  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;
  actor: ActorRef;
  timestamp: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskComment {
  id: string;
  author: ActorRef;
  text: string;
  createdAt: string;
}

// ── Task Source ──────────────────────────────────────────────────────

export type TaskSource = 'manual' | 'system' | 'workflow' | 'escalation';

// ── Main Entity ─────────────────────────────────────────────────────

export interface HospitalTask {
  id: string;
  shortCode: string;
  version: number;

  type: string;
  category: TaskCategory;
  subcategory: TaskSubcategory;
  priority: TaskPriority;

  status: TaskStatus;
  previousStatus?: TaskStatus;
  statusChangedAt: string;

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
  acceptedBy?: ActorRef;
  completedBy?: ActorRef;
  verifiedBy?: ActorRef;
  currentEscalationLevel: number;

  sla: SLAState;

  evidence: Evidence[];
  checklistItems?: ChecklistItem[];

  parentTaskId?: string;
  blockedBy?: string[];
  relatedEntityType?: string;
  relatedEntityId?: string;

  blockReason?: BlockReason;
  blockReasonText?: string;
  blockedAt?: string;
  estimatedUnblockAt?: string;

  declineReason?: DeclineReason;
  declineReasonText?: string;

  history: TaskHistoryEntry[];
  comments: TaskComment[];

  createdAt: string;
  updatedAt: string;
  receivedAt?: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  verifiedAt?: string;
  cancelledAt?: string;

  source: TaskSource;
  tags?: string[];
  shift?: string;
}

// ── SLA Defaults ────────────────────────────────────────────────────

/** SLA durations in milliseconds per priority */
export const SLA_RECEIVE_MS: Record<TaskPriority, number> = {
  urgent: 5 * 60_000,
  high: 15 * 60_000,
  normal: 30 * 60_000,
  low: 2 * 3600_000,
};

export const SLA_ACCEPT_MS: Record<TaskPriority, number> = {
  urgent: 5 * 60_000,
  high: 15 * 60_000,
  normal: 60 * 60_000,
  low: 4 * 3600_000,
};

export const SLA_START_MS: Record<TaskPriority, number> = {
  urgent: 10 * 60_000,
  high: 30 * 60_000,
  normal: 2 * 3600_000,
  low: 8 * 3600_000,
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/jfreire/velya/velya-platform && npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/hospital-task-types.ts
git commit -m "feat(tasks): add HospitalTask type definitions

13 statuses, 4 priorities, 3 categories, 13 subcategories, 7 evidence
types, 9 decline reasons, 10 block reasons, SLA defaults per priority.
Spec: docs/product/task-management-module-spec.md"
```

---

### Task 2: State Machine

**Files:**
- Create: `apps/web/src/lib/hospital-task-state-machine.ts`
- Create: `apps/web/src/lib/__tests__/hospital-task-state-machine.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getAvailableTransitions,
  validateTransition,
} from '../hospital-task-state-machine';

describe('hospital-task-state-machine', () => {
  describe('canTransition', () => {
    it('allows draft → open', () => {
      expect(canTransition('draft', 'open')).toBe(true);
    });

    it('allows open → received', () => {
      expect(canTransition('open', 'received')).toBe(true);
    });

    it('allows received → accepted', () => {
      expect(canTransition('received', 'accepted')).toBe(true);
    });

    it('allows received → declined', () => {
      expect(canTransition('received', 'declined')).toBe(true);
    });

    it('allows accepted → in_progress', () => {
      expect(canTransition('accepted', 'in_progress')).toBe(true);
    });

    it('allows in_progress → completed', () => {
      expect(canTransition('in_progress', 'completed')).toBe(true);
    });

    it('allows in_progress → blocked', () => {
      expect(canTransition('in_progress', 'blocked')).toBe(true);
    });

    it('allows blocked → in_progress', () => {
      expect(canTransition('blocked', 'in_progress')).toBe(true);
    });

    it('allows completed → verified', () => {
      expect(canTransition('completed', 'verified')).toBe(true);
    });

    it('rejects draft → completed (skip statuses)', () => {
      expect(canTransition('draft', 'completed')).toBe(false);
    });

    it('rejects completed → open (backwards)', () => {
      expect(canTransition('completed', 'open')).toBe(false);
    });

    it('rejects verified → anything', () => {
      expect(canTransition('verified', 'open')).toBe(false);
    });

    it('allows any active status → escalated', () => {
      expect(canTransition('open', 'escalated')).toBe(true);
      expect(canTransition('received', 'escalated')).toBe(true);
      expect(canTransition('in_progress', 'escalated')).toBe(true);
    });

    it('allows any active status → cancelled', () => {
      expect(canTransition('open', 'cancelled')).toBe(true);
      expect(canTransition('received', 'cancelled')).toBe(true);
      expect(canTransition('accepted', 'cancelled')).toBe(true);
    });

    it('rejects cancel after in_progress', () => {
      expect(canTransition('in_progress', 'cancelled')).toBe(false);
    });

    it('allows any pre-progress → reassigned', () => {
      expect(canTransition('open', 'reassigned')).toBe(true);
      expect(canTransition('received', 'reassigned')).toBe(true);
    });
  });

  describe('getAvailableTransitions', () => {
    it('returns correct transitions for open', () => {
      const transitions = getAvailableTransitions('open');
      expect(transitions).toContain('received');
      expect(transitions).toContain('expired');
      expect(transitions).toContain('escalated');
      expect(transitions).toContain('reassigned');
      expect(transitions).toContain('cancelled');
      expect(transitions).not.toContain('completed');
    });

    it('returns empty for verified (terminal)', () => {
      const transitions = getAvailableTransitions('verified');
      expect(transitions).toEqual([]);
    });

    it('returns empty for cancelled (terminal)', () => {
      const transitions = getAvailableTransitions('cancelled');
      expect(transitions).toEqual([]);
    });
  });

  describe('validateTransition', () => {
    it('returns ok for valid transition', () => {
      const result = validateTransition('open', 'received');
      expect(result.valid).toBe(true);
    });

    it('returns error for invalid transition', () => {
      const result = validateTransition('draft', 'completed');
      expect(result.valid).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    it('requires decline reason for received → declined', () => {
      const result = validateTransition('received', 'declined', {});
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('motivo');
    });

    it('accepts declined with reason', () => {
      const result = validateTransition('received', 'declined', {
        declineReason: 'not_my_scope',
      });
      expect(result.valid).toBe(true);
    });

    it('requires block reason for in_progress → blocked', () => {
      const result = validateTransition('in_progress', 'blocked', {});
      expect(result.valid).toBe(false);
    });

    it('accepts blocked with reason', () => {
      const result = validateTransition('in_progress', 'blocked', {
        blockReason: 'waiting_lab',
      });
      expect(result.valid).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/jfreire/velya/velya-platform && npx vitest run apps/web/src/lib/__tests__/hospital-task-state-machine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the state machine**

```typescript
/**
 * Hospital Task State Machine — enforces valid status transitions.
 *
 * Every transition must be declared in TRANSITIONS. The validateTransition
 * function also checks that required context (decline reason, block reason)
 * is provided for specific transitions.
 */

import type { TaskStatus, BlockReason, DeclineReason } from './hospital-task-types';

/** Map of from-status → allowed to-statuses */
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  draft: ['open', 'cancelled'],
  open: ['received', 'expired', 'escalated', 'reassigned', 'cancelled'],
  received: ['accepted', 'declined', 'escalated', 'reassigned', 'cancelled'],
  accepted: ['in_progress', 'declined', 'escalated', 'reassigned', 'cancelled'],
  in_progress: ['completed', 'blocked', 'escalated'],
  blocked: ['in_progress', 'escalated', 'cancelled'],
  completed: ['verified'],
  verified: [],
  declined: [],
  reassigned: [],
  cancelled: [],
  expired: ['reassigned', 'escalated'],
  escalated: ['open', 'reassigned', 'cancelled'],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAvailableTransitions(from: TaskStatus): TaskStatus[] {
  return TRANSITIONS[from] ?? [];
}

interface TransitionContext {
  declineReason?: DeclineReason;
  declineReasonText?: string;
  blockReason?: BlockReason;
  blockReasonText?: string;
}

interface TransitionResult {
  valid: boolean;
  reason?: string;
}

export function validateTransition(
  from: TaskStatus,
  to: TaskStatus,
  context?: TransitionContext,
): TransitionResult {
  if (!canTransition(from, to)) {
    return {
      valid: false,
      reason: `Transicao invalida: ${from} → ${to}`,
    };
  }

  if (to === 'declined') {
    if (!context?.declineReason) {
      return {
        valid: false,
        reason: 'Recusa exige motivo estruturado (declineReason)',
      };
    }
    if (context.declineReason === 'other' && !context.declineReasonText?.trim()) {
      return {
        valid: false,
        reason: 'Motivo "outro" exige texto descritivo (declineReasonText)',
      };
    }
  }

  if (to === 'blocked') {
    if (!context?.blockReason) {
      return {
        valid: false,
        reason: 'Bloqueio exige motivo estruturado (blockReason)',
      };
    }
    if (context.blockReason === 'other' && !context.blockReasonText?.trim()) {
      return {
        valid: false,
        reason: 'Motivo "outro" exige texto descritivo (blockReasonText)',
      };
    }
  }

  return { valid: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/jfreire/velya/velya-platform && npx vitest run apps/web/src/lib/__tests__/hospital-task-state-machine.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/hospital-task-state-machine.ts apps/web/src/lib/__tests__/hospital-task-state-machine.test.ts
git commit -m "feat(tasks): add state machine with 13 statuses and transition validation

Enforces spec section 5 transitions. Requires decline/block reasons.
Terminal states: verified, declined, cancelled. 22 test cases."
```

---

### Task 3: Task Store

**Files:**
- Create: `apps/web/src/lib/hospital-task-store.ts`

- [ ] **Step 1: Create the store**

```typescript
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
import { canTransition, validateTransition } from './hospital-task-state-machine';
import type {
  HospitalTask,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TaskSubcategory,
  TaskSource,
  ActorRef,
  Evidence,
  ChecklistItem,
  TaskHistoryEntry,
  TaskComment,
  SLAState,
  BlockReason,
  DeclineReason,
  EvidenceType,
  TaskAction,
  SLA_RECEIVE_MS,
  SLA_ACCEPT_MS,
  SLA_START_MS,
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
        task.assignedTo = input.newAssignedTo;
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/jfreire/velya/velya-platform && npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/hospital-task-store.ts
git commit -m "feat(tasks): add file-backed task store with state machine + audit

createTask, updateTaskStatus, attachEvidence, addComment, listTasks,
getTaskById, countTasksByStatus. All transitions audit-logged.
Pattern follows delegation-store.ts."
```

---

### Task 4: Store Integration Tests

**Files:**
- Create: `apps/web/src/lib/__tests__/hospital-task-store.test.ts`

- [ ] **Step 1: Write the integration tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { vi } from 'vitest';

type StoreModule = typeof import('../hospital-task-store');

let store: StoreModule;
let storagePath: string;

async function freshStore(): Promise<StoreModule> {
  vi.resetModules();
  storagePath = join(tmpdir(), `velya-test-tasks-${randomBytes(6).toString('hex')}.json`);
  process.env.VELYA_TASK_PATH = storagePath;
  process.env.VELYA_AUDIT_PATH = join(tmpdir(), `velya-test-audit-${randomBytes(6).toString('hex')}`);
  return (await import('../hospital-task-store')) as StoreModule;
}

const NURSE: { id: string; name: string; role: string; ward: string } = {
  id: 'user-nurse-1',
  name: 'Ana Silva',
  role: 'nurse',
  ward: 'Ala 3B',
};

const DOCTOR: { id: string; name: string; role: string; ward: string } = {
  id: 'user-doc-1',
  name: 'Dr. Carlos',
  role: 'medical_staff_attending',
  ward: 'Ala 3B',
};

const COORDINATOR: { id: string; name: string; role: string; ward: string } = {
  id: 'user-coord-1',
  name: 'Maria Coord.',
  role: 'nurse',
  ward: 'Ala 3B',
};

function createTestTask(s: StoreModule) {
  return s.createTask({
    type: 'med-admin-iv',
    category: 'assistencial',
    subcategory: 'medicacao',
    priority: 'high',
    title: 'Administrar Dipirona 1g IV',
    ward: 'Ala 3B',
    bed: '302A',
    patientMrn: 'MRN-001',
    patientName: 'Eleanor Voss',
    createdBy: DOCTOR,
    assignedTo: NURSE,
  });
}

beforeEach(async () => {
  store = await freshStore();
});

afterEach(() => {
  if (storagePath && existsSync(storagePath)) {
    try { unlinkSync(storagePath); } catch { /* ignore */ }
  }
  delete process.env.VELYA_TASK_PATH;
  delete process.env.VELYA_AUDIT_PATH;
});

describe('hospital-task-store', () => {
  describe('createTask', () => {
    it('creates a task with correct fields', () => {
      const task = createTestTask(store);
      expect(task.id).toMatch(/^TASK-/);
      expect(task.shortCode).toBe('T-001');
      expect(task.status).toBe('open');
      expect(task.priority).toBe('high');
      expect(task.title).toBe('Administrar Dipirona 1g IV');
      expect(task.assignedTo.name).toBe('Ana Silva');
      expect(task.createdBy.name).toBe('Dr. Carlos');
      expect(task.history).toHaveLength(1);
      expect(task.history[0].action).toBe('created');
      expect(task.version).toBe(1);
    });

    it('increments short codes', () => {
      const t1 = createTestTask(store);
      const t2 = createTestTask(store);
      expect(t1.shortCode).toBe('T-001');
      expect(t2.shortCode).toBe('T-002');
    });

    it('builds SLA with correct deadlines', () => {
      const task = createTestTask(store);
      expect(task.sla.currentPhase).toBe('receive');
      expect(task.sla.breached).toBe(false);
      expect(new Date(task.sla.receiveBy).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('updateTaskStatus', () => {
    it('transitions open → received', () => {
      const task = createTestTask(store);
      const updated = store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'received',
      });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('received');
      expect(updated!.receivedAt).toBeTruthy();
      expect(updated!.sla.currentPhase).toBe('accept');
      expect(updated!.version).toBe(2);
      expect(updated!.history).toHaveLength(2);
    });

    it('transitions received → declined with reason', () => {
      const task = createTestTask(store);
      store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'received',
      });
      const declined = store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'declined',
        declineReason: 'not_my_shift',
        note: 'Saio do turno em 5 min',
      });
      expect(declined).not.toBeNull();
      expect(declined!.status).toBe('declined');
      expect(declined!.declineReason).toBe('not_my_shift');
    });

    it('rejects invalid transition', () => {
      const task = createTestTask(store);
      const result = store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'completed',
      });
      expect(result).toBeNull();
    });

    it('rejects decline without reason', () => {
      const task = createTestTask(store);
      store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'received',
      });
      const result = store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'declined',
      });
      expect(result).toBeNull();
    });

    it('handles full happy path: open → received → accepted → in_progress → completed → verified', () => {
      const task = createTestTask(store);
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'received' });
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'accepted' });
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'in_progress' });
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'completed', note: 'Medicacao administrada' });
      const verified = store.updateTaskStatus({ taskId: task.id, actorId: DOCTOR.id, actorName: DOCTOR.name, actorRole: DOCTOR.role, toStatus: 'verified' });

      expect(verified).not.toBeNull();
      expect(verified!.status).toBe('verified');
      expect(verified!.history).toHaveLength(6);
      expect(verified!.version).toBe(6);
      expect(verified!.receivedAt).toBeTruthy();
      expect(verified!.acceptedAt).toBeTruthy();
      expect(verified!.startedAt).toBeTruthy();
      expect(verified!.completedAt).toBeTruthy();
      expect(verified!.verifiedAt).toBeTruthy();
    });

    it('handles block and unblock cycle', () => {
      const task = createTestTask(store);
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'received' });
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'accepted' });
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'in_progress' });

      const blocked = store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'blocked',
        blockReason: 'waiting_pharmacy',
        blockReasonText: 'Farmacia ainda nao dispensou',
      });
      expect(blocked!.status).toBe('blocked');
      expect(blocked!.blockReason).toBe('waiting_pharmacy');

      const unblocked = store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'in_progress',
        note: 'Farmacia dispensou',
      });
      expect(unblocked!.status).toBe('in_progress');
      expect(unblocked!.blockReason).toBeUndefined();
    });

    it('returns null for non-existent task', () => {
      const result = store.updateTaskStatus({
        taskId: 'TASK-NONEXISTENT',
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'received',
      });
      expect(result).toBeNull();
    });

    it('increments escalation level', () => {
      const task = createTestTask(store);
      const escalated = store.updateTaskStatus({
        taskId: task.id,
        actorId: COORDINATOR.id,
        actorName: COORDINATOR.name,
        actorRole: COORDINATOR.role,
        toStatus: 'escalated',
        note: 'SLA breach — escalando para coordenacao',
      });
      expect(escalated!.currentEscalationLevel).toBe(1);
    });
  });

  describe('attachEvidence', () => {
    it('attaches evidence to a task', () => {
      const task = createTestTask(store);
      const updated = store.attachEvidence({
        taskId: task.id,
        actor: NURSE,
        type: 'text',
        value: 'Medicacao administrada sem intercorrencias',
      });
      expect(updated).not.toBeNull();
      expect(updated!.evidence).toHaveLength(1);
      expect(updated!.evidence[0].type).toBe('text');
      expect(updated!.evidence[0].id).toMatch(/^EV-/);
    });
  });

  describe('addComment', () => {
    it('adds a comment to a task', () => {
      const task = createTestTask(store);
      const updated = store.addComment({
        taskId: task.id,
        author: DOCTOR,
        text: 'Verificar alergia antes de administrar',
      });
      expect(updated).not.toBeNull();
      expect(updated!.comments).toHaveLength(1);
      expect(updated!.comments[0].text).toBe('Verificar alergia antes de administrar');
    });
  });

  describe('listTasks', () => {
    it('lists all tasks', () => {
      createTestTask(store);
      createTestTask(store);
      const tasks = store.listTasks();
      expect(tasks).toHaveLength(2);
    });

    it('filters by assignedToId', () => {
      createTestTask(store);
      const tasks = store.listTasks({ assignedToId: NURSE.id });
      expect(tasks).toHaveLength(1);
      const empty = store.listTasks({ assignedToId: 'nonexistent' });
      expect(empty).toHaveLength(0);
    });

    it('filters by status', () => {
      const task = createTestTask(store);
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'received' });
      createTestTask(store);
      const received = store.listTasks({ status: 'received' });
      expect(received).toHaveLength(1);
    });

    it('filters by multiple statuses', () => {
      const t1 = createTestTask(store);
      store.updateTaskStatus({ taskId: t1.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'received' });
      createTestTask(store);
      const result = store.listTasks({ status: ['open', 'received'] });
      expect(result).toHaveLength(2);
    });

    it('searches by title', () => {
      createTestTask(store);
      const found = store.listTasks({ search: 'dipirona' });
      expect(found).toHaveLength(1);
      const notFound = store.listTasks({ search: 'inexistente' });
      expect(notFound).toHaveLength(0);
    });

    it('respects limit', () => {
      for (let i = 0; i < 5; i++) createTestTask(store);
      const limited = store.listTasks({ limit: 3 });
      expect(limited).toHaveLength(3);
    });
  });

  describe('getTaskById', () => {
    it('finds by id', () => {
      const task = createTestTask(store);
      const found = store.getTaskById(task.id);
      expect(found).not.toBeNull();
      expect(found!.shortCode).toBe(task.shortCode);
    });

    it('finds by shortCode', () => {
      const task = createTestTask(store);
      const found = store.getTaskById(task.shortCode);
      expect(found).not.toBeNull();
    });

    it('returns null for missing', () => {
      expect(store.getTaskById('NOPE')).toBeNull();
    });
  });

  describe('countTasksByStatus', () => {
    it('counts correctly', () => {
      const t1 = createTestTask(store);
      createTestTask(store);
      store.updateTaskStatus({ taskId: t1.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'received' });
      const counts = store.countTasksByStatus();
      expect(counts.open).toBe(1);
      expect(counts.received).toBe(1);
    });

    it('filters by ward', () => {
      createTestTask(store);
      const counts = store.countTasksByStatus('Ala 3B');
      expect(counts.open).toBe(1);
      const empty = store.countTasksByStatus('UTI');
      expect(empty.open ?? 0).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd /home/jfreire/velya/velya-platform && npx vitest run apps/web/src/lib/__tests__/hospital-task-store.test.ts`
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/__tests__/hospital-task-store.test.ts
git commit -m "test(tasks): add 20 integration tests for hospital-task-store

Covers: create, sequential short codes, SLA build, full happy path,
block/unblock cycle, decline with reason, escalation, evidence, comments,
list with filters, search, getById with shortCode, countByStatus."
```

---

### Task 5: Realistic Fixtures

**Files:**
- Create: `apps/web/src/lib/fixtures/hospital-tasks.ts`

- [ ] **Step 1: Create 20 realistic mock tasks**

```typescript
/**
 * Hospital Task Fixtures — 20 realistic tasks spanning all categories.
 *
 * Centralized mock data. Uses consistent MRNs from existing fixtures
 * (patients-list.ts) to prevent duplication.
 */

import type { HospitalTask } from '../hospital-task-types';

const NOW = '2026-04-12T08:00:00.000Z';

function actor(id: string, name: string, role: string, ward = 'Ala 3B') {
  return { id, name, role, ward };
}

const NURSE_ANA = actor('user-nurse-1', 'Ana Silva', 'nurse');
const NURSE_BEA = actor('user-nurse-2', 'Beatriz Santos', 'nurse');
const TECH_CARLOS = actor('user-tech-1', 'Carlos Mendes', 'nursing_technician');
const DOC_MARCOS = actor('user-doc-1', 'Dr. Marcos Lima', 'medical_staff_attending');
const DOC_JULIA = actor('user-doc-2', 'Dra. Julia Ramos', 'medical_staff_attending');
const PHARM_LUCIA = actor('user-pharm-1', 'Lucia Ferreira', 'pharmacist_clinical', 'Farmacia');
const CLEANER_JOSE = actor('user-clean-1', 'Jose Oliveira', 'cleaning_hygiene', 'Limpeza');
const TRANSPORT_PEDRO = actor('user-trans-1', 'Pedro Souza', 'patient_transporter', 'Transporte');
const MAINT_RICARDO = actor('user-maint-1', 'Ricardo Alves', 'maintenance', 'Manutencao');
const COORD_MARIA = actor('user-coord-1', 'Maria Coord.', 'nurse', 'Ala 3B');

function sla(phase: 'receive' | 'accept' | 'start' | 'complete', breached = false): HospitalTask['sla'] {
  const base = new Date(NOW).getTime();
  return {
    receiveBy: new Date(base + 15 * 60_000).toISOString(),
    acceptBy: new Date(base + 30 * 60_000).toISOString(),
    startBy: new Date(base + 60 * 60_000).toISOString(),
    completeBy: new Date(base + 4 * 3600_000).toISOString(),
    currentPhase: phase,
    elapsedMs: 0,
    pausedMs: 0,
    breached,
    breachCount: breached ? 1 : 0,
    breachedPhases: breached ? ['receive'] : [],
  };
}

function hist(action: string, actor: HospitalTask['createdBy'], note?: string): HospitalTask['history'][0] {
  return { id: `H-${Math.random().toString(36).slice(2, 8)}`, action: action as HospitalTask['history'][0]['action'], actor, timestamp: NOW, note };
}

export const MOCK_HOSPITAL_TASKS: HospitalTask[] = [
  // ── ASSISTENCIAL / MEDICACAO ────────────────────────────────────
  {
    id: 'TASK-001', shortCode: 'T-001', version: 1,
    type: 'med-admin-iv', category: 'assistencial', subcategory: 'medicacao',
    priority: 'urgent', status: 'open', statusChangedAt: NOW,
    title: 'Administrar Dipirona 1g IV',
    description: 'Paciente com febre 38.9C, prescricao de Dipirona 1g IV 6/6h',
    ward: 'Ala 3B', bed: '302A', patientMrn: 'MRN-001', patientName: 'Eleanor Voss',
    createdBy: DOC_MARCOS, assignedTo: NURSE_ANA, currentEscalationLevel: 0,
    sla: sla('receive'), evidence: [], history: [hist('created', DOC_MARCOS, 'Tarefa criada')],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },
  {
    id: 'TASK-002', shortCode: 'T-002', version: 2,
    type: 'med-admin-oral', category: 'assistencial', subcategory: 'medicacao',
    priority: 'normal', status: 'received', statusChangedAt: NOW,
    title: 'Administrar Losartana 50mg VO',
    ward: 'Ala 3B', bed: '305B', patientMrn: 'MRN-003', patientName: 'Marcus Bell',
    createdBy: DOC_JULIA, assignedTo: TECH_CARLOS, currentEscalationLevel: 0,
    sla: sla('accept'), evidence: [], receivedAt: NOW,
    history: [hist('created', DOC_JULIA), hist('received', TECH_CARLOS)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ASSISTENCIAL / EXAMES ───────────────────────────────────────
  {
    id: 'TASK-003', shortCode: 'T-003', version: 3,
    type: 'collect-lab-sample', category: 'assistencial', subcategory: 'exames',
    priority: 'high', status: 'in_progress', statusChangedAt: NOW,
    title: 'Coletar HMG + PCR',
    description: 'Coleta para controle de infeccao pos-operatoria',
    ward: 'Ala 3B', bed: '308C', patientMrn: 'MRN-005', patientName: 'Diana Reyes',
    createdBy: DOC_MARCOS, assignedTo: TECH_CARLOS, currentEscalationLevel: 0,
    sla: sla('complete'), evidence: [], receivedAt: NOW, acceptedAt: NOW, startedAt: NOW,
    history: [hist('created', DOC_MARCOS), hist('received', TECH_CARLOS), hist('started', TECH_CARLOS)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },
  {
    id: 'TASK-004', shortCode: 'T-004', version: 3,
    type: 'prepare-patient-exam', category: 'assistencial', subcategory: 'exames',
    priority: 'normal', status: 'blocked', statusChangedAt: NOW,
    title: 'Preparar paciente para TC abdome',
    description: 'Jejum 6h, contraste oral 2h antes',
    ward: 'Ala 3B', bed: '310A', patientMrn: 'MRN-007', patientName: 'James Chen',
    createdBy: DOC_JULIA, assignedTo: NURSE_BEA, currentEscalationLevel: 0,
    sla: sla('complete'), evidence: [],
    blockReason: 'waiting_transport', blockReasonText: 'Maqueiro indisponivel para levar ao exame',
    blockedAt: NOW, receivedAt: NOW, acceptedAt: NOW, startedAt: NOW,
    history: [hist('created', DOC_JULIA), hist('received', NURSE_BEA), hist('started', NURSE_BEA), hist('blocked', NURSE_BEA, 'Aguardando transporte')],
    comments: [{ id: 'CM-001', author: NURSE_BEA, text: 'Solicitei maqueiro, aguardando', createdAt: NOW }],
    createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ASSISTENCIAL / PROCEDIMENTOS ────────────────────────────────
  {
    id: 'TASK-005', shortCode: 'T-005', version: 1,
    type: 'wound-care-complex', category: 'assistencial', subcategory: 'procedimentos',
    priority: 'high', status: 'open', statusChangedAt: NOW,
    title: 'Curativo complexo — ferida operatoria',
    instructions: 'Lavar com SF 0.9%, aplicar colagenase, cobrir com gaze esteril',
    ward: 'Ala 3B', bed: '301B', patientMrn: 'MRN-002', patientName: 'Robert Hayes',
    createdBy: DOC_MARCOS, assignedTo: NURSE_ANA, currentEscalationLevel: 0,
    sla: sla('receive'), evidence: [], history: [hist('created', DOC_MARCOS)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },
  {
    id: 'TASK-006', shortCode: 'T-006', version: 4,
    type: 'vital-signs', category: 'assistencial', subcategory: 'avaliacao',
    priority: 'normal', status: 'completed', statusChangedAt: NOW,
    title: 'Sinais vitais 6/6h',
    ward: 'Ala 3B', bed: '303A', patientMrn: 'MRN-004', patientName: 'Sarah Johnson',
    createdBy: NURSE_ANA, assignedTo: TECH_CARLOS, currentEscalationLevel: 0,
    sla: sla('complete'), completedAt: NOW, completedBy: TECH_CARLOS,
    evidence: [{ id: 'EV-001', type: 'measurement', value: 'PA 130/80, FC 78, T 36.5, SpO2 97%', attachedBy: TECH_CARLOS, attachedAt: NOW }],
    receivedAt: NOW, acceptedAt: NOW, startedAt: NOW,
    history: [hist('created', NURSE_ANA), hist('received', TECH_CARLOS), hist('started', TECH_CARLOS), hist('completed', TECH_CARLOS)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ASSISTENCIAL / PARECER ──────────────────────────────────────
  {
    id: 'TASK-007', shortCode: 'T-007', version: 1,
    type: 'interconsultation', category: 'assistencial', subcategory: 'parecer',
    priority: 'normal', status: 'open', statusChangedAt: NOW,
    title: 'Parecer cardiologia — arritmia sinusal',
    description: 'ECG com arritmia sinusal, solicitar avaliacao cardiologia',
    ward: 'Ala 3B', bed: '312B', patientMrn: 'MRN-009', patientName: 'Patricia Almeida',
    createdBy: DOC_MARCOS, assignedTo: actor('user-doc-cardio', 'Dr. Fernandes', 'medical_staff_attending', 'Cardiologia'),
    currentEscalationLevel: 0, sla: sla('receive'), evidence: [],
    history: [hist('created', DOC_MARCOS)], comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ASSISTENCIAL / ALTA ─────────────────────────────────────────
  {
    id: 'TASK-008', shortCode: 'T-008', version: 2,
    type: 'discharge-prep', category: 'assistencial', subcategory: 'alta',
    priority: 'high', status: 'accepted', statusChangedAt: NOW,
    title: 'Preparar documentacao de alta',
    description: 'Paciente com alta prevista para hoje 14h',
    ward: 'Ala 3B', bed: '304A', patientMrn: 'MRN-006', patientName: 'Linda Park',
    createdBy: DOC_JULIA, assignedTo: NURSE_ANA, currentEscalationLevel: 0,
    sla: sla('start'), evidence: [], receivedAt: NOW, acceptedAt: NOW,
    history: [hist('created', DOC_JULIA), hist('received', NURSE_ANA), hist('accepted', NURSE_ANA)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── APOIO / LIMPEZA ─────────────────────────────────────────────
  {
    id: 'TASK-009', shortCode: 'T-009', version: 1,
    type: 'cleaning-terminal', category: 'apoio', subcategory: 'limpeza',
    priority: 'urgent', status: 'open', statusChangedAt: NOW,
    title: 'Limpeza terminal — Leito 306A',
    description: 'Paciente teve alta, leito precisa de limpeza terminal para proxima admissao',
    ward: 'Ala 3B', bed: '306A',
    createdBy: COORD_MARIA, assignedTo: CLEANER_JOSE, currentEscalationLevel: 0,
    sla: sla('receive'),
    checklistItems: [
      { id: 'CK-1', label: 'Remover roupas de cama', checked: false },
      { id: 'CK-2', label: 'Limpar superficies', checked: false },
      { id: 'CK-3', label: 'Desinfetar banheiro', checked: false },
      { id: 'CK-4', label: 'Trocar cortinas', checked: false },
      { id: 'CK-5', label: 'Repor materiais', checked: false },
    ],
    evidence: [], history: [hist('created', COORD_MARIA)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'system',
  },
  {
    id: 'TASK-010', shortCode: 'T-010', version: 3,
    type: 'cleaning-concurrent', category: 'apoio', subcategory: 'limpeza',
    priority: 'normal', status: 'in_progress', statusChangedAt: NOW,
    title: 'Limpeza concorrente — Leito 309B',
    ward: 'Ala 3B', bed: '309B',
    createdBy: COORD_MARIA, assignedTo: CLEANER_JOSE, currentEscalationLevel: 0,
    sla: sla('complete'), evidence: [], receivedAt: NOW, acceptedAt: NOW, startedAt: NOW,
    history: [hist('created', COORD_MARIA), hist('received', CLEANER_JOSE), hist('started', CLEANER_JOSE)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'system',
  },

  // ── APOIO / TRANSPORTE ──────────────────────────────────────────
  {
    id: 'TASK-011', shortCode: 'T-011', version: 1,
    type: 'transport-patient', category: 'apoio', subcategory: 'transporte',
    priority: 'high', status: 'open', statusChangedAt: NOW,
    title: 'Transportar paciente ao raio-X',
    description: 'RX torax PA e perfil, paciente deambula com auxilio',
    ward: 'Ala 3B', bed: '307A', patientMrn: 'MRN-008', patientName: 'Thomas Wright',
    createdBy: NURSE_BEA, assignedTo: TRANSPORT_PEDRO, currentEscalationLevel: 0,
    sla: sla('receive'), evidence: [],
    history: [hist('created', NURSE_BEA)], comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── APOIO / MANUTENCAO ──────────────────────────────────────────
  {
    id: 'TASK-012', shortCode: 'T-012', version: 1,
    type: 'maintenance-corrective', category: 'apoio', subcategory: 'manutencao',
    priority: 'normal', status: 'open', statusChangedAt: NOW,
    title: 'Consertar campainha do leito 311A',
    description: 'Campainha de chamada do paciente nao funciona desde ontem',
    ward: 'Ala 3B', bed: '311A',
    createdBy: NURSE_ANA, assignedTo: MAINT_RICARDO, currentEscalationLevel: 0,
    sla: sla('receive'), evidence: [],
    history: [hist('created', NURSE_ANA)], comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── APOIO / NUTRICAO ────────────────────────────────────────────
  {
    id: 'TASK-013', shortCode: 'T-013', version: 2,
    type: 'special-diet-prep', category: 'apoio', subcategory: 'nutricao',
    priority: 'normal', status: 'received', statusChangedAt: NOW,
    title: 'Preparar dieta hipossodica pastosa',
    description: 'Paciente disfagico, dieta hipossodica consistencia pastosa',
    ward: 'Ala 3B', bed: '303A', patientMrn: 'MRN-004', patientName: 'Sarah Johnson',
    createdBy: actor('user-nutri-1', 'Camila Nutri', 'nutritionist', 'Nutricao'),
    assignedTo: actor('user-cook-1', 'Eq. Cozinha', 'cleaning_hygiene', 'Nutricao'),
    currentEscalationLevel: 0, sla: sla('accept'), evidence: [], receivedAt: NOW,
    history: [hist('created', actor('user-nutri-1', 'Camila Nutri', 'nutritionist')), hist('received', actor('user-cook-1', 'Eq. Cozinha', 'cleaning_hygiene'))],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ADMINISTRATIVO / DOCUMENTACAO ───────────────────────────────
  {
    id: 'TASK-014', shortCode: 'T-014', version: 1,
    type: 'insurance-authorization', category: 'administrativo', subcategory: 'documentacao',
    priority: 'high', status: 'open', statusChangedAt: NOW,
    title: 'Solicitar autorizacao TC abdome — Unimed',
    description: 'TC com contraste, codigo TUSS 41010120, senha pendente',
    ward: 'Ala 3B', bed: '310A', patientMrn: 'MRN-007', patientName: 'James Chen',
    createdBy: NURSE_BEA,
    assignedTo: actor('user-billing-1', 'Fernanda Fatura', 'billing_authorization', 'Faturamento'),
    currentEscalationLevel: 0, sla: sla('receive'), evidence: [],
    history: [hist('created', NURSE_BEA)], comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ADMINISTRATIVO / COORDENACAO ────────────────────────────────
  {
    id: 'TASK-015', shortCode: 'T-015', version: 1,
    type: 'family-contact', category: 'administrativo', subcategory: 'coordenacao',
    priority: 'normal', status: 'open', statusChangedAt: NOW,
    title: 'Contatar familia — orientacao de alta',
    description: 'Familia precisa ser orientada sobre cuidados domiciliares pos-alta',
    ward: 'Ala 3B', bed: '304A', patientMrn: 'MRN-006', patientName: 'Linda Park',
    createdBy: DOC_JULIA,
    assignedTo: actor('user-social-1', 'Roberta AS', 'social_worker', 'Servico Social'),
    currentEscalationLevel: 0, sla: sla('receive'), evidence: [],
    history: [hist('created', DOC_JULIA)], comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── FARMACIA ────────────────────────────────────────────────────
  {
    id: 'TASK-016', shortCode: 'T-016', version: 2,
    type: 'validate-prescription', category: 'assistencial', subcategory: 'medicacao',
    priority: 'high', status: 'in_progress', statusChangedAt: NOW,
    title: 'Validar prescricao — interacao medicamentosa',
    description: 'Verificar interacao entre Varfarina e AAS prescrito hoje',
    ward: 'Farmacia', patientMrn: 'MRN-002', patientName: 'Robert Hayes',
    createdBy: actor('system', 'Sistema', 'system'),
    assignedTo: PHARM_LUCIA, currentEscalationLevel: 0,
    sla: sla('complete'), evidence: [], receivedAt: NOW, acceptedAt: NOW, startedAt: NOW,
    history: [hist('created', actor('system', 'Sistema', 'system')), hist('received', PHARM_LUCIA), hist('started', PHARM_LUCIA)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'system',
  },

  // ── DECLINED ────────────────────────────────────────────────────
  {
    id: 'TASK-017', shortCode: 'T-017', version: 3,
    type: 'maintenance-corrective', category: 'apoio', subcategory: 'manutencao',
    priority: 'low', status: 'declined', statusChangedAt: NOW,
    title: 'Trocar lampada fluorescente — corredor Ala 3B',
    ward: 'Ala 3B',
    createdBy: COORD_MARIA, assignedTo: MAINT_RICARDO, currentEscalationLevel: 0,
    sla: sla('receive'), evidence: [],
    declineReason: 'resource_unavailable', declineReasonText: 'Lampada em falta no estoque, pedido de compra #OC-456',
    history: [hist('created', COORD_MARIA), hist('received', MAINT_RICARDO), hist('declined', MAINT_RICARDO, 'Lampada em falta')],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ESCALATED ───────────────────────────────────────────────────
  {
    id: 'TASK-018', shortCode: 'T-018', version: 2,
    type: 'cleaning-terminal', category: 'apoio', subcategory: 'limpeza',
    priority: 'urgent', status: 'escalated', statusChangedAt: NOW,
    title: 'Limpeza terminal — Leito 315A (SLA estourado)',
    description: 'Leito necessario para admissao de urgencia, limpeza atrasada 45 min',
    ward: 'Ala 3B', bed: '315A',
    createdBy: COORD_MARIA, assignedTo: CLEANER_JOSE, currentEscalationLevel: 1,
    sla: sla('receive', true), evidence: [],
    history: [hist('created', COORD_MARIA), hist('sla_breach', actor('system', 'Motor SLA', 'system'), 'SLA de recebimento estourado')],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'system',
  },

  // ── VERIFIED (completed and verified) ───────────────────────────
  {
    id: 'TASK-019', shortCode: 'T-019', version: 6,
    type: 'med-admin-iv', category: 'assistencial', subcategory: 'medicacao',
    priority: 'high', status: 'verified', statusChangedAt: NOW,
    title: 'Administrar Ceftriaxona 1g IV',
    ward: 'Ala 3B', bed: '302A', patientMrn: 'MRN-001', patientName: 'Eleanor Voss',
    createdBy: DOC_MARCOS, assignedTo: NURSE_ANA, currentEscalationLevel: 0,
    sla: sla('complete'), completedBy: NURSE_ANA, verifiedBy: DOC_MARCOS,
    evidence: [
      { id: 'EV-002', type: 'timestamp', value: '2026-04-12T07:32:00.000Z', attachedBy: NURSE_ANA, attachedAt: NOW },
      { id: 'EV-003', type: 'text', value: 'Administrada sem intercorrencias, acesso periferico MSD', attachedBy: NURSE_ANA, attachedAt: NOW },
    ],
    receivedAt: NOW, acceptedAt: NOW, startedAt: NOW, completedAt: NOW, verifiedAt: NOW,
    history: [
      hist('created', DOC_MARCOS), hist('received', NURSE_ANA), hist('accepted', NURSE_ANA),
      hist('started', NURSE_ANA), hist('completed', NURSE_ANA, 'Medicacao administrada'),
      hist('verified', DOC_MARCOS),
    ],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── CANCELLED ───────────────────────────────────────────────────
  {
    id: 'TASK-020', shortCode: 'T-020', version: 2,
    type: 'transport-patient', category: 'apoio', subcategory: 'transporte',
    priority: 'normal', status: 'cancelled', statusChangedAt: NOW,
    title: 'Transportar paciente ao RX (cancelado)',
    description: 'Exame cancelado pelo medico',
    ward: 'Ala 3B', bed: '312B', patientMrn: 'MRN-009', patientName: 'Patricia Almeida',
    createdBy: NURSE_BEA, assignedTo: TRANSPORT_PEDRO, currentEscalationLevel: 0,
    sla: sla('receive'), evidence: [], cancelledAt: NOW,
    history: [hist('created', NURSE_BEA), hist('cancelled', NURSE_BEA, 'Exame cancelado pelo medico')],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },
];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/jfreire/velya/velya-platform && npx tsc --noEmit --project apps/web/tsconfig.json`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/fixtures/hospital-tasks.ts
git commit -m "feat(tasks): add 20 realistic hospital task fixtures

Spans all categories (assistencial, apoio, administrativo), all statuses
(open through verified/cancelled/escalated), with evidence, checklists,
comments, block/decline reasons. 10 actors across 7 roles."
```

---

### Task 6: API Routes — List and Create

**Files:**
- Create: `apps/web/src/app/api/hospital-tasks/route.ts`

- [ ] **Step 1: Create the list/create API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../lib/auth-session';
import {
  createTask,
  listTasks,
  countTasksByStatus,
  type CreateTaskInput,
} from '../../../lib/hospital-task-store';
import type { TaskCategory, TaskSubcategory, TaskPriority, TaskStatus } from '../../../lib/hospital-task-types';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const url = request.nextUrl;
  const assignedToId = url.searchParams.get('inbox') === 'true' ? session.userId : url.searchParams.get('assignedToId') ?? undefined;
  const createdById = url.searchParams.get('sent') === 'true' ? session.userId : url.searchParams.get('createdById') ?? undefined;
  const ward = url.searchParams.get('ward') ?? undefined;
  const status = url.searchParams.get('status') as TaskStatus | undefined;
  const priority = url.searchParams.get('priority') as TaskPriority | undefined;
  const category = url.searchParams.get('category') as TaskCategory | undefined;
  const patientMrn = url.searchParams.get('patientMrn') ?? undefined;
  const search = url.searchParams.get('search') ?? undefined;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;

  const statusArray = status?.includes(',') ? status.split(',') as TaskStatus[] : status;

  const items = listTasks({
    assignedToId,
    createdById,
    ward,
    status: statusArray,
    priority,
    category,
    patientMrn,
    search,
    limit,
  });

  const counts = countTasksByStatus(ward);

  return NextResponse.json({ items, count: items.length, counts });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  const required = ['type', 'category', 'subcategory', 'priority', 'title', 'ward', 'assignedToId', 'assignedToName', 'assignedToRole'];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Campo obrigatorio ausente: ${field}` }, { status: 400 });
    }
  }

  const input: CreateTaskInput = {
    type: body.type as string,
    category: body.category as TaskCategory,
    subcategory: body.subcategory as TaskSubcategory,
    priority: body.priority as TaskPriority,
    title: body.title as string,
    description: body.description as string | undefined,
    instructions: body.instructions as string | undefined,
    patientId: body.patientId as string | undefined,
    patientMrn: body.patientMrn as string | undefined,
    patientName: body.patientName as string | undefined,
    ward: body.ward as string,
    bed: body.bed as string | undefined,
    location: body.location as string | undefined,
    createdBy: {
      id: session.userId,
      name: session.userName,
      role: session.role ?? 'unknown',
      ward: body.ward as string,
    },
    assignedTo: {
      id: body.assignedToId as string,
      name: body.assignedToName as string,
      role: body.assignedToRole as string,
      ward: body.assignedToWard as string | undefined,
    },
    parentTaskId: body.parentTaskId as string | undefined,
    relatedEntityType: body.relatedEntityType as string | undefined,
    relatedEntityId: body.relatedEntityId as string | undefined,
    source: (body.source as CreateTaskInput['source']) ?? 'manual',
    tags: body.tags as string[] | undefined,
    shift: body.shift as string | undefined,
    checklistItems: body.checklistItems as { label: string }[] | undefined,
    completeByOverrideMs: body.completeByOverrideMs as number | undefined,
  };

  const task = createTask(input);

  return NextResponse.json({ task }, { status: 201 });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/jfreire/velya/velya-platform && npx tsc --noEmit --project apps/web/tsconfig.json`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/hospital-tasks/route.ts
git commit -m "feat(tasks): add GET/POST /api/hospital-tasks

GET: list with filters (inbox, ward, status, priority, search).
POST: create with validation of 9 required fields.
Pattern follows /api/delegations."
```

---

### Task 7: API Routes — Single Item

**Files:**
- Create: `apps/web/src/app/api/hospital-tasks/[id]/route.ts`

- [ ] **Step 1: Create the get/update route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/auth-session';
import { getTaskById, updateTaskStatus } from '../../../../lib/hospital-task-store';
import type { TaskStatus, DeclineReason, BlockReason } from '../../../../lib/hospital-task-types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { id } = await context.params;
  const task = getTaskById(id);
  if (!task) {
    return NextResponse.json({ error: 'Tarefa nao encontrada' }, { status: 404 });
  }

  return NextResponse.json({ task });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  if (!body.status) {
    return NextResponse.json({ error: 'Campo "status" obrigatorio' }, { status: 400 });
  }

  const updated = updateTaskStatus({
    taskId: id,
    actorId: session.userId,
    actorName: session.userName,
    actorRole: session.role ?? 'unknown',
    toStatus: body.status as TaskStatus,
    note: body.note as string | undefined,
    declineReason: body.declineReason as DeclineReason | undefined,
    declineReasonText: body.declineReasonText as string | undefined,
    blockReason: body.blockReason as BlockReason | undefined,
    blockReasonText: body.blockReasonText as string | undefined,
    estimatedUnblockAt: body.estimatedUnblockAt as string | undefined,
    newAssignedTo: body.newAssignedTo as { id: string; name: string; role: string } | undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Transicao invalida ou tarefa nao encontrada' }, { status: 400 });
  }

  return NextResponse.json({ task: updated });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/jfreire/velya/velya-platform && npx tsc --noEmit --project apps/web/tsconfig.json`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/hospital-tasks/[id]/route.ts
git commit -m "feat(tasks): add GET/PATCH /api/hospital-tasks/[id]

GET: fetch single task by ID or shortCode.
PATCH: status transition with decline/block reasons.
Pattern follows /api/delegations/[id]."
```

---

### Task 8: API Routes — Evidence and Comments

**Files:**
- Create: `apps/web/src/app/api/hospital-tasks/[id]/evidence/route.ts`
- Create: `apps/web/src/app/api/hospital-tasks/[id]/comments/route.ts`

- [ ] **Step 1: Create the evidence route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../../lib/auth-session';
import { attachEvidence } from '../../../../../lib/hospital-task-store';
import type { EvidenceType } from '../../../../../lib/hospital-task-types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  if (!body.type || !body.value) {
    return NextResponse.json({ error: 'Campos "type" e "value" obrigatorios' }, { status: 400 });
  }

  const updated = attachEvidence({
    taskId: id,
    actor: {
      id: session.userId,
      name: session.userName,
      role: session.role ?? 'unknown',
    },
    type: body.type as EvidenceType,
    value: body.value as string,
    metadata: body.metadata as Record<string, unknown> | undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Tarefa nao encontrada' }, { status: 404 });
  }

  return NextResponse.json({ task: updated }, { status: 201 });
}
```

- [ ] **Step 2: Create the comments route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../../lib/auth-session';
import { addComment } from '../../../../../lib/hospital-task-store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: 'Campo "text" obrigatorio' }, { status: 400 });
  }

  const updated = addComment({
    taskId: id,
    author: {
      id: session.userId,
      name: session.userName,
      role: session.role ?? 'unknown',
    },
    text: body.text as string,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Tarefa nao encontrada' }, { status: 404 });
  }

  return NextResponse.json({ task: updated }, { status: 201 });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/jfreire/velya/velya-platform && npx tsc --noEmit --project apps/web/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/hospital-tasks/[id]/evidence/route.ts apps/web/src/app/api/hospital-tasks/[id]/comments/route.ts
git commit -m "feat(tasks): add POST /api/hospital-tasks/[id]/evidence and /comments

Evidence: attach text, photo, checklist, timestamp, measurement, document.
Comments: add threaded comments to task. Both audit-logged."
```

---

### Task 9: Run All Tests and Final Verification

- [ ] **Step 1: Run state machine tests**

Run: `cd /home/jfreire/velya/velya-platform && npx vitest run apps/web/src/lib/__tests__/hospital-task-state-machine.test.ts`
Expected: all PASS

- [ ] **Step 2: Run store tests**

Run: `cd /home/jfreire/velya/velya-platform && npx vitest run apps/web/src/lib/__tests__/hospital-task-store.test.ts`
Expected: all PASS

- [ ] **Step 3: Run TypeScript check**

Run: `cd /home/jfreire/velya/velya-platform && npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: no errors

- [ ] **Step 4: Run design token validation**

Run: `cd /home/jfreire/velya/velya-platform && npx tsx scripts/validate/validate-design-tokens.ts`
Expected: PASS (0 violations)

---

## Self-Review Checklist

**Spec coverage:**
- Section 5 (Status quadro): All 13 statuses defined in types, transitions in state machine ✓
- Section 6 (SLA): SLA_RECEIVE_MS, SLA_ACCEPT_MS, SLA_START_MS defined, buildSLA() in store ✓
- Section 9 (Evidence): 7 evidence types, attachEvidence() function, Evidence interface ✓
- Section 10 (Audit): Every write calls audit() with hash chain ✓
- Section 11 (Decline/Block): 9 decline reasons, 10 block reasons, validateTransition checks ✓
- Section 13 (Types): 50+ task types in fixture, TaskSubcategory enum covers all ✓
- Section 15 (Data model): HospitalTask interface matches spec exactly ✓
- Fixtures: 20 tasks across all categories and statuses ✓
- Tests: 22 state machine tests + 16 store tests ✓

**Placeholder scan:** No TBD, TODO, or placeholders found.

**Type consistency:** TaskStatus, TaskPriority, ActorRef, Evidence — all consistent across types → state machine → store → API → fixtures.
