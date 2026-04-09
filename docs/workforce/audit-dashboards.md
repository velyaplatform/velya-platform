# Dashboards de Auditoria e Operacao — Velya Platform

> Especificacoes de 8 dashboards operacionais com paineis, queries PromQL/LogQL, filtros, drilldowns, taxas de refresh e owners.

---

## 1. Principio Fundamental

**Cada aspecto do workforce tem um dashboard dedicado. Todos operam em tempo real ou quase-real. Cada painel tem owner responsavel pela acao.**

---

## 2. Dashboard 1: Workforce Activity Command Center

### Proposito
Visao unificada de toda atividade de trabalho hospitalar em tempo real.

### Owner
Direcao Operacional / NOC Hospitalar

### Refresh
15 segundos

### Paineis

| Painel | Tipo | Query | Descricao |
|---|---|---|---|
| Total Eventos Ativos | Stat | `sum(velya_work_events_total{delivery_status=~"pendente\|em_execucao"})` | Eventos de trabalho em aberto |
| Eventos por Categoria (Live) | Bar Chart | `sum by (category) (rate(velya_work_events_total[5m]))` | Taxa de eventos por categoria |
| Mapa de Calor por Unidade | Heatmap | `sum by (department) (rate(velya_work_events_total[5m]))` | Intensidade de atividade por departamento |
| SLA Compliance Geral | Gauge | `avg(velya_work_event_sla_compliance)` | Media institucional de conformidade SLA |
| Gaps Ativos | Stat (vermelho se > 0) | `sum(velya_gaps_active{severity="critica"})` | Gaps criticos ativos |
| Eventos/Minuto | Timeseries | `sum(rate(velya_work_events_total[1m]))` | Taxa de eventos por minuto |
| Top 10 Departamentos (Volume) | Table | `topk(10, sum by (department) (rate(velya_work_events_total[1h])))` | Departamentos mais ativos |
| Pendencias Criticas | Table | `velya_work_event_pending_count{priority="critica"}` | Lista de pendencias criticas |

### Filtros
- Departamento, Unidade, Categoria, Periodo, Turno

### Drilldowns
- Departamento -> Dashboard departamental
- Categoria -> Dashboard por tipo de evento
- Gap -> Dashboard de gaps
- Pendencia -> Detalhe da pendencia

---

## 3. Dashboard 2: Shift & Handoff Board

### Proposito
Monitoramento de turnos ativos, cobertura de equipe e handoffs em andamento.

### Owner
Coordenacao de Enfermagem / Gestao de Pessoas

### Refresh
30 segundos

### Paineis

| Painel | Tipo | Query | Descricao |
|---|---|---|---|
| Turnos Ativos | Stat | `count(velya_shift_coverage_ratio > 0)` | Numero de turnos em andamento |
| Cobertura Media | Gauge | `avg(velya_shift_coverage_ratio) * 100` | Porcentagem media de cobertura |
| Unidades Abaixo Minimo | Table (vermelho) | `velya_shift_coverage_ratio < 0.8` | Unidades com cobertura < 80% |
| Gaps de Cobertura Ativos | Stat | `sum(velya_shift_gaps_active)` | Total de gaps de cobertura |
| Gaps por Tipo | Pie | `sum by (gap_type) (velya_shift_gaps_active)` | Distribuicao de gaps por tipo |
| Handoffs Pendentes | Stat | `sum(velya_handoff_pending_count)` | Handoffs aguardando aceite |
| Tempo Medio Aceite Handoff | Stat | `avg(velya_handoff_acceptance_time_seconds) / 60` | Tempo medio em minutos |
| Handoffs Timeout | Stat (vermelho) | `sum(rate(velya_handoff_timeout_total[1h]))` | Handoffs com timeout na ultima hora |
| Hora Extra Acumulada | Stat | `sum(velya_shift_overtime_minutes_total) / 60` | Total horas extras hoje |
| Proximos Turnos (30 min) | Table | LogQL: `{app="velya-shift"} \| json \| shift_status="programado" \| scheduled_start < now()+30m` | Turnos que iniciam em 30 min |
| Completude Passagem Plantao | Gauge | `avg(velya_shift_handoff_completion_ratio) * 100` | Taxa de passagem completa |
| Itens Cross-Shift | Table | `velya_shift_pending_items_cross_shift` | Itens pendentes entre turnos |

### Filtros
- Departamento, Unidade, Turno (D/N), Funcao

### Drilldowns
- Unidade -> Detalhe equipe do turno
- Gap -> Acao de resolucao
- Handoff pendente -> Detalhe do handoff

---

## 4. Dashboard 3: No-Owner Work Board

### Proposito
Identificar atividades, pendencias e demandas sem responsavel atribuido.

### Owner
Qualidade / Gestao Operacional

### Refresh
30 segundos

### Paineis

| Painel | Tipo | Query/LogQL | Descricao |
|---|---|---|---|
| Pendencias Sem Dono | Stat (vermelho) | `sum(velya_work_event_pending_count{handoff_target=""})` | Total de pendencias sem responsavel |
| Pendencias Sem Dono por Departamento | Bar | `sum by (department) (velya_work_event_pending_count{handoff_target=""})` | Distribuicao por departamento |
| Tempo Medio Sem Dono | Stat | LogQL: `avg_over_time({app="velya-workforce"} \| json \| delivery_status="pendente" \| handoff_target="" \| unwrap age_minutes [1h])` | Tempo medio sem atribuicao |
| Handoffs Sem Aceite | Table | `velya_handoff_pending_count` por tipo e unidade | Lista de handoffs aguardando |
| Chamadas Sem Resposta | Stat (vermelho) | `sum(velya_gaps_active{rule_id="GAP-COM-001"})` | Chamadas de paciente sem resposta |
| Acionamentos Sem Resposta | Table | LogQL: `{app="velya-workforce"} \| json \| event_type=~"acionamento_.*" \| delivery_status="pendente" \| age > 15m` | Acionamentos operacionais sem resposta |
| Tarefas Orfas (> 2h) | Table | `velya_gaps_active{rule_id="GAP-ACE-005"}` | Tarefas pendentes ha mais de 2h |
| Trend Sem Dono (24h) | Timeseries | `sum(velya_work_event_pending_count{handoff_target=""})` over 24h | Tendencia de itens sem dono |

### Filtros
- Departamento, Prioridade, Categoria, Tempo pendente

### Drilldowns
- Item sem dono -> Formulario de atribuicao
- Departamento -> Dashboard departamental

---

## 5. Dashboard 4: Access & Session Audit Board

### Proposito
Monitoramento de sessoes, acessos, anomalias e break-glass.

### Owner
DPO / Auditoria / TI Seguranca

### Refresh
15 segundos

### Paineis

| Painel | Tipo | Query/LogQL | Descricao |
|---|---|---|---|
| Sessoes Ativas | Stat | `sum(velya_session_active_count)` | Total de sessoes ativas |
| Sessoes por Tipo Dispositivo | Pie | `sum by (device_type) (velya_session_active_count)` | Distribuicao por dispositivo |
| Logins/Hora | Timeseries | `sum(rate(velya_session_login_total{outcome="success"}[1h]))` | Taxa de logins por hora |
| Falhas de Auth | Stat (vermelho se > 5) | `sum(rate(velya_session_login_total{outcome="failure"}[1h]))` | Falhas na ultima hora |
| Lockouts Ativos | Stat | `sum(velya_session_lockout_total)` | Usuarios bloqueados |
| Break-Glass Ativos | Stat (vermelho) | `sum(velya_session_breakglass_total{review_outcome=""})` | Break-glass sem revisao |
| Anomalias Detectadas | Table | `sum by (anomaly_type) (rate(velya_session_anomaly_total[1h]))` | Anomalias por tipo |
| Trocas de Usuario/Hora | Timeseries | `sum(rate(velya_session_switch_total[1h]))` | Taxa de trocas |
| Sessoes Ociosas (> timeout) | Table | LogQL: `{app="velya-session"} \| json \| status="ocioso" \| idle_minutes > timeout_config` | Sessoes que deviam ter expirado |
| Acessos Fora da Unidade | Table | `velya_gaps_active{rule_id="GAP-ACE-001"}` | Acessos suspeitos |
| Elevacoes de Privilegio Ativas | Table | LogQL: `{app="velya-session"} \| json \| event_type="privilege_elevation_granted" \| revoked_at=""` | Privilegios elevados ativos |
| Risk Score Distribution | Histogram | `histogram_quantile(0.95, sum(rate(velya_session_risk_score_bucket[1h])) by (le))` | Distribuicao de risk score |

### Filtros
- Unidade, Tipo de evento, Severidade, Risk score minimo

### Drilldowns
- Anomalia -> Detalhe do evento + sessao
- Break-glass -> Formulario de revisao
- Acesso suspeito -> Timeline de sessao

---

## 6. Dashboard 5: Patient Call Response Board

### Proposito
Monitoramento de chamadas de pacientes e tempo de resposta.

### Owner
Coordenacao de Enfermagem

### Refresh
15 segundos

### Paineis

| Painel | Tipo | Query | Descricao |
|---|---|---|---|
| Chamadas Ativas | Stat (vermelho se > 0) | `sum(velya_gaps_active{rule_id="GAP-COM-001"})` | Chamadas sem resposta agora |
| Tempo Medio Resposta | Gauge | `avg(velya_work_event_duration_minutes{event_type="resposta_chamada"})` | Tempo medio de resposta (minutos) |
| SLA Chamada (< 10 min) | Gauge | `velya:sla:chamada_paciente:compliance_rate:5m` | % respondidas em < 10 min |
| Chamadas por Unidade | Bar | `sum by (department) (rate(velya_work_events_total{event_type="chamada_paciente"}[1h]))` | Volume por unidade |
| P95 Tempo Resposta | Stat | `histogram_quantile(0.95, sum(rate(velya_work_event_duration_minutes_bucket{event_type="resposta_chamada"}[1h])) by (le))` | Percentil 95 |
| Chamadas por Tipo | Pie | LogQL: `sum by (tipo_chamada) (count_over_time({app="velya-workforce"} \| json \| event_type="chamada_paciente" [1h]))` | Distribuicao por tipo |
| Trend Resposta (24h) | Timeseries | `avg(velya_work_event_duration_minutes{event_type="resposta_chamada"})` over 24h | Tendencia de tempo resposta |
| Top 5 Leitos com Mais Chamadas | Table | `topk(5, sum by (location_id) (rate(velya_work_events_total{event_type="chamada_paciente"}[4h])))` | Leitos com mais chamadas |

### Filtros
- Unidade, Turno, Tipo de chamada, Prioridade

### Drilldowns
- Chamada ativa -> Detalhes paciente/leito
- Unidade -> Detalhes equipe

---

## 7. Dashboard 6: Department Delivery Board

### Proposito
Visao de entregas por departamento operacional (limpeza, transporte, farmacia, lab, manutencao).

### Owner
Coordenadores Departamentais

### Refresh
30 segundos

### Paineis

| Painel | Tipo | Query | Descricao |
|---|---|---|---|
| SLA Compliance por Departamento | Multi-gauge | `velya:sla:*:compliance_rate:5m` por departamento | Compliance SLA de cada departamento |
| Fila de Demanda | Bar | `sum by (department) (velya_work_event_pending_count)` | Demandas pendentes por departamento |
| Tempo Medio Entrega | Bar | `avg by (department) (velya_work_event_duration_minutes{delivery_status="concluido"})` | Tempo medio de entrega |
| Volume Entregas/Hora | Timeseries | `sum by (department) (rate(velya_work_events_total{delivery_status="concluido"}[1h]))` | Entregas por hora |
| Atrasos Acumulados | Stat (vermelho) | `sum(velya_work_events_total{sla_met="false"})` | Total de atrasos |
| Recusas | Stat | `sum(rate(velya_work_events_total{delivery_status="recusado"}[4h]))` | Recusas nas ultimas 4h |
| Limpeza: Terminal vs Concorrente | Bar | `sum by (event_type) (rate(velya_work_events_total{category="higiene"}[1h]))` | Volume por tipo limpeza |
| Transporte: Fila Ativa | Table | LogQL: `{app="velya-workforce"} \| json \| category="transporte" \| delivery_status="pendente"` | Transportes pendentes |
| Farmacia: Dispensacoes Pendentes | Stat | `velya_work_event_pending_count{department="farmacia"}` | Dispensacoes aguardando |
| Lab: TAT por Prioridade | Bar | `avg by (priority) (velya_work_event_duration_minutes{department="laboratorio", event_type="resultado_exame"})` | Turnaround time lab |
| Manutencao: Equipamentos Indisponiveis | Table | LogQL: `{app="velya-workforce"} \| json \| event_type="indisponibilidade_equipamento" \| status="ativo"` | Equipamentos fora |

### Filtros
- Departamento, Tipo de servico, Prioridade, Turno

### Drilldowns
- Departamento -> Detalhes operacionais
- Item pendente -> Detalhe do evento
- Equipamento indisponivel -> Historico manutencao

---

## 8. Dashboard 7: Delay & Escalation Board

### Proposito
Monitoramento de atrasos, escalacoes e excecoes em toda a instituicao.

### Owner
Qualidade / Gestao de Risco

### Refresh
30 segundos

### Paineis

| Painel | Tipo | Query | Descricao |
|---|---|---|---|
| Atrasos Ativos | Stat (vermelho) | `sum(velya_work_events_total{delivery_status="atrasado"})` | Total de atividades atrasadas |
| Atrasos por Departamento | Bar | `sum by (department) (velya_work_events_total{delivery_status="atrasado"})` | Distribuicao de atrasos |
| Escalacoes Ativas | Stat | `sum(velya_work_events_total{delivery_status="escalado"})` | Escalacoes em andamento |
| Escalacoes por Nivel | Pie | LogQL: `sum by (escalation_level) (count_over_time({app="velya-workforce"} \| json \| event_type="escalacao" [4h]))` | Distribuicao por nivel |
| Tempo Medio Ate Resolucao Escalacao | Stat | `avg(velya_gaps_resolution_time_hours{category="escalacao"})` | Tempo medio resolucao |
| Excecoes por Tipo | Bar | `sum by (exception_type) (rate(velya_work_events_total{category="excecao"}[4h]))` | Excecoes nas ultimas 4h |
| Eventos Adversos | Stat (vermelho) | `sum(rate(velya_work_events_total{event_type="evento_adverso"}[24h]))` | Eventos adversos em 24h |
| Desvios de Protocolo | Table | LogQL: `{app="velya-workforce"} \| json \| event_type="desvio_protocolo" \| timestamp > now() - 24h` | Desvios recentes |
| Trend Atrasos (7 dias) | Timeseries | `sum(velya_work_events_total{delivery_status="atrasado"})` over 7d | Tendencia semanal |
| Top Motivos de Atraso | Table | LogQL: `topk(10, sum by (delay_reason) (count_over_time({app="velya-workforce"} \| json \| delivery_status="atrasado" [24h])))` | Principais causas de atraso |

### Filtros
- Departamento, Severidade, Tipo de excecao, Periodo

### Drilldowns
- Atraso -> Detalhe do evento + timeline
- Escalacao -> Cadeia de escalacao
- Evento adverso -> Investigacao

---

## 9. Dashboard 8: Sensitive Access Review Board

### Proposito
Revisao de acessos sensiveis, break-glass, exportacoes e acoes que exigem auditoria manual.

### Owner
DPO / Comite de Etica / Auditoria

### Refresh
60 segundos

### Paineis

| Painel | Tipo | Query/LogQL | Descricao |
|---|---|---|---|
| Break-Glass Pendentes Revisao | Stat (vermelho) | `sum(velya_session_breakglass_total{review_outcome=""})` | Break-glass sem revisao |
| Break-Glass Timeline | Table | LogQL: `{app="velya-session"} \| json \| event_type="break_glass_granted" \| sort by timestamp desc` | Lista cronologica |
| Exportacoes de Dados | Table | LogQL: `{app="velya-session"} \| json \| event_type="exportacao_dados" \| sort by timestamp desc` | Exportacoes recentes |
| Acessos a VIPs/Funcionarios | Table | LogQL: `{app="velya-session"} \| json \| event_type="acesso_prontuario" \| patient_category=~"vip\|funcionario"` | Acessos a prontuarios VIP |
| Visualizacoes Sensiveis | Table | LogQL: `{app="velya-session"} \| json \| event_type="visualizacao_sensivel"` | Dados sensiveis acessados |
| Impressoes de Documentos Clinicos | Table | LogQL: `{app="velya-session"} \| json \| event_type="impressao_documento" \| document_type=~"prontuario\|laudo\|prescricao"` | Impressoes de docs clinicos |
| Correcoes Tardias (> 24h) | Table | `velya_gaps_active{rule_id="GAP-ACE-004"}` | Correcoes fora da janela |
| Elevacoes de Privilegio | Table | LogQL: `{app="velya-session"} \| json \| event_type="privilege_elevation_granted"` | Elevacoes recentes |
| Acessos Fora Relacao Assistencial | Table | `velya_gaps_active{rule_id="GAP-ACE-001"}` | Acessos sem relacao |
| Acoes Pendentes Revisao | Stat | `sum(velya_gaps_active{category="acesso", requires_resolution="true"})` | Total pendente revisao DPO |

### Filtros
- Tipo de acao, Periodo, Profissional, Paciente, Status revisao

### Drilldowns
- Break-glass -> Formulario de revisao com aceite/rejeicao
- Exportacao -> Detalhes do dado exportado
- Acesso VIP -> Timeline completa da sessao

---

## 10. Configuracao Grafana

### 10.1 Datasources

```yaml
# grafana-datasources.yaml
apiVersion: 1
datasources:
  - name: Prometheus-Velya
    type: prometheus
    access: proxy
    url: http://prometheus.velya-monitoring:9090
    isDefault: true
    jsonData:
      timeInterval: "15s"

  - name: Loki-Velya
    type: loki
    access: proxy
    url: http://loki.velya-monitoring:3100
    jsonData:
      maxLines: 5000

  - name: PostgreSQL-Velya
    type: postgres
    access: proxy
    url: postgres.velya-data:5432
    database: velya_workforce
    user: grafana_reader
    secureJsonData:
      password: "${GRAFANA_PG_PASSWORD}"
    jsonData:
      sslmode: require
      maxOpenConns: 10
      maxIdleConns: 5
```

### 10.2 Alerting

```yaml
# grafana-alert-rules.yaml
groups:
  - name: workforce-critical
    folder: Velya Workforce
    interval: 30s
    rules:
      - uid: wf-critical-gaps
        title: "Gaps Criticos Ativos"
        condition: sum(velya_gaps_active{severity="critica"}) > 0
        for: 1m
        labels:
          severity: critical
        notifications:
          - uid: slack-workforce-alerts
          - uid: pagerduty-workforce

      - uid: wf-breakglass-unreview
        title: "Break-Glass Sem Revisao > 24h"
        condition: sum(velya_session_breakglass_total{review_outcome=""} offset 24h) > 0
        for: 5m
        labels:
          severity: warning
        notifications:
          - uid: email-dpo
          - uid: slack-auditoria

      - uid: wf-shift-below-minimum
        title: "Turno Abaixo do Minimo"
        condition: velya_shift_coverage_ratio < 0.7
        for: 5m
        labels:
          severity: critical
        notifications:
          - uid: slack-workforce-alerts
          - uid: sms-coordenacao
```

---

## 11. Resumo

Os 8 dashboards cobrem:

| # | Dashboard | Owner | Refresh | Foco |
|---|---|---|---|---|
| 1 | Workforce Command Center | Direcao | 15s | Visao geral atividade |
| 2 | Shift & Handoff Board | Enfermagem | 30s | Cobertura e handoff |
| 3 | No-Owner Work Board | Qualidade | 30s | Itens sem responsavel |
| 4 | Access & Session Audit | DPO/TI | 15s | Sessoes e anomalias |
| 5 | Patient Call Response | Enfermagem | 15s | Chamadas paciente |
| 6 | Department Delivery | Coordenadores | 30s | Entregas operacionais |
| 7 | Delay & Escalation | Qualidade | 30s | Atrasos e excecoes |
| 8 | Sensitive Access Review | DPO/Auditoria | 60s | Acessos sensiveis |
