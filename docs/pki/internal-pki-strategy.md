# Estrategia PKI Interna -- step-ca + mTLS

**Documento**: internal-pki-strategy.md
**Versao**: 1.0
**Data**: 2026-04-09
**Status**: Aprovado

---

## 1. Introducao

A PKI interna da Velya Platform utiliza o step-ca como Autoridade Certificadora
privada para emissao de certificados de servico de curta duracao. Esta
infraestrutura habilita mTLS (mutual TLS) entre todos os servicos no cluster
Kubernetes, garantindo autenticacao mutua e criptografia ponta a ponta na
comunicacao interna.

---

## 2. Motivacao

### 2.1 Por que PKI Interna?

Certificados publicos (Let's Encrypt) nao sao adequados para comunicacao interna:

- **Exposicao**: certificados publicos aparecem em logs de Certificate Transparency.
- **Rate limits**: Let's Encrypt impoe limites que nao escalam para centenas de servicos.
- **Duracao**: certificados publicos duram 90 dias; internos podem durar 24 horas.
- **Custo operacional**: cada certificado publico requer challenge DNS.
- **mTLS**: CAs publicas nao emitem certificados client para mTLS.

### 2.2 Beneficios

| Beneficio           | Descricao                                       |
| ------------------- | ----------------------------------------------- |
| Autenticacao mutua  | Ambos os lados verificam identidade             |
| Criptografia        | Todo trafego interno encriptado                 |
| Certificados curtos | 24h elimina necessidade de revogacao            |
| Controle total      | Organizacao controla toda a cadeia de confianca |
| Performance         | Emissao local sem latencia de rede externa      |
| Escalabilidade      | Sem rate limits externos                        |

---

## 3. Arquitetura

### 3.1 Diagrama

```
+================================================================+
|                   PKI INTERNA - STEP-CA                         |
+================================================================+
|                                                                  |
|  +------------------+                                            |
|  |   Root CA        |  <-- Offline, armazenada em cofre          |
|  |   Validade: 10a  |      Usada apenas para assinar             |
|  +--------+---------+      Intermediarias                        |
|           |                                                      |
|           v                                                      |
|  +------------------+                                            |
|  | Intermediate CA  |  <-- Online, executando como pod           |
|  | Validade: 2 anos |      step-ca server                        |
|  | (step-ca)        |                                            |
|  +--------+---------+                                            |
|           |                                                      |
|     +-----+-----+-----+-----+                                   |
|     |     |     |     |     |                                    |
|     v     v     v     v     v                                    |
|  +-----+-----+-----+-----+-----+                                |
|  | Svc | Svc | Svc | Svc | Svc |  <-- Certificados 24h          |
|  | A   | B   | C   | D   | E   |      Renovacao a cada 16h      |
|  +-----+-----+-----+-----+-----+                                |
|                                                                  |
|  +------------------+                                            |
|  | Trust Bundle     |  <-- ConfigMap distribuido                  |
|  | (CA chain)       |      a todos os namespaces                 |
|  +------------------+                                            |
|                                                                  |
+==================================================================+
```

### 3.2 Componentes

| Componente      | Descricao                        | Namespace    |
| --------------- | -------------------------------- | ------------ |
| step-ca         | CA server (Smallstep)            | step-ca      |
| cert-manager    | Controller de certificados       | cert-manager |
| step-issuer     | Plugin cert-manager para step-ca | cert-manager |
| trust-manager   | Distribuicao de CA bundle        | cert-manager |
| ConfigMap trust | CA chain para verificacao        | Todos        |

---

## 4. Instalacao do step-ca

### 4.1 Helm Values

```yaml
# step-ca-values.yaml
replicaCount: 1

image:
  repository: smallstep/step-ca
  tag: 0.26.0

bootstrap:
  # Configuracao inicial da CA
  provisioners:
    - name: cert-manager
      type: ACME
    - name: admin
      type: JWK

ca:
  # Configuracao da CA
  name: 'Velya Internal CA'
  dns:
    - step-ca.step-ca.svc.cluster.local
    - step-ca.step-ca.svc
    - 127.0.0.1
  address: ':9000'

  # Duracao dos certificados
  authority:
    provisioners:
      - name: cert-manager
        type: ACME
        claims:
          maxTLSCertDuration: 48h
          defaultTLSCertDuration: 24h
          minTLSCertDuration: 1h

  # Database para persistencia
  db:
    type: badgerv2
    dataSource: /home/step/db

persistence:
  enabled: true
  size: 1Gi
  storageClass: standard

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

service:
  type: ClusterIP
  port: 9000

# Security context
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000

# Pod disruption budget
podDisruptionBudget:
  enabled: true
  minAvailable: 1

# Metrics
metrics:
  enabled: true
  port: 9090
```

### 4.2 Instalacao

```bash
# Adicionar repositorio Helm
helm repo add smallstep https://smallstep.github.io/helm-charts
helm repo update

# Criar namespace
kubectl create namespace step-ca

# Instalar step-ca
helm install step-ca smallstep/step-ca \
  --namespace step-ca \
  --values step-ca-values.yaml

# Verificar instalacao
kubectl get pods -n step-ca
kubectl logs -n step-ca deploy/step-ca
```

---

## 5. Integracao com cert-manager

### 5.1 StepIssuer ou ACME Issuer

O step-ca suporta o protocolo ACME nativamente, permitindo que o cert-manager
se conecte a ele usando um ClusterIssuer padrao ACME:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: internal-ca
spec:
  acme:
    server: https://step-ca.step-ca.svc.cluster.local:9000/acme/cert-manager/directory
    caBundle: <base64-encoded-root-ca>
    privateKeySecretRef:
      name: internal-ca-account-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

### 5.2 Alternativa: step-issuer

Para integracao mais direta, o step-issuer pode ser usado:

```yaml
apiVersion: certmanager.step.sm/v1beta1
kind: StepClusterIssuer
metadata:
  name: step-issuer
spec:
  url: https://step-ca.step-ca.svc.cluster.local:9000
  caBundle: <base64-encoded-root-ca>
  provisioner:
    name: cert-manager
    kid: <provisioner-key-id>
    passwordRef:
      name: step-issuer-provisioner-password
      namespace: cert-manager
      key: password
```

### 5.3 Certificate para Servico

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: service-a-mtls
  namespace: velya-app
spec:
  secretName: service-a-mtls-tls
  issuerRef:
    name: internal-ca
    kind: ClusterIssuer
  dnsNames:
    - service-a.velya-app.svc.cluster.local
    - service-a.velya-app.svc
    - service-a
  duration: 24h
  renewBefore: 8h
  usages:
    - server auth
    - client auth
  privateKey:
    algorithm: ECDSA
    size: 256
```

---

## 6. mTLS entre Servicos

### 6.1 Conceito

mTLS (mutual TLS) exige que ambos os lados da conexao apresentem certificados
validos. Isso garante:

- **Autenticacao do servidor**: o cliente verifica que esta falando com o servico correto.
- **Autenticacao do cliente**: o servidor verifica que o request vem de um servico autorizado.
- **Criptografia**: todo trafego entre servicos e encriptado.

### 6.2 Configuracao no Servico

Cada servico deve ser configurado para:

1. Apresentar seu certificado TLS (server cert).
2. Exigir certificado do cliente (client cert).
3. Verificar o certificado do cliente contra a CA interna.

```yaml
# Exemplo de Deployment com mTLS
apiVersion: apps/v1
kind: Deployment
metadata:
  name: service-a
  namespace: velya-app
spec:
  template:
    spec:
      containers:
        - name: service-a
          volumeMounts:
            - name: mtls-certs
              mountPath: /etc/tls
              readOnly: true
            - name: ca-bundle
              mountPath: /etc/tls/ca
              readOnly: true
          env:
            - name: TLS_CERT_FILE
              value: /etc/tls/tls.crt
            - name: TLS_KEY_FILE
              value: /etc/tls/tls.key
            - name: TLS_CA_FILE
              value: /etc/tls/ca/ca.crt
      volumes:
        - name: mtls-certs
          secret:
            secretName: service-a-mtls-tls
        - name: ca-bundle
          configMap:
            name: internal-ca-bundle
```

### 6.3 Trust Distribution

O trust bundle (certificado da CA raiz + intermediaria) deve ser distribuido
a todos os pods que precisam verificar certificados internos:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: internal-ca-bundle
  namespace: velya-app
data:
  ca.crt: |
    -----BEGIN CERTIFICATE-----
    <root-ca-certificate>
    -----END CERTIFICATE-----
    -----BEGIN CERTIFICATE-----
    <intermediate-ca-certificate>
    -----END CERTIFICATE-----
```

### 6.4 trust-manager para Distribuicao Automatica

O trust-manager do cert-manager pode automatizar a distribuicao do trust bundle:

```yaml
apiVersion: trust.cert-manager.io/v1alpha1
kind: Bundle
metadata:
  name: internal-ca-bundle
spec:
  sources:
    - secret:
        name: internal-ca-root
        key: ca.crt
  target:
    configMap:
      key: ca.crt
    namespaceSelector:
      matchLabels:
        velya.health/internal-tls: 'enabled'
```

---

## 7. Certificados de Curta Duracao

### 7.1 Por que 24 horas?

| Duracao  | Vantagem                | Desvantagem                 |
| -------- | ----------------------- | --------------------------- |
| 90 dias  | Menos renovacoes        | Requer revogacao (CRL/OCSP) |
| 7 dias   | Revogacao menos critica | Mais renovacoes             |
| 24 horas | Elimina revogacao       | Renovacao frequente         |
| 1 hora   | Maximo isolamento       | Alto overhead               |

**Decisao**: 24 horas com renovacao a cada 16 horas oferece o melhor equilibrio
entre seguranca (certificados efemeros) e overhead operacional (renovacao
gerenciavel).

### 7.2 Eliminacao de CRL/OCSP

Com certificados de 24 horas, a revogacao torna-se desnecessaria:

- Se um certificado e comprometido, ele expira em no maximo 24 horas.
- Nao e necessario manter infraestrutura de CRL (Certificate Revocation List).
- Nao e necessario configurar OCSP (Online Certificate Status Protocol).
- Em caso de incidente, a resposta e simplesmente esperar a expiracao ou
  rotacionar a CA intermediaria.

---

## 8. Rotacao de CA

### 8.1 Rotacao da Intermediaria

A CA intermediaria tem validade de 2 anos. A rotacao deve ser planejada
com antecedencia:

```
Meses antes da expiracao:
  6 meses: Planejamento da rotacao
  3 meses: Gerar nova intermediaria, assinar com Root CA
  2 meses: Distribuir novo trust bundle (ambas intermediarias)
  1 mes:   Servicos comecam a receber certs da nova intermediaria
  0:       Remover intermediaria antiga do trust bundle
```

### 8.2 Rotacao da Root CA

A Root CA tem validade de 10 anos. Rotacao e um evento raro mas planejado:

1. Gerar nova Root CA offline.
2. Cross-sign entre antiga e nova Root CA.
3. Distribuir trust bundle com ambas Root CAs.
4. Gerar nova Intermediaria assinada pela nova Root CA.
5. Migrar servicos gradualmente.
6. Apos migracao completa, remover Root CA antiga.

### 8.3 Procedimento de Emergencia

Em caso de comprometimento da CA:

1. **Intermediaria comprometida**:
   - Gerar nova intermediaria imediatamente.
   - Revogar intermediaria comprometida no trust bundle.
   - Todos os certificados de servico serao renovados em ate 24 horas.

2. **Root CA comprometida**:
   - Incidente critico. Ativar procedimento de resposta a incidentes.
   - Gerar nova Root CA e intermediaria.
   - Rotacionar trust bundle em todos os namespaces.
   - Forcar renovacao de todos os certificados de servico.

---

## 9. Network Policies para mTLS

### 9.1 Restringir Comunicacao

Com mTLS habilitado, Network Policies devem complementar a seguranca:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: service-a-mtls-policy
  namespace: velya-app
spec:
  podSelector:
    matchLabels:
      app: service-a
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              velya.health/mtls-client: 'true'
      ports:
        - protocol: TCP
          port: 8443
  egress:
    - to:
        - podSelector:
            matchLabels:
              velya.health/mtls-server: 'true'
      ports:
        - protocol: TCP
          port: 8443
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: step-ca
      ports:
        - protocol: TCP
          port: 9000
```

---

## 10. Monitoramento

### 10.1 Metricas do step-ca

| Metrica                           | Descricao                      |
| --------------------------------- | ------------------------------ |
| step_ca_certificate_issued_total  | Total de certificados emitidos |
| step_ca_certificate_renewed_total | Total de renovacoes            |
| step_ca_certificate_failed_total  | Total de falhas                |
| step_ca_request_duration_seconds  | Latencia de emissao            |
| step_ca_active_certificates       | Certificados ativos            |

### 10.2 Alertas

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: internal-pki-alerts
  namespace: monitoring
spec:
  groups:
    - name: internal-pki
      rules:
        - alert: StepCADown
          expr: up{job="step-ca"} == 0
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: 'step-ca CA server esta down'
            description: 'O servidor CA interno nao esta respondendo ha mais de 5 minutos.'

        - alert: InternalCertRenewalFailed
          expr: increase(step_ca_certificate_failed_total[1h]) > 0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: 'Falha na emissao de certificado interno'
            description: 'Houve falhas na emissao de certificados internos na ultima hora.'

        - alert: InternalCAExpiringCritical
          expr: (step_ca_intermediate_cert_expiry_seconds - time()) < 86400 * 90
          for: 1h
          labels:
            severity: critical
          annotations:
            summary: 'CA intermediaria expirando em menos de 90 dias'
            description: 'A CA intermediaria precisa ser rotacionada.'
```

---

## 11. Backup e Recovery

### 11.1 O que fazer backup

| Item                | Metodo                 | Frequencia        |
| ------------------- | ---------------------- | ----------------- |
| Root CA private key | Offline, cofre fisico  | Criacao + rotacao |
| Root CA certificate | Git (publico)          | Criacao + rotacao |
| Intermediate CA key | Sealed Secret ou Vault | Diario            |
| step-ca database    | PV snapshot            | Diario            |
| Trust bundle        | Git (publico)          | A cada mudanca    |

### 11.2 Recovery

1. **step-ca pod crash**: Kubernetes restart automatico. Persistent Volume preserva estado.
2. **PV perdido**: Restaurar database do backup. Re-emissao de todos os certificados.
3. **Intermediate CA comprometida**: Gerar nova a partir da Root CA offline.
4. **Cluster destroy**: Reinstalar step-ca. Restaurar Root CA do cofre. Gerar nova Intermediaria.

---

## 12. Consideracoes de Performance

### 12.1 Escala

O step-ca e capaz de emitir centenas de certificados por segundo. Para a
Velya Platform com ate 100 servicos, cada renovando a cada 16 horas:

- Renovacoes por hora: ~6
- Renovacoes por dia: ~150
- Carga no step-ca: minima

### 12.2 Latencia

- Emissao de certificado: < 100ms (local)
- Renovacao: transparente para o servico
- Verificacao mTLS: overhead de ~1ms por handshake

---

## 13. Checklist de Implementacao

- [ ] step-ca instalado via Helm
- [ ] Root CA gerada offline
- [ ] Intermediate CA configurada
- [ ] cert-manager integrado com step-ca
- [ ] Trust bundle distribuido
- [ ] trust-manager configurado
- [ ] Primeiro certificado de servico emitido
- [ ] mTLS verificado entre dois servicos
- [ ] Metricas Prometheus coletando
- [ ] Alertas configurados
- [ ] Runbook de rotacao de CA documentado
- [ ] Backup de Root CA verificado
- [ ] Network Policies configuradas

---

## 14. Changelog

| Data       | Versao | Descricao                                |
| ---------- | ------ | ---------------------------------------- |
| 2026-04-09 | 1.0    | Versao inicial da estrategia PKI interna |

---

_Documento mantido pelo Platform Team. Revisao trimestral obrigatoria._
