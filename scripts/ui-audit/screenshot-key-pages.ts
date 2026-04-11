/**
 * screenshot-key-pages.ts — Pixel validation para o velya-web.
 *
 * Captura as páginas principais em desktop (1440x900) e mobile (390x844)
 * para revisão visual. Usado tanto no fluxo manual antes de entregar,
 * quanto no cron autônomo da UI audit.
 *
 * Uso local:
 *   npx tsx scripts/ui-audit/screenshot-key-pages.ts [--url=https://velyahospitalar.com] [--out=./screenshots/]
 *
 * Saída:
 *   Screenshots PNG em {out}/{timestamp}/{page}-{viewport}.png
 *   Metadata JSON em {out}/{timestamp}/manifest.json
 */

import { chromium, type Browser, type Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface CliArgs {
  url: string;
  out: string;
  authenticated: boolean;
  sessionCookie?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const getArg = (key: string, fallback: string): string => {
    const match = args.find((a) => a.startsWith(`--${key}=`));
    return match ? match.split('=').slice(1).join('=') : fallback;
  };
  return {
    url: getArg('url', 'https://velyahospitalar.com'),
    out: getArg('out', join(process.cwd(), 'screenshots')),
    authenticated: args.includes('--authenticated'),
    sessionCookie: process.env.VELYA_SESSION_COOKIE,
  };
}

interface PageSpec {
  path: string;
  name: string;
  requireAuth: boolean;
}

const PAGES: PageSpec[] = [
  { path: '/login', name: 'login', requireAuth: false },
  { path: '/', name: 'home', requireAuth: true },
  { path: '/patients', name: 'patients', requireAuth: true },
  { path: '/tasks', name: 'tasks', requireAuth: true },
  { path: '/discharge', name: 'discharge', requireAuth: true },
  { path: '/beds', name: 'beds', requireAuth: true },
  { path: '/icu', name: 'icu', requireAuth: true },
];

interface ViewportSpec {
  name: string;
  width: number;
  height: number;
}

const VIEWPORTS: ViewportSpec[] = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

async function loginIfNeeded(page: Page, baseUrl: string): Promise<boolean> {
  // Tenta autenticar com credenciais de teste (fixtures do app).
  // O Velya tem um fluxo de login por email+senha, mas as fixtures
  // de dev aceitam qualquer email+senha do domínio velyaplatform.
  const testEmail = process.env.VELYA_TEST_EMAIL || 'admin@velyaplatform.com';
  const testPassword = process.env.VELYA_TEST_PASSWORD || 'admin';

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', testEmail).catch(() => undefined);
  await page.fill('#password', testPassword).catch(() => undefined);
  await page.click('button[type="submit"]').catch(() => undefined);

  // Aguarda redirect pra /
  await page.waitForURL(new RegExp(`${baseUrl.replace(/\//g, '\\/')}/(?!login).*`), {
    timeout: 5000,
  }).catch(() => undefined);

  return page.url().includes('/login') === false;
}

async function shoot(
  browser: Browser,
  baseUrl: string,
  pageSpec: PageSpec,
  viewport: ViewportSpec,
  outDir: string,
  isAuthenticated: boolean,
): Promise<{ file: string; ok: boolean; error?: string }> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 VelyaUiAudit/1.0',
  });
  const page = await context.newPage();

  try {
    if (pageSpec.requireAuth && !isAuthenticated) {
      await loginIfNeeded(page, baseUrl);
    }

    const url = `${baseUrl}${pageSpec.path}`;
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    if (!response) {
      throw new Error('no response');
    }
    if (response.status() >= 400) {
      throw new Error(`HTTP ${response.status()}`);
    }

    // Dá um tempo pra fontes e reidentificações
    await page.waitForTimeout(800);

    const file = join(outDir, `${pageSpec.name}-${viewport.name}.png`);
    await page.screenshot({ path: file, fullPage: true });

    await context.close();
    return { file, ok: true };
  } catch (error) {
    await context.close();
    return {
      file: '',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(args.out, timestamp);
  await mkdir(outDir, { recursive: true });

  console.log(`[screenshot] URL base: ${args.url}`);
  console.log(`[screenshot] Saída: ${outDir}`);

  const browser = await chromium.launch({ headless: true });

  let globallyAuthenticated = false;

  const results: Array<{
    page: string;
    viewport: string;
    file: string;
    ok: boolean;
    error?: string;
  }> = [];

  try {
    // Primeiro login (reutiliza contexto conceitualmente — na verdade
    // cada viewport abre contexto novo, então cada um faz login isolado)
    for (const pageSpec of PAGES) {
      for (const viewport of VIEWPORTS) {
        console.log(`[screenshot] ${pageSpec.name} @ ${viewport.name}…`);
        const result = await shoot(
          browser,
          args.url,
          pageSpec,
          viewport,
          outDir,
          globallyAuthenticated,
        );
        results.push({
          page: pageSpec.name,
          viewport: viewport.name,
          file: result.file,
          ok: result.ok,
          error: result.error,
        });
        if (result.ok) {
          console.log(`  ✓ ${result.file}`);
          globallyAuthenticated = true;
        } else {
          console.log(`  ✗ ${result.error}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  await writeFile(
    join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        timestamp,
        baseUrl: args.url,
        viewports: VIEWPORTS,
        pages: PAGES,
        results,
      },
      null,
      2,
    ),
  );

  const successful = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n[screenshot] ${successful}/${total} screenshots capturados`);
  console.log(`[screenshot] Manifest: ${join(outDir, 'manifest.json')}`);

  if (successful < total) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[screenshot] Fatal:', error);
  process.exit(1);
});
