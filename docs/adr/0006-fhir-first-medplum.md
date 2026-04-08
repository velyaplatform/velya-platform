# ADR-0006: FHIR as Primary Clinical Data Model with Medplum Self-Hosted

## Status

Accepted

## Date

2026-04-08

## Context

Velya is a healthcare platform that must store, exchange, and reason over clinical data. Healthcare interoperability standards (USCDI, ONC Cures Act, CMS Interoperability Rule) mandate FHIR R4 as the exchange format. Rather than building a custom clinical data model and translating to/from FHIR at the edges, adopting FHIR as the primary internal data model eliminates impedance mismatch and ensures native compliance. We need a FHIR server that is open-source, supports SMART on FHIR authorization, provides a developer-friendly SDK, and can be self-hosted for data sovereignty.

## Decision

We will adopt FHIR R4 as the primary clinical data model throughout the platform. Medplum (open-source, Apache 2.0) will be deployed as a self-hosted FHIR server running on our EKS cluster with PostgreSQL as its backing store. Medplum provides a complete FHIR API, SMART on FHIR authorization, subscriptions, batch operations, and a TypeScript SDK that integrates naturally with our NestJS services. All clinical data flows will use FHIR resources natively rather than translating to proprietary schemas.

## Consequences

### Positive

- Native FHIR compliance eliminates the need for a translation layer, reducing bugs and latency in data exchange
- Medplum's TypeScript SDK aligns with our stack and provides type-safe FHIR resource manipulation
- Self-hosted Medplum ensures full data sovereignty and eliminates dependency on a SaaS vendor for PHI storage
- SMART on FHIR authorization provides standards-compliant access control for clinical data

### Negative

- FHIR's resource model is verbose and can be cumbersome for simple use cases (e.g., a Patient resource has dozens of optional fields)
- Self-hosting Medplum requires owning upgrades, scaling, and operational support for the FHIR server

### Risks

- Medplum is a younger project with a smaller community than established FHIR servers (HAPI FHIR); critical bugs may take longer to resolve upstream
- Mitigation: Contribute to the Medplum open-source project, maintain the ability to fork and patch, and keep HAPI FHIR as a fallback option

## Alternatives Considered

- **HAPI FHIR (Java)**: Rejected because it would introduce Java into an otherwise TypeScript-only stack, requiring separate build tooling, CI pipelines, and operational expertise
- **Custom clinical data model with FHIR adapters**: Rejected because maintaining bidirectional FHIR translation is a perpetual source of bugs and compliance risk
- **Cloud-hosted FHIR (AWS HealthLake, Google Cloud Healthcare API)**: Rejected due to data sovereignty requirements, vendor lock-in, and the need for deep customization of subscription and authorization behavior
