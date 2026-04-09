# Modelo de Reporte Hospitalar Institucional — Velya Platform

> **Mandato central:** Velya e o sistema unico e obrigatorio de reporte de trabalho para TODAS as areas, funcoes e turnos do hospital.

---

## 1. Principio Fundamental

**"Reportar trabalho" e diferente de "acessar conteudo clinico."**

| Conceito | Descricao |
|---|---|
| **Reportar trabalho** | Registrar o que foi feito, quando, por quem, para qual paciente/local/unidade/fluxo, com qual papel profissional, motivo de acionamento, SLA, entrega, pendencias, handoff, aceite, atrasos, excecoes, correcoes, escalacoes. |
| **Acessar conteudo clinico** | Visualizar diagnosticos, prescricoes, evolucoes, resultados de exames, notas clinicas. Requer autorizacao clinica especifica e relacao assistencial comprovada. |

Toda pessoa que executa qualquer atividade no hospital DEVE reportar. Nem toda pessoa que reporta tem acesso a dados clinicos.

### 1.1 Escopo do Mandato

- **Assistencial**: medicos, enfermeiros, tecnicos, fisioterapeutas, farmaceuticos, nutricionistas, psicologos, assistentes sociais, fonoaudiologos, terapeutas ocupacionais, laboratoristas, radiologistas, anestesistas, cirurgioes, intensivistas, emergencistas, reguladores, paliativistas.
- **Operacional**: recepcao, cadastro, central de internacao, central de leitos, transporte interno, ambulancia, higienizacao, rouparia, manutencao, hotelaria, seguranca, maqueiros, almoxarifado, farmacia logistica, nutricao operacional, admin de unidade, faturamento, TI, qualidade, auditoria, SCIH, gestao, direcao.

**Ninguem esta isento.** A direcao reporta decisoes estrategicas. O maqueiro reporta transportes. O tecnico de TI reporta incidentes.

---

## 2. Modelo de Evento de Trabalho (Work Event)

### 2.1 Campos Obrigatorios (20+ campos)

```typescript
interface WorkEvent {
  // --- Identificacao ---
  event_id: string;                    // UUID v7 (timestamp-ordered)
  event_type: WorkEventType;           // Enum: ver taxonomia completa
  category: WorkEventCategory;         // Enum: ver abaixo
  subcategory: string;                 // Subcategoria especifica

  // --- Temporal ---
  timestamp: string;                   // ISO 8601 com timezone
  recorded_at: string;                 // Momento do registro (pode diferir do timestamp)
  shift_id: string;                    // ID do turno vigente
  shift_period: ShiftPeriod;           // 'diurno' | 'noturno' | 'intermediario'

  // --- Autoria ---
  actor_id: string;                    // ID unico do profissional
  actor_role: ProfessionalRole;        // Papel profissional (enum)
  actor_function: string;              // Funcao exercida no momento
  actor_unit: string;                  // Unidade de lotacao
  actor_team_id?: string;              // CareTeam FHIR ID

  // --- Contexto ---
  patient_id?: string;                 // ID do paciente (quando aplicavel)
  encounter_id?: string;               // ID do encontro/atendimento
  location_id: string;                 // Localizacao (unidade, leito, sala, area)
  department_id: string;               // Departamento responsavel
  unit_id: string;                     // Unidade funcional

  // --- Acionamento ---
  activation_reason: ActivationReason; // Por que foi acionado
  activated_by?: string;               // Quem acionou (actor_id ou system)
  activation_channel: ActivationChannel; // Como foi acionado
  activation_timestamp?: string;       // Quando foi acionado

  // --- Execucao ---
  action_performed: string;            // O que foi feito (texto estruturado)
  action_code?: string;                // Codigo padronizado da acao
  duration_minutes?: number;           // Duracao em minutos
  sla_target_minutes?: number;         // SLA esperado
  sla_met?: boolean;                   // SLA cumprido?

  // --- Entrega ---
  delivery_status: DeliveryStatus;     // Status da entrega
  pending_items?: PendingItem[];       // Itens pendentes
  next_step?: NextStep;                // Proximo passo
  handoff_target?: string;             // Para quem passa

  // --- Qualidade ---
  exceptions?: ExceptionRecord[];      // Excecoes registradas
  corrections?: CorrectionRecord[];    // Correcoes aplicadas
  escalations?: EscalationRecord[];    // Escalacoes realizadas
  delay_reason?: string;               // Motivo de atraso (se aplicavel)

  // --- Rastreabilidade ---
  provenance_id: string;               // FHIR Provenance ID
  audit_event_id: string;              // FHIR AuditEvent ID
  source_system: string;               // Sistema de origem
  version: number;                     // Versao do evento (para correcoes)
  supersedes?: string;                 // event_id que este evento corrige

  // --- Aceite/Handoff ---
  acceptance_status?: AcceptanceStatus;
  acceptance_actor?: string;
  acceptance_timestamp?: string;
  refusal_reason?: string;
}
```

### 2.2 Enums Fundamentais

```typescript
enum WorkEventCategory {
  ASSISTENCIAL = 'assistencial',
  OPERACIONAL = 'operacional',
  ADMINISTRATIVO = 'administrativo',
  APOIO = 'apoio',
  LOGISTICA = 'logistica',
  HIGIENE = 'higiene',
  MANUTENCAO = 'manutencao',
  TRANSPORTE = 'transporte',
  COMUNICACAO = 'comunicacao',
  HANDOFF = 'handoff',
  SEGURANCA = 'seguranca',
  TI = 'ti',
  EXCECAO = 'excecao',
  CORRECAO = 'correcao',
  VALIDACAO = 'validacao',
  AUDITORIA = 'auditoria',
}

enum DeliveryStatus {
  PENDENTE = 'pendente',
  EM_EXECUCAO = 'em_execucao',
  CONCLUIDO = 'concluido',
  CONCLUIDO_PARCIAL = 'concluido_parcial',
  CANCELADO = 'cancelado',
  TRANSFERIDO = 'transferido',
  ESCALADO = 'escalado',
  ATRASADO = 'atrasado',
  BLOQUEADO = 'bloqueado',
}

enum AcceptanceStatus {
  AGUARDANDO = 'aguardando',
  ACEITO = 'aceito',
  RECUSADO = 'recusado',
  ACEITO_COM_RESSALVA = 'aceito_com_ressalva',
  TIMEOUT = 'timeout',
}

enum ActivationReason {
  DEMANDA_PACIENTE = 'demanda_paciente',
  PRESCRICAO = 'prescricao',
  PROTOCOLO = 'protocolo',
  CHAMADO_EQUIPE = 'chamado_equipe',
  EMERGENCIA = 'emergencia',
  AGENDA = 'agenda',
  ROTINA_TURNO = 'rotina_turno',
  ESCALACAO = 'escalacao',
  TRANSFERENCIA = 'transferencia',
  REGULACAO = 'regulacao',
  MANUTENCAO_PREVENTIVA = 'manutencao_preventiva',
  INCIDENTE = 'incidente',
  AUDITORIA_PROGRAMADA = 'auditoria_programada',
}

enum ActivationChannel {
  SISTEMA = 'sistema',
  CHAMADA_PACIENTE = 'chamada_paciente',
  TELEFONE = 'telefone',
  PRESENCIAL = 'presencial',
  RADIO = 'radio',
  APLICATIVO = 'aplicativo',
  PAINEL = 'painel',
  AUTOMACAO = 'automacao',
}

type ShiftPeriod = 'diurno' | 'noturno' | 'intermediario' | 'plantao_12h' | 'sobreaviso';
```

### 2.3 Tipos Auxiliares

```typescript
interface PendingItem {
  item_id: string;
  description: string;
  priority: 'critica' | 'alta' | 'media' | 'baixa';
  responsible_role?: ProfessionalRole;
  deadline?: string;
}

interface NextStep {
  action: string;
  target_role: ProfessionalRole;
  target_department?: string;
  expected_by?: string;
  context_summary?: string;
}

interface ExceptionRecord {
  exception_type: string;
  description: string;
  severity: 'critica' | 'alta' | 'media' | 'baixa';
  mitigation?: string;
  reported_to?: string;
}

interface CorrectionRecord {
  original_event_id: string;
  field_corrected: string;
  old_value: string;
  new_value: string;
  justification: string;
  corrected_by: string;
  corrected_at: string;
}

interface EscalationRecord {
  escalation_type: string;
  from_role: ProfessionalRole;
  to_role: ProfessionalRole;
  reason: string;
  response_expected_by?: string;
}
```

---

## 3. Taxonomia de Categorias

### 3.1 Mapa Hierarquico

| Categoria | Subcategorias | Exemplos de Eventos |
|---|---|---|
| `assistencial` | avaliacao, prescricao, administracao, procedimento, evolucao, reavaliacao | Medico evolui paciente, enfermeiro administra medicacao |
| `operacional` | alocacao, transferencia, bloqueio, liberacao, indisponibilidade | Central de leitos aloca vaga, recepcao cadastra paciente |
| `administrativo` | faturamento, autorizacao, regulacao, agendamento, cancelamento | Faturamento processa guia, regulacao autoriza transferencia |
| `apoio` | nutricao, farmacia, laboratorio, imagem, reabilitacao | Farmacia dispensa medicacao, lab processa amostra |
| `logistica` | estoque, distribuicao, reposicao, devolucao, inventario | Almoxarifado distribui material, farmacia repoe estoque |
| `higiene` | terminal, concorrente, imediata, area_critica | Higienizacao limpa leito pos-alta, limpeza concorrente UTI |
| `manutencao` | preventiva, corretiva, emergencial, predial, equipamento | Manutencao repara equipamento, preventiva ar-condicionado |
| `transporte` | interno, externo, urgente, rotina, ambulancia | Maqueiro transporta paciente, ambulancia transfere |
| `comunicacao` | acionamento, resposta, retorno, notificacao, alerta | Enfermeiro aciona medico plantonista, alerta critico lab |
| `handoff` | passagem_turno, transferencia_setor, alta, obito, encaminhamento | Passagem de plantao enfermagem, transferencia UTI->enfermaria |
| `seguranca` | ocorrencia, contencao, apoio_equipe, controle_acesso | Seguranca contem situacao, apoio a equipe assistencial |
| `ti` | incidente, indisponibilidade, correcao, deploy, monitoramento | TI resolve incidente, sistema indisponivel, correcao aplicada |
| `excecao` | desvio_protocolo, evento_adverso, quase_falha, nao_conformidade | Desvio de protocolo registrado, evento adverso notificado |
| `correcao` | retificacao, complementacao, anulacao, substituicao | Correcao de evolucao, retificacao de prescricao |
| `validacao` | conferencia, dupla_checagem, assinatura, co_assinatura | Farmaceutico valida prescricao, dupla checagem sangue |
| `auditoria` | acesso, sessao, exportacao, visualizacao, alteracao | Login registrado, acesso a prontuario auditado |

---

## 4. Fluxo de Publicacao de Eventos

### 4.1 Arquitetura de Ingestao

```
[Frontend/Device] --> [API Gateway] --> [WorkEvent Ingestion Service]
                                              |
                                              v
                                    [Validacao de Schema]
                                              |
                                              v
                                    [Enriquecimento Contextual]
                                    (turno, unidade, encounter)
                                              |
                                              v
                                    [NATS JetStream]
                                    subject: velya.work.{category}.{event_type}
                                              |
                              +---------------+---------------+
                              |               |               |
                              v               v               v
                    [PostgreSQL]    [FHIR Server]    [Audit Pipeline]
                    (work_events)  (Provenance +    (AuditEvent +
                                    AuditEvent)      Analytics)
```

### 4.2 NATS JetStream Subjects

```yaml
streams:
  WORK_EVENTS:
    subjects:
      - "velya.work.>"
    retention: limits
    max_age: "2160h"  # 90 dias em stream, depois cold storage
    storage: file
    replicas: 3
    max_msg_size: "1MB"
    discard: old
    duplicate_window: "2m"

consumers:
  work_event_persister:
    durable_name: "work-event-db-writer"
    filter_subject: "velya.work.>"
    ack_policy: explicit
    max_deliver: 5
    ack_wait: "30s"
    deliver_policy: all

  work_event_fhir_writer:
    durable_name: "work-event-fhir-sync"
    filter_subject: "velya.work.>"
    ack_policy: explicit
    max_deliver: 5

  work_event_audit:
    durable_name: "work-event-audit-trail"
    filter_subject: "velya.work.auditoria.>"
    ack_policy: explicit

  work_event_sla_monitor:
    durable_name: "work-event-sla-checker"
    filter_subject: "velya.work.>"
    ack_policy: explicit
```

### 4.3 Temporal Workflows

```typescript
interface WorkEventIngestionWorkflow {
  name: 'work-event-ingestion';
  taskQueue: 'work-events';
  activities: [
    'validateWorkEvent',
    'enrichWorkEventContext',
    'persistToPostgreSQL',
    'createFHIRProvenance',
    'createFHIRAuditEvent',
    'publishToNATS',
    'checkSLACompliance',
    'detectGaps',
  ];
  retryPolicy: {
    initialInterval: '1s';
    backoffCoefficient: 2;
    maximumInterval: '60s';
    maximumAttempts: 10;
  };
}
```

---

## 5. Modelo de Dados PostgreSQL

### 5.1 Tabela Principal

```sql
CREATE TABLE work_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type          TEXT NOT NULL,
    category            TEXT NOT NULL,
    subcategory         TEXT,
    timestamp           TIMESTAMPTZ NOT NULL,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shift_id            UUID NOT NULL REFERENCES shifts(shift_id),
    shift_period        TEXT NOT NULL,
    actor_id            UUID NOT NULL REFERENCES professionals(professional_id),
    actor_role          TEXT NOT NULL,
    actor_function      TEXT,
    actor_unit          TEXT NOT NULL,
    actor_team_id       UUID,
    patient_id          UUID,
    encounter_id        UUID,
    location_id         UUID NOT NULL,
    department_id       UUID NOT NULL,
    unit_id             UUID NOT NULL,
    activation_reason   TEXT NOT NULL,
    activated_by        UUID,
    activation_channel  TEXT NOT NULL,
    activation_timestamp TIMESTAMPTZ,
    action_performed    TEXT NOT NULL,
    action_code         TEXT,
    duration_minutes    INTEGER,
    sla_target_minutes  INTEGER,
    sla_met             BOOLEAN,
    delivery_status     TEXT NOT NULL DEFAULT 'pendente',
    pending_items       JSONB DEFAULT '[]',
    next_step           JSONB,
    handoff_target      UUID,
    exceptions          JSONB DEFAULT '[]',
    corrections         JSONB DEFAULT '[]',
    escalations         JSONB DEFAULT '[]',
    delay_reason        TEXT,
    provenance_id       TEXT,
    audit_event_id      TEXT,
    source_system       TEXT NOT NULL DEFAULT 'velya',
    version             INTEGER NOT NULL DEFAULT 1,
    supersedes          UUID,
    acceptance_status   TEXT,
    acceptance_actor    UUID,
    acceptance_timestamp TIMESTAMPTZ,
    refusal_reason      TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices para consultas frequentes
CREATE INDEX idx_work_events_actor ON work_events(actor_id, timestamp DESC);
CREATE INDEX idx_work_events_patient ON work_events(patient_id, timestamp DESC) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_work_events_department ON work_events(department_id, timestamp DESC);
CREATE INDEX idx_work_events_category ON work_events(category, timestamp DESC);
CREATE INDEX idx_work_events_shift ON work_events(shift_id);
CREATE INDEX idx_work_events_encounter ON work_events(encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX idx_work_events_delivery ON work_events(delivery_status) WHERE delivery_status != 'concluido';
CREATE INDEX idx_work_events_sla ON work_events(sla_met, category) WHERE sla_met = false;
CREATE INDEX idx_work_events_acceptance ON work_events(acceptance_status) WHERE acceptance_status = 'aguardando';
CREATE INDEX idx_work_events_type_time ON work_events(event_type, timestamp DESC);
```

### 5.2 Tabela de Turnos

```sql
CREATE TABLE shifts (
    shift_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_date      DATE NOT NULL,
    shift_period    TEXT NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    department_id   UUID NOT NULL,
    unit_id         UUID NOT NULL,
    supervisor_id   UUID,
    status          TEXT NOT NULL DEFAULT 'ativo',
    handoff_complete BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 6. Regras de Negocio

### 6.1 Obrigatoriedade

| Regra | Descricao |
|---|---|
| R001 | Todo evento de trabalho DEVE ter actor_id, timestamp, category, event_type, location_id, department_id |
| R002 | Eventos assistenciais DEVEM ter patient_id e encounter_id |
| R003 | Eventos com SLA DEVEM ter sla_target_minutes preenchido |
| R004 | Handoffs DEVEM ter handoff_target e pending_items |
| R005 | Correcoes DEVEM ter supersedes apontando para o evento original |
| R006 | Excecoes DEVEM ter severity e descricao |
| R007 | Escalacoes DEVEM ter from_role, to_role e reason |
| R008 | Eventos operacionais DEVEM ter activation_reason e activation_channel |
| R009 | Todo evento gera Provenance FHIR automaticamente |
| R010 | Todo evento gera AuditEvent FHIR automaticamente |

### 6.2 Validacao Temporal

| Regra | Descricao |
|---|---|
| T001 | timestamp nao pode ser futuro (tolerancia: 5 minutos) |
| T002 | timestamp nao pode ser mais de 24h no passado sem justificativa |
| T003 | recorded_at e sempre o momento do registro (servidor) |
| T004 | Correcoes tardias (>4h) exigem justificativa e aprovacao |
| T005 | Eventos de turno devem estar dentro do horario do turno (+/- 30min tolerancia) |

### 6.3 Segregacao de Acesso vs Reporte

```typescript
interface AccessVsReportPolicy {
  // Profissional de limpeza:
  // - PODE reportar: limpeza realizada, tempo, local, tipo, status
  // - NAO PODE acessar: diagnostico do paciente, prescricoes, evolucoes
  // O sistema mostra apenas: numero do leito, tipo de limpeza necessaria

  // Maqueiro:
  // - PODE reportar: transporte realizado, origem, destino, horarios
  // - NAO PODE acessar: motivo clinico do transporte, diagnostico
  // O sistema mostra apenas: origem, destino, prioridade, restricoes de transporte

  // Tecnico de manutencao:
  // - PODE reportar: reparo realizado, equipamento, tempo, status
  // - NAO PODE acessar: dados de paciente algum
  // O sistema mostra apenas: local, equipamento, tipo de manutencao

  // Enfermeiro:
  // - PODE reportar E acessar: dados clinicos do paciente sob seus cuidados
  // - NAO PODE acessar: pacientes de outras unidades sem justificativa
}
```

---

## 7. Integracao com FHIR R4

### 7.1 Mapeamento de Recursos

| WorkEvent Campo | FHIR Recurso | FHIR Campo |
|---|---|---|
| event_id | Provenance.id | identifier |
| actor_id | Provenance.agent | who |
| timestamp | Provenance.occurredDateTime | occurredDateTime |
| action_performed | Provenance.activity | coding |
| patient_id | Provenance.target | reference(Patient) |
| encounter_id | Provenance.target | reference(Encounter) |
| category | AuditEvent.type | coding |
| event_type | AuditEvent.subtype | coding |
| actor_id | AuditEvent.agent | who |
| location_id | AuditEvent.source | site |

### 7.2 FHIR Task para Atividades Pendentes

```json
{
  "resourceType": "Task",
  "status": "in-progress",
  "intent": "order",
  "code": {
    "coding": [{
      "system": "https://velya.health/fhir/CodeSystem/work-event-type",
      "code": "limpeza_terminal",
      "display": "Limpeza Terminal"
    }]
  },
  "for": {
    "reference": "Location/leito-201-ala-b"
  },
  "requester": {
    "reference": "Practitioner/enf-maria-silva"
  },
  "owner": {
    "reference": "Practitioner/hig-joao-santos"
  },
  "restriction": {
    "period": {
      "end": "2026-04-08T15:00:00-03:00"
    }
  },
  "input": [{
    "type": {
      "text": "sla_target_minutes"
    },
    "valueInteger": 60
  }]
}
```

---

## 8. Metricas e Observabilidade

### 8.1 Prometheus Metrics

```yaml
metrics:
  - name: velya_work_events_total
    type: counter
    labels: [category, event_type, department, delivery_status]
    help: "Total de eventos de trabalho registrados"

  - name: velya_work_event_duration_minutes
    type: histogram
    labels: [category, event_type, department]
    buckets: [5, 10, 15, 30, 45, 60, 90, 120, 180, 240, 480]
    help: "Duracao dos eventos de trabalho em minutos"

  - name: velya_work_event_sla_compliance
    type: gauge
    labels: [category, department]
    help: "Taxa de conformidade SLA por categoria e departamento"

  - name: velya_work_event_pending_count
    type: gauge
    labels: [category, department, priority]
    help: "Contagem de eventos pendentes"

  - name: velya_work_event_handoff_acceptance_seconds
    type: histogram
    labels: [from_department, to_department]
    buckets: [60, 120, 300, 600, 900, 1800, 3600]
    help: "Tempo ate aceite de handoff em segundos"

  - name: velya_work_event_gap_detected_total
    type: counter
    labels: [gap_type, department, severity]
    help: "Total de gaps detectados"
```

---

## 9. Resumo Executivo

O Velya Workforce Reporting Model estabelece que:

1. **Todo trabalho e reportado** — sem excecao de area, funcao ou nivel hierarquico.
2. **Reportar nao e acessar** — o reporte de trabalho nao concede acesso a dados clinicos.
3. **Cada evento e rastreavel** — provenance, audit trail, versionamento.
4. **SLAs sao mensurados** — cada categoria tem expectativas de tempo claras.
5. **Handoffs sao explicitos** — sem aceite, a pendencia fica visivel.
6. **Gaps sao detectados** — atividade sem reporte, reporte sem aceite, chamado sem resposta.
7. **Correcoes sao versionadas** — nunca se apaga, sempre se corrige com justificativa.
8. **A taxonomia e padronizada** — 16 categorias, subcategorias por area, eventos tipados.

Este documento e a base para todos os demais documentos do modulo Workforce.
