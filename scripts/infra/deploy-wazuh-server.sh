#!/bin/bash
set -euo pipefail

# ============================================
# Deploy Wazuh SIEM Server
# Provisions EC2 + configures K8s resources
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENVIRONMENT="${1:-dev}"
ACTION="${2:-plan}"

echo "=== Wazuh SIEM Server Deploy ==="
echo "Environment: $ENVIRONMENT"
echo "Action:      $ACTION"
echo ""

# Validate AWS credentials
echo "[1/5] Validating AWS credentials..."
if ! aws sts get-caller-identity &>/dev/null; then
  echo "ERROR: No valid AWS credentials found."
  echo "Configure AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or use aws sso login."
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region 2>/dev/null || echo "us-east-1")
echo "  Account: $ACCOUNT_ID"
echo "  Region:  $REGION"

# Step 1: Deploy EC2 via OpenTofu
echo ""
echo "[2/5] Running OpenTofu $ACTION for wazuh-server module..."
cd "$REPO_ROOT/infra/opentofu/live/$ENVIRONMENT"

terraform init -input=false
terraform "$ACTION" -input=false \
  -target=module.wazuh_server

if [ "$ACTION" = "plan" ]; then
  echo ""
  echo "Plan completed. Run with 'apply' to provision:"
  echo "  $0 $ENVIRONMENT apply"
  exit 0
fi

# Step 2: Get Wazuh server IP from outputs
echo ""
echo "[3/5] Retrieving Wazuh server details..."
WAZUH_IP=$(terraform output -raw wazuh_private_ip)
WAZUH_INSTANCE_ID=$(terraform output -raw wazuh_instance_id)
echo "  Private IP:  $WAZUH_IP"
echo "  Instance ID: $WAZUH_INSTANCE_ID"

# Step 3: Create secrets in AWS Secrets Manager
echo ""
echo "[4/5] Creating secrets in AWS Secrets Manager..."
AGENT_PASSWORD=$(openssl rand -base64 32)

aws secretsmanager create-secret \
  --name "velya/$ENVIRONMENT/wazuh/agent-registration-password" \
  --secret-string "$AGENT_PASSWORD" \
  --description "Wazuh agent registration password for $ENVIRONMENT" \
  --tags "Key=Project,Value=velya" "Key=Environment,Value=$ENVIRONMENT" "Key=ManagedBy,Value=opentofu" \
  2>/dev/null || \
aws secretsmanager update-secret \
  --secret-id "velya/$ENVIRONMENT/wazuh/agent-registration-password" \
  --secret-string "$AGENT_PASSWORD"

echo "  Secret created/updated: velya/$ENVIRONMENT/wazuh/agent-registration-password"

# Step 4: Update K8s ConfigMaps with real IP
echo ""
echo "[5/5] Updating Kubernetes manifests with Wazuh IP..."
WAZUH_AGENT_DIR="$REPO_ROOT/infra/kubernetes/wazuh-agent"
OBS_DIR="$REPO_ROOT/infra/kubernetes/observability"

# Update wazuh-agent configmap
sed -i "s/WAZUH_MANAGER_IP_PLACEHOLDER/$WAZUH_IP/g" "$WAZUH_AGENT_DIR/configmap.yaml"

# Update prometheus scrape config
sed -i "s/WAZUH_PRIVATE_IP/$WAZUH_IP/g" "$OBS_DIR/prometheus-wazuh-scrape.yaml"

echo "  Updated configmap.yaml with IP: $WAZUH_IP"
echo "  Updated prometheus-wazuh-scrape.yaml with IP: $WAZUH_IP"

echo ""
echo "=== Deploy Complete ==="
echo ""
echo "Next steps:"
echo "  1. Wait ~10 minutes for user-data to finish installing Wazuh"
echo "  2. Check bootstrap logs: aws ssm start-session --target $WAZUH_INSTANCE_ID"
echo "  3. Commit the updated K8s manifests (with real Wazuh IP)"
echo "  4. ArgoCD will sync the wazuh-agent DaemonSet and observability stack"
echo ""
echo "Endpoints:"
echo "  Dashboard:   https://$WAZUH_IP:443"
echo "  API:         https://$WAZUH_IP:55000"
echo "  Agent reg:   $WAZUH_IP:1514"
echo "  node_export: http://$WAZUH_IP:9100/metrics"
echo "  wazuh_exp:   http://$WAZUH_IP:9101/metrics"
