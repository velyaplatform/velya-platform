'use client';

import * as React from 'react';
import { AlertTriangle, AlertOctagon, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

type Severity = 'critical' | 'warning' | 'info' | 'success';

const SEVERITY_CONFIG: Record<
  Severity,
  {
    icon: React.ComponentType<{ className?: string }>;
    ring: string;
    bg: string;
    text: string;
    iconBg: string;
  }
> = {
  critical: {
    icon: AlertOctagon,
    ring: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-900',
    iconBg: 'bg-red-100 text-red-600',
  },
  warning: {
    icon: AlertTriangle,
    ring: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    iconBg: 'bg-amber-100 text-amber-600',
  },
  info: {
    icon: Info,
    ring: 'border-sky-200',
    bg: 'bg-sky-50',
    text: 'text-sky-900',
    iconBg: 'bg-sky-100 text-sky-600',
  },
  success: {
    icon: CheckCircle2,
    ring: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-900',
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
};

export interface VelyaAlertBannerProps {
  severity?: Severity;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

export function VelyaAlertBanner({
  severity = 'critical',
  title,
  description,
  action,
  className,
  pulse = true,
}: VelyaAlertBannerProps) {
  const cfg = SEVERITY_CONFIG[severity];
  const Icon = cfg.icon;

  return (
    <div
      role="alert"
      className={cn(
        'relative flex items-center gap-4 rounded-xl border px-5 py-4 shadow-sm',
        cfg.ring,
        cfg.bg,
        className,
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          cfg.iconBg,
          pulse && severity === 'critical' && 'animate-pulse',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className={cn('text-sm font-semibold', cfg.text)}>{title}</div>
        {description && (
          <div className="mt-0.5 text-xs text-slate-600">{description}</div>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
