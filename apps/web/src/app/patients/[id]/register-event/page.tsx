'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../../components/app-shell';
import { PATIENT_INFO } from '../../../../lib/fixtures/patient-cockpits';

// ---------------------------------------------------------------------------
// Category options
// ---------------------------------------------------------------------------

const EVENT_CATEGORIES = [
  { value: 'emergencia', label: 'Emergencia' },
  { value: 'admissao', label: 'Admissao' },
  { value: 'avaliacao', label: 'Avaliacao Clinica' },
  { value: 'medicacao', label: 'Medicacao' },
  { value: 'exame', label: 'Exame/Resultado' },
  { value: 'evolucao', label: 'Evolucao' },
  { value: 'handoff', label: 'Handoff' },
  { value: 'alerta', label: 'Alerta' },
  { value: 'chamada', label: 'Chamada do Paciente' },
  { value: 'alta', label: 'Alta/Transferencia' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'critico', label: 'Critico' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function getNowLocalIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function RegisterEventPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const patient = PATIENT_INFO[patientId] || {
    name: patientId,
    mrn: patientId,
    ward: '--',
    bed: '--',
  };

  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timestamp, setTimestamp] = useState(getNowLocalIso());
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState('normal');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!category) {
      setError('Selecione uma categoria.');
      return;
    }
    if (!title.trim()) {
      setError('Informe o titulo do evento.');
      return;
    }

    setSubmitting(true);

    try {
      const isoTimestamp = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

      const res = await fetch('/api/patients/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          category,
          title: title.trim(),
          description: description.trim(),
          timestamp: isoTimestamp,
          location: location.trim(),
          priority,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erro ao registrar evento.');
        setSubmitting(false);
        return;
      }

      router.push(`/patients/${patientId}`);
    } catch {
      setError('Erro de conexao. Tente novamente.');
      setSubmitting(false);
    }
  }

  return (
    <AppShell pageTitle="Registrar Evento">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <div className="mb-4">
          <Link
            href={`/patients/${patientId}`}
            className="inline-flex items-center gap-1.5 text-sm text-neutral-700 hover:text-neutral-900 no-underline font-medium"
          >
            {'\u2190'} Voltar para Jornada
          </Link>
        </div>

        {/* Patient info header */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-900 flex items-center justify-center text-lg font-bold shrink-0">
              {patient.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-neutral-900">{patient.name}</h2>
              <p className="text-sm text-neutral-500">
                {patient.mrn} &middot; {patient.ward} &middot; Leito {patient.bed}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm space-y-5">
          <h3 className="text-base font-bold text-neutral-900 mb-1">Novo Evento na Jornada</h3>

          {/* Categoria */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
              Categoria do evento <span className="text-neutral-700">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-neutral-900 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-900"
            >
              <option value="">Selecione uma categoria...</option>
              {EVENT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Titulo */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
              Titulo do evento <span className="text-neutral-700">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Avaliacao medica emergencial"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-neutral-900 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-900 placeholder:text-neutral-500"
            />
          </div>

          {/* Descricao */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
              Descricao detalhada
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Descreva o evento em detalhes..."
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-neutral-900 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-900 placeholder:text-neutral-500 resize-y"
            />
          </div>

          {/* Data/Hora + Local */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Data/Hora
              </label>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-neutral-900 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Local
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: UTI Coronariana, Ala 2A"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-neutral-900 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-900 placeholder:text-neutral-500"
              />
            </div>
          </div>

          {/* Prioridade */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
              Prioridade
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-neutral-900 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-900"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-neutral-50 border border-neutral-300 text-neutral-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className={`
                px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors
                ${submitting
                  ? 'bg-neutral-500 cursor-not-allowed'
                  : 'bg-neutral-900 hover:bg-neutral-900 cursor-pointer'
                }
              `}
            >
              {submitting ? 'Registrando...' : 'Registrar Evento'}
            </button>
            <Link
              href={`/patients/${patientId}`}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-neutral-500 hover:text-white no-underline"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
