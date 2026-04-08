# IAM Model

> Identity and Access Management strategy for the Velya platform. This document covers human access, service-to-service authentication, agent identity, and the principle of least privilege across all layers.

---

## Principles

1. **No static credentials.** No AWS access keys or secret keys are stored anywhere in the platform. All access uses short-lived, automatically rotated credentials.
2. **Least privilege by default.** Every identity receives only the permissions it needs for its specific function. Permissions are granted per-service, per-environment.
3. **Namespace-scoped where possible.** Prefer Kubernetes Roles and RoleBindings over ClusterRoles and ClusterRoleBindings. Only platform-level operators (ArgoCD, External Secrets Operator, cert-manager) use ClusterRoles.
4. **Auditable.** Every access to AWS resources, Kubernetes API, and sensitive data is logged and traceable to a specific identity.
5. **Zero standing access.** Production access is granted just-in-time and revoked automatically. No permanent production credentials.
6. **Separation of duties.** No single identity can both make and approve a change.

---

## Identity Types

### Human Users

Human users authenticate via an identity provider (IdP) using OIDC/SAML.

| Attribute | Value |
|---|---|
| Authentication | OIDC with MFA (hardware key preferred) |
| Session duration | 1 hour access token, 8 hour refresh token |
| Provider | Organization IdP (Okta/Azure AD) via AWS IAM Identity Center |
| Production access | Just-in-time via access request workflow |

**Roles**:

| Role | Scope | Typical Assignment |
|---|---|---|
| `platform-admin` | Full platform access (break-glass only) | SRE leads, on-call escalation |
| `developer` | Read access to non-prod, deploy to dev | All engineers |
| `operator` | Read access to prod, deploy to staging | SRE, DevOps |
| `security-reviewer` | Read access to all environments, security tooling | Security team |
| `auditor` | Read-only access to logs, configs, and audit trails | Compliance team |
| `viewer` | Read-only access to dashboards and non-sensitive data | Product, design |

### Service Accounts (Kubernetes)

Each microservice runs with a dedicated Kubernetes service account. Service accounts are scoped to a single namespace.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: velya-patient-flow
  namespace: velya-prod-core
  annotations:
    eks.amazonaws.com/pod-identity-association: "true"
automountServiceAccountToken: false  # unless Kubernetes API access is needed
```

**Rules**:
- One service account per service per namespace.
- No service uses the `default` ServiceAccount.
- `automountServiceAccountToken: false` by default. Only set to `true` when the pod needs Kubernetes API access.
- Service account names match the service name.

### Pod Identity (AWS)

EKS Pod Identity is the primary mechanism for granting AWS access to Kubernetes workloads. It replaces IRSA (IAM Roles for Service Accounts) for all new workloads.

**How It Works**:

1. Each service has a dedicated Kubernetes ServiceAccount in its namespace.
2. The ServiceAccount is associated with a Pod Identity Association that maps it to a specific IAM role.
3. The IAM role has an inline or managed policy scoped to exactly the AWS resources the service needs.
4. The EKS Pod Identity Agent (runs as a DaemonSet on every node) intercepts AWS SDK calls from the pod and provides temporary credentials from STS.

**Pod Identity Association Example**:

```yaml
apiVersion: eks.amazonaws.com/v1alpha1
kind: PodIdentityAssociation
metadata:
  name: velya-patient-flow
  namespace: velya-prod-core
spec:
  serviceAccount: velya-patient-flow
  roleArn: arn:aws:iam::ACCOUNT:role/velya-prod-patient-flow
```

### IAM Role Per Service

| Service | IAM Role | Permissions |
|---|---|---|
| patient-flow | `velya-patient-flow-{env}-role` | RDS read/write (own database only), S3 read/write (`velya-patient-docs-{env}/*`) |
| medplum | `velya-medplum-{env}-role` | RDS read/write (Medplum database), S3 read/write (FHIR binary storage bucket) |
| discharge-orchestrator | `velya-discharge-orch-{env}-role` | RDS read/write (discharge database), SES send email (notifications) |
| bed-management | `velya-bed-mgmt-{env}-role` | RDS read/write (bed database) |
| agent-runtime | `velya-agent-runtime-{env}-role` | Bedrock InvokeModel, S3 read (agent configs), Secrets Manager read (`{env}/agents/*`) |
| external-secrets | `velya-eso-{env}-role` | Secrets Manager read/write (`{env}/*`), KMS decrypt (secrets encryption key) |
| argocd | `velya-argocd-{env}-role` | ECR pull, S3 read (Helm charts if applicable) |

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
      "Resource": "arn:aws:rds-db:us-east-1:ACCOUNT:dbuser:*/patient_flow"
    },
    {
      "Sid": "AllowOwnSecretsAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:prod/patient-flow/*"
      ]
    },
    {
      "Sid": "AllowOwnS3Prefix",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::velya-patient-docs-prod/*"
    }
  ]
}
```

**Prohibited**:
- No wildcard (`*`) resource ARNs in production IAM policies
- No `iam:*` or `s3:*` action wildcards
- No shared IAM roles across services

### Agent Identity

Agents are authenticated as service principals with scoped API tokens managed by the agent orchestrator.

| Attribute | Value |
|---|---|
| Identity | Registered in agent registry with unique agent ID |
| Authentication | Scoped API token issued by agent orchestrator |
| Token lifetime | 1 hour, auto-renewed |
| Permissions | Per-agent tool access manifest |
| Rate limits | Per-agent rate limits enforced at AI Gateway |

Agent permissions are defined in the agent's tool access manifest:

```yaml
agentId: security-office-reviewer-agent
tools:
  - name: code-search
    access: read-only
    scope: "**/*"
  - name: file-read
    access: read-only
    scope: "**/*"
  - name: pr-comment
    access: write
    scope: own-reviews
  - name: pr-approve
    access: write
    scope: own-reviews
    constraint: "cannot approve own PRs"
```

**Agent identity rules**:
- Each agent gets a unique service account in Kubernetes
- Agent tokens are scoped to the agent's office and tools
- Agent-to-AWS access goes through the agent-runtime IAM role, further scoped by agent ID at the application layer
- Tool usage is logged with agent ID for audit

### CI/CD Identity

GitHub Actions authenticates to AWS via OIDC federation. No long-lived access keys.

```yaml
permissions:
  id-token: write   # Required for OIDC
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502  # v4.0.2
    with:
      role-to-assume: arn:aws:iam::ACCOUNT:role/velya-ci-deploy
      aws-region: us-east-1
```

CI roles are scoped per workflow:

| Workflow | Role | Permissions |
|---|---|---|
| CI (lint, test, build) | `velya-ci-build` | ECR push, S3 artifact upload |
| Deploy to dev | `velya-ci-deploy-dev` | EKS describe, Helm deploy to dev namespace |
| Deploy to staging | `velya-ci-deploy-staging` | EKS describe, Helm deploy to staging namespace |
| Deploy to prod | `velya-ci-deploy-prod` | EKS describe, Helm deploy to prod namespace (requires approval) |
| Security scan | `velya-ci-security` | ECR image scan, CodeQL access |

---

## Kubernetes RBAC

### ClusterRoles (Platform Only)

ClusterRoles are reserved for platform-level operators that need cross-namespace access:

| ClusterRole | Bound To | Justification |
|---|---|---|
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
  name: velya-patient-flow
  namespace: velya-prod-core
rules:
  - apiGroups: [""]
    resources: ["configmaps", "secrets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]
```

### Human Access by Environment

| Namespace Pattern | Developer Access | Operator Access | Admin Access |
|---|---|---|---|
| `velya-dev-*` | Read + port-forward + exec | Full | Full |
| `velya-staging-*` | Read only | Read + deploy | Full |
| `velya-prod-*` | No access (JIT only) | Read only (JIT) | Full (JIT, break-glass) |

---

## Application-Level RBAC

The Velya application uses role-based access control for clinical users:

| Role | Description | Access |
|---|---|---|
| `physician` | Attending physician | Full read/write on own patients, read on unit census |
| `nurse` | Registered nurse | Read/write on assigned patients, read on unit census |
| `case-manager` | Discharge planner | Read/write on discharge workflows, read on all unit patients |
| `charge-nurse` | Unit operations | Full read/write on unit patients and beds |
| `bed-manager` | Hospital-wide beds | Full read/write on bed assignments across units |
| `admin` | Command center | Read-only on all data, manage configurations |

**Constraints**:
- Users can only access patients at facilities they are credentialed for.
- PHI access is logged per HIPAA requirements (access audit trail).
- Role assignments are managed by facility administrators, not self-service.
- Break-glass access is available for emergency situations, with mandatory post-access review.

---

## Break-Glass Procedure for Production

1. Engineer creates an incident or change request ticket.
2. Engineer requests elevated access via the access management tool (e.g., AWS SSO temporary elevation or PagerDuty-triggered access grant).
3. Access is granted for a time-limited window (maximum 4 hours).
4. All actions during the elevated session are logged to CloudTrail and Kubernetes audit logs.
5. Access is automatically revoked when the window expires.
6. Post-incident review documents what was accessed and why.

Break-glass access is monitored in real-time. The Security Office is notified immediately when break-glass is activated.

---

## Access Reviews

### Quarterly Access Review

Every quarter, the Identity & Access Office conducts a review:

1. **Enumerate** all human users with active access
2. **Verify** each user still requires their assigned role
3. **Remove** access for users who have changed roles or left
4. **Review** service account permissions for scope creep
5. **Audit** break-glass access usage
6. **Report** findings to the Chief Security Director

### Automated Checks

- Unused service accounts (no API calls in 90 days) are flagged for removal
- IAM policies with overly broad permissions are flagged by AWS Access Analyzer
- Kubernetes RBAC bindings are compared against the approved role matrix
- Agent permissions are compared against their tool access manifests

---

## Prohibited Practices

- No shared AWS accounts or credentials.
- No long-lived kubeconfig files with embedded tokens.
- No `kubectl exec` in production without an associated incident ticket.
- No IAM users with console passwords for service access (use IAM roles and SSO only).
- No wildcard (`*`) resource ARNs in production IAM policies.
- No shared cross-service IAM roles.
- No hardcoded AWS account IDs in policies (use variables).
