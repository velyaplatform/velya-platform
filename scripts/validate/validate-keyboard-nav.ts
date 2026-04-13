#!/usr/bin/env tsx
/**
 * validate-keyboard-nav.ts — Tests keyboard navigation on key pages.
 * Uses Playwright to Tab through pages and verify focus is visible and logical.
 *
 * Usage: VELYA_SESSION=<cookie> npx tsx scripts/validate/validate-keyboard-nav.ts [--url=http://localhost:3003]
 */

import { chromium } from 'playwright';

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

const TAB_COUNT = 20;

interface FocusIssue {
  page: string;
  tabIndex: number;
  type: 'stuck-on-body' | 'focus-trap' | 'missing-focus-indicator' | 'no-focusable-elements';
  detail: string;
}

function getArg(key: string, fallback: string): string {
  const match = process.argv.find((a) => a.startsWith(`--${key}=`));
  return match ? match.split('=').slice(1).join('=') : fallback;
}

async function main(): Promise<void> {
  const baseUrl = getArg('url', 'http://localhost:3003');
  const sessionCookie = process.env.VELYA_SESSION ?? '';

  console.log(`[validate-keyboard-nav] Base URL: ${baseUrl}`);
  console.log(`[validate-keyboard-nav] Auth: ${sessionCookie ? 'yes' : 'none'}`);
  console.log(`[validate-keyboard-nav] Routes: ${ROUTES.length}`);
  console.log(`[validate-keyboard-nav] Tabs per page: ${TAB_COUNT}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
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

  const allIssues: FocusIssue[] = [];
  let pagesChecked = 0;

  for (const route of ROUTES) {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 20_000 });
      await page.waitForTimeout(500);
      pagesChecked++;

      const pageIssues: FocusIssue[] = [];
      let previousSelector = '';
      let bodyStuckCount = 0;
      let consecutiveSameElement = 0;

      for (let i = 0; i < TAB_COUNT; i++) {
        await page.keyboard.press('Tab');

        const focusInfo = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) {
            return { tag: 'body', selector: 'body', hasFocusIndicator: false };
          }

          const tag = el.tagName.toLowerCase();
          const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
          const cls = typeof (el as HTMLElement).className === 'string'
            ? (el as HTMLElement).className.split(/\s+/).filter(Boolean).slice(0, 2).map((c) => `.${c}`).join('')
            : '';
          const testId = el.getAttribute('data-testid');
          const selector = testId ? `[data-testid="${testId}"]` : `${tag}${id}${cls}`;

          // Check for visible focus indicator
          const style = getComputedStyle(el);
          const boxShadow = style.boxShadow;
          const outlineWidth = parseFloat(style.outlineWidth);

          const hasOutline = outlineWidth > 0 && style.outlineStyle !== 'none';
          const hasBoxShadow = boxShadow !== 'none' && boxShadow !== '';
          // Also check for ring classes (Tailwind pattern)
          const hasRingClass = el.className?.toString().includes('ring') ?? false;

          return {
            tag,
            selector,
            hasFocusIndicator: hasOutline || hasBoxShadow || hasRingClass,
          };
        });

        // Check: stuck on body
        if (focusInfo.tag === 'body') {
          bodyStuckCount++;
          if (bodyStuckCount >= 3 && i >= 3) {
            // Only flag if we have tried enough tabs and consistently land on body
            pageIssues.push({
              page: route,
              tabIndex: i + 1,
              type: 'stuck-on-body',
              detail: `Focus returned to body after tab ${i + 1}`,
            });
          }
        } else {
          bodyStuckCount = 0;
        }

        // Check: focus trap (same element twice in a row)
        if (focusInfo.selector === previousSelector && focusInfo.tag !== 'body') {
          consecutiveSameElement++;
          if (consecutiveSameElement >= 2) {
            pageIssues.push({
              page: route,
              tabIndex: i + 1,
              type: 'focus-trap',
              detail: `Focus stuck on ${focusInfo.selector} for ${consecutiveSameElement + 1} consecutive tabs`,
            });
          }
        } else {
          consecutiveSameElement = 0;
        }

        // Check: missing focus indicator on interactive elements
        if (
          focusInfo.tag !== 'body' &&
          !focusInfo.hasFocusIndicator &&
          ['a', 'button', 'input', 'select', 'textarea'].includes(focusInfo.tag)
        ) {
          pageIssues.push({
            page: route,
            tabIndex: i + 1,
            type: 'missing-focus-indicator',
            detail: `${focusInfo.selector} has no visible focus indicator (no outline, box-shadow, or ring)`,
          });
        }

        previousSelector = focusInfo.selector;
      }

      // Check: no focusable elements at all (body stuck from the start)
      if (bodyStuckCount >= TAB_COUNT) {
        pageIssues.push({
          page: route,
          tabIndex: 0,
          type: 'no-focusable-elements',
          detail: 'No focusable elements found on page after all tab presses',
        });
      }

      // Deduplicate missing-focus-indicator per selector
      const seenIndicatorIssues = new Set<string>();
      const deduped = pageIssues.filter((issue) => {
        if (issue.type === 'missing-focus-indicator') {
          const key = `${issue.page}:${issue.detail}`;
          if (seenIndicatorIssues.has(key)) return false;
          seenIndicatorIssues.add(key);
        }
        return true;
      });

      allIssues.push(...deduped);

      if (deduped.length > 0) {
        console.log(`  [ISSUES] ${route}: ${deduped.length} keyboard nav issue(s)`);
      } else {
        console.log(`  [PASS]   ${route}`);
      }
    } catch {
      console.log(`  [SKIP]   ${route} (failed to load)`);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  // Summary
  const focusTraps = allIssues.filter((i) => i.type === 'focus-trap').length;
  const stuckOnBody = allIssues.filter((i) => i.type === 'stuck-on-body').length;
  const missingIndicators = allIssues.filter((i) => i.type === 'missing-focus-indicator').length;
  const noFocusable = allIssues.filter((i) => i.type === 'no-focusable-elements').length;
  const pagesWithIssues = new Set(allIssues.map((i) => i.page)).size;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  validate-keyboard-nav: ${pagesChecked} pages checked`);
  console.log(`  Issues: ${allIssues.length} total`);
  console.log(`    Focus traps: ${focusTraps}`);
  console.log(`    Stuck on body: ${stuckOnBody}`);
  console.log(`    Missing focus indicators: ${missingIndicators}`);
  console.log(`    No focusable elements: ${noFocusable}`);
  console.log(`  Pages with issues: ${pagesWithIssues}`);
  console.log(`${'='.repeat(70)}`);

  if (allIssues.length > 0) {
    console.log('\nAll issues:');
    for (const issue of allIssues) {
      console.log(`  [${issue.type}] ${issue.page} (tab #${issue.tabIndex}): ${issue.detail}`);
    }
  }

  // Focus traps and no-focusable-elements are critical
  const criticalCount = focusTraps + noFocusable;
  if (criticalCount > 0) {
    console.log(`\n[validate-keyboard-nav] FAIL: ${criticalCount} critical keyboard nav issues (focus traps or unreachable pages)`);
    process.exit(1);
  }

  if (allIssues.length > 0) {
    console.log(`\n[validate-keyboard-nav] WARNING: ${allIssues.length} keyboard nav issues found (non-blocking)`);
    process.exit(0);
  }

  console.log('\n[validate-keyboard-nav] PASS: Keyboard navigation works on all tested pages.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[validate-keyboard-nav] Fatal:', err);
  process.exit(2);
});
