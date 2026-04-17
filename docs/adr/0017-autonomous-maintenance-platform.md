# ADR-0017: Autonomous Maintenance Platform

**Status:** Accepted  
**Date:** 2026-04-17  
**Deciders:** Lucas Lima (Founder)

## Context

The Velya platform has 28+ GitHub Actions workflows, OpenTofu modules for VPC/EKS/ECR/IAM, ArgoCD GitOps, Helm charts, Dockerfiles, and multiple npm packages. Dependencies are partially managed by Dependabot (GitHub-native, no config in repo), but there is no unified system for:

- Detecting updates across all dependency types (OpenTofu providers, Helm charts, base images, platform controllers, GitHub Actions SHAs)
- Automatically applying updates with AI-assisted code changes
- Validating in homolog before promoting
- Rolling back automatically on failure
- Tracking metrics of the maintenance automation itself

### Current State Gaps

| Gap | Impact |
|-----|--------|
| No Renovate config | Dependabot covers npm/Docker/Actions but misses OpenTofu providers, Helm repos, Kustomize images |
| No Updatecli | Custom sources (platform controller versions, EKS add-on versions) not tracked |
| No reusable workflows | Each workflow duplicates CI patterns (checkout, setup, lint, test) |
| No agent adapter | No automated AI executor for complex update PRs |
| No promotion policy | Changes go to dev auto-sync but no structured homolog→prod gate |
| No drift detection | No scheduled `tofu plan` to detect infrastructure drift |
| No maintenance observability | No metrics on update detection rate, PR success rate, rollback frequency |

## Decision

### Approach A (Chosen): Composition of Mature Tools

| Concern | Tool | Justification |
|---------|------|---------------|
| Dependency detection (primary) | **Renovate self-hosted** (GitHub App mode) | Covers npm, Docker, Helm, GitHub Actions, OpenTofu providers, regex managers. Most mature multi-ecosystem detector. |
| Dependency detection (gaps) | **Updatecli** | For EKS add-on versions, platform controller versions from GitHub Releases, custom HCL patterns Renovate can't parse. |
| CI/CD backbone | **GitHub Actions reusable workflows** | Already using GHA. Reusable workflows reduce duplication. No need for Atlantis (adds server complexity). |
| GitOps deployment | **ArgoCD** (existing) + **ArgoCD Image Updater** | Already running ArgoCD. Image Updater watches ECR for new digests and auto-commits to Git. |
| AI executor | **Claude Code** (primary) + **Codex** (fallback) | Claude Code already deeply integrated. Codex as fallback via feature flag. |
| AWS event triggers | **EventBridge** + **repository_dispatch** | EventBridge captures ECR push and Inspector findings. Lambda forwards to GitHub repository_dispatch. |
| Runners | **GitHub-hosted** (initial) | ARC on EKS deferred — current workload doesn't justify self-hosted runner overhead. |
| Developer portal | **Backstage** deferred | No immediate need. ArgoCD dashboard + Grafana cover visibility. Revisit when team >5 engineers. |

### Why Not Approach B (Custom Control Plane)

A custom orchestrator would need to replicate what Renovate + Updatecli + ArgoCD Image Updater already do well. The maintenance burden of a bespoke system exceeds the marginal benefit. We adopt Approach A and only build thin glue where tools don't connect natively.

### Comparative Matrix

| Criterion | Renovate | Dependabot | Updatecli |
|-----------|----------|------------|-----------|
| OpenTofu providers | Yes (regex) | No | Yes |
| Helm chart repos | Yes | No | Yes |
| GitHub Actions SHA pinning | Yes | Yes | Partial |
| Custom file patterns | Yes (regex manager) | No | Yes (YAML manifests) |
| Auto-merge policies | Yes (built-in) | Limited | No (needs CI) |
| Grouping/scheduling | Excellent | Basic | Manual |
| Self-hosted option | Yes | No | Yes |

**Decision:** Renovate as primary (covers ~85% of sources), Updatecli for the remaining ~15%.

| Criterion | Atlantis | GitHub Actions |
|-----------|----------|---------------|
| Server to maintain | Yes (ECS/EKS) | No |
| OpenTofu support | Community fork | Native |
| Cost | Compute + ops | Free tier sufficient |
| Lock management | Built-in | Via concurrency groups |

**Decision:** GitHub Actions reusable workflows. Atlantis adds operational cost without proportional benefit at current scale.

| Criterion | ArgoCD Image Updater | Flux Image Automation |
|-----------|---------------------|----------------------|
| Already using ArgoCD | Yes | Would require migration |
| Maturity | Stable | Stable |
| ECR support | Yes | Yes |
| Git commit style | Configurable | Configurable |

**Decision:** ArgoCD Image Updater. Already on ArgoCD; switching to Flux has no justification.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DETECTION LAYER                        │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐  │
│  │ Renovate │  │ Updatecli │  │ EventBridge+Lambda   │  │
│  │ (cron)   │  │ (cron)    │  │ (ECR/Inspector push) │  │
│  └────┬─────┘  └─────┬─────┘  └──────────┬───────────┘  │
│       │              │                    │               │
│       ▼              ▼                    ▼               │
│  ┌─────────────────────────────────────────────────┐     │
│  │         GitHub PRs / repository_dispatch         │     │
│  └────────────────────┬────────────────────────────┘     │
└───────────────────────┼──────────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────────┐
│                EXECUTION LAYER                            │
│                       ▼                                   │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Reusable Workflows (GHA)                         │    │
│  │  ┌────────┐ ┌──────────┐ ┌───────┐ ┌──────────┐ │    │
│  │  │ Lint   │ │ Validate │ │ Test  │ │ Plan/    │ │    │
│  │  │ Format │ │ Security │ │ Build │ │ Apply    │ │    │
│  │  └────────┘ └──────────┘ └───────┘ └──────────┘ │    │
│  └──────────────────────┬───────────────────────────┘    │
│                         │                                 │
│  ┌──────────────────────▼───────────────────────────┐    │
│  │  Agent Adapter (Claude Code / Codex)              │    │
│  │  - Reads context, analyzes impact                 │    │
│  │  - Edits files, adjusts versions                  │    │
│  │  - Fixes CI failures (max 3 retries)              │    │
│  │  - Opens/updates PR, marks for auto-merge         │    │
│  └──────────────────────┬───────────────────────────┘    │
└─────────────────────────┼────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────┐
│              PROMOTION LAYER                              │
│                         ▼                                 │
│  ┌────────────────────────────────────────────────┐      │
│  │  Risk Classification Engine                     │      │
│  │  LOW:  auto-merge + auto-promote               │      │
│  │  MED:  auto + soak time + metrics validation   │      │
│  │  HIGH: auto to homolog, block prod promotion   │      │
│  └────────────────────┬───────────────────────────┘      │
│                       ▼                                   │
│  ┌────────────────────────────────────────────────┐      │
│  │  ArgoCD (dev auto-sync) → staging (manual) →   │      │
│  │  prod (manual + 2 approvals)                    │      │
│  └────────────────────┬───────────────────────────┘      │
│                       ▼                                   │
│  ┌────────────────────────────────────────────────┐      │
│  │  ArgoCD Image Updater (ECR digest → Git commit) │      │
│  └────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────┘
```

## Consequences

### Positive
- Unified dependency management across all ecosystems
- AI-assisted complex updates reduce manual toil
- Structured promotion prevents blind production changes
- Full auditability via Git PRs
- Observable maintenance metrics

### Negative
- Renovate self-hosted requires a GitHub App token (or PAT with repo scope)
- Updatecli manifests add maintenance surface
- ArgoCD Image Updater is another component to monitor

### Risks
- Renovate may generate noisy PRs if grouping/scheduling isn't tuned
- AI executor may produce incorrect changes that pass CI but break runtime — mitigated by homolog soak time
- EventBridge→Lambda→GitHub dispatch chain adds latency (~30s) to ECR event propagation

## Assumptions

| Assumption | Validation Method | Deadline | Fallback |
|------------|-------------------|----------|----------|
| Renovate regex manager can parse OpenTofu provider blocks | Test with current `main.tf` | Week 1 | Use Updatecli for providers |
| ArgoCD Image Updater supports ECR with OIDC auth | Deploy to dev cluster | Week 2 | Manual image update workflow |
| Claude Code can reliably fix CI failures in ≤3 retries | Shadow run on 20 real PRs | Week 4 | Fall back to Codex or human |
| GitHub-hosted runners are sufficient for OpenTofu plan | Measure plan times for current modules | Week 1 | Migrate to ARC on EKS |

## References

- ADR-0004: OpenTofu IaC
- ADR-0005: ArgoCD GitOps
- ADR-0009: Two-cluster architecture
