'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';

interface EntityPanelTriggerProps {
  panel: (props: { open: boolean; onClose: () => void }) => ReactNode;
  children: ReactNode;
  className?: string;
}

export function EntityPanelTrigger({
  panel,
  children,
  className,
}: EntityPanelTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'text-left text-neutral-900 underline decoration-neutral-300 underline-offset-2',
          'hover:decoration-neutral-500 cursor-pointer',
          className,
        )}
      >
        {children}
      </button>
      {panel({ open, onClose: () => setOpen(false) })}
    </>
  );
}
