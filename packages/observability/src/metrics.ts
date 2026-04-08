/**
 * Common metrics for the Velya platform.
 *
 * Provides a standardized metrics interface that wraps OpenTelemetry
 * metrics API, exposing counters, histograms, and gauges for common
 * operational patterns across all services.
 */

/**
 * Configuration for the metrics collector.
 */
export interface MetricsConfig {
  /** Service name used as a metric label. */
  readonly serviceName: string;

  /** OTLP collector endpoint for metrics. Defaults to http://localhost:4318. */
  readonly collectorEndpoint?: string;

  /** Export interval in milliseconds. Defaults to 60000 (1 minute). */
  readonly exportIntervalMs?: number;

  /** Metric prefix applied to all metric names. */
  readonly prefix?: string;
}

/**
 * Counter metric that only goes up.
 */
export interface Counter {
  /** Increment the counter by 1 or a specified value. */
  add(value?: number, labels?: Readonly<Record<string, string>>): void;
}

/**
 * Histogram metric for recording distributions (e.g., request duration).
 */
export interface Histogram {
  /** Record a value in the histogram. */
  record(value: number, labels?: Readonly<Record<string, string>>): void;
}

/**
 * Gauge metric for recording a current value that can go up or down.
 */
export interface Gauge {
  /** Set the current gauge value. */
  set(value: number, labels?: Readonly<Record<string, string>>): void;
}

/**
 * Standard HTTP request metrics.
 */
export interface HttpMetrics {
  /** Total number of HTTP requests. */
  readonly requestCount: Counter;

  /** HTTP request duration in milliseconds. */
  readonly requestDuration: Histogram;

  /** Number of HTTP errors (4xx and 5xx). */
  readonly errorCount: Counter;

  /** Number of currently active requests. */
  readonly activeRequests: Gauge;
}

/**
 * Standard domain operation metrics.
 */
export interface DomainMetrics {
  /** Number of domain events emitted. */
  readonly eventsEmitted: Counter;

  /** Number of domain events consumed. */
  readonly eventsConsumed: Counter;

  /** Event processing duration in milliseconds. */
  readonly eventProcessingDuration: Histogram;

  /** Number of event processing failures. */
  readonly eventProcessingErrors: Counter;
}

/**
 * Hospital-specific operational metrics.
 */
export interface HospitalMetrics {
  /** Current bed occupancy rate (0-1). */
  readonly bedOccupancyRate: Gauge;

  /** Number of active encounters. */
  readonly activeEncounters: Gauge;

  /** Number of active discharge blockers. */
  readonly activeDischargeBlockers: Gauge;

  /** Discharge blocker resolution time in minutes. */
  readonly blockerResolutionTime: Histogram;

  /** Number of overdue tasks. */
  readonly overdueTasks: Gauge;

  /** Task completion time in minutes. */
  readonly taskCompletionTime: Histogram;

  /** Average length of stay in days. */
  readonly averageLengthOfStay: Gauge;

  /** Number of pending admissions. */
  readonly pendingAdmissions: Gauge;
}

/**
 * Metrics collector wrapping all service metrics.
 */
export interface MetricsCollector {
  readonly http: HttpMetrics;
  readonly domain: DomainMetrics;
  readonly hospital: HospitalMetrics;
}

/**
 * Create a stub counter for use before OTel SDK is initialized.
 */
function createStubCounter(): Counter {
  return {
    add(_value?: number, _labels?: Readonly<Record<string, string>>): void {
      // Stub -- replaced by OTel MeterProvider in production
    },
  };
}

/**
 * Create a stub histogram for use before OTel SDK is initialized.
 */
function createStubHistogram(): Histogram {
  return {
    record(_value: number, _labels?: Readonly<Record<string, string>>): void {
      // Stub -- replaced by OTel MeterProvider in production
    },
  };
}

/**
 * Create a stub gauge for use before OTel SDK is initialized.
 */
function createStubGauge(): Gauge {
  return {
    set(_value: number, _labels?: Readonly<Record<string, string>>): void {
      // Stub -- replaced by OTel MeterProvider in production
    },
  };
}

/**
 * Initialize the metrics collector for a Velya service.
 *
 * In a full implementation, this would configure:
 *   - @opentelemetry/sdk-metrics MeterProvider
 *   - @opentelemetry/exporter-metrics-otlp-http OTLPMetricExporter
 *   - PeriodicExportingMetricReader
 *
 * The stub implementation provided here is safe for use in tests
 * and during bootstrap before the OTel SDK is available.
 *
 * @example
 * ```typescript
 * const metrics = initMetrics({
 *   serviceName: 'patient-flow',
 * });
 *
 * metrics.http.requestCount.add(1, { method: 'GET', path: '/encounters' });
 * metrics.http.requestDuration.record(42, { method: 'GET', status: '200' });
 * metrics.hospital.activeEncounters.set(127);
 * ```
 */
export function initMetrics(_config: MetricsConfig): MetricsCollector {
  return {
    http: {
      requestCount: createStubCounter(),
      requestDuration: createStubHistogram(),
      errorCount: createStubCounter(),
      activeRequests: createStubGauge(),
    },
    domain: {
      eventsEmitted: createStubCounter(),
      eventsConsumed: createStubCounter(),
      eventProcessingDuration: createStubHistogram(),
      eventProcessingErrors: createStubCounter(),
    },
    hospital: {
      bedOccupancyRate: createStubGauge(),
      activeEncounters: createStubGauge(),
      activeDischargeBlockers: createStubGauge(),
      blockerResolutionTime: createStubHistogram(),
      overdueTasks: createStubGauge(),
      taskCompletionTime: createStubHistogram(),
      averageLengthOfStay: createStubGauge(),
      pendingAdmissions: createStubGauge(),
    },
  };
}

/**
 * Standard histogram bucket boundaries for HTTP request duration (ms).
 */
export const HTTP_DURATION_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;

/**
 * Standard histogram bucket boundaries for domain event processing (ms).
 */
export const EVENT_PROCESSING_BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000] as const;

/**
 * Standard histogram bucket boundaries for blocker resolution time (minutes).
 */
export const BLOCKER_RESOLUTION_BUCKETS = [15, 30, 60, 120, 240, 480, 720, 1440] as const;
