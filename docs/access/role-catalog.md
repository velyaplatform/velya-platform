# Catalogo de Roles - Velya Platform

> Versao: 1.0 | Ultima atualizacao: 2026-04-08
> Classificacao: Documento Interno - Arquitetura de Seguranca

---

## 1. Visao Geral

Este catalogo define todos os roles (papeis) do sistema de controle de acesso
da Velya Platform. Cada role e mapeado a uma funcao profissional real do
ambiente hospitalar, com permissoes derivadas da legislacao brasileira e das
necessidades operacionais.

### Convencoes

- **Role ID:** snake_case, em ingles, para uso em codigo e configuracao.
- **Nome de Exibicao:** Portugues brasileiro, para interfaces de usuario.
- **Nivel de Acesso:** 0-7, conforme definido em `access-control-principles.md`.
- **Classes de Dados:** A-E, conforme definido em `data-sensitivity-matrix.md`.
- **JIT:** Just-In-Time - role ativado sob demanda com duracao limitada.

---

## 2. Roles Executivos e Diretoria

### 2.1 hospital_owner_executive

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `hospital_owner_executive`                                  |
| **Nome de Exibicao**       | Proprietario / Diretor Executivo                            |
| **Conselho Profissional**  | Nenhum obrigatorio (pode ter CRM, CRA)                     |
| **Nivel de Acesso**        | 3                                                           |
| **Classes Permitidas**     | A, B                                                        |
| **Classes Negadas**        | C, D, E                                                     |
| **Acoes Permitidas**       | `view_dashboards`, `view_operational_reports`, `view_financial_reports`, `manage_organizational_settings`, `approve_system_changes` |
| **Acoes Negadas**          | `view_patient_chart`, `view_clinical_data`, `prescribe_*`, `create_*_note` |
| **Req. de Relacao**        | Nenhuma (acesso administrativo, nao clinico)                |
| **Req. Local/Turno**       | Nenhuma                                                     |
| **Step-up Auth**           | Para `approve_system_changes`                               |
| **Nivel de Auditoria**     | Elevada                                                     |
| **Break-glass Elegivel**   | Nao                                                         |
| **Justificativa**          | Gestor executivo nao tem acesso a dados clinicos. Acesso restrito a indicadores operacionais e financeiros agregados. |

### 2.2 clinical_director

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `clinical_director`                                         |
| **Nome de Exibicao**       | Diretor Clinico / Diretor Tecnico                           |
| **Conselho Profissional**  | CRM (obrigatorio - deve ser medico conforme CFM)            |
| **Nivel de Acesso**        | 6                                                           |
| **Classes Permitidas**     | A, B, C, D, E (com justificativa para E)                    |
| **Classes Negadas**        | Nenhuma (com restricoes contextuais)                        |
| **Acoes Permitidas**       | `view_patient_chart`, `view_clinical_data`, `view_sensitive_records` (com step-up), `approve_break_glass_review`, `manage_clinical_staff`, `review_clinical_quality`, `approve_protocol_changes`, `view_compliance_reports` |
| **Acoes Negadas**          | `prescribe_medication` (exceto se tambem for assistente do paciente), `create_medical_evolution` (exceto como assistente) |
| **Req. de Relacao**        | Para acoes clinicas diretas: relacao `attending` ou `consulting`. Para gestao: nenhuma |
| **Req. Local/Turno**       | Nenhuma                                                     |
| **Step-up Auth**           | Para `view_sensitive_records`, `approve_break_glass_review`  |
| **Nivel de Auditoria**     | Maxima                                                      |
| **Break-glass Elegivel**   | Sim (como medico com CRM ativo)                             |
| **Justificativa**          | Responsavel tecnico pelo hospital perante o CFM. Acesso amplo para supervisao clinica mas atos medicos diretos apenas com relacao assistencial. |

---

## 3. Roles Medicos

### 3.1 medical_staff_attending

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `medical_staff_attending`                                   |
| **Nome de Exibicao**       | Medico Assistente                                           |
| **Conselho Profissional**  | CRM (obrigatorio)                                           |
| **Nivel de Acesso**        | 5                                                           |
| **Classes Permitidas**     | A, B, C, D                                                  |
| **Classes Negadas**        | E (requer step-up e justificativa)                          |
| **Acoes Permitidas**       | `view_patient_chart`, `view_clinical_data`, `create_medical_evolution`, `prescribe_medication`, `order_exam`, `order_procedure`, `sign_document`, `approve_discharge`, `create_medical_certificate`, `formulate_diagnosis`, `determine_prognosis`, `indicate_surgery`, `request_consultation` |
| **Acoes Negadas**          | `manage_billing`, `manage_organizational_settings`, `approve_own_break_glass` |
| **Req. de Relacao**        | `attending_physician` com paciente (ativa)                  |
| **Req. Local/Turno**       | Deve estar no hospital ou em acesso remoto autorizado       |
| **Step-up Auth**           | Para `approve_discharge`, `indicate_surgery`, acesso Classe E |
| **Nivel de Auditoria**     | Elevada                                                     |
| **Break-glass Elegivel**   | Sim                                                         |
| **Justificativa**          | Medico responsavel pelo paciente. Atos privativos conforme Lei 12.842/2013. Acesso completo ao prontuario dos seus pacientes. |

### 3.2 medical_staff_on_call

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `medical_staff_on_call`                                     |
| **Nome de Exibicao**       | Medico Plantonista                                          |
| **Conselho Profissional**  | CRM (obrigatorio)                                           |
| **Nivel de Acesso**        | 5                                                           |
| **Classes Permitidas**     | A, B, C, D                                                  |
| **Classes Negadas**        | E (requer step-up e justificativa)                          |
| **Acoes Permitidas**       | `view_patient_chart`, `view_clinical_data`, `create_medical_evolution`, `prescribe_medication`, `order_exam`, `order_procedure`, `sign_document`, `create_medical_certificate`, `formulate_diagnosis`, `initial_assessment` |
| **Acoes Negadas**          | `approve_discharge` (exceto emergencia), `indicate_surgery` (pode indicar emergencia) |
| **Req. de Relacao**        | `on_call_physician` para o setor/unidade do plantao         |
| **Req. Local/Turno**       | Deve estar em turno ativo de plantao (validado pelo sistema de escalas) |
| **Step-up Auth**           | Para prescricoes de alto risco, acesso Classe E             |
| **Nivel de Auditoria**     | Elevada                                                     |
| **Break-glass Elegivel**   | Sim                                                         |
| **Justificativa**          | Medico em regime de plantao com acesso aos pacientes do setor durante seu turno. Relacao automatica criada pelo sistema de escalas. |

---

## 4. Roles de Enfermagem

### 4.1 nurse

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `nurse`                                                     |
| **Nome de Exibicao**       | Enfermeiro(a)                                               |
| **Conselho Profissional**  | COREN - Categoria Enfermeiro                                |
| **Nivel de Acesso**        | 5                                                           |
| **Classes Permitidas**     | A, B, C, D                                                  |
| **Classes Negadas**        | E (exceto via break-glass)                                  |
| **Acoes Permitidas**       | `view_patient_chart`, `view_clinical_data`, `create_nursing_evolution`, `create_nursing_prescription`, `create_nursing_consultation`, `execute_complex_nursing_care`, `approve_nursing_notes`, `supervise_nursing_team`, `record_vitals`, `record_medication_administration`, `view_care_plan`, `create_care_plan` |
| **Acoes Negadas**          | `prescribe_medication`, `formulate_diagnosis`, `approve_discharge`, `indicate_surgery` |
| **Req. de Relacao**        | `nursing_team_assigned` com paciente ou unidade             |
| **Req. Local/Turno**       | Turno ativo (manha/tarde/noite) na unidade atribuida        |
| **Step-up Auth**           | Para acoes de alto risco de enfermagem                      |
| **Nivel de Auditoria**     | Elevada                                                     |
| **Break-glass Elegivel**   | Sim                                                         |
| **Justificativa**          | Enfermeiro com graduacao, atos privativos conforme Lei 7.498/1986 Art. 11. Acesso ao prontuario para cuidados de enfermagem. |

### 4.2 nursing_technician

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `nursing_technician`                                        |
| **Nome de Exibicao**       | Tecnico(a) de Enfermagem                                    |
| **Conselho Profissional**  | COREN - Categoria Tecnico                                   |
| **Nivel de Acesso**        | 4                                                           |
| **Classes Permitidas**     | A, C (parcial)                                              |
| **Classes Negadas**        | B (parcial), D, E                                           |
| **Acoes Permitidas**       | `view_clinical_summary`, `create_nursing_note`, `record_vitals`, `record_medication_administration`, `record_simple_procedure`, `view_medication_schedule`, `view_care_plan_summary` |
| **Acoes Negadas**          | `create_nursing_evolution`, `create_nursing_prescription`, `prescribe_medication`, `formulate_diagnosis`, `approve_*`, `view_full_chart` |
| **Req. de Relacao**        | `nursing_team_assigned` com paciente ou unidade             |
| **Req. Local/Turno**       | Turno ativo na unidade atribuida                            |
| **Step-up Auth**           | Nao aplicavel                                               |
| **Nivel de Auditoria**     | Elevada                                                     |
| **Break-glass Elegivel**   | Nao                                                         |
| **Justificativa**          | Tecnico de enfermagem conforme Lei 7.498/1986 Art. 12. Execucao de cuidados sob supervisao do enfermeiro. |

### 4.3 nursing_assistant

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `nursing_assistant`                                         |
| **Nome de Exibicao**       | Auxiliar de Enfermagem                                      |
| **Conselho Profissional**  | COREN - Categoria Auxiliar                                  |
| **Nivel de Acesso**        | 4                                                           |
| **Classes Permitidas**     | A, C (minimo)                                               |
| **Classes Negadas**        | B, D, E                                                     |
| **Acoes Permitidas**       | `view_care_plan_summary`, `record_basic_care`, `record_hygiene_comfort`, `record_vitals` (aferidos), `view_medication_schedule` (somente horarios) |
| **Acoes Negadas**          | `create_nursing_note` (completa), `create_nursing_evolution`, `record_medication_administration`, `view_full_chart`, `view_clinical_data` |
| **Req. de Relacao**        | `nursing_team_assigned` com paciente ou unidade             |
| **Req. Local/Turno**       | Turno ativo na unidade atribuida                            |
| **Step-up Auth**           | Nao aplicavel                                               |
| **Nivel de Auditoria**     | Padrao                                                      |
| **Break-glass Elegivel**   | Nao                                                         |
| **Justificativa**          | Auxiliar de enfermagem conforme Lei 7.498/1986 Art. 13. Cuidados basicos sob supervisao. |

---

## 5. Roles de Equipe Multidisciplinar

### 5.1 pharmacist_clinical

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `pharmacist_clinical`                                       |
| **Nome de Exibicao**       | Farmaceutico(a) Clinico(a)                                  |
| **Conselho Profissional**  | CRF (Conselho Regional de Farmacia)                         |
| **Nivel de Acesso**        | 4                                                           |
| **Classes Permitidas**     | A, C (medicamentos, alergias, interacoes)                   |
| **Classes Negadas**        | B (exceto convenio para autorizacao), D (parcial), E        |
| **Acoes Permitidas**       | `view_medication_list`, `view_allergy_list`, `validate_prescription`, `flag_drug_interaction`, `create_pharmaceutical_note`, `dispense_medication`, `view_lab_results` (relacionados a farmacovigilancia) |
| **Acoes Negadas**          | `prescribe_medication`, `view_full_chart`, `create_medical_evolution`, `formulate_diagnosis` |
| **Req. de Relacao**        | `pharmacy_service` com a unidade ou `pharmaceutical_care` com paciente |
| **Req. Local/Turno**       | Horario de funcionamento da farmacia ou plantao             |
| **Step-up Auth**           | Para dispensacao de controlados (Portaria 344)               |
| **Nivel de Auditoria**     | Elevada                                                     |
| **Break-glass Elegivel**   | Nao                                                         |

### 5.2 physiotherapist

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `physiotherapist`                                           |
| **Nome de Exibicao**       | Fisioterapeuta                                              |
| **Conselho Profissional**  | CREFITO (Conselho Regional de Fisioterapia)                 |
| **Nivel de Acesso**        | 4                                                           |
| **Classes Permitidas**     | A, C (parcial: sinais vitais, evolucoes fisio, exames de imagem musculoesqueletica) |
| **Classes Negadas**        | B, D (exceto diagnostico funcional), E                      |
| **Acoes Permitidas**       | `view_clinical_summary`, `create_physiotherapy_evolution`, `view_imaging_results` (musculoesqueletico), `view_vitals`, `create_physiotherapy_plan`, `record_physiotherapy_session` |
| **Acoes Negadas**          | `prescribe_medication`, `view_full_chart`, `formulate_diagnosis` (nosologico), `approve_discharge` |
| **Req. de Relacao**        | `multidisciplinary_team` ou `physiotherapy_assigned`        |
| **Req. Local/Turno**       | Turno ativo                                                 |
| **Step-up Auth**           | Nao aplicavel                                               |
| **Nivel de Auditoria**     | Elevada                                                     |
| **Break-glass Elegivel**   | Nao                                                         |

### 5.3 nutritionist

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `nutritionist`                                              |
| **Nome de Exibicao**       | Nutricionista                                               |
| **Conselho Profissional**  | CRN (Conselho Regional de Nutricao)                         |
| **Nivel de Acesso**        | 4                                                           |
| **Classes Permitidas**     | A, C (parcial: alergias, dieta, exames bioquimicos)         |
| **Classes Negadas**        | B, D, E                                                     |
| **Acoes Permitidas**       | `view_clinical_summary`, `prescribe_diet`, `create_nutrition_evolution`, `view_lab_results` (bioquimica), `view_allergy_list`, `create_nutrition_assessment` |
| **Acoes Negadas**          | `prescribe_medication`, `view_full_chart`, `formulate_diagnosis` |
| **Req. de Relacao**        | `multidisciplinary_team` ou `nutrition_assigned`            |
| **Req. Local/Turno**       | Horario comercial ou plantao                                |
| **Step-up Auth**           | Nao aplicavel                                               |
| **Nivel de Auditoria**     | Padrao                                                      |
| **Break-glass Elegivel**   | Nao                                                         |

### 5.4 psychologist

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `psychologist`                                              |
| **Nome de Exibicao**       | Psicologo(a)                                                |
| **Conselho Profissional**  | CRP (Conselho Regional de Psicologia)                       |
| **Nivel de Acesso**        | 5                                                           |
| **Classes Permitidas**     | A, C (parcial), D (saude mental)                            |
| **Classes Negadas**        | B, E (anotacoes de psicoterapia sao Classe E - apenas o proprio psicologo acessa) |
| **Acoes Permitidas**       | `view_clinical_summary`, `create_psychology_evolution`, `view_mental_health_data`, `create_psychological_assessment`, `create_psychotherapy_notes` (Classe E - acesso restrito ao autor) |
| **Acoes Negadas**          | `prescribe_medication`, `view_full_chart`, `formulate_diagnosis` (nosologico), `view_psychotherapy_notes_other_professional` |
| **Req. de Relacao**        | `psychology_assigned` com paciente                          |
| **Req. Local/Turno**       | Horario comercial ou plantao psicologico                    |
| **Step-up Auth**           | Para `create_psychotherapy_notes` (Classe E)                |
| **Nivel de Auditoria**     | Maxima (para dados de saude mental)                         |
| **Break-glass Elegivel**   | Nao                                                         |

### 5.5 social_worker

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `social_worker`                                             |
| **Nome de Exibicao**       | Assistente Social                                           |
| **Conselho Profissional**  | CRESS (Conselho Regional de Servico Social)                 |
| **Nivel de Acesso**        | 3                                                           |
| **Classes Permitidas**     | A, B (parcial: dados sociais, contato familiar)             |
| **Classes Negadas**        | C (exceto resumo), D, E                                     |
| **Acoes Permitidas**       | `view_demographics`, `view_social_data`, `create_social_assessment`, `manage_family_contact`, `create_social_report`, `coordinate_discharge_social`, `notify_child_protection` |
| **Acoes Negadas**          | `view_clinical_data`, `prescribe_*`, `view_full_chart`      |
| **Req. de Relacao**        | `social_work_assigned` ou `multidisciplinary_team`          |
| **Req. Local/Turno**       | Horario comercial                                           |
| **Step-up Auth**           | Para `notify_child_protection`                              |
| **Nivel de Auditoria**     | Elevada                                                     |
| **Break-glass Elegivel**   | Nao                                                         |

### 5.6 speech_therapist

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `speech_therapist`                                          |
| **Nome de Exibicao**       | Fonoaudiologo(a)                                            |
| **Conselho Profissional**  | CRFa (Conselho Regional de Fonoaudiologia)                  |
| **Nivel de Acesso**        | 4                                                           |
| **Classes Permitidas**     | A, C (parcial: avaliacao fonoaudiologica, disfagia, exames) |
| **Classes Negadas**        | B, D, E                                                     |
| **Acoes Permitidas**       | `view_clinical_summary`, `create_speech_therapy_evolution`, `create_dysphagia_assessment`, `view_imaging_results` (relevantes), `create_speech_therapy_plan` |
| **Acoes Negadas**          | `prescribe_medication`, `view_full_chart`, `formulate_diagnosis` |
| **Req. de Relacao**        | `multidisciplinary_team` ou `speech_therapy_assigned`       |
| **Req. Local/Turno**       | Horario comercial ou plantao                                |
| **Step-up Auth**           | Nao aplicavel                                               |
| **Nivel de Auditoria**     | Padrao                                                      |
| **Break-glass Elegivel**   | Nao                                                         |

### 5.7 occupational_therapist

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `occupational_therapist`                                    |
| **Nome de Exibicao**       | Terapeuta Ocupacional                                       |
| **Conselho Profissional**  | CREFITO (Conselho Regional de Fisioterapia e Terapia Ocupacional) |
| **Nivel de Acesso**        | 4                                                           |
| **Classes Permitidas**     | A, C (parcial)                                              |
| **Classes Negadas**        | B, D, E                                                     |
| **Acoes Permitidas**       | `view_clinical_summary`, `create_ot_evolution`, `create_ot_assessment`, `create_ot_plan`, `view_functional_status` |
| **Acoes Negadas**          | `prescribe_medication`, `view_full_chart`, `formulate_diagnosis` |
| **Req. de Relacao**        | `multidisciplinary_team` ou `ot_assigned`                   |
| **Req. Local/Turno**       | Horario comercial                                           |
| **Step-up Auth**           | Nao aplicavel                                               |
| **Nivel de Auditoria**     | Padrao                                                      |
| **Break-glass Elegivel**   | Nao                                                         |

---

## 6. Roles de Apoio Diagnostico

### 6.1 lab_staff

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `lab_staff`                                                 |
| **Nome de Exibicao**       | Profissional de Laboratorio                                 |
| **Conselho Profissional**  | CRBM (Conselho Regional de Biomedicina) ou CRF              |
| **Nivel de Acesso**        | 4                                                           |
| **Classes Permitidas**     | A, C (resultados laboratoriais)                             |
| **Classes Negadas**        | B, D (exceto resultados do proprio setor), E                |
| **Acoes Permitidas**       | `view_lab_orders`, `input_lab_results`, `validate_lab_results`, `view_patient_demographics` (minimo para identificacao), `view_allergy_list` (para seguranca) |
| **Acoes Negadas**          | `view_full_chart`, `prescribe_*`, `create_*_evolution`      |
| **Req. de Relacao**        | `lab_service` com a unidade (nao com paciente individual)   |
| **Req. Local/Turno**       | Deve estar no laboratorio ou em turno de plantao            |
| **Step-up Auth**           | Para resultados criticos (notificacao obrigatoria)          |
| **Nivel de Auditoria**     | Elevada                                                     |
| **Break-glass Elegivel**   | Nao                                                         |

### 6.2 imaging_staff

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `imaging_staff`                                             |
| **Nome de Exibicao**       | Profissional de Diagnostico por Imagem                      |
| **Conselho Profissional**  | CRTR (Conselho Regional de Tecn. em Radiologia) ou CRM (radiologista) |
| **Nivel de Acesso**        | 4                                                           |
| **Classes Permitidas**     | A, C (resultados de imagem)                                 |
| **Classes Negadas**        | B, D (exceto laudos do proprio setor), E                    |
| **Acoes Permitidas**       | `view_imaging_orders`, `execute_imaging_exam`, `create_imaging_report`, `view_patient_demographics` (minimo), `view_clinical_indication` (para protocolo adequado) |
| **Acoes Negadas**          | `view_full_chart`, `prescribe_*`, `create_*_evolution`      |
| **Req. de Relacao**        | `imaging_service` com a unidade                             |
| **Req. Local/Turno**       | Turno ativo no setor de imagem                              |
| **Step-up Auth**           | Para achados criticos (notificacao obrigatoria)             |
| **Nivel de Auditoria**     | Elevada                                                     |
| **Break-glass Elegivel**   | Nao                                                         |

---

## 7. Roles Administrativos

### 7.1 receptionist_registration

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `receptionist_registration`                                 |
| **Nome de Exibicao**       | Recepcionista / Registro                                    |
| **Conselho Profissional**  | Nenhum                                                      |
| **Nivel de Acesso**        | 2                                                           |
| **Classes Permitidas**     | A, B (cadastro, convenio, contato)                          |
| **Classes Negadas**        | C, D, E                                                     |
| **Acoes Permitidas**       | `view_demographics`, `create_patient_registration`, `update_patient_registration`, `verify_insurance`, `schedule_appointment`, `check_in_patient`, `manage_waiting_list` |
| **Acoes Negadas**          | `view_clinical_data`, `view_patient_chart`, `prescribe_*`, `create_*_note` |
| **Req. de Relacao**        | Nenhuma (acesso por funcao, nao por relacao com paciente)   |
| **Req. Local/Turno**       | Estacao de trabalho da recepcao, turno ativo                |
| **Step-up Auth**           | Para alteracao de dados cadastrais sensiveis                |
| **Nivel de Auditoria**     | Padrao                                                      |
| **Break-glass Elegivel**   | Nao                                                         |

### 7.2 billing_authorization

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `billing_authorization`                                     |
| **Nome de Exibicao**       | Faturamento / Autorizacao                                   |
| **Conselho Profissional**  | Nenhum                                                      |
| **Nivel de Acesso**        | 3                                                           |
| **Classes Permitidas**     | A, B (completo: faturamento, convenio, guias, autorizacoes) |
| **Classes Negadas**        | C (exceto CID para faturamento - mascarado), D, E           |
| **Acoes Permitidas**       | `view_billing_data`, `create_billing_record`, `submit_tiss_guide`, `manage_authorization`, `view_procedure_codes`, `view_cid_for_billing` (mascarado), `generate_invoice` |
| **Acoes Negadas**          | `view_clinical_data`, `view_patient_chart`, `prescribe_*`   |
| **Req. de Relacao**        | Nenhuma (acesso por funcao)                                 |
| **Req. Local/Turno**       | Estacao de trabalho do faturamento, horario comercial        |
| **Step-up Auth**           | Para `generate_invoice` acima de valor limite                |
| **Nivel de Auditoria**     | Elevada                                                     |
| **Break-glass Elegivel**   | Nao                                                         |

---

## 8. Roles Operacionais

### 8.1 ambulance_driver

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `ambulance_driver`                                          |
| **Nome de Exibicao**       | Motorista de Ambulancia                                     |
| **Conselho Profissional**  | Nenhum (habilitacao categoria D + curso SAMU)               |
| **Nivel de Acesso**        | 1                                                           |
| **Classes Permitidas**     | A (operacional minimo)                                      |
| **Classes Negadas**        | B, C, D, E                                                  |
| **Acoes Permitidas**       | `view_transport_order`, `update_transport_status`, `view_destination` |
| **Acoes Negadas**          | Todos os demais                                             |
| **Req. de Relacao**        | `transport_assigned` com a ordem de transporte              |
| **Req. Local/Turno**       | Turno ativo                                                 |
| **Step-up Auth**           | Nao aplicavel                                               |
| **Nivel de Auditoria**     | Padrao                                                      |
| **Break-glass Elegivel**   | Nao                                                         |

### 8.2 patient_transporter

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `patient_transporter`                                       |
| **Nome de Exibicao**       | Maqueiro / Transportador de Paciente                        |
| **Conselho Profissional**  | Nenhum                                                      |
| **Nivel de Acesso**        | 1                                                           |
| **Classes Permitidas**     | A (numero do leito, destino, cuidados de transporte basicos)|
| **Classes Negadas**        | B, C, D, E                                                  |
| **Acoes Permitidas**       | `view_transport_order`, `update_transport_status`, `view_patient_location`, `view_transport_precautions` (ex: isolamento, oxigenio) |
| **Acoes Negadas**          | Todos os demais                                             |
| **Req. de Relacao**        | `transport_assigned` com a ordem de transporte              |
| **Req. Local/Turno**       | Turno ativo                                                 |
| **Step-up Auth**           | Nao aplicavel                                               |
| **Nivel de Auditoria**     | Padrao                                                      |
| **Break-glass Elegivel**   | Nao                                                         |

### 8.3 cleaning_hygiene

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `cleaning_hygiene`                                          |
| **Nome de Exibicao**       | Higienizacao / Limpeza                                      |
| **Conselho Profissional**  | Nenhum                                                      |
| **Nivel de Acesso**        | 1                                                           |
| **Classes Permitidas**     | A (status do leito, tipo de limpeza, precaucoes de isolamento) |
| **Classes Negadas**        | B, C, D, E                                                  |
| **Acoes Permitidas**       | `view_cleaning_order`, `update_cleaning_status`, `view_isolation_precautions`, `view_bed_status` |
| **Acoes Negadas**          | Todos os demais                                             |
| **Req. de Relacao**        | `cleaning_assigned` com o leito/quarto (nao com paciente)   |
| **Req. Local/Turno**       | Turno ativo                                                 |
| **Step-up Auth**           | Nao aplicavel                                               |
| **Nivel de Auditoria**     | Padrao                                                      |
| **Break-glass Elegivel**   | Nao                                                         |

### 8.4 maintenance

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `maintenance`                                               |
| **Nome de Exibicao**       | Manutencao                                                  |
| **Conselho Profissional**  | Nenhum (pode ter CREA para engenheiro)                      |
| **Nivel de Acesso**        | 0                                                           |
| **Classes Permitidas**     | A (somente dados de infraestrutura: sala, equipamento)      |
| **Classes Negadas**        | B, C, D, E                                                  |
| **Acoes Permitidas**       | `view_maintenance_order`, `update_maintenance_status`, `view_equipment_data`, `view_room_data` |
| **Acoes Negadas**          | Qualquer acesso a dados de pacientes                        |
| **Req. de Relacao**        | Nenhuma                                                     |
| **Req. Local/Turno**       | Turno ativo                                                 |
| **Step-up Auth**           | Nao aplicavel                                               |
| **Nivel de Auditoria**     | Padrao                                                      |
| **Break-glass Elegivel**   | Nao                                                         |

### 8.5 security_guard

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `security_guard`                                            |
| **Nome de Exibicao**       | Seguranca Patrimonial                                       |
| **Conselho Profissional**  | Nenhum (vigilante registrado na PF)                         |
| **Nivel de Acesso**        | 0                                                           |
| **Classes Permitidas**     | Nenhuma (dados de pacientes)                                |
| **Classes Negadas**        | A, B, C, D, E                                               |
| **Acoes Permitidas**       | `view_access_log_physical`, `manage_visitor_access`, `report_security_incident`, `view_camera_feeds` |
| **Acoes Negadas**          | Qualquer acesso a dados de pacientes ou clinicos            |
| **Req. de Relacao**        | Nenhuma                                                     |
| **Req. Local/Turno**       | Turno ativo                                                 |
| **Step-up Auth**           | Nao aplicavel                                               |
| **Nivel de Auditoria**     | Padrao                                                      |
| **Break-glass Elegivel**   | Nao                                                         |

---

## 9. Roles de Gestao Assistencial

### 9.1 bed_management

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `bed_management`                                            |
| **Nome de Exibicao**       | Gestao de Leitos                                            |
| **Conselho Profissional**  | Nenhum (ou COREN se enfermeiro)                             |
| **Nivel de Acesso**        | 2                                                           |
| **Classes Permitidas**     | A (leitos, quartos, status), B (parcial: nome, convenio)    |
| **Classes Negadas**        | C, D, E                                                     |
| **Acoes Permitidas**       | `view_bed_census`, `manage_bed_allocation`, `view_patient_location`, `view_admission_summary`, `coordinate_transfers`, `view_isolation_status` |
| **Acoes Negadas**          | `view_clinical_data`, `view_patient_chart`, `prescribe_*`   |
| **Req. de Relacao**        | Nenhuma (funcao operacional)                                |
| **Req. Local/Turno**       | Horario comercial ou plantao NIR                            |
| **Step-up Auth**           | Nao aplicavel                                               |
| **Nivel de Auditoria**     | Padrao                                                      |
| **Break-glass Elegivel**   | Nao                                                         |

### 9.2 case_manager

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `case_manager`                                              |
| **Nome de Exibicao**       | Gestor de Caso / Coordenador de Cuidados                    |
| **Conselho Profissional**  | Variavel (COREN, CRM, ou sem conselho)                      |
| **Nivel de Acesso**        | 4                                                           |
| **Classes Permitidas**     | A, B, C (parcial: resumo clinico, pendencias, plano de alta)|
| **Classes Negadas**        | D, E                                                        |
| **Acoes Permitidas**       | `view_clinical_summary`, `view_discharge_plan`, `coordinate_discharge`, `view_pending_tasks`, `create_case_management_note`, `view_length_of_stay`, `manage_care_transitions` |
| **Acoes Negadas**          | `view_full_chart`, `prescribe_*`, `create_medical_evolution` |
| **Req. de Relacao**        | `case_management_assigned` com paciente                     |
| **Req. Local/Turno**       | Horario comercial                                           |
| **Step-up Auth**           | Nao aplicavel                                               |
| **Nivel de Auditoria**     | Elevada                                                     |
| **Break-glass Elegivel**   | Nao                                                         |

---

## 10. Roles de Auditoria e Compliance

### 10.1 compliance_auditor

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `compliance_auditor`                                        |
| **Nome de Exibicao**       | Auditor de Compliance                                       |
| **Conselho Profissional**  | Variavel (pode ter OAB, CRC)                                |
| **Nivel de Acesso**        | 5 (somente leitura, auditoria)                              |
| **Classes Permitidas**     | A, B, C, D (somente para fins de auditoria)                 |
| **Classes Negadas**        | E (requer aprovacao do DPO + clinical_director)             |
| **Acoes Permitidas**       | `view_audit_logs`, `view_access_reports`, `view_compliance_dashboard`, `generate_compliance_report`, `review_break_glass_events`, `view_patient_chart` (read-only, para auditoria) |
| **Acoes Negadas**          | `create_*`, `update_*`, `delete_*`, `prescribe_*` (somente leitura) |
| **Req. de Relacao**        | Nenhuma (funcao de auditoria independente)                   |
| **Req. Local/Turno**       | Horario comercial + acesso remoto autorizado                |
| **Step-up Auth**           | Para todo acesso a dados clinicos                           |
| **Nivel de Auditoria**     | Maxima (quis custodiet ipsos custodes)                      |
| **Break-glass Elegivel**   | Nao                                                         |

### 10.2 internal_auditor

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `internal_auditor`                                          |
| **Nome de Exibicao**       | Auditor Interno                                             |
| **Conselho Profissional**  | Variavel (CRC, OAB)                                        |
| **Nivel de Acesso**        | 3                                                           |
| **Classes Permitidas**     | A, B                                                        |
| **Classes Negadas**        | C, D, E                                                     |
| **Acoes Permitidas**       | `view_audit_logs`, `view_financial_reports`, `view_operational_reports`, `generate_internal_audit_report` |
| **Acoes Negadas**          | `view_clinical_data`, `view_patient_chart`, `create_*`      |
| **Req. de Relacao**        | Nenhuma                                                     |
| **Req. Local/Turno**       | Horario comercial                                           |
| **Step-up Auth**           | Para relatorios financeiros detalhados                      |
| **Nivel de Auditoria**     | Maxima                                                      |
| **Break-glass Elegivel**   | Nao                                                         |

---

## 11. Roles JIT (Just-In-Time) e de Emergencia

### 11.1 it_support_jit

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `it_support_jit`                                            |
| **Nome de Exibicao**       | Suporte de TI (Acesso Temporario)                           |
| **Conselho Profissional**  | Nenhum                                                      |
| **Nivel de Acesso**        | 0 (sem dados de pacientes)                                  |
| **Classes Permitidas**     | Nenhuma                                                     |
| **Classes Negadas**        | A, B, C, D, E                                               |
| **Acoes Permitidas**       | `view_system_logs`, `manage_user_accounts` (sem ver dados clinicos), `troubleshoot_system`, `view_system_metrics`, `manage_integrations` |
| **Acoes Negadas**          | Qualquer acesso a dados de pacientes                        |
| **Req. de Relacao**        | Nenhuma                                                     |
| **Req. Local/Turno**       | Ativacao JIT: ticket obrigatorio, duracao maxima 4h, aprovacao do gestor |
| **Step-up Auth**           | Para toda ativacao do role                                  |
| **Nivel de Auditoria**     | Maxima                                                      |
| **Break-glass Elegivel**   | Nao                                                         |
| **JIT Config**             | `max_duration: 4h`, `requires_ticket: true`, `auto_revoke: true`, `approver: security_admin` |

### 11.2 security_admin_jit

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `security_admin_jit`                                        |
| **Nome de Exibicao**       | Administrador de Seguranca (Acesso Temporario)              |
| **Conselho Profissional**  | Nenhum                                                      |
| **Nivel de Acesso**        | 0 (sem dados de pacientes, acesso a configuracao de seguranca) |
| **Classes Permitidas**     | Nenhuma                                                     |
| **Classes Negadas**        | A, B, C, D, E                                               |
| **Acoes Permitidas**       | `manage_access_policies`, `manage_roles`, `view_security_logs`, `manage_mfa_settings`, `manage_certificates`, `respond_to_security_incident` |
| **Acoes Negadas**          | Qualquer acesso a dados de pacientes, `assign_own_role`     |
| **Req. de Relacao**        | Nenhuma                                                     |
| **Req. Local/Turno**       | Ativacao JIT: dual approval, duracao maxima 2h              |
| **Step-up Auth**           | Para toda ativacao do role + MFA fisico (hardware key)      |
| **Nivel de Auditoria**     | Maxima                                                      |
| **Break-glass Elegivel**   | Nao                                                         |
| **JIT Config**             | `max_duration: 2h`, `requires_dual_approval: true`, `approvers: [clinical_director, hospital_owner_executive]`, `auto_revoke: true` |

### 11.3 emergency_break_glass_role

| Atributo                   | Valor                                                      |
|----------------------------|-------------------------------------------------------------|
| **Role ID**                | `emergency_break_glass_role`                                |
| **Nome de Exibicao**       | Acesso de Emergencia (Break-Glass)                          |
| **Conselho Profissional**  | CRM ou COREN-Enfermeiro (obrigatorio)                       |
| **Nivel de Acesso**        | 7                                                           |
| **Classes Permitidas**     | A, B, C, D, E                                               |
| **Classes Negadas**        | Nenhuma (acesso total temporario)                           |
| **Acoes Permitidas**       | `view_full_chart`, `view_sensitive_records`, `view_restricted_records`, `prescribe_medication` (emergencia), `create_medical_evolution` (emergencia) |
| **Acoes Negadas**          | `delete_*`, `export_data`, `print_record` (durante break-glass), `modify_access_policies` |
| **Req. de Relacao**        | Nenhuma (bypassa ReBAC - este e o proposito do break-glass) |
| **Req. Local/Turno**       | Deve estar fisicamente no hospital (verificacao de IP/rede)  |
| **Step-up Auth**           | Obrigatorio: MFA + justificativa escrita + reconhecimento de auditoria |
| **Nivel de Auditoria**     | Maxima + Alerta em tempo real                               |
| **Break-glass Elegivel**   | N/A (este E o role de break-glass)                          |
| **Duracao**                | Classe C: 4h, Classe D: 2h, Classe E: 1h                   |
| **Revisao Obrigatoria**    | Dentro de 24h por `clinical_director` + `compliance_auditor` |

---

## 12. Tabela Resumo de Roles

| Role ID                     | Nivel | Classes | Break-Glass | Auditoria | JIT  |
|-----------------------------|-------|---------|-------------|-----------|------|
| hospital_owner_executive    | 3     | A,B     | Nao         | Elevada   | Nao  |
| clinical_director           | 6     | A-E*    | Sim         | Maxima    | Nao  |
| medical_staff_attending     | 5     | A-D     | Sim         | Elevada   | Nao  |
| medical_staff_on_call       | 5     | A-D     | Sim         | Elevada   | Nao  |
| nurse                       | 5     | A-D     | Sim         | Elevada   | Nao  |
| nursing_technician          | 4     | A,C*    | Nao         | Elevada   | Nao  |
| nursing_assistant           | 4     | A,C*    | Nao         | Padrao    | Nao  |
| pharmacist_clinical         | 4     | A,C*    | Nao         | Elevada   | Nao  |
| physiotherapist             | 4     | A,C*    | Nao         | Elevada   | Nao  |
| nutritionist                | 4     | A,C*    | Nao         | Padrao    | Nao  |
| psychologist                | 5     | A,C*,D* | Nao         | Maxima    | Nao  |
| social_worker               | 3     | A,B*    | Nao         | Elevada   | Nao  |
| speech_therapist            | 4     | A,C*    | Nao         | Padrao    | Nao  |
| occupational_therapist      | 4     | A,C*    | Nao         | Padrao    | Nao  |
| lab_staff                   | 4     | A,C*    | Nao         | Elevada   | Nao  |
| imaging_staff               | 4     | A,C*    | Nao         | Elevada   | Nao  |
| receptionist_registration   | 2     | A,B     | Nao         | Padrao    | Nao  |
| billing_authorization       | 3     | A,B     | Nao         | Elevada   | Nao  |
| ambulance_driver            | 1     | A       | Nao         | Padrao    | Nao  |
| patient_transporter         | 1     | A       | Nao         | Padrao    | Nao  |
| cleaning_hygiene            | 1     | A       | Nao         | Padrao    | Nao  |
| maintenance                 | 0     | A*      | Nao         | Padrao    | Nao  |
| security_guard              | 0     | -       | Nao         | Padrao    | Nao  |
| bed_management              | 2     | A,B*    | Nao         | Padrao    | Nao  |
| case_manager                | 4     | A,B,C*  | Nao         | Elevada   | Nao  |
| compliance_auditor          | 5     | A-D*    | Nao         | Maxima    | Nao  |
| internal_auditor            | 3     | A,B     | Nao         | Maxima    | Nao  |
| it_support_jit              | 0     | -       | Nao         | Maxima    | Sim  |
| security_admin_jit          | 0     | -       | Nao         | Maxima    | Sim  |
| emergency_break_glass_role  | 7     | A-E     | N/A         | Maxima+   | Sim* |

> `*` indica acesso parcial a classe - consultar detalhes do role acima.
> `JIT Sim*` para break-glass indica ativacao sob demanda com duracao limitada.

---

## 13. Governanca de Roles

### 13.1 Ciclo de Vida de um Role

```
PROPOSTA --> REVISAO JURIDICA --> REVISAO CLINICA --> APROVACAO --> IMPLEMENTACAO --> MONITORAMENTO --> REVISAO PERIODICA
                                                                                          |
                                                                                   Anomalia detectada?
                                                                                          |
                                                                                   SIM --> REVISAO EXTRAORDINARIA
```

### 13.2 Responsabilidades

| Atividade                     | Responsavel                              | Frequencia   |
|-------------------------------|------------------------------------------|--------------|
| Criar/modificar role          | Seguranca da Informacao + Diretoria Clinica | Sob demanda |
| Revisar permissoes de role    | Compliance + Diretoria Clinica           | Trimestral   |
| Atribuir role a usuario       | Gestor do setor + RH                     | Admissao/transferencia |
| Revogar role de usuario       | RH + TI (automatizado no desligamento)   | Desligamento/afastamento |
| Auditar atribuicoes de roles  | Compliance                               | Mensal       |
| Revisar roles JIT             | Seguranca da Informacao                  | Semanal      |

---

*Documento mantido pela equipe de Arquitetura de Seguranca - Velya Platform.*
*Proxima revisao programada: 2026-07-08.*
