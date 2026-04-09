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
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>Velya</div>
          <div style={styles.logoSub}>Plataforma Hospitalar</div>
          <h1 style={styles.title}>Verificar Email</h1>
          <p style={styles.subtitle}>
            Codigo de verificacao enviado para <strong>{email}</strong>
          </p>
        </div>

        {currentDevCode && (
          <div style={styles.devBanner}>
            <strong>Modo desenvolvimento</strong> — codigo: <span style={styles.devCode}>{currentDevCode}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}

          <div style={styles.field}>
            <label style={styles.label}>Codigo de 6 digitos</label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(val);
              }}
              placeholder="000000"
              style={styles.codeInput}
              maxLength={6}
              autoFocus
              autoComplete="one-time-code"
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            style={{
              ...styles.button,
              opacity: loading || code.length !== 6 ? 0.6 : 1,
              cursor: loading || code.length !== 6 ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>

          <div style={styles.footer}>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              style={styles.resendBtn}
            >
              {resending ? 'Reenviando...' : 'Reenviar codigo'}
            </button>
          </div>

          <div style={styles.footer}>
            <Link href="/register" style={styles.link}>Voltar ao cadastro</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        Carregando...
      </div>
    }>
      <VerifyForm />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
  },
  card: {
    background: '#1e293b',
    borderRadius: '16px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '440px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '1.5rem',
  },
  logo: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.02em',
  },
  logoSub: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginTop: '2px',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.9)',
    marginTop: '1.5rem',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '0.5rem',
  },
  devBanner: {
    background: 'rgba(234,179,8,0.15)',
    border: '1px solid rgba(234,179,8,0.3)',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    color: '#fbbf24',
    fontSize: '0.85rem',
    textAlign: 'center' as const,
    marginBottom: '1rem',
  },
  devCode: {
    fontFamily: 'monospace',
    fontSize: '1.1rem',
    fontWeight: 700,
    letterSpacing: '0.15em',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center' as const,
  },
  codeInput: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    padding: '0.85rem',
    color: '#ffffff',
    fontSize: '1.5rem',
    fontFamily: 'monospace',
    textAlign: 'center' as const,
    letterSpacing: '0.3em',
    outline: 'none',
    width: '100%',
  },
  button: {
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.75rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  error: {
    background: 'rgba(220,38,38,0.15)',
    border: '1px solid rgba(220,38,38,0.3)',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    color: '#fca5a5',
    fontSize: '0.85rem',
    textAlign: 'center' as const,
  },
  success: {
    background: 'rgba(22,163,74,0.15)',
    border: '1px solid rgba(22,163,74,0.3)',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    color: '#86efac',
    fontSize: '0.85rem',
    textAlign: 'center' as const,
  },
  footer: {
    textAlign: 'center' as const,
  },
  resendBtn: {
    background: 'none',
    border: 'none',
    color: '#60a5fa',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
  },
  link: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.8rem',
    textDecoration: 'none',
  },
};
