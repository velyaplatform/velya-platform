'use client';

import { useCallback, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface EntityPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  href?: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const WIDTH_MAP = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
} as const;

export function EntityPanel({
  open,
  onClose,
  title,
  subtitle,
  href,
  children,
  width = 'md',
}: EntityPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20" />
        <Dialog.Content
          ref={panelRef}
          className={cn(
            'fixed right-0 top-[var(--header-height)] bottom-0 z-50 w-full overflow-y-auto',
            'border-l border-neutral-200 bg-white shadow-lg',
            WIDTH_MAP[width],
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>

          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-neutral-900">
                {title}
              </h2>
              {subtitle && (
                <p className="truncate text-xs text-neutral-500">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {href && (
                <a
                  href={href}
                  className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900"
                >
                  Abrir pagina
                </a>
              )}
              <Dialog.Close asChild>
                <button
                  className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label="Fechar painel"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
