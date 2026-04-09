# Master Validation Matrix — Velya Platform

**Date**: 2026-04-08
**Cluster**: kind-velya-local (5 nodes)
**Auditor**: Automated cluster audit + repository inspection
**Overall Status**: DEV READY — NOT PRODUCTION READY (Score: 62/100)

---

## How to Read This Matrix

| Status Label | Meaning |
|---|---|
| PASS | Verified, meets standard |
| PASS WITH CONDITIONS | Works but has known caveats or edge cases |
| PARTIAL | Partially implemented — core exists, details missing |
| FAIL | Exists but broken or misconfigured |
| BLOCKER | Missing and required before any further milestone |
| NOT IMPLEMENTED | Explicitly not yet built |
| NOT PROVABLE | Exists but cannot be verified from available evidence |
| RISKY | Technically works but represents operational risk |
| DEGRADED | Running but in a degraded state |
| MISALIGNED | Implemented differently from what was intended |
| NEEDS REDESIGN | Current approach will not scale to production requirements |

---

## Repository Structure

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| Monorepo root | Structure | HIGH | turborepo + package.json | turbo.json, package.json present | PASS | `ls /` at root | Low | Platform | No |
| apps/api-gateway | Structure | HIGH | API gateway service | Directory exists with source | PASS | `ls apps/` | Low | Platform | Yes |
| apps/web | Structure | HIGH | Next.js frontend | Directory exists | PASS | `ls apps/` | Low | Frontend | Yes |
| services/patient-flow | Structure | HIGH | Patient flow microservice | Directory exists | PARTIAL | `ls services/` | High | Clinical | Yes |
| services/discharge-orchestrator | Structure | HIGH | Discharge orchestration | Directory exists | PARTIAL | `ls services/` | High | Clinical | Yes |
| services/task-inbox | Structure | HIGH | Task management service | Directory exists | PARTIAL | `ls services/` | Medium | Clinical | Yes |
| services/audit-service | Structure | HIGH | Audit trail service | Directory exists | PARTIAL | `ls services/` | High | Compliance | Yes |
| platform/agent-orchestrator | Structure | HIGH | Agent orchestration | Directory exists | PARTIAL | `ls platform/` | High | AI | Yes |
| platform/ai-gateway | Structure | HIGH | AI provider abstraction | Directory exists | PARTIAL | `ls platform/` | High | AI | Yes |
| platform/decision-log-service | Structure | MEDIUM | Decision audit log | Directory exists | PARTIAL | `ls platform/` | Medium | AI | Yes |
| platform/memory-service | Structure | MEDIUM | Agent memory store | Directory exists | PARTIAL | `ls platform/` | Medium | AI | No |
| platform/policy-engine | Structure | HIGH | Policy enforcement | Directory exists | PARTIAL | `ls platform/` | High | Security | Yes |
| packages/ai-contracts | Structure | HIGH | AI type contracts | Directory exists | PARTIAL | `ls packages/` | Medium | AI | Yes |
| packages/config | Structure | MEDIUM | Shared config | Directory exists | PARTIAL | `ls packages/` | Low | Platform | No |
| packages/domain | Structure | HIGH | Domain models | Directory exists | PARTIAL | `ls packages/` | High | Clinical | Yes |
| packages/event-contracts | Structure | HIGH | Event schemas | Directory exists | PARTIAL | `ls packages/` | High | Platform | Yes |
| packages/observability | Structure | MEDIUM | OTel instrumentation | Directory exists | PARTIAL | `ls packages/` | Medium | Ops | No |
| packages/shared-kernel | Structure | MEDIUM | Shared utilities | Directory exists | PARTIAL | `ls packages/` | Low | Platform | No |
| agents/ | Structure | MEDIUM | Agent runtime code | Directory exists, no runtime | PARTIAL | `ls agents/` | High | AI | No |
| infra/kubernetes | Structure | HIGH | K8s manifests | Directory with apps/base/overlays | PASS | `ls infra/kubernetes/` | Low | Infra | Yes |
| infra/helm | Structure | HIGH | Helm charts | Directory exists | PASS | `ls infra/helm/` | Low | Infra | Yes |
| infra/opentofu | Structure | HIGH | OpenTofu IaC | Directory exists | PASS | `ls infra/opentofu/` | Medium | Infra | Yes |
| infra/docker | Structure | MEDIUM | Dockerfiles | Directory exists | PASS | `ls infra/docker/` | Low | CI | No |
| tests/unit | Structure | HIGH | Unit test suite | 1 file only (platform.test.ts) | PARTIAL | `ls tests/` | High | Quality | Yes |
| tests/integration | Structure | HIGH | Integration tests | Not found | NOT IMPLEMENTED | `ls tests/` | High | Quality | Yes |
| tests/e2e | Structure | HIGH | E2E tests | Not found | NOT IMPLEMENTED | `ls tests/` | High | Quality | Yes |
| docs/adr | Structure | MEDIUM | Architecture decisions | 13 ADRs present | PASS | `ls docs/adr/` | Low | Architecture | No |
| docs/architecture | Structure | MEDIUM | Architecture docs | 17 documents | PASS | `ls docs/architecture/` | Low | Architecture | No |
| docs/validation | Structure | HIGH | Validation docs | Being created now | PARTIAL | This creation run | Low | Platform | No |
| docs/runbooks | Structure | HIGH | Operational runbooks | Exists as dir, no files | NOT IMPLEMENTED | `ls docs/runbooks/` | High | Ops | Yes |
| docs/frontend | Structure | MEDIUM | Frontend specs | Being created now | PARTIAL | This creation run | Low | Frontend | No |
| .claude/agents | Structure | MEDIUM | Claude subagents | 18 agents defined | PASS | `ls .claude/agents/` | Low | AI | No |
| .claude/rules | Structure | MEDIUM | Claude rules | 6 rule files | PASS | `ls .claude/rules/` | Low | AI | No |
| .claude/hooks | Structure | MEDIUM | Git hooks | 2 hooks | PASS | `ls .claude/hooks/` | Low | Quality | No |
| .claude/skills | Structure | MEDIUM | Claude skills | 5 skills | PASS | `ls .claude/skills/` | Low | AI | No |

---

## CI/CD

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| ci.yaml | CI/CD | HIGH | Build + test pipeline | Present | PASS | `.github/workflows/ci.yaml` | Low | Platform | Yes |
| security.yaml | CI/CD | HIGH | Security scan | Present (CodeQL) | PASS | `.github/workflows/security.yaml` | Low | Security | Yes |
| release.yaml | CI/CD | HIGH | Release pipeline | Present | PASS | `.github/workflows/release.yaml` | Low | Platform | Yes |
| version-bump.yaml | CI/CD | MEDIUM | Version management | Present | PASS | `.github/workflows/version-bump.yaml` | Low | Platform | No |
| GitHub Actions SHA pinning | CI/CD | HIGH | All actions pinned by SHA | All 4 workflows verified | PASS | Workflow inspection | Low | Security | Yes |
| npm audit in CI | CI/CD | HIGH | Audit at --audit-level=high | Configured | PASS | ci.yaml inspection | Low | Security | Yes |
| Image scanning in CI | CI/CD | HIGH | Trivy or equivalent scan | Placeholder only | PARTIAL | ci.yaml inspection | High | Security | Yes |
| SBOM generation | CI/CD | MEDIUM | SBOM per image | Not configured | NOT IMPLEMENTED | Workflow inspection | Medium | Security | No |
| Branch protection | CI/CD | HIGH | PR required, tests pass | Not verified (no GitHub access) | NOT PROVABLE | GitHub settings | High | Platform | Yes |
| Test pass rate | CI/CD | HIGH | All tests pass | 1 stub test passes | PARTIAL | tests/unit/ | High | Quality | Yes |
| Lint enforcement | CI/CD | HIGH | ESLint pass in CI | Configured in CI | PASS | ci.yaml | Low | Quality | Yes |

---

## Cluster & Infrastructure

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| Cluster: kind-velya-local | Cluster | HIGH | 5-node kind cluster | 5 nodes confirmed | PASS | kubectl get nodes | Low | Infra | No (dev only) |
| Total pods running | Cluster | HIGH | All platform pods healthy | 64 pods running | PASS | kubectl get pods -A | Low | Infra | No |
| EKS cluster | Cluster | HIGH | AWS EKS for production | Not provisioned | NOT IMPLEMENTED | No AWS resources | CRITICAL | Infra | Yes |
| Node taints | Cluster | MEDIUM | Workload scheduling isolation | Not configured | NOT IMPLEMENTED | kubectl describe nodes | High (prod) | Infra | Yes (prod) |
| Custom PriorityClasses | Cluster | MEDIUM | Protect critical workloads | Not created | NOT IMPLEMENTED | kubectl get pc | Medium | Infra | No |
| NodePool/NodeClass | Cluster | HIGH | EKS Karpenter node pools | Not applicable (kind) | NOT IMPLEMENTED | N/A | High (prod) | Infra | Yes (prod) |

---

## Namespaces

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| velya-dev-core | Namespace | HIGH | Core service namespace | Confirmed | PASS | kubectl get ns | Low | Infra | No |
| velya-dev-platform | Namespace | HIGH | Platform service namespace | Confirmed | PASS | kubectl get ns | Low | Infra | No |
| velya-dev-agents | Namespace | HIGH | Agent service namespace | Confirmed | PASS | kubectl get ns | Low | Infra | No |
| velya-dev-observability | Namespace | HIGH | Observability stack namespace | Confirmed | PASS | kubectl get ns | Low | Infra | No |
| velya-dev-web | Namespace | HIGH | Frontend namespace | Confirmed | PASS | kubectl get ns | Low | Infra | No |
| argocd | Namespace | HIGH | GitOps namespace | Confirmed | PASS | kubectl get ns | Low | Infra | No |
| ingress-nginx | Namespace | HIGH | Ingress controller namespace | Confirmed | PASS | kubectl get ns | Low | Infra | No |
| metallb-system | Namespace | HIGH | Load balancer namespace | Confirmed | PASS | kubectl get ns | Low | Infra | No |

---

## Resource Quotas & Policies

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| ResourceQuotas configured | Policy | HIGH | Quotas per namespace | Configured on all namespaces | PASS | kubectl get quota -A | Low | Infra | No |
| NetworkPolicies — backend tier | Security | HIGH | Default deny + allow rules | Configured | PASS | kubectl get netpol -A | Low | Security | Yes |
| NetworkPolicies — frontend tier | Security | HIGH | Frontend isolation | Configured | PASS | kubectl get netpol -A | Low | Security | Yes |
| NetworkPolicies — platform tier | Security | HIGH | Platform isolation | Configured | PASS | kubectl get netpol -A | Low | Security | Yes |
| NetworkPolicies — AI tier | Security | HIGH | AI service isolation | Configured | PASS | kubectl get netpol -A | Low | Security | Yes |
| PodDisruptionBudgets | Availability | HIGH | PDBs for all critical services | Configured | PASS | kubectl get pdb -A | Low | Infra | Yes |
| Pod Security Standards | Security | HIGH | Restricted baseline | Not verified | NOT PROVABLE | kubectl get ns -o yaml | Medium | Security | Yes |
| Single replica deployments | Availability | HIGH | HA with multiple replicas | All services single replica | RISKY | kubectl get deploy -A | HIGH | Infra | Yes |

---

## Services (All 13 HTTP Endpoints)

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| velya.172.19.0.6.nip.io (Next.js) | Frontend | HIGH | Full hospital operations UI | Basic scaffold (3 feature cards) | PARTIAL | HTTP 200 | High | Frontend | Yes |
| patient-flow.172.19.0.6.nip.io | Clinical | HIGH | Patient flow management API | HTTP accessible, scaffold code | PARTIAL | HTTP response | High | Clinical | Yes |
| discharge.172.19.0.6.nip.io | Clinical | HIGH | Discharge orchestration API | HTTP accessible, scaffold code | PARTIAL | HTTP response | High | Clinical | Yes |
| task-inbox.172.19.0.6.nip.io | Clinical | HIGH | Task routing API | HTTP accessible, scaffold code | PARTIAL | HTTP response | High | Clinical | Yes |
| audit.172.19.0.6.nip.io | Compliance | HIGH | Audit trail API | HTTP accessible, scaffold code | PARTIAL | HTTP response | High | Compliance | Yes |
| ai-gateway.172.19.0.6.nip.io | AI | HIGH | AI provider abstraction API | HTTP accessible, scaffold code | PARTIAL | HTTP response | High | AI | Yes |
| policy-engine.172.19.0.6.nip.io | Security | HIGH | Policy enforcement API | HTTP accessible, scaffold code | PARTIAL | HTTP response | High | Security | Yes |
| memory-service.172.19.0.6.nip.io | AI | MEDIUM | Agent memory store API | HTTP accessible, scaffold code | PARTIAL | HTTP response | Medium | AI | No |
| decision-log.172.19.0.6.nip.io | AI | MEDIUM | Decision audit log API | HTTP accessible, scaffold code | PARTIAL | HTTP response | Medium | AI | No |
| agents.172.19.0.6.nip.io | AI | MEDIUM | Agent orchestrator API | HTTP accessible, scaffold code | PARTIAL | HTTP response | High | AI | No |
| grafana.172.19.0.6.nip.io | Observability | MEDIUM | Grafana dashboards | Running, admin/prom-operator | PASS | HTTP 200 + login | Low | Ops | No |
| prometheus.172.19.0.6.nip.io | Observability | MEDIUM | Prometheus metrics | Running and scraping | PASS | HTTP 200 | Low | Ops | No |
| argocd.172.19.0.6.nip.io | GitOps | HIGH | ArgoCD (apps configured) | Running, NO apps configured | PARTIAL | HTTP 200, empty app list | HIGH | Infra | Yes |

---

## Observability

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| Prometheus | Observability | HIGH | Running and scraping | Running, 12 ServiceMonitors | PASS | kubectl get pods -n velya-dev-observability | Low | Ops | No |
| Grafana | Observability | MEDIUM | Running with datasources | Running, 3 datasources | PASS | grafana.nip.io accessible | Low | Ops | No |
| Loki | Observability | MEDIUM | Log aggregation | Running with canary + cache | PASS | kubectl get pods | Low | Ops | No |
| Promtail | Observability | MEDIUM | Node log collection | 3 instances running | PASS | kubectl get pods | Low | Ops | No |
| OTel Collector | Observability | HIGH | Trace collection | Running | PASS | kubectl get pods | Low | Ops | No |
| Grafana datasources | Observability | MEDIUM | Prometheus + Loki + Alertmanager | All 3 configured | PASS | Grafana UI | Low | Ops | No |
| ServiceMonitors for Velya services | Observability | HIGH | Per-service monitors | Not configured | NOT IMPLEMENTED | kubectl get servicemonitor | High | Ops | Yes |
| Custom service dashboards | Observability | MEDIUM | Grafana dashboards per service | Not created | NOT IMPLEMENTED | Grafana UI | High | Ops | Yes |
| Velya alert rules | Observability | HIGH | Alerts for service SLOs | Not configured | NOT IMPLEMENTED | kubectl get prometheusrule | High | Ops | Yes |
| SLO definitions | Observability | HIGH | Formal SLO targets per service | Not defined | NOT IMPLEMENTED | No SLO files | High | Ops | Yes |
| Agent decision tracing | Observability | HIGH | Per-agent trace visibility | Not implemented | NOT IMPLEMENTED | No trace config | High | AI | No |

---

## GitOps (ArgoCD)

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| ArgoCD installation | GitOps | HIGH | ArgoCD running | 7 pods running | PASS | kubectl get pods -n argocd | Low | Infra | No |
| ArgoCD accessible | GitOps | HIGH | UI accessible | argocd.172.19.0.6.nip.io responds | PASS | HTTP 200 | Low | Infra | No |
| ArgoCD Applications | GitOps | HIGH | Apps syncing from git | NONE configured | BLOCKER | argocd app list = empty | CRITICAL | Infra | Yes |
| App-of-Apps pattern | GitOps | HIGH | Environment promotion pattern | Not implemented | NOT IMPLEMENTED | No root app | HIGH | Infra | Yes |
| Auto-sync for dev | GitOps | HIGH | Dev syncs automatically | Not configured | NOT IMPLEMENTED | No sync policy | High | Infra | Yes |
| Drift detection | GitOps | MEDIUM | Alert on drift | Not configured | NOT IMPLEMENTED | No alert | Medium | Infra | No |
| ArgoCD infra/argocd/ manifests | GitOps | HIGH | Application manifests in git | No manifests found | BLOCKER | `ls infra/argocd/` | CRITICAL | Infra | Yes |

---

## Autoscaling (KEDA)

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| KEDA installation | Autoscaling | HIGH | KEDA running | Installed | PASS | kubectl get pods (keda ns) | Low | Infra | No |
| ScaledObjects | Autoscaling | HIGH | Autoscaling per service | NONE configured | FAIL | kubectl get scaledobject -A = empty | HIGH | Infra | Yes |
| KEDA triggers (NATS/HTTP) | Autoscaling | HIGH | Event-driven scaling | Not configured | NOT IMPLEMENTED | No triggers | High | Infra | Yes |
| HPA for web tier | Autoscaling | MEDIUM | CPU/memory-based scaling | Not configured | NOT IMPLEMENTED | No HPA | Medium | Infra | No |

---

## Secrets & ESO

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| ESO installed | Secrets | HIGH | External Secrets Operator | Installed | PASS | kubectl get pods | Low | Security | Yes |
| ClusterSecretStore (LocalStack) | Secrets | HIGH | Valid and ready | Confirmed valid and ready | PASS | kubectl get clustersecretstore | Low | Security | No |
| No secrets in code | Secrets | HIGH | Zero secrets in repo | Pre-commit scan + CodeQL | PASS | security.yaml + hooks | Low | Security | Yes |
| ExternalSecret resources | Secrets | HIGH | Per-service secret refs | Not verified | NOT PROVABLE | kubectl get externalsecret -A | Medium | Security | Yes |
| AWS Secrets Manager (prod) | Secrets | HIGH | Real AWS SM for prod | Not provisioned | NOT IMPLEMENTED | No AWS config | HIGH | Security | Yes |

---

## Ingress

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| ingress-nginx installed | Ingress | HIGH | Ingress controller running | Running | PASS | kubectl get pods -n ingress-nginx | Low | Infra | No |
| MetalLB installed | Ingress | HIGH | Load balancer for kind | Running | PASS | kubectl get pods -n metallb-system | Low | Infra | No |
| 13 Ingresses total | Ingress | HIGH | All services externally accessible | 13 Ingresses confirmed | PASS | kubectl get ingress -A | Low | Infra | No |
| TLS on ingresses | Ingress | HIGH | HTTPS for all services | Not configured (nip.io HTTP only) | NOT IMPLEMENTED | Ingress specs | HIGH | Security | Yes |
| Wildcard cert management | Ingress | HIGH | cert-manager + Let's Encrypt | Not installed | NOT IMPLEMENTED | kubectl get pods | Medium | Security | Yes |

---

## Frontend

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| Next.js application | Frontend | HIGH | Full hospital operations UI | Basic scaffold, 3 feature cards | PARTIAL | velya.nip.io | HIGH | Frontend | Yes |
| Patient Operational Cockpit | Frontend | HIGH | Priority-ordered patient view | Not implemented | NOT IMPLEMENTED | UI inspection | HIGH | Frontend | Yes |
| Unified Action Inbox | Frontend | HIGH | All tasks in one view | Not implemented | NOT IMPLEMENTED | UI inspection | HIGH | Frontend | Yes |
| Discharge Control Tower | Frontend | HIGH | Discharge planning UI | Not implemented | NOT IMPLEMENTED | UI inspection | HIGH | Frontend | Yes |
| Role-based workspaces | Frontend | HIGH | Per-role UI views | Not implemented | NOT IMPLEMENTED | UI inspection | HIGH | Frontend | Yes |
| Agent Oversight Console | Frontend | HIGH | AI agent monitoring | Not implemented | NOT IMPLEMENTED | UI inspection | HIGH | Frontend | No |
| Degraded mode UI | Frontend | HIGH | Offline/degraded fallback | Not implemented | NOT IMPLEMENTED | UI inspection | HIGH | Frontend | Yes |
| Accessibility (WCAG 2.1 AA) | Frontend | HIGH | Clinical UI accessibility | Not tested | NOT PROVABLE | No a11y tests | Medium | Frontend | Yes |

---

## Agent Framework (.claude/)

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| 18 agent definitions | Agents | MEDIUM | All agents documented | 18 files present | PASS | `ls .claude/agents/` | Low | AI | No |
| Agent naming convention | Agents | MEDIUM | {office}-{role}-agent pattern | Mixed — some follow, some don't | PARTIAL | Agent file names | Low | AI | No |
| Agent scorecards | Agents | HIGH | Per-agent KPI tracking | Not implemented | NOT IMPLEMENTED | Agent files | High | AI | No |
| Agent runtime code | Agents | HIGH | Actual agent implementations | Not in agents/ dir | NOT IMPLEMENTED | `ls agents/` | High | AI | No |
| 6 rules files | Agents | MEDIUM | Governance rules | 6 files present | PASS | `ls .claude/rules/` | Low | AI | No |
| 2 hooks | Agents | MEDIUM | Pre-commit hooks | 2 hooks present | PASS | `ls .claude/hooks/` | Low | Quality | No |
| 5 skills | Agents | MEDIUM | Automation skills | 5 skills present | PASS | `ls .claude/skills/` | Low | AI | No |
| Hooks executable | Quality | HIGH | Hooks can run | Not verified | NOT PROVABLE | File permissions | Medium | Quality | No |

---

## Documentation

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| 13 ADRs | Docs | MEDIUM | Architecture decisions | 13 ADRs present | PASS | `ls docs/adr/` | Low | Architecture | No |
| 17 architecture docs | Docs | MEDIUM | Architecture documentation | 17 docs present | PASS | `ls docs/architecture/` | Low | Architecture | No |
| CLAUDE.md | Docs | MEDIUM | AI agent briefing | Present and comprehensive | PASS | CLAUDE.md | Low | AI | No |
| README.md | Docs | LOW | Project README | Present | PASS | README.md | Low | Platform | No |
| SECURITY.md | Docs | MEDIUM | Security policy | Present | PASS | SECURITY.md | Low | Security | No |
| Runbooks | Docs | HIGH | Operational runbooks | None present | NOT IMPLEMENTED | docs/runbooks/ | HIGH | Ops | Yes |
| Incident response docs | Docs | HIGH | IR procedures | Not found | NOT IMPLEMENTED | docs/security/ | High | Security | Yes |
| SLO documentation | Docs | HIGH | Service level objectives | Not found | NOT IMPLEMENTED | No SLO files | High | Ops | Yes |

---

## Security Workflow

| Item | Domain | Criticality | Expected | Found | Status | Evidence | Risk | Owner | Blocks Production |
|---|---|---|---|---|---|---|---|---|---|
| CodeQL analysis | Security | HIGH | SAST scanning | Configured in security.yaml | PASS | .github/workflows/security.yaml | Low | Security | Yes |
| Secret scanning hook | Security | HIGH | Pre-commit secret detection | pre-commit-secrets.sh present | PASS | .claude/hooks/ | Low | Security | Yes |
| Naming validation hook | Security | MEDIUM | Convention enforcement | validate-naming.sh present | PASS | .claude/hooks/ | Low | Quality | No |
| npm audit | Security | HIGH | Dependency vulnerability scan | Configured at --audit-level=high | PASS | ci.yaml | Low | Security | Yes |
| Container image scanning | Security | HIGH | CVE scanning before push | Placeholder only | PARTIAL | ci.yaml | HIGH | Security | Yes |
| SBOM generation | Security | MEDIUM | Software bill of materials | Not implemented | NOT IMPLEMENTED | Workflows | Medium | Security | No |
| Image signing (cosign) | Security | MEDIUM | Supply chain integrity | Not implemented | NOT IMPLEMENTED | Workflows | Medium | Security | No |
| mTLS between services | Security | HIGH | Mutual TLS in-cluster | Not configured | NOT IMPLEMENTED | No Istio/Linkerd | High | Security | Yes |

---

*Matrix last updated: 2026-04-08. Re-run cluster audit to refresh evidence column.*
