# ADR-0013: ResourceQuota scopeSelector Constraint for Kind Local Clusters

## Status

Accepted

## Date

2026-04-08

## Context

The tier isolation bootstrap manifest (`infra/bootstrap/tier-isolation/resource-quotas-by-tier.yaml`) defines ResourceQuotas for four namespaces: `velya-dev-core` (frontend, backend), `velya-dev-platform`, and `velya-dev-agents`.

The original manifests for `frontend-tier-quota`, `backend-tier-quota`, and `ai-agents-tier-quota` included a `scopeSelector` that scoped all resources to pods running under the `default` PriorityClass:

```yaml
scopeSelector:
  matchExpressions:
    - operator: In
      scopeName: PriorityClass
      values: ['default']
```

This caused all three quotas to be rejected by the Kubernetes API server with:

```
ResourceQuota "frontend-tier-quota" is invalid: spec.scopeSelector.matchExpressions:
Invalid value: ...: unsupported scope applied to resource
```

Two root causes:

1. **Kubernetes restriction**: `scopeSelector` with `PriorityClass` scope only governs pod-level compute resources (`pods`, `cpu`, `memory`, `requests.*`, `limits.*`). It cannot be applied to `services`, `services.loadbalancers`, or `persistentvolumeclaims`. The quotas mixed both resource types under the same scope selector.
2. **Missing PriorityClass**: The `default` PriorityClass does not exist in a vanilla kind cluster. Only `system-cluster-critical` and `system-node-critical` are present by default.

The failure was silent during `kubectl apply` — the PDBs and `platform-tier-quota` (which had no scopeSelector) were created successfully, while the three invalid quotas were silently dropped.

## Decision

Remove `scopeSelector` from `frontend-tier-quota`, `backend-tier-quota`, and `ai-agents-tier-quota`.

All quota limits apply namespace-wide, regardless of PriorityClass. This is the correct behavior for local development where:

- No custom PriorityClasses are defined.
- Tier isolation is enforced via node labels, taints, and tolerations — not PriorityClass.
- The `scopeSelector` added complexity with no practical benefit for the local dev topology.

If per-priority-class quota enforcement is needed in the future (e.g., to protect high-priority clinical workloads from being starved by batch agents), it must be implemented as a separate quota object that governs only compute resources (`pods`, `cpu`, `memory`) and only after the required PriorityClass resources are defined in the cluster.

## Consequences

### Positive

- All four ResourceQuotas apply successfully on a fresh kind cluster.
- The bootstrap is idempotent: re-running `kubectl apply` does not error.
- Quota enforcement is transparent — all namespaced resources count toward limits.

### Negative

- No per-priority-class quota differentiation. High-priority pods and batch pods consume from the same quota pool.

### Neutral

- The `platform-tier-quota` never had a `scopeSelector` (it governs PVCs which cannot be scoped by PriorityClass), so it was unaffected.

## References

- [Kubernetes ResourceQuota Scopes](https://kubernetes.io/docs/concepts/policy/resource-quotas/#resource-quota-per-priorityclass)
- `infra/bootstrap/tier-isolation/resource-quotas-by-tier.yaml`
