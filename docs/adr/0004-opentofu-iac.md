# ADR-0004: OpenTofu for Infrastructure as Code

## Status
Accepted

## Date
2026-04-08

## Context
All infrastructure must be defined as code, versioned alongside application code, and applied through automated pipelines. HashiCorp's relicensing of Terraform to BSL (Business Source License) in August 2023 introduced legal and strategic risks for organizations that embed Terraform in their product or SaaS workflows. We need an IaC tool that is fully open-source, compatible with the existing Terraform provider ecosystem, and actively maintained by a credible foundation.

## Decision
We will use OpenTofu (maintained by the Linux Foundation) as our infrastructure-as-code tool. OpenTofu is a fork of Terraform 1.5.x under the MPL-2.0 license, ensuring full open-source compliance. We will use OpenTofu 1.9+ which provides state encryption, early variable/local evaluation, and full compatibility with existing Terraform providers and modules. All infrastructure definitions will live in `infra/tofu/` organized by layer: `network`, `eks`, `data`, `platform`, and `security`.

## Consequences

### Positive
- MPL-2.0 license eliminates legal risk from BSL restrictions, even if Velya's tooling is offered as a service
- Full compatibility with Terraform providers, modules, and state backends means zero migration friction
- State encryption (native in OpenTofu 1.7+) provides at-rest encryption of state files without external tooling
- Active Linux Foundation governance ensures long-term project health and vendor neutrality

### Negative
- Some Terraform-specific features (HCP Terraform integration, Sentinel policies) are not available in OpenTofu
- Community and ecosystem are smaller than Terraform's, which may slow adoption of cutting-edge provider features

### Risks
- Provider compatibility drift: as Terraform and OpenTofu diverge, some newer provider features may land in Terraform first
- Mitigation: Pin provider versions, contribute to OpenTofu provider registry, and monitor compatibility reports from the OpenTofu community

## Alternatives Considered
- **Terraform (BSL-licensed)**: Rejected due to BSL license restrictions that could affect Velya's ability to offer infrastructure management capabilities
- **Pulumi**: Rejected because Pulumi's imperative approach (TypeScript CDK) increases complexity for infrastructure that is inherently declarative; also introduces a dependency on Pulumi's proprietary state backend
- **AWS CDK**: Rejected due to vendor lock-in to AWS CloudFormation and the impedance mismatch between CDK's imperative constructs and GitOps declarative reconciliation
- **Crossplane**: Considered for Kubernetes-native IaC but rejected as the primary tool because it lacks the maturity and provider breadth of OpenTofu; may be adopted later for in-cluster resource management
