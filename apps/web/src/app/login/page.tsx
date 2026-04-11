'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Mail, Lock, ArrowRight } from 'lucide-react';
import { VelyaLogo } from '../components/velya/velya-logo';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

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
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0e17] px-4 py-8">
      {/* Decorative glow background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 50% at 50% 10%, rgba(20,184,166,0.15), transparent 60%),
            radial-gradient(ellipse 40% 30% at 80% 80%, rgba(59,130,246,0.08), transparent 60%),
            radial-gradient(ellipse 30% 20% at 20% 80%, rgba(168,85,247,0.08), transparent 60%)
          `,
        }}
      />
      {/* Decorative grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <section
        aria-labelledby="login-title"
        className="relative w-full max-w-[440px] rounded-3xl border border-white/[0.08] bg-[rgba(15,22,35,0.72)] p-8 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-2xl backdrop-saturate-150 sm:p-10"
      >
        {/* Teal top accent line */}
        <div className="absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />

        {/* Logo */}
        <header className="mb-8 flex flex-col items-center">
          <VelyaLogo size={56} wordmark={false} />
          <div className="mt-4 flex flex-col items-center">
            <div className="bg-gradient-to-br from-teal-200 via-teal-300 to-teal-500 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
              Velya
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Plataforma Hospitalar
            </div>
          </div>
          <h1 id="login-title" className="mt-6 text-lg font-semibold text-slate-100">
            Entrar
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Acesso à sua central de operações clínicas
          </p>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2.5 text-sm text-red-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@hospital.com"
                className="pl-9"
                autoComplete="email"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Senha
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                className="pl-9"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} size="lg" className="mt-2 w-full">
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Entrando…
              </>
            ) : (
              <>
                Entrar <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <div className="mt-2 text-center">
            <span className="text-xs text-slate-500">Não tem conta? </span>
            <Link
              href="/register"
              className="text-xs font-semibold text-teal-300 hover:text-teal-200 hover:underline"
            >
              Cadastrar
            </Link>
          </div>
        </form>

        {/* Footer badge */}
        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.7)]" />
          <span className="font-mono uppercase tracking-wider">Sessão TLS · WCAG AA</span>
        </div>
      </section>
    </main>
  );
}
