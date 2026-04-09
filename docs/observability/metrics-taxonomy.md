# Taxonomia de Métricas — Velya Platform

> Referência autoritativa para naming, labels e semântica de todas as métricas Prometheus da Velya.
> Toda métrica customizada deve ser registrada aqui antes de ser implementada.
> Última atualização: 2026-04-08

---

## 1. Convenções de Naming

### 1.1 Padrão Geral

```
velya_{domínio}_{nome}_{unidade_suffix}
```

**Exemplos corretos**:
- `velya_patient_flow_active_count` — contagem de pacientes ativos
- `velya_discharge_blocker_age_seconds` — idade em segundos do bloqueador
- `velya_agent_validation_pass_rate` — taxa (ratio), sem unidade de tempo
- `velya_ai_request_duration_seconds` — duração em segundos
- `velya_task_inbox_depth` — profundidade de fila (gauge, sem sufixo de unidade)

**Sufixos obrigatórios por tipo**:

| Tipo de dado | Sufixo | Exemplo |
|-------------|--------|---------|
| Tempo/duração | `_seconds` | `velya_handoff_duration_seconds` |
| Bytes | `_bytes` | `velya_payload_size_bytes` |
| Contagem acumulada | `_total` | `velya_agent_task_total` |
| Proporção/ratio | `_ratio` | `velya_evidence_completeness_ratio` |
| Informação (sempre 1) | `_info` | `velya_service_info` |
| Gauge sem unidade física | sem sufixo | `velya_task_inbox_depth` |

### 1.2 Domínios Reconhecidos

| Domínio | Prefixo | Exemplos de contexto |
|---------|---------|---------------------|
| Fluxo do paciente | `velya_patient_` | Ocupação, movimentação |
| Alta médica | `velya_discharge_` | Bloqueadores, estágios |
| Task inbox | `velya_task_` | Profundidade, prioridades, SLA |
| Handoff entre turnos | `velya_handoff_` | Duração, completude |
| Agents | `velya_agent_` | Throughput, validação, silêncio |
| Office | `velya_office_` | Backlog, health |
| AI / Inferência | `velya_ai_` | Tokens, latência, erros |
| Web / Frontend | `velya_web_` | Core Web Vitals, erros JS |
| Sistema geral | `velya_` | Modo degradado, secrets |

### 1.3 Regras de Naming

- Usar `snake_case` sempre
- Nunca usar nomes de serviços como domínio (use `patient_flow`, não `patient_flow_service`)
- Evitar abreviações não óbvias (`duration` não `dur`, `seconds` não `sec`)
- Histogramas: criar com sufixo base sem `_seconds` — prom-client adiciona `_bucket`, `_count`, `_sum` automaticamente
- Não usar `velya_velya_` — o prefixo `velya_` aparece uma única vez

---

## 2. Labels Padrão Obrigatórios

Todo serviço Velya deve incluir os seguintes labels em todas as métricas:

| Label | Tipo | Valores esperados | Obrigatório |
|-------|------|------------------|------------|
| `service` | String | `patient-flow-service`, `api-gateway`, `velya-web` | Sim |
| `namespace` | String | `velya-dev-core`, `velya-dev-platform`, `velya-dev-agents`, `velya-dev-web` | Sim |
| `environment` | String | `dev`, `staging`, `prod` | Sim |
| `version` | String | `1.2.0` (semver) | Sim |
| `office` | String | `clinical-office`, `administrative-office`, `platform-office` | Para serviços com office |
| `agent_name` | String | `discharge-coordinator-agent`, `task-router-agent` | Para métricas de agent |
| `risk_class` | String | `high`, `medium`, `low` | Para métricas de operações clínicas |

**Aviso de cardinalidade**: Nunca usar como label valores de alta cardinalidade como `patient_id`, `user_id`, `request_id`, `trace_id`. Esses campos vão em logs e traces, nunca em métricas.

---

## 3. Golden Signals por Serviço

### Padrão de implementação com prom-client (NestJS)

```typescript
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Rate — requisições por segundo
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total de requisições HTTP recebidas',
  labelNames: ['method', 'route', 'status', 'service'],
});

// Errors — contido no Rate via label status=5xx

// Duration — histograma de latência
const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'route', 'status', 'service'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// Saturation — conexões ativas
const httpConnectionsActive = new Gauge({
  name: 'http_connections_active',
  help: 'Conexões HTTP ativas no momento',
  labelNames: ['service'],
});
```

### 3.1 patient-flow-service

| Sinal | Métrica | Tipo | Query de exemplo |
|-------|---------|------|-----------------|
| Rate | `http_requests_total{service="patient-flow-service"}` | Counter | `rate(http_requests_total{service="patient-flow-service"}[5m])` |
| Errors | `http_requests_total{service="patient-flow-service",status=~"5.."}` | Counter | `rate(...)[5m] / rate(total)[5m]` |
| Duration P99 | `http_request_duration_seconds_bucket{service="patient-flow-service"}` | Histogram | `histogram_quantile(0.99, rate(...[$__rate_interval]))` |
| Saturation | `velya_patient_flow_active_count` | Gauge | `velya_patient_flow_active_count` |

---

### 3.2 task-inbox-service

| Sinal | Métrica | Tipo | Query de exemplo |
|-------|---------|------|-----------------|
| Rate | `http_requests_total{service="task-inbox-service"}` | Counter | `rate(...[5m])` |
| Errors | `http_requests_total{service="task-inbox-service",status=~"5.."}` | Counter | Taxa de erros |
| Duration P99 | `http_request_duration_seconds{service="task-inbox-service"}` | Histogram | P99 |
| Saturation | `velya_task_inbox_depth` | Gauge | `sum(velya_task_inbox_depth) by (priority)` |

---

### 3.3 discharge-orchestrator

| Sinal | Métrica | Tipo | Query de exemplo |
|-------|---------|------|-----------------|
| Rate | `http_requests_total{service="discharge-orchestrator"}` | Counter | `rate(...[5m])` |
| Errors | Taxa de erros HTTP | Counter | Taxa 5xx |
| Duration P99 | Latência de orquestração | Histogram | P99 de duração |
| Saturation | `velya_discharge_pending_total` | Gauge | Total de altas em andamento |

---

### 3.4 api-gateway

| Sinal | Métrica | Tipo | Query de exemplo |
|-------|---------|------|-----------------|
| Rate | `http_requests_total{service="api-gateway"}` | Counter | `rate(...[5m])` — volume de entrada total |
| Errors | Taxa 4xx e 5xx | Counter | `rate(http_requests_total{status=~"[45].."}[5m])` |
| Duration P99 | Latência de gateway | Histogram | P99 incluindo overhead de routing |
| Saturation | `http_connections_active{service="api-gateway"}` | Gauge | Conexões simultâneas |

---

### 3.5 ai-gateway

| Sinal | Métrica | Tipo | Query de exemplo |
|-------|---------|------|-----------------|
| Rate | `velya_ai_request_total` | Counter | `rate(velya_ai_request_total[5m])` |
| Errors | `velya_ai_error_total` | Counter | `rate(velya_ai_error_total[5m])` por error_type |
| Duration P99 | `velya_ai_request_duration_seconds` | Histogram | `histogram_quantile(0.99, rate(...[$__rate_interval]))` |
| Saturation | `velya_ai_token_consumption_total` | Counter | `rate(velya_ai_token_consumption_total[1h])` |

---

### 3.6 velya-web (Next.js)

| Sinal | Métrica | Tipo | Query de exemplo |
|-------|---------|------|-----------------|
| Rate | `velya_web_page_view_total` | Counter | `rate(velya_web_page_view_total[5m])` |
| Errors | `velya_web_js_error_total` | Counter | `rate(velya_web_js_error_total[5m])` |
| Duration (LCP) | `velya_web_lcp_seconds` | Histogram | `histogram_quantile(0.95, ...)` |
| Saturation | `velya_web_active_sessions` | Gauge | Sessões ativas simultâneas |

---

## 4. Métricas de Negócio e Workflow Clínico

### 4.1 Fluxo do Paciente

```promql
# Pacientes ativos por unidade e status
velya_patient_flow_active_count{unit, status}
# Labels: unit (UTI, Enfermaria, Cirurgia), status (admitted, discharge-pending, blocked)
# Tipo: Gauge
# Owner: patient-flow-service
# Implementação: exportar a cada 30s via prom-client gauge.set()

# Tempo de internação por unidade (histograma)
velya_patient_admission_duration_seconds{unit}
# Tipo: Histogram
# Buckets: [1h, 4h, 12h, 24h, 48h, 72h, 168h] em segundos
# Quando registrar: ao final de cada internação

# Taxa de alta dentro do prazo esperado
velya_discharge_on_time_total{unit, reason}
velya_discharge_total{unit}
# Ratio: velya_discharge_on_time_total / velya_discharge_total
```

---

### 4.2 Discharge Coordination

```promql
# Altas pendentes por status e tipo de bloqueador
velya_discharge_pending_total{status, blocker_type, unit}
# Labels: 
#   status: medical-ready, awaiting-documentation, awaiting-transport, awaiting-social-work
#   blocker_type: medication, exam, social, transport, administrative
#   unit: UTI, Enfermaria-A, Enfermaria-B
# Tipo: Gauge
# Owner: discharge-orchestrator
# Implementação: gauge.set() a cada 60s com contagem atual

# Idade do bloqueador mais antigo (por tipo e unidade)
velya_discharge_blocker_age_seconds{blocker_type, unit}
# Tipo: Gauge
# Valor: time() - timestamp_de_criacao_do_bloqueador
# Alerta: > 4h (14400s) = crítico

# Tempo entre decisão de alta e alta efetiva
velya_discharge_decision_to_discharge_seconds{unit, blocker_type}
# Tipo: Histogram
# Buckets: [30m, 1h, 2h, 4h, 8h, 24h] em segundos
# Registrar: ao concluir cada processo de alta
```

---

### 4.3 Task Inbox

```promql
# Profundidade da fila por prioridade e tipo
velya_task_inbox_depth{priority, task_type}
# Labels:
#   priority: critical, high, medium, low
#   task_type: discharge-request, medication-review, lab-result, consultation
# Tipo: Gauge
# Alerta: critical > 20 = crítico

# Tarefas sem dono por prioridade
velya_task_inbox_unowned_total{priority}
# Tipo: Gauge
# Alerta: priority=critical AND value > 5 = high

# Tempo de resposta por tipo de tarefa
velya_task_response_duration_seconds{priority, task_type}
# Tipo: Histogram
# Buckets: [5m, 15m, 30m, 1h, 2h, 4h, 8h] em segundos

# Tarefas vencidas (passaram do SLA)
velya_task_overdue_total{priority, task_type}
# Tipo: Gauge
# Calculado: tasks onde current_time > created_at + SLA_por_prioridade
```

---

### 4.4 Handoff entre Turnos

```promql
# Duração do processo completo de handoff
velya_handoff_duration_seconds{unit, from_shift, to_shift}
# Tipo: Histogram
# Buckets: [5m, 15m, 30m, 1h, 2h] em segundos
# Ideal: < 30 minutos para handoff completo

# Taxa de completude do checklist de handoff
velya_handoff_checklist_completeness_ratio{unit}
# Tipo: Gauge (0.0 a 1.0)
# Alerta: < 0.80 = médio

# Pendências transferidas sem contexto
velya_handoff_pending_without_context_total{unit}
# Tipo: Counter
# Registrar: a cada handoff onde item não tinha contexto suficiente

# Alertas clínicos — latência de entrega
velya_clinical_alert_delivery_latency_seconds{alert_type, unit}
# Tipo: Histogram
# Buckets: [1s, 5s, 10s, 30s, 60s, 120s]
# SLO: P95 < 30s
# Alerta: P95 > 30s = crítico (impacto direto em pacientes)
```

---

## 5. Métricas de Agents

### 5.1 Throughput e Atividade

```promql
# Tarefas completadas por agent e status
velya_agent_task_total{agent_name, office, status}
# Labels:
#   agent_name: discharge-coordinator-agent, task-router-agent, ...
#   office: clinical-office, administrative-office, ...
#   status: success, failure, correction, skipped
# Tipo: Counter

# Última atividade do agent (Unix timestamp)
velya_agent_last_activity_timestamp{agent_name, office}
# Tipo: Gauge (timestamp Unix)
# Alerta de silêncio: time() - value > 1800 = warning, > 3600 = critical
# Implementação: atualizar com time.Now().Unix() a cada execução bem-sucedida

# Duração de execução de tarefa
velya_agent_task_duration_seconds{agent_name, office, task_type}
# Tipo: Histogram
# Buckets: [1s, 5s, 30s, 60s, 300s, 600s]
```

---

### 5.2 Qualidade e Validação

```promql
# Resultado de validação por agent
velya_agent_validation_result_total{agent_name, office, result}
# Labels:
#   result: pass, fail, skip
# Tipo: Counter
# Taxa de aprovação: rate(result=pass) / rate(total)
# Alerta: pass_rate < 0.70 = high

# Loop de correção — iterações por tarefa
velya_agent_correction_loop_count{agent_name, office}
# Tipo: Gauge (valor atual de iterações de correção por tarefa em andamento)
# Alerta: > 3 = high

# Taxa de retrabalho (correções que reaparecem)
velya_agent_correction_recurrence_rate{agent_name, office}
# Tipo: Gauge (0.0 a 1.0)
# Tendência deve ser decrescente ao longo do tempo (sinal de aprendizado)

# Completude de evidência
velya_agent_evidence_completeness_ratio{agent_name, office}
# Tipo: Gauge (0.0 a 1.0)
# Alerta: < 0.70 = médio
```

---

### 5.3 Handoffs entre Agents

```promql
# Total de handoffs por origem, destino e status
velya_agent_handoff_total{source_office, destination_office, status}
# Labels:
#   status: completed, stuck, rejected, timeout
# Tipo: Counter

# Latência de handoff
velya_agent_handoff_latency_seconds{source_office, destination_office}
# Tipo: Histogram

# Quarentena de agents
velya_agent_quarantine_total{agent_name, office, reason}
# Tipo: Counter
# Razões: validation_failure, watchdog_incident, correction_loop, manual
```

---

### 5.4 Office Health

```promql
# Profundidade de backlog por office
velya_office_backlog_depth{office}
# Tipo: Gauge
# Alerta: crescimento contínuo por mais de 30 minutos

# Health score do office (calculado)
velya_office_health_score{office}
# Tipo: Gauge (0.0 a 1.0)
# Calculado como média ponderada de: validation_pass_rate, agent_activity, backlog_ratio
```

---

## 6. Métricas de AI e Inferência

```promql
# Latência de inferência por modelo e agent
velya_ai_request_duration_seconds{model, agent_name, office}
# Tipo: Histogram
# Modelos: claude-3-haiku, claude-3-sonnet, claude-3-opus
# Buckets: [0.5s, 1s, 2s, 5s, 10s, 30s, 60s]

# Tokens consumidos por agent e modelo
velya_ai_token_consumption_total{agent_name, office, model, token_type}
# Labels:
#   token_type: input, output
# Tipo: Counter
# Alerta: rate > 100K tokens/hora por agent = high

# Erros por tipo
velya_ai_error_total{agent_name, model, error_type}
# Labels:
#   error_type: timeout, rate_limit, invalid_response, context_length_exceeded, auth_error
# Tipo: Counter

# Distribuição de confiança das recomendações
velya_ai_confidence_distribution{agent_name, recommendation_type}
# Tipo: Histogram
# Buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
# Para detectar drift: distribuição mudando para valores baixos indica problema de qualidade

# Total de requisições de AI
velya_ai_request_total{agent_name, model, status}
# Labels:
#   status: success, failure, timeout, rate_limited
# Tipo: Counter
```

---

## 7. Métricas de Frontend (velya-web)

```promql
# Core Web Vitals
velya_web_lcp_seconds{route}
# Tipo: Histogram — Largest Contentful Paint
# Buckets: [0.5, 1.0, 1.5, 2.5, 4.0, 6.0, 10.0]
# Bom: < 2.5s, Precisa melhorar: < 4s, Ruim: > 4s

velya_web_inp_milliseconds{route}
# Tipo: Histogram — Interaction to Next Paint
# Buckets: [50, 100, 200, 500, 1000]
# Bom: < 200ms

velya_web_cls_score{route}
# Tipo: Histogram — Cumulative Layout Shift
# Buckets: [0.01, 0.05, 0.1, 0.15, 0.25, 0.5]
# Bom: < 0.1

# Erros JavaScript
velya_web_js_error_total{error_type, route}
# Labels:
#   error_type: TypeError, ReferenceError, unhandled_promise_rejection, fetch_error
# Tipo: Counter

# Chamadas API falhadas (do ponto de vista do usuário)
velya_web_api_error_total{endpoint, status_code}
velya_web_api_total{endpoint}
# Tipo: Counter

# Abandono de fluxo
velya_web_flow_abandonment_total{flow, step_abandoned}
# Labels:
#   flow: discharge-initiation, task-completion, handoff-checklist
#   step_abandoned: step-1, step-2, step-3...
# Tipo: Counter

# Sobreposição de recomendação AI pelo usuário
velya_web_ai_recommendation_override_total{recommendation_type}
# Tipo: Counter
# Sinal importante: usuário clínico está ignorando recomendação de AI

# Modo degradado ativo
velya_degraded_mode_active{service}
# Tipo: Gauge (0 ou 1)
# Presente em todos os serviços, incluindo velya-web
```

---

## 8. Métricas de Sistema e Plataforma

```promql
# Falha de retrieval de secret
velya_secret_retrieval_failure_total{service, secret_name, error_type}
# Tipo: Counter

# Estado de circuit breaker
velya_circuit_breaker_state{service, dependency, state}
# Labels:
#   state: closed (normal), open (falha), half_open (testando)
# Tipo: Gauge (1 quando nesse estado, 0 quando não)

# Dead letter queue
velya_dead_letter_queue_total{service, queue_name}
# Tipo: Gauge (tamanho atual da DLQ)

# Pool de conexões com banco de dados
velya_db_pool_size_total{service}
velya_db_pool_waiting_total{service}
velya_db_pool_active_total{service}
# Tipo: Gauge

# Quarentena de agent (evento)
velya_agent_quarantine_total{agent_name, office, reason}
# Tipo: Counter

# Watchdog incident
velya_agent_watchdog_incident_total{agent_name, office, incident_type}
# Tipo: Counter
```

---

## 9. Métricas de Informação (Info Metrics)

Métricas que sempre retornam valor 1 e servem para juntar informações via `group_left` / `group_right`:

```promql
# Informações do serviço (para join em queries)
velya_service_info{service, version, namespace, environment, git_commit}
# Tipo: Gauge (sempre 1)
# Usar para: join de versão em qualquer query de métrica de negócio

# Informações do agent
velya_agent_info{agent_name, office, version, model_provider}
# Tipo: Gauge (sempre 1)
```

---

## 10. Buckets de Histograma Recomendados por Contexto

| Contexto | Buckets sugeridos | Justificativa |
|----------|------------------|---------------|
| Latência HTTP (API gateway) | `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]` | SLO de P99 < 2s |
| Latência de AI (inferência) | `[0.5, 1, 2, 5, 10, 30, 60]` | Inferência pode demorar até 60s |
| Duração de workflow clínico | `[60, 300, 900, 1800, 3600, 14400, 86400]` (segundos) | Alta pode demorar horas |
| Idade de bloqueador de alta | `[1800, 3600, 7200, 14400, 28800, 86400]` (segundos) | Threshold crítico em 4h |
| Core Web Vitals (LCP) | `[0.5, 1.0, 1.5, 2.5, 4.0, 6.0, 10.0]` (segundos) | Limites do Web Vitals |
| Handoff de agent | `[1, 5, 30, 60, 300, 600, 1800]` (segundos) | Handoff ideal < 5 minutos |
