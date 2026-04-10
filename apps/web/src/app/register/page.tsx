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

  const inputClass =
    'w-full min-h-[44px] bg-white/10 border border-white/30 rounded-lg px-3.5 py-2.5 text-white text-base placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition';

  return (
    <main className="min-h-screen bg-velya-bg flex items-center justify-center px-4 py-8">
      <section
        aria-labelledby="register-title"
        className="w-full max-w-[520px] bg-velya-card rounded-2xl p-8 sm:p-10 shadow-2xl border border-velya-border"
      >
        {/* Header */}
        <header className="text-center mb-8">
          <div className="text-2xl font-bold text-white tracking-tight">Velya</div>
          <div className="text-xs text-slate-300 uppercase tracking-widest mt-1 font-medium">
            Plataforma Hospitalar
          </div>
          <h1 id="register-title" className="text-xl font-semibold text-white mt-6">
            Criar Conta
          </h1>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div
              role="alert"
              className="bg-red-500/20 border border-red-400/50 rounded-lg px-4 py-3 text-red-200 text-sm"
            >
              {error}
            </div>
          )}

          {/* Nome Completo */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nome" className="text-sm font-medium text-slate-200">
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
            <label htmlFor="email" className="text-sm font-medium text-slate-200">
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
              <label htmlFor="password" className="text-sm font-medium text-slate-200">
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
              <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-200">
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
            <label htmlFor="role" className="text-sm font-medium text-slate-200">
              Profissão / Função *
            </label>
            <select
              id="role"
              name="role"
              aria-label="Profissão ou função no hospital"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full min-h-[44px] bg-slate-800 border border-white/30 rounded-lg px-3.5 py-2.5 text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition cursor-pointer"
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
            <label htmlFor="setor" className="text-sm font-medium text-slate-200">
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
              <label htmlFor="conselho" className="text-sm font-medium text-slate-200">
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
            className="w-full min-h-[48px] bg-blue-700 hover:bg-blue-800 text-white font-semibold text-base rounded-lg mt-2 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-velya-card"
          >
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>

          <div className="text-center mt-2 py-2">
            <span className="text-sm text-slate-300">Já tem conta? </span>
            <Link
              href="/login"
              className="text-sm font-semibold text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline transition inline-block min-h-[44px] leading-[44px]"
            >
              Entrar
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
