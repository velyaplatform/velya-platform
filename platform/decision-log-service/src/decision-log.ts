import { Injectable, Logger } from '@nestjs/common';

/**
 * The type of decision recorded in the log.
 */
export type DecisionType =
  | 'agent-action'
  | 'policy-evaluation'
  | 'escalation'
  | 'delegation'
  | 'approval'
  | 'rejection'
  | 'override'
  | 'fallback'
  | 'recommendation';

/**
 * Outcome of a decision.
 */
export type DecisionOutcome =
  | 'executed'
  | 'approved'
  | 'denied'
  | 'deferred'
  | 'escalated'
  | 'timed-out'
  | 'failed';

/**
 * Risk classification at the time of decision.
 */
export type DecisionRisk = 'low' | 'medium' | 'high' | 'critical';

/**
 * Immutable decision log entry.
 *
 * Decision entries are append-only and must never be modified or deleted.
 * They provide a complete audit trail of all agent and system decisions
 * for governance, compliance, and retrospective analysis.
 */
export interface DecisionEntry {
  /** Unique decision entry identifier. */
  readonly id: string;

  /** ISO-8601 timestamp of when the decision was made. */
  readonly timestamp: string;

  /** Type of decision. */
  readonly type: DecisionType;

  /** ID of the agent or service that made the decision. */
  readonly deciderId: string;

  /** Human-readable name of the decider. */
  readonly deciderName: string;

  /** Whether the decider is an agent, service, or human. */
  readonly deciderType: 'agent' | 'service' | 'user';

  /** Correlation ID linking to the broader transaction or workflow. */
  readonly correlationId: string;

  /** Causation ID linking to the direct trigger of this decision. */
  readonly causationId: string | null;

  /** The action or operation being decided upon. */
  readonly action: string;

  /** The resource affected by this decision. */
  readonly resource: string;

  /** Resource identifier. */
  readonly resourceId: string;

  /** The reasoning or rationale behind the decision. */
  readonly reasoning: string;

  /** Confidence score (0-1) for AI-driven decisions. */
  readonly confidence: number | null;

  /** Risk classification at decision time. */
  readonly risk: DecisionRisk;

  /** Outcome of the decision. */
  readonly outcome: DecisionOutcome;

  /** Whether the decision required human approval. */
  readonly requiredApproval: boolean;

  /** ID of the human approver, if approval was required. */
  readonly approvedBy: string | null;

  /** Input data considered for the decision (redacted of PHI). */
  readonly inputs: Readonly<Record<string, unknown>>;

  /** Output or result of the decision. */
  readonly outputs: Readonly<Record<string, unknown>>;

  /** Alternatives considered but not chosen. */
  readonly alternativesConsidered: ReadonlyArray<DecisionAlternative>;

  /** Policy IDs that were evaluated for this decision. */
  readonly policiesEvaluated: ReadonlyArray<string>;

  /** Time in milliseconds to reach the decision. */
  readonly decisionDurationMs: number;

  /** Additional context. */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * An alternative that was considered but not chosen during decision-making.
 */
export interface DecisionAlternative {
  /** Description of the alternative action. */
  readonly action: string;

  /** Why this alternative was not chosen. */
  readonly rejectionReason: string;

  /** Confidence score for this alternative (0-1). */
  readonly confidence: number;

  /** Risk classification for this alternative. */
  readonly risk: DecisionRisk;
}

/**
 * Filter criteria for querying decision log entries.
 */
export interface DecisionLogQuery {
  readonly deciderId?: string;
  readonly deciderType?: 'agent' | 'service' | 'user';
  readonly type?: DecisionType;
  readonly outcome?: DecisionOutcome;
  readonly risk?: DecisionRisk;
  readonly resource?: string;
  readonly resourceId?: string;
  readonly correlationId?: string;
  readonly requiredApproval?: boolean;
  readonly fromTimestamp?: string;
  readonly toTimestamp?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Statistics summary for decision log entries.
 */
export interface DecisionLogStats {
  readonly totalDecisions: number;
  readonly byType: Readonly<Record<DecisionType, number>>;
  readonly byOutcome: Readonly<Record<DecisionOutcome, number>>;
  readonly byRisk: Readonly<Record<DecisionRisk, number>>;
  readonly averageDecisionDurationMs: number;
  readonly approvalRate: number;
  readonly escalationRate: number;
  readonly computedAt: string;
}

/**
 * Request to record a new decision.
 */
export interface RecordDecisionRequest {
  readonly type: DecisionType;
  readonly deciderId: string;
  readonly deciderName: string;
  readonly deciderType: 'agent' | 'service' | 'user';
  readonly correlationId: string;
  readonly causationId?: string;
  readonly action: string;
  readonly resource: string;
  readonly resourceId: string;
  readonly reasoning: string;
  readonly confidence?: number;
  readonly risk: DecisionRisk;
  readonly outcome: DecisionOutcome;
  readonly requiredApproval: boolean;
  readonly approvedBy?: string;
  readonly inputs: Record<string, unknown>;
  readonly outputs: Record<string, unknown>;
  readonly alternativesConsidered?: DecisionAlternative[];
  readonly policiesEvaluated?: string[];
  readonly decisionDurationMs: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Immutable decision log service.
 *
 * All entries are append-only. The log supports querying, filtering,
 * and statistical aggregation for governance dashboards and compliance audits.
 */
@Injectable()
export class DecisionLog {
  private readonly logger = new Logger(DecisionLog.name);
  private readonly entries: DecisionEntry[] = [];
  private entryCounter = 0;

  /**
   * Record a new decision. Entries are immutable once recorded.
   */
  record(request: RecordDecisionRequest): DecisionEntry {
    this.entryCounter++;
    const id = `dec-${Date.now().toString(36)}-${this.entryCounter.toString(36).padStart(4, '0')}`;

    const entry: DecisionEntry = {
      id,
      timestamp: new Date().toISOString(),
      type: request.type,
      deciderId: request.deciderId,
      deciderName: request.deciderName,
      deciderType: request.deciderType,
      correlationId: request.correlationId,
      causationId: request.causationId ?? null,
      action: request.action,
      resource: request.resource,
      resourceId: request.resourceId,
      reasoning: request.reasoning,
      confidence: request.confidence ?? null,
      risk: request.risk,
      outcome: request.outcome,
      requiredApproval: request.requiredApproval,
      approvedBy: request.approvedBy ?? null,
      inputs: { ...request.inputs },
      outputs: { ...request.outputs },
      alternativesConsidered: request.alternativesConsidered
        ? [...request.alternativesConsidered]
        : [],
      policiesEvaluated: request.policiesEvaluated
        ? [...request.policiesEvaluated]
        : [],
      decisionDurationMs: request.decisionDurationMs,
      metadata: request.metadata ? { ...request.metadata } : {},
    };

    this.entries.push(entry);

    this.logger.log(
      `Decision recorded: id="${id}" type="${entry.type}" ` +
        `decider="${entry.deciderId}" action="${entry.action}" ` +
        `outcome="${entry.outcome}" risk="${entry.risk}" ` +
        `correlationId="${entry.correlationId}"`,
    );

    return entry;
  }

  /**
   * Get a single decision entry by ID.
   */
  get(decisionId: string): DecisionEntry | undefined {
    return this.entries.find((e) => e.id === decisionId);
  }

  /**
   * Query decision entries with filters and pagination.
   */
  query(query: DecisionLogQuery): ReadonlyArray<DecisionEntry> {
    let results = [...this.entries];

    if (query.deciderId) {
      results = results.filter((e) => e.deciderId === query.deciderId);
    }

    if (query.deciderType) {
      results = results.filter((e) => e.deciderType === query.deciderType);
    }

    if (query.type) {
      results = results.filter((e) => e.type === query.type);
    }

    if (query.outcome) {
      results = results.filter((e) => e.outcome === query.outcome);
    }

    if (query.risk) {
      results = results.filter((e) => e.risk === query.risk);
    }

    if (query.resource) {
      results = results.filter((e) => e.resource === query.resource);
    }

    if (query.resourceId) {
      results = results.filter((e) => e.resourceId === query.resourceId);
    }

    if (query.correlationId) {
      results = results.filter((e) => e.correlationId === query.correlationId);
    }

    if (query.requiredApproval !== undefined) {
      results = results.filter((e) => e.requiredApproval === query.requiredApproval);
    }

    if (query.fromTimestamp) {
      results = results.filter((e) => e.timestamp >= query.fromTimestamp!);
    }

    if (query.toTimestamp) {
      results = results.filter((e) => e.timestamp <= query.toTimestamp!);
    }

    // Sort by timestamp descending (most recent first)
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get all decisions in a correlation chain.
   */
  getDecisionChain(correlationId: string): ReadonlyArray<DecisionEntry> {
    return this.entries
      .filter((e) => e.correlationId === correlationId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get aggregate statistics for decision entries.
   */
  getStats(query?: Pick<DecisionLogQuery, 'deciderId' | 'fromTimestamp' | 'toTimestamp'>): DecisionLogStats {
    let entries = [...this.entries];

    if (query?.deciderId) {
      entries = entries.filter((e) => e.deciderId === query.deciderId);
    }
    if (query?.fromTimestamp) {
      entries = entries.filter((e) => e.timestamp >= query.fromTimestamp!);
    }
    if (query?.toTimestamp) {
      entries = entries.filter((e) => e.timestamp <= query.toTimestamp!);
    }

    const byType: Record<DecisionType, number> = {
      'agent-action': 0,
      'policy-evaluation': 0,
      'escalation': 0,
      'delegation': 0,
      'approval': 0,
      'rejection': 0,
      'override': 0,
      'fallback': 0,
      'recommendation': 0,
    };

    const byOutcome: Record<DecisionOutcome, number> = {
      'executed': 0,
      'approved': 0,
      'denied': 0,
      'deferred': 0,
      'escalated': 0,
      'timed-out': 0,
      'failed': 0,
    };

    const byRisk: Record<DecisionRisk, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let totalDurationMs = 0;
    let approvalCount = 0;
    let escalationCount = 0;

    for (const entry of entries) {
      byType[entry.type]++;
      byOutcome[entry.outcome]++;
      byRisk[entry.risk]++;
      totalDurationMs += entry.decisionDurationMs;

      if (entry.requiredApproval) {
        approvalCount++;
      }
      if (entry.outcome === 'escalated') {
        escalationCount++;
      }
    }

    return {
      totalDecisions: entries.length,
      byType,
      byOutcome,
      byRisk,
      averageDecisionDurationMs: entries.length > 0
        ? Math.round(totalDurationMs / entries.length)
        : 0,
      approvalRate: entries.length > 0 ? approvalCount / entries.length : 0,
      escalationRate: entries.length > 0 ? escalationCount / entries.length : 0,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Get the total number of recorded decisions.
   */
  count(): number {
    return this.entries.length;
  }
}
