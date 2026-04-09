'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation, type Role } from './navigation';
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
        })
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
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : sessionData.userName.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[var(--color-surface)]">
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
              className="md:hidden p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--color-surface-subtle)]"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="topbar-title">{pageTitle}</span>
          </div>

          <div className="topbar-right">
            <div className="topbar-alerts">
              <span>{'\uD83D\uDD34'}</span>
              <span>5 Alertas Criticos</span>
            </div>
            <div className="topbar-time">{currentTime}</div>
            <div className="topbar-user">
              <div className="avatar">{initials}</div>
              <div className="flex flex-col leading-tight">
                <span>{sessionData.userName}</span>
                {councilBadge && (
                  <span className="text-[0.65rem] text-blue-300/90 font-medium">
                    {councilBadge} | Nivel {roleDef?.accessLevel}
                  </span>
                )}
                {!councilBadge && (
                  <span className="text-[0.65rem] text-white/50 font-medium">
                    Nivel {roleDef?.accessLevel}
                  </span>
                )}
              </div>
              <span
                className={`w-2 h-2 rounded-full ml-1.5 shrink-0 ${
                  sessionActive ? 'bg-green-500' : 'bg-red-500'
                }`}
                title={sessionActive ? 'Sessao ativa' : 'Sem sessao'}
              />
              <button
                onClick={handleLogout}
                className="bg-transparent border-none text-slate-400 cursor-pointer text-xs font-inherit ml-2 px-2 py-1 rounded"
                title="Sair"
              >
                Sair
              </button>
            </div>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
