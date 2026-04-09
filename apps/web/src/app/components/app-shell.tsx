'use client';

import { useState, useEffect } from 'react';
import { Navigation, type Role } from './navigation';
import { ROLE_DEFINITIONS, resolveUiRole } from '../../lib/access-control';

interface AppShellProps {
  children: React.ReactNode;
  pageTitle: string;
}

export function AppShell({ children, pageTitle }: AppShellProps) {
  const [currentRole, setCurrentRole] = useState<Role>('Coordenador de Ala');
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const roleInitials: Record<Role, string> = {
    'Coordenador de Ala': 'CA',
    'Medico': 'MD',
    'Enfermeiro(a)': 'EN',
    'Tecnico de Enfermagem': 'TE',
    'Planejador de Alta': 'PA',
    'Farmaceutico': 'FM',
    'Fisioterapeuta': 'FT',
    'Recepcao': 'RC',
    'Motorista': 'MT',
    'Higienizacao': 'HG',
    'Faturamento': 'FA',
    'Diretor Clinico': 'DC',
    'Administrador': 'AD',
  };

  const roleNames: Record<Role, string> = {
    'Coordenador de Ala': 'Alex Thornton',
    'Medico': 'Dra. Sarah Chen',
    'Enfermeiro(a)': 'Enf. Maria Lopez',
    'Tecnico de Enfermagem': 'Tec. Ana Souza',
    'Planejador de Alta': 'James Okafor',
    'Farmaceutico': 'Farm. Pedro Lima',
    'Fisioterapeuta': 'Ft. Carla Mendes',
    'Recepcao': 'Julia Santos',
    'Motorista': 'Carlos Ferreira',
    'Higienizacao': 'Rosa Oliveira',
    'Faturamento': 'Patricia Costa',
    'Diretor Clinico': 'Dr. Ricardo Alves',
    'Administrador': 'Admin Velya',
  };

  const professionalRole = resolveUiRole(currentRole);
  const roleDef = ROLE_DEFINITIONS[professionalRole];
  const councilBadge = roleDef?.professionalCouncil ?? null;

  return (
    <div className="app-shell">
      <Navigation currentRole={currentRole} onRoleChange={setCurrentRole} />
      <div className="app-main">
        <header className="app-topbar">
          <span className="topbar-title">{pageTitle}</span>
          <div className="topbar-right">
            <div className="topbar-alerts">
              <span>{'\uD83D\uDD34'}</span>
              <span>5 Alertas Criticos</span>
            </div>
            <div className="topbar-time">{currentTime}</div>
            <div className="topbar-user">
              <div className="avatar">{roleInitials[currentRole]}</div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span>{roleNames[currentRole]}</span>
                {councilBadge && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      color: 'rgba(147,197,253,0.9)',
                      fontWeight: 500,
                    }}
                  >
                    {councilBadge} | Nivel {roleDef?.accessLevel}
                  </span>
                )}
                {!councilBadge && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      color: 'rgba(255,255,255,0.5)',
                      fontWeight: 500,
                    }}
                  >
                    Nivel {roleDef?.accessLevel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
