# Modelo de Self-Healing - Velya Platform

> Definicao do modelo de auto-cura em 3 tiers para a plataforma Velya:
> Infraestrutura, Aplicacao e Agentes.
> Classificacao: Interno | Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

Self-healing e a capacidade do sistema de detectar, diagnosticar e corrigir problemas
automaticamente, sem intervencao humana, dentro de limites de seguranca definidos.

O modelo opera em 3 tiers hierarquicos. Cada tier tem acoes permitidas, condicoes de
ativacao, limites, validacao pos-healing e rollback em caso de falha.

```
  +================================================================+
  |                    VELYA SELF-HEALING MODEL                     |
  +================================================================+
  |                                                                  |
  |  Tier 1: INFRAESTRUTURA (K8s Nativo + Extensoes)               |
  |  +---------------------------------------------------------+   |
  |  | Pod restart | Reschedule | Scale out | Eviction recovery |   |
  |  | Probe-based | Node failover | PDB enforcement            |   |
  |  +---------------------------------------------------------+   |
  |                         |                                        |
  |                         v                                        |
  |  Tier 2: APLICACAO (Logica de Negocio)                         |
  |  +---------------------------------------------------------+   |
  |  | Reconexao | Fallback | Retry c/ backoff | Circuit breaker|   |
  |  | Cache degradado | Queue replay | Graceful degradation    |   |
  |  +---------------------------------------------------------+   |
  |                         |                                        |
  |                         v                                        |
  |  Tier 3: AGENTES (IA e Coordenacao)                            |
  |  +---------------------------------------------------------+   |
  |  | Restart stateless | Quarentena | Reducao de permissoes   |   |
  |  | Coordinator swap | Budget reset | Fallback de provider   |   |
  |  +---------------------------------------------------------+   |
  |                                                                  |
  +================================================================+
```

---

## 2. Conceito de Healing Budget

Cada servico tem um **budget de healing** por hora. Isso previne:

- Healing loops (remediacao causa mais falhas que disparam mais remediacao)
- Mascaramento de problemas reais (reiniciar infinitamente esconde bugs)
- Exaustao de recursos (escalar sem parar)

```yaml
healing_budget:
  definition: |
    Numero maximo de acoes de healing permitidas por servico por hora.
    Quando o budget e esgotado, o sistema PARA de remediar e ESCALA
    para intervencao humana.

  formula: |
    budget_restante = budget_maximo - acoes_executadas_na_hora_atual

    Se budget_restante <= 0:
      - Bloquear todas as acoes de auto-healing para o servico
      - Disparar alerta VelyaHealingBudgetExhausted
      - Notificar on-call
      - Budget reseta na proxima hora cheia

  budgets:
    patient-flow:
      tier1_infrastructure: 10
      tier2_application: 15
      tier3_agents: 0 # nao e agente
      total: 25

    discharge-orchestrator:
      tier1_infrastructure: 10
      tier2_application: 15
      tier3_agents: 0
      total: 25

    ai-gateway:
      tier1_infrastructure: 8
      tier2_application: 10
      tier3_agents: 10
      total: 28

    agent-coordinator:
      tier1_infrastructure: 5
      tier2_application: 8
      tier3_agents: 10
      total: 23

    task-inbox:
      tier1_infrastructure: 10
      tier2_application: 15
      tier3_agents: 0
      total: 25

    velya-web:
      tier1_infrastructure: 8
      tier2_application: 5
      tier3_agents: 0
      total: 13

    notification-hub:
      tier1_infrastructure: 8
      tier2_application: 10
      tier3_agents: 0
      total: 18

  metric:
    name: velya_healing_actions_total
    type: counter
    labels: [service, tier, action_type, result]

  budget_metric:
    name: velya_healing_budget_remaining
    type: gauge
    labels: [service, tier]
```

---

## 3. Tier 1: Self-Healing de Infraestrutura

### 3.1 Acoes Permitidas

| Acao                     | Condicao                           | Limite                                   | Validacao Pos-Acao                |
| ------------------------ | ---------------------------------- | ---------------------------------------- | --------------------------------- |
| Pod restart (K8s nativo) | CrashLoopBackOff, OOMKilled        | Definido por restartPolicy + backoff K8s | Pod volta a Running + Ready       |
| Pod restart (forcado)    | Liveness probe falha               | 3 falhas consecutivas (failureThreshold) | Pod Running em < 2 min            |
| Reschedule de pod        | Node NotReady, pressao de recursos | PDB minAvailable respeitado              | Pod Ready em outro node           |
| Scale out (HPA)          | CPU > 70%, Memory > 75%            | maxReplicas do HPA                       | Novos pods Ready, saturacao reduz |
| Scale out (KEDA)         | Queue lag > threshold              | maxReplicaCount do ScaledObject          | Lag reduz em < 5 min              |
| Scale in (HPA/KEDA)      | Baixa utilizacao por > 5 min       | minReplicas respeitado                   | Servico sem degradacao            |
| Node drain (EKS managed) | Node unhealthy                     | 1 node por vez, PDB respeitado           | Pods realocados com sucesso       |

### 3.2 Configuracao Detalhada

```yaml
# Pod restart - configuracao K8s nativa
apiVersion: apps/v1 # via Rollout na pratica
spec:
  template:
    spec:
      restartPolicy: Always
      terminationGracePeriodSeconds: 30
      containers:
        - name: patient-flow
          # K8s reinicia automaticamente com backoff:
          # 10s, 20s, 40s, 80s, 160s, 300s (max 5 min)
          # Reset apos 10 min de execucao estavel
```

```yaml
# PodDisruptionBudget para todos os servicos criticos
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: patient-flow-pdb
  namespace: velya-dev-core
spec:
  minAvailable: 2 # sempre pelo menos 2 pods disponiveis
  selector:
    matchLabels:
      app.kubernetes.io/name: patient-flow
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: discharge-orchestrator-pdb
  namespace: velya-dev-core
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: discharge-orchestrator
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ai-gateway-pdb
  namespace: velya-dev-agents
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: ai-gateway
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: task-inbox-pdb
  namespace: velya-dev-core
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: task-inbox
```

```yaml
# VPA em modo recommendation (nao aplica automaticamente)
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: patient-flow-vpa
  namespace: velya-dev-core
spec:
  targetRef:
    apiVersion: argoproj.io/v1alpha1
    kind: Rollout
    name: patient-flow
  updatePolicy:
    updateMode: 'Off' # apenas recomendacao, nao aplica
  resourcePolicy:
    containerPolicies:
      - containerName: patient-flow
        minAllowed:
          cpu: 100m
          memory: 128Mi
        maxAllowed:
          cpu: 2000m
          memory: 2Gi
```

### 3.3 Rollback se Healing Falhar

```yaml
tier1_rollback:
  pod_restart_fails:
    condition: 'Pod nao volta a Ready em 120s apos restart'
    action: 'Tentar reschedule para outro node'
    if_reschedule_fails: 'Escalar para on-call'

  scale_out_fails:
    condition: 'Novos pods nao ficam Ready em 300s'
    action: 'Verificar se ha recursos no cluster (ResourceQuota, node capacity)'
    if_no_resources: 'Escalar para on-call para provisionar nodes'

  node_drain_fails:
    condition: 'Pods nao realocados em 600s'
    action: 'Cancelar drain, investigar PDB violations'
    escalation: 'On-call + infra team'
```

---

## 4. Tier 2: Self-Healing de Aplicacao

### 4.1 Acoes Permitidas

| Acao                     | Condicao                                    | Limite                                | Validacao Pos-Acao                            |
| ------------------------ | ------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| Reconexao automatica     | Conexao perdida (DB, NATS, Redis, Temporal) | 10 tentativas com backoff exponencial | Health check passando                         |
| Ativacao de fallback     | Dependencia indisponivel > 30s              | Duration maxima do fallback           | Servico respondendo (degradado)               |
| Circuit breaker recovery | CB em OPEN > timeout                        | 3 requests de teste                   | CB fecha se testes passam                     |
| Retry com backoff        | Operacao falhou por erro transitorio        | Max 5 retries, backoff max 30s        | Operacao completada                           |
| Cache degradado          | DB indisponivel                             | Enquanto DB nao voltar                | Dados servidos do cache (possivelmente stale) |
| Queue replay             | Consumer crashou durante processamento      | 1 replay por mensagem                 | Mensagem processada com sucesso               |

### 4.2 Implementacao: Reconexao

```typescript
// /services/shared/lib/resilience/reconnection-manager.ts

import { EventEmitter } from 'events';
import { Gauge, Counter } from 'prom-client';

interface ReconnectionConfig {
  serviceName: string;
  dependencyName: string;
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  jitter: boolean;
  healthCheck: () => Promise<boolean>;
  connect: () => Promise<void>;
}

const reconnectionAttempts = new Counter({
  name: 'velya_reconnection_attempts_total',
  help: 'Total de tentativas de reconexao',
  labelNames: ['service', 'dependency', 'result'],
});

const connectionStatus = new Gauge({
  name: 'velya_connection_status',
  help: 'Status da conexao (1=connected, 0=disconnected)',
  labelNames: ['service', 'dependency'],
});

export class ReconnectionManager extends EventEmitter {
  private retryCount = 0;
  private isReconnecting = false;

  constructor(private config: ReconnectionConfig) {
    super();
  }

  async onDisconnect(): Promise<void> {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    connectionStatus.set(
      { service: this.config.serviceName, dependency: this.config.dependencyName },
      0,
    );

    while (this.retryCount < this.config.maxRetries) {
      this.retryCount++;
      const backoff = this.calculateBackoff();

      console.log(
        `[Reconnection] ${this.config.dependencyName}: tentativa ${this.retryCount}/${this.config.maxRetries}, aguardando ${backoff}ms`,
      );

      await this.sleep(backoff);

      try {
        await this.config.connect();
        const healthy = await this.config.healthCheck();

        if (healthy) {
          reconnectionAttempts.inc({
            service: this.config.serviceName,
            dependency: this.config.dependencyName,
            result: 'success',
          });
          connectionStatus.set(
            { service: this.config.serviceName, dependency: this.config.dependencyName },
            1,
          );
          this.retryCount = 0;
          this.isReconnecting = false;
          this.emit('reconnected');
          return;
        }
      } catch (error) {
        reconnectionAttempts.inc({
          service: this.config.serviceName,
          dependency: this.config.dependencyName,
          result: 'failure',
        });
      }
    }

    // Max retries atingido
    this.isReconnecting = false;
    this.emit('reconnection_failed');
    console.error(
      `[Reconnection] ${this.config.dependencyName}: max retries (${this.config.maxRetries}) atingido. Marcando como unhealthy.`,
    );
  }

  private calculateBackoff(): number {
    const exponential = Math.min(
      this.config.initialBackoffMs * Math.pow(2, this.retryCount - 1),
      this.config.maxBackoffMs,
    );
    if (this.config.jitter) {
      return exponential * (0.5 + Math.random() * 0.5);
    }
    return exponential;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 4.3 Implementacao: Circuit Breaker

```typescript
// /services/shared/lib/resilience/circuit-breaker.ts

import { Gauge, Counter } from 'prom-client';

type CircuitState = 'closed' | 'half_open' | 'open';

const circuitBreakerState = new Gauge({
  name: 'velya_circuit_breaker_state',
  help: 'Estado do circuit breaker (0=closed, 1=half_open, 2=open)',
  labelNames: ['service', 'dependency'],
});

const circuitBreakerTrips = new Counter({
  name: 'velya_circuit_breaker_trips_total',
  help: 'Numero de vezes que o circuit breaker abriu',
  labelNames: ['service', 'dependency'],
});

interface CircuitBreakerConfig {
  serviceName: string;
  dependencyName: string;
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  constructor(private config: CircuitBreakerConfig) {
    this.updateMetric();
  }

  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.config.timeoutMs) {
        this.transition('half_open');
      } else {
        if (fallback) return fallback();
        throw new Error(`Circuit breaker OPEN for ${this.config.dependencyName}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback && this.state === 'open') return fallback();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half_open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transition('closed');
      }
    }
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.config.failureThreshold) {
      this.transition('open');
      circuitBreakerTrips.inc({
        service: this.config.serviceName,
        dependency: this.config.dependencyName,
      });
    }
  }

  private transition(to: CircuitState): void {
    const from = this.state;
    this.state = to;
    this.successCount = 0;
    if (to === 'closed') this.failureCount = 0;
    this.updateMetric();
    this.config.onStateChange?.(from, to);
  }

  private updateMetric(): void {
    const stateValue = { closed: 0, half_open: 1, open: 2 }[this.state];
    circuitBreakerState.set(
      { service: this.config.serviceName, dependency: this.config.dependencyName },
      stateValue,
    );
  }
}
```

### 4.4 Rollback se Healing Falhar

```yaml
tier2_rollback:
  reconnection_fails:
    condition: 'Max retries atingido'
    action: 'Marcar servico como unhealthy (readiness fail)'
    result: 'Servico removido do pool do Service, trafego vai para pods saudaveis'

  fallback_exceeds_duration:
    condition: 'Fallback ativo por mais de max_fallback_duration'
    action: 'Escalar para on-call'
    result: 'Investigacao da dependencia primaria'

  circuit_breaker_stuck_open:
    condition: 'CB aberto por > 5 minutos'
    action: 'Alerta para on-call'
    result: 'Investigacao manual da dependencia'

  retry_max_exceeded:
    condition: 'Max retries atingido para operacao'
    action: 'Enviar mensagem para DLQ com contexto de erro'
    result: 'Mensagem preservada para reprocessamento futuro'
```

---

## 5. Tier 3: Self-Healing de Agentes

### 5.1 Acoes Permitidas

| Acao                        | Condicao                                        | Limite                                             | Validacao Pos-Acao                            |
| --------------------------- | ----------------------------------------------- | -------------------------------------------------- | --------------------------------------------- |
| Restart de agente stateless | Heartbeat stale > 90s                           | 3 restarts por hora                                | Heartbeat retoma, guardrails ativos           |
| Quarentena de agente        | Output invalido 3x, acesso nao autorizado 2x    | Ilimitado (mas requer review humano para reverter) | Agente isolado, nao recebe requests           |
| Reducao de permissoes       | Comportamento anomalo detectado                 | 1 reducao por hora (cada vez mais restritivo)      | Agente opera com permissoes reduzidas         |
| Coordinator swap            | Coordinator primario unhealthy                  | 1 swap por 30 minutos                              | Coordinator secundario assume                 |
| Provider fallback           | Provider de LLM indisponivel                    | Chain de fallback ate esgotar                      | Respostas sendo geradas por fallback provider |
| Token budget reset          | Budget diario esgotado por comportamento normal | 1 reset parcial (50% do budget) por dia            | Agente pode processar requests novamente      |

### 5.2 Implementacao: Agente Controller

```yaml
# CronJob que monitora e executa healing de agentes
apiVersion: batch/v1
kind: CronJob
metadata:
  name: velya-agent-healing-controller
  namespace: velya-dev-agents
  labels:
    app.kubernetes.io/name: agent-healing-controller
    app.kubernetes.io/component: controller
    velya.io/team: squad-ai
spec:
  schedule: '*/1 * * * *' # a cada minuto
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      activeDeadlineSeconds: 55 # termina antes do proximo ciclo
      backoffLimit: 0
      template:
        spec:
          serviceAccountName: agent-healing-controller
          restartPolicy: Never
          securityContext:
            runAsNonRoot: true
          containers:
            - name: controller
              image: ghcr.io/velya-platform/agent-healing-controller:latest
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 200m
                  memory: 256Mi
              securityContext:
                readOnlyRootFilesystem: true
                allowPrivilegeEscalation: false
              env:
                - name: PROMETHEUS_URL
                  value: 'http://prometheus.velya-dev-observability:9090'
                - name: NAMESPACE
                  value: 'velya-dev-agents'
                - name: HEALING_BUDGET_CONFIGMAP
                  value: 'healing-budget-state'
                - name: SLACK_WEBHOOK_URL
                  valueFrom:
                    secretRef:
                      name: velya-slack-webhook
                      key: url
              command:
                - /bin/sh
                - -c
                - |
                  #!/bin/sh
                  set -e

                  echo "=== Velya Agent Healing Controller - $(date -u) ==="

                  # 1. Verificar heartbeats stale
                  STALE_AGENTS=$(curl -s "$PROMETHEUS_URL/api/v1/query" \
                    --data-urlencode 'query=time() - velya_heartbeat_last_timestamp_seconds{namespace="velya-dev-agents"} > 90' \
                    | jq -r '.data.result[].metric.pod // empty')

                  for POD in $STALE_AGENTS; do
                    SERVICE=$(echo $POD | sed 's/-[a-z0-9]*-[a-z0-9]*$//')
                    
                    # Verificar budget
                    BUDGET=$(kubectl get configmap $HEALING_BUDGET_CONFIGMAP -n $NAMESPACE \
                      -o jsonpath="{.data.${SERVICE}_tier3_used}" 2>/dev/null || echo "0")
                    BUDGET_LIMIT=$(kubectl get configmap $HEALING_BUDGET_CONFIGMAP -n $NAMESPACE \
                      -o jsonpath="{.data.${SERVICE}_tier3_limit}" 2>/dev/null || echo "10")
                    
                    if [ "$BUDGET" -ge "$BUDGET_LIMIT" ]; then
                      echo "BUDGET ESGOTADO para $SERVICE. Escalando para humano."
                      curl -s -X POST "$SLACK_WEBHOOK_URL" \
                        -H 'Content-type: application/json' \
                        -d "{\"text\":\"ALERTA: Healing budget esgotado para $SERVICE. Agente $POD com heartbeat stale. Acao manual necessaria.\"}"
                      continue
                    fi
                    
                    # Verificar se ja esta quarentinado
                    QUARANTINED=$(kubectl get pod $POD -n $NAMESPACE \
                      -o jsonpath='{.metadata.labels.velya\.io/quarantined}' 2>/dev/null || echo "false")
                    
                    if [ "$QUARANTINED" = "true" ]; then
                      echo "$POD ja esta quarentinado. Pulando."
                      continue
                    fi
                    
                    echo "Reiniciando agente stale: $POD"
                    kubectl delete pod $POD -n $NAMESPACE --grace-period=15
                    
                    # Incrementar budget usado
                    NEW_BUDGET=$((BUDGET + 1))
                    kubectl patch configmap $HEALING_BUDGET_CONFIGMAP -n $NAMESPACE \
                      --type merge -p "{\"data\":{\"${SERVICE}_tier3_used\":\"$NEW_BUDGET\"}}"
                    
                    echo "Restart executado. Budget: $NEW_BUDGET/$BUDGET_LIMIT"
                  done

                  # 2. Verificar agentes em loop
                  LOOPING_AGENTS=$(curl -s "$PROMETHEUS_URL/api/v1/query" \
                    --data-urlencode 'query=velya_agent_repeated_output_count{namespace="velya-dev-agents"} > 5' \
                    | jq -r '.data.result[].metric.pod // empty')

                  for POD in $LOOPING_AGENTS; do
                    echo "Quarentinando agente em loop: $POD"
                    kubectl label pod $POD -n $NAMESPACE \
                      velya.io/quarantined=true \
                      velya.io/quarantine-reason=output-loop \
                      --overwrite
                    
                    curl -s -X POST "$SLACK_WEBHOOK_URL" \
                      -H 'Content-type: application/json' \
                      -d "{\"text\":\"QUARENTENA: Agente $POD quarentinado por loop de output. Review manual necessario para restaurar.\"}"
                  done

                  # 3. Verificar guardrails
                  NO_GUARDRAILS=$(curl -s "$PROMETHEUS_URL/api/v1/query" \
                    --data-urlencode 'query=velya_ai_guardrails_active{namespace="velya-dev-agents"} == 0' \
                    | jq -r '.data.result[].metric.pod // empty')

                  for POD in $NO_GUARDRAILS; do
                    echo "CRITICO: Agente $POD sem guardrails ativos. Quarentinando."
                    kubectl label pod $POD -n $NAMESPACE \
                      velya.io/quarantined=true \
                      velya.io/quarantine-reason=no-guardrails \
                      --overwrite
                    
                    curl -s -X POST "$SLACK_WEBHOOK_URL" \
                      -H 'Content-type: application/json' \
                      -d "{\"text\":\"CRITICO: Agente $POD quarentinado - guardrails INATIVOS. Investigacao IMEDIATA necessaria.\"}"
                  done

                  echo "=== Healing cycle completo ==="
```

### 5.3 ConfigMap de Estado do Budget

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: healing-budget-state
  namespace: velya-dev-agents
data:
  # Contadores de uso (resetados a cada hora pelo CronJob de reset)
  ai-gateway_tier3_used: '0'
  ai-gateway_tier3_limit: '10'
  agent-coordinator_tier3_used: '0'
  agent-coordinator_tier3_limit: '10'
  prompt-registry_tier3_used: '0'
  prompt-registry_tier3_limit: '5'

  # Timestamp do ultimo reset
  last_reset_timestamp: '2026-04-08T14:00:00Z'
```

### 5.4 CronJob de Reset de Budget

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: velya-healing-budget-reset
  namespace: velya-dev-agents
  labels:
    app.kubernetes.io/name: healing-budget-reset
    velya.io/team: squad-ai
spec:
  schedule: '0 * * * *' # a cada hora cheia
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 30
      backoffLimit: 1
      template:
        spec:
          serviceAccountName: healing-budget-controller
          restartPolicy: Never
          containers:
            - name: reset
              image: bitnami/kubectl:1.29
              resources:
                requests:
                  cpu: 50m
                  memory: 64Mi
                limits:
                  cpu: 100m
                  memory: 128Mi
              command:
                - /bin/sh
                - -c
                - |
                  echo "Resetando healing budget - $(date -u)"

                  kubectl patch configmap healing-budget-state -n velya-dev-agents \
                    --type merge -p '{
                      "data": {
                        "ai-gateway_tier3_used": "0",
                        "agent-coordinator_tier3_used": "0",
                        "prompt-registry_tier3_used": "0",
                        "last_reset_timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
                      }
                    }'

                  echo "Budget resetado com sucesso"
```

### 5.5 Coordinator Swap

```yaml
coordinator_swap:
  description: |
    Se o agent-coordinator primario fica unhealthy, o secundario assume.
    Temporal garante que workflows em andamento nao sao perdidos.

  conditions:
    - 'agent-coordinator primario com readiness falhando por > 60s'
    - 'agent-coordinator primario com heartbeat stale por > 90s'

  implementation:
    strategy: 'Active-passive com Temporal task queue'
    primary_task_queue: 'agent-coordinator-primary'
    secondary_task_queue: 'agent-coordinator-secondary'

    swap_procedure:
      1: 'Detectar primario unhealthy'
      2: 'Promover secundario para task queue primaria'
      3: 'Temporal redireciona workflows para secundario'
      4: 'Validar que secundario esta processando'
      5: 'Notificar on-call sobre swap'
      6: 'Investigar primario'

  limits:
    max_swaps_per_hour: 2
    min_time_as_primary: 15m # evita flip-flop

  rollback:
    condition: 'Secundario tambem fica unhealthy'
    action: 'Escalar para on-call. Ambos coordinators com problema.'
```

---

## 6. Fluxograma de Decisao de Self-Healing

```
  PROBLEMA DETECTADO
       |
       v
  Qual tier?
       |
       +-- Infraestrutura (pod crash, resource pressure, node issue)
       |   |
       |   v
       |   Budget Tier 1 disponivel?
       |   |
       |   +-- NAO --> Escalar para on-call
       |   |
       |   +-- SIM --> Acao e reversivel?
       |               |
       |               +-- SIM --> Executar acao
       |               |           |
       |               |           v
       |               |           Validacao pos-acao passou?
       |               |           |
       |               |           +-- SIM --> Registrar + continuar monitoramento
       |               |           |
       |               |           +-- NAO --> Tentar acao alternativa (se disponivel)
       |               |                       |
       |               |                       +-- Disponivel --> Executar alternativa
       |               |                       +-- Nao disponivel --> Escalar
       |               |
       |               +-- NAO --> Escalar para on-call
       |
       +-- Aplicacao (conexao perdida, dependencia indisponivel)
       |   |
       |   v
       |   Budget Tier 2 disponivel?
       |   |
       |   +-- NAO --> Escalar para on-call
       |   +-- SIM --> (mesmo fluxo de decisao)
       |
       +-- Agentes (heartbeat stale, loop, guardrails)
           |
           v
           Budget Tier 3 disponivel?
           |
           +-- NAO --> Escalar para on-call
           +-- SIM --> (mesmo fluxo de decisao, com quarentena como opcao)
```

---

## 7. Monitoramento do Self-Healing

### Metricas

```yaml
healing_metrics:
  - name: velya_healing_actions_total
    type: counter
    labels: [service, tier, action_type, result]
    description: 'Total de acoes de healing executadas'

  - name: velya_healing_duration_seconds
    type: histogram
    labels: [service, tier, action_type]
    description: 'Duracao das acoes de healing'
    buckets: [1, 5, 10, 30, 60, 120, 300]

  - name: velya_healing_budget_remaining
    type: gauge
    labels: [service, tier]
    description: 'Budget de healing restante'

  - name: velya_healing_escalations_total
    type: counter
    labels: [service, tier, reason]
    description: 'Total de escalacoes para humano'

  - name: velya_healing_effectiveness_ratio
    type: gauge
    labels: [service, tier]
    description: 'Proporcao de healings que resolveram o problema'
```

### Alertas

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-healing-alerts
  namespace: velya-dev-observability
spec:
  groups:
    - name: velya.healing
      rules:
        - alert: VelyaHealingBudgetExhausted
          expr: velya_healing_budget_remaining <= 0
          for: 0m
          labels:
            severity: critical
          annotations:
            summary: 'Healing budget esgotado para {{ $labels.service }} tier {{ $labels.tier }}'
            action: 'Auto-healing desativado. Investigacao manual necessaria.'

        - alert: VelyaHealingLoopDetected
          expr: |
            increase(velya_healing_actions_total{result="failure"}[30m]) > 5
            AND
            increase(velya_healing_actions_total{result="success"}[30m]) == 0
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: 'Healing loop detectado para {{ $labels.service }}'
            description: 'Multiplas tentativas de healing sem sucesso. Possivel problema sistematico.'

        - alert: VelyaHealingEffectivenessLow
          expr: |
            (
              increase(velya_healing_actions_total{result="success"}[1h])
              /
              increase(velya_healing_actions_total[1h])
            ) < 0.5
          for: 30m
          labels:
            severity: warning
          annotations:
            summary: 'Eficacia de healing abaixo de 50% para {{ $labels.service }}'
            description: 'Menos da metade das acoes de healing esta funcionando.'
```

---

## 8. CronJob de Monitoramento de Healing Events

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: velya-healing-monitor
  namespace: velya-dev-platform
  labels:
    app.kubernetes.io/name: healing-monitor
    velya.io/team: squad-platform
spec:
  schedule: '*/5 * * * *' # a cada 5 minutos
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 240
      backoffLimit: 0
      template:
        spec:
          serviceAccountName: healing-monitor
          restartPolicy: Never
          containers:
            - name: monitor
              image: ghcr.io/velya-platform/healing-monitor:latest
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 200m
                  memory: 256Mi
              env:
                - name: PROMETHEUS_URL
                  value: 'http://prometheus.velya-dev-observability:9090'
                - name: LOKI_URL
                  value: 'http://loki.velya-dev-observability:3100'
              command:
                - /bin/sh
                - -c
                - |
                  #!/bin/sh
                  echo "=== Velya Healing Monitor - $(date -u) ==="

                  # 1. Coletar eventos de healing dos ultimos 5 minutos
                  HEALING_EVENTS=$(curl -s "$PROMETHEUS_URL/api/v1/query" \
                    --data-urlencode 'query=increase(velya_healing_actions_total[5m]) > 0' \
                    | jq -r '.data.result[] | "\(.metric.service) \(.metric.tier) \(.metric.action_type) \(.metric.result) \(.value[1])"')

                  if [ -z "$HEALING_EVENTS" ]; then
                    echo "Nenhum evento de healing nos ultimos 5 minutos."
                    exit 0
                  fi

                  echo "Eventos de healing detectados:"
                  echo "$HEALING_EVENTS" | while read SERVICE TIER ACTION RESULT COUNT; do
                    echo "  $SERVICE | Tier $TIER | $ACTION | $RESULT | count=$COUNT"
                  done

                  # 2. Verificar se ha healing loops
                  LOOPS=$(curl -s "$PROMETHEUS_URL/api/v1/query" \
                    --data-urlencode 'query=increase(velya_healing_actions_total{result="failure"}[30m]) > 5' \
                    | jq -r '.data.result[].metric.service // empty')

                  if [ -n "$LOOPS" ]; then
                    echo "ALERTA: Healing loop detectado para: $LOOPS"
                  fi

                  # 3. Verificar budgets
                  LOW_BUDGETS=$(curl -s "$PROMETHEUS_URL/api/v1/query" \
                    --data-urlencode 'query=velya_healing_budget_remaining < 3' \
                    | jq -r '.data.result[] | "\(.metric.service) tier=\(.metric.tier) remaining=\(.value[1])"')

                  if [ -n "$LOW_BUDGETS" ]; then
                    echo "AVISO: Budgets baixos:"
                    echo "$LOW_BUDGETS"
                  fi

                  # 4. Gerar relatorio consolidado para Loki
                  REPORT=$(cat <<REPORT_EOF
                  {
                    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
                    "type": "healing_monitor_report",
                    "events_count": $(echo "$HEALING_EVENTS" | wc -l),
                    "loops_detected": $([ -n "$LOOPS" ] && echo "true" || echo "false"),
                    "low_budgets": $([ -n "$LOW_BUDGETS" ] && echo "true" || echo "false")
                  }
                  REPORT_EOF
                  )

                  echo "Relatorio: $REPORT"
                  echo "=== Monitor completo ==="
```

---

## 9. ServiceAccount e RBAC para Controllers

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: agent-healing-controller
  namespace: velya-dev-agents
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: agent-healing-controller
  namespace: velya-dev-agents
rules:
  - apiGroups: ['']
    resources: ['pods']
    verbs: ['get', 'list', 'delete']
  - apiGroups: ['']
    resources: ['pods']
    verbs: ['patch']
    # Apenas para adicionar labels de quarentena
  - apiGroups: ['']
    resources: ['configmaps']
    verbs: ['get', 'patch']
    resourceNames: ['healing-budget-state']
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: agent-healing-controller
  namespace: velya-dev-agents
subjects:
  - kind: ServiceAccount
    name: agent-healing-controller
    namespace: velya-dev-agents
roleRef:
  kind: Role
  name: agent-healing-controller
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: healing-budget-controller
  namespace: velya-dev-agents
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: healing-budget-controller
  namespace: velya-dev-agents
rules:
  - apiGroups: ['']
    resources: ['configmaps']
    verbs: ['get', 'patch']
    resourceNames: ['healing-budget-state']
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: healing-budget-controller
  namespace: velya-dev-agents
subjects:
  - kind: ServiceAccount
    name: healing-budget-controller
    namespace: velya-dev-agents
roleRef:
  kind: Role
  name: healing-budget-controller
  apiGroup: rbac.authorization.k8s.io
```

---

## 10. Documentos Relacionados

| Documento                          | Descricao                                 |
| ---------------------------------- | ----------------------------------------- |
| `layered-assurance-model.md`       | Modelo completo (L7 = Remediation)        |
| `auto-remediation-safety-model.md` | Limites de seguranca para auto-remediacao |
| `runtime-integrity-model.md`       | Metricas e alertas que disparam healing   |
| `progressive-delivery-strategy.md` | Rollback via Argo Rollouts                |
| `kubernetes-policy-guardrails.md`  | Politicas de admission                    |
