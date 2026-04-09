# Matriz de Sensibilidade de Dados - Velya Platform

> Versao: 1.0 | Ultima atualizacao: 2026-04-08
> Classificacao: Documento Interno - Arquitetura de Seguranca

---

## 1. Visao Geral

A Velya Platform classifica todos os dados em 5 classes de sensibilidade (A-E),
cada uma com controles de acesso, auditoria e retencao proporcionais ao risco.
Esta classificacao e a base para o field-level access control implementado pelo
Policy Enforcement Point (PEP).

### Principios da Classificacao

1. **Proporcionalidade:** Controles proporcionais ao risco de dano ao paciente.
2. **Irreversibilidade:** Uma vez classificado em classe superior, um dado nao
   desce de classe (exceto por reclassificacao formal).
3. **Contexto importa:** O mesmo tipo de dado pode ter classes diferentes
   dependendo do contexto (ex: "temperatura" e Classe C, mas "temperatura de
   paciente com doenca de notificacao compulsoria" pode ser Classe D).
4. **Duvida resolve para cima:** Na duvida, classificar na classe superior.

---

## 2. Definicao das 5 Classes

### 2.1 Classe A - Operacional Minimo

**Definicao:** Dados operacionais que nao identificam o paciente e sao
necessarios para a logistica hospitalar basica.

| Aspecto              | Valor                                                     |
| -------------------- | --------------------------------------------------------- |
| **Risco**            | Baixo - nao identifica paciente                           |
| **Fundamento Legal** | Nao constitui dado pessoal isoladamente (LGPD Art. 5o, I) |
| **Nivel Minimo**     | 1 (Operacional Minimo)                                    |
| **Autenticacao**     | Login basico (sem MFA obrigatorio)                        |
| **Auditoria**        | Padrao (retencao 5 anos)                                  |
| **Criptografia**     | Em transito (TLS 1.3) + em repouso (AES-256 disco)        |
| **Mascaramento**     | Nenhum                                                    |
| **Retencao**         | 5 anos                                                    |

**Exemplos de Dados Classe A:**

| Dado                  | Descricao                                          | Roles com Acesso                        |
| --------------------- | -------------------------------------------------- | --------------------------------------- |
| Numero do leito       | Ex: "301-A"                                        | Todos com nivel >= 1                    |
| Status do leito       | Livre, ocupado, em limpeza, bloqueado              | cleaning_hygiene, bed_management, nurse |
| Status de limpeza     | Pendente, em andamento, concluida                  | cleaning_hygiene, bed_management        |
| Ordem de transporte   | Origem, destino, horario (sem nome paciente)       | patient_transporter, ambulance_driver   |
| Tipo de precaucao     | Contato, respiratorio, goticulaa (sem diagnostico) | cleaning_hygiene, patient_transporter   |
| Status de equipamento | Funcional, em manutencao, com defeito              | maintenance                             |
| Numero da sala        | Identificacao do espaco fisico                     | Todos                                   |
| Tipo de dieta padrao  | Branda, liquida, livre (sem nome)                  | nutrition service                       |

### 2.2 Classe B - Administrativo

**Definicao:** Dados pessoais de identificacao e administrativos. Constituem
dado pessoal conforme LGPD mas nao sao dados sensiveis de saude.

| Aspecto              | Valor                                                   |
| -------------------- | ------------------------------------------------------- |
| **Risco**            | Medio - identifica o paciente                           |
| **Fundamento Legal** | LGPD Art. 5o, I (dado pessoal) + Art. 7o (bases legais) |
| **Nivel Minimo**     | 2 (Identificacao Basica) ou 3 (Administrativo Completo) |
| **Autenticacao**     | Login + contexto de trabalho validado                   |
| **Auditoria**        | Padrao a Elevada (retencao 10 anos)                     |
| **Criptografia**     | Em transito + em repouso + campos sensiveis (CPF, RG)   |
| **Mascaramento**     | CPF: `***.***.***-XX`, telefone: `(**) *****-XXXX`      |
| **Retencao**         | 10 anos (ou 20 anos se vinculado a prontuario)          |

**Exemplos de Dados Classe B:**

| Dado                    | Descricao                               | Roles com Acesso                                     | Mascaramento                  |
| ----------------------- | --------------------------------------- | ---------------------------------------------------- | ----------------------------- |
| Nome completo           | Nome civil do paciente                  | Nivel >= 2                                           | Nenhum                        |
| Nome social             | Nome social (se registrado)             | Nivel >= 2                                           | Nenhum                        |
| CPF                     | Cadastro de Pessoa Fisica               | receptionist, billing (completo); outros (mascarado) | `***.***.***-XX`              |
| RG                      | Registro Geral                          | receptionist (completo)                              | `**.***.***-X`                |
| Data de nascimento      | Data de nascimento                      | receptionist, nurse, medical                         | Nenhum para clinicos          |
| Endereco                | Endereco residencial                    | receptionist, social_worker                          | Nenhum                        |
| Telefone                | Telefones de contato                    | receptionist, social_worker, nurse                   | `(**) *****-XXXX` para outros |
| Email                   | Email do paciente                       | receptionist                                         | `***@***.com`                 |
| Numero do prontuario    | Identificador unico no hospital         | Nivel >= 2                                           | Nenhum                        |
| Convenio/Plano de saude | Operadora e numero da carteirinha       | receptionist, billing                                | Carteirinha mascarada         |
| Responsavel legal       | Nome e contato (para menores/incapazes) | receptionist, social_worker                          | Nenhum                        |
| Contato de emergencia   | Nome e telefone                         | receptionist, nurse                                  | Nenhum                        |
| Profissao               | Ocupacao do paciente                    | receptionist, social_worker                          | Nenhum                        |
| Estado civil            | Solteiro, casado, etc.                  | receptionist                                         | Nenhum                        |
| Nacionalidade           | Pais de origem                          | receptionist                                         | Nenhum                        |
| Dados de faturamento    | Valores, guias, autorizacoes            | billing_authorization                                | Nenhum (restrito ao setor)    |

### 2.3 Classe C - Clinico Contextual

**Definicao:** Dados clinicos de rotina necessarios para o cuidado direto ao
paciente. Constituem dado pessoal sensivel de saude conforme LGPD Art. 5o, II.

| Aspecto              | Valor                                                   |
| -------------------- | ------------------------------------------------------- |
| **Risco**            | Alto - dados de saude (LGPD dado sensivel)              |
| **Fundamento Legal** | LGPD Art. 11 (dados sensiveis) + Art. 7o, VIII (tutela) |
| **Nivel Minimo**     | 4 (Clinico Contextual)                                  |
| **Autenticacao**     | Login + MFA + relacao com paciente (ReBAC)              |
| **Auditoria**        | Elevada (retencao 20 anos)                              |
| **Criptografia**     | Em transito + em repouso + campo-nivel                  |
| **Mascaramento**     | Por campo, conforme role                                |
| **Retencao**         | 20 anos (conforme CFM 1.821/2007)                       |

**Exemplos de Dados Classe C:**

| Dado                      | Descricao                                     | Roles com Acesso                           |
| ------------------------- | --------------------------------------------- | ------------------------------------------ |
| Sinais vitais             | PA, FC, FR, Temp, SpO2, dor                   | nurse, nursing_tech, medical, physio       |
| Anotacoes de enfermagem   | Registros do cuidado de enfermagem            | nurse, nursing_tech, medical               |
| Balanco hidrico           | Ingestao e eliminacao de liquidos             | nurse, nursing_tech, medical, nutritionist |
| Medicamentos prescritos   | Lista de medicamentos ativos                  | nurse, medical, pharmacist                 |
| Registro de administracao | Medicamento administrado, horario, via        | nurse, nursing_tech, medical, pharmacist   |
| Alergias                  | Alergias declaradas e confirmadas             | nurse, medical, pharmacist, nutritionist   |
| Resultados de exames      | Resultados laboratoriais e de imagem          | medical, nurse, lab_staff, imaging_staff   |
| Plano de cuidados         | Plano terapeutico ativo                       | nurse, medical, equipe_multi               |
| Evolucao de enfermagem    | Evolucao diaria do enfermeiro                 | nurse, medical                             |
| Fisioterapia - evolucao   | Evolucao da fisioterapia                      | physiotherapist, medical, nurse            |
| Nutricao - evolucao       | Avaliacao e prescricao dietética              | nutritionist, medical, nurse               |
| Fonoaudiologia - evolucao | Avaliacao e evolucao fono                     | speech_therapist, medical, nurse           |
| Sinais de alerta          | Alertas clinicos (queda, alergia, isolamento) | Nivel >= 4 com relacao                     |

### 2.4 Classe D - Clinico Sensivel

**Definicao:** Dados clinicos que, por sua natureza, exigem protecao redobrada
por envolver diagnosticos, historico completo, ou informacoes que podem causar
discriminacao ou estigma.

| Aspecto              | Valor                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| **Risco**            | Muito alto - potencial de discriminacao e dano significativo             |
| **Fundamento Legal** | LGPD Art. 11 + Art. 6o, IX (nao discriminacao) + CFM sigilo              |
| **Nivel Minimo**     | 5 (Clinico Completo)                                                     |
| **Autenticacao**     | Login + MFA + relacao com paciente + justificativa para alguns campos    |
| **Auditoria**        | Elevada a Maxima (retencao 20 anos)                                      |
| **Criptografia**     | Em transito + em repouso + campo-nivel + envelope encryption             |
| **Mascaramento**     | Extensivo - CID mascarado para faturamento, diagnosticos por necessidade |
| **Retencao**         | 20 anos                                                                  |

**Exemplos de Dados Classe D:**

| Dado                       | Descricao                               | Roles com Acesso                                  | Condicao Especial          |
| -------------------------- | --------------------------------------- | ------------------------------------------------- | -------------------------- |
| Diagnosticos (CID)         | Lista de diagnosticos ativos e inativos | medical (attending/on_call), clinical_director    | Faturamento: CID mascarado |
| Historico clinico completo | Anamnese, historico patologico          | medical (attending), nurse (resumo)               | Resumo para enfermagem     |
| Laudos medicos             | Laudos de exames com interpretacao      | medical, lab_staff (autor), imaging_staff (autor) | Autor + solicitante        |
| Prescricoes medicas        | Prescricoes completas com justificativa | medical, nurse, pharmacist                        | -                          |
| Relatorios cirurgicos      | Descricao de procedimentos cirurgicos   | medical (cirurgiao + assistente)                  | -                          |
| Evolucao medica            | Evolucoes diarias do medico             | medical (attending/on_call)                       | -                          |
| Resumo de alta             | Documento de alta hospitalar            | medical (attending), nurse                        | -                          |
| Antecedentes familiares    | Historico de doencas na familia         | medical (attending)                               | -                          |
| Uso de substancias         | Tabagismo, etilismo, drogas             | medical, nurse (quando relevante)                 | Consentimento preferivel   |
| Doencas cronicas           | Lista de comorbidades                   | medical, nurse, pharmacist                        | -                          |
| Saude mental (geral)       | Diagnosticos psiquiatricos              | medical, psychologist                             | Step-up para acesso        |
| Doencas infecciosas        | Diagnostico de doencas transmissiveis   | medical, nurse, compliance (notif. compulsoria)   | Notificacao obrigatoria    |

### 2.5 Classe E - Altamente Restrito

**Definicao:** Dados com o mais alto nivel de protecao. Acesso extremamente
restrito, com controles individuais por registro. Inclui dados cujo vazamento
pode causar dano grave e irreversivel ao paciente.

| Aspecto              | Valor                                                            |
| -------------------- | ---------------------------------------------------------------- |
| **Risco**            | Critico - dano grave, irreversivel, potencialmente fatal         |
| **Fundamento Legal** | LGPD Art. 11 + CFM sigilo absoluto + legislacao especifica       |
| **Nivel Minimo**     | 6 (Dados Sensiveis) ou 7 (Break-Glass)                           |
| **Autenticacao**     | Login + MFA + step-up + justificativa obrigatoria + log imediato |
| **Auditoria**        | Maxima (retencao 20+ anos, alerta em tempo real)                 |
| **Criptografia**     | Todas as camadas + criptografia individual por registro + HSM    |
| **Mascaramento**     | Totalmente oculto para roles nao autorizados                     |
| **Retencao**         | 20+ anos (ou conforme legislacao especifica)                     |

**Exemplos de Dados Classe E:**

| Dado                      | Descricao                                   | Roles com Acesso                               | Legislacao Especifica                          |
| ------------------------- | ------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Anotacoes de psicoterapia | Notas de sessoes de psicoterapia            | Apenas o psicologo/psiquiatra autor            | CFP Res. 001/2009                              |
| Status de HIV/AIDS        | Diagnostico, carga viral, CD4               | medical (attending) + infectologista           | Lei 12.984/2014 (anti-discriminacao)           |
| Violencia sexual          | Registros de atendimento a violencia sexual | medical (attending), social_worker, compliance | Lei 12.845/2013 + notif. obrigatoria           |
| Violencia domestica       | Registros de violencia domestica            | medical (attending), social_worker             | Lei 11.340/2006 (Maria da Penha)               |
| Abuso de menores          | Registros de suspeita ou confirmacao        | medical, social_worker, compliance             | ECA (Lei 8.069/1990) + notif. Conselho Tutelar |
| Registros judiciais       | Informacoes sob segredo de justica          | Somente conforme ordem judicial                | CPC + legislacao processual                    |
| Prontuario sequestrado    | Registro lacrado por determinacao judicial  | Somente via ordem judicial                     | CPC + CFM                                      |
| Identidade protegida      | Paciente em programa de protecao            | Somente clinical_director com step-up          | Lei 9.807/1999                                 |
| Dependencia quimica       | Diagnostico e tratamento de dependencia     | medical (attending), psychologist              | Lei 11.343/2006                                |
| Aborto legal              | Registros de aborto previsto em lei         | medical (attending), social_worker             | CP Art. 128 + norma tecnica MS                 |
| Transicao de genero       | Registros de processo transexualizador      | medical (attending), psychologist              | Res. CFM 2.265/2019                            |
| Dados geneticos           | Resultados de testes geneticos              | medical (geneticista), geneticista             | LGPD Art. 5o, II                               |

---

## 3. Tabela Consolidada: Classe vs Controles

| Controle                     | Classe A | Classe B       | Classe C        | Classe D          | Classe E            |
| ---------------------------- | -------- | -------------- | --------------- | ----------------- | ------------------- |
| Nivel minimo de acesso       | 1        | 2-3            | 4               | 5                 | 6-7                 |
| MFA obrigatorio              | Nao      | Contextual     | Sim             | Sim               | Sim + Step-up       |
| Relacao com paciente (ReBAC) | Nao      | Nao            | Sim             | Sim               | Sim + justificativa |
| Criptografia em repouso      | Disco    | Disco + campo  | Disco + campo   | Campo + envelope  | Individual + HSM    |
| Criptografia em transito     | TLS 1.3  | TLS 1.3        | TLS 1.3 + mTLS  | TLS 1.3 + mTLS    | TLS 1.3 + mTLS      |
| Mascaramento                 | Nenhum   | Parcial        | Por role        | Extensivo         | Total (oculto)      |
| Nivel de auditoria           | Padrao   | Padrao/Elevada | Elevada         | Elevada/Maxima    | Maxima + Alerta     |
| Retencao de log              | 5 anos   | 10 anos        | 20 anos         | 20 anos           | 20+ anos            |
| Alerta em tempo real         | Nao      | Anomalias      | Anomalias       | Padroes suspeitos | Todo acesso         |
| Break-glass disponivel       | N/A      | N/A            | Sim (4h)        | Sim (2h)          | Sim (1h)            |
| Revisao pos-break-glass      | N/A      | N/A            | 48h             | 24h               | Imediata (< 4h)     |
| Exportacao permitida         | Sim      | Com aprovacao  | Com aprovacao   | Restrita          | Proibida\*          |
| Impressao permitida          | Sim      | Sim            | Com registro    | Com aprovacao     | Proibida\*          |
| Acesso remoto                | Sim      | Sim (VPN)      | Sim (VPN + MFA) | Hospital only\*\* | Hospital only\*\*   |
| Notificacao ao paciente      | Nao      | Nao            | Nao             | Configuravel      | Automatica          |

> `*` Exceto por determinacao judicial ou autorizacao expressa do DPO + clinical_director.
> `**` Exceto para medico plantonista remoto com VPN + MFA + step-up.

---

## 4. Arvore de Decisao para Classificacao

```
DADO A SER CLASSIFICADO
        |
        v
Identifica paciente direta ou indiretamente?
        |
   +----+----+
   |         |
  NAO       SIM
   |         |
   v         v
 E dado    E dado de saude?
 operac.?       |
   |       +----+----+
  SIM      |         |
   |      NAO       SIM
   v       |         |
CLASSE A   v         v
         E dado     Pode causar discriminacao
         cadastral/ ou estigma?
         admin.?         |
           |        +----+----+
          SIM       |         |
           |       NAO       SIM
           v        |         |
        CLASSE B    v         v
                  E dado    Envolve protecao legal
                  clinico   especifica?
                  de         (HIV, psicoterapia,
                  rotina?    violencia, judicial)
                    |              |
                   SIM        +----+----+
                    |         |         |
                    v        NAO       SIM
                 CLASSE C     |         |
                              v         v
                           CLASSE D  CLASSE E
```

### 4.1 Regras de Classificacao Automatica

```yaml
auto_classification_rules:
  # Regras baseadas no tipo de campo/recurso
  - pattern: 'bed_status|room_status|cleaning_*|transport_order'
    class: A
    confidence: high

  - pattern: 'patient.name|patient.cpf|patient.rg|patient.address|patient.phone|insurance.*|billing.*'
    class: B
    confidence: high

  - pattern: 'vitals.*|nursing_note|medication_schedule|allergy|lab_result|imaging_result'
    class: C
    confidence: high

  - pattern: 'diagnosis|icd_code|medical_evolution|prescription|surgical_report|discharge_summary|family_history'
    class: D
    confidence: high

  - pattern: 'psychotherapy_note|hiv_*|sexual_violence|domestic_violence|child_abuse|judicial_*|sealed_*|protected_identity|substance_dependence|genetic_*'
    class: E
    confidence: high

  # Regras contextuais (podem promover a classe)
  - context: 'infectious_disease_notification'
    promotes_to: D
    from: C
    reason: 'Doenca de notificacao compulsoria tem impacto social'

  - context: 'mental_health_diagnosis'
    promotes_to: D
    from: C
    reason: 'Diagnosticos de saude mental podem causar discriminacao'

  - context: 'under_judicial_seal'
    promotes_to: E
    from: any
    reason: 'Determinacao judicial prevalece'
```

---

## 5. Implementacao do Field-Level Access Control

### 5.1 Configuracao de Campos por Classe

```typescript
interface FieldClassification {
  fieldPath: string; // Ex: 'patient.cpf', 'chart.diagnosis.icd_code'
  dataClass: DataClass;
  defaultMasking: MaskingStrategy;
  overrides: FieldOverride[];
}

type MaskingStrategy =
  | { type: 'none' }
  | { type: 'partial'; pattern: string; keepLast: number }
  | { type: 'hash'; algorithm: 'sha256' }
  | { type: 'redact' }
  | { type: 'tokenize' };

interface FieldOverride {
  role: string;
  masking: MaskingStrategy;
  conditions?: AttributeCondition[];
}

// Exemplo: campos do paciente
const patientFieldClassifications: FieldClassification[] = [
  {
    fieldPath: 'patient.bed_number',
    dataClass: 'A',
    defaultMasking: { type: 'none' },
    overrides: [],
  },
  {
    fieldPath: 'patient.cpf',
    dataClass: 'B',
    defaultMasking: { type: 'partial', pattern: '***.***.***-XX', keepLast: 2 },
    overrides: [
      { role: 'receptionist_registration', masking: { type: 'none' } },
      { role: 'billing_authorization', masking: { type: 'none' } },
    ],
  },
  {
    fieldPath: 'chart.vitals',
    dataClass: 'C',
    defaultMasking: { type: 'redact' },
    overrides: [
      { role: 'nurse', masking: { type: 'none' } },
      { role: 'nursing_technician', masking: { type: 'none' } },
      { role: 'medical_staff_attending', masking: { type: 'none' } },
      { role: 'medical_staff_on_call', masking: { type: 'none' } },
      { role: 'physiotherapist', masking: { type: 'none' } },
    ],
  },
  {
    fieldPath: 'chart.diagnosis',
    dataClass: 'D',
    defaultMasking: { type: 'redact' },
    overrides: [
      { role: 'medical_staff_attending', masking: { type: 'none' } },
      { role: 'medical_staff_on_call', masking: { type: 'none' } },
      { role: 'clinical_director', masking: { type: 'none' } },
      {
        role: 'billing_authorization',
        masking: { type: 'partial', pattern: 'CID: X##.#', keepLast: 0 },
        conditions: [{ attribute: 'purpose', operator: 'equals', value: 'billing' }],
      },
    ],
  },
  {
    fieldPath: 'chart.psychotherapy_notes',
    dataClass: 'E',
    defaultMasking: { type: 'redact' },
    overrides: [
      {
        role: 'psychologist',
        masking: { type: 'none' },
        conditions: [{ attribute: 'user.id', operator: 'equals', value: '{{record.author_id}}' }],
      },
    ],
  },
];
```

### 5.2 Funcao de Filtragem de Resposta

```typescript
async function filterResponse(
  data: Record<string, unknown>,
  userContext: {
    userId: string;
    activeRole: string;
    purpose: string;
    accessLevel: number;
  },
): Promise<{
  filteredData: Record<string, unknown>;
  accessedFields: string[];
  maskedFields: string[];
  redactedFields: string[];
}> {
  const accessedFields: string[] = [];
  const maskedFields: string[] = [];
  const redactedFields: string[] = [];

  const filteredData = deepClone(data);

  for (const fieldClassification of allFieldClassifications) {
    const fieldValue = getNestedValue(filteredData, fieldClassification.fieldPath);
    if (fieldValue === undefined) continue;

    // Verificar se o nivel de acesso permite a classe
    const classMinLevel = getMinLevel(fieldClassification.dataClass);
    if (userContext.accessLevel < classMinLevel) {
      setNestedValue(filteredData, fieldClassification.fieldPath, undefined);
      redactedFields.push(fieldClassification.fieldPath);
      continue;
    }

    // Aplicar mascaramento conforme role
    const override = fieldClassification.overrides.find((o) => o.role === userContext.activeRole);
    const maskingStrategy = override?.masking || fieldClassification.defaultMasking;

    if (maskingStrategy.type === 'redact') {
      setNestedValue(filteredData, fieldClassification.fieldPath, undefined);
      redactedFields.push(fieldClassification.fieldPath);
    } else if (maskingStrategy.type === 'partial') {
      const masked = applyPartialMask(fieldValue, maskingStrategy);
      setNestedValue(filteredData, fieldClassification.fieldPath, masked);
      maskedFields.push(fieldClassification.fieldPath);
    } else if (maskingStrategy.type === 'none') {
      accessedFields.push(fieldClassification.fieldPath);
    } else if (maskingStrategy.type === 'hash') {
      const hashed = hashValue(fieldValue, maskingStrategy.algorithm);
      setNestedValue(filteredData, fieldClassification.fieldPath, hashed);
      maskedFields.push(fieldClassification.fieldPath);
    } else if (maskingStrategy.type === 'tokenize') {
      const token = await tokenize(fieldValue);
      setNestedValue(filteredData, fieldClassification.fieldPath, token);
      maskedFields.push(fieldClassification.fieldPath);
    }
  }

  return { filteredData, accessedFields, maskedFields, redactedFields };
}
```

---

## 6. Cenarios de Classificacao

### 6.1 Cenario: Internacao de Rotina

```
Paciente admitido para cirurgia eletiva de colecistectomia.

Dados gerados e suas classes:
- Leito 405-B atribuido                    --> Classe A
- Cadastro com CPF, endereco, convenio     --> Classe B
- Sinais vitais na admissao                --> Classe C
- Alergias a latex e dipirona              --> Classe C
- Prescricao pre-operatoria               --> Classe D
- Diagnostico: K80.1 (Colelitíase)        --> Classe D
- Historico: DM tipo 2, HAS               --> Classe D
- Termo de consentimento cirurgico         --> Classe D
```

### 6.2 Cenario: Atendimento de Emergencia com HIV

```
Paciente chega ao PS com pneumonia. Descoberta de HIV durante investigacao.

Dados gerados e suas classes:
- Leito PS-12 atribuido                   --> Classe A
- Cadastro rapido (nome, contato)          --> Classe B
- Sinais vitais, exames de admissao        --> Classe C
- Rx torax, hemograma                      --> Classe C
- Diagnostico: pneumonia (J18.9)           --> Classe D
- Teste rapido HIV: reagente               --> Classe E (Lei 12.984/2014)
- Carga viral, CD4                         --> Classe E
- Notificacao ao SINAN                     --> Classe D (sistema de notificacao)
```

### 6.3 Cenario: Violencia Domestica

```
Paciente atendida com lesoes sugestivas de violencia domestica.

Dados gerados e suas classes:
- Leito Observacao-3                       --> Classe A
- Cadastro da paciente                     --> Classe B
- Descricao das lesoes, exame fisico       --> Classe C
- Diagnostico: CID T74.1 (Abuso fisico)   --> Classe D
- Relato da agressao, agressor identificado --> Classe E
- Boletim de ocorrencia vinculado          --> Classe E
- Notificacao SINAN violencia              --> Classe D
- Encaminhamento para delegacia da mulher  --> Classe E
- Fotos das lesoes (pericia)               --> Classe E
```

---

## 7. Promocao e Reclassificacao de Dados

### 7.1 Promocao Automatica

Eventos que promovem dados a uma classe superior:

| Evento                               | Classe Original | Nova Classe | Trigger                                 |
| ------------------------------------ | --------------- | ----------- | --------------------------------------- |
| Diagnostico de doenca de notificacao | C               | D           | CID na lista de notificacao compulsoria |
| Diagnostico de HIV/AIDS              | D               | E           | CID B20-B24                             |
| Registro de violencia                | C               | E           | CID T74._, Y07._                        |
| Ordem judicial de sequestro          | Qualquer        | E           | Cadastro de ordem judicial              |
| Paciente em protecao de identidade   | B               | E           | Flag de identidade protegida            |
| Registro de dependencia quimica      | D               | E           | CID F10-F19 em contexto de tratamento   |
| Dados geneticos recebidos            | C               | E           | Tipo de exame = genetico                |

### 7.2 Reclassificacao Manual

```yaml
reclassification:
  who_can_request:
    - clinical_director
    - compliance_auditor
    - dpo # Data Protection Officer

  workflow:
    - step: request
      actor: requester
      fields: [field_path, current_class, proposed_class, justification]

    - step: clinical_review
      actor: clinical_director
      condition: 'proposed_class involves clinical data'
      sla: 48h

    - step: legal_review
      actor: dpo
      condition: 'reclassification to E or from E'
      sla: 72h

    - step: approval
      actor: compliance_auditor
      sla: 24h

    - step: implementation
      actor: security_admin_jit
      sla: 4h

    - step: verification
      actor: compliance_auditor
      sla: 24h

  audit:
    log_level: maximum
    retain: permanent
    notification: [dpo, clinical_director, security_team]
```

---

## 8. Retencao e Descarte

| Classe | Retencao Minima | Base Legal                                  | Descarte                       |
| ------ | --------------- | ------------------------------------------- | ------------------------------ |
| A      | 5 anos          | Prazo prescricional geral                   | Anonimizacao ou exclusao       |
| B      | 10 anos         | LGPD + prazos tributarios                   | Exclusao segura (crypto-erase) |
| C      | 20 anos         | CFM 1.821/2007 (prontuario medico)          | Exclusao segura + certificacao |
| D      | 20 anos         | CFM 1.821/2007                              | Exclusao segura + certificacao |
| E      | 20+ anos        | Legislacao especifica (pode ser permanente) | Conforme determinacao legal    |

### 8.1 Processo de Descarte Seguro

```
DADOS COM RETENCAO EXPIRADA
        |
        v
Verificar se ha obrigacao legal de manter?
        |
   +----+----+
   |         |
  SIM       NAO
   |         |
   v         v
MANTER    Classe E?
(atualizar  |
 retencao) +----+----+
           |         |
          SIM       NAO
           |         |
           v         v
         Aprovacao  Exclusao
         DPO +      segura
         Juridico   (crypto-erase)
           |
           v
         Exclusao com
         certificacao +
         registro permanente
         da existencia anterior
```

---

## 9. Monitoramento e Alertas por Classe

```yaml
monitoring:
  class_a:
    access_monitoring: aggregate_only # Sem monitoramento individual
    anomaly_detection: false
    reporting: monthly_summary

  class_b:
    access_monitoring: per_session
    anomaly_detection: true
    anomaly_rules:
      - 'Mais de 50 registros acessados por sessao'
      - 'Acesso fora do horario comercial (sem turno ativo)'
    reporting: weekly_summary

  class_c:
    access_monitoring: per_access
    anomaly_detection: true
    anomaly_rules:
      - 'Acesso a paciente sem relacao ativa'
      - 'Mais de 20 prontuarios acessados em 1h'
      - 'Acesso a paciente de outro setor'
    reporting: daily_summary
    real_time_alerts: anomalies_only

  class_d:
    access_monitoring: per_field
    anomaly_detection: true
    anomaly_rules:
      - 'Qualquer acesso sem relacao ativa'
      - 'Mais de 10 prontuarios acessados em 1h'
      - 'Acesso a diagnosticos por role nao clinico'
      - 'Download ou export de dados Classe D'
    reporting: daily_detail
    real_time_alerts: suspicious_patterns

  class_e:
    access_monitoring: per_field_with_alert
    anomaly_detection: true
    anomaly_rules:
      - 'Todo acesso gera alerta'
      - 'Verificacao de justificativa obrigatoria'
    reporting: per_access_report
    real_time_alerts: every_access
    notification_targets:
      - security_officer
      - dpo
      - clinical_director
      - compliance_auditor
```

---

_Documento mantido pela equipe de Arquitetura de Seguranca - Velya Platform._
_Proxima revisao programada: 2026-07-08._
