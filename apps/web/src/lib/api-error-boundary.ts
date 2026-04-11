import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { audit } from './audit-logger';

/**
 * API error boundary middleware.
 *
 * Why: today 87+ route handlers each re-implement try/catch with wildly
 * different response shapes (some silently `catch {}`, some leak stack
 * traces). This module gives every wrapped route a single point of capture
 * so that:
 *   - Every failure produces the same `ApiErrorEnvelope` shape.
 *   - Every response carries an `x-velya-trace-id` header for correlation
 *     between the client, the audit log, and downstream traces.
 *   - Stack traces stay in the audit log, never in the HTTP body.
 */

export interface ApiErrorEnvelope {
  error: string;
  code: string;
  traceId: string;
  retryable: boolean;
}

export type ApiHandler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse | Response>;

const RETRYABLE_HINTS = ['ECONN', 'ETIMEDOUT', 'fetch failed', 'timeout'];

/** Why: classify transient transport failures so the client can auto-retry safely. */
function isRetryable(message: string): boolean {
  const lower = message.toLowerCase();
  return RETRYABLE_HINTS.some((hint) => lower.includes(hint.toLowerCase()));
}

/**
 * Wrap a Next.js route handler with the Velya error boundary.
 *
 * Why: keeps handlers focused on happy-path logic — any uncaught throw is
 * converted to a sanitized 500 response plus an audit trail.
 */
export function withErrorBoundary(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, ctx?: unknown): Promise<NextResponse | Response> => {
    const traceId = randomUUID();
    try {
      const response = await handler(req, ctx);
      // Propagate traceId on success too, so the client can correlate.
      response.headers.set('x-velya-trace-id', traceId);
      return response;
    } catch (thrown) {
      const error = thrown instanceof Error ? thrown : new Error(String(thrown));
      const retryable = isRetryable(error.message);

      // Stack trace belongs ONLY in the audit log, never in the HTTP body.
      audit({
        category: 'api',
        action: 'api.error.boundary',
        description: `Uncaught error em ${req.method} ${req.nextUrl.pathname}: ${error.message}`,
        actor: 'system',
        resource: req.nextUrl.pathname,
        result: 'error',
        details: {
          traceId,
          errorName: error.name,
          errorMessage: error.message,
          stack: error.stack,
          retryable,
        },
        requestPath: req.nextUrl.pathname,
        requestMethod: req.method,
        statusCode: 500,
      });

      const envelope: ApiErrorEnvelope = {
        error: 'Erro interno do servidor',
        code: error.name || 'InternalError',
        traceId,
        retryable,
      };

      return NextResponse.json(envelope, {
        status: 500,
        headers: { 'x-velya-trace-id': traceId },
      });
    }
  };
}
