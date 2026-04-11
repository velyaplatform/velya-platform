'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import type {
  ShiftHandoff,
  HandoffStatus,
  IllnessSeverity,
} from '@/lib/handoff-store';

const STATUS_BADGE: Record<HandoffStatus, string> = {
  draft: 'bg-slate-50 text-slate-600 border-slate-300',
  sent: 'bg-blue-900/40 text-blue-800 border-blue-700/60',
  'awaiting-readback': 'bg-amber-50/40 text-amber-800 border-amber-700/60',
  completed: 'bg-green-50/40 text-green-800 border-green-700/60',
  cancelled: 'bg-slate-50 text-slate-500 border-slate-200',
};
const STATUS_LABEL: Record<HandoffStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  'awaiting-readback': 'Aguardando read-back',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};
const SEVERITY_BADGE: Record<IllnessSeverity, string> = {
  stable: 'bg-green-50/40 text-green-800 border-green-700/60',
  watcher: 'bg-amber-50/40 text-amber-800 border-amber-700/60',
  unstable: 'bg-red-50/40 text-red-800 border-red-700/60',
};
const SEVERITY_LABEL: Record<IllnessSeverity, string> = {
  stable: 'Estável',
  watcher: 'Observação',
  unstable: 'Instável',
};

export default function HandoffDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [handoff, setHandoff] = useState<ShiftHandoff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readback, setReadback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function load() {
    fetch(`/api/handoffs/${params.id}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (res.status === 404) {
          setError('Passagem não encontrada ou sem permissão.');
          return;
        }
        if (!res.ok) {
          setError(`Erro ${res.status}`);
          return;
        }
        const data = (await res.json()) as { handoff: ShiftHandoff };
        setHandoff(data.handoff);
      })
      .catch(() => setError('Erro de rede.'));
  }

  useEffect(() => {
    load();
  }, [params.id]);

  async function handleReceive(e: React.FormEvent) {
    e.preventDefault();
    if (!handoff) return;
    if (readback.trim().length < 5) {
      setError('O read-back precisa ter pelo menos 5 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/handoffs/${handoff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'receive', readback }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Erro ${res.status}`);
        return;
      }
      setReadback('');
      load();
    } catch {
      setError('Erro de rede.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAiSummary() {
    if (!handoff) return;
    setAiLoading(true);
    setAiError(null);
    try {
      // Build a structured prompt from the I-PASS data
      const promptParts: string[] = [
        `Você é um assistente de plantão. Sumarize esta passagem de plantão I-PASS em até 8 bullets, destacando pacientes instáveis e ações pendentes:`,
        `Setor: ${handoff.ward}`,
        `Pacientes: ${handoff.patients.length}`,
        ...handoff.patients.map(
          (p) =>
            `- ${p.patientMrn} ${p.patientName} (${SEVERITY_LABEL[p.illnessSeverity]}): ${p.patientSummary} | Ações: ${p.actionItems.map((a) => a.task).join('; ') || 'nenhuma'}`,
        ),
      ];
      const aiRes = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          capability: 'ai.chat-clinical',
          messages: [{ role: 'user', content: promptParts.join('\n') }],
          context: { moduleId: 'handoffs' },
        }),
      });
      if (!aiRes.ok) {
        const data = (await aiRes.json().catch(() => ({}))) as { error?: string };
        setAiError(data.error ?? `Erro IA ${aiRes.status}`);
        return;
      }
      const aiData = (await aiRes.json()) as { reply: string };
      // Persist on the handoff
      const patchRes = await fetch(`/api/handoffs/${handoff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'set-ai-summary', summary: aiData.reply }),
      });
      if (patchRes.ok) {
        load();
      }
    } catch {
      setAiError('Erro de rede ao gerar sumário.');
    } finally {
      setAiLoading(false);
    }
  }

  if (error) {
    return (
      <AppShell pageTitle="Passagem">
        <div role="alert" className="bg-red-950/40 border border-red-700 text-red-800 rounded-md px-4 py-3 mb-4">
          {error}
        </div>
        <button
          type="button"
          onClick={() => router.push('/handoffs')}
          className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          ← Voltar
        </button>
      </AppShell>
    );
  }

  if (!handoff) {
    return (
      <AppShell pageTitle="Passagem">
        <p className="text-slate-600">Carregando...</p>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle={`Plantão ${handoff.ward}`}>
      <div className="page-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-xs text-slate-500">{handoff.id}</span>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${STATUS_BADGE[handoff.status]}`}
              >
                {STATUS_LABEL[handoff.status]}
              </span>
              <span className="text-xs text-blue-700">{handoff.shiftLabel}</span>
            </div>
            <h1 className="page-title">{handoff.ward}</h1>
            <p className="page-subtitle">
              De <strong className="text-slate-900">{handoff.fromUserName}</strong> para{' '}
              <strong className="text-slate-900">{handoff.toUserName}</strong> ·{' '}
              <span className="text-amber-800">
                {new Date(handoff.shiftBoundaryAt).toLocaleString('pt-BR')}
              </span>
            </p>
          </div>
          <Link
            href="/handoffs"
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-slate-50 border border-slate-300 text-slate-900 hover:bg-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            ← Voltar
          </Link>
        </div>
      </div>

      {/* AI Summary card */}
      <section className="bg-blue-950/30 border border-blue-700/60 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-sm font-bold text-blue-900">
            <span aria-hidden="true">{'\u2728'}</span> Sumário da IA
          </h2>
          <button
            type="button"
            onClick={handleAiSummary}
            disabled={aiLoading}
            className="min-h-[40px] px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60"
          >
            {aiLoading
              ? 'Gerando...'
              : handoff.aiSummary
                ? 'Regenerar sumário'
                : 'Gerar sumário com IA'}
          </button>
        </div>
        {aiError && (
          <div role="alert" className="text-xs text-red-800 mb-2">
            ⚠ {aiError}
          </div>
        )}
        {handoff.aiSummary ? (
          <p className="text-sm text-blue-900 whitespace-pre-wrap">{handoff.aiSummary}</p>
        ) : (
          <p className="text-sm text-blue-800/80 italic">
            Nenhum sumário gerado ainda. Clique no botão para usar a IA do platforma.
          </p>
        )}
      </section>

      {handoff.unitNotes && (
        <section
          aria-labelledby="unit-notes-heading"
          className="bg-amber-950/30 border border-amber-700/60 rounded-xl p-4 mb-4"
        >
          <h2 id="unit-notes-heading" className="text-xs uppercase tracking-wider font-bold text-amber-800 mb-2">
            Avisos da unidade
          </h2>
          <p className="text-sm text-amber-800 whitespace-pre-wrap">{handoff.unitNotes}</p>
        </section>
      )}

      {/* Patients */}
      <h2 className="text-base font-bold text-slate-900 mb-3">
        Pacientes ({handoff.patients.length})
      </h2>
      <ul className="flex flex-col gap-3 mb-6">
        {handoff.patients.map((p, idx) => (
          <li
            key={`${p.patientMrn}-${idx}`}
            className="bg-white border border-slate-200 rounded-xl p-5"
          >
            <header className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-blue-700 text-sm">{p.patientMrn}</span>
                  <span className="text-base font-bold text-slate-900">{p.patientName}</span>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${SEVERITY_BADGE[p.illnessSeverity]}`}
                  >
                    {SEVERITY_LABEL[p.illnessSeverity]}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {p.ward}
                  {p.bed && ` · ${p.bed}`}
                </p>
              </div>
              <Link
                href={`/patients/${p.patientMrn}`}
                className="text-xs text-blue-700 hover:text-blue-800 underline"
              >
                Abrir prontuário →
              </Link>
            </header>

            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mt-3 mb-1">
              <strong>P</strong> — Patient summary
            </div>
            <p className="text-sm text-slate-900 whitespace-pre-wrap">{p.patientSummary}</p>

            {p.actionItems.length > 0 && (
              <>
                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mt-4 mb-1">
                  <strong>A</strong> — Action list
                </div>
                <ul className="text-sm text-slate-900 space-y-1">
                  {p.actionItems.map((a, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5">{a.done ? '✓' : '☐'}</span>
                      <div className="flex-1">
                        <span>{a.task}</span>
                        {a.owner && (
                          <span className="text-xs text-slate-500 ml-2">→ {a.owner}</span>
                        )}
                        {a.dueAt && (
                          <span className="text-xs text-amber-800 ml-2">
                            até {new Date(a.dueAt).toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {p.situationAwareness && (
              <>
                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mt-4 mb-1">
                  <strong>S</strong> — Situation awareness
                </div>
                <p className="text-sm text-slate-900 whitespace-pre-wrap">{p.situationAwareness}</p>
              </>
            )}

            {p.activeIssues.length > 0 && (
              <>
                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mt-4 mb-1">
                  Pendências ativas
                </div>
                <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5">
                  {p.activeIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ul>

      {/* Read-back form (for the receiver) */}
      {handoff.status !== 'completed' && (
        <section
          aria-labelledby="readback-heading"
          className="bg-white border border-slate-200 rounded-xl p-5"
        >
          <h2 id="readback-heading" className="text-sm font-bold text-slate-900 mb-3">
            <strong>S</strong> — Synthesis by receiver (read-back)
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            O receptor escreve aqui o que entendeu, em suas próprias palavras. Esse passo é
            obrigatório no I-PASS — ele transforma a passagem em uma comunicação fechada (closed
            loop).
          </p>
          <form onSubmit={handleReceive}>
            <textarea
              value={readback}
              onChange={(e) => setReadback(e.target.value)}
              rows={4}
              className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[100px]"
              placeholder="Recapitule o que entendeu da passagem, as prioridades para o seu turno e qualquer dúvida"
              required
            />
            <div className="flex justify-end mt-3">
              <button
                type="submit"
                disabled={submitting || readback.trim().length < 5}
                className="min-h-[44px] inline-flex items-center px-5 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60"
              >
                {submitting ? 'Confirmando...' : 'Confirmar recebimento'}
              </button>
            </div>
          </form>
        </section>
      )}

      {handoff.receiverReadback && (
        <section className="bg-green-950/30 border border-green-700/60 rounded-xl p-5 mt-4">
          <h2 className="text-sm font-bold text-green-800 mb-2">
            ✓ Read-back recebido — handoff fechado
          </h2>
          <p className="text-sm text-green-800 whitespace-pre-wrap mb-2">{handoff.receiverReadback}</p>
          <p className="text-xs text-green-700">
            Por {handoff.toUserName} em{' '}
            {handoff.completedAt && new Date(handoff.completedAt).toLocaleString('pt-BR')}
          </p>
        </section>
      )}

      {/* History timeline */}
      <section
        aria-labelledby="history-heading"
        className="bg-white border border-slate-200 rounded-xl p-5 mt-4"
      >
        <h2 id="history-heading" className="text-xs uppercase tracking-wider font-semibold text-slate-600 mb-3">
          Histórico auditado
        </h2>
        <ol className="border-l border-slate-200 ml-2 space-y-3">
          {handoff.history.map((entry, idx) => (
            <li key={idx} className="pl-4 relative">
              <span
                aria-hidden="true"
                className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-200"
              />
              <div className="text-xs text-slate-500 font-mono">
                {new Date(entry.at).toLocaleString('pt-BR')}
              </div>
              <div className="text-sm text-slate-900">
                <strong>{entry.actor}</strong> · {entry.action}
              </div>
              {entry.note && <div className="text-xs text-slate-600 italic">"{entry.note}"</div>}
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
