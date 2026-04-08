# Supply Chain Security

> This document defines how the Velya platform secures its software supply chain, from source code dependencies through container images to runtime execution. Every artifact that runs in production must be traceable, verified, and scanned.

---

## Principles

1. **Verify everything.** Every dependency, action, and base image must be traceable to a known-good source.
2. **Pin everything.** Mutable references (tags, branches, version ranges) are not trusted. Use immutable identifiers (SHAs, digests, exact versions).
3. **Audit continuously.** Vulnerability scanning runs on every build, not just on release.
4. **Minimize surface area.** Fewer dependencies mean fewer vectors. Prefer standard library solutions over third-party packages when the complexity difference is small.

---

## GitHub Actions: Pinned by Commit SHA

All GitHub Actions referenced in workflows must be pinned by the full commit SHA of a verified release. Tags and branches are mutable and can be hijacked.

### Correct

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
- uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
- uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502 # v4.0.2
```

### Incorrect

```yaml
# NEVER do this -- tags are mutable and can be hijacked
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
```

### Verification Process

When updating an action to a new version:

1. Go to the action's GitHub repository and find the release tag.
2. Get the full commit SHA for that tag (`git ls-remote` or check the tag on GitHub).
3. Verify the commit is from a trusted author and is part of the main branch.
4. Update the SHA in the workflow file with a comment noting the version.
5. CI validates SHA format in a pre-merge check.

---

## npm Dependency Management

### Lockfile Enforcement

- `package-lock.json` is committed to the repository and reviewed in PRs.
- CI runs `npm ci` (not `npm install`) to ensure builds use exactly the locked versions.
- Any change to `package-lock.json` triggers a security review.

### npm Audit in CI

Every CI pipeline runs `npm audit` as a required check:

```yaml
- name: Security audit
  run: npm audit --audit-level=high
```

- Builds fail on `high` or `critical` severity vulnerabilities.
- `moderate` and `low` findings are tracked and addressed within the current sprint.
- `npm audit fix` is never run automatically in CI. Dependency updates are reviewed and tested manually.

### Dependency Selection Criteria

Before adding a new dependency:

1. Check the package's maintenance status (last publish date, open issues, bus factor).
2. Review the package's dependency tree for transitive risk.
3. Verify the package is published by a known maintainer or organization.
4. Check for known vulnerabilities in the package history.
5. Prefer packages with TypeScript types included (not DefinitelyTyped).
6. Document the justification in the PR description.

---

## Dependabot Configuration

Dependabot is enabled for all package ecosystems in the repository:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: '/'
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 10
    reviewers:
      - velya-platform-team
    labels:
      - dependencies
      - security

  - package-ecosystem: github-actions
    directory: '/'
    schedule:
      interval: weekly
    reviewers:
      - velya-platform-team
    labels:
      - dependencies
      - ci

  - package-ecosystem: docker
    directory: '/'
    schedule:
      interval: weekly
    labels:
      - dependencies
      - docker
```

### Update Strategy

| Update Type                     | Action                                            |
| ------------------------------- | ------------------------------------------------- |
| Patch versions (1.2.3 -> 1.2.4) | Auto-merge after CI passes                        |
| Minor versions (1.2.x -> 1.3.0) | PR created, requires one review                   |
| Major versions (1.x -> 2.0)     | PR created, requires dedicated testing and review |
| Security patches (any level)    | Prioritized, reviewed and merged within 24 hours  |

---

## Container Image Security

### Base Images

All container images use minimal, hardened base images:

| Use Case         | Base Image                          | Justification                                                             |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| Node.js services | `node:22-slim`                      | Minimal Debian with Node.js, smaller attack surface than full image       |
| Build stages     | `node:22`                           | Full image needed for native module compilation, discarded in final stage |
| Static files     | `gcr.io/distroless/static-debian12` | No shell, no package manager, smallest possible image                     |

### Image Pinning

Base images are pinned by digest in Dockerfiles:

```dockerfile
FROM node:22-slim@sha256:<digest> AS build
```

Renovate Bot updates the digest automatically when new versions are published and creates a PR for review.

### Multi-Stage Builds

All Dockerfiles use multi-stage builds to ensure build tools, source code, and development dependencies are not present in the final image:

```dockerfile
FROM node:22-slim@sha256:<digest> AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

FROM node:22-slim@sha256:<digest> AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Container Runtime Security

Production containers are hardened with pod security context:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: ['ALL']
```

### Image Scanning

Trivy scans every image in the CI pipeline:

```yaml
- name: Scan container image
  uses: aquasecurity/trivy-action@<sha>
  with:
    image-ref: ${{ env.IMAGE_TAG }}
    format: table
    exit-code: 1
    severity: CRITICAL,HIGH
    ignore-unfixed: true
```

- Builds fail on `CRITICAL` or `HIGH` severity vulnerabilities with a known fix.
- Unfixed vulnerabilities are tracked but do not block the build.
- Scan results are published to the security dashboard in Grafana.

### Image Registry

- All production images are stored in private AWS ECR repositories.
- ECR image tag immutability is enabled to prevent tag overwriting.
- ECR lifecycle policies remove untagged images after 14 days.
- Pulling from public registries in production is blocked by OPA Gatekeeper admission policy.

---

## SBOM Generation

A Software Bill of Materials is generated for every container image during the CI build.

### Generation

```yaml
- name: Generate SBOM
  run: syft ${{ env.IMAGE_TAG }} -o cyclonedx-json > sbom.json

- name: Attach SBOM to image
  run: cosign attach sbom --sbom sbom.json ${{ env.IMAGE_TAG }}
```

### Storage

- SBOMs are stored as OCI artifacts attached to the container image in ECR.
- SBOMs are also archived to S3 for long-term retention and compliance queries.
- SBOMs are retained for the lifetime of the image plus 1 year.

### Vulnerability Scanning from SBOM

Grype scans the SBOM for known vulnerabilities:

```yaml
- name: Scan SBOM for vulnerabilities
  run: grype sbom:sbom.json --fail-on high
```

Results are published to the security dashboard alongside Trivy findings.

---

## Image Signing

Container images are signed with cosign and Sigstore:

1. Every image built in CI is signed with a keyless signature via Sigstore's Fulcio CA.
2. The signature includes provenance metadata (build URL, commit SHA, builder identity).
3. A Kyverno admission policy verifies signatures before admitting images to the cluster.
4. Unsigned images are rejected from production namespaces.

```yaml
- name: Sign image
  run: cosign sign --yes ${{ env.IMAGE_TAG }}

- name: Verify signature
  run: cosign verify ${{ env.IMAGE_TAG }} --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

---

## OpenTofu Provider Verification

OpenTofu providers are pinned and verified:

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.40.0"
    }
  }
}
```

- Provider versions are pinned exactly (no `~>` or `>=` constraints).
- The `.terraform.lock.hcl` file is committed and reviewed.
- Provider checksums are verified on every `tofu init`.

---

## Incident Response for Supply Chain Compromise

If a supply chain compromise is detected (malicious package, hijacked action, compromised base image):

1. **Immediately stop** all CI/CD pipelines.
2. **Identify scope** of the compromise (which builds used the affected component).
3. **Roll back** any deployments that included the compromised component.
4. **Pin** to the last known-good version of the affected dependency.
5. **Audit** all images and deployments from the affected time window.
6. **Notify** the security team and file an incident report.
7. **Update** Dependabot/Renovate ignore rules to block the compromised versions.
8. **Review** SBOMs to identify all affected artifacts.
9. **Communicate** to stakeholders per the incident communication plan.

---

## Supply Chain Security Checklist

Before any release, verify:

- [ ] All GitHub Actions are pinned by SHA
- [ ] `package-lock.json` is up to date and reviewed
- [ ] `npm audit` reports no high/critical vulnerabilities
- [ ] Container base images are pinned by digest
- [ ] Trivy scan passes (no critical/high CVEs with fixes)
- [ ] SBOM is generated and attached to the image
- [ ] Image is signed with cosign
- [ ] OpenTofu providers are pinned with lock file
- [ ] No new dependencies added without justification
