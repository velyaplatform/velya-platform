# Modelo de Seguranca para Auto-Remediacao - Velya Platform

## Visao Geral

Este documento define o que pode e o que NAO pode ser auto-remediado na Velya Platform. O principio fundamental e: **auto-remediacao so e permitida quando a acao e reversivel, o blast radius e conhecido, existe validacao pos-acao, timeout definido e rollback disponivel**.

---

## Arvore de Decisao para Auto-Remediacao

```
                    [ANOMALIA DETECTADA]
                           |
                    A acao de remediacao
                    e REVERSIVEL?
                      /          \
                    NAO           SIM
                     |             |
                [BLOQUEAR]    O BLAST RADIUS
                Escalar        e CONHECIDO?
                para humano      /        \
                              NAO          SIM
                               |            |
                          [BLOQUEAR]    Existe VALIDACAO
                          Escalar       POS-ACAO?
                          para humano     /        \
                                       NAO          SIM
                                        |            |
                                   [BLOQUEAR]    Existe TIMEOUT
                                   Escalar        definido?
                                   para humano      /       \
                                                 NAO         SIM
                                                  |           |
                                             [BLOQUEAR]   Existe ROLLBACK
                                             Definir       se healing falhar?
                                             timeout         /          \
                                             e retornar   NAO            SIM
                                                           |              |
                                                      [BLOQUEAR]    O HEALING BUDGET
                                                      Implementar   foi excedido?
                                                      rollback         /        \
                                                                    SIM          NAO
                                                                     |            |
                                                                [BLOQUEAR]   [PERMITIR
                                                                Cooling       AUTO-REMEDIACAO]
                                                                period             |
                                                                              Executar acao
                                                                              Validar resultado
                                                                              Registrar evento
```

### Fluxo detalhado em pseudocodigo

```python
def avaliar_remediacao(anomalia, acao_proposta):
    """
    Avalia se uma acao de auto-remediacao pode ser executada.
    Retorna (permitido: bool, motivo: str)
    """
    # Gate 1: Reversibilidade
    if not acao_proposta.is_reversible:
        return False, "Acao irreversivel requer aprovacao humana"

    # Gate 2: Blast radius
    if acao_proposta.blast_radius == "unknown":
        return False, "Blast radius desconhecido"
    if acao_proposta.blast_radius == "cluster-wide":
        return False, "Blast radius cluster-wide requer aprovacao humana"

    # Gate 3: Validacao pos-acao
    if not acao_proposta.has_post_validation:
        return False, "Sem validacao pos-acao definida"

    # Gate 4: Timeout
    if not acao_proposta.has_timeout:
        return False, "Sem timeout definido"
    if acao_proposta.timeout > timedelta(minutes=10):
        return False, "Timeout > 10 min requer aprovacao humana"

    # Gate 5: Rollback
    if not acao_proposta.has_rollback:
        return False, "Sem rollback definido"

    # Gate 6: Healing budget
    servico = anomalia.service
    healings_recentes = count_healings(servico, window=timedelta(hours=1))
    budget = get_healing_budget(servico)
    if healings_recentes >= budget:
        return False, f"Healing budget excedido ({healings_recentes}/{budget} na ultima hora)"

    # Gate 7: Horario
    if is_peak_hours() and acao_proposta.risk_level == "medium":
        return False, "Acao de risco medio bloqueada em horario de pico"

    return True, "Auto-remediacao permitida"
```

---

## Categorias de Auto-Remediacao

### Categoria 1: Infraestrutura

#### Acoes PERMITIDAS

| Acao | Condicao | Blast Radius | Timeout | Validacao | Budget |
|---|---|---|---|---|---|
| **Restart de pod** | CrashLoopBackOff ou OOMKilled | 1 pod | 2 min | Pod running + readiness ok | 3/hora |
| **Reschedule de pod** | Node com pressao de recursos | 1 pod | 5 min | Pod scheduled + running | 2/hora |
| **Scale out (HPA)** | CPU/memory > threshold | Namespace | 3 min | Replicas desejadas = atuais | 5/hora |
| **Scale out (KEDA)** | Queue lag > threshold | Namespace | 3 min | Consumer lag diminuindo | 5/hora |
| **Scale in (gradual)** | Carga abaixo do minimo por 15min | Namespace | 10 min | Metricas estaveis apos scale | 2/hora |
| **Node drain (controlado)** | Node NotReady ou problematico | 1 node | 10 min | Pods rescheduled com sucesso | 1/hora |
| **PV expansion** | Disco > 85% usado | 1 PV | 5 min | PV com novo tamanho | 1/hora |

```yaml
# HPA para patient-flow com scale automatico
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: patient-flow-hpa
  namespace: velya-dev-core
  labels:
    app: patient-flow
spec:
  scaleTargetRef:
    apiVersion: argoproj.io/v1alpha1
    kind: Rollout
    name: patient-flow
  minReplicas: 2
  maxReplicas: 8
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
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
          averageUtilization: 80
```

```yaml
# VPA para recomendacao de resources (modo recommendation only)
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
    updateMode: "Off"  # Apenas recomendacao, nao aplica automaticamente
  resourcePolicy:
    containerPolicies:
      - containerName: patient-flow
        minAllowed:
          cpu: 100m
          memory: 128Mi
        maxAllowed:
          cpu: 2
          memory: 4Gi
```

#### Acoes PROIBIDAS para auto-remediacao (infraestrutura)

| Acao | Justificativa | Alternativa |
|---|---|---|
| **Delete de PV/PVC** | Perda de dados irreversivel | Escalar para humano, backup primeiro |
| **Cordon de node sem drain** | Pods podem ficar stuck | Usar drain controlado |
| **Alteracao de RBAC** | Escalacao de privilegio | Requer PR e review |
| **Modificacao de NetworkPolicy** | Pode expor servicos | Requer PR e review |
| **Delete de namespace** | Destroi todos os recursos | Nunca automatizado |
| **Resize de node group** | Impacto financeiro e de capacidade | Requer aprovacao |
| **Alteracao de DNS** | Impacto em roteamento global | Requer aprovacao |
| **Rotacao de certificados** | Pode causar downtime se mal feita | Processo manual com checklist |

---

### Categoria 2: Aplicacao

#### Acoes PERMITIDAS

| Acao | Condicao | Blast Radius | Timeout | Validacao | Budget |
|---|---|---|---|---|---|
| **Reconnect ao banco** | Connection pool esgotado ou timeout | 1 servico | 30s | Query de teste retorna OK | 5/hora |
| **Reconnect ao NATS** | Conexao perdida | 1 consumer | 15s | Consumer recebendo msgs | 5/hora |
| **Reconnect ao Temporal** | Worker desconectado | 1 worker | 30s | Worker registrado | 5/hora |
| **Ativar fallback** | Dependencia indisponivel | 1 servico | Imediato | Servico respondendo | Ilimitado |
| **Circuit breaker open** | Taxa de erro > 50% na dependencia | 1 circuito | Conforme config | Erro isolado | Ilimitado |
| **Circuit breaker half-open** | Timeout do open expirou | 1 circuito | 30s | Probe request sucesso | Ilimitado |
| **Retry com backoff** | Erro transiente (5xx, timeout) | 1 request | Conforme policy | Request bem-sucedido | Ilimitado |
| **Cache invalidation** | Dados stale detectados | 1 cache | 5s | Cache refreshed | 3/hora |
| **Flush de connection pool** | Conexoes corrompidas | 1 pool | 10s | Novas conexoes OK | 2/hora |

```go
// Exemplo: Circuit breaker para dependencia PostgreSQL no patient-flow
package resilience

import (
    "time"
    "github.com/sony/gobreaker"
    "github.com/prometheus/client_golang/prometheus"
)

var (
    circuitBreakerState = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "velya_circuit_breaker_state",
            Help: "Estado do circuit breaker (0=closed, 1=half-open, 2=open)",
        },
        []string{"service", "dependency"},
    )
    fallbackActivations = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "velya_fallback_activations_total",
            Help: "Total de ativacoes de fallback",
        },
        []string{"service", "dependency", "reason"},
    )
)

func NewDatabaseCircuitBreaker(serviceName string) *gobreaker.CircuitBreaker {
    settings := gobreaker.Settings{
        Name:        serviceName + "-db",
        MaxRequests: 3,                    // Requests permitidos em half-open
        Interval:    10 * time.Second,     // Intervalo para resetar contadores
        Timeout:     30 * time.Second,     // Tempo em open antes de ir para half-open
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
            return counts.Requests >= 10 && failureRatio >= 0.5
        },
        OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
            stateValue := float64(0)
            switch to {
            case gobreaker.StateHalfOpen:
                stateValue = 1
            case gobreaker.StateOpen:
                stateValue = 2
                fallbackActivations.WithLabelValues(
                    serviceName, "postgresql", "circuit_breaker_open",
                ).Inc()
            }
            circuitBreakerState.WithLabelValues(
                serviceName, "postgresql",
            ).Set(stateValue)
        },
    }
    return gobreaker.NewCircuitBreaker(settings)
}
```

#### Acoes PROIBIDAS para auto-remediacao (aplicacao)

| Acao | Justificativa | Alternativa |
|---|---|---|
| **Alterar schema de banco** | Migracoes devem ser versionadas e revisadas | Pipeline de migracao |
| **Purgar dados** | Perda de dados irreversivel | Requer aprovacao humana |
| **Alterar configuracao de negocio** | Impacto em regras hospitalares | Requer aprovacao clinica |
| **Reprocessar mensagens da DLQ** | Pode duplicar efeitos colaterais | Requer analise humana |
| **Alterar rate limits** | Pode expor a ataques ou degradar servico | Requer PR e review |
| **Desabilitar autenticacao/autorizacao** | Exposicao de dados de pacientes | Nunca automatizado |
| **Bypass de validacao de dados** | Dados invalidos no sistema | Nunca automatizado |

---

### Categoria 3: Agentes (Claude Agent SDK)

#### Acoes PERMITIDAS

| Acao | Condicao | Blast Radius | Timeout | Validacao | Budget |
|---|---|---|---|---|---|
| **Restart de agente stateless** | Agente nao respondendo (heartbeat stale) | 1 agente | 60s | Heartbeat retomado | 3/hora |
| **Quarentena de agente noisy** | Agente gerando erros excessivos | 1 agente | Indefinido | Humano revisa | 1/hora |
| **Reducao de permissoes** | Agente fazendo chamadas nao autorizadas | 1 agente | Imediato | Permissoes reduzidas | 2/hora |
| **Swap de coordinator** | Agent-coordinator nao respondendo | 1 coordinator | 2 min | Novo coordinator ativo | 1/hora |
| **Throttle de agente** | Agente consumindo muitos recursos | 1 agente | 5 min | Uso de recursos normalizado | 3/hora |
| **Cancelamento de task** | Task travada alem do timeout | 1 task | 30s | Task marcada como cancelled | 5/hora |
| **Rollback de agente** | Nova versao do agente instavel | 1 agente | 3 min | Versao anterior ativa | 1/hora |

```yaml
# Configuracao de limites para agentes Claude
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-safety-config
  namespace: velya-dev-agents
data:
  safety-config.yaml: |
    agents:
      defaults:
        max_concurrent_tasks: 5
        max_task_duration: 300s
        max_api_calls_per_minute: 60
        max_memory_mb: 512
        heartbeat_interval: 30s
        heartbeat_stale_threshold: 90s
        
      overrides:
        ai-gateway:
          max_concurrent_tasks: 10
          max_task_duration: 600s
          max_api_calls_per_minute: 120
          max_memory_mb: 2048
          
        agent-coordinator:
          max_concurrent_tasks: 20
          max_task_duration: 120s
          max_api_calls_per_minute: 200
          max_memory_mb: 1024

    quarantine:
      error_threshold: 10  # erros em 5 minutos
      error_window: 300s
      quarantine_duration: 1800s  # 30 minutos
      auto_release: false  # requer aprovacao humana

    throttle:
      cpu_threshold: 0.8
      memory_threshold: 0.85
      throttle_factor: 0.5  # reduz capacidade em 50%
      recovery_window: 300s
```

#### Processo de quarentena de agente

```
[AGENTE COM ERROS EXCESSIVOS]
          |
    Erros > 10 em 5 min?
      /          \
    NAO           SIM
     |             |
  [MONITORAR]  [QUARENTENAR]
                   |
           1. Parar de enviar novas tasks
           2. Aguardar tasks em andamento (max 60s)
           3. Cancelar tasks restantes
           4. Marcar agente como "quarantined"
           5. Enviar alerta para time de agentes
           6. Registrar evento de quarentena
                   |
           [AGUARDAR REVIEW HUMANO]
                   |
           Humano revisa logs e decide:
             /         |          \
          LIBERAR   REINICIAR   DESATIVAR
             |         |           |
          Remover   Restart     Desabilitar
          quarentena  e monitorar  permanentemente
```

#### Acoes PROIBIDAS para auto-remediacao (agentes)

| Acao | Justificativa | Alternativa |
|---|---|---|
| **Alterar prompts de agente** | Pode mudar comportamento clinico | Requer review de especialista |
| **Escalar permissoes de agente** | Principio do menor privilegio | Requer aprovacao de seguranca |
| **Conectar agente a novo data source** | Exposicao potencial de dados | Requer aprovacao humana |
| **Alterar modelo base do agente** | Impacto em qualidade de respostas | Requer testes extensivos |
| **Reprocessar outputs de agente** | Pode duplicar acoes clinicas | Requer revisao clinica |
| **Desabilitar logging de agente** | Perda de auditoria | Nunca automatizado |
| **Permitir egress para novos endpoints** | Exfiltracao de dados | Requer review de seguranca |

---

## Limites Globais de Auto-Remediacao

### Limites por escopo

| Escopo | Limite | Janela | Acao ao exceder |
|---|---|---|---|
| Por pod | 3 restarts | 1 hora | Marcar como "needs-investigation", escalar |
| Por servico | 5 acoes de healing | 1 hora | Cooling period de 30 min, escalar |
| Por namespace | 10 acoes de healing | 1 hora | Deploy freeze no namespace, escalar |
| Cluster-wide | 20 acoes de healing | 1 hora | Escalar para SRE Lead, modo manual |

### Limites por horario

| Horario | Restricao |
|---|---|
| Dias uteis 8h-18h | Todas as acoes permitidas seguem o modelo |
| Dias uteis 18h-22h | Apenas acoes de risco baixo (restart, reconnect) |
| Noite (22h-8h) | Apenas restart e circuit breaker, todas as outras escalam |
| Fins de semana | Apenas restart e circuit breaker, todas as outras escalam |
| Feriados | Apenas restart, todas as outras escalam |

---

## Registro de Eventos de Remediacao

### Formato do registro

```yaml
# Exemplo de evento de remediacao
remediation_event:
  id: "rem-2026-0408-001"
  timestamp: "2026-04-08T14:35:22-03:00"
  
  anomaly:
    type: "pod_crash_loop"
    service: "patient-flow"
    namespace: "velya-dev-core"
    pod: "patient-flow-7d9f8b6c4-x2k9m"
    detected_at: "2026-04-08T14:35:10-03:00"
    detection_method: "kube_pod_container_status_restarts > 3 em 10m"
    
  action:
    type: "pod_restart"
    category: "infrastructure"
    risk_level: "low"
    reversible: true
    blast_radius: "1 pod"
    
  decision:
    permitted: true
    gates_passed:
      - "reversible: true"
      - "blast_radius: known (1 pod)"
      - "post_validation: readiness probe"
      - "timeout: 2 min"
      - "rollback: kubernetes native"
      - "healing_budget: 1/3 (dentro do limite)"
    
  execution:
    started_at: "2026-04-08T14:35:22-03:00"
    completed_at: "2026-04-08T14:35:45-03:00"
    duration: "23s"
    result: "success"
    
  validation:
    post_action_check: "readiness probe passed"
    metrics_stable: true
    observed_for: "5m"
    
  budget:
    service: "patient-flow"
    window: "1h"
    used: 1
    limit: 3
    remaining: 2
```

### Metricas de remediacao

```yaml
groups:
  - name: velya-remediation-metrics
    rules:
      - record: velya:remediation_total
        expr: |
          sum by (service, action_type, result) (
            velya_remediation_events_total
          )

      - record: velya:remediation_success_rate
        expr: |
          sum by (service) (
            velya_remediation_events_total{result="success"}
          )
          /
          sum by (service) (
            velya_remediation_events_total
          )

      - alert: RemediationBudgetExhausted
        expr: |
          sum by (service) (
            increase(velya_remediation_events_total[1h])
          ) >= on(service) velya_healing_budget_limit
        for: 1m
        labels:
          severity: critical
          team: sre
        annotations:
          summary: "Healing budget esgotado para {{ $labels.service }}"
          description: "{{ $value }} remediacoes na ultima hora. Limite atingido. Modo manual ativado."
          action: "Investigar causa raiz. Auto-remediacao suspensa para este servico."

      - alert: RemediationFailureRate
        expr: |
          velya:remediation_success_rate < 0.7
        for: 30m
        labels:
          severity: warning
          team: sre
        annotations:
          summary: "Taxa de sucesso de remediacao baixa para {{ $labels.service }}: {{ $value | humanizePercentage }}"
          description: "Menos de 70% das remediacoes foram bem-sucedidas. Acoes de healing podem ser ineficazes."

      - alert: RemediationEscalationRequired
        expr: |
          velya_remediation_events_total{result="blocked"} > 0
        for: 1m
        labels:
          severity: warning
          team: sre
        annotations:
          summary: "Remediacao bloqueada para {{ $labels.service }} - requer acao humana"
          description: "Auto-remediacao foi bloqueada: {{ $labels.block_reason }}. Verificar e agir manualmente."
```

---

## Matriz de Responsabilidade

| Acao | Quem executa | Quem aprova | Quem valida |
|---|---|---|---|
| Restart de pod | Automatico (K8s) | N/A (dentro do budget) | Readiness probe |
| Scale out | Automatico (HPA/KEDA) | N/A (dentro dos limites) | Metricas de carga |
| Circuit breaker | Automatico (aplicacao) | N/A | Probe request |
| Quarentena de agente | Automatico | SRE revisa para liberar | Humano |
| Rollback de deploy | Automatico (Argo Rollouts) | N/A (AnalysisRun) | Metricas pos-rollback |
| Node drain | Automatico (com cautela) | N/A (dentro do budget) | Pods rescheduled |
| Alteracao de infra | **NUNCA automatico** | Tech Lead + SRE | Pipeline de IaC |
| Alteracao de dados | **NUNCA automatico** | DBA + PO | Validacao manual |
| Alteracao de seguranca | **NUNCA automatico** | Security Lead | Auditoria |
