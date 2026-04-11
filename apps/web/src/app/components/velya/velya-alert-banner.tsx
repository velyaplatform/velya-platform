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
    ring: 'border-red-500/35',
    bg: 'bg-gradient-to-r from-red-500/15 via-red-500/5 to-transparent',
    text: 'text-red-200',
    iconBg: 'bg-red-500/20 text-red-300',
  },
  warning: {
    icon: AlertTriangle,
    ring: 'border-amber-500/35',
    bg: 'bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent',
    text: 'text-amber-200',
    iconBg: 'bg-amber-500/20 text-amber-300',
  },
  info: {
    icon: Info,
    ring: 'border-blue-500/35',
    bg: 'bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-transparent',
    text: 'text-blue-200',
    iconBg: 'bg-blue-500/20 text-blue-300',
  },
  success: {
    icon: CheckCircle2,
    ring: 'border-emerald-500/35',
    bg: 'bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent',
    text: 'text-emerald-200',
    iconBg: 'bg-emerald-500/20 text-emerald-300',
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
        'relative flex items-center gap-4 rounded-2xl border px-5 py-4 backdrop-blur-xl',
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
          <div className="mt-0.5 text-xs text-slate-300/80">{description}</div>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
