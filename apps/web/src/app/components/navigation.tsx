'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ListChecks,
  HeartPulse,
  Stethoscope,
  Building2,
  Pill,
  FlaskConical,
  BarChart3,
  Plus,
  ScanLine,
  FileImage,
  UserCheck,
  ArrowLeftRight,
  RefreshCw,
  Inbox,
  Search,
  Bell,
  Package,
  Sparkles,
  ArrowRightLeft,
  UtensilsCrossed,
  Boxes,
  FileText,
  Wrench,
  Trash2,
  Contact,
  Store,
  DollarSign,
  FileSpreadsheet,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  IdCard,
  FileSignature,
  Settings,
  ClipboardList,
  Lock,
  Clock,
  Bot,
  Lightbulb,
  DoorOpen,
  BedDouble,
  Scissors,
  Ambulance,
  Activity,
  Syringe,
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
  { href: '/', icon: LayoutDashboard, label: 'Centro de Comando', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/patients', icon: Users, label: 'Pacientes', badge: 47, section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/tasks', icon: ListChecks, label: 'Caixa de Tarefas', badge: 12, section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/tasks/new', icon: Plus, label: 'Nova Tarefa', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/tasks/dashboard', icon: BarChart3, label: 'Painel de Tarefas', section: NAV_SECTIONS.GESTAO },
  { href: '/tools/sepsis', icon: HeartPulse, label: 'NEWS2 / Sepse', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/prescriptions', icon: Pill, label: 'Prescrições', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/lab/orders', icon: FlaskConical, label: 'Ordens de Lab', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/lab/results', icon: BarChart3, label: 'Resultados Lab', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/imaging/orders', icon: ScanLine, label: 'Ordens de Imagem', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/imaging/results', icon: FileImage, label: 'Laudos de Imagem', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/delegations', icon: ArrowLeftRight, label: 'Delegações', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/handoffs', icon: RefreshCw, label: 'Passagem de Plantão', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/inbox', icon: Inbox, label: 'Caixa de Entrada', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/search', icon: Search, label: 'Busca Global', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/alerts', icon: Bell, label: 'Alertas', badge: 5, section: NAV_SECTIONS.ASSISTENCIAL },

  // --- Gestão ---
  { href: '/discharge', icon: DoorOpen, label: 'Torre de Altas', badge: 5, section: NAV_SECTIONS.GESTAO },
  { href: '/beds', icon: BedDouble, label: 'Leitos', section: NAV_SECTIONS.GESTAO },
  { href: '/surgery', icon: Scissors, label: 'Centro Cirúrgico', section: NAV_SECTIONS.GESTAO },
  { href: '/ems', icon: Ambulance, label: 'Ambulâncias', section: NAV_SECTIONS.GESTAO },
  { href: '/icu', icon: Activity, label: 'UTI SmartICU', section: NAV_SECTIONS.GESTAO },
  { href: '/pharmacy', icon: Syringe, label: 'Farmácia', section: NAV_SECTIONS.GESTAO },
  { href: '/specialties', icon: Stethoscope, label: 'Especialidades', section: NAV_SECTIONS.GESTAO },
  { href: '/unidades', icon: Building2, label: 'Unidades', section: NAV_SECTIONS.GESTAO },
  { href: '/wards', icon: Building2, label: 'Alas e Setores', section: NAV_SECTIONS.GESTAO },
  { href: '/staff-on-duty', icon: UserCheck, label: 'Equipe em Plantão', section: NAV_SECTIONS.GESTAO },
  { href: '/pharmacy/stock', icon: Package, label: 'Estoque Farmácia', section: NAV_SECTIONS.GESTAO },
  { href: '/cleaning/tasks', icon: Sparkles, label: 'Higienização', section: NAV_SECTIONS.GESTAO },
  { href: '/transport/orders', icon: ArrowRightLeft, label: 'Transporte Interno', section: NAV_SECTIONS.GESTAO },
  { href: '/meals/orders', icon: UtensilsCrossed, label: 'Nutrição', section: NAV_SECTIONS.GESTAO },

  // --- Administração ---
  { href: '/supply/items', icon: Boxes, label: 'Catálogo de Itens', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/supply/purchase-orders', icon: FileText, label: 'Ordens de Compra', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/assets', icon: Wrench, label: 'Ativos e Equip.', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/facility/work-orders', icon: Wrench, label: 'Manutenção', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/waste/manifests', icon: Trash2, label: 'Resíduos (RSS)', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/employees', icon: Contact, label: 'Funcionários', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/suppliers', icon: Store, label: 'Fornecedores', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/billing/charges', icon: DollarSign, label: 'Cobranças', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/billing/claims', icon: FileSpreadsheet, label: 'Contas Hospitalares', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/billing/denials', icon: XCircle, label: 'Glosas', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/quality/incidents', icon: AlertTriangle, label: 'Eventos Adversos', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/governance/audit-events', icon: ShieldCheck, label: 'Trilha de Auditoria', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/governance/credentials', icon: IdCard, label: 'Credenciais', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/governance/consent-forms', icon: FileSignature, label: 'Consentimentos', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/system', icon: Settings, label: 'Status do Sistema', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/activity', icon: ClipboardList, label: 'Log de Atividade', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/audit', icon: Lock, label: 'Auditoria', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/cron', icon: Clock, label: 'Cron Jobs', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/agents', icon: Bot, label: 'Agentes', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/suggestions', icon: Lightbulb, label: 'Sugestões', section: NAV_SECTIONS.ADMINISTRACAO },
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
  userName: _userName,
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
  const widthRef = useRef<number>(SIDEBAR_DEFAULT_WIDTH);
  const asideRef = useRef<HTMLElement | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartWidthRef = useRef<number>(SIDEBAR_DEFAULT_WIDTH);

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
                  const isActive =
                    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
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
      </nav>

      {/* Spacer to push content up */}
      <div className="flex-1" />
    </aside>
  );
}

export type { Role };
export { ROLES };
