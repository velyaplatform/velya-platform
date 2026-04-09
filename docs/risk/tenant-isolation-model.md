# Tenant Isolation Model — Velya Platform

**Version**: 1.0  
**Date**: 2026-04-08  
**Classification**: Internal — Restricted  
**Scope**: Multi-tenancy strategy covering single-hospital and eventual multi-hospital deployments  
**Owner**: Architecture Team + Security Team + Compliance Team  
**Review Cadence**: Quarterly; before any new hospital onboarding; before any architecture change affecting data isolation

---

## Current Tenancy Model

As of 2026-04-08, Velya is deployed for a **single hospital** (single tenant). The kind dev cluster and the planned EKS production cluster are provisioned exclusively for one hospital organization.

This document defines:

1. The current single-tenant isolation model and its requirements
2. The target multi-tenant architecture for future expansion
3. The isolation boundaries that must hold regardless of tenancy model

---

## Tenancy Definitions

| Term                 | Definition                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenant**           | A hospital organization that is a covered entity under HIPAA, with its own patient population, clinical staff, and data                                                                         |
| **Tenant isolation** | The technical and organizational guarantees that one tenant's data, workloads, and credentials cannot be accessed by another tenant's users, agents, or services                                |
| **Shared-nothing**   | The architectural principle that no persistent state (database rows, NATS streams, file storage, secrets) is shared between tenants. Tenant A's data cannot be reached via any path by Tenant B |
| **Control plane**    | Infrastructure and management components that may be shared across tenants (Kubernetes API server, Prometheus, ArgoCD)                                                                          |
| **Data plane**       | Components that contain or process tenant PHI — these must be isolated per-tenant                                                                                                               |

---

## Section 1: Single Hospital — Current Model

### Data Isolation Requirements (Single Tenant)

Even in a single-tenant deployment, the following isolation requirements apply:

1. **Departmental isolation**: Data from the Cardiology department must not be accessible to the Oncology department's workflows if the hospital has not explicitly granted cross-departmental access
2. **Role-based data isolation**: A nurse in Ward 7A must not see patients in Ward 7B unless their role explicitly grants cross-ward access
3. **Agent scope isolation**: A bed-allocation-agent processing Ward 7A cannot read Ward 7B patient data
4. **Temporal isolation**: Discharged patients' data must not mix with current admissions in agent context
5. **Audit isolation**: The audit trail must record which department, which role, and which individual accessed which patient's data

### Single-Tenant Implementation

```
Hospital: St. Velya Medical Center
├── AWS Account: velya-prod-st-velya (dedicated per hospital)
├── EKS Cluster: velya-prod-st-velya-eks (dedicated)
├── RDS Instance: velya-prod-st-velya-medplum (dedicated)
├── S3 Buckets: velya-prod-st-velya-* (dedicated)
├── Secrets Manager: prefix velya-prod-st-velya/* (dedicated)
└── Medplum tenant: st-velya-hospital (single Medplum project)
```

In a single-tenant deployment:

- All infrastructure is dedicated (no shared compute)
- All data stores are dedicated (no shared database)
- All credentials are scoped to the single hospital
- Medplum project isolation provides departmental access control

---

## Section 2: Multi-Hospital Architecture (Future State)

### Decision: Deployment Model

Velya will support multi-hospital deployments using the **Dedicated-Instance-Per-Hospital** model (also known as "silo" architecture), not a shared multi-tenant application database.

**Rationale for Silo Architecture**:

| Factor                 | Shared Database                                                        | Silo (Dedicated Instance)                                 | Velya Decision                               |
| ---------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------- |
| PHI isolation          | Row-level security — possible but complex; one bug exposes all tenants | Complete physical separation; bug affects only one tenant | SILO                                         |
| Regulatory             | HIPAA BAA must cover all tenants in shared infrastructure              | BAA scoped per hospital; simpler compliance posture       | SILO                                         |
| Incident containment   | One tenant's incident affects all                                      | One tenant's incident is contained                        | SILO                                         |
| Customization          | Shared schema limits per-tenant customization                          | Per-tenant schema can be customized                       | SILO                                         |
| Cost                   | Shared infrastructure is cheaper                                       | Higher infrastructure cost per tenant                     | Trade-off accepted for regulatory compliance |
| Operational complexity | Single deployment                                                      | Many deployments to manage                                | Mitigated by GitOps + ArgoCD App-of-Apps     |

### Multi-Hospital Deployment Architecture

```
Velya Control Plane (shared)
├── ArgoCD (manages all hospital instances)
├── Grafana (aggregated observability — no PHI in metrics)
├── GitHub Actions (CI/CD for all instances)
└── Anthropic API account (shared; per-hospital API key subaccounts)

Hospital A — St. Velya Medical Center
├── AWS Account: velya-prod-st-velya (A dedicated account)
├── EKS Cluster: velya-prod-st-velya-eks
├── Velya services stack (all services)
├── Medplum FHIR (St. Velya patient data)
├── NATS JetStream (St. Velya events)
├── Temporal (St. Velya workflows)
└── RDS PostgreSQL (St. Velya application data)

Hospital B — Regional General Hospital
├── AWS Account: velya-prod-rgh (B dedicated account)  ← separate AWS account
├── EKS Cluster: velya-prod-rgh-eks
├── Velya services stack (all services)
├── Medplum FHIR (Regional General patient data)  ← zero overlap with Hospital A
├── NATS JetStream (Regional General events)
├── Temporal (Regional General workflows)
└── RDS PostgreSQL (Regional General application data)
```

**Critical property**: Hospital A's EKS cluster has no network route to Hospital B's EKS cluster. Hospital A's AWS account has no IAM permissions into Hospital B's account. Hospital A's database has zero connection from Hospital B's services.

---

## Section 3: Shared-Nothing Principle for Clinical Data

### Shared-Nothing Matrix

| Data Type                      | Hospital A                             | Hospital B             | Shared?               | Enforcement                                                              |
| ------------------------------ | -------------------------------------- | ---------------------- | --------------------- | ------------------------------------------------------------------------ |
| Patient records (FHIR)         | Medplum instance A                     | Medplum instance B     | NEVER                 | Separate AWS RDS instances; no cross-account peering                     |
| Clinical events (NATS)         | NATS cluster A                         | NATS cluster B         | NEVER                 | Separate NATS deployments; no cross-cluster replication for PHI subjects |
| Workflow state (Temporal)      | Temporal A                             | Temporal B             | NEVER                 | Separate Temporal namespaces/clusters                                    |
| Application state (PostgreSQL) | RDS A                                  | RDS B                  | NEVER                 | Separate RDS instances; separate AWS accounts                            |
| Agent memory (Redis)           | Redis A                                | Redis B                | NEVER                 | Separate Redis instances                                                 |
| Audit logs                     | audit-service A                        | audit-service B        | NEVER                 | Separate databases; separate S3 buckets                                  |
| Kubernetes secrets             | Secrets Manager A                      | Secrets Manager B      | NEVER                 | Separate AWS accounts = separate secret namespaces                       |
| AI decision logs               | decision-log-service A                 | decision-log-service B | NEVER                 | Separate databases                                                       |
| Prometheus metrics             | Shared Prometheus (no PHI labels)      | Same Prometheus        | ALLOWED               | Metrics are PHI-free (enforced by metric labeling policy)                |
| Application code               | Same container images                  | Same container images  | ALLOWED               | Code is not tenant data                                                  |
| Grafana dashboards             | Shared Grafana (tenant-scoped queries) | Same Grafana           | ALLOWED with controls | Per-tenant datasource scoping                                            |

### What IS Shared (Safely)

| Component                 | Sharing Model                                     | Safety Mechanism                                                 |
| ------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| Anthropic API account     | Shared API account; per-hospital API key rotation | PHI minimization before API call; per-key usage tracking         |
| Container images in ECR   | Shared image registry; same image for all tenants | Images contain no tenant data                                    |
| Helm charts and manifests | Shared git repository; per-tenant values files    | Values files contain no PHI                                      |
| ArgoCD control plane      | Single ArgoCD managing multiple clusters          | AppProject per hospital restricts sync targets                   |
| Grafana (observability)   | Single Grafana instance; per-tenant datasources   | No PHI in metrics; tenant cannot query other tenant's datasource |

---

## Section 4: API-Level Tenant Isolation

In the single-tenant model, there is no API-level multi-tenancy. Every API call is implicitly scoped to the hospital.

In a future shared-API-gateway model (not recommended; silo is preferred), the following controls would be required:

### Hospital ID Propagation

If a shared API gateway serves multiple hospitals (not the preferred architecture), every request must carry a verified hospital identifier:

```typescript
// Rejected architecture — shared api-gateway serving multiple hospitals
// If pursued, mandatory controls:

interface HospitalContext {
  hospitalId: string; // Verified from JWT claim
  hospitalName: string;
  tenantIsolationKey: string; // Used to scope all database queries
}

// Every NestJS controller must extract and validate hospital context
@Injectable()
export class HospitalContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const hospitalId = request.auth?.claims?.hospital_id;

    if (!hospitalId || !this.isValidHospital(hospitalId)) {
      throw new ForbiddenException('Invalid or missing hospital context');
    }

    // Bind hospital context to request for downstream use
    request.hospitalContext = { hospitalId /* ... */ };
    return true;
  }
}

// MANDATORY: Every database query must include hospitalId filter
// MANDATORY: FHIR queries must be scoped to hospital's Medplum project
// MANDATORY: NATS subjects must be prefixed with hospital ID
```

**Current recommendation**: Do not implement shared API gateway for multiple hospitals. Use silo architecture with per-hospital deployments.

---

## Section 5: NATS Subject Isolation Per Tenant

### Single-Tenant NATS Subject Hierarchy

In the current single-hospital deployment:

```
clinical.patient.admitted          # Patient admission events
clinical.patient.discharged        # Patient discharge events
clinical.bed.assigned              # Bed assignment events
clinical.alert.deterioration       # Clinical alerts
agents.discharge.ready             # Agent completion events
agents.bed.recommendation          # Agent recommendation events
platform.audit.event               # Audit events
```

### Multi-Tenant NATS Subject Isolation

In a multi-hospital deployment with a shared NATS cluster (not the recommended architecture):

```
# REQUIRED: Hospital ID as first subject segment
st-velya.clinical.patient.admitted
st-velya.clinical.patient.discharged
rgh.clinical.patient.admitted
rgh.clinical.patient.discharged

# NATS authorization: st-velya services can ONLY publish/subscribe to st-velya.* subjects
# NATS authorization: rgh services can ONLY publish/subscribe to rgh.* subjects
```

**NATS Authorization Configuration** (if shared NATS):

```json
{
  "authorization": {
    "users": [
      {
        "user": "st-velya-patient-flow",
        "permissions": {
          "publish": { "allow": ["st-velya.>"] },
          "subscribe": { "allow": ["st-velya.>"], "deny": ["rgh.>", "*.clinical.>"] },
          "deny": { "publish": ["rgh.>"], "subscribe": ["rgh.>"] }
        }
      },
      {
        "user": "rgh-patient-flow",
        "permissions": {
          "publish": { "allow": ["rgh.>"] },
          "subscribe": { "allow": ["rgh.>"] },
          "deny": { "publish": ["st-velya.>"], "subscribe": ["st-velya.>"] }
        }
      }
    ]
  }
}
```

**Recommendation**: Use separate NATS clusters per hospital (silo model) rather than subject-based isolation in a shared cluster. Subject-based isolation requires perfect authorization configuration and has no defense in depth.

---

## Section 6: PostgreSQL Row-Level Security for Multi-Tenant

In application databases that may eventually serve multiple hospitals (not Medplum — Medplum is always siloed), Row-Level Security (RLS) provides tenant isolation as a defense-in-depth measure.

**Note**: RLS is a compensating control, not the primary isolation mechanism. The primary mechanism is silo architecture (separate databases). RLS prevents a bug in application code from leaking cross-tenant data in a shared-database fallback scenario.

### RLS Design

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE patient_flow_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;

-- Policy: Services can only see their hospital's rows
CREATE POLICY hospital_isolation_policy ON patient_flow_state
  USING (hospital_id = current_setting('velya.current_hospital_id')::uuid);

CREATE POLICY hospital_isolation_policy ON task_assignments
  USING (hospital_id = current_setting('velya.current_hospital_id')::uuid);

-- Every application connection must set the current hospital context before queries
-- NestJS connection middleware:
-- SET LOCAL velya.current_hospital_id = '<hospital-uuid-from-jwt>'

-- Superuser (used only by migrations) bypasses RLS
-- Application role (velya_app_role) is subject to RLS
```

### RLS Verification Tests

```sql
-- Test: Hospital A service cannot see Hospital B data
SET LOCAL velya.current_hospital_id = 'hospital-a-uuid';
SELECT COUNT(*) FROM patient_flow_state;
-- Must return only Hospital A's rows

SET LOCAL velya.current_hospital_id = 'hospital-b-uuid';
SELECT COUNT(*) FROM patient_flow_state;
-- Must return only Hospital B's rows

-- Test: Cannot override hospital_id via SQL injection
SET LOCAL velya.current_hospital_id = '00000000-0000-0000-0000-000000000000'; -- unknown hospital
SELECT COUNT(*) FROM patient_flow_state;
-- Must return 0 rows (no data for unknown hospital)
```

---

## Section 7: Kubernetes Namespace-Per-Tenant Strategy

### Single-Tenant Namespace Strategy (Current)

All Velya namespaces follow the pattern `velya-{env}-{domain}`:

```
velya-dev-clinical, velya-dev-core, velya-dev-platform, velya-dev-agents, velya-dev-web, velya-dev-observability
```

No hospital identifier in namespace because there is only one hospital per cluster.

### Multi-Hospital: One Cluster Per Hospital (Recommended)

Each hospital gets its own EKS cluster. Namespaces within each cluster follow the same `velya-{env}-{domain}` pattern. Hospital isolation is at the cluster level, not the namespace level.

```
Cluster: velya-prod-st-velya-eks
  Namespaces: velya-prod-clinical, velya-prod-core, velya-prod-agents, ...

Cluster: velya-prod-rgh-eks
  Namespaces: velya-prod-clinical, velya-prod-core, velya-prod-agents, ...

# These are different physical clusters with no cross-cluster connectivity
```

### Multi-Hospital: Namespace-Per-Tenant on Shared Cluster (Not Recommended)

If cost constraints require sharing a single EKS cluster across multiple hospitals (not recommended for production PHI):

```
Namespace pattern: velya-{env}-{hospital-id}-{domain}

velya-prod-st-velya-clinical
velya-prod-st-velya-core
velya-prod-rgh-clinical
velya-prod-rgh-core
```

**Required isolation controls for namespace-per-tenant on shared cluster**:

1. **NetworkPolicy**: strict namespace isolation — st-velya pods cannot reach rgh pods
2. **RBAC**: per-hospital service accounts; no cross-hospital role bindings
3. **Resource Quotas**: per-hospital quotas to prevent one hospital starving another
4. **PriorityClasses**: equal priority for clinical workloads across hospitals
5. **Node affinity** (if budget allows): dedicated node pools per hospital for physical separation
6. **etcd encryption**: all secrets encrypted; one hospital cannot read another's secrets
7. **Admission controller**: Kyverno policy verifying hospital identity label on all resources

```yaml
# Kyverno policy: Enforce hospital label on all Velya resources
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: enforce-hospital-label
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-hospital-label
      match:
        any:
          - resources:
              kinds: ['Pod', 'Deployment', 'Service']
              namespaces: ['velya-prod-*']
      validate:
        message: 'All Velya resources must have velya.io/hospital-id label'
        pattern:
          metadata:
            labels:
              velya.io/hospital-id: '?*'
```

---

## Section 8: Onboarding a New Hospital

The following procedure governs adding a new hospital tenant:

### Pre-Onboarding Requirements

1. **Legal**: BAA signed between Velya and the hospital (as a covered entity)
2. **Legal**: BAA between Velya and Anthropic must cover the new hospital's use (verify scope)
3. **Compliance**: HIPAA risk assessment updated for the new hospital's deployment
4. **Technical**: New hospital's network and integration requirements documented

### Provisioning Procedure

```bash
# Step 1: Create new AWS account for hospital (via AWS Organizations)
aws organizations create-account --account-name "velya-prod-${HOSPITAL_ID}"

# Step 2: Provision EKS cluster via OpenTofu
cd infra/opentofu/envs/prod/${HOSPITAL_ID}
tofu init
tofu apply -var="hospital_id=${HOSPITAL_ID}" -var="hospital_name=${HOSPITAL_NAME}"

# Step 3: Create ArgoCD AppProject for new hospital
kubectl apply -f infra/argocd/projects/${HOSPITAL_ID}-project.yaml -n argocd

# Step 4: Create ArgoCD Application pointing to hospital-specific values
kubectl apply -f infra/argocd/apps/${HOSPITAL_ID}-app.yaml -n argocd

# Step 5: Provision hospital-specific secrets in AWS Secrets Manager
tofu apply -target=module.hospital_secrets -var="hospital_id=${HOSPITAL_ID}"

# Step 6: Execute BAA verification checklist
# Step 7: Run isolation verification tests for new cluster
# Step 8: Conduct hospital-specific training for clinical staff
```

### Isolation Verification on New Hospital Onboarding

Before a new hospital goes live, the following isolation tests must pass:

- [ ] Network probe from hospital A's pods cannot reach hospital B's pods (if shared cluster)
- [ ] Hospital A's database credentials cannot connect to hospital B's RDS
- [ ] NATS authorization test: hospital A service cannot publish to hospital B subjects
- [ ] RBAC test: hospital A's Kubernetes service account cannot read hospital B's secrets
- [ ] PHI smoke test: create test patient in hospital A; verify not visible in hospital B's Medplum
- [ ] Audit trail test: hospital A clinical action visible only in hospital A's audit-service
- [ ] Agent scope test: hospital A's agent cannot access hospital B's FHIR resources

---

## Tenant Isolation Compliance Summary

| Isolation Type             | Single-Tenant Status                        | Multi-Tenant Status (Target)                     | Priority                  |
| -------------------------- | ------------------------------------------- | ------------------------------------------------ | ------------------------- |
| Physical compute isolation | Implemented (dedicated cluster)             | Dedicated cluster per hospital                   | Maintained                |
| Database isolation         | Implemented (dedicated RDS)                 | Dedicated RDS per hospital                       | Maintained                |
| Network isolation          | Gap — kindnet doesn't enforce NetworkPolicy | Calico + inter-cluster firewall                  | Must fix before PHI       |
| NATS subject isolation     | N/A (single tenant)                         | Per-hospital subject prefix + NATS authorization | Required at multi-tenant  |
| Secret isolation           | Implemented (per-service ESO)               | Per-hospital Secrets Manager prefix              | Extended for multi-tenant |
| FHIR access isolation      | Implemented via Medplum project             | Per-hospital Medplum instance                    | Maintained                |
| Audit trail isolation      | Not implemented (scaffold)                  | Per-hospital audit-service database              | Must implement            |
| Agent scope isolation      | Not implemented (agents are scaffolds)      | Policy-engine enforces per-hospital scope        | Must implement            |
| Kubernetes RBAC isolation  | Partial (per-service SA)                    | Per-hospital namespace RBAC + AppProject         | Must complete             |

---

_This document governs both the current single-hospital deployment and the future multi-hospital architecture. Any architectural change that creates a shared data path between hospitals is prohibited without explicit sign-off from the CTO, CISO, and all affected hospitals' Privacy Officers._
