'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';

type StatusTone = 'critical' | 'warning' | 'success' | 'info' | 'accent' | 'neutral';

const COLOR: Record<StatusTone, string> = {
  critical: 'bg-red-600',
  warning: 'bg-amber-600',
  success: 'bg-green-600',
  info: 'bg-blue-600',
  accent: 'bg-blue-600',
  neutral: 'bg-neutral-400',
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
            'absolute inline-flex h-full w-full  rounded-full opacity-75',
            COLOR[tone],
          )}
        />
      )}
      <span className={cn('relative inline-flex h-full w-full rounded-full', COLOR[tone])} />
    </span>
  );
}
