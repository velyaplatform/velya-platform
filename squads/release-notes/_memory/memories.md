# Squad Memory: release-notes

## Estilo de Escrita
- Português (Brasil) padrão.
- Voz ativa, frases curtas.
- Zero superlativos vazios ("incrível", "revolucionário").
- Termos técnicos estabelecidos em inglês: release, feature flag, Temporal, Medplum, ArgoCD, NATS, FHIR, PHI.

## Design Visual
(não aplicável — squad textual)

## Estrutura de Conteúdo
- Changelog técnico: Breaking Changes → Features → Fixes → Performance → Revert → Interno → Cobertura.
- Anúncio stakeholder: capacidade → correção → breaking change → CTA.
- Data sempre em YYYY-MM-DD.

## Proibições Explícitas
- Nenhum PHI, PII ou dado clínico real em qualquer output.
- Nenhuma credencial, API key, token, senha em qualquer output.
- Não publicar anúncio stakeholder com escopo `clinical` sem aprovação do Clinical Safety Office.
- Não force-push, não push sem confirmação explícita do founder.

## Técnico (específico do squad)
- Tag de release segue padrão `v<semver>` e commit marker `chore(release): v<semver>`.
- Range default: última release vs penúltima.
- Range custom: usuário pode informar SHAs diretamente quando não há duas tags no histórico.
- PR de release é branch `release-notes/v<versão>` contra `main`.
