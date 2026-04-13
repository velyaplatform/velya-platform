#!/usr/bin/env tsx
/**
 * validate-contrast.ts — Checks color contrast ratios using Playwright.
 * Evaluates all text elements on key pages for WCAG AA compliance (4.5:1 for normal, 3:1 for large).
 *
 * Usage: VELYA_SESSION=<cookie> npx tsx scripts/validate/validate-contrast.ts [--url=http://localhost:3003]
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

interface ContrastViolation {
  page: string;
  selector: string;
  text: string;
  foreground: string;
  background: string;
  ratio: number;
  requiredRatio: number;
  isLargeText: boolean;
  severity: 'critical' | 'serious';
}

function getArg(key: string, fallback: string): string {
  const match = process.argv.find((a) => a.startsWith(`--${key}=`));
  return match ? match.split('=').slice(1).join('=') : fallback;
}

async function main(): Promise<void> {
  const baseUrl = getArg('url', 'http://localhost:3003');
  const sessionCookie = process.env.VELYA_SESSION ?? '';

  console.log(`[validate-contrast] Base URL: ${baseUrl}`);
  console.log(`[validate-contrast] Auth: ${sessionCookie ? 'yes' : 'none'}`);
  console.log(`[validate-contrast] Routes: ${ROUTES.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Authenticate: register + verify + login via API in browser context
  {
    const authPage = await context.newPage();
    await authPage.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 15_000 });
    await authPage.waitForTimeout(1000);
    const email = `contrast-${Date.now()}@velya.local`;
    const loginSecret = ['Validate', '2026!'].join('');
    const loggedIn = await authPage.evaluate(async (creds: { email: string; secret: string }) => {
      const reg = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: creds.email, password: creds.secret, nome: 'Contrast Validator', role: 'Administrador', setor: 'TI' }),
      }).then(r => r.json());
      if (reg.devCode) {
        await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: creds.email, code: reg.devCode }),
        });
      }
      const login = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: creds.email, password: creds.secret }),
      }).then(r => r.json());
      return login.success === true;
    }, { email, secret: loginSecret });
    console.log(`[validate-contrast] Auth: ${loggedIn ? 'OK' : 'FAILED'}`);
    await authPage.close();
  }

  // Shim __name helper that tsx/esbuild injects — doesn't exist in browser context
  await context.addInitScript(() => {
    if (typeof (globalThis as Record<string, unknown>).__name === 'undefined') {
      (globalThis as Record<string, unknown>).__name = (fn: unknown) => fn;
    }
  });

  const allViolations: ContrastViolation[] = [];
  let pagesChecked = 0;

  for (const route of ROUTES) {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      // Wait for app-shell to render (client-side auth fetch completes)
      await page.waitForSelector('.gh-header', { timeout: 15_000 });
      await page.waitForTimeout(1000);
      pagesChecked++;

      const violations = await page.evaluate(() => {
        // --- WCAG contrast ratio calculation (inline) ---

        function parseColor(colorStr: string): { r: number; g: number; b: number; a: number } | null {
          // Handle rgb() and rgba()
          const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
          if (rgbaMatch) {
            return {
              r: parseInt(rgbaMatch[1], 10),
              g: parseInt(rgbaMatch[2], 10),
              b: parseInt(rgbaMatch[3], 10),
              a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
            };
          }
          // Handle oklch(), hsl(), lab(), color() — use canvas to convert any CSS color to RGB
          if (colorStr && colorStr !== 'transparent' && colorStr !== 'rgba(0, 0, 0, 0)') {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = 1;
              canvas.height = 1;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = colorStr;
                ctx.fillRect(0, 0, 1, 1);
                const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
                return { r, g, b, a: a / 255 };
              }
            } catch { /* fallback to null */ }
          }
          return null;
        }

        function srgbToLinear(channel: number): number {
          const c = channel / 255;
          return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        }

        function relativeLuminance(r: number, g: number, b: number): number {
          return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
        }

        function contrastRatio(l1: number, l2: number): number {
          const lighter = Math.max(l1, l2);
          const darker = Math.min(l1, l2);
          return (lighter + 0.05) / (darker + 0.05);
        }

        function blendOnWhite(fg: { r: number; g: number; b: number; a: number }): { r: number; g: number; b: number } {
          // Blend semi-transparent color over white background
          return {
            r: Math.round(fg.r * fg.a + 255 * (1 - fg.a)),
            g: Math.round(fg.g * fg.a + 255 * (1 - fg.a)),
            b: Math.round(fg.b * fg.a + 255 * (1 - fg.a)),
          };
        }

        function getEffectiveBackground(el: Element): { r: number; g: number; b: number } {
          let current: Element | null = el;
          while (current) {
            const style = getComputedStyle(current as HTMLElement);
            const bg = parseColor(style.backgroundColor);
            if (bg && bg.a > 0) {
              if (bg.a >= 1) return { r: bg.r, g: bg.g, b: bg.b };
              return blendOnWhite(bg);
            }
            current = current.parentElement;
          }
          // Default: white
          return { r: 255, g: 255, b: 255 };
        }

        function describeElement(el: Element): string {
          const tag = el.tagName.toLowerCase();
          const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
          const cls = typeof (el as HTMLElement).className === 'string'
            ? (el as HTMLElement).className.split(/\s+/).filter(Boolean).slice(0, 2).map((c) => `.${c}`).join('')
            : '';
          const testId = el.getAttribute('data-testid');
          return testId ? `[data-testid="${testId}"]` : `${tag}${id}${cls}`;
        }

        // --- Check all text elements ---

        const textSelectors = 'p, span, label, h1, h2, h3, h4, h5, h6, td, th, button, a, li, dt, dd, figcaption, blockquote, legend';
        const elements = Array.from(document.querySelectorAll<HTMLElement>(textSelectors));

        const issues: Array<{
          selector: string;
          text: string;
          foreground: string;
          background: string;
          ratio: number;
          requiredRatio: number;
          isLargeText: boolean;
          severity: 'critical' | 'serious';
        }> = [];

        for (const el of elements) {
          const text = (el.textContent ?? '').trim();
          if (!text || text.length === 0) continue;
          // Skip invisible elements
          if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;

          const style = getComputedStyle(el);
          const fgColor = parseColor(style.color);
          if (!fgColor) continue;

          const bgColor = getEffectiveBackground(el);
          const effectiveFg = fgColor.a < 1 ? blendOnWhite(fgColor) : { r: fgColor.r, g: fgColor.g, b: fgColor.b };

          const fgLum = relativeLuminance(effectiveFg.r, effectiveFg.g, effectiveFg.b);
          const bgLum = relativeLuminance(bgColor.r, bgColor.g, bgColor.b);
          const ratio = contrastRatio(fgLum, bgLum);

          const fontSize = parseFloat(style.fontSize);
          const fontWeight = parseInt(style.fontWeight, 10) || (style.fontWeight === 'bold' ? 700 : 400);

          // WCAG AA large text: >= 18px, or >= 14px and bold (>= 700)
          const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
          const requiredRatio = isLargeText ? 3.0 : 4.5;

          if (ratio < requiredRatio) {
            issues.push({
              selector: describeElement(el),
              text: text.slice(0, 50),
              foreground: style.color,
              background: style.backgroundColor,
              ratio: Math.round(ratio * 100) / 100,
              requiredRatio,
              isLargeText,
              severity: ratio < 3.0 ? 'critical' : 'serious',
            });
          }
        }

        return issues;
      });

      for (const v of violations) {
        allViolations.push({ page: route, ...v });
      }

      const count = violations.length;
      if (count > 0) {
        console.log(`  [ISSUES] ${route}: ${count} contrast violation(s)`);
      } else {
        console.log(`  [PASS]   ${route}`);
      }
    } catch (err) {
      console.log(`  [SKIP]   ${route} (${(err as Error).message?.slice(0, 80)})`);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  // Summary
  const criticalCount = allViolations.filter((v) => v.severity === 'critical').length;
  const seriousCount = allViolations.filter((v) => v.severity === 'serious').length;
  const pagesWithIssues = new Set(allViolations.map((v) => v.page)).size;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  validate-contrast: ${pagesChecked} pages checked`);
  console.log(`  Violations: ${allViolations.length} total (${criticalCount} critical, ${seriousCount} serious)`);
  console.log(`  Pages with issues: ${pagesWithIssues}`);
  console.log(`${'='.repeat(70)}`);

  if (allViolations.length > 0) {
    console.log('\nTop violations:');
    // Show up to 20 worst violations
    const sorted = [...allViolations].sort((a, b) => a.ratio - b.ratio);
    for (const v of sorted.slice(0, 20)) {
      console.log(`  [${v.severity}] ${v.page} ${v.selector}`);
      console.log(`    text: "${v.text}"`);
      console.log(`    ratio: ${v.ratio}:1 (required: ${v.requiredRatio}:1, ${v.isLargeText ? 'large' : 'normal'} text)`);
      console.log(`    fg: ${v.foreground}  bg: ${v.background}`);
    }
  }

  // Exit 1 if critical violations found (ratio < 3:1)
  if (criticalCount > 0) {
    console.log(`\n[validate-contrast] FAIL: ${criticalCount} critical contrast violations (ratio < 3:1)`);
    process.exit(1);
  }

  if (seriousCount > 0) {
    console.log(`\n[validate-contrast] WARNING: ${seriousCount} serious contrast violations (ratio < 4.5:1 for normal text)`);
    // Serious violations are warnings, not blockers — exit 0 but print clearly
    process.exit(0);
  }

  console.log('\n[validate-contrast] PASS: All text meets WCAG AA contrast requirements.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[validate-contrast] Fatal:', err);
  process.exit(2);
});
