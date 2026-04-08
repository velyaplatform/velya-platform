import { Injectable, Logger } from '@nestjs/common';

export type RiskClassification = 'low' | 'medium' | 'high' | 'critical';
export type GateDecision = 'allow' | 'deny' | 'require-approval';

export interface PolicyDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: PolicyRule[];
  enabled: boolean;
  priority: number;
  scope: PolicyScope;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyRule {
  id: string;
  condition: PolicyCondition;
  action: PolicyRuleAction;
  riskOverride?: RiskClassification;
}

export interface PolicyCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean | string[];
  logicalGroup?: 'and' | 'or';
}

export type ConditionOperator =
  | 'equals'
  | 'not-equals'
  | 'contains'
  | 'not-contains'
  | 'greater-than'
  | 'less-than'
  | 'in'
  | 'not-in'
  | 'matches-regex';

export type PolicyRuleAction = 'allow' | 'deny' | 'require-approval' | 'flag';

export interface PolicyScope {
  environments: ('development' | 'staging' | 'production')[];
  agentLayers?: string[];
  resourcePatterns?: string[];
}

export interface ActionContext {
  agentId: string;
  agentLayer: string;
  actionType: string;
  resource: string;
  environment: 'development' | 'staging' | 'production';
  parameters: Record<string, unknown>;
  correlationId: string;
  metadata: Record<string, string>;
}

export interface PolicyEvaluationResult {
  decision: GateDecision;
  riskClassification: RiskClassification;
  matchedPolicies: MatchedPolicy[];
  auditEntry: PolicyAuditEntry;
  timestamp: Date;
}

export interface MatchedPolicy {
  policyId: string;
  policyName: string;
  ruleId: string;
  action: PolicyRuleAction;
  reason: string;
}

export interface PolicyAuditEntry {
  id: string;
  correlationId: string;
  agentId: string;
  actionType: string;
  resource: string;
  environment: string;
  decision: GateDecision;
  riskClassification: RiskClassification;
  matchedPolicies: MatchedPolicy[];
  evaluationDurationMs: number;
  timestamp: Date;
}

@Injectable()
export class PolicyEngine {
  private readonly logger = new Logger(PolicyEngine.name);
  private readonly policies = new Map<string, PolicyDefinition>();
  private readonly auditLog: PolicyAuditEntry[] = [];
  private auditCounter = 0;

  registerPolicy(policy: PolicyDefinition): void {
    this.policies.set(policy.id, policy);
    this.logger.log(`Registered policy: "${policy.name}" (${policy.id}) v${policy.version}`);
  }

  updatePolicy(policyId: string, updates: Partial<PolicyDefinition>): PolicyDefinition {
    const existing = this.policies.get(policyId);
    if (!existing) {
      throw new Error(`Policy "${policyId}" not found`);
    }

    const updated: PolicyDefinition = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID mutation
      updatedAt: new Date(),
    };

    this.policies.set(policyId, updated);
    this.logger.log(`Updated policy: "${updated.name}" (${policyId})`);

    return updated;
  }

  removePolicy(policyId: string): boolean {
    const removed = this.policies.delete(policyId);
    if (removed) {
      this.logger.log(`Removed policy: ${policyId}`);
    }
    return removed;
  }

  evaluate(context: ActionContext): PolicyEvaluationResult {
    const startTime = Date.now();
    const matchedPolicies: MatchedPolicy[] = [];

    // Get applicable policies sorted by priority
    const applicablePolicies = this.getApplicablePolicies(context);

    let overallRisk: RiskClassification = 'low';
    let overallDecision: GateDecision = 'allow';

    for (const policy of applicablePolicies) {
      for (const rule of policy.rules) {
        if (this.evaluateCondition(rule.condition, context)) {
          const matched: MatchedPolicy = {
            policyId: policy.id,
            policyName: policy.name,
            ruleId: rule.id,
            action: rule.action,
            reason: `Matched condition: ${rule.condition.field} ${rule.condition.operator} ${String(rule.condition.value)}`,
          };
          matchedPolicies.push(matched);

          // Escalate risk if rule overrides
          if (rule.riskOverride) {
            overallRisk = this.escalateRisk(overallRisk, rule.riskOverride);
          }

          // Escalate decision based on rule action
          overallDecision = this.escalateDecision(overallDecision, rule.action);
        }
      }
    }

    // Default risk classification if no policies matched
    if (matchedPolicies.length === 0) {
      overallRisk = this.classifyDefaultRisk(context);
    }

    const evaluationDurationMs = Date.now() - startTime;

    const auditEntry = this.createAuditEntry(
      context,
      overallDecision,
      overallRisk,
      matchedPolicies,
      evaluationDurationMs,
    );

    this.auditLog.push(auditEntry);

    this.logger.log(
      `Policy evaluation: agent="${context.agentId}" action="${context.actionType}" ` +
        `resource="${context.resource}" decision="${overallDecision}" ` +
        `risk="${overallRisk}" matchedPolicies=${matchedPolicies.length} ` +
        `durationMs=${evaluationDurationMs}`,
    );

    return {
      decision: overallDecision,
      riskClassification: overallRisk,
      matchedPolicies,
      auditEntry,
      timestamp: new Date(),
    };
  }

  classifyRisk(context: ActionContext): RiskClassification {
    const result = this.evaluate(context);
    return result.riskClassification;
  }

  getAuditLog(query?: AuditLogQuery): PolicyAuditEntry[] {
    let results = [...this.auditLog];

    if (query?.agentId) {
      results = results.filter((e) => e.agentId === query.agentId);
    }

    if (query?.correlationId) {
      results = results.filter((e) => e.correlationId === query.correlationId);
    }

    if (query?.decision) {
      results = results.filter((e) => e.decision === query.decision);
    }

    if (query?.riskClassification) {
      results = results.filter((e) => e.riskClassification === query.riskClassification);
    }

    if (query?.fromTimestamp) {
      results = results.filter((e) => e.timestamp >= query.fromTimestamp!);
    }

    if (query?.toTimestamp) {
      results = results.filter((e) => e.timestamp <= query.toTimestamp!);
    }

    const limit = query?.limit ?? 100;
    const offset = query?.offset ?? 0;

    return results.slice(offset, offset + limit);
  }

  exportAudit(query?: AuditLogQuery): PolicyAuditExport {
    const entries = this.getAuditLog(query);

    return {
      exportedAt: new Date(),
      totalEntries: entries.length,
      entries,
      summary: {
        totalAllowed: entries.filter((e) => e.decision === 'allow').length,
        totalDenied: entries.filter((e) => e.decision === 'deny').length,
        totalRequireApproval: entries.filter((e) => e.decision === 'require-approval').length,
        riskBreakdown: {
          low: entries.filter((e) => e.riskClassification === 'low').length,
          medium: entries.filter((e) => e.riskClassification === 'medium').length,
          high: entries.filter((e) => e.riskClassification === 'high').length,
          critical: entries.filter((e) => e.riskClassification === 'critical').length,
        },
      },
    };
  }

  listPolicies(): PolicyDefinition[] {
    return Array.from(this.policies.values()).sort((a, b) => a.priority - b.priority);
  }

  getPolicy(policyId: string): PolicyDefinition | undefined {
    return this.policies.get(policyId);
  }

  private getApplicablePolicies(context: ActionContext): PolicyDefinition[] {
    return Array.from(this.policies.values())
      .filter((policy) => {
        if (!policy.enabled) return false;

        if (!policy.scope.environments.includes(context.environment)) return false;

        if (
          policy.scope.agentLayers &&
          policy.scope.agentLayers.length > 0 &&
          !policy.scope.agentLayers.includes(context.agentLayer)
        ) {
          return false;
        }

        if (policy.scope.resourcePatterns && policy.scope.resourcePatterns.length > 0) {
          const matchesResource = policy.scope.resourcePatterns.some((pattern) =>
            this.matchResourcePattern(context.resource, pattern),
          );
          if (!matchesResource) return false;
        }

        return true;
      })
      .sort((a, b) => a.priority - b.priority);
  }

  private evaluateCondition(condition: PolicyCondition, context: ActionContext): boolean {
    const fieldValue = this.resolveField(condition.field, context);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not-equals':
        return fieldValue !== condition.value;
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(String(condition.value));
      case 'not-contains':
        return typeof fieldValue === 'string' && !fieldValue.includes(String(condition.value));
      case 'greater-than':
        return typeof fieldValue === 'number' && fieldValue > Number(condition.value);
      case 'less-than':
        return typeof fieldValue === 'number' && fieldValue < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(String(fieldValue));
      case 'not-in':
        return Array.isArray(condition.value) && !condition.value.includes(String(fieldValue));
      case 'matches-regex': {
        const regex = new RegExp(String(condition.value));
        return typeof fieldValue === 'string' && regex.test(fieldValue);
      }
    }
  }

  private resolveField(
    field: string,
    context: ActionContext,
  ): string | number | boolean | undefined {
    const fieldMap: Record<string, string | number | boolean | undefined> = {
      'agent.id': context.agentId,
      'agent.layer': context.agentLayer,
      'action.type': context.actionType,
      'action.resource': context.resource,
      environment: context.environment,
    };

    if (field in fieldMap) {
      return fieldMap[field];
    }

    // Check metadata
    if (field.startsWith('metadata.')) {
      const metadataKey = field.slice('metadata.'.length);
      return context.metadata[metadataKey];
    }

    // Check parameters
    if (field.startsWith('parameters.')) {
      const paramKey = field.slice('parameters.'.length);
      const value = context.parameters[paramKey];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
      }
    }

    return undefined;
  }

  private matchResourcePattern(resource: string, pattern: string): boolean {
    // Simple glob matching: * matches any segment, ** matches any path
    const regexPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(resource);
  }

  private escalateRisk(
    current: RiskClassification,
    incoming: RiskClassification,
  ): RiskClassification {
    const order: RiskClassification[] = ['low', 'medium', 'high', 'critical'];
    const currentIndex = order.indexOf(current);
    const incomingIndex = order.indexOf(incoming);
    return order[Math.max(currentIndex, incomingIndex)];
  }

  private escalateDecision(current: GateDecision, ruleAction: PolicyRuleAction): GateDecision {
    if (ruleAction === 'deny') return 'deny';
    if (ruleAction === 'require-approval' && current !== 'deny') return 'require-approval';
    return current;
  }

  private classifyDefaultRisk(context: ActionContext): RiskClassification {
    // Default risk based on action type patterns
    if (context.actionType.includes('delete') || context.actionType.includes('destroy')) {
      return 'high';
    }
    if (context.actionType.includes('write') || context.actionType.includes('update')) {
      return 'medium';
    }
    if (context.actionType.includes('approve') || context.actionType.includes('promote')) {
      return 'critical';
    }
    return 'low';
  }

  private createAuditEntry(
    context: ActionContext,
    decision: GateDecision,
    risk: RiskClassification,
    matchedPolicies: MatchedPolicy[],
    durationMs: number,
  ): PolicyAuditEntry {
    this.auditCounter++;
    return {
      id: `audit-${Date.now().toString(36)}-${this.auditCounter.toString(36)}`,
      correlationId: context.correlationId,
      agentId: context.agentId,
      actionType: context.actionType,
      resource: context.resource,
      environment: context.environment,
      decision,
      riskClassification: risk,
      matchedPolicies,
      evaluationDurationMs: durationMs,
      timestamp: new Date(),
    };
  }
}

export interface AuditLogQuery {
  agentId?: string;
  correlationId?: string;
  decision?: GateDecision;
  riskClassification?: RiskClassification;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  limit?: number;
  offset?: number;
}

export interface PolicyAuditExport {
  exportedAt: Date;
  totalEntries: number;
  entries: PolicyAuditEntry[];
  summary: {
    totalAllowed: number;
    totalDenied: number;
    totalRequireApproval: number;
    riskBreakdown: Record<RiskClassification, number>;
  };
}
