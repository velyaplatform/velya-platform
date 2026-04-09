# Princípios de Efetividade dos Agents no Contexto de Hyperscalabilidade

**Versão:** 1.0  
**Domínio:** Governança de Agents  
**Classificação:** Documento de Referência Técnica  
**Data:** 2026-04-08

---

## Mandato

> **Um agent efetivo não é o mais inteligente — é o mais confiável. Confiabilidade vem de ferramentas bem definidas, contexto mínimo suficiente, guardrails automáticos e escalabilidade horizontal sem degradação de qualidade.**

---

## Princípio 1: Tool Quality First

A qualidade de um agent é determinada pela qualidade das suas ferramentas. Um model excelente com ferramentas ruins produz resultados ruins.

### O Contrato de uma Tool

Toda tool da Velya deve ter documentação explícita de:

```typescript
// Contrato completo de tool
interface VelyaTool {
  // Identidade
  name: string; // "get_patient_context"
  description: string; // Para o LLM — claro, conciso
  version: string; // Semver

  // Contrato de entrada
  inputSchema: ZodSchema; // Validação obrigatória
  inputExamples: ToolInputExample[]; // Mínimo 3 exemplos

  // Contrato de saída
  outputSchema: ZodSchema; // Validação obrigatória
  outputExamples: ToolOutputExample[]; // Mínimo 3 exemplos

  // Erros
  errorCodes: {
    [code: string]: {
      description: string;
      isRetryable: boolean;
      agentAction: string; // "retry" | "escalate" | "abort" | "alternative"
    };
  };

  // Limites
  rateLimit: {
    callsPerMinute: number;
    callsPerDay: number;
  };

  // Segurança
  trustTier: 0 | 1 | 2 | 3 | 4;
  requiresApproval: boolean;
  phiAccess: 'none' | 'limited' | 'full';
  auditLog: boolean;

  // Observabilidade
  metricsEmitted: string[]; // Quais métricas a tool emite
  tracingEnabled: boolean;
}
```

### Checklist de Qualidade de Tool

Toda tool antes de ir para produção:

```
Tool Quality Checklist
─────────────────────
Contrato
  [ ] Descrição clara para o LLM (< 100 palavras)
  [ ] Input schema com validação (Zod)
  [ ] Output schema com validação (Zod)
  [ ] Mínimo 3 exemplos de input/output
  [ ] Todos os error codes documentados

Erros
  [ ] Cada erro tem: código, descrição, isRetryable, agentAction
  [ ] Erros não-retryable estão listados (evitar loop infinito)
  [ ] Timeout configurado (nunca unbounded)
  [ ] Partial failure handling documentado

Limites
  [ ] Rate limit declarado e implementado
  [ ] Budget de tokens estimado por chamada
  [ ] SLA de latência (P50, P95)
  [ ] Limite de tamanho de payload (input e output)

Segurança
  [ ] Trust tier classificado
  [ ] PHI handling documentado e implementado
  [ ] Audit log ativo para Tier ≥ 1
  [ ] Input sanitization implementada

Observabilidade
  [ ] Métricas emitidas: chamada/sucesso/falha/latência
  [ ] Traces OTEL integrados
  [ ] Logs estruturados com traceId

Testes
  [ ] Unit tests para casos de sucesso
  [ ] Unit tests para todos os error codes
  [ ] Integration test contra sistema real (staging)
  [ ] Teste de rate limit
  [ ] Teste de input inválido (fuzz test básico)
```

### Exemplo: Tool bem definida

```typescript
// tools/get-patient-context.ts
export const getPatientContext: VelyaTool = {
  name: 'get_patient_context',
  description:
    'Retrieve current clinical context for a specific patient. Returns admission date, primary diagnosis, attending physician, and current medications. Does not return full medical history.',
  version: '1.2.0',

  inputSchema: z.object({
    patientId: z.string().uuid('Patient ID deve ser UUID válido'),
    contextFields: z
      .array(z.enum(['admission', 'diagnosis', 'medications', 'team', 'alerts']))
      .min(1)
      .max(5)
      .default(['admission', 'diagnosis']),
    institutionId: z.string().uuid(),
  }),

  outputSchema: z.object({
    patientId: z.string().uuid(),
    admission: z
      .object({
        date: z.date(),
        reason: z.string(),
        sector: z.string(),
      })
      .optional(),
    diagnosis: z
      .object({
        primary: z.string(),
        secondary: z.array(z.string()),
        icdCodes: z.array(z.string()),
      })
      .optional(),
    medications: z
      .array(
        z.object({
          name: z.string(),
          dosage: z.string(),
          frequency: z.string(),
        }),
      )
      .optional(),
    contextFreshness: z.object({
      generatedAt: z.date(),
      dataSourceAge: z.string(),
    }),
  }),

  errorCodes: {
    PATIENT_NOT_FOUND: {
      description: 'Paciente não encontrado no sistema',
      isRetryable: false,
      agentAction: 'abort',
    },
    ACCESS_DENIED: {
      description: 'Agent não tem permissão para acessar este paciente',
      isRetryable: false,
      agentAction: 'escalate',
    },
    DATABASE_TIMEOUT: {
      description: 'Timeout ao consultar banco de dados',
      isRetryable: true,
      agentAction: 'retry',
    },
    PHI_MINIMIZATION_FAILED: {
      description: 'Falha ao minimizar PHI antes de retornar',
      isRetryable: false,
      agentAction: 'abort',
    },
  },

  rateLimit: {
    callsPerMinute: 60,
    callsPerDay: 5000,
  },

  trustTier: 0, // Read-only
  requiresApproval: false,
  phiAccess: 'limited', // Apenas campos configurados em contextFields
  auditLog: true, // Cada acesso a PHI é logado

  metricsEmitted: [
    'velya_tool_get_patient_context_calls_total',
    'velya_tool_get_patient_context_duration_seconds',
    'velya_tool_get_patient_context_phi_fields_returned',
  ],
  tracingEnabled: true,
};
```

---

## Princípio 2: Context Engineering

O contexto passado para um agent deve ser o menor possível para resolver o problema com a maior qualidade possível.

### Regras de Context Engineering

#### Regra 1: Mínimo Suficiente

```
❌ Contexto ruim:
"Aqui está o prontuário completo do paciente João (50 anos, hipertenso, DM2,
histórico de 15 anos de atendimentos, 3 internações anteriores, 45 exames...)
Por favor, gere o resumo de alta."

✅ Contexto bom:
"Internação atual: 5 dias por pneumonia bacteriana. Alta prevista para hoje.
Antibioticoterapia concluída. Por favor, gere o resumo de alta hospitalar."
```

#### Regra 2: Confiável com Timestamp

```typescript
// Sempre incluir timestamp e fonte do dado
interface ContextItem {
  field: string;
  value: unknown;
  source: string; // "FHIR-Server" | "HIS-Integration" | "Cached-Redis"
  fetchedAt: Date; // Quando foi buscado
  maxAgeSeconds: number; // SLA de freshness
  isStale: boolean; // Calculado: (now - fetchedAt) > maxAgeSeconds
}
```

#### Regra 3: Context Freshness SLA por Tipo

| Tipo de Dado            | Freshness SLA | Ação se Stale              |
| ----------------------- | ------------- | -------------------------- |
| Sinais vitais           | < 1 hora      | Rebuscar antes de usar     |
| Medicação em uso        | < 6 horas     | Rebuscar antes de ação     |
| Diagnóstico de admissão | < 24 horas    | Warning ao agent           |
| Histórico médico        | < 7 dias      | OK para contexto histórico |
| Capacidade de leitos    | < 5 minutos   | Rebuscar sempre            |
| Status de workflow      | < 30 segundos | Rebuscar sempre            |

#### Regra 4: Sem Ruído

```
❌ Inclui no contexto:
- IDs internos do banco de dados
- Metadados de infraestrutura (request_id, span_id, etc.)
- Dados de outros pacientes não relacionados
- Histórico de 10 anos quando só precisa dos últimos 30 dias

✅ Inclui no contexto:
- Apenas os campos necessários para a task
- Dados dos últimos N dias (configurado por use case)
- Dados de referência necessários (ex: guidelines clínicos relevantes)
```

#### Regra 5: Prioridade Explícita

```typescript
// Context com prioridade explícita
interface PrioritizedContext {
  critical: ContextItem[]; // Nunca omitir
  important: ContextItem[]; // Incluir se dentro do token budget
  background: ContextItem[]; // Incluir apenas se tokens disponíveis
}

function buildAgentContext(items: PrioritizedContext, tokenBudget: number): string {
  const critical = formatContext(items.critical); // Sempre
  const important = formatContext(items.important); // Se cabe
  const background = formatContext(items.background); // Se cabe

  if (tokenCount(critical + important + background) <= tokenBudget) {
    return critical + important + background;
  }
  if (tokenCount(critical + important) <= tokenBudget) {
    return critical + important; // Omitir background
  }
  return critical; // Mínimo viável
}
```

---

## Princípio 3: Guardrails by Default

Todo agent tem guardrails ativos por padrão. Não existe "modo sem guardrails".

### Tool Trust Tiers na Velya

```
Tier 0: READ-ONLY
  Exemplos: get_patient_context, search_medications, list_tasks
  Auditoria: Log passivo
  Aprovação: Automática
  PHI: Minimizado automaticamente

Tier 1: WRITE INTERNO
  Exemplos: create_task, update_workflow_status, add_note_to_record
  Auditoria: Log com campos completos
  Aprovação: Automática com rate limiting
  PHI: Acesso limitado ao necessário
  Undo: Disponível (soft delete)

Tier 2: INTEGRAÇÃO EXTERNA
  Exemplos: send_notification, call_partner_api, trigger_his_event
  Auditoria: Log completo + confirmação de entrega
  Aprovação: Automática para Tier 2 pré-aprovados; humano para novos endpoints
  PHI: Não pode ser transmitido sem DPA vigente

Tier 3: AÇÃO CLÍNICA INDIRETA
  Exemplos: generate_discharge_recommendation, flag_for_review, suggest_medication_change
  Auditoria: Log completo + output salvo para revisão
  Aprovação: Sempre revisão humana antes de ação
  PHI: Accesso completo apenas após autorização explícita

Tier 4: IMPACTO CLÍNICO DIRETO
  Exemplos: [NENHUM] — Velya não tem tools de Tier 4 autônomas
  Política: NUNCA executar sem aprovação humana explícita e documentada
  Toda ação Tier 4 precisa de: identificação do aprovador, timestamp, justificativa
```

### Boundaries de Agent

```typescript
// Configuração de boundaries por agent
interface AgentBoundaries {
  // O que o agent PODE fazer
  allowedTools: string[]; // Lista explícita de tools
  allowedNamespaces: string[]; // Namespaces K8s que pode acessar
  allowedPatientIds: string[] | 'all' | 'institution-scoped';
  maxTokensPerCall: number;
  maxCallsPerHour: number;

  // O que o agent NUNCA pode fazer
  denyRules: {
    rule: string;
    description: string;
  }[];

  // Quando escalar para humano
  escalationTriggers: {
    condition: string;
    escalateTo: string; // Role ou usuário específico
    urgency: 'low' | 'medium' | 'high' | 'immediate';
  }[];

  // Policy gates — condições que devem ser verdadeiras para agir
  policyGates: {
    gate: string;
    description: string;
    failureBehavior: 'block' | 'warn' | 'escalate';
  }[];

  // Risk class
  riskClass: 'low' | 'medium' | 'high' | 'critical';

  // Budget awareness
  tokenBudgetDaily: number;
  tokenBudgetPerTask: number;
  budgetBehaviorOnExhaustion: 'stop' | 'degrade' | 'escalate';
}

// Exemplo: discharge-summary-agent
const dischargeSummaryAgentBoundaries: AgentBoundaries = {
  allowedTools: [
    'get_patient_context', // Tier 0
    'get_discharge_template', // Tier 0
    'get_active_medications', // Tier 0
    'create_discharge_draft', // Tier 1
    'request_physician_review', // Tier 1
  ],
  allowedNamespaces: ['velya-dev-agents'],
  allowedPatientIds: 'institution-scoped',
  maxTokensPerCall: 4000,
  maxCallsPerHour: 120,

  denyRules: [
    {
      rule: 'no_final_discharge_action',
      description: 'Agent pode criar draft mas não finalizar alta sem aprovação médica',
    },
    {
      rule: 'no_medication_changes',
      description: 'Agent não pode modificar lista de medicamentos, apenas ler',
    },
    {
      rule: 'no_cross_patient_access',
      description: 'Agent só acessa o paciente da task atual, não outros pacientes',
    },
  ],

  escalationTriggers: [
    {
      condition: 'physician_approval_pending > 2h',
      escalateTo: 'charge_nurse',
      urgency: 'medium',
    },
    {
      condition: 'missing_required_documentation',
      escalateTo: 'medical_secretary',
      urgency: 'low',
    },
    {
      condition: 'clinical_contraindication_detected',
      escalateTo: 'attending_physician',
      urgency: 'high',
    },
  ],

  policyGates: [
    {
      gate: 'patient_consent_check',
      description: 'Paciente deve ter consentimento de dados para processamento por IA',
      failureBehavior: 'block',
    },
    {
      gate: 'discharge_eligibility_confirmed',
      description: 'Alta deve estar aprovada pelo médico antes do summary agent agir',
      failureBehavior: 'block',
    },
  ],

  riskClass: 'high',
  tokenBudgetDaily: 100_000,
  tokenBudgetPerTask: 4_000,
  budgetBehaviorOnExhaustion: 'escalate',
};
```

---

## Princípio 4: Single-Agent Antes de Multi-Agent

A regra é clara: **single-agent é o default**. Multi-agent é uma exceção que precisa de justificativa explícita.

### Por que Single-Agent é Preferido

| Aspecto         | Single-Agent        | Multi-Agent                                            |
| --------------- | ------------------- | ------------------------------------------------------ |
| Latência        | 1 round-trip LLM    | N round-trips (sequencial) ou comunicação entre agents |
| Custo de tokens | Contexto 1x         | Contexto N× (cada agent tem seu contexto)              |
| Debugging       | Trace único         | Traços múltiplos, correlação manual                    |
| Falha           | 1 ponto de falha    | N pontos de falha + comunicação entre eles             |
| Governança      | 1 set de guardrails | N sets, possível conflito                              |
| Observabilidade | 1 thread de log     | N threads, correlação necessária                       |

### Quando Multi-Agent tem Valor Explícito

| Critério                    | Exemplo Velya                                         | Valor Medido                                       |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| **Especialização distinta** | Gerador de summary + Revisor clínico                  | Qualidade > 15% acima de single-agent              |
| **Paralelismo real**        | 50 summaries em paralelo (batch)                      | Latência total 5× menor                            |
| **Separação de funções**    | Agent que escreve + Agent que verifica compliance     | Erro de compliance detectado antes de ir ao médico |
| **Validação cruzada**       | Dois agents de pricing independentes                  | Consistência validada antes de publicar            |
| **Volume que justifica**    | 1000 itens a processar onde paralelismo = 10× speedup | Custo adicional compensado pelo tempo              |

### Regra de Não-Iniciar Multi-Agent

```
Não criar multi-agent se:
  [ ] Um único prompt bem engenheirado resolve o problema
  [ ] A "especialização" é apenas usar um tool diferente
  [ ] O paralelismo não reduz latência total (gargalo é I/O, não compute)
  [ ] O valor de validação cruzada não foi medido (não é intuição)
  [ ] O custo de tokens do multi-agent > 2× o custo de um único agent de qualidade
```

---

## Métricas de Efetividade de Agent

### Por Agent Individual

```prometheus
# Taxa de conclusão de tasks
velya_agent_task_completion_total{agent_id, status}  # success | failed | escalated

# Latência por task
velya_agent_task_duration_seconds{agent_id, task_type}

# Consumo de tokens
velya_agent_tokens_consumed_total{agent_id, model, priority}

# Tool calls
velya_agent_tool_calls_total{agent_id, tool_name, status}
velya_agent_tool_call_duration_seconds{agent_id, tool_name}

# Qualidade (requer avaliação humana ou checklist automatizado)
velya_agent_output_quality_score{agent_id}  # 0-5

# Escalações
velya_agent_escalation_total{agent_id, trigger, urgency}

# Guardrail activations
velya_agent_guardrail_blocked_total{agent_id, rule}
velya_agent_boundary_violation_attempts_total{agent_id, boundary}

# Budget
velya_agent_budget_consumed_ratio{agent_id}
velya_agent_budget_breach_total{agent_id, severity}
```

### Scorecard Semanal por Agent

| Métrica                    | Green     | Yellow   | Red      |
| -------------------------- | --------- | -------- | -------- |
| Task completion rate       | > 95%     | 85-95%   | < 85%    |
| Escalation rate            | < 5%      | 5-15%    | > 15%    |
| Quality score (human eval) | > 4.0/5.0 | 3.0-4.0  | < 3.0    |
| Token budget adherence     | < 80%     | 80-95%   | > 95%    |
| Tool error rate            | < 2%      | 2-10%    | > 10%    |
| Guardrail activation rate  | < 1%      | 1-5%     | > 5%     |
| Latência P95               | < SLA     | 1-2× SLA | > 2× SLA |

---

## Hyperscalabilidade de Agents

### Scale-Out de Agents

Agents na Velya são stateless (estado no contexto + tools). Portanto, podem escalar horizontalmente:

```yaml
# KEDA ScaledObject para agent workers
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: discharge-summary-agent-scaler
  namespace: velya-dev-agents
spec:
  scaleTargetRef:
    name: discharge-summary-agent-worker
  minReplicaCount: 0 # Escala para zero quando sem tasks
  maxReplicaCount: 10 # Guardrail de custo (10 agents × tokens/task)
  triggers:
    - type: nats-jetstream
      metadata:
        stream: velya.discharge.summary.queue
        consumer: discharge-summary-consumer
        lagThreshold: '1' # 1 agent por task
    - type: prometheus
      metadata:
        # Não escalar se budget de tokens < 10%
        query: velya_ai_budget_consumed_ratio{agent_id="discharge-summary"} < 0.90
        threshold: '1'
```

### Agent Isolation para Hyperscale

```
Regras de isolamento em escala:
  1. Cada instância de agent tem seu próprio contexto — sem estado compartilhado
  2. Cada instância emite métricas com seu pod_id — identificabilidade
  3. Tool rate limits são por agent_id (não por instância) — compartilhados
  4. Budget de tokens é por agent_id, não por instância — compartilhado
  5. Guardrails são por agent_id — consistentes entre instâncias
```

---

_Este documento é revisado a cada novo agent que entra em produção na Velya._
