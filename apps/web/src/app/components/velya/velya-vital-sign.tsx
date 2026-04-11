'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';

/**
 * VelyaVitalSign — Card de sinal vital estilo monitor de beira de leito.
 *
 * Exibe: ícone + label + valor grande em font-mono + unidade + faixa.
 * Cor do valor varia com severidade (normal/warning/critical).
 */

type VitalSeverity = 'normal' | 'warning' | 'critical' | 'unknown';

export interface VelyaVitalSignProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon?: LucideIcon;
  severity?: VitalSeverity;
  range?: string;
  timestamp?: string;
  className?: string;
}

const SEVERITY_TEXT: Record<VitalSeverity, string> = {
  normal: 'text-emerald-300',
  warning: 'text-amber-300',
  critical: 'text-red-300',
  unknown: 'text-slate-400',
};

const SEVERITY_GLOW: Record<VitalSeverity, string> = {
  normal: 'drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]',
  warning: 'drop-shadow-[0_0_12px_rgba(251,191,36,0.35)]',
  critical: 'drop-shadow-[0_0_12px_rgba(248,113,113,0.45)]',
  unknown: '',
};

export function VelyaVitalSign({
  label,
  value,
  unit,
  icon: Icon,
  severity = 'normal',
  range,
  timestamp,
  className,
}: VelyaVitalSignProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.08] bg-[rgba(15,22,35,0.6)] p-4 backdrop-blur-md',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} aria-hidden="true" />}
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className={cn(
            'font-mono text-3xl font-bold leading-none tabular-nums',
            SEVERITY_TEXT[severity],
            SEVERITY_GLOW[severity],
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-slate-500">{unit}</span>
        )}
      </div>

      {(range || timestamp) && (
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
          {range && <span>{range}</span>}
          {timestamp && <span className="font-mono">{timestamp}</span>}
        </div>
      )}
    </div>
  );
}
