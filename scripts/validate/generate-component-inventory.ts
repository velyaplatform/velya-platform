#!/usr/bin/env tsx
/**
 * generate-component-inventory.ts — Auto-generates a catalog of all shared components.
 * Scans apps/web/src/app/components/ and produces a markdown inventory.
 *
 * Usage: npx tsx scripts/validate/generate-component-inventory.ts
 * Output: docs/frontend/component-inventory.md
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const COMPONENTS_DIR = join(process.cwd(), 'apps/web/src/app/components');
const OUTPUT_FILE = join(process.cwd(), 'docs/frontend/component-inventory.md');

interface ComponentEntry {
  file: string;
  componentNames: string[];
  lines: number;
  isClientComponent: boolean;
  importSources: string[];
  propsInterface: string;
}

async function findComponentFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      files.push(...await findComponentFiles(full));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx') &&
      !entry.name.endsWith('.d.ts') &&
      !entry.name.endsWith('.test.md')
    ) {
      files.push(full);
    }
  }
  return files;
}

function extractComponentNames(content: string): string[] {
  const names: string[] = [];

  // export function ComponentName
  const funcMatches = content.matchAll(/export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9]*)/g);
  for (const m of funcMatches) {
    names.push(m[1]);
  }

  // export const ComponentName = ...
  const constMatches = content.matchAll(/export\s+(?:default\s+)?const\s+([A-Z][A-Za-z0-9]*)\s*[=:]/g);
  for (const m of constMatches) {
    names.push(m[1]);
  }

  return [...new Set(names)];
}

function extractImportSources(content: string): string[] {
  const sources: string[] = [];
  const importMatches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
  for (const m of importMatches) {
    const src = m[1];
    // Only track notable external packages, not relative imports
    if (src.startsWith('@radix-ui')) sources.push('radix');
    else if (src.startsWith('lucide-react') || src === 'lucide-react') sources.push('lucide');
    else if (src === 'react' || src === 'react-dom') sources.push('react');
    else if (src === 'next/link' || src === 'next/navigation' || src === 'next/image') sources.push('next');
    else if (src.startsWith('class-variance-authority') || src === 'class-variance-authority') sources.push('cva');
    else if (src === 'clsx' || src === 'tailwind-merge') sources.push('tailwind-utils');
    else if (src.startsWith('framer-motion')) sources.push('framer-motion');
  }
  return [...new Set(sources)].sort();
}

function extractPropsInterface(content: string): string {
  // Match interface FooProps { ... } or type FooProps = { ... }
  const interfaceMatch = content.match(/(?:interface|type)\s+(\w+Props)\s*(?:=\s*)?{([^}]*)}/);
  if (interfaceMatch) {
    const name = interfaceMatch[1];
    const body = interfaceMatch[2].trim();
    if (!body) return `${name} (empty)`;
    // Count props
    const propCount = body.split(';').filter((s) => s.trim().length > 0).length +
                      body.split('\n').filter((s) => s.trim().length > 0 && !s.includes(';')).length;
    // Deduplicate counting
    const propLines = body.split('\n').filter((s) => s.trim().length > 0);
    return `${name} (${propLines.length} props)`;
  }
  return '-';
}

async function main() {
  const files = await findComponentFiles(COMPONENTS_DIR);
  files.sort();

  const entries: ComponentEntry[] = [];

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').length;
    const isClientComponent = content.includes("'use client'") || content.includes('"use client"');
    const componentNames = extractComponentNames(content);
    const importSources = extractImportSources(content);
    const propsInterface = extractPropsInterface(content);
    const file = relative(process.cwd(), filePath);

    entries.push({
      file,
      componentNames,
      lines,
      isClientComponent,
      importSources,
      propsInterface,
    });
  }

  const now = new Date().toISOString().split('T')[0];
  const totalComponents = entries.reduce((acc, e) => acc + e.componentNames.length, 0);
  const clientCount = entries.filter((e) => e.isClientComponent).length;

  const output: string[] = [
    '# Component Inventory',
    '',
    `Generated: ${now}`,
    '',
    `Total files: ${entries.length}`,
    `Total exported components: ${totalComponents}`,
    `Client components: ${clientCount}`,
    `Server components: ${entries.length - clientCount}`,
    '',
    '| File | Components | Lines | Client | Imports | Props |',
    '|------|-----------|------:|:------:|---------|-------|',
  ];

  for (const entry of entries) {
    const names = entry.componentNames.length > 0 ? entry.componentNames.join(', ') : '(none exported)';
    const client = entry.isClientComponent ? 'Yes' : 'No';
    const imports = entry.importSources.length > 0 ? entry.importSources.join(', ') : '-';

    output.push(
      `| \`${entry.file}\` | ${names} | ${entry.lines} | ${client} | ${imports} | ${entry.propsInterface} |`
    );
  }

  output.push('');

  // Import source summary
  const importCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const src of entry.importSources) {
      importCounts.set(src, (importCounts.get(src) ?? 0) + 1);
    }
  }

  output.push('## Import Sources');
  output.push('');
  output.push('| Source | Used By (files) |');
  output.push('|--------|----------------:|');
  for (const [src, count] of [...importCounts.entries()].sort((a, b) => b[1] - a[1])) {
    output.push(`| ${src} | ${count} |`);
  }
  output.push('');

  const outputDir = join(process.cwd(), 'docs/frontend');
  await mkdir(outputDir, { recursive: true });

  await writeFile(OUTPUT_FILE, output.join('\n'), 'utf-8');
  console.log(`Component inventory written to ${relative(process.cwd(), OUTPUT_FILE)}`);
  console.log(`Found ${entries.length} files, ${totalComponents} components.`);
}

main().catch((err) => {
  console.error('Failed to generate component inventory:', err);
  process.exit(1);
});
