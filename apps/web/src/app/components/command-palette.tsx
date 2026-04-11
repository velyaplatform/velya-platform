'use client';

import * as React from 'react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { MODULES, CATEGORY_LABELS, type ModuleCategory } from '../../lib/module-manifest';

/**
 * Global Command Palette
 *
 * Power-user navigation for the Velya hospital web app. Opens with Cmd+K
 * (Mac) or Ctrl+K (Linux/Windows). Fuzzy-searches every registered module
 * from the manifest plus a set of high-value quick actions.
 *
 * Healthcare UX research identifies command palettes as a top-priority
 * pattern for clinical efficiency — a single keyboard gesture replaces
 * multi-click navigation paths across deep module trees.
 */

type CommandKind = 'module' | 'action';

interface PaletteCommand {
  id: string;
  kind: CommandKind;
  title: string;
  subtitle: string;
  category: string;
  icon: string;
  /** Execute the command. Receives router-like navigation helpers. */
  run: () => void;
}

interface ScoredCommand {
  command: PaletteCommand;
  score: number;
}

/** Match weights — higher is better. */
const SCORE_TITLE_PREFIX = 1000;
const SCORE_TITLE_CONTAINS = 500;
const SCORE_SUBTITLE_CONTAINS = 200;
const SCORE_CATEGORY_CONTAINS = 100;

/** Normalize text for case-insensitive, accent-insensitive comparison. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Score a command against a query. Every whitespace-delimited token must
 * appear as a substring somewhere in the command's searchable text —
 * otherwise the command is excluded (score 0). The final score is the
 * best category bucket the query hits for the title field, plus smaller
 * bonuses for subtitle and category matches.
 */
function scoreCommand(command: PaletteCommand, query: string): number {
  const normalizedQuery = normalize(query).trim();
  if (normalizedQuery.length === 0) {
    return 1; // any positive score — unfiltered list
  }

  const title = normalize(command.title);
  const subtitle = normalize(command.subtitle);
  const category = normalize(command.category);
  const haystack = `${title} ${subtitle} ${category}`;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (!haystack.includes(token)) {
      return 0;
    }
  }

  // Rank by the strongest single signal the full query produces.
  if (title.startsWith(normalizedQuery)) {
    return SCORE_TITLE_PREFIX;
  }
  if (title.includes(normalizedQuery)) {
    return SCORE_TITLE_CONTAINS;
  }
  if (subtitle.includes(normalizedQuery)) {
    return SCORE_SUBTITLE_CONTAINS;
  }
  if (category.includes(normalizedQuery)) {
    return SCORE_CATEGORY_CONTAINS;
  }
  // All tokens matched individually but no contiguous hit — still useful.
  return 10;
}

export function CommandPalette(): React.ReactElement {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const inputLabelId = useId();

  const openPalette = useCallback((): void => {
    previouslyFocusedElementRef.current =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const closePalette = useCallback((): void => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
    // Restore focus to the element that opened the palette when possible.
    const previouslyFocused = previouslyFocusedElementRef.current;
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  }, []);

  // Build the command list once per open (MODULES is a stable import).
  const allCommands = useMemo<PaletteCommand[]>(() => {
    const moduleCommands: PaletteCommand[] = MODULES.map((moduleDef) => {
      const categoryKey = moduleDef.category as ModuleCategory;
      const categoryLabel = CATEGORY_LABELS[categoryKey] ?? moduleDef.category;
      return {
        id: `module:${moduleDef.id}`,
        kind: 'module' as const,
        title: moduleDef.title,
        subtitle: moduleDef.subtitle,
        category: categoryLabel,
        icon: moduleDef.icon,
        run: () => {
          router.push(moduleDef.route);
        },
      };
    });

    const quickActions: PaletteCommand[] = [
      {
        id: 'action:staff-on-duty',
        kind: 'action',
        title: 'Ver equipe em plantão',
        subtitle: 'Escala ativa, responsáveis por plantão e contatos',
        category: 'Ação rápida',
        icon: '\uD83D\uDC65',
        run: () => {
          router.push('/staff-on-duty');
        },
      },
      {
        id: 'action:critical-alerts',
        kind: 'action',
        title: 'Ver alertas críticos',
        subtitle: 'Alertas clínicos e operacionais de alta prioridade',
        category: 'Ação rápida',
        icon: '\uD83D\uDEA8',
        run: () => {
          router.push('/alerts?severity=critical');
        },
      },
      {
        id: 'action:open-mrn',
        kind: 'action',
        title: 'Abrir prontuário por MRN',
        subtitle: 'Digite o número do prontuário para abrir o paciente',
        category: 'Ação rápida',
        icon: '\uD83D\uDCCB',
        run: () => {
          if (typeof window === 'undefined') {
            return;
          }
          const answer = window.prompt('Digite o MRN do paciente:');
          if (!answer) {
            return;
          }
          const trimmed = answer.trim();
          if (trimmed.length === 0) {
            return;
          }
          router.push(`/patients/${encodeURIComponent(trimmed)}`);
        },
      },
      {
        id: 'action:logout',
        kind: 'action',
        title: 'Sair',
        subtitle: 'Encerrar sessão e voltar à tela de login',
        category: 'Ação rápida',
        icon: '\uD83D\uDEAA',
        run: () => {
          router.push('/login');
        },
      },
    ];

    return [...moduleCommands, ...quickActions];
  }, [router]);

  const filteredCommands = useMemo<PaletteCommand[]>(() => {
    const scored: ScoredCommand[] = [];
    for (const command of allCommands) {
      const score = scoreCommand(command, query);
      if (score > 0) {
        scored.push({ command, score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((entry) => entry.command);
  }, [allCommands, query]);

  // Global keyboard listener — opens palette, closes on Escape.
  useEffect(() => {
    function handleGlobalKeyDown(event: globalThis.KeyboardEvent): void {
      const isPaletteShortcut =
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        (event.key === 'k' || event.key === 'K');

      if (isPaletteShortcut) {
        event.preventDefault();
        if (isOpen) {
          closePalette();
        } else {
          openPalette();
        }
        return;
      }

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        closePalette();
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen, openPalette, closePalette]);

  // Focus trap: when the palette opens, move focus to the input.
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selection when the result set changes.
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll the selected item into view as the user navigates.
  useEffect(() => {
    if (!isOpen || !listRef.current) {
      return;
    }
    const listElement = listRef.current;
    const selectedElement = listElement.querySelector<HTMLElement>(
      `[data-command-index="${selectedIndex}"]`,
    );
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen, filteredCommands.length]);

  const executeCommand = useCallback(
    (command: PaletteCommand): void => {
      closePalette();
      // Defer execution so the modal is fully unmounted before navigation
      // (especially important for window.prompt on the MRN action).
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          command.run();
        }, 0);
      } else {
        command.run();
      }
    },
    [closePalette],
  );

  const handleInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>): void => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((current) => {
          if (filteredCommands.length === 0) {
            return 0;
          }
          return (current + 1) % filteredCommands.length;
        });
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) => {
          if (filteredCommands.length === 0) {
            return 0;
          }
          return (current - 1 + filteredCommands.length) % filteredCommands.length;
        });
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const command = filteredCommands[selectedIndex];
        if (command) {
          executeCommand(command);
        }
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setSelectedIndex(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        setSelectedIndex(Math.max(0, filteredCommands.length - 1));
      }
    },
    [filteredCommands, selectedIndex, executeCommand],
  );

  const handleBackdropMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>): void => {
      // Close only when the click starts on the backdrop itself, not on
      // the dialog content.
      if (event.target === event.currentTarget) {
        closePalette();
      }
    },
    [closePalette],
  );

  // Discoverability hint — small floating button visible when the palette
  // is closed. Research shows most users do not know command palettes
  // exist, so a persistent affordance is critical.
  const triggerButton = !isOpen ? (
    // Command-palette's visual FAB is redundant — the dark header already
    // exposes the "Type / to search" button that opens the same overlay,
    // and the Cmd+K / Ctrl+K keybinding still works from anywhere. Keeping
    // it also duplicated on the bottom-right caused a field-over-field
    // overlap with the action column of dense tables (patients, tasks).
    // Render null so the palette is only reachable via the header and the
    // keyboard, matching the github.com pattern.
    null
  ) : null;

  if (!isOpen) {
    return <>{triggerButton}</>;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-white/70 px-4 pt-[10vh] backdrop-blur-sm"
        onMouseDown={handleBackdropMouseDown}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          aria-describedby={dialogDescriptionId}
          className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl shadow-black/60"
        >
          <h2 id={dialogTitleId} className="sr-only">
            Paleta de comandos Velya
          </h2>
          <p id={dialogDescriptionId} className="sr-only">
            Pesquise módulos e ações rápidas do hospital. Use as setas para
            navegar, Enter para abrir e Escape para fechar.
          </p>

          <div className="border-b border-slate-200 px-4 py-3">
            <label id={inputLabelId} htmlFor="velya-command-palette-input" className="sr-only">
              Pesquisar módulos e ações
            </label>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="text-slate-600">
                {/* Search glyph — unicode keeps us dependency-free */}
                {'\uD83D\uDD0D'}
              </span>
              <input
                id="velya-command-palette-input"
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls="velya-command-palette-list"
                aria-activedescendant={
                  filteredCommands[selectedIndex]
                    ? `velya-command-option-${selectedIndex}`
                    : undefined
                }
                aria-labelledby={inputLabelId}
                autoComplete="off"
                spellCheck={false}
                placeholder="Buscar módulos, pacientes, ações..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                className="min-h-[44px] w-full bg-transparent text-base text-slate-900 placeholder:text-slate-500 focus:outline-none"
              />
              <kbd className="hidden shrink-0 rounded border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700 sm:inline-block">
                esc
              </kbd>
            </div>
          </div>

          <ul
            id="velya-command-palette-list"
            ref={listRef}
            role="listbox"
            aria-label="Resultados da busca"
            className="max-h-[60vh] overflow-y-auto py-2"
          >
            {filteredCommands.length === 0 ? (
              <li
                role="option"
                aria-selected="false"
                aria-disabled="true"
                className="px-4 py-6 text-center text-sm text-slate-600"
              >
                Nenhum resultado para "{query}"
              </li>
            ) : (
              filteredCommands.map((command, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <li
                    key={command.id}
                    id={`velya-command-option-${index}`}
                    data-command-index={index}
                    role="option"
                    aria-selected={isSelected}
                    className={`mx-2 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                      isSelected
                        ? 'bg-blue-700/40 text-white'
                        : 'text-slate-900 hover:bg-slate-50'
                    }`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onMouseDown={(event) => {
                      // Prevent input blur before click handler fires.
                      event.preventDefault();
                    }}
                    onClick={() => executeCommand(command)}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-base"
                    >
                      {command.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {command.title}
                      </span>
                      <span className="block truncate text-xs text-slate-600">
                        {command.subtitle}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-blue-700">
                      {command.category}
                    </span>
                  </li>
                );
              })
            )}
          </ul>

          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
            <span>
              {filteredCommands.length}{' '}
              {filteredCommands.length === 1 ? 'resultado' : 'resultados'}
            </span>
            <span aria-hidden="true">↑↓ navegar · ↵ abrir · esc fechar</span>
            <span className="sr-only">
              Use as setas para cima e para baixo para navegar, Enter para
              abrir e Escape para fechar.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default CommandPalette;
