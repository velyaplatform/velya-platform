'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { HeartPulse, TrendingUp, TrendingDown, Minus, Calculator } from 'lucide-react';
import { BEDS as ICU_BEDS, type IcuBed } from '../../lib/fixtures/icu';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { VelyaSectionHeader } from './velya/velya-section';

/**
 * NEWS2 Risk Panel — clinical decision support widget.
 * Mostra pacientes com NEWS2 ≥ 5 (SSC 2024 Hour-1 Bundle threshold).
 */
export function News2RiskPanel() {
  const highRiskBeds = useMemo(() => {
    return ICU_BEDS.filter(
      (bed): bed is IcuBed & { news2: number; patient: NonNullable<IcuBed['patient']> } =>
        bed.occupied && bed.patient != null && typeof bed.news2 === 'number' && bed.news2 >= 5,
    ).sort((a, b) => b.news2 - a.news2);
  }, []);

  return (
    <Card tone="critical" className="border-red-200">
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
          <p className="rounded-lg border border-slate-200 bg-slate-50 py-4 text-center text-sm text-slate-500">
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
                  ? 'text-red-600'
                  : trend === 'caindo'
                    ? 'text-emerald-600'
                    : 'text-slate-500';

              const scoreClass =
                score >= 7
                  ? 'bg-red-100 text-red-700 ring-2 ring-red-300'
                  : 'bg-amber-100 text-amber-700 ring-2 ring-amber-300';

              return (
                <li key={bed.id}>
                  <Link
                    href={`/patients/${bed.patient.mrn}`}
                    aria-live="polite"
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 transition-all hover:border-red-300 hover:bg-red-50/50 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <span
                      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-lg font-bold tabular-nums ${scoreClass}`}
                      aria-label={`NEWS2 ${score}`}
                    >
                      {score}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {bed.patient.name}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        <span className="font-mono text-blue-700">{bed.patient.mrn}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        {bed.patient.age}a
                        <span className="mx-1.5 text-slate-300">·</span>
                        {bed.id}
                        <span className="mx-1.5 text-slate-300">·</span>
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
