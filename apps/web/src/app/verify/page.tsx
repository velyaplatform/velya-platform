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
    <div className="min-h-screen bg-velya-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[440px] bg-velya-card rounded-2xl p-8 sm:p-10 shadow-2xl border border-velya-border">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-white tracking-tight">Velya</div>
          <div className="text-[0.7rem] text-velya-subtle uppercase tracking-widest mt-0.5">
            Plataforma Hospitalar
          </div>
          <h1 className="text-xl font-semibold text-velya-text mt-6">Verificar Email</h1>
          <p className="text-sm text-velya-subtle mt-2">
            Codigo de verificacao enviado para <strong className="text-velya-muted">{email}</strong>
          </p>
        </div>

        {/* Dev banner */}
        {currentDevCode && (
          <div className="bg-yellow-500/15 border border-yellow-500/30 rounded-lg px-4 py-3 text-yellow-400 text-sm text-center mb-4">
            <strong>Modo desenvolvimento</strong> — codigo:{' '}
            <span className="font-mono text-lg font-bold tracking-[0.15em]">{currentDevCode}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm text-center">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/15 border border-green-500/30 rounded-lg px-4 py-3 text-green-300 text-sm text-center">
              {success}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-velya-muted text-center">
              Codigo de 6 digitos
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(val);
              }}
              placeholder="000000"
              className="w-full min-h-[52px] bg-white/[0.06] border border-white/15 rounded-lg px-4 py-3 text-white text-2xl font-mono text-center tracking-[0.3em] placeholder:text-velya-subtle focus:outline-none focus:ring-2 focus:ring-velya-primary/50 focus:border-velya-primary transition"
              maxLength={6}
              autoFocus
              autoComplete="one-time-code"
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full min-h-[44px] bg-velya-primary hover:bg-blue-600 text-white font-semibold text-base rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="bg-transparent border-none text-blue-400 hover:text-blue-300 text-sm font-medium cursor-pointer underline transition disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] px-4"
            >
              {resending ? 'Reenviando...' : 'Reenviar codigo'}
            </button>
          </div>

          <div className="text-center py-1">
            <Link
              href="/register"
              className="text-sm text-velya-subtle hover:text-velya-muted transition inline-block min-h-[44px] leading-[44px] px-4"
            >
              Voltar ao cadastro
            </Link>
          </div>
        </form>
      </div>
    </div>
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
