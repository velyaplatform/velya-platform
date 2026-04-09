# Modelo RBAC + ABAC + ReBAC - Arquitetura de Autorizacao

> Versao: 1.0 | Ultima atualizacao: 2026-04-08
> Classificacao: Documento Interno - Arquitetura de Seguranca

---

## 1. Visao Geral

A Velya Platform implementa um modelo de autorizacao em 3 camadas que combina:

- **RBAC (Role-Based Access Control):** Define O QUE cada papel profissional pode fazer.
- **ABAC (Attribute-Based Access Control):** Avalia SE o contexto permite a acao.
- **ReBAC (Relationship-Based Access Control):** Verifica SE existe relacao entre o profissional e o paciente.

As 3 camadas sao avaliadas sequencialmente. Todas devem retornar `ALLOW` para que
o acesso seja concedido.

```
+------------------------------------------------------------------+
|                    FLUXO DE AUTORIZACAO                           |
|                                                                    |
|  Request --> [RBAC] --> DENY? --> FIM (403)                       |
|                |                                                   |
|              ALLOW                                                 |
|                |                                                   |
|              [ReBAC] --> DENY? --> Break-glass disponivel?         |
|                |                    SIM --> [Break-Glass Flow]     |
|              ALLOW                  NAO --> FIM (403)             |
|                |                                                   |
|              [ABAC] --> DENY? --> FIM (403)                       |
|                |                                                   |
|              ALLOW                                                 |
|                |                                                   |
|              [Field Filter] --> Resposta com dados autorizados    |
+------------------------------------------------------------------+
```

---

## 2. Camada 1: RBAC (Role-Based Access Control)

### 2.1 Conceitos Fundamentais

O RBAC no Velya define a relacao entre usuarios e permissoes atraves de roles.
Um usuario nunca recebe permissoes diretamente - sempre atraves de um role.

```typescript
interface Role {
  id: string;                      // Ex: 'medical_staff_attending'
  displayName: string;             // Ex: 'Medico Assistente'
  description: string;
  accessLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  inheritsFrom?: string[];        // Roles dos quais herda permissoes
  permissions: Permission[];
  constraints: RoleConstraint[];
  metadata: RoleMetadata;
}

interface Permission {
  id: string;                      // Ex: 'prescribe_medication'
  resource: string;                // Ex: 'patient_chart'
  actions: Action[];               // Ex: ['create', 'read']
  dataClasses: DataClass[];        // Ex: ['A', 'B', 'C']
  fields?: string[];               // Campos especificos permitidos
  conditions?: PermissionCondition[];
}

type Action = 'create' | 'read' | 'update' | 'delete' | 'sign' | 'approve' | 'export' | 'print';
type DataClass = 'A' | 'B' | 'C' | 'D' | 'E';

interface RoleConstraint {
  type: 'mutual_exclusion' | 'prerequisite' | 'cardinality' | 'temporal';
  config: Record<string, unknown>;
}

interface RoleMetadata {
  council?: string;                // Ex: 'CRM', 'COREN'
  credentialRequired?: string;     // Ex: 'coren_enfermeiro'
  auditLevel: 'standard' | 'elevated' | 'maximum';
  breakGlassEligible: boolean;
  jit: boolean;
  maxSessionDuration?: Duration;
  requiresMfa: boolean;
}
```

### 2.2 Hierarquia de Roles

O RBAC suporta heranca de permissoes onde roles superiores herdam permissoes
de roles inferiores na mesma cadeia profissional.

```
                    clinical_director
                    /                \
     medical_staff_attending    nurse
            |                    |
     medical_staff_on_call    nursing_technician
                                 |
                           nursing_assistant
```

**Regras de Heranca:**

1. A heranca e restrita a mesma cadeia profissional (enfermagem herda de enfermagem).
2. Heranca nao cruza cadeias (medico nao herda de enfermagem e vice-versa).
3. Permissoes exclusivas (`exclusive_permissions`) nao sao herdadas.
4. O `accessLevel` nao e herdado - cada role tem seu proprio nivel.
5. Heranca e transitiva: se A herda de B e B herda de C, A tambem herda de C.

```typescript
// Configuracao de heranca
const roleHierarchy: Record<string, string[]> = {
  clinical_director: [],                      // Topo - nao herda
  medical_staff_attending: [],                // Cadeia medica independente
  medical_staff_on_call: ['medical_staff_attending'],  // Herda permissoes base do assistente
  nurse: [],                                  // Topo da cadeia de enfermagem
  nursing_technician: [],                     // Nao herda automaticamente de nurse
  nursing_assistant: [],                      // Nao herda automaticamente
};

// Resolucao de permissoes efetivas
function resolveEffectivePermissions(roleId: string): Permission[] {
  const role = roleStore.get(roleId);
  const ownPermissions = role.permissions;

  if (!role.inheritsFrom || role.inheritsFrom.length === 0) {
    return ownPermissions;
  }

  const inheritedPermissions = role.inheritsFrom
    .flatMap(parentId => resolveEffectivePermissions(parentId))
    .filter(p => !p.exclusive);  // Nao herda permissoes exclusivas

  return deduplicatePermissions([...ownPermissions, ...inheritedPermissions]);
}
```

### 2.3 Atribuicao de Roles

```yaml
# Regras de atribuicao de roles
role_assignment:
  rules:
    # 1. Um usuario pode ter multiplos roles (ex: medico + diretor clinico)
    multiple_roles: true

    # 2. Roles mutuamente exclusivos
    mutual_exclusions:
      - [compliance_auditor, clinical_director]    # Auditor nao pode ser o auditado
      - [it_support_jit, security_admin_jit]       # Segregacao de funcao de TI
      - [billing_authorization, medical_staff_attending]  # Segregacao financeira

    # 3. Pre-requisitos para atribuicao
    prerequisites:
      medical_staff_attending:
        credential: crm_ativo
        verification: conselho_profissional_api
      nurse:
        credential: coren_enfermeiro_ativo
        verification: conselho_profissional_api
      nursing_technician:
        credential: coren_tecnico_ativo
        verification: conselho_profissional_api
      clinical_director:
        credential: crm_ativo
        additional: nomeacao_diretoria

    # 4. Ativacao contextual (role ativo depende do contexto)
    contextual_activation:
      medical_staff_on_call:
        condition: "user.current_shift.type == 'on_call' AND user.current_shift.active"
        auto_activate: true
        auto_deactivate: true
      it_support_jit:
        condition: "jit_request.approved AND jit_request.not_expired"
        max_duration: "4h"
        requires_ticket: true
```

### 2.4 RBAC Evaluation Engine

```typescript
interface RbacEvaluationRequest {
  userId: string;
  activeRole: string;
  action: Action;
  resource: string;
  dataClass?: DataClass;
  fields?: string[];
}

interface RbacEvaluationResult {
  decision: 'ALLOW' | 'DENY';
  reason: string;
  effectivePermissions?: Permission[];
  deniedFields?: string[];
  allowedFields?: string[];
}

async function evaluateRbac(request: RbacEvaluationRequest): Promise<RbacEvaluationResult> {
  // 1. Verificar se o role esta ativo para o usuario
  const roleAssignment = await roleStore.getActiveAssignment(request.userId, request.activeRole);
  if (!roleAssignment) {
    return { decision: 'DENY', reason: 'ROLE_NOT_ASSIGNED_OR_INACTIVE' };
  }

  // 2. Verificar credenciais (conselho profissional)
  const role = await roleStore.getRole(request.activeRole);
  if (role.metadata.credentialRequired) {
    const credentialValid = await credentialService.verify(
      request.userId,
      role.metadata.credentialRequired
    );
    if (!credentialValid) {
      return { decision: 'DENY', reason: 'CREDENTIAL_INVALID_OR_EXPIRED' };
    }
  }

  // 3. Resolver permissoes efetivas (com heranca)
  const effectivePermissions = resolveEffectivePermissions(request.activeRole);

  // 4. Encontrar permissao aplicavel
  const matchingPermission = effectivePermissions.find(p =>
    p.resource === request.resource &&
    p.actions.includes(request.action) &&
    (!request.dataClass || p.dataClasses.includes(request.dataClass))
  );

  if (!matchingPermission) {
    return { decision: 'DENY', reason: 'NO_MATCHING_PERMISSION' };
  }

  // 5. Filtrar campos permitidos
  const allowedFields = matchingPermission.fields || ['*'];
  const deniedFields = request.fields?.filter(f => !fieldMatchesPattern(f, allowedFields)) || [];

  return {
    decision: 'ALLOW',
    reason: 'RBAC_PERMISSION_MATCHED',
    effectivePermissions: [matchingPermission],
    allowedFields,
    deniedFields,
  };
}
```

---

## 3. Camada 2: ReBAC (Relationship-Based Access Control)

### 3.1 Conceitos Fundamentais

O ReBAC garante que um profissional so acessa dados de pacientes com os quais
tem relacao profissional ativa. Isso implementa o principio de need-to-know
da LGPD.

```typescript
interface Relationship {
  id: string;                       // UUID
  type: RelationshipType;
  subjectUserId: string;            // Profissional
  objectPatientId: string;          // Paciente
  objectScope?: string;             // Unidade/setor (para relacoes de setor)
  status: RelationshipStatus;
  createdAt: string;                // ISO 8601
  createdBy: string;                // Quem criou a relacao
  expiresAt?: string;               // Expiracao automatica
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
  metadata: RelationshipMetadata;
}

type RelationshipType =
  | 'attending_physician'       // Medico assistente do paciente
  | 'on_call_physician'        // Plantonista do setor
  | 'consulting_physician'     // Interconsultor
  | 'nursing_team_assigned'    // Equipe de enfermagem do paciente/setor
  | 'multidisciplinary_team'   // Equipe multidisciplinar
  | 'physiotherapy_assigned'   // Fisioterapeuta designado
  | 'nutrition_assigned'       // Nutricionista designado
  | 'psychology_assigned'      // Psicologo designado
  | 'social_work_assigned'     // Assistente social designado
  | 'speech_therapy_assigned'  // Fonoaudiologo designado
  | 'ot_assigned'              // Terapeuta ocupacional designado
  | 'pharmacy_service'         // Servico de farmacia (por setor)
  | 'lab_service'              // Servico de laboratorio (por setor)
  | 'imaging_service'          // Servico de imagem (por setor)
  | 'transport_assigned'       // Transporte designado
  | 'cleaning_assigned'        // Limpeza designada (com leito, nao paciente)
  | 'case_management_assigned' // Gestor de caso designado
  | 'audit_access'             // Acesso de auditoria (temporario)
  | 'break_glass_emergency';   // Relacao de emergencia (break-glass)

type RelationshipStatus =
  | 'active'
  | 'expired'
  | 'revoked'
  | 'pending_approval';

interface RelationshipMetadata {
  sourceSystem: string;          // 'shift_schedule', 'admission', 'manual', 'break_glass'
  shiftId?: string;              // ID do turno (para relacoes de plantao)
  admissionId?: string;          // ID da internacao
  taskId?: string;               // ID da tarefa (para transport, cleaning)
  dataClassScope?: DataClass[];  // Classes de dados permitidas pela relacao
  actionScope?: string[];        // Acoes permitidas pela relacao
}
```

### 3.2 Tipos de Relacao Detalhados

| Tipo de Relacao            | Criacao                                    | Expiracao                        | Escopo de Dados      | Revogacao               |
|----------------------------|--------------------------------------------|----------------------------------|----------------------|-------------------------|
| attending_physician        | Admissao ou designacao pelo clinical_director | Alta do paciente               | C, D (E com step-up) | Transferencia de medico |
| on_call_physician          | Inicio do plantao (automatico)             | Fim do plantao (automatico)      | C, D                 | Automatica              |
| consulting_physician       | Solicitacao de interconsulta                | 72h apos resposta da interconsulta | C, D (do caso)     | Manual ou automatica    |
| nursing_team_assigned      | Escala de enfermagem                        | Fim do turno (automatico)        | C, D (enf.)          | Automatica              |
| multidisciplinary_team     | Inclusao na equipe pelo clinical_director   | Alta do paciente                 | Variavel por profissao | Manual                |
| physiotherapy_assigned     | Solicitacao de fisioterapia                 | Alta ou conclusao do tratamento  | C (parcial)          | Manual                  |
| nutrition_assigned         | Solicitacao de nutricao                     | Alta ou conclusao               | C (parcial)          | Manual                  |
| psychology_assigned        | Solicitacao de psicologia                   | Alta ou conclusao               | C, D (saude mental)  | Manual                  |
| transport_assigned         | Criacao da ordem de transporte              | Conclusao do transporte          | A (minimo)           | Automatica              |
| cleaning_assigned          | Criacao da ordem de limpeza                 | Conclusao da limpeza             | A (minimo)           | Automatica              |
| break_glass_emergency      | Ativacao de break-glass                     | Timer (1h-4h por classe)         | A-E                  | Automatica              |

### 3.3 Ciclo de Vida das Relacoes

```
CRIACAO                    VIGENCIA                   TERMINO
   |                          |                          |
   v                          v                          v
+----------+           +-----------+              +-----------+
| Triggers |           | Validacao |              | Triggers  |
| - Admissao|          | - A cada  |              | - Alta    |
| - Escala  |          |   acesso  |              | - Fim turno|
| - Solicit.|          | - Status  |              | - Conclusao|
| - Manual  |          |   ativo?  |              | - Manual  |
| - Break-  |          | - Dentro  |              | - Timeout |
|   glass   |          |   do prazo|              +-----------+
+----------+           | - Nao     |                    |
     |                 |   revogada|                    v
     v                 +-----------+              +-----------+
+-----------+               |                     | Status:   |
| Status:   |               v                     | expired / |
| active    |          ALLOW ou DENY              | revoked   |
+-----------+                                     +-----------+
     |                                                 |
     +-------> Auditoria de criacao                    +-------> Auditoria de termino
```

### 3.4 ReBAC Evaluation Engine

```typescript
interface RebacEvaluationRequest {
  userId: string;
  patientId: string;
  activeRole: string;
  action: Action;
  dataClass: DataClass;
}

interface RebacEvaluationResult {
  decision: 'ALLOW' | 'DENY';
  reason: string;
  relationship?: Relationship;
  breakGlassAvailable?: boolean;
}

async function evaluateRebac(request: RebacEvaluationRequest): Promise<RebacEvaluationResult> {
  const role = await roleStore.getRole(request.activeRole);

  // 1. Verificar se o role requer relacao com paciente
  // Niveis 0-1 e roles administrativos nao requerem relacao
  if (role.accessLevel <= 1 || role.metadata.skipRelationshipCheck) {
    return { decision: 'ALLOW', reason: 'RELATIONSHIP_NOT_REQUIRED' };
  }

  // 2. Buscar relacoes ativas entre o profissional e o paciente
  const relationships = await relationshipStore.getActiveRelationships(
    request.userId,
    request.patientId
  );

  if (relationships.length === 0) {
    // Sem relacao ativa - verificar elegibilidade para break-glass
    const bgEligible = role.metadata.breakGlassEligible;
    return {
      decision: 'DENY',
      reason: 'NO_ACTIVE_RELATIONSHIP',
      breakGlassAvailable: bgEligible,
    };
  }

  // 3. Verificar se alguma relacao cobre a classe de dados solicitada
  const coveringRelationship = relationships.find(rel => {
    const allowedClasses = rel.metadata.dataClassScope || getDefaultClassScope(rel.type);
    return allowedClasses.includes(request.dataClass);
  });

  if (!coveringRelationship) {
    return {
      decision: 'DENY',
      reason: 'RELATIONSHIP_DOES_NOT_COVER_DATA_CLASS',
      breakGlassAvailable: role.metadata.breakGlassEligible,
    };
  }

  // 4. Verificar se a relacao permite a acao solicitada
  const allowedActions = coveringRelationship.metadata.actionScope ||
    getDefaultActionScope(coveringRelationship.type);
  if (allowedActions && !allowedActions.includes(request.action)) {
    return {
      decision: 'DENY',
      reason: 'RELATIONSHIP_DOES_NOT_ALLOW_ACTION',
    };
  }

  return {
    decision: 'ALLOW',
    reason: 'ACTIVE_RELATIONSHIP_FOUND',
    relationship: coveringRelationship,
  };
}
```

### 3.5 Grafo de Relacoes

O ReBAC e implementado como um grafo direcionado onde:
- Nos = Usuarios, Pacientes, Unidades, Leitos, Tarefas
- Arestas = Relacoes tipadas com metadados

```
[Medico A] --attending_physician--> [Paciente X]
[Medico A] --on_call_physician---> [UTI]
[Enfermeira B] --nursing_team----> [Paciente X]
[Enfermeira B] --nursing_team----> [UTI]
[Maqueiro C] --transport_assigned-> [Transporte #123]
[Transporte #123] --transport_for-> [Paciente X]
[Leito 301-A] --occupied_by-------> [Paciente X]
[Limpeza D] --cleaning_assigned---> [Leito 301-A]
```

```typescript
// Consulta no grafo de relacoes (usando Zanzibar/SpiceDB style)
interface RelationshipQuery {
  subject: { type: 'user'; id: string };
  relation: RelationshipType;
  object: { type: 'patient' | 'unit' | 'bed' | 'task'; id: string };
}

// Exemplo de verificacao
const check: RelationshipQuery = {
  subject: { type: 'user', id: 'dr-silva-uuid' },
  relation: 'attending_physician',
  object: { type: 'patient', id: 'patient-xyz-uuid' },
};

// Schema do grafo (SpiceDB/Zanzibar style)
const schema = `
definition user {}

definition patient {
  relation attending_physician: user
  relation on_call_physician: user
  relation consulting_physician: user
  relation nursing_team: user
  relation multidisciplinary_team: user
  relation break_glass_accessor: user

  permission view_chart = attending_physician + on_call_physician +
                          consulting_physician + nursing_team +
                          multidisciplinary_team + break_glass_accessor
  permission write_medical = attending_physician + on_call_physician +
                             break_glass_accessor
  permission write_nursing = nursing_team + break_glass_accessor
}

definition unit {
  relation staff: user
  relation manager: user

  permission view_census = staff + manager
}

definition task {
  relation assigned_to: user
  relation related_patient: patient

  permission execute = assigned_to
  permission view_patient_minimal = assigned_to & related_patient->view_chart
}
`;
```

---

## 4. Camada 3: ABAC (Attribute-Based Access Control)

### 4.1 Conceitos Fundamentais

O ABAC avalia atributos contextuais para decidir se uma acao e permitida,
mesmo quando o RBAC e ReBAC ja concederam acesso.

### 4.2 Catalogo de Atributos

```typescript
interface AttributeCatalog {
  // Atributos do Sujeito (Profissional)
  subject: {
    profession: string;              // 'medico', 'enfermeiro', etc.
    council: string;                 // 'CRM', 'COREN', etc.
    councilStatus: 'active' | 'suspended' | 'cancelled';
    councilNumber: string;
    specialties: string[];           // Especialidades registradas
    unit: string;                    // Unidade atual
    shift: 'morning' | 'afternoon' | 'night' | 'on_call' | 'none';
    shiftActive: boolean;
    team: string;                    // Equipe atual
    yearsOfExperience: number;
    seniorityLevel: 'junior' | 'mid' | 'senior';
    lastMfaVerification: string;     // Timestamp
    deviceTrust: 'trusted' | 'untrusted' | 'unknown';
    locationType: 'hospital_network' | 'vpn' | 'remote' | 'unknown';
    ipAddress: string;
    geoLocation: GeoLocation;
  };

  // Atributos do Recurso (Dado/Registro)
  resource: {
    patientType: 'inpatient' | 'outpatient' | 'emergency' | 'icu';
    dataRisk: 'low' | 'medium' | 'high' | 'critical';
    dataClass: DataClass;
    recordAge: Duration;             // Idade do registro
    isSealed: boolean;               // Registro lacrado/sequestrado
    isFlagged: boolean;              // Registro com flag especial
    department: string;
    sensitiveFlags: string[];        // 'hiv', 'mental_health', 'violence', etc.
  };

  // Atributos do Contexto (Ambiente)
  context: {
    currentTime: string;
    dayOfWeek: string;
    isHoliday: boolean;
    isBusinessHours: boolean;
    emergencyDeclared: boolean;      // Emergencia institucional (ex: catastrofe)
    systemLoad: 'normal' | 'high' | 'critical';
    concurrentSessions: number;
  };

  // Atributos da Acao
  action: {
    type: Action;
    purpose: string;                 // Finalidade declarada
    taskId?: string;                 // Tarefa associada
    consent: {
      exists: boolean;
      type: string;
      valid: boolean;
    };
    careState: 'active_care' | 'discharged' | 'transferred' | 'deceased';
  };
}
```

### 4.3 Politicas ABAC

```yaml
# Exemplo 1: Restricao de horario para dados sensiveis
policy:
  id: "sensitive-data-business-hours"
  description: "Dados sensiveis so podem ser acessados em horario estendido no hospital"
  effect: DENY
  conditions:
    all:
      - attribute: resource.dataClass
        operator: in
        value: [D, E]
      - attribute: context.isBusinessHours
        operator: equals
        value: false
      - attribute: subject.locationToType
        operator: not_equals
        value: hospital_network
  exceptions:
    - subject.activeRole in [medical_staff_on_call, nurse]  # Plantonistas isentos
    - context.emergencyDeclared == true                      # Emergencia institucional

# Exemplo 2: Restricao de dispositivo
policy:
  id: "untrusted-device-restriction"
  description: "Dispositivos nao confiados nao podem acessar dados clinicos"
  effect: DENY
  conditions:
    all:
      - attribute: subject.deviceTrust
        operator: equals
        value: untrusted
      - attribute: resource.dataClass
        operator: in
        value: [C, D, E]
  deny_reason: "UNTRUSTED_DEVICE"

# Exemplo 3: Restricao por estado de cuidado
policy:
  id: "discharged-patient-restriction"
  description: "Paciente com alta tem acesso restrito apos 72h"
  effect: DENY
  conditions:
    all:
      - attribute: action.careState
        operator: equals
        value: discharged
      - attribute: resource.recordAge
        operator: greater_than
        value: "72h"
      - attribute: subject.activeRole
        operator: not_in
        value: [clinical_director, compliance_auditor]
  deny_reason: "PATIENT_DISCHARGED_ACCESS_WINDOW_EXPIRED"

# Exemplo 4: Step-up authentication
policy:
  id: "step-up-for-prescriptions"
  description: "Prescricoes de alto risco requerem re-autenticacao"
  effect: STEP_UP
  conditions:
    all:
      - attribute: action.type
        operator: equals
        value: create
      - attribute: resource.type
        operator: equals
        value: prescription
      - attribute: resource.dataRisk
        operator: in
        value: [high, critical]
  step_up:
    method: mfa_totp
    max_age: "5m"  # MFA deve ter sido verificado nos ultimos 5 minutos
    message: "Prescricao de alto risco requer re-autenticacao"
```

### 4.4 ABAC Policy Engine (OPA/Rego)

```rego
# policy/hospital_access.rego
package velya.authz

import future.keywords.in
import future.keywords.every

# Politica padrao: negar
default allow := false

# Regra principal de autorizacao
allow if {
    rbac_allow
    rebac_allow
    abac_allow
    not explicit_deny
}

# RBAC: verificar permissao do role
rbac_allow if {
    role := data.roles[input.subject.active_role]
    permission := role.permissions[_]
    permission.resource == input.resource.type
    input.action.type in permission.actions
    input.resource.data_class in permission.data_classes
}

# ReBAC: verificar relacao com paciente
rebac_allow if {
    # Roles de nivel 0-1 nao precisam de relacao
    role := data.roles[input.subject.active_role]
    role.access_level <= 1
}

rebac_allow if {
    # Relacao ativa encontrada
    relationship := data.relationships[_]
    relationship.subject_id == input.subject.user_id
    relationship.object_id == input.resource.patient_id
    relationship.status == "active"
    time.now_ns() < time.parse_rfc3339_ns(relationship.expires_at)
}

rebac_allow if {
    # Break-glass ativo
    input.context.break_glass == true
    bg := data.break_glass_sessions[_]
    bg.user_id == input.subject.user_id
    bg.patient_id == input.resource.patient_id
    bg.status == "active"
}

# ABAC: verificar atributos contextuais
abac_allow if {
    # Verificar todas as politicas ABAC
    every policy in data.abac_policies {
        not policy_denies(policy)
    }
}

policy_denies(policy) if {
    policy.effect == "DENY"
    every condition in policy.conditions.all {
        condition_matches(condition)
    }
    not policy_exception_applies(policy)
}

condition_matches(condition) if {
    condition.operator == "equals"
    get_attribute(condition.attribute) == condition.value
}

condition_matches(condition) if {
    condition.operator == "in"
    get_attribute(condition.attribute) in condition.value
}

condition_matches(condition) if {
    condition.operator == "not_equals"
    get_attribute(condition.attribute) != condition.value
}

# Resolucao de atributos
get_attribute(attr) := value if {
    parts := split(attr, ".")
    parts[0] == "subject"
    value := input.subject[parts[1]]
}

get_attribute(attr) := value if {
    parts := split(attr, ".")
    parts[0] == "resource"
    value := input.resource[parts[1]]
}

get_attribute(attr) := value if {
    parts := split(attr, ".")
    parts[0] == "context"
    value := input.context[parts[1]]
}

# Negacao explicita - sempre prevalece
explicit_deny if {
    policy := data.deny_policies[_]
    policy.effect == "DENY"
    every condition in policy.conditions.all {
        condition_matches(condition)
    }
}

# Decisao de step-up
step_up_required if {
    policy := data.abac_policies[_]
    policy.effect == "STEP_UP"
    every condition in policy.conditions.all {
        condition_matches(condition)
    }
    not step_up_satisfied(policy)
}

step_up_satisfied(policy) if {
    mfa_age := time.now_ns() - time.parse_rfc3339_ns(input.subject.last_mfa_verification)
    max_age := time.parse_duration_ns(policy.step_up.max_age)
    mfa_age < max_age
}
```

---

## 5. Integracao das 3 Camadas

### 5.1 Pseudocodigo do Authorization Engine

```typescript
interface AuthorizationRequest {
  // Autenticacao (ja verificada)
  userId: string;
  sessionId: string;

  // RBAC
  activeRole: string;

  // ReBAC
  patientId?: string;

  // Acao
  action: Action;
  resource: string;
  dataClass: DataClass;
  fields?: string[];
  purpose: string;

  // Contexto (ABAC)
  context: {
    deviceFingerprint: string;
    sourceIp: string;
    location: GeoLocation;
    timestamp: string;
    taskId?: string;
    breakGlass?: boolean;
    breakGlassJustification?: string;
  };
}

interface AuthorizationResponse {
  decision: 'ALLOW' | 'DENY' | 'STEP_UP_REQUIRED';
  reason: string;
  allowedFields?: string[];
  maskedFields?: FieldMask[];
  deniedFields?: string[];
  stepUpMethod?: string;
  breakGlassAvailable?: boolean;
  auditEntry: AuditEntry;
  evaluationTimeMs: number;
}

async function authorize(request: AuthorizationRequest): Promise<AuthorizationResponse> {
  const startTime = performance.now();

  // === CAMADA 1: RBAC ===
  const rbacResult = await evaluateRbac({
    userId: request.userId,
    activeRole: request.activeRole,
    action: request.action,
    resource: request.resource,
    dataClass: request.dataClass,
    fields: request.fields,
  });

  if (rbacResult.decision === 'DENY') {
    return buildResponse('DENY', `RBAC: ${rbacResult.reason}`, startTime, request);
  }

  // === CAMADA 2: ReBAC ===
  if (request.patientId) {
    const rebacResult = await evaluateRebac({
      userId: request.userId,
      patientId: request.patientId,
      activeRole: request.activeRole,
      action: request.action,
      dataClass: request.dataClass,
    });

    if (rebacResult.decision === 'DENY') {
      // Verificar se break-glass esta disponivel e sendo solicitado
      if (rebacResult.breakGlassAvailable && request.context.breakGlass) {
        const bgResult = await activateBreakGlass(request);
        if (bgResult.decision === 'DENY') {
          return buildResponse('DENY', `BREAK_GLASS: ${bgResult.reason}`, startTime, request);
        }
        // Break-glass aprovado - continuar para ABAC
      } else {
        return buildResponse(
          'DENY',
          `ReBAC: ${rebacResult.reason}`,
          startTime,
          request,
          rebacResult.breakGlassAvailable
        );
      }
    }
  }

  // === CAMADA 3: ABAC ===
  const abacResult = await evaluateAbac(request);

  if (abacResult.decision === 'DENY') {
    return buildResponse('DENY', `ABAC: ${abacResult.reason}`, startTime, request);
  }

  if (abacResult.decision === 'STEP_UP_REQUIRED') {
    return buildResponse('STEP_UP_REQUIRED', 'ABAC: Step-up required', startTime, request);
  }

  // === FIELD FILTERING ===
  const fieldFilter = await applyFieldLevelAccess(
    request.activeRole,
    request.dataClass,
    request.fields || ['*'],
    rbacResult.allowedFields || ['*']
  );

  return {
    decision: 'ALLOW',
    reason: 'ALL_LAYERS_PASSED',
    allowedFields: fieldFilter.allowed,
    maskedFields: fieldFilter.masked,
    deniedFields: fieldFilter.denied,
    auditEntry: buildAuditEntry(request, 'ALLOW'),
    evaluationTimeMs: performance.now() - startTime,
  };
}
```

### 5.2 Cache e Performance

```yaml
# Estrategia de cache para o authorization engine
caching:
  rbac:
    # Roles e permissoes mudam raramente
    cache_type: distributed  # Redis
    ttl: 300s                # 5 minutos
    invalidation: event_driven  # Invalidar quando role muda

  rebac:
    # Relacoes mudam com frequencia (turnos, admissoes)
    cache_type: local        # In-memory LRU
    ttl: 60s                 # 1 minuto
    invalidation: event_driven + ttl
    preload: true            # Pre-carregar relacoes no inicio do turno

  abac:
    # Atributos contextuais mudam constantemente
    cache_type: none         # Sem cache - sempre avaliar em tempo real
    exception:
      - attribute: subject.council_status  # Cache o status do conselho
        ttl: 3600s                          # 1 hora

  decision:
    # Cache de decisoes recentes (mesma combinacao = mesmo resultado)
    cache_type: local
    ttl: 30s
    key: "userId:roleId:patientId:action:resource:dataClass"
    invalidation: any_input_change

performance:
  target_latency:
    p50: 5ms
    p95: 15ms
    p99: 50ms
  max_latency: 100ms  # Acima disso, circuit breaker entra em acao
  circuit_breaker:
    threshold: 10  # 10 falhas consecutivas
    recovery_time: 30s
    fallback: deny_all  # Em caso de falha, negar tudo (seguranca)
```

---

## 6. Separacao de Responsabilidades (SoD)

### 6.1 Regras de Exclusao Mutua

```typescript
interface SeparationOfDutyRule {
  id: string;
  description: string;
  type: 'static' | 'dynamic';
  conflictingActions: [string, string];
  conflictingRoles?: [string, string];
  scope: 'same_patient' | 'same_resource' | 'global';
  enforcement: 'hard' | 'soft';  // hard = block, soft = alert
}

const sodRules: SeparationOfDutyRule[] = [
  {
    id: 'sod-prescribe-dispense',
    description: 'Quem prescreve nao pode dispensar para o mesmo paciente',
    type: 'dynamic',
    conflictingActions: ['prescribe_medication', 'dispense_medication'],
    scope: 'same_patient',
    enforcement: 'hard',
  },
  {
    id: 'sod-order-report-exam',
    description: 'Quem solicita exame nao pode laudar o proprio exame solicitado',
    type: 'dynamic',
    conflictingActions: ['order_exam', 'create_exam_report'],
    scope: 'same_resource',
    enforcement: 'hard',
  },
  {
    id: 'sod-create-approve-user',
    description: 'Quem cria usuario nao pode atribuir role clinico ao mesmo usuario',
    type: 'dynamic',
    conflictingActions: ['create_user_account', 'assign_clinical_role'],
    scope: 'same_resource',
    enforcement: 'hard',
  },
  {
    id: 'sod-break-glass-review',
    description: 'Quem ativou break-glass nao pode revisar seu proprio evento',
    type: 'dynamic',
    conflictingActions: ['activate_break_glass', 'review_break_glass'],
    scope: 'same_resource',
    enforcement: 'hard',
  },
  {
    id: 'sod-auditor-operator',
    description: 'Auditor de compliance nao pode ter role clinico ou operacional',
    type: 'static',
    conflictingActions: ['audit_access', 'clinical_access'],
    conflictingRoles: ['compliance_auditor', 'clinical_director'],
    scope: 'global',
    enforcement: 'hard',
  },
];
```

---

## 7. Administracao e Governanca do Modelo

### 7.1 Policy Administration Point (PAP)

```yaml
pap:
  access:
    # Quem pode gerenciar politicas
    manage_rbac_roles:
      requires:
        all:
          - role: security_admin_jit
          - approval: clinical_director  # Para roles clinicos
    manage_abac_policies:
      requires:
        all:
          - role: security_admin_jit
          - approval: compliance_auditor
    manage_rebac_relationships:
      auto_managed:
        - shift_schedule_system   # Relacoes de plantao
        - admission_system        # Relacoes de internacao
        - task_management_system  # Relacoes de tarefa
      manual:
        requires:
          - role: clinical_director  # Para relacoes clinicas
          - role: unit_manager       # Para relacoes da unidade

  change_control:
    # Toda alteracao de politica passa por workflow de aprovacao
    workflow:
      - step: draft
        actor: security_admin_jit
      - step: review_legal
        actor: compliance_auditor
      - step: review_clinical
        actor: clinical_director
        condition: "change affects clinical roles"
      - step: approve
        actor: hospital_owner_executive
        condition: "change is high impact"
      - step: deploy
        actor: security_admin_jit
        requires: all_approvals
      - step: verify
        actor: compliance_auditor
        within: 24h

  versioning:
    # Todas as politicas sao versionadas
    strategy: immutable_versions
    rollback: supported
    audit_trail: complete
```

### 7.2 Monitoramento e Metricas

```yaml
monitoring:
  metrics:
    - name: authz_decisions_total
      type: counter
      labels: [decision, layer, role, data_class]

    - name: authz_evaluation_duration_ms
      type: histogram
      buckets: [1, 5, 10, 25, 50, 100, 250, 500]

    - name: break_glass_activations_total
      type: counter
      labels: [role, unit, data_class]

    - name: relationship_count
      type: gauge
      labels: [type, status]

    - name: policy_evaluation_errors_total
      type: counter
      labels: [layer, error_type]

  alerts:
    - name: high_deny_rate
      condition: "rate(authz_decisions_total{decision='DENY'}[5m]) > 50"
      severity: warning
      notify: [security_team]

    - name: break_glass_spike
      condition: "increase(break_glass_activations_total[1h]) > 3"
      severity: critical
      notify: [security_team, clinical_director, compliance]

    - name: authz_latency_high
      condition: "histogram_quantile(0.99, authz_evaluation_duration_ms) > 100"
      severity: warning
      notify: [engineering_team]

    - name: policy_errors
      condition: "rate(policy_evaluation_errors_total[5m]) > 0"
      severity: critical
      notify: [engineering_team, security_team]
```

---

## 8. Testes e Validacao

### 8.1 Estrategia de Testes

```typescript
// Testes de politica (Policy-as-Code testing)
describe('RBAC Policies', () => {
  it('medico assistente pode prescrever medicamento para seu paciente', async () => {
    const result = await authorize({
      userId: 'dr-silva',
      activeRole: 'medical_staff_attending',
      patientId: 'patient-123',
      action: 'create',
      resource: 'prescription',
      dataClass: 'D',
      purpose: 'direct_patient_care',
      context: { /* hospital network, trusted device */ },
    });
    expect(result.decision).toBe('ALLOW');
  });

  it('tecnico de enfermagem NAO pode prescrever medicamento', async () => {
    const result = await authorize({
      userId: 'tec-maria',
      activeRole: 'nursing_technician',
      patientId: 'patient-123',
      action: 'create',
      resource: 'prescription',
      dataClass: 'D',
      purpose: 'direct_patient_care',
      context: { /* hospital network, trusted device */ },
    });
    expect(result.decision).toBe('DENY');
    expect(result.reason).toContain('RBAC');
  });

  it('medico sem relacao com paciente recebe DENY com break-glass disponivel', async () => {
    const result = await authorize({
      userId: 'dr-outro',
      activeRole: 'medical_staff_attending',
      patientId: 'patient-456',  // Nao e paciente deste medico
      action: 'read',
      resource: 'patient_chart',
      dataClass: 'C',
      purpose: 'direct_patient_care',
      context: { /* hospital network */ },
    });
    expect(result.decision).toBe('DENY');
    expect(result.reason).toContain('ReBAC');
    expect(result.breakGlassAvailable).toBe(true);
  });

  it('recepcionista NAO pode acessar dados clinicos', async () => {
    const result = await authorize({
      userId: 'recep-ana',
      activeRole: 'receptionist_registration',
      patientId: 'patient-123',
      action: 'read',
      resource: 'patient_chart',
      dataClass: 'C',
      purpose: 'registration',
      context: { /* reception workstation */ },
    });
    expect(result.decision).toBe('DENY');
    expect(result.reason).toContain('RBAC');
  });
});
```

---

*Documento mantido pela equipe de Arquitetura de Seguranca - Velya Platform.*
*Proxima revisao programada: 2026-07-08.*
