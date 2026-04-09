# Politica de Credenciais para DNS Challenge

**Documento**: dns-challenge-credentials-policy.md
**Versao**: 1.0
**Data**: 2026-04-09
**Status**: Aprovado

---

## 1. Introducao

Este documento define a politica de gerenciamento de credenciais usadas pelo
cert-manager para realizar DNS-01 challenges via Amazon Route53. As credenciais
DNS sao criticas: comprometimento permite emissao de certificados para qualquer
subdominio do dominio controlado.

---

## 2. Principios

### 2.1 Regras Fundamentais

1. **Nunca em repositorio**: credenciais DNS NUNCA devem estar em codigo fonte.
2. **Menor privilegio**: IAM policy permite apenas o minimo necessario.
3. **Rotacao obrigatoria**: credenciais rotacionadas a cada 90 dias.
4. **Auditoria**: todo uso de credenciais registrado via CloudTrail.
5. **Isolamento**: credenciais separadas por ambiente.
6. **Encriptacao**: credenciais encriptadas at rest em Kubernetes Secrets.

### 2.2 Metodos de Autenticacao (Preferencia)

| Prioridade | Metodo | Descricao |
|---|---|---|
| 1 (preferido) | IRSA (IAM Roles for Service Accounts) | Pod assume IAM role via OIDC |
| 2 | Pod Identity | AWS EKS Pod Identity |
| 3 | External Secrets | Sync de AWS Secrets Manager para K8s Secret |
| 4 (evitar) | Static Access Keys | Access Key/Secret Key em K8s Secret |

---

## 3. Metodo 1: IRSA (Recomendado)

### 3.1 Conceito

IRSA (IAM Roles for Service Accounts) permite que o pod do cert-manager
assuma uma IAM role diretamente, sem necessidade de access keys estaticas.

### 3.2 Configuracao

**Passo 1: IAM Policy**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CertManagerDNS01Route53",
      "Effect": "Allow",
      "Action": [
        "route53:GetChange",
        "route53:ListHostedZones",
        "route53:ListHostedZonesByName",
        "route53:ListResourceRecordSets"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CertManagerDNS01Route53ChangeRecords",
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets"
      ],
      "Resource": [
        "arn:aws:route53:::hostedzone/HOSTED_ZONE_ID"
      ]
    }
  ]
}
```

**Passo 2: IAM Role Trust Policy**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/oidc.eks.REGION.amazonaws.com/id/CLUSTER_ID"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.REGION.amazonaws.com/id/CLUSTER_ID:sub": "system:serviceaccount:cert-manager:cert-manager",
          "oidc.eks.REGION.amazonaws.com/id/CLUSTER_ID:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
```

**Passo 3: Service Account Annotation**

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: cert-manager
  namespace: cert-manager
  annotations:
    eks.amazonaws.com/role-arn: "arn:aws:iam::ACCOUNT_ID:role/cert-manager-route53"
```

**Passo 4: ClusterIssuer sem credenciais explicitas**

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
            # Nenhuma credencial explicita - usa IRSA
```

---

## 4. Metodo 2: Pod Identity

### 4.1 Configuracao

AWS EKS Pod Identity e uma alternativa mais recente ao IRSA:

```yaml
apiVersion: eks.amazonaws.com/v1alpha1
kind: PodIdentityAssociation
metadata:
  name: cert-manager-dns
spec:
  namespace: cert-manager
  serviceAccount: cert-manager
  roleArn: "arn:aws:iam::ACCOUNT_ID:role/cert-manager-route53"
```

---

## 5. Metodo 3: External Secrets

### 5.1 Quando Usar

Quando IRSA ou Pod Identity nao estao disponiveis (clusters nao-EKS,
kind, k3s, etc.).

### 5.2 Configuracao

```yaml
# ExternalSecret para sincronizar credenciais do AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: route53-credentials
  namespace: cert-manager
  labels:
    app.kubernetes.io/part-of: velya-platform
    app.kubernetes.io/component: pki
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore

  target:
    name: route53-credentials
    creationPolicy: Owner
    template:
      type: Opaque
      data:
        access-key-id: "{{ .accessKeyId }}"
        secret-access-key: "{{ .secretAccessKey }}"

  data:
    - secretKey: accessKeyId
      remoteRef:
        key: velya/cert-manager/route53
        property: access_key_id

    - secretKey: secretAccessKey
      remoteRef:
        key: velya/cert-manager/route53
        property: secret_access_key
```

### 5.3 ClusterIssuer com Secret Reference

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
            accessKeyIDSecretRef:
              name: route53-credentials
              key: access-key-id
            secretAccessKeySecretRef:
              name: route53-credentials
              key: secret-access-key
```

---

## 6. Metodo 4: Static Access Keys (Evitar)

### 6.1 Quando Usar

Apenas como ultimo recurso quando nenhuma das opcoes anteriores e viavel.

### 6.2 Mitigacoes Obrigatorias

Se usar access keys estaticas:

1. **Rotacao automatica a cada 90 dias** (via automation ou pipeline).
2. **IAM policy minima** (apenas Route53, apenas hosted zone especifica).
3. **Encriptacao at rest** (KMS no etcd do Kubernetes).
4. **RBAC restritivo** (apenas cert-manager pode ler o Secret).
5. **Auditoria** (CloudTrail + Kubernetes audit logs).
6. **Alertas** (alerta se credenciais nao rotacionadas em 90 dias).

### 6.3 Criacao do Secret

```bash
# NUNCA colocar isso em um arquivo no repositorio
kubectl create secret generic route53-credentials \
  --namespace cert-manager \
  --from-literal=access-key-id=AKIA... \
  --from-literal=secret-access-key=...
```

---

## 7. IAM Policy Detalhada

### 7.1 Analise de Permissoes

| Acao | Motivo | Scope |
|---|---|---|
| route53:GetChange | Verificar status de mudanca DNS | * |
| route53:ListHostedZones | Descobrir hosted zone | * |
| route53:ListHostedZonesByName | Descobrir por nome | * |
| route53:ListResourceRecordSets | Listar registros existentes | * |
| route53:ChangeResourceRecordSets | Criar/deletar TXT record | Hosted Zone especifica |

### 7.2 O que NAO incluir

As seguintes permissoes NAO devem ser dadas ao cert-manager:

| Acao | Motivo para NAO incluir |
|---|---|
| route53:CreateHostedZone | Criar zones e responsabilidade do infra team |
| route53:DeleteHostedZone | Deletar zones e destrutivo |
| route53:AssociateVPCWithHostedZone | Nao necessario para DNS-01 |
| route53domains:* | Gerenciamento de dominio e separado |
| iam:* | Nunca dar permissoes IAM |

### 7.3 Policy com Conditions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CertManagerDNS01ReadOnly",
      "Effect": "Allow",
      "Action": [
        "route53:GetChange",
        "route53:ListHostedZones",
        "route53:ListHostedZonesByName",
        "route53:ListResourceRecordSets"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CertManagerDNS01WriteRestricted",
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets"
      ],
      "Resource": [
        "arn:aws:route53:::hostedzone/HOSTED_ZONE_ID"
      ],
      "Condition": {
        "ForAllValues:StringLike": {
          "route53:ChangeResourceRecordSetsNormalizedRecordNames": [
            "_acme-challenge.velya.health",
            "_acme-challenge.*.velya.health"
          ]
        },
        "ForAllValues:StringEquals": {
          "route53:ChangeResourceRecordSetsRecordTypes": ["TXT"]
        }
      }
    }
  ]
}
```

**Nota**: O Condition acima restringe o cert-manager a criar APENAS registros
TXT com prefixo `_acme-challenge`. Isso e o maximo de restricao possivel.

---

## 8. Rotacao de Credenciais

### 8.1 Processo para Access Keys

```bash
# 1. Criar nova access key
aws iam create-access-key --user-name cert-manager-route53

# 2. Atualizar Secret no Kubernetes
kubectl create secret generic route53-credentials \
  --namespace cert-manager \
  --from-literal=access-key-id=<NEW_KEY_ID> \
  --from-literal=secret-access-key=<NEW_SECRET_KEY> \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Restart cert-manager para usar nova credencial
kubectl rollout restart deployment/cert-manager -n cert-manager

# 4. Verificar que cert-manager funciona com nova credencial
kubectl logs -n cert-manager deploy/cert-manager --tail=20

# 5. Testar emissao com staging
# (ver runbook de teste)

# 6. Desativar access key antiga
aws iam update-access-key \
  --user-name cert-manager-route53 \
  --access-key-id <OLD_KEY_ID> \
  --status Inactive

# 7. Apos 24h sem problemas, deletar key antiga
aws iam delete-access-key \
  --user-name cert-manager-route53 \
  --access-key-id <OLD_KEY_ID>
```

### 8.2 Calendario de Rotacao

| Credencial | Frequencia | Metodo | Responsavel |
|---|---|---|---|
| IAM Access Keys | 90 dias | Manual ou automacao | Platform Team |
| IRSA Role | Nao rotaciona (token automatico) | N/A | N/A |
| ACME Account Key | Raramente | Deletar Secret | Platform Team |
| External Secrets | Automatico (refreshInterval) | External Secrets Operator | Automatico |

---

## 9. Auditoria

### 9.1 AWS CloudTrail

Todas as chamadas Route53 sao registradas no CloudTrail:

```json
{
  "eventName": "ChangeResourceRecordSets",
  "sourceIPAddress": "eks-node-ip",
  "userIdentity": {
    "type": "AssumedRole",
    "arn": "arn:aws:sts::ACCOUNT:assumed-role/cert-manager-route53/..."
  },
  "requestParameters": {
    "hostedZoneId": "HOSTED_ZONE_ID",
    "changeBatch": {
      "changes": [{
        "action": "UPSERT",
        "resourceRecordSet": {
          "name": "_acme-challenge.velya.health",
          "type": "TXT"
        }
      }]
    }
  }
}
```

### 9.2 Kubernetes Audit Logs

Acessos ao Secret de credenciais sao registrados:

```json
{
  "verb": "get",
  "resource": "secrets",
  "namespace": "cert-manager",
  "name": "route53-credentials",
  "user": "system:serviceaccount:cert-manager:cert-manager"
}
```

### 9.3 Alertas de Auditoria

```yaml
# Alerta se credenciais acessadas por usuario nao autorizado
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: dns-credentials-audit
  namespace: monitoring
spec:
  groups:
    - name: dns-credentials
      rules:
        - alert: DNSCredentialAccessUnauthorized
          expr: |
            sum(apiserver_audit_event_total{
              verb="get",
              resource="secrets",
              namespace="cert-manager",
              objectRef_name="route53-credentials",
              user_username!~"system:serviceaccount:cert-manager:.*"
            }) > 0
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "Acesso nao autorizado a credenciais DNS"
```

---

## 10. RBAC para Secrets de Credenciais

```yaml
# Apenas cert-manager pode ler o Secret
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: cert-manager-dns-credentials-reader
  namespace: cert-manager
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["route53-credentials"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: cert-manager-dns-credentials-reader
  namespace: cert-manager
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: cert-manager-dns-credentials-reader
subjects:
  - kind: ServiceAccount
    name: cert-manager
    namespace: cert-manager
```

---

## 11. Checklist

- [ ] Metodo de autenticacao escolhido (IRSA, Pod Identity, External Secrets)
- [ ] IAM policy criada com menor privilegio
- [ ] IAM policy com Conditions (apenas TXT, apenas _acme-challenge)
- [ ] IAM role trust policy configurada
- [ ] Service Account anotada (para IRSA)
- [ ] ClusterIssuer configurado com credenciais corretas
- [ ] Teste de emissao realizado com staging
- [ ] CloudTrail habilitado para Route53
- [ ] Kubernetes audit logs habilitados
- [ ] RBAC restritivo para Secret de credenciais
- [ ] Processo de rotacao documentado e agendado
- [ ] Alerta de credencial nao rotacionada configurado
- [ ] Nenhuma credencial em repositorio (verificado)

---

## 12. Changelog

| Data | Versao | Descricao |
|---|---|---|
| 2026-04-09 | 1.0 | Versao inicial da politica de credenciais DNS |

---

*Documento mantido pelo Platform Team e Security Team. Revisao trimestral obrigatoria.*
