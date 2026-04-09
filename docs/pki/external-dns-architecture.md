# Arquitetura ExternalDNS

**Documento**: external-dns-architecture.md
**Versao**: 1.0
**Data**: 2026-04-09
**Status**: Aprovado

---

## 1. Introducao

O ExternalDNS automatiza a criacao e atualizacao de registros DNS no Amazon
Route53 a partir de recursos Kubernetes (Ingress, Service). Isso elimina a
necessidade de gerenciamento manual de DNS e garante que registros DNS estejam
sempre sincronizados com o estado do cluster.

---

## 2. Arquitetura

### 2.1 Diagrama

```
+================================================================+
|                   EXTERNALDNS ARCHITECTURE                      |
+================================================================+
|                                                                  |
|  KUBERNETES CLUSTER                                              |
|                                                                  |
|  +------------------+                                            |
|  | Ingress          |                                            |
|  | app.velya.health |---+                                        |
|  +------------------+   |                                        |
|                         |                                        |
|  +------------------+   |   +------------------+                 |
|  | Ingress          |---+-->| ExternalDNS      |                 |
|  | api.velya.health |   |   | Controller       |                 |
|  +------------------+   |   +--------+---------+                 |
|                         |            |                            |
|  +------------------+   |            | Route53 API               |
|  | Service (LB)     |---+            |                            |
|  | auth.velya.health|                v                            |
|  +------------------+   +------------------+                     |
|                         | Amazon Route53   |                     |
|                         | velya.health     |                     |
|                         +------------------+                     |
|                                                                  |
+==================================================================+
```

### 2.2 Fluxo de Operacao

1. Desenvolvedor cria/atualiza Ingress ou Service com hostname.
2. ExternalDNS detecta o recurso via watch.
3. ExternalDNS calcula o diff entre estado desejado e atual no Route53.
4. ExternalDNS cria/atualiza/deleta registros no Route53.
5. DNS propaga globalmente.

---

## 3. Instalacao

### 3.1 Helm Values

```yaml
# external-dns-values.yaml
image:
  repository: registry.k8s.io/external-dns/external-dns
  tag: v0.14.0

# Provedor DNS
provider: aws

# Modo de operacao
policy: upsert-only # Nao deletar registros nao gerenciados

# Fontes de registros
sources:
  - ingress
  - service

# Filtros
domainFilters:
  - velya.health

# Filtro por annotation (opcional, para controle fino)
annotationFilter: 'external-dns.alpha.kubernetes.io/managed=true'

# Tipo de registro
registry: txt
txtOwnerId: velya-platform
txtPrefix: externaldns-

# AWS Configuration
aws:
  region: us-east-1
  zoneType: public
  # Prefer CNAME over ALIAS for compatibility
  preferCNAME: false

# Intervalo de sincronizacao
interval: 1m

# Log level
logLevel: info
logFormat: json

# Resources
resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    cpu: 100m
    memory: 128Mi

# Service Account com IAM role
serviceAccount:
  create: true
  name: external-dns
  annotations:
    eks.amazonaws.com/role-arn: 'arn:aws:iam::ACCOUNT_ID:role/external-dns-route53'

# Security context
securityContext:
  runAsNonRoot: true
  runAsUser: 65534
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL

# Pod security
podSecurityContext:
  fsGroup: 65534
  seccompProfile:
    type: RuntimeDefault

# Replicas
replicaCount: 1

# Metrics
metrics:
  enabled: true
  port: 7979

# Service Monitor
serviceMonitor:
  enabled: true
  namespace: monitoring
  interval: 60s
  labels:
    release: prometheus
```

### 3.2 Instalacao via Helm

```bash
helm repo add external-dns https://kubernetes-sigs.github.io/external-dns/
helm repo update

helm install external-dns external-dns/external-dns \
  --namespace external-dns \
  --create-namespace \
  --values external-dns-values.yaml
```

---

## 4. Policy: sync vs upsert-only

### 4.1 Comparacao

| Policy      | Comportamento                      | Risco                                   |
| ----------- | ---------------------------------- | --------------------------------------- |
| upsert-only | Cria e atualiza, nunca deleta      | Baixo -- registros orfaos possiveis     |
| sync        | Cria, atualiza e deleta            | Medio -- pode deletar registros manuais |
| create-only | Apenas cria, nunca atualiza/deleta | Muito baixo -- nao atualiza             |

### 4.2 Recomendacao Velya

**Production**: `upsert-only` -- seguranca em primeiro lugar. Registros orfaos
sao limpos manualmente em manutencao programada.

**Staging/Dev**: `sync` -- automacao total, sem preocupacao com registros manuais.

### 4.3 TXT Ownership

O ExternalDNS usa registros TXT para rastrear quais registros ele gerencia:

```
app.velya.health              A       203.0.113.42
externaldns-app.velya.health  TXT     "heritage=external-dns,external-dns/owner=velya-platform"
```

Isso permite que o ExternalDNS identifique seus proprios registros e nao
interfira com registros criados manualmente.

---

## 5. Filtros

### 5.1 Filtro por Dominio

```yaml
domainFilters:
  - velya.health
```

O ExternalDNS so gerencia registros dentro de `velya.health`. Outros
dominios na mesma conta Route53 sao ignorados.

### 5.2 Filtro por Namespace

```yaml
# Processar apenas Ingresses de namespaces especificos
namespaceFilter:
  - velya-app
  - velya-auth
  - velya-system
  - monitoring
```

### 5.3 Filtro por Annotation

```yaml
annotationFilter: 'external-dns.alpha.kubernetes.io/managed=true'
```

Apenas recursos com esta annotation serao processados:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    external-dns.alpha.kubernetes.io/managed: 'true'
    external-dns.alpha.kubernetes.io/hostname: 'app.velya.health'
```

### 5.4 Filtro por Ingress Class

```yaml
# Processar apenas Ingresses com ingressClassName: nginx
ingressClassNames:
  - nginx
```

---

## 6. IAM Policy

### 6.1 Policy Minima para Route53

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ExternalDNSRoute53ListZones",
      "Effect": "Allow",
      "Action": [
        "route53:ListHostedZones",
        "route53:ListHostedZonesByName",
        "route53:ListResourceRecordSets"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ExternalDNSRoute53ChangeRecords",
      "Effect": "Allow",
      "Action": ["route53:ChangeResourceRecordSets"],
      "Resource": ["arn:aws:route53:::hostedzone/HOSTED_ZONE_ID"]
    },
    {
      "Sid": "ExternalDNSRoute53GetChange",
      "Effect": "Allow",
      "Action": ["route53:GetChange"],
      "Resource": "*"
    }
  ]
}
```

### 6.2 IAM Role Trust Policy

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
          "oidc.eks.REGION.amazonaws.com/id/CLUSTER_ID:sub": "system:serviceaccount:external-dns:external-dns",
          "oidc.eks.REGION.amazonaws.com/id/CLUSTER_ID:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
```

---

## 7. Annotations de Ingress

### 7.1 Annotations Suportadas

| Annotation                                | Descricao             | Exemplo           |
| ----------------------------------------- | --------------------- | ----------------- |
| external-dns.alpha.kubernetes.io/hostname | Hostname explicito    | app.velya.health  |
| external-dns.alpha.kubernetes.io/ttl      | TTL do registro       | "300"             |
| external-dns.alpha.kubernetes.io/target   | Target explicito      | "lb.velya.health" |
| external-dns.alpha.kubernetes.io/managed  | Flag de gerenciamento | "true"            |
| external-dns.alpha.kubernetes.io/alias    | Usar ALIAS record     | "true"            |

### 7.2 Exemplo Completo

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grafana-ingress
  namespace: monitoring
  annotations:
    external-dns.alpha.kubernetes.io/managed: 'true'
    external-dns.alpha.kubernetes.io/hostname: 'grafana.velya.health'
    external-dns.alpha.kubernetes.io/ttl: '300'
    cert-manager.io/cluster-issuer: 'acme-production'
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - grafana.velya.health
      secretName: grafana-velya-health-tls
  rules:
    - host: grafana.velya.health
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: grafana
                port:
                  number: 3000
```

---

## 8. Service do tipo LoadBalancer

O ExternalDNS tambem pode gerenciar DNS para Services do tipo LoadBalancer:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: velya-auth
  annotations:
    external-dns.alpha.kubernetes.io/hostname: 'auth.velya.health'
    external-dns.alpha.kubernetes.io/ttl: '300'
spec:
  type: LoadBalancer
  selector:
    app: keycloak
  ports:
    - port: 443
      targetPort: 8443
```

---

## 9. Troubleshooting

### 9.1 Comandos de Debug

```bash
# Verificar pods
kubectl get pods -n external-dns

# Verificar logs
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns -f

# Verificar registros no Route53
aws route53 list-resource-record-sets --hosted-zone-id HOSTED_ZONE_ID

# Verificar TXT ownership records
aws route53 list-resource-record-sets --hosted-zone-id HOSTED_ZONE_ID \
  --query "ResourceRecordSets[?Type=='TXT']"

# Verificar se ExternalDNS esta processando Ingresses
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns | \
  grep "velya.health"
```

### 9.2 Problemas Comuns

| Problema               | Causa                | Solucao              |
| ---------------------- | -------------------- | -------------------- |
| Registro nao criado    | Annotation ausente   | Adicionar annotation |
| Permissao negada       | IAM policy incorreta | Verificar policy     |
| Registro desatualizado | Intervalo de sync    | Esperar ou restart   |
| Conflito de registro   | TXT ownership        | Verificar txtOwnerId |
| DNS nao resolve        | Propagacao           | Esperar TTL          |

---

## 10. Monitoramento

### 10.1 Metricas

| Metrica                                     | Descricao             |
| ------------------------------------------- | --------------------- |
| external_dns_source_endpoints               | Endpoints detectados  |
| external_dns_registry_endpoints             | Endpoints no registry |
| external_dns_controller_last_sync_timestamp | Ultimo sync           |
| external_dns_source_errors_total            | Erros de fonte        |
| external_dns_registry_errors_total          | Erros de registry     |

### 10.2 Alertas

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: external-dns-alerts
  namespace: monitoring
spec:
  groups:
    - name: external-dns
      rules:
        - alert: ExternalDNSDown
          expr: up{job="external-dns"} == 0
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: 'ExternalDNS esta down'

        - alert: ExternalDNSSyncFailed
          expr: increase(external_dns_source_errors_total[5m]) > 0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: 'ExternalDNS encontrou erros de sincronizacao'

        - alert: ExternalDNSSyncStale
          expr: time() - external_dns_controller_last_sync_timestamp > 600
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: 'ExternalDNS nao sincroniza ha mais de 10 minutos'
```

---

## 11. Seguranca

### 11.1 Principio de Menor Privilegio

- IAM policy restrita a hosted zone especifica.
- Service Account dedicada com annotation IAM role.
- Namespace isolado para ExternalDNS.
- RBAC minimo: apenas leitura de Ingress/Service.

### 11.2 Auditoria

- AWS CloudTrail registra todas as chamadas Route53.
- Kubernetes audit logs registram acoes do ExternalDNS.
- Metricas Prometheus rastreiam sincronizacoes.

---

## 12. Multi-Ambiente

### 12.1 Configuracao por Ambiente

| Ambiente    | Domain Filter        | Hosted Zone  | Policy      |
| ----------- | -------------------- | ------------ | ----------- |
| Production  | velya.health         | Z0123PROD    | upsert-only |
| Staging     | staging.velya.health | Z0123STAGING | sync        |
| Development | dev.velya.health     | Z0123DEV     | sync        |

### 12.2 Isolamento

Cada ambiente tem:

- Instalacao ExternalDNS separada.
- IAM role separada.
- Hosted Zone separada (ou subzone delegada).
- txtOwnerId unico.

---

## 13. Checklist

- [ ] ExternalDNS instalado via Helm
- [ ] IAM policy criada e testada
- [ ] IAM role com trust policy correta
- [ ] Service Account com annotation IAM
- [ ] Domain filter configurado
- [ ] Policy definida (upsert-only para production)
- [ ] TXT ownership configurado
- [ ] Primeiro registro criado automaticamente
- [ ] DNS resolvendo corretamente
- [ ] Metricas coletando no Prometheus
- [ ] Alertas configurados
- [ ] CloudTrail habilitado para Route53

---

## 14. Changelog

| Data       | Versao | Descricao                                 |
| ---------- | ------ | ----------------------------------------- |
| 2026-04-09 | 1.0    | Versao inicial da arquitetura ExternalDNS |

---

_Documento mantido pelo Platform Team. Revisao trimestral obrigatoria._
