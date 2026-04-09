# Modelo de Health Score por Painel - 11 Dimensoes

## Visao Geral

O Health Score e uma pontuacao numerica de 0 a 100 que representa a saude operacional de cada painel de dashboard no Grafana. E calculado com base em 11 dimensoes independentes, cada uma com peso configuravel. O score e agregado ao nivel de dashboard e rastreado historicamente para detectar tendencias de degradacao.

---

## As 11 Dimensoes

### Dimensao 1: Disponibilidade do Datasource (Peso: 15)

Verifica se o datasource referenciado pelo painel esta acessivel e respondendo.

| Score | Condicao                                              |
|-------|-------------------------------------------------------|
| 100   | Datasource responde em < 1s, sem erros                |
| 75    | Datasource responde em < 3s                           |
| 50    | Datasource responde em < 5s (lentidao)                |
| 25    | Datasource responde com intermitencia                 |
| 0     | Datasource inacessivel ou nao configurado             |

```promql
# Metrica base
dae_panel_dimension_score{
  dimension="datasource_availability",
  dashboard_uid="velya-patient-api",
  panel_id="1"
}

# Verificacao subjacente
dae_datasource_reachable{datasource="prometheus"} == 1
AND
dae_datasource_health_check_duration_seconds{datasource="prometheus"} < 1
```

### Dimensao 2: Sucesso da Query (Peso: 15)

Verifica se a query do painel executa sem erro no datasource.

| Score | Condicao                                              |
|-------|-------------------------------------------------------|
| 100   | Query executa com sucesso, retorna dados               |
| 75    | Query executa mas com warning (ex: too many results)   |
| 50    | Query executa mas timeout parcial                     |
| 25    | Query retorna erro intermitente                        |
| 0     | Query retorna erro consistente ou sintaxe invalida     |

```promql
# Metrica de sucesso de query por painel
dae_panel_query_success{
  dashboard_uid="velya-patient-api",
  panel_id="1",
  ref_id="A"
} == 1

# Taxa de erro de query
rate(dae_panel_query_errors_total[5m]) > 0
```

### Dimensao 3: Frescor dos Dados (Peso: 12)

Verifica se os dados retornados estao dentro da janela temporal esperada.

| Score | Condicao                                              |
|-------|-------------------------------------------------------|
| 100   | Dados mais recentes com < 5 min de idade               |
| 75    | Dados com 5-15 min de idade                            |
| 50    | Dados com 15-60 min de idade                           |
| 25    | Dados com 1-6h de idade                                |
| 0     | Dados com > 6h de idade ou sem timestamp valido        |

```promql
# Idade do dado mais recente por painel
time() - dae_panel_data_latest_timestamp{
  dashboard_uid="velya-patient-api",
  panel_id="1"
}

# Paineis com dados velhos (> 1h)
(time() - dae_panel_data_latest_timestamp) > 3600
```

### Dimensao 4: Nao-Vazio (Peso: 12)

Verifica se a query retorna dados quando deveria (nao esta vazia sem justificativa).

| Score | Condicao                                              |
|-------|-------------------------------------------------------|
| 100   | Retorna dados consistentemente                         |
| 75    | Retorna dados na maioria das verificacoes              |
| 50    | Vazio intermitente (pode ser normal para o contexto)   |
| 25    | Frequentemente vazio (possivel problema)               |
| 0     | Sempre vazio quando deveria ter dados                  |

```promql
# Painel retornou dados na ultima verificacao
dae_panel_has_data{
  dashboard_uid="velya-patient-api",
  panel_id="1"
} == 1

# Taxa de no-data nas ultimas 24h
avg_over_time(dae_panel_has_data{
  dashboard_uid="velya-patient-api",
  panel_id="1"
}[24h])
```

### Dimensao 5: Integridade de Variaveis (Peso: 8)

Verifica se todas as variaveis referenciadas na query do painel existem e resolvem para valores validos.

| Score | Condicao                                              |
|-------|-------------------------------------------------------|
| 100   | Todas as variaveis resolvem corretamente               |
| 75    | Variaveis resolvem mas com valores sub-otimos          |
| 50    | Uma variavel nao-critica nao resolve                   |
| 25    | Multiplas variaveis com problema                       |
| 0     | Variavel critica nao resolve, painel quebrado          |

```promql
# Integridade de variaveis
dae_panel_variables_valid{
  dashboard_uid="velya-patient-api",
  panel_id="1"
} == 1

# Variaveis com falha de resolucao
dae_variable_resolution_failed{
  dashboard_uid="velya-patient-api",
  variable_name="namespace"
} == 1
```

### Dimensao 6: Integridade de Transformacoes (Peso: 8)

Verifica se todas as transformacoes aplicadas ao painel funcionam e produzem resultado.

| Score | Condicao                                              |
|-------|-------------------------------------------------------|
| 100   | Todas as transformacoes produzem resultado             |
| 75    | Transformacoes funcionam mas com warnings              |
| 50    | Uma transformacao nao produz resultado                 |
| 25    | Multiplas transformacoes com problema                  |
| 0     | Transformacao critica falha, painel sem dados           |

```promql
# Integridade de transformacoes
dae_panel_transformations_valid{
  dashboard_uid="velya-patient-api",
  panel_id="1"
} == 1

# Transformacoes com erro
dae_panel_transformation_errors{
  dashboard_uid="velya-patient-api",
  panel_id="1",
  transformation_type="merge"
} > 0
```

### Dimensao 7: Integridade de Links (Peso: 5)

Verifica se todos os data links e dashboard links do painel apontam para destinos validos.

| Score | Condicao                                              |
|-------|-------------------------------------------------------|
| 100   | Todos os links resolvem para destinos validos          |
| 75    | Links funcionam mas com redirect                       |
| 50    | Um link aponta para destino inexistente                |
| 25    | Multiplos links quebrados                              |
| 0     | Todos os links quebrados ou nenhum link configurado quando deveria ter |

```promql
# Links validos
dae_panel_links_valid{
  dashboard_uid="velya-patient-api",
  panel_id="1"
}

# Links quebrados
dae_panel_links_broken{
  dashboard_uid="velya-patient-api",
  panel_id="1"
} > 0
```

### Dimensao 8: Renderizacao (Peso: 8)

Verifica se o painel renderiza visualmente sem erros.

| Score | Condicao                                              |
|-------|-------------------------------------------------------|
| 100   | Renderiza perfeitamente                                |
| 75    | Renderiza com minor warning visual                     |
| 50    | Renderiza mas com overflow ou truncamento              |
| 25    | Renderiza parcialmente                                 |
| 0     | Erro de renderizacao (plugin error, panel error)       |

```promql
# Status de renderizacao
dae_panel_render_success{
  dashboard_uid="velya-patient-api",
  panel_id="1"
} == 1

# Erros de renderizacao
dae_panel_render_errors_total{
  dashboard_uid="velya-patient-api",
  panel_id="1"
}
```

### Dimensao 9: Utilidade Semantica (Peso: 7)

Verifica se o painel segue boas praticas de UX: titulo descritivo, descricao, unidade configurada, thresholds definidos.

| Score | Condicao                                              |
|-------|-------------------------------------------------------|
| 100   | Titulo claro, descricao, unidade, thresholds           |
| 80    | Titulo e unidade OK, sem descricao                     |
| 60    | Titulo OK, sem unidade ou com unidade generica         |
| 40    | Titulo generico ("Panel Title"), configuracao parcial  |
| 20    | Titulo padrao nao editado                              |
| 0     | Sem titulo, sem unidade, sem thresholds                |

```promql
# Score de utilidade semantica
dae_panel_semantic_score{
  dashboard_uid="velya-patient-api",
  panel_id="1"
}

# Paineis com titulo padrao nao editado
dae_panel_default_title{dashboard_uid=~"velya-.*"} == 1
```

### Dimensao 10: Vinculacao de Alertas (Peso: 5)

Verifica se paineis criticos tem alertas vinculados.

| Score | Condicao                                              |
|-------|-------------------------------------------------------|
| 100   | Painel critico com alerta ativo e funcional            |
| 75    | Painel critico com alerta mas alerta em warning        |
| 50    | Painel critico com alerta mas alerta nao avalia        |
| 25    | Painel de alta prioridade sem alerta                   |
| 0     | Painel critico sem alerta vinculado                    |
| N/A   | Painel de baixa criticidade, dimensao nao aplica       |

```promql
# Paineis criticos com alerta
dae_panel_has_alert{
  dashboard_uid="velya-patient-api",
  panel_id="1",
  criticality="critical"
} == 1

# Paineis criticos sem alerta
dae_panel_has_alert{criticality="critical"} == 0
```

### Dimensao 11: Ownership (Peso: 5)

Verifica se o dashboard tem dono atribuido e se o dono e ativo.

| Score | Condicao                                              |
|-------|-------------------------------------------------------|
| 100   | Owner atribuido, ativo, revisou nos ultimos 30 dias    |
| 75    | Owner atribuido, ativo, sem revisao recente            |
| 50    | Owner atribuido mas inativo (ex: saiu da empresa)      |
| 25    | Owner atribuido mas nao reconhece responsabilidade     |
| 0     | Sem owner atribuido                                    |

```promql
# Dashboards com owner
dae_dashboard_has_owner{dashboard_uid="velya-patient-api"} == 1

# Ultima revisao pelo owner
time() - dae_dashboard_last_owner_review{dashboard_uid="velya-patient-api"}
```

---

## Algoritmo de Calculo

### Score por Painel

```python
def calculate_panel_health_score(panel, dimension_scores):
    """
    Calcula o health score de um painel com base nas 11 dimensoes.
    """
    weights = {
        'datasource_availability': 15,
        'query_success': 15,
        'data_freshness': 12,
        'not_empty': 12,
        'variable_integrity': 8,
        'transformation_integrity': 8,
        'link_integrity': 5,
        'rendering': 8,
        'semantic_usefulness': 7,
        'alert_linkage': 5,
        'ownership': 5,
    }

    total_weight = 0
    weighted_score = 0

    for dimension, weight in weights.items():
        score = dimension_scores.get(dimension)
        if score is not None:  # N/A dimensions are skipped
            weighted_score += score * weight
            total_weight += weight

    if total_weight == 0:
        return 0

    return round(weighted_score / total_weight, 1)
```

### Score por Dashboard

```python
def calculate_dashboard_health_score(dashboard, panel_scores):
    """
    Agrega os scores dos paineis para o dashboard.
    Usa media ponderada pela criticidade do painel.
    """
    panel_weights = {
        'critical': 3,
        'high': 2,
        'medium': 1,
        'low': 0.5,
    }

    total_weight = 0
    weighted_score = 0

    for panel_id, score_data in panel_scores.items():
        panel_criticality = score_data.get('panel_criticality', 'medium')
        weight = panel_weights.get(panel_criticality, 1)
        weighted_score += score_data['health_score'] * weight
        total_weight += weight

    if total_weight == 0:
        return 0

    return round(weighted_score / total_weight, 1)
```

---

## Thresholds e Classificacao

| Faixa         | Score     | Cor      | Significado                           | Acao Requerida                |
|--------------|-----------|----------|---------------------------------------|-------------------------------|
| Saudavel     | 85 - 100  | Verde    | Painel funcionando corretamente        | Nenhuma                       |
| Degradado    | 60 - 84   | Amarelo  | Painel com problemas parciais          | Investigar, corrigir em 48h   |
| Critico      | 0 - 59    | Vermelho | Painel quebrado ou sem utilidade       | Corrigir imediatamente        |

---

## Cadencia de Calculo

| Operacao                  | Frequencia | Justificativa                              |
|--------------------------|------------|---------------------------------------------|
| Calculo de score         | 5 min      | Detectar degradacao rapidamente              |
| Tendencia de score       | 1h         | Avaliar direcao da saude                     |
| Report de health         | Diario     | Resumo para owners e gestao                  |
| Recalculo completo       | 24h        | Garantir consistencia, limpar cache          |

---

## Rastreamento Historico

```promql
# Historico de health score do dashboard (ultimos 7 dias)
dae_dashboard_health_score{dashboard_uid="velya-patient-api"}[7d]

# Media movel de 24h
avg_over_time(
  dae_dashboard_health_score{dashboard_uid="velya-patient-api"}[24h]
)

# Desvio padrao (estabilidade do score)
stddev_over_time(
  dae_dashboard_health_score{dashboard_uid="velya-patient-api"}[24h]
)

# Dashboards com tendencia de degradacao
(
  avg_over_time(dae_dashboard_health_score[1h])
  -
  avg_over_time(dae_dashboard_health_score[1h] offset 24h)
) < -10

# Melhores e piores dashboards
topk(5, dae_dashboard_health_score)
bottomk(5, dae_dashboard_health_score)

# Distribuicao de scores por pasta
avg by (folder) (dae_dashboard_health_score)
```

---

## Dashboard de Health Score

```json
{
  "dashboard": {
    "uid": "velya-health-score-overview",
    "title": "Velya - Dashboard Health Score Overview",
    "tags": ["velya", "assurance", "health-score"],
    "panels": [
      {
        "title": "Health Score Global",
        "type": "stat",
        "gridPos": {"h": 4, "w": 6, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "avg(dae_dashboard_health_score{namespace=\"velya-observability\"})",
            "legendFormat": "Score Global"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "yellow", "value": 60},
                {"color": "green", "value": 85}
              ]
            }
          }
        }
      },
      {
        "title": "Dashboards Saudaveis / Degradados / Criticos",
        "type": "stat",
        "gridPos": {"h": 4, "w": 18, "x": 6, "y": 0},
        "targets": [
          {"expr": "count(dae_dashboard_health_score >= 85)", "legendFormat": "Saudaveis"},
          {"expr": "count(dae_dashboard_health_score >= 60 and dae_dashboard_health_score < 85)", "legendFormat": "Degradados"},
          {"expr": "count(dae_dashboard_health_score < 60)", "legendFormat": "Criticos"}
        ]
      },
      {
        "title": "Health Score por Dashboard",
        "type": "bargauge",
        "gridPos": {"h": 12, "w": 24, "x": 0, "y": 4},
        "targets": [
          {
            "expr": "sort_desc(dae_dashboard_health_score)",
            "legendFormat": "{{ dashboard_uid }}"
          }
        ]
      },
      {
        "title": "Piores Dimensoes (Media Global)",
        "type": "bargauge",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 16},
        "targets": [
          {
            "expr": "sort(avg by (dimension) (dae_panel_dimension_score))",
            "legendFormat": "{{ dimension }}"
          }
        ]
      },
      {
        "title": "Tendencia de Health Score (7 dias)",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 16},
        "targets": [
          {
            "expr": "avg(dae_dashboard_health_score)",
            "legendFormat": "Score Global"
          },
          {
            "expr": "avg(dae_dashboard_health_score{criticality=\"critical\"})",
            "legendFormat": "Criticos"
          }
        ]
      }
    ]
  }
}
```

---

## Configuracao de Pesos Customizaveis

```yaml
# health-score-weights.yaml
weights:
  default:
    datasource_availability: 15
    query_success: 15
    data_freshness: 12
    not_empty: 12
    variable_integrity: 8
    transformation_integrity: 8
    link_integrity: 5
    rendering: 8
    semantic_usefulness: 7
    alert_linkage: 5
    ownership: 5

  # Override para dashboards criticos (mais peso em alerta e disponibilidade)
  critical_dashboards:
    datasource_availability: 20
    query_success: 18
    data_freshness: 15
    not_empty: 12
    variable_integrity: 5
    transformation_integrity: 5
    link_integrity: 3
    rendering: 5
    semantic_usefulness: 3
    alert_linkage: 10
    ownership: 4

  # Override para dashboards de negocio (mais peso em utilidade semantica)
  business_dashboards:
    datasource_availability: 12
    query_success: 12
    data_freshness: 10
    not_empty: 10
    variable_integrity: 8
    transformation_integrity: 8
    link_integrity: 7
    rendering: 8
    semantic_usefulness: 12
    alert_linkage: 5
    ownership: 8
```

---

## Alertas de Health Score

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: dae-health-score-alerts
  namespace: velya-observability
spec:
  groups:
  - name: health-score
    interval: 60s
    rules:
    - alert: DashboardHealthScoreCritical
      expr: dae_dashboard_health_score < 60
      for: 10m
      labels:
        severity: warning
        team: "{{ $labels.owner_role }}"
      annotations:
        summary: "Dashboard {{ $labels.dashboard_uid }} com score {{ $value }}"
        description: "Health score abaixo de 60 por mais de 10 minutos."

    - alert: DashboardHealthDegrading
      expr: |
        (
          avg_over_time(dae_dashboard_health_score[1h])
          - avg_over_time(dae_dashboard_health_score[1h] offset 6h)
        ) < -15
      for: 30m
      labels:
        severity: warning
        team: "{{ $labels.owner_role }}"
      annotations:
        summary: "Dashboard {{ $labels.dashboard_uid }} degradando rapidamente"
        description: "O health score caiu mais de 15 pontos nas ultimas 6 horas."

    - alert: CriticalDashboardBelowThreshold
      expr: |
        dae_dashboard_health_score{criticality="critical"} < 85
      for: 15m
      labels:
        severity: critical
        team: platform
      annotations:
        summary: "Dashboard critico {{ $labels.dashboard_uid }} com score {{ $value }}"
        description: "Um dashboard de criticidade 'critical' esta abaixo do threshold de 85."
```
