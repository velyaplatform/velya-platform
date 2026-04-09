# Runbooks: Ciclo de Vida de Certificados

**Documento**: certificate-lifecycle-runbooks.md
**Versao**: 1.0
**Data**: 2026-04-09
**Status**: Aprovado

---

## 1. Introducao

Este documento contem runbooks operacionais para todos os cenarios de ciclo
de vida de certificados na Velya Platform. Cada runbook segue o formato:
Sintomas, Diagnostico, Passos de Resolucao, Verificacao.

---

## 2. Runbook 01: Renovacao Normal

### 2.1 Descricao

Renovacao automatica padrao de certificado publico Let's Encrypt.

### 2.2 Sintomas

- Certificado com menos de 30 dias de validade.
- cert-manager inicia processo de renovacao automaticamente.
- Nenhum alerta disparado (processo normal).

### 2.3 Diagnostico

```bash
# Verificar quando o certificado expira
kubectl get certificate -A -o custom-columns=\
NAME:.metadata.name,\
NAMESPACE:.metadata.namespace,\
EXPIRY:.status.notAfter,\
RENEWAL:.status.renewalTime,\
READY:.status.conditions[0].status

# Verificar eventos de renovacao
kubectl get events -A --field-selector reason=Issuing
```

### 2.4 Passos

Nenhuma acao necessaria. A renovacao e totalmente automatica.

### 2.5 Verificacao

```bash
# Apos renovacao, verificar novo certificado
kubectl describe certificate <name> -n <namespace>

# Verificar que o Secret foi atualizado
kubectl get secret <name>-tls -n <namespace> -o jsonpath='{.metadata.annotations}'

# Verificar expiracao do novo certificado
kubectl get secret <name>-tls -n <namespace> -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -enddate
```

---

## 3. Runbook 02: Renovacao Falhou

### 3.1 Descricao

O cert-manager tentou renovar um certificado mas o processo falhou.

### 3.2 Sintomas

- Alerta `CertRenewalFailed` disparado.
- Certificate resource mostra status `False` na condition `Ready`.
- Eventos de erro no namespace do certificado.

### 3.3 Diagnostico

```bash
# 1. Verificar status do certificado
kubectl describe certificate <name> -n <namespace>

# 2. Verificar CertificateRequest
kubectl get certificaterequest -n <namespace>
kubectl describe certificaterequest <latest-cr> -n <namespace>

# 3. Verificar Order
kubectl get order -n <namespace>
kubectl describe order <name> -n <namespace>

# 4. Verificar Challenge
kubectl get challenge -n <namespace>
kubectl describe challenge <name> -n <namespace>

# 5. Verificar logs do cert-manager
kubectl logs -n cert-manager deploy/cert-manager --tail=100 | grep -i error

# 6. Verificar credenciais DNS
kubectl get secret -n cert-manager | grep route53
```

### 3.4 Passos de Resolucao

**Caso 1: Credenciais DNS expiradas**
```bash
# Verificar se credenciais estao validas
kubectl get secret route53-credentials -n cert-manager -o yaml

# Atualizar credenciais se necessario
kubectl create secret generic route53-credentials \
  -n cert-manager \
  --from-literal=access-key-id=<NEW_KEY> \
  --from-literal=secret-access-key=<NEW_SECRET> \
  --dry-run=client -o yaml | kubectl apply -f -
```

**Caso 2: DNS nao propagou**
```bash
# Verificar registro TXT
dig TXT _acme-challenge.velya.health @8.8.8.8

# Esperar propagacao (pode levar ate 60s)
# cert-manager retentara automaticamente
```

**Caso 3: Rate limit atingido**
```bash
# Verificar logs para mensagem de rate limit
kubectl logs -n cert-manager deploy/cert-manager | grep -i "rate limit"

# Se rate limit, esperar janela de 7 dias
# Enquanto isso, certificado existente ainda e valido
```

**Caso 4: ClusterIssuer com problema**
```bash
# Verificar status do ClusterIssuer
kubectl describe clusterissuer acme-production

# Se account key corrompida, deletar e recriar
kubectl delete secret acme-production-account-key -n cert-manager
# cert-manager recriara automaticamente
```

### 3.5 Verificacao

```bash
# Forcar renovacao deletando o CertificateRequest com falha
kubectl delete certificaterequest <failed-cr> -n <namespace>

# Monitorar nova tentativa
kubectl get certificate <name> -n <namespace> -w

# Verificar sucesso
kubectl describe certificate <name> -n <namespace>
```

---

## 4. Runbook 03: Challenge DNS Falhou

### 4.1 Sintomas

- Challenge preso em estado `pending` ou `failed`.
- Registro TXT `_acme-challenge` nao criado no Route53.
- Let's Encrypt nao consegue validar dominio.

### 4.2 Diagnostico

```bash
# Verificar challenges ativos
kubectl get challenge -A
kubectl describe challenge <name> -n <namespace>

# Verificar se registro TXT existe
dig TXT _acme-challenge.velya.health @8.8.8.8

# Verificar logs do cert-manager para erros Route53
kubectl logs -n cert-manager deploy/cert-manager | grep -i route53

# Verificar IAM permissions
kubectl logs -n cert-manager deploy/cert-manager | grep -i "access denied\|forbidden\|unauthorized"
```

### 4.3 Passos de Resolucao

```bash
# 1. Verificar Hosted Zone ID no ClusterIssuer
kubectl get clusterissuer acme-production -o yaml | grep hostedZoneID

# 2. Verificar se Hosted Zone existe no Route53
aws route53 get-hosted-zone --id HOSTED_ZONE_ID

# 3. Testar criacao manual de registro TXT
aws route53 change-resource-record-sets \
  --hosted-zone-id HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "_acme-challenge-test.velya.health",
        "Type": "TXT",
        "TTL": 60,
        "ResourceRecords": [{"Value": "\"test\""}]
      }
    }]
  }'

# 4. Se teste manual funciona, problema e no cert-manager
# 5. Se teste manual falha, problema e de IAM/permissao

# 6. Limpar registro de teste
aws route53 change-resource-record-sets \
  --hosted-zone-id HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "DELETE",
      "ResourceRecordSet": {
        "Name": "_acme-challenge-test.velya.health",
        "Type": "TXT",
        "TTL": 60,
        "ResourceRecords": [{"Value": "\"test\""}]
      }
    }]
  }'
```

### 4.4 Verificacao

```bash
# Deletar challenge com falha para forcar retry
kubectl delete challenge <name> -n <namespace>

# Monitorar novo challenge
kubectl get challenge -A -w

# Verificar que certificado foi emitido
kubectl get certificate <name> -n <namespace>
```

---

## 5. Runbook 04: DNS Provider Down

### 5.1 Sintomas

- Route53 indisponivel ou lento.
- Challenges DNS-01 falham.
- ExternalDNS nao consegue sincronizar.

### 5.2 Diagnostico

```bash
# Verificar status do Route53
aws route53 get-hosted-zone --id HOSTED_ZONE_ID

# Verificar AWS Health Dashboard
# https://health.aws.amazon.com/

# Verificar latencia de API
time aws route53 list-resource-record-sets --hosted-zone-id HOSTED_ZONE_ID --max-items 1
```

### 5.3 Passos de Resolucao

1. **Certificados existentes continuam validos** ate expiracao.
2. Apenas renovacoes e novas emissoes sao afetadas.
3. Verificar se a indisponibilidade e regional ou global.
4. Se prolongada (> 1 hora), considerar fallback manual com certificados
   existentes.
5. Monitorar AWS Status Dashboard para ETA de resolucao.
6. Apos Route53 voltar, cert-manager retentara automaticamente.

### 5.4 Verificacao

```bash
# Verificar que Route53 esta respondendo
aws route53 list-hosted-zones

# Verificar que challenges pendentes sao processados
kubectl get challenge -A

# Verificar renovacoes pendentes
kubectl get certificate -A | grep -v True
```

---

## 6. Runbook 05: cert-manager Down

### 6.1 Sintomas

- Pods do cert-manager em CrashLoopBackOff ou nao existem.
- Nenhum certificado sendo emitido ou renovado.
- Alerta `CertManagerDown` disparado.

### 6.2 Diagnostico

```bash
# Verificar pods
kubectl get pods -n cert-manager

# Verificar eventos
kubectl get events -n cert-manager --sort-by='.lastTimestamp'

# Verificar logs
kubectl logs -n cert-manager deploy/cert-manager --previous

# Verificar recursos (OOM?)
kubectl top pods -n cert-manager

# Verificar Helm release
helm list -n cert-manager
```

### 6.3 Passos de Resolucao

**Caso 1: Pod crashando**
```bash
# Verificar logs do crash
kubectl logs -n cert-manager deploy/cert-manager --previous

# Restart do deployment
kubectl rollout restart deployment/cert-manager -n cert-manager

# Monitorar
kubectl get pods -n cert-manager -w
```

**Caso 2: OOM (Out of Memory)**
```bash
# Aumentar limites de memoria
helm upgrade cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --set resources.limits.memory=512Mi \
  --reuse-values
```

**Caso 3: CRDs corrompidos**
```bash
# Verificar CRDs
kubectl get crd | grep cert-manager

# Re-instalar CRDs se necessario
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.crds.yaml
```

**Caso 4: Webhook com problema**
```bash
# Verificar webhook
kubectl get pods -n cert-manager -l app.kubernetes.io/component=webhook

# Restart webhook
kubectl rollout restart deployment/cert-manager-webhook -n cert-manager
```

### 6.4 Verificacao

```bash
# Verificar todos os componentes
kubectl get pods -n cert-manager

# Verificar que certificados estao sendo processados
kubectl get certificate -A | head -10

# Teste rapido com self-signed
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: health-check
  namespace: default
spec:
  secretName: health-check-tls
  issuerRef:
    name: selfsigned-bootstrap
    kind: ClusterIssuer
  dnsNames:
    - health.check
  duration: 1h
EOF

kubectl get certificate health-check -w
kubectl delete certificate health-check
```

---

## 7. Runbook 06: Secret Corrompido

### 7.1 Sintomas

- Ingress Controller reporta erro de TLS.
- Secret existe mas conteudo invalido.
- Navegador mostra erro de certificado inesperado.

### 7.2 Diagnostico

```bash
# Verificar Secret
kubectl get secret <name>-tls -n <namespace> -o yaml

# Verificar se certificado e valido
kubectl get secret <name>-tls -n <namespace> -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -text -noout

# Verificar se chave privada e valida
kubectl get secret <name>-tls -n <namespace> -o jsonpath='{.data.tls\.key}' | \
  base64 -d | openssl ec -check 2>&1

# Verificar se cert e key combinam
CERT_MOD=$(kubectl get secret <name>-tls -n <namespace> -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -modulus 2>/dev/null | md5sum)
KEY_MOD=$(kubectl get secret <name>-tls -n <namespace> -o jsonpath='{.data.tls\.key}' | \
  base64 -d | openssl rsa -noout -modulus 2>/dev/null | md5sum)
echo "Cert: $CERT_MOD"
echo "Key:  $KEY_MOD"
# Devem ser iguais
```

### 7.3 Passos de Resolucao

```bash
# Deletar Secret corrompido (cert-manager recriara)
kubectl delete secret <name>-tls -n <namespace>

# cert-manager detecta Secret ausente e re-emite certificado
# Monitorar
kubectl get certificate <name> -n <namespace> -w

# Se certificado nao reemitido em 5 minutos, forcar
kubectl delete certificaterequest -n <namespace> -l cert-manager.io/certificate-name=<name>
```

### 7.4 Verificacao

```bash
# Verificar novo Secret
kubectl get secret <name>-tls -n <namespace>

# Verificar certificado
kubectl get secret <name>-tls -n <namespace> -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -subject -enddate

# Testar endpoint
curl -v https://<host> 2>&1 | grep -i "ssl\|tls\|certificate"
```

---

## 8. Runbook 07: Cluster Restore

### 8.1 Descricao

Apos restauracao de cluster de backup ou recriacao completa.

### 8.2 Passos

```bash
# 1. Verificar cert-manager instalado
kubectl get pods -n cert-manager

# 2. Se nao instalado, instalar via Helm
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true \
  --values cert-manager-values.yaml

# 3. Aplicar ClusterIssuers
kubectl apply -f infra/kubernetes/bootstrap/cert-manager-issuers.yaml

# 4. Verificar ClusterIssuers
kubectl get clusterissuer

# 5. Aplicar Certificate resources
kubectl apply -f infra/kubernetes/bootstrap/certificate-resources.yaml

# 6. Monitorar emissao
kubectl get certificate -A -w

# 7. Todos os certificados serao re-emitidos automaticamente
# Let's Encrypt nao se importa que sao re-emissoes (dentro do rate limit)
```

### 8.3 Verificacao

```bash
# Todos os certificados Ready
kubectl get certificate -A | grep -v True
# Deve retornar vazio (todos True)

# Testar endpoints
for host in app api auth grafana; do
  curl -s -o /dev/null -w "%{http_code} %{ssl_verify_result} $host.velya.health\n" \
    https://$host.velya.health
done
```

---

## 9. Runbook 08: CA Interna Down

### 9.1 Sintomas

- step-ca pod nao esta running.
- Certificados internos nao sao renovados.
- mTLS entre servicos falha apos expiracao (24h).

### 9.2 Diagnostico

```bash
# Verificar step-ca
kubectl get pods -n step-ca
kubectl describe pod -n step-ca -l app=step-ca
kubectl logs -n step-ca -l app=step-ca --previous

# Verificar PV
kubectl get pvc -n step-ca
kubectl describe pvc -n step-ca
```

### 9.3 Passos de Resolucao

```bash
# 1. Restart do step-ca
kubectl rollout restart deployment/step-ca -n step-ca

# 2. Se PV com problema
kubectl get pv | grep step-ca

# 3. Se step-ca nao volta, reinstalar
helm upgrade --install step-ca smallstep/step-ca \
  --namespace step-ca \
  --values step-ca-values.yaml

# 4. Se certificados internos ja expiraram
# Servicos precisam ser reiniciados para obter novos certificados
kubectl rollout restart deployment -n velya-app
```

### 9.4 Verificacao

```bash
# step-ca respondendo
kubectl get pods -n step-ca

# Certificados internos renovando
kubectl get certificate -A -l velya.health/cert-type=internal

# mTLS funcionando
kubectl exec -n velya-app deploy/service-a -- \
  curl -v --cacert /etc/tls/ca/ca.crt \
  --cert /etc/tls/tls.crt --key /etc/tls/tls.key \
  https://service-b.velya-app.svc.cluster.local:8443/health
```

---

## 10. Runbook 09: Rate Limit Atingido

### 10.1 Sintomas

- Novos certificados nao sao emitidos.
- Logs mostram mensagem de rate limit do Let's Encrypt.
- Certificados existentes continuam validos.

### 10.2 Diagnostico

```bash
# Verificar logs para rate limit
kubectl logs -n cert-manager deploy/cert-manager | grep -i "rate limit\|too many"

# Verificar quantos certificados foram emitidos recentemente
kubectl get certificate -A -o custom-columns=\
NAME:.metadata.name,\
CREATED:.metadata.creationTimestamp | sort -k2
```

### 10.3 Passos de Resolucao

1. **NAO deletar certificados tentando "resetar"** -- isso piora a situacao.
2. Identificar causa da emissao excessiva (loop de criacao/delecao?).
3. Corrigir causa raiz.
4. Esperar janela de rate limit (7 dias rolling).
5. Usar staging para quaisquer testes enquanto espera.
6. Considerar consolidar em wildcard se muitos certificados individuais.

### 10.4 Verificacao

```bash
# Apos janela de rate limit
# Testar com staging primeiro
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: rate-limit-test
  namespace: default
spec:
  secretName: rate-limit-test-tls
  issuerRef:
    name: acme-staging
    kind: ClusterIssuer
  dnsNames:
    - rate-limit-test.velya.health
  duration: 1h
EOF

kubectl get certificate rate-limit-test -w
kubectl delete certificate rate-limit-test
```

---

## 11. Matriz de Escalonamento

| Situacao | Urgencia | Acao | Responsavel |
|---|---|---|---|
| Renovacao normal | Baixa | Nenhuma | Automatico |
| Renovacao falhou (> 14 dias para expiracao) | Media | Investigar | SRE |
| Renovacao falhou (< 14 dias para expiracao) | Alta | Resolver imediatamente | SRE + Platform |
| Renovacao falhou (< 7 dias para expiracao) | Critica | Incidente P1 | SRE + Platform + Mgmt |
| cert-manager down | Alta | Restaurar | SRE |
| CA interna down | Alta | Restaurar em 8h (antes da expiracao de certs 24h) | SRE |
| Todos os certs expirados | Critica | Incidente P1 | All hands |
| Rate limit atingido | Media | Esperar + prevenir | Platform |

---

## 12. Changelog

| Data | Versao | Descricao |
|---|---|---|
| 2026-04-09 | 1.0 | Versao inicial dos runbooks |

---

*Documento mantido pelo SRE Team. Revisao trimestral obrigatoria.*
