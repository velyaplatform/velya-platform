# GitOps Flow Validation — Velya Platform

**Date**: 2026-04-08
**Tool**: ArgoCD
**Cluster**: kind-velya-local
**ArgoCD URL**: http://argocd.172.19.0.6.nip.io
**Status**: CRITICAL BLOCKER — ArgoCD installed, zero Applications configured

---

## Executive Summary

ArgoCD is installed and operational. The UI is accessible, pods are running, and the system is ready to manage applications. However, **zero ArgoCD Application CRDs have been configured**. This means:

- The current cluster state (64 pods, all services running) was deployed manually — not via GitOps
- There is no link between the git repository and the cluster state
- Changes to `infra/kubernetes/` have no effect on the running cluster
- Git is not the source of truth for cluster state — the cluster is the source of truth, which inverts the GitOps model
- There is no rollback capability
- Drift between git and cluster is undetectable

This is the most urgent non-business-logic gap in the platform.

---

## 1. ArgoCD Installation

### 1.1 Pod Status

| Pod | Namespace | Expected | Status |
|---|---|---|---|
| argocd-server | argocd | Running | PASS |
| argocd-application-controller | argocd | Running | PASS |
| argocd-repo-server | argocd | Running | PASS |
| argocd-dex-server | argocd | Running | PASS |
| argocd-redis | argocd | Running | PASS |
| argocd-applicationset-controller | argocd | Running | PASS |
| argocd-notifications-controller | argocd | Running | PASS |

**Total**: 7/7 pods running. ArgoCD installation is complete.

### 1.2 ArgoCD Accessibility

| Check | Expected | Found | Status |
|---|---|---|---|
| UI accessible | HTTP 200 | HTTP 200 | PASS |
| URL | http://argocd.172.19.0.6.nip.io | Working | PASS |
| TLS | Should be HTTPS | HTTP only (no TLS) | NOT IMPLEMENTED |
| Authentication | SSO or admin | admin account present | PASS (dev) |

---

## 2. Application Configuration

### 2.1 ArgoCD Applications

| Check | Expected | Found | Status |
|---|---|---|---|
| Applications configured | One per service group | ZERO | BLOCKER |
| App-of-Apps root app | Present | ABSENT | NOT IMPLEMENTED |
| ApplicationSet resources | Present | NOT VERIFIED | NOT PROVABLE |

**Evidence**: `argocd app list` returns empty. No Application CRD instances exist in the `argocd` namespace.

### 2.2 Git Repository Manifests

| Path | Expected Content | Found | Status |
|---|---|---|---|
| `infra/argocd/` | Application manifests | ABSENT — directory not found | BLOCKER |
| `infra/kubernetes/apps/` | Service manifests | EXISTS | PASS |
| `infra/kubernetes/base/` | Base Kustomize | EXISTS | PASS |
| `infra/kubernetes/overlays/` | Environment overlays | EXISTS | PASS |
| `infra/kubernetes/platform/` | Platform manifests | EXISTS | PASS |
| `infra/kubernetes/services/` | Service manifests | EXISTS | PASS |

The Kubernetes manifests exist in the repository. The ArgoCD Application manifests that would point ArgoCD at those Kubernetes manifests do NOT exist.

---

## 3. Required GitOps Flow (Design)

### 3.1 App-of-Apps Pattern

```
Git Repository
└── infra/argocd/
    ├── root-app.yaml              ← Root Application (points to infra/argocd/apps/)
    └── apps/
        ├── velya-dev-core.yaml    ← Application for core services
        ├── velya-dev-platform.yaml
        ├── velya-dev-agents.yaml
        ├── velya-dev-observability.yaml
        ├── velya-dev-web.yaml
        └── system/
            ├── ingress-nginx.yaml
            ├── metallb.yaml
            ├── keda.yaml
            └── eso.yaml

ArgoCD watches root-app.yaml → discovers all child apps → syncs each
```

### 3.2 Sync Policies

| Environment | Sync Policy | Prune | Self-Heal | Approval Required |
|---|---|---|---|---|
| dev | Automated | YES | YES | No |
| staging | Manual | YES | NO | Team Lead |
| prod | Manual | YES | NO | Two reviewers |

### 3.3 Promotion Flow

```
Developer → PR to main → CI passes → Merge
  ↓
ArgoCD detects change in infra/kubernetes/overlays/dev/
  ↓
Auto-sync to velya-dev-* namespaces
  ↓
Health checks pass → Deployment complete

For staging:
  Create PR to update infra/kubernetes/overlays/staging/ image tags
  → PR approval → Merge
  → Manual ArgoCD sync trigger
  → Health checks pass → Promote to prod

For prod:
  Same pattern with two-reviewer approval
  Manual ArgoCD sync with explicit confirmation
```

---

## 4. Remediation Plan

### Step 1: Create infra/argocd/ Directory Structure

```bash
mkdir -p infra/argocd/apps/system
```

### Step 2: Create Root App-of-Apps

```yaml
# infra/argocd/root-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: velya-root
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/velya/velya-platform
    targetRevision: main
    path: infra/argocd/apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

### Step 3: Create Application for Core Services

```yaml
# infra/argocd/apps/velya-dev-core.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: velya-dev-core
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/velya/velya-platform
    targetRevision: main
    path: infra/kubernetes/overlays/dev/core
  destination:
    server: https://kubernetes.default.svc
    namespace: velya-dev-core
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=false
      - PrunePropagationPolicy=foreground
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas  # Allow KEDA to manage replicas
```

### Step 4: Repeat for Each Namespace/Service Group

Create similar Application manifests for:
- `velya-dev-platform.yaml`
- `velya-dev-agents.yaml`
- `velya-dev-observability.yaml`
- `velya-dev-web.yaml`

### Step 5: Apply Root App

```bash
kubectl apply -f infra/argocd/root-app.yaml
```

This single `kubectl apply` is the last manual operation. From this point, ArgoCD manages everything.

### Step 6: Verify Sync

```bash
argocd app list
argocd app sync velya-root
argocd app wait velya-root --health
```

---

## 5. Drift Detection

### 5.1 Current Status

Drift detection is NOT POSSIBLE without Applications configured. Even if someone manually changes the cluster (e.g., deletes a deployment), there is no ArgoCD watcher to detect or correct it.

### 5.2 After Implementation

With ArgoCD Applications configured:
- Self-heal: ArgoCD will automatically revert unauthorized cluster changes (in dev)
- Drift alerts: ArgoCD will alert on out-of-sync resources (staging/prod)
- Sync history: Every sync event is logged with operator, timestamp, and diff
- Health monitoring: ArgoCD health checks prevent routing to unhealthy pods

---

## 6. Sync Failure Response

Once ArgoCD Applications are configured, sync failures need a response procedure.

### 6.1 Common Sync Failure Causes

| Cause | Symptom | Resolution |
|---|---|---|
| Manifest syntax error | App shows OutOfSync + error | Fix YAML, push to git, re-sync |
| Image not found | Deployment stuck | Fix image tag, push, re-sync |
| Resource quota exceeded | Namespace quota hit | Increase quota or optimize resources |
| NetworkPolicy blocking ArgoCD | App health degraded | Check ArgoCD egress rules |
| CRD missing | Resource type unknown | Install CRD first, then sync app |
| Secret not found | Pod in pending state | Verify ExternalSecret is synced |

### 6.2 Monitoring ArgoCD Sync Health

After implementation, add:
1. PrometheusRule for ArgoCD sync failure alerts
2. Grafana dashboard for ArgoCD application health
3. Slack/PagerDuty notification on sync failure

---

## 7. GitOps Validation Checklist (Post-Implementation)

Use this checklist after ArgoCD Applications are created:

- [ ] `argocd app list` shows all expected applications
- [ ] All apps show `Synced` status
- [ ] All apps show `Healthy` status
- [ ] Making a change in git triggers auto-sync in dev (within 3 minutes)
- [ ] Manually deleting a resource in cluster is auto-corrected by ArgoCD
- [ ] Rollback via ArgoCD history works
- [ ] Staging sync requires manual trigger
- [ ] ArgoCD sync events appear in audit log

---

## 8. GitOps Validation Summary

| Item | Status |
|---|---|
| ArgoCD installation | PASS |
| ArgoCD accessibility | PASS |
| ArgoCD pod health | PASS |
| ArgoCD Application manifests in git | BLOCKER |
| ArgoCD Applications deployed | BLOCKER |
| App-of-Apps pattern | NOT IMPLEMENTED |
| Auto-sync for dev | NOT IMPLEMENTED |
| Manual sync for staging/prod | NOT IMPLEMENTED |
| Drift detection | NOT IMPLEMENTED |
| Sync failure alerting | NOT IMPLEMENTED |
| Promotion flow | NOT IMPLEMENTED |
| Rollback capability | NOT IMPLEMENTED |

**Overall GitOps Score: 30/100**

The 30 points come entirely from ArgoCD being installed and accessible. The remaining 70 points require implementing Applications.

---

*GitOps validation owned by: GitOps Operator agent + Infrastructure Team. Priority: P1 — complete before end of next sprint.*
