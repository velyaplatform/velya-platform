import { Injectable, Logger } from '@nestjs/common';
import {
  AgentDefinition,
  AgentContext,
  AgentAction,
  AgentExecutionResult,
  ExecutionStatus,
} from './agent-definition.js';

export interface DelegationRequest {
  fromAgentId: string;
  toAgentId: string;
  task: DelegationTask;
  priority: DelegationPriority;
  timeoutMs: number;
  correlationId: string;
  parentDelegationId?: string;
}

export interface DelegationTask {
  type: string;
  description: string;
  actions: AgentAction[];
  expectedOutputs: string[];
  context: Record<string, unknown>;
}

export type DelegationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type DelegationStatus =
  | 'pending'
  | 'accepted'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'rejected';

export interface DelegationRecord {
  id: string;
  request: DelegationRequest;
  status: DelegationStatus;
  result?: AgentExecutionResult;
  delegationChain: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface DelegationChain {
  rootDelegationId: string;
  rootAgentId: string;
  delegations: DelegationRecord[];
  depth: number;
  status: DelegationStatus;
  totalDurationMs: number;
}

const MAX_DELEGATION_DEPTH = 5;

@Injectable()
export class DelegationManager {
  private readonly logger = new Logger(DelegationManager.name);
  private readonly delegations = new Map<string, DelegationRecord>();
  private readonly agentResolvers = new Map<string, AgentDefinition>();
  private readonly executionHandler?: (
    agent: AgentDefinition,
    context: AgentContext,
    actions: AgentAction[],
  ) => Promise<AgentExecutionResult>;

  private delegationCounter = 0;

  registerAgent(agent: AgentDefinition): void {
    this.agentResolvers.set(agent.id, agent);
  }

  async delegate(request: DelegationRequest): Promise<DelegationRecord> {
    const delegationId = this.generateDelegationId();

    // Check delegation depth to prevent infinite loops
    const chain = this.buildDelegationChain(request.parentDelegationId);
    if (chain.length >= MAX_DELEGATION_DEPTH) {
      throw new Error(
        `Maximum delegation depth (${MAX_DELEGATION_DEPTH}) exceeded. ` +
          `Chain: ${chain.join(' -> ')} -> ${request.toAgentId}`,
      );
    }

    // Check for circular delegation
    if (chain.includes(request.toAgentId)) {
      throw new Error(
        `Circular delegation detected: ${chain.join(' -> ')} -> ${request.toAgentId}`,
      );
    }

    const record: DelegationRecord = {
      id: delegationId,
      request,
      status: 'pending',
      delegationChain: [...chain, request.fromAgentId],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.delegations.set(delegationId, record);

    this.logger.log(
      `Delegation created: id="${delegationId}" from="${request.fromAgentId}" ` +
        `to="${request.toAgentId}" task="${request.task.type}" ` +
        `depth=${chain.length + 1}`,
    );

    // Execute the delegation with timeout
    try {
      record.status = 'in-progress';
      record.updatedAt = new Date();

      const result = await this.executeWithTimeout(request, delegationId);

      record.status = result.status === 'success' ? 'completed' : 'failed';
      record.result = result;
      record.completedAt = new Date();
      record.updatedAt = new Date();

      if (result.status !== 'success') {
        record.error = result.error;
      }

      this.logger.log(
        `Delegation completed: id="${delegationId}" status="${record.status}" ` +
          `durationMs=${result.durationMs}`,
      );

      return record;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      record.status = errorMessage.includes('timed out') ? 'timeout' : 'failed';
      record.error = errorMessage;
      record.updatedAt = new Date();
      record.completedAt = new Date();

      this.logger.error(
        `Delegation failed: id="${delegationId}" error="${errorMessage}"`,
      );

      return record;
    }
  }

  getDelegation(delegationId: string): DelegationRecord | undefined {
    return this.delegations.get(delegationId);
  }

  getDelegationsByAgent(agentId: string): DelegationRecord[] {
    return Array.from(this.delegations.values()).filter(
      (d) => d.request.fromAgentId === agentId || d.request.toAgentId === agentId,
    );
  }

  getDelegationChain(delegationId: string): DelegationChain {
    const rootRecord = this.delegations.get(delegationId);
    if (!rootRecord) {
      throw new Error(`Delegation "${delegationId}" not found`);
    }

    const chainDelegations = this.findRelatedDelegations(delegationId);

    const totalDurationMs = chainDelegations.reduce((sum, d) => {
      if (d.completedAt) {
        return sum + (d.completedAt.getTime() - d.createdAt.getTime());
      }
      return sum;
    }, 0);

    return {
      rootDelegationId: delegationId,
      rootAgentId: rootRecord.request.fromAgentId,
      delegations: chainDelegations,
      depth: rootRecord.delegationChain.length,
      status: rootRecord.status,
      totalDurationMs,
    };
  }

  getActiveDelegations(): DelegationRecord[] {
    return Array.from(this.delegations.values()).filter(
      (d) => d.status === 'pending' || d.status === 'in-progress' || d.status === 'accepted',
    );
  }

  async collectResults(delegationIds: string[]): Promise<Map<string, AgentExecutionResult>> {
    const results = new Map<string, AgentExecutionResult>();

    for (const id of delegationIds) {
      const record = this.delegations.get(id);
      if (record?.result) {
        results.set(id, record.result);
      }
    }

    return results;
  }

  private async executeWithTimeout(
    request: DelegationRequest,
    delegationId: string,
  ): Promise<AgentExecutionResult> {
    return new Promise<AgentExecutionResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Delegation "${delegationId}" timed out after ${request.timeoutMs}ms`,
          ),
        );
      }, request.timeoutMs);

      this.executeDelegate(request, delegationId)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private async executeDelegate(
    request: DelegationRequest,
    delegationId: string,
  ): Promise<AgentExecutionResult> {
    const targetAgent = this.agentResolvers.get(request.toAgentId);
    if (!targetAgent) {
      throw new Error(`Target agent "${request.toAgentId}" not found for delegation`);
    }

    if (this.executionHandler) {
      const context: AgentContext = {
        agentId: request.toAgentId,
        correlationId: request.correlationId,
        parentAgentId: request.fromAgentId,
        delegationChainIds: [delegationId],
        environment: 'production',
        startedAt: new Date(),
        timeoutMs: request.timeoutMs,
        metadata: {
          delegationId,
          delegatedFrom: request.fromAgentId,
          taskType: request.task.type,
        },
      };

      return this.executionHandler(targetAgent, context, request.task.actions);
    }

    // Stub result when no execution handler is registered
    return {
      agentId: request.toAgentId,
      correlationId: request.correlationId,
      status: 'success' as ExecutionStatus,
      output: { delegationId, message: 'Delegation handler not registered' },
      decisions: [],
      durationMs: 0,
      tokensUsed: 0,
      cost: 0,
    };
  }

  private buildDelegationChain(parentDelegationId?: string): string[] {
    if (!parentDelegationId) return [];

    const parent = this.delegations.get(parentDelegationId);
    if (!parent) return [];

    return [...parent.delegationChain, parent.request.toAgentId];
  }

  private findRelatedDelegations(delegationId: string): DelegationRecord[] {
    const result: DelegationRecord[] = [];
    const record = this.delegations.get(delegationId);
    if (record) {
      result.push(record);
    }

    // Find child delegations
    for (const delegation of this.delegations.values()) {
      if (delegation.request.parentDelegationId === delegationId) {
        result.push(...this.findRelatedDelegations(delegation.id));
      }
    }

    return result;
  }

  private generateDelegationId(): string {
    this.delegationCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.delegationCounter.toString(36).padStart(4, '0');
    return `dlg-${timestamp}-${counter}`;
  }
}
