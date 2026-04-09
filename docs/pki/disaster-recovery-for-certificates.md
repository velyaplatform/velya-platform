# Disaster Recovery para Certificados

**Documento**: disaster-recovery-for-certificates.md
**Versao**: 1.0
**Data**: 2026-04-09
**Status**: Aprovado

---

## 1. Introducao

Este documento define os procedimentos de Disaster Recovery (DR) para todos
os cenarios de falha envolvendo certificados TLS, PKI publica e privada,
e infraestrutura de DNS da Velya Platform. Cada cenario inclui impacto,
mitigacao, recuperacao e prevencao.

---

## 2. Matriz de Risco

```
+================================================================+
|                CERTIFICATE DR - RISK MATRIX                     |
+================================================================+
|                                                                  |
|  IMPACTO                                                         |
|  ^                                                               |
|  |                                                               |
|  |  ALTO    | Rate Limit  | Cluster     | CA Root    |          |
|  |          | Atingido    | Destroy     | Comprometida|         |
|  |          |             |             |             |          |
|  |  MEDIO   | DNS Provider| cert-mgr    | Credential |          |
|  |          | Down        | Down        | Expirada   |          |
|  |          |             |             |             |          |
|  |  BAIXO   | Let's Encrypt| Secret     |             |          |
|  |          | Indisponivel| Perdido     |             |          |
|  |          |             |             |             |          |
|  +----------+-------------+-------------+-------------+---->    |
|             BAIXA          MEDIA          ALTA                   |
|                        PROBABILIDADE                             |
+==================================================================+
```

---

## 3. Cenario 1: Let's Encrypt Indisponivel

### 3.1 Impacto

- **Nivel**: BAIXO (curto prazo), ALTO (se > 60 dias)
- **Servicos afetados**: nenhum (imediato), todos os publicos (se certs expiram)
- **Dados afetados**: nenhum

### 3.2 Deteccao

```bash
# Verificar conectividade com Let's Encrypt
curl -v https://acme-v02.api.letsencrypt.org/directory

# Verificar logs do cert-manager
kubectl logs -n cert-manager deploy/cert-manager | grep -i "acme\|letsencrypt\|error"

# Verificar status em https://letsencrypt.status.io/
```

### 3.3 Mitigacao

- Certificados existentes continuam validos ate expiracao (90 dias).
- cert-manager retenta automaticamente com backoff exponencial.
- Monitoramento de expiracao mostra quanto tempo temos.

### 3.4 Recuperacao

1. Aguardar restauracao do Let's Encrypt (geralmente < 4 horas).
2. cert-manager retomara renovacoes automaticamente.
3. Se indisponibilidade > 60 dias (extremamente improvavel):
   - Considerar CA alternativa (ZeroSSL, Google Trust Services).
   - Criar ClusterIssuer temporario com outra CA.

### 3.5 Prevencao

- Monitoramento proativo de status do Let's Encrypt.
- Renovar certificados com 30 dias de antecedencia (ja configurado).
- Documentar CA alternativa como plano B.
- CAA records permitem adicionar CA alternativa rapidamente.

---

## 4. Cenario 2: Rate Limit Atingido

### 4.1 Impacto

- **Nivel**: MEDIO
- **Servicos afetados**: novos hosts, certificados nao renovados
- **Duracao**: ate 7 dias (janela rolling)

### 4.2 Deteccao

```bash
# Logs indicam rate limit
kubectl logs -n cert-manager deploy/cert-manager | grep -i "rate limit\|too many"

# Certificados travados em Issuing
kubectl get certificate -A | grep False
```

### 4.3 Mitigacao

- Certificados existentes continuam validos.
- Wildcard cobre novos subdominios sem nova emissao.
- Staging disponivel para testes.

### 4.4 Recuperacao

1. Identificar causa raiz (loop de criacao/delecao? teste sem staging?).
2. Corrigir causa raiz.
3. NAO deletar certificados tentando "resetar".
4. Esperar janela de 7 dias.
5. Usar staging para qualquer teste enquanto espera.
6. Apos janela, emitir certificados necessarios.

### 4.5 Prevencao

- SEMPRE usar staging para testes (regra #1).
- Usar wildcard para minimizar emissoes.
- Monitorar numero de emissoes por semana.
- Alerta quando > 40 emissoes em 7 dias (80% do limite).
- Code review em manifests que criam Certificate resources.

---

## 5. Cenario 3: DNS Provider Down (Route53)

### 5.1 Impacto

- **Nivel**: MEDIO a ALTO
- **Servicos afetados**: novos certificados, renovacoes, resolucao DNS
- **Consequencia adicional**: se DNS nao resolve, servicos ficam inacessiveis

### 5.2 Deteccao

```bash
# Verificar resolucao DNS
dig velya.health @8.8.8.8

# Verificar API do Route53
aws route53 list-hosted-zones

# AWS Health Dashboard
# https://health.aws.amazon.com/
```

### 5.3 Mitigacao

- Certificados existentes continuam validos.
- DNS cache (TTL) mantem resolucao por algum tempo.
- Se DNS nao resolve, nenhum servico e acessivel (independente de TLS).

### 5.4 Recuperacao

1. Verificar AWS Status Dashboard para ETA.
2. Se regional, considerar failover para outra regiao Route53.
3. Apos restauracao, cert-manager retenta challenges automaticamente.
4. Verificar que registros DNS estao corretos apos restauracao.
5. ExternalDNS resincroniza automaticamente.

### 5.5 Prevencao

- DNS secundario em outro provedor (avancado, custo adicional).
- TTL adequados para maximizar cache durante indisponibilidade.
- Monitoramento de DNS externo (Pingdom, Datadog Synthetics).
- Documentar contato AWS Support para escalonamento.

---

## 6. Cenario 4: Credenciais DNS Vencidas

### 6.1 Impacto

- **Nivel**: MEDIO
- **Servicos afetados**: renovacoes e novas emissoes
- **Dados afetados**: nenhum

### 6.2 Deteccao

```bash
# Logs de acesso negado
kubectl logs -n cert-manager deploy/cert-manager | grep -i "access denied\|forbidden\|expired"

# Verificar Secret
kubectl get secret route53-credentials -n cert-manager
```

### 6.3 Mitigacao

- Certificados existentes continuam validos ate expiracao.

### 6.4 Recuperacao

```bash
# 1. Gerar novas credenciais (se access keys)
aws iam create-access-key --user-name cert-manager-route53

# 2. Atualizar Secret
kubectl create secret generic route53-credentials \
  -n cert-manager \
  --from-literal=access-key-id=<NEW_KEY> \
  --from-literal=secret-access-key=<NEW_SECRET> \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Restart cert-manager
kubectl rollout restart deploy/cert-manager -n cert-manager

# 4. Verificar
kubectl logs -n cert-manager deploy/cert-manager --tail=20

# 5. Se IRSA, verificar IAM role e trust policy
aws iam get-role --role-name cert-manager-route53
```

### 6.5 Prevencao

- Usar IRSA em vez de access keys (tokens automaticos, sem expiracao manual).
- Se access keys, rotacao a cada 90 dias com calendario.
- Alerta 14 dias antes da expiracao de credenciais.
- External Secrets Operator para rotacao automatica.

---

## 7. Cenario 5: cert-manager Crash

### 7.1 Impacto

- **Nivel**: MEDIO (curto prazo), ALTO (se prolongado)
- **Servicos afetados**: renovacoes e novas emissoes pausadas
- **Dados afetados**: nenhum

### 7.2 Deteccao

```bash
# Pods nao running
kubectl get pods -n cert-manager

# Eventos de CrashLoopBackOff
kubectl get events -n cert-manager --sort-by='.lastTimestamp'
```

### 7.3 Recuperacao

```bash
# Tentativa 1: Restart
kubectl rollout restart deploy/cert-manager -n cert-manager

# Tentativa 2: Reinstalar via Helm
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --set installCRDs=true \
  --values cert-manager-values.yaml

# Tentativa 3: Limpeza e reinstalacao
helm uninstall cert-manager -n cert-manager
kubectl delete namespace cert-manager
# Esperar 60s
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true \
  --values cert-manager-values.yaml

# Reaplicar ClusterIssuers
kubectl apply -f infra/kubernetes/bootstrap/cert-manager-issuers.yaml
```

### 7.4 Prevencao

- Replicas: 2 para controller e webhook.
- PodDisruptionBudget configurado.
- Resources limits adequados (evitar OOM).
- Monitoramento de pods com alertas.
- Helm values versionados no Git.

---

## 8. Cenario 6: Secret TLS Perdido

### 8.1 Impacto

- **Nivel**: MEDIO
- **Servicos afetados**: host cujo Secret foi perdido (TLS falha)
- **Duracao**: 5-10 minutos (tempo de re-emissao)

### 8.2 Deteccao

```bash
# Ingress sem Secret
kubectl get ingress -A -o json | jq '.items[] | select(.spec.tls[].secretName as $s | . as $i | ($i.metadata.namespace) as $ns | [{"ns": $ns, "secret": $s}]) | .metadata.name'

# Secret ausente
kubectl get secret <name>-tls -n <namespace>
```

### 8.3 Recuperacao

1. cert-manager detecta automaticamente Secret ausente.
2. Re-emite certificado em 5-10 minutos.
3. Se nao re-emitir automaticamente:

```bash
# Forcar re-emissao
kubectl delete certificaterequest -n <namespace> \
  -l cert-manager.io/certificate-name=<name>

# Monitorar
kubectl get certificate <name> -n <namespace> -w
```

### 8.4 Prevencao

- RBAC restritivo (apenas cert-manager e ingress controller acessam Secrets TLS).
- Kubernetes audit logs para detectar delecoes.
- Alerta se Secret TLS e deletado.
- Velero backup inclui Secrets TLS.

---

## 9. Cenario 7: Cluster Destroy

### 9.1 Impacto

- **Nivel**: ALTO
- **Servicos afetados**: todos
- **Duracao**: 30-60 minutos (reconstrucao)

### 9.2 Recuperacao

```bash
# 1. Provisionar novo cluster (via IaC)

# 2. Instalar cert-manager
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true \
  --values cert-manager-values.yaml

# 3. Configurar credenciais DNS
# (IRSA automatico se cluster EKS, ou recriar Secret)

# 4. Aplicar ClusterIssuers
kubectl apply -f infra/kubernetes/bootstrap/cert-manager-issuers.yaml

# 5. Aplicar Certificate resources
kubectl apply -f infra/kubernetes/bootstrap/certificate-resources.yaml

# 6. Deploy de servicos via ArgoCD
# (Ingresses incluem annotations de cert-manager)

# 7. Monitorar emissao de certificados
kubectl get certificate -A -w

# 8. Verificar endpoints HTTPS
for host in app api auth grafana; do
  curl -sv https://$host.velya.health 2>&1 | grep "SSL certificate\|HTTP/"
done
```

### 9.3 RTO

| Fase                   | Tempo Estimado |
| ---------------------- | -------------- |
| Provisionar cluster    | 10-15 min      |
| Instalar cert-manager  | 2-3 min        |
| Configurar credenciais | 2-5 min        |
| Emitir certificados    | 5-10 min       |
| Deploy de servicos     | 10-15 min      |
| Verificacao            | 5 min          |
| **Total**              | **30-50 min**  |

### 9.4 Prevencao

- IaC (Infrastructure as Code) para reconstrucao rapida.
- Manifests de cert-manager versionados no Git.
- Runbook de reconstrucao testado periodicamente.
- Backups via Velero (inclui Secrets).
- Multi-cluster para eliminacao de SPOF.

---

## 10. Cenario 8: CA Interna Expirada

### 10.1 Impacto

- **Nivel**: ALTO
- **Servicos afetados**: toda comunicacao interna mTLS
- **Consequencia**: servicos nao conseguem se comunicar

### 10.2 Deteccao

```bash
# Verificar expiracao da CA
kubectl get secret internal-ca-root-secret -n cert-manager -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -enddate

# Alerta proativo
# (configurado no PrometheusRule)
```

### 10.3 Recuperacao

**CA Intermediaria expirada**:

```bash
# 1. Gerar nova intermediaria (se step-ca)
# step-ca regenera automaticamente se Root CA esta acessivel

# 2. Se usando cert-manager CA issuer:
kubectl delete secret internal-ca-root-secret -n cert-manager

# 3. Re-emitir Root CA certificate
kubectl apply -f infra/kubernetes/bootstrap/cert-manager-issuers.yaml

# 4. Forcar renovacao de todos os certificados internos
kubectl get certificate -A -l velya.health/cert-type=internal -o name | \
  xargs -I {} kubectl delete {}

# 5. Redistribuir trust bundle
kubectl rollout restart deployment -n velya-app
```

**Root CA expirada**:

```bash
# 1. Gerar nova Root CA
# (processo offline para Root CA real, ou via self-signed para dev)

# 2. Atualizar trust bundle em todos os namespaces
# trust-manager faz isso automaticamente se configurado

# 3. Gerar nova Intermediaria
# 4. Renovar todos os certificados de servico
# 5. Restart de todos os servicos para carregar novo trust bundle
```

### 10.4 Prevencao

- Root CA com validade de 10 anos.
- Alerta 1 ano antes da expiracao da Root CA.
- Intermediaria com validade de 2 anos.
- Alerta 6 meses antes da expiracao da Intermediaria.
- Processo de rotacao documentado e testado.
- Calendar reminder para equipe.

---

## 11. Plano de Comunicacao

### 11.1 Niveis de Escalonamento

| Nivel | Condicao                                           | Notificacao                  |
| ----- | -------------------------------------------------- | ---------------------------- |
| P4    | Cert expirando > 30 dias, auto-renewal funcionando | Slack (info)                 |
| P3    | Cert expirando < 30 dias, renewal falhou           | Slack + email (warning)      |
| P2    | Cert expirando < 14 dias, acao necessaria          | Slack + PagerDuty (critical) |
| P1    | Cert expirando < 7 dias OU servico down            | PagerDuty + War Room         |
| P0    | Multiplos certs expirados, servicos down           | All hands + Stakeholders     |

### 11.2 Template de Comunicacao

```
INCIDENTE PKI - [P-LEVEL]

Status: [Investigando | Mitigando | Resolvido]
Impacto: [Descricao do impacto para usuarios]
Servicos: [Lista de servicos afetados]
Inicio: [Timestamp]
ETA: [Estimativa de resolucao]
Responsavel: [Nome]

Proximos passos:
- [Acao 1]
- [Acao 2]

Atualizacao em: [Proximo update]
```

---

## 12. Teste de DR

### 12.1 Testes Periodicos

| Teste                 | Frequencia | Metodo                                 |
| --------------------- | ---------- | -------------------------------------- |
| Renovacao forcada     | Mensal     | Deletar Secret e verificar re-emissao  |
| cert-manager restart  | Trimestral | Rollout restart, verificar recuperacao |
| Credenciais invalidas | Trimestral | Usar key errada, verificar alerta      |
| Cluster rebuild       | Semestral  | Destroy e rebuild de staging           |
| CA rotation           | Anual      | Rotacao planejada da intermediaria     |

### 12.2 Checklist de Teste

```bash
# Teste 1: Renovacao forcada
kubectl delete secret velya-health-wildcard-tls -n velya-system
kubectl get certificate velya-health-wildcard -n velya-system -w
# Deve emitir novo certificado em < 10 minutos

# Teste 2: cert-manager restart
kubectl rollout restart deploy/cert-manager -n cert-manager
kubectl get pods -n cert-manager -w
# Deve voltar ao normal em < 2 minutos

# Teste 3: Simulacao de expiracao
# Usar metricas sinteticas ou certificado staging com duracao curta
```

---

## 13. Backup Checklist

| Item                     | Metodo              | Frequencia     | Retencao   |
| ------------------------ | ------------------- | -------------- | ---------- |
| Root CA private key      | Offline (cofre)     | Na criacao     | Permanente |
| Root CA certificate      | Git + offline       | Na criacao     | Permanente |
| cert-manager values      | Git                 | A cada mudanca | Permanente |
| ClusterIssuer manifests  | Git                 | A cada mudanca | Permanente |
| Certificate manifests    | Git                 | A cada mudanca | Permanente |
| ACME account keys        | Velero backup       | Diario         | 90 dias    |
| DNS credentials          | AWS Secrets Manager | A cada rotacao | 90 dias    |
| Kubernetes Secrets (TLS) | Velero backup       | Diario         | 30 dias    |
| step-ca database         | PV snapshot         | Diario         | 30 dias    |

---

## 14. Changelog

| Data       | Versao | Descricao                                    |
| ---------- | ------ | -------------------------------------------- |
| 2026-04-09 | 1.0    | Versao inicial do plano de disaster recovery |

---

_Documento mantido pelo SRE Team e Platform Team. Revisao trimestral obrigatoria.
Teste de DR semestral obrigatorio._
