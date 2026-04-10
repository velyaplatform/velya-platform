'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ROLE_DEFINITIONS,
  NAV_SECTIONS,
  resolveUiRole,
  getNavigationSections,
} from '../../lib/access-control';

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
  icon: string;
  label: string;
  badge?: number;
  section: string;
  requiredAction?: string;
}

const NAV_ITEMS: NavItemDef[] = [
  // --- Assistencial ---
  { href: '/', icon: '\u2B1B', label: 'Centro de Comando', section: NAV_SECTIONS.ASSISTENCIAL },
  {
    href: '/patients',
    icon: '\uD83E\uDDD1\u200D\u2695\uFE0F',
    label: 'Pacientes',
    badge: 47,
    section: NAV_SECTIONS.ASSISTENCIAL,
  },
  {
    href: '/tasks',
    icon: '\u2705',
    label: 'Caixa de Tarefas',
    badge: 12,
    section: NAV_SECTIONS.ASSISTENCIAL,
  },
  // --- Gestao ---
  {
    href: '/discharge',
    icon: '\uD83C\uDFE0',
    label: 'Torre de Altas',
    badge: 5,
    section: NAV_SECTIONS.GESTAO,
  },
  {
    href: '/beds',
    icon: '\uD83D\uDECF\uFE0F',
    label: 'Leitos',
    section: NAV_SECTIONS.GESTAO,
  },
  {
    href: '/surgery',
    icon: '\u2695\uFE0F',
    label: 'Centro Cir\u00FArgico',
    section: NAV_SECTIONS.GESTAO,
  },
  {
    href: '/ems',
    icon: '\uD83D\uDE91',
    label: 'Ambul\u00E2ncias',
    section: NAV_SECTIONS.GESTAO,
  },
  {
    href: '/icu',
    icon: '\uD83D\uDC89',
    label: 'UTI',
    section: NAV_SECTIONS.GESTAO,
  },
  {
    href: '/pharmacy',
    icon: '\uD83D\uDC8A',
    label: 'Farm\u00E1cia',
    section: NAV_SECTIONS.GESTAO,
  },
  // --- Clínico (ordens, resultados) ---
  { href: '/prescriptions', icon: '\uD83D\uDC8A', label: 'Prescri\u00e7\u00f5es', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/lab/orders',     icon: '\uD83E\uDDEA', label: 'Ordens de Lab',   section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/lab/results',    icon: '\uD83D\uDCCA', label: 'Resultados Lab',  section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/imaging/orders', icon: '\uD83E\uDE7B', label: 'Ordens de Imagem', section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/imaging/results',icon: '\uD83D\uDDBC\uFE0F', label: 'Laudos de Imagem', section: NAV_SECTIONS.ASSISTENCIAL },

  // --- Equipe em plantão ---
  { href: '/staff-on-duty', icon: '\uD83D\uDC65', label: 'Equipe em Plantão', section: NAV_SECTIONS.GESTAO },
  { href: '/alerts',        icon: '\uD83D\uDD14', label: 'Alertas', badge: 5, section: NAV_SECTIONS.ASSISTENCIAL },

  // --- Operações hospitalares ---
  { href: '/pharmacy/stock',    icon: '\uD83C\uDFEA', label: 'Estoque Farm\u00e1cia', section: NAV_SECTIONS.GESTAO },
  { href: '/cleaning/tasks',    icon: '\uD83E\uDDF9', label: 'Higieniza\u00e7\u00e3o',   section: NAV_SECTIONS.GESTAO },
  { href: '/transport/orders',  icon: '\uD83D\uDEB6', label: 'Transporte Interno',      section: NAV_SECTIONS.GESTAO },
  { href: '/meals/orders',      icon: '\uD83C\uDF7D\uFE0F', label: 'Nutri\u00e7\u00e3o',  section: NAV_SECTIONS.GESTAO },

  // --- Suprimentos e ativos ---
  { href: '/supply/items',            icon: '\uD83D\uDCE6', label: 'Cat\u00e1logo de Itens', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/supply/purchase-orders',  icon: '\uD83D\uDCDD', label: 'Ordens de Compra',       section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/assets',                  icon: '\uD83D\uDD27', label: 'Ativos e Equip.',        section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/facility/work-orders',    icon: '\uD83D\uDEE0\uFE0F', label: 'Manuten\u00e7\u00e3o',  section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/waste/manifests',         icon: '\uD83D\uDDD1\uFE0F', label: 'Res\u00edduos (RSS)',   section: NAV_SECTIONS.ADMINISTRACAO },

  // --- Cadastros ---
  { href: '/employees', icon: '\uD83D\uDCC7', label: 'Funcion\u00e1rios', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/suppliers', icon: '\uD83C\uDFEC', label: 'Fornecedores',       section: NAV_SECTIONS.ADMINISTRACAO },

  // --- Faturamento ---
  { href: '/billing/charges', icon: '\uD83D\uDCB0', label: 'Cobran\u00e7as', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/billing/claims',  icon: '\uD83D\uDCC4', label: 'Contas Hospitalares', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/billing/denials', icon: '\u274C',       label: 'Glosas',          section: NAV_SECTIONS.ADMINISTRACAO },

  // --- Qualidade e governança ---
  { href: '/quality/incidents',         icon: '\u26A0\uFE0F', label: 'Eventos Adversos', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/governance/audit-events',   icon: '\uD83D\uDD0D', label: 'Trilha de Auditoria', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/governance/credentials',    icon: '\uD83C\uDD94', label: 'Credenciais',        section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/governance/consent-forms',  icon: '\u270D\uFE0F', label: 'Consentimentos',     section: NAV_SECTIONS.ADMINISTRACAO },

  // --- Sistema ---
  { href: '/system',   icon: '\u2699\uFE0F', label: 'Status do Sistema', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/activity', icon: '\uD83D\uDCCB', label: 'Log de Atividade',  section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/audit',    icon: '\uD83D\uDD12', label: 'Auditoria',         section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/suggestions', icon: '\uD83D\uDCA1', label: 'Sugestoes',      section: NAV_SECTIONS.ADMINISTRACAO },
];

const SECTION_LABELS: Record<string, string> = {
  [NAV_SECTIONS.ASSISTENCIAL]: 'Assistencial',
  [NAV_SECTIONS.GESTAO]: 'Gestao',
  [NAV_SECTIONS.ADMINISTRACAO]: 'Administracao',
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
  onLogout,
  mobileOpen,
  onMobileClose,
}: NavigationProps) {
  const pathname = usePathname();
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionStatus, setSuggestionStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const professionalRole = resolveUiRole(currentRole);
  const roleDef = ROLE_DEFINITIONS[professionalRole];
  const allowedSections = getNavigationSections(professionalRole);

  // Filter nav items by allowed sections
  const visibleNavItems = NAV_ITEMS.filter((item) => allowedSections.includes(item.section));

  // Group visible items by section for rendering
  const groupedItems: Record<string, NavItemDef[]> = {};
  for (const item of visibleNavItems) {
    if (!groupedItems[item.section]) {
      groupedItems[item.section] = [];
    }
    groupedItems[item.section].push(item);
  }

  // Section render order
  const sectionOrder = [NAV_SECTIONS.ASSISTENCIAL, NAV_SECTIONS.GESTAO, NAV_SECTIONS.ADMINISTRACAO];

  const showObservability = allowedSections.includes(NAV_SECTIONS.OBSERVABILIDADE);

  const accessLevelLabel = `Nivel ${roleDef?.accessLevel ?? 0}`;

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
    // Close mobile sidebar on navigation
    onMobileClose?.();
  }

  const accessLevelBg =
    roleDef?.accessLevel >= 6
      ? 'bg-red-500'
      : roleDef?.accessLevel >= 4
        ? 'bg-amber-500'
        : 'bg-gray-500';

  return (
    <aside
      className={`
        fixed top-0 left-0 bottom-0 z-50
        w-60 bg-[var(--color-brand-mid)] flex flex-col shrink-0 overflow-y-auto
        transition-transform duration-200
        md:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      {/* Close button for mobile */}
      <button
        className="absolute top-3 right-3 p-1 rounded text-white/85 hover:text-white md:hidden"
        onClick={onMobileClose}
        aria-label="Fechar menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div className="px-5 py-5 border-b border-white/[0.08]">
        <div className="text-xl font-bold text-white tracking-tight">Velya</div>
        <div className="text-xs text-white/75 mt-0.5 tracking-widest uppercase font-medium">
          Plataforma Hospitalar
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
        {sectionOrder.map((section, sectionIdx) => {
          const items = groupedItems[section];
          if (!items || items.length === 0) return null;
          return (
            <div key={section} className={sectionIdx > 0 ? 'mt-3' : ''}>
              <div className="text-[10px] font-semibold text-white/75 uppercase tracking-wider px-3 pt-3 pb-2.5">
                {SECTION_LABELS[section]}
              </div>
              <div className="flex flex-col gap-1">
                {items.map((item) => {
                  const isActive =
                    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleNavClick}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                        no-underline transition-colors duration-150 min-h-[40px]
                        ${
                          isActive
                            ? 'bg-blue-600/25 text-white border-l-[3px] border-blue-500 pl-[calc(0.75rem-3px)]'
                            : 'text-white/85 hover:bg-white/[0.08] hover:text-white'
                        }
                      `}
                    >
                      <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                      <span>{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="ml-auto bg-red-600 text-white text-[10px] font-bold px-1.5 py-px rounded-full min-w-[18px] text-center">
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
            <div className="text-[10px] font-semibold text-white/75 uppercase tracking-wider px-3 pt-3 pb-2.5">
              Observabilidade
            </div>
            <div className="flex flex-col gap-1">
              <Link
                href="/observability/metrics"
                onClick={handleNavClick}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/85 hover:bg-white/[0.08] hover:text-white no-underline transition-colors duration-150 min-h-[40px]"
              >
                <span className="text-base w-5 text-center shrink-0">{'\uD83D\uDCCA'}</span>
                <span>Métricas</span>
              </Link>

              <Link
                href="/observability/deploys"
                onClick={handleNavClick}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/85 hover:bg-white/[0.08] hover:text-white no-underline transition-colors duration-150 min-h-[40px]"
              >
                <span className="text-base w-5 text-center shrink-0">{'\uD83D\uDD04'}</span>
                <span>Implantações</span>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Suggestion box */}
      <div className="px-4 py-4 border-t border-white/[0.08]">
        {suggestionStatus === 'sent' ? (
          <div className="text-green-300 text-[0.8rem] text-center py-1 font-medium">
            {'\u2713'} Enviada!
          </div>
        ) : (
          <div className="flex gap-1.5 items-center">
            <label htmlFor="sidebar-suggestion" className="sr-only">
              Sugerir melhoria
            </label>
            <input
              id="sidebar-suggestion"
              type="text"
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={'\uD83D\uDCA1 Sugerir melhoria...'}
              disabled={suggestionStatus === 'sending'}
              className="flex-1 bg-white/[0.10] border border-white/30 rounded-lg px-3 py-3 text-white text-sm outline-none font-[inherit] placeholder:text-white/75 min-h-[44px]"
            />
            <button
              onClick={handleSuggestionSubmit}
              disabled={!suggestionText.trim() || suggestionStatus === 'sending'}
              aria-label="Enviar sugestão"
              className={`bg-white/15 border-none rounded-lg px-3 py-3 text-white text-sm leading-none min-h-[44px] ${
                suggestionText.trim() ? 'cursor-pointer hover:bg-white/25' : 'cursor-default'
              }`}
            >
              {'\u2191'}
            </button>
          </div>
        )}
      </div>

      {/* Spacer + Sair button */}
      <div className="px-3 pt-6 pb-5 mt-auto">
        <button
          onClick={onLogout}
          className="w-full min-h-[44px] bg-red-500/25 border border-red-400/60 rounded-lg py-2 px-4 text-red-100 text-sm font-semibold cursor-pointer font-[inherit] hover:bg-red-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

export type { Role };
export { ROLES };
