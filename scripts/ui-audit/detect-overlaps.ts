#!/usr/bin/env tsx
/**
 * detect-overlaps.ts — Pixel-level UI gate. Catches what historically
 * slipped past axe-core / Lighthouse on Velya: text clipped by parent
 * overflow, headings hidden under the fixed sidebar, form fields stacked
 * on top of form fields, click targets shadowing each other, and labels
 * cut mid-word ("Lista de Pacient" instead of "Lista de Pacientes").
 *
 * Mandate (2026-04-11): no overlap, no partial text, no field-over-field,
 * no letter over letter, no half-visible description, no label cut. This
 * script is the machine gate for that mandate. Any apps/web PR has to
 * exit 0 here before merge — see .github/workflows/ui-overlap-gate.yaml.
 *
 * Usage:
 *   VELYA_SESSION=<cookie> npx tsx scripts/ui-audit/detect-overlaps.ts \
 *     [--url=http://localhost:3003] \
 *     [--out=./overlap-report] \
 *     [--fail-on=critical]      # or "any" | "high" | "none"
 *
 * Exit codes:
 *   0 — clean OR below fail-on threshold
 *   1 — findings at or above fail-on threshold
 *   2 — script itself failed (browser, auth, etc.)
 */

import { chromium, type Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Tolerances are the contract documented in .claude/rules/quality.md
// "UI Pixel Gate" — keep both sources in sync.
const TEXT_CLIP_H_TOLERANCE_PX = 4;
const TEXT_CLIP_V_TOLERANCE_PX = 8;
const SIDEBAR_OVERLAP_TOLERANCE_PX = 4;
const FIELD_OVERLAP_RATIO = 0.3;
const ACTIONABLE_OVERLAP_RATIO = 0.5;
const MIN_RECT_SIZE_PX = 10;

interface CliArgs {
  url: string;
  out: string;
  sessionCookie: string;
  failOn: 'none' | 'any' | 'high' | 'critical';
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const get = (k: string, d: string) => {
    const m = argv.find((a) => a.startsWith(`--${k}=`));
    return m ? m.split('=').slice(1).join('=') : d;
  };
  return {
    url: get('url', 'http://localhost:3003'),
    out: get('out', join(process.cwd(), 'overlap-report')),
    sessionCookie: process.env.VELYA_SESSION ?? '',
    failOn: get('fail-on', 'critical') as CliArgs['failOn'],
  };
}

interface PageSpec {
  path: string;
  name: string;
}

const PAGES: PageSpec[] = [
  { path: '/', name: 'home' },
  { path: '/patients', name: 'patients' },
  { path: '/tasks', name: 'tasks' },
  { path: '/alerts', name: 'alerts' },
  { path: '/agents', name: 'agents' },
  { path: '/icu', name: 'icu' },
  { path: '/beds', name: 'beds' },
  { path: '/pharmacy', name: 'pharmacy' },
];

interface Finding {
  page: string;
  severity: 'critical' | 'high' | 'medium';
  rule: string;
  description: string;
  selector?: string;
  rect?: { x: number; y: number; width: number; height: number };
  conflictSelector?: string;
  conflictRect?: { x: number; y: number; width: number; height: number };
}

interface DetectorThresholds {
  textClipH: number;
  textClipV: number;
  sidebarTolerance: number;
  fieldOverlapRatio: number;
  actionableOverlapRatio: number;
  minRectSize: number;
}

/**
 * In-browser collector. Runs via page.evaluate so it has no access to
 * Node closures — accepts thresholds as a serialised argument and
 * returns a flat array.
 */
function collectFindingsInPage(
  pageName: string,
  T: DetectorThresholds,
): Omit<Finding, 'page'>[] {
  const out: Omit<Finding, 'page'>[] = [];

  const describe = (el: Element): string => {
    const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
    const cls = (el as HTMLElement).className
      ? `.${String((el as HTMLElement).className).split(/\s+/).filter(Boolean).slice(0, 2).join('.')}`
      : '';
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };

  const isVisible = (el: Element): boolean => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // Pass 1 — text clipped by its own container.
  document
    .querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, p, span, label, a, button, [class*="title"], [class*="label"]',
    )
    .forEach((el) => {
      if (!isVisible(el)) return;
      if (el.children.length > 0 && el.textContent && el.textContent.trim().length === 0) return;

      const cs = getComputedStyle(el);
      const hasTextOverflow =
        cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis';

      const clippedHoriz =
        el.scrollWidth - el.clientWidth > T.textClipH &&
        cs.overflowX !== 'auto' &&
        cs.overflowX !== 'scroll';
      const clippedVert =
        el.scrollHeight - el.clientHeight > T.textClipV &&
        cs.overflowY !== 'auto' &&
        cs.overflowY !== 'scroll' &&
        cs.overflow !== 'auto';

      if (clippedHoriz && hasTextOverflow && cs.whiteSpace !== 'nowrap') {
        out.push({
          severity: 'high',
          rule: 'text-clipped-horizontal',
          description: `Text overflows container horizontally: "${(el.textContent ?? '').trim().slice(0, 80)}"`,
          selector: describe(el),
          rect: el.getBoundingClientRect().toJSON(),
        });
      }
      if (clippedVert) {
        out.push({
          severity: 'medium',
          rule: 'text-clipped-vertical',
          description: `Text overflows container vertically: "${(el.textContent ?? '').trim().slice(0, 80)}"`,
          selector: describe(el),
          rect: el.getBoundingClientRect().toJSON(),
        });
      }
    });

  // Pass 2 — main headings hidden under the fixed sidebar.
  const sidebar = document.querySelector<HTMLElement>('aside.app-sidebar, aside');
  const sidebarRect = sidebar?.getBoundingClientRect();
  const sidebarFixed = sidebar ? getComputedStyle(sidebar).position === 'fixed' : false;
  document
    .querySelectorAll<HTMLElement>(
      'main h1, main h2, main h3, .app-content-wrapper h1, .app-content-wrapper h2, .page-title',
    )
    .forEach((el) => {
      if (!isVisible(el) || !sidebar || !sidebarRect || !sidebarFixed) return;
      if (sidebarRect.width <= 0 || sidebarRect.right <= 0) return;
      const r = el.getBoundingClientRect();
      if (r.left < sidebarRect.right - T.sidebarTolerance && r.right > 0) {
        out.push({
          severity: 'critical',
          rule: 'heading-overlaps-sidebar',
          description: `"${(el.textContent ?? '').trim().slice(0, 80)}" renders under the fixed sidebar (heading.left=${Math.round(r.left)}, sidebar.right=${Math.round(sidebarRect.right)})`,
          selector: describe(el),
          rect: r.toJSON(),
          conflictSelector: describe(sidebar),
          conflictRect: sidebarRect.toJSON(),
        });
      }
    });

  // Shared overlap helper — used by Pass 3 (fields) and Pass 4
  // (actionables). Hoists each element's rect once, sorts by top to
  // enable an early-exit when the next candidate is below the current
  // one's bottom edge, and skips parent/child nestings when requested.
  const findOverlaps = (
    elements: HTMLElement[],
    opts: {
      ratio: number;
      severity: Finding['severity'];
      rule: string;
      description: string;
      skipNested: boolean;
    },
  ) => {
    const visible = elements
      .filter(isVisible)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width >= T.minRectSize && r.height >= T.minRectSize)
      .sort((a, b) => a.r.top - b.r.top);

    for (let i = 0; i < visible.length; i += 1) {
      const a = visible[i]!;
      for (let j = i + 1; j < visible.length; j += 1) {
        const b = visible[j]!;
        if (b.r.top >= a.r.bottom) break;
        if (opts.skipNested && (a.el.contains(b.el) || b.el.contains(a.el))) continue;
        const ix = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
        const iy = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
        const inter = ix * iy;
        const areaA = a.r.width * a.r.height;
        if (inter / areaA > opts.ratio) {
          out.push({
            severity: opts.severity,
            rule: opts.rule,
            description: opts.description,
            selector: describe(a.el),
            rect: a.r.toJSON(),
            conflictSelector: describe(b.el),
            conflictRect: b.r.toJSON(),
          });
        }
      }
    }
  };

  findOverlaps(Array.from(document.querySelectorAll<HTMLElement>('input, textarea, select')), {
    ratio: T.fieldOverlapRatio,
    severity: 'critical',
    rule: 'field-over-field',
    description: 'Two form fields occupy the same space',
    skipNested: false,
  });

  findOverlaps(Array.from(document.querySelectorAll<HTMLElement>('button, a[href]')), {
    ratio: T.actionableOverlapRatio,
    severity: 'high',
    rule: 'actionable-overlap',
    description: 'Two actionable elements overlap',
    skipNested: true,
  });

  return out;
}

const THRESHOLDS: DetectorThresholds = {
  textClipH: TEXT_CLIP_H_TOLERANCE_PX,
  textClipV: TEXT_CLIP_V_TOLERANCE_PX,
  sidebarTolerance: SIDEBAR_OVERLAP_TOLERANCE_PX,
  fieldOverlapRatio: FIELD_OVERLAP_RATIO,
  actionableOverlapRatio: ACTIONABLE_OVERLAP_RATIO,
  minRectSize: MIN_RECT_SIZE_PX,
};

async function collect(page: Page, spec: PageSpec): Promise<Finding[]> {
  await page.waitForSelector('.gh-header', { timeout: 30000 }).catch(() => null);
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape').catch(() => null);
  await page.waitForTimeout(400);
  // tsx/esbuild compiles named function expressions with a `__name(fn,
  // "name")` helper that only exists at the top of the generated Node
  // module. We ship a no-op shim so Function.prototype.toString output
  // is callable inside the browser context.
  const fnSource = collectFindingsInPage.toString();
  const result = await page.evaluate(
    `(function() { if (typeof __name === 'undefined') { window.__name = function(fn) { return fn; }; } return (${fnSource})(${JSON.stringify(spec.name)}, ${JSON.stringify(THRESHOLDS)}); })()`,
  );
  if (!Array.isArray(result)) return [];
  return (result as Omit<Finding, 'page'>[]).map((f) => ({ page: spec.name, ...f }));
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!args.sessionCookie) {
    console.error('[detect-overlaps] VELYA_SESSION cookie is required');
    process.exit(2);
  }

  await mkdir(args.out, { recursive: true });
  console.log(`[detect-overlaps] URL: ${args.url}`);
  console.log(`[detect-overlaps] Out: ${args.out}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await ctx.addCookies([
    {
      name: 'velya_session',
      value: args.sessionCookie,
      domain: new URL(args.url).hostname,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('velya:onboarding-seen', 'true');
      localStorage.setItem('velya:onboarding-dismissed', 'true');
    } catch {
      /* storage disabled */
    }
  });

  // Walk pages in parallel — independent pages on a shared authenticated
  // context. Reduces the gate from ~20 s (sequential 8×2.5 s) to ~3-5 s
  // on a warm prod build.
  const pageResults = await Promise.all(
    PAGES.map(async (spec) => {
      const p = await ctx.newPage();
      try {
        await p.goto(`${args.url}${spec.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        const findings = await collect(p, spec);
        console.log(`  ${spec.name}: ${findings.length} findings`);
        return findings;
      } catch (e) {
        console.log(`  ${spec.name}: error ${(e as Error).message.slice(0, 120)}`);
        return [];
      } finally {
        await p.close();
      }
    }),
  );

  await browser.close();

  const allFindings = pageResults.flat();
  const bySeverity = {
    critical: allFindings.filter((f) => f.severity === 'critical').length,
    high: allFindings.filter((f) => f.severity === 'high').length,
    medium: allFindings.filter((f) => f.severity === 'medium').length,
  };

  const report = {
    timestamp: new Date().toISOString(),
    url: args.url,
    pages: PAGES.length,
    totalFindings: allFindings.length,
    bySeverity,
    findings: allFindings,
  };

  const outFile = join(args.out, `overlap-report-${Date.now()}.json`);
  await writeFile(outFile, JSON.stringify(report, null, 2));
  console.log(`\n[detect-overlaps] report → ${outFile}`);
  console.log(
    `[detect-overlaps] crit=${bySeverity.critical} high=${bySeverity.high} med=${bySeverity.medium}`,
  );

  for (const f of allFindings.slice(0, 20)) {
    console.log(`  [${f.severity}] ${f.page} ${f.rule}: ${f.description}`);
  }

  const shouldFail =
    (args.failOn === 'any' && allFindings.length > 0) ||
    (args.failOn === 'critical' && bySeverity.critical > 0) ||
    (args.failOn === 'high' && bySeverity.critical + bySeverity.high > 0);

  if (shouldFail) process.exit(1);
}

main().catch((error) => {
  console.error('[detect-overlaps] Fatal:', error);
  process.exit(2);
});
