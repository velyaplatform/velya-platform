# Modelo Institucional de Accountability Hospitalar

> Velya como memoria institucional: quem fez o que, quando, onde, por que, com qual resultado, para quem passou e quem aceitou.

## 1. Mandato Central

Velya e a **memoria institucional** do hospital. Cada acao realizada por qualquer profissional — clinica, operacional ou administrativa — e registrada como um evento imutavel no Work Event Ledger. Nao existem acoes sem autoria, sem timestamp, sem contexto.

### 1.1 Por Que Accountability Institucional?

| Problema                                  | Impacto sem Velya                      | Solucao com Velya                                |
| ----------------------------------------- | -------------------------------------- | ------------------------------------------------ |
| "Quem pediu esse exame?"                  | Busca em papeis, ligacoes, incerteza   | Evento rastreavel com autoria digital            |
| "Quem estava cuidando do paciente as 3h?" | Escalas em papel, memoria humana       | Cadeia de custodia com handoffs explicitos       |
| "Por que esse medicamento foi omitido?"   | Sem registro ou justificativa          | Evento de omissao com justificativa obrigatoria  |
| "Quem viu esse resultado critico?"        | Incerteza, responsabilizacao pos-facto | AuditEvent de leitura + Communication registrada |
| "O que aconteceu entre 14h e 16h?"        | Reconstituicao impossivel              | Timeline completa do paciente derivada do ledger |

### 1.2 Principios Fundamentais

1. **Toda acao tem autor**: Nenhum evento no ledger e anonimo. Usuario generico/sistema so em integracao tecnica, com identificacao do sistema de origem.
2. **Toda acao tem contexto**: Cada evento registra o encontro (Encounter), o paciente, a unidade, o turno e o motivo.
3. **Toda acao tem resultado**: O desfecho (sucesso, falha, parcial, cancelamento) e registrado.
4. **Toda transferencia tem aceite**: Handoffs requerem aceite explicito do receptor (ver `handoff-acceptance-standard.md`).
5. **O ledger e imutavel**: Eventos sao append-only. Correcoes geram novos eventos que referenciam os originais.
6. **A projecao e derivada**: O estado atual (Digital Twin) e calculado a partir do ledger, nunca inserido diretamente.

---

## 2. Work Event Ledger

### 2.1 O Que e o Ledger

O Work Event Ledger e o registro append-only e imutavel de todos os eventos de trabalho no hospital. Cada entrada segue uma estrutura padronizada que responde a cadeia completa de accountability.

### 2.2 A Cadeia de Accountability

Cada evento responde obrigatoriamente a 8 perguntas:

```
┌──────────────────────────────────────────────────────────────┐
│                   CADEIA DE ACCOUNTABILITY                    │
│                                                              │
│  QUEM?     → Autor identificado (Practitioner + credencial)  │
│  O QUE?    → Acao realizada (tipo de evento + detalhes)      │
│  QUANDO?   → Timestamp preciso (NTP sincronizado)            │
│  ONDE?     → Local fisico e logico (unidade, leito, sistema) │
│  POR QUE?  → Contexto clinico/operacional (ordem, protocolo) │
│  RESULTADO → Desfecho da acao (sucesso, falha, parcial)      │
│  HANDOFF   → Para quem foi transferida a responsabilidade?   │
│  ACEITE    → O receptor confirmou recebimento?               │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 Mapeamento FHIR

O Ledger se materializa atraves de recursos FHIR interconectados:

| Pergunta  | Recurso FHIR                                       | Campo                                                   |
| --------- | -------------------------------------------------- | ------------------------------------------------------- |
| QUEM      | Provenance                                         | agent.who                                               |
| O QUE     | Task / Procedure / MedicationAdministration / etc. | code, description                                       |
| QUANDO    | Todos                                              | recorded, period, occurrence                            |
| ONDE      | Encounter                                          | location; Task.location                                 |
| POR QUE   | Task                                               | basedOn (referencia a ServiceRequest/MedicationRequest) |
| RESULTADO | Task                                               | output, outcome; Procedure.outcome                      |
| HANDOFF   | Task (handoff)                                     | owner (de/para)                                         |
| ACEITE    | Task (handoff)                                     | status (accepted/rejected), statusReason                |

---

## 3. Interface TypeScript: WorkAccountabilityEvent

```typescript
/**
 * Evento unitario de trabalho no Work Event Ledger.
 * Representa qualquer acao realizada por qualquer profissional.
 * Imutavel apos criacao — correcoes geram novos eventos.
 */
export interface WorkAccountabilityEvent {
  // --- Identificacao do Evento ---
  /** ID unico (UUID v7 — ordenavel por tempo) */
  eventId: string;
  /** Versao do schema do evento */
  schemaVersion: string;
  /** Hash SHA-256 do evento (para integridade) */
  eventHash: string;
  /** Hash do evento anterior na cadeia (para sequenciamento) */
  previousEventHash: string;
  /** Timestamp de criacao (NTP sincronizado, microsegundos) */
  recordedAt: ISO8601DateTime;
  /** Numero de sequencia global */
  sequenceNumber: number;

  // --- QUEM ---
  who: EventActor;

  // --- O QUE ---
  what: EventAction;

  // --- QUANDO ---
  when: EventTiming;

  // --- ONDE ---
  where: EventLocation;

  // --- POR QUE ---
  why: EventReason;

  // --- RESULTADO ---
  outcome: EventOutcome;

  // --- HANDOFF ---
  handoff: EventHandoff | null;

  // --- ACEITE ---
  acceptance: EventAcceptance | null;

  // --- Metadados ---
  metadata: EventMetadata;
}

// --- Sub-interfaces ---

export interface EventActor {
  /** Referencia FHIR ao Practitioner */
  practitionerReference: FHIRReference<'Practitioner'>;
  /** Nome para exibicao */
  displayName: string;
  /** Papel no momento da acao */
  role: string;
  /** Credencial profissional (CRM, COREN, CRF, etc.) */
  credential: ProfessionalCredential;
  /** Identificacao do dispositivo/estacao usado */
  device: DeviceIdentification;
  /** Se agiu em nome de outro (ex: ordem verbal) */
  onBehalfOf?: FHIRReference<'Practitioner'>;
  /** Se agiu sob supervisao */
  supervisor?: FHIRReference<'Practitioner'>;
}

export interface ProfessionalCredential {
  /** Tipo (CRM, COREN, CRF, CREFITO, CRN, etc.) */
  type: string;
  /** Numero */
  number: string;
  /** UF */
  state: string;
  /** Status no momento da acao (ativo, suspenso) */
  status: 'active' | 'suspended' | 'unknown';
}

export interface DeviceIdentification {
  /** ID do dispositivo */
  deviceId: string;
  /** Tipo (workstation, mobile, tablet, badge_reader) */
  type: string;
  /** Localizacao fisica do dispositivo */
  physicalLocation: string;
  /** IP */
  ipAddress: string;
}

export interface EventAction {
  /** Tipo de evento (padronizado) */
  eventType: WorkEventType;
  /** Subtipo */
  eventSubtype: string;
  /** Codigo FHIR do ato */
  code: FHIRCoding;
  /** Descricao legivel */
  description: string;
  /** Recurso FHIR principal gerado/afetado */
  primaryResource: FHIRReference<string>;
  /** Recursos FHIR secundarios envolvidos */
  relatedResources: FHIRReference<string>[];
  /** Categoria */
  category: 'clinical' | 'operational' | 'administrative' | 'communication' | 'documentation';
  /** Dados estruturados especificos do tipo de evento */
  structuredData: Record<string, unknown>;
}

export type WorkEventType =
  // Clinicos
  | 'medication.prescribed'
  | 'medication.dispensed'
  | 'medication.administered'
  | 'medication.omitted'
  | 'medication.refused'
  | 'order.created'
  | 'order.cancelled'
  | 'order.modified'
  | 'procedure.started'
  | 'procedure.completed'
  | 'procedure.cancelled'
  | 'assessment.performed'
  | 'assessment.pain'
  | 'assessment.vitals'
  | 'assessment.fall_risk'
  | 'assessment.skin_integrity'
  | 'result.reported'
  | 'result.critical'
  | 'result.acknowledged'
  | 'diagnosis.established'
  | 'diagnosis.updated'
  // Operacionais
  | 'handoff.requested'
  | 'handoff.accepted'
  | 'handoff.rejected'
  | 'handoff.escalated'
  | 'shift.started'
  | 'shift.ended'
  | 'transport.requested'
  | 'transport.started'
  | 'transport.completed'
  | 'bed.assigned'
  | 'bed.transferred'
  | 'call.triggered'
  | 'call.responded'
  | 'call.resolved'
  // Documentacao
  | 'document.created'
  | 'document.signed'
  | 'document.amended'
  | 'consent.obtained'
  | 'consent.revoked'
  // Comunicacao
  | 'communication.sent'
  | 'communication.received'
  | 'communication.acknowledged'
  // Acesso
  | 'access.granted'
  | 'access.denied'
  | 'access.break_glass'
  | 'access.export';

export interface EventTiming {
  /** Quando o evento foi registrado no sistema */
  recorded: ISO8601DateTime;
  /** Quando o evento realmente ocorreu (pode diferir se registro retroativo) */
  occurred: ISO8601DateTime;
  /** Se registro retroativo: justificativa */
  retroactiveJustification?: string;
  /** Duracao da acao (se aplicavel) */
  duration?: ISO8601Duration;
  /** Diferenca entre occurred e recorded (para deteccao de retroativos) */
  registrationDelaySeconds: number;
}

export interface EventLocation {
  /** Unidade */
  unit: string;
  /** Leito (se aplicavel) */
  bed?: string;
  /** Andar */
  floor?: number;
  /** Ala */
  wing?: string;
  /** Sistema de origem */
  sourceSystem: string;
  /** Referencia ao Encounter */
  encounterReference: FHIRReference<'Encounter'>;
  /** Referencia ao Patient */
  patientReference: FHIRReference<'Patient'>;
}

export interface EventReason {
  /** Ordem/solicitacao que originou a acao (se houver) */
  basedOn?: FHIRReference<'ServiceRequest' | 'MedicationRequest' | 'Task'>;
  /** Protocolo/guideline seguido (se aplicavel) */
  protocol?: string;
  /** Indicacao clinica */
  clinicalIndication?: string;
  /** Justificativa textual (obrigatoria para cancelamentos, omissoes, desvios) */
  justification?: string;
  /** Codigo de motivo padronizado */
  reasonCode?: FHIRCoding;
}

export interface EventOutcome {
  /** Status do desfecho */
  status: 'completed' | 'partial' | 'failed' | 'cancelled' | 'refused' | 'deferred';
  /** Descricao do resultado */
  description: string;
  /** Se houve desvio do esperado */
  deviation: boolean;
  /** Descricao do desvio */
  deviationDescription?: string;
  /** Se gerou evento de seguranca */
  safetyEvent: boolean;
  /** Classificacao do evento de seguranca */
  safetyEventClassification?: 'near_miss' | 'no_harm' | 'mild' | 'moderate' | 'severe' | 'death';
  /** Dados de resultado especificos */
  resultData?: Record<string, unknown>;
}

export interface EventHandoff {
  /** De quem */
  from: FHIRReference<'Practitioner'>;
  /** Para quem */
  to: FHIRReference<'Practitioner'>;
  /** Tipo de handoff */
  type: 'shift_change' | 'break_coverage' | 'transfer' | 'escalation' | 'task_delegation';
  /** Prioridade */
  priority: 'critical' | 'urgent' | 'routine';
  /** Formato estruturado do handoff (I-PASS, SBAR) */
  format: 'ipass' | 'sbar' | 'structured' | 'freetext';
  /** Conteudo do handoff */
  content: HandoffContent;
  /** Timeout para aceite */
  acceptanceTimeoutMinutes: number;
  /** Task FHIR referente ao handoff */
  taskReference: FHIRReference<'Task'>;
}

export interface HandoffContent {
  /** I-PASS: Illness severity */
  illnessSeverity?: string;
  /** I-PASS: Patient summary */
  patientSummary?: string;
  /** I-PASS: Action list */
  actionList?: string[];
  /** I-PASS: Situation awareness */
  situationAwareness?: string;
  /** I-PASS: Synthesis */
  synthesis?: string;
  /** SBAR: Situation */
  situation?: string;
  /** SBAR: Background */
  background?: string;
  /** SBAR: Assessment */
  assessment?: string;
  /** SBAR: Recommendation */
  recommendation?: string;
  /** Pendencias transferidas */
  pendingItems?: string[];
  /** Riscos conhecidos */
  knownRisks?: string[];
}

export interface EventAcceptance {
  /** Status do aceite */
  status: 'accepted' | 'rejected' | 'pending' | 'timeout' | 'escalated';
  /** Quem aceitou/rejeitou */
  respondedBy?: FHIRReference<'Practitioner'>;
  /** Quando */
  respondedAt?: ISO8601DateTime;
  /** Justificativa de rejeicao (obrigatoria se rejeitado) */
  rejectionReason?: string;
  /** Tempo ate a resposta (em segundos) */
  responseTimeSeconds?: number;
  /** Se houve escalacao */
  escalated: boolean;
  /** Para quem foi escalado */
  escalatedTo?: FHIRReference<'Practitioner'>;
}

export interface EventMetadata {
  /** Versao do sistema que gerou o evento */
  systemVersion: string;
  /** Tenant/hospital (para multi-tenant) */
  tenantId: string;
  /** Tags para busca/filtragem */
  tags: string[];
  /** Se o evento foi gerado por automacao (ex: regra de gap detection) */
  automated: boolean;
  /** Referencia a evento corrigido (se este evento e uma correcao) */
  corrects?: string;
  /** Referencia a evento que anula (se este evento anula outro) */
  voids?: string;
  /** Integracao de origem (se veio de sistema externo) */
  sourceIntegration?: string;
}

// --- Tipos auxiliares ---
type ISO8601DateTime = string;
type ISO8601Duration = string;

interface FHIRReference<T extends string> {
  reference: `${T}/${string}`;
  display?: string;
}

interface FHIRCoding {
  system: string;
  code: string;
  display: string;
}
```

---

## 4. Taxonomia de Eventos

### 4.1 Categorias

| Categoria        | Exemplos                                                           | Volume Estimado |
| ---------------- | ------------------------------------------------------------------ | --------------- |
| **Clinicos**     | Prescricoes, administracoes, avaliacoes, procedimentos, resultados | ~60%            |
| **Operacionais** | Handoffs, turnos, transportes, leitos, chamadas                    | ~20%            |
| **Documentacao** | Evolucoes, laudos, consentimentos, assinaturas                     | ~10%            |
| **Comunicacao**  | Notificacoes, acionamentos, respostas                              | ~7%             |
| **Acesso**       | Leituras de prontuario, exportacoes, break-glass                   | ~3%             |

### 4.2 Eventos Criticos (Requerem Resposta Imediata)

| Evento                                     | SLA de Resposta                  | Escalacao            |
| ------------------------------------------ | -------------------------------- | -------------------- |
| `result.critical`                          | 15 min (leitura) + 60 min (acao) | Automatica           |
| `handoff.requested` com prioridade critica | 5 min (aceite)                   | Automatica           |
| `call.triggered` tipo emergencia           | 1 min                            | Automatica           |
| `assessment.vitals` com NEWS2 >= 7         | 15 min (medico)                  | Automatica           |
| `access.break_glass`                       | 24h (revisao)                    | Notificacao imediata |

### 4.3 Eventos que Requerem Justificativa

| Evento                | Justificativa                                                  |
| --------------------- | -------------------------------------------------------------- |
| `medication.omitted`  | Motivo da omissao (recusa, contraindicacao, indisponibilidade) |
| `medication.refused`  | Registro da recusa com tentativa de orientacao                 |
| `order.cancelled`     | Motivo do cancelamento                                         |
| `procedure.cancelled` | Motivo do cancelamento                                         |
| `handoff.rejected`    | Motivo da rejeicao                                             |
| `document.amended`    | O que mudou e por que                                          |
| `access.break_glass`  | Justificativa clinica                                          |

---

## 5. Imutabilidade e Correcoes

### 5.1 Principio

Eventos nunca sao editados ou deletados. Correcoes sao implementadas como novos eventos que referenciam os originais.

### 5.2 Tipos de Correcao

| Tipo          | Descricao                             | Implementacao                                          |
| ------------- | ------------------------------------- | ------------------------------------------------------ |
| **Amendment** | Complemento ou correcao de informacao | Novo evento com `metadata.corrects = eventId_original` |
| **Void**      | Anulacao de evento erroneo            | Novo evento com `metadata.voids = eventId_original`    |
| **Supersede** | Substituicao completa                 | Novo evento com `metadata.corrects` + dados completos  |

### 5.3 Regras de Correcao

1. Correcoes em ate 2 horas: registradas pelo proprio autor.
2. Correcoes entre 2h e 24h: requerem justificativa + ciencia do coordenador.
3. Correcoes apos 24h: requerem justificativa + aprovacao do coordenador + registro em comissao.
4. Anulacoes (void): sempre requerem aprovacao do coordenador + justificativa detalhada.
5. Todas as correcoes sao visiveis na auditoria — o evento original permanece no ledger.

---

## 6. Armazenamento e Retencao

### 6.1 Infraestrutura

```
┌─────────────────────────────────────────────────────────────┐
│                    Kafka Topics                              │
│  work.events.v1 (particao por patient_id)                   │
│  Retencao: 30 dias                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
┌──────────────────┐     ┌──────────────────┐
│   PostgreSQL     │     │   Object Store   │
│   (Hot: 1 ano)   │     │   (Cold: 20 anos)│
│   Indexes por:   │     │   Parquet format │
│   - patient_id   │     │   Particao por:  │
│   - event_type   │     │   - ano/mes      │
│   - recorded_at  │     │   - tenant_id    │
│   - actor        │     │                  │
└──────────────────┘     └──────────────────┘
```

### 6.2 Retencao

| Categoria                   | Hot (PostgreSQL) | Cold (Object Store) | Total                   |
| --------------------------- | ---------------- | ------------------- | ----------------------- |
| Eventos clinicos            | 1 ano            | 19 anos             | 20 anos (CFM 1821/2007) |
| Eventos operacionais        | 1 ano            | 4 anos              | 5 anos                  |
| Eventos de acesso/auditoria | 1 ano            | 19 anos             | 20 anos                 |
| Eventos administrativos     | 1 ano            | 4 anos              | 5 anos                  |

---

## 7. Consultas ao Ledger

### 7.1 API

```
GET  /api/v1/ledger/events?patient_id={id}&from={ts}&to={ts}&type={type}
GET  /api/v1/ledger/events/{eventId}
GET  /api/v1/ledger/events/{eventId}/provenance
GET  /api/v1/ledger/events/{eventId}/corrections
GET  /api/v1/ledger/chain/{patientId}?from={ts}&to={ts}  # cadeia completa
GET  /api/v1/ledger/actor/{practitionerId}/events?from={ts}&to={ts}
GET  /api/v1/ledger/integrity/verify?from={ts}&to={ts}  # verificacao de integridade
```

### 7.2 Exemplos de Consultas

**Reconstituir o que aconteceu com paciente X entre 14h e 16h**:

```sql
SELECT e.recorded_at, e.event_type, e.who_display_name, e.what_description,
       e.outcome_status, e.where_unit, e.where_bed
FROM work_events e
WHERE e.patient_id = :patient_id
  AND e.recorded_at BETWEEN '2026-04-09 14:00:00' AND '2026-04-09 16:00:00'
ORDER BY e.recorded_at ASC;
```

**Quem estava responsavel pelo paciente Y as 3h da manha?**:

```sql
SELECT h.who_display_name AS responsavel,
       h.recorded_at AS inicio_responsabilidade,
       COALESCE(next_h.recorded_at, NOW()) AS fim_responsabilidade
FROM work_events h
LEFT JOIN LATERAL (
  SELECT recorded_at FROM work_events
  WHERE patient_id = h.patient_id
    AND event_type = 'handoff.accepted'
    AND recorded_at > h.recorded_at
  ORDER BY recorded_at ASC LIMIT 1
) next_h ON true
WHERE h.patient_id = :patient_id
  AND h.event_type = 'handoff.accepted'
  AND h.recorded_at <= '2026-04-09 03:00:00'
ORDER BY h.recorded_at DESC
LIMIT 1;
```

**Todas as omissoes de medicamento sem justificativa no ultimo mes**:

```sql
SELECT e.patient_id, e.recorded_at, e.who_display_name,
       e.what_description, e.why_justification
FROM work_events e
WHERE e.event_type = 'medication.omitted'
  AND e.recorded_at > NOW() - INTERVAL '30 days'
  AND (e.why_justification IS NULL OR e.why_justification = '')
ORDER BY e.recorded_at DESC;
```

---

## 8. Indicadores de Accountability

### 8.1 KPIs Institucionais

| Indicador                    | Meta             | Formula                                                                   | Frequencia |
| ---------------------------- | ---------------- | ------------------------------------------------------------------------- | ---------- |
| **Completude de autoria**    | > 99.9%          | Eventos com autor valido / Total de eventos                               | Diario     |
| **Handoffs com aceite**      | > 95%            | Handoffs aceitos / Handoffs solicitados                                   | Por turno  |
| **Registro retroativo**      | < 5%             | Eventos com delay > 2h / Total de eventos                                 | Semanal    |
| **Justificativas presentes** | 100%             | Eventos que requerem justificativa com justificativa / Total que requerem | Diario     |
| **Correcoes tardias**        | < 10%            | Correcoes > 24h / Total de correcoes                                      | Mensal     |
| **Gaps sem resolucao**       | < 5% alem do SLA | Gaps nao resolvidos alem do SLA / Total de gaps                           | Diario     |
| **Integridade do ledger**    | 100%             | Hash chain valida / Total de eventos                                      | Diario     |

### 8.2 Metricas PromQL

```promql
# Completude de autoria
1 - (
  sum(rate(velya_event_missing_author_total[24h]))
  / sum(rate(velya_event_recorded_total[24h]))
)

# Taxa de registro retroativo
sum(rate(velya_event_retroactive_total[7d]))
/ sum(rate(velya_event_recorded_total[7d]))

# Volume de eventos por categoria
sum by (category) (rate(velya_event_recorded_total[1h]))

# Latencia de registro (P95)
histogram_quantile(0.95, rate(velya_event_recording_delay_seconds_bucket[1h]))
```

---

## 9. Cultura de Accountability

### 9.1 Onboarding

Todo profissional novo recebe treinamento sobre:

1. O que e o Work Event Ledger e por que existe.
2. Como suas acoes sao registradas.
3. Importancia do handoff com aceite.
4. Como registrar justificativas.
5. Como solicitar correcoes.
6. Direitos e deveres em relacao a auditoria.

### 9.2 Feedback Positivo

Accountability nao e apenas punitiva. O sistema reconhece:

- Profissionais com 100% de handoffs aceitos no prazo.
- Unidades com menor taxa de gaps.
- Profissionais com documentacao consistente.
- Equipes com resolucao rapida de pendencias.

### 9.3 Principio de Nao-Punitivo

Erros registrados honestamente sao tratados como oportunidades de aprendizado. O sistema so penaliza:

- Omissao deliberada de registro.
- Falsificacao de autoria.
- Acesso indevido a dados.
- Recusa sistematica de handoff sem justificativa.

---

## 10. Relacionamento com Outros Modulos

| Modulo                        | Relacao                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| Digital Twin                  | Projecao read-only do ledger para estado atual do paciente |
| Gap Detection                 | Monitora o ledger para detectar desvios                    |
| Handoff Acceptance            | Garante aceite explicito nos eventos de handoff            |
| Shift Ownership               | Define quem e responsavel por quais pacientes por turno    |
| Task/Communication/Provenance | Recursos FHIR que compoe os eventos do ledger              |
| Audit Dashboards              | Visualizacao dos dados do ledger                           |
| Security & Access             | Controle de quem pode ler/escrever no ledger               |
