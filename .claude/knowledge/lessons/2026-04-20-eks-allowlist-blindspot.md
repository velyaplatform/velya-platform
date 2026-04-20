---
id: lesson-2026-04-20-03
date: 2026-04-20
tags: [eks, security, public-access, allowlist, blind-spot]
blast_radius: founder-access
agents_interested: [eks-allowlist-guardian-agent, eks-operator, security-reviewer]
---

# EKS control plane allowlist tinha apenas IP estrangeiro, travando acesso do founder

## Sintoma

Da workstation do founder, `kubectl get ns` caía em timeout consistente (`context deadline exceeded`) contra `FC410B6B06A586D2127E7201570AD42D.gr7.us-east-1.eks.amazonaws.com`, mesmo com credenciais AWS válidas. DNS resolvia, TCP não completava.

## Root cause

`aws eks describe-cluster --name lince-hml --query 'cluster.resourcesVpcConfig'` retornava:

```json
{
  "endpointPublicAccess": true,
  "endpointPrivateAccess": true,
  "publicAccessCidrs": ["45.188.18.240/32"]
}
```

O único CIDR autorizado era `45.188.18.240/32` — IP desconhecido para o founder. Seu IP residencial `191.19.99.121` **não estava na allowlist**. Sem bastion nem Cloudflare tunnel configurado, acesso estava de fato quebrado para o dono da plataforma.

## Correção aplicada

```bash
aws eks update-cluster-config --name lince-hml --region us-east-1 \
  --resources-vpc-config endpointPublicAccess=true,publicAccessCidrs=45.188.18.240/32,191.19.99.121/32
# Aguardou ~4min até status=Successful
```

Após propagação, `kubectl get ns` retornou 24 namespaces normalmente.

## Risco residual

- IP residencial `191.19.99.121` é dinâmico (ISP). Próxima troca de IP quebra acesso de novo.
- `45.188.18.240` continua autorizado mas ninguém sabe de quem é.
- Allowlist não está declarada em IaC visível (o módulo EKS tem a variável `cluster_endpoint_public_access_cidrs` mas não há `.tfvars` com o valor atual — drift silencioso).

## Prevenção

- **Agent proposto**: `eks-allowlist-guardian-agent` — cron */30min que:
  - Lê `aws eks describe-cluster --query ...publicAccessCidrs`
  - Compara com lista esperada em `.claude/knowledge/security/eks-expected-cidrs.yaml`
  - Alerta se:
    - Novo CIDR apareceu (possível exfiltração de credencial)
    - CIDR familiar sumiu (drift acidental)
    - IP público do operador principal não está incluso
    - `endpointPublicAccess=true` sem nenhum CIDR conhecido (bypass acidental de least-privilege)
- **IaC**: materializar `cluster_endpoint_public_access_cidrs` em `infra-platform/live/hml/us-east-1/eks/terragrunt.hcl` referenciando SSM parameter.

## Lição

Allowlist do control plane EKS é um vetor de lockout do founder que nenhum dos 105 agents declarados cobre. `infra-health-agent` monitora pods e PV, não exposição pública do control plane. `iam-reviewer` olha policies IAM, não configuração de rede do cluster. Esse é um buraco estrutural da ontologia atual de agents.
