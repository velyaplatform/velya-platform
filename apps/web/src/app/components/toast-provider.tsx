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

/**
 * Global toast notification system. Provides a stacked queue of accessible
 * notifications. Mounted globally in layout.tsx so any component can call
 * useToast() to surface success/error/info/warning messages.
 *
 * Accessibility:
 *  - success/info/warning use role="status" + aria-live="polite"
 *  - error uses role="alert" + aria-live="assertive"
 *  - all toasts are aria-atomic="true"
 *  - close button has aria-label
 *  - touch targets are min-h-[44px]
 *  - colors pass WCAG AA on dark slate-900 background
 */

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms before auto-dismiss; 0 = sticky (manual dismiss only) */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, 'duration'>> {
  id: string;
  duration: number;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 5;
const DEFAULT_DURATION = 5000;
const ERROR_DURATION = 8000;

const VARIANT_STYLES: Record<
  ToastVariant,
  {
    container: string;
    icon: string;
    iconChar: string;
    role: 'status' | 'alert';
    ariaLive: 'polite' | 'assertive';
  }
> = {
  success: {
    container: 'bg-green-900/60 border-green-600 text-green-100',
    icon: 'text-green-300',
    iconChar: '\u2713',
    role: 'status',
    ariaLive: 'polite',
  },
  error: {
    container: 'bg-red-900/60 border-red-600 text-red-100',
    icon: 'text-red-300',
    iconChar: '\u26A0\uFE0F',
    role: 'alert',
    ariaLive: 'assertive',
  },
  info: {
    container: 'bg-blue-900/60 border-blue-600 text-blue-100',
    icon: 'text-blue-300',
    iconChar: '\u24D8',
    role: 'status',
    ariaLive: 'polite',
  },
  warning: {
    container: 'bg-amber-900/60 border-amber-600 text-amber-100',
    icon: 'text-amber-300',
    iconChar: '\u26A1',
    role: 'status',
    ariaLive: 'polite',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Keep timer ids in a ref so we can clear them on unmount or manual dismiss
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const variant = opts.variant ?? 'info';
      const duration =
        opts.duration ?? (variant === 'error' ? ERROR_DURATION : DEFAULT_DURATION);
      const item: ToastItem = {
        id,
        title: opts.title,
        description: opts.description ?? '',
        variant,
        duration,
      };
      setToasts((prev) => {
        const next = [item, ...prev];
        // Cap at MAX_VISIBLE — drop oldest
        return next.slice(0, MAX_VISIBLE);
      });
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  // Cleanup timers on unmount
  useEffect(() => {
    const map = timersRef.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ title, description, variant: 'success' }),
      error: (title, description) => toast({ title, description, variant: 'error' }),
      info: (title, description) => toast({ title, description, variant: 'info' }),
      warning: (title, description) => toast({ title, description, variant: 'warning' }),
      dismiss,
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        aria-label="Notificações"
        className="fixed top-20 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full sm:w-auto pointer-events-none"
      >
        {toasts.map((t) => {
          const style = VARIANT_STYLES[t.variant];
          return (
            <div
              key={t.id}
              role={style.role}
              aria-live={style.ariaLive}
              aria-atomic="true"
              className={`pointer-events-auto rounded-lg border-2 shadow-2xl p-4 flex items-start gap-3 animate-[slideIn_0.2s_ease-out] ${style.container}`}
            >
              <span aria-hidden="true" className={`text-xl shrink-0 ${style.icon}`}>
                {style.iconChar}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{t.title}</div>
                {t.description && (
                  <div className="text-xs mt-1 opacity-90">{t.description}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Fechar notificação"
                className="min-h-[44px] min-w-[44px] -mr-2 -my-2 inline-flex items-center justify-center rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                <span aria-hidden="true" className="text-lg">
                  ×
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast deve ser usado dentro de <ToastProvider>');
  }
  return ctx;
}
