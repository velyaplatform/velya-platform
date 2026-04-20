# Ledger de Delegações de Agents

Toda vez que um agent (incluindo Claude Code e subagents via `Task`) delega trabalho para outro, **é obrigatório** registrar no arquivo `delegations.jsonl` seguindo o contrato abaixo.

## Por que

- Rastreabilidade: quem pediu o quê, quando, para quem, com que evidência.
- Visibilidade no dashboard da empresa (aba "Empresa Inteira" → atividade).
- Permite que outros agents descubram tarefas que dependem deles.
- Auditoria pela governança (Meta-Governança, Auditor de Agents, Red Team).

## Formato

JSON Lines (um JSON por linha, append-only):

```jsonl
{"id":"2026-04-14T12:30:00Z-1","ts":"2026-04-14T12:30:00Z","from":"delegation-coordinator-agent","to":"backend-quality-agent","task":"Revisar PR #1234 do novo módulo de billing","context":"Mudança em services/velya-billing-claims — validar tipos Zod, tests, structured logging","status":"pending","evidencePath":null}
{"id":"2026-04-14T12:35:00Z-2","ts":"2026-04-14T12:35:00Z","from":"backend-quality-agent","to":"delegation-coordinator-agent","task":"Revisão do PR #1234 concluída","context":"Aprovado com 2 comentários MÉDIO em tipagem, relatado em evidence/","status":"completed","evidencePath":"docs/reviews/pr-1234-backend.md"}
```

## Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | sim | Único. Formato sugerido: `<ISO>-<counter>`. |
| `ts` | string (ISO 8601) | sim | Timestamp de criação. |
| `from` | string | sim | ID do agent que delega (ex: `delegation-coordinator-agent`, `ceo`, `user`). |
| `to` | string | sim | ID do agent que recebe. |
| `task` | string | sim | O que foi delegado (frase curta, pt-BR). |
| `context` | string | sim | Contexto necessário para executar. |
| `status` | `pending \| in-progress \| completed \| blocked \| rejected` | sim | Estado atual. |
| `evidencePath` | string \| null | não | Caminho do artefato final (PR, doc, dashboard). |
| `blockReason` | string | não | Motivo do bloqueio quando `status=blocked`. |

## Protocolo de atualização

Uma delegação é registrada **duas vezes** no mínimo:

1. **Criação** — linha com `status: "pending"` assim que o pedido é feito.
2. **Conclusão** — nova linha com mesmo `id` do evento de conclusão (ou `status: "blocked"` / `"rejected"`).

Nunca editar linhas antigas. Sempre *append* de uma nova linha com o status atualizado — o dashboard agrega por `id` e mostra o status mais recente.

## Quem escreve

Qualquer agent ou sessão Claude Code que delegar ou concluir trabalho. O agent `delegation-coordinator-agent` é responsável por supervisionar integridade do ledger (detectar delegações sem status final, detectar loops, etc.).
