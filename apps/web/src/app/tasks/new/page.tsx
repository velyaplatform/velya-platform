'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import type {
  TaskCategory,
  TaskSubcategory,
  TaskPriority,
} from '@/lib/hospital-task-types';

/* ── Subcategory → category mapping ──────────────────────────────── */

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

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  assistencial: 'Assistencial',
  apoio: 'Apoio',
  administrativo: 'Administrativo',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
};

const ALL_PRIORITIES: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];

/* ── Checklist item ──────────────────────────────────────────────── */

interface ChecklistDraft {
  uid: string;
  label: string;
}

function makeChecklistItem(): ChecklistDraft {
  return { uid: Math.random().toString(36).slice(2, 10), label: '' };
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function NewTaskPage() {
  const router = useRouter();

  const [subcategory, setSubcategory] = useState<TaskSubcategory>('medicacao');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');

  // Patient
  const [patientName, setPatientName] = useState('');
  const [patientMrn, setPatientMrn] = useState('');

  // Location
  const [ward, setWard] = useState('');
  const [bed, setBed] = useState('');

  // Assignee
  const [assigneeName, setAssigneeName] = useState('');
  const [assigneeRole, setAssigneeRole] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistDraft[]>([]);

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const category = SUBCATEGORY_TO_CATEGORY[subcategory];

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

      const data = (await res.json()) as { task: { id: string } };
      router.push(`/tasks/${data.task.id}`);
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
    'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900';
  const labelClass = 'block text-sm font-medium text-neutral-700 mb-1';
  const errorClass = 'text-xs text-neutral-900 mt-1 font-medium';

  return (
    <AppShell pageTitle="Nova Tarefa">
      <div className="max-w-2xl">
        <Link
          href="/tasks"
          className="inline-block text-sm text-neutral-500 hover:text-neutral-900 mb-4"
        >
          ← Voltar para tarefas
        </Link>

        <h2 className="text-xl font-semibold text-neutral-900 mb-6">Criar Nova Tarefa</h2>

        {errors._form && (
          <div className="rounded border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm text-neutral-900 mb-4">
            {errors._form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Tipo e Categoria */}
          <fieldset className="space-y-4">
            <legend className="text-base font-semibold text-neutral-900 mb-2">
              Classificacao
            </legend>

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
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          {/* Detalhes */}
          <fieldset className="space-y-4">
            <legend className="text-base font-semibold text-neutral-900 mb-2">
              Detalhes
            </legend>

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

          {/* Paciente */}
          <fieldset className="space-y-4">
            <legend className="text-base font-semibold text-neutral-900 mb-2">
              Paciente (opcional)
            </legend>

            <div className="grid grid-cols-2 gap-4">
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

          {/* Localizacao */}
          <fieldset className="space-y-4">
            <legend className="text-base font-semibold text-neutral-900 mb-2">
              Localizacao
            </legend>

            <div className="grid grid-cols-2 gap-4">
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

          {/* Destinatario */}
          <fieldset className="space-y-4">
            <legend className="text-base font-semibold text-neutral-900 mb-2">
              Destinatario
            </legend>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Nome</label>
                <input
                  type="text"
                  className={inputClass}
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                />
                {errors.assigneeName && (
                  <p className={errorClass}>{errors.assigneeName}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Funcao</label>
                <input
                  type="text"
                  className={inputClass}
                  value={assigneeRole}
                  onChange={(e) => setAssigneeRole(e.target.value)}
                />
                {errors.assigneeRole && (
                  <p className={errorClass}>{errors.assigneeRole}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>ID</label>
                <input
                  type="text"
                  className={inputClass}
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                />
                {errors.assigneeId && (
                  <p className={errorClass}>{errors.assigneeId}</p>
                )}
              </div>
            </div>
          </fieldset>

          {/* Checklist */}
          <fieldset className="space-y-4">
            <legend className="text-base font-semibold text-neutral-900 mb-2">
              Checklist (opcional)
            </legend>

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
                <button
                  type="button"
                  className="btn btn-outline btn-sm shrink-0"
                  onClick={() => removeChecklistItem(item.uid)}
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={addChecklistItem}
            >
              + Adicionar item
            </button>
          </fieldset>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-4 border-t border-neutral-200">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Criando...' : 'Criar Tarefa'}
            </button>
            <Link href="/tasks" className="btn btn-ghost">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
