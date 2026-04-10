import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Security headers — defense in depth
// ---------------------------------------------------------------------------

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP_DIRECTIVES,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
  'X-DNS-Prefetch-Control': 'off',
  'X-Permitted-Cross-Domain-Policies': 'none',
  Server: 'velya',
};

// ---------------------------------------------------------------------------
// Token-bucket rate limiter (in-memory, per replica)
// ---------------------------------------------------------------------------

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}
const BUCKETS = new Map<string, Bucket>();

function takeToken(
  key: string,
  capacity: number,
  refillPerSec: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  let bucket = BUCKETS.get(key);
  if (!bucket) {
    bucket = { tokens: capacity, lastRefillMs: now };
    BUCKETS.set(key, bucket);
  }
  const elapsedSec = (now - bucket.lastRefillMs) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
  bucket.lastRefillMs = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfterSec: 0 };
  }
  const needed = 1 - bucket.tokens;
  const retryAfterSec = Math.max(1, Math.ceil(needed / refillPerSec));
  return { allowed: false, retryAfterSec };
}

const RATE_LIMIT_API = { capacity: 60, refillPerSec: 1 };
const RATE_LIMIT_AUTH = { capacity: 10, refillPerSec: 0.2 };
const RATE_LIMIT_AI = { capacity: 30, refillPerSec: 0.5 };

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(k, v);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const start = Date.now();
  const requestId = `req-${start}-${Math.random().toString(36).slice(2, 6)}`;
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Add request ID header for tracing
  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-velya-timestamp', new Date().toISOString());
  applySecurityHeaders(response);

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
      return applySecurityHeaders(
        NextResponse.json(
          { error: 'Nao autenticado. Faca login primeiro.', code: 'UNAUTHORIZED' },
          { status: 401 },
        ),
      );
    }
  }

  // --- Origin check for state-changing API calls (defense vs CSRF) ---
  if (
    path.startsWith('/api/') &&
    (request.method === 'POST' ||
      request.method === 'PUT' ||
      request.method === 'PATCH' ||
      request.method === 'DELETE')
  ) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return applySecurityHeaders(
            NextResponse.json(
              { error: 'Origin mismatch', code: 'CSRF_BLOCKED' },
              { status: 403 },
            ),
          );
        }
      } catch {
        return applySecurityHeaders(
          NextResponse.json(
            { error: 'Invalid origin', code: 'CSRF_BLOCKED' },
            { status: 403 },
          ),
        );
      }
    }
  }

  // --- Per-IP rate limit on /api/* (different bucket for /auth and /ai) ---
  if (path.startsWith('/api/') && path !== '/api/health') {
    const isAuth = path.startsWith('/api/auth/');
    const isAi = path.startsWith('/api/ai/');
    const limit = isAuth ? RATE_LIMIT_AUTH : isAi ? RATE_LIMIT_AI : RATE_LIMIT_API;
    const bucketKey = `${ip}:${isAuth ? 'auth' : isAi ? 'ai' : 'api'}`;
    const result = takeToken(bucketKey, limit.capacity, limit.refillPerSec);
    if (!result.allowed) {
      const r = applySecurityHeaders(
        NextResponse.json(
          {
            error: 'Limite de requisições atingido',
            code: 'RATE_LIMITED',
            retryAfterSec: result.retryAfterSec,
          },
          { status: 429 },
        ),
      );
      r.headers.set('Retry-After', String(result.retryAfterSec));
      return r;
    }
  }

  // Only audit meaningful requests (skip static assets)
  if (!path.startsWith('/_next/') && !path.includes('.') && path !== '/favicon.ico') {
    // Use edge-compatible logging (can't use fs in middleware)
    // This will be picked up by the container log aggregator
    console.log(
      JSON.stringify({
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
      }),
    );
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
