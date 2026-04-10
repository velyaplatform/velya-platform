'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { ROLE_LABELS, type ProfessionalRole, type ShiftType } from '../../../lib/fixtures/staff';

export default function EmployeeNewPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    role: 'medico' as ProfessionalRole,
    specialty: '',
    council: '',
    ward: '',
    shift: 'manha' as ShiftType,
    shiftStart: '07:00',
    shiftEnd: '19:00',
    contactExtension: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!form.name || !form.ward) {
      setError('Nome e setor são obrigatórios');
      return;
    }
    setSaving(true);
    // Placeholder: in production this posts to /api/employees
    await new Promise((r) => setTimeout(r, 500));
    setMessage(
      'Funcionário cadastrado (modo demonstração — API /api/employees ainda não implementada).',
    );
    setSaving(false);
    setTimeout(() => router.push('/employees'), 1500);
  }

  const input =
    'w-full min-h-[44px] bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400';
  const label = 'text-sm font-medium text-slate-200';

  return (
    <AppShell pageTitle="Novo funcionário">
      <div className="page-header">
        <h1 className="page-title">Novo funcionário</h1>
        <p className="page-subtitle">Cadastre um profissional no quadro da instituição</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-3xl"
      >
        {error && (
          <div
            role="alert"
            className="mb-4 bg-red-950/40 border border-red-700/60 text-red-200 text-sm rounded-md px-4 py-3"
          >
            {error}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="mb-4 bg-green-950/40 border border-green-700/60 text-green-200 text-sm rounded-md px-4 py-3"
          >
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="name" className={label}>
              Nome completo *
            </label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={input}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="role" className={label}>
              Função *
            </label>
            <select
              id="role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as ProfessionalRole })}
              className={`${input} cursor-pointer`}
              required
            >
              {(Object.entries(ROLE_LABELS) as [ProfessionalRole, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="specialty" className={label}>
              Especialidade
            </label>
            <input
              id="specialty"
              type="text"
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              className={input}
              placeholder="Ex: UTI, Cirurgia Geral"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="council" className={label}>
              Registro profissional
            </label>
            <input
              id="council"
              type="text"
              value={form.council}
              onChange={(e) => setForm({ ...form, council: e.target.value })}
              className={input}
              placeholder="Ex: CRM-SP 145332"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ward" className={label}>
              Setor *
            </label>
            <input
              id="ward"
              type="text"
              value={form.ward}
              onChange={(e) => setForm({ ...form, ward: e.target.value })}
              className={input}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="shift" className={label}>
              Turno
            </label>
            <select
              id="shift"
              value={form.shift}
              onChange={(e) => setForm({ ...form, shift: e.target.value as ShiftType })}
              className={`${input} cursor-pointer`}
            >
              <option value="manha">Manhã</option>
              <option value="tarde">Tarde</option>
              <option value="noite">Noite</option>
              <option value="plantao">Plantão</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="shiftStart" className={label}>
              Início do turno
            </label>
            <input
              id="shiftStart"
              type="time"
              value={form.shiftStart}
              onChange={(e) => setForm({ ...form, shiftStart: e.target.value })}
              className={input}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="shiftEnd" className={label}>
              Fim do turno
            </label>
            <input
              id="shiftEnd"
              type="time"
              value={form.shiftEnd}
              onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })}
              className={input}
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="contactExtension" className={label}>
              Ramal
            </label>
            <input
              id="contactExtension"
              type="text"
              value={form.contactExtension}
              onChange={(e) => setForm({ ...form, contactExtension: e.target.value })}
              className={input}
              placeholder="4501"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Link
            href="/employees"
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-slate-800 border border-slate-600 text-slate-100 hover:bg-slate-700 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {saving ? 'Salvando...' : 'Cadastrar funcionário'}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
