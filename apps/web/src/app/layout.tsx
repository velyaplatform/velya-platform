import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { AiAssistantPanel } from './components/ai-assistant-panel';
import { CommandPalette } from './components/command-palette';
import { ErrorBoundary } from './components/error-boundary';
import { ErrorReporter } from './components/error-reporter';
import { NavTelemetryMount } from './components/nav-telemetry-mount';
import { OnboardingTour } from './components/onboarding-tour';
import { ShortcutsHelp } from './components/shortcuts-help';
import { ToastProvider } from './components/toast-provider';

export const metadata: Metadata = {
  title: 'Velya — Plataforma Hospitalar',
  description:
    'Plataforma hospitalar com IA nativa. Fluxo de pacientes em tempo real, coordenação de altas e gestão de tarefas clínicas.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={GeistSans.className}>
        <ErrorBoundary>
          <ToastProvider>
            {children}
            <CommandPalette />
            <AiAssistantPanel />
            <ShortcutsHelp />
            <OnboardingTour />
            <NavTelemetryMount />
          </ToastProvider>
        </ErrorBoundary>
        <ErrorReporter />
      </body>
    </html>
  );
}
