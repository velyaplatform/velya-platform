# Velya Platform - Deployment Scripts

This directory contains automated scripts for deploying and managing the Velya platform on AWS EKS.

## Quick Start

### Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS Credentials** configured locally
3. **Required CLI Tools**:
   - AWS CLI v2
   - OpenTofu v1.7.0+
   - kubectl v1.31+
   - Helm v3.14+
   - Docker
   - jq

### Installation Check

```bash
# Verify all tools are installed
./scripts/deploy.sh prerequisites dev velya-dev
```

## Scripts Overview

### 1. `deploy.sh` - Main Deployment Script

Automated script to deploy the entire Velya platform to AWS EKS.

**Usage:**

```bash
./scripts/deploy.sh [PHASE] [ENVIRONMENT] [AWS_PROFILE]
```

**Parameters:**

- `PHASE` - Deployment phase (see phases below)
- `ENVIRONMENT` - Environment name: `dev`, `staging`, `prod`
- `AWS_PROFILE` - AWS CLI profile name (default: `velya-dev`)

**Phases:**

- `prerequisites` - Validate all required tools
- `env-setup` - Setup environment variables
- `infrastructure` - Provision AWS resources (VPC, EKS, ECR, IAM)
- `k8s-bootstrap` - Bootstrap Kubernetes cluster (namespaces, policies)
- `argocd` - Install and configure ArgoCD
- `observability` - Deploy observability stack (Prometheus, Grafana, Loki)
- `secrets` - Setup secrets management (External Secrets Operator)
- `apps` - Build and deploy applications
- `all` - Execute all phases in order

**Examples:**

```bash
# Check prerequisites only
./scripts/deploy.sh prerequisites dev velya-dev

# Deploy only infrastructure
./scripts/deploy.sh infrastructure dev velya-dev

# Full deployment (all phases)
./scripts/deploy.sh all dev velya-dev

# Deploy to production
./scripts/deploy.sh all prod velya-prod
```

**Timing:**

- Prerequisites validation: ~2 minutes
- Infrastructure provisioning: 10-15 minutes
- K8s bootstrap: 2-3 minutes
- ArgoCD setup: 5-10 minutes
- Observability: 10 minutes
- Secrets setup: 2 minutes
- Applications: 5-10 minutes
- **Total: ~45-60 minutes**

### 2. `verify.sh` - Verification Script

Verifies that deployment was successful and all components are healthy.

**Usage:**

```bash
./scripts/verify.sh [ENVIRONMENT]
```

**What it checks:**

- ✓ Kubernetes cluster accessibility
- ✓ Node status and readiness
- ✓ Namespace creation
- ✓ Pod health (no failed/crashing pods)
- ✓ Service configuration and endpoints
- ✓ Storage and persistent volumes
- ✓ ArgoCD status and synchronization
- ✓ Observability stack (Prometheus, Grafana, Loki)
- ✓ Secrets management
- ✓ Network policies
- ✓ Resource quotas
- ✓ API endpoint connectivity

**Example:**

```bash
# Verify dev environment
./scripts/verify.sh dev

# Output:
# ✓ Passed: 42
# ⚠ Warnings: 2
# ✗ Failed: 0
# ✓ Verification passed!
```

### 3. `cleanup.sh` - Cleanup Script

Destroys all AWS and Kubernetes resources. **WARNING: This is irreversible!**

**Usage:**

```bash
./scripts/cleanup.sh [ENVIRONMENT] [AWS_PROFILE] [--force]
```

**Parameters:**

- `ENVIRONMENT` - Environment to destroy
- `AWS_PROFILE` - AWS CLI profile
- `--force` - Skip confirmation prompt (use with caution!)

**What it deletes:**

- ✓ Kubernetes namespaces and workloads
- ✓ EKS cluster
- ✓ VPC and networking resources
- ✓ ECR repositories
- ✓ IAM roles and policies
- ✓ AWS Secrets

**Example:**

```bash
# Destroy dev environment (with confirmation)
./scripts/cleanup.sh dev velya-dev

# Destroy with force (no confirmation)
./scripts/cleanup.sh dev velya-dev --force
```

## Detailed Deployment Walkthrough

### Step 1: Prepare Environment

```bash
cd velya-platform

# Set your environment variables (optional, defaults are provided)
export AWS_PROFILE=velya-dev
export AWS_REGION=us-east-1
export VELYA_ENV=dev
```

### Step 2: Validate Prerequisites

```bash
./scripts/deploy.sh prerequisites ${VELYA_ENV} ${AWS_PROFILE}
```

Expected output:

```
✓ aws: aws-cli/2.x.x
✓ tofu: OpenTofu v1.7.0
✓ kubectl: Client Version: v1.31.x
✓ helm: v3.14.0
✓ jq: jq-1.7
✓ docker: Docker version 24.x.x
✓ AWS Account ID: 123456789012
All prerequisites validated
```

### Step 3: Deploy Infrastructure

Full deployment (recommended):

```bash
./scripts/deploy.sh all ${VELYA_ENV} ${AWS_PROFILE}
```

Or deploy in phases:

```bash
# Phase 1: Infrastructure
./scripts/deploy.sh infrastructure ${VELYA_ENV} ${AWS_PROFILE}

# Wait for infrastructure to be ready (10-15 minutes)
# Check status:
kubectl get nodes

# Phase 2: Kubernetes Bootstrap
./scripts/deploy.sh k8s-bootstrap ${VELYA_ENV} ${AWS_PROFILE}

# Phase 3: ArgoCD
./scripts/deploy.sh argocd ${VELYA_ENV} ${AWS_PROFILE}

# Phase 4: Observability
./scripts/deploy.sh observability ${VELYA_ENV} ${AWS_PROFILE}

# Phase 5: Secrets
./scripts/deploy.sh secrets ${VELYA_ENV} ${AWS_PROFILE}

# Phase 6: Applications
./scripts/deploy.sh apps ${VELYA_ENV} ${AWS_PROFILE}
```

### Step 4: Verify Deployment

```bash
./scripts/verify.sh ${VELYA_ENV}
```

If all checks pass:

```
✓ Passed: 42
✓ Verification passed!
```

### Step 5: Access Services

**ArgoCD UI:**

```bash
# Get credentials
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

# Get URL
kubectl -n argocd get svc argocd-server \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# Access: https://<URL>
# Username: admin
# Password: <from above>
```

**Grafana:**

```bash
# Port forward
kubectl port-forward -n velya-${VELYA_ENV}-observability \
  svc/grafana 3000:80

# Access: http://localhost:3000
# Username: admin
# Password: VelyaAdm1n123!
```

**API Gateway:**

```bash
# Port forward
kubectl port-forward -n velya-${VELYA_ENV}-core \
  svc/velya-api-gateway 3000:3000

# Test endpoint
curl http://localhost:3000/api/v1/health
```

## Logging & Troubleshooting

### View Deployment Logs

```bash
# List all deployment logs
ls -la logs/deployment/

# View latest log
tail -f logs/deployment/$(ls -t logs/deployment/ | head -1)

# Search for errors
grep ERROR logs/deployment/*.log
grep FAILED logs/deployment/*.log
```

### Common Issues

#### 1. OpenTofu State Lock

If deployment fails with state lock error:

```bash
cd infra/opentofu/live/${VELYA_ENV}

# Check lock
tofu force-unlock <LOCK_ID>
```

#### 2. EKS Cluster Not Ready

Wait for the cluster to be ready:

```bash
# Check node status
kubectl get nodes -w

# Check node logs
kubectl describe node <node-name>
```

#### 3. Pod Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n <namespace>

# Check logs
kubectl logs <pod-name> -n <namespace>

# Previous logs (if crashed)
kubectl logs <pod-name> -n <namespace> --previous
```

#### 4. ArgoCD Sync Failed

```bash
# Check application status
kubectl get applications -n argocd

# Describe application
kubectl describe application <app-name> -n argocd

# Check controller logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller
```

## Environment Variables

The scripts use these environment variables:

| Variable             | Default                           | Description                         |
| -------------------- | --------------------------------- | ----------------------------------- |
| `VELYA_ENV`          | `dev`                             | Environment name                    |
| `AWS_REGION`         | `us-east-1`                       | AWS region                          |
| `AWS_PROFILE`        | `velya-dev`                       | AWS CLI profile                     |
| `VELYA_PROJECT_NAME` | `velya`                           | Project name (for naming resources) |
| `LOG_FILE`           | `logs/deployment/<timestamp>.log` | Log file path                       |

## Cost Estimation

Rough monthly costs for **dev** environment on AWS:

- **EKS Cluster**: $73.00
- **Auto Mode Compute**: $50-150 (varies by usage)
- **Data Transfer**: $5-10
- **Storage (EBS/RDS)**: $20-50
- **Load Balancers**: $16.50 per LB
- **Miscellaneous**: $10-20

**Total (dev)**: ~$174-315/month

For **staging** and **prod**, multiply by 2-3x depending on HA requirements.

## Best Practices

### Pre-Deployment

1. ✓ Validate all prerequisites
2. ✓ Ensure AWS credentials are configured
3. ✓ Plan maintenance window (2 hours)
4. ✓ Backup any existing state
5. ✓ Review OpenTofu plan before applying

### During Deployment

1. ✓ Monitor logs in real-time
2. ✓ Don't interrupt the process
3. ✓ Have rollback procedure ready
4. ✓ Monitor infrastructure cost

### Post-Deployment

1. ✓ Run verification script
2. ✓ Test all endpoints
3. ✓ Verify observability (metrics/logs flowing)
4. ✓ Document any manual changes
5. ✓ Setup monitoring alerts

## Maintenance

### Daily Operations

```bash
# Check cluster health
./scripts/verify.sh ${VELYA_ENV}

# Check resource usage
kubectl top nodes
kubectl top pods --all-namespaces

# View recent logs
kubectl logs -f -l app=velya-api-gateway -n velya-${VELYA_ENV}-core
```

### Regular Maintenance

```bash
# Update packages (monthly)
helm repo update
kubectl patch statefulset prometheus -p '{"spec":{"template":{"metadata":{"annotations":{"date":"'$(date +%s)'"}}}}}' -n velya-${VELYA_ENV}-observability

# Review costs (weekly)
# Check AWS Console → Cost Explorer

# Review security (weekly)
# Check AWS Config → Config Rules

# Review logs (weekly)
# Check CloudWatch Logs
```

## Support

### Debug Commands

```bash
# Get complete cluster state
kubectl get all --all-namespaces

# Export cluster state
kubectl get all --all-namespaces -o yaml > backup.yaml

# Describe all nodes
kubectl describe nodes

# View events
kubectl get events --all-namespaces --sort-by='.lastTimestamp'

# Check resource usage
kubectl get resourcequota --all-namespaces -o wide
```

### Emergency Access

```bash
# Get cluster admin access (break-glass)
kubectl create clusterrolebinding admin \
  --clusterrole=cluster-admin \
  --serviceaccount=default:default

# Access cluster directly
aws eks update-kubeconfig --name velya-${VELYA_ENV}-eks --region ${AWS_REGION}
```

## References

- [Deployment Manual](../DEPLOYMENT.md)
- [AWS EKS Documentation](https://docs.aws.amazon.com/eks/)
- [OpenTofu Documentation](https://opentofu.org/)
- [Kubernetes Documentation](https://kubernetes.io/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)

---

**Last Updated**: 2026-04-08  
**Version**: 1.0.0
