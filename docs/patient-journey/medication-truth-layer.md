# Medication Truth Layer - Camada de Verdade da Medicacao

> Velya Platform - Documentacao Tecnica
> Ultima atualizacao: 2026-04-08
> Status: Especificacao Ativa

---

## 1. Visao Geral

A Medication Truth Layer e a camada de rastreabilidade end-to-end do ciclo de vida
de cada medicamento prescrito para um paciente. Garante que cada etapa — da prescricao
a administracao — seja rastreavel, auditavel e verificavel.

### Principio

> **Cada medicamento tem uma historia completa: quem pediu, quem aprovou, quem dispensou,
> quem administrou, quem verificou, quando, em que contexto, e qual foi o efeito.**

```
+----------+    +----------+    +----------+    +--------------+    +----------+
| PRESCRICAO| -> | APROVACAO | -> | DISPENSA-| -> | ADMINISTRA-  | -> | RESULTADO|
| (Request) |    | (Review)  |    | CAO      |    | CAO          |    | (Efeito) |
+----------+    +----------+    +----------+    +--------------+    +----------+
     |               |               |               |                    |
     v               v               v               v                    v
  Quem?           Quem?           Quem?          Quem?               Dor?
  Quando?         Quando?         Quando?        Quando?             Reacao?
  Por que?        Valida?         Lote?          Dupla check?         Efeito?
  Contexto?       Interacao?      Validade?      Testemunha?          Adverso?
                  Dose ok?        Quantidade?    Estado paciente?
                                                 Horario ok?
```

---

## 2. Ciclo de Vida Completo da Medicacao

### 2.1 Etapas e Atores

| Etapa                        | Ator Principal               | Papel        | Recurso FHIR               | Evento Journey                            |
| ---------------------------- | ---------------------------- | ------------ | -------------------------- | ----------------------------------------- |
| Prescricao                   | Medico                       | Prescritor   | MedicationRequest          | `medication_request.new`                  |
| Revisao Farmaceutica         | Farmaceutico                 | Revisor      | MedicationRequest (nota)   | `medication_request.reviewed`             |
| Aprovacao                    | Farmaceutico / Medico Senior | Aprovador    | MedicationRequest (status) | `medication_request.approved`             |
| Dispensacao                  | Farmaceutico / Tecnico       | Dispensador  | MedicationDispense         | `medication_dispensed`                    |
| Preparacao                   | Enfermeiro                   | Preparador   | (extension)                | `medication_prepared`                     |
| Verificacao (Dupla Checagem) | Segundo Enfermeiro           | Verificador  | (extension)                | `medication_double_check`                 |
| Administracao                | Enfermeiro                   | Executor     | MedicationAdministration   | `medication_administration.given`         |
| Monitoramento                | Enfermeiro / Medico          | Monitorador  | Observation                | `medication_monitoring`                   |
| Registro de Efeito           | Enfermeiro                   | Documentador | Observation                | `pain_assessment`, `vital_signs`          |
| Evento Adverso               | Enfermeiro / Medico          | Notificador  | AdverseEvent               | `medication_administration.adverse_event` |

### 2.2 Diagrama de Fluxo Detalhado

```
  MEDICO                  FARMACIA              ENFERMAGEM              PACIENTE
    |                        |                      |                      |
    |-- Prescreve ---------->|                      |                      |
    |   (MedicationRequest)  |                      |                      |
    |                        |-- Revisa             |                      |
    |                        |   Interacoes?        |                      |
    |                        |   Dose adequada?     |                      |
    |                        |   Alergia?           |                      |
    |                        |                      |                      |
    |                        |-- Aprova/Rejeita     |                      |
    |                        |                      |                      |
    |                        |-- Dispensa ---------->|                      |
    |                        |   (Lote, Validade)   |                      |
    |                        |                      |                      |
    |                        |                      |-- Prepara            |
    |                        |                      |   (Diluicao, etc)    |
    |                        |                      |                      |
    |                        |                      |-- Dupla Checagem     |
    |                        |                      |   (Segundo prof.)    |
    |                        |                      |                      |
    |                        |                      |-- Verifica Paciente  |
    |                        |                      |   (5 certos)         |
    |                        |                      |                      |
    |                        |                      |-- Administra ------->|
    |                        |                      |                      |
    |                        |                      |-- Registra Estado    |
    |                        |                      |   (Dor, Sinais)      |
    |                        |                      |                      |
    |                        |                      |-- Monitora Efeito   |
    |                        |                      |                      |
    |                        |                      |   [Se adverso]       |
    |                        |                      |-- Notifica --------->|
    |<-- Reavalia ------------|                      |                      |
    |                        |                      |                      |
```

---

## 3. Interfaces TypeScript

### 3.1 Ciclo Completo de Medicacao

```typescript
/**
 * Representa o ciclo de vida completo de uma prescricao,
 * desde a solicitacao ate o resultado final.
 */
interface MedicationLifecycle {
  /** ID do ciclo */
  lifecycle_id: string;

  /** Referencia ao paciente */
  patient_id: string;
  encounter_id: string;

  /** Medicamento */
  medication: {
    code: string;
    name: string;
    form: string; // comprimido, solucao, injetavel
    concentration?: string; // ex: "500mg/5ml"
  };

  /** Etapa 1: Prescricao */
  request: MedicationRequestPhase;

  /** Etapa 2: Revisao Farmaceutica */
  pharmaceutical_review: PharmaceuticalReviewPhase | null;

  /** Etapa 3: Dispensacao */
  dispensation: DispensationPhase | null;

  /** Etapas 4-N: Administracoes programadas */
  scheduled_administrations: ScheduledAdministration[];

  /** Anomalias detectadas */
  anomalies: MedicationAnomaly[];

  /** Score de integridade do ciclo */
  integrity_score: number;

  /** Metadados */
  created_at: string;
  updated_at: string;
}

interface MedicationRequestPhase {
  fhir_id: string;
  event_id: string;
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'stopped';
  requested_by: string;
  requested_role: string;
  requested_at: string;
  dose: string;
  dose_unit: string;
  route: string;
  frequency: string;
  frequency_times: string[]; // ["06:00", "14:00", "22:00"]
  prn: boolean;
  prn_reason?: string;
  duration_days?: number;
  start_date: string;
  end_date?: string;
  clinical_indication: string;
  special_instructions?: string;
  max_dose_24h?: string;
  interactions_checked: boolean;
  allergy_checked: boolean;
}

interface PharmaceuticalReviewPhase {
  event_id: string;
  reviewed_by: string;
  reviewed_at: string;
  status: 'approved' | 'rejected' | 'modified' | 'pending';
  dose_appropriate: boolean;
  interactions_found: string[];
  allergy_conflict: boolean;
  allergy_details?: string;
  recommendations?: string;
  modification_description?: string;
  rejection_reason?: string;
}

interface DispensationPhase {
  event_id: string;
  dispensed_by: string;
  dispensed_at: string;
  quantity: number;
  unit: string;
  lot_number: string;
  expiration_date: string;
  manufacturer: string;
  storage_conditions?: string;
  dispensation_notes?: string;
}

interface ScheduledAdministration {
  /** ID desta administracao programada */
  schedule_id: string;

  /** Horario previsto */
  scheduled_at: string;

  /** Status atual */
  status: AdministrationStatus;

  /** Dados da preparacao (se aplicavel) */
  preparation?: {
    prepared_by: string;
    prepared_at: string;
    dilution?: string;
    final_volume?: string;
    preparation_notes?: string;
  };

  /** Dupla checagem */
  double_check?: {
    checked_by: string;
    checked_at: string;
    items_verified: string[];
    result: 'confirmed' | 'discrepancy_found';
    discrepancy_details?: string;
  };

  /** Administracao efetiva */
  administration?: {
    event_id: string;
    fhir_id: string;
    performed_by: string;
    performed_role: string;
    actual_time: string;
    delay_minutes: number;
    dose_given: string;
    dose_unit: string;
    route: string;
    site?: string;
    rate?: string; // Para infusoes
    duration?: string; // Para infusoes

    /** Verificacao dos 9 certos */
    nine_rights_check: {
      right_patient: boolean;
      right_medication: boolean;
      right_dose: boolean;
      right_route: boolean;
      right_time: boolean;
      right_documentation: boolean;
      right_reason: boolean;
      right_form: boolean;
      right_response: boolean;
    };

    /** Estado do paciente */
    patient_state_before: string;
    patient_state_after?: string;
    pain_before?: number;
    pain_after?: number;
    vital_signs_before?: {
      hr?: number;
      bp_systolic?: number;
      bp_diastolic?: number;
      rr?: number;
      temp?: number;
      spo2?: number;
    };
  };

  /** Recusa */
  refusal?: {
    event_id: string;
    refused_at: string;
    reason: string;
    patient_educated: boolean;
    physician_notified: boolean;
    physician_notified_at?: string;
    documented_by: string;
  };

  /** Suspensao */
  hold?: {
    event_id: string;
    held_at: string;
    held_by: string;
    reason: string;
    clinical_justification: string;
    physician_notified: boolean;
    resume_planned?: boolean;
    resume_at?: string;
  };

  /** Omissao (nao administrado sem justificativa registrada) */
  omission?: {
    detected_at: string;
    detection_method: 'rule_engine' | 'manual_review';
    gap_duration_minutes: number;
    notified_to?: string;
    resolution?: string;
    resolution_at?: string;
  };

  /** Substituicao */
  substitution?: {
    event_id: string;
    original_medication: string;
    substituted_medication: string;
    reason: string;
    authorized_by: string;
    authorized_at: string;
  };

  /** Evento adverso */
  adverse_event?: {
    event_id: string;
    detected_at: string;
    detected_by: string;
    severity: 'mild' | 'moderate' | 'severe' | 'life_threatening' | 'fatal';
    description: string;
    immediate_actions: string[];
    physician_notified: boolean;
    physician_notified_at?: string;
    outcome: string;
    causality_assessment: 'certain' | 'probable' | 'possible' | 'unlikely' | 'unassessable';
    reported_to_anvisa: boolean;
    fhir_adverse_event_id?: string;
  };

  /** Monitoramento pos-administracao */
  monitoring?: Array<{
    monitored_at: string;
    monitored_by: string;
    findings: string;
    pain_score?: number;
    vital_signs?: Record<string, number>;
    action_needed: boolean;
    action_taken?: string;
  }>;
}

type AdministrationStatus =
  | 'scheduled' // Ainda nao chegou o horario
  | 'due' // No horario, pendente
  | 'overdue' // Atrasado
  | 'given' // Administrado
  | 'given_late' // Administrado com atraso
  | 'refused' // Paciente recusou
  | 'held' // Suspenso pelo profissional
  | 'omitted' // Nao administrado sem justificativa
  | 'substituted' // Substituido por outro
  | 'cancelled' // Cancelado (prescricao alterada)
  | 'not_applicable'; // Nao aplicavel (ex: alta antes do horario)
```

### 3.2 Anomalias de Medicacao

```typescript
interface MedicationAnomaly {
  anomaly_id: string;
  lifecycle_id: string;
  patient_id: string;
  encounter_id: string;

  type: MedicationAnomalyType;
  severity: 'critical' | 'high' | 'medium' | 'low';

  detected_at: string;
  detected_by: 'rule_engine' | 'pharmacist' | 'nurse' | 'physician' | 'system';

  description: string;
  evidence: Array<{
    event_id: string;
    event_type: string;
    relevance: string;
  }>;

  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive';
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolution?: string;
  resolved_by?: string;
  resolved_at?: string;

  notification_sent: boolean;
  notification_targets?: string[];
}

type MedicationAnomalyType =
  | 'dose_outside_standard' // Dose fora do padrao para indicacao
  | 'relevant_delay' // Atraso > 30 min na administracao
  | 'critical_delay' // Atraso > 60 min em medicacao critica
  | 'administration_without_order' // Administracao sem prescricao valida
  | 'order_without_administration' // Prescricao sem administracao esperada
  | 'duplicate_administration' // Dose duplicada no mesmo periodo
  | 'suspicious_prn_frequency' // PRN com frequencia acima do esperado
  | 'drug_interaction' // Interacao medicamentosa detectada
  | 'allergy_conflict' // Conflito com alergia registrada
  | 'missing_performer' // Administracao sem executor identificado
  | 'divergent_performer' // Executor diferente do designado
  | 'missing_double_check' // Dupla checagem obrigatoria nao realizada
  | 'missing_monitoring' // Monitoramento pos-administracao ausente
  | 'late_documentation' // Registro > 1h apos administracao
  | 'dose_accumulation_risk' // Risco de acumulo de dose
  | 'renal_dose_adjustment_missing' // Dose nao ajustada para funcao renal
  | 'hepatic_dose_adjustment_missing' // Dose nao ajustada para funcao hepatica
  | 'weight_based_dose_mismatch' // Dose por kg inconsistente
  | 'route_mismatch' // Via diferente da prescrita
  | 'timing_pattern_anomaly' // Padrao de horarios irregular
  | 'lot_expired' // Lote com validade expirada
  | 'lot_recall' // Lote com recall ativo
  | 'substitution_unauthorized'; // Substituicao sem autorizacao
```

---

## 4. Regras de Auto-Deteccao

### 4.1 Motor de Regras

```typescript
interface MedicationRuleEngine {
  rules: MedicationDetectionRule[];
  evaluation_interval: '1m'; // Avaliacao a cada minuto
  lookback_window: '24h';
}

interface MedicationDetectionRule {
  rule_id: string;
  name: string;
  description: string;
  category: 'safety' | 'compliance' | 'quality' | 'efficiency';
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;

  /** Condicao de disparo */
  condition: RuleCondition;

  /** Acoes ao disparar */
  actions: RuleAction[];

  /** Excecoes/supressoes */
  suppressions?: RuleSuppression[];
}
```

### 4.2 Regras Detalhadas

```typescript
const MEDICATION_RULES: MedicationDetectionRule[] = [
  {
    rule_id: 'MED-001',
    name: 'Dose fora do padrao',
    description: 'Detecta dose prescrita fora da faixa terapeutica padrao para a indicacao',
    category: 'safety',
    severity: 'high',
    enabled: true,
    condition: {
      type: 'dose_range_check',
      params: {
        check_against: 'formulary_standard_doses',
        tolerance_percent: 20,
        consider_weight: true,
        consider_renal_function: true,
        consider_age: true,
      },
    },
    actions: [
      { type: 'create_anomaly', anomaly_type: 'dose_outside_standard' },
      { type: 'notify', targets: ['prescriber', 'pharmacist'] },
      { type: 'flag_in_timeline', relevance: 'high' },
    ],
  },

  {
    rule_id: 'MED-002',
    name: 'Atraso relevante na administracao',
    description: 'Medicamento nao administrado dentro de 30 minutos do horario previsto',
    category: 'compliance',
    severity: 'medium',
    enabled: true,
    condition: {
      type: 'time_threshold',
      params: {
        event_expected: 'medication_administration',
        reference_time: 'scheduled_time',
        threshold_minutes: 30,
        exclude_prn: true,
        exclude_status: ['held', 'refused', 'cancelled'],
      },
    },
    actions: [
      { type: 'create_anomaly', anomaly_type: 'relevant_delay' },
      { type: 'notify', targets: ['responsible_nurse'] },
      { type: 'update_indicator', indicator: 'medication_timeliness' },
    ],
  },

  {
    rule_id: 'MED-003',
    name: 'Atraso critico em medicacao critica',
    description:
      'Medicacao de alta criticidade (antibiotico, anticoagulante, vasoativo) com atraso > 60 min',
    category: 'safety',
    severity: 'critical',
    enabled: true,
    condition: {
      type: 'time_threshold',
      params: {
        event_expected: 'medication_administration',
        reference_time: 'scheduled_time',
        threshold_minutes: 60,
        medication_categories: [
          'antibiotic',
          'anticoagulant',
          'vasoactive',
          'insulin',
          'antiarrhythmic',
        ],
        exclude_prn: true,
      },
    },
    actions: [
      { type: 'create_anomaly', anomaly_type: 'critical_delay' },
      { type: 'notify', targets: ['responsible_nurse', 'charge_nurse', 'prescriber'] },
      { type: 'escalate', timeout_minutes: 15 },
      { type: 'flag_in_timeline', relevance: 'critical' },
    ],
  },

  {
    rule_id: 'MED-004',
    name: 'Administracao sem prescricao valida',
    description: 'Registro de administracao de medicamento sem prescricao ativa correspondente',
    category: 'safety',
    severity: 'critical',
    enabled: true,
    condition: {
      type: 'missing_reference',
      params: {
        event: 'medication_administration',
        required_reference: 'medication_request',
        reference_status: ['active', 'on-hold'],
      },
    },
    actions: [
      { type: 'create_anomaly', anomaly_type: 'administration_without_order' },
      { type: 'notify', targets: ['charge_nurse', 'pharmacist', 'prescriber'] },
      { type: 'flag_in_timeline', relevance: 'critical' },
      { type: 'require_justification', timeout_minutes: 30 },
    ],
  },

  {
    rule_id: 'MED-005',
    name: 'Prescricao sem administracao',
    description:
      'Prescricao ativa com horario previsto que passou sem registro de administracao, recusa ou justificativa',
    category: 'compliance',
    severity: 'high',
    enabled: true,
    condition: {
      type: 'missing_event',
      params: {
        reference: 'medication_request.active',
        expected_event: 'medication_administration',
        time_window: 'scheduled_time + 60min',
        exclude_if: ['refused', 'held', 'cancelled', 'not_applicable'],
      },
    },
    actions: [
      { type: 'create_anomaly', anomaly_type: 'order_without_administration' },
      { type: 'notify', targets: ['responsible_nurse'] },
      { type: 'update_indicator', indicator: 'medication_completeness' },
    ],
  },

  {
    rule_id: 'MED-006',
    name: 'Administracao duplicada',
    description: 'Mesmo medicamento administrado mais de uma vez no mesmo intervalo de dosagem',
    category: 'safety',
    severity: 'critical',
    enabled: true,
    condition: {
      type: 'duplicate_detection',
      params: {
        event: 'medication_administration.given',
        match_fields: ['medication_code', 'patient_id'],
        time_window_minutes: 'dosing_interval * 0.5',
        exclude_prn: false,
      },
    },
    actions: [
      { type: 'create_anomaly', anomaly_type: 'duplicate_administration' },
      {
        type: 'notify',
        targets: ['responsible_nurse', 'charge_nurse', 'prescriber', 'pharmacist'],
      },
      { type: 'flag_in_timeline', relevance: 'critical' },
      { type: 'auto_create_task', task: 'verify_double_dose' },
    ],
  },

  {
    rule_id: 'MED-007',
    name: 'Frequencia PRN suspeita',
    description: 'Medicamento PRN sendo usado com frequencia acima do padrao esperado',
    category: 'quality',
    severity: 'medium',
    enabled: true,
    condition: {
      type: 'frequency_analysis',
      params: {
        event: 'medication_administration.given',
        filter: 'prn == true',
        threshold: 'max_daily_prn_doses OR 4_in_24h',
        lookback: '48h',
      },
    },
    actions: [
      { type: 'create_anomaly', anomaly_type: 'suspicious_prn_frequency' },
      { type: 'notify', targets: ['prescriber'] },
      {
        type: 'suggest',
        message: 'Considerar conversao para dose fixa ou revisao do plano analgesico',
      },
    ],
  },

  {
    rule_id: 'MED-008',
    name: 'Dupla checagem obrigatoria ausente',
    description: 'Medicamento de alta vigilancia administrado sem dupla checagem',
    category: 'safety',
    severity: 'critical',
    enabled: true,
    condition: {
      type: 'missing_step',
      params: {
        event: 'medication_administration.given',
        required_step: 'double_check',
        medication_categories: [
          'high_alert',
          'insulin',
          'heparin',
          'chemotherapy',
          'opioid',
          'neuromuscular_blocker',
          'potassium_concentrate',
          'blood_products',
          'vasoactive',
        ],
      },
    },
    actions: [
      { type: 'create_anomaly', anomaly_type: 'missing_double_check' },
      { type: 'notify', targets: ['responsible_nurse', 'charge_nurse'] },
      { type: 'flag_in_timeline', relevance: 'critical' },
    ],
  },

  {
    rule_id: 'MED-009',
    name: 'Executor divergente',
    description:
      'Medicamento administrado por profissional diferente do designado, sem justificativa',
    category: 'compliance',
    severity: 'medium',
    enabled: true,
    condition: {
      type: 'field_mismatch',
      params: {
        event: 'medication_administration',
        field: 'performer',
        expected_from: 'current_responsible_nurse',
        allow_same_role: true,
        require_justification: true,
      },
    },
    actions: [
      { type: 'create_anomaly', anomaly_type: 'divergent_performer' },
      { type: 'flag_in_timeline', relevance: 'standard' },
    ],
  },

  {
    rule_id: 'MED-010',
    name: 'Interacao medicamentosa',
    description: 'Prescricao ou administracao concomitante de medicamentos com interacao conhecida',
    category: 'safety',
    severity: 'high',
    enabled: true,
    condition: {
      type: 'interaction_check',
      params: {
        check_active_prescriptions: true,
        check_recent_administrations: true,
        database: 'velya_drug_interaction_db',
        severity_threshold: 'moderate',
      },
    },
    actions: [
      { type: 'create_anomaly', anomaly_type: 'drug_interaction' },
      { type: 'notify', targets: ['prescriber', 'pharmacist'] },
      { type: 'flag_in_timeline', relevance: 'high' },
    ],
  },

  {
    rule_id: 'MED-011',
    name: 'Lote expirado',
    description: 'Medicamento administrado com lote cuja validade ja expirou',
    category: 'safety',
    severity: 'critical',
    enabled: true,
    condition: {
      type: 'date_comparison',
      params: {
        event: 'medication_administration.given',
        field: 'expiration_date',
        compare: 'less_than',
        reference: 'administration_date',
      },
    },
    actions: [
      { type: 'create_anomaly', anomaly_type: 'lot_expired' },
      { type: 'notify', targets: ['pharmacist', 'charge_nurse', 'quality_manager'] },
      { type: 'flag_in_timeline', relevance: 'critical' },
      { type: 'auto_create_task', task: 'investigate_expired_lot' },
    ],
  },

  {
    rule_id: 'MED-012',
    name: 'Documentacao tardia',
    description: 'Registro de administracao feito mais de 60 minutos apos o horario informado',
    category: 'quality',
    severity: 'low',
    enabled: true,
    condition: {
      type: 'time_difference',
      params: {
        field_a: 'occurred_at',
        field_b: 'recorded_at',
        threshold_minutes: 60,
      },
    },
    actions: [
      { type: 'create_anomaly', anomaly_type: 'late_documentation' },
      { type: 'flag_in_timeline', relevance: 'low' },
      { type: 'add_tag', tag: 'late_documentation' },
    ],
  },
];
```

---

## 5. Arvore de Decisao para Anomalias

### 5.1 Fluxo de Atraso de Medicacao

```
  Horario previsto da administracao
              |
              v
  Administrado no horario? --SIM--> [OK] Registra normalmente
              |
             NAO
              |
              v
  Status registrado? --SIM--> Qual status?
              |                    |
             NAO                   +-- refused --> [OK] Notifica medico
              |                    +-- held --> [OK] Verifica justificativa
              v                    +-- cancelled --> [OK]
  +15 min --> Alerta silencioso    +-- substituted --> [OK]
              |
              v
  +30 min --> Alerta para enfermeiro responsavel
              |                     Medicacao critica?
              v                           |
  +45 min --> Alerta para enfermeiro      +--SIM--> Escala para
              chefe                       |         coordenacao
              |                          NAO
              v                           |
  +60 min --> Anomalia registrada         v
              Notifica prescriber    Mantém alerta ativo
              |
              v
  +120 min -> Escalacao para
              coordenacao medica
```

### 5.2 Fluxo de Verificacao de Seguranca

```
  Nova MedicationAdministration recebida
              |
              v
  Prescricao valida e ativa? --NAO--> [CRITICO] administration_without_order
              |
             SIM
              |
              v
  Dose dentro da faixa? --NAO--> [ALTO] dose_outside_standard
              |
             SIM
              |
              v
  Via correta? --NAO--> [ALTO] route_mismatch
              |
             SIM
              |
              v
  Conflito com alergia? --SIM--> [CRITICO] allergy_conflict
              |
             NAO
              |
              v
  Interacao com outros medicamentos? --SIM--> [ALTO] drug_interaction
              |
             NAO
              |
              v
  Duplicata no periodo? --SIM--> [CRITICO] duplicate_administration
              |
             NAO
              |
              v
  Medicamento de alta vigilancia?
              |
             SIM --> Dupla checagem realizada? --NAO--> [CRITICO] missing_double_check
              |                |
             NAO              SIM
              |                |
              v                v
  Lote valido? --NAO--> [CRITICO] lot_expired
              |
             SIM
              |
              v
  Atraso > 30 min? --SIM--> [MEDIO] relevant_delay
              |
             NAO
              |
              v
  [OK] Administracao registrada com sucesso
```

---

## 6. Exemplos FHIR Complementares

### 6.1 MedicationAdministration - Recusa

```json
{
  "resourceType": "MedicationAdministration",
  "id": "med-admin-refused-001",
  "status": "not-done",
  "statusReason": [
    {
      "coding": [
        {
          "system": "http://velya.health/fhir/CodeSystem/not-done-reason",
          "code": "patient-refused",
          "display": "Paciente recusou"
        }
      ],
      "text": "Paciente recusou medicacao referindo nausea intensa. Medico notificado as 15:10."
    }
  ],
  "medicationCodeableConcept": {
    "coding": [
      {
        "system": "http://www.whocc.no/atc",
        "code": "J01CA04",
        "display": "Amoxicilina"
      }
    ],
    "text": "Amoxicilina 500mg"
  },
  "subject": {
    "reference": "Patient/patient-001"
  },
  "context": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "effectiveDateTime": "2026-04-08T14:00:00-03:00",
  "performer": [
    {
      "actor": {
        "reference": "Practitioner/enf-ana-paula"
      }
    }
  ],
  "request": {
    "reference": "MedicationRequest/med-request-001"
  },
  "note": [
    {
      "authorReference": {
        "reference": "Practitioner/enf-ana-paula"
      },
      "time": "2026-04-08T14:05:00-03:00",
      "text": "Paciente orientada sobre importancia da medicacao. Mantém recusa. Dr. Mendes ciente, orientou aguardar e tentar novamente em 2h."
    }
  ],
  "extension": [
    {
      "url": "http://velya.health/fhir/StructureDefinition/physician-notified",
      "valueBoolean": true
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/physician-notified-at",
      "valueDateTime": "2026-04-08T14:10:00-03:00"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/patient-educated",
      "valueBoolean": true
    }
  ]
}
```

### 6.2 MedicationAdministration - Evento Adverso

```json
{
  "resourceType": "MedicationAdministration",
  "id": "med-admin-adverse-001",
  "status": "completed",
  "medicationCodeableConcept": {
    "text": "Dipirona 1g IV"
  },
  "subject": {
    "reference": "Patient/patient-001"
  },
  "context": {
    "reference": "Encounter/encounter-2026-0408-001"
  },
  "effectiveDateTime": "2026-04-07T22:10:00-03:00",
  "performer": [
    {
      "actor": {
        "reference": "Practitioner/enf-carlos-noite"
      }
    }
  ],
  "request": {
    "reference": "MedicationRequest/med-request-dipirona-001"
  },
  "note": [
    {
      "text": "Apos administracao, paciente apresentou rash cutaneo em membros superiores. Medicacao suspensa. Medico plantonista acionado."
    }
  ],
  "extension": [
    {
      "url": "http://velya.health/fhir/StructureDefinition/adverse-event-detected",
      "valueBoolean": true
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/adverse-event-severity",
      "valueCode": "moderate"
    },
    {
      "url": "http://velya.health/fhir/StructureDefinition/adverse-event-reference",
      "valueReference": {
        "reference": "AdverseEvent/ae-dipirona-001"
      }
    }
  ]
}
```

---

## 7. Score de Integridade da Medicacao

```typescript
/**
 * Calcula o score de integridade do ciclo de vida de uma prescricao.
 * Score de 0-100 onde 100 = ciclo perfeito.
 */
function calculateMedicationIntegrityScore(lifecycle: MedicationLifecycle): number {
  let score = 100;
  const weights = {
    missing_review: -10, // Sem revisao farmaceutica
    missing_dispensation: -5, // Sem registro de dispensacao
    administration_delay: -3, // Por cada atraso > 30 min
    critical_delay: -10, // Por cada atraso > 60 min (critico)
    missing_administration: -15, // Dose omitida sem justificativa
    missing_double_check: -20, // Dupla checagem ausente (alta vigilancia)
    duplicate: -25, // Dose duplicada
    without_order: -30, // Sem prescricao valida
    adverse_event: -15, // Evento adverso
    late_documentation: -2, // Documentacao tardia
    missing_monitoring: -5, // Monitoramento ausente
    lot_expired: -25, // Lote expirado
    interaction_ignored: -15, // Interacao medicamentosa ignorada
    refusal_no_notification: -10, // Recusa sem notificacao medica
  };

  // Verificar revisao farmaceutica
  if (!lifecycle.pharmaceutical_review) {
    score += weights.missing_review;
  }

  // Verificar dispensacao
  if (!lifecycle.dispensation) {
    score += weights.missing_dispensation;
  }

  // Verificar cada administracao programada
  for (const admin of lifecycle.scheduled_administrations) {
    if (admin.status === 'omitted') {
      score += weights.missing_administration;
    }

    if (admin.administration) {
      if (admin.administration.delay_minutes > 60) {
        score += weights.critical_delay;
      } else if (admin.administration.delay_minutes > 30) {
        score += weights.administration_delay;
      }
    }

    if (admin.adverse_event) {
      score += weights.adverse_event;
    }
  }

  // Verificar anomalias
  for (const anomaly of lifecycle.anomalies) {
    switch (anomaly.type) {
      case 'duplicate_administration':
        score += weights.duplicate;
        break;
      case 'administration_without_order':
        score += weights.without_order;
        break;
      case 'missing_double_check':
        score += weights.missing_double_check;
        break;
      case 'lot_expired':
        score += weights.lot_expired;
        break;
      case 'late_documentation':
        score += weights.late_documentation;
        break;
    }
  }

  return Math.max(0, Math.min(100, score));
}
```

---

## 8. Dashboard de Integridade de Medicacao

### 8.1 Metricas Prometheus

```promql
# Taxa de administracoes no horario
sum(rate(medication_administration_on_time_total[1h]))
  / sum(rate(medication_administration_total[1h])) * 100

# Atraso medio de administracao (minutos)
avg(medication_administration_delay_minutes)

# Anomalias abertas por tipo
medication_anomalies_open{severity="critical"}

# Doses omitidas nas ultimas 24h
increase(medication_omission_total[24h])

# Taxa de dupla checagem em alta vigilancia
sum(rate(medication_double_check_performed_total[24h]))
  / sum(rate(medication_high_alert_administered_total[24h])) * 100

# PRN frequency por medicamento
topk(10, sum by (medication_name) (
  increase(medication_prn_administration_total[24h])
))
```

### 8.2 Painel de Resumo

```
+------------------------------------------------------------------+
|  MEDICATION INTEGRITY BOARD                                       |
|                                                                   |
|  Score Geral: [=========-] 87%                                    |
|                                                                   |
|  +------------------+  +------------------+  +------------------+ |
|  | Administradas    |  | No Horario       |  | Dupla Checagem   | |
|  | 142 / 156 (91%)  |  | 128 / 142 (90%)  |  | 34 / 38 (89%)   | |
|  +------------------+  +------------------+  +------------------+ |
|                                                                   |
|  +------------------+  +------------------+  +------------------+ |
|  | Omissoes         |  | Recusas          |  | Eventos Adversos | |
|  | 3 (!!)           |  | 5                |  | 1                | |
|  +------------------+  +------------------+  +------------------+ |
|                                                                   |
|  Anomalias Abertas:                                               |
|  [CRITICO] 1 - Dupla checagem ausente (Heparina, 412A)           |
|  [ALTO]    2 - Atraso > 60 min (Antibiotico x2)                  |
|  [MEDIO]   3 - Frequencia PRN elevada (Dipirona, 3 pacientes)    |
+------------------------------------------------------------------+
```

---

## 9. Observabilidade Especifica

### 9.1 Logs Estruturados

```json
{
  "level": "warn",
  "msg": "Medication anomaly detected",
  "anomaly_type": "relevant_delay",
  "patient_id": "patient-001",
  "medication": "Amoxicilina 500mg",
  "scheduled_time": "2026-04-08T14:00:00-03:00",
  "delay_minutes": 35,
  "responsible_nurse": "enf-ana-paula",
  "ward": "Clinica Medica",
  "rule_id": "MED-002",
  "trace_id": "abc123"
}
```

### 9.2 Alertas

| Alerta                  | Condicao                            | Canal        | Destinatarios                   |
| ----------------------- | ----------------------------------- | ------------ | ------------------------------- |
| `MedCriticalDelay`      | Atraso > 60 min em med critica      | Push + SMS   | Enfermeiro, Chefe, Medico       |
| `MedDuplicate`          | Dose duplicada detectada            | Push + SMS   | Enfermeiro, Farmaceutico        |
| `MedNoOrder`            | Administracao sem prescricao        | Push         | Enfermeiro Chefe, Farmaceutico  |
| `MedOmission`           | Dose omitida > 2h sem justificativa | Push         | Enfermeiro                      |
| `MedDoubleCheckMissing` | Alta vigilancia sem dupla checagem  | Push         | Enfermeiro, Chefe               |
| `MedAdverseEvent`       | Evento adverso registrado           | Push + Email | Medico, Farmaceutico, Qualidade |
| `MedLotExpired`         | Lote expirado detectado             | Push + Email | Farmaceutico, Qualidade         |

---

## Referencias

- [FHIR R4 MedicationRequest](https://www.hl7.org/fhir/medicationrequest.html)
- [FHIR R4 MedicationAdministration](https://www.hl7.org/fhir/medicationadministration.html)
- [FHIR R4 MedicationDispense](https://www.hl7.org/fhir/medicationdispense.html)
- [ISMP High-Alert Medications](https://www.ismp.org/recommendations/high-alert-medications-acute-list)
- [ANVISA - Protocolo de Seguranca na Prescricao](https://www.gov.br/anvisa/pt-br)
- [WHO - Medication Without Harm](https://www.who.int/initiatives/medication-without-harm)
