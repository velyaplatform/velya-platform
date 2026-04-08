import { Injectable, Logger } from '@nestjs/common';
import {
  AgentDefinition,
  AgentContext,
  AgentAction,
  AgentDecision,
  AgentExecutionResult,
  ExecutionStatus,
  RiskLevel,
} from './agent-definition.js';
import { PolicyGate } from '../governance/policy-gate.js';
import { AgentScorecard } from '../governance/scorecard.js';

export interface ToolExecutionRequest {
  toolName: string;
  parameters: Record<string, unknown>;
  agentId: string;
  correlationId: string;
}

export interface ToolExecutionResponse {
  toolName: string;
  success: boolean;
  result: Record<string, unknown>;
  durationMs: number;
  error?: string;
}

export type ToolExecutor = (request: ToolExecutionRequest) => Promise<ToolExecutionResponse>;

interface CircuitBreakerState {
  agentId: string;
  consecutiveFailures: number;
  lastFailureAt: Date | null;
  state: 'closed' | 'open' | 'half-open';
  openedAt: Date | null;
}

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60_000;

@Injectable()
export class AgentRuntime {
  private readonly logger = new Logger(AgentRuntime.name);
  private readonly toolExecutors = new Map<string, ToolExecutor>();
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  private readonly activeExecutions = new Map<string, AbortController>();

  constructor(
    private readonly policyGate: PolicyGate,
    private readonly scorecard: AgentScorecard,
  ) {}

  registerTool(toolName: string, executor: ToolExecutor): void {
    this.toolExecutors.set(toolName, executor);
    this.logger.log(`Registered tool: ${toolName}`);
  }

  async execute(
    agent: AgentDefinition,
    context: AgentContext,
    actions: AgentAction[],
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const decisions: AgentDecision[] = [];
    const abortController = new AbortController();
    this.activeExecutions.set(context.correlationId, abortController);

    try {
      // Check circuit breaker
      this.checkCircuitBreaker(agent.id);

      // Enforce lifecycle stage
      this.enforceLifecycleStage(agent);

      // Set up timeout
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, context.timeoutMs);

      try {
        const output: Record<string, unknown> = {};

        for (const action of actions) {
          if (abortController.signal.aborted) {
            return this.buildResult(
              agent.id,
              context.correlationId,
              'timeout',
              output,
              decisions,
              startTime,
              'Execution timed out',
            );
          }

          const decision = await this.processAction(agent, context, action);
          decisions.push(decision);

          if (!decision.approved) {
            this.logger.warn(
              `Action denied for agent="${agent.id}" action="${action.type}" ` +
                `reason="policy gate denied"`,
            );
            continue;
          }

          const toolResult = await this.executeTool({
            toolName: action.type,
            parameters: action.parameters,
            agentId: agent.id,
            correlationId: context.correlationId,
          });

          output[action.type] = toolResult.result;

          if (!toolResult.success) {
            this.logger.error(
              `Tool execution failed: agent="${agent.id}" tool="${action.type}" ` +
                `error="${toolResult.error}"`,
            );
          }
        }

        this.resetCircuitBreaker(agent.id);

        const result = this.buildResult(
          agent.id,
          context.correlationId,
          'success',
          output,
          decisions,
          startTime,
        );

        this.scorecard.recordExecution(agent.id, result);
        return result;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.incrementCircuitBreaker(agent.id);

      const status: ExecutionStatus = errorMessage.includes('Circuit breaker is open')
        ? 'denied'
        : 'failure';

      const result = this.buildResult(
        agent.id,
        context.correlationId,
        status,
        {},
        decisions,
        startTime,
        errorMessage,
      );

      this.scorecard.recordExecution(agent.id, result);
      return result;
    } finally {
      this.activeExecutions.delete(context.correlationId);
    }
  }

  cancelExecution(correlationId: string): boolean {
    const controller = this.activeExecutions.get(correlationId);
    if (controller) {
      controller.abort();
      this.logger.warn(`Cancelled execution: correlationId="${correlationId}"`);
      return true;
    }
    return false;
  }

  private async processAction(
    agent: AgentDefinition,
    context: AgentContext,
    action: AgentAction,
  ): Promise<AgentDecision> {
    const riskLevel = this.classifyRisk(action);

    const gateResult = await this.policyGate.evaluate({
      agentId: agent.id,
      agentLayer: agent.layer,
      action,
      autonomyLevel: agent.maxAutonomyLevel,
      permissions: agent.permissions,
      riskLevel,
      correlationId: context.correlationId,
      environment: context.environment,
    });

    const decision: AgentDecision = {
      agentId: agent.id,
      action,
      reasoning: gateResult.reason,
      confidence: 1.0,
      riskLevel,
      timestamp: new Date(),
      correlationId: context.correlationId,
      approved: gateResult.decision === 'allow',
      approvedBy: gateResult.decision === 'allow' ? 'policy-gate' : undefined,
    };

    this.logger.debug(
      `Decision: agent="${agent.id}" action="${action.type}" ` +
        `risk="${riskLevel}" approved=${decision.approved}`,
    );

    return decision;
  }

  private async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    const executor = this.toolExecutors.get(request.toolName);

    if (!executor) {
      return {
        toolName: request.toolName,
        success: false,
        result: {},
        durationMs: 0,
        error: `Tool "${request.toolName}" is not registered`,
      };
    }

    const startTime = Date.now();

    try {
      const result = await executor(request);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        toolName: request.toolName,
        success: false,
        result: {},
        durationMs: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }

  private classifyRisk(action: AgentAction): RiskLevel {
    const writeActions = action.requiredPermissions.filter(
      (p) => p === 'write' || p === 'execute' || p === 'approve',
    );

    if (writeActions.includes('approve')) {
      return 'critical';
    }

    if (writeActions.includes('execute')) {
      return 'high';
    }

    if (writeActions.includes('write')) {
      return 'medium';
    }

    return 'low';
  }

  private enforceLifecycleStage(agent: AgentDefinition): void {
    const blockedStages: Set<string> = new Set(['draft', 'retired']);

    if (blockedStages.has(agent.lifecycleStage)) {
      throw new Error(
        `Agent "${agent.id}" cannot execute in lifecycle stage "${agent.lifecycleStage}"`,
      );
    }
  }

  private checkCircuitBreaker(agentId: string): void {
    const state = this.circuitBreakers.get(agentId);
    if (!state) return;

    if (state.state === 'open') {
      const timeSinceOpen = state.openedAt
        ? Date.now() - state.openedAt.getTime()
        : 0;

      if (timeSinceOpen >= CIRCUIT_BREAKER_RESET_MS) {
        state.state = 'half-open';
        this.logger.log(`Circuit breaker half-open for agent="${agentId}"`);
      } else {
        throw new Error(
          `Circuit breaker is open for agent "${agentId}". ` +
            `${CIRCUIT_BREAKER_RESET_MS - timeSinceOpen}ms until retry.`,
        );
      }
    }
  }

  private incrementCircuitBreaker(agentId: string): void {
    let state = this.circuitBreakers.get(agentId);
    if (!state) {
      state = {
        agentId,
        consecutiveFailures: 0,
        lastFailureAt: null,
        state: 'closed',
        openedAt: null,
      };
      this.circuitBreakers.set(agentId, state);
    }

    state.consecutiveFailures++;
    state.lastFailureAt = new Date();

    if (state.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      state.state = 'open';
      state.openedAt = new Date();
      this.logger.warn(
        `Circuit breaker opened for agent="${agentId}" after ${state.consecutiveFailures} failures`,
      );
    }
  }

  private resetCircuitBreaker(agentId: string): void {
    const state = this.circuitBreakers.get(agentId);
    if (state) {
      state.consecutiveFailures = 0;
      state.state = 'closed';
      state.openedAt = null;
    }
  }

  private buildResult(
    agentId: string,
    correlationId: string,
    status: ExecutionStatus,
    output: Record<string, unknown>,
    decisions: AgentDecision[],
    startTime: number,
    error?: string,
  ): AgentExecutionResult {
    return {
      agentId,
      correlationId,
      status,
      output,
      decisions,
      durationMs: Date.now() - startTime,
      tokensUsed: 0,
      cost: 0,
      error,
    };
  }
}
