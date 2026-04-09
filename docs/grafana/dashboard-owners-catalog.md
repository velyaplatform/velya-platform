# Catalogo de Owners de Dashboards

## Visao Geral

Todo dashboard no Grafana da plataforma Velya deve ter um owner atribuido. O owner e responsavel pela manutencao, atualizacao, revisao e qualidade do dashboard. Este catalogo define o owner para cada categoria e dashboard especifico.

---

## Estrutura de Ownership

### Papeis de Owner

| Papel                | Responsabilidades                                    | Escalacao Para |
| -------------------- | ---------------------------------------------------- | -------------- |
| Platform Engineering | Infra, Kubernetes, observability stack, cloud, CI/CD | SRE Lead       |
| Backend Engineering  | APIs, microservicos, integracao, banco de dados      | Backend Lead   |
| Frontend Engineering | Web, mobile, UX metricas, web vitals                 | Frontend Lead  |
| AI Engineering       | Agentes, LLM, orchestrator, guardrails, profiling    | AI Lead        |
| Product Engineering  | Metricas de negocio, fluxo hospitalar, revenue       | Product Lead   |
| SRE                  | Confiabilidade, SLOs, incidentes, meta-monitoring    | SRE Lead       |

### Cadencia de Revisao por Criticidade

| Criticidade | Cadencia de Revisao | Tempo Maximo sem Revisao | Acao se Exceder          |
| ----------- | ------------------- | ------------------------ | ------------------------ |
| Critical    | Semanal             | 14 dias                  | Alerta para owner + lead |
| High        | Quinzenal           | 30 dias                  | Alerta para owner        |
| Medium      | Mensal              | 60 dias                  | Notificacao              |
| Low         | Trimestral          | 90 dias                  | Notificacao              |

---

## Categoria 1: Platform/Infra (7 Dashboards)

| #   | Dashboard                 | UID                       | Owner                | Contato               | Criticidade | Frequencia Update | Cadencia Validacao |
| --- | ------------------------- | ------------------------- | -------------------- | --------------------- | ----------- | ----------------- | ------------------ |
| 1   | Platform Overview         | velya-platform-overview   | Platform Engineering | platform@velya.health | Critical    | Semanal           | Semanal            |
| 2   | Kubernetes Cluster Status | velya-kubernetes-cluster  | Platform Engineering | platform@velya.health | Critical    | Quinzenal         | Semanal            |
| 3   | Node Resources            | velya-node-resources      | Platform Engineering | platform@velya.health | High        | Mensal            | Quinzenal          |
| 4   | Namespace Resources       | velya-namespace-resources | Platform Engineering | platform@velya.health | High        | Mensal            | Quinzenal          |
| 5   | Networking & Ingress      | velya-networking          | Platform Engineering | platform@velya.health | High        | Mensal            | Quinzenal          |
| 6   | ArgoCD Sync Status        | velya-argocd-status       | Platform Engineering | platform@velya.health | Critical    | Quinzenal         | Semanal            |
| 7   | KEDA Autoscaling          | velya-keda-autoscaling    | Platform Engineering | platform@velya.health | High        | Mensal            | Quinzenal          |

### Detalhes de Ownership - Platform/Infra

**Platform Overview**

- Owner primario: Tech Lead de Platform
- Backup owner: SRE Senior
- Escalacao: CTO (se indisponivel por >24h em incidente)
- Revisao: Toda segunda-feira no standup de plataforma
- Decisoes que suporta: "A plataforma esta saudavel? Preciso de alguma acao imediata?"

**Kubernetes Cluster Status**

- Owner primario: Engenheiro Kubernetes
- Backup owner: SRE de plantao
- Escalacao: Platform Lead
- Revisao: Toda segunda e quinta
- Decisoes que suporta: "O cluster esta saudavel? Nodes com problema? Preciso escalar?"

**ArgoCD Sync Status**

- Owner primario: Engenheiro DevOps/GitOps
- Backup owner: Platform Engineer
- Escalacao: Platform Lead
- Revisao: Apos cada deploy e semanalmente
- Decisoes que suporta: "Todos os servicos estao sincronizados? Algum deploy falhou?"

---

## Categoria 2: Backend (6 Dashboards)

| #   | Dashboard                  | UID                        | Owner               | Contato              | Criticidade | Frequencia Update | Cadencia Validacao |
| --- | -------------------------- | -------------------------- | ------------------- | -------------------- | ----------- | ----------------- | ------------------ |
| 1   | Patient API Service        | velya-patient-api          | Backend Engineering | backend@velya.health | Critical    | Semanal           | Semanal            |
| 2   | Scheduling API             | velya-scheduling-api       | Backend Engineering | backend@velya.health | Critical    | Semanal           | Semanal            |
| 3   | Auth Service               | velya-auth-service         | Backend Engineering | backend@velya.health | Critical    | Quinzenal         | Semanal            |
| 4   | Notification Service       | velya-notification-service | Backend Engineering | backend@velya.health | High        | Mensal            | Quinzenal          |
| 5   | Billing Service            | velya-billing-service      | Backend Engineering | backend@velya.health | Critical    | Semanal           | Semanal            |
| 6   | Integration Hub (HL7/FHIR) | velya-integration-hub      | Backend Engineering | backend@velya.health | Critical    | Semanal           | Semanal            |

### Detalhes de Ownership - Backend

**Patient API Service**

- Owner primario: Tech Lead Backend - Squad Patient
- Backup owner: SRE de plantao
- Escalacao: Backend Lead + SRE Lead
- Revisao: Sprint review (cada 2 semanas) + semanal
- Decisoes que suporta: "API de pacientes esta saudavel? Latencia aceitavel? Erros?"
- Nota: Dashboard critico - usado ativamente durante incidentes

**Integration Hub (HL7/FHIR)**

- Owner primario: Engenheiro de Integracoes
- Backup owner: Backend Lead
- Escalacao: CTO (integracoes hospitalares sao criticas)
- Revisao: Semanal + apos cada nova integracao
- Decisoes que suporta: "Integracoes com sistemas hospitalares estao funcionando?"
- Nota: Impacto direto em operacao hospitalar

---

## Categoria 3: Frontend (5 Dashboards)

| #   | Dashboard               | UID                        | Owner                | Contato               | Criticidade | Frequencia Update | Cadencia Validacao |
| --- | ----------------------- | -------------------------- | -------------------- | --------------------- | ----------- | ----------------- | ------------------ |
| 1   | Frontend Web Vitals     | velya-frontend-vitals      | Frontend Engineering | frontend@velya.health | High        | Quinzenal         | Quinzenal          |
| 2   | Frontend Error Tracking | velya-frontend-errors      | Frontend Engineering | frontend@velya.health | High        | Quinzenal         | Quinzenal          |
| 3   | Frontend Performance    | velya-frontend-performance | Frontend Engineering | frontend@velya.health | Medium      | Mensal            | Mensal             |
| 4   | Mobile App Telemetry    | velya-mobile-telemetry     | Frontend Engineering | frontend@velya.health | Medium      | Mensal            | Mensal             |
| 5   | User Experience Metrics | velya-user-experience      | Frontend Engineering | frontend@velya.health | Medium      | Mensal            | Mensal             |

### Detalhes de Ownership - Frontend

**Frontend Web Vitals**

- Owner primario: Tech Lead Frontend
- Backup owner: Frontend Senior
- Escalacao: Frontend Lead
- Revisao: Sprint review + semanal
- Decisoes que suporta: "Web vitals (LCP, FID, CLS) estao aceitaveis? Experiencia degradou?"

**Frontend Error Tracking**

- Owner primario: Engenheiro Frontend Senior
- Backup owner: Tech Lead Frontend
- Escalacao: Frontend Lead
- Revisao: Diariamente durante standup
- Decisoes que suporta: "Ha erros criticos no frontend? Quais paginas afetadas?"

---

## Categoria 4: AI Agents (7 Dashboards)

| #   | Dashboard                 | UID                      | Owner          | Contato         | Criticidade | Frequencia Update | Cadencia Validacao |
| --- | ------------------------- | ------------------------ | -------------- | --------------- | ----------- | ----------------- | ------------------ |
| 1   | Agent Orchestrator        | velya-agent-orchestrator | AI Engineering | ai@velya.health | Critical    | Semanal           | Semanal            |
| 2   | Triage Agent              | velya-agent-triage       | AI Engineering | ai@velya.health | Critical    | Semanal           | Semanal            |
| 3   | Diagnosis Agent           | velya-agent-diagnosis    | AI Engineering | ai@velya.health | Critical    | Semanal           | Semanal            |
| 4   | Scheduling Agent          | velya-agent-scheduling   | AI Engineering | ai@velya.health | High        | Quinzenal         | Quinzenal          |
| 5   | Follow-up Agent           | velya-agent-followup     | AI Engineering | ai@velya.health | High        | Quinzenal         | Quinzenal          |
| 6   | LLM Gateway               | velya-llm-gateway        | AI Engineering | ai@velya.health | Critical    | Semanal           | Semanal            |
| 7   | Agent Guardrails & Safety | velya-agent-guardrails   | AI Engineering | ai@velya.health | Critical    | Semanal           | Semanal            |

### Detalhes de Ownership - AI Agents

**Agent Orchestrator**

- Owner primario: AI Lead
- Backup owner: AI Senior Engineer
- Escalacao: CTO
- Revisao: Daily standup + semanal detalhada
- Decisoes que suporta: "Orquestracao de agentes esta saudavel? Timeout? Falhas em cadeia?"
- Nota: Ponto central do sistema de agentes - qualquer falha afeta todos os agentes

**LLM Gateway**

- Owner primario: AI Infrastructure Engineer
- Backup owner: AI Lead
- Escalacao: AI Lead + CTO
- Revisao: Diaria
- Decisoes que suporta: "Gateway LLM esta respondendo? Latencia aceitavel? Rate limit? Custo?"
- Nota: Dependencia critica de provedores externos (OpenAI, Anthropic)

**Agent Guardrails & Safety**

- Owner primario: AI Safety Engineer
- Backup owner: AI Lead
- Escalacao: CTO + Legal
- Revisao: Diaria
- Decisoes que suporta: "Guardrails estao ativos? Algum agente violou safety boundary?"
- Nota: Criticidade maxima em contexto hospitalar - qualquer falha e incidente

---

## Categoria 5: Business/Hospital (5 Dashboards)

| #   | Dashboard                   | UID                         | Owner               | Contato              | Criticidade | Frequencia Update | Cadencia Validacao |
| --- | --------------------------- | --------------------------- | ------------------- | -------------------- | ----------- | ----------------- | ------------------ |
| 1   | Patient Flow & Admission    | velya-patient-flow          | Product Engineering | product@velya.health | Critical    | Semanal           | Semanal            |
| 2   | Appointment Analytics       | velya-appointment-analytics | Product Engineering | product@velya.health | High        | Quinzenal         | Quinzenal          |
| 3   | Bed Management              | velya-bed-management        | Product Engineering | product@velya.health | High        | Quinzenal         | Quinzenal          |
| 4   | Revenue Cycle               | velya-revenue-cycle         | Product Engineering | product@velya.health | Critical    | Semanal           | Semanal            |
| 5   | Clinical Quality Indicators | velya-clinical-quality      | Product Engineering | product@velya.health | Critical    | Semanal           | Semanal            |

### Detalhes de Ownership - Business/Hospital

**Patient Flow & Admission**

- Owner primario: Product Manager - Operacoes Hospitalares
- Backup owner: Product Lead
- Escalacao: COO
- Revisao: Diaria (operacao hospitalar)
- Decisoes que suporta: "Fluxo de pacientes esta normal? Gargalos? Tempo de espera?"

**Clinical Quality Indicators**

- Owner primario: Product Manager - Qualidade Clinica
- Backup owner: Medical Director (Advisory)
- Escalacao: COO + Medical Director
- Revisao: Diaria
- Decisoes que suporta: "Indicadores de qualidade estao dentro do esperado? ANVISA compliance?"
- Nota: Requisito regulatorio - dados devem ser precisos e disponiveis

---

## Categoria 6: Observability Health (6 Dashboards)

| #   | Dashboard                   | UID                        | Owner                | Contato               | Criticidade | Frequencia Update | Cadencia Validacao |
| --- | --------------------------- | -------------------------- | -------------------- | --------------------- | ----------- | ----------------- | ------------------ |
| 1   | Datasource Integrity        | velya-datasource-integrity | Platform Engineering | platform@velya.health | Critical    | Quinzenal         | Semanal            |
| 2   | Prometheus Health           | velya-meta-prometheus      | Platform Engineering | platform@velya.health | Critical    | Mensal            | Semanal            |
| 3   | Loki Health                 | velya-meta-loki            | Platform Engineering | platform@velya.health | Critical    | Mensal            | Semanal            |
| 4   | Tempo Health                | velya-meta-tempo           | Platform Engineering | platform@velya.health | High        | Mensal            | Quinzenal          |
| 5   | Alloy/OTel Collector Health | velya-meta-alloy           | Platform Engineering | platform@velya.health | High        | Mensal            | Quinzenal          |
| 6   | Dashboard Assurance Engine  | velya-dae-status           | Platform Engineering | platform@velya.health | High        | Quinzenal         | Quinzenal          |

---

## Categoria 7: Cost/Efficiency (4 Dashboards)

| #   | Dashboard                   | UID                       | Owner                | Contato               | Criticidade | Frequencia Update | Cadencia Validacao |
| --- | --------------------------- | ------------------------- | -------------------- | --------------------- | ----------- | ----------------- | ------------------ |
| 1   | Cloud Cost Overview (AWS)   | velya-cloud-cost          | Platform Engineering | platform@velya.health | High        | Mensal            | Mensal             |
| 2   | Resource Efficiency         | velya-resource-efficiency | Platform Engineering | platform@velya.health | Medium      | Mensal            | Mensal             |
| 3   | Observability Stack Cost    | velya-observability-cost  | Platform Engineering | platform@velya.health | Medium      | Mensal            | Mensal             |
| 4   | Rightsizing Recommendations | velya-rightsizing         | Platform Engineering | platform@velya.health | Medium      | Mensal            | Mensal             |

---

## Resumo Geral

### Por Categoria

| Categoria            | Dashboards | Critical | High   | Medium | Low   | Owner Principal      |
| -------------------- | ---------- | -------- | ------ | ------ | ----- | -------------------- |
| Platform/Infra       | 7          | 3        | 4      | 0      | 0     | Platform Engineering |
| Backend              | 6          | 5        | 1      | 0      | 0     | Backend Engineering  |
| Frontend             | 5          | 0        | 2      | 3      | 0     | Frontend Engineering |
| AI Agents            | 7          | 5        | 2      | 0      | 0     | AI Engineering       |
| Business/Hospital    | 5          | 3        | 2      | 0      | 0     | Product Engineering  |
| Observability Health | 6          | 3        | 3      | 0      | 0     | Platform Engineering |
| Cost/Efficiency      | 4          | 0        | 1      | 3      | 0     | Platform Engineering |
| **Total**            | **40**     | **19**   | **15** | **6**  | **0** |                      |

### Por Owner

| Owner                | Dashboards | Critical | High | Medium |
| -------------------- | ---------- | -------- | ---- | ------ |
| Platform Engineering | 17         | 6        | 8    | 3      |
| Backend Engineering  | 6          | 5        | 1    | 0      |
| Frontend Engineering | 5          | 0        | 2    | 3      |
| AI Engineering       | 7          | 5        | 2    | 0      |
| Product Engineering  | 5          | 3        | 2    | 0      |

---

## Processo de Transferencia de Ownership

```yaml
ownership_transfer:
  trigger:
    - owner_leaving_company
    - team_restructuring
    - service_ownership_change

  process:
    1_notification:
      - notify_current_owner
      - notify_new_owner
      - notify_platform_engineering
      - deadline: 7_days

    2_knowledge_transfer:
      - review_dashboard_with_new_owner
      - explain_decisions_behind_panels
      - share_runbooks_and_context
      - verify_access_permissions

    3_handoff:
      - update_ownership_registry
      - update_dashboard_tags
      - update_escalation_chain
      - verify_DAE_recognizes_new_owner

    4_validation:
      - new_owner_reviews_dashboard
      - new_owner_confirms_understanding
      - DAE_validates_ownership_complete
```

---

## Metricas de Ownership

```promql
# Dashboards sem owner
count(dae_dashboard_has_owner == 0)

# Dashboards com owner mas sem revisao recente
count(
  (time() - dae_dashboard_last_owner_review) > 30 * 24 * 3600
  AND dae_dashboard_has_owner == 1
)

# Distribuicao de dashboards por owner
count by (owner_role) (dae_dashboard_has_owner == 1)

# Dashboards criticos sem revisao recente
count(
  dae_dashboard_health_score{criticality="critical"}
  AND (time() - dae_dashboard_last_owner_review) > 14 * 24 * 3600
)
```
