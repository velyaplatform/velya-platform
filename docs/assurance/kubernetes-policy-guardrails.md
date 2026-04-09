# Kubernetes Policy Guardrails - Velya Platform

> Politicas de admission, validacao e seguranca para o cluster Kubernetes da plataforma Velya.
> Classificacao: Interno | Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

O cluster Velya utiliza duas camadas de enforcement de politicas:

1. **ValidatingAdmissionPolicy** (K8s nativo, v1 a partir de 1.30) - para regras simples e de alta performance
2. **Kyverno ClusterPolicy** - para regras complexas que exigem mutacao ou logica avancada

Todas as politicas sao gerenciadas via GitOps (ArgoCD) e nao podem ser alteradas manualmente no cluster.

### Namespaces Cobertos

| Namespace                 | Descricao                        | Nivel de Restricao            |
| ------------------------- | -------------------------------- | ----------------------------- |
| `velya-dev-core`          | Servicos clinicos criticos       | Maximo                        |
| `velya-dev-platform`      | Infraestrutura e plataforma      | Alto                          |
| `velya-dev-agents`        | Agentes de IA                    | Alto + restricoes de egress   |
| `velya-dev-web`           | Frontend                         | Padrao                        |
| `velya-dev-observability` | Prometheus, Grafana, Loki, Tempo | Alto (privilegios de leitura) |
| `velya-dev-argocd`        | ArgoCD                           | Maximo (auto-gerenciado)      |
| `velya-dev-temporal`      | Temporal Server                  | Alto                          |

---

## 2. ValidatingAdmissionPolicy - Politicas Nativas

### 2.1 Require Resource Limits

Todos os containers devem ter requests e limits de CPU e memoria definidos.

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: velya-require-resource-limits
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ['']
        apiVersions: ['v1']
        operations: ['CREATE', 'UPDATE']
        resources: ['pods']
      - apiGroups: ['apps']
        apiVersions: ['v1']
        operations: ['CREATE', 'UPDATE']
        resources: ['deployments', 'statefulsets', 'daemonsets']
  validations:
    - expression: >-
        object.spec.template.spec.containers.all(c,
          has(c.resources) &&
          has(c.resources.requests) &&
          has(c.resources.limits) &&
          has(c.resources.requests.cpu) &&
          has(c.resources.requests.memory) &&
          has(c.resources.limits.cpu) &&
          has(c.resources.limits.memory)
        )
      message: >-
        Todos os containers devem ter resources.requests e resources.limits
        definidos para CPU e memoria. Consulte a tabela de limites recomendados
        em docs/assurance/kubernetes-policy-guardrails.md
      reason: Invalid
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: velya-require-resource-limits-binding
spec:
  policyName: velya-require-resource-limits
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels:
        velya.io/managed: 'true'
```

**Limites recomendados por servico:**

| Servico                | CPU Request | CPU Limit | Memory Request | Memory Limit |
| ---------------------- | ----------- | --------- | -------------- | ------------ |
| patient-flow           | 250m        | 1000m     | 256Mi          | 512Mi        |
| discharge-orchestrator | 250m        | 1000m     | 256Mi          | 512Mi        |
| task-inbox             | 200m        | 500m      | 256Mi          | 512Mi        |
| ai-gateway             | 500m        | 2000m     | 512Mi          | 2Gi          |
| velya-web              | 100m        | 500m      | 128Mi          | 256Mi        |
| auth-service           | 200m        | 500m      | 256Mi          | 512Mi        |
| notification-hub       | 200m        | 500m      | 256Mi          | 512Mi        |
| agent-coordinator      | 250m        | 1000m     | 256Mi          | 1Gi          |

---

### 2.2 Require Labels Obrigatorias

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: velya-require-labels
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ['apps']
        apiVersions: ['v1']
        operations: ['CREATE', 'UPDATE']
        resources: ['deployments', 'statefulsets', 'daemonsets']
  validations:
    - expression: >-
        has(object.metadata.labels) &&
        has(object.metadata.labels['app.kubernetes.io/name']) &&
        has(object.metadata.labels['app.kubernetes.io/version']) &&
        has(object.metadata.labels['app.kubernetes.io/component']) &&
        has(object.metadata.labels['app.kubernetes.io/managed-by']) &&
        has(object.metadata.labels['velya.io/team']) &&
        has(object.metadata.labels['velya.io/risk-level'])
      message: >-
        Labels obrigatorias ausentes. Requeridas:
        app.kubernetes.io/name, app.kubernetes.io/version,
        app.kubernetes.io/component, app.kubernetes.io/managed-by,
        velya.io/team, velya.io/risk-level
      reason: Invalid
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: velya-require-labels-binding
spec:
  policyName: velya-require-labels
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels:
        velya.io/managed: 'true'
```

**Labels obrigatorias e valores aceitos:**

```yaml
required_labels:
  'app.kubernetes.io/name':
    description: 'Nome do servico'
    examples: ['patient-flow', 'ai-gateway', 'velya-web']

  'app.kubernetes.io/version':
    description: 'Versao semantica ou SHA do commit'
    pattern: "^(v?\\d+\\.\\d+\\.\\d+|[a-f0-9]{7,40})$"

  'app.kubernetes.io/component':
    description: 'Tipo de componente'
    allowed_values: ['api', 'worker', 'web', 'agent', 'gateway', 'scheduler']

  'app.kubernetes.io/managed-by':
    description: 'Ferramenta de gerenciamento'
    allowed_values: ['argocd', 'helm', 'kustomize']

  'velya.io/team':
    description: 'Squad responsavel'
    allowed_values: ['squad-clinical', 'squad-ai', 'squad-platform', 'squad-frontend']

  'velya.io/risk-level':
    description: 'Nivel de risco do servico'
    allowed_values: ['low', 'medium', 'high', 'critical']
```

---

### 2.3 Require Probes

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: velya-require-probes
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ['apps']
        apiVersions: ['v1']
        operations: ['CREATE', 'UPDATE']
        resources: ['deployments', 'statefulsets']
  validations:
    - expression: >-
        object.spec.template.spec.containers.all(c,
          has(c.livenessProbe) &&
          has(c.readinessProbe) &&
          has(c.startupProbe)
        )
      message: >-
        Todos os containers devem ter livenessProbe, readinessProbe e
        startupProbe configurados. Probes devem verificar dependencias
        reais, nao apenas retornar HTTP 200 estatico.
      reason: Invalid
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: velya-require-probes-binding
spec:
  policyName: velya-require-probes
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels:
        velya.io/managed: 'true'
```

**Configuracao de probes recomendada por servico:**

```yaml
# Exemplo para patient-flow
probes:
  livenessProbe:
    httpGet:
      path: /health/live
      port: 8080
    initialDelaySeconds: 10
    periodSeconds: 15
    timeoutSeconds: 5
    failureThreshold: 3
    # /health/live verifica: processo vivo, event loop nao bloqueado
    # NAO verifica dependencias externas

  readinessProbe:
    httpGet:
      path: /health/ready
      port: 8080
    initialDelaySeconds: 5
    periodSeconds: 10
    timeoutSeconds: 5
    failureThreshold: 3
    # /health/ready verifica: DB acessivel, NATS conectado, cache warm
    # Falha remove pod do Service (nao recebe trafego)

  startupProbe:
    httpGet:
      path: /health/startup
      port: 8080
    initialDelaySeconds: 5
    periodSeconds: 5
    timeoutSeconds: 5
    failureThreshold: 30 # 30 * 5s = 150s max startup time
    # /health/startup verifica: migrations rodaram, config carregada
```

---

### 2.4 Require Security Context

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: velya-require-security-context
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ['apps']
        apiVersions: ['v1']
        operations: ['CREATE', 'UPDATE']
        resources: ['deployments', 'statefulsets', 'daemonsets']
  validations:
    - expression: >-
        object.spec.template.spec.containers.all(c,
          has(c.securityContext) &&
          c.securityContext.runAsNonRoot == true &&
          c.securityContext.readOnlyRootFilesystem == true &&
          c.securityContext.allowPrivilegeEscalation == false
        )
      message: >-
        Todos os containers devem ter securityContext com:
        runAsNonRoot=true, readOnlyRootFilesystem=true,
        allowPrivilegeEscalation=false
      reason: Invalid

    - expression: >-
        !has(object.spec.template.spec.containers.exists(c,
          has(c.securityContext) &&
          has(c.securityContext.privileged) &&
          c.securityContext.privileged == true
        ))
      message: 'Containers privilegiados sao proibidos em namespaces Velya'
      reason: Forbidden
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: velya-require-security-context-binding
spec:
  policyName: velya-require-security-context
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels:
        velya.io/managed: 'true'
```

---

### 2.5 Restrict Image Registry

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: velya-restrict-registry
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ['']
        apiVersions: ['v1']
        operations: ['CREATE', 'UPDATE']
        resources: ['pods']
      - apiGroups: ['apps']
        apiVersions: ['v1']
        operations: ['CREATE', 'UPDATE']
        resources: ['deployments', 'statefulsets', 'daemonsets']
  validations:
    - expression: >-
        object.spec.template.spec.containers.all(c,
          c.image.startsWith('ghcr.io/velya-platform/') ||
          c.image.startsWith('docker.io/library/') ||
          c.image.startsWith('quay.io/argoproj/') ||
          c.image.startsWith('docker.io/grafana/') ||
          c.image.startsWith('docker.io/prom/') ||
          c.image.startsWith('ghcr.io/external-secrets/') ||
          c.image.startsWith('nats:') ||
          c.image.startsWith('temporalio/')
        )
      message: >-
        Imagens devem vir de registries confiáveis:
        ghcr.io/velya-platform/*, quay.io/argoproj/*,
        docker.io/grafana/*, docker.io/prom/*,
        ghcr.io/external-secrets/*, nats:*, temporalio/*
      reason: Forbidden
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: velya-restrict-registry-binding
spec:
  policyName: velya-restrict-registry
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels:
        velya.io/managed: 'true'
```

---

### 2.6 Deny Latest Tag

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: velya-deny-latest-tag
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ['apps']
        apiVersions: ['v1']
        operations: ['CREATE', 'UPDATE']
        resources: ['deployments', 'statefulsets', 'daemonsets']
  validations:
    - expression: >-
        object.spec.template.spec.containers.all(c,
          !c.image.endsWith(':latest') &&
          c.image.contains(':')
        )
      message: >-
        Tag ':latest' e proibida. Todas as imagens devem usar
        tag especifica (SHA do commit ou versao semantica).
      reason: Invalid
```

---

## 3. Kyverno ClusterPolicy - Politicas Avancadas

### 3.1 Enforce External Secrets (Proibir Secrets Nativas)

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: velya-enforce-external-secrets
  annotations:
    policies.kyverno.io/title: 'Enforce External Secrets Operator'
    policies.kyverno.io/description: >-
      Proibe criacao direta de Secrets em namespaces Velya.
      Todas as secrets devem ser provisionadas via ExternalSecret.
    policies.kyverno.io/severity: high
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: deny-direct-secret-creation
      match:
        any:
          - resources:
              kinds:
                - Secret
              namespaces:
                - 'velya-dev-core'
                - 'velya-dev-platform'
                - 'velya-dev-agents'
                - 'velya-dev-web'
      exclude:
        any:
          - resources:
              annotations:
                'externalsecrets.external-secrets.io/managed': 'true'
          - resources:
              # Permitir secrets gerenciadas pelo Helm/ArgoCD para TLS
              labels:
                'app.kubernetes.io/managed-by': 'Helm'
                'velya.io/secret-type': 'tls'
      validate:
        message: >-
          Criacao direta de Secrets e proibida. Use ExternalSecret com
          External Secrets Operator para provisionar secrets a partir
          do AWS Secrets Manager. Referencia:
          docs/assurance/kubernetes-policy-guardrails.md#external-secrets
        deny: {}
```

**ExternalSecret padrao para servicos Velya:**

```yaml
# Exemplo: ExternalSecret para patient-flow
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: patient-flow-secrets
  namespace: velya-dev-core
  labels:
    app.kubernetes.io/name: patient-flow
    velya.io/team: squad-clinical
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: velya-aws-secrets-store
    kind: ClusterSecretStore
  target:
    name: patient-flow-secrets
    creationPolicy: Owner
    deletionPolicy: Retain
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: velya/dev/patient-flow/database
        property: url
    - secretKey: NATS_AUTH_TOKEN
      remoteRef:
        key: velya/dev/shared/nats
        property: auth_token
    - secretKey: JWT_SECRET
      remoteRef:
        key: velya/dev/shared/auth
        property: jwt_secret
```

---

### 3.2 Enforce Namespace Isolation (NetworkPolicy)

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: velya-enforce-network-policy
  annotations:
    policies.kyverno.io/title: 'Require NetworkPolicy in Velya Namespaces'
    policies.kyverno.io/severity: high
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: require-network-policy-exists
      match:
        any:
          - resources:
              kinds:
                - Deployment
              namespaces:
                - 'velya-dev-core'
                - 'velya-dev-platform'
                - 'velya-dev-agents'
                - 'velya-dev-web'
      preconditions:
        all:
          - key: '{{ request.operation }}'
            operator: In
            value: ['CREATE']
      validate:
        message: >-
          Todo Deployment deve ter um NetworkPolicy correspondente no
          mesmo namespace. Crie um NetworkPolicy com o mesmo label
          app.kubernetes.io/name antes de criar o Deployment.
        deny:
          conditions:
            all:
              - key: '{{ request.object.metadata.labels."app.kubernetes.io/name" }}'
                operator: AnyNotIn
                value: '{{ networkpolicies.metadata.name }}'
```

**NetworkPolicy padrao para servicos Velya:**

```yaml
# NetworkPolicy para patient-flow (velya-dev-core)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: patient-flow
  namespace: velya-dev-core
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: patient-flow
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        # Permitir trafego do api-gateway
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: velya-dev-platform
          podSelector:
            matchLabels:
              app.kubernetes.io/name: api-gateway
        # Permitir trafego do discharge-orchestrator
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: discharge-orchestrator
      ports:
        - port: 8080
          protocol: TCP
    - from:
        # Permitir scrape do Prometheus
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: velya-dev-observability
          podSelector:
            matchLabels:
              app.kubernetes.io/name: prometheus
      ports:
        - port: 9090
          protocol: TCP
  egress:
    - to:
        # Database
        - ipBlock:
            cidr: 10.0.0.0/16 # VPC interna
      ports:
        - port: 5432
          protocol: TCP
    - to:
        # NATS JetStream
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: velya-dev-platform
          podSelector:
            matchLabels:
              app.kubernetes.io/name: nats
      ports:
        - port: 4222
          protocol: TCP
    - to:
        # DNS
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
```

---

### 3.3 Restrict Agent Egress

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: velya-restrict-agent-egress
  annotations:
    policies.kyverno.io/title: 'Restrict Egress for AI Agents'
    policies.kyverno.io/description: >-
      Agentes de IA so podem se comunicar com endpoints aprovados.
      Acesso externo e restrito a APIs de LLM configuradas.
    policies.kyverno.io/severity: critical
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: validate-agent-egress
      match:
        any:
          - resources:
              kinds:
                - NetworkPolicy
              namespaces:
                - 'velya-dev-agents'
      validate:
        message: >-
          NetworkPolicies no namespace velya-dev-agents devem restringir
          egress apenas a endpoints aprovados: api.anthropic.com,
          api.openai.com, servicos internos Velya, e DNS.
        pattern:
          spec:
            policyTypes:
              - Egress
            egress:
              - to:
                  - (ipBlock | namespaceSelector): '*'
```

**NetworkPolicy para ai-gateway (namespace agents):**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ai-gateway
  namespace: velya-dev-agents
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: ai-gateway
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: velya-dev-platform
          podSelector:
            matchLabels:
              app.kubernetes.io/name: api-gateway
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: agent-coordinator
      ports:
        - port: 8080
          protocol: TCP
  egress:
    # Anthropic API (Claude)
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
      ports:
        - port: 443
          protocol: TCP
    # Servicos internos
    - to:
        - namespaceSelector:
            matchLabels:
              velya.io/managed: 'true'
      ports:
        - port: 8080
          protocol: TCP
    # DNS
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - port: 53
          protocol: UDP
```

---

### 3.4 Enforce Ownership Annotation

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: velya-enforce-ownership
  annotations:
    policies.kyverno.io/title: 'Enforce Resource Ownership'
    policies.kyverno.io/severity: medium
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: require-ownership-annotations
      match:
        any:
          - resources:
              kinds:
                - Deployment
                - StatefulSet
                - Service
                - ConfigMap
              namespaces:
                - 'velya-dev-*'
      validate:
        message: >-
          Recursos em namespaces Velya devem ter annotations de ownership:
          velya.io/owner (email do squad), velya.io/oncall-channel (canal Slack),
          velya.io/runbook-url (URL do runbook).
        pattern:
          metadata:
            annotations:
              velya.io/owner: '?*'
              velya.io/oncall-channel: '#?*'
              velya.io/runbook-url: 'https://?*'
```

---

### 3.5 Mutate: Inject OTel Sidecar

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: velya-inject-otel-collector
  annotations:
    policies.kyverno.io/title: 'Auto-inject OpenTelemetry Collector Sidecar'
spec:
  validationFailureAction: Audit
  background: false
  rules:
    - name: inject-otel-sidecar
      match:
        any:
          - resources:
              kinds:
                - Deployment
              namespaces:
                - 'velya-dev-core'
                - 'velya-dev-platform'
                - 'velya-dev-agents'
              annotations:
                velya.io/otel-inject: 'true'
      mutate:
        patchStrategicMerge:
          spec:
            template:
              spec:
                containers:
                  - name: otel-collector
                    image: 'ghcr.io/open-telemetry/opentelemetry-collector-releases/opentelemetry-collector-contrib:0.96.0'
                    args:
                      - '--config=/etc/otel/config.yaml'
                    resources:
                      requests:
                        cpu: 50m
                        memory: 64Mi
                      limits:
                        cpu: 200m
                        memory: 256Mi
                    volumeMounts:
                      - name: otel-config
                        mountPath: /etc/otel
                volumes:
                  - name: otel-config
                    configMap:
                      name: otel-collector-config
```

---

## 4. Tabela de Rejeicoes e Justificativas

| O que e rejeitado                    | Politica                         | Justificativa                                                         |
| ------------------------------------ | -------------------------------- | --------------------------------------------------------------------- |
| Container sem resource limits        | `velya-require-resource-limits`  | Pods sem limites podem causar noisy neighbor e OOM em outros servicos |
| Labels obrigatorias ausentes         | `velya-require-labels`           | Impossibilita rastreabilidade, monitoramento e ownership              |
| Sem liveness/readiness/startup probe | `velya-require-probes`           | Pod pode parecer saudavel sem estar funcional                         |
| Container rodando como root          | `velya-require-security-context` | Risco de escalacao de privilegio e acesso ao host                     |
| Container privilegiado               | `velya-require-security-context` | Acesso total ao host, inaceitavel para workloads                      |
| Filesystem read-write                | `velya-require-security-context` | Atacante pode gravar binarios maliciosos                              |
| Imagem de registry nao confiavel     | `velya-restrict-registry`        | Risco de supply chain attack                                          |
| Tag :latest                          | `velya-deny-latest-tag`          | Impossibilita reprodutibilidade e rollback                            |
| Secret criada diretamente            | `velya-enforce-external-secrets` | Secrets devem vir do AWS Secrets Manager via ESO                      |
| Deployment sem NetworkPolicy         | `velya-enforce-network-policy`   | Comunicacao irrestrita entre pods                                     |
| Agente com egress irrestrito         | `velya-restrict-agent-egress`    | Agente pode exfiltrar dados para endpoints nao autorizados            |
| Recurso sem ownership                | `velya-enforce-ownership`        | Sem responsavel identificavel para incidentes                         |

---

## 5. Configuracao por Namespace

```yaml
# Label que ativa todas as politicas Velya
namespace_configuration:
  velya-dev-core:
    labels:
      velya.io/managed: 'true'
      velya.io/tier: 'critical'
    policies:
      - velya-require-resource-limits
      - velya-require-labels
      - velya-require-probes
      - velya-require-security-context
      - velya-restrict-registry
      - velya-deny-latest-tag
      - velya-enforce-external-secrets
      - velya-enforce-network-policy
      - velya-enforce-ownership
    pod_security_standard: restricted
    resource_quotas:
      requests.cpu: '8'
      requests.memory: '16Gi'
      limits.cpu: '16'
      limits.memory: '32Gi'
      pods: '50'

  velya-dev-platform:
    labels:
      velya.io/managed: 'true'
      velya.io/tier: 'platform'
    policies:
      - velya-require-resource-limits
      - velya-require-labels
      - velya-require-probes
      - velya-require-security-context
      - velya-restrict-registry
      - velya-deny-latest-tag
      - velya-enforce-external-secrets
      - velya-enforce-ownership
    pod_security_standard: restricted
    resource_quotas:
      requests.cpu: '4'
      requests.memory: '8Gi'
      limits.cpu: '8'
      limits.memory: '16Gi'
      pods: '30'

  velya-dev-agents:
    labels:
      velya.io/managed: 'true'
      velya.io/tier: 'agents'
    policies:
      - velya-require-resource-limits
      - velya-require-labels
      - velya-require-probes
      - velya-require-security-context
      - velya-restrict-registry
      - velya-deny-latest-tag
      - velya-enforce-external-secrets
      - velya-enforce-network-policy
      - velya-restrict-agent-egress
      - velya-enforce-ownership
    pod_security_standard: restricted
    resource_quotas:
      requests.cpu: '8'
      requests.memory: '16Gi'
      limits.cpu: '16'
      limits.memory: '32Gi'
      pods: '40'

  velya-dev-web:
    labels:
      velya.io/managed: 'true'
      velya.io/tier: 'web'
    policies:
      - velya-require-resource-limits
      - velya-require-labels
      - velya-require-probes
      - velya-require-security-context
      - velya-restrict-registry
      - velya-deny-latest-tag
    pod_security_standard: baseline
    resource_quotas:
      requests.cpu: '2'
      requests.memory: '4Gi'
      limits.cpu: '4'
      limits.memory: '8Gi'
      pods: '20'
```

---

## 6. ResourceQuota por Namespace

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: velya-resource-quota
  namespace: velya-dev-core
spec:
  hard:
    requests.cpu: '8'
    requests.memory: '16Gi'
    limits.cpu: '16'
    limits.memory: '32Gi'
    pods: '50'
    services: '20'
    persistentvolumeclaims: '10'
    secrets: '30'
    configmaps: '30'
---
apiVersion: v1
kind: LimitRange
metadata:
  name: velya-limit-range
  namespace: velya-dev-core
spec:
  limits:
    - type: Container
      default:
        cpu: '500m'
        memory: '512Mi'
      defaultRequest:
        cpu: '200m'
        memory: '256Mi'
      min:
        cpu: '50m'
        memory: '64Mi'
      max:
        cpu: '4'
        memory: '4Gi'
    - type: Pod
      max:
        cpu: '8'
        memory: '8Gi'
```

---

## 7. Monitoramento de Politicas

```yaml
# Prometheus rules para monitorar violacoes de politicas
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-policy-alerts
  namespace: velya-dev-observability
spec:
  groups:
    - name: velya.policy.violations
      rules:
        - alert: VelyaAdmissionPolicyViolation
          expr: |
            increase(apiserver_admission_webhook_rejection_count{
              name=~"velya-.*"
            }[5m]) > 0
          for: 0m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: 'Violacao de politica de admission detectada'
            description: >-
              {{ $value }} rejeicoes pela politica {{ $labels.name }}
              nos ultimos 5 minutos.

        - alert: VelyaKyvernoPolicyViolation
          expr: |
            increase(kyverno_policy_results_total{
              rule_result="fail",
              policy_name=~"velya-.*"
            }[5m]) > 0
          for: 0m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: 'Violacao de politica Kyverno detectada'
            description: >-
              Politica {{ $labels.policy_name }} falhou {{ $value }}
              vezes nos ultimos 5 minutos.

        - alert: VelyaPolicyBypassAttempt
          expr: |
            increase(apiserver_admission_webhook_rejection_count{
              name=~"velya-.*"
            }[1h]) > 10
          for: 5m
          labels:
            severity: critical
            team: platform
          annotations:
            summary: 'Possivel tentativa de bypass de politica'
            description: >-
              Mais de 10 rejeicoes pela politica {{ $labels.name }}
              na ultima hora. Investigar se ha tentativa de bypass.
```

---

## 8. Documentos Relacionados

| Documento                           | Descricao                                     |
| ----------------------------------- | --------------------------------------------- |
| `layered-assurance-model.md`        | Modelo completo de assurance (L4 = Admission) |
| `zero-unvalidated-change-policy.md` | Politica de zero mudancas nao validadas       |
| `progressive-delivery-strategy.md`  | Estrategias de deployment pos-admission       |
| `runtime-integrity-model.md`        | Monitoramento apos deploy                     |
