export interface ShortcutDef {
  key: string;
  label: string;
  description: string;
  scope: 'global' | string;
  action: 'navigate' | 'command' | 'toggle';
  target?: string;
  requiresModifier?: boolean;
}

export const SHORTCUTS: ShortcutDef[] = [
  // ── Global navigation (g + letter) ──────────────────────────────────
  {
    key: 'g p',
    label: 'Ir para Pacientes',
    description: 'Navega para a lista de pacientes',
    scope: 'global',
    action: 'navigate',
    target: '/pacientes',
  },
  {
    key: 'g t',
    label: 'Ir para Tarefas',
    description: 'Navega para a lista de tarefas',
    scope: 'global',
    action: 'navigate',
    target: '/tasks',
  },
  {
    key: 'g a',
    label: 'Ir para Alertas',
    description: 'Navega para os alertas clínicos',
    scope: 'global',
    action: 'navigate',
    target: '/alerts',
  },
  {
    key: 'g d',
    label: 'Ir para Alta',
    description: 'Navega para o painel de alta hospitalar',
    scope: 'global',
    action: 'navigate',
    target: '/discharge',
  },
  {
    key: 'g b',
    label: 'Ir para Leitos',
    description: 'Navega para o mapa de leitos',
    scope: 'global',
    action: 'navigate',
    target: '/beds',
  },
  {
    key: 'g l',
    label: 'Ir para Laboratório',
    description: 'Navega para resultados laboratoriais',
    scope: 'global',
    action: 'navigate',
    target: '/lab',
  },
  {
    key: 'g i',
    label: 'Ir para Imagem',
    description: 'Navega para exames de imagem',
    scope: 'global',
    action: 'navigate',
    target: '/imaging',
  },
  {
    key: 'g s',
    label: 'Ir para Busca',
    description: 'Navega para a busca geral',
    scope: 'global',
    action: 'navigate',
    target: '/search',
  },

  // ── Global commands ─────────────────────────────────────────────────
  {
    key: 'ctrl+k',
    label: 'Command Palette',
    description: 'Abre a paleta de comandos',
    scope: 'global',
    action: 'command',
    target: 'command-palette',
    requiresModifier: true,
  },
  {
    key: '?',
    label: 'Atalhos',
    description: 'Exibe todos os atalhos de teclado',
    scope: 'global',
    action: 'toggle',
    target: 'shortcuts-overlay',
  },
  {
    key: 'Escape',
    label: 'Fechar',
    description: 'Fecha painéis e overlays abertos',
    scope: 'global',
    action: 'command',
    target: 'close-overlay',
  },

  // ── Patients module ─────────────────────────────────────────────────
  {
    key: 'n',
    label: 'Novo Paciente',
    description: 'Abre o formulário de novo paciente',
    scope: 'patients',
    action: 'command',
    target: 'new-patient',
  },
  {
    key: 'f',
    label: 'Filtrar',
    description: 'Abre o painel de filtros de pacientes',
    scope: 'patients',
    action: 'command',
    target: 'filter-patients',
  },

  // ── Tasks module ────────────────────────────────────────────────────
  {
    key: 'n',
    label: 'Nova Tarefa',
    description: 'Abre o formulário de nova tarefa',
    scope: 'tasks',
    action: 'command',
    target: 'new-task',
  },

  // ── Beds module ─────────────────────────────────────────────────────
  {
    key: 'f',
    label: 'Filtrar por Status',
    description: 'Filtra leitos por status de ocupação',
    scope: 'beds',
    action: 'command',
    target: 'filter-beds',
  },
];

export function getShortcutsForScope(scope: string): ShortcutDef[] {
  return SHORTCUTS.filter(
    (s) => s.scope === scope || s.scope === 'global',
  );
}
