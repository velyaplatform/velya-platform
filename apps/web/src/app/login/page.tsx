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
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-[400px]"
      >
        <header className="mb-8 flex flex-col items-center">
          <VelyaLogo size={36} />
          <h1
            id="login-title"
            className="mt-8 text-2xl font-semibold tracking-tight text-neutral-900"
          >
            Acesso ao prontuário
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Entre com sua conta profissional
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-neutral-700"
            >
              Email
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
                aria-hidden="true"
              />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@hospital.com"
                style={{ paddingLeft: '2.25rem' }}
                autoComplete="email"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-neutral-700"
            >
              Senha
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
                aria-hidden="true"
              />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                style={{ paddingLeft: '2.25rem' }}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} size="lg" className="w-full">
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Entrando…
              </>
            ) : (
              <>
                Entrar <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <div className="pt-2 text-center text-sm text-neutral-500">
            Não tem conta?{' '}
            <Link
              href="/register"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-3 font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Cadastrar
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
