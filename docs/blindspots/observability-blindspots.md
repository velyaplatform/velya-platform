# Pontos Cegos de Observabilidade — Velya Platform

> **Versão**: 1.0 | **Atualizado em**: 2026-04-08 | **Dono**: Plataforma e Engenharia  
> **Propósito**: Mapeamento do que não está sendo monitorado atualmente — gaps de métricas, logs, traces e alertas que deixam partes críticas da plataforma em zona de cegueira operacional.

---

## Stack Atual de Observabilidade

| Componente         | Função                             | Status                                                   |
| ------------------ | ---------------------------------- | -------------------------------------------------------- |
| Prometheus         | Coleta e armazenamento de métricas | Instalado, sem ServiceMonitors para serviços Velya       |
| Grafana            | Visualização e alertas             | Instalado, apenas via port-forward, sem dashboards Velya |
| Loki + Promtail    | Coleta e armazenamento de logs     | Instalado, sem retenção configurada                      |
| OTel Collector     | Pipeline de telemetria             | Instalado, sem filtering de PHI, 100% sampling           |
| Alertmanager       | Roteamento de alertas              | Instalado, sem receivers configurados                    |
| kube-state-metrics | Métricas de cluster Kubernetes     | Funcionando                                              |
| node-exporter      | Métricas de nós                    | Funcionando                                              |

---

## Seção 1 — Métricas Não Coletadas

### OBS-GAP-001 — Sem ServiceMonitors para Serviços Velya

**Serviços afetados**: patient-flow-service, task-inbox-service, discharge-orchestrator, api-gateway, velya-web, ai-gateway, decision-log-service, memory-service, policy-engine

**O que falta**: Cada serviço NestJS deve expor endpoint `/metrics` no formato Prometheus e ter um ServiceMonitor associado. Sem isso, o Prometheus não sabe que deve coletar métricas desses serviços.

**O que falha sem isso**: Degradação de qualquer serviço clínico não é detectada automaticamente. Um serviço com latência 10x acima do normal continua "invisível" para o Prometheus. O único sinal seria reclamação de usuário.

**Implementação necessária**:

```typescript
// NestJS: adicionar PrometheusModule a cada serviço
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
        config: {},
      },
    }),
  ],
})
export class AppModule {}
```

```yaml
# Kubernetes ServiceMonitor para patient-flow-service
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: patient-flow-service
  namespace: velya-dev-core
  labels:
    app: patient-flow-service
spec:
  selector:
    matchLabels:
      app: patient-flow-service
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
```

**Prioridade**: Crítica — sem isso, nenhuma métrica de aplicação está sendo coletada.

---

### OBS-GAP-002 — Sem Métricas de Negócio (Clinical Business Metrics)

**Métricas ausentes**:

| Métrica                            | Descrição                              | Por que importa                                    |
| ---------------------------------- | -------------------------------------- | -------------------------------------------------- |
| `velya_discharge_time_hours`       | Tempo médio entre admissão e alta      | Indicador principal de eficiência operacional      |
| `velya_discharge_blockers_active`  | Bloqueadores de alta ativos por tipo   | Identifica gargalos sistêmicos no processo de alta |
| `velya_task_inbox_overload_rate`   | Taxa de tasks que excedem SLA          | Indica subdimensionamento da equipe ou do sistema  |
| `velya_patient_length_of_stay_p95` | P95 de tempo de permanência            | Identifica outliers de permanência prolongada      |
| `velya_bed_occupancy_rate`         | Taxa de ocupação de leitos por unidade | Pressão operacional da unidade                     |
| `velya_discharge_ai_override_rate` | Taxa de override de recomendação AI    | Indicador de automation bias ou qualidade da AI    |

**O que falha sem isso**: A liderança não sabe se a plataforma está gerando valor clínico real. Não é possível demonstrar ROI. Gargalos sistêmicos são invisíveis.

**Implementação necessária**:

```typescript
// Em discharge-orchestrator: registrar métrica ao finalizar alta
import { Counter, Histogram } from '@willsoto/nestjs-prometheus';

@Injectable()
export class DischargeMetricsService {
  constructor(
    @InjectMetric('velya_discharge_time_hours')
    private readonly dischargeTime: Histogram<string>,
  ) {}

  recordDischarge(startTime: Date, endTime: Date, unit: string) {
    const durationHours = (endTime.getTime() - startTime.getTime()) / 3_600_000;
    this.dischargeTime.observe({ unit }, durationHours);
  }
}
```

---

### OBS-GAP-003 — Sem Métricas de Qualidade de AI

**Métricas ausentes**:

| Métrica                                        | Descrição                                     |
| ---------------------------------------------- | --------------------------------------------- |
| `ai_gateway_request_duration_seconds`          | Histograma de latência por modelo             |
| `ai_gateway_input_tokens_total`                | Total de tokens de entrada por agent          |
| `ai_gateway_output_tokens_total`               | Total de tokens de saída por agent            |
| `ai_gateway_inference_cost_usd_total`          | Custo estimado em dólares por agent           |
| `ai_gateway_confidence_score_distribution`     | Distribuição de confiança por tipo de task    |
| `ai_gateway_error_rate`                        | Taxa de erros por model/provider              |
| `ai_gateway_cache_hit_rate`                    | Taxa de cache hit para redução de custo       |
| `ai_discharge_recommendation_accepted_total`   | Total de recomendações de alta aceitas        |
| `ai_discharge_recommendation_overridden_total` | Total de recomendações overridden por clínico |

**O que falha sem isso**: Impossível saber se o AI está performando bem. Custo de AI invisível até a fatura do mês. Degradação de qualidade de modelo não detectada.

---

### OBS-GAP-004 — Sem Métricas de Agent Runtime

**Métricas ausentes**:

| Métrica                             | Descrição                                    |
| ----------------------------------- | -------------------------------------------- |
| `velya_agent_task_throughput`       | Tasks processadas por agent por hora         |
| `velya_agent_validation_pass_rate`  | Taxa de aprovação pelo validator por agent   |
| `velya_agent_correction_loop_count` | Número de loops de autocorreção por task     |
| `velya_agent_escalation_rate`       | Taxa de escalação para humano por agent      |
| `velya_agent_shadow_accuracy`       | Acurácia em shadow mode (vs. decisão humana) |
| `velya_agent_handoff_latency`       | Latência de handoff entre agents             |

**O que falha sem isso**: Governança de agents é cega. Impossível detectar agent em loop, validator carimbando, ou throughput de office colapsando.

---

### OBS-GAP-005 — Sem Métricas de Custo por Componente

**Métricas ausentes**:

| Métrica                           | Descrição                                   |
| --------------------------------- | ------------------------------------------- |
| `velya_inference_cost_usd_daily`  | Custo diário de inferência AI               |
| `velya_keda_scaling_events_total` | Eventos de scaling do KEDA (detecta thrash) |
| `velya_pod_idle_ratio`            | Proporção de pods ociosos vs. ativos        |

**O que falha sem isso**: Explosão de custo não detectada até fatura do mês. KEDA thrash invisível.

---

### OBS-GAP-006 — Sem Instrumentação do Frontend (RUM/Core Web Vitals)

**Métricas ausentes**:

- Largest Contentful Paint (LCP) por página
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)
- JavaScript error rate no browser
- Time to Interactive por dispositivo
- API response time percebido pelo usuário (diferente do medido no servidor)

**O que falha sem isso**: Impossível saber como a UI performa em dispositivos reais do hospital. Um problema de performance que aparece apenas em tablets antigos é invisível nos testes de desenvolvimento.

**Implementação necessária**:

```typescript
// Next.js: adicionar OTel Web ou Sentry para RUM
// next.config.ts
import { withSentryConfig } from '@sentry/nextjs';

// reportWebVitals em _app.tsx
export function reportWebVitals(metric: NextWebVitalsMetric) {
  const body = JSON.stringify(metric);
  navigator.sendBeacon('/api/vitals', body);
}
```

---

## Seção 2 — Logs Não Estruturados e Gaps de Correlação

### OBS-GAP-007 — Serviços NestJS Sem Log JSON Estruturado

**Situação atual**: Alguns serviços usam `console.log()` ou logger padrão do NestJS sem formatação JSON. Logs ficam em formato de texto livre, impossibilitando query estruturada no Loki e correlação automática.

**O que falha sem isso**:

- Queries no Loki baseadas em campos (ex: `{service="patient-flow"} | json | status_code = "500"`) não funcionam
- Correlação automática de logs com traces (via trace_id) impossível

**Regra violada**: `CLAUDE.md` Non-Negotiable #8: "Structured logging only. JSON logs with OpenTelemetry correlation."

**Implementação necessária**:

```typescript
// Configuração correta do logger NestJS
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

WinstonModule.createLogger({
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: {
    service: 'patient-flow-service',
    environment: process.env.NODE_ENV,
  },
});
```

---

### OBS-GAP-008 — Sem Correlação de trace_id nos Logs

**Situação atual**: Logs não incluem `trace_id` e `span_id`. Impossível correlacionar um log de erro com o trace correspondente.

**O que falha sem isso**: Durante incidente, o respondedor tem logs e traces mas não consegue conectá-los. Tempo de diagnóstico aumenta 5-10x.

**Implementação necessária**:

```typescript
// Middleware NestJS para injetar trace context nos logs
import { Injectable, NestMiddleware } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

@Injectable()
export class TraceContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: Function) {
    const span = trace.getActiveSpan();
    if (span) {
      const { traceId, spanId } = span.spanContext();
      // Injetar no logger via AsyncLocalStorage
      logger.setContext({ traceId, spanId });
    }
    next();
  }
}
```

---

### OBS-GAP-009 — Sem Correlação de trace_id Através do NATS

**Situação atual**: Quando um request HTTP trigger uma publicação no NATS, o trace_id não é propagado no header da mensagem NATS. O trace "para" na fronteira HTTP→NATS.

**O que falha sem isso**: Impossível rastrear um request de alta do usuário até o evento NATS que disparou o workflow de alta.

**Implementação necessária**:

```typescript
// Publicar com trace context no header NATS
import { propagation, context } from '@opentelemetry/api';

async publish(subject: string, payload: object) {
  const headers = headers();
  propagation.inject(context.active(), headers, {
    set: (carrier, key, value) => carrier.set(key, value)
  });

  await js.publish(subject, JSON.stringify(payload), { headers });
}
```

---

## Seção 3 — Traces Ausentes

### OBS-GAP-010 — Sem Tracing End-to-End

**Pipeline atual sem trace**:

```
Browser (velya-web)
    ↓ [SEM TRACE]
API Gateway
    ↓ [TRACE COMEÇA AQUI — mas sem correlação com browser]
patient-flow-service
    ↓ [TRACE PROPAGA — se configurado]
PostgreSQL
    ↑ [TRACE TERMINA AQUI]
NATS JetStream
    ↓ [SEM TRACE — fronteira de propagação]
discharge-orchestrator
    ↑ [NOVO TRACE — sem correlação com o anterior]
```

**O que falha sem isso**: Impossível diagnosticar latência end-to-end. "Por que a alta está demorando 30 segundos?" não tem resposta sem trace completo.

---

### OBS-GAP-011 — Sem Tracing no AI Gateway

**Situação atual**: Chamadas ao Anthropic API não geram spans OTel. As métricas de latência, tokens, e custo de AI são invisíveis na stack de observabilidade.

**O que falha sem isso**:

- "Por que a recomendação de AI demorou 20 segundos?" não tem resposta
- Impossível identificar qual tipo de prompt é mais caro
- Impossível detectar degradação gradual de latência do provider

**Implementação necessária**:

```typescript
// ai-gateway: instrumentar chamadas ao Anthropic
const tracer = trace.getTracer('ai-gateway');

async callAnthropic(request: AnthropicRequest): Promise<AnthropicResponse> {
  return tracer.startActiveSpan('anthropic.messages.create', async (span) => {
    span.setAttribute('ai.model', request.model);
    span.setAttribute('ai.input_tokens', estimateTokens(request.messages));

    try {
      const response = await anthropic.messages.create(request);
      span.setAttribute('ai.output_tokens', response.usage.output_tokens);
      span.setAttribute('ai.stop_reason', response.stop_reason);
      return response;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

---

## Seção 4 — Alertas Sem Runbook e Sem Receiver

### OBS-GAP-012 — Alertmanager Sem Receivers Configurados

**Situação atual**: PrometheusRules definem alertas `VelyaServiceDown` e `VelyaHighCPU`, mas o Alertmanager não tem receivers (Slack, PagerDuty, email) configurados.

**O que falha sem isso**: Alertas disparam mas nunca chegam a ninguém. A infraestrutura de alertas é completamente inoperante.

**Implementação necessária**:

```yaml
# alertmanager-config.yaml
global:
  slack_api_url: 'https://hooks.slack.com/services/xxx/yyy/zzz'

route:
  group_by: ['alertname', 'namespace']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
  receiver: 'slack-critical'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-oncall'

receivers:
  - name: 'slack-critical'
    slack_configs:
      - channel: '#velya-alerts'
        title: '{{ .CommonAnnotations.summary }}'
        text: '{{ .CommonAnnotations.description }}'

  - name: 'pagerduty-oncall'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_KEY}'
```

**Prioridade**: Crítica — sem isso, zero alertas chegam a qualquer pessoa.

---

### OBS-GAP-013 — Alertas Sem Link para Runbook

**Situação atual**: PrometheusRules não têm `annotations.runbook_url`. Em incidente, o respondedor recebe um alerta mas não sabe o que fazer.

**Implementação necessária**:

```yaml
groups:
  - name: velya.services
    rules:
      - alert: VelyaServiceDown
        expr: up{job=~"velya-.*"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'Serviço Velya fora do ar: {{ $labels.job }}'
          description: 'O serviço {{ $labels.job }} no namespace {{ $labels.namespace }} está down por mais de 2 minutos.'
          runbook_url: 'https://github.com/velya/velya-platform/blob/main/docs/runbooks/service-down.md'
```

---

## Seção 5 — Dashboards Ausentes

### OBS-GAP-014 — Grafana Sem Dashboards de Serviços Velya

**Dashboards ausentes (todos)**:

| Dashboard                     | Audiência            | Métricas Chave                                                     |
| ----------------------------- | -------------------- | ------------------------------------------------------------------ |
| **Overview da Plataforma**    | Engenharia/Operações | Saúde de todos os serviços, error rate, latência p95               |
| **Operações Clínicas**        | Gestão Hospitalar    | Tempo médio de alta, bloqueadores ativos, ocupação de leitos       |
| **AI e Agents**               | Engenharia/Produto   | Latência de AI, custo por request, override rate, agent throughput |
| **Infraestrutura Kubernetes** | SRE                  | CPU/Memória por namespace, KEDA scaling events, pod restarts       |
| **Dados e Fluxos NATS**       | Backend/SRE          | Consumer lag por stream, throughput, dead-letter queue size        |
| **Custo**                     | Produto/Liderança    | Custo de AI diário, custo de infra, tendência mensal               |

**O que falha sem isso**: Em incidente, o respondedor não tem ponto de partida visual. Diagnóstico é feito cegamente via CLI.

---

### OBS-GAP-015 — Grafana Acessível Apenas via Port-Forward

**Situação atual**: Grafana não tem Ingress configurado. Para acessar, é necessário executar:

```bash
kubectl port-forward -n velya-dev-observability svc/grafana 3000:80
```

**O que falha sem isso**: Durante incidente, o respondedor perde tempo configurando port-forward. Em cenário onde o respondedor não tem o contexto do cluster configurado (acesso remoto, novo membro da equipe), pode ser impossível acessar os dashboards.

**Implementação necessária**:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grafana-ingress
  namespace: velya-dev-observability
  annotations:
    nginx.ingress.kubernetes.io/service-upstream: 'true'
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: grafana-basic-auth
spec:
  rules:
    - host: grafana.172.19.0.6.nip.io
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: grafana
                port:
                  number: 80
```

---

## Resumo de Gaps por Prioridade

### Prioridade Crítica (bloqueia operação segura)

| Gap                                     | Impacto                      | Prazo    |
| --------------------------------------- | ---------------------------- | -------- |
| OBS-GAP-001: Sem ServiceMonitors        | Zero métricas de aplicação   | 7 dias   |
| OBS-GAP-012: Alertmanager sem receivers | Alertas não chegam a ninguém | Imediato |
| OBS-GAP-011: Sem tracing no AI Gateway  | AI completamente opaco       | 14 dias  |

### Prioridade Alta (necessário para diagnóstico efetivo)

| Gap                                    | Impacto                                 | Prazo   |
| -------------------------------------- | --------------------------------------- | ------- |
| OBS-GAP-007: Logs sem JSON estruturado | Query de logs inoperante                | 14 dias |
| OBS-GAP-008: Sem trace_id nos logs     | Correlação log-trace impossível         | 14 dias |
| OBS-GAP-015: Grafana sem ingress       | Acesso ao monitoramento manual          | 7 dias  |
| OBS-GAP-013: Alertas sem runbook       | Respondedor sem orientação em incidente | 14 dias |
| OBS-GAP-014: Sem dashboards Velya      | Diagnóstico visual impossível           | 30 dias |

### Prioridade Média (necessário para maturidade operacional)

| Gap                                  | Impacto                               | Prazo   |
| ------------------------------------ | ------------------------------------- | ------- |
| OBS-GAP-002: Sem métricas de negócio | Sem visibilidade de valor clínico     | 45 dias |
| OBS-GAP-003: Sem métricas de AI      | Qualidade e custo de AI invisíveis    | 30 dias |
| OBS-GAP-004: Sem métricas de agents  | Governança de agents cega             | 45 dias |
| OBS-GAP-009: Sem trace via NATS      | Rastreabilidade incompleta            | 30 dias |
| OBS-GAP-010: Sem trace end-to-end    | Diagnóstico de latência difícil       | 45 dias |
| OBS-GAP-006: Sem RUM frontend        | Performance real do usuário invisível | 60 dias |
| OBS-GAP-005: Sem métricas de custo   | Explosão de custo não detectada       | 30 dias |

> **Estado atual**: A plataforma Velya está operando com observabilidade de infraestrutura básica (kube-state-metrics, node-exporter) mas zero observabilidade de aplicação. Em um incidente de produção hoje, o time não teria dados suficientes para diagnosticar a causa raiz de nenhum problema de nível de serviço.
