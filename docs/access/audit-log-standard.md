# Padrao de Log de Auditoria

**Modulo:** Velya Access Control - Audit Logging  
**Versao:** 1.0.0  
**Data:** 2026-04-08  
**Classificacao:** Interno - Seguranca e Compliance  
**Responsavel:** Time de Plataforma Velya  

---

## 1. Visao Geral

O sistema de auditoria do Velya registra toda interacao relevante para seguranca, conformidade regulatoria e rastreabilidade clinica. O design segue principios de:

- **Completude**: Toda acao auditavel e registrada sem excecao.
- **Imutabilidade**: Registros sao append-only com cadeia de hashes.
- **Nao-repudio**: Cada evento e vinculado a um usuario autenticado, sessao e dispositivo.
- **Retencao diferenciada**: Periodos de retencao variam conforme categoria do evento.
- **Consulta eficiente**: Indices por usuario, paciente, periodo, estacao e acao.

---

## 2. Eventos Auditaveis

### 2.1 Catalogo Completo de Eventos

| # | Codigo do Evento | Categoria | Descricao | Severidade |
|---|---|---|---|---|
| 1 | `AUTH_LOGIN_SUCCESS` | Autenticacao | Login bem-sucedido | INFO |
| 2 | `AUTH_LOGIN_FAILURE` | Autenticacao | Falha no login (senha, cracha, biometria) | WARN |
| 3 | `AUTH_LOGOUT` | Autenticacao | Logout voluntario | INFO |
| 4 | `AUTH_SESSION_EXPIRED` | Autenticacao | Sessao expirada por inatividade | INFO |
| 5 | `AUTH_SESSION_LOCKED` | Autenticacao | Sessao bloqueada (auto-lock) | INFO |
| 6 | `AUTH_USER_SWITCH` | Autenticacao | Troca rapida de usuario | INFO |
| 7 | `AUTH_STEP_UP_SUCCESS` | Autenticacao | Autenticacao elevada bem-sucedida | INFO |
| 8 | `AUTH_STEP_UP_FAILURE` | Autenticacao | Falha na autenticacao elevada | WARN |
| 9 | `AUTH_MFA_LOCKOUT` | Autenticacao | Bloqueio por falhas consecutivas de MFA | ALERT |
| 10 | `AUTH_TOKEN_ROTATED` | Autenticacao | Rotacao automatica de token | DEBUG |
| 11 | `CHART_OPEN` | Prontuario | Abertura de prontuario de paciente | INFO |
| 12 | `CHART_CLOSE` | Prontuario | Fechamento de prontuario | INFO |
| 13 | `CHART_EDIT` | Prontuario | Edicao de registro clinico | INFO |
| 14 | `CHART_SIGN` | Prontuario | Assinatura digital de documento clinico | INFO |
| 15 | `CHART_COSIGN` | Prontuario | Co-assinatura de documento | INFO |
| 16 | `CHART_AMEND` | Prontuario | Retificacao de registro assinado | WARN |
| 17 | `PRESCR_CREATE` | Prescricao | Criacao de prescricao | INFO |
| 18 | `PRESCR_MODIFY` | Prescricao | Modificacao de prescricao | INFO |
| 19 | `PRESCR_CANCEL` | Prescricao | Cancelamento de prescricao | WARN |
| 20 | `PRESCR_SIGN` | Prescricao | Assinatura de prescricao | INFO |
| 21 | `PRESCR_DISPENSE` | Prescricao | Dispensacao de medicamento | INFO |
| 22 | `PRESCR_ADMIN` | Prescricao | Administracao de medicamento | INFO |
| 23 | `DATA_EXPORT` | Dados | Exportacao de dados de paciente | ALERT |
| 24 | `DATA_PRINT` | Dados | Impressao de documento/prontuario | WARN |
| 25 | `DATA_DOWNLOAD` | Dados | Download de arquivo/anexo | WARN |
| 26 | `BREAK_GLASS_ACTIVATE` | Emergencia | Ativacao de acesso de emergencia | CRITICAL |
| 27 | `BREAK_GLASS_DEACTIVATE` | Emergencia | Desativacao de acesso de emergencia | ALERT |
| 28 | `POLICY_DENIAL` | Controle de Acesso | Negacao de acesso por politica | WARN |
| 29 | `POLICY_OVERRIDE` | Controle de Acesso | Sobrescrita de politica (break-glass) | CRITICAL |
| 30 | `ROLE_ASSIGN` | Administracao | Atribuicao de papel a usuario | ALERT |
| 31 | `ROLE_REVOKE` | Administracao | Revogacao de papel de usuario | ALERT |
| 32 | `ROLE_SWITCH` | Administracao | Troca de papel ativo na sessao | INFO |
| 33 | `USER_CREATE` | Administracao | Criacao de novo usuario | ALERT |
| 34 | `USER_DEACTIVATE` | Administracao | Desativacao de usuario | ALERT |
| 35 | `USER_REACTIVATE` | Administracao | Reativacao de usuario | ALERT |
| 36 | `POLICY_CHANGE` | Administracao | Alteracao de politica de acesso | CRITICAL |
| 37 | `CONSENT_GRANT` | Consentimento | Paciente concede consentimento | INFO |
| 38 | `CONSENT_REVOKE` | Consentimento | Paciente revoga consentimento | WARN |
| 39 | `SENSITIVE_VIEW` | Dados Sensiveis | Visualizacao de dados Classe D/E | ALERT |
| 40 | `DELEGATION_CREATE` | Delegacao | Criacao de delegacao de permissao | INFO |
| 41 | `DELEGATION_EXPIRE` | Delegacao | Expiracao de delegacao | INFO |
| 42 | `ANOMALY_DETECTED` | Seguranca | Deteccao de padrao anomalo | ALERT |

---

## 3. Esquema do Evento de Auditoria

### 3.1 Campos Obrigatorios

| Campo | Tipo | Descricao | Exemplo |
|---|---|---|---|
| `event_id` | UUID | Identificador unico do evento | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| `timestamp` | ISO 8601 | Data/hora UTC com microsegundos | `2026-04-08T14:30:00.123456Z` |
| `event_type` | Enum | Codigo do evento (ver catalogo) | `CHART_OPEN` |
| `event_category` | Enum | Categoria do evento | `prontuario` |
| `severity` | Enum | Severidade (DEBUG/INFO/WARN/ALERT/CRITICAL) | `INFO` |
| `user_id` | String | Identificador unico do usuario | `USR-00142` |
| `user_name` | String | Nome completo do usuario | `Dra. Maria Silva` |
| `profession` | String | Profissao do usuario | `medico` |
| `council_number` | String | Registro no conselho profissional | `CRM-SP 123456` |
| `unit` | String | Unidade onde o usuario esta logado | `UTI Adulto` |
| `active_role` | String | Papel ativo no momento da acao | `medico_intensivista` |
| `workstation_id` | String | Identificador da estacao de trabalho | `WS-UTI-3A-001` |
| `ip_address` | String | Endereco IP da estacao | `10.0.3.42` |
| `session_id` | UUID | Identificador da sessao ativa | `sess-abc-123-def-456` |
| `action` | String | Acao executada (verbo) | `read` |
| `result` | Enum | Resultado (success/failure/denied) | `success` |
| `hash` | String | Hash SHA-256 do evento (cadeia) | `a1b2c3d4...` |
| `previous_hash` | String | Hash do evento anterior (cadeia) | `z9y8x7w6...` |

### 3.2 Campos Condicionais

| Campo | Condicao | Tipo | Descricao |
|---|---|---|---|
| `patient_id` | Quando envolve paciente | String | Identificador do paciente |
| `patient_name` | Quando envolve paciente | String | Nome do paciente (para busca) |
| `object_type` | Quando envolve recurso | String | Tipo do objeto acessado |
| `object_id` | Quando envolve recurso | String | ID do objeto acessado |
| `object_description` | Quando envolve recurso | String | Descricao legivel do objeto |
| `justification` | Quando obrigatoria | String | Justificativa fornecida pelo usuario |
| `previous_user_id` | Em troca de usuario | String | ID do usuario anterior |
| `previous_session_id` | Em troca de usuario | UUID | Sessao anterior |
| `denial_reason` | Em negacao de acesso | String | Motivo da negacao (politica) |
| `policy_id` | Em negacao/override | String | ID da politica envolvida |
| `step_up_level` | Em step-up | Enum | Nivel de step-up exigido/atingido |
| `data_classification` | Quando envolve dados | Enum | Classificacao dos dados (A-E) |
| `digital_signature` | Em assinatura | Object | Detalhes da assinatura digital |
| `export_details` | Em exportacao | Object | Formato, volume, destino |
| `delegation_id` | Em delegacao | String | ID da delegacao ativa |
| `risk_score` | Quando calculado | Number | Score de risco no momento |

### 3.3 JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://velya.io/schemas/audit-event-v1.json",
  "title": "VelyaAuditEvent",
  "description": "Esquema de evento de auditoria da plataforma Velya",
  "type": "object",
  "required": [
    "event_id",
    "timestamp",
    "event_type",
    "event_category",
    "severity",
    "user_id",
    "user_name",
    "profession",
    "council_number",
    "unit",
    "active_role",
    "workstation_id",
    "ip_address",
    "session_id",
    "action",
    "result",
    "hash",
    "previous_hash"
  ],
  "properties": {
    "event_id": {
      "type": "string",
      "format": "uuid",
      "description": "Identificador unico do evento"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "Data/hora UTC ISO 8601 com microsegundos"
    },
    "event_type": {
      "type": "string",
      "enum": [
        "AUTH_LOGIN_SUCCESS",
        "AUTH_LOGIN_FAILURE",
        "AUTH_LOGOUT",
        "AUTH_SESSION_EXPIRED",
        "AUTH_SESSION_LOCKED",
        "AUTH_USER_SWITCH",
        "AUTH_STEP_UP_SUCCESS",
        "AUTH_STEP_UP_FAILURE",
        "AUTH_MFA_LOCKOUT",
        "AUTH_TOKEN_ROTATED",
        "CHART_OPEN",
        "CHART_CLOSE",
        "CHART_EDIT",
        "CHART_SIGN",
        "CHART_COSIGN",
        "CHART_AMEND",
        "PRESCR_CREATE",
        "PRESCR_MODIFY",
        "PRESCR_CANCEL",
        "PRESCR_SIGN",
        "PRESCR_DISPENSE",
        "PRESCR_ADMIN",
        "DATA_EXPORT",
        "DATA_PRINT",
        "DATA_DOWNLOAD",
        "BREAK_GLASS_ACTIVATE",
        "BREAK_GLASS_DEACTIVATE",
        "POLICY_DENIAL",
        "POLICY_OVERRIDE",
        "ROLE_ASSIGN",
        "ROLE_REVOKE",
        "ROLE_SWITCH",
        "USER_CREATE",
        "USER_DEACTIVATE",
        "USER_REACTIVATE",
        "POLICY_CHANGE",
        "CONSENT_GRANT",
        "CONSENT_REVOKE",
        "SENSITIVE_VIEW",
        "DELEGATION_CREATE",
        "DELEGATION_EXPIRE",
        "ANOMALY_DETECTED"
      ]
    },
    "event_category": {
      "type": "string",
      "enum": [
        "autenticacao",
        "prontuario",
        "prescricao",
        "dados",
        "emergencia",
        "controle_acesso",
        "administracao",
        "consentimento",
        "dados_sensiveis",
        "delegacao",
        "seguranca"
      ]
    },
    "severity": {
      "type": "string",
      "enum": ["DEBUG", "INFO", "WARN", "ALERT", "CRITICAL"]
    },
    "user_id": {
      "type": "string",
      "pattern": "^USR-[0-9]{5}$"
    },
    "user_name": {
      "type": "string",
      "maxLength": 200
    },
    "profession": {
      "type": "string",
      "enum": [
        "medico",
        "enfermeiro",
        "tecnico_enfermagem",
        "farmaceutico",
        "fisioterapeuta",
        "nutricionista",
        "psicologo",
        "assistente_social",
        "fonoaudiologo",
        "terapeuta_ocupacional",
        "biomedico",
        "administrador",
        "ti",
        "recepcao",
        "faturamento"
      ]
    },
    "council_number": {
      "type": "string",
      "description": "CRM, COREN, CRF, CREFITO, CRN, CRP, etc."
    },
    "unit": {
      "type": "string"
    },
    "active_role": {
      "type": "string"
    },
    "workstation_id": {
      "type": "string",
      "pattern": "^WS-[A-Z]{3}-[0-9A-Z]+-[0-9]{3}$"
    },
    "ip_address": {
      "type": "string",
      "format": "ipv4"
    },
    "session_id": {
      "type": "string",
      "format": "uuid"
    },
    "action": {
      "type": "string",
      "enum": ["create", "read", "update", "delete", "sign", "export", "print", "login", "logout", "switch", "activate", "deactivate", "assign", "revoke", "grant", "deny", "override"]
    },
    "result": {
      "type": "string",
      "enum": ["success", "failure", "denied", "partial"]
    },
    "hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$",
      "description": "SHA-256 do evento corrente"
    },
    "previous_hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$",
      "description": "SHA-256 do evento anterior na cadeia"
    },
    "patient_id": {
      "type": "string",
      "pattern": "^PAC-[0-9]{8}$"
    },
    "patient_name": {
      "type": "string"
    },
    "object_type": {
      "type": "string",
      "enum": ["prontuario", "prescricao", "evolucao", "laudo", "atestado", "sumario", "exame", "imagem", "anexo", "formulario", "usuario", "papel", "politica"]
    },
    "object_id": {
      "type": "string"
    },
    "object_description": {
      "type": "string"
    },
    "justification": {
      "type": "string",
      "minLength": 10,
      "maxLength": 500
    },
    "previous_user_id": {
      "type": "string"
    },
    "previous_session_id": {
      "type": "string",
      "format": "uuid"
    },
    "denial_reason": {
      "type": "string"
    },
    "policy_id": {
      "type": "string"
    },
    "step_up_level": {
      "type": "string",
      "enum": ["L0", "L1", "L2", "L3"]
    },
    "data_classification": {
      "type": "string",
      "enum": ["A", "B", "C", "D", "E"]
    },
    "digital_signature": {
      "type": "object",
      "properties": {
        "certificate_cn": { "type": "string" },
        "certificate_issuer": { "type": "string" },
        "signature_algorithm": { "type": "string" },
        "timestamp_authority": { "type": "string" },
        "signature_hash": { "type": "string" }
      }
    },
    "export_details": {
      "type": "object",
      "properties": {
        "format": { "type": "string", "enum": ["pdf", "csv", "xlsx", "hl7", "fhir_json"] },
        "record_count": { "type": "integer" },
        "destination": { "type": "string" },
        "file_size_bytes": { "type": "integer" }
      }
    },
    "delegation_id": {
      "type": "string"
    },
    "risk_score": {
      "type": "number",
      "minimum": 0,
      "maximum": 100
    },
    "metadata": {
      "type": "object",
      "description": "Campos adicionais especificos do evento"
    }
  },
  "additionalProperties": false
}
```

### 3.4 Exemplo de Evento

```json
{
  "event_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "timestamp": "2026-04-08T14:30:00.123456Z",
  "event_type": "CHART_OPEN",
  "event_category": "prontuario",
  "severity": "INFO",
  "user_id": "USR-00142",
  "user_name": "Dra. Maria Silva",
  "profession": "medico",
  "council_number": "CRM-SP 123456",
  "unit": "UTI Adulto",
  "active_role": "medico_intensivista",
  "workstation_id": "WS-UTI-3A-001",
  "ip_address": "10.0.3.42",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "action": "read",
  "result": "success",
  "patient_id": "PAC-00012345",
  "patient_name": "Joao Pedro Santos",
  "object_type": "prontuario",
  "object_id": "PRONT-00012345",
  "object_description": "Prontuario geral do paciente",
  "data_classification": "B",
  "risk_score": 12,
  "hash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "previous_hash": "z9y8x7w6v5u4z9y8x7w6v5u4z9y8x7w6v5u4z9y8x7w6v5u4z9y8x7w6v5u4z9y8"
}
```

---

## 4. Armazenamento a Prova de Adulteracao

### 4.1 Cadeia de Hashes (Hash Chain)

Cada evento de auditoria inclui o hash SHA-256 do evento anterior, formando uma cadeia imutavel:

```
Evento N-1                    Evento N                      Evento N+1
+-----------+                +-----------+                +-----------+
| event_id  |                | event_id  |                | event_id  |
| timestamp |                | timestamp |                | timestamp |
| ...       |                | ...       |                | ...       |
| hash: H1  |----[input]--->| prev: H1  |                | prev: H2  |
|           |                | hash: H2  |----[input]--->|           |
+-----------+                +-----------+                | hash: H3  |
                                                          +-----------+

H2 = SHA-256(event_id_N + timestamp_N + event_type_N + user_id_N + action_N + result_N + H1)
```

### 4.2 Calculo do Hash

```typescript
// src/audit/hash-chain.ts

import { createHash } from 'crypto';

interface AuditEventHashInput {
  eventId: string;
  timestamp: string;
  eventType: string;
  userId: string;
  action: string;
  result: string;
  previousHash: string;
}

export function computeEventHash(input: AuditEventHashInput): string {
  const payload = [
    input.eventId,
    input.timestamp,
    input.eventType,
    input.userId,
    input.action,
    input.result,
    input.previousHash,
  ].join('|');

  return createHash('sha256').update(payload).digest('hex');
}

export function verifyChain(events: AuditEventHashInput[]): {
  valid: boolean;
  brokenAt?: number;
} {
  for (let i = 1; i < events.length; i++) {
    const expectedPreviousHash = computeEventHash(events[i - 1]);
    if (events[i].previousHash !== expectedPreviousHash) {
      return { valid: false, brokenAt: i };
    }
  }
  return { valid: true };
}
```

### 4.3 Armazenamento Append-Only

| Camada | Tecnologia | Retencao | Proposito |
|---|---|---|---|
| Hot (0-90 dias) | Loki + S3 | 90 dias | Consultas em tempo real |
| Warm (90 dias - 2 anos) | S3 Glacier Instant | 2 anos | Consultas esporadicas |
| Cold (2-20 anos) | S3 Glacier Deep Archive | 20 anos | Compliance e auditoria |
| Verificacao | PostgreSQL (indices) | 20 anos | Indice de busca rapida |

### 4.4 Protecao contra Adulteracao

| Medida | Implementacao |
|---|---|
| Cadeia de hashes | Cada evento referencia o hash do anterior |
| Write-once storage | Bucket S3 com Object Lock (WORM) |
| Separacao de privilegios | Equipe de auditoria =/= equipe de operacao |
| Checkpoint diario | Hash raiz diario publicado em servico externo |
| Verificacao periodica | CronJob verifica integridade da cadeia a cada 6h |
| Alertas de violacao | Qualquer quebra na cadeia gera alerta CRITICAL |
| Assinatura do lote | Lotes diarios assinados com chave HSM |

---

## 5. Politica de Retencao

| Categoria | Periodo de Retencao | Base Legal | Formato |
|---|---|---|---|
| Auditoria clinica | 20 anos | CFM 1.821/2007 | Append-only, WORM |
| Auditoria de acesso | 5 anos | LGPD, ISO 27001 | Append-only |
| Auditoria de seguranca | 10 anos | ISO 27001, PCI-DSS | Append-only, WORM |
| Auditoria administrativa | 5 anos | Politica interna | Append-only |
| Debug/trace | 90 dias | Operacional | Rotativo |

### 5.1 Politica de Lifecycle

```yaml
# audit-retention-policy.yaml
lifecycle:
  clinical_audit:
    hot_days: 90
    warm_days: 730      # 2 anos
    cold_days: 7300     # 20 anos
    delete_after: false  # Nunca deletar automaticamente

  access_audit:
    hot_days: 90
    warm_days: 730
    cold_days: 1825     # 5 anos
    delete_after: true

  security_audit:
    hot_days: 90
    warm_days: 730
    cold_days: 3650     # 10 anos
    delete_after: false

  admin_audit:
    hot_days: 90
    warm_days: 365
    cold_days: 1825
    delete_after: true

  debug_trace:
    hot_days: 90
    warm_days: 0
    cold_days: 0
    delete_after: true
```

---

## 6. Capacidades de Consulta

### 6.1 Indices de Busca

| Indice | Campos | Uso Principal |
|---|---|---|
| Por usuario | `user_id`, `timestamp` | "Tudo que o Dr. Fulano fez" |
| Por paciente | `patient_id`, `timestamp` | "Quem acessou o prontuario do paciente X" |
| Por periodo | `timestamp`, `event_type` | "Todos os eventos do dia 08/04" |
| Por estacao | `workstation_id`, `timestamp` | "Tudo que aconteceu no terminal WS-UTI-3A-001" |
| Por papel | `active_role`, `event_type` | "Todas as prescricoes feitas por enfermeiros" |
| Por acao | `event_type`, `result` | "Todas as negacoes de acesso" |
| Por severidade | `severity`, `timestamp` | "Todos os eventos CRITICAL do mes" |
| Composto | `patient_id`, `user_id`, `event_type` | "Dr. Fulano acessou paciente X?" |

### 6.2 Exemplos de Consulta LogQL

```logql
# Todos os acessos a prontuario de um paciente especifico
{namespace="velya-audit"} | json | patient_id="PAC-00012345" | event_type=~"CHART_.*"

# Todas as negacoes de acesso nas ultimas 24h
{namespace="velya-audit"} | json | result="denied" | severity="WARN"

# Ativacoes de break-glass no ultimo mes
{namespace="velya-audit"} | json | event_type="BREAK_GLASS_ACTIVATE"

# Tudo que um usuario fez em um turno
{namespace="velya-audit"} | json | user_id="USR-00142"
  | timestamp >= "2026-04-08T07:00:00Z"
  | timestamp <= "2026-04-08T19:00:00Z"

# Exportacoes de dados com mais de 100 registros
{namespace="velya-audit"} | json | event_type="DATA_EXPORT"
  | export_details_record_count > 100

# Acessos de uma estacao de trabalho especifica
{namespace="velya-audit"} | json | workstation_id="WS-UTI-3A-001"
  | event_type=~"AUTH_LOGIN.*|AUTH_USER_SWITCH"
```

---

## 7. Gatilhos de Alerta

### 7.1 Padroes Anomalos

| Padrao | Threshold | Severidade | Acao Automatica |
|---|---|---|---|
| Volume alto de acessos | > 20 prontuarios/hora (enfermeiro) | WARN | Notificar gestor |
| Volume alto (nao-clinico) | > 10 prontuarios/hora | ALERT | Notificar seguranca |
| Acesso VIP sem vinculo | Qualquer acesso sem care relationship | ALERT | Bloquear + notificar |
| Acesso fora do horario | Qualquer acesso fora do turno | WARN | Log especial |
| Troca rapida excessiva | > 5 trocas/hora na mesma estacao | WARN | Investigar |
| Exportacao em massa | > 50 registros exportados/dia | ALERT | Bloquear + revisar |
| Break-glass frequente | > 2/mes por usuario | ALERT | Revisar necessidade |
| Falhas de autenticacao | > 5 falhas em 15 minutos | ALERT | Bloquear temporario |
| Acesso a proprio prontuario | Qualquer ocorrencia | ALERT | Notificar compliance |
| Acesso pos-desligamento | Qualquer acesso apos data fim contrato | CRITICAL | Bloquear imediato |

### 7.2 PromQL para Deteccao de Anomalias

```promql
# Taxa de acessos a prontuario por usuario (por hora)
# Alerta se > 20 para enfermeiros ou > 10 para nao-clinicos
rate(velya_audit_events_total{
  event_type="CHART_OPEN",
  profession=~"enfermeiro|tecnico_enfermagem"
}[1h]) > 20

rate(velya_audit_events_total{
  event_type="CHART_OPEN",
  profession=~"administrador|ti|recepcao|faturamento"
}[1h]) > 10

# Negacoes de acesso por usuario (ultimos 15 minutos)
increase(velya_audit_events_total{
  result="denied"
}[15m]) by (user_id) > 5

# Exportacoes de dados por dia
increase(velya_audit_events_total{
  event_type="DATA_EXPORT"
}[24h]) by (user_id) > 10

# Break-glass por usuario no mes
increase(velya_audit_events_total{
  event_type="BREAK_GLASS_ACTIVATE"
}[30d]) by (user_id) > 2

# Taxa de troca de usuario por estacao
rate(velya_audit_events_total{
  event_type="AUTH_USER_SWITCH"
}[1h]) by (workstation_id) > 5

# Falhas de login por IP
increase(velya_audit_events_total{
  event_type="AUTH_LOGIN_FAILURE"
}[15m]) by (ip_address) > 5

# Acessos fora do horario comercial (antes das 6h ou apos 22h)
velya_audit_events_total{
  event_type="CHART_OPEN"
} and on() hour() < 6 or hour() > 22

# Volume de impressoes por usuario
increase(velya_audit_events_total{
  event_type="DATA_PRINT"
}[24h]) by (user_id) > 20
```

---

## 8. Especificacao de Dashboards

### 8.1 Dashboard: Visao Geral de Seguranca

| Painel | Tipo | Metricas | Periodo |
|---|---|---|---|
| Logins/Logouts em Tempo Real | Grafico de linha | `velya_auth_login_total`, `velya_auth_logout_total` | Ultimo 1h |
| Sessoes Ativas | Gauge | `velya_active_sessions` por unidade | Tempo real |
| Falhas de Autenticacao | Grafico de barras | `velya_auth_failures_total` por tipo | Ultimas 24h |
| Break-Glass Ativos | Tabela | Lista de break-glass ativos com usuario e paciente | Tempo real |
| Negacoes de Acesso | Grafico de area | `velya_policy_denials_total` por motivo | Ultimas 24h |
| Top 10 Usuarios por Volume | Tabela | Usuarios com mais acessos a prontuario | Ultimas 24h |
| Eventos por Severidade | Pizza | Distribuicao por severidade | Ultimo 7d |
| Alertas Nao Reconhecidos | Lista | Alertas pendentes de acao | Tempo real |

### 8.2 Dashboard: Auditoria Clinica

| Painel | Tipo | Metricas | Periodo |
|---|---|---|---|
| Prescricoes por Hora | Linha | `velya_prescr_total` | Ultimas 24h |
| Assinaturas Digitais | Contador | Total de assinaturas por tipo | Hoje |
| Retificacoes (Amendments) | Tabela | Lista de retificacoes com motivo | Ultimos 7d |
| Exportacoes de Dados | Tabela | Exportacoes com usuario, volume, destino | Ultimos 30d |
| Acessos a Dados Sensiveis (D/E) | Tabela | Acessos com justificativa | Ultimos 7d |
| Consentimentos Concedidos/Revogados | Linha | Taxa de consentimento | Ultimos 30d |

### 8.3 Dashboard: Compliance

| Painel | Tipo | Metricas | Periodo |
|---|---|---|---|
| Integridade da Cadeia de Hash | Gauge | Resultado da ultima verificacao | Ultima execucao |
| Cobertura de Auditoria | Porcentagem | Eventos auditados / total de acoes | Ultimo 24h |
| Contas Inativas | Tabela | Usuarios sem login > 90 dias | Tempo real |
| Acumulo de Papeis | Tabela | Usuarios com > 3 papeis | Tempo real |
| Recertificacao Pendente | Lista | Acessos pendentes de revisao | Tempo real |
| Retencao de Dados | Grafico de barras | Volume por camada (hot/warm/cold) | Tempo real |

---

## 9. Pipeline de Ingestao

```yaml
# audit-pipeline.yaml
apiVersion: velya.io/v1
kind: AuditPipeline
metadata:
  name: audit-ingestion
spec:
  source:
    type: kafka
    topic: velya.audit.events
    consumer_group: audit-ingestion
    partitions: 12
    replication_factor: 3

  validation:
    schema: "velya-audit-event-v1"
    reject_invalid: true
    dead_letter_topic: "velya.audit.events.dlq"

  enrichment:
    - name: hash_chain
      type: hash_chain_validator
      algorithm: sha256
    - name: timestamp_validation
      type: timestamp_check
      max_drift_seconds: 30
    - name: user_enrichment
      type: lookup
      source: user_directory
      fields: ["profession", "council_number", "unit"]

  sinks:
    - name: loki_hot
      type: loki
      url: "http://loki.observability:3100"
      labels:
        namespace: velya-audit
        environment: production
      retention_days: 90

    - name: s3_archive
      type: s3
      bucket: velya-audit-archive
      prefix: "events/"
      partition_by: ["year", "month", "day", "event_category"]
      format: parquet
      compression: zstd
      object_lock:
        mode: COMPLIANCE
        retain_until: "dynamic"   # Baseado na categoria

    - name: postgres_index
      type: postgresql
      connection: "velya-audit-db"
      table: audit_events_index
      fields:
        - event_id
        - timestamp
        - event_type
        - user_id
        - patient_id
        - workstation_id
        - result
        - severity
      indexes:
        - [user_id, timestamp]
        - [patient_id, timestamp]
        - [workstation_id, timestamp]
        - [event_type, result, timestamp]

    - name: alerts
      type: prometheus_push
      url: "http://pushgateway.observability:9091"
      metrics:
        - name: velya_audit_events_total
          type: counter
          labels: [event_type, severity, result, profession, unit]
```

---

## 10. Verificacao de Integridade

### 10.1 CronJob de Verificacao

```yaml
# audit-integrity-check-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: audit-integrity-check
  namespace: velya-audit
spec:
  schedule: "0 */6 * * *"  # A cada 6 horas
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: integrity-checker
              image: velya/audit-tools:1.0.0
              command:
                - /bin/sh
                - -c
                - |
                  # Verificar cadeia de hashes das ultimas 24h
                  audit-verify --period 24h --alert-on-break

                  # Verificar contagem de eventos vs metricas Prometheus
                  audit-reconcile --source loki --target prometheus --period 24h

                  # Verificar se todos os eventos obrigatorios estao presentes
                  audit-coverage --check-mandatory-events --period 24h

                  # Publicar resultado
                  audit-report --format json --output /tmp/report.json
                  audit-push-metrics --report /tmp/report.json
              env:
                - name: LOKI_URL
                  value: "http://loki.observability:3100"
                - name: POSTGRES_URL
                  valueFrom:
                    secretKeyRef:
                      name: audit-db-credentials
                      key: connection_string
              resources:
                requests:
                  memory: "256Mi"
                  cpu: "200m"
                limits:
                  memory: "512Mi"
                  cpu: "500m"
          restartPolicy: OnFailure
```

---

## 11. Conformidade Regulatoria

| Requisito | Regulamento | Implementacao |
|---|---|---|
| Registro de acesso ao PEP | CFM 1.821/2007 Art. 3 | Eventos CHART_* com assinatura digital |
| Retencao minima 20 anos | CFM 1.821/2007 Art. 8 | Lifecycle com S3 Glacier Deep Archive |
| Rastreabilidade completa | LGPD Art. 37 | Todos os campos obrigatorios preenchidos |
| Registro de consentimento | LGPD Art. 8 | Eventos CONSENT_* com evidencia |
| Log de acesso por operador | LGPD Art. 46 | user_id, session_id, workstation_id em todo evento |
| Nao-repudio | SBIS NGS2 REQ-SEG-03 | Cadeia de hashes + assinatura digital |
| Controle de medicamentos | Portaria 344/1998 | Eventos PRESCR_* com CRM e assinatura |
| Auditoria de exportacao | LGPD Art. 46 | Eventos DATA_EXPORT com detalhes completos |

---

*Documento gerado para a plataforma Velya. Uso interno - Seguranca e Compliance.*
