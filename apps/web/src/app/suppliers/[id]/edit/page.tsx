'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../../components/app-shell';
import {
  SUPPLIERS,
  CATEGORY_LABELS,
  STATUS_LABELS,
  type SupplierCategory,
  type SupplierStatus,
} from '../../../../lib/fixtures/suppliers';

export default function SupplierEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const original = SUPPLIERS.find((s) => s.id === params.id);

  const [form, setForm] = useState(() => ({
    name: original?.name ?? '',
    cnpj: original?.cnpj ?? '',
    category: (original?.category ?? 'medicamentos') as SupplierCategory,
    status: (original?.status ?? 'ativo') as SupplierStatus,
    contactName: original?.contactName ?? '',
    contactEmail: original?.contactEmail ?? '',
    contactPhone: original?.contactPhone ?? '',
    contractStart: original?.contractStart ?? '',
    contractEnd: original?.contractEnd ?? '',
    slaResponseHours: original?.slaResponseHours ?? 24,
    notes: original?.notes ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!original) {
    return (
      <AppShell pageTitle="Editar fornecedor — registro ausente">
        <div className="page-header">
          <h1 className="page-title">Editar fornecedor — registro ausente</h1>
        </div>
        <Link
          href="/suppliers"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-900 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          ← Voltar aos fornecedores
        </Link>
      </AppShell>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    await new Promise((r) => setTimeout(r, 500));
    setMessage('Alterações registradas (modo demonstração — API /api/suppliers ainda não implementada).');
    setSaving(false);
    setTimeout(() => router.push(`/suppliers/${params.id}`), 1500);
  }

  const input =
    'w-full min-h-[44px] bg-neutral-50 border border-neutral-300 rounded-md px-3 py-2 text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200';
  const label = 'text-sm font-medium text-neutral-700';

  return (
    <AppShell pageTitle={`Editar ${original.name}`}>
      <div className="page-header">
        <h1 className="page-title">Editar fornecedor</h1>
        <p className="page-subtitle">
          {original.name} · CNPJ <span className="font-mono">{original.cnpj}</span>
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-neutral-200 rounded-xl p-5 max-w-3xl"
      >
        {message && (
          <div
            role="status"
            className="mb-4 bg-neutral-50 border border-neutral-200 text-neutral-700 text-sm rounded-md px-4 py-3"
          >
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="name" className={label}>Razão social</label>
            <input id="name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cnpj" className={label}>CNPJ</label>
            <input id="cnpj" type="text" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} className={input} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className={label}>Categoria</label>
            <select id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as SupplierCategory })} className={`${input} cursor-pointer`}>
              {(Object.entries(CATEGORY_LABELS) as [SupplierCategory, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="status" className={label}>Status</label>
            <select id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SupplierStatus })} className={`${input} cursor-pointer`}>
              {(Object.entries(STATUS_LABELS) as [SupplierStatus, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="sla" className={label}>SLA de resposta (horas)</label>
            <input id="sla" type="number" min="1" value={form.slaResponseHours} onChange={(e) => setForm({ ...form, slaResponseHours: Number(e.target.value) })} className={input} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="contactName" className={label}>Contato responsável</label>
            <input id="contactName" type="text" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className={input} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="contactEmail" className={label}>E-mail</label>
            <input id="contactEmail" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className={input} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="contactPhone" className={label}>Telefone</label>
            <input id="contactPhone" type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className={input} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="contractStart" className={label}>Início do contrato</label>
            <input id="contractStart" type="date" value={form.contractStart} onChange={(e) => setForm({ ...form, contractStart: e.target.value })} className={input} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="contractEnd" className={label}>Fim do contrato</label>
            <input id="contractEnd" type="date" value={form.contractEnd} onChange={(e) => setForm({ ...form, contractEnd: e.target.value })} className={input} />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="notes" className={label}>Observações internas</label>
            <textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${input} min-h-[88px]`} rows={3} />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Link
            href={`/suppliers/${original.id}`}
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-900 text-white text-sm font-semibold disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-neutral-200"
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
