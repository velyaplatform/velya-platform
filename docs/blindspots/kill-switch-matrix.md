# Matriz de Kill Switches — Velya Platform

> **Versão**: 1.0 | **Atualizado em**: 2026-04-08 | **Dono**: Plataforma e Governança  
> **Propósito**: Matriz de kill switches para todos os processos automatizados da plataforma Velya que podem causar dano em escala. Um kill switch é um mecanismo de parada de emergência que deve ser ativável rapidamente, sem necessidade de deploy, por pessoas com permissão definida.

---

## Princípios de Kill Switches

1. **Ativação deve ser simples**: Um comando, uma flag, uma mudança de ConfigMap — nunca um processo multi-etapas
2. **Ativação deve ser rápida**: Menos de 60 segundos para efeito completo
3. **Dono definido**: Alguém tem que poder decidir e ativar sem depender de outra pessoa
4. **Monitoramento independente**: O sinal que recomenda ativar o kill switch deve ser independente do processo sendo parado
5. **Recuperação documentada**: Existe procedimento para retomar o processo após o kill switch

---

## Tabela Completa de Kill Switches

### KS-001 — Chamadas de Inferência AI por Agent

**O que automatiza**: Agentes fazem chamadas ao Anthropic API automaticamente para processar tasks.

**Blast radius máximo se der errado**: Custo ilimitado de inferência AI. Rate limit esgotado para todos os agents. PHI enviado em loop a provider externo.

**Mecanismo de kill switch**:
```typescript
// ConfigMap kill-switch-config.yaml
data:
  ai_inference_enabled: "false"   # Mudar para false para parar todas as chamadas
  ai_inference_agent_blocklist: "agent-id-1,agent-id-2"  # Bloquear agents específicos
```
```typescript
// AI Gateway verifica antes de cada chamada
const killSwitchEnabled = await config.get('ai_inference_enabled') === 'true';
if (!killSwitchEnabled) {
  throw new KillSwitchActiveError('AI inference está desabilitado por kill switch');
}
```

**Quem pode ativar**: Qualquer engenheiro com kubectl access ao namespace `velya-dev-platform`.

**Comando de ativação**:
```bash
kubectl patch configmap kill-switch-config -n velya-dev-platform \
  --patch '{"data":{"ai_inference_enabled":"false"}}'
```

**Procedimento de recuperação**: Reverter ConfigMap após investigação e resolução da causa.

**Monitoramento que deve disparar recomendação**: 
- Custo AI acima de $X/hora
- Rate de chamadas > 10x baseline
- Erro de rate limit (429) em > 50% das chamadas

**Status atual**: Ausente

---

### KS-002 — Criação Automática de PRs por Agents

**O que automatiza**: Agents criam Pull Requests no GitHub automaticamente para código, configuração, documentação.

**Blast radius máximo se der errado**: Repositório inundado de centenas de PRs automáticos. PRs humanos críticos enterrados no ruído. Custo de GitHub Actions elevado.

**Mecanismo de kill switch**:
```bash
# Mudar permissão do GitHub App/Token do agent para somente leitura
# OU: Adicionar agent-bot à lista de pull request restriction no branch protection
```
```typescript
// Verificar kill switch antes de criar PR
const prCreationEnabled = await config.get('github_pr_creation_enabled') === 'true';
const agentDailyPRCount = await metrics.getAgentDailyPRCount(agentId);
const maxDailyPRs = await config.get('max_daily_prs_per_agent') ?? 5;

if (!prCreationEnabled || agentDailyPRCount >= maxDailyPRs) {
  throw new KillSwitchActiveError('Criação de PRs bloqueada');
}
```

**Quem pode ativar**: Tech lead ou engenheiro sênior.

**Comando de ativação**:
```bash
kubectl patch configmap kill-switch-config -n velya-dev-platform \
  --patch '{"data":{"github_pr_creation_enabled":"false"}}'
```

**Procedimento de recuperação**: Habilitar após definir limite de taxa e revisar PRs pendentes.

**Monitoramento que deve disparar recomendação**: PRs criados por agent > 5 em 1 hora.

**Status atual**: Ausente

---

### KS-003 — Criação Automática de Tarefas

**O que automatiza**: Agents criam tasks no task-inbox-service automaticamente sem intervenção humana.

**Blast radius máximo se der errado**: Backlog inflado com centenas de tasks inúteis. Sistema de task management inutilizável. Equipe clínica sem visibilidade do trabalho real.

**Mecanismo de kill switch**: Flag `task_auto_creation_enabled` no ConfigMap. task-inbox-service verifica antes de aceitar task de agent.

**Quem pode ativar**: Qualquer membro da equipe com kubectl access.

**Monitoramento**: Taxa de criação de tasks por agent > 10/hora.

**Status atual**: Ausente

---

### KS-004 — Execução Automática de Remediação

**O que automatiza**: Agents executam remediações automáticas em resposta a alertas (ex: restart de pod, aplicar ConfigMap, escalar serviço).

**Blast radius máximo se der errado**: Ação de remediação incorreta agrava o problema. Remediação em cascata derruba serviços saudáveis.

**Mecanismo de kill switch**:
```bash
# Revogar RBAC do ServiceAccount do agent de remediação
kubectl delete rolebinding agent-remediation-binding -n velya-dev-core
# OU: Flag de kill switch verificada antes de qualquer ação de remediação
```

**Quem pode ativar**: Engenheiro de plantão (on-call).

**Procedimento de recuperação**: Recriar RBAC após definir escopo correto. Verificar ações de remediação executadas e reverter se necessário.

**Monitoramento**: Mais de 3 ações de remediação em 10 minutos.

**Status atual**: Ausente

---

### KS-005 — Promoção de Agent (draft → shadow → active)

**O que automatiza**: Promoção automática de agents entre estágios de lifecycle baseada em métricas de scorecard.

**Blast radius máximo se der errado**: Agent promovido para active sem validação real. Agent em produção clínica sem baseline de qualidade.

**Mecanismo de kill switch**: Promoção automática deve ser desabilitada por padrão. Toda promoção requer aprovação humana explícita como gate obrigatório.

**Quem pode ativar (para bloquear promoção)**: Governance lead ou Red Team Office.

**Status atual**: Ausente (e promoção automática não deve ser implementada sem gates humanos)

---

### KS-006 — KEDA Autoscaling

**O que automatiza**: KEDA aumenta e diminui número de réplicas de serviços automaticamente baseado em métricas.

**Blast radius máximo se der errado**: Scale para 100+ pods esgota recursos do cluster. KEDA thrash destrói pods continuamente. Em EKS: custo de $500+/hora.

**Mecanismo de kill switch**:
```bash
# Suspender ScaledObject — congela réplicas no valor atual
kubectl patch scaledobject patient-flow-scaledobject -n velya-dev-core \
  --patch '{"spec":{"minReplicaCount":2,"maxReplicaCount":2}}'

# OU: Deletar o ScaledObject (reverte para Deployment sem autoscaling)
kubectl delete scaledobject patient-flow-scaledobject -n velya-dev-core
```

**Quem pode ativar**: Qualquer engenheiro com kubectl access.

**Procedimento de recuperação**: Recriar ScaledObject com configuração corrigida após investigar causa.

**Monitoramento**: Scaling events > 10 em 1 hora. Réplicas > maxReplicaCount esperado.

**Status atual**: Parcial (ScaledObjects existem mas sem kill switch documentado)

---

### KS-007 — ArgoCD Auto-Sync

**O que automatiza**: ArgoCD sincroniza automaticamente o cluster com o estado do Git.

**Blast radius máximo se der errado**: Manifesto incorreto no Git aplicado automaticamente ao cluster. Múltiplos serviços derrubados por sync de configuração errada.

**Mecanismo de kill switch**:
```bash
# Desabilitar auto-sync para Application específica
argocd app set patient-flow-app --sync-policy none

# Desabilitar auto-sync para TODAS as Applications
for app in $(argocd app list -o name); do
  argocd app set $app --sync-policy none
done
```

**Quem pode ativar**: Qualquer engenheiro com acesso ao ArgoCD.

**Procedimento de recuperação**: Reabilitar auto-sync após verificar que o estado do Git está correto.

**Monitoramento**: Sync failure em qualquer Application. Deployment de serviço crítico fora do esperado após sync.

**Status atual**: N/A (ArgoCD instalado mas sem Applications configuradas — kill switch não necessário ainda)

---

### KS-008 — Version-Bump Workflow (GitHub Actions)

**O que automatiza**: Workflow que faz bump automático de versões de dependências npm/GitHub Actions.

**Blast radius máximo se der errado**: Breaking change introduzido por bump automático. CI quebrado para todos os PRs. Serviços com regressão após merge automático.

**Mecanismo de kill switch**:
```bash
# Desabilitar workflow no GitHub
gh workflow disable version-bump.yml

# OU: Fechar todos os PRs pendentes de version bump
gh pr list --label "version-bump" --json number | jq '.[].number' | \
  xargs -I{} gh pr close {}
```

**Quem pode ativar**: Tech lead ou engenheiro sênior.

**Monitoramento**: CI falhou após merge de version bump. Testes regressivos falhando após bump.

**Status atual**: Ausente (workflow existe mas sem kill switch documentado)

---

### KS-009 — Release Workflow (GitHub Actions)

**O que automatiza**: Workflow que cria releases automáticas e faz push de imagens Docker para registry.

**Blast radius máximo se der errado**: Versão defeituosa publicada e deployada automaticamente. Imagem com vulnerability crítica em produção.

**Mecanismo de kill switch**:
```bash
# Desabilitar workflow de release
gh workflow disable release.yml

# Retirar imagem defeituosa do registry (ECR)
aws ecr batch-delete-image --repository-name velya/patient-flow-service \
  --image-ids imageTag=v1.2.3-defeituosa
```

**Quem pode ativar**: Tech lead ou security engineer.

**Monitoramento**: CVE crítico detectado em imagem publicada. Erro de health check após deploy de nova versão.

**Status atual**: Ausente

---

### KS-010 — Propagação de Aprendizado (Learning Loop)

**O que automatiza**: Learning loop propaga novos padrões e aprendizados de agents para a memória institucional compartilhada.

**Blast radius máximo se der errado**: Padrão incorreto propagado como boa prática para todos os agents. Comportamento sistêmico incorreto em toda a plataforma.

**Mecanismo de kill switch**:
```bash
# Parar propagação de novos aprendizados
kubectl patch configmap kill-switch-config -n velya-dev-platform \
  --patch '{"data":{"learning_propagation_enabled":"false"}}'

# Reverter para versão anterior da memória institucional
memory-service rollback --to-version v123
```

**Quem pode ativar**: Governance lead.

**Monitoramento**: Desvio de comportamento de agent em relação ao baseline. Aumento de erros após propagação de novo padrão.

**Status atual**: Ausente

---

### KS-011 — Intake de Market Intelligence

**O que automatiza**: Agent de market intelligence processa automaticamente novos inputs de mercado (competitors, regulação, etc.) e inclui no contexto.

**Blast radius máximo se der errado**: Conteúdo de fonte comprometida contamina contexto de análise. Custo elevado de web search + LLM por intake em loop.

**Mecanismo de kill switch**:
```bash
kubectl patch configmap kill-switch-config -n velya-dev-agents \
  --patch '{"data":{"market_intelligence_intake_enabled":"false"}}'
```

**Quem pode ativar**: Qualquer membro da equipe.

**Monitoramento**: Número de intakes > threshold. Conteúdo suspeito detectado em intake.

**Status atual**: Ausente

---

### KS-012 — Ações de Threshold de Custo

**O que automatiza**: Sistema de controle de custo que toma ações automáticas quando thresholds são atingidos (ex: reduzir réplicas, pausar agents menos críticos).

**Blast radius máximo se der errado**: Ação de redução de custo derruba serviço clínico crítico. Falsa alarme de custo causa degradação desnecessária da plataforma.

**Mecanismo de kill switch**: Desabilitar ações automáticas de controle de custo, mantendo apenas alertas.

```bash
kubectl patch configmap kill-switch-config -n velya-dev-platform \
  --patch '{"data":{"cost_auto_action_enabled":"false","cost_alerts_enabled":"true"}}'
```

**Quem pode ativar**: Engenheiro sênior ou tech lead.

**Status atual**: Ausente (sistema de controle de custo não implementado ainda)

---

### KS-013 — Quarantine Automática de Agents

**O que automatiza**: Sistema de governança que move agents automaticamente para quarentena quando scorecard cai abaixo de threshold.

**Blast radius máximo se der errado**: Agent crítico colocado em quarentena incorretamente durante operação clínica. Trabalho parado por falsa positiva de qualidade.

**Mecanismo de kill switch**: Desabilitar quarentena automática, mantendo apenas alertas para revisão humana.

**Quem pode ativar**: Governance lead.

**Status atual**: Ausente

---

### KS-014 — Retirement Automático de Agents

**O que automatiza**: Sistema que aposenta automaticamente agents que não atendem a critérios mínimos por período prolongado.

**Blast radius máximo se der errado**: Agent essencial removido por erro de threshold. Funcionalidade perdida sem perceber.

**Mecanismo de kill switch**: Desabilitar retirement automático. Toda aposentadoria requer aprovação humana.

**Quem pode ativar**: Governance lead.

**Status atual**: Ausente (e retirement automático não deve ser implementado sem gates humanos)

---

### KS-015 — Criação de ScaledObjects por Agents

**O que automatiza**: Agents de infraestrutura criam ScaledObjects KEDA automaticamente para novos serviços.

**Blast radius máximo se der errado**: ScaledObject mal-configurado causa thrash de scaling ou escala para maxReplicaCount excessivo.

**Mecanismo de kill switch**:
```bash
# Revogar permissão de criar ScaledObjects do ServiceAccount do agent
kubectl delete rolebinding agent-infra-scaledobject-creator -n velya-dev-core
```

**Quem pode ativar**: Engenheiro de plataforma.

**Monitoramento**: ScaledObject criado fora do processo normal de review.

**Status atual**: Ausente

---

### KS-016 — Rotação de Secrets

**O que automatiza**: External Secrets Operator rotaciona secrets automaticamente conforme política de TTL.

**Blast radius máximo se der errado**: Rotação em momento inoportuno causa falha de autenticação em todos os serviços que usam o secret. Sem restart dos pods, serviços continuam com secret antigo (revogado).

**Mecanismo de kill switch**:
```bash
# Suspender sincronização do External Secrets Operator
kubectl annotate externalsecret velya-api-keys \
  reconcile.external-secrets.io/paused=true -n velya-dev-core
```

**Quem pode ativar**: Engenheiro de plataforma ou DevOps.

**Procedimento de recuperação**: Verificar que todos os pods foram reiniciados com novo secret. Reabilitar sincronização.

**Monitoramento**: Erros de autenticação em cascata após rotação de secret.

**Status atual**: Ausente (External Secrets Operator não implementado ainda)

---

### KS-017 — Atualização de Dependências (Renovate/Dependabot)

**O que automatiza**: Renovate ou Dependabot cria PRs automaticamente para atualizar dependências npm e GitHub Actions.

**Blast radius máximo se der errado**: Breaking change mergeado automaticamente. CI quebrado para toda a equipe.

**Mecanismo de kill switch**:
```bash
# Pausar Renovate
gh api repos/velya-health/velya-platform/contents/renovate.json \
  -X PUT --input - <<'EOF'
{"enabled": false}
EOF

# OU: Fechar todos os PRs de dependência abertos
gh pr list --label "dependencies" --json number | \
  jq '.[].number' | xargs -I{} gh pr close {}
```

**Quem pode ativar**: Qualquer engenheiro.

**Status atual**: Ausente

---

### KS-018 — Build e Push de Imagens Docker

**O que automatiza**: Pipeline CI constrói e faz push de imagens Docker para o registry automaticamente em cada merge para main.

**Blast radius máximo se der errado**: Imagem com vulnerability crítica ou bug grave publicada e usada em deploy automático.

**Mecanismo de kill switch**:
```bash
# Desabilitar workflow de build
gh workflow disable docker-build.yml

# Bloquear pull da imagem no registry (ECR — adicionar policy de deny)
aws ecr set-repository-policy --repository-name velya/patient-flow-service \
  --policy-text '{"Statement":[{"Effect":"Deny","Principal":"*","Action":"ecr:GetDownloadUrlForLayer"}]}'
```

**Quem pode ativar**: Engenheiro de segurança ou DevOps.

**Status atual**: Ausente

---

### KS-019 — Notificações Automáticas Para Equipe Clínica

**O que automatiza**: Sistema envia notificações automáticas para médicos e enfermeiros sobre alertas de pacientes, status de alta, etc.

**Blast radius máximo se der errado**: Flood de notificações para equipe clínica. Alert fatigue. Notificações incorretas sobre status de paciente errado.

**Mecanismo de kill switch**:
```bash
# Suspender notificações para equipe clínica
kubectl patch configmap kill-switch-config -n velya-dev-core \
  --patch '{"data":{"clinical_notifications_enabled":"false"}}'
```

**Quem pode ativar**: Qualquer membro da equipe.

**Monitoramento**: Taxa de notificações > 10x baseline. Reclamações da equipe clínica sobre flood.

**Status atual**: Ausente

---

### KS-020 — Escalonamento de Alertas (Alert Escalation)

**O que automatiza**: Sistema escala alertas automaticamente para diferentes destinatários baseado em severidade e tempo sem resposta.

**Blast radius máximo se der errado**: Escalação incorreta durante horário de descanso. Pessoas erradas notificadas. Loop de escalação (A escala para B que escala para A).

**Mecanismo de kill switch**:
```bash
# Suspender escalação automática no Alertmanager
kubectl patch secret alertmanager-config -n velya-dev-observability \
  --patch '{"data":{"alertmanager.yaml":"'$(echo '{"route":{"receiver":"blackhole"}}' | base64)'"}}'
```

**Quem pode ativar**: Engenheiro de plantão.

**Status atual**: Ausente (Alertmanager sem receivers — escalação não funciona de qualquer forma)

---

## Resumo de Status

| ID | Processo | Blast Radius | Status | Prioridade |
|---|---|---|---|---|
| KS-001 | Inferência AI por agent | Custo ilimitado + PHI em loop | Ausente | Crítica |
| KS-002 | Criação de PRs automáticos | Repositório inundado | Ausente | Alta |
| KS-003 | Criação de tarefas | Backlog inutilizável | Ausente | Alta |
| KS-004 | Execução de remediação | Cascata de ações incorretas | Ausente | Crítica |
| KS-005 | Promoção de agents | Agent sem validação em produção | Ausente | Crítica |
| KS-006 | KEDA autoscaling | Custo exponencial de pods | Parcial | Alta |
| KS-007 | ArgoCD auto-sync | Manifesto incorreto aplicado | N/A (sem apps) | Alta |
| KS-008 | Version-bump workflow | Breaking change em produção | Ausente | Alta |
| KS-009 | Release workflow | Imagem defeituosa publicada | Ausente | Alta |
| KS-010 | Propagação de aprendizado | Padrão errado sistêmico | Ausente | Alta |
| KS-011 | Market intelligence intake | Contaminação de contexto | Ausente | Média |
| KS-012 | Ações de custo automáticas | Serviço clínico derrubado | Ausente | Alta |
| KS-013 | Quarantine automática | Parada de serviço crítico | Ausente | Média |
| KS-014 | Retirement automático | Funcionalidade perdida | Ausente | Média |
| KS-015 | Criação de ScaledObjects | Thrash ou escala excessiva | Ausente | Alta |
| KS-016 | Rotação de secrets | Autenticação em cascata | Ausente | Alta |
| KS-017 | Renovate/Dependabot | Breaking change mergeado | Ausente | Alta |
| KS-018 | Build e push de imagens | Imagem defeituosa publicada | Ausente | Alta |
| KS-019 | Notificações clínicas | Alert fatigue / notif. incorreta | Ausente | Alta |
| KS-020 | Escalonamento de alertas | Loop de escalação / pessoas erradas | Ausente | Média |

> **Situação crítica**: 19 de 20 kill switches estão Ausentes. Apenas KS-006 (KEDA) tem implementação parcial. A plataforma não tem mecanismos de parada de emergência para os processos automatizados mais críticos. Antes de ativar qualquer automação em produção, os kill switches correspondentes devem ser implementados.
