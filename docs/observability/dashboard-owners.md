# Owners de Dashboards e Alertas — Velya Platform

> Todo dashboard e alerta deve ter um owner. Sem owner = sem responsabilidade = degradação invisível.
> Última atualização: 2026-04-08

---

## 1. Regras de Ownership

| Regra | Detalhe |
|-------|---------|
| **Sem owner é inaceitável** | Todo dashboard e alerta sem owner entra em revisão imediata para atribuição ou remoção |
| **Owner ausente > 30 dias** | Transferir para office pai ou remover em 2 semanas |
| **Dashboard sem uso em 60 dias** | Candidato à remoção — agendar revisão com owner |
| **Alerta sem acionamento em 90 dias** | Revisar se condição de disparo é relevante; considerar remoção |
| **Revisão periódica obrigatória** | Todos os dashboards e alertas são revisados a cada 90 dias |
| **Owner de Agent** | Agent owner pode ser um agent-manager-agent ou human lead do office |

---

## 2. Glossário de Owners (Offices)

| Office ID | Nome | Responsabilidade |
|-----------|------|-----------------|
| `platform-office` | Platform Office | Infraestrutura K8s, GitOps, KEDA, custo, observabilidade da stack |
| `backend-office` | Backend Office | APIs, serviços NestJS, banco de dados, filas NATS |
| `frontend-office` | Frontend Office | velya-web, UX, Web Vitals, erros de browser |
| `agents-office` | Agents Office | Workers Temporal, AI gateway, qualidade de agents |
| `clinical-office` | Clinical Office | Fluxo clínico, altas, task inbox, handoff de turno |
| `security-office` | Security Office | Secrets, certificados, políticas de segurança, compliance |
| `compliance-office` | Compliance Office | Auditoria de decisões clínicas, registros regulatórios |

---

## 3. Registro de Ownership — Dashboards

### 3.1 Dashboards de Infraestrutura

| Dashboard | ID | Owner (Office) | Owner (Agent) | Revisão | Critério para Remoção | Status |
|-----------|----|--------------|----|---------|----------------------|--------|
| Visão Geral do Cluster | velya-infra-cluster-overview | platform-office | platform-manager-agent | Trimestral | Não consultado por 90 dias AND nenhum alerta depende dele | Planejado |
| Node & NodePool Health | velya-infra-node-nodepool | platform-office | platform-manager-agent | Trimestral | Idem | Planejado |
| Namespace Health | velya-infra-namespace-health | platform-office | platform-manager-agent | Trimestral | Idem | Planejado |
| Scheduling & Quotas | velya-infra-scheduling-quotas | platform-office | platform-manager-agent | Trimestral | Idem | Planejado |
| Storage & Rede | velya-infra-storage-network | platform-office | platform-manager-agent | Trimestral | Idem | Planejado |
| KEDA Scaling Monitor | velya-keda-scaling-monitor | platform-office | platform-manager-agent | Mensal | KEDA removido da stack | Planejado |
| ArgoCD Delivery Monitor | velya-infra-argocd-delivery-monitor | platform-office | platform-manager-agent | Mensal | ArgoCD substituído | Planejado |

### 3.2 Dashboards de Backend

| Dashboard | ID | Owner (Office) | Owner (Agent) | Revisão | Critério para Remoção | Status |
|-----------|----|--------------|----|---------|----------------------|--------|
| API RED Dashboard | velya-backend-api-red | backend-office | backend-manager-agent | Mensal | Substituto implementado | Prioritário |
| Mapa de Dependências | velya-backend-dependency-map | backend-office | backend-manager-agent | Trimestral | Todos os serviços aposentados | Planejado |
| Queue & Worker Health | velya-backend-queue-worker-health | backend-office | backend-manager-agent | Mensal | NATS/Temporal substituído | Planejado |
| Performance PostgreSQL | velya-backend-postgresql-performance | backend-office | backend-manager-agent | Trimestral | Banco substituído | Planejado |
| Integration Health | velya-backend-integration-health | backend-office | backend-manager-agent | Mensal | Integrações substituídas | Planejado |
| AI Gateway Performance | velya-backend-ai-gateway-performance | agents-office | agents-manager-agent | Mensal | AI Gateway substituído | Prioritário |

### 3.3 Dashboards de Frontend

| Dashboard | ID | Owner (Office) | Owner (Agent) | Revisão | Critério para Remoção | Status |
|-----------|----|--------------|----|---------|----------------------|--------|
| Frontend Experience Overview | velya-frontend-experience-overview | frontend-office | frontend-manager-agent | Mensal | velya-web aposentado | Planejado |
| Route Performance | velya-frontend-route-performance | frontend-office | frontend-manager-agent | Trimestral | Idem | Planejado |
| UX Friction Board | velya-frontend-ux-friction-board | frontend-office | frontend-manager-agent | Mensal | Idem | Planejado |
| Action Failure Board | velya-frontend-action-failure-board | frontend-office | frontend-manager-agent | Mensal | Idem | Planejado |
| Degraded Mode Board | velya-frontend-degraded-mode-board | frontend-office | frontend-manager-agent | Mensal | Modo degradado removido | Planejado |

### 3.4 Dashboards de Agents e Empresa Digital

| Dashboard | ID | Owner (Office) | Owner (Agent) | Revisão | Critério para Remoção | Status |
|-----------|----|--------------|----|---------|----------------------|--------|
| Agent Oversight Console | velya-agents-oversight-console | agents-office | agents-manager-agent | Mensal | Empresa digital encerrada | Prioritário |
| Office Health Board | velya-agents-office-health-board | agents-office | agents-manager-agent | Mensal | Idem | Planejado |
| Validation Board | velya-agents-validation-board | agents-office | quality-manager-agent | Mensal | Validação encerrada | Planejado |
| Audit Board | velya-agents-audit-board | compliance-office | audit-manager-agent | Mensal | Requisito regulatório alterado | Planejado |
| Handoff Monitor | velya-agents-handoff-monitor | agents-office | agents-manager-agent | Mensal | Handoffs removidos da arquitetura | Planejado |
| Learning Monitor | velya-agents-learning-monitor | agents-office | learning-manager-agent | Mensal | Learning desabilitado | Planejado |
| Quarantine Center | velya-agents-quarantine-center | agents-office | agents-manager-agent | Mensal | Quarentena removida | Planejado |
| Promotion & Retirement Board | velya-agents-promotion-retirement-board | agents-office | agents-manager-agent | Trimestral | Lifecycle desabilitado | Planejado |

### 3.5 Dashboards de Negócio Hospitalar

| Dashboard | ID | Owner (Office) | Owner (Agent) | Revisão | Critério para Remoção | Status |
|-----------|----|--------------|----|---------|----------------------|--------|
| Patient Flow Command Board | velya-clinical-patient-flow-command-board | clinical-office | clinical-manager-agent | Mensal | Módulo de fluxo desativado | Prioritário |
| Discharge Control Board | velya-clinical-discharge-control-board | clinical-office | clinical-manager-agent | Mensal | Módulo de alta desativado | Prioritário |
| Capacity & Bottleneck Board | velya-clinical-capacity-bottleneck-board | clinical-office | clinical-manager-agent | Mensal | Módulo de capacidade desativado | Planejado |
| Inbox Intelligence Board | velya-clinical-inbox-intelligence-board | clinical-office | clinical-manager-agent | Mensal | Inbox desativada | Prioritário |
| Operational Risk Board | velya-clinical-operational-risk-board | clinical-office | clinical-manager-agent | Mensal | Módulo de risco desativado | Planejado |

### 3.6 Dashboards de Segurança e Compliance

| Dashboard | ID | Owner (Office) | Owner (Agent) | Revisão | Critério para Remoção | Status |
|-----------|----|--------------|----|---------|----------------------|--------|
| Secrets & Identity Board | velya-security-secrets-identity-board | security-office | security-manager-agent | Mensal | Gestão de segredos substituída | Planejado |
| Policy Drift Board | velya-security-policy-drift-board | security-office | security-manager-agent | Mensal | Policy engine substituído | Planejado |

### 3.7 Dashboards de Custo

| Dashboard | ID | Owner (Office) | Owner (Agent) | Revisão | Critério para Remoção | Status |
|-----------|----|--------------|----|---------|----------------------|--------|
| Observability Cost Board | velya-cost-observability-board | platform-office | platform-manager-agent | Mensal | Stack de observabilidade substituída | Planejado |
| Namespace & NodePool Cost Board | velya-cost-namespace-nodepool | platform-office | platform-manager-agent | Mensal | Modelo de custo alterado | Planejado |

---

## 4. Registro de Ownership — Alertas

### 4.1 Alertas de Infraestrutura

| Alerta | ID | Severidade | Owner (Office) | Owner (Agent) | Revisão | Último Acionamento | Status |
|--------|----|-----------|--------------|---|---------|-------------------|--------|
| NodeMemoryPressure | INFRA-001 | critical | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| NodeDiskPressure | INFRA-002 | critical | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| PodCrashLoopBackOff | INFRA-003 | high | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| PodPendingTooLong | INFRA-004 | high | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| PVCAlmostFull | INFRA-005 | medium | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| PVCCriticallyFull | INFRA-006 | critical | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| NodeCPUHighSustained | INFRA-007 | high | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| NodeNotReady | INFRA-008 | critical | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| HighPodEvictionRate | INFRA-009 | high | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| HighContainerRestartRate | INFRA-010 | medium | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| KubernetesAPIServerDown | INFRA-011 | critical | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| PrometheusTargetDown | INFRA-012 | medium | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| HighNetworkErrors | INFRA-013 | medium | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| PersistentVolumeNotBound | INFRA-014 | high | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| ClusterResourceQuotaExceeding | INFRA-015 | high | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |

### 4.2 Alertas de Plataforma

| Alerta | ID | Severidade | Owner (Office) | Owner (Agent) | Revisão | Último Acionamento | Status |
|--------|----|-----------|--------------|---|---------|-------------------|--------|
| ArgoCDApplicationOutOfSync | PLAT-001 | medium | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| ArgoCDApplicationDegraded | PLAT-002 | high | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| KEDAScalerThrash | PLAT-003 | high | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| KEDAPrometheusSourceUnavailable | PLAT-004 | high | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| SecretRetrievalFailure | PLAT-005 | critical | security-office | security-manager-agent | 90 dias | Nunca | Planejado |
| CertificateExpiringSoon | PLAT-006 | medium | security-office | security-manager-agent | 90 dias | Nunca | Planejado |
| CertificateExpiredCritical | PLAT-007 | critical | security-office | security-manager-agent | 90 dias | Nunca | Planejado |
| GitOpsDriftDetected | PLAT-008 | high | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |

### 4.3 Alertas de Backend

| Alerta | ID | Severidade | Owner (Office) | Owner (Agent) | Revisão | Último Acionamento | Status |
|--------|----|-----------|--------------|---|---------|-------------------|--------|
| ServiceHighErrorRate | BACK-001 | high | backend-office | backend-manager-agent | 90 dias | Nunca | Planejado |
| ServiceCriticalErrorRate | BACK-002 | critical | backend-office | backend-manager-agent | 90 dias | Nunca | Planejado |
| ServiceHighLatencyP99 | BACK-003 | high | backend-office | backend-manager-agent | 90 dias | Nunca | Planejado |
| ServiceDown | BACK-004 | critical | backend-office | backend-manager-agent | 90 dias | Nunca | Planejado |
| QueueBuildup | BACK-005 | high | backend-office | backend-manager-agent | 90 dias | Nunca | Planejado |
| DeadLetterQueueNonEmpty | BACK-006 | high | backend-office | backend-manager-agent | 90 dias | Nunca | Planejado |
| DatabaseConnectionPoolExhausted | BACK-007 | high | backend-office | backend-manager-agent | 90 dias | Nunca | Planejado |
| CircuitBreakerOpen | BACK-008 | high | backend-office | backend-manager-agent | 90 dias | Nunca | Planejado |
| APIGatewayDown | BACK-009 | critical | backend-office | backend-manager-agent | 90 dias | Nunca | Planejado |
| AIGatewayRateLimitErrors | BACK-010 | high | agents-office | agents-manager-agent | 90 dias | Nunca | Planejado |

### 4.4 Alertas de Frontend

| Alerta | ID | Severidade | Owner (Office) | Owner (Agent) | Revisão | Último Acionamento | Status |
|--------|----|-----------|--------------|---|---------|-------------------|--------|
| FrontendJSErrorSpike | FRONT-001 | high | frontend-office | frontend-manager-agent | 90 dias | Nunca | Planejado |
| FrontendRouteSlowLCP | FRONT-002 | medium | frontend-office | frontend-manager-agent | 90 dias | Nunca | Planejado |
| FrontendDegradedModeActive | FRONT-003 | high | frontend-office | frontend-manager-agent | 90 dias | Nunca | Planejado |
| FrontendAPIFailureSpike | FRONT-004 | high | frontend-office | frontend-manager-agent | 90 dias | Nunca | Planejado |
| FrontendHighFlowAbandonment | FRONT-005 | medium | frontend-office | frontend-manager-agent | 90 dias | Nunca | Planejado |

### 4.5 Alertas de Agents

| Alerta | ID | Severidade | Owner (Office) | Owner (Agent) | Revisão | Último Acionamento | Status |
|--------|----|-----------|--------------|---|---------|-------------------|--------|
| AgentSilentWarning | AGENT-001 | medium | agents-office | agents-manager-agent | 90 dias | Nunca | Planejado |
| AgentSilentCritical | AGENT-002 | critical | agents-office | agents-manager-agent | 90 dias | Nunca | Planejado |
| AgentHighValidationRejection | AGENT-003 | high | agents-office | quality-manager-agent | 90 dias | Nunca | Planejado |
| AgentCorrectionLoop | AGENT-004 | high | agents-office | agents-manager-agent | 90 dias | Nunca | Planejado |
| AgentQuarantineEvent | AGENT-005 | critical | agents-office | agents-manager-agent | 90 dias | Nunca | Planejado |
| AgentWatchdogIncident | AGENT-006 | high | agents-office | agents-manager-agent | 90 dias | Nunca | Planejado |
| AgentEvidenceCompletenessLow | AGENT-007 | medium | agents-office | quality-manager-agent | 90 dias | Nunca | Planejado |
| AgentTokenCostExplosion | AGENT-008 | high | agents-office | agents-manager-agent | 90 dias | Nunca | Planejado |

### 4.6 Alertas Clínicos

| Alerta | ID | Severidade | Owner (Office) | Owner (Agent) | Revisão | Último Acionamento | Status |
|--------|----|-----------|--------------|---|---------|-------------------|--------|
| DischargeBlockerAged | CLIN-001 | critical | clinical-office | clinical-manager-agent | 30 dias | Nunca | Planejado |
| InboxOverload | CLIN-002 | critical | clinical-office | clinical-manager-agent | 30 dias | Nunca | Planejado |
| NoNextAction | CLIN-003 | high | clinical-office | clinical-manager-agent | 30 dias | Nunca | Planejado |
| HandoffStuck | CLIN-004 | high | agents-office | agents-manager-agent | 30 dias | Nunca | Planejado |
| ClinicalAlertDeliveryLatencyHigh | CLIN-005 | critical | backend-office | backend-manager-agent | 30 dias | Nunca | Planejado |
| DischargeBacklogGrowing | CLIN-006 | medium | clinical-office | clinical-manager-agent | 30 dias | Nunca | Planejado |

### 4.7 Alertas de Custo

| Alerta | ID | Severidade | Owner (Office) | Owner (Agent) | Revisão | Último Acionamento | Status |
|--------|----|-----------|--------------|---|---------|-------------------|--------|
| PrometheusHighCardinality | COST-001 | medium | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| LokiIngestionSpike | COST-002 | medium | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| KEDAThrashCost | COST-003 | medium | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |
| AITokenConsumptionHigh | COST-004 | high | agents-office | agents-manager-agent | 90 dias | Nunca | Planejado |
| PrometheusStorageGrowing | COST-005 | low | platform-office | platform-manager-agent | 90 dias | Nunca | Planejado |

---

## 5. Alertas Existentes (PrometheusRule velya-service-alerts)

Os 5 alertas atualmente existentes no cluster. Ownership adicionado retroativamente:

| Alerta | Severidade | Owner (Office) | Runbook | Estado |
|--------|-----------|--------------|---------|--------|
| VelyaServiceHighErrorRate | high | backend-office | **AUSENTE** — criar urgente | Ativo, sem runbook, sem destinatário |
| VelyaServiceHighLatency | high | backend-office | **AUSENTE** — criar urgente | Ativo, sem runbook, sem destinatário |
| VelyaServiceDown | critical | backend-office | **AUSENTE** — criar urgente | Ativo, sem runbook, sem destinatário |
| VelyaDeploymentReplicasMismatch | medium | platform-office | **AUSENTE** — criar urgente | Ativo, sem runbook, sem destinatário |
| VelyaJobFailed | medium | platform-office | **AUSENTE** — criar urgente | Ativo, sem runbook, sem destinatário |

---

## 6. Processo de Revisão Trimestral

**Agenda de revisão** (executar a cada 90 dias):

```bash
#!/bin/bash
# scripts/review-observability-ownership.sh
# Executar trimestralmente para identificar dashboards e alertas órfãos

echo "=== Revisão de Ownership de Observabilidade ==="
echo "Data: $(date)"

# 1. Dashboards no Grafana sem correspondência no catálogo
echo ""
echo "--- Dashboards no Grafana sem registro no catálogo ---"
GRAFANA_DASHBOARDS=$(curl -s http://localhost:3000/api/search?type=dash-db \
  -H "Authorization: Bearer ${GRAFANA_API_KEY}" | jq -r '.[].uid')

# Comparar com lista de IDs conhecidos no dashboard-catalog.md
# (implementar comparação)

# 2. Alertas sem acionamento nos últimos 90 dias
echo ""
echo "--- Alertas sem acionamento nos últimos 90 dias ---"
curl -s 'http://localhost:9090/api/v1/query?query=ALERTS_FOR_STATE{alertstate="firing"}' \
  | jq -r '.data.result[].metric.alertname' | sort -u

# 3. PrometheusRules sem runbook_url
echo ""
echo "--- PrometheusRules sem runbook_url ---"
kubectl get prometheusrule -n velya-dev-observability -o json \
  | jq -r '.items[].spec.groups[].rules[] | select(.annotations.runbook_url == null) | .alert'

echo ""
echo "=== Revisão concluída. Atualizar dashboard-owners.md com resultados ==="
```

---

## 7. Resumo Executivo

| Categoria | Dashboards | Alertas | Com Owner | Sem Owner | Implementado |
|---------|-----------|--------|----------|---------|-------------|
| Infraestrutura | 7 | 15 | 22 (100%) | 0 | 0 |
| Backend | 6 | 10 | 16 (100%) | 0 | 0 |
| Frontend | 5 | 5 | 10 (100%) | 0 | 0 |
| Agents | 8 | 8 | 16 (100%) | 0 | 0 |
| Negócio Clínico | 5 | 6 | 11 (100%) | 0 | 0 |
| Segurança | 2 | — | 2 (100%) | 0 | 0 |
| Custo | 2 | 5 | 7 (100%) | 0 | 0 |
| **Total** | **35** | **57** | **92 (100%)** | **0** | **0** |

**Nota**: 100% de ownership atribuído neste documento. 0% implementado no cluster. A próxima etapa é implementar os artefatos conforme backlog em monitoring-gaps-register.md.
