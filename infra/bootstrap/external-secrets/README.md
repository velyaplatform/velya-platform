# External Secrets Operator

## Overview

External Secrets Operator (ESO) synchronizes secrets from AWS Secrets Manager into Kubernetes Secrets. This avoids storing sensitive values in Git.

## Prerequisites

- EKS cluster with IRSA (IAM Roles for Service Accounts) configured
- AWS Secrets Manager with secrets created under the prefix `velya/`
- IAM role with permissions to read from Secrets Manager

## Installation

### 1. Install External Secrets Operator via Helm

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace \
  --version 0.10.7 \
  --set installCRDs=true \
  --set webhook.port=9443 \
  --wait
```

### 2. Configure IAM Role

Create an IAM role with the following policy and associate it with the `external-secrets-sa` service account via IRSA:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecretVersionIds"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:velya/*"
    }
  ]
}
```

### 3. Apply ClusterSecretStore

Update the IAM role ARN in `cluster-secret-store.yaml`, then apply:

```bash
kubectl apply -f infra/bootstrap/external-secrets/cluster-secret-store.yaml
```

### 4. Verify

```bash
kubectl get clustersecretstore aws-secrets-manager
```

The status should show `Valid`.

## Usage

Create an `ExternalSecret` resource in any namespace to sync a secret:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: my-api-keys
  namespace: velya-dev-platform
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: my-api-keys
    creationPolicy: Owner
  data:
    - secretKey: api-key
      remoteRef:
        key: velya/dev/platform/api-keys
        property: api-key
```

## Secret Naming Convention

Secrets in AWS Secrets Manager should follow the pattern:

```
velya/{environment}/{component}/{secret-name}
```

Examples:
- `velya/dev/platform/api-keys`
- `velya/prod/core/database-credentials`
- `velya/staging/agents/llm-api-keys`
