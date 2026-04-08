# Secrets Management Model

> This document defines how secrets are stored, distributed, rotated, and audited across the Velya platform. AWS Secrets Manager is the source of truth. External Secrets Operator syncs secrets into Kubernetes. No other path is permitted.

---

## Architecture Overview

```
+---------------------+     poll/sync      +----------------------+
| AWS Secrets Manager  | <----------------> | External Secrets     |
| (Source of Truth)    |    (60s interval)  | Operator (ESO)       |
+---------------------+                     +----------+-----------+
                                                       |
                                                       | creates/updates
                                                       v
                                            +----------------------+
                                            | Kubernetes Secrets    |
                                            | (encrypted at rest    |
                                            |  via KMS envelope)    |
                                            +----------+-----------+
                                                       |
                                              mounted as files
                                                       |
                                                       v
                                            +----------------------+
                                            | Application Pods      |
                                            | (read from filesystem)|
                                            +----------------------+
```

---

## AWS Secrets Manager as Source of Truth

All secrets originate in AWS Secrets Manager. No secret is created directly as a Kubernetes Secret or injected via any other path.

### Organization

Secrets are organized by environment prefix and service name:

```
{env}/{service}/{secret-name}
```

Examples:

```
prod/patient-flow/database-url
prod/nats/auth-token
prod/discharge-orchestrator/database-password
staging/bed-management/database-url
dev/agent-runtime/anthropic-api-key
dev/ai-gateway/openai-api-key
```

### Metadata

Every secret in Secrets Manager includes the following metadata tags:

| Tag                | Purpose                                  | Example                                                   |
| ------------------ | ---------------------------------------- | --------------------------------------------------------- |
| `Environment`      | Which environment this secret belongs to | `prod`                                                    |
| `Service`          | Which service consumes this secret       | `velya-patient-flow`                                      |
| `Owner`            | Team or individual responsible           | `platform-team`                                           |
| `RotationSchedule` | How often this secret rotates            | `90-days`                                                 |
| `LastRotated`      | Date of last rotation                    | `2026-03-15`                                              |
| `ManagedBy`        | How this secret is managed               | `opentofu` or `manual`                                    |
| `Sensitivity`      | Classification level                     | `high` (credentials), `medium` (API keys), `low` (config) |

### Creating Secrets

Secrets are provisioned via OpenTofu whenever possible:

```hcl
resource "aws_secretsmanager_secret" "patient_flow_db" {
  name        = "${var.environment}/patient-flow/database-url"
  description = "PostgreSQL connection URL for patient-flow service"

  tags = {
    Environment      = var.environment
    Service          = "velya-patient-flow"
    Owner            = "platform-team"
    RotationSchedule = "90-days"
    ManagedBy        = "opentofu"
    Sensitivity      = "high"
  }
}

resource "aws_secretsmanager_secret_version" "patient_flow_db" {
  secret_id     = aws_secretsmanager_secret.patient_flow_db.id
  secret_string = var.patient_flow_db_url  # Set via secure CI variable
}
```

---

## External Secrets Operator (ESO)

ESO runs in the `velya-platform` namespace and has a ClusterSecretStore configured per environment pointing to the correct AWS Secrets Manager in the corresponding AWS account.

### ClusterSecretStore

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        podIdentity:
          provider: eks
```

### ExternalSecret Example

Each service declares the secrets it needs via an ExternalSecret resource, typically templated in the service's Helm chart:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: velya-patient-flow-secrets
  namespace: velya-prod-core
spec:
  refreshInterval: 60s
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: velya-patient-flow-secrets
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: prod/patient-flow/database-url
    - secretKey: NATS_AUTH_TOKEN
      remoteRef:
        key: prod/nats/auth-token
```

### Sync Behavior

- ESO polls Secrets Manager every 60 seconds by default (`refreshInterval: 60s`).
- When a secret value changes in Secrets Manager, ESO updates the Kubernetes Secret on the next poll.
- Pods that mount the secret as a volume see the updated value automatically (kubelet syncs mounted secrets periodically).
- Pods that read secrets from environment variables require a restart to pick up changes. For this reason, prefer mounted files.

---

## Secret Delivery to Applications

### Preferred: Volume Mounts

Secrets are mounted as files in the pod's filesystem. The application reads secrets from the file path at startup or on-demand.

```yaml
volumes:
  - name: secrets
    secret:
      secretName: velya-patient-flow-secrets
containers:
  - name: velya-patient-flow
    volumeMounts:
      - name: secrets
        mountPath: /etc/secrets
        readOnly: true
```

The application reads `/etc/secrets/DATABASE_URL` at startup. This approach allows the kubelet to update the file in-place when the secret rotates, and the application can watch for file changes to reload configuration without a restart.

### When Environment Variables Are Acceptable

Environment variables are acceptable for secrets that:

- Are consumed by third-party software that only reads environment variables (e.g., some database drivers).
- Are consumed at container startup and do not change during the pod's lifetime.

When using environment variables, always source them from a Kubernetes Secret reference, never from a ConfigMap or hard-coded value:

```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: velya-patient-flow-secrets
        key: DATABASE_URL
```

---

## Secret Rotation

### Automated Rotation (Database Passwords)

Database passwords are rotated automatically using AWS Secrets Manager's native rotation with a Lambda function.

1. Secrets Manager triggers the rotation Lambda on the configured schedule (every 90 days).
2. The Lambda creates a new password, updates it in the RDS instance, and stores the new value in Secrets Manager.
3. ESO detects the change on its next poll and updates the Kubernetes Secret.
4. Pods using volume mounts see the new password via kubelet sync.
5. Pods using environment variables are gracefully restarted by a rotation controller or rolling deployment.

### Semi-Automated Rotation (API Keys, Tokens)

For secrets that cannot be rotated automatically (third-party API keys, NATS auth tokens):

1. The new credential is generated or obtained from the external provider.
2. The new value is stored in Secrets Manager via CLI or OpenTofu.
3. ESO syncs the new value to Kubernetes.
4. A coordinated rolling restart is performed for affected services.
5. The old credential is revoked after confirming all services are using the new one.

### Rotation Schedule

| Secret Type                       | Rotation Period                | Automation Level                                   |
| --------------------------------- | ------------------------------ | -------------------------------------------------- |
| RDS database passwords            | 90 days                        | Fully automated (Secrets Manager + Lambda)         |
| NATS auth tokens                  | 90 days                        | Semi-automated (manual generation, automated sync) |
| External API keys (LLM providers) | 90 days or per provider policy | Manual with tracked process                        |
| TLS certificates                  | 60 days before expiry          | Fully automated (cert-manager + Let's Encrypt)     |
| K8s ServiceAccount tokens         | 1 hour TTL                     | Fully automated (bound SA tokens)                  |
| Encryption keys (KMS)             | Annual                         | AWS-managed automatic rotation                     |
| Agent API tokens                  | 1 hour TTL                     | Fully automated (agent orchestrator)               |

---

## Audit Trail for Secret Access

### AWS Secrets Manager Access Logs

All access to Secrets Manager is logged via CloudTrail. Each log entry includes:

- Who accessed the secret (IAM role ARN)
- Which secret was accessed (secret ARN)
- What operation was performed (GetSecretValue, PutSecretValue, RotateSecret)
- When the access occurred (timestamp)
- Source IP address

### Kubernetes Secret Access Logs

Kubernetes audit logging captures all access to Secret resources:

- Reading secrets via the API (`kubectl get secret`)
- Mounting secrets in pods (recorded in pod creation audit events)
- Modifications to ExternalSecret resources

### Alerting

Alerts fire for:

- Unexpected access to production secrets from non-production IAM roles.
- Secrets that have not been rotated within their scheduled rotation window.
- Failed rotation attempts.
- Bulk secret reads (potential exfiltration).
- Any `GetSecretValue` call from an unrecognized IAM role.

---

## Secret Categories

| Category              | Examples                            | Encryption | Access Scope              |
| --------------------- | ----------------------------------- | ---------- | ------------------------- |
| Database credentials  | Connection strings, passwords       | KMS CMK    | Single service            |
| API keys              | LLM provider keys, third-party APIs | KMS CMK    | Specific service or agent |
| Authentication tokens | NATS tokens, JWT signing keys       | KMS CMK    | Platform services         |
| TLS certificates      | Service certs, CA certs             | KMS CMK    | Ingress, service mesh     |
| Encryption keys       | Data-at-rest keys                   | KMS CMK    | Specific service          |
| Agent tokens          | Agent API tokens                    | KMS CMK    | Individual agents         |

---

## Prohibited Practices

- Never create Kubernetes Secrets manually with `kubectl create secret`. All secrets flow through ESO from Secrets Manager.
- Never store secrets in ConfigMaps. ConfigMaps are not encrypted by default and are visible to anyone with namespace read access.
- Never hard-code secrets in Dockerfiles, Helm values, or application code.
- Never pass secrets as command-line arguments (visible in process listings).
- Never log secret values. Application logging must redact any field that could contain a secret.
- Never share secrets across environments. Each environment (`dev/`, `staging/`, `prod/`) has its own secret instances with different values.
- Never use the same password or token for multiple services. Each service gets unique credentials for its dependencies.
- Never commit `.env` files. Use `.env.example` with placeholder values only.
