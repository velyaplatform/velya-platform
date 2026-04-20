# Domain Framework — Release Notes

## Pipeline de geração

```
git log → classificação conventional → brief estruturado → redação dual (técnico + stakeholder) → revisão → checkpoint humano → publicação
```

## Taxonomia de commits (Conventional Commits)

| Tipo | Seção no changelog | Aparece no anúncio stakeholder? |
| --- | --- | --- |
| `feat` | Features | Sim, sempre |
| `fix` | Fixes | Sim, se relevante para usuário final |
| `perf` | Performance | Sim, se impacto mensurável |
| `refactor` | Refactor | Não (interno) |
| `docs` | Documentação | Não (interno) |
| `test` | Testes | Não (interno) |
| `chore` | Interno | Não |
| `ci` / `build` | Interno | Não |
| `style` | Interno | Não |
| `revert` | Revert | Sim, sempre (comunicar explicitamente) |
| Com `!` ou `BREAKING CHANGE:` | Breaking Changes (topo) | Sim, obrigatório |

## Formato canônico da release note

### Changelog técnico
```
# v<semver> — <YYYY-MM-DD>

## Breaking Changes  (só se existir)
## Features
## Fixes
## Performance
## Revert
## Interno

## Cobertura
```

### Anúncio stakeholder
Prosa curta (3–5 parágrafos):
1. Parágrafo de capacidade: o que o usuário final consegue fazer agora que não conseguia antes.
2. Parágrafo de correção (se houver fix relevante).
3. Parágrafo de breaking change (se houver) com instrução de migração.
4. Chamada para ação / canal de dúvidas.

## Regras de segurança e compliance

- **PHI bloqueia tudo**: nomes de pacientes, MRN, CPF, dados clínicos reais → nunca aparecem em nenhum output.
- **Secrets bloqueiam tudo**: API keys, tokens, senhas → nunca aparecem.
- **Commits `clinical`**: precisam de disclaimer explícito e reviewer do Clinical Safety Office antes de publicação externa.
- **Commits `infra` com palavra-chave de produção** (prod, iam, secrets): anúncio stakeholder só após aprovação do Security Office.
