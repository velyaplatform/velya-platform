# Knowledge Base — Velya / Lince SOC

Curadoria da base de conhecimento organizacional. Consumido por `knowledge-base-keeper-agent` e consultável por qualquer agent antes de agir.

## Estrutura

```
.claude/knowledge/
├── postmortems/   # incidentes resolvidos, com root cause e prevention
├── adrs/          # Architecture Decision Records (pointers para docs/architecture/decisions/)
├── runbooks/      # pointers para docs/runbooks/ com índice por sintoma
├── lessons/       # lições aprendidas de sessões operacionais
└── INDEX.md       # índice agregado por sintoma / domínio / agent interessado
```

## Contrato de escrita

- Cada arquivo tem frontmatter YAML com `id`, `date`, `tags`, `blast_radius`, `agents_interested`.
- Postmortems ficam imutáveis após fechamento — correções via novos documentos.
- Lições aprendidas podem ser editadas desde que o histórico vá para git.

## Contrato de leitura

Um agent que consulta a KB faz:

```bash
grep -rlE "pattern" /home/jfreire/velya/velya-platform/.claude/knowledge/
```

ou filtra por tag via INDEX.md.

## Bootstrap atual

Esta KB foi criada em 2026-04-20 após o fleet reality check (`docs/audits/2026-04-20-fleet-reality-check.md`) descobrir que `knowledge-base-keeper-agent` estava declarado mas o diretório não existia.

Seed inicial:
- `lessons/2026-04-20-localstack-poisoning.md`
- `lessons/2026-04-20-kubeconfig-drift.md`
- `lessons/2026-04-20-eks-allowlist-blindspot.md`
- `lessons/2026-04-20-control-plane-agents-silent-module-not-found.md`
