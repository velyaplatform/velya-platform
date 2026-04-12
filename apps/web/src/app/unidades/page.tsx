'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import {
  UNIDADES_ASSISTENCIAIS,
  LOCATIONS,
  ESPECIALIDADES,
  PROFISSIONAIS,
  PRACTITIONER_ROLES,
  TURNOS,
  HEALTHCARE_SERVICES,
  getLeitosPorUnidade,
  getEspecialidadesPorUnidade,
} from '../../lib/fixtures/hospital-core';
import type {
  UnidadeAssistencial,
  UnidadeTipo,
  NivelCuidado,
  BedOperationalStatus,
  Location,
} from '../../lib/hospital-core-types';

// ---------------------------------------------------------------------------
// Labels (PT-BR)
// ---------------------------------------------------------------------------

const TIPO_LABELS: Record<UnidadeTipo, string> = {
  pronto_socorro: 'Pronto Socorro',
  ambulatorio: 'Ambulatorio',
  internacao_clinica: 'Internacao Clinica',
  internacao_cirurgica: 'Internacao Cirurgica',
  internacao_obstetrica: 'Internacao Obstetrica',
  internacao_pediatrica: 'Internacao Pediatrica',
  uti_adulto: 'UTI Adulto',
  uti_pediatrica: 'UTI Pediatrica',
  uti_neonatal: 'UTI Neonatal',
  uti_coronariana: 'UTI Coronariana',
  uti_queimados: 'UTI Queimados',
  uci_adulto: 'UCI Adulto',
  uci_pediatrica: 'UCI Pediatrica',
  ucinco: 'UCINCO',
  ucinca: 'UCINCA',
  unidade_avc: 'Unidade AVC',
  centro_cirurgico: 'Centro Cirurgico',
  centro_obstetrico: 'Centro Obstetrico',
  hospital_dia: 'Hospital Dia',
  hemodinamica: 'Hemodinamica',
  endoscopia: 'Endoscopia',
  oncologia: 'Oncologia',
  psiquiatria: 'Psiquiatria',
  reabilitacao: 'Reabilitacao',
  sadt: 'SADT',
  cme: 'CME',
  banco_sangue: 'Banco de Sangue',
  farmacia_hospitalar: 'Farmacia Hospitalar',
  nutricao: 'Nutricao',
  apoio_administrativo: 'Apoio Administrativo',
  apoio_logistico: 'Apoio Logistico',
  apoio_diagnostico: 'Apoio Diagnostico',
};

const NIVEL_LABELS: Record<NivelCuidado, string> = {
  minimo: 'Minimo',
  intermediario: 'Intermediario',
  alta_dependencia: 'Alta Dependencia',
  semi_intensivo: 'Semi Intensivo',
  intensivo: 'Intensivo',
};

function computeBedStats(unidade: UnidadeAssistencial, leitos: Location[]) {
  let ocupados = 0;
  let limpeza = 0;
  let bloqueados = 0;
  let reservados = 0;
  let isolamento = 0;
  let disponiveis = 0;
  for (const b of leitos) {
    const s: BedOperationalStatus | undefined = b.operationalStatus;
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

function countEquipeNow(unidadeId: string): {
  medicos: number;
  enfermeiros: number;
  tecnicos: number;
  multiprofissionais: number;
} {
  const turnosAtivos = TURNOS.filter((t) => t.unidadeId === unidadeId && t.status === 'em_andamento');
  const roleIds = new Set(turnosAtivos.map((t) => t.practitionerRoleId));
  const roles = PRACTITIONER_ROLES.filter((r) => roleIds.has(r.id));
  const profIds = new Set(roles.map((r) => r.profissionalId));
  const profs = PROFISSIONAIS.filter((p) => profIds.has(p.id));
  let medicos = 0;
  let enfermeiros = 0;
  let tecnicos = 0;
  let multiprofissionais = 0;
  for (const p of profs) {
    if (p.categoria === 'medico') medicos += 1;
    else if (p.categoria === 'enfermeiro') enfermeiros += 1;
    else if (p.categoria === 'tecnico_enfermagem' || p.categoria === 'auxiliar_enfermagem') tecnicos += 1;
    else multiprofissionais += 1;
  }
  return { medicos, enfermeiros, tecnicos, multiprofissionais };
}

export default function UnidadesIndexPage() {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'' | UnidadeTipo>('');
  const [nivelFilter, setNivelFilter] = useState<'' | NivelCuidado>('');

  const allStats = useMemo(() => {
    return UNIDADES_ASSISTENCIAIS.map((u) => {
      const leitos = getLeitosPorUnidade(u.id);
      return { unidade: u, leitos, stats: computeBedStats(u, leitos), equipe: countEquipeNow(u.id) };
    });
  }, []);

  const globalKpis = useMemo(() => {
    let capacidade = 0;
    let ocupados = 0;
    let disponiveis = 0;
    let limpeza = 0;
    let bloqueados = 0;
    for (const row of allStats) {
      capacidade += row.stats.capacidade;
      ocupados += row.stats.ocupados;
      disponiveis += row.stats.disponiveis;
      limpeza += row.stats.limpeza;
      bloqueados += row.stats.bloqueados;
    }
    const ocupacaoGlobal = capacidade > 0 ? Math.round((ocupados / capacidade) * 100) : 0;
    return { capacidade, ocupados, disponiveis, limpeza, bloqueados, ocupacaoGlobal };
  }, [allStats]);

  const tipoOptions = useMemo(
    () => Array.from(new Set(UNIDADES_ASSISTENCIAIS.map((u) => u.tipo))),
    [],
  );
  const nivelOptions = useMemo(
    () => Array.from(new Set(UNIDADES_ASSISTENCIAIS.map((u) => u.nivelCuidado))),
    [],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allStats.filter((row) => {
      if (tipoFilter && row.unidade.tipo !== tipoFilter) return false;
      if (nivelFilter && row.unidade.nivelCuidado !== nivelFilter) return false;
      if (q.length > 0) {
        const hay = `${row.unidade.nome} ${row.unidade.codigo} ${TIPO_LABELS[row.unidade.tipo]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allStats, search, tipoFilter, nivelFilter]);

  return (
    <AppShell pageTitle="Unidades Assistenciais">
      <div className="page-header">
        <h1 className="page-title">Unidades Assistenciais</h1>
        <p className="page-subtitle">
          {UNIDADES_ASSISTENCIAIS.length} unidades · {globalKpis.capacidade} leitos · ocupacao global{' '}
          {globalKpis.ocupacaoGlobal}%
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <Kpi label="Total leitos" value={globalKpis.capacidade} />
        <Kpi label="Ocupados" value={globalKpis.ocupados} />
        <Kpi label="Disponiveis" value={globalKpis.disponiveis} />
        <Kpi label="Em limpeza" value={globalKpis.limpeza} />
        <Kpi label="Bloqueados" value={globalKpis.bloqueados} />
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="search-unidade" className="block text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">
                Buscar
              </label>
              <input
                id="search-unidade"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome ou codigo"
                className="w-full min-h-[40px] px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200"
              />
            </div>
            <div>
              <label htmlFor="filter-tipo" className="block text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">
                Tipo de unidade
              </label>
              <select
                id="filter-tipo"
                value={tipoFilter}
                onChange={(e) => setTipoFilter(e.target.value as '' | UnidadeTipo)}
                className="w-full min-h-[40px] px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-200"
              >
                <option value="">Todas</option>
                {tipoOptions.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-nivel" className="block text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">
                Nivel de cuidado
              </label>
              <select
                id="filter-nivel"
                value={nivelFilter}
                onChange={(e) => setNivelFilter(e.target.value as '' | NivelCuidado)}
                className="w-full min-h-[40px] px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-200"
              >
                <option value="">Todos</option>
                {nivelOptions.map((n) => (
                  <option key={n} value={n}>
                    {NIVEL_LABELS[n]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid of units */}
      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-12">
          Nenhuma unidade encontrada com os filtros atuais.
        </p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(({ unidade, stats, equipe }) => {
            const especialidades = getEspecialidadesPorUnidade(unidade.id);
            const primeiras = especialidades.slice(0, 3);
            const overflow = especialidades.length - primeiras.length;
            return (
              <li key={unidade.id}>
                <Link
                  href={`/unidades/${unidade.id}`}
                  className="block focus:outline-none focus:ring-2 focus:ring-neutral-200 rounded-2xl"
                >
                  <Card interactive>
                    <CardHeader>
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-neutral-900 truncate">
                          {unidade.nome}
                        </h2>
                        <p className="text-xs text-neutral-500 font-mono mt-0.5">
                          {unidade.codigo} · {TIPO_LABELS[unidade.tipo]}
                        </p>
                      </div>
                      <Badge variant="outline">{NIVEL_LABELS[unidade.nivelCuidado]}</Badge>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {/* Ocupacao */}
                      <div className="mb-3">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">
                            Ocupacao
                          </span>
                          <span className="text-sm font-semibold text-neutral-900">
                            {stats.ocupados}/{stats.capacidade} ({stats.ocupacao}%)
                          </span>
                        </div>
                        <div
                          className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden"
                          role="progressbar"
                          aria-valuenow={stats.ocupacao}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full bg-neutral-900"
                            style={{ width: `${stats.ocupacao}%` }}
                          />
                        </div>
                      </div>

                      {/* Equipe agora */}
                      <div className="mb-3 text-xs text-neutral-700">
                        <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mr-2">
                          Equipe agora
                        </span>
                        <span>
                          {equipe.medicos} med · {equipe.enfermeiros} enf · {equipe.tecnicos} tec
                          {equipe.multiprofissionais > 0 ? ` · ${equipe.multiprofissionais} multi` : ''}
                        </span>
                      </div>

                      {/* Especialidades */}
                      <div className="flex flex-wrap gap-1">
                        {primeiras.map((e) => (
                          <Badge key={e.id} variant="default" size="sm">
                            {e.nome}
                          </Badge>
                        ))}
                        {overflow > 0 && (
                          <Badge variant="outline" size="sm">+{overflow}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Hidden stubs to keep fixture imports honest (ensures type compatibility) */}
      <span hidden aria-hidden="true">
        {LOCATIONS.length}
        {ESPECIALIDADES.length}
        {HEALTHCARE_SERVICES.length}
      </span>
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</div>
      <div className="text-3xl font-bold mt-1 text-neutral-900">{value}</div>
    </div>
  );
}
