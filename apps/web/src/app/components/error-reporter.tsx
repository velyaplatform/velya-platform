'use client';

import { useEffect } from 'react';

export function ErrorReporter() {
  useEffect(() => {
    // Report unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      reportError('unhandled-rejection', event.reason?.message || String(event.reason), event.reason?.stack);
    };

    // Report global errors
    const handleError = (event: ErrorEvent) => {
      reportError('global-error', event.message, event.error?.stack, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleError);

    // Retry pending errors from localStorage
    retryPendingErrors();

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}

function reportError(source: string, message: string, stack?: string, extra?: Record<string, unknown>) {
  fetch('/api/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: `frontend-${source}`,
      severity: 'high',
      timestamp: new Date().toISOString(),
      data: { message, stack, url: window.location.href, ...extra },
    }),
  }).catch(() => {
    try {
      const pending = JSON.parse(localStorage.getItem('velya_pending_errors') || '[]');
      pending.push({ source, message, timestamp: new Date().toISOString() });
      localStorage.setItem('velya_pending_errors', JSON.stringify(pending.slice(-50)));
    } catch {}
  });
}

function retryPendingErrors() {
  try {
    const pending = JSON.parse(localStorage.getItem('velya_pending_errors') || '[]');
    if (pending.length === 0) return;

    Promise.all(
      pending.map((err: Record<string, unknown>) =>
        fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...err, source: 'frontend-retry', severity: 'high', data: err }),
        }).catch(() => null)
      )
    ).then(() => {
      localStorage.removeItem('velya_pending_errors');
    });
  } catch {}
}
