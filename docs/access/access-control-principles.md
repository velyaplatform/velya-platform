# Principios de Controle de Acesso - Velya Platform

> Versao: 1.0 | Ultima atualizacao: 2026-04-08
> Classificacao: Documento Interno - Arquitetura de Seguranca

---

## 1. Visao Geral

O sistema de controle de acesso da Velya Platform e projetado para ambientes hospitalares
brasileiros, onde a protecao de dados de saude e regida pela LGPD (Lei 13.709/2018),
pelo Codigo de Etica Medica, e por regulamentacoes dos conselhos profissionais (CFM, COFEN).

Este documento define os principios fundamentais que orientam todas as decisoes de
autorizacao no sistema. Nenhuma funcionalidade de acesso pode ser implementada sem
aderencia estrita a estes principios.

---

## 2. Principios Fundamentais

### 2.1 Negacao por Padrao (Deny by Default)

**Definicao:** Todo acesso e negado a menos que uma regra explicita o permita.
Nenhum usuario, independentemente de cargo ou hierarquia, possui acesso implicito
a qualquer recurso do sistema.

**Fundamento Legal:**
- LGPD Art. 46: Agentes de tratamento devem adotar medidas de seguranca para
  proteger dados pessoais de acessos nao autorizados.
- LGPD Art. 6o, VII: Principio da seguranca - utilizacao de medidas tecnicas e
  administrativas aptas a proteger os dados pessoais.

**Implementacao no Sistema:**
- Middlewares de autorizacao retornam `403 Forbidden` como resposta padrao.
- Politicas de acesso sao aditivas: cada regra concede permissao, nunca remove.
- Ausencia de politica aplicavel = acesso negado.

```typescript
// Comportamento padrao do authorization middleware
async function authorize(request: AuthRequest): Promise<AuthDecision> {
  const policies = await policyEngine.evaluate(request);

  if (policies.length === 0) {
    return {
      decision: 'DENY',
      reason: 'NO_APPLICABLE_POLICY',
      audit: true,
    };
  }

  // Somente concede se ao menos uma politica permitir
  // e nenhuma politica negar explicitamente
  const hasExplicitDeny = policies.some(p => p.effect === 'DENY');
  const hasAllow = policies.some(p => p.effect === 'ALLOW');

  if (hasExplicitDeny) {
    return { decision: 'DENY', reason: 'EXPLICIT_DENY', audit: true };
  }

  if (!hasAllow) {
    return { decision: 'DENY', reason: 'NO_ALLOW_POLICY', audit: true };
  }

  return { decision: 'ALLOW', policies: policies.filter(p => p.effect === 'ALLOW') };
}
```

### 2.2 Privilegio Minimo (Least Privilege)

**Definicao:** Cada usuario recebe apenas as permissoes estritamente necessarias
para executar suas funcoes profissionais. Nenhum acesso adicional e concedido
"por conveniencia" ou "para o futuro".

**Fundamento Legal:**
- LGPD Art. 6o, III: Principio da necessidade - limitacao do tratamento ao minimo
  necessario para a realizacao de suas finalidades.
- Lei 12.842/2013 (Ato Medico), Art. 4o: Define atos privativos do medico, limitando
  o escopo de acesso de outros profissionais.
- Lei 7.498/1986, Art. 11-15: Define escopo de atuacao de cada nivel de enfermagem.

**Implementacao no Sistema:**
- Roles sao granulares: `medical_staff_attending` vs `medical_staff_on_call`
- Permissoes sao contextuais: um medico so acessa prontuarios de pacientes sob
  seus cuidados (ReBAC).
- Elevacao temporaria via step-up authentication para acoes de alto risco.

### 2.3 Necessidade de Conhecimento (Need-to-Know)

**Definicao:** O acesso a informacoes e restrito aos profissionais que precisam
delas para o cuidado direto ao paciente ou para uma funcao administrativa especifica
e documentada.

**Fundamento Legal:**
- LGPD Art. 6o, I: Principio da finalidade - realizacao do tratamento para propositos
  legitimos, especificos, explicitos e informados ao titular.
- Resolucao CFM 1.638/2002: Prontuario medico e documento sigiloso.
- Resolucao CFM 2.217/2018 (Codigo de Etica Medica), Art. 73-79: Sigilo profissional.

**Implementacao no Sistema:**
- ReBAC (Relationship-Based Access Control): acesso condicionado a existencia de
  relacao profissional-paciente ativa.
- Tipos de relacao: medico_assistente, equipe_enfermagem, equipe_multidisciplinar.
- Relacoes tem ciclo de vida: criacao, vigencia, expiracao, revogacao.

### 2.4 Minimizacao de Dados (Data Minimization)

**Definicao:** Apenas os campos de dados necessarios para a acao sendo executada
sao retornados. Campos irrelevantes sao omitidos ou mascarados.

**Fundamento Legal:**
- LGPD Art. 6o, III: Principio da necessidade.
- LGPD Art. 11, §4o: Dados de saude nao podem ser utilizados com objetivo de
  obter vantagem economica, salvo assistencia farmaceutica e servicos de saude.

**Implementacao no Sistema:**
- Field-level access control: cada campo do prontuario tem classificacao de
  sensibilidade (Classes A-E).
- Projections dinamicas: a API retorna apenas os campos permitidos para o role + contexto.
- Mascaramento progressivo: CPF aparece como `***.***.***-XX` para funcoes administrativas
  que precisam apenas confirmar identidade.

```typescript
interface FieldProjection {
  field: string;
  sensitivityClass: 'A' | 'B' | 'C' | 'D' | 'E';
  masking: 'none' | 'partial' | 'full' | 'hash';
  visibleTo: RoleExpression[];
  contextConditions?: AttributeCondition[];
}

// Exemplo: CPF do paciente
const cpfProjection: FieldProjection = {
  field: 'patient.cpf',
  sensitivityClass: 'B',
  masking: 'partial',  // ***.***.***-XX
  visibleTo: ['receptionist_registration', 'billing_authorization'],
  contextConditions: [
    { attribute: 'action', operator: 'in', value: ['register', 'verify_identity'] }
  ],
};
```

### 2.5 Limitacao de Finalidade (Purpose Limitation)

**Definicao:** Dados acessados para uma finalidade especifica nao podem ser
utilizados para outra finalidade sem autorizacao explicita. Cada acesso e vinculado
a um proposito declarado.

**Fundamento Legal:**
- LGPD Art. 6o, I: Principio da finalidade.
- LGPD Art. 6o, II: Principio da adequacao - compatibilidade do tratamento com
  as finalidades informadas ao titular.
- LGPD Art. 7o, VIII: Tutela da saude como base legal para tratamento de dados.

**Implementacao no Sistema:**
- Cada requisicao de acesso inclui `purpose` declarado.
- O purpose e validado contra as permissoes do role.
- Logs de auditoria registram o purpose junto com a acao executada.
- Analytics sobre patterns de acesso detectam desvio de finalidade.

```yaml
# Exemplo de policy com purpose limitation
policy:
  id: "nurse-vitals-access"
  effect: ALLOW
  subject:
    role: nurse
  resource:
    type: patient_chart
    data_class: C
    fields: [vitals, nursing_notes, medication_schedule]
  action: [read, create]
  conditions:
    purpose:
      - direct_patient_care
      - nursing_assessment
    relationship:
      type: nursing_team_assigned
      status: active
```

---

## 3. Modelo de Autorizacao em 4 Perguntas

Toda decisao de autorizacao no Velya Platform responde a 4 perguntas sequenciais.
A falha em qualquer pergunta resulta em negacao de acesso.

### Pergunta 1: Quem e? (Autenticacao e Identidade)

- Identidade verificada via autenticacao forte (MFA obrigatorio para acesso clinico).
- Sessao valida e nao expirada.
- Dispositivo reconhecido e em conformidade.
- Localizacao dentro do perimetro autorizado.

### Pergunta 2: Qual papel esta ativo? (RBAC)

- Role atribuido ao usuario para o contexto atual.
- Role pode ser diferente por unidade/setor (ex: medico plantonista na UTI,
  medico assistente na enfermaria).
- Hierarquia de roles respeitada.
- Conflitos de role resolvidos (ex: medico que tambem e administrador
  nao pode aprovar seus proprios atos como admin).

### Pergunta 3: Qual a relacao com o paciente? (ReBAC)

- Existe relacao profissional-paciente ativa?
- Tipo de relacao (assistente, plantonista, equipe, consultor)?
- Relacao esta dentro do periodo de vigencia?
- Relacao abrange o tipo de dado sendo solicitado?

### Pergunta 4: Qual acao esta sendo executada? (ABAC)

- A acao e permitida para o role + relacao?
- O contexto atual (horario, local, dispositivo) permite a acao?
- A classificacao de sensibilidade dos dados permite a acao?
- E necessario step-up authentication?
- O proposito declarado e valido?

### Fluxograma de Decisao

```
                         REQUISICAO DE ACESSO
                                |
                                v
                    +-------------------+
                    | 1. AUTENTICACAO   |
                    | Token valido?     |
                    | MFA verificado?   |
                    | Sessao ativa?     |
                    +-------------------+
                           |
                    +------+------+
                    |             |
                   SIM           NAO --> 401 Unauthorized
                    |
                    v
                    +-------------------+
                    | 2. ROLE ATIVO     |
                    | Role atribuido?   |
                    | Role nao expirado?|
                    | Sem conflito?     |
                    +-------------------+
                           |
                    +------+------+
                    |             |
                   SIM           NAO --> 403 Forbidden (NO_ROLE)
                    |
                    v
                    +-------------------+
                    | 3. RELACAO        |
                    | Relacao existe?   |
                    | Relacao ativa?    |
                    | Tipo compativel? |
                    +-------------------+
                           |
                    +------+------+
                    |             |
                   SIM           NAO --> 403 Forbidden (NO_RELATIONSHIP)
                    |                    |
                    |                    +--> Break-glass disponivel?
                    |                         |
                    |                    +----+----+
                    |                    |         |
                    |                   SIM       NAO --> 403 Final
                    |                    |
                    |                    v
                    |               BREAK-GLASS FLOW
                    |               (ver break-glass-policy.md)
                    |
                    v
                    +-------------------+
                    | 4. AVALIACAO ABAC |
                    | Acao permitida?   |
                    | Contexto valido?  |
                    | Sensibilidade OK? |
                    | Purpose valido?   |
                    +-------------------+
                           |
                    +------+------+
                    |             |
                   SIM           NAO --> 403 Forbidden (POLICY_DENIED)
                    |
                    v
               +----------+
               | STEP-UP  |
               | Requer?  |
               +----------+
                    |
               +----+----+
               |         |
              NAO       SIM --> Step-up auth
               |                   |
               |              +----+----+
               |              |         |
               |            PASS       FAIL --> 403 STEP_UP_FAILED
               |              |
               v              v
          200 OK + AUDIT LOG
          (dados filtrados por
           field-level projection)
```

---

## 4. Niveis de Acesso (Access Levels 0-7)

O sistema define 8 niveis de acesso que determinam a profundidade de informacao
a qual um usuario pode chegar. Os niveis sao cumulativos parcialmente - um
nivel superior nao necessariamente inclui todos os dados dos niveis inferiores
(principio de necessidade).

| Nivel | Nome                    | Descricao                                              | Exemplo de Role                    | Dados Acessiveis                | Auditoria   |
|-------|-------------------------|---------------------------------------------------------|------------------------------------|---------------------------------|-------------|
| 0     | Sem Dados de Paciente   | Nenhum acesso a dados de pacientes                      | maintenance, security_guard        | Nenhum dado de paciente         | Padrao      |
| 1     | Operacional Minimo      | Apenas dados operacionais sem identificacao             | cleaning_hygiene, patient_transporter | Numero do leito, status de limpeza, ordem de transporte (sem nome) | Padrao      |
| 2     | Identificacao Basica    | Nome e localizacao do paciente                          | receptionist_registration          | Nome, leito, setor, plano de saude | Padrao      |
| 3     | Administrativo          | Dados cadastrais e de faturamento                       | billing_authorization              | Cadastro completo, convenio, guias, autorizacoes | Elevada     |
| 4     | Clinico Contextual      | Dados clinicos do contexto de cuidado                   | nursing_technician, physiotherapist | Sinais vitais, prescricoes ativas, anotacoes de enfermagem | Elevada     |
| 5     | Clinico Completo        | Prontuario completo (exceto dados restritos)            | medical_staff_attending, nurse      | Evolucoes, resultados, historico, prescricoes | Elevada     |
| 6     | Dados Sensiveis         | Inclui dados com protecao especial                      | clinical_director (com justificativa) | Saude mental, HIV, violencia sexual, dependencia quimica | Maxima      |
| 7     | Break-Glass / Emergencia | Acesso total temporario em situacao de emergencia       | emergency_break_glass_role         | Todos os dados, incluindo sequestrados | Maxima + Alerta |

### Regras dos Niveis

1. **Nivel 0-1:** Nao requerem relacao com paciente (ReBAC nao avaliado).
2. **Nivel 2-3:** Requerem contexto de trabalho (setor, funcao) mas nao relacao direta.
3. **Nivel 4-5:** Requerem relacao profissional-paciente ativa (ReBAC obrigatorio).
4. **Nivel 6:** Requer relacao + justificativa + step-up authentication.
5. **Nivel 7:** Requer ativacao de break-glass com todos os protocolos de emergencia.

### Diagrama de Niveis vs Classes de Dados

```
              Classe A    Classe B    Classe C    Classe D    Classe E
              (Oper.)     (Admin.)    (Clin.Ctx.) (Clin.Sens.)(Restrito)
Nivel 0       ---         ---         ---         ---         ---
Nivel 1       LEITURA     ---         ---         ---         ---
Nivel 2       LEITURA     PARCIAL     ---         ---         ---
Nivel 3       LEITURA     COMPLETO    ---         ---         ---
Nivel 4       LEITURA     PARCIAL     LEITURA     ---         ---
Nivel 5       LEITURA     PARCIAL     COMPLETO    LEITURA     ---
Nivel 6       LEITURA     PARCIAL     COMPLETO    COMPLETO    PARCIAL*
Nivel 7       LEITURA     COMPLETO    COMPLETO    COMPLETO    COMPLETO**

* Nivel 6: Acesso a Classe E com justificativa e step-up
** Nivel 7: Break-glass - temporario, auditado, revisado
```

---

## 5. Diagrama de Arquitetura de Autorizacao

```
+------------------------------------------------------------------+
|                        CLIENTE (Browser/App)                      |
|  [JWT Token + Session ID + Device Fingerprint + Request Context]  |
+------------------------------------------------------------------+
                                |
                                | HTTPS + mTLS
                                v
+------------------------------------------------------------------+
|                         API GATEWAY                               |
|  +--------------------+  +-------------------+  +-------------+  |
|  | Rate Limiter       |  | Token Validator   |  | WAF Rules   |  |
|  +--------------------+  +-------------------+  +-------------+  |
+------------------------------------------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|                    AUTHENTICATION SERVICE                         |
|  +------------------+  +------------------+  +----------------+  |
|  | Identity Verify  |  | MFA Verification |  | Session Mgmt   | |
|  +------------------+  +------------------+  +----------------+  |
|  +------------------+  +------------------+                      |
|  | Device Trust     |  | Location Check   |                      |
|  +------------------+  +------------------+                      |
+------------------------------------------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|                    AUTHORIZATION ENGINE                            |
|                                                                    |
|  +-----------------+                                               |
|  | POLICY DECISION |  <-- Ponto central de decisao                 |
|  | POINT (PDP)     |                                               |
|  +-----------------+                                               |
|         |                                                          |
|         +-----> +------------------+                               |
|         |       | RBAC Evaluator   | --> Role Store                |
|         |       | (Papel Ativo)    |                               |
|         |       +------------------+                               |
|         |                                                          |
|         +-----> +------------------+                               |
|         |       | ReBAC Evaluator  | --> Relationship Graph        |
|         |       | (Relacao Pac.)   |                               |
|         |       +------------------+                               |
|         |                                                          |
|         +-----> +------------------+                               |
|         |       | ABAC Evaluator   | --> Attribute Store           |
|         |       | (Contexto/Attrs) |                               |
|         |       +------------------+                               |
|         |                                                          |
|         +-----> +------------------+                               |
|                 | Break-Glass Eval | --> Emergency Registry         |
|                 | (Emergencia)     |                               |
|                 +------------------+                               |
|                                                                    |
|  +------------------+  +------------------+                        |
|  | Policy Info      |  | Policy Admin     |                        |
|  | Point (PIP)      |  | Point (PAP)      |                        |
|  +------------------+  +------------------+                        |
+------------------------------------------------------------------+
                                |
                      +---------+---------+
                      |                   |
                      v                   v
            +----------------+   +------------------+
            | POLICY         |   | AUDIT SERVICE    |
            | ENFORCEMENT    |   | (Todos os        |
            | POINT (PEP)    |   |  acessos logados)|
            | (Filtra dados, |   +------------------+
            |  aplica mask)  |            |
            +----------------+            v
                      |          +------------------+
                      |          | SIEM / Alertas   |
                      v          | Compliance       |
            +----------------+  +------------------+
            | MICROSERVICO   |
            | DE NEGOCIO     |
            | (Dados filtrados|
            |  e autorizados)|
            +----------------+
```

---

## 6. Principios de Auditoria

Toda decisao de autorizacao gera um registro de auditoria imutavel.

### 6.1 Campos Obrigatorios do Log de Auditoria

```typescript
interface AuditEntry {
  // Identificacao
  auditId: string;           // UUID v7 (ordenavel por tempo)
  timestamp: string;         // ISO 8601 com timezone
  correlationId: string;     // ID da requisicao original

  // Sujeito
  userId: string;
  activeRole: string;
  sessionId: string;
  deviceFingerprint: string;
  sourceIp: string;
  location: GeoLocation;

  // Recurso
  resourceType: string;      // 'patient_chart', 'prescription', etc.
  resourceId: string;
  patientId?: string;
  dataClass: 'A' | 'B' | 'C' | 'D' | 'E';

  // Acao
  action: string;
  purpose: string;
  fieldsAccessed: string[];
  fieldsMasked: string[];

  // Decisao
  decision: 'ALLOW' | 'DENY';
  denyReason?: string;
  appliedPolicies: string[];
  evaluationTimeMs: number;

  // Contexto
  relationshipId?: string;
  relationshipType?: string;
  breakGlass: boolean;
  breakGlassJustification?: string;
  stepUpPerformed: boolean;

  // Integridade
  hash: string;              // SHA-256 da entry anterior + esta
  signature: string;         // Assinatura digital do servico
}
```

### 6.2 Niveis de Auditoria

| Nivel       | Retencao   | Acesso ao Log           | Alerta em Tempo Real | Aplica-se a          |
|-------------|------------|-------------------------|----------------------|----------------------|
| Padrao      | 5 anos     | Compliance, Auditoria   | Nao                  | Nivel 0-1, Classe A  |
| Elevada     | 10 anos    | Compliance, Diretoria   | Anomalias            | Nivel 2-5, Classe B-D |
| Maxima      | 20 anos    | Compliance, DPO, Legal  | Todos os acessos     | Nivel 6-7, Classe E  |

---

## 7. Principios de Consentimento

### 7.1 Bases Legais para Acesso a Dados de Saude

O sistema reconhece as seguintes bases legais conforme LGPD Art. 7o e 11:

| Base Legal                          | Artigo LGPD | Uso no Sistema                              | Requer Consentimento Explicito |
|-------------------------------------|-------------|---------------------------------------------|-------------------------------|
| Tutela da saude                     | Art. 7o, VIII; Art. 11, II, f | Atendimento clinico direto         | Nao                           |
| Obrigacao legal/regulatoria         | Art. 7o, II; Art. 11, II, a | Notificacao compulsoria, ANVISA      | Nao                           |
| Exercicio regular de direitos       | Art. 7o, VI; Art. 11, II, d | Defesa em processos                 | Nao                           |
| Protecao da vida                    | Art. 7o, VII; Art. 11, II, e | Emergencia / Break-glass            | Nao                           |
| Consentimento                       | Art. 7o, I; Art. 11, I | Compartilhamento com terceiros, pesquisa | Sim                           |

### 7.2 Consentimento Granular

```yaml
consent_model:
  types:
    - id: clinical_care
      description: "Acesso para cuidado clinico direto"
      base_legal: tutela_saude
      revocable: false  # Nao pode revogar durante internacao ativa
      auto_granted: true

    - id: teaching_research
      description: "Uso de dados para ensino e pesquisa"
      base_legal: consentimento
      revocable: true
      auto_granted: false
      requires: explicit_written_consent
      anonymization: required

    - id: third_party_share
      description: "Compartilhamento com terceiros (outro hospital, plano)"
      base_legal: consentimento
      revocable: true
      auto_granted: false
      requires: explicit_consent_per_recipient

    - id: family_access
      description: "Acesso por familiares designados"
      base_legal: consentimento
      revocable: true
      auto_granted: false
      requires: patient_designation
```

---

## 8. Principio de Separacao de Deveres (Separation of Duties)

### 8.1 Conflitos de Interesse

O sistema impede que um unico usuario execute acoes que criem conflito de interesse:

| Acao 1                          | Acao 2                          | Conflito                                | Controle                |
|---------------------------------|---------------------------------|-----------------------------------------|-------------------------|
| Prescrever medicamento          | Dispensar medicamento           | Medico nao pode dispensar o que prescreveu | Roles distintos obrigatorios |
| Solicitar exame                 | Laudar exame                    | Solicitante nao pode laudar             | Verificacao de identidade |
| Criar conta de usuario          | Atribuir role clinico           | Segregacao TI vs Diretoria Clinica      | Dual approval           |
| Ativar break-glass              | Revisar proprio break-glass     | Auto-aprovacao proibida                 | Revisor independente    |
| Aprovar alta medica             | Gerar faturamento da internacao | Medico nao influencia faturamento       | Roles distintos         |

### 8.2 Regra dos Quatro Olhos (Four-Eyes Principle)

Para acoes de alto risco, o sistema exige aprovacao de um segundo profissional:

```typescript
interface FourEyesPolicy {
  action: string;
  firstApprover: RoleRequirement;
  secondApprover: RoleRequirement;
  cannotBeSamePerson: true;
  cannotBeSameTeam?: boolean;
  timeLimit: Duration;  // Tempo para segunda aprovacao
}

const highRiskPolicies: FourEyesPolicy[] = [
  {
    action: 'discharge_patient_ama',  // Alta a pedido
    firstApprover: { role: 'medical_staff_attending' },
    secondApprover: { role: 'nurse', minLevel: 'senior' },
    cannotBeSamePerson: true,
    timeLimit: { hours: 2 },
  },
  {
    action: 'access_sequestered_record',
    firstApprover: { role: 'clinical_director' },
    secondApprover: { role: 'compliance_auditor' },
    cannotBeSamePerson: true,
    cannotBeSameTeam: true,
    timeLimit: { hours: 1 },
  },
];
```

---

## 9. Principio de Defesa em Profundidade

A autorizacao nao depende de um unico ponto de controle. Multiplas camadas
validam o acesso:

```
Camada 1: Rede (VPN, segmentacao, firewall)
     |
Camada 2: API Gateway (rate limit, WAF, token)
     |
Camada 3: Autenticacao (identidade, MFA, sessao)
     |
Camada 4: Autorizacao (RBAC + ABAC + ReBAC)
     |
Camada 5: Filtragem de Dados (field-level, masking)
     |
Camada 6: Auditoria (log imutavel, alertas)
     |
Camada 7: Monitoramento (SIEM, anomalias, ML)
```

---

## 10. Principio de Transparencia e Rastreabilidade

### 10.1 Direito do Paciente a Saber

Conforme LGPD Art. 18, o paciente tem direito de saber quem acessou seus dados.

O sistema mantém:
- Registro de todos os acessos ao prontuario do paciente.
- Portal do paciente com historico de acessos (quem, quando, por que).
- Notificacao ao paciente em caso de acesso por break-glass.
- Relatorio de acessos disponivel para o DPO sob demanda.

### 10.2 Rastreabilidade de Decisoes

Cada decisao de autorizacao pode ser reconstruida a partir dos logs:

```
Dado: audit_id = "01914a5c-..."
Reconstruir:
  1. Politicas vigentes no momento da decisao
  2. Atributos do sujeito no momento
  3. Relacoes ativas no momento
  4. Contexto (local, horario, dispositivo)
  5. Resultado e justificativa
```

---

## 11. Revisao e Governanca dos Principios

| Atividade                                    | Frequencia    | Responsavel                |
|----------------------------------------------|---------------|----------------------------|
| Revisao dos principios de acesso             | Semestral     | Comite de Seguranca        |
| Auditoria de aderencia aos principios        | Trimestral    | Compliance / Auditoria     |
| Revisao de roles e permissoes                | Trimestral    | Diretoria Clinica + TI     |
| Teste de penetracao do controle de acesso    | Anual         | Seguranca da Informacao    |
| Treinamento de equipe sobre principios       | Semestral     | RH + Seguranca             |
| Revisao de incidentes de acesso indevido     | Continua      | Security Operations Center |
| Atualizacao por mudanca regulatoria          | Sob demanda   | Juridico + Compliance      |

---

## 12. Glossario

| Termo     | Definicao                                                                         |
|-----------|-----------------------------------------------------------------------------------|
| RBAC      | Role-Based Access Control - controle baseado em papeis                             |
| ABAC      | Attribute-Based Access Control - controle baseado em atributos contextuais         |
| ReBAC     | Relationship-Based Access Control - controle baseado em relacoes                   |
| PDP       | Policy Decision Point - componente que avalia e decide                             |
| PEP       | Policy Enforcement Point - componente que aplica a decisao                         |
| PIP       | Policy Information Point - componente que fornece informacoes para decisao         |
| PAP       | Policy Administration Point - componente de gestao de politicas                    |
| MFA       | Multi-Factor Authentication - autenticacao multifator                              |
| Step-up   | Re-autenticacao para acao de risco elevado                                         |
| Break-glass | Acesso de emergencia que contorna controles normais, com auditoria total         |
| DPO       | Data Protection Officer - Encarregado de Protecao de Dados (LGPD)                 |
| LGPD      | Lei Geral de Protecao de Dados (Lei 13.709/2018)                                  |

---

*Documento mantido pela equipe de Arquitetura de Seguranca - Velya Platform.*
*Proxima revisao programada: 2026-10-08.*
