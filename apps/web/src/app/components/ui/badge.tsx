'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

/**
 * Velya Badge — status clínicos (crítico, em risco, ok) com dot opcional.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        default:
          'border-white/10 bg-white/[0.06] text-slate-200',
        critical:
          'border-red-500/35 bg-red-500/12 text-red-300 shadow-[0_0_12px_-2px_rgba(239,68,68,0.25)]',
        warning:
          'border-amber-500/35 bg-amber-500/12 text-amber-300',
        success:
          'border-emerald-500/35 bg-emerald-500/12 text-emerald-300',
        info:
          'border-blue-500/35 bg-blue-500/12 text-blue-300',
        accent:
          'border-teal-400/35 bg-teal-400/12 text-teal-300',
        purple:
          'border-purple-500/35 bg-purple-500/12 text-purple-300',
        outline: 'border-white/15 text-slate-200',
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
  default: 'bg-slate-400',
  critical: 'bg-red-400',
  warning: 'bg-amber-400',
  success: 'bg-emerald-400',
  info: 'bg-blue-400',
  accent: 'bg-teal-300',
  purple: 'bg-purple-400',
  outline: 'bg-slate-400',
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
