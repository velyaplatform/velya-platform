# Infrastructure Overview

## Two-Cluster Architecture

Velya operates a two-cluster architecture on AWS EKS, separating application workloads from AI/agent workloads. Both clusters share a single VPC with private subnets spanning three availability zones. Cross-cluster communication flows over NATS (JetStream source/mirror replication) and internal Network Load Balancers, ensuring all inter-cluster traffic stays within the VPC and never traverses the public internet.

## High-Level Topology

```
                            +---------------------------+
                            |       AWS Account         |
                            |    (velya-production)     |
                            +---------------------------+
                                        |
                            +-----------+-----------+
                            |         VPC           |
                            |   10.0.0.0/16         |
                            +-----------+-----------+
                                        |
              +-------------------------+-------------------------+
              |                                                   |
    +---------+---------+                               +---------+---------+
    |  Private Subnets  |                               |  Private Subnets  |
    |  10.0.0.0/19 x3   |                               |  10.0.32.0/19 x3  |
    +-------------------+                               +-------------------+
              |                                                   |
    +---------+---------+                               +---------+---------+
    |   App Cluster     |                               |  AI/Agents Cluster|
    |   (EKS 1.31)      |                               |  (EKS 1.31)       |
    |   Auto Mode       |                               |  Auto Mode + GPU  |
    +-------------------+                               +-------------------+
    |                   |                               |                   |
    | Namespaces:       |     NATS JetStream            | Namespaces:       |
    |  - velya-app      |<====== replication ========>  |  - agents         |
    |  - medplum        |                               |  - ai-inference   |
    |  - temporal       |     Internal NLB              |  - ai-embeddings  |
    |  - nats           |<====== gRPC/HTTP =========>   |  - nats           |
    |  - monitoring     |                               |  - monitoring     |
    |  - argocd         |                               |  - argocd         |
    |  - cert-manager   |                               |  - keda           |
    |  - keda           |                               +-------------------+
    +-------------------+
              |
    +---------+---------+
    |  AWS Managed       |
    |  Services          |
    +--------------------+
    | - RDS PostgreSQL   |
    |   (Multi-AZ)       |
    | - S3 (FHIR blobs,  |
    |   backups, logs)   |
    | - KMS (encryption) |
    | - ECR (images)     |
    | - Route 53 (DNS)   |
    | - ACM (TLS certs)  |
    | - CloudWatch       |
    +--------------------+
```

## App Cluster

The App Cluster hosts all user-facing services, platform infrastructure, and data stores. It runs on EKS 1.31 with Auto Mode enabled, which delegates node provisioning to AWS-managed Karpenter. Nodes are Graviton-based (ARM64) for cost efficiency, with x86 instances available for workloads that require them.

### Namespaces

| Namespace | Purpose | Key Workloads |
|-----------|---------|---------------|
| `velya-app` | Application services | NestJS APIs, Next.js frontend, background workers |
| `medplum` | FHIR server | Medplum server, Medplum worker |
| `temporal` | Workflow engine | Temporal server (frontend, history, matching, worker), Temporal UI |
| `nats` | Event messaging | NATS server cluster (3 nodes), NATS surveyor |
| `monitoring` | Observability | Prometheus, Grafana, Loki, Tempo, OpenTelemetry Collector |
| `argocd` | GitOps operator | ArgoCD server, application controller, repo server |
| `cert-manager` | TLS automation | cert-manager controller, Let's Encrypt ClusterIssuer |
| `keda` | Autoscaling | KEDA operator, KEDA metrics server |

## AI/Agents Cluster

The AI/Agents Cluster hosts all AI inference, embedding generation, and autonomous agent workloads. It runs on EKS 1.31 with Auto Mode and Karpenter provisioners configured for GPU instance types (g5, g6, p4d). This cluster has broader egress rules to allow agents to access external APIs and data sources, while maintaining strict controls on what data can flow back to external systems.

### Namespaces

| Namespace | Purpose | Key Workloads |
|-----------|---------|---------------|
| `agents` | Autonomous agents | Agent runtime pods, agent supervisor, tool executor |
| `ai-inference` | LLM serving | vLLM or TGI model servers, inference routers |
| `ai-embeddings` | Embedding generation | Embedding model servers, vector indexing workers |
| `nats` | Event messaging | NATS server cluster (3 nodes), cross-cluster mirror |
| `monitoring` | Observability | Prometheus, Grafana, OpenTelemetry Collector |
| `argocd` | GitOps operator | ArgoCD server, application controller |
| `keda` | Autoscaling | KEDA operator (scales agents based on NATS queue depth) |

## Cross-Cluster Communication

Communication between the two clusters uses two mechanisms:

1. **NATS JetStream Replication**: The NATS cluster in each EKS cluster is configured with JetStream source/mirror streams. Events published on the App Cluster (e.g., `clinical.patient.admitted`) are replicated to the AI/Agents Cluster for agent consumption. Agent outputs (e.g., `agents.documentation.completed`) are replicated back to the App Cluster.

2. **Internal NLB**: For synchronous request-reply patterns (e.g., requesting an AI completion from the App Cluster), an internal Network Load Balancer exposes the AI inference service. Traffic flows over the VPC private network using mTLS.

## Infrastructure Provisioning Layers

Infrastructure is provisioned in layers, each managed by OpenTofu:

| Layer | Path | Resources |
|-------|------|-----------|
| Network | `infra/tofu/network/` | VPC, subnets, NAT gateways, VPC endpoints, security groups |
| EKS | `infra/tofu/eks/` | EKS clusters, Auto Mode config, IRSA roles, Pod Identity associations |
| Data | `infra/tofu/data/` | RDS PostgreSQL instances, S3 buckets, KMS keys, ElastiCache |
| Platform | `infra/tofu/platform/` | Helm releases for NATS, Temporal, Medplum, cert-manager |
| Security | `infra/tofu/security/` | IAM policies, KMS key policies, WAF rules, GuardDuty |

## GitOps Delivery

ArgoCD runs on each cluster and manages all Kubernetes workloads. Application manifests are stored in `infra/argocd/` with Kustomize overlays per environment. ArgoCD uses the App-of-Apps pattern: a single root Application resource points to a directory of Application manifests, each defining a service deployment. Changes flow through Git: PR, review, merge to main, ArgoCD auto-sync (dev/staging) or manual sync (prod).

## Network Architecture

- **VPC CIDR**: 10.0.0.0/16
- **Private subnets**: 3 per cluster, one per AZ, /19 each
- **Public subnets**: 3 shared, for ALB/NLB ingress endpoints only
- **NAT Gateways**: 3 (one per AZ) for outbound internet from private subnets
- **VPC Endpoints**: S3, ECR, KMS, STS, CloudWatch Logs (gateway/interface endpoints to avoid NAT charges)
- **Pod networking**: AWS VPC CNI with security group enforcement per pod
- **Ingress**: AWS ALB Ingress Controller for HTTP(S), internal NLBs for gRPC/TCP
