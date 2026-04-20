import { describe, it, expect } from 'vitest';
import {
  buildTriggerRoutingPlan,
  inferContextTagsFromText,
} from './contextual-trigger-routing.js';

describe('contextual-trigger-routing', () => {
  it('infers tags from free-form infrastructure text', () => {
    const tags = inferContextTagsFromText(
      'AWS EKS cluster drift with Terragrunt dependency issue and ArgoCD sync failure',
    );
    expect(tags).toContain('aws');
    expect(tags).toContain('eks');
    expect(tags).toContain('terragrunt');
    expect(tags).toContain('argocd');
  });

  it('routes directly to the AWS specialist when the context is unambiguous', () => {
    const plan = buildTriggerRoutingPlan({
      fromAgent: 'infra-health-agent',
      actionType: 'correction',
      contextTags: ['aws'],
      description: 'Corrigir IAM policy quebrada na AWS',
      productContext: 'shared',
    });

    expect(plan.decision).toBe('direct');
    expect(plan.selectedAgentId).toBe('aws-specialist-agent');
    expect(plan.delegates.map((delegate) => delegate.agentId)).toContain('aws-specialist-agent');
    expect(plan.delegates.map((delegate) => delegate.agentId)).not.toContain('grafana-specialist-agent');
  });

  it('routes through the coordinator when multiple specialists are required by context', () => {
    const plan = buildTriggerRoutingPlan({
      fromAgent: 'infra-health-agent',
      actionType: 'validation',
      contextTags: ['aws', 'terragrunt', 'opentofu'],
      description: 'Validar stack AWS provisionada por Terragrunt/OpenTofu',
      productContext: 'shared',
    });

    expect(plan.decision).toBe('coordinated');
    expect(plan.selectedAgentId).toBe('delegation-coordinator-agent');
    expect(plan.delegates.map((delegate) => delegate.agentId)).toContain('aws-specialist-agent');
    expect(plan.delegates.map((delegate) => delegate.agentId)).toContain('terragrunt-specialist-agent');
    expect(plan.delegates.map((delegate) => delegate.agentId)).toContain('opentofu-specialist-agent');
  });

  it('keeps hospital validation inside hospital context', () => {
    const plan = buildTriggerRoutingPlan({
      fromAgent: 'backend-quality-agent',
      actionType: 'validation',
      contextTags: ['fhir', 'hipaa'],
      description: 'Validar fluxo FHIR com PHI',
      productContext: 'hospitalar',
    });

    expect(plan.delegates.map((delegate) => delegate.agentId)).toContain(
      'medplum-fhir-specialist-agent',
    );
    expect(plan.delegates.map((delegate) => delegate.agentId)).toContain(
      'hipaa-compliance-agent',
    );
    expect(plan.delegates.map((delegate) => delegate.agentId)).not.toContain(
      'soc-threat-hunting-agent',
    );
  });

  it('falls back to the coordinator instead of fanning out to irrelevant agents', () => {
    const plan = buildTriggerRoutingPlan({
      fromAgent: 'web-research-agent',
      actionType: 'improvement',
      contextTags: ['unknown-domain'],
      description: 'Melhorar algo sem specialist mapeado',
      productContext: 'shared',
    });

    expect(plan.decision).toBe('coordinated');
    expect(plan.selectedAgentId).toBe('delegation-coordinator-agent');
    expect(plan.delegates).toHaveLength(0);
  });
});
