# Modelo de Observabilidade dos Agents — Velya Platform

> Agents são entidades de primeira classe na observabilidade da Velya.
> Um agent não observável não é confiável para operações clínicas.
> Última atualização: 2026-04-08

---

## 1. Princípio Fundamental

Na empresa digital da Velya, agents executam tarefas que afetam diretamente o cuidado ao paciente:
- O `discharge-coordinator-agent` coordena o processo de alta médica
- O `task-router-agent` distribui tarefas clínicas urgentes
- O `clinical-alert-agent` entrega alertas a profissionais de saúde

**Consequência**: a falta de observabilidade sobre um agent é equivalente a ter um membro da equipe trabalhando sem supervisão em um ambiente clínico. É inaceitável.

---

## 2. Taxonomia de Estados de um Agent

| Estado | Descrição | Indicador |
|--------|-----------|-----------|
| `healthy` | Processando tarefas normalmente dentro dos SLOs | `time() - last_activity < 1800` AND `validation_pass_rate > 0.85` |
| `degraded` | Ativo mas com performance abaixo dos SLOs | `validation_pass_rate < 0.85` OR `correction_loop > 2` |
| `silent` | Sem atividade detectável por mais de 30 minutos | `time() - last_activity > 1800` |
| `quarantined` | Removido de operação por watchdog ou validação | `velya_agent_quarantine_active == 1` |
| `offline` | Worker Temporal parado, agent não está rodando | `up{job="agent-worker"} == 0` |

---

## 3. Métricas por Agent

### 3.1 Throughput e Atividade

```typescript
// Implementação no worker Temporal (TypeScript)
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

const registry = new Registry();

// Contador de tarefas por status
const agentTaskTotal = new Counter({
  name: 'velya_agent_task_total',
  help: 'Total de tarefas processadas pelo agent',
  labelNames: ['agent_name', 'office', 'status', 'task_type'],
  registers: [registry],
});

// Duração de execução de tarefa
const agentTaskDuration = new Histogram({
  name: 'velya_agent_task_duration_seconds',
  help: 'Tempo de execução de tarefa por agent',
  labelNames: ['agent_name', 'office', 'task_type'],
  buckets: [1, 5, 30, 60, 300, 600, 1800],
  registers: [registry],
});

// Timestamp da última atividade (para detecção de silêncio)
const agentLastActivity = new Gauge({
  name: 'velya_agent_last_activity_timestamp',
  help: 'Timestamp Unix da última atividade do agent',
  labelNames: ['agent_name', 'office'],
  registers: [registry],
});

// Atualizar ao final de cada tarefa:
agentLastActivity.labels({ agent_name: 'discharge-coordinator-agent', office: 'clinical-office' })
  .set(Date.now() / 1000);
```

### 3.2 Qualidade e Validação

```typescript
// Resultado de validação
const agentValidationResult = new Counter({
  name: 'velya_agent_validation_result_total',
  help: 'Resultado de validação de saída do agent',
  labelNames: ['agent_name', 'office', 'result', 'validator_type'],
  registers: [registry],
  // result: pass, fail, skip
  // validator_type: schema, clinical-rules, policy-engine, human
});

// Loop de correção — iterações por tarefa em andamento
const agentCorrectionLoopCount = new Gauge({
  name: 'velya_agent_correction_loop_count',
  help: 'Número de iterações de correção na tarefa atual',
  labelNames: ['agent_name', 'office', 'task_type'],
  registers: [registry],
});

// Taxa de retrabalho (correções que reaparecem)
const agentCorrectionRecurrenceRate = new Gauge({
  name: 'velya_agent_correction_recurrence_rate',
  help: 'Taxa de retrabalho do agent (proporção de correções que reaparecem)',
  labelNames: ['agent_name', 'office'],
  registers: [registry],
  // Valor: 0.0 (sem retrabalho) a 1.0 (todo output é corrigido novamente)
});

// Completude de evidência
const agentEvidenceCompletenessRatio = new Gauge({
  name: 'velya_agent_evidence_completeness_ratio',
  help: 'Proporção de evidências presentes vs. esperadas no contexto do agent',
  labelNames: ['agent_name', 'office', 'task_type'],
  registers: [registry],
  // Valor: 0.0 (sem evidências) a 1.0 (todas as evidências presentes)
});
```

### 3.3 Handoffs

```typescript
// Handoffs entre agents/offices
const agentHandoffTotal = new Counter({
  name: 'velya_agent_handoff_total',
  help: 'Total de handoffs realizados pelo agent',
  labelNames: ['agent_name', 'source_office', 'destination_office', 'status'],
  registers: [registry],
  // status: completed, stuck, rejected, timeout
});

// Latência de handoff
const agentHandoffLatency = new Histogram({
  name: 'velya_agent_handoff_latency_seconds',
  help: 'Latência do processo de handoff entre agents',
  labelNames: ['source_office', 'destination_office'],
  buckets: [1, 5, 30, 60, 300, 600, 1800],
  registers: [registry],
});
```

### 3.4 Estado de Quarentena e Watchdog

```typescript
// Evento de quarentena
const agentQuarantineTotal = new Counter({
  name: 'velya_agent_quarantine_total',
  help: 'Número de vezes que o agent foi colocado em quarentena',
  labelNames: ['agent_name', 'office', 'reason'],
  registers: [registry],
  // reason: validation_failure, watchdog_incident, correction_loop, manual
});

// Estado de quarentena atual
const agentQuarantineActive = new Gauge({
  name: 'velya_agent_quarantine_active',
  help: '1 se o agent está em quarentena agora, 0 se não',
  labelNames: ['agent_name', 'office'],
  registers: [registry],
});

// Incidente de watchdog
const agentWatchdogIncidentTotal = new Counter({
  name: 'velya_agent_watchdog_incident_total',
  help: 'Incidentes detectados pelo watchdog de agent',
  labelNames: ['agent_name', 'office', 'incident_type'],
  registers: [registry],
});
```

---

## 4. Alarmes de Agent

### 4.1 Thresholds e Condições

| Alarme | Condição | Severidade | SLA de Resposta | Owner |
|--------|---------|-----------|----------------|-------|
| Agent silencioso (warning) | `time() - velya_agent_last_activity_timestamp > 1800` | Médio | 4 horas | agents-office |
| Agent silencioso (critical) | `time() - velya_agent_last_activity_timestamp > 3600` | Crítico | 5 minutos | agents-office |
| Rejeição de validação > 30% | `pass_rate < 0.70 por 15 minutos` | Alto | 30 minutos | agents-office |
| Loop de correção > 3 | `velya_agent_correction_loop_count > 3` | Alto | 30 minutos | agents-office |
| Quarentena ativada | `increase(velya_agent_quarantine_total[5m]) > 0` | Crítico | 5 minutos | agents-office |
| Evidence completeness < 70% | `velya_agent_evidence_completeness_ratio < 0.70` | Médio | 4 horas | agents-office |
| Watchdog incident | `increase(velya_agent_watchdog_incident_total[10m]) > 0` | Alto | 30 minutos | agents-office |
| Token consumption > 100K/hora | `rate(velya_ai_token_consumption_total[1h]) > 100000` | Alto | 30 minutos | agents-office |

### 4.2 Alertas PromQL completos

```yaml
# PrometheusRule para alerts de agent
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-agent-alerts
  namespace: velya-dev-observability
  labels:
    prometheus: kube-prometheus-stack
    role: alert-rules
spec:
  groups:
    - name: velya-agents
      interval: 30s
      rules:
        - alert: VelyaAgentSilentCritical
          expr: time() - velya_agent_last_activity_timestamp > 3600
          for: 5m
          labels:
            severity: critical
            domain: agents
            owner: agents-office
          annotations:
            summary: "Agent {{ $labels.agent_name }} silencioso por > 60 minutos"
            impact: "Tarefas do office {{ $labels.office }} não estão sendo processadas"
            dashboard_url: "http://grafana/d/velya-agents-oversight-console"
            runbook_url: "https://docs.velya/runbooks/agent-silent"

        - alert: VelyaAgentHighRejectionRate
          expr: |
            (
              rate(velya_agent_validation_result_total{result="pass"}[1h]) /
              rate(velya_agent_validation_result_total[1h])
            ) < 0.70
          for: 15m
          labels:
            severity: high
            domain: agents
            owner: agents-office
          annotations:
            summary: "Agent {{ $labels.agent_name }} com taxa de aprovação de validação de {{ $value | humanizePercentage }}"
            impact: "Saídas de baixa qualidade sendo produzidas. Risco clínico se agent opera sobre dados de pacientes."

        - alert: VelyaAgentCorrectionLoop
          expr: velya_agent_correction_loop_count > 3
          for: 5m
          labels:
            severity: high
            domain: agents
            owner: agents-office
          annotations:
            summary: "Agent {{ $labels.agent_name }} em loop de correção com {{ $value }} iterações"
            impact: "Consumo excessivo de tokens e latência. Agent não converge para solução correta."
```

---

## 5. Dashboard Agent Oversight Console — Layout Detalhado

### Linha 1: Estado Atual (Estado geral da empresa digital)

**Painel 1 — Canvas: Visão dos Offices e Agents**
- Layout visual: caixas representando offices (clinical-office, administrative-office, platform-office, agents-office)
- Dentro de cada office: pontos coloridos por agent (verde=healthy, amarelo=degraded, vermelho=silent/quarantined)
- Atualização em tempo real via gauge `velya_agent_quarantine_active` e derivada de `velya_agent_last_activity_timestamp`

**Painel 2 — Stat: Agents Silenciosos Agora**
```promql
count(time() - velya_agent_last_activity_timestamp > 1800)
```
Threshold: verde = 0, vermelho > 0

**Painel 3 — Stat: Agents em Quarentena**
```promql
sum(velya_agent_quarantine_active)
```
Threshold: verde = 0, vermelho > 0

**Painel 4 — Stat: Taxa de Aprovação Média (todos os agents)**
```promql
sum(rate(velya_agent_validation_result_total{result="pass"}[1h])) /
sum(rate(velya_agent_validation_result_total[1h]))
```
Threshold: verde > 0.90, amarelo > 0.80, vermelho < 0.80

---

### Linha 2: State Timeline — Estado de Cada Agent ao Longo do Tempo

**Visualização**: State Timeline com uma linha por agent.

```promql
# Estado derivado do tempo desde última atividade
# 0 = healthy, 1 = degraded (> 30min), 2 = silent (> 60min)
clamp_max(
  floor((time() - velya_agent_last_activity_timestamp) / 1800),
  2
)
```

**Configuração de cores**:
- 0 → Verde (healthy)
- 1 → Amarelo (degraded — silencioso 30-60min)
- 2 → Vermelho (silent — silencioso > 60min)

**Exibição**: últimas 6 horas, labels com nome do agent

---

### Linha 3: Throughput por Office (Bar Chart)

```promql
sum(rate(velya_agent_task_total{status="success"}[1h])) by (office)
```

**Visualização**: Bar Chart horizontal, ordenado por throughput descendente.
Comparar com semana anterior usando anotações de deploy.

---

### Linha 4: Ranking de Agents por Taxa de Rejeição (Table)

| Coluna | Métrica |
|--------|---------|
| Agent | `agent_name` label |
| Office | `office` label |
| Taxa de Rejeição | `1 - (rate(result=pass)[24h] / rate(total)[24h])` |
| Último Output | `time() - velya_agent_last_activity_timestamp` |
| Status | derivado de thresholds |

```promql
# Query para tabela — top agents por taxa de rejeição nas últimas 24h
topk(10,
  1 - (
    rate(velya_agent_validation_result_total{result="pass"}[24h]) /
    rate(velya_agent_validation_result_total[24h])
  )
)
```

**Cell coloring**: coluna "Taxa de Rejeição" — verde < 15%, amarelo < 30%, vermelho > 30%.

---

### Linha 5: Latência de Handoff — Heatmap

```promql
sum(rate(velya_agent_handoff_latency_seconds_bucket[1h])) by (le, source_office, destination_office)
```

**Visualização**: Heatmap de densidade de handoffs por hora do dia (eixo X = hora, eixo Y = latência em bucket).
Permite identificar picos de latência de handoff em horários específicos (ex.: troca de turno às 7h, 13h, 19h).

---

### Linha 6: Handoffs Stuck (Table)

```promql
sum(velya_agent_handoff_total{status="stuck"}) by (source_office, destination_office) > 0
```

**Visualização**: Table com source_office, destination_office, count de handoffs stuck.
Data link: click → abre Loki com filtros `event_type=~"agent.handoff.*"` AND `status="stuck"`.

---

### Linha 7: Consumo de Tokens por Agent (Bar Chart)

```promql
sum(rate(velya_ai_token_consumption_total[1h])) by (agent_name)
```

**Visualização**: Bar Chart horizontal com threshold line de alerta em 100K tokens/hora.
Permite identificar agents com consumo anormal rapidamente.

---

## 6. Integração com Grafana: Guia de Correlação

### 6.1 De métricas de agent → logs do agent

**Data Link em qualquer gráfico com `agent_name` label**:
```
URL: /explore?orgId=1&left={"datasource":"loki","queries":[{"expr":"{namespace=\"velya-dev-agents\",service=\"${__field.labels.agent_name}\"}","refId":"A"}],"range":{"from":"${__from}","to":"${__to}"}}
Título: Ver logs do agent
```

### 6.2 De evento de quarentena → decisões anteriores

Quando um agent é quarentenado, investigar as decisões anteriores:
```logql
{service="decision-log"} | json | agent_name="${agent_name}" | outcome="failure"
```

### 6.3 De silêncio de agent → tarefas pendentes na inbox

Quando um agent fica silencioso, verificar o impacto na inbox:
```promql
velya_task_inbox_depth{office="${office}"}
```

### 6.4 De loop de correção → trace do workflow

Quando `velya_agent_correction_loop_count` > 3, abrir Tempo e buscar:
- `velya.agent_name="${agent_name}"`
- `velya.action=~"correction.*"`
- Duração > 5 minutos

---

## 7. Implementação em Worker Temporal

### 7.1 Estrutura do worker instrumentado

```typescript
// src/workers/discharge-coordinator-worker.ts
import { Worker } from '@temporalio/worker';
import { createActivities } from './activities';
import { VelyaAgentMetrics } from './metrics';

const metrics = new VelyaAgentMetrics({
  agentName: 'discharge-coordinator-agent',
  office: 'clinical-office',
});

const worker = await Worker.create({
  workflowsPath: require.resolve('./workflows'),
  activities: createActivities(metrics),
  taskQueue: 'discharge-coordinator-queue',

  // Interceptors para rastrear execuções de workflow e atividade
  interceptors: {
    activityInbound: [() => new MetricsActivityInboundInterceptor(metrics)],
    workflowInbound: [() => new MetricsWorkflowInboundInterceptor(metrics)],
  },
});

// Interceptor de atividade — registra métricas a cada execução
class MetricsActivityInboundInterceptor {
  constructor(private metrics: VelyaAgentMetrics) {}

  async execute(input: ActivityInput, next: Next<ActivityInboundCallsInterceptor, 'execute'>) {
    const startTime = Date.now();
    const taskType = input.headers['velya-task-type'] as string || 'unknown';

    try {
      const result = await next.execute(input);

      this.metrics.recordTaskCompletion({
        status: 'success',
        taskType,
        durationSeconds: (Date.now() - startTime) / 1000,
      });

      return result;

    } catch (error) {
      this.metrics.recordTaskCompletion({
        status: 'failure',
        taskType,
        durationSeconds: (Date.now() - startTime) / 1000,
      });
      throw error;
    }
  }
}
```

### 7.2 Endpoint /metrics para ServiceMonitor

```typescript
// src/workers/metrics-server.ts
import express from 'express';
import { Registry } from 'prom-client';

export function startMetricsServer(registry: Registry, port = 9090): void {
  const app = express();

  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    } catch (error) {
      res.status(500).end(error.message);
    }
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.listen(port, () => {
    console.log(`Metrics server rodando na porta ${port}`);
  });
}
```

```yaml
# ServiceMonitor para workers de agents
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: velya-agent-workers
  namespace: velya-dev-observability
  labels:
    release: kube-prometheus-stack
spec:
  namespaceSelector:
    matchNames:
      - velya-dev-agents
  selector:
    matchLabels:
      app.kubernetes.io/component: agent-worker
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
```
