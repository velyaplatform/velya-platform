'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { BEDS as ICU_BEDS, type IcuBed } from '../../lib/fixtures/icu';

/**
 * NEWS2 Risk Panel — clinical decision support widget for the home dashboard.
 *
 * Shows every ICU patient with NEWS2 ≥ 5 (Surviving Sepsis Campaign 2024
 * threshold for triggering the Hour-1 Bundle), sorted by score descending.
 * Each row links to the patient's chart and to the standalone NEWS2
 * calculator at /tools/sepsis.
 *
 * The container has role="region" + aria-labelledby so screen readers
 * announce "NEWS2 risk panel — N pacientes em alerta". Each high-risk
 * row has aria-live="polite" so updates are announced without stealing
 * focus from clinicians.
 */
export function News2RiskPanel() {
  const highRiskBeds = useMemo(() => {
    return ICU_BEDS.filter(
      (bed): bed is IcuBed & { news2: number; patient: NonNullable<IcuBed['patient']> } =>
        bed.occupied && bed.patient != null && typeof bed.news2 === 'number' && bed.news2 >= 5,
    ).sort((a, b) => b.news2 - a.news2);
  }, []);

  return (
    <section
      role="region"
      aria-labelledby="news2-risk-title"
      className="bg-slate-900 border border-red-700/60 rounded-xl p-5 shadow-lg"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2
            id="news2-risk-title"
            className="text-base font-bold text-red-100 flex items-center gap-2"
          >
            <span aria-hidden="true">{'\u26A0\uFE0F'}</span> NEWS2 — Alerta clínico
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Pacientes com NEWS2 ≥ 5 — protocolo Sepsis Hour-1 Bundle (SSC 2024)
          </p>
        </div>
        <Link
          href="/tools/sepsis"
          className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-md bg-red-700 hover:bg-red-800 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-300 whitespace-nowrap"
        >
          Calcular NEWS2
        </Link>
      </header>

      {highRiskBeds.length === 0 ? (
        <p className="text-sm text-slate-300 text-center py-4 bg-slate-800 rounded-md border border-slate-700">
          Nenhum paciente com NEWS2 ≥ 5 no momento.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {highRiskBeds.map((bed) => {
            const score = bed.news2;
            const trend = bed.news2Trend;
            const arrow = trend === 'subindo' ? '↑' : trend === 'caindo' ? '↓' : '→';
            const trendColor =
              trend === 'subindo'
                ? 'text-red-300'
                : trend === 'caindo'
                  ? 'text-green-300'
                  : 'text-slate-300';

            const badgeClass =
              score >= 7
                ? 'bg-red-900/60 text-red-100 border-red-500'
                : 'bg-amber-900/60 text-amber-100 border-amber-500';

            return (
              <li key={bed.id}>
                <Link
                  href={`/patients/${bed.patient.mrn}`}
                  aria-live="polite"
                  className="flex items-center gap-3 px-3 py-3 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 transition-colors"
                >
                  <span
                    className={`inline-flex items-center justify-center min-w-[44px] h-[44px] rounded-lg border-2 font-bold text-base ${badgeClass}`}
                    aria-label={`NEWS2 ${score}`}
                  >
                    {score}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {bed.patient.name}
                    </div>
                    <div className="text-xs text-slate-300 truncate">
                      <span className="font-mono text-blue-300">{bed.patient.mrn}</span> ·{' '}
                      {bed.patient.age} anos · {bed.id} · {bed.patient.diagnosis}
                    </div>
                  </div>
                  <span
                    className={`text-lg font-bold ${trendColor}`}
                    aria-label={`Tendência ${trend ?? 'desconhecida'}`}
                  >
                    {arrow}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {highRiskBeds.length > 0 && (
        <p className="text-xs text-slate-400 mt-3 text-center">
          {highRiskBeds.length} paciente(s) — {highRiskBeds.filter((b) => b.news2 >= 7).length} em
          alto risco (NEWS2 ≥ 7)
        </p>
      )}
    </section>
  );
}
