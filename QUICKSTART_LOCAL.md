# Velya Local Development - Quick Start

Get both **kind** (local Kubernetes) and **ministack** (AWS simulation) running in 5 minutes.

## Prerequisites Check (2 min)

```bash
# Check what you have
docker --version
which kind kubectl helm          # These are optional, will be auto-detected
```

**Required:** Docker  
**Optional:** kind, kubectl, helm (script will guide you to install if needed)

## Option 1: Local Kubernetes Only (kind) - 2 minutes

Perfect for day-to-day development and testing tier isolation.

```bash
cd velya-platform

# Install (if not present)
# macOS:
brew install kind kubectl helm

# Linux (Ubuntu/Debian):
sudo apt-get install -y kind kubectl helm

# Now setup
./scripts/multistack-setup.sh kind
./scripts/multistack-setup.sh verify
```

**What you get:**
- 5-node Kubernetes cluster (1 control-plane + 4 workers)
- Nodes labeled by tier: frontend, backend, platform, ai
- Network policies between tiers
- Resource quotas per tier
- Prometheus, Grafana, ArgoCD (optional)

**Test it:**
```bash
# See your nodes
kubectl get nodes -L velya.io/tier

# Deploy test pod
kubectl apply -f - <<'EOF'
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
EOF

# Check it deployed to frontend tier
kubectl get pod frontend-test -n velya-dev-core -o wide
```

## Option 2: AWS Simulation (ministack) - 3 minutes

Visualize how services will run on actual AWS (VPC, EKS, RDS, ECR, etc.).

```bash
cd velya-platform

# Setup (requires Git clone of ministack)
./scripts/multistack-setup.sh ministack
./scripts/multistack-setup.sh verify
```

**What you get:**
- LocalStack: AWS API emulation
- VPC with public/private subnets
- Simulated EKS cluster with 4 node groups
- RDS PostgreSQL
- ECR registry
- CloudWatch logs

**Test it:**
```bash
# List AWS resources
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

# Check EKS clusters
aws eks describe-clusters --region us-east-1

# Check RDS databases
aws rds describe-db-instances --region us-east-1

# Check VPC
aws ec2 describe-vpcs --region us-east-1
```

## Option 3: Everything (kind + ministack) - 5 minutes

Full stack: Local K8s development + AWS infrastructure validation.

```bash
cd velya-platform

# Setup both
./scripts/multistack-setup.sh both
./scripts/multistack-setup.sh verify
```

**What you get:**
- Everything from Option 1 (kind)
- Everything from Option 2 (ministack)
- Run both simultaneously for integrated testing

## Verify Everything Works

```bash
# Check kind cluster
kubectl cluster-info
kubectl get nodes -L velya.io/tier
kubectl get namespaces

# Check ministack
docker ps | grep localstack
curl http://localhost:4566 2>/dev/null && echo "✓ LocalStack OK"
```

## Deploy Your First Service to kind

```bash
# 1. Create a test deployment
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: velya-test-api
  namespace: velya-dev-core
spec:
  replicas: 2
  selector:
    matchLabels:
      app: test-api
  template:
    metadata:
      labels:
        app: test-api
        velya.io/tier: backend
    spec:
      nodeSelector:
        velya.io/tier: backend
      containers:
      - name: api
        image: node:20-alpine
        command: ["sleep", "3600"]
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            memory: 512Mi
EOF

# 2. Verify pods landed on backend tier
kubectl get pods -n velya-dev-core -o wide -L velya.io/tier

# 3. Expected output:
# velya-test-api-xxx   1/1     Running   0     velya-local-worker2   backend
# velya-test-api-yyy   1/1     Running   0     velya-local-worker2   backend
```

## Test Tier Isolation

```bash
# Try to deploy to platform tier WITHOUT toleration (should fail)
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: test-platform-bad
  namespace: velya-dev-platform
spec:
  nodeSelector:
    velya.io/tier: platform
  containers:
  - name: test
    image: nginx:alpine
EOF

kubectl get pod test-platform-bad -n velya-dev-platform
# Status: Pending (can't tolerate platform taint) ✓

# Deploy WITH toleration (should succeed)
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: test-platform-good
  namespace: velya-dev-platform
spec:
  nodeSelector:
    velya.io/tier: platform
  tolerations:
  - key: velya.io/platform
    operator: Equal
    value: "true"
    effect: NoSchedule
  containers:
  - name: test
    image: nginx:alpine
EOF

kubectl get pod test-platform-good -n velya-dev-platform
# Status: Running ✓
```

## Access Services

### kind Services
```bash
# Prometheus (metrics)
kubectl port-forward -n velya-dev-observability svc/prometheus-kube-prometheus-prometheus 9090:9090
# Then: http://localhost:9090

# Grafana (dashboards)
kubectl port-forward -n velya-dev-observability svc/grafana 3000:80
# Then: http://localhost:3000 (admin/admin)

# ArgoCD (GitOps)
kubectl port-forward -n argocd svc/argocd-server 8080:443
# Then: https://localhost:8080
```

### ministack Services
```bash
# LocalStack (AWS API)
curl http://localhost:4566

# AWS CLI
export AWS_ENDPOINT_URL=http://localhost:4566
aws ec2 describe-instances --region us-east-1
```

## Run Full Test Suite

```bash
# Test tier isolation comprehensively
bash scripts/kind-local-testing.md

# Or run individual tests
kubectl get nodes -L velya.io/tier,velya.io/workload       # Test 1
kubectl describe resourcequota --all-namespaces             # Test 2
kubectl get networkpolicies -A                              # Test 3
```

## Cleanup

```bash
# Stop kind only
kind delete cluster --name velya-local

# Stop ministack only
cd .ministack/repo && docker-compose down

# Stop everything
./scripts/multistack-setup.sh teardown

# Remove all local data
rm -rf .kind .ministack
```

## What's Next?

After validating locally, proceed to AWS:

```bash
# Deploy to AWS dev
./scripts/deploy.sh infrastructure dev velya-dev

# Verify AWS deployment
./scripts/verify.sh infrastructure dev velya-dev

# Check status
./scripts/verify.sh infrastructure dev velya-dev 2>&1 | grep "✓"
```

## Troubleshooting

### Docker not running?
```bash
# Start Docker
docker ps   # Should work
# If not: Open Docker Desktop or run daemon
```

### kind command not found?
```bash
# Install kind
brew install kind              # macOS
sudo apt-get install -y kind   # Linux
```

### Pods stuck in Pending?
```bash
# Check node labels
kubectl get nodes -L velya.io/tier

# Check pod events
kubectl describe pod <name> -n velya-dev-core

# Check taints on nodes
kubectl describe node <node-name> | grep Taints
```

### Can't connect to LocalStack?
```bash
# Check container is running
docker ps | grep localstack

# Check logs
docker logs velya-localstack

# Restart
docker-compose -f .ministack/repo/docker-compose.yml restart
```

### Permission denied running scripts?
```bash
chmod +x scripts/*.sh
./scripts/multistack-setup.sh kind
```

## Key Commands Reference

| Command | Purpose |
|---|---|
| `./scripts/multistack-setup.sh both` | Setup kind + ministack |
| `./scripts/multistack-setup.sh verify` | Check both are running |
| `./scripts/multistack-setup.sh teardown` | Stop everything |
| `kubectl get nodes -L velya.io/tier` | View tier assignment |
| `kubectl apply -f manifest.yaml` | Deploy to kind |
| `kubectl describe pod <name> -n <ns>` | Debug pod issues |
| `aws ec2 describe-instances` | Check AWS resources (ministack) |

## Documentation

- **Setup Guide**: `docs/LOCAL_SETUP.md`
- **Architecture Guide**: `docs/ARCHITECTURE_LOCAL.md`
- **Testing Procedures**: `scripts/kind-local-testing.md`
- **Deployment Guide**: `DEPLOYMENT.md`

## Need Help?

Check troubleshooting sections in:
- `docs/LOCAL_SETUP.md` (Troubleshooting section)
- `scripts/kind-local-testing.md` (Debugging section)
- `ARCHITECTURE_LOCAL.md` (Development Workflows)

---

**Ready?** Run this now:
```bash
cd velya-platform
./scripts/multistack-setup.sh both
./scripts/multistack-setup.sh verify
```

Then check what's running:
```bash
kubectl get nodes -L velya.io/tier
kubectl get pods -A
docker ps | grep -E "localstack|minio|postgres|redis|nats"
```

Happy developing! 🚀
