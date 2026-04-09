# Governanca de Dominio e URLs

**Documento**: domain-and-url-governance.md
**Versao**: 1.0
**Data**: 2026-04-09
**Status**: Aprovado

---

## 1. Introducao

Este documento estabelece a convencao definitiva de nomes, dominios e URLs
da Velya Platform. Toda equipe deve seguir estas convencoes sem excecao.
A disciplina de nomes evita confusao, reduce erros operacionais, e garante
consistencia em todos os ambientes.

---

## 2. Principios

### 2.1 Regras Fundamentais

1. **Nomes curtos**: maximo 3 palavras, preferencialmente 1.
2. **Sem ambiguidade**: cada nome mapeia para exatamente um servico.
3. **Sem temporarios**: nenhum host temporario em producao.
4. **Sem IPs diretos**: todo acesso via hostname.
5. **Hierarquia clara**: `<servico>.<dominio>`.
6. **Convencao lowercase**: todos os nomes em minusculas.
7. **Sem underscores**: apenas hifens quando necessario.
8. **Dominio proprio**: exclusivamente sob dominio controlado.

### 2.2 Anti-Patterns

| Anti-Pattern | Correto |
|---|---|
| api-v2.velya.health | api.velya.health (versionamento na URL path) |
| velya-grafana.some-cloud.io | grafana.velya.health |
| 203.0.113.42:8080 | api.velya.health |
| staging-api.velya.health | api.staging.velya.health |
| my-temp-test.velya.health | Nao existe em producao |
| API.velya.health | api.velya.health |
| velya_app.velya.health | app.velya.health |

---

## 3. Dominio Principal

### 3.1 Escolha do Dominio

O dominio principal da Velya Platform e:

```
velya.health
```

Justificativa:
- `.health` e um TLD especifico para saude, alinhado com o dominio do produto.
- `velya` e o nome da marca, curto e memoravel.
- O dominio e registrado e controlado pela organizacao.

### 3.2 Registrar

O dominio deve ser registrado com:
- **Lock de transferencia**: habilitado.
- **WHOIS privacy**: habilitado.
- **Auto-renew**: habilitado.
- **DNSSEC**: habilitado quando possivel.
- **CAA records**: configurados para permitir apenas Let's Encrypt.

---

## 4. Tabela Completa de Hosts -- Producao

| Host | Servico | Descricao | Tipo de Cert |
|---|---|---|---|
| velya.health | Portal / Landing | Pagina principal | Apex (dedicado) |
| app.velya.health | Aplicacao Web | Interface principal para usuarios | Wildcard |
| api.velya.health | API Gateway | Ponto de entrada de APIs | Wildcard |
| auth.velya.health | Autenticacao | Keycloak / Identity Provider | Wildcard |
| grafana.velya.health | Grafana | Dashboards de observabilidade | Wildcard |
| ops.velya.health | Operacoes | Ferramentas internas de operacao | Wildcard |
| status.velya.health | Status Page | Pagina publica de status | Wildcard |
| docs.velya.health | Documentacao | Documentacao tecnica e usuario | Wildcard |
| argocd.velya.health | ArgoCD | GitOps deployment | Wildcard |
| temporal.velya.health | Temporal UI | Workflow engine UI | Wildcard |
| minio.velya.health | MinIO Console | Object storage console | Wildcard |

---

## 5. Tabela de Hosts -- Staging

Staging utiliza subdominio `staging` para separacao clara:

| Host | Servico |
|---|---|
| staging.velya.health | Portal staging |
| app.staging.velya.health | App staging |
| api.staging.velya.health | API staging |
| auth.staging.velya.health | Auth staging |
| grafana.staging.velya.health | Grafana staging |
| ops.staging.velya.health | Ops staging |

**Certificado**: `*.staging.velya.health` (wildcard separado)

---

## 6. Tabela de Hosts -- Development

Development utiliza subdominio `dev`:

| Host | Servico |
|---|---|
| dev.velya.health | Portal dev |
| app.dev.velya.health | App dev |
| api.dev.velya.health | API dev |
| auth.dev.velya.health | Auth dev |

**Certificado**: `*.dev.velya.health` (wildcard separado, staging issuer)

---

## 7. Separacao de Ambientes

### 7.1 Convencao de Nomes por Ambiente

```
Production:  <servico>.velya.health
Staging:     <servico>.staging.velya.health
Development: <servico>.dev.velya.health
Preview:     <servico>.preview-<pr-id>.velya.health
```

### 7.2 DNS Zones

| Ambiente | DNS Zone | Gerenciamento |
|---|---|---|
| Production | velya.health | Route53 + ExternalDNS |
| Staging | staging.velya.health | Route53 + ExternalDNS |
| Development | dev.velya.health | Route53 + ExternalDNS |
| Preview | preview-*.velya.health | ExternalDNS dinamico |
| Local | *.velya.local | CoreDNS local |

### 7.3 Isolamento

Cada ambiente tem:
- Cluster Kubernetes separado (ou namespace isolado).
- ClusterIssuer separado (staging usa acme-staging, production usa acme-production).
- Credenciais DNS separadas.
- Wildcard certificate separado.

---

## 8. Versionamento de APIs

### 8.1 Convencao

Versionamento de API e feito na URL path, NUNCA no hostname:

```
CORRETO:   api.velya.health/v1/patients
CORRETO:   api.velya.health/v2/patients
ERRADO:    api-v1.velya.health/patients
ERRADO:    v1.api.velya.health/patients
```

### 8.2 Justificativa

- Um unico hostname = um unico certificado TLS.
- Roteamento de versao e responsabilidade do API Gateway.
- Simplicidade operacional.
- Facilita deprecacao de versoes.

---

## 9. URLs Internas (Cluster)

### 9.1 Convencao de Service DNS

Dentro do cluster, servicos sao acessados via DNS interno do Kubernetes:

```
<service>.<namespace>.svc.cluster.local
```

Exemplos:

| Servico | DNS Interno |
|---|---|
| API Gateway | api-gateway.velya-app.svc.cluster.local |
| Auth Service | auth-service.velya-auth.svc.cluster.local |
| Patient Service | patient-service.velya-app.svc.cluster.local |
| Temporal | temporal-frontend.temporal.svc.cluster.local |
| PostgreSQL | postgres.velya-db.svc.cluster.local |
| Redis | redis.velya-cache.svc.cluster.local |
| step-ca | step-ca.step-ca.svc.cluster.local |

### 9.2 Convencao de Namespaces

| Namespace | Proposito |
|---|---|
| velya-app | Servicos de aplicacao |
| velya-auth | Autenticacao e autorizacao |
| velya-db | Bancos de dados |
| velya-cache | Cache (Redis) |
| velya-system | Componentes de plataforma |
| monitoring | Observabilidade (Prometheus, Grafana) |
| ingress-nginx | Ingress Controller |
| cert-manager | Gerenciamento de certificados |
| step-ca | CA interna |
| temporal | Workflow engine |
| argocd | GitOps |

---

## 10. Regras para Novos Hosts

### 10.1 Processo

1. **Proposta**: abrir issue descrevendo o novo host e justificativa.
2. **Revisao**: Platform Team revisa convencao de nome.
3. **Aprovacao**: pelo menos 1 membro do Platform Team aprova.
4. **Implementacao**: criar Ingress com anotacoes corretas.
5. **Verificacao**: confirmar HTTPS funcionando, DNS resolvendo, HSTS ativo.
6. **Documentacao**: atualizar este documento com o novo host.

### 10.2 Criterios de Aprovacao

- Nome segue convencao (curto, sem ambiguidade, lowercase).
- Nao conflita com host existente.
- Tem justificativa clara (nao e temporario).
- Certificado TLS configurado (via wildcard ou dedicado).
- Monitoramento habilitado.

### 10.3 Hosts Proibidos

Os seguintes padroes sao proibidos:

- `test-*`, `tmp-*`, `temp-*`: temporarios nao sao permitidos.
- `*-old`, `*-new`, `*-backup`: versionamento no hostname.
- Nomes com numeros de IP ou portas.
- Nomes que expoe tecnologia interna (postgres.velya.health).
- Nomes com mais de 3 niveis de subdominio em producao.

---

## 11. Redirect e Aliases

### 11.1 Redirects Obrigatorios

| Origem | Destino | Tipo |
|---|---|---|
| http://velya.health | https://velya.health | 301 |
| http://*.velya.health | https://*.velya.health | 301 |
| www.velya.health | velya.health | 301 |

### 11.2 Aliases

Nenhum alias e permitido. Cada servico tem exatamente um hostname.
Se um alias for necessario por motivos historicos, deve ser implementado
como redirect 301, nunca como CNAME ou segundo Ingress.

---

## 12. Governanca de DNS Records

### 12.1 Tipos de Records

| Tipo | Uso |
|---|---|
| A | Apex domain (velya.health) |
| CNAME | Subdominios apontando para Load Balancer |
| TXT | ACME challenges, SPF, DKIM |
| MX | Email (se aplicavel) |
| CAA | Restricao de CAs autorizadas |
| AAAA | IPv6 (quando suportado) |

### 12.2 TTL

| Tipo de Record | TTL |
|---|---|
| A/CNAME de servicos | 300s (5 min) |
| MX | 3600s (1 hora) |
| TXT (SPF/DKIM) | 3600s |
| CAA | 3600s |
| NS | 86400s (24 horas) |

### 12.3 Automacao

Todos os records de tipo A/CNAME para servicos Kubernetes sao gerenciados
automaticamente pelo ExternalDNS. Modificacoes manuais no Route53 sao
sobrescritas pelo ExternalDNS.

Records que NAO sao gerenciados pelo ExternalDNS:
- MX, SPF, DKIM (email)
- CAA
- NS
- SOA

---

## 13. Seguranca de DNS

### 13.1 DNSSEC

DNSSEC deve ser habilitado quando o registrar suportar. Isso protege contra:
- DNS spoofing
- DNS cache poisoning
- Man-in-the-middle no DNS

### 13.2 Protecao de Dominio

- **Registrar lock**: habilitado para prevenir transferencia nao autorizada.
- **Multi-fator**: acesso ao painel do registrar com MFA.
- **Alerta de mudanca**: notificacao para qualquer mudanca de DNS.
- **Least privilege**: apenas Platform Team tem acesso ao DNS.

---

## 14. Checklist para Novo Ambiente

- [ ] DNS Zone criada no Route53
- [ ] ExternalDNS configurado para a nova zone
- [ ] Wildcard certificate emitido
- [ ] Ingress Controller configurado
- [ ] HSTS habilitado
- [ ] HTTP->HTTPS redirect verificado
- [ ] Hosts principais (app, api, auth) funcionando
- [ ] Monitoramento de DNS e TLS ativo
- [ ] Documentacao atualizada

---

## 15. Changelog

| Data | Versao | Descricao |
|---|---|---|
| 2026-04-09 | 1.0 | Versao inicial da governanca de dominio |

---

*Documento mantido pelo Platform Team. Revisao trimestral obrigatoria.*
