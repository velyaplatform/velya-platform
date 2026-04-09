# Arquitetura de Observabilidade — Velya Platform

> Documento mestre. Toda decisão de observabilidade segue os princípios aqui descritos.
> Última atualização: 2026-04-08 | Estado: Em evolução ativa

---

## 1. Princípios Fundamentais

Os 18 princípios abaixo são não-negociáveis. Toda decisão de instrumentação, dashboard ou alerta deve ser justificável contra ao menos um deles.

| #   | Princípio                                                 | Justificativa no contexto hospitalar                                             |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | **Observabilidade é requisito clínico**                   | Sistemas invisíveis não podem garantir segurança do paciente.                    |
| 2   | **Todo sinal deve ser acionável**                         | Dados sem ação são ruído. Cada métrica, log e trace deve conectar a uma decisão. |
| 3   | **Correlação entre sinais é obrigatória**                 | Métrica → Log → Trace → Runbook. Nenhum sinal vive isolado.                      |
| 4   | **Falhas silenciosas são as mais perigosas**              | O sistema que falha sem ruído é pior do que o que falha barulhento.              |
| 5   | **PHI nunca em logs, métricas ou traces**                 | Identificadores de paciente apenas tokenizados (patient_id, visit_id).           |
| 6   | **Observabilidade como código**                           | Tudo versionado em Git. Nada de dashboard manual sem rastreabilidade.            |
| 7   | **SLOs definem a operação, não alertas ad hoc**           | A pergunta é: "estamos dentro do SLO?" não "haverá alerta?".                     |
| 8   | **Cada serviço tem owner de observabilidade**             | Sem owner → sem responsabilidade → degradação invisível.                         |
| 9   | **Agents são cidadãos de primeira classe**                | A empresa digital deve ser tão observável quanto a infraestrutura.               |
| 10  | **Frontend é parte da cadeia clínica**                    | Atrito de UX em ambiente hospitalar tem impacto em tempo de resposta clínica.    |
| 11  | **Custo de observabilidade é monitorado**                 | Cardinalidade, volume de logs e traces têm custo real.                           |
| 12  | **Alertas têm severidade, dono e runbook**                | Alerta sem runbook não deve existir em produção.                                 |
| 13  | **Distributed tracing é mandatório para fluxos clínicos** | Não é opcional rastrear o caminho de uma decisão de alta ou alerta clínico.      |
| 14  | **Degraded mode é um estado explícito e monitorado**      | O sistema deve saber e comunicar quando está operando em modo degradado.         |
| 15  | **Retenção de dados de observabilidade é política**       | Logs: 30 dias dev, 90 dias prod. Métricas: 90 dias dev, 1 ano prod.              |
| 16  | **Revisão periódica obrigatória**                         | Dashboards, alertas e métricas têm ciclo de revisão de 90 dias.                  |
| 17  | **Stack OSS prioritária**                                 | Preferência por ferramentas open source para evitar lock-in e custo de licença.  |
| 18  | **Simplicidade acima de completude prematura**            | Melhor ter 10 métricas úteis do que 1000 métricas não consultadas.               |

---

## 2. Stack OSS Obrigatória

### 2.1 Componentes e Responsabilidades

| Componente             | Versão mínima | Sinal            | Responsabilidade                                           |
| ---------------------- | ------------- | ---------------- | ---------------------------------------------------------- |
| **Prometheus**         | 2.50+         | Métricas         | Coleta, storage e avaliação de regras                      |
| **Grafana OSS**        | 10.4+         | Visualização     | Dashboards, alerting, explore                              |
| **Loki**               | 3.0+          | Logs             | Indexação e query de logs estruturados                     |
| **Promtail**           | 3.0+          | Logs             | Agente de coleta de logs em cada nó                        |
| **Grafana Tempo**      | 2.4+          | Traces           | Distributed tracing backend (**a implementar**)            |
| **Grafana Alloy**      | 1.0+          | Agente universal | Substituto do OTel Collector + Promtail no futuro          |
| **OTel Collector**     | 0.97+         | Telemetria       | Gateway de telemetria atual (OTLP → Prometheus/Loki/Tempo) |
| **Grafana Pyroscope**  | 1.5+          | Profiling        | Profiling contínuo de CPU e memória (**futuro**)           |
| **kube-state-metrics** | 2.10+         | Métricas K8s     | Estado dos objetos Kubernetes                              |
| **node-exporter**      | 1.7+          | Métricas SO      | Métricas de sistema operacional dos nós                    |
| **KEDA**               | 2.13+         | Escalabilidade   | ScaledObjects com triggers Prometheus                      |

### 2.2 Não Utilizar (justificativa)

| Ferramenta                    | Motivo para não usar                                    |
| ----------------------------- | ------------------------------------------------------- |
| Datadog, New Relic, Dynatrace | Custo de licença e lock-in                              |
| Elasticsearch para logs       | Complexidade operacional e custo; Loki é suficiente     |
| Grafana Cloud (managed)       | Dado clínico não sai do cluster sem aprovação explícita |
| Jaeger standalone             | Substituído por Tempo na stack Grafana                  |

---

## 3. Diagrama da Arquitetura de Observabilidade

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         FONTES DE TELEMETRIA                                ║
╠══════════════╦══════════════╦══════════════╦══════════════╦══════════════════╣
║  Kubernetes  ║   Backend    ║   Frontend   ║    Agents    ║    Negócio       ║
║  (nós, pods, ║ (NestJS      ║  (Next.js    ║ (Temporal    ║  (patient-flow,  ║
║  namespaces) ║  serviços)   ║   Web Vitals)║  workers)    ║   discharge)     ║
╚══════╤═══════╩══════╤═══════╩══════╤═══════╩══════╤═══════╩═══════╤══════════╝
       │              │              │              │               │
       ▼              ▼              ▼              ▼               ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║                         CAMADA DE COLETA                                    ║
║                                                                              ║
║  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────────┐  ║
║  │  Promtail   │  │    OTel     │  │         Prometheus Scraping          │  ║
║  │ (DaemonSet) │  │  Collector  │  │  (kube-state-metrics, node-exporter, │  ║
║  │  /var/log   │  │(Deployment) │  │   /metrics endpoints dos serviços)   │  ║
║  └──────┬──────┘  └──────┬──────┘  └─────────────────┬───────────────────┘  ║
╚═════════╪════════════════╪═══════════════════════════╪══════════════════════╝
          │                │                           │
          ▼                ▼                           ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║                         CAMADA DE STORAGE                                   ║
║                                                                              ║
║  ┌────────────┐   ┌────────────┐   ┌────────────────┐   ┌────────────────┐  ║
║  │    Loki    │   │   Tempo    │   │   Prometheus   │   │   Pyroscope    │  ║
║  │   (Logs)   │   │ (Traces)   │   │   (Métricas)   │   │  (Profiling)   │  ║
║  │            │   │ [PENDENTE] │   │                │   │   [FUTURO]     │  ║
║  └──────┬─────┘   └──────┬─────┘   └───────┬────────┘   └───────┬────────┘  ║
╚═════════╪════════════════╪═════════════════╪════════════════════╪═══════════╝
          │                │                 │                    │
          └────────────────┴────────┬────────┘                    │
                                    ▼                             │
╔══════════════════════════════════════════════════════════════════════════════╗
║                         CAMADA DE ANÁLISE                                   ║
║                                                                              ║
║  ┌─────────────────────────────────────────────────────────────────────┐    ║
║  │                        Grafana OSS                                  │    ║
║  │                                                                     │    ║
║  │  Explore │ Dashboards │ Alerting │ Correlações │ Annotations        │    ║
║  │                                                                     │    ║
║  │  Datasources: Prometheus | Loki | Tempo* | Pyroscope*               │    ║
║  └─────────────────────────────────────────────────────────────────────┘    ║
╚══════════════════════════════════════════════════════════════════════════════╝
          │
          ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║                         CAMADA DE AÇÃO                                      ║
║                                                                              ║
║  Slack (#velya-ops-critical, #velya-ops-high, #velya-ops-info)              ║
║  PagerDuty (apenas severity=critical, impacto em pacientes)                  ║
║  Email (relatórios diários)                                                  ║
║  Webhook (sistema de tickets — futuro)                                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

* = a implementar
```

---

## 4. Camadas de Telemetria

### 4.1 Camada de Infraestrutura

**Responsável**: node-exporter, kube-state-metrics, kubelet metrics

| Sinal                                     | Fonte              | Frequência de scrape |
| ----------------------------------------- | ------------------ | -------------------- |
| CPU/memória por nó                        | node-exporter      | 15s                  |
| Status de pods e deployments              | kube-state-metrics | 30s                  |
| Métricas de kubelet (volumes, containers) | kubelet            | 30s                  |
| Métricas do API server                    | kube-apiserver     | 30s                  |
| Estado de nós (conditions)                | kube-state-metrics | 30s                  |

### 4.2 Camada de Plataforma

**Responsável**: ArgoCD metrics, KEDA metrics, cert-manager

| Sinal                         | Fonte                           | Frequência de scrape |
| ----------------------------- | ------------------------------- | -------------------- |
| Estado de Applications ArgoCD | argocd-metrics                  | 30s                  |
| ScaledObjects KEDA            | keda-metrics-apiserver          | 30s                  |
| Renovação de certificados     | cert-manager                    | 60s                  |
| Eventos de secret rotation    | vault/external-secrets (futuro) | evento               |

### 4.3 Camada de Backend (Serviços Velya)

**Responsável**: Cada serviço NestJS expondo /metrics via prom-client

| Serviço                | Namespace          | Endpoint /metrics | ServiceMonitor |
| ---------------------- | ------------------ | ----------------- | -------------- |
| patient-flow-service   | velya-dev-core     | :3000/metrics     | **PENDENTE**   |
| task-inbox-service     | velya-dev-core     | :3000/metrics     | **PENDENTE**   |
| discharge-orchestrator | velya-dev-core     | :3000/metrics     | **PENDENTE**   |
| api-gateway            | velya-dev-platform | :3000/metrics     | **PENDENTE**   |
| ai-gateway             | velya-dev-agents   | :3000/metrics     | **PENDENTE**   |
| decision-log           | velya-dev-platform | :3000/metrics     | **PENDENTE**   |
| memory-service         | velya-dev-agents   | :3000/metrics     | **PENDENTE**   |
| policy-engine          | velya-dev-platform | :3000/metrics     | **PENDENTE**   |

### 4.4 Camada de Frontend

**Responsável**: velya-web (Next.js) via Web Vitals + OTel instrumentation

| Sinal                           | Método                     | Estado       |
| ------------------------------- | -------------------------- | ------------ |
| Core Web Vitals (LCP, CLS, INP) | web-vitals library         | **PENDENTE** |
| Route performance               | Next.js instrumentation.ts | **PENDENTE** |
| JavaScript errors               | Error boundary + OTel      | **PENDENTE** |
| Failed API calls                | fetch interceptor          | **PENDENTE** |
| User interaction metrics        | Instrumentação manual      | **PENDENTE** |

### 4.5 Camada de Agents e Empresa Digital

**Responsável**: Workers Temporal + instrumentação custom

| Sinal                | Tipo                  | Estado       |
| -------------------- | --------------------- | ------------ |
| Throughput por agent | Contador Prometheus   | **PENDENTE** |
| Taxa de validação    | Gauge Prometheus      | **PENDENTE** |
| Silêncio de agent    | Timestamp Prometheus  | **PENDENTE** |
| Handoff latency      | Histograma Prometheus | **PENDENTE** |
| Loop de correção     | Contador Prometheus   | **PENDENTE** |

### 4.6 Camada de Negócio Hospitalar

**Responsável**: Serviços de domínio expondo métricas de workflow

| Sinal                       | Tipo             | Estado       |
| --------------------------- | ---------------- | ------------ |
| Altas pendentes por status  | Gauge            | **PENDENTE** |
| Bloqueadores por tipo/idade | Gauge/Histograma | **PENDENTE** |
| Tarefas por prioridade/SLA  | Gauge            | **PENDENTE** |
| Capacidade de leitos        | Gauge            | **PENDENTE** |
| Latência de alerta clínico  | Histograma       | **PENDENTE** |

---

## 5. Estado Atual vs. Estado Alvo

### 5.1 O que está funcionando hoje

| Componente            | Estado      | Detalhes                                             |
| --------------------- | ----------- | ---------------------------------------------------- |
| kube-prometheus-stack | Funcionando | Instalado em velya-dev-observability                 |
| Grafana OSS           | Funcionando | ClusterIP 10.96.117.151:80 — apenas port-forward     |
| Prometheus            | Funcionando | ClusterIP 10.96.153.246:9090                         |
| Loki                  | Funcionando | ClusterIP — scraping via Promtail                    |
| Promtail              | Funcionando | DaemonSet em todos os nós                            |
| OTel Collector        | Instalado   | Sem destino de traces configurado (Tempo ausente)    |
| PrometheusRule        | Parcial     | 1 regra com 5 alertas básicos (velya-service-alerts) |
| KEDA                  | Funcionando | 5 ScaledObjects com Prometheus triggers              |
| PriorityClasses       | Funcionando | 5 classes configuradas                               |
| Alertmanager          | Instalado   | Sem contact points reais configurados                |

### 5.2 Estado Alvo (6 meses)

| Capacidade                                   | Estado Alvo  |
| -------------------------------------------- | ------------ |
| ServiceMonitors para todos os serviços Velya | Implementado |
| Grafana Tempo (distributed tracing)          | Implementado |
| Métricas de negócio/workflow clínico         | Implementado |
| Observabilidade de frontend (RUM)            | Implementado |
| Métricas de agents                           | Implementado |
| Grafana com Ingress                          | Implementado |
| Alertmanager com Slack + PagerDuty           | Implementado |
| Dashboards versionados em Git (35+)          | Implementado |
| SLOs definidos para serviços clínicos        | Implementado |
| Grafana Alloy substituindo OTel+Promtail     | Implementado |

---

## 6. Lacunas Críticas Atuais

### 6.1 Sem ServiceMonitors para serviços Velya

**Impacto**: Prometheus não scrapeaa nenhum serviço da Velya (patient-flow, task-inbox, discharge-orchestrator, api-gateway, ai-gateway, decision-log, memory-service, policy-engine). A observabilidade de backend é zero.

**Resolução necessária**: Criar `ServiceMonitor` CRDs para cada serviço e expor `/metrics` via prom-client em cada serviço NestJS.

### 6.2 Sem Grafana Tempo

**Impacto**: O OTel Collector está instalado mas não tem destino para traces. Nenhum trace é armazenado ou visualizável. Fluxos clínicos complexos (ex.: discharge workflow end-to-end) são completamente opacos.

**Resolução necessária**: Instalar Grafana Tempo no namespace velya-dev-observability, configurar OTel Collector para exportar traces para Tempo, configurar datasource no Grafana.

### 6.3 Sem métricas de negócio/workflow

**Impacto**: Não sabemos quantos pacientes estão aguardando alta, quantos bloqueadores existem, qual a idade dos bloqueadores, qual a profundidade da fila de tarefas por prioridade. A operação clínica é invisível.

**Resolução necessária**: Implementar exportação de métricas de negócio nos serviços patient-flow-service e discharge-orchestrator.

### 6.4 Sem observabilidade de frontend

**Impacto**: velya-web (Next.js) é completamente opaco. Não sabemos se usuários estão enfrentando erros, lentidão ou abandono de fluxo. Em ambiente hospitalar, isso significa não detectar atrito que atrasa decisões clínicas.

**Resolução necessária**: Instrumentar velya-web com Web Vitals + OTel SDK.

### 6.5 Sem métricas de agents

**Impacto**: A empresa digital (agents Temporal) é completamente invisível. Não sabemos se agents estão silenciosos, em loop de correção ou com taxa de validação degradada.

**Resolução necessária**: Instrumentar workers Temporal com prom-client e expor métricas por agent_name/office.

### 6.6 Grafana sem Ingress

**Impacto**: Grafana só é acessível via `kubectl port-forward`. Em incidentes, o tempo de acesso ao dashboard aumenta. Não é possível compartilhar links de dashboard entre times.

**Resolução necessária**: Criar Ingress para Grafana no namespace velya-dev-observability (ou usar NodePort temporariamente no ambiente kind).

### 6.7 Alertmanager sem contatos reais

**Impacto**: Os 5 alertas existentes em velya-service-alerts disparam mas não chegam a ninguém. Alertas silenciosos são equivalentes a não ter alertas.

**Resolução necessária**: Configurar contact points (Slack webhook, PagerDuty integration key) no Alertmanager e definir notification policies.

---

## 7. Roadmap de Implementação

### Fase 1 — Visibilidade Mínima (Sprint 1-2, ~2 semanas)

| Prioridade | Item                                         | Esforço | Owner                |
| ---------- | -------------------------------------------- | ------- | -------------------- |
| P0         | ServiceMonitors para todos os serviços Velya | 1 dia   | Eng. Platform        |
| P0         | prom-client em todos os serviços NestJS      | 2 dias  | Eng. Backend         |
| P0         | Alertmanager com Slack webhook configurado   | 0.5 dia | Eng. Platform        |
| P0         | Grafana Ingress (ou NodePort para kind)      | 0.5 dia | Eng. Platform        |
| P1         | Dashboard API RED por serviço                | 1 dia   | Eng. Observabilidade |
| P1         | Dashboard Cluster Overview                   | 0.5 dia | Eng. Platform        |

### Fase 2 — Distributed Tracing (Sprint 3-4, ~2 semanas)

| Prioridade | Item                                        | Esforço | Owner         |
| ---------- | ------------------------------------------- | ------- | ------------- |
| P0         | Instalar Grafana Tempo                      | 1 dia   | Eng. Platform |
| P0         | Configurar OTel Collector → Tempo           | 0.5 dia | Eng. Platform |
| P1         | Instrumentação OTel em serviços NestJS      | 3 dias  | Eng. Backend  |
| P1         | Propagação de trace_id via NATS             | 1 dia   | Eng. Backend  |
| P1         | Instrumentação Next.js (instrumentation.ts) | 1 dia   | Eng. Frontend |

### Fase 3 — Observabilidade de Negócio e Agents (Sprint 5-6)

| Prioridade | Item                                                   | Esforço | Owner                  |
| ---------- | ------------------------------------------------------ | ------- | ---------------------- |
| P1         | Métricas de workflow clínico (discharge, patient-flow) | 3 dias  | Eng. Backend + Produto |
| P1         | Métricas de agents (throughput, validação, silêncio)   | 2 dias  | Eng. Agents            |
| P1         | Dashboard Patient Flow Command Board                   | 2 dias  | Eng. Observabilidade   |
| P1         | Dashboard Agent Oversight Console                      | 2 dias  | Eng. Observabilidade   |
| P2         | Métricas de frontend (RUM + Web Vitals)                | 2 dias  | Eng. Frontend          |

### Fase 4 — Maturidade e Profiling (Sprint 7-8)

| Prioridade | Item                                                 | Esforço | Owner                   |
| ---------- | ---------------------------------------------------- | ------- | ----------------------- |
| P2         | SLOs definidos e dashboards de SLO                   | 3 dias  | Eng. Platform + Produto |
| P2         | Instalar Grafana Pyroscope                           | 1 dia   | Eng. Platform           |
| P2         | Todos os dashboards do catálogo implementados        | 5 dias  | Eng. Observabilidade    |
| P2         | Observabilidade como código (todos artefatos no Git) | 2 dias  | Eng. Platform           |
| P3         | Migração OTel Collector + Promtail → Grafana Alloy   | 3 dias  | Eng. Platform           |

---

## 8. Referências

- [Catálogo de Dashboards](./dashboard-catalog.md)
- [Taxonomia de Métricas](./metrics-taxonomy.md)
- [Estratégia de Alerting](./alerting-strategy.md)
- [Padrão de Logging](./logging-standard.md)
- [Padrão de Distributed Tracing](./tracing-standard.md)
- [Registro de Lacunas](./monitoring-gaps-register.md)
- [Contratos de Telemetria](./telemetry-contracts.md)
