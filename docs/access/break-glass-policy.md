# Politica de Break-Glass (Acesso de Emergencia) - Velya Platform

> Versao: 1.0 | Ultima atualizacao: 2026-04-08
> Classificacao: Documento Interno - Arquitetura de Seguranca

---

## 1. Visao Geral

O Break-Glass (Quebra de Vidro) e um mecanismo de acesso de emergencia que permite
a profissionais clinicos autorizados acessar dados de pacientes com os quais nao
possuem relacao profissional ativa, quando ha risco iminente a vida ou a saude.

### Fundamento Legal

- **LGPD Art. 7o, VII:** Tratamento de dados para protecao da vida ou da
  incolumidade fisica do titular ou de terceiro.
- **CFM 2.217/2018, Art. 33:** Em situacao de emergencia, o medico pode realizar
  procedimentos sem consentimento previo.
- **Lei 12.842/2013, Art. 4o, §6o:** Em emergencia, profissionais podem atuar
  para salvar a vida, mesmo fora do escopo habitual.

### Principio Fundamental

> O break-glass existe para salvar vidas, nao para contornar controles de acesso.
> Todo uso e presuntivamente legitimo ate revisao, mas todo uso e obrigatoriamente
> revisado.

---

## 2. Elegibilidade

### 2.1 Roles Elegiveis para Break-Glass

Apenas profissionais com responsabilidade clinica direta e registro em conselho
profissional de saude podem ativar break-glass.

| Role                      | Elegivel | Justificativa                             |
| ------------------------- | :------: | ----------------------------------------- |
| clinical_director         |   Sim    | Medico com CRM, responsavel tecnico       |
| medical_staff_attending   |   Sim    | Medico com CRM, cuidado direto            |
| medical_staff_on_call     |   Sim    | Medico com CRM, plantao                   |
| nurse                     |   Sim    | Enfermeiro com COREN, cuidado direto      |
| nursing_technician        |   Nao    | Sem autonomia para decisao de emergencia  |
| nursing_assistant         |   Nao    | Sem autonomia para decisao de emergencia  |
| pharmacist_clinical       |   Nao    | Nao presta cuidado direto de emergencia   |
| physiotherapist           |   Nao    | Nao presta cuidado direto de emergencia\* |
| nutritionist              |   Nao    | Nao presta cuidado direto de emergencia   |
| psychologist              |   Nao    | Nao presta cuidado direto de emergencia   |
| social_worker             |   Nao    | Nao presta cuidado clinico                |
| speech_therapist          |   Nao    | Nao presta cuidado direto de emergencia   |
| occupational_therapist    |   Nao    | Nao presta cuidado direto de emergencia   |
| lab_staff                 |   Nao    | Nao presta cuidado direto                 |
| imaging_staff             |   Nao    | Nao presta cuidado direto                 |
| receptionist_registration |   Nao    | Sem funcao clinica                        |
| billing_authorization     |   Nao    | Sem funcao clinica                        |
| ambulance_driver          |   Nao    | Sem funcao clinica                        |
| patient_transporter       |   Nao    | Sem funcao clinica                        |
| cleaning_hygiene          |   Nao    | Sem funcao clinica                        |
| maintenance               |   Nao    | Sem funcao clinica                        |
| security_guard            |   Nao    | Sem funcao clinica                        |
| bed_management            |   Nao    | Sem funcao clinica direta                 |
| case_manager              |   Nao    | Nao presta cuidado direto de emergencia   |
| compliance_auditor        |   Nao    | Sem funcao clinica                        |
| internal_auditor          |   Nao    | Sem funcao clinica                        |
| it_support_jit            |   Nao    | Sem funcao clinica                        |
| security_admin_jit        |   Nao    | Sem funcao clinica                        |

> `*` Fisioterapeuta em UTI pode ser elegivel em cenarios especificos de
> insuficiencia respiratoria aguda. Requer avaliacao caso a caso e aprovacao
> do clinical_director.

### 2.2 Pre-requisitos para Ativacao

```yaml
break_glass_prerequisites:
  mandatory:
    - credential_active: true # Conselho profissional ativo (CRM/COREN)
    - mfa_verified: true # MFA verificado na sessao atual
    - location: hospital_network # Deve estar na rede do hospital
    - session_active: true # Sessao nao expirada
    - no_active_suspension: true # Sem suspensao disciplinar ativa
    - training_completed: true # Treinamento sobre break-glass realizado

  desirable:
    - physical_presence_verified: true # Presenca fisica confirmada (badge/biometria)
    - same_unit_as_patient: true # Mesmo setor do paciente (nao obrigatorio)
```

---

## 3. Fluxo de Ativacao

### 3.1 Diagrama do Fluxo

```
PROFISSIONAL TENTA ACESSAR PRONTUARIO
                |
                v
     +---------------------+
     | ReBAC: Existe        |
     | relacao ativa?       |
     +---------------------+
            |
       +----+----+
       |         |
      SIM       NAO
       |         |
       v         v
    ACESSO    +---------------------+
    NORMAL    | Role e elegivel     |
              | para break-glass?   |
              +---------------------+
                    |
               +----+----+
               |         |
              SIM       NAO
               |         |
               |         v
               |    403 FORBIDDEN
               |    (sem break-glass)
               v
     +---------------------+
     | TELA DE BREAK-GLASS |
     |                      |
     | 1. Banner vermelho   |
     |    "ACESSO DE        |
     |     EMERGENCIA"      |
     |                      |
     | 2. Campo:            |
     |    Justificativa     |
     |    (obrigatorio,     |
     |     min 20 chars)    |
     |                      |
     | 3. Checkbox:         |
     |    [] Reconheco que  |
     |    este acesso sera  |
     |    auditado e        |
     |    revisado          |
     |                      |
     | 4. Re-autenticacao   |
     |    MFA (obrigatoria) |
     |                      |
     | [CANCELAR] [ATIVAR]  |
     +---------------------+
               |
               v
     +---------------------+
     | VALIDACAO            |
     | - MFA verificado?    |
     | - Justificativa ok?  |
     | - Reconhecimento ok? |
     | - Pre-requisitos ok? |
     +---------------------+
            |
       +----+----+
       |         |
     PASS       FAIL
       |         |
       |         v
       |    ACESSO NEGADO
       |    + log de tentativa
       v
     +---------------------+
     | BREAK-GLASS ATIVADO |
     | - Timer iniciado     |
     | - Notificacoes       |
     |   enviadas           |
     | - Borda vermelha UI  |
     | - Audit log          |
     +---------------------+
               |
               v
     +---------------------+
     | ACESSO TEMPORARIO   |
     | Classe C: ate 4h    |
     | Classe D: ate 2h    |
     | Classe E: ate 1h    |
     |                      |
     | Escopo: apenas o     |
     | paciente declarado   |
     +---------------------+
               |
               v
     +---------------------+
     | EXPIRACAO            |
     | - Timer esgotado OU  |
     | - Profissional       |
     |   encerra            |
     | - Admin revoga       |
     +---------------------+
               |
               v
     +---------------------+
     | REVISAO OBRIGATORIA |
     | Dentro de 24h       |
     | Por: clinical_dir + |
     |      compliance     |
     +---------------------+
```

### 3.2 Formulario de Ativacao

```typescript
interface BreakGlassActivationForm {
  // Preenchido automaticamente
  userId: string;
  activeRole: string;
  patientId: string;
  timestamp: string;
  sessionId: string;
  deviceFingerprint: string;
  sourceIp: string;
  location: GeoLocation;

  // Preenchido pelo profissional
  justification: string; // Minimo 20 caracteres
  emergencyType: EmergencyType;
  acknowledgment: boolean; // Reconhecimento de auditoria

  // Verificacao
  mfaToken: string; // Re-autenticacao MFA
}

type EmergencyType =
  | 'cardiac_arrest' // Parada cardiorrespiratoria
  | 'respiratory_failure' // Insuficiencia respiratoria aguda
  | 'hemorrhagic_shock' // Choque hemorragico
  | 'anaphylaxis' // Anafilaxia
  | 'stroke' // AVC agudo
  | 'trauma' // Politrauma
  | 'septic_shock' // Choque septico
  | 'status_epilepticus' // Estado de mal epileptico
  | 'obstetric_emergency' // Emergencia obstetrica
  | 'psychiatric_emergency' // Emergencia psiquiatrica (risco de vida)
  | 'poisoning' // Intoxicacao aguda
  | 'other_life_threatening'; // Outra situacao com risco de vida
```

---

## 4. Limites de Tempo

### 4.1 Duracao por Classe de Dados

| Classe de Dados | Duracao Maxima |  Renovacao   | Justificativa                                    |
| --------------- | :------------: | :----------: | ------------------------------------------------ |
| Classe A        |      N/A       |     N/A      | Nao requer break-glass (nivel 1)                 |
| Classe B        |      N/A       |     N/A      | Nao requer break-glass (nivel 2-3)               |
| Classe C        |    4 horas     | 1x (mais 4h) | Dados clinicos de rotina - emergencia pode durar |
| Classe D        |    2 horas     | 1x (mais 2h) | Dados sensiveis - acesso mais restrito           |
| Classe E        |     1 hora     |     Nao      | Dados altamente restritos - minimo necessario    |

### 4.2 Regras de Renovacao

```typescript
interface BreakGlassRenewal {
  originalSessionId: string;
  renewalJustification: string; // Nova justificativa obrigatoria
  renewalMfa: string; // Nova verificacao MFA
  maxRenewals: number; // 1 para C e D, 0 para E
  escalationOnRenewal: boolean; // Notifica clinical_director na renovacao
}

// Logica de renovacao
async function renewBreakGlass(
  sessionId: string,
  renewal: BreakGlassRenewal,
): Promise<BreakGlassResult> {
  const session = await breakGlassStore.getSession(sessionId);

  if (!session || session.status !== 'active') {
    return { success: false, reason: 'SESSION_NOT_ACTIVE' };
  }

  // Classe E nao pode ser renovada
  if (session.maxDataClass === 'E') {
    return { success: false, reason: 'CLASS_E_NO_RENEWAL' };
  }

  // Verificar limite de renovacoes
  if (session.renewalCount >= 1) {
    return { success: false, reason: 'MAX_RENEWALS_REACHED' };
  }

  // Verificar MFA
  const mfaValid = await mfaService.verify(session.userId, renewal.renewalMfa);
  if (!mfaValid) {
    return { success: false, reason: 'MFA_VERIFICATION_FAILED' };
  }

  // Renovar
  const renewalDuration = getClassDuration(session.maxDataClass);
  session.expiresAt = addDuration(new Date(), renewalDuration);
  session.renewalCount += 1;
  session.renewalJustification = renewal.renewalJustification;

  await breakGlassStore.updateSession(session);

  // Notificar na renovacao
  await notificationService.sendBreakGlassRenewal({
    session,
    targets: ['clinical_director', 'compliance_auditor', 'security_officer'],
  });

  return { success: true, newExpiration: session.expiresAt };
}
```

---

## 5. Limites de Escopo

### 5.1 O Que o Break-Glass Permite

| Acao                                 | Permitido | Condicao                                   |
| ------------------------------------ | :-------: | ------------------------------------------ |
| Visualizar prontuario completo       |    Sim    | Do paciente declarado na ativacao          |
| Visualizar dados sensiveis (D)       |    Sim    | Do paciente declarado, por ate 2h          |
| Visualizar dados restritos (E)       |    Sim    | Do paciente declarado, por ate 1h          |
| Criar evolucao de emergencia         |    Sim    | Apenas medicos (CRM)                       |
| Prescrever medicamento de emergencia |    Sim    | Apenas medicos, lista branca de emergencia |
| Solicitar exame de emergencia        |    Sim    | Medicos e enfermeiros (protocolos)         |

### 5.2 O Que o Break-Glass NAO Permite

| Acao                         | Motivo                                              |
| ---------------------------- | --------------------------------------------------- |
| Acessar outros pacientes     | Escopo limitado ao paciente declarado               |
| Excluir registros            | Delete jamais permitido, mesmo em emergencia        |
| Exportar dados               | Risco de vazamento - nao justificavel em emergencia |
| Imprimir prontuario          | Risco de vazamento - nao justificavel em emergencia |
| Alterar configuracoes        | Fora do escopo de emergencia clinica                |
| Atribuir roles               | Fora do escopo de emergencia clinica                |
| Acessar dados de faturamento | Irrelevante para emergencia clinica                 |
| Revogar relacoes de outros   | Fora do escopo de emergencia clinica                |

### 5.3 Lista Branca de Medicamentos de Emergencia

```yaml
break_glass_emergency_medications:
  description: 'Medicamentos que podem ser prescritos via break-glass'
  categories:
    - name: 'Ressuscitacao Cardiopulmonar'
      medications:
        - epinefrina
        - amiodarona
        - atropina
        - vasopressina
        - bicarbonato_de_sodio
        - gluconato_de_calcio

    - name: 'Choque'
      medications:
        - norepinefrina
        - dobutamina
        - dopamina
        - solucao_salina
        - ringer_lactato
        - albumina

    - name: 'Anafilaxia'
      medications:
        - epinefrina_im
        - difenidramina
        - metilprednisolona
        - ranitidina
        - salbutamol_inalatorio

    - name: 'Insuficiencia Respiratoria'
      medications:
        - salbutamol
        - ipratropio
        - metilprednisolona
        - aminofilina
        - oxigenio

    - name: 'Convulsao'
      medications:
        - diazepam
        - midazolam
        - fenitoina
        - fenobarbital

    - name: 'Sedacao de Emergencia'
      medications:
        - midazolam
        - propofol
        - fentanil
        - succinilcolina
        - rocuronio

    - name: 'Dor Intensa'
      medications:
        - morfina
        - fentanil
        - dipirona_iv
        - tramadol

    - name: 'Antidotos'
      medications:
        - naloxona
        - flumazenil
        - n_acetilcisteina
        - atropina
        - pralidoxima
```

---

## 6. Notificacoes Automaticas

### 6.1 Notificacoes na Ativacao

Ao ativar break-glass, o sistema envia notificacoes imediatas para:

| Destinatario           | Canal              | Conteudo                                    | SLA      |
| ---------------------- | ------------------ | ------------------------------------------- | -------- |
| Security Officer       | Push + Email + SMS | Quem, quando, paciente, justificativa       | Imediato |
| Compliance Auditor     | Push + Email       | Quem, quando, paciente, justificativa       | Imediato |
| Clinical Director      | Push + Email       | Quem, quando, paciente, justificativa, tipo | Imediato |
| Unit Manager (plantao) | Push               | Quem, quando, paciente                      | Imediato |
| DPO                    | Email              | Resumo do evento (para Classe E)            | Ate 1h   |

### 6.2 Notificacoes Durante o Break-Glass

| Evento                  | Destinatarios                 | Canal         |
| ----------------------- | ----------------------------- | ------------- |
| 30 min antes de expirar | Profissional que ativou       | Push in-app   |
| 10 min antes de expirar | Profissional que ativou       | Push + banner |
| Renovacao solicitada    | Clinical Director, Compliance | Push + Email  |
| Acesso a Classe E       | Security Officer, DPO         | Push + Email  |
| Cada acesso a registro  | Log (sem notificacao push)    | Audit log     |

### 6.3 Notificacoes Apos Encerramento

| Evento                   | Destinatarios                 | Canal          |
| ------------------------ | ----------------------------- | -------------- |
| Break-glass encerrado    | Todos os notificados          | Email          |
| Revisao necessaria (24h) | Clinical Director, Compliance | Email + Task   |
| Revisao atrasada (> 24h) | Hospital Owner, DPO           | Email + Alerta |
| Revisao concluida        | Todos os notificados          | Email          |
| Abuso detectado          | Security Officer, DPO, RH     | Email + Alerta |

### 6.4 Implementacao das Notificacoes

```typescript
interface BreakGlassNotification {
  eventType: BreakGlassEventType;
  breakGlassSessionId: string;
  timestamp: string;
  targets: NotificationTarget[];
  content: NotificationContent;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

type BreakGlassEventType =
  | 'activated'
  | 'renewed'
  | 'class_e_accessed'
  | 'expiring_soon'
  | 'expired'
  | 'manually_revoked'
  | 'review_required'
  | 'review_overdue'
  | 'review_completed'
  | 'abuse_detected';

async function sendBreakGlassNotifications(
  session: BreakGlassSession,
  eventType: BreakGlassEventType,
): Promise<void> {
  const notificationConfig = breakGlassNotificationMatrix[eventType];

  for (const targetConfig of notificationConfig.targets) {
    const users = await resolveNotificationTargets(targetConfig);

    for (const user of users) {
      for (const channel of targetConfig.channels) {
        await notificationService.send({
          channel,
          recipient: user,
          template: `break_glass_${eventType}`,
          data: {
            professionalName: session.userName,
            professionalRole: session.activeRole,
            professionalCouncil: session.councilNumber,
            patientName: await getPatientName(session.patientId),
            patientId: session.patientId,
            justification: session.justification,
            emergencyType: session.emergencyType,
            activatedAt: session.activatedAt,
            expiresAt: session.expiresAt,
            maxDataClass: session.maxDataClass,
            dataClassesAccessed: session.dataClassesAccessed,
            recordsAccessed: session.recordsAccessed.length,
          },
          priority: notificationConfig.priority,
        });
      }
    }
  }
}
```

---

## 7. Revisao Pos-Evento

### 7.1 Processo de Revisao

```
BREAK-GLASS ENCERRADO
        |
        v
+---------------------+
| Task de revisao     |
| criada              |
| automaticamente     |
| SLA: 24h            |
+---------------------+
        |
        v
+---------------------+
| REVISAO PRIMARIA    |
| Por: clinical_dir   |
|                      |
| Avaliar:            |
| - Justificativa     |
|   plausivel?        |
| - Emergencia tipo   |
|   compativel?       |
| - Dados acessados   |
|   proporcionais?    |
| - Acoes executadas  |
|   coerentes?        |
+---------------------+
        |
   +----+----+
   |         |
ADEQUADO  INADEQUADO
   |         |
   v         v
+----------+ +---------------------+
| REVISAO  | | INVESTIGACAO        |
| SECUNDARIA| | APROFUNDADA        |
| Por:     | |                      |
| compliance| | Compliance +       |
| auditor  | | Security +          |
|          | | RH                  |
| Confirma | +---------------------+
| ou       |         |
| escala   |    +----+----+
+----------+    |         |
   |         ABUSO     USO INDEVIDO
   v         CONFIRMADO NAO-DOLOSO
ENCERRADO      |         |
(uso correto)  v         v
            +--------+ +--------+
            | Sancao | | Acao   |
            | Disci- | | Educa- |
            | plinar | | tiva   |
            +--------+ +--------+
```

### 7.2 Criterios de Revisao

```yaml
review_criteria:
  plausibility_check:
    - question: 'A justificativa e clinicamente plausivel?'
      examples_adequate:
        - 'Paciente em PCR na UTI, sem medico assistente presente'
        - 'Transferencia de emergencia, medico receptor precisa do historico'
        - 'Enfermeira identificou reacao alergica grave, precisa ver alergias e medicamentos'
      examples_inadequate:
        - 'Queria ver o prontuario'
        - 'Paciente de colega, curiosidade'
        - 'Pesquisa academica'

  proportionality_check:
    - question: 'Os dados acessados foram proporcionais a emergencia?'
      adequate: 'Acessou sinais vitais, medicamentos e alergias durante PCR'
      inadequate: 'Acessou historico de psicoterapia durante tratamento de fratura'

  temporal_check:
    - question: 'O acesso ocorreu em horario compativel com emergencia?'
      adequate: 'Break-glass ativado durante plantao, paciente recem-admitido'
      inadequate: 'Break-glass ativado as 3h da manha para paciente estavel'

  pattern_check:
    - question: 'O profissional tem padrao de uso de break-glass?'
      alert_threshold: 'Mais de 2 ativacoes em 30 dias'
      investigation_threshold: 'Mais de 5 ativacoes em 90 dias'
```

### 7.3 Formulario de Revisao

```typescript
interface BreakGlassReview {
  reviewId: string;
  breakGlassSessionId: string;
  reviewedAt: string;

  // Revisao primaria (clinical_director)
  primaryReview: {
    reviewerId: string;
    reviewerRole: 'clinical_director';
    justificationAdequate: boolean;
    emergencyTypeAppropriate: boolean;
    accessProportional: boolean;
    actionsCoherent: boolean;
    verdict: 'adequate' | 'needs_investigation' | 'abuse_suspected';
    comments: string;
    reviewedAt: string;
  };

  // Revisao secundaria (compliance_auditor)
  secondaryReview: {
    reviewerId: string;
    reviewerRole: 'compliance_auditor';
    lgpdCompliant: boolean;
    auditTrailComplete: boolean;
    notificationsVerified: boolean;
    verdict: 'confirmed_adequate' | 'confirmed_abuse' | 'non_malicious_misuse';
    recommendedAction: 'none' | 'training' | 'warning' | 'suspension' | 'dismissal';
    comments: string;
    reviewedAt: string;
  };

  // Status final
  finalStatus: 'approved' | 'flagged' | 'abuse_confirmed';
  finalAction?: string;
}
```

---

## 8. Deteccao de Abuso

### 8.1 Indicadores de Uso Indevido

```yaml
abuse_detection:
  frequency_monitoring:
    rules:
      - name: 'Frequencia alta por profissional'
        condition: 'count(break_glass, user, 30d) > 2'
        action: alert_compliance
        severity: warning

      - name: 'Frequencia muito alta por profissional'
        condition: 'count(break_glass, user, 90d) > 5'
        action: alert_compliance_and_clinical_director
        severity: critical

      - name: 'Frequencia alta por unidade'
        condition: 'count(break_glass, unit, 7d) > 5'
        action: alert_security_officer
        severity: warning

  pattern_analysis:
    rules:
      - name: 'Break-glass para mesmo paciente por profissionais diferentes'
        condition: 'count(distinct users with break_glass for patient X, 24h) > 2'
        action: investigate
        severity: high

      - name: 'Break-glass fora do horario de trabalho'
        condition: "break_glass.activated AND user.shift == 'none'"
        action: alert_immediate
        severity: critical

      - name: 'Break-glass para paciente de famoso/VIP'
        condition: 'break_glass.patient.vip_flag == true'
        action: alert_immediate
        severity: critical

      - name: 'Break-glass seguido de acesso a dados nao relacionados a emergencia'
        condition: 'break_glass.accessed_fields contains fields NOT in emergency_relevant_fields'
        action: flag_for_review
        severity: high

      - name: 'Break-glass sem registro de emergencia no setor'
        condition: 'break_glass.activated AND NOT exists(emergency_event, unit, timewindow=1h)'
        action: flag_for_review
        severity: high

  behavioral_anomalies:
    rules:
      - name: 'Tempo excessivo de acesso'
        condition: 'break_glass.duration > 0.8 * max_duration AND records_accessed < 3'
        action: flag_for_review
        note: 'Profissional ficou com acesso mas nao usou - snooping?'

      - name: 'Acesso a muitos registros em pouco tempo'
        condition: 'break_glass.records_accessed > 20 AND break_glass.duration < 30m'
        action: alert_immediate
        note: 'Possivel scraping de dados'

      - name: 'Break-glass recorrente para pacientes do mesmo perfil'
        condition: 'break_glass.patients.filter(same_profile) > 3 in 30d'
        action: investigate
        note: 'Possivel targeting de perfil especifico'
```

### 8.2 Score de Risco por Evento

```typescript
interface BreakGlassRiskScore {
  sessionId: string;
  totalScore: number; // 0-100
  factors: RiskFactor[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface RiskFactor {
  name: string;
  score: number; // Contribuicao ao score total
  description: string;
}

function calculateBreakGlassRiskScore(session: BreakGlassSession): BreakGlassRiskScore {
  const factors: RiskFactor[] = [];

  // Fator: Classe de dados acessada
  if (session.maxDataClassAccessed === 'E') {
    factors.push({ name: 'class_e_access', score: 25, description: 'Acesso a dados Classe E' });
  } else if (session.maxDataClassAccessed === 'D') {
    factors.push({ name: 'class_d_access', score: 15, description: 'Acesso a dados Classe D' });
  }

  // Fator: Historico de break-glass do profissional
  const recentBreakGlassCount = session.userBreakGlassHistory.last90Days;
  if (recentBreakGlassCount > 3) {
    factors.push({
      name: 'frequent_user',
      score: 20,
      description: `${recentBreakGlassCount} break-glass nos ultimos 90 dias`,
    });
  }

  // Fator: Horario atipico
  const hour = new Date(session.activatedAt).getHours();
  if (hour >= 0 && hour < 6) {
    factors.push({ name: 'off_hours', score: 10, description: 'Ativado entre 00h-06h' });
  }

  // Fator: Paciente VIP/famoso
  if (session.patientFlags?.includes('vip')) {
    factors.push({ name: 'vip_patient', score: 20, description: 'Paciente com flag VIP' });
  }

  // Fator: Quantidade de registros acessados
  if (session.recordsAccessed.length > 15) {
    factors.push({
      name: 'many_records',
      score: 15,
      description: `${session.recordsAccessed.length} registros acessados`,
    });
  }

  // Fator: Sem evento de emergencia correlacionado
  if (!session.correlatedEmergencyEvent) {
    factors.push({
      name: 'no_correlated_emergency',
      score: 15,
      description: 'Sem evento de emergencia registrado no setor',
    });
  }

  // Fator: Duracao vs atividade
  const durationHours = (session.endedAt - session.activatedAt) / 3600000;
  const accessRate = session.recordsAccessed.length / durationHours;
  if (accessRate < 1 && durationHours > 1) {
    factors.push({
      name: 'low_activity',
      score: 10,
      description: 'Baixa atividade durante periodo de break-glass',
    });
  }

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const riskLevel =
    totalScore >= 60 ? 'critical' : totalScore >= 40 ? 'high' : totalScore >= 20 ? 'medium' : 'low';

  return { sessionId: session.id, totalScore, factors, riskLevel };
}
```

---

## 9. Interface do Usuario (UI)

### 9.1 Indicadores Visuais Durante Break-Glass

```
+------------------------------------------------------------------+
| !! ACESSO DE EMERGENCIA (BREAK-GLASS) ATIVO !!                  |
| Paciente: Joao da Silva | Expira em: 01:47:23                    |
| Todos os acessos estao sendo auditados em tempo real             |
| [Encerrar Break-Glass]                                            |
+==================================================================+
|                                                                    |
|  BORDA VERMELHA EM TODA A INTERFACE                               |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  |                    PRONTUARIO DO PACIENTE                     | |
|  |  Nome: Joao da Silva                                         | |
|  |  Leito: UTI-05                                                | |
|  |  ...                                                          | |
|  |                                                                | |
|  |  [!] Este acesso esta sendo registrado via break-glass        | |
|  |  [!] Justificativa: "PCR na UTI, medico assistente ausente"  | |
|  |  [!] Revisao obrigatoria sera realizada em ate 24h            | |
|  +--------------------------------------------------------------+ |
|                                                                    |
+------------------------------------------------------------------+
```

### 9.2 Elementos Visuais Obrigatorios

| Elemento                   | Descricao                                          | Implementacao                             |
| -------------------------- | -------------------------------------------------- | ----------------------------------------- |
| Borda vermelha             | Borda de 4px vermelha em todo o viewport           | `border: 4px solid #DC2626`               |
| Banner superior            | Banner fixo no topo com informacoes do break-glass | `position: fixed; top: 0`                 |
| Timer regressivo           | Contagem regressiva ate expiracao                  | Atualiza a cada segundo                   |
| Watermark                  | "BREAK-GLASS" em marca d'agua em todos os dados    | `opacity: 0.1; transform: rotate(-45deg)` |
| Botao de encerramento      | Botao para encerrar break-glass antecipadamente    | Sempre visivel no banner                  |
| Indicador em cada registro | Badge "[BG]" ao lado de cada dado acessado         | Badge vermelho                            |
| Bloqueio de export/print   | Botoes de export e print desabilitados com tooltip | `disabled` com explicacao                 |

### 9.3 Componente React de Break-Glass

```typescript
interface BreakGlassBannerProps {
  session: BreakGlassSession;
  onTerminate: () => void;
}

// Pseudocodigo do componente
function BreakGlassBanner({ session, onTerminate }: BreakGlassBannerProps) {
  const timeRemaining = useCountdown(session.expiresAt);
  const isExpiringSoon = timeRemaining.totalSeconds < 600; // < 10 min

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      backgroundColor: isExpiringSoon ? '#991B1B' : '#DC2626',
      color: 'white',
      padding: '12px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontWeight: 'bold',
    }}>
      <div>
        <AlertIcon /> ACESSO DE EMERGENCIA (BREAK-GLASS) ATIVO
      </div>
      <div>
        Paciente: {session.patientName} |
        Expira em: {timeRemaining.formatted} |
        Classe max: {session.maxDataClass}
      </div>
      <div>
        Todos os acessos auditados em tempo real
      </div>
      <button onClick={onTerminate} style={{
        backgroundColor: 'white',
        color: '#DC2626',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '4px',
        fontWeight: 'bold',
        cursor: 'pointer',
      }}>
        Encerrar Break-Glass
      </button>
    </div>
  );
}
```

---

## 10. Middleware de Break-Glass

### 10.1 Middleware Express/Fastify

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';

interface BreakGlassSession {
  id: string;
  userId: string;
  patientId: string;
  activeRole: string;
  activatedAt: Date;
  expiresAt: Date;
  maxDataClass: DataClass;
  justification: string;
  emergencyType: EmergencyType;
  status: 'active' | 'expired' | 'revoked' | 'terminated';
  recordsAccessed: AuditRecord[];
  renewalCount: number;
}

async function breakGlassMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = request.user.id;
  const patientId = extractPatientId(request);

  if (!patientId) return; // Nao e acesso a dados de paciente

  // Verificar se ha sessao de break-glass ativa
  const bgSession = await breakGlassStore.getActiveSession(userId, patientId);

  if (!bgSession) return; // Nao ha break-glass ativo - fluxo normal

  // Validar que a sessao nao expirou
  if (new Date() > bgSession.expiresAt) {
    await breakGlassStore.expireSession(bgSession.id);
    reply.status(403).send({
      error: 'BREAK_GLASS_EXPIRED',
      message: 'Sessao de acesso de emergencia expirada.',
      expiredAt: bgSession.expiresAt.toISOString(),
    });
    return;
  }

  // Validar classe de dados
  const requestedDataClass = extractDataClass(request);
  if (requestedDataClass && !isDataClassAllowed(requestedDataClass, bgSession)) {
    reply.status(403).send({
      error: 'BREAK_GLASS_CLASS_EXCEEDED',
      message: `Break-glass nao cobre dados de Classe ${requestedDataClass}.`,
    });
    return;
  }

  // Validar acoes proibidas durante break-glass
  const action = extractAction(request);
  const prohibitedActions = ['delete', 'export', 'print', 'modify_access_policy'];
  if (prohibitedActions.includes(action)) {
    reply.status(403).send({
      error: 'BREAK_GLASS_ACTION_PROHIBITED',
      message: `Acao '${action}' nao e permitida durante break-glass.`,
    });
    return;
  }

  // Registrar acesso em auditoria (ANTES de processar)
  const auditRecord: BreakGlassAuditRecord = {
    id: generateUuidV7(),
    breakGlassSessionId: bgSession.id,
    timestamp: new Date().toISOString(),
    userId,
    patientId,
    action,
    resource: request.url,
    method: request.method,
    dataClass: requestedDataClass,
    fieldsRequested: extractRequestedFields(request),
    sourceIp: request.ip,
    userAgent: request.headers['user-agent'],
  };

  await auditService.logBreakGlassAccess(auditRecord);

  // Adicionar headers de break-glass na resposta
  reply.header('X-Break-Glass-Session', bgSession.id);
  reply.header('X-Break-Glass-Expires', bgSession.expiresAt.toISOString());
  reply.header('X-Break-Glass-Audit', 'true');

  // Decorar request para que handlers saibam que e break-glass
  request.breakGlassSession = bgSession;
}

// Middleware de ativacao de break-glass
async function activateBreakGlass(
  request: FastifyRequest<{ Body: BreakGlassActivationForm }>,
  reply: FastifyReply,
): Promise<void> {
  const form = request.body;

  // 1. Verificar elegibilidade do role
  const role = await roleStore.getRole(form.activeRole);
  if (!role.metadata.breakGlassEligible) {
    reply.status(403).send({
      error: 'BREAK_GLASS_NOT_ELIGIBLE',
      message: `O role '${form.activeRole}' nao e elegivel para break-glass.`,
    });
    return;
  }

  // 2. Verificar credencial do conselho
  const credentialValid = await credentialService.verify(
    form.userId,
    role.metadata.credentialRequired!,
  );
  if (!credentialValid) {
    reply.status(403).send({
      error: 'CREDENTIAL_INVALID',
      message: 'Registro no conselho profissional invalido ou suspenso.',
    });
    return;
  }

  // 3. Verificar MFA
  const mfaValid = await mfaService.verify(form.userId, form.mfaToken);
  if (!mfaValid) {
    reply.status(401).send({ error: 'MFA_FAILED' });
    return;
  }

  // 4. Verificar justificativa
  if (!form.justification || form.justification.length < 20) {
    reply.status(400).send({
      error: 'JUSTIFICATION_REQUIRED',
      message: 'Justificativa deve ter no minimo 20 caracteres.',
    });
    return;
  }

  // 5. Verificar reconhecimento
  if (!form.acknowledgment) {
    reply.status(400).send({
      error: 'ACKNOWLEDGMENT_REQUIRED',
      message: 'Voce deve reconhecer que o acesso sera auditado.',
    });
    return;
  }

  // 6. Verificar localizacao
  const isHospitalNetwork = await networkService.isHospitalNetwork(request.ip);
  if (!isHospitalNetwork) {
    reply.status(403).send({
      error: 'LOCATION_REQUIRED',
      message: 'Break-glass so pode ser ativado na rede do hospital.',
    });
    return;
  }

  // 7. Verificar se ja existe sessao ativa para este paciente
  const existingSession = await breakGlassStore.getActiveSession(form.userId, form.patientId);
  if (existingSession) {
    reply.status(409).send({
      error: 'BREAK_GLASS_ALREADY_ACTIVE',
      sessionId: existingSession.id,
      expiresAt: existingSession.expiresAt,
    });
    return;
  }

  // 8. Criar sessao de break-glass
  const maxDuration = getMaxDurationForRole(role);
  const session: BreakGlassSession = {
    id: generateUuidV7(),
    userId: form.userId,
    patientId: form.patientId,
    activeRole: form.activeRole,
    activatedAt: new Date(),
    expiresAt: addDuration(new Date(), maxDuration),
    maxDataClass: getMaxDataClassForRole(role),
    justification: form.justification,
    emergencyType: form.emergencyType,
    status: 'active',
    recordsAccessed: [],
    renewalCount: 0,
  };

  await breakGlassStore.createSession(session);

  // 9. Criar relacao temporaria de break-glass (ReBAC)
  await relationshipStore.createRelationship({
    type: 'break_glass_emergency',
    subjectUserId: form.userId,
    objectPatientId: form.patientId,
    status: 'active',
    expiresAt: session.expiresAt,
    metadata: {
      sourceSystem: 'break_glass',
      breakGlassSessionId: session.id,
    },
  });

  // 10. Enviar notificacoes
  await sendBreakGlassNotifications(session, 'activated');

  // 11. Log de auditoria da ativacao
  await auditService.logBreakGlassActivation({
    sessionId: session.id,
    userId: form.userId,
    patientId: form.patientId,
    justification: form.justification,
    emergencyType: form.emergencyType,
    activatedAt: session.activatedAt,
    expiresAt: session.expiresAt,
    sourceIp: request.ip,
    deviceFingerprint: form.deviceFingerprint,
  });

  reply.status(201).send({
    sessionId: session.id,
    expiresAt: session.expiresAt,
    maxDataClass: session.maxDataClass,
    message: 'Break-glass ativado. Todos os acessos serao auditados.',
  });
}
```

---

## 11. Schema de Eventos de Auditoria

### 11.1 Evento de Ativacao

```typescript
interface BreakGlassActivationAuditEvent {
  eventType: 'BREAK_GLASS_ACTIVATED';
  eventId: string; // UUID v7
  timestamp: string; // ISO 8601
  correlationId: string;

  // Sessao
  breakGlassSessionId: string;

  // Profissional
  userId: string;
  userName: string;
  activeRole: string;
  councilType: string; // CRM, COREN
  councilNumber: string;
  councilState: string; // UF

  // Paciente
  patientId: string;
  patientUnit: string;
  patientBed: string;

  // Justificativa
  justification: string;
  emergencyType: EmergencyType;
  acknowledgmentGiven: boolean;

  // Contexto
  sourceIp: string;
  deviceFingerprint: string;
  location: GeoLocation;
  networkType: 'hospital_wired' | 'hospital_wifi' | 'vpn';

  // Parametros
  maxDataClass: DataClass;
  expiresAt: string;

  // Integridade
  previousEventHash: string;
  eventHash: string;
  signature: string; // Assinatura digital do servico
}
```

### 11.2 Evento de Acesso Durante Break-Glass

```typescript
interface BreakGlassAccessAuditEvent {
  eventType: 'BREAK_GLASS_ACCESS';
  eventId: string;
  timestamp: string;
  correlationId: string;

  // Referencia ao break-glass
  breakGlassSessionId: string;
  timeElapsedSinceActivation: number; // milissegundos

  // Profissional
  userId: string;
  activeRole: string;

  // Acesso
  action: Action;
  resource: string;
  resourceId: string;
  patientId: string;
  dataClass: DataClass;
  fieldsAccessed: string[];
  fieldsMasked: string[];
  fieldsRedacted: string[];

  // Resultado
  decision: 'ALLOW' | 'DENY';
  denyReason?: string;

  // Integridade
  previousEventHash: string;
  eventHash: string;
  signature: string;
}
```

### 11.3 Evento de Encerramento

```typescript
interface BreakGlassTerminationAuditEvent {
  eventType: 'BREAK_GLASS_TERMINATED';
  eventId: string;
  timestamp: string;
  correlationId: string;

  // Sessao
  breakGlassSessionId: string;
  terminationReason: 'expired' | 'manual_termination' | 'admin_revocation' | 'session_timeout';

  // Estatisticas da sessao
  totalDuration: number; // milissegundos
  totalRecordsAccessed: number;
  dataClassesAccessed: DataClass[];
  actionsPerformed: ActionSummary[];
  uniqueFieldsAccessed: number;

  // Score de risco calculado
  riskScore: BreakGlassRiskScore;

  // Revisao pendente
  reviewRequired: boolean;
  reviewDeadline: string;
  reviewAssignedTo: string[];

  // Integridade
  previousEventHash: string;
  eventHash: string;
  signature: string;
}
```

### 11.4 Evento de Revisao

```typescript
interface BreakGlassReviewAuditEvent {
  eventType: 'BREAK_GLASS_REVIEWED';
  eventId: string;
  timestamp: string;

  breakGlassSessionId: string;
  reviewId: string;

  // Revisao
  reviewerUserId: string;
  reviewerRole: string;
  reviewType: 'primary' | 'secondary';
  verdict:
    | 'adequate'
    | 'needs_investigation'
    | 'abuse_suspected'
    | 'confirmed_adequate'
    | 'confirmed_abuse'
    | 'non_malicious_misuse';
  recommendedAction?: string;
  comments: string;

  // Timing
  reviewedWithinSla: boolean;
  slaTarget: string; // Ex: "24h"
  actualReviewTime: string; // Tempo entre encerramento e revisao

  // Integridade
  previousEventHash: string;
  eventHash: string;
  signature: string;
}
```

---

## 12. Metricas e Relatorios

### 12.1 KPIs de Break-Glass

```yaml
break_glass_kpis:
  operational:
    - name: 'Total de ativacoes por mes'
      target: '< 10 por 100 leitos'
      alert: '> 15 por 100 leitos'

    - name: 'Tempo medio de sessao'
      target: '< 60 minutos'
      alert: '> 120 minutos'

    - name: 'Taxa de renovacao'
      target: '< 10% das ativacoes'
      alert: '> 20% das ativacoes'

  compliance:
    - name: 'Revisoes dentro do SLA (24h)'
      target: '> 95%'
      alert: '< 90%'

    - name: 'Taxa de abuso confirmado'
      target: '0%'
      alert: '> 0%'

    - name: 'Profissionais com > 3 ativacoes em 90d'
      target: '0'
      alert: '> 0'

  security:
    - name: 'Break-glass para pacientes VIP'
      target: 'Todos revisados em < 4h'
      alert: 'Qualquer nao revisado em 4h'

    - name: 'Break-glass com acesso a Classe E'
      target: '< 5% do total'
      alert: '> 10% do total'

    - name: 'Score de risco medio'
      target: '< 20'
      alert: '> 40'
```

### 12.2 Relatorio Mensal de Break-Glass

```yaml
monthly_report:
  sections:
    - title: 'Resumo Executivo'
      content:
        - total_activations
        - comparison_with_previous_month
        - comparison_with_benchmark

    - title: 'Distribuicao por Role'
      content:
        - table: role vs count vs avg_duration

    - title: 'Distribuicao por Tipo de Emergencia'
      content:
        - chart: emergency_type vs count

    - title: 'Distribuicao por Classe de Dados'
      content:
        - chart: data_class vs count

    - title: 'Distribuicao por Unidade'
      content:
        - table: unit vs count vs avg_risk_score

    - title: 'Revisoes e Conformidade'
      content:
        - reviews_within_sla_percentage
        - reviews_overdue
        - abuse_cases

    - title: 'Profissionais com Alta Frequencia'
      content:
        - list: professionals with > 2 activations

    - title: 'Eventos de Alto Risco'
      content:
        - list: sessions with risk_score > 40

    - title: 'Recomendacoes'
      content:
        - identified_improvement_areas
        - training_recommendations
        - policy_adjustment_suggestions

  distribution:
    - clinical_director
    - compliance_auditor
    - security_officer
    - hospital_owner_executive
    - dpo
```

---

## 13. Treinamento e Conscientizacao

### 13.1 Programa de Treinamento Obrigatorio

| Publico                | Frequencia | Conteudo                                         | Duracao |
| ---------------------- | ---------- | ------------------------------------------------ | ------- |
| Medicos (todos)        | Anual      | Politica de break-glass, cenarios, consequencias | 2h      |
| Enfermeiros (todos)    | Anual      | Politica de break-glass, cenarios, consequencias | 2h      |
| Novos profissionais    | Admissao   | Modulo de onboarding sobre break-glass           | 1h      |
| Gestores de unidade    | Semestral  | Revisao de break-glass, indicadores, melhoria    | 1h      |
| Compliance / Auditoria | Trimestral | Processo de revisao, deteccao de abuso           | 2h      |

### 13.2 Simulacro de Break-Glass

```yaml
break_glass_drill:
  frequency: semestral
  participants: todos os roles elegiveis
  scenario_types:
    - pcr_sem_medico_assistente
    - transferencia_emergencia_interunidade
    - reacao_alergica_grave_paciente_novo
    - trauma_multiplo_admissao_ps
  evaluation:
    - tempo_de_ativacao
    - correta_justificativa
    - proporcionalidade_dos_acessos
    - encerramento_adequado
  results:
    documentation: obrigatoria
    feedback: individual_e_coletivo
    improvement_plan: quando_necessario
```

---

## 14. Revisao da Politica

| Atividade                           | Frequencia  | Responsavel                   |
| ----------------------------------- | ----------- | ----------------------------- |
| Revisao completa da politica        | Anual       | Comite de Seguranca + Clinica |
| Analise de metricas de break-glass  | Mensal      | Compliance                    |
| Revisao por incidente/abuso         | Sob demanda | Comite de Etica + Seguranca   |
| Atualizacao por mudanca regulatoria | Sob demanda | Juridico + Compliance         |
| Teste de resiliencia do mecanismo   | Semestral   | Engenharia + Seguranca        |
| Validacao com corpo clinico         | Anual       | Diretoria Clinica             |

---

_Documento mantido pela equipe de Arquitetura de Seguranca - Velya Platform._
_Proxima revisao programada: 2026-10-08._
