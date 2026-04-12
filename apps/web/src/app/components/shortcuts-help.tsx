'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Keyboard shortcuts cheat sheet. Opens when the user presses `?`
 * (Shift+/) anywhere outside of an input field — critical guard so
 * users can still type `?` in their notes and search boxes.
 *
 * Modal pattern: role="dialog" + aria-modal="true" + focus trap on
 * the close button + Escape closes + backdrop click closes.
 */

interface ShortcutEntry {
  combo: string[];
  action: string;
}

interface ShortcutSection {
  title: string;
  entries: ShortcutEntry[];
}

const SECTIONS: ShortcutSection[] = [
  {
    title: 'Navegação',
    entries: [
      { combo: ['Ctrl', 'K'], action: 'Abrir busca de comandos' },
      { combo: ['Ctrl', 'J'], action: 'Abrir assistente de IA' },
      { combo: ['?'], action: 'Mostrar este painel' },
      { combo: ['Esc'], action: 'Fechar diálogos' },
    ],
  },
  {
    title: 'Busca',
    entries: [
      { combo: ['/'], action: 'Focar busca da página atual' },
      { combo: ['Ctrl', 'F'], action: 'Busca local do navegador' },
    ],
  },
  {
    title: 'Edição',
    entries: [
      { combo: ['Ctrl', 'S'], action: 'Salvar formulário (quando aplicável)' },
      { combo: ['Ctrl', 'Enter'], action: 'Confirmar diálogo / enviar mensagem' },
    ],
  },
  {
    title: 'Visualização',
    entries: [
      { combo: ['Ctrl', ','], action: 'Configurações' },
      { combo: ['Ctrl', 'Shift', 'L'], action: 'Alternar tema (futuro)' },
    ],
  },
];

export function ShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Global ? handler — guarded against text inputs
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Escape closes the modal regardless
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        return;
      }
      // ? to open — but only if NOT inside a text input / textarea / contenteditable
      if (e.key === '?' && !isOpen) {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          (target as HTMLElement).isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setIsOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Focus close button when modal opens
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => closeButtonRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      aria-describedby="shortcuts-hint"
      className="fixed inset-0 z-[95] flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Fechar atalhos de teclado"
        onClick={() => setIsOpen(false)}
        className="absolute inset-0 bg-black/60 cursor-default"
      />
      <section className="relative w-full max-w-2xl bg-white border border-neutral-200 rounded-xl shadow-2xl text-neutral-900 max-h-[85vh] overflow-y-auto">
        <header className="flex items-start justify-between gap-4 p-5 border-b border-neutral-200">
          <div>
            <h2 id="shortcuts-title" className="text-lg font-bold text-neutral-900">
              Atalhos de teclado
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Pressione <kbd className="bg-neutral-50 border border-neutral-300 px-1.5 py-0.5 rounded text-neutral-900 text-[11px] font-mono">?</kbd>{' '}
              em qualquer lugar para abrir este painel.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Fechar"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-200"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs uppercase tracking-wider font-bold text-neutral-500 mb-3">
                {section.title}
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {section.entries.map((entry, idx) => (
                    <tr key={idx} className="border-b border-neutral-200 last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap align-top">
                        {entry.combo.map((key, kIdx) => (
                          <span key={kIdx}>
                            <kbd className="bg-neutral-50 border border-neutral-300 text-neutral-900 px-2 py-1 rounded text-xs font-mono">
                              {key}
                            </kbd>
                            {kIdx < entry.combo.length - 1 && (
                              <span className="text-neutral-500 mx-1">+</span>
                            )}
                          </span>
                        ))}
                      </td>
                      <td className="py-2 text-neutral-700">{entry.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <footer className="border-t border-neutral-200 px-5 py-3">
          <p id="shortcuts-hint" className="text-xs text-neutral-500">
            Todos os atalhos são processados apenas fora de campos de texto, então você ainda
            pode digitar normalmente em qualquer formulário.
          </p>
        </footer>
      </section>
    </div>
  );
}
