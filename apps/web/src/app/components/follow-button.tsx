'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * Follow toggle button. Drop into any detail page header to let the user
 * subscribe to a record and receive in-app notifications when it changes.
 * Mirrors the FavoriteButton pattern (dark-theme, min-h 44, focus ring),
 * but talks to /api/following instead of /api/favorites.
 */

interface FollowButtonProps {
  scope: string;
  entry: { id: string; label: string; href?: string };
  className?: string;
}

interface FollowingGetResponse {
  subscriptions: Array<{ id: string; scope: string }>;
  unreadCount: number;
}

export function FollowButton({ scope, entry, className }: FollowButtonProps) {
  const [following, setFollowing] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/following', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as FollowingGetResponse;
      })
      .then((data) => {
        if (cancelled || !data) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const match = (data.subscriptions ?? []).some(
          (s) => s.scope === scope && s.id === entry.id,
        );
        setFollowing(match);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, entry.id]);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (following) {
        const url = `/api/following?scope=${encodeURIComponent(scope)}&id=${encodeURIComponent(entry.id)}`;
        const res = await fetch(url, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
        if (res.ok) setFollowing(false);
      } else {
        const res = await fetch('/api/following', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope,
            id: entry.id,
            label: entry.label,
            href: entry.href,
          }),
        });
        if (res.ok) setFollowing(true);
      }
    } catch {
      // best effort — leave state unchanged on network error
    } finally {
      setBusy(false);
    }
  }, [busy, following, scope, entry.id, entry.label, entry.href]);

  const label = following ? 'Acompanhando' : 'Acompanhar';
  const ariaLabel = following
    ? `Deixar de acompanhar ${entry.label}`
    : `Acompanhar ${entry.label}`;

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={following}
      aria-label={ariaLabel}
      aria-busy={busy || !loaded}
      title={ariaLabel}
      disabled={busy}
      className={`min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-70 ${
        following
          ? 'bg-neutral-100 border-neutral-900 text-neutral-900 hover:bg-neutral-200'
          : 'bg-neutral-50 border-neutral-300 text-neutral-900 hover:bg-neutral-100'
      } ${className ?? ''}`}
    >
      {label}
    </button>
  );
}
