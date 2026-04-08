# ADR-0001: Monorepo Structure

## Status

Accepted

## Date

2026-04-08

## Context

Velya is a healthcare platform comprising multiple services, frontends, AI agents, and infrastructure definitions. We needed to decide whether to use a monorepo or polyrepo strategy. A polyrepo approach would scatter related code across dozens of repositories, making cross-cutting changes difficult, dependency management fragile, and onboarding slower. Given the tight coupling between clinical services, AI agents, and infrastructure definitions, a unified repository offers significant coordination advantages.

## Decision

We will use a monorepo organized into six top-level directories: `apps/` for user-facing applications (Next.js frontends), `services/` for backend microservices (NestJS), `platform/` for shared platform services (Medplum, NATS, Temporal), `packages/` for shared libraries and types, `agents/` for autonomous AI agents, and `infra/` for all infrastructure-as-code (OpenTofu, Helm charts, ArgoCD manifests). We will use Turborepo for build orchestration and pnpm workspaces for dependency management.

## Consequences

### Positive

- Atomic commits across services, agents, and infrastructure ensure consistency
- Shared TypeScript types and libraries are consumed directly without publishing to a registry
- Single CI pipeline with Turborepo caching reduces build times and simplifies CI configuration
- Developers see the full system in one place, accelerating onboarding and cross-team collaboration

### Negative

- Repository size will grow over time, requiring careful use of sparse checkouts and shallow clones
- CI complexity increases as the number of packages grows; build graph must be well-defined to avoid unnecessary rebuilds

### Risks

- Monorepo tooling (Turborepo, pnpm workspaces) may introduce learning curve for new contributors
- Mitigation: Provide clear workspace documentation and Turborepo pipeline definitions in turbo.json

## Alternatives Considered

- **Polyrepo (one repo per service)**: Rejected because it fragments shared types, complicates cross-service refactoring, and requires a private npm registry for shared packages
- **Nx monorepo**: Rejected in favor of Turborepo due to Turborepo's simpler configuration, better caching model, and lighter runtime footprint
- **Bazel**: Rejected as over-engineered for a TypeScript-dominant codebase; Bazel's strengths in multi-language builds are unnecessary here
