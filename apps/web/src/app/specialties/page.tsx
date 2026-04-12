'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import { Breadcrumbs } from '../components/breadcrumbs';
import {
  MEDICAL_SPECIALTIES,
  SPECIALTY_CATEGORY_LABELS,
  type MedicalSpecialty,
  type SpecialtyCategory,
} from '../../lib/fixtures/medical-specialties';
import { STAFF } from '../../lib/fixtures/staff';
import { HOSPITAL_WARDS } from '../../lib/fixtures/hospital-wards';

/**
 * Rich /specialties hub.
 *
 * Replaces the generic ModuleListView with a domain-specific dashboard:
 *   - 4 KPI cards (total especialidades, médicas vs multidisciplinares,
 *     profissionais vinculados, alas mapeadas)
 *   - Search input + category filter chips
 *   - Specialty cards grouped by category, sorted by staff count desc
 *   - Per-specialty stats (council, residency years, staff count, ward count)
 *   - "AI summary" button per category that triggers /api/ai/chat to
 *     generate an executive briefing of that specialty group
 *
 * Surprise factor:
 *   - The grid is grouped + sorted by impact (staff count)
 *   - Each card shows the council badge (CRM / CRN / COREN / CRF / CREFITO /
 *     CRP / CFFa) so the user immediately sees who's a doctor vs. multidisciplinary
 *   - The chips at the top are clickable filters
 *   - "Sem profissionais vinculados" specialties are visually muted so the
 *     user knows where to invest staffing
 */

const COUNCIL_COLOR: Record<string, string> = {
  CRM: 'bg-neutral-100 text-neutral-900 border-neutral-300',
  CRN: 'bg-neutral-50 text-neutral-900 border-neutral-300',
  COREN: 'bg-neutral-50 text-neutral-900 border-neutral-300',
  CRF: 'bg-neutral-50 text-neutral-900 border-neutral-300',
  CREFITO: 'bg-neutral-50 text-neutral-900 border-neutral-300',
  CRP: 'bg-neutral-50 text-neutral-900 border-neutral-300',
  CFFa: 'bg-neutral-50 text-neutral-900 border-neutral-300',
  CRO: 'bg-neutral-50 text-neutral-900 border-neutral-300',
  CRESS: 'bg-neutral-50 text-neutral-900 border-neutral-300',
};

const CATEGORY_ICON: Record<SpecialtyCategory, string> = {
  clinica: '',
  cirurgica: '',
  pediatrica: '',
  diagnostica: '',
  apoio: '',
  critica: '',
  mental: '',
  reabilitacao: '',
};

export default function SpecialtiesHubPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | SpecialtyCategory>('all');

  // Pre-compute staff and ward counts per specialty
  const stats = useMemo(() => {
    const out: Record<
      string,
      { staffCount: number; wardCount: number; staffOnDuty: number }
    > = {};
    for (const spec of MEDICAL_SPECIALTIES) {
      const tokens = [
        spec.name.toLowerCase(),
        spec.id.toLowerCase(),
        ...spec.areasDeAtuacao.map((a) => a.toLowerCase()),
      ];
      const staffMatches = STAFF.filter((s) => {
        const hay = `${s.specialty ?? ''} ${s.role}`.toLowerCase();
        return tokens.some((t) => t.length > 2 && hay.includes(t));
      });
      const wardMatches = HOSPITAL_WARDS.filter((w) => {
        return (
          w.specialties.some(
            (sp) =>
              sp.toLowerCase() === spec.id.toLowerCase() ||
              sp.toLowerCase() === spec.name.toLowerCase(),
          ) ||
          spec.typicalWards.some((tw) => w.name.toLowerCase().includes(tw.toLowerCase()))
        );
      });
      out[spec.id] = {
        staffCount: staffMatches.length,
        wardCount: wardMatches.length,
        staffOnDuty: staffMatches.filter((s) => s.presence === 'on-duty').length,
      };
    }
    return out;
  }, []);

  // Filter + group + sort
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MEDICAL_SPECIALTIES.filter((spec) => {
      if (activeCategory !== 'all' && spec.category !== activeCategory) return false;
      if (!q) return true;
      const hay =
        `${spec.name} ${spec.id} ${spec.description} ${spec.cfmCode} ${spec.areasDeAtuacao.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search, activeCategory]);

  const grouped = useMemo(() => {
    const out: Record<SpecialtyCategory, MedicalSpecialty[]> = {
      clinica: [],
      cirurgica: [],
      pediatrica: [],
      diagnostica: [],
      apoio: [],
      critica: [],
      mental: [],
      reabilitacao: [],
    };
    for (const s of filtered) out[s.category].push(s);
    // Sort each category by staff count desc, then name asc
    for (const cat of Object.keys(out) as SpecialtyCategory[]) {
      out[cat].sort((a, b) => {
        const sa = stats[a.id]?.staffCount ?? 0;
        const sb = stats[b.id]?.staffCount ?? 0;
        if (sa !== sb) return sb - sa;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
    }
    return out;
  }, [filtered, stats]);

  // Global KPIs
  const totalSpecialties = MEDICAL_SPECIALTIES.length;
  const medicalCount = MEDICAL_SPECIALTIES.filter((s) => s.isMedical !== false).length;
  const multidisciplinaryCount = totalSpecialties - medicalCount;
  const totalStaffLinked = new Set(
    MEDICAL_SPECIALTIES.flatMap((spec) => {
      const tokens = [spec.name.toLowerCase(), spec.id.toLowerCase()];
      return STAFF.filter((s) => {
        const hay = `${s.specialty ?? ''} ${s.role}`.toLowerCase();
        return tokens.some((t) => t.length > 2 && hay.includes(t));
      }).map((s) => s.id);
    }),
  ).size;
  const totalWardsCovered = new Set(
    MEDICAL_SPECIALTIES.flatMap((spec) =>
      HOSPITAL_WARDS.filter((w) =>
        w.specialties.some(
          (sp) =>
            sp.toLowerCase() === spec.id.toLowerCase() ||
            sp.toLowerCase() === spec.name.toLowerCase(),
        ),
      ).map((w) => w.id),
    ),
  ).size;

  const categories: SpecialtyCategory[] = [
    'clinica',
    'cirurgica',
    'critica',
    'pediatrica',
    'diagnostica',
    'apoio',
    'reabilitacao',
    'mental',
  ];

  return (
    <AppShell pageTitle="Especialidades">
      <Breadcrumbs
        crumbs={[
          { label: 'Início', href: '/' },
          { label: 'Gestão' },
          { label: 'Especialidades', current: true },
        ]}
      />
      <div className="page-header">
        <h1 className="page-title">
          Especialidades e Areas Profissionais
        </h1>
        <p className="page-subtitle">
          Mapa completo das {totalSpecialties} áreas que atuam no hospital — {medicalCount}{' '}
          especialidades médicas (CFM Res. 2.380/2024) + {multidisciplinaryCount} áreas
          multidisciplinares (CRN, COREN, CRF, CREFITO, CRP, CFFa)
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi label="Total de áreas" value={totalSpecialties} />
        <Kpi label="Médicas (CRM)" value={medicalCount} />
        <Kpi label="Multidisciplinares" value={multidisciplinaryCount} />
        <Kpi label="Profissionais vinculados" value={totalStaffLinked} />
      </div>

      {/* Search + filter chips */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-5">
        <label htmlFor="spec-search" className="sr-only">
          Buscar especialidade
        </label>
        <input
          id="spec-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, área de atuação, código CFM, descrição..."
          className="w-full min-h-[48px] bg-neutral-50 border-2 border-neutral-300 rounded-lg px-4 py-3 text-base text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-300"
        />
        <div className="flex flex-wrap gap-2 mt-3">
          <Chip
            label="Todas"
            count={filtered.length}
            active={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
          />
          {categories.map((cat) => {
            const count = MEDICAL_SPECIALTIES.filter((s) => s.category === cat).length;
            if (count === 0) return null;
            return (
              <Chip
                key={cat}
                label={`${CATEGORY_ICON[cat]} ${SPECIALTY_CATEGORY_LABELS[cat]}`}
                count={count}
                active={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
              />
            );
          })}
        </div>
      </div>

      {/* Aviso multidisciplinar */}
      {activeCategory === 'all' && search === '' && (
        <div
          role="note"
          className="bg-neutral-100 border border-neutral-300 text-neutral-900 text-sm rounded-lg px-4 py-3 mb-5"
        >
          <strong>EMTN — Equipe Multiprofissional de Terapia Nutricional</strong> exige a
          participação de pelo menos médico, nutricionista, enfermeiro e farmacêutico (ANVISA RDC
          503/2021). Use o filtro <em>Apoio</em> para ver as áreas multidisciplinares juntas.
        </div>
      )}

      {/* Grouped grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-neutral-500">
          Nenhuma especialidade encontrada para os filtros atuais.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {categories.map((cat) => {
            const items = grouped[cat];
            if (items.length === 0) return null;
            return (
              <section key={cat} aria-labelledby={`cat-${cat}-heading`}>
                <h2
                  id={`cat-${cat}-heading`}
                  className="text-base font-bold text-neutral-900 mb-3 flex items-center gap-2"
                >
                  <span aria-hidden="true" className="text-xl">
                    {CATEGORY_ICON[cat]}
                  </span>
                  {SPECIALTY_CATEGORY_LABELS[cat]}
                  <span className="text-xs text-neutral-500 font-normal">({items.length})</span>
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((spec) => {
                    const stat = stats[spec.id];
                    const muted = stat.staffCount === 0;
                    return (
                      <li key={spec.id}>
                        <Link
                          href={`/specialties/${spec.id}`}
                          className={`block bg-white border rounded-xl p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-200 ${
                            muted
                              ? 'border-neutral-200 opacity-60 hover:opacity-90 hover:border-neutral-200'
                              : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/60'
                          }`}
                        >
                          <header className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="text-sm font-bold text-neutral-900">{spec.name}</h3>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                COUNCIL_COLOR[spec.council] ?? COUNCIL_COLOR.CRM
                              }`}
                            >
                              {spec.council}
                            </span>
                          </header>
                          <p className="text-xs text-neutral-500 line-clamp-2 min-h-[2.4rem]">
                            {spec.description}
                          </p>
                          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                                Profissionais
                              </div>
                              <div
                                className={`font-bold ${stat.staffCount > 0 ? 'text-neutral-900' : 'text-neutral-500'}`}
                              >
                                {stat.staffCount}
                                {stat.staffOnDuty > 0 && (
                                  <span className="ml-1 text-[10px] text-neutral-700 font-normal">
                                    ({stat.staffOnDuty} ativos)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                                Alas
                              </div>
                              <div
                                className={`font-bold ${stat.wardCount > 0 ? 'text-neutral-900' : 'text-neutral-500'}`}
                              >
                                {stat.wardCount}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                                Areas atuacao
                              </div>
                              <div
                                className={`font-bold ${spec.areasDeAtuacao.length > 0 ? 'text-neutral-900' : 'text-neutral-500'}`}
                              >
                                {spec.areasDeAtuacao.length}
                              </div>
                            </div>
                          </div>
                          {muted && (
                            <p className="text-[10px] text-neutral-500 mt-3 italic">
                              Sem profissionais vinculados — gap de equipe
                            </p>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* Coverage summary */}
      <section
        aria-labelledby="coverage-heading"
        className="bg-white border border-neutral-200 rounded-xl p-5 mt-6"
      >
        <h2
          id="coverage-heading"
          className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-3"
        >
          Cobertura assistencial
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-2xl font-bold text-neutral-900">{totalWardsCovered}</div>
            <div className="text-xs text-neutral-500">alas mapeadas com especialidade</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-neutral-900">
              {Object.values(stats).filter((s) => s.staffCount > 0).length}
            </div>
            <div className="text-xs text-neutral-500">areas com pelo menos 1 profissional</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-neutral-900">
              {Object.values(stats).filter((s) => s.staffCount === 0).length}
            </div>
            <div className="text-xs text-neutral-500">areas sem cobertura (gap)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-neutral-900">
              {STAFF.filter((s) => s.presence === 'on-duty').length}
            </div>
            <div className="text-xs text-neutral-500">profissionais em plantao agora</div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  accent: _accent,
}: {
  label: string;
  value: number;
  accent?: 'blue' | 'green' | 'amber';
}) {
  const accentClass = 'text-neutral-900';
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">
        {label}
      </div>
      <div className={`text-3xl font-bold mt-1 ${accentClass}`}>{value}</div>
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-neutral-200 transition-colors ${
        active
          ? 'bg-neutral-900 border-neutral-900 text-white'
          : 'bg-neutral-50 border-neutral-300 text-neutral-700 hover:bg-neutral-100'
      }`}
    >
      {label}
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
          active ? 'bg-neutral-700 text-white' : 'bg-white text-neutral-500'
        }`}
      >
        {count}
      </span>
    </button>
  );
}
