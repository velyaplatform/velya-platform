# ArgoCD Bootstrap

## Prerequisites

- Kubernetes cluster (1.27+)
- `kubectl` configured with cluster admin access
- `helm` v3.12+

## Bootstrap Steps

### 1. Install ArgoCD via Helm

```bash
# Create the argocd namespace
kubectl apply -f infra/bootstrap/argocd/namespace.yaml

# Add the ArgoCD Helm repository
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

# Install ArgoCD
helm install argocd argo/argo-cd \
  --namespace argocd \
  --version 7.7.5 \
  --set server.extraArgs={--insecure} \
  --set configs.params."server\.insecure"=true \
  --set controller.replicas=1 \
  --set repoServer.replicas=1 \
  --set applicationSet.replicas=1 \
  --wait
```

### 2. Create Environment Namespaces

```bash
kubectl apply -f infra/bootstrap/namespaces/dev.yaml
kubectl apply -f infra/bootstrap/namespaces/staging.yaml
kubectl apply -f infra/bootstrap/namespaces/prod.yaml
```

### 3. Apply Policies

```bash
kubectl apply -f infra/bootstrap/policies/
```

### 4. Apply the App-of-Apps

```bash
kubectl apply -f infra/bootstrap/argocd/app-of-apps.yaml
kubectl apply -f infra/bootstrap/argocd/platform-apps.yaml
```

### 5. Access ArgoCD UI

```bash
# Get the initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port-forward the ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8443:443
```

Open https://localhost:8443 and log in with username `admin` and the password from above.

## App-of-Apps Pattern

This bootstrap uses the ArgoCD app-of-apps pattern:

- `app-of-apps.yaml` - Root Application pointing to `infra/kubernetes/apps/` which contains child Application manifests
- `platform-apps.yaml` - Application definitions for platform services (AI gateway, agent orchestrator)

ArgoCD watches the Git repository and automatically syncs changes. When a new Application manifest is added to `infra/kubernetes/apps/`, ArgoCD creates and manages it automatically.

## Repository Structure

```
infra/
  bootstrap/argocd/       # This directory - bootstrap manifests
  kubernetes/
    apps/                  # App-of-apps child definitions (Kustomization)
    base/                  # Base Kubernetes resources
    platform/              # Platform service definitions
    overlays/
      dev/                 # Dev environment patches
      staging/             # Staging environment patches
      prod/                # Production environment patches
  helm/
    velya-service/         # Generic Helm chart for Velya microservices
```
