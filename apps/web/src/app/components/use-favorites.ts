'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Reactive hook for the per-user favorites store. The store is server-side
 * (file-backed via /api/favorites) so favorites sync across devices, unlike
 * the localStorage-backed recents.
 *
 * Usage:
 *   const { items, add, remove, isFavorited, refresh } = useFavorites('patients');
 *   if (isFavorited('MRN-EXAMPLE')) ...
 *   add({ id: 'MRN-EXAMPLE', label: 'Sofia Andrade', href: '/patients/MRN-EXAMPLE' });
 *
 * Pass an empty scope to get all scopes at once via `byScope`.
 */

export interface FavoriteEntry {
  id: string;
  label: string;
  href?: string;
  description?: string;
  addedAt: string;
}

export interface UseFavoritesResult {
  items: FavoriteEntry[];
  byScope: Record<string, FavoriteEntry[]>;
  loading: boolean;
  error: string | null;
  isFavorited: (id: string) => boolean;
  add: (entry: Omit<FavoriteEntry, 'addedAt'>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggle: (entry: Omit<FavoriteEntry, 'addedAt'>) => Promise<void>;
  refresh: () => Promise<void>;
}

const CHANGE_EVENT = 'velya:favorites-changed';

export function useFavorites(scope: string): UseFavoritesResult {
  const [items, setItems] = useState<FavoriteEntry[]>([]);
  const [byScope, setByScope] = useState<Record<string, FavoriteEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const url = scope ? `/api/favorites?scope=${encodeURIComponent(scope)}` : '/api/favorites';
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) {
        setError(`Erro ${res.status}`);
        return;
      }
      const data = (await res.json()) as
        | { items: FavoriteEntry[]; scope: string }
        | { scopes: Record<string, FavoriteEntry[]> };
      if ('items' in data) {
        setItems(data.items);
      }
      if ('scopes' in data) {
        setByScope(data.scopes);
        if (scope && data.scopes[scope]) {
          setItems(data.scopes[scope]);
        }
      }
      setError(null);
    } catch {
      setError('Erro de rede');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void refresh();
    const onChange = () => {
      void refresh();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(CHANGE_EVENT, onChange);
      return () => window.removeEventListener(CHANGE_EVENT, onChange);
    }
    return undefined;
  }, [refresh]);

  const isFavorited = useCallback(
    (id: string) => items.some((e) => e.id === id),
    [items],
  );

  const add = useCallback(
    async (entry: Omit<FavoriteEntry, 'addedAt'>) => {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ scope, entry }),
      });
      if (res.ok) {
        const data = (await res.json()) as { items: FavoriteEntry[] };
        setItems(data.items);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
        }
      }
    },
    [scope],
  );

  const remove = useCallback(
    async (id: string) => {
      const res = await fetch(
        `/api/favorites?scope=${encodeURIComponent(scope)}&id=${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { items: FavoriteEntry[] };
        setItems(data.items);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
        }
      }
    },
    [scope],
  );

  const toggle = useCallback(
    async (entry: Omit<FavoriteEntry, 'addedAt'>) => {
      if (isFavorited(entry.id)) {
        await remove(entry.id);
      } else {
        await add(entry);
      }
    },
    [isFavorited, remove, add],
  );

  return { items, byScope, loading, error, isFavorited, add, remove, toggle, refresh };
}
