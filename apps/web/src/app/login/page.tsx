'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Mail, Lock, ArrowRight, ShieldCheck, HeartPulse, Stethoscope } from 'lucide-react';
import { VelyaLogo } from '../components/velya/velya-logo';
import { VelyaMedicalCross } from '../components/velya/velya-medical-cross';
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
    <main className="relative flex min-h-screen bg-slate-50">
      {/* Left side — branding panel (padrão Epic/Athena) */}
      <aside className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-sky-900 p-12 text-white lg:flex">
        {/* Subtle grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Cross watermark */}
        <div className="pointer-events-none absolute -right-24 bottom-16 opacity-[0.05]">
          <VelyaMedicalCross size={480} variant="solid" />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <VelyaLogo size={40} mono />
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-200/70">
            Plataforma Hospitalar
          </div>
        </div>

        {/* Value prop */}
        <div className="relative z-10 space-y-6">
          <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight">
            A central de operações clínicas do seu hospital.
          </h2>
          <p className="max-w-md text-sm text-sky-100/80">
            Fluxo de pacientes em tempo real, coordenação de altas, NEWS2 e gestão
            de tarefas clínicas — tudo em uma única plataforma auditável.
          </p>

          {/* Feature bullets */}
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                <HeartPulse className="h-4 w-4 text-sky-300" />
              </span>
              <span className="text-slate-200">NEWS2 + Hour-1 Bundle (SSC 2024)</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                <Stethoscope className="h-4 w-4 text-sky-300" />
              </span>
              <span className="text-slate-200">Torre de altas com coordenação de bloqueios</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                <ShieldCheck className="h-4 w-4 text-sky-300" />
              </span>
              <span className="text-slate-200">Auditoria SHA-256 · LGPD · HL7 FHIR R4</span>
            </li>
          </ul>
        </div>

        {/* Footer credential */}
        <div className="relative z-10 flex items-center gap-3 text-xs text-sky-200/60">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="font-mono uppercase tracking-wider">
            Sistema em operação · 24/7
          </span>
        </div>
      </aside>

      {/* Right side — formulário */}
      <section
        aria-labelledby="login-title"
        className="relative flex w-full flex-col items-center justify-center px-6 py-12 lg:w-[520px]"
      >
        {/* Mobile-only logo */}
        <div className="mb-8 flex items-center lg:hidden">
          <VelyaLogo size={36} />
        </div>

        <div className="w-full max-w-sm">
          <header className="mb-8">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Plantão ativo · Dr. Chen
            </div>
            <h1
              id="login-title"
              className="text-3xl font-bold tracking-tight text-slate-900"
            >
              Acesso ao prontuário
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Entre com sua conta profissional para acessar a central clínica.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                Email profissional
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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

            <div className="text-center text-xs">
              <span className="text-slate-500">Não tem conta? </span>
              <Link
                href="/register"
                className="font-semibold text-sky-600 hover:text-sky-700 hover:underline"
              >
                Cadastrar
              </Link>
            </div>
          </form>

          {/* Compliance pills */}
          <div className="mt-10 space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <ShieldCheck className="h-3 w-3" /> LGPD
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                CFM 2.314/22
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                HL7 FHIR R4
              </span>
            </div>
            <p className="text-center text-[10px] text-slate-400">
              TLS 1.3 · Auditoria SHA-256 · WCAG AA
            </p>
            <p className="text-center text-[10px] text-slate-400">
              Em emergência clínica, ligue{' '}
              <strong className="text-red-600">192 (SAMU)</strong>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
