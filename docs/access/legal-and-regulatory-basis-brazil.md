# Base Legal e Regulatoria - Controle de Acesso Hospitalar no Brasil

> Versao: 1.0 | Ultima atualizacao: 2026-04-08
> Classificacao: Documento Interno - Compliance e Regulatorio

---

## 1. Visao Geral

Este documento mapeia a legislacao brasileira e regulamentacoes dos conselhos
profissionais de saude as decisoes de controle de acesso implementadas na
Velya Platform. Cada regra de autorizacao do sistema e rastreavel a um
fundamento legal especifico.

---

## 2. LGPD - Lei Geral de Protecao de Dados (Lei 13.709/2018)

### 2.1 Artigos Fundamentais para Dados de Saude

| Artigo        | Conteudo Resumido                                          | Impacto no Controle de Acesso                                   |
| ------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Art. 5o, I    | Dado pessoal: informacao relacionada a pessoa identificada | Todo dado no prontuario e dado pessoal                          |
| Art. 5o, II   | Dado pessoal sensivel: dado sobre saude                    | Dados clinicos exigem protecao redobrada (Classes C-E)          |
| Art. 6o, I    | Principio da finalidade                                    | Cada acesso vinculado a proposito declarado                     |
| Art. 6o, II   | Principio da adequacao                                     | Tipo de dado acessado deve ser compativel com a funcao          |
| Art. 6o, III  | Principio da necessidade                                   | Minimizacao de dados: so campos necessarios retornados          |
| Art. 6o, IV   | Principio do livre acesso                                  | Paciente pode consultar quem acessou seus dados                 |
| Art. 6o, V    | Principio da qualidade dos dados                           | Dados devem ser exatos e atualizados                            |
| Art. 6o, VI   | Principio da transparencia                                 | Portal do paciente com log de acessos                           |
| Art. 6o, VII  | Principio da seguranca                                     | Deny by default, criptografia, controle de acesso granular      |
| Art. 6o, VIII | Principio da prevencao                                     | Monitoramento proativo, deteccao de anomalias                   |
| Art. 6o, IX   | Principio da nao discriminacao                             | Acesso a dados sensiveis (HIV, psiq.) com protecao extra        |
| Art. 6o, X    | Principio da responsabilizacao                             | Auditoria completa, rastreabilidade de decisoes                 |
| Art. 7o, I    | Consentimento do titular                                   | Base para pesquisa, compartilhamento com terceiros              |
| Art. 7o, II   | Obrigacao legal ou regulatoria                             | Base para notificacoes compulsorias, ANVISA                     |
| Art. 7o, VI   | Exercicio regular de direitos                              | Base para acesso juridico/defensivo                             |
| Art. 7o, VII  | Protecao da vida                                           | Base legal para break-glass                                     |
| Art. 7o, VIII | Tutela da saude por profissional de saude                  | Base primaria para acesso clinico                               |
| Art. 11       | Tratamento de dados pessoais sensiveis                     | Saude = dado sensivel, bases legais restritas                   |
| Art. 11, §4o  | Proibicao de uso para vantagem economica                   | Dados clinicos nao podem ser usados para marketing              |
| Art. 18       | Direitos do titular                                        | Acesso, correcao, portabilidade, informacao de compartilhamento |
| Art. 46       | Seguranca e sigilo dos dados                               | Medidas tecnicas e administrativas de protecao                  |
| Art. 48       | Comunicacao de incidente de seguranca                      | Notificacao a ANPD e titulares em caso de vazamento             |
| Art. 50       | Boas praticas e governanca                                 | Programa de governanca em privacidade                           |

### 2.2 Bases Legais Aplicaveis no Contexto Hospitalar

```
+------------------------------------------------------------------+
|                    ACESSO A DADOS DE SAUDE                        |
|                                                                    |
|  Assistencia Clinica Direta?                                       |
|  SIM --> Art. 7o, VIII + Art. 11, II, f (Tutela da Saude)         |
|  NAO --> |                                                         |
|          |                                                         |
|  Emergencia com risco de vida?                                     |
|  SIM --> Art. 7o, VII (Protecao da Vida) --> Break-glass          |
|  NAO --> |                                                         |
|          |                                                         |
|  Obrigacao legal (notificacao, ANVISA)?                            |
|  SIM --> Art. 7o, II (Obrigacao Legal)                            |
|  NAO --> |                                                         |
|          |                                                         |
|  Defesa judicial/administrativa?                                   |
|  SIM --> Art. 7o, VI (Exercicio Regular de Direitos)              |
|  NAO --> |                                                         |
|          |                                                         |
|  Pesquisa / Ensino / Terceiros?                                    |
|  SIM --> Art. 7o, I + Art. 11, I (Consentimento) --> Obrigatorio  |
|  NAO --> ACESSO NEGADO                                            |
+------------------------------------------------------------------+
```

### 2.3 Implementacao no Sistema

```yaml
# Mapeamento base legal -> controle de acesso
lgpd_controls:
  art_6_iii_necessidade:
    implementation:
      - field_level_access_control
      - data_class_filtering
      - dynamic_field_projection
    validation: 'Cada role tem lista explicita de campos permitidos'

  art_6_vii_seguranca:
    implementation:
      - deny_by_default
      - mfa_obrigatorio_acesso_clinico
      - criptografia_em_repouso_aes256
      - criptografia_em_transito_tls13
      - session_timeout_15min_inatividade
    validation: 'Testes de penetracao trimestrais'

  art_7_viii_tutela_saude:
    implementation:
      - rebac_relationship_required
      - relationship_types: [attending, nursing_team, multidisciplinary]
      - auto_expires_on_discharge
    validation: 'Relacao profissional-paciente verificada a cada acesso'

  art_11_dados_sensiveis:
    implementation:
      - data_class_d_and_e_elevated_controls
      - step_up_auth_for_sensitive_data
      - audit_level_maxima
      - encryption_at_field_level
    validation: 'Dados sensiveis criptografados individualmente'

  art_18_direitos_titular:
    implementation:
      - patient_portal_access_log
      - data_export_api
      - consent_management_module
      - right_to_information_dashboard
    validation: 'Paciente visualiza historico de acessos no portal'

  art_48_incidente:
    implementation:
      - breach_detection_automated
      - notification_pipeline_anpd
      - notification_pipeline_titulares
      - incident_response_playbook
    validation: 'Simulacro de incidente semestral'
```

---

## 3. Lei do Ato Medico (Lei 12.842/2013)

### 3.1 Atos Privativos do Medico

A Lei 12.842/2013 define atos que so podem ser executados por medicos, impactando
diretamente as permissoes do sistema.

| Artigo       | Ato Privativo                                 | Controle no Sistema                                                         |
| ------------ | --------------------------------------------- | --------------------------------------------------------------------------- |
| Art. 4o, I   | Indicacao e execucao de intervencao cirurgica | Apenas role `medical_staff_*` pode registrar procedimento cirurgico         |
| Art. 4o, II  | Indicacao de internacao e alta hospitalar     | `approve_discharge` restrito a `medical_staff_attending`                    |
| Art. 4o, III | Formulacao de diagnostico nosologico          | Campo `diagnosis` write-only para roles medicos                             |
| Art. 4o, IV  | Prescricao terapeutica                        | `prescribe_medication` restrito a roles medicos + dentistas (para sua area) |
| Art. 4o, V   | Indicacao de procedimento invasivo            | Registros de procedimentos invasivos restritos a medicos                    |
| Art. 4o, IX  | Atestados medicos                             | Emissao de atestado restrita a `medical_staff_*`                            |
| Art. 4o, XII | Determinacao de prognostico                   | Campo `prognosis` exclusivo de roles medicos                                |

### 3.2 Excecoes Previstas em Lei

| Excecao                                           | Base Legal             | Implementacao                                 |
| ------------------------------------------------- | ---------------------- | --------------------------------------------- |
| Atendimento de emergencia sem medico disponivel   | Art. 4o, §6o           | Break-glass para enfermeiro com justificativa |
| Prescricao de enfermagem (cuidados de enfermagem) | Lei 7.498/1986         | `create_nursing_prescription` para `nurse`    |
| Prescricao de dieta                               | Lei 8.234/1991         | `prescribe_diet` para `nutritionist`          |
| Solicitacao de exame por outros profissionais     | Regulamentacao propria | Dependente do tipo de exame e conselho        |

### 3.3 Politica de Acesso para Atos Medicos

```yaml
policy:
  id: 'medical-act-write-protection'
  description: 'Protege campos de atos privativos do medico'
  effect: DENY
  resource:
    type: patient_chart
    fields:
      - diagnosis
      - prognosis
      - medical_prescription
      - surgical_indication
      - discharge_order
      - medical_certificate
  action: [create, update]
  subject:
    role:
      not_in:
        - medical_staff_attending
        - medical_staff_on_call
        - clinical_director
  deny_reason: 'LEI_12842_2013_ATO_PRIVATIVO_MEDICO'
```

---

## 4. Lei do Exercicio da Enfermagem (Lei 7.498/1986 + Decreto 94.406/1987)

### 4.1 Hierarquia e Escopo de Atuacao

| Profissional           | Base Legal         | Escopo de Acesso                                             | Role no Sistema      |
| ---------------------- | ------------------ | ------------------------------------------------------------ | -------------------- |
| Enfermeiro (graduacao) | Lei 7.498, Art. 11 | Evolucao de enfermagem, prescricao de enfermagem, supervisao | `nurse`              |
| Tecnico de Enfermagem  | Lei 7.498, Art. 12 | Execucao de cuidados, anotacoes, medicacao sob supervisao    | `nursing_technician` |
| Auxiliar de Enfermagem | Lei 7.498, Art. 13 | Cuidados basicos, higiene, conforto, anotacoes simples       | `nursing_assistant`  |

### 4.2 Atos Privativos do Enfermeiro

| Ato (Lei 7.498, Art. 11)       | Permissao no Sistema                    | Negado para Tecnico/Auxiliar   |
| ------------------------------ | --------------------------------------- | ------------------------------ |
| Consulta de enfermagem         | `create_nursing_consultation`           | Sim                            |
| Prescricao de enfermagem       | `create_nursing_prescription`           | Sim                            |
| Evolucao de enfermagem         | `create_nursing_evolution`              | Sim (pode anotar, nao evoluir) |
| Cuidados de maior complexidade | `execute_complex_nursing_care`          | Sim                            |
| Supervisao de equipe           | `view_team_activities`, `approve_notes` | Sim                            |

### 4.3 Atos Permitidos ao Tecnico de Enfermagem

| Ato (Lei 7.498, Art. 12)                      | Permissao no Sistema               | Condicao                     |
| --------------------------------------------- | ---------------------------------- | ---------------------------- |
| Assistencia de enfermagem (exceto privativos) | `create_nursing_note`              | Sob supervisao do enfermeiro |
| Administracao de medicamentos                 | `record_medication_administration` | Conforme prescricao medica   |
| Verificacao de sinais vitais                  | `record_vitals`                    | Sem restricao                |
| Curativos simples                             | `record_simple_procedure`          | Sem restricao                |

### 4.4 Implementacao da Hierarquia

```typescript
// Hierarquia de enfermagem no RBAC
const nursingHierarchy = {
  nurse: {
    inherits: ['nursing_technician'],
    exclusive_permissions: [
      'create_nursing_consultation',
      'create_nursing_prescription',
      'create_nursing_evolution',
      'execute_complex_nursing_care',
      'approve_nursing_notes',
      'supervise_nursing_team',
    ],
    data_access_level: 5,
    council: 'COREN',
    credential: 'coren_enfermeiro',
  },
  nursing_technician: {
    inherits: ['nursing_assistant'],
    exclusive_permissions: [
      'create_nursing_note',
      'record_medication_administration',
      'record_vitals',
      'record_simple_procedure',
    ],
    data_access_level: 4,
    council: 'COREN',
    credential: 'coren_tecnico',
    requires_supervision: {
      supervisor_role: 'nurse',
      for_actions: ['record_medication_administration'],
    },
  },
  nursing_assistant: {
    inherits: [],
    exclusive_permissions: [
      'record_basic_care',
      'record_hygiene_comfort',
      'view_care_plan_summary',
    ],
    data_access_level: 4,
    council: 'COREN',
    credential: 'coren_auxiliar',
    requires_supervision: {
      supervisor_role: 'nurse',
      for_actions: ['record_basic_care'],
    },
  },
};
```

---

## 5. Resolucoes do CFM (Conselho Federal de Medicina)

### 5.1 Resolucoes Relevantes

| Resolucao      | Tema                                | Impacto no Controle de Acesso                          |
| -------------- | ----------------------------------- | ------------------------------------------------------ |
| CFM 1.638/2002 | Prontuario medico                   | Confidencialidade, guarda, acesso restrito             |
| CFM 1.821/2007 | Prontuario eletronico (PEP)         | Requisitos de seguranca, assinatura digital, auditoria |
| CFM 2.217/2018 | Codigo de Etica Medica              | Sigilo profissional (Arts. 73-79), justa causa         |
| CFM 2.218/2018 | Telemedicina (atualizada)           | Autenticacao para consulta remota, consentimento       |
| CFM 2.299/2021 | Prontuario eletronico - atualizacao | Certificado digital ICP-Brasil para assinatura         |
| CFM 1.931/2009 | Codigo de Etica Medica (anterior)   | Referencia historica para fundamentacao                |

### 5.2 CFM 1.821/2007 - Prontuario Eletronico

**Requisitos Obrigatorios e Implementacao:**

| Requisito CFM                  | Artigo  | Implementacao no Velya                               |
| ------------------------------ | ------- | ---------------------------------------------------- |
| Autenticacao do usuario        | Art. 2o | MFA obrigatorio, certificado digital opcional        |
| Auditoria de acessos           | Art. 3o | Log imutavel com blockchain hash chain               |
| Controle de acesso por perfil  | Art. 4o | RBAC + ABAC + ReBAC conforme documentacao            |
| Backup e recuperacao           | Art. 5o | Backup incremental diario, completo semanal          |
| Assinatura digital do registro | Art. 6o | Assinatura com certificado ICP-Brasil ou Gov.br      |
| Integridade dos dados          | Art. 7o | Hash por registro, validacao de integridade continua |
| Disponibilidade do sistema     | Art. 8o | SLA 99.9%, failover automatico                       |
| Tempo de retencao (20 anos)    | Art. 9o | Retencao configurada por classe de dado              |

### 5.3 CFM 2.217/2018 - Sigilo Medico no Sistema

```yaml
# Implementacao do sigilo medico (CEM Arts. 73-79)
sigilo_medico:
  principio: 'O medico guardara sigilo a respeito das informacoes de que detenha conhecimento'

  quebra_sigilo_permitida:
    - motivo: 'Dever legal (notificacao compulsoria)'
      base: 'CEM Art. 73, §2o + Lei 6.259/1975'
      controle: 'Flag automatica para doencas de notificacao'
      acesso_sistema: 'compliance_auditor pode visualizar notificacoes'

    - motivo: 'Justa causa'
      base: 'CEM Art. 73, §1o'
      controle: 'Requer justificativa documentada + aprovacao clinical_director'
      acesso_sistema: 'Workflow de aprovacao com dual authorization'

    - motivo: 'Consentimento do paciente'
      base: 'CEM Art. 73'
      controle: 'Registro de consentimento no modulo de consent management'
      acesso_sistema: 'Liberacao condicionada a consent_id valido'

    - motivo: 'Protecao de menor em risco'
      base: 'ECA + CEM'
      controle: 'Notificacao automatica ao Conselho Tutelar'
      acesso_sistema: 'social_worker + compliance_auditor'
```

---

## 6. Resolucoes do COFEN (Conselho Federal de Enfermagem)

### 6.1 Resolucoes Relevantes

| Resolucao      | Tema                                              | Impacto                                        |
| -------------- | ------------------------------------------------- | ---------------------------------------------- |
| COFEN 429/2012 | Registro de acoes profissionais de enfermagem     | Anotacao e evolucao de enfermagem obrigatorias |
| COFEN 358/2009 | Sistematizacao da Assistencia de Enfermagem (SAE) | Processo de enfermagem completo                |
| COFEN 564/2017 | Codigo de Etica de Enfermagem                     | Sigilo, responsabilidade, escopo de atuacao    |
| COFEN 311/2007 | Codigo de Etica (anterior)                        | Referencia historica                           |
| COFEN 487/2015 | Veto a prescricao de medicamentos por enfermeiros | Limita `prescribe_medication` a medicos        |

### 6.2 COFEN 429/2012 - Registros de Enfermagem

| Requisito                          | Implementacao                                              |
| ---------------------------------- | ---------------------------------------------------------- |
| Registro legivel, completo, datado | Formulario estruturado com campos obrigatorios             |
| Identificacao do profissional      | Assinatura digital + COREN vinculado ao registro           |
| Sequencia cronologica              | Timestamp imutavel no momento da criacao                   |
| Sem rasuras ou espacos em branco   | Versionamento de registros (append-only, sem delete)       |
| Evolucao privativa do enfermeiro   | `create_nursing_evolution` bloqueado para tecnico/auxiliar |

---

## 7. ANS - Agencia Nacional de Saude Suplementar

### 7.1 Regulamentacoes Relevantes

| Normativo   | Tema                                       | Impacto no Controle de Acesso        |
| ----------- | ------------------------------------------ | ------------------------------------ |
| RN 305/2012 | Padrao TISS (troca de informacao em saude) | Formato de guias, autorizacoes       |
| RN 501/2022 | Padrao TISS atualizado                     | Interoperabilidade com operadoras    |
| RN 452/2020 | Telessaude                                 | Autenticacao para autorizacao remota |
| IN 97/2022  | Envio de producao                          | Acesso ao modulo de faturamento      |

### 7.2 Controle de Acesso para TISS

```yaml
tiss_access_control:
  envio_producao:
    roles_permitidos: [billing_authorization]
    data_class: B # Dados administrativos
    dados_clinicos: 'Apenas CID e codigos de procedimento (mascarados)'
    audit: elevada

  autorizacao_procedimento:
    roles_permitidos: [billing_authorization, medical_staff_attending]
    workflow:
      - medico_solicita: 'medical_staff_attending cria solicitacao'
      - faturamento_envia: 'billing_authorization envia a operadora'
      - resposta_registrada: 'billing_authorization registra resposta'
    separacao: 'Medico nao acessa dados de faturamento; faturamento nao acessa evolucoes'

  guia_internacao:
    dados_minimos:
      - nome_paciente
      - carteirinha
      - cid_principal
      - procedimento_solicitado
      - justificativa_clinica_resumida
    dados_nao_incluidos:
      - historico_completo
      - resultados_de_exames
      - evolucoes_medicas
      - dados_sensiveis_classe_e
```

---

## 8. Comparativo com HIPAA (Referencia Internacional)

Para organizacoes que buscam conformidade dupla (Brasil + EUA) ou que atendem
pacientes internacionais, este comparativo mapeia os controles equivalentes.

| Requisito HIPAA                     | Equivalente LGPD/Brasil             | Controle Velya                           |
| ----------------------------------- | ----------------------------------- | ---------------------------------------- |
| Minimum Necessary Rule (§164.502)   | LGPD Art. 6o, III (Necessidade)     | Field-level access, data class filtering |
| Access Controls (§164.312(a))       | LGPD Art. 46 (Seguranca)            | RBAC + ABAC + ReBAC + MFA                |
| Audit Controls (§164.312(b))        | LGPD Art. 6o, X (Responsabilizacao) | Audit log imutavel, SIEM                 |
| Integrity Controls (§164.312(c))    | LGPD Art. 6o, V (Qualidade)         | Hash chain, assinatura digital           |
| Transmission Security (§164.312(e)) | LGPD Art. 46                        | TLS 1.3, mTLS entre servicos             |
| PHI Disclosure Accounting           | LGPD Art. 18 (Direitos do Titular)  | Patient portal access log                |
| Business Associate Agreement        | LGPD Art. 39 (Operador)             | Contratos com terceiros, DPA             |
| Breach Notification (§164.408)      | LGPD Art. 48                        | Pipeline de notificacao automatizado     |
| Right of Access (§164.524)          | LGPD Art. 18, II                    | API de exportacao, portal do paciente    |
| Emergency Access (Break Glass)      | LGPD Art. 7o, VII                   | Break-glass com auditoria total          |

### 8.1 Diferencas Importantes

| Aspecto               | HIPAA                                   | LGPD/Brasil                                      |
| --------------------- | --------------------------------------- | ------------------------------------------------ |
| Consentimento         | Nao exigido para tratamento (TPO)       | Nao exigido para tutela da saude                 |
| Dados sensiveis       | Toda PHI e sensivel                     | Saude e subcategoria de dado sensivel            |
| Autoridade reguladora | OCR (HHS)                               | ANPD                                             |
| Multas                | Ate USD 1.9M por categoria/ano          | Ate 2% faturamento, max R$50M por infracao       |
| Retencao              | 6 anos (registros HIPAA)                | 20 anos (prontuario medico - CFM)                |
| Break-glass           | Permitido, sem regulamentacao detalhada | Art. 7o, VII com necessidade de justificativa    |
| Certificacao          | Nao ha certificacao oficial             | Nao ha certificacao oficial (em desenvolvimento) |

---

## 9. Tabela Consolidada: Lei -> Requisito -> Implementacao

| #   | Lei / Regulamento   | Artigo / Resolucao | Requisito                              | Implementacao no Velya                            | Modulo         |
| --- | ------------------- | ------------------ | -------------------------------------- | ------------------------------------------------- | -------------- |
| 1   | LGPD                | Art. 6o, I         | Finalidade declarada                   | Campo `purpose` obrigatorio em cada acesso        | AuthZ Engine   |
| 2   | LGPD                | Art. 6o, III       | Necessidade / Minimizacao              | Field-level projection por role                   | PEP            |
| 3   | LGPD                | Art. 6o, VII       | Seguranca                              | Deny by default, MFA, criptografia                | AuthN + AuthZ  |
| 4   | LGPD                | Art. 7o, VII       | Protecao da vida                       | Break-glass protocol                              | Break-Glass    |
| 5   | LGPD                | Art. 7o, VIII      | Tutela da saude                        | ReBAC: relacao profissional-paciente              | ReBAC Engine   |
| 6   | LGPD                | Art. 11            | Dados sensiveis                        | Classes D e E com controles elevados              | Data Class     |
| 7   | LGPD                | Art. 18            | Direitos do titular                    | Portal do paciente, exportacao                    | Patient Portal |
| 8   | LGPD                | Art. 46            | Medidas de seguranca                   | Arquitetura completa de AuthZ                     | Plataforma     |
| 9   | LGPD                | Art. 48            | Notificacao de incidente               | Pipeline automatizado ANPD                        | Incident Mgmt  |
| 10  | Lei 12.842/2013     | Art. 4o            | Atos privativos do medico              | Write-lock em campos medicos para nao-medicos     | RBAC           |
| 11  | Lei 12.842/2013     | Art. 4o, IV        | Prescricao terapeutica privativa       | `prescribe_medication` restrito a medicos         | RBAC           |
| 12  | Lei 7.498/1986      | Art. 11            | Atos privativos do enfermeiro          | Evolucao/prescricao de enf. restrita              | RBAC           |
| 13  | Lei 7.498/1986      | Art. 12            | Escopo do tecnico de enfermagem        | Permissoes limitadas, supervisao obrigatoria      | RBAC + ABAC    |
| 14  | Lei 7.498/1986      | Art. 13            | Escopo do auxiliar de enfermagem       | Permissoes basicas, supervisao obrigatoria        | RBAC + ABAC    |
| 15  | Decreto 94.406/1987 | Art. 8-11          | Regulamentacao detalhada de enfermagem | Hierarquia nurse > technician > assistant         | RBAC           |
| 16  | CFM 1.821/2007      | Art. 2-9           | Requisitos de PEP                      | Seguranca, auditoria, assinatura digital          | Plataforma     |
| 17  | CFM 2.217/2018      | Art. 73-79         | Sigilo medico                          | Controles de confidencialidade, quebra controlada | AuthZ + Audit  |
| 18  | CFM 2.299/2021      | -                  | Certificado digital para PEP           | ICP-Brasil ou Gov.br para assinatura              | Digital Sign   |
| 19  | COFEN 429/2012      | -                  | Registro de enfermagem obrigatorio     | Campos obrigatorios no formulario                 | Clinical App   |
| 20  | COFEN 358/2009      | -                  | SAE obrigatoria                        | Workflow de processo de enfermagem                | Clinical App   |
| 21  | COFEN 564/2017      | Art. 52-62         | Etica e sigilo de enfermagem           | Acesso restrito por escopo profissional           | AuthZ          |
| 22  | ANS RN 305/2012     | -                  | Padrao TISS                            | Integracao com operadoras via TISS                | Billing        |
| 23  | Lei 8.234/1991      | Art. 3o, VIII      | Prescricao de dieta pelo nutricionista | `prescribe_diet` para `nutritionist`              | RBAC           |
| 24  | Lei 6.316/1975      | -                  | Regulamentacao da fisioterapia         | Escopo de acesso do fisioterapeuta                | RBAC           |
| 25  | Lei 4.119/1962      | -                  | Regulamentacao da psicologia           | Dados psicologicos em Classe E                    | Data Class     |

---

## 10. Penalidades e Riscos de Nao-Conformidade

### 10.1 Penalidades LGPD (Art. 52)

| Sancao                      | Valor / Descricao                             | Cenario de Risco no Hospital                     |
| --------------------------- | --------------------------------------------- | ------------------------------------------------ |
| Advertencia                 | Com indicacao de prazo para adocao de medidas | Falha em implementar controle de acesso adequado |
| Multa simples               | Ate 2% do faturamento, max R$50M por infracao | Acesso indevido a prontuarios sem justificativa  |
| Multa diaria                | Ate R$50M total                               | Persistencia de vulnerabilidade conhecida        |
| Publicizacao da infracao    | Apos apuracao e confirmacao                   | Dano reputacional significativo                  |
| Bloqueio dos dados          | Ate regularizacao                             | Pode paralisar operacoes hospitalares            |
| Eliminacao dos dados        | Dados pessoais a que se refere a infracao     | Perda de informacoes clinicas                    |
| Suspensao do banco de dados | Ate 6 meses                                   | Impossibilidade de usar o PEP                    |
| Proibicao do tratamento     | Parcial ou total                              | Crise operacional                                |

### 10.2 Penalidades do CFM

| Sancao              | Aplica-se a | Cenario                                       |
| ------------------- | ----------- | --------------------------------------------- |
| Advertencia         | Medico      | Acesso a prontuario sem justificativa clinica |
| Censura             | Medico      | Quebra de sigilo sem justa causa              |
| Suspensao (30 dias) | Medico      | Reincidencia em acesso indevido               |
| Cassacao do CRM     | Medico      | Compartilhamento doloso de dados sensiveis    |

### 10.3 Penalidades do COREN

| Sancao             | Aplica-se a        | Cenario                                        |
| ------------------ | ------------------ | ---------------------------------------------- |
| Advertencia verbal | Enfermeiro/Tec/Aux | Acesso a dados fora do escopo                  |
| Multa              | Enfermeiro/Tec/Aux | Anotacao inadequada / falta de registro        |
| Censura            | Enfermeiro/Tec/Aux | Quebra de sigilo                               |
| Suspensao          | Enfermeiro/Tec/Aux | Exercicio ilegal (ato privativo do enfermeiro) |
| Cassacao           | Enfermeiro/Tec/Aux | Infracoes graves e dolosas                     |

---

## 11. Calendario Regulatorio e Atualizacoes

| Data       | Regulamento                        | Acao Necessaria                     | Status     |
| ---------- | ---------------------------------- | ----------------------------------- | ---------- |
| 2024-08-01 | LGPD - Sancoes ativas              | Conformidade total obrigatoria      | Vigente    |
| 2025-01-01 | ANPD - Regulamento de dosimetria   | Criterios de calculo de multa       | Vigente    |
| 2025-06-01 | CFM - PEP com certificado digital  | Assinatura ICP-Brasil obrigatoria   | Vigente    |
| 2026-01-01 | ANS - TISS atualizado              | Novo padrao de interoperabilidade   | Em vigor   |
| 2026-06-01 | ANPD - Transferencia internacional | Regulamentacao de dados no exterior | Aguardando |

---

## 12. Referencias Legislativas Completas

1. **LGPD** - Lei 13.709/2018. Disponivel em: planalto.gov.br
2. **Lei do Ato Medico** - Lei 12.842/2013. Disponivel em: planalto.gov.br
3. **Lei do Exercicio da Enfermagem** - Lei 7.498/1986. Disponivel em: planalto.gov.br
4. **Decreto 94.406/1987** - Regulamenta a Lei 7.498/1986. Disponivel em: planalto.gov.br
5. **CFM 1.638/2002** - Prontuario Medico. Disponivel em: portal.cfm.org.br
6. **CFM 1.821/2007** - Prontuario Eletronico. Disponivel em: portal.cfm.org.br
7. **CFM 2.217/2018** - Codigo de Etica Medica. Disponivel em: portal.cfm.org.br
8. **CFM 2.299/2021** - PEP e certificado digital. Disponivel em: portal.cfm.org.br
9. **COFEN 429/2012** - Registros de enfermagem. Disponivel em: cofen.gov.br
10. **COFEN 358/2009** - SAE. Disponivel em: cofen.gov.br
11. **COFEN 564/2017** - Codigo de Etica de Enfermagem. Disponivel em: cofen.gov.br
12. **ANS RN 305/2012** - Padrao TISS. Disponivel em: ans.gov.br
13. **Lei 8.234/1991** - Regulamentacao da Nutricao. Disponivel em: planalto.gov.br
14. **HIPAA** - Health Insurance Portability and Accountability Act of 1996. Disponivel em: hhs.gov

---

_Documento mantido pela equipe de Compliance e Regulatorio - Velya Platform._
_Revisao obrigatoria a cada alteracao legislativa ou regulatoria._
