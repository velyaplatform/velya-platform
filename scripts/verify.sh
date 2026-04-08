#!/bin/bash

##############################################################################
# Velya Platform - Deployment Verification Script
#
# Verifies that all infrastructure and applications are deployed correctly
#
# Usage: ./verify.sh [ENVIRONMENT]
# Example: ./verify.sh dev
##############################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNINGS=0

VELYA_ENV=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
LOG_FILE="${PROJECT_ROOT}/logs/deployment/verify-$(date +%Y%m%d-%H%M%S).log"

# Create log directory
mkdir -p "$(dirname "${LOG_FILE}")"

# Logging functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1" | tee -a "${LOG_FILE}"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1" | tee -a "${LOG_FILE}"
    ((CHECKS_FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1" | tee -a "${LOG_FILE}"
    ((CHECKS_WARNINGS++))
}

section() {
    echo -e "\n${BLUE}▶${NC} $1" | tee -a "${LOG_FILE}"
}

# Main header
echo -e "${BLUE}========================================${NC}" | tee -a "${LOG_FILE}"
echo -e "${BLUE}Velya Platform - Deployment Verification${NC}" | tee -a "${LOG_FILE}"
echo -e "${BLUE}Environment: ${VELYA_ENV}${NC}" | tee -a "${LOG_FILE}"
echo -e "${BLUE}========================================${NC}" | tee -a "${LOG_FILE}"

# ============================================================================
# Cluster Checks
# ============================================================================

section "Kubernetes Cluster Health"

if kubectl cluster-info &>/dev/null; then
    check_pass "Kubernetes cluster is accessible"
else
    check_fail "Kubernetes cluster is not accessible"
    exit 1
fi

# Check nodes
local NODES=$(kubectl get nodes --no-headers 2>/dev/null | wc -l)
if [ "$NODES" -gt 0 ]; then
    check_pass "Cluster has $NODES node(s)"
else
    check_fail "No nodes found in cluster"
fi

# Check all nodes are ready
if kubectl get nodes | grep -q "NotReady"; then
    check_warn "Some nodes are in NotReady state"
else
    check_pass "All nodes are in Ready state"
fi

# ============================================================================
# Namespace Checks
# ============================================================================

section "Namespace Validation"

local NAMESPACES=("core" "platform" "agents" "observability")
for ns in "${NAMESPACES[@]}"; do
    if kubectl get namespace "velya-${VELYA_ENV}-${ns}" &>/dev/null; then
        check_pass "Namespace velya-${VELYA_ENV}-${ns} exists"
    else
        check_fail "Namespace velya-${VELYA_ENV}-${ns} not found"
    fi
done

# ============================================================================
# Pod Checks
# ============================================================================

section "Pod Status"

# Check for failed pods
local FAILED_PODS=$(kubectl get pods --all-namespaces --field-selector=status.phase=Failed --no-headers 2>/dev/null | wc -l)
if [ "$FAILED_PODS" -eq 0 ]; then
    check_pass "No failed pods"
else
    check_warn "$FAILED_PODS pod(s) in Failed state"
fi

# Check for pending pods (with timeout)
local PENDING_PODS=$(kubectl get pods --all-namespaces --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l)
if [ "$PENDING_PODS" -eq 0 ]; then
    check_pass "No pending pods"
else
    check_warn "$PENDING_PODS pod(s) in Pending state (may still be starting)"
fi

# Check for CrashLoopBackOff
if kubectl get pods --all-namespaces 2>/dev/null | grep -q "CrashLoopBackOff"; then
    check_fail "Found pods in CrashLoopBackOff state"
else
    check_pass "No pods in CrashLoopBackOff state"
fi

# ============================================================================
# Service Checks
# ============================================================================

section "Service Configuration"

# Check if API Gateway service exists
if kubectl get service velya-api-gateway -n "velya-${VELYA_ENV}-core" &>/dev/null; then
    check_pass "API Gateway service exists"
else
    check_warn "API Gateway service not found (may not be deployed yet)"
fi

# Check if services have endpoints
local SERVICES=$(kubectl get services -n "velya-${VELYA_ENV}-core" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)
for svc in $SERVICES; do
    local ENDPOINTS=$(kubectl get endpoints "$svc" -n "velya-${VELYA_ENV}-core" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null | wc -w)
    if [ "$ENDPOINTS" -gt 0 ]; then
        check_pass "Service $svc has $ENDPOINTS endpoint(s)"
    else
        check_warn "Service $svc has no endpoints (may still be starting)"
    fi
done

# ============================================================================
# Storage Checks
# ============================================================================

section "Storage & Persistence"

# Check PVCs
local PVCS=$(kubectl get pvc --all-namespaces --no-headers 2>/dev/null | wc -l)
if [ "$PVCS" -gt 0 ]; then
    check_pass "Found $PVCS PersistentVolumeClaim(s)"
else
    check_warn "No PersistentVolumeClaims found (this may be normal)"
fi

# Check unbound PVCs
if kubectl get pvc --all-namespaces 2>/dev/null | grep -q "Pending"; then
    check_warn "Found PersistentVolumeClaim(s) in Pending state"
else
    check_pass "All PersistentVolumeClaims are bound"
fi

# ============================================================================
# ArgoCD Checks
# ============================================================================

section "ArgoCD & GitOps"

if kubectl get namespace argocd &>/dev/null; then
    check_pass "ArgoCD namespace exists"

    if kubectl get deployment argocd-server -n argocd &>/dev/null; then
        local ARGOCD_READY=$(kubectl get deployment argocd-server -n argocd -o jsonpath='{.status.readyReplicas}')
        if [ "$ARGOCD_READY" -gt 0 ]; then
            check_pass "ArgoCD server is ready"
        else
            check_fail "ArgoCD server is not ready"
        fi
    fi

    # Check ArgoCD applications
    if command -v argocd &>/dev/null; then
        local APPS=$(kubectl get applications -n argocd --no-headers 2>/dev/null | wc -l)
        if [ "$APPS" -gt 0 ]; then
            check_pass "Found $APPS ArgoCD application(s)"

            # Check sync status
            kubectl get applications -n argocd 2>/dev/null | tail -n +2 | while read -r line; do
                local APP_NAME=$(echo "$line" | awk '{print $1}')
                local APP_STATUS=$(echo "$line" | awk '{print $2}')
                if [ "$APP_STATUS" = "Synced" ]; then
                    check_pass "Application $APP_NAME is Synced"
                else
                    check_warn "Application $APP_NAME status is $APP_STATUS"
                fi
            done
        else
            check_warn "No ArgoCD applications found"
        fi
    fi
else
    check_fail "ArgoCD namespace not found"
fi

# ============================================================================
# Observability Checks
# ============================================================================

section "Observability Stack"

# Check Prometheus
if kubectl get deployment prometheus-kube-prometheus-prometheus -n "velya-${VELYA_ENV}-observability" &>/dev/null; then
    check_pass "Prometheus is deployed"
else
    check_warn "Prometheus not found"
fi

# Check Grafana
if kubectl get deployment grafana -n "velya-${VELYA_ENV}-observability" &>/dev/null; then
    check_pass "Grafana is deployed"
else
    check_warn "Grafana not found"
fi

# Check Loki
if kubectl get deployment loki -n "velya-${VELYA_ENV}-observability" &>/dev/null; then
    check_pass "Loki is deployed"
else
    check_warn "Loki not found"
fi

# ============================================================================
# Secrets & Security Checks
# ============================================================================

section "Secrets & Security"

# Check External Secrets Operator
if kubectl get deployment external-secrets -n external-secrets-system &>/dev/null; then
    check_pass "External Secrets Operator is deployed"
else
    check_warn "External Secrets Operator not found"
fi

# Check ClusterSecretStore
if kubectl get clustersecretstore &>/dev/null; then
    check_pass "ClusterSecretStore is configured"
else
    check_warn "ClusterSecretStore not found"
fi

# Check for secrets
local SECRETS=$(kubectl get secrets -n "velya-${VELYA_ENV}-core" --no-headers 2>/dev/null | wc -l)
if [ "$SECRETS" -gt 0 ]; then
    check_pass "Found $SECRETS secret(s) in velya-${VELYA_ENV}-core"
else
    check_warn "No secrets found in velya-${VELYA_ENV}-core"
fi

# ============================================================================
# Network Checks
# ============================================================================

section "Network & Connectivity"

# Check network policies
local NET_POLICIES=$(kubectl get networkpolicies --all-namespaces --no-headers 2>/dev/null | wc -l)
if [ "$NET_POLICIES" -gt 0 ]; then
    check_pass "Found $NET_POLICIES NetworkPolicy(ies)"
else
    check_warn "No NetworkPolicies found"
fi

# Check resource quotas
local RQ=$(kubectl get resourcequotas -n "velya-${VELYA_ENV}-core" --no-headers 2>/dev/null | wc -l)
if [ "$RQ" -gt 0 ]; then
    check_pass "Found $RQ ResourceQuota(s)"
else
    check_warn "No ResourceQuotas found"
fi

# ============================================================================
# Resource Usage Checks
# ============================================================================

section "Resource Usage"

# Check node capacity
echo "Node capacity:" | tee -a "${LOG_FILE}"
kubectl describe nodes | grep -A 5 "Allocated resources" | head -20 | tee -a "${LOG_FILE}"

# Check top pods (if metrics-server is available)
if kubectl get deployment metrics-server -n kube-system &>/dev/null; then
    echo "Top pods by CPU/Memory:" | tee -a "${LOG_FILE}"
    kubectl top pods --all-namespaces --sort-by=cpu | head -10 | tee -a "${LOG_FILE}"
else
    check_warn "Metrics server not available (metrics not available)"
fi

# ============================================================================
# API Endpoint Checks
# ============================================================================

section "API Endpoint Connectivity"

# Check API Gateway health (if deployed)
if kubectl get service velya-api-gateway -n "velya-${VELYA_ENV}-core" &>/dev/null; then
    # Port forward and test
    (
        kubectl port-forward -n "velya-${VELYA_ENV}-core" \
            svc/velya-api-gateway 13000:3000 &>/dev/null &
        FORWARD_PID=$!
        sleep 2

        if curl -s http://localhost:13000/api/v1/health &>/dev/null; then
            check_pass "API Gateway /health endpoint responds"
        else
            check_warn "API Gateway /health endpoint not responding"
        fi

        kill $FORWARD_PID 2>/dev/null || true
    )
else
    check_warn "API Gateway service not available for testing"
fi

# ============================================================================
# Summary
# ============================================================================

section "Verification Summary"

echo -e "\n${GREEN}Passed: $CHECKS_PASSED${NC}" | tee -a "${LOG_FILE}"
echo -e "${YELLOW}Warnings: $CHECKS_WARNINGS${NC}" | tee -a "${LOG_FILE}"
echo -e "${RED}Failed: $CHECKS_FAILED${NC}" | tee -a "${LOG_FILE}"

if [ "$CHECKS_FAILED" -eq 0 ]; then
    echo -e "\n${GREEN}✓ Verification passed!${NC}" | tee -a "${LOG_FILE}"
    exit 0
else
    echo -e "\n${RED}✗ Verification failed! Please review the errors above.${NC}" | tee -a "${LOG_FILE}"
    exit 1
fi
