---
id: lesson-2026-04-20-02
date: 2026-04-20
tags: [kubeconfig, drift, stale-context, k9s]
blast_radius: workstation-only
agents_interested: [kubeconfig-hygiene-agent, eks-operator]
---

# Kubeconfig acumulou 4 contextos stale de contas que não pertencem ao founder

## Sintoma

`k9s` abria com 4 contextos: `financial-services-infra-eks-mgt-1-28`, `financial-services-infra-eks-mgt-1-31` (conta AWS `652149108552` — não era do founder), `k3d-linceplatform-local` (cluster local que não existia mais), e o contexto real `lince-hml`. Seleção errada levava a erros de autenticação.

## Root cause

Contextos foram adicionados por comandos `aws eks update-kubeconfig` e `kind create cluster` ao longo de meses, mas nunca removidos. Nem `k9s` nem `kubectl` limpam contextos automaticamente. O diretório de state do k9s (`~/.local/share/k9s/clusters/`) também tinha 5 entries incluindo `kind-velya-local` órfão.

## Correção aplicada

```bash
kubectl config delete-context 'arn:aws:eks:us-east-1:652149108552:cluster/financial-services-infra-eks-mgt-1-28'
kubectl config delete-context 'arn:aws:eks:us-east-1:652149108552:cluster/financial-services-infra-eks-mgt-1-31'
kubectl config delete-cluster 'k3d-linceplatform-local'
kubectl config delete-user 'admin@k3d-linceplatform-local'
# etc.
rm -rf ~/.local/share/k9s/clusters/{financial-services-*,k3d-*,kind-*}
```

Backup em `~/.kube/config.backup-20260420-105043` antes de editar.

## Prevenção

- **Agent proposto**: `kubeconfig-hygiene-agent` — scan semanal que:
  - Lista clusters em `kubectl config get-clusters`
  - Para cada, tenta `kubectl --context=X get ns --request-timeout=5s`
  - Se falha (DNS/unreachable/auth), propõe remoção via issue
  - Valida que o número de contextos é ≤ número esperado de ambientes ativos + 1 (local)

## Lição

Kubeconfig é append-only por convenção das ferramentas — ninguém poda. Sem um agent que verifique periodicamente, a workstation acumula contextos de projetos antigos que podem causar misuse (errar o target de `kubectl apply` em prod é incidente potencial).
