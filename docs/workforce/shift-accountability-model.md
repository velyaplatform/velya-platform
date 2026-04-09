# Modelo de Accountability por Turno — Velya Platform

> Definicao de responsabilidades por turno, eventos de inicio/fim, deteccao de gaps de cobertura, rastreamento de horas extras e geracao de resumo de turno.

---

## 1. Principio Fundamental

**Cada turno tem um responsavel explicito para cada funcao. Nenhum periodo sem cobertura. Nenhuma atividade sem dono.**

---

## 2. Modelo de Dados

### 2.1 Definicao de Turno

```typescript
interface Shift {
  shift_id: string;                      // UUID v7
  shift_date: string;                    // Data do turno (YYYY-MM-DD)
  shift_period: ShiftPeriod;             // Periodo
  shift_code: string;                    // Codigo legivel (ex: "D-2026-04-08-UTI-A")

  // --- Temporal ---
  scheduled_start: string;               // Inicio programado
  scheduled_end: string;                 // Fim programado
  actual_start?: string;                 // Inicio real (primeiro check-in)
  actual_end?: string;                   // Fim real (ultimo check-out)

  // --- Lotacao ---
  department_id: string;
  unit_id: string;
  location_ids: string[];                // Locais cobertos

  // --- Equipe ---
  supervisor_id?: string;                // Responsavel do turno
  team_members: ShiftTeamMember[];       // Membros da equipe
  expected_headcount: ExpectedHeadcount; // Quadro esperado

  // --- Status ---
  status: ShiftStatus;
  handoff_status: HandoffStatus;
  coverage_gaps: CoverageGap[];
  overtime_records: OvertimeRecord[];

  // --- Resumo ---
  summary?: ShiftSummary;
}

enum ShiftPeriod {
  DIURNO = 'diurno',             // 07:00 - 19:00
  NOTURNO = 'noturno',           // 19:00 - 07:00
  MANHA = 'manha',               // 07:00 - 13:00
  TARDE = 'tarde',               // 13:00 - 19:00
  INTERMEDIARIO = 'intermediario', // 10:00 - 22:00
  PLANTAO_12H = 'plantao_12h',   // 07:00 - 19:00 ou 19:00 - 07:00
  PLANTAO_24H = 'plantao_24h',   // 07:00 - 07:00
  SOBREAVISO = 'sobreaviso',     // Disponivel remotamente
  ADMINISTRATIVO = 'administrativo', // 08:00 - 17:00
}

enum ShiftStatus {
  PROGRAMADO = 'programado',
  EM_ANDAMENTO = 'em_andamento',
  ENCERRADO = 'encerrado',
  ENCERRADO_INCOMPLETO = 'encerrado_incompleto', // Sem passagem de plantao completa
  CANCELADO = 'cancelado',
}

enum HandoffStatus {
  NAO_INICIADO = 'nao_iniciado',
  EM_ANDAMENTO = 'em_andamento',
  COMPLETO = 'completo',
  INCOMPLETO = 'incompleto',
  ATRASADO = 'atrasado',
}

interface ShiftTeamMember {
  professional_id: string;
  role: ProfessionalRole;
  function: string;
  assignment: string;                    // Area/leitos atribuidos
  check_in_time?: string;
  check_out_time?: string;
  status: MemberStatus;
  coverage_for?: string;                 // Cobrindo quem (se cobertura)
  overtime_minutes?: number;
}

enum MemberStatus {
  ESPERADO = 'esperado',
  PRESENTE = 'presente',
  ATRASADO = 'atrasado',
  AUSENTE = 'ausente',
  SAIU_ANTECIPADO = 'saiu_antecipado',
  HORA_EXTRA = 'hora_extra',
  COBERTURA = 'cobertura',
  SOBREAVISO_ATIVO = 'sobreaviso_ativo',
}

interface ExpectedHeadcount {
  by_role: {
    role: ProfessionalRole;
    minimum: number;
    ideal: number;
    current: number;
  }[];
  total_minimum: number;
  total_ideal: number;
  total_current: number;
}
```

### 2.2 Eventos de Turno

```typescript
interface ShiftEvent {
  event_id: string;
  shift_id: string;
  event_type: ShiftEventType;
  actor_id: string;
  actor_role: ProfessionalRole;
  timestamp: string;
  details: Record<string, unknown>;
  provenance_id: string;
  audit_event_id: string;
}

enum ShiftEventType {
  // Inicio/Fim
  SHIFT_OPENED = 'shift_opened',
  SHIFT_CLOSED = 'shift_closed',

  // Check-in/Check-out
  MEMBER_CHECK_IN = 'member_check_in',
  MEMBER_CHECK_OUT = 'member_check_out',
  MEMBER_LATE_ARRIVAL = 'member_late_arrival',
  MEMBER_EARLY_DEPARTURE = 'member_early_departure',
  MEMBER_NO_SHOW = 'member_no_show',

  // Cobertura
  COVERAGE_GAP_DETECTED = 'coverage_gap_detected',
  COVERAGE_GAP_RESOLVED = 'coverage_gap_resolved',
  COVERAGE_REPLACEMENT = 'coverage_replacement',
  SOBREAVISO_ACTIVATED = 'sobreaviso_activated',

  // Hora extra
  OVERTIME_STARTED = 'overtime_started',
  OVERTIME_ENDED = 'overtime_ended',
  OVERTIME_APPROVED = 'overtime_approved',

  // Handoff
  HANDOFF_INITIATED = 'handoff_initiated',
  HANDOFF_COMPLETED = 'handoff_completed',
  HANDOFF_INCOMPLETE = 'handoff_incomplete',

  // Resumo
  SHIFT_SUMMARY_GENERATED = 'shift_summary_generated',
  SHIFT_SUMMARY_APPROVED = 'shift_summary_approved',

  // Excecoes
  MINIMUM_STAFF_BREACH = 'minimum_staff_breach',
  ASSIGNMENT_CHANGE = 'assignment_change',
  EMERGENCY_REALLOCATION = 'emergency_reallocation',
}
```

### 2.3 Gap de Cobertura

```typescript
interface CoverageGap {
  gap_id: string;
  shift_id: string;
  gap_type: CoverageGapType;
  role_affected: ProfessionalRole;
  unit_affected: string;
  location_affected?: string;
  detected_at: string;
  resolved_at?: string;
  resolution?: string;
  severity: 'critica' | 'alta' | 'media' | 'baixa';
  impact_description: string;
  escalation_level: number;
}

enum CoverageGapType {
  AUSENCIA = 'ausencia',                 // Profissional esperado nao apareceu
  ATRASO = 'atraso',                     // Profissional atrasado
  SAIDA_ANTECIPADA = 'saida_antecipada', // Saiu antes do fim
  ABAIXO_MINIMO = 'abaixo_minimo',       // Quadro abaixo do minimo
  SEM_SUPERVISOR = 'sem_supervisor',     // Sem responsavel de turno
  SEM_COBERTURA_FUNCAO = 'sem_cobertura_funcao', // Funcao sem profissional
  GAP_ENTRE_TURNOS = 'gap_entre_turnos', // Periodo sem cobertura entre turnos
}
```

### 2.4 Hora Extra

```typescript
interface OvertimeRecord {
  overtime_id: string;
  professional_id: string;
  shift_id: string;
  overtime_type: OvertimeType;
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  reason: string;
  approved_by?: string;
  approved_at?: string;
  status: 'em_andamento' | 'concluido' | 'aprovado' | 'rejeitado';
}

enum OvertimeType {
  EXTENSAO_TURNO = 'extensao_turno',     // Ficou alem do horario
  COBERTURA_FALTA = 'cobertura_falta',   // Cobriu ausencia
  DEMANDA_EXTRA = 'demanda_extra',       // Demanda acima do normal
  EMERGENCIA = 'emergencia',             // Situacao emergencial
}
```

### 2.5 Resumo de Turno

```typescript
interface ShiftSummary {
  shift_id: string;
  generated_at: string;
  generated_by: string;                  // Sistema ou supervisor

  // Indicadores
  total_work_events: number;
  events_by_category: Record<string, number>;
  total_handoffs_initiated: number;
  total_handoffs_completed: number;
  total_handoffs_pending: number;

  // Equipe
  team_present: number;
  team_expected: number;
  coverage_percentage: number;
  overtime_total_minutes: number;
  gaps_detected: number;
  gaps_resolved: number;

  // SLA
  sla_compliance_rate: number;           // 0-100%
  sla_breaches: number;

  // Pendencias
  pending_items_received: number;        // Recebidos do turno anterior
  pending_items_resolved: number;        // Resolvidos neste turno
  pending_items_forwarded: number;       // Passados para o proximo
  new_pending_items: number;             // Novos criados neste turno

  // Excecoes
  exceptions_count: number;
  escalations_count: number;
  corrections_count: number;

  // Destaques
  highlights: string[];                  // Itens relevantes
  alerts: string[];                      // Alertas ativos
  cross_shift_items: CrossShiftItem[];   // Itens que cruzam turnos
}

interface CrossShiftItem {
  item_id: string;
  description: string;
  originated_shift: string;
  current_responsible?: string;
  priority: Priority;
  status: string;
  age_hours: number;
}
```

---

## 3. Tabela de Turnos por Area

| Area | Periodos | Duracao | Quadro Minimo | Supervisor |
|---|---|---|---|---|
| UTI Adulto | D/N 12h | 12h | 1 enf : 2 leitos, 1 tec : 1 leito, 1 med plantonista | Enfermeiro lider |
| UTI Neonatal | D/N 12h | 12h | 1 enf : 2 leitos, 1 tec : 1 leito, 1 neonatologista | Enfermeiro lider |
| Enfermaria | D/N 12h | 12h | 1 enf : 10 leitos, 1 tec : 5 leitos | Enfermeiro lider |
| Pronto Atendimento | D/N 12h | 12h | 2 med, 2 enf, 4 tec, 1 recep | Medico plantonista |
| Centro Cirurgico | M/T 6h | 6h | Conforme agenda + 1 equipe emergencia | Enfermeiro CC |
| Laboratorio | D/N 12h | 12h | 1 biomedico, 2 tec lab | Biomedico responsavel |
| Imagem | D (12h) / N (sobreaviso) | 12h/sob | 1 tec radio, 1 radiologista (sob) | Tec radio lider |
| Farmacia | D (12h) / N (sob) | 12h/sob | 1 farmaceutico, 2 tec farmacia | Farmaceutico |
| Higienizacao | D/N 12h | 12h | Conforme m2 coberto | Supervisor higienizacao |
| Transporte | D/N 12h | 12h | 2 maqueiros / andar | Supervisor transporte |
| Manutencao | D (8h) / N (sob) | 8h/sob | 1 tec manutencao | Supervisor manutencao |
| Seguranca | D/N 12h | 12h | Conforme portaria | Supervisor seguranca |
| Recepcao | D/N 12h | 12h | 1 recep / ponto de atendimento | Supervisor recepcao |
| Nutricao | M/T/N | Variavel | Conforme producao | Nutricionista chefe |

---

## 4. CronJob de Deteccao de Gaps

### 4.1 Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: shift-gap-detector
  namespace: velya-workforce
  labels:
    app: velya
    component: workforce
    function: gap-detection
spec:
  schedule: "*/5 * * * *"  # A cada 5 minutos
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 24
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      backoffLimit: 3
      activeDeadlineSeconds: 120
      template:
        metadata:
          labels:
            app: velya
            component: shift-gap-detector
        spec:
          restartPolicy: OnFailure
          serviceAccountName: velya-workforce-sa
          containers:
            - name: gap-detector
              image: velya/workforce-gap-detector:latest
              imagePullPolicy: IfNotPresent
              env:
                - name: DATABASE_URL
                  valueFrom:
                    secretKeyRef:
                      name: velya-db-credentials
                      key: connection-string
                - name: NATS_URL
                  value: "nats://nats.velya-infra:4222"
                - name: NATS_CREDS
                  valueFrom:
                    secretKeyRef:
                      name: velya-nats-credentials
                      key: workforce-creds
                - name: CHECK_INTERVAL_MINUTES
                  value: "5"
                - name: GAP_TOLERANCE_MINUTES
                  value: "15"
                - name: ALERT_WEBHOOK_URL
                  valueFrom:
                    configMapKeyRef:
                      name: velya-workforce-config
                      key: alert-webhook-url
              resources:
                requests:
                  memory: "128Mi"
                  cpu: "100m"
                limits:
                  memory: "256Mi"
                  cpu: "200m"
```

### 4.2 Logica de Deteccao

```typescript
interface GapDetectionConfig {
  check_interval_minutes: number;
  gap_tolerance_minutes: number;
  checks: GapCheck[];
}

const gapDetectionConfig: GapDetectionConfig = {
  check_interval_minutes: 5,
  gap_tolerance_minutes: 15,
  checks: [
    {
      check_id: 'SGC-001',
      name: 'Turno sem supervisor',
      query: `
        SELECT s.shift_id, s.department_id, s.unit_id
        FROM shifts s
        WHERE s.status = 'em_andamento'
          AND s.supervisor_id IS NULL
          AND NOW() > s.scheduled_start + INTERVAL '15 minutes'
      `,
      severity: 'critica',
      action: 'alert_and_escalate',
    },
    {
      check_id: 'SGC-002',
      name: 'Quadro abaixo do minimo',
      query: `
        SELECT s.shift_id, s.department_id, s.unit_id,
               s.expected_headcount->>'total_minimum' as minimum,
               COUNT(stm.*) FILTER (WHERE stm.status = 'presente') as present
        FROM shifts s
        LEFT JOIN shift_team_members stm ON s.shift_id = stm.shift_id
        WHERE s.status = 'em_andamento'
        GROUP BY s.shift_id
        HAVING COUNT(stm.*) FILTER (WHERE stm.status = 'presente') 
               < (s.expected_headcount->>'total_minimum')::int
      `,
      severity: 'alta',
      action: 'alert_supervisor',
    },
    {
      check_id: 'SGC-003',
      name: 'Gap entre turnos',
      query: `
        SELECT d.department_id, d.unit_id,
               prev.scheduled_end as previous_end,
               next.scheduled_start as next_start,
               EXTRACT(EPOCH FROM (next.scheduled_start - prev.scheduled_end)) / 60 as gap_minutes
        FROM departments d
        CROSS JOIN LATERAL (
          SELECT scheduled_end FROM shifts 
          WHERE department_id = d.department_id AND status = 'encerrado'
          ORDER BY scheduled_end DESC LIMIT 1
        ) prev
        CROSS JOIN LATERAL (
          SELECT scheduled_start FROM shifts
          WHERE department_id = d.department_id AND status IN ('programado', 'em_andamento')
          ORDER BY scheduled_start ASC LIMIT 1
        ) next
        WHERE next.scheduled_start - prev.scheduled_end > INTERVAL '15 minutes'
      `,
      severity: 'critica',
      action: 'alert_and_escalate',
    },
    {
      check_id: 'SGC-004',
      name: 'Profissional em hora extra prolongada',
      query: `
        SELECT stm.professional_id, s.shift_id, s.department_id,
               EXTRACT(EPOCH FROM (NOW() - s.scheduled_end)) / 60 as overtime_minutes
        FROM shift_team_members stm
        JOIN shifts s ON stm.shift_id = s.shift_id
        WHERE stm.status = 'hora_extra'
          AND NOW() > s.scheduled_end + INTERVAL '120 minutes'
      `,
      severity: 'alta',
      action: 'alert_supervisor',
    },
    {
      check_id: 'SGC-005',
      name: 'Handoff de turno nao iniciado',
      query: `
        SELECT s.shift_id, s.department_id, s.unit_id
        FROM shifts s
        WHERE s.status = 'em_andamento'
          AND NOW() > s.scheduled_end - INTERVAL '30 minutes'
          AND s.handoff_status = 'nao_iniciado'
      `,
      severity: 'alta',
      action: 'alert_supervisor',
    },
    {
      check_id: 'SGC-006',
      name: 'Funcao sem cobertura',
      query: `
        SELECT s.shift_id, s.department_id, role_req.role,
               role_req.minimum as required,
               COUNT(stm.*) FILTER (WHERE stm.status = 'presente') as present
        FROM shifts s
        CROSS JOIN LATERAL jsonb_to_recordset(s.expected_headcount->'by_role')
          AS role_req(role TEXT, minimum INT, ideal INT)
        LEFT JOIN shift_team_members stm 
          ON s.shift_id = stm.shift_id AND stm.role = role_req.role
        WHERE s.status = 'em_andamento'
        GROUP BY s.shift_id, s.department_id, role_req.role, role_req.minimum
        HAVING COUNT(stm.*) FILTER (WHERE stm.status = 'presente') < role_req.minimum
      `,
      severity: 'critica',
      action: 'alert_and_escalate',
    },
  ],
};

interface GapCheck {
  check_id: string;
  name: string;
  query: string;
  severity: 'critica' | 'alta' | 'media' | 'baixa';
  action: 'alert_and_escalate' | 'alert_supervisor' | 'log_only';
}
```

---

## 5. NATS Subjects para Turnos

```yaml
subjects:
  - "velya.shift.opened"
  - "velya.shift.closed"
  - "velya.shift.member.checkin"
  - "velya.shift.member.checkout"
  - "velya.shift.member.late"
  - "velya.shift.member.noshow"
  - "velya.shift.gap.detected"
  - "velya.shift.gap.resolved"
  - "velya.shift.overtime.started"
  - "velya.shift.overtime.ended"
  - "velya.shift.overtime.approved"
  - "velya.shift.handoff.initiated"
  - "velya.shift.handoff.completed"
  - "velya.shift.handoff.incomplete"
  - "velya.shift.summary.generated"
  - "velya.shift.minimum_breach"
  - "velya.shift.emergency_reallocation"
```

---

## 6. PostgreSQL Schema

```sql
CREATE TABLE shifts (
    shift_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_date          DATE NOT NULL,
    shift_period        TEXT NOT NULL,
    shift_code          TEXT NOT NULL UNIQUE,
    scheduled_start     TIMESTAMPTZ NOT NULL,
    scheduled_end       TIMESTAMPTZ NOT NULL,
    actual_start        TIMESTAMPTZ,
    actual_end          TIMESTAMPTZ,
    department_id       UUID NOT NULL,
    unit_id             UUID NOT NULL,
    location_ids        UUID[] DEFAULT '{}',
    supervisor_id       UUID,
    expected_headcount  JSONB NOT NULL,
    status              TEXT NOT NULL DEFAULT 'programado',
    handoff_status      TEXT NOT NULL DEFAULT 'nao_iniciado',
    summary             JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shift_team_members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id            UUID NOT NULL REFERENCES shifts(shift_id),
    professional_id     UUID NOT NULL,
    role                TEXT NOT NULL,
    function            TEXT NOT NULL,
    assignment          TEXT,
    check_in_time       TIMESTAMPTZ,
    check_out_time      TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'esperado',
    coverage_for        UUID,
    overtime_minutes    INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shift_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id            UUID NOT NULL REFERENCES shifts(shift_id),
    event_type          TEXT NOT NULL,
    actor_id            UUID NOT NULL,
    actor_role          TEXT NOT NULL,
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details             JSONB DEFAULT '{}',
    provenance_id       TEXT,
    audit_event_id      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE coverage_gaps (
    gap_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id            UUID NOT NULL REFERENCES shifts(shift_id),
    gap_type            TEXT NOT NULL,
    role_affected       TEXT NOT NULL,
    unit_affected       UUID NOT NULL,
    location_affected   UUID,
    detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ,
    resolution          TEXT,
    severity            TEXT NOT NULL,
    impact_description  TEXT NOT NULL,
    escalation_level    INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE overtime_records (
    overtime_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id     UUID NOT NULL,
    shift_id            UUID NOT NULL REFERENCES shifts(shift_id),
    overtime_type       TEXT NOT NULL,
    start_time          TIMESTAMPTZ NOT NULL,
    end_time            TIMESTAMPTZ,
    duration_minutes    INTEGER,
    reason              TEXT NOT NULL,
    approved_by         UUID,
    approved_at         TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'em_andamento',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_shifts_date_dept ON shifts(shift_date, department_id);
CREATE INDEX idx_shifts_status ON shifts(status) WHERE status = 'em_andamento';
CREATE INDEX idx_shift_members_shift ON shift_team_members(shift_id);
CREATE INDEX idx_shift_members_prof ON shift_team_members(professional_id, shift_id);
CREATE INDEX idx_shift_events_shift ON shift_events(shift_id, timestamp DESC);
CREATE INDEX idx_coverage_gaps_open ON coverage_gaps(shift_id) WHERE resolved_at IS NULL;
CREATE INDEX idx_overtime_pending ON overtime_records(status) WHERE status = 'em_andamento';
```

---

## 7. Metricas Prometheus

```yaml
metrics:
  - name: velya_shift_coverage_ratio
    type: gauge
    labels: [department, unit, shift_period]
    help: "Razao de cobertura do turno (presente/esperado)"

  - name: velya_shift_gaps_active
    type: gauge
    labels: [department, unit, gap_type, severity]
    help: "Gaps de cobertura ativos"

  - name: velya_shift_overtime_minutes_total
    type: counter
    labels: [department, unit, overtime_type]
    help: "Total de minutos de hora extra"

  - name: velya_shift_handoff_completion_ratio
    type: gauge
    labels: [department, unit]
    help: "Taxa de completude de handoff de turno"

  - name: velya_shift_late_arrivals_total
    type: counter
    labels: [department, unit, role]
    help: "Total de chegadas atrasadas"

  - name: velya_shift_no_shows_total
    type: counter
    labels: [department, unit, role]
    help: "Total de ausencias"

  - name: velya_shift_pending_items_cross_shift
    type: gauge
    labels: [department, unit, priority]
    help: "Itens pendentes que cruzaram turnos"

  - name: velya_shift_summary_generated
    type: counter
    labels: [department, unit]
    help: "Resumos de turno gerados"
```

---

## 8. Regras de Negocio

| ID | Regra | Descricao |
|---|---|---|
| S001 | Turno nao inicia sem supervisor | O status so muda para 'em_andamento' com supervisor presente |
| S002 | Check-in obrigatorio | Todo membro deve registrar entrada |
| S003 | Check-out obrigatorio | Todo membro deve registrar saida |
| S004 | Atraso > 15 min gera alerta | Notificacao ao supervisor e deteccao de gap |
| S005 | Ausencia sem justificativa gera gap critico | Escalacao automatica |
| S006 | Hora extra > 2h requer aprovacao | Supervisor deve aprovar |
| S007 | Handoff deve iniciar 30 min antes do fim | Alerta se nao iniciado |
| S008 | Resumo de turno e obrigatorio | Gerado automaticamente, revisado pelo supervisor |
| S009 | Quadro abaixo do minimo gera alerta critico | Escalacao imediata |
| S010 | Pendencias cross-shift devem ter responsavel | Nenhum item orphan entre turnos |

---

## 9. Fluxo de Vida do Turno

```
[Turno Programado]
       |
       v
[Supervisor check-in] --> SHIFT_OPENED
       |
       v
[Membros check-in] --> MEMBER_CHECK_IN
       |                    |
       |              [Atraso?] --> MEMBER_LATE_ARRIVAL --> Gap detection
       |              [Ausente?] --> MEMBER_NO_SHOW --> Gap detection
       |
       v
[Turno em andamento]
       |
       +-- [Atividades reportadas via WorkEvents]
       +-- [Gaps detectados a cada 5 min] --> COVERAGE_GAP_DETECTED
       +-- [Hora extra detectada] --> OVERTIME_STARTED
       |
       v
[30 min antes do fim]
       |
       v
[Handoff iniciado] --> HANDOFF_INITIATED
       |
       v
[Passagem estruturada I-PASS]
       |
       v
[Handoff aceito pelo proximo turno] --> HANDOFF_COMPLETED
       |
       v
[Resumo gerado] --> SHIFT_SUMMARY_GENERATED
       |
       v
[Membros check-out] --> MEMBER_CHECK_OUT
       |
       v
[Turno encerrado] --> SHIFT_CLOSED
```

---

## 10. Resumo

O modelo de accountability por turno garante:

1. **Cobertura verificavel** — Cada turno tem quadro esperado vs real.
2. **Deteccao automatica de gaps** — CronJob a cada 5 minutos.
3. **Escalacao de ausencias** — Gaps criticos escalam automaticamente.
4. **Hora extra rastreada** — Toda extensao registrada e aprovada.
5. **Handoff obrigatorio** — Passagem de turno estruturada com aceite.
6. **Resumo automatico** — Indicadores de turno gerados ao fim.
7. **Pendencias rastreadas** — Itens cross-shift sempre com responsavel.
