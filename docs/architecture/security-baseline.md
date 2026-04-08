# Security Baseline

This document defines the security baseline for the Velya platform. All services, infrastructure, and agents must comply with these requirements. The baseline is designed to satisfy HIPAA Security Rule, SOC 2 Type II, and healthcare industry best practices.

## Principles

1. **Least Privilege**: Every identity (human, service, pod, agent) receives the minimum permissions required for its function.
2. **Defense in Depth**: Security controls are layered; no single control failure exposes the system.
3. **Zero Trust Networking**: No implicit trust based on network location; all service-to-service communication is authenticated and encrypted.
4. **Auditability**: Every access to PHI, every configuration change, and every deployment is logged and traceable.
5. **Shift Left**: Security checks run in CI before code reaches any environment.

## Identity & Access Management

### Human Access

- All human access to AWS is via SSO (AWS IAM Identity Center) with MFA enforced.
- Kubernetes access is via OIDC integration with the identity provider. No long-lived kubeconfig tokens.
- Production kubectl access requires breakglass approval (PagerDuty or Jira ticket) and is time-limited (4 hours).
- All kubectl commands in production are logged to CloudTrail via EKS audit logging.

### Service Identity (Pod Identity)

- Every Kubernetes pod that accesses AWS services uses EKS Pod Identity (preferred) or IRSA (IAM Roles for Service Accounts).
- No AWS access keys or secret keys are stored in Kubernetes Secrets or environment variables.
- IAM policies are scoped to the specific resources a service needs:
  - The patient service can read/write its own RDS database and its own S3 prefix. It cannot access Temporal's database.
  - The FHIR server (Medplum) has access to its dedicated RDS instance and S3 bucket for binary storage. It cannot access KMS keys used by other services.

### Agent Identity

- Each AI agent runs with a dedicated Kubernetes ServiceAccount bound to a restricted IAM role.
- Agent IAM roles allow access only to the AI inference endpoints and the NATS subjects defined in the agent's configuration.
- Agents cannot directly access RDS databases or S3 buckets containing PHI. All clinical data access flows through the FHIR API with SMART on FHIR authorization.

## Secrets Management

### Storage

- All secrets are stored in AWS Secrets Manager, organized by environment prefix (`dev/`, `staging/`, `prod/`).
- Secrets are synced into Kubernetes using External Secrets Operator (ESO). ESO polls Secrets Manager every 60 seconds and reconciles Kubernetes Secrets.
- Kubernetes Secrets are encrypted at rest using the EKS-managed KMS envelope encryption (AWS-managed key or customer-managed CMK for production).

### Rotation

| Secret Type | Rotation Period | Method |
|------------|-----------------|--------|
| Database passwords | 90 days | AWS Secrets Manager automatic rotation with Lambda |
| NATS auth tokens | 90 days | Manual rotation with coordinated service restart |
| API keys (external) | 90 days | Manual rotation; tracked in secret metadata |
| TLS certificates | Auto-renewed | cert-manager with Let's Encrypt; 60-day renewal |
| Service account tokens | Auto-renewed | Kubernetes bound service account tokens (1 hour TTL) |

### Prohibited Practices

- Never commit secrets to Git (enforced by pre-commit hooks scanning for high-entropy strings and known patterns).
- Never pass secrets via environment variables in CI logs (use masked variables in GitHub Actions).
- Never store secrets in ConfigMaps; always use Kubernetes Secrets synced from Secrets Manager.
- Never use shared secrets across environments; each environment has its own secret instances.

## Network Security

### Network Policies

Every namespace has a default-deny NetworkPolicy. Services must explicitly declare their ingress and egress rules.

```yaml
# Default deny all ingress and egress for the namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: velya-app
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

Service-specific policies allow only the required communication paths:

```yaml
# Patient service: allow ingress from API gateway, egress to PostgreSQL and NATS
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: patient-service
  namespace: velya-app
spec:
  podSelector:
    matchLabels:
      app: patient-service
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api-gateway
      ports:
        - port: 3000
          protocol: TCP
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: nats
          namespaceSelector:
            matchLabels:
              name: nats
      ports:
        - port: 4222
          protocol: TCP
    - to:
        - ipBlock:
            cidr: 10.0.0.0/16  # RDS endpoint within VPC
      ports:
        - port: 5432
          protocol: TCP
```

### TLS Everywhere

- All external traffic terminates TLS at the ALB with ACM-managed certificates.
- All internal service-to-service traffic uses mTLS via service mesh or application-level TLS.
- NATS connections use TLS with client certificate authentication.
- PostgreSQL connections require TLS (`sslmode=verify-full`).
- Minimum TLS version: 1.2. Preferred: 1.3.

### Egress Control

- Production pods cannot reach the public internet by default.
- Egress is allowed only to: AWS service endpoints (via VPC endpoints), approved external APIs (allow-listed in network policy by FQDN via egress proxy), and cross-cluster NLB endpoints.
- The AI/Agents cluster has broader egress rules for agent tool use, but all outbound traffic is logged and routed through an egress proxy for monitoring.

## Container Security

### Image Security

- All container images are built from a hardened base image (`node:22-slim` for Node.js, `distroless` where feasible).
- Images are scanned by Trivy in the CI pipeline. Builds fail on critical or high vulnerabilities with a known fix.
- Only images from the private ECR registry are allowed in production (enforced by OPA Gatekeeper admission policy).
- Image tags are immutable; once pushed, a tag cannot be overwritten (ECR image tag immutability enabled).

### SBOM & Supply Chain

- Every container image has a CycloneDX SBOM generated by Syft during the CI build.
- SBOMs are stored in ECR alongside the image (OCI artifact attachment).
- Grype scans the SBOM for known vulnerabilities. Results are published to the security dashboard in Grafana.
- Dependency updates are managed by Renovate Bot with auto-merge for patch updates and PR creation for minor/major updates.

### Pod Security

OPA Gatekeeper enforces the following pod security constraints in production:

| Constraint | Enforcement |
|-----------|-------------|
| No privileged containers | Deny `securityContext.privileged: true` |
| No root user | Require `runAsNonRoot: true` |
| Read-only root filesystem | Require `readOnlyRootFilesystem: true` |
| No host networking | Deny `hostNetwork: true` |
| No host PID/IPC | Deny `hostPID: true`, `hostIPC: true` |
| Drop all capabilities | Require `drop: ["ALL"]` |
| Resource limits required | Deny pods without CPU and memory limits |
| Approved image registries | Allow only `{account-id}.dkr.ecr.{region}.amazonaws.com/velya/*` |
| No latest tag | Deny `image: *:latest` |

## Data Protection

### Encryption at Rest

| Data Store | Encryption Method | Key Management |
|-----------|-------------------|----------------|
| RDS PostgreSQL | AES-256 via AWS KMS | Customer-managed CMK per environment |
| S3 Buckets | SSE-S3 (default) or SSE-KMS for PHI buckets | Customer-managed CMK for PHI |
| EBS Volumes | AES-256 via AWS KMS | AWS-managed key (Auto Mode default) |
| NATS JetStream | File store on encrypted EBS | Inherited from EBS encryption |
| OpenTofu State | OpenTofu native state encryption | Dedicated KMS key |
| Kubernetes Secrets | EKS envelope encryption | AWS-managed or customer-managed KMS key |

### Encryption in Transit

- All external: TLS 1.2+ (prefer 1.3)
- All internal: mTLS or application-level TLS
- Database connections: `sslmode=verify-full` with RDS CA certificate
- NATS: TLS with nkeys authentication

### PHI Handling

- PHI is stored only in Medplum (FHIR server) and its backing PostgreSQL database.
- Application services access PHI only through the FHIR API with SMART on FHIR scopes.
- PHI is never logged. Structured logging redacts fields matching PHI patterns (SSN, MRN, DOB, name when associated with clinical context).
- PHI is never stored in NATS messages. Events contain FHIR resource references (e.g., `Patient/123`) not resource contents.

## Audit & Compliance

### Audit Logging

| Source | Destination | Retention |
|--------|-------------|-----------|
| Kubernetes API audit logs | CloudWatch Logs + S3 | 365 days |
| Application access logs | Loki + S3 | 365 days |
| FHIR AuditEvent resources | Medplum (FHIR store) | 7 years |
| AWS CloudTrail | S3 (dedicated audit bucket) | 365 days |
| ArgoCD sync events | ArgoCD + Loki | 365 days |
| Database query logs (slow queries) | CloudWatch Logs | 90 days |

### Compliance Controls

- HIPAA Security Rule: Technical safeguards implemented via encryption, access controls, audit logging, and transmission security as documented above.
- SOC 2 Type II: Controls mapped to Trust Services Criteria (Security, Availability, Confidentiality). Evidence collected via CloudTrail, Kubernetes audit logs, and ArgoCD deployment records.
- HITRUST CSF: Assessment planned after initial production launch; controls aligned with HITRUST categories during design.

## Incident Response

- Security incidents are classified by severity (P1-P4) and routed via PagerDuty.
- P1 (active breach or PHI exposure): Immediate response, all hands. Isolate affected systems. Notify HIPAA Privacy Officer within 1 hour.
- P2 (vulnerability with active exploit): Patch within 24 hours. Assess exposure.
- P3 (vulnerability without known exploit): Patch within 7 days.
- P4 (informational): Track and remediate in next sprint.
- Post-incident reviews are mandatory for P1 and P2 incidents.
