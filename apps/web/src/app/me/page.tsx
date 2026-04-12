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
        <div role="alert" className="bg-neutral-100 border border-neutral-300 text-neutral-900 rounded-md px-4 py-3">
          {error}
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell pageTitle="Meu Painel">
        <p className="text-neutral-500">Carregando...</p>
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
              className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center text-white text-xl font-bold border-2 border-neutral-300"
            >
              {initials}
            </div>
            <div>
              <h1 className="page-title">{data.profile.userName}</h1>
              <p className="page-subtitle">
                {data.profile.email} · {data.profile.setor || 'Sem setor definido'}
              </p>
              {data.profile.conselhoProfissional && (
                <p className="text-xs text-neutral-500 mt-1 font-mono">
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
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-50 border border-neutral-300/60 text-neutral-900 hover:bg-neutral-100/40 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
            >
              Refazer tour de boas-vindas
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-60"
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
          className="bg-white border border-neutral-200 rounded-xl p-5"
        >
          <h2 id="profile-heading" className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-3">
            Sessão
          </h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Função</dt>
              <dd className="text-neutral-900 text-right">{data.profile.role}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Login</dt>
              <dd className="text-neutral-900 text-right">
                {new Date(data.profile.loginTime).toLocaleString('pt-BR')}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Última atividade</dt>
              <dd className="text-neutral-900 text-right">
                {new Date(data.profile.lastActivity).toLocaleString('pt-BR')}
              </dd>
            </div>
            {data.profile.isBreakGlass && (
              <div role="alert" className="bg-neutral-100 border border-neutral-300 text-neutral-700 rounded-md px-3 py-2 mt-2">
                Sessão em modo break-glass
              </div>
            )}
          </dl>
        </section>

        {/* On-duty */}
        <section
          aria-labelledby="duty-heading"
          className="bg-white border border-neutral-200 rounded-xl p-5"
        >
          <h2 id="duty-heading" className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-3">
            Plantão
          </h2>
          {data.onDuty ? (
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">Setor</dt>
                <dd className="text-neutral-900 text-right">{data.onDuty.ward}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">Turno</dt>
                <dd className="text-neutral-900 text-right">
                  {data.onDuty.shift} · {data.onDuty.shiftStart}–{data.onDuty.shiftEnd}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">Presença</dt>
                <dd className="text-neutral-900 text-right">{data.onDuty.presence}</dd>
              </div>
              {data.onDuty.contactExtension && (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Ramal</dt>
                  <dd className="text-neutral-900 text-right font-mono">
                    {data.onDuty.contactExtension}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">Pacientes atribuídos</dt>
                <dd className="text-neutral-900 text-right">
                  {data.onDuty.assignedPatientMrns.length}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-neutral-500">Você não está no quadro de plantão atual.</p>
          )}
        </section>

        {/* AI policy */}
        <section
          aria-labelledby="ai-heading"
          className="bg-white border border-neutral-200 rounded-xl p-5"
        >
          <h2 id="ai-heading" className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-3">
            Política de IA
          </h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Perfil</dt>
              <dd className="text-neutral-700 text-right font-semibold">{data.aiPolicy.label}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Capacidades</dt>
              <dd className="text-neutral-900 text-right">{data.aiPolicy.capabilityCount}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Limite/hora</dt>
              <dd className="text-neutral-900 text-right">{data.aiPolicy.maxRequestsPerHour}</dd>
            </div>
          </dl>
          <p className="text-xs text-neutral-500 mt-3">
            Use <kbd className="bg-neutral-50 border border-neutral-300 px-1.5 py-0.5 rounded text-neutral-900">Ctrl+J</kbd> para abrir o assistente.
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
          className="bg-white border border-neutral-200 rounded-xl p-5 mb-4"
        >
          <h2 id="charges-heading" className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-3">
            Lançamentos recentes
          </h2>
          <ul className="space-y-2">
            {data.charges.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-neutral-50 rounded-md border border-neutral-200"
              >
                <span className="text-sm text-neutral-900 truncate">{c.description}</span>
                <span className="text-xs text-neutral-500 whitespace-nowrap">
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
          className="bg-white border border-neutral-200 rounded-xl p-5"
        >
          <h2 id="consents-heading" className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-3">
            Consentimentos recentes
          </h2>
          <ul className="space-y-2">
            {data.consents.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-neutral-50 rounded-md border border-neutral-200"
              >
                <Link
                  href={`/patients/${c.patientMrn}`}
                  className="text-sm text-neutral-700 hover:text-neutral-900 underline font-mono"
                >
                  {c.patientMrn}
                </Link>
                <span className="text-xs text-neutral-500">{c.type}</span>
                <span className="text-xs text-neutral-500">{c.signedAt}</span>
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
      ? 'border-neutral-300/60'
      : accent === 'amber'
        ? 'border-neutral-300'
        : 'border-neutral-300';
  const accentDot =
    accent === 'blue' ? 'bg-neutral-700' : accent === 'amber' ? 'bg-neutral-500' : 'bg-neutral-300';
  return (
    <section
      aria-label={title}
      className={`bg-white border ${accentRing} rounded-xl p-4`}
    >
      <header className="flex items-center gap-2 mb-3">
        <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full ${accentDot}`} />
        <h2 className="text-sm font-bold text-neutral-900">{title}</h2>
        <span className="text-xs text-neutral-500 ml-auto">{items.length}</span>
      </header>
      <p className="text-[11px] text-neutral-500 mb-3">{subtitle}</p>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-6">Nada por aqui.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/patients/${item.mrn}`}
                className="block px-3 py-2 bg-neutral-50 rounded-md border border-neutral-200 hover:bg-neutral-100 hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-200 transition-colors"
              >
                <div className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">
                  {item.type}
                </div>
                <div className="text-sm text-neutral-900 font-medium mt-0.5">
                  {item.description}
                </div>
                <div className="text-xs text-neutral-500 mt-1 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-neutral-700">{item.mrn}</span>
                  <span>·</span>
                  <span>{item.patient}</span>
                  {item.dueIn && (
                    <>
                      <span>·</span>
                      <span className="text-neutral-700">{item.dueIn}</span>
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
