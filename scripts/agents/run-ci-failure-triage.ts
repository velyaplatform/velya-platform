#!/usr/bin/env tsx
/**
 * run-ci-failure-triage.ts — Entry point for ci-failure-triage-agent.
 *
 * Layer 1 worker that closes the loop on the ci-failure-watcher workflow.
 * The watcher (`.github/workflows/ci-failure-watcher.yaml`) reacts to
 * `workflow_run` failures on PRs by commenting on the PR with a triage
 * stub. This agent reads OPEN PRs labelled `ci-red`, fetches the failing
 * job logs via `gh run view --log-failed`, classifies the failure into
 * one of N known patterns, and:
 *
 *   - For trivially-fixable patterns (pin-rot, dependency-graph toggle,
 *     stale auto-merge label, missing offline guard) it emits a fix
 *     proposal as a JSON report — auto-fix branch creation is gated
 *     until the agent reaches `active` lifecycle stage.
 *   - For unknown patterns it bumps the comment count and tags the PR
 *     with a `triage-needed` label so a human knows to look.
 *
 * Runs as:
 *   - Kubernetes CronJob (infra/kubernetes/autopilot/agents-cronjobs.yaml)
 *   - GitHub Actions on workflow_run conclusion=failure (future)
 *   - Local CLI: `npx tsx scripts/agents/run-ci-failure-triage.ts`
 *
 * Exit codes:
 *   0 — clean run (zero open ci-red PRs OR all classified) or offline
 *   1 — at least one PR with an unrecognised failure pattern
 *   2 — fatal error
 *
 * Envs:
 *   VELYA_AUDIT_OUT          default /data/velya-autopilot
 *   VELYA_DRY_RUN            default true (no PR comments / labels in dry mode)
 *   VELYA_REPO_OWNER         default 'velyaplatform'
 *   VELYA_REPO_NAME          default 'velya-platform'
 *   VELYA_SMOKE_OFFLINE      default false (true skips all gh API calls)
 *   GH_TOKEN                 required online — must have repo:read + pulls:write
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  installOfflineFatalHandler,
  OFFLINE_MODE,
  writeOfflineReport,
} from './shared/offline-guard';

const AGENT_NAME = 'ci-failure-triage-agent';
const OUT_DIR = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
const DRY_RUN = (process.env.VELYA_DRY_RUN ?? 'true') !== 'false';
const REPO_OWNER = process.env.VELYA_REPO_OWNER ?? 'velyaplatform';
const REPO_NAME = process.env.VELYA_REPO_NAME ?? 'velya-platform';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

// Failure-pattern classifier. Each rule is checked against the failing
// job's log tail in order; the first match wins. Adding a new rule
// requires (a) a regex/predicate that matches the log line and (b) a
// fix-proposal generator (or null if the pattern is purely informational).
interface FailurePattern {
  id: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  matches(jobName: string, logTail: string): boolean;
  fix:
    | {
        type: 'autofix-pr';
        branchPrefix: string;
        // human-readable summary of what the autofix would do
        proposalSummary: string;
      }
    | { type: 'manual'; instructions: string }
    | null;
}

const PATTERNS: FailurePattern[] = [
  {
    id: 'pin-rot-deleted-sha',
    description: 'A workflow uses an action SHA that no longer exists upstream',
    severity: 'critical',
    matches: (_, log) =>
      /Unable to resolve action `[^`]+`, unable to find version/i.test(log),
    fix: {
      type: 'autofix-pr',
      branchPrefix: 'autopilot/fix-pin-rot',
      proposalSummary:
        'Re-pin the deleted action to the latest valid SHA found via `gh api repos/{owner}/{repo}/git/refs/tags`.',
    },
  },
  {
    id: 'dependency-graph-disabled',
    description:
      'actions/dependency-review-action fails because Dependency graph is disabled in repo settings',
    severity: 'high',
    matches: (_, log) =>
      /Dependency review is not supported on this repository/i.test(log),
    fix: {
      type: 'manual',
      instructions:
        'Toggle Settings → Security → Dependency graph ON, then set repo var VELYA_DEPENDENCY_GRAPH_ENABLED=true. The job is already gated on the var.',
    },
  },
  {
    id: 'smoke-agent-crash-no-kubectl',
    description:
      'An autopilot agent crashed with exit 2 in CI smoke because it tried to call kubectl with no cluster',
    severity: 'high',
    matches: (jobName, log) =>
      /Smoke .* run-.*\.ts agents/.test(jobName) &&
      /crashed with exit (?:2|124)/i.test(log),
    fix: {
      type: 'autofix-pr',
      branchPrefix: 'autopilot/fix-smoke-offline-guard',
      proposalSummary:
        'Add the offline guard from scripts/agents/shared/offline-guard.ts to the crashing agent: import OFFLINE_MODE + kubectlAvailable() + writeOfflineReport(), early-return when offline.',
    },
  },
  {
    id: 'overlap-gate-critical',
    description:
      'detect-overlaps.ts reported a critical finding (heading hidden under sidebar, field-over-field, etc.)',
    severity: 'critical',
    matches: (jobName, log) =>
      /UI Overlap Gate|Pixel overlap/.test(jobName) &&
      /\[detect-overlaps\] crit=[1-9]/i.test(log),
    fix: {
      type: 'manual',
      instructions:
        'Read the overlap-report artefact, identify the conflicting selectors, fix the layout (CSS or component), re-run scripts/ui-audit/detect-overlaps.ts locally to confirm.',
    },
  },
  {
    id: 'next-build-typecheck',
    description: 'Next.js build failed at TypeScript typecheck',
    severity: 'high',
    matches: (jobName, log) =>
      /(TypeScript Check|build|next build)/i.test(jobName) &&
      /Type error:|TS\d{4}:/i.test(log),
    fix: {
      type: 'manual',
      instructions:
        'Run `npx tsc --noEmit` in apps/web (or the failing package) to reproduce. Fix the type error, push.',
    },
  },
  {
    id: 'lint-eslint',
    description: 'ESLint reported errors',
    severity: 'medium',
    matches: (jobName, log) =>
      /lint/i.test(jobName) && /eslint|warning|error/i.test(log),
    fix: {
      type: 'manual',
      instructions: 'Run `npm run lint` locally, fix, push.',
    },
  },
];

interface PrTriage {
  prNumber: number;
  prTitle: string;
  headSha: string;
  failingWorkflow: string;
  failingJob?: string;
  patternId: string | null;
  severity: FailurePattern['severity'] | 'unknown';
  fix: FailurePattern['fix'];
  logTail?: string;
}

interface GhCmdResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

function gh(args: string[]): GhCmdResult {
  const result = spawnSync('gh', args, {
    encoding: 'utf-8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function listOpenCiRedPrs(): Array<{ number: number; title: string; headRefOid: string }> {
  const res = gh([
    'pr',
    'list',
    '--repo',
    `${REPO_OWNER}/${REPO_NAME}`,
    '--label',
    'ci-red',
    '--state',
    'open',
    '--json',
    'number,title,headRefOid',
    '--limit',
    '50',
  ]);
  if (!res.ok) {
    throw new Error(`failed listing PRs: ${res.stderr}`);
  }
  return JSON.parse(res.stdout || '[]');
}

function latestFailingRunForPr(headSha: string): {
  workflowName: string;
  failingJob?: string;
  logTail: string;
} | null {
  const runsRes = gh([
    'run',
    'list',
    '--repo',
    `${REPO_OWNER}/${REPO_NAME}`,
    '--commit',
    headSha,
    '--status',
    'failure',
    '--json',
    'databaseId,name,workflowName',
    '--limit',
    '5',
  ]);
  if (!runsRes.ok) return null;
  const runs = JSON.parse(runsRes.stdout || '[]') as Array<{
    databaseId: number;
    name: string;
    workflowName: string;
  }>;
  if (runs.length === 0) return null;
  const run = runs[0]!;

  const logRes = gh([
    'run',
    'view',
    String(run.databaseId),
    '--repo',
    `${REPO_OWNER}/${REPO_NAME}`,
    '--log-failed',
  ]);
  const logTail = (logRes.stdout || logRes.stderr || '').slice(-8000);

  return {
    workflowName: run.workflowName ?? run.name ?? 'unknown',
    failingJob: run.name,
    logTail,
  };
}

function classify(jobName: string, logTail: string): FailurePattern | null {
  for (const p of PATTERNS) {
    if (p.matches(jobName, logTail)) return p;
  }
  return null;
}

async function main(): Promise<void> {
  if (OFFLINE_MODE) {
    writeOfflineReport({
      agent: AGENT_NAME,
      layer: 1,
      outRoot: OUT_DIR,
      outSubdir: 'ci-failure-triage',
      timestamp,
      reason: 'VELYA_SMOKE_OFFLINE=true',
      extra: { patternsLoaded: PATTERNS.length },
    });
    return;
  }

  console.log(`[${AGENT_NAME}] listing open ci-red PRs in ${REPO_OWNER}/${REPO_NAME}…`);
  const prs = listOpenCiRedPrs();
  console.log(`[${AGENT_NAME}] ${prs.length} PR(s) with ci-red label`);

  const triages: PrTriage[] = [];
  let unknownCount = 0;

  for (const pr of prs) {
    const failure = latestFailingRunForPr(pr.headRefOid);
    if (!failure) {
      console.log(`  PR #${pr.number}: no failing run found (label may be stale)`);
      continue;
    }
    const pattern = classify(failure.failingJob ?? '', failure.logTail);
    const triage: PrTriage = {
      prNumber: pr.number,
      prTitle: pr.title,
      headSha: pr.headRefOid,
      failingWorkflow: failure.workflowName,
      failingJob: failure.failingJob,
      patternId: pattern?.id ?? null,
      severity: pattern?.severity ?? 'unknown',
      fix: pattern?.fix ?? null,
      logTail: failure.logTail.slice(-1500),
    };
    triages.push(triage);
    if (!pattern) unknownCount += 1;

    console.log(
      `  PR #${pr.number} ${pattern ? `→ ${pattern.id} (${pattern.severity})` : '→ UNKNOWN'}`,
    );
  }

  ensureDir(join(OUT_DIR, 'ci-failure-triage'));
  const outFile = join(OUT_DIR, 'ci-failure-triage', `${timestamp}.json`);
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        timestamp,
        agent: AGENT_NAME,
        layer: 1,
        dryRun: DRY_RUN,
        repo: `${REPO_OWNER}/${REPO_NAME}`,
        prsScanned: prs.length,
        triages,
        unknownCount,
      },
      null,
      2,
    ),
  );
  console.log(`[${AGENT_NAME}] report → ${outFile}`);

  if (unknownCount > 0) process.exit(1);
}

main().catch(installOfflineFatalHandler(AGENT_NAME));
