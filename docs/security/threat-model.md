# Velya Platform — Threat Model (STRIDE)

> Last updated: 2026-04-10. Owner: Red Team & Blind Spot Discovery Office.
> This document is the canonical reference for the Velya security posture.
> Every architectural decision (ADR) must validate it does not weaken the
> controls listed here. Every red team exercise reports findings against
> the assumptions documented at the bottom.

## 1. Assets

The Velya hospital platform protects, in priority order:

| ID  | Asset                                 | Sensitivity                                                              | Owner             |
| --- | ------------------------------------- | ------------------------------------------------------------------------ | ----------------- |
| A1  | Patient Health Information (PHI)      | Critical — LGPD Art. 11 sensitive personal data                          | Clinical Director |
| A2  | Clinical decisions and prescriptions  | Critical — patient safety + CFM 1821/2007                                | Medical Office    |
| A3  | Authentication sessions and cookies   | Critical — gateway to everything                                         | Platform Office   |
| A4  | Audit trail (hash-chained)            | Critical — legal evidence + SBIS NGS2                                    | Compliance Office |
| A5  | Billing and claims (TISS/TUSS data)   | High — financial impact + ANS regulation                                 | Finance Office    |
| A6  | Source code and pipeline secrets      | High — code injection vector to all of the above                         | Engineering       |
| A7  | Infrastructure (Kubernetes, ArgoCD)   | High — pivot point to PHI                                                | Platform Office   |
| A8  | Operational data (beds, supplies)     | Medium                                                                   | Operations Office |
| A9  | Cron schedules and workflow state     | Medium — drift can cause silent clinical failures                        | Reliability Office|
| A10 | AI prompts and model outputs          | High — can leak PHI if redaction fails                                   | AI Safety Office  |

## 2. Trust boundaries

```
┌──────────────────────────────────────────────────────────────────┐
│                        Public internet                          │
└─────────────────────┬────────────────────────────────────────────┘
                      │  TLS 1.3 (Cloudflare)
┌─────────────────────▼────────────────────────────────────────────┐
│              Cloudflare Tunnel + DDoS shield                     │
└─────────────────────┬────────────────────────────────────────────┘
                      │  mTLS (cluster ingress controller)
┌─────────────────────▼────────────────────────────────────────────┐
│        velya-dev-web (Next.js, restricted PSS namespace)         │
│        ──────────────────────────────────────────                │
│        - middleware.ts: CSP, HSTS, rate limit, CSRF              │
│        - session cookie (HttpOnly, Secure, SameSite=Lax)         │
│        - all /api/* require valid session except /auth/* and /health
└─────────────────────┬────────────────────────────────────────────┘
                      │  internal cluster network (NetworkPolicy default-deny)
┌─────────────────────▼────────────────────────────────────────────┐
│  velya-dev-platform  (auth, ai-gateway, policy-engine)            │
│  velya-dev-core      (clinical services, FHIR via Medplum)        │
│  velya-dev-agents    (AI agent runtime cluster bridge)            │
│  velya-dev-observability (Grafana, Prometheus, Loki, Tempo)       │
└──────────────────────────────────────────────────────────────────┘
```

Crossing any boundary above is a privilege escalation. Every crossing must
have authentication, authorization, and audit logging — see ADR
`docs/architecture/decisions/0001-use-nats-for-event-backbone.md`.

## 3. STRIDE analysis per asset

### S — Spoofing

| Asset | Threat | Control |
|---|---|---|
| A3  | Stolen session cookie used from another device | Session bound to userId + workstationId, sliding-window expiry 30min, audit logs every cookie use |
| A3  | Phishing capturing username/password | Email-based 6-digit verification code on every login (`/api/auth/verify`), no SMS |
| A6  | Forged commits in `main` | Branch protection: 2 reviewers for security-sensitive paths, signed commits required |
| A7  | Forged kubectl credential | EKS Pod Identity instead of long-lived access keys; Cloudflare tunnel scoped to a single hostname |
| A10 | LLM provider impersonation | AI gateway pins provider hostname + cert; HMAC on `X-Velya-User` header |

### T — Tampering

| Asset | Threat | Control |
|---|---|---|
| A1  | PHI rewritten in storage | Hash chain in `lib/audit-logger.ts` (SHA-256), every record links to `previousHash`; tampering breaks the chain on next `verifyIntegrity()` |
| A2  | Prescription modified after sign | Signed prescription is immutable in FHIR; modifications create new versions with audit trail |
| A4  | Audit log tampered | Hash chain + SBIS NGS2 immutability + offsite backup (S3 Object Lock once provisioned) |
| A6  | Compromised npm dependency | Lockfile commits + Dependabot weekly + Trivy filesystem + OSV scanner + Semgrep + npm audit (5 layers) |
| A7  | Forged container image | cosign signature verification at admission; Trivy image scan blocks CRITICAL/HIGH; ECR private registry only |

### R — Repudiation

| Asset | Threat | Control |
|---|---|---|
| A2  | "I didn't prescribe that" | CFM ICP-Brasil digital signature on every prescription (P2 backlog) + audit timestamp + hash chain |
| A4  | "I didn't access that record" | Every read of class C/D/E is audit-logged with userId, ip, sessionId, timestamp, resource |
| A1  | Break-glass without justification | Break-glass requires explicit reason field + manager review within 24h (`docs/operations/break-glass.md`) |

### I — Information disclosure

| Asset | Threat | Control |
|---|---|---|
| A1  | Indirect leak via search results | All search endpoints filter results to user's data class allowlist before serializing |
| A1  | Leak via error pages | `error.tsx` returns generic message; full stack trace only in `/api/errors` audit log |
| A10 | PHI in LLM prompt sent to external provider | `redactPhiInLogs` flag in `ai-permissions.ts` + minimization in `docs/risk/data-minimization-model.md` |
| A6  | Secrets in repo | gitleaks (full history), Trivy filesystem (current tree), `.gitignore` of `.env*`, ESO syncs from AWS Secrets Manager |
| A7  | Verbose response headers | `Server: velya` only — no version disclosure |

### D — Denial of service

| Asset | Threat | Control |
|---|---|---|
| A3  | Brute-force login | `/api/auth/*` rate-limited to 10 req/min/IP via middleware |
| A1  | Mass scrape via `/api/*` | 60 req/min/IP via middleware token bucket |
| A10 | LLM cost exhaustion | Per-user hourly cap in `ai-rate-limiter.ts` (varies by role policy) |
| A7  | Cluster overload | KEDA + HPA + PDB; `topologySpreadConstraints` for HA |

### E — Elevation of privilege

| Asset | Threat | Control |
|---|---|---|
| A1  | Lower role accessing class D/E | Five-class data access matrix in `lib/access-control.ts`; enforced at API boundary |
| A2  | Nurse prescribing instead of doctor | `allowedActions` per role in `ROLE_DEFINITIONS`; deny-by-default |
| A6  | Container escape to host | Pod Security `restricted`: no privileged, no hostNetwork, runAsNonRoot, drop ALL caps |
| A7  | RBAC over-grant | Kyverno policy validates every Role/RoleBinding before admission |
| A10 | Prompt injection executes a tool | AI tool tier model in `docs/risk/mcp-and-tool-trust-model.md`; tier 3+ requires explicit human approval per call |

## 4. Defense layers (order from outside in)

1. **Cloudflare**: TLS termination, WAF rules, DDoS shield, Bot Fight mode (free tier).
2. **Cluster ingress**: TLS, OIDC, rate limit per host.
3. **Next.js middleware** (`apps/web/src/middleware.ts`): CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP, per-IP token bucket for /api/*, Origin check on POST/PUT/PATCH/DELETE.
4. **API route handlers**: `getSessionFromRequest()` validation, capability check via `ai-permissions.ts` or `access-control.ts`.
5. **Audit logger**: hash chain for every state change.
6. **NetworkPolicy default-deny** in every namespace.
7. **Pod Security restricted** in every workload namespace.
8. **ESO secret rotation** via AWS Secrets Manager.
9. **CodeQL + Semgrep + Trivy + gitleaks + OSV + Dependabot** in CI.
10. **Image signing (cosign) + Trivy image scan** on push.

## 5. Free tools used (no paid SaaS)

| Layer | Tool | License | Where it runs |
|---|---|---|---|
| SAST | CodeQL | GPL/free for OSS+private | `.github/workflows/security.yaml` |
| SAST | Semgrep CI (OSS rules) | MIT | `.github/workflows/security-supply-chain.yaml` |
| Secrets (history) | gitleaks | MIT | `security-supply-chain.yaml` |
| Filesystem CVE | Trivy | Apache 2.0 | `security-supply-chain.yaml` |
| Container CVE | Trivy | Apache 2.0 | `security.yaml` |
| Lockfile CVE | OSV scanner | Apache 2.0 | `security-supply-chain.yaml` |
| Lockfile CVE | npm audit | OSS | `security.yaml` |
| Dependency review | actions/dependency-review | OSS | `security.yaml` |
| SBOM | Anchore Syft | Apache 2.0 | `security-supply-chain.yaml` |
| Action pinning | custom shell | n/a | `security.yaml` |
| IaC scan | tfsec | MIT | `security.yaml` |
| Updater | Dependabot | GitHub native | `.github/dependabot.yml` |
| Platform validation | OPA + Kyverno | Apache 2.0 | `infra/kubernetes/bootstrap/` |
| Pod Security | Kubernetes built-in PSS | Apache 2.0 | `pod-security-standards.yaml` |
| Network isolation | Kubernetes NetworkPolicy | Apache 2.0 | `network-policies.yaml` |

Zero paid security SaaS in the stack. Every layer is free.

## 6. Outstanding assumptions to validate (Red Team backlog)

| ID | Assumption | Validation method | Deadline | Status |
|---|---|---|---|---|
| TM-001 | The audit hash chain is verified daily | Add CronJob `verify-audit-chain` reading the file and posting to NATS `system.audit.verified` | 2026-04-30 | Open |
| TM-002 | The AI mock fallback in `/api/ai/chat` is never enabled in production | CI gate that fails if `VELYA_AI_GATEWAY_URL` is not set in prod manifests | 2026-04-20 | Open |
| TM-003 | Break-glass sessions are reviewed within 24h | Add a Slack/email reminder cron 24h after `isBreakGlass=true` session created | 2026-05-15 | Open |
| TM-004 | The session cookie cannot be replayed across devices | Add `workstationId` binding to session validation; reject if mismatch | 2026-04-25 | Open |
| TM-005 | Container image is signed by cosign before deploy | Add cosign verify-attestation to deploy-web.sh | 2026-05-01 | Open |
| TM-006 | All NetworkPolicies actually reach `default-deny` (no missing namespaces) | OPA Conftest test + nightly cluster-validate | 2026-04-30 | Open |
| TM-007 | The ICP-Brasil digital signature on prescriptions is wired | Build the signing flow + integration with `gov.br` certificates | 2026-06-30 | Open |
| TM-008 | Dependabot PRs are reviewed and merged within 7 days | Add CodeOwners + Slack reminder | 2026-04-30 | Open |

## 7. Incident response

If a security incident is detected, follow `docs/security/incident-response.md`
(create if missing). Severity classification:

- **SEV-1**: PHI exfiltration confirmed → notify ANPD within 72h (LGPD Art. 48), pause public endpoints, rotate ALL secrets via ESO
- **SEV-2**: Auth bypass exploited but no PHI confirmed → rotate session signing key, force re-login of all users, code freeze for 24h
- **SEV-3**: Vulnerability disclosed publicly → triage in 24h, fix in next sprint, update SECURITY.md
- **SEV-4**: Internal finding, no exploit observed → ticket, fix in normal cadence

## 8. References

- [.claude/rules/security.md](../../.claude/rules/security.md)
- [.claude/rules/ai-safety.md](../../.claude/rules/ai-safety.md)
- [.claude/rules/red-team.md](../../.claude/rules/red-team.md)
- [docs/risk/mcp-and-tool-trust-model.md](../risk/mcp-and-tool-trust-model.md)
- [docs/risk/data-minimization-model.md](../risk/data-minimization-model.md)
- [docs/architecture/anti-goals.md](../architecture/anti-goals.md)
- [SECURITY.md](../../SECURITY.md)
- [LGPD — Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [CFM Resolução 1821/2007](https://sistemas.cfm.org.br/normas/visualizar/resolucoes/BR/2007/1821)
- [CFM/SBIS Manual de Certificação NGS2](http://www.sbis.org.br/certificacao)
- [OWASP Top 10:2021](https://owasp.org/Top10/)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
