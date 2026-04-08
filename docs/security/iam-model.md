# IAM Model

This document defines the identity and access management strategy for the Velya platform. All AWS access from Kubernetes workloads, CI/CD pipelines, and human operators follows these patterns.

## Principles

1. **No static credentials.** No AWS access keys or secret keys are stored anywhere in the platform. All access uses short-lived, automatically rotated credentials.
2. **Least privilege by default.** Every identity receives only the permissions it needs for its specific function. Permissions are granted per-service, per-environment.
3. **Namespace-scoped where possible.** Prefer Kubernetes Roles and RoleBindings over ClusterRoles and ClusterRoleBindings. Only platform-level operators (ArgoCD, External Secrets Operator, cert-manager) use ClusterRoles.
4. **Auditable.** Every access to AWS resources, Kubernetes API, and sensitive data is logged and traceable to a specific identity.

## Pod Identity for AWS Access

EKS Pod Identity is the primary mechanism for granting AWS access to Kubernetes workloads. It replaces IRSA (IAM Roles for Service Accounts) for all new workloads.

### How It Works

1. Each service has a dedicated Kubernetes ServiceAccount in its namespace.
2. The ServiceAccount is annotated with a Pod Identity Association that maps it to a specific IAM role.
3. The IAM role has an inline or managed policy scoped to exactly the AWS resources the service needs.
4. The EKS Pod Identity Agent (runs as a DaemonSet on every node) intercepts AWS SDK calls from the pod and provides temporary credentials from STS.

### IAM Role Per Service

| Service | IAM Role | Permissions |
|---------|----------|-------------|
| patient-service | `velya-patient-service-{env}-role` | RDS read/write (own database only), S3 read/write (`velya-patient-docs-{env}/*`) |
| medplum | `velya-medplum-{env}-role` | RDS read/write (Medplum database), S3 read/write (FHIR binary storage bucket) |
| scheduling-api | `velya-scheduling-{env}-role` | RDS read/write (scheduling database), SES send email (appointment notifications) |
| billing-service | `velya-billing-{env}-role` | RDS read/write (billing database), S3 read/write (claim attachments) |
| agent-runtime | `velya-agent-runtime-{env}-role` | Bedrock InvokeModel, S3 read (agent configs), Secrets Manager read (`{env}/agents/*`) |
| external-secrets | `velya-eso-{env}-role` | Secrets Manager read/write (`{env}/*`), KMS decrypt (secrets encryption key) |
| argocd | `velya-argocd-{env}-role` | ECR pull, S3 read (Helm charts if applicable) |

### Pod Identity Association Example

```yaml
apiVersion: eks.amazonaws.com/v1alpha1
kind: PodIdentityAssociation
metadata:
  name: patient-service
  namespace: velya-app
spec:
  serviceAccount: patient-service
  roleArn: arn:aws:iam::role/velya-patient-service-prod-role
```

### IAM Policy Example

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowOwnDatabaseAccess",
      "Effect": "Allow",
      "Action": [
        "rds-db:connect"
      ],
      "Resource": "arn:aws:rds-db:us-east-1:*:dbuser:*/patient_service"
    },
    {
      "Sid": "AllowOwnS3Prefix",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::velya-patient-docs-prod/*"
    }
  ]
}
```

## Kubernetes RBAC

### ClusterRoles (Platform Only)

ClusterRoles are reserved for platform-level operators that need cross-namespace access. These are defined in `infra/helm/charts/` and managed by ArgoCD.

| ClusterRole | Bound To | Justification |
|-------------|----------|---------------|
| `argocd-application-controller` | ArgoCD ServiceAccount | Manages applications across all namespaces |
| `external-secrets-controller` | ESO ServiceAccount | Creates Secrets in all service namespaces |
| `cert-manager-controller` | cert-manager ServiceAccount | Manages certificates across namespaces |
| `kube-prometheus-stack` | Prometheus ServiceAccount | Scrapes metrics from all namespaces |

### Namespace-Scoped Roles (Services)

Each service namespace has Roles and RoleBindings that grant the minimum permissions needed.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: patient-service
  namespace: velya-app
rules:
  - apiGroups: [""]
    resources: ["configmaps", "secrets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]
```

### Service Accounts

Every service has its own Kubernetes ServiceAccount. No service uses the `default` ServiceAccount.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: patient-service
  namespace: velya-app
  annotations:
    eks.amazonaws.com/pod-identity-association: "true"
automountServiceAccountToken: false  # unless Kubernetes API access is needed
```

`automountServiceAccountToken: false` is the default. Only services that explicitly need Kubernetes API access (operators, controllers) set it to `true`.

## Human Access

### Day-to-Day Access

- Engineers authenticate to AWS via SSO (IAM Identity Center) with MFA enforced.
- Kubernetes access is via OIDC integration. Short-lived tokens are issued by the identity provider.
- Dev environment: engineers have `edit` ClusterRole access for debugging.
- Staging environment: engineers have `view` ClusterRole access (read-only). Deployments happen through ArgoCD only.
- Production environment: no standing access. All access requires breakglass.

### Break-Glass Procedure for Production

1. Engineer creates an incident or change request ticket in the ticketing system.
2. Engineer requests elevated access via the access management tool (e.g., AWS SSO temporary elevation or a PagerDuty-triggered access grant).
3. Access is granted for a time-limited window (maximum 4 hours).
4. All actions during the elevated session are logged to CloudTrail and Kubernetes audit logs.
5. Access is automatically revoked when the window expires.
6. Post-incident review documents what was accessed and why.

### Prohibited Practices

- No shared AWS accounts or credentials.
- No long-lived kubeconfig files with embedded tokens.
- No `kubectl exec` in production without an associated incident ticket.
- No IAM users with console passwords for service access (use IAM roles and SSO only).
- No wildcard (`*`) resource ARNs in production IAM policies.

## CI/CD Identity

GitHub Actions authenticates to AWS using OIDC federation. No static credentials are stored in GitHub Secrets.

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502  # v4.0.2
    with:
      role-to-assume: arn:aws:iam::role/velya-ci-deploy-role
      aws-region: us-east-1
```

The CI IAM role is scoped to:
- ECR push (to push built images)
- S3 read/write (OpenTofu state)
- DynamoDB read/write (OpenTofu state locking)
- EKS describe (for ArgoCD sync triggers)
