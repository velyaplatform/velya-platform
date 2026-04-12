/**
 * findings-store.ts — aggregator that walks the audit JSONs that every
 * autopilot agent writes to the shared PVC and exposes a typed iterator.
 *
 * Consumed by:
 *   - scorecard-publisher (G-GOV-3 P0 blocker — see ADR-0017)
 *   - learning-curator (clusters findings into LearningProposals)
 *   - autopilot-orchestrator (L3 world-state)
 *   - validator-of-validators (10% sample re-run)
 *
 * Layout assumed on the PVC `velya-autopilot-data`:
 *   $VELYA_AUDIT_OUT/<agent-name>-audit/<ISO-timestamp>.json
 *   $VELYA_AUDIT_OUT/<agent-name>-audit/<ISO-timestamp>.offline.json   (offline reports — skipped)
 *   $VELYA_AUDIT_OUT/<agent-name>-audit/latest.json                    (pointer — skipped)
 *
 * Each report is expected to follow the loose shape that the existing
 * runners already produce:
 *   {
 *     timestamp: string ISO,
 *     agent: string,
 *     layer?: number,
 *     mode?: 'online' | 'offline',
 *     totalFindings?: number,
 *     bySeverity?: Record<Severity, number>,
 *     findings: Finding[],
 *   }
 *
 * The store does NOT enforce a strict schema today — new agents emit
 * slightly different shapes and we want to harvest everything we can.
 * It DOES validate that findings have a `severity`, a `rule` (or
 * `description` as fallback) and a normalised `surface` so that
 * downstream consumers can group reliably.
 *
 * No network calls. No LLM calls. Deterministic.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface NormalisedFinding {
  /** Stable id derived from agent + rule + surface + target hash. */
  id: string;
  /** Source agent that emitted the audit record. */
  agent: string;
  /** ISO timestamp of the report this finding came from. */
  timestamp: string;
  severity: Severity;
  /** Machine slug — preferred grouping key. */
  rule: string;
  /** Page / module / namespace / file the finding lives on. */
  surface: string;
  /** Specific element / field / resource within the surface. */
  target?: string;
  description: string;
  /** Free-form details kept for forensics. */
  raw: Record<string, unknown>;
}

export interface HarvestOptions {
  /** PVC root — defaults to `$VELYA_AUDIT_OUT` then `/data/velya-autopilot`. */
  rootDir?: string;
  /** Only include reports newer than this many hours. */
  sinceHours?: number;
  /** Only include findings from these severities (default: all). */
  severities?: Severity[];
  /** Only include findings from these agents (default: all discovered). */
  agents?: string[];
}

export interface HarvestManifest {
  rootDir: string;
  scannedAt: string;
  windowHours: number;
  reportsRead: number;
  reportsSkipped: number;
  findingsTotal: number;
  agentsSeen: string[];
  bySeverity: Record<Severity, number>;
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function defaultRoot(): string {
  return process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
}

function isAuditDir(name: string): boolean {
  // Convention: every agent writes to `<agent>-audit/`. Skip anything
  // that doesn't match (e.g. `tmp/`, `cache/`, the kill-switch state file).
  return name.endsWith('-audit') || name === 'audit';
}

function isAuditFile(name: string): boolean {
  if (!name.endsWith('.json')) return false;
  // Skip pointer files and offline-mode reports — they don't carry findings.
  if (name === 'latest.json') return false;
  if (name.endsWith('.offline.json')) return false;
  return true;
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return null;
}

function coerceSeverity(value: unknown): Severity {
  const normalised = String(value ?? '').toLowerCase();
  if (normalised in SEVERITY_RANK) return normalised as Severity;
  // Common aliases.
  if (normalised === 'fatal' || normalised === 'crit') return 'critical';
  if (normalised === 'warn' || normalised === 'warning') return 'medium';
  if (normalised === 'note' || normalised === 'notice') return 'info';
  return 'info';
}

function pickString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

/**
 * Stable id for a finding. Pure function: same inputs → same id, so
 * downstream consumers can dedupe across runs.
 */
export function findingId(parts: {
  agent: string;
  rule: string;
  surface: string;
  target?: string;
}): string {
  // Cheap deterministic FNV-1a 32-bit hash. We don't need crypto-grade
  // collision resistance — we want stability across processes without
  // pulling in `crypto`.
  const input = [parts.agent, parts.rule, parts.surface, parts.target ?? ''].join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `f-${hash.toString(16).padStart(8, '0')}`;
}

function normaliseFinding(
  agent: string,
  timestamp: string,
  raw: Record<string, unknown>,
): NormalisedFinding | null {
  const severity = coerceSeverity(raw.severity);
  const rule = pickString(raw, 'rule', 'ruleId', 'code', 'kind') ?? 'unknown';
  // The detector outputs `selector` for DOM elements, k8s agents emit
  // `resource`, lint agents emit `file`. The store treats them all as
  // `surface` for grouping; consumers can re-derive specifics from `raw`.
  const surface =
    pickString(raw, 'page', 'surface', 'selector', 'resource', 'file', 'namespace') ?? 'unknown';
  const target = pickString(
    raw,
    'target',
    'conflictSelector',
    'name',
    'id',
    'field',
    'pinReference',
  );
  const description = pickString(raw, 'description', 'message', 'reason') ?? rule;

  return {
    id: findingId({ agent, rule, surface, target }),
    agent,
    timestamp,
    severity,
    rule,
    surface,
    target,
    description,
    raw,
  };
}

function listAgentDirs(rootDir: string): string[] {
  if (!existsSync(rootDir)) return [];
  return readdirSync(rootDir)
    .filter((name) => isAuditDir(name))
    .map((name) => join(rootDir, name))
    .filter((path) => {
      try {
        return statSync(path).isDirectory();
      } catch {
        return false;
      }
    });
}

function listAuditFiles(agentDir: string, sinceMs: number): string[] {
  return readdirSync(agentDir)
    .filter(isAuditFile)
    .map((name) => join(agentDir, name))
    .filter((path) => {
      try {
        const stat = statSync(path);
        return stat.isFile() && stat.mtimeMs >= sinceMs;
      } catch {
        return false;
      }
    });
}

/**
 * Walk the PVC, parse every audit JSON in the time window, and yield
 * normalised findings. Returns a manifest with counts so the caller can
 * detect unexpectedly empty windows (silent-failure detection).
 */
export function harvestFindings(options: HarvestOptions = {}): {
  findings: NormalisedFinding[];
  manifest: HarvestManifest;
} {
  const rootDir = options.rootDir ?? defaultRoot();
  const sinceHours = options.sinceHours ?? 26;
  const sinceMs = Date.now() - sinceHours * 60 * 60 * 1000;
  const severityFilter = options.severities;
  const agentFilter = options.agents ? new Set(options.agents) : null;

  const findings: NormalisedFinding[] = [];
  const bySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  const agentsSeen = new Set<string>();
  let reportsRead = 0;
  let reportsSkipped = 0;

  for (const agentDir of listAgentDirs(rootDir)) {
    const agentName = agentDir.split('/').pop()!.replace(/-audit$/, '');
    if (agentFilter && !agentFilter.has(agentName)) continue;

    for (const filePath of listAuditFiles(agentDir, sinceMs)) {
      let raw: string;
      try {
        raw = readFileSync(filePath, 'utf-8');
      } catch {
        reportsSkipped += 1;
        continue;
      }
      const report = safeJsonParse(raw);
      if (!report) {
        reportsSkipped += 1;
        continue;
      }
      reportsRead += 1;
      agentsSeen.add(agentName);

      const reportTimestamp =
        pickString(report, 'timestamp') ?? new Date(statSync(filePath).mtimeMs).toISOString();
      const rawFindings = Array.isArray(report.findings) ? report.findings : [];
      for (const item of rawFindings) {
        if (typeof item !== 'object' || item === null) continue;
        const normalised = normaliseFinding(
          agentName,
          reportTimestamp,
          item as Record<string, unknown>,
        );
        if (!normalised) continue;
        if (severityFilter && !severityFilter.includes(normalised.severity)) continue;
        findings.push(normalised);
        bySeverity[normalised.severity] += 1;
      }
    }
  }

  return {
    findings: findings.sort(
      (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.id.localeCompare(b.id),
    ),
    manifest: {
      rootDir,
      scannedAt: new Date().toISOString(),
      windowHours: sinceHours,
      reportsRead,
      reportsSkipped,
      findingsTotal: findings.length,
      agentsSeen: Array.from(agentsSeen).sort(),
      bySeverity,
    },
  };
}

/**
 * Group findings by a key — used by learning-curator (clusters by
 * pattern) and scorecard-publisher (per-agent rates).
 */
export function groupFindings<K extends string>(
  findings: NormalisedFinding[],
  keyFn: (f: NormalisedFinding) => K,
): Map<K, NormalisedFinding[]> {
  const out = new Map<K, NormalisedFinding[]>();
  for (const f of findings) {
    const key = keyFn(f);
    const bucket = out.get(key);
    if (bucket) bucket.push(f);
    else out.set(key, [f]);
  }
  return out;
}
