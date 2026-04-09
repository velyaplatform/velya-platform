# Modelo de Decisão: Workflows vs Agents — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Última revisão:** 2026-04-08  

---

## 1. Fundamento da Decisão

A escolha entre um Workflow Temporal e um Agent de IA é a decisão arquitetural mais importante no design de qualquer automação na Velya. Essa decisão afeta:

- **Custo:** Workflows Temporal são praticamente gratuitos para executar. Agents com LLM têm custo por token.
- **Confiabilidade:** Workflows têm comportamento determinístico e são mais fáceis de testar e auditar.
- **Manutenibilidade:** Workflows com lógica de controle explícita são mais fáceis de manter do que prompts de LLM.
- **Escalabilidade:** Ambos escalam bem, mas com padrões diferentes de custo variável.
- **Auditabilidade:** Workflows têm event sourcing nativo no Temporal. Agents precisam de instrumentação explícita.

A regra de ouro é: **se um engenheiro sênior pode escrever a lógica em código sem ambiguidade, use um workflow. Se a lógica requer julgamento contextual que não pode ser completamente codificado, considere um agent.**

---

## 2. Árvore de Decisão Completa

```
╔══════════════════════════════════════════════════════════════╗
║          NOVA AUTOMAÇÃO IDENTIFICADA                         ║
╚══════════════════════════════════════════════════════════════╝
                           │
                           ▼
         ┌─────────────────────────────────────┐
         │ Q1: As etapas da automação são      │
         │ completamente conhecidas ANTES de   │
         │ iniciar, sem exceções?              │
         └─────────────────────────────────────┘
                    │              │
                  SIM             NÃO
                    │              │
                    ▼              ▼
           ┌──────────────┐    ┌──────────────────────────────┐
           │ Q2: A ordem  │    │ Q3: A incerteza é sobre QUAL │
           │ das etapas é │    │ ferramenta/dado usar, ou     │
           │ sempre igual?│    │ sobre o RESULTADO esperado?  │
           └──────────────┘    └──────────────────────────────┘
                │    │                   │              │
               SIM  NÃO           FERRAMENTA      RESULTADO
                │    │                   │              │
                ▼    ▼                   ▼              ▼
           TEMPORAL  TEMPORAL    ┌──────────────┐  ┌───────────────┐
           (fixo)    (com switch)│ Agent com    │  │ Agent com     │
                                 │ tool select  │  │ reasoning     │
                                 └──────────────┘  └───────────────┘
                                          │                │
                                          └────────┬───────┘
                                                   ▼
                                  ┌─────────────────────────────────┐
                                  │ Q4: O output tem impacto clínico│
                                  │ direto no paciente?             │
                                  └─────────────────────────────────┘
                                              │          │
                                            SIM         NÃO
                                              │          │
                                              ▼          ▼
                                    ┌──────────────┐  ┌─────────────────┐
                                    │ AGENT com    │  │ Q5: O custo de  │
                                    │ HUMAN-IN-LOOP│  │ LLM cabe no     │
                                    │ obrigatório  │  │ budget mensal?  │
                                    └──────────────┘  └─────────────────┘
                                                              │          │
                                                            SIM         NÃO
                                                              │          │
                                                              ▼          ▼
                                                       AGENT AUTÔNOMO  REVER
                                                       (com guardrails) DESIGN
                                                                       (simplify)
```

---

## 3. Tabela de Decisão: Workflow vs Agent

| Característica | Favorece Workflow | Favorece Agent |
|---|---|---|
| Etapas da tarefa | Completamente conhecidas antes | Determinadas durante execução |
| Lógica de controle | Codificável em if/switch/loop | Requer julgamento contextual |
| Resultado esperado | Determinístico dado o input | Variável e dependente de contexto |
| Custo de erros | Alto — precisa de confiabilidade | Médio — pode ser supervisionado |
| Volume de execuções | Alto (>1000/dia) | Baixo a médio (<500/dia) |
| Latência aceitável | Qualquer — precisa ser consistente | Tolerável a 1-10s por LLM call |
| Auditabilidade | Crítica | Importante mas instrumentável |
| Ferramentas necessárias | Fixas e conhecidas | Dinâmicas, baseadas em contexto |
| Dados de entrada | Estruturados e validados | Semiestruturados ou não-estruturados |
| Frequência de mudança | Baixa (processo estável) | Alta (lógica evolui com aprendizado) |

---

## 4. Exemplos Concretos da Velya

### 4.1 Discharge Orchestration — Workflow Temporal

**Contexto:** O processo de alta hospitalar tem etapas regulamentadas e sequenciais definidas pelo protocolo clínico.

**Por que Workflow:**

```
Processo de Alta (sempre nesta sequência):
1. Receber ordem médica de alta
2. Validar prescrição de medicamentos de alta
3. Notificar equipe de enfermagem para orientações
4. Confirmar transporte (familiar ou ambulância)
5. Verificar documentação: sumário de alta, receitas, exames
6. Notificar central de leitos
7. Registrar saída no sistema HIS
8. Liberar leito para limpeza
```

Cada etapa é uma Activity no Temporal com retry configurado. A lógica de controle é completamente determinística. Não há julgamento de contexto clínico — apenas execução de checklist.

**Configuração Temporal:**
```go
// Workflow de Alta — Temporal
func DischargeWorkflow(ctx workflow.Context, patientID string) error {
    opts := workflow.ActivityOptions{
        StartToCloseTimeout: 5 * time.Minute,
        RetryPolicy: &temporal.RetryPolicy{
            MaximumAttempts: 3,
            InitialInterval: 30 * time.Second,
        },
    }
    ctx = workflow.WithActivityOptions(ctx, opts)
    
    if err := workflow.ExecuteActivity(ctx, ValidatePrescription, patientID).Get(ctx, nil); err != nil {
        return err
    }
    if err := workflow.ExecuteActivity(ctx, NotifyNursingTeam, patientID).Get(ctx, nil); err != nil {
        return err
    }
    // ... demais etapas
    return nil
}
```

**Custo:** Praticamente zero — sem chamadas LLM.  
**Auditabilidade:** Total — Temporal Web UI mostra cada etapa com timestamp.

---

### 4.2 Task Inbox Classification — Agent (Worker Class)

**Contexto:** O inbox clínico recebe mensagens heterogêneas de múltiplas fontes com diferentes níveis de urgência.

**Por que Agent:**

O inbox pode conter em uma mesma hora:
- "Paciente do leito 204 com SpO2 em 88% há 10 minutos" — urgência: CRÍTICA
- "Paciente do leito 112 solicitando anti-emético para náusea leve" — urgência: BAIXA
- "Resultado de hemograma do paciente do leito 301 disponível" — urgência: depende do valor
- "Solicitação de interconsulta de cardiologia para paciente do leito 405" — urgência: depende da condição

A classificação correta de urgência requer:
1. Leitura e compreensão do texto clínico (não estruturado)
2. Correlação com contexto do paciente (condição base, medicações, histórico)
3. Aplicação de protocolos de triagem clínica

Isso não pode ser codificado em regras simples sem perda inaceitável de acurácia.

**Configuração do Agent:**
```yaml
agent_name: task-inbox-classifier
class: Worker
office: clinical-operations
tools:
  - get_patient_context
  - get_current_vitals
  - get_active_medications
  - get_ward_current_status
confidence_threshold: 0.75
human_escalation:
  trigger: confidence < 0.75 OR urgency == CRITICAL
  channel: nurse-station-alert
max_inference_tokens_per_task: 800
```

**Custo:** ~$0.002 por classificação (GPT-4o mini ou equivalente).  
**Volume:** ~500 classificações/dia → ~$1/dia.

---

### 4.3 Patient Flow Optimization — Workflow + Agent Híbrido

**Contexto:** O roteamento básico de pacientes entre setores segue regras claras, mas a otimização de fluxo em situações de gargalo requer análise contextual.

**Solução híbrida:**

```
WORKFLOW TEMPORAL (determinístico):
├── Receber evento de transferência solicitada
├── Verificar regras obrigatórias (isolamento, compatibilidade)
├── Verificar disponibilidade de leito no destino
├── Se leito disponível → executar transferência
└── Se não disponível → CHAMAR AGENT

AGENT (quando chamado pelo workflow):
├── Analisar estado atual de ocupação de toda a unidade
├── Identificar opções de transferência alternativas
├── Considerar prioridade clínica dos pacientes em espera
├── Propor realocação com justificativa
└── Retornar proposta → WORKFLOW DECIDE (com human-in-loop se necessário)
```

Essa arquitetura mantém o path feliz (leito disponível) completamente determinístico e usa LLM apenas na exceção.

**Economização de custo:** 80% dos roteamentos ocorrem pelo path determinístico. Agent ativado apenas nos 20% de casos complexos.

---

### 4.4 Market Intelligence — Agent com Human Review

**Contexto:** Monitorar o ecossistema técnico de Kubernetes, CNCF, AI agents e saúde digital.

**Por que Agent:**
Requer leitura de conteúdo técnico não-estruturado de múltiplas fontes, avaliação de relevância para o contexto específico da Velya, identificação de riscos e oportunidades. Esse trabalho é inerentemente de raciocínio contextual.

**Por que Human Review obrigatório:**
Qualquer recomendação de adoção de nova tecnologia tem implicações de custo, segurança e arquitetura que requerem julgamento humano antes de implementação.

**Fluxo:**
```
CronJob (segunda-feira 3h UTC)
    ↓
Market Intelligence Agent
    ├── Consulta fontes aprovadas (lista controlada)
    ├── Filtra por relevância para Velya (threshold: score > 0.7)
    ├── Deduplica vs conhecimento existente
    ├── Gera relatório estruturado
    └── Publica em velya.intelligence.weekly-report
         ↓
Knowledge Office Agent
    ├── Recebe relatório
    ├── Prioriza por impacto potencial
    └── Apresenta para revisão humana na terça-feira
         ↓
Human Review (Architecture Review Office)
    └── Aprova/rejeita recomendações
```

---

### 4.5 Cost Sweep — Agent (Batch Class)

**Contexto:** Análise de anomalias de custo em múltiplos namespaces e NodePools.

**Por que Agent (e não Workflow com alertas simples):**

Anomalias de custo verdadeiramente importantes são frequentemente combinações de fatores que isoladamente parecem normais:
- Queue lag aumentando gradualmente (normal individualmente)
- Retry rate subindo (normal individualmente)
- Horário de pico fora do padrão (suspeito)
- Namespace específico com consumo 30% maior que semana anterior (suspeito)
- Combinação de todos → provável vazamento de recursão em agent ou bug em batch job

Um agent com acesso a métricas de Prometheus via ferramenta `query_prometheus` pode identificar esse padrão. Regras de threshold simples não conseguem.

**Frequência:** A cada 6 horas (Kubernetes CronJob).  
**Custo de inferência:** ~$0.01 por sweep → ~$0.04/dia (desprezível vs. custo de anomalia não detectada).

---

## 5. Regras de Escalada

Quando uma automação inicialmente implementada como Workflow precisa evoluir para Agent (ou vice-versa), o processo de escalada é:

### 5.1 Workflow → Agent (Escalada de Complexidade)

**Trigger para reavaliação:**
- Taxa de erros de lógica no workflow > 5% após 30 dias de produção
- Necessidade de mais de 3 condicionais aninhadas para cobrir casos reais
- Feedback clínico indicando decisões inadequadas em casos complexos

**Processo:**
1. Documentar os casos onde o workflow falha
2. Propor ao Architecture Review Office
3. Implementar em shadow mode (agent e workflow em paralelo por 14 dias)
4. Comparar accuracy e custo
5. Decidir baseado em dados

### 5.2 Agent → Workflow (Simplificação)

**Trigger para reavaliação:**
- Accuracy do agent > 99% por 90 dias (indica que a lógica é na verdade determinística)
- Padrão de decisão do agent identificado e codificável como regra
- Custo de LLM > benefício de flexibilidade do agent

**Processo:**
1. Analisar logs de decisões do agent por 90 dias
2. Identificar regras que cobrem >95% dos casos
3. Implementar como Workflow Temporal
4. Executar ambos em paralelo por 30 dias
5. Migrar se Workflow tem accuracy equivalente

---

## 6. Anti-Padrões a Evitar

### 6.1 Anti-padrão: LLM como Parser

**Problema:** Usar um agent/LLM para parsear dados estruturados que poderiam ser parseados com código.

**Exemplo ruim:**
```python
# ERRADO: usar LLM para extrair campos de JSON estruturado
result = llm.invoke(f"Extraia o patient_id deste JSON: {json_data}")
```

**Correto:**
```python
# CERTO: parsear diretamente
patient_id = json_data["patient"]["id"]
```

**Por que é problemático:** Adiciona custo de inferência (~$0.001/chamada), latência e risco de erro para uma operação determinística e gratuita.

---

### 6.2 Anti-padrão: Workflow como Chatbot

**Problema:** Usar um Workflow Temporal para simular conversação ou raciocínio iterativo que requer estado dinâmico.

**Exemplo ruim:**
```go
// ERRADO: workflow com dezenas de condicionais tentando simular raciocínio
func ClassifyUrgency(ctx workflow.Context, text string) (string, error) {
    if strings.Contains(text, "SpO2") && strings.Contains(text, "88%") {
        return "CRITICAL", nil
    } else if strings.Contains(text, "SpO2") && strings.Contains(text, "89%") {
        // ...mais 200 linhas de if/else tentando cobrir casos clínicos...
    }
}
```

**Correto:** Use um Agent com ferramenta de lookup clínico.

---

### 6.3 Anti-padrão: Agent para Operações de Alta Frequência

**Problema:** Usar LLM para processar eventos que ocorrem centenas de vezes por minuto.

**Exemplo ruim:** Usar agent para validar schema de cada mensagem NATS (1000/min).

**Correto:** Validação de schema é código determinístico (jsonschema, Pydantic). Zero custo de LLM.

**Regra:** Qualquer operação com volume > 100/minuto deve ser implementada sem LLM, salvo aprovação especial com análise de custo.

---

### 6.4 Anti-padrão: Multi-Agent sem Orquestrador

**Problema:** Múltiplos agents comunicando diretamente entre si via callbacks não rastreáveis, sem orquestrador central.

**Sintoma:** "Eu não sei ao certo o que acontece quando o agent A falha no meio do processamento — depende do agent B que depende do C."

**Correto:** Toda comunicação entre agents passa por fila NATS (rastreável) ou por Workflow Temporal (durável e rastreável). Nunca por chamada HTTP direta entre agents.

---

### 6.5 Anti-padrão: Agent como Datastore

**Problema:** Usar o contexto do LLM como memória persistente entre chamadas. Informação enviada na janela de contexto que "precisa ser lembrada" entre execuções.

**Correto:** State persistente vai em banco de dados ou em ConfigMap. O context window é reconstruído a cada chamada a partir de fontes externas confiáveis.

---

### 6.6 Anti-padrão: Confidence Bypass

**Problema:** Ignorar o campo de confidence retornado pelo agent e aplicar o output mesmo quando confiança é baixa, para evitar interação humana.

**Consequência:** Decisões clínicas errôneas aplicadas automaticamente. Risco inaceitável.

**Regra inegociável:** Confidence < 0.70 → human review obrigatório, sem exceções. Nenhum engineer pode fazer deploy de código que bypassa essa verificação.

---

### 6.7 Anti-padrão: Retry Infinito sem Backoff

**Problema:** Agent que falha em uma tool call retenta imediatamente e em loop, sobrecarregando o serviço downstream.

**Correto:** Backoff exponencial com jitter, máximo de retries configurado, DLQ com owner definido. Detalhes em `retry-backoff-budget-model.md`.

---

## 7. Matriz de Risco por Escolha

Para cada automação proposta, avaliar a matriz de risco:

| Dimensão | Baixo Risco | Médio Risco | Alto Risco |
|---|---|---|---|
| Impacto de erro | Apenas operacional | Financeiro < $1000 | Clínico ou financeiro > $1000 |
| Reversibilidade | Totalmente reversível | Reversível com esforço | Irreversível |
| Frequência | <10/dia | 10-100/dia | >100/dia |
| Visibilidade do erro | Detectado imediatamente | Detectado em horas | Pode não ser detectado |
| Dados envolvidos | Dados operacionais | Dados financeiros | Dados de pacientes |

**Para automações de Alto Risco:** Sempre requer Workflow (para determinismo) + Governance Agent (para auditoria) + Human-in-Loop (para decisões críticas). Agent autônomo é proibido.

---

## 8. Casos de Borda e Regras Especiais

### 8.1 Quando o Workflow é Grande Demais

Um Workflow Temporal com mais de 20 Activities provavelmente está tentando fazer demais. Sinais de warning:
- Mais de 5 níveis de aninhamento de condicionais
- Activities com lógica de negócio complexa dentro delas
- Necessidade de passar estado mutável entre Activities distantes

**Solução:** Decompor em sub-workflows menores com responsabilidades claras, orquestrados por um workflow pai simples.

### 8.2 Quando o Agent é Caro Demais

Se o custo de inferência de um agent ultrapassa R$500/mês, é obrigatório revisar:
1. Pode alguma etapa ser substituída por lógica determinística?
2. Pode usar um modelo menor para triagem e LLM grande apenas para casos complexos?
3. Pode cachear respostas para inputs similares?
4. A frequência de execução está correta?

### 8.3 Processamento de Linguagem Natural Não-Clínico

Para NLP de textos não-clínicos (ex: classificação de e-mails internos, análise de feedback de treinamentos), é preferível usar modelos menores (GPT-4o mini, Claude Haiku) sem necessidade de human-in-loop, desde que o impacto clínico seja zero.

### 8.4 Aceleração com Cache

Para agents que fazem classificações frequentemente repetidas (ex: mesma frase de urgência aparece dezenas de vezes por dia), implementar cache semântico:
- Embeddings das últimas 1000 classificações
- Similarity threshold: 0.95 → retorna cached response sem chamar LLM
- TTL de cache: 4 horas (para evitar stale em mudanças de contexto)
- Economia estimada: 40-60% de chamadas LLM em agents de classificação clínica

---

## 9. Checklist de Validação de Decisão

Antes de aprovar a implementação de qualquer nova automação:

**Para Workflows:**
- [ ] Todas as etapas listadas e sequenciadas
- [ ] Retry policy definida por Activity
- [ ] Timeout definido por Activity
- [ ] Compensação definida para falhas pós-ponto-de-não-retorno
- [ ] Idempotência garantida para re-execuções
- [ ] Dados de estado não são compartilhados mutavelmente entre workers

**Para Agents:**
- [ ] Classe do agent definida
- [ ] Justificativa para necessidade de LLM documentada
- [ ] Confidence threshold configurado
- [ ] Human-in-loop definido para casos de baixa confiança
- [ ] Budget de inferência aprovado
- [ ] Validator de output implementado
- [ ] Guardrails padrão aplicados
- [ ] Shadow mode planejado antes de produção
