/**
 * File-backed delegation store. Each delegation is a hospital task that one
 * user explicitly assigns to another user with a deadline, context, and
 * priority. Every state transition is audit-logged via lib/audit-logger.
 *
 * Production should replace this with NATS JetStream KV or PostgreSQL +
 * Temporal workflow. For now, file storage gives durability across restarts
 * without adding any external dependency.
 *
 * Storage path: VELYA_DELEGATION_PATH or /data/velya-delegations/delegations.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { randomBytes } from 'crypto';
import { audit } from './audit-logger';

const STORAGE_PATH =
  process.env.VELYA_DELEGATION_PATH || '/data/velya-delegations/delegations.json';

export type DelegationStatus =
  | 'open'
  | 'acknowledged'
  | 'in-progress'
  | 'blocked'
  | 'completed'
  | 'declined'
  | 'cancelled';

export type DelegationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type DelegationCategory =
  | 'clinical'
  | 'administrative'
  | 'pharmacy'
  | 'lab'
  | 'imaging'
  | 'transport'
  | 'cleaning'
  | 'maintenance'
  | 'billing'
  | 'compliance'
  | 'other';

export interface DelegationHistoryEntry {
  at: string;
  actor: string;
  action: 'created' | 'acknowledged' | 'started' | 'blocked' | 'completed' | 'declined' | 'cancelled' | 'commented' | 'reassigned';
  note?: string;
  fromStatus?: DelegationStatus;
  toStatus?: DelegationStatus;
}

export interface Delegation {
  id: string;
  title: string;
  description: string;
  category: DelegationCategory;
  priority: DelegationPriority;
  status: DelegationStatus;
  /** User id of the delegator */
  createdById: string;
  /** Display name */
  createdByName: string;
  /** User id of the assignee */
  assignedToId: string;
  /** Display name of assignee */
  assignedToName: string;
  /** Optional patient context */
  patientMrn?: string;
  /** Optional related entity (encounter, prescription, etc.) */
  relatedEntity?: { type: string; id: string };
  /** ISO due date/time */
  dueAt?: string;
  /** Required deliverables checklist */
  deliverables: string[];
  /** Free-form acceptance criteria */
  acceptanceCriteria?: string;
  /** Hospital location context */
  location?: string;
  /** Created/updated timestamps */
  createdAt: string;
  updatedAt: string;
  /** Full audit trail of state transitions */
  history: DelegationHistoryEntry[];
}

interface StoreShape {
  delegations: Delegation[];
}

function ensureStorage(): void {
  const dir = dirname(STORAGE_PATH);
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // ignore — will retry on next call
    }
  }
  if (!existsSync(STORAGE_PATH)) {
    try {
      writeFileSync(STORAGE_PATH, JSON.stringify({ delegations: [] }, null, 2));
    } catch {
      // ignore — read will fall back to empty
    }
  }
}

function readStore(): StoreShape {
  ensureStorage();
  try {
    const raw = readFileSync(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed.delegations || !Array.isArray(parsed.delegations)) {
      return { delegations: [] };
    }
    return parsed;
  } catch {
    return { delegations: [] };
  }
}

function writeStore(store: StoreShape): void {
  ensureStorage();
  try {
    writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2));
  } catch {
    // ignore — caller treats failure as best-effort
  }
}

export interface CreateDelegationInput {
  title: string;
  description: string;
  category: DelegationCategory;
  priority: DelegationPriority;
  createdById: string;
  createdByName: string;
  assignedToId: string;
  assignedToName: string;
  patientMrn?: string;
  relatedEntity?: { type: string; id: string };
  dueAt?: string;
  deliverables?: string[];
  acceptanceCriteria?: string;
  location?: string;
}

export function createDelegation(input: CreateDelegationInput): Delegation {
  const now = new Date().toISOString();
  const delegation: Delegation = {
    id: `DEL-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase(),
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priority: input.priority,
    status: 'open',
    createdById: input.createdById,
    createdByName: input.createdByName,
    assignedToId: input.assignedToId,
    assignedToName: input.assignedToName,
    patientMrn: input.patientMrn,
    relatedEntity: input.relatedEntity,
    dueAt: input.dueAt,
    deliverables: input.deliverables ?? [],
    acceptanceCriteria: input.acceptanceCriteria,
    location: input.location,
    createdAt: now,
    updatedAt: now,
    history: [
      {
        at: now,
        actor: input.createdByName,
        action: 'created',
        toStatus: 'open',
        note: `Tarefa delegada para ${input.assignedToName}`,
      },
    ],
  };

  const store = readStore();
  store.delegations.unshift(delegation);
  writeStore(store);

  audit({
    category: 'api',
    action: 'delegation.created',
    description: `Delegação ${delegation.id} criada de ${input.createdByName} para ${input.assignedToName}`,
    actor: input.createdByName,
    resource: `delegation:${delegation.id}`,
    result: 'success',
    details: {
      assignedToId: input.assignedToId,
      patientMrn: input.patientMrn,
      category: input.category,
      priority: input.priority,
      dueAt: input.dueAt,
    },
  });

  return delegation;
}

export interface UpdateDelegationInput {
  delegationId: string;
  actorId: string;
  actorName: string;
  toStatus: DelegationStatus;
  note?: string;
}

export function updateDelegationStatus(input: UpdateDelegationInput): Delegation | null {
  const store = readStore();
  const idx = store.delegations.findIndex((d) => d.id === input.delegationId);
  if (idx === -1) return null;
  const delegation = store.delegations[idx];

  // Authorization: only the assignee or the creator may update.
  if (input.actorId !== delegation.assignedToId && input.actorId !== delegation.createdById) {
    audit({
      category: 'api',
      action: 'delegation.unauthorized-update',
      description: `Tentativa não autorizada de atualizar delegação ${delegation.id}`,
      actor: input.actorName,
      resource: `delegation:${delegation.id}`,
      result: 'failure',
      details: { attemptedStatus: input.toStatus },
    });
    return null;
  }

  const fromStatus = delegation.status;
  const now = new Date().toISOString();
  const action: DelegationHistoryEntry['action'] =
    input.toStatus === 'in-progress'
      ? 'started'
      : input.toStatus === 'completed'
        ? 'completed'
        : input.toStatus === 'declined'
          ? 'declined'
          : input.toStatus === 'cancelled'
            ? 'cancelled'
            : input.toStatus === 'blocked'
              ? 'blocked'
              : input.toStatus === 'acknowledged'
                ? 'acknowledged'
                : 'commented';

  delegation.status = input.toStatus;
  delegation.updatedAt = now;
  delegation.history.push({
    at: now,
    actor: input.actorName,
    action,
    fromStatus,
    toStatus: input.toStatus,
    note: input.note,
  });

  store.delegations[idx] = delegation;
  writeStore(store);

  audit({
    category: 'api',
    action: `delegation.${action}`,
    description: `Delegação ${delegation.id}: ${fromStatus} → ${input.toStatus}`,
    actor: input.actorName,
    resource: `delegation:${delegation.id}`,
    result: 'success',
    details: { fromStatus, toStatus: input.toStatus, note: input.note },
  });

  return delegation;
}

export interface ListDelegationsQuery {
  /** Filter to delegations assigned to this user id */
  assignedToId?: string;
  /** Filter to delegations created by this user id */
  createdById?: string;
  /** Filter by status */
  status?: DelegationStatus;
  /** Filter by patient */
  patientMrn?: string;
  /** Limit results (default 50) */
  limit?: number;
}

export function listDelegations(query: ListDelegationsQuery = {}): Delegation[] {
  const store = readStore();
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  return store.delegations
    .filter((d) => {
      if (query.assignedToId && d.assignedToId !== query.assignedToId) return false;
      if (query.createdById && d.createdById !== query.createdById) return false;
      if (query.status && d.status !== query.status) return false;
      if (query.patientMrn && d.patientMrn !== query.patientMrn) return false;
      return true;
    })
    .slice(0, limit);
}

export function getDelegationById(id: string): Delegation | null {
  const store = readStore();
  return store.delegations.find((d) => d.id === id) ?? null;
}

export function countOpenForAssignee(assignedToId: string): number {
  const store = readStore();
  return store.delegations.filter(
    (d) => d.assignedToId === assignedToId && (d.status === 'open' || d.status === 'acknowledged' || d.status === 'in-progress'),
  ).length;
}
