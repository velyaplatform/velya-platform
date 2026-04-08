# ADR-0005: ArgoCD for GitOps Delivery

## Status
Accepted

## Date
2026-04-08

## Context
The platform requires a deployment mechanism that treats Git as the single source of truth for all Kubernetes workloads. Manual `kubectl apply` or CI-driven `helm upgrade` workflows are error-prone, lack drift detection, and provide no continuous reconciliation. Healthcare compliance requirements demand full auditability of what is deployed, when, and by whom. A GitOps operator that continuously reconciles cluster state with Git-declared state addresses all of these concerns.

## Decision
We will use ArgoCD 2.13+ as the GitOps operator for all Kubernetes workload deployments. ArgoCD will run in a dedicated `argocd` namespace on each cluster and manage all application deployments via the App-of-Apps pattern. Application manifests are stored in `infra/argocd/` with Kustomize overlays per environment (dev, staging, prod). ArgoCD will sync automatically for dev/staging and require manual approval (sync window + sync policy) for production. All Helm charts are rendered by ArgoCD at sync time using Helm-templated Application resources.

## Consequences

### Positive
- Git becomes the auditable, immutable record of every deployment, satisfying compliance traceability requirements
- Continuous reconciliation detects and corrects configuration drift automatically
- App-of-Apps pattern enables declarative management of dozens of services from a single root application
- ArgoCD's RBAC and SSO integration (via Dex/OIDC) provide fine-grained access control for deployment approvals

### Negative
- ArgoCD adds operational overhead: it requires its own HA deployment, Redis, and application controller tuning
- Debugging sync failures requires understanding ArgoCD's reconciliation model, which has a learning curve

### Risks
- ArgoCD's application controller may become a bottleneck if managing hundreds of applications on a single instance
- Mitigation: Use ApplicationSets for templated applications, tune reconciliation intervals, and consider sharding across multiple controllers if needed

## Alternatives Considered
- **Flux CD**: Rejected because ArgoCD provides a superior web UI for deployment visualization, rollback, and audit trails, which are critical for healthcare compliance reviews
- **Spinnaker**: Rejected due to its heavyweight architecture, complex setup, and declining community momentum
- **CI-driven deployment (GitHub Actions + helm upgrade)**: Rejected because push-based deployment lacks drift detection, continuous reconciliation, and the auditability guarantees of a GitOps operator
