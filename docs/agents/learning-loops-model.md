# Loops de Aprendizado Contínuo — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Office:** Learning Office  
**Namespace:** velya-dev-agents  
**Última revisão:** 2026-04-08

---

## 1. Princípio de Aprendizado Institucional

A Velya aprende de forma sistemática e controlada. Todo incidente, correção, alerta e feedback é uma oportunidade de melhoria. Porém, o aprendizado institucional não pode ser ad hoc: mudanças propagadas sem validação podem introduzir novos problemas ou regredir comportamentos já corretos.

O modelo de learning loops define:

- Quais eventos geram aprendizado
- Como o aprendizado é validado antes de propagação
- Como as melhorias são implementadas de forma segura
- Como o conhecimento institucional é preservado

**Princípio fundamental:** Nenhuma mudança propagada por um Learning Agent entra em produção sem revisão do Knowledge Office e validação de um Governance Agent independente.

---

## 2. Schema de Learning Event

Todo evento de aprendizado segue este schema:

```json
{
  "$schema": "https://schemas.velya.io/learning-event/v1.0",

  "event_id": "learn-uuid-v4",
  "event_type": "incident_lesson",
  "generated_at": "2026-04-08T16:00:00.000Z",
  "generated_by": "learning-office",
  "source_event_id": "incident-2026-04-08-003",
  "source_event_type": "retry_storm",

  "context": {
    "office": "clinical-operations",
    "agent_name": "task-inbox-worker",
    "period_start": "2026-04-08T14:00:00.000Z",
    "period_end": "2026-04-08T14:45:00.000Z",
    "frequency": "first_occurrence",
    "severity": "medium"
  },

  "observation": {
    "what_happened": "task-inbox-worker entrou em retry storm por timeout de get_patient_context",
    "root_cause": "patient-flow-service degradado por 45 minutos, timeout de 10s insuficiente",
    "contributing_factors": [
      "Timeout de tool estava configurado como 10s mas o P99 em condições degradadas era 12-15s",
      "Não havia circuit breaker para o patient-flow-service",
      "Watchdog detectou mas não tinha ação automática de circuit breaker configurada"
    ],
    "what_worked": "Watchdog detectou em 12 minutos. Escalação para on-call funcionou."
  },

  "lesson_learned": {
    "title": "Timeout de tools devem ter margem para condições degradadas",
    "description": "O timeout de tools deve ser configurado como P99 normal * 2, não apenas P99 normal",
    "actionable": true,
    "category": "resilience"
  },

  "proposed_changes": [
    {
      "change_id": "change-001",
      "type": "config_update",
      "target": "agent-guardrails-defaults",
      "field": "tool_timeout_l1_seconds",
      "current_value": "10",
      "proposed_value": "20",
      "rationale": "P99 de get_patient_context é 8s em condições normais. 2x = 16s. Arredondado para 20s para margem.",
      "risk_level": "low",
      "requires_human_review": false
    },
    {
      "change_id": "change-002",
      "type": "watchdog_rule",
      "target": "ops-watchdog",
      "description": "Adicionar circuit breaker automático ao watchdog para retry rate > 50%",
      "risk_level": "medium",
      "requires_human_review": true
    }
  ],

  "validation_status": "pending_review",
  "validated_by": null,
  "propagated_at": null,
  "propagation_scope": "velya-dev-agents"
}
```

---

## 3. Os Cinco Loops de Aprendizado

### 3.1 Loop 1: Incident → Lesson Learned → Playbook → Template

**Gatilho:** Qualquer incidente resolvido (Severity 1, 2 ou 3).

**Fluxo:**

```
INCIDENTE RESOLVIDO
         │
         ▼ (automático, < 1 hora)
LEARNING AGENT analisa:
  - Logs Loki do período do incidente
  - Timeline de alertas Prometheus
  - Ações tomadas pela equipe de resposta
  - Resolução final e tempo de MTTR
         │
         ▼ (automático)
LEARNING EVENT gerado com schema completo
         │
         ▼ (até 24 horas)
KNOWLEDGE OFFICE revisa e enriquece:
  - Valida a análise do learning agent
  - Adiciona contexto de outros incidentes similares
  - Identifica padrão ou isolamento
         │
         ▼ (manual, até 48 horas)
HUMANO REVISA se:
  - Incidente de Severity 1 ou 2
  - Impacto clínico confirmado
  - Mudança proposta de nível médio ou alto
         │
         ▼ (após aprovação)
PLAYBOOK ATUALIZADO:
  - Seção nova ou atualizada no runbook do serviço
  - Trigger de detecção documentado
  - Passos de resposta documentados
  - Link para post-mortem
         │
         ▼ (se padrão recorrente em 3+ incidentes)
TEMPLATE ATUALIZADO:
  - Template de agent com nova regra incorporada
  - Todos os novos agents criados com esse template herdam a regra
```

**Frequência:** Loop ativo após cada incidente. Análise automática em < 1 hora.

---

### 3.2 Loop 2: Repeated Correction → Validator Rule

**Gatilho:** Mais de 3 correções manuais do mesmo tipo em um período de 14 dias.

**Conceito:** Quando operadores ou Governance Agents corrigem o mesmo tipo de problema repetidamente, isso indica que falta uma regra de validator.

**Exemplos de correções repetidas que viraram validator rules:**

```yaml
# Correção 1 (3 ocorrências em 7 dias):
# Agentes classificavam urgência como MEDIA para pacientes com SpO2 < 90%
# Correção manual: operadores elevavam para CRITICA
# Validator rule adicionada:
rule_id: "VLD-001"
rule_name: "spo2_critical_threshold"
condition: "output.urgency_level == 'MEDIUM' AND context.vitals.spo2 < 90"
action: "reject_output"
message: "SpO2 < 90% deve resultar em urgência CRITICA, não MEDIA"

# Correção 2 (5 ocorrências em 14 dias):
# Agentes classificavam pedidos de alta de pacientes internados há > 30 dias
# como urgência BAIXA, ignorando o contexto de internação prolongada
# Validator rule:
rule_id: "VLD-002"
rule_name: "long_stay_urgency_floor"
condition: "output.urgency_level == 'BAIXA' AND context.patient.admission_days > 30"
action: "escalate_to_human"
message: "Paciente com internação > 30 dias: urgência mínima MEDIA para revisão"
```

**Processo de criação de validator rule:**

```
CORREÇÃO MANUAL DETECTADA (repetição identificada pelo Learning Agent)
         │
         ▼
Learning Agent gera proposta de Validator Rule:
  - Padrão de correção documentado
  - Schema da regra proposta
  - Conjunto de teste: casos positivos e negativos
  - Estimativa de impacto (quantas tasks afetadas por dia)
         │
         ▼ (Validation Office revisa)
Governance Agent testa a regra:
  - Aplica retroativamente a 30 dias de histórico
  - Calcula precision e recall
  - Identifica falsos positivos e negativos
         │
         ▼ (se precision >= 0.95 e recall >= 0.90)
Validator Rule aprovada e deployada
  - Adicionada ao conjunto de regras do validator
  - Documentada no Knowledge Office
  - Testada em shadow mode por 7 dias antes de ativar em produção
```

---

### 3.3 Loop 3: Alert Noise → Alert Tuning

**Gatilho:** Alerta disparado com taxa de falso positivo > 20% nas últimas 2 semanas.

**Definição de falso positivo:** Alerta que foi disparado mas:

- Foi ignorado pela equipe sem nenhuma ação (sinal de que não é acionável)
- Foi silenciado/resolvido em < 2 minutos sem ação real
- Foi explicitamente marcado como "expected behavior" pelo on-call

**Fluxo de Alert Tuning:**

```python
class AlertTuningLoop:
    """
    Analisa alertas disparados e identifica candidatos a ajuste.
    Executa diariamente como Batch Agent.
    """

    def analyze_alert_quality(self, alert_name: str, period_days: int = 14) -> AlertQualityReport:
        alerts = self.prometheus.query_range(
            query=f'ALERTS{{alertname="{alert_name}"}}',
            period=f"{period_days}d"
        )

        actions_taken = self.loki.query(
            query=f'{{event="incident_action"}} |= "{alert_name}"',
            period=f"{period_days}d"
        )

        total_alerts = len(alerts)
        alerts_with_action = len(actions_taken)
        false_positive_rate = 1 - (alerts_with_action / total_alerts)

        return AlertQualityReport(
            alert_name=alert_name,
            period_days=period_days,
            total_alerts=total_alerts,
            alerts_with_action=alerts_with_action,
            false_positive_rate=false_positive_rate,
            recommendation=self.generate_recommendation(alert_name, false_positive_rate)
        )

    def generate_recommendation(self, alert_name: str, fp_rate: float) -> AlertRecommendation:
        if fp_rate > 0.50:
            return AlertRecommendation(
                action="increase_threshold_or_for_duration",
                urgency="high",
                rationale=f"Mais de 50% dos alertas são falsos positivos — alert noise prejudica operações"
            )
        elif fp_rate > 0.20:
            return AlertRecommendation(
                action="increase_for_duration",
                urgency="medium",
                rationale=f"Taxa de FP de {fp_rate:.0%} — aumentar a duração 'for' reduzirá ruído"
            )
        else:
            return AlertRecommendation(
                action="no_change",
                urgency="none",
                rationale="Taxa de FP dentro do limite aceitável"
            )
```

---

### 3.4 Loop 4: Cost Spike → Budget Rule

**Gatilho:** Custo de qualquer namespace ou agent excede 120% do baseline dos últimos 7 dias.

**Fluxo:**

```
CUSTO SPIKE DETECTADO (cost-sentinel)
         │
         ▼ (automático)
FinOps Learning Agent analisa:
  - Qual componente gerou o spike (namespace/agent/model)
  - Quando começou o spike
  - Correlação com mudanças de código, configuração ou volume
  - Projeção mensal se spike continuar
         │
         ▼
CAUSA IDENTIFICADA → BUDGET RULE PROPOSTA:

  Causa: Retry storm consumiu 3x o budget de inferência
  Budget Rule:
    rule: "Se retry_rate > 30%, pausar novas inferências LLM"
    scope: agent-level
    override: "human-in-loop para tasks clínicas críticas"

  OU

  Causa: Volume de tasks aumentou 2x sem correspondente análise de budget
  Budget Rule:
    rule: "Budget de inferência se auto-ajusta com volume * 1.2 (headroom de 20%)"
    scope: office-level
    review: "mensal, aprovação do FinOps Office"
         │
         ▼ (FinOps Office revisa)
BUDGET RULE IMPLEMENTADA como ConfigMap:
  - Aplicada a todos os agents do office/classe
  - Alerta configurado em 80% do novo budget
  - Revisão agendada em 30 dias
```

---

### 3.5 Loop 5: User Friction → UX Recommendation

**Gatilho:** Mais de 5 instâncias de usuários clínicos explicitamente substituindo a decisão automatizada do agent (override manual).

**Fontes de friction detectadas:**

- Overrides de classificação de urgência por enfermeiros
- Rejeições de propostas de roteamento pelo patient flow optimizer
- Cancelamentos manuais de workflows de alta iniciados automaticamente
- Feedbacks negativos marcados no task inbox

**Fluxo:**

```
FRICTION PATTERN DETECTADO (5+ overrides similares em 7 dias)
         │
         ▼
Learning Agent analisa padrão:
  - Qual tipo de decisão está sendo overrideada?
  - Em que contexto clínico ocorre?
  - O override é consistente entre diferentes usuários?
  - Existe uma regra que o agent não está considerando?
         │
         ▼
UX RECOMMENDATION gerada:
  - Se o agent está errado: proposta de correção de lógica/prompt
  - Se o contexto está faltando: proposta de tool adicional
  - Se a interface está confusa: recomendação para velya-web team
  - Se é preferência pessoal variável: recomendação de configuração por usuário
         │
         ▼ (Retention & Quality Office revisa)
RECOMMENDATION IMPLEMENTADA (após aprovação):
  - Mudança de configuração/prompt para agents
  - Feature request para velya-web
  - Documentação de comportamento esperado atualizada
```

---

## 4. Validação Antes de Propagação

Toda mudança proposta por um Learning Agent passa por um processo de validação obrigatório antes de entrar em produção.

### 4.1 Níveis de Risco de Mudança

| Tipo de Mudança                 | Nível de Risco | Validação Necessária                |
| ------------------------------- | -------------- | ----------------------------------- |
| Timeout de tool (não-clínico)   | Baixo          | Governance Agent review             |
| Regra de validator nova         | Médio          | Governance Agent + Knowledge Office |
| Mudança de prompt de LLM        | Médio          | Shadow mode 7 dias                  |
| Budget rule nova                | Baixo          | FinOps Office review                |
| Alert threshold                 | Baixo          | Observability Office review         |
| Mudança de lógica clínica       | Alto           | Governance Agent + Human review     |
| Nova tool em agent clínico      | Alto           | Security review + Human approval    |
| Mudança de confidence threshold | Alto           | Architecture Review + Shadow mode   |

### 4.2 Processo de Validação

```python
class LearningPropagationGate:
    """
    Gate de validação para propagação de aprendizado.
    Nenhuma mudança passa sem passar por este gate.
    """

    async def validate_change(self, change: ProposedChange) -> ValidationResult:
        risk_level = self.assess_risk(change)

        if risk_level == "low":
            # Validação automática por Governance Agent
            return await self.governance_agent_review(change)

        elif risk_level == "medium":
            # Governance Agent + Knowledge Office review
            governance_result = await self.governance_agent_review(change)
            if governance_result.approved:
                knowledge_result = await self.knowledge_office_review(change)
                return knowledge_result
            return governance_result

        elif risk_level == "high":
            # Governance Agent + Human review obrigatório
            governance_result = await self.governance_agent_review(change)
            if not governance_result.approved:
                return governance_result

            # Publicar para revisão humana com deadline
            human_review = await self.request_human_review(
                change=change,
                deadline_hours=24,
                reviewer_role="architecture-review"
            )
            return human_review

        elif risk_level == "critical":
            # Sempre human review + shadow mode
            return await self.request_human_review_with_shadow(change)

    def assess_risk(self, change: ProposedChange) -> str:
        if change.affects_clinical_logic:
            return "high"
        if change.affects_confidence_threshold:
            return "high"
        if change.type in ["new_tool", "permission_change"]:
            return "high"
        if change.type in ["validator_rule", "prompt_change"]:
            return "medium"
        if change.type in ["timeout_config", "budget_rule", "alert_threshold"]:
            return "low"
        return "medium"
```

---

## 5. Institutional Memory Architecture

O conhecimento institucional da Velya é estruturado em camadas:

```
CAMADA 1: EVENTOS BRUTOS
  - Logs Loki: todos os eventos de todos os sistemas
  - Métricas Prometheus: séries temporais de 1 ano
  - Audit trail NATS: decisões de agents (1 ano)

CAMADA 2: EVENTOS PROCESSADOS
  - Learning Events: incidentes, correções, feedbacks processados
  - KV NATS VELYA_LEARNING: learning events dos últimos 90 dias
  - Retention: 1 ano em arquivo frio (S3 Glacier no EKS)

CAMADA 3: CONHECIMENTO ESTRUTURADO
  - Playbooks: docs/agents/runbooks/
  - Validator rules: ConfigMap validator-rules no namespace velya-dev-agents
  - Budget rules: ConfigMap cost-budgets no namespace velya-dev-agents
  - Alert configs: PrometheusRule CRDs no namespace velya-dev-observability
  - Templates de agents: agents/_templates/

CAMADA 4: APRENDIZADO PROPAGADO
  - Mudanças de configuração: aplicadas via ArgoCD GitOps
  - Mudanças de prompt: versionadas em ConfigMap com hash
  - Novas regras de validator: deployadas como ConfigMap update
  - Documentação: publicada no Knowledge Office

CAMADA 5: APRENDIZADO INSTITUCIONAL (META-NÍVEL)
  - ADRs (Architecture Decision Records): docs/architecture/decisions/
  - Post-mortems: docs/operations/post-mortems/
  - Lessons Learned Index: Knowledge Office weekly digest
```

### 5.1 Knowledge Office Weekly Digest

Todo sábado às 20h UTC, o Knowledge Office gera um digest semanal:

```yaml
digest_template:
  title: 'Velya Knowledge Digest - Semana {week_number}'
  sections:
    - incidents_this_week:
        count: 3
        severities: [S2, S3, S3]
        resolved_all: true
        avg_mttr_minutes: 42

    - lessons_learned:
        - lesson: 'Timeout de tools deve usar P99 * 2'
          status: 'propagated'
          affected_agents: 8

    - validator_rules_added:
        - rule: 'VLD-001: spo2_critical_threshold'
          status: 'active'
          false_positive_rate_7d: 0.02

    - alerts_tuned:
        - alert: 'AgentHeartbeatStale'
          change: 'for: 1m → for: 2m'
          fp_reduction_percent: 45

    - cost_changes:
        - action: 'Timeout reduzido para task-classification'
          saving_percent: 12

    - pending_reviews:
        - change: 'Aumentar confidence threshold de 0.70 para 0.75'
          risk: 'high'
          waiting_since: '2026-04-06'
          reviewer: 'architecture-review'
```

---

## 6. Proteção Contra Aprendizado Adversarial

O sistema de learning é um vetor potencial de ataque: inputs maliciosos ou edge cases extremos poderiam gerar learning events que degradariam o comportamento do sistema.

### 6.1 Proteções Implementadas

**P1 — Volume Mínimo:** Uma learning pattern precisa de pelo menos 3 ocorrências antes de gerar proposta de mudança. Eventos únicos são registrados mas não propagados automaticamente.

**P2 — Consistência Temporal:** O padrão deve ocorrer em períodos diferentes (não apenas em um burst de 1 hora). Padrões de burst são investigados como possíveis ataques.

**P3 — Validação Retroativa:** Toda mudança proposta é testada retroativamente em 30 dias de dados históricos antes de aprovação. Se a regra teria gerado muitos falsos positivos históricos, é rejeitada.

**P4 — Human Review para Mudanças Clínicas:** Nenhuma mudança com impacto clínico é propagada sem revisão humana explícita. Sem exceções.

**P5 — Rollback Rápido:** Toda mudança propagada pode ser revertida em < 5 minutos via rollback do ConfigMap/ArgoCD. O Knowledge Office mantém o histórico de versões de todas as configurações.

**P6 — Auditoria de Origem:** Cada mudança propagada registra sua cadeia de origem: qual evento → qual learning event → qual review → qual aprovação. Auditável em retroativo.
