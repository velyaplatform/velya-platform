# Modelo de Observabilidade da Plataforma

> Observabilidade nativa do Velya Hospital OS: OpenTelemetry em todas as camadas, traces
> clínicos, métricas RED+USE, logs estruturados, dashboards Grafana, alertas inteligentes e
> correlação de eventos clínicos-operacionais-financeiros.

---

## 1. Princípios

- **Observabilidade é primeiro-classe**, não afterthought.
- **Instrumentação automática + manual** — framework cobre o básico; domínio acrescenta
  contexto clínico.
- **Correlação total** — trace, log e métrica carregam os mesmos identificadores.
- **Contexto clínico em todas as camadas** — `patient_id`, `encounter_id`, `tenant_id`
  propagam via baggage.
- **Dados sensíveis sanitizados** em logs e traces por default.
- **SLOs declarados** por serviço e por fluxo de negócio.

---

## 2. Stack

- **OpenTelemetry** — SDKs em Node.js, Go, Python, React, React Native.
- **OTel Collector** — recebe, processa, roteia telemetria.
- **Prometheus** — métricas (pull + OTLP).
- **Loki** — logs estruturados.
- **Tempo** — traces distribuídos.
- **Grafana** — UI unificada, dashboards e alertas.
- **Alertmanager** — gestão de alertas.
- **Pyroscope** (opcional) — continuous profiling.

---

## 3. Traces

### 3.1. Propagação

- W3C Trace Context + Baggage.
- Spans cobrem: HTTP request -> serviço -> command handler -> aggregate -> event store
  append -> NATS publish -> consumer -> projection update -> DB write.
- Cada span carrega atributos padronizados:

```
service.name
service.version
deployment.environment
tenant.id
patient.id           (se aplicável, hasheado quando em logs externos)
encounter.id
actor.id / actor.role
aggregate.type / aggregate.id
event.type / event.version
command.type
```

### 3.2. Traces clínicos

Além dos traces técnicos, o Velya cria **spans de domínio** para fluxos clínicos inteiros:

- `clinical.admit_patient`
- `medication.closed_loop` (prescrição -> administração)
- `operations.surgery_execution`
- `revenue.billing_cycle`

Esses spans agregam vários traces técnicos e expõem métricas de ciclo de vida do processo
clínico.

### 3.3. Amostragem

- Head-based por default com 100% em não-produção e 10% em produção.
- **Tail-based** em produção para capturar 100% de traces com erro ou latência alta.
- 100% sempre para eventos de segurança (break-glass, auth failure).

---

## 4. Métricas

### 4.1. RED por endpoint e comando

- **Rate** — requisições / comandos por segundo.
- **Errors** — erros por segundo (por tipo).
- **Duration** — distribuição p50/p90/p99.

### 4.2. USE por dependência

- **Utilization** — CPU, memória, conexões DB, IOPS.
- **Saturation** — filas, back-pressure, NATS lag.
- **Errors** — timeouts, reconexões, falhas de dependência.

### 4.3. Métricas de domínio

Exemplos (cada bounded context expõe as suas):

```
medication_prescription_created_total{tenant, route, priority}
medication_prescription_review_duration_seconds
medication_administration_latency_seconds
medication_closed_loop_gap_seconds
medication_administration_blocked_total{reason}
bed_occupancy_ratio{unit}
bed_turnover_duration_seconds{unit}
surgery_first_case_on_time_ratio
surgery_turnover_duration_seconds{room}
revenue_denial_rate{payer}
revenue_dso_days{payer}
journey_projection_lag_seconds{projection}
assessment_submitted_total{template, version}
agent_decision_total{agent, phase, outcome}
breakglass_activated_total{reason}
```

### 4.4. Exemplars

Métricas carregam exemplars com `trace_id` — clicar em um pico na série tempo leva
diretamente ao trace causador.

---

## 5. Logs

- **Formato**: JSON estruturado.
- **Campos obrigatórios**: `ts`, `level`, `service`, `trace_id`, `span_id`, `tenant_id`,
  `message`, `event` (nome estruturado).
- **PII masking** em pipeline do OTel Collector (CPF, nome, endereço redigidos).
- **Níveis**: `trace`, `debug`, `info`, `warn`, `error`, `fatal`.
- **Retention**: por tenant e por tipo (segurança > 1 ano; debug > 7 dias).
- **LogQL** via Loki + Grafana.

---

## 6. Contexto clínico em telemetria

Baggage propaga atributos clínicos pelos serviços sem exigir que o código escreva
manualmente. Exemplo:

```ts
trace.getActiveSpan()?.setAttribute('patient.id', patientId);
baggage.set('patient.id', patientId);
```

Qualquer log, métrica ou span dentro da requisição receberá automaticamente.

Política de privacidade:

- `patient.id` é permitido em traces/logs internos.
- Dados diretos (nome, CPF) nunca entram em telemetria.
- Exportação externa hash-iza identificadores clínicos.

---

## 7. SLOs

Cada serviço e fluxo tem SLO declarado. Exemplos:

| SLO | Alvo | Janela |
|---|---|---|
| Prescrição: comando -> commit | p99 < 800 ms | 30 dias |
| Administração: scan -> commit | p99 < 500 ms | 30 dias |
| Journey projection lag | p99 < 500 ms | 30 dias |
| API availability | 99.95% | 30 dias |
| FHIR read availability | 99.9% | 30 dias |
| Agent decision latency (shadow) | p95 < 3 s | 30 dias |

Violations geram error budget burn alerts.

---

## 8. Alertas

### 8.1. Princípios

- **Actionable** — todo alerta tem runbook.
- **Severidade clara** — `info`, `warning`, `critical`.
- **Rota** — cada alerta vai para equipe dona.
- **Sem paging de sintoma** — alertar na causa raiz quando possível.
- **Burn rate** para SLOs, não thresholds brutos.

### 8.2. Exemplos

- `HighPrescriptionLatencyBurn` — queima de error budget de prescrição.
- `BrokenClosedLoop` — dose dispensada sem administração ou devolução em 24h.
- `JourneyProjectionLagHigh` — lag > 2s por 30s.
- `BreakGlassSurge` — taxa anormal de break-glass.
- `AgentDecisionDrift` — agent decision distribution distinta do baseline.
- `DenialRateSpike` — pico de glosas por operadora.

---

## 9. Dashboards

Conjunto padronizado de dashboards Grafana por bounded context:

- **Visão geral da plataforma** — saúde global, SLO burn.
- **Clinical Care** — RED dos comandos, latência por aggregate.
- **Medication Closed Loop** — funil prescrição -> administração.
- **Bed Management / Patient Flow** — ocupação, turnover, boarding.
- **Revenue Cycle** — billing throughput, denial rate, DSO.
- **Journey** — projeções, lag, rebuild status.
- **Agents** — decisões, shadow vs. active, scorecards.
- **Security** — auth failures, break-glass, policy denies.
- **Infra** — cluster health, NATS, PostgreSQL, Redis.

---

## 10. Correlação de eventos

O poder da arquitetura aparece quando um incidente é investigado:

1. Alerta dispara em `HighPrescriptionLatencyBurn`.
2. Link direto para dashboard do serviço.
3. Exemplars mostram traces representativos.
4. Trace revela span lento em `safety-check` agent.
5. Log do span mostra chamada externa a base de interações lenta.
6. Métrica `external_api_duration` confirma lentidão em provedor X.
7. Runbook indica ativação do fallback local.

Tudo sem sair do Grafana.

---

## 11. Profiling contínuo

- Pyroscope coleta profiles periódicos.
- Comparação de profiles entre versões (flamegraph diff).
- Ajuda em degradações sutis de performance.

---

## 12. Chaos engineering

- Testes de falha em ambientes não produção (NATS down, DB lento, consumer travado).
- Verificação de que alertas disparam e runbooks funcionam.
- Game days periódicos.

---

## 13. Privacidade e compliance

- Telemetria é dado sob LGPD.
- Retenção conforme classificação do dado.
- Exportação para terceiros só com DPA assinado.
- Acesso a logs com PII restrito a operação; auditado.

---

## 14. Referências

- OpenTelemetry — https://opentelemetry.io/
- Prometheus — https://prometheus.io/
- Grafana Labs docs (Loki, Tempo, Mimir).
- Google SRE Book — capítulo de SLOs.
- `docs/architecture/velya-hospital-platform-overview.md`
- `docs/agents/agents-governance-and-improvement-model.md`
