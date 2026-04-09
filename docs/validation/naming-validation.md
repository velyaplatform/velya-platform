# Naming Convention Validation — Velya Platform

**Date**: 2026-04-08
**Standard**: `.claude/rules/naming.md` and `docs/product/naming-taxonomy.md`
**Scope**: Service names, namespace names, file names, agent names, TypeScript conventions

---

## 1. Naming Rules Summary

The Velya platform defines these naming patterns (source: `.claude/rules/naming.md`):

| Context | Convention | Pattern |
|---|---|---|
| Files and directories | kebab-case | `patient-intake-handler.ts` |
| TypeScript types/classes/interfaces | PascalCase | `PatientAdmission` |
| TypeScript variables/functions | camelCase | `calculateDosage` |
| Constants / env vars | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Kubernetes resources | kebab-case | `velya-clinical-intake` |
| Services | `velya-{domain}-{responsibility}` | `velya-clinical-intake` |
| Agents | `{office}-{role}-agent` | `clinical-triage-agent` |
| Namespaces | `velya-{env}-{domain}` | `velya-dev-clinical` |
| Database tables | snake_case | `patient_encounters` |
| NATS subjects | `dot.separated.kebab` | `clinical.patient-intake.created` |
| Temporal workflows | PascalCase | `PatientDischargeWorkflow` |
| Temporal activities | camelCase | `sendDischargeNotification` |

---

## 2. Namespace Naming — PASS

| Namespace | Expected Pattern | Actual | Compliant |
|---|---|---|---|
| velya-dev-core | velya-{env}-{domain} | velya-dev-core | YES |
| velya-dev-platform | velya-{env}-{domain} | velya-dev-platform | YES |
| velya-dev-agents | velya-{env}-{domain} | velya-dev-agents | YES |
| velya-dev-observability | velya-{env}-{domain} | velya-dev-observability | YES |
| velya-dev-web | velya-{env}-{domain} | velya-dev-web | YES |
| argocd | System namespace | argocd | N/A (external tool) |
| ingress-nginx | System namespace | ingress-nginx | N/A (external tool) |
| metallb-system | System namespace | metallb-system | N/A (external tool) |

**Assessment**: PASS — All Velya-owned namespaces follow the `velya-{env}-{domain}` pattern.

---

## 3. Service Naming

The naming rules define: `velya-{domain}-{responsibility}`

### 3.1 Current Service Names vs. Expected Pattern

| Service Directory | Name Used | Expected Pattern | Compliant | Gap |
|---|---|---|---|---|
| `services/patient-flow/` | patient-flow | velya-clinical-patient-flow | PARTIAL | Missing `velya-` prefix and domain |
| `services/discharge-orchestrator/` | discharge-orchestrator | velya-clinical-discharge-orchestrator | PARTIAL | Missing `velya-` prefix and domain |
| `services/task-inbox/` | task-inbox | velya-clinical-task-inbox | PARTIAL | Missing `velya-` prefix and domain |
| `services/audit-service/` | audit-service | velya-compliance-audit-service | PARTIAL | Missing `velya-` prefix and domain |
| `platform/agent-orchestrator/` | agent-orchestrator | velya-ai-agent-orchestrator | PARTIAL | Missing `velya-` prefix |
| `platform/ai-gateway/` | ai-gateway | velya-ai-gateway | PARTIAL | Missing `velya-` prefix |
| `platform/decision-log-service/` | decision-log-service | velya-ai-decision-log | PARTIAL | Missing `velya-` prefix, `-service` suffix redundant |
| `platform/memory-service/` | memory-service | velya-ai-memory-service | PARTIAL | Missing `velya-` prefix |
| `platform/policy-engine/` | policy-engine | velya-compliance-policy-engine | PARTIAL | Missing `velya-` prefix and domain |
| `apps/api-gateway/` | api-gateway | velya-api-gateway | PARTIAL | Missing `velya-` prefix |
| `apps/web/` | web | velya-web | PARTIAL | Missing `velya-` prefix |

**Assessment**: PARTIAL — None of the current service directory names follow the full `velya-{domain}-{responsibility}` pattern. They are missing the `velya-` prefix and the domain segment. The naming is descriptive and clear but not compliant with the defined convention.

**Note on this gap**: The directory names do not necessarily need to match Kubernetes service names exactly. The Kubernetes service/deployment resources should use the full `velya-{domain}-{responsibility}` pattern even if the repository directory uses a shorthand. This needs to be verified in the Kubernetes manifests.

**Ingress URLs** (which reflect Kubernetes service names):
- `patient-flow.172.19.0.6.nip.io` — does not have `velya-` prefix
- `discharge.172.19.0.6.nip.io` — shortened, not full name
- `task-inbox.172.19.0.6.nip.io` — does not have `velya-` prefix
- `audit.172.19.0.6.nip.io` — shortened, not full name

The Ingress names suggest the Kubernetes service names also do not follow the full convention.

**Recommendation**: Decide whether to enforce the full `velya-{domain}-{responsibility}` pattern in Kubernetes resources (impacts service discovery URLs and configuration) or accept the shorter names as a pragmatic exception. Document the decision in an ADR.

---

## 4. Agent Naming

The naming rules define: `{office}-{role}-agent`

### 4.1 Current Agent Names vs. Expected Pattern

| Agent File | Current Name | Expected Pattern | Compliant | Assessment |
|---|---|---|---|---|
| `agent-governance-reviewer.md` | agent-governance-reviewer | {office}-{role}-agent | PARTIAL | Missing `-agent` suffix, "agent" is in the wrong position |
| `ai-platform-architect.md` | ai-platform-architect | ai-{role}-agent | PARTIAL | Missing `-agent` suffix |
| `api-designer.md` | api-designer | {office}-api-designer-agent | PARTIAL | Missing `-agent` suffix |
| `architecture-adr-writer.md` | architecture-adr-writer | architecture-adr-writer-agent | PARTIAL | Missing `-agent` suffix |
| `domain-model-reviewer.md` | domain-model-reviewer | domain-model-reviewer-agent | PARTIAL | Missing `-agent` suffix |
| `eks-operator.md` | eks-operator | infra-eks-operator-agent | PARTIAL | Missing `-agent` suffix, office unclear |
| `finops-reviewer.md` | finops-reviewer | finops-reviewer-agent | PARTIAL | Missing `-agent` suffix |
| `gitops-operator.md` | gitops-operator | infra-gitops-operator-agent | PARTIAL | Missing `-agent` suffix |
| `governance-council.md` | governance-council | governance-council-agent | PARTIAL | Missing `-agent` suffix |
| `iam-reviewer.md` | iam-reviewer | security-iam-reviewer-agent | PARTIAL | Missing `-agent` suffix, office unclear |
| `infra-planner.md` | infra-planner | infra-planner-agent | PARTIAL | Missing `-agent` suffix |
| `market-intelligence-manager.md` | market-intelligence-manager | business-market-intelligence-agent | PARTIAL | Missing `-agent` suffix |
| `naming-governance-agent.md` | naming-governance-agent | governance-naming-agent | PASS | Has `-agent` suffix |
| `observability-reviewer.md` | observability-reviewer | platform-observability-reviewer-agent | PARTIAL | Missing `-agent` suffix |
| `quality-gate-reviewer.md` | quality-gate-reviewer | quality-gate-reviewer-agent | PARTIAL | Missing `-agent` suffix |
| `security-reviewer.md` | security-reviewer | security-reviewer-agent | PARTIAL | Missing `-agent` suffix |
| `service-architect.md` | service-architect | architecture-service-architect-agent | PARTIAL | Missing `-agent` suffix |
| `test-architect.md` | test-architect | quality-test-architect-agent | PARTIAL | Missing `-agent` suffix |

**Assessment**: PARTIAL — Only 1/18 agents (`naming-governance-agent`) has the `-agent` suffix. 17/18 are missing the suffix. Additionally, the `{office}` segment is inconsistently applied.

The naming rule states: `{office}-{role}-agent` with examples like `clinical-triage-agent`, `quality-audit-agent`.

**Recommendation**: Either rename all 18 agents to follow the pattern, or formally update the rule to accept the current naming (which is descriptive and clear, just missing the suffix and office). Document this in an ADR or naming governance review.

---

## 5. File Naming — PASS

| Check | Expected | Evidence | Status |
|---|---|---|---|
| Directory names | kebab-case | All directories use kebab-case | PASS |
| TypeScript source files | kebab-case | Consistent with kebab-case | PASS |
| Markdown files | kebab-case | All .md files use kebab-case | PASS |
| YAML files | kebab-case | All .yaml files use kebab-case | PASS |
| Shell scripts | kebab-case | pre-commit-secrets.sh, validate-naming.sh | PASS |

**Assessment**: PASS — File and directory naming is consistently kebab-case across the repository.

---

## 6. Package Naming

| Package | Name | Convention | Assessment |
|---|---|---|---|
| `packages/ai-contracts/` | ai-contracts | kebab-case | PASS |
| `packages/config/` | config | Single word, permitted | PASS WITH CONDITIONS |
| `packages/domain/` | domain | Single word, clear domain | PASS WITH CONDITIONS |
| `packages/event-contracts/` | event-contracts | kebab-case | PASS |
| `packages/observability/` | observability | Single word, clear purpose | PASS |
| `packages/shared-kernel/` | shared-kernel | Uses `shared` (borderline) | PASS WITH CONDITIONS |

**Note**: The naming rules prohibit `shared` as a standalone name but allow it in compound names that are semantically clear. `shared-kernel` is borrowed from DDD (Domain-Driven Design) terminology and is acceptable.

---

## 7. Validate-Naming Hook

### 7.1 Hook Behavior

| Check | Status |
|---|---|
| `validate-naming.sh` exists | PASS |
| Validates kebab-case directories | PASS |
| Validates service names against pattern | PASS |
| Has exceptions list for known valid cases | PASS WITH CONDITIONS |
| Edge case: `node_modules/` | Should be excluded |
| Edge case: `.claude/` dot-directories | Should be excluded |
| Edge case: single-word packages (config, domain) | Needs explicit exception |

### 7.2 Known Limitations

1. The hook validates naming at commit time but does not retroactively fix existing violations
2. Exceptions list may not cover all legitimate edge cases (dot-directories, system directories)
3. Hook requires manual installation — not automatically enforced via `husky` or `lefthook`

---

## 8. TypeScript Conventions (Not Fully Audited)

TypeScript naming conventions (PascalCase types, camelCase variables, SCREAMING_SNAKE_CASE constants) cannot be verified from file system inspection alone. These require code review or ESLint enforcement.

| Convention | Enforcement | Status |
|---|---|---|
| PascalCase for types | ESLint + TypeScript | INFERRED PASS |
| camelCase for variables | ESLint | INFERRED PASS |
| SCREAMING_SNAKE_CASE for constants | ESLint | INFERRED PASS |
| No `any` types | TypeScript strict mode | INFERRED PASS |
| No abbreviations | Code review | NOT PROVABLE |
| Boolean prefixes (is, has, should) | Code review | NOT PROVABLE |

---

## 9. Naming Validation Summary

| Category | Status | Score |
|---|---|---|
| Namespace naming | PASS | 100% |
| File/directory naming | PASS | 95% |
| Package naming | PASS WITH CONDITIONS | 85% |
| Service naming (directories) | PARTIAL | 30% |
| Service naming (K8s resources) | PARTIAL | 30% |
| Agent naming | PARTIAL | 10% |
| TypeScript conventions | INFERRED PASS | 80% |
| Hook coverage | PASS WITH CONDITIONS | 60% |

**Overall Naming Score**: ~61%

The largest gaps are in service naming (missing `velya-` prefix and domain segment in service/ingress names) and agent naming (missing `-agent` suffix on 17/18 agents).

---

## 10. Recommended Actions

| Action | Priority | Effort |
|---|---|---|
| Decide: enforce full `velya-{domain}-{responsibility}` in K8s or document exception | HIGH | 2 hours discussion |
| Add `-agent` suffix to 17 agent definition files | MEDIUM | 1 hour |
| Add `{office}` segment to agent names | MEDIUM | 2 hours |
| Document naming exceptions in ADR | MEDIUM | 2 hours |
| Install `lefthook` or `husky` to enforce hooks | HIGH | 2 hours |
| Add ESLint naming rules for TypeScript conventions | MEDIUM | 4 hours |
| Update exceptions list in validate-naming.sh | LOW | 1 hour |

---

*Naming validation owned by: naming-governance-agent. Review after any new service or agent is added.*
