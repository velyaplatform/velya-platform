---
name: run-security-audit
description: Run security audit across the codebase
---

# Security Audit

## Checks
1. **Secrets in code**: Search for API keys, tokens, passwords, private keys in all files
2. **Dependencies**: Check for known vulnerabilities in package.json files
3. **GitHub Actions**: Verify all actions are pinned by SHA
4. **Docker images**: Check for pinned image tags, non-root users, minimal base images
5. **IAM**: Review IAM policies for least privilege violations
6. **Network**: Check network policies exist for all namespaces
7. **Helm**: Validate security contexts in all Helm values
8. **OpenTofu**: Check for public access, encryption, logging enabled
9. **API**: Check for input validation, auth middleware, rate limiting
10. **CORS**: Verify CORS configuration is restrictive

## Output
Produce a security audit report with findings categorized as:
- Critical (must fix immediately)
- High (fix before next release)
- Medium (fix within sprint)
- Low (track and fix when convenient)
