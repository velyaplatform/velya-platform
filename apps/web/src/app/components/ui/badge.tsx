'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

/**
 * Velya Badge — pill de status clínico em light theme (red-50/amber-50/...).
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-neutral-300 bg-neutral-100 text-neutral-800',
        critical: 'border-neutral-300 bg-neutral-100 text-neutral-800',
        warning: 'border-neutral-300 bg-neutral-100 text-neutral-800',
        success: 'border-neutral-300 bg-neutral-100 text-neutral-800',
        info: 'border-neutral-300 bg-neutral-100 text-neutral-800',
        accent: 'border-neutral-300 bg-neutral-100 text-neutral-800',
        purple: 'border-neutral-300 bg-neutral-100 text-neutral-800',
        outline: 'border-neutral-300 bg-white text-neutral-700',
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
  default: 'bg-neutral-500',
  critical: 'bg-neutral-500',
  warning: 'bg-neutral-500',
  success: 'bg-neutral-500',
  info: 'bg-neutral-500',
  accent: 'bg-neutral-500',
  purple: 'bg-neutral-500',
  outline: 'bg-neutral-500',
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
                'absolute inline-flex h-full w-full  rounded-full opacity-75',
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
