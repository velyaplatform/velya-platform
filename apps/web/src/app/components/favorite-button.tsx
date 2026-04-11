'use client';

import { useFavorites, type FavoriteEntry } from './use-favorites';

/**
 * Star toggle button. Drop into any detail page header to let the user
 * favorite/unfavorite the current entity. Calls /api/favorites under the
 * hood and reflects the state with a filled vs outline star.
 */

interface FavoriteButtonProps {
  scope: string;
  entry: Omit<FavoriteEntry, 'addedAt'>;
  /** Visible label override */
  label?: string;
  className?: string;
}

export function FavoriteButton({ scope, entry, label, className }: FavoriteButtonProps) {
  const { isFavorited, toggle } = useFavorites(scope);
  const fav = isFavorited(entry.id);
  return (
    <button
      type="button"
      onClick={() => void toggle(entry)}
      aria-pressed={fav}
      aria-label={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      title={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      className={`min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-amber-300 ${
        fav
          ? 'bg-amber-900/40 border-amber-600 text-amber-100 hover:bg-amber-900/60'
          : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-slate-100'
      } ${className ?? ''}`}
    >
      <span aria-hidden="true">{fav ? '\u2B50' : '\u2606'}</span>
      {label ?? (fav ? 'Favoritado' : 'Favoritar')}
    </button>
  );
}
