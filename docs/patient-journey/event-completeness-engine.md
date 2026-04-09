# Event Completeness Engine - Motor de Completude de Eventos

> Velya Platform - Documentacao Tecnica
> Ultima atualizacao: 2026-04-08
> Status: Especificacao Ativa

---

## 1. Visao Geral

O Event Completeness Engine detecta eventos esperados que nao ocorreram.
Funciona como um "auditor automatico" que verifica se as acoes esperadas
dentro do fluxo clinico-operacional foram realizadas e documentadas.

### Principio

> **O que deveria ter acontecido e tao importante quanto o que aconteceu.
> Ausencia de evidencia nao e evidencia de ausencia — e preciso investigar.**

```
+------------------------------------------------------------------+
|  EVENT COMPLETENESS ENGINE                                        |
|                                                                   |
|  Evento Observado           Expectativa              Gap?         |
|  +----------------+        +----------------+                     |
|  | Prescricao     | -----> | Administracao  | --NAO--> [GAP]     |
|  | criada         |        | esperada       |                     |
|  +----------------+        +----------------+                     |
|                                                                   |
|  +----------------+        +----------------+                     |
|  | Dor >= 7       | -----> | Intervencao    | --NAO--> [GAP]     |
|  | registrada     |        | esperada       |                     |
|  +----------------+        +----------------+                     |
|                                                                   |
|  +----------------+        +----------------+                     |
|  | Resultado      | -----> | Visualizacao   | --NAO--> [GAP]     |
|  | critico        |        | pelo medico    |                     |
|  +----------------+        +----------------+                     |
|                                                                   |
|  Regras configuraveis | Templates por tipo | Alertas automaticos |
+------------------------------------------------------------------+
```

---

## 2. Arquitetura

### 2.1 Pipeline de Avaliacao

```
  Event Ledger
       |
       v
  NATS Consumer: gap-detection
       |
       v
  +--------------------+
  | Rule Matcher        |  Para cada evento recebido, verifica se
  | (por tipo de evento)|  ha regras de completude aplicaveis
  +--------------------+
       |
       v
  +--------------------+
  | Expectation Tracker |  Cria ou atualiza expectativas pendentes
  | (Temporal Workflow) |  com timers para verificacao
  +--------------------+
       |
       v
  +--------------------+
  | Gap Evaluator       |  Quando timer expira, verifica se o
  |                     |  evento esperado ocorreu
  +--------------------+
       |
    +--+--+
    |     |
    v     v
  [OK]  [GAP]
         |
         v
  +--------------------+
  | Gap Event Creator   |  Cria evento inferred.gap_detected
  | + Notificacao       |  no Patient Journey Ledger
  +--------------------+
```

### 2.2 Componentes

```typescript
interface CompletenessEngine {
  /** Repositorio de templates de regras */
  ruleRepository: RuleRepository;

  /** Motor de avaliacao */
  evaluator: GapEvaluator;

  /** Tracker de expectativas (Temporal) */
  expectationTracker: ExpectationTracker;

  /** Gerador de eventos de gap */
  gapEventCreator: GapEventCreator;

  /** Notificador */
  notifier: GapNotifier;

  /** Configuracao */
  config: {
    evaluation_interval: string; // '1m'
    max_concurrent_expectations: number; // 10000
    default_lookback_window: string; // '24h'
    enabled: boolean;
  };
}
```

---

## 3. Schema de Definicao de Regra

### 3.1 Estrutura da Regra

```typescript
interface CompletenessRule {
  /** Identificador unico da regra */
  rule_id: string;

  /** Nome legivel */
  name: string;

  /** Descricao detalhada */
  description: string;

  /** Versao da regra */
  version: string;

  /** Categoria da regra */
  category: RuleCategory;

  /** Status da regra */
  enabled: boolean;

  /** Severidade do gap quando detectado */
  severity: 'critical' | 'high' | 'medium' | 'low';

  /** Relevancia clinica */
  clinical_relevance: 'critical' | 'high' | 'standard' | 'low';

  /** Evento trigger (o que dispara a expectativa) */
  trigger: {
    /** Tipo de evento que dispara a regra */
    event_type: string;

    /** Filtros adicionais sobre o evento trigger */
    filters?: Record<string, unknown>;

    /** Condicoes sobre o payload do trigger */
    conditions?: RuleCondition[];
  };

  /** Evento esperado (o que deveria acontecer depois) */
  expectation: {
    /** Tipo de evento esperado */
    event_type: string;

    /** Janela de tempo para o evento esperado */
    time_window: TimeWindow;

    /** Filtros que o evento esperado deve satisfazer */
    filters?: Record<string, unknown>;

    /** Condicoes de satisfacao */
    satisfaction_conditions?: RuleCondition[];

    /** Eventos que cancelam a expectativa (nao e gap) */
    cancellation_events?: Array<{
      event_type: string;
      filters?: Record<string, unknown>;
    }>;
  };

  /** Acoes quando gap e detectado */
  gap_actions: GapAction[];

  /** Excecoes (quando a regra nao se aplica) */
  exceptions?: RuleException[];

  /** Metadados */
  metadata: {
    author: string;
    created_at: string;
    updated_at: string;
    approved_by?: string;
    tags: string[];
    references?: string[]; // Referencias a protocolos clinicos
  };
}

type RuleCategory =
  | 'medication' // Regras de medicacao
  | 'pain_management' // Regras de dor
  | 'diagnostics' // Regras de diagnostico
  | 'handoff' // Regras de handoff
  | 'communication' // Regras de comunicacao
  | 'assessment' // Regras de avaliacao
  | 'documentation' // Regras de documentacao
  | 'safety' // Regras de seguranca
  | 'operational'; // Regras operacionais

interface TimeWindow {
  /** Tipo de janela */
  type: 'fixed' | 'relative' | 'schedule_based';

  /** Para fixed: duracao em minutos */
  duration_minutes?: number;

  /** Para relative: baseado em campo do evento trigger */
  relative_to?: string;
  offset_minutes?: number;

  /** Para schedule_based: referencia a um agendamento */
  schedule_reference?: string;

  /** Tolerancia antes de considerar gap */
  tolerance_minutes?: number;
}

interface RuleCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'exists';
  value: unknown;
}

interface GapAction {
  type:
    | 'create_gap_event'
    | 'notify'
    | 'escalate'
    | 'create_task'
    | 'flag_timeline'
    | 'update_indicator'
    | 'auto_remind';
  config: Record<string, unknown>;
}

interface RuleException {
  description: string;
  conditions: RuleCondition[];
}
```

---

## 4. Regras Detalhadas

### 4.1 Prescricao sem Administracao

```typescript
const RULE_PRESCRIPTION_WITHOUT_ADMIN: CompletenessRule = {
  rule_id: 'COMP-001',
  name: 'Prescricao sem administracao ou justificativa',
  description:
    'Detecta prescricao ativa com horario programado que passou sem registro de administracao, recusa, suspensao ou justificativa',
  version: '1.0.0',
  category: 'medication',
  enabled: true,
  severity: 'high',
  clinical_relevance: 'high',

  trigger: {
    event_type: 'medication_request.new',
    conditions: [
      { field: 'payload.status', operator: 'eq', value: 'active' },
      { field: 'payload.prn', operator: 'eq', value: false },
    ],
  },

  expectation: {
    event_type: 'medication_administration.*',
    time_window: {
      type: 'schedule_based',
      schedule_reference: 'payload.frequency_times',
      tolerance_minutes: 60,
    },
    satisfaction_conditions: [
      {
        field: 'payload.request_reference',
        operator: 'eq',
        value: '$trigger.payload.fhir_medication_request_id',
      },
    ],
    cancellation_events: [
      {
        event_type: 'medication_request.cancelled',
        filters: {
          'payload.fhir_medication_request_id': '$trigger.payload.fhir_medication_request_id',
        },
      },
      {
        event_type: 'medication_request.suspended',
        filters: {
          'payload.fhir_medication_request_id': '$trigger.payload.fhir_medication_request_id',
        },
      },
    ],
  },

  gap_actions: [
    {
      type: 'create_gap_event',
      config: { gap_type: 'medication_not_administered', include_medication_details: true },
    },
    {
      type: 'notify',
      config: {
        targets: ['responsible_nurse'],
        message: 'Medicacao {medication_name} nao administrada no horario previsto',
      },
    },
    { type: 'flag_timeline', config: { relevance: 'high', label: 'Dose nao administrada' } },
    {
      type: 'update_indicator',
      config: { indicator: 'medication_completeness', direction: 'decrease' },
    },
  ],

  exceptions: [
    {
      description: 'Paciente em alta ou transferido',
      conditions: [
        { field: 'encounter.status', operator: 'in', value: ['discharged', 'transferred'] },
      ],
    },
    {
      description: 'Paciente em procedimento externo',
      conditions: [
        { field: 'patient.current_location_type', operator: 'eq', value: 'procedure_room' },
      ],
    },
  ],

  metadata: {
    author: 'clinical-safety-team',
    created_at: '2026-03-15',
    updated_at: '2026-04-01',
    approved_by: 'dr-diretora-medica',
    tags: ['medication', 'safety', 'compliance'],
    references: ['protocolo-seguranca-medicamentosa-v3'],
  },
};
```

### 4.2 Chamado Repetido sem Fechamento

```typescript
const RULE_REPEATED_CALL_NO_CLOSURE: CompletenessRule = {
  rule_id: 'COMP-002',
  name: 'Chamado repetido sem fechamento efetivo',
  description:
    'Paciente chamou pelo mesmo motivo 3+ vezes em 8h sem resolucao definitiva ou acao clinica correspondente',
  version: '1.0.0',
  category: 'communication',
  enabled: true,
  severity: 'high',
  clinical_relevance: 'standard',

  trigger: {
    event_type: 'patient_call',
    conditions: [{ field: 'metadata.times_called_in_24h', operator: 'gte', value: 3 }],
  },

  expectation: {
    event_type: 'call_resolution',
    time_window: {
      type: 'fixed',
      duration_minutes: 480, // 8 horas
    },
    satisfaction_conditions: [
      { field: 'payload.resolution_type', operator: 'neq', value: 'scheduled_for_later' },
      { field: 'payload.reopened', operator: 'eq', value: false },
    ],
  },

  gap_actions: [
    { type: 'create_gap_event', config: { gap_type: 'recurring_unresolved_call' } },
    { type: 'notify', config: { targets: ['charge_nurse', 'responsible_nurse'] } },
    { type: 'create_task', config: { task: 'investigate_recurring_patient_need' } },
  ],

  metadata: {
    author: 'quality-team',
    created_at: '2026-03-20',
    updated_at: '2026-04-01',
    tags: ['communication', 'quality', 'patient-experience'],
  },
};
```

### 4.3 Resultado Critico sem Visualizacao

```typescript
const RULE_CRITICAL_RESULT_NO_ACK: CompletenessRule = {
  rule_id: 'COMP-003',
  name: 'Resultado critico sem visualizacao pelo medico',
  description:
    'Resultado de exame marcado como critico/urgente sem registro de visualizacao pelo medico responsavel dentro de 60 minutos',
  version: '1.0.0',
  category: 'diagnostics',
  enabled: true,
  severity: 'critical',
  clinical_relevance: 'critical',

  trigger: {
    event_type: 'lab_result',
    conditions: [{ field: 'payload.criticality', operator: 'in', value: ['critical', 'urgent'] }],
  },

  expectation: {
    event_type: 'record_accessed',
    time_window: {
      type: 'fixed',
      duration_minutes: 60,
    },
    satisfaction_conditions: [
      {
        field: 'payload.resource_id',
        operator: 'eq',
        value: '$trigger.payload.fhir_diagnostic_report_id',
      },
      { field: 'payload.accessor_role', operator: 'in', value: ['physician'] },
    ],
  },

  gap_actions: [
    {
      type: 'create_gap_event',
      config: { gap_type: 'critical_result_not_reviewed', severity: 'critical' },
    },
    {
      type: 'notify',
      config: {
        targets: ['attending_physician', 'charge_nurse'],
        message: 'Resultado CRITICO pendente visualizacao: {result_name}',
      },
    },
    { type: 'escalate', config: { timeout_minutes: 15, escalate_to: 'medical_coordinator' } },
    { type: 'flag_timeline', config: { relevance: 'critical' } },
  ],

  metadata: {
    author: 'patient-safety-team',
    created_at: '2026-03-10',
    updated_at: '2026-04-05',
    approved_by: 'dr-diretora-medica',
    tags: ['diagnostics', 'safety', 'critical'],
    references: ['protocolo-resultados-criticos-v2', 'ANS-resolucao-414'],
  },
};
```

### 4.4 Handoff sem Aceitacao

```typescript
const RULE_HANDOFF_NOT_ACCEPTED: CompletenessRule = {
  rule_id: 'COMP-004',
  name: 'Handoff sem aceitacao no prazo',
  description: 'Handoff iniciado sem aceitacao explicita dentro do SLA definido',
  version: '1.0.0',
  category: 'handoff',
  enabled: true,
  severity: 'high',
  clinical_relevance: 'standard',

  trigger: {
    event_type: 'handoff_initiated',
  },

  expectation: {
    event_type: 'handoff_accepted',
    time_window: {
      type: 'fixed',
      duration_minutes: 10,
    },
    satisfaction_conditions: [
      { field: 'payload.handoff_id', operator: 'eq', value: '$trigger.payload.handoff_id' },
    ],
    cancellation_events: [
      {
        event_type: 'handoff_refused',
        filters: { 'payload.handoff_id': '$trigger.payload.handoff_id' },
      },
    ],
  },

  gap_actions: [
    { type: 'create_gap_event', config: { gap_type: 'handoff_not_accepted' } },
    { type: 'notify', config: { targets: ['charge_nurse', 'destination_practitioner'] } },
    { type: 'escalate', config: { timeout_minutes: 5, escalate_to: 'nursing_coordinator' } },
    { type: 'update_indicator', config: { indicator: 'handoff_integrity', direction: 'decrease' } },
  ],

  metadata: {
    author: 'operations-team',
    created_at: '2026-03-12',
    updated_at: '2026-04-01',
    tags: ['handoff', 'operational', 'safety'],
  },
};
```

### 4.5 Dor Alta sem Intervencao ou Reavaliacao

```typescript
const RULE_HIGH_PAIN_NO_ACTION: CompletenessRule = {
  rule_id: 'COMP-005',
  name: 'Dor alta sem intervencao ou reavaliacao',
  description: 'Avaliacao de dor >= 7 sem registro de intervencao ou reavaliacao em 30 minutos',
  version: '1.0.0',
  category: 'pain_management',
  enabled: true,
  severity: 'critical',
  clinical_relevance: 'high',

  trigger: {
    event_type: 'pain_assessment',
    conditions: [{ field: 'payload.score', operator: 'gte', value: 7 }],
  },

  expectation: {
    event_type: 'medication_administration.given|pain_assessment|clinical_note',
    time_window: {
      type: 'fixed',
      duration_minutes: 30,
    },
    satisfaction_conditions: [
      // Aceita: medicacao analgesica, nova avaliacao de dor, ou nota clinica sobre dor
      { field: 'payload.medication_code', operator: 'in', value: ['analgesic_codes'] },
    ],
  },

  gap_actions: [
    {
      type: 'create_gap_event',
      config: { gap_type: 'high_pain_no_intervention', include_pain_score: true },
    },
    {
      type: 'notify',
      config: {
        targets: ['responsible_nurse', 'prescriber'],
        message: 'Paciente com dor {score}/10 sem intervencao ha {elapsed_min} minutos',
      },
    },
    { type: 'flag_timeline', config: { relevance: 'critical', label: 'Dor sem manejo' } },
  ],

  metadata: {
    author: 'pain-management-team',
    created_at: '2026-03-18',
    updated_at: '2026-04-03',
    approved_by: 'enf-coordenadora',
    tags: ['pain', 'safety', 'quality'],
    references: ['protocolo-dor-5o-sinal-vital-v4'],
  },
};
```

### 4.6 Mudanca de Unidade sem Registro de Responsabilidade

```typescript
const RULE_UNIT_CHANGE_NO_CUSTODY: CompletenessRule = {
  rule_id: 'COMP-006',
  name: 'Mudanca de unidade sem registro de responsabilidade',
  description:
    'Paciente transferido para outra unidade sem registro de novo responsavel ou handoff',
  version: '1.0.0',
  category: 'operational',
  enabled: true,
  severity: 'critical',
  clinical_relevance: 'high',

  trigger: {
    event_type: 'unit_change',
  },

  expectation: {
    event_type: 'handoff_accepted|handoff_initiated',
    time_window: {
      type: 'fixed',
      duration_minutes: 30,
    },
  },

  gap_actions: [
    { type: 'create_gap_event', config: { gap_type: 'transfer_without_custody' } },
    { type: 'notify', config: { targets: ['origin_charge_nurse', 'destination_charge_nurse'] } },
    { type: 'escalate', config: { immediate: true, escalate_to: 'nursing_supervisor' } },
  ],

  metadata: {
    author: 'operations-team',
    created_at: '2026-03-15',
    updated_at: '2026-04-01',
    tags: ['operational', 'safety', 'custody'],
  },
};
```

### 4.7 Ordem sem Execucao

```typescript
const RULE_ORDER_NO_EXECUTION: CompletenessRule = {
  rule_id: 'COMP-007',
  name: 'Ordem/solicitacao sem execucao',
  description: 'ServiceRequest criado sem execucao ou resposta dentro do prazo esperado',
  version: '1.0.0',
  category: 'diagnostics',
  enabled: true,
  severity: 'high',
  clinical_relevance: 'high',

  trigger: {
    event_type: 'scheduling',
    conditions: [{ field: 'payload.priority', operator: 'in', value: ['urgent', 'asap'] }],
  },

  expectation: {
    event_type: 'lab_result|imaging_result|procedure',
    time_window: {
      type: 'relative',
      relative_to: 'payload.expected_completion_time',
      offset_minutes: 60,
    },
  },

  gap_actions: [
    { type: 'create_gap_event', config: { gap_type: 'order_without_execution' } },
    { type: 'notify', config: { targets: ['ordering_physician', 'executing_department'] } },
  ],

  metadata: {
    author: 'quality-team',
    created_at: '2026-03-20',
    updated_at: '2026-04-01',
    tags: ['diagnostics', 'operational', 'compliance'],
  },
};
```

### 4.8 Avaliacao sem Follow-up

```typescript
const RULE_ASSESSMENT_NO_FOLLOWUP: CompletenessRule = {
  rule_id: 'COMP-008',
  name: 'Avaliacao clinica sem follow-up agendado',
  description:
    'Avaliacao clinica que indicou necessidade de follow-up sem registro de reavaliacao no prazo',
  version: '1.0.0',
  category: 'assessment',
  enabled: true,
  severity: 'medium',
  clinical_relevance: 'standard',

  trigger: {
    event_type: 'assessment',
    conditions: [{ field: 'payload.follow_up_required', operator: 'eq', value: true }],
  },

  expectation: {
    event_type: 'assessment',
    time_window: {
      type: 'relative',
      relative_to: 'payload.follow_up_due_at',
      offset_minutes: 60,
    },
    satisfaction_conditions: [{ field: 'payload.is_reassessment', operator: 'eq', value: true }],
  },

  gap_actions: [
    { type: 'create_gap_event', config: { gap_type: 'assessment_without_followup' } },
    { type: 'auto_remind', config: { target: 'responsible_nurse', remind_in_minutes: 30 } },
  ],

  metadata: {
    author: 'clinical-team',
    created_at: '2026-03-22',
    updated_at: '2026-04-01',
    tags: ['assessment', 'quality', 'documentation'],
  },
};
```

---

## 5. Catalogo Completo de Regras

| ID       | Nome                            | Categoria       | Severity | Trigger                            | Expectativa                       | Janela            |
| -------- | ------------------------------- | --------------- | -------- | ---------------------------------- | --------------------------------- | ----------------- |
| COMP-001 | Prescricao sem administracao    | medication      | high     | `medication_request.new`           | `medication_administration.*`     | schedule + 60min  |
| COMP-002 | Chamado repetido sem fechamento | communication   | high     | `patient_call` (3+)                | `call_resolution` (definitiva)    | 8h                |
| COMP-003 | Resultado critico sem ack       | diagnostics     | critical | `lab_result` (critico)             | `record_accessed` (medico)        | 60min             |
| COMP-004 | Handoff sem aceitacao           | handoff         | high     | `handoff_initiated`                | `handoff_accepted`                | 10min             |
| COMP-005 | Dor alta sem intervencao        | pain_management | critical | `pain_assessment` (>=7)            | Intervencao ou reavaliacao        | 30min             |
| COMP-006 | Transferencia sem custodia      | operational     | critical | `unit_change`                      | `handoff_*`                       | 30min             |
| COMP-007 | Ordem sem execucao              | diagnostics     | high     | `scheduling` (urgente)             | Resultado                         | conforme prazo    |
| COMP-008 | Avaliacao sem follow-up         | assessment      | medium   | `assessment` (follow-up=true)      | `assessment` (reavaliacao)        | conforme agendado |
| COMP-009 | NEWS alto sem escalacao         | safety          | critical | `vital_signs` (NEWS>=7)            | Escalacao medica                  | 15min             |
| COMP-010 | Queda sem protocolo             | safety          | critical | `incident.fall`                    | `assessment` (pos-queda)          | 30min             |
| COMP-011 | Isolamento sem registro diario  | documentation   | medium   | `admission` (isolamento=true)      | `assessment` (isolamento)         | 24h               |
| COMP-012 | Risco de queda sem prevencao    | safety          | high     | `assessment` (fall_risk=high)      | `care_plan` (prevencao queda)     | 4h                |
| COMP-013 | Antibiotico sem cultura previa  | medication      | medium   | `medication_request` (antibiotico) | `lab_result` (cultura)            | retroativo        |
| COMP-014 | Alta sem orientacao             | documentation   | high     | `discharge`                        | `clinical_note` (orientacao alta) | 2h antes          |
| COMP-015 | Consentimento sem assinatura    | documentation   | high     | `consent_requested`                | `consent_obtained`                | 24h               |

---

## 6. Expectation Tracker (Temporal Workflow)

```typescript
interface ExpectationTrackerWorkflow {
  workflowId: 'expectation-{rule_id}-{trigger_event_id}';
  taskQueue: 'completeness-engine';

  input: {
    rule: CompletenessRule;
    trigger_event: PatientJourneyEvent;
    patient_id: string;
    encounter_id: string;
  };

  steps: [
    // 1. Verificar excecoes
    'checkExceptions',
    // Se excecao aplica: encerrar silenciosamente

    // 2. Calcular deadline
    'calculateDeadline',

    // 3. Registrar expectativa
    'registerExpectation',

    // 4. Aguardar evento esperado OU deadline OU cancelamento
    'waitForSatisfactionOrDeadline',

    // 5a. Se evento esperado recebido:
    'markExpectationSatisfied',
    'recordCompletionMetric',

    // 5b. Se deadline atingido sem evento:
    'evaluateGap',
    'createGapEvent',
    'executeGapActions',
    'recordGapMetric',

    // 5c. Se evento de cancelamento recebido:
    'markExpectationCancelled',
  ];

  signals: [
    'expectationSatisfied', // Evento esperado ocorreu
    'expectationCancelled', // Evento de cancelamento ocorreu
    'ruleDisabled', // Regra foi desabilitada
    'manualDismiss', // Operador dispensou manualmente
  ];

  queries: [
    'getExpectationStatus', // Retorna status atual
    'getTimeRemaining', // Retorna tempo restante
    'getRelatedEvents', // Retorna eventos relacionados
  ];
}
```

### 6.1 Registro de Expectativa

```typescript
interface Expectation {
  expectation_id: string;
  rule_id: string;
  rule_name: string;

  patient_id: string;
  encounter_id: string;

  trigger_event_id: string;
  trigger_event_type: string;
  trigger_occurred_at: string;

  expected_event_type: string;
  deadline: string;
  tolerance_deadline: string; // deadline + tolerancia

  status: ExpectationStatus;
  created_at: string;
  updated_at: string;

  satisfaction_event_id?: string;
  satisfied_at?: string;

  gap_event_id?: string;
  gap_detected_at?: string;

  cancellation_event_id?: string;
  cancelled_at?: string;
  cancellation_reason?: string;

  dismissed_by?: string;
  dismissed_at?: string;
  dismiss_reason?: string;
}

type ExpectationStatus =
  | 'active' // Aguardando evento esperado
  | 'satisfied' // Evento esperado ocorreu
  | 'gap' // Deadline atingido sem evento
  | 'cancelled' // Cancelado por evento de cancelamento
  | 'dismissed' // Dispensado manualmente
  | 'expired'; // Expirado (regra desabilitada ou encounter encerrado)
```

---

## 7. Gap Event (Evento de Gap)

```typescript
interface GapEvent {
  /** Evento padrao do Patient Journey Ledger */
  event_id: string;
  patient_id: string;
  encounter_id: string;
  event_type: 'gap_detected';
  event_category: 'inferred';
  occurred_at: string; // = deadline da expectativa
  recorded_at: string;
  authored_by: 'system';
  authored_role: 'system';
  source_system: 'velya-rules-engine';
  status: 'active';
  clinical_relevance: string; // herda da regra

  payload: {
    /** Referencia a regra */
    rule_id: string;
    rule_name: string;
    rule_version: string;
    rule_category: string;

    /** Referencia a expectativa */
    expectation_id: string;

    /** Evento que disparou a expectativa */
    trigger_event_id: string;
    trigger_event_type: string;
    trigger_occurred_at: string;

    /** O que era esperado */
    expected_event_type: string;
    expected_by: string; // deadline

    /** Gap */
    gap_type: string;
    gap_duration_minutes: number;
    severity: string;

    /** Descricao legivel */
    description: string;
    recommendation: string;

    /** Evidencia */
    evidence: Array<{
      event_id: string;
      event_type: string;
      relevance: string;
    }>;

    /** Acoes tomadas */
    notifications_sent: string[];
    escalations: string[];
    tasks_created: string[];

    /** Status do gap */
    gap_status: 'open' | 'acknowledged' | 'resolved' | 'false_positive' | 'dismissed';
    acknowledged_by?: string;
    acknowledged_at?: string;
    resolved_by?: string;
    resolved_at?: string;
    resolution_description?: string;
  };
}
```

---

## 8. API de Gerenciamento de Regras

```typescript
interface RuleManagementAPI {
  /** Listar todas as regras */
  listRules(filters?: {
    category?: RuleCategory;
    enabled?: boolean;
    severity?: string;
  }): Promise<CompletenessRule[]>;

  /** Obter regra por ID */
  getRule(ruleId: string): Promise<CompletenessRule>;

  /** Criar nova regra */
  createRule(rule: Omit<CompletenessRule, 'rule_id'>): Promise<CompletenessRule>;

  /** Atualizar regra */
  updateRule(ruleId: string, updates: Partial<CompletenessRule>): Promise<CompletenessRule>;

  /** Habilitar/desabilitar regra */
  toggleRule(ruleId: string, enabled: boolean): Promise<void>;

  /** Testar regra contra dados historicos */
  testRule(
    rule: CompletenessRule,
    params: {
      patient_id?: string;
      encounter_id?: string;
      period: { start: string; end: string };
    },
  ): Promise<{
    would_trigger: number;
    would_detect_gaps: number;
    false_positive_estimate: number;
    sample_gaps: GapEvent[];
  }>;

  /** Listar expectativas ativas */
  listActiveExpectations(filters?: {
    patient_id?: string;
    rule_id?: string;
    status?: ExpectationStatus;
  }): Promise<Expectation[]>;

  /** Dispensar expectativa manualmente */
  dismissExpectation(expectationId: string, reason: string, dismissedBy: string): Promise<void>;

  /** Listar gaps detectados */
  listGaps(filters?: {
    patient_id?: string;
    rule_category?: string;
    severity?: string;
    status?: string;
    period?: { start: string; end: string };
  }): Promise<GapEvent[]>;

  /** Resolver gap */
  resolveGap(gapEventId: string, resolution: string, resolvedBy: string): Promise<void>;

  /** Marcar gap como falso positivo */
  markFalsePositive(gapEventId: string, reason: string, markedBy: string): Promise<void>;
}
```

---

## 9. Metricas e Observabilidade

### 9.1 PromQL

```promql
# Expectativas ativas
count(completeness_expectation_status{status="active"})

# Gaps detectados por regra (24h)
sum by (rule_id) (increase(completeness_gap_detected_total[24h]))

# Gaps criticos abertos
count(completeness_gap_open{severity="critical"})

# Taxa de satisfacao de expectativas
sum(completeness_expectation_satisfied_total)
  / (sum(completeness_expectation_satisfied_total)
     + sum(completeness_gap_detected_total)) * 100

# Tempo medio de deteccao de gap
avg(completeness_gap_detection_time_seconds)

# Top 5 regras com mais gaps
topk(5, sum by (rule_name) (increase(completeness_gap_detected_total[7d])))

# Falsos positivos por regra
sum by (rule_id) (increase(completeness_false_positive_total[30d]))
```

### 9.2 Dashboard de Completude

```
+------------------------------------------------------------------+
|  EVENT COMPLETENESS DASHBOARD                                     |
+------------------------------------------------------------------+
|                                                                   |
|  SCORE DE COMPLETUDE GERAL: [=========-] 88%                     |
|                                                                   |
|  +------------------+  +------------------+  +------------------+ |
|  | Expectativas     |  | Gaps Abertos     |  | Resolvidos Hoje  | |
|  | Ativas: 342      |  | Total: 12        |  | 28               | |
|  +------------------+  +------------------+  +------------------+ |
|                                                                   |
|  GAPS POR CATEGORIA                                               |
|  Medicacao:     ████████ 4                                       |
|  Dor:           ██████ 3                                         |
|  Diagnostico:   ████ 2                                           |
|  Handoff:       ██ 1                                             |
|  Documentacao:  ████ 2                                           |
|                                                                   |
|  GAPS CRITICOS ABERTOS                                            |
|  [!!!] COMP-003 - Resultado hemocultura nao visualizado (412A)   |
|  [!!!] COMP-005 - Dor 8/10 sem intervencao (407A)                |
|                                                                   |
|  TENDENCIA (7 dias)                                               |
|  Gaps/dia: 15 -> 12 -> 18 -> 14 -> 10 -> 12 -> 8 (melhorando)  |
|                                                                   |
+------------------------------------------------------------------+
```

---

## 10. Configuracao de Templates por Perfil de Paciente

```typescript
interface PatientProfileTemplate {
  profile_name: string;
  description: string;
  conditions: RuleCondition[];
  additional_rules: string[]; // IDs de regras extras
  modified_rules: Array<{
    rule_id: string;
    overrides: Partial<CompletenessRule>;
  }>;
}

const PROFILES: PatientProfileTemplate[] = [
  {
    profile_name: 'uti_paciente',
    description: 'Paciente em UTI - regras mais rigorosas',
    conditions: [{ field: 'location.ward_type', operator: 'eq', value: 'ICU' }],
    additional_rules: ['COMP-ICU-001', 'COMP-ICU-002'],
    modified_rules: [
      {
        rule_id: 'COMP-005', // Dor alta sem intervencao
        overrides: {
          expectation: {
            event_type: 'medication_administration.given|pain_assessment',
            time_window: { type: 'fixed', duration_minutes: 15 }, // 15 min em vez de 30
          },
        },
      },
    ],
  },
  {
    profile_name: 'pediatrico',
    description: 'Paciente pediatrico - escalas de dor adaptadas',
    conditions: [{ field: 'patient.age_years', operator: 'lt', value: 18 }],
    additional_rules: ['COMP-PED-001'],
    modified_rules: [],
  },
  {
    profile_name: 'pos_operatorio',
    description: 'Paciente em pos-operatorio imediato',
    conditions: [{ field: 'patient.post_op_hours', operator: 'lte', value: 24 }],
    additional_rules: ['COMP-POSTOP-001', 'COMP-POSTOP-002', 'COMP-POSTOP-003'],
    modified_rules: [
      {
        rule_id: 'COMP-005',
        overrides: {
          expectation: {
            event_type: 'medication_administration.given|pain_assessment',
            time_window: { type: 'fixed', duration_minutes: 15 },
          },
        },
      },
    ],
  },
];
```

---

## Referencias

- [Event Sourcing - Missing Events Pattern](https://microservices.io/)
- [Clinical Decision Support - Alert Fatigue](https://www.ncbi.nlm.nih.gov/)
- [Temporal Workflows](https://docs.temporal.io/)
- [NATS JetStream Consumers](https://docs.nats.io/)
- [FHIR R4 ClinicalReasoning](https://www.hl7.org/fhir/clinicalreasoning-module.html)
