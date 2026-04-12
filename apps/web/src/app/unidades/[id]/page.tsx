'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '../../components/app-shell';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { EntityPanel } from '../../components/entity-panel/entity-panel';
import {
  HEALTHCARE_SERVICES,
  INTERNACOES,
  PACIENTES,
  PRACTITIONER_ROLES,
  PROFISSIONAIS,
  TRANSFERENCIAS_INTERNAS,
  TURNOS,
  getCareTeamById,
  getEspecialidadeById,
  getHealthcareServicesPorUnidade,
  getInternacaoById,
  getInternacoesPorUnidade,
  getLeitosPorUnidade,
  getLocationById,
  getOrganizationById,
  getPacienteById,
  getPractitionerRoleById,
  getProfissionalById,
  getUnidadeById,
} from '../../../lib/fixtures/hospital-core';
import type {
  BedOperationalStatus,
  CategoriaProfissional,
  Internacao,
  Location,
  ModeloCobertura,
  PractitionerRole,
  ProfissionalSaude,
  Turno,
  UnidadeAssistencial,
} from '../../../lib/hospital-core-types';

// ---------------------------------------------------------------------------
// Labels (PT-BR, monochromatic)
// ---------------------------------------------------------------------------

const BED_STATUS_LABEL: Record<BedOperationalStatus, string> = {
  O: 'Ocupado',
  U: 'Disponivel',
  K: 'Contaminado',
  I: 'Isolamento',
  H: 'Em limpeza',
  C: 'Bloqueado',
};

const CATEGORIA_LABEL: Record<CategoriaProfissional, string> = {
  medico: 'Medico',
  enfermeiro: 'Enfermeiro',
  tecnico_enfermagem: 'Tecnico Enfermagem',
  auxiliar_enfermagem: 'Auxiliar Enfermagem',
  fisioterapeuta: 'Fisioterapeuta',
  nutricionista: 'Nutricionista',
  fonoaudiologo: 'Fonoaudiologo',
  psicologo: 'Psicologo',
  terapeuta_ocupacional: 'Terapeuta Ocupacional',
  assistente_social: 'Assistente Social',
  farmaceutico: 'Farmaceutico',
  dentista: 'Dentista',
  biomedico: 'Biomedico',
  tecnico_radiologia: 'Tecnico Radiologia',
  maqueiro: 'Maqueiro',
  higienizacao: 'Higienizacao',
  manutencao: 'Manutencao',
  recepcao: 'Recepcao',
  coordenador_assistencial: 'Coordenador Assistencial',
  diretor_clinico: 'Diretor Clinico',
  diretor_tecnico: 'Diretor Tecnico',
};

const MODELO_COBERTURA_LABEL: Record<ModeloCobertura, string> = {
  plantao_24_7_presencial: 'Plantao 24/7 presencial',
  diarista_horizontal: 'Diarista horizontal',
  sobreaviso: 'Sobreaviso',
  ambulatorial: 'Ambulatorial',
  hospitalista: 'Hospitalista',
};

const ROLE_CODIGO_LABEL: Record<string, string> = {
  assistente: 'Assistente',
  plantonista: 'Plantonista',
  diarista: 'Diarista',
  coordenador_unidade: 'Coordenador',
  chefe_servico: 'Chefe de Servico',
  preceptor: 'Preceptor',
  residente: 'Residente',
  interno: 'Interno',
  responsavel_tecnico: 'RT',
  enfermeiro_assistencial: 'Enfermeiro Assistencial',
  enfermeiro_coordenador: 'Enfermeiro Coordenador',
  tecnico: 'Tecnico',
  auxiliar: 'Auxiliar',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface BedStats {
  capacidade: number;
  ocupados: number;
  limpeza: number;
  bloqueados: number;
  reservados: number;
  isolamento: number;
  disponiveis: number;
  ocupacao: number;
}

function computeBedStats(unidade: UnidadeAssistencial, leitos: Location[]): BedStats {
  let ocupados = 0;
  let limpeza = 0;
  let bloqueados = 0;
  let reservados = 0;
  let isolamento = 0;
  let disponiveis = 0;
  for (const b of leitos) {
    const s = b.operationalStatus;
    if (s === 'O') ocupados += 1;
    else if (s === 'H' || s === 'K') limpeza += 1;
    else if (s === 'C') bloqueados += 1;
    else if (s === 'I') reservados += 1;
    else disponiveis += 1;
    if (b.isolamento) isolamento += 1;
  }
  const capacidade = unidade.capacidadeTotal;
  const ocupacao = capacidade > 0 ? Math.round((ocupados / capacidade) * 100) : 0;
  return { capacidade, ocupados, limpeza, bloqueados, reservados, isolamento, disponiveis, ocupacao };
}

function buildBreadcrumb(unidade: UnidadeAssistencial): string[] {
  const crumbs: string[] = ['Hospital'];
  const ward = getLocationById(unidade.locationId);
  if (!ward) return crumbs;
  const floor = ward.parentId ? getLocationById(ward.parentId) : undefined;
  const building = floor?.parentId ? getLocationById(floor.parentId) : undefined;
  if (building) crumbs.push(building.nome);
  if (floor) crumbs.push(floor.nome);
  crumbs.push(unidade.nome);
  return crumbs;
}

function idade(dataNascimento: string): number {
  const nasc = new Date(dataNascimento);
  const hoje = new Date('2026-04-12');
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos -= 1;
  return anos;
}

function diasInternado(admissaoEm: string): number {
  const inicio = new Date(admissaoEm);
  const hoje = new Date('2026-04-12T12:00:00-03:00');
  return Math.max(0, Math.floor((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
}

interface EquipeRow {
  profissional: ProfissionalSaude;
  role: PractitionerRole;
  turno: Turno;
}

function getEquipeAgora(unidadeId: string): EquipeRow[] {
  const turnosAtivos = TURNOS.filter((t) => t.unidadeId === unidadeId && t.status === 'em_andamento');
  const rows: EquipeRow[] = [];
  for (const turno of turnosAtivos) {
    const role = getPractitionerRoleById(turno.practitionerRoleId);
    if (!role) continue;
    const prof = getProfissionalById(role.profissionalId);
    if (!prof) continue;
    rows.push({ profissional: prof, role, turno });
  }
  return rows;
}

function specialtyNamesFor(role: PractitionerRole): string {
  const names = role.especialidadeIds
    .map((id) => getEspecialidadeById(id)?.nome)
    .filter((n): n is string => Boolean(n));
  return names.join(', ');
}

function initialsOf(nome: string): string {
  const parts = nome.replace(/^(Dr\.|Dra\.)\s+/, '').split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return nome.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UnidadeDetailPage() {
  const params = useParams<{ id: string }>();
  const unidade = useMemo(() => getUnidadeById(params.id), [params.id]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedLeitoId, setSelectedLeitoId] = useState<string | null>(null);

  if (!unidade) {
    return (
      <AppShell pageTitle="Unidade nao encontrada">
        <div className="page-header">
          <h1 className="page-title">Unidade nao encontrada</h1>
          <p className="page-subtitle">
            A unidade <strong>{params.id}</strong> nao esta cadastrada.
          </p>
        </div>
        <Link
          href="/unidades"
          className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-700 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          Voltar a lista
        </Link>
      </AppShell>
    );
  }

  const leitos = getLeitosPorUnidade(unidade.id);
  const stats = computeBedStats(unidade, leitos);
  const internacoes = getInternacoesPorUnidade(unidade.id);
  const internacoesPorLeito = new Map<string, Internacao>();
  for (const i of internacoes) internacoesPorLeito.set(i.locationAtualId, i);

  const servicos = getHealthcareServicesPorUnidade(unidade.id);
  const equipe = getEquipeAgora(unidade.id);
  const breadcrumbs = buildBreadcrumb(unidade);

  const coordenador = unidade.coordenadorId ? getProfissionalById(unidade.coordenadorId) : undefined;
  const responsavelTecnico = unidade.responsavelTecnicoId
    ? getProfissionalById(unidade.responsavelTecnicoId)
    : undefined;

  const medicos = equipe.filter((r) => r.profissional.categoria === 'medico');
  const enfermeiros = equipe.filter((r) => r.profissional.categoria === 'enfermeiro');
  const tecnicos = equipe.filter(
    (r) => r.profissional.categoria === 'tecnico_enfermagem' || r.profissional.categoria === 'auxiliar_enfermagem',
  );
  const multiprofissionais = equipe.filter(
    (r) =>
      !['medico', 'enfermeiro', 'tecnico_enfermagem', 'auxiliar_enfermagem'].includes(r.profissional.categoria),
  );

  // Transferencias
  const leitoIds = new Set(unidade.leitoIds);
  const entradas = TRANSFERENCIAS_INTERNAS.filter(
    (t) => leitoIds.has(t.destinoLocationId) && !t.executadoEm,
  );
  const saidas = TRANSFERENCIAS_INTERNAS.filter(
    (t) => leitoIds.has(t.origemLocationId) && !t.executadoEm,
  );

  // Alertas
  const alertasNews = internacoes.filter((i) => (i.newsScore ?? 0) >= 5);
  const alertasIsolamento = leitos.filter((l) => l.isolamento && l.operationalStatus === 'O');

  return (
    <AppShell pageTitle={unidade.nome}>
      {/* Header */}
      <nav aria-label="Trilha de navegacao" className="mb-3">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-neutral-500">
          <li>
            <Link href="/" className="hover:text-neutral-900">
              Inicio
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <Link href="/unidades" className="hover:text-neutral-900">
              Unidades
            </Link>
          </li>
          {breadcrumbs.slice(1).map((label, i, arr) => (
            <span key={i} className="flex items-center gap-1">
              <span aria-hidden="true">›</span>
              <span className={i === arr.length - 1 ? 'text-neutral-900 font-medium' : ''}>
                {label}
              </span>
            </span>
          ))}
        </ol>
      </nav>

      <div className="page-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-xs text-neutral-500">{unidade.codigo}</span>
              <Badge variant="outline">{unidade.tipo.replace(/_/g, ' ')}</Badge>
              {unidade.subtipo && <Badge variant="outline">{unidade.subtipo}</Badge>}
              <Badge variant="default">Nivel {unidade.nivelCuidado.replace(/_/g, ' ')}</Badge>
            </div>
            <h1 className="page-title">{unidade.nome}</h1>
            <p className="page-subtitle">
              {unidade.horarioFuncionamento === '24h' ? 'Funcionamento 24h' : `Funcionamento ${unidade.horarioFuncionamento}`}
              {coordenador && <> · Coordenacao: {coordenador.nome}</>}
              {responsavelTecnico && responsavelTecnico.id !== coordenador?.id && (
                <> · RT: {responsavelTecnico.nome}</>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/unidades"
              className="min-h-[40px] inline-flex items-center px-3 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
            >
              ← Voltar
            </Link>
          </div>
        </div>
      </div>

      {/* Capacity strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Kpi label="Capacidade" value={stats.capacidade} />
        <Kpi label={`Ocupados (${stats.ocupacao}%)`} value={stats.ocupados} />
        <Kpi label="Disponiveis" value={stats.disponiveis} />
        <Kpi label="Em limpeza" value={stats.limpeza} />
        <Kpi label="Bloqueados" value={stats.bloqueados} />
        <Kpi label="Isolamento" value={stats.isolamento} />
      </div>

      {/* Equipe agora */}
      <section aria-labelledby="equipe-heading" className="mb-4">
        <Card>
          <CardHeader>
            <h2 id="equipe-heading" className="text-base font-bold text-neutral-900">
              Equipe agora ({equipe.length})
            </h2>
            <Badge variant="outline">Turnos em andamento</Badge>
          </CardHeader>
          <CardContent>
            {equipe.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhum turno em andamento nesta unidade.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <EquipeGroup title="Medicos" rows={medicos} />
                <EquipeGroup title="Enfermeiros" rows={enfermeiros} />
                <EquipeGroup title="Tecnicos" rows={tecnicos} />
                <EquipeGroup title="Multiprofissionais" rows={multiprofissionais} />
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Especialidades que operam */}
      <section aria-labelledby="servicos-heading" className="mb-4">
        <Card>
          <CardHeader>
            <h2 id="servicos-heading" className="text-base font-bold text-neutral-900">
              Especialidades que operam ({servicos.length})
            </h2>
          </CardHeader>
          <CardContent>
            {servicos.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma especialidade cadastrada.</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {servicos.map((svc) => {
                  const esp = getEspecialidadeById(svc.especialidadeId);
                  return (
                    <li key={svc.id}>
                      <Link
                        href={esp ? `/specialties/${esp.id}` : '#'}
                        className="block bg-neutral-50 border border-neutral-200 rounded-lg p-3 hover:bg-neutral-100 hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-200 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-neutral-900">{esp?.nome ?? svc.nome}</h3>
                        </div>
                        <p className="text-xs text-neutral-500">
                          {MODELO_COBERTURA_LABEL[svc.modeloCobertura]}
                        </p>
                        {svc.dimensionamento && (
                          <p className="text-[11px] text-neutral-500 mt-1">
                            Dim.: {svc.dimensionamento.profissionaisPorLeitos} ({svc.dimensionamento.regulamentacao})
                          </p>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Bed Map */}
      <section aria-labelledby="leitos-heading" className="mb-4">
        <Card>
          <CardHeader>
            <h2 id="leitos-heading" className="text-base font-bold text-neutral-900">
              Mapa de leitos ({leitos.length})
            </h2>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                Lista
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === 'grid' ? (
              <BedGrid
                leitos={leitos}
                internacoesPorLeito={internacoesPorLeito}
                onSelect={setSelectedLeitoId}
              />
            ) : (
              <BedTable
                leitos={leitos}
                internacoesPorLeito={internacoesPorLeito}
                onSelect={setSelectedLeitoId}
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Transferencias */}
      <section aria-labelledby="transf-heading" className="mb-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <h2 id="transf-heading" className="text-base font-bold text-neutral-900">
                Entradas pendentes ({entradas.length})
              </h2>
            </CardHeader>
            <CardContent>
              {entradas.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhuma transferencia de entrada.</p>
              ) : (
                <ul className="space-y-2">
                  {entradas.map((t) => {
                    const internacao = getInternacaoById(t.internacaoId);
                    const paciente = internacao ? getPacienteById(internacao.pacienteId) : undefined;
                    const origem = getLocationById(t.origemLocationId);
                    const destino = getLocationById(t.destinoLocationId);
                    return (
                      <li key={t.id} className="border border-neutral-200 rounded-lg p-3 bg-neutral-50">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-neutral-900">
                            {paciente?.nome ?? 'Paciente'}
                          </span>
                          <Badge variant="outline" size="sm">{t.tipo.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">
                          De {origem?.nome ?? '—'} para {destino?.nome ?? '—'} · {t.motivo}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="text-base font-bold text-neutral-900">
                Saidas pendentes ({saidas.length})
              </h2>
            </CardHeader>
            <CardContent>
              {saidas.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhuma transferencia de saida.</p>
              ) : (
                <ul className="space-y-2">
                  {saidas.map((t) => {
                    const internacao = getInternacaoById(t.internacaoId);
                    const paciente = internacao ? getPacienteById(internacao.pacienteId) : undefined;
                    const origem = getLocationById(t.origemLocationId);
                    const destino = getLocationById(t.destinoLocationId);
                    return (
                      <li key={t.id} className="border border-neutral-200 rounded-lg p-3 bg-neutral-50">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-neutral-900">
                            {paciente?.nome ?? 'Paciente'}
                          </span>
                          <Badge variant="outline" size="sm">{t.tipo.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">
                          De {origem?.nome ?? '—'} para {destino?.nome ?? '—'} · {t.motivo}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Alertas */}
      <section aria-labelledby="alertas-heading">
        <Card>
          <CardHeader>
            <h2 id="alertas-heading" className="text-base font-bold text-neutral-900">
              Alertas da unidade
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <AlertBlock
                title="NEWS >= 5"
                count={alertasNews.length}
                description="Pacientes em deterioracao"
              >
                {alertasNews.slice(0, 5).map((i) => {
                  const p = getPacienteById(i.pacienteId);
                  return (
                    <li key={i.id} className="text-xs text-neutral-700">
                      {p?.nome ?? 'Paciente'} · NEWS {i.newsScore}
                    </li>
                  );
                })}
              </AlertBlock>
              <AlertBlock
                title="Isolamento ativo"
                count={alertasIsolamento.length}
                description="Leitos ocupados com isolamento"
              >
                {alertasIsolamento.slice(0, 5).map((l) => (
                  <li key={l.id} className="text-xs text-neutral-700">
                    {l.nome} · {l.isolamento}
                  </li>
                ))}
              </AlertBlock>
              <AlertBlock
                title="Dimensionamento"
                count={servicos.filter((s) => s.dimensionamento).length}
                description="Servicos com ratio COFEN/RDC"
              >
                {servicos
                  .filter((s) => s.dimensionamento)
                  .slice(0, 5)
                  .map((s) => (
                    <li key={s.id} className="text-xs text-neutral-700">
                      {s.nome} · {s.dimensionamento?.profissionaisPorLeitos}
                    </li>
                  ))}
              </AlertBlock>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Bed detail panel */}
      {selectedLeitoId && (
        <BedDetailPanel
          leitoId={selectedLeitoId}
          onClose={() => setSelectedLeitoId(null)}
        />
      )}

      {/* Keep import graph honest */}
      <span hidden aria-hidden="true">
        {HEALTHCARE_SERVICES.length}
        {INTERNACOES.length}
        {PACIENTES.length}
        {PRACTITIONER_ROLES.length}
        {PROFISSIONAIS.length}
      </span>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</div>
      <div className="text-3xl font-bold mt-1 text-neutral-900">{value}</div>
    </div>
  );
}

function EquipeGroup({ title, rows }: { title: string; rows: EquipeRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">
        {title} ({rows.length})
      </h3>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {rows.map(({ profissional, role, turno }) => {
          const especialidades = specialtyNamesFor(role);
          return (
            <li
              key={`${profissional.id}-${role.id}-${turno.id}`}
              className="flex items-center gap-3 bg-neutral-50 border border-neutral-200 rounded-lg p-3"
            >
              <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-200 text-neutral-900 flex items-center justify-center text-xs font-bold">
                {initialsOf(profissional.nome)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900 truncate">{profissional.nome}</p>
                <p className="text-xs text-neutral-500 truncate">
                  {ROLE_CODIGO_LABEL[role.codigo] ?? role.codigo}
                  {especialidades && <> · {especialidades}</>}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {CATEGORIA_LABEL[profissional.categoria]}
                  {profissional.ramal && <> · ramal {profissional.ramal}</>}
                </p>
              </div>
              <Badge variant="default" size="sm" withDot>
                {turno.status === 'em_andamento' ? 'on-duty' : 'off-turno'}
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BedGrid({
  leitos,
  internacoesPorLeito,
  onSelect,
}: {
  leitos: Location[];
  internacoesPorLeito: Map<string, Internacao>;
  onSelect: (id: string) => void;
}) {
  return (
    <ul
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
    >
      {leitos.map((leito) => {
        const internacao = internacoesPorLeito.get(leito.id);
        const paciente = internacao ? getPacienteById(internacao.pacienteId) : undefined;
        const esp = internacao ? getEspecialidadeById(internacao.especialidadePrimariaId) : undefined;
        const medRole = internacao ? getPractitionerRoleById(internacao.medicoAssistenteRoleId) : undefined;
        const medico = medRole ? getProfissionalById(medRole.profissionalId) : undefined;
        const status: BedOperationalStatus = leito.operationalStatus ?? 'U';
        const statusLabel = BED_STATUS_LABEL[status];
        return (
          <li key={leito.id}>
            <button
              type="button"
              onClick={() => onSelect(leito.id)}
              className="w-full text-left bg-white border border-neutral-200 rounded-lg p-3 hover:border-neutral-300 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200 transition-colors"
            >
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-mono text-base font-bold text-neutral-900">{leito.nome}</span>
                <span className="h-2 w-2 rounded-full bg-neutral-900" aria-hidden="true" />
              </div>
              <Badge variant="default" size="sm" className="mb-2">
                {statusLabel}
              </Badge>
              {leito.isolamento && (
                <Badge variant="outline" size="sm" className="ml-1 mb-2">
                  Isolamento {leito.isolamento}
                </Badge>
              )}
              {status === 'O' && paciente && internacao && (
                <div className="text-xs text-neutral-700 space-y-0.5">
                  <p className="font-semibold text-neutral-900 truncate">{paciente.nome}</p>
                  <p className="text-neutral-500">
                    {paciente.mrn} · {idade(paciente.dataNascimento)} anos
                  </p>
                  {internacao.hipoteseDiagnostica && (
                    <p className="truncate" title={internacao.hipoteseDiagnostica}>
                      {internacao.hipoteseDiagnostica}
                    </p>
                  )}
                  {esp && (
                    <Badge variant="outline" size="sm" className="mt-1">
                      {esp.nome}
                    </Badge>
                  )}
                  {medico && (
                    <p className="text-[11px] text-neutral-500 mt-1 truncate">Assist.: {medico.nome}</p>
                  )}
                  <div className="flex gap-2 mt-1 text-[11px] text-neutral-500">
                    {typeof internacao.newsScore === 'number' && <span>NEWS {internacao.newsScore}</span>}
                    {internacao.scpAtual && <span>SCP {internacao.scpAtual}</span>}
                  </div>
                </div>
              )}
              {status === 'H' && (
                <p className="text-xs text-neutral-500">Em higienizacao</p>
              )}
              {status === 'C' && (
                <p className="text-xs text-neutral-500">Bloqueado</p>
              )}
              {status === 'U' && (
                <p className="text-xs text-neutral-500">Livre para alocacao</p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function BedTable({
  leitos,
  internacoesPorLeito,
  onSelect,
}: {
  leitos: Location[];
  internacoesPorLeito: Map<string, Internacao>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left">
            <th className="py-2 pr-3 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Leito</th>
            <th className="py-2 pr-3 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Paciente</th>
            <th className="py-2 pr-3 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Idade</th>
            <th className="py-2 pr-3 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Especialidade</th>
            <th className="py-2 pr-3 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Assistente</th>
            <th className="py-2 pr-3 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">SCP</th>
            <th className="py-2 pr-3 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Dias</th>
            <th className="py-2 pr-3 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">CID</th>
            <th className="py-2 pr-3 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Alertas</th>
          </tr>
        </thead>
        <tbody>
          {leitos.map((leito) => {
            const internacao = internacoesPorLeito.get(leito.id);
            const paciente = internacao ? getPacienteById(internacao.pacienteId) : undefined;
            const esp = internacao ? getEspecialidadeById(internacao.especialidadePrimariaId) : undefined;
            const medRole = internacao ? getPractitionerRoleById(internacao.medicoAssistenteRoleId) : undefined;
            const medico = medRole ? getProfissionalById(medRole.profissionalId) : undefined;
            const status = leito.operationalStatus ?? 'U';
            return (
              <tr
                key={leito.id}
                onClick={() => onSelect(leito.id)}
                className="border-b border-neutral-200 hover:bg-neutral-50 cursor-pointer"
              >
                <td className="py-2 pr-3 font-mono font-semibold text-neutral-900">{leito.nome}</td>
                <td className="py-2 pr-3 text-neutral-900">
                  {paciente?.nome ?? <span className="text-neutral-500">{BED_STATUS_LABEL[status]}</span>}
                </td>
                <td className="py-2 pr-3 text-neutral-700">
                  {paciente ? `${idade(paciente.dataNascimento)}` : '—'}
                </td>
                <td className="py-2 pr-3 text-neutral-700">{esp?.nome ?? '—'}</td>
                <td className="py-2 pr-3 text-neutral-700">{medico?.nome ?? '—'}</td>
                <td className="py-2 pr-3 text-neutral-700">{internacao?.scpAtual ?? '—'}</td>
                <td className="py-2 pr-3 text-neutral-700">
                  {internacao ? diasInternado(internacao.admissao.em) : '—'}
                </td>
                <td className="py-2 pr-3 font-mono text-neutral-700">{internacao?.cidPrincipal ?? '—'}</td>
                <td className="py-2 pr-3">
                  {internacao && (internacao.newsScore ?? 0) >= 5 && (
                    <Badge variant="default" size="sm">NEWS {internacao.newsScore}</Badge>
                  )}
                  {leito.isolamento && (
                    <Badge variant="outline" size="sm" className="ml-1">Isol.</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AlertBlock({
  title,
  count,
  description,
  children,
}: {
  title: string;
  count: number;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <span className="text-xl font-bold text-neutral-900">{count}</span>
      </div>
      <p className="text-[11px] text-neutral-500 mb-2">{description}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bed detail panel (replaces old patient-panel with hospital-core schema)
// ---------------------------------------------------------------------------

function BedDetailPanel({ leitoId, onClose }: { leitoId: string; onClose: () => void }) {
  const leito = getLocationById(leitoId);
  if (!leito) return null;

  const internacaoRaw = INTERNACOES.find((i) => i.locationAtualId === leitoId && i.status !== 'alta_completada');
  const paciente = internacaoRaw ? getPacienteById(internacaoRaw.pacienteId) : undefined;
  const esp = internacaoRaw ? getEspecialidadeById(internacaoRaw.especialidadePrimariaId) : undefined;
  const medRole = internacaoRaw ? getPractitionerRoleById(internacaoRaw.medicoAssistenteRoleId) : undefined;
  const medico = medRole ? getProfissionalById(medRole.profissionalId) : undefined;
  const careTeam = internacaoRaw ? getCareTeamById(internacaoRaw.careTeamId) : undefined;

  const title = paciente?.nome ?? leito.nome;
  const subtitle = paciente
    ? `${leito.nome} · ${paciente.mrn}`
    : BED_STATUS_LABEL[leito.operationalStatus ?? 'U'];

  return (
    <EntityPanel open={true} onClose={onClose} title={title} subtitle={subtitle} width="lg">
      {!paciente || !internacaoRaw ? (
        <BedActionsView leito={leito} />
      ) : (
        <div className="space-y-4">
          {/* Paciente */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">
              Paciente
            </h3>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-neutral-900">{paciente.nome}</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {paciente.mrn} · {idade(paciente.dataNascimento)} anos · {paciente.sexo}
              </p>
              {paciente.tipoSanguineo && (
                <p className="text-[11px] text-neutral-500 mt-0.5">Tipo {paciente.tipoSanguineo}</p>
              )}
              {paciente.convenio && (
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Convenio: {paciente.convenio.nome} ({paciente.convenio.plano})
                </p>
              )}
            </div>
          </section>

          {/* Internacao */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">
              Internacao
            </h3>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-1 text-xs text-neutral-700">
              <p>
                <span className="text-neutral-500">Atendimento:</span>{' '}
                <span className="font-mono">{internacaoRaw.numeroAtendimento}</span>
              </p>
              <p>
                <span className="text-neutral-500">Admissao:</span> {internacaoRaw.admissao.em} ·{' '}
                {internacaoRaw.admissao.via.replace(/_/g, ' ')}
              </p>
              <p>
                <span className="text-neutral-500">Dias internado:</span>{' '}
                {diasInternado(internacaoRaw.admissao.em)}
              </p>
              {internacaoRaw.hipoteseDiagnostica && (
                <p>
                  <span className="text-neutral-500">Hipotese:</span> {internacaoRaw.hipoteseDiagnostica}
                </p>
              )}
              {internacaoRaw.cidPrincipal && (
                <p>
                  <span className="text-neutral-500">CID principal:</span>{' '}
                  <span className="font-mono">{internacaoRaw.cidPrincipal}</span>
                </p>
              )}
            </div>
          </section>

          {/* Escores */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">
              Escores
            </h3>
            <div className="flex flex-wrap gap-2">
              {typeof internacaoRaw.newsScore === 'number' && (
                <Badge variant="default">NEWS {internacaoRaw.newsScore}</Badge>
              )}
              {internacaoRaw.scpAtual && <Badge variant="outline">SCP {internacaoRaw.scpAtual}</Badge>}
              {internacaoRaw.admissao.classificacaoRisco && (
                <Badge variant="outline">
                  Manchester {internacaoRaw.admissao.classificacaoRisco.manchester}
                </Badge>
              )}
            </div>
          </section>

          {/* Equipe */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">
              Equipe responsavel
            </h3>
            <div className="space-y-1 text-xs text-neutral-700">
              {medico && (
                <p>
                  <span className="text-neutral-500">Assistente:</span> {medico.nome}
                  {esp && <> · {esp.nome}</>}
                </p>
              )}
              {careTeam && careTeam.participantes.length > 0 && (
                <ul className="space-y-0.5 mt-1">
                  {careTeam.participantes.slice(0, 6).map((pt) => {
                    const prof = getProfissionalById(pt.profissionalId);
                    return (
                      <li key={pt.profissionalId}>
                        <span className="text-neutral-500">{pt.papel.replace(/_/g, ' ')}:</span>{' '}
                        {prof?.nome ?? '—'}
                      </li>
                    );
                  })}
                </ul>
              )}
              {internacaoRaw.consultores.length > 0 && (
                <div className="mt-1">
                  <p className="text-neutral-500">Consultores:</p>
                  <ul className="space-y-0.5">
                    {internacaoRaw.consultores.map((c, i) => {
                      const r = getPractitionerRoleById(c.roleId);
                      const p = r ? getProfissionalById(r.profissionalId) : undefined;
                      return (
                        <li key={i}>
                          {p?.nome ?? '—'} · {c.tipo}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Alergias */}
          {paciente.alergias.length > 0 && (
            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">
                Alergias
              </h3>
              <ul className="space-y-1">
                {paciente.alergias.map((a, i) => (
                  <li key={i} className="text-xs text-neutral-700">
                    {a.substancia} · {a.severidade} · {a.reacao}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </EntityPanel>
  );
}

function BedActionsView({ leito }: { leito: Location }) {
  const status = leito.operationalStatus ?? 'U';
  const org = leito.managingOrganizationId ? getOrganizationById(leito.managingOrganizationId) : undefined;
  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">
          Estado do leito
        </h3>
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-1 text-xs text-neutral-700">
          <p>
            <span className="text-neutral-500">Status:</span> {BED_STATUS_LABEL[status]}
          </p>
          {leito.tipoLeitoSus && (
            <p>
              <span className="text-neutral-500">Tipo SUS:</span> {leito.tipoLeitoSus.replace(/_/g, ' ')}
            </p>
          )}
          {leito.sexoDesignado && (
            <p>
              <span className="text-neutral-500">Sexo designado:</span> {leito.sexoDesignado}
            </p>
          )}
          {leito.isolamento && (
            <p>
              <span className="text-neutral-500">Isolamento:</span> {leito.isolamento}
            </p>
          )}
          {leito.coordenadas && (
            <p>
              <span className="text-neutral-500">Localizacao:</span> Andar {leito.coordenadas.andar} ·{' '}
              {leito.coordenadas.setor}
              {leito.coordenadas.sala && <> · {leito.coordenadas.sala}</>}
            </p>
          )}
          {org && (
            <p>
              <span className="text-neutral-500">Gestao:</span> {org.nome}
            </p>
          )}
        </div>
      </section>
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">
          Acoes
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" disabled>
            Reservar leito
          </Button>
          <Button variant="outline" size="sm" disabled>
            Solicitar limpeza
          </Button>
          <Button variant="outline" size="sm" disabled>
            Bloquear
          </Button>
        </div>
        <p className="text-[11px] text-neutral-500 mt-2">
          Acoes de gestao de leito serao habilitadas apos a integracao com o modulo de fluxos.
        </p>
      </section>
    </div>
  );
}
