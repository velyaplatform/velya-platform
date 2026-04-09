import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Velya — Hospital Operations Platform',
  description:
    'AI-native hospital operations platform. Real-time patient flow, discharge coordination, and clinical task management.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
