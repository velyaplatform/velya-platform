@AGENTS.md

# Velya Platform

AI-native hospital platform built on AWS EKS. TypeScript/Node.js backend, FHIR-first clinical data model via Medplum, event-driven architecture.

## Navigation

- **Domain rules**: `.claude/rules/` (security, naming, infrastructure, agents, architecture, quality)
- **Subagents**: `.claude/agents/` (specialized AI agents for platform tasks)
- **Skills**: `.claude/skills/` (reusable automation skills)
- **Delegation ledger**: `.claude/ledger/delegations.jsonl` (append-only — ver `README.md` no mesmo diretório)

## Opensquad

This repository also includes **Opensquad** for non-clinical, operational/creative squads.

- Entry point in Claude Code: `/opensquad`
- Supported shortcuts:
  - `/opensquad help`
  - `/opensquad create <description>`
  - `/opensquad list`
  - `/opensquad run <name>`
  - `/opensquad edit <name> <changes>`
  - `/opensquad skills`
- The command behavior is defined in `.claude/skills/opensquad/SKILL.md`.
- Before creating or running squads, load `_opensquad/_memory/company.md` and `_opensquad/_memory/preferences.md`.
- Before running a squad, also load `squads/<name>/squad.yaml`, `squads/<name>/_memory/memories.md`, and `_opensquad/core/runner.pipeline.md`.
- Do not manually edit `_opensquad/core/` unless you are intentionally changing the framework itself.

## Delegation protocol (mandatory)

Whenever an agent (including Claude Code main sessions or subagents invoked via `Task`) delegates work to another agent, the delegation MUST be appended to `.claude/ledger/delegations.jsonl`:

1. **At request time** — append line with `status: "pending"` containing `{id, ts, from, to, task, context, status, evidencePath}`.
2. **At completion** — append a new line with the same `id` and `status: "completed"` (or `"blocked"` / `"rejected"`) and `evidencePath` pointing to the artifact (PR, doc, review).
3. **Never edit prior lines** — the ledger is append-only. The dashboard and the `delegation-coordinator-agent` aggregate by `id` and use the latest status.
4. The `delegation-coordinator-agent` supervises integrity (stale pending entries, delegation loops, orphaned tasks).
- **Full taxonomy**: `docs/product/naming-taxonomy.md`
- **Hospital modules map (single source of truth)**: `docs/product/hospital-modules-map.md` — canonical mapping of every clinical/operational module to its FHIR resource, data class, web route, authorized roles, compliance gate, and backlog priority. Every new hospital feature MUST appear here before the PR merges.

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
