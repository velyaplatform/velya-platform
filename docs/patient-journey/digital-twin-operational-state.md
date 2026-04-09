# Digital Twin: Estado Operacional do Paciente

> Projecao em tempo real do estado operacional dinamico do paciente internado, derivada do Event Ledger.

## 1. Visao Geral

O Digital Twin Operacional e a representacao computacional viva do estado corrente de cada paciente dentro do hospital. Diferente de um prontuario eletronico tradicional que registra fatos passados, o Digital Twin projeta o **estado presente** e as **proximas acoes esperadas**, detectando desvios, atrasos e riscos em tempo real.

Cada campo do estado operacional e derivado de eventos do Work Event Ledger (ver `hospital-wide-accountability-model.md`). Nenhum dado e inserido manualmente no twin — ele e uma **projecao read-only** do ledger, recalculada a cada novo evento.

---

## 2. Arquitetura de Projecao

```
┌─────────────────────────────────────────────────────────────┐
│                    Work Event Ledger                        │
│  (append-only, imutavel, FHIR-based)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Event Projection Engine                        │
│  - Consome eventos em ordem cronologica                     │
│  - Aplica regras de projecao por tipo de evento             │
│  - Emite PatientOperationalState atualizado                 │
│  - Publica em topico Kafka patient.operational.state        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           PatientOperationalState Store                     │
│  - Redis (cache quente, TTL = duracao do encontro + 24h)    │
│  - PostgreSQL (persistencia, historico de snapshots)         │
│  - Exposicao via API REST + WebSocket                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Principios de Projecao

| Principio | Descricao |
|---|---|
| **Derivacao pura** | Todo campo e calculado a partir de eventos. Nenhuma entrada manual. |
| **Idempotencia** | Reprojetar os mesmos eventos produz o mesmo estado. |
| **Ordenacao causal** | Eventos sao processados na ordem causal (timestamp + causal links). |
| **Snapshot + replay** | Snapshots periodicos (15min) + replay incremental para reconstrucao. |
| **Versionamento** | Cada projecao carrega `projectionVersion` para compatibilidade. |

---

## 3. Interface TypeScript: PatientOperationalState

```typescript
/**
 * Estado operacional completo do paciente internado.
 * Projecao read-only derivada do Work Event Ledger.
 * Atualizado a cada novo evento relevante.
 */
export interface PatientOperationalState {
  // --- Identificacao ---
  /** ID unico do estado operacional (UUID v7, ordenavel por tempo) */
  stateId: string;
  /** Referencia FHIR ao Patient */
  patientReference: FHIRReference<'Patient'>;
  /** Referencia FHIR ao Encounter ativo */
  encounterReference: FHIRReference<'Encounter'>;
  /** Timestamp da ultima atualizacao deste estado */
  lastUpdated: ISO8601DateTime;
  /** Versao do schema de projecao */
  projectionVersion: string;
  /** Hash do ultimo evento processado */
  lastEventHash: string;

  // --- Localizacao Atual ---
  currentLocation: PatientLocation;

  // --- Plano Atual ---
  currentPlan: CurrentCarePlan;

  // --- Prioridades ---
  priorities: OperationalPriority[];

  // --- Pendencias ---
  pendingItems: PendingItem[];

  // --- Risco Operacional ---
  operationalRisk: OperationalRiskAssessment;

  // --- Chamadas Recentes ---
  recentCalls: RecentCall[];

  // --- Dor ---
  painStatus: PainStatus;

  // --- Proximos Passos ---
  nextSteps: ScheduledStep[];

  // --- Sinais de Atraso/Abandono ---
  delaySignals: DelaySignal[];

  // --- Risco de Deterioracao ---
  deteriorationRisk: DeteriorationRisk;

  // --- Completude de Documentacao ---
  documentationCompleteness: DocumentationCompleteness;

  // --- Equipe Atual ---
  currentCareTeam: CareTeamSnapshot;

  // --- Metadados de Projecao ---
  projectionMetadata: ProjectionMetadata;
}

// --- Sub-interfaces ---

export interface PatientLocation {
  /** Unidade atual (ex: UTI-A, Enfermaria 4B) */
  unit: string;
  /** Leito atual */
  bed: string;
  /** Andar */
  floor: number;
  /** Ala */
  wing: string;
  /** Status de presenca no leito */
  presenceStatus: 'present' | 'temporarily_away' | 'in_procedure' | 'in_exam' | 'in_transfer';
  /** Destino temporario se ausente */
  temporaryDestination?: string;
  /** Timestamp da ultima deteccao de presenca */
  lastPresenceCheck: ISO8601DateTime;
  /** Historico de movimentacao (ultimas 24h) */
  recentMovements: LocationMovement[];
}

export interface LocationMovement {
  from: string;
  to: string;
  timestamp: ISO8601DateTime;
  reason: string;
  authorizedBy: FHIRReference<'Practitioner'>;
  transportType: 'walking' | 'wheelchair' | 'stretcher' | 'bed';
}

export interface CurrentCarePlan {
  /** Referencia ao CarePlan FHIR ativo */
  carePlanReference: FHIRReference<'CarePlan'>;
  /** Resumo textual do plano vigente */
  summary: string;
  /** Fase atual do plano (ex: pos-operatorio D2, quimio ciclo 3) */
  currentPhase: string;
  /** Dieta prescrita */
  diet: DietOrder;
  /** Mobilidade autorizada */
  mobilityLevel: 'bed_rest' | 'bed_rest_with_movement' | 'chair' | 'ambulation_assisted' | 'ambulation_independent';
  /** Isolamento */
  isolationStatus: IsolationStatus;
  /** Dispositivos atuais (drenos, cateteres, monitores) */
  activeDevices: ActiveDevice[];
  /** Objetivos de alta (criterios e status de cada um) */
  dischargeObjectives: DischargeObjective[];
}

export interface DietOrder {
  type: string;
  restrictions: string[];
  lastMealTime: ISO8601DateTime | null;
  nextMealTime: ISO8601DateTime | null;
  jejumSince: ISO8601DateTime | null;
  status: 'active' | 'suspended' | 'npo';
}

export interface IsolationStatus {
  isolated: boolean;
  type?: 'contact' | 'droplet' | 'airborne' | 'combined';
  reason?: string;
  since?: ISO8601DateTime;
  epiRequired?: string[];
}

export interface ActiveDevice {
  type: string;
  location: string;
  insertionDate: ISO8601DateTime;
  daysInPlace: number;
  nextAssessmentDue: ISO8601DateTime;
  riskLevel: 'low' | 'moderate' | 'high';
}

export interface DischargeObjective {
  description: string;
  status: 'not_started' | 'in_progress' | 'met' | 'blocked';
  targetDate: ISO8601DateTime | null;
  blockingReason?: string;
}

export interface OperationalPriority {
  /** Identificador unico da prioridade */
  id: string;
  /** Descricao */
  description: string;
  /** Nivel */
  level: 'critical' | 'high' | 'medium' | 'low';
  /** Origem (qual evento gerou) */
  sourceEventId: string;
  /** Tempo limite para resolucao */
  deadline: ISO8601DateTime | null;
  /** Status */
  status: 'active' | 'addressed' | 'escalated' | 'expired';
  /** Responsavel designado */
  assignedTo: FHIRReference<'Practitioner'> | null;
}

export interface PendingItem {
  id: string;
  type: 'order' | 'result' | 'signature' | 'handoff' | 'assessment' | 'documentation' | 'communication' | 'consent' | 'procedure_scheduling';
  description: string;
  createdAt: ISO8601DateTime;
  /** Tempo em espera (calculado) */
  waitingTimeMinutes: number;
  /** SLA aplicavel */
  slaMinutes: number | null;
  /** Percentual do SLA consumido */
  slaPercentUsed: number | null;
  /** Indicador de SLA violado */
  slaBreached: boolean;
  assignedTo: FHIRReference<'Practitioner'> | null;
  /** Evento de origem */
  sourceEventId: string;
  /** Prioridade herdada */
  priority: 'stat' | 'urgent' | 'routine';
}

export interface OperationalRiskAssessment {
  /** Score composto de risco operacional (0-100) */
  compositeScore: number;
  /** Classificacao */
  classification: 'low' | 'moderate' | 'high' | 'critical';
  /** Fatores contribuintes */
  factors: RiskFactor[];
  /** Tendencia nas ultimas 6h */
  trend: 'improving' | 'stable' | 'worsening';
  /** Ultima atualizacao do calculo */
  calculatedAt: ISO8601DateTime;
}

export interface RiskFactor {
  name: string;
  weight: number;
  currentValue: number;
  threshold: number;
  breached: boolean;
  description: string;
}

export interface RecentCall {
  id: string;
  type: 'nurse_call' | 'emergency_call' | 'comfort_call' | 'family_call' | 'medical_call';
  timestamp: ISO8601DateTime;
  responseTimeSeconds: number | null;
  respondedBy: FHIRReference<'Practitioner'> | null;
  status: 'active' | 'responded' | 'resolved' | 'cancelled';
  reason: string | null;
  /** Tempo desde o acionamento ate resolucao */
  resolutionTimeSeconds: number | null;
}

export interface PainStatus {
  /** Ultimo registro de dor */
  lastAssessment: PainAssessment | null;
  /** Tendencia (ultimas 24h) */
  trend: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
  /** Intervencao mais recente para dor */
  lastIntervention: PainIntervention | null;
  /** Proximo horario de reavaliacao obrigatoria */
  nextReassessmentDue: ISO8601DateTime | null;
  /** Flag: dor sem intervencao por mais de 30min */
  unaddressedPainAlert: boolean;
  /** Historico recente (ultimas 24h) */
  recentHistory: PainAssessment[];
}

export interface PainAssessment {
  timestamp: ISO8601DateTime;
  scale: 'NRS' | 'VAS' | 'Wong-Baker' | 'BPS' | 'CPOT' | 'NIPS';
  score: number;
  maxScore: number;
  location: string;
  character: string;
  assessedBy: FHIRReference<'Practitioner'>;
}

export interface PainIntervention {
  timestamp: ISO8601DateTime;
  type: 'pharmacological' | 'non_pharmacological' | 'combined';
  description: string;
  administeredBy: FHIRReference<'Practitioner'>;
  reassessmentScheduled: ISO8601DateTime;
}

export interface ScheduledStep {
  id: string;
  type: 'medication' | 'assessment' | 'procedure' | 'exam' | 'lab' | 'consultation' | 'therapy' | 'discharge_step';
  description: string;
  scheduledTime: ISO8601DateTime;
  /** Minutos ate o evento */
  minutesUntil: number;
  assignedTo: FHIRReference<'Practitioner'> | null;
  status: 'scheduled' | 'overdue' | 'in_progress';
  dependencies: string[];
}

export interface DelaySignal {
  id: string;
  type: 'order_delay' | 'result_delay' | 'procedure_delay' | 'handoff_delay' | 'response_delay' | 'discharge_delay' | 'documentation_delay' | 'consultation_delay';
  description: string;
  detectedAt: ISO8601DateTime;
  expectedTime: ISO8601DateTime;
  actualOrCurrentTime: ISO8601DateTime;
  delayMinutes: number;
  severity: 'warning' | 'critical';
  /** Indica possivel abandono de tarefa */
  possibleAbandonment: boolean;
  /** Acoes automaticas ja disparadas */
  automatedActionsTriggered: string[];
}

export interface DeteriorationRisk {
  /** Score NEWS2 ou equivalente */
  earlyWarningScore: number;
  /** Classificacao */
  classification: 'low' | 'low_medium' | 'medium' | 'high' | 'critical';
  /** Componentes do score */
  components: VitalSignComponent[];
  /** Tendencia nas ultimas 4h */
  trend: 'improving' | 'stable' | 'worsening';
  /** Ultima atualizacao */
  lastCalculated: ISO8601DateTime;
  /** Proximo registro de sinais vitais obrigatorio */
  nextVitalsdue: ISO8601DateTime;
  /** Alertas ativos de deterioracao */
  activeAlerts: DeteriorationAlert[];
}

export interface VitalSignComponent {
  name: string;
  value: number;
  unit: string;
  score: number;
  trend: 'up' | 'stable' | 'down';
  lastMeasured: ISO8601DateTime;
}

export interface DeteriorationAlert {
  type: string;
  message: string;
  triggeredAt: ISO8601DateTime;
  acknowledgedBy: FHIRReference<'Practitioner'> | null;
}

export interface DocumentationCompleteness {
  /** Percentual geral de completude */
  overallPercentage: number;
  /** Secoes obrigatorias e status */
  requiredSections: DocumentSection[];
  /** Assinaturas pendentes */
  pendingSignatures: PendingSignature[];
  /** Documentos com copy-forward detectado */
  copyForwardDetections: CopyForwardDetection[];
  /** Ultima verificacao de consistencia */
  lastConsistencyCheck: ISO8601DateTime;
  /** Inconsistencias encontradas */
  inconsistencies: DocumentInconsistency[];
}

export interface DocumentSection {
  name: string;
  status: 'complete' | 'incomplete' | 'missing' | 'expired';
  lastUpdated: ISO8601DateTime | null;
  updatedBy: FHIRReference<'Practitioner'> | null;
  expiresAt: ISO8601DateTime | null;
}

export interface PendingSignature {
  documentType: string;
  requiredFrom: FHIRReference<'Practitioner'>;
  requestedAt: ISO8601DateTime;
  deadline: ISO8601DateTime;
  overdue: boolean;
}

export interface CopyForwardDetection {
  documentType: string;
  similarityPercentage: number;
  sourceTimestamp: ISO8601DateTime;
  targetTimestamp: ISO8601DateTime;
  flaggedAt: ISO8601DateTime;
  reviewed: boolean;
}

export interface DocumentInconsistency {
  field: string;
  valueInDocA: string;
  documentA: string;
  valueInDocB: string;
  documentB: string;
  detectedAt: ISO8601DateTime;
  severity: 'warning' | 'critical';
}

export interface CareTeamSnapshot {
  /** Medico responsavel atual */
  attendingPhysician: FHIRReference<'Practitioner'>;
  /** Enfermeiro responsavel atual */
  primaryNurse: FHIRReference<'Practitioner'> | null;
  /** Tecnico de enfermagem */
  nursingTech: FHIRReference<'Practitioner'> | null;
  /** Especialistas consultados ativos */
  activeConsultants: ConsultantEntry[];
  /** Turno atual */
  currentShift: 'day' | 'evening' | 'night';
  /** Proximo handoff esperado */
  nextExpectedHandoff: ISO8601DateTime | null;
  /** Ultimo handoff realizado */
  lastHandoff: HandoffSummary | null;
}

export interface ConsultantEntry {
  practitioner: FHIRReference<'Practitioner'>;
  specialty: string;
  requestedAt: ISO8601DateTime;
  status: 'requested' | 'accepted' | 'seen' | 'follow_up' | 'discharged';
  lastNote: ISO8601DateTime | null;
}

export interface HandoffSummary {
  from: FHIRReference<'Practitioner'>;
  to: FHIRReference<'Practitioner'>;
  timestamp: ISO8601DateTime;
  type: 'shift_change' | 'break_coverage' | 'transfer' | 'escalation';
  accepted: boolean;
  acceptedAt: ISO8601DateTime | null;
  pendingItemsTransferred: number;
}

export interface ProjectionMetadata {
  /** Total de eventos processados para este paciente */
  totalEventsProcessed: number;
  /** Timestamp do primeiro evento */
  firstEventTimestamp: ISO8601DateTime;
  /** Timestamp do ultimo evento */
  lastEventTimestamp: ISO8601DateTime;
  /** Lag de projecao (ms entre evento e atualizacao do estado) */
  projectionLagMs: number;
  /** Ultimo snapshot salvo */
  lastSnapshotAt: ISO8601DateTime;
  /** Erros de projecao (se houver) */
  projectionErrors: ProjectionError[];
}

export interface ProjectionError {
  eventId: string;
  errorType: string;
  message: string;
  timestamp: ISO8601DateTime;
  resolved: boolean;
}

// --- Tipos auxiliares ---
type ISO8601DateTime = string;

interface FHIRReference<T extends string> {
  reference: `${T}/${string}`;
  display?: string;
}
```

---

## 4. Localizacao Atual

### 4.1 Fontes de Dados

| Fonte | Tipo de Evento | Frequencia |
|---|---|---|
| ADT (Admit-Discharge-Transfer) | `encounter.location.changed` | A cada movimentacao |
| RTLS (Real-Time Location System) | `location.presence.detected` | Continuo (beacons) |
| Registro manual de enfermagem | `location.manual.update` | Sob demanda |
| Sistema de transporte | `transport.started` / `transport.completed` | A cada transporte |

### 4.2 Regras de Projecao

1. O evento ADT e a fonte de verdade para unidade/leito oficial.
2. RTLS complementa com presenca fisica — se o paciente nao esta no leito, `presenceStatus` muda.
3. Se RTLS detecta o paciente em area de procedimento, status muda para `in_procedure`.
4. Movimentacoes geram historico em `recentMovements` (retencao de 24h no twin, permanente no ledger).
5. Se nao ha deteccao RTLS por mais de 30 minutos e o paciente nao esta em procedimento, gera alerta.

---

## 5. Plano Atual

O plano atual e derivado do `CarePlan` FHIR ativo mais recente, enriquecido com:

- **Dieta**: ultimo `NutritionOrder` ativo.
- **Mobilidade**: ultima `ServiceRequest` de fisioterapia ou ordem medica de mobilidade.
- **Isolamento**: ultimo `Flag` de tipo `isolation` ativo.
- **Dispositivos**: `Device` resources com status `active` vinculados ao encounter.
- **Objetivos de alta**: `Goal` resources vinculadas ao `CarePlan` com categoria `discharge`.

### 5.1 Atualizacao do Plano

O plano no twin e atualizado quando:
- Nova evolucao medica e registrada (`DocumentReference` tipo `progress-note`).
- Nova prescricao e emitida (`MedicationRequest`).
- Ordem de dieta e alterada (`NutritionOrder`).
- Flag de isolamento e criado/encerrado.
- Dispositivo e inserido/removido.
- Objetivo de alta e atualizado.

---

## 6. Prioridades e Pendencias

### 6.1 Hierarquia de Prioridades

| Nivel | Exemplos | SLA de Atencao |
|---|---|---|
| **Critical** | PCR, deterioracao aguda, resultado critico | Imediato |
| **High** | Dor >= 7, medicamento atrasado, handoff pendente > timeout | 15 minutos |
| **Medium** | Exame pendente, consulta solicitada, documentacao incompleta | 60 minutos |
| **Low** | Pendencia administrativa, educacao paciente | 4 horas |

### 6.2 Geracao Automatica de Pendencias

Pendencias sao criadas automaticamente quando:

1. **Ordem sem execucao**: `ServiceRequest` criada sem `Procedure` correspondente apos SLA.
2. **Resultado sem leitura**: `DiagnosticReport` com status `final` sem `AuditEvent` de visualizacao pelo medico responsavel.
3. **Medicamento proximo**: `MedicationAdministration` esperada em menos de 30 minutos.
4. **Handoff sem aceite**: `Task` de handoff com status `requested` apos timeout por prioridade.
5. **Assinatura pendente**: `DocumentReference` sem assinatura do responsavel.
6. **Consentimento ausente**: `Consent` obrigatorio nao localizado para procedimento agendado.

---

## 7. Risco Operacional

### 7.1 Calculo do Score Composto

O score de risco operacional (0-100) e calculado com base em fatores ponderados:

```typescript
function calculateOperationalRisk(state: PatientOperationalState): number {
  const factors: RiskFactor[] = [
    {
      name: 'pending_items_overdue',
      weight: 0.20,
      currentValue: state.pendingItems.filter(p => p.slaBreached).length,
      threshold: 2,
      breached: false,
      description: 'Pendencias com SLA violado'
    },
    {
      name: 'pain_unaddressed',
      weight: 0.15,
      currentValue: state.painStatus.unaddressedPainAlert ? 1 : 0,
      threshold: 1,
      breached: false,
      description: 'Dor sem intervencao'
    },
    {
      name: 'deterioration_score',
      weight: 0.25,
      currentValue: state.deteriorationRisk.earlyWarningScore,
      threshold: 5,
      breached: false,
      description: 'Score de deterioracao clinica'
    },
    {
      name: 'handoff_pending',
      weight: 0.15,
      currentValue: state.pendingItems
        .filter(p => p.type === 'handoff' && p.slaBreached).length,
      threshold: 1,
      breached: false,
      description: 'Handoff pendente com timeout'
    },
    {
      name: 'documentation_gaps',
      weight: 0.10,
      currentValue: 100 - state.documentationCompleteness.overallPercentage,
      threshold: 30,
      breached: false,
      description: 'Gaps de documentacao'
    },
    {
      name: 'delay_signals',
      weight: 0.15,
      currentValue: state.delaySignals.filter(d => d.severity === 'critical').length,
      threshold: 1,
      breached: false,
      description: 'Sinais de atraso critico'
    },
  ];

  let score = 0;
  for (const factor of factors) {
    factor.breached = factor.currentValue >= factor.threshold;
    const normalized = Math.min(factor.currentValue / factor.threshold, 2.0);
    score += normalized * factor.weight * 50;
  }
  return Math.min(Math.round(score), 100);
}
```

### 7.2 Classificacao

| Score | Classificacao | Acao |
|---|---|---|
| 0-25 | Low | Monitoramento padrao |
| 26-50 | Moderate | Revisao pelo enfermeiro em 30min |
| 51-75 | High | Notificacao ao medico responsavel |
| 76-100 | Critical | Escalacao imediata ao coordenador da unidade |

---

## 8. Chamadas Recentes e Dor

### 8.1 Chamadas

O twin mantém as ultimas 20 chamadas (ou ultimas 12h, o que for maior). Cada chamada e rastreada desde o acionamento ate a resolucao, incluindo:

- Tempo de resposta (meta: < 3min para chamada padrao, < 1min para emergencia).
- Quem respondeu.
- Motivo (se registrado).
- Tempo total de resolucao.

### 8.2 Correlacao Dor-Chamada

O sistema correlaciona automaticamente:
- Chamada seguida de registro de dor em janela de 15 minutos.
- Multiplas chamadas em curto periodo como possivel indicador de dor nao controlada.
- Dor >= 7 sem intervencao farmacologica em 30 minutos gera alerta `unaddressedPainAlert`.

---

## 9. Proximos Passos e Sinais de Atraso

### 9.1 Timeline Projetada

O twin projeta os proximos eventos esperados com base em:

- Prescricao medica (horarios de medicamentos).
- Agendamento de procedimentos/exames.
- Intervalos obrigatorios (sinais vitais a cada 4h, reavaliacao de dor).
- Criterios de alta pendentes.

### 9.2 Deteccao de Atraso

Sinais de atraso sao detectados quando:

| Tipo | Regra |
|---|---|
| `order_delay` | Ordem sem execucao apos SLA do tipo |
| `result_delay` | Exame coletado/realizado sem resultado apos SLA |
| `procedure_delay` | Procedimento agendado nao iniciado apos horario |
| `handoff_delay` | Handoff sem aceite apos timeout |
| `response_delay` | Chamada sem resposta apos 5 minutos |
| `discharge_delay` | Todos os criterios de alta atendidos mas sem alta efetiva |
| `documentation_delay` | Evolucao obrigatoria nao registrada no turno |
| `consultation_delay` | Interconsulta solicitada sem atendimento apos SLA |

### 9.3 Indicador de Abandono

O twin detecta possivel abandono de tarefa quando:
- Uma tarefa atribuida a um profissional nao tem nenhuma atualizacao por mais de 2x o SLA.
- Um profissional atribuido nao registra nenhum evento no sistema por mais de 2 horas durante turno ativo.
- Uma pendencia e reassignada mais de 3 vezes sem progresso.

---

## 10. Risco de Deterioracao

### 10.1 NEWS2 Automatizado

O twin calcula o NEWS2 (National Early Warning Score 2) a partir dos ultimos sinais vitais:

| Parametro | 3 | 2 | 1 | 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|---|---|
| Freq. Resp. | <=8 | | 9-11 | 12-20 | | 21-24 | >=25 |
| SpO2 (Esc 1) | <=91 | 92-93 | 94-95 | >=96 | | | |
| PA Sistolica | <=90 | 91-100 | 101-110 | 111-219 | | | >=220 |
| Freq. Cardiaca | <=40 | | 41-50 | 51-90 | 91-110 | 111-130 | >=131 |
| Consciencia | | | | Alerta | | | CVPU |
| Temperatura | <=35.0 | | 35.1-36.0 | 36.1-38.0 | 38.1-39.0 | >=39.1 | |

### 10.2 Acoes por Score

| Score NEWS2 | Classificacao | Acao Automatica |
|---|---|---|
| 0-4 | Low | Monitoramento de rotina |
| 5-6 ou 3 em parametro unico | Medium | Notifica enfermeiro lider |
| >= 7 | High | Notifica medico + enfermeiro lider + prepara time de resposta rapida |

---

## 11. Completude de Documentacao

### 11.1 Secoes Obrigatorias por Tipo de Encontro

| Secao | Internacao Clinica | Internacao Cirurgica | UTI |
|---|---|---|---|
| Anamnese de admissao | Obrigatorio | Obrigatorio | Obrigatorio |
| Exame fisico de admissao | Obrigatorio | Obrigatorio | Obrigatorio |
| Evolucao medica diaria | Obrigatorio | Obrigatorio | Obrigatorio (2x/dia) |
| Prescricao medica | Obrigatorio | Obrigatorio | Obrigatorio |
| Evolucao de enfermagem | Obrigatorio | Obrigatorio | Obrigatorio (por turno) |
| Nota cirurgica | N/A | Obrigatorio | Se aplicavel |
| Nota anestesica | N/A | Obrigatorio | Se aplicavel |
| Plano de alta | Obrigatorio (D1) | Obrigatorio (D1) | N/A |
| Resumo de alta | Na alta | Na alta | Na transferencia |
| Consentimentos | Por procedimento | Obrigatorio | Por procedimento |

### 11.2 Deteccao de Copy-Forward

O twin detecta copy-forward comparando:
- Similaridade textual (cosine similarity > 0.95) entre evolucoes consecutivas.
- Dados clinicos identicos em evolucoes de dias diferentes.
- Timestamps de exame fisico identicos em evolucoes de turnos diferentes.

Copy-forward detectado gera flag para revisao pelo coordenador medico.

---

## 12. API de Acesso

### 12.1 REST

```
GET  /api/v1/patients/{patientId}/operational-state
GET  /api/v1/patients/{patientId}/operational-state/history?from=&to=
GET  /api/v1/units/{unitId}/operational-states
GET  /api/v1/units/{unitId}/operational-states?risk=high,critical
```

### 12.2 WebSocket

```
WS   /ws/v1/patients/{patientId}/operational-state
WS   /ws/v1/units/{unitId}/operational-states
```

Eventos WebSocket:
- `state.updated` — estado atualizado (diff parcial).
- `priority.changed` — prioridade adicionada/alterada.
- `risk.escalated` — risco operacional escalou de nivel.
- `delay.detected` — novo sinal de atraso.
- `deterioration.alert` — alerta de deterioracao.

### 12.3 Controle de Acesso

O acesso ao Digital Twin segue as regras de RBAC+ABAC descritas em `security-and-access-for-patient-timeline.md`. Campos sensiveis sao mascarados conforme o papel do solicitante.

---

## 13. Performance e Escalabilidade

| Metrica | Meta | Monitoramento |
|---|---|---|
| Latencia de projecao (evento -> estado) | < 500ms P95 | `velya_twin_projection_lag_seconds` |
| Throughput de eventos | > 10.000 eventos/min | `velya_twin_events_processed_total` |
| Tamanho do estado por paciente | < 50KB | `velya_twin_state_size_bytes` |
| Tempo de reconstrucao via replay | < 30s para 30 dias | `velya_twin_replay_duration_seconds` |
| Disponibilidade do cache Redis | 99.9% | `velya_twin_cache_availability` |

### 13.1 PromQL para Monitoramento

```promql
# Lag medio de projecao
histogram_quantile(0.95, rate(velya_twin_projection_lag_seconds_bucket[5m]))

# Taxa de erros de projecao
rate(velya_twin_projection_errors_total[5m])

# Pacientes com risco operacional critico
velya_twin_operational_risk_score > 75

# Pendencias com SLA violado por unidade
sum by (unit) (velya_twin_pending_items_sla_breached)
```

---

## 14. Relacionamento com Outros Modulos

| Modulo | Relacao |
|---|---|
| Work Event Ledger | Fonte de todos os eventos (upstream) |
| Gap Detection Rules | Consome o twin para detectar gaps |
| Journey Audit Dashboards | Visualiza o twin em dashboards |
| Handoff Acceptance Standard | Twin reflete status de handoffs |
| Shift Ownership Model | Twin reflete dono atual do turno |
| Command Center | Agrega twins de todos os pacientes |

---

## 15. Consideracoes de Privacidade

- O Digital Twin contem dados sensiveis de saude (LGPD Art. 11).
- Acesso e restrito por papel + contexto do encontro.
- Toda consulta ao twin gera `AuditEvent` FHIR.
- Dados sao retidos no cache por duracao do encontro + 24h; no PostgreSQL conforme politica de retencao.
- Exportacao do twin requer autorizacao explicita e gera registro de exportacao.
