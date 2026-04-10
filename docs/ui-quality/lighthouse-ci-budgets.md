# Lighthouse CI — Performance Budgets

Este documento define os budgets de performance, acessibilidade, SEO e best
practices que a Velya aplica via Lighthouse CI em cada PR e noturno.

## Categorias Monitoradas

Lighthouse retorna 4 categorias principais. A Velya define targets mínimos
para cada uma:

| Categoria       | Target mínimo | Gate        |
| --------------- | ------------- | ----------- |
| Performance     | 85            | bloqueante  |
| Accessibility   | 95            | bloqueante  |
| Best Practices  | 90            | bloqueante  |
| SEO             | 85            | alerta      |

Rotas críticas de saúde (login, prescribe, admit, patients) exigem targets
mais agressivos:

| Rota              | Performance | A11y | BP  | SEO |
| ----------------- | ----------- | ---- | --- | --- |
| `/`               | 90          | 95   | 90  | 90  |
| `/login`          | 90          | 95   | 90  | 85  |
| `/register`       | 88          | 95   | 90  | 85  |
| `/dashboard`      | 85          | 95   | 90  | —   |
| `/patients`       | 85          | 95   | 90  | —   |
| `/patients/[id]`  | 85          | 95   | 90  | —   |
| `/icu`            | 85          | 95   | 90  | —   |
| `/ems`            | 85          | 95   | 90  | —   |
| `/pharmacy`       | 85          | 95   | 90  | —   |
| `/prescribe`      | 85          | 95   | 90  | —   |

## Core Web Vitals

Budgets absolutos por rota crítica:

| Métrica | Alvo    | Limite rígido | Descrição                         |
| ------- | ------- | ------------- | --------------------------------- |
| LCP     | <2.0s   | <2.5s         | Largest Contentful Paint          |
| FID     | <80ms   | <100ms        | First Input Delay (INP substituirá) |
| CLS     | <0.05   | <0.1          | Cumulative Layout Shift           |
| TTFB    | <600ms  | <800ms        | Time to First Byte                |
| TBT     | <200ms  | <300ms        | Total Blocking Time               |
| FCP     | <1.5s   | <1.8s         | First Contentful Paint            |
| SI      | <3.0s   | <3.4s         | Speed Index                       |

## Budgets de Recursos

Aplicados via `budget.json`:

```json
[
  {
    "path": "/*",
    "resourceSizes": [
      { "resourceType": "script", "budget": 300 },
      { "resourceType": "stylesheet", "budget": 60 },
      { "resourceType": "image", "budget": 250 },
      { "resourceType": "font", "budget": 120 },
      { "resourceType": "document", "budget": 40 },
      { "resourceType": "total", "budget": 900 }
    ],
    "resourceCounts": [
      { "resourceType": "third-party", "budget": 8 },
      { "resourceType": "script", "budget": 20 }
    ],
    "timings": [
      { "metric": "interactive", "budget": 3500 },
      { "metric": "first-contentful-paint", "budget": 1800 },
      { "metric": "largest-contentful-paint", "budget": 2500 },
      { "metric": "cumulative-layout-shift", "budget": 100 },
      { "metric": "total-blocking-time", "budget": 300 }
    ]
  }
]
```

Valores de `budget` em KB para tamanhos, ms para timings, 100 = 0.1 para CLS.

## Configuração do Lighthouse CI

`.lighthouserc.js`:

```js
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'cd apps/web && PORT=3334 node .next/standalone/apps/web/server.js',
      startServerReadyPattern: 'Ready in',
      url: [
        'http://localhost:3334/',
        'http://localhost:3334/login',
        'http://localhost:3334/register',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        throttlingMethod: 'simulate',
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1440,
          height: 900,
          deviceScaleFactor: 1,
          disabled: false,
        },
        budgetPath: './lighthouse-budgets.json',
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.90 }],
        'categories:seo': ['warn', { minScore: 0.85 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'speed-index': ['warn', { maxNumericValue: 3400 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

## Execução

### CI

O job `lighthouse` do workflow `ui-quality.yaml`:

1. Builda `apps/web` em modo standalone.
2. Sobe servidor Node na porta 3334.
3. Executa `lhci autorun` contra cada URL configurada.
4. Faz upload do relatório para `temporary-public-storage`.
5. Falha o job se qualquer assertion bloqueante falhar.

### Local

```bash
# Instalar
npm install -g @lhci/cli

# Rodar
cd apps/web
PORT=3334 node .next/standalone/apps/web/server.js &
lhci autorun
```

## Runs Múltiplos e Estabilidade

Lighthouse executa 3 runs por URL e usa a mediana. Isso reduz flakiness sem
ser excessivo. Se a variação entre runs for maior que 10%, o ambiente de CI
está instável — nesse caso, o job reporta `warn` e abre issue de
investigação.

## Mobile vs Desktop

O workflow roda duas configurações:

1. **Desktop:** `preset: 'desktop'`, viewport 1440x900, conexão rápida.
2. **Mobile:** `preset: 'mobile'`, viewport 390x844, conexão 4G throttle.

Budgets mobile são 10 pontos mais relaxados em performance (75+) devido ao
throttle de rede/CPU simulado.

## Tratamento de Regressões

Se uma PR derruba o score Lighthouse:

1. CI falha o job bloqueante.
2. Comentário automático no PR mostra diff (`score atual vs score baseline`).
3. Autor precisa explicar a regressão ou otimizar.
4. Exceções temporárias só com aprovação do Performance Office.

## Métricas Rastreadas no Scorecard

- Pass rate de budgets (% de runs que passam todos os budgets)
- Score médio por categoria por semana
- LCP p50, p95 por rota
- Número de regressões não-resolvidas
- Tempo médio para resolução de regressão

## Não Fazer

- Não aumentar budget para "passar o teste". Sempre investigar a causa.
- Não desabilitar assertions sem ADR justificando.
- Não rodar Lighthouse contra ambiente com dados reais.
- Não ignorar variação alta entre runs — é sinal de problema real.
- Não confiar em Lighthouse como única medida de UX — complemente com RUM.
