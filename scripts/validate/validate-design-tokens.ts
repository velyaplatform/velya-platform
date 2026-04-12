#!/usr/bin/env tsx
/**
 * validate-design-tokens.ts — Comprehensive design system compliance check.
 * Combines color policy, emoji policy, and inline-style-color checks.
 *
 * Usage: npx tsx scripts/validate/validate-design-tokens.ts
 * Exit 0 = compliant, Exit 1 = violations found
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  PROHIBITED_COLOR_REGEX,
  PROHIBITED_EMOJI_REGEX,
} from '../../apps/web/src/lib/design-tokens';

const WEB_SRC = join(process.cwd(), 'apps/web/src');

type ViolationType = 'color' | 'emoji' | 'inline-style-color';

interface Violation {
  type: ViolationType;
  file: string;
  line: number;
  match: string;
  context: string;
}

/** Allowlisted hex values used in inline styles (neutral grays + Primer vars) */
const ALLOWED_HEX = new Set([
  'fff', 'ffffff', '000', '000000',
  '171717', '262626', '404040', '525252', '737373',
  'a3a3a3', 'd4d4d4', 'e5e5e5', 'f5f5f5', 'fafafa',
  '1f2328', '59636e', '818b98', 'd1d9e0', 'f6f8fa',
  '32383f', '7d8590', 'afb8c1',
]);

const INLINE_COLOR_REGEX =
  /(?:color|background|borderColor|backgroundColor|borderTopColor)\s*[:=]\s*['"]#([0-9a-fA-F]{3,8})['"]/g;

async function collectFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      files.push(...await collectFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts') && entry.name !== 'design-tokens.ts') {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const files = await collectFiles(WEB_SRC);
  const violations: Violation[] = [];

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');
    const relPath = relative(process.cwd(), file);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();

      if (trimmed.startsWith('import ') || trimmed.startsWith('* ') || trimmed.startsWith('//')) continue;

      // Check prohibited Tailwind colors
      PROHIBITED_COLOR_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = PROHIBITED_COLOR_REGEX.exec(line)) !== null) {
        violations.push({
          type: 'color',
          file: relPath,
          line: i + 1,
          match: match[0],
          context: trimmed.slice(0, 120),
        });
      }

      // Check emojis
      PROHIBITED_EMOJI_REGEX.lastIndex = 0;
      while ((match = PROHIBITED_EMOJI_REGEX.exec(line)) !== null) {
        violations.push({
          type: 'emoji',
          file: relPath,
          line: i + 1,
          match: `U+${(match[0].codePointAt(0) ?? 0).toString(16).toUpperCase()}`,
          context: trimmed.slice(0, 120),
        });
      }

      // Check inline style colors
      INLINE_COLOR_REGEX.lastIndex = 0;
      while ((match = INLINE_COLOR_REGEX.exec(line)) !== null) {
        const hex = match[1].toLowerCase();
        if (!ALLOWED_HEX.has(hex)) {
          violations.push({
            type: 'inline-style-color',
            file: relPath,
            line: i + 1,
            match: `#${hex}`,
            context: trimmed.slice(0, 120),
          });
        }
      }
    }
  }

  console.log(`\nvalidate-design-tokens: checked ${files.length} files\n`);

  if (violations.length === 0) {
    console.log('RESULT: PASS (0 violations)');
    process.exit(0);
  }

  const byType = violations.reduce<Record<string, number>>((acc, v) => {
    acc[v.type] = (acc[v.type] ?? 0) + 1;
    return acc;
  }, {});

  console.error(`RESULT: FAIL (${violations.length} violations)`);
  console.error(`  color: ${byType.color ?? 0}`);
  console.error(`  emoji: ${byType.emoji ?? 0}`);
  console.error(`  inline-style-color: ${byType['inline-style-color'] ?? 0}\n`);

  for (const v of violations) {
    console.error(`  [${v.type}] ${v.file}:${v.line} — ${v.match}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('validate-design-tokens: ERROR', err);
  process.exit(2);
});
