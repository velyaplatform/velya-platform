# Modelo de Execucao Duravel de Workflows

> Documento 10 - Layered Assurance + Self-Healing  
> Plataforma Velya - Sistema Hospitalar Inteligente  
> Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

A Velya utiliza Temporal como engine de execucao duravel para processos criticos hospitalares que exigem garantias de completude, compensacao em caso de falha, e rastreabilidade completa. Este documento define os workflows principais, seus diagramas de estado, logica de compensacao, e exemplos de implementacao.

---

## 2. Workflows Criticos da Velya

| Workflow                              | Criticidade | Duracao Tipica | Owner        |
| ------------------------------------- | ----------- | -------------- | ------------ |
| Discharge Orchestration Saga          | Critico     | 1h - 24h       | clinical-eng |
| Institutional Escalation              | Critico     | 15min - 4h     | clinical-eng |
| Multi-Step Correction                 | Alto        | 30min - 2h     | clinical-eng |
| Agent Promotion/Quarantine/Retirement | Alto        | 5min - 1h      | ai-ops       |
| Post-Failure Learning Consolidation   | Medio       | 10min - 30min  | ai-ops       |

---

## 3. Discharge Orchestration Saga

### 3.1 Diagrama de Estado (ASCII)

```
                          +-----------+
                          | INITIATED |
                          +-----+-----+
                                |
                    [Medico solicita alta]
                                |
                     +----------v----------+
                     | CLINICAL_REVIEW      |
                     | - Verificar criterios|
                     | - Timeout: 2h        |
                     +----------+-----------+
                                |
               +----------------+----------------+
               |                                 |
        [Aprovado]                        [Rejeitado]
               |                                 |
    +----------v----------+           +----------v----------+
    | MEDICATION_REVIEW    |           | REVIEW_REJECTED     |
    | - Reconciliacao med. |           | - Notificar medico  |
    | - Timeout: 1h        |           | - Registrar motivo  |
    | - Retry: 3x          |           | - COMPENSAR:        |
    +----------+-----------+           |   cancel booking    |
               |                       +---------------------+
               |
    +----------v----------+
    | NURSING_CHECKLIST    |
    | - Checklist saida    |
    | - Timeout: 2h        |
    | - Pause/Resume OK    |
    +----------+-----------+
               |
    +----------v----------+
    | PHARMACY_CLEARANCE   |
    | - Liberacao farmacia |
    | - Timeout: 1h        |
    | - Retry: 2x          |
    +----------+-----------+
               |
    +----------v----------+
    | BILLING_SETTLEMENT   |
    | - Faturamento        |
    | - Timeout: 4h        |
    | - Compensar se falhar|
    +----------+-----------+
               |
    +----------v----------+
    | BED_RELEASE          |
    | - Liberar leito      |
    | - Notificar limpeza  |
    | - Timeout: 30min     |
    +----------+-----------+
               |
    +----------v----------+
    | DISCHARGE_COMPLETE   |
    | - Atualizar patient  |
    | - Emitir sumario     |
    | - Audit trail        |
    +---------------------+

    COMPENSACAO (em qualquer falha):
    ================================
    BED_RELEASE falhou       --> reverter BILLING, remarcar leito
    BILLING falhou           --> reverter PHARMACY_CLEARANCE, notificar admin
    PHARMACY falhou          --> reverter NURSING_CHECKLIST, notificar farmacia
    NURSING falhou           --> reverter MEDICATION_REVIEW, notificar enfermagem
    MEDICATION_REVIEW falhou --> reverter CLINICAL_REVIEW, notificar medico

    TIMEOUT em qualquer etapa --> ESCALATION workflow
```

### 3.2 Checkpoints

| Checkpoint              | Dados Persistidos                                           | Validacao                                  |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| Apos CLINICAL_REVIEW    | Aprovacao clinica, medico responsavel, criterios            | Assinatura digital do medico               |
| Apos MEDICATION_REVIEW  | Lista de medicamentos reconciliados, interacoes verificadas | Hash da lista de medicamentos              |
| Apos NURSING_CHECKLIST  | Itens do checklist completados, enfermeiro responsavel      | Todos os itens obrigatorios marcados       |
| Apos PHARMACY_CLEARANCE | Liberacao da farmacia, medicamentos dispensados             | Confirmacao da farmacia                    |
| Apos BILLING_SETTLEMENT | Fatura gerada, status de pagamento                          | Numero da fatura valido                    |
| Apos BED_RELEASE        | Leito liberado, equipe de limpeza notificada                | Status do leito atualizado no patient-flow |

### 3.3 Retry Policy

```typescript
const dischargeRetryPolicy: RetryPolicy = {
  initialInterval: '10s',
  backoffCoefficient: 2.0,
  maximumInterval: '5m',
  maximumAttempts: 3,
  nonRetryableErrorTypes: [
    'ClinicalReviewRejectedError',
    'PatientNotFoundError',
    'UnauthorizedError',
    'DataIntegrityError',
  ],
};
```

### 3.4 Timeout Configuration

| Activity          | Start-to-Close | Schedule-to-Start | Heartbeat |
| ----------------- | -------------- | ----------------- | --------- |
| clinicalReview    | 2h             | 5min              | 10min     |
| medicationReview  | 1h             | 2min              | 5min      |
| nursingChecklist  | 2h             | 2min              | 15min     |
| pharmacyClearance | 1h             | 2min              | 5min      |
| billingSettlement | 4h             | 5min              | 30min     |
| bedRelease        | 30min          | 1min              | 5min      |

### 3.5 Escalation

```
Timeout atingido em qualquer etapa
|
+-- Primeira vez --> Notificar responsavel direto
|                    Reenviar task
|                    Extender timeout em 50%
|
+-- Segunda vez --> Notificar supervisor
|                   Marcar como "atrasado" no dashboard
|                   Extender timeout em 25%
|
+-- Terceira vez --> Notificar diretoria clinica
|                    Marcar como "critico" no dashboard
|                    Alerta em #velya-clinical-critical
|                    Pager para clinical-lead
|
+-- Quarta vez --> Workflow entra em estado BLOCKED
                   Requer intervencao manual
                   Alta NAO PODE ser silenciosamente bloqueada
                   Notificacao obrigatoria ao paciente/familia
```

### 3.6 Overlap Policy

- `SCHEDULE_OVERLAP_POLICY_SKIP` para o mesmo paciente
- Um paciente so pode ter UM discharge workflow ativo
- Tentativa de iniciar segundo workflow retorna erro com link para workflow ativo
- Workflow ID format: `discharge-{patientId}-{timestamp}`

### 3.7 Pause/Resume

- Workflow pode ser pausado por solicitacao clinica (ex: condicao do paciente mudou)
- Ao pausar: registrar motivo, quem pausou, timestamp
- Ao resumir: verificar que condicoes ainda sao validas
- Timeout de pause: 48h (apos isso, workflow requer re-avaliacao clinica)

### 3.8 Codigo TypeScript - Discharge Orchestration Saga

```typescript
// workflows/discharge-orchestration.ts
import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  sleep,
  ApplicationFailure,
  CancellationScope,
  isCancellation,
} from '@temporalio/workflow';

import type * as activities from '../activities/discharge-activities';

const {
  performClinicalReview,
  performMedicationReview,
  performNursingChecklist,
  performPharmacyClearance,
  performBillingSettlement,
  performBedRelease,
  emitDischargeSummary,
  recordAuditTrail,
  notifyStakeholder,
  sendEscalation,
  // Compensacoes
  cancelClinicalReview,
  revertMedicationReview,
  revertNursingChecklist,
  revertPharmacyClearance,
  revertBillingSettlement,
  revertBedRelease,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '2h',
  retry: {
    initialInterval: '10s',
    backoffCoefficient: 2.0,
    maximumInterval: '5m',
    maximumAttempts: 3,
    nonRetryableErrorTypes: [
      'ClinicalReviewRejectedError',
      'PatientNotFoundError',
      'UnauthorizedError',
      'DataIntegrityError',
    ],
  },
});

// Signals
export const pauseSignal = defineSignal<[{ reason: string; pausedBy: string }]>('pause');
export const resumeSignal = defineSignal<[{ resumedBy: string }]>('resume');
export const cancelSignal = defineSignal<[{ reason: string; cancelledBy: string }]>('cancel');

// Queries
export const statusQuery = defineQuery<DischargeStatus>('status');

interface DischargeInput {
  patientId: string;
  requestedBy: string;
  facilityId: string;
  dischargeType: 'standard' | 'urgent' | 'ama';
}

interface DischargeStatus {
  currentStep: string;
  completedSteps: string[];
  paused: boolean;
  pauseReason?: string;
  startedAt: string;
  lastUpdatedAt: string;
}

interface CompensationEntry {
  step: string;
  compensationFn: () => Promise<void>;
  data: Record<string, unknown>;
}

export async function DischargeOrchestrationWorkflow(
  input: DischargeInput,
): Promise<{ success: boolean; summary: Record<string, unknown> }> {
  const compensationStack: CompensationEntry[] = [];
  let paused = false;
  let pauseReason = '';
  let cancelled = false;
  let cancelReason = '';
  let currentStep = 'INITIATED';
  const completedSteps: string[] = [];
  const startedAt = new Date().toISOString();

  // Signal handlers
  setHandler(pauseSignal, ({ reason, pausedBy }) => {
    paused = true;
    pauseReason = reason;
    console.log(`Workflow pausado por ${pausedBy}: ${reason}`);
  });

  setHandler(resumeSignal, ({ resumedBy }) => {
    paused = false;
    pauseReason = '';
    console.log(`Workflow resumido por ${resumedBy}`);
  });

  setHandler(cancelSignal, ({ reason, cancelledBy }) => {
    cancelled = true;
    cancelReason = reason;
    console.log(`Workflow cancelado por ${cancelledBy}: ${reason}`);
  });

  // Query handler
  setHandler(statusQuery, () => ({
    currentStep,
    completedSteps: [...completedSteps],
    paused,
    pauseReason: paused ? pauseReason : undefined,
    startedAt,
    lastUpdatedAt: new Date().toISOString(),
  }));

  // Helper: verificar pause/cancel antes de cada step
  async function checkPauseAndCancel(): Promise<void> {
    if (cancelled) {
      throw ApplicationFailure.create({
        type: 'WorkflowCancelledError',
        message: `Workflow cancelado: ${cancelReason}`,
      });
    }
    if (paused) {
      // Esperar ate ser resumido ou timeout de 48h
      const resumed = await condition(() => !paused, '48h');
      if (!resumed) {
        throw ApplicationFailure.create({
          type: 'PauseTimeoutError',
          message: 'Workflow expirou durante pausa (48h). Requer re-avaliacao clinica.',
        });
      }
    }
  }

  // Helper: executar compensacoes em ordem reversa
  async function executeCompensations(): Promise<void> {
    console.log(`Executando ${compensationStack.length} compensacoes...`);
    for (const entry of compensationStack.reverse()) {
      try {
        console.log(`Compensando step: ${entry.step}`);
        await entry.compensationFn();
      } catch (compError) {
        // Compensacao falhou - logar mas continuar com as demais
        console.error(`CRITICO: Compensacao falhou para ${entry.step}`, compError);
        await notifyStakeholder({
          channel: '#velya-clinical-critical',
          message: `Compensacao falhou para ${entry.step} no discharge de ${input.patientId}`,
          severity: 'critical',
        });
      }
    }
  }

  try {
    // STEP 1: Clinical Review
    await checkPauseAndCancel();
    currentStep = 'CLINICAL_REVIEW';

    const clinicalResult = await performClinicalReview({
      patientId: input.patientId,
      requestedBy: input.requestedBy,
      facilityId: input.facilityId,
    });

    if (!clinicalResult.approved) {
      await recordAuditTrail({
        patientId: input.patientId,
        event: 'DISCHARGE_REJECTED',
        reason: clinicalResult.rejectionReason,
        actor: clinicalResult.reviewedBy,
      });
      return {
        success: false,
        summary: { reason: 'clinical_review_rejected', details: clinicalResult },
      };
    }

    compensationStack.push({
      step: 'CLINICAL_REVIEW',
      compensationFn: () =>
        cancelClinicalReview({
          patientId: input.patientId,
          reviewId: clinicalResult.reviewId,
        }),
      data: clinicalResult,
    });
    completedSteps.push('CLINICAL_REVIEW');

    // STEP 2: Medication Review
    await checkPauseAndCancel();
    currentStep = 'MEDICATION_REVIEW';

    const medicationResult = await performMedicationReview({
      patientId: input.patientId,
      facilityId: input.facilityId,
      currentMedications: clinicalResult.currentMedications,
    });

    compensationStack.push({
      step: 'MEDICATION_REVIEW',
      compensationFn: () =>
        revertMedicationReview({
          patientId: input.patientId,
          reviewId: medicationResult.reviewId,
        }),
      data: medicationResult,
    });
    completedSteps.push('MEDICATION_REVIEW');

    // STEP 3: Nursing Checklist
    await checkPauseAndCancel();
    currentStep = 'NURSING_CHECKLIST';

    const nursingResult = await performNursingChecklist({
      patientId: input.patientId,
      facilityId: input.facilityId,
      dischargeType: input.dischargeType,
    });

    compensationStack.push({
      step: 'NURSING_CHECKLIST',
      compensationFn: () =>
        revertNursingChecklist({
          patientId: input.patientId,
          checklistId: nursingResult.checklistId,
        }),
      data: nursingResult,
    });
    completedSteps.push('NURSING_CHECKLIST');

    // STEP 4: Pharmacy Clearance
    await checkPauseAndCancel();
    currentStep = 'PHARMACY_CLEARANCE';

    const pharmacyResult = await performPharmacyClearance({
      patientId: input.patientId,
      facilityId: input.facilityId,
      reconciledMedications: medicationResult.reconciledList,
    });

    compensationStack.push({
      step: 'PHARMACY_CLEARANCE',
      compensationFn: () =>
        revertPharmacyClearance({
          patientId: input.patientId,
          clearanceId: pharmacyResult.clearanceId,
        }),
      data: pharmacyResult,
    });
    completedSteps.push('PHARMACY_CLEARANCE');

    // STEP 5: Billing Settlement
    await checkPauseAndCancel();
    currentStep = 'BILLING_SETTLEMENT';

    const billingResult = await performBillingSettlement({
      patientId: input.patientId,
      facilityId: input.facilityId,
      services: clinicalResult.servicesRendered,
      medications: pharmacyResult.dispensedMedications,
    });

    compensationStack.push({
      step: 'BILLING_SETTLEMENT',
      compensationFn: () =>
        revertBillingSettlement({
          patientId: input.patientId,
          invoiceId: billingResult.invoiceId,
        }),
      data: billingResult,
    });
    completedSteps.push('BILLING_SETTLEMENT');

    // STEP 6: Bed Release
    await checkPauseAndCancel();
    currentStep = 'BED_RELEASE';

    const bedResult = await performBedRelease({
      patientId: input.patientId,
      facilityId: input.facilityId,
      bedId: clinicalResult.currentBedId,
    });

    compensationStack.push({
      step: 'BED_RELEASE',
      compensationFn: () =>
        revertBedRelease({
          patientId: input.patientId,
          bedId: clinicalResult.currentBedId,
        }),
      data: bedResult,
    });
    completedSteps.push('BED_RELEASE');

    // STEP 7: Finalizacao
    currentStep = 'DISCHARGE_COMPLETE';

    const summary = await emitDischargeSummary({
      patientId: input.patientId,
      facilityId: input.facilityId,
      clinicalReview: clinicalResult,
      medicationReview: medicationResult,
      nursingChecklist: nursingResult,
      pharmacyClearance: pharmacyResult,
      billing: billingResult,
      bedRelease: bedResult,
    });

    await recordAuditTrail({
      patientId: input.patientId,
      event: 'DISCHARGE_COMPLETED',
      actor: input.requestedBy,
      details: {
        steps: completedSteps,
        duration: Date.now() - new Date(startedAt).getTime(),
      },
    });

    completedSteps.push('DISCHARGE_COMPLETE');
    currentStep = 'COMPLETED';

    return { success: true, summary };
  } catch (error) {
    // Se for cancelamento do Temporal, executar compensacoes
    if (isCancellation(error)) {
      await executeCompensations();
      throw error;
    }

    // Registrar falha no audit trail
    await recordAuditTrail({
      patientId: input.patientId,
      event: 'DISCHARGE_FAILED',
      actor: 'system',
      details: {
        failedStep: currentStep,
        completedSteps,
        error: String(error),
      },
    });

    // Executar compensacoes
    await executeCompensations();

    // Notificar equipe
    await notifyStakeholder({
      channel: '#velya-clinical-critical',
      message: `Discharge workflow falhou para paciente ${input.patientId} no step ${currentStep}`,
      severity: 'critical',
    });

    // REGRA: Alta NUNCA pode ser silenciosamente bloqueada
    await sendEscalation({
      patientId: input.patientId,
      type: 'DISCHARGE_BLOCKED',
      step: currentStep,
      error: String(error),
      escalationTargets: ['clinical-lead', 'nursing-supervisor'],
    });

    throw error;
  }
}
```

---

## 4. Institutional Escalation Workflow

### 4.1 Diagrama de Estado

```
+------------------+
| ESCALATION_START |
| - Evento trigger |
| - Classificacao  |
+--------+---------+
         |
    [Classificar severidade]
         |
    +----v----+----+----+
    |         |         |
  [LOW]    [HIGH]   [CRITICAL]
    |         |         |
    v         v         v
+-------+ +-------+ +----------+
|NOTIFY | |NOTIFY | |NOTIFY    |
|Team   | |Team + | |Team +    |
|Lead   | |Manager| |Director +|
|       | |       | |Pager     |
+---+---+ +---+---+ +----+-----+
    |         |           |
    v         v           v
+-------+ +-------+ +----------+
|AWAIT  | |AWAIT  | |AWAIT     |
|ACK    | |ACK    | |ACK       |
|30min  | |15min  | |5min      |
+---+---+ +---+---+ +----+-----+
    |         |           |
    +----+----+----+------+
         |
    [Acknowledged?]
         |
    +----+----+
    |         |
  [SIM]     [NAO]
    |         |
    v         v
+-------+ +----------+
|ACTION | |RE-ESCALAR|
|PLAN   | |Proximo   |
|       | |nivel     |
+---+---+ +----------+
    |
    v
+-----------+
| RESOLUTION|
| - Validar |
| - Fechar  |
| - Learning|
+-----------+
```

### 4.2 Configuracao

```typescript
const escalationConfig = {
  levels: [
    {
      name: 'team_lead',
      notifyVia: ['slack'],
      ackTimeout: '30m',
      autoEscalateOnTimeout: true,
    },
    {
      name: 'manager',
      notifyVia: ['slack', 'email'],
      ackTimeout: '15m',
      autoEscalateOnTimeout: true,
    },
    {
      name: 'director',
      notifyVia: ['slack', 'email', 'pager'],
      ackTimeout: '5m',
      autoEscalateOnTimeout: true,
    },
    {
      name: 'c_level',
      notifyVia: ['slack', 'email', 'pager', 'phone'],
      ackTimeout: '5m',
      autoEscalateOnTimeout: false, // Nivel maximo
    },
  ],
  retryPolicy: {
    initialInterval: '5s',
    maximumAttempts: 3,
  },
  workflowExecutionTimeout: '4h',
};
```

---

## 5. Agent Promotion/Quarantine/Retirement Workflow

### 5.1 Diagrama de Estado

```
+------------------+
| LIFECYCLE_CHANGE |
| - agentId        |
| - targetState    |
+--------+---------+
         |
    [Qual transicao?]
         |
    +----+----+----+-----+
    |         |           |
[PROMOTE] [QUARANTINE] [RETIRE]
    |         |           |
    v         v           v
+--------+ +----------+ +---------+
|VALIDATE| |STOP      | |DRAIN    |
|metrics | |traffic   | |requests |
|& policy| |& isolate | |& save   |
|48h data| |          | |state    |
+---+----+ +----+-----+ +----+----+
    |            |            |
    v            v            v
+--------+ +----------+ +---------+
|SHADOW  | |DIAGNOSE  | |ARCHIVE  |
|MODE    | |root cause| |memory & |
|Run with| |Run tests | |decisions|
|no efect| |          | |         |
+---+----+ +----+-----+ +----+----+
    |            |            |
    v            v            v
+--------+ +----------+ +---------+
|COMPARE | |DECIDE    | |CLEANUP  |
|results | |fix/revert| |resources|
|vs prod | |/retire   | |& config |
+---+----+ +----+-----+ +----+----+
    |            |            |
    v            v            v
+--------+ +----------+ +---------+
|ACTIVATE| |EXECUTE   | |COMPLETE |
|or ABORT| |decision  | |retirement|
+--------+ +----------+ +---------+
```

### 5.2 Codigo - Agent Quarantine

```typescript
// workflows/agent-quarantine.ts
export async function AgentQuarantineWorkflow(input: {
  agentId: string;
  reason: string;
  triggeredBy: string;
  evidence: Record<string, unknown>;
}): Promise<QuarantineResult> {
  // 1. Parar trafego imediatamente
  await stopAgentTraffic({
    agentId: input.agentId,
    reason: input.reason,
  });

  // 2. Salvar estado atual para analise
  const stateSnapshot = await saveAgentState({
    agentId: input.agentId,
    includeMemory: true,
    includeRecentDecisions: true,
    decisionWindow: '24h',
  });

  // 3. Ativar agente substituto (se disponivel)
  const fallbackResult = await activateFallbackAgent({
    agentId: input.agentId,
    fallbackStrategy: 'previous_version',
  });

  // 4. Executar diagnostico
  const diagnosis = await runAgentDiagnostics({
    agentId: input.agentId,
    stateSnapshot,
    evidence: input.evidence,
    tests: [
      'policy_compliance',
      'decision_quality',
      'resource_consumption',
      'memory_consistency',
      'hallucination_detection',
    ],
  });

  // 5. Registrar no decision-log-service
  await recordDecisionLog({
    agentId: input.agentId,
    event: 'QUARANTINED',
    reason: input.reason,
    diagnosis: diagnosis.summary,
    triggeredBy: input.triggeredBy,
    fallbackAgent: fallbackResult.activeAgentId,
  });

  // 6. Notificar
  await notifyStakeholder({
    channel: '#velya-ai-ops',
    message: `Agente ${input.agentId} em quarentena. Motivo: ${input.reason}. Fallback: ${fallbackResult.activeAgentId}`,
    severity: 'high',
  });

  return {
    agentId: input.agentId,
    quarantinedAt: new Date().toISOString(),
    diagnosis,
    fallbackAgent: fallbackResult.activeAgentId,
    nextAction: diagnosis.recommendedAction,
  };
}
```

---

## 6. Multi-Step Correction Workflow

### 6.1 Diagrama de Estado

```
+-----------------+
| CORRECTION_INIT |
| - O que corrigir|
| - Escopo        |
| - Evidencia     |
+--------+--------+
         |
    [Identificar registros afetados]
         |
+--------v--------+
| IMPACT_ANALYSIS |
| - Quantos?      |
| - Quais servicos|
| - Dados clinicos|
| - Timeout: 30min|
+--------+--------+
         |
    [Requer aprovacao clinica?]
         |
    +----+----+
    |         |
  [SIM]     [NAO]
    |         |
    v         |
+--------+   |
|CLINICAL|   |
|APPROVAL|   |
|Timeout |   |
|: 2h    |   |
+---+----+   |
    |         |
    +----+----+
         |
+--------v--------+
| EXECUTE_BATCH   |
| - Corrigir em   |
|   lotes de 100  |
| - Checkpoint    |
|   a cada lote   |
| - Pause/Resume  |
+--------+--------+
         |
+--------v--------+
| VALIDATE_RESULT |
| - Verificar     |
|   integridade   |
| - Comparar com  |
|   estado esperado|
+--------+--------+
         |
+--------v--------+
| AUDIT_AND_NOTIFY|
| - audit-service |
| - Notificar     |
|   stakeholders  |
+-----------------+
```

### 6.2 Configuracao de Retry e Compensacao

```typescript
const correctionWorkflowConfig = {
  batchSize: 100,
  maxConcurrentBatches: 3,
  checkpointEveryNBatches: 1,
  retryPolicy: {
    initialInterval: '30s',
    backoffCoefficient: 2.0,
    maximumInterval: '10m',
    maximumAttempts: 5,
  },
  compensation: {
    // Se correcao falhar no meio, reverter TODOS os lotes ja aplicados
    strategy: 'full_reversal',
    // Manter snapshot pre-correcao por 30 dias
    snapshotRetention: '30d',
  },
  timeouts: {
    impactAnalysis: '30m',
    clinicalApproval: '2h',
    executionPerBatch: '5m',
    totalExecution: '4h',
    validation: '30m',
  },
};
```

---

## 7. Post-Failure Learning Consolidation

### 7.1 Diagrama de Estado

```
+-------------------+
| FAILURE_DETECTED  |
| - Tipo de falha   |
| - Contexto        |
| - Impacto         |
+---------+---------+
          |
+---------v---------+
| COLLECT_EVIDENCE  |
| - Logs (Loki)     |
| - Traces (Tempo)  |
| - Metrics (Prom.) |
| - Agent decisions |
| - Workflow state  |
+---------+---------+
          |
+---------v---------+
| ANALYZE_ROOT_CAUSE|
| - Pattern matching|
| - Similar failures|
| - Contributing    |
|   factors         |
+---------+---------+
          |
+---------v---------+
| GENERATE_LEARNING |
| - O que aconteceu |
| - Por que         |
| - Como prevenir   |
| - Acao corretiva  |
+---------+---------+
          |
+---------v---------+
| STORE_IN_MEMORY   |
| - memory-service  |
| - Indexar por tipo|
| - Link p/ traces  |
+---------+---------+
          |
+---------v---------+
| DISTRIBUTE        |
| - Notificar times |
| - Atualizar docs  |
| - Criar issues    |
+-------------------+
```

### 7.2 Codigo

```typescript
// workflows/post-failure-learning.ts
export async function PostFailureLearningWorkflow(input: {
  failureId: string;
  failureType: string;
  service: string;
  timestamp: string;
  context: Record<string, unknown>;
}): Promise<LearningResult> {
  // 1. Coletar evidencias de multiplas fontes
  const [logs, traces, metrics, agentDecisions, workflowState] = await Promise.all([
    queryLoki({
      query: `{service="${input.service}"} |= "${input.failureId}"`,
      start: subtractTime(input.timestamp, '1h'),
      end: addTime(input.timestamp, '15m'),
    }),
    queryTempo({
      traceId: input.context.traceId as string,
      service: input.service,
    }),
    queryPrometheus({
      queries: [
        `rate(http_requests_total{service="${input.service}",status=~"5.."}[5m])`,
        `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="${input.service}"}[5m]))`,
      ],
      start: subtractTime(input.timestamp, '1h'),
      end: addTime(input.timestamp, '15m'),
    }),
    queryDecisionLog({
      service: input.service,
      timeRange: { start: subtractTime(input.timestamp, '30m'), end: input.timestamp },
    }),
    queryTemporalWorkflows({
      service: input.service,
      status: 'FAILED',
      timeRange: { start: subtractTime(input.timestamp, '1h'), end: input.timestamp },
    }),
  ]);

  // 2. Analisar causa raiz
  const rootCauseAnalysis = await analyzeRootCause({
    logs,
    traces,
    metrics,
    agentDecisions,
    workflowState,
    failureType: input.failureType,
  });

  // 3. Buscar falhas similares no historico
  const similarFailures = await searchSimilarFailures({
    failureType: input.failureType,
    service: input.service,
    rootCauseCategory: rootCauseAnalysis.category,
    limit: 10,
  });

  // 4. Gerar learning consolidado
  const learning: Learning = {
    id: `learning-${input.failureId}`,
    failureId: input.failureId,
    service: input.service,
    timestamp: input.timestamp,
    whatHappened: rootCauseAnalysis.summary,
    whyItHappened: rootCauseAnalysis.rootCause,
    howToPrevent: rootCauseAnalysis.preventionMeasures,
    correctiveActions: rootCauseAnalysis.correctiveActions,
    similarIncidents: similarFailures.map((f) => f.id),
    recurrenceRisk: calculateRecurrenceRisk(similarFailures),
    evidenceLinks: {
      lokiQuery: logs.query,
      tempoTraceId: input.context.traceId as string,
      prometheusQueries: metrics.queries,
    },
  };

  // 5. Persistir no memory-service
  await storeInMemoryService({
    type: 'failure_learning',
    data: learning,
    tags: [input.failureType, input.service, rootCauseAnalysis.category],
    ttl: '365d',
  });

  // 6. Distribuir aprendizado
  await distributeToTeams({
    learning,
    channels: determineChannels(input.service, rootCauseAnalysis.severity),
    createIssues: rootCauseAnalysis.correctiveActions.filter(
      (a) => a.type === 'code_change' || a.type === 'config_change',
    ),
  });

  return {
    learningId: learning.id,
    rootCause: rootCauseAnalysis.rootCause,
    recurrenceRisk: learning.recurrenceRisk,
    actionsCreated: rootCauseAnalysis.correctiveActions.length,
  };
}
```

---

## 8. Observabilidade de Workflows

### 8.1 Metricas Obrigatorias

```
# Emitidas pelo Temporal SDK
temporal_workflow_execution_total{workflow_type, status}
temporal_workflow_execution_duration_seconds{workflow_type}
temporal_activity_execution_total{activity_type, status}
temporal_activity_execution_duration_seconds{activity_type}

# Custom Velya
velya_discharge_workflow_step_duration_seconds{step}
velya_discharge_workflow_compensation_total{step, reason}
velya_discharge_workflow_escalation_total{level}
velya_agent_lifecycle_transition_total{from_state, to_state}
velya_learning_consolidation_total{failure_type, service}
```

### 8.2 Alertas

```yaml
# prometheus-rules/workflow-alerts.yaml
groups:
  - name: velya-workflows
    rules:
      - alert: DischargeWorkflowStuck
        expr: |
          temporal_workflow_execution_duration_seconds{
            workflow_type="DischargeOrchestrationWorkflow",
            status="running"
          } > 86400
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: 'Discharge workflow rodando ha mais de 24h para paciente {{ $labels.patient_id }}'

      - alert: WorkflowCompensationTriggered
        expr: |
          increase(velya_discharge_workflow_compensation_total[5m]) > 0
        for: 0m
        labels:
          severity: high
        annotations:
          summary: 'Compensacao disparada no step {{ $labels.step }}: {{ $labels.reason }}'

      - alert: AgentQuarantineTriggered
        expr: |
          increase(velya_agent_lifecycle_transition_total{to_state="quarantine"}[5m]) > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: 'Agente {{ $labels.agent_id }} entrou em quarentena'
```

---

## 9. Configuracao do Task Queue

```typescript
// worker/worker-config.ts
const workerConfig = {
  taskQueues: {
    'velya-discharge': {
      maxConcurrentWorkflowTasks: 10,
      maxConcurrentActivityTasks: 20,
      stickyQueueScheduleToStartTimeout: '10s',
    },
    'velya-escalation': {
      maxConcurrentWorkflowTasks: 50,
      maxConcurrentActivityTasks: 100,
      // Escalacoes precisam de throughput alto
    },
    'velya-agent-lifecycle': {
      maxConcurrentWorkflowTasks: 5,
      maxConcurrentActivityTasks: 10,
      // Lifecycle changes sao raros mas criticos
    },
    'velya-health-checks': {
      maxConcurrentWorkflowTasks: 20,
      maxConcurrentActivityTasks: 40,
    },
    'velya-learning': {
      maxConcurrentWorkflowTasks: 10,
      maxConcurrentActivityTasks: 30,
    },
  },
};
```

---

## 10. Pos-condicoes de Cada Workflow

| Workflow                 | Pos-condicao Obrigatoria                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Discharge Orchestration  | Paciente com status `discharged` no patient-flow, leito liberado, sumario emitido, audit trail completo |
| Institutional Escalation | Incidente com owner definido, ack registrado, plano de acao documentado                                 |
| Multi-Step Correction    | Todos os registros corrigidos ou rollback completo, audit trail, zero registros em estado intermediario |
| Agent Quarantine         | Agente isolado, fallback ativo, diagnostico registrado, notificacao enviada                             |
| Agent Promotion          | Agente em producao com metricas baseline, shadow mode concluido com sucesso                             |
| Post-Failure Learning    | Learning persistido no memory-service, times notificados, issues criadas                                |
