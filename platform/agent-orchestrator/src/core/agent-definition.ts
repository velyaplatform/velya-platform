/**
 * Core agent definition types for the Velya multi-agent governance architecture.
 *
 * Every agent in the system is defined by an AgentDefinition that captures its
 * identity, capabilities, constraints, and governance rules. This ensures that
 * all agents operate within well-defined boundaries with full auditability.
 */

export type AgentLayer =
  | 'governance'
  | 'executive'
  | 'management'
  | 'coordination'
  | 'specialist'
  | 'validation';

export type AutonomyLevel =
  | 'full' // Agent can act without human approval
  | 'supervised' // Agent acts but decisions are reviewed
  | 'assisted' // Agent proposes, human approves
  | 'manual'; // Agent advises, human executes

export type AgentLifecycleStage =
  | 'draft'
  | 'testing'
  | 'shadow'
  | 'sandbox'
  | 'staging'
  | 'production'
  | 'deprecated'
  | 'retired';

export interface AgentPermission {
  resource: string;
  actions: PermissionAction[];
  conditions?: PermissionCondition[];
  scope: PermissionScope;
}

export type PermissionAction = 'read' | 'write' | 'execute' | 'delegate' | 'approve';

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than' | 'in';
  value: string | number | boolean | string[];
}

export type PermissionScope = 'own' | 'office' | 'department' | 'global';

export interface AgentKPI {
  name: string;
  description: string;
  targetValue: number;
  unit: string;
  evaluationWindow: EvaluationWindow;
  threshold: KPIThreshold;
}

export interface KPIThreshold {
  warning: number;
  critical: number;
  direction: 'higher-is-better' | 'lower-is-better';
}

export type EvaluationWindow = '1h' | '6h' | '24h' | '7d' | '30d';

export interface EscalationRule {
  condition: EscalationCondition;
  escalateTo: string;
  priority: EscalationPriority;
  timeoutMs: number;
  notificationChannels: string[];
}

export interface EscalationCondition {
  type: 'error-rate' | 'latency' | 'risk-level' | 'repeated-failure' | 'manual';
  threshold: number;
  windowMs: number;
}

export type EscalationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AgentDefinition {
  id: string;
  name: string;
  office: string;
  role: string;
  layer: AgentLayer;
  charter: string;
  permissions: AgentPermission[];
  tools: string[];
  inputs: string[];
  outputs: string[];
  kpis: AgentKPI[];
  lifecycleStage: AgentLifecycleStage;
  escalationRules: EscalationRule[];
  reviewChain: string[];
  maxAutonomyLevel: AutonomyLevel;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentContext {
  agentId: string;
  correlationId: string;
  parentAgentId?: string;
  delegationChainIds: string[];
  environment: 'development' | 'staging' | 'production';
  startedAt: Date;
  timeoutMs: number;
  metadata: Record<string, string>;
}

export interface AgentAction {
  type: string;
  resource: string;
  parameters: Record<string, unknown>;
  requiredPermissions: PermissionAction[];
}

export interface AgentDecision {
  agentId: string;
  action: AgentAction;
  reasoning: string;
  confidence: number;
  riskLevel: RiskLevel;
  timestamp: Date;
  correlationId: string;
  approved: boolean;
  approvedBy?: string;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AgentExecutionResult {
  agentId: string;
  correlationId: string;
  status: ExecutionStatus;
  output: Record<string, unknown>;
  decisions: AgentDecision[];
  durationMs: number;
  tokensUsed: number;
  cost: number;
  error?: string;
}

export type ExecutionStatus = 'success' | 'failure' | 'timeout' | 'escalated' | 'denied';
