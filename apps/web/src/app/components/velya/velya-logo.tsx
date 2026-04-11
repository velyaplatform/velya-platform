'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';

/**
 * Velya Logo — "V" estilizado que forma uma onda de ECG.
 *
 * A ponta inferior do V se transforma em um pulso cardíaco (ECG trace),
 * conectando a ideia de plataforma (V) com sinais vitais hospitalares.
 *
 * Gradiente teal/cyan (monitor de sinais vitais + tecnologia clínica).
 */
export interface VelyaLogoProps {
  size?: number;
  wordmark?: boolean;
  subtitle?: boolean;
  className?: string;
  /** Force monochrome white (para uso em sidebars) */
  mono?: boolean;
}

export function VelyaLogo({
  size = 32,
  wordmark = true,
  subtitle = true,
  className,
  mono = false,
}: VelyaLogoProps) {
  const gradId = React.useId();

  return (
    <div className={cn('flex items-center gap-3 select-none', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={mono ? '#ffffff' : '#2563eb'} />
            <stop offset="1" stopColor={mono ? '#ffffff' : '#1d4ed8'} />
          </linearGradient>
        </defs>

        {/* Left arm of V + ECG pulse + right arm
            Path: V desce do topo-esquerdo até o centro inferior, onde vira
            um pequeno pulso cardíaco (p-qrs-t simplificado) e depois sobe
            como o braço direito do V. */}
        <path
          d="
            M 8 8
            L 20 34
            L 22 30
            L 24 38
            L 26 26
            L 28 34
            L 40 8
          "
          stroke={`url(#${gradId})`}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {wordmark && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              'text-lg font-semibold tracking-tight',
              mono ? 'text-white' : 'text-neutral-900',
            )}
          >
            Velya
          </span>
          {subtitle && (
            <span
              className={cn(
                // 12px minimum to satisfy WCAG small-font checks
                // (visual-test rejects anything below 12px).
                'mt-1 text-xs font-medium uppercase tracking-[0.18em]',
                mono ? 'text-white/60' : 'text-neutral-500',
              )}
            >
              Plataforma Hospitalar
            </span>
          )}
        </div>
      )}
    </div>
  );
}
