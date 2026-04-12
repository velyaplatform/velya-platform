'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { STAFF, ROLE_LABELS, PRESENCE_LABELS } from '../../../lib/fixtures/staff';
import { getPatientByMrn } from '../../../lib/fixtures/patients';

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const employee = STAFF.find((s) => s.id === params.id);

  if (!employee) {
    return (
      <AppShell pageTitle="Funcionário não encontrado">
        <div className="page-header">
          <h1 className="page-title">Funcionário não encontrado</h1>
          <p className="page-subtitle">
            Nenhum cadastro encontrado com a matrícula <strong>{params.id}</strong>.
          </p>
        </div>
        <Link
          href="/employees"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-900 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          ← Voltar ao cadastro
        </Link>
      </AppShell>
    );
  }

  const assignedPatients = employee.assignedPatientMrns
    .map((mrn) => getPatientByMrn(mrn))
    .filter((p): p is NonNullable<typeof p> => p != null);

  return (
    <AppShell pageTitle={employee.name}>
      <div className="page-header">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title">{employee.name}</h1>
            <p className="page-subtitle">
              {ROLE_LABELS[employee.role]}
              {employee.specialty && <> · {employee.specialty}</>}
              {employee.council && <> · {employee.council}</>}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/employees"
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
            >
              ← Voltar
            </Link>
            <Link
              href={`/employees/${employee.id}/edit`}
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-900 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
            >
              Editar
            </Link>
          </div>
        </div>
      </div>

      {/* Identification card */}
      <section
        aria-labelledby="identity-heading"
        className="bg-white border border-neutral-200 rounded-xl p-5 mb-5"
      >
        <h2 id="identity-heading" className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-4">
          Identificação
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Matrícula</dt>
            <dd className="text-neutral-900 font-mono">{employee.id}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Função</dt>
            <dd className="text-neutral-900">{ROLE_LABELS[employee.role]}</dd>
          </div>
          {employee.specialty && (
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Especialidade</dt>
              <dd className="text-neutral-900">{employee.specialty}</dd>
            </div>
          )}
          {employee.council && (
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Registro Profissional</dt>
              <dd className="text-neutral-900 font-mono">{employee.council}</dd>
            </div>
          )}
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Setor</dt>
            <dd className="text-neutral-900">{employee.ward}</dd>
          </div>
          {employee.contactExtension && (
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Ramal</dt>
              <dd className="text-neutral-900 font-mono">{employee.contactExtension}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Shift card */}
      <section
        aria-labelledby="shift-heading"
        className="bg-white border border-neutral-200 rounded-xl p-5 mb-5"
      >
        <h2 id="shift-heading" className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-4">
          Escala e presença
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Turno</dt>
            <dd className="text-neutral-900">
              {employee.shift} · {employee.shiftStart}–{employee.shiftEnd}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Status</dt>
            <dd className="text-neutral-900">{PRESENCE_LABELS[employee.presence]}</dd>
          </div>
          {employee.lastBadgeAt && (
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Último acesso (crachá)</dt>
              <dd className="text-neutral-900">{employee.lastBadgeAt}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Assigned patients */}
      <section
        aria-labelledby="patients-heading"
        className="bg-white border border-neutral-200 rounded-xl p-5"
      >
        <h2 id="patients-heading" className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-4">
          Pacientes atribuídos ({assignedPatients.length})
        </h2>
        {assignedPatients.length === 0 ? (
          <p className="text-neutral-500 text-sm">Nenhum paciente sob cuidado direto no momento.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {assignedPatients.map((p) => (
              <li key={p.mrn}>
                <Link
                  href={`/patients/${p.mrn}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-md bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                >
                  <span className="font-mono text-xs text-neutral-700">{p.mrn}</span>
                  <span className="text-neutral-900 font-medium">{p.name}</span>
                  <span className="text-xs text-neutral-500">
                    {p.age} anos · {p.ward} {p.bed && `· ${p.bed}`}
                  </span>
                  <span className="text-xs text-neutral-500 ml-auto truncate">{p.diagnosis}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
