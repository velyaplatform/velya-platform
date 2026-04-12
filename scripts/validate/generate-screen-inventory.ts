#!/usr/bin/env tsx
/**
 * generate-screen-inventory.ts — Auto-generates a catalog of all screens/pages.
 * Scans apps/web/src/app/ for page.tsx files and produces a markdown inventory.
 *
 * Usage: npx tsx scripts/validate/generate-screen-inventory.ts
 * Output: docs/frontend/screen-inventory.md
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const APP_DIR = join(process.cwd(), 'apps/web/src/app');
const OUTPUT_FILE = join(process.cwd(), 'docs/frontend/screen-inventory.md');

interface ScreenEntry {
  route: string;
  title: string;
  type: string;
  lines: number;
  file: string;
}

async function findPageFiles(dir: string): Promise<string[]> {
  const pages: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      pages.push(...await findPageFiles(full));
    } else if (entry.isFile() && entry.name === 'page.tsx') {
      pages.push(full);
    }
  }
  return pages;
}

function extractRoute(filePath: string): string {
  const rel = relative(APP_DIR, filePath);
  // Remove the trailing /page.tsx
  const dir = rel.replace(/\/page\.tsx$/, '');
  if (dir === 'page.tsx') return '/';
  return '/' + dir;
}

function extractTitle(content: string): string {
  // Look for pageTitle prop or string literal assigned to title-like vars
  const pageTitleMatch = content.match(/pageTitle\s*[=:]\s*["'`]([^"'`]+)["'`]/);
  if (pageTitleMatch) return pageTitleMatch[1];

  // Look for title prop on AppShell or ModuleListView
  const titlePropMatch = content.match(/title\s*=\s*["'`]([^"'`]+)["'`]/);
  if (titlePropMatch) return titlePropMatch[1];

  // Look for <h1> content
  const h1Match = content.match(/<h1[^>]*>\s*([^<]+)\s*<\/h1>/);
  if (h1Match) return h1Match[1].trim();

  return '-';
}

function extractType(content: string): string {
  const hasModuleListView = content.includes('ModuleListView');
  const hasAppShell = content.includes('AppShell');

  if (hasModuleListView) return 'ModuleListView';
  if (hasAppShell) return 'AppShell';
  return 'Custom';
}

async function main() {
  const pageFiles = await findPageFiles(APP_DIR);
  pageFiles.sort();

  const entries: ScreenEntry[] = [];

  for (const filePath of pageFiles) {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').length;
    const route = extractRoute(filePath);
    const title = extractTitle(content);
    const type = extractType(content);
    const file = relative(process.cwd(), filePath);

    entries.push({ route, title, type, lines, file });
  }

  // Sort by route
  entries.sort((a, b) => a.route.localeCompare(b.route));

  const now = new Date().toISOString().split('T')[0];
  const lines: string[] = [
    '# Screen Inventory',
    '',
    `Generated: ${now}`,
    '',
    `Total screens: ${entries.length}`,
    '',
    '| Route | Title | Type | Lines | File |',
    '|-------|-------|------|------:|------|',
  ];

  for (const entry of entries) {
    lines.push(
      `| \`${entry.route}\` | ${entry.title} | ${entry.type} | ${entry.lines} | \`${entry.file}\` |`
    );
  }

  lines.push('');

  // Summary by type
  const typeCounts = new Map<string, number>();
  for (const entry of entries) {
    typeCounts.set(entry.type, (typeCounts.get(entry.type) ?? 0) + 1);
  }
  lines.push('## Summary by Type');
  lines.push('');
  lines.push('| Type | Count |');
  lines.push('|------|------:|');
  for (const [type, count] of [...typeCounts.entries()].sort()) {
    lines.push(`| ${type} | ${count} |`);
  }
  lines.push('');

  // Ensure output dir exists
  const outputDir = join(process.cwd(), 'docs/frontend');
  await mkdir(outputDir, { recursive: true });

  await writeFile(OUTPUT_FILE, lines.join('\n'), 'utf-8');
  console.log(`Screen inventory written to ${relative(process.cwd(), OUTPUT_FILE)}`);
  console.log(`Found ${entries.length} screens.`);
}

main().catch((err) => {
  console.error('Failed to generate screen inventory:', err);
  process.exit(1);
});
