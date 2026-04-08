# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in Velya, please report it responsibly.

**Do NOT open a public issue.**

Email: security@velya.health (or create a private security advisory on GitHub)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a timeline for resolution.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Security Practices

- All dependencies are monitored via Dependabot
- CodeQL analysis runs on every PR
- Container images are scanned for vulnerabilities
- No secrets are stored in the repository
- All infrastructure follows least-privilege principles
- Supply chain security via pinned dependencies and SHA-verified GitHub Actions
