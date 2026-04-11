'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';

/**
 * VelyaPageHeader — header padrão de página em light theme.
 */
export interface VelyaPageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}

export function VelyaPageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  className,
}: VelyaPageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div>
        {eyebrow && (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
