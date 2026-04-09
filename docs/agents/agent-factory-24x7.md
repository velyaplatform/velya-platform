# Agent Factory Operando 24/7 — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Office:** Agent Factory Office  
**Namespace:** velya-dev-agents  
**Última revisão:** 2026-04-08  

---

## 1. Propósito da Agent Factory

A Agent Factory Office é responsável pelo ciclo de vida completo de agents na Velya: desde a identificação de uma necessidade de automação até a criação, revisão, validação, deploy e eventual aposentadoria de cada agent.

Sem a Agent Factory, agents seriam criados ad hoc sem padrão, sem documentação, sem revisão de qualidade e sem critérios de sucesso. Com a Agent Factory, cada agent que entra em produção passou por um processo rigoroso de 15 etapas.

---

## 2. Filas de Trabalho da Agent Factory

A Agent Factory gerencia 8 filas de trabalho correspondentes aos estágios do ciclo de vida:

```
FILA 1: candidate-agents
  ↓ (triagem e avaliação inicial)
FILA 2: design-review
  ↓ (revisão arquitetural e de escopo)
FILA 3: sandbox
  ↓ (implementação e testes isolados)
FILA 4: shadow
  ↓ (validação em shadow mode)
FILA 5: probation
  ↓ (monitoramento intensivo pós-promoção)
FILA 6: approved
  ↓ (catálogo de agents aprovados e ativos)
FILA 7: quarantine
  ↓ (agents problemáticos em investigação)
FILA 8: retirement-candidates
  ↓ (agents obsoletos aguardando aposentadoria formal)
```

Cada fila tem um consumer group dedicado, SLA de processamento, e owner office.

---

## 3. As 15 Etapas de Criação de Agent

### Etapa 1: Identificação de Capability Gap

**Quem inicia:** Qualquer membro da equipe técnica, office ou através de análise de incidentes.

**Critério de entrada:** Existe uma necessidade de automação não atendida por nenhum agent ou workflow existente.

**Artefato produzido:**
```yaml
# capability-gap.yaml
gap_id: gap-2026-04-08-001
title: "Classificador de urgência para itens de inbox clínico"
description: |
  Atualmente, enfermeiros classificam manualmente urgência de todos os itens do inbox.
  Volume médio: 500 itens/dia. Tempo médio de classificação: 3 minutos/item.
  Total: ~25 horas/dia de trabalho manual. Taxa de erro humano estimada: 8%.
identified_by: "clinical-operations-team"
date: "2026-04-08"
business_impact: "high"
estimated_time_savings_hours_per_day: 20
error_reduction_target_percent: 60
```

**Verificação obrigatória antes de avançar:**
- Esse gap não é coberto por nenhum agent ativo (busca no catálogo)
- Esse gap não é coberto por nenhum workflow Temporal (busca no registro)
- A automação não violaria nenhuma regra de AI Safety ou Agent Governance

---

### Etapa 2: Proposta de Agent (RFC)

**Quem executa:** Arquiteto ou tech lead do office que identificou o gap.

**Artefato produzido:** RFC (Request for Comment) no formato padronizado:

```markdown
# RFC: task-inbox-classifier

## Problema
Classificação manual de urgência de 500 itens/dia de inbox clínico.

## Solução Proposta
Agent da classe Worker que classifica cada item do inbox usando LLM
com acesso contextual ao histórico do paciente e protocolos clínicos.

## Classe de Agent
Worker (consome mensagem, processa, entrega resultado)

## Office
Clinical Operations Office

## Tools Necessárias
- get_patient_context (L1 - read-only)
- get_current_vitals (L1 - read-only)
- get_active_medications (L1 - read-only)
- get_ward_status (L1 - read-only)

## Guardrails
- Confidence < 0.75: human review obrigatório
- Clinical impact high: human-in-loop para ações
- Max 800 tokens de inferência por classificação
- Budget: $30/mês de inferência LLM

## KPIs
- Accuracy vs. classificação humana: >= 90%
- Taxa de concordância com reviewer clínico: >= 85%
- Latência de classificação: P95 < 3 segundos
- Taxa de escalação para humano: < 20%

## Riscos Identificados
- Classificação errada de item crítico pode atrasar atendimento urgente
- Mitigação: toda classificação de urgência CRÍTICA vai para revisão humana
```

---

### Etapa 3: Revisão de Naming

**Critério:** O nome deve seguir o padrão `{office}-{role}-agent`:

| Proposta | Avaliação | Correto |
|---|---|---|
| `classifier` | Rejeitado — sem office, sem role completo | `clinical-inbox-classifier-agent` |
| `inbox-agent` | Rejeitado — sem office | `clinical-inbox-triage-agent` |
| `task-inbox-worker` | Aceito (seguindo naming dos workers) | `task-inbox-worker` ou `clinical-inbox-classifier-agent` |

**Regras de naming:**
- Deve incluir referência ao domínio clínico/operacional
- Deve incluir a função (classifier, auditor, sentinel, optimizer)
- Deve terminar com `-agent` ou ter sufixo de classe (`-worker`, `-sentinel`)
- Sem abreviações não-universais
- Sem números de versão no nome (versão fica em label)

---

### Etapa 4: Revisão Arquitetural (Design Review)

**Quem revisa:** Architecture Review Office (agent automático + human sign-off)

**Checklist de revisão:**
- [ ] A classe de agent está corretamente definida?
- [ ] As tools estão no nível de risco correto?
- [ ] Existe alternativa mais simples como Workflow Temporal?
- [ ] Os guardrails estão presentes?
- [ ] O confidence threshold está configurado?
- [ ] O human-in-loop está definido para casos clínicos?
- [ ] O budget de inferência está dentro dos limites aprovados?
- [ ] O comportamento de falha está definido (DLQ, retry policy)?
- [ ] O impacto em quota de namespace foi analisado?

**Resultado possível:**
- Aprovado para implementação
- Aprovado com condições (lista de itens a corrigir)
- Rejeitado — workflow/rule seria suficiente (deve ser reimplementado como workflow)
- Rejeitado — escopo muito amplo (deve ser dividido em múltiplos agents menores)

---

### Etapa 5: Definição de Toolset

**Princípio:** Toolset mínimo necessário. Nenhuma tool adicional sem justificativa.

**Artefato:**
```yaml
# toolset.yaml
agent: clinical-inbox-classifier-agent
tools:
  - name: get_patient_context
    level: L1
    description: "Retorna dados demográficos e diagnósticos do paciente"
    data_accessed:
      - patient.id
      - patient.age
      - patient.primary_diagnosis
      - patient.allergies
    why_needed: "Urgência depende do contexto clínico do paciente"
    
  - name: get_current_vitals
    level: L1
    description: "Retorna sinais vitais mais recentes do paciente"
    data_accessed:
      - vitals.spo2
      - vitals.heart_rate
      - vitals.blood_pressure
      - vitals.temperature
      - vitals.measured_at
    why_needed: "Vitais anômalas elevam automaticamente a urgência"
    
  - name: get_active_medications
    level: L1
    description: "Retorna medicamentos ativos e alertas de interação"
    data_accessed:
      - medications.active_list
      - medications.interaction_alerts
    why_needed: "Pedidos de interconsulta ou mudança de medicação precisam de contexto"

# Explicitamente não incluídas e por quê:
excluded_tools:
  - name: update_task_status
    reason: "Write não necessário na classificação. O caller atualiza o status com base no retorno."
  - name: get_full_patient_history
    reason: "História completa não necessária. get_patient_context retorna apenas campos relevantes."
```

---

### Etapa 6: Quality Gates

Antes de implementar, definir os quality gates que o agent deve passar para avançar entre estágios:

```yaml
# quality-gates.yaml
agent: clinical-inbox-classifier-agent

gates:
  sandbox_exit:
    - all_unit_tests_pass: true
    - schema_validation: true
    - tool_mocking_tests: true
    - confidence_gate_tested: true
    - human_escalation_tested: true
  
  shadow_exit:
    - shadow_duration_days: 7
    - accuracy_vs_human: 0.90
    - no_critical_misclassifications: true
    - p95_latency_seconds: 3.0
    - human_review_rate: 0.20  # max 20% escalação para humano
    - budget_within_estimate: true
  
  probation_exit:
    - probation_duration_days: 30
    - quality_score_avg: 0.85
    - no_incidents: true
    - correction_recurrence_rate: 0.10  # max 10%
  
  active_maintenance:
    - weekly_scorecard_review: true
    - monthly_accuracy_validation: true
```

---

### Etapa 7: Implementação em Sandbox

**Ambiente:** Namespace isolado `velya-dev-sandbox` sem acesso a dados reais de pacientes.

**Requisitos:**
- Dados de teste sintéticos baseados em cenários clínicos reais (anonimizados)
- Mocks de todos os serviços externos
- Testes unitários para:
  - Cada tool individualmente
  - Lógica de confidence gate
  - Lógica de human-in-loop trigger
  - Comportamento de falha de tool
  - Retry logic
  - Heartbeat emission

---

### Etapa 8: Revisão de Segurança

**Checklist obrigatório antes de sair do sandbox:**
- [ ] ServiceAccount criado com permissões mínimas
- [ ] RBAC revisado — nenhuma permissão extra
- [ ] Network Policy configurada
- [ ] Secrets acessados via ExternalSecretsOperator (não hardcoded)
- [ ] Nenhum dado de PHI logado em texto plano
- [ ] Prompt injection analysis realizada
- [ ] Output validation implementada para todos os outputs
- [ ] Scan de vulnerabilidades da imagem container: sem HIGH ou CRITICAL CVEs

---

### Etapa 9: Deploy em Shadow Mode

**Configuração de shadow no NATS:**
```yaml
# Fan-out: copiar mensagens da fila de produção para o agent shadow
consumers:
  # Consumer de produção (existente)
  - name: task-classification-consumer-prod
    stream: VELYA_AGENTS
    filter_subject: "velya.agents.clinical-ops.task-classification"
    deliver_policy: all
  
  # Consumer de shadow (novo)
  - name: task-classification-shadow-consumer
    stream: VELYA_AGENTS
    filter_subject: "velya.agents.clinical-ops.task-classification"
    deliver_policy: all
    # Outputs vão para subject de shadow, não para o destino real
    # Configurado no código do shadow agent
```

**Configuração de deployment shadow:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: clinical-inbox-classifier-shadow
  namespace: velya-dev-agents
  labels:
    velya.io/lifecycle-stage: shadow
    velya.io/shadow-target: clinical-inbox-classifier-v1
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: agent
          env:
            - name: AGENT_MODE
              value: "shadow"
            - name: SHADOW_OUTPUT_SUBJECT
              value: "velya.agents.shadow.clinical-inbox-classifier"
            - name: PRODUCTION_OUTPUT_SUBJECT
              value: ""  # Vazio: shadow não publica no destino real
```

---

### Etapa 10: Avaliação de Shadow Mode

**Período mínimo:** 7 dias para agents não-clínicos, 14 dias para agents com impacto clínico.

**Métricas coletadas:**
```yaml
shadow_metrics:
  total_tasks_processed: 3452
  accuracy_vs_human: 0.923
  accuracy_vs_prod_agent: 0.918
  critical_misclassifications: 0      # Itens CRÍTICOS classificados como baixa urgência
  p50_latency_seconds: 1.2
  p95_latency_seconds: 2.8
  p99_latency_seconds: 4.1
  human_escalation_rate: 0.142        # 14.2% escalado para humano
  budget_actual_usd: 28.40            # vs estimado $30/mês
  confidence_avg: 0.871
  confidence_below_threshold: 0.08   # 8% abaixo de 0.75
  incidents: 0
```

**Critérios de aprovação para promoção:**
- accuracy_vs_human >= 0.90 ✅ (0.923)
- critical_misclassifications == 0 ✅
- p95_latency_seconds <= 3.0 ✅ (2.8)
- human_escalation_rate <= 0.20 ✅ (0.142)
- budget_actual within 10% of estimate ✅
- incidents == 0 ✅

---

### Etapa 11: Revisão de Promoção

**Quem aprova:**
- Architecture Review Office (agent + human sign-off)
- Para agents clínicos: Clinical Operations Office lead também deve aprovar

**Artefato produzido:**
```yaml
# promotion-approval.yaml
agent: clinical-inbox-classifier-agent
promoted_by: "architecture-review-agent"
human_sign_off: "João Freire"
promoted_at: "2026-04-15T10:00:00Z"
from_stage: shadow
to_stage: probation
shadow_summary: "7 dias, accuracy 92.3%, 0 incidentes, budget dentro do estimado"
conditions: []  # Sem condições adicionais
probation_duration_days: 30
probation_monitoring_intensity: "high"
```

---

### Etapa 12: Probation (30 dias)

**Durante a probation:**
- Todas as tasks passam por Governance Agent para revisão de qualidade
- Scorecard atualizado semanalmente
- Qualquer incidente reinicia o contador de 30 dias
- On-call engineer notificado de qualquer anomalia
- Score mínimo por semana: 0.83

**Saída da probation:**
- 30 dias consecutivos sem incidentes
- Score médio >= 0.85
- Aprovação da Agent Factory Office

---

### Etapa 13: Promoção para Active

**Ações de promoção:**
1. Label `velya.io/lifecycle-stage: active` adicionada ao deployment
2. Entrada criada no catálogo de agents aprovados
3. Governance Agent review frequency reduzida (sampling, não 100%)
4. Runbook de operação publicado no Knowledge Office
5. Dashboard de monitoramento criado no Grafana

---

### Etapa 14: Manutenção Contínua

**Ciclo de vida contínuo:**
- Scorecard semanal revisado pela Agent Factory
- Análise mensal de accuracy e custo
- Atualização de prompt/config: passa por revisão de design
- Atualização de tools: passa por security review
- Mudança de classe: passa por processo completo de novo design

---

### Etapa 15: Aposentadoria (Retirement)

**Triggers para aposentadoria:**
- Agent substituído por workflow mais eficiente
- Agent com accuracy abaixo de 0.75 por 3+ semanas sem melhoria
- Capability do agent absorvida por agent mais abrangente
- Tecnologia utilizada descontinuada

**Processo de aposentadoria:**
1. Decision formal documentada em ADR
2. 30 dias em retired (sem processar, mas preservado para auditoria)
3. Knowledge transfer: lições para Knowledge Office
4. Deleção com aprovação de dois seniors

---

## 4. Detecção Automática de Problemas

### 4.1 Capability Gap Automático

A Agent Factory monitora continuamente:
- Tarefas manuais repetitivas identificadas em audit logs
- Incidentes recorrentes que poderiam ser prevenidos por automação
- SLA violados que indicam falta de capacidade
- Feedbacks de usuários clínicos sobre trabalho manual excessivo

### 4.2 Detecção de Agent Ruim

Critérios para mover para quarantine automaticamente:
- Accuracy < 0.70 por 2 semanas consecutivas
- 5+ incidentes de validation failure em 7 dias
- Custo de inferência > 200% do budget estimado
- Confidence cronicamente baixo (< 0.65 média 30 dias)

### 4.3 Detecção de Agent Obsoleto

Critérios para mover para retirement-candidates:
- Volume de tasks processadas < 10% do pico histórico por 30 dias
- Nenhuma nova task processada em 14 dias (fila sempre vazia)
- Funcionalidade duplicada com outro agent mais recente
- Versão de LLM utilizada descontinuada

### 4.4 Detecção de Naming Ruim

Agents com naming não-conforme são sinalizados para renaming:
- Nome sem referência a domínio (ex: apenas `classifier`)
- Nome sem sufixo de classe ou `-agent`
- Nome com abreviações não-universais (ex: `pat-flow-opt`)
- Nome duplicado com outro agent existente

### 4.5 Detecção de Toolset Ruim

Audit periódico de toolsets:
- Tools com uso < 5% das tasks nos últimos 30 dias → candidata à remoção
- Tools com taxa de erro > 30% → candidata a review ou substituição
- Tools com latência > 2x o target → candidata a otimização
- Tools acessando dados além do escopo definido → incidente de segurança

---

## 5. Capacity Limits por Namespace

```yaml
# ResourceQuota para Agent Factory namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: agent-factory-quota
  namespace: velya-dev-agents
spec:
  hard:
    # Limits para agents em produção (active + probation)
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "16"
    limits.memory: 16Gi
    count/pods: "50"
    
    # Limits adicionais para shadow agents
    # Shadow compartilha o namespace mas tem lower priority class

# Capacity limits da Agent Factory
capacity_limits:
  max_active_agents: 30          # Máximo de agents em estado active
  max_shadow_agents: 5           # Máximo de agents em shadow simultaneamente
  max_probation_agents: 5        # Máximo em probation
  max_quarantine_agents: 3       # Mais de 3 = incidente sistêmico
  max_retirement_candidates: 10  # Mais de 10 = processo de aposentadoria atrasado
```

---

## 6. Dashboard da Agent Factory

Painel `velya-agent-factory` no Grafana exibe:

1. **Pipeline de agents:** Kanban visual com agents em cada fila
2. **Tempo médio por estágio:** P50/P95 de dias em cada etapa
3. **Taxa de aprovação:** % de proposals que chegam a active
4. **Taxa de quarantine:** % de agents ativos que foram para quarantine
5. **Score médio por estágio:** Qualidade dos agents em cada fase
6. **Custo total de shadow:** Custo de inferência de todos os shadow agents
7. **Alerts:** Agents travados em um estágio por mais de 2x o SLA esperado

---

## 7. SLAs da Agent Factory

| Estágio | SLA máximo | Ação se ultrapassado |
|---|---|---|
| candidate-agents → design-review | 8 horas | Alerta Architecture Review |
| design-review → sandbox | 5 dias úteis | Escalada para tech lead |
| sandbox → shadow | 10 dias úteis | Revisão de escopo/capacidade |
| shadow (mínimo) | 7 dias | Não pode avançar antes |
| shadow → probation | 48h após critérios atingidos | Auto-promoção com notificação |
| probation (mínimo) | 30 dias | Não pode avançar antes |
| retirement-candidates → retired | 30 dias | Alerta se não processado |
