# Modelo de Visibilidade de Escala no Frontend — Velya

**Versão:** 1.0  
**Domínio:** Interface Operacional  
**Classificação:** Documento de Referência Técnica  
**Data:** 2026-04-08

---

## Mandato

> **A visibilidade de escala não é um dashboard de DevOps — é uma ferramenta operacional para gestores clínicos, operadores de plataforma e arquitetos de sistema. Cada tela tem um público, um propósito e ações concretas disponíveis.**

---

## Princípios de Design das Telas

1. **Dados em tempo real** — refresh máximo de 30s para telas operacionais
2. **Ação disponível** — toda tela tem pelo menos uma ação que o usuário pode executar
3. **Contexto clínico visível** — impacto no paciente sempre sinalizado quando relevante
4. **Hierarquia visual clara** — status geral → componentes → detalhes
5. **Mobile-first** — operadores acessam em tablet e celular durante plantão

---

## As 10 Telas Obrigatórias

```
┌─────────────────────────────────────────────────────────────┐
│  1. Runtime Pressure Board         ─── Status geral live   │
│  2. Autoscaling Command Board      ─── Controle de escala  │
│  3. Queue Health Board             ─── Filas e backlog     │
│  4. Office Congestion Board        ─── LLM e AI budget     │
│  5. Handoff Latency Board          ─── SLA de handoffs     │
│  6. Retry / DLQ Board              ─── Falhas e reprocesso │
│  7. Cost & Capacity Board          ─── Custo e orçamento   │
│  8. Degraded Mode Board            ─── Modo degradado      │
│  9. Agent Oversight Console        ─── Supervisão de agents│
│  10. Scale Event Timeline          ─── Linha do tempo      │
└─────────────────────────────────────────────────────────────┘
```

---

## Tela 1: Runtime Pressure Board

### Propósito

Visão geral do estado de saúde da plataforma em tempo real. Primeira tela aberta quando há suspeita de problema.

### Dados Exibidos

| Componente | Métrica | Fonte |
|---|---|---|
| Node CPU pressure | `avg(1 - rate(node_cpu_seconds_total{mode="idle"}[5m]))` | Prometheus |
| Node Memory pressure | `avg(1 - node_memory_MemAvailable / node_memory_MemTotal)` | Prometheus |
| Pod churn rate | `rate(kube_pod_container_status_restarts_total[5m])` | Prometheus |
| Pods not ready | `count(kube_pod_status_ready{condition="false"})` | Prometheus |
| Namespace quota utilization | `quota_used / quota_hard` | Prometheus |
| Active alerts | Alertmanager API | Alertmanager |
| System status | Agregado calculado | velya-web |

### Status Geral (Semáforo)

```
VERDE   — Todos os checks OK. Nenhum alerta ativo.
AMARELO — 1+ warnings ativos. Pressão detectada mas dentro do operável.
LARANJA — 1+ critical warnings. Ação necessária em breve.
VERMELHO — Critical alert. Ação imediata necessária. Impacto clínico possível.
```

### Ações Disponíveis

- **Ver detalhes** — navega para tela específica do componente afetado
- **Ativar modo degradado** — com confirmação de motivo
- **Pausar autoscaling** — pausa todos os KEDA ScaledObjects
- **Abrir runbook** — link para documento de resposta ao alerta

### Refresh Rate: 15 segundos

### Implementação (velya-web)

```typescript
// app/platform/runtime-pressure/page.tsx
import { getRuntimePressureData } from '@/lib/platform/pressure-queries';
import { PressureStatusCard } from '@/components/platform/PressureStatusCard';

export default async function RuntimePressurePage() {
  // Server component com revalidação a cada 15s
  const pressure = await getRuntimePressureData();
  
  return (
    <div className="grid grid-cols-2 gap-4 p-6">
      <PressureStatusCard
        title="Nós"
        metrics={[
          { label: "CPU", value: pressure.node.cpu, unit: "%" },
          { label: "Memória", value: pressure.node.memory, unit: "%" }
        ]}
        status={pressure.node.status}
        threshold={{ warning: 70, critical: 85 }}
      />
      <PressureStatusCard
        title="Pods"
        metrics={[
          { label: "Churn rate", value: pressure.pod.churnRate, unit: "restarts/min" },
          { label: "Não prontos", value: pressure.pod.notReady, unit: "pods" }
        ]}
        status={pressure.pod.status}
      />
      {/* ... mais cards ... */}
    </div>
  );
}
```

---

## Tela 2: Autoscaling Command Board

### Propósito

Controle direto dos mecanismos de autoscaling. Para operadores e SREs que precisam intervir manualmente.

### Dados Exibidos

| Componente | Dados | Fonte |
|---|---|---|
| HPA status | nome, namespace, current/min/max replicas, métrica atual, target | Kubernetes API |
| KEDA ScaledObjects | nome, trigger type, lag atual, min/max, paused? | Kubernetes API + KEDA |
| VPA recommendations | container, recommended CPU/memory vs current | VPA API |
| Deployment replicas | nome, current/desired/ready | Kubernetes API |

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  HPA Status                                                │
│  ┌──────────────────┬────────┬────────┬────────┬────────┐ │
│  │ Nome             │ Min    │ Atual  │ Max    │ Status │ │
│  ├──────────────────┼────────┼────────┼────────┼────────┤ │
│  │ api-gateway      │ 3      │ 5      │ 30     │ ✅ OK  │ │
│  │ patient-flow     │ 2      │ 2      │ 20     │ ✅ OK  │ │
│  │ task-inbox       │ 2      │ 8      │ 15     │ ⚠️ 53% │ │
│  └──────────────────┴────────┴────────┴────────┴────────┘ │
│                                                            │
│  KEDA ScaledObjects                                        │
│  ┌────────────────────────┬──────────┬────────┬─────────┐ │
│  │ Nome                   │ Trigger  │ Lag    │ Paused? │ │
│  ├────────────────────────┼──────────┼────────┼─────────┤ │
│  │ patient-flow-worker    │ NATS     │ 12 msg │ Não     │ │
│  │ discharge-worker       │ NATS+Prom│ 3 wf   │ Não     │ │
│  │ ai-gateway-async       │ Prom     │ 0      │ Sim ⏸️  │ │
│  └────────────────────────┴──────────┴────────┴─────────┘ │
└────────────────────────────────────────────────────────────┘
```

### Ações Disponíveis

- **Escalar manualmente** — define réplicas temporariamente para um Deployment
- **Pausar KEDA** — pausa um ScaledObject específico
- **Retomar KEDA** — retoma um ScaledObject pausado
- **Ajustar HPA min/max** — altera temporariamente os limites do HPA
- **Forçar scale-up** — adiciona N réplicas imediatamente

### Refresh Rate: 10 segundos

### Fonte de Dados

```typescript
// lib/platform/autoscaling-queries.ts
export async function getHPAStatus(): Promise<HPAStatus[]> {
  const response = await fetch('/api/k8s/hpa', {
    headers: { Authorization: `Bearer ${getServiceToken()}` }
  });
  const { items } = await response.json();
  
  return items.map(hpa => ({
    name: hpa.metadata.name,
    namespace: hpa.metadata.namespace,
    minReplicas: hpa.spec.minReplicas,
    currentReplicas: hpa.status.currentReplicas,
    desiredReplicas: hpa.status.desiredReplicas,
    maxReplicas: hpa.spec.maxReplicas,
    currentMetricValue: hpa.status.currentMetrics?.[0]?.resource?.current?.averageUtilization,
    targetMetricValue: hpa.spec.metrics?.[0]?.resource?.target?.averageUtilization,
    atMax: hpa.status.currentReplicas === hpa.spec.maxReplicas,
  }));
}
```

---

## Tela 3: Queue Health Board

### Propósito

Monitoramento de todas as filas NATS JetStream. Detecção de backlog, DLQ e consumer lag.

### Dados Exibidos

| Stream | Métricas | Fonte |
|---|---|---|
| velya.clinical.events | depth, oldest message age, consumers, delivery rate | NATS monitoring |
| velya.discharge.queue | depth, DLQ count, oldest message age, consumer lag | NATS monitoring |
| velya.tasks.notifications | depth, consumer lag, delivery rate | NATS monitoring |
| velya.ai.requests | depth, oldest age, DLQ | NATS monitoring |
| velya.audit.log | depth, delivery rate | NATS monitoring |

### Indicadores por Stream

```
Profundidade: [0────────────500────────2000──────────10000]
              VERDE         AMARELO    LARANJA        VERMELHO

Backlog Age:  [0────────────5min───────15min──────────60min]
              VERDE         AMARELO    LARANJA        VERMELHO

DLQ Count:    [0─────────────10─────────100─────────1000]
              VERDE           AMARELO   LARANJA     VERMELHO
```

### Ações Disponíveis

- **Ver mensagens no DLQ** — abre modal com sample de mensagens
- **Re-enfileirar do DLQ** — re-queue N mensagens do DLQ para a fila principal
- **Purgar DLQ** — com confirmação dupla — limpa o DLQ
- **Pausar consumer** — pausa um consumer específico
- **Ver consumer lag histórico** — abre gráfico Grafana embeddado

### Refresh Rate: 15 segundos

---

## Tela 4: Office Congestion Board

### Propósito

Monitorar consumo de budget de tokens LLM por office e por agent. Prevenir esgotamento de budget em produção.

### Dados Exibidos

| Office | Budget Diário | Consumido | Restante | % | Projeção |
|---|---|---|---|---|---|
| Clinical Office | 500k tokens | 123k | 377k | 24.6% | OK |
| Market Intel | 2M tokens | 1.8M | 200k | 90% | CRÍTICO |
| Operations | 200k tokens | 45k | 155k | 22.5% | OK |

### Gauge por Office

```
Clinical Office    [████░░░░░░░░░░░░░░░░] 24.6%   🟢 OK
Market Intel       [████████████████████] 90.0%   🔴 CRÍTICO
Operations         [████░░░░░░░░░░░░░░░░] 22.5%   🟢 OK
Platform Ops       [██░░░░░░░░░░░░░░░░░░] 15.3%   🟢 OK
```

### Projeção de Esgotamento

```
Market Intel: consumindo 450k tokens/hora → esgota em ~26 minutos
Clinical Office: consumindo 25k tokens/hora → esgota em ~14 horas
```

### Ações Disponíveis

- **Ver consumo por agent** — drill-down do office para agents individuais
- **Throttle office** — reduz threshold de throttle para economizar budget
- **Pausar agent** — pausa um agent específico de baixa prioridade
- **Aumentar budget** — request de aumento (vai para aprovação)
- **Ver histórico de consumo** — gráfico dos últimos 7 dias

### Refresh Rate: 60 segundos (budget muda mais lentamente)

---

## Tela 5: Handoff Latency Board

### Propósito

Monitorar SLAs de handoffs entre serviços e entre humano e sistema. Detectar gargalos no fluxo clínico.

### Dados Exibidos

| Handoff | SLO | P50 | P99 | Status |
|---|---|---|---|---|
| Admissão → patient-flow routing | < 30s | 3s | 18s | OK |
| Evento clínico → task no inbox | < 60s | 8s | 45s | OK |
| Task criada → início de processamento | < 5min | 45s | 4.5min | OK |
| Discharge request → orquestração iniciada | < 2min | 35s | 1.8min | OK |
| Aprovação solicitada → resposta médico | < 2h | 25min | 1.8h | OK |
| Workflow concluído → registro no prontuário | < 5min | 2min | 4.9min | ⚠️ |

### Ações Disponíveis

- **Ver detalhe de handoff** — histograma de latência completo
- **Ver traces** — link para Tempo com traces filtrados por handoff
- **Ver SLA trend** — série histórica de 7 dias

### Refresh Rate: 30 segundos

---

## Tela 6: Retry / DLQ Board

### Propósito

Monitorar falhas de processamento, taxas de retry e mensagens em Dead Letter Queue.

### Dados Exibidos

| Componente | Métrica | Valor | Status |
|---|---|---|---|
| Retry rate geral | msgs/min na 2a+ tentativa | 3.2/min | OK |
| DLQ total | mensagens em DLQ | 0 | OK |
| Temporal activity retry rate | retries/min | 0.5/min | OK |
| Workflows com compensation | count | 0 | OK |
| HTTP 5xx rate | errors/min por serviço | 0.1/min | OK |

### Drilldown por Stream

```
velya.discharge.queue
├── Total messages: 45,230
├── DLQ count: 0
├── Max deliveries reached (last 24h): 3
│   └── [Ver detalhes das 3 mensagens]
├── Retry rate (last 1h): 2.1/min
└── P99 processing time: 8.3s
```

### Ações Disponíveis

- **Inspecionar mensagem DLQ** — ver payload (sanitizado de PHI) da mensagem com falha
- **Re-enfileirar selecionadas** — re-queue mensagens específicas do DLQ
- **Marcar como descartada** — descartar mensagem com justificativa
- **Ver trace da falha** — link para trace Tempo da última falha da mensagem

### Refresh Rate: 30 segundos

---

## Tela 7: Cost & Capacity Board

### Propósito

Visibilidade de custo estimado, utilização de capacidade e projeções.

### Dados Exibidos

| Componente | Custo/dia | Custo/mês (projetado) | Vs Budget |
|---|---|---|---|
| EKS Nodes (compute) | $48 | $1.440 | 72% de $2k |
| LLM API (Anthropic) | $28 | $840 | 84% de $1k |
| S3 Storage | $0.18 | $5.40 | 11% de $50 |
| **Total** | **$76.18** | **$2.285** | **76% de $3k** |

### NodePool Utilization

```
system-critical     [████████░░░░░░░░░░░░] 43%  3 nós On-Demand
realtime-app        [████████████░░░░░░░░] 61%  4 nós On-Demand
async-workers       [██████░░░░░░░░░░░░░░] 32%  3 nós Spot
scheduled-batch     [░░░░░░░░░░░░░░░░░░░░]  0%  0 nós (sem jobs ativos)
```

### Spot Savings

```
Este mês:
  On-Demand equivalente: $1.820
  Custo real com Spot:   $654
  Economia Spot:         $1.166 (64% de desconto)
```

### Ações Disponíveis

- **Ver breakdown por namespace** — custo por namespace (estimado via quota)
- **Ver custo por NodePool** — detalhamento de instâncias ativas
- **Solicitar budget review** — envia request de revisão de budget
- **Ver tendência 30 dias** — gráfico histórico de custo

### Refresh Rate: 5 minutos (custo muda lentamente)

---

## Tela 8: Degraded Mode Board

### Propósito

Controle e visibilidade quando o sistema está em modo degradado. Quais funcionalidades estão limitadas e por quê.

### Dados Exibidos

```
Status: ACTIVE (Modo Normal)
  ✅ Autoscaling: ATIVO
  ✅ LLM Budget: 100% disponível
  ✅ Queue Processing: NORMAL
  ✅ Workflows: RODANDO
  ✅ Integrações externas: ONLINE

─── ou ───

Status: DEGRADED (Desde: 14:32, 2026-04-08)
  Motivo: HIS integration instável
  Ativado por: Dr. João Freire
  
  ✅ Serviços HTTP: NORMAL
  ⚠️ Autoscaling: LIMITADO (KEDA pausado para ai-gateway)
  ⚠️ LLM Budget: 50% do normal (throttle ativo)
  ⚠️ Queue Processing: THROTTLED (50% throughput)
  ❌ Integrações HIS: OFFLINE
  ✅ Workflows internos: RODANDO
```

### Modos Pré-configurados

| Modo | Ações Aplicadas | Caso de Uso |
|---|---|---|
| `budget-conservation` | Throttle LLM 50%, pausar agents low-prio | Budget quase esgotado |
| `integration-degraded` | Throttle workers que dependem de HIS | HIS offline |
| `maintenance` | Parar todos os schedules, página de manutenção | Manutenção planejada |
| `emergency-capacity` | Scale-up manual de serviços críticos | Pico inesperado |

### Ações Disponíveis

- **Ativar modo degradado** — selecionar preset ou customizar — com autenticação
- **Desativar modo degradado** — retornar ao modo normal
- **Ver checklist de retorno** — passos para retornar ao modo normal com segurança
- **Registrar incidente** — cria entrada de incidente no sistema

### Refresh Rate: 10 segundos

---

## Tela 9: Agent Oversight Console

### Propósito

Supervisão em tempo real de todos os agents ativos: status, consumo de tokens, tool calls recentes, outputs pendentes de revisão.

### Dados Exibidos

| Agent | Status | Execuções (24h) | Tokens (24h) | Revisão Pendente | Scorecard |
|---|---|---|---|---|---|
| discharge-summary-agent | ACTIVE | 45 | 123k | 2 outputs | 4.8/5 |
| market-intel-agent | RUNNING | 3 | 1.2M | 1 report | 4.2/5 |
| patient-context-agent | ACTIVE | 230 | 45k | 0 | 4.9/5 |
| cost-analysis-agent | IDLE | 1 | 8k | 0 | 4.7/5 |

### Drilldown por Agent

```
discharge-summary-agent
├── Última execução: 15:42 (há 3 min)
├── Execuções hoje: 45
│   ├── Concluídas com sucesso: 43
│   ├── Revisão solicitada: 2
│   └── Falhas: 0
├── Tokens hoje: 123k / 100k budget ← ACIMA DO BUDGET
│   └── ⚠️ 23% acima do budget diário
├── Tool calls (última execução):
│   ├── get_patient_context: OK (120ms)
│   ├── get_discharge_summary_template: OK (45ms)
│   └── create_draft_summary: OK (8.2s)
└── Outputs pendentes de revisão: 2
    ├── Paciente ID: [MASKED] — aguardando Dr. Silva
    └── Paciente ID: [MASKED] — aguardando Dr. Costa
```

### Ações Disponíveis

- **Ver output pendente** — abre revisão do output do agent
- **Aprovar output** — aprova e registra
- **Rejeitar output** — rejeita com feedback para o agent
- **Pausar agent** — pausa um agent específico
- **Ver histórico de tool calls** — log completo de tool calls do agent
- **Ver scorecard completo** — métricas de qualidade do agent

### Refresh Rate: 30 segundos

---

## Tela 10: Scale Event Timeline

### Propósito

Linha do tempo de todos os eventos de scaling das últimas 24h. Para análise post-mortem e validação de comportamento.

### Dados Exibidos

```
Timeline: Últimas 6 horas
─────────────────────────────────────────────────────
09:00  10:00  11:00  12:00  13:00  14:00  15:00  16:00
  │      │      │      │      │      │      │      │
  │    ┌─┴─┐                                        │
  │    │ HPA│ api-gateway: 3→7 réplicas (CPU 72%)   │
  │    └─┬─┘                                        │
  │      │                                          │
  │            ┌───┐                                │
  │            │KEDA│ patient-flow: 1→12 (lag 450)  │
  │            └───┘                                │
  │                   ┌────┐                        │
  │                   │KEDA│ patient-flow: 12→3     │
  │                   └────┘                        │
  │                          ┌──┐                   │
  │                          │⚠️ │ HPA flapping det. │
  │                          └──┘                   │
─────────────────────────────────────────────────────
```

### Eventos Registrados

| Timestamp | Tipo | Componente | Ação | Motivo |
|---|---|---|---|---|
| 09:45 | HPA Scale Up | api-gateway | 3→7 | CPU 72% > 60% target |
| 10:12 | KEDA Scale Up | patient-flow-worker | 1→12 | NATS lag 450 msgs |
| 11:34 | KEDA Scale Down | patient-flow-worker | 12→3 | NATS lag 0 msgs |
| 12:01 | Alert Fired | HPA | — | FlappingDetected |
| 14:32 | Manual Scale | discharge-worker | 2→10 | Operador interveio |
| 15:15 | Node Provisioned | realtime-app NodePool | +1 nó | c7i.xlarge |

### Ações Disponíveis

- **Ver detalhes do evento** — expandir contexto completo do evento
- **Ver métricas no momento do evento** — snapshot de Prometheus no timestamp
- **Exportar timeline** — exportar CSV ou JSON para análise

### Refresh Rate: 60 segundos (eventos são históricos)

---

## Implementação: Fontes de Dados Consolidadas

```typescript
// lib/platform/scale-visibility-sources.ts

export const DATA_SOURCES = {
  // Prometheus queries
  prometheus: {
    baseUrl: process.env.PROMETHEUS_URL,
    queries: {
      nodeCPU: '1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))',
      nodeMemory: '1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)',
      podChurn: 'rate(kube_pod_container_status_restarts_total[5m]) * 60',
      queueDepth: 'velya_nats_pending_messages',
      dlqCount: 'velya_nats_pending_messages{stream=~".*dlq.*"}',
      llmBudget: 'velya_ai_budget_consumed_ratio',
      hpaReplicas: 'kube_horizontalpodautoscaler_status_current_replicas',
      kedaScalerLag: 'keda_scaler_metrics_value',
    }
  },
  
  // Kubernetes API (via backend proxy)
  kubernetes: {
    endpoints: {
      hpa: '/api/k8s/apis/autoscaling/v2/horizontalpodautoscalers',
      keda: '/api/k8s/apis/keda.sh/v1alpha1/scaledobjects',
      nodes: '/api/k8s/api/v1/nodes',
      deployments: '/api/k8s/apis/apps/v1/deployments',
    }
  },
  
  // Alertmanager API
  alertmanager: {
    baseUrl: process.env.ALERTMANAGER_URL,
    endpoints: {
      alerts: '/api/v2/alerts',
    }
  },
  
  // NATS monitoring
  nats: {
    baseUrl: process.env.NATS_MONITORING_URL,
    endpoints: {
      streams: '/jsz?streams=true',
      consumers: '/jsz?consumers=true',
    }
  },
  
  // Temporal API
  temporal: {
    baseUrl: process.env.TEMPORAL_UI_URL,
    namespace: 'velya-dev',
    endpoints: {
      workflows: '/api/v1/namespaces/velya-dev/workflows',
      schedules: '/api/v1/namespaces/velya-dev/schedules',
    }
  }
};
```

---

## Embedding de Grafana no velya-web

```typescript
// components/platform/GrafanaEmbed.tsx
interface GrafanaEmbedProps {
  dashboardUid: string;
  panelId?: number;
  from?: string;
  to?: string;
  refresh?: string;
  height?: number;
}

export function GrafanaEmbed({
  dashboardUid,
  panelId,
  from = 'now-3h',
  to = 'now',
  refresh = '30s',
  height = 400
}: GrafanaEmbedProps) {
  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL;
  
  const params = new URLSearchParams({
    orgId: '1',
    from,
    to,
    refresh,
    kiosk: 'tv',  // Modo sem header do Grafana
  });
  
  if (panelId) {
    params.set('viewPanel', String(panelId));
  }
  
  const embedUrl = `${grafanaUrl}/d/${dashboardUid}?${params}`;
  
  return (
    <iframe
      src={embedUrl}
      width="100%"
      height={height}
      frameBorder="0"
      title="Grafana Dashboard"
      className="rounded-lg border border-gray-200"
    />
  );
}
```

---

## Permissões de Acesso por Tela

| Tela | Médico | Enfermeiro | Gestor Clínico | Operador TI | Admin |
|---|---|---|---|---|---|
| Runtime Pressure Board | Leitura | — | Leitura | Leitura + Ação | Full |
| Autoscaling Command Board | — | — | — | Leitura + Ação | Full |
| Queue Health Board | — | — | Leitura | Leitura + Ação | Full |
| Office Congestion Board | — | — | Leitura | Leitura | Full |
| Handoff Latency Board | Leitura | Leitura | Full | Leitura | Full |
| Retry/DLQ Board | — | — | Leitura | Full | Full |
| Cost & Capacity Board | — | — | Leitura | Leitura | Full |
| Degraded Mode Board | — | — | Leitura | Leitura + Ação | Full |
| Agent Oversight Console | Leitura (próprio) | — | Leitura | Leitura | Full |
| Scale Event Timeline | — | — | Leitura | Full | Full |

---

*Este modelo é revisado a cada release de velya-web que inclui novas telas operacionais.*
