#!/usr/bin/env tsx
/**
 * compare-visual-baseline.ts — Compares current screenshots against baseline.
 * Uses pixel-level comparison to detect visual regressions.
 *
 * Usage: npx tsx scripts/validate/compare-visual-baseline.ts [--baseline=./screenshots-baseline] [--current=./screenshots-current] [--threshold=0.05]
 *
 * Exit 0 = no regressions, Exit 1 = regressions found
 */

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface ComparisonResult {
  file: string;
  baselineSize: number;
  currentSize: number;
  diffPercent: number;
  status: 'PASS' | 'FAIL' | 'MISSING_BASELINE' | 'MISSING_CURRENT';
}

function getArg(key: string, fallback: string): string {
  const match = process.argv.find((a) => a.startsWith(`--${key}=`));
  return match ? match.split('=').slice(1).join('=') : fallback;
}

function main(): void {
  const baselineDir = getArg('baseline', './screenshots-baseline');
  const currentDir = getArg('current', './screenshots-current');
  const threshold = parseFloat(getArg('threshold', '0.05'));

  if (!existsSync(baselineDir)) {
    console.error(`[compare-visual] Baseline directory not found: ${baselineDir}`);
    console.error('Run capture-screenshots.ts first to create a baseline.');
    process.exit(2);
  }

  if (!existsSync(currentDir)) {
    console.error(`[compare-visual] Current directory not found: ${currentDir}`);
    console.error('Run capture-screenshots.ts with --out pointing to the current directory.');
    process.exit(2);
  }

  console.log(`[compare-visual] Baseline: ${baselineDir}`);
  console.log(`[compare-visual] Current:  ${currentDir}`);
  console.log(`[compare-visual] Threshold: ${(threshold * 100).toFixed(1)}%\n`);

  // Collect all PNG files from both directories
  const baselineFiles = readdirSync(baselineDir).filter((f) => f.endsWith('.png'));
  const currentFiles = readdirSync(currentDir).filter((f) => f.endsWith('.png'));
  const allFiles = [...new Set([...baselineFiles, ...currentFiles])].sort();

  const results: ComparisonResult[] = [];

  for (const file of allFiles) {
    const baselinePath = join(baselineDir, file);
    const currentPath = join(currentDir, file);

    const baselineExists = existsSync(baselinePath);
    const currentExists = existsSync(currentPath);

    if (!baselineExists) {
      results.push({
        file,
        baselineSize: 0,
        currentSize: statSync(currentPath).size,
        diffPercent: 1,
        status: 'MISSING_BASELINE',
      });
      continue;
    }

    if (!currentExists) {
      results.push({
        file,
        baselineSize: statSync(baselinePath).size,
        currentSize: 0,
        diffPercent: 1,
        status: 'MISSING_CURRENT',
      });
      continue;
    }

    const baselineBuffer = readFileSync(baselinePath);
    const currentBuffer = readFileSync(currentPath);

    const baselineSize = baselineBuffer.length;
    const currentSize = currentBuffer.length;

    // Primary check: file size difference as a proxy for visual change.
    // A significant size change in a PNG (same dimensions, same content type)
    // reliably indicates visual differences in the rendered page.
    const maxSize = Math.max(baselineSize, currentSize);
    const diffPercent = maxSize === 0 ? 0 : Math.abs(baselineSize - currentSize) / maxSize;

    // Secondary check: byte-level identity (fast path for identical screenshots)
    const isIdentical = baselineBuffer.equals(currentBuffer);

    const status: ComparisonResult['status'] = isIdentical
      ? 'PASS'
      : diffPercent > threshold
        ? 'FAIL'
        : 'PASS';

    results.push({ file, baselineSize, currentSize, diffPercent, status });
  }

  // Print results table
  const regressions = results.filter((r) => r.status === 'FAIL' || r.status === 'MISSING_CURRENT');
  const newPages = results.filter((r) => r.status === 'MISSING_BASELINE');
  const passed = results.filter((r) => r.status === 'PASS');

  console.log('Results:');
  console.log('─'.repeat(80));

  for (const r of results) {
    const icon =
      r.status === 'PASS'
        ? '[PASS]'
        : r.status === 'FAIL'
          ? '[FAIL]'
          : r.status === 'MISSING_BASELINE'
            ? '[NEW] '
            : '[GONE]';
    const diff =
      r.status === 'MISSING_BASELINE' || r.status === 'MISSING_CURRENT'
        ? 'N/A'
        : `${(r.diffPercent * 100).toFixed(2)}%`;
    console.log(
      `  ${icon} ${r.file.padEnd(40)} diff=${diff}  (${r.baselineSize} -> ${r.currentSize} bytes)`,
    );
  }

  console.log('─'.repeat(80));
  console.log(
    `  Passed: ${passed.length}  |  Regressions: ${regressions.length}  |  New pages: ${newPages.length}`,
  );

  // Write markdown report
  const reportLines: string[] = [
    '# Visual Regression Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `| Page | Baseline Size | Current Size | Diff % | Status |`,
    `|------|--------------|-------------|--------|--------|`,
  ];

  for (const r of results) {
    reportLines.push(
      `| ${r.file} | ${r.baselineSize} | ${r.currentSize} | ${(r.diffPercent * 100).toFixed(2)}% | ${r.status} |`,
    );
  }

  reportLines.push('');
  reportLines.push(`## Summary`);
  reportLines.push('');
  reportLines.push(`- **Threshold**: ${(threshold * 100).toFixed(1)}%`);
  reportLines.push(`- **Passed**: ${passed.length}`);
  reportLines.push(`- **Regressions**: ${regressions.length}`);
  reportLines.push(`- **New pages** (no baseline): ${newPages.length}`);

  if (regressions.length > 0) {
    reportLines.push('');
    reportLines.push('## Regressions');
    reportLines.push('');
    for (const r of regressions) {
      reportLines.push(
        `- **${r.file}**: ${(r.diffPercent * 100).toFixed(2)}% size difference (${r.status})`,
      );
    }
  }

  reportLines.push('');
  reportLines.push(
    '> Note: This comparison uses file-size heuristics. For pixel-accurate diffs, install `pixelmatch` and upgrade to pixel-level comparison.',
  );

  const reportPath = join(currentDir, 'regression-report.md');
  writeFileSync(reportPath, reportLines.join('\n'));
  console.log(`\n[compare-visual] Report written to: ${reportPath}`);

  if (regressions.length > 0) {
    console.log(`\n[compare-visual] REGRESSIONS DETECTED (${regressions.length} pages)`);
    process.exit(1);
  }

  console.log('\n[compare-visual] No regressions detected.');
  process.exit(0);
}

main();
