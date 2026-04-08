/**
 * OpenTelemetry tracer factory for the Velya platform.
 *
 * Provides a consistent tracer configuration across all services,
 * with NATS and HTTP auto-instrumentation support.
 */

/**
 * Span status codes aligned with OpenTelemetry specification.
 */
export type SpanStatusCode = 'unset' | 'ok' | 'error';

/**
 * Span kind indicates the relationship of the span to its parent and children.
 */
export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';

/**
 * Configuration for the OpenTelemetry tracer.
 */
export interface TracerConfig {
  /** Service name reported to the collector. */
  readonly serviceName: string;

  /** Service version for resource attribution. */
  readonly serviceVersion: string;

  /** OpenTelemetry collector endpoint. */
  readonly collectorEndpoint: string;

  /** Export protocol. */
  readonly exportProtocol: ExportProtocol;

  /** Sampling ratio (0.0 to 1.0). 1.0 = trace everything. */
  readonly samplingRatio: number;

  /** Environment for resource attribution. */
  readonly environment: string;

  /** Additional resource attributes. */
  readonly resourceAttributes?: Readonly<Record<string, string>>;
}

export type ExportProtocol = 'grpc' | 'http/protobuf' | 'http/json';

/**
 * Lightweight span representation for tracing context propagation.
 */
export interface SpanContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: number;
  readonly traceState: string;
}

/**
 * Span attribute types accepted by OpenTelemetry.
 */
export type SpanAttributeValue = string | number | boolean | ReadonlyArray<string>;

/**
 * A recorded span representing a unit of work.
 */
export interface RecordedSpan {
  readonly name: string;
  readonly kind: SpanKind;
  readonly context: SpanContext;
  readonly parentSpanId: string | null;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly durationMs: number;
  readonly status: SpanStatusCode;
  readonly attributes: Readonly<Record<string, SpanAttributeValue>>;
  readonly events: ReadonlyArray<SpanEvent>;
}

/**
 * A timestamped event within a span.
 */
export interface SpanEvent {
  readonly name: string;
  readonly timestampMs: number;
  readonly attributes: Readonly<Record<string, SpanAttributeValue>>;
}

/**
 * Span builder for creating and managing trace spans.
 */
export class SpanBuilder {
  private readonly spanName: string;
  private readonly kind: SpanKind;
  private readonly context: SpanContext;
  private readonly parentSpanId: string | null;
  private readonly startTimeMs: number;
  private readonly attributes: Record<string, SpanAttributeValue> = {};
  private readonly events: SpanEvent[] = [];
  private status: SpanStatusCode = 'unset';

  constructor(name: string, kind: SpanKind, parentSpanId?: string) {
    this.spanName = name;
    this.kind = kind;
    this.parentSpanId = parentSpanId ?? null;
    this.startTimeMs = Date.now();
    this.context = {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      traceFlags: 1,
      traceState: '',
    };
  }

  /**
   * Set an attribute on the span.
   */
  setAttribute(key: string, value: SpanAttributeValue): this {
    this.attributes[key] = value;
    return this;
  }

  /**
   * Set multiple attributes at once.
   */
  setAttributes(attributes: Record<string, SpanAttributeValue>): this {
    for (const [key, value] of Object.entries(attributes)) {
      this.attributes[key] = value;
    }
    return this;
  }

  /**
   * Record an event (log) within the span.
   */
  addEvent(name: string, attributes?: Record<string, SpanAttributeValue>): this {
    this.events.push({
      name,
      timestampMs: Date.now(),
      attributes: attributes ?? {},
    });
    return this;
  }

  /**
   * Set the span status to OK.
   */
  setOk(): this {
    this.status = 'ok';
    return this;
  }

  /**
   * Set the span status to error with an optional message.
   */
  setError(message?: string): this {
    this.status = 'error';
    if (message) {
      this.setAttribute('error.message', message);
    }
    return this;
  }

  /**
   * Record an exception on the span.
   */
  recordException(error: Error): this {
    this.status = 'error';
    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack ?? '',
    });
    return this;
  }

  /**
   * End the span and return the recorded data.
   */
  end(): RecordedSpan {
    const endTimeMs = Date.now();
    return {
      name: this.spanName,
      kind: this.kind,
      context: this.context,
      parentSpanId: this.parentSpanId,
      startTimeMs: this.startTimeMs,
      endTimeMs,
      durationMs: endTimeMs - this.startTimeMs,
      status: this.status === 'unset' ? 'ok' : this.status,
      attributes: { ...this.attributes },
      events: [...this.events],
    };
  }

  /**
   * Get the span context for propagation to child spans.
   */
  getContext(): SpanContext {
    return this.context;
  }
}

/**
 * Tracer that creates and manages spans for a specific service.
 */
export class Tracer {
  private readonly config: TracerConfig;
  private readonly exportBuffer: RecordedSpan[] = [];
  private readonly maxBufferSize: number;

  constructor(config: TracerConfig, maxBufferSize: number = 100) {
    this.config = config;
    this.maxBufferSize = maxBufferSize;
  }

  /**
   * Start a new span for tracing an operation.
   */
  startSpan(name: string, kind: SpanKind = 'internal', parentSpanId?: string): SpanBuilder {
    const span = new SpanBuilder(name, kind, parentSpanId);
    span.setAttributes({
      'service.name': this.config.serviceName,
      'service.version': this.config.serviceVersion,
      'deployment.environment': this.config.environment,
    });

    if (this.config.resourceAttributes) {
      span.setAttributes(this.config.resourceAttributes);
    }

    return span;
  }

  /**
   * Trace an async function, automatically creating a span around it.
   * Records duration and exceptions.
   */
  async trace<T>(
    name: string,
    kind: SpanKind,
    fn: (span: SpanBuilder) => Promise<T>,
    parentSpanId?: string,
  ): Promise<T> {
    const span = this.startSpan(name, kind, parentSpanId);
    try {
      const result = await fn(span);
      span.setOk();
      return result;
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
      } else {
        span.setError(String(error));
      }
      throw error;
    } finally {
      this.recordSpan(span.end());
    }
  }

  /**
   * Record a completed span for export.
   */
  recordSpan(span: RecordedSpan): void {
    if (!this.shouldSample()) return;

    this.exportBuffer.push(span);

    if (this.exportBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Flush buffered spans to the collector.
   * Returns the flushed spans for testing and inspection.
   */
  flush(): ReadonlyArray<RecordedSpan> {
    const spans = [...this.exportBuffer];
    this.exportBuffer.length = 0;
    // In a real implementation, this would send to the OTel collector
    // via the configured protocol (gRPC or HTTP).
    return spans;
  }

  /**
   * Get the tracer configuration.
   */
  getConfig(): TracerConfig {
    return this.config;
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.samplingRatio;
  }
}

/**
 * Create a tracer with sensible defaults for a Velya service.
 */
export function createTracer(
  serviceName: string,
  serviceVersion: string = '0.0.0',
): Tracer {
  const config: TracerConfig = {
    serviceName,
    serviceVersion,
    collectorEndpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4317',
    exportProtocol: (process.env['OTEL_EXPORTER_OTLP_PROTOCOL'] as ExportProtocol) ?? 'grpc',
    samplingRatio: parseFloat(process.env['OTEL_TRACES_SAMPLER_ARG'] ?? '1.0'),
    environment: process.env['VELYA_ENVIRONMENT'] ?? 'development',
    resourceAttributes: {
      'service.namespace': 'velya',
    },
  };

  return new Tracer(config);
}

/**
 * Generate a 32-character hex trace ID.
 */
function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a 16-character hex span ID.
 */
function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
