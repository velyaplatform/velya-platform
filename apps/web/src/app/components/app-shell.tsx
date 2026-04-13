'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  Menu,
  Search,
  AlertOctagon,
  Plus,
  Inbox as InboxIcon,
} from 'lucide-react';
import { FavoritesMenu } from './favorites-menu';
import { Navigation, type Role } from './navigation';
import { PatientQuickSwitcher } from './patient-quick-switcher';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ShortcutProvider } from './shortcuts/shortcut-provider';
import { ShortcutOverlay } from './shortcuts/shortcut-overlay';

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

/**
 * GitHub-inspired Velya mark — V dentro do quadrado, branco no header preto.
 */
function VelyaMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M16 2 L28 8 L28 20 C28 25 22 30 16 30 C10 30 4 25 4 20 L4 8 Z"
        fill="currentColor"
      />
      <path
        d="M10 12 L16 22 L22 12"
        stroke="#1f2328"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'var(--canvas-default)' }}
      >
        <div
          className="flex items-center gap-3"
          style={{ color: 'var(--fg-muted)', fontSize: 'var(--text-base)' }}
        >
          <div
            className="h-4 w-4 animate-spin rounded-full border-2"
            style={{
              borderColor: 'var(--border-default)',
              borderTopColor: 'var(--accent-fg)',
            }}
          />
          <span>Carregando Velya…</span>
        </div>
      </div>
    );
  }

  const currentRole = sessionData.role as Role;

  const nameParts = sessionData.userName.split(' ').filter(Boolean);
  const initials =
    nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : sessionData.userName.slice(0, 2).toUpperCase();

  return (
    <ShortcutProvider>
    <div className="app-shell">
      <ShortcutOverlay />
      {/* ============================================================
          GITHUB-STYLE DARK HEADER (top bar)
          ============================================================ */}
      <header className="gh-header">
        {/* Mobile menu trigger */}
        <button
          type="button"
          className="gh-header-icon-btn md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Logo / mark */}
        <Link
          href="/"
          className="flex items-center"
          style={{ color: 'var(--header-fg)', padding: '0 8px' }}
          aria-label="Velya home"
        >
          <VelyaMark className="h-8 w-8" />
        </Link>

        {/* Search (header style) */}
        <div className="hidden md:flex flex-1 min-w-0 items-center">
          <button
            type="button"
            className="gh-header-search"
            onClick={() => {
              const event = new KeyboardEvent('keydown', {
                key: 'k',
                ctrlKey: true,
                bubbles: true,
              });
              window.dispatchEvent(event);
            }}
            style={{ cursor: 'text', textAlign: 'left' }}
          >
            <Search className="h-4 w-4 mr-2 shrink-0" style={{ color: '#9198a1' }} />
            <span
              style={{
                color: '#9198a1',
                fontSize: 14,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Type <kbd style={{
                padding: '0 4px',
                margin: '0 4px',
                fontSize: 11,
                background: 'transparent',
                border: '1px solid #32383f',
                color: '#9198a1',
                borderRadius: 4,
              }}>/</kbd>{' '}to search
            </span>
          </button>
        </div>

        {/* Header nav (hidden on small) */}
        <nav className="hidden lg:flex items-center gap-1">
          <Link href="/patients" className="gh-header-nav-link">
            Pacientes
          </Link>
          <Link href="/tasks" className="gh-header-nav-link">
            Tarefas
          </Link>
          <Link href="/alerts" className="gh-header-nav-link">
            Alertas
          </Link>
          <Link href="/agents" className="gh-header-nav-link">
            Agentes
          </Link>
        </nav>

        <div className="flex-1 md:flex-none" />

        {/* Right side: plus, inbox, notifications, profile */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="gh-header-icon-btn"
            aria-label="Criar novo"
            title="Criar"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="gh-header-icon-btn"
            onClick={() => router.push('/inbox')}
            aria-label="Inbox"
            title="Inbox"
          >
            <InboxIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="gh-header-icon-btn relative"
            onClick={() => router.push('/alerts')}
            aria-label="Alertas críticos"
            title="5 alertas críticos"
          >
            <Bell className="h-4 w-4" />
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--danger-emphasis)',
                border: '2px solid var(--header-bg)',
              }}
              aria-hidden="true"
            />
          </button>

          <FavoritesMenu />
          <PatientQuickSwitcher />

          {/* Profile button */}
          <button
            type="button"
            onClick={() => router.push('/me')}
            className="gh-header-icon-btn"
            style={{ padding: 0, width: 32, height: 32 }}
            aria-label={`Meu painel — ${sessionData.userName}`}
            title={`${sessionData.userName} — Meu painel`}
          >
            <Avatar className="h-8 w-8" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
              <AvatarFallback
                className="text-[10px]"
                style={{ background: '#32383f', color: '#ffffff' }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </header>

      {/* ============================================================
          BODY (sidebar + content)
          ============================================================ */}
      <div className="app-main">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'rgba(31, 35, 40, 0.4)', top: 'var(--header-height)' }}
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

        <div className="app-content-wrapper flex min-h-full flex-1 flex-col">
          {/* Sub-header — repo-style com título da página + ações */}
          <div
            className="flex items-center justify-between gap-3 px-6"
            style={{
              height: 48,
              borderBottom: '1px solid var(--border-default)',
              background: 'var(--canvas-default)',
              position: 'sticky',
              top: 'var(--header-height)',
              zIndex: 30,
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <h1
                className="truncate"
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--fg-default)',
                  margin: 0,
                }}
              >
                {pageTitle}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push('/alerts')}
                className="btn btn-sm"
                style={{
                  color: 'var(--fg-default)',
                  background: 'var(--canvas-subtle)',
                  borderColor: 'var(--border-default)',
                }}
                aria-label="Ver 5 alertas criticos"
              >
                <AlertOctagon className="h-3.5 w-3.5" />
                <span style={{ fontWeight: 600 }}>5 Criticos</span>
              </button>

              <div
                className="hidden md:flex items-center gap-2"
                style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-muted)' }}
                title={sessionActive ? 'Sessao ativa' : 'Sessao inativa'}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    background: sessionActive
                      ? 'var(--success-emphasis)'
                      : 'var(--danger-emphasis)',
                  }}
                  aria-hidden="true"
                />
                <span>{sessionActive ? 'Sessao ativa' : 'Sessao inativa'}</span>
              </div>
            </div>
          </div>

          <main
            className="flex-1 overflow-y-auto"
            style={{
              padding: 'var(--space-6)',
              background: 'var(--canvas-default)',
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
    </ShortcutProvider>
  );
}
