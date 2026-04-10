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
    <main className="min-h-screen bg-velya-bg flex items-center justify-center px-4 py-8">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-[420px] bg-velya-card rounded-2xl p-8 sm:p-10 shadow-2xl border border-velya-border"
      >
        {/* Header */}
        <header className="text-center mb-8">
          <div className="text-2xl font-bold text-white tracking-tight">Velya</div>
          <div className="text-xs text-slate-300 uppercase tracking-widest mt-1 font-medium">
            Plataforma Hospitalar
          </div>
          <h1 id="login-title" className="text-xl font-semibold text-white mt-6">
            Entrar
          </h1>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div
              role="alert"
              className="bg-red-500/20 border border-red-400/50 rounded-lg px-4 py-3 text-red-200 text-sm text-center"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-200">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@hospital.com"
              className="w-full min-h-[44px] bg-white/10 border border-white/30 rounded-lg px-3.5 py-2.5 text-white text-base placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
              autoComplete="email"
              autoFocus
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-slate-200">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              className="w-full min-h-[44px] bg-white/10 border border-white/30 rounded-lg px-3.5 py-2.5 text-white text-base placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] bg-blue-700 hover:bg-blue-800 text-white font-semibold text-base rounded-lg mt-2 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-velya-card"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="text-center mt-2 py-2">
            <span className="text-sm text-slate-300">Não tem conta? </span>
            <Link
              href="/register"
              className="text-sm font-semibold text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline transition inline-block min-h-[44px] leading-[44px]"
            >
              Cadastrar
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
