'use client';

import { useState } from 'react';
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

export function Navigation({
  currentRole,
  userName,
  onLogout: _onLogout,
  mobileOpen,
  onMobileClose,
}: NavigationProps) {
  const pathname = usePathname();
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionStatus, setSuggestionStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

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

  async function handleSuggestionSubmit() {
    const text = suggestionText.trim();
    if (!text || suggestionStatus === 'sending') return;

    setSuggestionStatus('sending');
    try {
      await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, author: `${userName} (${currentRole})` }),
      });
      setSuggestionText('');
      setSuggestionStatus('sent');
      setTimeout(() => setSuggestionStatus('idle'), 2000);
    } catch {
      setSuggestionStatus('idle');
    }
  }

  function handleNavClick() {
    onMobileClose?.();
  }

  return (
    <aside
      className={cn(
        'fixed left-0 bottom-0 z-40 flex w-[260px] flex-col overflow-y-auto shrink-0',
        'border-r bg-white text-neutral-800',
        'transition-transform duration-300',
        'md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}
      style={{
        top: 'var(--header-height)',
        borderColor: 'var(--border-default)',
        background: 'var(--canvas-default)',
        color: 'var(--fg-default)',
      }}
    >

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

      {/* Caixa de Recomendações — estilo Primer */}
      <div
        className="p-4"
        style={{
          borderTop: '1px solid var(--border-default)',
          background: 'var(--canvas-subtle)',
        }}
      >
        {suggestionStatus === 'sent' ? (
          <div
            role="status"
            className="gh-flash gh-flash-success"
            style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600 }}
          >
            ✓ Recomendação enviada
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-start gap-2">
              <Lightbulb
                className="h-4 w-4 mt-0.5 shrink-0"
                style={{ color: 'var(--attention-emphasis)' }}
                strokeWidth={2}
              />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="sidebar-suggestion"
                  className="block"
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: 'var(--fg-default)',
                  }}
                >
                  Enviar recomendação
                </label>
                <p
                  className="mt-0.5"
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--fg-muted)',
                    lineHeight: 1.4,
                  }}
                >
                  Viu algo que pode melhorar? Conte pra gente.
                </p>
              </div>
            </div>

            <textarea
              id="sidebar-suggestion"
              aria-label="Enviar recomendação ou sugestão de melhoria"
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSuggestionSubmit();
                }
              }}
              placeholder="Descreva sua recomendação…"
              disabled={suggestionStatus === 'sending'}
              rows={3}
              className="gh-input w-full"
              style={{ resize: 'none', fontSize: 'var(--text-xs)' }}
            />

            <button
              onClick={handleSuggestionSubmit}
              disabled={!suggestionText.trim() || suggestionStatus === 'sending'}
              className="btn btn-primary btn-sm mt-2 w-full"
            >
              {suggestionStatus === 'sending' ? (
                <>
                  <span
                    className="h-3 w-3 animate-spin rounded-full border-2"
                    style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }}
                  />
                  Enviando…
                </>
              ) : (
                <>
                  <Lightbulb className="h-3.5 w-3.5" />
                  Enviar
                </>
              )}
            </button>

            <div
              className="mt-2 flex items-center justify-center gap-1"
              style={{ fontSize: 10, color: 'var(--fg-subtle)' }}
            >
              <kbd>⌘</kbd>
              <kbd>↵</kbd>
              <span>para enviar</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export type { Role };
export { ROLES };
