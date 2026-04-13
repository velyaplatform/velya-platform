'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { AppShell } from './components/app-shell';
import { Badge } from './components/ui/badge';
import { Card, CardContent, CardHeader } from './components/ui/card';
import {
  UNIDADES_ASSISTENCIAIS,
  LOCATIONS,
  INTERNACOES,
  TRANSFERENCIAS_INTERNAS,
  TURNOS,
  PRESENCAS_FISICAS,
  PRACTITIONER_ROLES,
  ESPECIALIDADES,
  PROFISSIONAIS,
  EVOLUCOES_CLINICAS,
  PRESCRICOES,
  SOLICITACOES_EXAME,
} from '../lib/fixtures/hospital-core';

const NOW = new Date('2026-04-12T10:30:00-03:00').getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-neutral-900 tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-sm text-neutral-500">{hint}</div>}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-400"
      >
        {content}
      </Link>
    );
  }
  return <div className="rounded-lg border border-neutral-200 bg-white p-5">{content}</div>;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded border border-neutral-200 bg-white px-4 py-3">
      <span className="text-sm text-neutral-700">{label}</span>
      <span className="text-lg font-semibold text-neutral-900 tabular-nums">{value}</span>
    </div>
  );
}

export default function HomePage() {
  const capacidade = useMemo(() => {
    const beds = LOCATIONS.filter((l) => l.physicalType === 'bed');
    return {
      total: beds.length,
      ocupados: beds.filter((l) => l.operationalStatus === 'O').length,
      disponiveis: beds.filter((l) => l.operationalStatus === 'U').length,
      limpeza: beds.filter((l) => l.operationalStatus === 'H').length,
      bloqueados: beds.filter((l) => l.operationalStatus === 'C').length,
      isolamento: beds.filter((l) => l.isolamento !== undefined).length,
    };
  }, []);

  const estrutura = useMemo(() => {
    const medicasCrm = ESPECIALIDADES.filter((e) => e.conselho === 'CRM').length;
    const multi = ESPECIALIDADES.filter((e) => e.conselho !== 'CRM').length;
    return {
      unidades: UNIDADES_ASSISTENCIAIS.length,
      especialidades: ESPECIALIDADES.length,
      medicasCrm,
      multi,
      profissionaisVinculados: PROFISSIONAIS.filter((p) => p.ativo).length,
    };
  }, []);

  const equipe = useMemo(() => {
    const turnosAtivos = TURNOS.filter((t) => t.status === 'em_andamento');
    const presencas = PRESENCAS_FISICAS.filter((p) => p.status === 'presente');

    // Map role -> profissional categoria
    let medicos = 0;
    let enfermagem = 0;
    let multi = 0;
    for (const t of turnosAtivos) {
      const role = PRACTITIONER_ROLES.find((r) => r.id === t.practitionerRoleId);
      if (!role) continue;
      const prof = PROFISSIONAIS.find((p) => p.id === role.profissionalId);
      if (!prof) continue;
      if (prof.categoria === 'medico') medicos++;
      else if (prof.categoria === 'enfermeiro' || prof.categoria === 'tecnico_enfermagem' || prof.categoria === 'auxiliar_enfermagem') enfermagem++;
      else multi++;
    }

    return {
      total: turnosAtivos.length,
      presentes: presencas.length,
      medicos,
      enfermagem,
      multi,
    };
  }, []);

  const passado = useMemo(() => {
    const since = NOW - DAY_MS;
    const admissoes24h = INTERNACOES.filter((i) => {
      const t = new Date(i.admissao.em).getTime();
      return t >= since && t <= NOW;
    }).length;
    const altas24h = INTERNACOES.filter((i) => {
      if (!i.alta) return false;
      const t = new Date(i.alta.em).getTime();
      return t >= since && t <= NOW;
    }).length;
    const obitos24h = INTERNACOES.filter((i) => {
      if (!i.alta) return false;
      const t = new Date(i.alta.em).getTime();
      return (
        t >= since &&
        t <= NOW &&
        (i.alta.tipo === 'obito_com_necropsia' || i.alta.tipo === 'obito_sem_necropsia')
      );
    }).length;
    const transferencias24h = TRANSFERENCIAS_INTERNAS.filter((tr) => {
      if (!tr.executadoEm) return false;
      const t = new Date(tr.executadoEm).getTime();
      return t >= since && t <= NOW;
    }).length;
    const evolucoes24h = EVOLUCOES_CLINICAS.filter((e) => {
      const t = new Date(e.em).getTime();
      return t >= since && t <= NOW;
    }).length;
    const examesLaudados24h = SOLICITACOES_EXAME.filter((e) => {
      if (!e.laudadoEm) return false;
      const t = new Date(e.laudadoEm).getTime();
      return t >= since && t <= NOW;
    }).length;
    const prescricoes24h = PRESCRICOES.filter((p) => {
      const t = new Date(p.em).getTime();
      return t >= since && t <= NOW;
    }).length;

    return {
      admissoes: admissoes24h,
      altas: altas24h,
      obitos: obitos24h,
      transferencias: transferencias24h,
      evolucoes: evolucoes24h,
      examesLaudados: examesLaudados24h,
      prescricoes: prescricoes24h,
    };
  }, []);

  const presente = useMemo(() => {
    const internadosAtivos = INTERNACOES.filter(
      (i) => i.status === 'internado' || i.status === 'em_admissao' || i.status === 'alta_solicitada',
    );
    const newsElevado = internadosAtivos.filter(
      (i) => typeof i.newsScore === 'number' && i.newsScore >= 5,
    ).length;
    const altaSolicitada = INTERNACOES.filter((i) => i.status === 'alta_solicitada').length;
    const emTransferencia = INTERNACOES.filter((i) => i.status === 'em_transferencia').length;
    const interconsPendentes = internadosAtivos.reduce((acc, i) => {
      return acc + i.consultores.filter((c) => !c.respostaEm).length;
    }, 0);
    const examesEmAnalise = SOLICITACOES_EXAME.filter(
      (e) => e.status === 'em_analise' || e.status === 'coletado',
    ).length;
    const examesSolicitados = SOLICITACOES_EXAME.filter((e) => e.status === 'solicitado').length;
    const prescricoesAtivas = PRESCRICOES.filter((p) => p.status === 'ativa').length;

    return {
      internados: internadosAtivos.length,
      newsElevado,
      altaSolicitada,
      emTransferencia,
      interconsPendentes,
      examesEmAnalise,
      examesSolicitados,
      prescricoesAtivas,
    };
  }, []);

  const futuro = useMemo(() => {
    const altaSolicitadaCount = INTERNACOES.filter((i) => i.status === 'alta_solicitada').length;
    const slaRisco = SOLICITACOES_EXAME.filter((e) => {
      if (e.status === 'laudado' || e.status === 'entregue' || e.status === 'cancelado') return false;
      return e.urgencia === 'urgente' || e.urgencia === 'emergente';
    }).length;
    const turnoTransicao = TURNOS.filter((t) => t.status === 'agendado').length;

    return {
      altasPlanejadas: altaSolicitadaCount,
      slaRisco,
      turnoTransicao,
    };
  }, []);

  const slaMetrics = useMemo(() => {
    const examesLaudados = SOLICITACOES_EXAME.filter((e) => e.laudadoEm && e.solicitadoEm);
    let totalLaudoMs = 0;
    for (const e of examesLaudados) {
      totalLaudoMs += new Date(e.laudadoEm!).getTime() - new Date(e.solicitadoEm).getTime();
    }
    const meanLaudoMin = examesLaudados.length > 0 ? Math.round(totalLaudoMs / examesLaudados.length / 60000) : 0;

    const prescricoesValidadas = PRESCRICOES.filter((p) => p.farmaceuticoValidouEm);
    let totalValidMs = 0;
    for (const p of prescricoesValidadas) {
      totalValidMs += new Date(p.farmaceuticoValidouEm!).getTime() - new Date(p.em).getTime();
    }
    const meanValidMin = prescricoesValidadas.length > 0 ? Math.round(totalValidMs / prescricoesValidadas.length / 60000) : 0;

    const withinSla = examesLaudados.filter((e) => {
      const ms = new Date(e.laudadoEm!).getTime() - new Date(e.solicitadoEm).getTime();
      const target =
        e.urgencia === 'emergente' ? 30 * 60000 : e.urgencia === 'urgente' ? 2 * 3600000 : 4 * 3600000;
      return ms <= target;
    }).length;
    const slaCumprido = examesLaudados.length > 0 ? Math.round((withinSla / examesLaudados.length) * 100) : 100;

    return {
      meanLaudoMin,
      meanValidMin,
      slaCumprido,
      examesLaudados: examesLaudados.length,
      prescricoesValidadas: prescricoesValidadas.length,
    };
  }, []);

  const unidadesResumo = useMemo(() => {
    return UNIDADES_ASSISTENCIAIS.map((u) => {
      const leitos = LOCATIONS.filter((l) => l.physicalType === 'bed' && u.leitoIds.includes(l.id));
      const ocupados = leitos.filter((l) => l.operationalStatus === 'O').length;
      const internacoes = INTERNACOES.filter(
        (i) => i.unidadeAtualId === u.id && (i.status === 'internado' || i.status === 'alta_solicitada'),
      );
      const newsElevado = internacoes.filter((i) => typeof i.newsScore === 'number' && i.newsScore >= 5).length;
      const pctOcup = leitos.length > 0 ? Math.round((ocupados / leitos.length) * 100) : 0;
      return {
        id: u.id,
        nome: u.nome,
        codigo: u.codigo,
        capacidade: leitos.length,
        ocupados,
        pctOcup,
        newsElevado,
      };
    }).sort((a, b) => b.pctOcup - a.pctOcup);
  }, []);

  return (
    <AppShell pageTitle="Visao Geral">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Visao Geral</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Hospital Velya Central — 12 de abril de 2026, 10:30
        </p>
      </div>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Capacidade
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Total leitos" value={capacidade.total} />
        <Stat
          label="Ocupados"
          value={capacidade.ocupados}
          hint={`${Math.round((capacidade.ocupados / capacidade.total) * 100)}%`}
        />
        <Stat label="Disponiveis" value={capacidade.disponiveis} />
        <Stat label="Em limpeza" value={capacidade.limpeza} />
        <Stat label="Bloqueados" value={capacidade.bloqueados} />
        <Stat label="Isolamento" value={capacidade.isolamento} />
      </div>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Estrutura
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Unidades" value={estrutura.unidades} href="/unidades" />
        <Stat label="Especialidades" value={estrutura.especialidades} href="/specialties" />
        <Stat label="Medicas CRM" value={estrutura.medicasCrm} />
        <Stat label="Multi profissional" value={estrutura.multi} />
        <Stat label="Profissionais" value={estrutura.profissionaisVinculados} hint="vinculados" />
      </div>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Equipe agora
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Em plantao" value={equipe.total} />
        <Stat label="Medicos" value={equipe.medicos} />
        <Stat label="Enfermagem" value={equipe.enfermagem} />
        <Stat label="Multi profissional" value={equipe.multi} />
        <Stat
          label="Presentes"
          value={equipe.presentes}
          hint={equipe.total > 0 ? `${Math.round((equipe.presentes / equipe.total) * 100)}%` : undefined}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-neutral-900">O que aconteceu — 24h</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <MiniStat label="Admissoes" value={passado.admissoes} />
            <MiniStat label="Altas" value={passado.altas} />
            <MiniStat label="Obitos" value={passado.obitos} />
            <MiniStat label="Transferencias" value={passado.transferencias} />
            <MiniStat label="Evolucoes clinicas" value={passado.evolucoes} />
            <MiniStat label="Exames laudados" value={passado.examesLaudados} />
            <MiniStat label="Prescricoes" value={passado.prescricoes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-neutral-900">O que esta acontecendo</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <MiniStat label="Internados" value={presente.internados} />
            <MiniStat label="NEWS >= 5" value={presente.newsElevado} />
            <MiniStat label="Alta solicitada" value={presente.altaSolicitada} />
            <MiniStat label="Em transferencia" value={presente.emTransferencia} />
            <MiniStat label="Interconsultas pendentes" value={presente.interconsPendentes} />
            <MiniStat label="Exames em analise" value={presente.examesEmAnalise} />
            <MiniStat label="Prescricoes ativas" value={presente.prescricoesAtivas} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-neutral-900">O que vai acontecer — 24h</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <MiniStat label="Altas planejadas" value={futuro.altasPlanejadas} />
            <MiniStat label="Turnos agendados" value={futuro.turnoTransicao} />
            <MiniStat label="SLAs em risco" value={futuro.slaRisco} />
            <MiniStat label="Exames aguardando" value={presente.examesSolicitados} />
            <div className="pt-2 text-xs text-neutral-500">
              Proximas trocas de turno: 13:00, 19:00, 07:00
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-sm font-semibold text-neutral-900">SLA e tempos medios</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <div className="text-xs text-neutral-500 uppercase tracking-wider">SLA cumprido</div>
              <div className="mt-1 text-2xl font-bold text-neutral-900 tabular-nums">
                {slaMetrics.slaCumprido}%
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {slaMetrics.examesLaudados} exames laudados
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500 uppercase tracking-wider">Tempo medio laudo</div>
              <div className="mt-1 text-2xl font-bold text-neutral-900 tabular-nums">
                {slaMetrics.meanLaudoMin} min
              </div>
              <div className="mt-1 text-xs text-neutral-500">da solicitacao ao laudo</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500 uppercase tracking-wider">Tempo validacao Rx</div>
              <div className="mt-1 text-2xl font-bold text-neutral-900 tabular-nums">
                {slaMetrics.meanValidMin} min
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {slaMetrics.prescricoesValidadas} prescricoes
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500 uppercase tracking-wider">SLA em risco</div>
              <div className="mt-1 text-2xl font-bold text-neutral-900 tabular-nums">
                {futuro.slaRisco}
              </div>
              <div className="mt-1 text-xs text-neutral-500">urgentes em curso</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <Link href="/tasks" className="text-sm text-neutral-700 underline hover:text-neutral-900">
              Abrir Tarefas para gerenciamento detalhado
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Ocupacao por unidade</h2>
            <Link href="/unidades" className="text-xs text-neutral-700 underline hover:text-neutral-900">
              Ver todas
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="pb-3 pr-4">Unidade</th>
                  <th className="pb-3 pr-4">Codigo</th>
                  <th className="pb-3 pr-4">Leitos</th>
                  <th className="pb-3 pr-4">Ocupados</th>
                  <th className="pb-3 pr-4">Ocupacao</th>
                  <th className="pb-3 pr-4">NEWS alto</th>
                  <th className="pb-3 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {unidadesResumo.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50">
                    <td className="py-3 pr-4 font-medium text-neutral-900">{u.nome}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-neutral-500">{u.codigo}</td>
                    <td className="py-3 pr-4 tabular-nums text-neutral-900">{u.capacidade}</td>
                    <td className="py-3 pr-4 tabular-nums text-neutral-900">{u.ocupados}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-neutral-200">
                          <div
                            className="h-1.5 rounded-full bg-neutral-900"
                            style={{ width: `${u.pctOcup}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-neutral-700">{u.pctOcup}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {u.newsElevado > 0 ? (
                        <Badge variant="default">{u.newsElevado}</Badge>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/unidades/${u.id}`}
                        className="text-xs text-neutral-700 underline hover:text-neutral-900"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
