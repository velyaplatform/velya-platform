# Modelo de Pause, Resume e Quarantine — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Namespace:** velya-dev-agents  
**Última revisão:** 2026-04-08

---

## 1. Os Modos Formais de Estado de Agent

Cada agent na Velya pode estar em um dos seguintes estados formais. O estado atual é persistido no ConfigMap `agent-state` no namespace `velya-dev-agents` e lido pelo Heartbeat Monitor e pelo Watchdog a cada 60 segundos.

```
                    ┌─────────────────────┐
                    │       ACTIVE        │◄────────────────────────────┐
                    │  Processando normal │                             │
                    └─────────┬───────────┘                             │
                              │                                         │
          ┌───────────────────┼───────────────────────────────┐        │
          │                   │                               │        │
          ▼                   ▼                               ▼        │
    ┌──────────┐       ┌──────────────┐               ┌──────────────┐ │
    │  PAUSED  │       │ MAINTENANCE  │               │   SHADOW     │ │
    │ Suspenso │       │  Manutenção  │               │ Modo sombra  │ │
    └──────┬───┘       └──────┬───────┘               └──────┬───────┘ │
           │                  │                              │         │
           │                  └──────────────────────────────┘         │
           │                                                           │
           ▼                                                           │
    ┌──────────────┐                                                   │
    │   DEGRADED   │◄────────────────── auto-detect ───────────────────│
    │  Capacidade  │                                                   │
    │   reduzida   │                                                   │
    └──────┬───────┘                                                   │
           │                                                           │
           ▼                                                           │
    ┌──────────────┐       ┌───────────────┐       ┌────────────────┐  │
    │  QUARANTINE  │──────►│ INVESTIGATION │──────►│   PROBATION   │──┘
    │   Isolado    │       │ Investigando  │       │  Monitorado    │
    └──────────────┘       └───────────────┘       └────────────────┘
                                                           │
                                                           ▼
                                                   ┌───────────────┐
                                                   │    RETIRED    │
                                                   │  Aposentado   │
                                                   └───────────────┘
```

### 1.1 Estado: active

**Definição:** Estado normal de operação. O agent está processando tasks, enviando heartbeats regulares, e operando dentro dos SLAs definidos.

**Critérios de entrada:** Agent saudável, todos os health checks passando, confidence acima do threshold.

**Heartbeat obrigatório:** Sim, na frequência padrão da classe.

---

### 1.2 Estado: paused

**Definição:** Processamento de novas tasks suspenso por decisão operacional. Tasks em andamento são concluídas normalmente.

**Quem pode pausar:**

- Watchdog Office (resposta automática a anomalia)
- On-call engineer (via comando manual)
- Sistema durante transição de modo operacional

**Comportamento durante pause:**

- Worker para de consumir novas mensagens da fila NATS (não dá pull em novas mensagens)
- Tarefas já com lease adquirido são concluídas ou têm lease liberado
- Heartbeat continua com `current_state: paused`
- Fila NATS continua acumulando mensagens (não perde dados)
- Após 30 minutos em pause, sistema sugere resume ou transição para maintenance

**Como pausar um agent:**

```bash
# Via comando kubectl (patch no ConfigMap)
kubectl patch configmap agent-state \
  -n velya-dev-agents \
  --patch '{"data": {"task-inbox-worker.state": "paused", "task-inbox-worker.paused_at": "2026-04-08T14:30:00Z", "task-inbox-worker.paused_by": "ops-watchdog", "task-inbox-worker.pause_reason": "retry_storm_detected"}}'

# Via script de operações
velya-ops agent pause task-inbox-worker \
  --reason "retry_storm_detected" \
  --duration 15m \
  --auto-resume true
```

---

### 1.3 Estado: maintenance

**Definição:** Janela de manutenção planejada. O agent está indisponível intencionalmente para atualização, migração ou reconfiguração.

**Comportamento:**

- Pod pode ser reiniciado, atualizado ou deletado
- Tasks na fila são redirecionadas para fallback se configurado
- Heartbeat pode estar ausente (tolerado durante maintenance)
- Duração máxima padrão: 4 horas

---

### 1.4 Estado: degraded

**Definição:** Agent funcionando com capacidade reduzida. Pode estar processando mais lentamente, com accuracy reduzida, ou com algumas ferramentas indisponíveis.

**Critérios de entrada automática:**

- Confidence médio 1h < 0.70 (mas > 0.50)
- Taxa de erro de tools > 30%
- Latência de processamento > 3x o P99 normal
- Retry rate > 30%

**Comportamento:**

- Continua processando apenas tasks de alta prioridade
- Emite heartbeat com `health.status: degraded`
- Watchdog é notificado imediatamente
- Sem novas tasks de prioridade baixa/normal

---

### 1.5 Estado: shadow

**Definição:** Agent executa em modo sombra — processa as mesmas mensagens que o sistema de produção mas não aplica os outputs. Usado para validação de novos agents e mudanças de comportamento.

**Comportamento:**

- Recebe mensagens via fan-out NATS
- Processa normalmente, incluindo chamadas a LLM
- Publica outputs em `velya.agents.shadow.{agent_name}` (não no destino real)
- Métricas de comparação geradas automaticamente
- Nenhuma escrita em sistemas reais

**Critérios de promoção de shadow para active:**

- 7+ dias em shadow sem incidentes
- Accuracy comparada a produção >= 0.90
- Custo de inferência dentro do budget estimado
- Approval formal do Architecture Review Office

---

### 1.6 Estado: quarantine

**Definição:** Agent isolado por comportamento anômalo ou violação de política. Não processa novos trabalhos. Sob investigação ativa.

**Detalhado na Seção 3 deste documento.**

---

### 1.7 Estado: probation

**Definição:** Agent recentemente requalificado após quarantine ou shadow. Monitorado com intensidade maior por período definido.

**Comportamento:**

- Processa tasks normalmente (semelhante a active)
- Heartbeat mais frequente (50% do intervalo normal)
- Todas as tasks passam por revisão manual ou por Governance Agent
- Score mínimo para sair de probation: 0.85 por 30 dias consecutivos
- Qualquer incidente durante probation reinicia o contador

---

### 1.8 Estado: investigation

**Definição:** Investigação formal em andamento. Agent estava em quarantine e está sendo analisado para determinar se pode ser requalificado ou deve ser aposentado.

**Ações durante investigation:**

- Code review do agent
- Análise de logs históricos
- Análise de padrões de erro
- Comparação com versões anteriores
- Decisão formal: requalificação → probation, ou aposentadoria → retired

---

### 1.9 Estado: quiet

**Definição:** Agent ativo mas em modo de baixo impacto. Processa apenas tasks de prioridade baixa que não afetam serviços críticos. Usado durante análise de impacto de mudanças.

**Diferença de paused:** Em `quiet`, o agent ainda processa (lentamente). Em `paused`, o agent não processa nada.

---

## 2. Trilha de Auditoria de Transições

### 2.1 Registro Obrigatório

Toda transição de estado de agent gera um evento de auditoria persistido em:

- NATS stream `VELYA_AUDIT`: `velya.audit.agent-state.{agent_name}`
- Loki com label `event_type=agent_state_transition`
- ConfigMap `agent-state-history` (últimas 50 transições por agent)

### 2.2 Schema do Evento de Transição

```json
{
  "event_type": "agent_state_transition",
  "event_id": "evt-uuid-v4",
  "timestamp": "2026-04-08T14:30:00.000Z",
  "agent_name": "task-inbox-worker",
  "agent_class": "Worker",
  "office": "clinical-operations",
  "from_state": "active",
  "to_state": "quarantine",
  "triggered_by": "ops-watchdog",
  "trigger_type": "automatic",
  "reason": "retry_rate_exceeded_50_percent_for_15_minutes",
  "evidence": {
    "metric": "velya_agent_retry_rate_percent",
    "value": 58.3,
    "threshold": 50,
    "duration_minutes": 15,
    "prometheus_query": "velya_agent_retry_rate_percent{agent_name='task-inbox-worker'}"
  },
  "affected_tasks": 12,
  "queue_redirected_to": "velya.agents.clinical-ops.task-classification.fallback",
  "human_notified": true,
  "notification_channel": "velya-ops-alerts",
  "expected_duration": "PT1H",
  "resolution_plan": "Investigar causa do retry storm. Verificar saúde do patient-flow-service.",
  "rollback_conditions": "retry_rate < 0.10 AND downstream_healthy = true AND human_approval"
}
```

---

## 3. Quarantine: 4 Níveis de Isolamento

O quarantine na Velya tem quatro níveis com graus crescentes de isolamento e impacto:

### 3.1 Quarantine L1 — Soft Isolation

**Triggers automáticos:**

- Retry rate > 50% por mais de 15 minutos
- Confidence médio < 0.60 por mais de 1 hora
- Taxa de validação falha > 30% em 1 hora

**Restrições aplicadas:**

- Agent para de consumir novas mensagens (pause on new tasks)
- Tasks em andamento são concluídas
- Heartbeat continua normalmente
- Acesso a ferramentas não-clínicas mantido para diagnóstico

**Notificação:** Slack `#velya-ops-alerts` com contexto detalhado

**SLA de investigação:** 2 horas

**Saída do L1:**

- Causa identificada e corrigida
- Retry rate < 0.10 por 15 minutos consecutivos
- Human approval do on-call engineer

---

### 3.2 Quarantine L2 — Hard Isolation

**Triggers automáticos:**

- Quarantine L1 não resolvido em 2 horas
- Evidence de comportamento fora do escopo definido detectada
- 3+ validações clínicas falhando na mesma hora

**Restrições aplicadas:**

- Todas as permissões de escrita suspensas
- Acesso a ferramentas clínicas revogado
- Fila redirecionada para worker de fallback
- Todos os leases ativos liberados
- Heartbeat continua (para monitoramento)

**Notificação:** Slack `#velya-ops-critical` + page on-call

**SLA de investigação:** 4 horas com primeiro update em 30 minutos

**Saída do L2:**

- Investigation formal iniciada
- Root cause identificado
- Fix implementado e testado em shadow
- Aprovação do Architecture Review Office

---

### 3.3 Quarantine L3 — Security Isolation

**Triggers:**

- Tentativa de self-modification detectada
- Acesso a dados fora do escopo de RBAC
- Violação de Network Policy detectada
- Output contendo dados de outros pacientes (data leak)

**Restrições aplicadas:**

- Pod imediatamente terminado (não graceful shutdown)
- NetworkPolicy atualizada para bloquear todo tráfego do pod
- Secret access revogado para o ServiceAccount
- Todas as credenciais do agent rotacionadas
- RBAC do ServiceAccount revogado

**Notificação:** Slack `#velya-security-incidents` + page Security Office + page CTO

**SLA de investigação:** Imediato. Ponto único de foco até resolução.

**Saída do L3:**

- Security review completo
- Root cause documentado como Security Incident Report
- Aprovação do Security & Compliance Office E Architecture Review Office
- Agent pode ser recriado do zero com nova identidade

---

### 3.4 Quarantine L4 — Permanent Decommission

**Triggers:**

- Quarantine L3 com evidence de comportamento malicioso
- Agent obsoleto com dependências irrecuperáveis
- Decisão de aposentadoria após Investigation Office review

**Restrições aplicadas:**

- Pod terminado permanentemente
- Deployment deletado
- ServiceAccount e RBAC deletados
- Filas do agent removidas (após confirmação de zero mensagens)
- Configurações arquivadas em repositório de agents aposentados

**Processo de aposentadoria formal:**

1. Decision formal do Architecture Review Office
2. Período de 30 dias em retired (preservado para auditoria)
3. Knowledge transfer: lições aprendidas registradas no Knowledge Office
4. ADR criado documentando por que o agent foi aposentado
5. Deleção final com aprovação de dois membros da equipe sênior

---

## 4. Kill Switches por Criticidade

A Velya mantém um registro formal de kill switches para cada categoria de agent. Um kill switch é a capacidade de parar imediatamente uma categoria de agents sem depender de lógica complexa.

### 4.1 Kill Switch de Nível 1: Office-level Pause

**Ação:** Pausa todos os agents de um office específico.
**Ativação:** Comando kubectl ou script de ops.
**Latência de efeito:** < 60 segundos (agents param de dar pull em novas mensagens).

```bash
# Pausar todos os agents do clinical-operations office
velya-ops office pause clinical-operations \
  --reason "investigação de incidente" \
  --duration 30m

# Equivalente manual:
kubectl annotate deployment -n velya-dev-agents \
  -l velya.io/office=clinical-operations \
  velya.io/paused=true \
  velya.io/paused-reason="incident-investigation"
```

### 4.2 Kill Switch de Nível 2: Class-level Pause

**Ação:** Pausa todos os agents de uma classe específica.
**Uso:** Ex: pausar todos os Batch agents durante manutenção de storage.

```bash
velya-ops agent-class pause Batch --reason "storage maintenance"
```

### 4.3 Kill Switch de Nível 3: Platform-wide Emergency Stop

**Ação:** Para TODOS os workers (não-sentinels, não-watchdogs) imediatamente.
**Uso:** Emergência sistêmica. Deve ser usado com extremo cuidado.
**Ativação:** Requer dois membros da equipe sênior OU automática por Meta-Watchdog em condição definida.

```bash
# Requer confirmação de dois operadores (MFA-like para operações)
velya-ops emergency-stop \
  --preserve sentinel,watchdog \
  --reason "plataforma instável detectada" \
  --operator-1 "João Freire" \
  --operator-2 "on-call-engineer"
```

**Efeito:** KEDA ScaledObjects escalados para 0, CronJobs suspensos, Temporal workers suspensos.

### 4.4 Kill Switch de Nível 4: Circuit Breaker de Inferência LLM

**Ação:** Bloqueia todas as chamadas de inferência LLM da plataforma.
**Uso:** Budget de LLM esgotado ou comprometimento do AI Gateway.
**Efeito:** Agents que dependem de LLM entram em modo degraded automaticamente e processam apenas com regras determinísticas.

```bash
velya-ops llm-circuit-breaker open \
  --reason "budget_exhausted" \
  --notify finops,architecture
```

---

## 5. Mapeamento de Transições Automáticas vs Manuais

| Transição                  | Automática? | Gatilho                              | Aprovação necessária            |
| -------------------------- | ----------- | ------------------------------------ | ------------------------------- |
| active → paused            | Sim         | Watchdog: retry storm, queue buildup | Não                             |
| active → degraded          | Sim         | Confidence < 0.60 por 1h             | Não                             |
| active → shadow            | Não         | Deploy de nova versão                | Architecture Review             |
| active → quarantine L1     | Sim         | Retry rate > 50% por 15min           | Não                             |
| active → quarantine L3     | Sim         | Security policy violation            | Não (imediato)                  |
| quarantine → investigation | Não         | Após L1/L2 confirmado                | On-call engineer                |
| investigation → probation  | Não         | Root cause corrigido                 | Architecture Review             |
| probation → active         | Não         | 30 dias limpos                       | Architecture Review             |
| any → retired              | Não         | Decisão formal                       | Architecture Review + 2 seniors |
| shadow → active            | Não         | 7 dias limpos com accuracy >= 0.90   | Architecture Review             |

---

## 6. Configuração de Estado via ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-state
  namespace: velya-dev-agents
data:
  # Formato: {agent_name}.{campo}: {valor}
  task-inbox-worker.state: 'active'
  task-inbox-worker.state_since: '2026-04-08T10:00:00Z'
  task-inbox-worker.state_reason: 'normal operation'
  task-inbox-worker.state_set_by: 'system'

  discharge-worker.state: 'shadow'
  discharge-worker.state_since: '2026-04-08T08:00:00Z'
  discharge-worker.state_reason: 'new version validation'
  discharge-worker.shadow_target_agent: 'discharge-worker-v1'

  validation-worker.state: 'probation'
  validation-worker.state_since: '2026-03-15T00:00:00Z'
  validation-worker.probation_start: '2026-03-15T00:00:00Z'
  validation-worker.probation_end: '2026-04-15T00:00:00Z'
  validation-worker.probation_days_clean: '24'
```
