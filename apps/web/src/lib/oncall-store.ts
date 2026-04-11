/**
 * On-call paging store — file-backed evidence for `page-on-call` actions.
 *
 * Why a separate store from cron-store?
 *   - Pages have a different lifecycle than findings: they are immutable
 *     evidence of "the watchdog screamed at this exact time", not items
 *     that get resolved/dismissed.
 *   - Pages need to be queryable independently from findings (an oncall
 *     dashboard wants to count pages this week, see who got paged, etc).
 *   - Keeping them in their own file lets the cron-store schema stay small.
 *
 * Storage: VELYA_ONCALL_PATH or /data/velya-cron/oncall-pages.json
 *
 * Compliance:
 *   - Every page is audit-logged via lib/audit-logger.
 *   - The ring buffer is capped at MAX_PAGES so the file never grows
 *     unbounded; the K8s alertmanager is the source of truth for any
 *     retention beyond MAX_PAGES.
 *   - This module is read-only beyond the `pageOnCall` write — there is
 *     no delete/update API. Pages are immutable evidence.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { randomBytes } from 'crypto';
import { audit } from './audit-logger';

const STORAGE_PATH = process.env.VELYA_ONCALL_PATH || '/data/velya-cron/oncall-pages.json';
const MAX_PAGES = 500;

export type PageSeverity = 'info' | 'warning' | 'critical';

export interface OnCallPage {
  id: string;
  /** Agent that triggered the page (e.g. observability-watchdog-agent) */
  triggeredBy: string;
  /** Plain-language reason — operator reads this on the dashboard */
  message: string;
  severity: PageSeverity;
  /** Optional structured context (target finding, scorecard snapshot, etc) */
  context?: Record<string, unknown>;
  /** ISO timestamp when the page was raised */
  raisedAt: string;
}

interface StoreShape {
  pages: OnCallPage[];
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
      writeFileSync(STORAGE_PATH, JSON.stringify({ pages: [] }, null, 2));
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
    if (!parsed.pages || !Array.isArray(parsed.pages)) return { pages: [] };
    return parsed;
  } catch {
    return { pages: [] };
  }
}

function writeStore(store: StoreShape): void {
  ensureStorage();
  try {
    writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2));
  } catch {
    // ignore — in-memory state remains the source of truth for this run
  }
}

export interface RaisePageInput {
  triggeredBy: string;
  message: string;
  severity?: PageSeverity;
  context?: Record<string, unknown>;
}

/**
 * Raise an on-call page. Always succeeds (or silently no-ops on disk error)
 * because the watchdog must never crash on its own paging path.
 */
export function pageOnCall(input: RaisePageInput): OnCallPage {
  const page: OnCallPage = {
    id: `PAGE-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`,
    triggeredBy: input.triggeredBy,
    message: input.message,
    severity: input.severity ?? 'warning',
    context: input.context,
    raisedAt: new Date().toISOString(),
  };

  const store = readStore();
  store.pages.unshift(page);
  store.pages = store.pages.slice(0, MAX_PAGES);
  writeStore(store);

  audit({
    category: 'agent',
    action: 'oncall.paged',
    description: `[${page.triggeredBy}] On-call paged (${page.severity}): ${page.message}`,
    actor: page.triggeredBy,
    resource: `oncall-page:${page.id}`,
    result: page.severity === 'critical' ? 'warning' : 'info',
    details: { context: input.context },
  });

  return page;
}

/** List the most recent N pages, newest first. */
export function listOnCallPages(limit = 50): OnCallPage[] {
  const store = readStore();
  return store.pages.slice(0, Math.min(Math.max(limit, 1), MAX_PAGES));
}

/** Count pages in the last `windowMs` milliseconds (default = 24h). */
export function countRecentPages(windowMs = 24 * 60 * 60 * 1000): number {
  const cutoff = Date.now() - windowMs;
  const store = readStore();
  return store.pages.filter((p) => Date.parse(p.raisedAt) >= cutoff).length;
}
