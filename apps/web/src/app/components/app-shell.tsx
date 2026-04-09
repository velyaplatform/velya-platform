'use client';

import { useState, useEffect } from 'react';
import { Navigation, type Role } from './navigation';

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
    'Médico': 'MD',
    'Enfermeiro(a)': 'EN',
    'Planejador de Alta': 'PA',
    'Administrador': 'AD',
  };

  const roleNames: Record<Role, string> = {
    'Coordenador de Ala': 'Alex Thornton',
    'Médico': 'Dra. Sarah Chen',
    'Enfermeiro(a)': 'Enf. Maria Lopez',
    'Planejador de Alta': 'James Okafor',
    'Administrador': 'Admin Velya',
  };

  return (
    <div className="app-shell">
      <Navigation currentRole={currentRole} onRoleChange={setCurrentRole} />
      <div className="app-main">
        <header className="app-topbar">
          <span className="topbar-title">{pageTitle}</span>
          <div className="topbar-right">
            <div className="topbar-alerts">
              <span>🔴</span>
              <span>5 Alertas Críticos</span>
            </div>
            <div className="topbar-time">{currentTime}</div>
            <div className="topbar-user">
              <div className="avatar">{roleInitials[currentRole]}</div>
              <span>{roleNames[currentRole]}</span>
            </div>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
