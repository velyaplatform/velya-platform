'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to backend — guaranteed delivery
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'frontend-error-boundary',
        severity: 'critical',
        timestamp: new Date().toISOString(),
        data: {
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: typeof window !== 'undefined' ? window.location.href : 'unknown',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        },
      }),
    }).catch(() => {
      // If fetch fails, store in localStorage for retry
      try {
        const pending = JSON.parse(localStorage.getItem('velya_pending_errors') || '[]');
        pending.push({
          source: 'frontend-error-boundary',
          severity: 'critical',
          timestamp: new Date().toISOString(),
          data: { message: error.message, stack: error.stack },
        });
        localStorage.setItem('velya_pending_errors', JSON.stringify(pending.slice(-50)));
      } catch { /* localStorage indisponivel */ }
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
          <div className="text-5xl mb-4">&#x26A0;&#xFE0F;</div>
          <h2 className="text-xl font-bold mb-2">
            Erro Inesperado
          </h2>
          <p className="text-[var(--text-secondary)] mb-4 max-w-[400px]">
            Um erro foi detectado e registrado automaticamente. A equipe sera notificada.
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mb-6 font-mono">
            {this.state.error?.message}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Tentar Novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
