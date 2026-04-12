'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import type {
  HospitalTask,
  TaskStatus,
  TaskHistoryEntry,
  TaskComment,
  Evidence,
  ChecklistItem,
  DeclineReason,
  BlockReason,
} from '@/lib/hospital-task-types';

/* ── Label maps ──────────────────────────────────────────────────── */

const STATUS_LABEL: Record<TaskStatus, string> = {
  draft: 'Rascunho',
  open: 'Aberta',
  received: 'Recebida',
  accepted: 'Aceita',
  in_progress: 'Em Progresso',
  blocked: 'Bloqueada',
  completed: 'Concluida',
  verified: 'Verificada',
  declined: 'Recusada',
  reassigned: 'Reatribuida',
  cancelled: 'Cancelada',
  expired: 'Expirada',
  escalated: 'Escalada',
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'URGENTE',
  high: 'ALTO',
  normal: 'NORMAL',
  low: 'BAIXO',
};

const DECLINE_REASON_LABEL: Record<DeclineReason, string> = {
  not_my_scope: 'Fora do meu escopo',
  not_my_shift: 'Fora do meu turno',
  patient_transferred: 'Paciente transferido',
  already_done: 'Ja realizado',
  duplicate: 'Duplicada',
  insufficient_info: 'Informacao insuficiente',
  resource_unavailable: 'Recurso indisponivel',
  clinical_contraindication: 'Contraindicacao clinica',
  other: 'Outro',
};

const BLOCK_REASON_LABEL: Record<BlockReason, string> = {
  waiting_lab: 'Aguardando laboratorio',
  waiting_pharmacy: 'Aguardando farmacia',
  waiting_transport: 'Aguardando transporte',
  waiting_cleaning: 'Aguardando limpeza',
  waiting_equipment: 'Aguardando equipamento',
  waiting_physician: 'Aguardando medico',
  waiting_family: 'Aguardando familia',
  waiting_insurance: 'Aguardando convenio',
  patient_unstable: 'Paciente instavel',
  other: 'Outro',
};

const ALL_DECLINE_REASONS: DeclineReason[] = [
  'not_my_scope',
  'not_my_shift',
  'patient_transferred',
  'already_done',
  'duplicate',
  'insufficient_info',
  'resource_unavailable',
  'clinical_contraindication',
  'other',
];

const ALL_BLOCK_REASONS: BlockReason[] = [
  'waiting_lab',
  'waiting_pharmacy',
  'waiting_transport',
  'waiting_cleaning',
  'waiting_equipment',
  'waiting_physician',
  'waiting_family',
  'waiting_insurance',
  'patient_unstable',
  'other',
];

/* ── Helpers ─────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

function slaPhaseLabel(phase: string): string {
  const map: Record<string, string> = {
    receive: 'Recebimento',
    accept: 'Aceite',
    start: 'Inicio',
    complete: 'Conclusao',
  };
  return map[phase] ?? phase;
}

function slaDeadline(task: HospitalTask): string {
  const sla = task.sla;
  const deadlineMap: Record<string, string> = {
    receive: sla.receiveBy,
    accept: sla.acceptBy,
    start: sla.startBy,
    complete: sla.completeBy,
  };
  return deadlineMap[sla.currentPhase] ?? '';
}

function slaProgressPercent(task: HospitalTask): number {
  const sla = task.sla;
  const deadlineIso = slaDeadline(task);
  if (!deadlineIso) return 0;
  const created = new Date(task.createdAt).getTime();
  const deadline = new Date(deadlineIso).getTime();
  const total = deadline - created;
  if (total <= 0) return 100;
  const elapsed = sla.elapsedMs - sla.pausedMs;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

/* ── Skeleton ────────────────────────────────────────────────────── */

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded bg-neutral-200" />
      <div className="h-4 w-48 rounded bg-neutral-100" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded bg-neutral-100" />
        ))}
      </div>
      <div className="h-32 rounded bg-neutral-100" />
      <div className="h-48 rounded bg-neutral-100" />
    </div>
  );
}

/* ── Action buttons ──────────────────────────────────────────────── */

interface ActionPanelProps {
  task: HospitalTask;
  onStatusChange: (status: string, extra?: Record<string, unknown>) => void;
}

function ActionPanel({ task, onStatusChange }: ActionPanelProps) {
  const [showDecline, setShowDecline] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [declineReason, setDeclineReason] = useState<DeclineReason>('not_my_scope');
  const [declineText, setDeclineText] = useState('');
  const [blockReason, setBlockReason] = useState<BlockReason>('waiting_lab');
  const [blockText, setBlockText] = useState('');

  const s = task.status;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neutral-900">Acoes</h3>
      <div className="flex flex-wrap gap-2">
        {s === 'open' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onStatusChange('received')}
          >
            Receber
          </button>
        )}
        {s === 'received' && (
          <>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onStatusChange('accepted')}
            >
              Aceitar
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setShowDecline(true)}
            >
              Recusar
            </button>
          </>
        )}
        {s === 'accepted' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onStatusChange('in_progress')}
          >
            Iniciar
          </button>
        )}
        {s === 'in_progress' && (
          <>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onStatusChange('completed')}
            >
              Concluir
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setShowBlock(true)}
            >
              Bloquear
            </button>
          </>
        )}
        {s === 'blocked' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onStatusChange('in_progress')}
          >
            Desbloquear
          </button>
        )}
        {s === 'completed' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onStatusChange('verified')}
          >
            Verificar
          </button>
        )}
        {!['verified', 'cancelled', 'expired'].includes(s) && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => onStatusChange('cancelled')}
          >
            Cancelar
          </button>
        )}
      </div>

      {/* Decline form */}
      {showDecline && (
        <div className="rounded border border-neutral-200 bg-neutral-50 p-4 space-y-3">
          <label className="block text-sm font-medium text-neutral-700">
            Motivo da recusa
          </label>
          <select
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value as DeclineReason)}
          >
            {ALL_DECLINE_REASONS.map((r) => (
              <option key={r} value={r}>
                {DECLINE_REASON_LABEL[r]}
              </option>
            ))}
          </select>
          <label className="block text-sm font-medium text-neutral-700">
            Observacao (opcional)
          </label>
          <textarea
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            rows={2}
            value={declineText}
            onChange={(e) => setDeclineText(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                onStatusChange('declined', {
                  declineReason,
                  declineReasonText: declineText || undefined,
                });
                setShowDecline(false);
              }}
            >
              Confirmar recusa
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setShowDecline(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Block form */}
      {showBlock && (
        <div className="rounded border border-neutral-200 bg-neutral-50 p-4 space-y-3">
          <label className="block text-sm font-medium text-neutral-700">
            Motivo do bloqueio
          </label>
          <select
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value as BlockReason)}
          >
            {ALL_BLOCK_REASONS.map((r) => (
              <option key={r} value={r}>
                {BLOCK_REASON_LABEL[r]}
              </option>
            ))}
          </select>
          <label className="block text-sm font-medium text-neutral-700">
            Observacao (opcional)
          </label>
          <textarea
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            rows={2}
            value={blockText}
            onChange={(e) => setBlockText(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                onStatusChange('blocked', {
                  blockReason,
                  blockReasonText: blockText || undefined,
                });
                setShowBlock(false);
              }}
            >
              Confirmar bloqueio
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setShowBlock(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const [task, setTask] = useState<HospitalTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadTask = useCallback(() => {
    fetch(`/api/hospital-tasks/${params.id}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          setError(res.status === 404 ? 'Tarefa nao encontrada.' : `Erro ${res.status}`);
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { task: HospitalTask };
        setTask(data.task);
        setLoading(false);
      })
      .catch(() => {
        setError('Erro de rede.');
        setLoading(false);
      });
  }, [params.id]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  async function handleStatusChange(newStatus: string, extra?: Record<string, unknown>) {
    if (!task || submittingAction) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/hospital-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status: newStatus, ...extra }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Erro ${res.status}`);
        return;
      }
      loadTask();
    } catch {
      setError('Erro de rede.');
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/hospital-tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ text: commentText.trim() }),
      });
      if (!res.ok) {
        setError('Erro ao adicionar comentario.');
        return;
      }
      setCommentText('');
      loadTask();
    } catch {
      setError('Erro de rede.');
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleAddEvidence() {
    if (!task) return;
    const value = window.prompt('Descricao da evidencia:');
    if (!value) return;
    try {
      await fetch(`/api/hospital-tasks/${task.id}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ type: 'text', value }),
      });
      loadTask();
    } catch {
      setError('Erro ao anexar evidencia.');
    }
  }

  async function handleToggleChecklist(item: ChecklistItem) {
    if (!task) return;
    try {
      await fetch(`/api/hospital-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          checklistItemId: item.id,
          checked: !item.checked,
        }),
      });
      loadTask();
    } catch {
      setError('Erro ao atualizar checklist.');
    }
  }

  if (loading) {
    return (
      <AppShell pageTitle="Tarefa">
        <DetailSkeleton />
      </AppShell>
    );
  }

  if (error && !task) {
    return (
      <AppShell pageTitle="Tarefa">
        <div className="space-y-4">
          <Link
            href="/tasks"
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            ← Voltar para tarefas
          </Link>
          <div className="rounded border border-neutral-200 bg-neutral-50 p-6 text-center text-neutral-700">
            {error}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!task) return null;

  const progress = slaProgressPercent(task);
  const reversedHistory = [...task.history].reverse();

  return (
    <AppShell pageTitle={`Tarefa ${task.shortCode}`}>
      <div className="space-y-6">
        {/* Back link */}
        <Link
          href="/tasks"
          className="inline-block text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Voltar para tarefas
        </Link>

        {/* Error banner */}
        {error && (
          <div className="rounded border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm text-neutral-900">
            {error}
            <button
              className="ml-3 text-neutral-500 hover:text-neutral-900"
              onClick={() => setError(null)}
            >
              Fechar
            </button>
          </div>
        )}

        {/* Header */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-mono text-neutral-500">{task.shortCode}</span>
            <span className="inline-block rounded border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-900">
              {PRIORITY_LABEL[task.priority] ?? task.priority}
            </span>
            <span className="inline-block rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700">
              {STATUS_LABEL[task.status] ?? task.status}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-neutral-900">{task.title}</h2>
          {task.description && (
            <p className="mt-1 text-sm text-neutral-700">{task.description}</p>
          )}
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded border border-neutral-200 bg-white p-4">
          {task.patientName && (
            <div>
              <div className="text-xs font-medium text-neutral-500">Paciente</div>
              <div className="text-sm text-neutral-900">
                {task.patientName}
                {task.patientMrn && (
                  <span className="ml-1 text-neutral-500">({task.patientMrn})</span>
                )}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-neutral-500">Ala</div>
            <div className="text-sm text-neutral-900">{task.ward}</div>
          </div>
          {task.bed && (
            <div>
              <div className="text-xs font-medium text-neutral-500">Leito</div>
              <div className="text-sm text-neutral-900">{task.bed}</div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-neutral-500">Criado por</div>
            <div className="text-sm text-neutral-900">
              {task.createdBy.name}{' '}
              <span className="text-neutral-500">({task.createdBy.role})</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500">Destinatario</div>
            <div className="text-sm text-neutral-900">
              {task.assignedTo.name}{' '}
              <span className="text-neutral-500">({task.assignedTo.role})</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500">Criado em</div>
            <div className="text-sm text-neutral-900">{formatDate(task.createdAt)}</div>
          </div>
        </div>

        {/* SLA section */}
        <div className="rounded border border-neutral-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-900">SLA</h3>
          <div className="flex items-center gap-3 text-sm text-neutral-700">
            <span>Fase atual: {slaPhaseLabel(task.sla.currentPhase)}</span>
            {task.sla.breached && (
              <span className="inline-block rounded border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-900">
                SLA VIOLADO
              </span>
            )}
          </div>
          <div className="w-full rounded bg-neutral-200 h-2">
            <div
              className="h-2 rounded bg-neutral-900"
              style={{ width: `${progress}%`, transition: 'width 0.3s' }}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
            <span>Receber ate: {formatDate(task.sla.receiveBy)}</span>
            <span>Aceitar ate: {formatDate(task.sla.acceptBy)}</span>
            <span>Iniciar ate: {formatDate(task.sla.startBy)}</span>
            <span>Concluir ate: {formatDate(task.sla.completeBy)}</span>
          </div>
          <div className="text-xs text-neutral-500">
            Tempo decorrido: {formatDuration(task.sla.elapsedMs)} (pausado:{' '}
            {formatDuration(task.sla.pausedMs)})
          </div>
        </div>

        {/* Instructions */}
        {task.instructions && (
          <div className="rounded border border-neutral-200 bg-white p-4 space-y-2">
            <h3 className="text-sm font-semibold text-neutral-900">Instrucoes</h3>
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">
              {task.instructions}
            </p>
          </div>
        )}

        {/* Checklist */}
        {task.checklistItems && task.checklistItems.length > 0 && (
          <div className="rounded border border-neutral-200 bg-white p-4 space-y-2">
            <h3 className="text-sm font-semibold text-neutral-900">Checklist</h3>
            <ul className="space-y-1">
              {task.checklistItems.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleToggleChecklist(item)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  <span
                    className={`text-sm ${item.checked ? 'text-neutral-500 line-through' : 'text-neutral-900'}`}
                  >
                    {item.label}
                  </span>
                  {item.checkedBy && (
                    <span className="text-xs text-neutral-500">
                      — {item.checkedBy.name}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="rounded border border-neutral-200 bg-white p-4">
          <ActionPanel task={task} onStatusChange={handleStatusChange} />
          {submittingAction && (
            <p className="mt-2 text-xs text-neutral-500">Processando...</p>
          )}
        </div>

        {/* Evidence */}
        <div className="rounded border border-neutral-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">Evidencias</h3>
            <button
              className="btn btn-outline btn-sm"
              onClick={handleAddEvidence}
            >
              Anexar evidencia
            </button>
          </div>
          {task.evidence.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhuma evidencia anexada.</p>
          ) : (
            <ul className="space-y-2">
              {task.evidence.map((ev: Evidence) => (
                <li
                  key={ev.id}
                  className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm"
                >
                  <div className="flex items-center gap-2 text-neutral-500 text-xs mb-1">
                    <span className="font-mono">{ev.type}</span>
                    <span>por {ev.attachedBy.name}</span>
                    <span>{formatDate(ev.attachedAt)}</span>
                  </div>
                  <div className="text-neutral-900">{ev.value}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Timeline */}
        <div className="rounded border border-neutral-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-900">Historico</h3>
          {reversedHistory.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhum registro.</p>
          ) : (
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-2 top-1 bottom-1 w-px bg-neutral-300" />
              {reversedHistory.map((entry: TaskHistoryEntry) => (
                <div key={entry.id} className="relative mb-4 last:mb-0">
                  {/* Dot */}
                  <div className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-400 bg-white" />
                  <div className="text-xs text-neutral-500 mb-0.5">
                    {formatDate(entry.timestamp)} — {entry.actor.name}
                  </div>
                  <div className="text-sm text-neutral-900">
                    {entry.action}
                    {entry.fromStatus && entry.toStatus && (
                      <span className="text-neutral-500">
                        {' '}
                        ({STATUS_LABEL[entry.fromStatus] ?? entry.fromStatus} →{' '}
                        {STATUS_LABEL[entry.toStatus] ?? entry.toStatus})
                      </span>
                    )}
                  </div>
                  {entry.note && (
                    <p className="text-sm text-neutral-700 mt-0.5">{entry.note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="rounded border border-neutral-200 bg-white p-4 space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">Comentarios</h3>
          {task.comments.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhum comentario.</p>
          ) : (
            <ul className="space-y-3">
              {task.comments.map((c: TaskComment) => (
                <li
                  key={c.id}
                  className="rounded border border-neutral-200 bg-neutral-50 p-3"
                >
                  <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
                    <span className="font-medium text-neutral-700">{c.author.name}</span>
                    <span>{formatDate(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-neutral-900 whitespace-pre-wrap">{c.text}</p>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAddComment} className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700">
              Novo comentario
            </label>
            <textarea
              className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Escreva um comentario..."
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!commentText.trim() || submittingComment}
            >
              {submittingComment ? 'Enviando...' : 'Enviar comentario'}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
