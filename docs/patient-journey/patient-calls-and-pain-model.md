# Patient Calls and Pain Model - Modelo de Chamados e Dor

> Velya Platform - Documentacao Tecnica
> Ultima atualizacao: 2026-04-08
> Status: Especificacao Ativa

---

## 1. Visao Geral

O modelo de chamados e dor rastreia de forma integrada todas as solicitacoes
do paciente e a evolucao da dor durante a internacao. O objetivo e garantir que
nenhum chamado fique sem resposta e que nenhuma dor fique sem avaliacao e intervencao.

### Principio

> **Cada chamado do paciente e uma necessidade expressa. Cada necessidade merece
> resposta rastreavel, tempo mensuravel e resolucao documentada.**

```
+------------------------------------------------------------------+
|  FLUXO DE CHAMADO DO PACIENTE                                    |
|                                                                   |
|  PACIENTE        SISTEMA           EQUIPE          RESOLUCAO      |
|     |               |                |                |           |
|     |-- Aciona ---->|                |                |           |
|     |  (botao,      |-- Notifica --->|                |           |
|     |   tablet,     |  (push, painel)|                |           |
|     |   voz, app)   |                |-- Responde     |           |
|     |               |                |   (contato)    |           |
|     |               |<-- Registra ---|                |           |
|     |               |   resposta     |                |           |
|     |               |                |-- Resolve ---->|           |
|     |               |<-- Registra ---|   (acao)       |           |
|     |               |   resolucao    |                |           |
|     |               |                |                |           |
|     |               |-- Métricas --->|                |           |
|     |               |  (t.resposta,  |                |           |
|     |               |   t.resolucao) |                |           |
+------------------------------------------------------------------+
```

---

## 2. Fontes de Chamado

### 2.1 Tipos de Fonte

| Fonte | Codigo | Descricao | Prioridade Default |
|---|---|---|---|
| Botao de leito | `bed_button` | Botao fisico no leito do paciente | routine |
| Tablet do leito | `tablet` | Tablet fixo no leito com app de chamado | routine |
| App do paciente | `app` | Aplicativo mobile do paciente | routine |
| Chamado por voz | `voice` | Paciente chama verbalmente (detectado por staff) | routine |
| Acompanhante | `companion` | Acompanhante aciona em nome do paciente | routine |
| Staff proativo | `staff` | Profissional identifica necessidade nao verbalizada | routine |
| Alarme de dispositivo | `device_alarm` | Monitor ou equipamento aciona por parametro | urgent |
| Alarme de deterioracao | `deterioration_alert` | Sistema detecta risco de deterioracao | emergency |

### 2.2 Categorias de Chamado

```typescript
type CallCategory =
  | 'pain'                // Dor - qualquer queixa de dor
  | 'physical_help'       // Auxilio fisico - levantar, sentar, caminhar
  | 'hygiene'             // Higiene - banho, troca, fralda
  | 'positioning'         // Posicionamento - mudar de posicao, decubito
  | 'water_food'          // Agua/alimento - sede, fome, dieta
  | 'discomfort'          // Desconforto - calor, frio, barulho, luz
  | 'missing_medication'  // Medicacao ausente - paciente questiona atraso
  | 'equipment'           // Equipamento - soro acabando, alarme, bomba
  | 'anxiety_fear'        // Ansiedade/medo - necessidade emocional
  | 'urgent_need'         // Necessidade urgente - mal estar subito
  | 'information'         // Informacao - duvida, visita medica, resultado
  | 'bathroom'            // Banheiro - auxilio para ir ao banheiro
  | 'nausea_vomiting'     // Nausea/vomito - queixa gastrointestinal
  | 'respiratory'         // Respiratorio - dispneia, falta de ar
  | 'fall_risk'           // Queda - paciente tentando levantar sozinho
  | 'visitor'             // Visitante - solicitacao sobre visitas
  | 'discharge'           // Alta - duvidas sobre alta
  | 'other';              // Outros
```

---

## 3. Schema de Evento de Chamado

### 3.1 Evento de Chamado Completo

```typescript
interface PatientCallRecord {
  /** Identificador unico do chamado */
  call_id: string;

  /** Referencia ao paciente */
  patient_id: string;
  encounter_id: string;

  /** Localizacao */
  location: {
    ward: string;
    room: string;
    bed: string;
  };

  /** Fonte e categoria */
  source: CallSource;
  category: CallCategory;
  subcategory?: string;
  urgency: 'routine' | 'urgent' | 'emergency';

  /** Descricao */
  description?: string;
  patient_verbalization?: string; // O que o paciente disse exatamente

  /** Dados de dor (se categoria = pain) */
  pain_data?: {
    intensity: number;           // 0-10
    scale_used: PainScale;
    location: string;
    character: string;           // pontada, queimacao, pressao, etc.
    onset: 'sudden' | 'gradual' | 'chronic' | 'worsening';
    duration: string;
    aggravating_factors: string[];
    relieving_factors: string[];
    last_medication_for_pain?: {
      medication: string;
      given_at: string;
      effect: 'no_relief' | 'partial_relief' | 'full_relief';
    };
  };

  /** Ciclo de vida do chamado */
  lifecycle: {
    /** Momento em que o chamado foi criado */
    created_at: string;
    created_by: string; // patient, companion, staff, system

    /** Momento do primeiro contato (profissional chegou ao paciente) */
    first_contact_at?: string;
    first_contact_by?: string;
    first_contact_role?: string;
    time_to_first_contact_seconds?: number;

    /** Momento da resolucao */
    resolved_at?: string;
    resolved_by?: string;
    resolved_role?: string;
    time_to_resolution_seconds?: number;
    resolution_description?: string;
    resolution_type?: CallResolutionType;

    /** Redirecionamento */
    redirected?: boolean;
    redirected_to?: string;
    redirected_reason?: string;
    redirected_at?: string;

    /** Abandono */
    abandoned?: boolean;
    abandoned_reason?: 'timeout' | 'patient_cancelled' | 'system_error';
    abandoned_at?: string;

    /** Reabertura */
    reopened: boolean;
    reopen_count: number;
    reopen_history?: Array<{
      reopened_at: string;
      reopened_reason: string;
      resolved_again_at?: string;
    }>;

    /** Escalacao */
    escalated?: boolean;
    escalated_to?: string;
    escalated_at?: string;
    escalation_reason?: string;
  };

  /** Status atual */
  status: CallStatus;

  /** Acao clinica vinculada (se gerou acao) */
  linked_clinical_actions?: Array<{
    action_type: string;       // medication_given, assessment, procedure, etc.
    event_id: string;
    description: string;
    performed_at: string;
    performed_by: string;
  }>;

  /** Satisfacao do paciente (se coletada) */
  patient_feedback?: {
    collected_at: string;
    satisfaction: 1 | 2 | 3 | 4 | 5;
    comment?: string;
  };

  /** Metadados */
  metadata: {
    shift: 'morning' | 'afternoon' | 'night';
    is_repeated: boolean;
    times_called_in_24h: number;
    previous_call_id?: string;
    journey_event_id: string;
  };
}

type CallSource = 'bed_button' | 'tablet' | 'app' | 'voice'
               | 'companion' | 'staff' | 'device_alarm' | 'deterioration_alert';

type CallStatus = 'pending' | 'acknowledged' | 'responding' | 'resolved'
               | 'abandoned' | 'redirected' | 'escalated' | 'cancelled';

type CallResolutionType =
  | 'immediate_action'        // Acao imediata no leito
  | 'medication_given'        // Medicacao administrada
  | 'assessment_performed'    // Avaliacao realizada
  | 'comfort_measure'         // Medida de conforto
  | 'patient_education'       // Orientacao ao paciente
  | 'physician_notified'      // Medico notificado (pendencia transferida)
  | 'scheduled_for_later'     // Agendado para horario posterior
  | 'equipment_adjusted'      // Equipamento ajustado
  | 'no_action_needed'        // Verificado, sem acao necessaria
  | 'patient_self_resolved';  // Paciente resolveu sozinho

type PainScale = 'NRS' | 'VAS' | 'Wong-Baker' | 'BPS' | 'CPOT' | 'FLACC' | 'NIPS';
```

---

## 4. Modelo de Dor

### 4.1 Evolucao da Dor

```typescript
interface PainEvolution {
  patient_id: string;
  encounter_id: string;

  /** Historico completo de avaliacoes de dor */
  assessments: PainAssessment[];

  /** Intervencoes para dor */
  interventions: PainIntervention[];

  /** Estado atual da dor */
  current_state: {
    score: number | null;
    location: string | null;
    trend: 'improving' | 'stable' | 'worsening' | 'new' | 'resolved' | 'unknown';
    last_assessed_at: string | null;
    reassessment_overdue: boolean;
    reassessment_due_at: string | null;
    hours_since_last_assessment: number | null;
  };

  /** Estatisticas */
  statistics: {
    avg_pain_24h: number;
    max_pain_24h: number;
    min_pain_24h: number;
    assessments_count_24h: number;
    interventions_count_24h: number;
    avg_time_to_intervention_minutes: number;
    pain_free_hours_24h: number;
    episodes_above_7: number; // Episodios de dor >= 7 em 24h
  };
}

interface PainAssessment {
  assessment_id: string;
  event_id: string;
  assessed_at: string;
  assessed_by: string;
  assessed_role: string;

  /** Dados da avaliacao */
  scale: PainScale;
  score: number;
  max_score: number;
  location: string;
  character: string;
  radiation?: string;
  duration: string;
  onset_type: 'sudden' | 'gradual' | 'chronic';

  /** Fatores */
  aggravating_factors: string[];
  relieving_factors: string[];

  /** Contexto */
  context: 'rest' | 'movement' | 'procedure' | 'post_medication' | 'spontaneous';

  /** Vinculo com intervencao */
  triggered_intervention: boolean;
  intervention_id?: string;

  /** Vinculo com chamado */
  triggered_by_call: boolean;
  call_id?: string;

  /** Reavaliacao */
  is_reassessment: boolean;
  reassessment_of?: string; // ID da avaliacao anterior
  reassessment_after_intervention: boolean;

  /** FHIR */
  fhir_observation_id: string;
}

interface PainIntervention {
  intervention_id: string;
  event_id: string;
  performed_at: string;
  performed_by: string;
  performed_role: string;

  /** Tipo de intervencao */
  type: PainInterventionType;

  /** Detalhes */
  description: string;

  /** Se farmacologica */
  medication?: {
    name: string;
    dose: string;
    route: string;
    medication_administration_id: string;
  };

  /** Se nao farmacologica */
  non_pharmacological?: {
    technique: string; // massagem, posicionamento, relaxamento, crioterapia, etc.
    duration_minutes: number;
  };

  /** Eficacia */
  pain_before: number;
  pain_after?: number;
  pain_after_assessed_at?: string;
  effect: 'no_relief' | 'partial_relief' | 'full_relief' | 'worsened' | 'not_assessed';

  /** Reavaliacao planejada */
  reassessment_due_at: string;
  reassessment_performed: boolean;
  reassessment_id?: string;
}

type PainInterventionType =
  | 'pharmacological'          // Medicacao analgesica
  | 'non_pharmacological'      // Tecnicas nao farmacologicas
  | 'positioning'              // Mudanca de posicao
  | 'combined'                 // Farmacologica + nao farmacologica
  | 'physician_consultation'   // Consulta medica para revisao
  | 'specialist_referral';     // Encaminhamento para especialista da dor
```

### 4.2 Regras de Dor

```typescript
const PAIN_RULES = [
  {
    rule_id: 'PAIN-001',
    name: 'Dor alta sem intervencao',
    description: 'Avaliacao de dor >= 7 sem intervencao registrada em 30 minutos',
    condition: {
      pain_score: { gte: 7 },
      no_intervention_within_minutes: 30,
    },
    severity: 'critical',
    actions: [
      'notify_responsible_nurse',
      'notify_prescriber',
      'create_gap_event',
    ],
  },
  {
    rule_id: 'PAIN-002',
    name: 'Reavaliacao de dor em atraso',
    description: 'Intervencao para dor realizada sem reavaliacao no tempo previsto',
    condition: {
      intervention_performed: true,
      reassessment_overdue: true,
      reassessment_window_minutes: 60, // Padrao: 1h apos intervencao
    },
    severity: 'high',
    actions: [
      'notify_responsible_nurse',
      'create_gap_event',
    ],
  },
  {
    rule_id: 'PAIN-003',
    name: 'Dor persistente sem revisao medica',
    description: 'Dor >= 5 em 3 avaliacoes consecutivas sem revisao medica do plano',
    condition: {
      consecutive_assessments_above: { score: 5, count: 3 },
      no_physician_review_since_first: true,
    },
    severity: 'high',
    actions: [
      'notify_prescriber',
      'suggest_plan_review',
    ],
  },
  {
    rule_id: 'PAIN-004',
    name: 'Chamado de dor recorrente sem resolucao',
    description: 'Paciente chamou por dor 3+ vezes em 8h sem melhora documentada',
    condition: {
      calls_category: 'pain',
      calls_count_in_hours: { count: 3, hours: 8 },
      no_improvement_documented: true,
    },
    severity: 'high',
    actions: [
      'notify_prescriber',
      'notify_charge_nurse',
      'create_pain_management_alert',
    ],
  },
  {
    rule_id: 'PAIN-005',
    name: 'Avaliacao de dor nao realizada no turno',
    description: 'Paciente sem avaliacao de dor registrada durante o turno inteiro',
    condition: {
      no_pain_assessment_in_shift: true,
      patient_conscious: true,
    },
    severity: 'medium',
    actions: [
      'notify_responsible_nurse',
      'create_gap_event',
    ],
  },
  {
    rule_id: 'PAIN-006',
    name: 'PRN analgesico frequente sem plano',
    description: 'Analgesico PRN usado > 4x em 24h sem revisao do plano analgesico',
    condition: {
      prn_analgesic_count_24h: { gte: 4 },
      no_pain_plan_review: true,
    },
    severity: 'medium',
    actions: [
      'notify_prescriber',
      'suggest_scheduled_analgesic',
    ],
  },
];
```

---

## 5. Regras de Chamado

### 5.1 Regras de Deteccao

```typescript
const CALL_RULES = [
  {
    rule_id: 'CALL-001',
    name: 'Chamado sem resposta',
    description: 'Chamado aberto ha mais de 5 minutos sem primeiro contato',
    condition: {
      status: 'pending',
      elapsed_minutes: { gte: 5 },
    },
    severity: 'high',
    actions: [
      'escalate_to_charge_nurse',
      'alert_dashboard',
    ],
  },
  {
    rule_id: 'CALL-002',
    name: 'Chamado urgente sem resposta',
    description: 'Chamado urgente aberto ha mais de 2 minutos',
    condition: {
      status: 'pending',
      urgency: 'urgent',
      elapsed_minutes: { gte: 2 },
    },
    severity: 'critical',
    actions: [
      'escalate_to_charge_nurse',
      'escalate_to_coordinator',
      'alert_dashboard',
      'send_sms',
    ],
  },
  {
    rule_id: 'CALL-003',
    name: 'Chamado respondido sem acao registrada',
    description: 'Chamado marcado como respondido mas sem acao clinica ou resolucao',
    condition: {
      status: 'responding',
      elapsed_since_response_minutes: { gte: 15 },
      no_linked_action: true,
      no_resolution: true,
    },
    severity: 'medium',
    actions: [
      'remind_documentation',
      'flag_in_timeline',
    ],
  },
  {
    rule_id: 'CALL-004',
    name: 'Paciente chamando repetidamente',
    description: 'Mesmo paciente chamou 3+ vezes em 2 horas',
    condition: {
      calls_in_window: { count: 3, hours: 2 },
      same_patient: true,
    },
    severity: 'high',
    actions: [
      'notify_charge_nurse',
      'flag_as_recurring',
      'suggest_proactive_visit',
    ],
  },
  {
    rule_id: 'CALL-005',
    name: 'Chamado por medicacao ausente',
    description: 'Paciente chamou questionando medicacao em atraso',
    condition: {
      category: 'missing_medication',
    },
    severity: 'high',
    actions: [
      'cross_reference_medication_schedule',
      'notify_responsible_nurse',
      'flag_medication_timeline',
    ],
  },
  {
    rule_id: 'CALL-006',
    name: 'Chamado abandonado',
    description: 'Chamado encerrado por timeout sem resposta',
    condition: {
      status: 'abandoned',
    },
    severity: 'critical',
    actions: [
      'create_incident',
      'notify_charge_nurse',
      'notify_quality',
      'auto_create_proactive_visit',
    ],
  },
  {
    rule_id: 'CALL-007',
    name: 'Gap entre chamado e acao clinica',
    description: 'Chamado de dor atendido mas sem acao clinica correspondente em 30 min',
    condition: {
      category: 'pain',
      status: 'resolved',
      resolution_type: 'immediate_action',
      no_clinical_event_within_minutes: 30,
    },
    severity: 'medium',
    actions: [
      'flag_documentation_gap',
      'create_gap_event',
    ],
  },
];
```

---

## 6. Visoes e Dashboards

### 6.1 Dashboard de Chamados por Unidade

```
+------------------------------------------------------------------+
|  PAIN & CALLS BOARD - Clinica Medica                             |
|  Periodo: Hoje (08/04/2026) | Turno: Tarde                      |
+------------------------------------------------------------------+
|                                                                   |
|  RESUMO DO TURNO                                                  |
|  +------------------+  +------------------+  +------------------+ |
|  | Chamados Total   |  | Tempo Medio Resp |  | Abandonados      | |
|  |       18         |  |     4.2 min      |  |       0          | |
|  +------------------+  +------------------+  +------------------+ |
|                                                                   |
|  CHAMADOS POR CATEGORIA                                           |
|  Dor:            ████████ 6 (33%)                                |
|  Posicionamento: █████ 4 (22%)                                   |
|  Agua/Alimento:  ████ 3 (17%)                                   |
|  Higiene:        ███ 2 (11%)                                    |
|  Medicacao:      ██ 1 (6%)                                      |
|  Outros:         ██ 2 (11%)                                     |
|                                                                   |
|  TEMPO DE RESPOSTA POR HORA                                       |
|  12:00  ██ 2.1 min                                               |
|  13:00  ████ 4.5 min                                             |
|  14:00  ███ 3.2 min                                              |
|  15:00  █████ 5.8 min                                            |
|  16:00  ████ 4.0 min                                             |
|  17:00  ██████ 6.1 min  [!] Acima do alvo                       |
|                                                                   |
|  PACIENTES COM CHAMADOS RECORRENTES                               |
|  +-------+----------+---------+--------+-----------------------+ |
|  | Leito | Paciente | Chamados| Categ. | Padrão               | |
|  +-------+----------+---------+--------+-----------------------+ |
|  | 412A  | M.Silva  |    3    | Dor    | Crescente             | |
|  | 408B  | J.Costa  |    4    | Posic. | Estavel               | |
|  | 415A  | R.Souza  |    3    | Varios | Noturno predominante  | |
|  +-------+----------+---------+--------+-----------------------+ |
|                                                                   |
+------------------------------------------------------------------+
```

### 6.2 Dashboard de Dor por Unidade

```
+------------------------------------------------------------------+
|  PANORAMA DE DOR - Clinica Medica                                |
+------------------------------------------------------------------+
|                                                                   |
|  MAPA DE CALOR DE DOR POR LEITO (Media 24h)                     |
|                                                                   |
|  Q401  [2][1][3][0]   Q405  [5][3][2][-]   Q409  [0][1][0][0]  |
|  Q402  [4][2][-][-]   Q406  [1][0][-][-]   Q410  [3][2][1][-]  |
|  Q403  [0][0][1][0]   Q407  [7][4][3][2]   Q411  [0][-][-][-]  |
|  Q404  [6][3][2][-]   Q408  [2][1][4][3]   Q412  [6][0][-][-]  |
|                                                                   |
|  Escala: [0-2]=verde [3-4]=amarelo [5-6]=laranja [7-10]=vermelho |
|  [-] = leito vago                                                 |
|                                                                   |
|  ALERTAS DE DOR ATIVOS                                            |
|  [!!!] Q407A - Dor 7/10 crescente, 3a avaliacao alta consecutiva |
|  [!!]  Q412A - Dor 6/10, reavaliacao em atraso (2h)              |
|  [!!]  Q404A - PRN analgesico 5x em 24h                          |
|                                                                   |
|  EFICACIA DE INTERVENCOES (24h)                                   |
|  Alivio total:    ██████████ 45%                                 |
|  Alivio parcial:  ████████ 35%                                   |
|  Sem alivio:      ████ 15%                                       |
|  Nao reavaliada:  ██ 5%                                          |
|                                                                   |
+------------------------------------------------------------------+
```

### 6.3 Visao do Paciente Individual

```
+------------------------------------------------------------------+
|  DOR E CHAMADOS - Maria Silva Santos (CM-412A)                   |
+------------------------------------------------------------------+
|                                                                   |
|  EVOLUCAO DA DOR (72h)                                           |
|                                                                   |
|  10|                                                              |
|   8|                                                              |
|   6|              *         *                                    |
|   4|    *    *         *         *                                |
|   2|  *                               *    *                     |
|   0+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+-          |
|    06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21 22           |
|    04/06          04/07          04/08                            |
|     D  D     D        D  D     D     D     D                     |
|                                                                   |
|  D = Dipirona IV  |  * = Avaliacao de dor                        |
|  Tendencia: Melhorando (media 24h: 3.8, anterior: 4.5)           |
|                                                                   |
|  CHAMADOS (48h)                                                   |
|  +------+--------+--------+----------+--------+--------+        |
|  | Data | Hora   | Categ. | Fonte    | T.Resp | Status |        |
|  +------+--------+--------+----------+--------+--------+        |
|  | 08/04| 13:54  | Dor    | Botao    | 4 min  | Resol. |        |
|  | 08/04| 11:20  | Agua   | Tablet   | 8 min  | Resol. |        |
|  | 08/04| 09:15  | Posic. | Botao    | 2 min  | Resol. |        |
|  | 07/04| 22:05  | Dor    | Botao    | 3 min  | Resol. |        |
|  | 07/04| 19:30  | Higiene| Compan.  | 6 min  | Resol. |        |
|  | 07/04| 15:10  | Dor    | Botao    | 5 min  | Resol. |        |
|  +------+--------+--------+----------+--------+--------+        |
|                                                                   |
|  CORRELACAO DOR x CHAMADOS x INTERVENCOES                        |
|  13:54 - Chamado dor -> 13:58 Enf. atende -> 13:45 Dor 6/10    |
|         -> 14:00 Dipirona prescrita -> 14:10 Dipirona admin.    |
|         -> 15:00 Reavaliacao prevista [PENDENTE]                 |
|                                                                   |
+------------------------------------------------------------------+
```

---

## 7. Metricas e PromQL

### 7.1 Metricas de Chamados

```promql
# Tempo medio de resposta por unidade (ultimas 4h)
avg by (ward) (
  patient_call_response_time_seconds{status="responded"}
) / 60

# Chamados sem resposta atualmente
count(patient_call_status{status="pending"})

# Taxa de chamados abandonados (24h)
sum(increase(patient_call_abandoned_total[24h]))
  / sum(increase(patient_call_total[24h])) * 100

# Chamados por categoria (distribuicao horaria)
sum by (category, hour) (
  increase(patient_call_total[1h])
)

# Pacientes com chamados recorrentes (>3 em 8h)
count(
  count by (patient_id) (
    increase(patient_call_total{patient_id=~".+"}[8h]) > 3
  )
)

# Chamados de dor sem acao clinica correspondente
sum(increase(patient_call_pain_without_action_total[24h]))

# Tempo medio de resolucao por turno
avg by (shift) (
  patient_call_resolution_time_seconds
)
```

### 7.2 Metricas de Dor

```promql
# Media de dor por unidade
avg by (ward) (patient_pain_current_score)

# Pacientes com dor >= 7 sem intervencao em 30 min
count(
  patient_pain_current_score >= 7
  and on(patient_id)
  patient_pain_minutes_without_intervention > 30
)

# Eficacia de intervencoes (% com melhora)
sum(patient_pain_intervention_result{effect="full_relief"})
  + sum(patient_pain_intervention_result{effect="partial_relief"})
  / sum(patient_pain_intervention_result) * 100

# Reavaliacao de dor em atraso
count(patient_pain_reassessment_overdue == 1)

# Tendencia de dor (media movel 8h)
avg_over_time(patient_pain_current_score[8h])
```

### 7.3 LogQL para Chamados

```logql
# Chamados abandonados
{app="velya-call-system"} | json | status = "abandoned"

# Chamados com resposta > 10 min
{app="velya-call-system"} | json |
  time_to_first_contact_seconds > 600

# Chamados de dor com intensidade alta
{app="velya-call-system"} | json |
  category = "pain" |
  pain_intensity >= 7

# Correlacao chamado-acao
{app="velya-call-system"} | json |
  status = "resolved" |
  linked_clinical_actions = ""
```

---

## 8. Eventos NATS

### 8.1 Subjects

```
patient.journey.{patient_id}.communication.patient_call
patient.journey.{patient_id}.communication.call_response
patient.journey.{patient_id}.communication.call_resolution
patient.journey.{patient_id}.communication.call_abandoned
patient.journey.{patient_id}.communication.call_escalated
patient.journey.{patient_id}.clinical.pain_assessment
patient.journey.{patient_id}.clinical.pain_intervention
```

### 8.2 Consumer Groups

```
Consumer: call-response-monitor
  Filter: patient.journey.*.communication.patient_call
  Purpose: Monitora tempo de resposta e dispara escalacoes

Consumer: pain-intervention-monitor
  Filter: patient.journey.*.clinical.pain_assessment
  Purpose: Monitora avaliacoes de dor e verifica intervencoes

Consumer: call-pain-correlation
  Filter: patient.journey.*.communication.patient_call,
          patient.journey.*.clinical.pain_assessment,
          patient.journey.*.clinical.medication_administration.*
  Purpose: Correlaciona chamados de dor com acoes clinicas

Consumer: recurring-call-detector
  Filter: patient.journey.*.communication.patient_call
  Purpose: Detecta padroes de chamados recorrentes
```

---

## 9. Integracao com Dispositivos

### 9.1 Botao de Leito

```typescript
interface BedButtonIntegration {
  device_type: 'bed_button';
  protocol: 'mqtt' | 'zigbee' | 'wifi';

  events: {
    button_pressed: {
      device_id: string;
      bed_id: string;
      pressed_at: string;
      press_type: 'single' | 'double' | 'long'; // single=routine, double=urgent, long=emergency
      battery_level: number;
    };

    button_cancelled: {
      device_id: string;
      bed_id: string;
      cancelled_at: string;
      cancelled_by: 'patient' | 'staff';
      duration_seconds: number;
    };
  };

  mapping: {
    single_press: { urgency: 'routine', auto_category: null };     // Pede classificacao
    double_press: { urgency: 'urgent', auto_category: null };      // Pede classificacao
    long_press: { urgency: 'emergency', auto_category: 'urgent_need' }; // Auto-classifica
  };
}
```

### 9.2 Tablet do Leito

```typescript
interface BedTabletIntegration {
  device_type: 'bed_tablet';

  call_interface: {
    /** Categorias disponiveis no tablet */
    categories_displayed: CallCategory[];

    /** Campos coletados */
    fields: {
      category: { required: true };
      pain_intensity: { required: false, show_if: 'category == pain' };
      description: { required: false };
      urgency: { required: false, default: 'routine' };
    };

    /** Feedback visual */
    confirmation: {
      show_estimated_wait: true;
      show_assigned_nurse: true;
      allow_cancel: true;
    };
  };

  pain_interface: {
    /** Escala visual interativa */
    scale_type: 'Wong-Baker' | 'NRS_slider';
    body_map: true; // Mapa corporal para indicar localizacao
    character_options: ['pontada', 'queimacao', 'pressao', 'latejante', 'continua', 'intermitente'];
  };
}
```

---

## 10. Temporal Workflows

```typescript
// Workflow de monitoramento de chamado
interface CallMonitoringWorkflow {
  workflowId: 'call-monitoring-{call_id}';
  taskQueue: 'patient-calls';

  steps: [
    // 1. Chamado criado - inicia timer
    'startResponseTimer',

    // 2. Aguarda resposta ou timeout
    'waitForResponseOrTimeout',
    // Se timeout:
    //   a. Escala para charge nurse
    //   b. Reinicia timer menor
    //   c. Se segundo timeout: escala para coordenacao

    // 3. Resposta recebida - registra tempo
    'recordResponseTime',

    // 4. Aguarda resolucao ou timeout
    'waitForResolutionOrTimeout',

    // 5. Resolucao recebida
    'recordResolution',

    // 6. Verifica acao clinica vinculada
    'checkLinkedClinicalAction',
    // Se nao ha acao: cria gap event

    // 7. Agenda coleta de satisfacao (opcional)
    'scheduleSatisfactionCollection',
  ];

  signals: [
    'callResponded',
    'callResolved',
    'callAbandoned',
    'callReopened',
    'callCancelled',
  ];

  timers: {
    response_timeout_routine: '5m';
    response_timeout_urgent: '2m';
    response_timeout_emergency: '30s';
    resolution_timeout: '30m';
    escalation_timeout: '3m';
    clinical_action_check_delay: '30m';
  };
}

// Workflow de monitoramento de dor
interface PainMonitoringWorkflow {
  workflowId: 'pain-monitoring-{patient_id}-{assessment_id}';
  taskQueue: 'pain-monitoring';

  steps: [
    // 1. Avaliacao de dor registrada
    'processPainAssessment',

    // 2. Se dor >= 4, verifica intervencao
    'checkInterventionNeeded',
    // Se sim: aguarda intervencao ou timeout

    // 3. Se intervencao realizada, agenda reavaliacao
    'scheduleReassessment',

    // 4. Aguarda reavaliacao ou timeout
    'waitForReassessmentOrTimeout',
    // Se timeout: cria gap event

    // 5. Processa reavaliacao
    'processReassessment',
    // Se sem melhora: sugere revisao do plano
  ];

  timers: {
    intervention_expected: '30m';
    reassessment_after_intervention: '60m';
    reassessment_routine: '4h';
  };
}
```

---

## 11. Alertas e Notificacoes

| Alerta | Condicao | Destinatario | Canal | Timeout para Escalacao |
|---|---|---|---|---|
| `CallPending` | Chamado > 5 min sem resposta | Enf. Responsavel | Push | 3 min -> Chefe |
| `CallUrgent` | Chamado urgente > 2 min | Enf. + Chefe | Push + SMS | 1 min -> Coord. |
| `CallEmergency` | Chamado emergencia > 30s | Equipe toda | Push + SMS + Alarme | Imediato |
| `CallAbandoned` | Chamado abandonado | Chefe + Qualidade | Push + Email | - |
| `CallRecurring` | 3+ chamados em 2h | Chefe | Push | - |
| `PainHigh` | Dor >= 7 | Enf. + Medico | Push | 15 min |
| `PainNoIntervention` | Dor >= 7 sem intervencao 30 min | Chefe + Medico | Push | - |
| `PainReassessmentDue` | Reavaliacao em atraso | Enf. Responsavel | Push | 30 min -> Chefe |
| `PainPersistent` | Dor alta persistente (3 avaliacoes) | Medico | Push | - |
| `MissingMedCall` | Chamado "medicacao ausente" | Enf. + Farmacia | Push | - |

---

## Referencias

- [WHO - Dor como 5o Sinal Vital](https://www.who.int/)
- [NRS - Numeric Rating Scale](https://www.ncbi.nlm.nih.gov/pmc/)
- [FHIR R4 Communication](https://www.hl7.org/fhir/communication.html)
- [FHIR R4 Observation (Pain)](https://www.hl7.org/fhir/observation.html)
- [ANVISA - Protocolo de Avaliacao e Tratamento da Dor](https://www.gov.br/anvisa/)
- [NATS JetStream Patterns](https://docs.nats.io/nats-concepts/jetstream)
