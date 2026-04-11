#!/usr/bin/env tsx
/**
 * run-meta-governance-auditor.ts — Entry point for meta-governance-auditor
 * (Layer 3 governor-of-governors).
 *
 * READ-ONLY audit. Never invokes kubectl delete/patch/apply/create — only
 * get/list. Verifies that governance agents are documented, have executable
 * runtimes (or tracked debt), that the layer hierarchy is balanced, and that
 * manager docs declare separation of duties.
 *
 * Runs as a Kubernetes CronJob using image `velya-autopilot-agents:v2`.
 * See .claude/agents/meta-governance-auditor.md.
 *
 * Exit codes:
 *   0 — clean
 *   1 — findings high/critical
 *   2 — agent fatal error
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  rule: string;
  description: string;
  resource?: string;
  remediation?: 'applied' | 'pr' | 'escalated' | 'none';
  remediationDetail?: string;
}

const OUT_DIR = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
const REPO_ROOT = process.env.VELYA_REPO_ROOT ?? process.cwd();
const AGENTS_DIR = process.env.VELYA_AGENTS_DIR ?? join(REPO_ROOT, '.claude/agents');
const KUBECTL_CONTEXT = process.env.KUBECTL_CONTEXT ?? '';
const DRY_RUN = process.env.VELYA_DRY_RUN === 'true';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

const GOVERNOR_DOCS = [
  'agent-governance-reviewer.md',
  'red-team-manager-agent.md',
  'blind-spot-discovery-coordinator-agent.md',
  'clinical-safety-gap-hunter-agent.md',
  'governance-failure-analyst-agent.md',
];

const GOVERNOR_AUDIT_DIRS: Record<string, string> = {
  'agent-governance-reviewer.md': 'governance-audit',
  'red-team-manager-agent.md': 'red-team-audit',
  'blind-spot-discovery-coordinator-agent.md': 'blind-spot-audit',
  'clinical-safety-gap-hunter-agent.md': 'clinical-safety-audit',
  'governance-failure-analyst-agent.md': 'governance-failure-audit',
};

const MANAGER_DOCS = [
  'agent-health-manager.md',
  'agent-runtime-supervisor.md',
  'delegation-coordinator-agent.md',
];

const EXPECTED_LAYER_COUNTS: Record<string, number> = {
  L1: 5,
  L2: 2,
  L3: 3,
  L4: 1,
};

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

// READ-ONLY helper. Only get/list allowed.
const ALLOWED_VERBS = new Set(['get', 'list', 'describe', 'version', 'api-resources']);
function kubectl(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const verb = args[0] ?? '';
  if (!ALLOWED_VERBS.has(verb)) {
    throw new Error(
      `[meta-governance-auditor] refusing kubectl verb '${verb}' — script is read-only`,
    );
  }
  const fullArgs = KUBECTL_CONTEXT
    ? ['--context', KUBECTL_CONTEXT, '--request-timeout=15s', ...args]
    : ['--request-timeout=15s', ...args];
  const result = spawnSync('kubectl', fullArgs, {
    encoding: 'utf-8',
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function detectLayer(filename: string, content: string): string | null {
  const haystack = `${filename}\n${content.slice(0, 2000)}`.toLowerCase();
  if (/\b(l4|layer[-_ ]?4)\b/.test(haystack)) return 'L4';
  if (/\b(l3|layer[-_ ]?3)\b/.test(haystack)) return 'L3';
  if (/\b(l2|layer[-_ ]?2)\b/.test(haystack)) return 'L2';
  if (/\b(l1|layer[-_ ]?1)\b/.test(haystack)) return 'L1';
  return null;
}

async function main(): Promise<void> {
  const findings: Finding[] = [];

  // 1. Governor activity — each governor doc must exist
  console.log('[meta-governance-auditor] Verifying governor docs…');
  for (const doc of GOVERNOR_DOCS) {
    const full = join(AGENTS_DIR, doc);
    if (!existsSync(full)) {
      findings.push({
        severity: 'high',
        rule: 'governor-missing',
        description: `Governor doc ${doc} missing from ${AGENTS_DIR}`,
        resource: doc,
        remediation: 'escalated',
      });
    }
  }

  // 2. Governor evidence — expect no executable script/CronJob yet → tracked debt
  console.log('[meta-governance-auditor] Checking governor runtime evidence…');
  for (const doc of GOVERNOR_DOCS) {
    if (!existsSync(join(AGENTS_DIR, doc))) continue;
    const subdir = GOVERNOR_AUDIT_DIRS[doc] ?? doc.replace('.md', '');
    const auditDir = join(OUT_DIR, subdir);
    const hasEvidence = existsSync(auditDir) && statSync(auditDir).isDirectory();
    if (!hasEvidence) {
      findings.push({
        severity: 'medium',
        rule: 'governor-without-runtime',
        description: `Governor agent ${doc} exists but has no executable script or CronJob (expected audit dir ${subdir})`,
        resource: doc,
        remediation: 'escalated',
      });
    }
  }

  // 3. Layer hierarchy check
  console.log('[meta-governance-auditor] Walking agents dir for layer counts…');
  const layerCounts: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0 };
  if (existsSync(AGENTS_DIR)) {
    for (const entry of readdirSync(AGENTS_DIR)) {
      if (!entry.endsWith('.md')) continue;
      const full = join(AGENTS_DIR, entry);
      let content = '';
      try {
        content = readFileSync(full, 'utf-8');
      } catch {
        continue;
      }
      const layer = detectLayer(entry, content);
      if (layer) layerCounts[layer] = (layerCounts[layer] ?? 0) + 1;
    }
  } else {
    findings.push({
      severity: 'high',
      rule: 'agents-dir-missing',
      description: `Agents dir not found: ${AGENTS_DIR}`,
      remediation: 'escalated',
    });
  }

  for (const [layer, expected] of Object.entries(EXPECTED_LAYER_COUNTS)) {
    const actual = layerCounts[layer] ?? 0;
    if (actual < expected) {
      findings.push({
        severity: 'medium',
        rule: 'layer-understaffed',
        description: `Layer ${layer} has ${actual} agent(s); expected >= ${expected}`,
        resource: `layer/${layer}`,
        remediation: 'escalated',
      });
    }
  }

  // 4. Separation of duties — manager docs must state it
  console.log('[meta-governance-auditor] Checking separation-of-duties statements…');
  for (const doc of MANAGER_DOCS) {
    const full = join(AGENTS_DIR, doc);
    if (!existsSync(full)) {
      findings.push({
        severity: 'medium',
        rule: 'manager-doc-missing',
        description: `Manager doc ${doc} not found at ${AGENTS_DIR}`,
        resource: doc,
        remediation: 'escalated',
      });
      continue;
    }
    let content = '';
    try {
      content = readFileSync(full, 'utf-8');
    } catch {
      content = '';
    }
    const lower = content.toLowerCase();
    if (!lower.includes('never approves own') && !lower.includes('separation of duties')) {
      findings.push({
        severity: 'low',
        rule: 'separation-of-duties-unstated',
        description: `Manager doc ${doc} does not explicitly state separation of duties`,
        resource: doc,
        remediation: 'escalated',
      });
    }
  }

  // Sanity: touch kubectl read-only to confirm guard works (version is a no-op).
  const version = kubectl(['version', '--client=true', '--output=yaml']);
  if (!version.ok) {
    console.warn('[meta-governance-auditor] kubectl version check failed (non-fatal).');
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
    agent: 'meta-governance-auditor',
    layer: 3,
    watches: 'layer-3-governors',
    readOnly: true,
    cluster: KUBECTL_CONTEXT || 'in-cluster',
    dryRun: DRY_RUN,
    agentsDir: AGENTS_DIR,
    layerCounts,
    totalFindings: findings.length,
    bySeverity: {
      critical: findings.filter((f) => f.severity === 'critical').length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
    },
    findings,
  };

  ensureDir(join(OUT_DIR, 'meta-audit'));
  const outFile = join(OUT_DIR, 'meta-audit', `${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(`[meta-governance-auditor] ${findings.length} findings → ${outFile}`);
  console.log(
    `  severity: crit=${report.bySeverity.critical} high=${report.bySeverity.high} med=${report.bySeverity.medium} low=${report.bySeverity.low}`,
  );
  console.log(
    `  layerCounts: L1=${layerCounts.L1} L2=${layerCounts.L2} L3=${layerCounts.L3} L4=${layerCounts.L4}`,
  );

  if (findings.some((f) => f.severity === 'critical' || f.severity === 'high')) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[meta-governance-auditor] Fatal:', error);
  process.exit(2);
});
