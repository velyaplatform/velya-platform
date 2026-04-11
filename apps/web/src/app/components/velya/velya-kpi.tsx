'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Card } from '../ui/card';

/**
 * VelyaKPI — tile de KPI clínico estilo EHR: white bg + shadow-sm + borda colorida.
 */

type KPITone = 'neutral' | 'critical' | 'warning' | 'success' | 'info' | 'accent';

type KPITrend = 'up' | 'down' | 'flat';

export interface VelyaKPIProps {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  trend?: KPITrend;
  icon?: LucideIcon;
  tone?: KPITone;
  className?: string;
  footer?: React.ReactNode;
}

const TREND_COLORS: Record<KPITrend, string> = {
  up: 'text-red-600',
  down: 'text-emerald-600',
  flat: 'text-slate-500',
};

const TREND_ICONS: Record<KPITrend, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

const ICON_BG: Record<KPITone, string> = {
  neutral: 'text-slate-700',
  critical: 'text-red-800',
  warning: 'text-amber-800',
  success: 'text-emerald-800',
  info: 'text-blue-900',
  accent: 'text-blue-900',
};

export function VelyaKPI({
  label,
  value,
  sublabel,
  trend,
  icon: Icon,
  tone = 'neutral',
  className,
  footer,
}: VelyaKPIProps) {
  return (
    <Card variant="kpi" tone={tone} interactive className={cn('group relative p-5', className)}>
      {/* Decorative icon */}
      {Icon && (
        <Icon
          className={cn(
            'absolute right-4 top-4 h-12 w-12 transition-colors',
            ICON_BG[tone],
            'group-hover:text-blue-800',
          )}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      )}

      <div className="relative">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          {label}
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <div className="text-[2.5rem] font-bold leading-none tracking-tight tabular-nums text-slate-900">
            {value}
          </div>
          {trend && (
            <span className={cn('text-sm font-semibold', TREND_COLORS[trend])}>
              {TREND_ICONS[trend]}
            </span>
          )}
        </div>

        {sublabel && <div className="mt-2 text-xs text-slate-500">{sublabel}</div>}

        {footer && <div className="mt-3">{footer}</div>}
      </div>
    </Card>
  );
}
