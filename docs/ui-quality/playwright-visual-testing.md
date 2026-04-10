# Playwright Visual Testing — Configuração Detalhada

Este documento é o manual operacional para executar visual regression com
Playwright na Velya: configuração do `playwright.config.ts`, projetos por
viewport, máscaras, helpers anti-flake e execução em Docker para CI.

## Instalação

```bash
# Já declarado em devDependencies
npm install -D @playwright/test @axe-core/playwright

# Instalar browsers
npx playwright install --with-deps chromium
```

## Configuração Principal

`playwright.visual.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;
const BASE_URL = process.env.TEST_URL || 'http://localhost:3333';

export default defineConfig({
  testDir: './tests/visual',
  outputDir: './test-results/visual',
  snapshotDir: './tests/visual/__screenshots__',
  snapshotPathTemplate:
    '{snapshotDir}/{platform}-{projectName}/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 4 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/visual', open: 'never' }],
    ['json', { outputFile: 'playwright-report/visual/results.json' }],
  ],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'device',
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    colorScheme: 'light',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'desktop-lg',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'desktop-md',
      use: { viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'tablet-portrait',
      use: { ...devices['iPad (gen 7)'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'tablet-landscape',
      use: { ...devices['iPad (gen 7) landscape'] },
    },
    {
      name: 'mobile-iphone',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'mobile-android-md',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-android-lg',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: CI
    ? undefined
    : {
        command: 'npm run build --workspace=apps/web && cd apps/web && PORT=3333 node .next/standalone/apps/web/server.js',
        url: 'http://localhost:3333',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
```

## Helper Anti-Flake

`tests/visual/fixtures/stabilize.ts`:

```ts
import type { Page } from '@playwright/test';

const DETERMINISTIC_TIME = '2026-01-01T12:00:00.000Z';

export async function stabilize(page: Page) {
  // 1. Freeze clock
  await page.clock.install({ time: new Date(DETERMINISTIC_TIME) });

  // 2. Wait for network
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');

  // 3. Disable animations and caret
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
        caret-color: transparent !important;
      }
      input, textarea { caret-color: transparent !important; }
      .skeleton, [data-loading="true"], [aria-busy="true"] {
        animation: none !important;
      }
      video { visibility: hidden !important; }
    `,
  });

  // 4. Wait fonts
  await page.evaluate(async () => {
    await (document as any).fonts.ready;
  });

  // 5. Wait next paint
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );

  // 6. Wait images decoded
  await page.evaluate(async () => {
    const imgs = Array.from(document.images).filter((img) => !img.complete);
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
      ),
    );
  });
}
```

## Máscaras de Conteúdo Dinâmico

`tests/visual/fixtures/masks.ts`:

```ts
import type { Page, Locator } from '@playwright/test';

export function dynamicMasks(page: Page): Locator[] {
  return [
    page.locator('[data-testid="timestamp"]'),
    page.locator('[data-testid="relative-time"]'),
    page.locator('[data-testid="patient-avatar"]'),
    page.locator('[data-testid="user-avatar"]'),
    page.locator('[data-live="true"]'),
    page.locator('[data-random]'),
    page.locator('[data-session-id]'),
    page.locator('time[datetime]'),
    page.locator('.chart-live-value'),
  ];
}
```

## Dados Determinísticos

`tests/visual/fixtures/deterministic-data.ts`:

```ts
import type { Page } from '@playwright/test';

export async function mockDeterministicData(page: Page) {
  await page.route('**/api/patients*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'pat-001', name: 'Maria Silva', mrn: '10001', admittedAt: '2026-01-01T12:00:00Z' },
        { id: 'pat-002', name: 'João Santos', mrn: '10002', admittedAt: '2026-01-01T12:00:00Z' },
      ]),
    }),
  );

  await page.route('**/avatars/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#ccc"/></svg>',
    }),
  );
}
```

## Exemplo de Teste de Página

```ts
import { test, expect } from '@playwright/test';
import { stabilize } from '../fixtures/stabilize';
import { dynamicMasks } from '../fixtures/masks';
import { mockDeterministicData } from '../fixtures/deterministic-data';

test.describe('Patient List', () => {
  test.beforeEach(async ({ page }) => {
    await mockDeterministicData(page);
  });

  test(
    'list renders default state',
    { tag: ['@visual', '@page', '@stable'] },
    async ({ page }) => {
      await page.goto('/patients');
      await stabilize(page);

      await expect(page).toHaveScreenshot('patients-list-default.png', {
        fullPage: true,
        mask: dynamicMasks(page),
        maxDiffPixelRatio: 0.02,
      });
    },
  );
});
```

## Docker para CI

Quando executando em CI ou localmente para reproduzir baselines, usar a imagem
oficial pinada por digest:

```dockerfile
# tests/visual/Dockerfile
FROM mcr.microsoft.com/playwright:v1.59.1-jammy@sha256:<digest>

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
CMD ["npx", "playwright", "test", "--config=playwright.visual.config.ts"]
```

Executar:

```bash
docker build -t velya-visual -f tests/visual/Dockerfile .
docker run --rm -v $PWD/test-results:/app/test-results velya-visual
```

## Comandos Úteis

```bash
# Rodar toda a suite visual
npx playwright test --config=playwright.visual.config.ts

# Rodar um projeto específico
npx playwright test --config=playwright.visual.config.ts --project=mobile-iphone

# Só testes bloqueantes
npx playwright test --config=playwright.visual.config.ts --grep @stable

# Atualizar baselines (PR dedicado)
npx playwright test --config=playwright.visual.config.ts --update-snapshots

# Ver relatório HTML
npx playwright show-report playwright-report/visual
```

## Não Fazer

- Não usar `page.waitForTimeout` arbitrário. Sempre usar `stabilize()`.
- Não capturar screenshots antes do `stabilize()`.
- Não rodar VR contra ambiente compartilhado com dados reais.
- Não comitar snapshots gerados fora do Docker oficial.
- Não passar `threshold` (deprecated). Usar `maxDiffPixelRatio`.
