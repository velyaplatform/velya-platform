# Estrategia TLS Publica -- Let's Encrypt + cert-manager + DNS-01

**Documento**: public-tls-strategy.md
**Versao**: 1.0
**Data**: 2026-04-09
**Status**: Aprovado

---

## 1. Introducao

Este documento detalha a estrategia completa de TLS publico para a Velya Platform.
Todos os endpoints expostos na internet utilizam certificados emitidos pelo
Let's Encrypt, gerenciados automaticamente pelo cert-manager, com validacao
via DNS-01 challenge usando Amazon Route53.

---

## 2. Arquitetura de TLS Publico

### 2.1 Componentes

```
+-----------------------------------------------------------+
|                  TLS PUBLICO - STACK                       |
+-----------------------------------------------------------+
|                                                            |
|  Let's Encrypt (CA)                                        |
|       |                                                    |
|       | ACME Protocol (RFC 8555)                           |
|       v                                                    |
|  cert-manager (Controller)                                 |
|       |                                                    |
|       | DNS-01 Challenge                                   |
|       v                                                    |
|  Route53 (DNS Provider)                                    |
|       |                                                    |
|       | TXT Record: _acme-challenge.velya.health           |
|       v                                                    |
|  Let's Encrypt valida -> emite certificado                 |
|       |                                                    |
|       v                                                    |
|  Kubernetes Secret (tls)                                   |
|       |                                                    |
|       v                                                    |
|  Ingress Controller (NGINX) -> TLS Termination             |
|                                                            |
+-----------------------------------------------------------+
```

### 2.2 Por que DNS-01 e nao HTTP-01?

| Criterio                   | HTTP-01     | DNS-01  |
| -------------------------- | ----------- | ------- |
| Wildcard certificates      | Nao suporta | Suporta |
| Requer porta 80 aberta     | Sim         | Nao     |
| Funciona com Load Balancer | Depende     | Sim     |
| Complexidade               | Menor       | Maior   |
| Automacao completa         | Parcial     | Total   |

**Decisao**: DNS-01 e obrigatorio porque a Velya Platform utiliza certificados
wildcard (`*.velya.health`) e a infraestrutura pode nao ter porta 80 acessivel
durante o provisionamento inicial.

---

## 3. cert-manager -- Instalacao e Configuracao

### 3.1 Instalacao via Helm

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.14.0 \
  --set installCRDs=true \
  --set global.leaderElection.namespace=cert-manager \
  --set prometheus.enabled=true \
  --set prometheus.servicemonitor.enabled=true
```

### 3.2 Helm Values Completo

```yaml
# cert-manager-values.yaml
replicaCount: 2

image:
  repository: quay.io/jetstack/cert-manager-controller
  tag: v1.14.0

installCRDs: true

global:
  leaderElection:
    namespace: cert-manager
  logLevel: 2

resources:
  requests:
    cpu: 50m
    memory: 128Mi
  limits:
    cpu: 200m
    memory: 256Mi

prometheus:
  enabled: true
  servicemonitor:
    enabled: true
    namespace: monitoring
    labels:
      release: prometheus

webhook:
  replicaCount: 2
  resources:
    requests:
      cpu: 25m
      memory: 64Mi
    limits:
      cpu: 100m
      memory: 128Mi

cainjector:
  replicaCount: 1
  resources:
    requests:
      cpu: 25m
      memory: 128Mi
    limits:
      cpu: 100m
      memory: 256Mi

# DNS-01 solver configuration
# Route53 access is configured via IAM role or access key
serviceAccount:
  create: true
  name: cert-manager
  annotations:
    eks.amazonaws.com/role-arn: 'arn:aws:iam::ACCOUNT_ID:role/cert-manager-route53'

# Pod security
podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000

securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
```

---

## 4. ClusterIssuers

### 4.1 Staging ClusterIssuer

O staging deve ser usado para **todos os testes**, novos hosts, e validacao
de configuracao. O staging do Let's Encrypt nao tem rate limits restritivos
e emite certificados que nao sao confiados por browsers (ideal para testes).

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: acme-staging
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

### 4.2 Production ClusterIssuer

O production emite certificados reais, confiados por todos os browsers.
**Sujeito a rate limits** -- usar com cuidado.

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: acme-production
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

---

## 5. Certificate Resources

### 5.1 Wildcard Certificate

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: velya-health-wildcard
  namespace: velya-system
spec:
  secretName: velya-health-wildcard-tls
  issuerRef:
    name: acme-production
    kind: ClusterIssuer
  dnsNames:
    - '*.velya.health'
  duration: 2160h # 90 dias
  renewBefore: 720h # 30 dias antes
  privateKey:
    algorithm: ECDSA
    size: 256
```

### 5.2 Apex Certificate

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: velya-health-apex
  namespace: velya-system
spec:
  secretName: velya-health-apex-tls
  issuerRef:
    name: acme-production
    kind: ClusterIssuer
  dnsNames:
    - 'velya.health'
  duration: 2160h
  renewBefore: 720h
  privateKey:
    algorithm: ECDSA
    size: 256
```

---

## 6. Ingress Integration

### 6.1 Anotacoes de Ingress

Cada Ingress resource deve incluir as seguintes anotacoes para integracao
automatica com cert-manager:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-velya-health
  namespace: velya-app
  annotations:
    cert-manager.io/cluster-issuer: 'acme-production'
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
    nginx.ingress.kubernetes.io/force-ssl-redirect: 'true'
    nginx.ingress.kubernetes.io/hsts: 'true'
    nginx.ingress.kubernetes.io/hsts-max-age: '31536000'
    nginx.ingress.kubernetes.io/hsts-include-subdomains: 'true'
    nginx.ingress.kubernetes.io/hsts-preload: 'true'
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
                name: velya-app
                port:
                  number: 80
```

### 6.2 Redirect HTTP -> HTTPS

O redirect e obrigatorio para todos os hosts. A configuracao e feita via
anotacoes do Ingress Controller NGINX:

```yaml
nginx.ingress.kubernetes.io/ssl-redirect: 'true'
nginx.ingress.kubernetes.io/force-ssl-redirect: 'true'
```

Isso garante que qualquer request HTTP na porta 80 receba um redirect 301
para a versao HTTPS.

---

## 7. HSTS (HTTP Strict Transport Security)

### 7.1 Configuracao

HSTS e habilitado em todos os endpoints publicos com as seguintes diretivas:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- **max-age=31536000**: 1 ano. Browsers lembram de usar HTTPS por este periodo.
- **includeSubDomains**: todos os subdominios de velya.health herdam HSTS.
- **preload**: permite submissao na HSTS preload list dos browsers.

### 7.2 Riscos do HSTS

Uma vez habilitado com `preload` e submetido a lista, reverter e extremamente
dificil. Portanto:

1. Testar exaustivamente com staging antes de habilitar em production.
2. Comecar com `max-age` menor (3600) e aumentar gradualmente.
3. Verificar que TODOS os subdominios suportam HTTPS antes de `includeSubDomains`.

---

## 8. Configuracao TLS do NGINX Ingress

### 8.1 ConfigMap Global

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-ingress-controller
  namespace: ingress-nginx
data:
  ssl-protocols: 'TLSv1.2 TLSv1.3'
  ssl-ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305'
  ssl-prefer-server-ciphers: 'true'
  ssl-session-cache: 'true'
  ssl-session-cache-size: '10m'
  ssl-session-timeout: '1h'
  enable-ocsp-dynamic-stapling: 'true'
  hsts: 'true'
  hsts-max-age: '31536000'
  hsts-include-subdomains: 'true'
  hsts-preload: 'true'
```

---

## 9. Renovacao Automatica

### 9.1 Timeline

```
Dia 0   : Certificado emitido (validade 90 dias)
Dia 60  : cert-manager inicia renovacao (30 dias antes)
Dia 60-89: Janela de renovacao (multiplas tentativas)
Dia 75  : Alerta WARNING se nao renovado
Dia 83  : Alerta CRITICAL se nao renovado
Dia 90  : Certificado expira (nunca deve chegar aqui)
```

### 9.2 Mecanismo de Retry

O cert-manager implementa backoff exponencial para renovacoes que falham:

1. Primeira tentativa: imediata
2. Segunda tentativa: 1 minuto
3. Terceira tentativa: 2 minutos
4. Quarta tentativa: 4 minutos
5. E assim por diante, ate maximo de 32 minutos entre tentativas

### 9.3 Verificacao de Renovacao

```bash
# Verificar status de todos os certificados
kubectl get certificates -A

# Verificar detalhes de um certificado
kubectl describe certificate velya-health-wildcard -n velya-system

# Verificar eventos de renovacao
kubectl get events -n velya-system --field-selector reason=Issuing

# Verificar logs do cert-manager
kubectl logs -n cert-manager -l app.kubernetes.io/name=cert-manager -f
```

---

## 10. Rate Limits do Let's Encrypt

### 10.1 Limites de Production

| Limite                              | Valor                   |
| ----------------------------------- | ----------------------- |
| Certificados por dominio registrado | 50/semana               |
| Certificados duplicados             | 5/semana                |
| Nomes por certificado               | 100                     |
| Accounts por IP                     | 10/3 horas              |
| Pending authorizations              | 300/account             |
| Failed validations                  | 5/hora/account/hostname |
| New orders                          | 300/3 horas             |

### 10.2 Mitigacao

- **Staging para testes**: sempre usar staging para desenvolvimento e testes.
- **Wildcard**: um unico certificado wildcard cobre todos os subdominios.
- **Cache de certificados**: cert-manager reutiliza certificados existentes.
- **Monitoramento**: alertas antes de atingir limites.

---

## 11. Troubleshooting

### 11.1 Certificado nao emitido

```bash
# 1. Verificar Certificate resource
kubectl describe certificate <name> -n <namespace>

# 2. Verificar CertificateRequest
kubectl get certificaterequest -n <namespace>
kubectl describe certificaterequest <name> -n <namespace>

# 3. Verificar Order
kubectl get order -n <namespace>
kubectl describe order <name> -n <namespace>

# 4. Verificar Challenge
kubectl get challenge -n <namespace>
kubectl describe challenge <name> -n <namespace>

# 5. Verificar logs do cert-manager
kubectl logs -n cert-manager deploy/cert-manager -f

# 6. Verificar registro DNS
dig TXT _acme-challenge.velya.health
```

### 11.2 Challenge DNS-01 falhou

Causas comuns:

- Credenciais Route53 invalidas ou expiradas
- Hosted Zone ID incorreto
- Permissoes IAM insuficientes
- Propagacao DNS lenta
- DNS zone nao resolvivel publicamente

### 11.3 Certificado expirado

Nunca deve acontecer com automacao funcionando. Se acontecer:

1. Verificar logs do cert-manager para erros de renovacao.
2. Verificar se as credenciais DNS estao validas.
3. Forcar renovacao: `kubectl delete secret <tls-secret> -n <namespace>`
4. cert-manager detectara o secret ausente e emitira novo certificado.

---

## 12. Seguranca

### 12.1 Chaves Privadas

- Algoritmo: ECDSA P-256 (mais rapido e seguro que RSA 2048)
- Armazenamento: Kubernetes Secrets, encriptados at rest
- Acesso: RBAC restritivo, apenas cert-manager e ingress controller
- Rotacao: a cada emissao de certificado (nova chave a cada 90 dias)

### 12.2 Account Key ACME

- Armazenada em Secret Kubernetes (`acme-production-account-key`)
- Criada automaticamente pelo cert-manager
- Backup recomendado (permite recuperar certificados em novo cluster)
- Rotacao: raramente necessaria, mas possivel criando novo ClusterIssuer

---

## 13. Compliance e Auditoria

### 13.1 Logs

Todos os eventos de emissao e renovacao sao registrados:

- Kubernetes Events no namespace do Certificate
- Logs do cert-manager (stdout, coletados pelo stack de observabilidade)
- Metricas Prometheus para dashboards e alertas

### 13.2 Certificate Transparency

Todos os certificados Let's Encrypt sao publicados em logs de Certificate
Transparency (CT). Isso e obrigatorio e automatico. Os certificados podem
ser auditados via:

- https://crt.sh/?q=velya.health
- https://transparencyreport.google.com/https/certificates

---

## 14. Checklist de Implementacao

- [ ] cert-manager instalado via Helm
- [ ] CRDs do cert-manager verificados
- [ ] ClusterIssuer staging configurado e testado
- [ ] ClusterIssuer production configurado
- [ ] Credenciais Route53 configuradas (IAM role ou Secret)
- [ ] Certificate wildcard emitido via staging
- [ ] Certificate wildcard emitido via production
- [ ] NGINX Ingress configurado com TLS
- [ ] HSTS habilitado
- [ ] HTTP->HTTPS redirect verificado
- [ ] Metricas Prometheus coletando dados
- [ ] Alertas de expiracao configurados
- [ ] Runbook de renovacao falha documentado
- [ ] CT logs verificados

---

## 15. Changelog

| Data       | Versao | Descricao                                |
| ---------- | ------ | ---------------------------------------- |
| 2026-04-09 | 1.0    | Versao inicial da estrategia TLS publica |

---

_Documento mantido pelo Platform Team. Revisao trimestral obrigatoria._
