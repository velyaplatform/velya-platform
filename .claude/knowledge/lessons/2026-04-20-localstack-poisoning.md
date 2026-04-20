---
id: lesson-2026-04-20-01
date: 2026-04-20
tags: [developer-shell, aws, localstack, silent-failure]
blast_radius: workstation-only
agents_interested: [developer-shell-audit-agent, iam-reviewer, aws-specialist-agent]
---

# LocalStack envenenou toda chamada AWS do founder por ~7 dias

## Sintoma

`aws sts get-caller-identity` falhava com `Could not connect to the endpoint URL: "http://localhost:4566/"`. Toda chamada AWS da workstation retornava o mesmo erro. `k9s` não conectava em nenhum EKS real.

## Root cause

`~/.zshrc` tinha 4 linhas que sobrescreviam qualquer configuração do AWS CLI:

```
export LOCALSTACK_AUTH_TOKEN="ls-JOKe..."
export AWS_ENDPOINT_URL="http://localhost:4566"
export AWS_ACCESS_KEY_ID="test"
export AWS_SECRET_ACCESS_KEY="test"
```

Essas envs foram herdadas de uso pontual de LocalStack 7 dias antes. `AWS_ENDPOINT_URL` tem precedência sobre `~/.aws/config`, então mesmo com `AWS_PROFILE=lince-migration` válido e perfil correto, o CLI redirecionava para `localhost:4566`.

## Correção aplicada

1. `docker rm -f localstack dynamodb-admin s3-browser`
2. `docker rmi localstack/localstack-pro:latest localstack/localstack:latest localstack/localstack:3`
3. Removidas as 4 linhas do `.zshrc`, mantido `AWS_DEFAULT_REGION=us-east-1`.
4. Blindagem do `~/.kube/config`: trocado `command: aws` por `command: /usr/bin/env -u AWS_ENDPOINT_URL -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN aws ...` no exec plugin, assim k9s/kubectl funcionam mesmo em shells com env poluído.

## Prevenção

- **Agent proposto**: `developer-shell-audit-agent` — scan diário de `.zshrc`/`.bashrc`/`.profile` procurando envs de cross-provider poisoning (`AWS_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID=test`, `LOCALSTACK_*`) e abrindo issue se achar.
- **Docs**: adicionar seção "dev workstation hygiene" em `.claude/rules/` documentando que envs de LocalStack nunca devem persistir fora de uma sessão específica.

## Lição

Variáveis de ambiente em `.zshrc` são globais — qualquer ferramenta que leia AWS SDK herda. Uso pontual de serviços locais deve ser feito com `export` apenas na sessão, nunca em `.zshrc`.
