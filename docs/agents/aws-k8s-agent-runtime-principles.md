# Princípios de Runtime de Agents em AWS + Kubernetes — Velya Platform

**Versão:** 1.0  
**Namespace primário:** velya-dev-agents  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Última revisão:** 2026-04-08  

---

## 1. Mandato Central: Workflows-First, Agents-When-Needed

A Velya adota uma postura deliberada e conservadora em relação ao uso de agents de IA. O mandato central é:

> **"Use um workflow determinístico sempre que possível. Use um agent somente quando a tarefa exige raciocínio adaptativo que não pode ser codificado como lógica de controle."**

Esse mandato existe porque agents introduzem:
- Latência não determinística
- Custo de inferência por chamada de LLM
- Risco de comportamentos inesperados (hallucination, tool misuse)
- Dificuldade de auditoria e rastreamento causal
- Complexidade operacional adicional no runtime Kubernetes

Workflows Temporal com lógica determinística, por sua vez, oferecem:
- Durabilidade e replay automático via event sourcing
- Custo fixo e previsível
- Auditoria nativa via Temporal Web UI
- Retry/backoff configurável por Activity
- Sem chamadas a LLMs a não ser quando absolutamente necessário

### 1.1 Regra Prática de Decisão

Antes de criar qualquer agent na Velya, o arquiteto responsável deve responder às seguintes perguntas:

| Pergunta | Resposta "Sim" → | Resposta "Não" → |
|---|---|---|
| A tarefa tem etapas completamente previsíveis? | Workflow Temporal | Considerar agent |
| A tarefa requer escolha dinâmica de ferramentas? | Agent | Workflow com switch |
| O resultado correto pode ser validado por regra? | Workflow + Validator | Agent com validator |
| A tarefa tolera latência de 1-10s por LLM call? | Agent | Workflow ou cache |
| O custo de inferência cabe no budget do office? | Verificar budget | Bloquear até justificar |
| Já existe um workflow que faz 80% disso? | Estender o workflow | Novo component |

---

## 2. Classes de Agents da Velya

A Velya define seis classes canônicas de agents. Toda proposta de novo agent deve se encaixar em uma dessas classes ou passar por aprovação formal da Architecture Review Office.

### 2.1 Classe Sentinel

**Responsabilidade:** Monitoramento contínuo de estado, detecção de anomalias, alertas precoces.

**Características operacionais:**
- Executa em loop contínuo com intervalo configurável (padrão: 30s)
- Não executa ações destrutivas diretamente — apenas sinaliza
- Heartbeat obrigatório a cada 60 segundos
- Consome fila NATS `velya.agents.sentinel.{subtipo}`
- Pode escalar via KEDA com base no tamanho da fila

**Exemplos na Velya:**
- `queue-sentinel`: monitora crescimento de filas NATS JetStream
- `heartbeat-sentinel`: detecta agents silenciosos por ausência de heartbeat
- `cost-sentinel`: detecta desvios de custo em relação ao budget por namespace
- `sla-sentinel`: monitora SLAs de tempo de resposta dos serviços

**Resource envelope padrão:**
```yaml
resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    cpu: 200m
    memory: 128Mi
```

**Tolerations no kind-velya-local (simulando EKS worker nodes):**
```yaml
tolerations:
  - key: "velya.io/agent-runtime"
    operator: "Equal"
    value: "sentinel"
    effect: "NoSchedule"
```

---

### 2.2 Classe Worker

**Responsabilidade:** Processamento de tarefas discretas a partir de filas. Um worker consome uma mensagem, executa a tarefa, entrega o resultado.

**Características operacionais:**
- Consome de fila NATS JetStream com ack explícito
- Executa exatamente uma tarefa por vez (single-concurrency por padrão)
- Aplica lease com TTL antes de processar
- Em caso de falha, não faz ack — mensagem volta para a fila após `ack_wait`
- Heartbeat durante processamento longo (a cada 30s)
- Escala horizontal via KEDA (`nats-jetstream` trigger)

**Exemplos na Velya:**
- `task-inbox-worker`: processa itens de inbox clínico, classifica urgência
- `discharge-worker`: executa etapas de checklist de alta hospitalar
- `validation-worker`: valida saídas de outros agents contra regras clínicas

**KEDA ScaledObject padrão para Worker:**
```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: task-inbox-worker-scaler
  namespace: velya-dev-agents
spec:
  scaleTargetRef:
    name: task-inbox-worker
  minReplicaCount: 1
  maxReplicaCount: 8
  cooldownPeriod: 120
  triggers:
    - type: nats-jetstream
      metadata:
        natsServerMonitoringEndpoint: "nats-monitor.velya-dev-platform.svc.cluster.local:8222"
        stream: VELYA_AGENTS
        consumer: task-inbox-worker-consumer
        lagThreshold: "5"
```

---

### 2.3 Classe Batch

**Responsabilidade:** Processamento em lote de grandes volumes de dados em janelas de tempo definidas. Execução via Kubernetes CronJob ou Argo CronWorkflow.

**Características operacionais:**
- Não fica em execução contínua — acordado por schedule
- Deve ter idempotência garantida (re-execução segura)
- Budget de tempo máximo de execução (deadline)
- Se ultrapassar deadline, o job é cancelado e alertado
- Não consome recursos de node de workloads realtime

**Exemplos na Velya:**
- `cost-sweep-batch`: varre custos de cloud por tag a cada 6h
- `audit-batch`: audita logs de decisions de agents nas últimas 24h
- `report-batch`: gera relatórios diários por office para Knowledge Office

**CronJob Kubernetes:**
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cost-sweep-batch
  namespace: velya-dev-agents
spec:
  schedule: "0 */6 * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      activeDeadlineSeconds: 3600
      backoffLimit: 2
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: cost-sweep
              image: velya/cost-sweep-batch:latest
              resources:
                requests:
                  cpu: 200m
                  memory: 256Mi
                limits:
                  cpu: 1000m
                  memory: 512Mi
```

---

### 2.4 Classe Watchdog

**Responsabilidade:** Supervisão ativa de outros agents e workflows. Detecta e responde a falhas sistêmicas.

**Detalhes completos no documento `watchdog-model.md`.**

**Resumo de princípios:**
- Nunca compartilha fila com o agent que supervisiona
- Tem autonomia para pausar agents com base em critérios objetivos
- Reporta ao Meta-Watchdog e ao Prometheus
- Executa em namespace `velya-dev-agents` com RBAC limitado a patch/get de deployments

---

### 2.5 Classe Governance

**Responsabilidade:** Auditoria, compliance, validação de qualidade de outputs de outros agents. Garante que decisões clínicas e operacionais atendam às políticas Velya.

**Características operacionais:**
- Nunca bloqueia o caminho crítico — executa assincronamente
- Publica resultados de auditoria em `velya.audit.{agent_name}.{task_id}`
- Score de qualidade: 0.0 a 1.0 por output auditado
- Threshold mínimo aceitável: 0.75 — abaixo disso abre incidente
- Integra com Loki para logs estruturados e Tempo para traces

**Exemplos:**
- `clinical-governance-agent`: valida que outputs clínicos seguem protocolos
- `cost-governance-agent`: valida que decisões de custo respeitam budgets

---

### 2.6 Classe Learning

**Responsabilidade:** Identificar padrões em correções, incidentes e feedbacks para atualizar templates, validators e playbooks.

**Detalhes completos no documento `learning-loops-model.md`.**

**Princípio crítico:** Nenhuma mudança propagada por um Learning Agent entra em produção sem passar por revisão do Knowledge Office e validação de um Governance Agent.

---

### 2.7 Classe Market Intelligence

**Responsabilidade:** Monitoramento controlado de fontes externas para identificar tecnologias, padrões e riscos relevantes para a Velya.

**Detalhes completos no documento `market-intelligence-loop-model.md`.**

---

## 3. Regras de Tool Quality

Todo agent da Velya que usa ferramentas (tools/functions) deve seguir estas regras:

### 3.1 Princípio da Ferramenta Mínima

Um agent deve ter acesso apenas às ferramentas estritamente necessárias para sua função. Nenhum agent deve ter acesso a:
- Ferramentas de escrita em banco de dados de produção sem revisão humana
- APIs externas que geram custo sem limite configurado
- Ferramentas de deleção sem confirmação de reversibilidade

### 3.2 Classificação de Ferramentas por Risco

| Nível | Tipo | Exemplo | Aprovação necessária |
|---|---|---|---|
| L1 - Read-only | Consulta de dados | `get_patient_queue_status` | Automática |
| L2 - Write local | Escrita em namespace isolado | `update_task_status` | Automática com audit |
| L3 - Write cross-service | Escrita que afeta outros serviços | `trigger_discharge_workflow` | Governance Agent review |
| L4 - External | Chamada a API externa | `call_insurance_api` | Human-in-loop obrigatório |
| L5 - Destructive | Deleção, cancelamento | `cancel_patient_discharge` | Human approval + audit |

### 3.3 Validação de Schema de Tool Output

Todo tool deve retornar um schema validado. O agent não deve processar outputs não-conformes como dados válidos. Em caso de schema inválido:

1. Registrar erro estruturado em Loki: `tool_output_schema_violation`
2. Incrementar contador Prometheus: `velya_tool_schema_violations_total`
3. Não propagar o output para a próxima etapa
4. Abrir item na DLQ: `velya.agents.dlq.tool-schema-violation`

### 3.4 Tool Timeout Obrigatório

Toda chamada de tool deve ter timeout configurado. Padrão por nível:

| Nível | Timeout padrão | Timeout máximo |
|---|---|---|
| L1 | 2s | 10s |
| L2 | 5s | 30s |
| L3 | 10s | 60s |
| L4 | 15s | 120s |

---

## 4. Context Engineering

### 4.1 Princípio do Contexto Mínimo Efetivo

O prompt enviado ao LLM deve conter apenas o contexto necessário para a decisão atual. Contexto excessivo:
- Aumenta custo de tokens
- Degrada qualidade da resposta (context dilution)
- Aumenta latência

**Estrutura canônica de context window para agents Velya:**

```
[SYSTEM PROMPT - IMUTÁVEL]
Role: {classe de agent} / {nome do agent}
Office: {nome do office}
Task: {descrição exata da tarefa atual}
Constraints: {regras de negócio aplicáveis}
Tools available: {lista de tools com descrições}

[USER PROMPT - POR TAREFA]
Input: {dados da tarefa específica}
Context: {contexto mínimo necessário}
Expected output format: {schema JSON esperado}

[GUARDRAILS REMINDER - SEMPRE INCLUÍDO]
- Não execute ações L3+ sem confirmação
- Retorne ONLY_REFUSE se não tiver confiança suficiente
- Documente incertezas explicitamente
```

### 4.2 Injeção de Contexto Dinâmico

Para agents que precisam de contexto histórico, a injeção é feita via retrieval controlado:

```python
def build_context(task: Task, agent_class: str) -> str:
    base_context = load_base_prompt(agent_class)
    
    # Limite rígido: máximo 3 exemplos históricos
    examples = retrieve_relevant_examples(task, top_k=3)
    
    # Limite rígido: máximo 500 tokens de contexto dinâmico
    dynamic_context = truncate_to_tokens(examples, max_tokens=500)
    
    return f"{base_context}\n\nContexto relevante:\n{dynamic_context}"
```

### 4.3 Evitar Context Stuffing

É explicitamente proibido:
- Incluir logs completos de execuções anteriores no prompt
- Incluir respostas de outros agents sem filtro de relevância
- Incluir dados de pacientes além do estritamente necessário para a tarefa
- Passar tokens não utilizados de uma iteração para outra sem revisão

---

## 5. Guardrails por Default

Todo agent Velya, ao ser instanciado, herda um conjunto de guardrails que não podem ser desabilitados sem aprovação formal da Governance Office.

### 5.1 Guardrails Estruturais Obrigatórios

**G1 - Output Validation:** Todo output de LLM passa por um validator antes de ser usado. O validator verifica schema, range de valores e consistência clínica mínima.

**G2 - Confidence Gate:** Se o LLM retornar confiança < 0.7 (campo `confidence` no output), a tarefa vai para revisão humana automaticamente. Nunca é descartada.

**G3 - Audit Trail:** Toda decisão de agent é registrada com: timestamp UTC, agent_id, task_id, input hash, output hash, confidence, tools_called, tokens_used.

**G4 - Spend Limit:** Cada agent tem um limite de gasto de inferência por hora configurado. Ao atingir 80% do limite, emite alerta. Ao atingir 100%, para novas inferências e drena a fila por regras determinísticas.

**G5 - Human Escalation Gate:** Tarefas com impacto clínico direto (classificadas como `clinical_impact: high`) requerem confirmação humana antes de execução de ações L3+.

**G6 - No Self-Modification:** Nenhum agent pode modificar sua própria configuração, seus próprios validators, ou seus próprios guardrails. Tentativas são logadas como incidente de segurança.

### 5.2 Configuração de Guardrails via ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-guardrails-defaults
  namespace: velya-dev-agents
data:
  confidence_threshold: "0.70"
  max_inference_tokens_per_hour: "100000"
  human_escalation_clinical_impact: "high"
  audit_trail_enabled: "true"
  output_validation_enabled: "true"
  self_modification_allowed: "false"
  max_tool_calls_per_task: "10"
  max_task_duration_seconds: "300"
```

---

## 6. Single-Agent Before Multi-Agent

### 6.1 Regra de Escalada Progressiva

A Velya segue a ordem de complexidade crescente:

```
Nível 0: Workflow Temporal determinístico
    ↓ (somente se não for suficiente)
Nível 1: Single Agent + ferramentas fixas
    ↓ (somente se não for suficiente)
Nível 2: Single Agent com RAG/retrieval
    ↓ (somente se não for suficiente)
Nível 3: Dois agents com handoff simples
    ↓ (somente se não for suficiente)
Nível 4: Multi-agent com orquestrador
    ↓ (requer aprovação Architecture Review)
Nível 5: Multi-agent com supervisor dinâmico
```

### 6.2 Critérios para Subir de Nível

Para subir do Nível N para N+1, é obrigatório documentar:

1. Por que o Nível N falhou ou é insuficiente
2. Qual capacidade específica o Nível N+1 adiciona
3. Quais riscos novos são introduzidos
4. Como esses riscos são mitigados
5. Qual é o custo incremental estimado

Esse documento deve ser aprovado pelo Architecture Review Office antes da implementação.

### 6.3 Anti-Padrões de Multi-Agent a Evitar

- **Agent soup:** múltiplos agents sem orquestrador claro, comunicando por callbacks não rastreáveis
- **Parallelism sem controle:** lançar N agents em paralelo sem coordenar resultados ou detectar falhas parciais
- **Shared mutable state:** agents compartilhando estado mutável sem controle de concorrência
- **Cascading failures:** agent A chama B chama C sem circuit breaker entre as chamadas
- **God agent:** um único agent com acesso a todas as ferramentas e responsabilidade por toda a lógica

---

## 7. Taxonomia de Decisão: Quando Usar Agent vs Workflow

### 7.1 Árvore de Decisão Completa

```
TAREFA NOVA IDENTIFICADA
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ As etapas da tarefa são completamente conhecidas        │
│ antes de iniciar a execução?                            │
└─────────────────────────────────────────────────────────┘
         │                          │
        SIM                        NÃO
         │                          │
         ▼                          ▼
  WORKFLOW TEMPORAL           CANDIDATO A AGENT
  (Atividades determinísticas)       │
                                     ▼
                    ┌───────────────────────────────────┐
                    │ A tarefa requer seleção dinâmica  │
                    │ de ferramentas com base em dados? │
                    └───────────────────────────────────┘
                               │              │
                              SIM            NÃO
                               │              │
                               ▼              ▼
                         AGENT          WORKFLOW + SWITCH
                    (com tool selection)  (lógica de condição)
                               │
                               ▼
                    ┌───────────────────────────────────┐
                    │ A tarefa tem impacto clínico      │
                    │ direto no paciente?               │
                    └───────────────────────────────────┘
                               │              │
                              SIM            NÃO
                               │              │
                               ▼              ▼
                    AGENT + HUMAN-IN-LOOP   AGENT AUTÔNOMO
                    (Governance Gate)        (com guardrails)
```

### 7.2 Tabela de Classificação por Serviço Velya

| Serviço | Função | Tipo Recomendado | Justificativa |
|---|---|---|---|
| discharge-orchestrator | Orquestra etapas de alta | Workflow Temporal | Etapas conhecidas e ordenadas |
| patient-flow-service | Roteamento de pacientes | Workflow + Rules | Lógica de roteamento codificável |
| task-inbox-service | Classificação de urgência | Agent (Classifier) | Requer raciocínio sobre contexto clínico |
| ai-gateway | Roteamento de modelos | Workflow + Config | Regras de roteamento fixas |
| cost-sweep | Análise de anomalias de custo | Agent (Analyst) | Requer interpretação de padrões |
| audit-agent | Revisão de compliance | Agent (Governance) | Requer avaliação qualitativa |
| market-intelligence | Curadoria de fontes externas | Agent + Human review | Requer julgamento e filtragem |

### 7.3 Exemplos Concretos de Decisão

**Discharge Orchestration — Por que Workflow:**
O processo de alta hospitalar tem etapas claramente definidas: validar medicamentos, confirmar transporte, notificar família, liberar prontuário, registrar no sistema. Essas etapas são sempre as mesmas e a ordem é determinística. Um Workflow Temporal com Activities separadas garante durabilidade, retry por etapa, e rastreabilidade completa sem custo de LLM.

**Task Inbox Classification — Por que Agent:**
O inbox clínico recebe itens heterogêneos: pedidos de exame, alertas de medicamento, anotações de enfermagem, solicitações de interconsulta. A urgência depende do contexto clínico do paciente, do horário, do estado atual da unidade e de regras que interagem de formas não triviais. Um LLM com contexto clínico e acesso a ferramenta de lookup do paciente faz essa classificação melhor do que qualquer conjunto de regras fixas.

**Market Intelligence — Por que Agent + Human Review:**
Monitorar o ecossistema técnico requer julgamento sobre relevância, maturidade e adequação ao contexto Velya. Esse julgamento não é codificável em regras fixas. No entanto, qualquer decisão de adotar uma tecnologia nova tem impacto de custo e arquitetura que requer revisão humana.

**Cost Sweep — Por que Agent:**
Anomalias de custo podem ter padrões sutis: uma combinação de crescimento de queue + aumento de retries + mudança de padrão de acesso que individualmente parecem normais mas juntas indicam um problema. Um agent com acesso às métricas de Prometheus e capacidade de raciocínio sobre padrões temporais é mais eficaz que regras de threshold simples.

---

## 8. Configuração de Runtime no Kubernetes

### 8.1 Namespace velya-dev-agents

Todos os agents da Velya rodam no namespace `velya-dev-agents`. O isolamento é garantido por:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: agents-quota
  namespace: velya-dev-agents
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "16"
    limits.memory: 16Gi
    count/pods: "50"
    count/services: "20"
```

### 8.2 ServiceAccount e RBAC

Cada agent tem seu próprio ServiceAccount com permissões mínimas:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: task-inbox-worker
  namespace: velya-dev-agents
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: task-inbox-worker-role
  namespace: velya-dev-agents
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list"]
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["task-inbox-worker-credentials"]
    verbs: ["get"]
```

### 8.3 Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agents-isolation
  namespace: velya-dev-agents
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              velya.io/tier: platform
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              velya.io/tier: platform
    - ports:
        - port: 443  # HTTPS para APIs externas controladas
```

---

## 9. Integração com Observabilidade

### 9.1 Labels Obrigatórias em Todos os Pods de Agent

```yaml
labels:
  app.kubernetes.io/name: task-inbox-worker
  app.kubernetes.io/component: agent
  velya.io/agent-class: worker
  velya.io/office: clinical-operations
  velya.io/criticality: high
  velya.io/version: "1.2.3"
```

### 9.2 Métricas Prometheus Obrigatórias

Todo agent deve expor as seguintes métricas via endpoint `/metrics` na porta 9090:

```
velya_agent_tasks_processed_total{agent, office, status}
velya_agent_task_duration_seconds{agent, office}
velya_agent_llm_tokens_used_total{agent, office, model}
velya_agent_llm_cost_usd_total{agent, office, model}
velya_agent_tool_calls_total{agent, tool, status}
velya_agent_confidence_score{agent, office} (gauge, último valor)
velya_agent_heartbeat_timestamp{agent, office} (gauge, unix timestamp)
velya_agent_queue_lag{agent, queue} (gauge)
velya_agent_retry_count_total{agent, reason}
velya_agent_escalations_total{agent, reason}
```

### 9.3 Logs Estruturados (Loki)

Todos os logs devem ser em JSON com os campos obrigatórios:

```json
{
  "timestamp": "2026-04-08T14:23:01.123Z",
  "level": "info",
  "agent_name": "task-inbox-worker",
  "office": "clinical-operations",
  "task_id": "task-uuid-here",
  "event": "task_completed",
  "duration_ms": 1234,
  "confidence": 0.89,
  "tokens_used": 432,
  "tools_called": ["get_patient_context", "get_queue_state"],
  "output_validated": true
}
```

---

## 10. Checklist de Criação de Novo Agent

Antes de fazer deploy de qualquer novo agent em `velya-dev-agents`, verificar:

- [ ] Classe do agent definida (Sentinel/Worker/Batch/Watchdog/Governance/Learning/Market Intelligence)
- [ ] Justificativa documentada para uso de agent vs workflow
- [ ] Guardrails padrão confirmados no ConfigMap
- [ ] ServiceAccount dedicado criado
- [ ] RBAC mínimo configurado
- [ ] ResourceRequests e Limits definidos
- [ ] Network Policy aplicada
- [ ] Heartbeat implementado (frequência por classe)
- [ ] Métricas Prometheus expostas
- [ ] Logs estruturados em JSON
- [ ] Validator de output implementado
- [ ] Confidence gate implementado
- [ ] Spend limit configurado
- [ ] DLQ owner definido
- [ ] Runbook de operação escrito
- [ ] Aprovação do Architecture Review Office (para Nível 3+)
