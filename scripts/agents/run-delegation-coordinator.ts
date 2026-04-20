#!/usr/bin/env tsx

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  buildTriggerRoutingPlan,
  inferContextTagsFromText,
  type ProductContext,
  type TriggerActionType,
} from './shared/contextual-trigger-routing';
import type { ClinicalHandoff, HandoffSeverity } from './shared/handoff';

interface CoordinatorRecord {
  handoffId: string;
  fromAgent: string;
  selectedAgentId?: string;
  decision: 'direct' | 'coordinated' | 'unrouted';
  actionType: TriggerActionType;
  contextTags: string[];
  delegates: string[];
  reason: string;
  severity: HandoffSeverity;
}

interface CoordinatorReport {
  timestamp: string;
  agent: string;
  totalHandoffs: number;
  routedDirectly: number;
  routedViaCoordinator: number;
  unrouted: number;
  emittedLedgerEntries: number;
  handoffs: CoordinatorRecord[];
}

const AGENT_NAME = 'delegation-coordinator-agent';
const OUT_ROOT = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';

function findRepoRoot(): string {
  let cur = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(cur, 'package.json')) && existsSync(join(cur, '.claude'))) {
      return cur;
    }
    const parent = resolve(cur, '..');
    if (parent === cur) break;
    cur = parent;
  }
  return process.cwd();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = args[i + 1];
    if (!value || value.startsWith('--')) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = value;
    i += 1;
  }
  return {
    repoRoot: resolve(String(parsed['project-root'] ?? findRepoRoot())),
    handoffDir: parsed['handoff-dir']
      ? resolve(String(parsed['handoff-dir']))
      : join(OUT_ROOT, 'handoffs'),
    outDir: parsed['out-dir']
      ? resolve(String(parsed['out-dir']))
      : join(OUT_ROOT, 'delegation-coordinator'),
    emitLedger: parsed['emit-ledger'] === true,
  };
}

function inferActionType(handoff: ClinicalHandoff): TriggerActionType {
  if (handoff.requestedAction) return handoff.requestedAction;
  const text = [handoff.reason, handoff.suggestedNextSteps?.join(' ')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/\bmonitor|alert|slo|sla|heartbeat|watch/.test(text)) return 'monitoring';
  if (/\btest|e2e|integration|unit|smoke|contract/.test(text)) return 'testing';
  if (/\bfix|corrig|remedi|heal|rollback|recover/.test(text)) return 'correction';
  if (/\bimprov|upgrade|refactor|evolve|optimi/.test(text)) return 'improvement';
  return 'validation';
}

function inferProductContext(handoff: ClinicalHandoff): ProductContext {
  if (handoff.productContext) return handoff.productContext;
  const text = [
    handoff.reason,
    handoff.context?.target?.kind,
    handoff.context?.target?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/\bhospital|fhir|medplum|phi|hipaa|ans|tuss|telemed/.test(text)) return 'hospitalar';
  if (/\bsoc|siem|ioc|cti|phishing|malware|forensic/.test(text)) return 'lince';
  return 'shared';
}

function loadHandoffs(handoffDir: string): ClinicalHandoff[] {
  if (!existsSync(handoffDir)) return [];
  return readdirSync(handoffDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      try {
        return JSON.parse(readFileSync(join(handoffDir, file), 'utf-8')) as ClinicalHandoff;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is ClinicalHandoff => entry !== null);
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function loadLatestLedgerMap(ledgerPath: string): Map<string, { status: string }> {
  const out = new Map<string, { status: string }>();
  if (!existsSync(ledgerPath)) return out;
  const raw = readFileSync(ledgerPath, 'utf-8');
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as { id?: string; status?: string };
      if (parsed.id && parsed.status) out.set(parsed.id, { status: parsed.status });
    } catch {
      // ignore malformed
    }
  }
  return out;
}

function appendLedgerEntry(
  ledgerPath: string,
  entry: Record<string, unknown>,
): void {
  ensureDir(dirname(ledgerPath));
  appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`, 'utf-8');
}

function main(): void {
  const args = parseArgs();
  const timestamp = new Date().toISOString();
  const ledgerPath = join(args.repoRoot, '.claude', 'ledger', 'delegations.jsonl');
  const latestLedger = loadLatestLedgerMap(ledgerPath);
  const handoffs = loadHandoffs(args.handoffDir);
  let emittedLedgerEntries = 0;

  const records = handoffs.map((handoff) => {
    const actionType = inferActionType(handoff);
    const productContext = inferProductContext(handoff);
    const contextTags = [
      ...(handoff.contextTags ?? []),
      ...inferContextTagsFromText(
        handoff.reason,
        handoff.context?.target?.kind,
        handoff.context?.target?.name,
        handoff.suggestedNextSteps?.join(' '),
      ),
    ];
    const plan = buildTriggerRoutingPlan({
      fromAgent: handoff.fromAgent,
      actionType,
      contextTags,
      productContext,
      description: [
        handoff.reason,
        handoff.context?.target?.kind,
        handoff.context?.target?.name,
        handoff.suggestedNextSteps?.join(' '),
      ]
        .filter(Boolean)
        .join('\n'),
      target: handoff.context?.target,
    });

    if (
      args.emitLedger &&
      plan.selectedAgentId &&
      plan.selectedAgentId !== AGENT_NAME
    ) {
      const delegationId = `handoff-${handoff.handoffId}-${plan.selectedAgentId}-${actionType}`;
      const latest = latestLedger.get(delegationId);
      if (!latest || latest.status === 'completed' || latest.status === 'blocked' || latest.status === 'rejected') {
        appendLedgerEntry(ledgerPath, {
          id: delegationId,
          ts: timestamp,
          from: AGENT_NAME,
          to: plan.selectedAgentId,
          task: `[${actionType}] ${handoff.reason}`,
          context: [
            `handoff:${handoff.handoffId}`,
            `severity:${handoff.severity}`,
            `contexts:${plan.contextTags.join(', ') || 'none'}`,
            `decision:${plan.decision}`,
          ].join(' | '),
          status: 'pending',
          evidencePath: null,
        });
        latestLedger.set(delegationId, { status: 'pending' });
        emittedLedgerEntries += 1;
      }
    }

    return {
      handoffId: handoff.handoffId,
      fromAgent: handoff.fromAgent,
      selectedAgentId: plan.selectedAgentId,
      decision: plan.decision,
      actionType,
      contextTags: plan.contextTags,
      delegates: plan.delegates.map((delegate) => delegate.agentId),
      reason: handoff.reason,
      severity: handoff.severity,
    } satisfies CoordinatorRecord;
  });

  const report: CoordinatorReport = {
    timestamp,
    agent: AGENT_NAME,
    totalHandoffs: records.length,
    routedDirectly: records.filter((record) => record.decision === 'direct').length,
    routedViaCoordinator: records.filter((record) => record.decision === 'coordinated').length,
    unrouted: records.filter((record) => record.decision === 'unrouted').length,
    emittedLedgerEntries,
    handoffs: records,
  };

  ensureDir(args.outDir);
  writeFileSync(join(args.outDir, `${timestamp.replace(/[:.]/g, '-')}.json`), JSON.stringify(report, null, 2));
  writeFileSync(join(args.outDir, 'latest.json'), JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
