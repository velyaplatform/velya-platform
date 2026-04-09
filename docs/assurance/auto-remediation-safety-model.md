# Modelo de Seguranca para Auto-Remediacao - Velya Platform

> Define o que PODE e o que NAO PODE ser remediado automaticamente,
> com arvore de decisao, limites de blast radius e garantias de seguranca.
> Classificacao: Interno | Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

Auto-remediacao e a capacidade do sistema de corrigir problemas sem intervencao humana.
Este documento define os **limites de seguranca** para acoes automaticas, garantindo que
a remediacao nunca cause mais dano que o problema original.

### Principios de Seguranca

| Principio                  | Descricao                                             |
| -------------------------- | ----------------------------------------------------- |
| **Primum non nocere**      | A remediacao nao pode causar mais dano que o problema |
| **Reversibilidade**        | Toda acao automatica deve ser reversivel              |
| **Blast radius conhecido** | O impacto maximo da acao deve ser previsivel          |
| **Validacao pos-acao**     | Toda remediacao deve verificar se resolveu o problema |
| **Timeout obrigatorio**    | Toda acao tem prazo maximo; se nao resolveu, escala   |
| **Budget de healing**      | Numero maximo de remedicoes por hora por servico      |
| **Auditoria**              | Toda acao e registrada com contexto completo          |

---

## 2. Arvore de Decisao: Permitir ou Bloquear

```
  PROBLEMA DETECTADO
       |
       v
  [1] A acao proposta e REVERSIVEL?
       |
       +-- NAO --> BLOQUEAR. Escalar para humano.
       |           Exemplos: delete PVC, drop table, revoke credentials
       |
       +-- SIM --> [2] O BLAST RADIUS e conhecido e limitado?
                        |
                        +-- NAO --> BLOQUEAR. Escalar para humano.
                        |           Exemplos: scale down global, network policy change
                        |
                        +-- SIM --> [3] Existe VALIDACAO POS-ACAO definida?
                                        |
                                        +-- NAO --> BLOQUEAR. Implementar validacao primeiro.
                                        |           Nao remediar sem como verificar se funcionou.
                                        |
                                        +-- SIM --> [4] Existe TIMEOUT definido?
                                                        |
                                                        +-- NAO --> BLOQUEAR. Definir timeout primeiro.
                                                        |
                                                        +-- SIM --> [5] Existe ROLLBACK se a remediacao falhar?
                                                                        |
                                                                        +-- NAO --> BLOQUEAR.
                                                                        |
                                                                        +-- SIM --> [6] O BUDGET DE HEALING permite?
                                                                                        |
                                                                                        +-- NAO --> BLOQUEAR. Budget esgotado.
                                                                                        |           Escalar para humano.
                                                                                        |
                                                                                        +-- SIM --> PERMITIR auto-remediacao.
                                                                                                    Executar com logging completo.
```

### Diagrama compacto:

```
  REVERSIVEL? --NAO--> BLOQUEAR
       |
      SIM
       |
  BLAST RADIUS CONHECIDO? --NAO--> BLOQUEAR
       |
      SIM
       |
  VALIDACAO POS-ACAO? --NAO--> BLOQUEAR
       |
      SIM
       |
  TIMEOUT? --NAO--> BLOQUEAR
       |
      SIM
       |
  ROLLBACK? --NAO--> BLOQUEAR
       |
      SIM
       |
  BUDGET DISPONIVEL? --NAO--> BLOQUEAR
       |
      SIM
       |
  ==> PERMITIR
```

---

## 3. Acoes PERMITIDAS: Infraestrutura

### 3.1 Pod Restart

```yaml
action: pod_restart
category: infrastructure
permission: ALLOWED
conditions:
  - 'Pod em CrashLoopBackOff'
  - 'Pod com OOMKilled'
  - 'Liveness probe falhando por > 3 ciclos'

safety_checks:
  reversible: true # pod retorna ao estado anterior do container
  blast_radius: '1 pod (nao afeta outros pods do mesmo deployment)'
  post_validation:
    check: 'Pod esta Running e readiness probe passando'
    timeout: 120s
  rollback: 'Nao necessario; restart e idempotente'

limits:
  max_restarts_per_pod: 5
  max_restarts_per_service_per_hour: 10
  cooldown_between_restarts: 30s

implementation:
  trigger: |
    # Prometheus alert rule
    kube_pod_container_status_waiting_reason{
      namespace=~"velya-dev-.*",
      reason="CrashLoopBackOff"
    } == 1

  action: |
    kubectl delete pod $POD_NAME -n $NAMESPACE --grace-period=30

  post_validation: |
    # Aguardar pod ficar Ready
    kubectl wait pod -l app.kubernetes.io/name=$SERVICE \
      -n $NAMESPACE --for=condition=Ready --timeout=120s
```

### 3.2 Pod Reschedule

```yaml
action: pod_reschedule
category: infrastructure
permission: ALLOWED
conditions:
  - 'Node com pressao de recursos (DiskPressure, MemoryPressure)'
  - 'Pod pending por > 5 minutos'
  - 'Node notReady'

safety_checks:
  reversible: true
  blast_radius: '1 pod, rescheduled para outro node'
  post_validation:
    check: 'Pod Running em novo node'
    timeout: 300s
  rollback: 'Pod pode ser movido de volta se necessario'

limits:
  max_reschedules_per_service_per_hour: 5
  min_available_during_reschedule: 'PodDisruptionBudget.minAvailable'

implementation:
  pdb_required: true
  pdb_spec: |
    apiVersion: policy/v1
    kind: PodDisruptionBudget
    metadata:
      name: patient-flow-pdb
      namespace: velya-dev-core
    spec:
      minAvailable: 2
      selector:
        matchLabels:
          app.kubernetes.io/name: patient-flow
```

### 3.3 Scale Out (Horizontal)

```yaml
action: horizontal_scale_out
category: infrastructure
permission: ALLOWED
conditions:
  - 'CPU usage > 80% por > 3 minutos'
  - 'Memory usage > 80% por > 3 minutos'
  - 'Queue depth crescendo e consumer nao acompanha'
  - 'KEDA trigger ativado'

safety_checks:
  reversible: true # scale down automatico quando demanda cai
  blast_radius: 'Adiciona pods, nao remove'
  post_validation:
    check: 'Novos pods estao Ready e metricas de saturacao reduziram'
    timeout: 300s
  rollback: 'KEDA/HPA reduz replicas automaticamente quando demanda cai'

limits:
  max_replicas_per_service:
    patient-flow: 10
    discharge-orchestrator: 8
    task-inbox: 8
    ai-gateway: 8
    velya-web: 6
    notification-hub: 5
  scale_step: '+1 pod por vez (suave) ou +50% (agressivo para picos)'
  cooldown_after_scale: 300s

implementation:
  hpa_spec: |
    apiVersion: autoscaling/v2
    kind: HorizontalPodAutoscaler
    metadata:
      name: patient-flow-hpa
      namespace: velya-dev-core
    spec:
      scaleTargetRef:
        apiVersion: argoproj.io/v1alpha1
        kind: Rollout
        name: patient-flow
      minReplicas: 3
      maxReplicas: 10
      metrics:
        - type: Resource
          resource:
            name: cpu
            target:
              type: Utilization
              averageUtilization: 70
        - type: Resource
          resource:
            name: memory
            target:
              type: Utilization
              averageUtilization: 75
      behavior:
        scaleUp:
          stabilizationWindowSeconds: 60
          policies:
            - type: Pods
              value: 1
              periodSeconds: 60
        scaleDown:
          stabilizationWindowSeconds: 300
          policies:
            - type: Pods
              value: 1
              periodSeconds: 120

  keda_spec: |
    apiVersion: keda.sh/v1alpha1
    kind: ScaledObject
    metadata:
      name: task-inbox-scaler
      namespace: velya-dev-core
    spec:
      scaleTargetRef:
        apiVersion: argoproj.io/v1alpha1
        kind: Rollout
        name: task-inbox
      minReplicaCount: 2
      maxReplicaCount: 8
      cooldownPeriod: 300
      triggers:
        - type: nats-jetstream
          metadata:
            natsServerMonitoringEndpoint: "nats.velya-dev-platform:8222"
            account: "$G"
            stream: "task-events"
            consumer: "task-inbox-consumer"
            lagThreshold: "100"
            activationLagThreshold: "10"
```

---

## 4. Acoes PERMITIDAS: Aplicacao

### 4.1 Reconexao Automatica

```yaml
action: auto_reconnection
category: application
permission: ALLOWED
conditions:
  - 'Conexao com banco de dados perdida'
  - 'Conexao com NATS perdida'
  - 'Conexao com Temporal perdida'
  - 'Conexao com Redis perdida'

safety_checks:
  reversible: true
  blast_radius: 'Apenas o servico afetado'
  post_validation:
    check: 'Conexao restabelecida e health check passando'
    timeout: 60s
  rollback: 'Se reconexao falhar, servico entra em estado unhealthy (readiness fail)'

limits:
  max_reconnection_attempts: 10
  backoff_strategy: 'exponential com jitter'
  initial_backoff: 1s
  max_backoff: 30s

implementation: |
  // Exemplo TypeScript com reconexao exponential backoff
  import { ConnectionPool } from '@velya/database';

  const pool = new ConnectionPool({
    connectionString: process.env.DATABASE_URL,
    maxRetries: 10,
    retryBackoff: {
      type: 'exponential',
      initialMs: 1000,
      maxMs: 30000,
      jitter: true,
    },
    onReconnect: () => {
      metrics.reconnectionTotal.inc({ service: 'patient-flow', dependency: 'postgres' });
      logger.warn('Reconexao com banco de dados estabelecida');
    },
    onReconnectFailed: () => {
      metrics.reconnectionFailedTotal.inc({ service: 'patient-flow', dependency: 'postgres' });
      logger.error('Falha na reconexao com banco de dados. Servico ficara unhealthy.');
      healthCheck.setUnhealthy('database');
    },
  });
```

### 4.2 Ativacao de Fallback

```yaml
action: fallback_activation
category: application
permission: ALLOWED
conditions:
  - 'Dependencia primaria indisponivel por > 30s'
  - 'Circuit breaker abriu'
  - 'Timeout em chamada para dependencia'

safety_checks:
  reversible: true # fallback desativado quando primario volta
  blast_radius: 'Servico opera em modo degradado, mas funcional'
  post_validation:
    check: 'Servico respondendo (mesmo em modo degradado)'
    timeout: 30s
  rollback: 'Automatico quando circuit breaker fecha'

fallback_definitions:
  ai-gateway:
    primary: 'Anthropic Claude API'
    fallback_chain:
      1: 'Cache de respostas similares (se disponivel)'
      2: 'Resposta padrao com aviso ao usuario'
      3: 'Rejeitar request com mensagem informativa'
    max_fallback_duration: 30m
    notification: '#velya-oncall-ai'

  patient-flow:
    primary: 'API direta'
    fallback_chain:
      1: 'Leitura do cache Redis'
      2: 'Modo somente leitura (bloqueia escrita)'
    max_fallback_duration: 15m

  notification-hub:
    primary: 'Envio imediato'
    fallback_chain:
      1: 'Enfileirar para envio posterior'
      2: 'Log da notificacao para reprocessamento'
    max_fallback_duration: 60m
```

### 4.3 Circuit Breaker Recovery

```yaml
action: circuit_breaker_recovery
category: application
permission: ALLOWED
conditions:
  - 'Circuit breaker em estado OPEN por > timeout configurado'

safety_checks:
  reversible: true
  blast_radius: 'Envia requests de teste para dependencia'
  post_validation:
    check: 'Request de teste bem-sucedido -> circuit breaker vai para HALF_OPEN -> CLOSED'
    timeout: 60s
  rollback: 'Se teste falhar, circuit breaker permanece OPEN'

configuration: |
  // Configuracao de circuit breaker para servicos Velya
  const circuitBreakerConfig = {
    failureThreshold: 5,        // 5 falhas consecutivas -> OPEN
    successThreshold: 3,         // 3 sucessos em HALF_OPEN -> CLOSED
    timeout: 30000,              // 30s em OPEN antes de tentar HALF_OPEN
    volumeThreshold: 10,         // minimo de requests antes de avaliar
    errorFilter: (error) => {
      // Nao conta 4xx como falha do circuit breaker
      return error.statusCode >= 500 || error.code === 'ECONNREFUSED';
    },
    onOpen: () => {
      metrics.circuitBreakerState.set({ state: 'open' }, 1);
      metrics.circuitBreakerState.set({ state: 'closed' }, 0);
    },
    onClose: () => {
      metrics.circuitBreakerState.set({ state: 'open' }, 0);
      metrics.circuitBreakerState.set({ state: 'closed' }, 1);
    },
  };
```

---

## 5. Acoes PERMITIDAS: Agentes de IA

### 5.1 Restart de Agente Stateless

```yaml
action: agent_restart_stateless
category: agents
permission: ALLOWED
conditions:
  - 'Agente nao responde ao heartbeat por > 90s'
  - 'Agente em loop (mesmo output repetido > 5 vezes)'
  - 'Agente excedeu token budget por request'

safety_checks:
  reversible: true # agentes stateless podem ser reiniciados sem perda
  blast_radius: '1 instancia de agente'
  post_validation:
    check: 'Agente respondendo ao heartbeat e guardrails ativos'
    timeout: 120s
  rollback: 'Se agente nao volta apos restart, quarantinar'

limits:
  max_restarts_per_agent_per_hour: 3
  cooldown: 120s
```

### 5.2 Quarentena de Agente

```yaml
action: agent_quarantine
category: agents
permission: ALLOWED
conditions:
  - 'Agente gera outputs consistentemente invalidos (> 3 em sequencia)'
  - 'Agente tenta acessar recursos nao autorizados (> 2 tentativas)'
  - 'Agente excede rate limit repetidamente'
  - 'Agente restart falhou 3 vezes consecutivas'

safety_checks:
  reversible: true # agente pode ser des-quarentinado manualmente
  blast_radius: '1 instancia de agente; funcionalidade do agente indisponivel'
  post_validation:
    check: 'Agente isolado (nao recebe novos requests)'
    timeout: 30s
  rollback: 'Requer aprovacao humana para des-quarentinar'

implementation:
  quarantine_actions:
    - 'Remover agente do pool de agent-coordinator'
    - 'Redirecionar requests para outros agentes ou fallback'
    - 'Preservar logs e context para investigacao'
    - 'Notificar #velya-oncall-ai'

  label_patch: |
    kubectl label pod $POD_NAME -n velya-dev-agents \
      velya.io/quarantined=true \
      velya.io/quarantine-reason="$REASON" \
      velya.io/quarantine-timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

### 5.3 Reducao de Permissoes de Agente

```yaml
action: agent_permission_reduction
category: agents
permission: ALLOWED
conditions:
  - 'Agente tentou operacao de escrita nao autorizada'
  - 'Agente acessou dados fora do seu escopo'
  - 'Padrao de comportamento anomalo detectado'

safety_checks:
  reversible: true # permissoes podem ser restauradas manualmente
  blast_radius: '1 instancia de agente, funcionalidade reduzida'
  post_validation:
    check: 'Agente operando com permissoes reduzidas sem erros'
    timeout: 60s
  rollback: 'Restaurar permissoes manualmente apos investigacao'

permission_levels:
  full: 'Leitura + Escrita + Execucao de workflows'
  reduced: 'Leitura + Execucao limitada (sem escrita)'
  readonly: 'Apenas leitura'
  suspended: 'Nenhum acesso (quarentena)'

implementation: |
  // agent-coordinator reduz permissoes dinamicamente
  await agentCoordinator.updatePermissions(agentId, {
    level: 'reduced',
    reason: 'anomalous_behavior_detected',
    previousLevel: 'full',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
    requiresManualReview: true,
  });
```

---

## 6. Acoes PROIBIDAS

### 6.1 Infraestrutura - Acoes Proibidas

```yaml
prohibited_infrastructure:
  - action: 'Deletar PersistentVolumeClaim'
    reason: 'Perda irreversivel de dados. PVCs podem conter dados de paciente.'
    alternative: 'Escalar para humano para avaliar necessidade.'

  - action: 'Scale down para zero replicas'
    reason: 'Causa indisponibilidade total do servico.'
    alternative: 'Minimo de replicas definido por PDB e HPA minReplicas.'

  - action: 'Modificar NetworkPolicy automaticamente'
    reason: 'Pode expor servicos a trafego nao autorizado.'
    alternative: 'Toda mudanca de NetworkPolicy via GitOps com review.'

  - action: 'Alterar resource limits em runtime'
    reason: 'Pode causar OOM em outros pods no node. Deve ser via GitOps.'
    alternative: 'VPA em modo recommendation-only; aplicar via PR.'

  - action: 'Deletar namespace'
    reason: 'Destruicao massiva e irreversivel.'
    alternative: 'Nunca. Nenhum cenario justifica auto-delete de namespace.'

  - action: 'Modificar RBAC roles/bindings'
    reason: 'Pode escalar privilegios indevidamente.'
    alternative: 'Toda mudanca de RBAC via GitOps com review de seguranca.'

  - action: 'Executar kubectl exec em pods de producao'
    reason: 'Acesso interativo a producao deve ser auditado e autorizado.'
    alternative: 'Logs via Loki, debug via Tempo traces.'

  - action: 'Forcar eviction de todos os pods de um node'
    reason: 'Blast radius desconhecido; pode causar cascata.'
    alternative: 'Cordon + drain gradual com PDB respeitados.'
```

### 6.2 Aplicacao - Acoes Proibidas

```yaml
prohibited_application:
  - action: 'Modificar schema de banco de dados'
    reason: 'Migrations devem ser versionadas, revisadas e aplicadas via CI/CD.'
    alternative: 'PR com migration revisada e testada.'

  - action: 'Purgar fila ou stream NATS'
    reason: 'Mensagens podem conter eventos de negocio criticos nao processados.'
    alternative: 'Investigar por que consumer nao processa; corrigir consumer.'

  - action: 'Invalidar todas as sessoes de usuario'
    reason: 'Impacto massivo na experiencia de todos os usuarios.'
    alternative: 'Invalidar sessoes especificas se comprometidas.'

  - action: 'Desabilitar rate limiting'
    reason: 'Expoe servicos a DoS.'
    alternative: 'Ajustar limites via configuracao com review.'

  - action: 'Bypass de guardrails de IA'
    reason: 'Guardrails protegem contra outputs danosos em contexto clinico.'
    alternative: 'Nunca. Se guardrail bloqueia, o output nao deve ser entregue.'

  - action: 'Retry infinito de operacoes falhadas'
    reason: 'Pode causar thunder herd ou amplificar problemas.'
    alternative: 'Retry com backoff exponencial e max_retries definido.'

  - action: 'Reprocessar DLQ inteira automaticamente'
    reason: 'Mensagens na DLQ falharam por uma razao; reprocessar sem correcao repete o problema.'
    alternative: 'Investigar causa, corrigir, reprocessar seletivamente.'
```

### 6.3 Agentes - Acoes Proibidas

```yaml
prohibited_agents:
  - action: 'Dar ao agente acesso a dados de paciente sem consent tracking'
    reason: 'Violacao de LGPD e politica interna.'
    alternative: 'Configurar consent tracking antes de conceder acesso.'

  - action: 'Permitir agente criar PRs sem review humano'
    reason: 'Agentes podem introduzir codigo vulneravel.'
    alternative: 'Agentes criam PRs; humanos revisam e aprovam.'

  - action: 'Auto-promover agente para permissoes elevadas'
    reason: 'Escalacao de privilegio nao supervisionada.'
    alternative: 'Solicitacao de permissao com aprovacao humana.'

  - action: 'Permitir agente modificar seus proprios guardrails'
    reason: 'Agente poderia remover suas proprias restricoes.'
    alternative: 'Guardrails sao imutaveis em runtime; mudancas via GitOps.'

  - action: 'Permitir agente acessar secrets diretamente'
    reason: 'Agentes nao devem ter acesso a credenciais raw.'
    alternative: 'Acesso via service accounts com RBAC restrito.'

  - action: 'Restaurar agente quarentinado automaticamente'
    reason: 'Quarentena existe por suspeita de comportamento anormal.'
    alternative: 'Restauracao requer investigacao e aprovacao humana.'
```

---

## 7. Budget de Remediacao

```yaml
healing_budget:
  description: |
    Cada servico tem um budget de healing por hora. Se o budget e esgotado,
    todas as acoes de auto-remediacao sao bloqueadas e o problema e escalado
    para humano. Isso previne healing loops.

  budgets_per_service:
    patient-flow:
      pod_restarts: 5
      reconnections: 10
      scale_operations: 3
      fallback_activations: 5
      total_healing_actions: 15

    discharge-orchestrator:
      pod_restarts: 5
      reconnections: 10
      scale_operations: 3
      fallback_activations: 3
      total_healing_actions: 15

    ai-gateway:
      pod_restarts: 3
      reconnections: 10
      scale_operations: 3
      agent_restarts: 5
      agent_quarantines: 3
      total_healing_actions: 15

    task-inbox:
      pod_restarts: 5
      reconnections: 10
      scale_operations: 5
      total_healing_actions: 15

    velya-web:
      pod_restarts: 5
      scale_operations: 3
      total_healing_actions: 10

  metrics:
    budget_used: |
      velya_healing_budget_used{service="$SERVICE", action_type="$TYPE"}
    budget_remaining: |
      velya_healing_budget_limit{service="$SERVICE", action_type="$TYPE"}
      -
      velya_healing_budget_used{service="$SERVICE", action_type="$TYPE"}

  alerts:
    - name: VelyaHealingBudgetLow
      expr: |
        (
          velya_healing_budget_used
          /
          velya_healing_budget_limit
        ) > 0.7
      severity: warning
      action: 'Budget de healing 70% consumido. Investigar causa raiz.'

    - name: VelyaHealingBudgetExhausted
      expr: |
        velya_healing_budget_used >= velya_healing_budget_limit
      severity: critical
      action: |
        Budget de healing ESGOTADO para {{ $labels.service }}.
        Auto-remediacao DESATIVADA. Escalar para on-call.
        Budget reseta na proxima hora.

  reset:
    schedule: '0 * * * *' # a cada hora
    implementation: |
      # CronJob que reseta contadores de healing
      kubectl exec -n velya-dev-platform deploy/healing-controller -- \
        healing-budget reset --all-services
```

---

## 8. Registro de Remediacao

Toda acao de remediacao gera um registro estruturado:

```yaml
remediation_log:
  storage: 'Loki + S3 (retencao 1 ano)'

  schema:
    timestamp: 'ISO 8601'
    action_id: 'UUID unico da acao'
    service: 'nome do servico'
    namespace: 'namespace K8s'
    action_type: 'pod_restart | reconnection | scale_out | fallback | agent_restart | agent_quarantine'
    trigger: 'descricao do que disparou a acao'
    trigger_metric: 'nome da metrica que disparou'
    trigger_value: 'valor da metrica no momento do disparo'
    decision_path: 'reversivel=true, blast_radius=1_pod, ...'
    action_result: 'success | failure | timeout'
    post_validation_result: 'pass | fail'
    duration_seconds: 'tempo total da remediacao'
    budget_before: 'budget restante antes da acao'
    budget_after: 'budget restante apos a acao'
    escalated: 'true se escalou para humano'
    escalation_reason: 'motivo do escalonamento'

  example:
    timestamp: '2026-04-08T14:30:00Z'
    action_id: 'rem-a1b2c3d4'
    service: 'patient-flow'
    namespace: 'velya-dev-core'
    action_type: 'pod_restart'
    trigger: 'CrashLoopBackOff detectado no pod patient-flow-7f8d9a-xyz'
    trigger_metric: 'kube_pod_container_status_waiting_reason'
    trigger_value: 'CrashLoopBackOff'
    decision_path: 'reversivel=true, blast_radius=1_pod, post_validation=readiness_check, timeout=120s'
    action_result: 'success'
    post_validation_result: 'pass'
    duration_seconds: 45
    budget_before: 5
    budget_after: 4
    escalated: false
```

---

## 9. Fluxo de Escalonamento

```
  AUTO-REMEDIACAO
       |
       +-- Sucesso --> Log + continuar monitoramento
       |
       +-- Falha --> Budget disponivel?
                     |
                     +-- SIM --> Tentar outra acao do mesmo tier
                     |           (ex: restart falhou -> reschedule)
                     |
                     +-- NAO --> ESCALAR
                                 |
                                 v
                     +------------------------+
                     | Tier 1: Slack #velya-   |
                     | oncall + PagerDuty low  |
                     | Tempo: 15 min           |
                     +------------------------+
                                 |
                                 | Se nao resolvido em 15 min
                                 v
                     +------------------------+
                     | Tier 2: PagerDuty high  |
                     | + Tech Lead notificado  |
                     | Tempo: 30 min           |
                     +------------------------+
                                 |
                                 | Se nao resolvido em 30 min
                                 v
                     +------------------------+
                     | Tier 3: Incident P1     |
                     | War room + VP notificado|
                     +------------------------+
```

---

## 10. Documentos Relacionados

| Documento                          | Descricao                                |
| ---------------------------------- | ---------------------------------------- |
| `layered-assurance-model.md`       | Modelo completo (L7 = Remediation)       |
| `self-healing-model.md`            | Implementacao do self-healing em 3 tiers |
| `runtime-integrity-model.md`       | Metricas que disparam remediacao         |
| `progressive-delivery-strategy.md` | Rollback automatico via Argo Rollouts    |
