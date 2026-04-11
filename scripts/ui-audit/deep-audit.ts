/**
 * deep-audit.ts — Engine de auditoria visual profunda do velya-web.
 *
 * Diferente dos scripts antigos (screenshot-key-pages / detect-issues), este engine
 * usa Playwright para medir PIXELS E CSS REAL renderizado, não faz pattern matching
 * em HTML. Caminha por todos os `page.tsx` e roda uma bateria de checks WCAG,
 * acessibilidade, overlap, console, network e imagens quebradas.
 *
 * Checks implementados:
 *   a) Full-page screenshot desktop 1440x900 + mobile 390x844
 *   b) Contraste WCAG AA de TODO elemento com texto
 *   c) Accessible name em controles interativos
 *   d) Overlap > 50% entre controles interativos
 *   e) Console errors/warnings
 *   f) Network responses >= 400
 *   g) Imagens com naturalWidth === 0
 *
 * Uso:
 *   npx tsx scripts/ui-audit/deep-audit.ts [--help]
 *
 * Env vars:
 *   VELYA_AUDIT_URL        (default https://velyahospitalar.com)
 *   VELYA_AUDIT_COOKIE     (default o cookie do Auditoria Visual Bot)
 *   VELYA_AUDIT_OUT        (default /tmp/velya-audit)
 *   VELYA_AUDIT_ROUTES     (lista CSV — substitui enumeração)
 *   VELYA_AUDIT_VIEWPORTS  (default "desktop,mobile")
 *   VELYA_AUDIT_SKIP_SHOTS (true para desligar screenshots)
 *
 * Exit codes: 0 limpo, 1 findings, 2 erro fatal.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'low';
type ViewportName = 'desktop' | 'mobile';

interface ViewportSpec {
  name: ViewportName;
  width: number;
  height: number;
}

interface RouteSpec {
  path: string;
  requireAuth: boolean;
  slug: string;
}

interface Finding {
  severity: Severity;
  rule: string;
  route: string;
  viewport: ViewportName;
  selector?: string;
  description: string;
  evidence?: Record<string, unknown>;
  suggestedFix?: string;
}

interface AuditReport {
  timestamp: string;
  baseUrl: string;
  routesAudited: number;
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  byRoute: Record<string, { findings: number; screenshots: Record<string, string> }>;
  findings: Finding[];
}

interface TextElementSnapshot {
  tag: string;
  selector: string;
  text: string;
  fgColor: string;
  bgColor: string;
  fontSize: number;
  fontWeight: number;
  boundingBox: { x: number; y: number; w: number; h: number };
}

interface InteractiveSnapshot {
  tag: string;
  selector: string;
  hasAccessibleName: boolean;
  tabindex: number | null;
  isOrphanInput: boolean;
  visible: boolean;
  isInNav: boolean;
  isFixed: boolean;
  boundingBox: { x: number; y: number; w: number; h: number };
}

interface ImageSnapshot {
  src: string;
  selector: string;
  naturalWidth: number;
  naturalHeight: number;
}

interface PageSnapshot {
  textElements: TextElementSnapshot[];
  interactives: InteractiveSnapshot[];
  images: ImageSnapshot[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VIEWPORTS: Record<ViewportName, ViewportSpec> = {
  desktop: { name: 'desktop', width: 1440, height: 900 },
  mobile: { name: 'mobile', width: 390, height: 844 },
};

const PUBLIC_ROUTES = new Set(['/login', '/register', '/verify']);
const DEFAULT_PATIENT_MRN = 'MRN-001';
const DEFAULT_COOKIE =
  '3b273d357cc633f665c3c6bd7cadec3f578be9da61deca8f2ef03fb63b378c92';

// ─────────────────────────────────────────────────────────────────────────────
// Route enumeration — walks apps/web/src/app/**/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

async function enumerateRoutes(appDir: string): Promise<RouteSpec[]> {
  const pageFiles: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'api' || entry.name.startsWith('_')) continue;
        await walk(full);
      } else if (entry.isFile() && entry.name === 'page.tsx') {
        pageFiles.push(full);
      }
    }
  }

  await walk(appDir);

  const routes: RouteSpec[] = [];
  for (const file of pageFiles) {
    const rel = relative(appDir, dirname(file));
    const segments = rel === '' ? [] : rel.split('/');

    // Skip routes that need 2+ params we don't have fixtures for
    const dynamicSegments = segments.filter((s) => s.startsWith('[') && s.endsWith(']'));
    if (dynamicSegments.length >= 2) continue;

    // Resolve dynamic segments using known fixtures
    const resolved: string[] = [];
    let skip = false;
    for (const seg of segments) {
      if (seg.startsWith('[') && seg.endsWith(']')) {
        const paramName = seg.slice(1, -1);
        // Only resolve [id] for patient-like routes
        if (paramName === 'id' && segments[0] === 'patients') {
          resolved.push(DEFAULT_PATIENT_MRN);
        } else {
          // Unknown param: skip
          skip = true;
          break;
        }
      } else {
        resolved.push(seg);
      }
    }
    if (skip) continue;

    const path = '/' + resolved.join('/');
    const cleanPath = path === '/' ? '/' : path.replace(/\/$/, '');
    routes.push({
      path: cleanPath,
      requireAuth: !PUBLIC_ROUTES.has(cleanPath),
      slug: cleanPath === '/' ? 'root' : cleanPath.replace(/^\//, '').replace(/\//g, '_'),
    });
  }

  // Deduplicate + sort for deterministic order
  const seen = new Set<string>();
  return routes
    .filter((r) => {
      if (seen.has(r.path)) return false;
      seen.add(r.path);
      return true;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

// ─────────────────────────────────────────────────────────────────────────────
// WCAG contrast math (sRGB → relative luminance → ratio)
// ─────────────────────────────────────────────────────────────────────────────

function parseCssColor(color: string): [number, number, number, number] | null {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(',').map((p) => parseFloat(p.trim()));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [r, g, b, a = 1] = parts;
  return [r, g, b, a];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg: string, bg: string): number | null {
  const f = parseCssColor(fg);
  const b = parseCssColor(bg);
  if (!f || !b) return null;
  // If fg has alpha < 1, composite over bg
  const fgR = f[3] < 1 ? f[0] * f[3] + b[0] * (1 - f[3]) : f[0];
  const fgG = f[3] < 1 ? f[1] * f[3] + b[1] * (1 - f[3]) : f[1];
  const fgB = f[3] < 1 ? f[2] * f[3] + b[2] * (1 - f[3]) : f[2];
  const l1 = relativeLuminance(fgR, fgG, fgB);
  const l2 = relativeLuminance(b[0], b[1], b[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function isLargeText(fontSizePx: number, fontWeight: number): boolean {
  // WCAG: large = 18pt (24px) regular, or 14pt (18.66px) bold (>=700)
  if (fontWeight >= 700 && fontSizePx >= 18.66) return true;
  if (fontSizePx >= 24) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-page evaluator — runs all DOM queries in one evaluate() block
// ─────────────────────────────────────────────────────────────────────────────

// NOTE: this runs inside the browser, not Node. It is injected as a STRING
// to avoid tsx/esbuild helper injection (like `__name`) that blows up when
// tsx-transformed closures leak into page.evaluate().
const SNAPSHOT_FN_SOURCE = `
  (function () {
    var stableSelector = function (el) {
      if (el.id) return '#' + el.id;
      var tag = el.tagName.toLowerCase();
      var cls = (el.getAttribute('class') || '').split(/\\s+/).filter(Boolean).slice(0, 2).join('.');
      var text = (el.textContent || '').trim().slice(0, 20).replace(/\\s+/g, ' ');
      var sel = cls ? tag + '.' + cls : tag;
      if (text) sel += '[text="' + text + '"]';
      return sel;
    };
    var isVisible = function (el) {
      var style = window.getComputedStyle(el);
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden') return false;
      if (parseFloat(style.opacity || '1') === 0) return false;
      var rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      return true;
    };
    var resolveBgColor = function (el) {
      var cur = el;
      while (cur) {
        var style = window.getComputedStyle(cur);
        var bg = style.backgroundColor;
        if (bg && bg.indexOf('rgba(0, 0, 0, 0)') === -1 && bg !== 'transparent') return bg;
        // Handle gradients (background-image linear/radial): return a best-guess
        // stop color to avoid false white-on-white contrast failures.
        var bgImage = style.backgroundImage || '';
        if (bgImage && bgImage.indexOf('gradient') !== -1) {
          var m = bgImage.match(/rgb\([^)]+\)|#[0-9a-fA-F]{3,8}/);
          if (m) return m[0];
          // Use a neutral mid-tone when we can't parse the stop
          return 'rgb(96, 165, 250)';
        }
        cur = cur.parentElement;
      }
      return 'rgb(255, 255, 255)';
    };

    var textElements = [];
    var all = Array.prototype.slice.call(document.querySelectorAll('body *'));
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var directText = '';
      var kids = el.childNodes;
      for (var k = 0; k < kids.length; k++) {
        if (kids[k].nodeType === 3) directText += kids[k].textContent || '';
      }
      directText = directText.trim();
      if (!directText) continue;
      if (!isVisible(el)) continue;
      var style = window.getComputedStyle(el);
      var rect = el.getBoundingClientRect();
      textElements.push({
        tag: el.tagName.toLowerCase(),
        selector: stableSelector(el),
        text: directText.slice(0, 80),
        fgColor: style.color,
        bgColor: resolveBgColor(el),
        fontSize: parseFloat(style.fontSize) || 16,
        fontWeight: parseFloat(style.fontWeight) || 400,
        boundingBox: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
      });
    }

    var interactives = [];
    var controls = document.querySelectorAll('button, a, input, select, textarea, [role="button"]');
    for (var j = 0; j < controls.length; j++) {
      var c = controls[j];
      var visible = isVisible(c);
      var rect2 = c.getBoundingClientRect();
      var tag = c.tagName.toLowerCase();
      var ariaLabel = c.getAttribute('aria-label');
      var ariaLabelledBy = c.getAttribute('aria-labelledby');
      var visibleText = (c.textContent || '').trim();
      var inputType = c.type;
      var isFormControl = tag === 'input' || tag === 'textarea' || tag === 'select';
      var isTextualInput =
        isFormControl &&
        (tag !== 'input' || ['hidden', 'submit', 'button', 'reset'].indexOf(inputType) === -1);
      var placeholder = c.placeholder || '';
      var title = c.getAttribute('title') || '';

      // Check <label for="..."> or wrapping <label>
      var id = c.getAttribute('id');
      var labelFor = id ? document.querySelector('label[for="' + id + '"]') : null;
      var wrappingLabel = c.closest ? c.closest('label') : null;
      var hasAssociatedLabel = !!labelFor || !!wrappingLabel;

      var hasAccessibleName =
        !!(ariaLabel && ariaLabel.trim()) ||
        !!(ariaLabelledBy && ariaLabelledBy.trim()) ||
        !!visibleText ||
        hasAssociatedLabel;
      // Any textual form control with a placeholder is considered named
      // (WCAG allows placeholder as last resort).
      if (!hasAccessibleName && isTextualInput && placeholder) hasAccessibleName = true;
      // A title attribute also provides an accessible name (ARIA standard).
      if (!hasAccessibleName && title) hasAccessibleName = true;

      var isOrphanInput = false;
      if (isTextualInput && !hasAccessibleName) {
        isOrphanInput = true;
      }
      var tabindexAttr = c.getAttribute('tabindex');
      var tabindex = tabindexAttr !== null ? parseInt(tabindexAttr, 10) : null;

      // Categorize ancestor for overlap filtering
      var isInNav = !!(c.closest && (c.closest('nav') || c.closest('aside') || c.closest('header') || c.closest('[role="navigation"]')));
      var isFixed = false;
      try {
        var cs = window.getComputedStyle(c);
        isFixed = cs.position === 'fixed' || cs.position === 'sticky';
        if (!isFixed) {
          var p = c.parentElement;
          while (p && p !== document.body) {
            var pcs = window.getComputedStyle(p);
            if (pcs.position === 'fixed' || pcs.position === 'sticky') { isFixed = true; break; }
            p = p.parentElement;
          }
        }
      } catch (_e) {}

      interactives.push({
        tag: tag,
        selector: stableSelector(c),
        hasAccessibleName: hasAccessibleName,
        tabindex: tabindex,
        isOrphanInput: isOrphanInput,
        visible: visible,
        isInNav: isInNav,
        isFixed: isFixed,
        boundingBox: { x: rect2.x, y: rect2.y, w: rect2.width, h: rect2.height }
      });
    }

    var images = [];
    var imgs = document.querySelectorAll('img');
    for (var m = 0; m < imgs.length; m++) {
      var img = imgs[m];
      images.push({
        src: img.src || '',
        selector: stableSelector(img),
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      });
    }

    return { textElements: textElements, interactives: interactives, images: images };
  })()
`;

async function capturePageSnapshot(page: Page): Promise<PageSnapshot> {
  // Pass the string directly — Playwright evaluates it as an expression in
  // the page context, bypassing any Node-side transforms.
  const result = (await page.evaluate(SNAPSHOT_FN_SOURCE)) as PageSnapshot;
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Finding generators
// ─────────────────────────────────────────────────────────────────────────────

function analyzeContrast(
  snapshot: PageSnapshot,
  route: string,
  viewport: ViewportName,
): Finding[] {
  const findings: Finding[] = [];
  for (const el of snapshot.textElements) {
    const ratio = contrastRatio(el.fgColor, el.bgColor);
    if (ratio === null) continue;
    const large = isLargeText(el.fontSize, el.fontWeight);
    const threshold = large ? 3 : 4.5;
    if (ratio < threshold) {
      findings.push({
        severity: ratio < 2 ? 'high' : 'medium',
        rule: 'contrast-fail',
        route,
        viewport,
        selector: el.selector,
        description: `Texto "${el.text}" tem contraste ${ratio.toFixed(2)} (mínimo WCAG AA: ${threshold})`,
        evidence: {
          fgColor: el.fgColor,
          bgColor: el.bgColor,
          ratio: Number(ratio.toFixed(2)),
          fontSize: el.fontSize,
          fontWeight: el.fontWeight,
          large,
        },
        suggestedFix: large
          ? 'Aumentar contraste para >= 3:1 (texto grande).'
          : 'Aumentar contraste para >= 4.5:1 ou aumentar tamanho da fonte para 24px+.',
      });
    }
  }
  return findings;
}

function analyzeInteractives(
  snapshot: PageSnapshot,
  route: string,
  viewport: ViewportName,
): Finding[] {
  const findings: Finding[] = [];
  for (const el of snapshot.interactives) {
    if (!el.visible) continue;
    if (!el.hasAccessibleName) {
      findings.push({
        severity: 'high',
        rule: 'missing-accessible-name',
        route,
        viewport,
        selector: el.selector,
        description: `${el.tag} sem aria-label, aria-labelledby ou texto visível.`,
        suggestedFix: 'Adicionar aria-label descritivo ou texto filho.',
      });
    }
    if (el.tabindex !== null && el.tabindex < 0) {
      findings.push({
        severity: 'medium',
        rule: 'non-focusable-interactive',
        route,
        viewport,
        selector: el.selector,
        description: `${el.tag} interativo tem tabindex=${el.tabindex}.`,
        suggestedFix: 'Remover tabindex negativo ou converter em elemento não-interativo.',
      });
    }
    if (el.isOrphanInput) {
      findings.push({
        severity: 'high',
        rule: 'orphan-input',
        route,
        viewport,
        selector: el.selector,
        description: 'Input sem <label> associado nem aria-label.',
        suggestedFix: 'Adicionar <label for="..."> ou aria-label.',
      });
    }
  }
  return findings;
}

function analyzeOverlap(
  snapshot: PageSnapshot,
  route: string,
  viewport: ViewportName,
): Finding[] {
  const findings: Finding[] = [];
  const visible = snapshot.interactives.filter(
    (e) => e.visible && e.boundingBox.w > 0 && e.boundingBox.h > 0,
  );
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const ei = visible[i];
      const ej = visible[j];

      // Skip cross-container overlaps: nav vs main, fixed vs static.
      // These are layout illusions (e.g. fixed sidebar "over" scrolling
      // content) not real UX bugs. We only flag same-context overlaps.
      if (ei.isInNav !== ej.isInNav) continue;
      if (ei.isFixed !== ej.isFixed) continue;

      const a = ei.boundingBox;
      const b = ej.boundingBox;
      const xOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const yOverlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      const overlapArea = xOverlap * yOverlap;
      if (overlapArea === 0) continue;
      const areaA = a.w * a.h;
      const areaB = b.w * b.h;
      const minArea = Math.min(areaA, areaB);
      if (minArea === 0) continue;
      const ratio = overlapArea / minArea;
      if (ratio > 0.5) {
        // Skip nested (a contains b or vice versa is normal, e.g. button inside a)
        const nested =
          (a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h) ||
          (b.x <= a.x && b.y <= a.y && b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h);
        if (nested) continue;
        findings.push({
          severity: 'medium',
          rule: 'overlapping-controls',
          route,
          viewport,
          selector: `${ei.selector} & ${ej.selector}`,
          description: `Dois controles interativos sobrepostos em ${(ratio * 100).toFixed(0)}%.`,
          evidence: { a: ei.selector, b: ej.selector, overlapRatio: ratio },
          suggestedFix: 'Reposicionar ou ajustar z-index para evitar sobreposição.',
        });
      }
    }
  }
  return findings;
}

function analyzeImages(
  snapshot: PageSnapshot,
  route: string,
  viewport: ViewportName,
): Finding[] {
  const findings: Finding[] = [];
  for (const img of snapshot.images) {
    if (img.src && img.naturalWidth === 0) {
      findings.push({
        severity: 'high',
        rule: 'broken-image',
        route,
        viewport,
        selector: img.selector,
        description: `Imagem não carregou: ${img.src}`,
        evidence: { src: img.src },
        suggestedFix: 'Verificar URL, CORS e status HTTP do recurso.',
      });
    }
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-route audit pipeline
// ─────────────────────────────────────────────────────────────────────────────

interface RouteAuditResult {
  findings: Finding[];
  screenshots: Record<string, string>;
}

async function auditRoute(
  context: BrowserContext,
  baseUrl: string,
  route: RouteSpec,
  viewport: ViewportSpec,
  outDir: string,
  skipShots: boolean,
): Promise<RouteAuditResult> {
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });

  const consoleFindings: Finding[] = [];
  const networkFindings: Finding[] = [];

  page.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    consoleFindings.push({
      severity: type === 'error' ? 'medium' : 'low',
      rule: `console-${type}`,
      route: route.path,
      viewport: viewport.name,
      description: msg.text().slice(0, 300),
      evidence: { location: msg.location() },
    });
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) {
      networkFindings.push({
        severity: status >= 500 ? 'high' : 'high',
        rule: 'network-error',
        route: route.path,
        viewport: viewport.name,
        description: `HTTP ${status} ${response.url()}`,
        evidence: { status, url: response.url() },
      });
    }
  });

  const findings: Finding[] = [];
  const screenshots: Record<string, string> = {};
  const url = `${baseUrl}${route.path}`;
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    if (!response) {
      findings.push({
        severity: 'critical',
        rule: 'no-response',
        route: route.path,
        viewport: viewport.name,
        description: `Sem resposta para ${url}`,
      });
    } else if (response.status() >= 400) {
      findings.push({
        severity: 'critical',
        rule: 'page-http-error',
        route: route.path,
        viewport: viewport.name,
        description: `Página retornou HTTP ${response.status()}`,
        evidence: { status: response.status() },
      });
    }

    // Let fonts/images settle
    await page.waitForTimeout(600);

    if (!skipShots) {
      const file = join(outDir, `${route.slug}-${viewport.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      screenshots[viewport.name] = file;
    }

    const snapshot = await capturePageSnapshot(page);
    findings.push(...analyzeContrast(snapshot, route.path, viewport.name));
    findings.push(...analyzeInteractives(snapshot, route.path, viewport.name));
    findings.push(...analyzeOverlap(snapshot, route.path, viewport.name));
    findings.push(...analyzeImages(snapshot, route.path, viewport.name));
  } catch (error) {
    findings.push({
      severity: 'high',
      rule: 'audit-error',
      route: route.path,
      viewport: viewport.name,
      description: error instanceof Error ? error.message : String(error),
    });
  } finally {
    findings.push(...consoleFindings);
    findings.push(...networkFindings);
    await page.close();
  }

  return { findings, screenshots };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function printHelp(): void {
  process.stdout.write(`deep-audit — Velya UI deep audit engine

Usage:
  npx tsx scripts/ui-audit/deep-audit.ts [--help]

Env vars:
  VELYA_AUDIT_URL        Base URL (default https://velyahospitalar.com)
  VELYA_AUDIT_COOKIE     velya_session cookie value (default Auditoria Visual Bot)
  VELYA_AUDIT_OUT        Output root dir (default /tmp/velya-audit)
  VELYA_AUDIT_ROUTES     Comma-separated route paths (overrides enumeration)
  VELYA_AUDIT_VIEWPORTS  Subset of desktop,mobile (default both)
  VELYA_AUDIT_SKIP_SHOTS Set "true" to skip screenshots

Exit: 0 clean, 1 findings, 2 fatal.
`);
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  const baseUrl = (process.env.VELYA_AUDIT_URL || 'https://velyahospitalar.com').replace(
    /\/$/,
    '',
  );
  const sessionCookie = process.env.VELYA_AUDIT_COOKIE || DEFAULT_COOKIE;
  const outRoot = process.env.VELYA_AUDIT_OUT || '/tmp/velya-audit';
  const skipShots = process.env.VELYA_AUDIT_SKIP_SHOTS === 'true';
  const viewportsEnv = (process.env.VELYA_AUDIT_VIEWPORTS || 'desktop,mobile')
    .split(',')
    .map((v) => v.trim())
    .filter((v): v is ViewportName => v === 'desktop' || v === 'mobile');
  const viewports = viewportsEnv.map((v) => VIEWPORTS[v]);

  // Locate app dir relative to this file
  const thisFile = fileURLToPath(import.meta.url);
  const repoRoot = join(dirname(thisFile), '..', '..');
  const appDir = join(repoRoot, 'apps', 'web', 'src', 'app');

  let routes: RouteSpec[];
  if (process.env.VELYA_AUDIT_ROUTES) {
    routes = process.env.VELYA_AUDIT_ROUTES.split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((path) => ({
        path,
        requireAuth: !PUBLIC_ROUTES.has(path),
        slug: path === '/' ? 'root' : path.replace(/^\//, '').replace(/\W+/g, '_'),
      }));
  } else {
    routes = await enumerateRoutes(appDir);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(outRoot, 'deep-audit', timestamp);
  await mkdir(outDir, { recursive: true });

  process.stdout.write(`[deep-audit] baseUrl=${baseUrl}\n`);
  process.stdout.write(`[deep-audit] routes=${routes.length}\n`);
  process.stdout.write(`[deep-audit] viewports=${viewports.map((v) => v.name).join(',')}\n`);
  process.stdout.write(`[deep-audit] out=${outDir}\n`);

  const browser: Browser = await chromium.launch({ headless: true });
  const cookieDomain = new URL(baseUrl).hostname;

  const authContext = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 VelyaDeepAudit/1.0',
  });
  await authContext.addCookies([
    {
      name: 'velya_session',
      value: sessionCookie,
      domain: cookieDomain,
      path: '/',
      httpOnly: true,
      secure: baseUrl.startsWith('https'),
      sameSite: 'Lax',
    },
  ]);

  const publicContext = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 VelyaDeepAudit/1.0',
  });

  const report: AuditReport = {
    timestamp,
    baseUrl,
    routesAudited: 0,
    totalFindings: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    byRoute: {},
    findings: [],
  };

  try {
    for (const route of routes) {
      const ctx = route.requireAuth ? authContext : publicContext;
      const routeShots: Record<string, string> = {};
      let routeFindingCount = 0;
      for (const viewport of viewports) {
        process.stdout.write(`[deep-audit] ${route.path} @ ${viewport.name}\n`);
        const result = await auditRoute(ctx, baseUrl, route, viewport, outDir, skipShots);
        for (const f of result.findings) {
          report.findings.push(f);
          report.bySeverity[f.severity]++;
          routeFindingCount++;
        }
        Object.assign(routeShots, result.screenshots);
      }
      report.byRoute[route.path] = { findings: routeFindingCount, screenshots: routeShots };
      report.routesAudited++;
    }
  } finally {
    await authContext.close();
    await publicContext.close();
    await browser.close();
  }

  report.totalFindings = report.findings.length;

  // Write JSON
  const jsonPath = join(outDir, 'report.json');
  await writeFile(jsonPath, JSON.stringify(report, null, 2));

  // Write Markdown
  const mdLines: string[] = [];
  mdLines.push(`# Velya Deep UI Audit — ${timestamp}`);
  mdLines.push('');
  mdLines.push(`- baseUrl: ${baseUrl}`);
  mdLines.push(`- routes audited: ${report.routesAudited}`);
  mdLines.push(`- total findings: ${report.totalFindings}`);
  mdLines.push(
    `- by severity: critical=${report.bySeverity.critical} high=${report.bySeverity.high} medium=${report.bySeverity.medium} low=${report.bySeverity.low}`,
  );
  mdLines.push('');
  mdLines.push('## Findings por rota');
  for (const [path, info] of Object.entries(report.byRoute)) {
    mdLines.push(`- \`${path}\` — ${info.findings} findings`);
  }
  mdLines.push('');
  mdLines.push('## Top findings (severidade)');
  const sorted = [...report.findings].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });
  for (const f of sorted.slice(0, 30)) {
    mdLines.push(
      `- [${f.severity}] [${f.rule}] ${f.route} (${f.viewport}) — ${f.description}`,
    );
  }
  await writeFile(join(outDir, 'report.md'), mdLines.join('\n'));

  process.stdout.write(`[deep-audit] report.json: ${jsonPath}\n`);
  process.stdout.write(
    `[deep-audit] findings: ${report.totalFindings} (critical=${report.bySeverity.critical} high=${report.bySeverity.high} medium=${report.bySeverity.medium} low=${report.bySeverity.low})\n`,
  );

  if (report.totalFindings > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`[deep-audit] FATAL: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(2);
});
