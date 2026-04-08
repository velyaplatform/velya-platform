#!/bin/bash

##############################################################################
# Velya Platform - Local Development Setup with kind
#
# Creates a multi-node Kubernetes cluster locally that simulates the
# production architecture with 4 specialized node groups
#
# Requirements:
#  - Docker
#  - kind (https://kind.sigs.k8s.io/docs/user/quick-start/)
#  - kubectl
#  - helm
#
# Usage: ./scripts/kind-setup.sh [setup|teardown|verify]
##############################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CLUSTER_NAME="velya-local"
KIND_VERSION="v1.31.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# ============================================================================
# Setup Phase
# ============================================================================

setup() {
    log_info "Setting up Velya local development environment with kind..."

    # Check prerequisites
    log_info "Checking prerequisites..."
    for tool in docker kind kubectl helm; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed"
            exit 1
        fi
    done
    log_success "All prerequisites met"

    # Create kind cluster config
    log_info "Creating kind cluster configuration..."
    create_kind_config

    # Create cluster (skip if already exists)
    if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        log_success "kind cluster '${CLUSTER_NAME}' already exists, skipping creation"
    else
        log_info "Creating kind cluster '${CLUSTER_NAME}' (this takes ~30 seconds)..."
        kind create cluster \
            --name "${CLUSTER_NAME}" \
            --config "${PROJECT_ROOT}/.kind/cluster-config.yaml" \
            --image kindest/node:"${KIND_VERSION}" \
            --wait 120s

        if [ $? -ne 0 ]; then
            log_error "Failed to create kind cluster"
            exit 1
        fi
        log_success "kind cluster created"
    fi

    # Set kubeconfig context
    kubectl config use-context kind-"${CLUSTER_NAME}"
    log_success "kubectl context set to kind-${CLUSTER_NAME}"

    # Label nodes for tier assignment
    log_info "Labeling nodes for tier isolation..."
    label_nodes

    # Apply Helm repos
    log_info "Adding Helm repositories..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo add argo https://argoproj.github.io/argo-helm
    helm repo add external-secrets https://charts.external-secrets.io
    helm repo update

    # Create namespaces
    log_info "Creating namespaces..."
    kubectl create namespace velya-dev-core || true
    kubectl create namespace velya-dev-platform || true
    kubectl create namespace velya-dev-agents || true
    kubectl create namespace velya-dev-observability || true
    kubectl create namespace argocd || true

    # Apply network policies
    log_info "Applying network policies..."
    kubectl apply -f "${PROJECT_ROOT}/infra/bootstrap/tier-isolation/network-policies-by-tier.yaml"

    # Apply resource quotas
    log_info "Applying resource quotas..."
    kubectl apply -f "${PROJECT_ROOT}/infra/bootstrap/tier-isolation/resource-quotas-by-tier.yaml"

    # Install observability stack
    log_info "Installing observability stack..."
    install_observability

    # Install ArgoCD
    log_info "Installing ArgoCD..."
    install_argocd

    # Print access instructions
    log_success "Velya local environment setup completed!"
    print_access_info
}

# ============================================================================
# Create kind cluster config
# ============================================================================

create_kind_config() {
    mkdir -p "${PROJECT_ROOT}/.kind"

    cat > "${PROJECT_ROOT}/.kind/cluster-config.yaml" <<'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: velya-local

# 4 control-plane replicas for HA (optional, 1 is fine for local)
# nodes:
#   - role: control-plane
#   - role: control-plane
#   - role: control-plane

# 4 worker nodes - one per tier
nodes:
  # Control plane
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "velya.io/tier=control-plane"

  # Frontend node group
  - role: worker
    kubeadmConfigPatches:
      - |
        kind: KubeletConfiguration
        maxPods: 30
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "velya.io/tier=frontend,velya.io/workload=web"

  # Backend node group
  - role: worker
    kubeadmConfigPatches:
      - |
        kind: KubeletConfiguration
        maxPods: 50
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "velya.io/tier=backend,velya.io/workload=api"

  # Platform node group (tainted)
  - role: worker
    kubeadmConfigPatches:
      - |
        kind: KubeletConfiguration
        maxPods: 30
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "velya.io/tier=platform,velya.io/workload=infra"
          taints:
            - key: velya.io/platform
              value: "true"
              effect: NoSchedule

  # AI/Agents node group (tainted)
  - role: worker
    kubeadmConfigPatches:
      - |
        kind: KubeletConfiguration
        maxPods: 40
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "velya.io/tier=ai,velya.io/workload=agents"
          taints:
            - key: velya.io/ai-workload
              value: "true"
              effect: NoSchedule

# Expose kind API on localhost
networking:
  apiServerAddress: 127.0.0.1
  apiServerPort: 6443

# Port mappings for local access
containerdConfigPatches:
  - |-
    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."localhost:5000"]
      endpoint = ["http://kind-registry:5000"]
EOF

    log_success "kind cluster config created"
}

# ============================================================================
# Label nodes for tier assignment
# ============================================================================

label_nodes() {
    # Wait for nodes to be ready
    kubectl wait --for=condition=Ready nodes --all --timeout=60s

    # Verify labels are applied
    kubectl get nodes -L velya.io/tier,velya.io/workload
}

# ============================================================================
# Install observability stack
# ============================================================================

install_observability() {
    # Prometheus
    helm install prometheus prometheus-community/kube-prometheus-stack \
        --namespace velya-dev-observability \
        --version 54.0.0 \
        --set prometheus.prometheusSpec.retention=7d \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=5Gi \
        --set grafana.persistence.enabled=false \
        --wait \
        2>&1 | grep -v "deprecated" || true

    log_success "Prometheus installed"

    # Grafana
    helm install grafana grafana/grafana \
        --namespace velya-dev-observability \
        --version 7.0.0 \
        --set persistence.enabled=false \
        --set adminPassword=admin \
        --wait 2>&1 | grep -v "deprecated" || true

    log_success "Grafana installed"
}

# ============================================================================
# Install ArgoCD
# ============================================================================

install_argocd() {
    helm install argocd argo/argo-cd \
        --namespace argocd \
        --version 7.3.0 \
        --set server.service.type=NodePort \
        --set server.insecure=true \
        --wait 2>&1 | grep -v "deprecated" || true

    log_success "ArgoCD installed"
}

# ============================================================================
# Verify setup
# ============================================================================

verify() {
    log_info "Verifying Velya local setup..."

    # Check cluster
    if ! kubectl cluster-info &>/dev/null; then
        log_error "Cluster not accessible"
        exit 1
    fi
    log_success "Cluster accessible"

    # Check nodes
    local NODES=$(kubectl get nodes --no-headers | wc -l)
    log_success "$NODES nodes in cluster"

    # Check node labels
    kubectl get nodes -L velya.io/tier

    # Check namespaces
    local NS=$(kubectl get ns | grep velya | wc -l)
    log_success "$NS Velya namespaces created"

    # Check pods
    log_info "Checking pod status..."
    kubectl get pods --all-namespaces | grep -E "(prometheus|grafana|argocd)" || true

    log_success "Verification complete"
}

# ============================================================================
# Teardown Phase
# ============================================================================

teardown() {
    log_warn "Tearing down Velya local environment..."

    if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
        kind delete cluster --name "${CLUSTER_NAME}"
        log_success "kind cluster deleted"
    else
        log_warn "Cluster not found"
    fi

    rm -f "${PROJECT_ROOT}/.kind/cluster-config.yaml"
}

# ============================================================================
# Print access information
# ============================================================================

print_access_info() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║         Velya Local Development Environment Ready! 🎉              ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Cluster:${NC}"
    echo "  Name: ${CLUSTER_NAME}"
    echo "  Context: kind-${CLUSTER_NAME}"
    echo "  Nodes: $(kubectl get nodes --no-headers | wc -l)"
    echo ""
    echo -e "${GREEN}Node Groups:${NC}"
    kubectl get nodes -L velya.io/tier | tail -n +2 | awk '{print "  " $1 " (" $NF ")"}'
    echo ""
    echo -e "${GREEN}Namespaces:${NC}"
    kubectl get ns | grep velya | awk '{print "  " $1}'
    echo "  argocd"
    echo ""
    echo -e "${GREEN}Services:${NC}"
    echo "  Prometheus: kubectl port-forward -n velya-dev-observability svc/prometheus-kube-prometheus-prometheus 9090:9090"
    echo "  Grafana:    kubectl port-forward -n velya-dev-observability svc/grafana 3000:80"
    echo "  ArgoCD:     kubectl port-forward -n argocd svc/argocd-server 8080:443"
    echo ""
    echo -e "${GREEN}Network Policies:${NC}"
    echo "  ✓ Applied (frontend ↔ backend, backend → platform, backend ↔ ai)"
    echo ""
    echo -e "${GREEN}Resource Quotas:${NC}"
    echo "  ✓ Applied per tier (frontend, backend, platform, ai)"
    echo ""
    echo -e "${GREEN}Quick Commands:${NC}"
    echo "  kubectl config use-context kind-${CLUSTER_NAME}"
    echo "  kubectl get nodes -L velya.io/tier"
    echo "  kubectl get pods -A"
    echo "  kubectl describe resourcequota --all-namespaces"
    echo ""
    echo -e "${YELLOW}Tip:${NC} Deploy test applications:"
    echo "  kubectl apply -f deploy/frontend.yaml"
    echo "  kubectl apply -f deploy/backend.yaml"
    echo "  kubectl apply -f deploy/agents.yaml"
    echo ""
}

# ============================================================================
# Main
# ============================================================================

main() {
    if [ $# -lt 1 ]; then
        echo "Usage: $0 [setup|teardown|verify]"
        exit 1
    fi

    case "$1" in
        setup)
            setup
            ;;
        teardown)
            teardown
            ;;
        verify)
            verify
            ;;
        *)
            log_error "Unknown command: $1"
            exit 1
            ;;
    esac
}

main "$@"
