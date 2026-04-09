# Governança de Contexto e Tooling dos Agents — Velya

**Versão:** 1.0  
**Domínio:** Governança de AI  
**Classificação:** Documento de Referência Técnica  
**Data:** 2026-04-08

---

## Mandato

> **Contexto mal gerenciado é risco. Tooling sem governança é risco maior. A Velya trata contexto e tooling como superfícies de segurança — não como detalhes de implementação.**

---

## Estrutura de Tool Manifest

Todo agent na Velya tem um `tool-manifest.yaml` explícito — a fonte de verdade sobre quais tools o agent pode usar.

### Formato do Tool Manifest

```yaml
# agents/clinical-office/discharge-summary-agent/tool-manifest.yaml
apiVersion: velya.io/v1
kind: AgentToolManifest
metadata:
  name: discharge-summary-agent-tools
  agent: discharge-summary-agent
  office: clinical-office
  version: "1.3.0"
  lastReviewed: "2026-04-08"
  reviewedBy: "arch-team"

spec:
  # Budget de contexto máximo
  contextBudget:
    maxTokens: 12000         # Total de tokens no contexto
    systemPromptTokens: 2000 # Reservado para system prompt
    toolResponseTokens: 4000 # Reservado para respostas de tools
    taskDataTokens: 6000     # Disponível para dados da task

  # Freshness SLA do contexto
  contextFreshnessSLA:
    patientContext: 3600        # 1 hora — dados clínicos
    medicationList: 21600       # 6 horas
    admissionData: 86400        # 24 horas
    dischargeCriteria: 86400    # 24 horas
    teamAssignment: 1800        # 30 minutos

  # Trigger de atualização de contexto
  contextUpdateTriggers:
    - event: "patient.transfer"
      fields: ["patientContext", "teamAssignment"]
      maxDelay: 60              # Segundos para atualizar após evento
    - event: "medication.changed"
      fields: ["medicationList"]
      maxDelay: 30
    - schedule: "*/30 * * * *"  # A cada 30min — refresh preventivo
      fields: ["patientContext"]

  # Tools disponíveis
  tools:
    - name: get_patient_context
      version: "1.2.0"
      trustTier: 0
      enabled: true
      rateLimit:
        callsPerMinute: 10
        callsPerTask: 3
      phiFields:
        allowed: ["diagnosis", "admission", "medications"]
        denied: ["full_history", "mental_health", "substance_use"]

    - name: get_discharge_template
      version: "1.0.5"
      trustTier: 0
      enabled: true
      rateLimit:
        callsPerMinute: 5
        callsPerTask: 2

    - name: create_discharge_draft
      version: "1.1.0"
      trustTier: 1
      enabled: true
      rateLimit:
        callsPerMinute: 3
        callsPerTask: 1
      auditRequired: true

    - name: request_physician_review
      version: "1.0.2"
      trustTier: 1
      enabled: true
      rateLimit:
        callsPerMinute: 2
        callsPerTask: 1
      auditRequired: true
      requiresHumanLoop: true  # Sempre notifica humano

  # Tools explicitamente negadas
  deniedTools:
    - name: finalize_discharge
      reason: "Finalização de alta requer aprovação médica explícita — não pode ser automática"
    - name: modify_medications
      reason: "Alteração de medicação fora do escopo deste agent"
    - name: access_financial_data
      reason: "Agent clínico não acessa dados financeiros"
    - name: '*_admin_*'
      reason: "Pattern — nenhuma tool de admin é permitida"
```

---

## Context Budget por Agent

### Princípio de Budget de Contexto

```
Context Budget = tokens disponíveis para um agent em uma invocação

Distribuição padrão:
  System Prompt:     15-20% do budget
  Task Description:  10-15% do budget
  Patient Context:   30-40% do budget
  Tool Responses:    20-30% do budget
  Output Space:      10-15% do budget
  
Exemplo para budget de 12.000 tokens:
  System Prompt:     2.000 tokens (17%)
  Task Description:  1.000 tokens (8%)
  Patient Context:   4.500 tokens (37%)
  Tool Responses:    3.000 tokens (25%)
  Output Space:      1.500 tokens (13%)
```

### Implementação de Budget Enforcement

```typescript
// packages/ai-gateway/src/context-budget-enforcer.ts

export class ContextBudgetEnforcer {
  private readonly tiktoken: Tiktoken;
  
  async enforceContextBudget(
    agentId: string,
    context: AgentContext,
    manifest: AgentToolManifest
  ): Promise<EnforcedContext> {
    const budget = manifest.spec.contextBudget;
    
    // 1. Contar tokens do sistema (obrigatório — não cortar)
    const systemTokens = await this.countTokens(context.systemPrompt);
    if (systemTokens > budget.systemPromptTokens) {
      throw new ContextBudgetError(
        `System prompt (${systemTokens} tokens) excede budget (${budget.systemPromptTokens})`
      );
    }
    
    // 2. Priorizar dados da task
    const taskData = this.buildTaskContext(context.taskData, budget.taskDataTokens);
    
    // 3. Reservar espaço para tool responses
    const remainingForToolResponses = budget.toolResponseTokens;
    
    // 4. Emitir métricas
    this.metrics.contextBudgetUsed.set(
      { agent_id: agentId, component: 'system' },
      systemTokens
    );
    this.metrics.contextBudgetUsed.set(
      { agent_id: agentId, component: 'task_data' },
      await this.countTokens(taskData)
    );
    
    return {
      systemPrompt: context.systemPrompt,
      taskData,
      toolResponseBudget: remainingForToolResponses,
      totalBudget: budget.maxTokens,
    };
  }
  
  private buildTaskContext(
    data: PrioritizedContextData,
    budgetTokens: number
  ): string {
    // Construir contexto respeitando prioridades
    let context = '';
    let tokensUsed = 0;
    
    // Critical — sempre inclui
    for (const item of data.critical) {
      const formatted = this.formatContextItem(item);
      const tokens = await this.countTokens(formatted);
      context += formatted;
      tokensUsed += tokens;
    }
    
    // Important — inclui se cabe
    for (const item of data.important) {
      const formatted = this.formatContextItem(item);
      const tokens = await this.countTokens(formatted);
      if (tokensUsed + tokens <= budgetTokens * 0.85) {
        context += formatted;
        tokensUsed += tokens;
      }
    }
    
    // Background — inclui apenas se muito espaço disponível
    for (const item of data.background) {
      const formatted = this.formatContextItem(item);
      const tokens = await this.countTokens(formatted);
      if (tokensUsed + tokens <= budgetTokens * 0.70) {
        context += formatted;
        tokensUsed += tokens;
      }
    }
    
    return context;
  }
}
```

---

## Context Freshness SLA

### Fontes de Contexto da Velya

| Fonte | Tipo de Dado | SLA Freshness | Quem Atualiza | Como Verificar |
|---|---|---|---|---|
| Medplum FHIR Server | Dados clínicos FHIR | 1h | HIS integration | `meta.lastUpdated` |
| PostgreSQL (operational) | Tarefas, workflows, status | 30s | Serviços da Velya | `updated_at` |
| Redis (cache) | Contexto de paciente cacheado | 5min | Patient context service | TTL da chave |
| NATS JetStream | Eventos recentes | Real-time | Event publishers | Timestamp da msg |
| S3 (documents) | Documentos clínicos | 24h | Document service | `Last-Modified` |
| External APIs (HIS) | Dados do HIS hospitalar | 15min | HIS integration | `X-Data-As-Of` header |

### Verificação de Freshness em Runtime

```typescript
// lib/context/freshness-checker.ts

export class ContextFreshnessChecker {
  async checkAndRefresh(
    agentId: string,
    context: AgentContext,
    manifest: AgentToolManifest
  ): Promise<AgentContext> {
    const freshnessSLA = manifest.spec.contextFreshnessSLA;
    const now = new Date();
    const staleFields: string[] = [];
    
    // Verificar cada campo de contexto
    for (const [field, maxAgeSeconds] of Object.entries(freshnessSLA)) {
      const contextField = context[field as keyof AgentContext];
      if (!contextField?.fetchedAt) continue;
      
      const ageSeconds = (now.getTime() - contextField.fetchedAt.getTime()) / 1000;
      
      if (ageSeconds > maxAgeSeconds) {
        staleFields.push(field);
        
        // Emitir métrica
        this.metrics.staleContextField.inc({
          agent_id: agentId,
          field,
          age_seconds: Math.round(ageSeconds),
        });
      }
    }
    
    if (staleFields.length === 0) {
      return context;  // Tudo fresco
    }
    
    // Rebuscar campos stale
    const refreshedContext = await this.refreshStaleFields(
      agentId,
      context,
      staleFields
    );
    
    return refreshedContext;
  }
  
  async checkAndRefreshWithPolicy(
    field: string,
    contextItem: ContextItem,
    maxAgeSeconds: number
  ): Promise<{ isStale: boolean; shouldBlock: boolean; shouldWarn: boolean }> {
    const ageSeconds = (Date.now() - contextItem.fetchedAt.getTime()) / 1000;
    const isStale = ageSeconds > maxAgeSeconds;
    
    return {
      isStale,
      shouldBlock: isStale && contextItem.criticality === 'critical',
      shouldWarn: isStale && contextItem.criticality !== 'critical',
    };
  }
}
```

---

## PHI Handling em Contexto

### Regras de PHI no Contexto de Agent

```typescript
// packages/ai-gateway/src/phi-context-guard.ts

// Campos considerados PHI na Velya
export const PHI_FIELDS = {
  direct_identifiers: [
    'patient_name', 'patient_id', 'social_security_number',
    'date_of_birth', 'address', 'phone_number', 'email',
    'health_plan_id', 'account_number', 'certificate_number',
  ],
  quasi_identifiers: [
    'age_exact',      // OK: age_range (ex: "50-60 anos")
    'zip_code_full',  // OK: apenas 3 primeiros dígitos
    'admission_date_exact',  // OK: week_of_admission
  ],
  sensitive_categories: [
    'mental_health', 'substance_use', 'hiv_status',
    'domestic_violence', 'reproductive_health', 'genetic_data',
  ],
};

export class PHIContextGuard {
  sanitizeForAgent(
    rawContext: PatientContext,
    agentId: string,
    toolManifest: AgentToolManifest
  ): SanitizedContext {
    const allowedPhiFields = toolManifest.spec.tools
      .flatMap(t => t.phiFields?.allowed ?? [])
      .filter(Boolean);
    
    const sanitized: Partial<PatientContext> = {};
    
    for (const [key, value] of Object.entries(rawContext)) {
      // Verificar se é PHI direto
      if (PHI_FIELDS.direct_identifiers.includes(key)) {
        if (allowedPhiFields.includes(key)) {
          sanitized[key] = value;
        } else {
          sanitized[key] = '[REDACTED]';
          this.auditLog.record({
            agentId,
            field: key,
            action: 'redacted',
            reason: 'phi_not_in_allowed_list',
          });
        }
      } else if (PHI_FIELDS.sensitive_categories.includes(key)) {
        // Categorias sensíveis: sempre precisam de permissão explícita
        const hasSensitivePermission = toolManifest.spec.phiPermissions?.sensitive?.includes(key);
        if (hasSensitivePermission) {
          sanitized[key] = value;
        } else {
          // Não incluir no contexto — nem como REDACTED
          this.auditLog.record({
            agentId,
            field: key,
            action: 'omitted',
            reason: 'sensitive_phi_no_permission',
          });
        }
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized as SanitizedContext;
  }
}
```

---

## Context Compression

Quando o contexto está próximo do budget, aplicar compressão sem perder informação crítica.

```typescript
// packages/ai-gateway/src/context-compressor.ts

export class ContextCompressor {
  async compress(
    context: string,
    targetTokens: number,
    currentTokens: number,
    compressionConfig: CompressionConfig
  ): Promise<string> {
    if (currentTokens <= targetTokens) return context;
    
    const compressionRatio = targetTokens / currentTokens;
    
    // Estratégia 1: Remover campos redundantes
    let compressed = this.removeRedundantFields(context);
    
    // Estratégia 2: Usar abreviações padronizadas
    compressed = this.applyMedicalAbbreviations(compressed);
    
    // Estratégia 3: Resumir listas longas
    if (await this.countTokens(compressed) > targetTokens) {
      compressed = this.summarizeLists(compressed, compressionConfig.maxListItems);
    }
    
    // Estratégia 4: Truncar histórico (manter mais recente)
    if (await this.countTokens(compressed) > targetTokens) {
      compressed = this.truncateHistory(compressed, compressionConfig.historyDays);
    }
    
    // Se ainda não couber: emitir warning e retornar o que cabe
    const finalTokens = await this.countTokens(compressed);
    if (finalTokens > targetTokens) {
      this.metrics.contextCompressionOverflow.inc();
      return compressed.substring(0, Math.floor(compressed.length * (targetTokens / finalTokens)));
    }
    
    return compressed;
  }
}
```

---

## Tooling Governance: Processo para Adicionar Nova Tool

### Fluxo de Aprovação

```
PASSO 1: RFC de Tool (1-3 dias)
  ├── Engenheiro preenche Template de RFC de Tool
  ├── Classifica Trust Tier inicial
  ├── Descreve PHI access necessário
  └── Submetido para review de Arquitetura

PASSO 2: Security Review (1-5 dias dependendo do Tier)
  ├── Tier 0: Review de arquiteto responsável
  ├── Tier 1: Review de arquiteto + security lead
  ├── Tier 2: Review de arquiteto + security lead + DPO (PHI externo)
  ├── Tier 3: Review acima + Clinical Safety
  └── Tier 4: [NUNCA aprovado para execução autônoma]

PASSO 3: Implementação
  ├── Engenheiro implementa seguindo Tool Quality Checklist
  ├── Code review obrigatório (mínimo 1 aprovação)
  └── Integration tests em staging

PASSO 4: Observabilidade
  ├── Métricas Prometheus configuradas
  ├── Alerta de error rate configurado
  └── Dashboard Grafana atualizado

PASSO 5: Shadow Mode (1-2 semanas)
  ├── Tool habilitada apenas para agents em shadow mode
  ├── Outputs comparados com baseline
  └── Exit criteria: < 2% error rate por 1 semana

PASSO 6: Produção
  ├── Tool manifest atualizado com nova tool
  ├── Deploy gradual (10% → 50% → 100% dos agents)
  └── Monitoramento intensivo por 7 dias
```

### Template de RFC de Tool

```markdown
## RFC de Tool: [nome-da-tool]

### Problema que resolve
[Descrição clara de por que esta tool é necessária]

### Alternativas consideradas
[Outras tools existentes que foram avaliadas e por que não servem]

### Contrato de I/O
**Input:**
```typescript
interface ToolInput {
  // ...
}
```

**Output:**
```typescript
interface ToolOutput {
  // ...
}
```

### Trust Tier proposto
Tier: X

Justificativa:
[Por que este tier e não o imediatamente abaixo]

### PHI Access
- Acessa PHI? [Sim/Não]
- Se sim, quais campos: [lista]
- Mecanismo de minimização: [descrição]
- Transmite PHI externamente? [Sim/Não]
- Se sim, DPA com destinatário existe? [Sim/Não, link]

### Limites e Rate Limits
- Calls/min: N
- Calls/task: N
- Timeout: Ns
- Max payload size: NKB

### Observabilidade
- Métricas emitidas: [lista]
- Alertas necessários: [lista]

### Test Plan
- [ ] Unit tests para sucesso
- [ ] Unit tests para cada error code
- [ ] Integration test em staging
- [ ] Fuzz test para input inválido
- [ ] Load test para rate limit

### Rollout Plan
- Shadow: [data de início]
- 10%: [data]
- 100%: [data]
```

---

## Tool Trust Tier — Revisão e Reclassificação

### Processo de Revisão de Tier

Tools são revisadas quanto ao Trust Tier quando:
1. O comportamento real difere do comportamento esperado no RFC
2. Um incidente de segurança envolve a tool
3. A tool é atualizada com nova funcionalidade que aumenta o escopo
4. Revisão anual obrigatória para todas as tools Tier ≥ 2

### Tabela de Trust Tiers

| Tier | Nome | Características | Aprovação | Exemplo |
|---|---|---|---|---|
| 0 | Read-Only | Sem side effects, sem PHI ou PHI minimizado, sem escrita | Auto | `get_patient_context` |
| 1 | Write Internal | Escrita em sistemas Velya, PHI limitado, undo possível | Auto + rate limit | `create_task`, `update_status` |
| 2 | External Integration | Chamada a sistema externo, possível transmissão de dados | Pré-aprovado por sistema | `send_notification`, `call_his_api` |
| 3 | Clinical Indirect | Produz output com implicação clínica indireta | Human review obrigatório | `generate_recommendation` |
| 4 | Clinical Direct | Ação clínica direta e potencialmente irreversível | NUNCA autônomo | [Não existe — proibido] |

---

## Governança de Atualização de Tool

### Versionamento de Tools

```
Mudanças de PATCH (1.0.x): Bug fix, sem mudança de interface
  → Aprovação do dono da tool
  → Deploy sem re-aprovação do manifest

Mudanças de MINOR (1.x.0): Nova funcionalidade, backward-compatible
  → Code review + 1 aprovação de arquiteto
  → Atualizar tool-manifest.yaml com nova versão
  → Shadow mode por 1 semana

Mudanças de MAJOR (x.0.0): Breaking change ou mudança de Trust Tier
  → RFC completo novamente
  → Todos os agents usando a tool precisam ser atualizados
  → Shadow mode por 2 semanas
  → Período de transição (versão anterior disponível por 30 dias)
```

### Deprecação de Tool

```yaml
# Ferramenta sendo deprecada
- name: legacy_patient_search
  version: "2.3.1"
  trustTier: 0
  enabled: false      # Desabilitar para novos agents
  deprecated: true
  deprecationDate: "2026-04-08"
  removalDate: "2026-07-08"   # 90 dias para migração
  migrateTo: get_patient_context_v2
  deprecationReason: "Substituído por get_patient_context_v2 com PHI minimization nativa"
```

---

## Observabilidade de Tooling

### Alertas de Governance

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-tooling-governance-alerts
  namespace: velya-dev-observability
spec:
  groups:
  - name: tooling-governance
    rules:
    
    - alert: ToolErrorRateHigh
      expr: |
        rate(velya_agent_tool_calls_total{status="error"}[10m]) /
        rate(velya_agent_tool_calls_total[10m]) > 0.05
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Tool {{ $labels.tool_name }} com error rate > 5%"
    
    - alert: ToolRateLimitBreached
      expr: |
        velya_agent_tool_rate_limit_breaches_total > 0
      for: 1m
      labels:
        severity: warning
      annotations:
        summary: "Rate limit da tool {{ $labels.tool_name }} foi atingido"
    
    - alert: DeprecatedToolInUse
      expr: |
        velya_agent_tool_calls_total{deprecated="true"} > 0
      for: 60m
      labels:
        severity: info
      annotations:
        summary: "Tool deprecada {{ $labels.tool_name }} ainda em uso após 1h"
    
    - alert: UnauthorizedToolCall
      expr: |
        velya_agent_unauthorized_tool_attempt_total > 0
      for: 0m
      labels:
        severity: critical
      annotations:
        summary: "Agent {{ $labels.agent_id }} tentou chamar tool não autorizada {{ $labels.tool_name }}"
    
    - alert: PHIFieldAccessedWithoutPermission
      expr: |
        velya_agent_phi_field_redacted_total{reason="phi_not_in_allowed_list"} > 5
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Agent {{ $labels.agent_id }} tentando acessar PHI não permitido"
    
    - alert: ContextStaleFieldHigh
      expr: |
        rate(velya_agent_stale_context_field_total[10m]) > 1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Alta taxa de contexto stale para agent {{ $labels.agent_id }}, campo {{ $labels.field }}"
    
    - alert: ContextBudgetOverflow
      expr: |
        velya_agent_context_compression_overflow_total > 0
      for: 1m
      labels:
        severity: warning
      annotations:
        summary: "Context budget overflow detectado para agent {{ $labels.agent_id }}"
```

---

## Inventário de Tools — Velya (Estado Atual)

### Tools Tier 0 (Read-Only)

| Tool | Versão | Agents Usando | PHI | Status |
|---|---|---|---|---|
| `get_patient_context` | 1.2.0 | discharge-summary, patient-context | Limitado | Ativo |
| `get_discharge_template` | 1.0.5 | discharge-summary | Não | Ativo |
| `search_medications` | 2.1.0 | discharge-summary | Não | Ativo |
| `get_task_inbox` | 1.0.0 | task-inbox-agent | Não | Ativo |
| `get_workflow_status` | 1.1.0 | ops-oversight-agent | Não | Ativo |
| `query_prometheus_metrics` | 1.0.0 | cost-analysis-agent | Não | Ativo |
| `web_search` | 1.0.0 | market-intelligence-agent | Não | Ativo |

### Tools Tier 1 (Write Internal)

| Tool | Versão | Agents Usando | Undo? | Status |
|---|---|---|---|---|
| `create_discharge_draft` | 1.1.0 | discharge-summary | Sim (soft delete) | Ativo |
| `request_physician_review` | 1.0.2 | discharge-summary | Sim (cancelar) | Ativo |
| `create_task` | 2.0.0 | patient-context-agent | Sim | Ativo |
| `update_task_status` | 1.3.0 | múltiplos | Sim | Ativo |

### Tools Tier 2 (External Integration)

| Tool | Versão | Destino Externo | DPA? | Status |
|---|---|---|---|---|
| `send_push_notification` | 1.0.0 | Firebase FCM | Sim | Ativo |
| `send_email` | 1.0.0 | SendGrid | Sim | Ativo |
| `call_his_webhook` | 1.2.0 | HIS do hospital | Por contrato | Ativo |

### Tools Tier 3 (Clinical Indirect — Human Review Required)

| Tool | Versão | Agents Usando | Review Obrigatório Por |
|---|---|---|---|
| `generate_discharge_recommendation` | 1.0.0 | discharge-summary | Médico responsável |
| `flag_patient_for_clinical_review` | 1.0.0 | risk-stratification | Equipe clínica |

---

## Auditoria de Tooling

### Audit Log Format

```json
{
  "timestamp": "2026-04-08T15:42:00.123Z",
  "event_type": "tool_call",
  "agent_id": "discharge-summary-agent",
  "agent_instance": "discharge-summary-agent-worker-7d9f4c8b5-xqk2p",
  "tool_name": "get_patient_context",
  "tool_version": "1.2.0",
  "trust_tier": 0,
  "input_hash": "sha256:abc123",  // Hash do input, não o input em si
  "phi_fields_accessed": ["diagnosis", "medications"],
  "phi_fields_redacted": [],
  "duration_ms": 45,
  "status": "success",
  "output_token_count": 312,
  "workflow_id": "discharge-orch-12345",
  "patient_id_hash": "sha256:xyz789",  // Hash do patient_id, não o ID real
  "institution_id": "hosp-001",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7"
}
```

### Retenção de Audit Logs

| Ambiente | Retenção | Storage |
|---|---|---|
| Dev (kind) | 3 dias | Loki local |
| Staging | 30 dias | Loki + S3 |
| Produção | 365 dias | Loki + S3 (compliance) |

---

*Este documento é a fonte de verdade para governança de context e tooling. Atualizado a cada novo agent, nova tool, ou mudança de política de PHI.*
