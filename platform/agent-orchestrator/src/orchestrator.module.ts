import { Module } from '@nestjs/common';
import { AgentRuntime } from './core/agent-runtime.js';
import { AgentLifecycleManager } from './core/agent-lifecycle.js';
import { DelegationManager } from './core/delegation.js';
import { PolicyGate } from './governance/policy-gate.js';
import { AgentScorecard } from './governance/scorecard.js';

@Module({
  providers: [AgentRuntime, AgentLifecycleManager, DelegationManager, PolicyGate, AgentScorecard],
  exports: [AgentRuntime, AgentLifecycleManager, DelegationManager, PolicyGate, AgentScorecard],
})
export class OrchestratorModule {}
