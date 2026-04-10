'use client';

import { useEffect, useState } from 'react';

/**
 * Recent patients store backed by localStorage. Most clinical workflows
 * involve jumping back and forth between a small set of patients —
 * this lets the topbar surface a quick switcher.
 *
 * Storage key: velya:recent-patients
 * Cap:         10 entries
 * Dedup:       moving an existing MRN to the front
 * SSR-safe:    typeof window guards
 * Reactive:    custom event 'velya:recent-patients-changed' notifies hooks
 */

const STORAGE_KEY = 'velya:recent-patients';
const MAX_ENTRIES = 10;
const CHANGE_EVENT = 'velya:recent-patients-changed';

function safeRead(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

function safeWrite(list: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // localStorage can throw in private mode — ignore
  }
}

export function pushRecentPatient(mrn: string): void {
  if (!mrn) return;
  const current = safeRead();
  const filtered = current.filter((m) => m !== mrn);
  const next = [mrn, ...filtered].slice(0, MAX_ENTRIES);
  safeWrite(next);
}

export function getRecentPatients(): string[] {
  return safeRead();
}

export function clearRecentPatients(): void {
  safeWrite([]);
}

/**
 * React hook that subscribes to recent-patients changes.
 * SSR-safe: returns [] on the server, hydrates on first effect.
 */
export function useRecentPatients(): string[] {
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    setList(safeRead());
    const onChange = () => setList(safeRead());
    window.addEventListener(CHANGE_EVENT, onChange);
    // Cross-tab sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) onChange();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return list;
}
