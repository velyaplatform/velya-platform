'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Preencha email e senha');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login');
        setLoading(false);
        return;
      }

      router.push('/');
    } catch {
      setError('Erro de conexao. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-velya-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px] bg-velya-card rounded-2xl p-8 sm:p-10 shadow-2xl border border-velya-border">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-white tracking-tight">Velya</div>
          <div className="text-[0.7rem] text-velya-subtle uppercase tracking-widest mt-0.5">
            Plataforma Hospitalar
          </div>
          <h1 className="text-xl font-semibold text-velya-text mt-6">Entrar</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-velya-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@hospital.com"
              className="w-full min-h-[44px] bg-white/[0.06] border border-white/15 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder:text-velya-subtle focus:outline-none focus:ring-2 focus:ring-velya-primary/50 focus:border-velya-primary transition"
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-velya-muted">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              className="w-full min-h-[44px] bg-white/[0.06] border border-white/15 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder:text-velya-subtle focus:outline-none focus:ring-2 focus:ring-velya-primary/50 focus:border-velya-primary transition"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] bg-velya-primary hover:bg-blue-600 text-white font-semibold text-base rounded-lg mt-2 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="text-center mt-2 py-2">
            <span className="text-sm text-velya-subtle">Nao tem conta? </span>
            <Link href="/register" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition inline-block min-h-[44px] leading-[44px]">
              Cadastrar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
