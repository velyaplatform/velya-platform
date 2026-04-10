import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { audit } from '@/lib/audit-logger';

/**
 * POST /api/nav-telemetry
 *
 * Persists a single nav.* event in the global audit log. Body shape comes
 * from `lib/use-nav-telemetry.ts`. The endpoint is best-effort:
 *   - Returns 204 on success
 *   - Returns 401 silently when there's no session (the client ignores)
 *   - Never throws — wraps all parsing in try/catch
 *
 * Reference: docs/architecture/navigation-contextual.md section 13.
 */

const ALLOWED_TYPES = new Set([
  'nav.click',
  'nav.search',
  'nav.filter-apply',
  'nav.deeplink-shared',
  'nav.command-palette-open',
  'nav.command-palette-execute',
  'nav.recents-jump',
  'nav.favorite-toggle',
  'nav.error-boundary-triggered',
]);

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const type = String(body.type ?? '');
  if (!ALLOWED_TYPES.has(type)) {
    return new NextResponse(null, { status: 400 });
  }

  // Strip the type field and use the rest as details
  const details = { ...body };
  delete (details as { type?: unknown }).type;

  audit({
    category: 'frontend',
    action: type,
    description: `Navegação: ${type}`,
    actor: session.email || session.userName || session.userId,
    resource: typeof details.toRoute === 'string' ? details.toRoute : type,
    result: 'info',
    details,
  });

  return new NextResponse(null, { status: 204 });
}
