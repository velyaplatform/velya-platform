# Arquitetura Central: Nada Critico Pode Depender de Alguem Lembrar

> **Principio fundador**: Se um processo critico depende de alguem lembrar de fazer algo,
> ele vai falhar. A unica questao e quando.

## Visao Geral

Este documento descreve a arquitetura central do mecanismo autonomo da plataforma Velya.
O objetivo e eliminar completamente a dependencia de memoria manual para qualquer operacao
critica — deploy, monitoramento, validacao, remediacao, aprendizado e melhoria continua.

### Pergunta Obrigatoria

Antes de aprovar qualquer processo, fluxo ou checklist, a seguinte pergunta deve ser feita:

> **"Por que isso ainda depende de alguem lembrar?"**

Se a resposta nao for "nao depende", o processo deve ser automatizado antes de entrar em producao.

---

## Diagrama da Arquitetura

```
+------------------------------------------------------------------+
|                    VELYA AUTONOMOUS PLATFORM                      |
+------------------------------------------------------------------+
|                                                                    |
|  +-----------+   +-----------+   +-----------+   +-----------+    |
|  | Control   |   | Scheduled |   | Event     |   | Durable   |    |
|  | Loops     |   | Checks    |   | Driven    |   | Workflows |    |
|  | (30s-5m)  |   | (5m-24h)  |   | (instant) |   | (saga)    |    |
|  +-----+-----+   +-----+-----+   +-----+-----+   +-----+-----+    |
|        |               |               |               |           |
|        v               v               v               v           |
|  +------------------------------------------------------------------+
|  |                  EVENT BUS / NATS / K8s Events                   |
|  +------------------------------------------------------------------+
|        |               |               |               |           |
|        v               v               v               v           |
|  +-----------+   +-----------+   +-----------+   +-----------+    |
|  | Watchdog  |   | Validation|   | Remediation|  | Learning  |    |
|  | Agents    |   | Agents    |   | Engine     |  | Pipeline  |    |
|  | (8)       |   | (7)       |   |            |  |           |    |
|  +-----+-----+   +-----+-----+   +-----+-----+   +-----+-----+    |
|        |               |               |               |           |
|        v               v               v               v           |
|  +------------------------------------------------------------------+
|  |              OBSERVABILITY LAYER (Prometheus/Grafana)            |
|  +------------------------------------------------------------------+
|        |               |               |               |           |
|        v               v               v               v           |
|  +------------------------------------------------------------------+
|  |              META-OBSERVABILITY (Auto-Monitoramento)             |
|  +------------------------------------------------------------------+
|        |                                                           |
|        v                                                           |
|  +------------------------------------------------------------------+
|  |              BACKLOG AUTOMATICO DE MELHORIAS                    |
|  +------------------------------------------------------------------+
+------------------------------------------------------------------+
```

---

## Pilares da Arquitetura

### 1. Control Loops (Deteccao Continua)

Control loops sao processos que rodam continuamente em intervalos curtos,
detectando desvios entre o estado desejado e o estado real.

| Loop               | Intervalo | O que detecta                      |
|---------------------|-----------|-------------------------------------|
| Heartbeat           | 30s       | Servico vivo/morto                 |
| Stale State         | 1min      | Estado desatualizado               |
| Queue Depth         | 30s       | Filas acumulando                   |
| Endpoint Probe      | 1min      | Endpoint fora do ar                |
| Agent Liveness      | 2min      | Agent travado ou silencioso        |
| Drift Watcher       | 5min      | Configuracao divergente            |
| No-Data Detection   | 5min      | Metricas/logs pararam de chegar    |

### 2. Scheduled Checks (Validacao Periodica)

Checagens que rodam em intervalos mais longos, validando integridade e conformidade.

| Check                | Intervalo | O que valida                        |
|----------------------|-----------|--------------------------------------|
| Smoke Tests          | 5min      | Fluxos criticos funcionando          |
| Cert Renewal         | 1h        | Certificados proximos do vencimento  |
| Dashboard Validation | 15min     | Dashboards carregando com dados      |
| Data Freshness       | 5min      | Dados sendo atualizados              |
| Backup Validation    | Diario    | Backups integros e restauraveis      |
| Role Review          | Mensal    | Permissoes adequadas                 |

### 3. Event-Driven (Reacao Imediata)

Eventos que disparam acoes imediatas sem esperar o proximo ciclo de polling.

```yaml
# Exemplos de eventos que disparam acoes
events:
  - name: pod-crash-loop
    source: kubernetes
    action: restart-with-backoff
    max_retries: 3

  - name: certificate-expiring
    source: cert-manager
    action: trigger-renewal
    threshold: 7d

  - name: deploy-completed
    source: argocd
    action: run-validation-suite

  - name: error-rate-spike
    source: prometheus
    action: activate-circuit-breaker
    threshold: 5%

  - name: queue-overflow
    source: nats
    action: scale-consumer
    threshold: 1000
```

### 4. Durable Workflows (Processos Longos)

Workflows que sobrevivem a falhas e reinicializacoes, mantendo estado persistente.

```typescript
// Exemplo: Workflow de deploy completo
interface DeployWorkflow {
  id: string;
  stages: [
    'pre-validation',
    'deploy',
    'post-validation',
    'smoke-test',
    'canary-analysis',
    'promotion-or-rollback'
  ];
  currentStage: string;
  state: 'running' | 'paused' | 'failed' | 'completed';
  checkpoints: Map<string, WorkflowCheckpoint>;
  timeout: Duration;
  rollbackPolicy: RollbackPolicy;
}
```

---

## Catalogo: De Manual para Automatico

### Operacoes que eram manuais e agora sao automaticas

| # | O que era manual                        | Como e automatico agora                     | Mecanismo           |
|---|------------------------------------------|----------------------------------------------|----------------------|
| 1 | Verificar se servicos estao no ar       | Heartbeat loop 30s + alertas                | Control Loop         |
| 2 | Lembrar de renovar certificados         | cert-watchdog + auto-renewal                | Watchdog + Event     |
| 3 | Verificar se dashboards tem dados       | dashboard-validation 15min                  | Scheduled Check      |
| 4 | Reiniciar pod travado                   | Pod restart com backoff                     | Remediation          |
| 5 | Verificar filas acumulando              | queue-depth loop 30s                        | Control Loop         |
| 6 | Rodar smoke tests apos deploy           | deploy-completed event trigger              | Event-Driven         |
| 7 | Verificar drift de configuracao         | drift-watcher 5min                          | Control Loop         |
| 8 | Escalar servicos sob carga              | HPA + queue-based scaling                   | Event-Driven         |
| 9 | Validar fluxo do paciente               | synthetic-validation 5min                   | Scheduled Check      |
| 10| Verificar se metricas estao chegando    | no-data-detection 5min                      | Control Loop         |
| 11| Revisar backups                         | backup-validation diaria                    | Scheduled Check      |
| 12| Detectar regressoes                     | learning pipeline + fingerprint             | Durable Workflow     |
| 13| Criar tickets de melhoria               | automatic-improvement-backlog               | Event-Driven         |
| 14| Documentar incidentes                   | error-context capture automatico            | Durable Workflow     |
| 15| Verificar roles e permissoes            | role-review mensal                          | Scheduled Check      |
| 16| Monitorar latencia de endpoints         | endpoint-probe 1min                         | Control Loop         |
| 17| Verificar DNS e TLS                     | site-watchdog continuous                    | Watchdog             |
| 18| Detectar agents silenciosos             | agent-silence-watchdog 2min                 | Watchdog             |
| 19| Validar auth flows                      | auth-validation 5min                        | Validation Agent     |
| 20| Monitorar o proprio monitoramento       | meta-observability                          | Control Loop         |

---

## Componentes Principais

### Watchdog Agents (8)

Agentes que observam continuamente e alertam/remediam quando detectam anomalias.

1. **site-watchdog** — Disponibilidade, status, latencia, TLS, DNS
2. **flow-watchdog** — Fluxos criticos do paciente e operacionais
3. **dashboard-watchdog** — Dashboards carregando e com dados
4. **no-data-watchdog** — Metricas e logs chegando
5. **cert-watchdog** — Certificados validos e renovacao
6. **agent-silence-watchdog** — Agents respondendo e ativos
7. **queue-watchdog** — Filas dentro dos limites
8. **drift-watchdog** — Configuracao em conformidade

### Validation Agents (7)

Agentes que validam proativamente a corretude do sistema.

1. **release-validation** — Deploy correto e funcional
2. **runtime-validation** — Runtime saudavel em producao
3. **synthetic-validation** — Fluxos sinteticos end-to-end
4. **dashboard-validation** — Dashboards integros
5. **mobile-flow-validation** — Fluxos mobile funcionando
6. **auth-validation** — Autenticacao e autorizacao
7. **observability-validation** — Observabilidade completa

### Remediation Engine

Motor de remediacao que executa acoes seguras automaticamente.

```typescript
interface RemediationAction {
  id: string;
  trigger: string;
  action: RemediationType;
  safety: {
    maxRetries: number;
    backoffMs: number;
    requiresRevalidation: boolean;
    rollbackOnFailure: boolean;
    destructive: false;  // NUNCA true para auto-remediacao
  };
  audit: {
    logAction: true;
    notifyChannel: string;
    requireApproval: boolean;
  };
}

type RemediationType =
  | 'restart-pod'
  | 'gitops-reconcile'
  | 'retry-bounded'
  | 'scale-out-temporary'
  | 'degraded-mode'
  | 'quarantine-agent'
  | 'cert-reissue';
```

### Learning Pipeline

Pipeline de aprendizado que transforma erros em melhorias automaticas.

```
Erro detectado
  |
  v
Fingerprint gerado (hash do erro + contexto)
  |
  v
Busca historico: "ja aconteceu antes?"
  |
  +-- Sim --> "por que voltou?" --> Regressao detectada
  |                                      |
  |                                      v
  |                              Guardrail sugerido
  |                              Teste sugerido
  |                              Alerta sugerido
  |
  +-- Nao --> Novo erro catalogado
                   |
                   v
              Contexto capturado
              Causa investigada
              Remediacao registrada
              Eficacia medida
```

---

## Principios de Design

### 1. Zero Trust em Memoria Humana

Nenhum processo critico depende de alguem lembrar. Tudo e:
- Automatizado via control loop, schedule ou evento
- Monitorado por watchdog
- Validado por validation agent
- Auditado automaticamente

### 2. Defense in Depth

Multiplas camadas de deteccao e protecao:

```
Camada 1: Control Loops (deteccao em segundos)
Camada 2: Watchdog Agents (correlacao e contexto)
Camada 3: Validation Agents (validacao proativa)
Camada 4: Remediation Engine (acao automatica segura)
Camada 5: Learning Pipeline (melhoria continua)
Camada 6: Meta-Observability (monitorar o monitoramento)
```

### 3. Fail-Safe por Default

```yaml
# Toda acao automatica segue este modelo
remediation_policy:
  default_action: alert  # Na duvida, alerta
  auto_remediate_only:
    - non_destructive: true
    - reversible: true
    - bounded_retries: true
    - revalidation_required: true
  never_auto_remediate:
    - data_mutation: true
    - iam_changes: true
    - production_data_access: true
    - cross_service_cascade: true
```

### 4. Observability All the Way Down

O mecanismo autonomo monitora a si mesmo:
- CronJobs falhando?
- Watchdogs silenciosos?
- Agents travados?
- Remediacao pendente?
- Aprendizado nao propagado?

---

## Configuracao Base

### Namespace Kubernetes

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: velya-autonomy
  labels:
    app.kubernetes.io/part-of: velya-platform
    velya.io/tier: autonomy
    velya.io/monitoring: enabled
```

### ConfigMap Global

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: autonomy-config
  namespace: velya-autonomy
data:
  HEARTBEAT_INTERVAL: "30s"
  STALE_STATE_THRESHOLD: "1m"
  QUEUE_DEPTH_INTERVAL: "30s"
  ENDPOINT_PROBE_INTERVAL: "1m"
  AGENT_LIVENESS_INTERVAL: "2m"
  DRIFT_WATCH_INTERVAL: "5m"
  NO_DATA_THRESHOLD: "5m"
  SMOKE_TEST_INTERVAL: "5m"
  CERT_CHECK_INTERVAL: "1h"
  DASHBOARD_CHECK_INTERVAL: "15m"
  DATA_FRESHNESS_INTERVAL: "5m"
  BACKUP_CHECK_INTERVAL: "24h"
  ROLE_REVIEW_INTERVAL: "720h"  # 30 dias
  REMEDIATION_MAX_RETRIES: "3"
  REMEDIATION_BACKOFF_BASE: "1000"
  LEARNING_PIPELINE_ENABLED: "true"
  META_OBSERVABILITY_ENABLED: "true"
  ALERT_CHANNEL: "#velya-autonomy-alerts"
  ESCALATION_CHANNEL: "#velya-ops-escalation"
```

---

## Decisao Tree: Automatizar ou Nao?

```
Processo identificado
  |
  v
E critico para a plataforma?
  |
  +-- Nao --> Documentar, monitorar passivamente
  |
  +-- Sim --> Depende de alguem lembrar?
                |
                +-- Nao --> Validar automacao existente
                |             |
                |             v
                |           Automacao funciona?
                |             |
                |             +-- Sim --> OK, adicionar meta-observability
                |             +-- Nao --> Corrigir automacao
                |
                +-- Sim --> AUTOMATIZAR IMEDIATAMENTE
                              |
                              v
                            Pode ser automatizado com seguranca?
                              |
                              +-- Sim --> Implementar control loop/watchdog
                              |            + validacao + remediacao segura
                              |
                              +-- Nao --> Implementar alerta automatico
                                           + runbook documentado
                                           + schedule de revisao
```

---

## Metricas do Mecanismo

| Metrica                              | Target         | Alerta se        |
|---------------------------------------|----------------|-------------------|
| % processos automatizados            | > 95%          | < 90%            |
| Tempo medio de deteccao              | < 60s          | > 120s           |
| Tempo medio de remediacao            | < 5min         | > 15min          |
| Taxa de falso positivo               | < 5%           | > 10%            |
| Taxa de falso negativo               | 0%             | > 0%             |
| Cobertura de meta-observability      | 100%           | < 100%           |
| Erros com aprendizado registrado     | 100%           | < 90%            |
| Itens manuais restantes              | < 5%           | > 10%            |

---

## Documentos Relacionados

| Documento                                | Descricao                                  |
|-------------------------------------------|--------------------------------------------|
| `control-loops-catalog.md`               | Catalogo detalhado de control loops        |
| `schedules-and-triggers-model.md`        | Modelo de schedules e triggers             |
| `watchdog-agents-catalog.md`             | Catalogo dos 8 watchdog agents             |
| `validation-agents-catalog.md`           | Catalogo dos 7 validation agents           |
| `remediation-safety-model.md`            | Modelo de remediacao segura                |
| `automatic-learning-from-errors.md`      | Pipeline de aprendizado automatico         |
| `automatic-improvement-backlog.md`       | Backlog automatico de melhorias            |
| `site-and-flow-monitoring-model.md`      | Monitoramento de sites e fluxos            |
| `dashboard-validation-model.md`         | Validacao automatica de dashboards         |
| `manual-dependency-reduction-model.md`   | Reducao de dependencia manual              |
| `autonomous-observability-model.md`      | Observabilidade do mecanismo autonomo      |
