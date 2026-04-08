# ADR-0003: AWS EKS with Auto Mode as Primary Runtime

## Status
Accepted

## Date
2026-04-08

## Context
The Velya platform requires a container orchestration layer that supports multi-service deployments, GPU workloads for AI agents, auto-scaling, and healthcare compliance requirements (HIPAA, SOC 2). We need a managed Kubernetes offering to reduce operational burden while retaining full control over workload placement, networking, and security policies. The platform must run in a cloud that offers healthcare-specific compliance certifications and a broad set of managed services (RDS, ElastiCache, S3, KMS).

## Decision
We will use AWS EKS with Auto Mode enabled as the primary runtime for all workloads. Auto Mode delegates node provisioning and scaling to AWS-managed Karpenter, eliminating the need to manage node groups, AMIs, or instance types manually. The platform will run across two EKS clusters: one for application workloads and one for AI/agent workloads with GPU node pools. All clusters will run EKS version 1.31 and use AWS VPC CNI for pod networking with security group enforcement at the pod level.

## Consequences

### Positive
- EKS Auto Mode eliminates node management overhead; AWS handles provisioning, patching, and right-sizing
- AWS provides HIPAA BAA coverage for EKS, RDS, S3, and KMS, simplifying compliance
- Karpenter (via Auto Mode) provides rapid, cost-efficient scaling including GPU instances for AI workloads
- Deep integration with AWS IAM via Pod Identity for fine-grained service-to-AWS-resource authorization

### Negative
- Vendor lock-in to AWS increases switching costs if multi-cloud becomes a requirement
- EKS Auto Mode is relatively new and may have edge cases in node scheduling or bin-packing behavior

### Risks
- EKS Auto Mode may not support all custom node configurations (taints, labels, instance type constraints) needed for specialized workloads
- Mitigation: Maintain the ability to create managed node groups alongside Auto Mode for workloads with strict hardware requirements

## Alternatives Considered
- **GKE Autopilot**: Rejected because GKE Autopilot has stricter pod-level restrictions (no privileged containers, limited volume types) and the broader AWS ecosystem (RDS, Cognito, KMS) is a better fit for healthcare
- **Self-managed Kubernetes on EC2**: Rejected due to the operational burden of managing control planes, etcd, and node lifecycle
- **AWS ECS/Fargate**: Rejected because ECS lacks the ecosystem breadth of Kubernetes (Helm charts, ArgoCD, KEDA, Istio) and would limit future portability
- **Azure AKS**: Rejected in favor of AWS due to AWS's stronger healthcare compliance track record and deeper managed service catalog
