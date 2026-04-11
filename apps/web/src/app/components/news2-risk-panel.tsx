'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { HeartPulse, TrendingUp, TrendingDown, Minus, Calculator } from 'lucide-react';
import { BEDS as ICU_BEDS, type IcuBed } from '../../lib/fixtures/icu';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { VelyaSectionHeader } from './velya/velya-section';

/**
 * NEWS2 Risk Panel — clinical decision support widget for the home dashboard.
 *
 * Shows every ICU patient with NEWS2 ≥ 5 (Surviving Sepsis Campaign 2024
 * threshold for triggering the Hour-1 Bundle), sorted by score descending.
 */
export function News2RiskPanel() {
  const highRiskBeds = useMemo(() => {
    return ICU_BEDS.filter(
      (bed): bed is IcuBed & { news2: number; patient: NonNullable<IcuBed['patient']> } =>
        bed.occupied && bed.patient != null && typeof bed.news2 === 'number' && bed.news2 >= 5,
    ).sort((a, b) => b.news2 - a.news2);
  }, []);

  return (
    <Card tone="critical" className="border-red-500/30">
      <CardHeader>
        <VelyaSectionHeader
          title="NEWS2 — Alerta clínico"
          icon={HeartPulse}
          subtitle="Pacientes com NEWS2 ≥ 5 · Protocolo Sepsis Hour-1 (SSC 2024)"
          action={
            <Button asChild variant="destructive" size="xs">
              <Link href="/tools/sepsis">
                <Calculator className="h-3 w-3" /> Calcular NEWS2
              </Link>
            </Button>
          }
        />
      </CardHeader>

      <CardContent>
        {highRiskBeds.length === 0 ? (
          <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] py-4 text-center text-sm text-slate-400">
            Nenhum paciente com NEWS2 ≥ 5 no momento.
          </p>
        ) : (
          <ul className="flex flex-col gap-2" role="region" aria-label="Pacientes em alerta NEWS2">
            {highRiskBeds.map((bed) => {
              const score = bed.news2;
              const trend = bed.news2Trend;

              const TrendIcon =
                trend === 'subindo' ? TrendingUp : trend === 'caindo' ? TrendingDown : Minus;
              const trendColor =
                trend === 'subindo'
                  ? 'text-red-400'
                  : trend === 'caindo'
                    ? 'text-emerald-400'
                    : 'text-slate-400';

              const scoreClass =
                score >= 7
                  ? 'bg-red-500/15 text-red-300 ring-2 ring-red-500/50 shadow-[0_0_16px_-2px_rgba(239,68,68,0.35)]'
                  : 'bg-amber-500/15 text-amber-300 ring-2 ring-amber-500/50';

              return (
                <li key={bed.id}>
                  <Link
                    href={`/patients/${bed.patient.mrn}`}
                    aria-live="polite"
                    className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 transition-all hover:border-red-500/30 hover:bg-red-500/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    <span
                      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-lg font-bold tabular-nums ${scoreClass}`}
                      aria-label={`NEWS2 ${score}`}
                    >
                      {score}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-100">
                        {bed.patient.name}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
                        <span className="font-mono text-teal-300">{bed.patient.mrn}</span>
                        <span className="mx-1.5 text-slate-600">·</span>
                        {bed.patient.age}a
                        <span className="mx-1.5 text-slate-600">·</span>
                        {bed.id}
                        <span className="mx-1.5 text-slate-600">·</span>
                        {bed.patient.diagnosis}
                      </div>
                    </div>
                    <TrendIcon
                      className={`h-4 w-4 shrink-0 ${trendColor}`}
                      aria-label={`Tendência ${trend ?? 'desconhecida'}`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {highRiskBeds.length > 0 && (
          <p className="mt-3 text-center text-[11px] text-slate-500">
            {highRiskBeds.length} paciente(s) ·{' '}
            {highRiskBeds.filter((b) => b.news2 >= 7).length} em alto risco (NEWS2 ≥ 7)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
