# Pipeline de Acessibilidade com axe-core

Este documento descreve como a Velya integra `@axe-core/playwright` para
validar acessibilidade automaticamente em componentes, páginas e fluxos, e
como interpretamos os resultados.

## Contexto

O motor axe-core captura automaticamente ~57% dos problemas de acessibilidade
mensuráveis por máquina (estudo Deque). Isso significa que ele é excelente
para:

- Contraste de cor (matematicamente calculável)
- Presença de labels e ARIA
- Landmarks e headings
- Atributos obrigatórios (alt, for, lang)
- Ordem de tabulação lógica em casos simples

E NÃO detecta:

- UX real com leitor de tela
- Ordem de leitura semântica
- Usabilidade de navegação por teclado
- Clareza cognitiva ou legibilidade do texto
- Adequação contextual de labels

Por isso, axe-core é **gate automático**, mas **nunca substitui** revisão
manual com leitor de tela antes de release em produção.

## Baseline WCAG 2.2

A Velya adota WCAG 2.2 nível AA como baseline obrigatório. A esteira configura
o axe-core para rodar as seguintes tags:

```ts
const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
];
```

## Instalação

Já declarado em `devDependencies`:

```bash
npm install -D @axe-core/playwright
```

## Integração com Playwright

`tests/visual/fixtures/accessibility.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { writeFileSync } from 'fs';
import { join } from 'path';

export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

export interface AxeResult {
  url: string;
  violations: Array<{
    id: string;
    impact: Severity;
    description: string;
    help: string;
    helpUrl: string;
    nodes: number;
  }>;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
}

const EXCLUDED_RULES = [
  // Exceções legítimas documentadas
  'color-contrast-enhanced', // só enforce AAA em componentes específicos
];

const EXCLUDED_SELECTORS = [
  '[data-axe-skip="true"]',        // componentes 3rd party encapsulados
  '.recharts-surface',             // SVG de chart — avaliado separadamente
];

export async function runAxe(
  page: Page,
  testInfo: TestInfo,
  options: { name: string; tags?: string[] } = { name: 'axe' },
): Promise<AxeResult> {
  const builder = new AxeBuilder({ page })
    .withTags(options.tags ?? [
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
      'wcag22aa',
      'best-practice',
    ])
    .disableRules(EXCLUDED_RULES);

  for (const sel of EXCLUDED_SELECTORS) {
    builder.exclude(sel);
  }

  const results = await builder.analyze();

  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: (v.impact ?? 'minor') as Severity,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
  }));

  const summary: AxeResult = {
    url: page.url(),
    violations,
    criticalCount: violations.filter((v) => v.impact === 'critical').length,
    seriousCount: violations.filter((v) => v.impact === 'serious').length,
    moderateCount: violations.filter((v) => v.impact === 'moderate').length,
    minorCount: violations.filter((v) => v.impact === 'minor').length,
  };

  // Attach to test report
  await testInfo.attach(`axe-${options.name}.json`, {
    body: JSON.stringify(summary, null, 2),
    contentType: 'application/json',
  });

  return summary;
}

export function assertNoBlocking(result: AxeResult) {
  if (result.criticalCount > 0 || result.seriousCount > 0) {
    const lines = result.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .map((v) => `  [${v.impact}] ${v.id} (${v.nodes} nós): ${v.help}\n    ${v.helpUrl}`);
    throw new Error(
      `Violações de acessibilidade bloqueantes em ${result.url}:\n${lines.join('\n')}`,
    );
  }
}
```

## Classificação de Severidade

| Severidade | Ação                                         | Exemplo típico                       |
| ---------- | -------------------------------------------- | ------------------------------------ |
| `critical` | Bloqueia merge. Patch em 24h.                | Botão sem label acessível            |
| `serious`  | Bloqueia merge. Patch em 48h.                | Contraste abaixo de 4.5:1            |
| `moderate` | Não bloqueia. Rastreia no scorecard.         | Heading fora de ordem                |
| `minor`    | Informativo.                                 | `role=button` em `<button>` (redundância) |

## Exemplo de Teste

```ts
import { test, expect } from '@playwright/test';
import { stabilize } from '../fixtures/stabilize';
import { runAxe, assertNoBlocking } from '../fixtures/accessibility';

test(
  'login page passes axe WCAG 2.2 AA',
  { tag: ['@a11y', '@page', '@stable'] },
  async ({ page }, testInfo) => {
    await page.goto('/login');
    await stabilize(page);

    const result = await runAxe(page, testInfo, { name: 'login' });
    assertNoBlocking(result);

    expect(result.moderateCount).toBeLessThan(5);
  },
);
```

## Testes em Fluxos

Rodar axe em cada estado de um fluxo, não só na página inicial:

```ts
test(
  'register flow remains accessible across steps',
  { tag: ['@a11y', '@flow', '@stable'] },
  async ({ page }, testInfo) => {
    await page.goto('/register');
    await stabilize(page);
    assertNoBlocking(await runAxe(page, testInfo, { name: 'register-step-1' }));

    await page.fill('[name="email"]', 'test@velya.test');
    await page.fill('[name="password"]', 'Teste1234!');
    await page.click('[type="submit"]');
    await page.waitForURL('**/verify*');
    await stabilize(page);
    assertNoBlocking(await runAxe(page, testInfo, { name: 'register-step-2' }));
  },
);
```

## Exclusões Legítimas

Toda exclusão de regra ou seletor precisa estar documentada em
`docs/ui-quality/exclusions.md` com:

1. Regra ou seletor excluído
2. Motivo
3. Issue/ADR referenciando decisão
4. Data prevista de reavaliação

Exclusões sem documentação são consideradas débito técnico e rastreadas no
scorecard.

## Relatórios e Artefatos

Cada run do axe anexa um JSON estruturado ao relatório Playwright. O workflow
`ui-quality.yaml` sobe esses JSONs como artifact com retenção de 14 dias.

Uma etapa adicional pode consolidar todos os JSONs em um único relatório:

```bash
node scripts/consolidate-axe-report.js test-results/ > axe-report.json
```

O relatório consolidado alimenta o scorecard de acessibilidade.

## Execução Local

```bash
# Só testes de a11y
npx playwright test --config=playwright.visual.config.ts --grep @a11y

# A11y de uma página específica
npx playwright test tests/visual/pages/login.spec.ts --grep @a11y
```

## Revisão Manual Complementar

Axe-core cobre ~57%. Os outros 43% exigem revisão humana obrigatória antes de
qualquer release em produção:

1. Navegação completa só com teclado (Tab, Shift-Tab, Enter, Escape).
2. Teste com leitor de tela (NVDA, VoiceOver, TalkBack).
3. Zoom 200% e 400% — conteúdo não deve cortar.
4. Reflow em viewport 320px.
5. Contraste em estados hover/focus/active.
6. Ordem de leitura em layouts complexos.

## Não Fazer

- Não desabilitar uma regra para "passar o teste". Corrija o problema.
- Não mascarar elementos quebrados — arrume ou adicione exclusão documentada.
- Não pular axe em fluxos só porque a página inicial passou.
- Não confiar que CI verde significa acessível. Humano ainda precisa revisar.
