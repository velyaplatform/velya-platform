import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const start = Date.now();
  const requestId = `req-${start}-${Math.random().toString(36).slice(2, 6)}`;

  // Add request ID header for tracing
  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-velya-timestamp', new Date().toISOString());

  // Log to audit via structured console output (fire-and-forget for non-blocking)
  // The actual audit happens in the API routes themselves for accurate status codes
  // This middleware ensures we capture page navigations and static requests too

  const path = request.nextUrl.pathname;

  // --- Public pages: login, register, verify ---
  const publicPages = ['/login', '/register', '/verify'];
  const isPublicPage = publicPages.some((p) => path === p || path.startsWith(p + '/'));

  // --- Page-level auth enforcement ---
  // If the request is for a page (not API, not static), check for session cookie.
  // If not authenticated, redirect to /login.
  if (
    !isPublicPage &&
    !path.startsWith('/api/') &&
    !path.startsWith('/_next/') &&
    !path.includes('.') &&
    path !== '/favicon.ico'
  ) {
    const sessionCookie = request.cookies.get('velya_session');
    if (!sessionCookie) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- Auth enforcement for API routes ---
  // Public routes: /api/auth/* (login, logout, session check) and /api/health
  // All other API routes require a valid session cookie.
  if (path.startsWith('/api/') && !path.startsWith('/api/auth/') && path !== '/api/health') {
    const sessionCookie = request.cookies.get('velya_session');
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Nao autenticado. Faca login primeiro.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
  }

  // Only audit meaningful requests (skip static assets)
  if (!path.startsWith('/_next/') && !path.includes('.') && path !== '/favicon.ico') {
    // Use edge-compatible logging (can't use fs in middleware)
    // This will be picked up by the container log aggregator
    console.log(JSON.stringify({
      audit: true,
      level: 'info',
      service: 'velya-web',
      event: 'http_request',
      requestId,
      method: request.method,
      path,
      timestamp: new Date().toISOString(),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent')?.slice(0, 100) || 'unknown',
    }));
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
