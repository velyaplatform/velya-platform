/**
 * Clinical alerts store — file-backed evidence for the 4 clinical-tier agents.
 *
 * Why a separate store from cron-store + oncall-store?
 *   - Clinical alerts are CLINICAL output: they appear on /alerts and trigger
 *     human action (Tratar / Reconhecer). They are not operational findings
 *     (cron-store) nor watchdog pages (oncall-store).
 *   - The lifecycle is acknowledge → resolve, not new → resolved-auto.
 *   - The schema matches CriticalAlert from `fixtures/alerts.ts` so the
 *     /alerts page can render either source with the same component.
 *
 * Storage: VELYA_CLINICAL_ALERTS_PATH or /data/velya-cron/clinical-alerts.json
 *
 * Compliance:
 *   - Every write (create / acknowledge / resolve) is audit-logged with
 *     PHI-aware hashing — `patientMrn` is captured in details.
 *   - The 4 generators (`lib/clinical-agents.ts`) are CLINICAL agents and
 *     stay in shadow stage per `.claude/rules/agents.md` "4 weeks for
 *     clinical/financial agents". In shadow stage they STILL run and
 *     produce alerts, because the alert IS the agent's only output —
 *     the human takes the action via /alerts. The clinical "shadow vs
 *     active" distinction does not apply to advisory output, only to
 *     state-mutating actions.
 *   - Idempotency: `createAlertIfNew` dedupes on (source, patientMrn,
 *     title) so re-runs of the same generator don't spam the inbox.
 *
 * The store is capped at MAX_ALERTS to keep the file bounded; older
 * resolved alerts are pruned first when the cap is reached.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { randomBytes } from 'crypto';
import { audit } from './audit-logger';

const STORAGE_PATH =
  process.env.VELYA_CLINICAL_ALERTS_PATH || '/data/velya-cron/clinical-alerts.json';
const MAX_ALERTS = 500;

export type AlertSeverity = 'critical' | 'high';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface ClinicalAlertRecord {
  id: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  /** Agent id that generated the alert */
  source: string;
  /** ISO 8601 timestamp */
  triggeredAt: string;
  patientMrn?: string;
  /** Role label that should action the alert */
  ownerRole: string;
  /** Where to navigate when "Tratar" is clicked */
  actionRoute: string;
  status: AlertStatus;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

interface StoreShape {
  alerts: ClinicalAlertRecord[];
}

function ensureStorage(): void {
  const dir = dirname(STORAGE_PATH);
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // ignore — read path will short-circuit to defaults
    }
  }
  if (!existsSync(STORAGE_PATH)) {
    try {
      writeFileSync(STORAGE_PATH, JSON.stringify({ alerts: [] }, null, 2));
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
    if (!parsed.alerts || !Array.isArray(parsed.alerts)) return { alerts: [] };
    return parsed;
  } catch {
    return { alerts: [] };
  }
}

function writeStore(store: StoreShape): void {
  ensureStorage();
  // Prune resolved alerts first when over the cap.
  if (store.alerts.length > MAX_ALERTS) {
    const resolved = store.alerts.filter((a) => a.status === 'resolved');
    const active = store.alerts.filter((a) => a.status !== 'resolved');
    const keepResolved = resolved.slice(0, Math.max(0, MAX_ALERTS - active.length));
    store.alerts = [...active, ...keepResolved];
  }
  try {
    writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2));
  } catch {
    // ignore — in-memory state remains the source of truth for this run
  }
}

export interface CreateAlertInput {
  severity: AlertSeverity;
  title: string;
  body: string;
  source: string;
  patientMrn?: string;
  ownerRole: string;
  actionRoute: string;
}

/**
 * Create an alert if no ACTIVE alert with the same (source, patientMrn,
 * title) tuple already exists. Returns the alert record (existing or new)
 * and a boolean indicating whether it was newly created.
 */
export function createAlertIfNew(input: CreateAlertInput): {
  alert: ClinicalAlertRecord;
  created: boolean;
} {
  const store = readStore();
  const dup = store.alerts.find(
    (a) =>
      a.status !== 'resolved' &&
      a.source === input.source &&
      a.patientMrn === input.patientMrn &&
      a.title === input.title,
  );
  if (dup) return { alert: dup, created: false };

  const alert: ClinicalAlertRecord = {
    id: `ALERT-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`.toUpperCase(),
    severity: input.severity,
    title: input.title,
    body: input.body,
    source: input.source,
    triggeredAt: new Date().toISOString(),
    patientMrn: input.patientMrn,
    ownerRole: input.ownerRole,
    actionRoute: input.actionRoute,
    status: 'active',
  };
  store.alerts.unshift(alert);
  writeStore(store);

  audit({
    category: 'agent',
    action: 'clinical-alert.created',
    description: `[${input.source}] ${input.severity.toUpperCase()}: ${input.title}`,
    actor: input.source,
    resource: `clinical-alert:${alert.id}`,
    result: input.severity === 'critical' ? 'warning' : 'info',
    details: {
      patientMrn: input.patientMrn,
      ownerRole: input.ownerRole,
    },
  });

  return { alert, created: true };
}

/** List active + acknowledged alerts (resolved are hidden by default). */
export function listClinicalAlerts(opts: { includeResolved?: boolean; limit?: number } = {}): ClinicalAlertRecord[] {
  const store = readStore();
  const filtered = opts.includeResolved
    ? store.alerts
    : store.alerts.filter((a) => a.status !== 'resolved');
  return filtered.slice(0, Math.min(Math.max(opts.limit ?? 200, 1), MAX_ALERTS));
}

export function acknowledgeAlert(id: string, actor: string): ClinicalAlertRecord | null {
  const store = readStore();
  const idx = store.alerts.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  const before = store.alerts[idx];
  if (before.status === 'resolved') return before;
  store.alerts[idx] = {
    ...before,
    status: 'acknowledged',
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: actor,
  };
  writeStore(store);
  audit({
    category: 'agent',
    action: 'clinical-alert.acknowledged',
    description: `Alerta ${id} reconhecido por ${actor}`,
    actor,
    resource: `clinical-alert:${id}`,
    result: 'info',
    details: { patientMrn: before.patientMrn, source: before.source },
  });
  return store.alerts[idx];
}

export function resolveAlert(id: string, actor: string): ClinicalAlertRecord | null {
  const store = readStore();
  const idx = store.alerts.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  const before = store.alerts[idx];
  store.alerts[idx] = {
    ...before,
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: actor,
  };
  writeStore(store);
  audit({
    category: 'agent',
    action: 'clinical-alert.resolved',
    description: `Alerta ${id} resolvido por ${actor}`,
    actor,
    resource: `clinical-alert:${id}`,
    result: 'success',
    details: { patientMrn: before.patientMrn, source: before.source },
  });
  return store.alerts[idx];
}

/** Count alerts in the last `windowMs` (default 24h). */
export function countRecentClinicalAlerts(windowMs = 24 * 60 * 60 * 1000): number {
  const cutoff = Date.now() - windowMs;
  const store = readStore();
  return store.alerts.filter((a) => Date.parse(a.triggeredAt) >= cutoff).length;
}
