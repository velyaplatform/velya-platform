'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ROLES = [
  'Coordenador de Ala',
  'Medico',
  'Enfermeiro(a)',
  'Tecnico de Enfermagem',
  'Planejador de Alta',
  'Farmaceutico',
  'Fisioterapeuta',
  'Recepcao',
  'Motorista',
  'Higienizacao',
  'Faturamento',
  'Diretor Clinico',
  'Administrador',
];

const ROLES_WITH_COUNCIL = [
  'Medico',
  'Enfermeiro(a)',
  'Tecnico de Enfermagem',
  'Farmaceutico',
  'Fisioterapeuta',
  'Coordenador de Ala',
  'Diretor Clinico',
];

export default function RegisterPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('');
  const [setor, setSetor] = useState('');
  const [conselhoProfissional, setConselhoProfissional] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const showCouncil = ROLES_WITH_COUNCIL.includes(role);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!nome || !email || !password || !confirmPassword || !role || !setor) {
      setError('Preencha todos os campos obrigatorios');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no minimo 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          nome,
          role,
          setor,
          conselhoProfissional: showCouncil ? conselhoProfissional : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta');
        setLoading(false);
        return;
      }

      router.push(
        `/verify?email=${encodeURIComponent(email)}${data.devCode ? `&devCode=${data.devCode}` : ''}`,
      );
    } catch {
      setError('Erro de conexao. Tente novamente.');
      setLoading(false);
    }
  }

  // Light-theme input per the Velya UI standard (white bg, dark text, blue
  // accent). min-h-[44px] hits the WCAG 2.2 AA touch-target minimum.
  const inputClass =
    'w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition';

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-8">
      <section
        aria-labelledby="register-title"
        className="w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10"
      >
        {/* Header */}
        <header className="mb-8 text-center">
          <div className="text-2xl font-bold tracking-tight text-neutral-900">Velya</div>
          <div className="mt-1 text-xs font-medium uppercase tracking-widest text-neutral-500">
            Plataforma Hospitalar
          </div>
          <h1 id="register-title" className="mt-6 text-xl font-semibold text-neutral-900">
            Criar Conta
          </h1>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {/* Nome Completo */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nome" className="text-sm font-medium text-slate-700">
              Nome Completo *
            </label>
            <input
              id="nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Dr. Carlos Silva"
              className={inputClass}
              autoComplete="name"
              required
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email *
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@hospital.com"
              className={inputClass}
              autoComplete="email"
              required
            />
          </div>

          {/* Senha row - stacks on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Senha *
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={inputClass}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
                Confirmar Senha *
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className={inputClass}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          {/* Profissao */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="role" className="text-sm font-medium text-slate-700">
              Profissão / Função *
            </label>
            <select
              id="role"
              name="role"
              aria-label="Profissão ou função no hospital"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full min-h-[44px] cursor-pointer rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            >
              <option value="">Selecione sua função</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Setor */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="setor" className="text-sm font-medium text-slate-700">
              Setor / Unidade *
            </label>
            <input
              id="setor"
              type="text"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              placeholder="Ex: UTI Adulto, Ala 2B, Pronto Atendimento"
              className={inputClass}
              required
            />
          </div>

          {/* Registro Profissional (conditional) */}
          {showCouncil && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="conselho" className="text-sm font-medium text-slate-700">
                Registro Profissional
              </label>
              <input
                id="conselho"
                type="text"
                value={conselhoProfissional}
                onChange={(e) => setConselhoProfissional(e.target.value)}
                placeholder="Ex: CRM-SP 12345, COREN-RJ 67890"
                className={inputClass}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>

          <div className="mt-2 py-2 text-center">
            <span className="text-sm text-neutral-500">Já tem conta? </span>
            <Link
              href="/login"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-3 text-sm font-semibold text-blue-600 transition hover:text-blue-700 hover:underline"
            >
              Entrar
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
