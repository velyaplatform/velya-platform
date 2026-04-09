# Dashboards de Auditoria da Jornada do Paciente

> 8 dashboards especializados para monitoramento, auditoria e melhoria continua da jornada do paciente internado.

## 1. Visao Geral

Os dashboards de auditoria sao projecoes visuais do Work Event Ledger e do Digital Twin Operacional, oferecendo visibilidade em tempo real e retrospectiva sobre a qualidade, seguranca e eficiencia da jornada de cada paciente e do hospital como um todo.

### 1.1 Arquitetura de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                  Work Event Ledger                          │
│                  (fonte primaria)                           │
└───────┬─────────────────────────────────────┬───────────────┘
        │                                     │
        ▼                                     ▼
┌───────────────────┐               ┌─────────────────────┐
│  Digital Twin     │               │  Analytics DW       │
│  (tempo real)     │               │  (historico)        │
└───────┬───────────┘               └─────────┬───────────┘
        │                                     │
        ▼                                     ▼
┌───────────────────────────────────────────────────────────┐
│                  Grafana Dashboards                       │
│  - Datasource: Prometheus (metricas)                     │
│  - Datasource: Loki (logs/eventos)                       │
│  - Datasource: PostgreSQL (dados estruturados)           │
│  - Datasource: Redis (estado atual do twin)              │
└───────────────────────────────────────────────────────────┘
```

### 1.2 Principios de Design

| Principio | Aplicacao |
|---|---|
| **Glanceability** | Informacao critica visivel em 3 segundos |
| **Drilldown progressivo** | Visao geral -> unidade -> paciente -> evento |
| **Contexto temporal** | Sempre mostrar janela temporal e baseline |
| **Acionabilidade** | Cada alerta linkado a acao especifica |
| **Controle de acesso** | Dados filtrados por papel do visualizador |

---

## 2. Dashboard 1: Patient Journey Cockpit

### 2.1 Proposito

Visao unificada do estado operacional de um paciente especifico. Tela principal para enfermeiros e medicos responsaveis acompanharem todos os aspectos da internacao em tempo real.

**Owner**: Diretoria de Enfermagem + Diretoria Clinica

### 2.2 Paineis Principais

| Painel | Descricao | Tipo |
|---|---|---|
| **Header de Identificacao** | Nome, leito, unidade, dias de internacao, medico/enfermeiro responsavel | Info bar |
| **Status Operacional** | Semaforo de risco operacional (low/moderate/high/critical) | Gauge |
| **Localizacao Atual** | Mapa da unidade com posicao do paciente (RTLS) | Floor map |
| **Timeline de Eventos** | Linha do tempo interativa dos ultimos eventos (24h padrao) | Timeline |
| **Pendencias Ativas** | Lista de pendencias ordenadas por prioridade e SLA | Table |
| **Dor** | Grafico de tendencia de dor (ultimas 48h) + status de intervencao | Line chart + badge |
| **Chamadas** | Historico de chamadas com tempo de resposta | Bar chart |
| **Medicamentos** | Proximas doses, doses atrasadas, doses administradas | Gantt-like |
| **Sinais Vitais** | NEWS2 com tendencia, parametros individuais | Multi-line + gauge |
| **Gaps Ativos** | Gaps detectados nao resolvidos para este paciente | Alert list |
| **Equipe Atual** | CareTeam com turnos e proximo handoff | Team view |
| **Documentacao** | Barra de completude + pendencias de assinatura | Progress bar + list |
| **Objetivos de Alta** | Criterios de alta com status de cada um | Checklist |

### 2.3 Queries

**Timeline de Eventos (Loki)**:
```logql
{namespace="velya", service="event-ledger"}
  | json
  | patient_id = "<PATIENT_ID>"
  | line_format "{{.timestamp}} [{{.event_type}}] {{.summary}} — {{.actor}}"
```

**Score de Risco Operacional (PromQL)**:
```promql
velya_twin_operational_risk_score{patient_id="<PATIENT_ID>"}
```

**Pendencias com SLA (PostgreSQL)**:
```sql
SELECT pi.id, pi.type, pi.description, pi.created_at,
       pi.sla_minutes, pi.waiting_time_minutes,
       pi.sla_breached, pi.assigned_to_name,
       pi.priority
FROM patient_pending_items pi
WHERE pi.patient_id = :patient_id
  AND pi.status = 'active'
ORDER BY
  CASE pi.priority
    WHEN 'stat' THEN 1
    WHEN 'urgent' THEN 2
    WHEN 'routine' THEN 3
  END,
  pi.sla_breached DESC,
  pi.created_at ASC;
```

**Tendencia de Dor (PromQL)**:
```promql
velya_patient_pain_score{patient_id="<PATIENT_ID>"}[48h]
```

### 2.4 Drilldown

- Clicar em evento na timeline: abre detalhes do evento com Provenance completo.
- Clicar em pendencia: abre formulario de acao/resolucao.
- Clicar em gap: abre detalhes do gap com acoes sugeridas.
- Clicar em membro da equipe: mostra historico de interacoes com o paciente.
- Clicar em medicamento: abre historico de administracoes + prescricao original.

---

## 3. Dashboard 2: Medication Integrity Board

### 3.1 Proposito

Monitoramento da integridade do ciclo completo de medicacao: prescricao -> dispensacao -> administracao -> resultado. Foco em seguranca medicamentosa e aderencia a prescricao.

**Owner**: Farmacia Clinica + Diretoria de Enfermagem

### 3.2 Paineis Principais

| Painel | Descricao | Tipo |
|---|---|---|
| **Doses Atrasadas** | Medicamentos nao administrados alem do horario prescrito | Table (red highlight) |
| **Doses Proximas (30min)** | Medicamentos com administracao iminente | Table |
| **Taxa de Aderencia por Unidade** | % de doses administradas no horario correto | Heatmap |
| **Medicamentos de Alto Risco** | Status de medicamentos MAR (alto risco) prescritos | Highlighted table |
| **Dupla Checagem Pendente** | Medicamentos que requerem dupla checagem sem confirmacao | Alert list |
| **Interacoes Detectadas** | Interacoes medicamentosas detectadas sem resolucao | Alert list |
| **Prescricoes sem Dispensacao** | Prescricoes ativas sem registro de dispensacao | Table |
| **Administracoes sem Prescricao** | GAP-003 ativo (execucao sem ordem) | Critical alert |
| **Omissoes de Dose** | Doses omitidas com e sem justificativa | Table |
| **Reconciliacao na Admissao** | Status de reconciliacao medicamentosa por paciente | Progress list |

### 3.3 Queries

**Doses Atrasadas (PostgreSQL)**:
```sql
SELECT ma.patient_name, ma.medication_name, ma.unit, ma.bed,
       ma.scheduled_time, ma.priority,
       EXTRACT(EPOCH FROM (NOW() - ma.scheduled_time))/60 AS minutes_late,
       ma.assigned_nurse_name
FROM medication_schedule ma
WHERE ma.status = 'scheduled'
  AND ma.scheduled_time < NOW()
  AND ma.encounter_status = 'active'
ORDER BY
  CASE ma.priority WHEN 'stat' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END,
  ma.scheduled_time ASC;
```

**Taxa de Aderencia (PromQL)**:
```promql
sum by (unit) (velya_medication_administered_on_time_total)
/ sum by (unit) (velya_medication_scheduled_total)
* 100
```

**Medicamentos de Alto Risco (Loki)**:
```logql
{namespace="velya", service="medication-service"}
  | json
  | event_type = "medication.prescribed"
  | high_risk = "true"
  | line_format "{{.patient_name}} | {{.medication}} | {{.unit}} | {{.prescriber}}"
```

### 3.4 Drilldown

- Clicar em dose atrasada: navega para cockpit do paciente com foco em medicamentos.
- Clicar em interacao: mostra detalhes da interacao, medicamentos envolvidos, e opcoes de resolucao.
- Clicar em unidade no heatmap: expande para lista de pacientes da unidade com status de medicacao.

---

## 4. Dashboard 3: Pain & Calls Board

### 4.1 Proposito

Monitoramento centralizado de dor reportada e chamadas de pacientes, com foco em tempo de resposta e efetividade de intervencoes analgesicas.

**Owner**: Diretoria de Enfermagem + Equipe de Dor

### 4.2 Paineis Principais

| Painel | Descricao | Tipo |
|---|---|---|
| **Mapa de Dor por Unidade** | Pacientes com dor >= 4 por unidade, colorido por intensidade | Heatmap |
| **Dor sem Intervencao** | GAP-004 ativo: pacientes com dor alta sem acao | Critical table |
| **Tendencia de Dor Institucional** | Score medio de dor por unidade nas ultimas 24h | Multi-line |
| **Efetividade Analgesica** | % de intervencoes que reduziram dor em >= 2 pontos | Bar chart |
| **Chamadas Ativas** | Chamadas em andamento sem resposta | Real-time list |
| **Tempo Medio de Resposta** | Por unidade e turno | Heatmap |
| **Chamadas sem Resposta no SLA** | GAP-005 ativo | Alert list |
| **Frequencia de Chamadas por Paciente** | Pacientes com chamadas acima do baseline | Table |
| **Correlacao Dor-Chamada** | Chamadas que precederam registro de dor | Scatter plot |
| **Reavaliacao Pendente** | Pacientes que necessitam reavaliacao de dor | Table |

### 4.3 Queries

**Mapa de Dor (PromQL)**:
```promql
velya_patient_pain_score{score_value >= 4}
* on(patient_id) group_left(unit, bed, patient_name)
  velya_patient_location_info
```

**Dor sem Intervencao (PostgreSQL)**:
```sql
SELECT p.patient_name, p.unit, p.bed,
       pa.score AS pain_score,
       pa.assessed_at,
       EXTRACT(EPOCH FROM (NOW() - pa.assessed_at))/60 AS minutes_since,
       pa.assessed_by_name
FROM pain_assessments pa
JOIN patients p ON p.id = pa.patient_id
LEFT JOIN pain_interventions pi ON pi.patient_id = pa.patient_id
  AND pi.administered_at BETWEEN pa.assessed_at AND pa.assessed_at + INTERVAL '30 minutes'
WHERE pa.score >= 7
  AND pa.assessed_at > NOW() - INTERVAL '4 hours'
  AND pi.id IS NULL
  AND p.encounter_status = 'active'
ORDER BY pa.score DESC, pa.assessed_at ASC;
```

**Tempo de Resposta a Chamadas (PromQL)**:
```promql
histogram_quantile(0.50,
  sum by (unit, le) (rate(velya_nurse_call_response_seconds_bucket[1h]))
)
```

**Efetividade Analgesica (PostgreSQL)**:
```sql
SELECT u.unit_name,
       COUNT(*) FILTER (WHERE post.score <= pre.score - 2) AS effective,
       COUNT(*) AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE post.score <= pre.score - 2) / NULLIF(COUNT(*), 0), 1) AS effectiveness_pct
FROM pain_interventions pi
JOIN pain_assessments pre ON pre.id = pi.pre_assessment_id
JOIN pain_assessments post ON post.id = pi.post_assessment_id
JOIN units u ON u.id = pi.unit_id
WHERE pi.administered_at > NOW() - INTERVAL '24 hours'
GROUP BY u.unit_name
ORDER BY effectiveness_pct ASC;
```

### 4.4 Drilldown

- Clicar em paciente no mapa de dor: abre historico de dor do paciente com todas intervencoes.
- Clicar em chamada ativa: mostra localizacao do paciente, motivo da chamada, equipe disponivel.
- Clicar em unidade: expande para visualizar todos pacientes com suas notas de dor e chamadas.

---

## 5. Dashboard 4: Handoff Chain Board

### 5.1 Proposito

Visualizacao da cadeia de handoffs (transferencias de responsabilidade) por paciente e por profissional, garantindo que nenhum paciente fique sem responsavel definido em qualquer momento.

**Owner**: Diretoria de Enfermagem + Coordenacao Medica

### 5.2 Paineis Principais

| Painel | Descricao | Tipo |
|---|---|---|
| **Handoffs Pendentes** | Handoffs solicitados sem aceite, ordenados por timeout | Critical table |
| **Cadeia de Custodia** | Linha do tempo de handoffs por paciente (quem -> quem -> quem) | Sankey/flow |
| **Taxa de Aceite por Turno** | % de handoffs aceitos dentro do SLA por turno/unidade | Heatmap |
| **Tempo Medio de Aceite** | Por tipo de handoff e unidade | Bar chart |
| **Handoffs Rejeitados** | Handoffs recusados com justificativas | Table |
| **Pacientes sem Responsavel** | GAP-009: pacientes em transicao sem responsavel atribuido | Critical alert |
| **Qualidade do Handoff** | Completude do I-PASS/SBAR no handoff | Progress bar per unit |
| **Historico de Escalacoes** | Handoffs que foram escalados por timeout | Timeline |
| **Overlap de Turno** | Profissionais com overlap de responsabilidade | Gantt |
| **Carga por Profissional** | Numero de pacientes por profissional por turno | Bar chart |

### 5.3 Queries

**Handoffs Pendentes (PostgreSQL)**:
```sql
SELECT h.id, h.patient_name, h.from_practitioner_name, h.to_practitioner_name,
       h.priority, h.requested_at, h.timeout_at,
       CASE
         WHEN NOW() > h.timeout_at THEN 'OVERDUE'
         WHEN NOW() > h.timeout_at - INTERVAL '2 minutes' THEN 'WARNING'
         ELSE 'PENDING'
       END AS status,
       h.unit, h.handoff_type
FROM handoffs h
WHERE h.status = 'requested'
ORDER BY h.timeout_at ASC;
```

**Taxa de Aceite (PromQL)**:
```promql
sum by (unit, shift) (rate(velya_handoff_accepted_in_sla_total[24h]))
/ sum by (unit, shift) (rate(velya_handoff_requested_total[24h]))
* 100
```

**Cadeia de Custodia (Loki)**:
```logql
{namespace="velya", service="handoff-service"}
  | json
  | patient_id = "<PATIENT_ID>"
  | event_type =~ "handoff\\.(requested|accepted|rejected|escalated)"
  | line_format "{{.timestamp}} {{.from_name}} → {{.to_name}} [{{.status}}] {{.handoff_type}}"
```

### 5.4 Drilldown

- Clicar em handoff pendente: abre detalhes com opcao de reenviar/escalar manualmente.
- Clicar em paciente sem responsavel: abre formulario de atribuicao emergencial.
- Clicar em profissional: mostra todos os handoffs recentes e carga atual.

---

## 6. Dashboard 5: Delay and Gap Board

### 6.1 Proposito

Painel central para monitoramento de todos os gaps detectados pelo motor de regras (ver `gap-detection-rules.md`) e atrasos na jornada do paciente.

**Owner**: Coordenacao de Qualidade + Supervisao de Enfermagem

### 6.2 Paineis Principais

| Painel | Descricao | Tipo |
|---|---|---|
| **Gaps Criticos Ativos** | GAPs com severidade CRITICAL nao resolvidos | Critical alert |
| **Gaps por Severidade** | Distribuicao de gaps ativos por severidade | Donut chart |
| **Gaps por Tipo** | Top 10 tipos de gap mais frequentes (24h) | Bar chart |
| **Gaps por Unidade** | Heatmap de gaps ativos por unidade | Heatmap |
| **Tendencia de Gaps** | Evolucao do total de gaps por severidade (7 dias) | Stacked area |
| **Tempo de Resolucao** | Distribuicao do tempo de resolucao por tipo de gap | Box plot |
| **Gaps Recorrentes** | Pacientes/profissionais com gaps repetitivos | Table |
| **Atrasos em Andamento** | Ordens/processos com atraso ativo (SLA em risco) | Table |
| **Pipeline de Resultados** | Exames aguardando resultado com tempo de espera | Table |
| **Taxa de Falso Positivo** | % de gaps marcados como falso positivo por regra | Bar chart |

### 6.3 Queries

**Gaps Criticos Ativos (PostgreSQL)**:
```sql
SELECT g.id, g.rule_id, g.patient_name, g.unit, g.bed,
       g.description, g.detected_at,
       EXTRACT(EPOCH FROM (NOW() - g.detected_at))/60 AS minutes_active,
       g.assigned_to_name, g.escalation_count
FROM detected_gaps g
WHERE g.severity = 'CRITICAL'
  AND g.status NOT IN ('resolved', 'false_positive')
ORDER BY g.detected_at ASC;
```

**Gaps por Unidade (PromQL)**:
```promql
sum by (unit, severity) (velya_gap_active_count)
```

**Tendencia de Gaps (PromQL)**:
```promql
sum by (severity) (velya_gap_detected_total) - sum by (severity) (velya_gap_resolved_total)
```

**Atrasos em Andamento (PostgreSQL)**:
```sql
SELECT d.patient_name, d.unit, d.bed, d.delay_type,
       d.expected_time, d.current_delay_minutes,
       d.sla_minutes,
       ROUND(100.0 * d.current_delay_minutes / NULLIF(d.sla_minutes, 0), 0) AS sla_pct_used,
       d.assigned_to_name
FROM active_delays d
WHERE d.current_delay_minutes > 0
ORDER BY sla_pct_used DESC;
```

### 6.4 Drilldown

- Clicar em gap: abre detalhes completos com historico de eventos do paciente no momento do gap.
- Clicar em unidade no heatmap: lista todos os gaps da unidade com filtros.
- Clicar em regra na taxa de falso positivo: abre historico de desempenho da regra para calibracao.

---

## 7. Dashboard 6: Documentation Integrity Board

### 7.1 Proposito

Monitoramento da integridade, completude e qualidade da documentacao clinica de todos os pacientes internados.

**Owner**: Coordenacao Medica + SAME (Servico de Arquivo Medico)

### 7.2 Paineis Principais

| Painel | Descricao | Tipo |
|---|---|---|
| **Completude por Unidade** | % media de completude documental por unidade | Heatmap |
| **Documentos Pendentes** | Evolucoes, notas, laudos nao registrados no prazo | Table |
| **Assinaturas Pendentes** | Documentos aguardando assinatura digital | Table |
| **Copy-Forward Detectado** | GAP-013: evolucoes com alta similaridade | Alert table |
| **Conflitos Documentais** | GAP-011: informacoes contraditorias entre documentos | Alert table |
| **Autoria Faltante** | GAP-012: documentos sem autoria valida | Table |
| **Correcoes Tardias** | GAP-010: taxa de amendments tardios por profissional | Bar chart |
| **Consentimentos** | Status de consentimentos obrigatorios | Checklist per patient |
| **Evolucoes por Turno** | Evolucoes registradas vs esperadas por turno | Stacked bar |
| **Qualidade Textual** | Indicadores de qualidade (extensao, estrutura, codificacao) | Multi-metric |

### 7.3 Queries

**Completude por Unidade (PromQL)**:
```promql
avg by (unit) (velya_documentation_completeness_percentage)
```

**Assinaturas Pendentes (PostgreSQL)**:
```sql
SELECT ps.document_type, ps.patient_name, ps.unit, ps.bed,
       ps.required_from_name, ps.requested_at,
       ps.deadline,
       CASE WHEN NOW() > ps.deadline THEN true ELSE false END AS overdue,
       EXTRACT(EPOCH FROM (NOW() - ps.requested_at))/3600 AS hours_pending
FROM pending_signatures ps
WHERE ps.status = 'pending'
ORDER BY ps.deadline ASC;
```

**Copy-Forward Detectado (PostgreSQL)**:
```sql
SELECT cf.patient_name, cf.unit, cf.author_name,
       cf.source_date, cf.target_date,
       cf.similarity_percentage,
       cf.has_reassessment_evidence,
       cf.reviewed
FROM copy_forward_detections cf
WHERE cf.similarity_percentage > 0.90
  AND cf.detected_at > NOW() - INTERVAL '7 days'
ORDER BY cf.similarity_percentage DESC;
```

**Evolucoes por Turno (PostgreSQL)**:
```sql
SELECT u.unit_name, s.shift_name,
       COUNT(*) FILTER (WHERE d.registered = true) AS registered,
       COUNT(*) AS expected,
       ROUND(100.0 * COUNT(*) FILTER (WHERE d.registered = true) / NULLIF(COUNT(*), 0), 1) AS pct
FROM expected_daily_notes d
JOIN units u ON u.id = d.unit_id
JOIN shifts s ON s.id = d.shift_id
WHERE d.expected_date = CURRENT_DATE
GROUP BY u.unit_name, s.shift_name
ORDER BY pct ASC;
```

### 7.4 Drilldown

- Clicar em documento pendente: abre o formulario do documento para preenchimento.
- Clicar em conflito: mostra lado a lado os documentos conflitantes para reconciliacao.
- Clicar em copy-forward: mostra diff entre evolucao original e copiada.

---

## 8. Dashboard 7: Audit Timeline Explorer

### 8.1 Proposito

Ferramenta interativa para auditoria retrospectiva da jornada de um paciente especifico. Permite reconstruir qualquer momento da internacao com todos os eventos, gaps, handoffs e decisoes.

**Owner**: Comissao de Revisao de Prontuarios + Gestao de Riscos

### 8.2 Paineis Principais

| Painel | Descricao | Tipo |
|---|---|---|
| **Busca de Paciente** | Busca por nome, prontuario, leito, data de internacao | Search bar |
| **Timeline Completa** | Todos os eventos do ledger para o paciente, filtravel | Interactive timeline |
| **Filtros por Tipo** | Filtrar por tipo de evento (clinico, operacional, gap, handoff) | Multi-select |
| **Filtros por Ator** | Filtrar por profissional envolvido | Multi-select |
| **Provenance Chain** | Cadeia de proveniencia para cada evento selecionado | Tree view |
| **Estado do Twin Historico** | Reconstrucao do Digital Twin em qualquer ponto do tempo | Snapshot viewer |
| **Gaps Historicos** | Todos os gaps detectados e seu desfecho | Timeline overlay |
| **Detalhe do Evento** | Recurso FHIR completo do evento selecionado | JSON viewer |
| **Audit Trail de Acesso** | Quem acessou este prontuario, quando, e o que visualizou | Table |
| **Exportacao** | Exportar timeline filtrada para PDF/CSV (com trilha de auditoria) | Action buttons |

### 8.3 Queries

**Timeline Completa (Loki)**:
```logql
{namespace="velya", service="event-ledger"}
  | json
  | patient_id = "<PATIENT_ID>"
  | timestamp >= "<START_TIME>" and timestamp <= "<END_TIME>"
  | line_format "{{.timestamp}} [{{.event_type}}] {{.actor_name}} — {{.summary}}"
```

**Provenance Chain (PostgreSQL)**:
```sql
WITH RECURSIVE provenance_chain AS (
  SELECT p.id, p.target_reference, p.recorded, p.activity,
         p.agent_who_reference, p.agent_who_display,
         p.entity_what_reference, p.entity_role,
         1 AS depth
  FROM provenance p
  WHERE p.target_reference = :event_reference
  
  UNION ALL
  
  SELECT p2.id, p2.target_reference, p2.recorded, p2.activity,
         p2.agent_who_reference, p2.agent_who_display,
         p2.entity_what_reference, p2.entity_role,
         pc.depth + 1
  FROM provenance p2
  JOIN provenance_chain pc ON p2.target_reference = pc.entity_what_reference
  WHERE pc.depth < 10
)
SELECT * FROM provenance_chain ORDER BY depth, recorded;
```

**Audit Trail de Acesso (PostgreSQL)**:
```sql
SELECT ae.recorded, ae.agent_name, ae.agent_role,
       ae.action, ae.entity_description,
       ae.outcome, ae.source_ip,
       ae.session_duration_seconds,
       ae.data_accessed_summary
FROM audit_events ae
WHERE ae.patient_id = :patient_id
  AND ae.recorded BETWEEN :start_time AND :end_time
ORDER BY ae.recorded DESC;
```

### 8.4 Drilldown

- Clicar em qualquer evento: abre recurso FHIR completo + provenance.
- Clicar em gap na overlay: mostra detalhes do gap com resolucao.
- Clicar em ponto na timeline: reconstroi estado do twin naquele momento.
- Exportar: gera PDF com timeline + trilha de acesso da exportacao no audit log.

---

## 9. Dashboard 8: Command Center Patient Flow Overlay

### 9.1 Proposito

Visao macro do fluxo de pacientes no hospital inteiro, sobreposta ao mapa fisico. Usada pelo Command Center para gestao de capacidade, deteccao de gargalos e coordenacao de transferencias.

**Owner**: Command Center + Diretoria Operacional

### 9.2 Paineis Principais

| Painel | Descricao | Tipo |
|---|---|---|
| **Mapa do Hospital** | Planta baixa com ocupacao por unidade (heatmap) | Floor plan overlay |
| **Ocupacao em Tempo Real** | Leitos ocupados/disponiveis/bloqueados por unidade | Stacked bar |
| **Fluxo de Admissoes/Altas** | Entradas e saidas por hora (ultimas 24h + projecao) | Area chart |
| **Giro de Leito** | Tempo medio de giro (alta -> limpeza -> nova admissao) | Gauge per unit |
| **Pacientes para Alta** | Pacientes com criterios de alta atendidos aguardando efetivacao | Table |
| **Transferencias Pendentes** | Solicitacoes de transferencia interna em andamento | Flow diagram |
| **Risco Operacional por Unidade** | Media do risco operacional dos twins de cada unidade | Heatmap |
| **Staffing vs Carga** | Ratio profissional/paciente por unidade e turno | Comparison bar |
| **Tempo de Permanencia** | Distribuicao do tempo de permanencia vs esperado por DRG | Box plot |
| **Alertas Institucionais** | Alertas de capacidade, surtos, equipamentos indisponiveis | Alert feed |
| **Projecao de Demanda** | Projecao de admissoes/altas para proximas 12h | Forecast line |
| **KPIs Institucionais** | Taxa de ocupacao, TMP, reinternacao, mortalidade | Stat panels |

### 9.3 Queries

**Ocupacao em Tempo Real (PromQL)**:
```promql
# Leitos ocupados por unidade
sum by (unit) (velya_bed_status{status="occupied"})

# Leitos disponiveis
sum by (unit) (velya_bed_status{status="available"})

# Leitos bloqueados (limpeza, manutencao)
sum by (unit) (velya_bed_status{status="blocked"})

# Taxa de ocupacao
sum by (unit) (velya_bed_status{status="occupied"})
/ sum by (unit) (velya_bed_total)
* 100
```

**Fluxo de Admissoes/Altas (PromQL)**:
```promql
# Admissoes por hora
sum(increase(velya_encounter_admission_total[1h]))

# Altas por hora
sum(increase(velya_encounter_discharge_total[1h]))
```

**Pacientes para Alta (PostgreSQL)**:
```sql
SELECT p.patient_name, p.unit, p.bed,
       p.admission_date,
       p.days_of_stay,
       p.attending_physician_name,
       do.total_objectives,
       do.met_objectives,
       do.blocked_objectives,
       p.expected_discharge_date
FROM patients p
JOIN discharge_objective_summary do ON do.patient_id = p.id
WHERE p.encounter_status = 'active'
  AND do.met_objectives = do.total_objectives
  AND do.blocked_objectives = 0
  AND p.discharge_order_status IS NULL
ORDER BY p.days_of_stay DESC;
```

**Giro de Leito (PromQL)**:
```promql
histogram_quantile(0.50,
  sum by (unit, le) (rate(velya_bed_turnaround_seconds_bucket[24h]))
) / 60
```

**Staffing vs Carga (PostgreSQL)**:
```sql
SELECT u.unit_name, s.shift_name,
       COUNT(DISTINCT st.practitioner_id) AS staff_count,
       COUNT(DISTINCT p.id) AS patient_count,
       ROUND(COUNT(DISTINCT p.id)::numeric / NULLIF(COUNT(DISTINCT st.practitioner_id), 0), 1) AS ratio,
       u.target_ratio
FROM units u
JOIN staff_assignments st ON st.unit_id = u.id AND st.shift_date = CURRENT_DATE
JOIN shifts s ON s.id = st.shift_id AND s.is_current = true
JOIN patients p ON p.current_unit_id = u.id AND p.encounter_status = 'active'
GROUP BY u.unit_name, s.shift_name, u.target_ratio
ORDER BY ratio DESC;
```

### 9.4 Drilldown

- Clicar em unidade no mapa: expande para visualizacao de leitos da unidade com status de cada paciente.
- Clicar em paciente para alta: abre cockpit do paciente com foco em objetivos de alta.
- Clicar em transferencia: mostra timeline da solicitacao com tempo em cada etapa.
- Clicar em alerta: abre detalhes e acoes sugeridas.

---

## 10. Controle de Acesso aos Dashboards

### 10.1 Matriz de Visibilidade

| Dashboard | Enfermeiro Assistencial | Coord. Enfermagem | Medico Assistencial | Coord. Medico | Farmaceutico | Qualidade | Command Center | Diretoria |
|---|---|---|---|---|---|---|---|---|
| Patient Journey Cockpit | Proprios pacientes | Unidade | Proprios pacientes | Unidade | Medicamentos | Todos | Todos | Todos |
| Medication Integrity | Proprios pacientes | Unidade | Proprios pacientes | Unidade | Todos | Todos | Resumo | Resumo |
| Pain & Calls | Proprios pacientes | Unidade | Proprios pacientes | Unidade | N/A | Todos | Resumo | Resumo |
| Handoff Chain | Proprios | Unidade | Proprios | Unidade | N/A | Todos | Todos | Resumo |
| Delay and Gap | Proprios pacientes | Unidade | Proprios pacientes | Unidade | Farmacia | Todos | Todos | Resumo |
| Documentation Integrity | Proprios | Unidade | Proprios | Unidade | N/A | Todos | N/A | Resumo |
| Audit Timeline Explorer | N/A | Com justificativa | N/A | Com justificativa | N/A | Todos | N/A | Todos |
| Command Center Overlay | N/A | Resumo unidade | N/A | Resumo unidade | N/A | Resumo | Todos | Todos |

### 10.2 Regras de Acesso

1. Todo acesso a dashboard gera `AuditEvent`.
2. Dashboards com dados de pacientes especificos requerem vinculo ao encontro (ABAC).
3. Audit Timeline Explorer requer justificativa registrada para acesso.
4. Exportacao de dados requer autorizacao do coordenador.
5. Dados sao mascarados conforme papel (ver `minimum-necessary-access-model.md`).

---

## 11. Infraestrutura Tecnica

### 11.1 Stack

| Componente | Tecnologia | Finalidade |
|---|---|---|
| **Dashboards** | Grafana 10+ | Visualizacao |
| **Metricas** | Prometheus + Thanos | Armazenamento de metricas |
| **Logs/Eventos** | Loki | Armazenamento de eventos |
| **Dados Estruturados** | PostgreSQL 16 | Queries complexas |
| **Cache** | Redis Cluster | Estado do twin em tempo real |
| **Alertas** | Grafana Alerting + AlertManager | Notificacoes |
| **Autenticacao** | Keycloak (OIDC) | SSO + RBAC |

### 11.2 Performance

| Metrica | Meta |
|---|---|
| Tempo de carregamento do dashboard | < 3 segundos |
| Refresh rate (tempo real) | 10 segundos |
| Retencao de metricas (Thanos) | 2 anos |
| Retencao de logs (Loki) | 1 ano (hot) + 5 anos (cold) |
| Usuarios concorrentes | > 200 |

### 11.3 Monitoramento dos Dashboards

```promql
# Tempo de carregamento
histogram_quantile(0.95, rate(grafana_dashboard_load_duration_seconds_bucket[5m]))

# Erros de query
rate(grafana_datasource_request_errors_total[5m])

# Usuarios ativos
grafana_active_users
```
