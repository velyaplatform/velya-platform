---
id: lesson-2026-04-20-04
date: 2026-04-20
tags: [control-plane, cronjob, silent-failure, node, module-not-found]
blast_radius: cost-detection, drift-detection, update-detection
agents_interested: [cronjob-failure-notifier-agent, ci-failure-triage-agent]
---

# 3 agents do control-plane falhavam 100% dos ciclos com MODULE_NOT_FOUND silencioso

## Sintoma

CronJobs `cost-anomaly`, `drift-detector`, `update-watcher` no namespace `control-plane` apareciam "vivos" em `kubectl get cronjob` mas qualquer execução terminava em `Error` dentro de segundos. Nenhum alerta era disparado. Descoberto apenas durante o fleet reality check.

## Root cause

Os 3 CronJobs tinham `command: ["node", "dist/agents/<agent>/run.js"]`, mas a imagem `ghcr.io/lincesoc-soc/control-plane-agents:sha-89a8942a11607c5ffc41484a6c15d2ee5dc7257b` compila cada agent como **arquivo único** em `/app/dist/agents/<agent>.js` — não como diretório com `run.js` dentro.

Descoberto via:

```bash
kubectl -n control-plane run cost-debug --rm -it --restart=Never \
  --image=ghcr.io/lincesoc-soc/control-plane-agents:sha-89a8942a11607c5ffc41484a6c15d2ee5dc7257b \
  -- sh -c 'find /app/dist/agents -type f -name "*.js"'
```

Resultado:
```
/app/dist/agents/chat-ops.js
/app/dist/agents/cost-anomaly.js
/app/dist/agents/drift-detector.js
/app/dist/agents/evidence-aggregator.js
/app/dist/agents/hcl-emitter.js
/app/dist/agents/pre-merge-reviewer.js
/app/dist/agents/update-watcher.js
```

Erro de runtime:
```
Error: Cannot find module '/app/dist/agents/cost-anomaly/run.js'
    code: 'MODULE_NOT_FOUND'
```

## Correção aplicada

PR [lincesoc-soc/infra-platform#37](https://github.com/lincesoc-soc/infra-platform/pull/37) — patched 3 manifestos em `kubernetes/base/control-plane-agents/` de `dist/agents/<name>/run.js` → `dist/agents/<name>.js`. ArgoCD auto-sync (`selfHeal: true`) reconciliou após merge.

Primeiro patch direto via `kubectl patch cronjob` foi **revertido pelo ArgoCD** — lembrete de que em um cluster GitOps-native, a única autoridade é Git.

## Prevenção

- **Agent proposto**: `cronjob-failure-notifier-agent` — PrometheusRule `kube_job_status_failed > 0` disparando alert para o founder em ≤5min.
- **Smoke test no CI do control-plane-agents**: após `docker build`, rodar `docker run --rm IMAGE sh -c 'test -f /app/dist/agents/cost-anomaly.js'` para cada agent esperado, e bater com a lista de CronJobs no Kustomize.
- **KB**: documentar convenção "cada agent do control-plane compila como arquivo único `/app/dist/agents/<name>.js`" — hoje isso existe só no código.

## Lição

CronJob em estado "Active=0, Last Schedule=X min ago" não significa "executou com sucesso" — significa apenas "disparou". Sem alerta em `kube_job_status_failed` ou sem o `argocd-sync-agent` equivalente para monitorar Jobs, silent failures em agents de cost/drift persistem indefinidamente sem nenhum humano perceber. Este é exatamente o cenário que a regra `red-team.md` proíbe.
