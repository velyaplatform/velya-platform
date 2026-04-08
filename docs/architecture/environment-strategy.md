# Environment Strategy

Velya operates three environments with strict isolation, progressive promotion, and consistent naming conventions.

## Environments

### Development (dev)

- **Purpose**: Continuous integration and rapid iteration. Every merge to `main` deploys here automatically.
- **Cluster**: Shared EKS clusters (app + AI) with reduced node capacity and smaller instance types.
- **Data**: Synthetic FHIR data only. No real PHI. Database is seeded with test patients, organizations, and practitioners on each reset.
- **Scaling**: Minimum replicas (1 per service). KEDA disabled or set to conservative thresholds.
- **Access**: All engineers have full kubectl access. ArgoCD auto-syncs on every commit to `main`.
- **Secrets**: Stored in AWS Secrets Manager under the `dev/` prefix. Non-sensitive values can use Kubernetes ConfigMaps.
- **Cost controls**: Spot instances preferred. RDS uses `db.t4g.medium`. GPU nodes are on-demand but limited to 1.
- **Lifecycle**: Database can be reset weekly. No SLA guarantees.

### Staging (staging)

- **Purpose**: Pre-production validation. Release candidates are promoted here for integration testing, performance testing, and compliance verification.
- **Cluster**: Dedicated EKS clusters mirroring production topology (app + AI), but with 50% of production capacity.
- **Data**: Synthetic FHIR data generated to match production data distributions (volume, resource type mix, edge cases). Periodically refreshed from a sanitized production snapshot (all PHI removed via de-identification pipeline).
- **Scaling**: Production-equivalent replica counts but with smaller instance types. KEDA enabled with production-matching thresholds.
- **Access**: Engineers have read-only kubectl access. Deployments only via ArgoCD (auto-sync from `release/*` branches).
- **Secrets**: Stored in AWS Secrets Manager under the `staging/` prefix. Rotated on the same schedule as production.
- **Cost controls**: On-demand instances (no spot) to match production behavior. RDS uses `db.r7g.large`.
- **Lifecycle**: Persistent environment. Database preserved across deployments. Reset only during major version upgrades.

### Production (prod)

- **Purpose**: Live environment serving real users and processing real clinical data (PHI).
- **Cluster**: Dedicated EKS clusters with full capacity, multi-AZ, and all HA configurations enabled.
- **Data**: Real PHI. All access logged. All data encrypted at rest (KMS) and in transit (TLS 1.3).
- **Scaling**: Full KEDA autoscaling. Minimum 2 replicas per service for availability. HPA baselines set from load testing.
- **Access**: SRE team has kubectl access via breakglass procedure (requires MFA + approval). All access logged to CloudTrail. No direct `kubectl exec` without incident ticket.
- **Secrets**: Stored in AWS Secrets Manager under the `prod/` prefix. Rotated every 90 days. Access audited.
- **Cost controls**: Reserved Instances and Savings Plans for baseline capacity. Auto Mode handles burst with on-demand.
- **Lifecycle**: Zero-downtime deployments via rolling updates with PodDisruptionBudgets. Blue-green for major migrations.

## Isolation Strategy

### AWS Account Isolation

| Environment | AWS Account                    | Purpose                      |
| ----------- | ------------------------------ | ---------------------------- |
| dev         | `velya-dev` (111111111111)     | Development and CI workloads |
| staging     | `velya-staging` (222222222222) | Pre-production validation    |
| prod        | `velya-prod` (333333333333)    | Production workloads and PHI |

Each account has its own VPC, EKS clusters, RDS instances, and IAM boundaries. Cross-account access is denied by default. The CI/CD pipeline uses OIDC federation to assume environment-specific IAM roles.

### Network Isolation

- Each environment has its own VPC with non-overlapping CIDR ranges.
- No VPC peering between environments. Staging cannot reach production databases.
- Egress is controlled per environment: dev allows broad egress, staging mirrors production egress rules, production restricts egress to allow-listed endpoints.

### Data Isolation

- Production databases are never accessed from non-production environments.
- Staging data is either fully synthetic or de-identified via a formal pipeline.
- Dev databases use seed scripts with fictional patients (e.g., "Jane Doe", DOB 1990-01-01).
- S3 buckets are per-environment with bucket policies enforcing account-level access.

## Promotion Flow

```
  Developer          dev               staging            prod
     |                |                   |                 |
     |-- PR merge --> main                |                 |
     |                |                   |                 |
     |          auto-deploy to dev        |                 |
     |                |                   |                 |
     |          integration tests         |                 |
     |          e2e tests (Playwright)    |                 |
     |                |                   |                 |
     |          create release branch     |                 |
     |          release/v1.2.0 ---------> |                 |
     |                                    |                 |
     |                            auto-deploy to staging    |
     |                                    |                 |
     |                            load testing              |
     |                            compliance checks         |
     |                            smoke tests               |
     |                                    |                 |
     |                            tag: v1.2.0               |
     |                                    |                 |
     |                            manual ArgoCD sync -----> |
     |                                                      |
     |                                              canary rollout (10%)
     |                                              health check (15 min)
     |                                              full rollout (100%)
     |                                              post-deploy smoke
```

### Promotion Rules

1. **dev to staging**: Create a `release/vX.Y.Z` branch from `main`. ArgoCD in staging auto-syncs from release branches.
2. **staging to prod**: Tag the release branch as `vX.Y.Z`. ArgoCD in production is configured with manual sync and sync windows (business hours only, excluding maintenance windows). A designated SRE or release manager triggers the sync.
3. **Hotfix path**: For critical production issues, create a `hotfix/vX.Y.Z` branch from the production tag, apply the fix, and promote directly through staging (expedited) to production.

## Naming Conventions

### Kubernetes Resources

| Resource   | Pattern                          | Example                             |
| ---------- | -------------------------------- | ----------------------------------- |
| Namespace  | `{service}-{env}` or `{service}` | `velya-app`, `medplum`, `agents`    |
| Deployment | `{service}`                      | `patient-service`, `scheduling-api` |
| Service    | `{service}`                      | `patient-service`, `scheduling-api` |
| ConfigMap  | `{service}-config`               | `patient-service-config`            |
| Secret     | `{service}-secrets`              | `patient-service-secrets`           |
| Ingress    | `{service}-ingress`              | `patient-service-ingress`           |

### AWS Resources

| Resource        | Pattern                              | Example                                            |
| --------------- | ------------------------------------ | -------------------------------------------------- |
| RDS Instance    | `velya-{service}-{env}`              | `velya-medplum-prod`, `velya-temporal-staging`     |
| S3 Bucket       | `velya-{purpose}-{env}-{account-id}` | `velya-fhir-blobs-prod-333333333333`               |
| KMS Key Alias   | `alias/velya-{purpose}-{env}`        | `alias/velya-rds-prod`, `alias/velya-s3-staging`   |
| Secrets Manager | `{env}/{service}/{secret-name}`      | `prod/medplum/database-url`, `dev/nats/auth-token` |
| IAM Role        | `velya-{service}-{env}-role`         | `velya-patient-service-prod-role`                  |
| ECR Repository  | `velya/{service}`                    | `velya/patient-service`, `velya/scheduling-api`    |

### DNS

| Environment | Domain Pattern                   | Example                                        |
| ----------- | -------------------------------- | ---------------------------------------------- |
| dev         | `{service}.dev.velya.health`     | `api.dev.velya.health`, `app.dev.velya.health` |
| staging     | `{service}.staging.velya.health` | `api.staging.velya.health`                     |
| prod        | `{service}.velya.health`         | `api.velya.health`, `app.velya.health`         |

### Container Images

Images are tagged with the Git SHA and optionally a semantic version:

```
{account-id}.dkr.ecr.{region}.amazonaws.com/velya/{service}:{git-sha}
{account-id}.dkr.ecr.{region}.amazonaws.com/velya/{service}:v{semver}
```

ArgoCD always deploys by Git SHA tag to ensure immutability. Semantic version tags are aliases for human readability.

## Environment Parity

To minimize "works in staging but not in prod" issues, the following parity rules apply:

1. **Same Kubernetes version** across all environments (currently 1.31).
2. **Same Helm chart versions** for all infrastructure components (NATS, Temporal, ArgoCD, Prometheus stack).
3. **Same container images** promoted through the pipeline (built once, deployed to all environments).
4. **Same network policies** in staging and prod (dev is relaxed for debugging).
5. **Same OpenTofu modules** with environment-specific `.tfvars` files for sizing and capacity.
