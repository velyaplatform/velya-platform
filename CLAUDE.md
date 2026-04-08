# Velya Platform

AI-native hospital platform built on AWS EKS. TypeScript/Node.js backend, FHIR-first clinical data model via Medplum, event-driven architecture.

## Navigation

- **Domain rules**: `.claude/rules/` (security, naming, infrastructure, agents, architecture, quality)
- **Subagents**: `.claude/agents/` (specialized AI agents for platform tasks)
- **Skills**: `.claude/skills/` (reusable automation skills)
- **Full taxonomy**: `docs/product/naming-taxonomy.md`

## Tech Stack

| Layer                   | Technology                                      |
| ----------------------- | ----------------------------------------------- |
| Runtime                 | TypeScript / Node.js                            |
| IaC                     | OpenTofu (no Terraform)                         |
| GitOps                  | ArgoCD                                          |
| Messaging               | NATS JetStream                                  |
| Workflows               | Temporal                                        |
| Database                | PostgreSQL                                      |
| FHIR                    | Medplum                                         |
| Container Orchestration | AWS EKS (Auto Mode)                             |
| Observability           | OpenTelemetry                                   |
| Secrets                 | External Secrets Operator + AWS Secrets Manager |
| CI                      | GitHub Actions                                  |

## Naming Conventions

- **Files and directories**: `kebab-case` (e.g., `patient-intake-service`)
- **TypeScript types/classes/interfaces**: `PascalCase` (e.g., `PatientAdmission`)
- **Variables/functions/properties**: `camelCase` (e.g., `calculateDosage`)
- **Constants/env vars**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)
- **K8s resources, Helm charts**: `kebab-case`
- **Agents**: `{office}-{role}-agent` (e.g., `clinical-triage-agent`)
- **Services**: `velya-{domain}-{responsibility}` (e.g., `velya-clinical-intake`)
- **Namespaces**: `velya-{env}-{domain}` (e.g., `velya-prod-clinical`)

## Non-Negotiables

1. **No secrets in code.** Use External Secrets Operator. No exceptions.
2. **No `latest` tags.** Every image, chart, and dependency must be pinned.
3. **All infrastructure is declarative.** No manual console changes. OpenTofu + ArgoCD only.
4. **All changes are auditable.** Git is the source of truth. Every change has a PR.
5. **ADR for architectural decisions.** Record in `docs/architecture/decisions/`.
6. **Pin GitHub Actions by SHA.** Never reference actions by mutable tag.
7. **Tests required.** No merging without passing unit + integration tests.
8. **Structured logging only.** JSON logs with OpenTelemetry correlation.

## Repository Structure

```
velya-platform/
  apps/           # Frontend applications
  services/       # Backend microservices
  agents/         # AI agent definitions and code
  packages/       # Shared libraries (monorepo)
  infra/          # OpenTofu modules and ArgoCD manifests
  platform/       # Platform services (observability, networking, auth)
  docs/           # Architecture decisions, runbooks, product specs
  tests/          # E2E and integration test suites
  scripts/        # Build, deploy, and utility scripts
```

## Workflow

- Branch from `main`, PR back to `main`.
- CI runs lint, typecheck, unit tests, security scan on every PR.
- ArgoCD syncs from `main` to dev, promoted to staging/prod via Git tags.
- Feature flags gate risky changes in production.
- Destructive migrations require explicit approval.
