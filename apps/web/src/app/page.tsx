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
  TURNOS,
  PRESENCAS_FISICAS,
  ESPECIALIDADES,
  PROFISSIONAIS,
  getProfissionalById,
  getPractitionerRoleById,
  getUnidadeById,
} from '../lib/fixtures/hospital-core';

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-neutral-900 tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-sm text-neutral-500">{hint}</div>}
    </div>
  );
}

export default function HomePage() {
  const stats = useMemo(() => {
    const totalLeitos = LOCATIONS.filter((l) => l.physicalType === 'bed').length;
    const ocupados = LOCATIONS.filter((l) => l.physicalType === 'bed' && l.operationalStatus === 'O').length;
    const disponiveis = LOCATIONS.filter((l) => l.physicalType === 'bed' && l.operationalStatus === 'U').length;
    const limpeza = LOCATIONS.filter((l) => l.physicalType === 'bed' && l.operationalStatus === 'H').length;
    const bloqueados = LOCATIONS.filter((l) => l.physicalType === 'bed' && l.operationalStatus === 'C').length;

    const turnosAtivos = TURNOS.filter((t) => t.status === 'em_andamento');

    const internadosAtivos = INTERNACOES.filter(
      (i) => i.status === 'internado' || i.status === 'em_admissao' || i.status === 'alta_solicitada',
    );

    const newsElevado = internadosAtivos.filter((i) => typeof i.newsScore === 'number' && i.newsScore >= 5).length;
    const altaSolicitada = INTERNACOES.filter((i) => i.status === 'alta_solicitada').length;

    return {
      totalLeitos,
      ocupados,
      disponiveis,
      limpeza,
      bloqueados,
      ocupacaoPct: totalLeitos > 0 ? Math.round((ocupados / totalLeitos) * 100) : 0,
      turnosAtivos: turnosAtivos.length,
      internados: internadosAtivos.length,
      newsElevado,
      altaSolicitada,
      totalEspecialidades: ESPECIALIDADES.length,
      totalProfissionais: PROFISSIONAIS.length,
      totalUnidades: UNIDADES_ASSISTENCIAIS.length,
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

  const equipePlantao = useMemo(() => {
    const rows = TURNOS.filter((t) => t.status === 'em_andamento').map((t) => {
      const role = getPractitionerRoleById(t.practitionerRoleId);
      const prof = role ? getProfissionalById(role.profissionalId) : null;
      const unidade = getUnidadeById(t.unidadeId);
      const presenca = PRESENCAS_FISICAS.find((p) => p.turnoId === t.id);
      return { turno: t, role, prof, unidade, presenca };
    });
    const porCategoria: Record<string, number> = {};
    for (const r of rows) {
      const cat = r.prof?.categoria ?? 'desconhecido';
      porCategoria[cat] = (porCategoria[cat] ?? 0) + 1;
    }
    return {
      total: rows.length,
      presentes: rows.filter((r) => r.presenca?.status === 'presente').length,
      medicos: porCategoria['medico'] ?? 0,
      enfermeiros: (porCategoria['enfermeiro'] ?? 0) + (porCategoria['tecnico_enfermagem'] ?? 0),
      multi: rows.length - (porCategoria['medico'] ?? 0) - (porCategoria['enfermeiro'] ?? 0) - (porCategoria['tecnico_enfermagem'] ?? 0),
    };
  }, []);

  return (
    <AppShell pageTitle="Visao Geral">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Visao Geral</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Hospital Velya Central — {stats.totalUnidades} unidades, {stats.totalLeitos} leitos, {stats.internados} internacoes ativas
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Leitos" value={stats.totalLeitos} hint={`${stats.totalUnidades} unidades`} />
        <Stat label="Ocupados" value={stats.ocupados} hint={`${stats.ocupacaoPct}% ocupacao`} />
        <Stat label="Disponiveis" value={stats.disponiveis} />
        <Stat label="Em limpeza" value={stats.limpeza} />
        <Stat label="Bloqueados" value={stats.bloqueados} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Internacoes" value={stats.internados} />
        <Stat label="NEWS >= 5" value={stats.newsElevado} hint="pacientes em alerta" />
        <Stat label="Alta solicitada" value={stats.altaSolicitada} />
        <Stat label="Equipe em plantao" value={equipePlantao.total} hint={`${equipePlantao.presentes} presentes`} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/unidades"
          className="group rounded-lg border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-400"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Unidades</div>
          <div className="mt-2 text-xl font-semibold text-neutral-900">{stats.totalUnidades}</div>
          <p className="mt-1 text-sm text-neutral-500">UTI, enfermarias, PS, centro cirurgico</p>
        </Link>
        <Link
          href="/specialties"
          className="group rounded-lg border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-400"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Especialidades</div>
          <div className="mt-2 text-xl font-semibold text-neutral-900">{stats.totalEspecialidades}</div>
          <p className="mt-1 text-sm text-neutral-500">medicas e multiprofissionais</p>
        </Link>
        <Link
          href="/staff-on-duty"
          className="group rounded-lg border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-400"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Equipe em Plantao</div>
          <div className="mt-2 text-xl font-semibold text-neutral-900">{equipePlantao.total}</div>
          <p className="mt-1 text-sm text-neutral-500">
            {equipePlantao.medicos} med · {equipePlantao.enfermeiros} enf · {equipePlantao.multi} multi
          </p>
        </Link>
        <Link
          href="/tasks"
          className="group rounded-lg border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-400"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Tarefas</div>
          <div className="mt-2 text-xl font-semibold text-neutral-900">Kanban</div>
          <p className="mt-1 text-sm text-neutral-500">delegacao, SLA, drag-and-drop</p>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Unidades Assistenciais</h2>
            <Link href="/unidades" className="text-sm text-neutral-700 underline hover:text-neutral-900">
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
