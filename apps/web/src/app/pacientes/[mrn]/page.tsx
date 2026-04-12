'use client';

/**
 * Patient Cockpit — single-page EHR replacement for Philips Tasy's tree-of-menus.
 *
 * Renders identity + location + alerts + clinical events for the active
 * internacao of a patient addressed by MRN. Monochromatic, dense, keyboard-driven.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '../../components/app-shell';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  PACIENTES,
  INTERNACOES,
  TRANSFERENCIAS_INTERNAS,
  getCareTeamPorInternacao,
  getEspecialidadeById,
  getEvolucoesPorInternacao,
  getExamesPorInternacao,
  getLocationById,
  getPractitionerRoleById,
  getPrescricoesPorInternacao,
  getProfissionalById,
  getSinaisVitaisPorInternacao,
  getUnidadeById,
} from '../../../lib/fixtures/hospital-core';
import type {
  CareTeamPapel,
  CategoriaProfissional,
  EvolucaoClinica,
  EvolucaoTipo,
  ExameCategoria,
  ExameStatus,
  ExameUrgencia,
  Internacao,
  Paciente,
  Prescricao,
  PrescricaoStatus,
  RegistroSinaisVitais,
  ScpCofen,
  SolicitacaoExame,
  TipoTransferencia,
  ViaAdministracao,
} from '../../../lib/hospital-core-types';

// ---------------------------------------------------------------------------
// Labels (PT-BR)
// ---------------------------------------------------------------------------

const EVOLUCAO_TIPO_LABEL: Record<EvolucaoTipo, string> = {
  admissao: 'Admissao',
  evolucao_diaria: 'Evolucao diaria',
  parecer: 'Parecer',
  interconsulta: 'Interconsulta',
  alta: 'Alta',
  procedimento: 'Procedimento',
  intercorrencia: 'Intercorrencia',
  rounds_multidisciplinar: 'Rounds multi',
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

const SCP_LABEL: Record<ScpCofen, string> = {
  minimos: 'Cuidados Minimos',
  intermediarios: 'Intermediario',
  alta_dependencia: 'Alta Dependencia',
  semi_intensivo: 'Semi-Intensivo',
  intensivo: 'Intensivo',
};

const PRESCRICAO_STATUS_LABEL: Record<PrescricaoStatus, string> = {
  rascunho: 'Rascunho',
  ativa: 'Ativa',
  suspensa: 'Suspensa',
  encerrada: 'Encerrada',
  reconciliada: 'Reconciliada',
};

const EXAME_STATUS_LABEL: Record<ExameStatus, string> = {
  solicitado: 'Solicitado',
  coletado: 'Coletado',
  em_analise: 'Em analise',
  laudado: 'Laudado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const EXAME_URGENCIA_LABEL: Record<ExameUrgencia, string> = {
  rotina: 'Rotina',
  urgente: 'Urgente',
  emergente: 'Emergente',
};

const EXAME_CATEGORIA_LABEL: Record<ExameCategoria, string> = {
  laboratorio: 'Laboratorio',
  imagem: 'Imagem',
  cardiologico: 'Cardiologico',
  endoscopia: 'Endoscopia',
  anatomopatologico: 'Anatomopatologico',
  funcional: 'Funcional',
  outros: 'Outros',
};

const VIA_LABEL: Record<ViaAdministracao, string> = {
  oral: 'VO',
  intravenosa: 'IV',
  intramuscular: 'IM',
  subcutanea: 'SC',
  topica: 'Topica',
  inalatoria: 'INAL',
  retal: 'Retal',
  sublingual: 'SL',
  oftalmica: 'Oftal.',
  otologica: 'Otol.',
  nasal: 'Nasal',
  enteral: 'Enteral',
  parenteral: 'Parenteral',
};

const TRANSFER_TIPO_LABEL: Record<TipoTransferencia, string> = {
  step_up: 'Step-up',
  step_down: 'Step-down',
  lateral: 'Lateral',
  reserva_cirurgia: 'Reserva Cirurgia',
  retorno_unidade: 'Retorno a Unidade',
};

const CARE_PAPEL_LABEL: Record<CareTeamPapel, string> = {
  medico_assistente: 'Medico assistente',
  enfermeiro_referencia: 'Enfermeiro de referencia',
  farmaceutico_clinico: 'Farmaceutico clinico',
  nutricionista: 'Nutricionista',
  fisioterapeuta: 'Fisioterapeuta',
  assistente_social: 'Assistente social',
  psicologo: 'Psicologo',
  medico_consultor: 'Medico consultor',
  familiar: 'Familiar',
  cuidador: 'Cuidador',
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const NOW_ANCHOR = new Date('2026-04-12T10:30:00-03:00');

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return '--';
}

function idadeFromISO(dataNascimento: string): number {
  const nasc = new Date(dataNascimento);
  let anos = NOW_ANCHOR.getFullYear() - nasc.getFullYear();
  const m = NOW_ANCHOR.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && NOW_ANCHOR.getDate() < nasc.getDate())) anos -= 1;
  return anos;
}

function diasInternado(admissaoEm: string): number {
  const adm = new Date(admissaoEm).getTime();
  const ms = NOW_ANCHOR.getTime() - adm;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatTimeHHmm(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDateDDMM(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

function formatDateTime(iso: string): string {
  return `${formatDateDDMM(iso)} ${formatTimeHHmm(iso)}`;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date(NOW_ANCHOR);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return `Hoje - ${formatDateDDMM(iso)}`;
  if (target.getTime() === yesterday.getTime()) return `Ontem - ${formatDateDDMM(iso)}`;
  const weekdays = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
  return `${formatDateDDMM(iso)} - ${weekdays[d.getDay()]}`;
}

function newsLevel(score: number | undefined): { label: string; level: 'baixo' | 'medio' | 'alto' } {
  if (score === undefined) return { label: 'Sem registro', level: 'baixo' };
  if (score >= 7) return { label: 'Alto', level: 'alto' };
  if (score >= 5) return { label: 'Medio', level: 'medio' };
  return { label: 'Baixo', level: 'baixo' };
}

// Vital-signs reference ranges (adult). Values outside are bolded.
function isOutOfRange(key: string, value: number | undefined): boolean {
  if (value === undefined) return false;
  switch (key) {
    case 'pressaoSistolica':
      return value < 90 || value > 160;
    case 'pressaoDiastolica':
      return value < 50 || value > 100;
    case 'frequenciaCardiaca':
      return value < 50 || value > 110;
    case 'frequenciaRespiratoria':
      return value < 10 || value > 24;
    case 'temperatura':
      return value < 35.5 || value >= 37.8;
    case 'saturacaoO2':
      return value < 92;
    case 'glicemiaCapilar':
      return value < 70 || value > 180;
    case 'dor':
      return value >= 4;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Author helper
// ---------------------------------------------------------------------------

function describeAuthor(roleId: string): { nome: string; categoria: string; especialidade: string } {
  const role = getPractitionerRoleById(roleId);
  if (!role) return { nome: 'Profissional nao identificado', categoria: '', especialidade: '' };
  const prof = getProfissionalById(role.profissionalId);
  const esp = role.especialidadeIds[0] ? getEspecialidadeById(role.especialidadeIds[0]) : undefined;
  return {
    nome: prof?.nome ?? 'Profissional',
    categoria: prof ? CATEGORIA_LABEL[prof.categoria] : '',
    especialidade: esp?.nome ?? '',
  };
}

// ---------------------------------------------------------------------------
// Timeline event union
// ---------------------------------------------------------------------------

type TimelineEvent =
  | { kind: 'evolucao'; at: string; data: EvolucaoClinica }
  | { kind: 'prescricao'; at: string; data: Prescricao }
  | { kind: 'exame'; at: string; data: SolicitacaoExame };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PatientCockpitPage() {
  const params = useParams<{ mrn: string }>();
  const mrnRaw = params?.mrn;
  const mrn = Array.isArray(mrnRaw) ? mrnRaw[0] : mrnRaw ?? '';

  const paciente: Paciente | undefined = useMemo(
    () => PACIENTES.find((p) => p.mrn === mrn),
    [mrn],
  );

  const internacao: Internacao | undefined = useMemo(() => {
    if (!paciente) return undefined;
    const active = INTERNACOES.filter(
      (i) =>
        i.pacienteId === paciente.id &&
        (i.status === 'internado' ||
          i.status === 'em_admissao' ||
          i.status === 'alta_solicitada'),
    );
    return active.sort((a, b) => b.admissao.em.localeCompare(a.admissao.em))[0];
  }, [paciente]);

  const [contextoOpen, setContextoOpen] = useState(false);

  // All data lookups are computed up-front so the hook order is stable across
  // renders, even when the early-return branches (no paciente / no internacao)
  // fire. Internal fields degrade to empty arrays when internacao is absent.
  const evolucoes = useMemo<EvolucaoClinica[]>(
    () => (internacao ? getEvolucoesPorInternacao(internacao.id) : []),
    [internacao],
  );
  const prescricoes = useMemo<Prescricao[]>(
    () => (internacao ? getPrescricoesPorInternacao(internacao.id) : []),
    [internacao],
  );
  const exames = useMemo<SolicitacaoExame[]>(
    () => (internacao ? getExamesPorInternacao(internacao.id) : []),
    [internacao],
  );
  const sinais = useMemo<RegistroSinaisVitais[]>(
    () => (internacao ? getSinaisVitaisPorInternacao(internacao.id) : []),
    [internacao],
  );

  const timeline = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];
    for (const e of evolucoes) events.push({ kind: 'evolucao', at: e.em, data: e });
    for (const p of prescricoes) events.push({ kind: 'prescricao', at: p.em, data: p });
    for (const x of exames) events.push({ kind: 'exame', at: x.solicitadoEm, data: x });
    events.sort((a, b) => b.at.localeCompare(a.at));
    return events;
  }, [evolucoes, prescricoes, exames]);

  const sinais48h = useMemo<RegistroSinaisVitais[]>(() => {
    const cutoff = NOW_ANCHOR.getTime() - 48 * 60 * 60 * 1000;
    return sinais.filter((s) => new Date(s.em).getTime() >= cutoff);
  }, [sinais]);

  // Keyboard shortcuts (E / P / X) — only when no input is focused.
  useEffect(() => {
    function isTextInputFocused(): boolean {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return false;
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTextInputFocused()) return;
      const k = e.key.toLowerCase();
      if (k === 'e') {
        e.preventDefault();
        window.alert('Nova Evolucao — funcionalidade em desenvolvimento');
      } else if (k === 'p') {
        e.preventDefault();
        window.alert('Nova Prescricao — funcionalidade em desenvolvimento');
      } else if (k === 'x') {
        e.preventDefault();
        window.alert('Solicitar Exame — funcionalidade em desenvolvimento');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Fallbacks -----------------------------------------------------------------

  if (!paciente) {
    return (
      <AppShell pageTitle="Paciente">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Card>
            <CardHeader>
              <h1 className="text-lg font-semibold text-neutral-900">Paciente nao encontrado</h1>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600">
                Nenhum paciente com MRN <span className="font-mono">{mrn}</span> encontrado no
                cadastro.
              </p>
              <div className="mt-4">
                <Link href="/patients" className="text-sm underline text-neutral-900">
                  Voltar para lista de pacientes
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (!internacao) {
    return (
      <AppShell pageTitle={paciente.nome}>
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Card>
            <CardHeader>
              <h1 className="text-lg font-semibold text-neutral-900">Sem internacao ativa</h1>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600">
                O paciente <span className="font-semibold">{paciente.nome}</span> (MRN{' '}
                <span className="font-mono">{paciente.mrn}</span>) nao possui internacao ativa no
                momento.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  // Data --------------------------------------------------------------------

  const leito = getLocationById(internacao.locationAtualId);
  const unidade = getUnidadeById(internacao.unidadeAtualId);
  const assistente = describeAuthor(internacao.medicoAssistenteRoleId);
  const consultoresCount = internacao.consultores.length;
  const careTeam = getCareTeamPorInternacao(internacao.id);
  const transferencias = TRANSFERENCIAS_INTERNAS.filter(
    (t) => t.internacaoId === internacao.id,
  ).sort((a, b) => b.solicitadoEm.localeCompare(a.solicitadoEm));

  const dias = diasInternado(internacao.admissao.em);
  const idade = idadeFromISO(paciente.dataNascimento);
  const sexoLabel = paciente.sexo === 'M' ? 'M' : paciente.sexo === 'F' ? 'F' : 'I';
  const news = newsLevel(internacao.newsScore);

  // ------------------------------------------------------------------------

  return (
    <AppShell pageTitle={paciente.nome}>
      <div className="flex">
        {/* Main column */}
        <div className="min-w-0 flex-1">
          {/* Sticky identity header */}
          <div
            className="sticky z-20 border-b border-neutral-200 bg-white"
            style={{ top: 0 }}
          >
            {/* Row 1: identity + location */}
            <div className="flex flex-wrap items-center gap-4 px-6 pt-4 pb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-sm font-semibold text-neutral-700">
                {initials(paciente.nome)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-base font-semibold text-neutral-900">
                    {paciente.nome}
                  </h1>
                  <span className="font-mono text-xs text-neutral-500">{paciente.mrn}</span>
                </div>
                <div className="mt-0.5 text-xs text-neutral-600">
                  {sexoLabel} &middot; {idade} anos
                  {paciente.tipoSanguineo ? ` · ${paciente.tipoSanguineo}` : ''}
                  {paciente.convenio ? ` · ${paciente.convenio.nome}` : ''}
                </div>
              </div>

              <div className="hidden h-8 w-px bg-neutral-200 md:block" aria-hidden />

              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                  Localizacao
                </div>
                <div className="mt-0.5 text-sm text-neutral-900">
                  {leito?.nome ?? 'Leito ?'}
                  {unidade ? (
                    <>
                      {' - '}
                      <Link
                        href={`/unidades/${unidade.id}`}
                        className="underline decoration-neutral-400 hover:decoration-neutral-900"
                      >
                        {unidade.nome}
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="hidden h-8 w-px bg-neutral-200 md:block" aria-hidden />

              <div>
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                  Dias internado
                </div>
                <div className="mt-0.5 font-mono text-sm text-neutral-900">{dias} dias</div>
              </div>

              <div className="hidden h-8 w-px bg-neutral-200 md:block" aria-hidden />

              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                  Diagnostico principal
                </div>
                <div className="mt-0.5 truncate text-sm text-neutral-900">
                  <span className="font-mono text-xs">{internacao.cidPrincipal ?? '---'}</span>
                  {internacao.hipoteseDiagnostica ? (
                    <span className="ml-2 text-neutral-700">
                      {internacao.hipoteseDiagnostica}
                    </span>
                  ) : null}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setContextoOpen((v) => !v)}
                aria-expanded={contextoOpen}
              >
                {contextoOpen ? 'Fechar Contexto' : 'Contexto'}
              </Button>
            </div>

            {/* Row 2: alerts + scores + team */}
            <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 px-6 py-2">
              {paciente.alergias.length > 0
                ? paciente.alergias.map((a, idx) => (
                    <Badge key={`alergia-${idx}`} variant="outline" withDot>
                      Alergia: {a.substancia} ({a.severidade})
                    </Badge>
                  ))
                : (
                    <Badge variant="outline">Sem alergias registradas</Badge>
                  )}

              {paciente.alertas.map((al, idx) => (
                <Badge key={`alerta-${idx}`} variant="default" withDot>
                  {al.descricao}
                </Badge>
              ))}

              {internacao.scpAtual ? (
                <Badge variant="default">SCP: {SCP_LABEL[internacao.scpAtual]}</Badge>
              ) : null}

              <Badge variant="default">
                NEWS{' '}
                <span className="ml-1 font-mono">{internacao.newsScore ?? '--'}</span>
                <span className="ml-1 text-neutral-600">/ {news.label}</span>
              </Badge>

              <div className="ml-auto flex items-center gap-3 text-xs text-neutral-700">
                <span className="text-neutral-500">Assistente:</span>
                <span className="font-medium text-neutral-900">
                  {assistente.nome}
                </span>
                {assistente.especialidade ? (
                  <span className="text-neutral-600">- {assistente.especialidade}</span>
                ) : null}
                <span className="mx-2 h-4 w-px bg-neutral-200" aria-hidden />
                <span className="text-neutral-500">Consultores:</span>
                <span className="font-mono text-neutral-900">{consultoresCount}</span>
              </div>
            </div>

            {/* Quick actions bar */}
            <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 bg-neutral-50 px-6 py-2">
              <Button
                size="sm"
                onClick={() => window.alert('Nova Evolucao — funcionalidade em desenvolvimento')}
                title="Tecla de atalho: E"
              >
                Nova Evolucao
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.alert('Nova Prescricao — funcionalidade em desenvolvimento')}
                title="Tecla de atalho: P"
              >
                Nova Prescricao
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.alert('Solicitar Exame — funcionalidade em desenvolvimento')}
                title="Tecla de atalho: X"
              >
                Solicitar Exame
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  window.alert('Registrar Sinais Vitais — funcionalidade em desenvolvimento')
                }
              >
                Registrar Sinais
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.alert('Solicitar Parecer — funcionalidade em desenvolvimento')}
              >
                Solicitar Parecer
              </Button>
              {internacao.status === 'alta_solicitada' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.alert('Fluxo de alta — funcionalidade em desenvolvimento')}
                >
                  Alta
                </Button>
              ) : null}

              <div className="ml-auto text-[11px] text-neutral-500">
                Atalhos: E (evolucao) · P (prescricao) · X (exame)
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="timeline" className="px-6 pt-4 pb-10">
            <TabsList>
              <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
              <TabsTrigger value="evolucoes">Evolucoes</TabsTrigger>
              <TabsTrigger value="prescricoes">Prescricoes</TabsTrigger>
              <TabsTrigger value="exames">Exames</TabsTrigger>
              <TabsTrigger value="sinais">Sinais Vitais</TabsTrigger>
              <TabsTrigger value="equipe">Equipe</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <TimelineView events={timeline} />
            </TabsContent>

            <TabsContent value="evolucoes">
              <EvolucoesView evolucoes={evolucoes} />
            </TabsContent>

            <TabsContent value="prescricoes">
              <PrescricoesView prescricoes={prescricoes} />
            </TabsContent>

            <TabsContent value="exames">
              <ExamesView exames={exames} />
            </TabsContent>

            <TabsContent value="sinais">
              <SinaisView sinais={sinais48h} />
            </TabsContent>

            <TabsContent value="equipe">
              <EquipeView careTeam={careTeam} internacao={internacao} />
            </TabsContent>

            <TabsContent value="documentos">
              <DocumentosView />
            </TabsContent>
          </Tabs>
        </div>

        {/* Side context panel */}
        {contextoOpen ? (
          <aside className="hidden w-80 shrink-0 border-l border-neutral-200 bg-white lg:block">
            <ContextPanel
              transferencias={transferencias}
              ultimaEvolucao={evolucoes[0]}
              ultimaPrescricao={prescricoes.find((p) => p.status === 'ativa') ?? prescricoes[0]}
              ultimosSinais={sinais[0]}
              consultoresCount={consultoresCount}
            />
          </aside>
        ) : null}
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Timeline view
// ---------------------------------------------------------------------------

function TimelineView({ events }: { events: TimelineEvent[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of events) {
      const k = dayKey(ev.at);
      const arr = map.get(k) ?? [];
      arr.push(ev);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [events]);

  if (events.length === 0) {
    return <EmptyState message="Nenhum evento clinico registrado ainda." />;
  }

  return (
    <div className="flex flex-col">
      {groups.map(([k, evs]) => (
        <section key={k} className="relative">
          <div className="sticky top-[180px] z-10 -mx-6 border-b border-neutral-200 bg-neutral-50 px-6 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-600">
            {dayLabel(evs[0].at)}
          </div>
          <ul className="divide-y divide-neutral-100">
            {evs.map((ev, idx) => {
              const rowKey = `${ev.kind}-${ev.kind === 'evolucao' ? ev.data.id : ev.kind === 'prescricao' ? ev.data.id : ev.data.id}-${idx}`;
              const open = !!expanded[rowKey];
              return (
                <li
                  key={rowKey}
                  className="flex gap-4 border-l-2 border-neutral-400 py-3 pl-4 pr-2"
                >
                  <div className="w-16 shrink-0 font-mono text-xs text-neutral-600">
                    {formatTimeHHmm(ev.at)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <TimelineRow
                      ev={ev}
                      open={open}
                      onToggle={() =>
                        setExpanded((s) => ({ ...s, [rowKey]: !s[rowKey] }))
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TimelineRow({
  ev,
  open,
  onToggle,
}: {
  ev: TimelineEvent;
  open: boolean;
  onToggle: () => void;
}) {
  if (ev.kind === 'evolucao') {
    const e = ev.data;
    const autor = describeAuthor(e.autorRoleId);
    const resumo =
      (e.avaliacao ? e.avaliacao : null) ??
      (e.subjetivo ? e.subjetivo : null) ??
      e.texto ??
      'Evolucao sem resumo.';
    return (
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-neutral-900">
            {EVOLUCAO_TIPO_LABEL[e.tipo]}
          </span>
          <span className="text-neutral-500">·</span>
          <span className="text-neutral-700">{autor.nome}</span>
          <span className="text-neutral-500">({CATEGORIA_LABEL[e.autorCategoria]})</span>
          {autor.especialidade ? (
            <span className="text-neutral-500">- {autor.especialidade}</span>
          ) : null}
          {e.assinadoEm ? (
            <Badge size="sm" variant="outline">
              Assinada
            </Badge>
          ) : (
            <Badge size="sm" variant="outline">
              Rascunho
            </Badge>
          )}
        </div>
        <p
          className={
            'mt-1 text-sm text-neutral-700 ' +
            (open ? '' : 'line-clamp-1')
          }
        >
          {resumo}
        </p>
        {open && (e.subjetivo || e.objetivo || e.avaliacao || e.plano) ? (
          <SoapBlocks
            s={e.subjetivo}
            o={e.objetivo}
            a={e.avaliacao}
            p={e.plano}
          />
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="xs" variant="outline" onClick={onToggle}>
            {open ? 'Recolher' : 'Ver completa'}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => window.alert('Responder evolucao — funcionalidade em desenvolvimento')}
          >
            Responder
          </Button>
        </div>
      </div>
    );
  }

  if (ev.kind === 'prescricao') {
    const p = ev.data;
    const autor = describeAuthor(p.prescritorRoleId);
    return (
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-neutral-900">Prescricao</span>
          <span className="font-mono text-xs text-neutral-500">{p.codigo}</span>
          <span className="text-neutral-500">·</span>
          <span className="text-neutral-700">{autor.nome}</span>
          {autor.especialidade ? (
            <span className="text-neutral-500">- {autor.especialidade}</span>
          ) : null}
          <Badge size="sm" variant="outline">
            {PRESCRICAO_STATUS_LABEL[p.status]}
          </Badge>
          <span className="text-xs text-neutral-500">
            {p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'}
          </span>
        </div>
        {open ? (
          <ul className="mt-2 space-y-1">
            {p.itens.map((it) => (
              <li
                key={it.id}
                className="flex flex-wrap items-baseline gap-2 border-l border-neutral-200 pl-2 text-sm text-neutral-800"
              >
                <span className="font-medium">{it.medicamento}</span>
                <span className="font-mono text-xs text-neutral-600">{it.dosagem}</span>
                <span className="text-xs text-neutral-500">
                  {VIA_LABEL[it.via]} · {it.frequencia}
                </span>
                {it.ehSos ? <Badge size="sm" variant="outline">SOS</Badge> : null}
                {it.ehControlado ? <Badge size="sm" variant="outline">Controlado</Badge> : null}
                {it.ehAltaCusto ? <Badge size="sm" variant="outline">Alto custo</Badge> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 truncate text-sm text-neutral-700">
            {p.itens
              .slice(0, 3)
              .map((it) => `${it.medicamento} ${it.dosagem}`)
              .join(' · ')}
            {p.itens.length > 3 ? ` · +${p.itens.length - 3}` : ''}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="xs" variant="outline" onClick={onToggle}>
            {open ? 'Recolher' : 'Ver itens'}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => window.alert('Suspender prescricao — funcionalidade em desenvolvimento')}
          >
            Suspender
          </Button>
        </div>
      </div>
    );
  }

  // Exame
  const x = ev.data;
  const solicitante = describeAuthor(x.solicitanteRoleId);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-medium text-neutral-900">
          Exame: {EXAME_CATEGORIA_LABEL[x.categoria]}
        </span>
        <span className="font-mono text-xs text-neutral-500">{x.codigo}</span>
        <span className="text-neutral-500">·</span>
        <span className="text-neutral-700">{x.nome}</span>
        <Badge size="sm" variant="outline">
          {EXAME_STATUS_LABEL[x.status]}
        </Badge>
        <Badge size="sm" variant="outline">
          {EXAME_URGENCIA_LABEL[x.urgencia]}
        </Badge>
        <span className="text-xs text-neutral-500">
          Solicitado por {solicitante.nome}
        </span>
      </div>
      {open ? (
        <div className="mt-2 space-y-1 text-sm text-neutral-700">
          <div>
            <span className="text-xs uppercase tracking-wider text-neutral-500">
              Justificativa:
            </span>{' '}
            {x.justificativa}
          </div>
          {x.hipotese ? (
            <div>
              <span className="text-xs uppercase tracking-wider text-neutral-500">Hipotese:</span>{' '}
              {x.hipotese}
            </div>
          ) : null}
          {x.resultado ? (
            <div>
              <span className="text-xs uppercase tracking-wider text-neutral-500">Resultado:</span>{' '}
              {x.resultado}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 truncate text-sm text-neutral-700">{x.justificativa}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="xs" variant="outline" onClick={onToggle}>
          {open ? 'Recolher' : x.status === 'laudado' ? 'Abrir laudo' : 'Ver detalhes'}
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => window.alert('Anexar resultado — funcionalidade em desenvolvimento')}
        >
          Anexar
        </Button>
      </div>
    </div>
  );
}

function SoapBlocks({
  s,
  o,
  a,
  p,
}: {
  s?: string;
  o?: string;
  a?: string;
  p?: string;
}) {
  const rows: { k: string; label: string; v?: string }[] = [
    { k: 's', label: 'S', v: s },
    { k: 'o', label: 'O', v: o },
    { k: 'a', label: 'A', v: a },
    { k: 'p', label: 'P', v: p },
  ];
  return (
    <div className="mt-2 space-y-1 text-sm text-neutral-700">
      {rows.map((r) =>
        r.v ? (
          <div key={r.k} className="flex gap-2">
            <span className="w-4 shrink-0 font-mono text-xs font-semibold text-neutral-500">
              {r.label}
            </span>
            <p>{r.v}</p>
          </div>
        ) : null,
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evolucoes tab
// ---------------------------------------------------------------------------

function EvolucoesView({ evolucoes }: { evolucoes: EvolucaoClinica[] }) {
  if (evolucoes.length === 0) {
    return <EmptyState message="Nenhuma evolucao registrada para esta internacao." />;
  }
  return (
    <div className="space-y-3">
      {evolucoes.map((e) => {
        const autor = describeAuthor(e.autorRoleId);
        const revisao = e.revisaoRoleId ? describeAuthor(e.revisaoRoleId) : null;
        return (
          <Card key={e.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-neutral-900">
                  {EVOLUCAO_TIPO_LABEL[e.tipo]}
                </span>
                <span className="font-mono text-xs text-neutral-500">
                  {formatDateTime(e.em)}
                </span>
                <span className="text-neutral-500">·</span>
                <span className="text-sm text-neutral-700">{autor.nome}</span>
                <span className="text-xs text-neutral-500">
                  ({CATEGORIA_LABEL[e.autorCategoria]}
                  {autor.especialidade ? ` - ${autor.especialidade}` : ''})
                </span>
                <Badge size="sm" variant="outline">
                  v{e.versao}
                </Badge>
                {e.assinadoEm ? (
                  <Badge size="sm" variant="outline">
                    Assinada {formatDateTime(e.assinadoEm)}
                  </Badge>
                ) : (
                  <Badge size="sm" variant="outline">
                    Nao assinada
                  </Badge>
                )}
              </div>
              <Button
                size="xs"
                variant="outline"
                onClick={() => window.alert('Nova versao — funcionalidade em desenvolvimento')}
              >
                Nova versao
              </Button>
            </CardHeader>
            <CardContent>
              {e.subjetivo || e.objetivo || e.avaliacao || e.plano ? (
                <SoapBlocks
                  s={e.subjetivo}
                  o={e.objetivo}
                  a={e.avaliacao}
                  p={e.plano}
                />
              ) : (
                <p className="text-sm text-neutral-700">{e.texto ?? '---'}</p>
              )}
              {revisao ? (
                <div className="mt-3 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
                  Revisao/Preceptor: {revisao.nome}
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prescricoes tab
// ---------------------------------------------------------------------------

function PrescricoesView({ prescricoes }: { prescricoes: Prescricao[] }) {
  if (prescricoes.length === 0) {
    return <EmptyState message="Nenhuma prescricao registrada para esta internacao." />;
  }
  const ativas = prescricoes.filter(
    (p) => p.status === 'ativa' || p.status === 'rascunho' || p.status === 'reconciliada',
  );
  const suspensas = prescricoes.filter((p) => p.status === 'suspensa');
  const encerradas = prescricoes.filter((p) => p.status === 'encerrada');

  return (
    <div className="space-y-6">
      <PrescricaoGroup titulo="Ativas" itens={ativas} />
      <PrescricaoGroup titulo="Suspensas" itens={suspensas} />
      <PrescricaoGroup titulo="Encerradas" itens={encerradas} />
    </div>
  );
}

function PrescricaoGroup({ titulo, itens }: { titulo: string; itens: Prescricao[] }) {
  if (itens.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">
        {titulo} ({itens.length})
      </h2>
      <div className="space-y-3">
        {itens.map((p) => (
          <PrescricaoCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}

function PrescricaoCard({ p }: { p: Prescricao }) {
  const prescritor = describeAuthor(p.prescritorRoleId);
  const farma = p.farmaceuticoRoleId ? describeAuthor(p.farmaceuticoRoleId) : null;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-neutral-900">{p.codigo}</span>
          <span className="font-mono text-xs text-neutral-500">{formatDateTime(p.em)}</span>
          <Badge size="sm" variant="outline">
            {PRESCRICAO_STATUS_LABEL[p.status]}
          </Badge>
          <span className="text-xs text-neutral-500">Prescritor: {prescritor.nome}</span>
          {farma ? (
            <span className="text-xs text-neutral-500">
              Farmaceutico validou em {p.farmaceuticoValidouEm ? formatDateTime(p.farmaceuticoValidouEm) : '---'}
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            size="xs"
            variant="outline"
            onClick={() => window.alert('Suspender — funcionalidade em desenvolvimento')}
          >
            Suspender
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => window.alert('Renovar — funcionalidade em desenvolvimento')}
          >
            Renovar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-2 py-1 font-semibold">Medicamento</th>
                <th className="px-2 py-1 font-semibold">Dose</th>
                <th className="px-2 py-1 font-semibold">Via</th>
                <th className="px-2 py-1 font-semibold">Frequencia</th>
                <th className="px-2 py-1 font-semibold">Flags</th>
                <th className="px-2 py-1 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {p.itens.map((it) => (
                <tr key={it.id} className="border-b border-neutral-100 align-top">
                  <td className="px-2 py-1.5 font-medium text-neutral-900">{it.medicamento}</td>
                  <td className="px-2 py-1.5 font-mono text-xs text-neutral-700">{it.dosagem}</td>
                  <td className="px-2 py-1.5 text-xs text-neutral-700">{VIA_LABEL[it.via]}</td>
                  <td className="px-2 py-1.5 text-xs text-neutral-700">{it.frequencia}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {it.ehSos ? <Badge size="sm" variant="outline">SOS</Badge> : null}
                      {it.ehControlado ? <Badge size="sm" variant="outline">Ctrl</Badge> : null}
                      {it.ehAltaCusto ? <Badge size="sm" variant="outline">AC</Badge> : null}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-neutral-700">{it.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.reconciliadaEm ? (
          <div className="mt-3 text-xs text-neutral-500">
            Reconciliacao em {formatDateTime(p.reconciliadaEm)}
          </div>
        ) : null}
        {p.observacoes ? (
          <div className="mt-2 text-xs text-neutral-600">Obs.: {p.observacoes}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exames tab
// ---------------------------------------------------------------------------

function ExamesView({ exames }: { exames: SolicitacaoExame[] }) {
  if (exames.length === 0) {
    return <EmptyState message="Nenhum exame solicitado para esta internacao." />;
  }
  const pendentes = exames.filter(
    (e) => e.status === 'solicitado' || e.status === 'coletado' || e.status === 'em_analise',
  );
  const laudados = exames.filter((e) => e.status === 'laudado' || e.status === 'entregue');
  const cancelados = exames.filter((e) => e.status === 'cancelado');
  return (
    <div className="space-y-6">
      <ExameGroup titulo="Pendentes" itens={pendentes} />
      <ExameGroup titulo="Laudados" itens={laudados} />
      <ExameGroup titulo="Cancelados" itens={cancelados} />
    </div>
  );
}

function ExameGroup({ titulo, itens }: { titulo: string; itens: SolicitacaoExame[] }) {
  if (itens.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">
        {titulo} ({itens.length})
      </h2>
      <div className="space-y-3">
        {itens.map((e) => (
          <ExameCard key={e.id} e={e} />
        ))}
      </div>
    </section>
  );
}

function ExameCard({ e }: { e: SolicitacaoExame }) {
  const solicitante = describeAuthor(e.solicitanteRoleId);
  const laudador = e.laudadorRoleId ? describeAuthor(e.laudadorRoleId) : null;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs text-neutral-500">{e.codigo}</span>
          <span className="text-sm font-semibold text-neutral-900">{e.nome}</span>
          <Badge size="sm" variant="outline">
            {EXAME_CATEGORIA_LABEL[e.categoria]}
          </Badge>
          <Badge size="sm" variant="outline">
            {EXAME_URGENCIA_LABEL[e.urgencia]}
          </Badge>
          <Badge size="sm" variant="outline">
            {EXAME_STATUS_LABEL[e.status]}
          </Badge>
          <span className="font-mono text-xs text-neutral-500">
            {formatDateTime(e.solicitadoEm)}
          </span>
        </div>
        <div className="flex gap-2">
          {e.status === 'laudado' || e.status === 'entregue' ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => window.alert('Abrir laudo — funcionalidade em desenvolvimento')}
            >
              Abrir laudo
            </Button>
          ) : (
            <Button
              size="xs"
              variant="outline"
              onClick={() => window.alert('Anexar resultado — funcionalidade em desenvolvimento')}
            >
              Anexar resultado
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            onClick={() => window.alert('Cancelar exame — funcionalidade em desenvolvimento')}
          >
            Cancelar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 text-sm text-neutral-700 md:grid-cols-2">
          <div>
            <span className="text-xs uppercase tracking-wider text-neutral-500">
              Solicitante:
            </span>{' '}
            {solicitante.nome}
          </div>
          {laudador ? (
            <div>
              <span className="text-xs uppercase tracking-wider text-neutral-500">Laudador:</span>{' '}
              {laudador.nome}
            </div>
          ) : null}
          <div className="md:col-span-2">
            <span className="text-xs uppercase tracking-wider text-neutral-500">
              Justificativa:
            </span>{' '}
            {e.justificativa}
          </div>
          {e.hipotese ? (
            <div className="md:col-span-2">
              <span className="text-xs uppercase tracking-wider text-neutral-500">Hipotese:</span>{' '}
              {e.hipotese}
            </div>
          ) : null}
          {e.resultado ? (
            <div className="md:col-span-2">
              <span className="text-xs uppercase tracking-wider text-neutral-500">Resultado:</span>{' '}
              {e.resultado}
            </div>
          ) : null}
        </div>
        {e.valoresCriticos && e.valoresCriticos.length > 0 ? (
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
              Valores criticos
            </div>
            <table className="mt-1 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-2 py-1 font-semibold">Analito</th>
                  <th className="px-2 py-1 font-semibold">Valor</th>
                  <th className="px-2 py-1 font-semibold">Referencia</th>
                  <th className="px-2 py-1 font-semibold">Flag</th>
                </tr>
              </thead>
              <tbody>
                {e.valoresCriticos.map((v, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="px-2 py-1">{v.nome}</td>
                    <td className="px-2 py-1 font-mono font-semibold text-neutral-900">
                      {v.valor}
                    </td>
                    <td className="px-2 py-1 text-xs text-neutral-600">{v.referencia}</td>
                    <td className="px-2 py-1 text-xs uppercase">{v.flag}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sinais vitais tab
// ---------------------------------------------------------------------------

function SinaisView({ sinais }: { sinais: RegistroSinaisVitais[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
          Ultimas 48h ({sinais.length} registros)
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.alert('Registrar sinais — funcionalidade em desenvolvimento')}
        >
          Registrar novos sinais
        </Button>
      </div>
      {sinais.length === 0 ? (
        <EmptyState message="Sem registros de sinais vitais nas ultimas 48 horas." />
      ) : (
        <Card>
          <CardContent className="pt-5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-2 py-1 font-semibold">Data/Hora</th>
                    <th className="px-2 py-1 font-semibold">PA (mmHg)</th>
                    <th className="px-2 py-1 font-semibold">FC</th>
                    <th className="px-2 py-1 font-semibold">FR</th>
                    <th className="px-2 py-1 font-semibold">T</th>
                    <th className="px-2 py-1 font-semibold">SpO2</th>
                    <th className="px-2 py-1 font-semibold">Glicemia</th>
                    <th className="px-2 py-1 font-semibold">Dor</th>
                    <th className="px-2 py-1 font-semibold">Consciencia</th>
                    <th className="px-2 py-1 font-semibold">Obs</th>
                  </tr>
                </thead>
                <tbody>
                  {sinais.map((s) => (
                    <tr key={s.id} className="border-b border-neutral-100 align-top">
                      <td className="px-2 py-1.5 font-mono text-xs text-neutral-700">
                        {formatDateTime(s.em)}
                      </td>
                      <td className="px-2 py-1.5 font-mono">
                        <span
                          className={
                            isOutOfRange('pressaoSistolica', s.pressaoSistolica)
                              ? 'font-bold text-neutral-900'
                              : 'text-neutral-700'
                          }
                        >
                          {s.pressaoSistolica ?? '--'}
                        </span>
                        /
                        <span
                          className={
                            isOutOfRange('pressaoDiastolica', s.pressaoDiastolica)
                              ? 'font-bold text-neutral-900'
                              : 'text-neutral-700'
                          }
                        >
                          {s.pressaoDiastolica ?? '--'}
                        </span>
                      </td>
                      <td
                        className={
                          'px-2 py-1.5 font-mono ' +
                          (isOutOfRange('frequenciaCardiaca', s.frequenciaCardiaca)
                            ? 'font-bold text-neutral-900'
                            : 'text-neutral-700')
                        }
                      >
                        {s.frequenciaCardiaca ?? '--'}
                      </td>
                      <td
                        className={
                          'px-2 py-1.5 font-mono ' +
                          (isOutOfRange('frequenciaRespiratoria', s.frequenciaRespiratoria)
                            ? 'font-bold text-neutral-900'
                            : 'text-neutral-700')
                        }
                      >
                        {s.frequenciaRespiratoria ?? '--'}
                      </td>
                      <td
                        className={
                          'px-2 py-1.5 font-mono ' +
                          (isOutOfRange('temperatura', s.temperatura)
                            ? 'font-bold text-neutral-900'
                            : 'text-neutral-700')
                        }
                      >
                        {s.temperatura ?? '--'}
                      </td>
                      <td
                        className={
                          'px-2 py-1.5 font-mono ' +
                          (isOutOfRange('saturacaoO2', s.saturacaoO2)
                            ? 'font-bold text-neutral-900'
                            : 'text-neutral-700')
                        }
                      >
                        {s.saturacaoO2 ?? '--'}
                      </td>
                      <td
                        className={
                          'px-2 py-1.5 font-mono ' +
                          (isOutOfRange('glicemiaCapilar', s.glicemiaCapilar)
                            ? 'font-bold text-neutral-900'
                            : 'text-neutral-700')
                        }
                      >
                        {s.glicemiaCapilar ?? '--'}
                      </td>
                      <td
                        className={
                          'px-2 py-1.5 font-mono ' +
                          (isOutOfRange('dor', s.dor)
                            ? 'font-bold text-neutral-900'
                            : 'text-neutral-700')
                        }
                      >
                        {s.dor ?? '--'}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-neutral-700">
                        {s.nivelConsciencia ?? '--'}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-neutral-600">
                        {s.observacoes ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Equipe tab
// ---------------------------------------------------------------------------

function EquipeView({
  careTeam,
  internacao,
}: {
  careTeam: ReturnType<typeof getCareTeamPorInternacao>;
  internacao: Internacao;
}) {
  if (!careTeam) {
    return <EmptyState message="Nao ha CareTeam estruturado para esta internacao." />;
  }

  const groups: Record<string, typeof careTeam.participantes> = {
    medico_assistente: [],
    medico_consultor: [],
    enfermagem: [],
    multiprofissional: [],
    familia: [],
  };
  for (const p of careTeam.participantes) {
    if (p.papel === 'medico_assistente') groups.medico_assistente.push(p);
    else if (p.papel === 'medico_consultor') groups.medico_consultor.push(p);
    else if (p.papel === 'enfermeiro_referencia') groups.enfermagem.push(p);
    else if (p.papel === 'familiar' || p.papel === 'cuidador') groups.familia.push(p);
    else groups.multiprofissional.push(p);
  }

  const labels: Array<[keyof typeof groups, string]> = [
    ['medico_assistente', 'Medico assistente'],
    ['medico_consultor', 'Medicos consultores'],
    ['enfermagem', 'Enfermagem de referencia'],
    ['multiprofissional', 'Equipe multiprofissional'],
    ['familia', 'Familia / cuidador'],
  ];

  return (
    <div className="space-y-6">
      {labels.map(([key, label]) => {
        const items = groups[key];
        if (items.length === 0) return null;
        return (
          <section key={key}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">
              {label} ({items.length})
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((p, idx) => {
                const prof = getProfissionalById(p.profissionalId);
                const esp = p.especialidadeId
                  ? getEspecialidadeById(p.especialidadeId)
                  : null;
                const role = getPractitionerRoleById(p.roleId);
                return (
                  <Card key={`${p.roleId}-${idx}`}>
                    <CardContent className="pt-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-xs font-semibold text-neutral-700">
                          {initials(prof?.nome ?? '??')}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-neutral-900">
                            {prof?.nome ?? 'Profissional'}
                          </div>
                          <div className="text-xs text-neutral-600">
                            {CARE_PAPEL_LABEL[p.papel]}
                            {esp ? ` - ${esp.nome}` : ''}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">
                            Desde {formatDateDDMM(p.desde)}
                            {p.ate ? ` ate ${formatDateDDMM(p.ate)}` : ''}
                          </div>
                          {prof?.email ? (
                            <div className="mt-1 font-mono text-xs text-neutral-600">
                              {prof.email}
                            </div>
                          ) : null}
                          {role ? (
                            <div className="mt-1 text-xs text-neutral-500">
                              Papel: {role.codigo}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}

      {internacao.consultores.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">
            Interconsultas registradas na internacao ({internacao.consultores.length})
          </h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {internacao.consultores.map((c, idx) => {
              const autor = describeAuthor(c.roleId);
              return (
                <Card key={`cons-${idx}`}>
                  <CardContent className="pt-5 text-sm">
                    <div className="font-semibold text-neutral-900">{autor.nome}</div>
                    <div className="text-xs text-neutral-600">
                      {autor.especialidade || 'Consultor'}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      Tipo: {c.tipo} · solicitado em {formatDateTime(c.solicitadoEm)}
                      {c.respostaEm ? ` · resposta em ${formatDateTime(c.respostaEm)}` : ''}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documentos tab (placeholder)
// ---------------------------------------------------------------------------

function DocumentosView() {
  const tipos = [
    'Sumario de admissao',
    'Consentimentos informados',
    'Laudos anexos',
    'Atestados e declaracoes',
    'Resumo de alta',
  ];
  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold text-neutral-900">Documentos</span>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-neutral-600">
          Modulo de documentos estruturados em desenvolvimento.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-neutral-700">
          {tipos.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Side context panel
// ---------------------------------------------------------------------------

function ContextPanel({
  transferencias,
  ultimaEvolucao,
  ultimaPrescricao,
  ultimosSinais,
  consultoresCount,
}: {
  transferencias: ReturnType<typeof TRANSFERENCIAS_INTERNAS.filter>;
  ultimaEvolucao?: EvolucaoClinica;
  ultimaPrescricao?: Prescricao;
  ultimosSinais?: RegistroSinaisVitais;
  consultoresCount: number;
}) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">
          Transferencias ({transferencias.length})
        </h3>
        {transferencias.length === 0 ? (
          <p className="text-xs text-neutral-500">Sem transferencias registradas.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {transferencias.slice(0, 4).map((t) => {
              const origem = getLocationById(t.origemLocationId);
              const destino = getLocationById(t.destinoLocationId);
              return (
                <li
                  key={t.id}
                  className="rounded border border-neutral-200 bg-neutral-50 p-2"
                >
                  <div className="font-mono text-[11px] text-neutral-500">
                    {formatDateTime(t.solicitadoEm)}
                  </div>
                  <div className="text-neutral-800">
                    {origem?.nome ?? '?'} → {destino?.nome ?? '?'}
                  </div>
                  <div className="text-neutral-500">
                    {TRANSFER_TIPO_LABEL[t.tipo]} · {t.motivo}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">
          Interconsultas ativas
        </h3>
        <p className="text-xs text-neutral-700">
          <span className="font-mono text-sm">{consultoresCount}</span>{' '}
          <span className="text-neutral-500">consultor(es) registrado(s)</span>
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">
          Ultimos sinais
        </h3>
        {ultimosSinais ? (
          <div className="rounded border border-neutral-200 p-2 text-xs">
            <div className="font-mono text-[11px] text-neutral-500">
              {formatDateTime(ultimosSinais.em)}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-neutral-800">
              <span>PA {ultimosSinais.pressaoSistolica ?? '--'}/{ultimosSinais.pressaoDiastolica ?? '--'}</span>
              <span>FC {ultimosSinais.frequenciaCardiaca ?? '--'}</span>
              <span>T {ultimosSinais.temperatura ?? '--'}</span>
              <span>SpO2 {ultimosSinais.saturacaoO2 ?? '--'}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-500">Sem registros.</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">
          Ultima evolucao
        </h3>
        {ultimaEvolucao ? (
          <div className="rounded border border-neutral-200 p-2 text-xs">
            <div className="font-mono text-[11px] text-neutral-500">
              {formatDateTime(ultimaEvolucao.em)} · {EVOLUCAO_TIPO_LABEL[ultimaEvolucao.tipo]}
            </div>
            <p className="mt-1 line-clamp-3 text-neutral-700">
              {ultimaEvolucao.avaliacao ??
                ultimaEvolucao.subjetivo ??
                ultimaEvolucao.texto ??
                '---'}
            </p>
          </div>
        ) : (
          <p className="text-xs text-neutral-500">Sem evolucoes.</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">
          Ultima prescricao ativa
        </h3>
        {ultimaPrescricao ? (
          <div className="rounded border border-neutral-200 p-2 text-xs">
            <div className="font-mono text-[11px] text-neutral-500">
              {ultimaPrescricao.codigo} · {formatDateTime(ultimaPrescricao.em)}
            </div>
            <p className="mt-1 line-clamp-3 text-neutral-700">
              {ultimaPrescricao.itens
                .slice(0, 3)
                .map((it) => `${it.medicamento} ${it.dosagem}`)
                .join(' · ')}
              {ultimaPrescricao.itens.length > 3
                ? ` · +${ultimaPrescricao.itens.length - 3}`
                : ''}
            </p>
          </div>
        ) : (
          <p className="text-xs text-neutral-500">Sem prescricoes.</p>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-neutral-600">{message}</p>
      </CardContent>
    </Card>
  );
}
