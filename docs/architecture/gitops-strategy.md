# GitOps Strategy

This document defines how code changes flow from a developer's pull request through to production, using ArgoCD as the GitOps operator and Git as the single source of truth for all deployed state.

## Core Principles

1. **Git is the source of truth**: The desired state of every Kubernetes cluster is declared in Git. No manual `kubectl apply` or `helm upgrade` in any environment.
2. **Declarative, not imperative**: All workloads are defined as Kubernetes manifests (Kustomize bases + overlays). ArgoCD reconciles cluster state to match Git.
3. **Pull-based deployment**: ArgoCD pulls state from Git and applies it. The CI pipeline never pushes to the cluster directly.
4. **Immutable artifacts**: Container images are tagged by Git SHA. Once built, an image is never modified. Promotion means changing the image tag in the overlay, not rebuilding.

## Deployment Flow

```
Developer                 GitHub                CI (GitHub Actions)         ArgoCD              Cluster
   |                        |                         |                      |                    |
   |-- push branch -------> |                         |                      |                    |
   |-- open PR -----------> |                         |                      |                    |
   |                        |-- trigger CI ---------->|                      |                    |
   |                        |                         |-- lint, test ------->|                    |
   |                        |                         |-- build image ------>|                    |
   |                        |                         |-- push to ECR ----->|                    |
   |                        |                         |-- scan (Trivy) ---->|                    |
   |                        |                         |-- SBOM (Syft) ----->|                    |
   |                        |                         |-- update dev        |                    |
   |                        |                         |   overlay image tag  |                    |
   |                        |                         |   (commit to main)   |                    |
   |                        |                         |                      |                    |
   |-- PR approved -------> |                         |                      |                    |
   |-- merge to main -----> |                         |                      |                    |
   |                        |                         |                      |-- detect change -->|
   |                        |                         |                      |-- sync dev ------->|
   |                        |                         |                      |-- health check --->|
   |                        |                         |                      |                    |
   |                        |                         |                      |   (auto for dev)   |
   |                        |                         |                      |                    |
   |-- create release/* --> |                         |                      |                    |
   |   branch               |                         |                      |-- detect change -->|
   |                        |                         |                      |-- sync staging --->|
   |                        |                         |                      |-- health check --->|
   |                        |                         |                      |                    |
   |-- tag vX.Y.Z --------> |                         |                      |                    |
   |                        |                         |                      |                    |
   |-- manual sync -------> |                         |                      |-- sync prod ------>|
   |   (ArgoCD UI/CLI)      |                         |                      |-- health check --->|
   |                        |                         |                      |-- notify Slack --->|
```

## Repository Layout

All ArgoCD manifests live under `infra/argocd/` in the monorepo:

```
infra/argocd/
  app-of-apps/
    dev.yaml              # Root Application for dev environment
    staging.yaml          # Root Application for staging environment
    prod.yaml             # Root Application for prod environment
  applications/
    patient-service.yaml  # Application template (Kustomize)
    scheduling-api.yaml
    medplum.yaml
    temporal.yaml
    nats.yaml
    monitoring.yaml
    ...
  base/
    patient-service/
      deployment.yaml
      service.yaml
      hpa.yaml
      network-policy.yaml
      kustomization.yaml
    scheduling-api/
      ...
  overlays/
    dev/
      patient-service/
        kustomization.yaml   # patches: image tag, replicas, resource limits
      scheduling-api/
        kustomization.yaml
    staging/
      patient-service/
        kustomization.yaml
      ...
    prod/
      patient-service/
        kustomization.yaml
      ...
```

## App-of-Apps Pattern

ArgoCD uses the App-of-Apps pattern to manage all workloads declaratively. A single root Application resource points to the `applications/` directory, which contains one Application manifest per service.

### Root Application (dev example)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: velya-dev-root
  namespace: argocd
spec:
  project: velya-dev
  source:
    repoURL: https://github.com/velya-health/velya-platform.git
    targetRevision: main
    path: infra/argocd/applications
    directory:
      recurse: false
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ApplyOutOfSyncOnly=true
```

### Child Application (patient-service example)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: patient-service
  namespace: argocd
  labels:
    app.kubernetes.io/part-of: velya
    velya.health/tier: application
spec:
  project: velya-dev
  source:
    repoURL: https://github.com/velya-health/velya-platform.git
    targetRevision: main
    path: infra/argocd/overlays/dev/patient-service
  destination:
    server: https://kubernetes.default.svc
    namespace: velya-app
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    retry:
      limit: 3
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  health:
    # Custom health checks beyond default Kubernetes readiness
    ignoreDifferences:
      - group: apps
        kind: Deployment
        jsonPointers:
          - /spec/replicas  # Ignore HPA-managed replica count
```

## Overlay Strategy

Each environment overlay patches the base manifests with environment-specific values. Overlays use Kustomize patches, not Helm values, for transparency and diff-ability.

### Base Manifest (deployment.yaml)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: patient-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: patient-service
  template:
    metadata:
      labels:
        app: patient-service
    spec:
      serviceAccountName: patient-service
      containers:
        - name: patient-service
          image: patient-service:latest  # Overridden by overlay
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
```

### Dev Overlay (kustomization.yaml)

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: velya-app
resources:
  - ../../../base/patient-service
images:
  - name: patient-service
    newName: 111111111111.dkr.ecr.us-east-1.amazonaws.com/velya/patient-service
    newTag: abc1234  # Git SHA, updated by CI
patches:
  - target:
      kind: Deployment
      name: patient-service
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 1
      - op: replace
        path: /spec/template/spec/containers/0/resources/requests/cpu
        value: 100m
      - op: replace
        path: /spec/template/spec/containers/0/resources/requests/memory
        value: 128Mi
      - op: replace
        path: /spec/template/spec/containers/0/resources/limits/cpu
        value: 250m
      - op: replace
        path: /spec/template/spec/containers/0/resources/limits/memory
        value: 256Mi
```

### Prod Overlay (kustomization.yaml)

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: velya-app
resources:
  - ../../../base/patient-service
images:
  - name: patient-service
    newName: 333333333333.dkr.ecr.us-east-1.amazonaws.com/velya/patient-service
    newTag: v1.2.0  # Semantic version tag pointing to verified Git SHA
patches:
  - target:
      kind: Deployment
      name: patient-service
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 3
      - op: replace
        path: /spec/template/spec/containers/0/resources/requests/cpu
        value: 500m
      - op: replace
        path: /spec/template/spec/containers/0/resources/requests/memory
        value: 512Mi
      - op: replace
        path: /spec/template/spec/containers/0/resources/limits/cpu
        value: "1"
      - op: replace
        path: /spec/template/spec/containers/0/resources/limits/memory
        value: 1Gi
```

## Image Tag Update Automation

When CI builds a new container image, it updates the image tag in the relevant overlay's `kustomization.yaml` via a Git commit. This triggers ArgoCD to detect the change and sync.

### CI Pipeline Steps

1. **Build**: `docker build -t velya/patient-service:${GIT_SHA} .`
2. **Push**: `docker push ${ECR_REPO}/velya/patient-service:${GIT_SHA}`
3. **Update overlay**: Use `kustomize edit set image` to update the tag in the dev overlay:
   ```bash
   cd infra/argocd/overlays/dev/patient-service
   kustomize edit set image "patient-service=${ECR_REPO}/velya/patient-service:${GIT_SHA}"
   ```
4. **Commit and push**: The CI bot commits the kustomization.yaml change to `main`.
5. **ArgoCD detects**: ArgoCD polls the repo (default: 3 minutes) or receives a webhook notification and initiates sync.

### Promotion to Staging

When creating a `release/*` branch, the staging overlay is updated with the verified image tag:

```bash
cd infra/argocd/overlays/staging/patient-service
kustomize edit set image "patient-service=${ECR_REPO}/velya/patient-service:${RELEASE_SHA}"
git commit -m "chore: promote patient-service ${RELEASE_SHA} to staging"
```

### Promotion to Production

After staging validation, the production overlay is updated and a Git tag is created:

```bash
cd infra/argocd/overlays/prod/patient-service
kustomize edit set image "patient-service=${ECR_REPO}/velya/patient-service:${RELEASE_SHA}"
git commit -m "chore: promote patient-service v1.2.0 to production"
git tag v1.2.0
```

ArgoCD in production requires manual sync. The release manager clicks "Sync" in the ArgoCD UI or runs:

```bash
argocd app sync patient-service --prune
```

## Health Checks & Rollback

### Sync Health Assessment

ArgoCD evaluates the health of every synced resource:

- **Deployments**: Healthy when all replicas are available and the rollout is complete.
- **StatefulSets**: Healthy when all replicas are ready.
- **Jobs**: Healthy when completed successfully.
- **Custom Resources**: Health assessed via custom Lua health checks in ArgoCD configmap.

### Automated Rollback

For dev and staging, ArgoCD is configured with automated rollback on sync failure:

```yaml
syncPolicy:
  automated:
    prune: true
    selfHeal: true
  retry:
    limit: 3
    backoff:
      duration: 5s
      factor: 2
      maxDuration: 3m
```

If a sync fails after 3 retries, the ArgoCD Application enters a `Degraded` state and an alert fires to Slack and PagerDuty.

### Manual Rollback (Production)

To roll back in production, revert the image tag in the prod overlay to the previous version and commit:

```bash
cd infra/argocd/overlays/prod/patient-service
kustomize edit set image "patient-service=${ECR_REPO}/velya/patient-service:${PREVIOUS_SHA}"
git commit -m "chore: rollback patient-service to ${PREVIOUS_SHA}"
argocd app sync patient-service
```

This approach ensures the rollback is recorded in Git history for audit purposes.

## ArgoCD Project Isolation

Each environment has a dedicated ArgoCD AppProject that restricts which repositories, clusters, and namespaces applications can target:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: velya-prod
  namespace: argocd
spec:
  description: Velya production workloads
  sourceRepos:
    - https://github.com/velya-health/velya-platform.git
  destinations:
    - namespace: velya-app
      server: https://kubernetes.default.svc
    - namespace: medplum
      server: https://kubernetes.default.svc
    - namespace: temporal
      server: https://kubernetes.default.svc
    - namespace: nats
      server: https://kubernetes.default.svc
    - namespace: monitoring
      server: https://kubernetes.default.svc
  clusterResourceWhitelist:
    - group: ""
      kind: Namespace
  namespaceResourceBlacklist:
    - group: ""
      kind: ResourceQuota
    - group: ""
      kind: LimitRange
  roles:
    - name: release-manager
      description: Can sync and rollback applications
      policies:
        - p, proj:velya-prod:release-manager, applications, sync, velya-prod/*, allow
        - p, proj:velya-prod:release-manager, applications, override, velya-prod/*, allow
      groups:
        - velya-release-managers
```

## Sync Windows (Production)

Production deployments are restricted to defined sync windows to avoid changes during high-risk periods:

```yaml
spec:
  syncWindows:
    - kind: allow
      schedule: "0 10 * * 1-5"  # Mon-Fri, 10:00 UTC
      duration: 6h               # Until 16:00 UTC
      applications:
        - "*"
    - kind: deny
      schedule: "0 0 * * *"      # Every day midnight
      duration: 24h              # All day
      applications:
        - "*"
      # Overridden by the allow window above; deny is the default
    - kind: allow
      schedule: "0 0 * * *"      # Emergency: always allowed
      duration: 24h
      manualSync: true           # Only manual syncs, no auto
      applications:
        - "*"
```

## Notifications

ArgoCD sends notifications for sync events via the ArgoCD Notifications controller:

| Event | Channel | Priority |
|-------|---------|----------|
| Sync succeeded (prod) | Slack #deployments | Normal |
| Sync failed (any env) | Slack #deployments + PagerDuty | High |
| Application degraded | PagerDuty | Critical |
| New application created | Slack #deployments | Normal |
| Out of sync > 30 min | Slack #deployments | Warning |
