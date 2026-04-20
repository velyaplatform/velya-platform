# Velya Kubernetes Segregation Status

Generated: 2026-04-14T17:40:00Z

## Summary

- Parallel preparation completed for a hard split between:
  - `Velya Hospitalar`
  - `Opensquad / Autopilot`
- No AWS apply was executed for this track
- No new cloud cost was created in this track
- The work is currently repository-only: IaC, GitOps roots, Kubernetes manifests, and guardrails

## Prepared Topology

- Shared VPC, two private EKS clusters:
  - `velya-hospitalar-dev`
  - `velya-opensquad-dev`
- Hospital cluster keeps user-facing and clinical workloads
- Opensquad cluster keeps AI-adjacent services, agent orchestration, autopilot CronJobs, and memory guardian
- Both clusters are prepared with separate IRSA role sets

## Main Deliverables

- Dual-cluster OpenTofu stack:
  - `infra/opentofu/live/dev-segregated`
- Cluster-aware module updates:
  - `infra/opentofu/modules/vpc`
  - `infra/opentofu/modules/eks`
  - `infra/opentofu/modules/iam`
- Hospital GitOps root:
  - `infra/argocd/hospitalar-dev-root.yaml`
- Opensquad GitOps root:
  - `infra/argocd/opensquad-dev-root.yaml`
- Hospital cluster manifests:
  - `infra/kubernetes/clusters/hospitalar-dev`
- Opensquad cluster manifests:
  - `infra/kubernetes/clusters/opensquad-dev`
- Architecture note:
  - `docs/architecture/hospitalar-opensquad-segregated-k8s.md`

## Workload Split

### Hospitalar Cluster

- `velya-web`
- `patient-flow`
- `discharge-orchestrator`
- `task-inbox`
- `audit-service`
- `decision-log-service`

### Opensquad Cluster

- `ai-gateway`
- `memory-service`
- `policy-engine`
- `agent-orchestrator`
- `velya-autopilot-*`
- `velya-memory-guardian`

## Security and Cost Guardrails Prepared

- Private-only EKS endpoints in the segregated stack
- Default-deny namespace policies per cluster
- Pod Security Admission labels on managed namespaces
- `LimitRange` and `ResourceQuota` per namespace
- Dedicated node placement:
  - Hospital workloads pinned to `frontend` and `backend`
  - Opensquad workloads pinned to `ai` and `platform`
- Tolerations for isolated opensquad platform/AI workloads
- Placeholder secrets explicitly marked as placeholders in opensquad cluster
- Single NAT Gateway in non-prod to cap baseline cost

## Validation Completed

- `kubectl kustomize --load-restrictor=LoadRestrictionsNone infra/kubernetes/clusters/hospitalar-dev` succeeded
- `kubectl kustomize --load-restrictor=LoadRestrictionsNone infra/kubernetes/clusters/opensquad-dev` succeeded
- YAML output was inspected to confirm:
  - hospital workloads render with `nodeSelector` on `frontend` / `backend`
  - opensquad services render with `nodeSelector` on `ai`
  - autopilot CronJobs render with `nodeSelector` on `platform`
  - opensquad CronJobs render with `ttlSecondsAfterFinished: 900`

## Validation Blocked

- `terraform validate` / `tofu validate` for `infra/opentofu/live/dev-segregated` could not be fully executed on this machine because:
  - installed `terraform` is `1.4.2`
  - repo requires `>= 1.9`
  - `tofu` is not installed locally

## Important Notes

- Existing docs already accept the two-cluster direction:
  - `docs/adr/0009-two-cluster-architecture.md`
  - `docs/architecture/agent-cluster-strategy.md`
- This implementation is a repository preparation layer only
- Karpenter/NodePool design remains mostly documentary at this stage; the concrete repo implementation prepared here uses managed node groups with hard placement, which is the lower-risk stepping stone before full NodePool rollout

## What Is Not Automated Yet

- This segregation track is not yet part of the automatic orchestration sync loop
- The current automatic sync covers:
  - Lincesoc AWS migration
  - agent coordination snapshot / dashboard visibility
- A dedicated sync for this topology-prep track still needs to be added if we want the dashboard and shared handoff to update this track automatically

## Next Safe Steps

1. Install `OpenTofu` or `Terraform >= 1.9` on the operator machine
2. Run `init` and `validate` in `infra/opentofu/live/dev-segregated`
3. Decide whether `decision-log-service` remains in hospital cluster or becomes shared data plane
4. Replace opensquad placeholder secrets with External Secrets backed by AWS Secrets Manager
5. Add cluster-specific observability, ingress, and ArgoCD bootstrap per cluster
6. Only after validation, run `plan` for the segregated stack
