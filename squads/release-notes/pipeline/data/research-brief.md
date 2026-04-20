# Research Brief — Release Notes para Velya Platform

## Contexto do produto
Velya Platform é monorepo TypeScript que abriga Velya Hospitalar (plataforma hospitalar FHIR-first) e Lince SOC (centro de operações de segurança). Usa Conventional Commits com tags de release `v<semver>` e commits `chore(release): v<semver>` marcando cada corte.

## Padrão observado no histórico
- Commits de release: `chore(release): v1.60.7`, `chore(release): v1.60.8`, `chore(release): v1.60.9` (cadência alta, ~diária nos últimos dias).
- Tipos presentes: `chore`, `style` predominantes nas releases recentes.
- Escopos usados em outros commits: `clinical`, `billing`, `pharmacy`, `scheduling`, `infra`, `ai-gateway`, `web`.

## Audiências do output
1. **Dev interno** → changelog técnico (precisa de hash, escopo, tipo).
2. **Gestor de operadora/CISO** → anúncio stakeholder (foco em capacidade e impacto de negócio).
3. **Time Clinical Safety** → gate adicional quando commits `clinical` aparecem.

## Referências de tom
- CLAUDE.md da raiz: "No secrets in code. Ever. No latest tags. All changes auditable."
- `_opensquad/_memory/company.md`: tom profissional-direto, zero emojis corporativos, evitar superlativos.
- Naming: português brasileiro como default, termos técnicos estabelecidos (release, feature flag, NATS, ArgoCD) ficam em inglês.

## Fontes de conteúdo
- `git log` do repositório local (primária).
- Mensagens de PR via `gh pr view` quando o commit referenciar um PR (ex: `Merge pull request #123`).
- ADRs em `docs/architecture/decisions/` para contextualizar breaking changes.
