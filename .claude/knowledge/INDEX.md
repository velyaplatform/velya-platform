# Knowledge Base Index

## Por data

### 2026-04-20
- [localstack-poisoning](lessons/2026-04-20-localstack-poisoning.md) — `.zshrc` envenenando AWS calls por 7 dias
- [kubeconfig-drift](lessons/2026-04-20-kubeconfig-drift.md) — 4 contextos stale no kubeconfig
- [eks-allowlist-blindspot](lessons/2026-04-20-eks-allowlist-blindspot.md) — `publicAccessCidrs` travado em IP estrangeiro
- [control-plane-agents-silent-module-not-found](lessons/2026-04-20-control-plane-agents-silent-module-not-found.md) — 3 CronJobs falhavam 100% com MODULE_NOT_FOUND

## Por tag

- `silent-failure`: control-plane-agents-silent-module-not-found
- `developer-shell`: localstack-poisoning
- `kubeconfig`: kubeconfig-drift
- `eks`: eks-allowlist-blindspot
- `aws`: localstack-poisoning
- `blind-spot`: eks-allowlist-blindspot
- `cronjob`: control-plane-agents-silent-module-not-found

## Por agent interessado

- `developer-shell-audit-agent` (proposto): localstack-poisoning
- `kubeconfig-hygiene-agent` (proposto): kubeconfig-drift
- `eks-allowlist-guardian-agent` (proposto): eks-allowlist-blindspot
- `cronjob-failure-notifier-agent` (proposto): control-plane-agents-silent-module-not-found
- `eks-operator`: kubeconfig-drift, eks-allowlist-blindspot
- `iam-reviewer`: localstack-poisoning
- `aws-specialist-agent`: localstack-poisoning
- `security-reviewer`: eks-allowlist-blindspot
- `ci-failure-triage-agent`: control-plane-agents-silent-module-not-found

## Por blast radius

- `workstation-only`: localstack-poisoning, kubeconfig-drift
- `founder-access`: eks-allowlist-blindspot
- `cost-detection, drift-detection, update-detection`: control-plane-agents-silent-module-not-found
