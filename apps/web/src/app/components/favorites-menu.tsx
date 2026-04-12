'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useFavorites, type FavoriteEntry } from './use-favorites';

/**
 * Topbar dropdown showing favorites grouped by scope. Mounted next to
 * PatientQuickSwitcher in the AppShell. Closes on outside click and Escape.
 *
 * The store covers all scopes (patients, modules, reports, etc.) — the
 * dropdown groups items by scope label so the user can scan them quickly.
 */

const SCOPE_LABELS: Record<string, string> = {
  patients: 'Pacientes',
  prescriptions: 'Prescrições',
  'lab-orders': 'Ordens de Lab',
  'lab-results': 'Resultados de Lab',
  'imaging-orders': 'Ordens de Imagem',
  'imaging-results': 'Laudos',
  assets: 'Ativos',
  'work-orders': 'Manutenção',
  charges: 'Cobranças',
  claims: 'Contas',
  incidents: 'Incidentes',
  'medical-specialties': 'Especialidades',
  'hospital-wards': 'Alas',
  employees: 'Funcionários',
  suppliers: 'Fornecedores',
  modules: 'Módulos',
  reports: 'Relatórios',
};

function labelFor(scope: string): string {
  return SCOPE_LABELS[scope] ?? scope;
}

export function FavoritesMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { byScope, loading } = useFavorites('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const totalCount = Object.values(byScope).reduce((sum, list) => sum + list.length, 0);
  const scopeNames = Object.keys(byScope).filter((k) => byScope[k].length > 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Favoritos${totalCount > 0 ? ` (${totalCount})` : ''}`}
        className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-neutral-200"
      >
        Favoritos
        {totalCount > 0 && (
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-neutral-900 text-white text-[10px] font-bold"
          >
            {totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Favoritos"
          className="absolute right-0 mt-2 w-96 bg-white border border-neutral-200 rounded-xl shadow-2xl z-50 p-3 max-h-[480px] overflow-y-auto"
        >
          {loading && <p className="text-sm text-neutral-500 py-3 text-center">Carregando...</p>}
          {!loading && totalCount === 0 && (
            <p className="text-sm text-neutral-500 text-center py-6 px-3">
              Nenhum favorito ainda. Clique no marcador em
              qualquer página de detalhe para adicionar.
            </p>
          )}
          {!loading && scopeNames.length > 0 && (
            <div className="flex flex-col gap-3">
              {scopeNames.map((scope) => (
                <ScopeGroup key={scope} scope={scope} items={byScope[scope]} onNavigate={() => setIsOpen(false)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScopeGroup({
  scope,
  items,
  onNavigate,
}: {
  scope: string;
  items: FavoriteEntry[];
  onNavigate: () => void;
}) {
  return (
    <section aria-labelledby={`fav-${scope}-heading`}>
      <h3
        id={`fav-${scope}-heading`}
        className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 mb-1.5"
      >
        {labelFor(scope)} ({items.length})
      </h3>
      <ul className="flex flex-col gap-1" role="none">
        {items.map((entry) => (
          <li key={entry.id} role="none">
            {entry.href ? (
              <Link
                href={entry.href}
                role="menuitem"
                onClick={onNavigate}
                className="block min-h-[44px] px-3 py-2 rounded-md hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-neutral-700">{entry.id}</span>
                  <span className="text-sm text-neutral-900 font-semibold truncate">
                    {entry.label}
                  </span>
                </div>
                {entry.description && (
                  <div className="text-xs text-neutral-500 truncate">{entry.description}</div>
                )}
              </Link>
            ) : (
              <div className="px-3 py-2 text-sm text-neutral-700">{entry.label}</div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
