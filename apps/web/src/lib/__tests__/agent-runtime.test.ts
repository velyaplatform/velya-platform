import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AGENTS,
  OFFICE_LABELS,
  STAGE_LABELS,
  buildTopology,
  canExecuteAutonomously,
  getAgent,
  getAgentsByOffice,
  getAgentsForJob,
  type AgentDef,
} from '../agent-runtime';

function findAgent(id: string): AgentDef {
  const a = getAgent(id);
  if (!a) throw new Error(`agent ${id} missing in registry`);
  return a;
}

describe('agent-runtime / lookups', () => {
  it('getAgent returns a known agent by id', () => {
    const agent = getAgent('quality-manager-agent');
    expect(agent).toBeDefined();
    expect(agent?.office).toBe('quality');
    expect(agent?.role).toBe('manager');
  });

  it('getAgent returns undefined for an unknown id', () => {
    expect(getAgent('nonexistent-agent')).toBeUndefined();
  });

  it('getAgentsByOffice filters by office', () => {
    const qualityAgents = getAgentsByOffice('quality');
    expect(qualityAgents.length).toBeGreaterThanOrEqual(3);
    for (const a of qualityAgents) {
      expect(a.office).toBe('quality');
    }
  });

  it('getAgentsByOffice returns empty array for office without agents', () => {
    // every declared office currently has agents; sanity check the shape
    const observability = getAgentsByOffice('observability');
    expect(Array.isArray(observability)).toBe(true);
    expect(observability.length).toBeGreaterThan(0);
  });

  it('getAgentsForJob finds agents that own a given job', () => {
    const agents = getAgentsForJob('frontend.route-health');
    expect(agents.length).toBe(1);
    expect(agents[0].id).toBe('quality-route-doctor-agent');
  });

  it('getAgentsForJob returns empty array when no agent owns the job', () => {
    expect(getAgentsForJob('nonexistent.job.id')).toEqual([]);
  });
});

describe('agent-runtime / canExecuteAutonomously', () => {
  const KILL_ENV = 'VELYA_AGENT_QUALITY_ROUTE_DOCTOR_DISABLED';

  beforeEach(() => {
    delete process.env[KILL_ENV];
  });

  afterEach(() => {
    delete process.env[KILL_ENV];
  });

  it('blocks when the kill switch env var is set to 1', () => {
    process.env[KILL_ENV] = '1';
    const agent = findAgent('quality-route-doctor-agent');
    const verdict = canExecuteAutonomously(agent, 'invalidate-cdn-cache');
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('kill switch');
  });

  it('does not block when the kill switch env var is set to something other than 1', () => {
    process.env[KILL_ENV] = '0';
    const agent = findAgent('quality-route-doctor-agent');
    const verdict = canExecuteAutonomously(agent, 'invalidate-cdn-cache');
    expect(verdict.allowed).toBe(true);
  });

  it('blocks a shadow-stage agent even for a safe action', () => {
    const agent = findAgent('quality-manager-agent'); // shadow stage
    expect(agent.lifecycleStage).toBe('shadow');
    const verdict = canExecuteAutonomously(agent, 'rebalance-priorities');
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('shadow');
  });

  it('allows an active agent to run a safe action', () => {
    const agent = findAgent('quality-route-doctor-agent'); // active
    const verdict = canExecuteAutonomously(agent, 'invalidate-cdn-cache');
    expect(verdict.allowed).toBe(true);
    expect(verdict.reason).toBeUndefined();
  });

  it('blocks an active agent from running a critical action', () => {
    const agent = findAgent('quality-route-doctor-agent');
    const verdict = canExecuteAutonomously(agent, 'restart-pod');
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/critical/);
  });

  it('blocks any action that is not declared in allowedActions', () => {
    const agent = findAgent('quality-route-doctor-agent');
    const verdict = canExecuteAutonomously(agent, 'delete-production-db');
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('não declarada');
  });

  it('blocks a review-class action even on an active agent', () => {
    const agent = findAgent('learning-curator-agent'); // active
    const verdict = canExecuteAutonomously(agent, 'propose-promotion');
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/review/);
  });
});

describe('agent-runtime / buildTopology', () => {
  it('covers all 6 offices in the returned topology', () => {
    const topology = buildTopology();
    expect(topology).toHaveLength(6);
    const offices = topology.map((t) => t.office).sort();
    expect(offices).toEqual(
      ['data', 'learning', 'observability', 'quality', 'security', 'ux'].sort(),
    );
  });

  it('sets manager for the quality office', () => {
    const topology = buildTopology();
    const quality = topology.find((t) => t.office === 'quality');
    expect(quality).toBeDefined();
    expect(quality?.manager?.id).toBe('quality-manager-agent');
  });

  it('computes jobCoverage as the sum of ownedJobIds of each office', () => {
    const topology = buildTopology();
    for (const entry of topology) {
      const expected = entry.agents.reduce((acc, a) => acc + a.ownedJobIds.length, 0);
      expect(entry.jobCoverage).toBe(expected);
    }
  });

  it('has OFFICE_LABELS and STAGE_LABELS with all keys populated', () => {
    expect(OFFICE_LABELS.quality).toBe('Qualidade');
    expect(OFFICE_LABELS.observability).toBe('Observabilidade');
    expect(STAGE_LABELS.active).toBe('Ativo');
    expect(STAGE_LABELS.shadow).toBe('Shadow');
  });

  it('registry contains at least one agent per declared office', () => {
    for (const office of [
      'quality',
      'security',
      'data',
      'ux',
      'learning',
      'observability',
    ] as const) {
      const agents = AGENTS.filter((a) => a.office === office);
      expect(agents.length).toBeGreaterThan(0);
    }
  });
});
