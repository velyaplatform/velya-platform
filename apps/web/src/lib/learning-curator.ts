/**
 * Learning Curator — SHADOW MODE ONLY.
 *
 * Reads recent findings from the cron store, groups them by
 * (surface + target) — or by a field name inside `details.field` when it
 * exists — and produces a summary of repeated patterns.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ THIS MODULE DOES NOT TAKE ANY CORRECTIVE ACTION.                     │
 * │                                                                      │
 * │ It is governed by .claude/rules/agents.md and .claude/rules/ai-      │
 * │ safety.md: every learning is recorded as an advisory entry via       │
 * │ `recordLearning(...)` and waits for explicit human promotion via     │
 * │ /api/agents/[agentId] action=promote. No agent may self-promote.     │
 * │                                                                      │
 * │ The curator is intentionally stateless beyond the cron store: rerun  │
 * │ it any number of times, it will deduplicate learnings by patternId.  │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Heuristic for confidence:
 *   confidence = occurrences / (1 + recentResolved), clamped to [0, 1]
 *
 *   where `recentResolved` counts findings in the same pattern whose
 *   status is `resolved-auto`, `resolved-manual`, or `dismissed`. A
 *   pattern that keeps getting resolved but keeps coming back still gets
 *   a high confidence; a pattern that was resolved and stayed gone gets
 *   pushed down.
 *
 * Promotion qualification:
 *   qualifiesForPromotion === true  ⇔  occurrences >= 5 AND confidence > 0.7
 */

import {
  listFindings,
  recordLearning,
  type CronFinding,
  type Severity,
} from './cron-store';

export interface LearningPattern {
  patternId: string;
  surface: string;
  targetSample: string;
  occurrences: number;
  severities: Record<Severity, number>;
  firstSeen: string;
  lastSeen: string;
  /** Heuristic confidence: occurrences / (1 + recentResolved) clamped 0..1 */
  confidence: number;
  /** True when pattern qualifies for promote-recommendation (occurrences >= 5 + confidence > 0.7) */
  qualifiesForPromotion: boolean;
}

interface PatternAccumulator {
  patternId: string;
  surface: string;
  targetSample: string;
  findings: CronFinding[];
  resolvedCount: number;
  firstSeen: string;
  lastSeen: string;
  severities: Record<Severity, number>;
}

function emptySeverityCounts(): Record<Severity, number> {
  return { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
}

function computePatternKey(finding: CronFinding): string {
  const detailField =
    finding.details && typeof finding.details === 'object'
      ? (finding.details as Record<string, unknown>).field
      : undefined;
  if (typeof detailField === 'string' && detailField.length > 0) {
    return `${finding.surface}::field::${detailField}`;
  }
  return `${finding.surface}::target::${finding.target}`;
}

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Reads the last 200 findings from the cron store and groups them into
 * repeated patterns. Returns a list ordered by occurrences (desc).
 */
export function summarizeLearnings(): LearningPattern[] {
  const findings = listFindings({ limit: 200 });
  const accumulators = new Map<string, PatternAccumulator>();

  for (const finding of findings) {
    const patternId = computePatternKey(finding);
    const existing = accumulators.get(patternId);
    const isResolved =
      finding.status === 'resolved-auto' ||
      finding.status === 'resolved-manual' ||
      finding.status === 'dismissed';

    if (!existing) {
      const severities = emptySeverityCounts();
      severities[finding.severity] += 1;
      accumulators.set(patternId, {
        patternId,
        surface: finding.surface,
        targetSample: finding.target,
        findings: [finding],
        resolvedCount: isResolved ? 1 : 0,
        firstSeen: finding.createdAt,
        lastSeen: finding.createdAt,
        severities,
      });
      continue;
    }

    existing.findings.push(finding);
    existing.severities[finding.severity] += 1;
    if (isResolved) existing.resolvedCount += 1;
    if (finding.createdAt < existing.firstSeen) existing.firstSeen = finding.createdAt;
    if (finding.createdAt > existing.lastSeen) existing.lastSeen = finding.createdAt;
  }

  const patterns: LearningPattern[] = [];
  for (const acc of accumulators.values()) {
    const occurrences = acc.findings.length;
    // occurrences / (1 + recentResolved), then normalise to 0..1 by a soft
    // cap of 10 — 10 or more unresolved repetitions saturate confidence at 1.
    const rawConfidence = occurrences / (1 + acc.resolvedCount);
    const confidence = clamp01(rawConfidence / 10);
    patterns.push({
      patternId: acc.patternId,
      surface: acc.surface,
      targetSample: acc.targetSample,
      occurrences,
      severities: acc.severities,
      firstSeen: acc.firstSeen,
      lastSeen: acc.lastSeen,
      confidence,
      qualifiesForPromotion: occurrences >= 5 && confidence > 0.7,
    });
  }

  patterns.sort((a, b) => b.occurrences - a.occurrences);
  return patterns;
}

export interface ProposePromotionsResult {
  patternsScanned: number;
  promotionsProposed: number;
  patternIds: string[];
}

/**
 * For each pattern that qualifies for promotion, records an advisory
 * learning entry via `recordLearning`. NEVER promotes an agent — that
 * is a gated human action exposed by /api/agents/[agentId] action=promote.
 */
export function proposePromotions(): ProposePromotionsResult {
  const patterns = summarizeLearnings();
  const qualifying = patterns.filter((p) => p.qualifiesForPromotion);
  const patternIds: string[] = [];

  for (const pattern of qualifying) {
    const worstSeverity = (['critical', 'high', 'medium', 'low', 'info'] as Severity[]).find(
      (s) => pattern.severities[s] > 0,
    );
    const observation =
      `Padrão recorrente em ${pattern.surface} (${pattern.occurrences} ocorrências, ` +
      `severidade predominante ${worstSeverity ?? 'info'}, confiança ${pattern.confidence.toFixed(2)}). ` +
      `Amostra de alvo: ${pattern.targetSample}.`;
    const recommendation =
      `Revisar manualmente via /agents: padrão ${pattern.patternId} é candidato a ` +
      `promoção de aprendizado. Nenhuma ação automática foi tomada — shadow mode obrigatório. ` +
      `Última ocorrência em ${pattern.lastSeen}.`;

    recordLearning({
      patternId: pattern.patternId,
      observation,
      recommendation,
    });
    patternIds.push(pattern.patternId);
  }

  return {
    patternsScanned: patterns.length,
    promotionsProposed: patternIds.length,
    patternIds,
  };
}
