# Modelo de Observabilidade Frontend — Velya Platform

> O frontend é onde o clínico toma decisões. Atraso, erro ou atrito na interface impacta diretamente a segurança do paciente.
> Última atualização: 2026-04-08

---

## 1. Por que o Frontend é um Sinal Crítico

Em hospitais, o velya-web não é uma interface de consumidor comum. É uma ferramenta clínica:

- Um médico que não consegue iniciar o processo de alta porque o botão não responde → leito ocupado desnecessariamente
- Uma enfermeira que vê uma tela em branco ao tentar registrar medicação → risco de atraso no cuidado
- Um coordenador de turno que não vê as tarefas críticas por falha de rendering → SLA clínico quebrado silenciosamente

**Regra**: qualquer degradação de UX com duração > 2 minutos em horário clínico deve ser tratada como incidente de média severidade.

### 1.1 Rotas Clínicas Críticas

| Rota              | Propósito clínico             | Degradação impacta      |
| ----------------- | ----------------------------- | ----------------------- |
| `/dashboard`      | Visão geral operacional       | Coordenadores de turno  |
| `/patients`       | Lista de pacientes ativos     | Toda a equipe clínica   |
| `/patients/[id]`  | Detalhes e ações por paciente | Médicos e enfermeiros   |
| `/tasks`          | Inbox de tarefas clínicas     | Toda a equipe           |
| `/discharge`      | Processo de alta médica       | Médicos e coordenadores |
| `/discharge/[id]` | Detalhes do processo de alta  | Médicos, coordenadores  |
| `/handoff`        | Passagem de turno             | Coordenadores de turno  |
| `/system`         | Painel de status do sistema   | NOC, TI                 |

---

## 2. Real User Monitoring (RUM)

### 2.1 Core Web Vitals

Implementados via `web-vitals` library + OTel para envio ao OTel Collector.

#### LCP — Largest Contentful Paint

**O que mede**: Tempo até o maior elemento de conteúdo visível ser renderizado.
**SLO Velya**: P95 < 2.5s em rotas clínicas (`/patients`, `/tasks`, `/discharge`)
**Limites**:

- Bom: < 1.0s
- Aceitável: 1.0s–2.5s
- Ruim: > 2.5s → alerta Médio
- Crítico para clínicas: > 4s → alerta Alto

**Query Grafana**:

```promql
histogram_quantile(0.95,
  rate(velya_web_lcp_seconds_bucket{route="/patients"}[$__rate_interval])
)
```

#### INP — Interaction to Next Paint

**O que mede**: Responsividade a interações do usuário (clique, toque, teclado). Substitui FID desde 2024.
**SLO Velya**: P95 < 200ms em todas as rotas
**Limites**:

- Bom: < 100ms
- Aceitável: 100ms–200ms
- Ruim: > 200ms → alerta Médio

**Por que crítico para a Velya**: Um botão que demora 500ms para responder em uma situação de urgência aumenta o estresse do clínico e pode levar a cliques duplos ou ações incorretas.

#### CLS — Cumulative Layout Shift

**O que mede**: Instabilidade visual (elementos pulando na tela).
**SLO Velya**: Mediana < 0.05 em todas as rotas
**Limites**:

- Bom: < 0.05
- Aceitável: 0.05–0.1
- Ruim: > 0.1 → alerta Médio

**Por que crítico para a Velya**: Um botão de "Confirmar Alta" que pula de posição e o usuário clica em outro botão é um erro clínico causado por CLS.

### 2.2 Métricas de Navegação de Rota

```typescript
// src/lib/route-performance.ts
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useRoutePerformance(): void {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChangeStart = () => {
      window.__velya_route_start = performance.now();
      window.__velya_route_path = window.location.pathname;
    };

    const handleRouteChangeComplete = (url: string) => {
      if (window.__velya_route_start) {
        const duration = performance.now() - window.__velya_route_start;

        sendMetric({
          name: 'velya_web_route_navigation_duration_seconds',
          value: duration / 1000,
          labels: {
            from_route: window.__velya_route_path || 'unknown',
            to_route: url,
          },
        });
      }
    };

    // Next.js App Router: usar eventos de pathname change
    window.addEventListener('velya:route:start', handleRouteChangeStart);
    window.addEventListener('velya:route:complete', handleRouteChangeComplete as any);

    return () => {
      window.removeEventListener('velya:route:start', handleRouteChangeStart);
      window.removeEventListener('velya:route:complete', handleRouteChangeComplete as any);
    };
  }, []);
}
```

### 2.3 Monitoramento de Chamadas API do ponto de vista do usuário

```typescript
// src/lib/fetch-interceptor.ts
// Interceptor global para medir latência de API do ponto de vista do browser

const originalFetch = window.fetch;

window.fetch = async function (input, init) {
  const startTime = performance.now();
  const url = typeof input === 'string' ? input : input.url;
  const endpoint = new URL(url).pathname;

  try {
    const response = await originalFetch(input, init);
    const duration = performance.now() - startTime;

    sendMetric({
      name: 'velya_web_api_request_duration_seconds',
      value: duration / 1000,
      labels: {
        endpoint,
        status: response.status.toString(),
        method: init?.method || 'GET',
      },
    });

    if (!response.ok) {
      incrementCounter('velya_web_api_error_total', {
        endpoint,
        status_code: response.status.toString(),
        method: init?.method || 'GET',
      });
    }

    return response;
  } catch (error) {
    incrementCounter('velya_web_api_error_total', {
      endpoint,
      status_code: 'network_error',
      method: init?.method || 'GET',
    });
    throw error;
  }
};
```

---

## 3. UX Intelligence — Instrumentação Manual

### 3.1 Click Count por Tarefa (complexidade de workflow)

**Propósito**: Detectar quando um fluxo clínico se torna excessivamente complexo. Mais de 8 cliques para completar uma tarefa é sinal de problema de UX.

```typescript
// src/lib/ux-tracking.ts

export function trackTaskClick(taskType: string, clickContext: string): void {
  incrementCounter('velya_web_task_click_total', {
    task_type: taskType,
    click_context: clickContext, // ex: 'confirm-discharge-button', 'select-blocker-type'
    route: window.location.pathname,
  });
}

// Uso nos componentes:
function DischargeConfirmButton({ patientId, workflowId }: Props) {
  const handleClick = () => {
    trackTaskClick('discharge-initiation', 'confirm-discharge-button');
    initiateDischarge(patientId, workflowId);
  };

  return <button onClick={handleClick}>Confirmar Alta</button>;
}
```

### 3.2 Time to First Meaningful Action

**O que mede**: Quanto tempo demora desde o carregamento da rota até o usuário realizar a primeira ação clínica.
**Diferente de LCP**: LCP mede quando a tela fica visível; TFMA mede quando o usuário realmente faz algo.

```typescript
// src/lib/time-to-action.ts

let pageLoadTime: number;

export function markPageLoad(): void {
  pageLoadTime = performance.now();
}

export function markFirstMeaningfulAction(actionType: string): void {
  if (pageLoadTime) {
    const timeToAction = performance.now() - pageLoadTime;
    sendHistogram('velya_web_time_to_first_action_seconds', timeToAction / 1000, {
      route: window.location.pathname,
      action_type: actionType, // 'click-task', 'open-patient', 'initiate-discharge'
    });
    pageLoadTime = 0; // reset
  }
}
```

### 3.3 Abandono de Fluxo

**O que mede**: Usuário saiu de um fluxo clínico no meio (sem concluir).

```typescript
// src/components/discharge/DischargeWizard.tsx
import { useEffect, useRef } from 'react';
import { trackFlowAbandonment } from '@/lib/ux-tracking';

function DischargeWizard({ patientId }: Props) {
  const currentStep = useRef(0);
  const completed = useRef(false);

  // Detectar abandono quando o componente desmonta sem conclusão
  useEffect(() => {
    return () => {
      if (!completed.current && currentStep.current > 0) {
        trackFlowAbandonment('discharge-initiation', `step-${currentStep.current}`);
      }
    };
  }, []);

  // ...resto do wizard
}

function trackFlowAbandonment(flow: string, stepAbandoned: string): void {
  incrementCounter('velya_web_flow_abandonment_total', {
    flow,
    step_abandoned: stepAbandoned,
    route: window.location.pathname,
  });
}
```

### 3.4 Modo Degradado — Uso e Indicador

```typescript
// src/components/DegradedModeBanner.tsx

function DegradedModeBanner({ reason }: { reason: string }) {
  useEffect(() => {
    // Reportar ativação do modo degradado como métrica
    setGauge('velya_degraded_mode_active', 1, {
      service: 'velya-web',
      reason,
      route: window.location.pathname,
    });

    return () => {
      // Limpar quando banner for removido
      setGauge('velya_degraded_mode_active', 0, { service: 'velya-web', reason });
    };
  }, [reason]);

  return (
    <div className="degraded-mode-banner">
      Sistema operando em modo degradado: {reason}. Dados podem estar desatualizados.
    </div>
  );
}
```

### 3.5 Override de Recomendação de AI

**Por que monitorar**: Se clínicos estão sistematicamente ignorando recomendações de AI, há um problema de qualidade ou confiança no AI. Sinal de feedback implícito.

```typescript
// src/components/AIRecommendationCard.tsx

function AIRecommendationCard({ recommendation, onAccept, onOverride }: Props) {
  const handleOverride = (reason: string) => {
    incrementCounter('velya_web_ai_recommendation_override_total', {
      recommendation_type: recommendation.type, // 'discharge-timing', 'medication-review'
      override_reason: reason, // 'clinical-judgment', 'incomplete-data', 'disagree'
      agent_name: recommendation.generatedBy,
    });
    onOverride(reason);
  };

  // ...
}
```

---

## 4. Captura de Erros JavaScript

### 4.1 Error Boundary com Reporting

```typescript
// src/components/VelyaErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';
import { incrementCounter } from '@/lib/metrics';

interface Props {
  children: ReactNode;
  route: string;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class VelyaErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Reportar erro como métrica
    incrementCounter('velya_web_js_error_total', {
      error_type: error.name, // TypeError, ReferenceError, etc.
      route: this.props.route,
      component: errorInfo.componentStack?.split('\n')[1]?.trim() || 'unknown',
    });

    // Log estruturado (enviado via OTel Logs)
    sendLog({
      level: 'error',
      service: 'velya-web',
      event_type: 'frontend.error.unhandled',
      error_code: `JS_${error.name.toUpperCase()}`,
      error_class: 'frontend.react.boundary',
      message: error.message,
      route: this.props.route,
      // NUNCA incluir error.stack em produção — pode ter dados sensíveis
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

### 4.2 Captura de Unhandled Promise Rejections

```typescript
// src/lib/global-error-handler.ts (importar em _app.tsx ou layout.tsx)

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    incrementCounter('velya_web_js_error_total', {
      error_type: 'unhandled_promise_rejection',
      route: window.location.pathname,
    });

    // Prevenir que o erro apareça no console em produção sem estrutura
    if (process.env.NODE_ENV === 'production') {
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    incrementCounter('velya_web_js_error_total', {
      error_type: event.error?.name || 'unknown_error',
      route: window.location.pathname,
    });
  });
}
```

---

## 5. Implementação do Envio de Métricas para OTel Collector

```typescript
// src/lib/metrics.ts — utilitários de envio de métricas ao OTel Collector via OTLP HTTP

const OTEL_ENDPOINT =
  process.env.NEXT_PUBLIC_OTEL_ENDPOINT || 'http://otel-collector.velya-dev-observability:4318';

interface MetricLabel {
  key: string;
  value: { stringValue: string };
}

function buildAttributes(labels: Record<string, string>): MetricLabel[] {
  return Object.entries(labels).map(([key, value]) => ({
    key,
    value: { stringValue: value },
  }));
}

export function incrementCounter(name: string, labels: Record<string, string> = {}): void {
  sendOTLPMetric({
    name,
    sum: {
      dataPoints: [
        {
          asInt: 1,
          startTimeUnixNano: Date.now() * 1_000_000,
          timeUnixNano: Date.now() * 1_000_000,
          attributes: buildAttributes({
            environment: process.env.NEXT_PUBLIC_ENV || 'dev',
            ...labels,
          }),
        },
      ],
      aggregationTemporality: 2, // CUMULATIVE
      isMonotonic: true,
    },
  });
}

export function setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
  sendOTLPMetric({
    name,
    gauge: {
      dataPoints: [
        {
          asDouble: value,
          timeUnixNano: Date.now() * 1_000_000,
          attributes: buildAttributes(labels),
        },
      ],
    },
  });
}

function sendOTLPMetric(metric: unknown): void {
  const payload = {
    resourceMetrics: [
      {
        resource: {
          attributes: buildAttributes({
            'service.name': 'velya-web',
            'service.version': process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
          }),
        },
        scopeMetrics: [
          {
            metrics: [metric],
          },
        ],
      },
    ],
  };

  fetch(`${OTEL_ENDPOINT}/v1/metrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Falha silenciosa — observabilidade nunca deve quebrar a aplicação
  });
}
```

---

## 6. Dashboard Frontend Experience Overview — Layout Detalhado

### Linha 1: KPIs Globais (4 Stat panels)

| Painel                | Métrica                                                                 | Threshold                                 |
| --------------------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| LCP P95 (todas rotas) | `histogram_quantile(0.95, rate(velya_web_lcp_seconds_bucket[5m]))`      | Verde < 2.5s, Amarelo < 4s, Vermelho > 4s |
| INP P95 (todas rotas) | `histogram_quantile(0.95, rate(velya_web_inp_milliseconds_bucket[5m]))` | Verde < 200ms, Vermelho > 500ms           |
| Erros JS / hora       | `increase(velya_web_js_error_total[1h])`                                | Verde 0, Amarelo > 5, Vermelho > 20       |
| Modo degradado ativo  | `velya_degraded_mode_active{service="velya-web"}`                       | Verde 0, Vermelho 1                       |

### Linha 2: Core Web Vitals por Rota (Time Series)

- LCP por rota (`/patients`, `/tasks`, `/discharge`, `/dashboard`, `/handoff`) com threshold line em 2.5s
- INP por rota com threshold line em 200ms
- CLS por rota com threshold line em 0.1

### Linha 3: Erros e Falhas (Time Series + Table)

- Time Series: erros JavaScript por tipo ao longo do tempo
- Time Series: falhas de API (do ponto de vista do usuário) por endpoint
- Table: top 10 erros por frequência (error_type, route, count)

### Linha 4: UX Intelligence (Bar Chart + Time Series)

- Bar Chart: cliques médios por tipo de tarefa (comparar semana atual vs anterior)
- Time Series: taxa de abandono de fluxo por tipo de fluxo
- Time Series: override de recomendação AI por tipo de recomendação

### Linha 5: Correlação com Backend (Time Series)

- Comparação: latência API no backend (Prometheus) vs. latência percebida pelo usuário (velya_web_api_request_duration_seconds)
- Diferença entre essas duas medições indica overhead de rede ou processamento no browser

---

## 7. Plano de Implementação

### Fase 1 — Semana 1 (mínimo viável)

1. Instalar `web-vitals` library: `npm install web-vitals`
2. Criar `src/lib/metrics.ts` com funções de envio OTLP
3. Implementar `initWebVitals()` e chamar em `layout.tsx`
4. Implementar `VelyaErrorBoundary` e envolver rotas clínicas
5. Adicionar `global-error-handler.ts` ao `layout.tsx`

### Fase 2 — Semana 2 (instrumentação manual)

1. Implementar fetch interceptor para métricas de API
2. Adicionar `trackTaskClick` nos componentes de ação clínica
3. Implementar abandono de fluxo no DischargeWizard e HandoffWizard
4. Implementar DegradedModeBanner com métrica

### Fase 3 — Semana 3 (dashboards e alertas)

1. Criar dashboard `velya-frontend-experience-overview` no Grafana
2. Criar dashboard `velya-frontend-action-failure-board`
3. Configurar alertas FRONT-001 a FRONT-005
4. Configurar Data Links: click em erro → Loki com filtro de error_type e route
