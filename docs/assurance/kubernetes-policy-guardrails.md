# Kubernetes Policy Guardrails - Velya Platform

## Visao Geral

Este documento define todas as politicas de admissao aplicadas ao cluster Kubernetes da Velya Platform. As politicas utilizam **ValidatingAdmissionPolicy** (K8s nativo v1.30+) como mecanismo primario e **Kyverno ClusterPolicy** como alternativa/complemento para mutacao e geracao de recursos.

---

## Mapeamento de Namespaces

| Namespace | Proposito | Nivel de restricao |
|---|---|---|
| `velya-dev-core` | Servicos de negocio (patient-flow, discharge-orchestrator, task-inbox) | Restritivo |
| `velya-dev-platform` | Servicos de plataforma (Temporal, NATS, Grafana, Prometheus, Loki, Tempo) | Moderado (operadores precisam de privilegios) |
| `velya-dev-agents` | Agentes IA (ai-gateway, claude-agents, agent-coordinator) | Muito restritivo (egress controlado) |
| `velya-dev-web` | Frontend e ingress (velya-web, nginx-ingress) | Restritivo |
| `argocd` | ArgoCD server e controllers | Moderado (precisa de cluster-wide access) |
| `kube-system` | Componentes do Kubernetes | Excluido das politicas custom |
| `monitoring` | Stack de observabilidade | Moderado |
| `external-secrets` | External Secrets Operator | Moderado |

---

## Politica 1: Resource Limits Obrigatorios

### ValidatingAdmissionPolicy

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: velya-require-resource-limits
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["deployments", "statefulsets", "daemonsets"]
    namespaceSelector:
      matchExpressions:
        - key: kubernetes.io/metadata.name
          operator: In
          values:
            - velya-dev-core
            - velya-dev-platform
            - velya-dev-agents
            - velya-dev-web
  validations:
    - expression: |
        object.spec.template.spec.containers.all(c,
          has(c.resources) &&
          has(c.resources.limits) &&
          has(c.resources.limits.cpu) &&
          has(c.resources.limits.memory) &&
          has(c.resources.requests) &&
          has(c.resources.requests.cpu) &&
          has(c.resources.requests.memory)
        )
      message: "Todos os containers devem ter resources.limits e resources.requests definidos para cpu e memory."
      reason: Invalid
    - expression: |
        object.spec.template.spec.containers.all(c,
          !has(c.resources.limits.memory) ||
          quantity(c.resources.limits.memory).compareTo(quantity("4Gi")) <= 0
        )
      message: "Memory limit nao pode exceder 4Gi. Para excecoes, contate Platform Engineering."
      reason: Invalid
    - expression: |
        object.spec.template.spec.containers.all(c,
          !has(c.resources.limits.cpu) ||
          quantity(c.resources.limits.cpu).compareTo(quantity("2")) <= 0
        )
      message: "CPU limit nao pode exceder 2 cores. Para excecoes, contate Platform Engineering."
      reason: Invalid
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: velya-require-resource-limits-binding
spec:
  policyName: velya-require-resource-limits
  validationActions: [Deny]
```

### Kyverno Equivalente

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: velya-require-resource-limits
  annotations:
    policies.kyverno.io/title: Require Resource Limits
    policies.kyverno.io/category: Best Practices
    policies.kyverno.io/severity: high
    policies.kyverno.io/description: >-
      Todos os containers em namespaces Velya devem ter resource limits e requests
      definidos para CPU e memory, com limites maximos configurados.
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: require-limits-and-requests
      match:
        any:
          - resources:
              kinds:
                - Deployment
                - StatefulSet
                - DaemonSet
              namespaces:
                - velya-dev-core
                - velya-dev-platform
                - velya-dev-agents
                - velya-dev-web
      validate:
        message: "Container '{{request.object.spec.template.spec.containers[].name}}' deve ter resources.limits e resources.requests definidos."
        pattern:
          spec:
            template:
              spec:
                containers:
                  - resources:
                      limits:
                        cpu: "?*"
                        memory: "?*"
                      requests:
                        cpu: "?*"
                        memory: "?*"
    - name: max-memory-limit
      match:
        any:
          - resources:
              kinds:
                - Deployment
                - StatefulSet
              namespaces:
                - velya-dev-core
                - velya-dev-agents
                - velya-dev-web
      validate:
        message: "Memory limit nao pode exceder 4Gi."
        deny:
          conditions:
            any:
              - key: "{{request.object.spec.template.spec.containers[].resources.limits.memory}}"
                operator: GreaterThan
                value: "4Gi"
```

### O que e rejeitado e por que

| Cenario | Resultado | Motivo |
|---|---|---|
| Container sem `resources.limits` | REJEITADO | Pode consumir recursos ilimitados, afetando outros pods |
| Container sem `resources.requests` | REJEITADO | Scheduler nao pode alocar recursos adequadamente |
| Memory limit > 4Gi | REJEITADO | Protege contra OOM que afeta o node inteiro |
| CPU limit > 2 cores | REJEITADO | Evita starvation de CPU para outros workloads |
| Init container sem limits | PERMITIDO (com warning) | Init containers sao efemeros |

---

## Politica 2: Labels Obrigatorios

### ValidatingAdmissionPolicy

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: velya-require-labels
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["deployments", "statefulsets"]
    namespaceSelector:
      matchExpressions:
        - key: kubernetes.io/metadata.name
          operator: In
          values:
            - velya-dev-core
            - velya-dev-platform
            - velya-dev-agents
            - velya-dev-web
  validations:
    - expression: |
        has(object.metadata.labels) &&
        has(object.metadata.labels.app) &&
        has(object.metadata.labels.version) &&
        has(object.metadata.labels.team) &&
        has(object.metadata.labels.tier)
      message: "Labels obrigatorios: app, version, team, tier"
      reason: Invalid
    - expression: |
        !has(object.metadata.labels.tier) ||
        object.metadata.labels.tier in ["frontend", "backend", "platform", "agent", "data"]
      message: "Label 'tier' deve ser um dos: frontend, backend, platform, agent, data"
      reason: Invalid
    - expression: |
        !has(object.metadata.labels.team) ||
        object.metadata.labels.team in ["core", "platform", "agents", "web", "sre"]
      message: "Label 'team' deve ser um dos: core, platform, agents, web, sre"
      reason: Invalid
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: velya-require-labels-binding
spec:
  policyName: velya-require-labels
  validationActions: [Deny]
```

### Labels obrigatorios da Velya

| Label | Descricao | Valores validos | Exemplo |
|---|---|---|---|
| `app` | Nome do servico | Qualquer string | `patient-flow` |
| `version` | Versao do deploy | SemVer ou SHA | `v1.2.3` ou `abc1234` |
| `team` | Time responsavel | core, platform, agents, web, sre | `core` |
| `tier` | Camada arquitetural | frontend, backend, platform, agent, data | `backend` |

### Labels recomendados (nao obrigatorios)

| Label | Descricao | Exemplo |
|---|---|---|
| `part-of` | Sistema pai | `velya-platform` |
| `managed-by` | Ferramenta de gestao | `argocd` |
| `environment` | Ambiente | `dev`, `staging`, `prod` |
| `criticality` | Criticidade | `critical`, `high`, `medium`, `low` |

---

## Politica 3: Probes de Saude Obrigatorios

### ValidatingAdmissionPolicy

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: velya-require-probes
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["deployments"]
    namespaceSelector:
      matchExpressions:
        - key: kubernetes.io/metadata.name
          operator: In
          values:
            - velya-dev-core
            - velya-dev-agents
            - velya-dev-web
  validations:
    - expression: |
        object.spec.template.spec.containers.all(c,
          has(c.readinessProbe) && has(c.livenessProbe)
        )
      message: "Todos os containers devem ter readinessProbe e livenessProbe configurados."
      reason: Invalid
    - expression: |
        object.spec.template.spec.containers.all(c,
          !has(c.livenessProbe) ||
          !has(c.livenessProbe.initialDelaySeconds) ||
          c.livenessProbe.initialDelaySeconds >= 10
        )
      message: "livenessProbe.initialDelaySeconds deve ser >= 10s para evitar kills prematuros."
      reason: Invalid
    - expression: |
        object.spec.template.spec.containers.all(c,
          has(c.startupProbe)
        )
      message: "startupProbe e obrigatorio para aplicacoes Velya (evita kills durante startup lento)."
      reason: Invalid
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: velya-require-probes-binding
spec:
  policyName: velya-require-probes
  validationActions: [Deny]
```

### Configuracao recomendada de probes por servico

```yaml
# patient-flow (Go service com dependencias: PostgreSQL, NATS, Temporal)
readinessProbe:
  httpGet:
    path: /healthz/ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
  successThreshold: 1
livenessProbe:
  httpGet:
    path: /healthz/live
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 20
  failureThreshold: 3
startupProbe:
  httpGet:
    path: /healthz/startup
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 30  # 5 + 30*5 = 155s max startup time

---
# ai-gateway (Python service com dependencias: modelos IA, cache Redis)
readinessProbe:
  httpGet:
    path: /health/ready
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 15
  failureThreshold: 3
livenessProbe:
  httpGet:
    path: /health/live
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 30
  failureThreshold: 3
startupProbe:
  httpGet:
    path: /health/startup
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 10
  failureThreshold: 30  # Modelo pode demorar para carregar

---
# velya-web (Next.js frontend)
readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 15
  failureThreshold: 3
startupProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 12  # 5 + 12*5 = 65s max
```

---

## Politica 4: Security Context

### ValidatingAdmissionPolicy

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: velya-security-context
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["deployments", "statefulsets"]
    namespaceSelector:
      matchExpressions:
        - key: kubernetes.io/metadata.name
          operator: In
          values:
            - velya-dev-core
            - velya-dev-agents
            - velya-dev-web
  validations:
    - expression: |
        object.spec.template.spec.containers.all(c,
          has(c.securityContext) &&
          has(c.securityContext.runAsNonRoot) &&
          c.securityContext.runAsNonRoot == true
        )
      message: "Todos os containers devem executar como non-root (runAsNonRoot: true)."
      reason: Forbidden
    - expression: |
        object.spec.template.spec.containers.all(c,
          has(c.securityContext) &&
          has(c.securityContext.allowPrivilegeEscalation) &&
          c.securityContext.allowPrivilegeEscalation == false
        )
      message: "allowPrivilegeEscalation deve ser false."
      reason: Forbidden
    - expression: |
        object.spec.template.spec.containers.all(c,
          has(c.securityContext) &&
          has(c.securityContext.readOnlyRootFilesystem) &&
          c.securityContext.readOnlyRootFilesystem == true
        )
      message: "readOnlyRootFilesystem deve ser true. Use emptyDir para diretorios temporarios."
      reason: Forbidden
    - expression: |
        !has(object.spec.template.spec.containers) ||
        object.spec.template.spec.containers.all(c,
          !has(c.securityContext.capabilities) ||
          !has(c.securityContext.capabilities.add) ||
          c.securityContext.capabilities.add.size() == 0
        )
      message: "Nao e permitido adicionar capabilities. Remova capabilities.add."
      reason: Forbidden
    - expression: |
        has(object.spec.template.spec.securityContext) &&
        has(object.spec.template.spec.securityContext.fsGroup)
      message: "Pod deve ter securityContext.fsGroup definido."
      reason: Invalid
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: velya-security-context-binding
spec:
  policyName: velya-security-context
  validationActions: [Deny]
```

### Security context padrao recomendado

```yaml
# Template de security context para servicos Velya
spec:
  template:
    spec:
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: app
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: cache
              mountPath: /app/.cache
      volumes:
        - name: tmp
          emptyDir:
            sizeLimit: 100Mi
        - name: cache
          emptyDir:
            sizeLimit: 500Mi
```

---

## Politica 5: Restricao de Namespaces

### ValidatingAdmissionPolicy

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: velya-namespace-restriction
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["deployments", "statefulsets"]
  validations:
    - expression: |
        object.metadata.namespace in [
          "velya-dev-core",
          "velya-dev-platform",
          "velya-dev-agents",
          "velya-dev-web",
          "argocd",
          "monitoring",
          "external-secrets",
          "kube-system"
        ]
      message: "Workloads so podem ser criados em namespaces Velya autorizados."
      reason: Forbidden
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: velya-namespace-restriction-binding
spec:
  policyName: velya-namespace-restriction
  validationActions: [Deny]
```

### Restricoes por namespace

| Namespace | Quem pode deployar | Restricoes adicionais |
|---|---|---|
| `velya-dev-core` | ArgoCD (via GitOps) | PDB obrigatorio, HPA recomendado |
| `velya-dev-platform` | ArgoCD (via GitOps) | Helm charts gerenciados |
| `velya-dev-agents` | ArgoCD (via GitOps) | NetworkPolicy restritiva, egress limitado |
| `velya-dev-web` | ArgoCD (via GitOps) | Ingress obrigatorio com TLS |
| `argocd` | Terraform/OpenTofu | Apenas administradores |
| `monitoring` | ArgoCD/Helm | Retention policies definidas |

---

## Politica 6: Secrets via External Secrets Operator

### ValidatingAdmissionPolicy

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: velya-no-inline-secrets
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["secrets"]
    namespaceSelector:
      matchExpressions:
        - key: kubernetes.io/metadata.name
          operator: In
          values:
            - velya-dev-core
            - velya-dev-agents
            - velya-dev-web
  validations:
    - expression: |
        object.type == "kubernetes.io/tls" ||
        object.type == "kubernetes.io/service-account-token" ||
        object.type == "helm.sh/release.v1" ||
        (has(object.metadata.labels) &&
         has(object.metadata.labels["app.kubernetes.io/managed-by"]) &&
         object.metadata.labels["app.kubernetes.io/managed-by"] == "external-secrets")
      message: "Secrets devem ser gerenciados pelo External Secrets Operator. Crie um ExternalSecret ao inves de um Secret diretamente."
      reason: Forbidden
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: velya-no-inline-secrets-binding
spec:
  policyName: velya-no-inline-secrets
  validationActions: [Deny]
```

### Exemplo de ExternalSecret correto

```yaml
# Correto: Secret gerenciado via ESO com AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: patient-flow-db-credentials
  namespace: velya-dev-core
  labels:
    app: patient-flow
    team: core
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: velya-aws-secretsmanager
    kind: ClusterSecretStore
  target:
    name: patient-flow-db-credentials
    creationPolicy: Owner
    template:
      type: Opaque
      data:
        DATABASE_URL: "postgresql://{{ .username }}:{{ .password }}@{{ .host }}:5432/patient_flow?sslmode=require"
  data:
    - secretKey: username
      remoteRef:
        key: velya/dev/patient-flow/db
        property: username
    - secretKey: password
      remoteRef:
        key: velya/dev/patient-flow/db
        property: password
    - secretKey: host
      remoteRef:
        key: velya/dev/patient-flow/db
        property: host
```

```yaml
# REJEITADO: Secret criado diretamente
apiVersion: v1
kind: Secret
metadata:
  name: patient-flow-db-credentials
  namespace: velya-dev-core
type: Opaque
data:
  DATABASE_URL: cG9zdGdyZXNxbDovL3VzZXI6cGFzc0Bob3N0OjU0MzIvZGI=
# ^^ Isto sera REJEITADO pela politica velya-no-inline-secrets
```

---

## Politica 7: Network Policies

### Kyverno (geracao automatica de NetworkPolicy)

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: velya-generate-network-policy
  annotations:
    policies.kyverno.io/title: Generate Default Network Policy
    policies.kyverno.io/description: >-
      Gera NetworkPolicy default deny-all para novos namespaces Velya
      e permite apenas trafego explicito.
spec:
  rules:
    - name: generate-default-deny
      match:
        any:
          - resources:
              kinds:
                - Namespace
              names:
                - "velya-*"
      generate:
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        name: default-deny-all
        namespace: "{{request.object.metadata.name}}"
        data:
          spec:
            podSelector: {}
            policyTypes:
              - Ingress
              - Egress
```

### NetworkPolicy para velya-dev-agents (restritiva)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agents-egress-restricted
  namespace: velya-dev-agents
spec:
  podSelector:
    matchLabels:
      tier: agent
  policyTypes:
    - Egress
    - Ingress
  ingress:
    # Permite trafego do velya-dev-core (servicos chamam os agentes)
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: velya-dev-core
      ports:
        - protocol: TCP
          port: 8080
    # Permite trafego do monitoring (scrape Prometheus)
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: monitoring
      ports:
        - protocol: TCP
          port: 9090
  egress:
    # Permite DNS
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
    # Permite NATS
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: velya-dev-platform
      ports:
        - protocol: TCP
          port: 4222
    # Permite Temporal
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: velya-dev-platform
      ports:
        - protocol: TCP
          port: 7233
    # Permite API Claude/OpenAI (egress externo controlado)
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - protocol: TCP
          port: 443
```

---

## Politica 8: Restricao de Imagens

### ValidatingAdmissionPolicy

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: velya-allowed-registries
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["deployments", "statefulsets", "daemonsets"]
    namespaceSelector:
      matchExpressions:
        - key: kubernetes.io/metadata.name
          operator: In
          values:
            - velya-dev-core
            - velya-dev-platform
            - velya-dev-agents
            - velya-dev-web
  validations:
    - expression: |
        object.spec.template.spec.containers.all(c,
          c.image.startsWith("123456789012.dkr.ecr.sa-east-1.amazonaws.com/velya/") ||
          c.image.startsWith("docker.io/library/") ||
          c.image.startsWith("ghcr.io/argoproj/") ||
          c.image.startsWith("quay.io/prometheus/") ||
          c.image.startsWith("grafana/") ||
          c.image.startsWith("nats:") ||
          c.image.startsWith("temporalio/")
        )
      message: "Imagens devem vir de registries autorizados: ECR Velya, Docker Hub (oficiais), GHCR (ArgoCD), Quay (Prometheus)."
      reason: Forbidden
    - expression: |
        object.spec.template.spec.containers.all(c,
          !c.image.endsWith(":latest")
        )
      message: "Tag 'latest' e proibida. Use SHA ou tag semantica."
      reason: Forbidden
    - expression: |
        object.spec.template.spec.containers.all(c,
          c.image.contains(":") || c.image.contains("@sha256:")
        )
      message: "Toda imagem deve ter tag explicita ou digest SHA256."
      reason: Forbidden
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: velya-allowed-registries-binding
spec:
  policyName: velya-allowed-registries
  validationActions: [Deny]
```

### Kyverno: Verificacao de assinatura de imagem

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: velya-verify-image-signature
spec:
  validationFailureAction: Enforce
  webhookTimeoutSeconds: 30
  rules:
    - name: verify-cosign-signature
      match:
        any:
          - resources:
              kinds:
                - Pod
              namespaces:
                - velya-dev-core
                - velya-dev-agents
      verifyImages:
        - imageReferences:
            - "123456789012.dkr.ecr.sa-east-1.amazonaws.com/velya/*"
          attestors:
            - count: 1
              entries:
                - keyless:
                    subject: "https://github.com/velya-platform/*"
                    issuer: "https://token.actions.githubusercontent.com"
                    rekor:
                      url: https://rekor.sigstore.dev
```

---

## Politica 9: Ownership e PodDisruptionBudget

### Kyverno: PDB obrigatorio para servicos criticos

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: velya-require-pdb
  annotations:
    policies.kyverno.io/title: Require PodDisruptionBudget
    policies.kyverno.io/description: >-
      Servicos criticos no namespace velya-dev-core devem ter um
      PodDisruptionBudget associado para garantir disponibilidade
      durante manutencoes e upgrades de node.
spec:
  validationFailureAction: Audit  # Audit primeiro, Enforce apos validacao
  background: true
  rules:
    - name: check-pdb-exists
      match:
        any:
          - resources:
              kinds:
                - Deployment
              namespaces:
                - velya-dev-core
      preconditions:
        all:
          - key: "{{request.object.spec.replicas}}"
            operator: GreaterThan
            value: 1
      validate:
        message: "Deployments com mais de 1 replica em velya-dev-core devem ter um PodDisruptionBudget. Crie um PDB com minAvailable ou maxUnavailable."
        deny:
          conditions:
            all:
              - key: "{{request.object.metadata.labels.pdb-configured}}"
                operator: NotEquals
                value: "true"
```

### PDB recomendado para servicos Velya

```yaml
# PDB para patient-flow
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: patient-flow-pdb
  namespace: velya-dev-core
  labels:
    app: patient-flow
    team: core
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: patient-flow

---
# PDB para discharge-orchestrator
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: discharge-orchestrator-pdb
  namespace: velya-dev-core
  labels:
    app: discharge-orchestrator
    team: core
spec:
  maxUnavailable: 1
  selector:
    matchLabels:
      app: discharge-orchestrator

---
# PDB para task-inbox
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: task-inbox-pdb
  namespace: velya-dev-core
  labels:
    app: task-inbox
    team: core
spec:
  minAvailable: "50%"
  selector:
    matchLabels:
      app: task-inbox
```

---

## Resumo de Politicas e Status

| # | Politica | Mecanismo | Namespaces | Acao |
|---|---|---|---|---|
| 1 | Resource Limits | VAP | core, platform, agents, web | Deny |
| 2 | Labels Obrigatorios | VAP | core, platform, agents, web | Deny |
| 3 | Probes de Saude | VAP | core, agents, web | Deny |
| 4 | Security Context | VAP | core, agents, web | Deny |
| 5 | Restricao de Namespace | VAP | cluster-wide | Deny |
| 6 | Secrets via ESO | VAP | core, agents, web | Deny |
| 7 | Network Policies | Kyverno (generate) | velya-* | Generate |
| 8 | Restricao de Imagens | VAP + Kyverno | core, platform, agents, web | Deny |
| 9 | PDB Obrigatorio | Kyverno | core | Audit (migrar para Enforce) |

---

## Processo de Excecao

Quando uma politica precisa ser temporariamente relaxada:

1. Criar issue com label `policy-exception`
2. Justificativa tecnica detalhada
3. Aprovacao de SRE Lead + Security
4. Implementar excecao via annotation:

```yaml
metadata:
  annotations:
    velya.io/policy-exception: "velya-require-resource-limits"
    velya.io/exception-reason: "Modelo de IA precisa de 8Gi para inferencia"
    velya.io/exception-expiry: "2026-05-08"
    velya.io/exception-approved-by: "sre-lead"
```

5. Excecao deve ter data de expiracao (maximo 90 dias)
6. Renovacao requer nova aprovacao
7. Relatorio mensal de excecoes ativas para Engineering Manager
