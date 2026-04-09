# Matriz de Papeis, Funcoes e Acessos — Velya Platform

> Matriz completa de 40+ papeis profissionais com niveis de acesso clinico, operacional, autoria, validacao, assinatura, auditoria e escalacao.

---

## 1. Estrutura da Matriz

### 1.1 Dimensoes de Acesso

```typescript
interface RoleAccessProfile {
  role_id: string;
  profession: string;
  function: string;
  shift_role: ShiftRole;
  encounter_role: EncounterRole;

  // Niveis de acesso
  clinical_access_level: AccessLevel;
  operational_access_level: AccessLevel;
  authorship_level: AuthorshipLevel;
  validation_level: ValidationLevel;
  signature_level: SignatureLevel;
  audit_level: AuditLevel;
  escalation_level: EscalationLevel;

  // Restricoes
  data_scope: DataScope;
  patient_relationship_required: boolean;
  unit_restricted: boolean;
  time_restricted: boolean;
  break_glass_eligible: boolean;
}

enum AccessLevel {
  NENHUM = 0, // Sem acesso
  MINIMO = 1, // Apenas identificadores operacionais (leito, sala)
  BASICO = 2, // Dados demograficos basicos
  OPERACIONAL = 3, // Dados operacionais (agenda, fila, status)
  CLINICO_RESTRITO = 4, // Dados clinicos do paciente sob cuidado direto
  CLINICO_AMPLO = 5, // Dados clinicos da unidade
  CLINICO_TOTAL = 6, // Acesso clinico completo (com justificativa)
  ADMINISTRATIVO = 7, // Dados administrativos e financeiros
  AUDITORIA = 8, // Acesso de auditoria (leitura ampla, sem edicao clinica)
  GESTAO = 9, // Acesso gerencial agregado
  DIRECAO = 10, // Acesso total institucional
}

enum AuthorshipLevel {
  NENHUM = 'nenhum',
  REGISTRO_OPERACIONAL = 'registro_operacional', // Registra atividade operacional
  REGISTRO_ASSISTENCIAL = 'registro_assistencial', // Registra atividade assistencial
  EVOLUCAO = 'evolucao', // Evolui paciente
  PRESCRICAO = 'prescricao', // Prescreve
  LAUDO = 'laudo', // Emite laudo
  PARECER = 'parecer', // Emite parecer
  ATESTADO = 'atestado', // Emite atestado
  DECLARACAO = 'declaracao', // Emite declaracao de obito/nascimento
}

enum ValidationLevel {
  NENHUM = 'nenhum',
  CONFERENCIA = 'conferencia', // Confere dados
  DUPLA_CHECAGEM = 'dupla_checagem', // Dupla checagem obrigatoria
  VALIDACAO_TECNICA = 'validacao_tecnica', // Valida tecnicamente
  VALIDACAO_CLINICA = 'validacao_clinica', // Valida clinicamente
  APROVACAO = 'aprovacao', // Aprova (gestao)
}

enum SignatureLevel {
  NENHUM = 'nenhum',
  ASSINATURA_SIMPLES = 'assinatura_simples', // Assinatura de registro operacional
  ASSINATURA_DIGITAL = 'assinatura_digital', // Assinatura digital (ICP-Brasil)
  CO_ASSINATURA = 'co_assinatura', // Co-assinatura (supervisao)
  ASSINATURA_RESPONSAVEL = 'assinatura_responsavel', // Assinatura como responsavel tecnico
}

enum AuditLevel {
  NENHUM = 'nenhum',
  AUDITADO = 'auditado', // Apenas auditado (passivo)
  AUDITOR_OPERACIONAL = 'auditor_operacional', // Audita operacoes
  AUDITOR_CLINICO = 'auditor_clinico', // Audita registros clinicos
  AUDITOR_TOTAL = 'auditor_total', // Audita tudo
}

enum EscalationLevel {
  NENHUM = 'nenhum',
  PODE_ESCALAR = 'pode_escalar', // Pode escalar para superior
  RECEBE_ESCALACAO = 'recebe_escalacao', // Recebe escalacoes
  RESOLVE_ESCALACAO = 'resolve_escalacao', // Resolve escalacoes
  ESCALACAO_INSTITUCIONAL = 'escalacao_institucional', // Escalacao nivel institucional
}

enum ShiftRole {
  PLANTONISTA = 'plantonista',
  DIARISTA = 'diarista',
  ROTATIVO = 'rotativo',
  SOBREAVISO = 'sobreaviso',
  ADMINISTRATIVO = 'administrativo',
  FLEXIVEL = 'flexivel',
}

enum EncounterRole {
  RESPONSAVEL = 'responsavel',
  ASSISTENTE = 'assistente',
  CONSULTOR = 'consultor',
  EXECUTOR = 'executor',
  APOIO = 'apoio',
  OBSERVADOR = 'observador',
  NENHUM = 'nenhum',
}

enum DataScope {
  PROPRIO = 'proprio', // Apenas seus proprios registros
  PACIENTE = 'paciente', // Pacientes sob seu cuidado
  UNIDADE = 'unidade', // Toda a unidade
  DEPARTAMENTO = 'departamento', // Todo o departamento
  INSTITUICAO = 'instituicao', // Toda a instituicao
}
```

---

## 2. Matriz de Papeis Clinicos

### 2.1 Corpo Medico

| Papel                 | Profissao | Funcao                  | Turno       | Encounter   | Clinico      | Operacional     | Autoria    | Validacao         | Assinatura    | Auditoria | Escalacao               |
| --------------------- | --------- | ----------------------- | ----------- | ----------- | ------------ | --------------- | ---------- | ----------------- | ------------- | --------- | ----------------------- |
| Medico Plantonista    | Medico    | Assistencia direta      | Plantonista | Responsavel | 6 (total)    | 3 (operacional) | Prescricao | Validacao clinica | Digital       | Auditado  | Recebe escalacao        |
| Medico Diarista       | Medico    | Acompanhamento          | Diarista    | Responsavel | 5 (amplo)    | 3 (operacional) | Prescricao | Validacao clinica | Digital       | Auditado  | Recebe escalacao        |
| Medico Residente      | Medico    | Formacao supervisionada | Rotativo    | Assistente  | 4 (restrito) | 2 (basico)      | Evolucao   | Conferencia       | Co-assinatura | Auditado  | Pode escalar            |
| Medico Interconsultor | Medico    | Parecer especializado   | Flexivel    | Consultor   | 4 (restrito) | 2 (basico)      | Parecer    | Validacao clinica | Digital       | Auditado  | Pode escalar            |
| Anestesista           | Medico    | Anestesia               | Plantonista | Responsavel | 5 (amplo)    | 3 (operacional) | Prescricao | Validacao clinica | Digital       | Auditado  | Recebe escalacao        |
| Cirurgiao             | Medico    | Cirurgia                | Flexivel    | Responsavel | 5 (amplo)    | 3 (operacional) | Evolucao   | Validacao clinica | Digital       | Auditado  | Recebe escalacao        |
| Intensivista          | Medico    | Terapia intensiva       | Plantonista | Responsavel | 6 (total)    | 3 (operacional) | Prescricao | Validacao clinica | Digital       | Auditado  | Resolve escalacao       |
| Emergencista          | Medico    | Pronto atendimento      | Plantonista | Responsavel | 6 (total)    | 3 (operacional) | Prescricao | Validacao clinica | Digital       | Auditado  | Resolve escalacao       |
| Regulador             | Medico    | Regulacao medica        | Diarista    | Consultor   | 5 (amplo)    | 5 (amplo)       | Parecer    | Aprovacao         | Digital       | Auditado  | Escalacao institucional |
| Paliativista          | Medico    | Cuidados paliativos/dor | Diarista    | Responsavel | 5 (amplo)    | 3 (operacional) | Prescricao | Validacao clinica | Digital       | Auditado  | Recebe escalacao        |

### 2.2 Enfermagem

| Papel                   | Profissao  | Funcao                | Turno       | Encounter   | Clinico      | Operacional     | Autoria               | Validacao         | Assinatura | Auditoria           | Escalacao        |
| ----------------------- | ---------- | --------------------- | ----------- | ----------- | ------------ | --------------- | --------------------- | ----------------- | ---------- | ------------------- | ---------------- |
| Enfermeiro Assistencial | Enfermeiro | Assistencia direta    | Plantonista | Responsavel | 5 (amplo)    | 4 (restrito)    | Evolucao              | Validacao clinica | Digital    | Auditado            | Pode escalar     |
| Enfermeiro Lider        | Enfermeiro | Coordenacao turno     | Plantonista | Responsavel | 5 (amplo)    | 5 (amplo)       | Evolucao              | Aprovacao         | Digital    | Auditor operacional | Recebe escalacao |
| Enfermeiro SCIH         | Enfermeiro | Controle infeccao     | Diarista    | Consultor   | 5 (amplo)    | 4 (restrito)    | Parecer               | Validacao clinica | Digital    | Auditor clinico     | Recebe escalacao |
| Tecnico Enfermagem      | Tecnico    | Execucao assistencial | Plantonista | Executor    | 4 (restrito) | 3 (operacional) | Registro assistencial | Dupla checagem    | Simples    | Auditado            | Pode escalar     |

### 2.3 Equipe Multiprofissional

| Papel                 | Profissao         | Funcao              | Turno    | Encounter  | Clinico         | Operacional     | Autoria    | Validacao         | Assinatura | Auditoria | Escalacao    |
| --------------------- | ----------------- | ------------------- | -------- | ---------- | --------------- | --------------- | ---------- | ----------------- | ---------- | --------- | ------------ |
| Fisioterapeuta        | Fisioterapeuta    | Reabilitacao        | Diarista | Assistente | 4 (restrito)    | 3 (operacional) | Evolucao   | Validacao tecnica | Digital    | Auditado  | Pode escalar |
| Farmaceutico Clinico  | Farmaceutico      | Farmacia clinica    | Diarista | Consultor  | 4 (restrito)    | 4 (restrito)    | Parecer    | Validacao clinica | Digital    | Auditado  | Pode escalar |
| Nutricionista Clinico | Nutricionista     | Terapia nutricional | Diarista | Assistente | 4 (restrito)    | 3 (operacional) | Prescricao | Validacao tecnica | Digital    | Auditado  | Pode escalar |
| Psicologo             | Psicologo         | Apoio psicologico   | Diarista | Assistente | 4 (restrito)    | 2 (basico)      | Evolucao   | Validacao tecnica | Digital    | Auditado  | Pode escalar |
| Assistente Social     | Assistente Social | Servico social      | Diarista | Assistente | 3 (operacional) | 3 (operacional) | Evolucao   | Validacao tecnica | Digital    | Auditado  | Pode escalar |
| Fonoaudiologo         | Fonoaudiologo     | Fonoaudiologia      | Diarista | Assistente | 4 (restrito)    | 2 (basico)      | Evolucao   | Validacao tecnica | Digital    | Auditado  | Pode escalar |
| Terapeuta Ocupacional | TO                | Terapia ocupacional | Diarista | Assistente | 4 (restrito)    | 2 (basico)      | Evolucao   | Validacao tecnica | Digital    | Auditado  | Pode escalar |

### 2.4 Diagnostico e Apoio Clinico

| Papel               | Profissao | Funcao                 | Turno    | Encounter | Clinico         | Operacional     | Autoria              | Validacao         | Assinatura | Auditoria | Escalacao    |
| ------------------- | --------- | ---------------------- | -------- | --------- | --------------- | --------------- | -------------------- | ----------------- | ---------- | --------- | ------------ |
| Biomedico/Lab       | Biomedico | Analises clinicas      | Rotativo | Executor  | 3 (operacional) | 3 (operacional) | Laudo                | Validacao tecnica | Digital    | Auditado  | Pode escalar |
| Tecnico Laboratorio | Tecnico   | Coleta e processamento | Rotativo | Executor  | 2 (basico)      | 3 (operacional) | Registro operacional | Conferencia       | Simples    | Auditado  | Pode escalar |
| Radiologista        | Medico    | Diagnostico imagem     | Flexivel | Consultor | 5 (amplo)       | 3 (operacional) | Laudo                | Validacao clinica | Digital    | Auditado  | Pode escalar |
| Tecnico Radiologia  | Tecnico   | Execucao exames        | Rotativo | Executor  | 2 (basico)      | 3 (operacional) | Registro operacional | Conferencia       | Simples    | Auditado  | Pode escalar |

---

## 3. Matriz de Papeis Operacionais

### 3.1 Recepcao e Cadastro

| Papel              | Profissao      | Funcao              | Turno    | Encounter | Clinico    | Operacional  | Autoria              | Validacao   | Assinatura | Auditoria | Escalacao        |
| ------------------ | -------------- | ------------------- | -------- | --------- | ---------- | ------------ | -------------------- | ----------- | ---------- | --------- | ---------------- |
| Recepcionista      | Administrativo | Recepcao pacientes  | Rotativo | Nenhum    | 1 (minimo) | 4 (restrito) | Registro operacional | Conferencia | Simples    | Auditado  | Pode escalar     |
| Cadastrista        | Administrativo | Cadastro e admissao | Diarista | Nenhum    | 2 (basico) | 4 (restrito) | Registro operacional | Conferencia | Simples    | Auditado  | Pode escalar     |
| Central Internacao | Administrativo | Gestao internacoes  | Diarista | Nenhum    | 2 (basico) | 5 (amplo)    | Registro operacional | Conferencia | Simples    | Auditado  | Pode escalar     |
| Central Leitos     | Administrativo | Gestao leitos       | Rotativo | Nenhum    | 1 (minimo) | 5 (amplo)    | Registro operacional | Conferencia | Simples    | Auditado  | Recebe escalacao |

### 3.2 Logistica e Apoio

| Papel                | Profissao   | Funcao                   | Turno       | Encounter | Clinico    | Operacional     | Autoria              | Validacao         | Assinatura | Auditoria | Escalacao        |
| -------------------- | ----------- | ------------------------ | ----------- | --------- | ---------- | --------------- | -------------------- | ----------------- | ---------- | --------- | ---------------- |
| Maqueiro             | Operacional | Transporte interno       | Rotativo    | Apoio     | 0 (nenhum) | 3 (operacional) | Registro operacional | Nenhum            | Simples    | Auditado  | Pode escalar     |
| Motorista Ambulancia | Operacional | Transporte externo       | Plantonista | Apoio     | 0 (nenhum) | 3 (operacional) | Registro operacional | Nenhum            | Simples    | Auditado  | Pode escalar     |
| Higienizacao         | Operacional | Limpeza hospitalar       | Rotativo    | Nenhum    | 0 (nenhum) | 3 (operacional) | Registro operacional | Nenhum            | Simples    | Auditado  | Pode escalar     |
| Rouparia             | Operacional | Gestao enxoval           | Diarista    | Nenhum    | 0 (nenhum) | 3 (operacional) | Registro operacional | Nenhum            | Simples    | Auditado  | Pode escalar     |
| Manutencao           | Tecnico     | Manutencao predial/equip | Rotativo    | Nenhum    | 0 (nenhum) | 3 (operacional) | Registro operacional | Validacao tecnica | Simples    | Auditado  | Pode escalar     |
| Hotelaria            | Operacional | Servicos hoteleiros      | Diarista    | Nenhum    | 0 (nenhum) | 3 (operacional) | Registro operacional | Nenhum            | Simples    | Auditado  | Pode escalar     |
| Seguranca            | Operacional | Seguranca patrimonial    | Plantonista | Nenhum    | 0 (nenhum) | 3 (operacional) | Registro operacional | Nenhum            | Simples    | Auditado  | Recebe escalacao |
| Almoxarifado         | Operacional | Gestao materiais         | Diarista    | Nenhum    | 0 (nenhum) | 4 (restrito)    | Registro operacional | Conferencia       | Simples    | Auditado  | Pode escalar     |

### 3.3 Farmacia e Nutricao Operacional

| Papel                | Profissao | Funcao              | Turno    | Encounter | Clinico    | Operacional     | Autoria              | Validacao      | Assinatura | Auditoria | Escalacao    |
| -------------------- | --------- | ------------------- | -------- | --------- | ---------- | --------------- | -------------------- | -------------- | ---------- | --------- | ------------ |
| Farmacia Logistica   | Tecnico   | Dispensacao/estoque | Rotativo | Nenhum    | 1 (minimo) | 4 (restrito)    | Registro operacional | Dupla checagem | Simples    | Auditado  | Pode escalar |
| Nutricao Operacional | Tecnico   | Producao dietas     | Rotativo | Nenhum    | 1 (minimo) | 3 (operacional) | Registro operacional | Conferencia    | Simples    | Auditado  | Pode escalar |

### 3.4 Administrativo e Gestao

| Papel              | Profissao      | Funcao                | Turno          | Encounter  | Clinico       | Operacional        | Autoria              | Validacao         | Assinatura  | Auditoria           | Escalacao               |
| ------------------ | -------------- | --------------------- | -------------- | ---------- | ------------- | ------------------ | -------------------- | ----------------- | ----------- | ------------------- | ----------------------- |
| Admin Unidade      | Administrativo | Gestao unidade        | Diarista       | Nenhum     | 2 (basico)    | 5 (amplo)          | Registro operacional | Aprovacao         | Digital     | Auditor operacional | Recebe escalacao        |
| Faturamento        | Administrativo | Faturamento           | Diarista       | Nenhum     | 2 (basico)    | 7 (administrativo) | Registro operacional | Conferencia       | Digital     | Auditado            | Pode escalar            |
| TI                 | Tecnico        | Tecnologia informacao | Rotativo       | Nenhum     | 0 (nenhum)    | 5 (amplo)          | Registro operacional | Validacao tecnica | Simples     | Auditado            | Recebe escalacao        |
| Qualidade          | Especialista   | Gestao qualidade      | Diarista       | Nenhum     | 8 (auditoria) | 8 (auditoria)      | Parecer              | Validacao clinica | Digital     | Auditor total       | Recebe escalacao        |
| Auditoria          | Especialista   | Auditoria clinica/op  | Diarista       | Observador | 8 (auditoria) | 8 (auditoria)      | Parecer              | Validacao clinica | Digital     | Auditor total       | Resolve escalacao       |
| SCIH               | Enfermeiro     | Controle infeccao     | Diarista       | Consultor  | 5 (amplo)     | 4 (restrito)       | Parecer              | Validacao clinica | Digital     | Auditor clinico     | Recebe escalacao        |
| Gestor/Coordenador | Administrativo | Gestao departamento   | Diarista       | Nenhum     | 9 (gestao)    | 9 (gestao)         | Registro operacional | Aprovacao         | Digital     | Auditor operacional | Resolve escalacao       |
| Direcao            | Administrativo | Direcao institucional | Administrativo | Nenhum     | 10 (direcao)  | 10 (direcao)       | Registro operacional | Aprovacao         | Responsavel | Auditor total       | Escalacao institucional |

---

## 4. Regras de Acesso Contextual

### 4.1 Restricoes Baseadas em Relacionamento

```typescript
interface ContextualAccessRule {
  rule_id: string;
  description: string;
  condition: AccessCondition;
  effect: 'allow' | 'deny' | 'require_justification';
}

const contextualRules: ContextualAccessRule[] = [
  {
    rule_id: 'CAR-001',
    description: 'Acesso clinico apenas a pacientes com relacao assistencial ativa',
    condition: {
      requires_active_encounter: true,
      requires_care_team_membership: true,
      applies_to_levels: [4, 5], // CLINICO_RESTRITO, CLINICO_AMPLO
    },
    effect: 'deny',
  },
  {
    rule_id: 'CAR-002',
    description: 'Acesso fora da unidade requer justificativa',
    condition: {
      requires_same_unit: true,
      applies_to_levels: [4, 5],
    },
    effect: 'require_justification',
  },
  {
    rule_id: 'CAR-003',
    description: 'Profissional operacional nao acessa dados clinicos',
    condition: {
      role_category: 'operacional',
      target_data: 'clinical',
    },
    effect: 'deny',
  },
  {
    rule_id: 'CAR-004',
    description: 'Break-glass apenas para emergencia com justificativa obrigatoria',
    condition: {
      access_type: 'break_glass',
      requires_justification: true,
      requires_post_audit: true,
      max_duration_minutes: 60,
    },
    effect: 'allow',
  },
  {
    rule_id: 'CAR-005',
    description: 'Acesso de auditoria e somente leitura',
    condition: {
      role_category: 'auditoria',
      allowed_actions: ['read', 'export_aggregated'],
      denied_actions: ['write', 'edit', 'delete'],
    },
    effect: 'allow',
  },
  {
    rule_id: 'CAR-006',
    description: 'Residente requer co-assinatura do preceptor',
    condition: {
      role: 'medico_residente',
      action: 'prescricao',
      requires_cosignature: true,
      cosigner_role: 'medico_preceptor',
    },
    effect: 'allow',
  },
  {
    rule_id: 'CAR-007',
    description: 'TI nao acessa dados de paciente',
    condition: {
      role: 'ti',
      target_data: 'patient_data',
    },
    effect: 'deny',
  },
  {
    rule_id: 'CAR-008',
    description: 'Seguranca nao acessa dados clinicos nem de paciente',
    condition: {
      role: 'seguranca',
      target_data: ['clinical', 'patient_demographics'],
    },
    effect: 'deny',
  },
];
```

### 4.2 Mapa de Dados Visiveis por Nivel

| Nivel           | Dados Visiveis                               | Dados Mascarados            | Dados Bloqueados        |
| --------------- | -------------------------------------------- | --------------------------- | ----------------------- |
| 0 (nenhum)      | Nenhum dado de paciente                      | Tudo                        | Tudo                    |
| 1 (minimo)      | Numero leito, sala, codigo atendimento       | Nome, idade, diagnostico    | Tudo clinico            |
| 2 (basico)      | Nome, idade, convenio                        | CPF parcial, endereco       | Diagnostico, prescricao |
| 3 (operacional) | Dados operacionais: fila, status, prioridade | Dados clinicos              | Evolucoes, laudos       |
| 4 (restrito)    | Dados clinicos do paciente sob cuidado       | Outros pacientes            | Dados financeiros       |
| 5 (amplo)       | Dados clinicos da unidade                    | Outras unidades             | Dados financeiros       |
| 6 (total)       | Todos os dados clinicos (com justificativa)  | -                           | Dados financeiros       |
| 7 (admin)       | Dados administrativos e financeiros          | Detalhes clinicos           | -                       |
| 8 (auditoria)   | Leitura ampla para auditoria                 | -                           | Escrita clinica         |
| 9 (gestao)      | Dados agregados e indicadores                | Dados individuais sensiveis | -                       |
| 10 (direcao)    | Acesso total institucional                   | -                           | -                       |

---

## 5. Configuracao YAML da Matriz

```yaml
# role-access-config.yaml
roles:
  medico_plantonista:
    profession: medico
    function: assistencia_direta
    shift_role: plantonista
    encounter_role: responsavel
    access:
      clinical: 6
      operational: 3
    authorship: prescricao
    validation: validacao_clinica
    signature: digital
    audit: auditado
    escalation: recebe_escalacao
    restrictions:
      patient_relationship_required: true
      unit_restricted: false
      break_glass_eligible: true
      sensitive_data_reauth: true

  tecnico_enfermagem:
    profession: tecnico
    function: execucao_assistencial
    shift_role: plantonista
    encounter_role: executor
    access:
      clinical: 4
      operational: 3
    authorship: registro_assistencial
    validation: dupla_checagem
    signature: simples
    audit: auditado
    escalation: pode_escalar
    restrictions:
      patient_relationship_required: true
      unit_restricted: true
      break_glass_eligible: false
      sensitive_data_reauth: true

  higienizacao:
    profession: operacional
    function: limpeza_hospitalar
    shift_role: rotativo
    encounter_role: nenhum
    access:
      clinical: 0
      operational: 3
    authorship: registro_operacional
    validation: nenhum
    signature: simples
    audit: auditado
    escalation: pode_escalar
    restrictions:
      patient_relationship_required: false
      unit_restricted: true
      break_glass_eligible: false
      sensitive_data_reauth: false

  maqueiro:
    profession: operacional
    function: transporte_interno
    shift_role: rotativo
    encounter_role: apoio
    access:
      clinical: 0
      operational: 3
    authorship: registro_operacional
    validation: nenhum
    signature: simples
    audit: auditado
    escalation: pode_escalar
    restrictions:
      patient_relationship_required: false
      unit_restricted: false
      break_glass_eligible: false
      sensitive_data_reauth: false

  qualidade:
    profession: especialista
    function: gestao_qualidade
    shift_role: diarista
    encounter_role: nenhum
    access:
      clinical: 8
      operational: 8
    authorship: parecer
    validation: validacao_clinica
    signature: digital
    audit: auditor_total
    escalation: recebe_escalacao
    restrictions:
      patient_relationship_required: false
      unit_restricted: false
      break_glass_eligible: false
      sensitive_data_reauth: true

  direcao:
    profession: administrativo
    function: direcao_institucional
    shift_role: administrativo
    encounter_role: nenhum
    access:
      clinical: 10
      operational: 10
    authorship: registro_operacional
    validation: aprovacao
    signature: responsavel
    audit: auditor_total
    escalation: escalacao_institucional
    restrictions:
      patient_relationship_required: false
      unit_restricted: false
      break_glass_eligible: true
      sensitive_data_reauth: true
```

---

## 6. Validacao de Acesso em Runtime

```typescript
interface AccessDecision {
  allowed: boolean;
  reason: string;
  conditions?: string[];
  audit_required: boolean;
  reauth_required: boolean;
  break_glass?: boolean;
  data_masking?: MaskingRule[];
  expiry?: string;
}

interface MaskingRule {
  field: string;
  mask_type: 'full' | 'partial' | 'hash' | 'redact';
  visible_chars?: number;
}

async function evaluateAccess(
  actor: RoleAccessProfile,
  target: AccessTarget,
  action: AccessAction,
  context: AccessContext,
): Promise<AccessDecision> {
  // 1. Verificar nivel de acesso base
  // 2. Verificar restricoes contextuais (unidade, relacionamento, turno)
  // 3. Aplicar regras de mascaramento
  // 4. Verificar necessidade de re-autenticacao
  // 5. Registrar decisao em AuditEvent
  // 6. Retornar decisao com condicoes
  throw new Error('Implementation required');
}
```

---

## 7. Resumo da Matriz

| Grupo                | Qtd Papeis | Acesso Clinico Max | Acesso Operacional Max | Reporta Trabalho |
| -------------------- | ---------- | ------------------ | ---------------------- | ---------------- |
| Corpo Medico         | 10         | 6 (total)          | 5 (amplo)              | SIM              |
| Enfermagem           | 4          | 5 (amplo)          | 5 (amplo)              | SIM              |
| Multiprofissional    | 7          | 4 (restrito)       | 3 (operacional)        | SIM              |
| Diagnostico          | 4          | 5 (amplo)          | 3 (operacional)        | SIM              |
| Recepcao/Cadastro    | 4          | 2 (basico)         | 5 (amplo)              | SIM              |
| Logistica/Apoio      | 8          | 0 (nenhum)         | 4 (restrito)           | SIM              |
| Farmacia/Nutricao Op | 2          | 1 (minimo)         | 4 (restrito)           | SIM              |
| Admin/Gestao         | 8          | 10 (direcao)       | 10 (direcao)           | SIM              |
| **Total**            | **47**     | -                  | -                      | **TODOS**        |

**Principio inviolavel:** Todo papel reporta trabalho. Acesso clinico e proporcional a necessidade assistencial. Nenhum acesso sem justificativa e rastreabilidade.
