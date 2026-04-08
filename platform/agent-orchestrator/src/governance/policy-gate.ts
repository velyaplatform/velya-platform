import { Injectable, Logger } from '@nestjs/common';
import {
  AgentAction,
  AgentLayer,
  AgentPermission,
  AutonomyLevel,
  PermissionAction,
  RiskLevel,
} from '../core/agent-definition.js';

export interface PolicyGateRequest {
  agentId: string;
  agentLayer: AgentLayer;
  action: AgentAction;
  autonomyLevel: AutonomyLevel;
  permissions: AgentPermission[];
  riskLevel: RiskLevel;
  correlationId: string;
  environment: 'development' | 'staging' | 'production';
}

export type GateDecision = 'allow' | 'deny' | 'require-approval';

export interface PolicyGateResult {
  decision: GateDecision;
  reason: string;
  riskLevel: RiskLevel;
  checks: PolicyCheck[];
  timestamp: Date;
  correlationId: string;
  requiresFourEyes: boolean;
}

export interface PolicyCheck {
  name: string;
  passed: boolean;
  reason: string;
}

export interface FourEyesRecord {
  id: string;
  agentId: string;
  action: AgentAction;
  riskLevel: RiskLevel;
  requestedAt: Date;
  requestedBy: string;
  approvedAt?: Date;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: Date;
  correlationId: string;
}

const FOUR_EYES_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class PolicyGate {
  private readonly logger = new Logger(PolicyGate.name);
  private readonly fourEyesRecords = new Map<string, FourEyesRecord>();
  private fourEyesCounter = 0;

  async evaluate(request: PolicyGateRequest): Promise<PolicyGateResult> {
    const checks: PolicyCheck[] = [];

    // Check 1: Risk classification
    const riskCheck = this.checkRiskLevel(request);
    checks.push(riskCheck);

    // Check 2: Permission verification
    const permissionCheck = this.checkPermissions(request);
    checks.push(permissionCheck);

    // Check 3: Autonomy level
    const autonomyCheck = this.checkAutonomyLevel(request);
    checks.push(autonomyCheck);

    // Check 4: Environment restrictions
    const envCheck = this.checkEnvironmentRestrictions(request);
    checks.push(envCheck);

    // Check 5: Four-eyes requirement for critical actions
    const fourEyesCheck = this.checkFourEyesRequirement(request);
    checks.push(fourEyesCheck);

    // Determine overall decision
    const allPassed = checks.every((c) => c.passed);
    const requiresFourEyes = !fourEyesCheck.passed && request.riskLevel === 'critical';

    let decision: GateDecision;
    let reason: string;

    if (allPassed) {
      decision = 'allow';
      reason = 'All policy checks passed';
    } else if (requiresFourEyes) {
      decision = 'require-approval';
      reason = 'Action requires four-eyes approval due to critical risk level';
    } else {
      decision = 'deny';
      const failedChecks = checks.filter((c) => !c.passed);
      reason = `Policy checks failed: ${failedChecks.map((c) => c.name).join(', ')}`;
    }

    const result: PolicyGateResult = {
      decision,
      reason,
      riskLevel: request.riskLevel,
      checks,
      timestamp: new Date(),
      correlationId: request.correlationId,
      requiresFourEyes,
    };

    this.logger.log(
      `Policy gate: agent="${request.agentId}" action="${request.action.type}" ` +
        `decision="${decision}" risk="${request.riskLevel}" ` +
        `correlationId="${request.correlationId}"`,
    );

    return result;
  }

  requestFourEyesApproval(
    agentId: string,
    action: AgentAction,
    riskLevel: RiskLevel,
    correlationId: string,
  ): FourEyesRecord {
    this.fourEyesCounter++;
    const id = `4eye-${Date.now().toString(36)}-${this.fourEyesCounter.toString(36)}`;

    const record: FourEyesRecord = {
      id,
      agentId,
      action,
      riskLevel,
      requestedAt: new Date(),
      requestedBy: agentId,
      status: 'pending',
      expiresAt: new Date(Date.now() + FOUR_EYES_EXPIRY_MS),
      correlationId,
    };

    this.fourEyesRecords.set(id, record);

    this.logger.log(
      `Four-eyes approval requested: id="${id}" agent="${agentId}" ` +
        `action="${action.type}" expiresAt="${record.expiresAt.toISOString()}"`,
    );

    return record;
  }

  approveFourEyes(recordId: string, approvedBy: string): FourEyesRecord {
    const record = this.fourEyesRecords.get(recordId);
    if (!record) {
      throw new Error(`Four-eyes record "${recordId}" not found`);
    }

    if (record.status !== 'pending') {
      throw new Error(`Four-eyes record "${recordId}" is already "${record.status}"`);
    }

    if (new Date() > record.expiresAt) {
      record.status = 'expired';
      throw new Error(`Four-eyes record "${recordId}" has expired`);
    }

    // The approver must be different from the requester (four-eyes principle)
    if (approvedBy === record.requestedBy) {
      throw new Error(
        `Four-eyes principle violation: requester "${record.requestedBy}" cannot self-approve`,
      );
    }

    record.status = 'approved';
    record.approvedAt = new Date();
    record.approvedBy = approvedBy;

    this.logger.log(
      `Four-eyes approved: id="${recordId}" approvedBy="${approvedBy}"`,
    );

    return record;
  }

  rejectFourEyes(recordId: string, rejectedBy: string): FourEyesRecord {
    const record = this.fourEyesRecords.get(recordId);
    if (!record) {
      throw new Error(`Four-eyes record "${recordId}" not found`);
    }

    if (record.status !== 'pending') {
      throw new Error(`Four-eyes record "${recordId}" is already "${record.status}"`);
    }

    record.status = 'rejected';
    record.approvedBy = rejectedBy;
    record.approvedAt = new Date();

    this.logger.log(
      `Four-eyes rejected: id="${recordId}" rejectedBy="${rejectedBy}"`,
    );

    return record;
  }

  getPendingApprovals(): FourEyesRecord[] {
    const now = new Date();
    return Array.from(this.fourEyesRecords.values()).filter((r) => {
      if (r.status === 'pending' && now > r.expiresAt) {
        r.status = 'expired';
        return false;
      }
      return r.status === 'pending';
    });
  }

  private checkRiskLevel(request: PolicyGateRequest): PolicyCheck {
    const layerRiskLimits: Record<AgentLayer, RiskLevel[]> = {
      governance: ['low', 'medium', 'high', 'critical'],
      executive: ['low', 'medium', 'high', 'critical'],
      management: ['low', 'medium', 'high'],
      coordination: ['low', 'medium'],
      specialist: ['low', 'medium'],
      validation: ['low'],
    };

    const allowedRisks = layerRiskLimits[request.agentLayer];
    const passed = allowedRisks.includes(request.riskLevel);

    return {
      name: 'risk-level',
      passed,
      reason: passed
        ? `Risk level "${request.riskLevel}" is within bounds for layer "${request.agentLayer}"`
        : `Risk level "${request.riskLevel}" exceeds maximum for layer "${request.agentLayer}"`,
    };
  }

  private checkPermissions(request: PolicyGateRequest): PolicyCheck {
    const requiredActions = request.action.requiredPermissions;
    const resource = request.action.resource;

    const matchingPermissions = request.permissions.filter((p) =>
      p.resource === resource || p.resource === '*',
    );

    if (matchingPermissions.length === 0) {
      return {
        name: 'permissions',
        passed: false,
        reason: `No permissions found for resource "${resource}"`,
      };
    }

    const grantedActions = new Set<PermissionAction>();
    for (const perm of matchingPermissions) {
      for (const action of perm.actions) {
        grantedActions.add(action);
      }
    }

    const missingActions = requiredActions.filter((a) => !grantedActions.has(a));

    if (missingActions.length > 0) {
      return {
        name: 'permissions',
        passed: false,
        reason: `Missing required permissions: ${missingActions.join(', ')} on resource "${resource}"`,
      };
    }

    return {
      name: 'permissions',
      passed: true,
      reason: `All required permissions granted for resource "${resource}"`,
    };
  }

  private checkAutonomyLevel(request: PolicyGateRequest): PolicyCheck {
    const autonomyOrder: AutonomyLevel[] = ['manual', 'assisted', 'supervised', 'full'];
    const riskToRequiredAutonomy: Record<RiskLevel, AutonomyLevel> = {
      low: 'assisted',
      medium: 'supervised',
      high: 'supervised',
      critical: 'full',
    };

    const requiredLevel = riskToRequiredAutonomy[request.riskLevel];
    const agentLevelIndex = autonomyOrder.indexOf(request.autonomyLevel);
    const requiredLevelIndex = autonomyOrder.indexOf(requiredLevel);

    const passed = agentLevelIndex >= requiredLevelIndex;

    return {
      name: 'autonomy-level',
      passed,
      reason: passed
        ? `Agent autonomy level "${request.autonomyLevel}" is sufficient for risk "${request.riskLevel}"`
        : `Agent autonomy level "${request.autonomyLevel}" is insufficient; ` +
          `risk "${request.riskLevel}" requires at least "${requiredLevel}"`,
    };
  }

  private checkEnvironmentRestrictions(request: PolicyGateRequest): PolicyCheck {
    // In production, only governance and executive layers can perform high/critical risk actions
    if (request.environment === 'production') {
      const highRiskLayers: Set<AgentLayer> = new Set(['governance', 'executive']);

      if (
        (request.riskLevel === 'high' || request.riskLevel === 'critical') &&
        !highRiskLayers.has(request.agentLayer)
      ) {
        return {
          name: 'environment-restrictions',
          passed: false,
          reason: `Agent layer "${request.agentLayer}" cannot perform ${request.riskLevel}-risk ` +
            `actions in production environment`,
        };
      }
    }

    return {
      name: 'environment-restrictions',
      passed: true,
      reason: `Environment "${request.environment}" allows action for layer "${request.agentLayer}"`,
    };
  }

  private checkFourEyesRequirement(request: PolicyGateRequest): PolicyCheck {
    if (request.riskLevel !== 'critical') {
      return {
        name: 'four-eyes',
        passed: true,
        reason: 'Four-eyes check not required for non-critical risk',
      };
    }

    // Check if there's an approved four-eyes record for this action
    const approvedRecord = Array.from(this.fourEyesRecords.values()).find(
      (r) =>
        r.agentId === request.agentId &&
        r.action.type === request.action.type &&
        r.action.resource === request.action.resource &&
        r.status === 'approved' &&
        r.correlationId === request.correlationId,
    );

    if (approvedRecord) {
      return {
        name: 'four-eyes',
        passed: true,
        reason: `Four-eyes approval granted by "${approvedRecord.approvedBy}"`,
      };
    }

    return {
      name: 'four-eyes',
      passed: false,
      reason: 'Critical action requires four-eyes approval',
    };
  }
}
