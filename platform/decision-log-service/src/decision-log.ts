import { Injectable, Logger } from '@nestjs/common';

export type DecisionRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type DecisionOutcome = 'success' | 'failure' | 'pending' | 'escalated' | 'rolled-back';

export interface DecisionEntry {
  readonly id: string;
  readonly agentId: string;
  readonly agentLayer: string;
  readonly action: DecisionAction;
  readonly context: DecisionContext;
  readonly reasoning: string;
  readonly riskLevel: DecisionRiskLevel;
  readonly outcome: DecisionOutcome;
  readonly timestamp: Date;
  readonly correlationId: string;
  readonly parentDecisionId?: string;
  readonly delegationChain: string[];
  readonly policyChecks: PolicyCheckRecord[];
  readonly durationMs: number;
  readonly tokensUsed: number;
  readonly cost: number;
}

export interface DecisionAction {
  type: string;
  resource: string;
  parameters: Record<string, unknown>;
  impact: string;
}

export interface DecisionContext {
  environment: 'development' | 'staging' | 'production';
  triggerSource: string;
  inputSummary: string;
  outputSummary: string;
  metadata: Record<string, string>;
}

export interface PolicyCheckRecord {
  policyId: string;
  policyName: string;
  result: 'passed' | 'failed' | 'skipped';
  reason: string;
}

export interface LogDecisionRequest {
  agentId: string;
  agentLayer: string;
  action: DecisionAction;
  context: DecisionContext;
  reasoning: string;
  riskLevel: DecisionRiskLevel;
  outcome: DecisionOutcome;
  correlationId: string;
  parentDecisionId?: string;
  delegationChain: string[];
  policyChecks: PolicyCheckRecord[];
  durationMs: number;
  tokensUsed: number;
  cost: number;
}

export interface DecisionLogQuery {
  agentId?: string;
  agentLayer?: string;
  actionType?: string;
  riskLevel?: DecisionRiskLevel;
  outcome?: DecisionOutcome;
  correlationId?: string;
  environment?: 'development' | 'staging' | 'production';
  fromTimestamp?: Date;
  toTimestamp?: Date;
  limit?: number;
  offset?: number;
}

export interface DecisionAuditExport {
  exportedAt: Date;
  exportedBy: string;
  totalEntries: number;
  query: DecisionLogQuery;
  entries: DecisionEntry[];
  summary: DecisionAuditSummary;
  integrityHash: string;
}

export interface DecisionAuditSummary {
  totalDecisions: number;
  outcomeBreakdown: Record<DecisionOutcome, number>;
  riskBreakdown: Record<DecisionRiskLevel, number>;
  agentBreakdown: Map<string, number>;
  averageDurationMs: number;
  totalTokensUsed: number;
  totalCost: number;
  policyViolations: number;
  timeRange: {
    earliest: Date | null;
    latest: Date | null;
  };
}

/**
 * Immutable decision log that records every agent decision with full context.
 * Entries cannot be modified or deleted once written, ensuring a complete
 * audit trail for governance and compliance.
 */
@Injectable()
export class DecisionLog {
  private readonly logger = new Logger(DecisionLog.name);
  private readonly entries: DecisionEntry[] = [];
  private entryCounter = 0;

  /**
   * Log a decision. Once written, the entry is immutable.
   */
  log(request: LogDecisionRequest): DecisionEntry {
    const id = this.generateEntryId();

    const entry: DecisionEntry = Object.freeze({
      id,
      agentId: request.agentId,
      agentLayer: request.agentLayer,
      action: Object.freeze({ ...request.action }),
      context: Object.freeze({
        ...request.context,
        metadata: Object.freeze({ ...request.context.metadata }),
      }),
      reasoning: request.reasoning,
      riskLevel: request.riskLevel,
      outcome: request.outcome,
      timestamp: new Date(),
      correlationId: request.correlationId,
      parentDecisionId: request.parentDecisionId,
      delegationChain: Object.freeze([...request.delegationChain]) as readonly string[] as string[],
      policyChecks: Object.freeze(
        request.policyChecks.map((pc) => Object.freeze({ ...pc })),
      ) as readonly PolicyCheckRecord[] as PolicyCheckRecord[],
      durationMs: request.durationMs,
      tokensUsed: request.tokensUsed,
      cost: request.cost,
    });

    this.entries.push(entry);

    this.logger.log(
      `Decision logged: id="${id}" agent="${request.agentId}" ` +
        `action="${request.action.type}" risk="${request.riskLevel}" ` +
        `outcome="${request.outcome}" correlationId="${request.correlationId}"`,
    );

    return entry;
  }

  /**
   * Retrieve a single decision entry by ID.
   */
  get(decisionId: string): DecisionEntry | undefined {
    return this.entries.find((e) => e.id === decisionId);
  }

  /**
   * Query decision entries with filtering and pagination.
   */
  query(query: DecisionLogQuery): DecisionEntry[] {
    let results = [...this.entries];

    if (query.agentId) {
      results = results.filter((e) => e.agentId === query.agentId);
    }

    if (query.agentLayer) {
      results = results.filter((e) => e.agentLayer === query.agentLayer);
    }

    if (query.actionType) {
      results = results.filter((e) => e.action.type === query.actionType);
    }

    if (query.riskLevel) {
      results = results.filter((e) => e.riskLevel === query.riskLevel);
    }

    if (query.outcome) {
      results = results.filter((e) => e.outcome === query.outcome);
    }

    if (query.correlationId) {
      results = results.filter((e) => e.correlationId === query.correlationId);
    }

    if (query.environment) {
      results = results.filter((e) => e.context.environment === query.environment);
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

  /**
   * Get the complete decision chain for a correlation ID,
   * useful for tracing a request through multiple agents.
   */
  getDecisionChain(correlationId: string): DecisionEntry[] {
    return this.entries
      .filter((e) => e.correlationId === correlationId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get child decisions spawned from a parent decision (delegation).
   */
  getChildDecisions(parentDecisionId: string): DecisionEntry[] {
    return this.entries.filter((e) => e.parentDecisionId === parentDecisionId);
  }

  /**
   * Export decision log entries for audit purposes.
   */
  exportForAudit(query: DecisionLogQuery, exportedBy: string): DecisionAuditExport {
    const entries = this.query(query);
    const summary = this.buildSummary(entries);
    const integrityHash = this.computeIntegrityHash(entries);

    return {
      exportedAt: new Date(),
      exportedBy,
      totalEntries: entries.length,
      query,
      entries,
      summary,
      integrityHash,
    };
  }

  /**
   * Build summary statistics for a set of decision entries.
   */
  buildSummary(entries: DecisionEntry[]): DecisionAuditSummary {
    const outcomeBreakdown: Record<DecisionOutcome, number> = {
      success: 0,
      failure: 0,
      pending: 0,
      escalated: 0,
      'rolled-back': 0,
    };

    const riskBreakdown: Record<DecisionRiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const agentBreakdown = new Map<string, number>();
    let totalDuration = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let policyViolations = 0;
    let earliest: Date | null = null;
    let latest: Date | null = null;

    for (const entry of entries) {
      outcomeBreakdown[entry.outcome]++;
      riskBreakdown[entry.riskLevel]++;

      const agentCount = agentBreakdown.get(entry.agentId) ?? 0;
      agentBreakdown.set(entry.agentId, agentCount + 1);

      totalDuration += entry.durationMs;
      totalTokens += entry.tokensUsed;
      totalCost += entry.cost;

      const failedPolicies = entry.policyChecks.filter((pc) => pc.result === 'failed');
      policyViolations += failedPolicies.length;

      if (!earliest || entry.timestamp < earliest) {
        earliest = entry.timestamp;
      }
      if (!latest || entry.timestamp > latest) {
        latest = entry.timestamp;
      }
    }

    return {
      totalDecisions: entries.length,
      outcomeBreakdown,
      riskBreakdown,
      agentBreakdown,
      averageDurationMs: entries.length > 0 ? totalDuration / entries.length : 0,
      totalTokensUsed: totalTokens,
      totalCost,
      policyViolations,
      timeRange: {
        earliest,
        latest,
      },
    };
  }

  /**
   * Get total entry count (unfiltered).
   */
  count(): number {
    return this.entries.length;
  }

  /**
   * Compute a simple integrity hash over entries for tamper detection.
   * In production, this would use a cryptographic hash chain (Merkle tree).
   */
  private computeIntegrityHash(entries: DecisionEntry[]): string {
    let hash = 0;
    const content = entries
      .map(
        (e) =>
          `${e.id}|${e.agentId}|${e.action.type}|${e.outcome}|${e.timestamp.toISOString()}`,
      )
      .join('\n');

    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }

    return `sha256-stub-${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }

  private generateEntryId(): string {
    this.entryCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.entryCounter.toString(36).padStart(4, '0');
    return `dec-${timestamp}-${counter}`;
  }
}
