'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AppShell } from '../components/app-shell';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  PACIENTES,
  INTERNACOES,
  UNIDADES_ASSISTENCIAIS,
  ESPECIALIDADES,
  getUnidadeById,
  getEspecialidadeById,
  getLocationById,
} from '../../lib/fixtures/hospital-core';

const STATUS_LABEL: Record<string, string> = {
  internado: 'Internado',
  em_admissao: 'Em admissao',
  alta_solicitada: 'Alta solicitada',
  em_transferencia: 'Em transferencia',
  alta_completada: 'Alta completada',
  obito: 'Obito',
};

export default function PacientesIndexPage() {
  const [search, setSearch] = useState('');
  const [unidadeFilter, setUnidadeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('ativos');
  const [especialidadeFilter, setEspecialidadeFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  const rows = useMemo(() => {
    return INTERNACOES.map((i) => {
      const paciente = PACIENTES.find((p) => p.id === i.pacienteId);
      const unidade = getUnidadeById(i.unidadeAtualId);
      const especialidade = getEspecialidadeById(i.especialidadePrimariaId);
      const leito = getLocationById(i.locationAtualId);
      const idade = paciente?.dataNascimento
        ? Math.floor((new Date('2026-04-13').getTime() - new Date(paciente.dataNascimento).getTime()) / (365.25 * 24 * 3600000))
        : 0;
      const dias = Math.floor((new Date('2026-04-13').getTime() - new Date(i.admissao.em).getTime()) / (24 * 3600000));
      return {
        internacaoId: i.id,
        mrn: paciente?.mrn ?? '',
        nome: paciente?.nome ?? '',
        sexo: paciente?.sexo ?? 'M',
        idade,
        unidadeNome: unidade?.nome ?? '—',
        unidadeId: unidade?.id ?? '',
        leitoNome: leito?.nome ?? '—',
        especialidadeNome: especialidade?.nome ?? '—',
        especialidadeId: especialidade?.id ?? '',
        cid: i.cidPrincipal ?? '—',
        diagnostico: i.hipoteseDiagnostica ?? '—',
        status: i.status,
        scp: i.scpAtual ?? '—',
        newsScore: i.newsScore ?? 0,
        dias,
        alergiasCount: paciente?.alergias?.length ?? 0,
        alertasCount: paciente?.alertas?.length ?? 0,
        consultoresCount: i.consultores.length,
        viaAdmissao: i.admissao.via,
      };
    });
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.nome.toLowerCase().includes(q) &&
          !r.mrn.toLowerCase().includes(q) &&
          !r.diagnostico.toLowerCase().includes(q) &&
          !r.cid.toLowerCase().includes(q)
        )
          return false;
      }
      if (unidadeFilter !== 'all' && r.unidadeId !== unidadeFilter) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'ativos') {
          if (r.status === 'alta_completada' || r.status === 'obito') return false;
        } else if (r.status !== statusFilter) {
          return false;
        }
      }
      if (especialidadeFilter !== 'all' && r.especialidadeId !== especialidadeFilter) return false;
      if (riskFilter !== 'all') {
        if (riskFilter === 'high' && r.newsScore < 5) return false;
        if (riskFilter === 'critical' && r.newsScore < 7) return false;
        if (riskFilter === 'isolation' && r.alertasCount === 0) return false;
        if (riskFilter === 'allergies' && r.alergiasCount === 0) return false;
      }
      return true;
    });
  }, [rows, search, unidadeFilter, statusFilter, especialidadeFilter, riskFilter]);

  const stats = useMemo(() => {
    const ativos = rows.filter((r) => r.status === 'internado' || r.status === 'em_admissao' || r.status === 'alta_solicitada');
    return {
      total: rows.length,
      ativos: ativos.length,
      newsAlto: ativos.filter((r) => r.newsScore >= 5).length,
      isolamento: ativos.filter((r) => r.alertasCount > 0).length,
      altaSolicitada: rows.filter((r) => r.status === 'alta_solicitada').length,
      filtrado: filtered.length,
    };
  }, [rows, filtered]);

  return (
    <AppShell pageTitle="Pacientes">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Pacientes</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {stats.ativos} internados ativos · {stats.newsAlto} com NEWS &gt;= 5 · {stats.altaSolicitada} alta solicitada · {stats.isolamento} com alertas/isolamento
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">Buscar</label>
              <Input
                type="text"
                placeholder="Nome, MRN, CID, diagnostico..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">Unidade</label>
              <select
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                value={unidadeFilter}
                onChange={(e) => setUnidadeFilter(e.target.value)}
              >
                <option value="all">Todas</option>
                {UNIDADES_ASSISTENCIAIS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">Status</label>
              <select
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ativos">Ativos (todos)</option>
                <option value="all">Todos (incluindo alta/obito)</option>
                <option value="internado">Internados</option>
                <option value="em_admissao">Em admissao</option>
                <option value="alta_solicitada">Alta solicitada</option>
                <option value="em_transferencia">Em transferencia</option>
                <option value="alta_completada">Alta completada</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">Especialidade</label>
              <select
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                value={especialidadeFilter}
                onChange={(e) => setEspecialidadeFilter(e.target.value)}
              >
                <option value="all">Todas</option>
                {ESPECIALIDADES.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">Contexto</label>
              <select
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="high">NEWS &gt;= 5</option>
                <option value="critical">NEWS &gt;= 7 (critico)</option>
                <option value="isolation">Com alertas / isolamento</option>
                <option value="allergies">Com alergias</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">
          Resultados ({stats.filtrado} de {stats.total})
        </h2>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="pb-3 pr-4">MRN</th>
                  <th className="pb-3 pr-4">Paciente</th>
                  <th className="pb-3 pr-4">Sexo/Idade</th>
                  <th className="pb-3 pr-4">Unidade</th>
                  <th className="pb-3 pr-4">Leito</th>
                  <th className="pb-3 pr-4">Especialidade</th>
                  <th className="pb-3 pr-4">CID</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Dias</th>
                  <th className="pb-3 pr-4">SCP</th>
                  <th className="pb-3 pr-4">NEWS</th>
                  <th className="pb-3 pr-4">Alertas</th>
                  <th className="pb-3 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.slice(0, 200).map((r) => (
                  <tr key={r.internacaoId} className="hover:bg-neutral-50">
                    <td className="py-3 pr-4 font-mono text-xs text-neutral-700">{r.mrn}</td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-neutral-900">{r.nome}</div>
                      <div className="text-xs text-neutral-500 truncate max-w-xs">{r.diagnostico}</div>
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-neutral-700">
                      {r.sexo} · {r.idade}a
                    </td>
                    <td className="py-3 pr-4">
                      <Link href={`/unidades/${r.unidadeId}`} className="text-neutral-700 hover:text-neutral-900 hover:underline">
                        {r.unidadeNome}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-neutral-700">{r.leitoNome}</td>
                    <td className="py-3 pr-4">
                      <Link href={`/specialties/${r.especialidadeId}`} className="text-neutral-700 hover:text-neutral-900 hover:underline">
                        {r.especialidadeNome}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-neutral-700">{r.cid}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="default">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-neutral-900">{r.dias}d</td>
                    <td className="py-3 pr-4 text-xs uppercase text-neutral-700">{r.scp}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      <span className={r.newsScore >= 7 ? 'font-bold text-neutral-900' : r.newsScore >= 5 ? 'font-semibold text-neutral-800' : 'text-neutral-600'}>
                        {r.newsScore || '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-1">
                        {r.alergiasCount > 0 && <Badge variant="outline">A:{r.alergiasCount}</Badge>}
                        {r.alertasCount > 0 && <Badge variant="outline">!:{r.alertasCount}</Badge>}
                        {r.consultoresCount > 0 && <Badge variant="outline">IC:{r.consultoresCount}</Badge>}
                        {r.alergiasCount === 0 && r.alertasCount === 0 && r.consultoresCount === 0 && (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Link href={`/pacientes/${r.mrn}`} className="text-xs text-neutral-700 underline hover:text-neutral-900">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <p className="mt-3 text-xs text-neutral-500 text-center">
                Exibindo primeiros 200 de {filtered.length} resultados. Refine os filtros para ver mais.
              </p>
            )}
            {filtered.length === 0 && (
              <p className="mt-3 text-sm text-neutral-500 text-center py-8">
                Nenhum paciente corresponde aos filtros selecionados.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
