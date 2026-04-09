'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ROLES = ['Coordenador de Ala', 'Médico', 'Enfermeiro(a)', 'Planejador de Alta', 'Administrador'] as const;
type Role = (typeof ROLES)[number];

interface NavItemDef {
  href: string;
  icon: string;
  label: string;
  badge?: number;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  { href: '/', icon: '⬛', label: 'Centro de Comando' },
  { href: '/patients', icon: '🧑‍⚕️', label: 'Pacientes', badge: 47 },
  { href: '/tasks', icon: '✅', label: 'Caixa de Tarefas', badge: 12 },
  { href: '/discharge', icon: '🏠', label: 'Torre de Altas', badge: 5 },
  { href: '/system', icon: '⚙️', label: 'Status do Sistema', adminOnly: true },
  { href: '/activity', icon: '📋', label: 'Log de Atividade', adminOnly: true },
  { href: '/audit', icon: '🔒', label: 'Auditoria', adminOnly: true },
  { href: '/suggestions', icon: '💡', label: 'Sugestões', adminOnly: true },
];

interface NavigationProps {
  currentRole: Role;
  onRoleChange: (role: Role) => void;
}

export function Navigation({ currentRole, onRoleChange }: NavigationProps) {
  const pathname = usePathname();
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionStatus, setSuggestionStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const isAdmin = currentRole === 'Administrador';

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  async function handleSuggestionSubmit() {
    const text = suggestionText.trim();
    if (!text || suggestionStatus === 'sending') return;

    setSuggestionStatus('sending');
    try {
      await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, author: currentRole }),
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
        <div className="nav-section-label">Espaço de Trabalho</div>

        {visibleNavItems.map((item) => {
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

        {isAdmin && (
          <>
            <div className="nav-section-label" style={{ marginTop: '1rem' }}>Observabilidade</div>

            <a
              href="http://grafana.172.19.0.6.nip.io"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-item"
            >
              <span className="nav-item-icon">📊</span>
              <span>Grafana</span>
            </a>

            <a
              href="http://argocd.172.19.0.6.nip.io"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-item"
            >
              <span className="nav-item-icon">🔄</span>
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
            ✓ Enviada!
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="text"
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="💡 Sugerir melhoria..."
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
              ↑
            </button>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-role-badge">
          <div className="sidebar-role-label">
            Função Ativa
            {isAdmin && (
              <span
                style={{
                  marginLeft: '0.5rem',
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '0.65rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Admin
              </span>
            )}
          </div>
          <select
            value={currentRole}
            onChange={(e) => onRoleChange(e.target.value as Role)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.85)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          >
            {ROLES.map((role) => (
              <option key={role} value={role} style={{ background: '#16213e', color: 'white' }}>
                {role}
              </option>
            ))}
          </select>
        </div>
      </div>
    </aside>
  );
}

export type { Role };
export { ROLES };
