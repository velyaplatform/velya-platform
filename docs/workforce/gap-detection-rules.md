# Regras de Deteccao de Gaps — Velya Platform

> Deteccao automatica de gaps: atividade sem reporte, handoff sem aceite, chamado sem resposta, correcao tardia, acesso suspeito, areas sem reporte, e mais.

---

## 1. Principio Fundamental

**O sistema detecta automaticamente situacoes que indicam falha de processo, risco ao paciente, desvio de protocolo ou possivel fraude. Cada gap tem severidade, resposta automatizada e responsavel.**

---

## 2. Modelo de Dados

### 2.1 Regra de Deteccao

```typescript
interface GapDetectionRule {
  rule_id: string;
  name: string;
  description: string;
  category: GapCategory;
  severity: GapSeverity;

  // Deteccao
  detection: {
    type: 'query' | 'stream' | 'cron';
    query?: string;                      // SQL para deteccao por query
    stream_filter?: string;              // NATS subject para deteccao por stream
    cron_schedule?: string;              // Cron para deteccao periodica
    lookback_minutes: number;            // Janela de analise
    threshold?: number;                  // Limiar para disparo
  };

  // Resposta
  response: {
    automated_actions: AutomatedAction[];
    notification_targets: string[];
    escalation_chain?: EscalationChain[];
    dashboard_visibility: boolean;
    requires_resolution: boolean;
    resolution_sla_hours?: number;
  };

  // Contexto
  applies_to: string[];                 // Departamentos/areas
  active: boolean;
  last_triggered?: string;
}

enum GapCategory {
  REPORTE = 'reporte',                   // Falha de reporte
  HANDOFF = 'handoff',                   // Falha de handoff
  COMUNICACAO = 'comunicacao',           // Falha de comunicacao
  EVIDENCIA = 'evidencia',              // Falta de evidencia
  CORRECAO = 'correcao',                // Correcao irregular
  ACESSO = 'acesso',                    // Acesso suspeito
  SESSAO = 'sessao',                    // Anomalia de sessao
  COBERTURA = 'cobertura',              // Gap de cobertura
  SLA = 'sla',                          // Estouro de SLA
  PROCESSO = 'processo',                // Desvio de processo
}

enum GapSeverity {
  CRITICA = 'critica',                   // Risco imediato, acao em minutos
  ALTA = 'alta',                         // Risco elevado, acao em horas
  MEDIA = 'media',                       // Desvio importante, acao em 24h
  BAIXA = 'baixa',                       // Alerta informativo, revisao periodica
}

interface AutomatedAction {
  action_type: 'alert' | 'block' | 'escalate' | 'log' | 'create_task' | 'send_notification';
  target?: string;
  channel?: 'dashboard' | 'push' | 'sms' | 'email';
  message_template?: string;
  delay_seconds?: number;
}
```

---

## 3. Catalogo de Regras de Deteccao

### 3.1 Gaps de Reporte

```typescript
const reporteGapRules: GapDetectionRule[] = [
  {
    rule_id: 'GAP-REP-001',
    name: 'Atividade sem reporte',
    description: 'Paciente com encounter ativo mas sem WorkEvent nas ultimas 4 horas',
    category: GapCategory.REPORTE,
    severity: GapSeverity.ALTA,
    detection: {
      type: 'cron',
      cron_schedule: '*/30 * * * *',
      query: `
        SELECT e.encounter_id, e.patient_id, e.unit_id,
               MAX(we.timestamp) as ultimo_evento,
               EXTRACT(EPOCH FROM (NOW() - MAX(we.timestamp))) / 3600 as horas_sem_evento
        FROM encounters e
        LEFT JOIN work_events we ON e.encounter_id = we.encounter_id
        WHERE e.status = 'in-progress'
          AND e.class IN ('IMP', 'EMER')
        GROUP BY e.encounter_id, e.patient_id, e.unit_id
        HAVING MAX(we.timestamp) < NOW() - INTERVAL '4 hours'
           OR MAX(we.timestamp) IS NULL
      `,
      lookback_minutes: 240,
    },
    response: {
      automated_actions: [
        { action_type: 'alert', target: 'enfermeiro_lider', channel: 'push' },
        { action_type: 'create_task', target: 'unidade' },
      ],
      notification_targets: ['enfermeiro_lider', 'supervisor_unidade'],
      dashboard_visibility: true,
      requires_resolution: true,
      resolution_sla_hours: 2,
    },
    applies_to: ['todas_unidades_internacao'],
    active: true,
  },
  {
    rule_id: 'GAP-REP-002',
    name: 'Departamento sem reporte por turno',
    description: 'Departamento operacional sem nenhum WorkEvent no turno vigente',
    category: GapCategory.REPORTE,
    severity: GapSeverity.MEDIA,
    detection: {
      type: 'cron',
      cron_schedule: '0 */2 * * *',
      query: `
        SELECT d.department_id, d.name, s.shift_id, s.shift_period,
               COUNT(we.event_id) as eventos_turno
        FROM departments d
        JOIN shifts s ON d.department_id = s.department_id AND s.status = 'em_andamento'
        LEFT JOIN work_events we ON d.department_id = we.department_id
          AND we.shift_id = s.shift_id
        GROUP BY d.department_id, d.name, s.shift_id, s.shift_period
        HAVING COUNT(we.event_id) = 0
          AND EXTRACT(EPOCH FROM (NOW() - s.scheduled_start)) / 3600 > 2
      `,
      lookback_minutes: 120,
    },
    response: {
      automated_actions: [
        { action_type: 'alert', target: 'supervisor_departamento', channel: 'push' },
      ],
      notification_targets: ['supervisor_departamento', 'admin_unidade'],
      dashboard_visibility: true,
      requires_resolution: true,
      resolution_sla_hours: 4,
    },
    applies_to: ['todos_departamentos'],
    active: true,
  },
  {
    rule_id: 'GAP-REP-003',
    name: 'Area recebendo demanda mas nao fechando fluxo',
    description: 'Departamento recebe acionamentos mas taxa de conclusao < 50% no turno',
    category: GapCategory.PROCESSO,
    severity: GapSeverity.ALTA,
    detection: {
      type: 'cron',
      cron_schedule: '*/30 * * * *',
      query: `
        SELECT department_id,
               COUNT(*) FILTER (WHERE delivery_status IN ('pendente', 'em_execucao')) as abertos,
               COUNT(*) FILTER (WHERE delivery_status = 'concluido') as concluidos,
               COUNT(*) as total,
               ROUND(COUNT(*) FILTER (WHERE delivery_status = 'concluido')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as taxa_conclusao
        FROM work_events
        WHERE shift_id = (SELECT shift_id FROM shifts WHERE status = 'em_andamento' AND department_id = work_events.department_id LIMIT 1)
        GROUP BY department_id
        HAVING COUNT(*) > 5
          AND COUNT(*) FILTER (WHERE delivery_status = 'concluido')::numeric / NULLIF(COUNT(*), 0) < 0.5
      `,
      lookback_minutes: 360,
    },
    response: {
      automated_actions: [
        { action_type: 'alert', target: 'coordenador_departamento', channel: 'push' },
        { action_type: 'log' },
      ],
      notification_targets: ['coordenador_departamento'],
      dashboard_visibility: true,
      requires_resolution: true,
      resolution_sla_hours: 4,
    },
    applies_to: ['higienizacao', 'transporte', 'manutencao', 'farmacia'],
    active: true,
  },
];
```

### 3.2 Gaps de Handoff

```typescript
const handoffGapRules: GapDetectionRule[] = [
  {
    rule_id: 'GAP-HND-001',
    name: 'Handoff sem aceite',
    description: 'Handoff iniciado ha mais de 30 minutos sem aceite',
    category: GapCategory.HANDOFF,
    severity: GapSeverity.ALTA,
    detection: {
      type: 'cron',
      cron_schedule: '*/5 * * * *',
      query: `
        SELECT h.handoff_id, h.handoff_type, h.origin_unit_id, h.destination_unit_id,
               h.priority, h.initiated_at,
               EXTRACT(EPOCH FROM (NOW() - h.initiated_at)) / 60 as minutos_pendente
        FROM handoffs h
        WHERE h.acceptance_status = 'aguardando'
          AND NOW() > h.initiated_at + (h.sla_target_minutes || ' minutes')::INTERVAL
      `,
      lookback_minutes: 60,
    },
    response: {
      automated_actions: [
        { action_type: 'escalate', target: 'coordenador_destino', channel: 'push' },
        { action_type: 'alert', target: 'enfermeiro_lider_destino', channel: 'push' },
      ],
      notification_targets: ['coordenador_destino', 'enfermeiro_lider_destino'],
      escalation_chain: [
        { level: 1, role: 'enfermeiro_lider', timeout_minutes: 15, action: 'notify' },
        { level: 2, role: 'coordenador', timeout_minutes: 30, action: 'assign' },
        { level: 3, role: 'direcao_tecnica', timeout_minutes: 60, action: 'override' },
      ],
      dashboard_visibility: true,
      requires_resolution: true,
      resolution_sla_hours: 1,
    },
    applies_to: ['todas_unidades'],
    active: true,
  },
  {
    rule_id: 'GAP-HND-002',
    name: 'Passagem de plantao incompleta',
    description: 'Turno encerrado sem handoff completo para todos os pacientes',
    category: GapCategory.HANDOFF,
    severity: GapSeverity.CRITICA,
    detection: {
      type: 'stream',
      stream_filter: 'velya.shift.closed',
      query: `
        SELECT s.shift_id, s.unit_id,
               COUNT(DISTINCT e.patient_id) as pacientes_unidade,
               COUNT(DISTINCT h.patient_id) as pacientes_com_handoff
        FROM shifts s
        JOIN encounters e ON e.unit_id = s.unit_id AND e.status = 'in-progress'
        LEFT JOIN handoffs h ON h.origin_shift_id = s.shift_id AND h.patient_id = e.patient_id
          AND h.acceptance_status IN ('aceito', 'aceito_com_ressalva')
        WHERE s.shift_id = $1
        GROUP BY s.shift_id, s.unit_id
        HAVING COUNT(DISTINCT h.patient_id) < COUNT(DISTINCT e.patient_id)
      `,
      lookback_minutes: 30,
    },
    response: {
      automated_actions: [
        { action_type: 'alert', target: 'enfermeiro_lider', channel: 'push' },
        { action_type: 'alert', target: 'supervisor_unidade', channel: 'sms' },
        { action_type: 'block' }, // Impede fechar turno como "completo"
      ],
      notification_targets: ['enfermeiro_lider', 'supervisor_unidade'],
      dashboard_visibility: true,
      requires_resolution: true,
      resolution_sla_hours: 0.5,
    },
    applies_to: ['todas_unidades_internacao'],
    active: true,
  },
];
```

### 3.3 Gaps de Comunicacao

```typescript
const comunicacaoGapRules: GapDetectionRule[] = [
  {
    rule_id: 'GAP-COM-001',
    name: 'Chamado sem resposta',
    description: 'Chamada de paciente sem resposta em 10 minutos',
    category: GapCategory.COMUNICACAO,
    severity: GapSeverity.ALTA,
    detection: {
      type: 'cron',
      cron_schedule: '*/2 * * * *',
      query: `
        SELECT we.event_id, we.patient_id, we.location_id, we.timestamp,
               EXTRACT(EPOCH FROM (NOW() - we.timestamp)) / 60 as minutos_sem_resposta
        FROM work_events we
        WHERE we.event_type = 'chamada_paciente'
          AND NOT EXISTS (
            SELECT 1 FROM work_events resp
            WHERE resp.event_type = 'resposta_chamada'
              AND resp.patient_id = we.patient_id
              AND resp.timestamp > we.timestamp
          )
          AND we.timestamp < NOW() - INTERVAL '10 minutes'
          AND we.timestamp > NOW() - INTERVAL '60 minutes'
      `,
      lookback_minutes: 60,
    },
    response: {
      automated_actions: [
        { action_type: 'alert', target: 'enfermeiro_responsavel', channel: 'push' },
        { action_type: 'alert', target: 'enfermeiro_lider', channel: 'push', delay_seconds: 300 },
      ],
      notification_targets: ['enfermeiro_responsavel', 'enfermeiro_lider'],
      dashboard_visibility: true,
      requires_resolution: true,
      resolution_sla_hours: 0.5,
    },
    applies_to: ['todas_unidades_internacao'],
    active: true,
  },
  {
    rule_id: 'GAP-COM-002',
    name: 'Valor critico sem comunicacao',
    description: 'Resultado critico de laboratorio sem comunicacao closed-loop em 10 minutos',
    category: GapCategory.COMUNICACAO,
    severity: GapSeverity.CRITICA,
    detection: {
      type: 'stream',
      stream_filter: 'velya.work.apoio.resultado_exame',
      query: `
        SELECT we.event_id, we.patient_id, we.timestamp
        FROM work_events we
        WHERE we.event_type = 'resultado_exame'
          AND we.metadata->>'is_critical' = 'true'
          AND NOT EXISTS (
            SELECT 1 FROM work_events comm
            WHERE comm.event_type = 'comunicacao_valor_critico'
              AND comm.patient_id = we.patient_id
              AND comm.timestamp > we.timestamp
              AND comm.timestamp < we.timestamp + INTERVAL '10 minutes'
          )
          AND we.timestamp < NOW() - INTERVAL '10 minutes'
      `,
      lookback_minutes: 30,
    },
    response: {
      automated_actions: [
        { action_type: 'alert', target: 'biomedico_responsavel', channel: 'push' },
        { action_type: 'alert', target: 'coordenador_lab', channel: 'sms' },
        { action_type: 'escalate', target: 'direcao_tecnica', channel: 'phone' },
      ],
      notification_targets: ['biomedico_responsavel', 'coordenador_lab', 'direcao_tecnica'],
      dashboard_visibility: true,
      requires_resolution: true,
      resolution_sla_hours: 0.25,
    },
    applies_to: ['laboratorio'],
    active: true,
  },
];
```

### 3.4 Gaps de Evidencia e Processo

```typescript
const evidenciaGapRules: GapDetectionRule[] = [
  {
    rule_id: 'GAP-EVD-001',
    name: 'Tarefa fechada sem evidencia minima',
    description: 'WorkEvent com delivery_status=concluido mas duracao < 1 minuto ou sem campos obrigatorios',
    category: GapCategory.EVIDENCIA,
    severity: GapSeverity.MEDIA,
    detection: {
      type: 'stream',
      stream_filter: 'velya.work.>',
      query: `
        SELECT event_id, event_type, actor_id, department_id,
               duration_minutes, action_performed
        FROM work_events
        WHERE delivery_status = 'concluido'
          AND (duration_minutes IS NULL OR duration_minutes < 1)
          AND event_type NOT IN ('login', 'logout', 'aceite_tarefa')
          AND timestamp > NOW() - INTERVAL '1 hour'
      `,
      lookback_minutes: 60,
    },
    response: {
      automated_actions: [
        { action_type: 'log' },
        { action_type: 'create_task', target: 'supervisor_area' },
      ],
      notification_targets: ['supervisor_area'],
      dashboard_visibility: true,
      requires_resolution: false,
    },
    applies_to: ['todos_departamentos'],
    active: true,
  },
  {
    rule_id: 'GAP-EVD-002',
    name: 'Texto livre excessivo em vez de estruturado',
    description: 'Profissional usando campos de texto livre quando estruturado esta disponivel (>70% texto livre)',
    category: GapCategory.PROCESSO,
    severity: GapSeverity.BAIXA,
    detection: {
      type: 'cron',
      cron_schedule: '0 */6 * * *',
      query: `
        SELECT actor_id, actor_role,
               COUNT(*) FILTER (WHERE action_code IS NULL AND LENGTH(action_performed) > 50) as texto_livre,
               COUNT(*) as total,
               ROUND(COUNT(*) FILTER (WHERE action_code IS NULL)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct_texto_livre
        FROM work_events
        WHERE timestamp > NOW() - INTERVAL '24 hours'
          AND event_type NOT IN ('login', 'logout')
        GROUP BY actor_id, actor_role
        HAVING COUNT(*) > 10
          AND COUNT(*) FILTER (WHERE action_code IS NULL)::numeric / NULLIF(COUNT(*), 0) > 0.7
      `,
      lookback_minutes: 1440,
    },
    response: {
      automated_actions: [
        { action_type: 'log' },
      ],
      notification_targets: ['qualidade', 'ti'],
      dashboard_visibility: true,
      requires_resolution: false,
    },
    applies_to: ['todos_departamentos'],
    active: true,
  },
];
```

### 3.5 Gaps de Acesso e Sessao

```typescript
const acessoGapRules: GapDetectionRule[] = [
  {
    rule_id: 'GAP-ACE-001',
    name: 'Acesso sem relacao assistencial',
    description: 'Profissional acessou prontuario de paciente fora de sua unidade/CareTeam',
    category: GapCategory.ACESSO,
    severity: GapSeverity.ALTA,
    detection: {
      type: 'stream',
      stream_filter: 'velya.session.>',
      query: `
        SELECT sae.event_id, sae.user_id, sae.session_id,
               sae.details->>'patient_id' as patient_id,
               sae.unit_id as user_unit,
               e.unit_id as patient_unit
        FROM session_audit_events sae
        JOIN encounters e ON e.patient_id = (sae.details->>'patient_id')::UUID
        WHERE sae.event_type = 'acesso_prontuario'
          AND sae.unit_id != e.unit_id
          AND NOT EXISTS (
            SELECT 1 FROM care_team_members ctm
            WHERE ctm.practitioner_id = sae.user_id
              AND ctm.encounter_id = e.encounter_id
          )
          AND sae.details->>'break_glass' IS DISTINCT FROM 'true'
      `,
      lookback_minutes: 60,
    },
    response: {
      automated_actions: [
        { action_type: 'alert', target: 'auditoria', channel: 'dashboard' },
        { action_type: 'log' },
      ],
      notification_targets: ['auditoria', 'dpo'],
      dashboard_visibility: true,
      requires_resolution: true,
      resolution_sla_hours: 24,
    },
    applies_to: ['todos_profissionais_clinicos'],
    active: true,
  },
  {
    rule_id: 'GAP-ACE-002',
    name: 'Trocas de usuario suspeitas',
    description: 'Mais de 10 trocas de usuario no mesmo dispositivo em 1 hora',
    category: GapCategory.SESSAO,
    severity: GapSeverity.ALTA,
    detection: {
      type: 'cron',
      cron_schedule: '*/15 * * * *',
      query: `
        SELECT device_id, unit_id,
               COUNT(*) as trocas,
               array_agg(DISTINCT user_id) as usuarios
        FROM session_audit_events
        WHERE event_type IN ('user_switch_in', 'user_switch_out')
          AND timestamp > NOW() - INTERVAL '1 hour'
        GROUP BY device_id, unit_id
        HAVING COUNT(*) > 10
      `,
      lookback_minutes: 60,
    },
    response: {
      automated_actions: [
        { action_type: 'alert', target: 'ti', channel: 'push' },
        { action_type: 'alert', target: 'seguranca', channel: 'push' },
      ],
      notification_targets: ['ti', 'seguranca', 'auditoria'],
      dashboard_visibility: true,
      requires_resolution: true,
      resolution_sla_hours: 4,
    },
    applies_to: ['todos_dispositivos'],
    active: true,
  },
  {
    rule_id: 'GAP-ACE-003',
    name: 'Usuario ativo em contextos incompativeis',
    description: 'Mesmo usuario com sessoes ativas em unidades incompativeis simultaneamente',
    category: GapCategory.SESSAO,
    severity: GapSeverity.ALTA,
    detection: {
      type: 'cron',
      cron_schedule: '*/10 * * * *',
      query: `
        SELECT user_id,
               array_agg(DISTINCT unit_id) as unidades,
               COUNT(DISTINCT unit_id) as num_unidades
        FROM sessions
        WHERE status = 'ativo'
        GROUP BY user_id
        HAVING COUNT(DISTINCT unit_id) > 1
      `,
      lookback_minutes: 10,
    },
    response: {
      automated_actions: [
        { action_type: 'alert', target: 'ti', channel: 'push' },
      ],
      notification_targets: ['ti', 'auditoria'],
      dashboard_visibility: true,
      requires_resolution: true,
      resolution_sla_hours: 2,
    },
    applies_to: ['todos_usuarios'],
    active: true,
  },
  {
    rule_id: 'GAP-ACE-004',
    name: 'Edicao de registro critico fora de janela',
    description: 'Edicao de registro clinico apos 24h da criacao sem justificativa formal',
    category: GapCategory.CORRECAO,
    severity: GapSeverity.ALTA,
    detection: {
      type: 'stream',
      stream_filter: 'velya.work.correcao.>',
      query: `
        SELECT we.event_id, we.actor_id, we.event_type,
               we.timestamp as correcao_timestamp,
               original.timestamp as original_timestamp,
               EXTRACT(EPOCH FROM (we.timestamp - original.timestamp)) / 3600 as horas_desde_original
        FROM work_events we
        JOIN work_events original ON we.supersedes = original.event_id
        WHERE we.category = 'correcao'
          AND EXTRACT(EPOCH FROM (we.timestamp - original.timestamp)) / 3600 > 24
          AND (we.metadata->>'justificativa_formal') IS NULL
      `,
      lookback_minutes: 60,
    },
    response: {
      automated_actions: [
        { action_type: 'alert', target: 'auditoria', channel: 'push' },
        { action_type: 'block' }, // Bloqueia a correcao sem justificativa
      ],
      notification_targets: ['auditoria', 'qualidade'],
      dashboard_visibility: true,
      requires_resolution: true,
      resolution_sla_hours: 8,
    },
    applies_to: ['todos_profissionais'],
    active: true,
  },
  {
    rule_id: 'GAP-ACE-005',
    name: 'Pendencia sem responsavel',
    description: 'Item pendente ha mais de 2 horas sem responsavel atribuido',
    category: GapCategory.PROCESSO,
    severity: GapSeverity.ALTA,
    detection: {
      type: 'cron',
      cron_schedule: '*/15 * * * *',
      query: `
        SELECT we.event_id, we.event_type, we.category, we.department_id,
               we.timestamp,
               EXTRACT(EPOCH FROM (NOW() - we.timestamp)) / 60 as minutos_pendente
        FROM work_events we
        WHERE we.delivery_status = 'pendente'
          AND we.handoff_target IS NULL
          AND we.timestamp < NOW() - INTERVAL '2 hours'
      `,
      lookback_minutes: 240,
    },
    response: {
      automated_actions: [
        { action_type: 'alert', target: 'supervisor_departamento', channel: 'push' },
        { action_type: 'create_task', target: 'supervisor_departamento' },
      ],
      notification_targets: ['supervisor_departamento'],
      dashboard_visibility: true,
      requires_resolution: true,
      resolution_sla_hours: 2,
    },
    applies_to: ['todos_departamentos'],
    active: true,
  },
  {
    rule_id: 'GAP-ACE-006',
    name: 'Areas nao reportando SLA/tempo/entrega',
    description: 'Departamento com SLA definido mas sem metricas de tempo nos eventos',
    category: GapCategory.REPORTE,
    severity: GapSeverity.MEDIA,
    detection: {
      type: 'cron',
      cron_schedule: '0 */4 * * *',
      query: `
        SELECT department_id,
               COUNT(*) as total_eventos,
               COUNT(*) FILTER (WHERE duration_minutes IS NOT NULL) as com_duracao,
               COUNT(*) FILTER (WHERE sla_target_minutes IS NOT NULL) as com_sla,
               ROUND(COUNT(*) FILTER (WHERE duration_minutes IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct_com_duracao
        FROM work_events
        WHERE timestamp > NOW() - INTERVAL '24 hours'
          AND category IN ('higiene', 'transporte', 'manutencao', 'apoio')
        GROUP BY department_id
        HAVING COUNT(*) > 5
          AND COUNT(*) FILTER (WHERE duration_minutes IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) < 0.5
      `,
      lookback_minutes: 1440,
    },
    response: {
      automated_actions: [
        { action_type: 'alert', target: 'qualidade', channel: 'email' },
      ],
      notification_targets: ['qualidade', 'ti'],
      dashboard_visibility: true,
      requires_resolution: false,
    },
    applies_to: ['departamentos_com_sla'],
    active: true,
  },
];
```

---

## 4. Tabela Consolidada de Regras

| ID | Nome | Categoria | Severidade | Frequencia | Acao |
|---|---|---|---|---|---|
| GAP-REP-001 | Atividade sem reporte | Reporte | Alta | 30 min | Alert + Task |
| GAP-REP-002 | Departamento sem reporte por turno | Reporte | Media | 2h | Alert |
| GAP-REP-003 | Area recebendo mas nao fechando | Processo | Alta | 30 min | Alert |
| GAP-HND-001 | Handoff sem aceite | Handoff | Alta | 5 min | Escalate |
| GAP-HND-002 | Passagem plantao incompleta | Handoff | Critica | Stream | Alert + Block |
| GAP-COM-001 | Chamado sem resposta | Comunicacao | Alta | 2 min | Alert |
| GAP-COM-002 | Valor critico sem comunicacao | Comunicacao | Critica | Stream | Escalate + Phone |
| GAP-EVD-001 | Tarefa fechada sem evidencia | Evidencia | Media | Stream | Log + Task |
| GAP-EVD-002 | Texto livre excessivo | Processo | Baixa | 6h | Log |
| GAP-ACE-001 | Acesso sem relacao | Acesso | Alta | Stream | Alert + Log |
| GAP-ACE-002 | Trocas usuario suspeitas | Sessao | Alta | 15 min | Alert |
| GAP-ACE-003 | Contextos incompativeis | Sessao | Alta | 10 min | Alert |
| GAP-ACE-004 | Edicao fora de janela | Correcao | Alta | Stream | Alert + Block |
| GAP-ACE-005 | Pendencia sem responsavel | Processo | Alta | 15 min | Alert + Task |
| GAP-ACE-006 | Area sem reporte SLA | Reporte | Media | 4h | Alert |

---

## 5. NATS Subjects para Gaps

```yaml
subjects:
  - "velya.gap.detected.{category}.{severity}"
  - "velya.gap.resolved.{gap_id}"
  - "velya.gap.escalated.{gap_id}.{level}"
  - "velya.gap.timeout.{gap_id}"
```

---

## 6. PostgreSQL Schema

```sql
CREATE TABLE detected_gaps (
    gap_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id             TEXT NOT NULL,
    rule_name           TEXT NOT NULL,
    category            TEXT NOT NULL,
    severity            TEXT NOT NULL,
    department_id       UUID,
    unit_id             UUID,
    actor_id            UUID,
    patient_id          UUID,
    description         TEXT NOT NULL,
    detection_data      JSONB NOT NULL,
    detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ,
    resolution          TEXT,
    resolved_by         UUID,
    escalation_level    INTEGER NOT NULL DEFAULT 0,
    requires_resolution BOOLEAN NOT NULL DEFAULT TRUE,
    resolution_sla      TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'aberto',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gaps_open ON detected_gaps(status, severity) WHERE status = 'aberto';
CREATE INDEX idx_gaps_department ON detected_gaps(department_id, detected_at DESC);
CREATE INDEX idx_gaps_rule ON detected_gaps(rule_id, detected_at DESC);
CREATE INDEX idx_gaps_sla ON detected_gaps(resolution_sla) WHERE status = 'aberto' AND requires_resolution = TRUE;
```

---

## 7. Metricas

```yaml
metrics:
  - name: velya_gaps_detected_total
    type: counter
    labels: [rule_id, category, severity, department]
    help: "Total de gaps detectados"

  - name: velya_gaps_active
    type: gauge
    labels: [category, severity, department]
    help: "Gaps ativos por categoria e severidade"

  - name: velya_gaps_resolution_time_hours
    type: histogram
    labels: [category, severity]
    buckets: [0.25, 0.5, 1, 2, 4, 8, 12, 24, 48]
    help: "Tempo de resolucao de gaps em horas"

  - name: velya_gaps_sla_breach_total
    type: counter
    labels: [rule_id, department]
    help: "Total de gaps que estouraram SLA de resolucao"
```

---

## 8. Resumo

A deteccao de gaps garante:

1. **15+ regras automaticas** cobrindo reporte, handoff, comunicacao, evidencia, acesso, sessao e processo.
2. **Severidade classificada** — Critica (minutos), Alta (horas), Media (24h), Baixa (informativo).
3. **Resposta automatizada** — Alert, block, escalate, create_task, log.
4. **Escalacao em cadeia** — Cada gap com cadeia de escalacao definida.
5. **Dashboard visivel** — Todos os gaps ativos visiveis em painel central.
6. **Resolucao rastreada** — Cada gap aberto ate resolucao explicita.
