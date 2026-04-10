# Anti-Flake — Hardening de Testes Visuais

Flaky tests são o principal inimigo de uma esteira de visual regression. Um
teste que falha aleatoriamente perde credibilidade, é silenciado, e a
regressão real passa despercebida.

Este documento lista todas as técnicas que a Velya exige para eliminar flake
em testes Playwright visuais.

## Meta

Taxa de flakiness alvo: **< 1%**.

A taxa é calculada como:

```
flaky_rate = (runs_retry_succeeded / total_runs) * 100
```

Playwright reporta retries automaticamente. Qualquer teste que precisa de
retry por 3 dias consecutivos é taguado `@flaky` e entra em investigação.

## Causas Comuns de Flake

| Causa                        | Solução                                  |
| ---------------------------- | ---------------------------------------- |
| Animações e transições       | CSS override em `stabilize()`            |
| Fontes carregando depois     | `document.fonts.ready`                   |
| Network racing               | `waitForLoadState('networkidle')`        |
| Timestamps dinâmicos         | `page.clock.install()` + mask            |
| Avatars/imagens remotos      | `page.route` mock                        |
| Dados aleatórios             | Mock determinístico                      |
| Caret piscando               | `caret: 'hide'` + CSS `caret-color: transparent` |
| Scroll position diferente    | `page.evaluate(() => window.scrollTo(0,0))` |
| Hover state residual         | `page.mouse.move(0, 0)`                  |
| Render assíncrono após ready | `requestAnimationFrame` duplo            |
| Imagens ainda decodificando  | Esperar `img.decode()`                   |
| Tooltips e popovers          | `page.keyboard.press('Escape')`          |
| Focus state residual         | `page.evaluate(() => (document.activeElement as HTMLElement)?.blur())` |
| `::before`/`::after` com anim | CSS override cobre também pseudo-elementos |
| Cookie/consent banners       | Mockar ou fechar antes do screenshot     |

## Checklist Obrigatório Antes de Screenshot

Todo teste visual DEVE executar, nesta ordem, antes de `toHaveScreenshot()`:

```ts
await page.goto(url, { waitUntil: 'domcontentloaded' });
await mockDeterministicData(page);     // mock de APIs
await stabilize(page);                  // helper anti-flake
await page.mouse.move(0, 0);            // limpa hover
await page.evaluate(() => {             // limpa focus
  (document.activeElement as HTMLElement)?.blur();
});
await page.evaluate(() => window.scrollTo(0, 0));
// agora é seguro capturar
```

## Freeze de Relógio

Uso obrigatório para qualquer teste que renderiza timestamps, relative time
(`"há 5 minutos"`), countdowns ou expirações.

```ts
await page.clock.install({
  time: new Date('2026-01-01T12:00:00.000Z'),
});
```

Combinar com `timezoneId` em `use.timezoneId = 'America/Sao_Paulo'` no config.

## Determinismo de Dados

Nenhum teste visual deve bater em API real. Todos usam mocks estáticos:

```ts
await page.route('**/api/**', async (route) => {
  const url = route.request().url();
  // roteamento determinístico por path
  if (url.includes('/patients')) {
    return route.fulfill({ body: JSON.stringify(PATIENTS_FIXTURE) });
  }
  return route.continue();
});
```

## Retry Strategy

Playwright config:

```ts
retries: CI ? 1 : 0,
```

Somente **1 retry** em CI. Retry maior mascara flakiness. Se um teste passa
apenas no segundo retry, ele é candidato a investigação.

## Timeouts Explícitos

- Nunca usar `waitForTimeout(N)` com N > 500ms.
- Sempre usar `waitForSelector`, `waitForURL`, `waitForLoadState`.
- `expect.poll` com timeout explícito para condições customizadas.

## Pseudo-Elementos e SVG

Pseudo-elementos `::before` e `::after` precisam do mesmo CSS override de
animação:

```css
*, *::before, *::after {
  animation-duration: 0s !important;
  transition-duration: 0s !important;
}
```

SVGs com `<animate>` ou `<animateTransform>` precisam ser mascarados ou
removidos antes do screenshot:

```ts
await page.evaluate(() => {
  document.querySelectorAll('svg animate, svg animateTransform').forEach((n) => n.remove());
});
```

## Viewport Exato

Nunca mudar viewport após `goto`. Sempre setar antes, ou criar context novo:

```ts
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
```

`deviceScaleFactor: 1` é obrigatório — retina altera pixels.

## Isolamento de Estado

Cada teste roda em context novo (Playwright já faz por padrão). Não
compartilhar storage/cookies entre testes.

```ts
test.use({ storageState: undefined });
```

## Deduplicação de Flake

Se um teste aparece flaky:

1. Marcar com `test.info().annotations.push({ type: 'flaky', description })`.
2. Abrir issue com reprodução.
3. Mover para tag `@flaky` (não-bloqueante).
4. Investigar em no máximo 7 dias.
5. Sem correção em 14 dias → desabilitar e registrar débito.

## Ferramentas de Debug

```bash
# Rodar com trace
npx playwright test --trace on

# Ver trace do run específico
npx playwright show-trace test-results/.../trace.zip

# Rodar em headful
npx playwright test --headed --project=desktop-lg

# Debug mode
PWDEBUG=1 npx playwright test <file>
```

## Não Fazer

- Não usar `waitForTimeout(5000)` como "solução".
- Não aumentar `maxDiffPixelRatio` para mascarar flake.
- Não rodar VR contra backend real.
- Não confiar que "passou 3 vezes seguidas" significa não-flaky — rodar em CI
  matriz por 1 semana.
- Não aumentar `retries` para 3+.
- Não comentar teste flaky em vez de investigar.
