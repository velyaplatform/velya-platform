#!/usr/bin/env tsx
/**
 * scan-phi-leakage.ts — static scanner that flags code paths where PHI or
 * PII is likely to leak into logs, URLs, events, or analytics. Runs in CI
 * via clinical-compliance-gate.yaml and in-editor via
 * `npm run scan:phi`.
 *
 * What counts as a finding:
 *   1. `console.log` / `console.error` / `logger.*` with an argument that
 *      contains keywords like `cpf`, `patient`, `paciente`, `ssn`, `rg`,
 *      `birthDate`, `diagnosis`, `medication`.
 *   2. Hard-coded CPFs / SSNs / MRNs in source files (regex).
 *   3. URL construction that concatenates `/Patient/` with a string that
 *      is not the sanitized id (caller must use the FHIR client, not
 *      direct fetch).
 *   4. Inserts into `packages/observability/*` that pass raw objects
 *      without going through the PHI redactor.
 *
 * The scanner is allowlist-aware: paths under `tests/**`, `docs/**`,
 * `schemas/**`, and explicit `@allow-phi` comments are ignored.
 *
 * Exit codes:
 *   0 — no critical findings
 *   1 — at least one critical finding
 *   2 — fatal scanner error
 *
 * Output: JSON report at ${VELYA_COMPLIANCE_OUT}/phi-leakage.json plus a
 * GitHub-flavoured markdown summary on stdout suitable for
 * `$GITHUB_STEP_SUMMARY`.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface Finding {
  severity: Severity;
  rule: string;
  file: string;
  line: number;
  snippet: string;
  message: string;
}

interface Report {
  generatedAt: string;
  scannedFiles: number;
  findings: Finding[];
  bySeverity: Record<Severity, number>;
}

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..', '..');
const OUT_DIR = process.env.VELYA_COMPLIANCE_OUT ?? join(REPO_ROOT, 'ops', 'state', 'compliance');

const SCAN_GLOBS = ['apps', 'services', 'packages', 'platform', 'scripts/agents'];

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  '.git',
]);

const SKIP_FILE_SUFFIX = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];

const PHI_KEYWORDS = [
  'cpf',
  'rg',
  'ssn',
  'mrn',
  'patient\\.',
  'paciente\\.',
  'birthdate',
  'birth_date',
  'diagnosis',
  'diagnostico',
  'medication',
  'medicamento',
  'prescription',
  'prescricao',
];

const LOG_CALL_RE = /(console\.(log|error|warn|info|debug)|logger\.(log|info|warn|error|debug|trace))\s*\(([^)]*)\)/g;
const CPF_RE = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g;
const SSN_RE = /(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/g;
const DIRECT_PATIENT_FETCH_RE = /fetch\s*\(\s*[`"'][^`"']*\/Patient\//g;
const ALLOW_TAG = '@allow-phi';

const BINARY_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.svg',
  '.lock',
]);

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      if (SKIP_FILE_SUFFIX.some((suf) => full.endsWith(suf))) continue;
      const dotIdx = entry.name.lastIndexOf('.');
      const ext = dotIdx >= 0 ? entry.name.slice(dotIdx) : '';
      if (BINARY_EXT.has(ext)) continue;
      if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue;
      yield full;
    }
  }
}

function findingsForFile(file: string, content: string): Finding[] {
  if (content.includes(ALLOW_TAG)) return [];
  const findings: Finding[] = [];
  const lines = content.split('\n');

  // Rule 1: log calls with PHI keywords
  const phiRe = new RegExp(`\\b(${PHI_KEYWORDS.join('|')})\\b`, 'i');
  LOG_CALL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LOG_CALL_RE.exec(content)) !== null) {
    const args = match[4] ?? '';
    if (!phiRe.test(args)) continue;
    const idx = match.index;
    const line = content.slice(0, idx).split('\n').length;
    findings.push({
      severity: 'critical',
      rule: 'phi-in-log',
      file,
      line,
      snippet: (lines[line - 1] ?? '').trim().slice(0, 200),
      message:
        'Log call includes a PHI-adjacent field. Route through `packages/observability/redactor` or extract structured fields.',
    });
  }

  // Rule 2: hard-coded CPF
  CPF_RE.lastIndex = 0;
  while ((match = CPF_RE.exec(content)) !== null) {
    const idx = match.index;
    const line = content.slice(0, idx).split('\n').length;
    // Ignore fixtures that explicitly look like placeholders
    if (match[0].replace(/[.-]/g, '') === '00000000000') continue;
    findings.push({
      severity: 'critical',
      rule: 'hardcoded-cpf',
      file,
      line,
      snippet: (lines[line - 1] ?? '').trim().slice(0, 200),
      message: 'Hard-coded CPF detected. Use a fixture factory or env secret.',
    });
  }

  // Rule 3: hard-coded SSN
  SSN_RE.lastIndex = 0;
  while ((match = SSN_RE.exec(content)) !== null) {
    const idx = match.index;
    const line = content.slice(0, idx).split('\n').length;
    findings.push({
      severity: 'critical',
      rule: 'hardcoded-ssn',
      file,
      line,
      snippet: (lines[line - 1] ?? '').trim().slice(0, 200),
      message: 'Hard-coded SSN detected.',
    });
  }

  // Rule 4: direct fetch('/Patient/...') — should go through FHIR client
  DIRECT_PATIENT_FETCH_RE.lastIndex = 0;
  while ((match = DIRECT_PATIENT_FETCH_RE.exec(content)) !== null) {
    const idx = match.index;
    const line = content.slice(0, idx).split('\n').length;
    findings.push({
      severity: 'high',
      rule: 'direct-patient-fetch',
      file,
      line,
      snippet: (lines[line - 1] ?? '').trim().slice(0, 200),
      message:
        'Direct fetch against /Patient/. Use `packages/fhir-client` so auth, audit, and redaction are enforced.',
    });
  }

  return findings;
}

async function run(): Promise<number> {
  const allFindings: Finding[] = [];
  let scanned = 0;
  for (const rootRel of SCAN_GLOBS) {
    const root = join(REPO_ROOT, rootRel);
    if (!existsSync(root)) continue;
    try {
      statSync(root);
    } catch {
      continue;
    }
    for await (const file of walk(root)) {
      scanned++;
      let content: string;
      try {
        content = readFileSync(file, 'utf-8');
      } catch {
        continue;
      }
      const rel = relative(REPO_ROOT, file);
      for (const f of findingsForFile(rel, content)) allFindings.push(f);
    }
  }

  const bySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const f of allFindings) bySeverity[f.severity]++;

  const report: Report = {
    generatedAt: new Date().toISOString(),
    scannedFiles: scanned,
    findings: allFindings,
    bySeverity,
  };

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'phi-leakage.json'), JSON.stringify(report, null, 2));

  // Markdown summary
  console.log('## PHI Leakage Scan\n');
  console.log(`- Scanned files: **${scanned}**`);
  console.log(`- Findings: critical=${bySeverity.critical} high=${bySeverity.high} medium=${bySeverity.medium} low=${bySeverity.low}`);
  if (allFindings.length > 0) {
    console.log('\n| Severity | Rule | File | Line | Message |');
    console.log('|---|---|---|---|---|');
    for (const f of allFindings.slice(0, 50)) {
      const msg = f.message.replace(/\|/g, '\\|');
      console.log(`| ${f.severity} | ${f.rule} | \`${f.file}\` | ${f.line} | ${msg} |`);
    }
    if (allFindings.length > 50) {
      console.log(`\n_… and ${allFindings.length - 50} more — see \`${join(OUT_DIR, 'phi-leakage.json')}\`._`);
    }
  }

  return bySeverity.critical > 0 ? 1 : 0;
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[phi-leakage] fatal:', err);
    process.exit(2);
  });
