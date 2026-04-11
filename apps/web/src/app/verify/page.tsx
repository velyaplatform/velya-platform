'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const devCode = searchParams.get('devCode') || '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [currentDevCode, setCurrentDevCode] = useState(devCode);

  useEffect(() => {
    if (!email) {
      router.push('/register');
    }
  }, [email, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!code || code.length !== 6) {
      setError('Insira o codigo de 6 digitos');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro na verificacao');
        setLoading(false);
        return;
      }

      setSuccess('Email verificado com sucesso! Redirecionando...');
      setTimeout(() => router.push('/login'), 1500);
    } catch {
      setError('Erro de conexao. Tente novamente.');
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, resend: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao reenviar codigo');
        setResending(false);
        return;
      }

      setSuccess('Novo codigo enviado!');
      if (data.devCode) {
        setCurrentDevCode(data.devCode);
      }
      setResending(false);
    } catch {
      setError('Erro de conexao.');
      setResending(false);
    }
  }

  if (!email) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-8">
      <section
        aria-labelledby="verify-title"
        className="w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10"
      >
        {/* Header */}
        <header className="mb-6 text-center">
          <div className="text-2xl font-bold tracking-tight text-neutral-900">Velya</div>
          <div className="mt-1 text-xs font-medium uppercase tracking-widest text-neutral-500">
            Plataforma Hospitalar
          </div>
          <h1 id="verify-title" className="mt-6 text-xl font-semibold text-neutral-900">
            Verificar Email
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Código de verificação enviado para{' '}
            <strong className="text-neutral-900">{email}</strong>
          </p>
        </header>

        {/* Dev banner */}
        {currentDevCode && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800"
          >
            <strong>Modo desenvolvimento</strong> — código:{' '}
            <span className="font-mono text-lg font-bold tracking-[0.15em] text-amber-900">
              {currentDevCode}
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-700"
            >
              {success}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="code" className="text-center text-sm font-medium text-neutral-700">
              Código de 6 dígitos
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(val);
              }}
              placeholder="000000"
              className="w-full min-h-[56px] rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-neutral-900 shadow-sm placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              maxLength={6}
              autoFocus
              autoComplete="one-time-code"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center border-none bg-transparent px-4 text-sm font-semibold text-blue-600 underline transition hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resending ? 'Reenviando...' : 'Reenviar código'}
            </button>
          </div>

          <div className="py-1 text-center">
            <Link
              href="/register"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-4 text-sm text-neutral-500 underline-offset-2 transition hover:text-neutral-900 hover:underline"
            >
              Voltar ao cadastro
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-white text-neutral-500">
          <h1 className="sr-only">Verificação de Email</h1>
          Carregando...
        </main>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
