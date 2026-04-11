import { chromium, type Page } from 'playwright';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.TEST_URL || 'http://velya.172.19.0.6.nip.io';
const SCREENSHOT_DIR = '/tmp/velya-screenshots';

if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

interface PageTest {
  name: string;
  path: string;
  viewport: { width: number; height: number };
  device: string;
  checks: string[];
}

type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

interface AxeViolation {
  id: string;
  impact: Severity;
  description: string;
  help: string;
  helpUrl: string;
  nodes: number;
}

interface AxeSummary {
  violations: AxeViolation[];
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
}

interface GeometryIssue {
  type:
    | 'overlap'
    | 'clipping'
    | 'offscreen'
    | 'horizontal-overflow'
    | 'touch-target'
    | 'sticky-over-cta'
    | 'modal-overflow'
    | 'small-font';
  selector: string;
  description: string;
}

interface PageResult {
  name: string;
  status: 'PASS' | 'ISSUES' | 'ERROR';
  issues: string[];
  axe: AxeSummary | null;
  geometry: GeometryIssue[];
  screenshot: string;
}

const pages: PageTest[] = [
  // Desktop
  {
    name: 'login-desktop',
    path: '/login',
    viewport: { width: 1440, height: 900 },
    device: 'desktop',
    checks: ['form', 'inputs', 'button'],
  },
  {
    name: 'register-desktop',
    path: '/register',
    viewport: { width: 1440, height: 900 },
    device: 'desktop',
    checks: ['form', 'select', 'inputs'],
  },
  {
    name: 'verify-desktop',
    path: '/verify?email=test@test.com&devCode=123456',
    viewport: { width: 1440, height: 900 },
    device: 'desktop',
    checks: ['code-input'],
  },
  // Mobile iPhone
  {
    name: 'login-mobile',
    path: '/login',
    viewport: { width: 390, height: 844 },
    device: 'iPhone 14',
    checks: ['form', 'touch-targets'],
  },
  {
    name: 'register-mobile',
    path: '/register',
    viewport: { width: 390, height: 844 },
    device: 'iPhone 14',
    checks: ['form', 'scroll'],
  },
  // Tablet
  {
    name: 'login-tablet',
    path: '/login',
    viewport: { width: 768, height: 1024 },
    device: 'iPad',
    checks: ['form', 'centered'],
  },
];

async function stabilize(p: Page) {
  try {
    await p.addStyleTag({
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
    await p.evaluate(
      () => (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready,
    );
  } catch {
    // ignore stabilize failures — they should never block the run
  }
}

async function runAxeOnPage(p: Page): Promise<AxeSummary> {
  const builder = new AxeBuilder({ page: p })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .disableRules(['color-contrast-enhanced']);

  const result = await builder.analyze();
  const violations: AxeViolation[] = result.violations.map((v) => ({
    id: v.id,
    impact: (v.impact ?? 'minor') as Severity,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
  }));

  return {
    violations,
    criticalCount: violations.filter((v) => v.impact === 'critical').length,
    seriousCount: violations.filter((v) => v.impact === 'serious').length,
    moderateCount: violations.filter((v) => v.impact === 'moderate').length,
    minorCount: violations.filter((v) => v.impact === 'minor').length,
  };
}

async function runGeometryChecks(p: Page, isMobile: boolean): Promise<GeometryIssue[]> {
  // IMPORTANT: this MUST be an anonymous arrow expression. A named function
  // expression like `function geometryEval(...)` causes tsx/esbuild to inject
  // `__name(geometryEval, "geometryEval")` for stack-trace preservation, and
  // that helper does not exist inside the Playwright browser context — every
  // call would crash with "ReferenceError: __name is not defined". The arrow
  // form sidesteps the helper entirely.
  return p.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (opts: any): GeometryIssue[] => {
      const isMobile = opts.isMobile as boolean;
      const out: GeometryIssue[] = [];
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const minTouch = 44;
      const minFontSize = 12;

      const describe = (el: Element): string => {
        const tag = el.tagName.toLowerCase();
        const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
        const cls =
          typeof (el as HTMLElement).className === 'string'
            ? `.${((el as HTMLElement).className as string)
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .join('.')}`
            : '';
        const testId = el.getAttribute('data-testid');
        return testId ? `[data-testid="${testId}"]` : `${tag}${id}${cls}`;
      };

      // 1. horizontal overflow
      const docEl = document.documentElement;
      if (docEl.scrollWidth > docEl.clientWidth + 1) {
        out.push({
          type: 'horizontal-overflow',
          selector: 'html',
          description: `scrollWidth ${docEl.scrollWidth} > clientWidth ${docEl.clientWidth}`,
        });
      }

      const interactive = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button, a, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });

      // 2. touch target (mobile only)
      if (isMobile) {
        for (const el of interactive) {
          const r = el.getBoundingClientRect();
          if (r.width < minTouch || r.height < minTouch) {
            out.push({
              type: 'touch-target',
              selector: describe(el),
              description: `${Math.round(r.width)}x${Math.round(r.height)} < ${minTouch}x${minTouch}`,
            });
          }
        }
      }

      // 3. offscreen
      for (const el of interactive) {
        const r = el.getBoundingClientRect();
        if (r.right < 0 || r.bottom < 0 || r.left > viewport.width + 10) {
          const style = getComputedStyle(el);
          if (style.visibility !== 'hidden' && style.display !== 'none') {
            out.push({
              type: 'offscreen',
              selector: describe(el),
              description: `fora da viewport: left=${Math.round(r.left)}, top=${Math.round(r.top)}`,
            });
          }
        }
      }

      // 4. overlap entre elementos interativos
      for (let i = 0; i < interactive.length; i++) {
        for (let j = i + 1; j < interactive.length; j++) {
          const a = interactive[i].getBoundingClientRect();
          const b = interactive[j].getBoundingClientRect();
          if (interactive[i].contains(interactive[j]) || interactive[j].contains(interactive[i])) {
            continue;
          }
          const overlap =
            a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          if (overlap) {
            const overlapW = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const overlapH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (overlapW > 4 && overlapH > 4) {
              out.push({
                type: 'overlap',
                selector: `${describe(interactive[i])} <-> ${describe(interactive[j])}`,
                description: `sobreposição de ${Math.round(overlapW)}x${Math.round(overlapH)}px`,
              });
            }
          }
        }
      }

      // 5. sticky cobrindo CTA
      const stickies = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((el) => {
        const s = getComputedStyle(el);
        return s.position === 'sticky' || s.position === 'fixed';
      });
      const ctas = Array.from(
        document.querySelectorAll<HTMLElement>('[data-cta="true"], button[type="submit"], .cta'),
      );
      for (const s of stickies) {
        const sr = s.getBoundingClientRect();
        for (const c of ctas) {
          const cr = c.getBoundingClientRect();
          if (
            sr.top < cr.bottom &&
            sr.bottom > cr.top &&
            sr.left < cr.right &&
            sr.right > cr.left &&
            !s.contains(c)
          ) {
            out.push({
              type: 'sticky-over-cta',
              selector: `${describe(s)} sobre ${describe(c)}`,
              description: 'header/sticky cobrindo CTA',
            });
          }
        }
      }

      // 6. modal overflow
      const modals = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"], .modal, [data-modal="true"]'),
      );
      for (const m of modals) {
        const r = m.getBoundingClientRect();
        if (r.right > viewport.width + 1 || r.bottom > viewport.height + 1) {
          out.push({
            type: 'modal-overflow',
            selector: describe(m),
            description: `modal ${Math.round(r.width)}x${Math.round(r.height)} excede viewport ${viewport.width}x${viewport.height}`,
          });
        }
      }

      // 7. small font
      const texts = Array.from(
        document.querySelectorAll<HTMLElement>('p, span, label, h1, h2, h3, h4, td, th, button, a'),
      );
      for (const t of texts) {
        const s = getComputedStyle(t);
        const fs = parseFloat(s.fontSize);
        if (fs < minFontSize && (t.textContent ?? '').trim().length > 0) {
          out.push({
            type: 'small-font',
            selector: describe(t),
            description: `fontSize=${fs}px < ${minFontSize}px`,
          });
        }
      }

      // 8. clipping
      const clippable = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, button'));
      for (const el of clippable) {
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
          const s = getComputedStyle(el);
          if (s.overflow === 'hidden' && s.textOverflow !== 'ellipsis') {
            out.push({
              type: 'clipping',
              selector: describe(el),
              description: `conteúdo cortado (scroll ${el.scrollWidth}x${el.scrollHeight})`,
            });
          }
        }
      }

      return out;
    },
    { isMobile },
  );
}

function severityWeight(g: GeometryIssue): Severity {
  switch (g.type) {
    case 'overlap':
    case 'offscreen':
    case 'horizontal-overflow':
      return 'critical';
    case 'touch-target':
    case 'sticky-over-cta':
    case 'modal-overflow':
    case 'clipping':
      return 'serious';
    case 'small-font':
    default:
      return 'moderate';
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results: PageResult[] = [];

  for (const page of pages) {
    const context = await browser.newContext({ viewport: page.viewport });
    const p = await context.newPage();
    const issues: string[] = [];
    let axe: AxeSummary | null = null;
    let geometry: GeometryIssue[] = [];

    try {
      const response = await p.goto(`${BASE_URL}${page.path}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // Check HTTP status
      if (!response || response.status() !== 200) {
        issues.push(`HTTP ${response?.status() || 'no response'}`);
      }

      // Check for JS errors
      p.on('pageerror', (err) => issues.push(`JS Error: ${err.message}`));

      // Wait for content
      await p.waitForTimeout(2000);

      // Stabilize (disable animations, wait fonts)
      await stabilize(p);

      // Check page has content (not blank)
      const bodyText = await p.textContent('body');
      if (!bodyText || bodyText.trim().length < 20) {
        issues.push('Página parece vazia ou com pouco conteúdo');
      }

      // Legacy overlap/size checks (preserved)
      const overlaps = await p.evaluate(() => {
        const issues: string[] = [];
        const elements = document.querySelectorAll('input, button, select, a');
        elements.forEach((el) => {
          const rect = (el as HTMLElement).getBoundingClientRect();
          if (rect.width < 15 || rect.height < 15) {
            issues.push(
              `Elemento pequeno demais: ${el.tagName}#${(el as HTMLElement).id || el.className?.toString().slice(0, 30)} (${Math.round(rect.width)}x${Math.round(rect.height)})`,
            );
          }
          if (rect.left < 0 || rect.top < -10) {
            issues.push(
              `Elemento fora da tela: ${el.tagName} (left=${Math.round(rect.left)}, top=${Math.round(rect.top)})`,
            );
          }
        });
        return issues;
      });
      issues.push(...overlaps);

      // Check touch targets on mobile (legacy)
      if (page.device !== 'desktop') {
        const touchIssues = await p.evaluate(() => {
          const issues: string[] = [];
          const interactiveElements = document.querySelectorAll(
            'input, button, select, a, [role="button"]',
          );
          interactiveElements.forEach((el) => {
            const rect = (el as HTMLElement).getBoundingClientRect();
            if (rect.height < 40 && rect.width > 0 && rect.height > 0) {
              issues.push(
                `Touch target pequeno: ${el.tagName} "${(el as HTMLElement).textContent?.slice(0, 20)}" (h=${Math.round(rect.height)}px, min=44px)`,
              );
            }
          });
          return issues;
        });
        issues.push(...touchIssues);
      }

      // Check text readability (contrast / font size — legacy)
      const textIssues = await p.evaluate(() => {
        const issues: string[] = [];
        const texts = document.querySelectorAll('p, span, label, h1, h2, h3, td, th');
        texts.forEach((el) => {
          const style = getComputedStyle(el as HTMLElement);
          const fontSize = parseFloat(style.fontSize);
          if (fontSize < 10 && (el as HTMLElement).textContent?.trim()) {
            issues.push(
              `Texto muito pequeno: "${(el as HTMLElement).textContent?.slice(0, 30)}" (${fontSize}px)`,
            );
          }
        });
        return issues;
      });
      issues.push(...textIssues);

      // Check for broken layout (horizontal scroll — legacy)
      const hasHorizontalScroll = await p.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      if (hasHorizontalScroll) {
        issues.push('Scroll horizontal detectado — layout pode estar quebrado');
      }

      // Advanced geometry checks
      try {
        geometry = await runGeometryChecks(p, page.device !== 'desktop');
        for (const g of geometry) {
          const sev = severityWeight(g);
          issues.push(`[geometry:${g.type}/${sev}] ${g.selector} — ${g.description}`);
        }
      } catch (err) {
        issues.push(`Geometry check falhou: ${(err as Error).message}`);
      }

      // axe-core accessibility scan
      try {
        axe = await runAxeOnPage(p);
        for (const v of axe.violations) {
          issues.push(`[a11y:${v.impact}] ${v.id} (${v.nodes} nós) — ${v.help}`);
        }
      } catch (err) {
        issues.push(`Axe scan falhou: ${(err as Error).message}`);
      }

      // Screenshot
      const screenshotPath = `${SCREENSHOT_DIR}/${page.name}.png`;
      await p.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });

      // Attach per-page JSON reports
      if (axe) {
        writeFileSync(`${SCREENSHOT_DIR}/${page.name}.axe.json`, JSON.stringify(axe, null, 2));
      }
      if (geometry.length > 0) {
        writeFileSync(
          `${SCREENSHOT_DIR}/${page.name}.geometry.json`,
          JSON.stringify(geometry, null, 2),
        );
      }

      results.push({
        name: page.name,
        status: issues.length === 0 ? 'PASS' : 'ISSUES',
        issues,
        axe,
        geometry,
        screenshot: screenshotPath,
      });
    } catch (err) {
      issues.push(`Erro: ${(err as Error).message}`);
      results.push({
        name: page.name,
        status: 'ERROR',
        issues,
        axe,
        geometry,
        screenshot: '',
      });
    }

    await context.close();
  }

  await browser.close();

  // Print report
  console.log('\n══════════════════════════════════════════');
  console.log('  VELYA VISUAL TEST REPORT');
  console.log('══════════════════════════════════════════\n');

  let totalIssues = 0;
  let totalCritical = 0;
  let totalSerious = 0;

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'ISSUES' ? '⚠️' : '❌';
    console.log(`${icon} ${r.name} — ${r.status}`);
    if (r.axe) {
      console.log(
        `   axe: critical=${r.axe.criticalCount} serious=${r.axe.seriousCount} moderate=${r.axe.moderateCount} minor=${r.axe.minorCount}`,
      );
      totalCritical += r.axe.criticalCount;
      totalSerious += r.axe.seriousCount;
    }
    if (r.geometry.length > 0) {
      console.log(`   geometry: ${r.geometry.length} issues`);
    }
    if (r.issues.length > 0) {
      r.issues.forEach((i) => console.log(`   → ${i}`));
      totalIssues += r.issues.length;
    }
    if (r.screenshot) console.log(`   📸 ${r.screenshot}`);
    console.log('');
  }

  // Consolidated report
  writeFileSync(
    `${SCREENSHOT_DIR}/report.json`,
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        timestamp: new Date().toISOString(),
        totals: {
          pages: results.length,
          issues: totalIssues,
          axeCritical: totalCritical,
          axeSerious: totalSerious,
        },
        results,
      },
      null,
      2,
    ),
  );

  console.log('══════════════════════════════════════════');
  console.log(
    `  Total: ${results.length} telas, ${totalIssues} issues, ${totalCritical} critical a11y, ${totalSerious} serious a11y`,
  );
  console.log('══════════════════════════════════════════\n');

  // Exit policy:
  //  - any critical/serious a11y violation fails the run
  //  - any ERROR state fails the run
  //  - otherwise, issues become warning but do not block
  const hasError = results.some((r) => r.status === 'ERROR');
  const blockingA11y = totalCritical + totalSerious > 0;
  const blockingGeometry = results.some((r) =>
    r.geometry.some((g) => severityWeight(g) === 'critical'),
  );

  process.exit(hasError || blockingA11y || blockingGeometry ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
