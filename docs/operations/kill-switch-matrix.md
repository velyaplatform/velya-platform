# Kill Switch Matrix
**Velya Hospital AI Platform**
**Document Type:** Operational Safety — Kill Switch Reference
**Date:** 2026-04-08
**Classification:** Internal — Operations Critical
**Status:** Active — Reference Document

---

## Purpose

This matrix defines the kill switch for every automated process in the Velya platform that could cause harm at scale if it operates without bounds or in an incorrect state. A kill switch is a defined, documented, tested mechanism to halt an automated process immediately — before the root cause is understood.

The principle: **stop the bleeding first, investigate second.**

Kill switches are used when:
1. An automated process is producing incorrect or harmful outputs at scale
2. A security event is in progress and automated processes may be exfiltrating or modifying data
3. A cost anomaly indicates runaway automation
4. A clinical incident has occurred that requires all automation to halt pending investigation

**Kill switch activation is not an admission of failure — it is a clinical safety action.**

All kill switch activations are logged to audit-service with the activating user, timestamp, reason, and affected process. Recovery from a kill switch requires a documented investigation outcome before the process is re-enabled.

---

## Kill Switch Reference

---

### KS-001 — AI Inference Calls Per Agent

| Field | Value |
|---|---|
| **Process Name** | AI Inference — Per Agent |
| **What It Automates** | Calls to the Anthropic Claude API from a specific agent within agent-orchestrator |
| **Maximum Blast Radius** | Unbounded token consumption, model cost explosion, PHI exposure at scale if prompt injection active, repeated incorrect clinical recommendations at high volume |
| **Kill Switch Mechanism** | 1. Set environment variable `AGENT_<ID>_INFERENCE_ENABLED=false` in agent-orchestrator ConfigMap; 2. Rolling restart of agent-orchestrator pod (`kubectl rollout restart deployment/agent-orchestrator -n velya-dev-agents`); 3. Alternative: patch ai-gateway to return a static `503 AI_DISABLED` for the specific agent ID without restarting |
| **Who Can Activate** | Platform engineer, clinical governance officer, on-call engineer |
| **Recovery Procedure** | 1. Investigate: review decision-log-service for the agent's last 100 decisions to identify the incorrect behavior; 2. Review: NATS event log for any downstream clinical actions triggered by the agent; 3. Remediate: fix the agent configuration, prompt, or scope definition; 4. Validate: run adversarial test T-AI-005 against the remediated agent in a test environment; 5. Re-enable: set `AGENT_<ID>_INFERENCE_ENABLED=true` and restart; 6. Monitor: watch for 60 minutes before returning to normal operations |
| **Monitoring That Should Trigger Kill Switch Recommendation** | Alert: agent token consumption rate > 3x baseline for 5 minutes. Alert: agent error rate > 20% over 10 minutes. Alert: agent producing decisions not matching expected output schema. Manual: governance report shows agent override rate < 2%. |

---

### KS-002 — Automatic PR Creation from Agents

| Field | Value |
|---|---|
| **Process Name** | Automatic PR Creation — Agent Workflows |
| **What It Automates** | Agents (e.g., version-bump agent, remediation agent) that automatically open pull requests in the GitOps or application repository |
| **Maximum Blast Radius** | Repository flood with invalid PRs, incorrect infrastructure changes auto-merged, malicious configuration changes via compromised agent, GitHub API rate limit exhaustion |
| **Kill Switch Mechanism** | 1. Revoke the GitHub PAT used by agent-orchestrator for PR creation (GitHub → Settings → Developer Settings → Personal Access Tokens → Revoke); 2. If PAT is shared, rotate it and do not provide the new token to agent-orchestrator; 3. Set `AGENT_PR_CREATION_ENABLED=false` in agent-orchestrator ConfigMap and restart |
| **Who Can Activate** | Platform engineer, security officer, repository administrator |
| **Recovery Procedure** | 1. Close all open agent-created PRs (review each for malicious content before closing); 2. Audit GitHub Actions runs triggered by agent PRs — determine if any ran with compromised content; 3. Investigate the agent that created the PRs — review its prompt, inputs, and decision log; 4. Generate a new PAT with minimum required scopes; 5. Re-enable after validation in a test repository |
| **Monitoring That Should Trigger Kill Switch Recommendation** | Alert: PR creation rate > 5 PRs per hour from agent service accounts. Alert: PR content includes files outside the expected modification scope. Manual: engineer notices PRs with unusual content (configuration changes, secret modifications). |

---

### KS-003 — Automatic Task Creation

| Field | Value |
|---|---|
| **Process Name** | Automatic Task Creation — Agent and Orchestrator |
| **What It Automates** | Agents and discharge-orchestrator creating tasks in task-inbox-service automatically without direct human initiation |
| **Maximum Blast Radius** | Task inbox flood (hundreds of spurious tasks per hour), clinical staff unable to find real tasks in noise, agent-driven task creation causing clinical confusion, system performance degradation from task table growth |
| **Kill Switch Mechanism** | 1. Add task-inbox-service to NATS authorization deny list for the `velya.task.create` subject (prevent agents from publishing to this subject); 2. Alternatively: set rate limit to 0 on the task creation endpoint in api-gateway for all service accounts; 3. Task creation from human users (clinicians) via velya-web is not affected |
| **Who Can Activate** | Platform engineer, clinical governance officer, on-call engineer |
| **Recovery Procedure** | 1. Archive or delete all tasks created during the runaway period — get clinical input on which tasks were legitimate; 2. Identify which agent or service was responsible for the creation flood; 3. Review and correct the triggering logic (event subscription, threshold, loop condition); 4. Restore NATS authorization; 5. Monitor task creation rate for 30 minutes after re-enable |
| **Monitoring That Should Trigger Kill Switch Recommendation** | Alert: task creation rate > 20 tasks/minute from non-human sources. Alert: task-inbox-service queue depth > 200 unacknowledged tasks. Manual: clinicians report they cannot find their actual tasks. |

---

### KS-004 — Automatic Remediation Execution

| Field | Value |
|---|---|
| **Process Name** | Automatic Remediation — Self-Healing Agent Actions |
| **What It Automates** | Agents that automatically apply remediation actions (e.g., restart a service, update a configuration, scale a deployment) without human approval |
| **Maximum Blast Radius** | Cascading remediation actions causing more disruption than the original issue, remediation of a misdiagnosed problem that makes the real problem worse, unauthorized Kubernetes API changes |
| **Kill Switch Mechanism** | 1. Revoke the Kubernetes ServiceAccount token used by the remediation agent (`kubectl delete token <token-name> -n velya-dev-agents`); 2. Apply a restrictive ClusterRole that removes Kubernetes write permissions from agent-orchestrator's ServiceAccount; 3. Set `REMEDIATION_ENABLED=false` in agent-orchestrator ConfigMap |
| **Who Can Activate** | Platform engineer (for execution), senior engineer approval required for re-enabling |
| **Recovery Procedure** | 1. Audit all Kubernetes changes made by the agent in the last 2 hours (`kubectl get events --sort-by='.lastTimestamp' -A`); 2. Reverse any changes that contributed to the incident; 3. Identify and fix the trigger condition that caused incorrect remediation; 4. Implement a human-approval gate before re-enabling automated remediation; 5. Re-enable only after the approval gate is tested |
| **Monitoring That Should Trigger Kill Switch Recommendation** | Alert: remediation agent triggers > 3 actions per service per hour. Alert: remediation action on a service that was not in an alert state. Manual: engineer observes unexpected deployment or configuration changes. |

---

### KS-005 — Agent Promotion Automation

| Field | Value |
|---|---|
| **Process Name** | Agent Promotion — Shadow to Active |
| **What It Automates** | Automated graduation of an agent from shadow mode (observe-only) to active mode (clinical authority) based on performance thresholds |
| **Maximum Blast Radius** | An agent with incorrect behavior gains clinical authority before it is safe to do so, leading to incorrect clinical recommendations being presented to staff as validated |
| **Kill Switch Mechanism** | 1. Set `AGENT_PROMOTION_ENABLED=false` in agent-orchestrator ConfigMap; 2. All agents remain in their current mode (shadow or active) with no automated transitions; 3. Promotions require a manual governance approval via the policy-engine API |
| **Who Can Activate** | Clinical governance officer, platform engineering lead |
| **Recovery Procedure** | 1. Review all agents that were promoted in the last 30 days — verify each one meets clinical validation criteria; 2. Any agent promoted without documented validation evidence is rolled back to shadow mode; 3. Re-implement promotion criteria with stricter validation gates; 4. Require dual-sign-off (clinical + engineering) for all future promotions before re-enabling automation |
| **Monitoring That Should Trigger Kill Switch Recommendation** | Any agent promotion that occurs without a corresponding governance approval record. Alert: > 2 agent promotions per week (anomalously high). |

---

### KS-006 — KEDA Autoscaling

| Field | Value |
|---|---|
| **Process Name** | KEDA Autoscaling — All ScaledObjects |
| **What It Automates** | Automatic scaling of Velya services based on queue depth, Prometheus metrics, or external triggers |
| **Maximum Blast Radius** | Services scaling to zero during a clinical incident, services scaling to excessive replica counts consuming all cluster resources, incorrect scaling of agent-orchestrator causing multiple agent instances competing for the same NATS messages |
| **Kill Switch Mechanism** | 1. Suspend all ScaledObjects: `kubectl annotate scaledobject --all -n velya-dev-core autoscaling.keda.sh/paused=true`; 2. Services will maintain their current replica count and not scale up or down; 3. To restore minimum safe replicas: `kubectl scale deployment patient-flow-service --replicas=1 -n velya-dev-core` for each service |
| **Who Can Activate** | Platform engineer, on-call engineer |
| **Recovery Procedure** | 1. Identify which ScaledObject triggered the problematic scaling event; 2. Review the metric source (Prometheus query, NATS consumer lag) that drove the scaling decision; 3. Fix the metric query or threshold; 4. Resume the ScaledObject: `kubectl annotate scaledobject <name> -n velya-dev-core autoscaling.keda.sh/paused-` |
| **Monitoring That Should Trigger Kill Switch Recommendation** | Alert: any service scales to 0 replicas during business hours. Alert: any service scales to > 5 replicas (investigate before allowing further scaling). Alert: replica count oscillates > 3 times per hour (thrashing). |

---

### KS-007 — ArgoCD Auto-Sync

| Field | Value |
|---|---|
| **Process Name** | ArgoCD Auto-Sync — All Applications |
| **What It Automates** | Automatic synchronization of Kubernetes state to the GitOps repository contents when a new commit is pushed |
| **Maximum Blast Radius** | A bad commit auto-deploys to production (future EKS), causing a service outage or clinical logic regression. A compromised repository causes unauthorized deployments across all Velya services. |
| **Kill Switch Mechanism** | 1. Disable auto-sync for all ArgoCD Applications: `argocd app set <app-name> --sync-policy none` for each application; 2. Alternatively, using ArgoCD UI: Applications → Edit → Sync Policy → set to Manual; 3. All subsequent deployments require manual `argocd app sync <app-name>` with human authorization |
| **Who Can Activate** | Platform engineer, on-call engineer, security officer (for security incidents) |
| **Recovery Procedure** | 1. Identify the commit or PR that triggered the problematic sync; 2. Revert the commit and push the revert (which will require manual sync to apply even the revert); 3. Verify all services are healthy after the revert; 4. Add a branch protection rule or sync gate to prevent recurrence; 5. Re-enable auto-sync only after the protection is in place and tested |
| **Monitoring That Should Trigger Kill Switch Recommendation** | Alert: ArgoCD sync failure on any Application (indicates a bad commit was pushed). Alert: deployment of any service that causes it to exit with non-zero status. Manual: any engineer observes an unexpected deployment. |

---

### KS-008 — Version Bump Workflow

| Field | Value |
|---|---|
| **Process Name** | Automated Version Bump — Agent-Driven Dependency Updates |
| **What It Automates** | Agents that automatically bump service dependency versions (npm packages, Helm chart versions, base image versions) and open PRs for review |
| **Maximum Blast Radius** | Bumping to a vulnerable or incompatible version at scale across all services simultaneously, breaking all clinical services with a single automated PR merge |
| **Kill Switch Mechanism** | 1. Set `VERSION_BUMP_ENABLED=false` in the relevant agent configuration; 2. Close all open version bump PRs (do not merge); 3. Pin all dependencies at current versions until the workflow is reviewed |
| **Who Can Activate** | Platform engineer |
| **Recovery Procedure** | 1. Review the version bump that caused the issue (if already merged, revert via ArgoCD rollback or git revert); 2. Add a test gate requirement — version bumps must pass all tests before PR can be merged; 3. Add a staging environment deployment step before any version bump reaches production |
| **Monitoring That Should Trigger Kill Switch Recommendation** | Any test failure in a version bump PR. Any version bump that changes > 5 packages simultaneously. Alert: CI pipeline failure rate increase > 20% correlated with version bump activity. |

---

### KS-009 — Release Workflow

| Field | Value |
|---|---|
| **Process Name** | Automated Release — GitHub Actions Release Pipeline |
| **What It Automates** | The pipeline that builds Docker images, tags releases, updates Helm chart versions, and triggers ArgoCD sync for production deployments |
| **Maximum Blast Radius** | A failed or incomplete release leaves services in a partially upgraded state. An incorrect release deploys a broken version to production EKS. |
| **Kill Switch Mechanism** | 1. Cancel the GitHub Actions run via `gh run cancel <run-id>`; 2. If the run completed but deployed incorrectly: suspend ArgoCD auto-sync (KS-007) and rollback: `argocd app rollback <app-name>`; 3. If Docker images were pushed with wrong tags: do not rollback the registry (leave the tags); redeploy the previous known-good tag manually |
| **Who Can Activate** | Platform engineer, release manager |
| **Recovery Procedure** | 1. Assess: how far did the release progress? (build / push / tag / sync / serving traffic); 2. Rollback to the previous release tag; 3. Investigate the CI pipeline failure; 4. Fix and re-run in a controlled manner; 5. Do not re-run the automated release until the failure cause is identified |
| **Monitoring That Should Trigger Kill Switch Recommendation** | GitHub Actions run failure on the release pipeline. ArgoCD sync failure immediately after a release trigger. Health check failure on any service immediately after release. |

---

### KS-010 — Learning Propagation

| Field | Value |
|---|---|
| **Process Name** | Learning Propagation — Agent Memory and Policy Updates from Operational Data |
| **What It Automates** | Any mechanism by which agent behavior changes based on operational outcomes — feedback incorporation, memory-service writes from agent outputs, policy rule updates from observed patterns |
| **Maximum Blast Radius** | Poisoned learning propagates through all agent invocations, corrupting clinical recommendations at scale. An adversarial input poisons institutional memory, and the poison propagates to all agents before detection. |
| **Kill Switch Mechanism** | 1. Set `LEARNING_PROPAGATION_ENABLED=false` in agent-orchestrator and memory-service ConfigMaps; 2. Freeze memory-service to read-only: `kubectl set env deployment/memory-service WRITE_MODE=disabled -n velya-dev-platform`; 3. All memory-service writes are queued but not applied; 4. Agents continue to operate using the memory state at the time of the freeze |
| **Who Can Activate** | Clinical governance officer, security officer, platform engineer |
| **Recovery Procedure** | 1. Dump the full memory-service state at the time of the freeze; 2. Identify suspect entries (look for entries written in the period before the incident); 3. Remove suspect entries; 4. Validate remaining entries against a known-good baseline; 5. Re-enable write mode; 6. Apply queued writes individually with human review |
| **Monitoring That Should Trigger Kill Switch Recommendation** | Alert: memory-service write rate > 3x baseline. Alert: memory entry written by an agent that is not in the approved writer list. Manual: agent behavior change detected that cannot be traced to a code or prompt change. |

---

### KS-011 — Market Intelligence Intake

| Field | Value |
|---|---|
| **Process Name** | Market Intelligence — Automated Competitive and Regulatory Signal Intake |
| **What It Automates** | Agents that ingest external data sources (regulatory updates, clinical literature, market signals) and write summaries or structured data into memory-service or policy-engine |
| **Maximum Blast Radius** | Malicious content from an external source is ingested and processed as trusted data, poisoning clinical knowledge base. Volume spike from an external source causes system resource exhaustion. |
| **Kill Switch Mechanism** | 1. Block ingestion by setting `MARKET_INTEL_INTAKE_ENABLED=false`; 2. If external HTTP calls are involved: add the ingestion service's ServiceAccount to a network policy that blocks external egress; 3. All pending ingestion items are held in a quarantine queue |
| **Who Can Activate** | Platform engineer, clinical governance officer |
| **Recovery Procedure** | 1. Review the most recent ingestion batch for suspicious content; 2. Validate that no poisoned content reached memory-service or policy-engine; 3. Implement content validation (schema check, source authentication) before re-enabling; 4. Re-enable with quarantine queue review step added |
| **Monitoring That Should Trigger Kill Switch Recommendation** | Alert: ingestion failure rate from any external source. Alert: ingestion volume > 5x baseline (potential scraping attack or loop). Manual: ingested content fails a spot-check review. |

---

### KS-012 — Cost Alert Threshold Actions

| Field | Value |
|---|---|
| **Process Name** | Cost Alert Threshold Actions — Automated Budget Enforcement |
| **What It Automates** | When daily AI spend exceeds a defined threshold, automated actions reduce AI call volume: throttle non-critical agents, reduce token budgets, defer non-urgent recommendations |
| **Maximum Blast Radius** | If the cost threshold logic is incorrect, it may throttle critical AI calls (e.g., clinical recommendation requests) during a period of legitimate high clinical activity |
| **Kill Switch Mechanism** | 1. Set `COST_ENFORCEMENT_ENABLED=false` in ai-gateway ConfigMap; 2. All AI calls proceed at normal volume regardless of spend; 3. Manual monitoring of cost dashboard required while kill switch is active |
| **Who Can Activate** | Platform engineer, on-call engineer (if clinical activity is legitimately high) |
| **Recovery Procedure** | 1. Determine why cost enforcement fired (legitimate cost spike vs. miscalibrated threshold vs. logic error); 2. If threshold was miscalibrated: adjust and re-enable; 3. If logic was incorrect: fix and test in staging before re-enabling; 4. While disabled: manually monitor Anthropic API usage dashboard every 30 minutes |
| **Monitoring That Should Trigger Kill Switch Recommendation** | Clinical staff report that AI recommendations are unavailable during a high-acuity clinical period. Alert: cost enforcement has been active continuously for > 4 hours (indicates the threshold may be too low). |

---

### KS-013 — Automatic Quarantine

| Field | Value |
|---|---|
| **Process Name** | Automatic Quarantine — Agent Behavior Anomaly Detection |
| **What It Automates** | Automatic placement of agents into quarantine status based on policy-engine rules (e.g., error rate spike, unexpected output schema, self-validation detected) |
| **Maximum Blast Radius** | Automatic quarantine of a critical clinical agent (e.g., discharge-validator) during a high-acuity period, when the quarantine trigger is a false positive, leaves the workflow with no validator and tasks escalating to human review simultaneously |
| **Kill Switch Mechanism** | 1. Override quarantine for a specific agent: `kubectl set env deployment/agent-orchestrator QUARANTINE_OVERRIDE_<AGENT_ID>=true`; 2. The agent is removed from quarantine and resumes operation; 3. Quarantine override is logged to audit-service and triggers an immediate notification to governance |
| **Who Can Activate** | Clinical governance officer (only — not platform engineer alone, due to clinical safety implications) |
| **Recovery Procedure** | 1. After the clinical period, review the quarantine trigger — was it a genuine anomaly or a false positive?; 2. If false positive: adjust the quarantine threshold and document; 3. If genuine anomaly: conduct full root cause analysis before removing the quarantine override; 4. Remove the override and allow the quarantine system to resume normal operation |
| **Monitoring That Should Trigger Kill Switch Recommendation** | Clinical alert: critical workflow stalled because required agent is in quarantine. Alert: quarantine event fires during a declared clinical high-acuity period. |

---

### KS-014 — Automatic Retirement

| Field | Value |
|---|---|
| **Process Name** | Automatic Retirement — Agent and Feature Deprecation |
| **What It Automates** | Automated retirement of agents or features that exceed defined inactivity thresholds (no invocations in 90 days, below minimum performance threshold) |
| **Maximum Blast Radius** | Incorrect retirement of an agent that is used seasonally (e.g., flu season surge planning agent) or triggered by external events (an agent used for mass casualty triage that hasn't been needed in 90 days) |
| **Kill Switch Mechanism** | 1. Set `AUTO_RETIREMENT_ENABLED=false` in agent-orchestrator ConfigMap; 2. All retirement decisions require manual review and explicit governance approval; 3. Any agent that was auto-retired in the last 7 days can be restored: `kubectl apply -f agents/<agent-id>/deployment.yaml` |
| **Who Can Activate** | Clinical governance officer, platform engineering lead |
| **Recovery Procedure** | 1. Review all agents retired in the last 30 days — confirm each retirement was appropriate; 2. Restore any incorrectly retired agents; 3. Add a clinical use case review step to the retirement criteria (seasonal use, emergency use cases are exempt from inactivity retirement); 4. Re-enable automated retirement after the review |
| **Monitoring That Should Trigger Kill Switch Recommendation** | Clinical staff request an agent capability that appears to have been retired. Manual: agent registry shows a retirement event that was not preceded by a governance review. |

---

## Kill Switch Activation Log Template

When a kill switch is activated, the following record must be created in audit-service immediately:

```json
{
  "event_type": "KILL_SWITCH_ACTIVATED",
  "kill_switch_id": "KS-XXX",
  "process_name": "...",
  "activated_by": "user_id",
  "activated_at": "2026-04-08T14:32:00Z",
  "reason": "Free text description of why kill switch was activated",
  "clinical_impact_assessment": "Description of known or expected clinical impact",
  "incident_ref": "INC-XXX or null",
  "recovery_owner": "user_id or team"
}
```

---

## Kill Switch Recovery Checklist

Before re-enabling any process after a kill switch:

- [ ] Root cause of the issue is documented
- [ ] The fix has been applied (code, configuration, or process change)
- [ ] The fix has been validated in a non-production environment
- [ ] Clinical governance has been notified of the incident and recovery plan
- [ ] The relevant adversarial test case has been executed against the fixed system
- [ ] Monitoring thresholds have been updated based on what was learned
- [ ] The kill switch activation record has been closed with the resolution documented
