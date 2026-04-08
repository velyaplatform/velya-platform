# Velya Local Development Setup

Set up **kind** (local Kubernetes) and **ministack** (AWS simulation) to develop and test Velya locally.

## Two Environments

### 1. **kind** - Local Kubernetes Development
- **Purpose**: Fast local development with actual Kubernetes
- **What it simulates**: EKS cluster with 4 node groups (frontend, backend, platform, ai)
- **Speed**: ~1-2 minutes setup/teardown
- **Use case**: Day-to-day development, testing tier isolation, running services locally

### 2. **ministack** - AWS Infrastructure Simulation
- **Purpose**: Visualize how services will run on AWS (VPC, EKS, RDS, ECR, etc.)
- **What it simulates**: Full AWS infrastructure (LocalStack)
- **Speed**: ~1-2 minutes setup, 5-10 minutes for full AWS simulation
- **Use case**: Pre-AWS validation, testing AWS-specific features, IaC templates, networking

## Prerequisites

```bash
# Required
brew install docker                    # macOS
# Or: apt-get install docker.io       # Linux
# Or: Download from https://docker.com/products/docker-desktop

# Recommended (optional - script will skip if not available)
brew install kind kubectl helm
```

## Quick Start

### Option A: Everything (kind + ministack)
```bash
cd velya-platform
./scripts/multistack-setup.sh both
./scripts/multistack-setup.sh verify
```

### Option B: Just Local Kubernetes (kind)
```bash
./scripts/multistack-setup.sh kind
./scripts/multistack-setup.sh verify
```

### Option C: Just AWS Simulation (ministack)
```bash
./scripts/multistack-setup.sh ministack
./scripts/multistack-setup.sh verify
```

## Environment Details

### KIND (Local Kubernetes)

**What gets created:**
- 1 control-plane node
- 4 worker nodes: `frontend`, `backend`, `platform`, `ai`
- Network policies (tier isolation)
- Resource quotas (per-tier limits)
- Namespace: `velya-dev-core`, `velya-dev-platform`, `velya-dev-agents`, `velya-dev-observability`

**Access:**
```bash
# Check nodes
kubectl get nodes -L velya.io/tier

# Check network policies
kubectl get networkpolicies -A

# Check resource quotas
kubectl describe resourcequota --all-namespaces

# Port-forward services
kubectl port-forward -n velya-dev-observability svc/prometheus-kube-prometheus-prometheus 9090:9090
kubectl port-forward -n velya-dev-observability svc/grafana 3000:80
```

**Test tier isolation:**
```bash
# See scripts/kind-local-testing.md for full test suite
kubectl apply -f - <<EOF
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
EOF

kubectl get pod frontend-test -n velya-dev-core
```

### MINISTACK (AWS Simulation)

**What gets created:**
- LocalStack container with AWS API emulation
- VPC with public/private subnets
- Simulated EKS cluster with 4 node groups
- RDS PostgreSQL
- ECR registry
- CloudWatch logs
- VPC Flow Logs

**Access:**
```bash
# Set AWS endpoint for CLI
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Test LocalStack connectivity
curl http://localhost:4566

# List EKS clusters
aws eks describe-clusters --region us-east-1

# List RDS instances
aws rds describe-db-instances

# List EC2 instances
aws ec2 describe-instances
```

**View in AWS Console:**
```bash
# LocalStack provides a web UI (if enabled)
# Check logs for connection details
```

## Development Workflows

### Local Development (kind only)

1. Setup kind cluster:
```bash
./scripts/multistack-setup.sh kind
```

2. Deploy test service:
```bash
# Create a test deployment
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: velya-test-backend
  namespace: velya-dev-core
spec:
  replicas: 2
  selector:
    matchLabels:
      app: test-backend
  template:
    metadata:
      labels:
        app: test-backend
        velya.io/tier: backend
    spec:
      nodeSelector:
        velya.io/tier: backend
      containers:
      - name: backend
        image: node:20-alpine
        command: ["sleep", "3600"]
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            memory: 512Mi
EOF
```

3. Verify tier isolation:
```bash
# Should be scheduled on backend node
kubectl get pod -n velya-dev-core -L velya.io/tier,kubernetes.io/hostname

# Check network policies
kubectl get networkpolicies -A
```

4. Test networking:
```bash
# Get backend pod IP
BACKEND_IP=$(kubectl get pod -l app=test-backend -n velya-dev-core -o jsonpath='{.items[0].status.podIP}')

# Test connectivity from another tier
kubectl run test-pod --image=curlimages/curl -it -- sh
# Inside pod: curl http://${BACKEND_IP}:3000
```

### AWS Validation (ministack)

1. Setup ministack:
```bash
./scripts/multistack-setup.sh ministack
```

2. Test infrastructure as code:
```bash
# Deploy OpenTofu IaC to ministack
cd infra/opentofu
tofu init -backend-config="key=velya.tfstate" -backend-config="bucket=velya-local" -backend-config="endpoint=http://localhost:4566"

# Plan infrastructure
tofu plan -var-file="envs/dev/terraform.tfvars" -var="aws_endpoint_url=http://localhost:4566"

# Apply infrastructure
tofu apply -var-file="envs/dev/terraform.tfvars" -var="aws_endpoint_url=http://localhost:4566"
```

3. Verify AWS resources:
```bash
# Check VPC
aws ec2 describe-vpcs

# Check EKS clusters
aws eks describe-clusters

# Check RDS databases
aws rds describe-db-instances

# Check ECR repositories
aws ecr describe-repositories
```

## Testing Tier Isolation

See `scripts/kind-local-testing.md` for comprehensive test suite covering:

- Node group assignment
- Tier isolation (5 deployment tests)
- Network policy validation
- Resource quota enforcement
- HPA scaling
- PDB protection
- Container registry integration

Quick test:
```bash
./scripts/kind-setup.sh verify
```

## Port Mappings

### kind Services
| Service | Port | Access |
|---|---|---|
| Kubernetes API | 6443 | `kubectl` only |
| Prometheus | 9090 | `kubectl port-forward` |
| Grafana | 3000 | `kubectl port-forward` |
| ArgoCD | 8080 | `kubectl port-forward` |

### ministack Services
| Service | Port | Access |
|---|---|---|
| LocalStack | 4566 | Direct: `http://localhost:4566` |
| S3 | 4572 | Via LocalStack |
| RDS | 5432 | Direct: `localhost:5432` |

## Cleanup

### Remove kind cluster only:
```bash
kind delete cluster --name velya-local
```

### Remove ministack only:
```bash
cd .ministack/repo && docker-compose down
```

### Remove everything:
```bash
./scripts/multistack-setup.sh teardown
```

## Troubleshooting

### kind cluster won't start
```bash
# Check Docker is running
docker ps

# Check kind logs
kind get logs --name velya-local

# Clean and retry
kind delete cluster --name velya-local
./scripts/multistack-setup.sh kind
```

### Pod stuck in Pending
```bash
# Check node labels
kubectl get nodes -L velya.io/tier

# Check pod events
kubectl describe pod <pod-name> -n velya-dev-core

# Check taints
kubectl describe node <node-name> | grep Taints

# Check resource quotas
kubectl describe resourcequota --all-namespaces
```

### LocalStack not responding
```bash
# Check container is running
docker ps | grep localstack

# Check logs
docker logs velya-localstack

# Restart
docker-compose -f .ministack/repo/docker-compose.yml restart
```

### Network policy too restrictive
```bash
# View all policies
kubectl get networkpolicies -A

# Temporarily disable for testing (NOT FOR PROD)
kubectl delete networkpolicies --all -A

# Reapply
kubectl apply -f infra/bootstrap/tier-isolation/network-policies-by-tier.yaml
```

## Next Steps

After local validation:

1. **Deploy to AWS dev environment**:
   ```bash
   ./scripts/deploy.sh infrastructure dev velya-dev
   ```

2. **Verify against AWS**:
   ```bash
   ./scripts/verify.sh infrastructure dev velya-dev
   ```

3. **Promote to staging/prod**:
   ```bash
   # Tag release version
   git tag -a v0.1.0-rc1 -m "Release candidate 1"
   git push origin v0.1.0-rc1
   
   # Deploy to staging
   ./scripts/deploy.sh infrastructure staging velya-staging
   ```

## Reference

- `scripts/kind-setup.sh` - kind cluster setup
- `scripts/kind-local-testing.md` - Comprehensive test suite
- `scripts/multistack-setup.sh` - Multi-environment orchestration
- `infra/bootstrap/tier-isolation/` - Network policies and resource quotas
- `infra/opentofu/modules/` - Infrastructure templates

---

**Stuck?** Check the troubleshooting section or ask in #platform-dev.
