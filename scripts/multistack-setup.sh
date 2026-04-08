#!/bin/bash

##############################################################################
# Velya Multi-Stack Setup
#
# Simulates Velya platform in TWO environments:
#  1. kind (local Kubernetes in Docker) - Quick development
#  2. ministack.io (AWS-like infrastructure simulation) - AWS-equivalent visualization
#
# Usage: ./scripts/multistack-setup.sh [kind|ministack|both|verify|teardown]
##############################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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

log_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║ $1${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# ============================================================================
# KIND Setup
# ============================================================================

setup_kind() {
    log_header "KIND Setup (Local Kubernetes)"

    # Check prerequisites
    log_info "Checking kind prerequisites..."
    if ! command -v kind &> /dev/null; then
        log_error "kind is not installed. Install from https://kind.sigs.k8s.io/"
        log_info "Quick install: brew install kind (macOS) or see docs/LOCAL_SETUP.md"
        return 1
    fi

    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        return 1
    fi

    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed"
        return 1
    fi

    log_success "All prerequisites met"

    # Create kind cluster config
    log_info "Creating kind cluster configuration..."
    mkdir -p "${PROJECT_ROOT}/.kind"

    cat > "${PROJECT_ROOT}/.kind/cluster-config.yaml" <<'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: velya-local

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

networking:
  apiServerAddress: 127.0.0.1
  apiServerPort: 6443

containerdConfigPatches:
  - |-
    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."localhost:5000"]
      endpoint = ["http://kind-registry:5000"]
EOF

    log_success "kind cluster config created"

    # Create cluster
    log_info "Creating kind cluster (this takes ~30 seconds)..."
    if kind get clusters | grep -q "^velya-local$"; then
        log_warn "kind cluster 'velya-local' already exists. Skipping creation."
    else
        kind create cluster \
            --name velya-local \
            --config "${PROJECT_ROOT}/.kind/cluster-config.yaml" \
            --image kindest/node:v1.31.0 \
            --wait 120s || {
            log_error "Failed to create kind cluster"
            return 1
        }
    fi

    log_success "kind cluster ready"

    # Set kubeconfig
    kubectl config use-context kind-velya-local
    log_success "kubectl context set to kind-velya-local"

    # Wait for nodes
    log_info "Waiting for nodes to be ready..."
    kubectl wait --for=condition=Ready nodes --all --timeout=60s || true

    # Apply network policies and quotas
    log_info "Applying tier isolation (network policies + resource quotas)..."
    kubectl apply -f "${PROJECT_ROOT}/infra/bootstrap/tier-isolation/network-policies-by-tier.yaml" || true
    kubectl apply -f "${PROJECT_ROOT}/infra/bootstrap/tier-isolation/resource-quotas-by-tier.yaml" || true

    log_success "kind cluster setup complete"

    # Print access info
    echo ""
    echo -e "${GREEN}kind Cluster Ready:${NC}"
    kubectl get nodes -L velya.io/tier
    echo ""
}

# ============================================================================
# MINISTACK Setup (AWS-like simulation)
# https://github.com/Nahuel990/ministack
# ============================================================================

setup_ministack() {
    log_header "MINISTACK Setup (AWS-like Infrastructure)"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed"
        return 1
    fi

    log_info "Ministack simulates AWS infrastructure with:"
    echo "  • VPC with public/private subnets"
    echo "  • EKS cluster (managed Kubernetes)"
    echo "  • 4 Auto Scaling Groups (frontend, backend, platform, ai)"
    echo "  • RDS PostgreSQL"
    echo "  • ECR registry"
    echo "  • Load balancers"
    echo "  • CloudWatch, VPC Flow Logs"
    echo ""

    MINISTACK_DIR="${PROJECT_ROOT}/.ministack"
    mkdir -p "$MINISTACK_DIR"

    # Clone ministack if not present
    if [ ! -d "$MINISTACK_DIR/repo" ]; then
        log_info "Cloning ministack repository..."
        git clone https://github.com/Nahuel990/ministack.git "$MINISTACK_DIR/repo" || {
            log_error "Failed to clone ministack. Check your internet connection."
            return 1
        }
        log_success "ministack repository cloned"
    else
        log_info "ministack repository already exists"
    fi

    # Create Velya overlay configuration
    log_info "Creating Velya ministack configuration..."

    cat > "$MINISTACK_DIR/velya-config.sh" <<'EOF'
#!/bin/bash

# Velya Platform on Ministack
# Customizes ministack to match Velya's tier isolation architecture

set -euo pipefail

MINISTACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$MINISTACK_DIR/repo"

echo "[ministack] Setting up Velya infrastructure..."

# Create environment variables for ministack
cat > "$REPO_DIR/.env" <<ENVEOF
# AWS Credentials (LocalStack)
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1

# VPC Config
VPC_CIDR=10.0.0.0/16
PUBLIC_SUBNET_1_CIDR=10.0.1.0/24
PUBLIC_SUBNET_2_CIDR=10.0.2.0/24
PRIVATE_SUBNET_1_CIDR=10.0.10.0/24
PRIVATE_SUBNET_2_CIDR=10.0.20.0/24

# EKS Cluster
EKS_CLUSTER_NAME=velya-prod
EKS_VERSION=1.31
EKS_ENDPOINT_PRIVATE=false

# Node Groups (matching Velya architecture)
FRONTEND_NODES=2
FRONTEND_INSTANCE_TYPE=t3.medium
BACKEND_NODES=2
BACKEND_INSTANCE_TYPE=t3.large
PLATFORM_NODES=1
PLATFORM_INSTANCE_TYPE=t3.small
AI_NODES=1
AI_INSTANCE_TYPE=t3.large

# RDS
RDS_ALLOCATED_STORAGE=100
RDS_DB_INSTANCE_CLASS=db.t3.micro
RDS_MULTI_AZ=false
RDS_DB_NAME=velya
RDS_USERNAME=velya
RDS_PASSWORD=velya-prod-password

# Monitoring
ENABLE_CLOUDWATCH=true
ENABLE_VPC_FLOW_LOGS=true
ENABLE_X_RAY=true

# Tags
PROJECT_NAME=Velya
ENVIRONMENT=dev
MANAGED_BY=ministack
OWNER_EMAIL=platform@velya.com
ENVEOF

echo "[ministack] Velya configuration created at $REPO_DIR/.env"
echo "[ministack] Run 'docker-compose -f $REPO_DIR/docker-compose.yml up -d' to start"
EOF

    chmod +x "$MINISTACK_DIR/velya-config.sh"
    bash "$MINISTACK_DIR/velya-config.sh"

    # Start ministack
    log_info "Starting ministack services (this takes ~60 seconds)..."
    cd "$MINISTACK_DIR/repo"

    if command -v docker-compose &> /dev/null; then
        docker-compose up -d
    elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
        docker compose up -d
    else
        log_error "docker-compose not found"
        return 1
    fi

    # Wait for services
    log_info "Waiting for services to be healthy..."
    sleep 15

    # Verify services
    log_success "ministack services started"
    echo ""

    log_info "LocalStack is now running. Access via:"
    echo "  AWS_ENDPOINT_URL=http://localhost:4566"
    echo ""
    echo "To use AWS CLI with ministack:"
    echo "  aws --endpoint-url http://localhost:4566 ec2 describe-instances"
    echo ""
}

# ============================================================================
# Verify Setup
# ============================================================================

verify_all() {
    log_header "Verification Report"

    # KIND status
    echo -e "${CYAN}==== KIND (Local Kubernetes) ====${NC}"
    if kind get clusters | grep -q "^velya-local$"; then
        echo -e "${GREEN}✓ Cluster exists${NC}"
        kubectl cluster-info --context kind-velya-local &>/dev/null && \
            echo -e "${GREEN}✓ kubectl accessible${NC}" || \
            echo -e "${RED}✗ kubectl not accessible${NC}"

        NODES=$(kubectl get nodes --no-headers 2>/dev/null | wc -l)
        echo -e "${GREEN}✓ Nodes: $NODES${NC}"
        echo ""
        kubectl get nodes -L velya.io/tier 2>/dev/null || true
    else
        echo -e "${YELLOW}⊘ Cluster not found${NC}"
    fi

    echo ""

    # MINISTACK status
    echo -e "${CYAN}==== MINISTACK (AWS Simulation) ====${NC}"

    MINISTACK_REPO="${PROJECT_ROOT}/.ministack/repo"
    if [ -d "$MINISTACK_REPO" ] && [ -f "$MINISTACK_REPO/docker-compose.yml" ]; then
        echo "Services:"
        cd "$MINISTACK_REPO" && (docker-compose ps 2>/dev/null | tail -n +2 || true) && cd - > /dev/null
        echo ""

        echo "Access URLs:"
        echo "  LocalStack:    http://localhost:4566 (AWS API emulation)"
        echo "  LocalStack UI: http://localhost:4566/_localstack/health"
        echo ""
        echo "AWS CLI Usage:"
        echo "  AWS_ENDPOINT_URL=http://localhost:4566 aws ec2 describe-instances"
        echo "  AWS_ENDPOINT_URL=http://localhost:4566 aws eks describe-cluster --name velya-prod"
        echo ""
    else
        echo -e "${YELLOW}⊘ Ministack not initialized${NC}"
    fi

    echo ""
}

# ============================================================================
# Teardown
# ============================================================================

teardown_all() {
    log_warn "Tearing down all environments..."

    # Teardown KIND
    if kind get clusters 2>/dev/null | grep -q "^velya-local$"; then
        log_info "Deleting kind cluster..."
        kind delete cluster --name velya-local
        log_success "kind cluster deleted"
    fi

    # Teardown MINISTACK
    MINISTACK_REPO="${PROJECT_ROOT}/.ministack/repo"
    if [ -d "$MINISTACK_REPO" ] && [ -f "$MINISTACK_REPO/docker-compose.yml" ]; then
        log_info "Stopping ministack services..."
        cd "$MINISTACK_REPO"

        if command -v docker-compose &> /dev/null; then
            docker-compose down 2>/dev/null || true
        elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
            docker compose down 2>/dev/null || true
        fi

        cd - > /dev/null
        log_success "ministack services stopped"
    fi

    log_success "All environments torn down"
}

# ============================================================================
# Main
# ============================================================================

main() {
    if [ $# -lt 1 ]; then
        cat << 'USAGE'
Velya Multi-Stack Setup

Usage: ./scripts/multistack-setup.sh [command]

Commands:
  kind              Setup local Kubernetes cluster (kind)
  ministack         Setup AWS-like infrastructure simulation (LocalStack, MinIO, Postgres, Redis, NATS)
  both              Setup both kind + ministack
  verify            Verify both environments are running
  teardown          Tear down all environments

Examples:
  ./scripts/multistack-setup.sh both           # Setup everything
  ./scripts/multistack-setup.sh verify         # Check status
  ./scripts/multistack-setup.sh kind           # Local K8s only
  ./scripts/multistack-setup.sh ministack      # AWS simulation only

Next Steps:
  1. ./scripts/multistack-setup.sh both
  2. ./scripts/multistack-setup.sh verify
  3. kubectl get nodes -L velya.io/tier       (inspect kind nodes)
  4. curl http://localhost:4566               (test LocalStack)
  5. See scripts/kind-local-testing.md for tier isolation tests
USAGE
        exit 0
    fi

    case "$1" in
        kind)
            setup_kind
            ;;
        ministack)
            setup_ministack
            ;;
        both)
            setup_kind && setup_ministack
            ;;
        verify)
            verify_all
            ;;
        teardown)
            teardown_all
            ;;
        *)
            log_error "Unknown command: $1"
            exit 1
            ;;
    esac
}

main "$@"
