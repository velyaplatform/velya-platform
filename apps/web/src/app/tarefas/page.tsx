'use client';

/**
 * Tarefas — pagina unica consolidada.
 *
 * Combina as antigas rotas /tasks (kanban), /tasks/new (criar) e
 * /tasks/dashboard (metricas) numa unica pagina:
 *   - header com KPIs (total em execucao, SLA risco, impedidas)
 *   - toolbar com filtros + botao "Criar tarefa" (abre Sheet lateral)
 *   - kanban 5 colunas com drag-and-drop HTML5 preservado
 *   - secao Metricas colapsavel (SLA compliance, tempo por fase,
 *     por unidade, top motivos de bloqueio/recusa)
 *
 * Padrao UI: monocromatico neutral, zero emojis, PT-BR.
 * Criar tarefa vive num Sheet (Radix Dialog) lateral — evita rota separada.
 */

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type DragEvent,
} from 'react';
import { AppShell } from '../components/app-shell';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '../components/ui/sheet';
import type {
  HospitalTask,
  TaskPriority,
  TaskStatus,
  TaskCategory,
  TaskSubcategory,
  BlockReason,
  DeclineReason,
} from '../../lib/hospital-task-types';
import { PRIORITY_ORDER } from '../../lib/hospital-task-types';

// ── Constants ──────────────────────────────────────────────────────

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: 'URGENTE',
  high: 'ALTO',
  normal: 'NORMAL',
  low: 'BAIXO',
};

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  assistencial: 'Assistencial',
  apoio: 'Apoio',
  administrativo: 'Administrativo',
};

const SUBCATEGORY_LABEL: Record<TaskSubcategory, string> = {
  medicacao: 'Medicacao',
  exames: 'Exames',
  procedimentos: 'Procedimentos',
  avaliacao: 'Avaliacao',
  parecer: 'Parecer',
  alta: 'Alta',
  limpeza: 'Limpeza',
  transporte: 'Transporte',
  manutencao: 'Manutencao',
  nutricao: 'Nutricao',
  documentacao: 'Documentacao',
  faturamento: 'Faturamento',
  coordenacao: 'Coordenacao',
};

const SUBCATEGORY_TO_CATEGORY: Record<TaskSubcategory, TaskCategory> = {
  medicacao: 'assistencial',
  exames: 'assistencial',
  procedimentos: 'assistencial',
  avaliacao: 'assistencial',
  parecer: 'assistencial',
  alta: 'assistencial',
  limpeza: 'apoio',
  transporte: 'apoio',
  manutencao: 'apoio',
  nutricao: 'apoio',
  documentacao: 'administrativo',
  faturamento: 'administrativo',
  coordenacao: 'administrativo',
};

const ALL_SUBCATEGORIES: TaskSubcategory[] = [
  'medicacao',
  'exames',
  'procedimentos',
  'avaliacao',
  'parecer',
  'alta',
  'limpeza',
  'transporte',
  'manutencao',
  'nutricao',
  'documentacao',
  'faturamento',
  'coordenacao',
];

const ALL_PRIORITIES: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];

const PRIORITY_FORM_LABEL: Record<TaskPriority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
};

const TERMINAL_STATUSES = new Set<TaskStatus>([
  'completed',
  'verified',
  'cancelled',
  'declined',
  'expired',
]);

interface KanbanColumn {
  key: string;
  label: string;
  statuses: TaskStatus[];
  collapsedByDefault?: boolean;
}

const COLUMNS: KanbanColumn[] = [
  { key: 'aguardando', label: 'Aguardando', statuses: ['open'] },
  { key: 'recebidas', label: 'Recebidas', statuses: ['received'] },
  { key: 'em-andamento', label: 'Em andamento', statuses: ['accepted', 'in_progress'] },
  { key: 'impedidas', label: 'Impedidas', statuses: ['blocked'] },
  { key: 'concluidas', label: 'Concluidas', statuses: ['completed', 'verified'], collapsedByDefault: true },
];

interface StatusAction {
  label: string;
  toStatus: TaskStatus;
  variant: 'default' | 'ghost' | 'outline';
  needsReason?: 'decline' | 'block';
}

const STATUS_ACTIONS: Partial<Record<TaskStatus, StatusAction[]>> = {
  open: [
    { label: 'Recebi', toStatus: 'received', variant: 'default' },
    { label: 'Recusar', toStatus: 'declined', variant: 'ghost', needsReason: 'decline' },
  ],
  received: [
    { label: 'Aceitar', toStatus: 'accepted', variant: 'default' },
    { label: 'Recusar', toStatus: 'declined', variant: 'ghost', needsReason: 'decline' },
  ],
  accepted: [
    { label: 'Iniciar', toStatus: 'in_progress', variant: 'default' },
  ],
  in_progress: [
    { label: 'Concluir', toStatus: 'completed', variant: 'default' },
    { label: 'Bloquear', toStatus: 'blocked', variant: 'outline', needsReason: 'block' },
  ],
  blocked: [
    { label: 'Desbloquear', toStatus: 'in_progress', variant: 'default' },
  ],
};

// ── Drag-and-drop transition rules ────────────────────────────────

interface DropTransition {
  toStatus: TaskStatus;
  needsReason?: 'block';
}

const VALID_DROPS: Record<string, Record<string, DropTransition>> = {
  aguardando: {
    recebidas: { toStatus: 'received' },
  },
  recebidas: {
    'em-andamento': { toStatus: 'accepted' },
  },
  'em-andamento': {
    impedidas: { toStatus: 'blocked', needsReason: 'block' },
    concluidas: { toStatus: 'completed' },
  },
  impedidas: {
    'em-andamento': { toStatus: 'in_progress' },
  },
};

function canDropOnColumn(sourceColumnKey: string, targetColumnKey: string): boolean {
  if (sourceColumnKey === targetColumnKey) return false;
  return Boolean(VALID_DROPS[sourceColumnKey]?.[targetColumnKey]);
}

function getDropTransition(
  sourceColumnKey: string,
  targetColumnKey: string,
): DropTransition | null {
  return VALID_DROPS[sourceColumnKey]?.[targetColumnKey] ?? null;
}

function getColumnKeyForTask(task: HospitalTask): string {
  for (const col of COLUMNS) {
    if (col.statuses.includes(task.status)) return col.key;
  }
  return 'aguardando';
}

// ── SLA helpers ───────────────────────────────────────────────────

function computeSlaPercent(task: HospitalTask): number {
  const now = Date.now();
  const created = new Date(task.createdAt).getTime();
  const deadline = new Date(task.sla.completeBy).getTime();
  const total = deadline - created;
  if (total <= 0) return 100;
  const elapsed = now - created;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

function formatTimeRemaining(task: HospitalTask): string {
  const now = Date.now();
  const deadline = new Date(task.sla.completeBy).getTime();
  const diff = deadline - now;
  if (diff <= 0) {
    const overMs = Math.abs(diff);
    const overMin = Math.floor(overMs / 60000);
    if (overMin < 60) return `Atrasado ${overMin}min`;
    const overH = Math.floor(overMin / 60);
    return `Atrasado ${overH}h ${overMin % 60}min`;
  }
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}min restantes`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}min restantes`;
}

function formatMinutes(totalMs: number): string {
  if (totalMs <= 0) return '—';
  const min = Math.floor(totalMs / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}min`;
}

// ── Loading skeleton ───────────────────────────────────────────────

function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-5 gap-4 mt-6">
      {Array.from({ length: 5 }).map((_, colIdx) => (
        <div key={colIdx} className="space-y-3">
          <div className="h-8 rounded bg-neutral-100 animate-pulse" />
          {Array.from({ length: colIdx === 4 ? 1 : 3 }).map((_, cardIdx) => (
            <div
              key={cardIdx}
              className="h-48 rounded-2xl border border-neutral-200 bg-white animate-pulse"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Drag handle icon ─────────────────────────────────────────────

function DragHandleIcon() {
  return (
    <svg
      width="10"
      height="18"
      viewBox="0 0 10 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-neutral-400"
    >
      <circle cx="2.5" cy="2.5" r="1.5" fill="currentColor" />
      <circle cx="7.5" cy="2.5" r="1.5" fill="currentColor" />
      <circle cx="2.5" cy="9" r="1.5" fill="currentColor" />
      <circle cx="7.5" cy="9" r="1.5" fill="currentColor" />
      <circle cx="2.5" cy="15.5" r="1.5" fill="currentColor" />
      <circle cx="7.5" cy="15.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

// ── Delegation form ───────────────────────────────────────────────

interface DelegationFormProps {
  onDelegate: (name: string, role: string) => void;
  onCancel: () => void;
}

function DelegationForm({ onDelegate, onCancel }: DelegationFormProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    if (!trimmedName || !trimmedRole) return;
    onDelegate(trimmedName, trimmedRole);
  };

  return (
    <div className="mt-2 space-y-2 border-t border-neutral-200 pt-2">
      <p className="text-xs font-semibold text-neutral-700">Delegar tarefa</p>
      <Input
        ref={nameRef}
        type="text"
        placeholder="Nome do responsavel"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 text-xs"
      />
      <Input
        type="text"
        placeholder="Cargo / funcao"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="h-8 text-xs"
      />
      <div className="flex gap-2">
        <Button
          variant="default"
          size="xs"
          className="flex-1"
          onClick={handleSubmit}
          disabled={!name.trim() || !role.trim()}
        >
          Confirmar
        </Button>
        <Button variant="ghost" size="xs" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ── Task card ──────────────────────────────────────────────────────

interface TaskCardProps {
  task: HospitalTask;
  onAction: (taskId: string, toStatus: TaskStatus, extra?: Record<string, string>) => void;
  onDelegate: (taskId: string, name: string, role: string) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, task: HospitalTask) => void;
}

function TaskCard({ task, onAction, onDelegate, onDragStart }: TaskCardProps) {
  const slaPercent = computeSlaPercent(task);
  const slaBreached = task.sla.breached || slaPercent >= 100;
  const slaAtRisk = slaPercent > 90;
  const timeRemaining = formatTimeRemaining(task);
  const actions = STATUS_ACTIONS[task.status] ?? [];
  const [showDelegation, setShowDelegation] = useState(false);

  const handleAction = (action: StatusAction) => {
    if (action.needsReason === 'decline') {
      const reason = prompt('Motivo da recusa:');
      if (!reason) return;
      onAction(task.id, action.toStatus, {
        declineReason: 'other',
        declineReasonText: reason,
      });
    } else if (action.needsReason === 'block') {
      const reason = prompt('Motivo do bloqueio:');
      if (!reason) return;
      onAction(task.id, action.toStatus, {
        blockReason: 'other',
        blockReasonText: reason,
      });
    } else {
      onAction(task.id, action.toStatus);
    }
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    onDragStart(e, task);
  };

  const handleDelegateSubmit = (name: string, role: string) => {
    onDelegate(task.id, name, role);
    setShowDelegation(false);
  };

  const slaBarOpacity = slaBreached
    ? 'bg-neutral-900'
    : slaAtRisk
      ? 'bg-neutral-800'
      : 'bg-neutral-500';

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      className={[
        'p-0 cursor-grab active:cursor-grabbing transition-opacity',
        slaAtRisk ? 'border-2 border-neutral-400' : '',
        slaBreached ? 'border-2 border-neutral-900' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex">
        <div className="flex items-center justify-center px-2 shrink-0 bg-neutral-50 rounded-l-2xl border-r border-neutral-200">
          <DragHandleIcon />
        </div>

        <div className="flex-1 p-3 space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono font-bold text-sm text-neutral-900">
              {task.shortCode}
            </span>
            <Badge variant="outline" size="sm">
              {PRIORITY_LABEL[task.priority]}
            </Badge>
          </div>

          <p className="text-sm font-medium text-neutral-900 line-clamp-2 leading-snug">
            {task.title}
          </p>

          {task.patientName && (
            <p className="text-xs text-neutral-500 truncate">
              {task.patientName}
              {task.patientMrn ? ` (${task.patientMrn})` : ''}
            </p>
          )}

          <p className="text-xs text-neutral-500">
            {task.ward}
            {task.bed ? ` / Leito ${task.bed}` : ''}
          </p>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wide">SLA</span>
              <span className="text-[10px] font-medium text-neutral-700">{timeRemaining}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-neutral-200">
              <div
                className={`h-2 rounded-full transition-all ${slaBarOpacity}`}
                style={{ width: `${Math.min(slaPercent, 100)}%` }}
              />
            </div>
            {slaBreached && (
              <Badge
                variant="default"
                size="sm"
                className="mt-1 bg-neutral-900 text-white border-neutral-900"
              >
                SLA ESTOURADO
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-neutral-900 truncate">
                {task.assignedTo.name}
              </p>
              <p className="text-[10px] text-neutral-500 truncate">
                {task.assignedTo.role}
              </p>
            </div>
            {task.status !== 'completed' &&
              task.status !== 'verified' &&
              task.status !== 'cancelled' && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDelegation(!showDelegation);
                  }}
                >
                  Delegar
                </Button>
              )}
          </div>

          {showDelegation && (
            <DelegationForm
              onDelegate={handleDelegateSubmit}
              onCancel={() => setShowDelegation(false)}
            />
          )}

          {actions.length > 0 && (
            <div className="flex gap-2 pt-1">
              {actions.map((action) => (
                <Button
                  key={action.toStatus}
                  variant={action.variant}
                  size="xs"
                  className="flex-1"
                  onClick={() => handleAction(action)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Create-task drawer ──────────────────────────────────────────────

interface ChecklistDraft {
  uid: string;
  label: string;
}

function makeChecklistItem(): ChecklistDraft {
  return { uid: Math.random().toString(36).slice(2, 10), label: '' };
}

interface CreateTaskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function CreateTaskDrawer({ open, onOpenChange, onCreated }: CreateTaskDrawerProps) {
  const [subcategory, setSubcategory] = useState<TaskSubcategory>('medicacao');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientMrn, setPatientMrn] = useState('');
  const [ward, setWard] = useState('');
  const [bed, setBed] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [assigneeRole, setAssigneeRole] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [checklist, setChecklist] = useState<ChecklistDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const category = SUBCATEGORY_TO_CATEGORY[subcategory];

  function resetForm() {
    setSubcategory('medicacao');
    setPriority('normal');
    setTitle('');
    setDescription('');
    setInstructions('');
    setPatientName('');
    setPatientMrn('');
    setWard('');
    setBed('');
    setAssigneeName('');
    setAssigneeRole('');
    setAssigneeId('');
    setChecklist([]);
    setErrors({});
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = 'Titulo obrigatorio.';
    if (!ward.trim()) next.ward = 'Ala obrigatoria.';
    if (!assigneeName.trim()) next.assigneeName = 'Nome do destinatario obrigatorio.';
    if (!assigneeRole.trim()) next.assigneeRole = 'Funcao do destinatario obrigatoria.';
    if (!assigneeId.trim()) next.assigneeId = 'ID do destinatario obrigatorio.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const body = {
        type: subcategory,
        category,
        subcategory,
        priority,
        title: title.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        patientName: patientName.trim() || undefined,
        patientMrn: patientMrn.trim() || undefined,
        ward: ward.trim(),
        bed: bed.trim() || undefined,
        assignedTo: {
          id: assigneeId.trim(),
          name: assigneeName.trim(),
          role: assigneeRole.trim(),
        },
        checklistItems: checklist
          .filter((c) => c.label.trim())
          .map((c) => ({ label: c.label.trim() })),
      };

      const res = await fetch('/api/hospital-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrors({ _form: data.error ?? `Erro ${res.status}` });
        return;
      }

      resetForm();
      onCreated();
      onOpenChange(false);
    } catch {
      setErrors({ _form: 'Erro de rede.' });
    } finally {
      setSubmitting(false);
    }
  }

  function addChecklistItem() {
    setChecklist((prev) => [...prev, makeChecklistItem()]);
  }

  function removeChecklistItem(uid: string) {
    setChecklist((prev) => prev.filter((c) => c.uid !== uid));
  }

  function updateChecklistItem(uid: string, label: string) {
    setChecklist((prev) => prev.map((c) => (c.uid === uid ? { ...c, label } : c)));
  }

  const inputClass =
    'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200';
  const labelClass = 'block text-sm font-medium text-neutral-700 mb-1';
  const errorClass = 'text-xs text-neutral-900 mt-1 font-medium';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-xl overflow-y-auto sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle>Criar tarefa</SheetTitle>
          <SheetDescription>
            Preencha os campos abaixo. Campos marcados sao obrigatorios.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 pb-6">
          {errors._form && (
            <div className="rounded border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm text-neutral-900">
              {errors._form}
            </div>
          )}

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-neutral-900">Classificacao</legend>

            <div>
              <label className={labelClass}>Tipo</label>
              <select
                className={inputClass}
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value as TaskSubcategory)}
              >
                {ALL_SUBCATEGORIES.map((sc) => (
                  <option key={sc} value={sc}>
                    {SUBCATEGORY_LABEL[sc]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Categoria</label>
              <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                {CATEGORY_LABEL[category]}
              </div>
            </div>

            <div>
              <label className={labelClass}>Prioridade</label>
              <select
                className={inputClass}
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                {ALL_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_FORM_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-neutral-900">Detalhes</legend>

            <div>
              <label className={labelClass}>Titulo</label>
              <input
                type="text"
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {errors.title && <p className={errorClass}>{errors.title}</p>}
            </div>

            <div>
              <label className={labelClass}>Descricao (opcional)</label>
              <textarea
                className={inputClass}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Instrucoes (opcional)</label>
              <textarea
                className={inputClass}
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-neutral-900">Paciente (opcional)</legend>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Nome do paciente</label>
                <input
                  type="text"
                  className={inputClass}
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>MRN</label>
                <input
                  type="text"
                  className={inputClass}
                  value={patientMrn}
                  onChange={(e) => setPatientMrn(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-neutral-900">Localizacao</legend>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Ala</label>
                <input
                  type="text"
                  className={inputClass}
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                />
                {errors.ward && <p className={errorClass}>{errors.ward}</p>}
              </div>
              <div>
                <label className={labelClass}>Leito (opcional)</label>
                <input
                  type="text"
                  className={inputClass}
                  value={bed}
                  onChange={(e) => setBed(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-neutral-900">Destinatario</legend>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Nome</label>
                <input
                  type="text"
                  className={inputClass}
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                />
                {errors.assigneeName && <p className={errorClass}>{errors.assigneeName}</p>}
              </div>
              <div>
                <label className={labelClass}>Funcao</label>
                <input
                  type="text"
                  className={inputClass}
                  value={assigneeRole}
                  onChange={(e) => setAssigneeRole(e.target.value)}
                />
                {errors.assigneeRole && <p className={errorClass}>{errors.assigneeRole}</p>}
              </div>
              <div>
                <label className={labelClass}>ID</label>
                <input
                  type="text"
                  className={inputClass}
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                />
                {errors.assigneeId && <p className={errorClass}>{errors.assigneeId}</p>}
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-neutral-900">Checklist (opcional)</legend>

            {checklist.map((item, idx) => (
              <div key={item.uid} className="flex items-center gap-2">
                <span className="text-sm text-neutral-500 w-6 text-right">{idx + 1}.</span>
                <input
                  type="text"
                  className={inputClass}
                  value={item.label}
                  onChange={(e) => updateChecklistItem(item.uid, e.target.value)}
                  placeholder="Descricao do item"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => removeChecklistItem(item.uid)}
                >
                  Remover
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}>
              + Adicionar item
            </Button>
          </fieldset>

          <div className="flex items-center gap-3 pt-4 border-t border-neutral-200">
            <Button type="submit" variant="default" disabled={submitting}>
              {submitting ? 'Criando...' : 'Criar tarefa'}
            </Button>
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </SheetClose>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Metricas section ─────────────────────────────────────────────

interface MetricsSectionProps {
  tasks: HospitalTask[];
}

const BLOCK_REASON_LABEL: Record<BlockReason, string> = {
  waiting_lab: 'Aguardando laboratorio',
  waiting_pharmacy: 'Aguardando farmacia',
  waiting_transport: 'Aguardando transporte',
  waiting_cleaning: 'Aguardando higienizacao',
  waiting_equipment: 'Aguardando equipamento',
  waiting_physician: 'Aguardando medico',
  waiting_family: 'Aguardando familia',
  waiting_insurance: 'Aguardando convenio',
  patient_unstable: 'Paciente instavel',
  other: 'Outro',
};

const DECLINE_REASON_LABEL: Record<DeclineReason, string> = {
  not_my_scope: 'Fora do escopo',
  not_my_shift: 'Fora do plantao',
  patient_transferred: 'Paciente transferido',
  already_done: 'Ja executada',
  duplicate: 'Duplicada',
  insufficient_info: 'Info insuficiente',
  resource_unavailable: 'Recurso indisponivel',
  clinical_contraindication: 'Contraindicacao clinica',
  other: 'Outro',
};

function MetricsSection({ tasks }: MetricsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const metrics = useMemo(() => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - DAY_MS;

    const recent = tasks.filter((t) => new Date(t.createdAt).getTime() >= cutoff);
    const recentTerminal = recent.filter((t) => TERMINAL_STATUSES.has(t.status));
    const slaRespected = recentTerminal.filter((t) => !t.sla.breached).length;
    const slaCompliance =
      recentTerminal.length === 0
        ? 100
        : Math.round((slaRespected / recentTerminal.length) * 100);

    // Tempo medio por fase — calculado em tarefas ja concluidas
    const completed = tasks.filter(
      (t) => t.status === 'completed' || t.status === 'verified',
    );

    function avgPhase(getMs: (t: HospitalTask) => number | null): number {
      const samples = completed.map(getMs).filter((v): v is number => v !== null && v > 0);
      if (samples.length === 0) return 0;
      return samples.reduce((a, b) => a + b, 0) / samples.length;
    }

    const avgReceive = avgPhase((t) => {
      if (!t.receivedAt) return null;
      return new Date(t.receivedAt).getTime() - new Date(t.createdAt).getTime();
    });
    const avgAccept = avgPhase((t) => {
      if (!t.acceptedAt || !t.receivedAt) return null;
      return new Date(t.acceptedAt).getTime() - new Date(t.receivedAt).getTime();
    });
    const avgStart = avgPhase((t) => {
      if (!t.startedAt || !t.acceptedAt) return null;
      return new Date(t.startedAt).getTime() - new Date(t.acceptedAt).getTime();
    });
    const avgComplete = avgPhase((t) => {
      if (!t.completedAt || !t.startedAt) return null;
      return new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime();
    });

    // Tarefas por unidade (ala)
    const byWard = new Map<string, number>();
    for (const t of tasks) {
      byWard.set(t.ward, (byWard.get(t.ward) ?? 0) + 1);
    }
    const wardRows = Array.from(byWard.entries())
      .map(([ward, count]) => ({ ward, count }))
      .sort((a, b) => b.count - a.count);
    const wardMax = wardRows[0]?.count ?? 1;

    // Top motivos de bloqueio / recusa
    const blockCounts = new Map<BlockReason, number>();
    const declineCounts = new Map<DeclineReason, number>();
    for (const t of tasks) {
      if (t.blockReason) {
        blockCounts.set(t.blockReason, (blockCounts.get(t.blockReason) ?? 0) + 1);
      }
      if (t.declineReason) {
        declineCounts.set(t.declineReason, (declineCounts.get(t.declineReason) ?? 0) + 1);
      }
    }
    const topBlocks = Array.from(blockCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({
        label: BLOCK_REASON_LABEL[reason],
        count,
      }));
    const topDeclines = Array.from(declineCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({
        label: DECLINE_REASON_LABEL[reason],
        count,
      }));

    return {
      slaCompliance,
      recentTerminalCount: recentTerminal.length,
      avgReceive,
      avgAccept,
      avgStart,
      avgComplete,
      wardRows,
      wardMax,
      topBlocks,
      topDeclines,
    };
  }, [tasks]);

  return (
    <section className="mt-8 border border-neutral-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">Metricas</h2>
          <Badge variant="outline" size="sm">
            SLA 24h: {metrics.slaCompliance}%
          </Badge>
        </div>
        <span className="text-xs text-neutral-500">
          {expanded ? 'Recolher' : 'Expandir'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-neutral-200 p-5 space-y-6">
          {/* SLA compliance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <p className="text-xs uppercase text-neutral-500 tracking-wide">
                SLA cumprido (24h)
              </p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                {metrics.slaCompliance}%
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {metrics.recentTerminalCount} tarefas encerradas
              </p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <p className="text-xs uppercase text-neutral-500 tracking-wide">
                Recebimento medio
              </p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                {formatMinutes(metrics.avgReceive)}
              </p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <p className="text-xs uppercase text-neutral-500 tracking-wide">Aceite medio</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                {formatMinutes(metrics.avgAccept)}
              </p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <p className="text-xs uppercase text-neutral-500 tracking-wide">Conclusao media</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                {formatMinutes(metrics.avgComplete)}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Inicio medio: {formatMinutes(metrics.avgStart)}
              </p>
            </div>
          </div>

          {/* Por unidade + Motivos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Por unidade */}
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">
                Tarefas por unidade
              </h3>
              {metrics.wardRows.length === 0 ? (
                <p className="text-sm text-neutral-500">Sem dados.</p>
              ) : (
                <div className="space-y-2">
                  {metrics.wardRows.map((row) => {
                    const pct = Math.round((row.count / metrics.wardMax) * 100);
                    return (
                      <div key={row.ward} className="flex items-center gap-3">
                        <div className="w-40 shrink-0 text-xs text-neutral-700 truncate">
                          {row.ward}
                        </div>
                        <div className="flex-1 h-3 rounded bg-neutral-100 overflow-hidden">
                          <div
                            className="h-3 bg-neutral-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="w-10 text-right text-xs font-semibold text-neutral-900">
                          {row.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top motivos */}
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">
                Top motivos de bloqueio
              </h3>
              {metrics.topBlocks.length === 0 ? (
                <p className="text-sm text-neutral-500 mb-4">Sem bloqueios registrados.</p>
              ) : (
                <ul className="space-y-2 mb-4">
                  {metrics.topBlocks.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-neutral-700 truncate">{row.label}</span>
                      <span className="text-neutral-900 font-semibold">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="text-sm font-semibold text-neutral-900 mb-3 mt-4 pt-4 border-t border-neutral-100">
                Top motivos de recusa
              </h3>
              {metrics.topDeclines.length === 0 ? (
                <p className="text-sm text-neutral-500">Sem recusas registradas.</p>
              ) : (
                <ul className="space-y-2">
                  {metrics.topDeclines.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-neutral-700 truncate">{row.label}</span>
                      <span className="text-neutral-900 font-semibold">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Main page ──────────────────────────────────────────────────────

interface ApiResponse {
  items: HospitalTask[];
  count: number;
  counts: Partial<Record<TaskStatus, number>>;
}

export default function TarefasPage() {
  const [tasks, setTasks] = useState<HospitalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const col of COLUMNS) {
      if (col.collapsedByDefault) initial[col.key] = true;
    }
    return initial;
  });

  const [draggedTask, setDraggedTask] = useState<HospitalTask | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/hospital-tasks?inbox=true');
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      setTasks(data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ── Action handler ───────────────────────────────────────────────

  const handleAction = useCallback(
    async (taskId: string, toStatus: TaskStatus, extra?: Record<string, string>) => {
      const body: Record<string, string> = { status: toStatus, ...extra };
      const res = await fetch(`/api/hospital-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchTasks();
      }
    },
    [fetchTasks],
  );

  // ── Delegation handler ──────────────────────────────────────────

  const handleDelegate = useCallback(
    async (taskId: string, name: string, role: string) => {
      const body = {
        status: 'reassigned' as const,
        newAssignedTo: { name, role },
      };
      const res = await fetch(`/api/hospital-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchTasks();
      }
    },
    [fetchTasks],
  );

  // ── Drag-and-drop handlers ─────────────────────────────────────

  const handleDragStart = useCallback(
    (_e: DragEvent<HTMLDivElement>, task: HospitalTask) => {
      setDraggedTask(task);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>, targetColumnKey: string) => {
      if (!draggedTask) return;
      const sourceColumnKey = getColumnKeyForTask(draggedTask);
      if (canDropOnColumn(sourceColumnKey, targetColumnKey)) {
        e.preventDefault();
        setDragOverColumn(targetColumnKey);
      }
    },
    [draggedTask],
  );

  const handleDragLeave = useCallback((_e: DragEvent<HTMLDivElement>) => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>, targetColumnKey: string) => {
      e.preventDefault();
      setDragOverColumn(null);

      if (!draggedTask) return;

      const sourceColumnKey = getColumnKeyForTask(draggedTask);
      const transition = getDropTransition(sourceColumnKey, targetColumnKey);

      if (!transition) return;

      if (transition.needsReason === 'block') {
        const reason = prompt('Motivo do bloqueio:');
        if (!reason) {
          setDraggedTask(null);
          return;
        }
        await handleAction(draggedTask.id, transition.toStatus, {
          blockReason: 'other',
          blockReasonText: reason,
        });
      } else {
        await handleAction(draggedTask.id, transition.toStatus);
      }

      setDraggedTask(null);
    },
    [draggedTask, handleAction],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
    setDragOverColumn(null);
  }, []);

  // ── Filtering ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = tasks;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.shortCode.toLowerCase().includes(q) ||
          t.patientName?.toLowerCase().includes(q) ||
          t.patientMrn?.toLowerCase().includes(q) ||
          t.assignedTo.name.toLowerCase().includes(q),
      );
    }
    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter);
    }
    if (categoryFilter !== 'all') {
      result = result.filter((t) => t.category === categoryFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    return [...result].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
  }, [tasks, searchQuery, priorityFilter, categoryFilter, statusFilter]);

  // ── KPIs ─────────────────────────────────────────────────────────

  const inExecutionCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status === 'received' ||
          t.status === 'accepted' ||
          t.status === 'in_progress',
      ).length,
    [tasks],
  );
  const slaAtRiskCount = useMemo(
    () =>
      tasks.filter((t) => {
        if (TERMINAL_STATUSES.has(t.status)) return false;
        return computeSlaPercent(t) >= 80;
      }).length,
    [tasks],
  );
  const blockedCount = useMemo(
    () => tasks.filter((t) => t.status === 'blocked').length,
    [tasks],
  );

  // ── Column toggle ────────────────────────────────────────────────

  const toggleColumn = (key: string) => {
    setCollapsedColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Column data ──────────────────────────────────────────────────

  const columnTasks = useMemo(() => {
    const map: Record<string, HospitalTask[]> = {};
    for (const col of COLUMNS) {
      map[col.key] = filtered.filter((t) => col.statuses.includes(t.status));
    }
    return map;
  }, [filtered]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <AppShell pageTitle="Tarefas">
      {/* KPI strip */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <Badge variant="default" size="lg">
          {inExecutionCount} em execucao
        </Badge>
        <Badge variant="default" size="lg">
          {slaAtRiskCount} SLA em risco
        </Badge>
        <Badge variant="default" size="lg">
          {blockedCount} impedidas
        </Badge>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <Input
          type="text"
          placeholder="Buscar tarefas, pacientes, MRN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
        />

        <select
          className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="all">Todas as prioridades</option>
          <option value="urgent">Urgente</option>
          <option value="high">Alto</option>
          <option value="normal">Normal</option>
          <option value="low">Baixo</option>
        </select>

        <select
          className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">Todas as categorias</option>
          {(Object.entries(CATEGORY_LABEL) as [TaskCategory, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>

        <select
          className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos os status</option>
          <option value="open">Aberta</option>
          <option value="received">Recebida</option>
          <option value="accepted">Aceita</option>
          <option value="in_progress">Em progresso</option>
          <option value="blocked">Impedida</option>
          <option value="completed">Concluida</option>
          <option value="verified">Verificada</option>
        </select>

        <div className="ml-auto">
          <Button variant="default" onClick={() => setCreateOpen(true)}>
            + Criar tarefa
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <KanbanSkeleton />
      ) : (
        <div className="grid grid-cols-5 gap-4" onDragEnd={handleDragEnd}>
          {COLUMNS.map((col) => {
            const items = columnTasks[col.key] ?? [];
            const isCollapsed = collapsedColumns[col.key] ?? false;
            const isDropTarget = dragOverColumn === col.key;
            const isValidTarget = draggedTask
              ? canDropOnColumn(getColumnKeyForTask(draggedTask), col.key)
              : false;

            return (
              <div
                key={col.key}
                className="flex flex-col min-h-0"
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                <button
                  type="button"
                  onClick={() => toggleColumn(col.key)}
                  className="flex items-center gap-2 mb-3 text-left w-full"
                >
                  <h2 className="text-sm font-semibold text-neutral-900">{col.label}</h2>
                  <Badge variant="outline" size="sm">
                    {items.length}
                  </Badge>
                  {col.collapsedByDefault && (
                    <span className="text-xs text-neutral-500 ml-auto">
                      {isCollapsed ? 'Expandir' : 'Recolher'}
                    </span>
                  )}
                </button>

                {!isCollapsed && (
                  <div
                    className={[
                      'space-y-3 overflow-y-auto max-h-[calc(100vh-380px)] rounded-lg p-1 transition-all',
                      isDropTarget
                        ? 'border-2 border-dashed border-neutral-400 bg-neutral-100'
                        : isValidTarget && draggedTask
                          ? 'border-2 border-dashed border-neutral-300 bg-neutral-50'
                          : 'border-2 border-transparent',
                    ].join(' ')}
                  >
                    {items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-center">
                        <p className="text-xs text-neutral-500">Nenhuma tarefa</p>
                      </div>
                    ) : (
                      items.map((task) => (
                        <div
                          key={task.id}
                          className={draggedTask?.id === task.id ? 'opacity-40' : ''}
                        >
                          <TaskCard
                            task={task}
                            onAction={handleAction}
                            onDelegate={handleDelegate}
                            onDragStart={handleDragStart}
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}

                {isCollapsed && items.length > 0 && (
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-center">
                    <p className="text-xs text-neutral-500">{items.length} tarefas concluidas</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-neutral-500 mt-4 text-right">
        Exibindo {filtered.length} de {tasks.length} tarefas
      </div>

      {/* Metricas (colapsavel) */}
      <MetricsSection tasks={tasks} />

      {/* Drawer criar tarefa */}
      <CreateTaskDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchTasks}
      />
    </AppShell>
  );
}
