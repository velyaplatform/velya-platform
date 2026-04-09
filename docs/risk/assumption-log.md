# Assumption Log — Velya Platform

**Version**: 1.0  
**Date**: 2026-04-08  
**Classification**: Internal — Restricted  
**Purpose**: Formal register of all assumptions upon which the Velya platform design, implementation, and operational model depends. Unvalidated assumptions are risks. Invalidated assumptions are blockers.  
**Review Cadence**: Monthly; whenever a major architectural decision is made; after any production incident

---

## How to Read This Log

- **Status: Assumed** — accepted as true but not yet validated with evidence
- **Status: Validated** — confirmed with empirical evidence (test results, pilot data, vendor confirmation)
- **Status: Invalidated** — evidence has shown the assumption to be false; see `invalidated-assumptions.md`
- **Risk if Wrong**: Low / Medium / High / Critical — consequence if assumption turns out to be false

---

## Category 1: Technical Assumptions

| ID       | Statement                                                                                                                                                           | Owner    | Risk if Wrong | Validation Method                                                                                                        | Status          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------- |
| TECH-001 | kindnet enforces NetworkPolicy objects, providing pod-to-pod traffic isolation                                                                                      | Infra    | Critical      | Test: deploy two pods, apply deny NetworkPolicy, attempt curl between them; verify traffic blocked                       | **Invalidated** |
| TECH-002 | All 13 Velya HTTP services are running functional business logic, not scaffolds                                                                                     | Platform | Catastrophic  | Code inspection + API behavior test per service                                                                          | **Invalidated** |
| TECH-003 | ArgoCD is actively delivering Kubernetes manifests from git to the cluster                                                                                          | Infra    | Critical      | `argocd app list` returning non-empty; verify git ↔ cluster sync                                                         | **Invalidated** |
| TECH-004 | NATS JetStream is configured with persistence, retention policies, and dead letter queues for clinical event subjects                                               | Platform | Critical      | `nats stream ls` and `nats consumer ls` per clinical subject                                                             | Assumed         |
| TECH-005 | Medplum FHIR server is configured with tenant-appropriate access controls and is not publicly accessible                                                            | Clinical | Critical      | Network probe from external IP; Medplum client authorization scope inspection                                            | Assumed         |
| TECH-006 | ExternalSecrets Operator is successfully syncing all per-service secrets from LocalStack to Kubernetes Secrets                                                      | Platform | High          | `kubectl get externalsecret -A` status check; verify Kubernetes Secret exists per service                                | Assumed         |
| TECH-007 | Temporal workflow engine can persist workflow state through pod restarts without data loss                                                                          | Clinical | High          | Kill Temporal worker pod during workflow execution; verify workflow resumes on restart                                   | Assumed         |
| TECH-008 | The Anthropic Claude API will remain available at the rate and latency required for real-time clinical workflows (< 3 second P95 response time for agent decisions) | AI Team  | High          | Anthropic SLA review; latency benchmark test with representative clinical prompts                                        | Assumed         |
| TECH-009 | Container images built from the monorepo will not contain any supply chain vulnerabilities at the time of initial production deployment                             | Security | High          | Trivy scan on all images before production; SBOM generation and review                                                   | Assumed         |
| TECH-010 | The kind cluster accurately represents the behavior of AWS EKS for all infrastructure-level concerns tested in development                                          | Infra    | High          | EKS deployment test in staging; compare behavior of NetworkPolicy, PDB, autoscaling, PriorityClass                       | Assumed         |
| TECH-011 | Prometheus can scrape all Velya service metrics within the 30-second scrape interval without timeout                                                                | Ops      | Medium        | Verify all ServiceMonitor targets show `UP` status; scrape duration < 30s per target                                     | Assumed         |
| TECH-012 | Next.js server-side rendering will be fast enough for hospital use cases without CDN caching for initial launch                                                     | Frontend | Medium        | Load test with realistic concurrent user count (100 clinical staff); measure TTFB under load                             | Assumed         |
| TECH-013 | PostgreSQL will be the correct database for patient-flow and discharge-orchestrator at the scale of a 500-bed hospital                                              | Platform | Medium        | Capacity model: 500 beds × 3 admissions/day × 365 days = ~550K records/year; verify PostgreSQL handles without partition | Assumed         |
| TECH-014 | KEDA can scale services fast enough to handle admission surges without dropping events (scale from 1 to 10 replicas in < 2 minutes)                                 | Infra    | High          | KEDA scale-up test with simulated NATS message surge                                                                     | Assumed         |
| TECH-015 | The Velya monorepo Turborepo build cache will function correctly in GitHub Actions with the configured cache key strategy                                           | CI/CD    | Low           | CI build cache hit rate monitoring                                                                                       | Assumed         |
| TECH-016 | cert-manager can issue internal TLS certificates for all 13 Velya services without degrading API server performance                                                 | Security | Medium        | cert-manager deployment with 13 Certificate resources; verify issuance time < 30s each                                   | Assumed         |
| TECH-017 | OpenTofu state can be safely stored in an S3 backend with DynamoDB locking without race conditions in CI                                                            | Infra    | Medium        | Concurrent plan test; verify only one plan runs at a time                                                                | Assumed         |

---

## Category 2: Operational Assumptions

| ID      | Statement                                                                                                                                 | Owner    | Risk if Wrong | Validation Method                                                                              | Status  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | ---------------------------------------------------------------------------------------------- | ------- |
| OPS-001 | The hospital IT team has sufficient Kubernetes operational expertise to manage the EKS cluster and respond to incidents                   | Ops      | High          | Hospital IT capability assessment; define minimum competency requirements                      | Assumed |
| OPS-002 | Clinical staff will adopt AI-assisted workflows within the first 3 months of go-live without extensive retraining                         | Clinical | High          | Pilot with 10 staff members; adoption tracking; feedback surveys                               | Assumed |
| OPS-003 | On-call engineers can respond to production incidents within 15 minutes at any hour                                                       | Ops      | High          | Measure incident response time in staging; verify PagerDuty escalation chain                   | Assumed |
| OPS-004 | The hospital network has sufficient bandwidth and stability for real-time WebSocket connections for all concurrent clinical users         | Infra    | Medium        | Network capacity assessment at the hospital; simulate 200 concurrent WebSocket connections     | Assumed |
| OPS-005 | The hospital can maintain a rolling 35-day RDS backup without exceeding storage budget                                                    | Infra    | Low           | Calculate storage cost: database size × 35 days growth rate                                    | Assumed |
| OPS-006 | Runbook execution by a junior SRE without platform team involvement is sufficient for standard operational procedures                     | Ops      | Medium        | Runbook walkthrough test with junior SRE; identify gaps                                        | Assumed |
| OPS-007 | A 4-hour Recovery Time Objective (RTO) is acceptable to the hospital for full platform recovery                                           | Clinical | Critical      | SLA negotiation with hospital; clinical staff input on acceptable downtime                     | Assumed |
| OPS-008 | Grafana dashboards provide sufficient observability for the on-call team to diagnose most production incidents without additional tooling | Ops      | Medium        | Tabletop exercise: present incident scenario; can on-call team diagnose using only dashboards? | Assumed |

---

## Category 3: Clinical Assumptions

| ID       | Statement                                                                                                                                                                   | Owner    | Risk if Wrong | Validation Method                                                                               | Status  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | ----------------------------------------------------------------------------------------------- | ------- |
| CLIN-001 | Clinical staff will trust AI recommendations enough to act on them without verifying every recommendation manually                                                          | Clinical | High          | Pilot study with clinical staff; measure override rate and trust level                          | Assumed |
| CLIN-002 | The FHIR R4 data model is sufficient to represent all clinical concepts needed by Velya agents (patient flow, discharge, task assignment, medication reconciliation)        | Clinical | High          | Clinical data requirements workshop; FHIR resource mapping exercise                             | Assumed |
| CLIN-003 | Discharge criteria can be fully represented as FHIR resources and evaluated by an automated agent without missing clinically relevant nuance                                | Clinical | High          | Clinical review of automated discharge criteria logic by medical officer                        | Assumed |
| CLIN-004 | Early warning scoring algorithms (e.g., NEWS2) can be computed from Vitals and Lab FHIR Observation resources available in Medplum                                          | Clinical | High          | Validate NEWS2 calculation against manual chart review with clinical staff                      | Assumed |
| CLIN-005 | Bed allocation recommendations by AI can reduce the manual work of charge nurses by at least 50%                                                                            | Clinical | Medium        | Pilot: measure nurse time on bed allocation before and after AI assistance                      | Assumed |
| CLIN-006 | A 5-minute acknowledgment window for critical deterioration alerts is clinically acceptable before escalation                                                               | Clinical | Critical      | Clinical review of escalation protocol with medical officer; compare with existing policy       | Assumed |
| CLIN-007 | The task-inbox model (inbox + priority queue + assignment) is the correct abstraction for clinical task routing across all clinical roles                                   | Clinical | Medium        | User research with nurses, physicians, and administrators during design phase                   | Assumed |
| CLIN-008 | Medplum is a sufficiently complete and reliable FHIR server for a 500-bed hospital at production scale                                                                      | Clinical | High          | Medplum load test; Medplum SLA review; Medplum FHIR compliance certification review             | Assumed |
| CLIN-009 | Clinical workflows in a hospital follow consistent enough patterns to be modeled as Temporal workflows without requiring manual exception handling in the majority of cases | Clinical | Medium        | Process mining on historical clinical data; identify exception rate in current manual processes | Assumed |
| CLIN-010 | Nurses and physicians will report AI errors through the provided feedback mechanism rather than simply overriding and moving on                                             | Clinical | High          | User research; observe override behavior in pilot; design friction into override flow           | Assumed |

---

## Category 4: Regulatory Assumptions

| ID      | Statement                                                                                                                                                          | Owner      | Risk if Wrong | Validation Method                                                         | Status  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------- | ------------------------------------------------------------------------- | ------- |
| REG-001 | Anthropic's enterprise Claude API offer provides a BAA that satisfies HIPAA requirements for covered entities                                                      | Legal      | Catastrophic  | Legal review of Anthropic BAA; confirm covered entity protections         | Assumed |
| REG-002 | The Velya platform does not qualify as a Software as a Medical Device (SaMD) under FDA guidance, exempting it from 510(k) clearance or de novo review requirements | Legal      | Critical      | FDA pre-submission consultation; legal analysis of intended use statement | Assumed |
| REG-003 | HIPAA's Minimum Necessary Rule is satisfied by limiting agent access to FHIR resources relevant to the current clinical task                                       | Compliance | High          | HIPAA counsel review of data minimization implementation                  | Assumed |
| REG-004 | State-level health data regulations (beyond HIPAA) in the target hospital's state do not impose additional requirements that Velya does not currently meet         | Legal      | High          | State law review per deployment location                                  | Assumed |
| REG-005 | The current audit-service architecture can produce the access logs and change records required by HIPAA §164.312(b)                                                | Compliance | High          | HIPAA technical controls assessment by qualified assessor                 | Assumed |
| REG-006 | The hospital's existing HIPAA Security Rule documentation can be extended to cover Velya's AI layer without a full re-assessment                                   | Compliance | Medium        | HIPAA risk analysis per §164.308(a)(1) specifically for Velya             | Assumed |

---

## Category 5: Human Behavior Assumptions

| ID     | Statement                                                                                                               | Owner      | Risk if Wrong | Validation Method                                                                                   | Status  |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ---------- | ------------- | --------------------------------------------------------------------------------------------------- | ------- |
| HB-001 | Clinical staff will not deliberately enter malicious text into clinical fields with the intent to manipulate the AI     | Security   | Medium        | Cannot fully validate; mitigate via prompt injection defenses regardless                            | Assumed |
| HB-002 | Hospital administrators will not attempt to manipulate AI agent behavior by modifying system prompts directly           | Governance | High          | Governance controls: system prompt changes require PR review with clinical officer approval         | Assumed |
| HB-003 | Physicians will exercise clinical judgment and override AI recommendations when they disagree, even under time pressure | Clinical   | High          | Pilot: track override rates; design override flow to reduce friction                                | Assumed |
| HB-004 | Engineers will not commit secrets to the git repository despite having the technical ability to bypass pre-commit hooks | Security   | High          | CodeQL scanning in CI as secondary defense; routine secret scanning audits                          | Assumed |
| HB-005 | Hospital IT staff will perform required certificate renewals and secret rotations before expiry                         | Ops        | High          | Automated certificate renewal via cert-manager; automated secret rotation; expiry alerts at 14 days | Assumed |
| HB-006 | Clinical staff will use only approved workstations and will not access Velya from personal devices                      | Security   | Medium        | Policy enforcement via conditional access in IdP; device compliance checks                          | Assumed |

---

## Category 6: Cost Assumptions

| ID       | Statement                                                                                                                                                            | Owner    | Risk if Wrong | Validation Method                                                                                        | Status  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| COST-001 | The monthly Anthropic API cost at full production scale (500 beds, all agents active) will remain within the hospital's technology budget ($X/month — to be defined) | Platform | High          | Token cost model: estimate tokens per agent invocation × invocations per day × Anthropic price per token | Assumed |
| COST-002 | AWS EKS compute costs at production scale will be lower than maintaining an equivalent on-premises Kubernetes cluster                                                | Infra    | Medium        | TCO comparison: EKS cost model vs. on-premises hardware + ops cost                                       | Assumed |
| COST-003 | Spot instances are appropriate for at least 50% of Velya workloads (non-clinical-critical background processing)                                                     | Infra    | Medium        | Classify workloads by interruption tolerance; spot interruption rate analysis for target AZ              | Assumed |
| COST-004 | The Medplum managed cloud offering (if used) will be cost-effective relative to self-managed Medplum on EKS                                                          | Clinical | Medium        | Medplum cloud pricing vs. self-hosted EKS cost including operational overhead                            | Assumed |
| COST-005 | Log volume at production scale will not exceed Loki's ingest capacity within the allocated storage budget                                                            | Ops      | Medium        | Estimate log volume: 13 services × avg log rate × log size × retention period                            | Assumed |

---

## Category 7: AI/Agent Assumptions

| ID     | Statement                                                                                                                                                | Owner    | Risk if Wrong | Validation Method                                                                                                                 | Status  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------- |
| AI-001 | Claude 3.5 Sonnet (or current equivalent) is sufficiently capable to perform clinical reasoning tasks required by Velya agents without systematic errors | AI Team  | Catastrophic  | Clinical benchmark: present 100 representative clinical scenarios; evaluate model responses against clinical expert gold standard | Assumed |
| AI-002 | LLM-based agents can perform discharge criteria assessment with at least 95% accuracy compared to physician ground truth                                 | AI Team  | Critical      | Retrospective validation: run agent on historical cases with known outcomes; compare against physician decisions                  | Assumed |
| AI-003 | Agent context windows (up to 200k tokens for Claude) are sufficient to hold all relevant patient context for any clinical scenario                       | AI Team  | Medium        | Profile typical patient context size: FHIR bundle size × typical encounter complexity                                             | Assumed |
| AI-004 | NATS JetStream is the correct message broker for agent-to-agent coordination at hospital scale; it will not be a bottleneck at production event rates    | Platform | High          | Load test: simulate 1000 events/second through NATS; measure consumer lag                                                         | Assumed |
| AI-005 | Agents can be made to reliably follow clinical workflow constraints via prompt engineering alone, without requiring fine-tuning                          | AI Team  | High          | Evaluate agent constraint adherence with adversarial test cases; measure constraint violation rate                                | Assumed |
| AI-006 | The memory-service caching architecture is sufficient to provide agents with personalized patient context at acceptable latency (< 500ms for cache hit)  | AI Team  | Medium        | Load test memory-service with concurrent agent requests; measure cache hit latency                                                | Assumed |
| AI-007 | Platform/policy-engine can accurately classify clinical agent decisions as safe/unsafe using rule-based logic without requiring an LLM                   | AI Team  | High          | Define 200 clinical scenarios; evaluate policy-engine classification accuracy against clinical expert labels                      | Assumed |

---

## Assumption Risk Summary

| Category       | Total  | Validated          | Invalidated | Assumed (Unvalidated) | Critical/Catastrophic Risk |
| -------------- | ------ | ------------------ | ----------- | --------------------- | -------------------------- |
| Technical      | 17     | 1 (CI SHA pinning) | 3           | 13                    | 5                          |
| Operational    | 8      | 0                  | 0           | 8                     | 2                          |
| Clinical       | 10     | 0                  | 0           | 10                    | 2                          |
| Regulatory     | 6      | 0                  | 0           | 6                     | 2                          |
| Human Behavior | 6      | 0                  | 0           | 6                     | 0                          |
| Cost           | 5      | 0                  | 0           | 5                     | 0                          |
| AI/Agent       | 7      | 0                  | 0           | 7                     | 2                          |
| **TOTAL**      | **59** | **1**              | **3**       | **55**                | **13**                     |

**Only 1 of 59 assumptions has been formally validated (CI/CD SHA pinning).** 13 assumptions, if wrong, produce Critical or Catastrophic consequences. Assumption validation should begin with the 13 high-stakes assumptions before any production deployment.

---

_Invalidated assumptions are documented separately in `docs/risk/invalidated-assumptions.md`. When a new technical decision is made that rests on an assumption not listed here, a new assumption entry must be created before the decision is finalized._
