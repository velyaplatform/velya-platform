# Modelo de Remediacao Segura

> **Principio**: Toda remediacao automatica deve ser nao-destrutiva, reversivel,
> limitada e seguida de revalidacao. Na duvida, alerta em vez de agir.

## Visao Geral

O motor de remediacao da plataforma Velya opera sob um modelo de seguranca rigoroso
que separa claramente o que PODE ser auto-remediado do que NUNCA pode.

```
Anomalia detectada
  |
  v
E remediavel automaticamente?
  |
  +-- Nao --> Alerta + escala humano
  |
  +-- Sim --> Acao e segura?
                |
                +-- Nao --> Alerta + escala humano
                |
                +-- Sim --> Executar remediacao
                              |
                              v
                            Revalidar
                              |
                              +-- Pass --> Aceitar, registrar
                              +-- Fail --> Rollback + escala humano
```

---

## O que PODE Ser Auto-Remediado

### 1. Restart Pod

```yaml
remediation: restart-pod
description: "Reiniciar pod que esta em estado indesejado"
safety:
  destructive: false
  reversible: true
  data_loss_risk: none
  max_retries: 3
  backoff: exponential
  backoff_base_ms: 5000
  cooldown_minutes: 10
conditions:
  - pod in CrashLoopBackOff
  - pod not Ready for > 2min
  - pod memory > 95% limit
  - pod OOMKilled
exclusions:
  - StatefulSet pods with persistent data (requires manual review)
  - Pods with active database connections
revalidation:
  - wait: 30s
  - check: pod Ready
  - check: liveness probe passing
  - check: readiness probe passing
  - check: no error logs in last 30s
```

### Implementacao

```typescript
interface PodRestartRemediation {
  targetPod: string;
  namespace: string;
  reason: string;
  maxRetries: number;
  backoffBaseMs: number;
  cooldownMinutes: number;
}

async function restartPod(config: PodRestartRemediation): Promise<RemediationResult> {
  // Verificar cooldown
  const lastRestart = await getLastRestart(config.targetPod, config.namespace);
  if (lastRestart && Date.now() - lastRestart.getTime() < config.cooldownMinutes * 60 * 1000) {
    return { status: 'skipped', reason: 'In cooldown period' };
  }

  // Verificar numero de restarts recentes
  const recentRestarts = await getRecentRestarts(config.targetPod, config.namespace, '1h');
  if (recentRestarts >= config.maxRetries) {
    await escalate({
      severity: 'critical',
      message: `Pod ${config.targetPod} atingiu max restarts (${config.maxRetries})`,
      action: 'manual-intervention-required',
    });
    return { status: 'escalated', reason: 'Max retries exceeded' };
  }

  // Executar restart
  await k8sClient.deleteNamespacedPod(config.targetPod, config.namespace);
  emitMetric('remediation_executed', { type: 'restart-pod', target: config.targetPod });

  // Revalidar
  await sleep(30000);
  const podReady = await checkPodReady(config.targetPod, config.namespace);

  if (podReady) {
    return { status: 'success', reason: 'Pod restarted and healthy' };
  } else {
    await escalate({
      severity: 'critical',
      message: `Pod ${config.targetPod} nao ficou healthy apos restart`,
    });
    return { status: 'failed', reason: 'Pod not healthy after restart' };
  }
}
```

### 2. GitOps Reconcile

```yaml
remediation: gitops-reconcile
description: "Forcar reconciliacao GitOps quando drift detectado"
safety:
  destructive: false
  reversible: true  # Git e source of truth
  data_loss_risk: none
  max_retries: 2
  backoff: fixed
  backoff_base_ms: 30000
  cooldown_minutes: 5
conditions:
  - drift detectado entre Git e cluster
  - sync status OutOfSync
  - aplicacao em estado Unknown
exclusions:
  - recursos com annotation velya.io/manual-override: "true"
  - namespaces com label velya.io/gitops-paused: "true"
revalidation:
  - wait: 60s
  - check: sync status Synced
  - check: application Healthy
  - check: no degraded resources
```

### 3. Retry Bounded

```yaml
remediation: retry-bounded
description: "Retentar operacao que falhou de forma transiente"
safety:
  destructive: false
  reversible: true
  data_loss_risk: none
  max_retries: 5
  backoff: exponential
  backoff_base_ms: 1000
  max_backoff_ms: 30000
  cooldown_minutes: 0
conditions:
  - erro transiente (timeout, 503, connection reset)
  - operacao idempotente
exclusions:
  - operacoes nao-idempotentes (POST sem idempotency key)
  - erros permanentes (400, 401, 403, 404)
  - erros de validacao
revalidation:
  - check: operacao completou com sucesso
  - check: resultado consistente
```

### Implementacao

```typescript
interface RetryConfig {
  maxRetries: number;
  backoffBaseMs: number;
  maxBackoffMs: number;
  retryableErrors: string[];
  nonRetryableStatuses: number[];
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 5,
  backoffBaseMs: 1000,
  maxBackoffMs: 30000,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'UND_ERR_SOCKET'],
  nonRetryableStatuses: [400, 401, 403, 404, 409, 422],
};

async function retryBounded<T>(
  operation: () => Promise<T>,
  config: RetryConfig = defaultRetryConfig,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 0) {
        emitMetric('retry_succeeded', { attempt });
      }
      return result;
    } catch (error) {
      lastError = error as Error;

      // Verificar se erro e retryable
      if (!isRetryable(error, config)) {
        throw error;
      }

      if (attempt < config.maxRetries) {
        const backoff = Math.min(
          config.backoffBaseMs * Math.pow(2, attempt),
          config.maxBackoffMs,
        );
        const jitter = Math.random() * backoff * 0.1;
        await sleep(backoff + jitter);
        emitMetric('retry_attempt', { attempt: attempt + 1, backoffMs: backoff });
      }
    }
  }

  emitMetric('retry_exhausted', { maxRetries: config.maxRetries });
  throw lastError;
}
```

### 4. Scale Out Temporario

```yaml
remediation: scale-out-temporary
description: "Escalar horizontalmente para absorver carga temporaria"
safety:
  destructive: false
  reversible: true  # Scale back apos cooldown
  data_loss_risk: none
  max_scale_factor: 2  # No maximo dobrar
  max_replicas: 10     # Limite absoluto
  cooldown_minutes: 15
  auto_scale_back: true
  scale_back_after_minutes: 30
conditions:
  - CPU > 80% por 5min
  - Queue depth > warning threshold crescendo
  - Request latency > 2x baseline por 3min
exclusions:
  - servicos com StatefulSet (scale manual)
  - servicos com afinidade strict
  - databases
revalidation:
  - wait: 60s
  - check: novas replicas Ready
  - check: carga distribuida
  - check: metricas melhorando
```

### 5. Degraded Mode

```yaml
remediation: degraded-mode
description: "Ativar modo degradado para manter servico parcial"
safety:
  destructive: false
  reversible: true
  data_loss_risk: none  # Features desabilitadas, nao dados
  cooldown_minutes: 5
conditions:
  - dependencia nao-critica indisponivel
  - latencia de dependencia > 5x normal
  - circuit breaker aberto
features_degradable:
  - notifications: desabilitar envio, enfileirar
  - analytics: desabilitar coleta, manter operacao
  - recommendations: retornar defaults
  - audit-detail: reduzir nivel de detalhe
  - search: desabilitar busca avancada, manter basica
non_degradable:
  - authentication
  - patient-data-access
  - medication-management
  - audit-core
revalidation:
  - check: servico respondendo
  - check: features criticas funcionando
  - periodic: tentar restaurar features degradadas a cada 5min
```

### 6. Quarantine Agent

```yaml
remediation: quarantine-agent
description: "Isolar agent com comportamento anomalo"
safety:
  destructive: false
  reversible: true
  data_loss_risk: none
  cooldown_minutes: 30
conditions:
  - agent produzindo resultados inconsistentes
  - agent consumindo recursos excessivos
  - agent gerando alertas falsos em cascata
  - agent com error rate > 50%
actions:
  - remover agent do pool ativo
  - manter agent rodando em modo isolado
  - redirecionar trafego para instancia backup
  - capturar estado para diagnostico
revalidation:
  - diagnostico automatico do agent isolado
  - tentativa de restart em modo isolado
  - se healthy: reintegrar ao pool
  - se nao: escalar para revisao manual
```

### 7. Cert Reissue

```yaml
remediation: cert-reissue
description: "Reemitir certificado proximo do vencimento"
safety:
  destructive: false
  reversible: true  # Cert antigo mantido como backup
  data_loss_risk: none
  cooldown_minutes: 60
  max_retries: 3
conditions:
  - certificado expirando em < renewal_threshold
  - renovacao automatica habilitada
  - issuer acessivel
exclusions:
  - CA raiz (requer procedimento manual)
  - certificados de terceiros
  - certificados com pinning
actions:
  - backup do certificado atual
  - trigger cert-manager Certificate renewal
  - aguardar emissao
  - validar novo certificado
  - atualizar ingress/services
revalidation:
  - check: novo certificado valido
  - check: endpoints respondendo com novo cert
  - check: sem erros TLS nos logs
  - keep: backup do cert antigo por 48h
```

---

## O que NUNCA Pode Ser Auto-Remediado

### 1. Mutacao Destrutiva

```yaml
# PROIBIDO: Qualquer acao que destrua dados ou estado irrecuperavel
never_auto_remediate:
  - name: delete-persistent-volume
    reason: "Dados de pacientes sao irrecuperaveis"
    action: alert-and-wait

  - name: drop-database-table
    reason: "Perda de dados criticos"
    action: alert-and-wait

  - name: truncate-audit-log
    reason: "Compliance e regulatorio"
    action: alert-and-wait

  - name: force-delete-namespace
    reason: "Destruicao em cascata"
    action: alert-and-wait

  - name: delete-backup
    reason: "Ultimo recurso de recuperacao"
    action: alert-and-wait
```

### 2. IAM Changes

```yaml
never_auto_remediate:
  - name: modify-rbac-roles
    reason: "Alteracao de permissoes requer revisao humana"
    action: alert-and-create-ticket

  - name: create-service-account
    reason: "Novas identidades requerem aprovacao"
    action: alert-and-create-ticket

  - name: modify-network-policies
    reason: "Alteracao de rede requer revisao de seguranca"
    action: alert-and-create-ticket

  - name: change-secrets
    reason: "Credenciais requerem rotacao controlada"
    action: alert-and-create-ticket
```

### 3. Dados Sensiveis

```yaml
never_auto_remediate:
  - name: patient-data-modification
    reason: "Dados de pacientes sao regulados (LGPD/HIPAA)"
    action: alert-and-wait

  - name: prescription-modification
    reason: "Prescricoes requerem validacao medica"
    action: alert-and-wait

  - name: audit-record-modification
    reason: "Registros de auditoria sao imutaveis"
    action: alert-and-wait
```

### 4. Self-Healing Cego

```yaml
never_auto_remediate:
  - name: restart-without-diagnosis
    reason: "Restart sem entender a causa mascara o problema"
    action: capture-state-then-decide

  - name: scale-without-understanding
    reason: "Escalar pode piorar o problema (ex: thundering herd)"
    action: analyze-metrics-then-decide

  - name: retry-permanent-error
    reason: "Retry de erro permanente desperica recursos"
    action: classify-error-then-decide

  - name: auto-fix-data-corruption
    reason: "Correcao automatica pode propagar corrupcao"
    action: quarantine-and-alert

  - name: cascade-remediation
    reason: "Remediacoes em cascata podem amplificar falhas"
    action: rate-limit-and-alert
```

---

## Modelo de Revalidacao

Toda remediacao e seguida obrigatoriamente de revalidacao.

```typescript
interface RevalidationPlan {
  waitBeforeCheck: number;  // ms
  checks: RevalidationCheck[];
  acceptCriteria: 'all_pass' | 'critical_pass';
  rollbackOnFailure: boolean;
  maxRevalidationAttempts: number;
  revalidationInterval: number;  // ms
}

interface RevalidationCheck {
  name: string;
  type: 'health' | 'functional' | 'performance' | 'data-integrity';
  critical: boolean;
  handler: () => Promise<boolean>;
}

async function revalidateRemediation(
  remediation: RemediationRecord,
  plan: RevalidationPlan,
): Promise<RevalidationResult> {
  await sleep(plan.waitBeforeCheck);

  for (let attempt = 0; attempt < plan.maxRevalidationAttempts; attempt++) {
    const results: Map<string, boolean> = new Map();

    for (const check of plan.checks) {
      try {
        const passed = await check.handler();
        results.set(check.name, passed);
      } catch (error) {
        results.set(check.name, false);
      }
    }

    const allPassed = Array.from(results.values()).every(v => v);
    const criticalPassed = plan.checks
      .filter(c => c.critical)
      .every(c => results.get(c.name));

    const accepted = plan.acceptCriteria === 'all_pass' ? allPassed : criticalPassed;

    if (accepted) {
      return {
        status: 'accepted',
        remediation: remediation.id,
        checks: results,
        attempts: attempt + 1,
      };
    }

    if (attempt < plan.maxRevalidationAttempts - 1) {
      await sleep(plan.revalidationInterval);
    }
  }

  // Revalidacao falhou
  if (plan.rollbackOnFailure) {
    await executeRollback(remediation);
    return { status: 'rolled-back', remediation: remediation.id, checks: new Map() };
  }

  await escalate({
    severity: 'critical',
    message: `Remediacao ${remediation.id} falhou revalidacao apos ${plan.maxRevalidationAttempts} tentativas`,
  });

  return { status: 'failed', remediation: remediation.id, checks: new Map() };
}
```

---

## Fluxo Completo de Remediacao

```
Anomalia detectada pelo watchdog/control loop
  |
  v
1. CLASSIFICAR
  - Tipo de anomalia
  - Severidade
  - Componente afetado
  - Contexto (hora, carga, deploy recente?)
  |
  v
2. DECIDIR
  - Esta na lista de remediacao permitida?
    +-- Nao --> ALERTAR + ESCALAR
    +-- Sim --> Continuar
  - Esta dentro do cooldown?
    +-- Sim --> AGUARDAR ou ESCALAR
    +-- Nao --> Continuar
  - Atingiu max retries?
    +-- Sim --> ESCALAR
    +-- Nao --> Continuar
  |
  v
3. CAPTURAR ESTADO (antes da acao)
  - Snapshot de metricas
  - Logs recentes
  - Estado do recurso
  - Contexto da anomalia
  |
  v
4. EXECUTAR REMEDIACAO
  - Acao especifica
  - Com timeout
  - Com logging completo
  |
  v
5. REVALIDAR
  - Aguardar estabilizacao
  - Executar checks
  - Comparar com estado anterior
  |
  v
6. ACEITAR ou ROLLBACK
  +-- Aceitar:
  |     - Registrar sucesso
  |     - Atualizar metricas
  |     - Alimentar learning pipeline
  |
  +-- Rollback:
        - Reverter acao
        - Escalar para humano
        - Registrar falha
        - Alimentar learning pipeline
```

---

## Safety Guards

### Rate Limiting de Remediacao

```yaml
remediation_rate_limits:
  global:
    max_remediations_per_minute: 5
    max_remediations_per_hour: 20
    max_concurrent_remediations: 3

  per_type:
    restart-pod:
      max_per_pod_per_hour: 3
      max_total_per_hour: 10

    gitops-reconcile:
      max_per_app_per_hour: 3
      max_total_per_hour: 5

    scale-out:
      max_per_deployment_per_hour: 2
      max_total_per_hour: 5

    cert-reissue:
      max_per_cert_per_day: 2
      max_total_per_day: 5
```

### Circuit Breaker para Remediacao

```typescript
interface RemediationCircuitBreaker {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  failureThreshold: number;
  resetTimeout: number;
  lastFailure?: Date;
}

const circuitBreakerConfig: RemediationCircuitBreaker = {
  state: 'closed',
  failureCount: 0,
  failureThreshold: 3,  // Apos 3 falhas consecutivas, abrir circuito
  resetTimeout: 300000,  // 5 minutos para tentar novamente
};

function shouldAttemptRemediation(breaker: RemediationCircuitBreaker): boolean {
  switch (breaker.state) {
    case 'closed':
      return true;
    case 'open':
      if (Date.now() - (breaker.lastFailure?.getTime() ?? 0) > breaker.resetTimeout) {
        breaker.state = 'half-open';
        return true;
      }
      return false;
    case 'half-open':
      return true;
  }
}
```

---

## Auditoria de Remediacao

Toda remediacao e registrada com auditoria completa.

```typescript
interface RemediationAuditRecord {
  id: string;
  timestamp: Date;
  type: RemediationType;
  trigger: {
    source: string;     // watchdog/control-loop que detectou
    anomaly: string;    // descricao da anomalia
    severity: string;
  };
  target: {
    resource: string;
    namespace: string;
    kind: string;
  };
  action: {
    type: string;
    parameters: Record<string, unknown>;
    attempt: number;
    maxRetries: number;
  };
  preState: Record<string, unknown>;   // Estado antes da remediacao
  postState: Record<string, unknown>;  // Estado depois da remediacao
  revalidation: {
    status: 'passed' | 'failed' | 'skipped';
    checks: Record<string, boolean>;
    duration: number;
  };
  outcome: 'accepted' | 'rolled-back' | 'escalated';
  duration: number;
}
```

---

## Resumo: Matriz de Remediacao

| Remediacao            | Destrutiva | Reversivel | Max Retries | Cooldown | Revalidacao |
|-----------------------|------------|------------|-------------|----------|-------------|
| Restart Pod           | Nao        | Sim        | 3           | 10min    | Obrigatoria |
| GitOps Reconcile      | Nao        | Sim        | 2           | 5min     | Obrigatoria |
| Retry Bounded         | Nao        | Sim        | 5           | 0        | Obrigatoria |
| Scale Out Temp        | Nao        | Sim        | 1           | 15min    | Obrigatoria |
| Degraded Mode         | Nao        | Sim        | 1           | 5min     | Obrigatoria |
| Quarantine Agent      | Nao        | Sim        | 1           | 30min    | Obrigatoria |
| Cert Reissue          | Nao        | Sim        | 3           | 60min    | Obrigatoria |
| **Mutacao Destrutiva**| **SIM**    | **NAO**    | **N/A**     | **N/A**  | **PROIBIDO**|
| **IAM Changes**       | **VARIAVEL**| **VARIAVEL**| **N/A**   | **N/A**  | **PROIBIDO**|
| **Dados Sensiveis**   | **VARIAVEL**| **NAO**   | **N/A**     | **N/A**  | **PROIBIDO**|
| **Self-Healing Cego** | **VARIAVEL**| **VARIAVEL**| **N/A**   | **N/A**  | **PROIBIDO**|
