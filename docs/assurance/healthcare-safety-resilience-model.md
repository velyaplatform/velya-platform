# Modelo de Seguranca e Resiliencia Hospitalar

> Documento 12 - Layered Assurance + Self-Healing  
> Plataforma Velya - Sistema Hospitalar Inteligente  
> Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

A Velya opera em ambiente hospitalar onde falhas de software podem impactar diretamente a seguranca do paciente. Este documento define padroes de seguranca especificos para saude, mapeamento de requisitos regulatorios (HIPAA, LGPD), decisoes fail-safe vs fail-open, e como cada camada de assurance contribui para a seguranca clinica.

---

## 2. Principios Fundamentais de Seguranca Hospitalar

| Principio | Descricao | Implicacao Tecnica |
|---|---|---|
| **Alta nunca silenciosamente bloqueada** | O processo de alta hospitalar NUNCA pode travar sem notificacao | Temporal workflow com escalation obrigatoria em todo timeout |
| **Dado clinico imutavel** | Dados clinicos nao podem ser alterados sem audit trail | audit-service registra toda mutacao com before/after/actor |
| **Agente nao e autoridade final** | Agentes de IA recomendam, humanos decidem | Todas as decisoes de agente requerem confirmacao humana para acoes clinicas |
| **PHI com acesso minimo** | Dados de saude acessados apenas quando necessario | RBAC granular + rate limiting + logging obrigatorio |
| **Falha visivel** | Qualquer falha deve ser visivel, nao escondida | Circuit breakers expoe estado, degradacao e comunicada ao usuario |
| **Compensacao garantida** | Se uma operacao falhar no meio, o estado deve ser consistente | Saga pattern com compensacao em Temporal workflows |

---

## 3. Padroes de Seguranca Clinica

### 3.1 Alta Hospitalar - Nunca Silenciosamente Bloqueada

**Requisito:** O processo de alta de um paciente NUNCA pode ficar travado sem que alguem seja notificado. Se o sistema falhar, o processo deve continuar manualmente.

**Implementacao:**

```
Discharge Workflow
|
+-- Cada step tem timeout definido
|   |
|   +-- Timeout atingido (1a vez)
|   |   --> Notificar responsavel direto (Slack + app)
|   |   --> Adicionar badge "ATRASADO" no dashboard
|   |
|   +-- Timeout atingido (2a vez)
|   |   --> Escalar para supervisor
|   |   --> SMS para responsavel
|   |
|   +-- Timeout atingido (3a vez)
|       --> Escalar para diretoria clinica
|       --> Pager para clinical-lead
|       --> Criar protocolo manual de alta
|       --> NUNCA silenciar
|
+-- Workflow inteiro tem timeout de 24h
|   |
|   +-- Se atingir 24h sem conclusao
|       --> Alerta P0 para toda equipe clinica
|       --> Criar caso manual obrigatorio
|       --> Registrar no audit como "discharge_blocked_system_failure"
|
+-- Se Temporal estiver indisponivel
    |
    +-- Fallback: processo manual com formulario fisico
    +-- Registrar pendencia para sync posterior
    +-- NUNCA impedir a alta por falha de sistema
```

**Metricas de monitoramento:**

```promql
# Alertar se qualquer discharge esta sem progresso por mais de 2h
velya_discharge_step_duration_seconds{status="in_progress"} > 7200

# Alertar se ha mais de 3 discharges bloqueados simultaneamente
count(velya_discharge_workflow_state{state="blocked"}) > 3

# Taxa de discharges que precisaram de escalacao
rate(velya_discharge_escalation_total[24h]) / rate(velya_discharge_initiated_total[24h])
```

### 3.2 Reconciliacao de Medicamentos

**Requisito:** A reconciliacao de medicamentos durante alta deve seguir uma cadeia de validacao completa. Nenhum medicamento pode ser dispensado sem verificacao de interacoes.

**Cadeia de validacao:**

```
1. COLETA
   |-- Listar medicamentos atuais do paciente (prontuario eletronico)
   |-- Listar medicamentos pre-internacao (historico)
   |-- Listar medicamentos prescritos na alta
   |
2. RECONCILIACAO
   |-- Comparar listas: continuados, adicionados, removidos, alterados
   |-- Para cada alteracao: registrar motivo clinico
   |-- Verificacao automatica de interacoes (drug-drug, drug-food, drug-allergy)
   |
3. VALIDACAO AUTOMATICA
   |-- policy-engine verifica regras de prescricao
   |-- ai-gateway verifica interacoes via modelo especializado
   |-- Resultado: APROVADO | ALERTA | BLOQUEADO
   |
4. VALIDACAO HUMANA
   |-- Se APROVADO: farmaceutico confirma
   |-- Se ALERTA: farmaceutico revisa + medico confirma
   |-- Se BLOQUEADO: medico obrigado a justificar override
   |
5. DISPENSACAO
   |-- Farmacia libera medicamentos
   |-- Registro em audit-service: quem, quando, o que, para quem
   |
6. ORIENTACAO
   |-- Gerar instrucoes de uso para paciente
   |-- Registrar que paciente/responsavel recebeu orientacao
```

**Implementacao tecnica:**

```typescript
// activities/medication-review.ts
export async function performMedicationReview(input: {
  patientId: string;
  facilityId: string;
  currentMedications: Medication[];
}): Promise<MedicationReviewResult> {
  
  // 1. Buscar historico de medicamentos
  const preAdmissionMeds = await patientFlowClient.getMedicationHistory(input.patientId);
  const prescribedMeds = await patientFlowClient.getDischargePrescriptions(input.patientId);
  
  // 2. Reconciliar
  const reconciliation = reconcileMedications(
    input.currentMedications,
    preAdmissionMeds,
    prescribedMeds
  );
  
  // 3. Verificar interacoes
  const interactions = await policyEngine.checkDrugInteractions({
    medications: reconciliation.finalList,
    patientAllergies: await patientFlowClient.getAllergies(input.patientId),
    patientConditions: await patientFlowClient.getConditions(input.patientId),
  });
  
  // 4. Classificar resultado
  let validationStatus: 'approved' | 'alert' | 'blocked';
  
  if (interactions.critical.length > 0) {
    validationStatus = 'blocked';
  } else if (interactions.warnings.length > 0) {
    validationStatus = 'alert';
  } else {
    validationStatus = 'approved';
  }
  
  // 5. Registrar no audit trail
  await auditService.record({
    event: 'MEDICATION_RECONCILIATION',
    patientId: input.patientId,
    data: {
      reconciliation,
      interactions,
      validationStatus,
    },
    actor: 'system:medication-review',
    requiresHumanConfirmation: validationStatus !== 'approved',
  });
  
  // 6. Se bloqueado, NUNCA prosseguir sem override documentado
  if (validationStatus === 'blocked') {
    throw new MedicationInteractionBlockedError({
      patientId: input.patientId,
      criticalInteractions: interactions.critical,
      message: 'Interacoes criticas detectadas. Requer override medico documentado.',
    });
  }
  
  return {
    reviewId: generateId(),
    reconciledList: reconciliation.finalList,
    interactions,
    validationStatus,
    requiresPharmacistConfirmation: true,
    requiresPhysicianConfirmation: validationStatus === 'alert',
  };
}
```

### 3.3 Audit Trail para Dados Clinicos

**Requisito:** Toda alteracao em dados clinicos deve ter audit trail completo e imutavel.

**Campos obrigatorios do audit trail:**

| Campo | Descricao | Exemplo |
|---|---|---|
| `eventId` | ID unico do evento | UUID |
| `timestamp` | Momento exato (UTC) | `2026-04-08T14:30:00.000Z` |
| `actor` | Quem realizou a acao | `user:dr.silva`, `agent:discharge-agent`, `system:scheduler` |
| `actorIp` | IP de origem | `10.0.1.45` |
| `action` | Tipo de acao | `CREATE`, `UPDATE`, `DELETE`, `READ`, `EXPORT` |
| `resource` | Recurso afetado | `patient:uuid/medications` |
| `resourceBefore` | Estado anterior (para UPDATE/DELETE) | JSON snapshot |
| `resourceAfter` | Estado posterior (para CREATE/UPDATE) | JSON snapshot |
| `reason` | Motivo da acao | `discharge_process`, `clinical_correction` |
| `correlationId` | ID de correlacao | UUID |
| `facility` | Unidade hospitalar | `hospital-central` |
| `classification` | Classificacao do dado | `PHI`, `PII`, `administrative` |

**Garantias tecnicas:**

```yaml
# audit-service/config.yaml
audit:
  storage:
    primary: postgresql  # Tabela append-only
    secondary: s3        # Backup imutavel
    
  table:
    name: audit_events
    partitioning: by_month
    retention: 7_years   # Exigencia regulatoria
    immutable: true      # Sem UPDATE ou DELETE
    
  write:
    mode: synchronous    # Nunca async para dados clinicos
    replication: 2       # Minimo 2 replicas antes de ACK
    timeout: 5s
    retry:
      attempts: 3
      backoff: exponential
    dead_letter:
      enabled: true
      topic: audit-events.dlq
      alert_on_first: true  # Qualquer falha de audit e critica
      
  read:
    require_authentication: true
    require_authorization: true
    log_access: true     # Logar quem leu o audit trail
    rate_limit:
      per_user: 100/min
      per_service: 1000/min
```

### 3.4 Acesso a PHI (Protected Health Information)

**Requisito:** Todo acesso a dados de saude protegidos deve ser logado, autenticado, autorizado, e rate-limited.

**Controles implementados:**

```
Request para dados PHI
|
+-- 1. AUTENTICACAO
|   |-- JWT valido com claims de identidade
|   |-- Token nao expirado
|   |-- MFA verificado (para dados sensiveis)
|   |-- Se falhar: 401, log de tentativa
|
+-- 2. AUTORIZACAO (RBAC + ABAC)
|   |-- Role permite acesso ao tipo de dado?
|   |-- Usuario tem relacao com o paciente? (treating physician, nurse assigned)
|   |-- Horario de acesso esta dentro do turno?
|   |-- Se falhar: 403, log de tentativa + alerta se recorrente
|
+-- 3. RATE LIMITING
|   |-- Maximo 100 pacientes distintos por hora por usuario
|   |-- Maximo 1000 requests por hora por usuario
|   |-- Se exceder: 429, alerta de possivel data mining
|
+-- 4. LOGGING (OBRIGATORIO)
|   |-- Registrar: quem, quando, qual paciente, quais campos, de onde
|   |-- Log nao pode ser desabilitado
|   |-- Falha de logging BLOQUEIA o acesso (fail-safe)
|
+-- 5. MASCARAMENTO
|   |-- Dados retornados com mascaramento baseado em role
|   |-- Enfermeiro: ve medicamentos, nao ve historico psiquiatrico
|   |-- Medico: ve tudo do seu departamento
|   |-- Admin: ve dados administrativos, nao ve dados clinicos
|
+-- 6. RESPOSTA
    |-- Headers de seguranca: no-cache, no-store
    |-- Dados sensiveis nunca em query string
    |-- Response inclui access-log-id para auditoria
```

**Prometheus alerts para PHI:**

```promql
# Usuario acessando muitos pacientes distintos
count by (user) (
  count_over_time(
    velya_phi_access_total{action="read"}[1h]
  )
) > 100

# Acesso fora do horario de turno
velya_phi_access_total{
  access_hour !~ "06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22"
} > 0

# Taxa de acesso negado acima do normal
rate(velya_phi_access_denied_total[5m]) > 5
```

### 3.5 Recomendacoes de Agentes Clinicos

**Requisito:** Toda recomendacao de agente clinico (IA) DEVE incluir: confianca, evidencia, alternativas. O agente NUNCA e a autoridade final.

**Formato obrigatorio de resposta de agente clinico:**

```typescript
interface ClinicalAgentRecommendation {
  // Identificacao
  recommendationId: string;
  agentId: string;
  agentVersion: string;
  timestamp: string;
  
  // Contexto
  patientId: string;
  clinicalContext: string;
  
  // Recomendacao principal
  recommendation: {
    action: string;           // "Iniciar alta hospitalar"
    rationale: string;        // "Paciente atende criterios de alta: ..."
    confidence: number;       // 0.0 - 1.0
    confidenceLevel: 'high' | 'medium' | 'low';
  };
  
  // Evidencias que suportam a recomendacao
  evidence: {
    source: string;           // "prontuario_eletronico", "lab_results", "vital_signs"
    description: string;      // "Sinais vitais estaveis por 24h"
    weight: number;           // 0.0 - 1.0 (importancia para a decisao)
    dataTimestamp: string;    // Quando o dado foi coletado
  }[];
  
  // Alternativas consideradas
  alternatives: {
    action: string;           // "Manter internacao por mais 24h"
    rationale: string;        // "Exames laboratoriais pendentes"
    confidence: number;
    tradeoffs: string;        // "Maior custo, porem menor risco de readmissao"
  }[];
  
  // Riscos identificados
  risks: {
    description: string;      // "Risco de readmissao em 30 dias"
    probability: 'high' | 'medium' | 'low';
    mitigation: string;       // "Agendar consulta de retorno em 7 dias"
  }[];
  
  // Restricoes
  constraints: {
    requiresHumanApproval: true;    // SEMPRE true para acoes clinicas
    expiresAt: string;              // Recomendacao expira se nao validada
    validFor: string;               // "2h" - contexto pode mudar
    supersededBy?: string;          // Se recomendacao mais recente existir
  };
  
  // Policy compliance
  policyValidation: {
    checked: boolean;
    policies: string[];
    compliant: boolean;
    violations: string[];
  };
}
```

**Validacao no policy-engine:**

```yaml
# policies/clinical-agent-recommendation.rego
package velya.clinical.agent

default allow_recommendation = false

allow_recommendation {
  input.recommendation.confidence >= 0.5
  count(input.evidence) >= 2
  count(input.alternatives) >= 1
  input.constraints.requiresHumanApproval == true
  input.policyValidation.compliant == true
  not expired(input.constraints.expiresAt)
}

deny_recommendation[msg] {
  input.recommendation.confidence < 0.5
  msg := sprintf("Confianca muito baixa (%v). Minimo: 0.5", [input.recommendation.confidence])
}

deny_recommendation[msg] {
  count(input.evidence) < 2
  msg := "Evidencia insuficiente. Minimo: 2 fontes"
}

deny_recommendation[msg] {
  count(input.alternatives) < 1
  msg := "Alternativas nao fornecidas. Minimo: 1 alternativa"
}

deny_recommendation[msg] {
  input.constraints.requiresHumanApproval != true
  msg := "Recomendacao clinica DEVE requerer aprovacao humana"
}
```

---

## 4. Decisoes Fail-Safe vs Fail-Open

### 4.1 Definicoes

| Modo | Descricao | Quando Usar |
|---|---|---|
| **Fail-Safe** | Em caso de falha, BLOQUEAR a operacao | Quando a acao pode causar dano ao paciente |
| **Fail-Open** | Em caso de falha, PERMITIR a operacao | Quando bloquear pode causar dano maior que permitir |

### 4.2 Classificacao por Funcionalidade

| Funcionalidade | Modo de Falha | Justificativa |
|---|---|---|
| Dispensacao de medicamento controlado | **Fail-Safe** | Erro de medicacao pode ser fatal |
| Processo de alta hospitalar | **Fail-Open** | Bloquear alta por falha de sistema causa dano ao paciente (retencao indevida) |
| Acesso a prontuario em emergencia | **Fail-Open** (break-glass) | Em emergencia, acesso ao historico salva vidas |
| Agendamento de consulta | **Fail-Safe** | Dupla marcacao ou erro pode ser corrigido depois |
| Triagem de urgencia | **Fail-Open** | Paciente deve ser atendido mesmo sem sistema |
| Audit trail | **Fail-Safe** | Operacao sem audit trail viola regulacao |
| Rotacao de secrets | **Fail-Safe** | Secret invalido pode derrubar servicos |
| Autenticacao de usuario | **Fail-Safe** | Acesso nao autorizado a dados de paciente |
| Autenticacao em emergencia | **Fail-Open** (break-glass) | Em P0, acesso deve ser possivel com log pos-facto |
| Decisao de agente clinico | **Fail-Safe** | Agente sem validacao nao deve influenciar decisao |
| Dashboard de monitoramento | **Fail-Open** | Falha no dashboard nao deve impedir visualizacao de dados anteriores (cache) |
| Publicacao de evento no NATS | **Fail-Safe** com buffer | Evento perdido pode significar dado clinico perdido |
| Faturamento | **Fail-Safe** | Erro financeiro requer correcao custosa |

### 4.3 Implementacao de Break-Glass

```typescript
// middleware/break-glass.ts
export async function breakGlassMiddleware(req: Request, res: Response, next: NextFunction) {
  const isBreakGlass = req.headers['x-velya-break-glass'] === 'true';
  
  if (!isBreakGlass) {
    return next();
  }
  
  // Verificar que usuario tem permissao de break-glass
  const user = req.user;
  if (!user.roles.includes('break-glass-authorized')) {
    return res.status(403).json({
      error: 'Break-glass nao autorizado para este usuario',
    });
  }
  
  // Registrar uso de break-glass ANTES de permitir acesso
  await auditService.record({
    event: 'BREAK_GLASS_ACTIVATED',
    actor: user.id,
    actorIp: req.ip,
    resource: req.path,
    reason: req.headers['x-velya-break-glass-reason'] as string,
    classification: 'security_critical',
    alertImmediate: true,
  });
  
  // Notificar seguranca imediatamente
  await notifySecurityTeam({
    event: 'break_glass',
    user: user.id,
    resource: req.path,
    reason: req.headers['x-velya-break-glass-reason'],
    timestamp: new Date().toISOString(),
  });
  
  // Marcar request para logging extra
  req.breakGlass = true;
  req.breakGlassAuditId = auditRecord.id;
  
  next();
}
```

---

## 5. Mapeamento de Requisitos Regulatorios

### 5.1 HIPAA (Health Insurance Portability and Accountability Act)

| Requisito HIPAA | Secao | Implementacao Velya | Camada de Assurance |
|---|---|---|---|
| Access controls | 164.312(a)(1) | RBAC via policy-engine + Kubernetes RBAC | Layer 0: Pre-deploy |
| Audit controls | 164.312(b) | audit-service com retencao de 7 anos | Layer 2: Runtime |
| Integrity controls | 164.312(c)(1) | Checksums em dados clinicos + append-only audit | Layer 2: Runtime |
| Transmission security | 164.312(e)(1) | mTLS entre servicos + TLS 1.3 externo | Layer 0: Pre-deploy |
| Person authentication | 164.312(d) | JWT + MFA para dados sensiveis | Layer 2: Runtime |
| Encryption at rest | 164.312(a)(2)(iv) | AWS KMS + EBS encryption | Layer 0: Infra |
| Emergency access | 164.312(a)(2)(ii) | Break-glass procedure | Layer 2: Runtime |
| Automatic logoff | 164.312(a)(2)(iii) | Session timeout: 15min idle, 8h max | Layer 2: Runtime |
| Unique user identification | 164.312(a)(2)(i) | SSO + unique user ID propagado | Layer 0: Pre-deploy |
| Minimum necessary | 164.502(b) | Field-level access control + mascaramento | Layer 2: Runtime |
| Business associate agreements | 164.502(e) | Contratos com AWS, Anthropic (Claude) | Layer 0: Organizacional |
| Breach notification | 164.404 | Alertas automaticos + procedimento documentado | Layer 3: Self-healing |
| Risk analysis | 164.308(a)(1)(ii)(A) | change-risk-matrix.md + analise por mudanca | Layer 1: Deploy |

### 5.2 LGPD (Lei Geral de Protecao de Dados)

| Requisito LGPD | Artigo | Implementacao Velya | Camada de Assurance |
|---|---|---|---|
| Base legal para tratamento | Art. 7, 11 | Consentimento + necessidade para tutela da saude | Layer 0: Design |
| Dados sensiveis de saude | Art. 11 | Classificacao automatica + controles extras | Layer 2: Runtime |
| Direito de acesso | Art. 18, I | API de export de dados do paciente | Layer 2: Runtime |
| Direito de correcao | Art. 18, III | API de correcao com audit trail | Layer 2: Runtime |
| Direito de exclusao | Art. 18, VI | Anonimizacao (nao exclusao fisica por obrigacao legal) | Layer 2: Runtime |
| Portabilidade | Art. 18, V | Export em formato interoperavel (FHIR) | Layer 2: Runtime |
| Relatorio de impacto | Art. 38 | Documentacao automatizada de fluxos de dados | Layer 0: Design |
| Encarregado (DPO) | Art. 41 | Notificacoes automaticas para DPO em eventos de risco | Layer 3: Self-healing |
| Notificacao de incidente | Art. 48 | Deteccao automatica + procedimento de 72h | Layer 3: Self-healing |
| Transferencia internacional | Art. 33 | Dados em regiao AWS sa-east-1 (Sao Paulo) | Layer 0: Infra |
| Registro de tratamento | Art. 37 | Logs em audit-service mapeados para operacoes LGPD | Layer 2: Runtime |
| Anonimizacao | Art. 12 | Pipeline de anonimizacao para analytics | Layer 0: Design |

### 5.3 Compliance Checks Automatizados

```yaml
# cronjobs/compliance-checks.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: check-hipaa-compliance
  namespace: velya-system
  labels:
    velya.io/owner: compliance
    velya.io/check-type: regulatory
    velya.io/severity: critical
spec:
  schedule: "0 */12 * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 1800
      template:
        spec:
          serviceAccountName: velya-compliance-checker
          restartPolicy: Never
          containers:
            - name: hipaa-check
              image: registry.velya.io/compliance/hipaa-checker:2.0.0
              env:
                - name: CHECKS
                  value: |
                    audit_log_completeness
                    encryption_at_rest_verified
                    access_control_rbac_valid
                    mtls_between_services
                    session_timeout_configured
                    phi_access_logged
                    backup_encryption_verified
                    user_authentication_mfa
                    minimum_necessary_enforced
                    break_glass_logged
                - name: REPORT_OUTPUT
                  value: "s3://velya-compliance/hipaa/$(date +%Y-%m-%d).json"
                - name: ALERT_ON_FAILURE
                  value: "true"
                - name: ALERT_CHANNEL
                  value: "#velya-compliance-critical"
```

---

## 6. Mapeamento: Requisitos de Seguranca x Camadas de Assurance

```
+---------------------------------------------------------------+
| CAMADA 0: PRE-DEPLOY (Prevencao)                              |
|                                                                |
| - RBAC definido em codigo (policy-as-code)                    |
| - Scan de vulnerabilidades em imagens                         |
| - Testes de contrato de API                                   |
| - Revisao de codigo para padrao PHI                           |
| - Validacao de configuracao de encryption                     |
| - Network policies revisadas                                  |
+---------------------------------------------------------------+
        |
+---------------------------------------------------------------+
| CAMADA 1: DEPLOY (Validacao)                                  |
|                                                                |
| - Canary analysis com metricas clinicas                       |
| - Rollback automatico se error rate > threshold               |
| - Validacao de backward compatibility de DB                   |
| - Verificacao de External Secrets sincronizados               |
| - Smoke tests de endpoints criticos                           |
+---------------------------------------------------------------+
        |
+---------------------------------------------------------------+
| CAMADA 2: RUNTIME (Deteccao e Protecao)                       |
|                                                                |
| - Audit trail em tempo real                                   |
| - Rate limiting de acesso a PHI                               |
| - Circuit breakers com fallback seguro                        |
| - Policy-engine validando decisoes de agentes                 |
| - Temporal workflows com compensacao                          |
| - Monitoramento de interacoes medicamentosas                  |
| - Health checks recorrentes                                   |
+---------------------------------------------------------------+
        |
+---------------------------------------------------------------+
| CAMADA 3: SELF-HEALING (Resposta e Recuperacao)               |
|                                                                |
| - Rollback automatico de deploys falhos                       |
| - Quarentena de agentes com comportamento anomalo             |
| - Replay de mensagens de DLQ apos correcao                   |
| - Escalacao automatica para equipe clinica                    |
| - Post-failure learning consolidation                         |
| - Notificacao de incidente para DPO (LGPD) e compliance      |
+---------------------------------------------------------------+
```

---

## 7. Cenarios de Falha e Resposta

### 7.1 Cenario: Agente recomenda alta para paciente errado

```
DETECCAO:
  - policy-engine detecta inconsistencia entre patientId no contexto
    e patientId nos dados clinicos referenciados
  - OU: enfermeiro reporta recomendacao incorreta

RESPOSTA IMEDIATA:
  1. Agente vai para quarentena automatica
  2. Recomendacao marcada como INVALIDA no decision-log-service
  3. Todas as recomendacoes do agente nas ultimas 4h sao marcadas para re-review
  4. Notificacao para equipe clinica: verificar todos os pacientes afetados

INVESTIGACAO:
  5. Coletar traces da decisao (correlationId)
  6. Verificar estado do memory-service (dados corrompidos?)
  7. Verificar logs do ai-gateway (input/output do modelo)
  8. Post-failure learning workflow ativado

PREVENCAO:
  9. Adicionar check de consistencia patientId no policy-engine
  10. Aumentar threshold de confianca minima para recomendacoes de alta
  11. Adicionar teste de regressao
```

### 7.2 Cenario: Audit service indisponivel

```
DETECCAO:
  - Health check do audit-service falha 3x consecutivas
  - Circuit breaker do audit-service abre

RESPOSTA IMEDIATA (FAIL-SAFE):
  1. Todas as operacoes que exigem audit trail sao BLOQUEADAS
  2. Operacoes administrativas retornam 503 com mensagem clara
  3. Operacoes clinicas de EMERGENCIA usam buffer local com sync posterior
  4. Notificacao P0 para platform-sre e compliance

BUFFER DE EMERGENCIA:
  - Eventos de audit sao escritos em NATS JetStream (stream: audit-emergency-buffer)
  - Retencao: 24h
  - Apos recovery do audit-service: replay automatico do buffer
  - Verificacao de completude: count de eventos no buffer vs count no audit-service

NUNCA:
  - Nunca descartar eventos de audit
  - Nunca desabilitar o requisito de audit para acelerar operacoes
  - Nunca permitir operacoes clinicas sem audit (exceto break-glass documentado)
```

### 7.3 Cenario: Vazamento de dados (breach)

```
DETECCAO:
  - Rate limiting detecta acesso anomalo a dados de pacientes
  - OU: monitoramento de DLP detecta dados PHI em local nao autorizado
  - OU: alerta de AWS GuardDuty

RESPOSTA (72h LGPD / sem delay HIPAA):
  HORA 0-1:
    1. Isolar fonte do vazamento (revogar credenciais, bloquear IP)
    2. Preservar evidencias (snapshots de logs, nao deletar nada)
    3. Notificar security team e DPO
    4. Iniciar investigacao de escopo

  HORA 1-24:
    5. Determinar quais dados foram acessados
    6. Determinar quais pacientes foram afetados
    7. Preparar relatorio de impacto
    8. Notificar ANPD se dados sensiveis (LGPD Art. 48)
    9. Notificar HHS se PHI (HIPAA Breach Notification Rule)

  HORA 24-72:
    10. Notificar pacientes afetados
    11. Implementar correcoes
    12. Atualizar controles de acesso
    13. Documentar post-mortem completo
    14. Atualizar change-risk-matrix
```

---

## 8. Testes de Seguranca Clinica

### 8.1 Testes Obrigatorios por Release

| Teste | Frequencia | Automatizado | Owner |
|---|---|---|---|
| PHI access logging verification | Cada release | Sim | compliance |
| Medication interaction detection accuracy | Cada release do ai-gateway | Sim | clinical-eng |
| Break-glass procedure validation | Trimestral | Manual | security |
| Audit trail completeness | Cada release do audit-service | Sim | compliance |
| RBAC policy correctness | Cada release do policy-engine | Sim | security |
| Discharge workflow escalation | Mensal | Semi-auto | clinical-eng |
| Data encryption at rest verification | Trimestral | Sim | platform-sre |
| Session timeout enforcement | Cada release do velya-web | Sim | frontend |
| Agent recommendation format compliance | Cada release do agent-orchestrator | Sim | ai-ops |

### 8.2 Chaos Testing Clinico

| Teste | Objetivo | Frequencia | Impacto Permitido |
|---|---|---|---|
| Kill audit-service | Verificar fail-safe e buffer | Mensal | Zero perda de eventos |
| Kill Temporal worker | Verificar que discharge nao trava silenciosamente | Mensal | Escalacao em < 5min |
| Kill ai-gateway | Verificar fallback de agentes | Mensal | Decisoes manuais continuam |
| Network partition NATS | Verificar que eventos clinicos nao se perdem | Trimestral | Buffer + replay |
| Simular breach | Verificar procedimento de resposta | Semestral | Deteccao em < 15min |

---

## 9. Metricas de Seguranca Clinica

```promql
# SLI: Taxa de discharges completados sem escalacao
velya_discharge_completed_total{escalated="false"}
/ velya_discharge_completed_total

# SLI: Taxa de acesso a PHI com logging completo
velya_phi_access_logged_total / velya_phi_access_total

# SLI: Taxa de recomendacoes de agente com formato completo
velya_agent_recommendation_valid_total / velya_agent_recommendation_total

# SLI: Taxa de reconciliacoes de medicamento sem interacao critica nao detectada
# (Medido por auditorias periodicas)
velya_medication_reconciliation_correct_total / velya_medication_reconciliation_total

# SLI: Compliance score (porcentagem de checks passando)
count(velya_compliance_check_result{result="pass"})
/ count(velya_compliance_check_result)
```
