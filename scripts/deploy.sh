#!/bin/bash

##############################################################################
# Velya Platform - Automated AWS EKS Deployment Script
#
# Usage: ./deploy.sh [PHASE] [ENVIRONMENT] [AWS_PROFILE]
# Example: ./deploy.sh all dev velya-dev
#
# Phases:
#   - prerequisites
#   - env-setup
#   - infrastructure
#   - k8s-bootstrap
#   - argocd
#   - observability
#   - secrets
#   - apps
#   - all (all phases)
##############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${LOG_FILE}"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_FILE}"
}

# Cleanup on exit
cleanup_on_exit() {
    log_info "Deployment script completed. Log file: ${LOG_FILE}"
}

trap cleanup_on_exit EXIT

# Validate input
if [ $# -lt 2 ]; then
    echo "Usage: $0 [PHASE] [ENVIRONMENT] [AWS_PROFILE]"
    echo "Phases: prerequisites, env-setup, infrastructure, k8s-bootstrap, argocd, observability, secrets, apps, all"
    echo "Example: $0 all dev velya-dev"
    exit 1
fi

PHASE=${1:-all}
VELYA_ENV=${2:-dev}
AWS_PROFILE=${3:-velya-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
LOG_DIR="${PROJECT_ROOT}/logs/deployment"
LOG_FILE="${LOG_DIR}/$(date +%Y%m%d-%H%M%S).log"

# Create log directory
mkdir -p "${LOG_DIR}"

log_info "=========================================="
log_info "Velya Platform - AWS EKS Deployment"
log_info "=========================================="
log_info "Phase: ${PHASE}"
log_info "Environment: ${VELYA_ENV}"
log_info "AWS Profile: ${AWS_PROFILE}"
log_info "Log File: ${LOG_FILE}"
log_info "=========================================="

# ============================================================================
# Phase 0: Validate Prerequisites
# ============================================================================

phase_prerequisites() {
    log_info "Validating prerequisites..."

    local tools=("aws" "tofu" "kubectl" "helm" "jq" "docker")
    local missing_tools=()

    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        else
            local version=$("$tool" --version 2>/dev/null | head -n1)
            log_success "✓ $tool: $version"
        fi
    done

    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing tools: ${missing_tools[*]}"
        exit 1
    fi

    log_info "Validating AWS credentials..."
    if ! aws sts get-caller-identity --profile "${AWS_PROFILE}" &> /dev/null; then
        log_error "Failed to authenticate with AWS profile: ${AWS_PROFILE}"
        exit 1
    fi

    local ACCOUNT_ID=$(aws sts get-caller-identity --profile "${AWS_PROFILE}" --query Account --output text)
    log_success "✓ AWS Account ID: ${ACCOUNT_ID}"

    log_success "All prerequisites validated"
}

# ============================================================================
# Phase 1: Environment Setup
# ============================================================================

phase_env_setup() {
    log_info "Setting up environment variables..."

    export AWS_REGION=${AWS_REGION:-us-east-1}
    export VELYA_CLUSTER_NAME="velya-${VELYA_ENV}-eks"
    export VELYA_VPC_CIDR="10.0.0.0/16"
    export VELYA_PROJECT_NAME="velya"
    export VELYA_STATE_BUCKET="velya-${VELYA_ENV}-tfstate"
    export VELYA_STATE_DYNAMODB="velya-${VELYA_ENV}-tflock"
    export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --profile "${AWS_PROFILE}" --query Account --output text)
    export ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

    log_info "Environment variables configured:"
    log_info "  VELYA_ENV: ${VELYA_ENV}"
    log_info "  AWS_REGION: ${AWS_REGION}"
    log_info "  VELYA_CLUSTER_NAME: ${VELYA_CLUSTER_NAME}"
    log_info "  ECR_REGISTRY: ${ECR_REGISTRY}"
    log_info "  AWS_PROFILE: ${AWS_PROFILE}"

    # Create necessary directories
    mkdir -p "${PROJECT_ROOT}/logs/deployment"
    mkdir -p "${PROJECT_ROOT}/infra/opentofu/live/${VELYA_ENV}"

    log_success "Environment setup completed"
}

# ============================================================================
# Phase 2: AWS Infrastructure with OpenTofu
# ============================================================================

phase_infrastructure() {
    log_info "Provisioning AWS infrastructure with OpenTofu..."

    cd "${PROJECT_ROOT}/infra/opentofu/live/${VELYA_ENV}"

    # Initialize OpenTofu
    log_info "Initializing OpenTofu..."
    tofu init

    # Validate configuration
    log_info "Validating OpenTofu configuration..."
    tofu validate || {
        log_error "OpenTofu validation failed"
        exit 1
    }

    # Format code
    tofu fmt -recursive ../../modules/

    # Plan infrastructure
    log_info "Planning infrastructure..."
    tofu plan -out=tfplan.binary 2>&1 | tee -a "${LOG_FILE}"

    # Apply infrastructure
    log_info "Applying infrastructure (this may take 10-15 minutes)..."
    tofu apply tfplan.binary 2>&1 | tee -a "${LOG_FILE}"

    # Export outputs
    log_info "Exporting infrastructure outputs..."
    tofu output -json > outputs.json

    export VELYA_VPC_ID=$(tofu output -raw vpc_id)
    export VELYA_CLUSTER_ENDPOINT=$(tofu output -raw cluster_endpoint)
    export VELYA_OIDC_PROVIDER_ARN=$(tofu output -raw oidc_provider_arn)

    log_success "Infrastructure provisioned:"
    log_success "  VPC ID: ${VELYA_VPC_ID}"
    log_success "  Cluster Endpoint: ${VELYA_CLUSTER_ENDPOINT}"

    # Configure kubectl
    log_info "Configuring kubectl access..."
    aws eks update-kubeconfig \
        --name "${VELYA_CLUSTER_NAME}" \
        --region "${AWS_REGION}" \
        --profile "${AWS_PROFILE}"

    # Verify cluster access
    log_info "Verifying cluster access..."
    kubectl cluster-info
    kubectl get nodes

    log_success "Infrastructure phase completed"
    cd "${PROJECT_ROOT}"
}

# ============================================================================
# Phase 3: Kubernetes Bootstrap
# ============================================================================

phase_k8s_bootstrap() {
    log_info "Bootstrapping Kubernetes cluster..."

    # Create namespaces
    log_info "Creating namespaces..."
    kubectl apply -f "${PROJECT_ROOT}/infra/bootstrap/namespaces/${VELYA_ENV}.yaml"
    kubectl get namespaces | grep velya

    # Apply network policies
    log_info "Applying network policies..."
    kubectl apply -f "${PROJECT_ROOT}/infra/bootstrap/policies/network-policy-default-deny.yaml"

    # Apply resource quotas and limits
    log_info "Applying resource quotas and limits..."
    kubectl apply -f "${PROJECT_ROOT}/infra/bootstrap/policies/resource-quotas-${VELYA_ENV}.yaml"
    kubectl apply -f "${PROJECT_ROOT}/infra/bootstrap/policies/limit-ranges-${VELYA_ENV}.yaml"

    # Label namespaces for PSS
    log_info "Labeling namespaces for Pod Security Standards..."
    for ns in core platform agents observability; do
        kubectl label namespace "velya-${VELYA_ENV}-${ns}" \
            pod-security.kubernetes.io/enforce=restricted \
            pod-security.kubernetes.io/audit=restricted \
            pod-security.kubernetes.io/warn=restricted \
            --overwrite 2>/dev/null || true
    done

    # Wait for namespaces to be ready
    log_info "Waiting for namespaces to be ready..."
    sleep 10

    log_success "Kubernetes bootstrap completed"
}

# ============================================================================
# Phase 4: ArgoCD Setup
# ============================================================================

phase_argocd() {
    log_info "Installing and configuring ArgoCD..."

    # Add Helm repo
    log_info "Adding ArgoCD Helm repository..."
    helm repo add argo https://argoproj.github.io/argo-helm
    helm repo update

    # Install ArgoCD
    log_info "Installing ArgoCD (this may take 5 minutes)..."
    helm install argocd argo/argo-cd \
        --namespace argocd \
        --create-namespace \
        --version 7.3.0 \
        --set server.service.type=LoadBalancer \
        --set server.insecure=false \
        --wait 2>&1 | tee -a "${LOG_FILE}"

    # Wait for ArgoCD to be ready
    log_info "Waiting for ArgoCD server to be ready..."
    kubectl wait --for=condition=available --timeout=300s \
        deployment/argocd-server -n argocd

    # Get credentials
    local ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret \
        -o jsonpath="{.data.password}" | base64 -d)
    local ARGOCD_URL=$(kubectl -n argocd get svc argocd-server \
        -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "PENDING")

    log_success "ArgoCD installed:"
    log_success "  URL: https://${ARGOCD_URL}"
    log_success "  Username: admin"
    log_success "  Password: ${ARGOCD_PASSWORD}"

    # Deploy App-of-Apps
    log_info "Deploying ArgoCD App-of-Apps..."
    kubectl apply -f "${PROJECT_ROOT}/infra/bootstrap/argocd/namespace.yaml"
    kubectl apply -f "${PROJECT_ROOT}/infra/bootstrap/argocd/app-of-apps.yaml"
    kubectl apply -f "${PROJECT_ROOT}/infra/bootstrap/argocd/platform-apps.yaml"

    # Wait for sync
    log_info "Waiting for ArgoCD apps to sync..."
    sleep 30

    log_success "ArgoCD phase completed"
}

# ============================================================================
# Phase 5: Observability Stack
# ============================================================================

phase_observability() {
    log_info "Installing observability stack..."

    # Prometheus
    log_info "Installing Prometheus..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update

    helm install prometheus prometheus-community/kube-prometheus-stack \
        --namespace "velya-${VELYA_ENV}-observability" \
        --create-namespace \
        --version 54.0.0 \
        --set prometheus.prometheusSpec.retention=30d \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
        --wait 2>&1 | tee -a "${LOG_FILE}"

    log_success "✓ Prometheus installed"

    # Loki
    log_info "Installing Loki..."
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    helm install loki grafana/loki-stack \
        --namespace "velya-${VELYA_ENV}-observability" \
        --version 2.10.0 \
        --set loki.enabled=true \
        --set promtail.enabled=true \
        --set grafana.enabled=false \
        --wait 2>&1 | tee -a "${LOG_FILE}"

    log_success "✓ Loki installed"

    # Grafana
    log_info "Installing Grafana..."
    helm install grafana grafana/grafana \
        --namespace "velya-${VELYA_ENV}-observability" \
        --version 7.0.0 \
        --set persistence.enabled=true \
        --set persistence.size=10Gi \
        --set adminPassword="VelyaAdm1n123!" \
        --wait 2>&1 | tee -a "${LOG_FILE}"

    log_success "✓ Grafana installed"

    log_success "Observability stack phase completed"
}

# ============================================================================
# Phase 6: Secrets Management
# ============================================================================

phase_secrets() {
    log_info "Setting up secrets management..."

    # Install External Secrets Operator
    log_info "Installing External Secrets Operator..."
    helm repo add external-secrets https://charts.external-secrets.io
    helm repo update

    helm install external-secrets external-secrets/external-secrets \
        --namespace external-secrets-system \
        --create-namespace \
        --version 0.9.0 \
        --wait 2>&1 | tee -a "${LOG_FILE}"

    log_success "✓ External Secrets Operator installed"

    # Apply ClusterSecretStore
    log_info "Creating ClusterSecretStore..."
    kubectl apply -f "${PROJECT_ROOT}/infra/bootstrap/external-secrets/cluster-secret-store.yaml"

    log_success "Secrets management phase completed"
}

# ============================================================================
# Phase 7: Application Deployment
# ============================================================================

phase_apps() {
    log_info "Deploying applications..."

    # Build Docker images
    log_info "Building Docker images..."

    # Login to ECR
    log_info "Logging in to ECR..."
    aws ecr get-login-password --region "${AWS_REGION}" --profile "${AWS_PROFILE}" | \
        docker login --username AWS --password-stdin "${ECR_REGISTRY}"

    # Build and push images
    local apps=("api-gateway" "web")
    for app in "${apps[@]}"; do
        log_info "Building ${app}..."
        docker build -t "${ECR_REGISTRY}/velya-${app}:latest" \
            -f "${PROJECT_ROOT}/apps/${app}/Dockerfile" \
            "${PROJECT_ROOT}/apps/${app}/" 2>&1 | tee -a "${LOG_FILE}"

        docker push "${ECR_REGISTRY}/velya-${app}:latest" 2>&1 | tee -a "${LOG_FILE}"
        log_success "✓ Pushed ${app}"
    done

    # Sync ArgoCD
    log_info "Syncing ArgoCD applications..."
    kubectl wait --for=condition=available --timeout=300s \
        deployment/argocd-server -n argocd 2>/dev/null || true

    sleep 10

    log_success "Applications phase completed"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    case "${PHASE}" in
        prerequisites)
            phase_prerequisites
            ;;
        env-setup)
            phase_prerequisites
            phase_env_setup
            ;;
        infrastructure)
            phase_prerequisites
            phase_env_setup
            phase_infrastructure
            ;;
        k8s-bootstrap)
            phase_prerequisites
            phase_env_setup
            phase_k8s_bootstrap
            ;;
        argocd)
            phase_prerequisites
            phase_env_setup
            phase_argocd
            ;;
        observability)
            phase_prerequisites
            phase_env_setup
            phase_observability
            ;;
        secrets)
            phase_prerequisites
            phase_env_setup
            phase_secrets
            ;;
        apps)
            phase_prerequisites
            phase_env_setup
            phase_apps
            ;;
        all)
            phase_prerequisites
            phase_env_setup
            phase_infrastructure
            phase_k8s_bootstrap
            phase_argocd
            phase_observability
            phase_secrets
            phase_apps

            log_success "=========================================="
            log_success "All deployment phases completed successfully!"
            log_success "=========================================="
            ;;
        *)
            log_error "Unknown phase: ${PHASE}"
            exit 1
            ;;
    esac
}

# Run main
main
