---
name: run-k8s-troubleshooter
description: Executa o k8s-troubleshooter-agent para validar, monitorar e auto-remediar problemas de runtime do cluster via kubectl nativo
---

# Run K8s Troubleshooter

Agent autônomo que valida nodes, PVCs, deployments e pods via kubectl nativo, coleta evidence (logs + events) e aplica correções seguras (rollout restart, delete evicted, prune completed jobs).

## When to Use

- Suspeita de pods em CrashLoop
- Deploy recente e você quer confirmar que todas as réplicas subiram
- Cluster com nodes com pressão de recurso
- Jobs acumulando e consumindo PVC
- Troubleshooting de runtime antes de abrir incident

## What It Does

1. **Valida nodes**: `Ready`, `MemoryPressure`, `DiskPressure`, `PIDPressure`
2. **Valida PVCs**: detecta `Pending`/`Lost` em namespaces `velya-*`
3. **Escaneia pods quebrados**:
   - `Evicted`/`Failed` → `kubectl delete pod`
   - `CrashLoopBackOff` ≥ 3 restarts → coleta `logs --previous` e faz `rollout restart`
   - `ImagePullBackOff`/`ErrImagePull` → escala para `gitops-operator`
   - `OOMKilled` → escala para `observability-reviewer`
4. **Checa rollouts**: deployments stalled ou under-replicated
5. **Prune Jobs**: completados há > 24h
6. **Coleta Warning events** (últimos 15 min, contagem > 3)

## How to Run

```bash
# Local (contra kubeconfig ativo)
VELYA_AUDIT_OUT=/tmp/velya-autopilot \
  npx tsx scripts/agents/run-k8s-troubleshooter.ts

# Dry-run
VELYA_DRY_RUN=true VELYA_AUDIT_OUT=/tmp/velya-autopilot \
  npx tsx scripts/agents/run-k8s-troubleshooter.ts

# Contexto específico
KUBECTL_CONTEXT=velya-dev \
  npx tsx scripts/agents/run-k8s-troubleshooter.ts

# Custom namespace allowlist
VELYA_NS_ALLOWLIST=velya-dev-core,velya-dev-platform \
  npx tsx scripts/agents/run-k8s-troubleshooter.ts
```

## Reading the Report

```bash
cat /tmp/velya-autopilot/k8s-troubleshoot/latest.json | jq '.findings[] | select(.severity=="high")'
```

## Related

- Agent: `.claude/agents/k8s-troubleshooter-agent.md`
- Script: `scripts/agents/run-k8s-troubleshooter.ts`
- Companion: `run-argocd-healer`, `run-infra-health` (complementares)
