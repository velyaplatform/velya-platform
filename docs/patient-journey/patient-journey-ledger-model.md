# Patient Journey Ledger - Modelo Event-Sourced

> Velya Platform - Documentacao Tecnica
> Ultima atualizacao: 2026-04-08
> Status: Especificacao Ativa

---

## 1. Visao Geral

O Patient Journey Ledger e o nucleo do sistema de rastreabilidade clinico-operacional da Velya.
Funciona como um **event store append-only** onde cada evento relacionado a um paciente
e registrado de forma imutavel, formando a "caixa-preta" hospitalar.

```
+------------------------------------------------------------------+
|                    PATIENT JOURNEY LEDGER                         |
|                                                                  |
|  +----------+  +----------+  +----------+  +----------+         |
|  | Evento 1 |->| Evento 2 |->| Evento 3 |->| Evento N |-> ...  |
|  +----------+  +----------+  +----------+  +----------+         |
|                                                                  |
|  Append-Only | Imutavel | Versionado | Rastreavel               |
+------------------------------------------------------------------+
        |              |              |              |
        v              v              v              v
  +-----------+  +-----------+  +-----------+  +-----------+
  | Projecao  |  | Projecao  |  | Projecao  |  | Projecao  |
  | Clinica   |  | Operac.   |  | Medicacao |  | Auditoria |
  +-----------+  +-----------+  +-----------+  +-----------+
```

### Principios Fundamentais

1. **Append-Only**: Eventos nunca sao deletados ou alterados. Correcoes geram novos eventos do tipo `corrected`.
2. **Imutabilidade**: Uma vez gravado, o evento e selado com hash criptografico.
3. **Rastreabilidade Total**: Todo evento possui autor, papel, timestamp, sistema de origem e proveniencia.
4. **Ordenacao Temporal**: Eventos possuem `occurred_at` (quando aconteceu) e `recorded_at` (quando foi registrado).
5. **Versionamento**: Eventos corrigidos referenciam o evento original via `supersedes`.

---

## 2. Arquitetura de Armazenamento

### 2.1 PostgreSQL - Event Store Principal

```sql
CREATE TABLE patient_journey_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL,
    encounter_id        UUID,
    event_type          VARCHAR(100) NOT NULL,
    event_category      VARCHAR(50) NOT NULL,
    occurred_at         TIMESTAMPTZ NOT NULL,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    authored_by         UUID NOT NULL,
    authored_role       VARCHAR(100) NOT NULL,
    source_system       VARCHAR(100) NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'active',
    clinical_relevance  VARCHAR(20) NOT NULL DEFAULT 'standard',
    provenance_link     UUID,
    version             INTEGER NOT NULL DEFAULT 1,
    supersedes          UUID REFERENCES patient_journey_events(event_id),
    payload             JSONB NOT NULL,
    metadata            JSONB DEFAULT '{}',
    hash                VARCHAR(128) NOT NULL,
    sequence_number     BIGSERIAL,
    partition_key       DATE GENERATED ALWAYS AS (occurred_at::date) STORED,

    CONSTRAINT chk_event_category CHECK (event_category IN (
        'clinical', 'operational', 'administrative', 'communication',
        'device', 'security', 'system', 'inferred', 'corrected', 'automated'
    )),
    CONSTRAINT chk_status CHECK (status IN (
        'active', 'superseded', 'retracted', 'pending_review'
    )),
    CONSTRAINT chk_clinical_relevance CHECK (clinical_relevance IN (
        'critical', 'high', 'standard', 'low', 'informational'
    ))
) PARTITION BY RANGE (partition_key);

CREATE INDEX idx_pje_patient_encounter ON patient_journey_events(patient_id, encounter_id);
CREATE INDEX idx_pje_occurred_at ON patient_journey_events(occurred_at);
CREATE INDEX idx_pje_event_type ON patient_journey_events(event_type);
CREATE INDEX idx_pje_authored_by ON patient_journey_events(authored_by);
CREATE INDEX idx_pje_supersedes ON patient_journey_events(supersedes) WHERE supersedes IS NOT NULL;
CREATE INDEX idx_pje_payload ON patient_journey_events USING GIN (payload);
```

### 2.2 NATS JetStream - Stream de Eventos

```
Stream: PATIENT_JOURNEY
  Subjects:
    patient.journey.{patient_id}.{event_category}.{event_type}
  Retention: Limits
  MaxAge: 365d
  Storage: File
  Replicas: 3
  MaxMsgSize: 512KB
  Discard: Old
  DenyDelete: true
  DenyPurge: true

Consumer Groups:
  - projection-clinical     (filter: patient.journey.*.clinical.>)
  - projection-operational  (filter: patient.journey.*.operational.>)
  - projection-medication   (filter: patient.journey.*.clinical.medication.>)
  - projection-audit        (filter: patient.journey.*.>)
  - gap-detection           (filter: patient.journey.*.>)
  - timeline-confidence     (filter: patient.journey.*.>)
  - digital-twin            (filter: patient.journey.*.>)
  - notification-engine     (filter: patient.journey.*.*.critical)
```

---

## 3. Taxonomia de Eventos

### 3.1 Categorias e Tipos

| Categoria        | Descricao                       | Exemplos de Tipos                                                                                                                                                                                                |
| ---------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clinical`       | Atos clinicos diretos           | `diagnosis`, `assessment`, `procedure`, `medication_request`, `medication_administration`, `observation`, `vital_signs`, `lab_result`, `imaging_result`, `pain_assessment`, `clinical_note`, `discharge_summary` |
| `operational`    | Fluxo operacional               | `admission`, `transfer`, `discharge`, `bed_assignment`, `unit_change`, `handoff_initiated`, `handoff_accepted`, `handoff_refused`, `scheduling`, `transport_request`, `transport_completed`                      |
| `administrative` | Processos administrativos       | `registration`, `insurance_verification`, `consent_obtained`, `consent_revoked`, `document_signed`, `billing_event`, `authorization_request`                                                                     |
| `communication`  | Interacoes e chamados           | `patient_call`, `call_response`, `call_resolution`, `call_abandoned`, `family_contact`, `interdisciplinary_consult_request`, `interdisciplinary_consult_response`, `message_sent`, `message_read`                |
| `device`         | Equipamentos e dispositivos     | `monitor_alert`, `infusion_pump_event`, `ventilator_event`, `device_connected`, `device_disconnected`, `alarm_triggered`, `alarm_silenced`, `telemetry_data`                                                     |
| `security`       | Seguranca e acesso              | `record_accessed`, `record_exported`, `break_glass_activated`, `access_denied`, `signature_applied`, `data_masked`                                                                                               |
| `system`         | Eventos de sistema              | `integration_received`, `integration_sent`, `sync_completed`, `sync_failed`, `timeout_detected`, `retry_attempted`                                                                                               |
| `inferred`       | Eventos inferidos por IA/regras | `gap_detected`, `risk_score_updated`, `anomaly_detected`, `pattern_identified`, `completeness_alert`, `deterioration_risk`                                                                                       |
| `corrected`      | Correcoes de eventos anteriores | `event_corrected`, `event_retracted`, `late_documentation`, `addendum`, `amendment`                                                                                                                              |
| `automated`      | Acoes automatizadas             | `auto_escalation`, `auto_notification`, `auto_task_created`, `auto_reminder`, `rule_triggered`, `workflow_step_completed`                                                                                        |

### 3.2 Subtipos de Medicacao (Detalhamento)

| Subtipo                                   | Descricao                         |
| ----------------------------------------- | --------------------------------- |
| `medication_request.new`                  | Nova prescricao                   |
| `medication_request.modified`             | Alteracao de prescricao           |
| `medication_request.cancelled`            | Cancelamento de prescricao        |
| `medication_request.suspended`            | Suspensao temporaria              |
| `medication_administration.given`         | Medicamento administrado          |
| `medication_administration.refused`       | Paciente recusou                  |
| `medication_administration.held`          | Suspenso pelo profissional        |
| `medication_administration.not_given`     | Nao administrado por outro motivo |
| `medication_administration.delayed`       | Administrado com atraso           |
| `medication_administration.substituted`   | Substituicao realizada            |
| `medication_administration.double_check`  | Dupla verificacao registrada      |
| `medication_administration.adverse_event` | Evento adverso registrado         |

---

## 4. Interfaces TypeScript

### 4.1 Evento Base

```typescript
/**
 * Campos minimos obrigatorios para qualquer evento do Patient Journey Ledger.
 * Todo evento no sistema DEVE implementar esta interface.
 */
interface PatientJourneyEvent {
  /** Identificador unico do evento (UUID v7 - time-ordered) */
  event_id: string;

  /** Identificador do paciente (referencia ao FHIR Patient) */
  patient_id: string;

  /** Identificador do encontro/internacao (referencia ao FHIR Encounter) */
  encounter_id: string | null;

  /** Tipo do evento - hierarquico com ponto (ex: medication_administration.given) */
  event_type: string;

  /** Categoria do evento */
  event_category: EventCategory;

  /** Momento em que o evento realmente aconteceu (informado pelo autor) */
  occurred_at: string; // ISO 8601

  /** Momento em que o evento foi registrado no sistema */
  recorded_at: string; // ISO 8601

  /** Identificador do autor do evento (referencia ao FHIR Practitioner) */
  authored_by: string;

  /** Papel/funcao do autor no momento do evento */
  authored_role: AuthoredRole;

  /** Sistema de origem do evento */
  source_system: SourceSystem;

  /** Status atual do evento */
  status: EventStatus;

  /** Relevancia clinica do evento */
  clinical_relevance: ClinicalRelevance;

  /** Referencia ao recurso FHIR Provenance correspondente */
  provenance_link: string | null;

  /** Versao do evento (incrementa em correcoes) */
  version: number;

  /** Referencia ao evento que este substitui (em caso de correcao) */
  supersedes: string | null;

  /** Dados especificos do tipo de evento */
  payload: Record<string, unknown>;

  /** Metadados adicionais (tags, contexto, correlacao) */
  metadata: EventMetadata;

  /** Hash SHA-256 do evento para garantia de integridade */
  hash: string;

  /** Numero sequencial global (gerado pelo banco) */
  sequence_number: number;
}

type EventCategory =
  | 'clinical'
  | 'operational'
  | 'administrative'
  | 'communication'
  | 'device'
  | 'security'
  | 'system'
  | 'inferred'
  | 'corrected'
  | 'automated';

type EventStatus = 'active' | 'superseded' | 'retracted' | 'pending_review';

type ClinicalRelevance = 'critical' | 'high' | 'standard' | 'low' | 'informational';

type AuthoredRole =
  | 'physician'
  | 'nurse'
  | 'nursing_technician'
  | 'pharmacist'
  | 'physiotherapist'
  | 'nutritionist'
  | 'psychologist'
  | 'social_worker'
  | 'administrative'
  | 'system'
  | 'device'
  | 'patient'
  | 'companion';

type SourceSystem =
  | 'velya-ehr'
  | 'velya-nursing'
  | 'velya-pharmacy'
  | 'velya-lab'
  | 'velya-imaging'
  | 'velya-bed-management'
  | 'velya-call-system'
  | 'velya-transport'
  | 'velya-devices'
  | 'velya-billing'
  | 'velya-mobile'
  | 'external-integration'
  | 'velya-rules-engine'
  | 'velya-ai-engine';

interface EventMetadata {
  /** ID de correlacao para agrupar eventos relacionados */
  correlation_id?: string;

  /** ID de causacao - evento que causou este */
  causation_id?: string;

  /** Tags livres para classificacao */
  tags?: string[];

  /** Localizacao (ala, quarto, leito) */
  location?: {
    ward: string;
    room: string;
    bed: string;
  };

  /** Turno em que o evento ocorreu */
  shift?: 'morning' | 'afternoon' | 'night';

  /** Dispositivo ou estacao de origem */
  device_id?: string;
  workstation_id?: string;

  /** IP e sessao de origem (para auditoria) */
  source_ip?: string;
  session_id?: string;

  /** Tempo entre ocorrencia e registro (em segundos) */
  documentation_delay_seconds?: number;

  /** Indicador de documentacao tardia */
  is_late_documentation?: boolean;

  /** Contexto do OpenTelemetry */
  trace_id?: string;
  span_id?: string;
}
```

### 4.2 Eventos Clinicos Especializados

```typescript
interface ClinicalAssessmentEvent extends PatientJourneyEvent {
  event_category: 'clinical';
  event_type: 'assessment';
  payload: {
    assessment_type: string;
    findings: string;
    severity?: string;
    scales?: Record<string, number>;
    follow_up_required: boolean;
    follow_up_due_at?: string;
    fhir_observation_id?: string;
  };
}

interface MedicationRequestEvent extends PatientJourneyEvent {
  event_category: 'clinical';
  event_type: `medication_request.${'new' | 'modified' | 'cancelled' | 'suspended'}`;
  payload: {
    medication_code: string;
    medication_name: string;
    dose: string;
    dose_unit: string;
    route: string;
    frequency: string;
    prn: boolean;
    prn_reason?: string;
    start_date: string;
    end_date?: string;
    instructions?: string;
    fhir_medication_request_id: string;
    previous_request_id?: string;
    reason_for_change?: string;
  };
}

interface MedicationAdministrationEvent extends PatientJourneyEvent {
  event_category: 'clinical';
  event_type: `medication_administration.${
    | 'given'
    | 'refused'
    | 'held'
    | 'not_given'
    | 'delayed'
    | 'substituted'
    | 'double_check'
    | 'adverse_event'}`;
  payload: {
    medication_code: string;
    medication_name: string;
    dose_given: string;
    dose_unit: string;
    route: string;
    scheduled_time: string;
    actual_time?: string;
    delay_minutes?: number;
    request_reference: string;
    performer: string;
    performer_role: AuthoredRole;
    witness?: string;
    witness_role?: AuthoredRole;
    double_check_performed: boolean;
    double_check_by?: string;
    patient_state_before?: string;
    patient_state_after?: string;
    pain_before?: number;
    pain_after?: number;
    refusal_reason?: string;
    hold_reason?: string;
    not_given_reason?: string;
    substitution_reason?: string;
    substituted_from?: string;
    adverse_event_description?: string;
    adverse_event_severity?: 'mild' | 'moderate' | 'severe' | 'life_threatening';
    fhir_medication_administration_id: string;
    lot_number?: string;
    expiration_date?: string;
  };
}

interface VitalSignsEvent extends PatientJourneyEvent {
  event_category: 'clinical';
  event_type: 'vital_signs';
  payload: {
    heart_rate?: number;
    systolic_bp?: number;
    diastolic_bp?: number;
    respiratory_rate?: number;
    temperature?: number;
    spo2?: number;
    pain_scale?: number;
    consciousness_level?: string;
    news_score?: number;
    mews_score?: number;
    collection_method: 'manual' | 'device' | 'telemetry';
    device_id?: string;
    fhir_observation_ids: string[];
  };
}

interface ProcedureEvent extends PatientJourneyEvent {
  event_category: 'clinical';
  event_type: 'procedure';
  payload: {
    procedure_code: string;
    procedure_name: string;
    category: string;
    started_at: string;
    ended_at?: string;
    performers: Array<{
      practitioner_id: string;
      role: string;
    }>;
    anesthesia_type?: string;
    outcome?: string;
    complications?: string[];
    notes?: string;
    fhir_procedure_id: string;
  };
}

interface PainAssessmentEvent extends PatientJourneyEvent {
  event_category: 'clinical';
  event_type: 'pain_assessment';
  payload: {
    scale_used: 'NRS' | 'VAS' | 'Wong-Baker' | 'BPS' | 'CPOT' | 'other';
    score: number;
    max_score: number;
    location: string;
    character: string;
    duration: string;
    aggravating_factors?: string[];
    relieving_factors?: string[];
    intervention_performed: boolean;
    intervention_description?: string;
    reassessment_due_at?: string;
    previous_assessment_id?: string;
    trend: 'improving' | 'stable' | 'worsening' | 'new' | 'unknown';
  };
}
```

### 4.3 Eventos Operacionais

```typescript
interface HandoffEvent extends PatientJourneyEvent {
  event_category: 'operational';
  event_type: `handoff_${'initiated' | 'accepted' | 'refused'}`;
  payload: {
    handoff_id: string;
    from_practitioner: string;
    from_role: AuthoredRole;
    to_practitioner: string;
    to_role: AuthoredRole;
    format: 'SBAR' | 'I-PASS' | 'closed_loop' | 'simplified';
    reason: string;
    context_summary: string;
    pending_items: Array<{
      description: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
      due_at?: string;
    }>;
    risk_assessment: string;
    acceptance_time?: string;
    refusal_reason?: string;
    transition_dead_time_seconds?: number;
  };
}

interface TransferEvent extends PatientJourneyEvent {
  event_category: 'operational';
  event_type: 'transfer' | 'unit_change' | 'bed_assignment';
  payload: {
    from_location: {
      ward: string;
      room: string;
      bed: string;
    };
    to_location: {
      ward: string;
      room: string;
      bed: string;
    };
    reason: string;
    transport_mode: 'walking' | 'wheelchair' | 'stretcher' | 'bed';
    escort: string;
    escort_role: AuthoredRole;
    departed_at: string;
    arrived_at?: string;
    new_responsible?: string;
    new_responsible_role?: AuthoredRole;
  };
}

interface AdmissionEvent extends PatientJourneyEvent {
  event_category: 'operational';
  event_type: 'admission';
  payload: {
    admission_type: 'emergency' | 'elective' | 'urgent' | 'observation';
    admission_source: string;
    attending_physician: string;
    primary_nurse: string;
    location: {
      ward: string;
      room: string;
      bed: string;
    };
    diagnosis_on_admission: string;
    severity: string;
    isolation_required: boolean;
    isolation_type?: string;
    fall_risk: 'low' | 'medium' | 'high';
    pressure_injury_risk: 'low' | 'medium' | 'high';
    allergies: string[];
    fhir_encounter_id: string;
  };
}
```

### 4.4 Eventos de Comunicacao

```typescript
interface PatientCallEvent extends PatientJourneyEvent {
  event_category: 'communication';
  event_type: 'patient_call' | 'call_response' | 'call_resolution' | 'call_abandoned';
  payload: {
    call_id: string;
    source: 'bed_button' | 'tablet' | 'app' | 'voice' | 'companion' | 'staff';
    category: CallCategory;
    urgency: 'routine' | 'urgent' | 'emergency';
    description?: string;
    pain_intensity?: number;
    responder?: string;
    responder_role?: AuthoredRole;
    time_to_first_contact_seconds?: number;
    time_to_resolution_seconds?: number;
    resolution_description?: string;
    reopened: boolean;
    reopen_count?: number;
    abandoned: boolean;
    redirected_to?: string;
    redirected_reason?: string;
    related_call_ids?: string[];
  };
}

type CallCategory =
  | 'pain'
  | 'physical_help'
  | 'hygiene'
  | 'positioning'
  | 'water_food'
  | 'discomfort'
  | 'missing_medication'
  | 'equipment'
  | 'anxiety_fear'
  | 'urgent_need'
  | 'information'
  | 'other';
```

### 4.5 Eventos de Seguranca

```typescript
interface SecurityAccessEvent extends PatientJourneyEvent {
  event_category: 'security';
  event_type: 'record_accessed' | 'record_exported' | 'break_glass_activated' | 'access_denied';
  payload: {
    accessor_id: string;
    accessor_role: AuthoredRole;
    resource_type: string;
    resource_id: string;
    access_type: 'read' | 'write' | 'export' | 'print' | 'delete';
    justification?: string;
    break_glass: boolean;
    break_glass_reason?: string;
    duration_seconds?: number;
    sections_viewed?: string[];
    sections_expanded?: string[];
    data_exported?: boolean;
    export_format?: string;
    ip_address: string;
    user_agent: string;
    session_id: string;
  };
}
```

### 4.6 Eventos Inferidos e Corrigidos

```typescript
interface InferredEvent extends PatientJourneyEvent {
  event_category: 'inferred';
  event_type:
    | 'gap_detected'
    | 'risk_score_updated'
    | 'anomaly_detected'
    | 'pattern_identified'
    | 'completeness_alert';
  payload: {
    rule_id: string;
    rule_name: string;
    rule_version: string;
    confidence: number;
    evidence: Array<{
      event_id: string;
      event_type: string;
      relevance: string;
    }>;
    description: string;
    recommendation?: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    auto_action_taken?: string;
    requires_human_review: boolean;
  };
}

interface CorrectedEvent extends PatientJourneyEvent {
  event_category: 'corrected';
  event_type:
    | 'event_corrected'
    | 'event_retracted'
    | 'late_documentation'
    | 'addendum'
    | 'amendment';
  payload: {
    original_event_id: string;
    original_event_type: string;
    reason: string;
    correction_type:
      | 'factual_error'
      | 'timing_error'
      | 'attribution_error'
      | 'omission'
      | 'addendum'
      | 'retraction';
    original_values?: Record<string, unknown>;
    corrected_values?: Record<string, unknown>;
    delay_from_original_seconds: number;
    approved_by?: string;
    approved_at?: string;
  };
}
```

---

## 5. Projecoes (Read Models)

As projecoes sao visoes materializadas construidas a partir dos eventos do ledger,
otimizadas para consultas especificas.

### 5.1 Diagrama de Projecoes

```
+-------------------+
|  Event Ledger     |
|  (append-only)    |
+--------+----------+
         |
    NATS JetStream
         |
    +----+----+----+----+----+----+----+----+
    |    |    |    |    |    |    |    |    |
    v    v    v    v    v    v    v    v    v
  +--+ +--+ +--+ +--+ +--+ +--+ +--+ +--+
  |CL| |OP| |MD| |CP| |HO| |MV| |AU| |EX|
  +--+ +--+ +--+ +--+ +--+ +--+ +--+ +--+
   |    |    |    |    |    |    |    |
   v    v    v    v    v    v    v    v
  PostgreSQL Materialized Views / Redis Cache

  CL = Clinical View       OP = Operational View
  MD = Medication View      CP = Calls/Pain View
  HO = Handoff View         MV = Movement View
  AU = Audit View           EX = Executive View
```

### 5.2 Projecao Clinica

```typescript
interface ClinicalProjection {
  patient_id: string;
  encounter_id: string;
  updated_at: string;

  current_diagnoses: Array<{
    code: string;
    description: string;
    status: string;
    onset_date: string;
    diagnosed_by: string;
  }>;

  active_problems: Array<{
    description: string;
    severity: string;
    onset_date: string;
  }>;

  recent_assessments: Array<{
    type: string;
    findings: string;
    assessed_by: string;
    assessed_at: string;
    follow_up_due: string | null;
  }>;

  latest_vitals: {
    heart_rate: number | null;
    systolic_bp: number | null;
    diastolic_bp: number | null;
    respiratory_rate: number | null;
    temperature: number | null;
    spo2: number | null;
    pain_scale: number | null;
    news_score: number | null;
    collected_at: string;
    collected_by: string;
  };

  active_care_plan: {
    goals: string[];
    interventions: string[];
    next_review: string;
  } | null;

  alerts: Array<{
    type: string;
    message: string;
    severity: ClinicalRelevance;
    created_at: string;
  }>;

  allergies: Array<{
    substance: string;
    reaction: string;
    severity: string;
  }>;
}
```

### 5.3 Projecao Operacional

```typescript
interface OperationalProjection {
  patient_id: string;
  encounter_id: string;
  updated_at: string;

  current_location: {
    ward: string;
    room: string;
    bed: string;
    since: string;
  };

  current_responsible: {
    attending_physician: { id: string; name: string; since: string };
    primary_nurse: { id: string; name: string; since: string };
    current_shift_nurse: { id: string; name: string; since: string } | null;
  };

  admission_info: {
    admitted_at: string;
    admission_type: string;
    los_days: number;
    expected_discharge: string | null;
  };

  pending_items: Array<{
    type: string;
    description: string;
    priority: string;
    due_at: string | null;
    assigned_to: string;
    created_at: string;
    source_event_id: string;
  }>;

  recent_transfers: Array<{
    from: string;
    to: string;
    at: string;
    reason: string;
  }>;

  isolation: {
    required: boolean;
    type: string | null;
    since: string | null;
  };

  operational_risk_score: number;
  documentation_completeness: number;
}
```

### 5.4 Projecao de Medicacao

```typescript
interface MedicationProjection {
  patient_id: string;
  encounter_id: string;
  updated_at: string;

  active_prescriptions: Array<{
    request_id: string;
    medication_name: string;
    dose: string;
    route: string;
    frequency: string;
    prn: boolean;
    prescribed_by: string;
    prescribed_at: string;
    status: string;
    next_scheduled: string | null;
    administrations_today: number;
    missed_doses: number;
    delays: number;
  }>;

  recent_administrations: Array<{
    administration_id: string;
    medication_name: string;
    dose: string;
    scheduled_time: string;
    actual_time: string | null;
    status: string;
    performer: string;
    double_check: boolean;
    delay_minutes: number;
  }>;

  anomalies: Array<{
    type: string;
    description: string;
    severity: string;
    detected_at: string;
    related_events: string[];
  }>;

  medication_integrity_score: number;
}
```

### 5.5 Projecao de Chamados e Dor

```typescript
interface CallsPainProjection {
  patient_id: string;
  encounter_id: string;
  updated_at: string;

  active_calls: Array<{
    call_id: string;
    category: CallCategory;
    urgency: string;
    started_at: string;
    elapsed_seconds: number;
    status: 'pending' | 'responding' | 'resolved' | 'abandoned';
  }>;

  pain_timeline: Array<{
    assessed_at: string;
    score: number;
    location: string;
    trend: string;
    intervention: string | null;
    assessed_by: string;
  }>;

  call_statistics: {
    total_today: number;
    resolved_today: number;
    abandoned_today: number;
    avg_response_time_seconds: number;
    avg_resolution_time_seconds: number;
    recurring_categories: Array<{ category: string; count: number }>;
  };

  current_pain: {
    score: number | null;
    location: string | null;
    last_assessed_at: string | null;
    reassessment_due: string | null;
    trend: string;
  };
}
```

### 5.6 Projecao de Handoff

```typescript
interface HandoffProjection {
  patient_id: string;
  encounter_id: string;
  updated_at: string;

  current_custody: {
    responsible: string;
    role: AuthoredRole;
    assumed_at: string;
    shift: string;
  };

  handoff_chain: Array<{
    handoff_id: string;
    from: { id: string; name: string; role: string };
    to: { id: string; name: string; role: string };
    initiated_at: string;
    accepted_at: string | null;
    status: 'pending' | 'accepted' | 'refused' | 'expired';
    transition_time_seconds: number;
    dead_time_seconds: number;
    pending_items_count: number;
  }>;

  pending_handoffs: Array<{
    handoff_id: string;
    initiated_at: string;
    from: string;
    to: string;
    elapsed_seconds: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
  }>;

  custody_gaps: Array<{
    from: string;
    to: string;
    duration_seconds: number;
    context: string;
  }>;
}
```

### 5.7 Projecao de Movimentacao

```typescript
interface MovementProjection {
  patient_id: string;
  encounter_id: string;
  updated_at: string;

  location_history: Array<{
    ward: string;
    room: string;
    bed: string;
    arrived_at: string;
    departed_at: string | null;
    duration_hours: number;
    responsible_during: string;
  }>;

  current_location: {
    ward: string;
    room: string;
    bed: string;
    since: string;
  };

  pending_transfers: Array<{
    to_ward: string;
    reason: string;
    requested_at: string;
    requested_by: string;
    status: 'pending' | 'confirmed' | 'in_transit';
  }>;

  transport_history: Array<{
    from: string;
    to: string;
    mode: string;
    departed_at: string;
    arrived_at: string;
    escort: string;
    duration_minutes: number;
  }>;
}
```

### 5.8 Projecao de Auditoria

```typescript
interface AuditProjection {
  patient_id: string;
  encounter_id: string;
  updated_at: string;

  total_events: number;
  events_by_category: Record<EventCategory, number>;
  events_by_author: Array<{ author: string; role: string; count: number }>;
  events_by_source: Record<SourceSystem, number>;

  corrections: Array<{
    original_event_id: string;
    corrected_at: string;
    corrected_by: string;
    reason: string;
    delay_hours: number;
  }>;

  late_documentations: Array<{
    event_id: string;
    event_type: string;
    occurred_at: string;
    recorded_at: string;
    delay_minutes: number;
  }>;

  access_log: Array<{
    accessor: string;
    role: string;
    accessed_at: string;
    access_type: string;
    sections: string[];
    break_glass: boolean;
  }>;

  gaps_detected: Array<{
    gap_id: string;
    rule: string;
    detected_at: string;
    severity: string;
    status: 'open' | 'resolved' | 'acknowledged';
  }>;

  timeline_confidence_score: number;
  documentation_integrity_score: number;
}
```

### 5.9 Projecao Executiva

```typescript
interface ExecutiveProjection {
  patient_id: string;
  encounter_id: string;
  updated_at: string;

  summary: {
    patient_name: string;
    age: number;
    admission_date: string;
    los_days: number;
    primary_diagnosis: string;
    acuity: 'low' | 'medium' | 'high' | 'critical';
    expected_discharge: string | null;
  };

  risk_indicators: {
    clinical_deterioration: number; // 0-100
    medication_safety: number;
    documentation_completeness: number;
    handoff_integrity: number;
    call_response_quality: number;
    overall_journey_confidence: number;
  };

  key_metrics: {
    total_events_24h: number;
    open_pending_items: number;
    unresolved_calls: number;
    missed_medications: number;
    pending_handoffs: number;
    gaps_detected: number;
    corrections_made: number;
  };

  alerts: Array<{
    type: string;
    message: string;
    severity: ClinicalRelevance;
    requires_action: boolean;
    responsible: string;
  }>;

  next_actions: Array<{
    action: string;
    due_at: string;
    assigned_to: string;
    priority: string;
  }>;
}
```

---

## 6. Pipeline de Processamento

### 6.1 Fluxo de Ingestao

```
  Evento Originado
        |
        v
  +-------------+
  | Validacao    |  Schema validation, campos obrigatorios,
  | de Schema   |  consistencia de tipos
  +------+------+
         |
         v
  +-------------+
  | Enriqueci-  |  Adiciona metadata: shift, location context,
  | mento       |  correlation_id, documentation_delay
  +------+------+
         |
         v
  +-------------+
  | Hash &      |  SHA-256 do payload + campos chave
  | Selagem     |  Garante integridade
  +------+------+
         |
    +----+----+
    |         |
    v         v
  +----+   +------+
  | PG |   | NATS |
  | WR |   | PUB  |
  +----+   +------+
    |         |
    |    +----+----+----+----+
    |    |    |    |    |    |
    v    v    v    v    v    v
  Event  Projecoes  Gap   Digital  Timeline
  Store            Detect  Twin    Confidence
```

### 6.2 Temporal Workflows

```typescript
// Workflow de ingestao de evento
interface IngestEventWorkflow {
  workflowId: string;
  taskQueue: 'patient-journey-ingestion';
  activities: [
    'validateEventSchema',
    'enrichEventMetadata',
    'computeEventHash',
    'persistToEventStore',
    'publishToNATS',
    'updateProjections',
    'checkGapRules',
    'updateTimelineConfidence',
    'updateDigitalTwin',
    'notifyIfCritical',
  ];
}

// Workflow de correcao de evento
interface CorrectEventWorkflow {
  workflowId: string;
  taskQueue: 'patient-journey-correction';
  activities: [
    'validateCorrectionRequest',
    'markOriginalAsSuperseded',
    'createCorrectedEvent',
    'recalculateProjections',
    'updateTimelineConfidence',
    'auditCorrectionTrail',
    'notifyStakeholders',
  ];
}
```

---

## 7. Observabilidade

### 7.1 Metricas Prometheus

```promql
# Taxa de ingestao de eventos por categoria
rate(patient_journey_events_ingested_total[5m])

# Latencia de ingestao (p99)
histogram_quantile(0.99, rate(patient_journey_ingestion_duration_seconds_bucket[5m]))

# Eventos pendentes no NATS
nats_jetstream_consumer_num_pending{stream="PATIENT_JOURNEY"}

# Atraso de documentacao medio
avg(patient_journey_documentation_delay_seconds)

# Projecoes desatualizadas
patient_journey_projection_lag_seconds

# Taxa de correcoes
rate(patient_journey_corrections_total[1h])

# Gaps detectados por regra
patient_journey_gaps_detected_total{rule_id=~".+"}
```

### 7.2 Logs Estruturados (Loki)

```
{app="patient-journey-ledger"} | json |
  event_type = "medication_administration.given" |
  delay_minutes > 30
```

### 7.3 Traces OpenTelemetry

Cada evento gera um span no trace do encounter:

```
Trace: encounter-{encounter_id}
  Span: event-ingestion-{event_id}
    Attributes:
      patient.id: {patient_id}
      event.type: {event_type}
      event.category: {event_category}
      event.clinical_relevance: {clinical_relevance}
      author.id: {authored_by}
      author.role: {authored_role}
      documentation.delay_seconds: {delay}
```

---

## 8. Politicas de Retencao e Ciclo de Vida

| Tipo de Dado                             | Retencao                   | Armazenamento        |
| ---------------------------------------- | -------------------------- | -------------------- |
| Eventos ativos                           | Ilimitado                  | PostgreSQL Hot       |
| Eventos de encontros encerrados (>1 ano) | 20 anos                    | PostgreSQL Cold + S3 |
| Projecoes                                | Ate encerramento + 90 dias | PostgreSQL + Redis   |
| Stream NATS                              | 365 dias                   | NATS File Store      |
| Logs de auditoria                        | 20 anos                    | Loki + S3            |
| Traces                                   | 90 dias                    | Tempo                |
| Metricas                                 | 2 anos                     | Prometheus + Thanos  |

---

## 9. Consistencia e Garantias

1. **At-least-once delivery**: NATS JetStream garante entrega. Projecoes sao idempotentes.
2. **Ordered per patient**: Eventos do mesmo paciente sao processados em ordem via NATS subject partitioning.
3. **Eventual consistency**: Projecoes podem ter lag de ate 5 segundos em operacao normal.
4. **Strong consistency**: Event store PostgreSQL com transacao atomica.
5. **Conflict resolution**: Eventos com mesmo `occurred_at` sao ordenados por `sequence_number`.
6. **Idempotency**: Re-processamento de eventos usa `event_id` como chave de deduplicacao.

---

## 10. Exemplo Completo de Evento

```json
{
  "event_id": "01912f3a-4b5c-7d8e-9f0a-1b2c3d4e5f6a",
  "patient_id": "patient-001",
  "encounter_id": "encounter-2026-0408-001",
  "event_type": "medication_administration.given",
  "event_category": "clinical",
  "occurred_at": "2026-04-08T14:35:00-03:00",
  "recorded_at": "2026-04-08T14:37:22-03:00",
  "authored_by": "practitioner-nurse-042",
  "authored_role": "nurse",
  "source_system": "velya-nursing",
  "status": "active",
  "clinical_relevance": "standard",
  "provenance_link": "provenance-med-admin-9f0a",
  "version": 1,
  "supersedes": null,
  "payload": {
    "medication_code": "J01CA04",
    "medication_name": "Amoxicilina 500mg",
    "dose_given": "500",
    "dose_unit": "mg",
    "route": "oral",
    "scheduled_time": "2026-04-08T14:00:00-03:00",
    "actual_time": "2026-04-08T14:35:00-03:00",
    "delay_minutes": 35,
    "request_reference": "med-request-001",
    "performer": "practitioner-nurse-042",
    "performer_role": "nurse",
    "double_check_performed": false,
    "patient_state_before": "Paciente consciente, orientado, sem queixas",
    "pain_before": 2,
    "fhir_medication_administration_id": "MedicationAdministration/ma-001",
    "lot_number": "LOT2026A",
    "expiration_date": "2027-06-30"
  },
  "metadata": {
    "correlation_id": "corr-med-cycle-001",
    "location": {
      "ward": "Clinica Medica",
      "room": "412",
      "bed": "A"
    },
    "shift": "afternoon",
    "workstation_id": "ws-cm-floor4-01",
    "documentation_delay_seconds": 142,
    "is_late_documentation": false,
    "trace_id": "abc123def456",
    "span_id": "span-789"
  },
  "hash": "sha256:a1b2c3d4e5f6...",
  "sequence_number": 145892
}
```

---

## Referencias

- [FHIR R4 Provenance](https://www.hl7.org/fhir/provenance.html)
- [FHIR R4 AuditEvent](https://www.hl7.org/fhir/auditevent.html)
- [Event Sourcing Pattern](https://microservices.io/patterns/data/event-sourcing.html)
- [NATS JetStream Documentation](https://docs.nats.io/nats-concepts/jetstream)
- [Temporal Workflow Engine](https://docs.temporal.io/)
- [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/)
