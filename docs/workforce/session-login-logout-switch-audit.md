# Auditoria de Sessao, Login, Logout e Troca de Usuario — Velya Platform

> Rastreamento completo do ciclo de vida da sessao: autenticacao, inatividade, logoff, troca de usuario, acesso emergencial, falhas e elevacao de privilegio.

---

## 1. Principio Fundamental

**Cada acao no sistema e vinculada a uma sessao autenticada, pessoal e intransferivel. Toda mudanca de estado da sessao gera evento de auditoria.**

---

## 2. Modelo de Dados

### 2.1 Sessao

```typescript
interface Session {
  session_id: string;                    // UUID v7
  user_id: string;                       // ID unico do usuario
  professional_id: string;               // ID do profissional (vinculado)

  // --- Autenticacao ---
  auth_method: AuthMethod;
  auth_factor_count: number;             // 1FA, 2FA, MFA
  auth_provider: string;                 // IdP usado
  credential_type: CredentialType;

  // --- Dispositivo ---
  device_id: string;                     // ID unico do dispositivo
  device_type: DeviceType;
  device_name?: string;
  workstation_id?: string;               // ID da estacao de trabalho
  ip_address: string;
  user_agent: string;
  mac_address?: string;

  // --- Contexto ---
  unit_id: string;                       // Unidade de login
  department_id: string;
  location_id?: string;                  // Localizacao fisica (se detectavel)
  shift_id?: string;                     // Turno vigente no momento do login

  // --- Temporal ---
  login_at: string;                      // Momento do login
  last_activity_at: string;              // Ultima atividade
  logout_at?: string;                    // Momento do logout
  session_duration_minutes?: number;     // Duracao total
  idle_time_minutes: number;             // Tempo ocioso atual

  // --- Status ---
  status: SessionStatus;
  logout_reason?: LogoutReason;

  // --- Privilegios ---
  active_role: ProfessionalRole;
  privilege_level: number;
  temporary_elevation?: PrivilegeElevation;

  // --- Historico de troca ---
  previous_session_id?: string;          // Sessao anterior (se fast switch)
  switch_count: number;                  // Quantas trocas neste dispositivo
}

enum AuthMethod {
  PASSWORD = 'password',
  PASSWORD_MFA = 'password_mfa',
  BIOMETRIC = 'biometric',
  SMARTCARD = 'smartcard',
  SSO = 'sso',
  CERTIFICATE = 'certificate',
  EMERGENCY = 'emergency',              // Acesso emergencial
}

enum CredentialType {
  PESSOAL = 'pessoal',                  // Credencial pessoal intransferivel
  TEMPORARIA = 'temporaria',            // Credencial temporaria (residente, estagiario)
  EMERGENCIAL = 'emergencial',          // Acesso break-glass
  SERVICO = 'servico',                  // Conta de servico (integracao)
}

enum DeviceType {
  WORKSTATION = 'workstation',           // Estacao de trabalho fixa
  NOTEBOOK = 'notebook',
  TABLET = 'tablet',
  MOBILE = 'mobile',
  TOTEM = 'totem',                       // Totem de autoatendimento
  BEIRA_LEITO = 'beira_leito',          // Terminal beira-leito
  IMPRESSORA = 'impressora',            // Impressora com autenticacao
}

enum SessionStatus {
  ATIVO = 'ativo',
  OCIOSO = 'ocioso',
  BLOQUEADO = 'bloqueado',
  ENCERRADO = 'encerrado',
  EXPIRADO = 'expirado',
  FORÇADO = 'forcado',                  // Encerrado forcadamente
}

enum LogoutReason {
  VOLUNTARIO = 'voluntario',             // Usuario fez logout
  INATIVIDADE = 'inatividade',           // Auto-logoff por inatividade
  TIMEOUT_SESSAO = 'timeout_sessao',     // Sessao expirou
  TROCA_USUARIO = 'troca_usuario',       // Fast user switch
  ADMIN_FORCADO = 'admin_forcado',       // Administrador encerrou sessao
  REVOGACAO = 'revogacao',              // Credencial revogada
  DISPOSITIVO_BLOQUEADO = 'dispositivo_bloqueado',
  ERRO_SISTEMA = 'erro_sistema',
}
```

### 2.2 Eventos de Sessao

```typescript
interface SessionAuditEvent {
  event_id: string;                      // UUID v7
  event_type: SessionEventType;
  session_id: string;
  user_id: string;
  professional_id: string;
  timestamp: string;
  device_id: string;
  ip_address: string;
  unit_id: string;
  details: SessionEventDetails;
  risk_score?: number;                   // 0-100, calculado automaticamente
  provenance_id: string;
  audit_event_id: string;               // FHIR AuditEvent ID
}

enum SessionEventType {
  // Autenticacao
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGIN_BLOCKED = 'login_blocked',
  LOGIN_LOCKOUT = 'login_lockout',

  // MFA
  MFA_CHALLENGE_SENT = 'mfa_challenge_sent',
  MFA_CHALLENGE_SUCCESS = 'mfa_challenge_success',
  MFA_CHALLENGE_FAILURE = 'mfa_challenge_failure',

  // Sessao
  SESSION_CREATED = 'session_created',
  SESSION_REFRESHED = 'session_refreshed',
  SESSION_IDLE = 'session_idle',
  SESSION_LOCKED = 'session_locked',
  SESSION_UNLOCKED = 'session_unlocked',

  // Logout
  LOGOUT_VOLUNTARY = 'logout_voluntary',
  LOGOUT_INACTIVITY = 'logout_inactivity',
  LOGOUT_TIMEOUT = 'logout_timeout',
  LOGOUT_FORCED = 'logout_forced',
  LOGOUT_REVOCATION = 'logout_revocation',

  // Troca de usuario
  USER_SWITCH_OUT = 'user_switch_out',
  USER_SWITCH_IN = 'user_switch_in',
  FAST_SWITCH = 'fast_switch',

  // Re-autenticacao
  REAUTH_REQUIRED = 'reauth_required',
  REAUTH_SUCCESS = 'reauth_success',
  REAUTH_FAILURE = 'reauth_failure',

  // Privilegio
  PRIVILEGE_ELEVATION_REQUEST = 'privilege_elevation_request',
  PRIVILEGE_ELEVATION_GRANTED = 'privilege_elevation_granted',
  PRIVILEGE_ELEVATION_DENIED = 'privilege_elevation_denied',
  PRIVILEGE_ELEVATION_EXPIRED = 'privilege_elevation_expired',

  // Acesso emergencial
  BREAK_GLASS_REQUEST = 'break_glass_request',
  BREAK_GLASS_GRANTED = 'break_glass_granted',
  BREAK_GLASS_EXPIRED = 'break_glass_expired',
  BREAK_GLASS_REVIEWED = 'break_glass_reviewed',

  // Anomalias
  CONCURRENT_SESSION_DETECTED = 'concurrent_session_detected',
  LOCATION_ANOMALY = 'location_anomaly',
  DEVICE_ANOMALY = 'device_anomaly',
  BEHAVIOR_ANOMALY = 'behavior_anomaly',
}

interface SessionEventDetails {
  // Login
  auth_method?: AuthMethod;
  failure_reason?: string;
  attempt_count?: number;

  // Troca
  previous_user_id?: string;
  previous_session_id?: string;
  new_user_id?: string;

  // Re-autenticacao
  reauth_reason?: string;
  sensitive_action?: string;

  // Privilegio
  requested_level?: number;
  granted_level?: number;
  justification?: string;
  approved_by?: string;
  expiry?: string;

  // Break-glass
  break_glass_reason?: string;
  patient_id?: string;
  reviewer_id?: string;
  review_outcome?: 'justified' | 'unjustified' | 'pending';

  // Anomalia
  anomaly_type?: string;
  anomaly_score?: number;
  expected_value?: string;
  actual_value?: string;
}
```

### 2.3 Elevacao de Privilegio

```typescript
interface PrivilegeElevation {
  elevation_id: string;
  user_id: string;
  session_id: string;
  original_level: number;
  elevated_level: number;
  reason: string;
  approved_by: string;
  granted_at: string;
  expires_at: string;
  revoked_at?: string;
  actions_during_elevation: string[];    // Acoes realizadas durante elevacao
}
```

---

## 3. Configuracoes de Seguranca

### 3.1 Auto-logoff por Area

| Area | Timeout Inatividade | Timeout Sessao | Re-auth Sensivel | MFA |
|---|---|---|---|---|
| UTI | 15 min | 12h | Sim | Obrigatorio |
| Centro Cirurgico | 15 min | 12h | Sim | Obrigatorio |
| Pronto Atendimento | 10 min | 12h | Sim | Obrigatorio |
| Enfermaria | 15 min | 12h | Sim | Obrigatorio |
| Laboratorio | 20 min | 12h | Sim | Recomendado |
| Farmacia | 15 min | 12h | Sim (dispensacao) | Obrigatorio |
| Recepcao | 10 min | 8h | Nao | Recomendado |
| Administrativo | 30 min | 8h | Nao | Recomendado |
| TI | 30 min | 8h | Sim (admin) | Obrigatorio |
| Direcao | 30 min | 8h | Sim | Obrigatorio |

### 3.2 Configuracao YAML

```yaml
# session-security-config.yaml
session:
  global:
    max_concurrent_sessions: 2
    session_absolute_timeout: "12h"
    token_refresh_interval: "15m"
    max_login_attempts: 5
    lockout_duration: "30m"
    password_policy:
      min_length: 12
      require_uppercase: true
      require_lowercase: true
      require_number: true
      require_special: true
      max_age_days: 90
      history_count: 12
      prohibit_common: true

  auto_logoff:
    default_idle_timeout: "15m"
    overrides:
      pronto_atendimento: "10m"
      recepcao: "10m"
      administrativo: "30m"
      ti: "30m"
      direcao: "30m"
      laboratorio: "20m"

  reauth:
    sensitive_actions:
      - prescricao_controlada
      - dispensacao_controlada
      - acesso_prontuario_outro_setor
      - edicao_registro_antigo
      - exportacao_dados
      - break_glass
      - elevacao_privilegio
      - cancelamento_prescricao
      - retificacao_evolucao
    reauth_validity: "5m"
    reauth_methods:
      - password
      - biometric

  fast_switch:
    enabled: true
    max_cached_sessions: 3
    requires_reauth: true
    audit_both_users: true

  break_glass:
    enabled: true
    max_duration: "60m"
    requires_justification: true
    requires_post_review: true
    review_deadline_hours: 24
    notification_targets:
      - dpo
      - auditoria
      - gestor_unidade
    allowed_roles:
      - medico_plantonista
      - enfermeiro_lider
      - direcao
```

---

## 4. Regras de Deteccao de Anomalias

```typescript
interface SessionAnomalyRule {
  rule_id: string;
  name: string;
  description: string;
  condition: string;
  risk_score: number;
  action: 'log' | 'alert' | 'block' | 'require_reauth';
}

const sessionAnomalyRules: SessionAnomalyRule[] = [
  {
    rule_id: 'SAN-001',
    name: 'Sessao concorrente em unidades diferentes',
    description: 'Mesmo usuario logado em unidades diferentes simultaneamente',
    condition: 'concurrent_sessions > 1 AND distinct_units > 1',
    risk_score: 80,
    action: 'alert',
  },
  {
    rule_id: 'SAN-002',
    name: 'Login fora do horario de turno',
    description: 'Usuario faz login fora do horario do turno programado',
    condition: 'login_time NOT BETWEEN shift_start AND shift_end',
    risk_score: 40,
    action: 'log',
  },
  {
    rule_id: 'SAN-003',
    name: 'Trocas de usuario excessivas',
    description: 'Mais de 10 trocas de usuario no mesmo dispositivo em 1 hora',
    condition: 'switch_count > 10 AND window = 1h',
    risk_score: 70,
    action: 'alert',
  },
  {
    rule_id: 'SAN-004',
    name: 'Login de IP desconhecido',
    description: 'Login de endereco IP nao registrado na rede hospitalar',
    condition: 'ip_address NOT IN known_hospital_ranges',
    risk_score: 90,
    action: 'block',
  },
  {
    rule_id: 'SAN-005',
    name: 'Falhas de autenticacao repetidas',
    description: '3+ falhas de autenticacao em 5 minutos para o mesmo usuario',
    condition: 'login_failures >= 3 AND window = 5m',
    risk_score: 60,
    action: 'require_reauth',
  },
  {
    rule_id: 'SAN-006',
    name: 'Sessao ativa apos check-out de turno',
    description: 'Sessao continua ativa apos o profissional fazer check-out do turno',
    condition: 'session_active AND shift_checked_out = true',
    risk_score: 50,
    action: 'alert',
  },
  {
    rule_id: 'SAN-007',
    name: 'Dispositivo nao autorizado',
    description: 'Login de dispositivo nao registrado no inventario',
    condition: 'device_id NOT IN registered_devices',
    risk_score: 85,
    action: 'block',
  },
  {
    rule_id: 'SAN-008',
    name: 'Break-glass frequente',
    description: 'Mesmo usuario usa break-glass mais de 3 vezes em 30 dias',
    condition: 'break_glass_count > 3 AND window = 30d',
    risk_score: 75,
    action: 'alert',
  },
  {
    rule_id: 'SAN-009',
    name: 'Sessao sem atividade de reporte',
    description: 'Sessao ativa por mais de 2h sem nenhum WorkEvent registrado',
    condition: 'session_age > 2h AND work_events_count = 0',
    risk_score: 30,
    action: 'log',
  },
  {
    rule_id: 'SAN-010',
    name: 'Acesso massivo a prontuarios',
    description: 'Acesso a mais de 20 prontuarios distintos em 1 hora',
    condition: 'distinct_patients_accessed > 20 AND window = 1h',
    risk_score: 85,
    action: 'alert',
  },
];
```

---

## 5. FHIR AuditEvent para Sessao

### 5.1 Login Bem-sucedido

```json
{
  "resourceType": "AuditEvent",
  "type": {
    "system": "http://dicom.nema.org/resources/ontology/DCM",
    "code": "110114",
    "display": "User Authentication"
  },
  "subtype": [{
    "system": "http://dicom.nema.org/resources/ontology/DCM",
    "code": "110122",
    "display": "Login"
  }],
  "action": "E",
  "period": {
    "start": "2026-04-08T07:02:15-03:00"
  },
  "recorded": "2026-04-08T07:02:15-03:00",
  "outcome": "0",
  "agent": [{
    "type": {
      "coding": [{
        "system": "http://terminology.hl7.org/CodeSystem/extra-security-role-type",
        "code": "humanuser"
      }]
    },
    "who": {
      "reference": "Practitioner/enf-maria-silva",
      "display": "Maria Silva - Enfermeira"
    },
    "requestor": true,
    "network": {
      "address": "10.0.5.42",
      "type": "2"
    }
  }],
  "source": {
    "site": "UTI-Adulto-Posto-1",
    "observer": {
      "reference": "Device/workstation-uti-01"
    },
    "type": [{
      "system": "http://terminology.hl7.org/CodeSystem/security-source-type",
      "code": "4",
      "display": "Application Server"
    }]
  },
  "entity": [{
    "what": {
      "reference": "Session/sess-uuid-123"
    },
    "type": {
      "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
      "code": "2",
      "display": "System Object"
    },
    "detail": [{
      "type": "auth_method",
      "valueString": "password_mfa"
    }, {
      "type": "device_type",
      "valueString": "workstation"
    }, {
      "type": "unit_id",
      "valueString": "uti-adulto"
    }]
  }]
}
```

### 5.2 Troca de Usuario

```json
{
  "resourceType": "AuditEvent",
  "type": {
    "system": "http://dicom.nema.org/resources/ontology/DCM",
    "code": "110114",
    "display": "User Authentication"
  },
  "subtype": [{
    "system": "https://velya.health/fhir/CodeSystem/session-event",
    "code": "fast_switch",
    "display": "Fast User Switch"
  }],
  "action": "E",
  "recorded": "2026-04-08T10:15:30-03:00",
  "outcome": "0",
  "agent": [
    {
      "type": {
        "coding": [{
          "system": "https://velya.health/fhir/CodeSystem/agent-role",
          "code": "outgoing_user"
        }]
      },
      "who": {
        "reference": "Practitioner/enf-maria-silva"
      },
      "requestor": false
    },
    {
      "type": {
        "coding": [{
          "system": "https://velya.health/fhir/CodeSystem/agent-role",
          "code": "incoming_user"
        }]
      },
      "who": {
        "reference": "Practitioner/med-joao-santos"
      },
      "requestor": true
    }
  ],
  "source": {
    "site": "UTI-Adulto-Posto-1",
    "observer": {
      "reference": "Device/workstation-uti-01"
    }
  }
}
```

---

## 6. PostgreSQL Schema

```sql
CREATE TABLE sessions (
    session_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    professional_id     UUID NOT NULL,
    auth_method         TEXT NOT NULL,
    auth_factor_count   INTEGER NOT NULL DEFAULT 1,
    auth_provider       TEXT NOT NULL,
    credential_type     TEXT NOT NULL DEFAULT 'pessoal',
    device_id           TEXT NOT NULL,
    device_type         TEXT NOT NULL,
    device_name         TEXT,
    workstation_id      TEXT,
    ip_address          INET NOT NULL,
    user_agent          TEXT,
    mac_address         MACADDR,
    unit_id             UUID NOT NULL,
    department_id       UUID NOT NULL,
    location_id         UUID,
    shift_id            UUID,
    login_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    logout_at           TIMESTAMPTZ,
    session_duration_minutes INTEGER,
    idle_time_minutes   INTEGER DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'ativo',
    logout_reason       TEXT,
    active_role         TEXT NOT NULL,
    privilege_level     INTEGER NOT NULL,
    temporary_elevation JSONB,
    previous_session_id UUID,
    switch_count        INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE session_audit_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type          TEXT NOT NULL,
    session_id          UUID NOT NULL REFERENCES sessions(session_id),
    user_id             UUID NOT NULL,
    professional_id     UUID NOT NULL,
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_id           TEXT NOT NULL,
    ip_address          INET NOT NULL,
    unit_id             UUID NOT NULL,
    details             JSONB DEFAULT '{}',
    risk_score          INTEGER,
    provenance_id       TEXT,
    audit_event_id      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE privilege_elevations (
    elevation_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    session_id          UUID NOT NULL REFERENCES sessions(session_id),
    original_level      INTEGER NOT NULL,
    elevated_level      INTEGER NOT NULL,
    reason              TEXT NOT NULL,
    approved_by         UUID NOT NULL,
    granted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ,
    actions_during      TEXT[] DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE break_glass_records (
    break_glass_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    session_id          UUID NOT NULL REFERENCES sessions(session_id),
    patient_id          UUID,
    reason              TEXT NOT NULL,
    granted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    expired_at          TIMESTAMPTZ,
    actions_during      TEXT[] DEFAULT '{}',
    reviewer_id         UUID,
    reviewed_at         TIMESTAMPTZ,
    review_outcome      TEXT,
    review_notes        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_sessions_user ON sessions(user_id, login_at DESC);
CREATE INDEX idx_sessions_active ON sessions(status) WHERE status = 'ativo';
CREATE INDEX idx_sessions_device ON sessions(device_id, login_at DESC);
CREATE INDEX idx_session_events_session ON session_audit_events(session_id, timestamp DESC);
CREATE INDEX idx_session_events_type ON session_audit_events(event_type, timestamp DESC);
CREATE INDEX idx_session_events_risk ON session_audit_events(risk_score DESC) WHERE risk_score >= 70;
CREATE INDEX idx_break_glass_pending ON break_glass_records(review_outcome) WHERE review_outcome IS NULL;
CREATE INDEX idx_elevations_active ON privilege_elevations(expires_at) WHERE revoked_at IS NULL;
```

---

## 7. NATS Subjects

```yaml
subjects:
  - "velya.session.login.success"
  - "velya.session.login.failure"
  - "velya.session.login.blocked"
  - "velya.session.logout.voluntary"
  - "velya.session.logout.inactivity"
  - "velya.session.logout.timeout"
  - "velya.session.logout.forced"
  - "velya.session.switch.out"
  - "velya.session.switch.in"
  - "velya.session.reauth.required"
  - "velya.session.reauth.success"
  - "velya.session.reauth.failure"
  - "velya.session.elevation.request"
  - "velya.session.elevation.granted"
  - "velya.session.elevation.denied"
  - "velya.session.elevation.expired"
  - "velya.session.breakglass.request"
  - "velya.session.breakglass.granted"
  - "velya.session.breakglass.expired"
  - "velya.session.breakglass.reviewed"
  - "velya.session.anomaly.detected"
```

---

## 8. Metricas Prometheus

```yaml
metrics:
  - name: velya_session_active_count
    type: gauge
    labels: [unit, department, device_type]
    help: "Sessoes ativas por unidade e tipo de dispositivo"

  - name: velya_session_login_total
    type: counter
    labels: [auth_method, outcome, unit]
    help: "Total de tentativas de login"

  - name: velya_session_duration_minutes
    type: histogram
    labels: [unit, role]
    buckets: [30, 60, 120, 240, 360, 480, 720]
    help: "Duracao das sessoes em minutos"

  - name: velya_session_switch_total
    type: counter
    labels: [device_id, unit]
    help: "Total de trocas de usuario"

  - name: velya_session_anomaly_total
    type: counter
    labels: [anomaly_type, severity]
    help: "Total de anomalias de sessao detectadas"

  - name: velya_session_breakglass_total
    type: counter
    labels: [unit, review_outcome]
    help: "Total de acessos break-glass"

  - name: velya_session_idle_timeout_total
    type: counter
    labels: [unit, role]
    help: "Total de logoffs por inatividade"

  - name: velya_session_lockout_total
    type: counter
    labels: [unit]
    help: "Total de bloqueios por tentativas excessivas"
```

---

## 9. Regras de Negocio

| ID | Regra | Descricao |
|---|---|---|
| SS001 | ID unico por usuario | Cada profissional tem credencial pessoal intransferivel |
| SS002 | Auto-logoff configuravel | Inatividade encerra sessao conforme area |
| SS003 | Re-auth para acoes sensiveis | Prescricao controlada, exportacao, break-glass |
| SS004 | Fast switch com trilha completa | Registra quem saiu e quem entrou |
| SS005 | Break-glass com justificativa e revisao | Obrigatoriamente revisado em 24h |
| SS006 | Elevacao temporaria com expiracao | Privilegio elevado expira automaticamente |
| SS007 | Max sessoes concorrentes = 2 | Terceira sessao bloqueia |
| SS008 | Login de IP desconhecido bloqueado | Apenas rede hospitalar autorizada |
| SS009 | 5 falhas = lockout 30 min | Protecao contra forca bruta |
| SS010 | Toda sessao gera AuditEvent FHIR | Rastreabilidade completa |

---

## 10. Resumo

O modelo de auditoria de sessao garante:

1. **Autenticacao pessoal e intransferivel** — Cada profissional com credencial unica.
2. **Trilha completa** — Login, atividade, inatividade, logout, troca registrados.
3. **Auto-logoff** — Configuravel por area, protegendo estacoes desacompanhadas.
4. **Troca segura** — Fast switch com registro de ambos os usuarios.
5. **Acesso emergencial controlado** — Break-glass com justificativa e revisao obrigatoria.
6. **Deteccao de anomalias** — 10+ regras de deteccao automatica.
7. **Re-autenticacao** — Acoes sensiveis exigem confirmacao de identidade.
8. **Conformidade FHIR** — Todos os eventos mapeados para AuditEvent.
