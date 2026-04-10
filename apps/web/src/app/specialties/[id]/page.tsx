'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { FavoriteButton } from '../../components/favorite-button';
import {
  getSpecialtyById,
  SPECIALTY_CATEGORY_LABELS,
} from '../../../lib/fixtures/medical-specialties';
import { STAFF, ROLE_LABELS, PRESENCE_LABELS } from '../../../lib/fixtures/staff';
import { HOSPITAL_WARDS, getOccupancyRate } from '../../../lib/fixtures/hospital-wards';
import { getModuleById } from '../../../lib/module-manifest';

/**
 * Specialty detail page. Shows the full specialty profile, the staff
 * members involved (matched fuzzy on the staff `specialty` text or
 * professional role), and the wards where this specialty operates.
 *
 * Match logic for staff:
 *  - exact match on specialty.name (case insensitive)
 *  - substring match on specialty.id (slug)
 *  - substring match on any of the áreas de atuação
 */
export default function SpecialtyDetailPage() {
  const params = useParams<{ id: string }>();
  const specialty = useMemo(() => getSpecialtyById(params.id), [params.id]);

  // Match staff who work in this specialty
  const involvedStaff = useMemo(() => {
    if (!specialty) return [];
    const tokens = [
      specialty.name.toLowerCase(),
      specialty.id.toLowerCase(),
      ...specialty.areasDeAtuacao.map((a) => a.toLowerCase()),
    ];
    return STAFF.filter((s) => {
      const haystack = `${s.specialty ?? ''} ${s.role}`.toLowerCase();
      return tokens.some((t) => t.length > 2 && haystack.includes(t));
    });
  }, [specialty]);

  // Find wards that list this specialty in their `specialties` array,
  // OR whose name appears in the specialty's typicalWards
  const relatedWards = useMemo(() => {
    if (!specialty) return [];
    const idLower = specialty.id.toLowerCase();
    const nameLower = specialty.name.toLowerCase();
    return HOSPITAL_WARDS.filter((w) => {
      const matchesArray = w.specialties.some(
        (s) => s.toLowerCase() === idLower || s.toLowerCase() === nameLower,
      );
      const matchesName = specialty.typicalWards.some((tw) =>
        w.name.toLowerCase().includes(tw.toLowerCase()),
      );
      return matchesArray || matchesName;
    });
  }, [specialty]);

  if (!specialty) {
    return (
      <AppShell pageTitle="Especialidade não encontrada">
        <div className="page-header">
          <h1 className="page-title">Especialidade não encontrada</h1>
          <p className="page-subtitle">
            A especialidade <strong>{params.id}</strong> não está cadastrada.
          </p>
        </div>
        <Link
          href="/specialties"
          className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          ← Voltar à lista
        </Link>
      </AppShell>
    );
  }

  const onDutyCount = involvedStaff.filter((s) => s.presence === 'on-duty').length;
  const totalAssignedPatients = new Set(
    involvedStaff.flatMap((s) => s.assignedPatientMrns),
  ).size;

  const specialtiesModule = getModuleById('medical-specialties');

  return (
    <AppShell pageTitle={specialty.name}>
      <Breadcrumbs
        module={specialtiesModule}
        recordLabel={specialty.name}
      />
      <div className="page-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-xs text-slate-400">CFM {specialty.cfmCode}</span>
              <span className="text-xs px-2 py-1 rounded-full bg-blue-900/40 text-blue-200 border border-blue-700/60">
                {SPECIALTY_CATEGORY_LABELS[specialty.category]}
              </span>
              <span className="text-xs text-slate-300">
                {specialty.residencyYears} anos de residência
              </span>
            </div>
            <h1 className="page-title">
              <span aria-hidden="true">{'\uD83E\uDE7A'}</span> {specialty.name}
            </h1>
            <p className="page-subtitle">{specialty.description}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/specialties"
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-slate-800 border border-slate-600 text-slate-100 hover:bg-slate-700 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              ← Voltar
            </Link>
            <FavoriteButton
              scope="medical-specialties"
              entry={{
                id: specialty.id,
                label: specialty.name,
                href: `/specialties/${specialty.id}`,
                description: SPECIALTY_CATEGORY_LABELS[specialty.category],
              }}
            />
            <Link
              href={`/edit/medical-specialties/${specialty.id}`}
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Editar
            </Link>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi label="Profissionais envolvidos" value={involvedStaff.length} />
        <Kpi label="Em plantão agora" value={onDutyCount} accent="green" />
        <Kpi label="Pacientes atribuídos" value={totalAssignedPatients} accent="blue" />
        <Kpi label="Alas onde atua" value={relatedWards.length} accent="amber" />
      </div>

      {/* Staff involved */}
      <section
        aria-labelledby="staff-heading"
        className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-4"
      >
        <h2
          id="staff-heading"
          className="text-base font-bold text-slate-100 mb-3 flex items-center gap-2"
        >
          <span aria-hidden="true">{'\uD83D\uDC65'}</span> Funcionários envolvidos (
          {involvedStaff.length})
        </h2>
        {involvedStaff.length === 0 ? (
          <p className="text-sm text-slate-300 text-center py-4">
            Nenhum profissional cadastrado nesta especialidade no quadro atual.
          </p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {involvedStaff.map((s) => {
              const presenceClass =
                s.presence === 'on-duty'
                  ? 'bg-green-900/40 text-green-200 border-green-700/60'
                  : s.presence === 'on-break'
                    ? 'bg-amber-900/40 text-amber-200 border-amber-700/60'
                    : 'bg-slate-800 text-slate-300 border-slate-600';
              return (
                <li key={s.id}>
                  <Link
                    href={`/employees/${s.id}`}
                    className="block bg-slate-800 border border-slate-700 rounded-lg p-4 hover:bg-slate-700 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-100">{s.name}</h3>
                        <p className="text-xs text-slate-300">
                          {ROLE_LABELS[s.role]}
                          {s.specialty && <> · {s.specialty}</>}
                        </p>
                        {s.council && (
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {s.council}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider whitespace-nowrap ${presenceClass}`}
                      >
                        {PRESENCE_LABELS[s.presence]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-300 mt-2">
                      <span>
                        {s.ward} · {s.shiftStart}–{s.shiftEnd}
                      </span>
                      {s.contactExtension && (
                        <span className="font-mono text-blue-300">ramal {s.contactExtension}</span>
                      )}
                    </div>
                    {s.assignedPatientMrns.length > 0 && (
                      <p className="text-[11px] text-slate-400 mt-2">
                        {s.assignedPatientMrns.length} paciente(s) atribuído(s)
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Wards */}
      <section
        aria-labelledby="wards-heading"
        className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-4"
      >
        <h2
          id="wards-heading"
          className="text-base font-bold text-slate-100 mb-3 flex items-center gap-2"
        >
          <span aria-hidden="true">{'\uD83C\uDFE5'}</span> Alas onde atua ({relatedWards.length})
        </h2>
        {relatedWards.length === 0 ? (
          <p className="text-sm text-slate-300">
            Nenhuma ala vinculada — alas típicas:{' '}
            {specialty.typicalWards.join(', ') || 'não informado'}
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relatedWards.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/wards`}
                  className="block bg-slate-800 border border-slate-700 rounded-lg p-3 hover:bg-slate-700 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-100">{w.name}</h3>
                    <span className="text-[10px] text-slate-400">{w.location.sector}</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {w.capacity} leitos · ocupação {getOccupancyRate(w)}% · {w.operatingHours}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Conditions, procedures, exams */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <ListSection
          title="Condições comuns"
          icon="\uD83E\uDE7B"
          items={specialty.commonConditions.map((c) => ({
            primary: c.name,
            secondary: c.code,
          }))}
        />
        <ListSection
          title="Procedimentos comuns"
          icon="\u2695\uFE0F"
          items={specialty.commonProcedures.map((p) => ({
            primary: p.name,
            secondary: p.code,
          }))}
        />
        <ListSection
          title="Exames comuns"
          icon="\uD83E\uDDEA"
          items={specialty.commonExams.map((e) => ({
            primary: e.name,
            secondary: e.code,
          }))}
        />
      </div>

      {/* Áreas de atuação + regulação */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {specialty.areasDeAtuacao.length > 0 && (
          <section
            aria-labelledby="areas-heading"
            className="bg-slate-900 border border-slate-700 rounded-xl p-5"
          >
            <h2
              id="areas-heading"
              className="text-xs uppercase tracking-wider font-semibold text-slate-300 mb-3"
            >
              Áreas de atuação (CFM)
            </h2>
            <ul className="text-sm text-slate-100 list-disc list-inside space-y-1">
              {specialty.areasDeAtuacao.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </section>
        )}
        {specialty.regulatoryBasis.length > 0 && (
          <section
            aria-labelledby="reg-heading"
            className="bg-slate-900 border border-slate-700 rounded-xl p-5"
          >
            <h2
              id="reg-heading"
              className="text-xs uppercase tracking-wider font-semibold text-slate-300 mb-3"
            >
              Base regulatória
            </h2>
            <ul className="text-sm text-slate-100 list-disc list-inside space-y-1">
              {specialty.regulatoryBasis.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'green' | 'amber' | 'blue';
}) {
  const accentClass =
    accent === 'green'
      ? 'text-green-300'
      : accent === 'amber'
        ? 'text-amber-200'
        : accent === 'blue'
          ? 'text-blue-300'
          : 'text-slate-100';
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
        {label}
      </div>
      <div className={`text-3xl font-bold mt-1 ${accentClass}`}>{value}</div>
    </div>
  );
}

function ListSection({
  title,
  icon,
  items,
}: {
  title: string;
  icon: string;
  items: { primary: string; secondary?: string }[];
}) {
  return (
    <section className="bg-slate-900 border border-slate-700 rounded-xl p-5">
      <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <span aria-hidden="true">{icon}</span> {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum item cadastrado.</p>
      ) : (
        <ul className="text-sm text-slate-100 space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-baseline gap-2">
              {item.secondary && (
                <span className="font-mono text-[11px] text-blue-300 shrink-0">
                  {item.secondary}
                </span>
              )}
              <span>{item.primary}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
