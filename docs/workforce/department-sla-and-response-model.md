# Modelo de SLA e Tempo de Resposta por Departamento — Velya Platform

> Definicoes de SLA por departamento, metodos de medicao, limiares de alerta, regras de escalacao e paineis de dashboard.

---

## 1. Principio Fundamental

**Cada departamento tem SLAs claros, mensurados automaticamente, com alertas e escalacao. O descumprimento e visivel em tempo real.**

---

## 2. Definicoes de SLA por Departamento

### 2.1 Limpeza / Higienizacao

| Servico              | SLA Resposta | SLA Conclusao | Medicao                  | Alerta     | Escalacao            |
| -------------------- | ------------ | ------------- | ------------------------ | ---------- | -------------------- |
| Limpeza terminal     | 15 min       | 60 min        | acionamento -> liberacao | 75% do SLA | Supervisor hig.      |
| Limpeza concorrente  | 10 min       | 30 min        | acionamento -> liberacao | 75% do SLA | Supervisor hig.      |
| Limpeza imediata     | 5 min        | 15 min        | acionamento -> liberacao | 50% do SLA | Supervisor -> Coord. |
| Limpeza area critica | 10 min       | 45 min        | acionamento -> liberacao | 50% do SLA | Supervisor -> SCIH   |
| Desinfeccao          | 15 min       | 90 min        | acionamento -> liberacao | 75% do SLA | Supervisor           |

### 2.2 Transporte Interno

| Servico  | SLA Aceite | SLA Saida       | SLA Total  | Medicao                         | Alerta | Escalacao            |
| -------- | ---------- | --------------- | ---------- | ------------------------------- | ------ | -------------------- |
| Urgente  | 3 min      | 5 min           | 15 min     | acionamento -> entrega custodia | 50%    | Supervisor -> Coord. |
| Rotina   | 10 min     | 20 min          | 45 min     | acionamento -> entrega custodia | 75%    | Supervisor           |
| Agendado | N/A        | Conforme agenda | +/- 15 min | horario agendado -> entrega     | 100%   | Supervisor           |

### 2.3 Farmacia

| Servico                | SLA    | Medicao                                       | Alerta | Escalacao              |
| ---------------------- | ------ | --------------------------------------------- | ------ | ---------------------- |
| Dispensacao rotina     | 30 min | prescricao validada -> dispensacao            | 75%    | Farmaceutico -> Coord. |
| Dispensacao urgente    | 15 min | prescricao -> dispensacao                     | 50%    | Farmaceutico -> Coord. |
| Dispensacao controlada | 45 min | prescricao -> dispensacao + dupla conferencia | 75%    | Farmaceutico           |
| Validacao prescricao   | 60 min | prescricao -> validacao farmaceutica          | 75%    | Farmaceutico           |

### 2.4 Laboratorio

| Servico                   | SLA    | Medicao                                         | Alerta | Escalacao                      |
| ------------------------- | ------ | ----------------------------------------------- | ------ | ------------------------------ |
| Resultado rotina          | 4h     | coleta -> resultado liberado                    | 75%    | Biomedico -> Coord.            |
| Resultado urgente         | 1h     | coleta -> resultado liberado                    | 50%    | Biomedico -> Coord.            |
| Resultado critico         | 30 min | coleta -> resultado liberado                    | 50%    | Biomedico -> Coord. -> Direcao |
| Comunicacao valor critico | 10 min | resultado disponivel -> comunicacao closed-loop | 75%    | Biomedico                      |

### 2.5 Imagem / Radiologia

| Servico            | SLA                        | Medicao                                | Alerta | Escalacao              |
| ------------------ | -------------------------- | -------------------------------------- | ------ | ---------------------- |
| Agendamento rotina | 24h                        | solicitacao -> agendamento             | 75%    | Tec. -> Coord.         |
| Execucao exame     | Conforme agenda +/- 30 min | horario agendado -> exame realizado    | 100%   | Tec. -> Coord.         |
| Laudo urgente      | 2h                         | exame realizado -> laudo liberado      | 50%    | Radiologista -> Coord. |
| Laudo rotina       | 24h                        | exame realizado -> laudo liberado      | 75%    | Radiologista           |
| Laudo critico      | 30 min                     | exame realizado -> laudo + comunicacao | 50%    | Radiologista -> Coord. |

### 2.6 Manutencao

| Servico                               | SLA Resposta | SLA Conclusao   | Medicao                             | Alerta   | Escalacao                       |
| ------------------------------------- | ------------ | --------------- | ----------------------------------- | -------- | ------------------------------- |
| Emergencial                           | 15 min       | 2h              | chamado -> conclusao                | 50%      | Supervisor -> Coord. -> Direcao |
| Corretiva                             | 1h           | 4h              | chamado -> conclusao                | 75%      | Supervisor                      |
| Preventiva                            | N/A (agenda) | Conforme agenda | agenda -> conclusao                 | 100%     | Supervisor                      |
| Indisponibilidade equipamento critico | N/A          | Minimo possivel | inicio indisponibilidade -> retorno | Imediato | Supervisor -> Coord. -> Direcao |

### 2.7 Central de Leitos

| Servico                              | SLA             | Medicao                       | Alerta | Escalacao              |
| ------------------------------------ | --------------- | ----------------------------- | ------ | ---------------------- |
| Alocacao urgente                     | 30 min          | pedido -> alocacao            | 50%    | Coord. -> Regulacao    |
| Alocacao eletiva                     | 4h              | pedido -> alocacao            | 75%    | Coord.                 |
| Preparo leito (limpeza + manutencao) | 90 min          | liberacao -> leito disponivel | 75%    | Supervisor hig. + man. |
| Bloqueio -> liberacao                | Minimo possivel | bloqueio -> desbloqueio       | 24h    | Coord.                 |

### 2.8 Pronto Atendimento

| Servico              | SLA      | Medicao                  | Alerta | Escalacao                  |
| -------------------- | -------- | ------------------------ | ------ | -------------------------- |
| Classificacao risco  | 10 min   | chegada -> classificacao | 75%    | Enfermeiro lider           |
| Atendimento vermelho | Imediato | classificacao -> medico  | 3 min  | Med. plantonista -> Coord. |
| Atendimento laranja  | 10 min   | classificacao -> medico  | 75%    | Med. plantonista           |
| Atendimento amarelo  | 30 min   | classificacao -> medico  | 75%    | Med. plantonista           |
| Atendimento verde    | 60 min   | classificacao -> medico  | 75%    | Med. plantonista           |
| Atendimento azul     | 120 min  | classificacao -> medico  | 75%    | Med. plantonista           |

### 2.9 Enfermagem (Chamada Paciente)

| Servico         | SLA    | Medicao                  | Alerta | Escalacao        |
| --------------- | ------ | ------------------------ | ------ | ---------------- |
| Chamada urgente | 3 min  | chamada -> resposta      | 50%    | Enfermeiro lider |
| Chamada rotina  | 10 min | chamada -> resposta      | 75%    | Enfermeiro lider |
| Chamada dor     | 5 min  | chamada -> avaliacao dor | 50%    | Enfermeiro lider |

### 2.10 Nutricao

| Servico             | SLA                   | Medicao                           | Alerta | Escalacao               |
| ------------------- | --------------------- | --------------------------------- | ------ | ----------------------- |
| Entrega refeicao    | +/- 30 min do horario | horario programado -> entrega     | 100%   | Supervisor              |
| Dieta especial nova | 2h                    | prescricao -> producao -> entrega | 75%    | Nutricionista -> Coord. |
| Suspensao dieta     | 15 min                | ordem medica -> suspensao efetiva | 75%    | Nutricionista           |

---

## 3. Modelo de Medicao

### 3.1 TypeScript Interface

```typescript
interface SLADefinition {
  sla_id: string;
  department: string;
  service: string;
  description: string;

  // Medicao
  measurement: {
    start_event: WorkEventType; // Evento que inicia o cronometro
    end_event: WorkEventType; // Evento que para o cronometro
    target_minutes: number; // SLA alvo em minutos
    business_hours_only: boolean; // Apenas horario comercial?
    exclude_weekends: boolean; // Exclui finais de semana?
  };

  // Alerta
  alerting: {
    warning_threshold_percent: number; // Porcentagem do SLA para alerta
    critical_threshold_percent: number; // Porcentagem para critico
    notification_channels: ('dashboard' | 'push' | 'sms' | 'email')[];
    notification_targets: string[]; // Roles que recebem alerta
  };

  // Escalacao
  escalation: {
    levels: EscalationLevel[];
  };

  // Dashboard
  dashboard: {
    panel_type: 'gauge' | 'timeseries' | 'table' | 'stat';
    refresh_seconds: number;
    drill_down_target: string;
  };
}

interface EscalationLevel {
  level: number;
  after_percent: number; // Apos qual % do SLA
  target_role: string;
  action: 'notify' | 'assign' | 'override';
  channel: 'dashboard' | 'push' | 'sms' | 'phone';
}

const slaDefinitions: SLADefinition[] = [
  {
    sla_id: 'SLA-LIMP-001',
    department: 'higienizacao',
    service: 'limpeza_terminal',
    description: 'Limpeza terminal de leito pos-alta',
    measurement: {
      start_event: WorkEventType.ACIONAMENTO_LIMPEZA,
      end_event: WorkEventType.LIBERACAO_LIMPEZA,
      target_minutes: 60,
      business_hours_only: false,
      exclude_weekends: false,
    },
    alerting: {
      warning_threshold_percent: 75,
      critical_threshold_percent: 100,
      notification_channels: ['dashboard', 'push'],
      notification_targets: ['supervisor_higienizacao', 'enfermeiro_lider'],
    },
    escalation: {
      levels: [
        {
          level: 1,
          after_percent: 75,
          target_role: 'supervisor_higienizacao',
          action: 'notify',
          channel: 'push',
        },
        {
          level: 2,
          after_percent: 100,
          target_role: 'coordenador_hotelaria',
          action: 'notify',
          channel: 'push',
        },
        {
          level: 3,
          after_percent: 150,
          target_role: 'admin_unidade',
          action: 'assign',
          channel: 'sms',
        },
      ],
    },
    dashboard: {
      panel_type: 'gauge',
      refresh_seconds: 30,
      drill_down_target: '/dashboard/higienizacao/limpeza-terminal',
    },
  },
  {
    sla_id: 'SLA-TRANS-001',
    department: 'transporte',
    service: 'transporte_urgente',
    description: 'Transporte interno urgente de paciente',
    measurement: {
      start_event: WorkEventType.ACIONAMENTO_TRANSPORTE,
      end_event: WorkEventType.TRANSFERENCIA_CUSTODIA,
      target_minutes: 15,
      business_hours_only: false,
      exclude_weekends: false,
    },
    alerting: {
      warning_threshold_percent: 50,
      critical_threshold_percent: 100,
      notification_channels: ['dashboard', 'push', 'sms'],
      notification_targets: ['supervisor_transporte'],
    },
    escalation: {
      levels: [
        {
          level: 1,
          after_percent: 50,
          target_role: 'supervisor_transporte',
          action: 'notify',
          channel: 'push',
        },
        {
          level: 2,
          after_percent: 100,
          target_role: 'coordenador_logistica',
          action: 'assign',
          channel: 'sms',
        },
        {
          level: 3,
          after_percent: 200,
          target_role: 'admin_unidade',
          action: 'override',
          channel: 'phone',
        },
      ],
    },
    dashboard: {
      panel_type: 'timeseries',
      refresh_seconds: 15,
      drill_down_target: '/dashboard/transporte/urgente',
    },
  },
  {
    sla_id: 'SLA-LAB-003',
    department: 'laboratorio',
    service: 'resultado_critico',
    description: 'Resultado de exame critico',
    measurement: {
      start_event: WorkEventType.COLETA_MATERIAL,
      end_event: WorkEventType.RESULTADO_EXAME,
      target_minutes: 30,
      business_hours_only: false,
      exclude_weekends: false,
    },
    alerting: {
      warning_threshold_percent: 50,
      critical_threshold_percent: 100,
      notification_channels: ['dashboard', 'push', 'sms'],
      notification_targets: ['biomedico_responsavel', 'coordenador_lab'],
    },
    escalation: {
      levels: [
        {
          level: 1,
          after_percent: 50,
          target_role: 'biomedico_responsavel',
          action: 'notify',
          channel: 'push',
        },
        {
          level: 2,
          after_percent: 100,
          target_role: 'coordenador_lab',
          action: 'notify',
          channel: 'sms',
        },
        {
          level: 3,
          after_percent: 150,
          target_role: 'direcao_tecnica',
          action: 'assign',
          channel: 'phone',
        },
      ],
    },
    dashboard: {
      panel_type: 'stat',
      refresh_seconds: 15,
      drill_down_target: '/dashboard/laboratorio/criticos',
    },
  },
];
```

---

## 4. Prometheus Recording Rules para SLA

### 4.1 Recording Rules

```yaml
# sla-recording-rules.yaml
groups:
  - name: velya_sla_compliance
    interval: 30s
    rules:
      # --- Limpeza Terminal ---
      - record: velya:sla:limpeza_terminal:compliance_rate:5m
        expr: |
          (
            sum(rate(velya_work_event_duration_minutes_bucket{
              category="higiene",
              event_type="limpeza_terminal",
              le="60"
            }[5m]))
            /
            sum(rate(velya_work_event_duration_minutes_count{
              category="higiene",
              event_type="limpeza_terminal"
            }[5m]))
          ) * 100

      - record: velya:sla:limpeza_terminal:avg_duration:5m
        expr: |
          sum(rate(velya_work_event_duration_minutes_sum{
            category="higiene",
            event_type="limpeza_terminal"
          }[5m]))
          /
          sum(rate(velya_work_event_duration_minutes_count{
            category="higiene",
            event_type="limpeza_terminal"
          }[5m]))

      - record: velya:sla:limpeza_terminal:p95_duration:5m
        expr: |
          histogram_quantile(0.95,
            sum(rate(velya_work_event_duration_minutes_bucket{
              category="higiene",
              event_type="limpeza_terminal"
            }[5m])) by (le)
          )

      # --- Transporte Urgente ---
      - record: velya:sla:transporte_urgente:compliance_rate:5m
        expr: |
          (
            sum(rate(velya_work_event_duration_minutes_bucket{
              category="transporte",
              event_type="transporte_urgente",
              le="15"
            }[5m]))
            /
            sum(rate(velya_work_event_duration_minutes_count{
              category="transporte",
              event_type="transporte_urgente"
            }[5m]))
          ) * 100

      - record: velya:sla:transporte_urgente:p95_duration:5m
        expr: |
          histogram_quantile(0.95,
            sum(rate(velya_work_event_duration_minutes_bucket{
              category="transporte",
              event_type="transporte_urgente"
            }[5m])) by (le)
          )

      # --- Laboratorio Critico ---
      - record: velya:sla:lab_critico:compliance_rate:5m
        expr: |
          (
            sum(rate(velya_work_event_duration_minutes_bucket{
              category="apoio",
              event_type="resultado_exame",
              priority="critico",
              le="30"
            }[5m]))
            /
            sum(rate(velya_work_event_duration_minutes_count{
              category="apoio",
              event_type="resultado_exame",
              priority="critico"
            }[5m]))
          ) * 100

      # --- Farmacia Dispensacao ---
      - record: velya:sla:dispensacao:compliance_rate:5m
        expr: |
          (
            sum(rate(velya_work_event_duration_minutes_bucket{
              category="apoio",
              event_type="dispensacao",
              le="30"
            }[5m]))
            /
            sum(rate(velya_work_event_duration_minutes_count{
              category="apoio",
              event_type="dispensacao"
            }[5m]))
          ) * 100

      # --- Manutencao Emergencial ---
      - record: velya:sla:manutencao_emergencial:compliance_rate:5m
        expr: |
          (
            sum(rate(velya_work_event_duration_minutes_bucket{
              category="manutencao",
              event_type="manutencao_emergencial",
              le="120"
            }[5m]))
            /
            sum(rate(velya_work_event_duration_minutes_count{
              category="manutencao",
              event_type="manutencao_emergencial"
            }[5m]))
          ) * 100

      # --- Central Leitos Urgente ---
      - record: velya:sla:alocacao_urgente:compliance_rate:5m
        expr: |
          (
            sum(rate(velya_work_event_duration_minutes_bucket{
              category="operacional",
              event_type="alocacao_vaga",
              priority="urgente",
              le="30"
            }[5m]))
            /
            sum(rate(velya_work_event_duration_minutes_count{
              category="operacional",
              event_type="alocacao_vaga",
              priority="urgente"
            }[5m]))
          ) * 100

      # --- Chamada Paciente ---
      - record: velya:sla:chamada_paciente:compliance_rate:5m
        expr: |
          (
            sum(rate(velya_work_event_duration_minutes_bucket{
              category="comunicacao",
              event_type="resposta_chamada",
              le="10"
            }[5m]))
            /
            sum(rate(velya_work_event_duration_minutes_count{
              category="comunicacao",
              event_type="resposta_chamada"
            }[5m]))
          ) * 100

      # --- Imagem Laudo Urgente ---
      - record: velya:sla:laudo_urgente:compliance_rate:5m
        expr: |
          (
            sum(rate(velya_work_event_duration_minutes_bucket{
              category="apoio",
              event_type="laudo_exame",
              priority="urgente",
              le="120"
            }[5m]))
            /
            sum(rate(velya_work_event_duration_minutes_count{
              category="apoio",
              event_type="laudo_exame",
              priority="urgente"
            }[5m]))
          ) * 100

  - name: velya_sla_alerts
    interval: 30s
    rules:
      # --- Alertas de SLA ---
      - alert: SLALimpezaTerminalBaixo
        expr: velya:sla:limpeza_terminal:compliance_rate:5m < 80
        for: 5m
        labels:
          severity: warning
          department: higienizacao
        annotations:
          summary: 'SLA de limpeza terminal abaixo de 80%'
          description: 'Taxa atual: {{ $value }}%'

      - alert: SLALimpezaTerminalCritico
        expr: velya:sla:limpeza_terminal:compliance_rate:5m < 60
        for: 5m
        labels:
          severity: critical
          department: higienizacao
        annotations:
          summary: 'SLA de limpeza terminal critico - abaixo de 60%'

      - alert: SLATransporteUrgenteBaixo
        expr: velya:sla:transporte_urgente:compliance_rate:5m < 85
        for: 3m
        labels:
          severity: warning
          department: transporte
        annotations:
          summary: 'SLA de transporte urgente abaixo de 85%'

      - alert: SLALabCriticoBaixo
        expr: velya:sla:lab_critico:compliance_rate:5m < 90
        for: 3m
        labels:
          severity: critical
          department: laboratorio
        annotations:
          summary: 'SLA de resultado critico de laboratorio abaixo de 90%'

      - alert: SLAChamadaPacienteBaixo
        expr: velya:sla:chamada_paciente:compliance_rate:5m < 80
        for: 5m
        labels:
          severity: warning
          department: enfermagem
        annotations:
          summary: 'SLA de resposta a chamada de paciente abaixo de 80%'

      - alert: SLADispensacaoBaixo
        expr: velya:sla:dispensacao:compliance_rate:5m < 80
        for: 5m
        labels:
          severity: warning
          department: farmacia
        annotations:
          summary: 'SLA de dispensacao farmaceutica abaixo de 80%'
```

---

## 5. Dashboard de SLA por Departamento

### 5.1 Painel Principal

| Departamento   | Metrica Principal              | Tipo Painel | Refresh | Meta                    |
| -------------- | ------------------------------ | ----------- | ------- | ----------------------- |
| Higienizacao   | % SLA cumprido por tipo        | Gauge       | 30s     | >= 85%                  |
| Transporte     | Tempo medio de resposta        | Timeseries  | 15s     | <= SLA                  |
| Farmacia       | % dispensacao no prazo         | Gauge       | 30s     | >= 90%                  |
| Laboratorio    | TAT por prioridade             | Timeseries  | 30s     | <= SLA                  |
| Imagem         | Tempo medio ate laudo          | Timeseries  | 60s     | <= SLA                  |
| Manutencao     | Chamados abertos vs concluidos | Stat        | 60s     | >= 80%                  |
| Central Leitos | Tempo medio alocacao           | Stat        | 30s     | <= 30 min (urgente)     |
| PA             | Tempo espera por cor           | Timeseries  | 15s     | <= protocolo Manchester |
| Enfermagem     | Tempo resposta chamada         | Gauge       | 15s     | <= 10 min               |
| Nutricao       | Entregas no horario            | Gauge       | 60s     | >= 90%                  |

---

## 6. NATS Subjects para SLA

```yaml
subjects:
  - 'velya.sla.warning.{department}.{service}'
  - 'velya.sla.breach.{department}.{service}'
  - 'velya.sla.escalation.{department}.{service}.{level}'
  - 'velya.sla.compliance.{department}.calculated'
```

---

## 7. Regras de Negocio

| ID     | Regra                                   | Descricao                                      |
| ------ | --------------------------------------- | ---------------------------------------------- |
| SLA001 | Todo servico tem SLA definido           | Nenhum servico sem meta de tempo               |
| SLA002 | SLA e medido automaticamente            | Inicio e fim por eventos do sistema            |
| SLA003 | Alerta antes do estouro                 | Warning em 50-75% do SLA                       |
| SLA004 | Escalacao automatica                    | Timeout escala para nivel seguinte             |
| SLA005 | SLA visivel em dashboard                | Tempo real, refresh <= 60s                     |
| SLA006 | SLA historico por turno                 | Relatorio por turno/dia/semana/mes             |
| SLA007 | Meta institucional >= 85%               | Exceto servicos criticos (>= 90%)              |
| SLA008 | SLA de comunicacao critica e inviolavel | Valor critico DEVE ser comunicado em <= 10 min |

---

## 8. Resumo

O modelo de SLA e tempo de resposta garante:

1. **Cada departamento tem SLAs explicitos** — Documentados, mensurados, visiveis.
2. **Medicao automatica** — Baseada em eventos do sistema, sem registro manual.
3. **Alertas proativos** — Warning antes do estouro, critico no estouro.
4. **Escalacao em cadeia** — Cada nivel tem prazo e responsavel.
5. **Dashboards em tempo real** — Prometheus recording rules + Grafana.
6. **Meta institucional** — >= 85% para operacional, >= 90% para critico.
