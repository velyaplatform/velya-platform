'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log to the server-side error reporter
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'root-error-boundary',
        severity: 'error',
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        metadata: { digest: error.digest },
        url: typeof window !== 'undefined' ? window.location.href : '',
      }),
    }).catch(() => {
      /* best effort */
    });
  }, [error]);

  return (
    <main
      role="alert"
      aria-live="assertive"
      className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] text-[var(--text-primary)] px-4"
    >
      <section
        aria-labelledby="error-title"
        className="max-w-md w-full bg-white border border-neutral-300 rounded-xl p-8 shadow-2xl"
      >
        <h1 id="error-title" className="text-2xl font-bold text-neutral-900 mb-2">
          Algo deu errado
        </h1>
        <p className="text-neutral-500 text-sm mb-4">
          Ocorreu um erro inesperado. O time técnico já foi notificado.
        </p>
        {error.digest && (
          <p className="text-neutral-500 text-xs font-mono mb-4">
            Código do incidente: <span className="text-neutral-700">{error.digest}</span>
          </p>
        )}
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={reset}
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
          >
            Tentar novamente
          </button>
          <Link
            href="/"
            className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
          >
            Voltar ao Centro de Comando
          </Link>
        </div>
      </section>
    </main>
  );
}
