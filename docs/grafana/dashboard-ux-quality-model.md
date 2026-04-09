# Modelo de Qualidade UX de Dashboards

## Visao Geral

Um dashboard nao e bom porque tem muitos paineis. Um dashboard e bom porque ajuda alguem a tomar uma decisao ou executar uma acao mais rapido. Este documento define os principios, regras e checklist para garantir que cada dashboard da plataforma Velya seja util, acionavel e eficiente.

---

## As 7 Perguntas Fundamentais

Antes de criar ou revisar qualquer dashboard, responda estas perguntas:

| # | Pergunta                                    | Se Nao Souber Responder                    |
|---|--------------------------------------------|--------------------------------------------|
| 1 | **Para quem e este dashboard?**            | O dashboard nao tem publico definido       |
| 2 | **Que decisao ele ajuda a tomar?**         | O dashboard e decorativo, nao util         |
| 3 | **Que acao ele dispara?**                  | O dashboard informa mas nao orienta        |
| 4 | **Que pergunta ele responde?**             | O dashboard existe sem proposito claro     |
| 5 | **O que deve chamar atencao?**             | Nao ha hierarquia visual, tudo e igual     |
| 6 | **O que e ruido?**                         | Ha paineis que ninguem olha                |
| 7 | **O que deveria estar em drilldown?**      | Tudo esta no topo, sem filtragem           |

### Exemplo: Dashboard do Patient API

```
1. Para quem?
   -> SRE de plantao e engenheiros backend do time Patient

2. Que decisao ajuda?
   -> "O servico esta saudavel?" -> "Preciso escalar?" -> "Ha degradacao?"

3. Que acao dispara?
   -> Se error rate > 5%: investigar logs
   -> Se latencia P95 > 2s: verificar dependencias
   -> Se CPU > 80%: escalar pods

4. Que pergunta responde?
   -> "Qual a taxa de erro agora?"
   -> "A latencia esta normal?"
   -> "Os pods estao saudaveis?"

5. O que deve chamar atencao?
   -> Error rate (grande, vermelho se alto)
   -> SLO burn rate (destaque se queimando)

6. O que e ruido?
   -> Grafico de GC detalhado (mover para drilldown)
   -> Metricas de JVM internas (mover para drilldown)

7. O que deveria estar em drilldown?
   -> Detalhes de cada endpoint
   -> Logs individuais
   -> Traces especificos
```

---

## Regras de Design de Dashboard

### Regra 1: Alta Densidade Util

```
BOM:  Dashboard com 6 paineis, todos respondendo perguntas claras
RUIM: Dashboard com 30 paineis, 20 dos quais ninguem olha

Metrica: Se um painel nao e olhado em 30 dias, ele e candidato a remocao.

Estrutura recomendada por dashboard:
+------------------------------------------------------------------+
| ROW 1: Status Geral (2-4 stats/gauges)                           |
|   [Disponibilidade] [Error Rate] [Latencia P95] [SLO Status]    |
+------------------------------------------------------------------+
| ROW 2: Golden Signals (2-4 time series)                          |
|   [Request Rate over time] [Error Rate over time]                |
|   [Latency distribution]  [Saturation]                           |
+------------------------------------------------------------------+
| ROW 3: Detalhes sob demanda (collapsed rows)                     |
|   > Infraestrutura (expandir)                                    |
|   > Logs (expandir)                                              |
|   > Traces (expandir)                                            |
+------------------------------------------------------------------+
```

### Regra 2: Titulos Claros e Descritivos

```
BOM:
  Titulo: "Error Rate (% de requisicoes com 5xx)"
  Descricao: "Taxa de erro do servico. Threshold: <1% normal, >5% critico"

RUIM:
  Titulo: "Errors"
  Descricao: (vazio)

Checklist de titulo:
[x] Descreve O QUE e mostrado (nao so o nome da metrica)
[x] Inclui unidade quando relevante (%, req/s, ms)
[x] Inclui contexto quando necessario (por pod, por endpoint)
[x] Nao e generico ("Panel Title", "Graph", "Data")
```

### Regra 3: Descricoes Curtas e Uteis

```
BOA descricao (tooltip do painel):
  "Latencia P95 de requests HTTP. Normal: <200ms. Investigar se >500ms.
   Causas comuns: database lenta, upstream timeout. Ver runbook: [link]"

RUIM descricao:
  "Shows the latency" (obvio e inutil)
  (vazio) (sem contexto)

Descricao deve conter:
1. O que esta sendo medido (1 frase)
2. Qual o valor normal (1 frase)
3. O que fazer se anormal (1 frase)
4. Link para runbook se aplicavel
```

### Regra 4: Unidades Corretas e Consistentes

| Tipo de Dado      | Unidade Correta      | Unidade ERRADA         |
|-------------------|---------------------|------------------------|
| Latencia          | ms ou s             | "none" ou "short"      |
| Taxa de erro      | percent (0-100)     | ratio (0-1) sem label  |
| Request rate      | reqps ou ops/s      | "none"                 |
| Bytes             | bytes (SI ou IEC)   | "none" ou numero bruto |
| CPU               | percent ou cores    | "none"                 |
| Memoria           | bytes (IEC: GiB)    | "none" ou MB vs MiB    |
| Tempo de atividade| duration (d, h, m)  | segundos brutos        |
| Contagem          | short               | "none"                 |
| Temperatura       | celsius             | "none"                 |

### Regra 5: Thresholds Coerentes e Acionaveis

```
BOM threshold:
  Verde: < 1% error rate (normal)
  Amarelo: 1-5% error rate (investigar)
  Vermelho: > 5% error rate (acao imediata)

  -> O usuario sabe exatamente quando agir e o que fazer

RUIM threshold:
  Verde: < 50%
  Vermelho: > 50%

  -> 50% de que? Quando agir? O que significa?

Regras de threshold:
1. Threshold deve estar alinhado com SLO/SLA
2. Threshold deve ter acao associada (o que fazer quando muda de cor?)
3. Threshold deve ser revisado periodicamente
4. Nao usar threshold decorativo (vermelho bonito mas sem significado)
```

### Regra 6: Sem Graficos Decorativos

```
Painel decorativo = painel que ninguem usa para tomar decisao

Exemplos de paineis decorativos:
- Grafico de uptime que esta sempre em 100% (use stat simple)
- Grafico de versao do servico (use text panel ou annotation)
- Metricas de JVM detalhadas que nenhum dev olha
- Graficos duplicados com filtros diferentes

Teste: Pergunte ao usuario do dashboard "Quando foi a ultima vez
que voce olhou para este painel e tomou uma acao?" Se a resposta
for "nunca" ou "nao lembro", o painel e decorativo.
```

### Regra 7: Tabelas Legiveis

```
BOA tabela:
  +----------+--------+--------+---------+-------+
  | Servico  | Status | Rate   | P95     | Error |
  +----------+--------+--------+---------+-------+
  | patient  | OK     | 142/s  | 45ms    | 0.1%  |
  | billing  | WARN   | 89/s   | 320ms   | 2.3%  |
  +----------+--------+--------+---------+-------+

  - Colunas com largura adequada
  - Valores com unidade
  - Cor indicando status
  - Ordenacao relevante (por status ou erro)

RUIM tabela:
  - 20 colunas, scroll horizontal
  - Sem formatacao de cor
  - Valores sem unidade
  - Sem ordenacao
```

### Regra 8: Links Uteis e Contextuais

```
Links recomendados em cada painel:
1. Drilldown: navegar para dashboard mais detalhado
2. Explore: investigar no Explore com query pre-preenchida
3. Logs: ver logs do servico/periodo
4. Traces: ver traces do servico/periodo
5. Runbook: documentacao de o que fazer

Link deve:
- Preservar contexto (time range, variaveis)
- Abrir na mesma aba (para drilldown) ou nova aba (para runbook)
- Ter titulo descritivo ("Ver traces lentos" vs "Link")
```

### Regra 9: Filtros Praticos

```
Variaveis que devem estar em todo dashboard de servico:
  - namespace: para separar ambientes
  - service: para selecionar servico
  - pod: para filtrar por pod (multi-select)

Variaveis que agregam valor:
  - time_comparison: comparar com periodo anterior
  - endpoint: filtrar por endpoint especifico
  - status_code: filtrar por codigo HTTP

Variaveis que atrapalham:
  - Variavel com 1000 opcoes sem search
  - Variavel sem valor default util
  - Variavel que muda semantica do dashboard
```

### Regra 10: Poucos Cliques ate a Causa Raiz

```
Numero ideal de cliques do alerta ate a causa raiz: 3 ou menos

Alerta -> Dashboard (1 click)
Dashboard -> Painel relevante (0 clicks, ja visivel)
Painel -> Explore/Logs/Trace (1 click via data link)
Explore -> Causa raiz (1 click ou investigacao)

Se o usuario precisa de mais de 5 cliques para chegar na causa raiz,
o fluxo de navegacao precisa ser melhorado.
```

---

## Checklist de Qualidade UX

### Para Dashboard Novo

| # | Criterio                                              | Obrigatorio | Status |
|---|------------------------------------------------------|-------------|--------|
| 1 | Publico-alvo definido e documentado                  | Sim         | [ ]    |
| 2 | Pergunta principal que o dashboard responde           | Sim         | [ ]    |
| 3 | Acoes que o dashboard dispara documentadas            | Sim         | [ ]    |
| 4 | Titulo segue padrao "Velya - [Servico/Categoria]"    | Sim         | [ ]    |
| 5 | Descricao do dashboard preenchida (>20 chars)         | Sim         | [ ]    |
| 6 | Owner atribuido no registry                           | Sim         | [ ]    |
| 7 | Criticidade definida                                  | Sim         | [ ]    |
| 8 | Tags obrigatorias presentes (velya, criticidade, owner)| Sim        | [ ]    |
| 9 | Maximo de 6-8 paineis visiveis sem scroll             | Rec.        | [ ]    |
| 10| Rows colapsadas para detalhes                         | Rec.        | [ ]    |
| 11| Todos os paineis tem titulo descritivo               | Sim         | [ ]    |
| 12| Paineis criticos tem descricao (tooltip)              | Sim         | [ ]    |
| 13| Unidades configuradas em todos os paineis            | Sim         | [ ]    |
| 14| Thresholds definidos e documentados                  | Sim         | [ ]    |
| 15| Links para drilldown configurados                    | Rec.        | [ ]    |
| 16| Links para Explore (logs, traces) configurados       | Rec.        | [ ]    |
| 17| Link para runbook (se critical)                       | Sim*        | [ ]    |
| 18| Variaveis com defaults uteis                          | Sim         | [ ]    |
| 19| Testado com dados reais em staging                   | Sim         | [ ]    |
| 20| Revisado por pelo menos 1 usuario do publico-alvo    | Rec.        | [ ]    |

### Para Revisao de Dashboard Existente

| # | Criterio                                              | Acao se Falhar                          |
|---|------------------------------------------------------|-----------------------------------------|
| 1 | Todos os paineis tem dados (nao "no data")?          | Diagnosticar com arvore de 14 passos    |
| 2 | Todos os paineis tem titulo editado?                  | Corrigir titulos padrao                  |
| 3 | Unidades estao corretas em todos os paineis?          | Corrigir unidades                        |
| 4 | Thresholds fazem sentido com dados atuais?            | Revisar com owner                        |
| 5 | Ha paineis que ninguem usa (0 views em 30d)?          | Candidato a remocao                      |
| 6 | Links funcionam?                                      | Corrigir links quebrados                 |
| 7 | Variaveis resolvem?                                   | Corrigir queries de variaveis            |
| 8 | Dashboard carrega em < 5 segundos?                    | Otimizar queries                         |
| 9 | Layout e legivel em tela padrao (1920x1080)?          | Ajustar gridPos                          |
| 10| Cores e contrastes sao acessiveis?                    | Ajustar paleta de cores                  |

---

## Anti-Patterns de Dashboard

### Anti-Pattern 1: Dashboard "Tudo-em-Um"

```
PROBLEMA: Dashboard com 50 paineis tentando mostrar tudo
SINTOMA: Scroll infinito, carregamento lento, ninguem olha tudo
SOLUCAO: Separar em dashboards focados com links de navegacao
```

### Anti-Pattern 2: Dashboard "Copia-e-Cola"

```
PROBLEMA: Mesmo painel copiado 10 vezes com filtro diferente
SINTOMA: Dashboards enormes, inconsistencia quando um e atualizado
SOLUCAO: Usar variaveis para filtrar, usar library panels
```

### Anti-Pattern 3: Dashboard "Sem Contexto"

```
PROBLEMA: Painel com valor "42" sem unidade, sem titulo, sem threshold
SINTOMA: Ninguem sabe se 42 e bom ou ruim
SOLUCAO: Adicionar titulo, unidade, descricao, threshold
```

### Anti-Pattern 4: Dashboard "Museu"

```
PROBLEMA: Dashboard criado ha 1 ano, nunca atualizado, dados stale
SINTOMA: Metricas que nao existem mais, paineis com "no data"
SOLUCAO: Revisao periodica, ownership ativo, DAE monitorando
```

### Anti-Pattern 5: Dashboard "Engenheiro"

```
PROBLEMA: Dashboard cheio de metricas internas que so o criador entende
SINTOMA: Outros membros do time nao conseguem usar
SOLUCAO: Simplificar para o publico-alvo, detalhe tecnico em drilldown
```

### Anti-Pattern 6: Dashboard "Bonito mas Inutil"

```
PROBLEMA: Dashboard com graficos bonitos mas que nao ajudam ninguem
SINTOMA: Alto trafego visual, baixa utilidade operacional
SOLUCAO: Cada painel deve responder uma pergunta ou disparar uma acao
```

---

## Hierarquia de Dashboards

```
NIVEL 1: Overview Executivo
  - 4-6 paineis
  - SLOs, status geral, tendencias
  - Publico: lideranca, produto
  - Acao: "Estamos saudaveis?"

NIVEL 2: Service Dashboard
  - 8-12 paineis
  - Golden signals, infraestrutura, dependencias
  - Publico: SRE, engenheiros
  - Acao: "Qual servico tem problema?"

NIVEL 3: Debug/Drilldown
  - 12-20 paineis
  - Logs, traces, profiles, metricas detalhadas
  - Publico: engenheiro investigando
  - Acao: "Qual a causa raiz?"

NIVEL 4: Explore
  - Livre
  - Investigacao ad-hoc
  - Publico: engenheiro avancado
  - Acao: "Vou descobrir o que esta acontecendo"
```

---

## Metricas de Qualidade UX

```promql
# Dashboards com paineis sem titulo editado
dae_panel_default_title{namespace="velya-observability"} == 1

# Dashboards sem descricao
dae_dashboard_missing_description{namespace="velya-observability"} == 1

# Paineis sem unidade configurada
dae_panel_missing_unit{namespace="velya-observability"} == 1

# Paineis sem threshold (em dashboards criticos)
dae_panel_missing_threshold{criticality="critical"} == 1

# Dashboards que nao carregam em < 5s
dae_dashboard_load_time_seconds > 5

# Paineis sem uso nos ultimos 30 dias
dae_panel_unused_30d{namespace="velya-observability"} == 1

# Score medio de utilidade semantica
avg(dae_panel_dimension_score{dimension="semantic_usefulness"})
```

---

## Template de Descricao de Dashboard

```markdown
## [Nome do Dashboard]

**Publico:** [Quem usa este dashboard]
**Proposito:** [Que decisao/acao este dashboard suporta]
**Frequencia de Uso:** [Quando este dashboard e consultado]

### Perguntas que este dashboard responde:
1. [Pergunta 1]
2. [Pergunta 2]
3. [Pergunta 3]

### Acoes disparadas por este dashboard:
- Se [condicao]: [acao]
- Se [condicao]: [acao]

### Dependencias:
- Datasource: [lista]
- Servicos monitorados: [lista]

### Links Relacionados:
- Runbook: [URL]
- Drilldown: [Dashboard]
- Documentacao: [URL]
```
