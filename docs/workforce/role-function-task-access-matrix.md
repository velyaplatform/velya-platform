# Matriz de Papel, Funcao, Tarefa e Acesso

> 47 papeis institucionais mapeados para tarefas especificas, visibilidade de dados, niveis de validacao e capacidades de handoff.

## 1. Visao Geral

Esta matriz define, para cada papel institucional, exatamente quais tarefas pode executar, quais dados pode visualizar ao executar cada tarefa, qual nivel de validacao/assinatura e exigido, e se pode iniciar ou aceitar handoffs.

### 1.1 Estrutura da Matriz

Cada entrada na matriz responde:

- **Papel**: Quem e o profissional.
- **Tarefa**: O que ele pode fazer.
- **Visibilidade por tarefa**: O que ele ve ao fazer essa tarefa.
- **Validacao**: Que nivel de confirmacao/assinatura e exigido.
- **Handoff**: Pode iniciar, aceitar, ou nenhum.

### 1.2 Legenda de Visibilidade

| Codigo | Significado                          |
| ------ | ------------------------------------ |
| **F**  | Full (completo)                      |
| **S**  | Summary (resumo)                     |
| **R**  | Relevant only (apenas pertinentes)   |
| **O**  | Own only (apenas proprios registros) |
| **M**  | Masked (mascarado/parcial)           |
| **N**  | None (sem acesso)                    |

### 1.3 Legenda de Validacao

| Codigo   | Significado                                                  |
| -------- | ------------------------------------------------------------ |
| **SIG**  | Assinatura digital (certificado ICP-Brasil ou institucional) |
| **DSIG** | Dupla assinatura (duas credenciais diferentes)               |
| **PIN**  | Confirmacao com PIN/senha adicional                          |
| **CHK**  | Dupla checagem por outro profissional                        |
| **ACK**  | Simples confirmacao (acknowledge)                            |
| **NONE** | Sem validacao adicional (registro automatico)                |

---

## 2. Catalogo de 47 Papeis

### 2.1 Papeis Medicos (8)

| #   | Papel                         | Codigo             | Credencial     |
| --- | ----------------------------- | ------------------ | -------------- |
| 1   | Medico Diarista               | `MED_DIARISTA`     | CRM            |
| 2   | Medico Plantonista            | `MED_PLANTONISTA`  | CRM            |
| 3   | Medico Residente (R1-R2)      | `MED_RESIDENTE_JR` | CRM provisorio |
| 4   | Medico Residente (R3+)        | `MED_RESIDENTE_SR` | CRM provisorio |
| 5   | Medico Especialista Consultor | `MED_CONSULTOR`    | CRM + RQE      |
| 6   | Medico Cirurgiao              | `MED_CIRURGIAO`    | CRM + RQE      |
| 7   | Medico Intensivista           | `MED_INTENSIVISTA` | CRM + RQE (MI) |
| 8   | Medico Emergencista           | `MED_EMERGENCISTA` | CRM            |

### 2.2 Papeis de Enfermagem (7)

| #   | Papel                          | Codigo             | Credencial          |
| --- | ------------------------------ | ------------------ | ------------------- |
| 9   | Enfermeiro Assistencial        | `ENF_ASSISTENCIAL` | COREN               |
| 10  | Enfermeiro Lider/Coordenador   | `ENF_LIDER`        | COREN               |
| 11  | Enfermeiro de Centro Cirurgico | `ENF_CC`           | COREN               |
| 12  | Enfermeiro de UTI              | `ENF_UTI`          | COREN + especializ. |
| 13  | Enfermeiro de Emergencia       | `ENF_EMERG`        | COREN               |
| 14  | Tecnico de Enfermagem          | `TEC_ENF`          | COREN               |
| 15  | Auxiliar de Enfermagem         | `AUX_ENF`          | COREN               |

### 2.3 Papeis de Farmacia (4)

| #   | Papel                            | Codigo         | Credencial |
| --- | -------------------------------- | -------------- | ---------- |
| 16  | Farmaceutico Clinico             | `FARM_CLINICO` | CRF        |
| 17  | Farmaceutico Dispensacao         | `FARM_DISP`    | CRF        |
| 18  | Tecnico de Farmacia              | `TEC_FARM`     | CRF        |
| 19  | Farmaceutico Responsavel Tecnico | `FARM_RT`      | CRF        |

### 2.4 Papeis de Reabilitacao (5)

| #   | Papel                       | Codigo        | Credencial |
| --- | --------------------------- | ------------- | ---------- |
| 20  | Fisioterapeuta Respiratorio | `FISIO_RESP`  | CREFITO    |
| 21  | Fisioterapeuta Motor        | `FISIO_MOTOR` | CREFITO    |
| 22  | Terapeuta Ocupacional       | `TO`          | CREFITO    |
| 23  | Fonoaudiologo               | `FONO`        | CRFa       |
| 24  | Psicologo                   | `PSICO`       | CRP        |

### 2.5 Papeis de Nutricao e Servico Social (3)

| #   | Papel                     | Codigo          | Credencial |
| --- | ------------------------- | --------------- | ---------- |
| 25  | Nutricionista Clinico     | `NUTRI_CLINICO` | CRN        |
| 26  | Nutricionista de Producao | `NUTRI_PROD`    | CRN        |
| 27  | Assistente Social         | `ASSIST_SOCIAL` | CRESS      |

### 2.6 Papeis de Diagnostico (5)

| #   | Papel                           | Codigo      | Credencial |
| --- | ------------------------------- | ----------- | ---------- |
| 28  | Biomedico/Bioquimico            | `BIOMED`    | CRBM       |
| 29  | Tecnico de Laboratorio          | `TEC_LAB`   | CRF/CRBM   |
| 30  | Tecnico de Radiologia           | `TEC_RADIO` | CRTR       |
| 31  | Tecnico de ECG/Neurofisiologia  | `TEC_NEURO` | COREN/CRTR |
| 32  | Medico Patologista/Radiologista | `MED_DIAG`  | CRM + RQE  |

### 2.7 Papeis Administrativos e de Apoio (8)

| #   | Papel                    | Codigo       | Credencial |
| --- | ------------------------ | ------------ | ---------- |
| 33  | Recepcionista/Admissao   | `RECEPCAO`   | N/A        |
| 34  | Faturista                | `FATURISTA`  | N/A        |
| 35  | Codificador SAME         | `CODIF_SAME` | N/A        |
| 36  | Auditor Interno          | `AUDITOR`    | CRM/COREN  |
| 37  | Analista de Qualidade    | `QUALIDADE`  | N/A        |
| 38  | Capelao/Apoio Espiritual | `CAPELAO`    | N/A        |
| 39  | Maqueiro/Transportador   | `MAQUEIRO`   | N/A        |
| 40  | Higienizacao             | `HIGIENIZ`   | N/A        |

### 2.8 Papeis de Gestao e Diretoria (4)

| #   | Papel                      | Codigo           | Credencial |
| --- | -------------------------- | ---------------- | ---------- |
| 41  | Diretor Clinico            | `DIR_CLINICO`    | CRM        |
| 42  | Diretor de Enfermagem      | `DIR_ENFERMAGEM` | COREN      |
| 43  | Diretor Administrativo     | `DIR_ADMIN`      | N/A        |
| 44  | DPO (Encarregado de Dados) | `DPO`            | N/A        |

### 2.9 Papeis de Tecnologia (3)

| #   | Papel                               | Codigo        | Credencial |
| --- | ----------------------------------- | ------------- | ---------- |
| 45  | Administrador de Sistemas           | `ADMIN_TI`    | N/A        |
| 46  | DBA                                 | `DBA`         | N/A        |
| 47  | Analista de Seguranca da Informacao | `SEC_ANALYST` | N/A        |

---

## 3. Matriz Principal: Tarefas Clinicas

### 3.1 Prescricao e Ordens

| Tarefa                        | MED_DIARISTA  | MED_PLANTONISTA | MED_RESIDENTE_JR       | MED_RESIDENTE_SR | ENF_ASSISTENCIAL | FARM_CLINICO | Visibilidade                               | Validacao           |
| ----------------------------- | ------------- | --------------- | ---------------------- | ---------------- | ---------------- | ------------ | ------------------------------------------ | ------------------- |
| Prescrever medicamento        | Sim           | Sim             | Sim (co-sign)          | Sim              | Nao              | Nao          | F: paciente, F: alergias, F: interacoes    | SIG                 |
| Prescrever med. controlado    | Sim           | Sim             | Nao                    | Sim (co-sign)    | Nao              | Nao          | F: paciente, F: alergias, F: historico uso | SIG + PIN           |
| Solicitar exame laboratorial  | Sim           | Sim             | Sim                    | Sim              | Nao              | Nao          | F: paciente, S: resultados anteriores      | SIG                 |
| Solicitar exame de imagem     | Sim           | Sim             | Sim (co-sign)          | Sim              | Nao              | Nao          | F: paciente, S: imagens anteriores         | SIG                 |
| Solicitar interconsulta       | Sim           | Sim             | Sim (co-sign)          | Sim              | Nao              | Nao          | F: paciente (resumo para consultor)        | SIG                 |
| Prescrever dieta              | Sim           | Sim             | Sim                    | Sim              | Nao              | Nao          | F: paciente, R: alergias alimentares       | SIG                 |
| Cancelar ordem                | Sim (propria) | Sim (do turno)  | Sim (propria, co-sign) | Sim (propria)    | Nao              | Nao          | F: ordem original                          | SIG + justificativa |
| Validar prescricao (farmacia) | Nao           | Nao             | Nao                    | Nao              | Nao              | Sim          | F: prescricao, F: alergias, F: interacoes  | SIG                 |

### 3.2 Administracao e Execucao

| Tarefa                           | ENF_ASSISTENCIAL | TEC_ENF | AUX_ENF | FARM_DISP | ENF_UTI | Visibilidade                         | Validacao     |
| -------------------------------- | ---------------- | ------- | ------- | --------- | ------- | ------------------------------------ | ------------- |
| Administrar medicamento VO/SC/IM | Sim              | Sim     | Sim     | Nao       | Sim     | F: prescricao, M: diagnostico        | ACK           |
| Administrar medicamento IV       | Sim              | Sim     | Nao     | Nao       | Sim     | F: prescricao, F: alergias           | ACK           |
| Administrar med. alto risco      | Sim              | Nao     | Nao     | Nao       | Sim     | F: prescricao, F: alergias, F: peso  | CHK (dupla)   |
| Administrar hemoderivado         | Sim              | Nao     | Nao     | Nao       | Sim     | F: prescricao, F: tipagem, F: provas | DSIG          |
| Registrar omissao de dose        | Sim              | Sim     | Sim     | Nao       | Sim     | R: prescricao, R: motivo             | ACK + justif. |
| Dispensar medicamento            | Nao              | Nao     | Nao     | Sim       | Nao     | F: prescricao, M: paciente           | ACK           |
| Coletar exame laboratorial       | Sim              | Sim     | Sim     | Nao       | Sim     | R: solicitacao, M: paciente          | ACK           |
| Realizar procedimento simples    | Sim              | Sim     | Nao     | Nao       | Sim     | R: solicitacao, R: paciente          | ACK           |

### 3.3 Avaliacao e Registro

| Tarefa                   | ENF_ASSISTENCIAL | TEC_ENF | MED_DIARISTA | FISIO_RESP | NUTRI_CLINICO | PSICO | Visibilidade                         | Validacao |
| ------------------------ | ---------------- | ------- | ------------ | ---------- | ------------- | ----- | ------------------------------------ | --------- |
| Registrar sinais vitais  | Sim              | Sim     | Nao          | Sim (resp) | Nao           | Nao   | R: sinais prev., M: paciente         | NONE      |
| Avaliar dor              | Sim              | Sim     | Sim          | Nao        | Nao           | Nao   | R: dor prev., R: analgesicos         | NONE      |
| Avaliar risco de queda   | Sim              | Nao     | Nao          | Sim        | Nao           | Nao   | R: mobilidade, R: medicamentos       | ACK       |
| Avaliar integridade pele | Sim              | Nao     | Nao          | Nao        | Nao           | Nao   | R: avaliacoes prev., R: dispositivos | ACK       |
| Evolucao medica          | Nao              | Nao     | Sim          | Nao        | Nao           | Nao   | F: paciente completo                 | SIG       |
| Evolucao de enfermagem   | Sim              | Nao     | Nao          | Nao        | Nao           | Nao   | F: paciente (enf.)                   | SIG       |
| Anotacao de enfermagem   | Sim              | Sim     | Nao          | Nao        | Nao           | Nao   | R: paciente (enf.)                   | NONE      |
| Evolucao fisioterapia    | Nao              | Nao     | Nao          | Sim        | Nao           | Nao   | R: respiratorio, R: motor            | SIG       |
| Evolucao nutricional     | Nao              | Nao     | Nao          | Nao        | Sim           | Nao   | R: dieta, R: laboratorio             | SIG       |
| Evolucao psicologica     | Nao              | Nao     | Nao          | Nao        | Nao           | Sim   | R: psicologico (restrito)            | SIG       |

---

## 4. Matriz de Handoff

### 4.1 Capacidade de Handoff por Papel

| #     | Papel            | Pode Iniciar Handoff  | Pode Aceitar Handoff | Pode Recusar | Tipos Permitidos                       |
| ----- | ---------------- | --------------------- | -------------------- | ------------ | -------------------------------------- |
| 1     | MED_DIARISTA     | Sim                   | Sim                  | Sim          | shift_change, transfer, escalation     |
| 2     | MED_PLANTONISTA  | Sim                   | Sim                  | Sim          | shift_change, transfer, escalation     |
| 3     | MED_RESIDENTE_JR | Sim (com supervisor)  | Sim (com supervisor) | Sim          | shift_change                           |
| 4     | MED_RESIDENTE_SR | Sim                   | Sim                  | Sim          | shift_change, transfer                 |
| 5     | MED_CONSULTOR    | Nao (recebe consulta) | Sim (consulta)       | Sim          | consultation                           |
| 6     | MED_CIRURGIAO    | Sim                   | Sim                  | Sim          | shift_change, transfer                 |
| 7     | MED_INTENSIVISTA | Sim                   | Sim                  | Sim          | shift_change, transfer, escalation     |
| 8     | MED_EMERGENCISTA | Sim                   | Sim                  | Sim          | shift_change, transfer, escalation     |
| 9     | ENF_ASSISTENCIAL | Sim                   | Sim                  | Sim          | shift_change, break_coverage, transfer |
| 10    | ENF_LIDER        | Sim                   | Sim                  | Sim          | Todos                                  |
| 11    | ENF_CC           | Sim                   | Sim                  | Sim          | shift_change, transfer (CC)            |
| 12    | ENF_UTI          | Sim                   | Sim                  | Sim          | shift_change, break_coverage, transfer |
| 13    | ENF_EMERG        | Sim                   | Sim                  | Sim          | shift_change, break_coverage, transfer |
| 14    | TEC_ENF          | Sim                   | Sim                  | Sim          | shift_change, break_coverage           |
| 15    | AUX_ENF          | Sim (limitado)        | Sim                  | Sim          | shift_change                           |
| 16    | FARM_CLINICO     | Nao                   | Nao                  | N/A          | N/A                                    |
| 17    | FARM_DISP        | Nao                   | Nao                  | N/A          | N/A                                    |
| 18    | TEC_FARM         | Nao                   | Nao                  | N/A          | N/A                                    |
| 19    | FARM_RT          | Nao                   | Nao                  | N/A          | N/A                                    |
| 20    | FISIO_RESP       | Sim                   | Sim                  | Sim          | shift_change (fisio)                   |
| 21    | FISIO_MOTOR      | Sim                   | Sim                  | Sim          | shift_change (fisio)                   |
| 22    | TO               | Sim                   | Sim                  | Sim          | shift_change (TO)                      |
| 23    | FONO             | Sim                   | Sim                  | Sim          | shift_change (fono)                    |
| 24    | PSICO            | Sim                   | Sim                  | Sim          | shift_change (psico)                   |
| 25    | NUTRI_CLINICO    | Sim                   | Sim                  | Sim          | shift_change (nutri)                   |
| 26    | NUTRI_PROD       | Nao                   | Nao                  | N/A          | N/A                                    |
| 27    | ASSIST_SOCIAL    | Sim                   | Sim                  | Sim          | shift_change (social)                  |
| 28-32 | Diagnostico      | Nao                   | Nao                  | N/A          | N/A                                    |
| 33-35 | Admin            | Nao                   | Nao                  | N/A          | N/A                                    |
| 36    | AUDITOR          | Nao                   | Nao                  | N/A          | N/A                                    |
| 37    | QUALIDADE        | Nao                   | Nao                  | N/A          | N/A                                    |
| 38    | CAPELAO          | Nao                   | Nao                  | N/A          | N/A                                    |
| 39    | MAQUEIRO         | Sim (transporte)      | Sim (transporte)     | Sim          | transport                              |
| 40    | HIGIENIZ         | Nao                   | Nao                  | N/A          | N/A                                    |
| 41-44 | Diretoria        | Sim (escalacao)       | Sim (escalacao)      | Sim          | escalation                             |
| 45-47 | TI               | Nao                   | Nao                  | N/A          | N/A                                    |

---

## 5. Matriz de Visibilidade de Dados por Tarefa

### 5.1 Detalhamento por Campo Sensivel

| Campo                | MED (assistente) | ENF (assistente) | TEC_ENF | FARM | FISIO | NUTRI | PSICO | ASSIST_SOC | ADMIN | AUDITOR         |
| -------------------- | ---------------- | ---------------- | ------- | ---- | ----- | ----- | ----- | ---------- | ----- | --------------- |
| Nome completo        | F                | F                | F       | F    | F     | F     | F     | F          | F     | F               |
| CPF                  | F                | M                | N       | N    | N     | N     | N     | M          | F     | F               |
| Endereco completo    | F                | M                | N       | N    | N     | N     | N     | F          | F     | F               |
| Telefone             | F                | F                | N       | N    | N     | N     | F     | F          | F     | M               |
| Contato emergencia   | F                | F                | N       | N    | N     | N     | N     | F          | F     | M               |
| Convenio/plano       | S                | N                | N       | N    | N     | N     | N     | N          | F     | F               |
| Diagnostico (CID)    | F                | F                | S       | S    | R     | R     | F     | S          | S     | F               |
| Diagnostico (texto)  | F                | F                | N       | S    | R     | R     | F     | S          | N     | F               |
| Prescricao med.      | F                | F                | R       | F    | R     | R     | N     | N          | N     | F               |
| Resultados lab.      | F                | F                | N       | R    | R     | R     | N     | N          | N     | F               |
| Sinais vitais        | F                | F                | F       | S    | F     | S     | N     | N          | N     | F               |
| Notas medicas        | F                | S                | N       | S    | R     | R     | R     | N          | N     | F               |
| Notas enfermagem     | F                | F                | F       | S    | R     | R     | N     | N          | N     | F               |
| Notas psiquiatricas  | R (se psiq)      | N                | N       | N    | N     | N     | F     | R          | N     | F (anonimizado) |
| Historico sexual/IST | F                | F                | N       | N    | N     | N     | F     | N          | N     | F (anonimizado) |
| Uso de substancias   | F                | F                | N       | N    | N     | N     | F     | F          | N     | F (anonimizado) |
| Dados geneticos      | R (se gen)       | N                | N       | N    | N     | N     | N     | N          | N     | N               |
| Historico social     | S                | S                | N       | N    | N     | S     | F     | F          | N     | S               |
| Dados financeiros    | N                | N                | N       | N    | N     | N     | N     | R          | F     | F               |
| Custos assistenciais | N                | N                | N       | N    | N     | N     | N     | N          | F     | F               |

---

## 6. Matriz de Assinaturas Obrigatorias

### 6.1 Por Tipo de Documento

| Documento                            | Autor                           | Validacao Minima                   | Co-assinatura             | Prazo                     |
| ------------------------------------ | ------------------------------- | ---------------------------------- | ------------------------- | ------------------------- |
| Evolucao medica                      | Medico                          | SIG (CRM)                          | Preceptor se residente JR | Fim do turno              |
| Evolucao de enfermagem               | Enfermeiro                      | SIG (COREN)                        | N/A                       | Fim do turno              |
| Prescricao medica                    | Medico                          | SIG (CRM)                          | Preceptor se residente JR | Imediato                  |
| Prescricao controlada (portaria 344) | Medico                          | SIG (CRM) + PIN                    | N/A                       | Imediato                  |
| Nota cirurgica                       | Cirurgiao                       | SIG (CRM)                          | N/A                       | 2h pos-procedimento       |
| Nota anestesica                      | Anestesista                     | SIG (CRM)                          | N/A                       | Imediato pos-procedimento |
| Laudo de exame                       | Medico patologista/radiologista | SIG (CRM + RQE)                    | N/A                       | Conforme SLA              |
| Consentimento informado              | Medico + Paciente               | SIG (medico) + assinatura paciente | Testemunha                | Antes do procedimento     |
| Resumo de alta                       | Medico                          | SIG (CRM)                          | N/A                       | No momento da alta        |
| Declaracao de obito                  | Medico                          | SIG (CRM)                          | N/A                       | Imediato                  |
| Evolucao fisioterapia                | Fisioterapeuta                  | SIG (CREFITO)                      | N/A                       | Fim da sessao             |
| Evolucao nutricional                 | Nutricionista                   | SIG (CRN)                          | N/A                       | Fim do turno              |
| Evolucao psicologica                 | Psicologo                       | SIG (CRP)                          | N/A                       | Fim da sessao             |
| Parecer de assistente social         | Assistente social               | SIG (CRESS)                        | N/A                       | 24h                       |
| Validacao farmaceutica               | Farmaceutico                    | SIG (CRF)                          | N/A                       | Antes da dispensacao      |

---

## 7. Regras de Delegacao

### 7.1 Quem Pode Delegar para Quem

| Delegante        | Delegatario      | Restricoes                               |
| ---------------- | ---------------- | ---------------------------------------- |
| MED_DIARISTA     | MED_RESIDENTE_SR | Co-assinatura do diarista                |
| MED_DIARISTA     | MED_RESIDENTE_JR | Co-assinatura obrigatoria do diarista    |
| MED_PLANTONISTA  | MED_RESIDENTE_SR | Co-assinatura do plantonista             |
| ENF_ASSISTENCIAL | TEC_ENF          | Apenas tarefas de competencia do tecnico |
| ENF_LIDER        | ENF_ASSISTENCIAL | Qualquer tarefa de enfermagem            |
| FARM_RT          | FARM_CLINICO     | Qualquer tarefa farmaceutica             |
| FARM_CLINICO     | TEC_FARM         | Apenas dispensacao e conferencia         |

### 7.2 Tarefas Nao Delegaveis

| Tarefa                               | Justificativa                            |
| ------------------------------------ | ---------------------------------------- |
| Prescricao medica                    | Privativa do medico (Lei 12.842/2013)    |
| Prescricao de medicamento controlado | Privativa do medico + portaria 344       |
| Assinatura de laudo                  | Privativa do profissional com RQE        |
| Declaracao de obito                  | Privativa do medico                      |
| Prescricao de enfermagem             | Privativa do enfermeiro (Lei 7.498/1986) |
| Validacao farmaceutica               | Privativa do farmaceutico                |
| Alta hospitalar                      | Privativa do medico                      |

---

## 8. Acesso por Contexto Operacional

### 8.1 Centro Cirurgico

| Papel                           | Acesso Adicional no CC                                       | Restricoes                   |
| ------------------------------- | ------------------------------------------------------------ | ---------------------------- |
| MED_CIRURGIAO                   | Checklist cirurgico, contagem de compressas, nota operatoria | N/A                          |
| ENF_CC                          | Checklist, instrumental, contagem, registro de tempos        | N/A                          |
| MED_ANESTESISTA (MED_CONSULTOR) | Ficha anestesica, sinais vitais intra-op                     | Apenas durante procedimento  |
| TEC_ENF (CC)                    | Registro de circulacao, apoio a contagem                     | Sem acesso a nota operatoria |

### 8.2 UTI

| Papel            | Acesso Adicional na UTI                                    | Restricoes                              |
| ---------------- | ---------------------------------------------------------- | --------------------------------------- |
| MED_INTENSIVISTA | Parametros ventilatorios, balanco hidrico completo, scores | N/A                                     |
| ENF_UTI          | Todos os parametros, balanco, dispositivos                 | N/A                                     |
| FISIO_RESP       | Parametros ventilatorios, gasometrias                      | Sem acesso a prescricao medica completa |

### 8.3 Emergencia

| Papel            | Acesso Adicional na Emergencia                              | Restricoes                                       |
| ---------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| MED_EMERGENCISTA | Classificacao de risco, observacao, resultados emergenciais | Acesso a historico limitado a 6 meses por padrao |
| ENF_EMERG        | Classificacao de risco, medicamentos emergenciais           | N/A                                              |

---

## 9. Governanca da Matriz

### 9.1 Manutencao

| Atividade                  | Responsavel                             | Frequencia               |
| -------------------------- | --------------------------------------- | ------------------------ |
| Revisao completa da matriz | Comite de Seguranca da Informacao + DPO | Anual                    |
| Adicao de novos papeis     | DPO + Diretoria afetada                 | Sob demanda              |
| Revisao de permissoes      | Coordenadores por area                  | Semestral                |
| Auditoria de conformidade  | Auditor interno                         | Trimestral               |
| Atualizacao regulatoria    | DPO + Juridico                          | Conforme mudancas legais |

### 9.2 Processo de Alteracao

1. **Solicitacao**: Coordenador da area solicita mudanca com justificativa.
2. **Analise de impacto**: DPO avalia impacto na privacidade e minimizacao.
3. **Aprovacao**: Comite de Seguranca da Informacao aprova ou rejeita.
4. **Implementacao**: TI implementa no sistema RBAC/ABAC.
5. **Validacao**: Testes com profissionais da area.
6. **Documentacao**: Atualizacao desta matriz e dos sistemas.
7. **Comunicacao**: Treinamento dos profissionais afetados.

---

## 10. Metricas de Conformidade

```promql
# Acessos fora da matriz (deve ser 0)
sum(increase(velya_access_outside_matrix_total[24h]))

# Tarefas executadas sem validacao obrigatoria
sum(increase(velya_task_missing_validation_total[24h]))

# Documentos sem assinatura alem do prazo
sum(velya_document_unsigned_beyond_deadline)

# Delegacoes ativas
sum by (delegator_role, delegate_role) (velya_active_delegations)

# Break-glass por papel
sum by (role) (increase(velya_break_glass_total[30d]))
```
