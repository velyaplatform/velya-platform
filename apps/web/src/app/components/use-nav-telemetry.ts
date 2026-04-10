'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Navigation telemetry — fires `nav.*` events to /api/nav-telemetry which
 * persists them in the global audit log so we can later query the most-used
 * paths, search-empty rates, command-palette usage, etc.
 *
 * This hook only fires events; it never blocks the user. Failures are
 * silently swallowed (best-effort).
 *
 * Reference: docs/architecture/navigation-contextual.md section 13.
 */

export type NavEvent =
  | { type: 'nav.click'; fromRoute: string; toRoute: string; durationMs?: number }
  | { type: 'nav.search'; query: string; resultCount?: number; moduleId?: string }
  | { type: 'nav.filter-apply'; moduleId: string; filterKey: string; filterValue: string }
  | { type: 'nav.deeplink-shared'; recordId: string; channel: string }
  | { type: 'nav.command-palette-open' }
  | { type: 'nav.command-palette-execute'; commandId: string }
  | { type: 'nav.recents-jump'; entityType: string; entityId: string }
  | { type: 'nav.favorite-toggle'; entityType: string; entityId: string; on: boolean }
  | { type: 'nav.error-boundary-triggered'; route: string; error: string };

export function trackNavEvent(event: NavEvent): void {
  if (typeof window === 'undefined') return;
  // Fire and forget
  fetch('/api/nav-telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ ...event, at: new Date().toISOString() }),
    keepalive: true,
  }).catch(() => {
    // best effort
  });
}

/**
 * Hook that fires `nav.click` events whenever the route changes. Mount
 * once at the layout level. Tracks the previous pathname so we can
 * report fromRoute → toRoute.
 */
export function useNavClickTelemetry(): void {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousRef = useRef<string | null>(null);
  const enteredAtRef = useRef<number>(Date.now());

  useEffect(() => {
    const fullRoute = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    const previous = previousRef.current;
    if (previous && previous !== fullRoute) {
      trackNavEvent({
        type: 'nav.click',
        fromRoute: previous,
        toRoute: fullRoute,
        durationMs: Date.now() - enteredAtRef.current,
      });
    }
    previousRef.current = fullRoute;
    enteredAtRef.current = Date.now();
  }, [pathname, searchParams]);
}
