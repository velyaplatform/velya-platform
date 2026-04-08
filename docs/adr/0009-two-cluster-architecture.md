# ADR-0009: Two-Cluster Architecture (App + AI/Agents)

## Status

Accepted

## Date

2026-04-08

## Context

The Velya platform runs two fundamentally different workload profiles. Application workloads (APIs, web frontends, FHIR server, workflow engines) are CPU-bound, latency-sensitive, and require predictable resource allocation. AI/agent workloads (LLM inference, embedding generation, autonomous agent loops) are GPU-heavy, bursty, and can consume large amounts of memory and compute unpredictably. Running both profiles on the same cluster creates noisy-neighbor problems, complicates node pool management, and makes it difficult to apply different security policies and scaling strategies to each workload type.

## Decision

We will operate two separate EKS clusters: an **App Cluster** for all application services, platform components, and data stores, and an **AI/Agents Cluster** for all AI inference, embedding, and autonomous agent workloads. Both clusters share the same VPC and communicate over private networking via NATS (cross-cluster replication) and internal NLBs. Each cluster has its own ArgoCD instance, its own node scaling policies, and its own security boundaries. The AI/Agents cluster is configured with GPU-capable node pools (g5, p4d instances) via Karpenter provisioners.

## Consequences

### Positive

- Blast radius isolation: a runaway AI agent cannot starve application services of CPU, memory, or network bandwidth
- Independent scaling: the AI cluster can scale GPU nodes aggressively during batch processing without affecting app cluster costs
- Security boundary: AI agents with broader tool access (web browsing, code execution) are isolated from the cluster hosting PHI
- Different compliance postures: the app cluster can maintain stricter network policies while the AI cluster allows controlled egress

### Negative

- Two clusters double the operational surface area for upgrades, monitoring, and incident response
- Cross-cluster communication adds latency and complexity compared to in-cluster service mesh communication

### Risks

- NATS cross-cluster replication may introduce message delivery latency or ordering challenges
- Mitigation: Use JetStream with source/mirror streams for cross-cluster replication; design agents to tolerate eventual consistency in event delivery

## Alternatives Considered

- **Single cluster with namespace isolation**: Rejected because Kubernetes namespace isolation does not provide sufficient resource guarantee boundaries; a GPU-hungry pod can still impact scheduling for CPU pods
- **Separate AWS accounts per workload type**: Rejected as over-isolation; the operational overhead of cross-account networking, IAM, and observability outweighs the marginal security benefit over separate clusters in the same account
- **Serverless AI (Lambda, SageMaker endpoints)**: Rejected due to cold start latency, limited model customization, and the need for persistent agent state that serverless functions do not support
