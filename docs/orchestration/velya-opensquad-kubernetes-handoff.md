# Velya + Opensquad Kubernetes Handoff

Updated: 2026-04-15

This is the canonical execution handoff for future sessions on any machine.
When the task is to deploy, migrate, or bootstrap `Velya Hospitalar` and
`Opensquad` on Kubernetes, load this file first and use it as the default plan.

## Target topology

- Hard split into two private EKS clusters in the same VPC:
  - `velya-hospitalar-dev`
  - `velya-opensquad-dev`
- Infrastructure is declarative only:
  - OpenTofu for AWS resources
  - ArgoCD for GitOps sync
  - Kubernetes manifests via Kustomize
- No public EKS API exposure
- No secrets committed to git
- No console drift

## Workload split

### Hospitalar cluster

- `velya-web`
- `patient-flow`
- `discharge-orchestrator`
- `task-inbox`
- `audit-service`
- `decision-log-service`

Placement prepared in manifests:

- `velya-dev-web` -> `velya.io/tier=frontend`
- `velya-dev-core` -> `velya.io/tier=backend`
- `velya-dev-platform` -> `velya.io/tier=backend`

Namespaces:

- `velya-dev-web`
- `velya-dev-core`
- `velya-dev-platform`
- `velya-dev-observability`

### Opensquad cluster

- `opensquad-dashboard`
- `ai-gateway`
- `memory-service`
- `policy-engine`
- `agent-orchestrator`
- `velya-autopilot-*` CronJobs
- `velya-memory-guardian`

Placement prepared in manifests:

- AI/platform Deployments -> `velya.io/tier=ai`
- Agent Deployments -> `velya.io/tier=ai`
- CronJobs -> `velya.io/tier=platform`
- CronJobs -> `ttlSecondsAfterFinished: 900`

Namespaces:

- `argocd`
- `velya-dev-web`
- `velya-dev-core`
- `velya-dev-platform`
- `velya-dev-agents`
- `velya-dev-observability`

## Canonical source files

Architecture and intent:

- `docs/adr/0009-two-cluster-architecture.md`
- `docs/architecture/hospitalar-opensquad-segregated-k8s.md`
- `docs/orchestration/velya-k8s-segregation-status-2026-04-14.md`

Infra and GitOps:

- `infra/opentofu/live/dev-segregated/main.tf`
- `infra/opentofu/live/dev-segregated/terraform.tfvars`
- `infra/argocd/hospitalar-dev-root.yaml`
- `infra/argocd/opensquad-dev-root.yaml`

Cluster manifests:

- `infra/kubernetes/clusters/hospitalar-dev/kustomization.yaml`
- `infra/kubernetes/clusters/opensquad-dev/kustomization.yaml`

## Safe execution order on a new machine

1. Verify the repo and toolchain.
   Required minimums:
   - `tofu` preferred, or `terraform >= 1.9`
   - `kubectl`
   - `aws`
   - `git`
   - `helm` if cluster bootstrap is needed
2. Validate manifest rendering before touching AWS:

```bash
kubectl kustomize --load-restrictor=LoadRestrictionsNone infra/kubernetes/clusters/hospitalar-dev
kubectl kustomize --load-restrictor=LoadRestrictionsNone infra/kubernetes/clusters/opensquad-dev
```

3. Validate the segregated infra stack:

```bash
cd infra/opentofu/live/dev-segregated
tofu init
tofu validate
tofu plan
```

4. Only after a clean plan, apply the segregated stack from
   `infra/opentofu/live/dev-segregated`.
5. Configure access to both private clusters through VPN, SSM, or bastion.
   Do not open public cluster endpoints as a shortcut.
6. Bootstrap ArgoCD separately in each cluster.
7. Apply the corresponding GitOps roots:
   - Hospitalar cluster -> `infra/argocd/hospitalar-dev-root.yaml`
   - Opensquad cluster -> `infra/argocd/opensquad-dev-root.yaml`
8. Replace Opensquad placeholder secrets with External Secrets backed by
   AWS Secrets Manager before any real workload rollout.
9. Validate:
   - namespaces
   - node placement
   - NetworkPolicies
   - quotas and limits
   - ArgoCD sync health
   - service probes and ingress reachability

## Required guardrails

- Keep the two-cluster boundary. Do not collapse Hospitalar and Opensquad into
  one cluster.
- Keep EKS endpoints private.
- Use separate IRSA/Secrets Manager paths for `hospitalar` and `opensquad`.
- Use pinned image tags only. Never use `latest`.
- Maintain default-deny network policies, `LimitRange`, and `ResourceQuota`.
- Do not replace GitOps with ad hoc `kubectl apply` drift.

## Current status

- Repository preparation is already present.
- The split was documented on 2026-04-14.
- `kubectl kustomize` validation succeeded for both clusters on the previous
  operator pass.
- No AWS apply was executed for this split on this machine.
- Full infra validation on this machine was blocked because local Terraform was
  too old and OpenTofu was not installed.

## What still needs real execution

- Install or use a machine with `OpenTofu` or `Terraform >= 1.9`
- Run `init`, `validate`, and `plan` in `infra/opentofu/live/dev-segregated`
- Apply the dual-cluster AWS stack
- Bootstrap ArgoCD in both clusters
- Replace placeholder Opensquad secrets with External Secrets
- Decide whether `decision-log-service` remains hospital-only or becomes a
  shared data-plane service

## Scope note

This handoff is specifically for the `Velya Hospitalar + Opensquad` Kubernetes
target state inside `velya-platform`. Treat this as separate from any Lince SOC
deployment tracks unless the task explicitly asks to combine them.
