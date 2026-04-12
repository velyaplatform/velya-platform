# External Configuration Inventory

**Audience:** velya platform admins.
**Purpose:** single source of truth for every repository variable and
secret the autopilot esteira reads. If a value in this file is missing,
the corresponding validation mechanism will run in degraded mode —
documented in the "Degradation" column below — rather than fail hard.

> **Principle:** missing secrets must never page a human. Every workflow
> that reads an optional secret falls back to `unknown` / `skip` / `no-op`
> and reports it explicitly in the step summary.

## How to populate

GitHub UI: `Settings → Secrets and variables → Actions`.
- **Variables** (non-sensitive, visible to anyone with repo access) → `Variables` tab.
- **Secrets** (sensitive, write-only) → `Secrets` tab.

Or via `gh` CLI authenticated as an admin of `velyaplatform/velya-platform`:

```bash
# Variables
gh variable set VELYA_FHIR_BASE_URL --body "https://fhir.velya.internal"
gh variable set VELYA_GRAFANA_URL --body "https://grafana.velya.internal"

# Secrets
gh secret set VELYA_FHIR_PROBE_TOKEN   # paste on prompt
gh secret set GRAFANA_TOKEN
gh secret set ARGOCD_AUTH_TOKEN
```

## Inventory

### Clinical — post-merge probes (`clinical-post-merge-monitor.yaml`)

| Key | Kind | Consumer | Default | Degradation when missing |
|---|---|---|---|---|
| `VELYA_FHIR_BASE_URL` | var | FHIR `/metadata` reachability probe | *(unset)* | Probe reports `reachable=unknown`, overall health downgraded to `degraded` (never `critical`) |
| `VELYA_FHIR_PROBE_TOKEN` | secret | `Authorization: Bearer` on `/Patient?_count=1` p95 probe | *(unset)* | p95 reports `unknown`, budget check skipped |
| `VELYA_P95_BUDGET_MS` | var | Latency budget for `/Patient` | `1500` | — (has default) |
| `VELYA_ERR_RATE_BUDGET` | var | Recent 5xx rate budget | `0.02` | — (has default) |

### ArgoCD healer (`argocd-healer.yaml` + cluster CronJob)

| Key | Kind | Consumer | Default | Degradation when missing |
|---|---|---|---|---|
| `ARGOCD_SERVER` | secret | `argocd` CLI host:port | *(unset)* | Healer falls back to `kubectl` on `applications.argoproj.io` CRD (works in-cluster) |
| `ARGOCD_AUTH_TOKEN` | secret | `argocd` CLI JWT | *(unset)* | Same — kubectl fallback |
| `ARGOCD_INSECURE` | var | Skip TLS verification | `false` | — |
| `ARGOCD_PROJECT_FILTER` | env/vars | Only heal apps in this project | *(unset)* | Healer scopes to every project |
| `VELYA_COOPERATIVE_LOCKING` | var | Global toggle for ADR-0016 cooperative locks | `true` | If set to `false`, healer and troubleshooter run without locks (rollback path) |

### Grafana correlation (`argocd-healer.yaml`, `platform-validation.yaml`)

| Key | Kind | Consumer | Default | Degradation when missing |
|---|---|---|---|---|
| `VELYA_GRAFANA_URL` / `GRAFANA_URL` | var | Grafana `/api/health` + alerts API | *(unset)* | Healer reports `grafanaIntegration: false`; platform-validation skips the grafana job |
| `GRAFANA_TOKEN` | secret | Bearer token for Grafana API | *(unset)* | Same — correlation skipped |

### K8s troubleshooter (`argocd-healer.yaml` + cluster CronJob)

| Key | Kind | Consumer | Default | Degradation when missing |
|---|---|---|---|---|
| `VELYA_NS_ALLOWLIST` | var | Comma-separated namespaces the troubleshooter may touch | `velya-dev-core,velya-dev-platform,velya-dev-agents,velya-dev-observability` | — (has default) |
| `VELYA_COOPERATIVE_LOCKING` | var | Namespace-level cooperative locks | `true` | Set to `false` to disable |
| `VELYA_CRASH_AGE_MIN` | var | Min minutes in CrashLoop before restart | `5` | — |

### Backend dependency probes (`run-infra-health.ts`)

All four vars per dep are optional — defaults match common operator patterns
(NATS Helm chart, Temporal Helm chart, Zalando Postgres operator).

| Key | Kind | Default | Description |
|---|---|---|---|
| `VELYA_NATS_NAMESPACE` | var | `velya-dev-core` | Namespace where NATS JetStream lives |
| `VELYA_NATS_LABEL` | var | `app.kubernetes.io/name=nats` | Label selector to find NATS workloads |
| `VELYA_TEMPORAL_NAMESPACE` | var | `velya-dev-platform` | Namespace where Temporal lives |
| `VELYA_TEMPORAL_LABEL` | var | `app.kubernetes.io/name=temporal` | Label selector to find Temporal workloads |
| `VELYA_POSTGRES_NAMESPACE` | var | `velya-dev-core` | Namespace where Postgres lives |
| `VELYA_POSTGRES_LABEL` | var | `application=spilo` | Label selector to find Postgres workloads |

### Clinical workflow sentinel (`clinical-workflow-sentinel.yaml`)

| Key | Kind | Consumer | Default | Degradation when missing |
|---|---|---|---|---|
| `CRITICAL_MONITORS` | hard-coded in workflow | Which workflows to probe every 4h | see workflow file | — |
| *(none required)* | | | | Sentinel uses `GITHUB_TOKEN` only |

### Memory-guardian + PHI scanner

No external configuration. Both read only the repo tree.

### Supply chain (`security-supply-chain.yaml`)

| Key | Kind | Consumer | Default | Degradation when missing |
|---|---|---|---|---|
| `VELYA_DEPENDENCY_GRAPH_ENABLED` | var | Gate for `dependency-review-action` | `false` | Job is skipped if var not set to `'true'`. **Turn on after enabling `Dependency graph` in Settings → Security & analysis.** |

### AWS / EKS (`argocd-healer.yaml`, `deploy-web.yaml`)

| Key | Kind | Consumer | Default | Degradation when missing |
|---|---|---|---|---|
| `VELYA_AWS_ROLE_ARN` | var | OIDC `role-to-assume` | *(unset)* | `aws-actions/configure-aws-credentials` step is skipped; workflows that need AWS creds will fail the AWS-specific steps |
| `VELYA_AWS_REGION` | var | Region for `aws eks update-kubeconfig` | `us-east-1` | — |
| `VELYA_EKS_CLUSTER` | var | Cluster name passed to `update-kubeconfig` | *(unset)* | `kubectl` is not wired; kubectl-dependent steps no-op |

## One-shot audit

Run the `config-audit.yaml` workflow manually to get a per-row status
report of which variables and secrets are currently set. The job never
fails — it only reports, so you can run it on any PR or on main.

```bash
gh workflow run config-audit.yaml
```

## Triage order (priority if you have 10 minutes)

1. **`VELYA_AWS_ROLE_ARN` + `VELYA_EKS_CLUSTER`** — without these, the
   healer can't connect to the cluster at all from GitHub Actions.
   The in-cluster CronJob keeps working because it uses Pod Identity.
2. **`VELYA_FHIR_BASE_URL`** — without this, the post-merge monitor
   has no signal at all.
3. **`VELYA_GRAFANA_URL` / `GRAFANA_TOKEN`** — nice-to-have; the healer
   works without Grafana, but alert correlation is more valuable than
   raw k8s state alone.
4. **`ARGOCD_SERVER` / `ARGOCD_AUTH_TOKEN`** — optional; kubectl
   fallback works.
5. **`VELYA_DEPENDENCY_GRAPH_ENABLED`** — flip only after enabling the
   Dependency graph setting in `Settings → Security & analysis`.
