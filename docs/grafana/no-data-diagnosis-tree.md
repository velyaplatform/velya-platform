# Arvore de Diagnostico para Paineis Sem Dados (No-Data)

## Visao Geral

Este documento descreve a arvore de diagnostico de 14 passos que o Dashboard Assurance Engine executa quando um painel apresenta a condicao "no data". Cada passo inclui metodo de verificacao, evidencia coletada, severidade, se e auto-corrigivel e acao recomendada.

A arvore e executada sequencialmente: se um passo encontra a causa raiz, os passos seguintes nao sao executados.

---

## Visao Geral da Arvore

```
PAINEL SEM DADOS
|
+--> [1] Datasource acessivel?
|    |
|    +-- NAO --> Diagnostico: datasource down
|    +-- SIM --> continua
|
+--> [2] Credenciais validas?
|    |
|    +-- NAO --> Diagnostico: credencial invalida
|    +-- SIM --> continua
|
+--> [3] Query executa sem erro?
|    |
|    +-- NAO --> Diagnostico: erro de query
|    +-- SIM --> continua
|
+--> [4] Query retorna dados ou vazio?
|    |
|    +-- ERRO --> Diagnostico: erro de execucao
|    +-- VAZIO --> continua
|
+--> [5] Time range compativel?
|    |
|    +-- NAO --> Diagnostico: time range inadequado
|    +-- SIM --> continua
|
+--> [6] Variavel filtrando demais?
|    |
|    +-- SIM --> Diagnostico: filtro de variavel
|    +-- NAO --> continua
|
+--> [7] Label/campo existe no datasource?
|    |
|    +-- NAO --> Diagnostico: label/campo inexistente
|    +-- SIM --> continua
|
+--> [8] Transformacao zerando resultado?
|    |
|    +-- SIM --> Diagnostico: transformacao eliminatoria
|    +-- NAO --> continua
|
+--> [9] Elemento dependente quebrado?
|    |
|    +-- SIM --> Diagnostico: dependencia quebrada
|    +-- NAO --> continua
|
+--> [10] Deveria ter dados neste contexto?
|    |
|    +-- NAO --> Diagnostico: no-data legitimo
|    +-- SIM --> continua
|
+--> [11] Dados estao stale?
|    |
|    +-- SIM --> Diagnostico: dados stale
|    +-- NAO --> continua
|
+--> [12] Serie ausente e legitima?
|    |
|    +-- SIM --> Diagnostico: serie ausente normal
|    +-- NAO --> continua
|
+--> [13] Problema de render vs dados?
|    |
|    +-- SIM --> Diagnostico: erro de renderizacao
|    +-- NAO --> continua
|
+--> [14] Regressao de library panel?
     |
     +-- SIM --> Diagnostico: regressao de library panel
     +-- NAO --> Diagnostico: causa nao identificada, escalar
```

---

## Passo 1: Datasource Acessivel?

**Pergunta:** O datasource referenciado pelo painel esta acessivel e respondendo?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | HTTP GET no health endpoint do datasource                        |
| Evidencia         | HTTP status code, response time, error message                   |
| Severidade        | **Critica** - afeta todos os paineis do datasource               |
| Auto-corrigivel   | Nao diretamente, mas pode acionar restart se probe falha         |
| Acao Recomendada  | Verificar pod do datasource, service, DNS, NetworkPolicy         |

```yaml
check:
  name: datasource_reachable
  method: http_health_check
  endpoints:
    prometheus: "http://prometheus.velya-observability.svc:9090/-/ready"
    loki: "http://loki.velya-observability.svc:3100/ready"
    tempo: "http://tempo.velya-observability.svc:3200/ready"
    pyroscope: "http://pyroscope.velya-observability.svc:4040/ready"
  timeout: 5s
  expected_status: 200
  evidence_collected:
    - http_status_code
    - response_time_ms
    - error_message
    - pod_status
    - pod_restart_count
```

---

## Passo 2: Credenciais Validas?

**Pergunta:** O token ou credencial configurado no datasource do Grafana e aceito?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | Executar request autenticado no datasource                       |
| Evidencia         | HTTP 401/403, mensagem de erro de autenticacao                   |
| Severidade        | **Critica** - afeta todos os paineis do datasource               |
| Auto-corrigivel   | Nao - requer rotacao de credencial                               |
| Acao Recomendada  | Verificar Secret, External Secrets, rotacao de token             |

```yaml
check:
  name: credentials_valid
  method: authenticated_request
  test_requests:
    prometheus:
      url: "/api/v1/query"
      params: {"query": "up"}
    loki:
      url: "/loki/api/v1/labels"
    tempo:
      url: "/api/search"
  failure_codes: [401, 403]
  evidence_collected:
    - http_status_code
    - error_message
    - token_expiry_date
    - last_successful_auth
```

---

## Passo 3: Query Executa Sem Erro?

**Pergunta:** A query PromQL/LogQL/TraceQL do painel e sintaticamente valida e executa?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | Executar a query exata do painel no datasource via API           |
| Evidencia         | Erro de sintaxe, mensagem de erro do datasource, query executada |
| Severidade        | **Alta** - painel completamente quebrado                         |
| Auto-corrigivel   | Parcial - erros simples (typo em metrica) podem ser corrigidos   |
| Acao Recomendada  | Verificar query no Query Inspector, corrigir sintaxe             |

```yaml
check:
  name: query_syntax_valid
  method: execute_query
  process:
    - extract_query_from_panel_json
    - resolve_variables_with_defaults
    - execute_against_datasource
    - check_response_for_errors
  common_errors:
    - "parse error"
    - "unknown metric"
    - "invalid label matcher"
    - "unexpected token"
    - "pipeline error"
  evidence_collected:
    - raw_query
    - resolved_query
    - error_type
    - error_message
    - datasource_response
```

---

## Passo 4: Query Retorna Erro ou Vazio?

**Pergunta:** A query executa com sucesso mas retorna resultado vazio ou com erro nos dados?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | Analisar response da query: data array vazio vs erro             |
| Evidencia         | Response body, result type, result count                         |
| Severidade        | **Alta** - painel funcional mas sem dados                        |
| Auto-corrigivel   | Nao diretamente                                                  |
| Acao Recomendada  | Continuar investigacao nas proximas etapas                       |

```yaml
check:
  name: query_returns_data
  method: analyze_query_response
  process:
    - execute_query
    - check_result_type  # matrix, vector, scalar, string
    - count_results
    - check_for_data_errors  # NaN, Inf, null
  outcomes:
    - result_empty: "Query executou mas retornou 0 resultados"
    - result_error: "Query retornou erro de dados (NaN, overflow)"
    - result_partial: "Query retornou menos series que esperado"
    - result_ok: "Query retornou dados normalmente"
  evidence_collected:
    - result_count
    - result_type
    - first_timestamp
    - last_timestamp
    - sample_values
```

---

## Passo 5: Time Range Compativel?

**Pergunta:** O time range do dashboard e compativel com os dados disponiveis?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | Comparar time range do dashboard com retencao do datasource      |
| Evidencia         | Time range configurado, retencao do datasource, overlap          |
| Severidade        | **Media** - facilmente corrigivel                                |
| Auto-corrigivel   | **Sim** - pode ajustar time range para range valido              |
| Acao Recomendada  | Ajustar time range ou configurar retencao adequada               |

```yaml
check:
  name: time_range_appropriate
  method: compare_time_ranges
  process:
    - get_dashboard_time_range  # from, to
    - get_datasource_retention  # prometheus: 15d, loki: 30d, etc
    - check_overlap
    - check_if_data_exists_in_range
  common_issues:
    - "Dashboard com 'Last 90 days' mas Prometheus retém apenas 15 dias"
    - "Time range absoluto apontando para periodo sem dados"
    - "Metrica recem-criada, dados só existem a partir de data X"
  auto_correction:
    enabled: true
    action: "Ajustar time range para cobrir dados disponiveis"
    safety: "low_risk"
  evidence_collected:
    - dashboard_time_from
    - dashboard_time_to
    - datasource_retention
    - earliest_data_timestamp
    - latest_data_timestamp
```

---

## Passo 6: Variavel Filtrando Demais?

**Pergunta:** Alguma variavel do dashboard esta filtrando os dados de forma que nenhum resultado retorna?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | Executar query sem variaveis e comparar com query com variaveis  |
| Evidencia         | Valores das variaveis, resultado sem filtro vs com filtro        |
| Severidade        | **Media** - afeta visualizacao, nao o dado                       |
| Auto-corrigivel   | **Parcial** - pode resetar variavel para "All"                   |
| Acao Recomendada  | Verificar valor selecionado, corrigir filtro                     |

```yaml
check:
  name: variable_filtering
  method: compare_filtered_vs_unfiltered
  process:
    - extract_variables_from_query
    - execute_query_with_all_variables_as_wildcard
    - if_returns_data:
        - identify_which_variable_is_filtering
        - check_variable_value_validity
        - check_if_value_exists_in_datasource
    - if_still_no_data:
        - variables_not_the_cause
  common_issues:
    - "Variavel $namespace com valor 'production' mas namespace e 'velya'"
    - "Variavel $pod com pod que nao existe mais"
    - "Variavel $service com valor que foi renomeado"
  auto_correction:
    enabled: true
    action: "Reset variavel para valor default ou 'All'"
    condition: "Somente se query sem filtro retorna dados"
    safety: "low_risk"
  evidence_collected:
    - variable_name
    - variable_value
    - result_without_filter
    - result_with_filter
    - valid_values_available
```

---

## Passo 7: Label/Campo Existe no Datasource?

**Pergunta:** Os labels ou campos referenciados na query existem no datasource?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | Consultar metadata do datasource para verificar existencia       |
| Evidencia         | Labels/campos requeridos vs disponiveis, metrica renomeada       |
| Severidade        | **Alta** - query fundamentalmente quebrada                       |
| Auto-corrigivel   | **Nao** - requer reescrita da query                              |
| Acao Recomendada  | Verificar se metrica foi renomeada, atualizar query              |

```yaml
check:
  name: label_field_exists
  method: metadata_lookup
  process:
    prometheus:
      - extract_metric_name_from_query
      - GET /api/v1/metadata?metric={metric_name}
      - extract_label_names_from_query
      - GET /api/v1/labels
      - compare_required_vs_available
    loki:
      - extract_stream_selectors
      - GET /loki/api/v1/labels
      - compare_required_vs_available
    tempo:
      - extract_trace_attributes
      - GET /api/search/tags
      - compare_required_vs_available
  common_issues:
    - "Metrica http_requests_total renomeada para http_server_requests_total (OTel)"
    - "Label 'instance' substituido por 'pod' apos migracao"
    - "Campo 'level' inexistente no Loki (deve ser 'detected_level')"
  evidence_collected:
    - required_labels
    - available_labels
    - missing_labels
    - similar_labels  # sugestoes fuzzy match
    - metric_exists
    - similar_metrics
```

---

## Passo 8: Transformacao Zerando Resultado?

**Pergunta:** Alguma transformacao (filter, join, reduce, etc.) esta eliminando todos os dados?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | Executar query sem transformacoes e verificar se retorna dados   |
| Evidencia         | Dados pre-transformacao vs pos-transformacao                     |
| Severidade        | **Media** - transformacao mal configurada                        |
| Auto-corrigivel   | **Parcial** - pode desabilitar transformacao problematica        |
| Acao Recomendada  | Revisar transformacoes, corrigir filtros/joins                   |

```yaml
check:
  name: transformation_zeroing
  method: step_by_step_transformation
  process:
    - execute_query_raw  # sem transformacoes
    - if_raw_has_data:
        - apply_transformations_one_by_one
        - identify_which_transformation_eliminates_data
        - report_offending_transformation
    - if_raw_no_data:
        - transformation_not_the_cause
  common_transformations_that_zero:
    - "filter_by_value com threshold incorreto"
    - "join por campo inexistente"
    - "group_by com campo que nao existe"
    - "regex rename que nao match"
    - "reduce com funcao que retorna null"
  evidence_collected:
    - raw_data_count
    - post_transform_data_count
    - offending_transformation_type
    - offending_transformation_config
    - data_at_each_step
```

---

## Passo 9: Elemento Dependente Quebrado?

**Pergunta:** O painel depende de outro elemento (outro painel, annotation, variavel) que esta quebrado?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | Mapear dependencias e verificar saude de cada uma                |
| Evidencia         | Grafo de dependencias, status de cada dependencia                |
| Severidade        | **Media-Alta** - causa raiz pode ser em outro lugar              |
| Auto-corrigivel   | **Nao** - precisa corrigir a dependencia primeiro                |
| Acao Recomendada  | Corrigir o elemento dependente quebrado                          |

```yaml
check:
  name: dependent_element_broken
  method: dependency_graph_check
  dependencies_to_check:
    - type: variable
      description: "Variavel de outro painel usada como filtro"
    - type: annotation
      description: "Annotation que alimenta dados ao painel"
    - type: library_panel
      description: "Library panel com versao incompativel"
    - type: datasource_chained
      description: "Datasource que depende de outro (ex: recording rules)"
    - type: recording_rule
      description: "Recording rule no Prometheus que alimenta a metrica"
  evidence_collected:
    - dependency_type
    - dependency_id
    - dependency_status
    - dependency_health_score
```

---

## Passo 10: Deveria Ter Dados Neste Contexto?

**Pergunta:** E esperado que este painel tenha dados agora, neste ambiente, com estas condicoes?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | Consultar metadata do painel e contexto operacional              |
| Evidencia         | Condicoes de validade do dado, contexto atual                    |
| Severidade        | **Baixa** - no-data pode ser legitimo                            |
| Auto-corrigivel   | **N/A** - nao e um problema                                      |
| Acao Recomendada  | Documentar no painel que no-data e normal neste contexto         |

```yaml
check:
  name: data_expected_in_context
  method: context_evaluation
  scenarios_where_no_data_is_normal:
    - "Servico nao deployado neste ambiente (staging vs production)"
    - "Feature flag desativada"
    - "Horario fora do expediente para metricas de negocio"
    - "Metrica de erro quando nao ha erros (bom!)"
    - "Servico recem-criado, ainda sem trafego"
    - "Metrica sazonal (ex: agendamentos so em dias uteis)"
  evaluation_criteria:
    - service_deployed: "Pod do servico existe e esta running?"
    - traffic_exists: "Ha requests chegando ao servico?"
    - error_metric: "E uma metrica de erro? Zero erros = no data normal"
    - business_hours: "E uma metrica de negocio fora do horario?"
  evidence_collected:
    - context_evaluation_result
    - reason_for_expected_no_data
    - recommendation
```

---

## Passo 11: Dados Estao Stale?

**Pergunta:** O datasource esta recebendo dados, mas a ingestao parou ou esta atrasada?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | Verificar ultimo timestamp de ingestao e comparar com agora      |
| Evidencia         | Ultimo dado ingerido, gap temporal, status de scrape/ingestao    |
| Severidade        | **Alta** - dados estao desatualizados                            |
| Auto-corrigivel   | **Nao** - problema de infraestrutura de coleta                   |
| Acao Recomendada  | Verificar scrape targets (Prometheus), ingestao (Loki/Tempo)     |

```yaml
check:
  name: data_freshness_check
  method: staleness_detection
  process:
    prometheus:
      - query: "timestamp(up{job='$service'})"
        compare_with: "time()"
        stale_threshold: "5m"
      - check_scrape_target_health
      - check_for_scrape_errors
    loki:
      - check_last_log_timestamp
      - check_ingestion_rate
      - check_for_ingestion_errors
    tempo:
      - check_last_trace_timestamp
      - check_ingestion_rate
  evidence_collected:
    - last_data_timestamp
    - staleness_duration
    - scrape_target_status
    - ingestion_errors
    - collector_health
```

---

## Passo 12: Serie Ausente e Legitima?

**Pergunta:** A serie temporal esperada simplesmente nao existe mais (ex: pod foi deletado, metrica deprecated)?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | Verificar se a serie existiu antes e quando desapareceu          |
| Evidencia         | Historico da serie, evento de desaparecimento                    |
| Severidade        | **Media** - pode ser normal (scale down) ou problema             |
| Auto-corrigivel   | **Nao** - requer avaliacao humana                                |
| Acao Recomendada  | Verificar se a ausencia e esperada, atualizar query se necessario|

```yaml
check:
  name: missing_series_legitimate
  method: series_history_check
  process:
    - query_with_wider_time_range  # ultimas 24h, 7d
    - if_series_existed_before:
        - when_did_it_disappear
        - correlate_with_events  # deploy, scale down, rename
        - is_absence_expected
    - if_series_never_existed:
        - metric_name_correct?
        - wrong_datasource?
  evidence_collected:
    - series_existed_before
    - last_seen_timestamp
    - correlated_events
    - recommendation
```

---

## Passo 13: Problema de Render vs Dados?

**Pergunta:** Os dados existem mas o painel nao consegue renderiza-los (problema de visualizacao, nao de dados)?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | Comparar dados do Query Inspector com o que o painel mostra      |
| Evidencia         | Dados no inspector vs visualizacao, tipo de painel vs tipo de dado|
| Severidade        | **Media** - dados estao la, apenas nao aparecem                  |
| Auto-corrigivel   | **Parcial** - pode corrigir tipo de visualizacao                 |
| Acao Recomendada  | Verificar tipo de painel, field config, overrides                |

```yaml
check:
  name: render_vs_data
  method: rendering_diagnostic
  common_issues:
    - "Tipo de painel incompativel com formato dos dados"
    - "Field config esperando campo que nao existe"
    - "Override com regex que nao match"
    - "Tipo de dado string sendo plotado em time series"
    - "Threshold config causando visualizacao vazia"
    - "Min/max configurado excluindo todos os valores"
    - "Unit conversion fazendo valores parecerem zero"
  verification:
    - check_query_inspector_data
    - compare_with_panel_display
    - check_field_config_compatibility
    - check_override_regex_match
    - check_value_mapping
  evidence_collected:
    - data_exists_in_inspector
    - panel_type
    - data_type
    - field_config
    - override_config
    - incompatibility_detected
```

---

## Passo 14: Regressao de Library Panel?

**Pergunta:** O painel e um library panel que foi atualizado recentemente e a atualizacao causou regressao?

| Aspecto           | Detalhe                                                          |
|-------------------|------------------------------------------------------------------|
| Metodo de Check   | Verificar versao do library panel e correlacionar com inicio do no-data |
| Evidencia         | Versao anterior vs atual, diff, timestamp da atualizacao         |
| Severidade        | **Alta** - afeta todos os dashboards que usam o library panel    |
| Auto-corrigivel   | **Sim** - pode reverter para versao anterior do library panel    |
| Acao Recomendada  | Reverter library panel, investigar mudanca, corrigir, re-publicar|

```yaml
check:
  name: library_panel_regression
  method: library_panel_version_check
  process:
    - is_panel_library_panel
    - get_current_library_panel_version
    - get_previous_library_panel_version
    - was_library_panel_updated_recently  # ultimas 24h
    - if_updated:
        - get_version_diff
        - correlate_update_timestamp_with_no_data_start
        - test_previous_version_with_current_datasource
    - if_previous_version_works:
        - diagnosis: "library_panel_regression"
        - auto_correction: "revert_to_previous_version"
  auto_correction:
    enabled: true
    action: "Reverter library panel para versao anterior"
    safety: "medium_risk"
    requires_revalidation: true
    audit_trail: true
  evidence_collected:
    - is_library_panel
    - current_version
    - previous_version
    - update_timestamp
    - version_diff
    - regression_confirmed
    - affected_dashboards_count
```

---

## Tabela Resumo dos 14 Passos

| # | Passo                        | Severidade | Auto-corrigivel | Causa Mais Comum                     |
|---|------------------------------|-----------|-----------------|---------------------------------------|
| 1 | Datasource acessivel?        | Critica   | Nao             | Pod crashlooping, DNS, NetworkPolicy  |
| 2 | Credenciais validas?         | Critica   | Nao             | Token expirado, rotacao de secrets    |
| 3 | Query executa sem erro?      | Alta      | Parcial         | Sintaxe invalida, metrica renomeada   |
| 4 | Query retorna dados?         | Alta      | Nao             | Filtro excludente, range vazio        |
| 5 | Time range compativel?       | Media     | Sim             | Range > retencao, range absoluto velho|
| 6 | Variavel filtrando?          | Media     | Sim             | Valor de variavel invalido            |
| 7 | Label/campo existe?          | Alta      | Nao             | Metrica renomeada, label removido     |
| 8 | Transformacao zerando?       | Media     | Parcial         | Filter/join mal configurado           |
| 9 | Dependencia quebrada?        | Media-Alta| Nao             | Recording rule, variavel, lib panel   |
| 10| Deveria ter dados?           | Baixa     | N/A             | Contexto normal de no-data            |
| 11| Dados stale?                 | Alta      | Nao             | Scrape falhando, collector down       |
| 12| Serie ausente e legitima?    | Media     | Nao             | Scale down, pod deletado              |
| 13| Render vs dados?             | Media     | Parcial         | Tipo de painel incompativel           |
| 14| Regressao de library panel?  | Alta      | Sim             | Update de library panel com bug       |

---

## Metricas de Diagnostico

```promql
# Distribuicao de causas de no-data
sum by (diagnosis_step) (
  increase(dae_no_data_diagnosis_result_total[24h])
)

# Passos mais frequentes como causa raiz
topk(5,
  sum by (diagnosis_step) (
    increase(dae_no_data_diagnosis_result_total[7d])
  )
)

# Tempo medio de diagnostico
histogram_quantile(0.95,
  rate(dae_no_data_diagnosis_duration_seconds_bucket[1h])
)

# Taxa de diagnosticos que encontram causa raiz
sum(dae_no_data_diagnosis_result_total{diagnosis_step!="unidentified"})
/ sum(dae_no_data_diagnosis_result_total)

# Diagnosticos que nao encontraram causa (precisam escalacao)
increase(dae_no_data_diagnosis_result_total{diagnosis_step="unidentified"}[24h])
```
