'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';

/**
 * VelyaSection — título de seção com ícone + ação opcional.
 * Usado dentro de cards e páginas como separador visual.
 */
export interface VelyaSectionHeaderProps {
  title: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}

export function VelyaSectionHeader({
  title,
  icon: Icon,
  action,
  subtitle,
  className,
}: VelyaSectionHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 ring-1 ring-teal-400/25">
            <Icon className="h-3.5 w-3.5 text-teal-300" strokeWidth={2.25} />
          </span>
        )}
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">
            {title}
          </div>
          {subtitle && (
            <div className="text-[11px] text-slate-500">{subtitle}</div>
          )}
        </div>
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
