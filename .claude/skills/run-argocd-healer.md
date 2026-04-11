---
name: run-argocd-healer
description: Executa o argocd-healer-agent para detectar, correlacionar com Grafana e auto-remediar ArgoCD Applications em estado OutOfSync/Missing/Degraded
---

# Run ArgoCD Healer

Valida todas as Applications do ArgoCD da plataforma Velya, identifica erros e aplica remediações seguras (refresh → sync) em cadeia, correlacionando com alertas do Grafana quando disponível.

## When to Use

- Após deploy recente e você quer confirmar que todas as Applications convergiram
- Quando um ArgoCD dashboard mostra app OutOfSync/Missing/Degraded
- Para auditar o estado GitOps antes de uma release
- Como parte de um troubleshooting de incidente

## What It Does

1. Lista todas as Applications (via `argocd app list` ou `kubectl get applications.argoproj.io -n argocd`)
2. Filtra as em estado ruim: `OutOfSync`, `Missing`, `Degraded`, `SyncFailed`, `Unknown`
3. Correlaciona com alertas Grafana ativos quando `GRAFANA_URL` estiver setado
4. Aplica remediação em cadeia:
   - `argocd app get --refresh --hard-refresh`
   - Se continuar OutOfSync/Missing: `argocd app sync --prune=false --timeout 180`
5. Persiste `argocd-audit/latest.json` + `<timestamp>.json` em `/data/velya-autopilot`
6. Exit 1 quando high/critical findings permanecem

## How to Run

```bash
# Local (contra o cluster ativo no kubeconfig)
VELYA_AUDIT_OUT=/tmp/velya-autopilot \
  npx tsx scripts/agents/run-argocd-healer.ts

# Dry-run (só detecta, não remedia)
VELYA_DRY_RUN=true VELYA_AUDIT_OUT=/tmp/velya-autopilot \
  npx tsx scripts/agents/run-argocd-healer.ts

# Com argocd CLI (remoto)
ARGOCD_SERVER=argocd.velya.local \
ARGOCD_AUTH_TOKEN=$(argocd account generate-token) \
ARGOCD_INSECURE=true \
  npx tsx scripts/agents/run-argocd-healer.ts

# Com correlação Grafana
GRAFANA_URL=https://grafana.velya.local \
GRAFANA_TOKEN=$GRAFANA_TOKEN \
  npx tsx scripts/agents/run-argocd-healer.ts
```

## Escalation

Se exit code 1, abrir issue no repo listando applications em estado escalado e passar handle para o `gitops-operator` resolver manualmente via PR no manifest.

## Related

- Agent: `.claude/agents/argocd-healer-agent.md`
- Script: `scripts/agents/run-argocd-healer.ts`
- Workflow: `.github/workflows/argocd-healer.yaml`
- CronJob: `infra/kubernetes/autopilot/agents-cronjobs.yaml`
