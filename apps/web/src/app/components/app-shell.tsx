'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation, type Role } from './navigation';
import { PatientQuickSwitcher } from './patient-quick-switcher';
import { ROLE_DEFINITIONS, resolveUiRole } from '../../lib/access-control';

interface AppShellProps {
  children: React.ReactNode;
  pageTitle: string;
}

interface SessionData {
  userName: string;
  role: string;
  professionalRole: string;
  email: string;
  setor: string;
  conselhoProfissional?: string;
}

export function AppShell({ children, pageTitle }: AppShellProps) {
  const router = useRouter();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check session on mount
  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => {
        if (!res.ok) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.authenticated) {
          setSessionData({
            userName: data.userName,
            role: data.role,
            professionalRole: data.professionalRole,
            email: data.email || '',
            setor: data.setor || '',
            conselhoProfissional: data.conselhoProfissional,
          });
          setSessionActive(true);
        } else {
          router.push('/login');
        }
        setLoading(false);
      })
      .catch(() => {
        router.push('/login');
        setLoading(false);
      });
  }, [router]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (loading || !sessionData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <span className="text-slate-500">Carregando...</span>
      </div>
    );
  }

  const currentRole = sessionData.role as Role;
  const professionalRole = resolveUiRole(currentRole);
  const roleDef = ROLE_DEFINITIONS[professionalRole];
  const councilBadge = sessionData.conselhoProfissional || roleDef?.professionalCouncil || null;

  // Compute initials from user name
  const nameParts = sessionData.userName.split(' ').filter(Boolean);
  const initials =
    nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : sessionData.userName.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[var(--color-surface)] text-[var(--text-primary)]">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Navigation
        currentRole={currentRole}
        userName={sessionData.userName}
        onLogout={handleLogout}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="app-main">
        <header className="app-topbar">
          {/* Hamburger menu for mobile */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded-md text-[var(--text-primary)] hover:bg-[var(--color-surface-subtle)]"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <span className="topbar-title">{pageTitle}</span>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              onClick={() => router.push('/alerts')}
              className="topbar-alerts focus:outline-none focus:ring-2 focus:ring-red-300"
              aria-label="Ver 5 alertas críticos"
            >
              <span aria-hidden="true">{'\uD83D\uDD34'}</span>
              <span className="text-red-200 font-bold">5 Alertas Críticos</span>
            </button>
            <PatientQuickSwitcher />
            <div className="topbar-time">{currentTime}</div>
            <button
              type="button"
              onClick={() => router.push('/me')}
              className="topbar-user bg-transparent border-none cursor-pointer min-h-[44px] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300 hover:bg-[var(--color-surface-subtle)] px-2 -mx-2"
              aria-label={`Abrir meu painel — ${sessionData.userName}`}
              title="Meu painel — atividade, tarefas e perfil"
            >
              <div className="avatar">{initials}</div>
              <div className="flex flex-col leading-tight text-left">
                <span className="text-[var(--text-primary)] font-semibold">
                  {sessionData.userName}
                </span>
                {councilBadge && (
                  <span className="text-[0.7rem] text-[var(--text-secondary)] font-medium">
                    {councilBadge} | Nível {roleDef?.accessLevel}
                  </span>
                )}
                {!councilBadge && (
                  <span className="text-[0.7rem] text-[var(--text-secondary)] font-medium">
                    Nível {roleDef?.accessLevel}
                  </span>
                )}
              </div>
              <span
                className={`w-2.5 h-2.5 rounded-full ml-1.5 shrink-0 ${
                  sessionActive ? 'bg-green-400' : 'bg-red-400'
                }`}
                title={sessionActive ? 'Sessão ativa' : 'Sem sessão'}
                aria-hidden="true"
              />
            </button>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
