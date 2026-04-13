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

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type ContextOptions = NonNullable<Parameters<Browser['newContext']>[0]>;
type ContextStorageState = ContextOptions['storageState'];

interface CliArgs {
  url: string;
  out: string;
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

const ONBOARDING_STORAGE_KEY = 'velya:onboarding-completed-v1';

async function createContext(
  browser: Browser,
  viewport: ViewportSpec,
  storageState?: ContextStorageState,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 VelyaUiAudit/1.0',
    ...(storageState ? { storageState } : {}),
  });
  await context.addInitScript((storageKey: string) => {
    try {
      window.localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // ignore localStorage restrictions in locked-down environments
    }
  }, ONBOARDING_STORAGE_KEY);
  return context;
}

async function authenticateContext(context: BrowserContext, baseUrl: string): Promise<boolean> {
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  const email = `ui-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@velya.local`;
  const password = process.env.VELYA_TEST_PASSWORD || 'PixelCheck2026!';

  const loggedIn = await page.evaluate(
    async (creds: { email: string; password: string }) => {
      const registerResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: creds.email,
          password: creds.password,
          nome: 'UI Audit Bot',
          role: 'Administrador',
          setor: 'TI',
        }),
      });
      if (!registerResponse.ok) return false;

      const registerData = (await registerResponse.json()) as { devCode?: string };
      if (registerData.devCode) {
        const verifyResponse = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: creds.email, code: registerData.devCode }),
        });
        if (!verifyResponse.ok) return false;
      }

      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: creds.email, password: creds.password }),
      });
      if (!loginResponse.ok) return false;

      const loginData = (await loginResponse.json()) as { success?: boolean };
      return loginData.success === true;
    },
    { email, password },
  );

  if (!loggedIn) {
    await page.close();
    return false;
  }

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_000);
  const authenticated = new URL(page.url()).pathname !== '/login';
  await page.close();
  return authenticated;
}

async function shoot(
  context: BrowserContext,
  baseUrl: string,
  pageSpec: PageSpec,
  viewport: ViewportSpec,
  outDir: string,
): Promise<{ file: string; ok: boolean; error?: string }> {
  const page = await context.newPage();

  try {
    const url = `${baseUrl}${pageSpec.path}`;
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    if (!response) {
      throw new Error('no response');
    }
    if (response.status() >= 400) {
      throw new Error(`HTTP ${response.status()}`);
    }

    const pathname = new URL(page.url()).pathname;
    if (pageSpec.requireAuth && pathname === '/login') {
      throw new Error('redirected to login');
    }

    if (pageSpec.name === 'home' && viewport.name === 'desktop') {
      await page.waitForSelector('#sidebar-suggestion', { timeout: 5_000 });
    }

    // Dá um tempo pra fontes, hidratação e requests em background.
    await page.waitForTimeout(1_200);

    const file = join(outDir, `${pageSpec.name}-${viewport.name}.png`);
    await page.screenshot({ path: file, fullPage: true });

    await page.close();
    return { file, ok: true };
  } catch (error) {
    await page.close();
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
  const bootstrapContext = await createContext(browser, VIEWPORTS[0]);
  const authenticated = await authenticateContext(bootstrapContext, args.url);
  const authenticatedState = authenticated ? await bootstrapContext.storageState() : undefined;
  await bootstrapContext.close();

  const results: Array<{
    page: string;
    viewport: string;
    file: string;
    ok: boolean;
    error?: string;
  }> = [];

  try {
    for (const viewport of VIEWPORTS) {
      const publicContext = await createContext(browser, viewport);
      const authenticatedContext = authenticatedState
        ? await createContext(browser, viewport, authenticatedState)
        : await createContext(browser, viewport);

      try {
        for (const pageSpec of PAGES) {
          console.log(`[screenshot] ${pageSpec.name} @ ${viewport.name}…`);
          const result =
            pageSpec.requireAuth && !authenticated
              ? { file: '', ok: false, error: 'authentication failed' }
              : await shoot(
                  pageSpec.requireAuth ? authenticatedContext : publicContext,
                  args.url,
                  pageSpec,
                  viewport,
                  outDir,
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
          } else {
            console.log(`  ✗ ${result.error}`);
          }
        }
      } finally {
        await publicContext.close();
        await authenticatedContext.close();
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
