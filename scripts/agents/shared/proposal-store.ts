/**
 * proposal-store.ts — lifecycle store for LearningProposal records.
 *
 * The learning-curator agent (and any future innovation/scout agent)
 * emits structured proposals about recurring patterns. This store
 * persists them on the shared PVC and enforces:
 *
 *   1. Schema validation (against schemas/learning-proposal.schema.json,
 *      verified at compile time by the TypeScript types here and at
 *      runtime by the guard functions in this file).
 *   2. Lifecycle transitions: draft → shadow → active → retired.
 *      No skipping. Every transition is recorded in promotionHistory[]
 *      with the actor, timestamp, and reason.
 *   3. Mitigation kind whitelist (5 hardcoded values).
 *   4. Forbidden mitigation rationales (deny-list of words like
 *      "disable", "skip", "bypass", "lower threshold").
 *   5. Forbidden mitigation targetFile paths (governance/safety files).
 *   6. Self-approval ban: a proposal cannot be promoted by the same
 *      agent that authored it.
 *
 * No network calls. No LLM calls. Pure file I/O on the PVC. The store
 * is intentionally append-only on disk so the audit trail survives any
 * runner crash. In-process state is rebuilt by replaying files at boot.
 *
 * See ADR-0017 §Self-improvement and governance loops for the broader
 * design and the guard rationale.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type ProposalStage = 'draft' | 'shadow' | 'active' | 'retired';

export type MitigationKind =
  | 'new-lint-rule'
  | 'new-ui-audit-selector'
  | 'new-workflow-gate'
  | 'new-agent-runner'
  | 'manual-review';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ProposalEvidence {
  occurrences: number;
  confidence: number;
  firstSeen: string;
  lastSeen: string;
  severities: Severity[];
  agentsInvolved: string[];
  sampleFindingIds: string[];
}

export interface ProposalMitigation {
  kind: MitigationKind;
  rationale: string;
  targetFile?: string;
}

export interface ProposalRedTeamReview {
  reviewedBy?: string;
  reviewedAt?: string;
  verdict: 'pending' | 'approved' | 'rejected' | 'needs-more-shadow';
  rationale?: string;
}

export interface ProposalPromotionRecord {
  from: ProposalStage;
  to: ProposalStage;
  at: string;
  by: string;
  reason?: string;
}

export interface LearningProposal {
  proposalId: string;
  patternId: string;
  stage: ProposalStage;
  createdAt: string;
  updatedAt?: string;
  evidence: ProposalEvidence;
  mitigation: ProposalMitigation;
  redTeam?: ProposalRedTeamReview;
  promotionHistory?: ProposalPromotionRecord[];
}

/**
 * Mitigation kind whitelist. Anything outside this list is rejected at
 * validation time. Mirrors the JSON Schema enum — if you add one here
 * you MUST add it to schemas/learning-proposal.schema.json too.
 */
const ALLOWED_MITIGATION_KINDS: ReadonlySet<MitigationKind> = new Set([
  'new-lint-rule',
  'new-ui-audit-selector',
  'new-workflow-gate',
  'new-agent-runner',
  'manual-review',
]);

/**
 * Words that suggest a proposal is trying to weaken a safety control.
 * Catches "disable the gate", "skip the check", "lower the threshold",
 * "bypass the validator", "ignore the warning". The mitigation rationale
 * is rejected if any of these match (case-insensitive).
 */
const FORBIDDEN_RATIONALE_TERMS: readonly RegExp[] = [
  /\bdisable\b/i,
  /\bskip\b/i,
  /\bbypass\b/i,
  /\bignore\b/i,
  /\blower\s+(?:the\s+)?threshold\b/i,
  /\bweaken\b/i,
  /\bremove\s+(?:the\s+)?check\b/i,
];

/**
 * Paths that no proposal is allowed to target. These are the governance,
 * safety and identity files that, if rewritten by an agent, would let
 * the agent escape its own envelope. Matched as glob-ish prefixes.
 */
const FORBIDDEN_TARGET_PATHS: readonly string[] = [
  '.claude/rules/red-team.md',
  '.claude/rules/ai-safety.md',
  '.claude/rules/agent-governance.md',
  '.claude/rules/security.md',
  '.claude/agents/learning-curator-agent.md',
  '.claude/agents/red-team-',
  'docs/risk/',
  'ops/memory-guardian/claims.yaml',
  'infra/kubernetes/',
  'scripts/agents/run-learning-curator.ts',
  'scripts/agents/shared/proposal-store.ts',
];

export class ProposalValidationError extends Error {
  constructor(
    message: string,
    public readonly proposalId?: string,
  ) {
    super(message);
    this.name = 'ProposalValidationError';
  }
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

/**
 * Validate a proposal against the schema-equivalent rules. Throws on
 * any violation. Pure function — does not touch disk.
 */
export function validateProposal(input: unknown): LearningProposal {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ProposalValidationError('proposal must be an object');
  }
  const p = input as Record<string, unknown>;
  const proposalId = p.proposalId;
  if (typeof proposalId !== 'string' || !/^lp-[0-9a-f]{12}$/.test(proposalId)) {
    throw new ProposalValidationError('proposalId must match ^lp-[0-9a-f]{12}$');
  }
  const stage = p.stage;
  if (typeof stage !== 'string' || !['draft', 'shadow', 'active', 'retired'].includes(stage)) {
    throw new ProposalValidationError('stage must be one of draft|shadow|active|retired', proposalId);
  }
  if (!isIsoTimestamp(p.createdAt)) {
    throw new ProposalValidationError('createdAt must be ISO-8601', proposalId);
  }
  if (typeof p.patternId !== 'string' || p.patternId.length === 0) {
    throw new ProposalValidationError('patternId must be non-empty string', proposalId);
  }

  const evidence = p.evidence;
  if (typeof evidence !== 'object' || evidence === null) {
    throw new ProposalValidationError('evidence must be an object', proposalId);
  }
  const ev = evidence as Record<string, unknown>;
  if (typeof ev.occurrences !== 'number' || ev.occurrences < 5) {
    throw new ProposalValidationError('evidence.occurrences must be ≥ 5', proposalId);
  }
  if (typeof ev.confidence !== 'number' || ev.confidence < 0 || ev.confidence > 1) {
    throw new ProposalValidationError('evidence.confidence must be in [0,1]', proposalId);
  }
  if (!Array.isArray(ev.severities) || ev.severities.length === 0) {
    throw new ProposalValidationError('evidence.severities must be non-empty array', proposalId);
  }
  if (!Array.isArray(ev.agentsInvolved) || ev.agentsInvolved.length === 0) {
    throw new ProposalValidationError(
      'evidence.agentsInvolved must be non-empty array',
      proposalId,
    );
  }
  if (
    !Array.isArray(ev.sampleFindingIds) ||
    ev.sampleFindingIds.length < 3 ||
    ev.sampleFindingIds.length > 10
  ) {
    throw new ProposalValidationError(
      'evidence.sampleFindingIds must have 3..10 items',
      proposalId,
    );
  }

  const mitigation = p.mitigation;
  if (typeof mitigation !== 'object' || mitigation === null) {
    throw new ProposalValidationError('mitigation must be an object', proposalId);
  }
  const m = mitigation as Record<string, unknown>;
  if (typeof m.kind !== 'string' || !ALLOWED_MITIGATION_KINDS.has(m.kind as MitigationKind)) {
    throw new ProposalValidationError(
      `mitigation.kind must be one of ${[...ALLOWED_MITIGATION_KINDS].join('|')}`,
      proposalId,
    );
  }
  if (typeof m.rationale !== 'string' || m.rationale.length < 40) {
    throw new ProposalValidationError('mitigation.rationale must be ≥ 40 chars', proposalId);
  }
  for (const forbidden of FORBIDDEN_RATIONALE_TERMS) {
    if (forbidden.test(m.rationale)) {
      throw new ProposalValidationError(
        `mitigation.rationale matches forbidden term ${forbidden}`,
        proposalId,
      );
    }
  }
  if (m.targetFile !== undefined) {
    if (typeof m.targetFile !== 'string') {
      throw new ProposalValidationError('mitigation.targetFile must be string', proposalId);
    }
    for (const forbidden of FORBIDDEN_TARGET_PATHS) {
      if (m.targetFile.startsWith(forbidden) || m.targetFile.includes(forbidden)) {
        throw new ProposalValidationError(
          `mitigation.targetFile is in the forbidden list (${forbidden})`,
          proposalId,
        );
      }
    }
  }

  return p as unknown as LearningProposal;
}

/**
 * Promote a proposal one stage forward. Enforces:
 *  - linear transitions only (draft→shadow→active→retired; never skips)
 *  - red-team verdict required for shadow→active
 *  - the actor cannot be the same as the original author of the proposal
 *    (self-approval ban — caller passes the author so this can be
 *     enforced without coupling to a specific agent registry)
 *  - records the transition in promotionHistory[]
 *
 * Returns a NEW proposal object; does not mutate the input.
 */
export function promoteProposal(
  current: LearningProposal,
  next: ProposalStage,
  actor: string,
  options: { reason?: string; originalAuthor?: string } = {},
): LearningProposal {
  if (actor.length === 0) {
    throw new ProposalValidationError('actor is required', current.proposalId);
  }
  if (options.originalAuthor && options.originalAuthor === actor) {
    throw new ProposalValidationError(
      `self-approval ban: actor "${actor}" cannot promote a proposal authored by itself`,
      current.proposalId,
    );
  }

  const validForward: Record<ProposalStage, ProposalStage[]> = {
    draft: ['shadow', 'retired'],
    shadow: ['active', 'retired', 'draft'],
    active: ['retired'],
    retired: [],
  };
  if (!validForward[current.stage].includes(next)) {
    throw new ProposalValidationError(
      `illegal transition ${current.stage} → ${next}`,
      current.proposalId,
    );
  }

  if (next === 'active') {
    if (!current.redTeam || current.redTeam.verdict !== 'approved') {
      throw new ProposalValidationError(
        'shadow → active requires redTeam.verdict === "approved"',
        current.proposalId,
      );
    }
  }

  const promotionHistory = [
    ...(current.promotionHistory ?? []),
    {
      from: current.stage,
      to: next,
      at: new Date().toISOString(),
      by: actor,
      reason: options.reason,
    },
  ];

  return validateProposal({
    ...current,
    stage: next,
    updatedAt: new Date().toISOString(),
    promotionHistory,
  });
}

function defaultRoot(): string {
  return process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
}

function proposalDir(rootDir: string): string {
  const dir = join(rootDir, 'learning-proposals');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Persist a proposal to disk. Append-only — every save creates a new
 * file `<proposalId>.<updatedAt>.json` so the full history is on disk
 * even if process state is lost. The latest version is mirrored at
 * `<proposalId>.latest.json`.
 */
export function saveProposal(proposal: LearningProposal, rootDir = defaultRoot()): string {
  const validated = validateProposal(proposal);
  const dir = proposalDir(rootDir);
  const ts = (validated.updatedAt ?? validated.createdAt).replace(/[:.]/g, '-');
  const versionedPath = join(dir, `${validated.proposalId}.${ts}.json`);
  const latestPath = join(dir, `${validated.proposalId}.latest.json`);
  const payload = JSON.stringify(validated, null, 2);
  writeFileSync(versionedPath, payload);
  writeFileSync(latestPath, payload);
  return versionedPath;
}

export function loadProposal(
  proposalId: string,
  rootDir = defaultRoot(),
): LearningProposal | null {
  const path = join(proposalDir(rootDir), `${proposalId}.latest.json`);
  if (!existsSync(path)) return null;
  try {
    return validateProposal(JSON.parse(readFileSync(path, 'utf-8')));
  } catch {
    return null;
  }
}

export function listProposals(
  rootDir = defaultRoot(),
  filter?: { stage?: ProposalStage },
): LearningProposal[] {
  const dir = proposalDir(rootDir);
  const files = readdirSync(dir).filter((name) => name.endsWith('.latest.json'));
  const out: LearningProposal[] = [];
  for (const file of files) {
    try {
      const parsed = validateProposal(JSON.parse(readFileSync(join(dir, file), 'utf-8')));
      if (filter?.stage && parsed.stage !== filter.stage) continue;
      out.push(parsed);
    } catch {
      // Skip corrupted entries — caller will see fewer proposals than
      // files on disk. The runner emits a `corrupt-proposal` finding
      // through findings-store so the next harvest catches it.
      continue;
    }
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
