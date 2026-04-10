# Matriz de Viewports Responsivos

Este documento define a matriz oficial de viewports onde a Velya executa
validação visual, qual cobertura cada viewport recebe e quais breakpoints
devem ser validados.

## Princípio

Responsividade não é "funciona em 1440 e parece OK no iPhone". Responsividade
é "todos os breakpoints do design system são testados em todas as camadas
críticas".

## Viewports Oficiais

| Nome                | Resolução | Device emulado        | Target principal         |
| ------------------- | --------- | --------------------- | ------------------------ |
| `desktop-lg`        | 1440x900  | Chromium              | Monitor padrão hospitalar |
| `desktop-md`        | 1280x720  | Chromium              | Laptops, monitores HD    |
| `tablet-landscape`  | 1024x768  | iPad                  | Tablets em estações móveis |
| `tablet-portrait`   | 768x1024  | iPad                  | Tablets portable         |
| `mobile-iphone`     | 390x844   | iPhone 14             | iOS pessoal              |
| `mobile-android-md` | 360x800   | Pixel 5               | Android médio            |
| `mobile-android-lg` | 412x915   | Pixel 7               | Android grande           |

## Breakpoints do Design System

O Tailwind config da Velya define os seguintes breakpoints. Cada um deve ter
pelo menos um viewport da matriz cobrindo-o.

```ts
// apps/web/tailwind.config.ts (extraído)
screens: {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1440px',
}
```

| Breakpoint | Viewport da matriz que cobre |
| ---------- | ---------------------------- |
| `< sm`     | `mobile-android-md` (360)    |
| `sm`       | `mobile-iphone` (390), `mobile-android-lg` (412) |
| `md`       | `tablet-portrait` (768)      |
| `lg`       | `tablet-landscape` (1024)    |
| `xl`       | `desktop-md` (1280)          |
| `2xl`      | `desktop-lg` (1440)          |

## Cobertura por Viewport

| Viewport             | Screenshots | Geometry | A11y | Lighthouse |
| -------------------- | ----------- | -------- | ---- | ---------- |
| `desktop-lg`         | ✔           | ✔        | ✔    | ✔          |
| `desktop-md`         | ✔           | ✔        |      |            |
| `tablet-landscape`   | ✔           | ✔        |      |            |
| `tablet-portrait`    | ✔           | ✔        | ✔    |            |
| `mobile-iphone`      | ✔           | ✔        | ✔    | ✔          |
| `mobile-android-md`  | ✔           | ✔        |      |            |
| `mobile-android-lg`  | ✔           | ✔        |      |            |

Lighthouse não roda em todos os viewports para manter CI rápido — rodamos em
`desktop-lg` (modo desktop) e `mobile-iphone` (modo mobile).

## Rotas Críticas Cobertas

Toda rota listada abaixo recebe cobertura COMPLETA na matriz (todos os
viewports aplicáveis):

| Rota                     | Motivo                              |
| ------------------------ | ----------------------------------- |
| `/`                      | Landing                             |
| `/login`                 | Autenticação                        |
| `/register`              | Onboarding                          |
| `/verify`                | Verificação de código               |
| `/dashboard`             | Home pós-login                      |
| `/patients`              | Lista de pacientes                  |
| `/patients/[id]`         | Detalhe do paciente                 |
| `/icu`                   | Dashboard UTI                       |
| `/ems`                   | Dashboard EMS                       |
| `/pharmacy`              | Dashboard farmácia                  |
| `/admit`                 | Fluxo de admissão                   |
| `/discharge`             | Fluxo de alta                       |
| `/prescribe`             | Fluxo de prescrição                 |

## Breakpoints Validados Explicitamente

Cada rota crítica deve ter ao menos um teste que valida:

1. Nenhum scroll horizontal em nenhum viewport.
2. Nenhum elemento interativo fora da viewport.
3. Nenhum touch target abaixo de 44x44px em viewports mobile.
4. Nenhum modal/drawer ultrapassando a viewport.
5. Nenhum header fixo cobrindo CTA principal.

## Exemplo de Teste Multi-Viewport

```ts
import { test } from '@playwright/test';
import { stabilize } from '../fixtures/stabilize';
import { runGeometryChecks, assertNoBlocking } from '../fixtures/geometry';

const VIEWPORTS = [
  { name: 'desktop-lg', width: 1440, height: 900, device: 'desktop' },
  { name: 'desktop-md', width: 1280, height: 720, device: 'desktop' },
  { name: 'tablet-landscape', width: 1024, height: 768, device: 'tablet' },
  { name: 'tablet-portrait', width: 768, height: 1024, device: 'tablet' },
  { name: 'mobile-iphone', width: 390, height: 844, device: 'mobile' },
  { name: 'mobile-android-md', width: 360, height: 800, device: 'mobile' },
  { name: 'mobile-android-lg', width: 412, height: 915, device: 'mobile' },
];

for (const vp of VIEWPORTS) {
  test(
    `patients list geometry @ ${vp.name}`,
    { tag: ['@geometry', '@page', '@responsive'] },
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/patients');
      await stabilize(page);

      const issues = await runGeometryChecks(page, testInfo, { device: vp.device });
      assertNoBlocking(issues);
    },
  );
}
```

## Orientação do Device

Para tablets e mobile, a Velya testa ambas as orientações quando o design
system suporta. Rotação via `page.setViewportSize`.

## Gates por Viewport

| Viewport             | PR gate    | main gate  |
| -------------------- | ---------- | ---------- |
| `desktop-lg`         | bloqueante | bloqueante |
| `desktop-md`         | bloqueante | bloqueante |
| `tablet-landscape`   | alerta     | bloqueante |
| `tablet-portrait`    | alerta     | bloqueante |
| `mobile-iphone`      | bloqueante | bloqueante |
| `mobile-android-md`  | bloqueante | bloqueante |
| `mobile-android-lg`  | alerta     | bloqueante |

## Não Fazer

- Não adicionar um viewport novo sem regenerar baselines.
- Não rodar testes apenas em `desktop-lg` e confiar que mobile está OK.
- Não usar viewports diferentes entre runs locais e CI.
- Não pular viewport mobile em rotas com CTA crítico.
