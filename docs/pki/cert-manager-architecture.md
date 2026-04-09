# Arquitetura cert-manager

**Documento**: cert-manager-architecture.md
**Versao**: 1.0
**Data**: 2026-04-09
**Status**: Aprovado

---

## 1. Introducao

O cert-manager e o componente central de gerenciamento de certificados da
Velya Platform. Ele automatiza a emissao, renovacao e revogacao de certificados
TLS no cluster Kubernetes, eliminando completamente a necessidade de
intervencao manual.

Este documento detalha a arquitetura, instalacao, configuracao e integracao
do cert-manager com todos os componentes da plataforma.

---

## 2. Arquitetura de Componentes

### 2.1 Diagrama

```
+================================================================+
|                   CERT-MANAGER ARCHITECTURE                     |
+================================================================+
|                                                                  |
|  +------------------+   +------------------+                     |
|  | cert-manager     |   | cert-manager     |                     |
|  | controller       |   | webhook          |                     |
|  | (2 replicas)     |   | (2 replicas)     |                     |
|  +--------+---------+   +--------+---------+                     |
|           |                      |                                |
|           v                      v                                |
|  +------------------+   +------------------+                     |
|  | cert-manager     |   | Admission        |                     |
|  | cainjector       |   | Webhook          |                     |
|  | (1 replica)      |   | (validacao)      |                     |
|  +--------+---------+   +------------------+                     |
|           |                                                      |
|           v                                                      |
|  +----------------------------------------------------------+   |
|  |              CRDs (Custom Resource Definitions)           |   |
|  |                                                           |   |
|  |  Certificate  CertificateRequest  Order  Challenge        |   |
|  |  Issuer       ClusterIssuer                               |   |
|  +----------------------------------------------------------+   |
|                                                                  |
|  +----------------------------------------------------------+   |
|  |              ISSUERS                                      |   |
|  |                                                           |   |
|  |  +----------------+  +----------------+  +-------------+ |   |
|  |  | acme-staging   |  | acme-production|  | internal-ca | |   |
|  |  | (Let's Encrypt |  | (Let's Encrypt |  | (step-ca /  | |   |
|  |  |  staging)      |  |  production)   |  |  self-sign) | |   |
|  |  +----------------+  +----------------+  +-------------+ |   |
|  +----------------------------------------------------------+   |
|                                                                  |
+==================================================================+
```

### 2.2 Componentes

| Componente | Funcao                                                  | Replicas |
| ---------- | ------------------------------------------------------- | -------- |
| Controller | Processa Certificate resources, cria Orders/Challenges  | 2        |
| Webhook    | Validacao e conversao de recursos via admission webhook | 2        |
| CAInjector | Injeta CA bundles em webhooks e API services            | 1        |

### 2.3 CRDs

| CRD                | Descricao                                  |
| ------------------ | ------------------------------------------ |
| Certificate        | Declaracao do certificado desejado         |
| CertificateRequest | Request individual de certificado          |
| Issuer             | Emissor de certificados (namespace-scoped) |
| ClusterIssuer      | Emissor de certificados (cluster-scoped)   |
| Order              | Ordem ACME em andamento                    |
| Challenge          | Challenge ACME individual                  |

---

## 3. Instalacao

### 3.1 Pre-Requisitos

- Kubernetes 1.25+
- Helm 3.x
- kubectl configurado
- Acesso a Route53 (para DNS-01)

### 3.2 Instalacao via Helm

```bash
# Adicionar repositorio
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Instalar cert-manager
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.14.0 \
  --values cert-manager-values.yaml
```

### 3.3 Helm Values Completo

```yaml
# cert-manager-values.yaml
# Versao da imagem
image:
  repository: quay.io/jetstack/cert-manager-controller
  tag: v1.14.0
  pullPolicy: IfNotPresent

# Instalar CRDs
installCRDs: true

# Replicas para alta disponibilidade
replicaCount: 2

# Leader election
global:
  leaderElection:
    namespace: cert-manager
  logLevel: 2
  podSecurityPolicy:
    enabled: false

# Resources do controller
resources:
  requests:
    cpu: 50m
    memory: 128Mi
  limits:
    cpu: 200m
    memory: 256Mi

# Service Account com IAM role para Route53
serviceAccount:
  create: true
  name: cert-manager
  annotations:
    eks.amazonaws.com/role-arn: 'arn:aws:iam::ACCOUNT_ID:role/cert-manager-route53'

# Webhook
webhook:
  replicaCount: 2
  timeoutSeconds: 30
  resources:
    requests:
      cpu: 25m
      memory: 64Mi
    limits:
      cpu: 100m
      memory: 128Mi

# CA Injector
cainjector:
  replicaCount: 1
  resources:
    requests:
      cpu: 25m
      memory: 128Mi
    limits:
      cpu: 100m
      memory: 256Mi

# Prometheus metrics
prometheus:
  enabled: true
  servicemonitor:
    enabled: true
    namespace: monitoring
    interval: 60s
    scrapeTimeout: 30s
    labels:
      release: prometheus

# Pod security
podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault

containerSecurityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL

# Tolerations e affinity
tolerations: []

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app.kubernetes.io/name
                operator: In
                values:
                  - cert-manager
          topologyKey: kubernetes.io/hostname

# Feature gates
featureGates: ''

# DNS configuration
dns01RecursiveNameserversOnly: true
dns01RecursiveNameservers: '8.8.8.8:53,1.1.1.1:53'
```

### 3.4 Verificacao da Instalacao

```bash
# Verificar pods
kubectl get pods -n cert-manager

# Verificar CRDs
kubectl get crd | grep cert-manager

# Verificar webhook
kubectl get validatingwebhookconfigurations | grep cert-manager

# Verificar logs
kubectl logs -n cert-manager -l app.kubernetes.io/name=cert-manager

# Testar com certificado auto-assinado
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: test-selfsigned
spec:
  selfSigned: {}
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: test-cert
  namespace: default
spec:
  secretName: test-cert-tls
  issuerRef:
    name: test-selfsigned
    kind: ClusterIssuer
  dnsNames:
    - test.example.com
  duration: 1h
EOF

# Verificar
kubectl get certificate test-cert -n default
kubectl delete certificate test-cert -n default
kubectl delete clusterissuer test-selfsigned
```

---

## 4. ClusterIssuer vs Issuer

### 4.1 Quando usar ClusterIssuer

ClusterIssuer e cluster-scoped: qualquer namespace pode referencia-lo.

**Usar para**:

- Let's Encrypt staging e production (compartilhados por toda a plataforma).
- CA interna (step-ca) quando todos os namespaces podem solicitar certificados.
- Qualquer emissor que nao precisa de isolamento por namespace.

### 4.2 Quando usar Issuer

Issuer e namespace-scoped: apenas Certificates no mesmo namespace podem usa-lo.

**Usar para**:

- Quando um namespace especifico tem CA ou credenciais proprias.
- Isolamento de seguranca entre equipes.
- Ambientes multi-tenant onde cada tenant tem sua propria CA.

### 4.3 Configuracao da Velya Platform

| Issuer               | Tipo          | Namespace | Uso                        |
| -------------------- | ------------- | --------- | -------------------------- |
| acme-staging         | ClusterIssuer | N/A       | Testes, CI, novos hosts    |
| acme-production      | ClusterIssuer | N/A       | Hosts oficiais de producao |
| internal-ca          | ClusterIssuer | N/A       | Certificados internos mTLS |
| selfsigned-bootstrap | ClusterIssuer | N/A       | Bootstrap da CA interna    |

---

## 5. ClusterIssuers YAML

### 5.1 Staging

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: acme-staging
  labels:
    app.kubernetes.io/part-of: velya-platform
    app.kubernetes.io/component: pki
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: platform@velya.health
    privateKeySecretRef:
      name: acme-staging-account-key
    solvers:
      - dns01:
          route53:
            region: us-east-1
            hostedZoneID: HOSTED_ZONE_ID
        selector:
          dnsZones:
            - 'velya.health'
```

### 5.2 Production

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: acme-production
  labels:
    app.kubernetes.io/part-of: velya-platform
    app.kubernetes.io/component: pki
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: platform@velya.health
    privateKeySecretRef:
      name: acme-production-account-key
    solvers:
      - dns01:
          route53:
            region: us-east-1
            hostedZoneID: HOSTED_ZONE_ID
        selector:
          dnsZones:
            - 'velya.health'
```

### 5.3 Internal CA (Self-Signed Bootstrap)

```yaml
# Passo 1: ClusterIssuer self-signed para bootstrap
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned-bootstrap
spec:
  selfSigned: {}
---
# Passo 2: Certificate da CA raiz
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: internal-ca-root
  namespace: cert-manager
spec:
  isCA: true
  secretName: internal-ca-root-secret
  issuerRef:
    name: selfsigned-bootstrap
    kind: ClusterIssuer
  commonName: 'Velya Internal Root CA'
  duration: 87600h # 10 anos
  renewBefore: 8760h # 1 ano antes
  privateKey:
    algorithm: ECDSA
    size: 256
---
# Passo 3: ClusterIssuer usando a CA interna
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: internal-ca
spec:
  ca:
    secretName: internal-ca-root-secret
```

---

## 6. Certificate Resources

### 6.1 Anatomia de um Certificate

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: <nome-descritivo>
  namespace: <namespace>
  labels:
    app.kubernetes.io/part-of: velya-platform
spec:
  # Nome do Secret que armazenara o certificado
  secretName: <nome>-tls

  # Referencia ao ClusterIssuer ou Issuer
  issuerRef:
    name: acme-production
    kind: ClusterIssuer

  # Nomes DNS cobertos pelo certificado
  dnsNames:
    - 'example.velya.health'

  # Duracao e renovacao
  duration: 2160h # 90 dias
  renewBefore: 720h # 30 dias antes

  # Algoritmo da chave privada
  privateKey:
    algorithm: ECDSA
    size: 256
    rotationPolicy: Always

  # Usages (opcional, defaults adequados para TLS)
  usages:
    - server auth
    - client auth
```

### 6.2 Secret Gerado

O cert-manager cria um Secret do tipo `kubernetes.io/tls` com:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: <nome>-tls
  namespace: <namespace>
  annotations:
    cert-manager.io/certificate-name: <certificate-name>
    cert-manager.io/issuer-name: <issuer-name>
    cert-manager.io/issuer-kind: ClusterIssuer
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-certificate-chain>
  tls.key: <base64-encoded-private-key>
  ca.crt: <base64-encoded-ca-certificate>
```

---

## 7. Integracao com Ingress

### 7.1 Metodo 1: Anotacao de Ingress (recomendado)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    cert-manager.io/cluster-issuer: 'acme-production'
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.velya.health
      secretName: app-velya-health-tls
  rules:
    - host: app.velya.health
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app
                port:
                  number: 80
```

O cert-manager detecta a anotacao e cria automaticamente um Certificate resource.

### 7.2 Metodo 2: Certificate Resource Explicito

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: app-velya-health
  namespace: velya-app
spec:
  secretName: app-velya-health-tls
  issuerRef:
    name: acme-production
    kind: ClusterIssuer
  dnsNames:
    - app.velya.health
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.velya.health
      secretName: app-velya-health-tls
  rules:
    - host: app.velya.health
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app
                port:
                  number: 80
```

### 7.3 Quando usar cada metodo

| Criterio        | Anotacao        | Certificate Explicito |
| --------------- | --------------- | --------------------- |
| Simplicidade    | Mais simples    | Mais verbose          |
| Controle        | Menos controle  | Controle total        |
| Wildcard        | Nao recomendado | Recomendado           |
| Multi-namespace | Nao             | Sim                   |
| Customizacao    | Limitada        | Total                 |

**Recomendacao Velya**: usar Certificate explicito para wildcard e apex.
Usar anotacao de Ingress para servicos individuais que nao usam wildcard.

---

## 8. Namespaces e RBAC

### 8.1 Namespace do cert-manager

```
cert-manager (namespace)
  |-- cert-manager (controller deployment)
  |-- cert-manager-webhook (webhook deployment)
  |-- cert-manager-cainjector (cainjector deployment)
  |-- cert-manager (serviceaccount)
  |-- acme-staging-account-key (secret)
  |-- acme-production-account-key (secret)
  |-- internal-ca-root-secret (secret)
```

### 8.2 RBAC

O cert-manager precisa de permissoes cluster-wide para:

- Ler e atualizar Secrets em qualquer namespace.
- Ler Ingress resources em qualquer namespace.
- Criar e gerenciar Certificate, Order, Challenge resources.

```yaml
# RBAC minimo para cert-manager (criado pelo Helm chart)
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cert-manager-controller-certificates
rules:
  - apiGroups: ['cert-manager.io']
    resources: ['certificates', 'certificaterequests', 'orders', 'challenges']
    verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete']
  - apiGroups: ['']
    resources: ['secrets']
    verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete']
  - apiGroups: ['']
    resources: ['events']
    verbs: ['create', 'patch']
  - apiGroups: ['networking.k8s.io']
    resources: ['ingresses']
    verbs: ['get', 'list', 'watch']
```

---

## 9. Metricas e Monitoramento

### 9.1 ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: cert-manager
  namespace: monitoring
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: cert-manager
  namespaceSelector:
    matchNames:
      - cert-manager
  endpoints:
    - port: http-metrics
      interval: 60s
      scrapeTimeout: 30s
```

### 9.2 Metricas Principais

| Metrica                                               | Descricao                      |
| ----------------------------------------------------- | ------------------------------ |
| certmanager_certificate_expiration_timestamp_seconds  | Timestamp Unix de expiracao    |
| certmanager_certificate_ready_status                  | 1 se certificado esta Ready    |
| certmanager_certificate_renewal_timestamp_seconds     | Proximo timestamp de renovacao |
| certmanager_controller_sync_call_count                | Chamadas de sync do controller |
| certmanager_http_acme_client_request_count            | Requests para servidor ACME    |
| certmanager_http_acme_client_request_duration_seconds | Latencia de requests ACME      |

---

## 10. Troubleshooting

### 10.1 Fluxo de Debug

```
Certificate -> CertificateRequest -> Order -> Challenge
     |               |                |          |
     v               v                v          v
  kubectl         kubectl          kubectl    kubectl
  describe        describe         describe   describe
  certificate     certificaterequest order    challenge
```

### 10.2 Comandos Uteis

```bash
# Status de todos os certificados
kubectl get certificates -A -o wide

# Certificados com problemas
kubectl get certificates -A | grep -v True

# Detalhes de um certificado
kubectl describe certificate <name> -n <namespace>

# CertificateRequests pendentes
kubectl get certificaterequest -A | grep -v Approved

# Orders em andamento
kubectl get order -A

# Challenges ativos
kubectl get challenge -A

# Logs do controller
kubectl logs -n cert-manager -l app.kubernetes.io/component=controller -f

# Logs do webhook
kubectl logs -n cert-manager -l app.kubernetes.io/component=webhook -f

# Eventos recentes
kubectl get events -n cert-manager --sort-by='.lastTimestamp'

# Verificar Secret TLS
kubectl get secret <name>-tls -n <namespace> -o yaml | head -20

# Inspecionar certificado no Secret
kubectl get secret <name>-tls -n <namespace> -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -text -noout
```

### 10.3 Problemas Comuns

| Problema                  | Causa             | Solucao                        |
| ------------------------- | ----------------- | ------------------------------ |
| Certificate stuck Issuing | Challenge falhou  | Verificar DNS credentials      |
| Challenge pending         | DNS nao propagou  | Esperar ou verificar DNS       |
| Webhook timeout           | Webhook pod down  | Restart webhook                |
| Secret nao criado         | RBAC insuficiente | Verificar ClusterRole          |
| Certificado expirado      | Renewal falhou    | Verificar logs, forcar renewal |

---

## 11. Upgrade

### 11.1 Processo de Upgrade

```bash
# 1. Verificar release notes da nova versao
# 2. Testar em staging primeiro

# 3. Upgrade via Helm
helm upgrade cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --version v1.15.0 \
  --values cert-manager-values.yaml

# 4. Verificar pods
kubectl get pods -n cert-manager

# 5. Verificar CRDs
kubectl get crd | grep cert-manager

# 6. Verificar certificados existentes
kubectl get certificates -A
```

### 11.2 Rollback

```bash
helm rollback cert-manager -n cert-manager
```

---

## 12. Checklist de Configuracao

- [ ] Helm chart instalado com values corretos
- [ ] CRDs criados e verificados
- [ ] Webhook funcionando
- [ ] CAInjector funcionando
- [ ] ClusterIssuer staging criado e testado
- [ ] ClusterIssuer production criado
- [ ] ClusterIssuer internal-ca criado
- [ ] ServiceMonitor configurado
- [ ] Metricas aparecendo no Prometheus
- [ ] Alertas configurados
- [ ] RBAC verificado
- [ ] DNS01 recursive nameservers configurados
- [ ] Pod security context configurado
- [ ] Affinity rules para HA

---

## 13. Changelog

| Data       | Versao | Descricao                                  |
| ---------- | ------ | ------------------------------------------ |
| 2026-04-09 | 1.0    | Versao inicial da arquitetura cert-manager |

---

_Documento mantido pelo Platform Team. Revisao trimestral obrigatoria._
