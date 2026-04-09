# Registro de Lacunas de Monitoramento — Velya Platform

> Análise honesta de todas as lacunas entre o estado atual e o estado alvo de observabilidade.
> Atualizar este registro sempre que uma lacuna for resolvida ou descoberta.
> Última atualização: 2026-04-08

---

## 1. Lacunas Críticas

Lacunas que impedem operação segura em ambiente clínico. Devem ser resolvidas antes de qualquer promoção para produção.

---

### GAP-001: Sem ServiceMonitors para serviços Velya

**Severidade**: Crítica
**Estado**: Aberto

**O que está faltando**: Nenhum dos 8 serviços Velya possui ServiceMonitor configurado. O Prometheus não scrapeou nenhum endpoint `/metrics` de serviços da plataforma.

**O que falha sem isso**:
- Alertas de error rate, latência e saturation não funcionam
- Nenhum dado de performance de API disponível no Grafana
- KEDA não tem dados de métricas de negócio para scaling de aplicação (apenas de infraestrutura via kube-state-metrics)
- Impossível detectar degradação de serviço antes que usuários reportem

**Serviços afetados**: patient-flow-service, task-inbox-service, discharge-orchestrator, api-gateway, ai-gateway, decision-log, memory-service, policy-engine

**Implementação necessária**:
1. Verificar que `/metrics` existe em cada serviço (adicionar prom-client se não existir)
2. Criar `ServiceMonitor` CRD para cada serviço
3. Adicionar label no `Service` K8s para o seletor do ServiceMonitor
4. Verificar no Prometheus `/targets` que os targets aparecem como `UP`

**Estimativa de esforço**: 2-3 dias (1 dia para prom-client em todos + 1 dia para ServiceMonitors + validação)
**Prioridade**: P0 — Bloqueia toda observabilidade de backend

---

### GAP-002: Sem Grafana Tempo (Distributed Tracing)

**Severidade**: Crítica
**Estado**: Aberto

**O que está faltando**: OTel Collector está instalado mas sem exportador de traces. Grafana Tempo não está instalado. Nenhum trace é coletado.

**O que falha sem isso**:
- Impossível diagnosticar latência alta end-to-end (qual serviço na cadeia está lento?)
- Impossível rastrear o caminho completo de uma decisão de alta médica
- O campo `trace_id` está nos logs mas não há traces correspondentes no backend
- Erros em fluxos distribuídos são difíceis de diagnosticar (saber que erro ocorreu vs. saber ONDE)

**Implementação necessária**:
1. Instalar Grafana Tempo via Helm em velya-dev-observability
2. Configurar OTel Collector para exportar traces para Tempo (OTLP → Tempo)
3. Configurar datasource Tempo no Grafana com correlação Loki
4. Instrumentar serviços NestJS com OTel SDK (ver tracing-standard.md)
5. Instrumentar Next.js com instrumentation.ts
6. Configurar propagação de trace_id via NATS

**Estimativa de esforço**: 5-7 dias (1 dia Tempo + 1 dia OTel Collector + 3-4 dias instrumentação de serviços)
**Prioridade**: P0 — Essencial para debugging de fluxos clínicos

---

### GAP-003: Sem métricas de negócio e workflow clínico

**Severidade**: Crítica
**Estado**: Aberto

**O que está faltando**: Nenhuma das métricas do namespace `velya_*` está implementada. As métricas de domínio (`velya_discharge_pending_total`, `velya_task_inbox_depth`, etc.) não existem.

**O que falha sem isso**:
- Impossível saber quantos pacientes estão aguardando alta agora
- Impossível detectar acúmulo de bloqueadores de alta antes de virar crise
- Impossível monitorar profundidade de inbox clínica
- O Patient Flow Command Board e Discharge Control Board não têm dados

**Implementação necessária**:
1. Implementar métricas em patient-flow-service: `velya_patient_flow_active_count`, `velya_patient_admission_duration_seconds`
2. Implementar métricas em discharge-orchestrator: `velya_discharge_pending_total`, `velya_discharge_blocker_age_seconds`, `velya_discharge_decision_to_discharge_seconds`
3. Implementar métricas em task-inbox-service: `velya_task_inbox_depth`, `velya_task_overdue_total`, `velya_task_inbox_unowned_total`
4. Ver taxonomia completa em metrics-taxonomy.md

**Estimativa de esforço**: 5 dias (design das queries de banco + implementação + testes)
**Prioridade**: P0 — Sem essas métricas, a plataforma é clinicamente invisível

---

### GAP-004: Sem observabilidade de frontend (velya-web completamente opaco)

**Severidade**: Crítica
**Estado**: Aberto

**O que está faltando**: Nenhuma instrumentação no velya-web (Next.js). Core Web Vitals, erros JavaScript, falhas de API e UX friction são completamente invisíveis.

**O que falha sem isso**:
- Impossível detectar degradação de UX antes que clínicos reportem problema
- Impossível medir impacto de deploys na experiência do usuário
- Não há diferenciação entre "serviço OK no backend" e "usuário tem experiência ruim"
- Erros de JavaScript em produção são silenciosos

**Impacto clínico**: Clínicos com UX degradada demoram mais para completar tarefas → atraso em cuidados → risco ao paciente.

**Implementação necessária**:
1. Instalar `web-vitals` library no velya-web
2. Criar `src/lib/metrics.ts` com envio OTLP
3. Implementar Web Vitals reporting (LCP, INP, CLS)
4. Implementar VelyaErrorBoundary com reporting
5. Implementar fetch interceptor para API failures
6. Ver frontend-observability-model.md para detalhes completos

**Estimativa de esforço**: 3-4 dias
**Prioridade**: P0 — Interface clínica sem monitoramento é risco

---

### GAP-005: Grafana sem Ingress

**Severidade**: Crítica (operacional)
**Estado**: Aberto

**O que está faltando**: Grafana está acessível apenas via `kubectl port-forward`. Não há Ingress ou NodePort configurado.

**O que falha sem isso**:
- Durante incidente, tempo para acessar dashboard aumenta (precisa de kubectl + port-forward)
- Impossível compartilhar links de dashboard (link usa localhost:3000)
- NOC não consegue ter tela de dashboard sempre aberta sem dependência de sessão kubectl
- Não é possível receber links de alertas que abram o dashboard diretamente

**Implementação necessária** (para kind-velya-local):
```yaml
# Opção 1: NodePort (mais simples para kind)
apiVersion: v1
kind: Service
metadata:
  name: grafana-nodeport
  namespace: velya-dev-observability
spec:
  type: NodePort
  selector:
    app.kubernetes.io/name: grafana
  ports:
    - port: 80
      targetPort: 3000
      nodePort: 30300
```

```bash
# Acessar: http://localhost:30300 (após kind port mapping)
```

**Estimativa de esforço**: 0.5 dia
**Prioridade**: P0 — Bloqueia uso operacional do Grafana

---

### GAP-006: Alertmanager sem contact points reais

**Severidade**: Crítica
**Estado**: Aberto

**O que está faltando**: Os 5 alertas existentes em `velya-service-alerts` disparam internamente no Prometheus mas não chegam a nenhum canal externo. Alertmanager não tem Slack webhook ou PagerDuty configurados.

**O que falha sem isso**:
- Todos os alertas atuais são silenciosos — disparam mas ninguém é notificado
- Alertas críticos não chegam a nenhuma pessoa
- Sistema de alerting existe mas não funciona operacionalmente

**Implementação necessária**:
1. Criar Secret K8s com Slack webhook URL (via ExternalSecret)
2. Configurar Alertmanager receivers (Slack, PagerDuty)
3. Configurar route (severidade → canal)
4. Testar com `amtool alert add` ou trigger manual

**Estimativa de esforço**: 1 dia
**Prioridade**: P0 — Alertas sem destinatário são inúteis

---

## 2. Lacunas Altas

Lacunas que impactam significativamente a operação, mas não impedem operação básica.

---

### GAP-007: Sem métricas de agents (empresa digital invisível)

**Severidade**: Alta
**Estado**: Aberto

**O que está faltando**: Nenhum worker Temporal ou agente da empresa digital expõe métricas Prometheus. A observabilidade dos agents é zero.

**O que falha sem isso**:
- Impossível detectar agent silencioso até que alguém perceba manualmente
- Impossível monitorar qualidade de saídas (validation pass rate)
- Impossível detectar loop de correção
- Agent Oversight Console não tem dados

**Implementação necessária**: Ver agent-observability-model.md — seção 3 (implementação completa com prom-client nos workers Temporal).

**Estimativa de esforço**: 3-4 dias
**Prioridade**: P1

---

### GAP-008: PrometheusRules existentes sem runbooks

**Severidade**: Alta
**Estado**: Aberto

**O que está faltando**: Os 5 alertas em `velya-service-alerts` existem mas não têm `runbook_url` nas annotations. Qualquer alerta que disparasse seria difícil de investigar.

**Alertas afetados**:
- VelyaServiceHighErrorRate (sem runbook)
- VelyaServiceHighLatency (sem runbook)
- VelyaServiceDown (sem runbook)
- VelyaDeploymentReplicasMismatch (sem runbook)
- VelyaJobFailed (sem runbook)

**Implementação necessária**:
1. Criar runbooks em `docs/observability/runbooks/` para cada alerta
2. Adicionar `runbook_url` nas annotations de cada alerta
3. Adicionar `initial_action` nas annotations

**Estimativa de esforço**: 1 dia
**Prioridade**: P1

---

### GAP-009: Sem correlação logs ↔ traces nos serviços NestJS

**Severidade**: Alta
**Estado**: Aberto (bloqueado pelo GAP-002 — requer Tempo)

**O que está faltando**: Mesmo quando `trace_id` é gerado (com OTel SDK), ele não é automaticamente injetado nos logs do VelyaLoggerService.

**Implementação necessária**: Adicionar leitura de span ativo ao logger (ver tracing-standard.md seção 9.1).

**Estimativa de esforço**: 0.5 dia (após GAP-002 resolvido)
**Prioridade**: P1

---

### GAP-010: Sem profiling contínuo (Pyroscope)

**Severidade**: Alta (para custo e performance)
**Estado**: Aberto — Fase Futura

**O que está faltando**: Nenhuma capacidade de profiling de CPU ou memória. Impossível identificar hotspots de CPU ou memory leaks.

**Implementação necessária**: Ver profiling-strategy.md.
**Estimativa de esforço**: 2 dias
**Prioridade**: P2 (fase futura)

---

## 3. Lacunas Médias

---

### GAP-011: Loki sem retenção configurada explicitamente

**Severidade**: Média
**Estado**: Aberto

**O que está faltando**: A política de retenção do Loki não está configurada explicitamente. Logs acumulam indefinidamente no PVC.

**Risco**: PVC do Loki encher sem aviso. Em ambiente dev com PVCs de tamanho limitado, isso pode quebrar a coleta de logs.

**Implementação necessária**:
```yaml
# Em loki-values.yaml
loki:
  storage:
    type: filesystem
  limits_config:
    retention_period: 168h  # 7 dias em dev
    max_query_length: 721h
  compactor:
    retention_enabled: true
    retention_delete_delay: 2h
```

**Estimativa de esforço**: 0.5 dia
**Prioridade**: P1

---

### GAP-012: OTel Collector sem sampling configurado

**Severidade**: Média
**Estado**: Aberto (parcialmente — Tempo não está instalado, então não há volume de traces ainda)

**Risco**: Quando Tempo for instalado, sem sampling configurado, 100% dos traces serão armazenados. Pode causar explosão de dados.

**Implementação necessária**: Configurar tail-based sampling conforme tracing-standard.md seção 3.2.

**Estimativa de esforço**: 0.5 dia
**Prioridade**: P1 (implementar junto com Tempo)

---

### GAP-013: Sem library panels padronizados

**Severidade**: Média
**Estado**: Aberto

**O que está faltando**: Sem library panels, cada dashboard implementa os mesmos componentes de forma diferente. Inconsistência visual e de métricas entre dashboards.

**Implementação necessária**: Criar os 6 library panels listados em grafana-oss-capabilities-matrix.md seção 2.8.

**Estimativa de esforço**: 1 dia
**Prioridade**: P2

---

### GAP-014: Sem annotation de deploys no Grafana

**Severidade**: Média
**Estado**: Aberto

**O que está faltando**: Deploys não são marcados como annotations nos dashboards. Impossível correlacionar visualmente "esse spike de erros começou logo após o deploy das 14h".

**Implementação necessária**:
```yaml
# Em .github/workflows/deploy.yaml — adicionar step após deploy
- name: Annotate Grafana deploy
  run: |
    curl -X POST http://grafana.velya-dev-observability/api/annotations \
      -H "Authorization: Bearer $GRAFANA_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"time\": $(date +%s000),
        \"tags\": [\"deploy\", \"service:${SERVICE_NAME}\", \"version:${VERSION}\"],
        \"text\": \"Deploy ${SERVICE_NAME} v${VERSION}\"
      }"
```

**Estimativa de esforço**: 0.5 dia
**Prioridade**: P2

---

## 4. Backlog Priorizado de Implementação

Lista ordenada de todos os itens de observabilidade a implementar.

| # | Item | Esforço | Bloqueia | Owner | Prioridade |
|---|------|---------|---------|-------|-----------|
| 1 | ServiceMonitors para todos os serviços | 2 dias | Todos os dashboards de backend | Eng. Platform | P0 |
| 2 | prom-client em todos os serviços NestJS | 1 dia | Item 1 | Eng. Backend | P0 |
| 3 | Alertmanager com Slack webhook | 1 dia | GAP-006 | Eng. Platform | P0 |
| 4 | Grafana NodePort (acesso sem port-forward) | 0.5 dia | GAP-005 | Eng. Platform | P0 |
| 5 | Dashboard velya-backend-api-red | 1 dia | Item 1 | Eng. Observabilidade | P0 |
| 6 | Dashboard velya-infra-cluster-overview | 0.5 dia | — | Eng. Observabilidade | P0 |
| 7 | Instalar Grafana Tempo | 1 dia | GAP-002 | Eng. Platform | P1 |
| 8 | Configurar OTel Collector → Tempo + sampling | 0.5 dia | Item 7 | Eng. Platform | P1 |
| 9 | Loki retenção configurada | 0.5 dia | GAP-011 | Eng. Platform | P1 |
| 10 | Métricas de workflow clínico (discharge, patient-flow) | 3 dias | GAP-003 | Eng. Backend | P1 |
| 11 | Métricas de Task Inbox | 2 dias | GAP-003 | Eng. Backend | P1 |
| 12 | Runbooks para 5 alertas existentes | 1 dia | GAP-008 | Eng. Observabilidade | P1 |
| 13 | Instrumentação OTel em serviços NestJS | 3 dias | Item 7 | Eng. Backend | P1 |
| 14 | Propagação de trace_id via NATS | 1 dia | Item 13 | Eng. Backend | P1 |
| 15 | Instrumentação Next.js (instrumentation.ts) | 1 dia | Item 7 | Eng. Frontend | P1 |
| 16 | Métricas de agents (workers Temporal) | 3 dias | GAP-007 | Eng. Agents | P1 |
| 17 | Dashboard Patient Flow Command Board | 2 dias | Item 10 | Eng. Observabilidade | P1 |
| 18 | Dashboard Agent Oversight Console | 2 dias | Item 16 | Eng. Observabilidade | P1 |
| 19 | Web Vitals + JS errors (frontend RUM) | 3 dias | GAP-004 | Eng. Frontend | P2 |
| 20 | PrometheusRules completas (57 alertas) | 3 dias | ServiceMonitors | Eng. Observabilidade | P2 |
| 21 | SLOs definidos para serviços clínicos | 2 dias | Item 1 | Eng. Platform + Produto | P2 |
| 22 | Todos os 35 dashboards do catálogo | 5 dias | Todos os items acima | Eng. Observabilidade | P2 |
| 23 | Library panels padronizados | 1 dia | GAP-013 | Eng. Observabilidade | P2 |
| 24 | Annotation de deploys no Grafana | 0.5 dia | GAP-014 | Eng. Platform | P2 |
| 25 | Migração OTel+Promtail → Grafana Alloy | 3 dias | — | Eng. Platform | P3 |

**Estimativa total para P0**: ~6 dias
**Estimativa total para P0+P1**: ~25 dias
**Estimativa total para P0+P1+P2**: ~42 dias
**Estimativa total para todos**: ~45 dias
