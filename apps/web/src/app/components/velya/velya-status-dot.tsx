'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';

type StatusTone = 'critical' | 'warning' | 'success' | 'info' | 'accent' | 'neutral';

const COLOR: Record<StatusTone, string> = {
  critical: 'bg-red-400',
  warning: 'bg-amber-400',
  success: 'bg-emerald-400',
  info: 'bg-blue-400',
  accent: 'bg-teal-300',
  neutral: 'bg-slate-400',
};

const GLOW: Record<StatusTone, string> = {
  critical: 'shadow-[0_0_10px_rgba(248,113,113,0.55)]',
  warning: 'shadow-[0_0_10px_rgba(251,191,36,0.45)]',
  success: 'shadow-[0_0_10px_rgba(52,211,153,0.45)]',
  info: 'shadow-[0_0_10px_rgba(96,165,250,0.45)]',
  accent: 'shadow-[0_0_10px_rgba(45,212,191,0.5)]',
  neutral: '',
};

export interface VelyaStatusDotProps {
  tone?: StatusTone;
  pulse?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function VelyaStatusDot({
  tone = 'accent',
  pulse = false,
  size = 'default',
  className,
}: VelyaStatusDotProps) {
  const sizeClass = size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-3 w-3' : 'h-2 w-2';
  return (
    <span className={cn('relative inline-flex', sizeClass, className)}>
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            COLOR[tone],
          )}
        />
      )}
      <span
        className={cn('relative inline-flex h-full w-full rounded-full', COLOR[tone], GLOW[tone])}
      />
    </span>
  );
}
