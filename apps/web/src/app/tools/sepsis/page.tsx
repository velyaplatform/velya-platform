'use client';

import { AppShell } from '../../components/app-shell';
import News2Calculator from '../../components/news2-calculator';

export default function SepsisToolPage() {
  return (
    <AppShell pageTitle="Bundle Hora-1 — Sepse">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-slate-900">
          <h1 className="text-2xl font-bold text-slate-900">Bundle Hora-1 para Sepse</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            As diretrizes da Surviving Sepsis Campaign 2024 recomendam o uso do NEWS2 (e não do
            qSOFA) como ferramenta preferencial de triagem de sepse em adultos. Um NEWS2{' '}
            <span className="font-semibold text-slate-900">maior ou igual a 5</span>, ou um único
            parâmetro com pontuação 3, deve acionar o{' '}
            <span className="font-semibold text-slate-900">Code Sepsis</span> e a execução do
            Bundle Hora-1 em até uma hora: medir lactato, coletar hemoculturas antes do
            antibiótico, iniciar antibiótico de amplo espectro, administrar cristaloides em
            hipotensão ou lactato elevado, e iniciar vasopressor se a pressão arterial média
            permanecer abaixo de 65 mmHg após ressuscitação volêmica.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Esta ferramenta apoia a decisão clínica e não substitui avaliação médica. Registre a
            pontuação no prontuário eletrônico após a avaliação.
          </p>
        </section>

        <News2Calculator />
      </div>
    </AppShell>
  );
}
