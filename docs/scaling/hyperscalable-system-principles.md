# Princípios do Sistema Hyperscalável Velya

**Versão:** 1.0  
**Domínio:** Arquitetura de Escalabilidade  
**Classificação:** Documento de Referência Arquitetural  
**Data:** 2026-04-08

---

## Mandato Central

> **A Velya escala horizontalmente com inteligência — por evento, por fila, por carga real — sem colapsar custo, sem perder governança e sem degradação invisível.**

Escalabilidade na Velya não é uma feature de infraestrutura. É um princípio de design de produto. Cada serviço, cada workflow, cada agent deve ser capaz de responder a variações de carga sem intervenção manual, sem surpresas de custo e sem impacto silencioso na qualidade clínica.

---

## Por Que Hyperscalabilidade é Crítica na Velya

A Velya opera em um ambiente de saúde onde:

- **Picos são previsíveis e imprevisíveis simultaneamente**: alta de manhã (admissões), pico de tarde (alta de pacientes), surtos noturnos (emergências).
- **A latência tem consequência clínica**: um alerta atrasado ou uma tarefa não executada pode afetar desfechos reais.
- **A carga de LLM é cara e volátil**: chamadas ao ai-gateway consomem orçamento de tokens com variação 10x entre dias.
- **A base de clientes cresce por instituição**: cada hospital onboardado multiplica eventos, filas e usuários simultâneos.

---

## As 8 Camadas de Escalabilidade Velya

```
┌─────────────────────────────────────────────────────────┐
│  Camada 8: Institucional / Multi-Tenant                 │
│  Isolamento por namespace, quota por office, RBACs      │
├─────────────────────────────────────────────────────────┤
│  Camada 7: Cognitiva / Agent                            │
│  Budget de tokens, tool trust, context freshness        │
├─────────────────────────────────────────────────────────┤
│  Camada 6: Workflow / Durabilidade                      │
│  Temporal schedules, retry com compensation             │
├─────────────────────────────────────────────────────────┤
│  Camada 5: Jobs / Batch                                 │
│  CronJobs K8s, KEDA queue triggers, Argo Workflows      │
├─────────────────────────────────────────────────────────┤
│  Camada 4: Evento / Mensagem                            │
│  NATS JetStream, filas, DLQ, backpressure               │
├─────────────────────────────────────────────────────────┤
│  Camada 3: Aplicação / Pod                              │
│  HPA, KEDA, VPA, PDB, readiness gates                   │
├─────────────────────────────────────────────────────────┤
│  Camada 2: Nó / Compute                                 │
│  Karpenter NodePools, Spot/On-Demand, bin packing       │
├─────────────────────────────────────────────────────────┤
│  Camada 1: Dados / Storage                              │
│  PVCs, S3 offload, connection pooling, read replicas    │
└─────────────────────────────────────────────────────────┘
```

Cada camada tem seus próprios mecanismos de scaling, seus próprios SLOs e suas próprias failure modes. O sistema é saudável somente quando todas as 8 camadas estão em equilíbrio.

---

## Camada 1: Dados e Storage

### Princípios

- **Connection pools são obrigatórios**: nenhum serviço abre conexões diretas ao PostgreSQL sem PgBouncer ou Prisma connection pooling.
- **S3 como tier frio**: dados históricos de pacientes (>90 dias), logs de workflows, snapshots de contexto de agents.
- **Read replicas para consultas analíticas**: relatórios e dashboards nunca batem no primário.
- **Cache Redis para hot paths**: patient context, task queues, session state.

### Escalabilidade de Storage em kind-velya-local

No ambiente local, os PVCs usam `standard` StorageClass. Em EKS, migrar para `gp3` (EBS) com:

- `throughput: 250 MBps`
- `iops: 6000`
- `type: gp3`

### Regra de Ouro dos Dados

> **Dado em memória que não é persistido é dado perdido. Toda state crítica vai para storage durável antes de retornar 2xx.**

---

## Camada 2: Nó e Compute

### Filosofia de Provisionamento

A Velya não provisiona nós manualmente. Em EKS, Karpenter é o único provisionador. Cada NodePool tem:

- **Família de instância declarada** (não "qualquer")
- **Tipo de capacidade declarado** (Spot ou On-Demand, nunca ambos sem política)
- **Budget de custo máximo** (maxReplicaCount e instance price ceiling)
- **Disruption policy** (consolidação agressiva em batch, conservadora em realtime)

### Bin Packing vs Spreading

| Workload               | Estratégia           | Razão                                     |
| ---------------------- | -------------------- | ----------------------------------------- |
| api-gateway            | Spreading por AZ     | Alta disponibilidade, latência previsível |
| patient-flow-service   | Spreading por nó     | Isolamento de falhas                      |
| discharge-orchestrator | Packing              | Custo, workload stateless                 |
| ai-agent-workers       | Packing em GPU nodes | Localidade de modelo                      |
| CronJobs               | Packing em Spot      | Custo mínimo                              |

---

## Camada 3: Aplicação e Pod

### O Tridente de Scaling

A Velya usa três mecanismos de scaling de pod, com regras estritas de uso:

```
HPA ──────────────── Para tráfego HTTP previsível
KEDA ─────────────── Para eventos, filas, métricas custom
VPA ──────────────── Para right-sizing de requests/limits
```

**Regra de não-conflito:**

- HPA e KEDA **nunca** controlam o mesmo deployment simultaneamente.
- VPA em modo `Auto` **nunca** coexiste com HPA na mesma dimensão (CPU).
- VPA pode usar modo `Initial` com HPA para requests, sem conflito.

### Readiness Gates

Todo pod de serviço crítico (api-gateway, patient-flow, discharge-orchestrator) deve ter:

```yaml
readinessProbe:
  httpGet:
    path: /healthz/ready
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 3
  successThreshold: 1
livenessProbe:
  httpGet:
    path: /healthz/live
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 5
startupProbe:
  httpGet:
    path: /healthz/startup
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 30
```

### Limites de Recursos Obrigatórios

Nenhum pod entra em produção sem `requests` e `limits` explícitos. Namespace ResourceQuotas garantem isso via `LimitRange`.

---

## Camada 4: Evento e Mensagem

### NATS JetStream como Backbone de Eventos

A Velya usa NATS JetStream para:

- Eventos clínicos (admissões, altas, transferências)
- Tarefas assíncronas (notificações, enriquecimento de dados)
- Comunicação inter-serviços event-driven
- Replay de eventos para debugging e auditoria

### Topologia de Streams

```
velya.clinical.events   ──── admissão, alta, transferência, alerta
velya.tasks.inbox       ──── tarefas geradas para task-inbox-service
velya.ai.requests       ──── solicitações para ai-gateway workers
velya.discharge.queue   ──── discharge-orchestrator input queue
velya.audit.log         ──── audit trail imutável
```

### Backpressure Inteligente

O sistema detecta acúmulo de fila e age em 3 estágios:

| Estágio  | Profundidade | Ação                                    |
| -------- | ------------ | --------------------------------------- |
| Amarelo  | > 500 msgs   | KEDA scale-up de workers                |
| Laranja  | > 2000 msgs  | Throttle de novas entradas, priorização |
| Vermelho | > 10000 msgs | Circuit breaker, modo degradado         |

### Dead Letter Queue

Todo stream tem DLQ configurado:

- `max_deliver: 5` tentativas antes de DLQ
- `ack_wait: 30s` para tasks normais, `300s` para tasks longas
- Alerta Prometheus dispara quando DLQ cresce > 10 msgs/min

---

## Camada 5: Jobs e Batch

### Hierarquia de Jobs

```
CronJob K8s ──── Simples, sem dependências, tolerante a falha única
     │
Argo Workflow ── Multi-step, com DAG, artefatos, retry por step
     │
Temporal Schedule ── Durável, com compensation, exige consistência
```

### Regra de Ouro dos Jobs

> **Use o executor mais simples que resolve o problema. Não adicione durabilidade onde não é necessária. Não use CronJob onde durabilidade é crítica.**

### Exemplos Velya

| Job                     | Executor          | Frequência    | Razão                             |
| ----------------------- | ----------------- | ------------- | --------------------------------- |
| cost-sweep              | CronJob           | Diário 2h     | Simples, idempotente              |
| report-generation       | CronJob + agent   | Diário 6h     | Simples com síntese LLM           |
| discharge-orchestration | Temporal Schedule | Evento-driven | Exige durabilidade, compensation  |
| patient-flow-routing    | KEDA + worker     | Contínuo      | Event-driven, fila NATS           |
| market-intelligence     | Batch agent       | Semanal       | Long-running, pode falhar e retry |

---

## Camada 6: Workflow e Durabilidade

### Temporal como Engine de Durabilidade

Workflows duráveis na Velya usam Temporal quando:

1. O processo tem mais de 3 steps
2. Qualquer step pode falhar e precisar de retry com backoff
3. Existe compensation logic (rollback parcial)
4. O processo precisa de visibilidade de estado intermediário
5. A execução pode durar mais de 30 segundos

### Namespaces Temporal por Ambiente

```
velya-dev     ──── kind-velya-local, retention 3 dias
velya-staging ──── EKS staging, retention 7 dias
velya-prod    ──── EKS prod, retention 30 dias
```

### Overlap Policies para Schedules

| Política               | Uso                                                  |
| ---------------------- | ---------------------------------------------------- |
| `SKIP`                 | Reports diários — não acumular                       |
| `BUFFER_ONE`           | Discharge orchestration — processar mas não empilhar |
| `ALLOW_ALL`            | Nunca usar em prod — risco de thundering herd        |
| `TERMINATE_IF_RUNNING` | Sweeps de custo — nova execução é mais atual         |

---

## Camada 7: Cognitiva e Agent

### Budget de Tokens por Agent

Cada agent na Velya tem um orçamento de tokens diário declarado e monitorado:

| Agent                     | Tokens/dia (estimado) | Budget Limite | Ação em Breach    |
| ------------------------- | --------------------- | ------------- | ----------------- |
| discharge-summary-agent   | 500k                  | 1M            | Alerta + throttle |
| patient-context-agent     | 200k                  | 500k          | Alerta            |
| market-intelligence-agent | 2M                    | 5M            | Alerta + pausa    |
| cost-analysis-agent       | 100k                  | 300k          | Alerta            |

### Tool Trust Tiers

```
Tier 0: Read-only, sem efeitos colaterais (buscar dados, consultar)
Tier 1: Escrita em sistemas internos (criar tarefa, atualizar status)
Tier 2: Integração externa (enviar notificação, chamar API parceiro)
Tier 3: Ação clínica indireta (gerar recomendação documentada)
Tier 4: Impacto clínico direto (NUNCA sem aprovação humana explícita)
```

### Context Engineering

O contexto de um agent deve ser:

- **Mínimo suficiente**: não incluir o prontuário completo quando só precisa do diagnóstico de admissão
- **Confiável**: com timestamp e fonte explícitos
- **Atualizado**: SLA de freshness por tipo de dado
- **Sem ruído**: sem logs, sem metadados operacionais irrelevantes

---

## Camada 8: Institucional e Multi-Tenant

### Isolamento por Namespace

```
velya-dev-core          ──── Serviços core: api-gateway, patient-flow
velya-dev-platform      ──── Infraestrutura: temporal, NATS, Redis
velya-dev-agents        ──── AI workers e agents
velya-dev-web           ──── Frontend Next.js
velya-dev-observability ──── Prometheus, Grafana, Loki, Tempo
```

### ResourceQuotas como Proxy de Budget

Cada namespace tem ResourceQuota que serve como teto de custo:

```yaml
# Exemplo: velya-dev-agents
apiVersion: v1
kind: ResourceQuota
metadata:
  name: velya-agents-quota
  namespace: velya-dev-agents
spec:
  hard:
    requests.cpu: '8'
    requests.memory: 16Gi
    limits.cpu: '16'
    limits.memory: 32Gi
    pods: '50'
    count/deployments.apps: '20'
```

### PriorityClasses da Velya

```
velya-system-critical  ──── 2000000  ──── Temporal, NATS, Redis
velya-realtime         ──── 1000000  ──── api-gateway, patient-flow
velya-default          ──── 0        ──── task-inbox, discharge-orch
velya-batch            ──── -100     ──── CronJobs, batch workers
velya-background       ──── -200     ──── agents assíncronos, sweeps
```

---

## Regras de Elasticidade Inteligente

### Além de CPU e RAM

A escalabilidade da Velya vai além das métricas tradicionais:

#### 1. Scaling por Profundidade de Fila (Queue Depth)

```
Trigger: velya_nats_pending_messages{stream="discharge.queue"} > 100
Ação: Escalar discharge-orchestrator workers (KEDA)
```

#### 2. Scaling por Latência P99

```
Trigger: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 0.5
Ação: Escalar api-gateway (HPA com métrica custom)
```

#### 3. Scaling por Backlog Age

```
Trigger: velya_queue_oldest_message_age_seconds > 300
Ação: Scale-up emergencial, alerta de operação
```

#### 4. Scaling por Budget Cognitivo Restante

```
Trigger: velya_ai_tokens_remaining_today / velya_ai_tokens_budget_daily < 0.1
Ação: Throttle agents de baixa prioridade, preservar budget para críticos
```

#### 5. Scaling por Taxa de Retry

```
Trigger: rate(velya_temporal_workflow_retry_total[5m]) > 10
Ação: Investigar dependência externa, alertar operação
```

### Regras de Não-Escalar

Tão importante quanto saber quando escalar é saber quando **não** escalar:

| Condição                 | Não Escalar              | Motivo                              |
| ------------------------ | ------------------------ | ----------------------------------- |
| Spike < 30s              | Não escalar HPA          | Cooldown default 30s — seria inútil |
| Memory leak detectado    | Não escalar              | Escalar mascara o problema          |
| Dependência externa down | Não escalar workers      | Acumulariam filas sem processar     |
| Budget de custo esgotado | Não escalar além do teto | Proteção financeira                 |
| PDB violado              | Não scale-down           | Proteção de disponibilidade         |

---

## Princípios de Governança do Scaling

### 1. Observabilidade Antes de Automação

> **Nenhum mecanismo de autoscaling é ativado sem métricas e alertas configurados para monitorá-lo.**

Antes de criar um ScaledObject KEDA ou HPA, você deve ter:

- Dashboard Grafana mostrando a métrica de trigger
- Alerta Prometheus para anomalias da métrica
- Log de eventos de scale no Loki

### 2. Falha Explícita, Nunca Silenciosa

> **Erros de scaling são sempre visíveis. Filas crescendo, pods em CrashLoop, nodes não provisionados — todos devem disparar alertas.**

### 3. Budget como Cidadão de Primeira Classe

> **Custo não é uma preocupação de infraestrutura. É um constraint de negócio. Deve ser representado em código (ResourceQuota, maxReplicaCount, NodePool price ceiling).**

### 4. Testes de Scaling são Obrigatórios

Antes de qualquer mudança em HPA, KEDA, NodePool ou VPA em staging/prod:

1. Executar cenário de carga em kind-velya-local
2. Validar métricas de scaling no Grafana
3. Confirmar que SLOs foram mantidos
4. Confirmar que custos não excederam envelope esperado

### 5. Reversibilidade

Todo mecanismo de scaling deve poder ser desativado em < 5 minutos:

- HPA: `kubectl patch hpa ... --patch '{"spec":{"minReplicas":X,"maxReplicas":X}}'`
- KEDA: `kubectl annotate scaledobject ... autoscaling.keda.sh/paused=true`
- NodePool: `kubectl patch nodepool ... --patch '{"spec":{"disruption":{"consolidationPolicy":"WhenEmptyAndUnderutilized"}}}'`

---

## Anti-Padrões Proibidos

### Anti-Padrão 1: Hardcoded Replica Count em Produção

```yaml
# PROIBIDO em produção
spec:
  replicas: 3 # hardcoded sem HPA
```

```yaml
# CORRETO
spec:
  replicas: 2 # mínimo, HPA controla o máximo
```

### Anti-Padrão 2: Scaling Sem Readiness Probe

Pods que escalam sem readiness probe adequada causam tráfego para instâncias não-prontas, degradando latência durante scale-up.

### Anti-Padrão 3: CronJob para Processo Durável

```yaml
# PROIBIDO: CronJob para processo de 30+ minutos com estado
kind: CronJob
spec:
  schedule: '0 * * * *'
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: discharge-orchestrator
              # Este processo precisa de Temporal, não CronJob
```

### Anti-Padrão 4: Agent Sem Budget de Tokens

Nenhum agent é deployado sem:

- `velya.ai/token-budget-daily` annotation
- Métricas de consumo de tokens no Prometheus
- Alerta de breach de budget

### Anti-Padrão 5: Scale-Down Agressivo em Workloads Stateful

Workloads com estado local (sessões, cache em memória) precisam de `preStop` hook e drain antes do scale-down:

```yaml
lifecycle:
  preStop:
    exec:
      command: ['/bin/sh', '-c', 'sleep 15 && /app/drain.sh']
```

---

## Métricas de Saúde do Sistema Hyperscalável

### SLOs do Sistema de Scaling

| Métrica                                | Target     | Alerta       |
| -------------------------------------- | ---------- | ------------ |
| Tempo de scale-up (pod ready)          | < 60s      | > 120s       |
| Tempo de node provisioning (Karpenter) | < 3min     | > 5min       |
| Queue backlog clearance                | < 5min     | > 15min      |
| DLQ growth rate                        | 0 msgs/min | > 5 msgs/min |
| Scale oscillation events               | < 2/hora   | > 5/hora     |
| Budget breach events                   | 0/dia      | Qualquer     |

### Dashboard de Saúde

O Grafana dashboard `Velya - Hyperscale Health` deve mostrar em tempo real:

1. Replica count por deployment (atual vs min vs max)
2. Queue depth por stream NATS
3. Node count por NodePool e tipo de instância
4. Budget de tokens consumido/restante
5. Scale events timeline (últimas 6h)
6. Pressão de recursos por namespace (quota utilization)

---

## Roadmap de Maturidade

### Nível 1 (Atual — kind-velya-local)

- [x] PriorityClasses configuradas
- [x] ResourceQuotas por namespace
- [x] KEDA instalado
- [ ] HPA em api-gateway
- [ ] KEDA ScaledObject em discharge-orchestrator

### Nível 2 (EKS Staging)

- [ ] Karpenter NodePools por workload class
- [ ] HPA em todos os serviços HTTP
- [ ] KEDA em todos os workers event-driven
- [ ] VPA em modo Initial para right-sizing
- [ ] Temporal com namespaces por ambiente

### Nível 3 (EKS Produção)

- [ ] VPA em modo Auto para workloads batch
- [ ] Goldilocks para recomendações contínuas
- [ ] Budget alerts via Prometheus + PagerDuty
- [ ] Scale testing automatizado em CI/CD
- [ ] Multi-AZ spreading com topology constraints

### Nível 4 (Hyperscale)

- [ ] Predictive scaling baseado em padrões históricos
- [ ] KRON-based (cronológico + evento) scheduling
- [ ] Multi-cluster federation para isolamento por região
- [ ] Autonomous cost optimization via agente

---

## Referências e Dependências

- `nodepool-nodeclass-strategy.md` — Estratégia de NodePools
- `hpa-keda-vpa-strategy.md` — Configuração de autoscaling
- `workload-classes-model.md` — Classificação de workloads
- `cost-and-budget-guardrails.md` — Guardrails financeiros
- `autoscaling-failure-modes.md` — Modos de falha
- `test-scenarios.md` — Cenários de validação

---

_Documento mantido pela equipe de Arquitetura Velya. Revisão obrigatória a cada release de infraestrutura._
