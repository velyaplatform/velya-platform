# Evidence Index — Velya Platform Validation

**Date**: 2026-04-08
**Purpose**: Catalog of all verifiable evidence supporting validation claims
**Cluster**: kind-velya-local (5-node kind cluster)
**Evidence Type Legend**: VERIFIED | INFERRED | NOT PROVABLE | NOT COLLECTED

---

## 1. Repository Evidence

### 1.1 Git Repository

| Evidence Item | Type | Command / Path | Value | Status |
|---|---|---|---|---|
| Repository root | VERIFIED | `ls /home/jfreire/velya/velya-platform/` | Directory exists with all expected dirs | VERIFIED |
| Monorepo config | VERIFIED | `turbo.json` | Present at root | VERIFIED |
| Package config | VERIFIED | `package.json` | Present at root | VERIFIED |
| TypeScript config | VERIFIED | `tsconfig.json`, `tsconfig.base.json` | Present | VERIFIED |
| Vitest config | VERIFIED | `vitest.config.ts` | Present | VERIFIED |

### 1.2 Top-Level Directories

| Directory | Expected Purpose | Status |
|---|---|---|
| `apps/` | Frontend and API gateway | VERIFIED |
| `services/` | Business microservices | VERIFIED |
| `platform/` | Platform services (AI, policy) | VERIFIED |
| `packages/` | Shared libraries | VERIFIED |
| `infra/` | IaC, Helm, Kubernetes manifests | VERIFIED |
| `docs/` | Architecture, ADRs, runbooks | VERIFIED |
| `tests/` | Test suites | VERIFIED |
| `.claude/` | AI agent definitions and config | VERIFIED |
| `scripts/` | Build and utility scripts | VERIFIED |

### 1.3 Service Directories

| Service | Path | Status |
|---|---|---|
| api-gateway | `apps/api-gateway/` | VERIFIED |
| web (Next.js) | `apps/web/` | VERIFIED |
| patient-flow | `services/patient-flow/` | VERIFIED |
| discharge-orchestrator | `services/discharge-orchestrator/` | VERIFIED |
| task-inbox | `services/task-inbox/` | VERIFIED |
| audit-service | `services/audit-service/` | VERIFIED |
| agent-orchestrator | `platform/agent-orchestrator/` | VERIFIED |
| ai-gateway | `platform/ai-gateway/` | VERIFIED |
| decision-log-service | `platform/decision-log-service/` | VERIFIED |
| memory-service | `platform/memory-service/` | VERIFIED |
| policy-engine | `platform/policy-engine/` | VERIFIED |

### 1.4 Package Directories

| Package | Path | Status |
|---|---|---|
| ai-contracts | `packages/ai-contracts/` | VERIFIED |
| config | `packages/config/` | VERIFIED |
| domain | `packages/domain/` | VERIFIED |
| event-contracts | `packages/event-contracts/` | VERIFIED |
| observability | `packages/observability/` | VERIFIED |
| shared-kernel | `packages/shared-kernel/` | VERIFIED |

---

## 2. CI/CD Evidence

### 2.1 GitHub Actions Workflows

| Workflow | Path | SHA-Pinned | Purpose | Status |
|---|---|---|---|---|
| ci.yaml | `.github/workflows/ci.yaml` | YES (verified) | Build, lint, test, audit | VERIFIED |
| security.yaml | `.github/workflows/security.yaml` | YES (verified) | CodeQL SAST | VERIFIED |
| release.yaml | `.github/workflows/release.yaml` | YES (verified) | Release pipeline | VERIFIED |
| version-bump.yaml | `.github/workflows/version-bump.yaml` | YES (verified) | Version management | VERIFIED |

### 2.2 Security Hooks

| Hook | Path | Executable | Tests For | Status |
|---|---|---|---|---|
| pre-commit-secrets.sh | `.claude/hooks/pre-commit-secrets.sh` | INFERRED | AWS keys, tokens, passwords | VERIFIED (exists) |
| validate-naming.sh | `.claude/hooks/validate-naming.sh` | INFERRED | kebab-case dirs, service names | VERIFIED (exists) |

### 2.3 Test Evidence

| Test File | Path | Test Count | Status |
|---|---|---|---|
| platform.test.ts | `tests/unit/platform.test.ts` | Unknown (stub) | VERIFIED (exists) |
| Integration tests | `tests/integration/` | 0 | NOT IMPLEMENTED |
| E2E tests | `tests/e2e/` | 0 | NOT IMPLEMENTED |

---

## 3. Live Cluster Evidence

### 3.1 Cluster State (Collected: 2026-04-08)

| Evidence Item | Command | Value | Status |
|---|---|---|---|
| Node count | `kubectl get nodes` | 5 nodes | VERIFIED |
| Total running pods | `kubectl get pods -A` | 64 pods | VERIFIED |
| Namespace count | `kubectl get ns` | 8 relevant namespaces | VERIFIED |
| Ingress count | `kubectl get ingress -A` | 13 Ingresses | VERIFIED |
| KEDA installed | `kubectl get pods -n keda-system` | Running | VERIFIED |
| ArgoCD installed | `kubectl get pods -n argocd` | 7 pods running | VERIFIED |
| ArgoCD Applications | `argocd app list` | 0 Applications | VERIFIED |
| KEDA ScaledObjects | `kubectl get scaledobject -A` | 0 ScaledObjects | VERIFIED |
| ClusterSecretStore | `kubectl get clustersecretstore` | LocalStack — Valid/Ready | VERIFIED |
| ResourceQuotas | `kubectl get resourcequota -A` | Present per namespace | VERIFIED |
| NetworkPolicies | `kubectl get netpol -A` | Present per tier | VERIFIED |
| PodDisruptionBudgets | `kubectl get pdb -A` | Configured | VERIFIED |
| Custom PriorityClasses | `kubectl get pc` | NONE (only system defaults) | VERIFIED |
| Node taints | `kubectl describe nodes` | NONE configured | VERIFIED |

### 3.2 Namespaces

| Namespace | Pods | ResourceQuota | NetworkPolicy | Status |
|---|---|---|---|---|
| velya-dev-core | Running | YES | YES (backend tier) | VERIFIED |
| velya-dev-platform | Running | YES | YES (platform tier) | VERIFIED |
| velya-dev-agents | Running | YES | YES (AI tier) | VERIFIED |
| velya-dev-observability | Running | YES | YES | VERIFIED |
| velya-dev-web | Running | YES | YES (frontend tier) | VERIFIED |
| argocd | 7 pods | YES | YES | VERIFIED |
| ingress-nginx | Running | YES | YES | VERIFIED |
| metallb-system | Running | YES | YES | VERIFIED |

---

## 4. Service Health Endpoints

### 4.1 HTTP Endpoint Status (Collected: 2026-04-08)

| Service | URL | Expected Response | Actual Response | Status |
|---|---|---|---|---|
| Frontend (Next.js) | http://velya.172.19.0.6.nip.io | 200 + HTML | 200 (scaffold page) | VERIFIED |
| Grafana | http://grafana.172.19.0.6.nip.io | 200 + login page | 200 | VERIFIED |
| ArgoCD | http://argocd.172.19.0.6.nip.io | 200 + UI | 200 | VERIFIED |
| Prometheus | http://prometheus.172.19.0.6.nip.io | 200 + Prom UI | 200 | VERIFIED |
| patient-flow | http://patient-flow.172.19.0.6.nip.io | 200 + API | 200 (scaffold) | VERIFIED |
| discharge | http://discharge.172.19.0.6.nip.io | 200 + API | 200 (scaffold) | VERIFIED |
| task-inbox | http://task-inbox.172.19.0.6.nip.io | 200 + API | 200 (scaffold) | VERIFIED |
| audit | http://audit.172.19.0.6.nip.io | 200 + API | 200 (scaffold) | VERIFIED |
| ai-gateway | http://ai-gateway.172.19.0.6.nip.io | 200 + API | 200 (scaffold) | VERIFIED |
| policy-engine | http://policy-engine.172.19.0.6.nip.io | 200 + API | 200 (scaffold) | VERIFIED |
| memory-service | http://memory-service.172.19.0.6.nip.io | 200 + API | 200 (scaffold) | VERIFIED |
| decision-log | http://decision-log.172.19.0.6.nip.io | 200 + API | 200 (scaffold) | VERIFIED |
| agents | http://agents.172.19.0.6.nip.io | 200 + API | 200 (scaffold) | VERIFIED |

Note: "scaffold" indicates HTTP 200 but no real business logic implemented behind the endpoint.

---

## 5. Observability Stack Evidence

### 5.1 Running Components

| Component | Namespace | Pod Count | Status |
|---|---|---|---|
| Prometheus | velya-dev-observability | Running | VERIFIED |
| Grafana | velya-dev-observability | Running | VERIFIED |
| Loki | velya-dev-observability | Running (with canary + cache) | VERIFIED |
| Promtail | velya-dev-observability | 3 instances (one per node) | VERIFIED |
| OTel Collector | velya-dev-observability | Running | VERIFIED |

### 5.2 Grafana Datasources

| Datasource | Type | URL | Status |
|---|---|---|---|
| Prometheus | prometheus | http://prometheus.velya-dev-observability.svc:9090 | VERIFIED |
| Loki | loki | http://loki.velya-dev-observability.svc:3100 | VERIFIED |
| Alertmanager | alertmanager | http://alertmanager.velya-dev-observability.svc:9093 | VERIFIED |

### 5.3 Grafana Credentials

| Field | Value | Source |
|---|---|---|
| URL | http://grafana.172.19.0.6.nip.io | Cluster audit |
| Username | admin | Helm values |
| Password | prom-operator | Helm values |

### 5.4 ServiceMonitor Count

| Scope | Count | Notes |
|---|---|---|
| Infrastructure monitors | 12 | kube-state-metrics, node-exporter, etc. |
| Velya application monitors | 0 | NOT IMPLEMENTED |

---

## 6. ESO & Secrets Evidence

### 6.1 External Secrets Operator

| Evidence Item | Command | Value | Status |
|---|---|---|---|
| ESO installation | `kubectl get pods -n external-secrets` | Running | VERIFIED |
| ClusterSecretStore name | `kubectl get clustersecretstore` | Present | VERIFIED |
| ClusterSecretStore backend | Spec inspection | LocalStack (dev) | VERIFIED |
| ClusterSecretStore status | Status conditions | Valid / Ready | VERIFIED |
| ExternalSecret resources | `kubectl get externalsecret -A` | NOT PROVABLE from audit | NOT COLLECTED |

---

## 7. Ingress Configuration Evidence

### 7.1 Ingress Controller

| Component | Namespace | Status |
|---|---|---|
| ingress-nginx | ingress-nginx | VERIFIED running |
| MetalLB | metallb-system | VERIFIED running |

### 7.2 All 13 Ingress Resources

| Ingress Name | Namespace | Host | TLS | Status |
|---|---|---|---|---|
| velya-web | velya-dev-web | velya.172.19.0.6.nip.io | NO | VERIFIED |
| grafana | velya-dev-observability | grafana.172.19.0.6.nip.io | NO | VERIFIED |
| argocd | argocd | argocd.172.19.0.6.nip.io | NO | VERIFIED |
| prometheus | velya-dev-observability | prometheus.172.19.0.6.nip.io | NO | VERIFIED |
| patient-flow | velya-dev-core | patient-flow.172.19.0.6.nip.io | NO | VERIFIED |
| discharge | velya-dev-core | discharge.172.19.0.6.nip.io | NO | VERIFIED |
| task-inbox | velya-dev-core | task-inbox.172.19.0.6.nip.io | NO | VERIFIED |
| audit | velya-dev-core | audit.172.19.0.6.nip.io | NO | VERIFIED |
| ai-gateway | velya-dev-platform | ai-gateway.172.19.0.6.nip.io | NO | VERIFIED |
| policy-engine | velya-dev-platform | policy-engine.172.19.0.6.nip.io | NO | VERIFIED |
| memory-service | velya-dev-platform | memory-service.172.19.0.6.nip.io | NO | VERIFIED |
| decision-log | velya-dev-platform | decision-log.172.19.0.6.nip.io | NO | VERIFIED |
| agents | velya-dev-agents | agents.172.19.0.6.nip.io | NO | VERIFIED |

Note: All ingresses use HTTP only. TLS is NOT IMPLEMENTED on any ingress.

---

## 8. Agent Framework Evidence

### 8.1 Claude Subagents (.claude/agents/)

| Agent File | Present | Status |
|---|---|---|
| agent-governance-reviewer.md | YES | VERIFIED |
| ai-platform-architect.md | YES | VERIFIED |
| api-designer.md | YES | VERIFIED |
| architecture-adr-writer.md | YES | VERIFIED |
| domain-model-reviewer.md | YES | VERIFIED |
| eks-operator.md | YES | VERIFIED |
| finops-reviewer.md | YES | VERIFIED |
| gitops-operator.md | YES | VERIFIED |
| governance-council.md | YES | VERIFIED |
| iam-reviewer.md | YES | VERIFIED |
| infra-planner.md | YES | VERIFIED |
| market-intelligence-manager.md | YES | VERIFIED |
| naming-governance-agent.md | YES | VERIFIED |
| observability-reviewer.md | YES | VERIFIED |
| quality-gate-reviewer.md | YES | VERIFIED |
| security-reviewer.md | YES | VERIFIED |
| service-architect.md | YES | VERIFIED |
| test-architect.md | YES | VERIFIED |

Total: 18/18 agents present.

### 8.2 Rules Files (.claude/rules/)

| Rules File | Present | Covers |
|---|---|---|
| agents.md | YES | Agent governance lifecycle |
| architecture.md | YES | System architecture patterns |
| infrastructure.md | YES | IaC, ArgoCD, EKS rules |
| naming.md | YES | Naming conventions |
| quality.md | YES | Testing, code quality |
| security.md | YES | Security requirements |

### 8.3 Skills (.claude/skills/)

| Skill File | Present |
|---|---|
| create-adr.md | YES |
| review-risk.md | YES |
| run-platform-audit.md | YES |
| run-security-audit.md | YES |
| setup-naming-taxonomy.md | YES |

### 8.4 Hooks (.claude/hooks/)

| Hook File | Present |
|---|---|
| pre-commit-secrets.sh | YES |
| validate-naming.sh | YES |

---

## 9. Documentation Evidence

### 9.1 ADRs (docs/adr/)

| Count | Status |
|---|---|
| 13 ADRs | VERIFIED |

### 9.2 Architecture Docs (docs/architecture/)

| Count | Status |
|---|---|
| 17 documents | VERIFIED |

### 9.3 Missing Documentation

| Missing Item | Impact |
|---|---|
| docs/runbooks/ files | HIGH — no operational guidance |
| Incident response playbook | HIGH |
| SLO documentation | HIGH |
| Per-service README files | MEDIUM |

---

## 10. Evidence Collection Gaps

The following items could not be verified from the available audit data and require additional collection:

| Gap | Why Unverifiable | How to Collect |
|---|---|---|
| Branch protection settings | No GitHub API access | `gh api repos/{owner}/velya-platform/branches/main/protection` |
| ExternalSecret resources | Not collected in audit | `kubectl get externalsecret -A -o yaml` |
| CI run history | No GitHub access | GitHub Actions run history in repo |
| Pod security context | Not fully audited | `kubectl get pods -A -o jsonpath='{.items[*].spec.securityContext}'` |
| Actual test pass/fail | Tests not run in audit | `npm test` in CI |
| NATS connectivity | Not tested | Integration test with NATS publish/subscribe |
| Database migration state | Not verified | Service startup logs |
| Image digests in use | Not collected | `kubectl get pods -A -o jsonpath='{.items[*].spec.containers[*].image}'` |

---

*Evidence index maintained by: Platform team. Refresh after every cluster audit or major deployment.*
