'use client';

import { useMemo, useState } from 'react';

type ConsciousnessLevel = 'A' | 'C' | 'V' | 'P' | 'U';

interface ParameterBreakdown {
  label: string;
  value: string;
  score: number;
}

interface News2Result {
  total: number;
  breakdown: ParameterBreakdown[];
  hasAnyThree: boolean;
  riskBand: 'low' | 'medium' | 'high';
}

function scoreRespiratoryRate(rr: number | null): number {
  if (rr === null || Number.isNaN(rr)) return 0;
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3;
}

function scoreSpo2(spo2: number | null): number {
  if (spo2 === null || Number.isNaN(spo2)) return 0;
  if (spo2 <= 91) return 3;
  if (spo2 <= 93) return 2;
  if (spo2 <= 95) return 1;
  return 0;
}

function scoreSupplementalO2(onO2: boolean): number {
  return onO2 ? 2 : 0;
}

function scoreTemperature(temp: number | null): number {
  if (temp === null || Number.isNaN(temp)) return 0;
  if (temp <= 35.0) return 3;
  if (temp <= 36.0) return 1;
  if (temp <= 38.0) return 0;
  if (temp <= 39.0) return 1;
  return 2;
}

function scoreSystolicBp(sbp: number | null): number {
  if (sbp === null || Number.isNaN(sbp)) return 0;
  if (sbp <= 90) return 3;
  if (sbp <= 100) return 2;
  if (sbp <= 110) return 1;
  if (sbp <= 219) return 0;
  return 3;
}

function scoreHeartRate(hr: number | null): number {
  if (hr === null || Number.isNaN(hr)) return 0;
  if (hr <= 40) return 3;
  if (hr <= 50) return 1;
  if (hr <= 90) return 0;
  if (hr <= 110) return 1;
  if (hr <= 130) return 2;
  return 3;
}

function scoreConsciousness(level: ConsciousnessLevel): number {
  return level === 'A' ? 0 : 3;
}

function parseNumber(raw: string): number | null {
  if (raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

const BUNDLE_ACTIONS: string[] = [
  'Medir lactato (repetir em 2h se inicial > 2)',
  'Coletar hemoculturas antes de antibiotico',
  'Iniciar antibiotico de amplo espectro (< 1h)',
  'Cristaloides 30 mL/kg se hipotensao ou lactato >= 4',
  'Vasopressor se PAM < 65 apos fluidos',
];

export default function News2Calculator() {
  const [respiratoryRate, setRespiratoryRate] = useState<string>('');
  const [spo2, setSpo2] = useState<string>('');
  const [onSupplementalO2, setOnSupplementalO2] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<string>('');
  const [systolicBp, setSystolicBp] = useState<string>('');
  const [heartRate, setHeartRate] = useState<string>('');
  const [consciousness, setConsciousness] = useState<ConsciousnessLevel>('A');

  const result: News2Result = useMemo(() => {
    const rrValue = parseNumber(respiratoryRate);
    const spo2Value = parseNumber(spo2);
    const tempValue = parseNumber(temperature);
    const sbpValue = parseNumber(systolicBp);
    const hrValue = parseNumber(heartRate);

    const rrScore = scoreRespiratoryRate(rrValue);
    const spo2Score = scoreSpo2(spo2Value);
    const o2Score = scoreSupplementalO2(onSupplementalO2);
    const tempScore = scoreTemperature(tempValue);
    const sbpScore = scoreSystolicBp(sbpValue);
    const hrScore = scoreHeartRate(hrValue);
    const consciousnessScore = scoreConsciousness(consciousness);

    const breakdown: ParameterBreakdown[] = [
      {
        label: 'Frequencia respiratoria',
        value: rrValue === null ? '--' : `${rrValue} irpm`,
        score: rrScore,
      },
      {
        label: 'SpO2',
        value: spo2Value === null ? '--' : `${spo2Value}%`,
        score: spo2Score,
      },
      {
        label: 'O2 suplementar',
        value: onSupplementalO2 ? 'Sim' : 'Nao',
        score: o2Score,
      },
      {
        label: 'Temperatura',
        value: tempValue === null ? '--' : `${tempValue.toFixed(1)} C`,
        score: tempScore,
      },
      {
        label: 'PA sistolica',
        value: sbpValue === null ? '--' : `${sbpValue} mmHg`,
        score: sbpScore,
      },
      {
        label: 'Frequencia cardiaca',
        value: hrValue === null ? '--' : `${hrValue} bpm`,
        score: hrScore,
      },
      {
        label: 'Consciencia (ACVPU)',
        value: consciousness,
        score: consciousnessScore,
      },
    ];

    const total =
      rrScore + spo2Score + o2Score + tempScore + sbpScore + hrScore + consciousnessScore;
    const hasAnyThree = breakdown.some((item) => item.score === 3);
    let riskBand: 'low' | 'medium' | 'high' = 'low';
    if (total >= 7) riskBand = 'high';
    else if (total >= 5) riskBand = 'medium';

    return { total, breakdown, hasAnyThree, riskBand };
  }, [respiratoryRate, spo2, onSupplementalO2, temperature, systolicBp, heartRate, consciousness]);

  const shouldTriggerBundle = result.total >= 5 || result.hasAnyThree;

  const riskBadgeClass =
    result.riskBand === 'high'
      ? 'bg-neutral-900 text-white'
      : result.riskBand === 'medium'
        ? 'bg-neutral-500 text-white'
        : 'bg-neutral-100 text-neutral-900';
  const riskLabel =
    result.riskBand === 'high'
      ? 'ALTO RISCO'
      : result.riskBand === 'medium'
        ? 'RISCO MEDIO'
        : 'BAIXO RISCO';

  const inputClass =
    'w-full min-h-[44px] rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-neutral-900 placeholder-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200';
  const labelClass = 'mb-1 block text-sm font-semibold text-neutral-900';

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6 text-neutral-900 shadow-lg">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900">Calculadora NEWS2</h2>
        <p className="mt-1 text-sm text-neutral-500">
          National Early Warning Score 2 (Royal College of Physicians, 2017). Recomendado pelas
          diretrizes SSC 2024 para triagem de sepse em adultos.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="news2-rr" className={labelClass}>
            Frequencia respiratoria (irpm)
          </label>
          <input
            id="news2-rr"
            type="number"
            inputMode="numeric"
            min={0}
            max={80}
            value={respiratoryRate}
            onChange={(event) => setRespiratoryRate(event.target.value)}
            className={inputClass}
            placeholder="12-20"
          />
        </div>

        <div>
          <label htmlFor="news2-spo2" className={labelClass}>
            SpO2 (%)
          </label>
          <input
            id="news2-spo2"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={spo2}
            onChange={(event) => setSpo2(event.target.value)}
            className={inputClass}
            placeholder=">= 96"
          />
        </div>

        <div className="flex items-center md:col-span-2">
          <input
            id="news2-o2"
            type="checkbox"
            checked={onSupplementalO2}
            onChange={(event) => setOnSupplementalO2(event.target.checked)}
            className="h-5 w-5 min-h-[44px] cursor-pointer rounded border-neutral-300 bg-neutral-50 text-neutral-700 focus:ring-2 focus:ring-neutral-200"
          />
          <label htmlFor="news2-o2" className="ml-3 text-sm font-semibold text-neutral-900">
            Paciente em O2 suplementar
          </label>
        </div>

        <div>
          <label htmlFor="news2-temp" className={labelClass}>
            Temperatura (C)
          </label>
          <input
            id="news2-temp"
            type="number"
            inputMode="decimal"
            step={0.1}
            min={25}
            max={45}
            value={temperature}
            onChange={(event) => setTemperature(event.target.value)}
            className={inputClass}
            placeholder="36.1-38.0"
          />
        </div>

        <div>
          <label htmlFor="news2-sbp" className={labelClass}>
            PA sistolica (mmHg)
          </label>
          <input
            id="news2-sbp"
            type="number"
            inputMode="numeric"
            min={0}
            max={300}
            value={systolicBp}
            onChange={(event) => setSystolicBp(event.target.value)}
            className={inputClass}
            placeholder="111-219"
          />
        </div>

        <div>
          <label htmlFor="news2-hr" className={labelClass}>
            Frequencia cardiaca (bpm)
          </label>
          <input
            id="news2-hr"
            type="number"
            inputMode="numeric"
            min={0}
            max={260}
            value={heartRate}
            onChange={(event) => setHeartRate(event.target.value)}
            className={inputClass}
            placeholder="51-90"
          />
        </div>

        <div>
          <label htmlFor="news2-acvpu" className={labelClass}>
            Nivel de consciencia (ACVPU)
          </label>
          <select
            id="news2-acvpu"
            value={consciousness}
            onChange={(event) => setConsciousness(event.target.value as ConsciousnessLevel)}
            className={inputClass}
          >
            <option value="A">Alerta (A)</option>
            <option value="C">Confuso (C)</option>
            <option value="V">Responde a voz (V)</option>
            <option value="P">Responde a dor (P)</option>
            <option value="U">Nao responsivo (U)</option>
          </select>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-5">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Pontuacao NEWS2
            </p>
            <p className="text-5xl font-bold text-neutral-900" aria-live="polite">
              {result.total}
            </p>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-sm font-bold ${riskBadgeClass}`}
            aria-label={`Classificacao ${riskLabel}`}
          >
            {riskLabel}
          </span>
        </div>

        {result.hasAnyThree ? (
          <p
            className="mt-4 rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-900"
            role="status"
          >
            &gt;= 1 parametro com pontuacao 3 - escalada clinica
          </p>
        ) : null}

        <dl className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {result.breakdown.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-md bg-white px-3 py-2"
            >
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {item.label}
                </dt>
                <dd className="text-sm text-neutral-900">{item.value}</dd>
              </div>
              <span
                className={`rounded px-2 py-1 text-sm font-bold ${
                  item.score === 0
                    ? 'bg-neutral-100 text-neutral-700'
                    : item.score === 1
                      ? 'bg-neutral-200 text-neutral-900'
                      : item.score === 2
                        ? 'bg-neutral-500 text-white'
                        : 'bg-neutral-900 text-white'
                }`}
                aria-label={`Pontuacao ${item.score}`}
              >
                +{item.score}
              </span>
            </div>
          ))}
        </dl>
      </div>

      {shouldTriggerBundle ? (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-6 rounded-lg border-2 border-neutral-300 bg-neutral-100 p-5"
        >
          <h3 className="text-xl font-bold text-neutral-900">ACIONAR SEPSIS HOUR-1 BUNDLE</h3>
          <p className="mt-1 text-sm text-neutral-700">
            Criterio de gatilho: NEWS2 &gt;= 5 ou parametro isolado com pontuacao 3. Siga as acoes
            do bundle em ate 1 hora (Surviving Sepsis Campaign 2024).
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-6 text-sm text-neutral-700">
            {BUNDLE_ACTIONS.map((action) => (
              <li key={action} className="font-medium">
                {action}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
