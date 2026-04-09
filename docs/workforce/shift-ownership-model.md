# Modelo de Propriedade por Turno

> Definicao clara de quem e dono de quais pacientes e tarefas em cada janela de turno, com deteccao de gaps entre turnos.

## 1. Visao Geral

O modelo de propriedade por turno garante que, em qualquer momento, cada paciente internado tem exatamente um profissional responsavel por cada funcao assistencial (medico, enfermeiro, tecnico de enfermagem). A propriedade e explicita, rastreavel e transferida formalmente a cada troca de turno.

### 1.1 Principios

1. **Cobertura total**: 100% dos pacientes cobertos 100% do tempo. Zero gaps.
2. **Responsavel identificado**: Nome, credencial e papel do responsavel visiveis para toda a equipe.
3. **Transicao explicita**: Troca de turno = handoff formal com aceite (ver `handoff-acceptance-standard.md`).
4. **Heranca de pendencias**: Pendencias nao resolvidas sao automaticamente herdadas pelo proximo turno.
5. **Rastreabilidade**: O Work Event Ledger registra toda mudanca de propriedade.

---

## 2. Janelas de Turno

### 2.1 Configuracao Padrao

| Turno           | Horario       | Codigo    | Overlap                          |
| --------------- | ------------- | --------- | -------------------------------- |
| **Diurno (D)**  | 07:00 - 19:00 | `SHIFT_D` | 07:00-07:30 com noturno anterior |
| **Noturno (N)** | 19:00 - 07:00 | `SHIFT_N` | 19:00-19:30 com diurno anterior  |

### 2.2 Configuracao Alternativa (3 turnos)

| Turno           | Horario       | Codigo    | Overlap                 |
| --------------- | ------------- | --------- | ----------------------- |
| **Manha (M)**   | 07:00 - 13:00 | `SHIFT_M` | 07:00-07:15 com noturno |
| **Tarde (T)**   | 13:00 - 19:00 | `SHIFT_T` | 13:00-13:15 com manha   |
| **Noturno (N)** | 19:00 - 07:00 | `SHIFT_N` | 19:00-19:15 com tarde   |

### 2.3 Configuracao por Unidade

Cada unidade pode ter configuracao de turno diferente:

```yaml
# shift-config.yaml
units:
  UTI-A:
    shift_model: '12h'
    shifts:
      - name: 'Diurno'
        code: 'SHIFT_D'
        start: '07:00'
        end: '19:00'
        overlap_minutes: 30
      - name: 'Noturno'
        code: 'SHIFT_N'
        start: '19:00'
        end: '07:00'
        overlap_minutes: 30
    max_patients_per_nurse: 2
    max_patients_per_tech: 4

  Enfermaria-4B:
    shift_model: '12h'
    shifts:
      - name: 'Diurno'
        code: 'SHIFT_D'
        start: '07:00'
        end: '19:00'
        overlap_minutes: 30
      - name: 'Noturno'
        code: 'SHIFT_N'
        start: '19:00'
        end: '07:00'
        overlap_minutes: 30
    max_patients_per_nurse: 6
    max_patients_per_tech: 10

  Emergencia:
    shift_model: '6h'
    shifts:
      - name: 'Manha'
        code: 'SHIFT_M'
        start: '07:00'
        end: '13:00'
        overlap_minutes: 15
      - name: 'Tarde'
        code: 'SHIFT_T'
        start: '13:00'
        end: '19:00'
        overlap_minutes: 15
      - name: 'Noite1'
        code: 'SHIFT_N1'
        start: '19:00'
        end: '01:00'
        overlap_minutes: 15
      - name: 'Noite2'
        code: 'SHIFT_N2'
        start: '01:00'
        end: '07:00'
        overlap_minutes: 15
    max_patients_per_nurse: 4
    max_patients_per_tech: 8

  # Medicos podem ter escalas diferentes
  medical_shifts:
    default:
      - name: 'Plantao Diurno'
        code: 'MED_D'
        start: '07:00'
        end: '19:00'
        overlap_minutes: 30
      - name: 'Plantao Noturno'
        code: 'MED_N'
        start: '19:00'
        end: '07:00'
        overlap_minutes: 30
```

---

## 3. Eventos de Inicio e Fim de Turno

### 3.1 Inicio de Turno

Ao iniciar o turno, o profissional registra no sistema:

```typescript
interface ShiftStartEvent {
  eventType: 'shift.started';
  practitioner: FHIRReference<'Practitioner'>;
  shiftCode: string;
  unit: string;
  startTime: ISO8601DateTime;
  expectedEndTime: ISO8601DateTime;

  /** Lista de pacientes que aceita neste turno (via handoff) */
  acceptedPatients: PatientAssignment[];

  /** Pendencias herdadas do turno anterior */
  inheritedPendingItems: InheritedPendingItem[];

  /** Status do profissional */
  status: 'on_duty' | 'on_call' | 'backup';

  /** Certificacao de que recebeu handoff completo */
  handoffReceived: boolean;

  /** Observacoes do inicio do turno */
  notes: string;
}

interface PatientAssignment {
  patientReference: FHIRReference<'Patient'>;
  encounterReference: FHIRReference<'Encounter'>;
  unit: string;
  bed: string;
  assignmentType: 'primary' | 'secondary' | 'backup';
  receivedFrom: FHIRReference<'Practitioner'>;
  handoffTaskReference: FHIRReference<'Task'>;
}

interface InheritedPendingItem {
  id: string;
  type: string;
  description: string;
  originalCreatedAt: ISO8601DateTime;
  originalAssignedTo: FHIRReference<'Practitioner'>;
  priority: 'stat' | 'urgent' | 'routine';
  slaDeadline: ISO8601DateTime | null;
  slaBreached: boolean;
}
```

### 3.2 Fim de Turno

Ao finalizar o turno, o profissional registra:

```typescript
interface ShiftEndEvent {
  eventType: 'shift.ended';
  practitioner: FHIRReference<'Practitioner'>;
  shiftCode: string;
  unit: string;
  actualEndTime: ISO8601DateTime;
  expectedEndTime: ISO8601DateTime;

  /** Overtime registrado (minutos alem do esperado) */
  overtimeMinutes: number;
  /** Justificativa do overtime */
  overtimeReason?: string;

  /** Pacientes transferidos neste fim de turno */
  transferredPatients: PatientTransfer[];

  /** Pendencias criadas durante o turno */
  pendingItemsCreated: number;
  /** Pendencias resolvidas durante o turno */
  pendingItemsResolved: number;
  /** Pendencias herdadas e nao resolvidas (passadas adiante) */
  pendingItemsForwarded: number;

  /** Todos os handoffs foram aceitos? */
  allHandoffsAccepted: boolean;
  /** IDs de handoffs pendentes (se houver) */
  pendingHandoffs: string[];

  /** Resumo do turno */
  shiftSummary: string;
}

interface PatientTransfer {
  patientReference: FHIRReference<'Patient'>;
  transferredTo: FHIRReference<'Practitioner'>;
  handoffTaskReference: FHIRReference<'Task'>;
  handoffStatus: 'accepted' | 'pending' | 'escalated';
}
```

### 3.3 Regra: Fim de Turno Bloqueado

O sistema **nao permite** que o profissional finalize o turno se:

1. Algum handoff de paciente critico esta pendente (sem aceite).
2. Existe paciente sem nenhum handoff enviado.
3. Existe pendencia de seguranca nao comunicada (resultado critico, deterioracao).

O profissional pode finalizar com handoffs de rotina pendentes, mas o sistema registra como overtime obrigatorio ate resolucao.

---

## 4. Lista de Pacientes por Turno

### 4.1 Atribuicao

A lista de pacientes por profissional por turno e definida por:

| Fator            | Descricao                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Continuidade** | Preferencialmente, o mesmo paciente permanece com o mesmo profissional em turnos consecutivos do mesmo tipo (ex: mesmo enfermeiro diurno) |
| **Carga**        | Distribuicao equilibrada de carga considerando acuidade dos pacientes                                                                     |
| **Competencia**  | Pacientes com necessidades especiais atribuidos a profissionais com competencia adequada                                                  |
| **Localizacao**  | Pacientes fisicamente proximos para eficiencia operacional                                                                                |
| **Limitacao**    | Respeito ao ratio maximo pacientes/profissional da unidade                                                                                |

### 4.2 Algoritmo de Sugestao

```typescript
function suggestPatientAssignment(
  unit: string,
  shift: string,
  availableStaff: Practitioner[],
  patients: Patient[],
): PatientAssignment[] {
  // 1. Manter continuidade quando possivel
  const previousAssignments = getPreviousShiftAssignments(unit, shift);

  // 2. Calcular acuidade de cada paciente
  const patientAcuity = patients.map((p) => ({
    patient: p,
    acuity: calculateAcuity(p), // baseado no Digital Twin
  }));

  // 3. Distribuir equilibrando carga
  const assignments: PatientAssignment[] = [];
  const staffLoad: Map<string, number> = new Map();

  // Primeiro: manter continuidade
  for (const pa of patientAcuity) {
    const previousNurse = previousAssignments.find(
      (a) => a.patientId === pa.patient.id,
    )?.practitionerId;

    if (previousNurse && availableStaff.find((s) => s.id === previousNurse)) {
      const currentLoad = staffLoad.get(previousNurse) || 0;
      const maxLoad = getMaxLoadForUnit(unit);
      if (currentLoad + pa.acuity <= maxLoad) {
        assignments.push({
          patientId: pa.patient.id,
          practitionerId: previousNurse,
          reason: 'continuity',
        });
        staffLoad.set(previousNurse, currentLoad + pa.acuity);
      }
    }
  }

  // Segundo: distribuir restantes por carga
  const unassigned = patientAcuity.filter(
    (pa) => !assignments.find((a) => a.patientId === pa.patient.id),
  );

  for (const pa of unassigned.sort((a, b) => b.acuity - a.acuity)) {
    const leastLoadedStaff = availableStaff
      .filter((s) => !isOverloaded(s, staffLoad, unit))
      .sort((a, b) => (staffLoad.get(a.id) || 0) - (staffLoad.get(b.id) || 0))[0];

    if (leastLoadedStaff) {
      assignments.push({
        patientId: pa.patient.id,
        practitionerId: leastLoadedStaff.id,
        reason: 'load_balance',
      });
      staffLoad.set(leastLoadedStaff.id, (staffLoad.get(leastLoadedStaff.id) || 0) + pa.acuity);
    }
  }

  return assignments;
}
```

---

## 5. Pendencias Herdadas

### 5.1 Heranca Automatica

Quando um profissional aceita um handoff, todas as pendencias ativas do paciente sao automaticamente herdadas:

| Tipo de Pendencia                 | Heranca    | Nota                               |
| --------------------------------- | ---------- | ---------------------------------- |
| Medicamento atrasado              | Automatica | Flagado com alerta                 |
| Resultado critico sem acao        | Automatica | Flagado como prioridade maxima     |
| Reavaliacao de dor                | Automatica | Com horario original               |
| Troca de dispositivo              | Automatica | Com data de insercao               |
| Documento sem assinatura          | Automatica | Do autor original, nao do herdeiro |
| Interconsulta pendente            | Automatica | Com SLA original                   |
| Exame pendente (coleta/resultado) | Automatica | Com SLA original                   |

### 5.2 Visibilidade de Pendencias Herdadas

No inicio do turno, o profissional ve:

```
┌─────────────────────────────────────────────────────────────┐
│ INICIO DE TURNO - Enf. Joao Silva                          │
│ Turno: Noturno (19:00 - 07:00) | Unidade: UTI-A           │
│ Data: 09/04/2026                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ PACIENTES ACEITOS: 2                                        │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Leito 3 - Maria Santos                                 │ │
│ │ Acuidade: ALTA | NEWS2: 4 | Pos-op D1                 │ │
│ │                                                         │ │
│ │ PENDENCIAS HERDADAS (3):                                │ │
│ │ ⚠ [URGENTE] Reavaliar dor - ultima aval 16:30 (NRS 6) │ │
│ │ ○ Trocar CVP (MSD) - inserido em 07/04 (D2)           │ │
│ │ ○ Aguardar resultado cultura de sangue                  │ │
│ │                                                         │ │
│ │ NOVAS do turno anterior:                                │ │
│ │ ✓ Antibiotico IV iniciado as 18:00                     │ │
│ │ ✓ Dreno com debito de 150ml nas ultimas 6h             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Leito 5 - Carlos Oliveira                              │ │
│ │ Acuidade: MEDIA | NEWS2: 2 | Clinico D4                │ │
│ │                                                         │ │
│ │ PENDENCIAS HERDADAS (1):                                │ │
│ │ ○ Exame de imagem (TC abdome) agendado p/ amanha 08h   │ │
│ │                                                         │ │
│ │ NOVAS do turno anterior:                                │ │
│ │ ✓ Dieta progredida para pastosa                        │ │
│ │ ✓ Deambulou com auxilio 2x no turno                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [CONFIRMAR INICIO DE TURNO]                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Gap Detection entre Turnos

### 6.1 Gaps Monitorados

| Gap                          | Descricao                                                                  | Severidade |
| ---------------------------- | -------------------------------------------------------------------------- | ---------- |
| **Paciente sem aceite**      | Paciente no handoff mas nao aceito pelo receptor                           | CRITICAL   |
| **Pendencia nao comunicada** | Pendencia do turno anterior nao incluida no handoff                        | HIGH       |
| **Continuidade quebrada**    | Profissional designado diferente sem justificativa                         | MEDIUM     |
| **Overtime excessivo**       | Profissional permaneceu > 2h alem do turno                                 | MEDIUM     |
| **Carga desigual**           | Diferenca > 50% na acuidade entre profissionais do turno                   | MEDIUM     |
| **Competencia inadequada**   | Paciente com necessidade especial atribuido a profissional sem competencia | HIGH       |
| **Turno sem inicio**         | Profissional da escala nao registrou inicio de turno em 15 min             | HIGH       |

### 6.2 Deteccao Automatica

```typescript
async function detectShiftGaps(unit: string, shift: string): Promise<Gap[]> {
  const gaps: Gap[] = [];
  const expectedStaff = await getScheduledStaff(unit, shift);
  const actualStaff = await getCheckedInStaff(unit, shift);
  const patients = await getActivePatients(unit);

  // Gap 1: Profissional da escala nao fez check-in
  for (const scheduled of expectedStaff) {
    if (!actualStaff.find((a) => a.id === scheduled.id)) {
      const delayMinutes = minutesSinceShiftStart(shift);
      if (delayMinutes > 15) {
        gaps.push({
          type: 'shift_no_start',
          severity: 'HIGH',
          practitioner: scheduled,
          description: `Profissional ${scheduled.name} nao registrou inicio de turno. Atraso: ${delayMinutes} min.`,
        });
      }
    }
  }

  // Gap 2: Paciente sem responsavel aceito
  for (const patient of patients) {
    const currentOwner = await getCurrentOwner(patient.id, 'nurse');
    if (!currentOwner || !currentOwner.isCurrentShift) {
      gaps.push({
        type: 'patient_no_owner',
        severity: 'CRITICAL',
        patient: patient,
        description: `Paciente ${patient.name} (leito ${patient.bed}) sem enfermeiro responsavel no turno atual.`,
      });
    }
  }

  // Gap 3: Carga desigual
  const staffLoads = await calculateStaffLoads(unit, shift);
  const maxLoad = Math.max(...staffLoads.map((s) => s.acuityScore));
  const minLoad = Math.min(...staffLoads.map((s) => s.acuityScore));
  if (maxLoad > 0 && (maxLoad - minLoad) / maxLoad > 0.5) {
    gaps.push({
      type: 'unequal_load',
      severity: 'MEDIUM',
      description: `Carga desigual na unidade ${unit}: max=${maxLoad}, min=${minLoad}. Diferenca > 50%.`,
    });
  }

  return gaps;
}
```

---

## 7. Regras de Overlap

### 7.1 Periodo de Overlap

O periodo de overlap entre turnos e o momento em que ambos os profissionais (saindo e entrando) estao presentes simultaneamente para realizar o handoff.

| Duracao             | Finalidade                                            |
| ------------------- | ----------------------------------------------------- |
| **Primeiros 5 min** | Login do profissional entrante, verificacao de escala |
| **5-20 min**        | Handoff estruturado (I-PASS) por paciente             |
| **20-25 min**       | Conferencia de pendencias, duvidas, esclarecimentos   |
| **25-30 min**       | Aceite formal no sistema, inicio do turno no sistema  |

### 7.2 Regras

1. **Overlap e obrigatorio**: Profissional nao pode sair antes do fim do overlap sem aceite de todos os handoffs.
2. **Overlap estendido**: Se handoff nao foi concluido no overlap padrao, o profissional que sai permanece em overtime remunerado ate conclusao.
3. **Overlap reduzido**: Em emergencias, o coordenador pode autorizar overlap reduzido (minimo 15 min) com justificativa.
4. **Sem overlap (contingencia)**: Se o profissional entrante nao aparece, o profissional do turno anterior permanece e o sistema escala backup. Nao existe "turno vazio".

---

## 8. Overtime

### 8.1 Tipos de Overtime

| Tipo                              | Descricao                                            | Registro                     |
| --------------------------------- | ---------------------------------------------------- | ---------------------------- |
| **Overtime de handoff**           | Extensao para completar handoffs                     | Automatico (sistema detecta) |
| **Overtime de pendencia critica** | Pendencia critica surgiu nos ultimos 30 min do turno | Registrado pelo profissional |
| **Overtime de cobertura**         | Substituto nao chegou / emergencia                   | Registrado pelo coordenador  |
| **Overtime de documentacao**      | Profissional precisa completar documentacao          | Registrado pelo profissional |

### 8.2 Limites

| Regra                  | Limite                   | Acao ao atingir                           |
| ---------------------- | ------------------------ | ----------------------------------------- |
| Overtime por turno     | Maximo 2 horas           | Alerta para coordenador, busca substituto |
| Overtime semanal       | Maximo 6 horas           | Notificacao ao RH                         |
| Overtimes consecutivos | Maximo 3 turnos seguidos | Bloqueio de escala (obriga descanso)      |

### 8.3 Monitoramento

```promql
# Overtime medio por unidade (horas)
avg by (unit) (velya_shift_overtime_minutes) / 60

# Profissionais com overtime > 2h
count(velya_shift_overtime_minutes > 120)

# Taxa de turnos com overtime
sum(rate(velya_shift_overtime_events_total[7d]))
/ sum(rate(velya_shift_end_events_total[7d]))
```

---

## 9. Continuidade Cross-Shift

### 9.1 Mecanismos de Continuidade

| Mecanismo                        | Descricao                                                              |
| -------------------------------- | ---------------------------------------------------------------------- |
| **Plano de cuidado persistente** | O CarePlan nao muda com o turno — continua ativo                       |
| **Pendencias herdadas**          | Pendencias se transferem automaticamente com handoff                   |
| **Historico acessivel**          | Profissional do novo turno ve timeline completa                        |
| **Anotacoes cross-turno**        | Notas marcadas como "para proximo turno" ficam destacadas              |
| **Alertas persistentes**         | Alertas clinicos nao expiram com o turno                               |
| **Continuidade de profissional** | Sistema prioriza atribuir o mesmo profissional em turnos do mesmo tipo |

### 9.2 Handoff Cross-Turno de Medico

O handoff medico tem particularidades:

1. **Medico diarista -> plantonista noturno**: Handoff formal no fim do horario do diarista (tipicamente 17-18h).
2. **Plantonista noturno -> diarista**: Handoff formal no inicio do horario do diarista (tipicamente 7-8h).
3. **Conteudo**: Alem do I-PASS, inclui plano de acao para intercorrencias, criterios de acionamento do diarista/especialista.
4. **Responsabilidade cirurgica**: Pacientes cirurgicos mantem o cirurgiao como responsavel mesmo durante plantao, com plantonista como cobertura.

---

## 10. CronJob de Verificacao de Turno

### 10.1 YAML do CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: shift-ownership-verification
  namespace: velya
  labels:
    app: velya
    component: workforce
    module: shift-verification
spec:
  # Executa a cada 15 minutos
  schedule: '*/15 * * * *'
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 24
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      backoffLimit: 3
      activeDeadlineSeconds: 300
      template:
        metadata:
          labels:
            app: velya
            component: shift-verification
        spec:
          restartPolicy: OnFailure
          serviceAccountName: velya-shift-verifier
          containers:
            - name: shift-verifier
              image: velya/shift-verifier:latest
              imagePullPolicy: IfNotPresent
              command:
                - /app/shift-verifier
              args:
                - --mode=continuous
                - --check-ownership
                - --check-gaps
                - --check-overtime
                - --check-load-balance
                - --notify-on-gap
                - --escalate-critical
              env:
                - name: DATABASE_URL
                  valueFrom:
                    secretKeyRef:
                      name: velya-db-credentials
                      key: connection-string
                - name: REDIS_URL
                  valueFrom:
                    secretKeyRef:
                      name: velya-redis-credentials
                      key: url
                - name: KAFKA_BROKERS
                  valueFrom:
                    configMapKeyRef:
                      name: velya-kafka-config
                      key: brokers
                - name: NOTIFICATION_SERVICE_URL
                  value: 'http://notification-service.velya.svc.cluster.local:8080'
                - name: LOG_LEVEL
                  value: 'info'
              resources:
                requests:
                  cpu: 100m
                  memory: 256Mi
                limits:
                  cpu: 500m
                  memory: 512Mi
              livenessProbe:
                exec:
                  command:
                    - /app/shift-verifier
                    - --healthcheck
                initialDelaySeconds: 10
                periodSeconds: 30
---
# CronJob especifico para transicoes de turno
apiVersion: batch/v1
kind: CronJob
metadata:
  name: shift-transition-monitor
  namespace: velya
  labels:
    app: velya
    component: workforce
    module: shift-transition
spec:
  # Executa nos horarios de transicao de turno + 30min apos
  # 07:00, 07:30, 13:00, 13:30, 19:00, 19:30, 01:00, 01:30
  schedule: '0,30 1,7,13,19 * * *'
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 48
  failedJobsHistoryLimit: 10
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 600
      template:
        metadata:
          labels:
            app: velya
            component: shift-transition
        spec:
          restartPolicy: OnFailure
          serviceAccountName: velya-shift-verifier
          containers:
            - name: transition-monitor
              image: velya/shift-verifier:latest
              imagePullPolicy: IfNotPresent
              command:
                - /app/shift-verifier
              args:
                - --mode=transition
                - --verify-all-handoffs
                - --verify-all-patients-covered
                - --generate-transition-report
                - --escalate-uncovered-patients
              env:
                - name: DATABASE_URL
                  valueFrom:
                    secretKeyRef:
                      name: velya-db-credentials
                      key: connection-string
                - name: REDIS_URL
                  valueFrom:
                    secretKeyRef:
                      name: velya-redis-credentials
                      key: url
                - name: NOTIFICATION_SERVICE_URL
                  value: 'http://notification-service.velya.svc.cluster.local:8080'
              resources:
                requests:
                  cpu: 200m
                  memory: 512Mi
                limits:
                  cpu: 1000m
                  memory: 1Gi
---
# CronJob de relatorio diario de turnos
apiVersion: batch/v1
kind: CronJob
metadata:
  name: shift-daily-report
  namespace: velya
  labels:
    app: velya
    component: workforce
    module: shift-reporting
spec:
  # Executa diariamente as 06:00 (antes do turno diurno)
  schedule: '0 6 * * *'
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 30
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 900
      template:
        metadata:
          labels:
            app: velya
            component: shift-daily-report
        spec:
          restartPolicy: OnFailure
          serviceAccountName: velya-shift-verifier
          containers:
            - name: daily-report
              image: velya/shift-verifier:latest
              imagePullPolicy: IfNotPresent
              command:
                - /app/shift-verifier
              args:
                - --mode=report
                - --report-type=daily
                - --include-overtime-summary
                - --include-gap-summary
                - --include-handoff-metrics
                - --include-load-balance-analysis
                - --recipients=coordinators,nursing-directors
              env:
                - name: DATABASE_URL
                  valueFrom:
                    secretKeyRef:
                      name: velya-db-credentials
                      key: connection-string
                - name: SMTP_HOST
                  valueFrom:
                    configMapKeyRef:
                      name: velya-smtp-config
                      key: host
              resources:
                requests:
                  cpu: 200m
                  memory: 512Mi
                limits:
                  cpu: 500m
                  memory: 1Gi
```

---

## 11. Metricas e Dashboards

### 11.1 KPIs

| KPI                           | Meta                                                            | Frequencia |
| ----------------------------- | --------------------------------------------------------------- | ---------- |
| Cobertura de pacientes        | 100% (zero gaps)                                                | Tempo real |
| Handoffs completos no overlap | > 95%                                                           | Por turno  |
| Overtime medio                | < 15 min                                                        | Semanal    |
| Continuidade de profissional  | > 70% (mesmo profissional em turnos consecutivos do mesmo tipo) | Mensal     |
| Carga equilibrada             | Desvio < 30% entre profissionais                                | Por turno  |
| Check-in no horario           | > 98% dos profissionais                                         | Mensal     |

### 11.2 PromQL

```promql
# Pacientes sem responsavel (deve ser SEMPRE 0)
sum by (unit) (velya_patient_without_owner_count)

# Taxa de handoff completo no overlap
sum by (unit) (rate(velya_handoff_completed_in_overlap_total[24h]))
/ sum by (unit) (rate(velya_handoff_total[24h]))

# Overtime medio por unidade
avg by (unit) (velya_shift_overtime_minutes)

# Profissionais em turno ativo por unidade
sum by (unit) (velya_staff_on_duty_count)

# Ratio paciente/profissional por unidade
sum by (unit) (velya_patient_active_count)
/ sum by (unit) (velya_staff_on_duty_count)
```
