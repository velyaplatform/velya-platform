'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';

/**
 * Velya Glass Card — primitive reutilizável com variantes.
 *
 * Inspirado em shadcn/ui mas adaptado para o dark glassmorphism médico
 * do Velya: backdrop-blur, borda sutil de slate, shadow-glass.
 */

type CardVariant = 'default' | 'elevated' | 'flat' | 'alert' | 'kpi';
type CardTone = 'neutral' | 'critical' | 'warning' | 'success' | 'info' | 'accent';

export interface VelyaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  tone?: CardTone;
  interactive?: boolean;
}

const TONE_BORDER_LEFT: Record<CardTone, string> = {
  neutral: '',
  critical: 'border-l-4 border-l-red-500',
  warning: 'border-l-4 border-l-amber-500',
  success: 'border-l-4 border-l-emerald-500',
  info: 'border-l-4 border-l-blue-500',
  accent: 'border-l-4 border-l-teal-400',
};

const TONE_GLOW: Record<CardTone, string> = {
  neutral: '',
  critical: 'shadow-[0_0_24px_-4px_rgba(239,68,68,0.25)]',
  warning: 'shadow-[0_0_24px_-4px_rgba(245,158,11,0.22)]',
  success: '',
  info: '',
  accent: 'shadow-[0_0_24px_-4px_rgba(20,184,166,0.25)]',
};

export const Card = React.forwardRef<HTMLDivElement, VelyaCardProps>(function Card(
  { className, variant = 'default', tone = 'neutral', interactive = false, ...props },
  ref,
) {
  const base =
    'relative rounded-2xl border backdrop-blur-xl backdrop-saturate-150';
  const surfaces: Record<CardVariant, string> = {
    default:
      'bg-[rgba(15,22,35,0.72)] border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.48),inset_0_1px_0_0_rgba(255,255,255,0.04)]',
    elevated:
      'bg-[rgba(20,29,47,0.85)] border-white/[0.1] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)]',
    flat:
      'bg-[rgba(15,22,35,0.5)] border-white/[0.06] shadow-none',
    alert:
      'bg-gradient-to-br from-red-500/10 via-[rgba(15,22,35,0.72)] to-[rgba(15,22,35,0.72)] border-red-500/30',
    kpi:
      'bg-[rgba(15,22,35,0.72)] border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.48)] overflow-hidden',
  };

  return (
    <div
      ref={ref}
      className={cn(
        base,
        surfaces[variant],
        TONE_BORDER_LEFT[tone],
        TONE_GLOW[tone],
        interactive &&
          'transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6),0_0_24px_-4px_rgba(20,184,166,0.25)]',
        className,
      )}
      {...props}
    />
  );
});

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex items-start justify-between gap-3 px-5 pt-5 pb-3', className)}
        {...props}
      />
    );
  },
);

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function CardTitle({ className, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn(
        'text-xs font-semibold uppercase tracking-[0.1em] text-slate-400',
        className,
      )}
      {...props}
    />
  );
});

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn('text-sm text-slate-400', className)} {...props} />;
});

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('px-5 pb-5', className)} {...props} />;
  },
);

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-2 px-5 pb-5 pt-0', className)}
        {...props}
      />
    );
  },
);
