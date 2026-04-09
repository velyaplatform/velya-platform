# Playbook do Panel Inspector do Grafana

## Visao Geral

O Panel Inspector e complementar ao Query Inspector. Enquanto o Query Inspector foca na comunicacao com o datasource, o Panel Inspector foca na camada de visualizacao: como os dados sao transformados, renderizados e apresentados. E essencial para diagnosticar problemas onde os dados existem mas a visualizacao esta incorreta.

---

## Como Acessar o Panel Inspector

### Metodo 1: Via Menu do Painel

1. Passar o mouse sobre o painel
2. Clicar no titulo do painel
3. Selecionar **"Inspect"**
4. Escolher a sub-opcao desejada:
   - **Data**: Dados processados prontos para renderizacao
   - **Stats**: Estatisticas do painel
   - **JSON**: Modelo JSON completo do painel

### Metodo 2: Via Atalho

1. Clicar no painel para selecionar
2. Pressionar `i` para abrir o inspector

### Metodo 3: Via Edit Mode

1. Editar o painel (clicar titulo > Edit, ou pressionar `e`)
2. Na parte inferior, alternar entre **Query**, **Transform**, **Alert**
3. Para cada query, clicar em **"Query Inspector"** no canto inferior

---

## Aba 1: Data (Dados Processados)

### O Que Mostra

A aba Data mostra os dados **apos** processamento pelo Grafana, incluindo transformacoes, field overrides e formatacao.

### Procedimento de Inspecao

**Passo 1: Verificar Frames de Dados**

```
Abrir Inspector > Data

Observar:
- Quantos "frames" de dados existem?
- Cada frame corresponde a uma query (A, B, C...)
- Se zero frames: o datasource nao retornou dados

Frame Structure:
+--------------------+
| Frame: A           |
| Fields:            |
|  - Time (datetime) |
|  - Value (number)  |
|  - Labels (string) |
+--------------------+
```

**Passo 2: Verificar Campos e Tipos**

```
Para cada frame, verificar:

| Campo     | Tipo Esperado | Problema se Incorreto                    |
|-----------|---------------|------------------------------------------|
| Time      | datetime      | Painel time series nao plota sem time    |
| Value     | number        | String nao e plotavel em graficos        |
| __name__  | string        | Legenda mostra raw label em vez de nome  |

Se campo esta como string mas deveria ser number:
- Verificar transformacao "Convert field type"
- Adicionar override: Field > Type > Number
```

**Passo 3: Visualizar Dados em Tabela**

```
Na aba Data:
- Selecionar "Show data frame" para ver como tabela
- Verificar se valores fazem sentido
- Procurar valores null, NaN, Infinity
- Verificar se timestamps estao na faixa esperada

Opcoes de visualizacao:
- "Series joined by time": junta todas as series por timestamp
- "Table": mostra cada frame separadamente
- "Data frame": mostra estrutura interna
```

**Passo 4: Exportar para Analise**

```
Clicar em "Download CSV" ou "Download JSON"
Abrir em planilha ou ferramenta de analise
Verificar:
- Gaps nos dados (timestamps faltando)
- Valores outlier
- Padroes anormais
```

---

## Aba 2: Stats (Estatisticas)

### O Que Mostra

Estatisticas sobre a execucao da query e renderizacao do painel.

### Metricas Disponiiveis

| Metrica              | Descricao                         | Valor Esperado      |
| -------------------- | --------------------------------- | ------------------- |
| Total request time   | Tempo total da query              | < 3s                |
| Data processing time | Tempo de processamento no Grafana | < 500ms             |
| Number of queries    | Quantas queries o painel executa  | 1-5                 |
| Number of rows       | Total de linhas retornadas        | Depende do contexto |
| Data points received | Pontos de dados do datasource     | Depende do step     |
| Annotations          | Anotacoes carregadas              | 0-100               |

### Diagnostico por Stats

```
Se "Total request time" > 5s:
  -> Query muito pesada, otimizar (ver Query Inspector Playbook)

Se "Data processing time" > 1s:
  -> Transformacoes pesadas, simplificar transformacoes

Se "Number of rows" = 0:
  -> Datasource nao retornou dados

Se "Number of rows" > 100000:
  -> Muitos dados, pode causar lentidao no navegador
  -> Considerar agregacao mais forte no PromQL
  -> Usar transformacao "Limit" para reduzir
```

---

## Aba 3: JSON (Modelo do Painel)

### O Que Mostra

O modelo JSON completo do painel, incluindo toda a configuracao.

### Estrutura do JSON

```json
{
  "id": 1,
  "type": "timeseries",
  "title": "Request Rate",
  "description": "Taxa de requisicoes por segundo",
  "datasource": {
    "type": "prometheus",
    "uid": "prometheus"
  },
  "targets": [
    {
      "refId": "A",
      "expr": "sum(rate(http_requests_total{namespace=\"$namespace\"}[5m]))",
      "legendFormat": "{{job}}"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "reqps",
      "min": 0,
      "thresholds": {
        "mode": "absolute",
        "steps": [
          { "color": "green", "value": null },
          { "color": "yellow", "value": 1000 },
          { "color": "red", "value": 5000 }
        ]
      },
      "links": [],
      "custom": {
        "drawStyle": "line",
        "lineWidth": 1,
        "fillOpacity": 10,
        "gradientMode": "none",
        "spanNulls": false,
        "showPoints": "auto",
        "pointSize": 5
      }
    },
    "overrides": []
  },
  "transformations": [],
  "options": {
    "tooltip": {
      "mode": "multi",
      "sort": "desc"
    },
    "legend": {
      "displayMode": "table",
      "placement": "bottom",
      "calcs": ["mean", "max", "last"]
    }
  },
  "gridPos": {
    "h": 8,
    "w": 12,
    "x": 0,
    "y": 0
  }
}
```

### O Que Verificar no JSON

**1. Datasource**

```
Verificar que datasource.uid aponta para datasource correto
Problema comum: datasource UID mudou apos reimport/recreate
```

**2. Targets (Queries)**

```
Verificar:
- expr: a query esta correta?
- legendFormat: formato da legenda faz sentido?
- interval: intervalo minimo esta configurado?
- refId: IDs unicos para cada query
```

**3. Field Config**

```
Verificar:
- unit: unidade correta (reqps, bytes, percent, s, ms, etc.)
- min/max: range faz sentido para os dados?
- thresholds: valores de threshold estao corretos?
- decimals: quantidade de casas decimais adequada?
- custom.drawStyle: estilo de linha adequado?
- custom.fillOpacity: preenchimento configurado?
- custom.spanNulls: como tratar gaps nos dados?
```

**4. Overrides**

```
Overrides podem esconder dados ou alterar visualizacao.
Verificar cada override:
- Qual campo afeta?
- Que propriedade modifica?
- O override esta correto para os dados atuais?
```

**5. Transformations**

```
Verificar:
- Tipo de cada transformacao
- Opcoes configuradas
- Ordem das transformacoes (importa!)
```

---

## Problemas Comuns e Correcoes

### Problema 1: Painel Mostra "No data" mas Dados Existem

```
DIAGNOSTICO:
1. Inspector > Data: Dados aparecem? SIM
2. Inspector > JSON: Verificar fieldConfig.defaults.custom.drawStyle
3. Verificar se tipo de painel e compativel com formato dos dados

CORRECOES POSSIVEIS:
- Mudar tipo de painel (timeseries, stat, gauge, etc.)
- Adicionar transformacao "Convert field type"
- Corrigir unit se conversao esta zerando valores
- Remover override que esconde campo de valor
```

### Problema 2: Legenda Mostra Labels em Vez de Nomes

```
DIAGNOSTICO:
1. Inspector > Data: Verificar campo __name__
2. Inspector > JSON: Verificar targets[].legendFormat

CORRECAO:
- Definir legendFormat: "{{job}} - {{method}}"
- Usar transformacao "Rename by regex" se necessario
```

### Problema 3: Valores Parecem Incorretos

```
DIAGNOSTICO:
1. Inspector > Data: Verificar valores brutos
2. Inspector > JSON: Verificar fieldConfig.defaults.unit
3. Comparar com Explore

CAUSAS COMUNS:
| Problema              | Causa                          | Correcao                    |
|-----------------------|-------------------------------|-----------------------------|
| Valor mostra 0.001    | Unit errada (bytes vs GB)     | Corrigir unit               |
| Valor mostra 100000%  | Multiplicacao por 100 dupla   | Remover * 100 da query      |
| Valor negativo        | rate() em counter que resetou | Usar increase() ou irate()  |
| Valores piscando      | refresh muito frequente       | Aumentar refresh interval   |
| Gaps nos dados        | spanNulls: false              | Mudar para spanNulls: true  |
```

### Problema 4: Thresholds Nao Aparecem

```
DIAGNOSTICO:
1. Inspector > JSON: Verificar fieldConfig.defaults.thresholds
2. Verificar se thresholds.mode e "absolute" ou "percentage"

CORRECOES:
- Verificar se valores de threshold fazem sentido para a escala dos dados
- Verificar se unit nao esta convertendo valores (ex: threshold em bytes mas unit em GB)
- Verificar se thresholds estao em defaults ou em override especifico
```

### Problema 5: Tooltip Nao Mostra Informacoes

```
DIAGNOSTICO:
1. Inspector > JSON: Verificar options.tooltip

CORRECAO:
- tooltip.mode: "multi" (mostra todas as series)
- tooltip.sort: "desc" (ordena por valor)
```

### Problema 6: Painel Lento para Renderizar

```
DIAGNOSTICO:
1. Inspector > Stats: Verificar "Data points received"
2. Se > 50000 pontos: muitos dados para renderizar

CORRECOES:
- Aumentar step/interval da query
- Reduzir time range
- Usar agregacao mais forte
- Limitar series com topk() / bottomk()
- Desabilitar pontos: showPoints = "never"
```

### Problema 7: Overrides Nao Funcionam

```
DIAGNOSTICO:
1. Inspector > JSON: Verificar fieldConfig.overrides
2. Verificar matcher do override

EXEMPLO DE OVERRIDE:
{
  "overrides": [
    {
      "matcher": {
        "id": "byName",
        "options": "error_rate"  // Deve ser EXATAMENTE o nome do campo
      },
      "properties": [
        {
          "id": "color",
          "value": {"fixedColor": "red", "mode": "fixed"}
        }
      ]
    }
  ]
}

PROBLEMA COMUM:
- matcher.options nao corresponde ao nome real do campo
- Verificar nome exato na aba Data do Inspector
```

### Problema 8: Painel de Logs Nao Mostra Logs

```
DIAGNOSTICO:
1. Inspector > Data: Verificar se frame tem campos esperados
2. Tipo de frame deve ter: timestamp, body, severity

CORRECOES:
- Verificar se datasource e Loki (nao Prometheus)
- Verificar se query LogQL esta correta
- Verificar derived fields para links de trace
```

---

## Workflow de Diagnostico Completo

```
PAINEL COM PROBLEMA
|
+--> [1] Inspector > Data: Tem dados?
|    |
|    +-- NAO: Ir para Query Inspector Playbook
|    +-- SIM: Continua
|
+--> [2] Inspector > Data: Dados fazem sentido?
|    |
|    +-- NAO (null, NaN, wrong values): Verificar query e datasource
|    +-- SIM: Continua
|
+--> [3] Inspector > JSON: Tipo de painel adequado?
|    |
|    +-- NAO: Mudar tipo de painel
|    +-- SIM: Continua
|
+--> [4] Inspector > JSON: Field config correto?
|    |
|    +-- NAO (unit, min/max, thresholds): Corrigir field config
|    +-- SIM: Continua
|
+--> [5] Inspector > JSON: Overrides problematicos?
|    |
|    +-- SIM: Corrigir ou remover overrides
|    +-- NAO: Continua
|
+--> [6] Inspector > JSON: Transformacoes eliminando dados?
|    |
|    +-- SIM: Corrigir ou remover transformacao
|    +-- NAO: Continua
|
+--> [7] Inspector > Stats: Performance adequada?
|    |
|    +-- NAO: Otimizar query ou reduzir dados
|    +-- SIM: Problema nao identificado, escalar
```

---

## Checklist de Verificacao Rapida

| #   | Verificacao                                 | Onde Verificar          | OK? |
| --- | ------------------------------------------- | ----------------------- | --- |
| 1   | Dados retornados pelo datasource            | Inspector > Data        | [ ] |
| 2   | Campos com tipos corretos (time, number)    | Inspector > Data        | [ ] |
| 3   | Valores dentro do range esperado            | Inspector > Data        | [ ] |
| 4   | Sem valores null/NaN inesperados            | Inspector > Data        | [ ] |
| 5   | Query execution time < 3s                   | Inspector > Stats       | [ ] |
| 6   | Datasource UID correto                      | Inspector > JSON        | [ ] |
| 7   | Unit configurada corretamente               | Inspector > JSON        | [ ] |
| 8   | Min/Max fazem sentido                       | Inspector > JSON        | [ ] |
| 9   | Thresholds configurados e visiveis          | Inspector > JSON        | [ ] |
| 10  | Legend format definido                      | Inspector > JSON        | [ ] |
| 11  | Overrides com matchers corretos             | Inspector > JSON        | [ ] |
| 12  | Transformacoes produzem resultado           | Inspector > JSON + Data | [ ] |
| 13  | Tooltip configurado (mode: multi)           | Inspector > JSON        | [ ] |
| 14  | Tipo de painel adequado para os dados       | Inspector > JSON + Data | [ ] |
| 15  | Links (data links) apontam para destinos OK | Inspector > JSON        | [ ] |

---

## Dicas de Produtividade

### Copiar JSON do Painel

```
Inspector > JSON > Copy to clipboard

Util para:
- Compartilhar configuracao com colega
- Fazer backup antes de mudanca
- Comparar configuracao entre paineis
- Importar configuracao em outro dashboard
```

### Comparar Paineis

```
1. Copiar JSON do painel A
2. Copiar JSON do painel B
3. Usar diff tool (VSCode, diff online, etc.)
4. Identificar diferencas na configuracao

Util quando:
- Um painel funciona e outro nao
- Padronizar configuracao entre paineis
```

### Validar Alteracoes

```
Apos qualquer alteracao no painel:
1. Abrir Inspector > Data: dados ainda aparecem?
2. Abrir Inspector > Stats: performance aceitavel?
3. Verificar visualmente: painel renderiza corretamente?
4. Testar com diferentes valores de variaveis
5. Testar com diferentes time ranges
```
