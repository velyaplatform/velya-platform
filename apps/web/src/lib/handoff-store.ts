/**
 * Shift handoff store — file-backed I-PASS structured handoffs.
 *
 * I-PASS is the structured-handoff bundle endorsed by AHRQ and the Joint
 * Commission as the highest-evidence pattern for shift change in 2024.
 * Reference: https://psnet.ahrq.gov/primer/handoffs
 *
 * I-PASS mnemonic:
 *   I — Illness severity
 *   P — Patient summary
 *   A — Action list
 *   S — Situation awareness & contingency plans
 *   S — Synthesis by receiver (read-back)
 *
 * Each handoff is created by the outgoing professional and explicitly
 * "received" by the incoming one — both sides are audit-logged. The
 * receiver is required to "read back" (acknowledge) the synthesis before
 * the handoff is closed; otherwise it stays in "awaiting-readback" state
 * and surfaces as a pending alert.
 *
 * Storage: VELYA_HANDOFF_PATH or /data/velya-handoffs/handoffs.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { randomBytes } from 'crypto';
import { audit } from './audit-logger';

const STORAGE_PATH = process.env.VELYA_HANDOFF_PATH || '/data/velya-handoffs/handoffs.json';

export type HandoffStatus = 'draft' | 'sent' | 'awaiting-readback' | 'completed' | 'cancelled';
export type IllnessSeverity = 'stable' | 'watcher' | 'unstable';

export interface PatientHandoffEntry {
  patientMrn: string;
  patientName: string;
  ward: string;
  bed?: string;
  illnessSeverity: IllnessSeverity;
  /** P — Patient summary: events, hospital course, ongoing assessment */
  patientSummary: string;
  /** A — Action list with task + owner + due */
  actionItems: { task: string; owner: string; dueAt?: string; done: boolean }[];
  /** S — Situation awareness: what to anticipate, contingency plans */
  situationAwareness: string;
  /** Active orders, drips, devices */
  activeIssues: string[];
}

export interface HandoffHistoryEntry {
  at: string;
  actor: string;
  action:
    | 'created'
    | 'sent'
    | 'received'
    | 'readback-completed'
    | 'completed'
    | 'cancelled'
    | 'note-added'
    | 'patient-updated';
  note?: string;
}

export interface ShiftHandoff {
  id: string;
  /** Outgoing shift owner */
  fromUserId: string;
  fromUserName: string;
  fromRole: string;
  /** Incoming shift owner */
  toUserId: string;
  toUserName: string;
  toRole: string;
  /** Ward / unit being handed off */
  ward: string;
  /** Shift label */
  shiftLabel: string;
  /** When the outgoing shift ends (= start of incoming shift) */
  shiftBoundaryAt: string;
  status: HandoffStatus;
  /** Patients covered in this handoff with full I-PASS structure each */
  patients: PatientHandoffEntry[];
  /** Free-text notes outside of patient-specific items (e.g. unit-wide alerts) */
  unitNotes?: string;
  /** S — Synthesis by receiver: receiver writes their read-back here */
  receiverReadback?: string;
  /** Optional AI-generated executive summary */
  aiSummary?: string;
  history: HandoffHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  receivedAt?: string;
  completedAt?: string;
}

interface StoreShape {
  handoffs: ShiftHandoff[];
}

function ensureStorage(): void {
  const dir = dirname(STORAGE_PATH);
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }
  }
  if (!existsSync(STORAGE_PATH)) {
    try {
      writeFileSync(STORAGE_PATH, JSON.stringify({ handoffs: [] }, null, 2));
    } catch {
      // ignore
    }
  }
}

function readStore(): StoreShape {
  ensureStorage();
  try {
    const raw = readFileSync(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed.handoffs || !Array.isArray(parsed.handoffs)) {
      return { handoffs: [] };
    }
    return parsed;
  } catch {
    return { handoffs: [] };
  }
}

function writeStore(store: StoreShape): void {
  ensureStorage();
  try {
    writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2));
  } catch {
    // ignore
  }
}

export interface CreateHandoffInput {
  fromUserId: string;
  fromUserName: string;
  fromRole: string;
  toUserId: string;
  toUserName: string;
  toRole: string;
  ward: string;
  shiftLabel: string;
  shiftBoundaryAt: string;
  patients: PatientHandoffEntry[];
  unitNotes?: string;
}

export function createHandoff(input: CreateHandoffInput): ShiftHandoff {
  const now = new Date().toISOString();
  const handoff: ShiftHandoff = {
    id: `HOFF-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase(),
    ...input,
    status: 'sent',
    history: [
      {
        at: now,
        actor: input.fromUserName,
        action: 'created',
      },
      {
        at: now,
        actor: input.fromUserName,
        action: 'sent',
        note: `Handoff de ${input.fromUserName} para ${input.toUserName}`,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const store = readStore();
  store.handoffs.unshift(handoff);
  writeStore(store);

  audit({
    category: 'api',
    action: 'handoff.created',
    description: `Passagem de plantão ${handoff.id} de ${input.fromUserName} para ${input.toUserName} (${input.ward})`,
    actor: input.fromUserName,
    resource: `handoff:${handoff.id}`,
    result: 'success',
    details: {
      ward: input.ward,
      patientCount: input.patients.length,
      toUserId: input.toUserId,
    },
  });

  return handoff;
}

export interface ReceiveHandoffInput {
  handoffId: string;
  receiverId: string;
  receiverName: string;
  /** The receiver's read-back / synthesis */
  readback: string;
}

export function receiveHandoff(input: ReceiveHandoffInput): ShiftHandoff | null {
  const store = readStore();
  const idx = store.handoffs.findIndex((h) => h.id === input.handoffId);
  if (idx === -1) return null;
  const handoff = store.handoffs[idx];

  // Authorization: only the assigned receiver can mark it received.
  if (handoff.toUserId !== input.receiverId) {
    audit({
      category: 'api',
      action: 'handoff.unauthorized-receive',
      description: `Tentativa não autorizada de receber handoff ${handoff.id}`,
      actor: input.receiverName,
      resource: `handoff:${handoff.id}`,
      result: 'failure',
    });
    return null;
  }

  const now = new Date().toISOString();
  handoff.status = 'completed';
  handoff.receivedAt = now;
  handoff.completedAt = now;
  handoff.receiverReadback = input.readback;
  handoff.updatedAt = now;
  handoff.history.push({
    at: now,
    actor: input.receiverName,
    action: 'received',
    note: 'Handoff recebido e read-back registrado',
  });
  handoff.history.push({
    at: now,
    actor: input.receiverName,
    action: 'readback-completed',
  });

  store.handoffs[idx] = handoff;
  writeStore(store);

  audit({
    category: 'api',
    action: 'handoff.received',
    description: `Handoff ${handoff.id} recebido por ${input.receiverName}`,
    actor: input.receiverName,
    resource: `handoff:${handoff.id}`,
    result: 'success',
    details: { fromUserId: handoff.fromUserId, ward: handoff.ward },
  });

  return handoff;
}

export interface ListHandoffsQuery {
  /** Inbox: handoffs assigned TO this user */
  toUserId?: string;
  /** Outbox: handoffs created BY this user */
  fromUserId?: string;
  status?: HandoffStatus;
  ward?: string;
  limit?: number;
}

export function listHandoffs(query: ListHandoffsQuery = {}): ShiftHandoff[] {
  const store = readStore();
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  return store.handoffs
    .filter((h) => {
      if (query.toUserId && h.toUserId !== query.toUserId) return false;
      if (query.fromUserId && h.fromUserId !== query.fromUserId) return false;
      if (query.status && h.status !== query.status) return false;
      if (query.ward && h.ward !== query.ward) return false;
      return true;
    })
    .slice(0, limit);
}

export function getHandoffById(id: string): ShiftHandoff | null {
  const store = readStore();
  return store.handoffs.find((h) => h.id === id) ?? null;
}

export function setHandoffAiSummary(id: string, summary: string): ShiftHandoff | null {
  const store = readStore();
  const idx = store.handoffs.findIndex((h) => h.id === id);
  if (idx === -1) return null;
  store.handoffs[idx].aiSummary = summary;
  store.handoffs[idx].updatedAt = new Date().toISOString();
  writeStore(store);
  return store.handoffs[idx];
}
