'use client';

import * as React from 'react';
import { Stethoscope, Clock } from 'lucide-react';
import { cn } from '../../../lib/utils';

/**
 * VelyaShiftIndicator — pill mostrando "Plantão ativo: Dr. X até HH:MM"
 * que reforça que a plataforma é um sistema hospitalar em operação real.
 */
export interface VelyaShiftIndicatorProps {
  doctor?: string;
  endTime?: string;
  shift?: 'manhã' | 'tarde' | 'noite' | 'madrugada';
  className?: string;
}

function currentShift(): 'manhã' | 'tarde' | 'noite' | 'madrugada' {
  const h = new Date().getHours();
  if (h >= 7 && h < 13) return 'manhã';
  if (h >= 13 && h < 19) return 'tarde';
  if (h >= 19 && h < 1) return 'noite';
  return 'madrugada';
}

export function VelyaShiftIndicator({
  doctor = 'Dr. Chen',
  endTime = '19:00',
  shift,
  className,
}: VelyaShiftIndicatorProps) {
  const [active, setActive] = React.useState<string>(shift ?? currentShift());

  React.useEffect(() => {
    if (shift) return;
    const tick = () => setActive(currentShift());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [shift]);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium',
        className,
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <Stethoscope className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.25} />
      <span className="text-emerald-800">
        Plantão {active} · <span className="font-semibold">{doctor}</span>
      </span>
      <span className="flex items-center gap-1 text-emerald-600/80">
        <Clock className="h-3 w-3" /> até {endTime}
      </span>
    </div>
  );
}
