'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { FavoriteButton } from '../../components/favorite-button';
import { Badge, Button, Card, CardContent, CardHeader } from '../../components/ui';
import {
  getEspecialidadeById,
  getUnidadesPorEspecialidade,
  getPacienteById,
  getProfissionalById,
  getPractitionerRoleById,
  getLocationById,
  getUnidadeById,
  PRACTITIONER_ROLES,
  INTERNACOES,
  PRESENCAS_FISICAS,
  TURNOS,
  HEALTHCARE_SERVICES,
  FIXTURE_DATE_ISO,
} from '../../../lib/fixtures/hospital-core';
import type {
  Especialidade,
  Internacao,
  PractitionerRole,
  ProfissionalSaude,
  UnidadeAssistencial,
  HealthcareService,
  ModeloCobertura,
  PractitionerRoleCodigo,
} from '../../../lib/hospital-core-types';
import { getModuleById } from '../../../lib/module-manifest';

/**
 * Specialty detail page powered by the hospital-core data model.
 *
 * All joins are strictly ID-based — no text matching.
 *
 *   - especialidade   : getEspecialidadeById(params.id)
 *   - unidades        : getUnidadesPorEspecialidade(id)
 *   - profissionais   : PractitionerRoles whose especialidadeIds contains id
 *   - pacientes       : Internacoes whose especialidadePrimariaId === id
 *                       + Internacoes whose consultores hold a role with id
 *   - interconsultas  : Internacao.consultores filtered by role.especialidadeIds
 *                       and respostaEm === undefined
 */

const COBERTURA_LABEL: Record<ModeloCobertura, string> = {
  plantao_24_7_presencial: 'Plantao 24/7 presencial',
  diarista_horizontal: 'Diarista horizontal',
  sobreaviso: 'Sobreaviso',
  ambulatorial: 'Ambulatorial',
  hospitalista: 'Hospitalista',
};

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

const ROLE_GROUPS: Array<{ key: string; label: string; codigos: PractitionerRoleCodigo[] }> = [
  { key: 'assistentes', label: 'Assistentes', codigos: ['assistente', 'coordenador_unidade', 'responsavel_tecnico', 'chefe_servico', 'preceptor'] },
  { key: 'plantonistas', label: 'Plantonistas', codigos: ['plantonista'] },
  { key: 'diaristas', label: 'Diaristas', codigos: ['diarista'] },
  { key: 'outros', label: 'Outros', codigos: ['residente', 'interno', 'enfermeiro_assistencial', 'enfermeiro_coordenador', 'tecnico', 'auxiliar'] },
];

function diffInDays(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function diffInHours(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
}

interface ProfRow {
  role: PractitionerRole;
  profissional: ProfissionalSaude;
  unidades: UnidadeAssistencial[];
  presenceStatus: 'presente' | 'em_pausa' | 'off_turno' | 'ausente' | null;
  presenceUnidadeId?: string;
}

export default function SpecialtyDetailPage() {
  const params = useParams<{ id: string }>();

  const especialidade: Especialidade | undefined = useMemo(
    () => getEspecialidadeById(params.id),
    [params.id],
  );

  const unidades: UnidadeAssistencial[] = useMemo(() => {
    if (!especialidade) return [];
    return getUnidadesPorEspecialidade(especialidade.id);
  }, [especialidade]);

  const healthcareServices: HealthcareService[] = useMemo(() => {
    if (!especialidade) return [];
    return HEALTHCARE_SERVICES.filter((s) => s.especialidadeId === especialidade.id && s.ativo);
  }, [especialidade]);

  const unidadeServicoIndex = useMemo(() => {
    const byUnidade = new Map<string, HealthcareService[]>();
    for (const svc of healthcareServices) {
      for (const uid of svc.unidadeIds) {
        if (!byUnidade.has(uid)) byUnidade.set(uid, []);
        byUnidade.get(uid)!.push(svc);
      }
    }
    return byUnidade;
  }, [healthcareServices]);

  const profRows: ProfRow[] = useMemo(() => {
    if (!especialidade) return [];
    const rolesFor = PRACTITIONER_ROLES.filter(
      (r) => r.ativo && r.especialidadeIds.includes(especialidade.id),
    );

    const out: ProfRow[] = [];
    for (const role of rolesFor) {
      const profissional = getProfissionalById(role.profissionalId);
      if (!profissional) continue;
      const unidadesForRole = role.locationIds
        .map((uid) => getUnidadeById(uid))
        .filter((u): u is UnidadeAssistencial => Boolean(u));

      // presence: look up an active turno for this role today, then PresencaFisica
      const turnoAtivo = TURNOS.find(
        (t) => t.practitionerRoleId === role.id && t.status === 'em_andamento',
      );
      const presenca = turnoAtivo
        ? PRESENCAS_FISICAS.find((p) => p.turnoId === turnoAtivo.id)
        : undefined;

      out.push({
        role,
        profissional,
        unidades: unidadesForRole,
        presenceStatus: presenca ? presenca.status : null,
        presenceUnidadeId: presenca?.unidadeAtualId,
      });
    }
    return out;
  }, [especialidade]);

  const profsComRqe = useMemo(() => {
    if (!especialidade) return 0;
    const ids = new Set<string>();
    for (const row of profRows) {
      if (
        row.profissional.registros.some((r) =>
          r.rqeEspecialidadeIds?.includes(especialidade.id),
        )
      ) {
        ids.add(row.profissional.id);
      }
    }
    return ids.size;
  }, [profRows, especialidade]);

  const profsAtivos = useMemo(() => {
    const ids = new Set(profRows.map((r) => r.profissional.id));
    return ids.size;
  }, [profRows]);

  // Role IDs for this specialty (used to detect interconsultas)
  const roleIdsForSpecialty = useMemo(() => {
    if (!especialidade) return new Set<string>();
    return new Set(
      PRACTITIONER_ROLES.filter(
        (r) => r.ativo && r.especialidadeIds.includes(especialidade.id),
      ).map((r) => r.id),
    );
  }, [especialidade]);

  // Pacientes under care as primary specialty
  const internacoesPrimarias: Internacao[] = useMemo(() => {
    if (!especialidade) return [];
    return INTERNACOES.filter(
      (i) =>
        i.especialidadePrimariaId === especialidade.id && i.status !== 'alta_completada',
    );
  }, [especialidade]);

  // Interconsultas pending (consultor.roleId in our roles, respostaEm undefined)
  const interconsultasPendentes = useMemo(() => {
    if (!especialidade) return [] as Array<{
      internacao: Internacao;
      consultorRole: PractitionerRole;
      horasEspera: number;
    }>;
    const out: Array<{
      internacao: Internacao;
      consultorRole: PractitionerRole;
      horasEspera: number;
    }> = [];
    for (const i of INTERNACOES) {
      if (i.status === 'alta_completada') continue;
      for (const c of i.consultores) {
        if (!roleIdsForSpecialty.has(c.roleId)) continue;
        if (c.respostaEm) continue;
        const role = getPractitionerRoleById(c.roleId);
        if (!role) continue;
        out.push({
          internacao: i,
          consultorRole: role,
          horasEspera: diffInHours(c.solicitadoEm, `${FIXTURE_DATE_ISO}T12:00:00-03:00`),
        });
      }
    }
    return out;
  }, [roleIdsForSpecialty, especialidade]);

  const pacientesRows = useMemo(() => {
    return internacoesPrimarias.map((i) => {
      const paciente = getPacienteById(i.pacienteId);
      const leito = getLocationById(i.locationAtualId);
      const unidade = getUnidadeById(i.unidadeAtualId);
      const assistenteRole = getPractitionerRoleById(i.medicoAssistenteRoleId);
      const assistente = assistenteRole
        ? getProfissionalById(assistenteRole.profissionalId)
        : undefined;
      const dias = diffInDays(i.admissao.em, `${FIXTURE_DATE_ISO}T12:00:00-03:00`);
      return { internacao: i, paciente, leito, unidade, assistente, dias };
    });
  }, [internacoesPrimarias]);

  const specialtiesModule = getModuleById('medical-specialties');

  if (!especialidade) {
    return (
      <AppShell pageTitle="Especialidade nao encontrada">
        <div className="page-header">
          <h1 className="page-title">Especialidade nao encontrada</h1>
          <p className="page-subtitle">
            A especialidade <strong>{params.id}</strong> nao esta cadastrada no core.
          </p>
        </div>
        <Button asChild>
          <Link href="/specialties">Voltar a lista</Link>
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle={especialidade.nome}>
      <Breadcrumbs module={specialtiesModule} recordLabel={especialidade.nome} />

      <div className="page-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="outline">
                <span className="font-mono text-[11px] text-neutral-700">
                  {especialidade.conselho}
                  {especialidade.cfmCodigo ? ` · ${especialidade.cfmCodigo}` : ''}
                </span>
              </Badge>
              {especialidade.residenciaAnos !== undefined && (
                <Badge variant="outline">
                  {especialidade.residenciaAnos} anos de residencia
                </Badge>
              )}
              <Badge variant="outline">{especialidade.categoria}</Badge>
            </div>
            <h1 className="page-title">{especialidade.nome}</h1>
            <p className="page-subtitle">{especialidade.descricao}</p>
            {especialidade.areasAtuacao.length > 0 && (
              <p className="text-xs text-neutral-500 mt-2">
                Areas de atuacao: {especialidade.areasAtuacao.join(' · ')}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button asChild variant="outline">
              <Link href="/specialties">Voltar</Link>
            </Button>
            <FavoriteButton
              scope="medical-specialties"
              entry={{
                id: especialidade.id,
                label: especialidade.nome,
                href: `/specialties/${especialidade.id}`,
                description: especialidade.categoria,
              }}
            />
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi label="Unidades onde opera" value={unidades.length} />
        <Kpi
          label="Profissionais ativos"
          value={profsAtivos}
          sub={`${profsComRqe} com RQE`}
        />
        <Kpi
          label="Pacientes (primaria)"
          value={internacoesPrimarias.length}
        />
        <Kpi
          label="Interconsultas pendentes"
          value={interconsultasPendentes.length}
        />
      </div>

      {/* Passado / Presente / Futuro + delegar */}
      <section className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-neutral-900">O que aconteceu (24h)</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-neutral-100 py-1.5">
              <span className="text-neutral-500">Pacientes atendidos</span>
              <span className="font-semibold tabular-nums">{internacoesPrimarias.length}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 py-1.5">
              <span className="text-neutral-500">Altas</span>
              <span className="font-semibold tabular-nums">
                {internacoesPrimarias.filter((i) => i.status === 'alta_completada').length}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-neutral-500">Interconsultas respondidas</span>
              <span className="font-semibold tabular-nums">
                {INTERNACOES.reduce((acc, i) => {
                  return acc + i.consultores.filter((c) => {
                    const role = getPractitionerRoleById(c.roleId);
                    return role?.especialidadeIds.includes(especialidade.id) && c.respostaEm;
                  }).length;
                }, 0)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-neutral-900">O que esta acontecendo</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-neutral-100 py-1.5">
              <span className="text-neutral-500">Pacientes internados</span>
              <span className="font-semibold tabular-nums">
                {internacoesPrimarias.filter((i) => i.status === 'internado' || i.status === 'alta_solicitada').length}
              </span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 py-1.5">
              <span className="text-neutral-500">Interconsultas pendentes</span>
              <span className="font-semibold tabular-nums">{interconsultasPendentes.length}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-neutral-500">Profissionais em plantao</span>
              <span className="font-semibold tabular-nums">
                {profRows.filter((p) => TURNOS.some((t) => t.practitionerRoleId === p.role.id && t.status === 'em_andamento')).length}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-neutral-900">O que vai acontecer</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-neutral-100 py-1.5">
              <span className="text-neutral-500">Altas planejadas</span>
              <span className="font-semibold tabular-nums">
                {internacoesPrimarias.filter((i) => i.status === 'alta_solicitada').length}
              </span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 py-1.5">
              <span className="text-neutral-500">Pacientes NEWS &gt;= 5</span>
              <span className="font-semibold tabular-nums">
                {internacoesPrimarias.filter((i) => typeof i.newsScore === 'number' && i.newsScore >= 5).length}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-neutral-500">Turnos agendados</span>
              <span className="font-semibold tabular-nums">
                {profRows.reduce((acc, p) => acc + TURNOS.filter((t) => t.practitionerRoleId === p.role.id && t.status === 'agendado').length, 0)}
              </span>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.alert('Delegar tarefa para ' + especialidade.nome + ' — formulario em desenvolvimento')}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Delegar tarefa
              </button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Unidades */}
      <section aria-labelledby="unidades-heading" className="mb-6">
        <h2
          id="unidades-heading"
          className="text-base font-bold text-neutral-900 mb-3"
        >
          Unidades que operam a especialidade ({unidades.length})
        </h2>
        {unidades.length === 0 ? (
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-neutral-500">
                Nenhuma unidade registrada para esta especialidade.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unidades.map((u) => {
              const servicos = unidadeServicoIndex.get(u.id) ?? [];
              return (
                <li key={u.id}>
                  <Link
                    href={`/unidades/${u.id}`}
                    className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 rounded-2xl"
                  >
                    <Card interactive className="h-full">
                      <CardHeader>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-neutral-900">
                            {u.nome}
                          </h3>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {u.codigo} · {u.capacidadeTotal} leitos · {u.horarioFuncionamento}
                          </p>
                        </div>
                        <Badge variant="outline">{u.criticidade}</Badge>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {servicos.map((svc) => (
                            <li key={svc.id} className="flex items-start justify-between gap-2">
                              <span className="text-xs text-neutral-700">
                                {COBERTURA_LABEL[svc.modeloCobertura]}
                                {svc.horarioInicio && svc.horarioFim
                                  ? ` · ${svc.horarioInicio}-${svc.horarioFim}`
                                  : ''}
                              </span>
                              {svc.dimensionamento && (
                                <span className="font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                                  {svc.dimensionamento.profissionaisPorLeitos} ({svc.dimensionamento.regulamentacao})
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Profissionais agrupados por papel */}
      <section aria-labelledby="profs-heading" className="mb-6">
        <h2 id="profs-heading" className="text-base font-bold text-neutral-900 mb-3">
          Profissionais ({profRows.length})
        </h2>
        {profRows.length === 0 ? (
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-neutral-500">
                Nenhum profissional com vinculo ativo nesta especialidade.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {ROLE_GROUPS.map((group) => {
              const rows = profRows.filter((r) => group.codigos.includes(r.role.codigo));
              if (rows.length === 0) return null;
              return (
                <div key={group.key}>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xs uppercase tracking-wider font-semibold text-neutral-500">
                      {group.label}
                    </h3>
                    <span className="text-xs text-neutral-500">({rows.length})</span>
                    <div className="flex-1 h-px bg-neutral-100" />
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {rows.map((row) => (
                      <li key={row.role.id}>
                        <Link
                          href={`/profissionais/${row.profissional.id}`}
                          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 rounded-2xl"
                        >
                          <Card interactive className="h-full">
                            <CardHeader>
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-neutral-900">
                                  {row.profissional.nome}
                                </h4>
                                <p className="text-[11px] text-neutral-500 mt-0.5">
                                  {ROLE_CODIGO_LABEL[row.role.codigo]}
                                </p>
                              </div>
                              {row.presenceStatus && (
                                <Badge variant="outline" withDot>
                                  {row.presenceStatus === 'presente'
                                    ? 'Presente'
                                    : row.presenceStatus === 'em_pausa'
                                      ? 'Em pausa'
                                      : row.presenceStatus === 'off_turno'
                                        ? 'Fora do turno'
                                        : 'Ausente'}
                                </Badge>
                              )}
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-0.5 text-[11px] text-neutral-700 font-mono">
                                {row.profissional.registros.map((r, i) => (
                                  <li key={i}>
                                    {r.conselho}-{r.uf} {r.numero}
                                    {r.rqeEspecialidadeIds?.includes(especialidade.id)
                                      ? ' · RQE'
                                      : ''}
                                  </li>
                                ))}
                              </ul>
                              {row.unidades.length > 0 && (
                                <p className="text-xs text-neutral-500 mt-2">
                                  {row.unidades.map((u) => u.codigo).join(' · ')}
                                </p>
                              )}
                              {row.profissional.ramal && (
                                <p className="text-[11px] text-neutral-500 mt-1">
                                  Ramal{' '}
                                  <span className="font-mono text-neutral-900">
                                    {row.profissional.ramal}
                                  </span>
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pacientes sob cuidado (tabela) */}
      <section aria-labelledby="pacientes-heading" className="mb-6">
        <h2 id="pacientes-heading" className="text-base font-bold text-neutral-900 mb-3">
          Pacientes sob cuidado como especialidade primaria ({pacientesRows.length})
        </h2>
        <Card>
          <CardContent className="p-0">
            {pacientesRows.length === 0 ? (
              <p className="text-sm text-neutral-500 p-5">
                Nenhum paciente internado sob responsabilidade primaria desta especialidade.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
                      <th className="px-4 py-2 font-semibold">MRN</th>
                      <th className="px-4 py-2 font-semibold">Nome</th>
                      <th className="px-4 py-2 font-semibold">Leito</th>
                      <th className="px-4 py-2 font-semibold">Unidade</th>
                      <th className="px-4 py-2 font-semibold">Assistente</th>
                      <th className="px-4 py-2 font-semibold text-right">Dias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pacientesRows.map(({ internacao, paciente, leito, unidade, assistente, dias }) => (
                      <tr
                        key={internacao.id}
                        className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                      >
                        <td className="px-4 py-2 font-mono text-xs text-neutral-700">
                          {paciente ? (
                            <Link
                              href={`/patients/${paciente.mrn}`}
                              className="text-neutral-900 hover:underline"
                            >
                              {paciente.mrn}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2 text-neutral-900">
                          {paciente?.nome ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-neutral-700">{leito?.nome ?? '—'}</td>
                        <td className="px-4 py-2 text-neutral-700">{unidade?.codigo ?? '—'}</td>
                        <td className="px-4 py-2 text-neutral-700">
                          {assistente?.nome ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-neutral-700">
                          {dias}d
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Interconsultas pendentes */}
      <section aria-labelledby="ic-heading" className="mb-4">
        <h2 id="ic-heading" className="text-base font-bold text-neutral-900 mb-3">
          Interconsultas pendentes ({interconsultasPendentes.length})
        </h2>
        <Card>
          <CardContent className="p-0">
            {interconsultasPendentes.length === 0 ? (
              <p className="text-sm text-neutral-500 p-5">
                Nenhuma interconsulta pendente para esta especialidade.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {interconsultasPendentes.map(({ internacao, consultorRole, horasEspera }) => {
                  const paciente = getPacienteById(internacao.pacienteId);
                  const unidade = getUnidadeById(internacao.unidadeAtualId);
                  const solicitanteRole = getPractitionerRoleById(
                    internacao.medicoAssistenteRoleId,
                  );
                  const solicitante = solicitanteRole
                    ? getProfissionalById(solicitanteRole.profissionalId)
                    : undefined;
                  const consultor = getProfissionalById(consultorRole.profissionalId);
                  return (
                    <li
                      key={`${internacao.id}-${consultorRole.id}`}
                      className="px-5 py-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <Link
                          href={paciente ? `/patients/${paciente.mrn}` : '#'}
                          className="text-sm font-bold text-neutral-900 hover:underline"
                        >
                          {paciente?.nome ?? 'Paciente desconhecido'}
                        </Link>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {unidade?.codigo ?? '—'} · Solicitante: {solicitante?.nome ?? '—'}
                          {consultor ? ` · Consultor: ${consultor.nome}` : ''}
                        </p>
                      </div>
                      <Badge variant="outline">{horasEspera}h esperando</Badge>
                    </li>
                  );
                })}
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
