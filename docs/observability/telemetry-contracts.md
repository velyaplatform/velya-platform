# Contratos de Telemetria — Velya Platform

> Um serviço "instrumentado" não é qualquer serviço com algum log ou métrica.
> É um serviço que satisfaz um contrato formal de telemetria verificável.
> Última atualização: 2026-04-08

---

## 1. Visão Geral dos Níveis

```
Nível 1 — Básico
  Obrigatório para: todos os serviços, todos os ambientes

Nível 2 — Operacional
  Obrigatório para: serviços em staging e produção

Nível 3 — Clínico
  Obrigatório para: serviços que afetam diretamente decisões sobre pacientes
```

Serviços que não atendem ao nível exigido para o seu ambiente **não devem ser promovidos para o próximo ambiente**.

---

## 2. Nível 1 — Básico (obrigatório para todos)

### 2.1 Health Check

| Requisito | Detalhe | Verificação |
|-----------|---------|------------|
| Endpoint `/health` | Responde HTTP 200 | `curl -sf http://service:3000/health` |
| Latência < 100ms | Health check não deve depender de DB ou serviços externos | Medir com Prometheus |
| Corpo JSON | `{ "status": "healthy", "timestamp": "ISO8601" }` | Schema validation |
| Readiness separado de Liveness | `/health/ready` e `/health/live` como probes K8s | Kubernetes config |

**Exemplo NestJS**:
```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1000 }),
    ]);
  }

  @Get('live')
  live() {
    // Liveness: apenas verifica se o processo está rodando
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    // Readiness: verifica se o serviço está pronto para receber tráfego
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1000 }),
    ]);
  }
}
```

### 2.2 Logs JSON Estruturados com Campos Base

| Campo obrigatório | Verificação |
|------------------|------------|
| `timestamp` (ISO 8601) | `jq '.timestamp' log.json \| date -f` válido |
| `level` (debug/info/warn/error) | `jq '.level' \| grep -E "^(debug\|info\|warn\|error)$"` |
| `service` (nome do serviço) | `jq '.service' \| grep -v null` |
| `namespace` | `jq '.namespace' \| grep -v null` |
| `environment` | `jq '.environment' \| grep -E "^(dev\|staging\|prod)$"` |
| `message` | `jq '.message' \| grep -v null` |
| Formato JSON válido | `jq . log.json > /dev/null 2>&1 && echo VALID` |

**Verificação automática de conformidade**:
```bash
# Script para verificar conformidade de logs (rodar em CI)
#!/bin/bash
SERVICE_LOG=$(kubectl logs deployment/${SERVICE} -n ${NAMESPACE} --tail=100)
REQUIRED_FIELDS="timestamp level service namespace environment message"

for field in $REQUIRED_FIELDS; do
  if ! echo "$SERVICE_LOG" | head -1 | jq -e ".$field" > /dev/null 2>&1; then
    echo "FALHA: Campo '$field' ausente nos logs de ${SERVICE}"
    exit 1
  fi
done

echo "Conformidade de logging: OK"
```

### 2.3 Métricas de Processo via prom-client

```typescript
// Em qualquer serviço NestJS — adicionar ao AppModule
import { collectDefaultMetrics, Registry } from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({ register: registry }); // CPU, memória, GC, event loop, etc.
```

Métricas automáticas incluídas:
- `process_cpu_seconds_total` — tempo de CPU consumido
- `process_resident_memory_bytes` — memória residente
- `nodejs_heap_size_used_bytes` — heap em uso
- `nodejs_eventloop_lag_seconds` — lag do event loop (indicador de sobrecarga)
- `nodejs_gc_duration_seconds` — duração do Garbage Collector

### 2.4 ServiceMonitor configurado

```yaml
# infra/observability/prometheus/servicemonitors/patient-flow-service.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: patient-flow-service
  namespace: velya-dev-observability
  labels:
    release: kube-prometheus-stack
spec:
  namespaceSelector:
    matchNames:
      - velya-dev-core
  selector:
    matchLabels:
      app.kubernetes.io/name: patient-flow-service
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
      honorLabels: false
```

**Verificação**:
```bash
# Verificar que o target está sendo scrapeado
kubectl port-forward svc/kube-prometheus-stack-prometheus -n velya-dev-observability 9090:9090
# Acessar: http://localhost:9090/targets
# Deve mostrar patient-flow-service como UP
```

---

## 3. Nível 2 — Operacional (obrigatório para staging e produção)

### 3.1 Golden Signals Expostos

Todos os quatro sinais devem ser expostos como métricas Prometheus:

| Sinal | Métrica mínima | Verificação |
|-------|---------------|------------|
| Rate | `http_requests_total{service, method, route, status}` | `curl /metrics \| grep http_requests_total` |
| Errors | Subset de Rate com `status=~"5.."` | Calculado via PromQL do Rate acima |
| Duration | `http_request_duration_seconds_bucket{service, method, route, status}` | Deve ter `_bucket`, `_count`, `_sum` |
| Saturation | Qualquer gauge relevante (conexões ativas, queue depth, etc.) | Definido por serviço |

**Exemplo de implementação com middleware NestJS**:
```typescript
// src/middleware/metrics.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total de requisições HTTP',
  labelNames: ['service', 'method', 'route', 'status'],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP',
  labelNames: ['service', 'method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const route = req.route?.path || req.path;

    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;
      const labels = {
        service: process.env.SERVICE_NAME || 'unknown',
        method: req.method,
        route,
        status: res.statusCode.toString(),
      };

      httpRequestsTotal.labels(labels).inc();
      httpRequestDuration.labels(labels).observe(duration);
    });

    next();
  }
}
```

### 3.2 Trace Propagation

Quando o SDK OTel estiver configurado (ver tracing-standard.md):

| Requisito | Verificação |
|-----------|------------|
| `trace_id` presente em todos os logs de eventos | `kubectl logs ... | jq '.trace_id' | grep -v null` |
| Headers W3C TraceContext propagados em requests outbound | Inspecionar requests via OTel |
| `trace_id` propagado em mensagens NATS | Ver nats-trace-propagator.ts |

### 3.3 Correlação de Logs com trace_id

Logs e traces devem ser correlacionáveis:
- Todo log de evento de negócio deve conter `trace_id` quando houver span ativo
- `trace_id` no log deve ser idêntico ao `traceId` do span correspondente no Tempo

**Verificação**:
```bash
# Pegar um trace_id de um log recente
TRACE_ID=$(kubectl logs deployment/patient-flow-service -n velya-dev-core --tail=10 \
  | jq -r 'select(.trace_id != null) | .trace_id' | head -1)

echo "trace_id encontrado: $TRACE_ID"
# Usar no Grafana Tempo para verificar que o trace existe
```

### 3.4 Health Checks de Dependências

```typescript
// src/health/health.controller.ts — versão Nível 2
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private natsIndicator: NatsHealthIndicator,
  ) {}

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      // Banco de dados
      () => this.db.pingCheck('database', { timeout: 1000 }),
      // NATS JetStream
      () => this.natsIndicator.isHealthy('nats'),
      // Serviços dependentes via HTTP (circuit breaker)
      () => this.http.pingCheck('ai-gateway', 'http://ai-gateway.velya-dev-agents:3000/health', { timeout: 2000 }),
    ]);
  }
}
```

### 3.5 Circuit Breaker Exposto via Métrica

```typescript
// Expor estado do circuit breaker como métrica
const circuitBreakerState = new Gauge({
  name: 'velya_circuit_breaker_state',
  help: 'Estado do circuit breaker (1=aberto, 0=fechado)',
  labelNames: ['service', 'dependency', 'state'],
});

// Atualizar quando estado muda:
circuitBreakerState
  .labels({ service: 'patient-flow-service', dependency: 'ai-gateway', state: 'open' })
  .set(1);
```

---

## 4. Nível 3 — Clínico (obrigatório para serviços que afetam pacientes)

### 4.1 Métricas de Latência P99 com SLO Definido

Cada serviço clínico deve ter SLOs documentados e mensuráveis:

| Serviço | SLO de Disponibilidade | SLO de Latência P99 | SLO de Error Rate |
|---------|----------------------|--------------------|--------------------|
| patient-flow-service | 99.5% | < 1s | < 1% |
| discharge-orchestrator | 99.5% | < 2s | < 1% |
| task-inbox-service | 99.5% | < 500ms | < 0.5% |
| api-gateway | 99.9% | < 500ms | < 0.5% |
| ai-gateway | 99.0% | < 10s | < 2% |

**Query de SLO (Burn Rate Alert)**:
```promql
# Error budget burn rate (1 hora)
(
  rate(http_requests_total{service="patient-flow-service", status=~"5.."}[1h]) /
  rate(http_requests_total{service="patient-flow-service"}[1h])
) / (1 - 0.995)  # 1 - SLO
# Alertar se burn rate > 14.4x (exaurindo budget em 5 dias)
```

### 4.2 Alertas de Latência e Error Rate com Runbook

Cada serviço clínico deve ter alertas configurados e runbooks documentados:

| Serviço | Alerta de Latência | Alerta de Error Rate | Runbook |
|---------|-------------------|--------------------|---------|
| patient-flow-service | P99 > 1s por 10min | Error rate > 1% por 5min | /runbooks/patient-flow-high-latency |
| discharge-orchestrator | P99 > 2s por 10min | Error rate > 1% por 5min | /runbooks/discharge-high-latency |
| task-inbox-service | P99 > 500ms por 10min | Error rate > 0.5% por 5min | /runbooks/task-inbox-errors |

### 4.3 Auditoria de Operações Clínicas

Todo serviço que toca dados clínicos deve logar via decision-log:

```typescript
// Padrão de auditoria para operações clínicas
this.decisionLogService.record({
  event_type: 'patient.discharge.approved',
  action: 'discharge.approve',
  outcome: 'success',
  patient_id: 'PAT-001',  // tokenizado
  provider_id: 'PROV-123', // tokenizado
  agent_name: 'discharge-coordinator-agent',
  office: 'clinical-office',
  risk_class: 'high',
  evidence: {
    checklist_completed: true,
    blocker_count: 0,
    medical_clearance: true,
  },
  workflow_id: workflowId,
  trace_id: currentTraceId,
});
```

**Verificação**:
```bash
# Toda operação de alta deve ter log no decision-log
kubectl logs deployment/decision-log -n velya-dev-platform --tail=100 \
  | jq 'select(.event_type | startswith("patient.discharge"))' \
  | wc -l
```

### 4.4 Degraded Mode Exposto

```typescript
// Todos os serviços clínicos devem expor indicador de modo degradado
const degradedModeActive = new Gauge({
  name: 'velya_degraded_mode_active',
  help: '1 se o serviço está operando em modo degradado',
  labelNames: ['service', 'reason'],
});

// Ativar quando dependência crítica estiver indisponível:
circuitBreaker.on('open', (dependency) => {
  degradedModeActive
    .labels({ service: SERVICE_NAME, reason: `circuit_open_${dependency}` })
    .set(1);
});

circuitBreaker.on('close', (dependency) => {
  degradedModeActive
    .labels({ service: SERVICE_NAME, reason: `circuit_open_${dependency}` })
    .set(0);
});
```

### 4.5 Decision Log para Operações Clínicas

```typescript
// Toda decisão clínica deve ser registrada no decision-log service
// com todos os campos de auditoria obrigatórios
interface ClinicalDecisionLog {
  event_type: string;         // Obrigatório
  action: string;             // Obrigatório
  outcome: 'success' | 'failure' | 'partial'; // Obrigatório
  patient_id: string;         // Obrigatório (tokenizado)
  risk_class: 'high' | 'medium' | 'low'; // Obrigatório
  evidence: Record<string, unknown>; // Obrigatório
  agent_name?: string;        // Quando aplicável
  provider_id?: string;       // Quando aplicável
  workflow_id: string;        // Obrigatório
  trace_id: string;           // Obrigatório
  timestamp: string;          // Gerado automaticamente
}
```

---

## 5. Tabela de Estado Atual dos Serviços

| Serviço | Namespace | Nível Atual | Nível Alvo | Principais Gaps | Prioridade |
|---------|-----------|------------|-----------|----------------|-----------|
| **patient-flow-service** | velya-dev-core | 0 (sem instrumentação) | 3 (clínico) | ServiceMonitor, métricas golden signals, métricas de negócio, decision log | P0 |
| **task-inbox-service** | velya-dev-core | 0 | 3 | ServiceMonitor, golden signals, métricas de inbox, SLOs | P0 |
| **discharge-orchestrator** | velya-dev-core | 0 | 3 | ServiceMonitor, golden signals, métricas de alta, decision log | P0 |
| **api-gateway** | velya-dev-platform | 0 | 2 | ServiceMonitor, golden signals, circuit breaker exposto | P0 |
| **ai-gateway** | velya-dev-agents | 0 | 2 | ServiceMonitor, métricas de AI (tokens, latência, erros) | P0 |
| **decision-log** | velya-dev-platform | 0 | 2 | ServiceMonitor, golden signals | P1 |
| **memory-service** | velya-dev-agents | 0 | 2 | ServiceMonitor, golden signals | P1 |
| **policy-engine** | velya-dev-platform | 0 | 2 | ServiceMonitor, golden signals, métricas de rejeição de policy | P1 |
| **velya-web** | velya-dev-web | 0 | 2 | Web Vitals, JS errors, RUM completo | P1 |

**Legenda de Nível Atual**:
- `0` — Nenhuma instrumentação implementada. Visibilidade zero.
- `1` — Health check e logs básicos, mas sem ServiceMonitor ou golden signals.
- `2` — Golden signals + ServiceMonitor + trace propagation.
- `3` — Nível 2 + SLOs definidos + decision log + degraded mode.

---

## 6. Checklist de Verificação de Nível

### Verificação de Nível 1

```bash
#!/bin/bash
# verify-level-1.sh SERVICE NAMESPACE
SERVICE=$1
NAMESPACE=$2

echo "=== Verificando Nível 1 para ${SERVICE} ==="

# 1. Health check respondendo
echo -n "Health check: "
kubectl exec -n $NAMESPACE deploy/$SERVICE -- wget -qO- localhost:3000/health >/dev/null 2>&1 \
  && echo "OK" || echo "FALHA"

# 2. Logs são JSON válido
echo -n "Formato de log JSON: "
kubectl logs deploy/$SERVICE -n $NAMESPACE --tail=5 | jq . >/dev/null 2>&1 \
  && echo "OK" || echo "FALHA"

# 3. Campos obrigatórios presentes
echo -n "Campos obrigatórios nos logs: "
SAMPLE=$(kubectl logs deploy/$SERVICE -n $NAMESPACE --tail=1)
for field in timestamp level service namespace environment message; do
  echo $SAMPLE | jq -e ".$field" >/dev/null 2>&1 || echo "FALTANDO: $field"
done
echo "OK (verificar acima se há campos faltando)"

# 4. Endpoint /metrics respondendo
echo -n "Endpoint /metrics: "
kubectl exec -n $NAMESPACE deploy/$SERVICE -- wget -qO- localhost:3000/metrics | grep -q "process_cpu" \
  && echo "OK" || echo "FALHA (prom-client não configurado)"

# 5. ServiceMonitor existe
echo -n "ServiceMonitor: "
kubectl get servicemonitor $SERVICE -n velya-dev-observability >/dev/null 2>&1 \
  && echo "OK" || echo "AUSENTE — criar ServiceMonitor"

echo "=== Verificação de Nível 1 concluída ==="
```

### Verificação de Nível 2

```bash
#!/bin/bash
# verify-level-2.sh SERVICE NAMESPACE
SERVICE=$1
NAMESPACE=$2

echo "=== Verificando Nível 2 para ${SERVICE} ==="

# 1. Golden signals presentes no /metrics
echo -n "Golden Signals (http_requests_total): "
kubectl exec -n $NAMESPACE deploy/$SERVICE -- wget -qO- localhost:3000/metrics \
  | grep -q "http_requests_total" && echo "OK" || echo "AUSENTE"

echo -n "Golden Signals (http_request_duration_seconds): "
kubectl exec -n $NAMESPACE deploy/$SERVICE -- wget -qO- localhost:3000/metrics \
  | grep -q "http_request_duration_seconds_bucket" && echo "OK" || echo "AUSENTE"

# 2. trace_id nos logs
echo -n "trace_id nos logs: "
kubectl logs deploy/$SERVICE -n $NAMESPACE --tail=20 \
  | jq -r 'select(.trace_id != null) | .trace_id' | head -1 | grep -q "." \
  && echo "OK" || echo "AUSENTE (instrumentação OTel não implementada)"

# 3. Circuit breaker exposto
echo -n "Circuit breaker métrica: "
kubectl exec -n $NAMESPACE deploy/$SERVICE -- wget -qO- localhost:3000/metrics \
  | grep -q "velya_circuit_breaker_state" && echo "OK" || echo "AUSENTE"

echo "=== Verificação de Nível 2 concluída ==="
```

---

## 7. Política de Promoção entre Ambientes

| Promoção | Nível Mínimo Requerido | Bloqueio Automático |
|---------|----------------------|---------------------|
| `dev → staging` | Nível 1 completo | CI/CD verifica health check e formato de log |
| `staging → prod` | Nível 2 completo | Revisão manual + scripts de verificação de nível |
| Serviço clínico em prod | Nível 3 completo | Revisão de segurança + aprovação de clinical-office |

**Nota de estado atual**: Todos os serviços estão em Nível 0 (ambiente dev). Nenhum pode ser considerado pronto para staging com o estado atual de instrumentação.
