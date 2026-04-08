# Infrastructure Rules

## OpenTofu (IaC)

- **OpenTofu is the only tool for cloud provisioning.** VPC, EKS, ECR, RDS, IAM, Route53, ACM -- all declarative.
- No Terraform. We use OpenTofu (the open-source fork).
- State stored in S3 with DynamoDB locking. One state file per module per environment.
- Modules live in `infra/tofu/modules/`. Environment configs in `infra/tofu/envs/{dev,staging,prod}/`.
- Pin provider versions in `required_providers`. No floating version constraints.
- Run `tofu plan` in CI on every PR. Apply only after approval and merge.
- No `terraform_remote_state` data sources. Use SSM Parameter Store for cross-stack references.

## ArgoCD (GitOps)

- **ArgoCD manages all in-cluster resources.** No `kubectl apply` in production.
- Application manifests live in `infra/argocd/`.
- Use the App of Apps pattern for environment promotion.
- Sync policy: auto-sync for dev, manual sync for staging and prod.
- Health checks required for all ArgoCD Applications.
- Prune orphaned resources automatically in dev, require approval in prod.

## EKS Configuration

- **EKS Auto Mode preferred.** Let AWS manage node groups, scaling, and AMI updates.
- Kubernetes version pinned. Upgrade on a defined schedule, never auto-upgrade.
- Use managed add-ons for CoreDNS, kube-proxy, VPC CNI, EBS CSI.
- Pod Identity over IRSA for new workloads.
- Control plane logging enabled: api, audit, authenticator.

## Helm Charts

- Charts stored in `infra/helm/charts/`.
- Each chart has clear value overlays per environment: `values-dev.yaml`, `values-staging.yaml`, `values-prod.yaml`.
- No in-line values in ArgoCD Application specs. Always reference value files.
- Pin chart versions in `Chart.lock`. Run `helm dependency update` explicitly.
- Use `helm template` in CI to validate rendered manifests.

## Resource Management

- **Resource requests and limits are mandatory** on every container.
  ```yaml
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      memory: 256Mi
      # CPU limits: omit unless there is a specific reason to throttle
  ```
- **PodDisruptionBudgets required** for all critical workloads. Minimum `minAvailable: 1` or `maxUnavailable: 1`.
- HorizontalPodAutoscaler for stateless services with variable load.
- Set `topologySpreadConstraints` for HA across availability zones.

## Environments

| Environment | Purpose | Sync Policy | Approval |
|---|---|---|---|
| `dev` | Development and integration testing | Auto-sync | None |
| `staging` | Pre-production validation | Manual sync | Team lead |
| `prod` | Production | Manual sync | Two reviewers |

- Dev may use smaller instance types and single-AZ.
- Staging mirrors prod topology at reduced scale.
- Prod is multi-AZ, with PDBs, autoscaling, and monitoring.

## Tagging

All AWS resources must have these tags:

```hcl
tags = {
  Project     = "velya"
  Environment = var.environment     # dev | staging | prod
  ManagedBy   = "opentofu"
  Owner       = var.team            # team responsible
  CostCenter  = var.cost_center
}
```

No untagged resources. Tag enforcement via AWS Config rules.

## Prohibited Practices

- No manual console changes. If it is not in Git, it does not exist.
- No `kubectl apply` or `helm install` against staging or prod outside of ArgoCD.
- No hardcoded AWS account IDs. Use data sources or variables.
- No public S3 buckets. No public RDS instances. No public EKS API endpoints.
- No `0.0.0.0/0` in security group ingress rules except for load balancers serving public traffic.
