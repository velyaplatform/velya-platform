# Modelo de Observabilidade de Negócio — Velya Platform

> Observabilidade de negócio monitora a operação hospitalar, não apenas a tecnologia.
> A pergunta não é "o serviço está up?", mas "pacientes estão recebendo cuidado dentro do prazo?"
> Última atualização: 2026-04-08

---

## 1. Princípio: Separação entre Sinais Técnicos e Clínicos

| Tipo | Exemplo de pergunta | Ferramenta |
|------|--------------------|-----------| 
| Técnico | O discharge-orchestrator está respondendo em < 500ms? | Prometheus + API RED dashboard |
| Clínico | Quantos pacientes estão aguardando alta há mais de 4 horas? | Métricas de negócio + Patient Flow Command Board |

Os dois tipos são complementares. Um serviço tecnicamente saudável pode estar falhando clinicamente (processando altas corretamente mas com bloqueadores clínicos não resolvidos). E vice-versa.

**Regra**: Gestores clínicos nunca precisam olhar para CPU e memória. Engenharia nunca precisa olhar para número de leitos. Os dashboards devem ser desenhados para audiências específicas.

---

## 2. Métricas de Fluxo do Paciente

### 2.1 Ocupação e Capacidade de Leitos

```promql
# Leitos por unidade e status
velya_patient_flow_active_count{unit, status}
# status: occupied, available, blocked, reserved-for-discharge

# Implementação (patient-flow-service, a cada 60 segundos):
# Consulta o banco de dados e atualiza o gauge com a contagem atual
# NUNCA usar patient name como label — apenas unit e status
```

**Exemplo de implementação**:
```typescript
// patient-flow-service: src/metrics/bed-capacity.metrics.ts
import { Gauge } from 'prom-client';

const bedCount = new Gauge({
  name: 'velya_patient_flow_active_count',
  help: 'Número de leitos por unidade e status',
  labelNames: ['unit', 'status', 'environment'],
});

// Executar a cada 60 segundos
async function updateBedMetrics(): Promise<void> {
  const counts = await patientFlowRepository.getBedCountByUnitAndStatus();

  // Resetar valores para detectar unidades que ficaram com 0
  bedCount.reset();

  for (const { unit, status, count } of counts) {
    bedCount.labels({ unit, status, environment: process.env.NODE_ENV }).set(count);
  }
}
```

**Queries para visualização**:
```promql
# % de ocupação por unidade
velya_patient_flow_active_count{status="occupied"} /
(velya_patient_flow_active_count{status="occupied"} + velya_patient_flow_active_count{status="available"})

# Total de leitos disponíveis no hospital
sum(velya_patient_flow_active_count{status="available"})

# Unidades com ocupação > 90%
(
  velya_patient_flow_active_count{status="occupied"} /
  (velya_patient_flow_active_count{status="occupied"} + velya_patient_flow_active_count{status="available"})
) > 0.90
```

### 2.2 Tempo de Internação

```promql
# Histograma do tempo de internação por unidade
velya_patient_admission_duration_seconds{unit}
# Registrar ao final de cada internação (discharge efetivado)

# Query para tempo médio de internação na UTI nas últimas 24 horas
histogram_quantile(0.50,
  rate(velya_patient_admission_duration_seconds_bucket{unit="UTI"}[24h])
) / 3600  # converter para horas
```

### 2.3 Taxa de Re-internação (Indicador de Qualidade)

```promql
# Readmissão em até 30 dias após alta
velya_patient_readmission_total{days_since_discharge, unit}
# Registrar quando paciente é reinternado e há internação anterior nos últimos 30 dias

# Taxa de readmissão em 30 dias (meta: < 10%)
rate(velya_patient_readmission_total{days_since_discharge="30"}[30d]) /
rate(velya_patient_admission_total[30d])
```

---

## 3. Métricas de Discharge Coordination

### 3.1 Altas Pendentes por Estágio e Bloqueador

```promql
# Altas pendentes por estágio do processo
velya_discharge_pending_total{status, blocker_type, unit}

# Estágios:
# medical-ready           — médico deu alta, aguardando demais etapas
# awaiting-documentation  — aguardando documentação (sumário de alta, receitas)
# awaiting-transport      — aguardando transporte do paciente
# awaiting-social-work    — aguardando resolução de questão social
# complete                — alta efetivada (não pendente)

# Tipos de bloqueador:
# medication   — pendência de medicação (dispensação, reconciliação)
# exam         — exame pendente de resultado
# social       — questão social (família, moradia, cuidador)
# transport    — logística de transporte
# administrative — documentação administrativa
```

**Visualização no Grafana — Bar Chart de Bloqueadores**:
```promql
# Bloqueadores por tipo na última hora
sum(velya_discharge_pending_total{status!="complete"}) by (blocker_type)
```

### 3.2 Idade dos Bloqueadores

```promql
# Idade do bloqueador mais antigo por tipo e unidade
velya_discharge_blocker_age_seconds{blocker_type, unit}
# Valor: time() - timestamp_criacao_bloqueador
# Atualizado: a cada 60 segundos

# Bloqueadores com mais de 4 horas sem resolução (threshold crítico)
velya_discharge_blocker_age_seconds > 14400

# Histograma de idades para distribuição
velya_discharge_blocker_age_seconds_histogram{blocker_type}
```

### 3.3 Tempo Decision → Alta Efetiva

```promql
# Histograma: tempo entre decisão médica de alta e efetivação
velya_discharge_decision_to_discharge_seconds{unit}
# Buckets: [1800, 3600, 7200, 14400, 28800, 86400] (30min a 24h)

# P95 de tempo decision→alta por unidade
histogram_quantile(0.95,
  rate(velya_discharge_decision_to_discharge_seconds_bucket{unit="$unit"}[24h])
) / 3600  # em horas
```

### 3.4 Taxa de Alta Dentro do Prazo Esperado

```promql
# Meta: > 80% das altas concluídas dentro de 4 horas após decisão médica
velya_discharge_on_time_total{unit}  # altas concluídas dentro do prazo
velya_discharge_total{unit}          # total de altas

# Taxa de alta dentro do prazo
rate(velya_discharge_on_time_total[24h]) / rate(velya_discharge_total[24h])
```

---

## 4. Métricas de Task Inbox

### 4.1 Profundidade da Fila por Prioridade

```promql
# Fila atual por prioridade
velya_task_inbox_depth{priority, task_type}
# priority: critical, high, medium, low
# task_type: discharge-request, medication-review, lab-result, consultation, handoff-item

# SLAs por prioridade:
# critical: resposta em 15 minutos
# high: resposta em 1 hora
# medium: resposta em 4 horas
# low: resposta em 24 horas
```

### 4.2 Tarefas Vencidas (Past SLA)

```promql
# Tarefas que ultrapassaram o SLA por prioridade
velya_task_overdue_total{priority, task_type}
# Calculado: tarefas onde current_time > created_at + SLA_por_prioridade

# Visualização: Stat com threshold crítico em qualquer valor > 0 para critical
velya_task_overdue_total{priority="critical"}
```

### 4.3 Tarefas sem Dono

```promql
# Tarefas sem assignee por prioridade
velya_task_inbox_unowned_total{priority}
# Alerta: priority=critical AND value > 5 = high severity
```

### 4.4 Tempo de Resposta por Tipo de Tarefa

```promql
# Histograma de tempo de resposta (criação → atribuição → conclusão)
velya_task_response_duration_seconds{priority, task_type}

# P50 de tempo de resposta para tarefas críticas
histogram_quantile(0.50,
  rate(velya_task_response_duration_seconds_bucket{priority="critical"}[$__rate_interval])
) / 60  # em minutos

# Taxa de conclusão dentro do SLA por turno
# (implementado com label shift: morning, afternoon, night)
```

### 4.5 Taxa de Conclusão por Turno

```promql
# Tarefas concluídas por shift (morning=07:00-13:00, afternoon=13:00-19:00, night=19:00-07:00)
velya_task_completed_total{priority, shift}
velya_task_created_total{priority, shift}

# Taxa de conclusão por turno
rate(velya_task_completed_total[8h]) / rate(velya_task_created_total[8h])
```

---

## 5. Métricas de Handoff entre Turnos

### 5.1 Duração do Processo de Passagem de Turno

```promql
# Histograma de duração de handoffs de turno por unidade
velya_handoff_duration_seconds{unit, from_shift, to_shift}
# Buckets: [300, 900, 1800, 3600, 7200] (5min a 2h)
# Meta: < 30 minutos para handoff completo

# P95 de duração de handoff por unidade
histogram_quantile(0.95,
  rate(velya_handoff_duration_seconds_bucket{unit="$unit"}[$__rate_interval])
) / 60  # em minutos
```

### 5.2 Completude do Checklist de Handoff

```promql
# Proporção de itens obrigatórios do checklist preenchidos
velya_handoff_checklist_completeness_ratio{unit}
# Valor: 0.0 a 1.0
# Meta: > 0.90 (pelo menos 90% dos itens preenchidos)
# Alerta: < 0.80 = médio severity
```

### 5.3 Pendências Transferidas sem Contexto Suficiente

```promql
# Itens transferidos sem contexto adequado
velya_handoff_pending_without_context_total{unit, item_type}
# Registrar quando item de handoff não tinha campos de contexto obrigatórios preenchidos
# (nota de contexto vazia, responsável não identificado, prazo não definido)
```

---

## 6. Latência de Alertas Clínicos

### 6.1 Latência de Entrega

```promql
# Histograma de latência de entrega de alertas clínicos
velya_clinical_alert_delivery_latency_seconds{alert_type, unit, channel}
# alert_type: critical-lab-result, medication-alert, deterioration-warning
# channel: push-notification, in-app, sms

# SLO: P95 < 30 segundos para todos os tipos de alerta clínico
# Alerta CRÍTICO: P95 > 30s

histogram_quantile(0.95,
  rate(velya_clinical_alert_delivery_latency_seconds_bucket[$__rate_interval])
)
```

---

## 7. Dashboard Patient Flow Command Board — Layout Detalhado

### Propósito e Audiência

**Audiência**: Gestão Hospitalar, Coordenadores de Alta, NOC Clínico
**Frequência**: Sempre aberto durante horário operacional
**Refresh**: Automático a cada 30 segundos

### Variáveis de Dashboard

- `$unit`: multi-value — UTI, Enfermaria-A, Enfermaria-B, Cirurgia, Pronto-Socorro
- `$shift`: Current (calculado), Morning, Afternoon, Night

---

### Linha 1: KPIs Hospitalares (5 Stat panels)

**Painel 1 — Total de Pacientes Aguardando Alta**
```promql
sum(velya_discharge_pending_total{status!="complete"})
```
Threshold: verde < 10, amarelo < 20, vermelho > 20

**Painel 2 — Leitos Disponíveis Total**
```promql
sum(velya_patient_flow_active_count{status="available"})
```
Threshold: verde > 20, amarelo > 10, vermelho < 10

**Painel 3 — Bloqueador Mais Antigo (em horas)**
```promql
max(velya_discharge_blocker_age_seconds) / 3600
```
Threshold: verde < 2h, amarelo < 4h, vermelho > 4h

**Painel 4 — Tarefas Críticas Vencidas**
```promql
sum(velya_task_overdue_total{priority="critical"})
```
Threshold: verde = 0, vermelho > 0

**Painel 5 — Taxa de Alta Dentro do Prazo (últimas 24h)**
```promql
sum(rate(velya_discharge_on_time_total[24h])) /
sum(rate(velya_discharge_total[24h]))
```
Threshold: verde > 0.85, amarelo > 0.70, vermelho < 0.70

---

### Linha 2: Canvas — Mapa de Leitos por Unidade

**Visualização**: Canvas com planta esquemática das unidades hospitalares

**Implementação**:
- Cada unidade representada como bloco retangular
- Leitos representados como pontos dentro da unidade
- Cor do leito baseada em `velya_patient_flow_active_count`:
  - Verde: `status="available"`
  - Amarelo: `status="occupied"`
  - Vermelho: `status="blocked"` (paciente com alta médica mas bloqueador ativo)
  - Cinza: `status="reserved-for-discharge"` (processo de alta em andamento)
- Número no centro de cada unidade: N disponíveis / N total
- Click em unidade: Data Link para dashboard de detalhe da unidade

---

### Linha 3: Bloqueadores de Alta (Bar Chart + Table)

**Painel 3a — Bar Chart: Bloqueadores por Tipo**
```promql
sum(velya_discharge_pending_total{status!="complete"}) by (blocker_type)
```
Bar Chart horizontal, ordenado por quantidade descendente.
Cores: cada tipo de bloqueador tem cor distinta.

**Painel 3b — Table: Altas Bloqueadas > 2h**

Colunas: Unidade | Tipo de Bloqueador | Tempo Bloqueado | Estágio Atual | Ação Sugerida

```promql
# Identificar altas bloqueadas há mais de 2 horas
velya_discharge_blocker_age_seconds{unit=~"$unit"} > 7200
```

Data Link: click em linha → abre logs do Loki com `workflow_id` do processo de alta

---

### Linha 4: Evolução Temporal (Time Series)

**Painel 4a — Altas Pendentes ao Longo do Turno**
```promql
sum(velya_discharge_pending_total{status!="complete"}) by (unit)
```
Time Series com linhas por unidade, threshold line visual em 20 altas pendentes.

**Painel 4b — Profundidade da Inbox por Prioridade**
```promql
velya_task_inbox_depth
```
Time Series com linhas por prioridade (critical=vermelho, high=laranja, medium=amarelo, low=verde).

---

### Linha 5: Histórico do Turno (Table de Tarefas Concluídas)

**Table: Tarefas Concluídas neste Turno**

```promql
increase(velya_task_completed_total[8h])
```
Colunas: Tipo de Tarefa | Prioridade | Quantidade | Dentro do SLA | % SLA

---

### Linha 6: Links para Dashboards de Detalhe

- Linha de texto (Text panel) com links: Discharge Control Board | Capacity Board | Inbox Intelligence | Agent Oversight | KEDA Monitor

---

## 8. Integração com Grafana Alerting para Contexto Clínico

### Annotations de Eventos Clínicos

Configurar annotations automáticas no Patient Flow Command Board para:

| Evento | Quando | Cor |
|--------|--------|-----|
| Alta Concluída | `increase(velya_discharge_total[1m]) > 0` | Verde |
| Bloqueador > 4h | `velya_discharge_blocker_age_seconds > 14400` | Vermelho |
| Pico de Admissões | `rate(velya_patient_admission_total[30m]) > threshold` | Laranja |
| Troca de Turno | Horários fixos: 07:00, 13:00, 19:00 | Cinza |

**Resultado**: O dashboard mostra visualmente quando eventos clínicos críticos ocorreram, facilitando correlação temporal ("a fila de tarefas cresceu logo após a troca de turno das 19h").

---

## 9. Relatório Operacional Diário

### Métricas para Relatório de Gestão (email diário)

Template de relatório gerado via Grafana Reporting (ou script via API do Grafana):

```
RELATÓRIO OPERACIONAL DIÁRIO — VELYA PLATFORM
Data: {data}

FLUXO DE PACIENTES
- Admissões hoje: {velya_patient_admission_total 24h}
- Altas efetivadas hoje: {velya_discharge_total 24h}
- Taxa de alta dentro do prazo: {velya_discharge_on_time_total / velya_discharge_total 24h}%
- Bloqueadores resolvidos: {decrease(velya_discharge_pending_total) 24h}
- Re-internações (30 dias): {velya_patient_readmission_total}

TASK INBOX
- Tarefas criadas hoje: {velya_task_created_total 24h}
- Tarefas concluídas hoje: {velya_task_completed_total 24h}
- Tarefas críticas vencidas: {velya_task_overdue_total priority=critical}

PERFORMANCE DE ALERTAS CLÍNICOS
- P95 de entrega: {histogram_quantile 0.95 velya_clinical_alert_delivery_latency_seconds}
- Total de alertas entregues: {velya_clinical_alert_total 24h}
```
