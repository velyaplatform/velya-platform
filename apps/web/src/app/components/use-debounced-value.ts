'use client';

import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that updates only after `delayMs`
 * of inactivity. Used by the autocomplete components to avoid running
 * filter logic on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 80): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
