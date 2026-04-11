'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Card } from '../ui/card';

/**
 * VelyaKPI — Bento tile para KPIs clínicos e operacionais.
 *
 * Exibe: label uppercase + número grande + sublabel/tendência + ícone
 * decorativo no canto. Acento de cor na borda esquerda conforme tom.
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
  up: 'text-emerald-400',
  down: 'text-red-400',
  flat: 'text-slate-400',
};

const TREND_ICONS: Record<KPITrend, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
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
      {/* Decorative icon — fundo */}
      {Icon && (
        <Icon
          className="absolute right-4 top-4 h-12 w-12 text-white/[0.06] transition-colors group-hover:text-teal-400/20"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      )}

      <div className="relative">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <div className="text-[2.5rem] font-bold leading-none text-slate-50 tracking-tight tabular-nums">
            {value}
          </div>
          {trend && (
            <span className={cn('text-sm font-semibold', TREND_COLORS[trend])}>
              {TREND_ICONS[trend]}
            </span>
          )}
        </div>

        {sublabel && (
          <div className="mt-2 text-xs text-slate-400">{sublabel}</div>
        )}

        {footer && <div className="mt-3">{footer}</div>}
      </div>
    </Card>
  );
}
