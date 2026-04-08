# Velya Local Development Architecture

Visual guide to kind (local K8s) vs ministack (AWS simulation).

## Two-Environment Development Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     VELYA LOCAL DEVELOPMENT ENVIRONMENTS                        │
└─────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────┬───────────────────────────────────────┐
│          KIND (Local Kubernetes)      │      MINISTACK (AWS Simulation)       │
│                                       │                                       │
│  Purpose: Fast iterative development  │  Purpose: AWS architecture validation │
│  Setup time: 1-2 minutes              │  Setup time: 2-3 minutes              │
│  Teardown time: 30 seconds            │  Teardown time: 1 minute              │
│  Resource use: Low (Docker-only)      │  Resource use: Medium (full AWS sim)  │
│                                       │                                       │
│ ┌─────────────────────────────────┐  │ ┌─────────────────────────────────┐  │
│ │      KUBERNETES CLUSTER         │  │ │    AWS VPC + INFRASTRUCTURE     │  │
│ │   (1 control-plane + 4 workers) │  │ │                                 │  │
│ │                                 │  │ │   Region: us-east-1 (simulated)│  │
│ │  ┌─────────────────────────────┐│  │ │                                 │  │
│ │  │    Control Plane            ││  │ │  ┌──────────────────────────┐  │  │
│ │  │  (Kubernetes 1.31)          ││  │ │  │  VPC 10.0.0.0/16         │  │  │
│ │  └─────────────────────────────┘│  │ │  │                          │  │  │
│ │                                 │  │ │  │ ┌──────────────────────┐ │  │  │
│ │  ┌──────┬──────┬────────┬──────┐│  │ │ │ │ PUBLIC SUBNETS       │ │  │  │
│ │  │Front │Back  │Plaform │  AI  ││  │ │ │ │ 10.0.1.0/24 (AZ-a)   │ │  │  │
│ │  │ end  │ end  │  (IAM) │Agents││  │ │ │ │ 10.0.2.0/24 (AZ-b)   │ │  │  │
│ │  │ Tier │ Tier │ Tier   │ Tier ││  │ │ │ └──────────────────────┘ │  │  │
│ │  │      │      │ [TAU]  │ [TAU]││  │ │ │                          │  │  │
│ │  │ Node │ Node │ Node   │ Node ││  │ │ │ ┌──────────────────────┐ │  │  │
│ │  │  1   │  2   │  3     │  4   ││  │ │ │ │ PRIVATE SUBNETS      │ │  │  │
│ │  └──────┴──────┴────────┴──────┘│  │ │ │ │ 10.0.10.0/24 (AZ-a)  │ │  │  │
│ │                                 │  │ │ │ │ 10.0.20.0/24 (AZ-b)  │ │  │  │
│ │  Labels:                        │  │ │ │ └──────────────────────┘ │  │  │
│ │  • velya.io/tier = {frontend,   │  │ │ │                          │  │  │
│ │    backend, platform, ai}       │  │ │ │  EKS Cluster            │  │  │
│ │                                 │  │ │ │  (4 Node Groups)        │  │  │
│ │  Taints:                        │  │ │ │                          │  │  │
│ │  • platform: NoSchedule         │  │ │ │  ┌────────────────────┐ │  │  │
│ │  • ai-workload: NoSchedule      │  │ │ │  │ Frontend ASG: 2x   │ │  │  │
│ │                                 │  │ │ │  │ t3.medium          │ │  │  │
│ └─────────────────────────────────┘  │ │ │  ├────────────────────┤ │  │  │
│                                       │ │ │  │ Backend ASG: 2x    │ │  │  │
│  Network Policies: ✓                  │ │ │  │ t3.large           │ │  │  │
│  Resource Quotas: ✓                   │ │ │  ├────────────────────┤ │  │  │
│  PDB (HA): ✓                          │ │ │  │ Platform ASG: 1x   │ │  │  │
│  Pod Disruption Budgets: ✓            │ │ │  │ t3.small [TAINT]   │ │  │  │
│                                       │ │ │  ├────────────────────┤ │  │  │
│  Services (optional):                 │ │ │  │ AI/Agents ASG:1x   │ │  │  │
│  • Prometheus (via helm)              │ │ │  │ t3.large [TAINT]   │ │  │  │
│  • Grafana (via helm)                 │ │ │  └────────────────────┘ │  │  │
│  • ArgoCD (via helm)                  │ │ │                          │  │  │
│                                       │ │ │  RDS PostgreSQL          │  │  │
│  Access:                              │ │ │  (Simulated)             │  │  │
│  $ kubectl ...                        │ │ │                          │  │  │
│  $ kubectl get nodes -L velya.io/tier│ │ │  ECR Registry            │  │  │
│  $ kubectl get pods -A                │ │ │  (Simulated)             │  │  │
│                                       │ │ │                          │  │  │
│                                       │ │ │  CloudWatch Logs         │  │  │
│                                       │ │ │  (Simulated)             │  │  │
│                                       │ │ │                          │  │  │
│                                       │ │ │  VPC Flow Logs           │  │  │
│                                       │ │ │                          │  │  │
│                                       │ │ └──────────────────────────┘ │  │  │
│                                       │ │  Internet Gateway             │  │  │
│                                       │ │  NAT Gateway                  │  │  │
│                                       │ │  VPC Endpoints                │  │  │
│                                       │ │                              │  │  │
│                                       │ └──────────────────────────────┘  │  │
│                                       │                                   │  │
│                                       │  Access:                         │  │
│                                       │  $ aws eks describe-clusters     │  │
│                                       │  $ aws ec2 describe-instances    │  │
│                                       │  $ aws rds describe-db-instances │  │
│                                       │  $ aws ecr describe-repositories │  │
│                                       └───────────────────────────────────┘  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Tier Isolation Comparison

### kind (In-Cluster Isolation)
```yaml
Node Labels:
  velya.io/tier: frontend|backend|platform|ai
  velya.io/workload: web|api|infra|agents

Taints:
  # Platform tier (system tools)
  - key: velya.io/platform
    value: "true"
    effect: NoSchedule
  
  # AI tier (agent workloads)
  - key: velya.io/ai-workload
    value: "true"
    effect: NoSchedule

Network Policies:
  frontend ↔ backend: ✓ bidirectional
  backend → platform: ✓ allowed (metrics)
  backend ↔ ai: ✓ allowed (callbacks)
  platform ↔ ai: ✗ blocked (isolated)
  all → external: ✓ allowed

Resource Quotas:
  Frontend: 4 CPU / 4Gi memory / 20 pods
  Backend: 8 CPU / 16Gi memory / 50 pods
  Platform: 2 CPU / 2Gi memory / 30 pods
  AI: 8 CPU / 16Gi memory / 40 pods
```

### ministack (AWS-Level Isolation)
```yaml
VPC Architecture:
  CIDR: 10.0.0.0/16
  Public Subnets (2): 10.0.1.0/24, 10.0.2.0/24
  Private Subnets (2): 10.0.10.0/24, 10.0.20.0/24

Security Groups:
  Frontend SG: Allow 443 (HTTPS) from internet
  Backend SG: Allow 3000 from Frontend
  Platform SG: Allow 9090 from Backend (metrics)
  AI SG: Allow internal communication only
  
Network ACLs:
  Deny: Platform ↔ AI cross-communication
  Allow: Backend → all (via load balancer)

Auto Scaling Groups:
  Frontend: min=2, max=10, desired=2 (t3.medium)
  Backend: min=2, max=15, desired=2 (t3.large)
  Platform: min=1, max=2, desired=1 (t3.small)
  AI: min=1, max=10, desired=1 (t3.large)

RDS PostgreSQL:
  Storage: 100 GB
  Multi-AZ: false (dev)
  Backups: 7 days
  Parameter Group: velya-defaults
```

## Development Workflows

### Scenario 1: Develop a Backend Service (kind-focused)
```bash
# 1. Setup kind cluster
./scripts/multistack-setup.sh kind

# 2. Build and load image into kind
docker build -t velya-api-gateway:latest apps/api-gateway/
kind load docker-image velya-api-gateway:latest --name velya-local

# 3. Deploy to kind
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: velya-api-gateway
  namespace: velya-dev-core
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-gateway
      velya.io/tier: backend
  template:
    metadata:
      labels:
        app: api-gateway
        velya.io/tier: backend
    spec:
      nodeSelector:
        velya.io/tier: backend
      containers:
      - name: gateway
        image: velya-api-gateway:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            memory: 512Mi
EOF

# 4. Port-forward and test
kubectl port-forward -n velya-dev-core svc/velya-api-gateway 3000:3000
curl http://localhost:3000/health

# 5. Test tier isolation
kubectl apply -f scripts/../infra/bootstrap/tier-isolation/network-policies-by-tier.yaml
# Try connecting from frontend tier (should fail)
```

### Scenario 2: Validate IaC Before AWS Deployment (ministack-focused)
```bash
# 1. Setup ministack
./scripts/multistack-setup.sh ministack

# 2. Apply OpenTofu templates to ministack
cd infra/opentofu
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

# 3. Plan changes
tofu plan -var="aws_endpoint_url=http://localhost:4566"

# 4. Apply to ministack
tofu apply -var="aws_endpoint_url=http://localhost:4566"

# 5. Verify resources
aws ec2 describe-vpcs --region us-east-1
aws eks describe-clusters --region us-east-1
aws rds describe-db-instances --region us-east-1

# 6. Test networking
# Simulate: ssh into EC2 instance → test RDS connectivity → verify security groups

# 7. Once validated, apply to real AWS dev environment
tofu apply -var-file=envs/dev/terraform.tfvars
```

### Scenario 3: Full Integration Test (both)
```bash
# 1. Setup both environments
./scripts/multistack-setup.sh both

# 2. Test tier isolation on kind
./scripts/kind-setup.sh verify

# 3. Validate AWS templates on ministack
cd infra/opentofu && tofu init && tofu plan

# 4. Run integration tests
npm run test:integration

# 5. Run E2E tests
npm run test:e2e

# 6. Verify results in both environments
kubectl logs -A -f --since=5m
aws logs tail /aws/ecs/velya --follow

# 7. Cleanup both
./scripts/multistack-setup.sh teardown
```

## Resource Usage Comparison

### Local Machine Requirements

| Component | kind | ministack | both |
|---|---|---|---|
| Docker memory | 2-4 GB | 4-6 GB | 6-8 GB |
| Disk space | 2-3 GB | 3-5 GB | 5-8 GB |
| CPU cores | 2 | 2 | 4+ |
| Setup time | 1-2 min | 2-3 min | 3-5 min |
| Teardown time | 30 sec | 1 min | 1-2 min |

### When to Use Which

**Use kind when:**
- Developing services locally
- Testing tier isolation quickly
- Running integration tests
- Testing Kubernetes manifests
- No need to test AWS-specific features

**Use ministack when:**
- Validating infrastructure as code (Tofu)
- Testing AWS networking (VPC, security groups, ACLs)
- Simulating RDS/ECR/CloudWatch
- Pre-AWS deployment validation
- Testing auto-scaling group configurations

**Use both when:**
- Validating complete end-to-end flows
- Ensuring consistency between K8s and AWS
- Running full integration test suites
- Pre-release validation
- Onboarding new team members

## Next: Deploy to AWS

Once validated locally (both environments), deploy to AWS:

```bash
# 1. AWS dev environment
./scripts/deploy.sh infrastructure dev velya-dev

# 2. Verify
./scripts/verify.sh infrastructure dev velya-dev

# 3. Promote to staging
git tag -a v0.1.0-rc1 -m "Release candidate"
./scripts/deploy.sh infrastructure staging velya-staging

# 4. Promote to production
./scripts/deploy.sh infrastructure prod velya-prod
```

## Files Reference

| File | Purpose | Environment |
|---|---|---|
| `scripts/kind-setup.sh` | Create kind cluster | kind |
| `scripts/kind-local-testing.md` | Test suite | kind |
| `scripts/multistack-setup.sh` | Orchestrate both | both |
| `docs/LOCAL_SETUP.md` | Setup guide | both |
| `infra/bootstrap/tier-isolation/` | Network + quotas | kind (applies to both) |
| `infra/opentofu/` | Infrastructure templates | ministack → AWS |
| `infra/kubernetes/` | K8s manifests | kind → AWS EKS |

