#!/usr/bin/env tsx
/**
 * run-backend-quality.ts — Entry point for backend-quality-agent.
 *
 * Runs turbo lint + test across all workspaces, detects missing
 * --passWithNoTests, dependency drift, security audits.
 *
 * Exit codes:
 *   0 — clean
 *   1 — findings
 *   2 — fatal
 */

import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  rule: string;
  description: string;
  workspace?: string;
  suggestedFix?: string;
}

const OUT_DIR = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
const REPO_ROOT = process.env.VELYA_REPO_ROOT ?? process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function runCmd(cmd: string): { ok: boolean; output: string } {
  try {
    return { ok: true, output: execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf-8', stdio: 'pipe' }) };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    return { ok: false, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

function listWorkspaces(): string[] {
  const dirs: string[] = [];
  for (const root of ['services', 'packages', 'platform']) {
    const fullRoot = join(REPO_ROOT, root);
    if (!existsSync(fullRoot)) continue;
    for (const name of readdirSync(fullRoot, { withFileTypes: true })) {
      if (name.isDirectory() && existsSync(join(fullRoot, name.name, 'package.json'))) {
        dirs.push(join(root, name.name));
      }
    }
  }
  return dirs;
}

async function main(): Promise<void> {
  const findings: Finding[] = [];

  // 1. Lint
  console.log('[backend-quality] Running turbo lint (continue on error)…');
  const lint = runCmd('npx turbo run lint --continue');
  if (!lint.ok) {
    findings.push({
      severity: 'high',
      rule: 'lint-failed',
      description: 'One or more workspaces failed lint',
      suggestedFix: lint.output.slice(-2000),
    });
  }

  // 2. Tests
  console.log('[backend-quality] Running turbo test (continue)…');
  const tests = runCmd('npx turbo run test --continue');
  if (!tests.ok) {
    findings.push({
      severity: 'high',
      rule: 'tests-failed',
      description: 'One or more workspaces failed tests',
      suggestedFix: tests.output.slice(-2500),
    });
  }

  // 3. Detect missing --passWithNoTests on jest packages with no tests
  console.log('[backend-quality] Scanning workspaces for jest-without-tests pattern…');
  for (const ws of listWorkspaces()) {
    const pkgPath = join(REPO_ROOT, ws, 'package.json');
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
        name?: string;
        scripts?: Record<string, string>;
      };
      const testScript = pkg.scripts?.test;
      if (testScript && testScript.includes('jest') && !testScript.includes('--passWithNoTests')) {
        // Is there at least one test file?
        const grep = runCmd(
          `find ${join(REPO_ROOT, ws, 'src')} -type f \\( -name '*.test.ts' -o -name '*.spec.ts' \\) 2>/dev/null | head -1`,
        );
        if (!grep.output.trim()) {
          findings.push({
            severity: 'medium',
            rule: 'jest-no-tests-no-passflag',
            description: `${pkg.name ?? ws} has jest as test runner but no test files and no --passWithNoTests flag`,
            workspace: ws,
            suggestedFix: 'Add --passWithNoTests to the test script or add at least one test',
          });
        }
      }
    } catch {
      // skip
    }
  }

  // 4. Package.json security audit (high/critical only)
  console.log('[backend-quality] Running npm audit (high+critical)…');
  const audit = runCmd('npm audit --audit-level=high --json');
  if (!audit.ok) {
    try {
      const data = JSON.parse(audit.output) as {
        metadata?: { vulnerabilities?: Record<string, number> };
      };
      const vulns = data.metadata?.vulnerabilities ?? {};
      const critical = vulns.critical ?? 0;
      const high = vulns.high ?? 0;
      if (critical > 0 || high > 0) {
        findings.push({
          severity: critical > 0 ? 'critical' : 'high',
          rule: 'npm-audit',
          description: `${critical} critical + ${high} high severity advisories`,
          suggestedFix: 'Run npm audit fix or update deps to patched versions',
        });
      }
    } catch {
      // audit not parseable
    }
  }

  // Output
  const severityRank: Record<Finding['severity'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const report = {
    timestamp,
    agent: 'backend-quality-agent',
    totalFindings: findings.length,
    bySeverity: {
      critical: findings.filter((f) => f.severity === 'critical').length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
    },
    findings,
  };

  ensureDir(join(OUT_DIR, 'backend-audit'));
  const outFile = join(OUT_DIR, 'backend-audit', `${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(`[backend-quality] ${findings.length} findings → ${outFile}`);
  if (report.bySeverity.critical > 0 || report.bySeverity.high > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[backend-quality] Fatal:', error);
  process.exit(2);
});
