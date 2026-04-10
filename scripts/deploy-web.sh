#!/usr/bin/env bash
# deploy-web.sh — Build, carrega e deploya velya-web no cluster kind
# Uso: bash scripts/deploy-web.sh [--skip-validate]
#
# Etapas:
#   1. Build da imagem Docker (monorepo context)
#   2. Load no kind
#   3. Rollout restart do deployment
#   4. Aguarda rollout
#   5. Validação pós-deploy (validate-platform.sh)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLUSTER_NAME="${KIND_CLUSTER_NAME:-velya-local}"
KUBE_CTX="${KUBERNETES_CONTEXT:---context kind-${CLUSTER_NAME}}"
SKIP_VALIDATE="${1:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TAG="$(git -C "$REPO_ROOT" rev-parse --short HEAD)-$(date -u +%Y%m%d-%H%M%S)"
IMAGE="velya-web:${TAG}"

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  VELYA-WEB DEPLOY PIPELINE${NC}"
echo -e "${BLUE}  Tag: ${TAG}${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

# Step 1: Build
echo -e "${YELLOW}[1/5]${NC} Building Docker image..."
cd "$REPO_ROOT"
docker build -f apps/web/Dockerfile -t "$IMAGE" -t "velya-web:latest" . 2>&1 | tail -3
echo -e "${GREEN}✅ Build concluído: ${IMAGE}${NC}"
echo ""

# Step 2: Load into kind
echo -e "${YELLOW}[2/5]${NC} Loading image into kind cluster '${CLUSTER_NAME}'..."
kind load docker-image "$IMAGE" --name "$CLUSTER_NAME" 2>&1 | tail -2
echo -e "${GREEN}✅ Image carregada no cluster${NC}"
echo ""

# Step 3: Update deployment image and restart
# IMPORTANT: container is named "web" inside the velya-web deployment.
# Failing silently here means no rollout happens — make this strict.
echo -e "${YELLOW}[3/5]${NC} Atualizando deployment velya-web (container=web)..."
CONTAINER_NAME="$(kubectl get deployment velya-web -n velya-dev-web $KUBE_CTX -o jsonpath='{.spec.template.spec.containers[0].name}')"
if [ -z "$CONTAINER_NAME" ]; then
  echo -e "${RED}❌ Não foi possível ler o nome do container do deployment velya-web${NC}"
  exit 1
fi
echo "    container detectado: $CONTAINER_NAME"
kubectl set image deployment/velya-web "${CONTAINER_NAME}=${IMAGE}" -n velya-dev-web $KUBE_CTX
echo -e "${GREEN}✅ Deployment atualizado${NC}"
echo ""

# Step 4: Wait for rollout
echo -e "${YELLOW}[4/5]${NC} Aguardando rollout..."
kubectl rollout status deployment/velya-web -n velya-dev-web $KUBE_CTX --timeout=120s
echo -e "${GREEN}✅ Rollout concluído${NC}"
echo ""

# Step 5: Validate
if [ "$SKIP_VALIDATE" = "--skip-validate" ]; then
  echo -e "${YELLOW}[5/5]${NC} Validação pulada (--skip-validate)"
else
  echo -e "${YELLOW}[5/5]${NC} Executando validação pós-deploy..."
  bash "$SCRIPT_DIR/validate-platform.sh"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  DEPLOY COMPLETO: ${IMAGE}${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
