import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AiAssistantPanel } from './components/ai-assistant-panel';
import { CommandPalette } from './components/command-palette';
import { ErrorBoundary } from './components/error-boundary';
import { ErrorReporter } from './components/error-reporter';

export const metadata: Metadata = {
  title: 'Velya — Plataforma Hospitalar',
  description:
    'Plataforma hospitalar com IA nativa. Fluxo de pacientes em tempo real, coordenação de altas e gestão de tarefas clínicas.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ErrorBoundary>
          {children}
          <CommandPalette />
          <AiAssistantPanel />
        </ErrorBoundary>
        <ErrorReporter />
      </body>
    </html>
  );
}
