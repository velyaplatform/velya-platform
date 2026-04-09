# Estrategia PKI Velya Platform -- Visao Geral

**Documento**: pki-strategy-overview.md
**Versao**: 1.0
**Data**: 2026-04-09
**Status**: Aprovado

---

## 1. Introducao

A Velya Platform adota uma estrategia de PKI (Public Key Infrastructure) dual que
separa de forma clara e intencional dois dominios de confianca:

1. **PKI Publica** -- certificados TLS emitidos pelo Let's Encrypt via cert-manager
   para todos os endpoints expostos na internet.
2. **PKI Privada** -- certificados internos emitidos pelo step-ca para comunicacao
   mTLS entre servicos dentro do cluster Kubernetes.

Esta separacao nao e arbitraria. Ela reflete principios fundamentais de seguranca:

- Certificados publicos sao auditaveis, reconhecidos por browsers e clientes
  externos, e seguem padroes da industria (CA/Browser Forum).
- Certificados internos sao efemeros, de curta duracao, e controlados
  exclusivamente pela organizacao.

---

## 2. Principios Fundamentais

### 2.1 Zero Certificado Manual

Nenhum certificado sera gerado, copiado, ou instalado manualmente. Todo o ciclo
de vida -- emissao, renovacao, revogacao -- e automatizado via cert-manager e
step-ca.

**Justificativa**: Certificados manuais sao a causa numero um de incidentes de
TLS em producao. Humanos esquecem de renovar. Humanos cometem erros ao copiar
chaves privadas. A automacao elimina essas classes inteiras de falha.

### 2.2 Dominio Proprio Obrigatorio

A Velya Platform opera exclusivamente sob dominio proprio (velya.health ou
dominio configurado). Nenhum servico sera exposto sob dominios temporarios,
IPs publicos diretos, ou dominios de terceiros nao controlados.

### 2.3 Renovacao Automatica

- **Certificados publicos**: renovacao 30 dias antes do vencimento (certificados
  Let's Encrypt tem validade de 90 dias).
- **Certificados internos**: renovacao continua com certificados de 24 horas
  e renovacao a cada 16 horas.

### 2.4 Separacao de Trust Domains

O trust store publico e o trust store interno sao completamente independentes.
Um comprometimento da CA interna nao afeta a confianca publica. Um problema
com o Let's Encrypt nao impacta a comunicacao interna entre servicos.

---

## 3. Arquitetura de Alto Nivel

```
                    INTERNET
                       |
                       v
              +------------------+
              |   DNS (Route53)  |
              |   velya.health   |
              +--------+---------+
                       |
                       v
              +------------------+
              |  Ingress (NGINX) |
              |  TLS Termination |
              |  (Let's Encrypt) |
              +--------+---------+
                       |
          +------------+------------+
          |            |            |
          v            v            v
    +-----------+ +-----------+ +-----------+
    |  app.     | |  api.     | |  auth.    |
    |  velya.   | |  velya.   | |  velya.   |
    |  health   | |  health   | |  health   |
    +-----------+ +-----------+ +-----------+
          |            |            |
          +-----+------+------+----+
                |             |
                v             v
          +-----------+ +-----------+
          |  step-ca  | | cert-     |
          |  (CA      | | manager   |
          |  interna) | | (ACME)    |
          +-----------+ +-----------+
                |             |
                v             v
          +-----------+ +-----------+
          |  mTLS     | | Public    |
          |  Service  | | TLS       |
          |  Mesh     | | Certs     |
          +-----------+ +-----------+
```

### 3.1 Diagrama de Fluxo Completo

```
+================================================================+
|                    VELYA PKI ARCHITECTURE                        |
+================================================================+
|                                                                  |
|  EXTERNAL CLIENTS (Browsers, Mobile Apps, APIs)                 |
|       |                                                          |
|       | HTTPS (TLS 1.2+)                                        |
|       v                                                          |
|  +----------------------------------------------------------+   |
|  |              INGRESS CONTROLLER (NGINX)                   |   |
|  |  +-----------------------------------------------------+ |   |
|  |  | TLS Termination                                      | |   |
|  |  | Certificate: *.velya.health (Let's Encrypt)          | |   |
|  |  | HSTS: max-age=31536000; includeSubDomains; preload   | |   |
|  |  | HTTP -> HTTPS Redirect: 301                          | |   |
|  |  +-----------------------------------------------------+ |   |
|  +---------------------------+------------------------------+   |
|                              |                                   |
|                              | (plain HTTP ou mTLS interno)     |
|                              v                                   |
|  +----------------------------------------------------------+   |
|  |                 SERVICE MESH (mTLS)                       |   |
|  |                                                           |   |
|  |  +----------+  +----------+  +----------+  +----------+  |   |
|  |  | Service  |  | Service  |  | Service  |  | Service  |  |   |
|  |  | A        |  | B        |  | C        |  | D        |  |   |
|  |  | (cert    |  | (cert    |  | (cert    |  | (cert    |  |   |
|  |  |  24h)    |  |  24h)    |  |  24h)    |  |  24h)    |  |   |
|  |  +----+-----+  +----+-----+  +----+-----+  +----+-----+  |   |
|  |       |              |              |              |       |   |
|  |       +--------------+--------------+--------------+       |   |
|  |                      |                                     |   |
|  +----------------------+------------------------------------+   |
|                         |                                        |
|  +----------------------+------------------------------------+   |
|  |              CERTIFICATE MANAGEMENT                       |   |
|  |                                                           |   |
|  |  +-------------------+    +-------------------+           |   |
|  |  | cert-manager      |    | step-ca           |           |   |
|  |  | (publico)         |    | (interno)         |           |   |
|  |  |                   |    |                   |           |   |
|  |  | - ACME DNS-01     |    | - CA Root         |           |   |
|  |  | - Let's Encrypt   |    | - Intermediaria   |           |   |
|  |  | - Route53         |    | - Certs 24h       |           |   |
|  |  | - Auto-renewal    |    | - Auto-renewal    |           |   |
|  |  +-------------------+    +-------------------+           |   |
|  +----------------------------------------------------------+   |
|                                                                  |
|  +----------------------------------------------------------+   |
|  |              OBSERVABILIDADE                              |   |
|  |                                                           |   |
|  |  Prometheus -> cert_expiry_seconds                        |   |
|  |  Grafana    -> Certificate Lifecycle Dashboard            |   |
|  |  Alertas    -> 30d warning, 14d critical, 7d emergency    |   |
|  +----------------------------------------------------------+   |
+==================================================================+
```

---

## 4. PKI Publica -- Let's Encrypt + cert-manager

### 4.1 Componentes

| Componente       | Funcao                                                           |
| ---------------- | ---------------------------------------------------------------- |
| cert-manager     | Controller Kubernetes que gerencia ciclo de vida de certificados |
| Let's Encrypt    | CA publica gratuita, automatizada via protocolo ACME             |
| DNS-01 Challenge | Metodo de validacao via registro TXT no DNS                      |
| Route53          | Provedor DNS para resolucao e challenges ACME                    |
| ExternalDNS      | Sincronizacao automatica de registros DNS                        |

### 4.2 Fluxo de Emissao

1. Desenvolvedor cria recurso `Certificate` ou anota `Ingress` com
   `cert-manager.io/cluster-issuer`.
2. cert-manager detecta o recurso e cria um `CertificateRequest`.
3. cert-manager cria um `Order` ACME no Let's Encrypt.
4. Let's Encrypt retorna um challenge DNS-01.
5. cert-manager cria registro TXT `_acme-challenge.velya.health` no Route53.
6. Let's Encrypt valida o registro TXT.
7. Let's Encrypt emite o certificado.
8. cert-manager armazena o certificado em um Secret Kubernetes.
9. Ingress Controller carrega o certificado automaticamente.

### 4.3 Renovacao

O cert-manager monitora continuamente o tempo de expiracao de cada certificado.
Quando faltam 30 dias (configuravel via `renewBefore`), o processo de emissao
e repetido automaticamente sem intervencao humana.

---

## 5. PKI Privada -- step-ca

### 5.1 Componentes

| Componente              | Funcao                                      |
| ----------------------- | ------------------------------------------- |
| step-ca                 | CA privada executando como pod no cluster   |
| step certificates       | CLI para interacao com step-ca              |
| cert-manager StepIssuer | Integracao cert-manager com step-ca         |
| Trust bundle            | ConfigMap distribuido a todos os namespaces |

### 5.2 Hierarquia de CAs

```
Root CA (offline, validade 10 anos)
  |
  +-- Intermediate CA (online, validade 2 anos)
        |
        +-- Service Certificate (24 horas)
        +-- Service Certificate (24 horas)
        +-- Service Certificate (24 horas)
```

### 5.3 Beneficios da PKI Interna

- **Certificados curtos**: 24 horas elimina necessidade de CRL/OCSP.
- **mTLS**: autenticacao mutua entre servicos.
- **Controle total**: sem dependencia de CA externa para comunicacao interna.
- **Performance**: emissao local sem latencia de rede externa.
- **Isolamento**: comprometimento nao afeta confianca publica.

---

## 6. Dominio e Hosts

O dominio principal da Velya Platform e `velya.health`. Todos os servicos
sao expostos como subdominios deste dominio.

| Host                 | Servico                 | Tipo de Certificado |
| -------------------- | ----------------------- | ------------------- |
| velya.health         | Landing page / Portal   | Publico (apex)      |
| app.velya.health     | Aplicacao principal     | Publico (wildcard)  |
| api.velya.health     | API Gateway             | Publico (wildcard)  |
| auth.velya.health    | Autenticacao (Keycloak) | Publico (wildcard)  |
| grafana.velya.health | Observabilidade         | Publico (wildcard)  |
| ops.velya.health     | Operacoes internas      | Publico (wildcard)  |
| status.velya.health  | Status page             | Publico (wildcard)  |
| docs.velya.health    | Documentacao            | Publico (wildcard)  |

---

## 7. Seguranca e Hardening

### 7.1 TLS Configuration

- **Versao minima**: TLS 1.2
- **Cipher suites**: apenas AEAD (AES-GCM, ChaCha20-Poly1305)
- **HSTS**: habilitado com `max-age=31536000; includeSubDomains; preload`
- **OCSP Stapling**: habilitado
- **CAA Records**: configurados para permitir apenas Let's Encrypt

### 7.2 Protecao de Chaves

- Chaves privadas armazenadas exclusivamente em Secrets Kubernetes.
- Secrets encriptados at rest com KMS quando disponivel.
- RBAC restritivo: apenas cert-manager e ingress controller acessam Secrets de TLS.
- Nenhuma chave privada em repositorios, logs, ou ConfigMaps.

### 7.3 Rotacao

| Ativo                 | Frequencia de Rotacao              |
| --------------------- | ---------------------------------- |
| Certificado publico   | 90 dias (renovacao automatica)     |
| Certificado interno   | 24 horas (renovacao automatica)    |
| CA intermediaria      | 2 anos                             |
| CA raiz               | 10 anos (rotacao manual planejada) |
| Credenciais DNS (IAM) | 90 dias                            |

---

## 8. Observabilidade

### 8.1 Metricas

- `certmanager_certificate_expiration_timestamp_seconds` -- timestamp de expiracao
- `certmanager_certificate_ready_status` -- status do certificado
- `certmanager_certificate_renewal_timestamp_seconds` -- proxima renovacao
- `certmanager_http_acme_client_request_count` -- requests ACME
- `step_ca_certificate_issued_total` -- certificados internos emitidos

### 8.2 Alertas

| Alerta                | Condicao             | Severidade |
| --------------------- | -------------------- | ---------- |
| CertExpiringSoon      | < 30 dias            | warning    |
| CertExpiringCritical  | < 14 dias            | critical   |
| CertExpiringEmergency | < 7 dias             | critical   |
| CertRenewalFailed     | renewal falhou       | critical   |
| ACMEChallengeFailed   | challenge DNS falhou | warning    |
| CertManagerDown       | pods unhealthy       | critical   |

---

## 9. Disaster Recovery

### 9.1 Cenarios Cobertos

1. **Let's Encrypt indisponivel**: certificados existentes continuam validos.
   Renovacao retentada automaticamente pelo cert-manager.
2. **Rate limit ACME**: uso de staging para testes. Production apenas para
   hosts oficiais.
3. **DNS provider down**: alertas e fallback manual documentado.
4. **cert-manager crash**: reinstalacao via Helm. Secrets existentes preservados.
5. **Cluster destroy**: certificados re-emitidos automaticamente no novo cluster.
6. **CA interna down**: restart do step-ca. Certificados existentes validos ate
   expiracao (24h max).

### 9.2 RTO/RPO

| Cenario                  | RTO                 | RPO |
| ------------------------ | ------------------- | --- |
| cert-manager restart     | 5 minutos           | 0   |
| Novo certificado publico | 10 minutos          | N/A |
| Novo certificado interno | 1 minuto            | N/A |
| Reconstrucao cluster     | 30 minutos          | 0   |
| Rotacao CA raiz          | 4 horas (planejado) | N/A |

---

## 10. Integracao com CI/CD

### 10.1 Pipeline de Deploy

```
1. Developer merge -> main
2. CI build container image
3. CD (ArgoCD) apply manifests
4. Se novo Ingress/Certificate:
   a. cert-manager detecta
   b. Emite certificado
   c. Ingress Controller carrega
5. Health check verifica HTTPS
6. ExternalDNS sincroniza DNS
```

### 10.2 Testes de Certificado

- **Pre-deploy**: validacao de manifests Certificate com `kubectl --dry-run`
- **Post-deploy**: verificacao de endpoint HTTPS com `curl -v`
- **Continuous**: Prometheus alerts para expiracao e falhas

---

## 11. Responsabilidades

| Papel         | Responsabilidade                                      |
| ------------- | ----------------------------------------------------- |
| Platform Team | Configuracao de cert-manager, step-ca, ClusterIssuers |
| Dev Team      | Anotacao correta de Ingress resources                 |
| Security Team | Auditoria de certificados, rotacao de CA raiz         |
| SRE           | Monitoramento de alertas, resposta a incidentes       |

---

## 12. Documentos Relacionados

| Documento                             | Descricao                           |
| ------------------------------------- | ----------------------------------- |
| public-tls-strategy.md                | Estrategia detalhada de TLS publico |
| internal-pki-strategy.md              | PKI interna com step-ca             |
| domain-and-url-governance.md          | Governanca de dominios e URLs       |
| cert-manager-architecture.md          | Arquitetura do cert-manager         |
| external-dns-architecture.md          | Arquitetura do ExternalDNS          |
| certificate-lifecycle-runbooks.md     | Runbooks operacionais               |
| certificate-observability-model.md    | Observabilidade de certificados     |
| dns-challenge-credentials-policy.md   | Politica de credenciais DNS         |
| caa-and-domain-hardening.md           | CAA e hardening de dominio          |
| disaster-recovery-for-certificates.md | Disaster recovery                   |
| letsencrypt-staging-vs-production.md  | Staging vs Production               |
| wildcard-and-apex-policy.md           | Politica wildcard e apex            |

---

## 13. Changelog

| Data       | Versao | Descricao                        |
| ---------- | ------ | -------------------------------- |
| 2026-04-09 | 1.0    | Versao inicial da estrategia PKI |

---

_Documento mantido pelo Platform Team. Revisao trimestral obrigatoria._
