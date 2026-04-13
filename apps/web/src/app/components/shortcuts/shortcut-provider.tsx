'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SHORTCUTS, type ShortcutDef } from '../../../lib/shortcuts-config';

interface ShortcutContextValue {
  showOverlay: boolean;
  setShowOverlay: (v: boolean) => void;
  currentScope: string;
}

const ShortcutContext = createContext<ShortcutContextValue>({
  showOverlay: false,
  setShowOverlay: () => {},
  currentScope: 'global',
});

export function useShortcuts() {
  return useContext(ShortcutContext);
}

function scopeFromPathname(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (!segment) return 'global';
  if (segment === 'pacientes') return 'patients';
  return segment;
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

const SEQUENCE_TIMEOUT_MS = 500;

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const [showOverlay, setShowOverlay] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const currentScope = useMemo(() => scopeFromPathname(pathname), [pathname]);
  const pendingKeyRef = useRef<string | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    pendingKeyRef.current = null;
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }, []);

  const executeShortcut = useCallback(
    (def: ShortcutDef) => {
      switch (def.action) {
        case 'navigate':
          if (def.target) router.push(def.target);
          break;
        case 'toggle':
          if (def.target === 'shortcuts-overlay') {
            setShowOverlay((prev) => !prev);
          }
          break;
        case 'command':
          if (def.target === 'close-overlay') {
            setShowOverlay(false);
          } else if (def.target === 'command-palette') {
            // Dispatch a custom event that the command palette can listen to
            window.dispatchEvent(new CustomEvent('velya:command-palette'));
          } else {
            // Dispatch a scoped command event for module-level handlers
            window.dispatchEvent(
              new CustomEvent('velya:shortcut-command', {
                detail: { command: def.target, scope: def.scope },
              }),
            );
          }
          break;
      }
    },
    [router],
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Never intercept when the user is typing in a form element
      if (isEditableTarget(e.target)) return;

      const key = e.key;
      const hasModifier = e.ctrlKey || e.metaKey;

      // Handle ctrl+k / cmd+k
      if (hasModifier && key === 'k') {
        e.preventDefault();
        const def = SHORTCUTS.find(
          (s) => s.key === 'ctrl+k' && s.scope === 'global',
        );
        if (def) executeShortcut(def);
        clearPending();
        return;
      }

      // Handle Escape
      if (key === 'Escape') {
        const def = SHORTCUTS.find(
          (s) => s.key === 'Escape' && s.scope === 'global',
        );
        if (def) executeShortcut(def);
        clearPending();
        return;
      }

      // Don't process single-key shortcuts when a modifier is held
      if (hasModifier || e.altKey) return;

      // Check for two-key sequence continuation
      if (pendingKeyRef.current) {
        const sequence = `${pendingKeyRef.current} ${key}`;
        clearPending();

        const def = SHORTCUTS.find(
          (s) =>
            s.key === sequence &&
            (s.scope === 'global' || s.scope === currentScope),
        );
        if (def) {
          e.preventDefault();
          executeShortcut(def);
        }
        return;
      }

      // Check if this key starts a two-key sequence
      const isSequenceStart = SHORTCUTS.some((s) => {
        const parts = s.key.split(' ');
        return parts.length === 2 && parts[0] === key;
      });

      if (isSequenceStart) {
        pendingKeyRef.current = key;
        pendingTimerRef.current = setTimeout(() => {
          pendingKeyRef.current = null;
        }, SEQUENCE_TIMEOUT_MS);
        return;
      }

      // Single-key shortcuts (scoped first, then global)
      const def =
        SHORTCUTS.find(
          (s) =>
            s.key === key && s.scope === currentScope && !s.requiresModifier,
        ) ||
        SHORTCUTS.find(
          (s) =>
            s.key === key && s.scope === 'global' && !s.requiresModifier,
        );

      if (def) {
        e.preventDefault();
        executeShortcut(def);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearPending();
    };
  }, [currentScope, executeShortcut, clearPending]);

  const value = useMemo(
    () => ({ showOverlay, setShowOverlay, currentScope }),
    [showOverlay, currentScope],
  );

  return (
    <ShortcutContext.Provider value={value}>{children}</ShortcutContext.Provider>
  );
}
