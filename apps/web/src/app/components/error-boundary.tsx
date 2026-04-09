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
      } catch {}
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '50vh', padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Erro Inesperado
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', maxWidth: '400px' }}>
            Um erro foi detectado e registrado automaticamente. A equipe será notificada.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '1.5rem', fontFamily: 'monospace' }}>
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
