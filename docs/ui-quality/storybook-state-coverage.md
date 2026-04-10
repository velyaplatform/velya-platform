# Cobertura de Estados por Storybook

Este documento define a cobertura obrigatória de estados que todo componente
visual da Velya deve ter no Storybook e como esses estados são validados
automaticamente.

## Por que Storybook

1. Permite renderizar cada estado de forma isolada, determinística e rápida.
2. É a superfície ideal para visual regression em componentes — sem efeitos
   colaterais de rotas, dados de backend ou estado global.
3. Serve como documentação viva do design system.
4. Funciona como catálogo de "como o componente deve se comportar" — é a fonte
   de verdade para QA e designers.

## Estados Obrigatórios

Todo componente visual deve ter ao menos as seguintes stories. A ausência de
qualquer uma delas é bloqueada em CI pelo script
`scripts/check-story-coverage.ts`.

| Story                  | Quando aplicar                                                  |
| ---------------------- | --------------------------------------------------------------- |
| `Default`              | Sempre                                                          |
| `Loading`              | Qualquer componente que tem estado de carregamento              |
| `Empty`                | Listas, tabelas, cards de coleção                               |
| `Error`                | Qualquer componente que pode falhar (form, fetch-bound, etc.)   |
| `Disabled`             | Inputs, buttons, selects, toggles                               |
| `LongContent`          | Componentes que recebem texto (title, description, children)    |
| `WithIcon`             | Componentes que suportam ícone opcional                         |
| `WithoutIcon`          | Idem — prova que o fallback funciona                            |
| `ValidationError`      | Inputs, forms                                                   |
| `PermissionDenied`     | Componentes que renderizam ação restrita                        |
| `MobileCompact`        | Qualquer componente — viewport 360x640                          |
| `Dark`                 | Sempre                                                          |
| `Light`                | Sempre                                                          |
| `RTL`                  | Opcional por ora, obrigatório quando Velya suportar RTL         |

## Exemplo Canônico

```tsx
// packages/ui/src/button/button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { PlusIcon } from '../icons';

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    a11y: { disable: false },
  },
  tags: ['autodocs', 'visual-required'],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: 'Confirmar' },
};

export const Loading: Story = {
  args: { children: 'Salvando...', loading: true },
};

export const Disabled: Story = {
  args: { children: 'Indisponível', disabled: true },
};

export const Error: Story = {
  args: { children: 'Falha ao salvar', variant: 'error' },
};

export const LongContent: Story = {
  args: {
    children:
      'Um texto muito longo que testa como o botão se comporta com conteúdo que extrapola o tamanho usual',
  },
};

export const WithIcon: Story = {
  args: { children: 'Adicionar paciente', icon: <PlusIcon /> },
};

export const WithoutIcon: Story = {
  args: { children: 'Adicionar paciente' },
};

export const PermissionDenied: Story = {
  args: { children: 'Prescrever', disabled: true, tooltip: 'Sem permissão' },
};

export const MobileCompact: Story = {
  args: { children: 'Salvar' },
  parameters: {
    viewport: { defaultViewport: 'mobile-compact' },
  },
};

export const Dark: Story = {
  args: { children: 'Confirmar' },
  parameters: { backgrounds: { default: 'dark' } },
};

export const Light: Story = {
  args: { children: 'Confirmar' },
  parameters: { backgrounds: { default: 'light' } },
};
```

## Validação Automática

### 1. Script de Cobertura

`scripts/check-story-coverage.ts` percorre todos os arquivos `*.stories.tsx`
e valida que cada componente tagueado com `visual-required` tem todas as
stories obrigatórias. Falha o build se alguma estiver faltando.

```ts
const REQUIRED_STORIES = [
  'Default',
  'Loading',
  'Empty',
  'Error',
  'Disabled',
  'LongContent',
  'WithIcon',
  'WithoutIcon',
  'ValidationError',
  'PermissionDenied',
  'MobileCompact',
  'Dark',
  'Light',
];
```

Componentes que legitimamente não precisam de uma story podem marcar a
exceção:

```tsx
parameters: {
  velya: { skipStories: ['Loading', 'Empty'], reason: 'componente estático sem fetch' },
},
```

O script exige que `reason` seja preenchida e válida.

### 2. Testes Visuais em Storybook

Cada story é capturada por `@storybook/test-runner` ou Playwright + Storybook
URL. Exemplo:

```ts
// tests/visual/components/button.spec.ts
import { test, expect } from '@playwright/test';
import { stabilize } from '../fixtures/stabilize';

const stories = [
  'primitives-button--default',
  'primitives-button--loading',
  'primitives-button--disabled',
  'primitives-button--error',
  'primitives-button--long-content',
  'primitives-button--with-icon',
  'primitives-button--without-icon',
  'primitives-button--permission-denied',
  'primitives-button--mobile-compact',
  'primitives-button--dark',
  'primitives-button--light',
];

for (const story of stories) {
  test(`button ${story}`, { tag: ['@visual', '@component', '@stable'] }, async ({ page }) => {
    await page.goto(`/iframe.html?id=${story}&viewMode=story`);
    await stabilize(page);
    await expect(page.locator('#storybook-root')).toHaveScreenshot(`${story}.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.005,
    });
  });
}
```

### 3. A11y por Story

Cada story executa axe-core via `@storybook/addon-a11y` no Storybook, e
novamente em CI via `@axe-core/playwright` apontando para o Storybook servido
localmente. Violações `critical` e `serious` quebram o build.

## Fluxo de Criação de Novo Componente

1. Criar arquivo `component.tsx` e `component.stories.tsx`.
2. Tagear a story com `visual-required`.
3. Implementar as stories obrigatórias.
4. Rodar `npm run check:story-coverage` local.
5. Abrir PR — CI gera baselines iniciais via workflow dedicado.
6. Revisão visual humana aprova baselines.
7. Merge.

## Execução Local

```bash
# Storybook dev
npm run storybook

# Cobertura de stories
npm run check:story-coverage

# Testes visuais contra Storybook
npm run test:visual:components

# A11y contra Storybook
npm run test:a11y:stories
```

## Não Fazer

- Não criar stories que dependem de rede ou API real.
- Não usar dados aleatórios em stories — sempre dados determinísticos.
- Não pular estados obrigatórios sem `velya.skipStories` justificado.
- Não usar `Math.random`, `Date.now()`, `new Date()` em stories.
- Não escrever testes visuais contra componentes sem story — stories vêm
  primeiro.
