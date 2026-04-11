'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import {
  SUPPLIERS,
  CATEGORY_LABELS,
  STATUS_LABELS,
  type SupplierStatus,
} from '../../../lib/fixtures/suppliers';

const STATUS_BADGE: Record<SupplierStatus, string> = {
  ativo: 'bg-green-50/40 text-green-800 border-green-700/60',
  'em-revisao': 'bg-amber-50/40 text-amber-800 border-amber-700/60',
  suspenso: 'bg-red-50/40 text-red-800 border-red-700/60',
  descredenciado: 'bg-slate-50 text-slate-600 border-slate-300',
};

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const supplier = SUPPLIERS.find((s) => s.id === params.id);

  if (!supplier) {
    return (
      <AppShell pageTitle="Fornecedor não encontrado">
        <div className="page-header">
          <h1 className="page-title">Fornecedor não encontrado</h1>
          <p className="page-subtitle">
            Nenhum cadastro com o identificador <strong>{params.id}</strong>.
          </p>
        </div>
        <Link
          href="/suppliers"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          ← Voltar aos fornecedores
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle={supplier.name}>
      <div className="page-header">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title">{supplier.name}</h1>
            <p className="page-subtitle">
              {CATEGORY_LABELS[supplier.category]} · CNPJ {supplier.cnpj}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <span
              className={`text-[11px] px-2 py-1 rounded-full border font-semibold uppercase tracking-wider ${STATUS_BADGE[supplier.status]}`}
            >
              {STATUS_LABELS[supplier.status]}
            </span>
            <Link
              href="/suppliers"
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-slate-50 border border-slate-300 text-slate-900 hover:bg-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              ← Voltar
            </Link>
            <Link
              href={`/suppliers/${supplier.id}/edit`}
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Editar
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section
          aria-labelledby="contact-heading"
          className="bg-white border border-slate-200 rounded-xl p-5"
        >
          <h2
            id="contact-heading"
            className="text-xs uppercase tracking-wider font-semibold text-slate-600 mb-4"
          >
            Contato comercial
          </h2>
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Responsável</dt>
              <dd className="text-slate-900 font-medium">{supplier.contactName}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">E-mail</dt>
              <dd className="text-slate-900 break-all">
                <a
                  href={`mailto:${supplier.contactEmail}`}
                  className="text-blue-700 hover:text-blue-800 underline"
                >
                  {supplier.contactEmail}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Telefone</dt>
              <dd className="text-slate-900 font-mono">{supplier.contactPhone}</dd>
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="contract-heading"
          className="bg-white border border-slate-200 rounded-xl p-5"
        >
          <h2
            id="contract-heading"
            className="text-xs uppercase tracking-wider font-semibold text-slate-600 mb-4"
          >
            Contrato e SLA
          </h2>
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Vigência</dt>
              <dd className="text-slate-900">
                {supplier.contractStart} → {supplier.contractEnd}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">SLA de resposta</dt>
              <dd className="text-slate-900">{supplier.slaResponseHours} horas</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Avaliação de desempenho</dt>
              <dd className="text-slate-900">{supplier.rating.toFixed(1)} / 5.0</dd>
            </div>
            {supplier.lastDelivery && (
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Última entrega</dt>
                <dd className="text-slate-900">{supplier.lastDelivery}</dd>
              </div>
            )}
          </dl>
        </section>

        {supplier.notes && (
          <section
            aria-labelledby="notes-heading"
            className="lg:col-span-2 bg-amber-950/30 border border-amber-700/60 rounded-xl p-5"
          >
            <h2
              id="notes-heading"
              className="text-xs uppercase tracking-wider font-semibold text-amber-800 mb-2"
            >
              Observações internas
            </h2>
            <p className="text-amber-800 text-sm">{supplier.notes}</p>
          </section>
        )}
      </div>
    </AppShell>
  );
}
