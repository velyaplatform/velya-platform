# Fleet Reality Check — Auto-Remediation, Cost & Governance

**Data:** 2026-04-20 14:40 UTC-3
**Autor:** main-session (audit inline, após morte silenciosa de 3 subagents em background)
**Escopo:** Lince SOC / Velya — `lince-hml` cluster (AWS account `706922781464`)
**Gatilho:** User demanded evidence de que a frota de agents/workflows/mechanisms/docs/memory realmente resolve problemas automaticamente — não cosmético. Sessão precedida por ~1h de toil manual (LocalStack, kubeconfig, EKS allowlist) que a frota deveria ter prevenido.

---

## 1. Executive summary

- **Funcional hoje**: `argocd-sync-agent` (auto-fix real de apps OutOfSync), `opencost` (métricas reais por namespace), 13 CronJobs da autopilot rodando no schedule. **Isso é ~12% da frota declarada.**
- **Teatro**: 88% dos 105 agents declarados nunca apareceram no ledger. `knowledge-base-keeper-agent` referencia uma base de conhecimento que **não existe** (`.claude/knowledge/` ausente). Validation chain é markdown aspiracional — sem evidência de validator distinto do executor.
- **Crítico (blind spot que custou ~1h hoje)**: nenhum agent cobre (a) higiene de shell/dev-workstation, (b) drift de kubeconfig, (c) exposição pública do EKS control plane. **Eram 3 falhas preveníveis e a frota de 105 agents passou por elas em silêncio.**
- **Cost governance**: `opencost` real, mas `pvCost=0` (EBS pricing não configurado), `cost-anomaly` CronJob foi criado hoje 56min atrás e primeira execução só amanhã 06:30, `finops-reviewer` agent com 1 entrada histórica — não está resolvendo nada continuamente.
- **Ação recomendada nos próximos 3 dias**: criar 4 agents que faltam, configurar EBS pricing no opencost, primeira execução manual do `cost-anomaly`, converter `argocd-sync-agent` para escrever no ledger (única evidência quantitativa atual).

---

## 2. Frota declarada vs. frota viva

| Métrica | Valor | Fonte |
|---|---|---|
| Agents declarados | **105** em `.claude/agents/*.md` | `ls` |
| Agents com registro no ledger (campo `to:`) | **12** (11.4%) | grep |
| CronJobs vivos em `linceplatform-autopilot` | **13** | `kubectl get cronjob` |
| CronJobs vivos em `control-plane` | **3** (criados hoje) | `kubectl get cronjob` |
| Workflows GitHub Actions com `schedule:` | **13** | grep |
| Delegações totais no ledger | **31** linhas | `wc -l` |
| Agents com KB (knowledge base) consultável | **0** — diretório `.claude/knowledge/` não existe | `find` |
| Agents que escrevem no ledger automaticamente | **≥0** — nenhum desses 13 CronJobs escreve lá | grep |

**Interpretação**: a distância entre "definido em markdown" e "fazendo trabalho observável" é enorme. O ledger, único instrumento de evidência agregada, captura apenas delegações manuais — os CronJobs rodam mas não deixam rastro auditável na mesma espinha dorsal.

---

## 3. Os 13 CronJobs da autopilot — verdict individual

| CronJob | Schedule | Última execução | Produz output real? | Previne dor de hoje? | Verdict |
|---|---|---|---|---|---|
| `argocd-sync-agent` | `2-57/5 * * * *` | 94s atrás | **SIM** — detectou lincesoc-prod Degraded+OutOfSync e auto-sincou | ❌ | **FUNCIONAL** |
| `infra-health` | `*/15` | 3m atrás | Log mas sem ledger | ❌ | Parcial |
| `k8s-troubleshooter` | `*/10` | 8m atrás | Log mas sem ledger | ❌ | Parcial |
| `platform-health-agent` | `*/5` | 3m atrás | Log | ❌ | Parcial |
| `observability-guardian` | `3-58/10` | 5m atrás | Log | ❌ | Parcial |
| `node-lifecycle-agent` | `*/10` | 8m atrás | Log | ❌ | Parcial |
| `secret-sync-agent` | `*/15` | 3m atrás | Log | ❌ | Parcial |
| `agent-health-manager` | `*/30` | 18m atrás | Log | Poderia mas não faz | Parcial |
| `linceplatform-memory-guardian` | `*/30` | 18m atrás | Log | ❌ | Parcial |
| `cert-expiry-scanner` | `0 */6` | 138m atrás | Log | ❌ | Parcial |
| `backup-verifier` | `0 4 * * *` | 10h (**FAILED**) | Último ciclo falhou | ❌ | **Quebrado** |
| `meta-governance-auditor` | `0 12 * * *` | 138m (**FAILED**) | Último ciclo falhou | ❌ | **Quebrado** |
| `grafana-admin-enforcer` | `*/30` | 18m atrás | Log | ❌ | Parcial |

**Dois CronJobs críticos estão com última execução FAILED e ninguém foi notificado** (`backup-verifier` há 10h, `meta-governance-auditor` há 138min). Isso é silent failure clássico — exatamente o que a regra `red-team.md` proíbe.

---

## 4. Por que a sessão de hoje doeu — e qual agent deveria ter prevenido

| Dor manual de hoje | Agent que deveria cobrir | Existe? | Estava rodando? | Por que falhou |
|---|---|---|---|---|
| `AWS_ENDPOINT_URL=http://localhost:4566` no `.zshrc` envenenando toda chamada AWS | **`developer-shell-audit-agent`** | ❌ Não existe | — | Nunca foi concebido |
| Kubeconfig com 4 contextos stale (financial-services/k3d-linceplatform-local) | **`kubeconfig-hygiene-agent`** | ❌ Não existe | — | Nunca foi concebido |
| EKS `publicAccessCidrs` travado em `45.188.18.240/32` (IP que o founder não possui) | **`eks-allowlist-guardian-agent`** | ❌ Não existe | — | `infra-health-agent` tem verificações de pod/PV mas nenhum verifica exposição pública do control plane |
| LocalStack containers + imagens ocupando espaço há 7 dias | **`local-dev-environment-hygiene-agent`** | ❌ Não existe | — | Única menção a "localstack" na frota inteira é uma linha em `infra-health-agent.md` classificando como "cosmetic, dev only" |

**Conclusão**: a frota cobre bem o plano de dados do cluster (pods, nodes, argocd apps, certs), mas ignora completamente o plano de dados do **founder** (shell, kubeconfig, exposição do control plane ao mundo). Foi exatamente nesse plano que a dor de hoje aconteceu.

---

## 5. Cost governance — receipt check

### 5.1. `opencost` — **FUNCIONAL**

Métricas reais sendo servidas agora em `/allocation/compute?window=1d`:

| Namespace | Custo hoje (até 14:30 UTC) |
|---|---|
| kube-system | $0.78 |
| lincesoc-mvp | $0.28 |
| loki | $0.24 |
| kyverno | $0.20 |
| linceplatform-hml-app | $0.15 |
| amazon-cloudwatch | $0.13 |
| karpenter | $0.12 |
| linceplatform-hml-data | $0.12 |
| monitoring | $0.09 |
| linceplatform-prod | $0.09 |
| linceplatform-system | $0.03 |
| opencost | $0.02 |

Run-rate observado: ~$2.25/dia observado ≈ **$67/mês** nos namespaces medidos. Plausível.

### 5.2. Gap crítico — **`pvCost = 0` em TODOS os PVs**

OpenCost não tem preço EBS configurado. PVs grandes como `lincesoc-mvp` (25.9 GB em 3 volumes) aparecem com custo zero. Com o preço EBS real (~$0.08/GB-mês para gp3), isso é **~$2/mês por namespace com PV — pequeno agora, mas invisível**. Se alguém subir um PV de 500Gi acidentalmente, ninguém vai ver no dashboard.

**Fix**: adicionar `providers` YAML no `opencost` ConfigMap ou exportar a tabela de preços AWS via `aws pricing get-products` (script em `infra-platform/cost-automation/` existe mas não está wired).

### 5.3. `cost-anomaly` CronJob — **PREMATURO** (não executou ainda)

- Criado 56min atrás.
- Imagem: `ghcr.io/lincesoc-soc/control-plane-agents:sha-89a8942a11607c5ffc41484a6c15d2ee5dc7257b`
- Command: `node dist/agents/cost-anomaly/run.js`
- Database: `control-plane-db` secret (postgres)
- Schedule: `30 6 * * *` — primeira execução **amanhã 06:30 BRT**.

Recomendação: rodar manualmente agora com `kubectl -n control-plane create job --from=cronjob/cost-anomaly cost-anomaly-manual-01` para validar que ele conecta no DB, lê opencost e emite output. Nunca validado in vivo.

### 5.4. `finops-reviewer` agent — **COSMÉTICO**

1 menção no ledger em ~6 semanas. Nenhum PR recente cita o agent. Existe como `.md` mas não tem schedule nem workflow que o invoque.

### 5.5. Karpenter — bounds RAZOÁVEIS

- `spec.limits`: 32 CPU / 64Gi memory — ≈ 8 nodes t3.large antes do stop.
- Consolidation `WhenEmptyOrUnderutilized` com `consolidateAfter: 5m`.
- Disruption budget: 1 node por vez.

**OK**. Se um agent maluco subir 1000 pods, Karpenter para em 8 nodes. Não é ilimitado.

### 5.6. Recursos dormentes / Velya pausado — **NÃO AUDITADO**

Memory note S66 "AWS cost audit — April 2026 breakdown" existe mas não foi revisitada nesta sessão. Possíveis faturamentos fantasma (não validados aqui):
- ECR repos do Velya antigo (ex: `velya-local` / `kind-velya-local` tinham entradas em k9s).
- EBS snapshots órfãos.
- LoadBalancers sem traffic (não há verificação automática).
- Route53 hosted zones de `velyahospitalar.com` (Cloudflare account local, pausado).

### 5.7. AI token guardrails — **AUSENTE**

- `packages/ai-gateway/` existe mas não verifiquei se tem tracking de custo por agent.
- Nenhum kill switch documentado em `docs/operations/kill-switch-matrix.md` para "agent em loop queimando Opus".
- Esta própria sessão queimou tokens consideráveis em toil manual que deveria ter sido prevenido.

---

## 6. Governança — ledger e knowledge base

### 6.1. Ledger — **ANÊMICO**

- 31 linhas para 105 agents — 0.3 entries por agent.
- 12 agents distintos já apareceram como `to:`.
- **93 agents nunca apareceram.** Entre eles: `argocd-healer-agent`, `bootstrap-drift-scanner-agent`, `ci-failure-triage-agent`, `proactive-bug-hunter-agent`, `chaos-engineering-agent`, `cost-explosion-hunter-agent`, `finops-reviewer`, `continuous-improvement-coordinator-agent`, `agent-trainer-agent`, `knowledge-base-keeper-agent`, `governance-council`, `meta-governance-auditor`...
- Os 13 CronJobs vivos **não escrevem no ledger** — o único sinal de atividade deles é log de pod, que some quando o pod termina.

### 6.2. Knowledge base — **NÃO EXISTE**

- `/home/jfreire/velya/velya-platform/.claude/knowledge/` não existe no disco.
- `knowledge-base-keeper-agent.md` declara curadoria de postmortems, ADRs, lições aprendidas.
- Nenhum agent lê ou escreve lá.
- Toda a "memória organizacional" está em `.claude/projects/-home-jfreire-velya/memory/` (user-level, não project-level) + observações do claude-mem — mas nenhum agent backend as consulta antes de agir.

### 6.3. Validation chain — **ASPIRACIONAL**

Regra `agent-governance.md` exige `execution → self-check → validator → auditor → acceptance`. Amostra de 3 agents:

- `argocd-sync-agent` (CronJob): executa direto, sem validator, sem auditor, sem ledger.
- `finops-reviewer.md`: markdown define scope; nenhum CronJob ou workflow o invoca.
- `governance-council.md`: declarado como top-level arbiter; **nunca apareceu no ledger**, nunca bloqueou nada.

### 6.4. Watchdog de silent failure — **QUEBRADO**

- `backup-verifier` falhou há 10h. Nenhum alerta foi disparado. Nenhum issue foi aberto.
- `meta-governance-auditor` (o próprio watchdog de watchdogs) falhou 2h atrás. Nenhum alerta.
- Essa é exatamente a anti-goal que `red-team.md` proíbe: "A component is secure because it has a security policy".

---

## 7. Quick wins — 1 dia de trabalho, impacto material

1. **Rodar `cost-anomaly` manualmente agora** e validar que o job completa, lê DB e emite saída. Hoje é a primeira vez que seria testado, mas o schedule é só amanhã 06:30.
2. **Configurar EBS pricing no opencost** via `customPricing` no ConfigMap — remove o `pvCost=0` systemic.
3. **Adicionar writer do ledger aos 13 CronJobs**: injetar `curl`/`kubectl patch` de append-line ao `.claude/ledger/delegations.jsonl` (ou equivalent via commit) quando um ciclo completa — transforma logs voláteis em evidência auditável.
4. **Criar o diretório `.claude/knowledge/`** com seed mínimo (copiar os observations recentes do claude-mem + postmortems existentes em `lincesoc-recovery/infra/aws-migration/docs/autonomous/`). Sem isso `knowledge-base-keeper-agent` é sempre cosmético.
5. **Instrumentar alerta quando CronJob termina em Failed** em `linceplatform-autopilot` — uma simples PrometheusRule em `kube_job_status_failed`. Hoje `backup-verifier` falhou 10h atrás em silêncio.
6. **Criar o `developer-shell-audit-agent`** — scan de `.zshrc`/`.bashrc` procurando `AWS_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID=test`, `LOCALSTACK_*`, `AWS_PROFILE` inconsistente. Runs 1x/dia via cron local ou workflow de repo scan.
7. **Criar o `eks-allowlist-guardian-agent`** — verifica se `publicAccessCidrs` inclui o IP público do founder OU se está com bastion/tunnel configurado. Se não, abre issue e posta no slack. Runs */30min.

---

## 8. Agents a deprecar (candidatos a teatro)

Agents que nunca apareceram no ledger, sem CronJob, sem workflow scheduled, com `.md` apenas aspiracional. Candidatos para mover para `.claude/agents/_archive/` até serem wired:

- `adversarial-behavior-analyst-agent`
- `blind-spot-discovery-coordinator-agent`
- `chaos-engineering-agent`
- `clinical-safety-gap-hunter-agent`
- `clinical-triage-agent`
- `cost-explosion-hunter-agent` (paradoxal: acabei de invocar e ele morreu; não tem automação que o dispare periodicamente)
- `customer-onboarding-agent`
- `customer-success-agent`
- `governance-council` (zero evidência de bloqueio)
- `hipaa-compliance-agent`
- `hospital-*` (11 agents) — Velya pausado, sem volume clínico real
- `market-intelligence-manager`
- `marketing-copy-agent`
- `red-team-manager-agent`

Manter em `.md` não é errado, mas precisa estar claro que é "design ativo, runtime ausente" e não "agent operando".

---

## 9. Novos agents propostos (fecha o gap desta sessão)

| Nome | Trigger | SLO | Office |
|---|---|---|---|
| `developer-shell-audit-agent` | diário + on-commit de dotfiles | `.zshrc`/`.bashrc` livres de envs cross-provider poisoning | Platform / DX |
| `kubeconfig-hygiene-agent` | semanal | ≤1 contexto ativo por cluster em uso, zero contextos de contas não-pertencentes | Platform / DX |
| `eks-allowlist-guardian-agent` | `*/30 * * * *` | `publicAccessCidrs` inclui IP do founder OU bastion saudável | Security / Networking |
| `ledger-emission-gate-agent` | na borda de cada CronJob | todo CronJob da autopilot escreve linha no ledger com status/evidencePath | Governance |
| `knowledge-base-bootstrap-agent` | one-shot | popular `.claude/knowledge/` com postmortems + ADRs existentes | Governance |
| `cronjob-failure-notifier-agent` | on-event (kube_job_status_failed > 0) | alerta em ≤5min para founder | Ops / Observability |

---

## 10. Veredicto final

**A frota NÃO é funcional como você esperava**. Ela é um mosaico:

- ✅ Um punhado (10–15%) de agents de infraestrutura in-cluster realmente roda e faz trabalho útil — `argocd-sync-agent` é o único que eu pude ver auto-corrigindo coisa de verdade nos últimos 10 minutos.
- 🟡 Uma banda (20–30%) de agents tem CronJob ou workflow scheduled mas não deixa evidência auditável — é difícil saber se resolvem ou só logam.
- 🔴 A maioria (60%+) é markdown sem runtime. Validation chain, knowledge base, governance council — aspiracional.
- 🚨 As 3 dores de hoje (LocalStack, kubeconfig, EKS allowlist) expuseram um blind spot estrutural: **a frota olha para dentro do cluster, não para a workstation do founder**. E é na workstation que grande parte da fricção operacional acontece.

**Recomendação acionável em 7 dias**:
1. Hoje: rodar `cost-anomaly` manual, ativar EBS pricing.
2. Amanhã: criar `cronjob-failure-notifier-agent` + re-habilitar `backup-verifier` + entender por que `meta-governance-auditor` falhou.
3. Dia 3: criar `developer-shell-audit-agent` + `eks-allowlist-guardian-agent`.
4. Dia 5: converter os 13 CronJobs para emitir ledger.
5. Dia 7: bootstrap da knowledge base com seed mínimo.

Isso aqui é mais honesto do que continuar falando em "106 agents". 106 é o número de intenções; 13 é o número de automações vivas; 1 é o número de automações que eu vi resolver algo real hoje.
