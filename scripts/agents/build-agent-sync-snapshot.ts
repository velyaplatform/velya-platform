#!/usr/bin/env tsx
/**
 * build-agent-sync-snapshot.ts — produces a single coordination snapshot
 * of every autopilot agent in scripts/agents/run-*.ts, the live locks
 * under ${VELYA_AUDIT_OUT}/locks, and the pending handoffs under
 * ${VELYA_AUDIT_OUT}/handoffs.
 *
 * Output is a ClinicalAgentSyncState JSON file that conforms to
 * schemas/clinical-agent-sync-state.schema.json. The memory-guardian,
 * the clinical-workflow-sentinel, and the dispatcher all read this file
 * to decide routing, staleness, and escalation.
 *
 * Ported from autopilot/ops/scripts/python/build_agent_sync_state.py and
 * tailored to velya's TS/tsx agent layout.
 *
 * Usage:
 *   npx tsx scripts/agents/build-agent-sync-snapshot.ts \
 *     --out ops/state/agent-sync-status.json
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

interface AgentEntry {
  name: string;
  script: string;
  layer: 1 | 2 | 3;
  status: 'active' | 'shadow' | 'draft' | 'deprecated' | 'quarantined' | 'unknown';
  lastReportAt?: string;
  lastReportSeverity?: 'critical' | 'high' | 'medium' | 'low' | 'none';
  lifecycleStage?: 'draft' | 'sandbox' | 'shadow' | 'probation' | 'active' | 'deprecated' | 'retired';
}

interface Snapshot {
  generatedAt: string;
  schemaVersion: 1;
  agents: AgentEntry[];
  locks: unknown[];
  handoffs: unknown[];
  staleAgents: string[];
}

// Resolve repo root by walking up from cwd until we see `package.json`.
// This avoids import.meta so the script typechecks under CommonJS
// module resolution used by scripts/agents smoke CI.
function findRepoRoot(): string {
  let cur = process.cwd();
  for (let depth = 0; depth < 6; depth++) {
    if (existsSync(join(cur, 'package.json')) && existsSync(join(cur, 'scripts', 'agents'))) {
      return cur;
    }
    const parent = resolve(cur, '..');
    if (parent === cur) break;
    cur = parent;
  }
  return process.cwd();
}
const REPO_ROOT = findRepoRoot();

const AUDIT_OUT = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';

// Known expected cadences per agent (minutes). Used to flag staleness.
// Source of truth is docs/operations/clinical-control-plane.md.
const EXPECTED_CADENCE_MIN: Record<string, number> = {
  'argocd-healer-agent': 15,
  'k8s-troubleshooter-agent': 15,
  'infra-health-agent': 30,
  'agent-health-manager-agent': 30,
  'agent-runtime-supervisor-agent': 30,
  'backend-quality-agent': 60,
  'frontend-quality-agent': 60,
  'meta-governance-auditor-agent': 240,
  'pin-rot-agent': 360,
};

// Layer mapping — follows the esteira described in feedback_argocd_healer_esteira.
// L1 = reactive healers, L2 = supervisors, L3 = governance.
const LAYER: Record<string, 1 | 2 | 3> = {
  'argocd-healer-agent': 1,
  'k8s-troubleshooter-agent': 1,
  'infra-health-agent': 1,
  'backend-quality-agent': 1,
  'frontend-quality-agent': 1,
  'pin-rot-agent': 1,
  'agent-health-manager-agent': 2,
  'agent-runtime-supervisor-agent': 2,
  'meta-governance-auditor-agent': 3,
};

function agentNameFromScript(script: string): string {
  // "run-argocd-healer.ts" → "argocd-healer-agent"
  const base = script.replace(/^run-/, '').replace(/\.ts$/, '');
  return `${base}-agent`;
}

function discoverAgents(): AgentEntry[] {
  const dir = join(REPO_ROOT, 'scripts', 'agents');
  if (!existsSync(dir)) return [];
  const scripts = readdirSync(dir).filter((f) => /^run-.+\.ts$/.test(f));
  return scripts.map((script) => {
    const name = agentNameFromScript(script);
    return {
      name,
      script: join('scripts', 'agents', script),
      layer: LAYER[name] ?? 1,
      status: 'active' as const,
    };
  });
}

interface LatestReport {
  timestamp?: string;
  totalFindings?: number;
  bySeverity?: Record<string, number>;
}

function readLatestReport(agentDir: string): LatestReport | null {
  const latest = join(AUDIT_OUT, agentDir, 'latest.json');
  if (!existsSync(latest)) return null;
  try {
    return JSON.parse(readFileSync(latest, 'utf-8')) as LatestReport;
  } catch {
    return null;
  }
}

// Map agent name → directory name under VELYA_AUDIT_OUT used by run-*.ts
const AUDIT_DIRS: Record<string, string> = {
  'argocd-healer-agent': 'argocd-audit',
  'k8s-troubleshooter-agent': 'k8s-troubleshoot',
  'infra-health-agent': 'infra-audit',
  'agent-health-manager-agent': 'manager-audit',
  'agent-runtime-supervisor-agent': 'runtime-supervisor',
  'backend-quality-agent': 'backend-quality',
  'frontend-quality-agent': 'frontend-quality',
  'meta-governance-auditor-agent': 'governance-audit',
  'pin-rot-agent': 'pin-rot',
};

function worstSeverity(bySeverity?: Record<string, number>): AgentEntry['lastReportSeverity'] {
  if (!bySeverity) return 'none';
  if ((bySeverity.critical ?? 0) > 0) return 'critical';
  if ((bySeverity.high ?? 0) > 0) return 'high';
  if ((bySeverity.medium ?? 0) > 0) return 'medium';
  if ((bySeverity.low ?? 0) > 0) return 'low';
  return 'none';
}

function readLocks(): unknown[] {
  const dir = join(AUDIT_OUT, 'locks');
  if (!existsSync(dir)) return [];
  const out: unknown[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.lock.json')) continue;
    try {
      out.push(JSON.parse(readFileSync(join(dir, file), 'utf-8')));
    } catch {
      // ignore malformed
    }
  }
  return out;
}

function readHandoffs(): unknown[] {
  const dir = join(AUDIT_OUT, 'handoffs');
  if (!existsSync(dir)) return [];
  const out: unknown[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    try {
      out.push(JSON.parse(readFileSync(join(dir, file), 'utf-8')));
    } catch {
      // ignore
    }
  }
  return out;
}

function minutesSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 60_000));
}

function parseCli(): { out: string } {
  const args = process.argv.slice(2);
  let out = join(REPO_ROOT, 'ops', 'state', 'agent-sync-status.json');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      out = resolve(args[++i]);
    }
  }
  return { out };
}

function build(): Snapshot {
  const agents = discoverAgents();
  const staleAgents: string[] = [];

  for (const agent of agents) {
    const dir = AUDIT_DIRS[agent.name];
    if (!dir) continue;
    const report = readLatestReport(dir);
    if (!report) continue;
    agent.lastReportAt = report.timestamp;
    agent.lastReportSeverity = worstSeverity(report.bySeverity);
    const ageMin = minutesSince(agent.lastReportAt);
    const cadence = EXPECTED_CADENCE_MIN[agent.name];
    if (cadence !== undefined && ageMin !== null && ageMin > cadence * 2) {
      staleAgents.push(agent.name);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    agents,
    locks: readLocks(),
    handoffs: readHandoffs(),
    staleAgents,
  };
}

function main(): void {
  const { out } = parseCli();
  const snap = build();
  const dir = dirname(out);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(out, JSON.stringify(snap, null, 2));
  const summary = {
    agents: snap.agents.length,
    locks: snap.locks.length,
    handoffs: snap.handoffs.length,
    stale: snap.staleAgents.length,
  };
  console.log(`[agent-sync-snapshot] wrote ${out}`, summary);
}

// Only run when invoked directly
const invokedDirectly =
  process.argv[1] &&
  (process.argv[1].endsWith('build-agent-sync-snapshot.ts') ||
    process.argv[1].endsWith('build-agent-sync-snapshot.js'));

if (invokedDirectly) {
  try {
    main();
  } catch (err) {
    console.error('[agent-sync-snapshot] fatal:', err);
    process.exit(2);
  }
}

export { build, type Snapshot, type AgentEntry };
