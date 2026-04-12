'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import { Breadcrumbs } from '../components/breadcrumbs';

interface SearchHit {
  moduleId: string;
  moduleLabel: string;
  recordId: string;
  label: string;
  score: number;
  href: string;
}

interface SearchResponse {
  query: string;
  count: number;
  results: SearchHit[];
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initialQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Push query into URL
  useEffect(() => {
    const t = setTimeout(() => {
      const next = query.trim();
      router.replace(next ? `${pathname}?q=${encodeURIComponent(next)}` : pathname, {
        scroll: false,
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query, pathname, router]);

  // Fetch results
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(q)}`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          setError(`Erro ${res.status}`);
          return;
        }
        const data = (await res.json()) as SearchResponse;
        setResults(data.results);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError('Erro de rede');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query]);

  // Group results by module
  const grouped = results
    ? results.reduce<Record<string, { label: string; hits: SearchHit[] }>>((acc, hit) => {
        if (!acc[hit.moduleId]) acc[hit.moduleId] = { label: hit.moduleLabel, hits: [] };
        acc[hit.moduleId].hits.push(hit);
        return acc;
      }, {})
    : null;

  return (
    <AppShell pageTitle="Busca">
      <Breadcrumbs
        crumbs={[
          { label: 'Início', href: '/' },
          { label: 'Busca', current: true },
        ]}
      />
      <div className="page-header">
        <h1 className="page-title">
          Busca global
        </h1>
        <p className="page-subtitle">
          BM25 lexical + fuzzy n-gram (typo tolerance) sobre todos os registros do sistema
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-5 mb-5">
        <label htmlFor="search-input" className="sr-only">
          Buscar
        </label>
        <input
          id="search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="Digite paciente, medicamento, diagnostico, especialidade..."
          className="w-full min-h-[56px] bg-neutral-50 border-2 border-neutral-300 rounded-lg px-4 py-3 text-lg text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-400"
        />
        <p className="text-xs text-neutral-500 mt-2">
          Use <kbd className="bg-neutral-50 border border-neutral-300 px-1.5 py-0.5 rounded text-neutral-900 text-[11px] font-mono">Ctrl+K</kbd> para
          a busca de comandos -- digite mesmo com erros (a busca tolera typos)
        </p>
      </div>

      {error && (
        <div role="alert" className="bg-neutral-50 border border-neutral-300 text-neutral-900 rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading && <p className="text-neutral-500">Buscando...</p>}

      {!loading && results !== null && results.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <p className="text-neutral-500 text-sm">Nenhum resultado para "{query}".</p>
        </div>
      )}

      {!loading && grouped && Object.keys(grouped).length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-neutral-500">
            {results?.length} resultado(s) em {Object.keys(grouped).length} modulo(s)
          </p>
          {Object.entries(grouped).map(([moduleId, group]) => (
            <section
              key={moduleId}
              aria-labelledby={`group-${moduleId}-heading`}
              className="bg-white border border-neutral-200 rounded-xl p-5"
            >
              <h2
                id={`group-${moduleId}-heading`}
                className="text-sm font-bold text-neutral-900 mb-3"
              >
                {group.label}{' '}
                <span className="text-xs text-neutral-500 font-normal">({group.hits.length})</span>
              </h2>
              <ul className="flex flex-col gap-2">
                {group.hits.map((hit) => (
                  <li key={`${hit.moduleId}-${hit.recordId}`}>
                    <Link
                      href={hit.href}
                      className="block px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md hover:bg-neutral-100 hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xs text-neutral-700">{hit.recordId}</span>
                        <span className="text-sm text-neutral-900 font-semibold truncate">
                          {hit.label}
                        </span>
                        <span className="ml-auto text-[10px] text-neutral-500 font-mono">
                          score {hit.score.toFixed(2)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
