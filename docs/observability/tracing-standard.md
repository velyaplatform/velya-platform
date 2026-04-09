# Padrão de Distributed Tracing — Velya Platform

> Distributed tracing permite rastrear o caminho completo de uma requisição através de múltiplos serviços.
> Em ambiente hospitalar, isso é essencial para entender o fluxo de decisões clínicas.
> Última atualização: 2026-04-08

---

## 1. Estado Atual

| Componente             | Estado               | Detalhe                                                                      |
| ---------------------- | -------------------- | ---------------------------------------------------------------------------- |
| OTel Collector         | Instalado            | Rodando em velya-dev-observability, mas sem exportador de traces configurado |
| Grafana Tempo          | **NÃO instalado**    | Tracing end-to-end não está funcionando                                      |
| Instrumentação NestJS  | **NÃO implementada** | Nenhum serviço envia traces                                                  |
| Instrumentação Next.js | **NÃO implementada** | Frontend invisível para tracing                                              |
| Propagação via NATS    | **NÃO implementada** | trace_id não é propagado por mensagens assíncronas                           |

**Consequência atual**: O campo `trace_id` existe nos logs (schema definido) mas não há traces no backend. Não é possível correlacionar logs com spans distribuídos. Fluxos end-to-end como discharge workflow são completamente opacos.

---

## 2. Objetivo do Distributed Tracing na Velya

### 2.1 Fluxos que devem ser rastreados

**Fluxo clínico de alta**:

```
velya-web (Next.js)
  → api-gateway (roteamento)
    → discharge-orchestrator (validação e orquestração)
      → patient-flow-service (verificação de status)
      → task-inbox-service (criação de tarefas de checklist)
      → ai-gateway (análise do caso)
        → Claude API (inferência)
      → decision-log (registro da decisão)
        → PostgreSQL (persistência)
```

**Objetivo**: Um trace único cobrindo do clique do usuário até a confirmação de alta, com latência de cada etapa identificável.

### 2.2 Outros fluxos prioritários

- `velya-web → api-gateway → task-inbox-service` — criação e atribuição de tarefa
- `Temporal worker → agent → ai-gateway → Claude API` — execução de tarefa por agent
- `patient-flow-service → NATS → task-inbox-service` — evento assíncrono de movimentação de paciente
- `policy-engine → qualquer serviço` — avaliação de política sobre operação clínica

---

## 3. Plano de Implementação do Grafana Tempo

### 3.1 Passo 1: Instalar Grafana Tempo

```yaml
# infra/observability/tempo/values.yaml para Helm chart grafana/tempo-distributed
# Versão simplificada (monolithic) adequada para ambiente dev/staging

tempo:
  storage:
    trace:
      backend: local # Para prod: s3
      local:
        path: /var/tempo

persistence:
  enabled: true
  storageClassName: standard
  size: 10Gi

service:
  type: ClusterIP
  port: 3100

# Habilitar receptor OTLP gRPC e HTTP
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318
```

```bash
# Instalação
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
helm install tempo grafana/tempo \
  --namespace velya-dev-observability \
  --values infra/observability/tempo/values.yaml
```

### 3.2 Passo 2: Configurar OTel Collector para enviar traces ao Tempo

```yaml
# infra/observability/otel-collector/config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024

  # Sampling: 10% de tráfego normal, 100% de erros e fluxos clínicos
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: errors-policy
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: clinical-high-risk
        type: string_attribute
        string_attribute: { key: velya.risk_class, values: [high] }
      - name: probabilistic-sampling
        type: probabilistic
        probabilistic: { sampling_percentage: 10 }

exporters:
  otlp/tempo:
    endpoint: http://tempo.velya-dev-observability:4317
    tls:
      insecure: true

  prometheus:
    endpoint: '0.0.0.0:8889'

  loki:
    endpoint: http://loki.velya-dev-observability:3100/loki/api/v1/push

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, tail_sampling]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [loki]
```

### 3.3 Passo 3: Configurar datasource Tempo no Grafana

```yaml
# infra/observability/grafana/datasources/tempo.yaml
apiVersion: 1
datasources:
  - name: Tempo
    type: tempo
    url: http://tempo.velya-dev-observability:3100
    jsonData:
      tracesToLogs:
        datasourceUid: loki
        filterByTraceID: true
        filterBySpanID: true
        mapTagNamesEnabled: true
        mappedTags:
          - key: service.name
            value: service
      tracesToMetrics:
        datasourceUid: prometheus
        queries:
          - name: 'Error Rate'
            query: 'rate(http_requests_total{service="$${__tags.service}",status=~"5.."}[5m])'
      serviceMap:
        datasourceUid: prometheus
      search:
        hide: false
      nodeGraph:
        enabled: true
```

---

## 4. Instrumentação NestJS com OpenTelemetry

### 4.1 Dependências necessárias

```bash
npm install \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-grpc \
  @opentelemetry/semantic-conventions \
  @opentelemetry/api
```

### 4.2 Configuração do SDK OTel (arquivo de instrumentação)

```typescript
// src/instrumentation.ts — DEVE ser importado ANTES de qualquer outro módulo
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME || 'velya-service',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '0.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'dev',
    // Atributos customizados Velya
    'velya.namespace': process.env.POD_NAMESPACE || 'velya-dev-core',
    'velya.office': process.env.VELYA_OFFICE || 'unknown',
  }),
  traceExporter: new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      'http://otel-collector.velya-dev-observability:4317',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Instrumentação automática de HTTP (incoming e outgoing requests)
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingRequestHook: (req) => {
          // Não criar spans para health checks e métricas (reduz ruído)
          return req.url === '/health' || req.url === '/metrics';
        },
      },
      // Instrumentação automática de Express/NestJS
      '@opentelemetry/instrumentation-express': { enabled: true },
      // Instrumentação automática de PostgreSQL
      '@opentelemetry/instrumentation-pg': { enabled: true },
      // Instrumentação automática de Redis (se usado)
      '@opentelemetry/instrumentation-redis': { enabled: true },
    }),
  ],
});

sdk.start();

// Garantir shutdown limpo
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
});
```

```typescript
// src/main.ts — importar ANTES de tudo
import './instrumentation'; // deve ser a PRIMEIRA linha

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

### 4.3 Criação de spans customizados para operações clínicas

```typescript
// src/discharge/discharge.service.ts
import { trace, SpanStatusCode, context } from '@opentelemetry/api';

const tracer = trace.getTracer('discharge-orchestrator', '0.5.0');

@Injectable()
export class DischargeService {
  async initiateDischarge(patientId: string, workflowId: string): Promise<void> {
    // Criar span para operação clínica de alta
    return tracer.startActiveSpan(
      'discharge.initiate',
      {
        attributes: {
          // Atributos obrigatórios conforme padrão Velya
          'velya.patient_id': patientId, // tokenizado
          'velya.workflow_id': workflowId,
          'velya.risk_class': 'high',
          'velya.office': 'clinical-office',
          'velya.action': 'discharge.initiate',
        },
      },
      async (span) => {
        try {
          const blockers = await this.checkActiveBlockers(patientId);

          if (blockers.length > 0) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: 'DISCHARGE_BLOCKER_ACTIVE',
            });
            span.setAttributes({
              'velya.discharge.blocker_count': blockers.length,
              'velya.discharge.blocker_types': blockers.map((b) => b.type).join(','),
              'velya.outcome': 'failure',
            });
            return;
          }

          await this.processDischarge(patientId, workflowId);

          span.setAttributes({ 'velya.outcome': 'success' });
          span.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}
```

---

## 5. Instrumentação Next.js

### 5.1 Configuração via instrumentation.ts (App Router)

```typescript
// instrumentation.ts (na raiz do projeto Next.js)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } =
      await import('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { Resource } = await import('@opentelemetry/resources');
    const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');

    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'velya-web',
        [SemanticResourceAttributes.SERVICE_VERSION]:
          process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'dev',
      }),
      traceExporter: new OTLPTraceExporter({
        url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true },
        }),
      ],
    });

    sdk.start();
  }
}
```

### 5.2 Instrumentação de Web Vitals para browser

```typescript
// src/lib/web-vitals.ts
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

interface VitalsPayload {
  name: string;
  value: number;
  route: string;
  environment: string;
}

function sendVital(payload: VitalsPayload): void {
  // Enviar para OTel Collector via OTLP HTTP
  fetch(`${process.env.NEXT_PUBLIC_OTEL_ENDPOINT}/v1/metrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resourceMetrics: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'velya-web' } },
              { key: 'environment', value: { stringValue: process.env.NEXT_PUBLIC_ENV || 'dev' } },
            ],
          },
          scopeMetrics: [
            {
              metrics: [
                {
                  name: `velya_web_${payload.name.toLowerCase()}_${payload.name === 'CLS' ? 'score' : 'seconds'}`,
                  gauge: {
                    dataPoints: [
                      {
                        asDouble: payload.name === 'CLS' ? payload.value : payload.value / 1000,
                        attributes: [{ key: 'route', value: { stringValue: payload.route } }],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    }),
    keepalive: true, // importante para envio durante navegação
  }).catch(() => {
    // Falha silenciosa — nunca deixar observabilidade quebrar a UI
  });
}

// Registrar em _app.tsx ou layout.tsx
export function initWebVitals(route: string): void {
  const sendWithRoute = (metric: { name: string; value: number }) =>
    sendVital({ ...metric, route, environment: process.env.NEXT_PUBLIC_ENV || 'dev' });

  onLCP(sendWithRoute);
  onINP(sendWithRoute);
  onCLS(sendWithRoute);
  onFCP(sendWithRoute);
  onTTFB(sendWithRoute);
}
```

---

## 6. Propagação de trace_id via NATS

### 6.1 O Problema

Quando um serviço publica uma mensagem no NATS e outro serviço a consome, o trace_id não é propagado automaticamente. Isso cria uma quebra no trace distribuído.

### 6.2 Solução: W3C TraceContext em headers NATS

```typescript
// src/messaging/nats-trace-propagator.ts
import { propagation, context, trace, ROOT_CONTEXT } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { JsMsg, NatsConnection } from 'nats';

const propagator = new W3CTraceContextPropagator();

// AO PUBLICAR: injetar contexto de trace nos headers da mensagem
export function publishWithTrace(nc: NatsConnection, subject: string, payload: Uint8Array): void {
  const headers: Record<string, string> = {};

  // Injetar trace context nos headers
  propagator.inject(context.active(), headers, {
    set: (carrier, key, value) => {
      carrier[key] = value;
    },
  });

  // headers contém agora: 'traceparent' e opcionalmente 'tracestate'
  const natsHeaders = nc.headers();
  Object.entries(headers).forEach(([key, value]) => {
    natsHeaders.set(key, value);
  });

  nc.publish(subject, payload, { headers: natsHeaders });
}

// AO CONSUMIR: extrair contexto de trace dos headers da mensagem
export function extractTraceFromMessage(msg: JsMsg): ReturnType<typeof context.active> {
  const headers: Record<string, string> = {};

  // Extrair headers NATS para objeto simples
  if (msg.headers) {
    for (const [key] of msg.headers) {
      headers[key] = msg.headers.get(key) || '';
    }
  }

  // Restaurar contexto de trace a partir dos headers
  return propagator.extract(ROOT_CONTEXT, headers, {
    get: (carrier, key) => carrier[key],
    keys: (carrier) => Object.keys(carrier),
  });
}

// Uso em consumer:
async function handleDischargeRequested(msg: JsMsg): Promise<void> {
  const traceContext = extractTraceFromMessage(msg);

  // Executar handler dentro do contexto de trace propagado
  await context.with(traceContext, async () => {
    const tracer = trace.getTracer('task-inbox-service');
    return tracer.startActiveSpan('nats.consume.discharge.requested', async (span) => {
      try {
        const payload = JSON.parse(new TextDecoder().decode(msg.data));
        await processDischargeRequest(payload);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        throw error;
      } finally {
        span.end();
        msg.ack();
      }
    });
  });
}
```

---

## 7. Atributos Obrigatórios em Spans Velya

### 7.1 Atributos padrão (todos os spans)

| Atributo OTel            | Valor                    | Fonte           |
| ------------------------ | ------------------------ | --------------- |
| `service.name`           | `discharge-orchestrator` | Resource do SDK |
| `service.version`        | `0.5.0`                  | Resource do SDK |
| `deployment.environment` | `dev`                    | Resource do SDK |

### 7.2 Atributos customizados Velya (quando aplicável)

| Atributo            | Tipo                | Quando incluir                              |
| ------------------- | ------------------- | ------------------------------------------- |
| `velya.office`      | string              | Em spans de agents e serviços com office    |
| `velya.agent_name`  | string              | Em spans de execução de agent               |
| `velya.risk_class`  | string              | Em spans de operações clínicas              |
| `velya.patient_id`  | string (tokenizado) | Em spans que operam sobre dados de paciente |
| `velya.workflow_id` | string              | Em spans dentro de workflow Temporal        |
| `velya.action`      | string              | Em spans de ações de negócio                |
| `velya.outcome`     | string              | Ao final do span (success/failure/partial)  |

**Restrição de PHI em spans**: Da mesma forma que logs, nunca incluir nome, CPF, data de nascimento ou diagnóstico clínico em atributos de span. Apenas identificadores tokenizados.

---

## 8. Sampling Strategy

### 8.1 Racional

Rastrear 100% das requisições seria custoso em termos de storage e processamento. A estratégia de sampling define quais traces são preservados.

### 8.2 Política de Sampling (Tail-based no OTel Collector)

| Condição                           | Taxa de Sampling | Justificativa                                |
| ---------------------------------- | ---------------- | -------------------------------------------- |
| Span com erro (`status=ERROR`)     | 100%             | Erros sempre devem ser investigáveis         |
| `velya.risk_class=high`            | 100%             | Operações clínicas críticas nunca amostradas |
| Span com duração > 5s              | 100%             | Latência anormal deve ser investigável       |
| `velya.action=~"discharge.*"`      | 100%             | Fluxo de alta é crítico                      |
| `velya.action=~"clinical.alert.*"` | 100%             | Alertas clínicos sempre rastreados           |
| Tráfego normal (sem os acima)      | 10%              | Custo controlado                             |

### 8.3 Configuração no OTel Collector (tail sampling)

Já incluída na seção 3.2. O tail-based sampling ocorre após coletar todos os spans de um trace, permitindo decisões baseadas em qualquer span (incluindo spans filho com erros).

---

## 9. Correlação Logs ↔ Traces

### 9.1 Injeção automática de trace_id em logs

Quando o SDK OTel está ativo, o `trace_id` e `span_id` estão disponíveis via API:

```typescript
// src/logger/velya-logger.service.ts — adicionar ao método write()
import { trace, context } from '@opentelemetry/api';

private write(level: string, message: string, extra?: Record<string, unknown>): void {
  const span = trace.getActiveSpan();
  const traceContext = span ? span.spanContext() : null;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    ...this.baseContext,
    // Injetar trace_id e span_id automaticamente se há span ativo
    ...(traceContext && {
      trace_id: traceContext.traceId,
      span_id: traceContext.spanId,
    }),
    message,
    ...extra,
  };

  process.stdout.write(JSON.stringify(entry) + '\n');
}
```

**Resultado**: Todo log gerado dentro de um span HTTP automaticamente contém `trace_id` e `span_id`, permitindo navegar do log para o trace no Grafana Explore.

---

## 10. Quando Tracing Estiver Implementado: Fluxos de Investigação

### Cenário: Latência alta no discharge workflow

1. Abrir dashboard `velya-backend-api-red` → identificar spike de P99 no `discharge-orchestrator`
2. Clicar no ponto de spike → Data link abre Explore com Tempo
3. Buscar traces do `discharge-orchestrator` no período do spike com duração > 2s
4. Clicar no trace mais lento → visualizar waterfall de spans
5. Identificar qual span filho (ex.: `ai-gateway` → Claude API) está lento
6. Clicar no span → Data link abre logs do período com `trace_id` filtrado
7. Ler os logs para contexto completo da operação

### Cenário: Erro em workflow clínico

1. Alerta `BACK-002: ServiceCriticalErrorRate` dispara no Slack
2. Clicar no link do alerta → abre Grafana Alerting com contexto
3. Clicar em "View in Explore" → Loki mostrando logs de erro
4. Copiar `trace_id` de um log de erro
5. Abrir datasource Tempo → buscar por `trace_id`
6. Visualizar onde exatamente o erro ocorreu na cadeia de chamadas
