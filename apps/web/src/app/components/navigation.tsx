'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ListChecks,
  Plus,
  Stethoscope,
  Building2,
  Users,
  LineChart,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';
import {
  NAV_SECTIONS,
  resolveUiRole,
  getNavigationSections,
} from '../../lib/access-control';
import { cn } from '../../lib/utils';

const ROLES = [
  'Coordenador de Ala',
  'Medico',
  'Enfermeiro(a)',
  'Tecnico de Enfermagem',
  'Planejador de Alta',
  'Farmaceutico',
  'Fisioterapeuta',
  'Recepcao',
  'Motorista',
  'Higienizacao',
  'Faturamento',
  'Diretor Clinico',
  'Administrador',
] as const;
type Role = (typeof ROLES)[number];

interface NavItemDef {
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
  section: string;
  requiredAction?: string;
}

const NAV_ITEMS: NavItemDef[] = [
  // --- Assistencial ---
  { href: '/', icon: LayoutDashboard, label: 'Visao Geral', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/patients', icon: Users, label: 'Pacientes', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/tasks', icon: ListChecks, label: 'Tarefas', section: NAV_SECTIONS.ASSISTENCIAL },

  // --- Gestao ---
  { href: '/unidades', icon: Building2, label: 'Unidades', section: NAV_SECTIONS.GESTAO },
  { href: '/specialties', icon: Stethoscope, label: 'Especialidades', section: NAV_SECTIONS.GESTAO },
];

const SECTION_LABELS: Record<string, string> = {
  [NAV_SECTIONS.ASSISTENCIAL]: 'Assistencial',
  [NAV_SECTIONS.GESTAO]: 'Gestão',
  [NAV_SECTIONS.ADMINISTRACAO]: 'Administração',
  [NAV_SECTIONS.OBSERVABILIDADE]: 'Observabilidade',
};

interface NavigationProps {
  currentRole: Role;
  userName: string;
  onLogout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_DEFAULT_WIDTH = 260;
const SIDEBAR_WIDTH_STORAGE_KEY = 'velya:sidebar-width';

export function Navigation({
  currentRole,
  userName,
  onLogout: _onLogout,
  mobileOpen,
  onMobileClose,
}: NavigationProps) {
  const pathname = usePathname();
  // sidebarWidth is the React-visible width used at idle, on mount, and
  // for aria-valuenow. During an active drag we bypass it entirely and
  // write only to refs + the DOM (asideRef.style.width and the CSS var)
  // so the entire Navigation tree (40+ nav items + the recommendation
  // textarea) does not re-render at 120 Hz.
  const [sidebarWidth, setSidebarWidth] = useState<number>(SIDEBAR_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionSubmitting, setSuggestionSubmitting] = useState(false);
  const [suggestionFeedback, setSuggestionFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const widthRef = useRef<number>(SIDEBAR_DEFAULT_WIDTH);
  const asideRef = useRef<HTMLElement | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartWidthRef = useRef<number>(SIDEBAR_DEFAULT_WIDTH);
  const suggestionMinLength = 12;
  const suggestionMaxLength = 500;

  // Hydrate persisted width on mount and sync --sidebar-width CSS var.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
      if (!raw) return;
      const parsed = parseInt(raw, 10);
      if (
        Number.isNaN(parsed) ||
        parsed < SIDEBAR_MIN_WIDTH ||
        parsed > SIDEBAR_MAX_WIDTH ||
        parsed === SIDEBAR_DEFAULT_WIDTH
      ) {
        return;
      }
      widthRef.current = parsed;
      setSidebarWidth(parsed);
      document.documentElement.style.setProperty('--sidebar-width', `${parsed}px`);
    } catch {
      // localStorage disabled — keep default
    }
  }, []);

  // applyWidth has two modes:
  //   { commit: false } (default) → DOM-only write during drag, no React state.
  //   { commit: true }             → also setSidebarWidth + persist to localStorage.
  const applyWidth = useCallback((next: number, commit = false) => {
    const clamped = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, next));
    if (clamped === widthRef.current && !commit) return clamped;
    widthRef.current = clamped;
    document.documentElement.style.setProperty('--sidebar-width', `${clamped}px`);
    if (asideRef.current) asideRef.current.style.width = `${clamped}px`;
    if (commit) {
      setSidebarWidth(clamped);
      try {
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clamped));
      } catch {
        /* localStorage disabled — DOM still updated */
      }
    }
    return clamped;
  }, []);

  const handleResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStartXRef.current = event.clientX;
    dragStartWidthRef.current = widthRef.current;
    setIsResizing(true);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }, []);

  const handleResizeMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isResizing) return;
      const delta = event.clientX - dragStartXRef.current;
      applyWidth(dragStartWidthRef.current + delta);
    },
    [isResizing, applyWidth],
  );

  const handleResizeEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isResizing) return;
      setIsResizing(false);
      try {
        (event.target as HTMLElement).releasePointerCapture(event.pointerId);
      } catch {
        /* stale pointer id */
      }
      // Single React commit at drag end persists the live width.
      applyWidth(widthRef.current, true);
    },
    [isResizing, applyWidth],
  );

  const handleResizeKey = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const STEP = event.shiftKey ? 24 : 8;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        applyWidth(widthRef.current - STEP, true);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        applyWidth(widthRef.current + STEP, true);
      } else if (event.key === 'Home') {
        event.preventDefault();
        applyWidth(SIDEBAR_DEFAULT_WIDTH, true);
      }
    },
    [sidebarWidth, applyWidth],
  );

  const professionalRole = resolveUiRole(currentRole);
  const allowedSections = getNavigationSections(professionalRole);

  const visibleNavItems = NAV_ITEMS.filter((item) => allowedSections.includes(item.section));

  const groupedItems: Record<string, NavItemDef[]> = {};
  for (const item of visibleNavItems) {
    if (!groupedItems[item.section]) {
      groupedItems[item.section] = [];
    }
    groupedItems[item.section].push(item);
  }

  const sectionOrder = [NAV_SECTIONS.ASSISTENCIAL, NAV_SECTIONS.GESTAO, NAV_SECTIONS.ADMINISTRACAO];
  const showObservability = allowedSections.includes(NAV_SECTIONS.OBSERVABILIDADE);

  function handleNavClick() {
    onMobileClose?.();
  }

  async function handleSuggestionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = suggestionText.trim();
    if (text.length < suggestionMinLength) {
      setSuggestionFeedback({
        tone: 'error',
        message: `Descreva a sugestão com pelo menos ${suggestionMinLength} caracteres.`,
      });
      return;
    }

    setSuggestionSubmitting(true);
    setSuggestionFeedback(null);

    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, author: userName }),
      });
      const data = (await response.json()) as {
        error?: string;
        suggestion?: { status?: string };
      };

      if (!response.ok) {
        setSuggestionFeedback({
          tone: 'error',
          message: data.error || 'Não foi possível registrar a sugestão agora.',
        });
        return;
      }

      setSuggestionText('');
      setSuggestionFeedback({
        tone: 'success',
        message:
          data.suggestion?.status === 'reviewing'
            ? 'Sugestão registrada e colocada em análise automática.'
            : 'Sugestão registrada com sucesso.',
      });
    } catch {
      setSuggestionFeedback({
        tone: 'error',
        message: 'Falha de rede ao enviar a sugestão.',
      });
    } finally {
      setSuggestionSubmitting(false);
    }
  }

  return (
    <aside
      ref={asideRef}
      className={cn(
        // Mobile (<md): fixed overlay, off-screen by default, slides in.
        // Desktop (md+): sticky in-flow — takes flex space inside .app-main
        // so the content wrapper is naturally pushed right. No margin-left
        // hack needed. This mirrors how github.com lays out its sidebar.
        'flex flex-col overflow-y-auto shrink-0',
        'border-r bg-white text-neutral-800',
        // Mobile: fixed overlay
        'fixed left-0 bottom-0 z-40',
        !isResizing && 'transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: sticky in-flow (overrides fixed)
        'md:sticky md:top-[var(--header-height)] md:bottom-auto md:left-auto md:z-auto md:translate-x-0',
      )}
      style={{
        top: 'var(--header-height)',
        width: `${sidebarWidth}px`,
        height: 'calc(100vh - var(--header-height))',
        borderColor: 'var(--border-default)',
        background: 'var(--canvas-default)',
        color: 'var(--fg-default)',
      }}
    >
      {/* Resize handle — 4px wide column flush with the right border.
          Drag to resize, keyboard left/right to nudge, Home to reset. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar sidebar (arraste ou use setas esquerda/direita; Home para resetar)"
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        aria-valuenow={sidebarWidth}
        tabIndex={0}
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        onKeyDown={handleResizeKey}
        className="hidden md:block"
        style={{
          position: 'absolute',
          top: 0,
          right: -2,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          zIndex: 50,
          background: isResizing ? 'var(--accent-fg)' : 'transparent',
          transition: isResizing ? 'none' : 'background 120ms ease',
        }}
      />

      {/* Close button for mobile */}
      <button
        className="absolute top-3 right-3 rounded-md p-1 text-neutral-500 hover:text-neutral-900 md:hidden"
        onClick={onMobileClose}
        aria-label="Fechar menu"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Nav sections */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {sectionOrder.map((section, sectionIdx) => {
          const items = groupedItems[section];
          if (!items || items.length === 0) return null;
          return (
            <div key={section} className={sectionIdx > 0 ? 'mt-3' : ''}>
              <div className="gh-sidenav-section-title">
                {SECTION_LABELS[section]}
              </div>
              <div className="gh-sidenav">
                {items.map((item) => {
                  const isPatientsItem = item.href === '/patients';
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href) ||
                        (isPatientsItem && pathname.startsWith('/pacientes'));
                  const Icon = item.icon;
                  return (
                    <div key={item.href} className="space-y-1">
                      <Link
                        href={item.href}
                        onClick={handleNavClick}
                        className={cn('gh-sidenav-item', isActive && 'is-active')}
                      >
                        <Icon
                          className="h-[16px] w-[16px] shrink-0"
                          style={{
                            color: isActive ? 'var(--accent-fg)' : 'var(--fg-muted)',
                          }}
                          strokeWidth={2}
                        />
                        <span className="truncate">{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span
                            className="ml-auto gh-label"
                            style={{
                              background:
                                item.badge >= 5 && item.label.includes('Alerta')
                                  ? 'var(--danger-subtle)'
                                  : 'var(--canvas-subtle)',
                              color:
                                item.badge >= 5 && item.label.includes('Alerta')
                                  ? 'var(--danger-fg)'
                                  : 'var(--fg-muted)',
                              borderColor: 'var(--border-default)',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>

                      {isPatientsItem && (
                        <Link
                          href="/patients/new"
                          onClick={handleNavClick}
                          className={cn(
                            'gh-sidenav-item ml-6 min-h-[28px] py-1.5 text-sm',
                            pathname === '/patients/new' && 'is-active',
                          )}
                        >
                          <Plus
                            className="h-[14px] w-[14px] shrink-0"
                            style={{
                              color:
                                pathname === '/patients/new'
                                  ? 'var(--accent-fg)'
                                  : 'var(--fg-muted)',
                            }}
                            strokeWidth={2}
                          />
                          <span className="truncate">Novo Paciente</span>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {showObservability && (
          <div className="mt-3">
            <div className="gh-sidenav-section-title">Observabilidade</div>
            <div className="gh-sidenav">
              <Link
                href="/observability/metrics"
                onClick={handleNavClick}
                className="gh-sidenav-item"
              >
                <LineChart
                  className="h-[16px] w-[16px]"
                  style={{ color: 'var(--fg-muted)' }}
                  strokeWidth={2}
                />
                <span>Métricas</span>
              </Link>
              <Link
                href="/observability/deploys"
                onClick={handleNavClick}
                className="gh-sidenav-item"
              >
                <GitBranch
                  className="h-[16px] w-[16px]"
                  style={{ color: 'var(--fg-muted)' }}
                  strokeWidth={2}
                />
                <span>Implantações</span>
              </Link>
            </div>
          </div>
        )}

        <section
          id="sidebar-suggestion"
          className="mt-auto rounded-xl border p-3"
          style={{
            borderColor: 'var(--border-default)',
            background: 'var(--canvas-subtle)',
          }}
          aria-label="Enviar sugestão de melhoria"
        >
          <div className="mb-2">
            <div
              className="text-sm font-semibold"
              style={{ color: 'var(--fg-default)' }}
            >
              Recomendar melhoria
            </div>
            <p
              className="mt-1 text-xs leading-5"
              style={{ color: 'var(--fg-muted)' }}
            >
              Sua ideia fica registrada e entra automaticamente em análise shadow.
            </p>
          </div>

          <form onSubmit={handleSuggestionSubmit} className="flex flex-col gap-2">
            <label htmlFor="sidebar-suggestion-text" className="sr-only">
              Descreva a sugestão
            </label>
            <textarea
              id="sidebar-suggestion-text"
              value={suggestionText}
              onChange={(event) => {
                setSuggestionText(event.target.value.slice(0, suggestionMaxLength));
                if (suggestionFeedback) {
                  setSuggestionFeedback(null);
                }
              }}
              rows={4}
              maxLength={suggestionMaxLength}
              placeholder="Ex.: adicionar atalho para alta, melhorar filtros, revisar fluxo de alertas..."
              className="w-full resize-y rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: 'var(--border-default)',
                background: 'var(--canvas-default)',
                color: 'var(--fg-default)',
              }}
            />

            <div className="flex items-center justify-between gap-2">
              <span
                className="text-[11px]"
                style={{ color: 'var(--fg-muted)' }}
              >
                {suggestionText.trim().length}/{suggestionMaxLength}
              </span>

              <button
                type="submit"
                disabled={suggestionSubmitting || suggestionText.trim().length < suggestionMinLength}
                className="btn btn-sm"
                style={{
                  opacity:
                    suggestionSubmitting || suggestionText.trim().length < suggestionMinLength
                      ? 0.6
                      : 1,
                  cursor:
                    suggestionSubmitting || suggestionText.trim().length < suggestionMinLength
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {suggestionSubmitting ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </form>

          {suggestionFeedback && (
            <p
              className="mt-2 rounded-md border px-3 py-2 text-xs leading-5"
              style={{
                borderColor:
                  suggestionFeedback.tone === 'success'
                    ? 'var(--success-border, var(--border-default))'
                    : 'var(--danger-border, var(--border-default))',
                background:
                  suggestionFeedback.tone === 'success'
                    ? 'var(--success-subtle, var(--canvas-default))'
                    : 'var(--danger-subtle, var(--canvas-default))',
                color:
                  suggestionFeedback.tone === 'success'
                    ? 'var(--success-fg, var(--fg-default))'
                    : 'var(--danger-fg, var(--fg-default))',
              }}
              role={suggestionFeedback.tone === 'error' ? 'alert' : 'status'}
            >
              {suggestionFeedback.message}
            </p>
          )}

          <Link
            href="/suggestions"
            onClick={handleNavClick}
            className="mt-3 inline-flex text-xs font-medium"
            style={{ color: 'var(--accent-fg)' }}
          >
            Abrir painel de sugestões
          </Link>
        </section>
      </nav>

      {/* Spacer to push content up */}
      <div className="flex-1" />
    </aside>
  );
}

export type { Role };
export { ROLES };
