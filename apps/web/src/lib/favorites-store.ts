/**
 * Favorites store — file-backed per user, multi-scope.
 *
 * "Scopes" let the same user have separate favorites lists for different
 * contexts: a clinician can favorite patients, a pharmacist can favorite
 * medications, an admin can favorite reports — all in the same store.
 *
 * Storage: VELYA_FAVORITES_PATH or /data/velya-favorites/favorites.json
 * Shape:
 *   {
 *     "users": {
 *       "<userId>": {
 *         "<scope>": [
 *           { id: "MRN-013", label: "Sofia Andrade", href: "/patients/MRN-013", addedAt: "..." },
 *           ...
 *         ]
 *       }
 *     }
 *   }
 *
 * Production swap: replace file storage with NATS KV / Redis without
 * changing any caller (the API exports stay the same).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { audit } from './audit-logger';

const STORAGE_PATH = process.env.VELYA_FAVORITES_PATH || '/data/velya-favorites/favorites.json';
const MAX_PER_SCOPE = 50;

export interface FavoriteEntry {
  /** Unique id within the scope */
  id: string;
  /** Display label */
  label: string;
  /** Optional href to navigate to */
  href?: string;
  /** Optional secondary line (e.g. age + ward + diagnosis) */
  description?: string;
  /** ISO timestamp when added */
  addedAt: string;
}

interface StoreShape {
  users: Record<string, Record<string, FavoriteEntry[]>>;
}

function ensureStorage(): void {
  const dir = dirname(STORAGE_PATH);
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // ignore — first write will retry
    }
  }
  if (!existsSync(STORAGE_PATH)) {
    try {
      writeFileSync(STORAGE_PATH, JSON.stringify({ users: {} }, null, 2));
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
    if (!parsed.users || typeof parsed.users !== 'object') {
      return { users: {} };
    }
    return parsed;
  } catch {
    return { users: {} };
  }
}

function writeStore(store: StoreShape): void {
  ensureStorage();
  try {
    writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2));
  } catch {
    // best effort
  }
}

export function listFavorites(userId: string, scope: string): FavoriteEntry[] {
  const store = readStore();
  return store.users[userId]?.[scope] ?? [];
}

export function listAllFavorites(userId: string): Record<string, FavoriteEntry[]> {
  const store = readStore();
  return store.users[userId] ?? {};
}

export interface AddFavoriteInput {
  userId: string;
  userName: string;
  scope: string;
  entry: Omit<FavoriteEntry, 'addedAt'>;
}

export function addFavorite(input: AddFavoriteInput): FavoriteEntry[] {
  const store = readStore();
  if (!store.users[input.userId]) store.users[input.userId] = {};
  if (!store.users[input.userId][input.scope]) store.users[input.userId][input.scope] = [];

  // Dedupe — if already there, move to top
  const filtered = store.users[input.userId][input.scope].filter(
    (e) => e.id !== input.entry.id,
  );
  const next: FavoriteEntry = { ...input.entry, addedAt: new Date().toISOString() };
  store.users[input.userId][input.scope] = [next, ...filtered].slice(0, MAX_PER_SCOPE);
  writeStore(store);

  audit({
    category: 'api',
    action: 'favorite.added',
    description: `Favoritou ${input.scope}/${input.entry.id}`,
    actor: input.userName,
    resource: `${input.scope}:${input.entry.id}`,
    result: 'success',
    details: { scope: input.scope, label: input.entry.label, href: input.entry.href },
  });

  return store.users[input.userId][input.scope];
}

export interface RemoveFavoriteInput {
  userId: string;
  userName: string;
  scope: string;
  id: string;
}

export function removeFavorite(input: RemoveFavoriteInput): FavoriteEntry[] {
  const store = readStore();
  if (!store.users[input.userId]?.[input.scope]) return [];
  store.users[input.userId][input.scope] = store.users[input.userId][input.scope].filter(
    (e) => e.id !== input.id,
  );
  writeStore(store);

  audit({
    category: 'api',
    action: 'favorite.removed',
    description: `Removeu favorito ${input.scope}/${input.id}`,
    actor: input.userName,
    resource: `${input.scope}:${input.id}`,
    result: 'success',
    details: { scope: input.scope },
  });

  return store.users[input.userId][input.scope];
}

export function isFavorited(userId: string, scope: string, id: string): boolean {
  const store = readStore();
  return (store.users[userId]?.[scope] ?? []).some((e) => e.id === id);
}

export function clearScope(
  userId: string,
  userName: string,
  scope: string,
): void {
  const store = readStore();
  if (!store.users[userId]) return;
  store.users[userId][scope] = [];
  writeStore(store);

  audit({
    category: 'api',
    action: 'favorite.scope-cleared',
    description: `Limpou favoritos do escopo ${scope}`,
    actor: userName,
    resource: scope,
    result: 'success',
    details: { scope },
  });
}
