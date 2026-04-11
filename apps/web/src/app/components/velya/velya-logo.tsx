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
            {mono ? (
              <>
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="1" stopColor="#ffffff" />
              </>
            ) : (
              <>
                <stop offset="0" stopColor="#5eead4" />
                <stop offset="0.5" stopColor="#2dd4bf" />
                <stop offset="1" stopColor="#14b8a6" />
              </>
            )}
          </linearGradient>
          <filter id={`${gradId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Soft halo */}
        {!mono && (
          <circle cx="24" cy="24" r="22" fill={`url(#${gradId})`} opacity="0.08" />
        )}

        {/* Ghost medical cross atrás — identidade hospitalar sutil */}
        {!mono && (
          <path
            d="M 20 10 H 28 V 20 H 38 V 28 H 28 V 38 H 20 V 28 H 10 V 20 H 20 Z"
            fill={`url(#${gradId})`}
            opacity="0.06"
          />
        )}

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
          filter={mono ? undefined : `url(#${gradId}-glow)`}
        />
      </svg>

      {wordmark && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              'text-lg font-semibold tracking-[0.01em]',
              mono ? 'text-white' : 'bg-gradient-to-br from-teal-200 via-teal-300 to-teal-500 bg-clip-text text-transparent',
            )}
          >
            Velya
          </span>
          {subtitle && (
            <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Plataforma Hospitalar
            </span>
          )}
        </div>
      )}
    </div>
  );
}
