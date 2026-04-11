/**
 * Audita contraste em TODAS as páginas após login.
 * Detecta:
 * - Texto claro em fundo claro (contraste < 4.5:1)
 * - Texto escuro em fundo escuro
 * - Emojis/ícones com fundo similar
 * Roda axe-core completo + análise customizada de pixels.
 */
import { chromium, type Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, existsSync, writeFileSync } from 'fs';

const BASE = process.env.TEST_URL || 'https://velyahospitalar.com';
const OUT = '/tmp/velya-contrast-audit';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

interface ContrastIssue {
  page: string;
  selector: string;
  text: string;
  fg: string;
  bg: string;
  ratio: number;
  fontSize: number;
  category: 'text' | 'button' | 'link' | 'icon';
}

const PAGES = [
  '/',
  '/patients',
  '/patients/MRN-004',
  '/patients/MRN-001',
  '/patients/new',
  '/tasks',
  '/discharge',
  '/system',
  '/activity',
  '/audit',
  '/suggestions',
  '/beds',
  '/surgery',
  '/ems',
  '/icu',
  '/pharmacy',
];

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', 'lucaslima4132@gmail.com');
  await page.fill('input[type=password]', '4132');
  await page.click('button[type=submit]');
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(1500);
}

// See scripts/visual-test.ts for the full explanation. tsx/esbuild wraps
// named arrows with `__name(fn, "name")` and that helper does not exist in
// the Playwright browser context. We install a no-op shim via a string
// payload (strings are not parsed by esbuild) before running the evaluate.
const __NAME_POLYFILL =
  '(function(){if(typeof globalThis.__name!=="function"){globalThis.__name=function(f){return f;};}})()';

async function findContrastIssues(p: Page, pageName: string): Promise<ContrastIssue[]> {
  await p.evaluate(__NAME_POLYFILL);
  return p.evaluate((pageName: string): ContrastIssue[] => {
    // Inner helpers MUST be const arrows (not function declarations) for the
    // same tsx/__name reason — see runGeometryChecks in scripts/visual-test.ts.
    const parseRgb = (s: string): [number, number, number, number] | null => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
      return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts[3] === undefined ? 1 : parts[3]];
    };
    const relLum = (r: number, g: number, b: number): number => {
      const a = [r, g, b].map((c) => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    };
    const ratio = (rgb1: [number, number, number], rgb2: [number, number, number]): number => {
      const l1 = relLum(rgb1[0], rgb1[1], rgb1[2]);
      const l2 = relLum(rgb2[0], rgb2[1], rgb2[2]);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    };
    const getEffectiveBg = (el: Element): [number, number, number] => {
      let cur: Element | null = el;
      while (cur && cur !== document.body) {
        const cs = getComputedStyle(cur as HTMLElement);
        const bg = parseRgb(cs.backgroundColor);
        if (bg && bg[3] > 0.1 && (bg[0] + bg[1] + bg[2] > 0 || bg[3] > 0.5)) {
          return [bg[0], bg[1], bg[2]];
        }
        cur = cur.parentElement;
      }
      const bodyBg = parseRgb(getComputedStyle(document.body).backgroundColor);
      return bodyBg ? [bodyBg[0], bodyBg[1], bodyBg[2]] : [255, 255, 255];
    };
    const describe = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      const id = (el as HTMLElement).id ? '#' + (el as HTMLElement).id : '';
      const cn = (el as HTMLElement).className;
      const cls = typeof cn === 'string' && cn ? '.' + cn.split(/\s+/).slice(0, 2).join('.') : '';
      return tag + id + cls;
    };

    const out: ContrastIssue[] = [];
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(
        'p, span, label, a, button, td, th, h1, h2, h3, h4, h5, h6, li, div',
      ),
    );

    for (const el of els) {
      const text = (el.textContent || '').trim();
      if (!text || text.length < 2) continue;
      // Skip elements that contain only child elements with their own text
      const directText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => (n.textContent || '').trim())
        .join('');
      if (!directText) continue;

      const r = el.getBoundingClientRect();
      if (r.width < 5 || r.height < 5) continue;

      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;

      const fg = parseRgb(cs.color);
      if (!fg || fg[3] < 0.5) continue;

      const bg = getEffectiveBg(el);
      const cr = ratio([fg[0], fg[1], fg[2]], bg);
      const fontSize = parseFloat(cs.fontSize) || 16;
      const isBold = parseInt(cs.fontWeight, 10) >= 700;
      const isLarge = fontSize >= 24 || (fontSize >= 18.66 && isBold);
      const minRatio = isLarge ? 3 : 4.5;

      if (cr < minRatio) {
        let category: ContrastIssue['category'] = 'text';
        if (el.tagName === 'BUTTON') category = 'button';
        else if (el.tagName === 'A') category = 'link';
        else if (/[\p{Emoji}]/u.test(directText)) category = 'icon';

        out.push({
          page: pageName,
          selector: describe(el),
          text: directText.slice(0, 60),
          fg: 'rgb(' + fg[0] + ',' + fg[1] + ',' + fg[2] + ')',
          bg: 'rgb(' + bg[0] + ',' + bg[1] + ',' + bg[2] + ')',
          ratio: Math.round(cr * 100) / 100,
          fontSize: Math.round(fontSize),
          category,
        });
      }
    }
    return out;
  }, pageName);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  console.log('=== Login ===');
  await login(p);
  console.log('Logged in:', p.url());

  const allIssues: ContrastIssue[] = [];
  const axeViolations: { page: string; id: string; impact: string; nodes: number }[] = [];

  for (const path of PAGES) {
    console.log('\\n=== Auditando ' + path + ' ===');
    try {
      await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 15000 });
      await p.waitForTimeout(1500);
      await p.screenshot({
        path: OUT + '/' + path.replace(/[/\\[\\]]/g, '_') + '.png',
        fullPage: true,
      });

      // axe
      const axe = await new AxeBuilder({ page: p }).withTags(['wcag2aa', 'wcag22aa']).analyze();
      for (const v of axe.violations) {
        if (v.impact === 'critical' || v.impact === 'serious') {
          axeViolations.push({
            page: path,
            id: v.id,
            impact: v.impact || 'unknown',
            nodes: v.nodes.length,
          });
          console.log('  axe[' + v.impact + ']: ' + v.id + ' (' + v.nodes.length + ' nós)');
          if (v.id === 'color-contrast') {
            // Capture detailed failure data per node
            for (const node of v.nodes.slice(0, 8)) {
              const target = Array.isArray(node.target)
                ? node.target.join(' ')
                : String(node.target);
              const summary = node.failureSummary || '';
              console.log('     · ' + target);
              console.log('       ' + summary.replace(/\n/g, ' | ').slice(0, 220));
            }
          }
        }
      }

      // custom contrast
      const issues = await findContrastIssues(p, path);
      allIssues.push(...issues);
      console.log('  contrast: ' + issues.length + ' problemas');

      // Show top 5
      issues
        .sort((a, b) => a.ratio - b.ratio)
        .slice(0, 5)
        .forEach((i) => {
          console.log('    [' + i.ratio + ':1] ' + i.category + ' "' + i.text.slice(0, 40) + '"');
          console.log('       fg=' + i.fg + ' bg=' + i.bg + ' size=' + i.fontSize + 'px');
        });
    } catch (err) {
      console.log('  ERRO: ' + (err as Error).message);
    }
  }

  await browser.close();

  // Save full report
  writeFileSync(
    OUT + '/report.json',
    JSON.stringify(
      {
        total: allIssues.length,
        axe: axeViolations,
        contrast: allIssues,
      },
      null,
      2,
    ),
  );

  console.log('\\n══════════════════════════════════════════');
  console.log(
    '  TOTAL: ' +
      allIssues.length +
      ' contrastes ruins, ' +
      axeViolations.length +
      ' axe critical/serious',
  );
  console.log('══════════════════════════════════════════');

  // Group by page
  const byPage: Record<string, number> = {};
  for (const i of allIssues) byPage[i.page] = (byPage[i.page] || 0) + 1;
  console.log('\\nPor página:');
  for (const [page, count] of Object.entries(byPage).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + count + '\\t' + page);
  }

  // Hard gate: total color-contrast nodes must be <= VELYA_MAX_CONTRAST_NODES
  const maxAllowed = parseInt(process.env.VELYA_MAX_CONTRAST_NODES || '999999', 10);
  const totalContrastNodes = axeViolations
    .filter((v) => v.id === 'color-contrast')
    .reduce((sum, v) => sum + v.nodes, 0);
  if (totalContrastNodes > maxAllowed) {
    console.error(
      '\\n❌ COMPLIANCE FAIL: ' +
        totalContrastNodes +
        ' color-contrast nodes excedem o teto VELYA_MAX_CONTRAST_NODES=' +
        maxAllowed,
    );
    process.exitCode = 2;
  } else {
    console.log(
      '\\n✅ COMPLIANCE OK: ' + totalContrastNodes + '/' + maxAllowed + ' color-contrast nodes',
    );
  }
}

run().catch(console.error);
