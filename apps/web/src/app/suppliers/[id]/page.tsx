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
  ativo: 'bg-neutral-50 text-neutral-900 border-neutral-300',
  'em-revisao': 'bg-neutral-50 text-neutral-700 border-neutral-300',
  suspenso: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  descredenciado: 'bg-neutral-50 text-neutral-500 border-neutral-300',
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
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-900 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
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
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
            >
              ← Voltar
            </Link>
            <Link
              href={`/suppliers/${supplier.id}/edit`}
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-900 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
            >
              Editar
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section
          aria-labelledby="contact-heading"
          className="bg-white border border-neutral-200 rounded-xl p-5"
        >
          <h2
            id="contact-heading"
            className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-4"
          >
            Contato comercial
          </h2>
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Responsável</dt>
              <dd className="text-neutral-900 font-medium">{supplier.contactName}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">E-mail</dt>
              <dd className="text-neutral-900 break-all">
                <a
                  href={`mailto:${supplier.contactEmail}`}
                  className="text-neutral-700 hover:text-neutral-900 underline"
                >
                  {supplier.contactEmail}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Telefone</dt>
              <dd className="text-neutral-900 font-mono">{supplier.contactPhone}</dd>
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="contract-heading"
          className="bg-white border border-neutral-200 rounded-xl p-5"
        >
          <h2
            id="contract-heading"
            className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-4"
          >
            Contrato e SLA
          </h2>
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Vigência</dt>
              <dd className="text-neutral-900">
                {supplier.contractStart} → {supplier.contractEnd}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">SLA de resposta</dt>
              <dd className="text-neutral-900">{supplier.slaResponseHours} horas</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Avaliação de desempenho</dt>
              <dd className="text-neutral-900">{supplier.rating.toFixed(1)} / 5.0</dd>
            </div>
            {supplier.lastDelivery && (
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Última entrega</dt>
                <dd className="text-neutral-900">{supplier.lastDelivery}</dd>
              </div>
            )}
          </dl>
        </section>

        {supplier.notes && (
          <section
            aria-labelledby="notes-heading"
            className="lg:col-span-2 bg-neutral-50 border border-neutral-200 rounded-xl p-5"
          >
            <h2
              id="notes-heading"
              className="text-xs uppercase tracking-wider font-semibold text-neutral-700 mb-2"
            >
              Observacoes internas
            </h2>
            <p className="text-neutral-700 text-sm">{supplier.notes}</p>
          </section>
        )}
      </div>
    </AppShell>
  );
}
