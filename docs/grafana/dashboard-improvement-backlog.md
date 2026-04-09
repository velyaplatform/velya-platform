# Backlog Priorizado de Melhorias de Dashboards

## Visao Geral

Este backlog consolida todas as melhorias planejadas para o ecossistema de dashboards Grafana da plataforma Velya. Cada item e classificado por prioridade, esforco, impacto e owner responsavel.

---

## Prioridades

| Prioridade | Significado                                        | SLA de Execucao |
|------------|---------------------------------------------------|-----------------|
| P0         | Critico - dashboard quebrado ou sem dados          | 24 horas        |
| P1         | Alta - funcionalidade importante faltando          | 1 semana        |
| P2         | Media - melhoria que agrega valor significativo    | 2 semanas       |
| P3         | Baixa - nice-to-have, melhoria incremental         | 1 mes           |

## Escala de Esforco

| Esforco | Significado           | Horas Estimadas |
|---------|-----------------------|-----------------|
| XS      | Muito pequeno         | < 1h            |
| S       | Pequeno               | 1-4h            |
| M       | Medio                 | 4-16h (1-2 dias)|
| L       | Grande                | 16-40h (1 semana)|
| XL      | Muito grande          | > 40h           |

---

## 1. Dashboards Faltantes a Criar

| # | Dashboard                           | Categoria       | Prioridade | Esforco | Impacto | Owner              | Status      |
|---|-------------------------------------|-----------------|------------|---------|---------|---------------------|-------------|
| 1 | SLO Overview (todos os servicos)    | Platform        | P1         | M       | Alto    | Platform Eng        | Nao iniciado|
| 2 | Incident Timeline                   | Platform        | P1         | L       | Alto    | SRE                 | Nao iniciado|
| 3 | Dependency Map                      | Platform        | P2         | L       | Alto    | Platform Eng        | Nao iniciado|
| 4 | Capacity Planning                   | Cost            | P2         | M       | Medio   | Platform Eng        | Nao iniciado|
| 5 | Database Performance (PostgreSQL)   | Backend         | P1         | M       | Alto    | Backend Eng         | Nao iniciado|
| 6 | Message Queue (Kafka/NATS)          | Backend         | P1         | M       | Alto    | Backend Eng         | Nao iniciado|
| 7 | Cache Performance (Redis)           | Backend         | P2         | S       | Medio   | Backend Eng         | Nao iniciado|
| 8 | Agent Cost & Token Usage            | AI Agents       | P1         | M       | Alto    | AI Eng              | Nao iniciado|
| 9 | Agent Quality Metrics               | AI Agents       | P1         | L       | Alto    | AI Eng              | Nao iniciado|
| 10| Patient Journey (end-to-end)        | Business        | P2         | L       | Alto    | Product Eng         | Nao iniciado|
| 11| Regulatory Compliance               | Business        | P1         | M       | Alto    | Product Eng         | Nao iniciado|
| 12| Error Budget Consumption            | Platform        | P1         | S       | Alto    | SRE                 | Nao iniciado|
| 13| On-call Dashboard                   | Platform        | P1         | M       | Alto    | SRE                 | Nao iniciado|
| 14| API Gateway (Ingress Detail)        | Platform        | P2         | M       | Medio   | Platform Eng        | Nao iniciado|
| 15| Observability Cost per Service      | Cost            | P3         | M       | Medio   | Platform Eng        | Nao iniciado|

### Detalhes dos Dashboards Prioritarios

**SLO Overview**
```
Descricao: Dashboard unificado mostrando todos os SLOs de todos os servicos.
  - Error budget restante por servico
  - Burn rate
  - SLO compliance (30d rolling)
  - Previsao de quando error budget zera
Justificativa: Fundamental para gestao proativa de confiabilidade.
Queries PromQL necessarias:
  - 1 - (sum(rate(http_requests_total{code=~"5.."}[30d])) / sum(rate(http_requests_total[30d])))
  - Burn rate: mesma query com window de 1h vs 5m
Datasources: Prometheus
Estimativa: 2 dias de trabalho
```

**Incident Timeline**
```
Descricao: Dashboard que mostra timeline de incidentes com correlacao de sinais.
  - Timeline de alertas disparados
  - Annotations de deploys
  - Graficos de impacto (error rate, latencia)
  - Log stream filtrado por periodo de incidente
Justificativa: Essencial para post-mortems e aprendizado.
Datasources: Prometheus, Loki, Grafana Annotations
Estimativa: 1 semana
```

**Agent Cost & Token Usage**
```
Descricao: Dashboard de custo e consumo de tokens dos agentes AI.
  - Tokens consumidos por agente por hora/dia
  - Custo estimado por agente (USD)
  - Custo por interacao com paciente
  - Comparativo entre provedores LLM
  - Tendencia de custo (projecao)
Justificativa: Controle de custo e um dos maiores desafios de agentes AI.
Datasources: Prometheus (metricas do LLM Gateway)
Estimativa: 2 dias
```

---

## 2. Dashboards Existentes para Melhorar

| # | Dashboard                     | Melhoria                                           | Prioridade | Esforco | Impacto | Owner              | Status      |
|---|-------------------------------|---------------------------------------------------|------------|---------|---------|---------------------|-------------|
| 1 | velya-patient-api             | Adicionar correlacao Prometheus -> Loki -> Tempo   | P1         | S       | Alto    | Backend Eng         | Nao iniciado|
| 2 | velya-patient-api             | Adicionar row de SLO com error budget              | P1         | S       | Alto    | Backend Eng         | Nao iniciado|
| 3 | velya-scheduling-api          | Adicionar metricas de fila de agendamento          | P1         | M       | Alto    | Backend Eng         | Nao iniciado|
| 4 | velya-agent-orchestrator      | Adicionar flame graph do Pyroscope                 | P2         | S       | Medio   | AI Eng              | Nao iniciado|
| 5 | velya-agent-orchestrator      | Adicionar metricas de timeout e retry              | P1         | S       | Alto    | AI Eng              | Nao iniciado|
| 6 | velya-frontend-vitals         | Separar Web Vitals por pagina/rota                 | P2         | M       | Medio   | Frontend Eng        | Nao iniciado|
| 7 | velya-platform-overview       | Adicionar status de ArgoCD inline                  | P2         | S       | Medio   | Platform Eng        | Nao iniciado|
| 8 | velya-kubernetes-cluster      | Adicionar metricas de KEDA scaling events          | P2         | S       | Medio   | Platform Eng        | Nao iniciado|
| 9 | velya-billing-service         | Adicionar metricas de integracao com gateway pago  | P1         | M       | Alto    | Backend Eng         | Nao iniciado|
| 10| velya-integration-hub         | Adicionar metricas HL7 FHIR por tipo de mensagem  | P1         | M       | Alto    | Backend Eng         | Nao iniciado|
| 11| velya-patient-flow            | Adicionar projecao de demanda (ML-based)           | P3         | L       | Medio   | Product Eng         | Nao iniciado|
| 12| velya-clinical-quality        | Adicionar indicadores ANVISA                       | P1         | M       | Alto    | Product Eng         | Nao iniciado|
| 13| velya-llm-gateway             | Adicionar metricas por modelo e provedor            | P1         | S       | Alto    | AI Eng              | Nao iniciado|
| 14| velya-meta-prometheus         | Adicionar alertas de cardinalidade por metrica     | P2         | S       | Medio   | Platform Eng        | Nao iniciado|
| 15| velya-cloud-cost              | Adicionar breakdown de custo por servico           | P2         | M       | Medio   | Platform Eng        | Nao iniciado|

---

## 3. Paineis Quebrados para Corrigir

| # | Dashboard                     | Painel                        | Problema                           | Prioridade | Esforco | Owner              | Status      |
|---|-------------------------------|-------------------------------|-------------------------------------|------------|---------|---------------------|-------------|
| 1 | velya-frontend-errors         | Error by Component            | Metrica renomeada apos update OTel | P0         | XS      | Frontend Eng        | Identificado|
| 2 | velya-mobile-telemetry        | App Crash Rate                | Datasource desconfigurado          | P0         | XS      | Frontend Eng        | Identificado|
| 3 | velya-integration-hub         | HL7 Message Queue Depth       | Variavel $queue_name nao resolve   | P1         | XS      | Backend Eng         | Identificado|
| 4 | velya-agent-followup          | Follow-up Success Rate        | Transformacao join com campo errado| P1         | S       | AI Eng              | Identificado|
| 5 | velya-revenue-cycle           | Revenue by Department         | Time range alem da retencao        | P1         | XS      | Product Eng         | Identificado|
| 6 | velya-clinical-quality        | Readmission Rate              | Query com label inexistente        | P1         | S       | Product Eng         | Identificado|
| 7 | velya-resource-efficiency     | Pod Rightsizing Recs           | Library panel v2 com regressao     | P2         | XS      | Platform Eng        | Identificado|
| 8 | velya-rightsizing              | Cost Savings Projection       | Dados stale (scrape falhando)      | P2         | S       | Platform Eng        | Identificado|

---

## 4. Correlacoes Faltantes

| # | De (Datasource)    | Para (Datasource)   | Tipo de Correlacao                    | Prioridade | Esforco | Owner              | Status      |
|---|--------------------|----------------------|---------------------------------------|------------|---------|---------------------|-------------|
| 1 | Prometheus         | Loki                 | Metricas -> Logs (service context)    | P1         | S       | Platform Eng        | Nao iniciado|
| 2 | Loki               | Tempo                | Derived fields: traceID -> trace      | P1         | S       | Platform Eng        | Nao iniciado|
| 3 | Prometheus         | Tempo                | Exemplars -> trace detail             | P1         | S       | Platform Eng        | Nao iniciado|
| 4 | Tempo              | Pyroscope            | Trace span -> CPU profile             | P2         | S       | Platform Eng        | Nao iniciado|
| 5 | Prometheus         | Prometheus           | Service -> Dependencies (upstream)    | P2         | M       | Platform Eng        | Nao iniciado|
| 6 | Loki               | Loki                 | Error log -> related logs (context)   | P3         | S       | Platform Eng        | Nao iniciado|

---

## 5. Drilldowns Faltantes

| # | Dashboard Origem              | Drilldown Para                        | Tipo              | Prioridade | Esforco | Owner              | Status      |
|---|-------------------------------|---------------------------------------|-------------------|------------|---------|---------------------|-------------|
| 1 | Platform Overview             | Dashboard de cada servico             | Data link         | P1         | S       | Platform Eng        | Nao iniciado|
| 2 | Kubernetes Cluster            | Node detail (por node)                | Data link         | P2         | S       | Platform Eng        | Nao iniciado|
| 3 | Patient API                   | Endpoint detail (por rota HTTP)       | Data link         | P1         | M       | Backend Eng         | Nao iniciado|
| 4 | Agent Orchestrator            | Detail por agente individual          | Data link         | P1         | M       | AI Eng              | Nao iniciado|
| 5 | Patient Flow                  | Detail por departamento               | Data link         | P2         | M       | Product Eng         | Nao iniciado|
| 6 | Cloud Cost                    | Cost por servico/namespace            | Data link         | P2         | M       | Platform Eng        | Nao iniciado|
| 7 | Qualquer painel de erro       | Explore com logs filtrados            | Data link         | P1         | S       | Platform Eng        | Nao iniciado|
| 8 | Qualquer painel de latencia   | Explore com traces filtrados          | Data link         | P1         | S       | Platform Eng        | Nao iniciado|

---

## 6. Alertas Faltantes

| # | Dashboard Relacionado         | Alerta Necessario                           | Severidade | Prioridade | Esforco | Owner              | Status      |
|---|-------------------------------|---------------------------------------------|------------|------------|---------|---------------------|-------------|
| 1 | velya-patient-api             | SLO burn rate > 1 (1h window)               | Critical   | P1         | S       | SRE                 | Nao iniciado|
| 2 | velya-scheduling-api          | Agendamentos falhando > 5%                  | Critical   | P1         | S       | Backend Eng         | Nao iniciado|
| 3 | velya-agent-orchestrator      | Timeout de agente > 10% das requests        | Warning    | P1         | S       | AI Eng              | Nao iniciado|
| 4 | velya-llm-gateway             | LLM provider error rate > 5%                | Critical   | P1         | S       | AI Eng              | Nao iniciado|
| 5 | velya-llm-gateway             | Token cost por hora > threshold             | Warning    | P2         | S       | AI Eng              | Nao iniciado|
| 6 | velya-integration-hub         | HL7 message processing lag > 5min           | Critical   | P1         | S       | Backend Eng         | Nao iniciado|
| 7 | velya-billing-service         | Payment processing failures > 1%            | Critical   | P1         | S       | Backend Eng         | Nao iniciado|
| 8 | velya-patient-flow            | Wait time > 2h sem atendimento              | Warning    | P1         | S       | Product Eng         | Nao iniciado|
| 9 | velya-clinical-quality        | Indicador critico fora do range             | Critical   | P1         | S       | Product Eng         | Nao iniciado|
| 10| velya-agent-guardrails        | Safety boundary violated                    | Critical   | P0         | S       | AI Eng              | Nao iniciado|

---

## 7. Melhorias de UX

| # | Escopo                          | Melhoria                                        | Prioridade | Esforco | Impacto | Owner              | Status      |
|---|--------------------------------|-------------------------------------------------|------------|---------|---------|---------------------|-------------|
| 1 | Global                         | Padronizar unidades em todos os dashboards       | P1         | M       | Alto    | Platform Eng        | Nao iniciado|
| 2 | Global                         | Adicionar descricao em todos os paineis criticos | P2         | M       | Medio   | Todos os owners     | Nao iniciado|
| 3 | Global                         | Padronizar thresholds (cores e valores)          | P2         | M       | Medio   | Platform Eng        | Nao iniciado|
| 4 | Global                         | Remover titulos "Panel Title" nao editados       | P1         | XS      | Alto    | Todos os owners     | Nao iniciado|
| 5 | Global                         | Adicionar annotations de deploy em tudo          | P2         | S       | Medio   | Platform Eng        | Nao iniciado|
| 6 | Backend dashboards             | Padronizar layout (golden signals no topo)       | P2         | M       | Medio   | Backend Eng         | Nao iniciado|
| 7 | AI Agent dashboards            | Adicionar comparacao temporal (vs ontem)         | P3         | M       | Medio   | AI Eng              | Nao iniciado|
| 8 | Business dashboards            | Melhorar cores para contexto hospitalar          | P3         | S       | Baixo   | Product Eng         | Nao iniciado|
| 9 | All service dashboards         | Adicionar row de logs colapsada                  | P2         | M       | Medio   | Todos os owners     | Nao iniciado|
| 10| Platform dashboards            | Unificar navegacao com menu de links             | P3         | S       | Medio   | Platform Eng        | Nao iniciado|

---

## 8. Library Panels para Criar

| # | Library Panel                   | Tipo          | Reutilizacao Esperada | Prioridade | Esforco | Owner              | Status      |
|---|--------------------------------|---------------|----------------------|------------|---------|---------------------|-------------|
| 1 | velya-slo-burn-rate            | Gauge + Stat  | 12 dashboards        | P1         | S       | Platform Eng        | Nao iniciado|
| 2 | velya-error-budget             | Stat          | 12 dashboards        | P1         | S       | Platform Eng        | Nao iniciado|
| 3 | velya-dependency-status        | State Timeline| 15 dashboards        | P2         | M       | Platform Eng        | Nao iniciado|
| 4 | velya-deployment-annotation    | Annotation    | 20+ dashboards       | P2         | S       | Platform Eng        | Nao iniciado|
| 5 | velya-llm-cost-summary         | Stat          | 7 dashboards         | P2         | S       | AI Eng              | Nao iniciado|
| 6 | velya-database-latency         | Time Series   | 8 dashboards         | P2         | S       | Backend Eng         | Nao iniciado|

---

## 9. Gaps de Documentacao

| # | Documentacao Necessaria                      | Prioridade | Esforco | Owner              | Status      |
|---|----------------------------------------------|------------|---------|---------------------|-------------|
| 1 | Runbook: Alta taxa de erro em qualquer API   | P1         | M       | SRE                 | Nao iniciado|
| 2 | Runbook: Degradacao de latencia              | P1         | M       | SRE                 | Nao iniciado|
| 3 | Runbook: Datasource indisponivel             | P1         | S       | Platform Eng        | Nao iniciado|
| 4 | Runbook: Agent timeout em cadeia             | P1         | M       | AI Eng              | Nao iniciado|
| 5 | Runbook: LLM provider down                   | P1         | M       | AI Eng              | Nao iniciado|
| 6 | Runbook: Integracao HL7/FHIR falhando        | P1         | M       | Backend Eng         | Nao iniciado|
| 7 | Guia: Como criar um novo dashboard Velya     | P2         | M       | Platform Eng        | Nao iniciado|
| 8 | Guia: Como usar Explore para investigacao    | P2         | S       | SRE                 | Nao iniciado|
| 9 | Guia: Como adicionar correlacoes             | P2         | S       | Platform Eng        | Nao iniciado|
| 10| Guia: Como criar recording rules             | P3         | S       | Platform Eng        | Nao iniciado|

---

## Resumo por Prioridade

| Prioridade | Total de Itens | Itens por Tipo                                    |
|------------|---------------|---------------------------------------------------|
| P0         | 3             | 2 paineis quebrados, 1 alerta faltante             |
| P1         | 42            | 5 dashboards, 12 melhorias, 8 paineis, 6 correlacoes, 5 alertas, 6 runbooks |
| P2         | 30            | 6 dashboards, 8 melhorias, 6 drilldowns, 4 UX, 4 library panels, 2 guias |
| P3         | 8             | 2 dashboards, 3 UX, 1 correlacao, 1 library panel, 1 guia |

---

## Progresso Geral

```
Total de itens no backlog: 83

+--------------------------------------------------+
| Nao iniciado:  79  [============================] 95%
| Em progresso:   0  [                            ]  0%
| Identificado:   4  [=                           ]  5%
| Concluido:      0  [                            ]  0%
+--------------------------------------------------+

Proximas acoes:
1. Resolver 3 itens P0 (paineis quebrados + alerta de safety)
2. Iniciar sprint de correlacoes (P1, 4 itens, 1 semana)
3. Criar SLO Overview dashboard (P1, 2 dias)
4. Criar dashboards de Database e Message Queue (P1, 1 semana)
5. Iniciar 6 runbooks P1 (distribuir entre owners)
```

---

## Retrospectiva e Revisao

| Frequencia | Acao                                              | Responsavel     |
|-----------|---------------------------------------------------|-----------------|
| Semanal   | Revisar itens P0/P1, atualizar status              | Platform Lead   |
| Quinzenal | Sprint planning de melhorias de dashboard          | All Leads       |
| Mensal    | Revisar backlog completo, repriorizar              | Platform Lead   |
| Trimestral| Revisao de arquitetura de dashboards               | All Leads + CTO |
