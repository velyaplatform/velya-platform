#!/usr/bin/env tsx
/**
 * run-frontend-quality.ts — Entry point for frontend-quality-agent.
 *
 * Executes the mechanical checks described in .claude/agents/frontend-quality-agent.md
 * and writes an audit JSON under ${OUT_DIR}/frontend-audit/<timestamp>.json.
 *
 * Designed to run from:
 *   - Local dev: `npx tsx scripts/agents/run-frontend-quality.ts`
 *   - GitHub Actions: uses same command
 *   - Kubernetes CronJob: velya-frontend-quality-agent in velya-dev-platform
 *
 * Exit codes:
 *   0 — clean run, zero findings
 *   1 — findings with severity high or critical
 *   2 — agent itself failed (fatal)
 */

import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  rule: string;
  description: string;
  file?: string;
  suggestedFix?: string;
}

const OUT_DIR = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
const REPO_ROOT = process.env.VELYA_REPO_ROOT ?? process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function runCmd(cmd: string, cwd: string = REPO_ROOT): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' });
    return { ok: true, output };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, output: `${err.stdout ?? ''}${err.stderr ?? ''}${err.message ?? ''}` };
  }
}

async function main(): Promise<void> {
  const findings: Finding[] = [];
  const webRoot = join(REPO_ROOT, 'apps/web');

  // 1. Typecheck
  console.log('[frontend-quality] Running typecheck…');
  const tsc = runCmd('npx tsc --noEmit', webRoot);
  if (!tsc.ok) {
    findings.push({
      severity: 'high',
      rule: 'typecheck-failed',
      description: 'apps/web failed TypeScript typecheck',
      suggestedFix: tsc.output.slice(0, 2000),
    });
  }

  // 2. Lint
  console.log('[frontend-quality] Running lint…');
  const lint = runCmd('npm run lint', REPO_ROOT);
  if (!lint.ok) {
    findings.push({
      severity: 'high',
      rule: 'lint-failed',
      description: 'Monorepo lint failed',
      suggestedFix: lint.output.slice(-2000),
    });
  }

  // 3. Build
  console.log('[frontend-quality] Running next build…');
  const build = runCmd('npx next build', webRoot);
  if (!build.ok) {
    findings.push({
      severity: 'critical',
      rule: 'build-failed',
      description: 'apps/web next build failed',
      suggestedFix: build.output.slice(-3000),
    });
  }

  // 4. Dark-theme leftover detection
  console.log('[frontend-quality] Scanning for dark-theme leftovers…');
  const darkPatterns = [
    { pattern: 'text-slate-100', severity: 'high' as const, rule: 'legacy-light-text-on-white' },
    { pattern: 'text-slate-200', severity: 'high' as const, rule: 'legacy-light-text-on-white' },
    { pattern: 'text-slate-50 ', severity: 'high' as const, rule: 'legacy-near-white-text-on-white' },
    { pattern: 'bg-slate-800', severity: 'medium' as const, rule: 'legacy-dark-bg' },
    { pattern: 'bg-slate-900', severity: 'medium' as const, rule: 'legacy-dark-bg' },
    { pattern: 'animate-ping', severity: 'low' as const, rule: 'neon-effect' },
    { pattern: 'from-slate-900', severity: 'medium' as const, rule: 'legacy-dark-gradient' },
  ];

  for (const { pattern, severity, rule } of darkPatterns) {
    const grep = spawnSync(
      'grep',
      ['-rln', '--include=*.tsx', pattern, join(webRoot, 'src/app')],
      { encoding: 'utf-8' },
    );
    if (grep.stdout.trim()) {
      const files = grep.stdout.trim().split('\n');
      findings.push({
        severity,
        rule,
        description: `${files.length} file(s) still contain '${pattern}'`,
        file: files.slice(0, 10).join(', ') + (files.length > 10 ? ` (+${files.length - 10} more)` : ''),
        suggestedFix: `Bulk sed -i -e 's/${pattern}/<replacement>/g' on affected files`,
      });
    }
  }

  // 5. Contrast audit
  console.log('[frontend-quality] Running contrast audit…');
  const contrast = runCmd('npx tsx scripts/audit-contrast-all-pages.ts', REPO_ROOT);
  if (!contrast.ok) {
    findings.push({
      severity: 'high',
      rule: 'contrast-failed',
      description: 'WCAG AA contrast audit failed',
      suggestedFix: contrast.output.slice(-1500),
    });
  }

  // Write output
  const severityRank: Record<Finding['severity'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const report = {
    timestamp,
    agent: 'frontend-quality-agent',
    repoRoot: REPO_ROOT,
    totalFindings: findings.length,
    bySeverity: {
      critical: findings.filter((f) => f.severity === 'critical').length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
    },
    findings,
  };

  ensureDir(join(OUT_DIR, 'frontend-audit'));
  const outFile = join(OUT_DIR, 'frontend-audit', `${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(`[frontend-quality] ${findings.length} findings → ${outFile}`);
  console.log(
    `  critical=${report.bySeverity.critical} high=${report.bySeverity.high} medium=${report.bySeverity.medium} low=${report.bySeverity.low}`,
  );

  if (report.bySeverity.critical > 0 || report.bySeverity.high > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[frontend-quality] Fatal:', error);
  process.exit(2);
});
