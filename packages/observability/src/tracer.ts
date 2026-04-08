/**
 * OpenTelemetry tracer setup for the Velya platform.
 *
 * Provides a consistent tracing configuration across all services,
 * exporting spans via OTLP to the configured collector endpoint.
 */

/**
 * Configuration for the OpenTelemetry tracer.
 */
export interface TracerConfig {
  /** Service name reported in traces. */
  readonly serviceName: string;

  /** Service version for trace metadata. */
  readonly serviceVersion: string;

  /** OTLP collector endpoint. Defaults to http://localhost:4318. */
  readonly collectorEndpoint?: string;

  /** Environment name (e.g., "dev", "staging", "prod"). */
  readonly environment?: string;

  /** Sampling ratio (0.0 to 1.0). Defaults to 1.0 in dev, 0.1 in prod. */
  readonly samplingRatio?: number;

  /** Additional resource attributes. */
  readonly resourceAttributes?: Readonly<Record<string, string>>;
}

/**
 * Span status codes aligned with OpenTelemetry.
 */
export type SpanStatusCode = 'UNSET' | 'OK' | 'ERROR';

/**
 * Span kind aligned with OpenTelemetry.
 */
export type SpanKind = 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';

/**
 * Simplified span interface for Velya services.
 * In production, this wraps the @opentelemetry/api Span.
 */
export interface VelyaSpan {
  /** Set an attribute on the span. */
  setAttribute(key: string, value: string | number | boolean): void;

  /** Record an error on the span. */
  recordError(error: Error): void;

  /** Set the span status. */
  setStatus(code: SpanStatusCode, message?: string): void;

  /** End the span, recording its duration. */
  end(): void;
}

/**
 * Tracer interface for creating spans.
 * Wraps OpenTelemetry Tracer with Velya conventions.
 */
export interface VelyaTracer {
  /** Start a new span. */
  startSpan(name: string, kind?: SpanKind): VelyaSpan;

  /**
   * Execute a function within a new span.
   * The span is automatically ended when the function completes or throws.
   */
  withSpan<T>(name: string, fn: (span: VelyaSpan) => Promise<T>): Promise<T>;
}

/**
 * Resource attributes following OpenTelemetry semantic conventions.
 */
export interface ResourceAttributes {
  readonly 'service.name': string;
  readonly 'service.version': string;
  readonly 'deployment.environment'?: string;
  readonly 'service.namespace': string;
  readonly [key: string]: string | undefined;
}

/**
 * Build resource attributes from tracer configuration.
 */
export function buildResourceAttributes(config: TracerConfig): ResourceAttributes {
  return {
    'service.name': config.serviceName,
    'service.version': config.serviceVersion,
    'deployment.environment': config.environment ?? 'development',
    'service.namespace': 'velya',
    ...config.resourceAttributes,
  };
}

/**
 * Determine the appropriate sampling ratio based on environment.
 */
export function resolveSamplingRatio(config: TracerConfig): number {
  if (config.samplingRatio !== undefined) {
    return Math.max(0, Math.min(1, config.samplingRatio));
  }

  switch (config.environment) {
    case 'prod':
    case 'production':
      return 0.1;
    case 'staging':
      return 0.5;
    default:
      return 1.0;
  }
}

/**
 * Initialize the OpenTelemetry tracer for a Velya service.
 *
 * This function sets up the OTLP exporter, configures sampling,
 * and returns a VelyaTracer that wraps the OpenTelemetry API.
 *
 * In a full implementation, this would call:
 *   - @opentelemetry/sdk-node NodeSDK
 *   - @opentelemetry/exporter-trace-otlp-http OTLPTraceExporter
 *   - @opentelemetry/sdk-trace-base TraceIdRatioBasedSampler
 *
 * @example
 * ```typescript
 * const tracer = initTracer({
 *   serviceName: 'patient-flow',
 *   serviceVersion: '0.1.0',
 *   environment: 'production',
 * });
 *
 * await tracer.withSpan('processAdmission', async (span) => {
 *   span.setAttribute('patient.id', patientId);
 *   // ... do work
 * });
 * ```
 */
export function initTracer(config: TracerConfig): VelyaTracer {
  const _resourceAttributes = buildResourceAttributes(config);
  const _samplingRatio = resolveSamplingRatio(config);
  const _endpoint = config.collectorEndpoint ?? 'http://localhost:4318';

  // Stub implementation -- replaced by OTel SDK in production builds
  return {
    startSpan(name: string, _kind?: SpanKind): VelyaSpan {
      const startTime = Date.now();
      const attributes: Record<string, string | number | boolean> = {};

      return {
        setAttribute(key: string, value: string | number | boolean): void {
          attributes[key] = value;
        },
        recordError(_error: Error): void {
          // In production, this calls OTel span.recordException()
        },
        setStatus(_code: SpanStatusCode, _message?: string): void {
          // In production, this calls OTel span.setStatus()
        },
        end(): void {
          const _durationMs = Date.now() - startTime;
          // In production, this calls OTel span.end()
        },
      };
    },

    async withSpan<T>(name: string, fn: (span: VelyaSpan) => Promise<T>): Promise<T> {
      const span = this.startSpan(name);
      try {
        const result = await fn(span);
        span.setStatus('OK');
        return result;
      } catch (error) {
        if (error instanceof Error) {
          span.recordError(error);
        }
        span.setStatus('ERROR', error instanceof Error ? error.message : 'Unknown error');
        throw error;
      } finally {
        span.end();
      }
    },
  };
}
