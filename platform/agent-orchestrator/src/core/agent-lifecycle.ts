import { Injectable, Logger } from '@nestjs/common';
import { AgentDefinition, AgentLifecycleStage } from './agent-definition.js';

export interface LifecycleTransition {
  from: AgentLifecycleStage;
  to: AgentLifecycleStage;
  agentId: string;
  reason: string;
  performedBy: string;
  timestamp: Date;
}

export interface PromotionRequirements {
  stage: AgentLifecycleStage;
  minimumDurationMs: number;
  requiredSuccessRate: number;
  requiredMinimumExecutions: number;
  requiresApproval: boolean;
  approverRoles: string[];
  healthChecks: string[];
}

export interface PromotionEligibility {
  eligible: boolean;
  currentStage: AgentLifecycleStage;
  nextStage: AgentLifecycleStage | null;
  blockers: string[];
  requirements: PromotionRequirements | null;
}

export interface AgentHealthCheck {
  agentId: string;
  healthy: boolean;
  checks: HealthCheckResult[];
  timestamp: Date;
}

export interface HealthCheckResult {
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

/**
 * Valid lifecycle transitions. An agent can only move through these defined paths.
 *
 * draft -> testing -> shadow -> sandbox -> staging -> production -> deprecated -> retired
 *
 * Backward transitions are allowed for rollback: production -> staging, staging -> sandbox.
 */
const VALID_TRANSITIONS: ReadonlyMap<AgentLifecycleStage, AgentLifecycleStage[]> = new Map([
  ['draft', ['testing']],
  ['testing', ['shadow', 'draft']],
  ['shadow', ['sandbox', 'testing']],
  ['sandbox', ['staging', 'shadow']],
  ['staging', ['production', 'sandbox']],
  ['production', ['deprecated', 'staging']],
  ['deprecated', ['retired', 'production']],
  ['retired', []],
]);

const DEFAULT_PROMOTION_REQUIREMENTS: ReadonlyMap<AgentLifecycleStage, PromotionRequirements> =
  new Map([
    [
      'testing',
      {
        stage: 'testing',
        minimumDurationMs: 0,
        requiredSuccessRate: 0,
        requiredMinimumExecutions: 0,
        requiresApproval: false,
        approverRoles: [],
        healthChecks: ['syntax', 'schema-validation'],
      },
    ],
    [
      'shadow',
      {
        stage: 'shadow',
        minimumDurationMs: 24 * 60 * 60 * 1000, // 24 hours
        requiredSuccessRate: 0.9,
        requiredMinimumExecutions: 10,
        requiresApproval: false,
        approverRoles: [],
        healthChecks: ['syntax', 'schema-validation', 'shadow-comparison'],
      },
    ],
    [
      'sandbox',
      {
        stage: 'sandbox',
        minimumDurationMs: 48 * 60 * 60 * 1000, // 48 hours
        requiredSuccessRate: 0.95,
        requiredMinimumExecutions: 50,
        requiresApproval: true,
        approverRoles: ['agent-manager'],
        healthChecks: ['syntax', 'schema-validation', 'integration'],
      },
    ],
    [
      'staging',
      {
        stage: 'staging',
        minimumDurationMs: 72 * 60 * 60 * 1000, // 72 hours
        requiredSuccessRate: 0.98,
        requiredMinimumExecutions: 100,
        requiresApproval: true,
        approverRoles: ['agent-manager', 'platform-admin'],
        healthChecks: ['syntax', 'schema-validation', 'integration', 'performance'],
      },
    ],
    [
      'production',
      {
        stage: 'production',
        minimumDurationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
        requiredSuccessRate: 0.99,
        requiredMinimumExecutions: 500,
        requiresApproval: true,
        approverRoles: ['platform-admin', 'cto'],
        healthChecks: ['syntax', 'schema-validation', 'integration', 'performance', 'security'],
      },
    ],
  ]);

@Injectable()
export class AgentLifecycleManager {
  private readonly logger = new Logger(AgentLifecycleManager.name);
  private readonly transitionHistory: LifecycleTransition[] = [];
  private readonly agentStages = new Map<string, AgentLifecycleStage>();
  private readonly stageEntryTimes = new Map<string, Date>();

  transition(
    agent: AgentDefinition,
    targetStage: AgentLifecycleStage,
    reason: string,
    performedBy: string,
  ): LifecycleTransition {
    const currentStage = this.getStage(agent.id) ?? agent.lifecycleStage;
    const validTargets = VALID_TRANSITIONS.get(currentStage) ?? [];

    if (!validTargets.includes(targetStage)) {
      throw new Error(
        `Invalid lifecycle transition for agent "${agent.id}": ` +
          `"${currentStage}" -> "${targetStage}". ` +
          `Valid targets: ${validTargets.join(', ') || 'none'}`,
      );
    }

    const transition: LifecycleTransition = {
      from: currentStage,
      to: targetStage,
      agentId: agent.id,
      reason,
      performedBy,
      timestamp: new Date(),
    };

    this.agentStages.set(agent.id, targetStage);
    this.stageEntryTimes.set(agent.id, new Date());
    this.transitionHistory.push(transition);

    this.logger.log(
      `Lifecycle transition: agent="${agent.id}" "${currentStage}" -> "${targetStage}" ` +
        `by="${performedBy}" reason="${reason}"`,
    );

    return transition;
  }

  getStage(agentId: string): AgentLifecycleStage | undefined {
    return this.agentStages.get(agentId);
  }

  checkPromotionEligibility(
    agent: AgentDefinition,
    successRate: number,
    executionCount: number,
  ): PromotionEligibility {
    const currentStage = this.getStage(agent.id) ?? agent.lifecycleStage;
    const validTargets = VALID_TRANSITIONS.get(currentStage) ?? [];

    // Find the forward (non-rollback) target
    const forwardTarget = validTargets.find((target) => {
      const stageOrder: AgentLifecycleStage[] = [
        'draft',
        'testing',
        'shadow',
        'sandbox',
        'staging',
        'production',
        'deprecated',
        'retired',
      ];
      return stageOrder.indexOf(target) > stageOrder.indexOf(currentStage);
    });

    if (!forwardTarget) {
      return {
        eligible: false,
        currentStage,
        nextStage: null,
        blockers: ['No forward promotion path available'],
        requirements: null,
      };
    }

    const requirements = DEFAULT_PROMOTION_REQUIREMENTS.get(forwardTarget);
    if (!requirements) {
      return {
        eligible: true,
        currentStage,
        nextStage: forwardTarget,
        blockers: [],
        requirements: null,
      };
    }

    const blockers: string[] = [];

    // Check minimum duration
    const entryTime = this.stageEntryTimes.get(agent.id);
    if (entryTime) {
      const timeInStage = Date.now() - entryTime.getTime();
      if (timeInStage < requirements.minimumDurationMs) {
        const remainingMs = requirements.minimumDurationMs - timeInStage;
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        blockers.push(`Minimum duration not met: ${remainingHours}h remaining`);
      }
    }

    // Check success rate
    if (successRate < requirements.requiredSuccessRate) {
      blockers.push(
        `Success rate ${(successRate * 100).toFixed(1)}% below required ${(requirements.requiredSuccessRate * 100).toFixed(1)}%`,
      );
    }

    // Check minimum executions
    if (executionCount < requirements.requiredMinimumExecutions) {
      blockers.push(
        `Execution count ${executionCount} below required ${requirements.requiredMinimumExecutions}`,
      );
    }

    if (requirements.requiresApproval) {
      blockers.push(`Requires approval from: ${requirements.approverRoles.join(', ')}`);
    }

    return {
      eligible: blockers.length === 0,
      currentStage,
      nextStage: forwardTarget,
      blockers,
      requirements,
    };
  }

  async runHealthChecks(
    agent: AgentDefinition,
    checkExecutors: Map<string, () => Promise<HealthCheckResult>>,
  ): Promise<AgentHealthCheck> {
    const currentStage = this.getStage(agent.id) ?? agent.lifecycleStage;
    const requirements = DEFAULT_PROMOTION_REQUIREMENTS.get(currentStage);
    const requiredChecks = requirements?.healthChecks ?? [];

    const results: HealthCheckResult[] = [];

    for (const checkName of requiredChecks) {
      const executor = checkExecutors.get(checkName);
      if (!executor) {
        results.push({
          name: checkName,
          passed: false,
          message: `Health check "${checkName}" not implemented`,
          durationMs: 0,
        });
        continue;
      }

      try {
        const result = await executor();
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          name: checkName,
          passed: false,
          message: `Health check failed: ${errorMessage}`,
          durationMs: 0,
        });
      }
    }

    const healthy = results.every((r) => r.passed);

    return {
      agentId: agent.id,
      healthy,
      checks: results,
      timestamp: new Date(),
    };
  }

  getTransitionHistory(agentId: string): LifecycleTransition[] {
    return this.transitionHistory.filter((t) => t.agentId === agentId);
  }

  getAllTransitions(): LifecycleTransition[] {
    return [...this.transitionHistory];
  }
}
