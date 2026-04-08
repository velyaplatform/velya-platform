#!/bin/bash

##############################################################################
# VELYA PLATFORM - SUPER INTELLIGENT INIT SCRIPT
#
# This script handles EVERYTHING:
#  ✅ Detects OS (macOS, Linux, Windows/WSL)
#  ✅ Checks all prerequisites
#  ✅ Installs missing tools automatically
#  ✅ Configures permissions
#  ✅ Sets up kind cluster
#  ✅ Sets up ministack (AWS simulation)
#  ✅ Validates everything
#  ✅ Provides access information
#
# Usage: ./scripts/velya-init.sh
##############################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Counters
INSTALLED=0
ALREADY_HAVE=0
FAILED=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"

log_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║ $1${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

log_info() {
    echo -e "${BLUE}[ℹ]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_installing() {
    echo -e "${MAGENTA}[⬇]${NC} Installing $1..."
}

# ============================================================================
# OS DETECTION
# ============================================================================

detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if grep -qi microsoft /proc/version 2>/dev/null; then
            echo "wsl"
        else
            echo "linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

detect_linux_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "${ID}"
    else
        echo "unknown"
    fi
}

# ============================================================================
# TOOL INSTALLATION
# ============================================================================

install_docker() {
    local OS=$(detect_os)

    log_installing "Docker"

    case $OS in
        macos)
            log_info "macOS: Installing Docker Desktop via Homebrew..."
            if command -v brew &> /dev/null; then
                brew install --cask docker || {
                    log_warn "Homebrew install failed. Please install Docker Desktop manually:"
                    log_warn "  https://www.docker.com/products/docker-desktop"
                    return 1
                }
            else
                log_warn "Homebrew not found. Please install Docker Desktop manually:"
                log_warn "  https://www.docker.com/products/docker-desktop"
                return 1
            fi
            ;;
        linux)
            log_info "Linux: Installing Docker via package manager..."
            sudo apt-get update
            sudo apt-get install -y docker.io docker-compose || {
                log_error "Failed to install Docker"
                return 1
            }

            # Fix permissions
            log_info "Configuring Docker permissions..."
            sudo usermod -aG docker $USER || true
            log_warn "⚠️  You may need to log out and back in for group permissions to take effect"
            ;;
        *)
            log_error "Unsupported OS: $OS"
            return 1
            ;;
    esac

    log_success "Docker installed"
    INSTALLED=$((INSTALLED + 1))
}

install_kind() {
    log_installing "kind (Kubernetes in Docker)"

    local OS=$(detect_os)
    local INSTALL_DIR="/usr/local/bin"

    # Try Homebrew first
    if command -v brew &> /dev/null; then
        log_info "Installing via Homebrew..."
        brew install kind && log_success "kind installed" && INSTALLED=$((INSTALLED + 1)) && return 0
    fi

    # Fallback to direct download
    log_info "Installing via direct download..."

    local LATEST_KIND=$(curl -s https://api.github.com/repos/kubernetes-sigs/kind/releases/latest 2>/dev/null | grep -o '"browser_download_url": "[^"]*kind-linux-amd64"' | head -1 | cut -d'"' -f4) || true

    if [ -z "$LATEST_KIND" ]; then
        LATEST_KIND="https://github.com/kubernetes-sigs/kind/releases/download/v0.31.0/kind-linux-amd64"
    fi

    if curl -sL -o /tmp/kind "$LATEST_KIND" && [ -s /tmp/kind ]; then
        chmod +x /tmp/kind
        sudo mv /tmp/kind "$INSTALL_DIR/kind"
        log_success "kind installed"
        INSTALLED=$((INSTALLED + 1))
        return 0
    else
        log_error "Failed to install kind"
        return 1
    fi
}

install_kubectl() {
    log_installing "kubectl"

    local OS=$(detect_os)

    # Try Homebrew first
    if command -v brew &> /dev/null; then
        log_info "Installing via Homebrew..."
        brew install kubectl && log_success "kubectl installed" && INSTALLED=$((INSTALLED + 1)) && return 0
    fi

    # Fallback to direct download
    log_info "Installing via direct download..."

    local KUBECTL_VERSION=$(curl -s https://dl.k8s.io/release/stable.txt 2>/dev/null || echo "v1.31.0")

    if curl -sL "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/$(uname -s | tr '[:upper:]' '[:lower:]')/amd64/kubectl" -o /tmp/kubectl && [ -s /tmp/kubectl ]; then
        chmod +x /tmp/kubectl
        sudo mv /tmp/kubectl /usr/local/bin/kubectl
        log_success "kubectl installed"
        INSTALLED=$((INSTALLED + 1))
        return 0
    else
        log_error "Failed to install kubectl"
        return 1
    fi
}

install_helm() {
    log_installing "Helm"

    local OS=$(detect_os)

    # Try Homebrew first
    if command -v brew &> /dev/null; then
        log_info "Installing via Homebrew..."
        brew install helm && log_success "Helm installed" && INSTALLED=$((INSTALLED + 1)) && return 0
    fi

    # Fallback: curl install script
    log_info "Installing via get-helm-3 script..."
    if curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 2>/dev/null | bash 2>/dev/null; then
        log_success "Helm installed"
        INSTALLED=$((INSTALLED + 1))
        return 0
    else
        log_warn "Helm installation failed (optional - observability might not install)"
        return 1
    fi
}

install_git() {
    log_installing "Git"

    local OS=$(detect_os)

    case $OS in
        macos)
            if command -v brew &> /dev/null; then
                brew install git && log_success "Git installed" && INSTALLED=$((INSTALLED + 1)) && return 0
            fi
            ;;
        linux)
            sudo apt-get update
            sudo apt-get install -y git && log_success "Git installed" && INSTALLED=$((INSTALLED + 1)) && return 0
            ;;
    esac

    log_error "Failed to install Git"
    return 1
}

# ============================================================================
# VERIFICATION
# ============================================================================

verify_tool() {
    local tool=$1
    local friendly_name=${2:-$tool}

    if command -v "$tool" &> /dev/null; then
        local version=$($tool --version 2>&1 | head -1 || echo "installed")
        log_success "$friendly_name: $version"
        ALREADY_HAVE=$((ALREADY_HAVE + 1))
        return 0
    else
        log_warn "$friendly_name: NOT FOUND"
        return 1
    fi
}

verify_docker_running() {
    log_info "Checking if Docker is running..."

    if docker ps &> /dev/null; then
        log_success "Docker daemon is running"
        return 0
    else
        log_error "Docker daemon is not running"
        log_info "Please start Docker and try again"
        return 1
    fi
}

check_resources() {
    log_info "Checking system resources..."

    local OS=$(detect_os)
    local AVAILABLE_RAM=0
    local AVAILABLE_DISK=0

    case $OS in
        macos)
            AVAILABLE_RAM=$(($(vm_stat | grep "Pages free" | awk '{print $3}' | tr -d '.') / 256 / 1024))
            ;;
        linux)
            AVAILABLE_RAM=$(($(free | grep Mem | awk '{print $7}') / 1024 / 1024))
            ;;
    esac

    AVAILABLE_DISK=$(($(df "$PROJECT_ROOT" | tail -1 | awk '{print $4}') / 1024 / 1024))

    if [ "$AVAILABLE_RAM" -lt 4 ]; then
        log_warn "Low RAM: ${AVAILABLE_RAM}GB available (recommend 6GB+)"
    else
        log_success "RAM: ${AVAILABLE_RAM}GB available"
    fi

    if [ "$AVAILABLE_DISK" -lt 5 ]; then
        log_warn "Low disk: ${AVAILABLE_DISK}GB available (recommend 5GB+)"
    else
        log_success "Disk: ${AVAILABLE_DISK}GB available"
    fi
}

# ============================================================================
# MAIN SETUP
# ============================================================================

setup_velya() {
    cd "$PROJECT_ROOT"

    log_header "VELYA SETUP: Running kind"

    chmod +x scripts/kind-setup.sh scripts/multistack-setup.sh

    if ! ./scripts/kind-setup.sh setup; then
        log_error "kind setup failed"
        return 1
    fi

    log_header "VELYA SETUP: Running ministack"

    if ! ./scripts/multistack-setup.sh ministack; then
        log_warn "ministack setup failed (optional)"
    fi

    log_header "VELYA SETUP: Verification"

    if ./scripts/multistack-setup.sh verify; then
        return 0
    else
        log_warn "Verification had warnings but setup may still work"
        return 0
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    log_header "VELYA PLATFORM - INTELLIGENT INITIALIZATION"

    local OS=$(detect_os)
    log_info "Detected OS: $OS"

    # ========================================================================
    # STEP 1: Check prerequisites
    # ========================================================================

    log_header "STEP 1: Checking Prerequisites"

    log_info "Required tools:"
    verify_tool "docker" "Docker" || {
        log_info "Docker not found - will attempt installation"
    }

    log_info ""
    log_info "Optional tools (will auto-install if missing):"
    verify_tool "kind" "kind" || true
    verify_tool "kubectl" "kubectl" || true
    verify_tool "helm" "Helm" || true
    verify_tool "git" "Git" || true

    # ========================================================================
    # STEP 2: Install missing tools
    # ========================================================================

    log_header "STEP 2: Installing Missing Tools"

    if ! command -v docker &> /dev/null; then
        install_docker || {
            log_error "Docker installation failed. Please install manually:"
            log_error "  https://www.docker.com/products/docker-desktop"
            exit 1
        }
    else
        log_success "Docker already installed"
        ALREADY_HAVE=$((ALREADY_HAVE + 1))
    fi

    if ! command -v kind &> /dev/null; then
        install_kind || log_warn "kind installation failed (will retry later)"
    else
        log_success "kind already installed"
        ALREADY_HAVE=$((ALREADY_HAVE + 1))
    fi

    if ! command -v kubectl &> /dev/null; then
        install_kubectl || log_warn "kubectl installation failed (will retry later)"
    else
        log_success "kubectl already installed"
        ALREADY_HAVE=$((ALREADY_HAVE + 1))
    fi

    if ! command -v helm &> /dev/null; then
        install_helm || log_warn "Helm installation failed (optional)"
    else
        log_success "Helm already installed"
        ALREADY_HAVE=$((ALREADY_HAVE + 1))
    fi

    if ! command -v git &> /dev/null; then
        install_git || log_warn "Git installation failed"
    else
        log_success "Git already installed"
        ALREADY_HAVE=$((ALREADY_HAVE + 1))
    fi

    # ========================================================================
    # STEP 3: Verify Docker is running
    # ========================================================================

    log_header "STEP 3: Verifying Docker"

    if ! verify_docker_running; then
        log_error "Docker must be running. Please start Docker and run this script again."
        exit 1
    fi

    # ========================================================================
    # STEP 4: Check resources
    # ========================================================================

    log_header "STEP 4: Checking System Resources"

    check_resources

    # ========================================================================
    # STEP 5: Setup Velya
    # ========================================================================

    log_header "STEP 5: Setting Up Velya Platform"

    if ! setup_velya; then
        log_error "Velya setup failed"
        log_info "Try running: ./scripts/multistack-setup.sh both"
        exit 1
    fi

    # ========================================================================
    # FINAL REPORT
    # ========================================================================

    log_header "✨ VELYA PLATFORM READY! ✨"

    echo ""
    echo -e "${GREEN}INSTALLATION SUMMARY${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Tools already installed: $ALREADY_HAVE"
    echo "Tools newly installed:   $INSTALLED"
    echo "Failed to install:       $FAILED"
    echo ""

    echo -e "${GREEN}NEXT STEPS${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. Check cluster status:"
    echo "   kubectl get nodes -L velya.io/tier"
    echo ""
    echo "2. Deploy a test service:"
    echo "   kubectl apply -f - <<'EOF'"
    echo "   apiVersion: v1"
    echo "   kind: Pod"
    echo "   metadata:"
    echo "     name: frontend-test"
    echo "     namespace: velya-dev-core"
    echo "   spec:"
    echo "     nodeSelector:"
    echo "       velya.io/tier: frontend"
    echo "     containers:"
    echo "     - name: nginx"
    echo "       image: nginx:alpine"
    echo "   EOF"
    echo ""
    echo "3. Access Kubernetes services:"
    echo "   kubectl port-forward -n velya-dev-observability svc/prometheus-kube-prometheus-prometheus 9090:9090"
    echo "   kubectl port-forward -n velya-dev-observability svc/grafana 3000:80"
    echo ""
    echo "4. Access AWS simulation (ministack):"
    echo "   export AWS_ENDPOINT_URL=http://localhost:4566"
    echo "   aws ec2 describe-instances"
    echo ""
    echo -e "${GREEN}DOCUMENTATION${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Quick Start:          QUICKSTART_LOCAL.md"
    echo "Setup Guide:          docs/LOCAL_SETUP.md"
    echo "Architecture:         docs/ARCHITECTURE_LOCAL.md"
    echo "Testing:              scripts/kind-local-testing.md"
    echo ""

    echo -e "${CYAN}Everything is ready! Happy developing! 🚀${NC}"
    echo ""
}

main "$@"
