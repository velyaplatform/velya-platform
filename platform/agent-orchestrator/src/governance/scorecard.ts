import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutionResult, ExecutionStatus } from '../core/agent-definition.js';

export interface ScorecardMetrics {
  agentId: string;
  successRate: number;
  errorRate: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  escalationRate: number;
  qualityScore: number;
  totalExecutions: number;
  totalTokensUsed: number;
  totalCost: number;
  lastUpdated: Date;
}

export interface ScorecardTrend {
  agentId: string;
  period: TrendPeriod;
  dataPoints: TrendDataPoint[];
}

export type TrendPeriod = '1h' | '6h' | '24h' | '7d' | '30d';

export interface TrendDataPoint {
  timestamp: Date;
  successRate: number;
  errorRate: number;
  averageLatencyMs: number;
  executionCount: number;
  qualityScore: number;
}

interface ExecutionRecord {
  result: AgentExecutionResult;
  timestamp: Date;
}

const QUALITY_WEIGHTS = {
  successRate: 0.4,
  latencyScore: 0.2,
  escalationPenalty: 0.2,
  costEfficiency: 0.2,
};

const LATENCY_BASELINE_MS = 5000;

@Injectable()
export class AgentScorecard {
  private readonly logger = new Logger(AgentScorecard.name);
  private readonly executionHistory = new Map<string, ExecutionRecord[]>();

  recordExecution(agentId: string, result: AgentExecutionResult): void {
    const records = this.executionHistory.get(agentId) ?? [];
    records.push({ result, timestamp: new Date() });
    this.executionHistory.set(agentId, records);

    this.logger.debug(
      `Recorded execution for agent="${agentId}" status="${result.status}" ` +
        `durationMs=${result.durationMs}`,
    );
  }

  getMetrics(agentId: string, windowMs?: number): ScorecardMetrics {
    const records = this.getRecordsInWindow(agentId, windowMs);

    if (records.length === 0) {
      return this.emptyMetrics(agentId);
    }

    const successCount = records.filter((r) => r.result.status === 'success').length;
    const errorCount = records.filter(
      (r) => r.result.status === 'failure' || r.result.status === 'timeout',
    ).length;
    const escalationCount = records.filter((r) => r.result.status === 'escalated').length;

    const latencies = records.map((r) => r.result.durationMs).sort((a, b) => a - b);
    const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const p95Latency = this.percentile(latencies, 0.95);
    const p99Latency = this.percentile(latencies, 0.99);

    const successRate = successCount / records.length;
    const errorRate = errorCount / records.length;
    const escalationRate = escalationCount / records.length;

    const totalTokens = records.reduce((sum, r) => sum + r.result.tokensUsed, 0);
    const totalCost = records.reduce((sum, r) => sum + r.result.cost, 0);

    const qualityScore = this.calculateQualityScore(
      successRate,
      avgLatency,
      escalationRate,
      totalCost,
      records.length,
    );

    return {
      agentId,
      successRate,
      errorRate,
      averageLatencyMs: avgLatency,
      p95LatencyMs: p95Latency,
      p99LatencyMs: p99Latency,
      escalationRate,
      qualityScore,
      totalExecutions: records.length,
      totalTokensUsed: totalTokens,
      totalCost,
      lastUpdated: new Date(),
    };
  }

  getTrend(agentId: string, period: TrendPeriod): ScorecardTrend {
    const periodMs = this.periodToMs(period);
    const bucketCount = this.periodToBucketCount(period);
    const bucketSizeMs = periodMs / bucketCount;

    const now = Date.now();
    const dataPoints: TrendDataPoint[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = now - periodMs + i * bucketSizeMs;
      const bucketEnd = bucketStart + bucketSizeMs;

      const records = this.getRecordsInRange(agentId, bucketStart, bucketEnd);

      if (records.length === 0) {
        dataPoints.push({
          timestamp: new Date(bucketStart),
          successRate: 0,
          errorRate: 0,
          averageLatencyMs: 0,
          executionCount: 0,
          qualityScore: 0,
        });
        continue;
      }

      const successCount = records.filter((r) => r.result.status === 'success').length;
      const errorCount = records.filter(
        (r) => r.result.status === 'failure' || r.result.status === 'timeout',
      ).length;
      const avgLatency =
        records.reduce((sum, r) => sum + r.result.durationMs, 0) / records.length;

      dataPoints.push({
        timestamp: new Date(bucketStart),
        successRate: successCount / records.length,
        errorRate: errorCount / records.length,
        averageLatencyMs: avgLatency,
        executionCount: records.length,
        qualityScore: this.calculateQualityScore(
          successCount / records.length,
          avgLatency,
          0,
          0,
          records.length,
        ),
      });
    }

    return {
      agentId,
      period,
      dataPoints,
    };
  }

  compareAgents(agentIds: string[], windowMs?: number): Map<string, ScorecardMetrics> {
    const results = new Map<string, ScorecardMetrics>();
    for (const agentId of agentIds) {
      results.set(agentId, this.getMetrics(agentId, windowMs));
    }
    return results;
  }

  getTopPerformers(limit: number, windowMs?: number): ScorecardMetrics[] {
    const allMetrics: ScorecardMetrics[] = [];

    for (const agentId of this.executionHistory.keys()) {
      allMetrics.push(this.getMetrics(agentId, windowMs));
    }

    return allMetrics
      .filter((m) => m.totalExecutions > 0)
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, limit);
  }

  getUnderperformers(
    successRateThreshold: number,
    windowMs?: number,
  ): ScorecardMetrics[] {
    const allMetrics: ScorecardMetrics[] = [];

    for (const agentId of this.executionHistory.keys()) {
      const metrics = this.getMetrics(agentId, windowMs);
      if (metrics.totalExecutions > 0 && metrics.successRate < successRateThreshold) {
        allMetrics.push(metrics);
      }
    }

    return allMetrics.sort((a, b) => a.successRate - b.successRate);
  }

  clearHistory(agentId: string): void {
    this.executionHistory.delete(agentId);
    this.logger.log(`Cleared execution history for agent="${agentId}"`);
  }

  private getRecordsInWindow(agentId: string, windowMs?: number): ExecutionRecord[] {
    const records = this.executionHistory.get(agentId) ?? [];
    if (!windowMs) return records;

    const cutoff = Date.now() - windowMs;
    return records.filter((r) => r.timestamp.getTime() >= cutoff);
  }

  private getRecordsInRange(
    agentId: string,
    startMs: number,
    endMs: number,
  ): ExecutionRecord[] {
    const records = this.executionHistory.get(agentId) ?? [];
    return records.filter(
      (r) => r.timestamp.getTime() >= startMs && r.timestamp.getTime() < endMs,
    );
  }

  private calculateQualityScore(
    successRate: number,
    avgLatencyMs: number,
    escalationRate: number,
    totalCost: number,
    executionCount: number,
  ): number {
    // Normalize latency score (lower is better)
    const latencyScore = Math.max(0, 1 - avgLatencyMs / LATENCY_BASELINE_MS);

    // Escalation penalty (lower is better)
    const escalationScore = 1 - escalationRate;

    // Cost efficiency (normalized per execution)
    const costPerExecution = executionCount > 0 ? totalCost / executionCount : 0;
    const costScore = Math.max(0, 1 - costPerExecution / 0.10); // $0.10 baseline

    const score =
      QUALITY_WEIGHTS.successRate * successRate +
      QUALITY_WEIGHTS.latencyScore * latencyScore +
      QUALITY_WEIGHTS.escalationPenalty * escalationScore +
      QUALITY_WEIGHTS.costEfficiency * costScore;

    return Math.round(score * 100) / 100;
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil(p * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private periodToMs(period: TrendPeriod): number {
    const map: Record<TrendPeriod, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return map[period];
  }

  private periodToBucketCount(period: TrendPeriod): number {
    const map: Record<TrendPeriod, number> = {
      '1h': 12,    // 5-minute buckets
      '6h': 24,    // 15-minute buckets
      '24h': 24,   // 1-hour buckets
      '7d': 28,    // 6-hour buckets
      '30d': 30,   // 1-day buckets
    };
    return map[period];
  }

  private emptyMetrics(agentId: string): ScorecardMetrics {
    return {
      agentId,
      successRate: 0,
      errorRate: 0,
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      escalationRate: 0,
      qualityScore: 0,
      totalExecutions: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      lastUpdated: new Date(),
    };
  }
}
