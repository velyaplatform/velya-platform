# Estratégia de Visual Regression

Este documento define como a Velya executa testes de visual regression (VR)
usando Playwright: escopo, viewports, tratamento de conteúdo dinâmico, política
de thresholds e baselines.

## Objetivo

Detectar mudanças visuais não intencionais em componentes, páginas e fluxos
críticos, mantendo tempo de CI baixo e taxa de flakiness abaixo de 1%.

## Escopo

| Camada      | Cobertura obrigatória                                         |
| ----------- | ------------------------------------------------------------- |
| Componentes | Todo componente em `packages/ui/` e `apps/web/src/components/`|
| Páginas     | Todas as rotas listadas em `responsive-viewport-matrix.md`    |
| Fluxos      | Login, register, verify, admit, prescribe, discharge          |

## Viewports Oficiais

| Nome              | Tamanho   | Device emulado        |
| ----------------- | --------- | --------------------- |
| desktop-lg        | 1440x900  | Chromium headless     |
| desktop-md        | 1280x720  | Chromium headless     |
| tablet-landscape  | 1024x768  | iPad landscape        |
| tablet-portrait   | 768x1024  | iPad portrait         |
| mobile-iphone     | 390x844   | iPhone 14             |
| mobile-android-md | 360x800   | Pixel 5               |
| mobile-android-lg | 412x915   | Pixel 7               |

Viewports são fixados no `playwright.config.ts`. Mudar um viewport requer
regeneração de todas as baselines afetadas.

## Determinismo (Anti-Flake)

Antes de cada screenshot, o helper obrigatório executa:

1. `page.waitForLoadState('networkidle')` com timeout 15s.
2. Espera fontes com `document.fonts.ready`.
3. Injeta CSS para desabilitar animações e transições.
4. Congela o relógio: `page.clock.install({ time: '2026-01-01T12:00:00Z' })`.
5. Mocka rotas não determinísticas (avatars de Gravatar, timestamps ao vivo).
6. Executa `page.evaluate(() => document.documentElement.offsetHeight)` para
   forçar reflow.

Snippet canônico (ver `playwright-visual-testing.md` para versão completa):

```ts
export async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      .skeleton, [data-loading="true"] { animation: none !important; }
    `,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
}
```

## Mask de Conteúdo Dinâmico

Sempre que existir conteúdo que muda entre execuções (timestamps, avatares,
dados ao vivo, IDs gerados), usar `mask` com seletor estável:

```ts
await expect(page).toHaveScreenshot('patients-list.png', {
  mask: [
    page.locator('[data-testid="timestamp"]'),
    page.locator('[data-testid="patient-avatar"]'),
    page.locator('[data-live="true"]'),
  ],
  animations: 'disabled',
  caret: 'hide',
  fullPage: false,
});
```

**Regra:** qualquer componente que exiba dados dinâmicos precisa marcar esses
nós com `data-testid` estável. Conteúdo dinâmico sem `data-testid` é
considerado débito técnico.

## Thresholds por Tipo de Componente

| Tipo                       | `maxDiffPixelRatio` | `maxDiffPixels` |
| -------------------------- | ------------------- | --------------- |
| Hero, imagem de marca      | 0.001 (0.1%)        | 50              |
| Componentes de formulário  | 0.005 (0.5%)        | 100             |
| Cards, listas              | 0.01 (1.0%)         | 200             |
| Tabelas de dados           | 0.02 (2.0%)         | 400             |
| Dashboards com charts      | 0.03 (3.0%)         | 800             |
| Pages complexas full-page  | 0.02 (2.0%)         | 600             |

Thresholds são configurados por arquivo de teste. Nunca global.

## Política de Baseline

1. **Baselines são geradas em CI**, nunca localmente. Isso garante ambiente
   determinístico (mesma fonte, GPU, versão Chromium).
2. Baselines vivem em `tests/visual/__screenshots__/<platform>/<test>/`.
3. Platform suffix: `linux-chromium`. Darwin e Windows não geram baselines.
4. Atualização de baseline só acontece em PR dedicado. Ver
   `baseline-update-policy.md`.
5. Toda atualização de baseline requer revisão visual humana obrigatória no PR.

## Geração Inicial em CI

Comando executado por workflow `ui-quality-baseline.yaml` quando disparado
manualmente:

```bash
npx playwright test --config=playwright.visual.config.ts --update-snapshots
```

O workflow faz commit das baselines em branch separada `baseline-update/<sha>`
e abre PR automático. O PR é revisado e mergeado manualmente.

## Organização dos Arquivos

```
tests/visual/
  components/
    button.spec.ts
    card.spec.ts
    patient-card.spec.ts
  pages/
    login.spec.ts
    patients-list.spec.ts
    patient-detail.spec.ts
  flows/
    login-flow.spec.ts
    admit-patient-flow.spec.ts
  fixtures/
    stabilize.ts
    masks.ts
    deterministic-data.ts
  __screenshots__/
    linux-chromium/
      components/
        button.spec.ts/
          default.png
          hover.png
          disabled.png
```

## Tags de Teste

Cada teste declara tags para execução seletiva:

```ts
test('patient card default', { tag: ['@visual', '@component', '@stable'] }, async ({ page }) => {
  // ...
});
```

| Tag          | Significado                                          |
| ------------ | ---------------------------------------------------- |
| `@visual`    | Teste de visual regression                           |
| `@component` | Escopo de componente isolado                         |
| `@page`      | Escopo de página completa                            |
| `@flow`      | Teste de fluxo multi-step                            |
| `@a11y`      | Executa axe-core                                     |
| `@stable`    | Seguro para gate bloqueante                          |
| `@flaky`     | Em observação, não bloqueia                          |
| `@mobile`    | Executa apenas em viewports mobile                   |
| `@desktop`   | Executa apenas em viewports desktop                  |

## Execução em CI

O job `visual-and-accessibility` (ver `github-actions-ui-quality-pipeline.md`)
roda testes tagueados `@visual` e `@stable` em cada PR. Testes `@flaky` rodam
em modo informativo. Testes `@flow` rodam também no noturno.

## Métricas Rastreadas

- Pass rate por camada (componente, página, fluxo)
- Tempo médio por suite
- Taxa de flakiness (retry rate)
- Tamanho médio do diff em pixels
- Número de baselines atualizadas por semana

Ver `ui-quality-scorecards.md`.

## Não Fazer

- Não rodar VR em modo headful no CI.
- Não usar screenshots com viewport diferente entre runs.
- Não comitar baselines geradas localmente.
- Não usar `fullPage: true` em páginas com scroll infinito.
- Não mascarar o componente inteiro para "passar o teste" — use seletores
  precisos.
- Não desabilitar um teste flaky sem abrir issue de investigação.
