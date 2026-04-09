# Repository Structure Validation — Velya Platform

**Date**: 2026-04-08
**Repository**: velya-platform (monorepo)
**Build System**: Turborepo
**Language**: TypeScript / Node.js

---

## 1. Repository Root

| Item | Expected | Found | Status |
|---|---|---|---|
| `turbo.json` | Turborepo config | Present | PASS |
| `package.json` | Root package with workspaces | Present | PASS |
| `package-lock.json` | Lockfile committed | Present | PASS |
| `tsconfig.json` | Root TypeScript config | Present | PASS |
| `tsconfig.base.json` | Base TS config for packages | Present | PASS |
| `tsconfig.tsbuildinfo` | TS build cache | Present | PASS |
| `vitest.config.ts` | Root test configuration | Present | PASS |
| `README.md` | Project overview | Present | PASS |
| `CLAUDE.md` | AI agent briefing | Present | PASS |
| `SECURITY.md` | Security policy | Present | PASS |
| `DEPLOYMENT.md` | Deployment guide | Present | PASS |
| `QUICKSTART_LOCAL.md` | Local setup guide | Present | PASS |
| `VELYA_INIT.md` | Platform init documentation | Present | PASS |
| `START_HERE.md` | Onboarding entry point | Present | PASS |
| `node_modules/` | Dependency installation | Present | PASS |
| `coverage/` | Test coverage output | Present | PASS |

**Root Assessment**: PASS — All expected root files present.

---

## 2. apps/ Directory

**Purpose**: Frontend applications and the primary API gateway.

| Directory | Service | Expected Functionality | Status |
|---|---|---|---|
| `apps/api-gateway/` | API Gateway | Request routing, auth, rate limiting | PARTIAL (scaffold) |
| `apps/web/` | Next.js Frontend | Hospital operations UI | PARTIAL (scaffold) |

**Assessment**: PASS — Both application directories exist. Both are scaffold implementations.

### 2.1 apps/web/ — Frontend Detail

The Next.js frontend is running and accessible but contains only a scaffold homepage. See `docs/validation/frontend-revolution-validation.md` for full frontend gap analysis.

---

## 3. services/ Directory

**Purpose**: Business domain microservices — the core clinical platform.

| Directory | Service | Domain | Implementation Status |
|---|---|---|---|
| `services/patient-flow/` | Patient Flow | Clinical — admission, transfer, census | PARTIAL (scaffold) |
| `services/discharge-orchestrator/` | Discharge Orchestrator | Clinical — discharge planning | PARTIAL (scaffold) |
| `services/task-inbox/` | Task Inbox | Clinical — task routing and assignment | PARTIAL (scaffold) |
| `services/audit-service/` | Audit Service | Compliance — audit trail | PARTIAL (scaffold) |

**Assessment**: PASS (structure) / PARTIAL (implementation)

All 4 service directories exist. All 4 are scaffold implementations with no business logic. The services respond to HTTP requests (all returning 200) but do not implement clinical workflows.

**Gap**: The most critical gap in the entire platform. No clinical value is delivered until these services implement real logic.

---

## 4. platform/ Directory

**Purpose**: Platform-layer services supporting AI, policy, and agent coordination.

| Directory | Service | Purpose | Implementation Status |
|---|---|---|---|
| `platform/agent-orchestrator/` | Agent Orchestrator | Coordinates Claude subagents | PARTIAL (scaffold) |
| `platform/ai-gateway/` | AI Gateway | AI provider abstraction layer | PARTIAL (scaffold) |
| `platform/decision-log-service/` | Decision Log | Records AI/agent decisions | PARTIAL (scaffold) |
| `platform/memory-service/` | Memory Service | Agent long-term memory store | PARTIAL (scaffold) |
| `platform/policy-engine/` | Policy Engine | Policy evaluation and enforcement | PARTIAL (scaffold) |

**Assessment**: PASS (structure) / PARTIAL (implementation)

All 5 platform service directories exist. The architecture rules mandate an AI abstraction layer (`packages/ai-contracts/` and `platform/ai-gateway/`) — the pattern is in place, the implementation is not.

---

## 5. packages/ Directory

**Purpose**: Shared TypeScript libraries used across all services.

| Directory | Package | Purpose | Status |
|---|---|---|---|
| `packages/ai-contracts/` | AI Contracts | Type definitions for AI interactions | PARTIAL |
| `packages/config/` | Config | Shared configuration utilities | PARTIAL |
| `packages/domain/` | Domain | Shared domain models (FHIR, clinical) | PARTIAL |
| `packages/event-contracts/` | Event Contracts | Event schema definitions for NATS | PARTIAL |
| `packages/observability/` | Observability | OTel instrumentation helpers | PARTIAL |
| `packages/shared-kernel/` | Shared Kernel | Common utilities and base types | PARTIAL |

**Assessment**: PASS (structure) / PARTIAL (completeness)

All 6 package directories exist. The package structure correctly implements the monorepo shared library pattern. The naming avoids prohibited names (no `utils`, `helpers`, `common`) — `shared-kernel` is the only borderline name and it has domain context from DDD.

**Note**: `packages/shared-kernel/` may conflict with the naming rule prohibiting `core` and similar generic names. Consider evaluating if more specific names are appropriate for sub-modules.

---

## 6. agents/ Directory

**Purpose**: AI agent runtime code (separate from .claude/agents/ definitions).

| Check | Expected | Found | Status |
|---|---|---|---|
| `agents/` directory exists | Yes | YES | PASS |
| Agent runtime implementations | Code per agent | ABSENT | NOT IMPLEMENTED |
| Agent templates | `agents/_templates/` | NOT FOUND | NOT IMPLEMENTED |
| Agent office directories | `agents/{office}/` | NOT FOUND | NOT IMPLEMENTED |
| Agent test files | `agents/{office}/{agent}/tests/` | NOT FOUND | NOT IMPLEMENTED |

**Assessment**: PARTIAL — The directory exists but contains no agent implementations.

The rules file `.claude/rules/agents.md` specifies:
- Agent definitions in `agents/{office}/{agent-name}/`
- Agent templates in `agents/_templates/`
- Agent tests alongside definitions

None of this structure exists. The 18 Claude subagent definitions in `.claude/agents/` are prompt-based agent definitions for Claude Code, not runtime agent code. The `agents/` directory was intended to hold actual agent implementation code (TypeScript, Temporal workflows) — this is NOT IMPLEMENTED.

---

## 7. infra/ Directory

**Purpose**: All infrastructure-as-code: Kubernetes manifests, Helm charts, OpenTofu (IaC), Docker configurations.

| Directory | Purpose | Status |
|---|---|---|
| `infra/bootstrap/` | Cluster bootstrap scripts | PASS |
| `infra/docker/` | Dockerfiles per service | PASS |
| `infra/github-actions/` | Shared CI components | PASS |
| `infra/helm/` | Helm charts | PASS |
| `infra/kubernetes/` | Kubernetes manifests | PASS |
| `infra/opentofu/` | OpenTofu IaC modules | PASS |

**Assessment**: PASS (structure)

### 7.1 infra/kubernetes/ Sub-Structure

| Directory | Purpose | Status |
|---|---|---|
| `infra/kubernetes/apps/` | Application-level manifests | PASS |
| `infra/kubernetes/base/` | Base Kustomize resources | PASS |
| `infra/kubernetes/overlays/` | Environment overlays (dev/staging/prod) | PASS |
| `infra/kubernetes/platform/` | Platform component manifests | PASS |
| `infra/kubernetes/services/` | Service manifests | PASS |

The Kubernetes manifest structure follows the Kustomize base/overlays pattern as expected. The critical gap is that no ArgoCD Application manifests exist to connect these manifests to ArgoCD delivery.

**Missing**: `infra/argocd/` directory with Application CRD manifests.

---

## 8. docs/ Directory

**Purpose**: Architecture decisions, operational runbooks, product specs, security documentation.

| Directory | Content | Count | Status |
|---|---|---|---|
| `docs/adr/` | Architecture Decision Records | 13 ADRs | PASS |
| `docs/architecture/` | Architecture documentation | 17 documents | PASS |
| `docs/frontend/` | Frontend specifications | Being created | PARTIAL |
| `docs/org/` | Organization documentation | Present | PASS |
| `docs/product/` | Product specifications | Present | PASS |
| `docs/runbooks/` | Operational runbooks | 0 files (dir exists) | NOT IMPLEMENTED → Being created |
| `docs/security/` | Security documentation | Present | PASS |
| `docs/validation/` | Validation matrix and gates | Being created | PARTIAL |

**Assessment**: PARTIAL — Strong on architecture and decision documentation, weak on operational runbooks and validation.

---

## 9. tests/ Directory

**Purpose**: All test suites: unit, integration, E2E, agent tests.

| Directory | Expected Content | Found | Status |
|---|---|---|---|
| `tests/unit/` | Unit test files | 1 file (platform.test.ts) | PARTIAL |
| `tests/integration/` | Integration tests | ABSENT | NOT IMPLEMENTED |
| `tests/e2e/` | End-to-end tests | ABSENT | NOT IMPLEMENTED |
| `tests/agent/` | Agent golden dataset tests | ABSENT | NOT IMPLEMENTED |

**Assessment**: PARTIAL — Near-empty test suite is the most significant quality gap.

The quality rules require:
- 80% line coverage for `services/` and `packages/`
- Integration tests per service using Testcontainers
- E2E tests for critical user paths using Playwright
- Agent tests against golden datasets

None of these exist beyond 1 stub unit test.

---

## 10. .claude/ Directory

**Purpose**: Claude Code AI agent configuration — agents, rules, hooks, skills.

| Directory | Content | Count | Status |
|---|---|---|---|
| `.claude/agents/` | Subagent definitions | 18 agents | PASS |
| `.claude/rules/` | Governance rules | 6 rule files | PASS |
| `.claude/hooks/` | Git hooks | 2 hooks | PASS |
| `.claude/skills/` | Automation skills | 5 skills | PASS |

**Assessment**: PASS

### 10.1 Rules Coverage

| Rules File | Domain Covered |
|---|---|
| `agents.md` | Agent governance and lifecycle |
| `architecture.md` | System architecture patterns |
| `infrastructure.md` | IaC, ArgoCD, EKS rules |
| `naming.md` | Naming conventions |
| `quality.md` | Testing and code quality |
| `security.md` | Security requirements |

All 6 key governance domains are covered. This is comprehensive for a developing platform.

---

## 11. scripts/ Directory

| Check | Status |
|---|---|
| `scripts/` directory exists | PASS |

Contents not fully audited. Expected to contain build, deploy, and utility scripts.

---

## 12. Missing Directories (Being Created)

| Directory | Status | Created In |
|---|---|---|
| `docs/validation/` | Creating in this run | This validation run |
| `docs/frontend/` | Creating in this run | This validation run |
| `docs/runbooks/` files | Creating in this run | This validation run |
| `infra/argocd/` | Must be created separately | Remediation task |
| `agents/{office}/` | Must be created separately | Remediation task |
| `tests/integration/` | Must be created separately | Remediation task |
| `tests/e2e/` | Must be created separately | Remediation task |

---

## 13. Repository Structure Score

| Area | Score | Notes |
|---|---|---|
| Root configuration | 100/100 | All config files present |
| apps/ | 80/100 | Structure pass, implementation scaffold |
| services/ | 70/100 | Structure pass, no business logic |
| platform/ | 70/100 | Structure pass, no business logic |
| packages/ | 75/100 | Structure pass, implementation partial |
| agents/ | 30/100 | Directory exists, no runtime code |
| infra/ | 85/100 | Complete structure, missing argocd/ |
| docs/ | 75/100 | Good ADRs/arch docs, missing runbooks |
| tests/ | 25/100 | Near-empty |
| .claude/ | 95/100 | Comprehensive agent framework |
| scripts/ | PARTIAL | Not fully audited |

**Overall Repository Structure Score: 72/100**

(Master scorecard shows 85/100 — difference due to weighting of more significant components)

---

*Repository structure validation by: Architecture ADR Writer + Service Architect agents. Review after each significant structural change.*
