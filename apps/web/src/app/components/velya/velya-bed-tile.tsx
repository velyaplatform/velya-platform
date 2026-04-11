'use client';

import * as React from 'react';
import { BedDouble, Sparkles, Wrench, Lock, UserCheck } from 'lucide-react';
import { cn } from '../../../lib/utils';

/**
 * VelyaBedTile — tile visual de leito (light theme).
 */
export type BedStatus =
  | 'occupied'
  | 'available'
  | 'cleaning'
  | 'reserved'
  | 'maintenance'
  | 'blocked';

const STATUS_CONFIG: Record<
  BedStatus,
  {
    label: string;
    ring: string;
    bg: string;
    text: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  occupied: {
    label: 'Ocupado',
    ring: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-700',
    icon: BedDouble,
  },
  available: {
    label: 'Disponível',
    ring: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    icon: BedDouble,
  },
  cleaning: {
    label: 'Higienização',
    ring: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    icon: Sparkles,
  },
  reserved: {
    label: 'Reservado',
    ring: 'border-blue-200',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    icon: UserCheck,
  },
  maintenance: {
    label: 'Manutenção',
    ring: 'border-orange-200',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    icon: Wrench,
  },
  blocked: {
    label: 'Bloqueado',
    ring: 'border-slate-300',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    icon: Lock,
  },
};

export interface VelyaBedTileProps {
  bedNumber: string;
  status: BedStatus;
  patient?: string;
  ward?: string;
  onClick?: () => void;
  className?: string;
}

export function VelyaBedTile({
  bedNumber,
  status,
  patient,
  ward,
  onClick,
  className,
}: VelyaBedTileProps) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  const Wrapper: React.ElementType = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all',
        cfg.ring,
        cfg.bg,
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
          {bedNumber}
        </span>
        <Icon className={cn('h-4 w-4', cfg.text)} />
      </div>

      <div className={cn('text-[10px] font-semibold uppercase tracking-wider', cfg.text)}>
        {cfg.label}
      </div>

      {patient && <div className="min-w-0 truncate text-xs text-slate-700">{patient}</div>}
      {ward && <div className="text-[10px] text-slate-500">{ward}</div>}
    </Wrapper>
  );
}
