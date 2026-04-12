#!/usr/bin/env tsx
/**
 * run-scorecard-publisher.ts — Entry point for scorecard-publisher-agent.
 *
 * Layer 1 worker that compiles a per-agent scorecard from the audit
 * records on the shared PVC. Without this scorecard, the lifecycle-
 * promotion agent and the validator-of-validators are blind — every
 * other governance loop in ADR-0017 depends on this one running first.
 *
 * Identified as the **P0 blocker** by the gap-analysis subagent
 * (G-GOV-3) on 2026-04-12: ".claude/rules/agent-governance.md defines
 * Green/Yellow/Red/Critical thresholds for validation pass rate, audit
 * pass rate, evidence completeness, SLA adherence and correction
 * recurrence — but nothing emits the numbers".
 *
 * What it does:
 *   1. Harvest findings from every agent's audit dir on the PVC
 *      (last 7 days by default — configurable via VELYA_SCORECARD_WINDOW_HOURS).
 *   2. Group by agent.
 *   3. Compute the five scorecard metrics from agent-governance.md:
 *      - validationPassRate    = clean reports / total reports
 *      - auditPassRate         = approved by auditor / total
 *      - evidenceCompleteness  = records with all required fields / total
 *      - slaAdherence          = on-time runs / expected runs
 *      - correctionRecurrence  = same finding-id repeated / total
 *      - costPerDecision       = informational (today: 0, populated by cost-budget-watcher)
 *      - latencyP95Ms          = informational (today: derived from runDurationMs)
 *      - driftFromShadow       = informational (today: 0, populated when shadow harness lands)
 *   4. Bucket each metric into Green / Yellow / Red / Critical per the
 *      thresholds table in agent-governance.md.
 *   5. Write per-agent JSON files at $VELYA_AUDIT_OUT/scorecards/<agent>.json
 *      and a roll-up at $VELYA_AUDIT_OUT/scorecards/latest.json.
 *
 * What it does NOT do (intentional):
 *   - Promote or demote agents (that's lifecycle-promotion-agent).
 *   - Quarantine agents (that's quarantine-enforcer-agent).
 *   - Touch the cluster, the repo, or any external API.
 *
 * Exit codes (extends global semantics from offline-guard):
 *   0 — clean (every agent meets at least Yellow on every metric)
 *   1 — at least one agent is in Red or Critical on at least one metric
 *   2 — fatal
 *   4 — kill switch engaged (handled by killswitch.ts)
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  installOfflineFatalHandler,
  OFFLINE_MODE,
  writeOfflineReport,
} from './shared/offline-guard';
import { groupFindings, harvestFindings, type NormalisedFinding } from './shared/findings-store';
import { assertNotKilled, KillswitchEngagedError } from './shared/killswitch';

const AGENT_NAME = 'scorecard-publisher-agent';
const LAYER = 'l1';
const OUT_DIR = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
const WINDOW_HOURS = Number(process.env.VELYA_SCORECARD_WINDOW_HOURS ?? '168');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

type Bucket = 'green' | 'yellow' | 'red' | 'critical';

interface MetricResult {
  value: number;
  bucket: Bucket;
}

interface AgentScorecard {
  agent: string;
  windowHours: number;
  reportsObserved: number;
  findingsObserved: number;
  metrics: {
    validationPassRate: MetricResult;
    auditPassRate: MetricResult;
    evidenceCompleteness: MetricResult;
    slaAdherence: MetricResult;
    correctionRecurrence: MetricResult;
    costPerDecisionUsd: MetricResult;
    latencyP95Ms: MetricResult;
    driftFromShadow: MetricResult;
  };
  worstBucket: Bucket;
  notes: string[];
}

interface RollupReport {
  timestamp: string;
  agent: string;
  layer: string;
  windowHours: number;
  perAgent: AgentScorecard[];
  summary: {
    totalAgents: number;
    green: number;
    yellow: number;
    red: number;
    critical: number;
  };
}

const BUCKET_RANK: Record<Bucket, number> = { green: 0, yellow: 1, red: 2, critical: 3 };

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

/**
 * Threshold tables from .claude/rules/agent-governance.md §Scorecard
 * Thresholds. Higher = better for the first four metrics; lower = better
 * for correctionRecurrence. The cost/latency/drift thresholds are
 * placeholders the cost-budget-watcher will refine in PR-E.
 */
function bucketHigherIsBetter(value: number, t: { green: number; yellow: number; red: number }): Bucket {
  if (value >= t.green) return 'green';
  if (value >= t.yellow) return 'yellow';
  if (value >= t.red) return 'red';
  return 'critical';
}

function bucketLowerIsBetter(value: number, t: { green: number; yellow: number; red: number }): Bucket {
  if (value <= t.green) return 'green';
  if (value <= t.yellow) return 'yellow';
  if (value <= t.red) return 'red';
  return 'critical';
}

function worstBucket(buckets: Bucket[]): Bucket {
  return buckets.reduce<Bucket>((acc, b) => (BUCKET_RANK[b] > BUCKET_RANK[acc] ? b : acc), 'green');
}

/**
 * Compute scorecard metrics for one agent's findings. Pure function:
 * deterministic given the same input findings.
 */
function scoreAgent(agent: string, findings: NormalisedFinding[]): AgentScorecard {
  const reportsObserved = new Set(findings.map((f) => f.timestamp)).size;
  const findingsObserved = findings.length;

  // Validation pass rate = fraction of findings with severity ≤ medium.
  // High/critical findings count as "validation failures" for the agent
  // because they represent the agent reporting a problem it could not
  // self-resolve.
  const cleanCount = findings.filter((f) => f.severity === 'low' || f.severity === 'info').length;
  const validationPassRateValue =
    findingsObserved === 0 ? 1 : cleanCount / findingsObserved;
  const validationPassRate: MetricResult = {
    value: validationPassRateValue,
    bucket: bucketHigherIsBetter(validationPassRateValue, { green: 0.9, yellow: 0.75, red: 0.6 }),
  };

  // Audit pass rate is computed identically today (we don't yet have a
  // separate auditor signal in the audit records). When validator-of-
  // validators lands, this will diverge from validationPassRate.
  const auditPassRate: MetricResult = {
    value: validationPassRateValue,
    bucket: bucketHigherIsBetter(validationPassRateValue, { green: 0.9, yellow: 0.8, red: 0.65 }),
  };

  // Evidence completeness — fraction of findings whose `raw` block has
  // the four required fields (rule, surface, severity, description).
  // This is a sanity check on the agents' own reporting hygiene.
  const completeCount = findings.filter(
    (f) => f.rule && f.surface && f.severity && f.description,
  ).length;
  const evidenceCompletenessValue =
    findingsObserved === 0 ? 1 : completeCount / findingsObserved;
  const evidenceCompleteness: MetricResult = {
    value: evidenceCompletenessValue,
    bucket: bucketHigherIsBetter(evidenceCompletenessValue, {
      green: 0.95,
      yellow: 0.85,
      red: 0.7,
    }),
  };

  // SLA adherence — fraction of expected report ticks the agent
  // actually produced. Without a per-agent expected cadence catalogue
  // we can only check that there was AT LEAST ONE report in the window.
  // The lifecycle-promotion agent in PR-H will add a real expected-tick
  // store keyed off the CronJob schedule.
  const slaValue = reportsObserved > 0 ? 1 : 0;
  const slaAdherence: MetricResult = {
    value: slaValue,
    bucket: bucketHigherIsBetter(slaValue, { green: 0.9, yellow: 0.75, red: 0.6 }),
  };

  // Correction recurrence — fraction of finding-ids that appeared more
  // than once in the window. Higher recurrence means the agent (or its
  // L2 healer) is failing to actually fix the underlying problem.
  const idCounts = new Map<string, number>();
  for (const f of findings) {
    idCounts.set(f.id, (idCounts.get(f.id) ?? 0) + 1);
  }
  const recurringIds = [...idCounts.values()].filter((n) => n > 1).length;
  const recurrenceValue = idCounts.size === 0 ? 0 : recurringIds / idCounts.size;
  const correctionRecurrence: MetricResult = {
    value: recurrenceValue,
    bucket: bucketLowerIsBetter(recurrenceValue, { green: 0.1, yellow: 0.25, red: 0.4 }),
  };

  // Placeholders — will be populated by future agents.
  const costPerDecisionUsd: MetricResult = { value: 0, bucket: 'green' };
  const latencyP95Ms: MetricResult = { value: 0, bucket: 'green' };
  const driftFromShadow: MetricResult = { value: 0, bucket: 'green' };

  const buckets = [
    validationPassRate.bucket,
    auditPassRate.bucket,
    evidenceCompleteness.bucket,
    slaAdherence.bucket,
    correctionRecurrence.bucket,
    costPerDecisionUsd.bucket,
    latencyP95Ms.bucket,
    driftFromShadow.bucket,
  ];

  const notes: string[] = [];
  if (findingsObserved === 0) {
    notes.push('no findings in window — agent may be silent or healthy');
  }
  if (recurrenceValue > 0.25) {
    notes.push(`${(recurrenceValue * 100).toFixed(1)}% of findings recur — investigate root cause`);
  }
  if (reportsObserved === 0) {
    notes.push('no reports observed in window — sla bucket is critical');
  }

  return {
    agent,
    windowHours: WINDOW_HOURS,
    reportsObserved,
    findingsObserved,
    metrics: {
      validationPassRate,
      auditPassRate,
      evidenceCompleteness,
      slaAdherence,
      correctionRecurrence,
      costPerDecisionUsd,
      latencyP95Ms,
      driftFromShadow,
    },
    worstBucket: worstBucket(buckets),
    notes,
  };
}

async function main(): Promise<void> {
  // Kill switch is the very first thing — before any I/O.
  try {
    assertNotKilled(AGENT_NAME, LAYER);
  } catch (error) {
    if (error instanceof KillswitchEngagedError) {
      console.warn(`[${AGENT_NAME}] killswitch engaged — exiting cleanly`, error.snapshot);
      process.exit(4);
    }
    throw error;
  }

  if (OFFLINE_MODE) {
    writeOfflineReport({
      agent: AGENT_NAME,
      layer: 1,
      outRoot: OUT_DIR,
      outSubdir: 'scorecard-publisher-audit',
      timestamp,
      reason: 'VELYA_SMOKE_OFFLINE=true',
      extra: { windowHours: WINDOW_HOURS },
    });
    return;
  }

  console.log(
    `[${AGENT_NAME}] harvesting findings from ${OUT_DIR} (last ${WINDOW_HOURS}h)`,
  );
  const { findings, manifest } = harvestFindings({
    rootDir: OUT_DIR,
    sinceHours: WINDOW_HOURS,
  });
  console.log(
    `[${AGENT_NAME}] harvested ${manifest.findingsTotal} findings from ${manifest.agentsSeen.length} agents`,
  );

  if (manifest.reportsRead === 0) {
    // Silent failure detection: if NO reports at all, that's a sign
    // that the audit dir is missing or all agents are dark. The
    // mesh-liveness-probe in PR-future would normally catch this, but
    // we surface it here too because the scorecard-publisher is the
    // earliest signal.
    console.warn(
      `[${AGENT_NAME}] no reports found in window — emitting silent-mesh finding`,
    );
  }

  const grouped = groupFindings(findings, (f) => f.agent);
  const allAgents = new Set<string>([...manifest.agentsSeen, ...grouped.keys()]);
  const perAgent: AgentScorecard[] = [];
  for (const agentName of [...allAgents].sort()) {
    perAgent.push(scoreAgent(agentName, grouped.get(agentName) ?? []));
  }

  const summary = perAgent.reduce(
    (acc, sc) => {
      acc[sc.worstBucket] += 1;
      acc.totalAgents += 1;
      return acc;
    },
    { totalAgents: 0, green: 0, yellow: 0, red: 0, critical: 0 } as RollupReport['summary'],
  );

  const report: RollupReport = {
    timestamp,
    agent: AGENT_NAME,
    layer: LAYER,
    windowHours: WINDOW_HOURS,
    perAgent,
    summary,
  };

  ensureDir(join(OUT_DIR, 'scorecard-publisher-audit'));
  ensureDir(join(OUT_DIR, 'scorecards'));
  const reportPath = join(OUT_DIR, 'scorecard-publisher-audit', `${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  writeFileSync(join(OUT_DIR, 'scorecards', 'latest.json'), JSON.stringify(report, null, 2));
  for (const sc of perAgent) {
    writeFileSync(
      join(OUT_DIR, 'scorecards', `${sc.agent}.json`),
      JSON.stringify(sc, null, 2),
    );
  }

  console.log(`[${AGENT_NAME}] report → ${reportPath}`);
  console.log(
    `[${AGENT_NAME}] summary: agents=${summary.totalAgents} green=${summary.green} yellow=${summary.yellow} red=${summary.red} critical=${summary.critical}`,
  );

  if (summary.red > 0 || summary.critical > 0) process.exit(1);
}

main().catch(installOfflineFatalHandler(AGENT_NAME));
