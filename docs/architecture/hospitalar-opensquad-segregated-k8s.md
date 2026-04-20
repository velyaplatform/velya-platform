# Velya Hospitalar + Opensquad Segregated Kubernetes Topology

## Goal

Prepare the platform to run with hard isolation between:

- `Velya Hospitalar`: user-facing and clinical workflows
- `Opensquad`: agentic control plane, autopilot, orchestration, AI-adjacent services

The preparation in this repository favors low-cost defaults, open-source building blocks, and explicit guardrails before any AWS apply.

## Topology

### Cluster 1: Hospitalar

- EKS cluster: `velya-hospitalar-dev`
- Dedicated nodes:
  - `frontend`
  - `backend`
  - `platform`
- Workloads prepared here:
  - `velya-web`
  - `patient-flow`
  - `discharge-orchestrator`
  - `task-inbox`
  - `audit-service`
  - `decision-log-service`

### Cluster 2: Opensquad

- EKS cluster: `velya-opensquad-dev`
- Dedicated nodes:
  - `platform`
  - `ai-agents`
- Workloads prepared here:
  - `ai-gateway`
  - `memory-service`
  - `policy-engine`
  - `agent-orchestrator`
  - `velya-autopilot-*` CronJobs
  - `velya-memory-guardian`

## Open Source / Free-leaning Choices

- GitOps: ArgoCD
- Secret sync: External Secrets Operator
- Certificates: cert-manager
- Metrics and dashboards: Prometheus + Grafana
- Logs and traces: Loki + Tempo
- Event autoscaling: KEDA
- Kubernetes policy baseline: native `NetworkPolicy`, `LimitRange`, `ResourceQuota`, Pod Security Admission
- Node isolation: dedicated node groups now, Karpenter/NodePool expansion later

## Guardrails Implemented

- Private-only EKS API endpoints in the segregated OpenTofu stack
- Separate OIDC/IRSA role sets for `hospitalar` and `opensquad`
- Explicit namespace quotas and default limits per cluster
- Default-deny network policies with narrow namespace communication
- Dedicated node selection for hospital workloads vs opensquad workloads
- Placeholder secrets for autopilot are marked as placeholders and must be replaced before production use
- Single NAT Gateway in non-prod to cap shared-network cost

## Repository Paths

- Shared infra stack:
  - `infra/opentofu/live/dev-segregated`
- Hospitalar GitOps root:
  - `infra/argocd/hospitalar-dev-root.yaml`
- Opensquad GitOps root:
  - `infra/argocd/opensquad-dev-root.yaml`
- Hospitalar cluster manifests:
  - `infra/kubernetes/clusters/hospitalar-dev`
- Opensquad cluster manifests:
  - `infra/kubernetes/clusters/opensquad-dev`

## Next Steps Before Apply

1. Wire cluster-private access through VPN, SSM or bastion instead of public API endpoints.
2. Replace placeholder opensquad secrets with External Secrets backed by AWS Secrets Manager.
3. Add cluster-specific observability apps and ingress controllers per cluster.
4. Decide whether `decision-log-service` remains in Hospitalar or moves to a shared data plane.
5. Replace managed node groups with Karpenter NodePools if stronger cost ceilings are needed.
