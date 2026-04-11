'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Menu, Search, AlertOctagon } from 'lucide-react';
import { FavoritesMenu } from './favorites-menu';
import { Navigation, type Role } from './navigation';
import { PatientQuickSwitcher } from './patient-quick-switcher';
import { ROLE_DEFINITIONS, resolveUiRole } from '../../lib/access-control';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { VelyaShiftIndicator } from './velya/velya-shift-indicator';
import { cn } from '../../lib/utils';

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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-600" />
          <span className="text-sm">Carregando Velya…</span>
        </div>
      </div>
    );
  }

  const currentRole = sessionData.role as Role;
  const professionalRole = resolveUiRole(currentRole);
  const roleDef = ROLE_DEFINITIONS[professionalRole];
  const councilBadge = sessionData.conselhoProfissional || roleDef?.professionalCouncil || null;

  const nameParts = sessionData.userName.split(' ').filter(Boolean);
  const initials =
    nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : sessionData.userName.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
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

      <div className="flex min-h-screen flex-1 flex-col md:ml-[260px]">
        {/* Topbar white, padrão EHR */}
        <header className="sticky top-0 z-40 flex h-[60px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          {/* Left: hamburger + breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                Velya
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-sm font-semibold text-slate-900">{pageTitle}</span>
            </div>
          </div>

          {/* Center: busca global + shift indicator */}
          <div className="mx-4 hidden max-w-xl flex-1 items-center gap-3 md:flex">
            <button
              type="button"
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
                window.dispatchEvent(event);
              }}
              className="group flex h-10 flex-1 items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-400 transition-all hover:border-sky-400 hover:bg-white"
            >
              <Search className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-sky-600" />
              <span className="flex-1 truncate">
                Buscar pacientes, tarefas, MRN…
              </span>
              <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] text-slate-500 sm:inline-block">
                ⌘K
              </kbd>
            </button>
            <div className="hidden lg:block">
              <VelyaShiftIndicator />
            </div>
          </div>

          {/* Right: actions + user */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/alerts')}
              className="gap-2 border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:text-red-800"
              aria-label="Ver 5 alertas críticos"
            >
              <AlertOctagon className="h-3.5 w-3.5 animate-pulse" />
              <span className="font-semibold">5 Críticos</span>
            </Button>

            <button
              type="button"
              aria-label="Notificações"
              className="relative rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-sky-500" />
            </button>

            <FavoritesMenu />
            <PatientQuickSwitcher />

            <div className="hidden font-mono text-xs text-slate-500 tabular-nums lg:block">
              {currentTime}
            </div>

            <button
              type="button"
              onClick={() => router.push('/me')}
              className="ml-1 flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2 py-1 transition-all hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label={`Abrir meu painel — ${sessionData.userName}`}
              title="Meu painel — atividade, tarefas e perfil"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden flex-col leading-tight text-left md:flex">
                <span className="text-xs font-semibold text-slate-900">
                  {sessionData.userName.split(' ')[0]}{' '}
                  {sessionData.userName.split(' ').slice(-1)[0]?.[0]}.
                </span>
                <span className="text-[10px] text-slate-500">
                  {councilBadge ?? `Nível ${roleDef?.accessLevel}`}
                </span>
              </div>
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  sessionActive ? 'bg-emerald-500' : 'bg-red-500',
                )}
                title={sessionActive ? 'Sessão ativa' : 'Sem sessão'}
                aria-hidden="true"
              />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
