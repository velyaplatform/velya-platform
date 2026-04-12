'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { STAFF, ROLE_LABELS } from '../../../lib/fixtures/staff';
import type { IllnessSeverity, PatientHandoffEntry } from '@/lib/handoff-store';

const ILLNESS_LABELS: Record<IllnessSeverity, string> = {
  stable: 'Estável',
  watcher: 'Observação',
  unstable: 'Instável',
};

interface PatientDraft extends PatientHandoffEntry {
  uid: string;
}

function newPatient(): PatientDraft {
  return {
    uid: Math.random().toString(36).slice(2, 10),
    patientMrn: '',
    patientName: '',
    ward: '',
    bed: '',
    illnessSeverity: 'stable',
    patientSummary: '',
    actionItems: [],
    situationAwareness: '',
    activeIssues: [],
  };
}

export default function NewHandoffPage() {
  const router = useRouter();

  const [toUserId, setToUserId] = useState('');
  const [ward, setWard] = useState('');
  const [shiftLabel, setShiftLabel] = useState('Manhã → Tarde');
  const [shiftBoundaryAt, setShiftBoundaryAt] = useState('');
  const [unitNotes, setUnitNotes] = useState('');
  const [patients, setPatients] = useState<PatientDraft[]>([newPatient()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const receiver = STAFF.find((s) => s.id === toUserId);

  function updatePatient(uid: string, partial: Partial<PatientDraft>) {
    setPatients((prev) => prev.map((p) => (p.uid === uid ? { ...p, ...partial } : p)));
  }
  function addPatient() {
    setPatients((prev) => [...prev, newPatient()]);
  }
  function removePatient(uid: string) {
    setPatients((prev) => prev.filter((p) => p.uid !== uid));
  }
  function addAction(uid: string) {
    setPatients((prev) =>
      prev.map((p) =>
        p.uid === uid
          ? {
              ...p,
              actionItems: [...p.actionItems, { task: '', owner: '', done: false }],
            }
          : p,
      ),
    );
  }
  function updateAction(uid: string, idx: number, partial: Partial<PatientHandoffEntry['actionItems'][number]>) {
    setPatients((prev) =>
      prev.map((p) =>
        p.uid === uid
          ? {
              ...p,
              actionItems: p.actionItems.map((a, i) => (i === idx ? { ...a, ...partial } : a)),
            }
          : p,
      ),
    );
  }
  function removeAction(uid: string, idx: number) {
    setPatients((prev) =>
      prev.map((p) =>
        p.uid === uid
          ? { ...p, actionItems: p.actionItems.filter((_, i) => i !== idx) }
          : p,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!receiver) {
      setError('Selecione um destinatário.');
      return;
    }
    if (!ward || !shiftBoundaryAt) {
      setError('Setor e horário de fim do turno são obrigatórios.');
      return;
    }
    if (patients.some((p) => !p.patientMrn || !p.patientName || !p.patientSummary)) {
      setError('Preencha MRN, nome e resumo de cada paciente.');
      return;
    }
    setSubmitting(true);
    try {
      const cleaned: PatientHandoffEntry[] = patients.map((p) => ({
        patientMrn: p.patientMrn,
        patientName: p.patientName,
        ward: p.ward || ward,
        bed: p.bed,
        illnessSeverity: p.illnessSeverity,
        patientSummary: p.patientSummary,
        actionItems: p.actionItems.filter((a) => a.task.trim().length > 0),
        situationAwareness: p.situationAwareness,
        activeIssues: p.activeIssues.filter((i) => i.trim().length > 0),
      }));
      const res = await fetch('/api/handoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          toUserId: receiver.id,
          toUserName: receiver.name,
          toRole: receiver.role,
          ward,
          shiftLabel,
          shiftBoundaryAt: new Date(shiftBoundaryAt).toISOString(),
          patients: cleaned,
          unitNotes: unitNotes || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Erro ${res.status}`);
        return;
      }
      const data = (await res.json()) as { handoff: { id: string } };
      router.push(`/handoffs/${data.handoff.id}`);
    } catch {
      setError('Erro de rede.');
    } finally {
      setSubmitting(false);
    }
  }

  const input =
    'w-full min-h-[44px] bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200';
  const label = 'text-sm font-medium text-neutral-700';

  return (
    <AppShell pageTitle="Nova passagem de plantão">
      <div className="page-header">
        <h1 className="page-title">Nova passagem de plantão</h1>
        <p className="page-subtitle">
          Estrutura I-PASS: Illness severity · Patient summary · Action list · Situation
          awareness · Synthesis by receiver
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-5">
        {error && (
          <div role="alert" className="mb-4 bg-neutral-50 border border-neutral-300 text-neutral-700 text-sm rounded-md px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="toUserId" className={label}>Receptor *</label>
            <select id="toUserId" value={toUserId} onChange={(e) => setToUserId(e.target.value)} className={`${input} cursor-pointer`} required>
              <option value="">Selecione o profissional do próximo turno...</option>
              {STAFF.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {ROLE_LABELS[s.role]} ({s.ward})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ward" className={label}>Setor *</label>
            <input id="ward" type="text" value={ward} onChange={(e) => setWard(e.target.value)} className={input} placeholder="Ex: UTI Adulto - Ala 1" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="shiftLabel" className={label}>Turnos</label>
            <select id="shiftLabel" value={shiftLabel} onChange={(e) => setShiftLabel(e.target.value)} className={`${input} cursor-pointer`}>
              <option value="Manhã → Tarde">Manhã → Tarde</option>
              <option value="Tarde → Noite">Tarde → Noite</option>
              <option value="Noite → Manhã">Noite → Manhã</option>
              <option value="Plantão → Plantão">Plantão → Plantão</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="boundary" className={label}>Fim do turno *</label>
            <input id="boundary" type="datetime-local" value={shiftBoundaryAt} onChange={(e) => setShiftBoundaryAt(e.target.value)} className={input} required />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mb-6">
          <label htmlFor="unitNotes" className={label}>Avisos da unidade (não-pacientes)</label>
          <textarea id="unitNotes" value={unitNotes} onChange={(e) => setUnitNotes(e.target.value)} rows={2} className={`${input} min-h-[68px]`} placeholder="Ex: Bomba de infusão #3 com defeito · Visita técnica RX agendada para 14h" />
        </div>

        <h2 className="text-sm font-bold text-neutral-900 mb-3 uppercase tracking-wider">
          Pacientes ({patients.length})
        </h2>

        <div className="flex flex-col gap-4">
          {patients.map((p, pIdx) => (
            <fieldset key={p.uid} className="border border-neutral-200 rounded-lg p-4 bg-white/40">
              <legend className="text-sm font-bold text-neutral-900 px-2">
                Paciente {pIdx + 1}
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`mrn-${p.uid}`} className={label}>MRN *</label>
                  <input id={`mrn-${p.uid}`} type="text" value={p.patientMrn} onChange={(e) => updatePatient(p.uid, { patientMrn: e.target.value })} className={`${input} font-mono`} placeholder="MRN-XXX" required />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor={`name-${p.uid}`} className={label}>Nome *</label>
                  <input id={`name-${p.uid}`} type="text" value={p.patientName} onChange={(e) => updatePatient(p.uid, { patientName: e.target.value })} className={input} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`bed-${p.uid}`} className={label}>Leito</label>
                  <input id={`bed-${p.uid}`} type="text" value={p.bed ?? ''} onChange={(e) => updatePatient(p.uid, { bed: e.target.value })} className={input} placeholder="Ex: UTI-03" />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor={`severity-${p.uid}`} className={label}>
                    <strong>I</strong> — Illness severity *
                  </label>
                  <select id={`severity-${p.uid}`} value={p.illnessSeverity} onChange={(e) => updatePatient(p.uid, { illnessSeverity: e.target.value as IllnessSeverity })} className={`${input} cursor-pointer`}>
                    <option value="stable">{ILLNESS_LABELS.stable}</option>
                    <option value="watcher">{ILLNESS_LABELS.watcher}</option>
                    <option value="unstable">{ILLNESS_LABELS.unstable}</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-3">
                  <label htmlFor={`summary-${p.uid}`} className={label}>
                    <strong>P</strong> — Patient summary *
                  </label>
                  <textarea id={`summary-${p.uid}`} value={p.patientSummary} onChange={(e) => updatePatient(p.uid, { patientSummary: e.target.value })} rows={3} className={`${input} min-h-[88px]`} placeholder="Histórico, evolução, exames recentes, hipóteses ativas" required />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-3">
                  <label className={label}>
                    <strong>A</strong> — Action list
                  </label>
                  {p.actionItems.length === 0 && (
                    <p className="text-xs text-neutral-500">Nenhuma ação. Use o botão abaixo para adicionar.</p>
                  )}
                  <ul className="flex flex-col gap-2">
                    {p.actionItems.map((a, aIdx) => (
                      <li key={aIdx} className="flex flex-wrap gap-2 items-center">
                        <input
                          type="text"
                          value={a.task}
                          onChange={(e) => updateAction(p.uid, aIdx, { task: e.target.value })}
                          className={`${input} flex-1 min-w-[200px]`}
                          placeholder="Tarefa"
                        />
                        <input
                          type="text"
                          value={a.owner}
                          onChange={(e) => updateAction(p.uid, aIdx, { owner: e.target.value })}
                          className={`${input} max-w-[200px]`}
                          placeholder="Responsável"
                        />
                        <input
                          type="datetime-local"
                          value={a.dueAt ?? ''}
                          onChange={(e) => updateAction(p.uid, aIdx, { dueAt: e.target.value })}
                          className={`${input} max-w-[220px]`}
                        />
                        <button
                          type="button"
                          onClick={() => removeAction(p.uid, aIdx)}
                          aria-label={`Remover ação ${aIdx + 1}`}
                          className="text-xs text-neutral-700 hover:text-neutral-900 px-2 py-1"
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => addAction(p.uid)}
                    className="self-start min-h-[36px] px-3 py-1.5 mt-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
                  >
                    + Adicionar ação
                  </button>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-3">
                  <label htmlFor={`situation-${p.uid}`} className={label}>
                    <strong>S</strong> — Situation awareness & contingency
                  </label>
                  <textarea
                    id={`situation-${p.uid}`}
                    value={p.situationAwareness}
                    onChange={(e) => updatePatient(p.uid, { situationAwareness: e.target.value })}
                    rows={2}
                    className={`${input} min-h-[68px]`}
                    placeholder="O que pode acontecer no próximo turno + plano se acontecer"
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-3">
                  <label htmlFor={`issues-${p.uid}`} className={label}>
                    Pendências ativas (separadas por linha)
                  </label>
                  <textarea
                    id={`issues-${p.uid}`}
                    value={p.activeIssues.join('\n')}
                    onChange={(e) =>
                      updatePatient(p.uid, {
                        activeIssues: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    rows={3}
                    className={`${input} min-h-[68px] font-mono text-xs`}
                    placeholder="• Anti-X em curso · meta APTT 60-80&#10;• Aguardando RX tórax controle"
                  />
                </div>
              </div>
              {patients.length > 1 && (
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={() => removePatient(p.uid)}
                    className="text-xs text-neutral-700 hover:text-neutral-900 px-3 py-2"
                  >
                    Remover paciente {pIdx + 1}
                  </button>
                </div>
              )}
            </fieldset>
          ))}
        </div>

        <div className="flex justify-between items-center mt-4 flex-wrap gap-3">
          <button
            type="button"
            onClick={addPatient}
            className="min-h-[44px] px-4 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
          >
            + Adicionar paciente
          </button>
          <div className="flex gap-3">
            <Link
              href="/handoffs"
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] inline-flex items-center px-5 py-2 rounded-md bg-neutral-900 hover:bg-neutral-900 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-60"
            >
              {submitting ? 'Enviando...' : 'Enviar passagem'}
            </button>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
