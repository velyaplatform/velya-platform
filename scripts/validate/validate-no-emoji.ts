#!/usr/bin/env tsx
/**
 * validate-no-emoji.ts — Ensures no emoji characters exist in TSX UI files.
 * Part of the frontend governance pipeline (Stage 1).
 *
 * Usage: npx tsx scripts/validate/validate-no-emoji.ts
 * Exit 0 = clean, Exit 1 = violations found
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { PROHIBITED_EMOJI_REGEX } from '../../apps/web/src/lib/design-tokens';

const WEB_SRC = join(process.cwd(), 'apps/web/src');

interface Violation {
  file: string;
  line: number;
  match: string;
  context: string;
}

async function collectTsxFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      files.push(...await collectTsxFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts') && entry.name !== 'design-tokens.ts') {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const files = await collectTsxFiles(WEB_SRC);
  const violations: Violation[] = [];

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();
      if (trimmed.startsWith('import ') || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

      PROHIBITED_EMOJI_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = PROHIBITED_EMOJI_REGEX.exec(line)) !== null) {
        violations.push({
          file: relative(process.cwd(), file),
          line: i + 1,
          match: `U+${(match[0].codePointAt(0) ?? 0).toString(16).toUpperCase()}`,
          context: trimmed.slice(0, 120),
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log(`validate-no-emoji: PASS (0 violations, ${files.length} files checked)`);
    process.exit(0);
  }

  console.error(`validate-no-emoji: FAIL (${violations.length} violations)\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} — ${v.match}`);
    console.error(`    ${v.context}\n`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('validate-no-emoji: ERROR', err);
  process.exit(2);
});
