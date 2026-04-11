'use client';

import { AppShell } from '../../components/app-shell';
import News2Calculator from '../../components/news2-calculator';

export default function SepsisToolPage() {
  return (
    <AppShell pageTitle="Sepsis Hour-1 Bundle">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-slate-900">
          <h1 className="text-2xl font-bold text-slate-900">Sepsis Hour-1 Bundle</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            As diretrizes da Surviving Sepsis Campaign 2024 recomendam o uso do NEWS2 (e nao do
            qSOFA) como ferramenta preferencial de triagem de sepse em adultos. Um NEWS2{' '}
            <span className="font-semibold text-slate-900">maior ou igual a 5</span>, ou um unico
            parametro com pontuacao 3, deve acionar o{' '}
            <span className="font-semibold text-slate-900">Code Sepsis</span> e a execucao do Hour-1
            Bundle em ate uma hora: medir lactato, coletar hemoculturas antes do antibiotico,
            iniciar antibiotico de amplo espectro, administrar cristaloides em hipotensao ou
            lactato elevado, e iniciar vasopressor se a pressao arterial media permanecer abaixo de
            65 mmHg apos ressuscitacao volemica.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Esta ferramenta apoia a decisao clinica e nao substitui avaliacao medica. Registre a
            pontuacao no prontuario eletronico apos a avaliacao.
          </p>
        </section>

        <News2Calculator />
      </div>
    </AppShell>
  );
}
