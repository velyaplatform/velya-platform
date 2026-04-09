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
  { href: '/patients', icon: '\uD83E\uDDD1\u200D\u2695\uFE0F', label: 'Pacientes', badge: 47, section: NAV_SECTIONS.ASSISTENCIAL },
  { href: '/tasks', icon: '\u2705', label: 'Caixa de Tarefas', badge: 12, section: NAV_SECTIONS.ASSISTENCIAL },
  // --- Gestao ---
  { href: '/discharge', icon: '\uD83C\uDFE0', label: 'Torre de Altas', badge: 5, section: NAV_SECTIONS.GESTAO },
  // --- Administracao ---
  { href: '/system', icon: '\u2699\uFE0F', label: 'Status do Sistema', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/activity', icon: '\uD83D\uDCCB', label: 'Log de Atividade', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/audit', icon: '\uD83D\uDD12', label: 'Auditoria', section: NAV_SECTIONS.ADMINISTRACAO },
  { href: '/suggestions', icon: '\uD83D\uDCA1', label: 'Sugestoes', section: NAV_SECTIONS.ADMINISTRACAO },
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
}

export function Navigation({ currentRole, userName, onLogout }: NavigationProps) {
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
  const sectionOrder = [
    NAV_SECTIONS.ASSISTENCIAL,
    NAV_SECTIONS.GESTAO,
    NAV_SECTIONS.ADMINISTRACAO,
  ];

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

  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-text">Velya</div>
        <div className="sidebar-logo-sub">Plataforma Hospitalar</div>
      </div>

      <nav className="sidebar-nav">
        {sectionOrder.map((section) => {
          const items = groupedItems[section];
          if (!items || items.length === 0) return null;
          return (
            <div key={section}>
              <div className="nav-section-label">{SECTION_LABELS[section]}</div>
              {items.map((item) => {
                const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item${isActive ? ' active' : ''}`}
                  >
                    <span className="nav-item-icon">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="nav-badge">{item.badge}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}

        {showObservability && (
          <>
            <div className="nav-section-label" style={{ marginTop: '1rem' }}>Observabilidade</div>

            <a
              href="http://grafana.172.19.0.6.nip.io"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-item"
            >
              <span className="nav-item-icon">{'\uD83D\uDCCA'}</span>
              <span>Grafana</span>
            </a>

            <a
              href="http://argocd.172.19.0.6.nip.io"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-item"
            >
              <span className="nav-item-icon">{'\uD83D\uDD04'}</span>
              <span>ArgoCD</span>
            </a>
          </>
        )}
      </nav>

      {/* Suggestion box */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {suggestionStatus === 'sent' ? (
          <div
            style={{
              color: '#4ade80',
              fontSize: '0.8rem',
              textAlign: 'center',
              padding: '0.4rem 0',
              fontWeight: 500,
            }}
          >
            {'\u2713'} Enviada!
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="text"
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={'\uD83D\uDCA1 Sugerir melhoria...'}
              disabled={suggestionStatus === 'sending'}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                padding: '0.4rem 0.6rem',
                color: 'rgba(255,255,255,0.85)',
                fontSize: '0.78rem',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleSuggestionSubmit}
              disabled={!suggestionText.trim() || suggestionStatus === 'sending'}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '6px',
                padding: '0.4rem 0.5rem',
                color: 'rgba(255,255,255,0.7)',
                cursor: suggestionText.trim() ? 'pointer' : 'default',
                fontSize: '0.85rem',
                lineHeight: 1,
              }}
            >
              {'\u2191'}
            </button>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-role-badge">
          <div className="sidebar-role-label">
            Funcao Ativa
            <span
              style={{
                marginLeft: '0.5rem',
                background: roleDef?.accessLevel >= 6 ? '#ef4444' : roleDef?.accessLevel >= 4 ? '#f59e0b' : '#6b7280',
                color: 'white',
                fontSize: '0.65rem',
                padding: '0.1rem 0.4rem',
                borderRadius: '4px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {accessLevelLabel}
            </span>
            {roleDef?.professionalCouncil && (
              <span
                style={{
                  marginLeft: '0.35rem',
                  background: 'rgba(59,130,246,0.3)',
                  color: '#93c5fd',
                  fontSize: '0.6rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                {roleDef.professionalCouncil}
              </span>
            )}
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: '0.875rem',
              fontWeight: 600,
              marginTop: '2px',
            }}
          >
            {currentRole}
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '0.7rem',
              marginTop: '2px',
            }}
          >
            {userName}
          </div>
        </div>

        <button
          onClick={onLogout}
          style={{
            width: '100%',
            marginTop: '0.75rem',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px',
            padding: '0.5rem',
            color: '#fca5a5',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

export type { Role };
export { ROLES };
