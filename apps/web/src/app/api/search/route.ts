import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { search, type SearchOptions } from '@/lib/semantic-search';

/**
 * GET /api/search?q=<query>&modules=<comma>&perModuleLimit=5&totalLimit=25
 *
 * BM25-ranked search across all modules. Local index built lazily and cached
 * for 5 minutes. Returns grouped results with module label, record id, label,
 * score, and href to the edit page.
 *
 * Reference: lib/semantic-search.ts
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';
  if (!q.trim()) {
    return NextResponse.json({ query: '', results: [], count: 0 });
  }
  const opts: SearchOptions = {
    perModuleLimit: parseInt(url.searchParams.get('perModuleLimit') ?? '5', 10),
    totalLimit: parseInt(url.searchParams.get('totalLimit') ?? '25', 10),
  };
  const modulesParam = url.searchParams.get('modules');
  if (modulesParam) {
    opts.moduleIds = modulesParam.split(',').filter(Boolean);
  }
  const results = search(q, opts);
  return NextResponse.json({
    query: q,
    count: results.length,
    results,
  });
}
