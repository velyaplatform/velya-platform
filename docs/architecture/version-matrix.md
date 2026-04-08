# Version Matrix

This matrix tracks the exact version of every component in the Velya platform, its source, update strategy, and operational notes.

## Application Runtime

| Component | Version | Source | Update Strategy | Notes |
|-----------|---------|--------|-----------------|-------|
| Node.js | 22.12+ LTS | nodejs.org | Follow LTS schedule; patch updates within 7 days | Use `node:22-slim` Docker base image; ARM64 (Graviton) builds |
| TypeScript | 5.7+ | npm | Minor updates within 30 days; major after validation | Strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enabled |
| Next.js | 15.1+ | npm | Minor updates after 2-week soak; major as sprint | App Router only; Pages Router not used |
| NestJS | 11.0+ | npm | Minor updates within 30 days | Monorepo mode with `@nestjs/cli` workspaces |
| React | 19.0+ | npm | Follows Next.js dependency | Server Components used extensively |
| pnpm | 9.14+ | npm (corepack) | Patch updates immediately | Corepack-managed; version pinned in package.json `packageManager` field |
| Turborepo | 2.3+ | npm | Minor updates within 30 days | Remote cache via self-hosted server or Vercel |

## Data & Persistence

| Component | Version | Source | Update Strategy | Notes |
|-----------|---------|--------|-----------------|-------|
| PostgreSQL | 16.x | AWS RDS | Minor updates via RDS maintenance window; major as planned migration | Multi-AZ, 30-day backup retention, PITR enabled |
| Medplum | 3.2+ | Docker Hub / GitHub | Track upstream releases; update within 30 days | Self-hosted on EKS; PostgreSQL 16 backend |
| pgvector | 0.7+ | RDS extension | Updated with RDS engine updates | Used for embedding similarity search |
| PgBouncer | 1.23+ | Docker Hub | Patch updates within 14 days | Sidecar container; transaction pooling mode |

## Messaging & Workflows

| Component | Version | Source | Update Strategy | Notes |
|-----------|---------|--------|-----------------|-------|
| NATS Server | 2.10+ | nats-io/nats-server (Helm) | Minor updates within 14 days | 3-node JetStream cluster; R3 replication for streams |
| NATS CLI | 0.1+ | GitHub releases | Latest stable | Used for operational debugging and stream management |
| Temporal Server | 1.25+ | temporalio/server (Helm) | Minor updates within 30 days; major as planned migration | 4-service deployment (frontend, history, matching, worker) |
| Temporal TypeScript SDK | 1.11+ | npm | Minor updates within 14 days | Pin exact version in pnpm-lock.yaml |
| Temporal UI | 2.31+ | temporalio/ui-server (Helm) | Follows Temporal Server updates | Read-only in prod; full access in dev/staging |

## Infrastructure & Orchestration

| Component | Version | Source | Update Strategy | Notes |
|-----------|---------|--------|-----------------|-------|
| EKS | 1.31 | AWS | Upgrade within 60 days of new version GA; follow AWS deprecation schedule | Auto Mode enabled; in-place upgrade with PodDisruptionBudgets |
| OpenTofu | 1.9+ | opentofu.org | Minor updates within 30 days | State encryption enabled; S3 backend with DynamoDB locking |
| Helm | 3.16+ | helm.sh | Minor updates within 30 days | Used by ArgoCD for chart rendering; not used for direct installs |
| ArgoCD | 2.13+ | argoproj/argo-cd (Helm) | Minor updates within 30 days | HA mode (3 replicas); Redis for caching |
| Kustomize | 5.4+ | Built into kubectl/ArgoCD | Follows ArgoCD version | Used for environment overlays |
| KEDA | 2.16+ | kedacore/keda (Helm) | Minor updates within 30 days | NATS JetStream scaler, Temporal scaler, cron scaler |
| cert-manager | 1.16+ | jetstack/cert-manager (Helm) | Minor updates within 30 days | Let's Encrypt production issuer; DNS-01 challenge via Route 53 |
| External Secrets Operator | 0.12+ | external-secrets/external-secrets (Helm) | Minor updates within 30 days | AWS Secrets Manager provider |

## Observability

| Component | Version | Source | Update Strategy | Notes |
|-----------|---------|--------|-----------------|-------|
| OpenTelemetry Collector | 0.110+ | otel/opentelemetry-collector-contrib (Helm) | Minor updates within 14 days | Contrib distribution for NATS, PostgreSQL receivers |
| OpenTelemetry SDK (Node.js) | 1.28+ | npm (@opentelemetry/*) | Minor updates within 14 days | Auto-instrumentation for Express, NestJS, pg, nats |
| Prometheus | 2.54+ | prometheus-community/kube-prometheus-stack (Helm) | Minor updates within 30 days | Deployed via kube-prometheus-stack; 15-day retention |
| Grafana | 11.3+ | grafana/grafana (Helm) | Minor updates within 30 days | SSO via OIDC; provisioned dashboards via ConfigMaps |
| Loki | 3.2+ | grafana/loki (Helm) | Minor updates within 30 days | Simple scalable mode; S3 backend for chunk storage |
| Tempo | 2.6+ | grafana/tempo (Helm) | Minor updates within 30 days | S3 backend; integrated with Grafana for trace visualization |
| Alertmanager | 0.27+ | prometheus-community/kube-prometheus-stack (Helm) | Follows Prometheus stack updates | PagerDuty and Slack integrations |

## Security & Scanning

| Component | Version | Source | Update Strategy | Notes |
|-----------|---------|--------|-----------------|-------|
| Trivy | 0.57+ | aquasecurity/trivy (CI action) | Latest in CI; pin major version | Scans container images and filesystem in CI pipeline |
| Syft | 1.14+ | anchore/syft (CI action) | Latest in CI | Generates CycloneDX SBOMs for every container image |
| Grype | 0.82+ | anchore/grype (CI action) | Latest in CI | Scans SBOMs for known vulnerabilities; fails CI on critical/high |
| OPA Gatekeeper | 3.17+ | open-policy-agent/gatekeeper (Helm) | Minor updates within 30 days | Enforces pod security, image source, and resource limit policies |

## Development Tooling

| Component | Version | Source | Update Strategy | Notes |
|-----------|---------|--------|-----------------|-------|
| ESLint | 9.14+ | npm | Minor updates within 14 days | Flat config format; typescript-eslint 8+ |
| Prettier | 3.4+ | npm | Minor updates within 14 days | Enforced in CI; trailing commas, single quotes |
| Vitest | 2.1+ | npm | Minor updates within 14 days | Workspace-aware; coverage via v8 |
| Playwright | 1.48+ | npm | Minor updates within 30 days | Chromium-only in CI; all browsers in local dev |
| Docker Compose | 2.29+ | docker.com | Follows Docker Desktop updates | Defines local dev stack (PostgreSQL, NATS, Temporal, Medplum) |
| GitHub Actions | - | github.com | Pin action versions by SHA | Renovate bot monitors action version updates |
