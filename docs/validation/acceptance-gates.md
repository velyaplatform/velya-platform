# Acceptance Gates — Velya Platform

**Date**: 2026-04-08
**Purpose**: Formal readiness gates that must be passed before milestone sign-off
**Scope**: Development milestone → Production certification

---

## Gate Overview

| Gate    | Name                      | Status               | Blocking Production |
| ------- | ------------------------- | -------------------- | ------------------- |
| Gate 0  | Repository Existence Gate | PASS                 | No                  |
| Gate 1  | Build & CI Gate           | PASS WITH CONDITIONS | Yes                 |
| Gate 2  | Runtime Gate              | PARTIAL              | Yes                 |
| Gate 3  | Observability Gate        | PARTIAL              | Yes                 |
| Gate 4  | Security Gate             | PARTIAL              | Yes                 |
| Gate 5  | GitOps Gate               | PARTIAL — BLOCKER    | Yes                 |
| Gate 6  | Autoscaling Gate          | FAIL                 | Yes                 |
| Gate 7  | Network Isolation Gate    | PASS WITH CONDITIONS | Yes                 |
| Gate 8  | Secrets Gate              | PASS WITH CONDITIONS | Yes                 |
| Gate 9  | Frontend Gate             | PARTIAL              | Yes                 |
| Gate 10 | Documentation Gate        | PARTIAL              | Yes                 |
| Gate 11 | Production Readiness Gate | FAIL                 | Yes                 |

---

## Gate 0: Repository Existence Gate

### Definition

The monorepo exists, is version-controlled, and contains the expected top-level structure for all platform components.

### Criteria

- [ ] Git repository initialized and accessible
- [ ] All top-level directories present: apps/, services/, platform/, packages/, infra/, docs/, tests/, .claude/
- [ ] CLAUDE.md agent briefing present
- [ ] package.json and turbo.json at root
- [ ] At least one ADR recorded
- [ ] README.md present

### Current Status: PASS

### Evidence

- Repository present at `/home/jfreire/velya/velya-platform/`
- All required directories confirmed: apps/, services/, platform/, packages/, infra/, docs/, tests/, .claude/
- 13 ADRs in docs/adr/
- CLAUDE.md present and comprehensive
- turbo.json, package.json, README.md all present

### Blocking Issues

None.

### Remediation

N/A.

---

## Gate 1: Build & CI Gate

### Definition

All code compiles, linting passes, unit tests pass, and the CI pipeline runs successfully on every commit.

### Criteria

- [ ] TypeScript compiles without errors across all packages
- [ ] ESLint passes for all packages
- [ ] All unit tests pass
- [ ] CI runs on every PR (ci.yaml)
- [ ] GitHub Actions pinned by SHA
- [ ] npm audit passes at --audit-level=high
- [ ] Security workflow (CodeQL) runs
- [ ] Release workflow configured

### Current Status: PASS WITH CONDITIONS

### Evidence

- 4 GitHub Actions workflows present: ci.yaml, security.yaml, release.yaml, version-bump.yaml
- All workflows use SHA-pinned actions (verified)
- npm audit configured at --audit-level=high in ci.yaml
- CodeQL configured in security.yaml
- Only 1 unit test file present (tests/unit/platform.test.ts) — coverage is minimal
- No integration tests exist
- Image scanning is a placeholder in CI

### Blocking Issues

1. Container image scanning is a placeholder — must be replaced with Trivy or equivalent
2. Test coverage is near zero — 1 stub test does not constitute a passing test suite
3. No integration tests in CI pipeline

### Remediation

1. Replace image scanning placeholder with `aquasecurity/trivy-action` (pinned by SHA)
2. Write unit tests for all service packages (target: 80% coverage)
3. Add integration tests using Testcontainers for each service
4. Enable test coverage reporting and gate on coverage threshold

---

## Gate 2: Runtime Gate

### Definition

All platform services are running in the cluster, are healthy, and respond to health check requests with correct status codes.

### Criteria

- [ ] All 13 services accessible via HTTP
- [ ] All pods in Running state (no CrashLoopBackOff)
- [ ] Health endpoints return 200 OK
- [ ] Services implement actual business logic (not scaffold)
- [ ] Database connections established
- [ ] NATS connections established
- [ ] Services emit OpenTelemetry traces

### Current Status: PARTIAL

### Evidence

- 64 pods running across 8 namespaces — no crashes detected
- All 13 Ingresses confirmed with working nip.io URLs
- HTTP 200 responses from all service endpoints
- Services are scaffold implementations — no real business logic
- Database connectivity: not verified (no integration tests)
- NATS JetStream: not confirmed connected
- OTel instrumentation: present in packages/observability but not confirmed in services

### Blocking Issues

1. All backend services are scaffold code — no clinical, AI, or platform logic implemented
2. No database schema migrations confirmed
3. No NATS JetStream subject subscriptions confirmed
4. No evidence of end-to-end data flow through any service
5. All deployments single-replica — no HA

### Remediation

1. Implement core business logic for patient-flow, discharge-orchestrator, task-inbox, audit-service
2. Implement core AI platform logic: ai-gateway (provider routing), policy-engine, decision-log-service
3. Write and apply database migrations
4. Confirm NATS connectivity with integration tests
5. Scale all critical deployments to minimum 2 replicas for HA

---

## Gate 3: Observability Gate

### Definition

Platform produces metrics, logs, and traces. Alerts fire when services degrade. Dashboards provide operational visibility.

### Criteria

- [ ] Prometheus scraping all Velya services
- [ ] Grafana accessible with service-specific dashboards
- [ ] Loki receiving logs from all services
- [ ] OTel traces visible in Grafana
- [ ] ServiceMonitors configured for all Velya services
- [ ] Alert rules defined and active
- [ ] SLOs defined per service
- [ ] On-call runbooks linked to alerts

### Current Status: PARTIAL

### Evidence

- Prometheus: PASS — running, scraping 12 ServiceMonitors (infrastructure-level only)
- Grafana: PASS — accessible at grafana.nip.io, admin/prom-operator, 3 datasources configured
- Loki: PASS — running with canary and cache components
- Promtail: PASS — 3 instances running on cluster nodes
- OTel Collector: PASS — running
- ServiceMonitors for Velya services: NOT IMPLEMENTED (only infra monitors exist)
- Custom dashboards: NOT IMPLEMENTED
- Alert rules for Velya services: NOT IMPLEMENTED
- SLO definitions: NOT IMPLEMENTED

### Blocking Issues

1. No ServiceMonitors for any Velya application service
2. No Grafana dashboards for service health (RED metrics)
3. No alerting rules for service failures
4. No SLOs defined — cannot know when the platform is violating objectives
5. No runbooks linked to alerts

### Remediation

1. Create ServiceMonitor resources for each Velya service (patient-flow, discharge, task-inbox, audit, ai-gateway, policy-engine, memory-service, decision-log, agent-orchestrator)
2. Create Grafana dashboards per service: request rate, error rate, latency (RED)
3. Define SLOs: availability (99.9%), latency (p99 < 500ms for clinical operations)
4. Create PrometheusRule resources for: service down, high error rate, high latency, quota exhaustion
5. Link alert annotations to runbooks in docs/runbooks/

---

## Gate 4: Security Gate

### Definition

The platform meets baseline security requirements for a healthcare system handling clinical data.

### Criteria

- [ ] GitHub Actions pinned by SHA
- [ ] No secrets in code
- [ ] SAST (CodeQL) running
- [ ] Container image scanning (not placeholder)
- [ ] Pre-commit secret detection
- [ ] TLS on all ingresses
- [ ] NetworkPolicies enforcing default deny
- [ ] Pod Security Standards enforced
- [ ] SBOM generated per image
- [ ] Image signing configured
- [ ] mTLS between services
- [ ] Branch protection on main

### Current Status: PARTIAL

### Evidence

- SHA pinning: PASS — all 4 workflows verified
- No secrets in code: PASS — pre-commit-secrets.sh + CodeQL
- CodeQL: PASS — configured in security.yaml
- npm audit: PASS — at --audit-level=high
- Container image scanning: PARTIAL — placeholder only
- TLS on ingresses: NOT IMPLEMENTED — all HTTP only (nip.io)
- NetworkPolicies: PASS — configured per tier
- Pod Security Standards: NOT PROVABLE
- SBOM: NOT IMPLEMENTED
- Image signing: NOT IMPLEMENTED
- mTLS: NOT IMPLEMENTED
- Branch protection: NOT PROVABLE (no GitHub API access)

### Blocking Issues

1. No TLS on any ingress — all traffic is plaintext HTTP
2. Container image scanning is a placeholder — CVEs could ship undetected
3. No mTLS between services — lateral movement risk
4. SBOM not generated — supply chain not traceable
5. Pod Security Standards not confirmed enforced

### Remediation

1. Install cert-manager, configure Let's Encrypt or self-signed CA for dev
2. Add TLS to all 13 Ingress resources
3. Replace image scanning placeholder with Trivy action
4. Configure Linkerd or Cilium for mTLS (service mesh)
5. Generate SBOM in CI using Syft or grype
6. Confirm Pod Security Standards with: `kubectl get ns -o jsonpath='{.items[*].metadata.labels}'`

---

## Gate 5: GitOps Gate

### Definition

All cluster state is delivered and managed by ArgoCD. No manual kubectl applies in any environment. Git is the single source of truth for cluster state.

### Criteria

- [ ] ArgoCD running and accessible
- [ ] ArgoCD Application manifests committed to git
- [ ] All services delivered via ArgoCD (no manual apply)
- [ ] App-of-Apps pattern implemented
- [ ] Auto-sync enabled for dev environment
- [ ] Manual sync with approval for staging/prod
- [ ] Drift detection configured
- [ ] Sync failures alert to team

### Current Status: PARTIAL — BLOCKER

### Evidence

- ArgoCD installation: PASS — 7 pods running in argocd namespace
- ArgoCD UI: PASS — accessible at argocd.172.19.0.6.nip.io
- ArgoCD Application manifests: BLOCKER — none found in repository
- `infra/kubernetes/` contains apps/, base/, overlays/, platform/, services/ directories
- No ArgoCD Application CRDs deployed — current cluster state was applied manually
- All 64 running pods were deployed without GitOps delivery

### Blocking Issues

1. CRITICAL: No ArgoCD Application manifests exist anywhere in the repository
2. All current cluster state is manually applied — not tracked by ArgoCD
3. Drift detection impossible without Applications configured
4. Cannot promote to staging without GitOps delivery pipeline

### Remediation

```yaml
# Example: Create infra/argocd/apps/velya-dev-core.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: velya-dev-core
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/velya/velya-platform
    targetRevision: main
    path: infra/kubernetes/overlays/dev
  destination:
    server: https://kubernetes.default.svc
    namespace: velya-dev-core
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

1. Create ArgoCD Application manifests for each namespace/service group
2. Create root App-of-Apps pointing to infra/argocd/
3. Apply root app, let ArgoCD take over delivery
4. Verify all services sync correctly via ArgoCD

---

## Gate 6: Autoscaling Gate

### Definition

Services scale automatically in response to load, preventing resource exhaustion and ensuring availability during peak demand.

### Criteria

- [ ] KEDA installed
- [ ] ScaledObjects configured for each stateless service
- [ ] Scaling triggers defined (NATS queue depth, HTTP RPS, CPU)
- [ ] Scale-to-zero for non-critical services in dev
- [ ] HPA configured for web tier
- [ ] Load testing validates scaling behavior
- [ ] Scale-down grace periods configured

### Current Status: FAIL

### Evidence

- KEDA: PASS — installed in cluster
- ScaledObjects: FAIL — zero ScaledObjects configured
- HPA: NOT IMPLEMENTED
- Load testing: NOT IMPLEMENTED
- All services run at fixed 1 replica — no autoscaling active

### Blocking Issues

1. No ScaledObjects — KEDA is installed but does nothing
2. Single replica means any service restart causes complete downtime
3. No capacity planning done — unknown if resources are sufficient under load
4. No load testing baseline established

### Remediation

```yaml
# Example: ScaledObject for patient-flow service
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: patient-flow-scaler
  namespace: velya-dev-core
spec:
  scaleTargetRef:
    name: patient-flow
  minReplicaCount: 1
  maxReplicaCount: 10
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus.velya-dev-observability.svc.cluster.local:9090
        metricName: http_requests_total
        threshold: '100'
        query: sum(rate(http_requests_total{service="patient-flow"}[1m]))
```

1. Create ScaledObjects for all stateless services
2. Define NATS-based triggers for event-driven services
3. Configure HTTP-based triggers for web-facing services
4. Run k6 or Locust load tests to validate scaling thresholds

---

## Gate 7: Network Isolation Gate

### Definition

Network traffic between services is restricted to declared paths only. No unauthorized lateral movement is possible.

### Criteria

- [ ] NetworkPolicies configured for all namespaces
- [ ] Default deny ingress and egress
- [ ] Only required paths explicitly allowed
- [ ] Ingress traffic isolated per tier
- [ ] No cross-namespace access unless explicitly allowed
- [ ] mTLS enforced (service mesh)
- [ ] Network policy tests passing

### Current Status: PASS WITH CONDITIONS

### Evidence

- NetworkPolicies: PASS — configured per tier (backend, frontend, platform, AI)
- Policy coverage: assumed complete for all 8 namespaces
- mTLS: NOT IMPLEMENTED — no service mesh installed
- NetworkPolicy testing: NOT IMPLEMENTED — no automated tests
- Egress control: not verified

### Blocking Issues

1. No mTLS — traffic between services is plaintext in-cluster
2. NetworkPolicy effectiveness not tested (no policy audit tools)
3. Egress policies not confirmed — services may reach external internet

### Remediation

1. Install Cilium or Linkerd for mTLS and enhanced network observability
2. Run network policy conformance tests using `network-policy-conformance` tool
3. Verify egress policies block unexpected external access
4. Use Hubble (Cilium) or equivalent for network flow visibility

---

## Gate 8: Secrets Gate

### Definition

All secrets are externally managed. No credentials exist in code, environment variables, or ConfigMaps. ESO syncs secrets from a secure store.

### Criteria

- [ ] ESO installed and running
- [ ] ClusterSecretStore configured and valid
- [ ] ExternalSecret resources for every service secret
- [ ] No secrets in git (scanned)
- [ ] Secret rotation configured
- [ ] AWS Secrets Manager for production (not LocalStack)
- [ ] Audit log for secret access

### Current Status: PASS WITH CONDITIONS

### Evidence

- ESO: PASS — installed
- ClusterSecretStore (LocalStack): PASS — valid and ready
- No secrets in code: PASS — pre-commit-secrets.sh + CodeQL
- ExternalSecret resources: NOT PROVABLE — not verified per service
- AWS Secrets Manager for prod: NOT IMPLEMENTED — LocalStack is dev-only
- Secret rotation: NOT IMPLEMENTED
- Audit log for secret access: NOT IMPLEMENTED

### Blocking Issues

1. LocalStack is a dev-only mock — real AWS Secrets Manager required for production
2. ExternalSecret CRDs not confirmed per service — some services may not have secrets wired
3. No secret rotation configured

### Remediation

1. Provision AWS Secrets Manager in prod OpenTofu configuration
2. Update ClusterSecretStore to reference real AWS SM
3. Verify each service has a corresponding ExternalSecret resource
4. Configure automatic secret rotation in AWS SM
5. Enable CloudTrail for secret access auditing

---

## Gate 9: Frontend Gate

### Definition

The hospital operations frontend provides the core workflow UI required for clinical operations. Users can complete key workflows within the click budget.

### Criteria

- [ ] Next.js application running
- [ ] Patient Operational Cockpit implemented
- [ ] Unified Action Inbox implemented
- [ ] Discharge Control Tower implemented
- [ ] Role-based workspace routing
- [ ] Degraded mode UI
- [ ] WCAG 2.1 AA accessibility
- [ ] Core workflows completable within 3-click budget
- [ ] Real-time updates (WebSocket or SSE)
- [ ] Tested on clinical device sizes

### Current Status: PARTIAL

### Evidence

- Next.js: PASS — running at velya.172.19.0.6.nip.io
- Current UI: Basic scaffold with 3 feature cards on homepage
- Patient Cockpit: NOT IMPLEMENTED
- Action Inbox: NOT IMPLEMENTED
- Discharge Tower: NOT IMPLEMENTED
- Role-based routing: NOT IMPLEMENTED
- Degraded mode: NOT IMPLEMENTED
- Accessibility tests: NOT IMPLEMENTED
- Real-time updates: NOT IMPLEMENTED
- Frontend score: 8/100

### Blocking Issues

1. No clinical workflow UI exists — the frontend is non-functional for hospital operations
2. No role-based access or workspace differentiation
3. No real-time data — static pages only
4. No accessibility compliance validated
5. Degraded mode (offline/downtime) not implemented

### Remediation

See `docs/frontend/revolutionary-frontend-principles.md` and `docs/validation/frontend-revolution-validation.md` for full roadmap.

---

## Gate 10: Documentation Gate

### Definition

Operational documentation is complete enough that a new team member or on-call engineer can operate the platform without tribal knowledge.

### Criteria

- [ ] README.md accurate and up to date
- [ ] Architecture decisions recorded (ADRs)
- [ ] Runbooks for common failure scenarios
- [ ] Incident response procedures
- [ ] Service-level documentation per service
- [ ] Onboarding guide
- [ ] SLO documentation
- [ ] Frontend principles documented

### Current Status: PARTIAL

### Evidence

- README.md: PASS
- ADRs: PASS — 13 ADRs
- Architecture docs: PASS — 17 documents
- Runbooks: NOT IMPLEMENTED — directory exists, no files
- Incident response: NOT IMPLEMENTED
- Service-level docs: NOT IMPLEMENTED per service
- SLO documentation: NOT IMPLEMENTED
- Frontend principles: Being created in this run

### Blocking Issues

1. No runbooks — on-call engineers have no guidance
2. No incident response procedures
3. No SLO documentation

### Remediation

1. Write runbooks for: service health (see docs/runbooks/service-health-runbook.md), observability, database failures, ArgoCD sync failures
2. Write incident response playbook for P1 events
3. Define and document SLOs for all critical services

---

## Gate 11: Production Readiness Gate

### Definition

The platform is ready for production workloads: real clinical data, real patients, regulatory scrutiny, and 24/7 operations.

### Criteria

- [ ] All Gates 0–10 PASS or PASS WITH CONDITIONS
- [ ] EKS cluster provisioned in AWS
- [ ] Multi-AZ deployment
- [ ] HIPAA technical safeguards implemented
- [ ] DR/backup procedures tested
- [ ] Penetration testing completed
- [ ] Load testing at 2x expected peak
- [ ] Legal/compliance review complete
- [ ] SOC 2 / ISO 27001 audit readiness
- [ ] 24/7 on-call rotation established
- [ ] Runbooks complete and tested

### Current Status: FAIL

### Evidence

- Gates 5 and 6 are FAIL/BLOCKER
- Gates 2, 3, 4, 7, 8, 9, 10 are PARTIAL
- No EKS cluster
- No HIPAA technical safeguard documentation
- No DR/backup procedures
- No penetration testing
- No load testing
- No compliance review

### Blocking Issues

See `docs/validation/production-certification.md` for full list of production blockers.

### Remediation

Production readiness requires completing all prior gates. Estimated effort: 3–6 months from current state.

---

## Gate Dependency Map

```
Gate 0 (Repo) ──→ Gate 1 (CI)
                    │
                    ↓
                Gate 2 (Runtime) ──→ Gate 5 (GitOps)
                    │                    │
                    ↓                    ↓
                Gate 3 (Observability)  Gate 6 (Autoscaling)
                    │
                    ↓
                Gate 4 (Security) ──→ Gate 7 (Network)
                                          │
                Gate 8 (Secrets) ─────────┤
                                          │
                Gate 9 (Frontend) ────────┤
                                          │
                Gate 10 (Docs) ───────────┤
                                          ↓
                                    Gate 11 (Production)
```

---

_Acceptance gates are reviewed at each milestone checkpoint. Gates can only be marked PASS by the designated owner with evidence recorded in docs/validation/evidence-index.md._
