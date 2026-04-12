#!/usr/bin/env tsx
/**
 * run-repo-settings-auditor.ts — Entry point for repo-settings-auditor-agent.
 *
 * Layer 1 worker that catches the class of bug "the workflow is fine but
 * the repo setting it depends on is off". Born from the 2026-04-11
 * incident: dependency-review-action hard-failed every PR for 24 h
 * because Settings → Security → Dependency graph was disabled, and no
 * agent was watching repo settings.
 *
 * On every run it queries the GitHub REST API for the canonical settings
 * the autopilot expects, and emits a finding for any deviation. It does
 * NOT modify settings — that requires admin scope and is intentionally
 * left to humans to keep the blast radius bounded.
 *
 * Runs as:
 *   - Kubernetes CronJob (infra/kubernetes/autopilot/agents-cronjobs.yaml)
 *   - Local CLI: `npx tsx scripts/agents/run-repo-settings-auditor.ts`
 *
 * Exit codes:
 *   0 — clean (every expected setting matches) or offline
 *   1 — at least one drift finding
 *   2 — fatal error
 *
 * Envs:
 *   VELYA_AUDIT_OUT          default /data/velya-autopilot
 *   VELYA_REPO_OWNER         default 'velyaplatform'
 *   VELYA_REPO_NAME          default 'velya-platform'
 *   VELYA_SMOKE_OFFLINE      default false
 *   GH_TOKEN                 required online — needs `repo` scope
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  installOfflineFatalHandler,
  OFFLINE_MODE,
  writeOfflineReport,
} from './shared/offline-guard';

const AGENT_NAME = 'repo-settings-auditor-agent';
const OUT_DIR = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
const REPO_OWNER = process.env.VELYA_REPO_OWNER ?? 'velyaplatform';
const REPO_NAME = process.env.VELYA_REPO_NAME ?? 'velya-platform';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  rule: string;
  description: string;
  expected: string;
  actual: string;
  remediation: string;
}

function ghJson(args: string[]): unknown {
  const res = spawnSync('gh', args, {
    encoding: 'utf-8',
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(`gh ${args.join(' ')} failed: ${res.stderr}`);
  }
  return JSON.parse(res.stdout || 'null');
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

interface RepoApiResponse {
  visibility?: string;
  default_branch?: string;
  delete_branch_on_merge?: boolean;
  allow_squash_merge?: boolean;
  security_and_analysis?: {
    secret_scanning?: { status?: string };
    secret_scanning_push_protection?: { status?: string };
    dependabot_security_updates?: { status?: string };
  };
}

interface BranchProtectionResponse {
  required_status_checks?: { strict?: boolean; contexts?: string[] };
  required_pull_request_reviews?: { required_approving_review_count?: number };
  enforce_admins?: { enabled?: boolean };
  allow_force_pushes?: { enabled?: boolean };
}

interface RepoVarsResponse {
  variables?: Array<{ name: string; value: string }>;
}

async function main(): Promise<void> {
  if (OFFLINE_MODE) {
    writeOfflineReport({
      agent: AGENT_NAME,
      layer: 1,
      outRoot: OUT_DIR,
      outSubdir: 'repo-settings-audit',
      timestamp,
      reason: 'VELYA_SMOKE_OFFLINE=true',
      extra: { repo: `${REPO_OWNER}/${REPO_NAME}` },
    });
    return;
  }

  const findings: Finding[] = [];
  console.log(`[${AGENT_NAME}] auditing ${REPO_OWNER}/${REPO_NAME}`);

  // 1. Repo-level settings
  const repo = ghJson([
    'api',
    `repos/${REPO_OWNER}/${REPO_NAME}`,
  ]) as RepoApiResponse;

  const sa = repo.security_and_analysis ?? {};
  if (sa.secret_scanning?.status !== 'enabled') {
    findings.push({
      severity: 'high',
      rule: 'secret-scanning-disabled',
      description: 'Secret scanning must be enabled to catch leaked tokens before push',
      expected: 'enabled',
      actual: sa.secret_scanning?.status ?? 'absent',
      remediation:
        'gh api -X PATCH repos/{owner}/{repo} -f "security_and_analysis[secret_scanning][status]=enabled"',
    });
  }
  if (sa.secret_scanning_push_protection?.status !== 'enabled') {
    findings.push({
      severity: 'medium',
      rule: 'secret-scanning-push-protection-disabled',
      description:
        'Push protection blocks commits with detected secrets at the push step (better than post-hoc scanning)',
      expected: 'enabled',
      actual: sa.secret_scanning_push_protection?.status ?? 'absent',
      remediation:
        'gh api -X PATCH repos/{owner}/{repo} -f "security_and_analysis[secret_scanning_push_protection][status]=enabled"',
    });
  }

  if (repo.delete_branch_on_merge !== true) {
    findings.push({
      severity: 'low',
      rule: 'delete-branch-on-merge-off',
      description: 'PR branches should auto-delete on merge to keep the remote tidy',
      expected: 'true',
      actual: String(repo.delete_branch_on_merge),
      remediation: 'gh api -X PATCH repos/{owner}/{repo} -F delete_branch_on_merge=true',
    });
  }

  // 2. Repository variables — the dependency-review gate depends on
  //    VELYA_DEPENDENCY_GRAPH_ENABLED=true. Missing/false → the job is
  //    skipped (no longer red, but also no longer enforcing).
  try {
    const vars = ghJson([
      'api',
      `repos/${REPO_OWNER}/${REPO_NAME}/actions/variables`,
    ]) as RepoVarsResponse;
    const dgVar = vars.variables?.find((v) => v.name === 'VELYA_DEPENDENCY_GRAPH_ENABLED');
    if (!dgVar || dgVar.value !== 'true') {
      findings.push({
        severity: 'medium',
        rule: 'dependency-graph-var-not-set',
        description:
          'Repo var VELYA_DEPENDENCY_GRAPH_ENABLED is not set to "true". The dependency-review job is gated on it and will be skipped silently.',
        expected: 'true',
        actual: dgVar?.value ?? 'absent',
        remediation:
          'gh variable set VELYA_DEPENDENCY_GRAPH_ENABLED --body true --repo {owner}/{repo} (after enabling Dependency graph in Settings → Security)',
      });
    }
  } catch (e) {
    // listing variables may need actions:read scope; degrade gracefully
    console.warn(`[${AGENT_NAME}] could not list repo variables: ${(e as Error).message}`);
  }

  // 3. Main branch protection
  const branch = repo.default_branch ?? 'main';
  try {
    const prot = ghJson([
      'api',
      `repos/${REPO_OWNER}/${REPO_NAME}/branches/${branch}/protection`,
    ]) as BranchProtectionResponse;
    if (!prot.required_status_checks?.strict) {
      findings.push({
        severity: 'medium',
        rule: 'branch-protection-strict-off',
        description: `${branch} branch protection should require branches to be up-to-date before merging (strict mode)`,
        expected: 'true',
        actual: String(prot.required_status_checks?.strict ?? false),
        remediation: 'Settings → Branches → main → Require branches to be up to date',
      });
    }
    const expectedChecks = ['Lint & Format', 'TypeScript Check', 'Test', 'Build'];
    const actualChecks = prot.required_status_checks?.contexts ?? [];
    const missing = expectedChecks.filter((c) => !actualChecks.includes(c));
    if (missing.length > 0) {
      findings.push({
        severity: 'high',
        rule: 'required-checks-missing',
        description: `${branch} branch protection is missing required status checks`,
        expected: expectedChecks.join(', '),
        actual: actualChecks.join(', '),
        remediation: `Settings → Branches → ${branch} → Add required checks: ${missing.join(', ')}`,
      });
    }
    if (prot.allow_force_pushes?.enabled) {
      findings.push({
        severity: 'critical',
        rule: 'force-push-allowed-on-main',
        description: `${branch} allows force pushes — this can wipe history`,
        expected: 'false',
        actual: 'true',
        remediation: `Settings → Branches → ${branch} → uncheck Allow force pushes`,
      });
    }
  } catch (e) {
    findings.push({
      severity: 'high',
      rule: 'branch-protection-missing',
      description: `Branch ${branch} has no protection rule at all`,
      expected: 'configured',
      actual: 'absent',
      remediation: 'Settings → Branches → Add rule for ' + branch,
    });
    console.warn(`[${AGENT_NAME}] could not fetch branch protection: ${(e as Error).message}`);
  }

  // Persist
  ensureDir(join(OUT_DIR, 'repo-settings-audit'));
  const outFile = join(OUT_DIR, 'repo-settings-audit', `${timestamp}.json`);
  const report = {
    timestamp,
    agent: AGENT_NAME,
    layer: 1,
    repo: `${REPO_OWNER}/${REPO_NAME}`,
    totalFindings: findings.length,
    bySeverity: {
      critical: findings.filter((f) => f.severity === 'critical').length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
    },
    findings,
  };
  writeFileSync(outFile, JSON.stringify(report, null, 2));
  writeFileSync(
    join(OUT_DIR, 'repo-settings-audit', 'latest.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(`[${AGENT_NAME}] report → ${outFile}`);
  console.log(
    `[${AGENT_NAME}] crit=${report.bySeverity.critical} high=${report.bySeverity.high} med=${report.bySeverity.medium} low=${report.bySeverity.low}`,
  );

  for (const f of findings) {
    console.log(`  [${f.severity}] ${f.rule}: ${f.description}`);
  }

  if (
    report.bySeverity.critical > 0 ||
    report.bySeverity.high > 0
  ) {
    process.exit(1);
  }
}

main().catch(installOfflineFatalHandler(AGENT_NAME));
