# CAA Records e Hardening de Dominio

**Documento**: caa-and-domain-hardening.md
**Versao**: 1.0
**Data**: 2026-04-09
**Status**: Aprovado

---

## 1. Introducao

Este documento define a politica de hardening do dominio velya.health,
incluindo CAA (Certificate Authority Authorization) records, DNSSEC,
domain lock, e outras medidas de protecao que restringem quais CAs podem
emitir certificados para o dominio e protegem contra ataques de DNS.

---

## 2. CAA Records

### 2.1 O que e CAA?

CAA (Certificate Authority Authorization) e um tipo de registro DNS (RFC 8659)
que especifica quais Autoridades Certificadoras (CAs) estao autorizadas a
emitir certificados para um dominio. CAs sao obrigadas a verificar CAA records
antes de emitir certificados.

### 2.2 Beneficios

| Beneficio | Descricao |
|---|---|
| Restricao de CA | Apenas CAs autorizadas podem emitir certificados |
| Prevencao de fraude | Impede emissao nao autorizada de certificados |
| Deteccao | Notificacao quando emissao e negada |
| Compliance | Demonstra controle sobre emissao de certificados |
| Custo zero | Nenhum custo adicional, apenas configuracao DNS |

### 2.3 Formato

```
dominio. IN CAA <flags> <tag> "<value>"
```

- **flags**: 0 (nao-critico) ou 128 (critico)
- **tag**: `issue`, `issuewild`, ou `iodef`
- **value**: dominio da CA autorizada ou email para notificacao

### 2.4 Tags

| Tag | Descricao |
|---|---|
| issue | CA autorizada a emitir certificados nao-wildcard |
| issuewild | CA autorizada a emitir certificados wildcard |
| iodef | Email/URL para notificacao de tentativas negadas |

---

## 3. Configuracao CAA para Velya

### 3.1 Records Recomendados

```dns
; Apenas Let's Encrypt pode emitir certificados
velya.health.  IN CAA 0 issue "letsencrypt.org"

; Apenas Let's Encrypt pode emitir wildcards
velya.health.  IN CAA 0 issuewild "letsencrypt.org"

; Notificacao de tentativas negadas
velya.health.  IN CAA 0 iodef "mailto:security@velya.health"

; Bloquear todas as outras CAs implicitamente
; (a presenca de qualquer record CAA nega CAs nao listadas)
```

### 3.2 Route53 -- Exemplo de CAA Record

```json
{
  "Comment": "CAA records para velya.health - restringir a Let's Encrypt",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "velya.health.",
        "Type": "CAA",
        "TTL": 3600,
        "ResourceRecords": [
          {
            "Value": "0 issue \"letsencrypt.org\""
          },
          {
            "Value": "0 issuewild \"letsencrypt.org\""
          },
          {
            "Value": "0 iodef \"mailto:security@velya.health\""
          }
        ]
      }
    }
  ]
}
```

### 3.3 Aplicar via AWS CLI

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id HOSTED_ZONE_ID \
  --change-batch file://caa-records.json
```

### 3.4 Verificacao

```bash
# Verificar CAA records
dig CAA velya.health

# Resultado esperado:
# velya.health. 3600 IN CAA 0 issue "letsencrypt.org"
# velya.health. 3600 IN CAA 0 issuewild "letsencrypt.org"
# velya.health. 3600 IN CAA 0 iodef "mailto:security@velya.health"

# Verificar via ferramentas online
# https://caatest.co.uk/velya.health
# https://dnslookup.online/caa.html
```

---

## 4. Heranca de CAA

### 4.1 Como Funciona

CAA records sao herdados por subdominios. Se `velya.health` tem CAA records,
todos os subdominios (app.velya.health, api.velya.health, etc.) herdam
a mesma politica, a menos que tenham seus proprios CAA records.

```
velya.health           CAA 0 issue "letsencrypt.org"
  |
  +-- app.velya.health     (herda: apenas letsencrypt.org)
  +-- api.velya.health     (herda: apenas letsencrypt.org)
  +-- auth.velya.health    (herda: apenas letsencrypt.org)
  +-- staging.velya.health (herda: apenas letsencrypt.org)
       |
       +-- app.staging.velya.health  (herda: apenas letsencrypt.org)
```

### 4.2 Override por Subdominio

Se necessario, um subdominio pode ter CAA records proprios:

```dns
; Exemplo: staging permite certificados de outra CA para testes
staging.velya.health. IN CAA 0 issue "letsencrypt.org"
staging.velya.health. IN CAA 0 issue "pebble.local"  ; CA de teste
```

**Recomendacao**: NAO usar overrides. Manter uma unica politica CAA no apex.

---

## 5. DNSSEC

### 5.1 O que e DNSSEC?

DNSSEC (Domain Name System Security Extensions) adiciona assinaturas
criptograficas aos registros DNS, permitindo verificacao de autenticidade
e integridade das respostas DNS.

### 5.2 Protecoes

| Ataque | Sem DNSSEC | Com DNSSEC |
|---|---|---|
| DNS Spoofing | Vulneravel | Protegido |
| DNS Cache Poisoning | Vulneravel | Protegido |
| Man-in-the-Middle DNS | Vulneravel | Protegido |
| DNS Redirect | Vulneravel | Protegido |

### 5.3 Configuracao no Route53

```bash
# 1. Habilitar DNSSEC signing na hosted zone
aws route53 enable-hosted-zone-dnssec \
  --hosted-zone-id HOSTED_ZONE_ID

# 2. Criar KMS key para DNSSEC
aws kms create-key \
  --customer-master-key-spec ECC_NIST_P256 \
  --key-usage SIGN_VERIFY \
  --description "DNSSEC signing key for velya.health" \
  --region us-east-1

# 3. Criar Key Signing Key (KSK)
aws route53 create-key-signing-key \
  --hosted-zone-id HOSTED_ZONE_ID \
  --name velya-health-ksk \
  --key-management-service-arn arn:aws:kms:us-east-1:ACCOUNT:key/KEY_ID \
  --status ACTIVE

# 4. Ativar DNSSEC signing
aws route53 enable-hosted-zone-dnssec \
  --hosted-zone-id HOSTED_ZONE_ID

# 5. Obter DS record para registrar no registrar do dominio
aws route53 get-dnssec \
  --hosted-zone-id HOSTED_ZONE_ID
```

### 5.4 Consideracoes

- **Route53 suporta DNSSEC** para hosted zones publicas.
- **Custo**: KMS key tem custo mensal (~$1/mes).
- **Risco**: configuracao incorreta pode tornar dominio irresolvivel.
- **Rollback**: desabilitar DNSSEC se problemas de resolucao.
- **TTL**: DS records no registrar podem levar horas para propagar.

---

## 6. Domain Lock

### 6.1 Transfer Lock

O transfer lock impede transferencia nao autorizada do dominio para outro
registrar.

```
Configuracao no registrar:
1. Acessar painel de gerenciamento do dominio
2. Habilitar "Transfer Lock" ou "Domain Lock"
3. Verificar status: "clientTransferProhibited"
```

### 6.2 Verificacao

```bash
# Verificar status do dominio via WHOIS
whois velya.health | grep -i "status\|lock"

# Resultado esperado:
# Domain Status: clientTransferProhibited
```

### 6.3 Registry Lock (Premium)

Para protecao maxima, alguns registrars oferecem Registry Lock:

- Requer verificacao humana (telefone/email) para qualquer mudanca.
- Protege contra comprometimento de conta do registrar.
- Custo adicional (variavel por registrar).

---

## 7. Protecao de Email (SPF, DKIM, DMARC)

### 7.1 SPF

Se o dominio nao envia emails:

```dns
velya.health. IN TXT "v=spf1 -all"
```

Se o dominio envia emails (ex: notificacoes):

```dns
velya.health. IN TXT "v=spf1 include:_spf.google.com include:amazonses.com -all"
```

### 7.2 DMARC

```dns
_dmarc.velya.health. IN TXT "v=DMARC1; p=reject; rua=mailto:dmarc@velya.health; ruf=mailto:dmarc-forensic@velya.health; fo=1"
```

### 7.3 DKIM

Configuracao depende do provedor de email. Exemplo para Google Workspace:

```dns
google._domainkey.velya.health. IN TXT "v=DKIM1; k=rsa; p=<public_key>"
```

### 7.4 MTA-STS

```dns
_mta-sts.velya.health. IN TXT "v=STSv1; id=202604091"
```

---

## 8. Monitoramento de Dominio

### 8.1 Certificate Transparency Monitoring

Monitorar logs de Certificate Transparency para detectar emissao de
certificados nao autorizados:

```bash
# Verificar certificados emitidos via crt.sh
curl -s "https://crt.sh/?q=velya.health&output=json" | \
  jq '.[0:10] | .[] | {issuer_name, not_before, not_after, common_name}'
```

### 8.2 Ferramentas de Monitoramento

| Ferramenta | Proposito | URL |
|---|---|---|
| crt.sh | CT log search | https://crt.sh |
| SSLMate Certspotter | CT monitoring + alertas | https://sslmate.com/certspotter |
| Facebook CT Monitor | CT monitoring | https://developers.facebook.com/tools/ct |
| Hardenize | Domain security assessment | https://www.hardenize.com |

### 8.3 Alerta de CT

Configurar webhook ou email para ser notificado quando um novo certificado
e emitido para velya.health em qualquer CA. Isso permite detectar:

- Emissao nao autorizada (CA comprometida ou phishing).
- Erros de configuracao (certificados emitidos acidentalmente).
- Shadow IT (alguem usando o dominio sem autorizacao).

---

## 9. DNS Security Checklist

### 9.1 Checklist Completa

| Item | Status | Prioridade |
|---|---|---|
| CAA records configurados | - | Alta |
| CAA restringe apenas Let's Encrypt | - | Alta |
| CAA iodef configurado | - | Media |
| DNSSEC habilitado | - | Media |
| Domain transfer lock habilitado | - | Alta |
| WHOIS privacy habilitado | - | Media |
| Auto-renew habilitado | - | Alta |
| MFA no registrar | - | Alta |
| SPF record configurado | - | Media |
| DMARC record configurado | - | Media |
| CT monitoring habilitado | - | Media |
| DNS audit trail (CloudTrail) | - | Alta |
| Acesso ao registrar restrito | - | Alta |
| NS records protegidos | - | Alta |

---

## 10. Hardening Adicional

### 10.1 Nameservers

- Usar nameservers do Route53 (gerenciados, com alta disponibilidade).
- Verificar que NS records no registrar apontam para Route53.
- NAO usar nameservers de terceiros nao confiados.

### 10.2 TTL dos Records Criticos

| Record | TTL Recomendado | Justificativa |
|---|---|---|
| NS | 86400 (24h) | Estabilidade |
| SOA | 86400 (24h) | Estabilidade |
| CAA | 3600 (1h) | Balanco entre cache e atualizacao |
| A/CNAME de servicos | 300 (5min) | Flexibilidade de failover |
| MX | 3600 (1h) | Estabilidade de email |
| TXT (SPF/DKIM) | 3600 (1h) | Estabilidade |

### 10.3 Resposta a Incidentes de DNS

Em caso de comprometimento de DNS:

1. **Verificar** quais records foram alterados.
2. **Restaurar** records corretos.
3. **Habilitar** transfer lock se nao estava ativo.
4. **Rotacionar** credenciais de acesso ao DNS.
5. **Verificar** CT logs para certificados emitidos durante o incidente.
6. **Revogar** certificados emitidos de forma nao autorizada.
7. **Notificar** equipe de seguranca e stakeholders.

---

## 11. Teste de Seguranca

### 11.1 Ferramentas de Teste

```bash
# Teste de CAA
dig CAA velya.health +short

# Teste de DNSSEC
dig velya.health +dnssec +short

# Teste completo de DNS security
# https://www.hardenize.com/report/velya.health
# https://dnsviz.net/d/velya.health/dnssec/

# Teste de TLS/SSL
# https://www.ssllabs.com/ssltest/analyze.html?d=velya.health
# https://observatory.mozilla.org/analyze/velya.health
```

### 11.2 Criterios de Aprovacao

| Teste | Resultado Minimo |
|---|---|
| SSL Labs | A+ |
| Mozilla Observatory | A+ |
| Hardenize | Verde em todos os items |
| DNSSEC Validation | Pass |
| CAA Check | Only letsencrypt.org |

---

## 12. Compliance

### 12.1 Regulamentacoes

| Regulamentacao | Requisito de DNS/TLS |
|---|---|
| LGPD | Encriptacao de dados em transito (TLS obrigatorio) |
| HIPAA | Encriptacao forte para dados de saude |
| SOC 2 | Controle de acesso, encriptacao, monitoramento |
| ISO 27001 | Gestao de certificados e chaves |

### 12.2 Evidencias

CAA records, DNSSEC, e TLS configuration servem como evidencia de controle
para auditorias de compliance. Manter registros de:

- Data de implementacao de cada controle.
- Revisoes periodicas.
- Testes de seguranca realizados.
- Incidentes e resolucoes.

---

## 13. Changelog

| Data | Versao | Descricao |
|---|---|---|
| 2026-04-09 | 1.0 | Versao inicial do documento de CAA e hardening |

---

*Documento mantido pelo Security Team e Platform Team. Revisao trimestral obrigatoria.*
