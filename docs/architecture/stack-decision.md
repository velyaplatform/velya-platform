# Stack Decision

This document enumerates every technology in the Velya platform stack, the version adopted, and the rationale for its inclusion.

## Application Runtime

| Component | Version | Role |
|-----------|---------|------|
| Node.js | 22 LTS | Server-side JavaScript runtime for all backend services and build tooling |
| TypeScript | 5.7+ | Type-safe language across the entire stack; strict mode enforced |
| Next.js | 15 | Frontend framework with App Router, React Server Components, and streaming SSR |
| NestJS | 11 | Backend framework providing dependency injection, module organization, and microservices transports (NATS, gRPC) |
| React | 19 | UI library used via Next.js; leverages Server Components and Suspense |
| pnpm | 9+ | Package manager with workspace support and content-addressable storage |
| Turborepo | 2+ | Monorepo build orchestrator with remote caching |

## Data & Persistence

| Component | Version | Role |
|-----------|---------|------|
| PostgreSQL | 16 | Primary relational database for all services, Medplum, and Temporal |
| Medplum | 3.x | Self-hosted FHIR R4 server with TypeScript SDK, SMART on FHIR auth |
| pgvector | 0.7+ | PostgreSQL extension for vector similarity search (embeddings storage) |
| PgBouncer | 1.23+ | Connection pooler for PostgreSQL, deployed as sidecar |

## Messaging & Workflows

| Component | Version | Role |
|-----------|---------|------|
| NATS | 2.10+ | Event-driven messaging backbone with JetStream for durable streams |
| Temporal | 1.25+ | Durable workflow engine for long-running clinical and operational processes |
| Temporal TypeScript SDK | 1.11+ | Workflow and activity authoring in TypeScript |

## Infrastructure & Orchestration

| Component | Version | Role |
|-----------|---------|------|
| AWS EKS | 1.31 | Managed Kubernetes with Auto Mode (AWS-managed Karpenter) |
| OpenTofu | 1.9+ | Infrastructure-as-code with state encryption; all infra in `infra/tofu/` |
| Helm | 3.16+ | Kubernetes package manager for third-party chart deployments |
| ArgoCD | 2.13+ | GitOps operator for continuous deployment via Git reconciliation |
| Kustomize | 5.4+ | Manifest overlay system used by ArgoCD for per-environment configuration |
| KEDA | 2.16+ | Event-driven autoscaler; scales workloads based on NATS queue depth, Temporal task queue backlog |
| cert-manager | 1.16+ | Automated TLS certificate management with Let's Encrypt |
| External Secrets Operator | 0.12+ | Syncs secrets from AWS Secrets Manager into Kubernetes Secrets |

## Observability

| Component | Version | Role |
|-----------|---------|------|
| OpenTelemetry | 1.x (SDK), 0.110+ (Collector) | Unified telemetry collection: traces, metrics, logs |
| Prometheus | 2.54+ | Metrics collection, storage, and alerting |
| Grafana | 11+ | Dashboarding and visualization for metrics, logs, and traces |
| Loki | 3.2+ | Log aggregation with LogQL query language |
| Tempo | 2.6+ | Distributed trace storage and querying |
| Alertmanager | 0.27+ | Alert routing, deduplication, and notification |

## AI & Machine Learning

| Component | Version | Role |
|-----------|---------|------|
| Anthropic Claude API | claude-sonnet-4-20250514+ | Primary LLM for clinical reasoning and agent intelligence |
| OpenAI API | gpt-4o+ | Secondary LLM provider for comparison and fallback |
| vLLM | 0.6+ | Self-hosted LLM inference server for local/fine-tuned models |
| Ollama | 0.4+ | Local model runner for development and testing |

## Security & Compliance

| Component | Version | Role |
|-----------|---------|------|
| AWS KMS | - | Encryption key management for data at rest |
| AWS IAM + Pod Identity | - | Fine-grained pod-to-AWS-service authorization |
| Trivy | 0.57+ | Container image vulnerability scanning in CI |
| Syft | 1.14+ | SBOM generation for supply chain security |
| Grype | 0.82+ | Vulnerability scanning against generated SBOMs |
| OPA Gatekeeper | 3.17+ | Kubernetes admission controller for policy enforcement |

## Development Tooling

| Component | Version | Role |
|-----------|---------|------|
| ESLint | 9+ | Linting with flat config and TypeScript-specific rules |
| Prettier | 3+ | Code formatting (enforced in CI) |
| Vitest | 2+ | Unit and integration testing framework |
| Playwright | 1.48+ | End-to-end browser testing |
| Docker Compose | 2.29+ | Local development environment for PostgreSQL, NATS, Temporal |
| GitHub Actions | - | CI/CD pipeline for build, test, lint, scan, and image push |

## Version Selection Principles

1. **LTS first**: Use LTS versions where available (Node.js 22 LTS, PostgreSQL 16). Avoid odd-numbered Node.js releases.
2. **Production-proven**: Adopt versions that have had at least 2 months of production exposure in the broader community.
3. **Security patches**: Apply patch-level updates within 7 days of release. Minor version updates within 30 days after validation.
4. **Major upgrades**: Plan major version upgrades as dedicated engineering sprints with full regression testing.
5. **Lock files**: pnpm-lock.yaml is committed and enforced in CI via `pnpm install --frozen-lockfile`.
