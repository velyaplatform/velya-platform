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

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (loading || !sessionData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-neutral-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
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
    <div className="flex min-h-screen bg-white text-neutral-900">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-neutral-900/40 md:hidden"
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
        {/* Topbar: branco limpo, só título da página (sem "Velya /" duplicado) */}
        <header className="sticky top-0 z-40 flex h-[60px] items-center justify-between gap-3 border-b border-neutral-200 bg-white px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-[15px] font-semibold text-neutral-900">{pageTitle}</h1>
          </div>

          {/* Center: busca global única */}
          <div className="mx-4 hidden max-w-xl flex-1 md:block">
            <button
              type="button"
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
                window.dispatchEvent(event);
              }}
              className="group flex h-10 w-full items-center gap-2.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-left text-sm text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-white"
            >
              <Search className="h-4 w-4 shrink-0 text-neutral-600 group-hover:text-neutral-600" />
              <span className="flex-1 truncate">Buscar pacientes, tarefas, MRN…</span>
              <kbd className="hidden rounded border border-neutral-200 bg-white px-1.5 font-mono text-[10px] text-neutral-500 sm:inline-block">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right: alertas + bell + user */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/alerts')}
              className="gap-2 border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100"
              aria-label="Ver 5 alertas críticos"
            >
              <AlertOctagon className="h-3.5 w-3.5" />
              <span className="font-semibold">5 Críticos</span>
            </Button>

            <button
              type="button"
              aria-label="Notificações"
              className="relative rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <Bell className="h-4 w-4" />
            </button>

            <FavoritesMenu />
            <PatientQuickSwitcher />

            <button
              type="button"
              onClick={() => router.push('/me')}
              className="ml-1 flex items-center gap-2.5 rounded-md border border-neutral-200 bg-white px-2 py-1 transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`Abrir meu painel — ${sessionData.userName}`}
              title="Meu painel"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden flex-col leading-tight text-left md:flex">
                <span className="text-xs font-semibold text-neutral-900">
                  {sessionData.userName}
                </span>
                {councilBadge && (
                  <span className="text-[10px] text-neutral-500">{councilBadge}</span>
                )}
              </div>
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  sessionActive ? 'bg-green-600' : 'bg-red-600',
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
