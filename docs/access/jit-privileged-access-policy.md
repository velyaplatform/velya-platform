# Politica de Acesso Privilegiado Just-in-Time (JIT)

**Modulo:** Velya Access Control - JIT Privileged Access  
**Versao:** 1.0.0  
**Data:** 2026-04-08  
**Classificacao:** Interno - Seguranca  
**Responsavel:** Time de Plataforma Velya  

---

## 1. Visao Geral

O acesso privilegiado no Velya segue o principio de **Zero Standing Privileges (ZSP)**. Nenhum usuario de TI, DBA ou seguranca mantem acesso permanente a sistemas de producao. Todo acesso privilegiado e concedido Just-in-Time (JIT) com:

1. **Solicitacao formal** vinculada a ticket.
2. **Aprovacao dupla** por dois gestores independentes.
3. **Duracao limitada** com auto-revogacao.
4. **Mascaramento de dados** por padrao (PHI oculto).
5. **Gravacao de sessao** completa.
6. **Auditoria total** com trilha imutavel.

Este modelo garante que acesso a dados de saude protegidos (PHI) por equipes de infraestrutura nunca ocorra de forma silenciosa ou permanente.

---

## 2. Papeis Privilegiados Cobertos

| Papel | Responsabilidade | Nivel de Risco | Frequencia Tipica |
|---|---|---|---|
| `dba_producao` | Administracao de bancos de dados de producao | Critico | 2-5x/semana |
| `sre_producao` | Operacao e troubleshooting de infra | Alto | 5-10x/semana |
| `security_analyst` | Investigacao de incidentes de seguranca | Critico | 1-3x/semana |
| `network_admin` | Configuracao de rede e firewall | Alto | 1-2x/semana |
| `devops_deploy` | Deploy de aplicacoes em producao | Alto | 3-5x/semana |
| `compliance_auditor` | Acesso a logs e relatorios de auditoria | Medio | 2-4x/mes |
| `backup_operator` | Operacoes de backup e restore | Alto | 1-2x/semana |
| `key_custodian` | Gerenciamento de chaves criptograficas | Critico | 1-2x/mes |

---

## 3. Fluxo de Solicitacao e Aprovacao

### 3.1 Diagrama de Sequencia

```
Solicitante     Portal JIT       Aprovador 1     Aprovador 2     PAM System      Audit Log
    |               |                |               |               |               |
    |--[Cria        |                |               |               |               |
    |  solicitacao  |                |               |               |               |
    |  + ticket]--->|                |               |               |               |
    |               |--[Valida       |               |               |               |
    |               |  ticket e      |               |               |               |
    |               |  politica]     |               |               |               |
    |               |                |               |               |               |
    |               |--[Notifica     |               |               |               |
    |               |  aprovadores]->|               |               |               |
    |               |                |               |               |               |
    |               |                |--[Avalia      |               |               |
    |               |                |  risco e      |               |               |
    |               |                |  aprova]----->|               |               |
    |               |                |               |               |               |
    |               |                |               |--[Avalia      |               |
    |               |                |               |  e aprova]--->|               |
    |               |                |               |               |               |
    |               |<-[Ambos        |               |               |               |
    |               |  aprovaram]----|---------------|               |               |
    |               |                |               |               |               |
    |               |--[Provisionar  |               |               |               |
    |               |  acesso temp.] |               |               |               |
    |               |----------------|---------------|-------------->|               |
    |               |                |               |               |--[Criar       |
    |               |                |               |               |  credencial   |
    |               |                |               |               |  temporaria]  |
    |               |                |               |               |               |
    |               |                |               |               |--[Iniciar     |
    |               |                |               |               |  gravacao     |
    |               |                |               |               |  de sessao]   |
    |               |                |               |               |               |
    |               |                |               |               |--[Aplicar     |
    |               |                |               |               |  mascaramento |
    |               |                |               |               |  de dados]    |
    |               |                |               |               |               |
    |<-[Credencial  |                |               |               |               |
    |  temporaria]--|                |               |               |               |
    |               |                |               |               |               |
    |--[Acessa      |                |               |               |               |
    |  sistema]-----|----------------|---------------|-------------->|               |
    |               |                |               |               |--[Sessao      |
    |               |                |               |               |  gravada]     |
    |               |                |               |               |               |
    |               |                |               |               |--[Emitir      |
    |               |                |               |               |  eventos]---->|
    |               |                |               |               |               |
    | ... 2h max ...|                |               |               |               |
    |               |                |               |               |               |
    |               |--[Timer        |               |               |               |
    |               |  expirou]------|---------------|-------------->|               |
    |               |                |               |               |--[Revogar     |
    |               |                |               |               |  acesso]      |
    |               |                |               |               |--[Encerrar    |
    |               |                |               |               |  gravacao]    |
    |               |                |               |               |--[Emitir      |
    |               |                |               |               |  revogacao]-->|
    |               |                |               |               |               |
    |<-[Sessao      |                |               |               |               |
    |  encerrada]---|                |               |               |               |
```

### 3.2 Etapas Detalhadas

| Etapa | Descricao | SLA | Escalacao |
|---|---|---|---|
| 1. Solicitacao | Usuario cria request no portal JIT com ticket vinculado | - | - |
| 2. Validacao | Sistema valida: ticket existe, usuario tem papel elegivel, janela de horario permitida | Automatico | Rejeicao automatica |
| 3. Notificacao | Dois aprovadores do pool recebem notificacao (email + Slack + push) | Imediato | - |
| 4. Aprovacao 1 | Primeiro aprovador avalia risco e aprova/rejeita | 30 min | Escalar para pool secundario |
| 5. Aprovacao 2 | Segundo aprovador (diferente do primeiro) aprova/rejeita | 30 min | Escalar para pool secundario |
| 6. Provisionamento | Sistema cria credencial temporaria e configura mascaramento | 2 min | Alerta SRE |
| 7. Gravacao | Sessao de terminal/console e gravada (asciinema/screen recording) | Automatico | - |
| 8. Uso | Solicitante executa atividades dentro do escopo aprovado | Max 2h | - |
| 9. Revogacao | Credencial revogada automaticamente apos timeout ou manualmente | Automatico | - |
| 10. Relatorio | Relatorio automatico gerado com acoes executadas | 15 min | - |

---

## 4. Mascaramento de Dados por Padrao

### 4.1 Regras de Mascaramento

Todo acesso privilegiado a bancos de dados de producao aplica mascaramento automatico de PHI:

| Tipo de Dado | Mascara Aplicada | Exemplo Original | Exemplo Mascarado |
|---|---|---|---|
| Nome do paciente | Primeiras 2 letras + asteriscos | `Maria Silva Santos` | `Ma**** Si**** Sa****` |
| CPF | Ultimos 4 digitos | `123.456.789-00` | `***.***.**9-00` |
| Data de nascimento | Apenas ano | `1985-03-15` | `1985-**-**` |
| Endereco | Apenas cidade/estado | `Rua Alfa 123, Apto 45` | `*****, Sao Paulo/SP` |
| Telefone | Ultimos 4 digitos | `(11) 98765-4321` | `(**) *****-4321` |
| Email | Dominio apenas | `maria@email.com` | `*****@email.com` |
| Prontuario (texto livre) | NER + redacao | `Paciente Maria, 38 anos...` | `Paciente [NOME], [IDADE] anos...` |
| Resultado de exame | Valores mascarados | `HIV: Reagente` | `HIV: [RESULTADO]` |
| Diagnostico CID | Codigo sem descricao | `F32.1 - Episodio depressivo` | `F32.1 - [DESCRICAO]` |

### 4.2 Excecoes ao Mascaramento

O desmascaramento e permitido apenas com:

1. **Justificativa documentada** (campo obrigatorio, minimo 100 caracteres).
2. **Aprovacao adicional** do Encarregado de Dados (DPO).
3. **Escopo limitado** a registros especificos (por patient_id ou query exata).
4. **Duracao limitada** a 30 minutos.
5. **Alerta imediato** para compliance e seguranca.

```yaml
# data-unmasking-request.yaml
apiVersion: velya.io/v1
kind: UnmaskingRequest
metadata:
  name: unmask-req-2026-04-08-001
spec:
  requestor:
    user_id: "USR-TI-005"
    role: "dba_producao"
    jit_session_id: "jit-sess-abc-123"
  scope:
    database: "velya_clinical"
    table: "patient_demographics"
    patient_ids:
      - "PAC-00012345"
      - "PAC-00012346"
    fields:
      - "full_name"
      - "cpf"
    query: "SELECT full_name, cpf FROM patient_demographics WHERE patient_id IN (...)"
  justification: >
    Investigacao de incidente INC-2026-0342. Paciente reportou que dados
    pessoais foram exibidos incorretamente na interface. Necessario verificar
    integridade dos dados no banco para comparar com cache da aplicacao.
    Ticket JIRA: VELYA-SEC-0342.
  duration_minutes: 30
  approval:
    required:
      - role: "dpo"
      - role: "security_manager"
    status: "pending"
```

---

## 5. Gravacao de Sessao

### 5.1 O que e Gravado

| Tipo de Acesso | Formato de Gravacao | Retencao | Armazenamento |
|---|---|---|---|
| Terminal SSH/Shell | asciinema (asciicast v2) | 1 ano | S3 criptografado |
| Console Web (painel admin) | Screen recording (WebM) | 1 ano | S3 criptografado |
| Queries SQL | Log de queries com resultado (mascarado) | 1 ano | S3 criptografado |
| API calls | Request/response com payload (mascarado) | 1 ano | S3 criptografado |
| Kubectl/helm | Comandos e output completo | 1 ano | S3 criptografado |

### 5.2 Metadados da Gravacao

```json
{
  "recording_id": "rec-2026-04-08-001",
  "jit_session_id": "jit-sess-abc-123",
  "user_id": "USR-TI-005",
  "user_name": "Carlos Souza",
  "role": "dba_producao",
  "ticket": "VELYA-OPS-1234",
  "approvers": ["USR-MGR-001", "USR-MGR-002"],
  "start_time": "2026-04-08T14:00:00Z",
  "end_time": "2026-04-08T15:30:00Z",
  "duration_seconds": 5400,
  "access_type": "database_console",
  "target_systems": ["velya-db-primary.internal"],
  "masking_active": true,
  "unmasking_requests": 0,
  "commands_executed": 47,
  "queries_executed": 23,
  "data_exported": false,
  "recording_files": [
    {
      "type": "terminal",
      "format": "asciicast_v2",
      "path": "s3://velya-jit-recordings/2026/04/08/rec-001-terminal.cast",
      "size_bytes": 245000,
      "hash_sha256": "abc123..."
    },
    {
      "type": "query_log",
      "format": "jsonl",
      "path": "s3://velya-jit-recordings/2026/04/08/rec-001-queries.jsonl",
      "size_bytes": 128000,
      "hash_sha256": "def456..."
    }
  ]
}
```

---

## 6. Duracao e Renovacao

### 6.1 Limites de Sessao

| Parametro | Valor | Justificativa |
|---|---|---|
| Duracao maxima inicial | 2 horas | Limitar exposicao temporal |
| Renovacao | 1 vez (requer re-aprovacao) | Evitar sessoes longas nao supervisionadas |
| Duracao maxima total | 4 horas | Maximo absoluto por dia |
| Cooldown entre sessoes | 30 minutos | Prevenir uso continuo |
| Maximo de sessoes/dia | 3 | Limitar volume diario |
| Horario permitido | 06:00 - 22:00 (local) | Fora do horario requer aprovacao extra |

### 6.2 Renovacao de Sessao

Para renovar uma sessao JIT:

1. Solicitante clica "Renovar" no portal JIT **antes** da expiracao.
2. Justificativa de renovacao e obrigatoria.
3. Os **mesmos aprovadores** da sessao original devem aprovar.
4. O timer e estendido por mais 2 horas.
5. A gravacao continua ininterrupta.
6. Evento `JIT_SESSION_RENEWED` e registrado na auditoria.

---

## 7. Acoes Proibidas

### 7.1 Lista de Acoes Proibidas

| Acao | Descricao | Consequencia |
|---|---|---|
| Exportacao em massa | Exportar > 100 registros de qualquer tabela | Sessao terminada + alerta |
| Modificacao de schema | ALTER TABLE, DROP TABLE, CREATE TABLE | Sessao terminada + alerta |
| Acesso direto a PHI sem mascaramento | SELECT sem proxy de mascaramento | Bloqueado pelo proxy SQL |
| Desativar auditoria | Alterar configuracao de logs | Sessao terminada + incidente |
| Criar usuarios no banco | CREATE USER, GRANT | Bloqueado por politica |
| Acessar tabelas de credenciais | Tabelas `*_credentials`, `*_secrets` | Bloqueado por politica |
| Acessar outros bancos | Bancos fora do escopo aprovado | Bloqueado por politica |
| Copiar dados para local | Download, scp, rsync de dados de producao | Bloqueado + alerta |
| Desativar gravacao | Kill do processo de gravacao | Sessao terminada + incidente |
| Usar proxy/tunnel | Tunelar acesso para outra maquina | Detectado + alerta |

### 7.2 Deteccao de Acoes Proibidas

```yaml
# jit-prohibited-actions.yaml
prohibited_actions:
  sql:
    patterns:
      - pattern: "(?i)(ALTER|DROP|CREATE)\\s+(TABLE|DATABASE|SCHEMA|INDEX)"
        action: "terminate_session"
        alert: "critical"
      - pattern: "(?i)SELECT\\s+.*\\s+INTO\\s+(OUTFILE|DUMPFILE)"
        action: "terminate_session"
        alert: "critical"
      - pattern: "(?i)(CREATE|DROP|ALTER)\\s+USER"
        action: "block_query"
        alert: "critical"
      - pattern: "(?i)GRANT\\s+"
        action: "block_query"
        alert: "critical"
      - pattern: "(?i)SELECT\\s+.*\\s+FROM\\s+.*_(credentials|secrets|passwords)"
        action: "block_query"
        alert: "critical"
      - pattern: "(?i)SELECT\\s+COUNT\\(\\*\\)\\s+FROM"
        action: "allow"
        alert: "none"
      - pattern: "(?i)SELECT\\s+.*\\s+LIMIT\\s+(\\d+)"
        action: "check_limit"
        max_limit: 100

  shell:
    patterns:
      - pattern: "(?i)(scp|rsync|curl.*-o|wget)\\s+"
        action: "block_command"
        alert: "critical"
      - pattern: "(?i)kill.*asciinema|kill.*screen"
        action: "terminate_session"
        alert: "critical"
      - pattern: "(?i)ssh\\s+-L|-R|-D"
        action: "block_command"
        alert: "critical"
      - pattern: "(?i)(unset|export)\\s+.*LOG|AUDIT"
        action: "terminate_session"
        alert: "critical"

  kubernetes:
    patterns:
      - pattern: "kubectl\\s+delete"
        action: "block_command"
        alert: "warning"
      - pattern: "kubectl\\s+exec.*--\\s+(sh|bash|/bin/)"
        action: "require_reapproval"
        alert: "warning"
      - pattern: "helm\\s+(delete|uninstall)"
        action: "block_command"
        alert: "critical"
```

---

## 8. Acesso de Emergencia de TI

### 8.1 Diferenca entre Break-Glass Clinico e Emergencia TI

| Aspecto | Break-Glass Clinico | Emergencia TI |
|---|---|---|
| Proposito | Acesso a prontuario sem vinculo | Acesso a infra em incidente critico |
| Solicitante | Profissional de saude | Equipe de TI/SRE |
| Aprovador | Automatico (com auditoria) | Gerente de plantao TI |
| Escopo | Dados de um paciente | Sistemas de infraestrutura |
| Duracao | 15 min (renovavel) | 4 horas (incidente) |
| Mascaramento | Nao (dados clinicos necessarios) | Sim (PHI mascarado) |
| Gravacao | Log de auditoria | Sessao completa gravada |
| Revisao | Gestor da unidade em 24h | Post-mortem em 48h |
| Cadeia de aprovacao | Independente | Independente |
| Codigo de acesso | Biometria + PIN + justificativa | Codigo de emergencia + gestor |

### 8.2 Fluxo de Emergencia TI

```
Incidente           SRE            Gestor Plantao      PAM System       Audit
Critico              |                  |                  |               |
    |                |                  |                  |               |
    |---[P1/P2]----->|                  |                  |               |
    |                |--[Solicita       |                  |               |
    |                |  emergencia TI]->|                  |               |
    |                |                  |--[Aprova via     |               |
    |                |                  |  telefone +      |               |
    |                |                  |  codigo OTP]---->|               |
    |                |                  |                  |--[Provisiona  |
    |                |                  |                  |  acesso       |
    |                |                  |                  |  emergencial] |
    |                |<-[Acesso         |                  |               |
    |                |  concedido]------|                  |               |
    |                |                  |                  |               |
    |                |  ... trabalho de resolucao ...      |               |
    |                |                  |                  |               |
    |                |--[Incidente      |                  |               |
    |                |  resolvido]------|               ---|               |
    |                |                  |                  |--[Revogar     |
    |                |                  |                  |  acesso]      |
    |                |                  |                  |--[Gerar       |
    |                |                  |                  |  relatorio]-->|
    |                |                  |                  |               |
    |                |--[Post-mortem    |                  |               |
    |                |  em 48h]---------|                  |               |
```

### 8.3 Restricoes de Emergencia TI

Mesmo em emergencia, algumas acoes continuam proibidas:

- Exportacao de dados de pacientes
- Desativar sistema de auditoria
- Modificar configuracoes de seguranca permanentemente
- Acessar dados de paciente sem mascaramento

---

## 9. Politica OPA para JIT

```yaml
# opa-jit-policy.rego (convertido para YAML de documentacao)

# Politica OPA - Acesso Privilegiado JIT
# Namespace: velya.jit

apiVersion: velya.io/v1
kind: OPAPolicy
metadata:
  name: jit-privileged-access
  namespace: velya-access
spec:
  package: velya.jit

  rules:
    # Regra 1: Validar solicitacao JIT
    - name: validate_request
      description: "Valida se a solicitacao JIT atende todos os criterios"
      conditions:
        all:
          - field: "request.ticket_id"
            operator: "is_not_empty"
            error: "Ticket obrigatorio"
          - field: "request.ticket_status"
            operator: "in"
            values: ["open", "in_progress"]
            error: "Ticket deve estar aberto"
          - field: "request.role"
            operator: "in"
            values:
              - "dba_producao"
              - "sre_producao"
              - "security_analyst"
              - "network_admin"
              - "devops_deploy"
              - "compliance_auditor"
              - "backup_operator"
              - "key_custodian"
            error: "Papel nao elegivel para JIT"
          - field: "request.duration_hours"
            operator: "lte"
            value: 2
            error: "Duracao maxima de 2 horas"
          - field: "request.justification"
            operator: "min_length"
            value: 50
            error: "Justificativa minima de 50 caracteres"

    # Regra 2: Validar horario
    - name: validate_time_window
      description: "Verifica se o horario esta dentro da janela permitida"
      conditions:
        any:
          - all:
              - field: "request.current_hour"
                operator: "gte"
                value: 6
              - field: "request.current_hour"
                operator: "lte"
                value: 22
          - all:
              - field: "request.emergency"
                operator: "eq"
                value: true
              - field: "request.emergency_approval"
                operator: "is_not_empty"

    # Regra 3: Validar aprovacao dupla
    - name: validate_dual_approval
      description: "Verifica aprovacao de dois gestores diferentes"
      conditions:
        all:
          - field: "approvals"
            operator: "count_gte"
            value: 2
          - field: "approvals[*].approver_id"
            operator: "all_different"
          - field: "approvals[*].approver_id"
            operator: "none_equals"
            compare: "request.requestor_id"
            error: "Solicitante nao pode aprovar propria solicitacao"
          - field: "approvals[*].role"
            operator: "all_in"
            values: ["manager_ti", "director_ti", "ciso", "dpo"]

    # Regra 4: Validar limites diarios
    - name: validate_daily_limits
      description: "Verifica limites de sessoes por dia"
      conditions:
        all:
          - field: "user_sessions_today"
            operator: "lt"
            value: 3
            error: "Maximo de 3 sessoes JIT por dia"
          - field: "user_total_hours_today"
            operator: "lt"
            value: 4
            error: "Maximo de 4 horas JIT por dia"
          - field: "last_session_ended_minutes_ago"
            operator: "gte"
            value: 30
            error: "Cooldown de 30 minutos entre sessoes"

    # Regra 5: Validar acoes durante sessao
    - name: validate_session_action
      description: "Verifica se acao e permitida durante sessao JIT"
      deny:
        - field: "action.type"
          operator: "in"
          values:
            - "bulk_export"
            - "schema_modification"
            - "user_creation"
            - "audit_disable"
            - "recording_disable"
            - "credential_access"
          error: "Acao proibida em sessao JIT"

    # Regra 6: Validar escopo de acesso
    - name: validate_access_scope
      description: "Verifica se o acesso esta dentro do escopo aprovado"
      conditions:
        all:
          - field: "target.system"
            operator: "in"
            compare: "approved_scope.systems"
            error: "Sistema fora do escopo aprovado"
          - field: "target.database"
            operator: "in"
            compare: "approved_scope.databases"
            error: "Banco de dados fora do escopo aprovado"
```

---

## 10. Integracao com Ferramentas

### 10.1 Integracao com ITSM (ServiceNow/Jira)

| Campo do Ticket | Mapeamento JIT | Obrigatorio |
|---|---|---|
| Ticket ID | `jit_request.ticket_id` | Sim |
| Tipo (Incident/Change/Task) | Determina nivel de aprovacao | Sim |
| Prioridade | Influencia SLA de aprovacao | Sim |
| Descricao | Contexto para aprovadores | Sim |
| CI Afetado | Determina escopo de acesso | Sim |
| Equipe Designada | Valida se solicitante pertence | Sim |

### 10.2 Integracao com Slack/Teams

```yaml
# jit-notifications.yaml
notifications:
  channels:
    approval_request:
      slack_channel: "#jit-approvals"
      teams_channel: "JIT Approvals"
      format: |
        :key: *Nova Solicitacao JIT*
        *Solicitante:* {{ requestor.name }} ({{ requestor.role }})
        *Ticket:* {{ ticket_id }} - {{ ticket_title }}
        *Sistemas:* {{ target_systems | join(", ") }}
        *Duracao:* {{ duration_hours }}h
        *Justificativa:* {{ justification }}
        [Aprovar]({{ approval_url }}) | [Rejeitar]({{ rejection_url }})

    session_started:
      slack_channel: "#jit-activity"
      format: |
        :unlock: *Sessao JIT Iniciada*
        *Usuario:* {{ user.name }}
        *Sistemas:* {{ target_systems | join(", ") }}
        *Expira em:* {{ expires_at }}

    session_alert:
      slack_channel: "#security-alerts"
      format: |
        :rotating_light: *Alerta de Sessao JIT*
        *Usuario:* {{ user.name }}
        *Acao:* {{ action_description }}
        *Severidade:* {{ alert_severity }}
        *Detalhes:* {{ alert_details }}

    session_ended:
      slack_channel: "#jit-activity"
      format: |
        :lock: *Sessao JIT Encerrada*
        *Usuario:* {{ user.name }}
        *Duracao:* {{ actual_duration }}
        *Comandos:* {{ command_count }}
        *Queries:* {{ query_count }}
        *Alertas:* {{ alert_count }}
```

---

## 11. Metricas e Monitoramento

### 11.1 KPIs de Acesso Privilegiado

| Metrica | Meta | Alerta se |
|---|---|---|
| Tempo medio de aprovacao | < 15 min | > 30 min |
| Sessoes JIT por dia | < 20 | > 30 |
| Taxa de rejeicao | 5-15% | < 2% (rubber-stamping) ou > 30% |
| Sessoes com alerta | < 5% | > 10% |
| Sessoes expiradas (nao renovadas) | > 80% | < 50% (sessoes muito longas) |
| Tempo medio de sessao | 45 min | > 90 min |
| Solicitacoes de desmascaramento | < 2/semana | > 5/semana |
| Acoes proibidas bloqueadas | 0 | > 0 (investigar) |

### 11.2 Alertas Prometheus

```yaml
# jit-alerts.yaml
groups:
  - name: jit_privileged_access
    rules:
      - alert: JITSessionExceedingDuration
        expr: |
          (time() - velya_jit_session_start_timestamp) > 7200
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Sessao JIT excedeu 2 horas para {{ $labels.user_id }}"

      - alert: JITProhibitedActionDetected
        expr: |
          increase(velya_jit_prohibited_actions_total[5m]) > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Acao proibida detectada em sessao JIT de {{ $labels.user_id }}"

      - alert: JITApprovalTimeout
        expr: |
          (time() - velya_jit_request_created_timestamp{status="pending"}) > 1800
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Solicitacao JIT pendente ha mais de 30 minutos"

      - alert: JITHighDailyUsage
        expr: |
          count(velya_jit_sessions_today_total > 2) by (user_id) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Usuario {{ $labels.user_id }} com mais de 2 sessoes JIT hoje"

      - alert: JITUnmaskingRequest
        expr: |
          increase(velya_jit_unmasking_requests_total[1h]) > 0
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "Solicitacao de desmascaramento de dados em sessao JIT"

      - alert: JITOffHoursAccess
        expr: |
          velya_jit_session_active == 1 and (hour() < 6 or hour() > 22)
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Sessao JIT ativa fora do horario comercial"
```

---

## 12. Relatorio de Sessao JIT

Ao final de cada sessao JIT, um relatorio automatico e gerado:

```yaml
# jit-session-report-template.yaml
report:
  header:
    report_id: "JIT-RPT-{{ session_id }}"
    generated_at: "{{ now | iso8601 }}"
    session_id: "{{ session_id }}"

  requestor:
    user_id: "{{ user.id }}"
    name: "{{ user.name }}"
    role: "{{ user.jit_role }}"
    department: "{{ user.department }}"

  request:
    ticket_id: "{{ ticket_id }}"
    justification: "{{ justification }}"
    requested_at: "{{ requested_at }}"
    approved_at: "{{ approved_at }}"
    approval_duration_minutes: "{{ approval_duration }}"

  approvals:
    - approver: "{{ approver_1.name }}"
      role: "{{ approver_1.role }}"
      approved_at: "{{ approver_1.timestamp }}"
    - approver: "{{ approver_2.name }}"
      role: "{{ approver_2.role }}"
      approved_at: "{{ approver_2.timestamp }}"

  session:
    started_at: "{{ session.start }}"
    ended_at: "{{ session.end }}"
    duration_minutes: "{{ session.duration }}"
    termination_reason: "{{ session.termination_reason }}"
    renewed: "{{ session.renewed }}"

  activity:
    commands_total: "{{ activity.commands }}"
    queries_total: "{{ activity.queries }}"
    alerts_triggered: "{{ activity.alerts }}"
    prohibited_actions_blocked: "{{ activity.prohibited_blocked }}"
    data_unmasking_requests: "{{ activity.unmasking_requests }}"

  target_systems:
    - system: "{{ system.name }}"
      access_type: "{{ system.access_type }}"
      databases_accessed: "{{ system.databases }}"

  recordings:
    - type: "terminal"
      path: "{{ recording.terminal_path }}"
      hash: "{{ recording.terminal_hash }}"
    - type: "query_log"
      path: "{{ recording.query_path }}"
      hash: "{{ recording.query_hash }}"

  compliance:
    masking_maintained: "{{ compliance.masking_ok }}"
    scope_respected: "{{ compliance.scope_ok }}"
    duration_respected: "{{ compliance.duration_ok }}"
    recording_complete: "{{ compliance.recording_ok }}"
    overall_status: "{{ compliance.overall }}"
```

---

*Documento gerado para a plataforma Velya. Uso interno - Seguranca e Operacoes.*
