# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in the Velya platform, please report it responsibly. **Do not open a public GitHub issue.**

### Reporting Process

1. **Email**: Send a detailed report to security@velya.health (or create a private security advisory on GitHub).
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Any suggested remediation (optional)
3. **Response timeline**:
   - Acknowledgment within 24 hours
   - Initial triage within 72 hours
   - Remediation timeline communicated within 1 week
4. **Disclosure**: We follow coordinated disclosure. We will work with you on a timeline for public disclosure after a fix is available.

### Severity Classification

| Severity | Description | Response Time |
|---|---|---|
| Critical | Active exploitation, PHI exposure, authentication bypass | Immediate (< 4 hours) |
| High | Exploitable vulnerability with significant impact | 24 hours |
| Medium | Vulnerability requiring specific conditions to exploit | 1 week |
| Low | Minor issue with limited impact | 30 days |

---

## Supported Versions

| Version | Supported |
|---|---|
| Latest release | Yes |
| Previous minor release | Security fixes only |
| Older versions | Not supported |

We strongly recommend running the latest version at all times.

---

## Security Practices

### Development

- **Dependency management**: All dependencies are pinned to exact versions. Dependabot monitors for known vulnerabilities and creates automated PRs for patches.
- **Code scanning**: CodeQL runs on every pull request to detect common vulnerability patterns (SQL injection, XSS, path traversal, etc.).
- **Secret scanning**: Pre-commit hooks and CI checks prevent accidental commit of secrets (API keys, tokens, passwords, private keys).
- **Image scanning**: Container images are scanned with Trivy on every build. Images with critical or high CVEs are blocked from deployment.
- **SBOM**: A Software Bill of Materials is generated for every release and stored alongside the release artifacts.
- **Signed commits**: All commits to protected branches must be signed.
- **Supply chain security**: All GitHub Actions are pinned by full SHA. No mutable tag references.

### Infrastructure

- **Least privilege**: All service accounts, IAM roles, and Kubernetes pod identities follow the principle of least privilege. Permissions are reviewed quarterly.
- **Network isolation**: Services communicate over private networks. Public endpoints are limited to the API gateway and web application, both behind a WAF.
- **Encryption in transit**: All communication uses TLS 1.2+. Internal service-to-service communication uses mTLS where supported.
- **Encryption at rest**: All data stores (RDS, S3, EBS) use AES-256 encryption with AWS-managed or customer-managed KMS keys.
- **Secrets management**: Secrets are stored in AWS Secrets Manager and injected into pods via External Secrets Operator. No secrets in environment variables, config files, or code.
- **Pod security**: Containers run as non-root with read-only root filesystems. All capabilities are dropped. Pod Security Standards enforced at namespace level.

### Operations

- **Access control**: Production access requires MFA, VPN, and just-in-time access approval. All access is logged and audited.
- **Monitoring**: Security events are monitored via CloudTrail, GuardDuty, and custom detection rules. Alerts are routed to the security on-call.
- **Incident response**: A documented incident response plan is tested quarterly. Post-incident reviews are mandatory for all security incidents.
- **Penetration testing**: External penetration testing is conducted annually. Internal red team exercises run quarterly.

### AI Security

- **AI Gateway**: All LLM interactions are routed through the AI Gateway, which enforces access controls, rate limits, and content filtering.
- **PHI protection**: Requests containing PHI are routed only to self-hosted models or providers with valid BAAs. PHI is redacted from logs.
- **Prompt injection defense**: System prompts include injection resistance instructions. Outputs are validated against known attack patterns.
- **Model access control**: Each agent and service has an explicit allowlist of models it can access, enforced at the AI Gateway.

### Compliance

- **HIPAA**: The platform is designed to meet HIPAA Security Rule requirements. PHI is encrypted at rest and in transit, access is controlled and audited, and BAAs are in place with all subprocessors.
- **SOC 2 Type II**: Controls are designed to meet SOC 2 Trust Service Criteria for security, availability, and confidentiality.
- **HITRUST**: The platform targets HITRUST CSF certification.

---

## Security Architecture

### Network Boundaries

```
Internet --> WAF --> ALB --> Ingress Controller --> Services (private subnet)
                                                        |
                                                   NATS JetStream (internal)
                                                        |
                                                   Databases (isolated subnet)
```

- All inbound traffic passes through AWS WAF with OWASP Core Rule Set.
- Services are deployed in private subnets with no direct internet access.
- Outbound internet access is routed through NAT gateways with egress filtering.
- Database subnets have no internet route, accessible only from service subnets.

### Authentication & Authorization

- **External users**: OIDC-based authentication with MFA. Session tokens are short-lived (1 hour) with refresh token rotation.
- **Service-to-service**: mTLS with pod identity. No shared secrets between services.
- **Agent-to-platform**: Scoped API tokens with per-agent rate limits, managed via the agent registry.
- **CI/CD**: OIDC federation with GitHub Actions. No long-lived AWS credentials.

---

## Security Contacts

| Role | Contact |
|---|---|
| Security Team | security@velya.health |
| Security On-Call | Via PagerDuty escalation policy |
| Privacy Officer | privacy@velya.health |

---

## Acknowledgments

We appreciate the security research community's efforts in helping us keep Velya secure. Researchers who report valid vulnerabilities will be acknowledged (with permission) in our security advisories.
