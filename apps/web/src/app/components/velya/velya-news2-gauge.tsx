'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';

/**
 * VelyaNEWS2Gauge — indicador circular do score NEWS2 com cor gradiente.
 *
 * 0-4:   baixo (verde)
 * 5-6:   médio (amarelo)
 * 7+:    alto (vermelho)
 */
export interface VelyaNEWS2GaugeProps {
  score: number;
  max?: number;
  size?: number;
  label?: string;
  className?: string;
}

function getRiskLevel(score: number): { color: string; label: string; hex: string } {
  if (score >= 7) return { color: 'text-red-400', label: 'Alto', hex: '#ef4444' };
  if (score >= 5) return { color: 'text-amber-400', label: 'Médio', hex: '#f59e0b' };
  if (score >= 1) return { color: 'text-teal-700', label: 'Baixo', hex: '#14b8a6' };
  return { color: 'text-emerald-400', label: 'Normal', hex: '#22c55e' };
}

export function VelyaNEWS2Gauge({
  score,
  max = 20,
  size = 96,
  label = 'NEWS2',
  className,
}: VelyaNEWS2GaugeProps) {
  const risk = getRiskLevel(score);
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / max, 1);
  const dashOffset = circumference * (1 - pct);

  return (
    <div
      className={cn('relative inline-flex flex-col items-center', className)}
      style={{ width: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(148,163,184,0.12)"
          strokeWidth="6"
          fill="none"
        />
        {/* Filled arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={risk.hex}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset 0.6s ease',
            filter: `drop-shadow(0 0 6px ${risk.hex}66)`,
          }}
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-mono text-2xl font-bold tabular-nums', risk.color)}>
          {score}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>

      <span className={cn('mt-1 text-[10px] font-semibold uppercase', risk.color)}>
        {risk.label}
      </span>
    </div>
  );
}
