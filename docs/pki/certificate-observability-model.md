# Modelo de Observabilidade de Certificados

**Documento**: certificate-observability-model.md
**Versao**: 1.0
**Data**: 2026-04-09
**Status**: Aprovado

---

## 1. Introducao

Este documento define o modelo completo de observabilidade para certificados
TLS na Velya Platform. Inclui dashboards Grafana, alertas Prometheus,
metricas customizadas e integracao com o stack de observabilidade existente.

---

## 2. Arquitetura de Observabilidade

```
+================================================================+
|              CERTIFICATE OBSERVABILITY STACK                     |
+================================================================+
|                                                                  |
|  +------------------+    +------------------+                    |
|  | cert-manager     |--->| Prometheus       |                    |
|  | metrics (:9402)  |    | (scrape)         |                    |
|  +------------------+    +--------+---------+                    |
|                                   |                              |
|  +------------------+             |                              |
|  | step-ca          |--->---------+                              |
|  | metrics (:9090)  |             |                              |
|  +------------------+             |                              |
|                                   |                              |
|  +------------------+             |                              |
|  | external-dns     |--->---------+                              |
|  | metrics (:7979)  |             |                              |
|  +------------------+             v                              |
|                          +------------------+                    |
|                          | Alertmanager     |                    |
|                          | (routing)        |                    |
|                          +--------+---------+                    |
|                                   |                              |
|                          +--------+---------+                    |
|                          | Grafana          |                    |
|                          | (dashboards)     |                    |
|                          +------------------+                    |
|                                                                  |
+==================================================================+
```

---

## 3. Dashboards Grafana

### 3.1 Dashboard 1: Certificate Lifecycle Board

**Proposito**: Visao geral do ciclo de vida de todos os certificados.

**Paineis**:

| Painel                  | Tipo        | Query                                                                |
| ----------------------- | ----------- | -------------------------------------------------------------------- |
| Total de Certificados   | Stat        | `count(certmanager_certificate_ready_status)`                        |
| Certificados Ready      | Stat        | `count(certmanager_certificate_ready_status == 1)`                   |
| Certificados Not Ready  | Stat        | `count(certmanager_certificate_ready_status == 0)`                   |
| Proximo Vencimento      | Stat        | `min(certmanager_certificate_expiration_timestamp_seconds - time())` |
| Timeline de Expiracao   | Time Series | `certmanager_certificate_expiration_timestamp_seconds - time()`      |
| Certificados por Issuer | Pie Chart   | `count by (issuer_name)(certmanager_certificate_ready_status)`       |
| Renovacoes Recentes     | Table       | `changes(certmanager_certificate_expiration_timestamp_seconds[7d])`  |
| Historico de Emissoes   | Time Series | `rate(certmanager_controller_sync_call_count[5m])`                   |

**Variaveis de Dashboard**:

- `namespace`: filtro por namespace
- `issuer`: filtro por ClusterIssuer/Issuer
- `certificate`: filtro por nome do certificado

**JSON Model (resumido)**:

```json
{
  "dashboard": {
    "title": "Certificate Lifecycle Board",
    "uid": "cert-lifecycle",
    "tags": ["pki", "certificates", "velya"],
    "timezone": "browser",
    "refresh": "1m",
    "panels": [
      {
        "title": "Certificados Ready",
        "type": "stat",
        "targets": [
          {
            "expr": "count(certmanager_certificate_ready_status{condition=\"Ready\"} == 1)",
            "legendFormat": "Ready"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                { "color": "red", "value": 0 },
                { "color": "green", "value": 1 }
              ]
            }
          }
        }
      },
      {
        "title": "Tempo ate Expiracao (dias)",
        "type": "timeseries",
        "targets": [
          {
            "expr": "(certmanager_certificate_expiration_timestamp_seconds - time()) / 86400",
            "legendFormat": "{{ namespace }}/{{ name }}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "d",
            "thresholds": {
              "steps": [
                { "color": "red", "value": 7 },
                { "color": "orange", "value": 14 },
                { "color": "yellow", "value": 30 },
                { "color": "green", "value": 60 }
              ]
            }
          }
        }
      }
    ]
  }
}
```

### 3.2 Dashboard 2: ACME Challenge Board

**Proposito**: Monitorar challenges ACME em andamento e historicos.

**Paineis**:

| Painel            | Tipo        | Query                                                                |
| ----------------- | ----------- | -------------------------------------------------------------------- | ----------- |
| Challenges Ativos | Stat        | `count(certmanager_http_acme_client_request_count)`                  |
| Taxa de Sucesso   | Gauge       | `rate(certmanager_http_acme_client_request_count{status="200"}[1h])` |
| Erros ACME        | Time Series | `rate(certmanager_http_acme_client_request_count{status=~"4..        | 5.."}[5m])` |
| Latencia ACME     | Histogram   | `certmanager_http_acme_client_request_duration_seconds`              |
| Orders por Status | Pie Chart   | `count by (state)(certmanager_acme_order_state)`                     |

### 3.3 Dashboard 3: DNS Automation Board

**Proposito**: Monitorar ExternalDNS e sincronizacao DNS.

**Paineis**:

| Painel                | Tipo        | Query                                                     |
| --------------------- | ----------- | --------------------------------------------------------- |
| Endpoints Gerenciados | Stat        | `external_dns_registry_endpoints`                         |
| Ultimo Sync           | Stat        | `time() - external_dns_controller_last_sync_timestamp`    |
| Erros de Sync         | Time Series | `rate(external_dns_source_errors_total[5m])`              |
| Endpoints por Fonte   | Bar         | `external_dns_source_endpoints`                           |
| Registros por Tipo    | Pie Chart   | `count by (record_type)(external_dns_registry_endpoints)` |

### 3.4 Dashboard 4: HTTPS Endpoint Health Board

**Proposito**: Verificar saude de endpoints HTTPS externos.

**Paineis**:

| Painel                        | Tipo        | Query                                               |
| ----------------------------- | ----------- | --------------------------------------------------- |
| Endpoints HTTPS Up            | Stat        | `count(probe_ssl_earliest_cert_expiry > 0)`         |
| Dias para Expiracao (externo) | Table       | `(probe_ssl_earliest_cert_expiry - time()) / 86400` |
| TLS Version                   | Pie Chart   | `count by (version)(probe_tls_version_info)`        |
| Tempo de Handshake            | Time Series | `probe_http_duration_seconds{phase="tls"}`          |

**Nota**: Requer blackbox_exporter configurado para probes HTTPS.

### 3.5 Dashboard 5: Internal PKI Health Board

**Proposito**: Monitorar step-ca e certificados internos.

**Paineis**:

| Painel                        | Tipo        | Query                                               |
| ----------------------------- | ----------- | --------------------------------------------------- |
| step-ca Up                    | Stat        | `up{job="step-ca"}`                                 |
| Certificados Emitidos (total) | Stat        | `step_ca_certificate_issued_total`                  |
| Taxa de Emissao               | Time Series | `rate(step_ca_certificate_issued_total[5m])`        |
| Falhas de Emissao             | Time Series | `rate(step_ca_certificate_failed_total[5m])`        |
| Latencia de Emissao           | Histogram   | `step_ca_request_duration_seconds`                  |
| CA Intermediaria Expiracao    | Stat        | `step_ca_intermediate_cert_expiry_seconds - time()` |

### 3.6 Dashboard 6: Expiry Risk Board

**Proposito**: Visao executiva de risco de expiracao.

**Paineis**:

| Painel                 | Tipo          | Query                                                                               |
| ---------------------- | ------------- | ----------------------------------------------------------------------------------- |
| Risco Critico (< 7d)   | Stat (red)    | `count((certmanager_certificate_expiration_timestamp_seconds - time()) < 604800)`   |
| Risco Alto (< 14d)     | Stat (orange) | `count((certmanager_certificate_expiration_timestamp_seconds - time()) < 1209600)`  |
| Risco Medio (< 30d)    | Stat (yellow) | `count((certmanager_certificate_expiration_timestamp_seconds - time()) < 2592000)`  |
| Sem Risco (> 30d)      | Stat (green)  | `count((certmanager_certificate_expiration_timestamp_seconds - time()) >= 2592000)` |
| Heatmap de Risco       | Heatmap       | Por namespace e dias para expiracao                                                 |
| Tabela de Certificados | Table         | Todos os certificados ordenados por expiracao                                       |

---

## 4. Alertas PrometheusRule

### 4.1 YAML Completo

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: certificate-alerts
  namespace: monitoring
  labels:
    release: prometheus
    app.kubernetes.io/part-of: velya-platform
spec:
  groups:
    # ==========================================
    # Grupo 1: Expiracao de Certificados
    # ==========================================
    - name: certificate-expiry
      rules:
        - alert: CertExpiring30Days
          expr: |
            (certmanager_certificate_expiration_timestamp_seconds - time()) < 2592000
            and
            (certmanager_certificate_expiration_timestamp_seconds - time()) > 1209600
          for: 1h
          labels:
            severity: warning
            team: platform
          annotations:
            summary: 'Certificado {{ $labels.name }} expira em menos de 30 dias'
            description: |
              O certificado {{ $labels.name }} no namespace {{ $labels.exported_namespace }}
              expira em {{ $value | humanizeDuration }}. A renovacao deveria ser automatica.
              Verificar cert-manager e ClusterIssuer.
            runbook_url: 'https://docs.velya.health/pki/certificate-lifecycle-runbooks'

        - alert: CertExpiring14Days
          expr: |
            (certmanager_certificate_expiration_timestamp_seconds - time()) < 1209600
            and
            (certmanager_certificate_expiration_timestamp_seconds - time()) > 604800
          for: 30m
          labels:
            severity: critical
            team: platform
          annotations:
            summary: 'CRITICO: Certificado {{ $labels.name }} expira em menos de 14 dias'
            description: |
              O certificado {{ $labels.name }} no namespace {{ $labels.exported_namespace }}
              expira em {{ $value | humanizeDuration }}. Renovacao automatica provavelmente falhou.
              Acao imediata necessaria.

        - alert: CertExpiring7Days
          expr: |
            (certmanager_certificate_expiration_timestamp_seconds - time()) < 604800
            and
            (certmanager_certificate_expiration_timestamp_seconds - time()) > 86400
          for: 10m
          labels:
            severity: critical
            team: platform
            escalation: p1
          annotations:
            summary: 'EMERGENCIA: Certificado {{ $labels.name }} expira em menos de 7 dias'
            description: |
              O certificado {{ $labels.name }} expira em {{ $value | humanizeDuration }}.
              Incidente P1. Resolver imediatamente.

        - alert: CertExpiring1Day
          expr: |
            (certmanager_certificate_expiration_timestamp_seconds - time()) < 86400
            and
            (certmanager_certificate_expiration_timestamp_seconds - time()) > 0
          for: 5m
          labels:
            severity: critical
            team: platform
            escalation: p0
          annotations:
            summary: 'P0: Certificado {{ $labels.name }} expira em menos de 24 horas'
            description: |
              O certificado {{ $labels.name }} expira em {{ $value | humanizeDuration }}.
              DOWNTIME IMINENTE. Acao emergencial.

    # ==========================================
    # Grupo 2: Saude do cert-manager
    # ==========================================
    - name: cert-manager-health
      rules:
        - alert: CertManagerDown
          expr: |
            absent(up{job="cert-manager"} == 1)
          for: 5m
          labels:
            severity: critical
            team: platform
          annotations:
            summary: 'cert-manager esta down'
            description: 'O cert-manager controller nao esta respondendo. Certificados nao serao renovados.'

        - alert: CertManagerWebhookDown
          expr: |
            absent(up{job="cert-manager-webhook"} == 1)
          for: 5m
          labels:
            severity: critical
            team: platform
          annotations:
            summary: 'cert-manager webhook esta down'
            description: 'O webhook do cert-manager nao esta respondendo. Novos Certificate resources nao serao validados.'

        - alert: CertNotReady
          expr: |
            certmanager_certificate_ready_status{condition="Ready"} == 0
          for: 30m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: 'Certificado {{ $labels.name }} nao esta Ready'
            description: 'O certificado {{ $labels.name }} no namespace {{ $labels.exported_namespace }} nao esta no estado Ready ha 30 minutos.'

    # ==========================================
    # Grupo 3: ACME Challenges
    # ==========================================
    - name: acme-challenges
      rules:
        - alert: ACMEChallengeFailed
          expr: |
            increase(certmanager_http_acme_client_request_count{status=~"4..|5.."}[15m]) > 5
          for: 5m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: 'Multiplas falhas de challenge ACME'
            description: 'Mais de 5 requests ACME com erro nos ultimos 15 minutos. Verificar credenciais DNS e conectividade.'

        - alert: ACMEChallengeStuck
          expr: |
            certmanager_certificate_ready_status{condition="Ready"} == 0
            and
            time() - certmanager_certificate_ready_status_last_transition_time > 3600
          for: 10m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: 'Challenge ACME preso ha mais de 1 hora'

    # ==========================================
    # Grupo 4: Secrets e TLS
    # ==========================================
    - name: tls-secrets
      rules:
        - alert: TLSSecretMissing
          expr: |
            certmanager_certificate_ready_status{condition="Ready"} == 1
            unless
            kube_secret_info{type="kubernetes.io/tls"}
          for: 5m
          labels:
            severity: critical
            team: platform
          annotations:
            summary: 'Secret TLS ausente para certificado Ready'

    # ==========================================
    # Grupo 5: PKI Interna
    # ==========================================
    - name: internal-pki
      rules:
        - alert: StepCADown
          expr: |
            absent(up{job="step-ca"} == 1)
          for: 5m
          labels:
            severity: critical
            team: platform
          annotations:
            summary: 'step-ca CA interna esta down'
            description: 'A CA interna nao esta respondendo. Certificados internos nao serao renovados.'

        - alert: InternalCertRenewalFailed
          expr: |
            increase(step_ca_certificate_failed_total[1h]) > 0
          for: 5m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: 'Falha na emissao de certificado interno'

    # ==========================================
    # Grupo 6: DNS
    # ==========================================
    - name: dns-health
      rules:
        - alert: ExternalDNSDown
          expr: |
            absent(up{job="external-dns"} == 1)
          for: 5m
          labels:
            severity: critical
            team: platform
          annotations:
            summary: 'ExternalDNS esta down'

        - alert: ExternalDNSSyncStale
          expr: |
            time() - external_dns_controller_last_sync_timestamp > 600
          for: 5m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: 'ExternalDNS nao sincroniza ha mais de 10 minutos'
```

---

## 5. ServiceMonitors

### 5.1 cert-manager ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: cert-manager
  namespace: monitoring
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: cert-manager
      app.kubernetes.io/component: controller
  namespaceSelector:
    matchNames:
      - cert-manager
  endpoints:
    - port: http-metrics
      interval: 60s
      scrapeTimeout: 30s
      path: /metrics
```

### 5.2 step-ca ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: step-ca
  namespace: monitoring
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app: step-ca
  namespaceSelector:
    matchNames:
      - step-ca
  endpoints:
    - port: metrics
      interval: 60s
      path: /metrics
```

### 5.3 ExternalDNS ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: external-dns
  namespace: monitoring
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: external-dns
  namespaceSelector:
    matchNames:
      - external-dns
  endpoints:
    - port: http
      interval: 60s
      path: /metrics
```

---

## 6. Blackbox Exporter para HTTPS Probes

### 6.1 Configuracao

```yaml
# blackbox-exporter config
modules:
  https_2xx:
    prober: http
    timeout: 10s
    http:
      valid_http_versions: ['HTTP/1.1', 'HTTP/2.0']
      valid_status_codes: [200, 301, 302]
      method: GET
      tls_config:
        insecure_skip_verify: false
      fail_if_not_ssl: true
      preferred_ip_protocol: ip4
```

### 6.2 Probe Targets

```yaml
apiVersion: monitoring.coreos.com/v1
kind: Probe
metadata:
  name: velya-https-endpoints
  namespace: monitoring
spec:
  prober:
    url: blackbox-exporter.monitoring.svc:9115
    path: /probe
  module: https_2xx
  targets:
    staticConfig:
      labels:
        environment: production
      static:
        - app.velya.health
        - api.velya.health
        - auth.velya.health
        - grafana.velya.health
        - status.velya.health
  interval: 60s
  scrapeTimeout: 15s
```

---

## 7. Notificacoes

### 7.1 Rotas do Alertmanager

```yaml
# alertmanager config (parcial)
route:
  receiver: default
  routes:
    - match:
        alertname: CertExpiring1Day
      receiver: pager-critical
      repeat_interval: 30m

    - match:
        alertname: CertExpiring7Days
      receiver: pager-critical
      repeat_interval: 2h

    - match:
        alertname: CertExpiring14Days
      receiver: slack-platform-critical
      repeat_interval: 4h

    - match:
        alertname: CertExpiring30Days
      receiver: slack-platform-warning
      repeat_interval: 24h

    - match_re:
        alertname: 'CertManager.*|StepCA.*'
      receiver: slack-platform-critical
      repeat_interval: 1h

    - match_re:
        alertname: 'ACME.*|ExternalDNS.*'
      receiver: slack-platform-warning
      repeat_interval: 2h
```

---

## 8. Metricas Customizadas

### 8.1 Recording Rules

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: certificate-recording-rules
  namespace: monitoring
spec:
  groups:
    - name: certificate-recording
      interval: 60s
      rules:
        # Dias ate expiracao (mais facil de usar em dashboards)
        - record: velya:certificate:days_until_expiry
          expr: |
            (certmanager_certificate_expiration_timestamp_seconds - time()) / 86400

        # Total de certificados por status
        - record: velya:certificate:total_ready
          expr: |
            count(certmanager_certificate_ready_status{condition="Ready"} == 1)

        - record: velya:certificate:total_not_ready
          expr: |
            count(certmanager_certificate_ready_status{condition="Ready"} == 0)

        # Menor tempo ate expiracao (por namespace)
        - record: velya:certificate:min_days_until_expiry_by_namespace
          expr: |
            min by (exported_namespace) (
              (certmanager_certificate_expiration_timestamp_seconds - time()) / 86400
            )
```

---

## 9. Checklist de Implementacao

- [ ] ServiceMonitor cert-manager configurado
- [ ] ServiceMonitor step-ca configurado
- [ ] ServiceMonitor ExternalDNS configurado
- [ ] PrometheusRule de alertas aplicado
- [ ] PrometheusRule de recording rules aplicado
- [ ] Dashboard Certificate Lifecycle importado no Grafana
- [ ] Dashboard ACME Challenge importado
- [ ] Dashboard DNS Automation importado
- [ ] Dashboard HTTPS Endpoint Health importado
- [ ] Dashboard Internal PKI Health importado
- [ ] Dashboard Expiry Risk importado
- [ ] Blackbox Exporter configurado para HTTPS probes
- [ ] Alertmanager routes configurados
- [ ] Teste de alerta realizado (simular expiracao)
- [ ] Notificacoes Slack/PagerDuty verificadas

---

## 10. Changelog

| Data       | Versao | Descricao                                   |
| ---------- | ------ | ------------------------------------------- |
| 2026-04-09 | 1.0    | Versao inicial do modelo de observabilidade |

---

_Documento mantido pelo Platform Team e SRE Team. Revisao trimestral obrigatoria._
