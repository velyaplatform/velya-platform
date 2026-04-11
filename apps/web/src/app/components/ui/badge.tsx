'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

/**
 * Velya Badge — pill de status clínico em light theme (red-50/amber-50/...).
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-slate-200 bg-slate-100 text-slate-700',
        critical: 'border-red-200 bg-red-50 text-red-700',
        warning: 'border-amber-200 bg-amber-50 text-amber-800',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        info: 'border-blue-200 bg-blue-50 text-blue-700',
        accent: 'border-blue-200 bg-blue-50 text-blue-700',
        purple: 'border-violet-200 bg-violet-50 text-violet-700',
        outline: 'border-slate-300 bg-white text-slate-700',
      },
      size: {
        sm: 'text-[10px] px-2 py-px',
        default: 'text-xs px-2.5 py-0.5',
        lg: 'text-sm px-3 py-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  withDot?: boolean;
  pulse?: boolean;
}

const DOT_COLOR: Record<string, string> = {
  default: 'bg-slate-500',
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  success: 'bg-emerald-500',
  info: 'bg-blue-500',
  accent: 'bg-blue-600',
  purple: 'bg-violet-500',
  outline: 'bg-slate-500',
};

export function Badge({
  className,
  variant = 'default',
  size,
  withDot = false,
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {withDot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {pulse && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                DOT_COLOR[variant ?? 'default'],
              )}
            />
          )}
          <span
            className={cn(
              'relative inline-flex h-1.5 w-1.5 rounded-full',
              DOT_COLOR[variant ?? 'default'],
            )}
          />
        </span>
      )}
      {children}
    </span>
  );
}
