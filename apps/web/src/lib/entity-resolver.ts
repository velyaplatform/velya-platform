/**
 * Entity resolver — bridges the static fixtures with the runtime entity
 * store so any caller can ask "give me the live records for module X"
 * and get a list that already has user edits applied on top.
 *
 * Wiring: each module in module-manifest.ts has a `fixturePath` like
 * 'lib/fixtures/prescriptions' and a `fixtureExport` like 'PRESCRIPTIONS'.
 * Importing fixtures dynamically would force every page to be a server
 * component, so we use a static registry below — every fixture is imported
 * once and indexed by moduleId. Adding a new module = one import + one
 * registry line, same place where you add it to the manifest.
 */

import { getModuleById } from './module-manifest';
import { getModuleOverrides, type EntityRecordMeta } from './entity-store';

// ----- Fixture imports (kept in sync with module-manifest.ts) -----
import { PRESCRIPTIONS } from './fixtures/prescriptions';
import { LAB_ORDERS } from './fixtures/lab-orders';
import { LAB_RESULTS } from './fixtures/lab-results';
import { IMAGING_ORDERS } from './fixtures/imaging-orders';
import { IMAGING_RESULTS } from './fixtures/imaging-results';
import { PHARMACY_STOCK } from './fixtures/pharmacy-stock';
import { CLEANING_TASKS } from './fixtures/cleaning-tasks';
import { TRANSPORT_ORDERS } from './fixtures/transport-orders';
import { MEAL_ORDERS } from './fixtures/meal-orders';
import { SUPPLY_ITEMS } from './fixtures/supply-items';
import { PURCHASE_ORDERS } from './fixtures/purchase-orders';
import { ASSETS } from './fixtures/assets';
import { WORK_ORDERS } from './fixtures/work-orders';
import { WASTE_MANIFESTS } from './fixtures/waste-manifests';
import { CHARGES } from './fixtures/charges';
import { CLAIMS } from './fixtures/claims';
import { DENIALS } from './fixtures/denials';
import { INCIDENTS } from './fixtures/incidents';
import { AUDIT_EVENTS } from './fixtures/audit-events';
import { CREDENTIALS } from './fixtures/credentials';
import { CONSENT_FORMS } from './fixtures/consent-forms';

interface RecordLike {
  id?: string;
  [k: string]: unknown;
}

/**
 * Static registry mapping moduleId → seed records from the fixture.
 * Each fixture entry has its own strict interface, but they all share an
 * `id: string` field. We cast at the boundary to a loose RecordLike[] so
 * the resolver can iterate dynamically.
 */
const FIXTURE_REGISTRY: Record<string, readonly RecordLike[]> = {
  prescriptions: PRESCRIPTIONS as unknown as readonly RecordLike[],
  'lab-orders': LAB_ORDERS as unknown as readonly RecordLike[],
  'lab-results': LAB_RESULTS as unknown as readonly RecordLike[],
  'imaging-orders': IMAGING_ORDERS as unknown as readonly RecordLike[],
  'imaging-results': IMAGING_RESULTS as unknown as readonly RecordLike[],
  'pharmacy-stock': PHARMACY_STOCK as unknown as readonly RecordLike[],
  'cleaning-tasks': CLEANING_TASKS as unknown as readonly RecordLike[],
  'transport-orders': TRANSPORT_ORDERS as unknown as readonly RecordLike[],
  'meal-orders': MEAL_ORDERS as unknown as readonly RecordLike[],
  'supply-items': SUPPLY_ITEMS as unknown as readonly RecordLike[],
  'purchase-orders': PURCHASE_ORDERS as unknown as readonly RecordLike[],
  assets: ASSETS as unknown as readonly RecordLike[],
  'work-orders': WORK_ORDERS as unknown as readonly RecordLike[],
  'waste-manifests': WASTE_MANIFESTS as unknown as readonly RecordLike[],
  charges: CHARGES as unknown as readonly RecordLike[],
  claims: CLAIMS as unknown as readonly RecordLike[],
  denials: DENIALS as unknown as readonly RecordLike[],
  incidents: INCIDENTS as unknown as readonly RecordLike[],
  'audit-events': AUDIT_EVENTS as unknown as readonly RecordLike[],
  credentials: CREDENTIALS as unknown as readonly RecordLike[],
  'consent-forms': CONSENT_FORMS as unknown as readonly RecordLike[],
};

export function getFixtureRecords(moduleId: string): readonly RecordLike[] {
  return FIXTURE_REGISTRY[moduleId] ?? [];
}

export interface ResolvedRecord {
  id: string;
  data: Record<string, unknown>;
  /** True if the record exists only as an override (no fixture seed) */
  isNew: boolean;
  /** True if there is at least one override on top of the fixture */
  hasOverride: boolean;
  /** True if the record was soft-deleted via the entity store */
  deleted: boolean;
  /** Last update time (ISO) */
  updatedAt?: string;
}

/**
 * Returns the live list of records for a module: fixture + overrides + new
 * records, with deleted records hidden by default.
 */
export function listLiveRecords(
  moduleId: string,
  opts: { includeDeleted?: boolean } = {},
): ResolvedRecord[] {
  if (!getModuleById(moduleId)) {
    return [];
  }
  const seeds = getFixtureRecords(moduleId);
  const overrides = getModuleOverrides(moduleId);
  const seenIds = new Set<string>();
  const out: ResolvedRecord[] = [];

  for (const seed of seeds) {
    const id = String(seed.id ?? '');
    if (!id) continue;
    seenIds.add(id);
    const ov = overrides[id];
    if (ov?.deleted && !opts.includeDeleted) continue;
    out.push({
      id,
      data: ov ? { ...seed, ...ov.data } : { ...seed },
      isNew: false,
      hasOverride: !!ov,
      deleted: ov?.deleted ?? false,
      updatedAt: ov?.updatedAt,
    });
  }

  // New records (created via /api/entities, not in the fixture)
  for (const [id, ov] of Object.entries(overrides)) {
    if (seenIds.has(id)) continue;
    if (ov.deleted && !opts.includeDeleted) continue;
    if (!ov.isNew) continue;
    out.push({
      id,
      data: { id, ...ov.data },
      isNew: true,
      hasOverride: true,
      deleted: ov.deleted,
      updatedAt: ov.updatedAt,
    });
  }

  return out;
}

export function resolveRecord(moduleId: string, recordId: string): ResolvedRecord | null {
  const seeds = getFixtureRecords(moduleId);
  const overrides = getModuleOverrides(moduleId);
  const ov = overrides[recordId];
  const seed = seeds.find((s) => String(s.id) === recordId);
  if (!seed && !ov) return null;
  if (!seed && ov) {
    return {
      id: recordId,
      data: { id: recordId, ...ov.data },
      isNew: !!ov.isNew,
      hasOverride: true,
      deleted: ov.deleted,
      updatedAt: ov.updatedAt,
    };
  }
  if (seed && !ov) {
    return {
      id: recordId,
      data: { ...seed },
      isNew: false,
      hasOverride: false,
      deleted: false,
    };
  }
  return {
    id: recordId,
    data: { ...(seed as RecordLike), ...(ov as EntityRecordMeta).data },
    isNew: false,
    hasOverride: true,
    deleted: (ov as EntityRecordMeta).deleted,
    updatedAt: (ov as EntityRecordMeta).updatedAt,
  };
}

export function getRecordHistory(moduleId: string, recordId: string) {
  const overrides = getModuleOverrides(moduleId);
  return overrides[recordId]?.history ?? [];
}
