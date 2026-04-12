'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Related items context panel.
 *
 * Place this on any detail or edit page. It calls /api/related/[type]/[id]
 * and renders all the connected entities grouped by module, with a link to
 * each filtered list and a sample of up to 5 records.
 *
 * Example:
 *   <RelatedItems entityType="patient" entityId="MRN-EXAMPLE" />
 *
 * Inside a patient detail page, this surfaces:
 *   - 4 prescriptions
 *   - 7 lab orders
 *   - 2 imaging orders
 *   - 12 charges
 *   - 3 audit events
 *
 * Each group has a "Ver todos" link to the filtered list.
 */

interface RelatedSampleEntry {
  id: string;
  label: string;
  href: string;
}

interface RelatedGroup {
  module: string;
  label: string;
  href: string;
  count: number;
  sample: RelatedSampleEntry[];
}

interface RelatedResponse {
  type: string;
  id: string;
  groups: RelatedGroup[];
}

interface RelatedItemsProps {
  entityType: string;
  entityId: string;
  /** Optional title override for the section */
  title?: string;
  /** Optional className for the outer section */
  className?: string;
}

export function RelatedItems({
  entityType,
  entityId,
  title = 'Relacionados',
  className,
}: RelatedItemsProps) {
  const [data, setData] = useState<RelatedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityType || !entityId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/related/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`, {
      credentials: 'same-origin',
    })
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setError(`Erro ${res.status}`);
          return;
        }
        const json = (await res.json()) as RelatedResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Erro de rede');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  return (
    <section
      aria-labelledby={`related-${entityType}-${entityId}-heading`}
      className={`bg-white border border-neutral-200 rounded-xl p-5 ${className ?? ''}`}
    >
      <h2
        id={`related-${entityType}-${entityId}-heading`}
        className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-3 flex items-center gap-2"
      >
        {title}
      </h2>

      {loading && <p className="text-sm text-neutral-500">Carregando relacionados...</p>}
      {error && (
        <p role="alert" className="text-sm text-neutral-900">
          {error}
        </p>
      )}
      {!loading && !error && data && data.groups.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nenhum item conectado a este registro ainda.
        </p>
      )}
      {!loading && !error && data && data.groups.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.groups.map((group) => (
            <li key={group.module}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-sm font-bold text-neutral-900">
                  {group.label}{' '}
                  <span className="text-xs text-neutral-500 font-normal">({group.count})</span>
                </h3>
                <Link
                  href={group.href}
                  className="text-xs text-neutral-900 hover:text-neutral-700 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-neutral-200 rounded"
                >
                  Ver todos →
                </Link>
              </div>
              <ul className="flex flex-col gap-1">
                {group.sample.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={entry.href}
                      className="block px-3 py-2 text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-md hover:bg-neutral-100 hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                    >
                      <span className="font-mono text-neutral-700 mr-2">{entry.id}</span>
                      <span className="truncate">{entry.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
