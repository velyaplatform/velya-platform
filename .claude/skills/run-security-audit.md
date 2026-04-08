---
name: run-security-audit
description: Run comprehensive security checks across the codebase
---

# Run Security Audit

Perform a thorough security audit of the Velya platform codebase, checking for secrets, vulnerabilities, misconfigurations, and policy violations.

## When to Use

Use this skill when asked to run a security audit, check for security issues, review security posture, or scan for vulnerabilities.

## Audit Checks

### 1. Secrets in Code

Search all files for patterns that indicate hardcoded secrets.

**Patterns to search for**:

```
# AWS credentials
AKIA[0-9A-Z]{16}                          # AWS access key ID
[A-Za-z0-9/+=]{40}                         # Potential AWS secret key (near AKIA)
aws_secret_access_key\s*=
aws_access_key_id\s*=

# API keys and tokens
(api[_-]?key|apikey)\s*[:=]\s*['"][^'"]+
(auth[_-]?token|token)\s*[:=]\s*['"][^'"]+
(secret[_-]?key|secret)\s*[:=]\s*['"][^'"]+
bearer\s+[a-zA-Z0-9\-._~+/]+=*

# Private keys
-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----
-----BEGIN PGP PRIVATE KEY BLOCK-----

# Passwords
password\s*[:=]\s*['"][^'"]+
passwd\s*[:=]\s*['"][^'"]+

# Database connection strings
(postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@

# JWT secrets
jwt[_-]?secret\s*[:=]\s*['"][^'"]+

# Anthropic/OpenAI keys
sk-[a-zA-Z0-9]{20,}
sk-ant-[a-zA-Z0-9\-]{20,}
```

**Exclude**: `*.md` documentation files that discuss patterns, `.env.example` files, test fixtures with obviously fake values.

**Severity**: Critical

### 2. GitHub Actions Security

Scan workflow files in `.github/workflows/` and `infra/github-actions/`.

**Check for**:

- Actions referenced by mutable tag (`@v1`, `@v2`, `@main`) instead of SHA
- Overly broad `permissions` (especially `contents: write`, `actions: write` without justification)
- Missing `permissions` block (defaults to broad access)
- Use of `pull_request_target` (potential for privilege escalation)
- Injection of untrusted input into `run:` commands (e.g., `${{ github.event.pull_request.title }}`)
- Missing `concurrency` groups (potential for duplicate runs)

**Severity**: High (unpinned actions), Medium (permissions issues)

### 3. Container Security

Scan Dockerfiles and Kubernetes manifests.

**Dockerfiles**:

- Base image not pinned by digest (`FROM node:22` instead of `FROM node:22@sha256:...`)
- Running as root (no `USER` instruction or `USER root`)
- Using `latest` tag
- Copying secrets or `.env` files into image
- Not using multi-stage builds (dev dependencies in production image)
- Installing unnecessary packages

**Kubernetes manifests and Helm values**:

- Missing `securityContext` on pods or containers
- `runAsNonRoot` not set to `true`
- `readOnlyRootFilesystem` not set to `true`
- `allowPrivilegeEscalation` not set to `false`
- `capabilities` not dropped
- `automountServiceAccountToken` not set to `false`
- Privileged containers (`privileged: true`)
- Host namespace usage (`hostNetwork`, `hostPID`, `hostIPC`)
- Missing resource limits

**Severity**: High (running as root, privileged), Medium (missing hardening)

### 4. IAM Policy Review

Scan IAM policy files (JSON and HCL).

**Check for**:

- Wildcard resource ARNs (`"Resource": "*"`)
- Overly broad action wildcards (`"Action": "s3:*"`, `"Action": "*"`)
- `iam:PassRole` without resource constraint
- `sts:AssumeRole` with `"Resource": "*"`
- Missing condition keys for cross-account access
- Policies that grant `AdministratorAccess`

**Severity**: Critical (admin access, wildcard resources in prod), High (broad action wildcards)

### 5. Network Security

Scan network-related configurations.

**Check for**:

- Missing NetworkPolicy resources for namespaces
- Ingress rules allowing `0.0.0.0/0` (except for public load balancers)
- Services exposed as `type: LoadBalancer` without WAF
- Missing TLS configuration on ingress resources
- Public S3 buckets (`acl = "public-read"` or `block_public_access = false`)
- Public RDS instances (`publicly_accessible = true`)
- Public EKS API endpoint

**Severity**: Critical (public databases), High (missing network policies)

### 6. Dependency Vulnerabilities

Check dependency configurations.

**Check for**:

- `package-lock.json` exists and is committed
- `.npmrc` does not contain auth tokens
- No `npm audit` exclusions for critical/high vulnerabilities
- OpenTofu provider versions are pinned exactly (no `~>`, `>=`)
- `.terraform.lock.hcl` is committed

**Severity**: Medium

### 7. Input Validation

Scan API route handlers and controllers.

**Check for**:

- Missing input validation (no Zod, Joi, or similar at API boundaries)
- SQL queries built with string concatenation (SQL injection)
- User input passed directly to shell commands (command injection)
- User input used in file paths without sanitization (path traversal)
- Missing rate limiting on public endpoints
- Missing authentication middleware on protected routes
- Missing CORS configuration or overly permissive CORS (`origin: '*'`)

**Severity**: Critical (SQL injection, command injection), High (missing auth, path traversal)

### 8. Logging Security

Check logging configuration.

**Check for**:

- Secrets or credentials in log statements
- PHI logged without redaction
- `console.log` in production code (should use structured logging)
- Missing trace/span context in log statements
- Log levels set to `debug` or `trace` in production configs

**Severity**: High (secrets in logs), Medium (console.log)

### 9. AI Security

Check AI-related configurations.

**Check for**:

- Direct LLM SDK imports in services (should go through AI Gateway)
- Hardcoded model names (should be configurable)
- Missing prompt injection safeguards in system prompts
- PHI in prompts sent to external providers (check for PHI routing)
- Missing rate limits on AI endpoints

**Severity**: High (PHI to external providers), Medium (missing gateway usage)

### 10. CORS and API Security

Check API configuration.

**Check for**:

- CORS `origin: '*'` in production configs
- Missing `Content-Security-Policy` headers
- Missing `X-Frame-Options` headers
- Missing `Strict-Transport-Security` headers
- API endpoints without authentication
- Missing rate limiting
- Exposed debug endpoints (`/debug`, `/metrics` without auth)

**Severity**: High (missing auth, permissive CORS), Medium (missing headers)

## Output Format

```markdown
## Security Audit Report

**Date**: {today's date}
**Auditor**: Claude Code
**Scope**: Full codebase scan

### Summary

| Category           | Critical | High | Medium | Low |
| ------------------ | -------- | ---- | ------ | --- |
| Secrets in Code    | {n}      | {n}  | {n}    | {n} |
| GitHub Actions     | {n}      | {n}  | {n}    | {n} |
| Container Security | {n}      | {n}  | {n}    | {n} |
| IAM Policies       | {n}      | {n}  | {n}    | {n} |
| Network Security   | {n}      | {n}  | {n}    | {n} |
| Dependencies       | {n}      | {n}  | {n}    | {n} |
| Input Validation   | {n}      | {n}  | {n}    | {n} |
| Logging            | {n}      | {n}  | {n}    | {n} |
| AI Security        | {n}      | {n}  | {n}    | {n} |
| API Security       | {n}      | {n}  | {n}    | {n} |

### Critical Findings

{Each finding with: description, file path, line number, evidence, remediation}

### High Findings

{Each finding with: description, file path, line number, evidence, remediation}

### Medium Findings

{Each finding with: description, file path, line number, evidence, remediation}

### Low Findings

{Each finding with: description, file path, line number, evidence, remediation}

### Recommendations

1. {Top priority recommendation}
2. {Second priority recommendation}
```

## Rules

- Run all checks unless the user requests a specific subset.
- Never display actual secret values in the report. Redact them (e.g., `AKIA****EXAMPLE`).
- Distinguish between confirmed findings and potential issues.
- For each finding, provide a specific remediation with code or config examples.
- Do not count test files or documentation discussing security patterns as violations.
- `.env.example` files with placeholder values are not violations.
- Comments in code that mention password/secret/key patterns are not violations unless they contain actual values.
