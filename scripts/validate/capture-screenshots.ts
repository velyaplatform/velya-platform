#!/usr/bin/env tsx
/**
 * capture-screenshots.ts — Captures baseline screenshots of all key pages.
 * Uses Playwright to navigate and screenshot each route.
 *
 * Usage: VELYA_SESSION=<cookie> npx tsx scripts/validate/capture-screenshots.ts [--url=http://localhost:3003] [--out=./screenshots-baseline]
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';

const ROUTES = [
  '/', '/patients', '/patients/new', '/tasks', '/prescriptions',
  '/lab/orders', '/lab/results', '/imaging/orders', '/imaging/results',
  '/discharge', '/beds', '/surgery', '/icu', '/ems', '/pharmacy',
  '/pharmacy/stock', '/staff-on-duty', '/cleaning/tasks',
  '/transport/orders', '/meals/orders', '/search', '/alerts',
  '/delegations', '/delegations/new', '/handoffs', '/handoffs/new',
  '/employees', '/employees/new', '/suppliers', '/suppliers/new',
  '/supply/items', '/supply/purchase-orders',
];

function slugify(route: string): string {
  if (route === '/') return 'home';
  return route.replace(/^\//, '').replace(/\//g, '-');
}

function getArg(key: string, fallback: string): string {
  const match = process.argv.find((a) => a.startsWith(`--${key}=`));
  return match ? match.split('=').slice(1).join('=') : fallback;
}

async function main(): Promise<void> {
  const baseUrl = getArg('url', 'http://localhost:3003');
  const outDir = getArg('out', './screenshots-baseline');
  const sessionCookie = process.env.VELYA_SESSION ?? '';

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  console.log(`[capture-screenshots] Base URL: ${baseUrl}`);
  console.log(`[capture-screenshots] Output: ${outDir}`);
  console.log(`[capture-screenshots] Routes: ${ROUTES.length}`);
  console.log(`[capture-screenshots] Auth: ${sessionCookie ? 'yes (VELYA_SESSION)' : 'none'}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  if (sessionCookie) {
    await context.addCookies([{
      name: 'velya_session',
      value: sessionCookie,
      domain: new URL(baseUrl).hostname,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
    }]);
  }

  let captured = 0;
  let failed = 0;
  const failures: Array<{ route: string; error: string }> = [];

  for (const route of ROUTES) {
    const slug = slugify(route);
    const page = await context.newPage();
    try {
      const response = await page.goto(`${baseUrl}${route}`, {
        waitUntil: 'networkidle',
        timeout: 20_000,
      });

      if (!response || response.status() >= 400) {
        throw new Error(`HTTP ${response?.status() ?? 'no response'}`);
      }

      // Wait for fonts and animations to settle
      await page.waitForTimeout(800);

      // Disable animations for deterministic screenshots
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            caret-color: transparent !important;
          }
        `,
      });

      const filePath = `${outDir}/${slug}.png`;
      await page.screenshot({ path: filePath, fullPage: true });
      captured++;
      console.log(`  [CAPTURED] ${route} -> ${slug}.png`);
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ route, error: message });
      console.log(`  [FAILED]   ${route} -> ${message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log(`\n[capture-screenshots] Summary: ${captured} captured, ${failed} failed out of ${ROUTES.length} routes`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  ${f.route}: ${f.error}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[capture-screenshots] Fatal:', err);
  process.exit(2);
});
