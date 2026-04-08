/**
 * Common metrics helpers for the Velya platform.
 *
 * Provides RED (Rate, Error, Duration) metrics and hospital-specific
 * operational metrics aligned with OpenTelemetry conventions.
 */

/**
 * Metric instrument types aligned with OpenTelemetry.
 */
export type MetricType = 'counter' | 'up-down-counter' | 'histogram' | 'gauge';

/**
 * A recorded metric data point.
 */
export interface MetricDataPoint {
  readonly name: string;
  readonly type: MetricType;
  readonly value: number;
  readonly unit: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly timestamp: number;
}

/**
 * Configuration for a metric instrument.
 */
export interface MetricDefinition {
  readonly name: string;
  readonly type: MetricType;
  readonly description: string;
  readonly unit: string;
}

/**
 * Counter that can only increase.
 */
export class Counter {
  private readonly metricName: string;
  private readonly unit: string;
  private readonly buckets = new Map<string, number>();

  constructor(definition: MetricDefinition) {
    this.metricName = definition.name;
    this.unit = definition.unit;
  }

  /**
   * Increment the counter by a given value (default 1).
   */
  increment(value: number = 1, labels: Record<string, string> = {}): void {
    const key = labelsToKey(labels);
    const current = this.buckets.get(key) ?? 0;
    this.buckets.set(key, current + value);
  }

  /**
   * Get the current counter value for given labels.
   */
  getValue(labels: Record<string, string> = {}): number {
    return this.buckets.get(labelsToKey(labels)) ?? 0;
  }

  /**
   * Export all data points.
   */
  collect(): ReadonlyArray<MetricDataPoint> {
    const now = Date.now();
    const points: MetricDataPoint[] = [];

    for (const [key, value] of this.buckets) {
      points.push({
        name: this.metricName,
        type: 'counter',
        value,
        unit: this.unit,
        labels: keyToLabels(key),
        timestamp: now,
      });
    }

    return points;
  }
}

/**
 * Histogram for recording distributions (e.g., latency).
 */
export class Histogram {
  private readonly metricName: string;
  private readonly unit: string;
  private readonly boundaries: ReadonlyArray<number>;
  private readonly observations = new Map<string, number[]>();

  constructor(definition: MetricDefinition, boundaries?: number[]) {
    this.metricName = definition.name;
    this.unit = definition.unit;
    this.boundaries = boundaries ?? [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  }

  /**
   * Record a value observation.
   */
  record(value: number, labels: Record<string, string> = {}): void {
    const key = labelsToKey(labels);
    const values = this.observations.get(key) ?? [];
    values.push(value);
    this.observations.set(key, values);
  }

  /**
   * Get summary statistics for given labels.
   */
  getSummary(labels: Record<string, string> = {}): HistogramSummary {
    const key = labelsToKey(labels);
    const values = this.observations.get(key) ?? [];

    if (values.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);

    return {
      count: sorted.length,
      sum,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: percentile(sorted, 0.50),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
    };
  }

  /**
   * Export bucket counts for the histogram.
   */
  collect(): ReadonlyArray<MetricDataPoint> {
    const now = Date.now();
    const points: MetricDataPoint[] = [];

    for (const [key, values] of this.observations) {
      const labels = keyToLabels(key);

      points.push({
        name: `${this.metricName}.count`,
        type: 'histogram',
        value: values.length,
        unit: this.unit,
        labels,
        timestamp: now,
      });

      points.push({
        name: `${this.metricName}.sum`,
        type: 'histogram',
        value: values.reduce((acc, v) => acc + v, 0),
        unit: this.unit,
        labels,
        timestamp: now,
      });

      for (const boundary of this.boundaries) {
        const count = values.filter((v) => v <= boundary).length;
        points.push({
          name: `${this.metricName}.bucket`,
          type: 'histogram',
          value: count,
          unit: this.unit,
          labels: { ...labels, le: String(boundary) },
          timestamp: now,
        });
      }
    }

    return points;
  }
}

/**
 * Summary statistics for a histogram.
 */
export interface HistogramSummary {
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
  readonly avg: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
}

/**
 * Gauge that records a current value (can go up or down).
 */
export class Gauge {
  private readonly metricName: string;
  private readonly unit: string;
  private readonly values = new Map<string, number>();

  constructor(definition: MetricDefinition) {
    this.metricName = definition.name;
    this.unit = definition.unit;
  }

  /**
   * Set the gauge to a specific value.
   */
  set(value: number, labels: Record<string, string> = {}): void {
    this.values.set(labelsToKey(labels), value);
  }

  /**
   * Get the current gauge value.
   */
  getValue(labels: Record<string, string> = {}): number {
    return this.values.get(labelsToKey(labels)) ?? 0;
  }

  /**
   * Export all gauge data points.
   */
  collect(): ReadonlyArray<MetricDataPoint> {
    const now = Date.now();
    const points: MetricDataPoint[] = [];

    for (const [key, value] of this.values) {
      points.push({
        name: this.metricName,
        type: 'gauge',
        value,
        unit: this.unit,
        labels: keyToLabels(key),
        timestamp: now,
      });
    }

    return points;
  }
}

// ---------------------------------------------------------------------------
// Label serialization helpers
// ---------------------------------------------------------------------------

function labelsToKey(labels: Record<string, string>): string {
  const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([k, v]) => `${k}=${v}`).join(',');
}

function keyToLabels(key: string): Record<string, string> {
  if (key === '') return {};
  const labels: Record<string, string> = {};
  for (const pair of key.split(',')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      labels[pair.slice(0, eqIndex)] = pair.slice(eqIndex + 1);
    }
  }
  return labels;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ---------------------------------------------------------------------------
// Pre-defined RED metrics for microservices
// ---------------------------------------------------------------------------

/**
 * Standard RED (Rate, Errors, Duration) metrics for a service.
 */
export interface ServiceMetrics {
  readonly requestRate: Counter;
  readonly errorRate: Counter;
  readonly requestDuration: Histogram;
  readonly activeRequests: Gauge;
}

/**
 * Create standard RED metrics for a service.
 */
export function createServiceMetrics(serviceName: string): ServiceMetrics {
  return {
    requestRate: new Counter({
      name: `${serviceName}.http.requests.total`,
      type: 'counter',
      description: `Total HTTP requests handled by ${serviceName}`,
      unit: 'requests',
    }),
    errorRate: new Counter({
      name: `${serviceName}.http.errors.total`,
      type: 'counter',
      description: `Total HTTP errors returned by ${serviceName}`,
      unit: 'errors',
    }),
    requestDuration: new Histogram(
      {
        name: `${serviceName}.http.request.duration`,
        type: 'histogram',
        description: `HTTP request duration for ${serviceName}`,
        unit: 'ms',
      },
      [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    ),
    activeRequests: new Gauge({
      name: `${serviceName}.http.requests.active`,
      type: 'gauge',
      description: `Currently active HTTP requests in ${serviceName}`,
      unit: 'requests',
    }),
  };
}

// ---------------------------------------------------------------------------
// Hospital-specific operational metrics
// ---------------------------------------------------------------------------

/**
 * Metrics specific to hospital patient flow operations.
 */
export interface PatientFlowMetrics {
  readonly bedOccupancy: Gauge;
  readonly pendingDischarges: Gauge;
  readonly activeBlockers: Gauge;
  readonly averageLengthOfStay: Gauge;
  readonly dischargeBlockerResolutionTime: Histogram;
  readonly taskCompletionTime: Histogram;
  readonly encountersCreated: Counter;
  readonly encountersDischarged: Counter;
}

/**
 * Create hospital patient flow metrics.
 */
export function createPatientFlowMetrics(): PatientFlowMetrics {
  return {
    bedOccupancy: new Gauge({
      name: 'velya.patient_flow.bed_occupancy',
      type: 'gauge',
      description: 'Current bed occupancy rate (0-1)',
      unit: 'ratio',
    }),
    pendingDischarges: new Gauge({
      name: 'velya.patient_flow.pending_discharges',
      type: 'gauge',
      description: 'Number of patients with pending discharges',
      unit: 'patients',
    }),
    activeBlockers: new Gauge({
      name: 'velya.patient_flow.active_blockers',
      type: 'gauge',
      description: 'Number of active discharge blockers',
      unit: 'blockers',
    }),
    averageLengthOfStay: new Gauge({
      name: 'velya.patient_flow.average_length_of_stay',
      type: 'gauge',
      description: 'Average length of stay in days',
      unit: 'days',
    }),
    dischargeBlockerResolutionTime: new Histogram(
      {
        name: 'velya.patient_flow.blocker_resolution_time',
        type: 'histogram',
        description: 'Time to resolve discharge blockers',
        unit: 'minutes',
      },
      [15, 30, 60, 120, 240, 480, 720, 1440],
    ),
    taskCompletionTime: new Histogram(
      {
        name: 'velya.patient_flow.task_completion_time',
        type: 'histogram',
        description: 'Time to complete clinical tasks',
        unit: 'minutes',
      },
      [5, 15, 30, 60, 120, 240, 480],
    ),
    encountersCreated: new Counter({
      name: 'velya.patient_flow.encounters_created',
      type: 'counter',
      description: 'Total encounters created',
      unit: 'encounters',
    }),
    encountersDischarged: new Counter({
      name: 'velya.patient_flow.encounters_discharged',
      type: 'counter',
      description: 'Total encounters discharged',
      unit: 'encounters',
    }),
  };
}
