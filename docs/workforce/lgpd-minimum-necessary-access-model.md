# Modelo de Acesso Minimo Necessario — LGPD — Velya Platform

> Conformidade LGPD aplicada ao contexto hospitalar: minimizacao de dados, mascaramento, consentimento, break-glass, retencao, direitos do titular e responsabilidades do DPO.

---

## 1. Principio Fundamental

**Cada profissional acessa APENAS os dados estritamente necessarios para executar sua funcao. Reportar trabalho nao requer acesso a dados clinicos. Acesso clinico e proporcional a relacao assistencial.**

---

## 2. Base Legal LGPD para Saude

### 2.1 Artigos Relevantes e Mapeamento no Sistema

| Artigo LGPD | Tema | Implementacao no Velya |
|---|---|---|
| Art. 6, I | Finalidade | Cada acesso tem finalidade explicita (assistencia, operacao, auditoria) |
| Art. 6, II | Adequacao | Dados coletados compativeis com a finalidade informada |
| Art. 6, III | Necessidade | **Principio do minimo necessario** — cada role ve apenas o que precisa |
| Art. 6, IV | Livre acesso | Paciente consulta seus dados via portal |
| Art. 6, V | Qualidade dos dados | Correcoes rastreadas, dados atualizados |
| Art. 6, VI | Transparencia | Log de acessos disponivel ao titular |
| Art. 6, VII | Seguranca | Criptografia, controle de acesso, audit trail |
| Art. 6, VIII | Prevencao | Deteccao de gaps, anomalias, break-glass com revisao |
| Art. 6, IX | Nao discriminacao | Acesso uniforme por funcao, sem discriminacao |
| Art. 6, X | Responsabilizacao | Provenance, AuditEvent, rastreabilidade completa |
| Art. 7, II | Cumprimento obrigacao legal | Base para reporte obrigatorio (vigilancia, SCIH, etc) |
| Art. 7, VII | Tutela da saude | Base legal primaria para tratamento de dados em saude |
| Art. 7, VIII | Interesse legitimo | Aplicavel a operacao hospitalar |
| Art. 11, II, f | Dados sensiveis - tutela saude | Permite tratamento de dados sensiveis sem consentimento para saude |
| Art. 16 | Eliminacao de dados | Regras de retencao e eliminacao com excecoes de saude |
| Art. 18 | Direitos do titular | Implementacao de cada direito |
| Art. 41 | DPO | Funcoes do DPO no contexto hospitalar |
| Art. 46 | Medidas de seguranca | Controles tecnicos e administrativos |
| Art. 48 | Comunicacao de incidentes | Processo de notificacao ANPD e titulares |

### 2.2 Base Legal por Tipo de Tratamento

```typescript
interface LegalBasisMapping {
  treatment_type: string;
  legal_basis: LGPDLegalBasis;
  requires_consent: boolean;
  data_category: DataCategory;
  retention_period: string;
}

enum LGPDLegalBasis {
  TUTELA_SAUDE = 'art_7_vii_tutela_saude',
  OBRIGACAO_LEGAL = 'art_7_ii_obrigacao_legal',
  INTERESSE_LEGITIMO = 'art_7_viii_interesse_legitimo',
  CONSENTIMENTO = 'art_7_i_consentimento',
  DADOS_SENSIVEIS_SAUDE = 'art_11_ii_f_tutela_saude',
  EXERCICIO_DIREITOS = 'art_7_vi_exercicio_direitos',
}

enum DataCategory {
  IDENTIFICACAO = 'identificacao',
  DEMOGRAFICO = 'demografico',
  CLINICO = 'clinico',
  SENSIVEL = 'sensivel',
  OPERACIONAL = 'operacional',
  FINANCEIRO = 'financeiro',
  LOCALIZACAO = 'localizacao',
  BIOMETRICO = 'biometrico',
}

const legalBasisMap: LegalBasisMapping[] = [
  {
    treatment_type: 'Assistencia clinica direta',
    legal_basis: LGPDLegalBasis.DADOS_SENSIVEIS_SAUDE,
    requires_consent: false,
    data_category: DataCategory.CLINICO,
    retention_period: '20 anos apos ultimo atendimento',
  },
  {
    treatment_type: 'Reporte de trabalho operacional',
    legal_basis: LGPDLegalBasis.INTERESSE_LEGITIMO,
    requires_consent: false,
    data_category: DataCategory.OPERACIONAL,
    retention_period: '5 anos',
  },
  {
    treatment_type: 'Faturamento e cobranca',
    legal_basis: LGPDLegalBasis.OBRIGACAO_LEGAL,
    requires_consent: false,
    data_category: DataCategory.FINANCEIRO,
    retention_period: '10 anos (fiscal)',
  },
  {
    treatment_type: 'Notificacao compulsoria',
    legal_basis: LGPDLegalBasis.OBRIGACAO_LEGAL,
    requires_consent: false,
    data_category: DataCategory.CLINICO,
    retention_period: 'Conforme legislacao sanitaria',
  },
  {
    treatment_type: 'Pesquisa clinica',
    legal_basis: LGPDLegalBasis.CONSENTIMENTO,
    requires_consent: true,
    data_category: DataCategory.SENSIVEL,
    retention_period: 'Conforme protocolo de pesquisa',
  },
  {
    treatment_type: 'Marketing/comunicacao institucional',
    legal_basis: LGPDLegalBasis.CONSENTIMENTO,
    requires_consent: true,
    data_category: DataCategory.IDENTIFICACAO,
    retention_period: 'Ate revogacao do consentimento',
  },
  {
    treatment_type: 'Auditoria interna',
    legal_basis: LGPDLegalBasis.INTERESSE_LEGITIMO,
    requires_consent: false,
    data_category: DataCategory.OPERACIONAL,
    retention_period: '5 anos',
  },
  {
    treatment_type: 'Controle de acesso biometrico',
    legal_basis: LGPDLegalBasis.DADOS_SENSIVEIS_SAUDE,
    requires_consent: true,
    data_category: DataCategory.BIOMETRICO,
    retention_period: 'Enquanto vinculo empregaticio ativo',
  },
];
```

---

## 3. Dados Visiveis por Papel (Minimo Necessario)

### 3.1 Matriz de Dados por Funcao

| Dado | Medico | Enfermeiro | Tecnico Enf. | Recepcao | Higienizacao | Maqueiro | Manutencao | TI | Faturamento | Auditoria |
|---|---|---|---|---|---|---|---|---|---|---|
| Nome paciente | Completo | Completo | Completo | Completo | NAO | Primeiro nome | NAO | NAO | Completo | Completo* |
| CPF | NAO | NAO | NAO | Mascarado | NAO | NAO | NAO | NAO | Completo | Mascarado |
| Data nascimento | Sim | Sim | Sim | Sim | NAO | NAO | NAO | NAO | Sim | Sim |
| Endereco | NAO | NAO | NAO | Sim | NAO | NAO | NAO | NAO | Sim | NAO |
| Telefone | NAO | NAO | NAO | Sim | NAO | NAO | NAO | NAO | Sim | NAO |
| Convenio | NAO | NAO | NAO | Sim | NAO | NAO | NAO | NAO | Completo | Sim |
| Numero leito | Sim | Sim | Sim | Sim | Sim | Sim | Sim (se local) | NAO | NAO | Sim |
| Diagnostico | Completo | Completo | Resumo | NAO | NAO | NAO | NAO | NAO | CID | Completo* |
| Prescricao | Completo | Completo | Seus itens | NAO | NAO | NAO | NAO | NAO | NAO | Completo* |
| Evolucao | Completo | Completo | NAO | NAO | NAO | NAO | NAO | NAO | NAO | Completo* |
| Resultado exame | Completo | Completo | Alertas | NAO | NAO | NAO | NAO | NAO | NAO | Completo* |
| Alergias | Completo | Completo | Sim | NAO | NAO | NAO | NAO | NAO | NAO | Sim |
| Sinais vitais | Completo | Completo | Completo | NAO | NAO | NAO | NAO | NAO | NAO | Completo* |
| Tipo isolamento | Sim | Sim | Sim | NAO | Sim (tipo) | Sim (restricoes) | NAO | NAO | NAO | Sim |
| Restricoes transporte | Sim | Sim | Sim | NAO | NAO | Sim | NAO | NAO | NAO | Sim |
| Dados financeiros | NAO | NAO | NAO | NAO | NAO | NAO | NAO | NAO | Completo | Sim |

\* Auditoria: acesso somente leitura, sem edicao, registrado em AuditEvent.

### 3.2 Regras de Mascaramento

```typescript
interface MaskingRule {
  field: string;
  data_category: DataCategory;
  rules: MaskingConfig[];
}

interface MaskingConfig {
  applies_to_roles: string[];
  mask_type: MaskType;
  visible_chars?: number;
  replacement?: string;
}

enum MaskType {
  FULL = 'full',             // Campo completamente oculto
  PARTIAL = 'partial',       // Exibe N caracteres
  HASH = 'hash',             // Exibe hash irreversivel
  REDACT = 'redact',         // Substitui por "[DADOS PROTEGIDOS]"
  FIRST_NAME = 'first_name', // Apenas primeiro nome
  INITIALS = 'initials',     // Apenas iniciais
}

const maskingRules: MaskingRule[] = [
  {
    field: 'cpf',
    data_category: DataCategory.IDENTIFICACAO,
    rules: [
      { applies_to_roles: ['recepcao', 'auditoria'], mask_type: MaskType.PARTIAL, visible_chars: 3 }, // ***.456.789-**
      { applies_to_roles: ['faturamento'], mask_type: MaskType.FULL }, // Visivel completo (necessidade legal)
      { applies_to_roles: ['*'], mask_type: MaskType.FULL },
    ],
  },
  {
    field: 'nome_paciente',
    data_category: DataCategory.IDENTIFICACAO,
    rules: [
      { applies_to_roles: ['maqueiro'], mask_type: MaskType.FIRST_NAME },
      { applies_to_roles: ['higienizacao', 'manutencao', 'ti'], mask_type: MaskType.FULL },
    ],
  },
  {
    field: 'diagnostico',
    data_category: DataCategory.CLINICO,
    rules: [
      { applies_to_roles: ['tecnico_enfermagem'], mask_type: MaskType.REDACT, replacement: '[Resumo disponivel]' },
      { applies_to_roles: ['faturamento'], mask_type: MaskType.PARTIAL }, // Apenas CID
      { applies_to_roles: ['recepcao', 'higienizacao', 'maqueiro', 'manutencao', 'ti', 'seguranca'], mask_type: MaskType.FULL },
    ],
  },
  {
    field: 'endereco',
    data_category: DataCategory.DEMOGRAFICO,
    rules: [
      { applies_to_roles: ['recepcao', 'faturamento'], mask_type: MaskType.FULL }, // Visivel
      { applies_to_roles: ['*'], mask_type: MaskType.FULL },
    ],
  },
  {
    field: 'telefone',
    data_category: DataCategory.DEMOGRAFICO,
    rules: [
      { applies_to_roles: ['recepcao', 'faturamento'], mask_type: MaskType.PARTIAL, visible_chars: 4 },
      { applies_to_roles: ['*'], mask_type: MaskType.FULL },
    ],
  },
];
```

---

## 4. Consentimento

### 4.1 Modelo de Consentimento

```typescript
interface ConsentRecord {
  consent_id: string;
  patient_id: string;
  consent_type: ConsentType;
  scope: ConsentScope;
  status: 'ativo' | 'revogado' | 'expirado' | 'pendente';
  granted_at?: string;
  revoked_at?: string;
  expires_at?: string;
  granted_by: string;                   // Paciente ou representante legal
  witness?: string;
  legal_basis: LGPDLegalBasis;
  version: number;
  document_id?: string;                 // ID do TCLE assinado
}

enum ConsentType {
  ASSISTENCIA_GERAL = 'assistencia_geral',       // Tratamento padrao (nao requer consentimento explicito - tutela saude)
  PROCEDIMENTO_ESPECIAL = 'procedimento_especial', // Cirurgia, procedimento invasivo
  PESQUISA = 'pesquisa',                          // Participacao em pesquisa
  COMPARTILHAMENTO = 'compartilhamento',          // Compartilhar com outro servico
  TELECONSULTA = 'teleconsulta',                  // Teleconsulta
  IMAGEM_VIDEO = 'imagem_video',                  // Uso de imagem/video
  DADOS_PARA_ENSINO = 'dados_para_ensino',        // Uso didatico
  BIOMETRIA = 'biometria',                        // Cadastro biometrico
}

enum ConsentScope {
  ESPECIFICO = 'especifico',             // Para um procedimento/pesquisa especifico
  GERAL = 'geral',                       // Para todo o atendimento
  CATEGORIZADO = 'categorizado',         // Para categorias de dados
}
```

### 4.2 Quando Consentimento NAO e Necessario (Art. 11, II, f)

| Situacao | Base Legal | Consentimento |
|---|---|---|
| Atendimento assistencial direto | Tutela da saude | NAO necessario |
| Emergencia/urgencia | Tutela da saude | NAO necessario |
| Prescricao e administracao medicamentos | Tutela da saude | NAO necessario |
| Exames diagnosticos de rotina | Tutela da saude | NAO necessario |
| Reporte de trabalho operacional | Interesse legitimo | NAO necessario |
| Auditoria interna | Interesse legitimo | NAO necessario |
| Notificacao compulsoria (vigilancia) | Obrigacao legal | NAO necessario |
| Faturamento | Obrigacao legal | NAO necessario |

### 4.3 Quando Consentimento E Necessario

| Situacao | Tipo | Como Obter |
|---|---|---|
| Pesquisa clinica | TCLE especifico | Documento assinado + testemunha |
| Compartilhamento com terceiros | Consentimento especifico | Formulario digital ou fisico |
| Teleconsulta | Consentimento para teleconsulta | Aceite digital |
| Uso de imagem/video para ensino | Consentimento imagem | Formulario assinado |
| Biometria de profissionais | Consentimento biometria | Termo no RH |

---

## 5. Break-Glass e Justificativa

### 5.1 Fluxo de Break-Glass LGPD-Compliant

```typescript
interface BreakGlassLGPDFlow {
  steps: [
    // 1. Profissional solicita break-glass
    {
      action: 'request';
      requires: ['justificativa_obrigatoria', 'motivo_clinico'];
      recorded: true;
    },
    // 2. Sistema concede acesso temporario
    {
      action: 'grant';
      max_duration_minutes: 60;
      scope: 'dados_do_paciente_especificado';
      audit_event_created: true;
      provenance_created: true;
    },
    // 3. DPO e auditoria notificados imediatamente
    {
      action: 'notify';
      targets: ['dpo', 'auditoria', 'gestor_unidade'];
      channel: ['dashboard', 'email'];
    },
    // 4. Todas as acoes durante break-glass sao registradas
    {
      action: 'monitor';
      all_actions_logged: true;
      enhanced_audit: true;
    },
    // 5. Revisao obrigatoria em 24h
    {
      action: 'review';
      deadline_hours: 24;
      reviewer: 'dpo_ou_auditor';
      outcomes: ['justificado', 'injustificado', 'inconclusivo'];
    },
    // 6. Se injustificado: processo disciplinar + notificacao ANPD (se aplicavel)
    {
      action: 'consequence';
      if_unjustified: ['processo_disciplinar', 'avaliar_notificacao_anpd'];
    },
  ];
}
```

---

## 6. Politicas de Retencao

### 6.1 Prazos por Tipo de Dado

| Tipo de Dado | Retencao Minima | Retencao Maxima | Base Legal | Eliminacao |
|---|---|---|---|---|
| Prontuario clinico | 20 anos apos ultimo atendimento | Indefinido (guarda permanente recomendada) | CFM 1821/2007 + LGPD | Sob autorizacao do CRM |
| Registros de enfermagem | 20 anos | Indefinido | Resolucao COFEN | Sob autorizacao COREN |
| Resultados laboratoriais | 5 anos (amostra) / 20 anos (resultado) | Indefinido | RDC Anvisa | Conforme Anvisa |
| Imagens diagnosticas | 20 anos | Indefinido | CFM 1821/2007 | Sob autorizacao CRM |
| Dados operacionais (trabalho) | 5 anos | 10 anos | LGPD + trabalhista | Anonimizacao apos prazo |
| Dados financeiros | 5 anos (fiscal) | 10 anos | Codigo Tributario | Eliminacao apos prazo |
| Logs de sessao/auditoria | 2 anos (hot) | 20 anos (cold) | LGPD Art. 46 | Anonimizacao apos prazo |
| Dados biometricos profissionais | Vinculo ativo + 1 ano | Vinculo + 5 anos | LGPD Art. 11 | Eliminacao obrigatoria |
| Consentimentos | Enquanto vigente + 5 anos | Indefinido | LGPD Art. 8 | Guarda permanente |
| Comunicacoes criticas | 20 anos | Indefinido | Seguranca paciente | Guarda permanente |

### 6.2 Processo de Eliminacao

```typescript
interface DataRetentionPolicy {
  data_type: string;
  retention_hot: string;                 // Armazenamento ativo
  retention_cold: string;                // Armazenamento frio
  retention_archive: string;             // Arquivo permanente
  elimination_method: EliminationMethod;
  requires_approval: string[];           // Quem aprova eliminacao
  exceptions: string[];                  // Excecoes a eliminacao
}

enum EliminationMethod {
  ANONIMIZACAO = 'anonimizacao',         // Remove identificadores, mantem dados anonimos
  PSEUDONIMIZACAO = 'pseudonimizacao',   // Substitui identificadores por pseudonimos
  EXCLUSAO_LOGICA = 'exclusao_logica',   // Marca como excluido, nao remove fisicamente
  EXCLUSAO_FISICA = 'exclusao_fisica',   // Remove fisicamente (irreversivel)
  NAO_ELIMINAVEL = 'nao_eliminavel',     // Dados que nao podem ser eliminados (saude)
}
```

---

## 7. Direitos do Titular (Art. 18)

### 7.1 Implementacao no Velya

| Direito LGPD | Art. 18 | Implementacao | Limitacoes em Saude |
|---|---|---|---|
| Confirmacao de tratamento | I | Portal do paciente: consulta de dados | Nenhuma |
| Acesso aos dados | II | Portal do paciente: download de dados | Notas tecnicas podem ser omitidas |
| Correcao | III | Solicitacao via portal/recepcao | Registros clinicos: correcao gera nova versao (nunca apaga) |
| Anonimizacao/bloqueio | IV | Avaliacao caso a caso pelo DPO | Dados de saude: geralmente inaplicavel (tutela saude) |
| Eliminacao | V | Avaliacao pelo DPO | **ALTAMENTE RESTRITO** em saude: prontuario tem retencao legal de 20 anos |
| Compartilhamento | VI | Log de compartilhamentos disponivel | Compartilhamentos por obrigacao legal nao requerem ciencia |
| Revogacao consentimento | VIII | Portal do paciente: revogacao | Nao afeta tratamentos ja realizados; nao se aplica a tutela saude |
| Revisao de decisao automatizada | IX | Workflow de revisao manual | Classificacao de risco pode ser revisada |
| Oposicao | X | Canal no portal | Avaliacao pelo DPO; geralmente inaplicavel em saude |

### 7.2 Fluxo de Atendimento a Direitos

```typescript
interface TitularRightsRequest {
  request_id: string;
  patient_id: string;
  right_type: TitularRight;
  description: string;
  requested_at: string;
  requested_via: 'portal' | 'recepcao' | 'email' | 'oficio';

  // Processamento
  assigned_to: string;                   // DPO ou responsavel
  status: 'recebido' | 'em_analise' | 'aprovado' | 'negado' | 'concluido' | 'parcialmente_atendido';
  response_deadline: string;             // 15 dias uteis (Art. 18, §5)
  response_at?: string;
  response_description?: string;
  denial_reason?: string;               // Se negado: base legal
  actions_taken?: string[];

  // Auditoria
  provenance_id: string;
  audit_event_id: string;
}

enum TitularRight {
  CONFIRMACAO = 'confirmacao',
  ACESSO = 'acesso',
  CORRECAO = 'correcao',
  ANONIMIZACAO = 'anonimizacao',
  ELIMINACAO = 'eliminacao',
  PORTABILIDADE = 'portabilidade',
  COMPARTILHAMENTO_INFO = 'compartilhamento_info',
  REVOGACAO_CONSENTIMENTO = 'revogacao_consentimento',
  REVISAO_DECISAO = 'revisao_decisao',
  OPOSICAO = 'oposicao',
}
```

---

## 8. Responsabilidades do DPO

### 8.1 Funcoes no Contexto Hospitalar

```typescript
interface DPOResponsibilities {
  operational: [
    'Revisar break-glass em 24h',
    'Responder solicitacoes de titulares em 15 dias uteis',
    'Avaliar incidentes de seguranca em 24h',
    'Validar novas integracoes que envolvam dados pessoais',
    'Auditar acessos sensiveis mensalmente',
    'Manter RIPD (Relatorio de Impacto) atualizado',
    'Treinar equipes sobre LGPD anualmente',
    'Responder a ANPD em prazos legais',
  ];

  periodic: [
    { task: 'Revisao de break-glass', frequency: 'diaria' },
    { task: 'Auditoria de acessos sensiveis', frequency: 'semanal' },
    { task: 'Relatorio de conformidade', frequency: 'mensal' },
    { task: 'RIPD atualizado', frequency: 'semestral' },
    { task: 'Treinamento LGPD', frequency: 'anual' },
    { task: 'Revisao de politicas de retencao', frequency: 'anual' },
    { task: 'Teste de processo de eliminacao', frequency: 'anual' },
  ];

  incident_response: {
    notification_anpd_deadline: '2 dias uteis (Art. 48)';
    notification_titular_deadline: 'prazo razoavel';
    requires: [
      'Descricao do incidente',
      'Dados afetados',
      'Titulares afetados',
      'Medidas tomadas',
      'Medidas para mitigar danos',
    ];
  };
}
```

---

## 9. Trilha de Auditoria LGPD

### 9.1 Eventos Auditados para LGPD

```typescript
interface LGPDAuditEvent {
  event_id: string;
  event_type: LGPDAuditEventType;
  timestamp: string;
  actor_id: string;
  patient_id?: string;
  data_category: DataCategory;
  legal_basis: LGPDLegalBasis;
  justification?: string;
  details: Record<string, unknown>;
  provenance_id: string;
}

enum LGPDAuditEventType {
  // Acesso
  ACESSO_DADOS_PESSOAIS = 'acesso_dados_pessoais',
  ACESSO_DADOS_SENSIVEIS = 'acesso_dados_sensiveis',
  ACESSO_BREAK_GLASS = 'acesso_break_glass',

  // Compartilhamento
  COMPARTILHAMENTO_INTERNO = 'compartilhamento_interno',
  COMPARTILHAMENTO_EXTERNO = 'compartilhamento_externo',
  EXPORTACAO = 'exportacao',
  IMPRESSAO = 'impressao',

  // Modificacao
  CORRECAO_DADOS = 'correcao_dados',
  ATUALIZACAO_CADASTRO = 'atualizacao_cadastro',

  // Eliminacao
  ANONIMIZACAO = 'anonimizacao',
  EXCLUSAO_LOGICA = 'exclusao_logica',
  EXCLUSAO_FISICA = 'exclusao_fisica',

  // Consentimento
  CONSENTIMENTO_OBTIDO = 'consentimento_obtido',
  CONSENTIMENTO_REVOGADO = 'consentimento_revogado',

  // Direitos do titular
  SOLICITACAO_TITULAR = 'solicitacao_titular',
  RESPOSTA_TITULAR = 'resposta_titular',

  // Incidentes
  INCIDENTE_SEGURANCA = 'incidente_seguranca',
  NOTIFICACAO_ANPD = 'notificacao_anpd',
  NOTIFICACAO_TITULAR = 'notificacao_titular',
}
```

---

## 10. Configuracao YAML

```yaml
# lgpd-config.yaml
lgpd:
  dpo:
    name: "Responsavel DPO"
    email: "dpo@hospital-velya.com.br"
    department: "Juridico/Compliance"

  retention:
    default_hot_storage: "5y"
    default_cold_storage: "20y"
    prontuario: "20y_after_last_encounter"
    financial: "10y"
    operational: "5y"
    biometric: "employment_plus_1y"

  masking:
    enabled: true
    default_mask: "FULL"
    cpf_visible_chars: 3
    phone_visible_chars: 4

  break_glass:
    max_duration_minutes: 60
    review_deadline_hours: 24
    notification_immediate: true
    notification_targets:
      - dpo
      - auditoria
      - gestor_unidade

  titular_rights:
    response_deadline_business_days: 15
    portal_enabled: true
    auto_confirm_access: false
    elimination_requires_dpo_approval: true
    elimination_healthcare_exception: true

  incident:
    anpd_notification_deadline_business_days: 2
    titular_notification_required: true
    requires_ripd: true

  consent:
    digital_consent_enabled: true
    witness_required_for: ["pesquisa", "imagem_video"]
    revocation_channel: ["portal", "recepcao", "email"]

  audit:
    all_patient_data_access_logged: true
    sensitive_data_enhanced_audit: true
    break_glass_enhanced_audit: true
    export_audit: true
    print_audit: true
    retention_audit_logs: "20y"
```

---

## 11. PostgreSQL Schema LGPD

```sql
CREATE TABLE lgpd_consent_records (
    consent_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL,
    consent_type        TEXT NOT NULL,
    scope               TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pendente',
    granted_at          TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    granted_by          UUID NOT NULL,
    witness_id          UUID,
    legal_basis         TEXT NOT NULL,
    version             INTEGER NOT NULL DEFAULT 1,
    document_id         UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lgpd_titular_requests (
    request_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL,
    right_type          TEXT NOT NULL,
    description         TEXT NOT NULL,
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    requested_via       TEXT NOT NULL,
    assigned_to         UUID,
    status              TEXT NOT NULL DEFAULT 'recebido',
    response_deadline   TIMESTAMPTZ NOT NULL,
    response_at         TIMESTAMPTZ,
    response_description TEXT,
    denial_reason       TEXT,
    actions_taken       TEXT[] DEFAULT '{}',
    provenance_id       TEXT,
    audit_event_id      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lgpd_audit_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type          TEXT NOT NULL,
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id            UUID NOT NULL,
    patient_id          UUID,
    data_category       TEXT NOT NULL,
    legal_basis         TEXT NOT NULL,
    justification       TEXT,
    details             JSONB DEFAULT '{}',
    provenance_id       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_consent_patient ON lgpd_consent_records(patient_id, status);
CREATE INDEX idx_consent_active ON lgpd_consent_records(status) WHERE status = 'ativo';
CREATE INDEX idx_titular_pending ON lgpd_titular_requests(status, response_deadline)
  WHERE status IN ('recebido', 'em_analise');
CREATE INDEX idx_lgpd_audit_patient ON lgpd_audit_events(patient_id, timestamp DESC);
CREATE INDEX idx_lgpd_audit_type ON lgpd_audit_events(event_type, timestamp DESC);
CREATE INDEX idx_lgpd_audit_actor ON lgpd_audit_events(actor_id, timestamp DESC);
```

---

## 12. Metricas LGPD

```yaml
metrics:
  - name: velya_lgpd_titular_requests_total
    type: counter
    labels: [right_type, status]
    help: "Total de solicitacoes de titulares"

  - name: velya_lgpd_titular_response_time_days
    type: histogram
    labels: [right_type]
    buckets: [1, 3, 5, 7, 10, 15, 20, 30]
    help: "Tempo de resposta a titular em dias uteis"

  - name: velya_lgpd_consent_active
    type: gauge
    labels: [consent_type]
    help: "Consentimentos ativos"

  - name: velya_lgpd_breakglass_pending_review
    type: gauge
    help: "Break-glass pendentes de revisao DPO"

  - name: velya_lgpd_data_access_by_category
    type: counter
    labels: [data_category, legal_basis, role]
    help: "Acessos a dados por categoria e base legal"

  - name: velya_lgpd_incidents_total
    type: counter
    labels: [severity, notified_anpd]
    help: "Total de incidentes de seguranca de dados"
```

---

## 13. Resumo

O modelo LGPD de acesso minimo necessario garante:

1. **Minimizacao de dados** — Cada papel ve apenas o necessario para sua funcao.
2. **Mascaramento automatico** — CPF, nome, diagnostico mascarados por role.
3. **Base legal mapeada** — Cada tratamento tem base legal LGPD explicita.
4. **Consentimento quando necessario** — Pesquisa, imagem, compartilhamento.
5. **Break-glass controlado** — Justificativa + revisao DPO em 24h.
6. **Retencao conforme legislacao** — 20 anos para prontuario, 5-10 para operacional.
7. **Direitos do titular implementados** — Portal, prazos, fluxos definidos.
8. **DPO com responsabilidades claras** — Diarias, semanais, mensais, anuais.
9. **Trilha de auditoria LGPD** — Todos os acessos a dados pessoais registrados.
10. **Eliminacao restrita em saude** — Prontuario nao pode ser eliminado por 20 anos.
