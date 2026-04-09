# Matriz de Capacidades Grafana OSS — Velya Platform

> Referência completa das capacidades disponíveis no Grafana OSS (gratuito, self-hosted).
> Use este documento para decidir quais recursos utilizar ao construir dashboards e alertas.
> Última atualização: 2026-04-08

---

## 1. Visualizações

### 1.1 Séries Temporais e Tendências

#### Time Series

**O que é**: Gráfico de linha/área para dados contínuos no tempo. O tipo de visualização mais versátil.

**Quando usar na Velya**:
- Latência P50/P95/P99 de qualquer serviço ao longo do tempo
- Taxa de erros HTTP por serviço (ex.: `rate(http_requests_total{status=~"5.."}[5m])`)
- Throughput de tasks por hora
- Profundidade de queue ao longo do tempo
- Token consumption de AI por hora
- Core Web Vitals (LCP, INP) ao longo do tempo

**Configuração recomendada para Velya**:
- Threshold lines para limites de SLO (ex.: linha vermelha em P99 > 2s)
- Fill opacity baixo (10-20%) para facilitar leitura com múltiplas séries
- Stack mode apenas para métricas de composição (ex.: altas por tipo de bloqueador)
- Legend abaixo com valores de min/max/current

**Limitações OSS**: Sem anomaly detection automática (disponível no Grafana Cloud com ML).
**Alternativa Enterprise**: Machine Learning plugin para detecção de anomalias.

---

#### Trend

**O que é**: Similar ao Time Series, mas otimizado para dados com timestamp fixo (não janela deslizante).

**Quando usar na Velya**:
- Evolução de SLO ao longo de semanas (não minutos)
- Tendência de tempo médio de internação por semana
- Crescimento de cardinalidade Prometheus ao longo do mês

**Limitações OSS**: Nenhuma significativa para os casos de uso da Velya.

---

#### Candlestick

**O que é**: Visualização OHLC (open/high/low/close) para dados com variação em janelas de tempo.

**Quando usar na Velya**:
- Variação de latência (min/max/média/P95) por janela de 1 hora
- Variação de throughput de tasks por turno (manhã/tarde/noite)

---

#### XY Chart

**O que é**: Correlação entre duas métricas em scatter plot.

**Quando usar na Velya**:
- Correlação entre profundidade de queue e latência de resposta
- Correlação entre número de pacientes ativos e taxa de erros do patient-flow-service
- Correlação entre token consumption e taxa de validação de agents

---

### 1.2 Distribuição e Frequência

#### Histogram

**O que é**: Distribuição de valores em buckets. Exige métrica do tipo Histogram no Prometheus.

**Quando usar na Velya**:
- Distribuição de latência de requests HTTP (`http_request_duration_seconds_bucket`)
- Distribuição de duração de handoffs entre agents
- Distribuição de age de bloqueadores de alta
- Distribuição de confiança de recomendações de AI

**Configuração recomendada**:
- Usar `$__rate_interval` para calcular percentis corretamente
- Combinar com Threshold lines para SLOs (ex.: 95% dos requests < 500ms)

---

#### Heatmap

**O que é**: Distribuição de valores em duas dimensões: tempo no eixo X, valor no eixo Y, frequência na cor.

**Quando usar na Velya**:
- Densidade de handoffs entre agents ao longo do dia (hora × frequência)
- Distribuição de latência de AI por hora do dia (detectar degradação em horários de pico)
- Padrão de acesso de usuários por hora do dia
- Distribuição de idade de tarefas (hora × prioridade)

**Limitações OSS**: Nenhuma significativa.

---

### 1.3 Comparação e Ranking

#### Bar Chart

**O que é**: Gráfico de barras para comparação entre categorias.

**Quando usar na Velya**:
- Throughput de tasks por office (comparar clinical-office vs. administrative-office)
- Número de bloqueadores por tipo (medicação/exame/social/transporte)
- Top 10 agents por taxa de rejeição de validação
- Erros por tipo de erro (DISCHARGE_BLOCKER_ACTIVE, TASK_QUEUE_FULL, etc.)
- Tokens consumidos por modelo (Haiku vs Sonnet vs Opus)

**Configuração recomendada**:
- Horizontal para listas longas (mais de 6 itens)
- Vertical para comparações curtas (menos de 6 itens)
- Ordenar por valor descendente para facilitar leitura de ranking

---

#### Bar Gauge

**O que é**: Barras de progresso com gradiente de cor, ideal para mostrar uso relativo a um limite.

**Quando usar na Velya**:
- Uso de CPU por namespace relativo ao limit (namespace budget)
- Profundidade de queue por prioridade relativa ao máximo histórico
- Cardinalidade Prometheus relativa ao limite de 1M series
- Completude de evidence ratio por agent

**Configuração recomendada**:
- Gradiente: verde (0-60%) → amarelo (60-80%) → vermelho (80-100%)
- Orientação horizontal, thresholds em valores absolutos

---

#### Gauge

**O que é**: Ponteiro analógico ou arco para um único valor numérico com contexto de escala.

**Quando usar na Velya**:
- Taxa de disponibilidade do serviço (SLO de uptime: 99.5%)
- Percentual de tarefas concluídas dentro do SLA
- Taxa de validação de agents (meta: > 90% pass rate)
- Percentual de budget de observabilidade usado

**Configuração recomendada**:
- Sempre definir min/max e thresholds
- Thresholds em valores de negócio (ex.: 90% é normal, 80% é warning, 70% é crítico para validação)

---

#### Pie Chart

**O que é**: Gráfico de pizza/donut para distribuição proporcional.

**Quando usar na Velya** (com cautela — apenas para distribuições onde proporção importa):
- Distribuição de bloqueadores de alta por tipo (5-6 categorias máximo)
- Distribuição de erros por categoria (4xx vs 5xx vs timeout)
- Distribuição de tarefas por prioridade atual

**Quando NÃO usar**:
- Mais de 6 categorias (usar Bar Chart)
- Dados temporais (usar Time Series)
- Comparação absoluta (usar Bar Chart)

---

### 1.4 Estado e Status

#### Stat

**O que é**: Um único valor grande com cor de background. O "semáforo" do Grafana.

**Quando usar na Velya**:
- Número atual de pacientes aguardando alta (KPI executivo)
- Taxa de disponibilidade do api-gateway (ex.: 99.97%)
- Número de alertas críticos ativos agora
- Número de agents em estado degradado agora
- Total de tarefas vencidas (past SLA) agora

**Configuração recomendada**:
- Thresholds de cor baseados em SLOs ou limites operacionais
- Sparkline (mini gráfico de linha) no background para contexto temporal
- Unidade correta (%, s, ms, count) — nunca deixar sem unidade

---

#### State Timeline

**O que é**: Linha do tempo de estados categóricos para múltiplas entidades.

**Quando usar na Velya**:
- Estado de cada agent ao longo do tempo (healthy/degraded/silent/quarantined)
- Estado de cada serviço ao longo do tempo (up/down/degraded)
- Status de cada ScaledObject KEDA (scaled-up/scaled-down/thrashing)
- Estado de leitos por unidade (livre/ocupado/bloqueado)
- Janelas de manutenção e incidentes ao longo da semana

**Configuração recomendada**:
- Cores: verde (healthy), amarelo (degraded), vermelho (error/quarantined), cinza (unknown/offline)
- Linha por entidade (agent, serviço, leito)
- Tooltip mostrando duração do estado atual

---

#### Status History

**O que é**: Heatmap de estados categóricos — múltiplas entidades × tempo.

**Quando usar na Velya**:
- Histórico de disponibilidade de todos os serviços nos últimos 30 dias
- Histórico de conformidade de SLO por serviço por dia
- Histórico de execução de deploys por dia

---

### 1.5 Dados Tabulares

#### Table

**O que é**: Tabela de dados com suporte a sorting, filtering e cell coloring.

**Quando usar na Velya**:
- Lista de pacientes bloqueados aguardando alta (patient_id, tipo de bloqueador, idade em horas)
- Ranking de agents por taxa de rejeição de validação
- Lista de alertas ativos com severidade, serviço e duração
- Lista de tarefas vencidas com assignee, tipo e atraso
- Inventário de serviços com nível de instrumentação atual

**Quando NÃO usar**:
- Dados temporais (usar Time Series)
- Um único valor (usar Stat)
- Menos de 3 colunas onde Stat/Bar Chart funcionaria melhor

**Configuração recomendada**:
- Cell coloring para colunas de status e severidade
- Link de data link para o dashboard de detalhe do item
- Ordenar por coluna mais relevante por padrão

---

#### Text

**O que é**: Painel de texto estático em Markdown.

**Quando usar na Velya** (apenas quando há justificativa):
- Cabeçalho de seção em dashboard executivo com contexto de leitura
- Instruções de runbook inline em dashboard de incidente
- Estado de declaração de SLO em dashboard de SLO

**Quando NÃO usar**:
- Como substituto de visualização de dados — dados dinâmicos devem usar painéis dinâmicos
- Para documentação geral — documentação vai em arquivos Markdown no repositório

---

### 1.6 Logs, Traces e Profiling

#### Logs

**O que é**: Visualização de logs brutos do Loki com filtros, labels e busca de texto.

**Quando usar na Velya**:
- Investigação de erro específico correlacionado com spike de métricas
- Auditoria de operações clínicas (quais ações foram tomadas e quando)
- Debug de handoff de agent com trace_id
- Análise de padrão de error_code por serviço

**Configuração recomendada**:
- Sempre vincular a um Time Series de error rate como painel superior
- Usar variáveis para filtrar por serviço, namespace, level, error_code
- Data link do trace_id para o painel de Traces

---

#### Traces

**O que é**: Visualização de spans distribuídos (gantt chart de requisições distribuídas).

**Quando usar na Velya** (requer Tempo instalado — PENDENTE):
- Investigação de latência alta end-to-end (frontend → api-gateway → serviço → DB)
- Rastreamento de decisão de alta do início ao fim
- Debug de timeout em workflow Temporal
- Identificação de gargalo em cadeia de agents

---

#### Flame Graph

**O que é**: Visualização de call stack de profiling (requer Pyroscope — FUTURO).

**Quando usar na Velya**:
- Identificação de hotspot de CPU no api-gateway em horário de pico
- Debug de memory leak no patient-flow-service
- Otimização de performance de construção de contexto no ai-gateway

---

#### Node Graph

**O que é**: Grafo de nós e arestas para dependências e topologia.

**Quando usar na Velya**:
- Mapa de dependências de serviços (quem chama quem)
- Grafo de handoffs entre agents (quais offices interagem mais)
- Topologia de nodes do cluster

---

### 1.7 Visualizações Especializadas

#### Canvas

**O que é**: Editor de layout livre com formas, ícones e dados em tempo real. O "SCADA" do Grafana.

**Quando usar na Velya**:
- **Patient Flow Command Board**: planta da UTI/enfermaria com leitos coloridos por status
- **Agent Oversight Console**: diagrama visual dos offices e seus agents com status em tempo real
- **Cluster Overview**: diagrama do cluster com nós, namespaces e fluxo de tráfego

**Limitações OSS**: Sem autenticação por iframe embutido (disponível no Enterprise).

---

#### Geomap

**O que é**: Mapa geográfico com layers de dados.

**Quando usar na Velya**:
- (Aplicabilidade limitada no contexto hospitalar single-unit)
- Para rede hospitalar com múltiplas unidades: distribuição de pacientes por unidade/localização
- Para rastrear origem de requests em análise de segurança

---

## 2. Funcionalidades de Plataforma

### 2.1 Dashboards

**Tipos de dashboard para Velya**:

| Tipo | Audiência | Frequência | Exemplos na Velya |
|------|-----------|-----------|-------------------|
| **Operacional** | NOC, Eng. de Plantão | Sempre aberto | Cluster Overview, API RED |
| **Executivo** | Gestão Hospitalar | Diário | Patient Flow Command Board |
| **Técnico** | Eng. Backend/Platform | Sob demanda | PostgreSQL Performance, KEDA Monitor |
| **Por Domínio** | Time de Produto, Clinical Office | Diário | Discharge Control Board, Agent Oversight |
| **Investigação** | Eng. em Incidente | Incidente | Dependency Map, AI Gateway Performance |

**Boas práticas de organização**:
- Pastas por domínio: `Infraestrutura/`, `Backend/`, `Frontend/`, `Agents/`, `Negócio Hospitalar/`, `Custo/`
- ID padronizado: `velya-{domínio}-{propósito}` (ex.: `velya-backend-api-red`)
- Tags padronizadas: `velya`, `domínio`, `owner`, `status` (operational/planned)
- Row collapsing para separar seções

---

### 2.2 Explore

**O que é**: Interface de consulta ad hoc sem dashboard. Para investigação e troubleshooting.

**Casos de uso na Velya**:
- Investigar spike de latência com consulta PromQL customizada
- Buscar logs de um trace_id específico durante incidente
- Validar uma nova query antes de adicionar em dashboard
- Correlacionar logs e métricas de um pod específico

**Correlação de sinais no Explore** (feature OSS poderosa):
1. Abrir métricas em Prometheus datasource
2. Clicar em "Split" para adicionar painel de Loki
3. Usar o mesmo filtro (ex.: `service="patient-flow-service"`) nos dois painéis
4. Quando Tempo estiver instalado: clicar no trace_id no log para abrir trace no terceiro painel

---

### 2.3 Alerting

#### Alert Rules

**O que é**: Regras de alerta avaliadas periodicamente pelo Grafana (ou Prometheus).

**Dois modos para a Velya**:
1. **Grafana Managed Alerts**: regras avaliadas pelo próprio Grafana, usando qualquer datasource
2. **Prometheus Ruler (PrometheusRule CRD)**: regras avaliadas pelo Prometheus, via kube-prometheus-stack

**Recomendação para Velya**:
- Usar PrometheusRules para alertas de infraestrutura e backend (avaliados mesmo se Grafana cair)
- Usar Grafana Managed Alerts para alertas compostos (ex.: métrica + log + trace)

---

#### Contact Points

**Contact points configurados para Velya**:

| Nome | Tipo | Destino | Severity |
|------|------|---------|---------|
| `velya-slack-critical` | Slack | #velya-ops-critical | critical |
| `velya-slack-high` | Slack | #velya-ops-high | high |
| `velya-slack-info` | Slack | #velya-ops-info | medium, low |
| `velya-pagerduty` | PagerDuty | velya-oncall service | critical (clínico) |
| `velya-email-daily` | Email | ops@velya.com.br | relatório diário |

---

#### Notification Policies

**O que é**: Árvore de roteamento que decide qual contact point recebe qual alerta.

```yaml
# Política de roteamento — Velya Platform
routes:
  - matchers:
      - severity = critical
      - domain = clinical
    receivers: [velya-pagerduty, velya-slack-critical]
  - matchers:
      - severity = critical
      - domain = security
    receivers: [velya-pagerduty, velya-slack-critical]
  - matchers:
      - severity = high
    receivers: [velya-slack-high]
  - matchers:
      - severity = medium
    receivers: [velya-slack-info]
default_receiver: velya-slack-info
```

---

#### Alert Templates

**O que é**: Templates Go para formatar mensagens de alerta.

**Template rico para Slack na Velya**:
```
{{ define "velya.slack.message" }}
*[{{ .CommonLabels.severity | toUpper }}] {{ .CommonLabels.alertname }}*

*Serviço*: `{{ .CommonLabels.service }}`
*Namespace*: `{{ .CommonLabels.namespace }}`
*Ambiente*: `{{ .CommonLabels.environment }}`

*Impacto*: {{ .CommonAnnotations.impact }}
*Início*: {{ .StartsAt | since }} atrás

<{{ .CommonAnnotations.dashboard_url }}|Ver Dashboard> | <{{ .CommonAnnotations.runbook_url }}|Runbook>

*Ação inicial*: {{ .CommonAnnotations.initial_action }}
{{ end }}
```

---

#### Silences e Mute Timings

**Silences** (ad hoc, para incidentes ou manutenção emergencial):
- Criados via UI ou API durante manutenção não planejada
- Devem ter comentário explicativo e duração máxima de 4 horas

**Mute Timings** (recorrentes, para manutenção planejada):

| Nome | Quando | Domínio afetado |
|------|--------|----------------|
| `manutencao-domingo-madrugada` | Domingo 02:00-06:00 | infraestrutura, plataforma |
| `deploy-janela-planejada` | Terça/Quinta 21:00-23:00 | backend, frontend |

**Regra absoluta**: alertas de domínio `clinical` nunca entram em Mute Timing.

---

### 2.4 Provisioning / Observabilidade como Código

**O que é**: Carregar dashboards, datasources, contact points e alertas de arquivos YAML/JSON ao iniciar o Grafana.

**Estrutura de provisioning para Velya**:

```yaml
# grafana/provisioning/datasources/velya-datasources.yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://kube-prometheus-stack-prometheus.velya-dev-observability:9090
    isDefault: true
    jsonData:
      timeInterval: 15s

  - name: Loki
    type: loki
    url: http://loki.velya-dev-observability:3100

  - name: Tempo
    type: tempo
    url: http://tempo.velya-dev-observability:3100  # quando implementado
    jsonData:
      tracesToLogs:
        datasourceUid: loki
        filterByTraceID: true
        filterBySpanID: true
```

**Vantagem**: Qualquer novo pod Grafana inicia com todos os datasources e dashboards configurados — zero configuração manual.

---

### 2.5 Variables (Variáveis de Dashboard)

**O que é**: Filtros dinâmicos aplicados globalmente em um dashboard. Essencial para dashboards reutilizáveis.

**Variáveis padrão para dashboards Velya**:

| Variável | Tipo | Query | Uso |
|----------|------|-------|-----|
| `$environment` | Custom | `dev, staging, prod` | Filtra por ambiente |
| `$namespace` | Query | `label_values(kube_pod_info, namespace)` | Filtra por namespace |
| `$service` | Query | `label_values(http_requests_total, service)` | Filtra por serviço |
| `$office` | Custom | `clinical-office, administrative-office, ...` | Filtra por office de agent |
| `$agent_name` | Query | `label_values(velya_agent_task_total, agent_name)` | Filtra por agent |
| `$interval` | Interval | `1m, 5m, 15m, 1h` | Granularidade temporal |

**Boas práticas**:
- `$__rate_interval` em vez de janela fixa para queries de rate
- `$__range` em vez de `[5m]` fixo quando a janela de tempo muda
- Multi-value para `$service` e `$namespace` (permite selecionar múltiplos)
- `All` option para dashboards operacionais (visão geral)

---

### 2.6 Transformations

**O que é**: Processamento de dados na camada do Grafana, antes da visualização. Sem custo de query adicional.

**Transformations críticas para Velya**:

| Transformation | Caso de uso na Velya |
|---------------|---------------------|
| `Merge` | Unir múltiplas queries em uma tabela (ex.: métricas de serviços diferentes) |
| `Filter by name` | Remover campos desnecessários de tabelas |
| `Rename by regex` | Padronizar nomes de labels para exibição |
| `Calculate field` | Calcular taxa de erro: `error_count / total_count * 100` |
| `Group by` | Agregar por office ou agent_name |
| `Sort by` | Ordenar tabela de alertas por severidade e duração |
| `Limit` | Top N agents por métrica (ex.: top 10 por taxa de rejeição) |
| `Reduce` | Extrair Last/Max/Min para painéis Stat |
| `Override` | Aplicar unidade diferente por campo em tabelas mistas |
| `Threshold` | Colorir células de tabela por valor |

---

### 2.7 Links entre Dashboards

**Dashboard Links** (navegação entre dashboards):
- Todo dashboard de overview tem link para dashboards de detalhe
- Todo dashboard de detalhe tem link para dashboard de runbook/incidente

**Data Links** (links contextuais em pontos de dados):
- Clique em um ponto de spike de latência → abre Explore com query filtrada para aquele serviço/horário
- Clique em um log com trace_id → abre painel de Traces com aquele trace
- Clique em nome de serviço na tabela → abre dashboard RED daquele serviço
- Clique em nome de agent → abre dashboard de detalhe do agent

**Exemplo de Data Link para logs**:
```
URL: /explore?orgId=1&left={"datasource":"loki","queries":[{"expr":"{service=\"${__field.labels.service}\"}","refId":"A"}],"range":{"from":"${__from}","to":"${__to}"}}
Título: Ver logs do serviço
```

---

### 2.8 Library Panels (Painéis Reutilizáveis)

**O que é**: Painéis compartilhados entre múltiplos dashboards. Atualização em um painel propaga para todos os dashboards que o usam.

**Library panels padronizados para Velya**:

| Nome | Tipo | Conteúdo | Usado em |
|------|------|---------|---------|
| `velya-lib-service-error-rate` | Time Series | Taxa de erro HTTP por serviço | Todos dashboards de serviço |
| `velya-lib-service-latency-p99` | Time Series | P99 de latência com threshold SLO | Todos dashboards de serviço |
| `velya-lib-pod-restarts` | Stat | Reinicializações de pod nas últimas 24h | Todos dashboards de infraestrutura |
| `velya-lib-agent-status` | State Timeline | Estado dos agents por office | Agent Oversight, Office Health |
| `velya-lib-queue-depth` | Bar Gauge | Profundidade de queue por prioridade | Inbox Intelligence, Queue/Worker Health |
| `velya-lib-keda-replicas` | Time Series | Réplicas atual vs. target por ScaledObject | KEDA Monitor, Cluster Overview |

---

### 2.9 Annotations

**O que é**: Marcações verticais no eixo de tempo de um dashboard, para correlacionar eventos com mudanças em métricas.

**Tipos de annotation para Velya**:

| Tipo | Fonte | O que marca | Cor |
|------|-------|------------|-----|
| Deploy | Webhook de CI/CD | Deploy de nova versão de serviço | Azul |
| Incidente | Grafana Alerting | Início e fim de alerta crítico | Vermelho |
| Release de Agent | Webhook de GitOps | Nova versão de agent em produção | Verde |
| Manutenção | Manual | Início de janela de manutenção | Cinza |
| Mudança de SLO | Manual | Alteração de threshold de SLO | Roxo |

**Annotation query para deploys** (via Grafana API):
```
POST /api/annotations
{
  "time": <timestamp>,
  "tags": ["deploy", "service:patient-flow-service", "version:1.2.0"],
  "text": "Deploy patient-flow-service v1.2.0"
}
```

---

## 3. Limitações OSS vs. Enterprise

| Capacidade | OSS | Enterprise | Relevância para Velya |
|-----------|-----|-----------|----------------------|
| Dashboards ilimitados | Sim | Sim | — |
| Alerting completo | Sim | Sim | — |
| Provisioning | Sim | Sim | — |
| LDAP/SSO | Sim (LDAP básico) | Sim (SAML, OAuth avançado) | Usar OIDC via Keycloak (OSS) |
| RBAC granular por dashboard | Não | Sim | Usar pastas com permissão por team (OSS) |
| Machine Learning (anomaly detection) | Não | Sim | Não crítico na fase atual |
| Reporting PDF agendado | Não | Sim | Usar snapshot manual ou export |
| On-call scheduling | Não | Sim | Usar PagerDuty para on-call |
| SLO tracking nativo | Não | Sim | Implementar com queries PromQL customizadas |
| Correlação automática de logs+traces | Parcial | Total | Configurar manualmente via Data Links |

**Conclusão**: O Grafana OSS cobre 100% das necessidades atuais da Velya. Enterprise só seria considerado quando houver necessidade de RBAC granular por paciente/unidade ou reporting automático para regulatórios.
