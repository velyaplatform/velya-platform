'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import { Badge, Button, Card, CardContent, CardHeader } from '../components/ui';
import {
  TURNOS,
  PRESENCAS_FISICAS,
  INTERNACOES,
  UNIDADES_ASSISTENCIAIS,
  HEALTHCARE_SERVICES,
  getProfissionalById,
  getPractitionerRoleById,
  getUnidadeById,
  getEspecialidadeById,
  FIXTURE_DATE_ISO,
} from '../../lib/fixtures/hospital-core';
import type {
  Especialidade,
  PractitionerRole,
  PractitionerRoleCodigo,
  PresencaStatus,
  ProfissionalSaude,
  Turno,
  UnidadeAssistencial,
} from '../../lib/hospital-core-types';

/**
 * Staff-on-duty hub — replaces the old STAFF fixture with turno-based
 * lookups against hospital-core. Every join is ID-based.
 *
 *   on_duty_rows = TURNOS.filter(status === 'em_andamento')
 *     .map(join PractitionerRole, ProfissionalSaude, UnidadeAssistencial,
 *          PresencaFisica by turnoId)
 */

type GroupingMode = 'unidade' | 'categoria' | 'especialidade';
type StaffCategory = 'medicos' | 'enfermeiros' | 'tecnicos' | 'multi';

const ROLE_CODIGO_LABEL: Record<PractitionerRoleCodigo, string> = {
  assistente: 'Assistente',
  plantonista: 'Plantonista',
  diarista: 'Diarista',
  coordenador_unidade: 'Coordenador de unidade',
  chefe_servico: 'Chefe de servico',
  preceptor: 'Preceptor',
  residente: 'Residente',
  interno: 'Interno',
  responsavel_tecnico: 'Responsavel tecnico',
  enfermeiro_assistencial: 'Enfermeiro assistencial',
  enfermeiro_coordenador: 'Enfermeiro coordenador',
  tecnico: 'Tecnico',
  auxiliar: 'Auxiliar',
};

const PRESENCA_LABEL: Record<PresencaStatus, string> = {
  presente: 'Presente',
  em_pausa: 'Em pausa',
  off_turno: 'Fora do turno',
  ausente: 'Ausente',
};

const MEDICO_CATEGORIAS = new Set(['medico', 'diretor_clinico', 'diretor_tecnico']);
const ENFERMEIRO_CATEGORIAS = new Set(['enfermeiro']);
const TECNICO_CATEGORIAS = new Set([
  'tecnico_enfermagem',
  'auxiliar_enfermagem',
  'tecnico_radiologia',
]);

function classifyCategoria(cat: ProfissionalSaude['categoria']): StaffCategory {
  if (MEDICO_CATEGORIAS.has(cat)) return 'medicos';
  if (ENFERMEIRO_CATEGORIAS.has(cat)) return 'enfermeiros';
  if (TECNICO_CATEGORIAS.has(cat)) return 'tecnicos';
  return 'multi';
}

interface DutyRow {
  turno: Turno;
  role: PractitionerRole;
  profissional: ProfissionalSaude;
  unidade: UnidadeAssistencial;
  presenceStatus: PresencaStatus;
  presenceUnidadeId?: string;
  especialidades: Especialidade[];
  category: StaffCategory;
  pacientesAssignedCount: number;
}

function formatHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function parseRatio(ratio: string): number | null {
  const m = ratio.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  const prof = Number(m[1]);
  const leitos = Number(m[2]);
  if (!prof || !leitos) return null;
  return prof / leitos;
}

export default function StaffOnDutyPage() {
  const [grouping, setGrouping] = useState<GroupingMode>('unidade');

  const dutyRows: DutyRow[] = useMemo(() => {
    const rows: DutyRow[] = [];
    for (const turno of TURNOS) {
      if (turno.status !== 'em_andamento') continue;
      const role = getPractitionerRoleById(turno.practitionerRoleId);
      if (!role || !role.ativo) continue;
      const profissional = getProfissionalById(role.profissionalId);
      if (!profissional) continue;
      const unidade = getUnidadeById(turno.unidadeId);
      if (!unidade) continue;

      const presenca = PRESENCAS_FISICAS.find((p) => p.turnoId === turno.id);
      const especialidades = role.especialidadeIds
        .map((id) => getEspecialidadeById(id))
        .filter((e): e is Especialidade => Boolean(e));

      const pacientesAssignedCount = INTERNACOES.filter(
        (i) =>
          i.status !== 'alta_completada' &&
          (i.medicoAssistenteRoleId === role.id ||
            i.consultores.some((c) => c.roleId === role.id)),
      ).length;

      rows.push({
        turno,
        role,
        profissional,
        unidade,
        presenceStatus: presenca?.status ?? 'off_turno',
        presenceUnidadeId: presenca?.unidadeAtualId,
        especialidades,
        category: classifyCategoria(profissional.categoria),
        pacientesAssignedCount,
      });
    }
    return rows;
  }, []);

  // KPI counts
  const totalOnDuty = dutyRows.length;
  const presentCount = dutyRows.filter((r) => r.presenceStatus === 'presente').length;

  const medicosPorEspecialidade = useMemo(() => {
    const counts = new Map<string, { especialidade: Especialidade; count: number }>();
    for (const row of dutyRows) {
      if (row.category !== 'medicos') continue;
      for (const esp of row.especialidades) {
        const existing = counts.get(esp.id);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(esp.id, { especialidade: esp, count: 1 });
        }
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [dutyRows]);

  const enfermagemBreakdown = useMemo(() => {
    let coord = 0;
    let assist = 0;
    let tec = 0;
    for (const row of dutyRows) {
      if (row.category === 'enfermeiros') {
        if (row.role.codigo === 'enfermeiro_coordenador') coord += 1;
        else assist += 1;
      } else if (row.category === 'tecnicos') {
        tec += 1;
      }
    }
    return { coord, assist, tec };
  }, [dutyRows]);

  const multiCount = useMemo(
    () => dutyRows.filter((r) => r.category === 'multi').length,
    [dutyRows],
  );

  const medicosTotal = useMemo(
    () => dutyRows.filter((r) => r.category === 'medicos').length,
    [dutyRows],
  );

  // Grouping
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; rows: DutyRow[] }>();
    for (const row of dutyRows) {
      let key = '';
      let label = '';
      if (grouping === 'unidade') {
        key = row.unidade.id;
        label = row.unidade.nome;
      } else if (grouping === 'categoria') {
        key = row.category;
        label =
          row.category === 'medicos'
            ? 'Medicos'
            : row.category === 'enfermeiros'
              ? 'Enfermeiros'
              : row.category === 'tecnicos'
                ? 'Tecnicos'
                : 'Multiprofissionais';
      } else {
        if (row.especialidades.length === 0) {
          key = '__sem_esp__';
          label = row.category === 'enfermeiros' || row.category === 'tecnicos' ? 'Enfermagem / Tecnicos (sem especialidade medica)' : 'Sem especialidade registrada';
        } else {
          // Use primary (first) specialty
          const primary = row.especialidades[0];
          key = primary.id;
          label = primary.nome;
        }
      }
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(row);
      } else {
        map.set(key, { key, label, rows: [row] });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.rows.length - a.rows.length);
  }, [dutyRows, grouping]);

  // Gaps: COFEN ratio shortfalls and critical coverage
  const gaps = useMemo(() => {
    const items: Array<{ id: string; title: string; detail: string }> = [];

    for (const unidade of UNIDADES_ASSISTENCIAIS) {
      // Find the healthcare service(s) with dimensionamento that applies
      const services = unidade.healthcareServiceIds
        .map((id) => HEALTHCARE_SERVICES.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s));

      const enfOnDuty = dutyRows.filter(
        (r) =>
          r.unidade.id === unidade.id &&
          (r.category === 'enfermeiros' || r.category === 'tecnicos'),
      ).length;

      // Find strictest nurse-per-bed ratio declared on services
      let strictestRatio: { ratio: number; raw: string; reg: string } | null = null;
      for (const svc of services) {
        if (!svc.dimensionamento) continue;
        const parsed = parseRatio(svc.dimensionamento.profissionaisPorLeitos);
        if (parsed === null) continue;
        if (!strictestRatio || parsed > strictestRatio.ratio) {
          strictestRatio = {
            ratio: parsed,
            raw: svc.dimensionamento.profissionaisPorLeitos,
            reg: svc.dimensionamento.regulamentacao,
          };
        }
      }
      if (strictestRatio) {
        const minRequired = Math.ceil(unidade.capacidadeTotal * strictestRatio.ratio);
        if (enfOnDuty < minRequired) {
          items.push({
            id: `gap-ratio-${unidade.id}`,
            title: `${unidade.nome}: ratio de enfermagem abaixo do minimo`,
            detail: `Exigido ${strictestRatio.raw} (${strictestRatio.reg}) = ${minRequired} para ${unidade.capacidadeTotal} leitos. Em turno: ${enfOnDuty}.`,
          });
        }
      }

      // UTI without plantonista medico presente
      if (unidade.tipo === 'uti_adulto' || unidade.tipo === 'uti_neonatal' || unidade.tipo === 'uti_pediatrica' || unidade.tipo === 'uti_coronariana') {
        const plantonistaPresente = dutyRows.some(
          (r) =>
            r.unidade.id === unidade.id &&
            r.category === 'medicos' &&
            (r.role.codigo === 'plantonista' || r.role.codigo === 'assistente') &&
            r.presenceStatus === 'presente',
        );
        if (!plantonistaPresente) {
          items.push({
            id: `gap-uti-${unidade.id}`,
            title: `${unidade.nome}: UTI sem plantonista medico presente`,
            detail: 'Unidade critica com cobertura 24/7 exigida por CFM 2.271/2020.',
          });
        }
      }

      // 24/7 services without active coverage
      const svc247 = services.filter((s) => s.modeloCobertura === 'plantao_24_7_presencial');
      for (const svc of svc247) {
        const cobertura = dutyRows.some(
          (r) =>
            r.unidade.id === unidade.id &&
            r.role.healthcareServiceIds.includes(svc.id),
        );
        if (!cobertura) {
          items.push({
            id: `gap-247-${svc.id}`,
            title: `${unidade.nome}: servico 24/7 descoberto (${svc.nome})`,
            detail: 'Nenhum profissional alocado ao servico no turno atual.',
          });
        }
      }
    }

    return items;
  }, [dutyRows]);

  const unidadesAtivasCount = useMemo(
    () => new Set(dutyRows.map((r) => r.unidade.id)).size,
    [dutyRows],
  );

  const horaAtual = useMemo(() => {
    // Noon on fixture date for deterministic rendering
    const d = new Date(`${FIXTURE_DATE_ISO}T12:00:00-03:00`);
    return d.toLocaleString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
  }, []);

  return (
    <AppShell pageTitle="Equipe em Plantao">
      <div className="page-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="page-title">Equipe em Plantao</h1>
            <p className="page-subtitle">
              {horaAtual} · {totalOnDuty} profissionais em turno · {presentCount} presentes
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/employees">Gerenciar funcionarios</Link>
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi label="Total em plantao" value={totalOnDuty} sub={`${presentCount} presentes`} />
        <Kpi
          label="Medicos"
          value={medicosTotal}
          sub={
            medicosPorEspecialidade.length > 0
              ? medicosPorEspecialidade
                  .slice(0, 3)
                  .map((m) => `${m.especialidade.nome.split(' ')[0]} ${m.count}`)
                  .join(' · ')
              : undefined
          }
        />
        <Kpi
          label="Enfermagem"
          value={enfermagemBreakdown.coord + enfermagemBreakdown.assist + enfermagemBreakdown.tec}
          sub={`${enfermagemBreakdown.coord} coord · ${enfermagemBreakdown.assist} assist · ${enfermagemBreakdown.tec} tec`}
        />
        <Kpi
          label="Multiprofissional"
          value={multiCount}
          sub={`${unidadesAtivasCount} unidades ativas`}
        />
      </div>

      {/* Medicos por especialidade detail */}
      {medicosPorEspecialidade.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-neutral-200 bg-white">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">
            Medicos em plantao por especialidade
          </div>
          <ul className="flex flex-wrap gap-2">
            {medicosPorEspecialidade.map(({ especialidade, count }) => (
              <li key={especialidade.id}>
                <Link
                  href={`/specialties/${especialidade.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-900 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                >
                  {especialidade.nome}
                  <span className="font-mono text-neutral-700">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Grouping tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg border border-neutral-200 bg-neutral-50 w-fit">
        {(
          [
            { key: 'unidade', label: 'Por Unidade' },
            { key: 'categoria', label: 'Por Categoria' },
            { key: 'especialidade', label: 'Por Especialidade' },
          ] as Array<{ key: GroupingMode; label: string }>
        ).map((tab) => {
          const active = grouping === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setGrouping(tab.key)}
              className={
                active
                  ? 'min-h-[36px] px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-semibold'
                  : 'min-h-[36px] px-3 py-1.5 rounded-md bg-transparent text-neutral-700 text-xs font-semibold hover:bg-neutral-100'
              }
              aria-pressed={active}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Grouped list */}
      <div className="flex flex-col gap-6 mb-8">
        {groups.length === 0 && (
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-neutral-500 text-center">
                Nenhum profissional em plantao neste momento.
              </p>
            </CardContent>
          </Card>
        )}
        {groups.map((group) => (
          <section key={group.key}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-base font-semibold text-neutral-900 uppercase tracking-wider">
                {group.label}
              </h2>
              <span className="text-xs text-neutral-500">
                {group.rows.length} profissional(is)
              </span>
              <div className="flex-1 h-px bg-neutral-100" />
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {group.rows.map((row) => (
                <li key={row.turno.id}>
                  <Link
                    href={`/employees/${row.profissional.id}`}
                    className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 rounded-2xl"
                  >
                    <Card interactive className="h-full">
                      <CardHeader>
                        <div className="flex items-start gap-3 min-w-0">
                          <AvatarInitials name={row.profissional.nome} />
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-neutral-900">
                              {row.profissional.nome}
                            </h3>
                            <p className="text-[11px] text-neutral-500 mt-0.5">
                              {ROLE_CODIGO_LABEL[row.role.codigo]}
                            </p>
                            {row.especialidades.length > 0 && (
                              <p className="text-[11px] text-neutral-500 mt-0.5">
                                {row.especialidades.map((e) => e.nome).join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" withDot>
                          {PRESENCA_LABEL[row.presenceStatus]}
                        </Badge>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between text-xs text-neutral-700">
                          <span>
                            {row.unidade.codigo} · {formatHora(row.turno.inicioEm)}–
                            {formatHora(row.turno.fimEm)}
                          </span>
                          {row.profissional.ramal && (
                            <span className="font-mono text-neutral-700">
                              Ramal {row.profissional.ramal}
                            </span>
                          )}
                        </div>
                        {row.pacientesAssignedCount > 0 && (
                          <p className="text-[11px] text-neutral-500 mt-2">
                            {row.pacientesAssignedCount} paciente(s) atribuido(s)
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Gaps section */}
      <section aria-labelledby="gaps-heading">
        <h2 id="gaps-heading" className="text-base font-bold text-neutral-900 mb-3">
          Gaps de cobertura ({gaps.length})
        </h2>
        <Card>
          <CardContent className="p-0">
            {gaps.length === 0 ? (
              <p className="text-sm text-neutral-500 p-5">
                Nenhum gap critico identificado. Todas as unidades criticas tem plantonista
                presente e ratios COFEN estao cumpridos.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {gaps.map((gap) => (
                  <li key={gap.id} className="px-5 py-3">
                    <p className="text-sm font-semibold text-neutral-900">{gap.title}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{gap.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card variant="kpi">
      <CardContent className="pt-5">
        <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">
          {label}
        </div>
        <div className="text-3xl font-bold mt-1 text-neutral-900">{value}</div>
        {sub && <div className="text-[11px] text-neutral-500 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function AvatarInitials({ name }: { name: string }) {
  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-xs font-bold text-neutral-700"
    >
      {initials}
    </span>
  );
}
