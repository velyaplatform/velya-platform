# Agent Cluster Strategy

## Overview

The AI/Agents Cluster is the dedicated EKS cluster that hosts all AI inference, embedding generation, and autonomous agent workloads. It is physically and logically separated from the App Cluster to ensure failure independence, dedicated resource management, and distinct security postures. This document describes the strategy for operating, scaling, and governing the agent cluster.

## Isolation from App Cluster

The two clusters share a single VPC but are otherwise independent:

- **Separate EKS control planes**: Each cluster has its own Kubernetes API server, etcd, and scheduler. A failure in the agent cluster control plane does not affect the app cluster.
- **Separate node pools**: The agent cluster uses GPU-capable instances (g5, g6, p4d) provisioned by Karpenter. The app cluster uses Graviton ARM64 instances. There is no shared compute.
- **Separate ArgoCD instances**: Each cluster has its own GitOps operator. A bad manifest deployed to the agent cluster cannot affect app cluster workloads.
- **Separate monitoring stacks**: Each cluster runs its own Prometheus and OpenTelemetry Collector, federated to a central Grafana for unified dashboards.

## Communication Patterns

All cross-cluster communication uses two mechanisms. No direct pod-to-pod networking exists between clusters.

### Asynchronous: NATS JetStream Replication

NATS runs in both clusters. JetStream source/mirror streams replicate events across the cluster boundary:

| Direction    | Example Subject                        | Purpose                                            |
| ------------ | -------------------------------------- | -------------------------------------------------- |
| App to Agent | `clinical.patient.admitted`            | Trigger agent workflows on clinical events         |
| App to Agent | `agents.tasks.{agent-name}.assigned`   | Assign tasks to specific agents                    |
| Agent to App | `agents.{agent-name}.output.completed` | Deliver agent results back to application services |
| Agent to App | `agents.escalation.human-review`       | Route decisions requiring human approval           |

Agents must tolerate eventual consistency in event delivery. Message ordering is guaranteed within a single stream but not across streams.

### Synchronous: Internal NLB

For request-reply patterns (e.g., a service requesting an AI completion), an internal Network Load Balancer exposes the ai-gateway in the agent cluster. Traffic flows over VPC private networking with mTLS. The app cluster never connects directly to model servers; all synchronous AI access routes through the ai-gateway.

## Failure Independence

The agent cluster is designed so that its failure does not degrade core clinical operations:

- **Graceful degradation**: When the agent cluster is unavailable, application services continue to function. Features powered by agents (automated documentation, coding suggestions) show a "temporarily unavailable" state.
- **Circuit breakers**: The app cluster uses circuit breakers on NLB connections to the agent cluster. After repeated failures, the circuit opens and requests fail fast rather than timing out.
- **Event buffering**: NATS JetStream on the app cluster buffers events destined for agents. When the agent cluster recovers, it processes the backlog from the replicated stream.
- **No PHI dependency**: The agent cluster does not store primary clinical data. All PHI resides in the app cluster's RDS instances. Agent cluster loss means loss of AI capability, not loss of data.

## Resource Management for Inference Workloads

### Node Provisioning

Karpenter provisioners on the agent cluster define three node classes:

| Node Class      | Instance Types                   | Purpose                            | Scaling                                      |
| --------------- | -------------------------------- | ---------------------------------- | -------------------------------------------- |
| `gpu-inference` | g5.xlarge, g5.2xlarge, g6.xlarge | LLM inference serving              | Scale based on request queue depth           |
| `gpu-embedding` | g5.xlarge                        | Embedding model serving            | Scale based on embedding queue depth         |
| `cpu-agent`     | m7g.xlarge, m7g.2xlarge          | Agent runtime pods (no GPU needed) | Scale based on NATS subject backlog via KEDA |

### GPU Scheduling

- GPU model servers declare `nvidia.com/gpu` resource requests. Karpenter provisions GPU nodes only when pods are pending.
- GPU nodes use taints (`nvidia.com/gpu=present:NoSchedule`) to prevent non-GPU workloads from landing on expensive instances.
- Time-slicing is not used; each inference pod gets a dedicated GPU to avoid latency variability.
- Spot instances are used for batch embedding workloads. On-demand instances are used for real-time inference.

### Autoscaling

KEDA (Kubernetes Event-Driven Autoscaling) scales agent pods based on:

- **NATS subject message count**: When messages accumulate on an agent's task subject, KEDA scales up agent pods to process the backlog.
- **Inference queue depth**: When the ai-gateway queue depth exceeds thresholds, KEDA scales inference server replicas.
- **Schedule-based**: Known batch processing windows (e.g., end-of-day coding review) pre-scale GPU nodes.

Scale-to-zero is enabled for non-critical agents during off-hours. Critical agents (clinical documentation, triage support) maintain a minimum replica count of 1.

### Cost Controls

- **GPU node budgets**: Maximum node count per node class prevents runaway GPU provisioning. The `gpu-inference` class is capped at 8 nodes in production.
- **Pod resource limits**: Every agent pod declares CPU and memory limits. GPU pods declare `nvidia.com/gpu: 1` as both request and limit.
- **Idle node reclamation**: Karpenter consolidation is enabled. Nodes with low utilization are cordoned, drained, and terminated within 5 minutes.
- **Spot interruption handling**: Agent pods on spot instances checkpoint state to NATS before termination. The agent framework handles restart and resume from checkpoint.

## Namespace Layout

| Namespace       | Contents                                                      | Security Posture                                      |
| --------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| `agents`        | Agent runtime pods, supervisor agents, tool executor sidecars | Controlled egress to external APIs via network policy |
| `ai-inference`  | vLLM/TGI model servers, ai-gateway, model-router              | No egress; all traffic is internal                    |
| `ai-embeddings` | Embedding model servers, vector indexing workers              | No egress; receives documents from NATS               |
| `nats`          | NATS cluster nodes, cross-cluster mirror configuration        | Internal only; peer connections to app cluster NATS   |
| `monitoring`    | Prometheus, Grafana agent, OpenTelemetry Collector            | Egress to central Grafana in app cluster              |
| `argocd`        | ArgoCD server and controllers                                 | Egress to Git repository                              |
| `keda`          | KEDA operator and metrics server                              | Internal only                                         |

## Security Boundaries

- The agent cluster has broader egress than the app cluster because agents may need to access external APIs (web search, third-party clinical databases, provider directories).
- Egress is controlled per-namespace via Kubernetes NetworkPolicy. Only the `agents` namespace has external egress, and only to an explicit allowlist of domains.
- Agents never have direct database access to app cluster RDS instances. All data access flows through app cluster APIs or NATS events.
- Agent pods run with the same security hardening as app cluster pods: non-root, read-only root filesystem, dropped capabilities.
- GPU nodes enforce the same Pod Security Standards as CPU nodes.

## Disaster Recovery

- The agent cluster can be fully rebuilt from Git (OpenTofu state + ArgoCD manifests). No unique state exists on the cluster.
- Model weights are stored in S3 and pulled at pod startup. A cluster rebuild re-downloads models.
- Agent state (task progress, decision logs) is persisted to the app cluster's PostgreSQL via API calls. Agent cluster loss does not lose task history.
- Recovery time objective (RTO) for the agent cluster: 30 minutes (time to provision EKS + GPU nodes + deploy workloads via ArgoCD).
