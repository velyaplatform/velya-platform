# Backlog Automatico de Melhorias

> **Principio**: Melhorias nao devem depender de alguem lembrar de criar um ticket.
> O sistema detecta oportunidades de melhoria e gera automaticamente itens no backlog
> com classificacao, prioridade e owner.

## Visao Geral

O backlog automatico e alimentado por deteccoes automaticas de problemas, padroes
recorrentes e gaps de qualidade. Cada deteccao gera um item no backlog com
classificacao completa.

```
+-----------------------+     +---------------------+     +------------------+
| Fontes de Deteccao    | --> | Classificacao       | --> | Backlog          |
| (watchdogs, validators|     | Automatica          |     | Priorizado       |
|  learning pipeline)   |     |                     |     |                  |
+-----------------------+     +---------------------+     +------------------+
                                                               |
                                                               v
                                                          +------------------+
                                                          | Acao             |
                                                          | (ticket, PR,    |
                                                          |  alerta, ADR)   |
                                                          +------------------+
```

---

## Fontes de Deteccao

### 1. Erro Recorrente

```yaml
trigger: recurring-error
description: "Mesmo erro detectado 3+ vezes em 7 dias"
detection:
  source: learning-pipeline
  condition: |
    SELECT fingerprint, COUNT(*) as count
    FROM errors
    WHERE timestamp > NOW() - INTERVAL '7 days'
    GROUP BY fingerprint
    HAVING COUNT(*) >= 3
backlog_item:
  title: "Erro recorrente: {error_type} em {component}"
  severity: high
  urgency: next-sprint
  category: reliability
  template: |
    ## Erro Recorrente Detectado

    **Fingerprint**: {fingerprint}
    **Componente**: {component}
    **Tipo**: {error_type}
    **Ocorrencias**: {count} nos ultimos 7 dias
    **Primeira ocorrencia**: {first_seen}
    **Ultima ocorrencia**: {last_seen}

    ### Contexto
    {error_context}

    ### Remediacoes Anteriores
    {previous_remediations}

    ### Sugestoes do Learning Pipeline
    - [ ] Guardrail: {suggested_guardrail}
    - [ ] Teste: {suggested_test}
    - [ ] Alerta: {suggested_alert}

    ### Criterio de Aceite
    - Erro nao recorre por 30 dias apos fix
    - Guardrail implementado
    - Teste de regressao adicionado
```

### 2. Regressao Detectada

```yaml
trigger: regression-detected
description: "Erro que ja foi corrigido voltou a acontecer"
detection:
  source: learning-pipeline
  condition: |
    Erro com fingerprint que tem fix registrado
    mas recorreu apos data do fix
backlog_item:
  title: "REGRESSAO: {error_type} em {component}"
  severity: critical
  urgency: immediate
  category: reliability
  labels: [regression, quality-gate]
  template: |
    ## Regressao Detectada

    **Fingerprint**: {fingerprint}
    **Fix anterior**: {previous_fix_date} por {previous_fix_author}
    **Regressao detectada**: {regression_date}

    ### O que faltou
    - Guardrail: {guardrail_status}
    - Teste de regressao: {test_status}
    - Alerta: {alert_status}

    ### Acao Imediata
    1. Reabrir fix original
    2. Adicionar teste de regressao
    3. Adicionar guardrail
    4. Investigar por que o fix foi revertido

    ### Precisa ADR?
    Sim, se o fix original era arquiteturalmente significativo.
```

### 3. Dashboard Sem Dados

```yaml
trigger: dashboard-no-data
description: "Dashboard tem paineis sem dados por mais de 1 hora"
detection:
  source: dashboard-watchdog
  condition: |
    Panel sem dados detectado por dashboard-watchdog
    em 4+ verificacoes consecutivas (15min cada = 1h)
backlog_item:
  title: "Dashboard '{dashboard_name}' com paineis sem dados"
  severity: medium
  urgency: next-sprint
  category: observability
  template: |
    ## Dashboard com Dados Ausentes

    **Dashboard**: {dashboard_name} ({dashboard_uid})
    **Paineis afetados**: {affected_panels}
    **Desde**: {no_data_since}

    ### Possiveis Causas
    - Query incorreta
    - Metrica nao sendo exportada
    - Datasource com problema
    - Variavel de template incorreta

    ### Verificacao
    - [ ] Query retorna dados no Prometheus
    - [ ] Metrica existe e esta sendo scraped
    - [ ] Datasource esta saudavel
    - [ ] Variaveis populadas corretamente
```

### 4. Rota Quebrada

```yaml
trigger: broken-route
description: "Endpoint retornando erro ou inacessivel"
detection:
  source: site-watchdog, endpoint-probe
  condition: |
    Endpoint retornando status >= 400 ou timeout
    em 3+ verificacoes consecutivas
backlog_item:
  title: "Rota quebrada: {method} {path} retornando {status}"
  severity: high
  urgency: immediate
  category: availability
```

### 5. Performance Degradada

```yaml
trigger: performance-degradation
description: "Latencia ou throughput fora do baseline"
detection:
  source: runtime-validation, synthetic-validation
  condition: |
    p99 latencia > 2x baseline por > 30min
    OU throughput < 50% baseline por > 30min
backlog_item:
  title: "Performance degradada em {component}: p99={latency}ms"
  severity: medium
  urgency: next-sprint
  category: performance
  template: |
    ## Performance Degradada

    **Componente**: {component}
    **Metrica**: {metric} = {current_value}
    **Baseline**: {baseline_value}
    **Degradacao**: {degradation_percentage}%
    **Desde**: {since}

    ### Metricas Relacionadas
    - CPU: {cpu_usage}%
    - Memory: {memory_usage}%
    - GC Pause: {gc_pause}ms/s
    - Connection Pool: {pool_usage}%
    - Queue Depth: {queue_depth}

    ### Correlacoes
    - Deploy recente: {recent_deploy}
    - Mudanca de carga: {load_change}
    - Dependencia degradada: {dependency_status}
```

### 6. Documentacao em Desacordo

```yaml
trigger: doc-mismatch
description: "Documentacao nao reflete o estado atual do sistema"
detection:
  source: drift-watchdog, validation-agents
  condition: |
    Configuracao real diverge do documentado
    OU endpoint documentado nao existe
    OU parametro documentado mudou
backlog_item:
  title: "Doc desatualizada: {doc_file} vs {actual_state}"
  severity: low
  urgency: next-sprint
  category: documentation
```

### 7. Step Manual Recorrente

```yaml
trigger: recurring-manual-step
description: "Operacao manual executada 3+ vezes em 30 dias"
detection:
  source: audit-log, runbook-execution-log
  condition: |
    SELECT operation, COUNT(*) as count
    FROM manual_operations
    WHERE timestamp > NOW() - INTERVAL '30 days'
    GROUP BY operation
    HAVING COUNT(*) >= 3
backlog_item:
  title: "Automatizar: {operation} (executado {count}x/mes)"
  severity: medium
  urgency: next-sprint
  category: automation
  template: |
    ## Operacao Manual Recorrente

    **Operacao**: {operation}
    **Frequencia**: {count} vezes nos ultimos 30 dias
    **Tempo medio**: {avg_duration} minutos
    **Executado por**: {operators}

    ### Custo da Operacao Manual
    - Tempo total gasto: {total_time} horas/mes
    - Risco de erro humano: {error_rate}%
    - Custo estimado: R$ {estimated_cost}/mes

    ### Proposta de Automacao
    - Tipo: {automation_type}
    - Esforco estimado: {effort}
    - ROI estimado: {roi} meses

    ### Quick Win?
    {is_quick_win}
```

---

## Classificacao Automatica

Cada item do backlog e classificado automaticamente nos seguintes eixos:

### Eixos de Classificacao

```typescript
interface BacklogItem {
  id: string;
  title: string;
  description: string;
  source: string;          // Qual deteccao gerou
  detectedAt: Date;

  // Classificacao
  severity: 'critical' | 'high' | 'medium' | 'low';
  urgency: 'immediate' | 'next-sprint' | 'next-quarter' | 'backlog';
  owner: string;           // Time responsavel
  area: 'reliability' | 'performance' | 'observability' | 'security' |
        'automation' | 'documentation' | 'compliance';
  risk: 'high' | 'medium' | 'low';
  impact: 'platform-wide' | 'multi-service' | 'single-service' | 'cosmetic';
  effort: 'small' | 'medium' | 'large' | 'epic';
  quickWin: boolean;       // Esforco small + impacto >= medium
  needsADR: boolean;       // Decisao arquitetural significativa

  // Tracking
  status: 'new' | 'triaged' | 'in-progress' | 'done' | 'wont-fix';
  createdAt: Date;
  triagedAt?: Date;
  assignedTo?: string;
  resolvedAt?: Date;
  linkedPR?: string;
  linkedADR?: string;
}
```

### Matriz de Prioridade

```
                    URGENCIA
              Immediate  Next-Sprint  Next-Quarter  Backlog
           +------------+------------+-------------+--------+
  Critical | P0 - AGORA | P1         | P2           | P3     |
           +------------+------------+-------------+--------+
S High     | P1         | P2         | P3           | P4     |
E          +------------+------------+-------------+--------+
V Medium   | P2         | P3         | P4           | P5     |
           +------------+------------+-------------+--------+
  Low      | P3         | P4         | P5           | P6     |
           +------------+------------+-------------+--------+
```

### Logica de Classificacao

```typescript
function classifyBacklogItem(detection: Detection): BacklogItem {
  // Severidade baseada no tipo de deteccao
  const severity = determineSeverity(detection);

  // Urgencia baseada no impacto e tendencia
  const urgency = determineUrgency(detection, severity);

  // Owner baseado na area afetada
  const owner = determineOwner(detection);

  // Area baseada no tipo
  const area = determineArea(detection);

  // Risk baseado em impacto potencial
  const risk = determineRisk(detection);

  // Impact baseado no blast radius
  const impact = determineImpact(detection);

  // Effort estimado
  const effort = estimateEffort(detection);

  // Quick win: esforco pequeno, impacto significativo
  const quickWin = effort === 'small' && (impact === 'platform-wide' || impact === 'multi-service');

  // Needs ADR: mudanca arquitetural
  const needsADR = area === 'reliability' && impact === 'platform-wide' && effort !== 'small';

  return {
    id: generateId(),
    title: generateTitle(detection),
    description: generateDescription(detection),
    source: detection.source,
    detectedAt: detection.timestamp,
    severity,
    urgency,
    owner,
    area,
    risk,
    impact,
    effort,
    quickWin,
    needsADR,
    status: 'new',
    createdAt: new Date(),
  };
}

function determineSeverity(detection: Detection): BacklogItem['severity'] {
  switch (detection.trigger) {
    case 'regression-detected': return 'critical';
    case 'broken-route': return 'high';
    case 'recurring-error': return 'high';
    case 'performance-degradation': return 'medium';
    case 'dashboard-no-data': return 'medium';
    case 'recurring-manual-step': return 'medium';
    case 'doc-mismatch': return 'low';
    default: return 'medium';
  }
}

function determineOwner(detection: Detection): string {
  const ownerMap: Record<string, string> = {
    'velya-api': 'backend-team',
    'velya-auth': 'security-team',
    'velya-patient-service': 'backend-team',
    'velya-medication-service': 'backend-team',
    'velya-mobile-bff': 'mobile-team',
    'velya-dashboard-bff': 'frontend-team',
    'grafana': 'platform-team',
    'prometheus': 'platform-team',
    'argocd': 'platform-team',
    'nats': 'platform-team',
  };

  return ownerMap[detection.component] ?? 'platform-team';
}
```

---

## Acoes Automaticas por Tipo

| Trigger                  | Acao Automatica                          | Destino          |
|--------------------------|-------------------------------------------|------------------|
| Erro recorrente          | Criar issue + sugerir guardrail          | GitHub Issues    |
| Regressao                | Criar issue P0 + notificar time          | GitHub Issues    |
| Dashboard sem dados      | Criar issue + tag observability          | GitHub Issues    |
| Rota quebrada            | Criar issue + alerta imediato            | GitHub Issues    |
| Performance degradada    | Criar issue + capturar metricas          | GitHub Issues    |
| Doc em desacordo         | Criar issue + sugerir correcao           | GitHub Issues    |
| Step manual recorrente   | Criar issue + estimar ROI automacao      | GitHub Issues    |

### Criacao Automatica de Issue

```typescript
async function createBacklogIssue(item: BacklogItem): Promise<string> {
  const labels = [
    `severity:${item.severity}`,
    `urgency:${item.urgency}`,
    `area:${item.area}`,
    `effort:${item.effort}`,
    item.quickWin ? 'quick-win' : null,
    item.needsADR ? 'needs-adr' : null,
    'auto-generated',
  ].filter(Boolean);

  const issue = await github.createIssue({
    owner: 'velya',
    repo: 'velya-platform',
    title: item.title,
    body: item.description,
    labels,
    assignees: item.assignedTo ? [item.assignedTo] : [],
  });

  emitMetric('backlog_item_created', {
    trigger: item.source,
    severity: item.severity,
    urgency: item.urgency,
    area: item.area,
    quickWin: String(item.quickWin),
  });

  return issue.html_url;
}
```

---

## Dashboard do Backlog

### Metricas Expostas

```yaml
metrics:
  - name: velya_backlog_items_total
    type: gauge
    labels: [severity, urgency, area, status]
    help: "Total de itens no backlog por classificacao"

  - name: velya_backlog_items_created_total
    type: counter
    labels: [trigger, severity]
    help: "Total de itens criados no backlog"

  - name: velya_backlog_items_resolved_total
    type: counter
    labels: [trigger, severity, resolution]
    help: "Total de itens resolvidos"

  - name: velya_backlog_age_seconds
    type: histogram
    labels: [severity]
    help: "Idade dos itens no backlog"

  - name: velya_backlog_quick_wins_open
    type: gauge
    help: "Quick wins ainda nao resolvidos"

  - name: velya_backlog_adrs_pending
    type: gauge
    help: "ADRs pendentes de criacao"

  - name: velya_backlog_time_to_triage_seconds
    type: histogram
    help: "Tempo entre criacao e triagem"

  - name: velya_backlog_time_to_resolution_seconds
    type: histogram
    labels: [severity]
    help: "Tempo entre criacao e resolucao"
```

### Alertas do Backlog

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: backlog-health
  namespace: velya-autonomy
spec:
  groups:
    - name: backlog-health
      rules:
        - alert: BacklogCriticalItemsNotTriaged
          expr: |
            velya_backlog_items_total{severity="critical", status="new"} > 0
            and
            time() - velya_backlog_item_created_timestamp{severity="critical", status="new"} > 3600
          labels:
            severity: warning
          annotations:
            summary: "Itens criticos no backlog sem triagem por mais de 1 hora"

        - alert: BacklogQuickWinsAccumulating
          expr: velya_backlog_quick_wins_open > 10
          labels:
            severity: info
          annotations:
            summary: "{{ $value }} quick wins pendentes no backlog"

        - alert: BacklogGrowing
          expr: |
            increase(velya_backlog_items_created_total[7d]) > 
            increase(velya_backlog_items_resolved_total[7d]) * 1.5
          labels:
            severity: warning
          annotations:
            summary: "Backlog crescendo: criacao 50% maior que resolucao"
```

---

## CronJob: Backlog Generator

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backlog-generator
  namespace: velya-autonomy
  labels:
    velya.io/pipeline: backlog
    velya.io/tier: autonomy
spec:
  schedule: "*/15 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 600
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: backlog-generator
              image: velya/autonomy-agent:latest
              command: ["node", "dist/pipelines/backlog-generator.js"]
              env:
                - name: GITHUB_TOKEN
                  valueFrom:
                    secretKeyRef:
                      name: github-token
                      key: token
                - name: GITHUB_REPO
                  value: "velya/velya-platform"
                - name: DEDUP_WINDOW
                  value: "7d"
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 200m
                  memory: 256Mi
          restartPolicy: OnFailure
```

---

## Deduplicacao

O gerador de backlog evita duplicatas verificando itens existentes.

```typescript
async function isDuplicate(item: BacklogItem): Promise<boolean> {
  // Buscar issues abertas com mesmo fingerprint
  const existingIssues = await github.searchIssues({
    repo: 'velya/velya-platform',
    query: `is:open label:auto-generated "${item.source}" in:body`,
  });

  for (const existing of existingIssues) {
    // Verificar similaridade do titulo
    const similarity = calculateSimilarity(item.title, existing.title);
    if (similarity > 0.8) {
      // Atualizar issue existente com nova ocorrencia
      await github.addComment(existing.number, 
        `Nova deteccao em ${new Date().toISOString()}:\n${item.description}`
      );
      return true;
    }
  }

  return false;
}
```

---

## Resumo de Triggers

| #  | Trigger                  | Severidade Default | Urgencia Default  | Area           |
|----|--------------------------|--------------------|-------------------|----------------|
| 1  | Erro recorrente          | High               | Next-Sprint       | Reliability    |
| 2  | Regressao                | Critical           | Immediate         | Reliability    |
| 3  | Dashboard sem dados      | Medium             | Next-Sprint       | Observability  |
| 4  | Rota quebrada            | High               | Immediate         | Availability   |
| 5  | Performance degradada    | Medium             | Next-Sprint       | Performance    |
| 6  | Doc em desacordo         | Low                | Next-Sprint       | Documentation  |
| 7  | Step manual recorrente   | Medium             | Next-Sprint       | Automation     |
