'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';

interface ActivityItem {
  id: string;
  description: string;
  priority?: string;
  patient: string;
  mrn: string;
  dueIn?: string;
  type: string;
}

interface MeResponse {
  authenticated: boolean;
  profile: {
    userId: string;
    userName: string;
    email: string;
    role: string;
    professionalRole: string;
    setor: string;
    conselhoProfissional?: string;
    loginTime: string;
    lastActivity: string;
    isBreakGlass: boolean;
  };
  onDuty: {
    ward: string;
    shift: string;
    shiftStart: string;
    shiftEnd: string;
    presence: string;
    assignedPatientMrns: string[];
    contactExtension?: string;
  } | null;
  aiPolicy: {
    label: string;
    capabilityCount: number;
    maxRequestsPerHour: number;
  };
  activity: {
    current: ActivityItem[];
    pending: ActivityItem[];
    completed: ActivityItem[];
  };
  charges: { id: string; description: string; totalPrice: number; status: string }[];
  consents: { id: string; patientMrn: string; type: string; signedAt: string }[];
}

export default function MePage() {
  const router = useRouter();
  const [data, setData] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch('/api/me/activity', { credentials: 'same-origin' })
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        if (!res.ok) {
          setError('Não foi possível carregar seu painel.');
          return;
        }
        setData((await res.json()) as MeResponse);
      })
      .catch(() => setError('Erro de rede ao carregar painel.'));
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (error) {
    return (
      <AppShell pageTitle="Meu Painel">
        <div role="alert" className="bg-red-950/40 border border-red-700 text-red-200 rounded-md px-4 py-3">
          {error}
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell pageTitle="Meu Painel">
        <p className="text-slate-300">Carregando...</p>
      </AppShell>
    );
  }

  const initials = data.profile.userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <AppShell pageTitle={`Meu Painel — ${data.profile.userName}`}>
      <div className="page-header">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="w-16 h-16 rounded-full bg-blue-700 flex items-center justify-center text-white text-xl font-bold border-2 border-blue-400"
            >
              {initials}
            </div>
            <div>
              <h1 className="page-title">{data.profile.userName}</h1>
              <p className="page-subtitle">
                {data.profile.email} · {data.profile.setor || 'Sem setor definido'}
              </p>
              {data.profile.conselhoProfissional && (
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  {data.profile.conselhoProfissional}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  try {
                    window.localStorage.removeItem('velya:onboarding-completed-v1');
                  } catch {
                    // ignore (private mode / storage disabled)
                  }
                  window.dispatchEvent(new CustomEvent('velya:start-onboarding'));
                }
              }}
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-slate-800 border border-blue-700/60 text-blue-200 hover:bg-blue-900/40 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Refazer tour de boas-vindas
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-slate-800 border border-red-700/60 text-red-200 hover:bg-red-900/40 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-60"
            >
              {loggingOut ? 'Saindo...' : 'Sair da plataforma'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Profile + session */}
        <section
          aria-labelledby="profile-heading"
          className="bg-slate-900 border border-slate-700 rounded-xl p-5"
        >
          <h2 id="profile-heading" className="text-xs uppercase tracking-wider font-semibold text-slate-300 mb-3">
            Sessão
          </h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Função</dt>
              <dd className="text-slate-100 text-right">{data.profile.role}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Login</dt>
              <dd className="text-slate-100 text-right">
                {new Date(data.profile.loginTime).toLocaleString('pt-BR')}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Última atividade</dt>
              <dd className="text-slate-100 text-right">
                {new Date(data.profile.lastActivity).toLocaleString('pt-BR')}
              </dd>
            </div>
            {data.profile.isBreakGlass && (
              <div role="alert" className="bg-amber-950/40 border border-amber-700 text-amber-200 rounded-md px-3 py-2 mt-2">
                ⚠ Sessão em modo break-glass
              </div>
            )}
          </dl>
        </section>

        {/* On-duty */}
        <section
          aria-labelledby="duty-heading"
          className="bg-slate-900 border border-slate-700 rounded-xl p-5"
        >
          <h2 id="duty-heading" className="text-xs uppercase tracking-wider font-semibold text-slate-300 mb-3">
            Plantão
          </h2>
          {data.onDuty ? (
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Setor</dt>
                <dd className="text-slate-100 text-right">{data.onDuty.ward}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Turno</dt>
                <dd className="text-slate-100 text-right">
                  {data.onDuty.shift} · {data.onDuty.shiftStart}–{data.onDuty.shiftEnd}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Presença</dt>
                <dd className="text-slate-100 text-right">{data.onDuty.presence}</dd>
              </div>
              {data.onDuty.contactExtension && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Ramal</dt>
                  <dd className="text-slate-100 text-right font-mono">
                    {data.onDuty.contactExtension}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Pacientes atribuídos</dt>
                <dd className="text-slate-100 text-right">
                  {data.onDuty.assignedPatientMrns.length}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Você não está no quadro de plantão atual.</p>
          )}
        </section>

        {/* AI policy */}
        <section
          aria-labelledby="ai-heading"
          className="bg-slate-900 border border-slate-700 rounded-xl p-5"
        >
          <h2 id="ai-heading" className="text-xs uppercase tracking-wider font-semibold text-slate-300 mb-3">
            Política de IA
          </h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Perfil</dt>
              <dd className="text-blue-300 text-right font-semibold">{data.aiPolicy.label}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Capacidades</dt>
              <dd className="text-slate-100 text-right">{data.aiPolicy.capabilityCount}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Limite/hora</dt>
              <dd className="text-slate-100 text-right">{data.aiPolicy.maxRequestsPerHour}</dd>
            </div>
          </dl>
          <p className="text-xs text-slate-400 mt-3">
            Use <kbd className="bg-slate-800 border border-slate-600 px-1.5 py-0.5 rounded text-slate-100">Ctrl+J</kbd> para abrir o assistente.
          </p>
        </section>
      </div>

      {/* Activity columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <ActivityColumn
          title="Trabalhando agora"
          subtitle="Tarefas em andamento"
          items={data.activity.current}
          accent="blue"
        />
        <ActivityColumn
          title="Para fazer"
          subtitle="Tarefas pendentes"
          items={data.activity.pending}
          accent="amber"
        />
        <ActivityColumn
          title="Já feito"
          subtitle="Concluídas / adiadas"
          items={data.activity.completed}
          accent="green"
        />
      </div>

      {/* Optional: charges (billing roles) and consents (clinical) */}
      {data.charges.length > 0 && (
        <section
          aria-labelledby="charges-heading"
          className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-4"
        >
          <h2 id="charges-heading" className="text-xs uppercase tracking-wider font-semibold text-slate-300 mb-3">
            Lançamentos recentes
          </h2>
          <ul className="space-y-2">
            {data.charges.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-800 rounded-md border border-slate-700"
              >
                <span className="text-sm text-slate-100 truncate">{c.description}</span>
                <span className="text-xs text-slate-300 whitespace-nowrap">
                  R$ {c.totalPrice.toFixed(2)} · {c.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.consents.length > 0 && (
        <section
          aria-labelledby="consents-heading"
          className="bg-slate-900 border border-slate-700 rounded-xl p-5"
        >
          <h2 id="consents-heading" className="text-xs uppercase tracking-wider font-semibold text-slate-300 mb-3">
            Consentimentos recentes
          </h2>
          <ul className="space-y-2">
            {data.consents.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-800 rounded-md border border-slate-700"
              >
                <Link
                  href={`/patients/${c.patientMrn}`}
                  className="text-sm text-blue-300 hover:text-blue-200 underline font-mono"
                >
                  {c.patientMrn}
                </Link>
                <span className="text-xs text-slate-300">{c.type}</span>
                <span className="text-xs text-slate-400">{c.signedAt}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}

function ActivityColumn({
  title,
  subtitle,
  items,
  accent,
}: {
  title: string;
  subtitle: string;
  items: ActivityItem[];
  accent: 'blue' | 'amber' | 'green';
}) {
  const accentRing =
    accent === 'blue'
      ? 'border-blue-700/60'
      : accent === 'amber'
        ? 'border-amber-700/60'
        : 'border-green-700/60';
  const accentDot =
    accent === 'blue' ? 'bg-blue-400' : accent === 'amber' ? 'bg-amber-400' : 'bg-green-400';
  return (
    <section
      aria-label={title}
      className={`bg-slate-900 border ${accentRing} rounded-xl p-4`}
    >
      <header className="flex items-center gap-2 mb-3">
        <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full ${accentDot}`} />
        <h2 className="text-sm font-bold text-slate-100">{title}</h2>
        <span className="text-xs text-slate-400 ml-auto">{items.length}</span>
      </header>
      <p className="text-[11px] text-slate-400 mb-3">{subtitle}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">Nada por aqui.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/patients/${item.mrn}`}
                className="block px-3 py-2 bg-slate-800 rounded-md border border-slate-700 hover:bg-slate-700 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors"
              >
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  {item.type}
                </div>
                <div className="text-sm text-slate-100 font-medium mt-0.5">
                  {item.description}
                </div>
                <div className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-blue-300">{item.mrn}</span>
                  <span>·</span>
                  <span>{item.patient}</span>
                  {item.dueIn && (
                    <>
                      <span>·</span>
                      <span className="text-amber-200">{item.dueIn}</span>
                    </>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
