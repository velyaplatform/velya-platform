# Output Examples — Release Notes

## Exemplo 1 — Release só com chore/style

### Changelog técnico

```markdown
# v1.60.9 — 2026-04-13

## Interno
- `005ecab` chore(release): bump para v1.60.9
- `7efff37` style: normalização de formatação em managed pages (Prettier)

## Cobertura
- 2 commits cobertos
- 0 commits ignorados

_Esta release não contém mudanças visíveis ao usuário final — nenhum anúncio stakeholder foi gerado._
```

## Exemplo 2 — Release com feature clínica

### Changelog técnico

```markdown
# v1.62.0 — 2026-04-20

## Features
- `1a2b3c4` feat(clinical): triagem assistida por IA em intake de paciente (Velya Clinical Intake)
- `5e6f7g8` feat(billing): geração automática de claim TUSS a partir de encounter FHIR

## Fixes
- `9h0i1j2` fix(pharmacy): retry em deduplicação de ordem de medicação via idempotency key

## Cobertura
- 3 commits cobertos
- 0 commits ignorados

⚠️ **Clínico:** esta release altera fluxo de triagem. Validação pelo time Clinical Safety obrigatória antes de promoção para produção.
```

### Anúncio stakeholder

```markdown
# Velya Platform v1.62.0 — Triagem assistida e claim automatizado

Esta release adiciona triagem clínica assistida por IA no intake de paciente e geração automática de claims TUSS a partir do encounter FHIR. O time assistencial passa a receber sugestão de classificação de urgência logo na abertura do atendimento, e o time de faturamento deixa de precisar abrir claims manualmente para encontros já registrados.

Corrigimos também um problema intermitente em dispensação de medicação que duplicava ordens sob carga alta. A correção usa idempotency key no consumer e foi validada em ambiente de staging.

Esta release requer aprovação do Clinical Safety Office antes da promoção para produção, conforme o processo padrão de governança de agents clínicos. A migração é aditiva — nenhuma ação é necessária em integrações existentes.

Dúvidas: abrir issue no repositório `velya-platform` ou acionar o time responsável via o runbook interno.
```

## Exemplo 3 — Release com breaking change

### Changelog técnico

```markdown
# v2.0.0 — 2026-05-15

## Breaking Changes
- `abcd123` feat(ai-gateway)!: remoção da rota direta `/anthropic` — toda chamada agora passa por `/gateway/:provider`.
  **Migração:** atualizar clientes para usar `/gateway/anthropic`. Cliente antigo retorna 410 Gone.

## Features
- `efgh456` feat(ai-gateway): suporte a fallback automático entre provedores configurado via feature flag `velya.ai-gateway.fallback`

## Cobertura
- 2 commits cobertos
- 0 commits ignorados
```

### Anúncio stakeholder

```markdown
# Velya Platform v2.0.0 — AI Gateway unificado (breaking change)

A partir desta release, todas as chamadas a provedores de IA passam exclusivamente pela rota unificada `/gateway/:provider`. A rota legada `/anthropic` foi removida e passa a retornar 410 Gone.

**Ação obrigatória:** serviços que chamam `/anthropic` diretamente precisam ser atualizados para `/gateway/anthropic` antes da promoção desta versão. Guia de migração e script de detecção de uso legado estão no runbook `docs/operations/ai-gateway-migration.md`.

A mudança é parte da consolidação da camada de abstração de IA e não altera o comportamento das respostas — apenas o endpoint. Como benefício adicional, esta release introduz fallback automático entre provedores, ativado via feature flag `velya.ai-gateway.fallback`.

Dúvidas ou bloqueios na migração: abrir issue com label `ai-gateway-migration` no repositório `velya-platform`.
```
