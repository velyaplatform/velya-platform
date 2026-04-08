import { Injectable, Logger } from '@nestjs/common';
import { RoutingStrategy } from '../routing/routing-policy.js';

export type RequestStatus = 'success' | 'error' | 'timeout' | 'rate-limited';

export interface RequestLogEntry {
  correlationId: string;
  provider: string;
  model: string;
  strategy: RoutingStrategy;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cost: number;
  status: RequestStatus;
  errorMessage?: string;
  timestamp: Date;
  metadata?: Record<string, string>;
}

export interface RequestLogQuery {
  correlationId?: string;
  provider?: string;
  model?: string;
  status?: RequestStatus;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  limit?: number;
  offset?: number;
}

export interface RequestLogSummary {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  totalCost: number;
  averageLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  providerBreakdown: Map<string, ProviderRequestSummary>;
}

export interface ProviderRequestSummary {
  provider: string;
  requestCount: number;
  successRate: number;
  averageLatencyMs: number;
  totalCost: number;
}

@Injectable()
export class RequestLogger {
  private readonly logger = new Logger(RequestLogger.name);
  private readonly entries: RequestLogEntry[] = [];

  log(entry: RequestLogEntry): void {
    this.entries.push(entry);

    const logData = {
      correlationId: entry.correlationId,
      provider: entry.provider,
      model: entry.model,
      strategy: entry.strategy,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      latencyMs: entry.latencyMs,
      cost: entry.cost.toFixed(6),
      status: entry.status,
      ...(entry.errorMessage ? { error: entry.errorMessage } : {}),
    };

    if (entry.status === 'success') {
      this.logger.log(JSON.stringify(logData));
    } else {
      this.logger.warn(JSON.stringify(logData));
    }
  }

  query(query: RequestLogQuery): RequestLogEntry[] {
    let results = [...this.entries];

    if (query.correlationId) {
      results = results.filter((e) => e.correlationId === query.correlationId);
    }

    if (query.provider) {
      results = results.filter((e) => e.provider === query.provider);
    }

    if (query.model) {
      results = results.filter((e) => e.model === query.model);
    }

    if (query.status) {
      results = results.filter((e) => e.status === query.status);
    }

    if (query.fromTimestamp) {
      results = results.filter((e) => e.timestamp >= query.fromTimestamp!);
    }

    if (query.toTimestamp) {
      results = results.filter((e) => e.timestamp <= query.toTimestamp!);
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  summarize(query?: RequestLogQuery): RequestLogSummary {
    const entries = query ? this.query(query) : this.entries;

    const providerMap = new Map<string, RequestLogEntry[]>();
    for (const entry of entries) {
      const existing = providerMap.get(entry.provider) ?? [];
      existing.push(entry);
      providerMap.set(entry.provider, existing);
    }

    const providerBreakdown = new Map<string, ProviderRequestSummary>();
    for (const [provider, providerEntries] of providerMap) {
      const successEntries = providerEntries.filter((e) => e.status === 'success');
      const totalLatency = providerEntries.reduce((sum, e) => sum + e.latencyMs, 0);
      const totalCost = providerEntries.reduce((sum, e) => sum + e.cost, 0);

      providerBreakdown.set(provider, {
        provider,
        requestCount: providerEntries.length,
        successRate: providerEntries.length > 0
          ? successEntries.length / providerEntries.length
          : 0,
        averageLatencyMs: providerEntries.length > 0
          ? totalLatency / providerEntries.length
          : 0,
        totalCost,
      });
    }

    const successCount = entries.filter((e) => e.status === 'success').length;
    const totalLatency = entries.reduce((sum, e) => sum + e.latencyMs, 0);

    return {
      totalRequests: entries.length,
      successCount,
      errorCount: entries.length - successCount,
      totalCost: entries.reduce((sum, e) => sum + e.cost, 0),
      averageLatencyMs: entries.length > 0 ? totalLatency / entries.length : 0,
      totalInputTokens: entries.reduce((sum, e) => sum + e.inputTokens, 0),
      totalOutputTokens: entries.reduce((sum, e) => sum + e.outputTokens, 0),
      providerBreakdown,
    };
  }

  getByCorrelationId(correlationId: string): RequestLogEntry[] {
    return this.entries.filter((e) => e.correlationId === correlationId);
  }

  clear(): void {
    this.entries.length = 0;
    this.logger.log('Request log cleared');
  }
}
