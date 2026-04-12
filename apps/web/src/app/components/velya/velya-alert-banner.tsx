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
    ring: 'border-neutral-300',
    bg: 'bg-neutral-50',
    text: 'text-neutral-900',
    iconBg: 'bg-neutral-200 text-neutral-700',
  },
  warning: {
    icon: AlertTriangle,
    ring: 'border-neutral-300',
    bg: 'bg-neutral-50',
    text: 'text-neutral-900',
    iconBg: 'bg-neutral-200 text-neutral-700',
  },
  info: {
    icon: Info,
    ring: 'border-neutral-300',
    bg: 'bg-neutral-50',
    text: 'text-neutral-900',
    iconBg: 'bg-neutral-200 text-neutral-700',
  },
  success: {
    icon: CheckCircle2,
    ring: 'border-neutral-300',
    bg: 'bg-neutral-50',
    text: 'text-neutral-900',
    iconBg: 'bg-neutral-200 text-neutral-700',
  },
};

export interface VelyaAlertBannerProps {
  severity?: Severity;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function VelyaAlertBanner({
  severity = 'critical',
  title,
  description,
  action,
  className,
}: VelyaAlertBannerProps) {
  const cfg = SEVERITY_CONFIG[severity];
  const Icon = cfg.icon;

  return (
    <div
      role="alert"
      className={cn(
        'relative flex items-center gap-4 rounded-lg border px-5 py-4',
        cfg.ring,
        cfg.bg,
        className,
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          cfg.iconBg,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className={cn('text-sm font-semibold', cfg.text)}>{title}</div>
        {description && (
          <div className="mt-0.5 text-xs text-neutral-600">{description}</div>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
