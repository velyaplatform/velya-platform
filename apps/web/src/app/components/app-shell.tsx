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
      <div className="flex min-h-screen items-center justify-center bg-[#0a0e17]">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-400/40 border-t-teal-300" />
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
    <div className="flex min-h-screen bg-[#0a0e17] text-slate-100">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
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

      <div className="flex min-h-screen flex-1 flex-col md:ml-64">
        {/* Top bar glass */}
        <header className="sticky top-0 z-40 flex h-[60px] items-center justify-between gap-3 border-b border-white/[0.08] bg-[rgba(10,14,23,0.72)] px-6 backdrop-blur-xl backdrop-saturate-150">
          {/* Left: hamburger + page title */}
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-slate-100 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Velya
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-sm font-semibold text-slate-100">{pageTitle}</span>
            </div>
          </div>

          {/* Center: global search + shift indicator */}
          <div className="mx-4 hidden max-w-xl flex-1 items-center gap-3 md:flex">
            <button
              type="button"
              onClick={() => {
                // Dispatch Ctrl+K to open the existing command palette
                const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
                window.dispatchEvent(event);
              }}
              className="group flex h-9 flex-1 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-left text-sm text-slate-500 transition-all hover:border-teal-400/30 hover:bg-white/[0.05]"
            >
              <Search className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-teal-300" />
              <span className="flex-1 truncate">
                Buscar pacientes, tarefas, MRN…
              </span>
              <kbd className="hidden rounded border border-white/10 bg-white/[0.04] px-1.5 font-mono text-[10px] text-slate-400 sm:inline-block">
                ⌘K
              </kbd>
            </button>
            {/* Shift indicator — operação 24/7 */}
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
              className="gap-2 border-red-500/30 bg-red-500/10 text-red-300 hover:border-red-400/50 hover:bg-red-500/15 hover:text-red-200"
              aria-label="Ver 5 alertas críticos"
            >
              <AlertOctagon className="h-3.5 w-3.5 animate-pulse" />
              <span className="font-semibold">5 Críticos</span>
            </Button>

            <button
              type="button"
              aria-label="Notificações"
              className="relative rounded-md p-2 text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.7)]" />
            </button>

            <FavoritesMenu />
            <PatientQuickSwitcher />

            <div className="hidden font-mono text-xs text-slate-400 tabular-nums lg:block">
              {currentTime}
            </div>

            <button
              type="button"
              onClick={() => router.push('/me')}
              className="ml-1 flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1 transition-all hover:border-teal-400/30 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              aria-label={`Abrir meu painel — ${sessionData.userName}`}
              title="Meu painel — atividade, tarefas e perfil"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden flex-col leading-tight text-left md:flex">
                <span className="text-xs font-semibold text-slate-100">
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
                  sessionActive
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                    : 'bg-red-400',
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
