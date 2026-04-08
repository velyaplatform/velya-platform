#!/bin/bash
set -euo pipefail

export AWS_ENDPOINT_URL="http://localhost:4566"
export AWS_ACCESS_KEY_ID="test"
export AWS_SECRET_ACCESS_KEY="test"
export AWS_DEFAULT_REGION="us-east-1"
alias aws="aws --endpoint-url $AWS_ENDPOINT_URL"

ok()  { echo "  ✓ $1"; }
hdr() { echo ""; echo "━━━ $1 ━━━"; }

# ─── KMS ──────────────────────────────────────────────────────────────────────
hdr "KMS"
KMS_KEY_ID=$(aws kms create-key \
  --description "velya-dev master key" \
  --tags TagKey=Project,TagValue=velya TagKey=Environment,TagValue=dev \
  --query 'KeyMetadata.KeyId' --output text)
aws kms create-alias --alias-name alias/velya-dev --target-key-id "$KMS_KEY_ID" 2>/dev/null || true
ok "master key: alias/velya-dev ($KMS_KEY_ID)"

# ─── S3 ───────────────────────────────────────────────────────────────────────
hdr "S3 Buckets"
for bucket in \
  velya-dev-assets \
  velya-dev-logs \
  velya-dev-backups \
  velya-dev-state \
  velya-dev-fhir-exports \
  velya-dev-ml-artifacts \
  velya-dev-audit-archive; do
  aws s3api create-bucket --bucket "$bucket" --region us-east-1 2>/dev/null || true
  aws s3api put-bucket-versioning --bucket "$bucket" \
    --versioning-configuration Status=Enabled 2>/dev/null || true
  ok "$bucket"
done

# ─── SQS ──────────────────────────────────────────────────────────────────────
hdr "SQS Queues"
declare -A QUEUES=(
  ["velya-clinical-patient-events"]="clinical domain events"
  ["velya-clinical-patient-events-dlq"]="clinical DLQ"
  ["velya-billing-claims"]="billing claims"
  ["velya-billing-claims-dlq"]="billing DLQ"
  ["velya-ai-agent-tasks"]="AI agent task dispatch"
  ["velya-ai-agent-tasks-dlq"]="AI agent DLQ"
  ["velya-notifications"]="notification dispatch"
  ["velya-audit-events"]="audit trail"
  ["velya-discharge-workflow"]="discharge workflow events"
)
for queue in "${!QUEUES[@]}"; do
  if [[ "$queue" == *"-dlq" ]]; then
    aws sqs create-queue --queue-name "$queue" \
      --attributes MessageRetentionPeriod=1209600 \
      --tags Project=velya,Environment=dev 2>/dev/null || true
  else
    DLQ_ARN=$(aws sqs get-queue-attributes \
      --queue-url "http://localhost:4566/000000000000/${queue}-dlq" \
      --attribute-names QueueArn \
      --query 'Attributes.QueueArn' --output text 2>/dev/null || echo "")
    if [ -n "$DLQ_ARN" ]; then
      aws sqs create-queue --queue-name "$queue" \
        --attributes "RedrivePolicy={\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":\"5\"},VisibilityTimeout=30" \
        --tags Project=velya,Environment=dev 2>/dev/null || true
    else
      aws sqs create-queue --queue-name "$queue" \
        --attributes VisibilityTimeout=30,MessageRetentionPeriod=86400 \
        --tags Project=velya,Environment=dev 2>/dev/null || true
    fi
  fi
  ok "$queue"
done

# ─── SNS ──────────────────────────────────────────────────────────────────────
hdr "SNS Topics"
for topic in \
  velya-clinical-alerts \
  velya-billing-notifications \
  velya-system-alerts \
  velya-agent-notifications; do
  aws sns create-topic --name "$topic" \
    --tags Key=Project,Value=velya Key=Environment,Value=dev 2>/dev/null || true
  ok "$topic"
done

# ─── DynamoDB ─────────────────────────────────────────────────────────────────
hdr "DynamoDB Tables"
# Temporal workflow state
aws dynamodb create-table \
  --table-name velya-temporal-executions \
  --attribute-definitions AttributeName=workflow_id,AttributeType=S AttributeName=run_id,AttributeType=S \
  --key-schema AttributeName=workflow_id,KeyType=HASH AttributeName=run_id,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=velya Key=Environment,Value=dev 2>/dev/null || true
ok "velya-temporal-executions"

# Feature flags
aws dynamodb create-table \
  --table-name velya-feature-flags \
  --attribute-definitions AttributeName=flag_name,AttributeType=S \
  --key-schema AttributeName=flag_name,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=velya Key=Environment,Value=dev 2>/dev/null || true
ok "velya-feature-flags"

# Agent scorecards
aws dynamodb create-table \
  --table-name velya-agent-scorecards \
  --attribute-definitions AttributeName=agent_id,AttributeType=S AttributeName=date,AttributeType=S \
  --key-schema AttributeName=agent_id,KeyType=HASH AttributeName=date,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=velya Key=Environment,Value=dev 2>/dev/null || true
ok "velya-agent-scorecards"

# Session cache
aws dynamodb create-table \
  --table-name velya-session-cache \
  --attribute-definitions AttributeName=session_id,AttributeType=S \
  --key-schema AttributeName=session_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=velya Key=Environment,Value=dev 2>/dev/null || true
ok "velya-session-cache"

# ─── SECRETS MANAGER ──────────────────────────────────────────────────────────
hdr "Secrets Manager"
declare -A SECRETS=(
  ["velya/dev/database/postgres"]='{"host":"localhost","port":5432,"username":"velya","password":"velya-dev-password","database":"velya_dev"}'
  ["velya/dev/medplum/credentials"]='{"clientId":"velya-medplum-client","clientSecret":"medplum-secret-dev","baseUrl":"http://localhost:8103"}'
  ["velya/dev/anthropic/api-key"]='{"api_key":"sk-ant-placeholder-dev"}'
  ["velya/dev/nats/credentials"]='{"url":"nats://localhost:4222","user":"velya","password":"nats-dev-password"}'
  ["velya/dev/temporal/credentials"]='{"address":"localhost:7233","namespace":"velya-dev"}'
  ["velya/dev/jwt/signing-key"]='{"secret":"velya-jwt-dev-secret-min-32-chars-long","algorithm":"HS256","expiry":"24h"}'
)
for name in "${!SECRETS[@]}"; do
  aws secretsmanager create-secret \
    --name "$name" \
    --secret-string "${SECRETS[$name]}" \
    --tags Key=Project,Value=velya Key=Environment,Value=dev 2>/dev/null || \
  aws secretsmanager update-secret \
    --secret-id "$name" \
    --secret-string "${SECRETS[$name]}" 2>/dev/null || true
  ok "$name"
done

# ─── SSM PARAMETER STORE ──────────────────────────────────────────────────────
hdr "SSM Parameters"
declare -A PARAMS=(
  ["/velya/dev/app/log-level"]="INFO"
  ["/velya/dev/app/environment"]="development"
  ["/velya/dev/app/region"]="us-east-1"
  ["/velya/dev/nats/cluster-url"]="nats://localhost:4222"
  ["/velya/dev/medplum/base-url"]="http://localhost:8103"
  ["/velya/dev/temporal/address"]="localhost:7233"
  ["/velya/dev/temporal/namespace"]="velya-dev"
  ["/velya/dev/ai-gateway/model"]="claude-sonnet-4-6"
  ["/velya/dev/ai-gateway/max-tokens"]="4096"
  ["/velya/dev/feature-flags/ai-triage"]="false"
  ["/velya/dev/feature-flags/ai-discharge"]="false"
)
for path in "${!PARAMS[@]}"; do
  aws ssm put-parameter \
    --name "$path" \
    --value "${PARAMS[$path]}" \
    --type String \
    --overwrite \
    --tags Key=Project,Value=velya Key=Environment,Value=dev 2>/dev/null || true
  ok "$path"
done

# ─── ECR ──────────────────────────────────────────────────────────────────────
hdr "ECR Repositories"
for repo in \
  velya/clinical-intake \
  velya/billing-claims \
  velya/ai-gateway \
  velya/agent-orchestrator \
  velya/frontend \
  velya/medplum-bot; do
  aws ecr create-repository \
    --repository-name "$repo" \
    --image-scanning-configuration scanOnPush=true \
    --tags Key=Project,Value=velya Key=Environment,Value=dev 2>/dev/null || true
  ok "$repo"
done

# ─── RDS ──────────────────────────────────────────────────────────────────────
hdr "RDS PostgreSQL"
aws rds create-db-instance \
  --db-instance-identifier velya-dev-postgres \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version "15.4" \
  --master-username velya \
  --master-user-password "velya-dev-password" \
  --allocated-storage 20 \
  --db-name velya_dev \
  --tags Key=Project,Value=velya Key=Environment,Value=dev 2>/dev/null || true
ok "velya-dev-postgres (postgres 15)"

# ─── ELASTICACHE ──────────────────────────────────────────────────────────────
hdr "ElastiCache (Redis)"
aws elasticache create-cache-cluster \
  --cache-cluster-id velya-dev-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --tags Key=Project,Value=velya Key=Environment,Value=dev 2>/dev/null || true
ok "velya-dev-redis"

# ─── COGNITO ──────────────────────────────────────────────────────────────────
hdr "Cognito User Pool"
POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name velya-dev-users \
  --auto-verified-attributes email \
  --schema Name=email,Required=true Name=name,Required=true \
  --query 'UserPool.Id' --output text 2>/dev/null || echo "")
if [ -n "$POOL_ID" ]; then
  ok "user pool: $POOL_ID"
  CLIENT_ID=$(aws cognito-idp create-user-pool-client \
    --user-pool-id "$POOL_ID" \
    --client-name velya-dev-app \
    --no-generate-secret \
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
    --query 'UserPoolClient.ClientId' --output text 2>/dev/null || echo "")
  ok "app client: $CLIENT_ID"
  aws ssm put-parameter --name "/velya/dev/cognito/user-pool-id" --value "$POOL_ID" --type String --overwrite 2>/dev/null || true
  aws ssm put-parameter --name "/velya/dev/cognito/client-id" --value "$CLIENT_ID" --type String --overwrite 2>/dev/null || true
fi

# ─── CLOUDWATCH LOGS ──────────────────────────────────────────────────────────
hdr "CloudWatch Log Groups"
for lg in \
  /velya/dev/clinical-intake \
  /velya/dev/billing-claims \
  /velya/dev/ai-gateway \
  /velya/dev/agent-orchestrator \
  /velya/dev/frontend \
  /velya/dev/audit; do
  aws logs create-log-group --log-group-name "$lg" \
    --tags Project=velya,Environment=dev 2>/dev/null || true
  aws logs put-retention-policy --log-group-name "$lg" --retention-in-days 7 2>/dev/null || true
  ok "$lg"
done

# ─── IAM ──────────────────────────────────────────────────────────────────────
hdr "IAM Roles"
TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
for role in \
  velya-dev-clinical-task-role \
  velya-dev-billing-task-role \
  velya-dev-ai-gateway-task-role \
  velya-dev-agent-orchestrator-task-role; do
  aws iam create-role \
    --role-name "$role" \
    --assume-role-policy-document "$TRUST" \
    --tags Key=Project,Value=velya Key=Environment,Value=dev 2>/dev/null || true
  ok "$role"
done

# ─── STEP FUNCTIONS ───────────────────────────────────────────────────────────
hdr "Step Functions (Temporal simulation)"
ROLE_ARN=$(aws iam get-role --role-name velya-dev-clinical-task-role --query 'Role.Arn' --output text 2>/dev/null || echo "arn:aws:iam::000000000000:role/velya-dev-clinical-task-role")
aws stepfunctions create-state-machine \
  --name velya-dev-patient-discharge \
  --definition '{"Comment":"Patient discharge workflow","StartAt":"ValidateDischarge","States":{"ValidateDischarge":{"Type":"Pass","Next":"NotifyTeam"},"NotifyTeam":{"Type":"Pass","End":true}}}' \
  --role-arn "$ROLE_ARN" \
  --tags key=Project,value=velya key=Environment,value=dev 2>/dev/null || true
ok "velya-dev-patient-discharge"

# ─── FEATURE FLAGS (seed DynamoDB) ───────────────────────────────────────────
hdr "Seeding Feature Flags"
declare -A FLAGS=(
  ["velya.clinical.ai-triage"]="false"
  ["velya.clinical.ai-discharge"]="false"
  ["velya.billing.ai-coding"]="false"
  ["velya.platform.new-auth"]="false"
)
for flag in "${!FLAGS[@]}"; do
  aws dynamodb put-item \
    --table-name velya-feature-flags \
    --item "{
      \"flag_name\": {\"S\": \"$flag\"},
      \"enabled\": {\"BOOL\": ${FLAGS[$flag]}},
      \"owner\": {\"S\": \"platform-team\"},
      \"created_at\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
    }" 2>/dev/null || true
  ok "$flag = ${FLAGS[$flag]}"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Velya LocalStack Pro bootstrap completo!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
