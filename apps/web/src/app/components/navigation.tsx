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
import { VelyaLogo } from './velya/velya-logo';
import { VelyaMedicalCross } from './velya/velya-medical-cross';
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleSuggestionSubmit();
    }
  }

  function handleNavClick() {
    onMobileClose?.();
  }

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 bottom-0 z-50 flex w-64 flex-col overflow-y-auto shrink-0',
        'border-r border-white/[0.08] bg-[rgba(10,14,23,0.88)] backdrop-blur-2xl backdrop-saturate-150',
        'transition-transform duration-300',
        'md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Teal vertical accent bar on far left edge */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-teal-400/40 to-transparent" />

      {/* Close button for mobile */}
      <button
        className="absolute top-3 right-3 rounded-md p-1 text-slate-300 hover:text-white md:hidden"
        onClick={onMobileClose}
        aria-label="Fechar menu"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Logo + selo hospitalar */}
      <div className="relative border-b border-white/[0.08] px-5 py-5">
        <VelyaLogo size={34} />
        {/* Cruz médica decorativa no canto */}
        <div className="absolute right-4 top-4 opacity-20">
          <VelyaMedicalCross size={18} variant="outline" />
        </div>
      </div>

      {/* Pulse strip — banner fino estilo monitor indicando "plataforma viva" */}
      <div className="border-b border-white/[0.05] bg-gradient-to-r from-transparent via-teal-500/[0.04] to-transparent px-5 py-2">
        <div className="flex items-center gap-2 text-[10px] font-medium">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
          </span>
          <span className="text-emerald-300/90">Sistema em operação</span>
          <span className="ml-auto font-mono text-slate-500">24/7</span>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {sectionOrder.map((section, sectionIdx) => {
          const items = groupedItems[section];
          if (!items || items.length === 0) return null;
          return (
            <div key={section} className={sectionIdx > 0 ? 'mt-4' : ''}>
              <div className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {SECTION_LABELS[section]}
              </div>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const isActive =
                    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleNavClick}
                      className={cn(
                        'group relative flex min-h-[38px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-teal-400/10 text-teal-200 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.25)]'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100',
                      )}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-teal-300 shadow-[0_0_8px_rgba(45,212,191,0.7)]"
                        />
                      )}
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px] shrink-0 transition-colors',
                          isActive
                            ? 'text-teal-300'
                            : 'text-slate-500 group-hover:text-slate-300',
                        )}
                        strokeWidth={2}
                      />
                      <span className="truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={cn(
                            'ml-auto rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums',
                            item.badge >= 10 && item.label.includes('Alerta')
                              ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40'
                              : 'bg-white/[0.08] text-slate-300',
                          )}
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
          <div className="mt-4">
            <div className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Observabilidade
            </div>
            <div className="flex flex-col gap-0.5">
              <Link
                href="/observability/metrics"
                onClick={handleNavClick}
                className="flex min-h-[38px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
              >
                <LineChart className="h-[18px] w-[18px] text-slate-500" strokeWidth={2} />
                <span>Métricas</span>
              </Link>
              <Link
                href="/observability/deploys"
                onClick={handleNavClick}
                className="flex min-h-[38px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
              >
                <GitBranch className="h-[18px] w-[18px] text-slate-500" strokeWidth={2} />
                <span>Implantações</span>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Selo de compliance hospitalar */}
      <div className="border-t border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-2.5 py-2">
          <VelyaMedicalCross size={18} variant="outline" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
              Hospital Acreditado
            </div>
            <div className="truncate text-[9px] font-mono text-emerald-400/70">
              LGPD · CFM 2.314 · HL7 FHIR
            </div>
          </div>
        </div>
      </div>

      {/* Suggestion box */}
      <div className="border-t border-white/[0.08] bg-gradient-to-br from-teal-500/10 via-transparent to-transparent p-4">
        {suggestionStatus === 'sent' ? (
          <div
            role="status"
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 py-3 text-center text-sm font-semibold text-emerald-300"
          >
            ✓ Sugestão enviada — obrigado!
          </div>
        ) : (
          <div>
            <label
              htmlFor="sidebar-suggestion"
              className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-200"
            >
              <Lightbulb className="h-3.5 w-3.5 text-teal-300" />
              Sugerir melhoria
            </label>
            <div className="flex gap-1.5">
              <input
                id="sidebar-suggestion"
                type="text"
                value={suggestionText}
                onChange={(e) => setSuggestionText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="O que pode melhorar?"
                disabled={suggestionStatus === 'sending'}
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-teal-400/60 focus:ring-2 focus:ring-teal-400/20 disabled:opacity-60"
              />
              <button
                onClick={handleSuggestionSubmit}
                disabled={!suggestionText.trim() || suggestionStatus === 'sending'}
                aria-label="Enviar sugestão"
                className="shrink-0 rounded-md bg-gradient-to-br from-teal-500 to-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-[0_0_12px_-2px_rgba(20,184,166,0.4)] transition-all hover:-translate-y-px hover:from-teal-400 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {suggestionStatus === 'sending' ? '…' : 'Enviar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export type { Role };
export { ROLES };
