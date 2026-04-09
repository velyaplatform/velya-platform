# Padrão de Logging Estruturado — Velya Platform

> Todo log relevante deve ser estruturado, em JSON, com os campos definidos neste documento.
> Logs são a única fonte de contexto durante incidentes quando traces não estão disponíveis.
> Última atualização: 2026-04-08

---

## 1. Schema Canônico do Log

Todo evento de log relevante deve conter os seguintes campos:

```json
{
  "timestamp": "2026-04-08T14:32:01.123Z",
  "level": "info",
  "service": "discharge-orchestrator",
  "namespace": "velya-dev-core",
  "version": "0.5.0",
  "environment": "dev",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "request_id": "req-8a7b3c2d-1e4f-4a5b-9c8d-7e6f5a4b3c2d",
  "workflow_id": "wf-discharge-PAT-001-2026-04-08",
  "office": "clinical-office",
  "agent_name": "discharge-coordinator-agent",
  "event_type": "patient.discharge.requested",
  "action": "discharge.initiate",
  "outcome": "failure",
  "duration_ms": 234,
  "error_code": "DISCHARGE_BLOCKER_ACTIVE",
  "error_class": "clinical.blocker",
  "retry_count": 0,
  "risk_class": "high",
  "message": "Tentativa de alta bloqueada por pendência médica ativa"
}
```

### 1.1 Campos Obrigatórios (todos os logs)

| Campo         | Tipo            | Valores válidos                                           | Nunca omitir |
| ------------- | --------------- | --------------------------------------------------------- | ------------ |
| `timestamp`   | ISO 8601 com ms | `2026-04-08T14:32:01.123Z`                                | Sempre       |
| `level`       | enum            | `debug`, `info`, `warn`, `error`                          | Sempre       |
| `service`     | string          | Nome do serviço (sem sufixo -service em logs, padronizar) | Sempre       |
| `namespace`   | string          | `velya-dev-core`, `velya-dev-platform`, etc.              | Sempre       |
| `version`     | semver          | `0.5.0`                                                   | Sempre       |
| `environment` | enum            | `dev`, `staging`, `prod`                                  | Sempre       |
| `message`     | string          | Texto legível por humanos, em português                   | Sempre       |

### 1.2 Campos Obrigatórios para Eventos de Negócio

| Campo         | Tipo                                   | Quando incluir                                 |
| ------------- | -------------------------------------- | ---------------------------------------------- |
| `event_type`  | string                                 | Qualquer evento de domínio (não logs técnicos) |
| `action`      | string                                 | Quando uma ação específica é executada         |
| `outcome`     | enum (`success`, `failure`, `partial`) | Sempre que há outcome de ação                  |
| `risk_class`  | enum (`high`, `medium`, `low`)         | Para operações sobre dados clínicos            |
| `workflow_id` | string                                 | Para qualquer operação dentro de um workflow   |

### 1.3 Campos de Correlação (obrigatórios quando disponíveis)

| Campo        | Tipo                  | Fonte                             | Propósito                      |
| ------------ | --------------------- | --------------------------------- | ------------------------------ |
| `trace_id`   | hex string (32 chars) | OTel propagation                  | Correlação com traces          |
| `span_id`    | hex string (16 chars) | OTel propagation                  | Correlação com span específico |
| `request_id` | UUID                  | Gerado no api-gateway e propagado | Rastrear request HTTP          |
| `office`     | string                | Contexto do agent                 | Filtragem por office           |
| `agent_name` | string                | Contexto do agent                 | Identificar agent responsável  |

### 1.4 Campos para Erros

| Campo         | Tipo   | Exemplo                                                             | Quando incluir                 |
| ------------- | ------ | ------------------------------------------------------------------- | ------------------------------ |
| `error_code`  | string | `DISCHARGE_BLOCKER_ACTIVE`                                          | Sempre que há erro             |
| `error_class` | string | `clinical.blocker`, `infrastructure.timeout`, `validation.rejected` | Sempre que há erro             |
| `retry_count` | int    | `0`, `1`, `2`                                                       | Quando há retry logic          |
| `duration_ms` | int    | `234`                                                               | Em eventos de ação com duração |

---

## 2. Regras Absolutas de PHI e Segurança

### 2.1 O que NUNCA logar

**Dados de identificação direta do paciente**:

```typescript
// ERRADO — Nunca fazer isso
this.logger.info(`Patient John Doe (DOB: 1980-01-01, CPF: 123.456.789-00) admitted to ICU`);
this.logger.error(`Discharge blocked for Maria Santos, bed 42, ward B`);

// CORRETO — Identificadores tokenizados apenas
this.logger.info('Paciente admitido', { patient_id: 'PAT-001', unit: 'UTI', bed_id: 'BED-042' });
this.logger.error('Alta bloqueada', {
  patient_id: 'PAT-001',
  error_code: 'DISCHARGE_BLOCKER_ACTIVE',
});
```

**Secrets e credenciais**:

```typescript
// ERRADO — Nunca logar tokens, senhas ou chaves
this.logger.debug(`Connecting to DB with password: ${dbPassword}`);
this.logger.info(`Using API key: ${apiKey}`);
this.logger.error(`Auth failed for token: ${bearerToken}`);

// CORRETO — Nunca incluir o valor de credenciais
this.logger.debug('Conectando ao banco de dados', { host: dbHost, port: dbPort });
this.logger.error('Falha de autenticação', {
  error_code: 'AUTH_INVALID_TOKEN',
  service: 'ai-gateway',
});
```

**Payloads completos sem necessidade**:

```typescript
// ERRADO — Logar corpo completo da requisição
this.logger.debug('Request recebido', { body: request.body }); // pode ter PHI ou dados grandes

// CORRETO — Logar apenas campos relevantes e seguros
this.logger.debug('Request recebido', {
  method: request.method,
  route: request.route.path,
  patient_id: request.body.patient_id, // apenas o ID, não dados clínicos
  action: request.body.action,
});
```

**console.log em qualquer ambiente que não seja desenvolvimento local**:

```typescript
// ERRADO — Nunca usar em produção ou staging
console.log('discharge initiated');
console.error('something broke:', error);

// CORRETO — Usar o logger estruturado sempre
this.logger.info('Alta iniciada', { workflow_id, patient_id, action: 'discharge.initiate' });
this.logger.error('Erro no processamento', { error_code: error.code, message: error.message });
```

### 2.2 Identificadores permitidos em logs

| Campo                       | Permitido        | Exemplo                     |
| --------------------------- | ---------------- | --------------------------- |
| `patient_id`                | Sim — tokenizado | `PAT-001`, `PAT-2024-00123` |
| `visit_id`                  | Sim — tokenizado | `VST-20240408-001`          |
| `bed_id`                    | Sim — não é PHI  | `BED-UTI-42`                |
| `unit`                      | Sim — não é PHI  | `UTI`, `Enfermaria-A`       |
| `provider_id`               | Sim — tokenizado | `PROV-123`                  |
| Nome do paciente            | **Nunca**        | —                           |
| CPF, RG, data de nascimento | **Nunca**        | —                           |
| Diagnóstico clínico         | **Nunca**        | —                           |
| Dados de contato            | **Nunca**        | —                           |

---

## 3. Padrão de Implementação NestJS

### 3.1 Configuração do Logger

```typescript
// src/logger/velya-logger.service.ts
import { Injectable, LoggerService, Scope } from '@nestjs/common';

interface VelyaLogContext {
  service: string;
  namespace: string;
  version: string;
  environment: string;
  trace_id?: string;
  span_id?: string;
  request_id?: string;
  workflow_id?: string;
  office?: string;
  agent_name?: string;
}

interface VelyaLogEntry extends VelyaLogContext {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  event_type?: string;
  action?: string;
  outcome?: 'success' | 'failure' | 'partial';
  duration_ms?: number;
  error_code?: string;
  error_class?: string;
  retry_count?: number;
  risk_class?: 'high' | 'medium' | 'low';
  message: string;
  [key: string]: unknown;
}

@Injectable()
export class VelyaLoggerService implements LoggerService {
  private baseContext: VelyaLogContext;

  constructor(context: VelyaLogContext) {
    this.baseContext = context;
  }

  private write(
    level: VelyaLogEntry['level'],
    message: string,
    extra?: Record<string, unknown>,
  ): void {
    // Em produção, DEBUG nunca é escrito
    if (level === 'debug' && process.env.NODE_ENV === 'production') {
      return;
    }

    const entry: VelyaLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      ...this.baseContext,
      message,
      ...extra,
    };

    // Escreve JSON para stdout — Promtail captura e envia para Loki
    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  log(message: string, extra?: Record<string, unknown>): void {
    this.write('info', message, extra);
  }

  info(message: string, extra?: Record<string, unknown>): void {
    this.write('info', message, extra);
  }

  warn(message: string, extra?: Record<string, unknown>): void {
    this.write('warn', message, extra);
  }

  error(message: string, extra?: Record<string, unknown>): void {
    this.write('error', message, extra);
  }

  debug(message: string, extra?: Record<string, unknown>): void {
    this.write('debug', message, extra);
  }

  // Método de conveniência para eventos de negócio
  event(
    message: string,
    event_type: string,
    action: string,
    outcome: 'success' | 'failure' | 'partial',
    extra?: Record<string, unknown>,
  ): void {
    this.write('info', message, { event_type, action, outcome, ...extra });
  }
}
```

### 3.2 Uso no Discharge Orchestrator

```typescript
// src/discharge/discharge.service.ts
import { Injectable } from '@nestjs/common';
import { VelyaLoggerService } from '../logger/velya-logger.service';

@Injectable()
export class DischargeService {
  constructor(private readonly logger: VelyaLoggerService) {}

  async initiateDischarge(
    patientId: string,
    requestedBy: string,
    workflowId: string,
  ): Promise<void> {
    const startTime = Date.now();

    this.logger.info('Iniciando processo de alta médica', {
      event_type: 'patient.discharge.initiated',
      action: 'discharge.initiate',
      workflow_id: workflowId,
      patient_id: patientId, // tokenizado — OK
      requested_by_provider_id: requestedBy, // tokenizado — OK
      risk_class: 'high',
    });

    try {
      const blockers = await this.checkActiveBlockers(patientId);

      if (blockers.length > 0) {
        this.logger.warn('Alta bloqueada por pendências ativas', {
          event_type: 'patient.discharge.blocked',
          action: 'discharge.initiate',
          outcome: 'failure',
          workflow_id: workflowId,
          patient_id: patientId,
          error_code: 'DISCHARGE_BLOCKER_ACTIVE',
          error_class: 'clinical.blocker',
          duration_ms: Date.now() - startTime,
          risk_class: 'high',
          blocker_count: blockers.length,
          blocker_types: blockers.map((b) => b.type), // tipos, não dados clínicos
        });
        return;
      }

      await this.processDischarge(patientId, workflowId);

      this.logger.event(
        'Alta processada com sucesso',
        'patient.discharge.completed',
        'discharge.process',
        'success',
        {
          workflow_id: workflowId,
          patient_id: patientId,
          duration_ms: Date.now() - startTime,
          risk_class: 'high',
        },
      );
    } catch (error) {
      this.logger.error('Erro ao processar alta', {
        event_type: 'patient.discharge.error',
        action: 'discharge.initiate',
        outcome: 'failure',
        workflow_id: workflowId,
        patient_id: patientId,
        error_code: error instanceof DischargeError ? error.code : 'DISCHARGE_UNKNOWN_ERROR',
        error_class: 'infrastructure.processing',
        duration_ms: Date.now() - startTime,
        risk_class: 'high',
        // Nunca incluir error.stack em produção — pode conter dados sensíveis
        error_message: error.message,
      });
      throw error;
    }
  }
}
```

### 3.3 Propagação de trace_id

```typescript
// src/middleware/trace-context.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { context, trace } from '@opentelemetry/api';

@Injectable()
export class TraceContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // trace_id e span_id são extraídos automaticamente pelo OTel SDK
    // Injete no AsyncLocalStorage para estar disponível no logger
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      req['velya_trace_id'] = spanContext.traceId;
      req['velya_span_id'] = spanContext.spanId;
    }

    // request_id: gerado ou extraído do header X-Request-ID
    req['velya_request_id'] =
      (req.headers['x-request-id'] as string) || `req-${crypto.randomUUID()}`;

    next();
  }
}
```

---

## 4. Níveis de Log por Situação

### ERROR — Falha não recuperável

Use quando o sistema não conseguiu realizar a operação e há impacto imediato.

```typescript
// Situações para ERROR:
// - Exceção não tratada que encerrou uma operação clínica
// - Falha de conexão ao banco de dados após todas as retentativas
// - Falha ao entregar alerta clínico
// - Falha de validação crítica que bloqueou workflow
// - Panic/crash de worker Temporal

this.logger.error('Falha ao entregar alerta clínico após 3 tentativas', {
  event_type: 'clinical.alert.delivery.failed',
  action: 'alert.deliver',
  outcome: 'failure',
  error_code: 'ALERT_DELIVERY_EXHAUSTED',
  error_class: 'clinical.alert',
  retry_count: 3,
  risk_class: 'high',
});
```

### WARN — Condição anômala, sistema continua

Use quando o sistema detectou algo incomum mas continuou funcionando.

```typescript
// Situações para WARN:
// - Retry bem-sucedido após falha
// - Resposta de API externa com latência acima do esperado (mas dentro do timeout)
// - Bloqueador de alta detectado (evento de negócio anômalo mas esperado)
// - Circuit breaker em estado half-open
// - Fila NATS com profundidade acima do threshold normal

this.logger.warn('Latência de AI acima do esperado — usando resposta em cache', {
  event_type: 'ai.response.slow',
  action: 'ai.request',
  outcome: 'partial',
  duration_ms: 8500,
  model: 'claude-3-sonnet',
  error_code: 'AI_LATENCY_HIGH',
  error_class: 'infrastructure.timeout',
});
```

### INFO — Eventos de negócio importantes

Use para documentar o fluxo normal de operações clínicas e de negócio.

```typescript
// Situações para INFO:
// - Alta iniciada, bloqueada, resolvida, concluída
// - Task criada, atribuída, concluída
// - Handoff iniciado, concluído
// - Agent iniciou/concluiu tarefa
// - Validação passou ou falhou
// - Decision do decision-log

this.logger.info('Handoff de turno concluído', {
  event_type: 'handoff.shift.completed',
  action: 'handoff.complete',
  outcome: 'success',
  workflow_id: handoffId,
  duration_ms: handoffDurationMs,
  unit: 'UTI',
  pending_items_transferred: 3,
  checklist_completeness_ratio: 0.92,
});
```

### DEBUG — Diagnóstico técnico

Use apenas em desenvolvimento. Nunca ativado em produção.

```typescript
// Situações para DEBUG (apenas em dev):
// - SQL queries individuais
// - Headers de request completos
// - Estado interno de algoritmos
// - Tentativas de cache hit/miss
// - Detalhes de serialização/deserialização

// Em produção: este log NUNCA é escrito (verificado no logger)
this.logger.debug('Consultando cache Redis para patient_id', {
  patient_id: patientId,
  cache_key: cacheKey,
  ttl: 300,
});
```

---

## 5. Integração com Loki

### 5.1 Como Promtail coleta os logs

O Promtail roda como DaemonSet em cada nó e coleta logs de `/var/log/pods/**/*.log`. Os logs escritos pelo container para `stdout` (via `process.stdout.write`) são automaticamente capturados.

### 5.2 Labels que Promtail extrai automaticamente

```yaml
# Labels extraídos automaticamente pelo Promtail (pipeline de scrape):
- pod (nome do pod)
- namespace (namespace Kubernetes)
- container (nome do container)
- node_name (nó onde o pod está rodando)
- app (label do pod, geralmente igual ao nome do deployment)
```

### 5.3 Labels de negócio via pipeline de parsing

Para permitir queries eficientes no LogQL, configure o Promtail para extrair labels do JSON:

```yaml
# promtail/config.yaml — pipeline stages para serviços Velya
pipeline_stages:
  - json:
      expressions:
        level: level
        service: service
        event_type: event_type
        outcome: outcome
        risk_class: risk_class
        environment: environment
  - labels:
      level:
      service:
      environment:
      risk_class:
      outcome:
```

**Resultado**: todas as queries Loki abaixo funcionam eficientemente:

```logql
# Todos os erros clínicos de alto risco
{namespace="velya-dev-core", level="error", risk_class="high"}

# Eventos de alta bloqueada no ambiente prod
{service="discharge-orchestrator", environment="prod"} |= "DISCHARGE_BLOCKER_ACTIVE"

# Falhas de agent no clinical-office
{namespace="velya-dev-agents", outcome="failure"} | json | office="clinical-office"

# Logs de um trace específico (correlação logs ↔ traces)
{namespace=~"velya-dev-.+"} | json | trace_id="4bf92f3577b34da6a3ce929d0e0e4736"
```

### 5.4 Retenção de Logs

| Ambiente               | Retenção | Justificativa                                 |
| ---------------------- | -------- | --------------------------------------------- |
| dev                    | 7 dias   | Espaço limitado no kind cluster               |
| staging                | 30 dias  | Debugging de issues pré-prod                  |
| prod                   | 90 dias  | Auditoria clínica e compliance                |
| prod (risk_class=high) | 365 dias | Retenção estendida para auditoria regulatória |

---

## 6. Campos para Queries LogQL Frequentes

| Query de negócio               | LogQL                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Erros de alta hoje             | `{service="discharge-orchestrator"} \| json \| level="error" \| action=~"discharge.*"`   |
| Eventos clínicos de alto risco | `{namespace=~"velya-dev-.+"} \| json \| risk_class="high"`                               |
| Silêncio de agent              | `{namespace="velya-dev-agents"} \| json \| event_type=~"agent.*"` (ausência de logs)     |
| Logs de um workflow específico | `{namespace=~"velya-dev-.+"} \| json \| workflow_id="wf-discharge-PAT-001-2026-04-08"`   |
| Taxa de falhas por serviço     | `sum(rate({namespace="velya-dev-core"} \| json \| outcome="failure" [5m])) by (service)` |
| Decisões de AI por agent       | `{service="decision-log"} \| json \| agent_name="discharge-coordinator-agent"`           |
