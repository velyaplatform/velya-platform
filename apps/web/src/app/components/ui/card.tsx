'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';

/**
 * Velya Card — primitive de card estilo EHR (Epic/Athenahealth-like):
 * fundo branco, sombra sutil, borda slate-200.
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
  info: 'border-l-4 border-l-sky-500',
  accent: 'border-l-4 border-l-sky-600',
};

export const Card = React.forwardRef<HTMLDivElement, VelyaCardProps>(function Card(
  { className, variant = 'default', tone = 'neutral', interactive = false, ...props },
  ref,
) {
  const base = 'relative rounded-2xl border';
  const surfaces: Record<CardVariant, string> = {
    default:
      'bg-white border-slate-200 shadow-[0_1px_3px_0_rgba(15,23,42,0.04),0_1px_2px_0_rgba(15,23,42,0.06)]',
    elevated:
      'bg-white border-slate-200 shadow-[0_4px_6px_-2px_rgba(15,23,42,0.06),0_12px_20px_-4px_rgba(15,23,42,0.08)]',
    flat: 'bg-slate-50 border-slate-200 shadow-none',
    alert:
      'bg-gradient-to-br from-red-50 via-white to-white border-red-200',
    kpi:
      'bg-white border-slate-200 shadow-[0_1px_3px_0_rgba(15,23,42,0.04),0_1px_2px_0_rgba(15,23,42,0.06)] overflow-hidden',
  };

  return (
    <div
      ref={ref}
      className={cn(
        base,
        surfaces[variant],
        TONE_BORDER_LEFT[tone],
        interactive &&
          'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_6px_-1px_rgba(15,23,42,0.08),0_10px_15px_-3px_rgba(15,23,42,0.1)]',
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
        'text-sm font-semibold tracking-tight text-slate-900',
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
  return <p ref={ref} className={cn('text-sm text-slate-500', className)} {...props} />;
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
