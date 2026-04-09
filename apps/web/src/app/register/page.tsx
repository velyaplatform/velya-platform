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

      router.push(`/verify?email=${encodeURIComponent(email)}${data.devCode ? `&devCode=${data.devCode}` : ''}`);
    } catch {
      setError('Erro de conexao. Tente novamente.');
      setLoading(false);
    }
  }

  const inputClass =
    'w-full min-h-[44px] bg-white/[0.06] border border-white/15 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder:text-velya-subtle focus:outline-none focus:ring-2 focus:ring-velya-primary/50 focus:border-velya-primary transition';

  return (
    <div className="min-h-screen bg-velya-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[520px] bg-velya-card rounded-2xl p-8 sm:p-10 shadow-2xl border border-velya-border">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-white tracking-tight">Velya</div>
          <div className="text-[0.7rem] text-velya-subtle uppercase tracking-widest mt-0.5">
            Plataforma Hospitalar
          </div>
          <h1 className="text-xl font-semibold text-velya-text mt-6">Criar Conta</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Nome Completo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-velya-muted">Nome Completo *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Dr. Carlos Silva"
              className={inputClass}
              autoComplete="name"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-velya-muted">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@hospital.com"
              className={inputClass}
              autoComplete="email"
            />
          </div>

          {/* Senha row - stacks on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-velya-muted">Senha *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 6 caracteres"
                className={inputClass}
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-velya-muted">Confirmar Senha *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className={inputClass}
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Profissao */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-velya-muted">Profissao / Funcao *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full min-h-[44px] bg-velya-card border border-white/15 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-velya-primary/50 focus:border-velya-primary transition cursor-pointer appearance-none"
            >
              <option value="">Selecione sua funcao</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Setor */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-velya-muted">Setor / Unidade *</label>
            <input
              type="text"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              placeholder="Ex: UTI Adulto, Ala 2B, Pronto Atendimento"
              className={inputClass}
            />
          </div>

          {/* Registro Profissional (conditional) */}
          {showCouncil && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-velya-muted">Registro Profissional</label>
              <input
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
            className="w-full min-h-[44px] bg-velya-primary hover:bg-blue-600 text-white font-semibold text-base rounded-lg mt-2 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>

          <div className="text-center mt-2">
            <span className="text-sm text-velya-subtle">Ja tem conta? </span>
            <Link href="/login" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition">
              Entrar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
