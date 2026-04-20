# Squad Memory: Lincesoc Platform Ops

## Estilo de Escrita

- Direto, técnico e em Português (Brasil).
- Priorizar status operacional, riscos concretos e próximos passos executáveis.

## Design Visual

- Não aplicável por padrão; este squad foca operação, cutover e saúde de runtime.

## Estrutura de Conteúdo

- Checks objetivos com resultado `OK`, `WARN` ou `FAIL`.
- Handoff curto entre agentes quando houver bloqueio ou dependência.

## Proibições Explícitas

- Não reintroduzir integrações proprietárias removidas do Lincesoc.
- Não depender de serviços externos quando existir alternativa local ou open source.
- Não expor secrets, tokens ou credenciais em logs, outputs ou docs.

## Técnico (específico do squad)

- Ambiente local prioritário: cluster `k3d-linceplatform-local`.
- Fonte de coordenação compartilhada: `ops/state/agent-sync-status.json`.
- Fonte de presença no dashboard: `squads/lincesoc-platform-ops/state.json`.
- Usuário demo atual: `analista.demo@linceplatform.local`.
