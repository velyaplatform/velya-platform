'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Mail, Lock, ArrowRight, ShieldCheck, HeartPulse } from 'lucide-react';
import { VelyaLogo } from '../components/velya/velya-logo';
import { VelyaECGStrip } from '../components/velya/velya-ecg-strip';
import { VelyaMedicalCross } from '../components/velya/velya-medical-cross';
import { VelyaShiftIndicator } from '../components/velya/velya-shift-indicator';
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030712] px-4 py-8">
      {/* Decorative glow background — acentos hospitalares */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 50% at 50% 10%, rgba(20,184,166,0.18), transparent 60%),
            radial-gradient(ellipse 50% 40% at 85% 85%, rgba(16,185,129,0.10), transparent 60%),
            radial-gradient(ellipse 30% 20% at 15% 80%, rgba(56,189,248,0.08), transparent 60%)
          `,
        }}
      />
      {/* Grid monitor médico */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #2dd4bf 1px, transparent 1px), linear-gradient(to bottom, #2dd4bf 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Marca-d'água: cruz médica gigante no canto direito */}
      <div className="pointer-events-none absolute -right-20 bottom-20 opacity-[0.04]">
        <VelyaMedicalCross size={480} variant="solid" />
      </div>

      {/* Faixa ECG no topo da página — reforça "plataforma hospitalar viva" */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-20 overflow-hidden opacity-60">
        <VelyaECGStrip height={80} showGrid className="border-0 rounded-none bg-transparent" />
      </div>

      <section
        aria-labelledby="login-title"
        className="relative w-full max-w-[440px] rounded-3xl border border-white/[0.08] bg-[rgba(15,22,35,0.72)] p-8 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-2xl backdrop-saturate-150 sm:p-10"
      >
        {/* Teal top accent line */}
        <div className="absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />

        {/* Cruz médica decorativa no canto */}
        <div className="absolute right-5 top-5 opacity-25">
          <VelyaMedicalCross size={22} variant="outline" />
        </div>

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

          {/* Shift indicator — "plantão ativo" reforça que é sistema de hospital 24/7 */}
          <div className="mt-5">
            <VelyaShiftIndicator />
          </div>

          <h1 id="login-title" className="mt-6 text-lg font-semibold text-slate-100">
            Acesso ao prontuário
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <HeartPulse className="h-3 w-3 text-teal-400" />
            Central de operações clínicas
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

        {/* Footer — credenciais clínicas + certificações */}
        <div className="mt-8 space-y-3">
          {/* Linha de compliance */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-0.5 text-emerald-400">
              <ShieldCheck className="h-3 w-3" /> LGPD
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/20 bg-teal-500/[0.06] px-2 py-0.5 text-teal-400">
              CFM 2.314/22
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/[0.06] px-2 py-0.5 text-sky-400">
              HL7 FHIR R4
            </span>
          </div>
          {/* Linha de segurança */}
          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.7)]" />
            <span className="font-mono uppercase tracking-wider">
              Sessão TLS 1.3 · Auditoria SHA-256 · WCAG AA
            </span>
          </div>
          <p className="text-center text-[10px] text-slate-600">
            Em caso de emergência clínica, ligue <strong className="text-red-400">192 (SAMU)</strong>.
            Suporte 24/7: <span className="font-mono text-slate-500">plantao@velyahospitalar.com</span>
          </p>
        </div>
      </section>
    </main>
  );
}
