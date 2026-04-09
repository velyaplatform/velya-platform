'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ROLES = ['Coordenador de Ala', 'Médico', 'Enfermeiro(a)', 'Planejador de Alta'] as const;
type Role = (typeof ROLES)[number];

interface NavItemDef {
  href: string;
  icon: string;
  label: string;
  badge?: number;
}

const NAV_ITEMS: NavItemDef[] = [
  { href: '/', icon: '⬛', label: 'Centro de Comando' },
  { href: '/patients', icon: '🧑‍⚕️', label: 'Pacientes', badge: 47 },
  { href: '/tasks', icon: '✅', label: 'Caixa de Tarefas', badge: 12 },
  { href: '/discharge', icon: '🏠', label: 'Torre de Altas', badge: 5 },
  { href: '/system', icon: '⚙️', label: 'Status do Sistema' },
];

interface NavigationProps {
  currentRole: Role;
  onRoleChange: (role: Role) => void;
}

export function Navigation({ currentRole, onRoleChange }: NavigationProps) {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-text">Velya</div>
        <div className="sidebar-logo-sub">Plataforma Hospitalar</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Espaço de Trabalho</div>

        {NAV_ITEMS.map((item) => {
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
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-role-badge">
          <div className="sidebar-role-label">Função Ativa</div>
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
