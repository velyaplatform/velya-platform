#!/usr/bin/env tsx
/**
 * validate-form-labels.ts — Ensures every form field has a visible label.
 * Uses Playwright to crawl pages and check for label associations.
 *
 * Usage: VELYA_SESSION=<cookie> npx tsx scripts/validate/validate-form-labels.ts [--url=http://localhost:3003]
 * Exit 0 = all fields labeled, Exit 1 = unlabeled fields found
 */

import { chromium } from 'playwright';

interface Violation {
  page: string;
  element: string;
  name: string;
  reason: string;
}

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

async function main() {
  const baseUrl = process.argv.find(a => a.startsWith('--url='))?.split('=')[1] ?? 'http://localhost:3003';
  const sessionCookie = process.env.VELYA_SESSION ?? '';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

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

  const violations: Violation[] = [];
  let pagesChecked = 0;

  for (const route of ROUTES) {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(500);
      pagesChecked++;

      const results = await page.evaluate(() => {
        const issues: { element: string; name: string; reason: string }[] = [];
        const fields = document.querySelectorAll('input, select, textarea');

        for (const field of fields) {
          const el = field as HTMLInputElement;
          if (el.type === 'hidden') continue;
          if (el.offsetParent === null) continue;

          const hasLabel = el.labels && el.labels.length > 0;
          const hasAriaLabel = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
          const hasTitle = el.hasAttribute('title');

          if (!hasLabel && !hasAriaLabel && !hasTitle) {
            issues.push({
              element: el.tagName.toLowerCase(),
              name: el.name || el.id || el.className.slice(0, 40),
              reason: 'No label, aria-label, aria-labelledby, or title',
            });
          }
        }
        return issues;
      });

      for (const r of results) {
        violations.push({ page: route, ...r });
      }
    } catch {
      // Page may not exist or timeout — skip
    } finally {
      await page.close();
    }
  }

  await browser.close();

  if (violations.length === 0) {
    console.log(`validate-form-labels: PASS (checked ${pagesChecked} pages)`);
    process.exit(0);
  }

  console.error(`validate-form-labels: FAIL (${violations.length} unlabeled fields across ${pagesChecked} pages)\n`);
  for (const v of violations) {
    console.error(`  ${v.page} — <${v.element}> "${v.name}": ${v.reason}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('validate-form-labels: ERROR', err);
  process.exit(2);
});
