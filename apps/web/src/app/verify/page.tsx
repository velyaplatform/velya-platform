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
    <main className="min-h-screen bg-velya-bg flex items-center justify-center px-4 py-8">
      <section
        aria-labelledby="verify-title"
        className="w-full max-w-[440px] bg-velya-card rounded-2xl p-8 sm:p-10 shadow-2xl border border-velya-border"
      >
        {/* Header */}
        <header className="text-center mb-6">
          <div className="text-2xl font-bold text-white tracking-tight">Velya</div>
          <div className="text-xs text-slate-600 uppercase tracking-widest mt-1 font-medium">
            Plataforma Hospitalar
          </div>
          <h1 id="verify-title" className="text-xl font-semibold text-white mt-6">
            Verificar Email
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Código de verificação enviado para <strong className="text-white">{email}</strong>
          </p>
        </header>

        {/* Dev banner */}
        {currentDevCode && (
          <div
            role="status"
            className="bg-yellow-500/20 border border-yellow-400/50 rounded-lg px-4 py-3 text-yellow-200 text-sm text-center mb-4"
          >
            <strong>Modo desenvolvimento</strong> — código:{' '}
            <span className="font-mono text-lg font-bold tracking-[0.15em] text-yellow-100">
              {currentDevCode}
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div
              role="alert"
              className="bg-red-500/20 border border-red-400/50 rounded-lg px-4 py-3 text-red-800 text-sm text-center"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              className="bg-green-500/20 border border-green-400/50 rounded-lg px-4 py-3 text-green-800 text-sm text-center"
            >
              {success}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="code" className="text-sm font-medium text-slate-700 text-center">
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
              className="w-full min-h-[56px] bg-white/10 border border-white/30 rounded-lg px-4 py-3 text-white text-2xl font-mono text-center tracking-[0.3em] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
              maxLength={6}
              autoFocus
              autoComplete="one-time-code"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full min-h-[48px] bg-blue-700 hover:bg-blue-800 text-white font-semibold text-base rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-velya-card"
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="bg-transparent border-none text-blue-700 hover:text-blue-800 text-sm font-semibold cursor-pointer underline transition disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] px-4"
            >
              {resending ? 'Reenviando...' : 'Reenviar código'}
            </button>
          </div>

          <div className="text-center py-1">
            <Link
              href="/register"
              className="text-sm text-slate-600 hover:text-white transition inline-block min-h-[44px] leading-[44px] px-4 underline-offset-2 hover:underline"
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
        <div className="min-h-screen bg-velya-bg flex items-center justify-center text-white">
          Carregando...
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
