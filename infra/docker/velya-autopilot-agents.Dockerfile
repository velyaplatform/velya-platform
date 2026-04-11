# velya-autopilot-agents
#
# Container para rodar os scripts de agents (frontend-quality, backend-quality,
# infra-health) como Kubernetes CronJobs dentro do cluster.
#
# Inclui Node 22, kubectl, helm, git, tsx e o repo velya-platform clonado no
# build time (via COPY — atualiza via rebuild nightly).

FROM node:22-bookworm-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      jq \
      gnupg \
      python3 \
      python3-yaml \
    && rm -rf /var/lib/apt/lists/*

# kubectl
ARG KUBECTL_VERSION=v1.33.0
RUN curl -fsSL -o /usr/local/bin/kubectl \
      "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" \
    && chmod +x /usr/local/bin/kubectl

# helm
ARG HELM_VERSION=v3.16.1
RUN curl -fsSL "https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz" \
      | tar -xz -C /tmp \
    && mv /tmp/linux-amd64/helm /usr/local/bin/helm \
    && rm -rf /tmp/linux-amd64

WORKDIR /workspace

# Copy only what the agents actually need (not the full monorepo)
COPY package.json package-lock.json ./
COPY scripts/ ./scripts/
COPY .claude/agents/ ./.claude/agents/
# memory-guardian needs the repo structure it validates claims against:
# ops/memory-guardian/ (the script + claims), plus the trees referenced
# by claims.yaml (.github/workflows, infra/kubernetes). The copies are
# small compared to the full monorepo and keep this a single-image
# deployment for the whole autopilot family.
COPY ops/memory-guardian/ ./ops/memory-guardian/
COPY .github/workflows/ ./.github/workflows/
COPY infra/kubernetes/ ./infra/kubernetes/

RUN npm install --no-audit --no-fund --omit=dev tsx typescript \
    && npm cache clean --force

# Unprivileged user
RUN groupadd --gid 10001 velya \
    && useradd --uid 10001 --gid velya --shell /bin/bash --create-home velya \
    && chown -R velya:velya /workspace

USER velya

ENTRYPOINT ["npx", "tsx"]
CMD ["scripts/agents/run-infra-health.ts"]
