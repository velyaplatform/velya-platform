'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';

/**
 * VelyaECGStrip — faixa horizontal estilo monitor de beira de leito
 * que desenha uma forma de onda QRS contínua com animação de scroll.
 *
 * Usado como "banner de vida" — reforça visualmente que a plataforma
 * é um sistema hospitalar em operação 24/7. Não depende de dados
 * reais: é só ornamento clínico.
 */

export interface VelyaECGStripProps {
  height?: number;
  className?: string;
  color?: string;
  speed?: 'slow' | 'normal' | 'fast';
  /** Altura do grid de fundo — pattern de monitor */
  showGrid?: boolean;
}

// Padrão P-Q-R-S-T repetido. Cada "batimento" ocupa ~120 unidades no X.
function generateEcgPath(width: number, height: number): string {
  const midY = height / 2;
  const peakY = height * 0.08; // topo do R
  const troughY = height * 0.92; // fundo do S/Q
  const pWaveY = midY - height * 0.12;
  const tWaveY = midY - height * 0.18;

  const beatWidth = 120;
  const beats = Math.ceil(width / beatWidth) + 1;

  let path = `M 0 ${midY}`;

  for (let i = 0; i < beats; i++) {
    const x0 = i * beatWidth;
    // linha baseline (isoelétrica)
    path += ` L ${x0 + 10} ${midY}`;
    // P-wave (pequena onda atrial)
    path += ` Q ${x0 + 18} ${pWaveY} ${x0 + 26} ${midY}`;
    path += ` L ${x0 + 40} ${midY}`;
    // Q deflection
    path += ` L ${x0 + 44} ${midY + 4}`;
    // R peak (spike dramático)
    path += ` L ${x0 + 50} ${peakY}`;
    // S deflection
    path += ` L ${x0 + 56} ${troughY}`;
    // back to baseline
    path += ` L ${x0 + 62} ${midY}`;
    // T-wave (onda de repolarização ventricular)
    path += ` L ${x0 + 78} ${midY}`;
    path += ` Q ${x0 + 92} ${tWaveY} ${x0 + 106} ${midY}`;
    path += ` L ${x0 + beatWidth} ${midY}`;
  }

  return path;
}

export function VelyaECGStrip({
  height = 56,
  className,
  color = '#2dd4bf',
  speed = 'normal',
  showGrid = true,
}: VelyaECGStripProps) {
  const width = 800;
  const path = React.useMemo(() => generateEcgPath(width, height), [height]);
  const duration = speed === 'slow' ? '6s' : speed === 'fast' ? '2.5s' : '4s';
  const gradId = React.useId();

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/[0.06] bg-[rgba(3,7,18,0.6)] backdrop-blur-md',
        className,
      )}
      style={{ height }}
    >
      {/* Monitor grid pattern — linhas finas verde/teal */}
      {showGrid && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `
              linear-gradient(to right, ${color} 1px, transparent 1px),
              linear-gradient(to bottom, ${color} 1px, transparent 1px)
            `,
            backgroundSize: '16px 16px',
          }}
        />
      )}

      {/* ECG trace */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${gradId}-fade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={color} stopOpacity="0" />
            <stop offset="0.15" stopColor={color} stopOpacity="0.8" />
            <stop offset="0.85" stopColor={color} stopOpacity="0.8" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id={`${gradId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Scrolling ECG — translate animado em loop */}
        <g className="ecg-scroll">
          <path
            d={path}
            fill="none"
            stroke={`url(#${gradId}-fade)`}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${gradId}-glow)`}
          />
          <path
            d={path}
            fill="none"
            stroke={`url(#${gradId}-fade)`}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${gradId}-glow)`}
            transform={`translate(${width}, 0)`}
          />
        </g>
      </svg>

      <style>{`
        .ecg-scroll {
          animation: ecg-scroll-x ${duration} linear infinite;
        }
        @keyframes ecg-scroll-x {
          from { transform: translateX(0); }
          to   { transform: translateX(-${width}px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ecg-scroll { animation: none; }
        }
      `}</style>
    </div>
  );
}
