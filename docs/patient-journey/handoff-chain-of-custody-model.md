# Handoff Chain of Custody Model - Cadeia de Custodia do Cuidado

> Velya Platform - Documentacao Tecnica
> Ultima atualizacao: 2026-04-08
> Status: Especificacao Ativa

---

## 1. Visao Geral

O modelo de cadeia de custodia garante que cada paciente internado tenha,
em todo momento, um responsavel claramente identificado. Cada transferencia
de responsabilidade (handoff) e registrada com estrutura, contexto e aceitacao explicita.

### Principio

> **Nenhum paciente pode estar em "terra de ninguem". Se nao ha aceitacao explicita
> do handoff, o profissional de origem continua como responsavel ate resolucao.**

```
+------------------------------------------------------------------+
|  CADEIA DE CUSTODIA                                               |
|                                                                   |
|  Profissional A ----[HANDOFF]----> Profissional B                |
|       |                                  |                        |
|       |  Responsavel ATE                 |  Responsavel APOS     |
|       |  aceitacao explicita             |  aceitacao explicita   |
|       |                                  |                        |
|       +-- Se nao aceito em X min:        |                        |
|           - Handoff fica PENDENTE        |                        |
|           - Alerta para coordenacao      |                        |
|           - A continua responsavel       |                        |
+------------------------------------------------------------------+
```

---

## 2. Modelo de Custodia

### 2.1 Conceito de Custodia

```typescript
interface PatientCustody {
  /** Identificadores */
  patient_id: string;
  encounter_id: string;

  /** Custodia atual */
  current: {
    /** Medico responsavel (pode ser diferente do attending) */
    physician: CustodyHolder | null;

    /** Enfermeiro responsavel (do turno) */
    nurse: CustodyHolder | null;

    /** Tecnico de enfermagem designado */
    nursing_tech: CustodyHolder | null;

    /** Fisioterapeuta (se designado) */
    physiotherapist: CustodyHolder | null;

    /** Outros profissionais com custodia ativa */
    others: CustodyHolder[];
  };

  /** Status geral de custodia */
  status: CustodyStatus;

  /** Gaps de custodia ativos */
  active_gaps: CustodyGap[];

  /** Handoffs pendentes */
  pending_handoffs: PendingHandoff[];

  /** Historico de custodia */
  history: CustodyHistoryEntry[];
}

interface CustodyHolder {
  practitioner_id: string;
  name: string;
  role: string;
  registration: string;       // CRM, COREN, CREFITO, etc.
  assumed_at: string;
  shift: 'morning' | 'afternoon' | 'night' | 'on_call' | 'continuous';
  expected_until?: string;     // Quando espera-se a troca
  handoff_received_from?: string;
  handoff_id?: string;
}

type CustodyStatus =
  | 'complete'           // Todas as funcoes essenciais preenchidas
  | 'partial_gap'        // Alguma funcao sem responsavel (mas tem cobertura minima)
  | 'critical_gap'       // Funcao critica sem responsavel
  | 'handoff_in_progress' // Transicao em andamento
  | 'undefined';         // Estado nao definido (erro)

interface CustodyGap {
  gap_id: string;
  role: string;              // Papel sem responsavel
  started_at: string;
  duration_seconds: number;
  severity: 'critical' | 'high' | 'medium';
  reason: string;            // 'handoff_not_accepted', 'no_assignment', 'shift_gap'
  escalated: boolean;
  escalated_to?: string;
}

interface PendingHandoff {
  handoff_id: string;
  from: { id: string; name: string; role: string };
  to: { id: string; name: string; role: string };
  initiated_at: string;
  elapsed_seconds: number;
  urgency: 'routine' | 'urgent';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  pending_items_count: number;
}
```

### 2.2 Historico de Custodia

```typescript
interface CustodyHistoryEntry {
  entry_id: string;
  event_type: 'assumed' | 'transferred' | 'gap_started' | 'gap_ended' | 'handoff_completed';
  timestamp: string;

  practitioner: {
    id: string;
    name: string;
    role: string;
  };

  action: string; // "Assumiu custodia", "Transferiu para...", etc.
  handoff_id?: string;
  shift: string;
  duration_in_custody_seconds?: number;

  /** Indicadores no momento da transicao */
  snapshot?: {
    open_pending_items: number;
    active_calls: number;
    pain_score: number | null;
    medication_next_due: string | null;
    critical_alerts: number;
  };
}
```

---

## 3. Modelo de Handoff Estruturado

### 3.1 Handoff Completo

```typescript
interface StructuredHandoff {
  /** Identificador unico */
  handoff_id: string;

  /** Referencia ao paciente */
  patient_id: string;
  encounter_id: string;

  /** Origem */
  origin: {
    practitioner_id: string;
    practitioner_name: string;
    role: string;
    shift: string;
    ward: string;
  };

  /** Destino */
  destination: {
    practitioner_id: string;
    practitioner_name: string;
    role: string;
    shift: string;
    ward: string;
  };

  /** Motivo da transferencia */
  reason: HandoffReason;
  reason_detail?: string;

  /** Formato utilizado */
  format: HandoffFormat;

  /** Conteudo estruturado */
  content: HandoffContent;

  /** Pendencias transferidas */
  pending_items: HandoffPendingItem[];

  /** Avaliacao de risco */
  risk_assessment: {
    overall_risk: 'low' | 'medium' | 'high' | 'critical';
    clinical_stability: 'stable' | 'improving' | 'worsening' | 'unstable';
    documentation_completeness: number; // 0-100
    open_critical_items: number;
    pain_controlled: boolean;
    fall_risk: string;
    isolation: boolean;
  };

  /** Proximos passos */
  next_steps: Array<{
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    due_at?: string;
    assigned_to?: string;
  }>;

  /** O que foi feito */
  completed_actions: Array<{
    description: string;
    completed_at: string;
  }>;

  /** O que falta */
  remaining_actions: Array<{
    description: string;
    reason_not_completed: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }>;

  /** Ciclo de vida do handoff */
  lifecycle: {
    initiated_at: string;
    communicated_at?: string;   // Quando o conteudo foi transmitido
    communication_method: 'in_person' | 'phone' | 'video' | 'written_only';
    read_back_performed?: boolean; // Leitura de retorno feita?

    accepted_at?: string;
    acceptance_method: 'explicit' | 'implicit' | 'pending';

    refused_at?: string;
    refusal_reason?: string;

    expired_at?: string;  // Se nao aceito dentro do SLA

    transition_time_seconds?: number;  // Tempo entre inicio e aceitacao
    dead_time_seconds?: number;        // Tempo sem custodia definida
  };

  /** Status */
  status: HandoffStatus;

  /** FHIR */
  fhir_task_id: string;

  /** Evento do journey */
  journey_event_id: string;

  /** Metadados */
  metadata: {
    created_at: string;
    updated_at: string;
    auto_generated: boolean; // Se foi gerado automaticamente pelo sistema
    quality_score: number;   // Score de qualidade do handoff (0-100)
  };
}

type HandoffReason =
  | 'shift_change'           // Troca de turno
  | 'unit_transfer'          // Transferencia de unidade
  | 'procedure_transfer'     // Ida para procedimento
  | 'specialist_referral'    // Encaminhamento para especialista
  | 'break_coverage'         // Cobertura de intervalo
  | 'emergency_reassignment' // Reatribuicao por emergencia
  | 'census_balancing'       // Balanceamento de censo
  | 'discharge_handoff'      // Handoff para alta
  | 'patient_request'        // Solicitacao do paciente
  | 'other';

type HandoffFormat = 'SBAR' | 'I-PASS' | 'closed_loop' | 'simplified';

type HandoffStatus =
  | 'initiated'    // Handoff criado, ainda nao comunicado
  | 'communicated' // Conteudo transmitido ao destinatario
  | 'pending'      // Aguardando aceitacao
  | 'accepted'     // Aceito pelo destinatario
  | 'refused'      // Recusado pelo destinatario
  | 'expired'      // Nao aceito dentro do SLA
  | 'cancelled';   // Cancelado pelo originador
```

### 3.2 Formatos de Handoff

#### 3.2.1 SBAR

```typescript
interface SBARContent {
  format: 'SBAR';

  situation: {
    patient_name: string;
    age: number;
    location: string;
    primary_diagnosis: string;
    current_status: string;
    reason_for_handoff: string;
  };

  background: {
    admission_date: string;
    admission_reason: string;
    relevant_history: string[];
    allergies: string[];
    current_medications: string[];
    recent_procedures: string[];
    relevant_results: string[];
  };

  assessment: {
    current_assessment: string;
    vital_signs_summary: string;
    news_score: number;
    pain_summary: string;
    clinical_trajectory: 'improving' | 'stable' | 'worsening';
    concerns: string[];
  };

  recommendation: {
    plan_of_care: string;
    immediate_priorities: string[];
    monitoring_required: string[];
    anticipated_changes: string[];
    escalation_criteria: string[];
    physician_to_contact: string;
  };
}
```

#### 3.2.2 I-PASS

```typescript
interface IPASSContent {
  format: 'I-PASS';

  illness_severity: {
    level: 'stable' | 'watcher' | 'unstable';
    rationale: string;
  };

  patient_summary: {
    one_liner: string;  // Resumo em uma frase
    events_leading_to_admission: string;
    hospital_course: string;
    ongoing_assessment: string;
    plan: string;
  };

  action_list: Array<{
    action: string;
    timing: string;
    owner: string;
    priority: 'immediate' | 'within_shift' | 'next_24h';
    contingency: string; // "Se X acontecer, entao Y"
  }>;

  situation_awareness: {
    know_about: string[];      // O que precisa saber
    anticipate: string[];      // O que antecipar
    if_then_plans: Array<{     // Planos condicionais
      condition: string;
      action: string;
    }>;
  };

  synthesis_by_receiver: {
    summary: string;           // Resumo do receptor
    questions: string[];
    read_back_confirmed: boolean;
  };
}
```

#### 3.2.3 Closed Loop (Verificacao em Loop Fechado)

```typescript
interface ClosedLoopContent {
  format: 'closed_loop';

  /** Mensagem original do emissor */
  sender_message: {
    patient_summary: string;
    critical_items: string[];
    pending_items: string[];
    expected_actions: string[];
  };

  /** Repeticao pelo receptor */
  receiver_readback: {
    understood_summary: string;
    confirmed_critical_items: string[];
    confirmed_pending_items: string[];
    confirmed_actions: string[];
    questions_raised: string[];
  };

  /** Confirmacao final do emissor */
  sender_confirmation: {
    readback_accurate: boolean;
    corrections: string[];
    additional_info: string[];
    final_confirmation: boolean;
  };
}
```

#### 3.2.4 Simplificado (Operacional)

```typescript
interface SimplifiedContent {
  format: 'simplified';

  patient_summary: string;       // Resumo em 2-3 frases
  critical_now: string[];        // Itens criticos imediatos
  pending: string[];             // Pendencias
  next_actions: string[];        // Proximas acoes
  special_attention: string[];   // Atencao especial
}
```

---

## 4. Pendencias no Handoff

```typescript
interface HandoffPendingItem {
  item_id: string;
  description: string;
  category: 'clinical' | 'medication' | 'diagnostic' | 'procedural' | 'communication' | 'administrative';
  priority: 'critical' | 'high' | 'medium' | 'low';
  due_at?: string;
  source_event_id?: string;  // Evento que originou a pendencia
  status: 'transferred' | 'acknowledged' | 'in_progress' | 'completed' | 'dropped';
  completed_at?: string;
  completed_by?: string;
  notes?: string;
}
```

### 4.1 Rastreamento de Pendencias

```
  HANDOFF A -> B          HANDOFF B -> C          HANDOFF C -> D
  Pendencia P1            Pendencia P1            Pendencia P1
  [Criada]                [Transferida]           [Resolvida]
  Status: transferred     Status: acknowledged    Status: completed

  Se P1 chega ao 3o handoff sem resolucao:
  -> Alerta automatico para coordenacao
  -> Flag: "Pendencia circulando sem resolucao"
```

---

## 5. Regras e SLAs

### 5.1 SLAs de Aceitacao

| Tipo de Handoff | SLA de Aceitacao | Escalacao Nivel 1 | Escalacao Nivel 2 |
|---|---|---|---|
| Troca de turno | 10 minutos | Enfermeiro Chefe | Coordenacao |
| Transferencia de unidade | 15 minutos | Enf. Chefe destino | Supervisao |
| Cobertura de intervalo | 5 minutos | Enfermeiro Chefe | - |
| Emergencia | 2 minutos | Coordenacao | Diretoria |
| Alta | 30 minutos | Enf. Chefe | - |

### 5.2 Regras de Deteccao

```typescript
const HANDOFF_RULES = [
  {
    rule_id: 'HO-001',
    name: 'Handoff sem aceitacao',
    description: 'Handoff pendente alem do SLA definido',
    condition: {
      status: 'pending',
      elapsed_beyond_sla: true,
    },
    severity: 'high',
    actions: [
      'escalate_per_sla_config',
      'flag_in_custody_view',
      'create_gap_event',
    ],
  },
  {
    rule_id: 'HO-002',
    name: 'Handoff recusado sem resolucao',
    description: 'Handoff recusado e novo destinatario nao definido',
    condition: {
      status: 'refused',
      no_alternative_assigned: true,
      elapsed_minutes: { gte: 5 },
    },
    severity: 'critical',
    actions: [
      'escalate_to_coordinator',
      'maintain_origin_custody',
      'create_critical_alert',
    ],
  },
  {
    rule_id: 'HO-003',
    name: 'Gap de custodia',
    description: 'Periodo sem responsavel definido para o paciente',
    condition: {
      custody_status: 'critical_gap',
      duration_minutes: { gte: 5 },
    },
    severity: 'critical',
    actions: [
      'escalate_to_coordinator',
      'alert_command_center',
      'create_incident',
    ],
  },
  {
    rule_id: 'HO-004',
    name: 'Troca de turno sem handoff',
    description: 'Turno iniciou sem registro de handoff para paciente ativo',
    condition: {
      shift_changed: true,
      no_handoff_registered: true,
      patient_status: 'active',
    },
    severity: 'high',
    actions: [
      'notify_incoming_nurse',
      'notify_charge_nurse',
      'create_gap_event',
    ],
  },
  {
    rule_id: 'HO-005',
    name: 'Handoff sem pendencias quando existem pendencias',
    description: 'Handoff registrado sem pendencias mas existem itens abertos no sistema',
    condition: {
      handoff_pending_items: 0,
      system_open_items: { gte: 1 },
    },
    severity: 'medium',
    actions: [
      'flag_quality_concern',
      'suggest_review',
    ],
  },
  {
    rule_id: 'HO-006',
    name: 'Pendencia circulando',
    description: 'Mesma pendencia transferida em 3+ handoffs consecutivos sem resolucao',
    condition: {
      pending_item_handoff_count: { gte: 3 },
      item_status: 'transferred',
    },
    severity: 'high',
    actions: [
      'escalate_to_coordinator',
      'flag_persistent_pending',
      'create_task_for_resolution',
    ],
  },
  {
    rule_id: 'HO-007',
    name: 'Transferencia de unidade sem handoff',
    description: 'Paciente transferido para outra unidade sem registro de handoff',
    condition: {
      event_type: 'unit_change',
      no_handoff_within_minutes: 30,
    },
    severity: 'critical',
    actions: [
      'notify_both_units',
      'create_gap_event',
      'require_retroactive_handoff',
    ],
  },
  {
    rule_id: 'HO-008',
    name: 'Qualidade do handoff baixa',
    description: 'Handoff com score de qualidade abaixo do minimo',
    condition: {
      quality_score: { lt: 60 },
    },
    severity: 'medium',
    actions: [
      'flag_for_quality_review',
      'suggest_improvement',
    ],
  },
];
```

---

## 6. Score de Qualidade do Handoff

```typescript
/**
 * Calcula o score de qualidade de um handoff (0-100).
 */
function calculateHandoffQualityScore(
  handoff: StructuredHandoff
): number {
  let score = 0;
  const criteria: Array<{ name: string; weight: number; check: () => boolean }> = [
    {
      name: 'Formato estruturado utilizado',
      weight: 10,
      check: () => ['SBAR', 'I-PASS', 'closed_loop'].includes(handoff.format),
    },
    {
      name: 'Resumo do paciente presente',
      weight: 10,
      check: () => {
        const content = handoff.content as any;
        return !!(content.situation?.current_status || content.patient_summary?.one_liner);
      },
    },
    {
      name: 'Pendencias listadas',
      weight: 15,
      check: () => handoff.pending_items.length > 0 || handoff.remaining_actions.length === 0,
    },
    {
      name: 'Pendencias com prioridade definida',
      weight: 5,
      check: () => handoff.pending_items.every(item => !!item.priority),
    },
    {
      name: 'Avaliacao de risco preenchida',
      weight: 10,
      check: () => !!handoff.risk_assessment.overall_risk,
    },
    {
      name: 'Proximos passos definidos',
      weight: 10,
      check: () => handoff.next_steps.length > 0,
    },
    {
      name: 'Alergias mencionadas',
      weight: 5,
      check: () => {
        const content = handoff.content as any;
        return !!(content.background?.allergies?.length > 0 || content.patient_summary);
      },
    },
    {
      name: 'Medicacoes atuais mencionadas',
      weight: 5,
      check: () => {
        const content = handoff.content as any;
        return !!(content.background?.current_medications?.length > 0);
      },
    },
    {
      name: 'Comunicacao presencial ou por telefone',
      weight: 10,
      check: () => ['in_person', 'phone', 'video'].includes(
        handoff.lifecycle.communication_method
      ),
    },
    {
      name: 'Read-back realizado',
      weight: 10,
      check: () => handoff.lifecycle.read_back_performed === true,
    },
    {
      name: 'Aceitacao explicita',
      weight: 10,
      check: () => handoff.lifecycle.acceptance_method === 'explicit',
    },
  ];

  for (const criterion of criteria) {
    if (criterion.check()) {
      score += criterion.weight;
    }
  }

  return score;
}
```

---

## 7. Diagrama de Custodia

### 7.1 Visualizacao de 24 Horas

```
  CADEIA DE CUSTODIA - Maria Silva Santos (CM-412A)
  08/04/2026

  ENFERMAGEM:
  00:00       06:00       12:00       18:00       00:00
  |-----------|-----------|-----------|-----------|
  | Enf. Carlos          | Enf. Marcos           | Enf. Carlos          |
  | (Noite)              | (Manha)               | (Tarde)              |
  |  HO aceito 00:05     | HO aceito 06:08       | HO aceito 12:05      |
  |  Transicao: 5 min    | Transicao: 8 min      | Transicao: 5 min     |
  |-----------|-----------|-----------|-----------|

  MEDICINA:
  00:00       06:00       12:00       18:00       00:00
  |-----------|-----------|-----------|-----------|
  | Dr. Plantonista                               |
  | (Plantao noite: 19h-07h)                     |
  |           | Dr. Carlos Mendes                 |
  |           | (Diarista: 07h-19h)               |
  |           |                                   | Dr. Plantonista
  |-----------|-----------|-----------|-----------|

  FISIOTERAPIA:
  00:00       06:00       12:00       18:00       00:00
  |-----------|-----------|-----------|-----------|
  |           | Ft. Daniela         |             |
  |           | (Diarista: 07h-16h) |             |
  |  [SEM RESPONSAVEL]              | [SEM RESP.] |
  |-----------|-----------|-----------|-----------|
                                     ^
                                     [!] Gap detectado
```

### 7.2 Tabela de Transicoes

```
+--------+--------+-----------+---------+-----------+--------+---------+
| Data   | Hora   | De        | Para    | Formato   | Aceite | Transi- |
|        |        |           |         |           | (min)  | cao(min)|
+--------+--------+-----------+---------+-----------+--------+---------+
| 08/04  | 00:05  | Enf.R.    | Enf.C.  | SBAR      | 5      | 5       |
| 08/04  | 06:08  | Enf.C.    | Enf.M.  | SBAR      | 8      | 8       |
| 08/04  | 07:10  | Dr.Plant. | Dr.Mend.| Simplif.  | 10     | 10      |
| 08/04  | 12:05  | Enf.M.    | Enf.A.  | SBAR      | 5      | 3       |
+--------+--------+-----------+---------+-----------+--------+---------+

  Media de transicao: 6.5 min
  Gaps registrados: 0
  Handoffs sem aceitacao: 0
  Score de qualidade medio: 85%
```

---

## 8. Metricas e Observabilidade

### 8.1 PromQL

```promql
# Handoffs pendentes atualmente
count(patient_handoff_status{status="pending"})

# Tempo medio de aceitacao (24h)
avg(patient_handoff_acceptance_time_seconds)

# Gaps de custodia ativos
count(patient_custody_gap_active == 1)

# Duracao total de gaps por unidade (24h)
sum by (ward) (
  increase(patient_custody_gap_duration_seconds_total[24h])
)

# Handoffs recusados (24h)
sum(increase(patient_handoff_refused_total[24h]))

# Score medio de qualidade de handoff
avg(patient_handoff_quality_score)

# Pendencias que circularam 3+ handoffs
count(patient_handoff_pending_item_transfers >= 3)

# Taxa de handoff com read-back
sum(patient_handoff_readback_performed_total)
  / sum(patient_handoff_total) * 100

# Handoffs sem formato estruturado
count(patient_handoff_format{format="simplified"})
  / count(patient_handoff_format) * 100
```

### 8.2 LogQL

```logql
# Handoffs que excederam SLA
{app="velya-handoff-service"} | json |
  status = "pending" |
  elapsed_seconds > 600

# Gaps de custodia
{app="velya-custody-service"} | json |
  event_type = "custody_gap_detected"

# Handoffs recusados
{app="velya-handoff-service"} | json |
  status = "refused"
```

---

## 9. Temporal Workflows

### 9.1 Workflow de Handoff

```typescript
interface HandoffWorkflow {
  workflowId: 'handoff-{handoff_id}';
  taskQueue: 'handoff-management';

  steps: [
    // 1. Handoff iniciado - valida dados
    'validateHandoffData',

    // 2. Pontua qualidade do handoff
    'calculateQualityScore',

    // 3. Verifica pendencias no sistema vs declaradas
    'crossCheckPendingItems',

    // 4. Notifica destinatario
    'notifyDestination',

    // 5. Aguarda aceitacao ou timeout (baseado no SLA)
    'waitForAcceptanceOrTimeout',

    // 6a. Se aceito:
    'transferCustody',
    'updateProjections',
    'recordHandoffComplete',

    // 6b. Se recusado:
    'handleRefusal',
    'maintainOriginCustody',
    'findAlternativeDestination',

    // 6c. Se timeout:
    'handleTimeout',
    'escalatePerSLAConfig',
    'maintainOriginCustody',
    'createGapAlert',

    // 7. Acompanhar pendencias transferidas
    'monitorTransferredPendingItems',
  ];

  signals: [
    'handoffAccepted',
    'handoffRefused',
    'handoffCancelled',
    'pendingItemCompleted',
    'pendingItemEscalated',
  ];

  timers: {
    shift_change_sla: '10m';
    unit_transfer_sla: '15m';
    break_coverage_sla: '5m';
    emergency_sla: '2m';
    pending_item_check: '4h'; // Verificar pendencias a cada 4h
  };
}
```

### 9.2 Workflow de Monitoramento de Custodia

```typescript
interface CustodyMonitoringWorkflow {
  workflowId: 'custody-monitor-{patient_id}';
  taskQueue: 'custody-monitoring';

  // Executa continuamente durante a internacao
  steps: [
    'checkCurrentCustody',          // Verifica custodia atual
    'detectShiftBoundaries',        // Detecta limites de turno
    'checkHandoffExpected',         // Verifica se handoff deveria ter ocorrido
    'checkGaps',                    // Verifica gaps
    'updateCustodyProjection',      // Atualiza projecao
    'sleep_5m',                     // Aguarda 5 minutos
    // Loop
  ];

  // Encerra quando o paciente recebe alta
  termination: {
    on_event: 'patient.journey.{patient_id}.operational.discharge';
  };
}
```

---

## 10. FHIR - Task para Handoff

### 10.1 Task com SBAR Completo

```json
{
  "resourceType": "Task",
  "id": "task-handoff-sbar-001",
  "status": "accepted",
  "intent": "order",
  "priority": "routine",
  "code": {
    "coding": [
      {
        "system": "http://velya.health/fhir/CodeSystem/task-type",
        "code": "nursing-handoff",
        "display": "Passagem de Plantao Enfermagem"
      }
    ]
  },
  "focus": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "for": {
    "reference": "Patient/patient-001"
  },
  "authoredOn": "2026-04-08T12:02:00-03:00",
  "lastModified": "2026-04-08T12:05:00-03:00",
  "requester": {
    "reference": "Practitioner/enf-marcos-manha"
  },
  "owner": {
    "reference": "Practitioner/enf-ana-paula"
  },
  "input": [
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/fhir/CodeSystem/handoff-section",
            "code": "situation"
          }
        ]
      },
      "valueString": "Maria Silva Santos, 67 anos, CM-412A. Internada ha 3 dias por pneumonia comunitaria grave. Estavel clinicamente, NEWS 3."
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/fhir/CodeSystem/handoff-section",
            "code": "background"
          }
        ]
      },
      "valueString": "HAS, DM2. ALERGIAS: Penicilina (severa), Dipirona (moderada). Medicacoes: Amoxicilina 500mg 8/8h VO, Enoxaparina 40mg 1x/dia SC, Dipirona 1g IV SOS. Broncoscopia diagnostica 06/04 sem intercorrencias."
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/fhir/CodeSystem/handoff-section",
            "code": "assessment"
          }
        ]
      },
      "valueString": "NEWS 3 estavel. Dor toracica com melhora parcial, ultima avaliacao 10:30 dor 4/10. Aguardando resultado hemocultura solicitada hoje 10:15. Sem febre ha 24h."
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/fhir/CodeSystem/handoff-section",
            "code": "recommendation"
          }
        ]
      },
      "valueString": "1. Verificar resultado hemocultura quando disponivel e comunicar Dr. Mendes. 2. Amoxicilina 14:00. 3. Reavaliar dor apos proxima dose analgesica. 4. Manter decubito elevado 30 graus. 5. Se piora respiratoria, acionar Dr. Mendes."
    },
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/fhir/CodeSystem/handoff-section",
            "code": "pending-items"
          }
        ]
      },
      "valueString": "[{\"desc\":\"Resultado hemocultura\",\"priority\":\"critical\",\"due\":\"quando disponivel\"},{\"desc\":\"Amoxicilina 14:00\",\"priority\":\"high\"},{\"desc\":\"Reavaliacao dor\",\"priority\":\"medium\",\"due\":\"12:30\"}]"
    }
  ],
  "output": [
    {
      "type": {
        "coding": [
          {
            "system": "http://velya.health/fhir/CodeSystem/handoff-output",
            "code": "acceptance-confirmation"
          }
        ]
      },
      "valueString": "Handoff recebido e aceito. Confirmadas 3 pendencias. Vou priorizar verificacao da hemocultura e administracao da amoxicilina 14:00."
    }
  ],
  "extension": [
    {
      "url": "http://velya.health/fhir/StructureDefinition/handoff-format",
      "valueCode": "SBAR"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/handoff-quality-score",
      "valueInteger": 88
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/handoff-transition-seconds",
      "valueInteger": 180
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/handoff-communication-method",
      "valueCode": "in_person"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/handoff-readback-performed",
      "valueBoolean": true
    }
  ]
}
```

---

## 11. Alertas e Notificacoes

| Alerta | Condicao | Destinatario | Canal |
|---|---|---|---|
| `HandoffPending` | Handoff > SLA sem aceitacao | Enf. Chefe | Push |
| `HandoffRefused` | Handoff recusado | Coordenacao | Push + Email |
| `CustodyGap` | Paciente sem responsavel > 5 min | Coordenacao | Push + SMS |
| `ShiftNoHandoff` | Turno iniciou sem handoff | Enf. entrante + Chefe | Push |
| `TransferNoHandoff` | Transferencia sem handoff | Ambas unidades | Push |
| `PendingCirculating` | Pendencia em 3+ handoffs | Coordenacao | Push |
| `LowQualityHandoff` | Score < 60 | Enf. Chefe | Push |
| `DeadTime` | Tempo morto > 10 min em transicao | Coordenacao | Push |

---

## Referencias

- [WHO - Patient Safety - Communication During Patient Handovers](https://www.who.int/)
- [Joint Commission - Handoff Communications](https://www.jointcommission.org/)
- [I-PASS Handoff Framework](https://www.ipasshandoffstudy.com/)
- [SBAR Communication Tool](https://www.ihi.org/resources/Pages/Tools/SBARToolkit.aspx)
- [FHIR R4 Task](https://www.hl7.org/fhir/task.html)
- [Temporal Workflow Documentation](https://docs.temporal.io/)
