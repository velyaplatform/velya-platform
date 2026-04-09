# Modelo de Prontidao para Rollback

> Documento 09 - Layered Assurance + Self-Healing  
> Plataforma Velya - Sistema Hospitalar Inteligente  
> Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

Em um sistema hospitalar, a capacidade de reverter mudancas rapidamente e com seguranca e uma exigencia critica. Um rollback mal executado pode ser tao perigoso quanto a falha original. Este documento define estrategias de rollback por tipo de mudanca, criterios de decisao, SLAs, e procedimentos de validacao pos-rollback.

---

## 2. Estrategias de Rollback por Tipo de Mudanca

### 2.1 Deploy de Aplicacao (Argo Rollouts)

**Mecanismo:** Argo Rollouts com estrategia canary ou blue-green

**Trigger conditions para rollback automatico:**
- Error rate > 1% durante analise canary
- P99 latency > 2x baseline durante analysis run
- Health check failure em 2+ pods consecutivos
- Prometheus query retorna resultado fora do threshold

**Trigger conditions para rollback manual:**
- Relato de comportamento incorreto por equipe clinica
- Dados inconsistentes detectados em audit-service
- Decisao de agente clinico classificada como incorreta

**Decisao automatico vs manual:**

```
Rollback de aplicacao
|
+-- Argo Rollouts analysis detectou falha?
|   |
|   +-- SIM --> Rollback AUTOMATICO (abort)
|   +-- NAO --> Rollback detectado por outra fonte?
|               |
|               +-- Error rate subiu pos-deploy?
|               |   +-- SIM, > 1% --> Rollback AUTOMATICO via alert
|               |   +-- SIM, < 1% --> Avaliacao MANUAL (30min window)
|               |
|               +-- Impacto clinico reportado?
|                   +-- SIM --> Rollback MANUAL IMEDIATO (sem esperar analise)
|                   +-- NAO --> Monitorar por 2h, depois avaliar
```

**Passos do rollback:**

1. Argo Rollouts executa `abort` na revision atual
2. Replicas do canary sao terminadas
3. Trafego retorna 100% para revision estavel
4. Verificacao de metricas pos-rollback (5 minutos)
5. Notificacao em `#velya-deploys` com diff do que foi revertido
6. Criacao automatica de issue com label `rollback` e link para traces

**Validacao pos-rollback:**
- Error rate voltou ao baseline (tolerancia 0.1%)
- P99 latency voltou ao baseline (tolerancia 10%)
- Health checks passando em todos os pods
- Nenhum request em flight perdido (verificar logs de 502/503)

**SLA:** 2 minutos para rollback automatico, 10 minutos para manual

**YAML - Argo Rollouts com abort automatico:**

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: patient-flow
  namespace: velya-clinical
  labels:
    velya.io/service: patient-flow
    velya.io/rollback-strategy: canary-auto
spec:
  replicas: 4
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app: patient-flow
  strategy:
    canary:
      maxSurge: 1
      maxUnavailable: 0
      canaryService: patient-flow-canary
      stableService: patient-flow-stable
      trafficRouting:
        nginx:
          stableIngress: patient-flow-ingress
          additionalIngressAnnotations:
            canary-by-header: X-Velya-Canary
      steps:
        - setWeight: 5
        - pause: { duration: 2m }
        - analysis:
            templates:
              - templateName: patient-flow-canary-analysis
            args:
              - name: service-name
                value: patient-flow
              - name: canary-hash
                valueFrom:
                  podTemplateHashValue: Latest
        - setWeight: 25
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: patient-flow-canary-analysis
        - setWeight: 50
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: patient-flow-canary-analysis
        - setWeight: 100
      analysis:
        successfulRunHistoryLimit: 3
        unsuccessfulRunHistoryLimit: 5
      antiAffinity:
        preferredDuringSchedulingIgnoredDuringExecution:
          weight: 100
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: patient-flow-canary-analysis
  namespace: velya-clinical
spec:
  args:
    - name: service-name
    - name: canary-hash
  metrics:
    - name: error-rate
      interval: 30s
      failureLimit: 3
      successCondition: result[0] < 0.01
      provider:
        prometheus:
          address: http://prometheus.observability:9090
          query: |
            sum(rate(http_requests_total{
              service="{{args.service-name}}",
              pod_template_hash="{{args.canary-hash}}",
              status=~"5.."
            }[2m])) /
            sum(rate(http_requests_total{
              service="{{args.service-name}}",
              pod_template_hash="{{args.canary-hash}}"
            }[2m]))

    - name: latency-p99
      interval: 30s
      failureLimit: 3
      successCondition: result[0] < 1.0
      provider:
        prometheus:
          address: http://prometheus.observability:9090
          query: |
            histogram_quantile(0.99,
              sum(rate(http_request_duration_seconds_bucket{
                service="{{args.service-name}}",
                pod_template_hash="{{args.canary-hash}}"
              }[2m])) by (le)
            )

    - name: saturation
      interval: 60s
      failureLimit: 2
      successCondition: result[0] < 0.85
      provider:
        prometheus:
          address: http://prometheus.observability:9090
          query: |
            max(container_memory_working_set_bytes{
              pod=~"patient-flow-.*-{{args.canary-hash}}-.*"
            }) /
            max(kube_pod_container_resource_limits{
              pod=~"patient-flow-.*-{{args.canary-hash}}-.*",
              resource="memory"
            })
```

### 2.2 Infraestrutura (OpenTofu State Restore)

**Mecanismo:** OpenTofu state versioning + plan reverso

**Trigger conditions:**
- Recurso AWS criado/modificado causa falha de conectividade
- Security group alterado bloqueia trafego legitimo
- IAM role alterada quebra permissoes de servico
- RDS parameter group causa degradacao de performance

**Decisao automatico vs manual:**
- Infraestrutura SEMPRE requer rollback MANUAL com aprovacao dupla
- Excecao: security group que bloqueia health checks pode ter rollback semi-automatico

**Passos:**

1. Identificar commit do OpenTofu que causou o problema
2. `git revert <commit>` no repositorio de infra
3. `tofu plan` para verificar o plano reverso
4. Revisao do plano por segundo engenheiro
5. `tofu apply` com aprovacao
6. Verificar conectividade e health checks
7. Documentar no post-mortem

**Validacao pos-rollback:**
- Todos os servicos com health check verde
- Conectividade entre VPCs/subnets restaurada
- IAM roles funcionais (testar com `aws sts assume-role`)
- DNS resolution funcionando

**SLA:** 30 minutos (inclui revisao humana obrigatoria)

### 2.3 GitOps (ArgoCD Revert)

**Mecanismo:** ArgoCD sync para commit anterior no Git

**Trigger conditions:**
- ConfigMap/Secret alterado causa falha de aplicacao
- Resource limit alterado causa OOMKill
- NetworkPolicy alterada bloqueia comunicacao entre servicos
- RBAC alterado remove permissoes necessarias

**Passos:**

1. Identificar commit problematico no historico ArgoCD
2. No ArgoCD UI ou CLI: `argocd app sync <app> --revision <commit-anterior>`
3. Ou: `git revert` no repo de manifests + push
4. ArgoCD detecta drift e sincroniza automaticamente
5. Verificar que todos os recursos voltaram ao estado anterior
6. Verificar logs de pods para confirmar configuracao correta

**Validacao pos-rollback:**
- ArgoCD mostra app como `Synced` e `Healthy`
- Nenhum pod em `CrashLoopBackOff`
- ConfigMaps/Secrets com valores corretos
- NetworkPolicies permitindo trafego esperado

**SLA:** 5 minutos

### 2.4 Banco de Dados (Migration Backward Compatibility)

**Mecanismo:** Migracao reversa pre-definida + validacao de dados

**REGRA FUNDAMENTAL:** Toda migracao DEVE ser backward-compatible por pelo menos 2 releases.

**Trigger conditions:**
- Query performance degradada apos migracao
- Constraint violation em dados existentes
- Index novo causa lock contention
- Dados corrompidos por migracao com bug

**Decisao automatico vs manual:**
- SEMPRE manual para banco de dados
- Requer DBA ou engenheiro senior
- Backup point-in-time deve existir antes de qualquer migracao

**Passos:**

1. Verificar se migracao reversa existe (`migrations/down/`)
2. Se nao existe: avaliar se rollback da aplicacao e suficiente
3. Executar migracao reversa em ambiente de staging primeiro
4. Verificar integridade dos dados pos-reversao
5. Executar em producao com monitoramento ativo
6. Validar que aplicacao anterior funciona com schema revertido

**Validacao pos-rollback:**
- Integrity checks passando (foreign keys, constraints)
- Query performance voltou ao baseline
- Nenhum dado perdido (comparar counts de tabelas afetadas)
- Aplicacao anterior consegue ler/escrever normalmente

**SLA:** 60 minutos (inclui validacao de dados)

**Regras de backward compatibility:**

```
Mudanca de schema
|
+-- Adicao de coluna?
|   +-- Com default NOT NULL --> OK, backward compatible
|   +-- Nullable --> OK, backward compatible
|   +-- NOT NULL sem default --> PROIBIDO, quebra rollback
|
+-- Remocao de coluna?
|   +-- Coluna usada pela versao anterior? --> PROIBIDO
|   +-- Release N-1 nao usa a coluna? --> OK, pode remover no release N
|
+-- Alteracao de tipo?
|   +-- Ampliacao (int -> bigint) --> OK
|   +-- Reducao (varchar(200) -> varchar(100)) --> PROIBIDO
|   +-- Tipo incompativel --> PROIBIDO, requer migracao em 3 fases
|
+-- Rename de coluna?
|   +-- PROIBIDO. Usar alias ou view temporaria.
```

### 2.5 Secrets (Version Rollback)

**Mecanismo:** External Secrets Operator + AWS Secrets Manager versioning

**Trigger conditions:**
- Servico falha ao autenticar apos rotacao
- Certificado novo rejeitado por client
- API key rotacionada mas consumer nao atualizado

**Passos:**

1. Identificar secret com problema no External Secrets Operator
2. No AWS Secrets Manager: restaurar versao anterior
3. External Secrets Operator sincroniza automaticamente (polling interval)
4. Se urgente: forcar sync com `kubectl annotate externalsecret <name> force-sync=true`
5. Pods que usam o secret via env var: necessitam restart
6. Pods que usam via volume mount: atualizam automaticamente

**Validacao pos-rollback:**
- Servico autenticando com sucesso
- Nenhum log de `401 Unauthorized` ou `403 Forbidden`
- External Secret mostra `SecretSynced` condition

**SLA:** 5 minutos (sync automatico) ou 2 minutos (sync forcado)

### 2.6 Agentes (Lifecycle Stage Revert)

**Mecanismo:** Agent Orchestrator lifecycle management + memory-service state

**Trigger conditions:**
- Agente promovido apresenta taxa de erro > threshold
- Decisoes do agente divergem de policy-engine
- Agente consome recursos acima do budget
- Feedback negativo consistente da equipe clinica

**Passos:**

1. Agent Orchestrator recebe sinal de rollback
2. Agente atual e movido para estado `cooling`
3. Versao anterior e restaurada do memory-service
4. Agente anterior e ativado em estado `warming`
5. Trafego redirecionado gradualmente (canary de agente)
6. Se agente anterior estavel: agente novo vai para `quarantine`
7. decision-log-service registra todas as decisoes do periodo

**Validacao pos-rollback:**
- Agent heartbeat ativo
- Taxa de erro abaixo do threshold
- Policy compliance verificada
- Memory-service com estado consistente
- Feedback positivo da equipe clinica (24h)

**SLA:** 15 minutos para rollback, 24h para validacao completa

---

## 3. Matriz de Decisao de Rollback

### 3.1 Risco x Reversibilidade

|  | Facilmente Reversivel | Parcialmente Reversivel | Dificilmente Reversivel |
|---|---|---|---|
| **Risco Baixo** | Monitorar 1h, reverter se necessario | Monitorar 30min, reverter se necessario | Monitorar 15min, reverter proativamente |
| **Risco Medio** | Rollback automatico se metricas degradam | Rollback manual com aprovacao simples | Rollback manual com aprovacao dupla |
| **Risco Alto** | Rollback automatico agressivo (threshold baixo) | Rollback manual imediato ao primeiro sinal | Rollback manual com DBA/SRE senior + backup verificado |
| **Risco Critico** | Deploy em canary minimo (1%), rollback auto | Nao permitir sem rollback plan validado | PROIBIDO sem dry-run em staging + backup + aprovacao tripla |

### 3.2 Classificacao de Reversibilidade por Tipo

| Tipo de Mudanca | Reversibilidade | Justificativa |
|---|---|---|
| Deploy de aplicacao | Facilmente Reversivel | Argo Rollouts mantem revision anterior ativa |
| ConfigMap/Secret | Facilmente Reversivel | Git history + External Secrets versioning |
| Network Policy | Facilmente Reversivel | Git revert + ArgoCD sync |
| Scaling config (HPA/VPA/KEDA) | Facilmente Reversivel | Git revert, efeito imediato |
| Infraestrutura (OpenTofu) | Parcialmente Reversivel | Alguns recursos nao revertem limpo (ex: KMS key deletion) |
| Database migration (additive) | Parcialmente Reversivel | Adicoes sao reversiveis, mas dados criados podem depender |
| Database migration (destructive) | Dificilmente Reversivel | Dados podem ser perdidos irreversivelmente |
| Secret rotation | Parcialmente Reversivel | Versao anterior disponivel, mas consumers podem ter cacheado |
| Agent promotion | Parcialmente Reversivel | Estado e memoria do agente podem ter divergido |
| Policy update | Facilmente Reversivel | Git revert no policy-engine |

---

## 4. Rollback Drill (Simulacao de Rollback)

### 4.1 Calendario

| Drill | Frequencia | Escopo | Participantes |
|---|---|---|---|
| Application rollback | Mensal | 1 servico por vez, rotativo | SRE + dev team do servico |
| Database rollback | Trimestral | Staging first, depois producao com dados sinteticos | SRE + DBA |
| Infrastructure rollback | Trimestral | Componente nao-critico em producao | SRE + infra team |
| Agent rollback | Mensal | Agente em modo shadow | AI-ops + clinical-eng |
| Full stack rollback | Semestral | Todos os tipos combinados | Todos os times |
| Secret rotation rollback | Trimestral | Um secret por vez | SRE + security |

### 4.2 Procedimento do Drill

```
1. PREPARACAO (1 dia antes)
   |
   +-- Definir servico/componente alvo
   +-- Verificar que rollback plan existe e esta atualizado
   +-- Notificar times afetados
   +-- Preparar dashboard de monitoramento
   +-- Definir criterios de sucesso e abort do drill
   |
2. EXECUCAO
   |
   +-- Iniciar gravacao de tela (para revisao posterior)
   +-- Simular falha ou deploy ruim
   +-- Cronometrar tempo de deteccao
   +-- Cronometrar tempo de decisao
   +-- Executar rollback
   +-- Cronometrar tempo total de recuperacao
   |
3. VALIDACAO
   |
   +-- Verificar que sistema voltou ao estado anterior
   +-- Verificar que nenhum dado foi perdido
   +-- Verificar que alertas dispararam corretamente
   +-- Verificar que notificacoes chegaram nos canais corretos
   |
4. RETROSPECTIVA
   |
   +-- Comparar tempos medidos com SLAs definidos
   +-- Identificar gaps no procedimento
   +-- Atualizar runbooks se necessario
   +-- Registrar resultados no documento de drills
```

### 4.3 Template de Resultado do Drill

```yaml
# drill-results/2026-04-patient-flow-rollback.yaml
drill:
  date: "2026-04-15"
  type: application-rollback
  target: patient-flow
  participants:
    - name: "Eng. Silva"
      role: executor
    - name: "Eng. Costa"
      role: observer
  
  metrics:
    detection_time_seconds: 45
    decision_time_seconds: 30
    rollback_execution_seconds: 90
    validation_time_seconds: 180
    total_recovery_seconds: 345
  
  sla_compliance:
    detection: true    # SLA: 60s
    execution: true    # SLA: 120s
    total: true        # SLA: 600s
  
  issues_found:
    - description: "Runbook referenciava dashboard antigo"
      severity: low
      action: "Atualizar link no runbook"
      owner: "platform-sre"
    
  result: PASS
  notes: "Rollback executado dentro do SLA. Dashboard precisa atualizacao."
```

---

## 5. Pre-requisitos de Rollback por Servico

### 5.1 Checklist de Prontidao

Para cada servico da Velya, os seguintes pre-requisitos DEVEM estar atendidos:

| Pre-requisito | patient-flow | task-inbox | discharge-orch | audit-service | ai-gateway | memory-service | policy-engine | decision-log | velya-web | agent-orch |
|---|---|---|---|---|---|---|---|---|---|---|
| Argo Rollout configurado | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| Revision anterior preservada | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| Canary analysis definido | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Nao* | Sim | Sim |
| DB migration reversivel | Sim | Sim | Sim | Sim | N/A | Sim | N/A | Sim | N/A | N/A |
| Secret versioning ativo | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| Runbook de rollback | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| Drill executado (< 90d) | Sim | Sim | Sim | Sim | Sim | Nao** | Sim | Nao** | Sim | Sim |

> *decision-log-service usa deploy simples (append-only, sem breaking changes)  
> **Pendente agendamento

---

## 6. Comandos Rapidos de Rollback

### 6.1 Aplicacao (Argo Rollouts)

```bash
# Abortar rollout em andamento (volta para stable)
kubectl argo rollouts abort patient-flow -n velya-clinical

# Desfazer abort e retomar (se necessario tentar novamente)
kubectl argo rollouts retry patient-flow -n velya-clinical

# Reverter para revision especifica
kubectl argo rollouts undo patient-flow -n velya-clinical --to-revision=3

# Ver historico de revisions
kubectl argo rollouts get rollout patient-flow -n velya-clinical
```

### 6.2 GitOps (ArgoCD)

```bash
# Sync para commit anterior
argocd app sync patient-flow --revision abc123def

# Ver historico de syncs
argocd app history patient-flow

# Rollback para deploy anterior
argocd app rollback patient-flow 5
```

### 6.3 Infraestrutura (OpenTofu)

```bash
# Ver state antes da mudanca
tofu state list

# Plan reverso (apos git revert)
tofu plan -out=rollback.plan

# Aplicar rollback com aprovacao
tofu apply rollback.plan
```

### 6.4 Secrets (External Secrets)

```bash
# Forcar resync do External Secret
kubectl annotate externalsecret patient-flow-secrets \
  force-sync=$(date +%s) -n velya-clinical --overwrite

# Ver status do sync
kubectl get externalsecret patient-flow-secrets -n velya-clinical -o yaml

# Restaurar versao anterior no AWS Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id velya/patient-flow/db-credentials \
  --version-stage AWSPREVIOUS
```

---

## 7. Anti-patterns de Rollback

| Anti-pattern | Por que e perigoso | O que fazer em vez disso |
|---|---|---|
| Rollback sem verificar estado do banco | Aplicacao antiga pode nao funcionar com schema novo | Sempre verificar compatibilidade schema x aplicacao |
| Rollback de infra sem plan | Pode destruir recursos nao relacionados | Sempre executar `tofu plan` antes |
| Rollback manual via kubectl edit | Drift com Git, ArgoCD vai sobrescrever | Sempre reverter via Git + ArgoCD sync |
| Rollback de todos os servicos simultaneamente | Pode causar inconsistencia entre servicos | Reverter um por vez, validando dependencias |
| Rollback sem notificar equipe clinica | Equipe pode estar no meio de processo critico | Sempre notificar antes, exceto emergencia P0 |
| Rollback e esquecimento | Causa raiz nao e investigada | Sempre criar issue de follow-up pos-rollback |
| Rollback durante horario de pico clinico | Risco de impacto em atendimento | Preferir janelas de menor movimento, exceto emergencia |

---

## 8. Fluxo Completo de Decisao de Rollback

```
Incidente detectado
|
+-- Impacto em seguranca do paciente?
|   |
|   +-- SIM --> ROLLBACK IMEDIATO
|   |           Nao esperar aprovacao
|   |           Notificar pos-facto
|   |           SLA: 2 minutos
|   |
|   +-- NAO --> Impacto em funcionalidade critica?
|               |
|               +-- SIM --> Rollback com aprovacao rapida
|               |           1 aprovador (tech lead ou SRE)
|               |           SLA: 10 minutos
|               |
|               +-- NAO --> Impacto em funcionalidade nao-critica?
|                           |
|                           +-- SIM --> Avaliar fix-forward vs rollback
|                           |           Se fix < 30min: fix-forward
|                           |           Se fix > 30min: rollback
|                           |
|                           +-- NAO --> Monitorar, nao reverter
|                                       Criar issue para investigacao
```

---

## 9. Metricas de Rollback

### 9.1 KPIs de Prontidao

| Metrica | Target | Medicao |
|---|---|---|
| MTTR (Mean Time to Rollback) | < 5min (app), < 30min (infra) | Tempo medio real de rollbacks |
| Rollback success rate | > 99% | Rollbacks que restauraram servico |
| Drill compliance | 100% dos servicos com drill < 90d | Calendario de drills |
| Rollback plan coverage | 100% dos servicos | Auditoria trimestral |
| Time to detect need for rollback | < 2min (auto), < 10min (manual) | Tempo entre deploy e decisao |

### 9.2 Prometheus Metrics

```yaml
# Metricas emitidas pelo sistema de rollback
velya_rollback_total{service, type, trigger, result}
velya_rollback_duration_seconds{service, type}
velya_rollback_drill_last_timestamp{service}
velya_rollback_drill_result{service, result}
```
