# Velya Platform - AWS EKS Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Phase 1: AWS Infrastructure Provisioning (OpenTofu)](#phase-1-aws-infrastructure-provisioning-opentofu)
4. [Phase 2: Kubernetes Cluster Bootstrap](#phase-2-kubernetes-cluster-bootstrap)
5. [Phase 3: ArgoCD Setup (GitOps)](#phase-3-argocd-setup-gitops)
6. [Phase 4: Observability Stack](#phase-4-observability-stack)
7. [Phase 5: Secrets Management](#phase-5-secrets-management)
8. [Phase 6: Application Deployment](#phase-6-application-deployment)
9. [Verification & Testing](#verification--testing)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

```bash
# AWS CLI v2
aws --version  # v2.13.0+

# OpenTofu
tofu version   # v1.7.0+

# kubectl
kubectl version --client  # v1.31+

# Helm
helm version   # v3.14.0+

# jq (JSON processor)
jq --version   # 1.7+

# Docker (for local builds/testing)
docker --version
```

### AWS Credentials

```bash
# Configure AWS credentials (choose one method)
# Option 1: AWS CLI profile
aws configure --profile velya-dev

# Option 2: Environment variables
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
export AWS_DEFAULT_REGION=us-east-1

# Verify credentials
aws sts get-caller-identity
```

### GitHub Configuration

```bash
# For pulling from private GitHub repos (if needed)
export GITHUB_TOKEN=your_token
export GITHUB_USER=your_username
```

---

## Environment Setup

### 1. Clone and Navigate

```bash
git clone https://github.com/velyaplatform/velya-platform.git
cd velya-platform

# Switch to main branch
git checkout main
```

### 2. Set Environment Variables

```bash
# Core variables
export VELYA_ENV=dev                    # dev, staging, prod
export AWS_REGION=us-east-1
export AWS_PROFILE=velya-dev            # Your AWS CLI profile

# Infrastructure variables
export VELYA_CLUSTER_NAME=velya-${VELYA_ENV}-eks
export VELYA_VPC_CIDR=10.0.0.0/16
export VELYA_PROJECT_NAME=velya
export VELYA_STATE_BUCKET=velya-${VELYA_ENV}-tfstate
export VELYA_STATE_DYNAMODB=velya-${VELYA_ENV}-tflock

# Docker registry
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --profile ${AWS_PROFILE} --query Account --output text)
export ECR_REGISTRY=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Verify variables
echo "Environment: $VELYA_ENV"
echo "Cluster: $VELYA_CLUSTER_NAME"
echo "Region: $AWS_REGION"
echo "ECR Registry: $ECR_REGISTRY"
```

### 3. Create directories for state and logs

```bash
mkdir -p ./logs/deployment
mkdir -p ./infra/opentofu/live/${VELYA_ENV}
touch ./logs/deployment/$(date +%Y%m%d-%H%M%S).log
```

---

## Phase 1: AWS Infrastructure Provisioning (OpenTofu)

### Step 1.1: Validate OpenTofu Configuration

```bash
cd infra/opentofu/live/${VELYA_ENV}

# Initialize OpenTofu (downloads modules, sets up backend)
tofu init

# Validate syntax
tofu validate

# Format code
tofu fmt -recursive ../../modules/
```

### Step 1.2: Plan Infrastructure

```bash
# Generate plan
tofu plan -out=tfplan.binary

# Export human-readable plan
tofu show tfplan.binary > tfplan.txt

# Review plan
cat tfplan.txt
```

### Step 1.3: Apply Infrastructure

```bash
# Apply the plan
tofu apply tfplan.binary

# Monitor output
echo "Waiting for infrastructure to be ready..."
sleep 60

# Save outputs
tofu output -json > outputs.json

# Export outputs to environment
export VELYA_VPC_ID=$(tofu output -raw vpc_id)
export VELYA_CLUSTER_ENDPOINT=$(tofu output -raw cluster_endpoint)
export VELYA_CLUSTER_CA=$(tofu output -raw cluster_ca_certificate)
export VELYA_OIDC_PROVIDER_ARN=$(tofu output -raw oidc_provider_arn)

echo "Infrastructure provisioned successfully"
echo "VPC ID: $VELYA_VPC_ID"
echo "Cluster Endpoint: $VELYA_CLUSTER_ENDPOINT"
```

### Step 1.4: Configure kubectl Access

```bash
# Update kubeconfig
aws eks update-kubeconfig \
  --name ${VELYA_CLUSTER_NAME} \
  --region ${AWS_REGION} \
  --profile ${AWS_PROFILE}

# Verify cluster access
kubectl cluster-info
kubectl get nodes

# Expected: 1+ nodes in Ready status with Auto Mode
```

### Step 1.5: Create ECR Repositories

```bash
# Repositories are auto-created by OpenTofu
# Verify they exist
aws ecr describe-repositories \
  --region ${AWS_REGION} \
  --profile ${AWS_PROFILE} \
  --query 'repositories[*].repositoryName' \
  --output table

# Login to ECR
aws ecr get-login-password --region ${AWS_REGION} --profile ${AWS_PROFILE} | \
  docker login --username AWS --password-stdin ${ECR_REGISTRY}
```

---

## Phase 2: Kubernetes Cluster Bootstrap

### Step 2.1: Create Namespaces

```bash
# Apply namespace manifests
kubectl apply -f infra/bootstrap/namespaces/${VELYA_ENV}.yaml

# Verify namespaces
kubectl get namespaces | grep velya
```

### Step 2.2: Apply Network Policies

```bash
# Apply default deny + allow policies
kubectl apply -f infra/bootstrap/policies/network-policy-default-deny.yaml

# Verify policies
kubectl get networkpolicies --all-namespaces
```

### Step 2.3: Apply Resource Quotas and Limits

```bash
# Apply quotas and limits
kubectl apply -f infra/bootstrap/policies/resource-quotas-${VELYA_ENV}.yaml
kubectl apply -f infra/bootstrap/policies/limit-ranges-${VELYA_ENV}.yaml

# Verify
kubectl describe resourcequota --all-namespaces
kubectl describe limitrange --all-namespaces
```

### Step 2.4: Setup Pod Security Standards

```bash
# Label namespaces for PSS
kubectl label namespace velya-${VELYA_ENV}-core \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted \
  --overwrite

# Repeat for other namespaces
for ns in core platform agents observability; do
  kubectl label namespace velya-${VELYA_ENV}-${ns} \
    pod-security.kubernetes.io/enforce=restricted \
    pod-security.kubernetes.io/audit=restricted \
    pod-security.kubernetes.io/warn=restricted \
    --overwrite
done

# Verify
kubectl get namespace -o json | jq '.items[].metadata.labels' | grep pod-security
```

### Step 2.5: Configure RBAC

```bash
# Create cluster admin binding (break-glass)
kubectl create clusterrolebinding velya-admin \
  --clusterrole=cluster-admin \
  --serviceaccount=velya-${VELYA_ENV}-core:admin \
  || echo "Binding may already exist"

# Verify
kubectl get clusterrolebindings | grep velya
```

---

## Phase 3: ArgoCD Setup (GitOps)

### Step 3.1: Install ArgoCD

```bash
# Create ArgoCD namespace
kubectl create namespace argocd || echo "Namespace exists"

# Add ArgoCD Helm repo
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

# Install ArgoCD
helm install argocd argo/argo-cd \
  --namespace argocd \
  --version 7.3.0 \
  --set server.service.type=LoadBalancer \
  --set server.insecure=false \
  --set configs.params."application.instanceLabelKey"="argocd.argoproj.io/instance" \
  --wait

# Wait for ArgoCD to be ready
kubectl wait --for=condition=available --timeout=300s \
  deployment/argocd-server -n argocd
```

### Step 3.2: Access ArgoCD UI

```bash
# Get ArgoCD admin password
ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d)

# Get ArgoCD server URL (LoadBalancer)
ARGOCD_URL=$(kubectl -n argocd get svc argocd-server \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "ArgoCD URL: https://$ARGOCD_URL"
echo "Username: admin"
echo "Password: $ARGOCD_PASSWORD"

# Save for later use
echo "export ARGOCD_URL=$ARGOCD_URL" >> ~/.bashrc
echo "export ARGOCD_PASSWORD=$ARGOCD_PASSWORD" >> ~/.bashrc
```

### Step 3.3: Configure ArgoCD CLI

```bash
# Login to ArgoCD via CLI
argocd login ${ARGOCD_URL} \
  --username admin \
  --password ${ARGOCD_PASSWORD} \
  --insecure

# Verify connection
argocd cluster list
```

### Step 3.4: Deploy ArgoCD App-of-Apps

```bash
# Apply ArgoCD bootstrap manifests
kubectl apply -f infra/bootstrap/argocd/namespace.yaml
kubectl apply -f infra/bootstrap/argocd/app-of-apps.yaml
kubectl apply -f infra/bootstrap/argocd/platform-apps.yaml

# Wait for apps to sync
kubectl wait --for=condition=Synced \
  application/velya-app-of-apps \
  -n argocd \
  --timeout=300s

# Verify apps
argocd app list
kubectl get applications -n argocd
```

### Step 3.5: Configure Git Repository in ArgoCD

```bash
# Add GitHub repository to ArgoCD
argocd repo add https://github.com/velyaplatform/velya-platform.git \
  --type git \
  --username ${GITHUB_USER} \
  --password ${GITHUB_TOKEN}

# Verify
argocd repo list
```

---

## Phase 4: Observability Stack

### Step 4.1: Install Prometheus

```bash
# Add Prometheus Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace velya-${VELYA_ENV}-observability \
  --version 54.0.0 \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
  --wait

# Wait for Prometheus
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=prometheus \
  -n velya-${VELYA_ENV}-observability \
  --timeout=300s

# Port forward for testing
kubectl port-forward -n velya-${VELYA_ENV}-observability \
  svc/prometheus-kube-prometheus-prometheus 9090:9090 &
```

### Step 4.2: Install Loki (Logs)

```bash
# Add Grafana Loki repo
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Loki
helm install loki grafana/loki-stack \
  --namespace velya-${VELYA_ENV}-observability \
  --version 2.10.0 \
  --set loki.enabled=true \
  --set promtail.enabled=true \
  --set grafana.enabled=false \
  --wait
```

### Step 4.3: Install Grafana

```bash
# Install Grafana
helm install grafana grafana/grafana \
  --namespace velya-${VELYA_ENV}-observability \
  --version 7.0.0 \
  --set persistence.enabled=true \
  --set persistence.size=10Gi \
  --set adminPassword=VelyaAdm1n123! \
  --wait

# Get Grafana password
GRAFANA_PASSWORD=$(kubectl get secret -n velya-${VELYA_ENV}-observability grafana \
  -o jsonpath="{.data.admin-password}" | base64 -d)

# Port forward
kubectl port-forward -n velya-${VELYA_ENV}-observability \
  svc/grafana 3000:80 &

echo "Grafana URL: http://localhost:3000"
echo "Username: admin"
echo "Password: $GRAFANA_PASSWORD"
```

### Step 4.4: Install OpenTelemetry Collector

```bash
# Apply OTel collector config
kubectl apply -f infra/bootstrap/observability/namespace.yaml
kubectl apply -f infra/bootstrap/observability/otel-collector-config.yaml

# Verify
kubectl get configmap -n velya-${VELYA_ENV}-observability otel-collector-config
```

---

## Phase 5: Secrets Management

### Step 5.1: Install External Secrets Operator

```bash
# Add External Secrets repo
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

# Install ESO
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets-system \
  --create-namespace \
  --version 0.9.0 \
  --wait

# Verify
kubectl get pods -n external-secrets-system
```

### Step 5.2: Create ClusterSecretStore

```bash
# Apply ClusterSecretStore
kubectl apply -f infra/bootstrap/external-secrets/cluster-secret-store.yaml

# Verify
kubectl get clustersecretstore
```

### Step 5.3: Create Secrets in AWS Secrets Manager

```bash
# Create database secret
aws secretsmanager create-secret \
  --name velya/${VELYA_ENV}/database/postgres \
  --description "Velya PostgreSQL credentials" \
  --secret-string '{
    "username": "velya_user",
    "password": "GenerateSecurePassword123!",
    "host": "velya-postgres.c9akciq32.us-east-1.rds.amazonaws.com",
    "port": 5432,
    "dbname": "velya"
  }' \
  --region ${AWS_REGION} \
  --profile ${AWS_PROFILE} \
  2>/dev/null || echo "Secret may already exist"

# Create API secret
aws secretsmanager create-secret \
  --name velya/${VELYA_ENV}/api/keys \
  --description "Velya API keys" \
  --secret-string '{
    "jwt_secret": "GenerateSecureJWTSecret123!",
    "api_key": "GenerateSecureAPIKey123!"
  }' \
  --region ${AWS_REGION} \
  --profile ${AWS_PROFILE} \
  2>/dev/null || echo "Secret may already exist"

# Verify secrets
aws secretsmanager list-secrets \
  --region ${AWS_REGION} \
  --profile ${AWS_PROFILE} \
  --filters Key=name,Values=velya/ \
  --query 'SecretList[*].Name'
```

### Step 5.4: Create ExternalSecrets Resources

```bash
# Create example ExternalSecret for database
cat > /tmp/external-secret-db.yaml <<EOF
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: velya-db-secret
  namespace: velya-${VELYA_ENV}-core
spec:
  refreshInterval: 24h
  secretStoreRef:
    name: aws-secrets
    kind: ClusterSecretStore
  target:
    name: database-secret
    creationPolicy: Owner
    template:
      engineVersion: v2
      data:
        DATABASE_URL: "postgresql://{{ .username }}:{{ .password }}@{{ .host }}:{{ .port }}/{{ .dbname }}"
  data:
    - secretKey: username
      remoteRef:
        key: velya/${VELYA_ENV}/database/postgres
        property: username
    - secretKey: password
      remoteRef:
        key: velya/${VELYA_ENV}/database/postgres
        property: password
    - secretKey: host
      remoteRef:
        key: velya/${VELYA_ENV}/database/postgres
        property: host
    - secretKey: port
      remoteRef:
        key: velya/${VELYA_ENV}/database/postgres
        property: port
    - secretKey: dbname
      remoteRef:
        key: velya/${VELYA_ENV}/database/postgres
        property: dbname
EOF

kubectl apply -f /tmp/external-secret-db.yaml

# Verify secret was synced
kubectl get secret database-secret -n velya-${VELYA_ENV}-core -o yaml
```

---

## Phase 6: Application Deployment

### Step 6.1: Build Docker Images

```bash
# Login to ECR
aws ecr get-login-password --region ${AWS_REGION} --profile ${AWS_PROFILE} | \
  docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Build API Gateway
docker build -t ${ECR_REGISTRY}/velya-api-gateway:latest \
  -f apps/api-gateway/Dockerfile \
  apps/api-gateway/

docker push ${ECR_REGISTRY}/velya-api-gateway:latest

# Build Web
docker build -t ${ECR_REGISTRY}/velya-web:latest \
  -f apps/web/Dockerfile \
  apps/web/

docker push ${ECR_REGISTRY}/velya-web:latest

# Build services (Patient Flow, Discharge, Task Inbox, Audit)
for service in patient-flow discharge-orchestrator task-inbox audit-service; do
  docker build -t ${ECR_REGISTRY}/velya-${service}:latest \
    -f services/${service}/Dockerfile \
    services/${service}/ 2>/dev/null || echo "Dockerfile not found for $service"
  docker push ${ECR_REGISTRY}/velya-${service}:latest 2>/dev/null || echo "Skipped $service"
done

# Verify images
aws ecr describe-images \
  --repository-name velya-api-gateway \
  --region ${AWS_REGION} \
  --profile ${AWS_PROFILE} \
  --query 'imageDetails[*].imageTags'
```

### Step 6.2: Update Helm Values

```bash
# Create values override file
cat > /tmp/velya-values-${VELYA_ENV}.yaml <<EOF
# API Gateway
api-gateway:
  image:
    repository: ${ECR_REGISTRY}/velya-api-gateway
    tag: latest
  replicas: 2
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi
  env:
    - name: ENVIRONMENT
      value: ${VELYA_ENV}
    - name: LOG_LEVEL
      value: info

# Web App
web:
  image:
    repository: ${ECR_REGISTRY}/velya-web
    tag: latest
  replicas: 2
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 200m
      memory: 256Mi

# Patient Flow Service
patient-flow:
  image:
    repository: ${ECR_REGISTRY}/velya-patient-flow
    tag: latest
  replicas: 2

# Discharge Orchestrator
discharge-orchestrator:
  image:
    repository: ${ECR_REGISTRY}/velya-discharge-orchestrator
    tag: latest
  replicas: 1

# Task Inbox
task-inbox:
  image:
    repository: ${ECR_REGISTRY}/velya-task-inbox
    tag: latest
  replicas: 2

# Audit Service
audit-service:
  image:
    repository: ${ECR_REGISTRY}/velya-audit-service
    tag: latest
  replicas: 1
EOF

# Apply values via ArgoCD
argocd app set velya-core \
  --values /tmp/velya-values-${VELYA_ENV}.yaml
```

### Step 6.3: Deploy via ArgoCD

```bash
# Sync ArgoCD applications
argocd app sync velya-app-of-apps --prune

# Wait for apps to be healthy
argocd app wait velya-app-of-apps --timeout=600

# Monitor deployment
kubectl get pods -n velya-${VELYA_ENV}-core -w

# Check deployment status
kubectl rollout status deployment/velya-api-gateway -n velya-${VELYA_ENV}-core
```

### Step 6.4: Setup Ingress (Optional but Recommended)

```bash
# Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --version 4.9.0 \
  --set controller.service.type=LoadBalancer \
  --wait

# Get Ingress LB endpoint
INGRESS_LB=$(kubectl get svc -n ingress-nginx nginx-ingress-ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "Ingress LoadBalancer: $INGRESS_LB"

# Create Ingress resource (example)
cat > /tmp/velya-ingress.yaml <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: velya-ingress
  namespace: velya-${VELYA_ENV}-core
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.velya.health
    secretName: velya-tls
  rules:
  - host: api.velya.health
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: velya-api-gateway
            port:
              number: 3000
EOF

kubectl apply -f /tmp/velya-ingress.yaml
```

---

## Verification & Testing

### Step 7.1: Verify Cluster Health

```bash
# Check node status
kubectl get nodes -o wide

# Check pod status in all namespaces
kubectl get pods --all-namespaces | grep -E "(Running|Pending|Error|CrashLoop)"

# Check service status
kubectl get svc --all-namespaces

# Check persistent volumes
kubectl get pv,pvc --all-namespaces
```

### Step 7.2: Verify Application Deployments

```bash
# Check API Gateway
kubectl logs -n velya-${VELYA_ENV}-core -l app=velya-api-gateway --tail=50

# Port forward to API Gateway
kubectl port-forward -n velya-${VELYA_ENV}-core \
  svc/velya-api-gateway 3000:3000 &

# Test API
curl -s http://localhost:3000/api/v1/health | jq .

# Port forward to Web
kubectl port-forward -n velya-${VELYA_ENV}-core \
  svc/velya-web 3001:3000 &

echo "Web app: http://localhost:3001"
```

### Step 7.3: Test Database Connectivity

```bash
# Get database secret
DB_SECRET=$(kubectl get secret database-secret -n velya-${VELYA_ENV}-core \
  -o jsonpath='{.data.DATABASE_URL}' | base64 -d)

echo "Database URL: $DB_SECRET"

# Test connection from pod
kubectl run -it --rm psql-test \
  --image=postgres:16-alpine \
  --restart=Never \
  -n velya-${VELYA_ENV}-core \
  -- psql "$DB_SECRET" -c "SELECT version();"
```

### Step 7.4: Run E2E Tests

```bash
# Run E2E tests against deployed services
npm run test:e2e -- --base-url=http://localhost:3000

# Expected: All tests pass
```

### Step 7.5: Verify Observability

```bash
# Check metrics are flowing to Prometheus
curl -s http://localhost:9090/api/v1/query?query=up | jq .

# Check logs in Loki
curl -s "http://localhost:3100/loki/api/v1/query?query={job=\"kubelet\"}" | jq .

# Check traces (if Tempo is running)
# Access Grafana and view Tempo data sources
```

---

## Troubleshooting

### Common Issues

#### EKS Cluster Access Issues

```bash
# Verify kubeconfig
cat ~/.kube/config | grep -A 5 velya

# Update kubeconfig if needed
aws eks update-kubeconfig \
  --name ${VELYA_CLUSTER_NAME} \
  --region ${AWS_REGION} \
  --profile ${AWS_PROFILE} \
  --force

# Check IAM permissions
aws sts get-caller-identity --profile ${AWS_PROFILE}
```

#### Pod Scheduling Issues

```bash
# Check node capacity
kubectl describe nodes | grep -A 5 "Allocated resources"

# Check pod events
kubectl describe pod <pod-name> -n <namespace>

# Check resource quotas
kubectl describe resourcequota -n <namespace>
```

#### Network Connectivity Issues

```bash
# Test network policies
kubectl run -it --rm debug \
  --image=alpine:latest \
  --restart=Never \
  -n velya-${VELYA_ENV}-core \
  -- sh

# Inside pod:
# ping <service-name>.<namespace>.svc.cluster.local
# wget -O- http://<service-name>:<port>
```

#### External Secrets Sync Issues

```bash
# Check ExternalSecret status
kubectl describe externalsecret <name> -n <namespace>

# Check ESO controller logs
kubectl logs -n external-secrets-system -l app.kubernetes.io/name=external-secrets

# Verify IAM role attachment
aws iam list-attached-role-policies \
  --role-name velya-${VELYA_ENV}-exa-role \
  --profile ${AWS_PROFILE}
```

#### ArgoCD Sync Issues

```bash
# Check ArgoCD application status
argocd app describe velya-api-gateway

# Sync with verbose output
argocd app sync velya-api-gateway --verbose

# Check ArgoCD controller logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller
```

---

## Cleanup & Destruction

### WARNING: This will delete all resources!

```bash
# Delete ArgoCD applications
argocd app delete velya-app-of-apps -y

# Delete Kubernetes resources
kubectl delete namespace velya-${VELYA_ENV}-core
kubectl delete namespace velya-${VELYA_ENV}-platform
kubectl delete namespace velya-${VELYA_ENV}-agents
kubectl delete namespace velya-${VELYA_ENV}-observability

# Destroy AWS infrastructure
cd infra/opentofu/live/${VELYA_ENV}
tofu destroy

# Remove kubeconfig entry
kubectl config delete-context $(kubectl config current-context)
kubectl config delete-cluster ${VELYA_CLUSTER_NAME}
```

---

## Maintenance Commands

### Regular Operations

```bash
# Check cluster health
kubectl get nodes
kubectl get pods --all-namespaces --field-selector=status.phase!=Running

# Update ArgoCD apps
argocd app sync --all

# View logs
kubectl logs -n velya-${VELYA_ENV}-core -l app=velya-api-gateway --tail=100 -f

# Restart deployment
kubectl rollout restart deployment/velya-api-gateway -n velya-${VELYA_ENV}-core

# Scale deployment
kubectl scale deployment velya-api-gateway \
  --replicas=3 \
  -n velya-${VELYA_ENV}-core
```

### Backup & Disaster Recovery

```bash
# Backup EBS volumes (RDS auto-backups)
# Backup Kubernetes resources
kubectl get all --all-namespaces -o yaml > velya-backup-$(date +%Y%m%d).yaml

# Backup Helm values
helm get values -n argocd argocd > argocd-values-backup.yaml
```

---

## Next Steps

1. **Monitoring & Alerting**: Configure Prometheus alerting rules
2. **Backup Strategy**: Set up automated backups for databases
3. **CI/CD Pipeline**: Configure GitHub Actions to auto-deploy on merge
4. **Security Hardening**: Enable pod security policies, network policies
5. **Cost Optimization**: Review and optimize resource allocations
6. **Documentation**: Document custom configurations and runbooks

---

## Support & References

- [AWS EKS Documentation](https://docs.aws.amazon.com/eks/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Helm Documentation](https://helm.sh/docs/)
- [OpenTofu Documentation](https://opentofu.org/docs/)

---

**Last Updated**: 2026-04-08  
**Version**: 1.0.0  
**Environment**: All (dev, staging, prod)
