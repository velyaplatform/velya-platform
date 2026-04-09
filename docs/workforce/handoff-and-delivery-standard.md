# Padrao de Handoff e Entrega — Velya Platform

> Requisitos estruturados para passagem de responsabilidade, transferencia de custodia e continuidade do cuidado/operacao.

---

## 1. Principio Fundamental

**Nenhum handoff e valido sem aceite explicito.** Sem aceite, a responsabilidade permanece com a origem e o item aparece como pendente/em risco nos paineis institucionais.

---

## 2. Modelo de Dados do Handoff

### 2.1 Schema TypeScript

```typescript
interface HandoffEvent {
  // --- Identificacao ---
  handoff_id: string;                    // UUID v7
  handoff_type: HandoffType;             // Tipo do handoff
  category: HandoffCategory;             // Categoria funcional

  // --- Origem ---
  origin_actor_id: string;               // Quem entrega
  origin_actor_role: ProfessionalRole;   // Papel de quem entrega
  origin_unit_id: string;                // Unidade de origem
  origin_department_id: string;          // Departamento de origem
  origin_shift_id?: string;              // Turno de origem (se passagem de plantao)

  // --- Destino ---
  destination_actor_id?: string;         // Para quem (pode ser role se nao definido)
  destination_role: ProfessionalRole;    // Papel esperado do receptor
  destination_unit_id: string;           // Unidade de destino
  destination_department_id: string;     // Departamento de destino
  destination_shift_id?: string;         // Turno de destino

  // --- Contexto do Paciente/Atividade ---
  patient_id?: string;                   // Paciente (quando aplicavel)
  encounter_id?: string;                 // Encontro/atendimento
  location_id: string;                   // Local
  reason: HandoffReason;                 // Motivo do handoff

  // --- Resumo Contextual ---
  context_summary: ContextSummary;       // Resumo estruturado
  clinical_status?: ClinicalStatus;      // Status clinico (SBAR)
  operational_status?: OperationalStatus; // Status operacional

  // --- Itens Pendentes ---
  pending_items: PendingItem[];          // O que esta pendente
  completed_items: CompletedItem[];      // O que foi feito

  // --- Prioridade e Risco ---
  priority: Priority;                    // Prioridade da passagem
  risk_level: RiskLevel;                 // Nivel de risco
  risk_factors?: string[];               // Fatores de risco identificados

  // --- Proximos Passos ---
  next_steps: NextStep[];                // Acoes esperadas do receptor
  expected_actions_timeline?: string;    // Quando as acoes devem ocorrer

  // --- Aceite ---
  acceptance: HandoffAcceptance;         // Estado do aceite

  // --- Temporal ---
  initiated_at: string;                  // Quando iniciado
  presented_at?: string;                 // Quando apresentado ao destino
  accepted_at?: string;                  // Quando aceito
  transition_time_minutes?: number;      // Tempo de transicao
  sla_target_minutes: number;            // SLA para aceite

  // --- Rastreabilidade ---
  provenance_id: string;
  audit_event_id: string;
  related_work_events: string[];         // WorkEvents relacionados
  version: number;
  supersedes?: string;
}

enum HandoffType {
  PASSAGEM_PLANTAO = 'passagem_plantao',
  TRANSFERENCIA_SETOR = 'transferencia_setor',
  TRANSFERENCIA_HOSPITAL = 'transferencia_hospital',
  ALTA_HOSPITALAR = 'alta_hospitalar',
  ENCAMINHAMENTO = 'encaminhamento',
  INTERCONSULTA = 'interconsulta',
  COBERTURA_TEMPORARIA = 'cobertura_temporaria',
  ENTREGA_OPERACIONAL = 'entrega_operacional',
  CUSTODIA_TRANSPORTE = 'custodia_transporte',
  ENTREGA_MATERIAL = 'entrega_material',
  ESCALACAO = 'escalacao',
}

enum HandoffCategory {
  CLINICO = 'clinico',
  OPERACIONAL = 'operacional',
  ADMINISTRATIVO = 'administrativo',
  TRANSPORTE = 'transporte',
  LOGISTICO = 'logistico',
}

enum HandoffReason {
  FIM_TURNO = 'fim_turno',
  NECESSIDADE_CLINICA = 'necessidade_clinica',
  MUDANCA_NIVEL_CUIDADO = 'mudanca_nivel_cuidado',
  ALTA = 'alta',
  TRANSFERENCIA = 'transferencia',
  INDISPONIBILIDADE = 'indisponibilidade',
  ESCALACAO = 'escalacao',
  ROTINA = 'rotina',
  EMERGENCIA = 'emergencia',
  SOLICITACAO_PACIENTE = 'solicitacao_paciente',
  CONCLUSAO_TAREFA = 'conclusao_tarefa',
}

interface HandoffAcceptance {
  status: AcceptanceStatus;
  actor_id?: string;
  actor_role?: ProfessionalRole;
  timestamp?: string;
  refusal_reason?: string;
  conditions?: string[];                 // Condicoes de aceite
  partial_acceptance?: {
    accepted_items: string[];
    refused_items: string[];
    reason: string;
  };
}

enum AcceptanceStatus {
  AGUARDANDO = 'aguardando',
  ACEITO = 'aceito',
  RECUSADO = 'recusado',
  ACEITO_COM_RESSALVA = 'aceito_com_ressalva',
  ACEITO_PARCIAL = 'aceito_parcial',
  TIMEOUT = 'timeout',
  ESCALADO = 'escalado',
}

type Priority = 'emergencia' | 'urgente' | 'alta' | 'rotina';
type RiskLevel = 'critico' | 'alto' | 'moderado' | 'baixo';
```

### 2.2 Resumo Contextual Estruturado

```typescript
interface ContextSummary {
  format: 'SBAR' | 'IPASS' | 'CLOSED_LOOP' | 'OPERATIONAL_SIMPLE';
  content: SBARContent | IPASSContent | ClosedLoopContent | OperationalSimpleContent;
}

// --- SBAR (clinico) ---
interface SBARContent {
  situation: string;        // O que esta acontecendo agora
  background: string;       // Contexto relevante
  assessment: string;       // Avaliacao atual
  recommendation: string;   // O que recomenda ao proximo
}

// --- I-PASS (passagem de plantao) ---
interface IPASSContent {
  illness_severity: 'estavel' | 'observacao' | 'instavel' | 'critico';
  patient_summary: string;       // Resumo do paciente
  action_list: ActionItem[];     // Lista de acoes pendentes
  situation_awareness: string;   // Consciencia situacional
  synthesis: string;             // Sintese e confirmacao
}

interface ActionItem {
  action: string;
  deadline?: string;
  responsible?: string;
  priority: Priority;
  completed: boolean;
}

// --- Closed Loop (comunicacao critica) ---
interface ClosedLoopContent {
  message_sent: string;          // Mensagem enviada
  message_received: string;      // Mensagem recebida (readback)
  confirmation: string;          // Confirmacao do emissor
  confirmed_at: string;          // Timestamp da confirmacao
}

// --- Operational Simple (nao-clinico) ---
interface OperationalSimpleContent {
  what_was_done: string;         // O que foi feito
  what_remains: string;          // O que falta
  where: string;                 // Onde
  when_needed: string;           // Quando precisa ser feito
  special_conditions?: string;   // Condicoes especiais
}
```

---

## 3. Formatos de Handoff por Contexto

### 3.1 Tabela de Formatos

| Contexto | Formato | Obrigatoriedade | Aceite Obrigatorio | SLA Aceite |
|---|---|---|---|---|
| Passagem de plantao medico | I-PASS | Obrigatorio | Sim | 15 min |
| Passagem de plantao enfermagem | I-PASS | Obrigatorio | Sim | 15 min |
| Transferencia UTI -> Enfermaria | SBAR | Obrigatorio | Sim | 30 min |
| Transferencia entre unidades | SBAR | Obrigatorio | Sim | 30 min |
| Alta hospitalar | SBAR | Obrigatorio | N/A (paciente) | N/A |
| Interconsulta | SBAR | Obrigatorio | Sim | 60 min |
| Cobertura temporaria | Closed Loop | Obrigatorio | Sim | 5 min |
| Comunicacao critica (lab, imagem) | Closed Loop | Obrigatorio | Sim | 10 min |
| Transporte paciente | Operational Simple | Obrigatorio | Sim | 5 min |
| Limpeza terminal | Operational Simple | Obrigatorio | Sim | 10 min |
| Manutencao equipamento | Operational Simple | Obrigatorio | Sim | 15 min |
| Entrega material/farmacia | Operational Simple | Obrigatorio | Sim | 10 min |
| Seguranca - ocorrencia | Operational Simple | Obrigatorio | Sim | 5 min |
| Escalacao clinica | SBAR + Closed Loop | Obrigatorio | Sim | Conforme urgencia |

### 3.2 Campos por Formato

| Campo | SBAR | I-PASS | Closed Loop | Op. Simple |
|---|---|---|---|---|
| Origem | Obrigatorio | Obrigatorio | Obrigatorio | Obrigatorio |
| Destino | Obrigatorio | Obrigatorio | Obrigatorio | Obrigatorio |
| Motivo | Obrigatorio | Obrigatorio | Obrigatorio | Obrigatorio |
| Resumo contextual | SBAR completo | I-PASS completo | Mensagem+readback | O que feito/falta |
| Pendencias | Obrigatorio | Action list | N/A | O que falta |
| Prioridade | Obrigatorio | illness_severity | Implicita | Obrigatorio |
| Risco | Obrigatorio | Obrigatorio | N/A | Opcional |
| Proximos passos | Recommendation | Action list | Confirmacao | Quando necessario |
| Aceite explicito | Sim | Synthesis | Confirmation | Sim |
| Tempo aceite | Registrado | Registrado | Registrado | Registrado |
| Tempo transicao | Calculado | Calculado | Calculado | Calculado |
| Motivo recusa | Se recusado | Se recusado | N/A | Se recusado |

---

## 4. Fluxo de Handoff

### 4.1 Fluxo Padrao

```
[Origem inicia handoff]
        |
        v
[Preenche dados estruturados]
  (formato adequado ao contexto)
        |
        v
[Publica evento NATS]
  subject: velya.handoff.{type}.initiated
        |
        v
[Notifica destino]
  (push notification, painel, alerta)
        |
        v
[Destino recebe e avalia]
        |
        +----> [ACEITA] --> velya.handoff.{type}.accepted
        |                       |
        |                       v
        |              [Responsabilidade transferida]
        |              [Timer SLA inicia para acoes pendentes]
        |
        +----> [ACEITA COM RESSALVA] --> velya.handoff.{type}.accepted_conditional
        |                                    |
        |                                    v
        |                           [Registra condicoes]
        |                           [Responsabilidade parcial]
        |
        +----> [RECUSA] --> velya.handoff.{type}.refused
        |                       |
        |                       v
        |              [Motivo obrigatorio]
        |              [Responsabilidade PERMANECE com origem]
        |              [Escalacao automatica se SLA estourar]
        |
        +----> [TIMEOUT] --> velya.handoff.{type}.timeout
                                |
                                v
                       [Escalacao automatica]
                       [Alerta para gestao]
                       [Responsabilidade em risco]
```

### 4.2 Regras de Timeout e Escalacao

```typescript
interface HandoffEscalationRules {
  timeout_rules: TimeoutRule[];
  escalation_chain: EscalationChain[];
}

const handoffTimeoutRules: TimeoutRule[] = [
  {
    handoff_type: 'passagem_plantao',
    sla_minutes: 15,
    warning_at_percent: 75,     // Alerta em 11 min
    escalation_at_percent: 100, // Escala em 15 min
    escalation_target: 'enfermeiro_lider',
  },
  {
    handoff_type: 'transferencia_setor',
    sla_minutes: 30,
    warning_at_percent: 50,
    escalation_at_percent: 100,
    escalation_target: 'coordenador_unidade',
  },
  {
    handoff_type: 'custodia_transporte',
    sla_minutes: 5,
    warning_at_percent: 80,
    escalation_at_percent: 100,
    escalation_target: 'supervisao_transporte',
  },
  {
    handoff_type: 'entrega_operacional',
    sla_minutes: 10,
    warning_at_percent: 70,
    escalation_at_percent: 100,
    escalation_target: 'supervisor_area',
  },
];

interface TimeoutRule {
  handoff_type: string;
  sla_minutes: number;
  warning_at_percent: number;
  escalation_at_percent: number;
  escalation_target: string;
}

interface EscalationChain {
  level: number;
  role: string;
  timeout_minutes: number;
  action: 'notify' | 'assign' | 'override';
}

const clinicalEscalationChain: EscalationChain[] = [
  { level: 1, role: 'enfermeiro_lider', timeout_minutes: 15, action: 'notify' },
  { level: 2, role: 'coordenador_unidade', timeout_minutes: 30, action: 'notify' },
  { level: 3, role: 'gestor_departamento', timeout_minutes: 60, action: 'assign' },
  { level: 4, role: 'direcao_tecnica', timeout_minutes: 120, action: 'override' },
];
```

---

## 5. NATS JetStream Subjects para Handoff

```yaml
streams:
  HANDOFFS:
    subjects:
      - "velya.handoff.>"
    retention: limits
    max_age: "2160h"
    storage: file
    replicas: 3

subjects:
  - "velya.handoff.passagem_plantao.initiated"
  - "velya.handoff.passagem_plantao.accepted"
  - "velya.handoff.passagem_plantao.refused"
  - "velya.handoff.passagem_plantao.timeout"
  - "velya.handoff.passagem_plantao.escalated"
  - "velya.handoff.transferencia_setor.initiated"
  - "velya.handoff.transferencia_setor.accepted"
  - "velya.handoff.transferencia_setor.refused"
  - "velya.handoff.transferencia_setor.timeout"
  - "velya.handoff.custodia_transporte.initiated"
  - "velya.handoff.custodia_transporte.accepted"
  - "velya.handoff.custodia_transporte.refused"
  - "velya.handoff.entrega_operacional.initiated"
  - "velya.handoff.entrega_operacional.accepted"
  - "velya.handoff.entrega_operacional.refused"
  - "velya.handoff.escalacao.initiated"
  - "velya.handoff.escalacao.resolved"

consumers:
  handoff_tracker:
    durable_name: "handoff-state-tracker"
    filter_subject: "velya.handoff.>"
    ack_policy: explicit
    max_deliver: 5

  handoff_timeout_checker:
    durable_name: "handoff-timeout-monitor"
    filter_subject: "velya.handoff.*.initiated"
    ack_policy: explicit
```

---

## 6. PostgreSQL Schema

```sql
CREATE TABLE handoffs (
    handoff_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handoff_type            TEXT NOT NULL,
    category                TEXT NOT NULL,
    origin_actor_id         UUID NOT NULL,
    origin_actor_role       TEXT NOT NULL,
    origin_unit_id          UUID NOT NULL,
    origin_department_id    UUID NOT NULL,
    origin_shift_id         UUID,
    destination_actor_id    UUID,
    destination_role        TEXT NOT NULL,
    destination_unit_id     UUID NOT NULL,
    destination_department_id UUID NOT NULL,
    destination_shift_id    UUID,
    patient_id              UUID,
    encounter_id            UUID,
    location_id             UUID NOT NULL,
    reason                  TEXT NOT NULL,
    context_summary         JSONB NOT NULL,
    clinical_status         JSONB,
    operational_status      JSONB,
    pending_items           JSONB NOT NULL DEFAULT '[]',
    completed_items         JSONB NOT NULL DEFAULT '[]',
    priority                TEXT NOT NULL DEFAULT 'rotina',
    risk_level              TEXT NOT NULL DEFAULT 'baixo',
    risk_factors            JSONB DEFAULT '[]',
    next_steps              JSONB NOT NULL DEFAULT '[]',
    acceptance_status       TEXT NOT NULL DEFAULT 'aguardando',
    acceptance_actor_id     UUID,
    acceptance_actor_role   TEXT,
    acceptance_timestamp    TIMESTAMPTZ,
    refusal_reason          TEXT,
    acceptance_conditions   JSONB,
    initiated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    presented_at            TIMESTAMPTZ,
    accepted_at             TIMESTAMPTZ,
    transition_time_minutes INTEGER,
    sla_target_minutes      INTEGER NOT NULL,
    sla_met                 BOOLEAN,
    provenance_id           TEXT,
    audit_event_id          TEXT,
    related_work_events     UUID[] DEFAULT '{}',
    version                 INTEGER NOT NULL DEFAULT 1,
    supersedes              UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_handoffs_origin ON handoffs(origin_actor_id, initiated_at DESC);
CREATE INDEX idx_handoffs_destination ON handoffs(destination_actor_id, initiated_at DESC);
CREATE INDEX idx_handoffs_pending ON handoffs(acceptance_status) WHERE acceptance_status = 'aguardando';
CREATE INDEX idx_handoffs_patient ON handoffs(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_handoffs_type ON handoffs(handoff_type, initiated_at DESC);
CREATE INDEX idx_handoffs_unit ON handoffs(destination_unit_id, acceptance_status);
```

---

## 7. Temporal Workflow para Handoff

```typescript
interface HandoffWorkflow {
  name: 'handoff-lifecycle';
  taskQueue: 'handoffs';

  activities: {
    validateHandoff: {
      input: HandoffEvent;
      output: ValidationResult;
      timeout: '5s';
    };
    enrichContext: {
      input: HandoffEvent;
      output: HandoffEvent; // enriquecido com dados do encounter, shift, etc
      timeout: '10s';
    };
    persistHandoff: {
      input: HandoffEvent;
      output: { handoff_id: string };
      timeout: '5s';
    };
    notifyDestination: {
      input: { handoff_id: string; destination: string; channel: string };
      output: { notification_sent: boolean };
      timeout: '10s';
    };
    awaitAcceptance: {
      input: { handoff_id: string; sla_minutes: number };
      output: HandoffAcceptance;
      // Este activity usa um signal para receber o aceite
      // Se timeout, retorna status TIMEOUT
    };
    handleAcceptance: {
      input: { handoff_id: string; acceptance: HandoffAcceptance };
      output: void;
      timeout: '5s';
    };
    handleRefusal: {
      input: { handoff_id: string; refusal_reason: string };
      output: { escalated: boolean; new_target?: string };
      timeout: '10s';
    };
    escalateTimeout: {
      input: { handoff_id: string; escalation_level: number };
      output: { resolved: boolean; assigned_to?: string };
      timeout: '30s';
    };
  };

  retryPolicy: {
    initialInterval: '1s';
    backoffCoefficient: 2;
    maximumInterval: '60s';
    maximumAttempts: 5;
  };
}
```

---

## 8. Indicadores de Handoff

### 8.1 Metricas Prometheus

```yaml
metrics:
  - name: velya_handoff_total
    type: counter
    labels: [handoff_type, category, acceptance_status]
    help: "Total de handoffs realizados"

  - name: velya_handoff_acceptance_time_seconds
    type: histogram
    labels: [handoff_type, category]
    buckets: [30, 60, 120, 300, 600, 900, 1800, 3600]
    help: "Tempo ate aceite do handoff em segundos"

  - name: velya_handoff_transition_time_minutes
    type: histogram
    labels: [handoff_type, from_unit, to_unit]
    buckets: [5, 10, 15, 30, 45, 60, 90, 120]
    help: "Tempo total de transicao em minutos"

  - name: velya_handoff_pending_count
    type: gauge
    labels: [handoff_type, destination_unit, priority]
    help: "Handoffs aguardando aceite"

  - name: velya_handoff_timeout_total
    type: counter
    labels: [handoff_type, destination_unit]
    help: "Total de handoffs com timeout"

  - name: velya_handoff_refusal_total
    type: counter
    labels: [handoff_type, refusal_reason]
    help: "Total de handoffs recusados"

  - name: velya_handoff_sla_compliance_ratio
    type: gauge
    labels: [handoff_type, department]
    help: "Taxa de conformidade SLA de handoff"

  - name: velya_handoff_pending_items_count
    type: gauge
    labels: [handoff_type, priority]
    help: "Itens pendentes em handoffs"
```

---

## 9. Regras de Negocio

| ID | Regra | Consequencia do Descumprimento |
|---|---|---|
| H001 | Todo handoff clinico usa SBAR ou I-PASS | Bloqueio do envio |
| H002 | Aceite explicito e obrigatorio | Item aparece como pendente/risco |
| H003 | Recusa requer justificativa | Bloqueio da recusa |
| H004 | Timeout gera escalacao automatica | Notificacao ao gestor |
| H005 | Pendencias devem ser listadas individualmente | Bloqueio do envio |
| H006 | Handoff de turno deve cobrir todos os pacientes da unidade | Gap detectado automaticamente |
| H007 | Transporte requer aceite de custodia na origem e no destino | Transporte nao inicia/finaliza |
| H008 | Limpeza terminal requer liberacao explicita pelo higienizacao | Leito nao disponibilizado |
| H009 | Interconsulta requer aceite do especialista | Solicitacao fica pendente visivel |
| H010 | Handoff com risco critico gera alerta imediato ao gestor | Alerta push + painel |

---

## 10. Resumo

O padrao de handoff do Velya garante:

1. **Estrutura obrigatoria** — Nenhuma passagem livre de formato e campos minimos.
2. **Aceite explicito** — A responsabilidade so transfere com aceite registrado.
3. **Visibilidade de pendencias** — Sem aceite, a pendencia e visivel para toda a cadeia.
4. **Escalacao automatica** — Timeout dispara cadeia de escalacao.
5. **Rastreabilidade total** — Cada handoff gera Provenance + AuditEvent.
6. **Formatos por contexto** — SBAR para clinico, I-PASS para plantao, Closed Loop para critico, Operational Simple para operacional.
