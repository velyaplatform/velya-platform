# Assertions de Geometria e Layout

Muitas falhas visuais não aparecem em screenshots porque estão "dentro do
limite de tolerância" do diff, mas são evidentes para o usuário: botão
cortado, modal fora da viewport, header cobrindo CTA, touch target pequeno
demais.

Este documento descreve a library customizada de geometry assertions da
Velya, que roda dentro de cada teste Playwright e valida essas condições
diretamente no DOM.

## Detecções Obrigatórias

| Tipo                | O que detecta                                               |
| ------------------- | ----------------------------------------------------------- |
| `overlap`           | Dois elementos interativos se sobrepondo                    |
| `clipping`          | Elemento tem `overflow: hidden` cortando seu conteúdo       |
| `offscreen`         | Elemento renderizado fora da viewport                       |
| `horizontal-overflow` | Página inteira com scroll horizontal em viewport atual    |
| `touch-target`      | Elemento interativo menor que 44x44px                       |
| `sticky-over-cta`   | Header fixo cobrindo botão de CTA                           |
| `modal-overflow`    | Modal/drawer ultrapassando a viewport                       |
| `text-ellipsis-loss`| Texto importante sendo cortado por ellipsis                 |
| `small-font`        | Texto menor que 12px                                        |

## Library Completa

`tests/visual/fixtures/geometry.ts`:

```ts
import type { Page, TestInfo } from '@playwright/test';

export type GeometryIssueType =
  | 'overlap'
  | 'clipping'
  | 'offscreen'
  | 'horizontal-overflow'
  | 'touch-target'
  | 'sticky-over-cta'
  | 'modal-overflow'
  | 'text-ellipsis-loss'
  | 'small-font';

export interface GeometryIssue {
  type: GeometryIssueType;
  selector: string;
  description: string;
  rect?: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number };
}

const MIN_TOUCH_TARGET = 44;
const MIN_FONT_SIZE = 12;

export async function runGeometryChecks(
  page: Page,
  testInfo: TestInfo,
  options: { minTouchTarget?: number; device?: string } = {},
): Promise<GeometryIssue[]> {
  const minTouch = options.minTouchTarget ?? MIN_TOUCH_TARGET;
  const isMobile = options.device !== 'desktop';

  const issues: GeometryIssue[] = await page.evaluate(
    ({ minTouch, isMobile, minFontSize }) => {
      const out: any[] = [];
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      const describe = (el: Element): string => {
        const tag = el.tagName.toLowerCase();
        const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
        const cls = typeof (el as HTMLElement).className === 'string'
          ? `.${((el as HTMLElement).className as string).split(/\s+/).filter(Boolean).slice(0, 2).join('.')}`
          : '';
        const testId = el.getAttribute('data-testid');
        return testId ? `[data-testid="${testId}"]` : `${tag}${id}${cls}`;
      };

      const asRect = (el: Element) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      };

      // 1. horizontal overflow
      const docEl = document.documentElement;
      if (docEl.scrollWidth > docEl.clientWidth + 1) {
        out.push({
          type: 'horizontal-overflow',
          selector: 'html',
          description: `scrollWidth ${docEl.scrollWidth} > clientWidth ${docEl.clientWidth}`,
          viewport,
        });
      }

      const interactive = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button, a, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });

      // 2. touch target
      for (const el of interactive) {
        const r = el.getBoundingClientRect();
        if (isMobile && (r.width < minTouch || r.height < minTouch)) {
          out.push({
            type: 'touch-target',
            selector: describe(el),
            description: `${Math.round(r.width)}x${Math.round(r.height)} < ${minTouch}x${minTouch}`,
            rect: asRect(el),
            viewport,
          });
        }
      }

      // 3. offscreen
      for (const el of interactive) {
        const r = el.getBoundingClientRect();
        if (r.right < 0 || r.bottom < 0 || r.left > viewport.width + 10) {
          const style = getComputedStyle(el);
          if (style.position !== 'absolute' || style.visibility !== 'hidden') {
            out.push({
              type: 'offscreen',
              selector: describe(el),
              description: `fora da viewport: left=${Math.round(r.left)}, top=${Math.round(r.top)}`,
              rect: asRect(el),
              viewport,
            });
          }
        }
      }

      // 4. overlap entre elementos interativos
      for (let i = 0; i < interactive.length; i++) {
        for (let j = i + 1; j < interactive.length; j++) {
          const a = interactive[i].getBoundingClientRect();
          const b = interactive[j].getBoundingClientRect();
          if (interactive[i].contains(interactive[j]) || interactive[j].contains(interactive[i])) {
            continue;
          }
          const overlap =
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top;
          if (overlap) {
            const overlapW = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const overlapH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (overlapW > 4 && overlapH > 4) {
              out.push({
                type: 'overlap',
                selector: `${describe(interactive[i])} <-> ${describe(interactive[j])}`,
                description: `sobreposição de ${Math.round(overlapW)}x${Math.round(overlapH)}px`,
                viewport,
              });
            }
          }
        }
      }

      // 5. sticky cobrindo CTA
      const stickies = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((el) => {
        const s = getComputedStyle(el);
        return s.position === 'sticky' || s.position === 'fixed';
      });
      const ctas = Array.from(
        document.querySelectorAll<HTMLElement>('[data-cta="true"], button[type="submit"], .cta'),
      );
      for (const s of stickies) {
        const sr = s.getBoundingClientRect();
        for (const c of ctas) {
          const cr = c.getBoundingClientRect();
          if (
            sr.top < cr.bottom &&
            sr.bottom > cr.top &&
            sr.left < cr.right &&
            sr.right > cr.left &&
            !s.contains(c)
          ) {
            out.push({
              type: 'sticky-over-cta',
              selector: `${describe(s)} sobre ${describe(c)}`,
              description: 'header/sticky cobrindo CTA',
              viewport,
            });
          }
        }
      }

      // 6. modal overflow
      const modals = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"], .modal, [data-modal="true"]'),
      );
      for (const m of modals) {
        const r = m.getBoundingClientRect();
        if (r.right > viewport.width + 1 || r.bottom > viewport.height + 1) {
          out.push({
            type: 'modal-overflow',
            selector: describe(m),
            description: `modal ${Math.round(r.width)}x${Math.round(r.height)} excede viewport ${viewport.width}x${viewport.height}`,
            rect: asRect(m),
            viewport,
          });
        }
      }

      // 7. text ellipsis loss
      const texts = Array.from(
        document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, p, span, label, td, th, button'),
      );
      for (const t of texts) {
        const s = getComputedStyle(t);
        if (s.textOverflow === 'ellipsis' && (t.scrollWidth > t.clientWidth + 1)) {
          if ((t.textContent ?? '').trim().length > 10) {
            out.push({
              type: 'text-ellipsis-loss',
              selector: describe(t),
              description: `"${(t.textContent ?? '').slice(0, 40)}" truncado`,
              viewport,
            });
          }
        }
        const fs = parseFloat(s.fontSize);
        if (fs < minFontSize && (t.textContent ?? '').trim().length > 0) {
          out.push({
            type: 'small-font',
            selector: describe(t),
            description: `fontSize=${fs}px < ${minFontSize}px`,
            viewport,
          });
        }
      }

      // 8. clipping
      const clippable = Array.from(
        document.querySelectorAll<HTMLElement>('[data-clip-check], h1, h2, h3, button'),
      );
      for (const el of clippable) {
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
          const s = getComputedStyle(el);
          if (s.overflow === 'hidden' && s.textOverflow !== 'ellipsis') {
            out.push({
              type: 'clipping',
              selector: describe(el),
              description: `conteúdo cortado (scroll ${el.scrollWidth}x${el.scrollHeight} vs client ${el.clientWidth}x${el.clientHeight})`,
              viewport,
            });
          }
        }
      }

      return out;
    },
    { minTouch, isMobile, minFontSize: MIN_FONT_SIZE },
  );

  if (issues.length > 0) {
    await testInfo.attach('geometry-issues.json', {
      body: JSON.stringify(issues, null, 2),
      contentType: 'application/json',
    });
  }

  return issues;
}

export function assertNoBlocking(issues: GeometryIssue[]) {
  const blocking = issues.filter((i) =>
    ['overlap', 'offscreen', 'horizontal-overflow', 'touch-target', 'sticky-over-cta', 'modal-overflow'].includes(i.type),
  );
  if (blocking.length > 0) {
    const lines = blocking.map((i) => `  [${i.type}] ${i.selector} — ${i.description}`);
    throw new Error(`Problemas de geometria bloqueantes:\n${lines.join('\n')}`);
  }
}
```

## Exemplo de Uso em Teste

```ts
import { test } from '@playwright/test';
import { stabilize } from '../fixtures/stabilize';
import { runGeometryChecks, assertNoBlocking } from '../fixtures/geometry';

test(
  'patients page has no geometry issues on mobile',
  { tag: ['@geometry', '@page', '@mobile', '@stable'] },
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/patients');
    await stabilize(page);

    const issues = await runGeometryChecks(page, testInfo, { device: 'mobile' });
    assertNoBlocking(issues);
  },
);
```

## Severidades

| Tipo                  | Severidade | Gate       |
| --------------------- | ---------- | ---------- |
| `overlap`             | critical   | bloqueia   |
| `offscreen`           | critical   | bloqueia   |
| `horizontal-overflow` | critical   | bloqueia   |
| `touch-target`        | serious    | bloqueia em mobile |
| `sticky-over-cta`     | serious    | bloqueia   |
| `modal-overflow`      | serious    | bloqueia   |
| `clipping`            | serious    | bloqueia quando o conteúdo é texto crítico |
| `text-ellipsis-loss`  | moderate   | informativo |
| `small-font`          | moderate   | informativo |

## Integração no scripts/visual-test.ts

A função `runGeometryChecks` é chamada a cada página visitada pelo script
`scripts/visual-test.ts` e adiciona os issues ao relatório consolidado, com
tipo, severidade e posição.

## Não Fazer

- Não marcar elementos 3rd party com `data-testid` só pra silenciar detecção.
- Não usar thresholds globais — a lib detecta por tipo, cada um com gate.
- Não rodar geometry checks sem `stabilize()` antes.
- Não ignorar `small-font` sem justificativa — fontes abaixo de 12px devem
  ser raridade documentada.
