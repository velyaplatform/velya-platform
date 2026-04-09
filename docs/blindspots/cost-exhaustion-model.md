# Modelo de Esgotamento de Custo — Velya Platform

> **Versão**: 1.0 | **Atualizado em**: 2026-04-08 | **Dono**: Produto, Engenharia e Infraestrutura  
> **Propósito**: Modelagem de cenários de explosão de custo na plataforma Velya — como cada componente pode gerar custo exponencial sem controle, e quais são os mecanismos de proteção necessários.

---

## Cenários de Explosão de Custo

### COST-001 — Agent em Retry Loop com LLM

**Cenário**:  
Um agent de análise de alta entra em loop de autocorreção. A cada iteração, o agent faz uma nova chamada ao Claude claude-sonnet-4-6. Sem circuit breaker, isso pode acontecer indefinidamente.

**Cálculo de custo no pior caso**:
```
Claude claude-sonnet-4-6 pricing (estimativa 2026):
- Input: $3 / 1M tokens
- Output: $15 / 1M tokens

Chamada típica de discharge analysis:
- Input: ~4.000 tokens (~$0,012)
- Output: ~1.000 tokens (~$0,015)
- Custo por chamada: ~$0,027

Loop sem controle — 1 chamada por 30 segundos:
- Por hora: 120 chamadas × $0,027 = $3,24/hora por agent em loop
- 10 agents em loop simultâneos: $32,40/hora
- Por dia: $777,60
- Por mês: ~$23.000 apenas de inferência AI em loop
```

**Detector**: Alerta quando mesmo `agent_id` faz > 10 chamadas em 5 minutos.

**Circuit breaker**:
```typescript
// AI Gateway: circuit breaker por agent
const agentCallTracker = new Map<string, number[]>();

function checkAgentRateLimit(agentId: string): void {
  const now = Date.now();
  const calls = agentCallTracker.get(agentId) ?? [];
  const recentCalls = calls.filter(t => now - t < 300_000); // últimos 5 min
  
  if (recentCalls.length >= 10) {
    throw new AgentRateLimitError(
      `Agent ${agentId} excedeu 10 chamadas em 5 minutos. Circuit breaker aberto.`
    );
  }
  
  agentCallTracker.set(agentId, [...recentCalls, now]);
}
```

**Kill switch**: Desabilitar chamadas AI de agent específico sem derrubar o agent inteiro.

**Budget cap**: Token budget por agent por hora — bloquear quando 80% consumido.

**Custo estimado no pior caso (mensal sem controle)**: $23.000

---

### COST-002 — Market Intelligence Agent Fazendo Web + LLM por Proposta

**Cenário**:  
O market intelligence agent pesquisa o mercado hospitalar para cada proposta. Para cada pesquisa: 3 buscas web, 5 páginas coletadas, 1 análise LLM por página + 1 síntese final.

**Cálculo de custo**:
```
Por proposta de market intelligence:
- 5 páginas × análise LLM: 5 × $0,050 = $0,25
- Síntese final: ~$0,10
- Web search API calls: ~$0,10
- Total por proposta: ~$0,45

Se o agent processa 100 propostas por dia:
- Por dia: $45
- Por mês: $1.350

Se bug gera 1.000 propostas por dia (loop ou intake mal-configurado):
- Por dia: $450
- Por mês: $13.500
```

**Detector**: Alerta quando número de análises de market intelligence > threshold por hora.

**Kill switch**: Desativar intake do market intelligence agent independentemente dos demais.

**Budget cap**: Limite de X propostas por dia — excedente entra em fila de prioridade humana.

**Custo estimado no pior caso (mensal sem controle)**: $13.500

---

### COST-003 — Orchestrator Paralelizando Sub-Agents — Fan-Out de Custo

**Cenário**:  
O discharge-orchestrator inicia um workflow de alta complexa e paraleliza 8 sub-agents para analisar diferentes aspectos (medicação, exames, logística, transporte, etc.). Cada sub-agent faz 3 chamadas LLM. Para 50 altas simultâneas:

**Cálculo**:
```
Por alta complexa:
- 8 sub-agents × 3 chamadas × $0,027 = $0,648

50 altas simultâneas:
- $0,648 × 50 = $32,40 por rodada de análise
- Se rodadas repetidas (re-análise a cada 15 min): $129,60/hora

Por dia (rodadas de 15 min, 24h): $3.110,40
Por mês: ~$93.312 — completamente inviável
```

**Detector**: Monitorar fan-out ratio — alertar quando um workflow dispara > N sub-agents.

**Circuit breaker**: Limitar paralelismo máximo de sub-agents por workflow.

**Kill switch**: Degraded mode — processar altas sequencialmente em vez de paralelo.

**Budget cap**: Fan-out máximo de 3 sub-agents por workflow. Análise adicional manual quando necessário.

**Custo estimado no pior caso (mensal sem controle)**: $93.000

---

### COST-004 — Uso de Claude Opus Para Tarefas Simples

**Cenário**:  
Por falta de política de model routing, agentes de triagem simples (classificar se um evento é urgente ou não) usam Claude Opus em vez de Claude Haiku.

**Cálculo de diferença de custo**:
```
Haiku pricing (estimativa):
- Input: $0,25 / 1M tokens = $0,0000002/token
- Output: $1,25 / 1M tokens

Opus pricing (estimativa):
- Input: $15 / 1M tokens = $0,000015/token (75x mais caro)
- Output: $75 / 1M tokens (60x mais caro)

Tarefa simples de triagem (500 tokens input, 200 output):
- Haiku: $0,00038
- Opus: $0,0225 — 59x mais caro

1.000 triagens por dia:
- Haiku: $0,38/dia = $11,40/mês
- Opus: $22,50/dia = $675/mês

Diferença: $663,60/mês por 1.000 triagens simples
```

**Detector**: Log de model usado por tipo de task. Alerta quando Opus usado em tasks de triagem simples.

**Controle**:
```typescript
// Política de model routing
const MODEL_ROUTING: Record<TaskType, string> = {
  'simple_triage': 'claude-haiku-4',
  'clinical_analysis': 'claude-sonnet-4-6',
  'complex_reasoning': 'claude-opus-4',
  'default': 'claude-haiku-4'
};
```

**Kill switch**: Forçar downgrade de modelo globalmente em emergência de custo.

**Custo estimado do desperdício (mensal)**: $664+ por 1.000 triagens com Opus desnecessário.

---

### COST-005 — Sem Limite de Tokens por Agent por Hora

**Cenário**:  
Sem budget de tokens por agent, um agent pode consumir todo o limite de rate da API em horas, tanto bloqueando outros agents quanto gerando custo descontrolado.

**Cálculo**:
```
Sem limite: agent com comportamento anômalo consome
- 10M tokens/hora de input × $3/1M = $30/hora
- Por dia: $720
- Por mês: $21.600 apenas um agent descontrolado
```

**Implementação de budget**:
```typescript
interface AgentTokenBudget {
  agentId: string;
  inputTokensPerHour: number;
  outputTokensPerHour: number;
  dailyCostCapUsd: number;
  alertAt: number; // percentual (0.8 = 80%)
}
```

---

### COST-006 — KEDA com Trigger Barulhento — Thrash de Scaling

**Cenário**:  
ScaledObject configurado com trigger de Prometheus que oscila em torno do threshold. A cada 30-60 segundos, o KEDA alterna entre scale-up e scale-down.

**Cálculo em EKS (produção)**:
```
EKS m5.large on-demand: ~$0,096/hora
Cada scale-up adiciona 1 nó por 60 segundos antes de scale-down

Thrash sem cooldown:
- 60 eventos de scale-up por hora
- Custo de instância por hora: $0,096
- Custo de thrash por hora: $0,096/hora (instância ficando apenas 1 min)
- Por dia: $2,30
- Por mês: ~$70 em custo puro de thrash por ScaledObject

Com 10 ScaledObjects em thrash simultâneo:
- $700/mês em custo de thrash desnecessário

Além do custo, cada scale-up/down consome quota de API do EC2.
```

**Detector**: `velya_keda_scaling_events_total` — alerta se > 10 eventos em 1 hora por ScaledObject.

**Circuit breaker**: `cooldownPeriod: 300` em todos os ScaledObjects.

**Kill switch**: Desativar KEDA e usar réplicas fixas em emergência.

**Custo estimado no pior caso (mensal em EKS)**: $700+ por thrash de 10 ScaledObjects

---

### COST-007 — Sem maxReplicaCount Configurado

**Cenário**:  
ScaledObject sem `maxReplicaCount`. Um metric spike falso (ex: Prometheus retornou valor errado) dispara scale para 100 pods.

**Cálculo em EKS**:
```
100 pods de patient-flow-service (1 vCPU, 512MB cada):
- Requerem ~25 instâncias m5.large
- Custo: 25 × $0,096/hora = $2,40/hora
- Se o spike dura 2 horas: $4,80
- Se ninguém percebe e fica 24h: $57,60

Sem maxReplicaCount, o scale não tem teto.
Com metric spike muito alto: escala para 1000+ pods
Custo: 250+ instâncias × $0,096 = $24/hora = $576/dia
```

**Controle**:
```yaml
spec:
  minReplicaCount: 1
  maxReplicaCount: 10  # Sempre definir explicitamente
  triggers: [...]
```

**Kill switch**: `kubectl patch scaledobject <nome> --patch '{"spec":{"maxReplicaCount":1}}'`

---

### COST-008 — Label patient_id no Prometheus — Explosão de Cardinality

**Cenário**:  
Um desenvolvedor adiciona `patient_id` como label de uma métrica de request. Com 10.000 pacientes únicos, isso cria 10.000 séries temporais para cada métrica afetada. Com 20 métricas afetadas, são 200.000 séries extras.

**Cálculo de custo**:
```
Prometheus resource com cardinality normal:
- 500k séries: ~2GB de RAM, 1GB de storage/dia

Com explosão de cardinality (patient_id em 20 métricas):
- +200k séries
- RAM adicional: ~0,8GB por 200k séries
- Storage adicional: ~400MB/dia = ~12GB/mês

Em Grafana Cloud ou AWS Managed Prometheus:
- Grafana Cloud pricing: $8 / 1M active series / mês
- 200k séries extras × $8/1M = $1,60/mês (custo baixo mas performance impacto é alto)

O real problema não é custo — é o OOMKill do Prometheus:
- Prometheus fica sem memória, crashea
- Perda de todas as métricas e alertas
- Custo indireto: incidente, SLA violado, horas de engenharia para remediar
```

**Detector**: `prometheus_tsdb_head_series > 1_000_000` — alerta crítico.

**Kill switch**: Remover a label problemática e fazer recording rule.

---

### COST-009 — Sem Política de Retenção no Loki

**Cenário**:  
Loki armazena logs indefinidamente. Com volume real de hospital (múltiplos serviços, logs de AI, traces de eventos NATS):

**Cálculo**:
```
Logs por serviço por dia (estimativa com dados reais):
- patient-flow-service: ~500MB/dia (requests de pacientes + eventos)
- AI Gateway: ~1GB/dia (prompts + responses, se não houver sanitização)
- discharge-orchestrator: ~200MB/dia
- Outros 6 serviços: ~1GB/dia total

Total: ~2,7GB/dia = 81GB/mês

Custo de storage Loki (S3 backend em AWS):
- S3 Standard: $0,023/GB = $1,86/mês em storage puro
- (Barato, mas crescimento ilimitado é problemático em longo prazo)

Em 1 ano: ~972GB = $22,36/mês
Em 3 anos: ~2,9TB = $66/mês

O problema real: sem retenção, os logs com PHI ficam para sempre.
Risco legal > risco financeiro aqui.
```

**Implementação**:
```yaml
# Loki config: retenção de 30 dias
limits_config:
  retention_period: 720h  # 30 dias

table_manager:
  retention_deletes_enabled: true
  retention_period: 720h
```

---

### COST-010 — Trace Sampling a 100% com Volume Alto

**Cenário**:  
OTel Collector com 100% de sampling. Com volume real hospitalar:

**Cálculo**:
```
Traces por dia estimado (hospital com 200 leitos):
- 10.000 requests HTTP por dia
- 50.000 eventos NATS por dia
- 5.000 chamadas de AI por dia
- Total de spans: ~200.000/dia

Tamanho médio por span: 1KB
Total: 200MB de traces por dia = 6GB/mês

Em Grafana Cloud Tempo:
- $0,35 / GB = $2,10/mês (aceitável)

Problema: com volume 10x maior (hospital grande ou bug de logging):
- 2GB/dia = 60GB/mês = $21/mês em traces

Com 100% de erros (ex: cascata de falhas gerando milhares de retries):
- Volumes explosivos de traces em momento de crise — quando mais se precisa do sistema

Implementar tail-based sampling:
- 100% de traces com erros
- 5% de traces de sucesso
- Redução de 20x em volume de traces normais
```

---

## Matriz de Cenários por Custo e Probabilidade

| ID | Cenário | Custo Mensal Pior Caso | Probabilidade | Detector Implementado | Kill Switch |
|---|---|---|---|---|---|
| COST-001 | Agent em retry loop com LLM | $23.000 | Alta | Ausente | Ausente |
| COST-002 | Market intelligence loop | $13.500 | Média | Ausente | Ausente |
| COST-003 | Orchestrator fan-out de sub-agents | $93.000 | Baixa | Ausente | Ausente |
| COST-004 | Opus para tarefas simples | $664+ de desperdício | Alta | Ausente | Ausente |
| COST-005 | Sem token budget por agent | $21.600 | Média | Ausente | Ausente |
| COST-006 | KEDA thrash (EKS) | $700 | Alta | Ausente | Ausente |
| COST-007 | Sem maxReplicaCount | $576/dia | Baixa | Ausente | Parcial |
| COST-008 | Cardinality explosion Prometheus | OOMKill (indireto) | Média | Ausente | Ausente |
| COST-009 | Loki sem retenção (PHI) | $66/mês (+ risco legal) | Imediata | Ausente | Ausente |
| COST-010 | Trace 100% sampling | $21+ em crise | Alta | Ausente | Ausente |

---

## Implementação de Budget Cap Global

```typescript
// Budget cap diário de AI — implementar no AI Gateway
interface DailyBudget {
  totalUsdLimit: number;
  perAgentUsdLimit: number;
  alertAtPercent: number;
  killAtPercent: number;
}

const PRODUCTION_BUDGET: DailyBudget = {
  totalUsdLimit: 500,         // $500/dia total de AI
  perAgentUsdLimit: 50,       // $50/dia por agent
  alertAtPercent: 0.80,       // Alerta em 80%
  killAtPercent: 1.00,        // Para em 100%
};
```

**AWS Budgets (para EKS)**:
```hcl
# OpenTofu: criar budget alert para EKS
resource "aws_budgets_budget" "velya_monthly" {
  name         = "velya-monthly-cap"
  budget_type  = "COST"
  limit_amount = "5000"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator = "GREATER_THAN"
    notification_type   = "ACTUAL"
    threshold           = 80
    threshold_type      = "PERCENTAGE"
    subscriber_email_addresses = ["ops@velya.health"]
  }
  
  notification {
    comparison_operator = "GREATER_THAN"
    notification_type   = "ACTUAL"
    threshold           = 100
    threshold_type      = "PERCENTAGE"
    subscriber_email_addresses = ["cto@velya.health", "ops@velya.health"]
  }
}
```

> **Situação crítica**: Nenhum dos detectores, circuit breakers, ou kill switches está implementado. A plataforma está em posição de gerar custo ilimitado em qualquer dos cenários acima sem detecção automática.
