# Velya Naming Taxonomy

> Canonical naming conventions for all Velya platform artifacts. Every team member, agent, and automation must follow these conventions. Deviations require an ADR.

## Principles

1. **Prefix ownership**: All public-facing names start with `velya` to establish namespace ownership.
2. **Readability over brevity**: Names should be self-documenting. `velya-discharge-orchestrator` is better than `velya-dsch-orch`.
3. **Kebab-case everywhere**: Except where the target system requires otherwise (e.g., database tables use snake_case).
4. **Domain alignment**: Names reflect bounded contexts from the domain lexicon, not implementation details.

---

## Applications

**Pattern**: `velya-{app-name}`

Applications are user-facing deployable units (web apps, mobile apps, CLI tools).

| Example             | Description                             |
| ------------------- | --------------------------------------- |
| `velya-web`         | Primary web application (React/Next.js) |
| `velya-api-gateway` | API gateway / BFF layer                 |
| `velya-mobile`      | Mobile application                      |
| `velya-cli`         | Developer CLI tooling                   |
| `velya-admin`       | Internal administration console         |

---

## Services

**Pattern**: `velya-{domain}-{responsibility}`

Services are backend microservices scoped to a single domain and responsibility.

| Example                         | Description                                         |
| ------------------------------- | --------------------------------------------------- |
| `velya-patient-flow`            | Core patient flow tracking service                  |
| `velya-discharge-orchestrator`  | Manages discharge workflow state machines           |
| `velya-bed-management`          | Bed assignment and capacity tracking                |
| `velya-census-tracker`          | Real-time census calculations                       |
| `velya-inbox-router`            | Routes tasks and notifications to care team inboxes |
| `velya-escalation-engine`       | SLA monitoring and escalation triggers              |
| `velya-auth-service`            | Authentication and token management                 |
| `velya-notification-dispatcher` | Multi-channel notification delivery                 |

---

## Platform Components

**Pattern**: `velya-{component}`

Platform components are shared infrastructure that services depend on.

| Example                    | Description                                        |
| -------------------------- | -------------------------------------------------- |
| `velya-ai-gateway`         | Abstraction layer for LLM providers                |
| `velya-agent-orchestrator` | Multi-agent coordination and lifecycle management  |
| `velya-event-bus`          | Event streaming infrastructure (Kafka/EventBridge) |
| `velya-observability`      | Centralized logging, metrics, and tracing          |
| `velya-feature-flags`      | Feature flag management service                    |
| `velya-config-server`      | Centralized configuration management               |

---

## Packages

**Pattern**: `@velya/{package-name}`

Shared libraries published to a private npm/PyPI registry.

| Example                | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `@velya/ui-components` | Shared React component library                        |
| `@velya/api-client`    | Generated API client SDK                              |
| `@velya/event-schemas` | Canonical event schema definitions (Avro/JSON Schema) |
| `@velya/auth-utils`    | Authentication helpers and middleware                 |
| `@velya/testing`       | Shared test utilities and fixtures                    |
| `@velya/eslint-config` | Shared ESLint configuration                           |
| `@velya/tsconfig`      | Shared TypeScript configuration                       |

---

## Kubernetes Namespaces

**Pattern**: `velya-{env}-{domain}`

Each namespace isolates a domain within an environment.

| Example                    | Description                           |
| -------------------------- | ------------------------------------- |
| `velya-dev-core`           | Core services in development          |
| `velya-dev-agents`         | Agent workloads in development        |
| `velya-staging-core`       | Core services in staging              |
| `velya-prod-core`          | Core services in production           |
| `velya-prod-agents`        | Agent workloads in production         |
| `velya-prod-observability` | Observability stack in production     |
| `velya-prod-data`          | Data pipeline workloads in production |

**Environments**: `dev`, `staging`, `prod`

**Domains**: `core`, `agents`, `data`, `observability`, `security`, `infra`

---

## Agents

**Pattern**: `{office}-{role}-agent`

Agents are named by their organizational office and functional role within the multi-agent enterprise.

| Example                              | Description                                     |
| ------------------------------------ | ----------------------------------------------- |
| `security-office-reviewer-agent`     | Reviews code and configs for security issues    |
| `architecture-office-reviewer-agent` | Reviews designs against architectural standards |
| `quality-office-test-agent`          | Generates and maintains test suites             |
| `devops-office-deploy-agent`         | Manages deployment pipelines                    |
| `product-office-triage-agent`        | Triages incoming issues and feature requests    |
| `documentation-office-writer-agent`  | Generates and maintains documentation           |
| `compliance-office-audit-agent`      | Runs compliance checks against policies         |

---

## Helm Charts

**Pattern**: `velya-{service}`

One Helm chart per deployable service, stored in `infra/helm/`.

| Example              | Description                    |
| -------------------- | ------------------------------ |
| `velya-patient-flow` | Chart for patient flow service |
| `velya-ai-gateway`   | Chart for AI gateway           |
| `velya-web`          | Chart for web application      |

---

## OpenTofu Modules

**Pattern**: `velya-{resource}`

Infrastructure-as-code modules, stored in `infra/tofu/modules/`.

| Example                 | Description                          |
| ----------------------- | ------------------------------------ |
| `velya-eks-cluster`     | EKS cluster provisioning             |
| `velya-rds-postgres`    | RDS PostgreSQL instance              |
| `velya-s3-bucket`       | S3 bucket with standard policies     |
| `velya-vpc`             | VPC and networking                   |
| `velya-ecr-repo`        | ECR repository with scanning enabled |
| `velya-secrets-manager` | Secrets Manager secret with rotation |

---

## Events

**Pattern**: `velya.{domain}.{entity}.{action}`

Domain events follow a dot-separated hierarchical naming scheme. Actions use past tense to indicate something that happened.

| Example                               | Description                              |
| ------------------------------------- | ---------------------------------------- |
| `velya.patient.discharge.blocked`     | A discharge was blocked by a new blocker |
| `velya.patient.discharge.cleared`     | All discharge blockers were resolved     |
| `velya.patient.encounter.admitted`    | A new patient encounter began            |
| `velya.patient.encounter.transferred` | Patient transferred between units        |
| `velya.bed.assignment.created`        | A bed was assigned to a patient          |
| `velya.bed.assignment.released`       | A bed was released                       |
| `velya.task.inbox-item.created`       | A new task appeared in someone's inbox   |
| `velya.task.inbox-item.completed`     | A task was marked complete               |
| `velya.escalation.sla.breached`       | An SLA threshold was exceeded            |
| `velya.agent.lifecycle.deployed`      | An agent was deployed to an environment  |

---

## API Paths

**Pattern**: `/api/v1/{domain}/{resource}`

RESTful API paths are versioned and domain-scoped.

| Example                                    | Description                            |
| ------------------------------------------ | -------------------------------------- |
| `/api/v1/patient/encounters`               | List/create encounters                 |
| `/api/v1/patient/encounters/{id}`          | Get/update/delete a specific encounter |
| `/api/v1/patient/encounters/{id}/blockers` | Blockers for an encounter              |
| `/api/v1/discharge/workflows`              | List/create discharge workflows        |
| `/api/v1/bed/assignments`                  | Bed assignments                        |
| `/api/v1/task/inbox`                       | Current user's inbox items             |
| `/api/v1/census/snapshots`                 | Census snapshots                       |
| `/api/v1/admin/agents`                     | Agent management (admin)               |

---

## Database Tables

**Pattern**: `{domain}_{entity}`

Tables use snake_case and are prefixed by their domain to avoid collisions in shared databases.

| Example                   | Description                          |
| ------------------------- | ------------------------------------ |
| `patient_flow_encounters` | Active patient encounters            |
| `patient_flow_blockers`   | Discharge blockers                   |
| `bed_mgmt_assignments`    | Current bed assignments              |
| `bed_mgmt_units`          | Hospital units and their beds        |
| `task_inbox_items`        | Inbox task items                     |
| `task_inbox_assignments`  | Task-to-user assignments             |
| `census_snapshots`        | Point-in-time census snapshots       |
| `escalation_rules`        | SLA escalation rule definitions      |
| `escalation_events`       | Escalation event log                 |
| `agent_registry`          | Registered agents and their metadata |

---

## Feature Flags

**Pattern**: `velya.{domain}.{feature}`

Feature flags use dot notation consistent with event naming.

| Example                             | Description                               |
| ----------------------------------- | ----------------------------------------- |
| `velya.discharge.ai-suggestions`    | AI-powered discharge planning suggestions |
| `velya.patient.risk-scoring`        | Readmission risk scoring model            |
| `velya.inbox.smart-prioritization`  | AI-driven inbox prioritization            |
| `velya.bed.predictive-availability` | Predictive bed availability               |
| `velya.census.real-time-updates`    | WebSocket-based real-time census          |
| `velya.agent.auto-deployment`       | Automated agent deployment pipeline       |

---

## Architecture Decision Records (ADRs)

**Pattern**: `{number}-{kebab-case-title}`

ADRs are stored in `docs/adr/` and numbered sequentially with zero-padded three-digit prefixes.

| Example                         | Description                            |
| ------------------------------- | -------------------------------------- |
| `001-use-nextjs-for-web`        | Choice of Next.js as web framework     |
| `002-event-driven-architecture` | Adoption of event-driven patterns      |
| `003-multi-model-ai-strategy`   | AI provider abstraction approach       |
| `004-kubernetes-as-runtime`     | Choice of Kubernetes for orchestration |

---

## Validation

All naming conventions are enforced by:

1. **CI checks**: The `validate-naming.sh` hook runs on every commit.
2. **PR review**: The architecture-office-reviewer-agent validates names in pull requests.
3. **Platform audit**: The `run-platform-audit` skill includes naming validation.

To validate naming locally:

```bash
.claude/hooks/validate-naming.sh
```
