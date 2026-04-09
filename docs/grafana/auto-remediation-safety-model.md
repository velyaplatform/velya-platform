# Modelo de Remediacao Automatica Segura

## Visao Geral

Este documento define o modelo de remediacao automatica do Dashboard Assurance Engine (DAE), estabelecendo claramente o que PODE ser corrigido automaticamente (Safe Actions) e o que REQUER aprovacao humana (Gated Actions). Toda remediacao gera trilha de auditoria, diff, evidencia, e e revalidada e reversivel.

---

## Principios de Seguranca

1. **Nenhuma remediacao deve piorar a situacao** - toda acao e revalidada apos execucao
2. **Toda remediacao e reversivel** - mantemos backup e instrucoes de rollback
3. **Acoes safe tem risco calculado** - classificacao formal de risco
4. **Acoes gated requerem aprovacao explicita** - notificacao ao owner com evidencia
5. **Audit trail completo** - toda acao gera registro imutavel
6. **Limite de remediacoes por periodo** - circuit breaker para evitar cascata

---

## Acoes Automaticas (Safe Actions)

### SA-01: Atualizar Metadata de Ownership

| Atributo    | Valor                                                         |
| ----------- | ------------------------------------------------------------- |
| Descricao   | Preencher campo de owner quando owner e conhecido no registry |
| Condicao    | Dashboard sem owner atribuido, owner existe no registry       |
| Risco       | **Baixo**                                                     |
| Impacto     | Apenas metadata, nao afeta visualizacao ou dados              |
| Revalidacao | Verificar que owner foi atribuido corretamente                |
| Rollback    | Remover owner atribuido                                       |

```yaml
remediation:
  id: SA-01
  name: update_ownership_metadata
  trigger:
    condition: 'dashboard.owner == null AND ownership_registry.has(dashboard.uid)'
  action:
    type: grafana_api
    endpoint: 'PATCH /api/dashboards/uid/{uid}'
    payload:
      dashboard:
        tags_add: ['owner:{owner_role}']
      message: 'DAE: Owner atribuido automaticamente do registry'
  safety:
    risk_level: low
    reversible: true
    requires_approval: false
    max_per_hour: 50
```

### SA-02: Corrigir Link Quebrado com Contexto Conhecido

| Atributo    | Valor                                                              |
| ----------- | ------------------------------------------------------------------ |
| Descricao   | Atualizar URL de link quando destino mudou mas e conhecido         |
| Condicao    | Link aponta para dashboard/URL que mudou, novo destino e conhecido |
| Risco       | **Baixo**                                                          |
| Impacto     | Corrige navegacao, nao afeta dados                                 |
| Revalidacao | HTTP GET no novo link retorna 200                                  |
| Rollback    | Restaurar URL anterior                                             |

```yaml
remediation:
  id: SA-02
  name: fix_broken_link
  trigger:
    condition: 'panel.link.target_status == 404 AND link_redirect_map.has(panel.link.url)'
  action:
    type: grafana_api
    endpoint: 'PUT /api/dashboards/uid/{uid}'
    payload:
      update_panel_links:
        old_url: '{broken_url}'
        new_url: '{redirect_map[broken_url]}'
      message: 'DAE: Link corrigido automaticamente via redirect map'
  safety:
    risk_level: low
    reversible: true
    requires_approval: false
    max_per_hour: 20
```

### SA-03: Ajustar Default de Variavel Quebrado

| Atributo    | Valor                                                         |
| ----------- | ------------------------------------------------------------- |
| Descricao   | Corrigir valor default de variavel quando atual e invalido    |
| Condicao    | Variavel com default que nao resolve, valor correto conhecido |
| Risco       | **Baixo**                                                     |
| Impacto     | Melhora experiencia inicial, nao altera dados persistentes    |
| Revalidacao | Variavel resolve com novo default                             |
| Rollback    | Restaurar default anterior                                    |

```yaml
remediation:
  id: SA-03
  name: fix_variable_default
  trigger:
    condition: >
      variable.default_value NOT IN variable.available_values
      AND variable.available_values.length > 0
  action:
    type: grafana_api
    endpoint: 'PUT /api/dashboards/uid/{uid}'
    payload:
      update_variable_default:
        variable_name: '{variable.name}'
        new_default: '{variable.available_values[0]}'
      message: 'DAE: Default de variavel ajustado para valor valido'
  safety:
    risk_level: low
    reversible: true
    requires_approval: false
    max_per_hour: 10
```

### SA-04: Restaurar Versao Anterior em Regressao Clara

| Atributo    | Valor                                                                |
| ----------- | -------------------------------------------------------------------- |
| Descricao   | Reverter dashboard para versao anterior quando regressao e detectada |
| Condicao    | Health score caiu > 20 pontos apos mudanca, versao anterior saudavel |
| Risco       | **Medio**                                                            |
| Impacto     | Reverte todas as mudancas da ultima versao                           |
| Revalidacao | Health score volta ao nivel anterior                                 |
| Rollback    | Restaurar para a versao revertida                                    |

```yaml
remediation:
  id: SA-04
  name: restore_previous_version
  trigger:
    condition: >
      dashboard.health_score < (dashboard.health_score_previous_version - 20)
      AND dashboard.previous_version.health_score >= 85
      AND dashboard.version_age < 24h
  action:
    type: grafana_api
    endpoint: 'POST /api/dashboards/uid/{uid}/restore'
    payload:
      version: '{dashboard.previous_version.number}'
      message: 'DAE: Revertido para versao anterior devido a regressao de health score'
  safety:
    risk_level: medium
    reversible: true
    requires_approval: false
    max_per_hour: 3
    cooldown_after_action: 30m
  validation:
    post_action_wait: 60s
    check: 'health_score >= previous_version.health_score - 5'
    on_validation_failure: 'revert_remediation'
```

### SA-05: Reverter Library Panel Problematico

| Atributo    | Valor                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| Descricao   | Reverter library panel para versao anterior quando causou regressao     |
| Condicao    | Library panel atualizado recentemente e multiplos dashboards degradaram |
| Risco       | **Medio**                                                               |
| Impacto     | Afeta todos os dashboards que usam o library panel                      |
| Revalidacao | Todos os dashboards consumidores voltam a score saudavel                |
| Rollback    | Re-aplicar versao mais recente do library panel                         |

```yaml
remediation:
  id: SA-05
  name: revert_library_panel
  trigger:
    condition: >
      library_panel.updated_within < 24h
      AND count(affected_dashboards.health_score_dropped > 15) >= 2
      AND library_panel.previous_version.health_score >= 85
  action:
    type: grafana_api
    endpoint: 'PATCH /api/library-elements/{uid}'
    payload:
      model: '{library_panel.previous_version.model}'
      version: '{library_panel.previous_version.number}'
      message: 'DAE: Library panel revertido - regressao detectada em multiplos dashboards'
  safety:
    risk_level: medium
    reversible: true
    requires_approval: false
    max_per_hour: 2
    cooldown_after_action: 1h
  validation:
    post_action_wait: 120s
    check: 'all(affected_dashboards.health_score >= 80)'
    on_validation_failure: 'revert_remediation AND escalate'
```

### SA-06: Corrigir Time Range Inadequado

| Atributo    | Valor                                                             |
| ----------- | ----------------------------------------------------------------- |
| Descricao   | Ajustar time range quando esta fora da retencao do datasource     |
| Condicao    | Time range > retencao do datasource, dados existem em range menor |
| Risco       | **Baixo**                                                         |
| Impacto     | Altera visualizacao padrao, nao perde dados                       |
| Revalidacao | Painel mostra dados com novo time range                           |
| Rollback    | Restaurar time range anterior                                     |

```yaml
remediation:
  id: SA-06
  name: fix_time_range
  trigger:
    condition: >
      dashboard.time_range > datasource.retention
      AND query_with_adjusted_range.returns_data == true
  action:
    type: grafana_api
    endpoint: 'PUT /api/dashboards/uid/{uid}'
    payload:
      time:
        from: 'now-{datasource.retention}'
        to: 'now'
      message: 'DAE: Time range ajustado para cobrir dados disponiveis'
  safety:
    risk_level: low
    reversible: true
    requires_approval: false
    max_per_hour: 10
```

### SA-07: Remover Painel Orfao

| Atributo    | Valor                                                          |
| ----------- | -------------------------------------------------------------- |
| Descricao   | Remover painel sem query, sem titulo, sem uso                  |
| Condicao    | Painel vazio (sem query configurada, titulo padrao, sem dados) |
| Risco       | **Baixo**                                                      |
| Impacto     | Remove ruido visual do dashboard                               |
| Revalidacao | Dashboard layout esta coerente apos remocao                    |
| Rollback    | Restaurar painel da versao anterior                            |

```yaml
remediation:
  id: SA-07
  name: remove_orphan_panel
  trigger:
    condition: >
      panel.queries.length == 0
      AND panel.title IN ["Panel Title", "New Panel", ""]
      AND panel.type != "text"
      AND panel.type != "row"
  action:
    type: grafana_api
    endpoint: 'PUT /api/dashboards/uid/{uid}'
    payload:
      remove_panel: '{panel.id}'
      message: 'DAE: Painel orfao removido (sem query, sem titulo)'
  safety:
    risk_level: low
    reversible: true
    requires_approval: false
    max_per_hour: 5
```

### SA-08: Sincronizar do Git

| Atributo    | Valor                                                         |
| ----------- | ------------------------------------------------------------- |
| Descricao   | Restaurar dashboard do Git quando divergiu do source of truth |
| Condicao    | Dashboard no Grafana difere do Git, Git e o source of truth   |
| Risco       | **Medio**                                                     |
| Impacto     | Sobrescreve mudancas feitas pela UI                           |
| Revalidacao | Dashboard no Grafana identico ao Git                          |
| Rollback    | Restaurar versao anterior do Grafana                          |

```yaml
remediation:
  id: SA-08
  name: sync_from_git
  trigger:
    condition: >
      dashboard.git_source.in_sync == false
      AND dashboard.git_source.repo != null
      AND dashboard.modified_via_ui == true
      AND dashboard.git_version.health_score >= 80
  action:
    type: grafana_provisioning
    source: git
    repo: '{dashboard.git_source.repo}'
    path: '{dashboard.git_source.path}'
    message: 'DAE: Dashboard sincronizado do Git (source of truth)'
  safety:
    risk_level: medium
    reversible: true
    requires_approval: false
    max_per_hour: 5
    cooldown_after_action: 15m
  validation:
    post_action_wait: 30s
    check: 'dashboard.health_score >= git_version.health_score - 5'
```

---

## Acoes com Aprovacao (Gated Actions)

### GA-01: Reescrever Query Critica

| Atributo          | Valor                                                          |
| ----------------- | -------------------------------------------------------------- |
| Descricao         | Alterar query PromQL/LogQL de painel critico                   |
| Razao do Gate     | Pode alterar semantica do monitoramento                        |
| Quem Aprova       | Owner do dashboard + SRE                                       |
| SLA de Aprovacao  | 4 horas em horario comercial                                   |
| Evidencia Exigida | Query atual, query proposta, diff de resultados, justificativa |

```yaml
remediation:
  id: GA-01
  name: rewrite_critical_query
  gate:
    requires_approval: true
    approvers:
      - dashboard_owner
      - sre_oncall
    approval_sla: 4h
    notification_channels:
      - slack: '#velya-observability-approvals'
      - email: '{dashboard.owner.contact}'
    evidence_required:
      - current_query
      - proposed_query
      - result_diff_sample
      - justification
      - impact_analysis
```

### GA-02: Alterar Semantica de Dashboard de Producao

| Atributo         | Valor                                                               |
| ---------------- | ------------------------------------------------------------------- |
| Descricao        | Modificar estrutura, layout ou significado de dashboard em producao |
| Razao do Gate    | Impacto em decisoes operacionais e de negocio                       |
| Quem Aprova      | Owner do dashboard + Tech Lead                                      |
| SLA de Aprovacao | 8 horas em horario comercial                                        |

```yaml
remediation:
  id: GA-02
  name: modify_production_dashboard_semantics
  gate:
    requires_approval: true
    approvers:
      - dashboard_owner
      - tech_lead
    approval_sla: 8h
    changes_requiring_gate:
      - add_panel_to_critical_dashboard
      - remove_panel_from_critical_dashboard
      - change_panel_type_on_critical
      - modify_row_structure
      - change_dashboard_purpose
```

### GA-03: Modificar Thresholds Criticos

| Atributo         | Valor                                                            |
| ---------------- | ---------------------------------------------------------------- |
| Descricao        | Alterar thresholds de alerta ou visualizacao em paineis criticos |
| Razao do Gate    | Pode gerar falsos positivos/negativos em alertas                 |
| Quem Aprova      | Owner + SRE Lead                                                 |
| SLA de Aprovacao | 2 horas                                                          |

```yaml
remediation:
  id: GA-03
  name: modify_critical_thresholds
  gate:
    requires_approval: true
    approvers:
      - dashboard_owner
      - sre_lead
    approval_sla: 2h
    evidence_required:
      - current_thresholds
      - proposed_thresholds
      - historical_data_analysis
      - false_positive_negative_impact
```

### GA-04: Remover Painel Critico

| Atributo         | Valor                                             |
| ---------------- | ------------------------------------------------- |
| Descricao        | Remover painel de criticidade alta ou critica     |
| Razao do Gate    | Pode eliminar visibilidade operacional importante |
| Quem Aprova      | Owner + SRE + Tech Lead                           |
| SLA de Aprovacao | 24 horas                                          |

```yaml
remediation:
  id: GA-04
  name: remove_critical_panel
  gate:
    requires_approval: true
    approvers:
      - dashboard_owner
      - sre_lead
      - tech_lead
    approval_sla: 24h
    evidence_required:
      - panel_usage_stats
      - alternative_visibility
      - impact_analysis
      - justification
```

### GA-05: Ajustar Alertas de Alta Severidade

| Atributo         | Valor                                                      |
| ---------------- | ---------------------------------------------------------- |
| Descricao        | Modificar regras de alerta com severidade critical/warning |
| Razao do Gate    | Impacto direto na resposta a incidentes                    |
| Quem Aprova      | SRE Lead + Oncall atual                                    |
| SLA de Aprovacao | 1 hora para critical, 4 horas para warning                 |

```yaml
remediation:
  id: GA-05
  name: adjust_high_severity_alerts
  gate:
    requires_approval: true
    approvers:
      - sre_lead
      - current_oncall
    approval_sla:
      critical: 1h
      warning: 4h
    evidence_required:
      - current_alert_rule
      - proposed_change
      - recent_alert_history
      - false_positive_rate
      - impact_on_incident_response
```

---

## Circuit Breaker

O DAE implementa um circuit breaker para evitar cascata de remediacoes.

```yaml
circuit_breaker:
  global:
    max_remediation_per_hour: 20
    max_remediation_per_day: 100
    cooldown_after_global_limit: 2h

  per_dashboard:
    max_remediation_per_hour: 3
    max_remediation_per_day: 10
    cooldown_after_limit: 1h

  per_type:
    restore_version:
      max_per_hour: 3
      max_per_day: 10
    revert_library_panel:
      max_per_hour: 2
      max_per_day: 5
    sync_from_git:
      max_per_hour: 5
      max_per_day: 20

  escalation_on_breach:
    notify: ['#velya-observability-alerts', 'sre-oncall']
    message: 'Circuit breaker ativado - limite de remediacoes atingido'
```

---

## Formato do Audit Trail

```json
{
  "audit_entry": {
    "id": "dae-remediation-2026-04-08-042",
    "timestamp": "2026-04-08T15:45:00Z",
    "remediation_id": "SA-04",
    "remediation_name": "restore_previous_version",
    "actor": "dae-engine",
    "target": {
      "type": "dashboard",
      "uid": "velya-billing-service",
      "title": "Billing Service",
      "folder": "Backend"
    },
    "trigger": {
      "diagnosis_id": "diag-2026-04-08-103",
      "diagnosis_step": "library_panel_regression",
      "health_score_before": 38,
      "health_score_threshold": 60,
      "failing_dimensions": ["query_success", "not_empty", "rendering"]
    },
    "action": {
      "type": "restore_version",
      "from_version": 23,
      "to_version": 22,
      "diff": {
        "panels_changed": 3,
        "variables_changed": 0,
        "library_panels_changed": 1,
        "summary": "Revertido library panel velya-golden-signals de v2.1 para v2.0"
      }
    },
    "validation": {
      "status": "success",
      "health_score_after": 89,
      "dimensions_after": {
        "datasource_availability": 100,
        "query_success": 100,
        "data_freshness": 100,
        "not_empty": 100,
        "variable_integrity": 100,
        "transformation_integrity": 100,
        "link_integrity": 80,
        "rendering": 100,
        "semantic_usefulness": 75,
        "alert_linkage": 50,
        "ownership": 100
      },
      "revalidation_time": "2026-04-08T15:46:05Z"
    },
    "rollback": {
      "available": true,
      "instruction": "POST /api/dashboards/uid/velya-billing-service/restore {version: 23}",
      "expires": "2026-04-15T15:45:00Z"
    },
    "circuit_breaker": {
      "remediations_this_hour": 5,
      "remediations_today": 12,
      "limit_reached": false
    }
  }
}
```

---

## Metricas de Remediacao

```promql
# Total de remediacoes por tipo
sum by (remediation_id, remediation_name) (
  increase(dae_remediation_total[24h])
)

# Taxa de sucesso de remediacao
sum(dae_remediation_success_total) /
sum(dae_remediation_total) * 100

# Remediacoes revertidas (indica diagnostico incorreto)
increase(dae_remediation_reverted_total[7d])

# Tempo entre diagnostico e remediacao
histogram_quantile(0.95,
  rate(dae_remediation_latency_seconds_bucket[1h])
)

# Aprovacoes pendentes (gated)
dae_gated_remediation_pending_total

# Aprovacoes que expiraram SLA
increase(dae_gated_remediation_sla_expired_total[24h])

# Circuit breaker ativacoes
increase(dae_circuit_breaker_activated_total[24h])
```

---

## Fluxo de Remediacao Completo

```
DIAGNOSTICO COMPLETO
|
+--> Causa raiz identificada
|
+--> Existe remediacao para esta causa?
|    |
|    +-- NAO: Notificar owner com evidencia, sugestoes manuais
|    +-- SIM: Continua
|
+--> E uma Safe Action?
|    |
|    +-- SIM: Circuit breaker permite?
|    |    |
|    |    +-- NAO: Enfileirar, notificar
|    |    +-- SIM: Executar remediacao
|    |         |
|    |         +--> Aguardar periodo de validacao
|    |         |
|    |         +--> Revalidar health score
|    |         |    |
|    |         |    +-- MELHOROU: Registrar sucesso no audit trail
|    |         |    +-- NAO MELHOROU: Reverter remediacao, escalar
|    |         |    +-- PIOROU: Reverter imediatamente, alerta critico
|    |
|    +-- NAO (Gated Action):
|         |
|         +--> Notificar aprovadores com evidencia
|         +--> Aguardar aprovacao (dentro do SLA)
|         |    |
|         |    +-- APROVADO: Executar com validacao
|         |    +-- REJEITADO: Registrar, sugerir alternativa
|         |    +-- EXPIROU: Escalar, notificar gestao
```

---

## Configuracao do DAE para Remediacao

```yaml
# dae-remediation-config.yaml
remediation:
  enabled: true
  mode: 'safe_auto_gated_manual' # safe actions auto, gated requerem aprovacao

  safe_actions:
    enabled: true
    actions:
      - SA-01 # update_ownership_metadata
      - SA-02 # fix_broken_link
      - SA-03 # fix_variable_default
      - SA-04 # restore_previous_version
      - SA-05 # revert_library_panel
      - SA-06 # fix_time_range
      - SA-07 # remove_orphan_panel
      - SA-08 # sync_from_git

  gated_actions:
    enabled: true
    actions:
      - GA-01 # rewrite_critical_query
      - GA-02 # modify_production_dashboard_semantics
      - GA-03 # modify_critical_thresholds
      - GA-04 # remove_critical_panel
      - GA-05 # adjust_high_severity_alerts

  validation:
    post_action_wait: 60s
    revalidation_timeout: 300s
    auto_revert_on_degradation: true

  audit:
    store: 's3://velya-observability-audit/dae-remediation/'
    retention: '365d'
    push_to_loki: true
    loki_labels:
      source: 'dae-remediation'
      namespace: 'velya-observability'

  notifications:
    slack:
      safe_actions: '#velya-observability-auto'
      gated_actions: '#velya-observability-approvals'
      failures: '#velya-observability-alerts'
    pagerduty:
      on_circuit_breaker: true
      on_revert_failure: true
```
