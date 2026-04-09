import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Velya — Plataforma Hospitalar',
  description:
    'Plataforma hospitalar com IA nativa. Fluxo de pacientes em tempo real, coordenação de altas e gestão de tarefas clínicas.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
