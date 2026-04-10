'use client';

import { Suspense } from 'react';
import { useNavClickTelemetry } from './use-nav-telemetry';

/**
 * Mount-only component that fires nav.click events on route changes.
 * Wrapped in <Suspense> because useSearchParams (used internally) requires it.
 */
function Inner() {
  useNavClickTelemetry();
  return null;
}

export function NavTelemetryMount() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
