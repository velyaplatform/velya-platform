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
