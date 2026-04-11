'use client';

import { usePathname } from 'next/navigation';
import { AiAssistantPanel } from './ai-assistant-panel';
import { CommandPalette } from './command-palette';
import { OnboardingTour } from './onboarding-tour';
import { ShortcutsHelp } from './shortcuts-help';

/**
 * Providers globais de UI que só fazem sentido em rotas autenticadas.
 * Não aparecem em /login, /register, /verify para evitar sobreposição
 * de elementos (tour guiado em cima do form, botões flutuantes sem
 * contexto, etc).
 */
const AUTH_ROUTES = new Set(['/login', '/register', '/verify']);

export function AuthenticatedUiProviders() {
  const pathname = usePathname() ?? '';
  if (AUTH_ROUTES.has(pathname)) {
    return null;
  }
  return (
    <>
      <CommandPalette />
      <AiAssistantPanel />
      <ShortcutsHelp />
      <OnboardingTour />
    </>
  );
}
