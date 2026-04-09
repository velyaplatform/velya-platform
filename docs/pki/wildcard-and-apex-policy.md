# Politica de Certificados Wildcard e Apex

**Documento**: wildcard-and-apex-policy.md
**Versao**: 1.0
**Data**: 2026-04-09
**Status**: Aprovado

---

## 1. Introducao

Este documento estabelece a politica definitiva para uso de certificados
wildcard e apex na Velya Platform. A compreensao correta da cobertura de
cada tipo de certificado e essencial para evitar falhas de TLS.

---

## 2. Conceitos Fundamentais

### 2.1 Certificado Wildcard

Um certificado wildcard (`*.velya.health`) cobre todos os subdominios de
primeiro nivel do dominio especificado:

```
*.velya.health cobre:
  - app.velya.health        ✓
  - api.velya.health        ✓
  - auth.velya.health       ✓
  - grafana.velya.health    ✓
  - qualquer.velya.health   ✓

*.velya.health NAO cobre:
  - velya.health            ✗ (apex)
  - sub.app.velya.health    ✗ (segundo nivel)
  - sub.sub.velya.health    ✗ (segundo nivel)
```

### 2.2 Certificado Apex

O apex (ou naked domain) e o dominio sem nenhum subdominio:

```
velya.health  <-- apex
```

O apex NAO e coberto por certificados wildcard. Requer certificado separado.

### 2.3 Regra Critica

```
+--------------------------------------------------+
|  REGRA: Wildcard NAO cobre Apex                   |
|                                                    |
|  *.velya.health  ≠  velya.health                  |
|                                                    |
|  Sao dois certificados separados (ou um           |
|  certificado com ambos os SANs).                   |
+--------------------------------------------------+
```

---

## 3. Estrategia Velya

### 3.1 Decisao Arquitetural

A Velya Platform utiliza:

1. **Um certificado wildcard** (`*.velya.health`) para todos os subdominios.
2. **Um certificado apex** (`velya.health`) para o dominio raiz.

Alternativamente, pode-se usar **um unico certificado** com ambos os SANs:

```yaml
dnsNames:
  - "*.velya.health"
  - "velya.health"
```

### 3.2 Tabela de Cobertura

| Host | Coberto por Wildcard | Coberto por Apex | Certificado Necessario |
|---|---|---|---|
| velya.health | Nao | Sim | Apex ou combo |
| app.velya.health | Sim | Nao | Wildcard |
| api.velya.health | Sim | Nao | Wildcard |
| auth.velya.health | Sim | Nao | Wildcard |
| grafana.velya.health | Sim | Nao | Wildcard |
| ops.velya.health | Sim | Nao | Wildcard |
| status.velya.health | Sim | Nao | Wildcard |
| docs.velya.health | Sim | Nao | Wildcard |
| app.staging.velya.health | Nao | Nao | *.staging.velya.health |
| staging.velya.health | Sim | Nao | Wildcard |

---

## 4. DNS-01 Obrigatorio para Wildcard

### 4.1 Requisito

Certificados wildcard so podem ser emitidos via DNS-01 challenge. HTTP-01
nao suporta wildcard. Isso e uma limitacao do protocolo ACME (RFC 8555).

```
Wildcard Certificate -> DNS-01 Challenge -> Obrigatorio
HTTP-01 Challenge -> Wildcard -> NAO SUPORTADO
```

### 4.2 Fluxo DNS-01 para Wildcard

```
1. cert-manager cria Order para *.velya.health
2. Let's Encrypt retorna challenge DNS-01
3. cert-manager cria TXT record:
   _acme-challenge.velya.health = "<token>"
4. Let's Encrypt valida TXT record
5. Let's Encrypt emite certificado wildcard
6. cert-manager armazena em Secret
```

---

## 5. Certificate YAML

### 5.1 Wildcard Certificate

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: velya-health-wildcard
  namespace: velya-system
  labels:
    app.kubernetes.io/part-of: velya-platform
    app.kubernetes.io/component: pki
    velya.health/cert-type: wildcard
spec:
  # Secret que armazena o certificado
  secretName: velya-health-wildcard-tls

  # ClusterIssuer de production
  issuerRef:
    name: acme-production
    kind: ClusterIssuer

  # SANs: wildcard
  dnsNames:
    - "*.velya.health"

  # Duracao e renovacao
  duration: 2160h    # 90 dias
  renewBefore: 720h  # 30 dias antes

  # Chave privada ECDSA
  privateKey:
    algorithm: ECDSA
    size: 256
    rotationPolicy: Always

  # Usages
  usages:
    - server auth
    - digital signature
    - key encipherment
```

### 5.2 Apex Certificate

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: velya-health-apex
  namespace: velya-system
  labels:
    app.kubernetes.io/part-of: velya-platform
    app.kubernetes.io/component: pki
    velya.health/cert-type: apex
spec:
  secretName: velya-health-apex-tls

  issuerRef:
    name: acme-production
    kind: ClusterIssuer

  dnsNames:
    - "velya.health"

  duration: 2160h
  renewBefore: 720h

  privateKey:
    algorithm: ECDSA
    size: 256
    rotationPolicy: Always

  usages:
    - server auth
    - digital signature
    - key encipherment
```

### 5.3 Certificado Combo (Wildcard + Apex)

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: velya-health-combo
  namespace: velya-system
  labels:
    app.kubernetes.io/part-of: velya-platform
    app.kubernetes.io/component: pki
    velya.health/cert-type: combo
spec:
  secretName: velya-health-combo-tls

  issuerRef:
    name: acme-production
    kind: ClusterIssuer

  # Ambos os SANs no mesmo certificado
  dnsNames:
    - "*.velya.health"
    - "velya.health"

  duration: 2160h
  renewBefore: 720h

  privateKey:
    algorithm: ECDSA
    size: 256
    rotationPolicy: Always
```

### 5.4 Wildcard para Staging Environment

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: velya-health-staging-wildcard
  namespace: velya-system
  labels:
    velya.health/cert-type: wildcard
    environment: staging
spec:
  secretName: velya-health-staging-wildcard-tls

  issuerRef:
    name: acme-production
    kind: ClusterIssuer

  dnsNames:
    - "*.staging.velya.health"
    - "staging.velya.health"

  duration: 2160h
  renewBefore: 720h

  privateKey:
    algorithm: ECDSA
    size: 256
```

---

## 6. Ingress com Wildcard

### 6.1 Compartilhando Secret entre Ingresses

O Secret do wildcard pode ser referenciado por multiplos Ingresses:

```yaml
# Ingress 1: app
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  namespace: velya-app
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.velya.health
      secretName: velya-health-wildcard-tls  # mesmo Secret
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
---
# Ingress 2: api
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: velya-app
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.velya.health
      secretName: velya-health-wildcard-tls  # mesmo Secret
  rules:
    - host: api.velya.health
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
```

### 6.2 Cross-Namespace Secret Sharing

Se o Secret do wildcard esta em um namespace diferente do Ingress, use
`kubernetes-reflector` ou `ClusterSecret` para copiar o Secret:

```yaml
# No namespace onde o Certificate foi criado
apiVersion: v1
kind: Secret
metadata:
  name: velya-health-wildcard-tls
  namespace: velya-system
  annotations:
    reflector.v1.k8s.emberstack.com/reflection-allowed: "true"
    reflector.v1.k8s.emberstack.com/reflection-allowed-namespaces: "velya-app,monitoring,velya-auth"
    reflector.v1.k8s.emberstack.com/reflection-auto-enabled: "true"
type: kubernetes.io/tls
```

---

## 7. Wildcard vs Certificados Individuais

### 7.1 Comparacao

| Criterio | Wildcard | Individual por Host |
|---|---|---|
| Numero de certificados | 1 | N (um por host) |
| Rate limit impact | 1 emissao | N emissoes |
| Blast radius | Maior (1 cert = todos os hosts) | Menor (1 cert = 1 host) |
| Complexidade | Menor | Maior |
| Flexibilidade | Menor (mesma chave) | Maior (chaves independentes) |
| Renovacao | 1 renovacao | N renovacoes |
| DNS-01 | Obrigatorio | HTTP-01 ou DNS-01 |

### 7.2 Decisao Velya

**Wildcard** para subdominios de producao (`*.velya.health`):
- Simplicidade operacional.
- Minimo impacto em rate limits.
- Todos os subdominios cobertos automaticamente.

**Individual** apenas quando:
- Subdominio requer chave privada isolada.
- Requisito de compliance exige certificado dedicado.
- Subdominio esta em namespace com restricoes especiais.

---

## 8. Seguranca do Wildcard

### 8.1 Riscos

- **Blast radius**: comprometimento da chave privada do wildcard compromete
  todos os subdominios.
- **Over-provisioning**: qualquer subdominio "funciona" com o wildcard, mesmo
  nao intencionais.

### 8.2 Mitigacoes

1. **Rotacao de chave**: `rotationPolicy: Always` gera nova chave a cada renovacao.
2. **RBAC restritivo**: apenas ingress controller e cert-manager acessam o Secret.
3. **Monitoramento**: alertar sobre Ingresses nao autorizados usando o wildcard.
4. **Audit trail**: Kubernetes audit logs para acesso ao Secret.
5. **Separacao por ambiente**: wildcard separado para staging e dev.

---

## 9. Troubleshooting

### 9.1 Wildcard nao emitido

```bash
# Verificar Certificate
kubectl describe certificate velya-health-wildcard -n velya-system

# Verificar se challenge DNS-01 foi criado
kubectl get challenge -n velya-system

# Verificar registro TXT
dig TXT _acme-challenge.velya.health

# Verificar logs
kubectl logs -n cert-manager deploy/cert-manager | grep wildcard
```

### 9.2 Apex nao funciona com wildcard

Erro comum: usar wildcard para apex.

```
ERRADO: TLS para velya.health usando secret velya-health-wildcard-tls
        -> Navegador mostra "NET::ERR_CERT_COMMON_NAME_INVALID"

CORRETO: TLS para velya.health usando secret velya-health-apex-tls
         ou usando secret velya-health-combo-tls
```

### 9.3 Subdominio de segundo nivel

```
ERRADO: TLS para app.staging.velya.health usando *.velya.health
        -> Nao coberto pelo wildcard

CORRETO: Emitir *.staging.velya.health separadamente
```

---

## 10. Checklist

- [ ] Wildcard certificate emitido para *.velya.health
- [ ] Apex certificate emitido para velya.health
- [ ] Wildcard staging emitido para *.staging.velya.health
- [ ] Ingresses usando Secret correto
- [ ] Cross-namespace sharing configurado (se necessario)
- [ ] RBAC restritivo no Secret do wildcard
- [ ] Monitoramento de expiracao ativo
- [ ] Equipe entende que wildcard nao cobre apex
- [ ] Rotacao de chave habilitada

---

## 11. Changelog

| Data | Versao | Descricao |
|---|---|---|
| 2026-04-09 | 1.0 | Versao inicial da politica wildcard e apex |

---

*Documento mantido pelo Platform Team. Revisao trimestral obrigatoria.*
