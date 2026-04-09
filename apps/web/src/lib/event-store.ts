import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const STORE_DIR = process.env.VELYA_EVENT_STORE_PATH || '/tmp/velya-events';
const MAX_EVENTS_PER_FILE = 10000;

// Ensure store directory exists
if (!existsSync(STORE_DIR)) {
  mkdirSync(STORE_DIR, { recursive: true });
}

export interface StoredEvent {
  id: string;
  timestamp: string;
  receivedAt: string;
  source: string;
  type: string; // 'sentinel' | 'alert' | 'event' | 'error' | 'action'
  severity: string;
  data: Record<string, unknown>;
  delivered: boolean;
  deliveryAttempts: number;
  acked: boolean;
}

function getStorePath(type: string): string {
  return join(STORE_DIR, `${type}.json`);
}

function readStore(type: string): StoredEvent[] {
  const path = getStorePath(type);
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return [];
  }
}

function writeStore(type: string, events: StoredEvent[]): void {
  const path = getStorePath(type);
  // Keep only last MAX_EVENTS_PER_FILE
  const trimmed = events.slice(0, MAX_EVENTS_PER_FILE);
  writeFileSync(path, JSON.stringify(trimmed, null, 2));
}

export function appendEvent(
  type: string,
  event: Omit<StoredEvent, 'id' | 'receivedAt' | 'delivered' | 'deliveryAttempts' | 'acked'>,
): StoredEvent {
  const stored: StoredEvent = {
    ...event,
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: new Date().toISOString(),
    delivered: true,
    deliveryAttempts: 1,
    acked: false,
  };
  const events = readStore(type);
  events.unshift(stored);
  writeStore(type, events);
  return stored;
}

export function getEvents(
  type: string,
  filters?: {
    severity?: string;
    source?: string;
    limit?: number;
    since?: string;
    unackedOnly?: boolean;
  },
): { events: StoredEvent[]; total: number } {
  let events = readStore(type);
  if (filters?.severity) events = events.filter((e) => e.severity === filters.severity);
  if (filters?.source) events = events.filter((e) => e.source === filters.source);
  if (filters?.since) {
    const since = filters.since;
    events = events.filter((e) => e.receivedAt >= since);
  }
  if (filters?.unackedOnly) events = events.filter((e) => !e.acked);
  const total = events.length;
  if (filters?.limit) events = events.slice(0, filters.limit);
  return { events, total };
}

export function ackEvent(type: string, eventId: string): boolean {
  const events = readStore(type);
  const idx = events.findIndex((e) => e.id === eventId);
  if (idx === -1) return false;
  events[idx].acked = true;
  writeStore(type, events);
  return true;
}

export function getStats(): Record<
  string,
  { total: number; unacked: number; lastUpdate: string | null }
> {
  const types = ['sentinel', 'alert', 'event', 'error', 'action'];
  const stats: Record<string, { total: number; unacked: number; lastUpdate: string | null }> = {};
  for (const type of types) {
    const events = readStore(type);
    stats[type] = {
      total: events.length,
      unacked: events.filter((e) => !e.acked).length,
      lastUpdate: events[0]?.receivedAt || null,
    };
  }
  return stats;
}
