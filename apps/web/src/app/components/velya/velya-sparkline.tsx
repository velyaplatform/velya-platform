'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';

/**
 * VelyaSparkline — mini gráfico de linha inline para tendências.
 *
 * Dependency-free: SVG puro. Usa gradiente teal quando positivo,
 * gradiente red quando em alerta.
 */
export interface VelyaSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  tone?: 'accent' | 'warning' | 'critical' | 'success';
  showArea?: boolean;
  className?: string;
}

const TONE_STROKE: Record<NonNullable<VelyaSparklineProps['tone']>, string> = {
  accent: '#737373',
  warning: '#737373',
  critical: '#737373',
  success: '#737373',
};

const TONE_AREA: Record<NonNullable<VelyaSparklineProps['tone']>, string> = {
  accent: 'rgba(115, 115, 115, 0.12)',
  warning: 'rgba(115, 115, 115, 0.12)',
  critical: 'rgba(115, 115, 115, 0.12)',
  success: 'rgba(115, 115, 115, 0.12)',
};

export function VelyaSparkline({
  data,
  width = 120,
  height = 36,
  tone = 'accent',
  showArea = true,
  className,
}: VelyaSparklineProps) {
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / Math.max(data.length - 1, 1);

  const toY = (v: number) =>
    height - ((v - min) / range) * (height - 4) - 2;

  const pathLine = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${toY(v)}`)
    .join(' ');

  const pathArea = `${pathLine} L ${width} ${height} L 0 ${height} Z`;

  const stroke = TONE_STROKE[tone];
  const area = TONE_AREA[tone];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      aria-hidden="true"
    >
      {showArea && <path d={pathArea} fill={area} />}
      <path
        d={pathLine}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      <circle
        cx={(data.length - 1) * stepX}
        cy={toY(data[data.length - 1])}
        r="2.5"
        fill={stroke}
      />
    </svg>
  );
}
