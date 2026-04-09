'use client';

import { useState, useEffect } from 'react';
import { Navigation, type Role } from './navigation';

interface AppShellProps {
  children: React.ReactNode;
  pageTitle: string;
}

export function AppShell({ children, pageTitle }: AppShellProps) {
  const [currentRole, setCurrentRole] = useState<Role>('Ward Coordinator');
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-GB', {
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
    'Ward Coordinator': 'WC',
    Doctor: 'DR',
    Nurse: 'RN',
    'Discharge Planner': 'DP',
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
              <span>5 Critical Alerts</span>
            </div>
            <div className="topbar-time">{currentTime}</div>
            <div className="topbar-user">
              <div className="avatar">{roleInitials[currentRole]}</div>
              <span>
                {currentRole === 'Doctor'
                  ? 'Dr. Sarah Chen'
                  : currentRole === 'Nurse'
                    ? 'RN Maria Lopez'
                    : currentRole === 'Discharge Planner'
                      ? 'James Okafor'
                      : 'Alex Thornton'}
              </span>
            </div>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
