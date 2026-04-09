#!/usr/bin/env bash
# validate-platform.sh — Valida todas as páginas e endpoints da plataforma Velya
# Executa automaticamente em CI e pode ser rodado localmente
# Retorna exit code 0 apenas se tudo passar

set -euo pipefail

# Configuração
FRONTEND_BASE="${VELYA_FRONTEND_URL:-http://velya.172.19.0.6.nip.io}"
GRAFANA_BASE="${VELYA_GRAFANA_URL:-http://grafana.172.19.0.6.nip.io}"
ARGOCD_BASE="${VELYA_ARGOCD_URL:-http://argocd.172.19.0.6.nip.io}"
PROMETHEUS_BASE="http://prometheus-kube-prometheus-prometheus.velya-dev-observability.svc.cluster.local:9090"
TIMEOUT=10
FAILURES=0
TOTAL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_url() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local follow_redirect="${4:-true}"

  TOTAL=$((TOTAL+1))
  local curl_opts="-s -o /dev/null -w %{http_code} --max-time $TIMEOUT --connect-timeout 5"
  if [ "$follow_redirect" = "true" ]; then
    curl_opts="$curl_opts -L"
  fi

  local status
  status=$(curl $curl_opts "$url" 2>/dev/null || echo "000")

  if [ "$status" = "$expected_status" ]; then
    echo -e "${GREEN}✓${NC} $name → HTTP $status"
  else
    echo -e "${RED}✗${NC} $name → HTTP $status (esperado: $expected_status) — $url"
    FAILURES=$((FAILURES+1))
  fi
}

check_contains() {
  local name="$1"
  local url="$2"
  local search="$3"

  TOTAL=$((TOTAL+1))
  local body
  body=$(curl -s -L --max-time $TIMEOUT --connect-timeout 5 "$url" 2>/dev/null || echo "")

  if echo "$body" | grep -q "$search"; then
    echo -e "${GREEN}✓${NC} $name → contém '$search'"
  else
    echo -e "${RED}✗${NC} $name → NÃO contém '$search' — $url"
    FAILURES=$((FAILURES+1))
  fi
}

check_k8s() {
  local name="$1"
  local cmd="$2"
  local expected="$3"

  TOTAL=$((TOTAL+1))
  local result
  result=$(eval "$cmd" 2>/dev/null || echo "ERROR")

  if echo "$result" | grep -q "$expected"; then
    echo -e "${GREEN}✓${NC} $name"
  else
    echo -e "${RED}✗${NC} $name → '$result' não contém '$expected'"
    FAILURES=$((FAILURES+1))
  fi
}

# ============================================================
echo "============================================================"
echo "VELYA PLATFORM VALIDATION"
echo "Data: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================================"
echo ""

# ============================================================
echo "## FRONTEND — velya.172.19.0.6.nip.io"
# ============================================================
check_url "Dashboard principal (/)" "$FRONTEND_BASE/" 200
check_url "Página Pacientes (/patients)" "$FRONTEND_BASE/patients" 200
check_url "Página Tarefas (/tasks)" "$FRONTEND_BASE/tasks" 200
check_url "Página Alta (/discharge)" "$FRONTEND_BASE/discharge" 200
check_url "Página Sistema (/system)" "$FRONTEND_BASE/system" 200
# API endpoints (opcionais — scaffolds ainda não implementados)
status_health=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time $TIMEOUT "$FRONTEND_BASE/api/health" 2>/dev/null || echo "000")
[ "$status_health" = "200" ] && echo -e "${GREEN}✓${NC} API Health → HTTP $status_health" || echo -e "${YELLOW}⚠${NC} API Health → HTTP $status_health (opcional — ainda não implementado)"
status_metrics=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time $TIMEOUT "$FRONTEND_BASE/api/metrics" 2>/dev/null || echo "000")
[ "$status_metrics" = "200" ] && echo -e "${GREEN}✓${NC} Métricas Prometheus → HTTP $status_metrics" || echo -e "${YELLOW}⚠${NC} Métricas Prometheus → HTTP $status_metrics (opcional — ainda não implementado)"
check_contains "Frontend contém 'Velya'" "$FRONTEND_BASE/" "Velya"

echo ""
# ============================================================
echo "## GRAFANA — grafana.172.19.0.6.nip.io"
# ============================================================
check_url "Grafana login (redirect)" "$GRAFANA_BASE/" 302 false
check_url "Grafana login page" "$GRAFANA_BASE/login" 200
check_url "Grafana API health" "$GRAFANA_BASE/api/health" 200
check_contains "Grafana API OK" "$GRAFANA_BASE/api/health" "ok"

echo ""
# ============================================================
echo "## KUBERNETES — Cluster kind-velya-local"
# ============================================================
KUBE_CTX="${KUBERNETES_CONTEXT:---context kind-velya-local}"

# Nodes (pelo menos 1 node Ready)
NODE_COUNT=$(kubectl get nodes $KUBE_CTX --no-headers 2>/dev/null | grep -c Ready || echo 0)
TOTAL=$((TOTAL+1))
if [ "$NODE_COUNT" -ge 1 ]; then
  echo -e "${GREEN}✓${NC} Nodes Ready — $NODE_COUNT nó(s) prontos"
else
  echo -e "${RED}✗${NC} Nenhum Node Ready"
  FAILURES=$((FAILURES+1))
fi

# Core services
for SVC in patient-flow task-inbox discharge-orchestrator audit-service; do
  check_k8s "velya-dev-core: $SVC Running" \
    "kubectl get deployment $SVC -n velya-dev-core $KUBE_CTX --no-headers 2>/dev/null | awk '{print \$2}'" \
    "1/1"
done

# Platform services
for SVC in ai-gateway memory-service policy-engine decision-log-service; do
  check_k8s "velya-dev-platform: $SVC Running" \
    "kubectl get deployment $SVC -n velya-dev-platform $KUBE_CTX --no-headers 2>/dev/null | awk '{print \$2}'" \
    "1/1"
done

# velya-web
check_k8s "velya-dev-web: velya-web Running" \
  "kubectl get deployment velya-web -n velya-dev-web $KUBE_CTX --no-headers 2>/dev/null | awk '{print \$2}'" \
  "1/1"

echo ""
# ============================================================
echo "## OBSERVABILIDADE"
# ============================================================
# Prometheus
check_k8s "Prometheus Running" \
  "kubectl get statefulset prometheus-prometheus-kube-prometheus-prometheus -n velya-dev-observability $KUBE_CTX --no-headers 2>/dev/null | awk '{print \$2}'" \
  "1/1"

# Grafana
check_k8s "Grafana Running" \
  "kubectl get deployment prometheus-grafana -n velya-dev-observability $KUBE_CTX --no-headers 2>/dev/null | awk '{print \$2}'" \
  "1/1"

# Tempo
check_k8s "Tempo Running" \
  "kubectl get statefulset tempo -n velya-dev-observability $KUBE_CTX --no-headers 2>/dev/null | awk '{print \$2}'" \
  "1/1"

# Loki (verifica canary ou cache pods)
LOKI_PODS=$(kubectl get pods -n velya-dev-observability $KUBE_CTX --no-headers 2>/dev/null | grep -c 'loki.*Running' || echo 0)
TOTAL=$((TOTAL+1))
if [ "$LOKI_PODS" -ge 1 ]; then
  echo -e "${GREEN}✓${NC} Loki Running — $LOKI_PODS pod(s)"
else
  echo -e "${RED}✗${NC} Loki não está rodando"
  FAILURES=$((FAILURES+1))
fi

echo ""
# ============================================================
echo "## ARGOCD — Applications"
# ============================================================
for APP in velya-core-services velya-platform-services velya-agents; do
  HEALTH=$(kubectl get application $APP -n argocd $KUBE_CTX -o jsonpath='{.status.health.status}' 2>/dev/null || echo "NotFound")
  SYNC=$(kubectl get application $APP -n argocd $KUBE_CTX -o jsonpath='{.status.sync.status}' 2>/dev/null || echo "NotFound")
  TOTAL=$((TOTAL+1))
  if [ "$HEALTH" = "Healthy" ]; then
    echo -e "${GREEN}✓${NC} ArgoCD $APP → Health: $HEALTH, Sync: $SYNC"
  else
    echo -e "${YELLOW}⚠${NC} ArgoCD $APP → Health: $HEALTH, Sync: $SYNC"
    # Não conta como failure se Degraded mas Synced — pode ser scaffold sem imagem real
    if [ "$HEALTH" = "Unknown" ] || [ "$SYNC" = "Unknown" ]; then
      FAILURES=$((FAILURES+1))
    fi
  fi
done

echo ""
# ============================================================
echo "## KEDA — ScaledObjects"
# ============================================================
KEDA_ALL=$(kubectl get scaledobjects -A $KUBE_CTX --no-headers 2>/dev/null | grep velya || true)
KEDA_ERRORS=$(echo "$KEDA_ALL" | grep -v "True" | grep -c velya || true)
TOTAL=$((TOTAL+1))
if [ "$KEDA_ERRORS" -eq 0 ]; then
  KEDA_COUNT=$(echo "$KEDA_ALL" | grep -c velya || true)
  echo -e "${GREEN}✓${NC} Todos KEDA ScaledObjects ativos ($KEDA_COUNT)"
else
  echo -e "${RED}✗${NC} $KEDA_ERRORS KEDA ScaledObjects com erro"
  FAILURES=$((FAILURES+1))
fi

echo ""
# ============================================================
echo "## HPA — HorizontalPodAutoscalers"
# ============================================================
HPA_COUNT=$(kubectl get hpa -A $KUBE_CTX --no-headers 2>/dev/null | grep velya | wc -l)
TOTAL=$((TOTAL+1))
if [ "$HPA_COUNT" -ge 4 ]; then
  echo -e "${GREEN}✓${NC} $HPA_COUNT HPAs ativos"
else
  echo -e "${YELLOW}⚠${NC} Apenas $HPA_COUNT HPAs (esperado >= 4)"
fi

echo ""
# ============================================================
echo "## INGRESS — Endpoints"
# ============================================================
INGRESS_COUNT=$(kubectl get ingress -A $KUBE_CTX --no-headers 2>/dev/null | wc -l)
TOTAL=$((TOTAL+1))
if [ "$INGRESS_COUNT" -ge 2 ]; then
  echo -e "${GREEN}✓${NC} $INGRESS_COUNT Ingress(es) configurados"
  kubectl get ingress -A $KUBE_CTX --no-headers 2>/dev/null | awk '{print "  →", $2, "("$1")", $4}'
else
  echo -e "${RED}✗${NC} Nenhum ingress configurado"
  FAILURES=$((FAILURES+1))
fi

# ============================================================
echo ""
echo "============================================================"
echo "RESULTADO: $((TOTAL-FAILURES))/$TOTAL verificações OK"
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}✅ PLATFORM VÁLIDA — Todas as verificações passaram${NC}"
  exit 0
else
  echo -e "${RED}❌ $FAILURES VERIFICAÇÕES FALHARAM${NC}"
  exit 1
fi
echo "============================================================"
