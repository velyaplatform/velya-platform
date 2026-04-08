#!/bin/bash

##############################################################################
# Velya Platform - Cleanup & Destruction Script
#
# WARNING: This script destroys all AWS and Kubernetes resources!
#
# Usage: ./cleanup.sh [ENVIRONMENT] [AWS_PROFILE] [--force]
# Example: ./cleanup.sh dev velya-dev --force
##############################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VELYA_ENV=${1:-dev}
AWS_PROFILE=${2:-velya-dev}
FORCE=${3:-false}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# ============================================================================
# Confirmation Dialog
# ============================================================================

show_confirmation() {
    echo -e "\n${RED}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║         ⚠️  DESTRUCTIVE OPERATION  ⚠️         ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════╝${NC}\n"

    echo -e "This will delete all resources for environment: ${YELLOW}${VELYA_ENV}${NC}"
    echo ""
    echo "Resources that will be destroyed:"
    echo "  • Kubernetes namespaces and all workloads"
    echo "  • EKS cluster and Auto Mode compute"
    echo "  • VPC, subnets, and network resources"
    echo "  • ECR repositories and images"
    echo "  • RDS databases (if any)"
    echo "  • IAM roles and policies"
    echo ""

    if [ "${FORCE}" != "--force" ]; then
        read -p "Type 'DELETE_${VELYA_ENV}' to confirm: " CONFIRMATION

        if [ "$CONFIRMATION" != "DELETE_${VELYA_ENV}" ]; then
            log_error "Confirmation failed. Cleanup cancelled."
            exit 0
        fi
    else
        log_warning "Using --force flag. Skipping confirmation."
    fi

    log_warning "Proceeding with cleanup..."
    sleep 3
}

# ============================================================================
# Step 1: Delete Kubernetes Resources
# ============================================================================

cleanup_kubernetes() {
    log_info "Step 1: Deleting Kubernetes resources..."

    # Delete ArgoCD
    if kubectl get namespace argocd &>/dev/null; then
        log_info "Deleting ArgoCD..."
        kubectl delete namespace argocd --ignore-not-found=true --wait=true
        log_success "ArgoCD deleted"
    fi

    # Delete Velya namespaces
    local namespaces=("core" "platform" "agents" "observability")
    for ns in "${namespaces[@]}"; do
        local full_ns="velya-${VELYA_ENV}-${ns}"
        if kubectl get namespace "$full_ns" &>/dev/null; then
            log_info "Deleting namespace $full_ns..."
            kubectl delete namespace "$full_ns" --ignore-not-found=true --wait=false
        fi
    done

    # Delete External Secrets System
    if kubectl get namespace external-secrets-system &>/dev/null; then
        log_info "Deleting External Secrets System..."
        kubectl delete namespace external-secrets-system --ignore-not-found=true --wait=false
    fi

    # Wait for namespaces to be deleted
    log_info "Waiting for namespaces to be deleted..."
    for ns in "${namespaces[@]}"; do
        local full_ns="velya-${VELYA_ENV}-${ns}"
        timeout 300s bash -c "while kubectl get namespace $full_ns &>/dev/null; do sleep 2; done" || true
    done

    log_success "Kubernetes resources deleted"
}

# ============================================================================
# Step 2: Delete OpenTofu-Managed Infrastructure
# ============================================================================

cleanup_infrastructure() {
    log_info "Step 2: Deleting AWS infrastructure..."

    cd "${PROJECT_ROOT}/infra/opentofu/live/${VELYA_ENV}"

    if [ -f "tfplan.binary" ]; then
        rm -f tfplan.binary
    fi

    log_info "Initializing OpenTofu..."
    tofu init

    log_info "Planning destruction..."
    tofu plan -destroy -out=destroy.tfplan

    log_info "Destroying infrastructure (this may take 10-15 minutes)..."
    tofu apply destroy.tfplan

    if [ -f "destroy.tfplan" ]; then
        rm -f destroy.tfplan
    fi

    log_success "Infrastructure destroyed"
    cd "${PROJECT_ROOT}"
}

# ============================================================================
# Step 3: Cleanup kubeconfig
# ============================================================================

cleanup_kubeconfig() {
    log_info "Step 3: Cleaning up kubeconfig..."

    local cluster_name="velya-${VELYA_ENV}-eks"

    # Remove context
    kubectl config delete-context "${cluster_name}" 2>/dev/null || true

    # Remove cluster
    kubectl config delete-cluster "${cluster_name}" 2>/dev/null || true

    log_success "kubeconfig cleaned up"
}

# ============================================================================
# Step 4: Cleanup AWS Secrets
# ============================================================================

cleanup_secrets() {
    log_info "Step 4: Deleting AWS Secrets Manager secrets..."

    local secrets=$(aws secretsmanager list-secrets \
        --region "${AWS_REGION}" \
        --profile "${AWS_PROFILE}" \
        --filters Key=name,Values="velya/${VELYA_ENV}" \
        --query 'SecretList[*].ARN' \
        --output text 2>/dev/null || echo "")

    if [ -n "$secrets" ]; then
        for secret in $secrets; do
            log_info "Scheduling deletion for secret..."
            aws secretsmanager delete-secret \
                --secret-id "$secret" \
                --force-delete-without-recovery \
                --region "${AWS_REGION}" \
                --profile "${AWS_PROFILE}" \
                2>/dev/null || true
        done
        log_success "Secrets scheduled for deletion"
    else
        log_warning "No secrets found to delete"
    fi
}

# ============================================================================
# Step 5: Cleanup Local Files
# ============================================================================

cleanup_local_files() {
    log_info "Step 5: Cleaning up local files..."

    # Backup .tfstate before deleting
    if [ -f "${PROJECT_ROOT}/infra/opentofu/live/${VELYA_ENV}/terraform.tfstate" ]; then
        local backup_dir="${PROJECT_ROOT}/logs/backup"
        mkdir -p "${backup_dir}"
        cp "${PROJECT_ROOT}/infra/opentofu/live/${VELYA_ENV}/terraform.tfstate" \
            "${backup_dir}/terraform.tfstate.backup-$(date +%Y%m%d-%H%M%S)"
        log_success "State file backed up to ${backup_dir}"
    fi

    # Remove OpenTofu files
    rm -rf "${PROJECT_ROOT}/infra/opentofu/live/${VELYA_ENV}/.terraform"
    rm -f "${PROJECT_ROOT}/infra/opentofu/live/${VELYA_ENV}/.terraform.lock.hcl"
    rm -f "${PROJECT_ROOT}/infra/opentofu/live/${VELYA_ENV}/terraform.tfstate"
    rm -f "${PROJECT_ROOT}/infra/opentofu/live/${VELYA_ENV}/terraform.tfstate.backup"

    log_success "Local files cleaned up"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Velya Platform - Cleanup & Destruction${NC}"
    echo -e "${BLUE}========================================${NC}\n"

    log_info "Environment: ${VELYA_ENV}"
    log_info "AWS Profile: ${AWS_PROFILE}"

    # Validate environment
    if [ -z "${VELYA_ENV}" ] || [ -z "${AWS_PROFILE}" ]; then
        log_error "VELYA_ENV and AWS_PROFILE are required"
        exit 1
    fi

    # Show confirmation
    show_confirmation

    # Execute cleanup steps
    cleanup_kubernetes
    cleanup_infrastructure
    cleanup_kubeconfig
    cleanup_secrets
    cleanup_local_files

    # Final summary
    echo -e "\n${GREEN}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║       Cleanup Completed Successfully!           ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}\n"

    log_success "All resources for ${VELYA_ENV} have been deleted"
    log_warning "Note: AWS Secrets Manager deletion is scheduled. Secrets may take up to 30 days to be permanently deleted."
}

# Check if kubeconfig is available
if ! kubectl cluster-info &>/dev/null; then
    log_error "No Kubernetes cluster is currently configured"
    exit 1
fi

# Run main
main
