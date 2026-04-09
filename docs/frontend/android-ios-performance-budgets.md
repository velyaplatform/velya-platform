# Performance Budgets — Android e iOS — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09

---

## 1. Visão Geral

Performance budgets definem limites máximos para métricas de performance em cada rota da plataforma. Estes budgets são mais restritivos em mobile, onde hardware, rede e bateria são limitados. Exceder um budget dispara alertas e bloqueia merge em CI.

### 1.1 Princípios

1. **Budgets por rota**: Cada rota tem seus próprios limites
2. **Mobile mais restritivo**: Mobile budgets são 60-70% do desktop
3. **Medir no pior caso razoável**: 4G throttle, device mid-range
4. **Profiling contínuo**: Não apenas em release, mas em cada PR
5. **Ação imediata**: Budget excedido = investigação obrigatória

---

## 2. Budgets por Rota Crítica

### 2.1 Tabela de Budgets

| Rota | JS Bundle (gz) | CSS (gz) | Total Transfer | LCP | FID/INP | CLS | TTI |
|---|---|---|---|---|---|---|---|
| **Mobile** | | | | | | | |
| `/login` | 80kb | 15kb | 120kb | 1.5s | 50ms | 0.05 | 2.0s |
| `/dashboard` | 120kb | 20kb | 200kb | 2.5s | 100ms | 0.1 | 3.5s |
| `/patients` | 100kb | 18kb | 180kb | 2.0s | 100ms | 0.1 | 3.0s |
| `/patients/[id]` | 110kb | 18kb | 190kb | 2.5s | 100ms | 0.1 | 3.5s |
| `/medication` | 100kb | 18kb | 170kb | 2.0s | 80ms | 0.05 | 2.5s |
| `/calls` | 90kb | 15kb | 150kb | 1.5s | 50ms | 0.05 | 2.0s |
| `/handoff` | 120kb | 20kb | 200kb | 2.5s | 100ms | 0.1 | 3.5s |
| `/command-center` | 130kb | 22kb | 220kb | 3.0s | 100ms | 0.1 | 4.0s |
| **Desktop** | | | | | | | |
| `/login` | 100kb | 18kb | 150kb | 1.2s | 40ms | 0.05 | 1.5s |
| `/dashboard` | 180kb | 25kb | 280kb | 2.0s | 80ms | 0.1 | 2.5s |
| `/patients` | 150kb | 22kb | 250kb | 1.5s | 80ms | 0.1 | 2.0s |
| `/patients/[id]` | 160kb | 22kb | 260kb | 2.0s | 80ms | 0.1 | 2.5s |
| `/medication` | 150kb | 22kb | 240kb | 1.5s | 60ms | 0.05 | 2.0s |
| `/calls` | 120kb | 18kb | 200kb | 1.2s | 40ms | 0.05 | 1.5s |
| `/handoff` | 180kb | 25kb | 280kb | 2.0s | 80ms | 0.1 | 2.5s |
| `/command-center` | 200kb | 28kb | 320kb | 2.5s | 80ms | 0.1 | 3.0s |

### 2.2 Budget Global (Toda a Aplicação)

| Métrica | Mobile | Desktop |
|---|---|---|
| Total JS (first load, gz) | < 200kb | < 300kb |
| Total CSS (gz) | < 30kb | < 40kb |
| Total transfer (first load) | < 350kb | < 500kb |
| Number of requests (initial) | < 20 | < 25 |
| Font files | < 100kb | < 150kb |
| Images (above fold) | < 100kb | < 200kb |

---

## 3. Core Web Vitals — Targets

### 3.1 LCP (Largest Contentful Paint)

| Target | Mobile | Desktop | Significado |
|---|---|---|---|
| Good | < 2.5s | < 2.0s | Experiência boa |
| Needs Improvement | 2.5-4.0s | 2.0-3.0s | Aceitável mas precisa melhorar |
| Poor | > 4.0s | > 3.0s | Inaceitável — bloqueia deploy |

**Elementos LCP típicos por rota:**

| Rota | Elemento LCP | Otimização |
|---|---|---|
| Login | Logo + formulário | Font preload, inline critical CSS |
| Dashboard | Primeiro metric card | Server Component, streaming |
| Pacientes | Primeira row da tabela | SSR, skeleton during hydration |
| Medicação | Painel de medicação | Server fetch + streaming |
| Chamadas | Lista de chamadas ativas | SSR, TanStack Query hydration |

### 3.2 FID / INP (First Input Delay / Interaction to Next Paint)

| Target | Mobile | Desktop | Significado |
|---|---|---|---|
| Good | < 100ms | < 80ms | Resposta instantânea |
| Needs Improvement | 100-300ms | 80-200ms | Lag perceptível |
| Poor | > 300ms | > 200ms | Frustração do usuário |

**Otimizações para FID/INP:**

1. Code splitting por rota (dynamic imports)
2. Defer non-critical JavaScript
3. Mover computação pesada para Web Workers
4. Memoizar componentes com renderização custosa
5. Debounce handlers de input
6. Usar `startTransition` para updates não-urgentes

### 3.3 CLS (Cumulative Layout Shift)

| Target | Mobile | Desktop | Significado |
|---|---|---|---|
| Good | < 0.1 | < 0.1 | Estável |
| Needs Improvement | 0.1-0.25 | 0.1-0.25 | Shifts perceptíveis |
| Poor | > 0.25 | > 0.25 | Layout quebrado |

**Causas comuns de CLS e prevenção:**

| Causa | Prevenção |
|---|---|
| Imagens sem dimensão | Sempre definir `width` e `height` ou `aspect-ratio` |
| Fontes flash (FOUT) | `font-display: swap` + preload |
| Conteúdo dinâmico inserido | Reservar espaço com skeleton/placeholder |
| Ads/banners carregando | Espaço reservado fixo |
| Tabelas de dados | Skeleton com dimensões fixas |
| Status chips mudando de tamanho | Largura mínima fixa |

---

## 4. Budgets por Tipo de Recurso

### 4.1 JavaScript

```
Shared (framework)
├── React + React DOM:       ~42kb gz (não compressível mais)
├── Next.js runtime:         ~30kb gz
├── TanStack Query:          ~12kb gz
└── Total framework:         ~84kb gz

Route-specific
├── shadcn/ui components:    5-15kb gz por rota (tree-shaked)
├── TanStack Table:          ~10kb gz (apenas rotas com tabela)
├── React Hook Form:         ~8kb gz (apenas rotas com formulário)
├── Zod:                     ~5kb gz (apenas rotas com validação)
├── Recharts:                ~15kb gz (apenas rotas com gráficos)
└── Feature code:            5-20kb gz por feature

Budget total JS por rota:    80-200kb gz
```

### 4.2 CSS

```
Global CSS
├── Tailwind utilities (purged): ~10-15kb gz
├── CSS variables/tokens:        ~2kb gz
└── Total global:                ~12-17kb gz

Route-specific CSS:              ~3-8kb gz
Total CSS budget:                < 30kb gz (mobile)
```

### 4.3 Fontes

```
Inter (primary):
├── Regular (latin):     ~20kb woff2
├── Medium (latin):      ~20kb woff2
├── Semibold (latin):    ~20kb woff2
└── Total:               ~60kb woff2

JetBrains Mono (code):
├── Regular (latin):     ~15kb woff2
└── Total:               ~15kb woff2

Budget total fontes:     < 100kb
```

---

## 5. Condições de Teste

### 5.1 Perfis de Throttle

| Perfil | Download | Upload | Latency | Dispositivo Representativo |
|---|---|---|---|---|
| 4G Fast | 12 Mbps | 2 Mbps | 50ms | iPhone 15, flagship Android |
| 4G Regular | 4 Mbps | 750 kbps | 100ms | iPhone 12, mid-range Android |
| 4G Slow | 1.5 Mbps | 400 kbps | 150ms | Em elevador, subsolo |
| 3G | 750 kbps | 250 kbps | 300ms | Zona rural, cobertura ruim |
| Wi-Fi Hospital | 10 Mbps | 5 Mbps | 20ms | Wi-Fi corporativo |
| Wi-Fi Degradado | 2 Mbps | 1 Mbps | 100ms | Muitos devices no AP |

### 5.2 Dispositivos de Referência

| Tier | Device | CPU | RAM | Onde Testar |
|---|---|---|---|---|
| High-end | iPhone 15 Pro | A17 Pro | 8GB | Lighthouse, Playwright |
| Mid-range | iPhone 12 | A14 | 4GB | **Referência principal** |
| Budget | Samsung Galaxy A14 | MediaTek | 4GB | Worst case testing |
| Tablet | iPad Air | M1 | 8GB | Playwright iPad profile |

### 5.3 Condição de Referência para Budgets

Os budgets mobile são medidos em:
- **Device**: iPhone 12 (ou CPU throttle 4x em Lighthouse)
- **Rede**: 4G Regular (4 Mbps / 100ms)
- **Orientação**: Portrait
- **Estado**: Cold start (sem cache)

---

## 6. Profiling Contínuo

### 6.1 CI Pipeline

```yaml
# .github/workflows/performance.yml
name: Performance Budget Check

on:
  pull_request:
    paths: ['apps/web/**']

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
        working-directory: apps/web
      - name: Start server
        run: npm run start &
        working-directory: apps/web
      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v11
        with:
          urls: |
            http://localhost:3001/login
            http://localhost:3001/dashboard
            http://localhost:3001/patients
            http://localhost:3001/medication
          budgetPath: ./apps/web/lighthouse-budget.json
          uploadArtifacts: true
      - name: Bundle analysis
        run: npx @next/bundle-analyzer
        working-directory: apps/web
```

### 6.2 Lighthouse Budget Config

```json
// apps/web/lighthouse-budget.json
[
  {
    "path": "/login",
    "timings": [
      { "metric": "largest-contentful-paint", "budget": 1500 },
      { "metric": "first-input-delay", "budget": 50 },
      { "metric": "cumulative-layout-shift", "budget": 0.05 },
      { "metric": "interactive", "budget": 2000 }
    ],
    "resourceSizes": [
      { "resourceType": "script", "budget": 120 },
      { "resourceType": "stylesheet", "budget": 20 },
      { "resourceType": "total", "budget": 200 }
    ]
  },
  {
    "path": "/dashboard",
    "timings": [
      { "metric": "largest-contentful-paint", "budget": 2500 },
      { "metric": "first-input-delay", "budget": 100 },
      { "metric": "cumulative-layout-shift", "budget": 0.1 },
      { "metric": "interactive", "budget": 3500 }
    ],
    "resourceSizes": [
      { "resourceType": "script", "budget": 200 },
      { "resourceType": "stylesheet", "budget": 25 },
      { "resourceType": "total", "budget": 350 }
    ]
  },
  {
    "path": "/patients",
    "timings": [
      { "metric": "largest-contentful-paint", "budget": 2000 },
      { "metric": "first-input-delay", "budget": 100 },
      { "metric": "cumulative-layout-shift", "budget": 0.1 },
      { "metric": "interactive", "budget": 3000 }
    ],
    "resourceSizes": [
      { "resourceType": "script", "budget": 180 },
      { "resourceType": "stylesheet", "budget": 22 },
      { "resourceType": "total", "budget": 300 }
    ]
  },
  {
    "path": "/medication",
    "timings": [
      { "metric": "largest-contentful-paint", "budget": 2000 },
      { "metric": "first-input-delay", "budget": 80 },
      { "metric": "cumulative-layout-shift", "budget": 0.05 },
      { "metric": "interactive", "budget": 2500 }
    ],
    "resourceSizes": [
      { "resourceType": "script", "budget": 150 },
      { "resourceType": "stylesheet", "budget": 22 },
      { "resourceType": "total", "budget": 280 }
    ]
  }
]
```

### 6.3 Bundle Size Tracking

```tsx
// scripts/check-bundle-size.ts
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { gzipSync } from 'zlib'

const BUILD_DIR = '.next'
const MAX_FIRST_LOAD_JS = 200 * 1024 // 200kb gz for mobile

function getGzipSize(filePath: string): number {
  const content = readFileSync(filePath)
  return gzipSync(content).length
}

function checkBundleSizes() {
  // Check page bundles
  const pagesDir = join(BUILD_DIR, 'static', 'chunks', 'pages')
  const entries = readdirSync(pagesDir)

  let totalFirstLoad = 0
  const violations: string[] = []

  for (const entry of entries) {
    const filePath = join(pagesDir, entry)
    const stat = statSync(filePath)
    if (stat.isFile() && entry.endsWith('.js')) {
      const gzSize = getGzipSize(filePath)
      totalFirstLoad += gzSize

      if (gzSize > 50 * 1024) {
        violations.push(`${entry}: ${(gzSize / 1024).toFixed(1)}kb gz (max 50kb per chunk)`)
      }
    }
  }

  if (totalFirstLoad > MAX_FIRST_LOAD_JS) {
    violations.push(
      `Total first load JS: ${(totalFirstLoad / 1024).toFixed(1)}kb gz (max ${MAX_FIRST_LOAD_JS / 1024}kb)`
    )
  }

  if (violations.length > 0) {
    console.error('Bundle size violations:')
    violations.forEach((v) => console.error(`  - ${v}`))
    process.exit(1)
  }

  console.log(`Bundle size check passed. Total first load: ${(totalFirstLoad / 1024).toFixed(1)}kb gz`)
}

checkBundleSizes()
```

---

## 7. Otimizações de Performance

### 7.1 Code Splitting

```tsx
// Dynamic imports para componentes pesados
const PatientTimeline = dynamic(
  () => import('@/features/patient-journey/components/patient-timeline'),
  { loading: () => <TimelineSkeleton /> }
)

const PainTrendChart = dynamic(
  () => import('@/features/calls-and-pain/components/pain-trend-chart'),
  { loading: () => <ChartSkeleton />, ssr: false }
)

const AuditLogTable = dynamic(
  () => import('@/features/audit/components/audit-log-table'),
  { loading: () => <TableSkeleton /> }
)
```

### 7.2 Preloading e Prefetching

```tsx
// Preload crítico
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="" />

// Prefetch de rota provável
import { useRouter } from 'next/navigation'
const router = useRouter()
router.prefetch('/patients') // Prefetch quando dashboard carrega

// DNS prefetch para API
<link rel="dns-prefetch" href="https://api.velya.health" />
<link rel="preconnect" href="https://api.velya.health" />
```

### 7.3 Image Optimization

```tsx
// Next.js Image com sizes adequados
<Image
  src={patient.avatar}
  alt={patient.name}
  width={40}
  height={40}
  sizes="40px"
  loading="lazy"
  placeholder="blur"
  blurDataURL={patient.avatarBlur}
/>

// Imagens above-the-fold
<Image
  src="/logo.svg"
  alt="Velya"
  width={120}
  height={40}
  priority // Preload
/>
```

### 7.4 React Optimization

```tsx
// Memoizar componentes estáveis
const MemoizedPatientCard = memo(PatientCard)

// Memoizar colunas de tabela
const columns = useMemo(() => createPatientColumns(), [])

// Callback estável para handlers
const handleSort = useCallback((column: string) => {
  setSortBy(column)
}, [])

// Transition para updates não-urgentes
const [isPending, startTransition] = useTransition()
function handleFilter(value: string) {
  startTransition(() => {
    setFilter(value)
  })
}
```

---

## 8. Monitoramento em Produção

### 8.1 Real User Monitoring (RUM)

```tsx
// Coletar métricas reais dos usuários
function initRUM() {
  // Web Vitals
  onLCP((metric) => reportMetric('lcp', metric))
  onFID((metric) => reportMetric('fid', metric))
  onCLS((metric) => reportMetric('cls', metric))
  onINP((metric) => reportMetric('inp', metric))

  // Navigation timing
  if (performance.getEntriesByType) {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    reportMetric('ttfb', { value: nav.responseStart - nav.requestStart })
    reportMetric('dom-interactive', { value: nav.domInteractive })
    reportMetric('dom-complete', { value: nav.domComplete })
  }
}
```

### 8.2 Percentile Targets (P75)

Os budgets se aplicam ao P75 (75% dos usuários):

| Métrica | P50 Target | P75 Target (Budget) | P95 Alert |
|---|---|---|---|
| LCP (mobile) | < 1.5s | < 2.5s | > 4.0s |
| FID (mobile) | < 50ms | < 100ms | > 300ms |
| CLS (mobile) | < 0.05 | < 0.1 | > 0.25 |
| INP (mobile) | < 100ms | < 200ms | > 500ms |
| TTFB (mobile) | < 200ms | < 500ms | > 1000ms |

### 8.3 Alertas

| Condição | Severidade | Ação |
|---|---|---|
| LCP P75 > 2.5s por 15min | Warning | Investigar |
| LCP P75 > 4.0s por 5min | Critical | Rollback se recente |
| FID P75 > 100ms por 15min | Warning | Investigar |
| CLS P75 > 0.1 por 15min | Warning | Investigar |
| Bundle size > budget | Blocking | PR não pode ser merged |
| JS error rate > 1% | Critical | Rollback |

---

## 9. Degradação por Rede

### 9.1 Adaptações por Velocidade de Rede

| Rede | Adaptação |
|---|---|
| 4G Fast | Experiência completa |
| 4G Regular | Animações reduzidas, prefetch limitado |
| 4G Slow | Imagens em qualidade baixa, sem prefetch |
| 3G | Imagens desabilitadas (placeholders), animações off, page size mínimo |

### 9.2 Implementação

```tsx
function useAdaptivePerformance() {
  const connection = useConnectionType()

  return useMemo(() => ({
    imageQuality: connection?.effectiveType === '3g' ? 20 :
                  connection?.effectiveType === 'slow-2g' ? 0 : 80,
    enableAnimations: connection?.effectiveType !== '3g',
    enablePrefetch: connection?.effectiveType === '4g',
    chartDataPoints: connection?.effectiveType === '3g' ? 50 : 300,
    tablePageSize: connection?.effectiveType === '3g' ? 10 : 20,
  }), [connection?.effectiveType])
}
```

---

## 10. Referências

- [Web Vitals — Google](https://web.dev/vitals/)
- [Performance Budgets 101](https://web.dev/performance-budgets-101/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Bundle Analyzer for Next.js](https://www.npmjs.com/package/@next/bundle-analyzer)
