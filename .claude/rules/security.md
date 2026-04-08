# Security Rules

## Secrets Management

- **No secrets in code. Ever.** No API keys, passwords, tokens, or certificates in source.
- Use **External Secrets Operator** (ESO) to sync secrets from AWS Secrets Manager into Kubernetes.
- Never log secrets. Mask sensitive fields in structured logs.
- `.env` files are `.gitignore`d. Use `.env.example` with placeholder values only.
- Rotate secrets on a defined schedule. Automate rotation where possible.

## GitHub Actions

- **Pin all actions by full SHA**, not by tag or branch. Tags are mutable.
  ```yaml
  # Correct
  uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
  # Wrong
  uses: actions/checkout@v4
  ```
- Use OIDC for AWS authentication in CI. No long-lived access keys.
- Minimize `permissions` block to only what the workflow needs.
- Use `concurrency` groups to prevent duplicate runs.

## IAM and Access

- **Least privilege.** Every role, policy, and service account gets the minimum permissions required.
- Use **EKS Pod Identity** for AWS access from pods. No access keys in containers.
- Separate IAM roles per service. No shared cross-service roles.
- Review IAM policies in PRs. Treat IAM changes as security-critical.
- No wildcard (`*`) resource in IAM policies for production.

## Container Security

- **Scan all container images** before deployment. Block critical/high CVEs.
- Use distroless or minimal base images. No `ubuntu:latest`, no `alpine:latest`.
- Pin base image digests in Dockerfiles.
- Run containers as non-root. Set `runAsNonRoot: true` in pod security context.
- Set `readOnlyRootFilesystem: true` where possible.
- Drop all capabilities, add back only what is needed.
  ```yaml
  securityContext:
    capabilities:
      drop: ["ALL"]
  ```

## SBOM and Supply Chain

- Generate **SBOM** (Software Bill of Materials) for every production image.
- Use `cosign` to sign container images.
- Lock dependency versions. Use lockfiles (`package-lock.json`, `.terraform.lock.hcl`).
- Audit dependencies regularly. Fail CI on known vulnerabilities.
- Use private ECR registries. No pulling from unauthenticated public registries in production.

## Network Security

- **Network policies are required** for every namespace. Default deny ingress and egress.
- Explicitly allow only required traffic paths.
- Use TLS everywhere. No plaintext HTTP between services.
- External traffic terminates TLS at the ingress controller.
- Use mTLS between services where supported.

## Pod Security

- Enforce Pod Security Standards at the namespace level (`restricted` baseline).
- No privileged containers in production.
- No `hostNetwork`, `hostPID`, or `hostIPC` unless explicitly justified and documented.
- Set `automountServiceAccountToken: false` unless the pod needs Kubernetes API access.

## Incident Response

- Security findings are P1. Respond within 1 hour during business hours.
- Critical CVEs in production images: patch within 24 hours or apply compensating control.
- Document all security incidents in `docs/security/incidents/`.
