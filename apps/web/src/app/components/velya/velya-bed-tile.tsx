'use client';

import * as React from 'react';
import { BedDouble, Sparkles, Wrench, Lock, UserCheck } from 'lucide-react';
import { cn } from '../../../lib/utils';

/**
 * VelyaBedTile — tile visual de leito para mapa/planta baixa.
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
  { label: string; ring: string; bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  occupied: {
    label: 'Ocupado',
    ring: 'border-red-500/40',
    bg: 'bg-red-500/12',
    text: 'text-red-300',
    icon: BedDouble,
  },
  available: {
    label: 'Disponível',
    ring: 'border-emerald-500/40',
    bg: 'bg-emerald-500/12',
    text: 'text-emerald-300',
    icon: BedDouble,
  },
  cleaning: {
    label: 'Higienização',
    ring: 'border-amber-500/40',
    bg: 'bg-amber-500/12',
    text: 'text-amber-300',
    icon: Sparkles,
  },
  reserved: {
    label: 'Reservado',
    ring: 'border-blue-500/40',
    bg: 'bg-blue-500/12',
    text: 'text-blue-300',
    icon: UserCheck,
  },
  maintenance: {
    label: 'Manutenção',
    ring: 'border-orange-500/40',
    bg: 'bg-orange-500/12',
    text: 'text-orange-300',
    icon: Wrench,
  },
  blocked: {
    label: 'Bloqueado',
    ring: 'border-slate-500/50',
    bg: 'bg-slate-500/15',
    text: 'text-slate-300',
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

export function VelyaBedTile({ bedNumber, status, patient, ward, onClick, className }: VelyaBedTileProps) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  const Wrapper: React.ElementType = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left backdrop-blur-md transition-all',
        cfg.ring,
        cfg.bg,
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg',
        className,
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-mono text-lg font-bold text-slate-100 tabular-nums">
          {bedNumber}
        </span>
        <Icon className={cn('h-4 w-4', cfg.text)} />
      </div>

      <div className={cn('text-[10px] font-semibold uppercase tracking-wider', cfg.text)}>
        {cfg.label}
      </div>

      {patient && (
        <div className="min-w-0 truncate text-xs text-slate-300">{patient}</div>
      )}
      {ward && (
        <div className="text-[10px] text-slate-500">{ward}</div>
      )}
    </Wrapper>
  );
}
