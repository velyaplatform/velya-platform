# Modelo de Observabilidade Frontend — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09

---

## 1. Visão Geral

A observabilidade do frontend Velya captura métricas, eventos e traces que permitem entender a experiência real do operador. Em um ambiente hospitalar, uma interface lenta, travada ou com erro pode impactar diretamente o atendimento ao paciente.

### 1.1 Princípios

1. **Observar a experiência real**: Métricas sintéticas não bastam — medir no dispositivo real
2. **Detectar antes do usuário reclamar**: Anomalias detectadas proativamente
3. **Correlacionar com backend**: Trace ID propagado do frontend ao microserviço
4. **Não impactar performance**: Telemetria não pode degradar a experiência que monitora
5. **Respeitar privacidade**: Nunca capturar dados de paciente na telemetria

---

## 2. Categorias de Observabilidade

### 2.1 Mapa Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBSERVABILIDADE FRONTEND                      │
├──────────────┬──────────────┬───────────────┬───────────────────┤
│  Performance │  Interação   │  Erros        │  Comportamento    │
├──────────────┼──────────────┼───────────────┼───────────────────┤
│  Page load   │  Actions     │  JS errors    │  Rage clicks      │
│  Route trans │  Form submit │  API failures │  Dead clicks      │
│  LCP/FID/CLS │  Navigation  │  Permission   │  Scroll patterns  │
│  Long tasks  │  AI usage    │  Degraded     │  Feature usage    │
│  Memory      │  Search      │  Timeout      │  Platform diff    │
│  Freezes     │  Filters     │  Validation   │  Session length   │
└──────────────┴──────────────┴───────────────┴───────────────────┘
```

---

## 3. Page Load Metrics

### 3.1 Core Web Vitals

```tsx
// lib/observability/web-vitals.ts
import { onLCP, onFID, onCLS, onFCP, onTTFB, onINP } from 'web-vitals'

interface VitalMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
  navigationType: string
}

function reportVital(metric: VitalMetric) {
  // Enviar para backend de observabilidade
  sendTelemetry('web-vital', {
    metric: metric.name,
    value: metric.value,
    rating: metric.rating,
    page: window.location.pathname,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    connection: (navigator as any).connection?.effectiveType,
    deviceMemory: (navigator as any).deviceMemory,
  })
}

export function initWebVitals() {
  onLCP(reportVital)
  onFID(reportVital)
  onCLS(reportVital)
  onFCP(reportVital)
  onTTFB(reportVital)
  onINP(reportVital)
}
```

### 3.2 Thresholds por Rota

| Rota | LCP Target | FID Target | CLS Target | INP Target |
|---|---|---|---|---|
| `/dashboard` | < 2.5s | < 100ms | < 0.1 | < 200ms |
| `/patients` | < 2.0s | < 100ms | < 0.1 | < 200ms |
| `/patients/[id]` | < 2.5s | < 100ms | < 0.1 | < 200ms |
| `/medication` | < 2.0s | < 100ms | < 0.05 | < 150ms |
| `/calls` | < 1.5s | < 50ms | < 0.05 | < 100ms |
| `/handoff` | < 3.0s | < 100ms | < 0.1 | < 200ms |
| `/login` | < 1.5s | < 50ms | < 0.05 | < 100ms |

### 3.3 Alertas de Performance

```tsx
// Alertar quando metrics degradam
const PERFORMANCE_ALERTS = {
  lcp: {
    warning: 2500,   // ms
    critical: 4000,
  },
  fid: {
    warning: 100,
    critical: 300,
  },
  cls: {
    warning: 0.1,
    critical: 0.25,
  },
  inp: {
    warning: 200,
    critical: 500,
  },
}
```

---

## 4. Route Transitions

### 4.1 Medição de Navegação

```tsx
// lib/observability/route-tracker.ts
'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function RouteTracker() {
  const pathname = usePathname()
  const previousPath = useRef<string | null>(null)
  const navigationStart = useRef<number>(0)

  useEffect(() => {
    const now = performance.now()

    if (previousPath.current) {
      const duration = now - navigationStart.current

      sendTelemetry('route-transition', {
        from: previousPath.current,
        to: pathname,
        duration,
        timestamp: Date.now(),
      })

      // Alertar se transição demorar demais
      if (duration > 3000) {
        sendTelemetry('slow-navigation', {
          from: previousPath.current,
          to: pathname,
          duration,
        })
      }
    }

    previousPath.current = pathname
    navigationStart.current = now
  }, [pathname])

  return null
}
```

### 4.2 Métricas de Navegação

| Métrica | Target | Alertar |
|---|---|---|
| Route transition time | < 500ms | > 3s |
| Navigation failure rate | < 0.1% | > 1% |
| Abandoned navigations | Track | Spike |
| Back button frequency | Track | Spike (UX issue indicator) |

---

## 5. Action Completion e Failure

### 5.1 Tracking de Ações

```tsx
// lib/observability/action-tracker.ts
type ActionStatus = 'started' | 'completed' | 'failed' | 'cancelled'

interface ActionEvent {
  action: string           // e.g., 'medication.administer'
  status: ActionStatus
  duration?: number        // ms desde started
  error?: string
  metadata?: Record<string, any>
}

function trackAction(event: ActionEvent) {
  sendTelemetry('user-action', {
    ...event,
    page: window.location.pathname,
    timestamp: Date.now(),
  })
}

// Hook para wrapping de ações
function useTrackedAction(actionName: string) {
  return async function <T>(fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    trackAction({ action: actionName, status: 'started' })

    try {
      const result = await fn()
      trackAction({
        action: actionName,
        status: 'completed',
        duration: performance.now() - start,
      })
      return result
    } catch (error) {
      trackAction({
        action: actionName,
        status: 'failed',
        duration: performance.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }
}

// Uso
function MedicationAdmin() {
  const track = useTrackedAction('medication.administer')

  async function handleAdmin(medId: string) {
    await track(() => administerMedication(medId))
  }
}
```

### 5.2 Ações Monitoradas

| Ação | Monitorar | Alerta |
|---|---|---|
| `medication.administer` | Success rate, duration | Failure > 0.5% |
| `medication.prescribe` | Success rate, duration | Failure > 1% |
| `call.respond` | Response time, success | Duration > 2s |
| `patient.admit` | Duration, completion rate | Duration > 30s |
| `handoff.submit` | Duration, draft abandonment | Abandonment > 20% |
| `auth.login` | Success rate, duration | Failure > 2% |
| `auth.reauth` | Frequency, success | Spike in frequency |

---

## 6. Rage Clicks

### 6.1 Detecção

```tsx
// lib/observability/rage-click-detector.ts
export function RageClickDetector() {
  useEffect(() => {
    const clicks: { x: number; y: number; time: number }[] = []
    const THRESHOLD = 3         // 3 cliques
    const TIME_WINDOW = 1000    // em 1 segundo
    const DISTANCE = 30         // dentro de 30px

    function handleClick(e: MouseEvent) {
      const now = Date.now()
      clicks.push({ x: e.clientX, y: e.clientY, time: now })

      // Remover cliques antigos
      while (clicks.length > 0 && now - clicks[0].time > TIME_WINDOW) {
        clicks.shift()
      }

      // Verificar rage click
      if (clicks.length >= THRESHOLD) {
        const first = clicks[0]
        const allClose = clicks.every(
          (c) => Math.abs(c.x - first.x) < DISTANCE && Math.abs(c.y - first.y) < DISTANCE
        )

        if (allClose) {
          const target = e.target as HTMLElement
          sendTelemetry('rage-click', {
            x: e.clientX,
            y: e.clientY,
            target: {
              tag: target.tagName,
              id: target.id,
              className: target.className?.slice(0, 100),
              text: target.textContent?.slice(0, 50),
            },
            page: window.location.pathname,
            timestamp: now,
          })
          clicks.length = 0
        }
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return null
}
```

### 6.2 Interpretação

Rage clicks indicam:
- Botão não responsivo (loading sem feedback)
- Área clicável muito pequena (touch target issue)
- Elemento parece clicável mas não é
- Ação falhou sem feedback visual
- Interface travada

---

## 7. Form Failure Tracking

### 7.1 Métricas de Formulário

```tsx
function useFormObservability(formName: string, form: UseFormReturn<any>) {
  const startTime = useRef(Date.now())

  // Track form open
  useEffect(() => {
    startTime.current = Date.now()
    sendTelemetry('form-open', { form: formName })
  }, [formName])

  // Track validation errors
  useEffect(() => {
    const errors = form.formState.errors
    if (Object.keys(errors).length > 0) {
      sendTelemetry('form-validation-error', {
        form: formName,
        fields: Object.keys(errors),
        errorCount: Object.keys(errors).length,
      })
    }
  }, [form.formState.errors, formName])

  // Track submission
  function trackSubmit(success: boolean, error?: string) {
    sendTelemetry('form-submit', {
      form: formName,
      success,
      duration: Date.now() - startTime.current,
      error,
      dirtyFields: Object.keys(form.formState.dirtyFields),
    })
  }

  // Track abandonment
  useEffect(() => {
    return () => {
      if (form.formState.isDirty && !form.formState.isSubmitted) {
        sendTelemetry('form-abandoned', {
          form: formName,
          duration: Date.now() - startTime.current,
          filledFields: Object.keys(form.formState.dirtyFields),
        })
      }
    }
  }, [])

  return { trackSubmit }
}
```

### 7.2 Métricas Chave

| Métrica | Definição | Alerta |
|---|---|---|
| Form completion rate | Submits / Opens | < 70% para forms obrigatórios |
| Validation error rate | Errors / Submits | > 30% |
| Time to complete | Média de duração | > 2x baseline |
| Abandonment rate | Abandonos / Opens | > 20% |
| Error field frequency | Por campo | Top 5 campos com mais erros |

---

## 8. Permission Denials

```tsx
// Tracking de negações de permissão
function trackPermissionDenial(
  permission: string,
  context: string,
) {
  sendTelemetry('permission-denied', {
    permission,
    context,
    page: window.location.pathname,
    timestamp: Date.now(),
  })
}

// Integrar no PermissionGuard
function PermissionGuard({ permission, children, fallback }: PermissionGuardProps) {
  const hasPermission = usePermission(permission)

  if (!hasPermission) {
    trackPermissionDenial(permission, 'component-guard')
    return <>{fallback}</>
  }

  return <>{children}</>
}
```

**Alertas:**

- Spike de permission denials pode indicar configuração errada de roles
- Tentativas repetidas do mesmo usuário podem indicar necessidade de acesso
- Padrão de break-glass seguido de denial indica fluxo confuso

---

## 9. Degraded Mode Tracking

```tsx
function useDegradedModeTracking() {
  const { status, affectedServices } = useDegraded()
  const statusRef = useRef(status)

  useEffect(() => {
    if (status !== statusRef.current) {
      sendTelemetry('degraded-mode-change', {
        from: statusRef.current,
        to: status,
        affectedServices,
        timestamp: Date.now(),
      })
      statusRef.current = status
    }
  }, [status, affectedServices])
}
```

---

## 10. AI Usage Tracking

```tsx
// Tracking de interação com sugestões de IA
function trackAIInteraction(event: {
  type: 'suggestion-shown' | 'suggestion-accepted' | 'suggestion-rejected' | 'suggestion-modified'
  agentId: string
  context: string
  confidence?: number
}) {
  sendTelemetry('ai-interaction', {
    ...event,
    page: window.location.pathname,
    timestamp: Date.now(),
  })
}
```

**Métricas de IA:**

| Métrica | Definição |
|---|---|
| Suggestion acceptance rate | Aceitas / Mostradas |
| Suggestion modification rate | Modificadas / Aceitas |
| Time to decision | Tempo entre mostrar e ação |
| AI feature usage | % de operadores que usam |
| Confidence correlation | Aceitas por faixa de confiança |

---

## 11. Platform Differences

### 11.1 Segmentação por Plataforma

```tsx
function getPlatformContext() {
  const ua = navigator.userAgent
  return {
    platform: /iPhone|iPad/.test(ua) ? 'ios' :
              /Android/.test(ua) ? 'android' : 'desktop',
    browser: /Chrome/.test(ua) ? 'chrome' :
             /Safari/.test(ua) ? 'safari' :
             /Firefox/.test(ua) ? 'firefox' : 'other',
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    touchCapable: 'ontouchstart' in window,
    screenSize: `${window.screen.width}x${window.screen.height}`,
    pixelRatio: window.devicePixelRatio,
    connection: (navigator as any).connection?.effectiveType || 'unknown',
    memory: (navigator as any).deviceMemory || 'unknown',
  }
}
```

### 11.2 Métricas por Plataforma

- LCP em iPhone Safari vs Android Chrome vs Desktop Chrome
- Form completion rate por plataforma
- Rage click rate por plataforma (indicador de touch issues)
- Degraded mode frequency por tipo de conexão

---

## 12. Freezes e Long Tasks

### 12.1 Long Task Observer

```tsx
function initLongTaskObserver() {
  if (!('PerformanceObserver' in window)) return

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 50) { // Long task = > 50ms
        sendTelemetry('long-task', {
          duration: entry.duration,
          startTime: entry.startTime,
          page: window.location.pathname,
          timestamp: Date.now(),
        })
      }

      if (entry.duration > 200) { // Freeze = > 200ms
        sendTelemetry('ui-freeze', {
          duration: entry.duration,
          page: window.location.pathname,
          timestamp: Date.now(),
        })
      }
    }
  })

  observer.observe({ type: 'longtask', buffered: true })
}
```

### 12.2 Thresholds

| Duração | Classificação | Ação |
|---|---|---|
| 50-100ms | Long task | Log |
| 100-200ms | Jank perceptível | Warn |
| 200-500ms | Freeze | Alert |
| > 500ms | Freeze severo | Critical alert |

---

## 13. Memory Consumption

```tsx
function initMemoryMonitor() {
  if (!('memory' in performance)) return

  setInterval(() => {
    const memory = (performance as any).memory
    const usedMB = memory.usedJSHeapSize / (1024 * 1024)
    const totalMB = memory.totalJSHeapSize / (1024 * 1024)
    const limitMB = memory.jsHeapSizeLimit / (1024 * 1024)

    if (usedMB > limitMB * 0.8) {
      sendTelemetry('memory-warning', {
        usedMB: Math.round(usedMB),
        totalMB: Math.round(totalMB),
        limitMB: Math.round(limitMB),
        page: window.location.pathname,
      })
    }
  }, 60000) // A cada minuto
}
```

---

## 14. Telemetria — Implementação

### 14.1 Batching e Envio

```tsx
// lib/observability/telemetry.ts
const BATCH_SIZE = 10
const FLUSH_INTERVAL = 5000 // 5s

let buffer: TelemetryEvent[] = []
let flushTimer: NodeJS.Timeout | null = null

export function sendTelemetry(type: string, data: Record<string, any>) {
  const event: TelemetryEvent = {
    type,
    data: sanitizeData(data),
    context: getPlatformContext(),
    sessionId: getSessionId(),
    timestamp: Date.now(),
  }

  buffer.push(event)

  if (buffer.length >= BATCH_SIZE) {
    flush()
  } else if (!flushTimer) {
    flushTimer = setTimeout(flush, FLUSH_INTERVAL)
  }
}

function flush() {
  if (buffer.length === 0) return

  const events = [...buffer]
  buffer = []

  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  // Usar sendBeacon para não bloquear navigation
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/telemetry', JSON.stringify(events))
  } else {
    fetch('/api/telemetry', {
      method: 'POST',
      body: JSON.stringify(events),
      keepalive: true,
    }).catch(() => {
      // Telemetry failure is not critical
    })
  }
}

// Flush ao sair da página
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush()
})
```

### 14.2 Sanitização

```tsx
function sanitizeData(data: Record<string, any>): Record<string, any> {
  const sanitized = { ...data }

  // Nunca enviar dados de paciente na telemetria
  const sensitiveKeys = [
    'patientName', 'patientId', 'cpf', 'rg', 'phone', 'email',
    'address', 'password', 'token', 'creditCard',
  ]

  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]'
    }
  }

  return sanitized
}
```

---

## 15. Dashboards de Observabilidade

### 15.1 Dashboard Principal

| Painel | Métricas |
|---|---|
| Web Vitals | LCP, FID, CLS, INP — P50, P75, P95 |
| Navegação | Route transition time, failure rate |
| Ações | Completion rate, failure rate por ação |
| UX Issues | Rage clicks, form abandonment |
| Performance | Long tasks, freezes, memory |
| Platform | Métricas segmentadas por device/browser |
| AI | Acceptance rate, usage rate |
| Network | Degraded mode frequency, offline events |

### 15.2 Alertas Configurados

| Alerta | Condição | Severidade |
|---|---|---|
| LCP degraded | P75 > 4s por 5min | Warning |
| High error rate | JS errors > 1% | Critical |
| Rage click spike | > 10/min | Warning |
| UI freeze | > 500ms, > 3/min | Critical |
| Form failure spike | Validation errors > 50% | Warning |
| Memory leak | Memory growing > 10MB/5min | Critical |
| Offline spike | > 5% users offline | Warning |

---

## 16. Referências

- [Web Vitals](https://web.dev/vitals/)
- [Performance Observer API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver)
- [Navigator.sendBeacon](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)
- [Long Tasks API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming)
