# Roteamento de Notificações — Velya Platform

> Define como alertas chegam às pessoas certas, no canal certo, na hora certa.
> Alertas que não chegam a ninguém são pior do que não ter alertas.
> Última atualização: 2026-04-08

---

## 1. Arquitetura de Alerting

```
PrometheusRules (alertas avaliados)
        │
        ▼
Prometheus → (envia alertas ativos para)
        │
        ▼
Alertmanager
        │
        ▼ (Notification Policies — roteamento)
   ┌────┴────────────────────────────┐
   │                                 │
   ▼                                 ▼
Grafana Alerting            Prometheus Alertmanager
(dashboards visuais)          (notificações externas)
        │
        ├── Slack (3 canais)
        ├── PagerDuty
        ├── Email
        └── Webhook (futuro)
```

**Nota**: A Velya usa tanto PrometheusRules (avaliadas pelo Prometheus/Thanos Ruler) quanto Grafana Managed Alerts. Ambas passam pelo Alertmanager ou pelo Grafana Alerting para roteamento.

---

## 2. Contact Points

### 2.1 Configuração dos Contact Points

```yaml
# infra/observability/grafana/provisioning/alerting/contact-points.yaml
apiVersion: 1

contactPoints:
  # Canal crítico — incidentes de segurança do paciente e falhas catastróficas
  - orgId: 1
    name: velya-slack-critical
    receivers:
      - uid: velya-slack-critical-uid
        type: slack
        settings:
          url: '${SLACK_WEBHOOK_CRITICAL}' # Secret via ExternalSecret
          channel: '#velya-ops-critical'
          title: '{{ template "velya.slack.title" . }}'
          text: '{{ template "velya.slack.critical.message" . }}'
          iconEmoji: ':rotating_light:'
          sendResolved: true
          mentionGroups: '@velya-oncall' # Pinga o grupo de plantão

  # Canal alto — impacto em operação clínica, não urgência de segurança
  - orgId: 1
    name: velya-slack-high
    receivers:
      - uid: velya-slack-high-uid
        type: slack
        settings:
          url: '${SLACK_WEBHOOK_HIGH}'
          channel: '#velya-ops-high'
          title: '{{ template "velya.slack.title" . }}'
          text: '{{ template "velya.slack.high.message" . }}'
          iconEmoji: ':warning:'
          sendResolved: true

  # Canal informativo — degradação de qualidade, indicadores preventivos
  - orgId: 1
    name: velya-slack-info
    receivers:
      - uid: velya-slack-info-uid
        type: slack
        settings:
          url: '${SLACK_WEBHOOK_INFO}'
          channel: '#velya-ops-info'
          title: '{{ template "velya.slack.title" . }}'
          text: '{{ template "velya.slack.info.message" . }}'
          iconEmoji: ':information_source:'
          sendResolved: true

  # PagerDuty — apenas para alertas críticos com impacto em pacientes
  - orgId: 1
    name: velya-pagerduty
    receivers:
      - uid: velya-pagerduty-uid
        type: pagerduty
        settings:
          integrationKey: '${PAGERDUTY_INTEGRATION_KEY}' # Secret via ExternalSecret
          severity: '{{ .CommonLabels.severity }}'
          description: '{{ .CommonAnnotations.summary }}'
          details:
            service: '{{ .CommonLabels.service }}'
            namespace: '{{ .CommonLabels.namespace }}'
            impact: '{{ .CommonAnnotations.impact }}'
            runbook: '{{ .CommonAnnotations.runbook_url }}'
          sendResolved: true

  # Email — relatórios diários e escalação de alertas não reconhecidos
  - orgId: 1
    name: velya-email-daily
    receivers:
      - uid: velya-email-daily-uid
        type: email
        settings:
          addresses: 'ops@velya.com.br;security@velya.com.br'
          subject: '{{ template "velya.email.subject" . }}'
          message: '{{ template "velya.email.daily.message" . }}'
          singleEmail: true # Um email por grupo de alertas

  # Webhook — integração futura com sistema de tickets
  - orgId: 1
    name: velya-webhook-tickets
    receivers:
      - uid: velya-webhook-tickets-uid
        type: webhook
        settings:
          url: '${TICKET_SYSTEM_WEBHOOK_URL}'
          httpMethod: POST
          authorizationScheme: Bearer
          authorizationCredentials: '${TICKET_SYSTEM_TOKEN}'
        disableResolveMessage: false
```

---

## 3. Notification Policies (Árvore de Roteamento)

```yaml
# infra/observability/grafana/provisioning/alerting/notification-policies.yaml
apiVersion: 1

policies:
  - orgId: 1
    receiver: velya-slack-info # Default receiver
    group_by: [alertname, service, namespace]
    group_wait: 30s # Aguardar outros alertas do mesmo grupo por 30s antes de enviar
    group_interval: 5m # Re-agrupar a cada 5 minutos
    repeat_interval: 4h # Re-notificar se alerta ainda ativo após 4 horas

    routes:
      # Alertas críticos de domínio clínico → PagerDuty + Slack critical
      - receiver: velya-pagerduty
        group_by: [alertname, service]
        group_wait: 0s # Crítico clínico: sem espera
        matchers:
          - severity = critical
          - domain = clinical
        routes:
          - receiver: velya-slack-critical
            continue: true # Também envia para Slack critical

      # Alertas críticos de segurança → PagerDuty + Slack critical + Email CISO
      - receiver: velya-pagerduty
        group_by: [alertname]
        group_wait: 0s
        matchers:
          - severity = critical
          - domain = security
        routes:
          - receiver: velya-slack-critical
            continue: true
          - receiver: velya-email-daily
            continue: true

      # Demais alertas críticos → PagerDuty + Slack critical
      - receiver: velya-pagerduty
        group_by: [alertname, service]
        group_wait: 30s
        matchers:
          - severity = critical
        routes:
          - receiver: velya-slack-critical
            continue: true

      # Alertas altos → Slack high
      - receiver: velya-slack-high
        group_by: [alertname, service, namespace]
        group_wait: 1m
        group_interval: 10m
        repeat_interval: 2h
        matchers:
          - severity = high

      # Alertas médios → Slack info
      - receiver: velya-slack-info
        group_by: [alertname, service]
        group_wait: 5m
        group_interval: 30m
        repeat_interval: 8h
        matchers:
          - severity = medium

      # Alertas baixos → Slack info (sem repeat)
      - receiver: velya-slack-info
        group_by: [alertname]
        group_wait: 10m
        group_interval: 1h
        repeat_interval: 24h
        matchers:
          - severity = low
```

---

## 4. Mute Timings

```yaml
# infra/observability/grafana/provisioning/alerting/mute-timings.yaml
apiVersion: 1

muteTimes:
  # Manutenção programada — apenas infraestrutura e plataforma
  - orgId: 1
    name: manutencao-domingo-madrugada
    time_intervals:
      - weekdays: ['sunday']
        times:
          - start_time: '02:00'
            end_time: '06:00'
    # APLICAR APENAS em alertas de domínio infrastructure e platform
    # NUNCA aplicar em domínios: clinical, agents, security, backend

  # Janela de deploy planejada
  - orgId: 1
    name: deploy-janela-planejada
    time_intervals:
      - weekdays: ['tuesday', 'thursday']
        times:
          - start_time: '21:00'
            end_time: '23:00'
    # Aplicar apenas em alertas de domínio backend e frontend durante deploys planejados

  # Regra absoluta: alertas clínicos NUNCA entram em Mute Timing
  # Os mute timings acima são aplicados seletivamente via matchers
  # Alertas com domain=clinical são explicitamente excluídos de todos os mute timings
```

**Aplicação dos Mute Timings nas Notification Policies**:

```yaml
# Adicionar mute_time_intervals nas policies de infra e plataforma
- receiver: velya-slack-info
  matchers:
    - severity = medium
    - domain =~ "infrastructure|platform"
  mute_time_intervals:
    - manutencao-domingo-madrugada
    - deploy-janela-planejada
```

---

## 5. Templates de Notificação

### 5.1 Template Slack — Crítico

```yaml
# infra/observability/grafana/provisioning/alerting/templates/velya-slack-templates.yaml
apiVersion: 1

templates:
  - orgId: 1
    name: velya-slack-templates
    template: |
      {{ define "velya.slack.title" }}
      [{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ end }}]
      {{ .CommonLabels.alertname }}
      {{ end }}

      {{ define "velya.slack.critical.message" }}
      *:rotating_light: CRÍTICO — {{ .CommonLabels.alertname }}*

      *Serviço*: `{{ .CommonLabels.service | default "N/A" }}`
      *Namespace*: `{{ .CommonLabels.namespace | default "N/A" }}`
      *Domínio*: `{{ .CommonLabels.domain | default "N/A" }}`
      *Ambiente*: `{{ .CommonLabels.environment | default "N/A" }}`

      *Impacto*:
      {{ .CommonAnnotations.impact | default "Impacto não especificado" }}

      *Início*: {{ .CommonAnnotations.startsAt | default "N/A" }}

      *Ação inicial*:
      {{ .CommonAnnotations.initial_action | default "Ver runbook abaixo" }}

      {{ if .CommonAnnotations.dashboard_url }}
      :grafana: <{{ .CommonAnnotations.dashboard_url }}|Ver Dashboard>
      {{ end }}
      {{ if .CommonAnnotations.runbook_url }}
      :book: <{{ .CommonAnnotations.runbook_url }}|Runbook>
      {{ end }}

      {{ if .Alerts.Firing }}
      *Alertas ativos ({{ .Alerts.Firing | len }})*:
      {{ range .Alerts.Firing }}
      • `{{ .Labels.alertname }}` — {{ .Annotations.summary }}
      {{ end }}
      {{ end }}
      {{ end }}

      {{ define "velya.slack.high.message" }}
      *:warning: ALTO — {{ .CommonLabels.alertname }}*

      *Serviço*: `{{ .CommonLabels.service | default "N/A" }}`
      *Namespace*: `{{ .CommonLabels.namespace | default "N/A" }}`

      {{ .CommonAnnotations.summary | default "Sem descrição" }}

      *Impacto*: {{ .CommonAnnotations.impact | default "N/A" }}

      {{ if .CommonAnnotations.dashboard_url }}
      <{{ .CommonAnnotations.dashboard_url }}|Dashboard> | {{ end }}
      {{ if .CommonAnnotations.runbook_url }}
      <{{ .CommonAnnotations.runbook_url }}|Runbook>{{ end }}
      {{ end }}

      {{ define "velya.slack.info.message" }}
      *:information_source: {{ .Status | title }} — {{ .CommonLabels.alertname }}*

      {{ .CommonAnnotations.summary | default "Sem descrição" }}
      Serviço: `{{ .CommonLabels.service | default "N/A" }}` | Severidade: `{{ .CommonLabels.severity }}`

      {{ if .CommonAnnotations.runbook_url }}
      <{{ .CommonAnnotations.runbook_url }}|Runbook>{{ end }}
      {{ end }}

      {{ define "velya.email.subject" }}
      [{{ .Status | toUpper }}] {{ .CommonLabels.alertname }} — Velya Platform
      {{ end }}
```

### 5.2 Exemplo de Mensagem Real no Slack (renderizado)

**Canal #velya-ops-critical**:

```
:rotating_light: CRÍTICO — VelyaAgentSilentCritical

Serviço: discharge-coordinator-agent
Namespace: velya-dev-agents
Domínio: agents
Ambiente: dev

Impacto:
Agent completamente parado. Tarefas do office clinical-office não estão sendo processadas.

Início: 14:32:01

Ação inicial:
Verificar se o Temporal worker está rodando:
kubectl get pods -n velya-dev-agents | grep discharge-coordinator
Se não estiver rodando: kubectl rollout restart deploy/discharge-coordinator-worker

:grafana: Ver Dashboard | :book: Runbook

Alertas ativos (1):
• VelyaAgentSilentCritical — Agent discharge-coordinator-agent silencioso por mais de 60 minutos
```

---

## 6. Escalação Automática

### 6.1 Alerta Crítico Não Reconhecido em 15 Minutos

```yaml
# Configuração de repeat com escalação no Alertmanager
- receiver: velya-pagerduty
  group_wait: 0s
  repeat_interval: 15m # Re-notifica a cada 15 min se não resolvido
  matchers:
    - severity = critical
```

**PagerDuty** já tem política de escalação automática configurada:

- 0-15 min: engenheiro de plantão
- 15-30 min: tech lead notificado
- 30+ min: manager técnico notificado

### 6.2 Alerta Alto Não Reconhecido em 1 Hora

```yaml
- receiver: velya-slack-high
  group_wait: 1m
  repeat_interval: 1h # Re-notifica a cada hora se não resolvido
  matchers:
    - severity = high
```

### 6.3 Silences durante Escalação

**Regras para silences**:

- Silences devem ter comentário obrigatório: quem criou, por quê, qual o plano
- Duração máxima de silence: 4 horas (exceto manutenção programada)
- Silences em alertas clínicos requerem aprovação de pelo menos dois engenheiros
- Silences não podem ser criados para cobrir ausência de plano de resposta

---

## 7. Verificação de Configuração de Contact Points

```bash
#!/bin/bash
# Verificar que contact points estão configurados e funcionando

GRAFANA_URL="http://localhost:3000"
API_KEY="${GRAFANA_API_KEY}"

echo "=== Verificando Contact Points no Grafana ==="

# Listar contact points configurados
CONTACT_POINTS=$(curl -s "${GRAFANA_URL}/api/v1/provisioning/contact-points" \
  -H "Authorization: Bearer ${API_KEY}" | jq -r '.[].name')

REQUIRED_CONTACT_POINTS=(
  "velya-slack-critical"
  "velya-slack-high"
  "velya-slack-info"
  "velya-pagerduty"
  "velya-email-daily"
)

for cp in "${REQUIRED_CONTACT_POINTS[@]}"; do
  if echo "$CONTACT_POINTS" | grep -q "$cp"; then
    echo "OK: $cp configurado"
  else
    echo "FALHA: $cp NÃO configurado"
  fi
done

# Enviar alerta de teste para o canal info
echo ""
echo "=== Testando envio de notificação (canal info) ==="
curl -X POST "${GRAFANA_URL}/api/v1/alerts/test" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"receivers": [{"name": "velya-slack-info"}]}'
```

---

## 8. Estado Atual dos Contact Points

| Contact Point        | Estado              | Próxima ação                                            |
| -------------------- | ------------------- | ------------------------------------------------------- |
| velya-slack-critical | **NÃO configurado** | Criar Slack webhook + configurar ExternalSecret         |
| velya-slack-high     | **NÃO configurado** | Criar Slack webhook + configurar ExternalSecret         |
| velya-slack-info     | **NÃO configurado** | Criar Slack webhook + configurar ExternalSecret         |
| velya-pagerduty      | **NÃO configurado** | Criar service no PagerDuty + configurar integration key |
| velya-email-daily    | **NÃO configurado** | Configurar SMTP no Grafana                              |

**Impacto do estado atual**: Todos os alertas existentes (velya-service-alerts com 5 regras) disparam no Prometheus mas não chegam a ninguém. A stack de alerting existe mas é completamente inoperante.

**Ação prioritária**:

1. Criar canais Slack #velya-ops-critical, #velya-ops-high, #velya-ops-info
2. Configurar Slack apps e gerar webhooks
3. Armazenar webhooks em AWS Secrets Manager
4. Criar ExternalSecret para injetar como env vars no Grafana
5. Aplicar o YAML de contact-points.yaml via ArgoCD
6. Testar com alert de nível "info" (envio manual)
