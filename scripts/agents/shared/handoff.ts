/**
 * handoff.ts — emit ClinicalHandoff records when an agent cannot resolve
 * a finding on its own. The sentinel picks these up and surfaces them as
 * GitHub issues with the right labels + routing.
 *
 * Handoffs are append-only. Never delete; let the sentinel close them.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type HandoffSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ClinicalImpact =
  | 'none'
  | 'advisory'
  | 'non-clinical-ops'
  | 'clinical-workflow'
  | 'patient-safety';

export interface ClinicalHandoff {
  handoffId: string;
  createdAt: string;
  fromAgent: string;
  toAgent?: string;
  severity: HandoffSeverity;
  clinicalImpact?: ClinicalImpact;
  reason: string;
  context: {
    target: { kind: string; name: string; namespace?: string };
    findings?: unknown[];
    attemptedRemediations?: string[];
    runUrl?: string;
    correlationId?: string;
  };
  suggestedNextSteps?: string[];
}

export interface EmitHandoffInput {
  fromAgent: string;
  toAgent?: string;
  severity: HandoffSeverity;
  clinicalImpact?: ClinicalImpact;
  reason: string;
  target: ClinicalHandoff['context']['target'];
  findings?: unknown[];
  attemptedRemediations?: string[];
  suggestedNextSteps?: string[];
  correlationId?: string;
  /** Override dir. Defaults to `${VELYA_AUDIT_OUT}/handoffs`. */
  handoffDir?: string;
}

const DEFAULT_HANDOFF_DIR = (): string => {
  const base = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
  return join(base, 'handoffs');
};

function runUrl(): string | undefined {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  if (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID) {
    return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
  }
  return undefined;
}

export function emitHandoff(input: EmitHandoffInput): ClinicalHandoff {
  const dir = input.handoffDir ?? DEFAULT_HANDOFF_DIR();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const handoff: ClinicalHandoff = {
    handoffId: randomUUID(),
    createdAt: new Date().toISOString(),
    fromAgent: input.fromAgent,
    toAgent: input.toAgent,
    severity: input.severity,
    clinicalImpact: input.clinicalImpact ?? 'none',
    reason: input.reason,
    context: {
      target: input.target,
      findings: input.findings,
      attemptedRemediations: input.attemptedRemediations,
      runUrl: runUrl(),
      correlationId: input.correlationId,
    },
    suggestedNextSteps: input.suggestedNextSteps,
  };

  const file = join(
    dir,
    `${handoff.createdAt.replace(/[:.]/g, '-')}__${handoff.fromAgent}__${handoff.handoffId.slice(0, 8)}.json`,
  );
  writeFileSync(file, JSON.stringify(handoff, null, 2));
  return handoff;
}
