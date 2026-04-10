/**
 * Generic entity override store.
 *
 * The whole platform's mock data lives in `apps/web/src/lib/fixtures/*.ts`
 * as compile-time constants. Without this layer, editing a record would
 * require a code change + redeploy. The entity store wraps every fixture
 * with a runtime override layer:
 *
 *   - Reads:  fixture[i] is overridden by overrides[moduleId][recordId]
 *             when present, falling back to the original record.
 *   - Writes: a single record patch is persisted to disk and broadcast
 *             via audit log + delegation-style history.
 *
 * Storage layout (file-backed for durability across restarts):
 *
 *   {VELYA_ENTITY_STORE_PATH}/<moduleId>.json
 *   {
 *     "records": {
 *       "REC-001": {
 *         "data": { ... merged fields },
 *         "history": [
 *           {
 *             "at": "2026-04-10T17:00:00Z",
 *             "actor": "Dr. Lima",
 *             "actorId": "EMP-1002",
 *             "fieldChanges": [
 *               { "field": "status", "from": "open", "to": "in-progress" }
 *             ],
 *             "note": "Iniciando atendimento"
 *           }
 *         ],
 *         "deleted": false,
 *         "createdAt": "...",
 *         "updatedAt": "..."
 *       }
 *     },
 *     "newRecords": [ { id: "REC-NEW-001", ... } ]
 *   }
 *
 * Production swap-in: replace the file storage with PostgreSQL or NATS KV
 * without changing any caller — the entity-resolver only sees this module's
 * exports.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { audit } from './audit-logger';

const STORAGE_DIR = process.env.VELYA_ENTITY_STORE_PATH || '/data/velya-entities';

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface EntityHistoryEntry {
  at: string;
  actor: string;
  actorId: string;
  fieldChanges: FieldChange[];
  note?: string;
}

export interface EntityRecordMeta {
  /** Merged data — fields not present here fall back to the fixture record */
  data: Record<string, unknown>;
  history: EntityHistoryEntry[];
  /** True if the record was soft-deleted; resolver hides it */
  deleted: boolean;
  /** True if this is a brand-new record created via /api/entities (not from fixture) */
  isNew?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ModuleStoreShape {
  records: Record<string, EntityRecordMeta>;
}

function ensureDir(): void {
  if (!existsSync(STORAGE_DIR)) {
    try {
      mkdirSync(STORAGE_DIR, { recursive: true });
    } catch {
      // ignore — first write will retry
    }
  }
}

function pathFor(moduleId: string): string {
  return join(STORAGE_DIR, `${moduleId.replace(/[^a-z0-9-_]/gi, '_')}.json`);
}

function readModuleStore(moduleId: string): ModuleStoreShape {
  ensureDir();
  const file = pathFor(moduleId);
  if (!existsSync(file)) {
    return { records: {} };
  }
  try {
    const raw = readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as ModuleStoreShape;
    if (!parsed.records || typeof parsed.records !== 'object') {
      return { records: {} };
    }
    return parsed;
  } catch {
    return { records: {} };
  }
}

function writeModuleStore(moduleId: string, store: ModuleStoreShape): void {
  ensureDir();
  const file = pathFor(moduleId);
  try {
    const dir = dirname(file);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(store, null, 2));
  } catch {
    // best effort
  }
}

/** Returns the override map for a module — caller merges with fixture */
export function getModuleOverrides(moduleId: string): Record<string, EntityRecordMeta> {
  return readModuleStore(moduleId).records;
}

export function getRecordOverride(moduleId: string, recordId: string): EntityRecordMeta | null {
  const store = readModuleStore(moduleId);
  return store.records[recordId] ?? null;
}

export interface PatchEntityInput {
  moduleId: string;
  recordId: string;
  /** Original record from the fixture (or previous merged state) — for diffing */
  baseRecord: Record<string, unknown>;
  /** Partial patch — only the fields the user changed */
  patch: Record<string, unknown>;
  actorId: string;
  actorName: string;
  note?: string;
}

export interface PatchEntityResult {
  record: EntityRecordMeta;
  fieldChanges: FieldChange[];
}

function diff(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const [field, to] of Object.entries(patch)) {
    const from = base[field];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes.push({ field, from, to });
    }
  }
  return changes;
}

export function patchEntityRecord(input: PatchEntityInput): PatchEntityResult {
  const store = readModuleStore(input.moduleId);
  const existing = store.records[input.recordId];
  const baseData = existing?.data ?? input.baseRecord;
  const fieldChanges = diff(baseData, input.patch);

  const now = new Date().toISOString();
  const merged: Record<string, unknown> = { ...baseData, ...input.patch };

  const historyEntry: EntityHistoryEntry = {
    at: now,
    actor: input.actorName,
    actorId: input.actorId,
    fieldChanges,
    note: input.note,
  };

  const next: EntityRecordMeta = {
    data: merged,
    history: [...(existing?.history ?? []), historyEntry],
    deleted: false,
    isNew: existing?.isNew ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  store.records[input.recordId] = next;
  writeModuleStore(input.moduleId, store);

  // Audit chain
  audit({
    category: 'api',
    action: 'entity.updated',
    description: `Atualização em ${input.moduleId}/${input.recordId}: ${fieldChanges
      .map((c) => c.field)
      .join(', ')}`,
    actor: input.actorName,
    resource: `${input.moduleId}:${input.recordId}`,
    result: 'success',
    details: {
      moduleId: input.moduleId,
      recordId: input.recordId,
      fieldChanges,
      note: input.note,
    },
  });

  return { record: next, fieldChanges };
}

export interface CreateEntityInput {
  moduleId: string;
  recordId: string;
  data: Record<string, unknown>;
  actorId: string;
  actorName: string;
}

export function createEntityRecord(input: CreateEntityInput): EntityRecordMeta {
  const store = readModuleStore(input.moduleId);
  const now = new Date().toISOString();
  const record: EntityRecordMeta = {
    data: input.data,
    history: [
      {
        at: now,
        actor: input.actorName,
        actorId: input.actorId,
        fieldChanges: Object.entries(input.data).map(([field, to]) => ({
          field,
          from: undefined,
          to,
        })),
        note: 'Registro criado',
      },
    ],
    deleted: false,
    isNew: true,
    createdAt: now,
    updatedAt: now,
  };
  store.records[input.recordId] = record;
  writeModuleStore(input.moduleId, store);

  audit({
    category: 'api',
    action: 'entity.created',
    description: `Novo registro em ${input.moduleId}: ${input.recordId}`,
    actor: input.actorName,
    resource: `${input.moduleId}:${input.recordId}`,
    result: 'success',
    details: { moduleId: input.moduleId, recordId: input.recordId, data: input.data },
  });

  return record;
}

export function softDeleteRecord(
  moduleId: string,
  recordId: string,
  actorId: string,
  actorName: string,
  note?: string,
): EntityRecordMeta | null {
  const store = readModuleStore(moduleId);
  const existing = store.records[recordId];
  const now = new Date().toISOString();
  const record: EntityRecordMeta = existing
    ? {
        ...existing,
        deleted: true,
        updatedAt: now,
        history: [
          ...existing.history,
          {
            at: now,
            actor: actorName,
            actorId,
            fieldChanges: [{ field: '__deleted', from: false, to: true }],
            note: note ?? 'Registro removido',
          },
        ],
      }
    : {
        data: {},
        deleted: true,
        history: [
          {
            at: now,
            actor: actorName,
            actorId,
            fieldChanges: [{ field: '__deleted', from: false, to: true }],
            note: note ?? 'Registro removido',
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
  store.records[recordId] = record;
  writeModuleStore(moduleId, store);

  audit({
    category: 'api',
    action: 'entity.deleted',
    description: `Soft-delete em ${moduleId}/${recordId}`,
    actor: actorName,
    resource: `${moduleId}:${recordId}`,
    result: 'success',
    details: { moduleId, recordId, note },
  });

  return record;
}

export function restoreRecord(
  moduleId: string,
  recordId: string,
  actorId: string,
  actorName: string,
): EntityRecordMeta | null {
  const store = readModuleStore(moduleId);
  const existing = store.records[recordId];
  if (!existing) return null;
  const now = new Date().toISOString();
  const record: EntityRecordMeta = {
    ...existing,
    deleted: false,
    updatedAt: now,
    history: [
      ...existing.history,
      {
        at: now,
        actor: actorName,
        actorId,
        fieldChanges: [{ field: '__deleted', from: true, to: false }],
        note: 'Registro restaurado',
      },
    ],
  };
  store.records[recordId] = record;
  writeModuleStore(moduleId, store);

  audit({
    category: 'api',
    action: 'entity.restored',
    description: `Restauração de ${moduleId}/${recordId}`,
    actor: actorName,
    resource: `${moduleId}:${recordId}`,
    result: 'success',
    details: { moduleId, recordId },
  });

  return record;
}
