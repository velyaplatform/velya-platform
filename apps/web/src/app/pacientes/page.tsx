'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/app-shell';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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

const REFERENCE_DATE = new Date('2026-04-13T00:00:00-03:00');

interface PatientRow {
  internacaoId: string;
  mrn: string;
  nome: string;
  sexo: string;
  idade: number;
  unidadeNome: string;
  unidadeId: string;
  leitoNome: string;
  especialidadeNome: string;
  especialidadeId: string;
  cid: string;
  diagnostico: string;
  status: string;
  scp: string;
  newsScore: number;
  dias: number;
  alergiasCount: number;
  alertasCount: number;
  consultoresCount: number;
  viaAdmissao: string;
  canOpen: boolean;
}

interface RegisteredPatientSummary {
  mrn: string;
  name: string;
  age: number;
  ward: string;
  bed: string;
  diagnosis: string;
  admissionDate: string;
  consultant: string;
  priority: string;
  createdAt: string;
}

interface RegisteredPatientResource {
  mrn: string;
  name: {
    full: string;
  };
  birthDate: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  admission: {
    reason: string;
    ward: string;
    bed: string;
    responsiblePhysician: string;
    priority: 'Normal' | 'Urgente' | 'Emergencia';
    admissionDateTime: string;
  };
  clinicalData?: {
    allergies?: string[];
  };
  createdAt: string;
}

interface PatientRegistrationForm {
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  sexo: 'male' | 'female' | 'other' | 'unknown';
  nomeMae: string;
  telefonePrincipal: string;
  contatoEmergenciaNome: string;
  contatoEmergenciaParentesco: string;
  contatoEmergenciaTelefone: string;
  motivoInternacao: string;
  medicoResponsavel: string;
  unidadeInternacao: string;
  leito: string;
  prioridade: 'Normal' | 'Urgente' | 'Emergencia';
  origem: string;
  cidPrincipal: string;
  tipoPlano: 'SUS' | 'Convenio' | 'Particular';
  operadora: string;
  alergias: string;
  comorbidades: string;
  medicacoesContinuas: string;
  dataHoraAdmissao: string;
}

function createInitialFormState(): PatientRegistrationForm {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return {
    nomeCompleto: '',
    cpf: '',
    dataNascimento: '',
    sexo: 'unknown',
    nomeMae: '',
    telefonePrincipal: '',
    contatoEmergenciaNome: '',
    contatoEmergenciaParentesco: '',
    contatoEmergenciaTelefone: '',
    motivoInternacao: '',
    medicoResponsavel: '',
    unidadeInternacao: '',
    leito: '',
    prioridade: 'Normal',
    origem: 'Pronto Atendimento',
    cidPrincipal: '',
    tipoPlano: 'SUS',
    operadora: '',
    alergias: '',
    comorbidades: '',
    medicacoesContinuas: '',
    dataHoraAdmissao: localNow,
  };
}

function parseDelimitedList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAgeFromBirthDate(dateIso: string): number {
  if (!dateIso) return 0;
  return Math.floor(
    (REFERENCE_DATE.getTime() - new Date(dateIso).getTime()) / (365.25 * 24 * 3600000),
  );
}

function getDaysFromDate(dateIso: string): number {
  if (!dateIso) return 0;
  return Math.max(
    0,
    Math.floor((REFERENCE_DATE.getTime() - new Date(dateIso).getTime()) / (24 * 3600000)),
  );
}

function genderLabel(gender: RegisteredPatientResource['gender']): string {
  if (gender === 'male') return 'M';
  if (gender === 'female') return 'F';
  return '—';
}

function mapRegisteredSummaryToRow(patient: RegisteredPatientSummary): PatientRow {
  const matchedUnit = UNIDADES_ASSISTENCIAIS.find((unit) => unit.nome === patient.ward);
  const admissionDateTime = patient.admissionDate
    ? `${patient.admissionDate}T00:00:00`
    : patient.createdAt;

  return {
    internacaoId: `registry-${patient.mrn}`,
    mrn: patient.mrn,
    nome: patient.name,
    sexo: '—',
    idade: patient.age,
    unidadeNome: patient.ward || '—',
    unidadeId: matchedUnit?.id ?? '',
    leitoNome: patient.bed || '—',
    especialidadeNome: 'Cadastro recente',
    especialidadeId: '',
    cid: '—',
    diagnostico: patient.diagnosis || '—',
    status: 'internado',
    scp: 'registro',
    newsScore: 0,
    dias: getDaysFromDate(admissionDateTime),
    alergiasCount: 0,
    alertasCount: 0,
    consultoresCount: 0,
    viaAdmissao: patient.priority || 'Normal',
    canOpen: false,
  };
}

function mapRegisteredResourceToRow(patient: RegisteredPatientResource): PatientRow {
  const matchedUnit = UNIDADES_ASSISTENCIAIS.find(
    (unit) => unit.nome === patient.admission.ward,
  );

  return {
    internacaoId: `registry-${patient.mrn}`,
    mrn: patient.mrn,
    nome: patient.name.full,
    sexo: genderLabel(patient.gender),
    idade: getAgeFromBirthDate(patient.birthDate),
    unidadeNome: patient.admission.ward || '—',
    unidadeId: matchedUnit?.id ?? '',
    leitoNome: patient.admission.bed || '—',
    especialidadeNome: 'Cadastro recente',
    especialidadeId: '',
    cid: '—',
    diagnostico: patient.admission.reason || '—',
    status: 'internado',
    scp: 'registro',
    newsScore: 0,
    dias: getDaysFromDate(patient.admission.admissionDateTime || patient.createdAt),
    alergiasCount: patient.clinicalData?.allergies?.length ?? 0,
    alertasCount: 0,
    consultoresCount: 0,
    viaAdmissao: patient.admission.priority,
    canOpen: false,
  };
}

export default function PacientesIndexPage() {
  const [search, setSearch] = useState('');
  const [unidadeFilter, setUnidadeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('ativos');
  const [especialidadeFilter, setEspecialidadeFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [registeredRows, setRegisteredRows] = useState<PatientRow[]>([]);
  const [registeredRowsError, setRegisteredRowsError] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationForm, setRegistrationForm] = useState<PatientRegistrationForm>(
    createInitialFormState(),
  );
  const [registrationSubmitting, setRegistrationSubmitting] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [registrationNotice, setRegistrationNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/patients', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled && response.status !== 401) {
            setRegisteredRowsError('Nao foi possivel carregar os registros recentes.');
          }
          return;
        }

        const data = (await response.json()) as { patients?: RegisteredPatientSummary[] };
        if (!cancelled) {
          setRegisteredRows((data.patients ?? []).map(mapRegisteredSummaryToRow));
          setRegisteredRowsError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRegisteredRowsError('Nao foi possivel carregar os registros recentes.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleShortcut(event: Event) {
      const detail = (event as CustomEvent<{ command?: string }>).detail;
      if (!detail?.command) return;

      if (detail.command === 'new-patient') {
        setRegistrationOpen(true);
        return;
      }

      if (detail.command === 'filter-patients') {
        const searchInput = document.getElementById('patients-search-input');
        if (searchInput instanceof HTMLElement) {
          searchInput.focus();
        }
      }
    }

    window.addEventListener('velya:shortcut-command', handleShortcut as EventListener);
    return () => {
      window.removeEventListener('velya:shortcut-command', handleShortcut as EventListener);
    };
  }, []);

  const coreRows = useMemo<PatientRow[]>(() => {
    return INTERNACOES.map((internacao) => {
      const paciente = PACIENTES.find((item) => item.id === internacao.pacienteId);
      const unidade = getUnidadeById(internacao.unidadeAtualId);
      const especialidade = getEspecialidadeById(internacao.especialidadePrimariaId);
      const leito = getLocationById(internacao.locationAtualId);

      return {
        internacaoId: internacao.id,
        mrn: paciente?.mrn ?? '',
        nome: paciente?.nome ?? '',
        sexo: paciente?.sexo ?? 'M',
        idade: paciente?.dataNascimento ? getAgeFromBirthDate(paciente.dataNascimento) : 0,
        unidadeNome: unidade?.nome ?? '—',
        unidadeId: unidade?.id ?? '',
        leitoNome: leito?.nome ?? '—',
        especialidadeNome: especialidade?.nome ?? '—',
        especialidadeId: especialidade?.id ?? '',
        cid: internacao.cidPrincipal ?? '—',
        diagnostico: internacao.hipoteseDiagnostica ?? '—',
        status: internacao.status,
        scp: internacao.scpAtual ?? '—',
        newsScore: internacao.newsScore ?? 0,
        dias: getDaysFromDate(internacao.admissao.em),
        alergiasCount: paciente?.alergias?.length ?? 0,
        alertasCount: paciente?.alertas?.length ?? 0,
        consultoresCount: internacao.consultores.length,
        viaAdmissao: internacao.admissao.via,
        canOpen: true,
      };
    });
  }, []);

  const rows = useMemo(() => [...registeredRows, ...coreRows], [registeredRows, coreRows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (search) {
        const query = search.toLowerCase();
        if (
          !row.nome.toLowerCase().includes(query) &&
          !row.mrn.toLowerCase().includes(query) &&
          !row.diagnostico.toLowerCase().includes(query) &&
          !row.cid.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      if (unidadeFilter !== 'all' && row.unidadeId !== unidadeFilter) return false;

      if (statusFilter !== 'all') {
        if (statusFilter === 'ativos') {
          if (row.status === 'alta_completada' || row.status === 'obito') return false;
        } else if (row.status !== statusFilter) {
          return false;
        }
      }

      if (especialidadeFilter !== 'all' && row.especialidadeId !== especialidadeFilter) {
        return false;
      }

      if (riskFilter !== 'all') {
        if (riskFilter === 'high' && row.newsScore < 5) return false;
        if (riskFilter === 'critical' && row.newsScore < 7) return false;
        if (riskFilter === 'isolation' && row.alertasCount === 0) return false;
        if (riskFilter === 'allergies' && row.alergiasCount === 0) return false;
      }

      return true;
    });
  }, [rows, search, unidadeFilter, statusFilter, especialidadeFilter, riskFilter]);

  const stats = useMemo(() => {
    const ativos = rows.filter(
      (row) =>
        row.status === 'internado' ||
        row.status === 'em_admissao' ||
        row.status === 'alta_solicitada',
    );

    return {
      total: rows.length,
      ativos: ativos.length,
      newsAlto: ativos.filter((row) => row.newsScore >= 5).length,
      isolamento: ativos.filter((row) => row.alertasCount > 0).length,
      altaSolicitada: rows.filter((row) => row.status === 'alta_solicitada').length,
      filtrado: filtered.length,
      registrosRecentes: registeredRows.length,
    };
  }, [rows, filtered, registeredRows.length]);

  function setFormField<K extends keyof PatientRegistrationForm>(
    key: K,
    value: PatientRegistrationForm[K],
  ) {
    setRegistrationForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handlePatientRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegistrationSubmitting(true);
    setRegistrationError(null);

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          ...registrationForm,
          alergias: parseDelimitedList(registrationForm.alergias),
          comorbidades: parseDelimitedList(registrationForm.comorbidades),
          medicacoesContinuas: parseDelimitedList(registrationForm.medicacoesContinuas),
          dataHoraAdmissao: registrationForm.dataHoraAdmissao
            ? new Date(registrationForm.dataHoraAdmissao).toISOString()
            : undefined,
          operadora:
            registrationForm.tipoPlano === 'Convenio' ? registrationForm.operadora : undefined,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        patient?: RegisteredPatientResource;
      };

      if (!response.ok || !data.patient) {
        setRegistrationError(data.error || 'Nao foi possivel registrar o paciente.');
        return;
      }

      const nextRow = mapRegisteredResourceToRow(data.patient);
      setRegisteredRows((current) => [
        nextRow,
        ...current.filter((row) => row.mrn !== nextRow.mrn),
      ]);
      setSearch(nextRow.mrn);
      setRegistrationNotice(`Paciente ${data.patient.name.full} registrado em ${data.patient.mrn}.`);
      setRegistrationForm(createInitialFormState());
      setRegistrationOpen(false);
    } catch {
      setRegistrationError('Falha de rede ao registrar o paciente.');
    } finally {
      setRegistrationSubmitting(false);
    }
  }

  return (
    <AppShell pageTitle="Pacientes">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Pacientes</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {stats.ativos} internados ativos · {stats.newsAlto} com NEWS &gt;= 5 ·{' '}
            {stats.altaSolicitada} alta solicitada · {stats.isolamento} com alertas/isolamento
          </p>
          {stats.registrosRecentes > 0 && (
            <p className="mt-1 text-xs text-neutral-500">
              {stats.registrosRecentes} registro(s) recente(s) vindos do intake de admissao.
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={() => {
            setRegistrationError(null);
            setRegistrationOpen(true);
          }}
          className="min-h-[44px] self-start"
        >
          <Plus className="h-4 w-4" />
          Registrar Novo Paciente
        </Button>
      </div>

      {registrationNotice && (
        <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {registrationNotice}
        </div>
      )}

      {registeredRowsError && (
        <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {registeredRowsError}
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div>
              <label
                htmlFor="patients-search-input"
                className="text-xs font-medium uppercase tracking-wider text-neutral-500"
              >
                Buscar
              </label>
              <Input
                id="patients-search-input"
                type="text"
                placeholder="Nome, MRN, CID, diagnostico..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Unidade
              </label>
              <select
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                value={unidadeFilter}
                onChange={(event) => setUnidadeFilter(event.target.value)}
              >
                <option value="all">Todas</option>
                {UNIDADES_ASSISTENCIAIS.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Status
              </label>
              <select
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
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
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Especialidade
              </label>
              <select
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                value={especialidadeFilter}
                onChange={(event) => setEspecialidadeFilter(event.target.value)}
              >
                <option value="all">Todas</option>
                {ESPECIALIDADES.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>
                    {specialty.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Contexto
              </label>
              <select
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                value={riskFilter}
                onChange={(event) => setRiskFilter(event.target.value)}
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
                {filtered.slice(0, 200).map((row) => (
                  <tr key={row.internacaoId} className="hover:bg-neutral-50">
                    <td className="py-3 pr-4 font-mono text-xs text-neutral-700">{row.mrn}</td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-neutral-900">{row.nome}</div>
                      <div className="max-w-xs truncate text-xs text-neutral-500">
                        {row.diagnostico}
                      </div>
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-neutral-700">
                      {row.sexo} · {row.idade}a
                    </td>
                    <td className="py-3 pr-4">
                      {row.unidadeId ? (
                        <Link
                          href={`/unidades/${row.unidadeId}`}
                          className="text-neutral-700 hover:text-neutral-900 hover:underline"
                        >
                          {row.unidadeNome}
                        </Link>
                      ) : (
                        <span className="text-neutral-700">{row.unidadeNome}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-neutral-700">
                      {row.leitoNome}
                    </td>
                    <td className="py-3 pr-4">
                      {row.especialidadeId ? (
                        <Link
                          href={`/specialties/${row.especialidadeId}`}
                          className="text-neutral-700 hover:text-neutral-900 hover:underline"
                        >
                          {row.especialidadeNome}
                        </Link>
                      ) : (
                        <span className="text-neutral-700">{row.especialidadeNome}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-neutral-700">{row.cid}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="default">{STATUS_LABEL[row.status] ?? row.status}</Badge>
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-neutral-900">{row.dias}d</td>
                    <td className="py-3 pr-4 text-xs uppercase text-neutral-700">{row.scp}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      <span
                        className={
                          row.newsScore >= 7
                            ? 'font-bold text-neutral-900'
                            : row.newsScore >= 5
                              ? 'font-semibold text-neutral-800'
                              : 'text-neutral-600'
                        }
                      >
                        {row.newsScore || '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-1">
                        {row.alergiasCount > 0 && <Badge variant="outline">A:{row.alergiasCount}</Badge>}
                        {row.alertasCount > 0 && <Badge variant="outline">!:{row.alertasCount}</Badge>}
                        {row.consultoresCount > 0 && (
                          <Badge variant="outline">IC:{row.consultoresCount}</Badge>
                        )}
                        {row.alergiasCount === 0 &&
                          row.alertasCount === 0 &&
                          row.consultoresCount === 0 && (
                            <span className="text-xs text-neutral-400">—</span>
                          )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {row.canOpen ? (
                        <Link
                          href={`/pacientes/${row.mrn}`}
                          className="text-xs text-neutral-700 underline hover:text-neutral-900"
                        >
                          Abrir
                        </Link>
                      ) : (
                        <span className="text-xs text-neutral-400">Cadastro recente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length > 200 && (
              <p className="mt-3 text-center text-xs text-neutral-500">
                Exibindo primeiros 200 de {filtered.length} resultados. Refine os filtros para ver
                mais.
              </p>
            )}

            {filtered.length === 0 && (
              <p className="mt-3 py-8 text-center text-sm text-neutral-500">
                Nenhum paciente corresponde aos filtros selecionados.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={registrationOpen}
        onOpenChange={(open) => {
          setRegistrationOpen(open);
          if (!open) {
            setRegistrationError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Registrar novo paciente</DialogTitle>
            <DialogDescription>
              Cadastro rapido de admissao dentro da central antiga de pacientes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePatientRegistration} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Nome completo
              </label>
              <Input
                value={registrationForm.nomeCompleto}
                onChange={(event) => setFormField('nomeCompleto', event.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                CPF
              </label>
              <Input
                value={registrationForm.cpf}
                onChange={(event) => setFormField('cpf', event.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Data de nascimento
              </label>
              <Input
                type="date"
                value={registrationForm.dataNascimento}
                onChange={(event) => setFormField('dataNascimento', event.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Sexo
              </label>
              <select
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                value={registrationForm.sexo}
                onChange={(event) =>
                  setFormField(
                    'sexo',
                    event.target.value as PatientRegistrationForm['sexo'],
                  )
                }
                required
              >
                <option value="unknown">Nao informado</option>
                <option value="female">Feminino</option>
                <option value="male">Masculino</option>
                <option value="other">Outro</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Nome da mae
              </label>
              <Input
                value={registrationForm.nomeMae}
                onChange={(event) => setFormField('nomeMae', event.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Telefone principal
              </label>
              <Input
                value={registrationForm.telefonePrincipal}
                onChange={(event) => setFormField('telefonePrincipal', event.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Contato de emergencia
              </label>
              <Input
                value={registrationForm.contatoEmergenciaNome}
                onChange={(event) => setFormField('contatoEmergenciaNome', event.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Parentesco
              </label>
              <Input
                value={registrationForm.contatoEmergenciaParentesco}
                onChange={(event) =>
                  setFormField('contatoEmergenciaParentesco', event.target.value)
                }
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Telefone do contato
              </label>
              <Input
                value={registrationForm.contatoEmergenciaTelefone}
                onChange={(event) =>
                  setFormField('contatoEmergenciaTelefone', event.target.value)
                }
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Medico responsavel
              </label>
              <Input
                value={registrationForm.medicoResponsavel}
                onChange={(event) => setFormField('medicoResponsavel', event.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Motivo da internacao
              </label>
              <textarea
                value={registrationForm.motivoInternacao}
                onChange={(event) => setFormField('motivoInternacao', event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 shadow-sm focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Unidade
              </label>
              <select
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                value={registrationForm.unidadeInternacao}
                onChange={(event) => setFormField('unidadeInternacao', event.target.value)}
                required
              >
                <option value="">Selecione</option>
                {UNIDADES_ASSISTENCIAIS.map((unit) => (
                  <option key={unit.id} value={unit.nome}>
                    {unit.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Leito
              </label>
              <Input
                value={registrationForm.leito}
                onChange={(event) => setFormField('leito', event.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Prioridade
              </label>
              <select
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                value={registrationForm.prioridade}
                onChange={(event) =>
                  setFormField(
                    'prioridade',
                    event.target.value as PatientRegistrationForm['prioridade'],
                  )
                }
              >
                <option value="Normal">Normal</option>
                <option value="Urgente">Urgente</option>
                <option value="Emergencia">Emergencia</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Origem
              </label>
              <Input
                value={registrationForm.origem}
                onChange={(event) => setFormField('origem', event.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Data/hora da admissao
              </label>
              <Input
                type="datetime-local"
                value={registrationForm.dataHoraAdmissao}
                onChange={(event) => setFormField('dataHoraAdmissao', event.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                CID principal
              </label>
              <Input
                value={registrationForm.cidPrincipal}
                onChange={(event) => setFormField('cidPrincipal', event.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Tipo de plano
              </label>
              <select
                className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                value={registrationForm.tipoPlano}
                onChange={(event) =>
                  setFormField(
                    'tipoPlano',
                    event.target.value as PatientRegistrationForm['tipoPlano'],
                  )
                }
              >
                <option value="SUS">SUS</option>
                <option value="Convenio">Convenio</option>
                <option value="Particular">Particular</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Operadora
              </label>
              <Input
                value={registrationForm.operadora}
                onChange={(event) => setFormField('operadora', event.target.value)}
                className="mt-1"
                disabled={registrationForm.tipoPlano !== 'Convenio'}
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Alergias
              </label>
              <Input
                value={registrationForm.alergias}
                onChange={(event) => setFormField('alergias', event.target.value)}
                className="mt-1"
                placeholder="Separar por virgula"
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Comorbidades
              </label>
              <Input
                value={registrationForm.comorbidades}
                onChange={(event) => setFormField('comorbidades', event.target.value)}
                className="mt-1"
                placeholder="Separar por virgula"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Medicacoes continuas
              </label>
              <Input
                value={registrationForm.medicacoesContinuas}
                onChange={(event) =>
                  setFormField('medicacoesContinuas', event.target.value)
                }
                className="mt-1"
                placeholder="Separar por virgula"
              />
            </div>

            {registrationError && (
              <div className="md:col-span-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                {registrationError}
              </div>
            )}

            <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRegistrationOpen(false);
                  setRegistrationError(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={registrationSubmitting}>
                {registrationSubmitting ? 'Registrando...' : 'Salvar admissao'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
