# Deteccao de Acesso Anomalo

**Modulo:** Velya Access Control - Anomalous Access Detection  
**Versao:** 1.0.0  
**Data:** 2026-04-08  
**Classificacao:** Interno - Seguranca  
**Responsavel:** Time de Plataforma Velya

---

## 1. Visao Geral

O sistema de deteccao de acesso anomalo do Velya monitora continuamente padroes de uso para identificar comportamentos que possam indicar:

- Acesso indevido a dados de pacientes
- Violacao de politica de privacidade
- Comprometimento de credenciais
- Curiosidade indevida (snooping)
- Exfiltracao de dados
- Uso abusivo de privilegios

A deteccao combina regras estaticas (thresholds fixos) com analise comportamental (baselines por perfil profissional) para minimizar falsos positivos sem comprometer a seguranca.

---

## 2. Padroes Detectados

### 2.1 Catalogo Completo de Padroes

| #   | Padrao                                    | Codigo     | Severidade | Categoria       |
| --- | ----------------------------------------- | ---------- | ---------- | --------------- |
| 1   | Acesso fora da unidade atribuida          | `ANOM-001` | Media      | Contexto        |
| 2   | Acesso fora do turno de trabalho          | `ANOM-002` | Media      | Temporal        |
| 3   | Volume anormal de prontuarios             | `ANOM-003` | Alta       | Volume          |
| 4   | Acesso VIP sem vinculo assistencial       | `ANOM-004` | Critica    | Privacidade     |
| 5   | Troca rapida excessiva de usuario         | `ANOM-005` | Media      | Comportamento   |
| 6   | Exportacao/impressao acima do limiar      | `ANOM-006` | Alta       | Exfiltracao     |
| 7   | Break-glass frequente                     | `ANOM-007` | Alta       | Privilegio      |
| 8   | Acesso a prontuario proprio/familiar      | `ANOM-008` | Critica    | Privacidade     |
| 9   | Acesso apos mudanca de papel/desligamento | `ANOM-009` | Critica    | Acesso Indevido |
| 10  | Acesso massivo sequencial                 | `ANOM-010` | Alta       | Exfiltracao     |
| 11  | Padrao de navegacao atipico               | `ANOM-011` | Baixa      | Comportamento   |
| 12  | Acesso simultaneo de locais diferentes    | `ANOM-012` | Critica    | Credencial      |

---

## 3. Detalhamento por Padrao

### 3.1 ANOM-001: Acesso Fora da Unidade Atribuida

**Descricao:** Usuario acessa prontuarios de pacientes internados em unidade diferente daquela a que esta atribuido, sem vinculo assistencial registrado.

**Thresholds:**

| Perfil              | Threshold                | Baseline                     |
| ------------------- | ------------------------ | ---------------------------- |
| Medico especialista | 5 acessos cross-unit/dia | Normal: 1-2 (interconsultas) |
| Enfermeiro          | 2 acessos cross-unit/dia | Normal: 0-1 (transferencias) |
| Tecnico enfermagem  | 1 acesso cross-unit/dia  | Normal: 0                    |
| Nao-clinico         | 0 acessos cross-unit/dia | Normal: 0                    |

**Metodo de Deteccao (PromQL):**

```promql
# Acessos fora da unidade atribuida por usuario
sum by (user_id, user_name, unit, target_unit) (
  increase(velya_chart_access_total{
    access_type="cross_unit"
  }[24h])
) > 5
```

**Acao de Resposta:**

1. Registrar evento `ANOMALY_DETECTED` com codigo `ANOM-001`.
2. Se perfil nao-clinico: bloquear acesso imediatamente.
3. Se perfil clinico: permitir com alerta ao gestor da unidade de destino.
4. Incluir na revisao trimestral do usuario.

**Mitigacao de Falso Positivo:**

- Verificar se existe interconsulta registrada.
- Verificar se paciente foi transferido recentemente (< 24h).
- Verificar se usuario faz parte de equipe multiprofissional itinerante.
- Verificar se existe ordem de servico cross-unit.

---

### 3.2 ANOM-002: Acesso Fora do Turno de Trabalho

**Descricao:** Usuario acessa o sistema fora do horario do turno de trabalho registrado no RH.

**Thresholds:**

| Condicao                                       | Threshold      | Acao                |
| ---------------------------------------------- | -------------- | ------------------- |
| Ate 30 min antes/depois do turno               | Tolerancia     | Apenas log          |
| 30 min a 2h fora do turno                      | Alerta baixo   | Notificar gestor    |
| Mais de 2h fora do turno                       | Alerta alto    | Notificar seguranca |
| Acesso entre 00:00 e 05:00 (sem turno noturno) | Alerta critico | Step-up obrigatorio |

**Metodo de Deteccao (PromQL):**

```promql
# Acessos fora do turno de trabalho
velya_session_active{} == 1
  and on(user_id) velya_user_shift_active{} == 0
  unless on(user_id) velya_user_shift_tolerance{} == 1
```

**Acao de Resposta:**

1. Se dentro da tolerancia: apenas log.
2. Se fora da tolerancia: exigir step-up L2 + justificativa.
3. Se madrugada sem turno noturno: notificar seguranca imediatamente.
4. Gerar relatorio semanal de acessos fora do turno por unidade.

**Mitigacao de Falso Positivo:**

- Verificar trocas de turno registradas no RH.
- Verificar horas extras autorizadas.
- Verificar plantoes adicionais.
- Medicos frequentemente acessam fora do turno (baseline diferenciado).

---

### 3.3 ANOM-003: Volume Anormal de Prontuarios Acessados

**Descricao:** Usuario acessa numero de prontuarios significativamente acima do padrao para sua profissao e funcao.

**Thresholds:**

| Perfil                        | Normal/Hora | Alerta (warn) | Alerta (critical) |
| ----------------------------- | ----------- | ------------- | ----------------- |
| Medico intensivista           | 8-12        | > 20          | > 30              |
| Enfermeiro                    | 6-10        | > 20          | > 30              |
| Tecnico enfermagem            | 5-8         | > 15          | > 25              |
| Medico ambulatorial           | 4-8         | > 15          | > 25              |
| Administrativo                | 2-5         | > 10          | > 15              |
| Nao-clinico (TI, faturamento) | 0-2         | > 5           | > 10              |

**Metodo de Deteccao (PromQL):**

```promql
# Volume de acessos a prontuario por hora - enfermeiros
rate(velya_chart_access_total{
  profession="enfermeiro"
}[1h]) by (user_id, user_name) > 20

# Volume de acessos a prontuario por hora - nao-clinico
rate(velya_chart_access_total{
  profession=~"administrador|ti|recepcao|faturamento"
}[1h]) by (user_id, user_name) > 10

# Deteccao baseada em desvio padrao (z-score > 3)
(
  rate(velya_chart_access_total[1h]) by (user_id)
  - avg_over_time(rate(velya_chart_access_total[1h])[30d:1h]) by (user_id)
)
/ stddev_over_time(rate(velya_chart_access_total[1h])[30d:1h]) by (user_id)
> 3
```

**Acao de Resposta:**

1. Alerta warn: notificar gestor + registrar para revisao.
2. Alerta critical: notificar seguranca + exigir justificativa.
3. Se nao-clinico acima de 10/hora: suspender sessao + investigar.
4. Gerar relatorio de top 10 usuarios por volume diario.

**Mitigacao de Falso Positivo:**

- Calcular baseline individual por usuario (ultimos 30 dias).
- Considerar eventos especiais (surto, emergencia em massa).
- Verificar se usuario esta em treinamento/simulacao.
- Verificar se e periodo de recenseamento/auditoria interna.

---

### 3.4 ANOM-004: Acesso VIP sem Vinculo Assistencial

**Descricao:** Usuario acessa prontuario de paciente marcado como VIP (celebridade, autoridade, funcionario do hospital) sem vinculo assistencial registrado.

**Thresholds:**

| Condicao                        | Acao                                      |
| ------------------------------- | ----------------------------------------- |
| Qualquer acesso VIP sem vinculo | Alerta critico imediato                   |
| Vinculo existente               | Acesso permitido com log especial         |
| Break-glass para VIP            | L3 + justificativa + notificacao imediata |

**Metodo de Deteccao (LogQL):**

```logql
# Acessos a prontuarios VIP sem vinculo assistencial
{namespace="velya-audit"}
  | json
  | event_type="CHART_OPEN"
  | data_classification="E"
  | __error__=""
  | label_format care_relationship="{{ .metadata_care_relationship }}"
  | care_relationship=""
```

**Acao de Resposta:**

1. Bloquear acesso imediatamente (a menos que break-glass).
2. Notificar equipe de seguranca e compliance.
3. Registrar incidente automaticamente.
4. Se break-glass: permitir mas exigir L3 + justificativa de 100+ caracteres.
5. Notificar o DPO em ate 1 hora.

**Mitigacao de Falso Positivo:**

- Verificar se vinculo foi criado recentemente (< 1h) - pode haver atraso de propagacao.
- Verificar se existe solicitacao de interconsulta pendente.
- Verificar se paciente esta em setor de emergencia (acessos mais amplos).

---

### 3.5 ANOM-005: Troca Rapida Excessiva de Usuario

**Descricao:** Uma estacao de trabalho apresenta trocas de usuario em frequencia anormalmente alta, podendo indicar compartilhamento de credenciais ou tentativa de evadir auditoria.

**Thresholds:**

| Condicao                           | Threshold             | Acao            |
| ---------------------------------- | --------------------- | --------------- |
| Normal (posto de enfermagem)       | 2-4 trocas/hora       | Nenhuma         |
| Elevado                            | 5-8 trocas/hora       | Alerta warn     |
| Excessivo                          | > 8 trocas/hora       | Alerta critical |
| Mesmo usuario voltando rapidamente | Ida e volta em < 2min | Investigar      |

**Metodo de Deteccao (PromQL):**

```promql
# Taxa de troca de usuario por estacao de trabalho
rate(velya_user_switch_total[1h]) by (workstation_id) > 5

# Trocas rapidas (ida e volta em menos de 2 minutos)
increase(velya_user_switch_rapid_total{
  switch_duration_seconds="<120"
}[1h]) by (workstation_id) > 2
```

**Acao de Resposta:**

1. Warn: notificar gestor da unidade.
2. Critical: enviar equipe de seguranca para verificar estacao.
3. Se mesmo usuario faz ida e volta rapida: investigar compartilhamento de credenciais.

**Mitigacao de Falso Positivo:**

- Verificar se estacao esta em area de alta rotatividade (triagem, emergencia).
- Verificar se ha treinamento em andamento na unidade.
- Considerar troca de turno (pico natural de trocas).

---

### 3.6 ANOM-006: Exportacao/Impressao Acima do Limiar

**Descricao:** Usuario exporta ou imprime dados de pacientes em volume acima do normal.

**Thresholds:**

| Tipo                                 | Normal/Dia | Alerta (warn) | Alerta (critical) |
| ------------------------------------ | ---------- | ------------- | ----------------- |
| Impressao de prontuario              | 1-3        | > 5           | > 10              |
| Exportacao CSV/Excel                 | 0          | > 1           | > 3               |
| Exportacao PDF (prontuario completo) | 0-1        | > 2           | > 5               |
| Download de imagem/exame             | 2-5        | > 10          | > 20              |

**Metodo de Deteccao (PromQL):**

```promql
# Exportacoes por usuario por dia
increase(velya_data_export_total[24h]) by (user_id, format) > 3

# Impressoes por usuario por dia
increase(velya_data_print_total[24h]) by (user_id) > 5

# Volume de dados exportados (bytes)
increase(velya_data_export_bytes_total[24h]) by (user_id) > 10485760  # > 10MB
```

**Acao de Resposta:**

1. Warn: exigir justificativa para proxima exportacao.
2. Critical: bloquear exportacoes + notificar DPO.
3. Se exportacao > 10MB: alerta DLP imediato.
4. Incluir em revisao de acesso ad-hoc.

---

### 3.7 ANOM-007: Break-Glass Frequente

**Descricao:** Usuario utiliza break-glass com frequencia acima do esperado, podendo indicar que o modelo de permissoes nao atende a necessidade real ou que o usuario esta abusando do mecanismo.

**Thresholds:**

| Condicao  | Threshold | Acao                                             |
| --------- | --------- | ------------------------------------------------ |
| Normal    | 0-1/mes   | Revisao pos-uso padrao                           |
| Elevado   | 2/mes     | Alerta + revisao de permissoes                   |
| Excessivo | > 2/mes   | Alerta + suspensao de break-glass + investigacao |

**Metodo de Deteccao (PromQL):**

```promql
# Break-glass por usuario por mes
increase(velya_break_glass_total[30d]) by (user_id, user_name) > 2

# Break-glass para mesmo paciente (possivel curiosidade)
count by (user_id, patient_id) (
  velya_break_glass_events{} offset 30d
) > 1
```

**Acao de Resposta:**

1. 2/mes: revisar se usuario precisa de acesso permanente ao recurso.
2. > 2/mes: suspender capacidade de break-glass ate revisao.
3. Break-glass para mesmo paciente repetidamente: investigar curiosidade indevida.
4. Ajustar modelo RBAC se break-glass recorrente para mesma situacao.

---

### 3.8 ANOM-008: Acesso a Prontuario Proprio ou de Familiar

**Descricao:** Funcionario acessa seu proprio prontuario ou de familiar direto atraves do sistema clinico (em vez de usar o portal do paciente).

**Thresholds:**

| Condicao                                  | Acao                    |
| ----------------------------------------- | ----------------------- |
| Acesso ao proprio prontuario              | Alerta critico imediato |
| Acesso a prontuario de familiar (1o grau) | Alerta critico imediato |
| Acesso a prontuario de colega de trabalho | Alerta alto             |

**Metodo de Deteccao (LogQL):**

```logql
# Acesso a proprio prontuario
{namespace="velya-audit"}
  | json
  | event_type="CHART_OPEN"
  | user_id == patient_employee_id

# Acesso a familiar (requer join com tabela de parentesco)
{namespace="velya-audit"}
  | json
  | event_type="CHART_OPEN"
  | __error__=""
  | label_format is_family="{{ .metadata_is_family_member }}"
  | is_family="true"
```

**Acao de Resposta:**

1. Bloquear acesso (nao e permitido acessar proprio prontuario pelo sistema clinico).
2. Notificar compliance imediatamente.
3. Orientar usuario a usar o portal do paciente.
4. Se insistencia: investigacao formal.

**Mitigacao de Falso Positivo:**

- Verificar se o usuario e o medico assistente do familiar (conflito de interesse, mas possivel).
- Neste caso, exigir documentacao de consentimento e vinculo assistencial formal.

---

### 3.9 ANOM-009: Acesso Apos Mudanca de Papel ou Desligamento

**Descricao:** Usuario mantem acesso ou tenta acessar apos ter papel revogado, ser transferido ou desligado.

**Thresholds:**

| Condicao                                     | Acao                       |
| -------------------------------------------- | -------------------------- |
| Login apos desligamento                      | Bloqueio + alerta CRITICAL |
| Acesso a recurso de papel revogado           | Bloqueio + alerta          |
| Acesso a unidade anterior apos transferencia | Alerta warn                |

**Metodo de Deteccao (PromQL):**

```promql
# Tentativas de login de usuarios desativados
increase(velya_auth_attempt_total{
  user_status="deactivated"
}[24h]) > 0

# Tentativas de acesso com papel revogado
increase(velya_policy_denial_total{
  denial_reason="role_revoked"
}[24h]) by (user_id) > 0
```

**Acao de Resposta:**

1. Se desligado: investigar imediatamente (possivel credencial nao revogada).
2. Se papel revogado: verificar se revogacao foi corretamente propagada.
3. Se transferido: notificar gestor da unidade anterior.
4. Forçar invalidacao de todas as sessoes e tokens.

---

## 4. Regras de Alerta Prometheus

```yaml
# prometheus-anomaly-alerting-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-anomalous-access-alerts
  namespace: velya-observability
  labels:
    app: velya
    component: access-anomaly
spec:
  groups:
    - name: access_anomaly_context
      interval: 60s
      rules:
        - alert: CrossUnitAccessExcessive
          expr: |
            sum by (user_id, user_name, unit) (
              increase(velya_chart_access_total{access_type="cross_unit"}[24h])
            ) > 5
          for: 5m
          labels:
            severity: warning
            anomaly_code: 'ANOM-001'
          annotations:
            summary: 'Acesso excessivo fora da unidade por {{ $labels.user_name }}'
            description: '{{ $labels.user_name }} ({{ $labels.unit }}) fez {{ $value }} acessos cross-unit em 24h'
            runbook: 'https://runbooks.velya.internal/anom-001'

        - alert: OffShiftAccess
          expr: |
            velya_session_active == 1
            and on(user_id) velya_user_shift_active == 0
          for: 30m
          labels:
            severity: warning
            anomaly_code: 'ANOM-002'
          annotations:
            summary: 'Acesso fora do turno: {{ $labels.user_name }}'
            description: '{{ $labels.user_name }} esta com sessao ativa fora do turno registrado'

    - name: access_anomaly_volume
      interval: 60s
      rules:
        - alert: HighVolumeChartAccessClinical
          expr: |
            rate(velya_chart_access_total{
              profession=~"enfermeiro|tecnico_enfermagem"
            }[1h]) by (user_id, user_name) > 20
          for: 10m
          labels:
            severity: warning
            anomaly_code: 'ANOM-003'
          annotations:
            summary: 'Volume alto de acessos a prontuario: {{ $labels.user_name }}'
            description: '{{ $value }} acessos/hora (threshold: 20)'

        - alert: HighVolumeChartAccessNonClinical
          expr: |
            rate(velya_chart_access_total{
              profession=~"administrador|ti|recepcao|faturamento"
            }[1h]) by (user_id, user_name) > 10
          for: 5m
          labels:
            severity: critical
            anomaly_code: 'ANOM-003'
          annotations:
            summary: 'Volume critico de acessos por nao-clinico: {{ $labels.user_name }}'
            description: '{{ $value }} acessos/hora por profissional nao-clinico'

    - name: access_anomaly_privacy
      interval: 30s
      rules:
        - alert: VIPAccessWithoutCareRelationship
          expr: |
            increase(velya_vip_access_no_relationship_total[5m]) > 0
          for: 0m
          labels:
            severity: critical
            anomaly_code: 'ANOM-004'
          annotations:
            summary: 'Acesso VIP sem vinculo assistencial'
            description: '{{ $labels.user_name }} tentou acessar prontuario VIP sem vinculo'

        - alert: SelfRecordAccess
          expr: |
            increase(velya_self_record_access_total[5m]) > 0
          for: 0m
          labels:
            severity: critical
            anomaly_code: 'ANOM-008'
          annotations:
            summary: 'Acesso a prontuario proprio: {{ $labels.user_name }}'

        - alert: FamilyRecordAccess
          expr: |
            increase(velya_family_record_access_total[5m]) > 0
          for: 0m
          labels:
            severity: critical
            anomaly_code: 'ANOM-008'
          annotations:
            summary: 'Acesso a prontuario de familiar: {{ $labels.user_name }}'

    - name: access_anomaly_behavior
      interval: 60s
      rules:
        - alert: RapidUserSwitching
          expr: |
            rate(velya_user_switch_total[1h]) by (workstation_id) > 5
          for: 15m
          labels:
            severity: warning
            anomaly_code: 'ANOM-005'
          annotations:
            summary: 'Troca rapida excessiva na estacao {{ $labels.workstation_id }}'

        - alert: ExcessiveExport
          expr: |
            increase(velya_data_export_total[24h]) by (user_id, user_name) > 3
          for: 5m
          labels:
            severity: critical
            anomaly_code: 'ANOM-006'
          annotations:
            summary: 'Exportacao excessiva por {{ $labels.user_name }}'

        - alert: FrequentBreakGlass
          expr: |
            increase(velya_break_glass_total[30d]) by (user_id, user_name) > 2
          for: 5m
          labels:
            severity: warning
            anomaly_code: 'ANOM-007'
          annotations:
            summary: 'Break-glass frequente: {{ $labels.user_name }}'

    - name: access_anomaly_critical
      interval: 30s
      rules:
        - alert: AccessAfterTermination
          expr: |
            increase(velya_auth_attempt_total{user_status="deactivated"}[1h]) > 0
          for: 0m
          labels:
            severity: critical
            anomaly_code: 'ANOM-009'
          annotations:
            summary: 'Tentativa de acesso de usuario desligado: {{ $labels.user_id }}'

        - alert: SimultaneousMultiLocationAccess
          expr: |
            count by (user_id) (velya_session_active == 1) > 1
          for: 1m
          labels:
            severity: critical
            anomaly_code: 'ANOM-012'
          annotations:
            summary: 'Sessoes simultaneas em locais diferentes: {{ $labels.user_id }}'
```

---

## 5. Dashboard Grafana

```json
{
  "dashboard": {
    "id": null,
    "uid": "velya-anomaly-detection",
    "title": "Velya - Deteccao de Acesso Anomalo",
    "tags": ["velya", "security", "anomaly"],
    "timezone": "America/Sao_Paulo",
    "refresh": "30s",
    "time": {
      "from": "now-24h",
      "to": "now"
    },
    "panels": [
      {
        "id": 1,
        "title": "Alertas Ativos por Severidade",
        "type": "stat",
        "gridPos": { "h": 4, "w": 24, "x": 0, "y": 0 },
        "targets": [
          {
            "expr": "count(ALERTS{alertstate='firing', severity='critical', anomaly_code=~'ANOM-.*'}) or vector(0)",
            "legendFormat": "Critico"
          },
          {
            "expr": "count(ALERTS{alertstate='firing', severity='warning', anomaly_code=~'ANOM-.*'}) or vector(0)",
            "legendFormat": "Aviso"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 1 },
                { "color": "red", "value": 3 }
              ]
            }
          }
        }
      },
      {
        "id": 2,
        "title": "Volume de Acesso a Prontuario por Perfil (Hora)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 4 },
        "targets": [
          {
            "expr": "avg by (profession) (rate(velya_chart_access_total[1h]))",
            "legendFormat": "{{ profession }}"
          }
        ]
      },
      {
        "id": 3,
        "title": "Acessos Cross-Unit (24h)",
        "type": "bargauge",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 4 },
        "targets": [
          {
            "expr": "topk(10, sum by (user_name, unit) (increase(velya_chart_access_total{access_type='cross_unit'}[24h])))",
            "legendFormat": "{{ user_name }} ({{ unit }})"
          }
        ]
      },
      {
        "id": 4,
        "title": "Trocas de Usuario por Estacao (Hora)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 12 },
        "targets": [
          {
            "expr": "topk(5, rate(velya_user_switch_total[1h]) by (workstation_id))",
            "legendFormat": "{{ workstation_id }}"
          }
        ]
      },
      {
        "id": 5,
        "title": "Exportacoes e Impressoes (24h)",
        "type": "table",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 12 },
        "targets": [
          {
            "expr": "sum by (user_name, format) (increase(velya_data_export_total[24h])) > 0",
            "legendFormat": "{{ user_name }} - {{ format }}",
            "format": "table",
            "instant": true
          }
        ]
      },
      {
        "id": 6,
        "title": "Break-Glass nos Ultimos 30 Dias",
        "type": "table",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 20 },
        "targets": [
          {
            "expr": "sum by (user_name) (increase(velya_break_glass_total[30d])) > 0",
            "format": "table",
            "instant": true
          }
        ]
      },
      {
        "id": 7,
        "title": "Acessos Fora do Turno (24h)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 20 },
        "targets": [
          {
            "expr": "sum by (unit) (increase(velya_off_shift_access_total[1h]))",
            "legendFormat": "{{ unit }}"
          }
        ]
      },
      {
        "id": 8,
        "title": "Mapa de Calor: Acessos por Hora x Dia da Semana",
        "type": "heatmap",
        "gridPos": { "h": 8, "w": 24, "x": 0, "y": 28 },
        "targets": [
          {
            "expr": "sum(increase(velya_chart_access_total[1h])) by (le)",
            "legendFormat": "{{ le }}"
          }
        ]
      },
      {
        "id": 9,
        "title": "Tentativas de Acesso de Usuarios Desativados",
        "type": "table",
        "gridPos": { "h": 6, "w": 24, "x": 0, "y": 36 },
        "targets": [
          {
            "expr": "increase(velya_auth_attempt_total{user_status='deactivated'}[24h]) > 0",
            "format": "table",
            "instant": true
          }
        ]
      },
      {
        "id": 10,
        "title": "Acessos VIP sem Vinculo",
        "type": "table",
        "gridPos": { "h": 6, "w": 24, "x": 0, "y": 42 },
        "targets": [
          {
            "expr": "increase(velya_vip_access_no_relationship_total[24h]) > 0",
            "format": "table",
            "instant": true
          }
        ]
      }
    ]
  }
}
```

---

## 6. Pipeline de Deteccao

### 6.1 Arquitetura do Pipeline

```
Audit Log          Stream          Regras            Alertas         Acoes
(Kafka)         Processor        Engine           Manager        Automaticas
   |                |               |                |               |
   |--[eventos]---->|               |                |               |
   |                |--[enriquecer  |                |               |
   |                |  com contexto]|                |               |
   |                |               |                |               |
   |                |--[avaliar     |                |               |
   |                |  regras]----->|                |               |
   |                |               |--[match?]      |               |
   |                |               |  Sim           |               |
   |                |               |--[criar        |               |
   |                |               |  alerta]------>|               |
   |                |               |                |--[severidade? |
   |                |               |                |  Critical?]   |
   |                |               |                |  Sim          |
   |                |               |                |--[acao]------>|
   |                |               |                |               |--[bloquear/
   |                |               |                |               |  notificar/
   |                |               |                |               |  suspender]
   |                |               |                |               |
   |                |--[atualizar   |                |               |
   |                |  metricas]--->Prometheus        |               |
   |                |               |                |               |
   |                |--[baseline    |                |               |
   |                |  update]      |                |               |
   |                |  (diario)     |                |               |
```

### 6.2 Configuracao do Pipeline

```yaml
# anomaly-detection-pipeline.yaml
pipeline:
  source:
    topic: 'velya.audit.events'
    consumer_group: 'anomaly-detection'

  enrichment:
    - type: user_context
      source: user_directory
      fields: [profession, unit, shift, role]
    - type: patient_context
      source: patient_registry
      fields: [unit, vip_flag, care_team]
    - type: relationship_check
      source: care_relationship_db
      fields: [has_relationship, relationship_type]
    - type: family_check
      source: hr_family_registry
      fields: [is_family_member, relationship_degree]

  rules:
    evaluation_interval: '1s'
    baseline_update_interval: '24h'
    baseline_lookback: '30d'

  actions:
    - severity: critical
      actions:
        - type: block_session
          immediate: true
        - type: notify
          channels: [slack_security, email_ciso, sms_oncall]
          immediate: true
        - type: create_incident
          system: servicenow
          priority: P1
    - severity: warning
      actions:
        - type: notify
          channels: [slack_security, email_manager]
          batch_interval: 15m
        - type: flag_for_review
          review_type: ad_hoc
```

---

## 7. Resposta a Incidentes de Anomalia

### 7.1 Matriz de Resposta

| Severidade | Tempo de Resposta | Responsavel              | Escalacao       |
| ---------- | ----------------- | ------------------------ | --------------- |
| Critica    | 15 minutos        | Security Analyst on-call | CISO em 30 min  |
| Alta       | 1 hora            | Security Team            | Manager em 4h   |
| Media      | 4 horas           | Security Team            | Revisao semanal |
| Baixa      | 24 horas          | Gestor da unidade        | Revisao mensal  |

### 7.2 Procedimento de Investigacao

| Etapa | Acao                                   | Responsavel        | Evidencia            |
| ----- | -------------------------------------- | ------------------ | -------------------- |
| 1     | Confirmar alerta (falso positivo?)     | Security Analyst   | Log de investigacao  |
| 2     | Preservar evidencias (logs, gravacoes) | Security Analyst   | Snapshot de dados    |
| 3     | Entrevistar usuario (se aplicavel)     | Gestor + Seguranca | Ata de entrevista    |
| 4     | Determinar impacto                     | Security Analyst   | Relatorio de impacto |
| 5     | Aplicar medida corretiva               | Security Manager   | Ordem de servico     |
| 6     | Documentar incidente                   | Compliance         | Relatorio final      |
| 7     | Implementar prevencao                  | Engineering        | Change request       |

---

_Documento gerado para a plataforma Velya. Uso interno - Seguranca e Compliance._
