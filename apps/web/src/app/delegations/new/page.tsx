'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { PatientAutocomplete } from '../../components/patient-autocomplete';
import { STAFF, ROLE_LABELS } from '../../../lib/fixtures/staff';
import type { DelegationCategory, DelegationPriority } from '@/lib/delegation-store';

export default function NewDelegationPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DelegationCategory>('clinical');
  const [priority, setPriority] = useState<DelegationPriority>('normal');
  const [assignedToId, setAssignedToId] = useState('');
  const [patientMrn, setPatientMrn] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [deliverableInput, setDeliverableInput] = useState('');
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [location, setLocation] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const assignee = STAFF.find((s) => s.id === assignedToId);

  function addDeliverable() {
    const next = deliverableInput.trim();
    if (!next) return;
    setDeliverables((prev) => [...prev, next]);
    setDeliverableInput('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !description.trim() || !assignee) {
      setError('Título, descrição e responsável são obrigatórios');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title,
          description,
          category,
          priority,
          assignedToId: assignee.id,
          assignedToName: assignee.name,
          patientMrn: patientMrn || undefined,
          dueAt: dueAt || undefined,
          deliverables,
          acceptanceCriteria: acceptanceCriteria || undefined,
          location: location || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Erro ${res.status} ao criar delegação`);
        return;
      }
      const data = (await res.json()) as { delegation: { id: string } };
      router.push(`/delegations/${data.delegation.id}`);
    } catch {
      setError('Erro de rede ao criar delegação');
    } finally {
      setSubmitting(false);
    }
  }

  const input =
    'w-full min-h-[44px] bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200';
  const label = 'text-sm font-medium text-neutral-700';

  return (
    <AppShell pageTitle="Nova delegação">
      <div className="page-header">
        <h1 className="page-title">Delegar nova tarefa</h1>
        <p className="page-subtitle">
          A pessoa atribuída será notificada. Toda criação e mudança de status é auditada.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-5 max-w-3xl">
        {error && (
          <div role="alert" className="mb-4 bg-neutral-50 border border-neutral-300 text-neutral-700 text-sm rounded-md px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="title" className={label}>Título *</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={input}
              placeholder="Ex: Avaliar paciente para alta"
              required
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="description" className={label}>Descrição detalhada *</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${input} min-h-[100px]`}
              rows={4}
              placeholder="Contexto, critérios, qualquer informação que a pessoa precisa para concluir"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className={label}>Categoria</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as DelegationCategory)}
              className={`${input} cursor-pointer`}
            >
              <option value="clinical">Clínica</option>
              <option value="administrative">Administrativa</option>
              <option value="pharmacy">Farmácia</option>
              <option value="lab">Laboratório</option>
              <option value="imaging">Imagem</option>
              <option value="transport">Transporte</option>
              <option value="cleaning">Higienização</option>
              <option value="maintenance">Manutenção</option>
              <option value="billing">Faturamento</option>
              <option value="compliance">Compliance</option>
              <option value="other">Outras</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="priority" className={label}>Prioridade</label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as DelegationPriority)}
              className={`${input} cursor-pointer`}
            >
              <option value="urgent">Urgente</option>
              <option value="high">Alta</option>
              <option value="normal">Normal</option>
              <option value="low">Baixa</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="assignee" className={label}>Atribuir a *</label>
            <select
              id="assignee"
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className={`${input} cursor-pointer`}
              required
            >
              <option value="">Selecione um profissional...</option>
              {STAFF.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {ROLE_LABELS[s.role]} ({s.ward})
                </option>
              ))}
            </select>
            {assignee && (
              <p className="text-xs text-neutral-500">
                Ramal: {assignee.contactExtension ?? '—'} · Turno: {assignee.shiftStart}–
                {assignee.shiftEnd}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <PatientAutocomplete
              id="patient"
              label="Paciente (opcional)"
              value={patientMrn}
              onChange={(mrn) => setPatientMrn(mrn)}
              help="Opcional — vincule a delegação a um paciente específico"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="dueAt" className={label}>Prazo</label>
            <input
              id="dueAt"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={input}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="location" className={label}>Local</label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={input}
              placeholder="Ex: UTI Adulto · Leito UTI-03"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="acceptanceCriteria" className={label}>Critérios de aceitação</label>
            <textarea
              id="acceptanceCriteria"
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              className={`${input} min-h-[80px]`}
              rows={3}
              placeholder="O que precisa estar pronto/medido/registrado para considerar a tarefa completa"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="deliverable" className={label}>Entregáveis (checklist)</label>
            <div className="flex gap-2">
              <input
                id="deliverable"
                type="text"
                value={deliverableInput}
                onChange={(e) => setDeliverableInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDeliverable();
                  }
                }}
                className={input}
                placeholder="Adicione um item e pressione Enter"
              />
              <button
                type="button"
                onClick={addDeliverable}
                className="min-h-[44px] px-4 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
              >
                Adicionar
              </button>
            </div>
            {deliverables.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {deliverables.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 text-sm bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2"
                  >
                    <span className="text-neutral-900">{item}</span>
                    <button
                      type="button"
                      onClick={() => setDeliverables((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`Remover ${item}`}
                      className="text-neutral-700 hover:text-neutral-900 text-xs font-bold"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Link
            href="/delegations"
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] inline-flex items-center px-5 py-2 rounded-md bg-neutral-900 hover:bg-neutral-900 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-60"
          >
            {submitting ? 'Criando...' : 'Criar delegação'}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
