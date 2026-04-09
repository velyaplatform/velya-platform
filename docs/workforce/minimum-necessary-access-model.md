# Modelo de Acesso Minimo Necessario (LGPD)

> Para cada papel, o que PRECISA ver vs o que PODE ver. Mascaramento, consentimento, retencao e comparativo de necessidade vs acesso.

## 1. Visao Geral

O principio do minimo necessario (LGPD Art. 6, III) determina que o tratamento de dados pessoais deve ser limitado ao minimo necessario para a realizacao de suas finalidades. Este documento mapeia, para cada papel institucional, exatamente quais dados sao **necessarios** para o exercicio de suas funcoes vs quais dados o sistema **permite** acessar, identificando gaps e aplicando mascaramento.

### 1.1 Definicoes

| Termo | Definicao |
|---|---|
| **Necessita** | Dado indispensavel para a execucao da tarefa. Sem ele, a tarefa nao pode ser realizada com seguranca. |
| **Pode ver** | Dado que o sistema disponibiliza ao papel, que pode ou nao ser necessario para a tarefa especifica. |
| **Excesso** | Dado disponibilizado que NAO e necessario para a tarefa. Deve ser mascarado ou removido da view. |
| **Mascaramento** | Tecnica de ocultar total ou parcialmente um dado que nao e necessario para a tarefa. |
| **Minimizacao** | Processo de reduzir o acesso ao estritamente necessario. |

### 1.2 Base Legal

| Artigo LGPD | Aplicacao |
|---|---|
| **Art. 6, III** | Limitacao do tratamento ao minimo necessario |
| **Art. 6, VI** | Transparencia sobre os dados tratados |
| **Art. 11** | Dados sensiveis de saude — tratamento com base legal especifica |
| **Art. 18, II** | Direito de acesso aos dados pelo titular |
| **Art. 46** | Medidas de seguranca tecnicas e administrativas |
| **Art. 47** | Agentes de tratamento devem garantir seguranca |

---

## 2. Tabela Comparativa: Necessita vs Tem Acesso

### 2.1 Medico Assistente (MED_DIARISTA / MED_PLANTONISTA)

| Campo de Dado | Necessita? | Justificativa | Acesso Atual | Gap |
|---|---|---|---|---|
| Nome completo | SIM | Identificacao do paciente | Visivel | OK |
| Data de nascimento | SIM | Calculo de dose, contexto clinico | Visivel | OK |
| CPF | NÃO (para tarefa clinica) | Identificacao por prontuario e suficiente | Visivel | EXCESSO — mascarar na view clinica |
| Endereco completo | NÃO (para tarefa clinica) | Relevante apenas para alta/encaminhamento | Visivel | EXCESSO — mostrar apenas na alta |
| Telefone | PARCIAL | Apenas para contato de emergencia com familiar | Visivel | OK (contextual) |
| Convenio/plano | NÃO | Irrelevante para decisao clinica | Visivel | EXCESSO — remover da view clinica |
| Diagnostico completo | SIM | Essencial para tratamento | Visivel | OK |
| Prescricao completa | SIM | Essencial para continuidade | Visivel | OK |
| Resultados laboratoriais | SIM | Essencial para decisao clinica | Visivel | OK |
| Sinais vitais | SIM | Essencial para avaliacao | Visivel | OK |
| Historico de internacoes | SIM | Contexto clinico | Visivel | OK |
| Notas psiquiatricas | CONDICIONAL | Apenas se psiquiatra ou se afeta tratamento | Visivel para todos medicos | EXCESSO — restringir a psiquiatras e medico responsavel com justificativa |
| Historico social detalhado | NÃO | Relevante para assistente social | Visivel (resumo) | OK (resumo e suficiente) |
| Dados financeiros | NÃO | Irrelevante para decisao clinica | Oculto | OK |
| Custos assistenciais | NÃO | Irrelevante para decisao clinica | Oculto | OK |

### 2.2 Enfermeiro Assistencial (ENF_ASSISTENCIAL)

| Campo de Dado | Necessita? | Justificativa | Acesso Atual | Gap |
|---|---|---|---|---|
| Nome completo | SIM | Identificacao, comunicacao com paciente | Visivel | OK |
| Data de nascimento | SIM | Verificacao de identidade, contexto | Visivel | OK |
| CPF | NÃO | Identificacao por prontuario | Visivel parcial | OK (truncado) |
| Endereco | NÃO | Irrelevante para cuidado direto | Visivel (cidade) | OK |
| Telefone | NÃO | Contato feito via recepção/servico social | Oculto | OK |
| Diagnostico principal | SIM | Contexto para cuidados | Visivel | OK |
| Texto completo evolucao medica | NÃO | Resumo e suficiente para cuidados | Visivel completo | EXCESSO — exibir resumo por padrao |
| Prescricao de medicamentos | SIM | Administracao | Visivel | OK |
| Resultados laboratoriais | PARCIAL | Apenas valores que afetam cuidado (K+, Hb, glicemia) | Visivel completo | EXCESSO — filtrar por relevancia |
| Sinais vitais | SIM | Monitoramento | Visivel | OK |
| Alergias | SIM | Seguranca | Visivel | OK |
| Notas psiquiatricas | NÃO | Nao afeta cuidados de enfermagem geral | Oculto | OK |
| Historico de uso de substancias | NÃO | Salvo se relevante para abstinencia | Oculto | OK |
| Dados financeiros | NÃO | Irrelevante | Oculto | OK |

### 2.3 Tecnico de Enfermagem (TEC_ENF)

| Campo de Dado | Necessita? | Justificativa | Acesso Atual | Gap |
|---|---|---|---|---|
| Nome completo | SIM | Identificacao | Visivel | OK |
| Data de nascimento | SIM | Verificacao de identidade | Visivel | OK |
| CPF | NÃO | Nenhuma necessidade | Oculto | OK |
| Endereco | NÃO | Nenhuma necessidade | Oculto | OK |
| Diagnostico | PARCIAL | Apenas resumo para contexto | Resumo | OK |
| Prescricao (itens atribuidos) | SIM | Administracao | Itens proprios | OK |
| Prescricao (completa) | NÃO | Nao administra todos os itens | Completa | EXCESSO — filtrar para itens atribuidos |
| Resultados laboratoriais | NÃO | Nao interpreta resultados | Oculto | OK |
| Sinais vitais | SIM | Registro | Visivel | OK |
| Alergias | SIM | Seguranca | Visivel | OK |
| Evolucoes medicas | NÃO | Nao necessita para tarefas do tecnico | Oculto | OK |
| Evolucoes de enfermagem | SIM | Continuidade do cuidado | Visivel | OK |

### 2.4 Farmaceutico Clinico (FARM_CLINICO)

| Campo de Dado | Necessita? | Justificativa | Acesso Atual | Gap |
|---|---|---|---|---|
| Nome completo | SIM | Identificacao | Visivel | OK |
| Data de nascimento | SIM | Calculo de dose | Visivel | OK |
| CPF | NÃO | Nenhuma necessidade | Oculto | OK |
| Endereco | NÃO | Nenhuma necessidade | Oculto | OK |
| Peso/altura | SIM | Calculo de dose | Visivel | OK |
| Prescricao completa | SIM | Validacao farmaceutica | Visivel | OK |
| Alergias | SIM | Verificacao de seguranca | Visivel | OK |
| Funcao renal (creatinina, clearance) | SIM | Ajuste de dose | Visivel | OK |
| Funcao hepatica (TGO, TGP) | SIM | Ajuste de dose | Visivel | OK |
| Niveis de drogas terapeuticas | SIM | Monitorizacao | Visivel | OK |
| Diagnostico completo | PARCIAL | Apenas indicacao do medicamento | Completo | EXCESSO — exibir apenas indicacoes |
| Texto de evolucoes medicas | NÃO | Resumo de medicamentos e suficiente | Resumo medicamentos | OK |
| Sinais vitais | PARCIAL | Apenas FC, PA (para drogas vasoativas) | Resumo | OK |
| Notas psiquiatricas | NÃO | Irrelevante para validacao farmaceutica | Oculto | OK |
| Dados sociais | NÃO | Irrelevante | Oculto | OK |

### 2.5 Fisioterapeuta (FISIO_RESP / FISIO_MOTOR)

| Campo de Dado | Necessita? | Justificativa | Acesso Atual | Gap |
|---|---|---|---|---|
| Nome completo | SIM | Identificacao | Visivel | OK |
| Data de nascimento | SIM | Contexto | Visivel | OK |
| CPF | NÃO | Nenhuma necessidade | Oculto | OK |
| Diagnostico | PARCIAL | Apenas diagnos. que afetam reabilitacao | Relevantes | OK |
| Prescricao (fisio) | SIM | Sessao prescrita | Visivel | OK |
| Prescricao (medicamentos) | PARCIAL | Apenas sedacao, analgesicos, broncodilatadores | Completa | EXCESSO — filtrar por classe |
| Parametros ventilatorios | SIM (resp) | Ajuste ventilatorio | Visivel (resp) | OK |
| Gasometria | SIM (resp) | Avaliacao respiratoria | Visivel (resp) | OK |
| Sinais vitais | SIM | Seguranca durante sessao | Visivel | OK |
| Exames de imagem (torax) | SIM (resp) | Avaliacao | Visivel (resp) | OK |
| Evolucoes medicas | PARCIAL | Apenas mudancas no plano motor/resp | Resumo | OK |
| Notas psiquiatricas | NÃO | Irrelevante | Oculto | OK |

### 2.6 Nutricionista Clinico (NUTRI_CLINICO)

| Campo de Dado | Necessita? | Justificativa | Acesso Atual | Gap |
|---|---|---|---|---|
| Nome completo | SIM | Identificacao | Visivel | OK |
| Data de nascimento | SIM | Calculo de necessidades | Visivel | OK |
| Peso/altura/IMC | SIM | Avaliacao nutricional | Visivel | OK |
| Diagnostico | PARCIAL | Apenas diag. que afetam dieta | Relevantes | OK |
| Prescricao dietetica | SIM | Preparo da dieta | Visivel | OK |
| Alergias alimentares | SIM | Segurança | Visivel | OK |
| Resultados lab (albumina, pre-albumina, glicemia) | SIM | Estado nutricional | Relevantes | OK |
| Resultados lab (completos) | NÃO | Apenas nutricionais | Completos | EXCESSO — filtrar para nutricionais |
| Sinais vitais | NÃO | Irrelevante para nutricao | Resumo | EXCESSO — remover |
| Evolucoes medicas | PARCIAL | Apenas mudancas de dieta/jejum | Resumo dieta | OK |
| Notas psiquiatricas | NÃO | Irrelevante | Oculto | OK |

### 2.7 Assistente Social (ASSIST_SOCIAL)

| Campo de Dado | Necessita? | Justificativa | Acesso Atual | Gap |
|---|---|---|---|---|
| Nome completo | SIM | Identificacao | Visivel | OK |
| Data de nascimento | SIM | Contexto | Visivel | OK |
| CPF | PARCIAL | Para encaminhamentos sociais | Truncado | OK |
| Endereco completo | SIM | Avaliacao social, encaminhamentos | Visivel | OK |
| Telefone/contatos | SIM | Contato com familia | Visivel | OK |
| Diagnostico | PARCIAL | Apenas CID para encaminhamento | Resumo | OK |
| Texto clinico detalhado | NÃO | Irrelevante para servico social | Oculto | OK |
| Historico social | SIM | Avaliacao social | Visivel | OK |
| Informacoes de violencia/abuso | SIM | Encaminhamento e protecao | Visivel | OK |
| Dados financeiros | PARCIAL | Para encaminhamento a beneficios | Relevante | OK |
| Prescricao | NÃO | Irrelevante | Oculto | OK |
| Resultados laboratoriais | NÃO | Irrelevante | Oculto | OK |

### 2.8 Recepcionista/Admissao (RECEPCAO)

| Campo de Dado | Necessita? | Justificativa | Acesso Atual | Gap |
|---|---|---|---|---|
| Nome completo | SIM | Cadastro/identificacao | Visivel | OK |
| Data de nascimento | SIM | Cadastro/confirmacao | Visivel | OK |
| CPF | SIM | Cadastro | Visivel | OK |
| Endereco | SIM | Cadastro | Visivel | OK |
| Telefone | SIM | Cadastro | Visivel | OK |
| Convenio | SIM | Cadastro de internacao | Visivel | OK |
| Diagnostico | NÃO | Irrelevante para cadastro | Oculto | OK |
| Dados clinicos | NÃO | Irrelevante | Oculto | OK |
| Historico de internacoes | NÃO | Apenas datas para referencia | Datas | OK |

### 2.9 Faturista (FATURISTA)

| Campo de Dado | Necessita? | Justificativa | Acesso Atual | Gap |
|---|---|---|---|---|
| Nome completo | SIM | Faturamento | Visivel | OK |
| CPF | SIM | Faturamento | Visivel | OK |
| Convenio | SIM | Faturamento | Visivel | OK |
| CID (codigo apenas) | SIM | Codificacao para faturamento | Codigo apenas | OK |
| Texto de diagnostico | NÃO | Nao necessario para faturamento | Oculto | OK |
| Procedimentos (codigos) | SIM | Faturamento | Codigos e quantidades | OK |
| Detalhes clinicos de procedimentos | NÃO | Nao necessario | Oculto | OK |
| Medicamentos (codigos e quantidades) | SIM | Faturamento | Codigos e quantidades | OK |
| Prescricao medica completa | NÃO | Nao necessario | Oculto | OK |
| Resultados de exames | NÃO | Nao necessario | Oculto | OK |
| Evolucoes clinicas | NÃO | Nao necessario | Oculto | OK |

### 2.10 Administrador TI / DBA (ADMIN_TI / DBA)

| Campo de Dado | Necessita? | Justificativa | Acesso Atual | Gap |
|---|---|---|---|---|
| Dados clinicos de producao | NÃO | Manutencao nao requer dados reais | Via JIT mascarado | OK |
| Dados de log/auditoria | SIM | Investigacao de incidentes | Via JIT | OK |
| Dados de performance | SIM | Monitoramento de sistemas | Metricas anonimizadas | OK |
| Backups | PARCIAL | Manutencao (criptografado) | Criptografado | OK |
| PII em producao | NÃO | Nenhuma necessidade operacional | Mascarado via JIT | OK |

---

## 3. Regras de Mascaramento por Papel

### 3.1 Implementacao Tecnica

```typescript
interface MaskingRule {
  field: string;
  roles: string[];
  maskType: MaskType;
  maskConfig?: Record<string, unknown>;
  context?: MaskingContext;
}

type MaskType = 
  | 'full_hide'       // Campo completamente oculto
  | 'truncate'        // Exibicao parcial (ex: ***456***-**)
  | 'generalize'      // Generalizacao (ex: idade em vez de data nascimento)
  | 'category_only'   // Apenas categoria (ex: CID em vez de descricao)
  | 'summary'         // Resumo em vez de texto completo
  | 'relevant_filter'  // Filtrado por relevancia a funcao
  | 'delay'           // Visivel apenas apos periodo
  | 'pseudonymize';   // Substituicao por identificador ficticio

interface MaskingContext {
  requiresEncounterLink: boolean;
  requiresTaskAssignment: boolean;
  requiresJustification: boolean;
  timeWindow?: string; // ex: 'current_encounter', 'last_6months'
}

// Regras implementadas
const maskingRules: MaskingRule[] = [
  // CPF
  {
    field: 'patient.identifier[cpf]',
    roles: ['TEC_ENF', 'FARM_CLINICO', 'FARM_DISP', 'TEC_FARM', 
            'FISIO_RESP', 'FISIO_MOTOR', 'TO', 'FONO', 'PSICO',
            'NUTRI_CLINICO', 'NUTRI_PROD', 'CAPELAO', 'MAQUEIRO',
            'HIGIENIZ', 'BIOMED', 'TEC_LAB', 'TEC_RADIO'],
    maskType: 'full_hide',
  },
  {
    field: 'patient.identifier[cpf]',
    roles: ['ENF_ASSISTENCIAL', 'ENF_UTI', 'ENF_EMERG', 'ENF_CC',
            'ASSIST_SOCIAL'],
    maskType: 'truncate',
    maskConfig: { pattern: '***.$2.***-**', groups: [3, 3, 3, 2] },
  },
  
  // Endereco
  {
    field: 'patient.address',
    roles: ['TEC_ENF', 'AUX_ENF', 'FARM_CLINICO', 'FARM_DISP',
            'TEC_FARM', 'FISIO_RESP', 'FISIO_MOTOR', 'TO', 'FONO',
            'PSICO', 'NUTRI_CLINICO', 'NUTRI_PROD', 'BIOMED',
            'TEC_LAB', 'TEC_RADIO', 'CAPELAO', 'MAQUEIRO', 'HIGIENIZ'],
    maskType: 'full_hide',
  },
  {
    field: 'patient.address',
    roles: ['ENF_ASSISTENCIAL', 'ENF_UTI', 'ENF_EMERG'],
    maskType: 'generalize',
    maskConfig: { show: ['city', 'state'], hide: ['line', 'postalCode'] },
  },
  
  // Diagnostico
  {
    field: 'condition.code.text',
    roles: ['TEC_ENF', 'AUX_ENF', 'MAQUEIRO', 'HIGIENIZ', 'CAPELAO'],
    maskType: 'category_only',
    maskConfig: { showLevel: 'chapter' }, // ex: "Doencas do aparelho digestivo"
  },
  {
    field: 'condition.code.text',
    roles: ['FATURISTA', 'CODIF_SAME'],
    maskType: 'category_only',
    maskConfig: { showLevel: 'code' }, // ex: "K80.1" sem texto descritivo
  },
  
  // Notas psiquiatricas
  {
    field: 'documentReference[psychiatric]',
    roles: ['*'], // Todos exceto os listados abaixo
    maskType: 'full_hide',
  },
  // Excecoes para notas psiquiatricas:
  // - PSICO: full access
  // - MED_DIARISTA/MED_PLANTONISTA: se psychiatrist ou attending com justif.
  // - AUDITOR: anonimizado
  
  // Resultados laboratoriais
  {
    field: 'diagnosticReport.result',
    roles: ['FARM_CLINICO'],
    maskType: 'relevant_filter',
    maskConfig: { 
      allowCategories: ['renal_function', 'hepatic_function', 'drug_levels',
                        'electrolytes', 'coagulation'] 
    },
  },
  {
    field: 'diagnosticReport.result',
    roles: ['NUTRI_CLINICO'],
    maskType: 'relevant_filter',
    maskConfig: { 
      allowCategories: ['albumin', 'prealbumin', 'glucose', 'lipid_panel',
                        'electrolytes', 'vitamins', 'iron_studies'] 
    },
  },
  {
    field: 'diagnosticReport.result',
    roles: ['FISIO_RESP'],
    maskType: 'relevant_filter',
    maskConfig: { 
      allowCategories: ['blood_gas', 'pulmonary_function', 'electrolytes'] 
    },
  },
  
  // Dados de HIV/IST
  {
    field: 'condition[hiv_ist]',
    roles: ['TEC_ENF', 'AUX_ENF', 'FARM_CLINICO', 'FARM_DISP', 'TEC_FARM',
            'FISIO_RESP', 'FISIO_MOTOR', 'TO', 'FONO', 'NUTRI_CLINICO',
            'NUTRI_PROD', 'ASSIST_SOCIAL', 'RECEPCAO', 'FATURISTA',
            'ADMIN_TI', 'DBA', 'MAQUEIRO', 'HIGIENIZ', 'CAPELAO'],
    maskType: 'full_hide',
  },
];
```

---

## 4. Consentimento

### 4.1 Tipos de Consentimento e Base Legal

| Tipo | Base Legal LGPD | Forma | Revogavel |
|---|---|---|---|
| **Consentimento para tratamento (assistencial)** | Art. 7, VIII (tutela da saude) | Implicito na internacao + termo de admissao | Parcial (nao pode revogar o minimo para seguranca) |
| **Consentimento para compartilhamento com equipe** | Art. 7, VIII | Implicito na admissao | Parcial |
| **Consentimento para procedimento** | Art. 11, II, f (tutela da saude) | Termo especifico assinado | Sim (antes do procedimento) |
| **Consentimento para pesquisa** | Art. 7, I (consentimento) | Termo especifico + CEP | Sim (a qualquer momento) |
| **Consentimento para compartilhamento externo** | Art. 7, I (consentimento) | Termo especifico | Sim |
| **Consentimento para acesso familiar** | Art. 7, I (consentimento) | Registro no sistema | Sim |
| **Consentimento para portabilidade** | Art. 18, V | Solicitacao formal | N/A (direito) |

### 4.2 Registro de Consentimento

```json
{
  "resourceType": "Consent",
  "id": "consent-12345-privacy",
  "status": "active",
  "scope": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/consentscope",
      "code": "patient-privacy"
    }]
  },
  "category": [{
    "coding": [{
      "system": "http://velya.health/consent-category",
      "code": "minimum-necessary-access"
    }]
  }],
  "patient": { "reference": "Patient/pat-12345" },
  "dateTime": "2026-04-07T10:00:00Z",
  "provision": {
    "type": "permit",
    "purpose": [
      { "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason", "code": "TREAT" },
      { "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason", "code": "HPAYMT" }
    ],
    "provision": [
      {
        "type": "deny",
        "class": [{ "system": "http://velya.health/data-class", "code": "psychiatric-notes" }],
        "purpose": [{ "system": "http://velya.health/purpose", "code": "non-psychiatric-care" }]
      },
      {
        "type": "deny",
        "class": [{ "system": "http://velya.health/data-class", "code": "genetic-data" }],
        "purpose": [{ "system": "http://velya.health/purpose", "code": "non-genetic-care" }]
      }
    ]
  }
}
```

### 4.3 Gestao de Revogacao

| Cenario | Processo |
|---|---|
| Paciente revoga consentimento de pesquisa | Dados anonimizados ja coletados permanecem. Novos dados nao sao coletados. |
| Paciente revoga acesso familiar | Sistema remove familiar da lista. Acesso futuro bloqueado. Historico de acesso permanece. |
| Paciente revoga consentimento amplo | Sistema restringe ao minimo legal (tutela da saude). |
| Paciente solicita exclusao | Analise caso a caso. Prontuario tem retencao legal de 20 anos. Dados nao clinicos podem ser excluidos. |

---

## 5. Retencao por Tipo de Dado

### 5.1 Tabela de Retencao

| Tipo de Dado | Retencao Legal | Retencao Velya | Base Legal | Storage |
|---|---|---|---|---|
| Prontuario clinico (evolucoes, prescricoes, resultados) | 20 anos (CFM 1821/2007) | 20 anos | CFM 1821/2007 | Hot: 2 anos, Cold: 18 anos |
| Consentimentos | 20 anos | 20 anos | LGPD Art. 8 | Imutavel |
| Audit trail (quem acessou) | 20 anos | 20 anos | LGPD Art. 37 | Imutavel |
| Dados de faturamento | 5 anos | 5 anos | Codigo Tributario Nacional | Hot: 1 ano, Cold: 4 anos |
| Dados cadastrais | Enquanto ativo + 20 anos | 20 anos apos ultimo atendimento | LGPD Art. 16 | Hot |
| Logs de sistema (nao-clinicos) | 1 ano | 2 anos | Boas praticas | Cold apos 6 meses |
| Dados de pesquisa (anonimizados) | Conforme protocolo | Conforme protocolo CEP | LGPD Art. 7, IV | Separado |
| Break-glass e acesso sensivel | 20 anos | 20 anos | LGPD Art. 37 + 46 | Imutavel |
| Dados de handoff | 5 anos | 5 anos | Operacional | Hot: 1 ano, Cold: 4 anos |
| Metricas operacionais (agregadas) | Indeterminado | Indeterminado | Operacional | Cold |

### 5.2 Processo de Expurgo

```
┌─────────────────────────────────────────────────────────────┐
│ JOB DE EXPURGO (mensal)                                     │
│                                                             │
│ 1. Identificar dados com retencao expirada                  │
│ 2. Verificar que nao ha hold legal (processos judiciais)    │
│ 3. Verificar que nao ha vinculo com pesquisa ativa          │
│ 4. Gerar lista para aprovacao do DPO                        │
│ 5. DPO aprova lista                                         │
│ 6. Executar expurgo com log detalhado                       │
│ 7. Gerar certificado de destruicao                          │
│ 8. Atualizar registro de atividades de tratamento           │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Resumo de Gaps e Acoes de Remediacao

### 6.1 Gaps Identificados

| # | Gap | Papeis Afetados | Risco | Acao |
|---|---|---|---|---|
| 1 | CPF visivel na view clinica do medico | MED_* | Baixo | Mascarar CPF na view clinica, manter em cadastro |
| 2 | Convenio visivel na view clinica do medico | MED_* | Baixo | Remover da view clinica |
| 3 | Evolucao medica completa visivel para enfermeiro | ENF_* | Medio | Exibir resumo por padrao, texto completo sob demanda |
| 4 | Resultados laboratoriais completos para enfermeiro | ENF_* | Baixo | Filtrar por relevancia para enfermagem |
| 5 | Notas psiquiatricas visiveis para todos os medicos | MED_* (nao psiq.) | Alto | Restringir a psiquiatras + medico responsavel com justificativa |
| 6 | Prescricao completa visivel para tecnico de enfermagem | TEC_ENF | Baixo | Filtrar para itens atribuidos ao tecnico |
| 7 | Prescricao completa de medicamentos visivel para fisioterapia | FISIO_* | Baixo | Filtrar para classes relevantes (broncodilatadores, sedacao) |
| 8 | Resultados lab completos para nutricionista | NUTRI_CLINICO | Baixo | Filtrar para exames nutricionais |
| 9 | Resumo de sinais vitais visivel para nutricionista | NUTRI_CLINICO | Muito baixo | Remover da view nutricional |

### 6.2 Cronograma de Remediacao

| Prioridade | Gap # | Prazo | Responsavel |
|---|---|---|---|
| P1 - Critica | 5 | 30 dias | DPO + TI |
| P2 - Alta | 3, 4 | 60 dias | TI + Diretoria Enfermagem |
| P3 - Media | 1, 2, 6, 7, 8 | 90 dias | TI |
| P4 - Baixa | 9 | 120 dias | TI |

---

## 7. Monitoramento de Conformidade

### 7.1 Metricas

```promql
# Acessos a dados fora do perfil de necessidade
sum by (role, data_category) (
  increase(velya_access_outside_minimum_necessary_total[24h])
)

# Dados mascarados efetivamente
sum by (mask_type) (increase(velya_data_masked_total[24h]))

# Consentimentos ativos por tipo
sum by (consent_type, status) (velya_consent_active_count)

# Dados com retencao expirada nao expurgados
velya_data_retention_expired_not_purged_count

# Requisicoes de titular (LGPD Art. 18) pendentes
velya_data_subject_request_pending_count
```

### 7.2 Relatorio Mensal de Minimizacao

| Secao | Conteudo |
|---|---|
| **Acessos analisados** | Volume total de acessos por papel |
| **Acessos dentro do minimo necessario** | % de acessos conformes |
| **Acessos com excesso identificado** | Detalhamento de acessos fora do perfil |
| **Mascaramento efetivo** | Campos mascarados e volume |
| **Consentimentos** | Novos, revogados, pendentes |
| **Expurgos** | Dados expurgados no periodo |
| **Requisicoes de titular** | Atendidas, pendentes, prazo |
| **Recomendacoes** | Ajustes sugeridos na matriz |

---

## 8. Direitos do Titular (Paciente)

### 8.1 Mapeamento LGPD Art. 18

| Direito | Como Atendemos | SLA |
|---|---|---|
| **Confirmacao de existencia** | Portal do paciente + DPO | 15 dias |
| **Acesso aos dados** | Portal do paciente (timeline simplificada) + DPO (completo) | 15 dias |
| **Correcao** | Via DPO, que aciona equipe clinica | 15 dias |
| **Anonimizacao/bloqueio** | Via DPO (exceto dados com base legal de retencao) | 15 dias |
| **Portabilidade** | FHIR Bundle exportado via DPO | 15 dias |
| **Eliminacao** | Analise caso a caso (prontuario tem retencao legal) | 15 dias |
| **Informacao sobre compartilhamento** | Audit trail mostra todos os acessos | 15 dias |
| **Revogacao de consentimento** | Sistema + DPO | Imediato (sistema) |
| **Oposicao** | Via DPO | 15 dias |

### 8.2 Portal do Paciente

O paciente tem acesso a:
- Seus dados cadastrais.
- Timeline simplificada (sem jargao tecnico).
- Lista de profissionais que acessaram seu prontuario.
- Status de consentimentos.
- Canal para exercer direitos LGPD.
- Resultados de exames (conforme liberacao medica).

O paciente NAO ve:
- Notas internas da equipe (rascunhos).
- Discussoes clinicas de caso.
- Alertas operacionais.
- Dados de outros pacientes (obvio, mas explicito).
