# Playbook do Query Inspector do Grafana

## Visao Geral

O Query Inspector e a ferramenta de debug mais importante do Grafana para diagnosticar problemas em paineis. Ele permite ver exatamente o que o Grafana envia ao datasource, o que recebe de volta, e como processa os dados. Este playbook fornece procedimentos passo-a-passo para diagnosticar os problemas mais comuns.

---

## Como Abrir o Query Inspector

### Passo 1: Acessar o Painel

1. Abrir o dashboard no Grafana
2. Passar o mouse sobre o painel com problema
3. Clicar no titulo do painel para abrir o menu
4. Selecionar **"Inspect"** > **"Query"**

**Alternativa via atalho:** Clicar no painel, pressionar `i` (inspect)

### Passo 2: Navegar pelas Abas

O Query Inspector tem 4 abas principais:

| Aba      | Conteudo                                      | Uso Principal                    |
|----------|-----------------------------------------------|----------------------------------|
| Query    | Request HTTP enviado ao datasource            | Ver query exata, headers, params |
| Data     | Dados retornados pelo datasource              | Ver formato, campos, valores     |
| Stats    | Estatisticas de execucao                       | Ver tempo, bytes, cache          |
| JSON     | Modelo JSON completo do request/response      | Debug avancado                   |

---

## Procedimento 1: Diagnosticar Painel Sem Dados

### Cenario
Painel mostra "No data" mas voce espera que tenha dados.

### Passos

**1. Verificar a Query Enviada (Aba Query)**

```
Abrir Inspector > Aba Query

Observar:
- A query PromQL/LogQL/TraceQL esta correta?
- As variaveis ($namespace, $service, etc.) foram resolvidas?
- O time range esta correto (from/to)?

O que procurar:
- Variavel nao resolvida: "$namespace" aparece literal em vez do valor
- Query com metrica inexistente: metrica_que_nao_existe{}
- Time range: "start" e "end" fazem sentido?
```

**Exemplo de request Prometheus no Inspector:**
```json
{
  "url": "/api/datasources/proxy/1/api/v1/query_range",
  "method": "POST",
  "data": {
    "query": "sum(rate(http_requests_total{namespace=\"velya\", job=\"patient-api\"}[5m]))",
    "start": 1712534400,
    "end": 1712620800,
    "step": 60
  }
}
```

**2. Verificar a Resposta (Aba Data)**

```
Abrir Inspector > Aba Data

Verificar:
- "resultType": "matrix" (series temporais), "vector" (instantaneo)
- "result": array vazio [] = sem dados
- Se ha dados mas painel nao mostra: problema de renderizacao

Se resultado vazio:
- A metrica existe? Ir ao Explore e testar: {__name__=~"http_.*"}
- Os labels estao corretos? Ir ao Explore: http_requests_total{}
- O time range tem dados? Expandir para "Last 7 days"
```

**Exemplo de resposta vazia:**
```json
{
  "status": "success",
  "data": {
    "resultType": "matrix",
    "result": []
  }
}
```

**Exemplo de resposta com dados:**
```json
{
  "status": "success",
  "data": {
    "resultType": "matrix",
    "result": [
      {
        "metric": {"job": "patient-api", "namespace": "velya"},
        "values": [
          [1712534460, "42.5"],
          [1712534520, "43.1"],
          [1712534580, "41.8"]
        ]
      }
    ]
  }
}
```

**3. Verificar Timing (Aba Stats)**

```
Abrir Inspector > Aba Stats

Verificar:
- "Total request time": quanto tempo a query levou
- Se > 10s: query pode estar em timeout
- "Bytes received": se 0 bytes, datasource nao retornou nada
```

**4. Comparar com Query Direta**

```
Abrir Explore > Selecionar datasource (Prometheus)

Colar a query exata do Inspector:
  sum(rate(http_requests_total{namespace="velya", job="patient-api"}[5m]))

Se retorna dados no Explore mas nao no painel:
- Problema e de renderizacao (ver Procedimento 4)
- Verificar transformacoes no painel
- Verificar field config e overrides
```

---

## Procedimento 2: Diagnosticar Erro de Query

### Cenario
Painel mostra mensagem de erro vermelha.

### Passos

**1. Ler a Mensagem de Erro (Aba Query)**

```
Erros comuns e correcoes:

| Erro                                    | Causa                        | Correcao                              |
|-----------------------------------------|------------------------------|---------------------------------------|
| "parse error: unexpected end of input"  | Query incompleta             | Verificar parenteses, colchetes       |
| "unknown metric"                        | Metrica nao existe           | Verificar nome no Explore             |
| "bad_data: invalid parameter 'query'"   | Sintaxe PromQL invalida      | Revisar sintaxe PromQL                |
| "execution: found duplicate series"     | Query retorna series duplicadas | Adicionar label no group by          |
| "query must contain metric name"        | Falta metrica no seletor     | Adicionar nome da metrica             |
| "1:1: parse error: unexpected $"        | Variavel nao resolvida       | Verificar variavel no templating      |
```

**2. Verificar Response Completo (Aba JSON)**

```
Abrir Inspector > Aba JSON

Procurar campos:
- "error": mensagem de erro completa
- "errorType": tipo do erro
- "warnings": avisos que podem indicar problema

Copiar o JSON completo para analise se necessario.
```

**3. Isolar o Problema**

```
Simplificar a query passo a passo:

Query original (com erro):
  sum(rate(http_requests_total{namespace="$namespace", job="$service", code=~"5.."}[5m])) by (code)

Passo 1 - Metrica basica:
  http_requests_total

Passo 2 - Adicionar labels:
  http_requests_total{namespace="velya"}

Passo 3 - Adicionar funcao:
  rate(http_requests_total{namespace="velya"}[5m])

Passo 4 - Adicionar agregacao:
  sum(rate(http_requests_total{namespace="velya"}[5m])) by (code)

Identificar em qual passo o erro aparece.
```

---

## Procedimento 3: Diagnosticar Query Lenta

### Cenario
Painel carrega muito devagar (> 5 segundos).

### Passos

**1. Verificar Tempo de Execucao (Aba Stats)**

```
Abrir Inspector > Aba Stats

Observar:
- "Total request time": tempo total
- Se > 5s: query precisa otimizacao

Causas comuns de lentidao:
- Query com alta cardinalidade (muitas series)
- range vector muito grande ([24h] vs [5m])
- Falta de recording rules para queries complexas
- Regex complexo em label matchers
```

**2. Verificar Cardinalidade**

```
No Explore, executar:
  count(http_requests_total{namespace="velya"})

Se retorna > 10000 series: alta cardinalidade
Solucoes:
- Adicionar labels mais especificos
- Usar recording rules
- Limitar com topk() ou bottomk()
```

**3. Otimizacoes Comuns**

```
# ANTES (lento): rate sobre todo o historico
sum(rate(http_requests_total[1h]))

# DEPOIS (rapido): usar $__rate_interval
sum(rate(http_requests_total[$__rate_interval]))

# ANTES (lento): regex complexo
http_requests_total{handler=~".*api.*patient.*"}

# DEPOIS (rapido): label exato
http_requests_total{handler="/api/v1/patients"}

# ANTES (lento): query ad-hoc em painel
sum by (service, method, code) (rate(http_requests_total[5m]))

# DEPOIS (rapido): usar recording rule
velya:http_requests:rate5m
```

**4. Verificar Cache**

```
Aba Stats:
- Se "Cache status: HIT": dados vieram do cache (rapido)
- Se "Cache status: MISS": dados vieram do datasource (pode ser lento)

Grafana settings para cache:
  GF_CACHING_ENABLED=true
  GF_CACHING_MAX_AGE=60
```

---

## Procedimento 4: Diagnosticar Dados Presentes mas Nao Visiiveis

### Cenario
Inspector mostra dados na aba Data, mas painel esta vazio ou com visualizacao incorreta.

### Passos

**1. Verificar Formato dos Dados (Aba Data)**

```
Observar:
- Quantos frames de dados existem?
- Tipo dos campos: time (datetime), number (valor), string (label)
- Os valores sao numeros ou strings?
- Ha valores null/NaN?
```

**2. Verificar Tipo de Painel vs Dados**

```
Incompatibilidades comuns:

| Tipo de Painel | Formato Esperado           | Problema Comum                     |
|---------------|---------------------------|-------------------------------------|
| Time Series   | Time + Number              | Dados sem campo time                |
| Stat          | Single number              | Multiplas series retornadas         |
| Gauge         | Single number (0-max)      | Valor fora do range min/max         |
| Table         | Tabular (colunas)          | Formato matrix em vez de table      |
| Bar Gauge     | Category + Number          | Sem label para categorias           |
| Logs          | Log lines com timestamp    | Formato de metrica em vez de log    |
```

**3. Verificar Transformacoes**

```
Se o painel tem transformacoes:

1. Abrir painel em modo Edit
2. Ir para aba Transform
3. Para cada transformacao:
   a. Verificar se campos referenciados existem nos dados
   b. Desabilitar temporariamente para ver efeito
   c. Verificar se join/merge produz resultado

Transformacoes que frequentemente causam dados invisiveis:
- "Filter by value" com threshold incorreto
- "Join by field" com campo inexistente
- "Organize fields" escondendo campo de valor
- "Convert field type" com tipo incompativel
```

**4. Verificar Field Config**

```
Em Edit > Field config:

- Min/Max: valores reais estao dentro do range?
  Se min=0, max=100 mas valor e 500: painel parece vazio
- Unit: conversao de unidade pode fazer valor parecer 0
  Ex: valor em bytes, unit em GB = valor aparece como 0.00
- Decimals: muitos decimals truncados pode mostrar "0"
- Thresholds: threshold base pode esconder valores
```

---

## Procedimento 5: Diagnosticar Variavel que Nao Resolve

### Cenario
Variavel mostra "No data" ou valor incorreto, afetando paineis.

### Passos

**1. Verificar Query da Variavel**

```
Dashboard Settings > Variables > Selecionar variavel

Verificar:
- Datasource correto selecionado?
- Query retorna valores? (Preview of values)
- Regex de filtro esta correto?
- Refresh esta configurado? (On Dashboard Load / On Time Range Change)
```

**2. Testar Query da Variavel no Explore**

```
Para variavel com query Prometheus:
  label_values(up{namespace="velya"}, job)

Testar no Explore:
  up{namespace="velya"}

Verificar se label "job" existe nos resultados.
```

**3. Verificar Dependencias entre Variaveis**

```
Se variavel B depende de variavel A:

A: namespace = label_values(up, namespace)
B: service = label_values(up{namespace="$namespace"}, job)

Se A nao resolve, B tambem nao.
Verificar ordem das variaveis no dashboard settings.
```

---

## Procedimento 6: Diagnosticar Discrepancia entre Explore e Dashboard

### Cenario
A mesma query retorna resultados diferentes no Explore vs no Dashboard.

### Passos

```
1. Comparar queries lado a lado:
   - No Dashboard: Inspector > Aba Query > copiar query resolvida
   - No Explore: colar a query exata

2. Verificar diferencas:
   - Time range: Dashboard pode ter time range diferente do Explore
   - Variaveis: Dashboard resolve variaveis, Explore usa valores literais
   - Step/Interval: Dashboard calcula automaticamente, Explore permite override
   - Min interval: Dashboard panel pode ter min interval configurado

3. Verificar transformacoes:
   - Dashboard pode ter transformacoes que alteram os dados
   - Explore mostra dados brutos do datasource

4. Verificar field overrides:
   - Dashboard pode ter overrides que filtram ou modificam campos
   - Explore nao tem overrides
```

---

## Tabela de Referencia Rapida

| Sintoma                        | Primeiro Lugar para Verificar    | Correcao Provavel                  |
|-------------------------------|----------------------------------|------------------------------------|
| No data                      | Inspector > Query > response     | Verificar metrica/labels/time range|
| Erro vermelho                 | Inspector > Query > error        | Corrigir sintaxe PromQL/LogQL      |
| Carregamento lento            | Inspector > Stats > timing       | Otimizar query, recording rules    |
| Dados presentes mas invisiveis| Inspector > Data > campos        | Verificar tipo de painel, overrides|
| Variavel vazia                | Dashboard Settings > Variables   | Verificar query e datasource       |
| Valores incorretos            | Inspector > Data > valores       | Verificar unidade, transformacoes  |
| Discrepancia com Explore      | Comparar queries resolvidas      | Verificar time range, step, vars   |
| Timeout                       | Inspector > Stats > timing       | Reduzir time range ou cardinalidade|

---

## Atalhos Uteis

| Atalho          | Acao                                    |
|----------------|-----------------------------------------|
| `e`            | Editar painel (modo edit)               |
| `i`            | Inspecionar painel (abre inspector)     |
| `v`            | Ver painel em tela cheia                |
| `d s`          | Salvar dashboard                        |
| `Ctrl+Z`       | Desfazer ultima mudanca (em edit)       |
| `t z`          | Zoom out no time range                  |

---

## Dicas Avancadas

### Exportar Dados para Analise

```
No Inspector > Aba Data:
- Clicar em "Download CSV" para exportar dados para analise local
- Clicar em "Download logs" para exportar logs

Util para:
- Comparar dados entre periodos
- Analisar fora do Grafana
- Compartilhar dados com colegas
```

### Copiar Query como cURL

```
No Inspector > Aba Query:
- Clicar em "Copy to clipboard" para copiar request como cURL
- Executar no terminal para testar diretamente contra o datasource:

curl -s 'http://prometheus:9090/api/v1/query_range' \
  --data-urlencode 'query=sum(rate(http_requests_total{namespace="velya"}[5m]))' \
  --data-urlencode 'start=1712534400' \
  --data-urlencode 'end=1712620800' \
  --data-urlencode 'step=60' | jq .
```

### Habilitar Query Tracing

```
Para queries Loki, habilitar query tracing:

Na query do Explore ou painel, adicionar header:
  X-Query-Tags: source=inspector

Isso permite rastrear a query no Tempo se o Loki esta configurado
para emitir traces de queries.
```
