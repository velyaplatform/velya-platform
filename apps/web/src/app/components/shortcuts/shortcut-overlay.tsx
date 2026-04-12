'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { SHORTCUTS, type ShortcutDef } from '../../../lib/shortcuts-config';
import { useShortcuts } from './shortcut-provider';

function formatKeyParts(key: string): string[] {
  return key.split(/[+ ]/).map((k) => {
    if (k === 'ctrl') return 'Ctrl';
    if (k === 'cmd') return 'Cmd';
    if (k === 'Escape') return 'Esc';
    return k.toUpperCase();
  });
}

function KeyBadge({ keyStr }: { keyStr: string }) {
  const parts = formatKeyParts(keyStr);
  return (
    <span className="inline-flex items-center gap-0.5">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-700"
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}

function groupByScope(shortcuts: ShortcutDef[]): Record<string, ShortcutDef[]> {
  const groups: Record<string, ShortcutDef[]> = {};
  for (const s of shortcuts) {
    const scope = s.scope === 'global' ? 'Global' : s.scope.charAt(0).toUpperCase() + s.scope.slice(1);
    if (!groups[scope]) groups[scope] = [];
    groups[scope].push(s);
  }
  return groups;
}

const SCOPE_LABELS: Record<string, string> = {
  Global: 'Atalhos Globais',
  Patients: 'Pacientes',
  Tasks: 'Tarefas',
  Beds: 'Leitos',
};

export function ShortcutOverlay() {
  const { showOverlay, setShowOverlay } = useShortcuts();
  const groups = groupByScope(SHORTCUTS);

  return (
    <Dialog.Root open={showOverlay} onOpenChange={setShowOverlay}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-6 shadow-lg focus:outline-none">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-neutral-900">
              Atalhos de Teclado
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto">
            {Object.entries(groups).map(([scope, shortcuts]) => (
              <section key={scope}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {SCOPE_LABELS[scope] || scope}
                </h3>
                <ul className="space-y-1">
                  {shortcuts.map((s) => (
                    <li
                      key={`${s.scope}-${s.key}`}
                      className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>{s.label}</span>
                      <KeyBadge keyStr={s.key} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <p className="mt-4 text-xs text-neutral-400">
            Pressione <KeyBadge keyStr="?" /> a qualquer momento para exibir este painel.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
