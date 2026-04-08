# Velya Local Development - Testing Guide

## Quick Start

### 1. Prerequisites

```bash
# Install kind
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.22.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# Install kubectl, helm (if not already installed)
# ... (standard installation)
```

### 2. Setup Local Cluster

```bash
cd velya-platform

# Create 4-node kind cluster with tier isolation
./scripts/kind-setup.sh setup

# Verify setup
./scripts/kind-setup.sh verify

# Should output: 5 nodes (1 control-plane + 4 workers)
# Node groups: frontend, backend, platform, ai
```

### 3. Access Services

```bash
# Terminal 1: Prometheus
kubectl port-forward -n velya-dev-observability svc/prometheus-kube-prometheus-prometheus 9090:9090
# → http://localhost:9090

# Terminal 2: Grafana
kubectl port-forward -n velya-dev-observability svc/grafana 3000:80
# → http://localhost:3000 (admin/admin)

# Terminal 3: ArgoCD
kubectl port-forward -n argocd svc/argocd-server 8080:443
# → https://localhost:8080 (admin/password from secrets)

# Terminal 4: Your app
kubectl port-forward -n velya-dev-core svc/velya-api-gateway 3000:3000
# → http://localhost:3000
```

---

## Testing Tier Isolation

### Test 1: Node Group Assignment

```bash
# Verify nodes are labeled correctly
kubectl get nodes -L velya.io/tier,velya.io/workload

# Expected output:
# NAME                  TIER        WORKLOAD
# velya-local-worker    frontend    web
# velya-local-worker2   backend     api
# velya-local-worker3   platform    infra
# velya-local-worker4   ai          agents
```

### Test 2: Deploy Frontend (No Taints)

```yaml
# frontend-test.yaml
apiVersion: v1
kind: Pod
metadata:
  name: frontend-test
  namespace: velya-dev-core
spec:
  nodeSelector:
    velya.io/tier: frontend

  containers:
    - name: nginx
      image: nginx:alpine
      ports:
        - containerPort: 80
      resources:
        requests:
          cpu: 50m
          memory: 64Mi
        limits:
          memory: 256Mi
```

```bash
kubectl apply -f frontend-test.yaml
kubectl get pod frontend-test -n velya-dev-core
# Should be Running on frontend node
```

### Test 3: Deploy Backend (No Taints)

```yaml
# backend-test.yaml
apiVersion: v1
kind: Pod
metadata:
  name: backend-test
  namespace: velya-dev-core
spec:
  nodeSelector:
    velya.io/tier: backend

  containers:
    - name: busybox
      image: busybox:latest
      command: ['sleep', '3600']
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
```

```bash
kubectl apply -f backend-test.yaml
kubectl get pod backend-test -n velya-dev-core
# Should be Running on backend node
```

### Test 4: Deploy Platform Tool (Requires Toleration)

```yaml
# platform-test.yaml
apiVersion: v1
kind: Pod
metadata:
  name: platform-test
  namespace: velya-dev-platform
spec:
  nodeSelector:
    velya.io/tier: platform

  tolerations:
    - key: 'velya.io/platform'
      operator: 'Equal'
      value: 'true'
      effect: 'NoSchedule'

  containers:
    - name: busybox
      image: busybox:latest
      command: ['sleep', '3600']
```

```bash
kubectl apply -f platform-test.yaml
kubectl get pod platform-test -n velya-dev-platform
# Should be Running on platform node

# Test WITHOUT toleration (should fail)
kubectl apply -f platform-test-no-toleration.yaml
kubectl get pod platform-test-no-toleration -n velya-dev-platform
# Status: Pending (can't tolerate platform taint)
```

### Test 5: Deploy AI Workload (Requires Toleration)

```yaml
# ai-test.yaml
apiVersion: v1
kind: Pod
metadata:
  name: ai-test
  namespace: velya-dev-agents
spec:
  nodeSelector:
    velya.io/tier: ai

  tolerations:
    - key: 'velya.io/ai-workload'
      operator: 'Equal'
      value: 'true'
      effect: 'NoSchedule'

  containers:
    - name: python
      image: python:3.11-slim
      command: ['python', '-c', 'import time; time.sleep(3600)']
      resources:
        requests:
          cpu: 200m
          memory: 256Mi
```

```bash
kubectl apply -f ai-test.yaml
kubectl get pod ai-test -n velya-dev-agents
# Should be Running on ai node
```

---

## Testing Network Policies

### Test 1: Frontend → Backend (Allowed)

```bash
# Get frontend pod IP
FRONTEND_IP=$(kubectl get pod frontend-test -n velya-dev-core -o jsonpath='{.status.podIP}')

# Get backend pod IP
BACKEND_IP=$(kubectl get pod backend-test -n velya-dev-core -o jsonpath='{.status.podIP}')

# Test connectivity from frontend to backend
kubectl exec -it frontend-test -n velya-dev-core -- nc -zv $BACKEND_IP 80
# Expected: Connection succeed
```

### Test 2: Platform → Backend (Allowed)

```bash
BACKEND_IP=$(kubectl get pod backend-test -n velya-dev-core -o jsonpath='{.status.podIP}')

kubectl exec -it platform-test -n velya-dev-platform -- nc -zv $BACKEND_IP 3000
# Expected: Connection succeed (for metrics scraping)
```

### Test 3: Platform ↔ AI (Blocked)

```bash
AI_IP=$(kubectl get pod ai-test -n velya-dev-agents -o jsonpath='{.status.podIP}')

# Try from AI to Platform (should be blocked)
kubectl exec -it ai-test -n velya-dev-agents -- nc -zv 10.0.0.X 9090
# Expected: Connection timeout (blocked by policy)
```

---

## Testing Resource Quotas

### View Quotas

```bash
# Frontend quotas
kubectl describe resourcequota frontend-tier-quota -n velya-dev-core

# Backend quotas
kubectl describe resourcequota backend-tier-quota -n velya-dev-core

# Platform quotas
kubectl describe resourcequota platform-tier-quota -n velya-dev-platform

# AI quotas
kubectl describe resourcequota ai-agents-tier-quota -n velya-dev-agents
```

### Test Quota Limits

```bash
# Try to exceed CPU quota
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: cpu-hog
  namespace: velya-dev-core
spec:
  containers:
  - name: stress
    image: progrium/stress
    resources:
      requests:
        cpu: 5  # Exceeds frontend quota of 4
EOF

# Should be rejected:
# Error from server (Forbidden): ... exceeded quota: frontend-tier-quota
```

---

## Testing Auto-Scaling (HPA)

### Create HPA for Frontend

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: frontend-hpa
  namespace: velya-dev-core
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: frontend
  minReplicas: 1
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

```bash
kubectl apply -f hpa-test.yaml

# Monitor HPA
kubectl get hpa -n velya-dev-core -w

# Generate load
kubectl run -it load-generator --image=busybox /bin/sh
# Inside pod: while true; do wget -q -O- http://frontend-service; done

# Watch pods scale up
kubectl get pods -n velya-dev-core -w
```

---

## Testing Pod Disruption Budgets (PDB)

### View PDBs

```bash
kubectl get pdb --all-namespaces

# Detailed view
kubectl describe pdb --all-namespaces
```

### Test PDB Protection

```bash
# Create a deployment with PDB
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: protected-app
  namespace: velya-dev-core
spec:
  replicas: 2
  selector:
    matchLabels:
      app: protected
  template:
    metadata:
      labels:
        app: protected
    spec:
      containers:
      - name: app
        image: busybox
        command: ["sleep", "3600"]
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: protected-pdb
  namespace: velya-dev-core
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: protected
EOF

# Try to evict all pods (should fail with PDB)
kubectl delete pod -l app=protected -n velya-dev-core --grace-period=0 --force

# One pod should be protected
```

---

## Testing Container Registry (Optional)

### Setup Local Registry

```bash
# Create registry container
docker run -d -p 5000:5000 --name kind-registry registry:2

# Connect registry to kind network
docker network connect kind kind-registry

# Update kubeadm config (already in kind-setup.sh)
```

### Build and Push Local Image

```bash
# Build web app
docker build -t localhost:5000/velya-web:latest apps/web/

# Push to local registry
docker push localhost:5000/velya-web:latest

# Deploy from local registry
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: local-web
  namespace: velya-dev-core
spec:
  nodeSelector:
    velya.io/tier: frontend

  containers:
  - name: web
    image: localhost:5000/velya-web:latest
    imagePullPolicy: Always
EOF
```

---

## Monitoring & Debugging

### Check cluster health

```bash
# Node status
kubectl get nodes -o wide

# Component status
kubectl get cs

# Event logs
kubectl get events --all-namespaces --sort-by='.lastTimestamp'
```

### Check network policies

```bash
# View policies
kubectl get networkpolicies --all-namespaces

# Detailed view
kubectl describe networkpolicy frontend-tier-policy -n velya-dev-core
```

### Check resource usage

```bash
# Node usage
kubectl top nodes

# Pod usage (requires metrics-server)
kubectl top pods --all-namespaces
```

### Pod logs

```bash
# View logs
kubectl logs -n velya-dev-core deployment/frontend

# Follow logs
kubectl logs -f -n velya-dev-core pod/frontend-test

# Get logs from all containers
kubectl logs -n velya-dev-core pod/frontend-test --all-containers=true
```

---

## Cleanup

```bash
# Delete test pods
kubectl delete pod frontend-test backend-test platform-test ai-test -n velya-dev-core --ignore-not-found

# Delete kind cluster
./scripts/kind-setup.sh teardown

# Remove kubeconfig
kubectl config delete-context kind-velya-local
kubectl config delete-cluster kind-velya-local
```

---

## Troubleshooting

### Cluster won't start

```bash
# Check Docker
docker ps -a | grep kind

# Check kind logs
kind get logs --name velya-local

# Clean up and retry
kind delete cluster --name velya-local
./scripts/kind-setup.sh setup
```

### Pod stuck in Pending

```bash
# Check node labels
kubectl get nodes -L velya.io/tier

# Check pod events
kubectl describe pod <name> -n <namespace>

# Check taints
kubectl describe node <node-name> | grep Taints
```

### Network policies too restrictive

```bash
# Temporarily disable policies for testing
kubectl delete networkpolicies --all --all-namespaces

# Reapply
kubectl apply -f infra/bootstrap/tier-isolation/network-policies-by-tier.yaml
```

### Not enough resources

```bash
# Check quotas
kubectl describe resourcequota --all-namespaces

# Reduce requests in test pods
# Edit and redeploy with smaller resource requests
```

---

## Next: Deploy Real Applications

Once you've tested the local setup, you can:

1. Deploy actual Velya services
2. Test inter-service communication
3. Test observability (metrics, logs)
4. Test ArgoCD deployments
5. Prepare for AWS deployment

```bash
# Build and deploy services
docker build -t localhost:5000/velya-api-gateway:latest apps/api-gateway/
docker push localhost:5000/velya-api-gateway:latest

# Deploy via kubectl or ArgoCD
kubectl apply -f deploy/backend.yaml
```

---

**All local testing complete? Ready for AWS deployment! 🚀**
