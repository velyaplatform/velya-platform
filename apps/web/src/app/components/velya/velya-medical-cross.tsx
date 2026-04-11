'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';

/**
 * VelyaMedicalCross — cruz médica estilizada em SVG com gradiente teal.
 * Usada como marca-d'água hospitalar, selo de acreditação e ornamento
 * clínico em páginas auth/dashboard.
 */

export interface VelyaMedicalCrossProps {
  size?: number;
  className?: string;
  /** variant "outline" desenha a cruz vazada; "solid" preenche */
  variant?: 'outline' | 'solid' | 'glass';
  /** Gradiente teal vs tint vermelho (emergência) */
  tone?: 'accent' | 'critical';
}

export function VelyaMedicalCross({
  size = 28,
  className,
  variant = 'outline',
  tone = 'accent',
}: VelyaMedicalCrossProps) {
  const gradId = React.useId();

  const colors =
    tone === 'critical'
      ? { start: '#f87171', mid: '#ef4444', end: '#dc2626' }
      : { start: '#38bdf8', mid: '#0ea5e9', end: '#0284c7' };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={colors.start} />
          <stop offset="0.5" stopColor={colors.mid} />
          <stop offset="1" stopColor={colors.end} />
        </linearGradient>
        <filter id={`${gradId}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {variant === 'glass' && (
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="8"
          fill={`url(#${gradId})`}
          opacity="0.08"
        />
      )}

      {/* Cross shape — braço horizontal + braço vertical */}
      {variant === 'solid' ? (
        <path
          d="M 12 4 H 20 V 12 H 28 V 20 H 20 V 28 H 12 V 20 H 4 V 12 H 12 Z"
          fill={`url(#${gradId})`}
          filter={`url(#${gradId}-glow)`}
        />
      ) : (
        <path
          d="M 12 4 H 20 V 12 H 28 V 20 H 20 V 28 H 12 V 20 H 4 V 12 H 12 Z"
          stroke={`url(#${gradId})`}
          strokeWidth="2"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </svg>
  );
}
