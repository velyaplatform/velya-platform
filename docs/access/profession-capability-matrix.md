# Matriz de Capacidades por Profissao - Velya Platform

> Versao: 1.0 | Ultima atualizacao: 2026-04-08
> Classificacao: Documento Interno - Arquitetura de Seguranca

---

## 1. Visao Geral

Este documento mapeia cada profissao/role do sistema Velya Platform as capacidades
(capabilities) que pode executar. A matriz serve como referencia primaria para
implementacao de politicas RBAC e para validacao de conformidade com a legislacao
brasileira de saude.

### Legenda da Matriz

| Simbolo | Significado                                                         |
| ------- | ------------------------------------------------------------------- |
| P       | **Permitido** - Acesso direto sem condicoes adicionais              |
| C       | **Condicional** - Permitido com condicoes especificas (ver secao 3) |
| N       | **Negado** - Acesso bloqueado pelo sistema                          |
| S       | **Step-up** - Requer re-autenticacao (MFA) para executar            |
| B       | **Break-glass** - Disponivel apenas via protocolo de emergencia     |

---

## 2. Matriz Principal de Capacidades

### 2.1 Capacidades de Visualizacao (Read)

| Role / Capacidade          | view_demographics | view_clinical_summary | view_full_chart | view_sensitive_records | view_lab_results | view_imaging_results | view_medication_list | view_vitals | view_nursing_notes | view_billing_data |
| -------------------------- | ----------------: | --------------------: | --------------: | ---------------------: | ---------------: | -------------------: | -------------------: | ----------: | -----------------: | ----------------: |
| hospital_owner_executive   |                 N |                     N |               N |                      N |                N |                    N |                    N |           N |                  N |                 P |
| clinical_director          |                 P |                     P |               P |                      S |                P |                    P |                    P |           P |                  P |                 C |
| medical_staff_attending    |                 P |                     P |               P |                      S |                P |                    P |                    P |           P |                  P |                 N |
| medical_staff_on_call      |                 P |                     P |               P |                      S |                P |                    P |                    P |           P |                  P |                 N |
| nurse                      |                 P |                     P |               P |                      B |                P |                    P |                    P |           P |                  P |                 N |
| nursing_technician         |                 P |                     P |               N |                      N |                C |                    C |                    P |           P |                  P |                 N |
| nursing_assistant          |                 C |                     C |               N |                      N |                N |                    N |                    C |           P |                  C |                 N |
| pharmacist_clinical        |                 C |                     C |               N |                      N |                C |                    N |                    P |           N |                  N |                 N |
| physiotherapist            |                 C |                     P |               N |                      N |                C |                    C |                    C |           P |                  C |                 N |
| nutritionist               |                 C |                     P |               N |                      N |                C |                    N |                    C |           C |                  N |                 N |
| psychologist               |                 C |                     P |               N |                      C |                N |                    N |                    C |           N |                  N |                 N |
| social_worker              |                 P |                     C |               N |                      N |                N |                    N |                    N |           N |                  N |                 N |
| speech_therapist           |                 C |                     P |               N |                      N |                C |                    C |                    C |           C |                  C |                 N |
| occupational_therapist     |                 C |                     P |               N |                      N |                N |                    N |                    C |           C |                  C |                 N |
| lab_staff                  |                 C |                     N |               N |                      N |                P |                    N |                    N |           N |                  N |                 N |
| imaging_staff              |                 C |                     C |               N |                      N |                N |                    P |                    N |           N |                  N |                 N |
| receptionist_registration  |                 P |                     N |               N |                      N |                N |                    N |                    N |           N |                  N |                 N |
| billing_authorization      |                 C |                     N |               N |                      N |                N |                    N |                    N |           N |                  N |                 P |
| ambulance_driver           |                 N |                     N |               N |                      N |                N |                    N |                    N |           N |                  N |                 N |
| patient_transporter        |                 N |                     N |               N |                      N |                N |                    N |                    N |           N |                  N |                 N |
| cleaning_hygiene           |                 N |                     N |               N |                      N |                N |                    N |                    N |           N |                  N |                 N |
| maintenance                |                 N |                     N |               N |                      N |                N |                    N |                    N |           N |                  N |                 N |
| security_guard             |                 N |                     N |               N |                      N |                N |                    N |                    N |           N |                  N |                 N |
| bed_management             |                 C |                     N |               N |                      N |                N |                    N |                    N |           N |                  N |                 N |
| case_manager               |                 P |                     P |               N |                      N |                C |                    N |                    C |           C |                  C |                 N |
| compliance_auditor         |                 P |                     P |               C |                      S |                P |                    P |                    P |           P |                  P |                 P |
| internal_auditor           |                 C |                     N |               N |                      N |                N |                    N |                    N |           N |                  N |                 P |
| it_support_jit             |                 N |                     N |               N |                      N |                N |                    N |                    N |           N |                  N |                 N |
| security_admin_jit         |                 N |                     N |               N |                      N |                N |                    N |                    N |           N |                  N |                 N |
| emergency_break_glass_role |                 P |                     P |               P |                      P |                P |                    P |                    P |           P |                  P |                 N |

### 2.2 Capacidades de Criacao/Escrita (Write)

| Role / Capacidade          | create_nursing_note | create_medical_evolution | prescribe_medication | order_exam | prescribe_diet | create_psychological_note | create_physio_evolution | create_social_report |
| -------------------------- | ------------------: | -----------------------: | -------------------: | ---------: | -------------: | ------------------------: | ----------------------: | -------------------: |
| hospital_owner_executive   |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| clinical_director          |                   N |                        C |                    C |          C |              N |                         N |                       N |                    N |
| medical_staff_attending    |                   N |                        P |                    P |          P |              N |                         N |                       N |                    N |
| medical_staff_on_call      |                   N |                        P |                    P |          P |              N |                         N |                       N |                    N |
| nurse                      |                   P |                        N |                    N |          C |              N |                         N |                       N |                    N |
| nursing_technician         |                   P |                        N |                    N |          N |              N |                         N |                       N |                    N |
| nursing_assistant          |                   C |                        N |                    N |          N |              N |                         N |                       N |                    N |
| pharmacist_clinical        |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| physiotherapist            |                   N |                        N |                    N |          C |              N |                         N |                       P |                    N |
| nutritionist               |                   N |                        N |                    N |          C |              P |                         N |                       N |                    N |
| psychologist               |                   N |                        N |                    N |          N |              N |                         P |                       N |                    N |
| social_worker              |                   N |                        N |                    N |          N |              N |                         N |                       N |                    P |
| speech_therapist           |                   N |                        N |                    N |          C |              N |                         N |                       N |                    N |
| occupational_therapist     |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| lab_staff                  |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| imaging_staff              |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| receptionist_registration  |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| billing_authorization      |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| ambulance_driver           |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| patient_transporter        |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| cleaning_hygiene           |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| maintenance                |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| security_guard             |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| bed_management             |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| case_manager               |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| compliance_auditor         |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| internal_auditor           |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| it_support_jit             |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| security_admin_jit         |                   N |                        N |                    N |          N |              N |                         N |                       N |                    N |
| emergency_break_glass_role |                   N |                        C |                    C |          C |              N |                         N |                       N |                    N |

### 2.3 Capacidades de Acao e Aprovacao

| Role / Capacidade          | sign_document | approve_discharge | manage_transport | manage_cleaning | manage_billing | export_data | print_record | break_glass |
| -------------------------- | :-----------: | :---------------: | :--------------: | :-------------: | :------------: | :---------: | :----------: | :---------: |
| hospital_owner_executive   |       N       |         N         |        N         |        N        |       C        |      C      |      C       |      N      |
| clinical_director          |       P       |         C         |        N         |        N        |       N        |      S      |      S       |      P      |
| medical_staff_attending    |       P       |         P         |        N         |        N        |       N        |      C      |      C       |      P      |
| medical_staff_on_call      |       P       |         C         |        N         |        N        |       N        |      N      |      C       |      P      |
| nurse                      |       P       |         N         |        C         |        C        |       N        |      C      |      C       |      P      |
| nursing_technician         |       C       |         N         |        N         |        N        |       N        |      N      |      N       |      N      |
| nursing_assistant          |       N       |         N         |        N         |        N        |       N        |      N      |      N       |      N      |
| pharmacist_clinical        |       P       |         N         |        N         |        N        |       N        |      N      |      C       |      N      |
| physiotherapist            |       P       |         N         |        N         |        N        |       N        |      N      |      C       |      N      |
| nutritionist               |       P       |         N         |        N         |        N        |       N        |      N      |      N       |      N      |
| psychologist               |       P       |         N         |        N         |        N        |       N        |      N      |      N       |      N      |
| social_worker              |       P       |         N         |        N         |        N        |       N        |      N      |      C       |      N      |
| speech_therapist           |       P       |         N         |        N         |        N        |       N        |      N      |      N       |      N      |
| occupational_therapist     |       P       |         N         |        N         |        N        |       N        |      N      |      N       |      N      |
| lab_staff                  |       P       |         N         |        N         |        N        |       N        |      N      |      C       |      N      |
| imaging_staff              |       P       |         N         |        N         |        N        |       N        |      N      |      C       |      N      |
| receptionist_registration  |       N       |         N         |        N         |        N        |       N        |      N      |      C       |      N      |
| billing_authorization      |       N       |         N         |        N         |        N        |       P        |      C      |      C       |      N      |
| ambulance_driver           |       N       |         N         |        C         |        N        |       N        |      N      |      N       |      N      |
| patient_transporter        |       N       |         N         |        P         |        N        |       N        |      N      |      N       |      N      |
| cleaning_hygiene           |       N       |         N         |        N         |        P        |       N        |      N      |      N       |      N      |
| maintenance                |       N       |         N         |        N         |        N        |       N        |      N      |      N       |      N      |
| security_guard             |       N       |         N         |        N         |        N        |       N        |      N      |      N       |      N      |
| bed_management             |       N       |         N         |        C         |        C        |       N        |      N      |      N       |      N      |
| case_manager               |       N       |         N         |        C         |        N        |       N        |      N      |      C       |      N      |
| compliance_auditor         |       N       |         N         |        N         |        N        |       N        |      S      |      S       |      N      |
| internal_auditor           |       N       |         N         |        N         |        N        |       N        |      C      |      C       |      N      |
| it_support_jit             |       N       |         N         |        N         |        N        |       N        |      N      |      N       |      N      |
| security_admin_jit         |       N       |         N         |        N         |        N        |       N        |      N      |      N       |      N      |
| emergency_break_glass_role |       C       |         N         |        N         |        N        |       N        |      N      |      N       |      N      |

---

## 3. Condicoes para Acessos Condicionais (C)

### 3.1 Condicoes por Capacidade

#### view_demographics (C)

| Role                   | Condicao                                                         |
| ---------------------- | ---------------------------------------------------------------- |
| nursing_assistant      | Apenas nome e leito do paciente sob seus cuidados                |
| pharmacist_clinical    | Apenas nome, leito, alergias para identificacao segura           |
| physiotherapist        | Apenas nome, leito, idade para identificacao                     |
| nutritionist           | Apenas nome, leito, idade, peso, altura                          |
| psychologist           | Apenas nome, leito do paciente em atendimento                    |
| speech_therapist       | Apenas nome, leito do paciente em atendimento                    |
| occupational_therapist | Apenas nome, leito do paciente em atendimento                    |
| lab_staff              | Nome completo + data de nascimento (para conferencia de amostra) |
| imaging_staff          | Nome completo + data de nascimento (para conferencia)            |
| billing_authorization  | Nome + numero do prontuario + convenio (para faturamento)        |
| bed_management         | Nome + leito + convenio (para gestao de censo)                   |
| internal_auditor       | Dados anonimizados para auditoria                                |

#### view_clinical_summary (C)

| Role                | Condicao                                                      |
| ------------------- | ------------------------------------------------------------- |
| nursing_assistant   | Apenas plano de cuidados simplificado e precaucoes            |
| pharmacist_clinical | Apenas alergias, medicamentos, interacoes                     |
| social_worker       | Apenas resumo social (condicoes de moradia, suporte familiar) |
| imaging_staff       | Apenas indicacao clinica do exame (para protocolo adequado)   |

#### view_full_chart (C)

| Role               | Condicao                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| compliance_auditor | Somente leitura, com step-up authentication, registrado em auditoria, para fins de compliance apenas |

#### view_sensitive_records (C)

| Role         | Condicao                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| psychologist | Apenas registros de saude mental do paciente em atendimento. Notas de psicoterapia de outros profissionais sao inacessiveis |

#### view_lab_results (C)

| Role                | Condicao                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------- |
| nursing_technician  | Apenas resultados dos ultimos 24h para administracao de medicamentos                         |
| pharmacist_clinical | Apenas resultados relevantes para farmacovigilancia (funcao renal, hepatica, niveis sericos) |
| physiotherapist     | Apenas gasometria e exames respiratorios                                                     |
| nutritionist        | Apenas exames bioquimicos (glicemia, perfil lipidico, albumina, pre-albumina)                |
| speech_therapist    | Apenas exames relacionados a disfagia (videodeglutograma)                                    |
| case_manager        | Apenas resultados pendentes (para plano de alta)                                             |

#### view_imaging_results (C)

| Role               | Condicao                                      |
| ------------------ | --------------------------------------------- |
| nursing_technician | Apenas status do exame (realizado/pendente)   |
| physiotherapist    | Apenas imagens musculoesqueleticas e de torax |
| speech_therapist   | Apenas videodeglutograma e videofluoroscopia  |

#### view_medication_list (C)

| Role                   | Condicao                                                                 |
| ---------------------- | ------------------------------------------------------------------------ |
| nursing_assistant      | Apenas horarios de administracao (sem detalhes de dosagem)               |
| physiotherapist        | Apenas medicamentos que afetam exercicio (anticoagulantes, hipotensores) |
| nutritionist           | Apenas medicamentos com interacao alimentar                              |
| psychologist           | Apenas psicotropicos prescritos                                          |
| speech_therapist       | Apenas medicamentos que afetam degluticao                                |
| occupational_therapist | Apenas medicamentos que afetam funcionalidade                            |
| case_manager           | Apenas lista resumida para coordenacao de alta                           |

#### create_nursing_note (C)

| Role              | Condicao                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| nursing_assistant | Apenas anotacoes de cuidados basicos (higiene, conforto, alimentacao). Nao pode criar anotacao de observacao clinica |

#### create_medical_evolution (C)

| Role                  | Condicao                                                                             |
| --------------------- | ------------------------------------------------------------------------------------ |
| clinical_director     | Apenas quando tambem e medico assistente do paciente (relacao `attending_physician`) |
| emergency_break_glass | Apenas evolucao de emergencia durante vigencia do break-glass                        |

#### prescribe_medication (C)

| Role                  | Condicao                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- |
| clinical_director     | Apenas quando tambem e medico assistente do paciente                                  |
| emergency_break_glass | Apenas prescricao de emergencia, limitada a medicamentos de emergencia (lista branca) |

#### order_exam (C)

| Role                  | Condicao                                                                        |
| --------------------- | ------------------------------------------------------------------------------- |
| clinical_director     | Apenas quando atua como medico assistente                                       |
| nurse                 | Apenas exames dentro do escopo de enfermagem (conforme protocolo institucional) |
| physiotherapist       | Apenas exames de funcao pulmonar, gasometria (conforme COFFITO)                 |
| nutritionist          | Apenas exames bioquimicos nutricionais (conforme CRN)                           |
| speech_therapist      | Apenas exames de degluticao (conforme CRFa)                                     |
| emergency_break_glass | Apenas exames de emergencia (protocolo de emergencia)                           |

#### approve_discharge (C)

| Role                  | Condicao                                                     |
| --------------------- | ------------------------------------------------------------ |
| clinical_director     | Quando o medico assistente nao esta disponivel e ha urgencia |
| medical_staff_on_call | Apenas em situacao de emergencia (alta a pedido com risco)   |

#### sign_document (C)

| Role                  | Condicao                                                                       |
| --------------------- | ------------------------------------------------------------------------------ |
| nursing_technician    | Apenas assinar registros de administracao de medicamentos e anotacoes proprias |
| emergency_break_glass | Apenas assinar documentos de emergencia                                        |

#### manage_transport (C)

| Role             | Condicao                                              |
| ---------------- | ----------------------------------------------------- |
| nurse            | Solicitar transporte para pacientes sob seus cuidados |
| ambulance_driver | Apenas atualizar status do transporte atribuido       |
| bed_management   | Coordenar transporte entre unidades                   |
| case_manager     | Coordenar transporte para alta/transferencia          |

#### manage_cleaning (C)

| Role           | Condicao                                  |
| -------------- | ----------------------------------------- |
| nurse          | Solicitar limpeza de leito na sua unidade |
| bed_management | Coordenar limpeza para liberacao de leito |

#### manage_billing (C)

| Role                     | Condicao                                                     |
| ------------------------ | ------------------------------------------------------------ |
| hospital_owner_executive | Apenas visualizacao de relatorios consolidados, sem operacao |

#### export_data (C)

| Role                     | Condicao                                                                       |
| ------------------------ | ------------------------------------------------------------------------------ |
| medical_staff_attending  | Apenas resumo do paciente para referencia/contrarreferencia, com consentimento |
| nurse                    | Apenas SAE para continuidade do cuidado, com aprovacao                         |
| hospital_owner_executive | Apenas dados agregados/anonimizados                                            |
| billing_authorization    | Apenas dados de faturamento via TISS                                           |
| compliance_auditor       | Com step-up + justificativa + aprovacao do DPO                                 |
| internal_auditor         | Apenas dados financeiros agregados                                             |

#### print_record (C)

| Role                      | Condicao                                        |
| ------------------------- | ----------------------------------------------- |
| medical_staff_attending   | Com registro em auditoria, apenas seu paciente  |
| medical_staff_on_call     | Com registro em auditoria, apenas emergencia    |
| nurse                     | Com registro em auditoria, apenas SAE           |
| pharmacist_clinical       | Apenas prescricoes para conferencia             |
| physiotherapist           | Apenas evolucoes de fisioterapia                |
| social_worker             | Apenas relatorio social                         |
| lab_staff                 | Apenas resultados de exames para entrega        |
| imaging_staff             | Apenas laudos de imagem                         |
| receptionist_registration | Apenas comprovante de cadastro/atendimento      |
| billing_authorization     | Apenas guias TISS e faturas                     |
| case_manager              | Apenas resumo para coordenacao de alta          |
| compliance_auditor        | Com step-up + justificativa (para investigacao) |
| internal_auditor          | Apenas relatorios financeiros                   |

---

## 4. Mapeamento Legal por Capacidade

| Capacidade               | Base Legal Principal                                     | Observacao                                       |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------ |
| view_demographics        | LGPD Art. 7o, VIII (tutela) + Art. 6o, III (necessidade) | Dados minimos para identificacao                 |
| view_clinical_summary    | LGPD Art. 7o, VIII                                       | Resumo proporcional a funcao                     |
| view_full_chart          | LGPD Art. 7o, VIII + CFM 1.638/2002                      | Prontuario completo para medico/enfermeiro       |
| view_sensitive_records   | LGPD Art. 11 + legislacao especifica                     | Controles adicionais obrigatorios                |
| create_nursing_note      | Lei 7.498/1986 Art. 11-13 + COFEN 429/2012               | Conforme nivel profissional                      |
| create_medical_evolution | Lei 12.842/2013 Art. 4o + CFM 1.638/2002                 | Ato privativo do medico                          |
| prescribe_medication     | Lei 12.842/2013 Art. 4o, IV                              | Ato privativo do medico                          |
| order_exam               | Lei 12.842/2013 + regulamentacao de cada conselho        | Medico pode todos; outros conforme conselho      |
| prescribe_diet           | Lei 8.234/1991 Art. 3o, VIII                             | Ato privativo do nutricionista                   |
| sign_document            | CFM 2.299/2021 + ICP-Brasil                              | Assinatura digital com certificado               |
| approve_discharge        | Lei 12.842/2013 Art. 4o, II                              | Ato privativo do medico                          |
| manage_transport         | Normas operacionais internas                             | Sem regulamentacao especifica                    |
| manage_cleaning          | RDC ANVISA 36/2013 + normas CCIH                         | Protocolos de CCIH                               |
| manage_billing           | ANS RN 305/2012 (TISS) + normas SUS                      | Restrito ao setor de faturamento                 |
| export_data              | LGPD Art. 18, V (portabilidade) + Art. 6o, III           | Minimizacao + consentimento quando aplicavel     |
| print_record             | CFM 1.638/2002 + LGPD Art. 46                            | Registro em auditoria obrigatorio                |
| break_glass              | LGPD Art. 7o, VII (protecao da vida)                     | Apenas profissionais com CRM ou COREN-Enfermeiro |

---

## 5. Exemplos de Acesso Dependente de Contexto

### 5.1 Medico Assistente vs Medico Plantonista

```yaml
cenario: 'Medico assistente Dr. Silva e plantonista Dr. Santos'
paciente: 'Joao, internado no quarto 301'
medico_assistente: 'Dr. Silva (attending_physician)'
medico_plantonista: 'Dr. Santos (on_call_physician)'

comparacao:
  Dr_Silva_attending:
    view_full_chart: P # Acesso completo
    prescribe_medication: P # Pode prescrever qualquer medicamento
    approve_discharge: P # Pode dar alta
    view_sensitive_records: S # Com step-up
    acesso_apos_alta: '72h' # Acesso por 72h apos alta

  Dr_Santos_on_call:
    view_full_chart: P # Acesso completo (durante plantao)
    prescribe_medication: P # Pode prescrever
    approve_discharge: C # Apenas emergencia
    view_sensitive_records: S # Com step-up
    acesso_apos_alta: 'Fim do plantao' # Acesso termina com o plantao
```

### 5.2 Enfermeiro vs Tecnico de Enfermagem

```yaml
cenario: 'Enfermeira Ana e Tecnico Carlos, mesmo paciente'
paciente: 'Maria, internada no quarto 205'

comparacao:
  Ana_enfermeira:
    create_nursing_evolution: P # Pode evoluir
    create_nursing_prescription: P # Pode prescrever cuidados de enfermagem
    supervise_team: P # Pode supervisionar
    record_medication_admin: P # Pode registrar administracao
    view_full_chart: P # Acesso ao prontuario completo
    complex_nursing_care: P # Procedimentos complexos

  Carlos_tecnico:
    create_nursing_evolution: N # NAO pode evoluir (ato privativo)
    create_nursing_prescription: N # NAO pode prescrever
    supervise_team: N # NAO pode supervisionar
    record_medication_admin: P # Pode registrar (sob supervisao)
    view_full_chart: N # NAO acessa prontuario completo
    complex_nursing_care: N # NAO pode executar complexos
    view_clinical_summary: P # Acessa resumo clinico
    create_nursing_note: P # Pode fazer anotacoes
```

### 5.3 Acesso do Farmaceutico

```yaml
cenario: 'Farmaceutica Dra. Lucia valida prescricao'
paciente: 'Pedro, com prescricao de antibiotico IV'

acesso_farmaceutico:
  view_medication_list: P # Lista completa de medicamentos
  view_allergy_list: P # Alergias (seguranca do paciente)
  validate_prescription: P # Pode validar/questionar prescricao
  flag_drug_interaction: P # Pode alertar interacao
  create_pharmaceutical_note: P # Pode registrar intervencao
  dispense_medication: P # Pode dispensar

  # O que NAO pode:
  view_full_chart: N # Nao acessa prontuario completo
  view_diagnosis: N # Nao ve diagnostico
  view_medical_evolution: N # Nao ve evolucao medica
  prescribe_medication: N # Nao pode prescrever
  view_nursing_notes: N # Nao ve anotacoes de enfermagem
  view_imaging_results: N # Nao ve exames de imagem

  # Excepcoes contextuais:
  view_lab_results:
    allowed_types:
      - funcao_renal # Para ajuste de dose
      - funcao_hepatica # Para metabolismo
      - niveis_sericos # Para monitoramento terapeutico
    denied_types:
      - hemograma_completo # Nao relevante para dispensacao
      - sorologias # Nao relevante para dispensacao
```

### 5.4 Recepcionista - Escopo Limitado

```yaml
cenario: 'Recepcionista Julia cadastra paciente novo'

acesso_recepcionista:
  # PODE:
  create_patient_registration: P # Cadastrar paciente
  view_demographics: P # Ver dados cadastrais
  verify_insurance: P # Verificar convenio
  schedule_appointment: P # Agendar consulta
  check_in_patient: P # Check-in de paciente

  # NAO PODE:
  view_clinical_summary: N # Nenhum dado clinico
  view_vitals: N # Nenhum sinal vital
  view_medication_list: N # Nenhum medicamento
  view_diagnosis: N # Nenhum diagnostico
  view_nursing_notes: N # Nenhuma anotacao
  view_lab_results: N # Nenhum resultado

  # DADOS VISIVEIS:
  dados_visiveis:
    - nome_completo
    - nome_social
    - cpf
    - rg
    - data_nascimento
    - endereco
    - telefone
    - email
    - convenio
    - carteirinha
    - responsavel_legal
    - contato_emergencia
```

---

## 6. Validacao Periodica da Matriz

### 6.1 Processo de Revisao

| Atividade                                      | Frequencia    | Responsavel                       |
| ---------------------------------------------- | ------------- | --------------------------------- |
| Revisao completa da matriz                     | Trimestral    | Seguranca + Diretoria Clinica     |
| Validacao legal (legislacao atualizada)        | Semestral     | Juridico + Compliance             |
| Testes automatizados de politica               | Continuo (CI) | Equipe de Engenharia              |
| Auditoria de aderencia (acesso real vs matriz) | Mensal        | Compliance                        |
| Revisao por mudanca regulatoria                | Sob demanda   | Juridico + Compliance + Seguranca |
| Simulacao de cenarios (tabletop)               | Semestral     | Seguranca + Diretoria Clinica     |

### 6.2 Testes Automatizados

```typescript
// Testes de politica executados em CI/CD
describe('Profession Capability Matrix Compliance', () => {
  // Testes de atos privativos do medico (Lei 12.842/2013)
  describe('Lei 12.842 - Atos Privativos do Medico', () => {
    const nonMedicalRoles = [
      'nurse',
      'nursing_technician',
      'nursing_assistant',
      'pharmacist_clinical',
      'physiotherapist',
      'nutritionist',
      'psychologist',
      'social_worker',
      'receptionist_registration',
      'billing_authorization',
    ];

    const privateActs = [
      'prescribe_medication',
      'formulate_diagnosis',
      'approve_discharge',
      'indicate_surgery',
      'determine_prognosis',
      'create_medical_certificate',
    ];

    for (const role of nonMedicalRoles) {
      for (const act of privateActs) {
        it(`${role} NAO pode executar ${act}`, async () => {
          const result = await evaluateCapability(role, act);
          expect(result).not.toBe('P'); // Nao pode ser Permitido direto
          if (result === 'C') {
            // Se condicional, verificar que nao e para ato privativo
            const conditions = getConditions(role, act);
            expect(conditions).toBeDefined();
            // Condicoes devem ser restritivas
          }
        });
      }
    }
  });

  // Testes de atos privativos do enfermeiro (Lei 7.498/1986)
  describe('Lei 7.498 - Atos Privativos do Enfermeiro', () => {
    const nonNurseRoles = ['nursing_technician', 'nursing_assistant'];
    const nursePrivateActs = [
      'create_nursing_evolution',
      'create_nursing_prescription',
      'create_nursing_consultation',
      'execute_complex_nursing_care',
    ];

    for (const role of nonNurseRoles) {
      for (const act of nursePrivateActs) {
        it(`${role} NAO pode executar ${act}`, async () => {
          const result = await evaluateCapability(role, act);
          expect(result).toBe('N');
        });
      }
    }
  });

  // Testes de dados sensiveis (LGPD Art. 11)
  describe('LGPD Art. 11 - Dados Sensiveis', () => {
    const nonClinicalRoles = [
      'receptionist_registration',
      'billing_authorization',
      'ambulance_driver',
      'patient_transporter',
      'cleaning_hygiene',
      'maintenance',
      'security_guard',
    ];

    it('roles nao clinicos NAO podem acessar dados clinicos', async () => {
      for (const role of nonClinicalRoles) {
        const viewChart = await evaluateCapability(role, 'view_full_chart');
        const viewSensitive = await evaluateCapability(role, 'view_sensitive_records');
        const viewVitals = await evaluateCapability(role, 'view_vitals');
        expect(viewChart).toBe('N');
        expect(viewSensitive).toBe('N');
        // vitals pode ser N ou nao aplicavel
      }
    });
  });
});
```

---

## 7. Historico de Alteracoes da Matriz

| Data       | Alteracao                | Motivacao                 | Aprovador           |
| ---------- | ------------------------ | ------------------------- | ------------------- |
| 2026-04-08 | Versao inicial da matriz | Lancamento Velya Platform | Comite de Seguranca |
| -          | -                        | -                         | -                   |

---

_Documento mantido pela equipe de Arquitetura de Seguranca - Velya Platform._
_Proxima revisao programada: 2026-07-08._
