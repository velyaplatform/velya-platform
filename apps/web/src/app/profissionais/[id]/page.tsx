'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Badge, Button, Card, CardContent, CardHeader } from '../../components/ui';
import {
  getProfissionalById,
  PRACTITIONER_ROLES,
  TURNOS,
  PRESENCAS_FISICAS,
  INTERNACOES,
  getEspecialidadeById,
  getUnidadeById,
} from '../../../lib/fixtures/hospital-core';

const CATEGORIA_LABEL: Record<string, string> = {
  medico: 'Medico',
  enfermeiro: 'Enfermeiro',
  tecnico_enfermagem: 'Tecnico de Enfermagem',
  auxiliar_enfermagem: 'Auxiliar de Enfermagem',
  fisioterapeuta: 'Fisioterapeuta',
  nutricionista: 'Nutricionista',
  fonoaudiologo: 'Fonoaudiologo',
  psicologo: 'Psicologo',
  terapeuta_ocupacional: 'Terapeuta Ocupacional',
  assistente_social: 'Assistente Social',
  farmaceutico: 'Farmaceutico',
  dentista: 'Dentista',
  biomedico: 'Biomedico',
  tecnico_radiologia: 'Tecnico de Radiologia',
  maqueiro: 'Maqueiro',
  higienizacao: 'Higienizacao',
  manutencao: 'Manutencao',
  recepcao: 'Recepcao',
  coordenador_assistencial: 'Coordenador Assistencial',
  diretor_clinico: 'Diretor Clinico',
  diretor_tecnico: 'Diretor Tecnico',
};

const ROLE_CODIGO_LABEL: Record<string, string> = {
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

export default function ProfissionalPage() {
  const params = useParams<{ id: string }>();
  const prof = useMemo(() => getProfissionalById(params.id), [params.id]);

  const papeis = useMemo(() => {
    if (!prof) return [];
    return PRACTITIONER_ROLES.filter((r) => r.profissionalId === prof.id && r.ativo);
  }, [prof]);

  const turnoAtivo = useMemo(() => {
    if (papeis.length === 0) return null;
    const roleIds = new Set(papeis.map((r) => r.id));
    return TURNOS.find((t) => roleIds.has(t.practitionerRoleId) && t.status === 'em_andamento') ?? null;
  }, [papeis]);

  const presenca = useMemo(() => {
    if (!turnoAtivo) return null;
    return PRESENCAS_FISICAS.find((p) => p.turnoId === turnoAtivo.id) ?? null;
  }, [turnoAtivo]);

  const pacientesAssistidos = useMemo(() => {
    if (papeis.length === 0) return [];
    const roleIds = new Set(papeis.map((r) => r.id));
    return INTERNACOES.filter(
      (i) =>
        (i.status === 'internado' || i.status === 'alta_solicitada') &&
        (roleIds.has(i.medicoAssistenteRoleId) || i.consultores.some((c) => roleIds.has(c.roleId))),
    );
  }, [papeis]);

  const proximosTurnos = useMemo(() => {
    if (papeis.length === 0) return [];
    const roleIds = new Set(papeis.map((r) => r.id));
    return TURNOS.filter((t) => roleIds.has(t.practitionerRoleId) && t.status === 'agendado').slice(0, 5);
  }, [papeis]);

  if (!prof) {
    return (
      <AppShell pageTitle="Profissional nao encontrado">
        <div className="page-header">
          <h1 className="page-title">Profissional nao encontrado</h1>
          <p className="page-subtitle">
            Nenhum profissional com id <strong>{params.id}</strong>.
          </p>
        </div>
      </AppShell>
    );
  }

  function delegar() {
    window.alert(`Delegar tarefa para ${prof?.nome ?? ''} — formulario em desenvolvimento`);
  }

  return (
    <AppShell pageTitle={prof.nome}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{prof.nome}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {CATEGORIA_LABEL[prof.categoria] ?? prof.categoria}
          {prof.ramal && ` · Ramal ${prof.ramal}`}
        </p>
      </div>

      {/* Status strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded border border-neutral-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Status agora</div>
          <div className="mt-1 text-lg font-semibold text-neutral-900">
            {presenca?.status === 'presente'
              ? 'Presente'
              : presenca?.status === 'em_pausa'
                ? 'Em pausa'
                : turnoAtivo
                  ? 'Em turno'
                  : 'Fora de turno'}
          </div>
        </div>
        <div className="rounded border border-neutral-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Papeis ativos</div>
          <div className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">{papeis.length}</div>
        </div>
        <div className="rounded border border-neutral-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Pacientes</div>
          <div className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">
            {pacientesAssistidos.length}
          </div>
        </div>
        <div className="rounded border border-neutral-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Proximos turnos</div>
          <div className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">
            {proximosTurnos.length}
          </div>
        </div>
      </div>

      {/* Registros + Delegacao */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-neutral-900">Registros profissionais</h2>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {prof.registros.map((r, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2 border-b border-neutral-100 py-1.5 last:border-0">
                  <span className="text-neutral-500">{r.conselho}</span>
                  <span className="font-mono text-neutral-900">{r.numero} / {r.uf}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-neutral-900">Acoes</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="default" size="sm" className="w-full" onClick={delegar}>
              Delegar tarefa
            </Button>
            <p className="text-xs text-neutral-500">
              Cria uma tarefa vinculada a este profissional com prioridade e SLA.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Papeis ativos */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">
          Papeis ativos ({papeis.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {papeis.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="default">{ROLE_CODIGO_LABEL[p.codigo] ?? p.codigo}</Badge>
                  <span className="text-xs text-neutral-500 tabular-nums">{p.cargaHoraria}h/sem</span>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Unidades</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.locationIds.map((id) => {
                      const u = getUnidadeById(id);
                      return u ? (
                        <Link key={id} href={`/unidades/${u.id}`}>
                          <Badge variant="outline" className="cursor-pointer">
                            {u.nome}
                          </Badge>
                        </Link>
                      ) : null;
                    })}
                  </div>
                </div>
                {p.especialidadeIds.length > 0 && (
                  <div>
                    <div className="text-xs text-neutral-500">Especialidades</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.especialidadeIds.map((eid) => {
                        const e = getEspecialidadeById(eid);
                        return e ? (
                          <Link key={eid} href={`/specialties/${e.id}`}>
                            <Badge variant="outline" className="cursor-pointer">
                              {e.nome}
                            </Badge>
                          </Link>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pacientes sob cuidado */}
      {pacientesAssistidos.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">
            Pacientes sob cuidado ({pacientesAssistidos.length})
          </h2>
          <Card>
            <CardContent className="pt-4">
              <ul className="divide-y divide-neutral-100">
                {pacientesAssistidos.slice(0, 20).map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/pacientes/${i.pacienteId.replace('pac-', 'MRN-').padStart(7, '0')}`}
                      className="flex items-center justify-between py-2 hover:bg-neutral-50 px-2 -mx-2 rounded"
                    >
                      <span className="text-sm text-neutral-900">{i.numeroAtendimento}</span>
                      <span className="text-xs text-neutral-500">{i.cidPrincipal ?? '—'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </AppShell>
  );
}
