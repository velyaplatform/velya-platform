/**
 * Platform Event Schema — Velya
 *
 * Todos os eventos da plataforma seguem este schema.
 * Eventos são publicados via NATS e webhook para consumo por agentes e automação.
 */

export type EventSeverity = 'info' | 'warning' | 'critical';
export type EventSource =
  | 'sentinel-health-scan'
  | 'sentinel-silence-detector'
  | 'sentinel-cost-monitor'
  | 'sentinel-daily-digest'
  | 'sentinel-drift-detector'
  | 'alertmanager'
  | 'argocd'
  | 'kubernetes'
  | 'deploy-pipeline'
  | 'health-check';

export interface PlatformEvent {
  /** Unique event ID */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Source system that generated the event */
  source: EventSource;
  /** Event severity */
  severity: EventSeverity;
  /** Human-readable summary */
  summary: string;
  /** Structured event data */
  data: Record<string, unknown>;
  /** Affected namespace(s) */
  namespaces?: string[];
  /** Affected service(s) */
  services?: string[];
  /** Whether this event requires human/agent action */
  actionRequired: boolean;
  /** Suggested action if actionRequired is true */
  suggestedAction?: string;
  /** Cluster identifier */
  cluster: string;
}

export interface SentinelFinding {
  type: string;
  message: string;
  severity: EventSeverity;
  resource?: string;
  namespace?: string;
  value?: string | number;
}

export interface SentinelReport {
  sentinel: string;
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical';
  findings: SentinelFinding[];
  cluster: string;
  duration_ms?: number;
}

export interface AlertManagerPayload {
  version: string;
  groupKey: string;
  status: 'firing' | 'resolved';
  receiver: string;
  alerts: AlertManagerAlert[];
}

export interface AlertManagerAlert {
  status: 'firing' | 'resolved';
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  generatorURL: string;
  fingerprint: string;
}

export interface DeployEvent {
  service: string;
  imageTag: string;
  previousTag?: string;
  status: 'started' | 'completed' | 'failed' | 'rolled-back';
  triggeredBy: string;
  commitSha: string;
}

export interface HealthCheckResult {
  service: string;
  url: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latencyMs?: number;
  dependencies?: Array<{
    name: string;
    status: 'ok' | 'error';
    message?: string;
  }>;
  timestamp: string;
}
