# Let's Encrypt: Staging vs Production

**Documento**: letsencrypt-staging-vs-production.md
**Versao**: 1.0
**Data**: 2026-04-09
**Status**: Aprovado

---

## 1. Introducao

O Let's Encrypt oferece dois ambientes ACME: Staging e Production. A escolha
correta entre eles e critica para evitar rate limits, validar configuracoes,
e garantir operacao confiavel da PKI publica da Velya Platform.

---

## 2. Diferencas Fundamentais

### 2.1 Tabela Comparativa

| Criterio | Staging | Production |
|---|---|---|
| URL ACME | acme-staging-v02.api.letsencrypt.org | acme-v02.api.letsencrypt.org |
| Confianca | NAO confiado por browsers | Confiado por todos os browsers |
| CA Root | Fake Root (staging) | ISRG Root X1 / X2 |
| Rate Limits | Muito mais permissivos | Restritivos |
| Certificados/dominio/semana | 30.000 | 50 |
| Duplicatas/semana | 30.000 | 5 |
| Failed validations/hora | 60 | 5 |
| Validade | 90 dias | 90 dias |
| Wildcard | Suporta | Suporta |
| DNS-01 | Suporta | Suporta |
| Certificate Transparency | Nao | Sim (obrigatorio) |

### 2.2 Implicacao Pratica

- **Staging**: use para tudo que nao e producao. Testes, CI, novos hosts,
  validacao de configuracao, debug de challenges.
- **Production**: use APENAS para hosts oficiais que precisam ser acessados
  por browsers e clientes reais.

---

## 3. Quando Usar Staging

### 3.1 Cenarios Obrigatorios

1. **Primeiro setup de cert-manager**: validar que DNS-01 funciona.
2. **Novo host/subdominio**: testar emissao antes de usar production.
3. **Mudanca de configuracao**: alterar ClusterIssuer, credenciais DNS, etc.
4. **CI/CD pipeline**: testes automatizados de emissao de certificado.
5. **Debug de challenge**: quando DNS-01 falha, debugar com staging.
6. **Treinamento**: equipe aprendendo cert-manager / ACME.
7. **Ambientes de desenvolvimento**: dev e preview environments.
8. **Testes de renovacao**: validar que renovacao automatica funciona.

### 3.2 Fluxo de Validacao

```
1. Configurar ClusterIssuer staging
2. Criar Certificate resource apontando para staging
3. Verificar emissao (kubectl get certificate)
4. Verificar challenge DNS-01 (kubectl get challenge)
5. Certificado emitido com sucesso?
   SIM -> Configurar ClusterIssuer production
   NAO -> Debug e corrigir
6. Atualizar Certificate para usar production
7. Verificar emissao com production
8. Certificado production emitido -> Deploy completo
```

---

## 4. Quando Usar Production

### 4.1 Criterios

- Host oficial que sera acessado por usuarios reais.
- DNS configurado e resolvendo publicamente.
- Staging ja testado e funcionando para este host.
- Host esta na lista aprovada de dominios (domain governance).

### 4.2 Hosts de Production da Velya

| Host | Certificado |
|---|---|
| velya.health | apex (dedicado, production) |
| *.velya.health | wildcard (production) |
| *.staging.velya.health | wildcard (staging issuer OK para staging env) |
| *.dev.velya.health | wildcard (staging issuer obrigatorio) |

---

## 5. Rate Limits de Production

### 5.1 Limites Criticos

| Limite | Valor | Periodo |
|---|---|---|
| Certificates per Registered Domain | 50 | 7 dias (rolling window) |
| Duplicate Certificate | 5 | 7 dias |
| Failed Validation | 5 | 1 hora |
| New Orders | 300 | 3 horas |
| Accounts per IP | 10 | 3 horas |
| Pending Authorizations | 300 | por account |

### 5.2 Como Evitar Rate Limits

1. **Usar staging para testes**: regra mais importante.
2. **Wildcard certificate**: um certificado cobre todos os subdominios.
3. **Nao deletar Secrets desnecessariamente**: cert-manager reutiliza.
4. **Nao recriar ClusterIssuer frequentemente**: cria novas accounts.
5. **Monitorar**: alertas quando se aproxima de limites.

### 5.3 O que Fazer se Atingir Rate Limit

1. **Esperar**: rate limits sao janelas rolantes de 7 dias.
2. **Verificar staging**: testar configuracao com staging enquanto espera.
3. **Consolidar certificados**: usar wildcard para reduzir emissoes.
4. **Nao panic-delete**: nao deletar Secrets/Certificates tentando "resetar".

---

## 6. ClusterIssuer YAML

### 6.1 Staging

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: acme-staging
  labels:
    app.kubernetes.io/part-of: velya-platform
    app.kubernetes.io/component: pki
    environment: staging
  annotations:
    description: "Let's Encrypt Staging - para testes e validacao"
spec:
  acme:
    # Servidor ACME Staging
    server: https://acme-staging-v02.api.letsencrypt.org/directory

    # Email para notificacoes de expiracao
    email: platform@velya.health

    # Secret para armazenar account key
    privateKeySecretRef:
      name: acme-staging-account-key

    # Solver DNS-01 via Route53
    solvers:
      - dns01:
          route53:
            region: us-east-1
            hostedZoneID: HOSTED_ZONE_ID
            # Para IRSA (IAM Roles for Service Accounts):
            # auth:
            #   kubernetes:
            #     serviceAccountRef:
            #       name: cert-manager
        selector:
          dnsZones:
            - "velya.health"
```

### 6.2 Production

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: acme-production
  labels:
    app.kubernetes.io/part-of: velya-platform
    app.kubernetes.io/component: pki
    environment: production
  annotations:
    description: "Let's Encrypt Production - certificados reais"
spec:
  acme:
    # Servidor ACME Production
    server: https://acme-v02.api.letsencrypt.org/directory

    # Email para notificacoes
    email: platform@velya.health

    # Secret para account key
    privateKeySecretRef:
      name: acme-production-account-key

    # Solver DNS-01 via Route53
    solvers:
      - dns01:
          route53:
            region: us-east-1
            hostedZoneID: HOSTED_ZONE_ID
        selector:
          dnsZones:
            - "velya.health"
```

---

## 7. Teste de Renovacao

### 7.1 Simular Renovacao com Staging

```bash
# 1. Criar certificado staging com duracao curta
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: renewal-test
  namespace: default
spec:
  secretName: renewal-test-tls
  issuerRef:
    name: acme-staging
    kind: ClusterIssuer
  dnsNames:
    - "renewal-test.velya.health"
  duration: 2h
  renewBefore: 1h
  privateKey:
    algorithm: ECDSA
    size: 256
EOF

# 2. Verificar emissao
kubectl get certificate renewal-test -n default -w

# 3. Esperar 1 hora (ou menos) e verificar renovacao
kubectl describe certificate renewal-test -n default

# 4. Verificar eventos
kubectl get events -n default --field-selector reason=Issuing

# 5. Limpar
kubectl delete certificate renewal-test -n default
```

### 7.2 Forcar Renovacao

```bash
# Deletar o Secret forca o cert-manager a re-emitir
kubectl delete secret velya-health-wildcard-tls -n velya-system

# Monitorar re-emissao
kubectl get certificate velya-health-wildcard -n velya-system -w
```

---

## 8. Migracao Staging -> Production

### 8.1 Processo

```
1. Certificado funcionando com staging ClusterIssuer
2. Verificar que host esta na lista aprovada
3. Alterar issuerRef de acme-staging para acme-production
4. Aplicar manifesto atualizado
5. cert-manager detecta mudanca e re-emite com production
6. Verificar certificado no browser (deve ser confiado)
7. Verificar CT logs (certificado aparece em crt.sh)
```

### 8.2 Exemplo

```yaml
# ANTES (staging)
spec:
  issuerRef:
    name: acme-staging
    kind: ClusterIssuer

# DEPOIS (production)
spec:
  issuerRef:
    name: acme-production
    kind: ClusterIssuer
```

---

## 9. Identificando Certificados Staging vs Production

### 9.1 Via kubectl

```bash
# Verificar issuer de todos os certificados
kubectl get certificates -A -o custom-columns=\
NAME:.metadata.name,\
NAMESPACE:.metadata.namespace,\
ISSUER:.spec.issuerRef.name,\
READY:.status.conditions[0].status

# Certificados usando staging (devem ser apenas dev/test)
kubectl get certificates -A -o json | \
  jq '.items[] | select(.spec.issuerRef.name == "acme-staging") | .metadata.name'
```

### 9.2 Via OpenSSL

```bash
# Inspecionar certificado de um endpoint
echo | openssl s_client -connect app.velya.health:443 2>/dev/null | \
  openssl x509 -text -noout | grep -i issuer

# Production: Issuer contem "Let's Encrypt" ou "R3" ou "R10"
# Staging: Issuer contem "(STAGING)" ou "Fake"
```

### 9.3 Via Browser

- **Production**: cadeado verde, nenhum aviso.
- **Staging**: aviso de certificado nao confiavel, cadeado vermelho.

---

## 10. Alertas para Staging em Production

Nenhum host de producao deve usar staging issuer. Implementar alerta:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: staging-in-production-alert
  namespace: monitoring
spec:
  groups:
    - name: pki-governance
      rules:
        - alert: StagingCertInProduction
          expr: |
            certmanager_certificate_ready_status{
              issuer_name="acme-staging",
              exported_namespace=~"velya-.*|monitoring|ingress-.*"
            } == 1
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "Certificado staging em namespace de producao"
            description: "O certificado {{ $labels.name }} no namespace {{ $labels.exported_namespace }} esta usando o issuer staging."
```

---

## 11. Decision Matrix

```
Preciso de certificado TLS?
  |
  +-- E para producao (usuarios reais)?
  |     |
  |     +-- SIM -> Staging funcionou primeiro?
  |     |          |
  |     |          +-- SIM -> Use acme-production
  |     |          +-- NAO -> Teste com staging primeiro!
  |     |
  |     +-- NAO -> Use acme-staging (sempre)
  |
  +-- E para comunicacao interna (service-to-service)?
        |
        +-- Use internal-ca (step-ca), nao Let's Encrypt
```

---

## 12. Checklist

- [ ] ClusterIssuer staging criado e funcionando
- [ ] ClusterIssuer production criado
- [ ] Teste de emissao staging realizado
- [ ] Teste de renovacao staging realizado
- [ ] Primeiro certificado production emitido
- [ ] Alerta de staging-em-production configurado
- [ ] Equipe treinada em staging vs production
- [ ] Documentacao de rate limits compartilhada
- [ ] Processo de migracao staging->production definido

---

## 13. Changelog

| Data | Versao | Descricao |
|---|---|---|
| 2026-04-09 | 1.0 | Versao inicial do guia staging vs production |

---

*Documento mantido pelo Platform Team. Revisao trimestral obrigatoria.*
