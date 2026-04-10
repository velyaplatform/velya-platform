/**
 * Field Linkability Gate
 *
 * Enforces the user policy: "todos os novos campos precisam ter a opção de
 * clicar e ser direcionado para onde faz sentido referente àquela informação".
 *
 * Concretely: any column in apps/web/src/lib/module-manifest.ts whose key
 * looks like a foreign-reference (Mrn, Id, Ref suffix or one of the well-
 * known field names below) MUST declare a `linkTo` so the generic edit/list
 * layer renders it as a clickable navigation target.
 *
 * Run locally:    npx tsx scripts/check-field-linkability.ts
 * In CI:          wired into .github/workflows/ui-quality.yaml as a gate job
 *
 * Exit codes:
 *   0 — every reference column has linkTo
 *   1 — at least one violation found (gate fails the pipeline)
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const MANIFEST_PATH = join(__dirname, '..', 'apps', 'web', 'src', 'lib', 'module-manifest.ts');

/**
 * Patterns that mark a column key as a foreign-reference field. Keep in
 * lock-step with apps/web/src/lib/cron-runners.ts → REFERENCE_PATTERNS so the
 * runtime cron check and this CI gate report the same things.
 */
const REFERENCE_PATTERNS: RegExp[] = [
  /Mrn$/,
  /^assetId$/,
  /^employeeId$/,
  /^supplierId$/,
  /^claimId$/,
  /^orderId$/,
  /^encounterId$/,
  /^prescriptionId$/,
  /^bedId$/,
  /^wardId$/,
  /^staffId$/,
  /^physicianId$/,
];

/** Columns that look like references but are intentionally exempt. */
const EXEMPT_KEYS = new Set([
  'id', // primary key — already linked by row click
]);

interface Violation {
  moduleId: string;
  columnKey: string;
  line: number;
}

function parseManifest(): Violation[] {
  const src = readFileSync(MANIFEST_PATH, 'utf8');
  const lines = src.split('\n');
  const violations: Violation[] = [];

  // Light-weight parser: walk top-level objects of MODULES, track current
  // module id, and inspect each column object until we either find linkTo
  // or hit the closing brace.
  let currentModuleId: string | null = null;
  let inColumns = false;
  let columnDepth = 0;
  let currentColumn: { key?: string; line: number; hasLinkTo: boolean } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Module id detection
    const idMatch = line.match(/^\s*id:\s*['"]([\w.-]+)['"]/);
    if (idMatch && !inColumns) {
      currentModuleId = idMatch[1];
    }

    // Enter / leave columns array
    if (/columns:\s*\[/.test(line)) {
      inColumns = true;
      columnDepth = 0;
      continue;
    }
    if (inColumns && /^\s*\],?\s*$/.test(line) && columnDepth === 0) {
      inColumns = false;
      continue;
    }
    if (!inColumns) continue;

    // Track open/close braces to find column object boundaries
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;

    if (opens > closes && !currentColumn) {
      currentColumn = { line: i + 1, hasLinkTo: false };
    }

    if (currentColumn) {
      const keyMatch = line.match(/key:\s*['"]([\w.-]+)['"]/);
      if (keyMatch) currentColumn.key = keyMatch[1];
      if (/linkTo:/.test(line)) currentColumn.hasLinkTo = true;
    }

    columnDepth += opens - closes;

    if (currentColumn && closes > opens && columnDepth === 0) {
      // Column object closed — evaluate
      const key = currentColumn.key;
      if (key && currentModuleId && !EXEMPT_KEYS.has(key)) {
        const matches = REFERENCE_PATTERNS.some((re) => re.test(key));
        if (matches && !currentColumn.hasLinkTo) {
          violations.push({
            moduleId: currentModuleId,
            columnKey: key,
            line: currentColumn.line,
          });
        }
      }
      currentColumn = null;
    }
  }

  return violations;
}

function main(): void {
  console.log('=== Field Linkability Gate ===');
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Reference patterns: ${REFERENCE_PATTERNS.length}`);
  console.log('');

  const violations = parseManifest();
  if (violations.length === 0) {
    console.log('✓ Todos os campos de referência têm linkTo configurado.');
    process.exit(0);
  }

  console.error(`✗ ${violations.length} coluna(s) de referência sem linkTo:\n`);
  for (const v of violations) {
    console.error(`  ${v.moduleId}.${v.columnKey}  →  module-manifest.ts:${v.line}`);
  }
  console.error('');
  console.error('Política: campos terminando em Mrn / Id / Ref e referências a');
  console.error('entidades (employeeId, assetId, supplierId, claimId, orderId,');
  console.error('encounterId, prescriptionId, bedId, wardId, staffId, physicianId)');
  console.error('precisam declarar `linkTo` no module-manifest para virarem clicáveis.');
  console.error('');
  console.error('Para isentar uma coluna, adicione-a ao EXEMPT_KEYS deste script.');
  process.exit(1);
}

main();
