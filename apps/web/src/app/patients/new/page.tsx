'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNowLocalIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function Section({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <span className="text-base">{icon}</span>
          {title}
        </span>
        <span className="text-slate-400 text-lg">{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form field components
// ---------------------------------------------------------------------------

function Field({
  label,
  required,
  children,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

const inputClass =
  'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400';

const selectClass =
  'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

// ---------------------------------------------------------------------------
// Comorbidities list
// ---------------------------------------------------------------------------

const COMORBIDITIES_OPTIONS = [
  'HAS',
  'DM',
  'Cardiopatia',
  'Pneumopatia',
  'Nefropatia',
  'Hepatopatia',
  'Neoplasia',
  'HIV',
  'Tabagismo',
  'Etilismo',
  'Outros',
];

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const ORIGINS = [
  'Pronto Atendimento',
  'Ambulatorio',
  'Transferencia',
  'Eletiva',
  'SAMU',
];

const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

// ---------------------------------------------------------------------------
// Multi-value input (for allergies and medications)
// ---------------------------------------------------------------------------

function MultiValueInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  function add() {
    const val = input.trim();
    if (val && !values.includes(val)) {
      onChange([...values, val]);
      setInput('');
    }
  }

  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={inputClass}
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shrink-0 cursor-pointer"
        >
          +
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map((v, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium rounded-full"
            >
              {v}
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-blue-400 hover:text-blue-700 cursor-pointer bg-transparent border-none text-xs font-bold"
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface FormData {
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  sexo: string;
  estadoCivil: string;
  nomeMae: string;
  rg: string;
  nacionalidade: string;
  naturalidade: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  telefonePrincipal: string;
  telefoneSecundario: string;
  email: string;
  contatoEmergenciaNome: string;
  contatoEmergenciaParentesco: string;
  contatoEmergenciaTelefone: string;
  tipoPlano: string;
  operadora: string;
  numeroCarteirinha: string;
  validadeCarteirinha: string;
  alergias: string[];
  medicacoesContinuas: string[];
  comorbidades: string[];
  tipoSanguineo: string;
  peso: string;
  altura: string;
  origem: string;
  motivoInternacao: string;
  cidPrincipal: string;
  medicoResponsavel: string;
  unidadeInternacao: string;
  leito: string;
  prioridade: string;
  dataHoraAdmissao: string;
}

export default function NovoPatientPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<FormData>({
    nomeCompleto: '',
    cpf: '',
    dataNascimento: '',
    sexo: '',
    estadoCivil: '',
    nomeMae: '',
    rg: '',
    nacionalidade: 'Brasileira',
    naturalidade: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    telefonePrincipal: '',
    telefoneSecundario: '',
    email: '',
    contatoEmergenciaNome: '',
    contatoEmergenciaParentesco: '',
    contatoEmergenciaTelefone: '',
    tipoPlano: 'SUS',
    operadora: '',
    numeroCarteirinha: '',
    validadeCarteirinha: '',
    alergias: [],
    medicacoesContinuas: [],
    comorbidades: [],
    tipoSanguineo: '',
    peso: '',
    altura: '',
    origem: 'Pronto Atendimento',
    motivoInternacao: '',
    cidPrincipal: '',
    medicoResponsavel: '',
    unidadeInternacao: '',
    leito: '',
    prioridade: 'Normal',
    dataHoraAdmissao: getNowLocalIso(),
  });

  function updateField(field: keyof FormData, value: string | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function toggleComorbidity(c: string) {
    setForm((prev) => ({
      ...prev,
      comorbidades: prev.comorbidades.includes(c)
        ? prev.comorbidades.filter((x) => x !== c)
        : [...prev.comorbidades, c],
    }));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!form.nomeCompleto.trim()) errors.nomeCompleto = 'Nome completo e obrigatorio';
    if (!form.cpf.trim()) errors.cpf = 'CPF e obrigatorio';
    else if (form.cpf.replace(/\D/g, '').length !== 11) errors.cpf = 'CPF deve ter 11 digitos';
    if (!form.dataNascimento) errors.dataNascimento = 'Data de nascimento e obrigatoria';
    if (!form.sexo) errors.sexo = 'Sexo e obrigatorio';
    if (!form.nomeMae.trim()) errors.nomeMae = 'Nome da mae e obrigatorio';
    if (!form.telefonePrincipal.trim()) errors.telefonePrincipal = 'Telefone principal e obrigatorio';
    if (!form.contatoEmergenciaNome.trim()) errors.contatoEmergenciaNome = 'Nome do contato e obrigatorio';
    if (!form.contatoEmergenciaParentesco.trim()) errors.contatoEmergenciaParentesco = 'Parentesco e obrigatorio';
    if (!form.contatoEmergenciaTelefone.trim()) errors.contatoEmergenciaTelefone = 'Telefone do contato e obrigatorio';
    if (!form.motivoInternacao.trim()) errors.motivoInternacao = 'Motivo da internacao e obrigatorio';
    if (!form.medicoResponsavel.trim()) errors.medicoResponsavel = 'Medico responsavel e obrigatorio';
    if (!form.unidadeInternacao.trim()) errors.unidadeInternacao = 'Unidade de internacao e obrigatoria';
    if (!form.leito.trim()) errors.leito = 'Leito e obrigatorio';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!validate()) {
      setError('Corrija os campos destacados antes de salvar.');
      return;
    }

    setSubmitting(true);

    try {
      const body = {
        ...form,
        dataHoraAdmissao: form.dataHoraAdmissao
          ? new Date(form.dataHoraAdmissao).toISOString()
          : new Date().toISOString(),
      };

      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erro ao cadastrar paciente.');
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      router.push(`/patients/${data.mrn}`);
    } catch {
      setError('Erro de conexao. Tente novamente.');
      setSubmitting(false);
    }
  }

  return (
    <AppShell pageTitle="Admissao de Paciente">
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <div className="mb-4">
          <Link
            href="/patients"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 no-underline font-medium"
          >
            {'\u2190'} Voltar para Pacientes
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Admissao de Paciente</h1>
          <p className="text-sm text-slate-500 mt-1">
            Preencha os dados para cadastro e internacao. Campos marcados com * sao obrigatorios.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ---- DADOS PESSOAIS ---- */}
          <Section title="Dados Pessoais" icon={'\uD83D\uDC64'}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Field label="Nome completo" required error={fieldErrors.nomeCompleto}>
                  <input
                    type="text"
                    value={form.nomeCompleto}
                    onChange={(e) => updateField('nomeCompleto', e.target.value)}
                    placeholder="Nome completo do paciente"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="CPF" required error={fieldErrors.cpf}>
                <input
                  type="text"
                  value={form.cpf}
                  onChange={(e) => updateField('cpf', e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className={inputClass}
                />
              </Field>
              <Field label="RG">
                <input
                  type="text"
                  value={form.rg}
                  onChange={(e) => updateField('rg', e.target.value)}
                  placeholder="Numero do RG"
                  className={inputClass}
                />
              </Field>
              <Field label="Data de nascimento" required error={fieldErrors.dataNascimento}>
                <input
                  type="date"
                  value={form.dataNascimento}
                  onChange={(e) => updateField('dataNascimento', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Sexo" required error={fieldErrors.sexo}>
                <select
                  value={form.sexo}
                  onChange={(e) => updateField('sexo', e.target.value)}
                  className={selectClass}
                >
                  <option value="">Selecione...</option>
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                  <option value="other">Outro</option>
                </select>
              </Field>
              <Field label="Estado civil">
                <select
                  value={form.estadoCivil}
                  onChange={(e) => updateField('estadoCivil', e.target.value)}
                  className={selectClass}
                >
                  <option value="">Selecione...</option>
                  <option value="Solteiro(a)">Solteiro(a)</option>
                  <option value="Casado(a)">Casado(a)</option>
                  <option value="Divorciado(a)">Divorciado(a)</option>
                  <option value="Viuvo(a)">Viuvo(a)</option>
                  <option value="Uniao estavel">Uniao estavel</option>
                </select>
              </Field>
              <Field label="Nome da mae" required error={fieldErrors.nomeMae}>
                <input
                  type="text"
                  value={form.nomeMae}
                  onChange={(e) => updateField('nomeMae', e.target.value)}
                  placeholder="Nome completo da mae"
                  className={inputClass}
                />
              </Field>
              <Field label="Nacionalidade">
                <input
                  type="text"
                  value={form.nacionalidade}
                  onChange={(e) => updateField('nacionalidade', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Naturalidade">
                <input
                  type="text"
                  value={form.naturalidade}
                  onChange={(e) => updateField('naturalidade', e.target.value)}
                  placeholder="Cidade de nascimento"
                  className={inputClass}
                />
              </Field>
            </div>

            {/* Endereco */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Endereco</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="CEP">
                  <input
                    type="text"
                    value={form.cep}
                    onChange={(e) => updateField('cep', e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className={inputClass}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Rua">
                    <input
                      type="text"
                      value={form.rua}
                      onChange={(e) => updateField('rua', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label="Numero">
                  <input
                    type="text"
                    value={form.numero}
                    onChange={(e) => updateField('numero', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Complemento">
                  <input
                    type="text"
                    value={form.complemento}
                    onChange={(e) => updateField('complemento', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Bairro">
                  <input
                    type="text"
                    value={form.bairro}
                    onChange={(e) => updateField('bairro', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Cidade">
                  <input
                    type="text"
                    value={form.cidade}
                    onChange={(e) => updateField('cidade', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Estado">
                  <select
                    value={form.estado}
                    onChange={(e) => updateField('estado', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Selecione...</option>
                    {STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            {/* Contato */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Contato</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Telefone principal" required error={fieldErrors.telefonePrincipal}>
                  <input
                    type="tel"
                    value={form.telefonePrincipal}
                    onChange={(e) => updateField('telefonePrincipal', e.target.value)}
                    placeholder="(00) 00000-0000"
                    className={inputClass}
                  />
                </Field>
                <Field label="Telefone secundario">
                  <input
                    type="tel"
                    value={form.telefoneSecundario}
                    onChange={(e) => updateField('telefoneSecundario', e.target.value)}
                    placeholder="(00) 00000-0000"
                    className={inputClass}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="email@exemplo.com"
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          </Section>

          {/* ---- CONTATO DE EMERGENCIA ---- */}
          <Section title="Contato de Emergencia" icon={'\uD83D\uDCDE'}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Nome" required error={fieldErrors.contatoEmergenciaNome}>
                <input
                  type="text"
                  value={form.contatoEmergenciaNome}
                  onChange={(e) => updateField('contatoEmergenciaNome', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Parentesco" required error={fieldErrors.contatoEmergenciaParentesco}>
                <input
                  type="text"
                  value={form.contatoEmergenciaParentesco}
                  onChange={(e) => updateField('contatoEmergenciaParentesco', e.target.value)}
                  placeholder="Ex: Conjuge, Filho(a), Pai/Mae"
                  className={inputClass}
                />
              </Field>
              <Field label="Telefone" required error={fieldErrors.contatoEmergenciaTelefone}>
                <input
                  type="tel"
                  value={form.contatoEmergenciaTelefone}
                  onChange={(e) => updateField('contatoEmergenciaTelefone', e.target.value)}
                  placeholder="(00) 00000-0000"
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          {/* ---- PLANO / CONVENIO ---- */}
          <Section title="Dados do Plano / Convenio" icon={'\uD83D\uDCB3'} defaultOpen={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tipo">
                <select
                  value={form.tipoPlano}
                  onChange={(e) => updateField('tipoPlano', e.target.value)}
                  className={selectClass}
                >
                  <option value="SUS">SUS</option>
                  <option value="Convenio">Convenio</option>
                  <option value="Particular">Particular</option>
                </select>
              </Field>
              <Field label="Operadora">
                <input
                  type="text"
                  value={form.operadora}
                  onChange={(e) => updateField('operadora', e.target.value)}
                  placeholder="Nome da operadora"
                  className={inputClass}
                />
              </Field>
              <Field label="Numero da carteirinha">
                <input
                  type="text"
                  value={form.numeroCarteirinha}
                  onChange={(e) => updateField('numeroCarteirinha', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Validade">
                <input
                  type="date"
                  value={form.validadeCarteirinha}
                  onChange={(e) => updateField('validadeCarteirinha', e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          {/* ---- DADOS CLINICOS INICIAIS ---- */}
          <Section title="Dados Clinicos Iniciais" icon={'\uD83E\uDE7A'}>
            <div className="space-y-4">
              <Field label="Alergias conhecidas">
                <MultiValueInput
                  values={form.alergias}
                  onChange={(v) => updateField('alergias', v)}
                  placeholder="Digite uma alergia e pressione Enter"
                />
              </Field>

              <Field label="Medicacoes em uso continuo">
                <MultiValueInput
                  values={form.medicacoesContinuas}
                  onChange={(v) => updateField('medicacoesContinuas', v)}
                  placeholder="Digite medicacao e pressione Enter"
                />
              </Field>

              <Field label="Comorbidades">
                <div className="flex flex-wrap gap-2">
                  {COMORBIDITIES_OPTIONS.map((c) => (
                    <label
                      key={c}
                      className={`
                        inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                        border cursor-pointer transition-all select-none
                        ${
                          form.comorbidades.includes(c)
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={form.comorbidades.includes(c)}
                        onChange={() => toggleComorbidity(c)}
                        className="sr-only"
                      />
                      {form.comorbidades.includes(c) ? '\u2713 ' : ''}
                      {c}
                    </label>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Tipo sanguineo">
                  <select
                    value={form.tipoSanguineo}
                    onChange={(e) => updateField('tipoSanguineo', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Selecione...</option>
                    {BLOOD_TYPES.map((bt) => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Peso (kg)">
                  <input
                    type="number"
                    step="0.1"
                    value={form.peso}
                    onChange={(e) => updateField('peso', e.target.value)}
                    placeholder="Ex: 72.5"
                    className={inputClass}
                  />
                </Field>
                <Field label="Altura (cm)">
                  <input
                    type="number"
                    step="1"
                    value={form.altura}
                    onChange={(e) => updateField('altura', e.target.value)}
                    placeholder="Ex: 170"
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          </Section>

          {/* ---- DADOS DA INTERNACAO ---- */}
          <Section title="Dados da Internacao" icon={'\uD83C\uDFE5'}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Origem">
                <select
                  value={form.origem}
                  onChange={(e) => updateField('origem', e.target.value)}
                  className={selectClass}
                >
                  {ORIGINS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Prioridade">
                <select
                  value={form.prioridade}
                  onChange={(e) => updateField('prioridade', e.target.value)}
                  className={selectClass}
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgente">Urgente</option>
                  <option value="Emergencia">Emergencia</option>
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Motivo da internacao" required error={fieldErrors.motivoInternacao}>
                  <textarea
                    value={form.motivoInternacao}
                    onChange={(e) => updateField('motivoInternacao', e.target.value)}
                    rows={3}
                    placeholder="Descreva o motivo da internacao..."
                    className={inputClass + ' resize-y'}
                  />
                </Field>
              </div>
              <Field label="CID principal">
                <input
                  type="text"
                  value={form.cidPrincipal}
                  onChange={(e) => updateField('cidPrincipal', e.target.value)}
                  placeholder="Ex: I21.0"
                  className={inputClass}
                />
              </Field>
              <Field label="Medico responsavel" required error={fieldErrors.medicoResponsavel}>
                <input
                  type="text"
                  value={form.medicoResponsavel}
                  onChange={(e) => updateField('medicoResponsavel', e.target.value)}
                  placeholder="Nome do medico"
                  className={inputClass}
                />
              </Field>
              <Field label="Unidade de internacao" required error={fieldErrors.unidadeInternacao}>
                <input
                  type="text"
                  value={form.unidadeInternacao}
                  onChange={(e) => updateField('unidadeInternacao', e.target.value)}
                  placeholder="Ex: Ala 2A, UTI, CC"
                  className={inputClass}
                />
              </Field>
              <Field label="Leito" required error={fieldErrors.leito}>
                <input
                  type="text"
                  value={form.leito}
                  onChange={(e) => updateField('leito', e.target.value)}
                  placeholder="Ex: 2A-05"
                  className={inputClass}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Data/hora da admissao" required>
                  <input
                    type="datetime-local"
                    value={form.dataHoraAdmissao}
                    onChange={(e) => updateField('dataHoraAdmissao', e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          </Section>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2 pb-8">
            <button
              type="submit"
              disabled={submitting}
              className={`
                px-8 py-3 rounded-lg text-sm font-bold text-white transition-colors shadow-sm
                ${submitting
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                }
              `}
            >
              {submitting ? 'Cadastrando...' : 'Cadastrar e Admitir Paciente'}
            </button>
            <Link
              href="/patients"
              className="px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-800 no-underline"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
